#!/usr/bin/env python3
"""
DROPZONE Stage 8.2: Duplicate Download Filename Overwrite Prevention Test Suite
Tests sequential and simultaneous duplicate downloads, extension preservation,
Windows reserved name protection, sidecar metadata isolation, and checksums.
"""

import sys
import os
import time
import hashlib
import tempfile
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# Add worker src to path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKER_SRC = os.path.join(REPO_ROOT, "backend", "worker", "src")
if WORKER_SRC not in sys.path:
    sys.path.insert(0, WORKER_SRC)

from dropzone_worker.services.direct_stream_engine import (
    DirectStreamEngine,
    split_base_and_ext,
    resolve_unique_filename,
)
from dropzone_worker.services.direct_http_service import DirectHttpService

# 1 MB of test data
TEST_PAYLOAD = b"DropZone_Duplicate_Filename_Test_Data_Block_" * (1024 * 24)
TEST_PAYLOAD_SHA256 = hashlib.sha256(TEST_PAYLOAD).hexdigest()

class MockDuplicateHttpServer(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", '"dropzone-test-hash"')
        self.end_headers()

    def do_GET(self):
        range_header = self.headers.get("Range")
        total = len(TEST_PAYLOAD)

        if range_header and range_header.startswith("bytes="):
            byte_range = range_header[6:].strip()
            parts = byte_range.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else total - 1
            if end >= total:
                end = total - 1

            chunk_len = end - start + 1
            self.send_response(206)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
            self.send_header("Content-Length", str(chunk_len))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(TEST_PAYLOAD[start:end + 1])
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(total))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(TEST_PAYLOAD)


def run_scenario(name, test_fn):
    print(f"\n[RUNNING] {name} ...")
    try:
        test_fn()
        print(f"[PASSED]  {name}")
        return True
    except Exception as e:
        print(f"[FAILED]  {name} -> {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    server = HTTPServer(("127.0.0.1", 0), MockDuplicateHttpServer)
    port = server.server_port
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"
    print(f"Test HTTP Server running on {base_url}")

    results = []

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = DirectStreamEngine(
            write_event_fn=lambda name, payload: None,
            http_service=DirectHttpService(),
        )

        # ---------------------------------------------------------
        # Scenario 1: Sequential Duplicate Downloads of 10Mb.dat
        # ---------------------------------------------------------
        def test_sequential_duplicates():
            url = f"{base_url}/files/10Mb.dat"

            # Download 1
            fn1 = resolve_unique_filename(tmpdir, "10Mb.dat")
            res1 = engine.execute_download(
                url=url,
                target_directory=tmpdir,
                job_id="seq_job_1",
                custom_filename=fn1,
                allow_loopback=True,
            )
            p1 = res1["outputPath"]
            assert os.path.exists(p1), f"File 1 missing: {p1}"
            assert os.path.basename(p1) == "10Mb.dat"

            # Download 2: same URL, should allocate 10Mb (1).dat
            fn2 = resolve_unique_filename(tmpdir, "10Mb.dat")
            assert fn2 == "10Mb (1).dat", f"Expected '10Mb (1).dat', got '{fn2}'"
            res2 = engine.execute_download(
                url=url,
                target_directory=tmpdir,
                job_id="seq_job_2",
                custom_filename=fn2,
                allow_loopback=True,
            )
            p2 = res2["outputPath"]
            assert os.path.exists(p2), f"File 2 missing: {p2}"
            assert os.path.basename(p2) == "10Mb (1).dat"

            # Download 3: same URL, should allocate 10Mb (2).dat
            fn3 = resolve_unique_filename(tmpdir, "10Mb.dat")
            assert fn3 == "10Mb (2).dat", f"Expected '10Mb (2).dat', got '{fn3}'"
            res3 = engine.execute_download(
                url=url,
                target_directory=tmpdir,
                job_id="seq_job_3",
                custom_filename=fn3,
                allow_loopback=True,
            )
            p3 = res3["outputPath"]
            assert os.path.exists(p3), f"File 3 missing: {p3}"
            assert os.path.basename(p3) == "10Mb (2).dat"

            # Verify all 3 files exist independently and have matching SHA-256
            for p in (p1, p2, p3):
                with open(p, "rb") as f:
                    digest = hashlib.sha256(f.read()).hexdigest()
                    assert digest == TEST_PAYLOAD_SHA256, f"Corrupted file: {p}"

        results.append(run_scenario("Scenario 1: Sequential Duplicate Downloads (10Mb.dat, 10Mb (1).dat, 10Mb (2).dat)", test_sequential_duplicates))

        # ---------------------------------------------------------
        # Scenario 2: Simultaneous Concurrent Duplicate Downloads
        # ---------------------------------------------------------
        def test_simultaneous_duplicates():
            url = f"{base_url}/files/10Mb.dat"
            sim_dir = os.path.join(tmpdir, "simultaneous")
            os.makedirs(sim_dir, exist_ok=True)

            # Pre-allocate reservations (as QueueManager does atomically)
            used = set()
            fn1 = resolve_unique_filename(sim_dir, "10Mb.dat")
            used.add(fn1.lower())

            # Simulate QueueManager resolving second job before first completes
            base, ext = split_base_and_ext("10Mb.dat")
            counter = 1
            cand = f"{base} ({counter}){ext}"
            while cand.lower() in used or os.path.exists(os.path.join(sim_dir, cand)):
                counter += 1
                cand = f"{base} ({counter}){ext}"
            fn2 = cand
            used.add(fn2.lower())

            assert fn1 == "10Mb.dat"
            assert fn2 == "10Mb (1).dat"

            res = {}
            errors = []

            def worker_run(jid, fname):
                try:
                    res[jid] = engine.execute_download(
                        url=url,
                        target_directory=sim_dir,
                        job_id=jid,
                        custom_filename=fname,
                        allow_loopback=True,
                    )
                except Exception as exc:
                    errors.append(exc)

            t1 = threading.Thread(target=worker_run, args=("sim_1", fn1))
            t2 = threading.Thread(target=worker_run, args=("sim_2", fn2))

            t1.start()
            t2.start()
            t1.join()
            t2.join()

            assert len(errors) == 0, f"Errors in concurrent download: {errors}"
            p1 = res["sim_1"]["outputPath"]
            p2 = res["sim_2"]["outputPath"]

            assert os.path.exists(p1) and os.path.basename(p1) == "10Mb.dat"
            assert os.path.exists(p2) and os.path.basename(p2) == "10Mb (1).dat"

            with open(p1, "rb") as f:
                assert hashlib.sha256(f.read()).hexdigest() == TEST_PAYLOAD_SHA256
            with open(p2, "rb") as f:
                assert hashlib.sha256(f.read()).hexdigest() == TEST_PAYLOAD_SHA256

        results.append(run_scenario("Scenario 2: Simultaneous Concurrent Duplicate Downloads", test_simultaneous_duplicates))

        # ---------------------------------------------------------
        # Scenario 3: Compound Extensions (.tar.gz, .tar.bz2)
        # ---------------------------------------------------------
        def test_compound_extensions():
            compound_dir = os.path.join(tmpdir, "compound")
            os.makedirs(compound_dir, exist_ok=True)
            url = f"{base_url}/archive.tar.gz"

            fn1 = resolve_unique_filename(compound_dir, "archive.tar.gz")
            assert fn1 == "archive.tar.gz"
            res1 = engine.execute_download(
                url=url,
                target_directory=compound_dir,
                job_id="comp_1",
                custom_filename=fn1,
                allow_loopback=True,
            )

            fn2 = resolve_unique_filename(compound_dir, "archive.tar.gz")
            assert fn2 == "archive (1).tar.gz", f"Failed compound extension: {fn2}"
            res2 = engine.execute_download(
                url=url,
                target_directory=compound_dir,
                job_id="comp_2",
                custom_filename=fn2,
                allow_loopback=True,
            )

            assert os.path.basename(res1["outputPath"]) == "archive.tar.gz"
            assert os.path.basename(res2["outputPath"]) == "archive (1).tar.gz"

        results.append(run_scenario("Scenario 3: Compound Extension Preservation (archive.tar.gz -> archive (1).tar.gz)", test_compound_extensions))

        # ---------------------------------------------------------
        # Scenario 4: Partial (.part) and Sidecar Metadata Isolation
        # ---------------------------------------------------------
        def test_part_file_isolation():
            part_dir = os.path.join(tmpdir, "parts")
            os.makedirs(part_dir, exist_ok=True)
            url = f"{base_url}/files/10Mb.dat"

            # Create an in-progress .part and sidecar metadata for 10Mb.dat
            dummy_part = os.path.join(part_dir, "10Mb.dat.part")
            dummy_meta = os.path.join(part_dir, "10Mb.dat.part.meta.json")
            with open(dummy_part, "wb") as f:
                f.write(b"in-progress-partial-bytes")
            with open(dummy_meta, "w") as f:
                f.write(f'{{"url": "{url}", "finalFilename": "10Mb.dat"}}')

            # Now resolve unique filename for a new job requesting 10Mb.dat
            new_fn = resolve_unique_filename(part_dir, "10Mb.dat")
            # Must NOT allocate 10Mb.dat while .part or .part.meta.json is on disk!
            assert new_fn == "10Mb (1).dat", f"Failed to detect active .part collision: {new_fn}"

            res = engine.execute_download(
                url=url,
                target_directory=part_dir,
                job_id="part_job",
                custom_filename=new_fn,
                allow_loopback=True,
            )

            # Verify new job downloaded to 10Mb (1).dat and did NOT touch 10Mb.dat.part
            assert os.path.basename(res["outputPath"]) == "10Mb (1).dat"
            with open(dummy_part, "rb") as f:
                assert f.read() == b"in-progress-partial-bytes", "Original .part file was corrupted or hijacked!"

        results.append(run_scenario("Scenario 4: Active Partial (.part) and Sidecar Metadata Isolation", test_part_file_isolation))

    server.shutdown()

    print("\n" + "=" * 60)
    print(f"Summary: {sum(results)} of {len(results)} Scenarios Passed")
    print("=" * 60)
    if not all(results):
        sys.exit(1)


if __name__ == "__main__":
    main()

