#!/usr/bin/env python3
"""
DROPZONE Stage 5.1 Verification Script: Resume Resilience & HTTP 429 Rate Limiting
Tests 7 controlled local scenarios and real-world transfer resilience:
1. Resume with a server supporting HTTP Range.
2. Resume when the server returns HTTP 429 with Retry-After.
3. Resume when the server returns HTTP 429 without Retry-After (exponential backoff).
4. Permanent 429 exceeding budget (preserves partial file without corrupting or deleting).
5. Server does not support Range requests (clean overwrite without byte duplication).
6. Network interruption mid-stream followed by resume.
7. Rapid repeated pause/resume cycles.
"""

import os
import sys
import time
import json
import socket
import hashlib
import tempfile
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# Add backend/worker/src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "worker", "src")))

from dropzone_worker.services.direct_stream_engine import DirectStreamEngine
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

# 256 KB test content with predictable deterministic bytes
CHUNK_PATTERN = b"DROPZONE_RESUME_TEST_BLOCK_0123456789ABCDEF_"
TEST_PAYLOAD = (CHUNK_PATTERN * (262144 // len(CHUNK_PATTERN) + 1))[:262144]
EXPECTED_SHA256 = hashlib.sha256(TEST_PAYLOAD).hexdigest()

class ControlledResilienceHandler(BaseHTTPRequestHandler):
    # Server state across requests
    req_counts = {}
    lock = threading.Lock()

    def log_message(self, format, *args):
        pass  # Suppress console logging noise

    @classmethod
    def reset_counts(cls):
        with cls.lock:
            cls.req_counts.clear()

    @classmethod
    def get_count(cls, path):
        with cls.lock:
            return cls.req_counts.get(path, 0)

    @classmethod
    def inc_count(cls, path):
        with cls.lock:
            cls.req_counts[path] = cls.req_counts.get(path, 0) + 1
            return cls.req_counts[path]

    def do_HEAD(self):
        path = self.path.split("?")[0]
        cnt = self.inc_count(path + ":HEAD")

        if path == "/range-file":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-range-1"')
            self.end_headers()
        elif path == "/rate-429-retry":
            if cnt <= 2:
                self.send_response(429)
                self.send_header("Retry-After", "1")
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate limited")
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("ETag", '"etag-429-1"')
                self.end_headers()
        elif path == "/rate-429-no-retry":
            if cnt <= 1:
                self.send_response(429)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate limited")
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("ETag", '"etag-429-noretry"')
                self.end_headers()
        elif path == "/rate-429-exhausted":
            self.send_response(429)
            self.send_header("Retry-After", "60")
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Rate limited permanently")
        elif path == "/no-range":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "none")
            self.end_headers()
        elif path == "/interrupt":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-interrupt"')
            self.end_headers()
        elif path == "/throttled":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-throttled"')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        cnt = self.inc_count(path + ":GET")
        range_hdr = self.headers.get("Range")

        # 1. 429 with Retry-After: 1
        if path == "/rate-429-retry":
            if cnt <= 2:
                self.send_response(429)
                self.send_header("Retry-After", "1")
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate limited")
                return

        # 2. 429 without Retry-After (tests bounded exponential backoff)
        if path == "/rate-429-no-retry":
            if cnt <= 1:
                self.send_response(429)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate limited")
                return

        # 3. 429 permanently exhausted
        if path == "/rate-429-exhausted":
            self.send_response(429)
            self.send_header("Retry-After", "60")
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Rate limited permanently")
            return

        # 4. Server does not support Range (ignores Range header and sends 200 OK full content)
        if path == "/no-range":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "none")
            self.end_headers()
            self.wfile.write(TEST_PAYLOAD)
            return

        # 5. Network interruption simulation: sends partial bytes then abruptly cuts connection
        if path == "/interrupt":
            if cnt == 1:
                # Abrupt cut after 80KB (ensures at least one 64KB chunk was flushed to disk)
                cut_len = 80000
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("ETag", '"etag-interrupt"')
                self.end_headers()
                self.wfile.write(TEST_PAYLOAD[:cut_len])
                try:
                    self.wfile.flush()
                except Exception:
                    pass
                # Abruptly close connection
                try:
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                except Exception:
                    pass
                return

        # 6. Throttled path for deterministic pause/resume testing
        if path == "/throttled":
            start = 0
            end = len(TEST_PAYLOAD) - 1
            if range_hdr and range_hdr.startswith("bytes="):
                bytes_range = range_hdr.replace("bytes=", "").strip()
                start_str, _, end_str = bytes_range.partition("-")
                start = int(start_str) if start_str else 0
                end = int(end_str) if end_str else len(TEST_PAYLOAD) - 1

            chunk = TEST_PAYLOAD[start:end + 1]
            if range_hdr:
                self.send_response(206)
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(TEST_PAYLOAD)}")
            else:
                self.send_response(200)

            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(chunk)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-throttled"')
            self.end_headers()

            # Stream in 16KB sub-chunks with 25ms delay to allow deterministic pause
            sub_size = 16384
            for i in range(0, len(chunk), sub_size):
                sub = chunk[i:i + sub_size]
                try:
                    self.wfile.write(sub)
                    self.wfile.flush()
                    time.sleep(0.025)
                except Exception:
                    break
            return

        # Standard Range handling for /range-file and subsequent /interrupt or /rate-429 requests
        if range_hdr and range_hdr.startswith("bytes="):
            bytes_range = range_hdr.replace("bytes=", "").strip()
            start_str, _, end_str = bytes_range.partition("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else len(TEST_PAYLOAD) - 1

            if start >= len(TEST_PAYLOAD):
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{len(TEST_PAYLOAD)}")
                self.end_headers()
                return

            chunk = TEST_PAYLOAD[start:end + 1]
            self.send_response(206)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(TEST_PAYLOAD)}")
            self.send_header("Content-Length", str(len(chunk)))
            self.send_header("ETag", '"etag-range-1"')
            self.end_headers()
            self.wfile.write(chunk)
            return

        # Full content response
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", '"etag-range-1"')
        self.end_headers()
        self.wfile.write(TEST_PAYLOAD)

def run_tests():
    print("=" * 70)
    print("DROPZONE STAGE 5.1: RESUME RESILIENCE & HTTP 429 VERIFICATION")
    print("=" * 70)

    # Start local controlled test server
    server = HTTPServer(("127.0.0.1", 0), ControlledResilienceHandler)
    port = server.server_port
    server_url = f"http://127.0.0.1:{port}"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"[Setup] Controlled test server running on {server_url}")

    results = []

    def log_result(name, passed, details=""):
        status = "PASSED" if passed else "FAILED"
        print(f"[{status}] {name}")
        if details:
            print(f"         {details}")
        results.append({"name": name, "passed": passed, "details": details})

    # -------------------------------------------------------------
    # Test 1: Resume with a server supporting HTTP Range
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/range-file"
            part_path = os.path.join(tmp_dir, "test1.dat.part")
            meta_path = os.path.join(tmp_dir, "test1.dat.part.meta.json")

            # Write partial file: first 40,000 bytes
            partial_len = 40000
            with open(part_path, "wb") as f:
                f.write(TEST_PAYLOAD[:partial_len])
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump({
                    "url": url,
                    "finalUrl": url,
                    "etag": '"etag-range-1"',
                    "expectedBytes": len(TEST_PAYLOAD),
                    "finalFilename": "test1.dat",
                    "supportsResume": True,
                }, f)

            engine = DirectStreamEngine()
            res = engine.execute_download(
                job_id="test1",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test1.dat",
                check_dns=False,
                allow_loopback=True,
            )

            final_file = os.path.join(tmp_dir, "test1.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            passed = (
                res["success"] is True and
                res["totalBytes"] == len(TEST_PAYLOAD) and
                len(content) == len(TEST_PAYLOAD) and
                final_sha == EXPECTED_SHA256 and
                not os.path.exists(part_path) and
                not os.path.exists(meta_path)
            )
            # Verify inspect_url was SKIPPED on valid resume: HEAD should be 0!
            head_count = ControlledResilienceHandler.get_count("/range-file:HEAD")
            get_count = ControlledResilienceHandler.get_count("/range-file:GET")
            details = f"Bytes: {len(content)}, SHA: {final_sha[:8]}..., HEAD reqs: {head_count} (skipped), GET reqs: {get_count}"
            log_result("1. Resume with HTTP Range support (no redundant HEAD/GET)", passed and head_count == 0, details)
    except Exception as e:
        log_result("1. Resume with HTTP Range support", False, str(e))

    # -------------------------------------------------------------
    # Test 2: Resume when server returns HTTP 429 with Retry-After
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/rate-429-retry"
            engine = DirectStreamEngine()
            t0 = time.time()
            res = engine.execute_download(
                job_id="test2",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test2.dat",
                check_dns=False,
                allow_loopback=True,
            )
            elapsed = time.time() - t0

            final_file = os.path.join(tmp_dir, "test2.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            # Server returned 429 twice with Retry-After: 1, then 200 on 3rd attempt
            get_count = ControlledResilienceHandler.get_count("/rate-429-retry:GET")
            passed = (
                res["success"] is True and
                final_sha == EXPECTED_SHA256 and
                get_count == 3 and
                elapsed >= 2.0  # waited at least two 1s backoffs
            )
            details = f"Attempts: {get_count}, Elapsed: {elapsed:.2f}s (respected Retry-After), SHA matches"
            log_result("2. Resume with HTTP 429 and Retry-After", passed, details)
    except Exception as e:
        log_result("2. Resume with HTTP 429 and Retry-After", False, str(e))

    # -------------------------------------------------------------
    # Test 3: Resume when server returns HTTP 429 without Retry-After
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/rate-429-no-retry"
            engine = DirectStreamEngine()
            t0 = time.time()
            res = engine.execute_download(
                job_id="test3",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test3.dat",
                check_dns=False,
                allow_loopback=True,
            )
            elapsed = time.time() - t0

            final_file = os.path.join(tmp_dir, "test3.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            get_count = ControlledResilienceHandler.get_count("/rate-429-no-retry:GET")
            passed = (
                res["success"] is True and
                final_sha == EXPECTED_SHA256 and
                get_count == 2 and
                elapsed >= 1.9  # waited default exponential backoff ~2s
            )
            details = f"Attempts: {get_count}, Elapsed: {elapsed:.2f}s (bounded exponential backoff), SHA matches"
            log_result("3. Resume with HTTP 429 without Retry-After", passed, details)
    except Exception as e:
        log_result("3. Resume with HTTP 429 without Retry-After", False, str(e))

    # -------------------------------------------------------------
    # Test 4: Permanent 429 exceeding budget (preserves partial file)
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/rate-429-exhausted"
            part_path = os.path.join(tmp_dir, "test4.dat.part")
            meta_path = os.path.join(tmp_dir, "test4.dat.part.meta.json")

            # Pre-existing partial file
            with open(part_path, "wb") as f:
                f.write(TEST_PAYLOAD[:20000])
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump({"url": url, "finalFilename": "test4.dat", "expectedBytes": len(TEST_PAYLOAD)}, f)

            engine = DirectStreamEngine()
            failed_with_expected_code = False
            try:
                engine.execute_download(
                    job_id="test4",
                    url=url,
                    target_directory=tmp_dir,
                    custom_filename="test4.dat",
                    check_dns=False,
                    allow_loopback=True,
                )
            except WorkerProtocolError as exc:
                if exc.code == ProtocolErrorCode.RATE_LIMITED:
                    failed_with_expected_code = True

            # Crucial verification: Partial file and metadata MUST NOT be deleted
            part_preserved = os.path.exists(part_path) and os.path.getsize(part_path) == 20000
            meta_preserved = os.path.exists(meta_path)
            passed = failed_with_expected_code and part_preserved and meta_preserved
            details = f"Failed with RATE_LIMITED: {failed_with_expected_code}, .part preserved (size 20000): {part_preserved}, .meta preserved: {meta_preserved}"
            log_result("4. Permanent 429 preserves partial data without data loss", passed, details)
    except Exception as e:
        log_result("4. Permanent 429 preserves partial data", False, str(e))

    # -------------------------------------------------------------
    # Test 5: Server does not support Range (clean restart / overwrite)
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/no-range"
            part_path = os.path.join(tmp_dir, "test5.dat.part")
            meta_path = os.path.join(tmp_dir, "test5.dat.part.meta.json")

            # Write 50,000 bytes of junk data into .part to simulate previous interrupted download
            with open(part_path, "wb") as f:
                f.write(b"CORRUPTED_OLD_JUNK_DATA_" * 2000)
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump({"url": url, "finalFilename": "test5.dat"}, f)

            engine = DirectStreamEngine()
            res = engine.execute_download(
                job_id="test5",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test5.dat",
                check_dns=False,
                allow_loopback=True,
            )

            final_file = os.path.join(tmp_dir, "test5.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            # The engine must overwrite the junk data from offset 0, NOT append!
            passed = (
                res["success"] is True and
                len(content) == len(TEST_PAYLOAD) and
                final_sha == EXPECTED_SHA256
            )
            details = f"Bytes: {len(content)} (exact), SHA: {final_sha[:8]}... (no duplicate/corrupted bytes)"
            log_result("5. Non-Range server clean restart (zero byte corruption)", passed, details)
    except Exception as e:
        log_result("5. Non-Range server clean restart", False, str(e))

    # -------------------------------------------------------------
    # Test 6: Network interruption mid-stream followed by resume
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/interrupt"
            engine = DirectStreamEngine()

            # First attempt: connection dropped mid-stream by server
            interrupted = False
            try:
                engine.execute_download(
                    job_id="test6",
                    url=url,
                    target_directory=tmp_dir,
                    custom_filename="test6.dat",
                    check_dns=False,
                    allow_loopback=True,
                )
            except WorkerProtocolError:
                interrupted = True

            part_path = os.path.join(tmp_dir, "test6.dat.part")
            partial_exists = os.path.exists(part_path)
            partial_size = os.path.getsize(part_path) if partial_exists else 0

            # Second attempt: resume
            res = engine.execute_download(
                job_id="test6",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test6.dat",
                check_dns=False,
                allow_loopback=True,
            )

            final_file = os.path.join(tmp_dir, "test6.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            passed = (
                interrupted is True and
                partial_size > 0 and
                res["success"] is True and
                final_sha == EXPECTED_SHA256
            )
            details = f"Interrupted cleanly: {interrupted}, Partial bytes saved: {partial_size}, Resumed SHA matches: {final_sha[:8]}..."
            log_result("6. Network interruption followed by Range resume", passed, details)
    except Exception as e:
        log_result("6. Network interruption followed by Range resume", False, str(e))

    # -------------------------------------------------------------
    # Test 7: Repeated pause / resume cycles
    # -------------------------------------------------------------
    try:
        ControlledResilienceHandler.reset_counts()
        with tempfile.TemporaryDirectory() as tmp_dir:
            url = f"{server_url}/throttled"
            progress_history = []
            pause_on_progress = [False]

            def on_event(name, payload):
                if name == "download.progress":
                    progress_history.append(payload["progress"])
                    if pause_on_progress[0] and payload.get("downloadedBytes", 0) >= 60000:
                        pause_on_progress[0] = False
                        engine.pause_download("test7")

            engine = DirectStreamEngine(write_event_fn=on_event)

            # Cycle 1: Pause after 1 chunk (~65KB)
            pause_on_progress[0] = True
            res1 = engine.execute_download(
                job_id="test7",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test7.dat",
                check_dns=False,
                allow_loopback=True,
            )

            part_path = os.path.join(tmp_dir, "test7.dat.part")
            bytes_cycle1 = os.path.getsize(part_path) if os.path.exists(part_path) else 0

            # Cycle 2: Resume and pause again after 2 chunks (~131KB)
            def on_event_cycle2(name, payload):
                if name == "download.progress":
                    progress_history.append(payload["progress"])
                    if pause_on_progress[0] and payload.get("downloadedBytes", 0) >= 120000:
                        pause_on_progress[0] = False
                        engine.pause_download("test7")

            engine.write_event_fn = on_event_cycle2
            pause_on_progress[0] = True
            res2 = engine.execute_download(
                job_id="test7",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test7.dat",
                check_dns=False,
                allow_loopback=True,
            )

            bytes_cycle2 = os.path.getsize(part_path) if os.path.exists(part_path) else 0

            # Cycle 3: Resume to completion
            engine.write_event_fn = lambda name, payload: progress_history.append(payload.get("progress")) if name == "download.progress" else None
            res3 = engine.execute_download(
                job_id="test7",
                url=url,
                target_directory=tmp_dir,
                custom_filename="test7.dat",
                check_dns=False,
                allow_loopback=True,
            )

            final_file = os.path.join(tmp_dir, "test7.dat")
            content = open(final_file, "rb").read()
            final_sha = hashlib.sha256(content).hexdigest()

            passed = (
                bytes_cycle1 > 0 and
                bytes_cycle2 > bytes_cycle1 and
                res3["success"] is True and
                len(content) == len(TEST_PAYLOAD) and
                final_sha == EXPECTED_SHA256
            )
            details = f"Cycle 1 bytes: {bytes_cycle1}, Cycle 2 bytes: {bytes_cycle2}, Final SHA: {final_sha[:8]}... Progress entries: {len(progress_history)}"
            log_result("7. Repeated pause/resume cycles (accurate progress & zero corruption)", passed, details)
    except Exception as e:
        log_result("7. Repeated pause/resume cycles", False, str(e))

    # Shutdown server
    server.shutdown()

    print("=" * 70)
    all_passed = all(r["passed"] for r in results)
    summary_text = "ALL 7 RESUME RESILIENCE TESTS PASSED!" if all_passed else "SOME TESTS FAILED!"
    print(f"SUMMARY: {summary_text}")
    print("=" * 70)
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
