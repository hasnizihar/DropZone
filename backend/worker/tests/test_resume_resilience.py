import os
import json
import time
import socket
import hashlib
import tempfile
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import pytest

from dropzone_worker.services.direct_stream_engine import DirectStreamEngine
from dropzone_worker.services.direct_http_service import DirectHttpService, parse_retry_after, parse_content_range
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

CHUNK_PATTERN = b"DROPZONE_RESUME_TEST_BLOCK_0123456789ABCDEF_"
TEST_PAYLOAD = (CHUNK_PATTERN * (262144 // len(CHUNK_PATTERN) + 1))[:262144]
EXPECTED_SHA256 = hashlib.sha256(TEST_PAYLOAD).hexdigest()

class MockResilienceServer(BaseHTTPRequestHandler):
    req_counts = {}
    lock = threading.Lock()

    def log_message(self, format, *args):
        pass

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
                self.end_headers()
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
        elif path == "/rate-429-exhausted":
            self.send_response(429)
            self.send_header("Retry-After", "60")
            self.end_headers()
        elif path == "/no-range":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "none")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        cnt = self.inc_count(path + ":GET")
        range_hdr = self.headers.get("Range")

        if path == "/rate-429-retry":
            if cnt <= 2:
                self.send_response(429)
                self.send_header("Retry-After", "1")
                self.end_headers()
                return

        if path == "/rate-429-exhausted":
            self.send_response(429)
            self.send_header("Retry-After", "60")
            self.end_headers()
            return

        if path == "/no-range":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
            self.send_header("Accept-Ranges", "none")
            self.end_headers()
            self.wfile.write(TEST_PAYLOAD)
            return

        if range_hdr and range_hdr.startswith("bytes="):
            bytes_range = range_hdr.replace("bytes=", "").strip()
            start_str, _, end_str = bytes_range.partition("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else len(TEST_PAYLOAD) - 1

            chunk = TEST_PAYLOAD[start:end + 1]
            self.send_response(206)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(TEST_PAYLOAD)}")
            self.send_header("Content-Length", str(len(chunk)))
            self.send_header("ETag", '"etag-range-1"')
            self.end_headers()
            self.wfile.write(chunk)
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(TEST_PAYLOAD)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", '"etag-range-1"')
        self.end_headers()
        self.wfile.write(TEST_PAYLOAD)

@pytest.fixture(scope="module")
def resilience_server():
    server = HTTPServer(("127.0.0.1", 0), MockResilienceServer)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()

def test_parse_retry_after_numeric_and_date():
    assert parse_retry_after("10") == 10.0
    assert parse_retry_after(" 5 ") == 5.0
    assert parse_retry_after(None) is None
    assert parse_retry_after("invalid-value") is None
    # Future date string
    future_date = "Fri, 31 Dec 2030 23:59:59 GMT"
    val = parse_retry_after(future_date)
    assert val is not None and val > 0

def test_parse_content_range_header():
    assert parse_content_range("bytes 1048576-104857599/104857600") == (1048576, 104857599, 104857600)
    assert parse_content_range("bytes 0-499/500") == (0, 499, 500)
    assert parse_content_range("bytes 500-999/*") == (500, 999, None)
    assert parse_content_range(None) is None
    assert parse_content_range("invalid") is None

def test_resume_skips_redundant_inspect(tmp_path, resilience_server):
    MockResilienceServer.reset_counts()
    url = f"{resilience_server}/range-file"
    out_dir = str(tmp_path)
    part_file = tmp_path / "resume_test.dat.part"
    meta_file = tmp_path / "resume_test.dat.part.meta.json"

    part_file.write_bytes(TEST_PAYLOAD[:50000])
    meta_file.write_text(json.dumps({
        "url": url,
        "finalUrl": url,
        "etag": '"etag-range-1"',
        "expectedBytes": len(TEST_PAYLOAD),
        "finalFilename": "resume_test.dat",
        "supportsResume": True,
    }))

    engine = DirectStreamEngine()
    res = engine.execute_download(
        job_id="test_skip_inspect",
        url=url,
        target_directory=out_dir,
        custom_filename="resume_test.dat",
        check_dns=False,
        allow_loopback=True,
    )

    assert res["success"] is True
    assert (tmp_path / "resume_test.dat").read_bytes() == TEST_PAYLOAD
    # Verify HEAD request was completely skipped!
    assert MockResilienceServer.get_count("/range-file:HEAD") == 0

def test_resume_handles_429_backoff(tmp_path, resilience_server):
    MockResilienceServer.reset_counts()
    url = f"{resilience_server}/rate-429-retry"
    engine = DirectStreamEngine()
    t0 = time.time()
    res = engine.execute_download(
        job_id="test_429_backoff",
        url=url,
        target_directory=str(tmp_path),
        custom_filename="res429.dat",
        check_dns=False,
        allow_loopback=True,
    )
    elapsed = time.time() - t0

    assert res["success"] is True
    assert (tmp_path / "res429.dat").read_bytes() == TEST_PAYLOAD
    assert elapsed >= 2.0
    assert MockResilienceServer.get_count("/rate-429-retry:GET") == 3

def test_non_range_server_clean_overwrite(tmp_path, resilience_server):
    MockResilienceServer.reset_counts()
    url = f"{resilience_server}/no-range"
    part_file = tmp_path / "norange.dat.part"
    meta_file = tmp_path / "norange.dat.part.meta.json"

    # Write corrupt data
    part_file.write_bytes(b"OLD_CORRUPTED_BYTES_" * 1000)
    meta_file.write_text(json.dumps({"url": url, "finalFilename": "norange.dat"}))

    engine = DirectStreamEngine()
    res = engine.execute_download(
        job_id="test_no_range",
        url=url,
        target_directory=str(tmp_path),
        custom_filename="norange.dat",
        check_dns=False,
        allow_loopback=True,
    )

    assert res["success"] is True
    # Corrupt data was truncated/overwritten cleanly
    assert (tmp_path / "norange.dat").read_bytes() == TEST_PAYLOAD

def test_permanent_429_preserves_partial_data(tmp_path, resilience_server):
    MockResilienceServer.reset_counts()
    url = f"{resilience_server}/rate-429-exhausted"
    part_file = tmp_path / "exhausted.dat.part"
    meta_file = tmp_path / "exhausted.dat.part.meta.json"

    part_file.write_bytes(TEST_PAYLOAD[:15000])
    meta_file.write_text(json.dumps({"url": url, "finalFilename": "exhausted.dat"}))

    engine = DirectStreamEngine()
    with pytest.raises(WorkerProtocolError) as exc_info:
        engine.execute_download(
            job_id="test_exhausted",
            url=url,
            target_directory=str(tmp_path),
            custom_filename="exhausted.dat",
            check_dns=False,
            allow_loopback=True,
        )

    assert exc_info.value.code == ProtocolErrorCode.RATE_LIMITED
    # Partial files MUST remain on disk
    assert part_file.exists()
    assert len(part_file.read_bytes()) == 15000
    assert meta_file.exists()

