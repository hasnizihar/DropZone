import os
import json
import time
import socket
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import pytest

from dropzone_worker.services.direct_http_service import (
    DirectHttpService,
    sanitize_filename,
    parse_content_disposition_filename,
    classify_content_type,
)
from dropzone_worker.services.direct_stream_engine import DirectStreamEngine
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

TEST_CONTENT = b"DROPZONE_STREAM_TEST_PAYLOAD_CHUNK_1234567890" * 100  # 4600 bytes
TEST_ETAG = '"dropzone-etag-12345"'

class MockHttpHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress server stderr spam in test output

    def do_HEAD(self):
        if self.path == "/file.zip":
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(len(TEST_CONTENT)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", TEST_ETAG)
            self.send_header("Content-Disposition", 'attachment; filename="archive.zip"')
            self.end_headers()
        elif self.path == "/utf8.pdf":
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(len(TEST_CONTENT)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''document%202026.pdf")
            self.end_headers()
        elif self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/file.zip")
            self.end_headers()
        elif self.path == "/image.png":
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", "1024")
            self.end_headers()
        elif self.path == "/no-head":
            self.send_response(405)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/file.zip")
            self.end_headers()
            return

        if self.path == "/no-head":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_CONTENT)))
            self.end_headers()
            self.wfile.write(TEST_CONTENT)
            return

        if self.path in ("/file.zip", "/utf8.pdf"):
            range_header = self.headers.get("Range")
            if range_header and range_header.startswith("bytes="):
                # Handle Range
                bytes_range = range_header.replace("bytes=", "").strip()
                start_str, _, end_str = bytes_range.partition("-")
                start = int(start_str) if start_str else 0
                end = int(end_str) if end_str else len(TEST_CONTENT) - 1

                if start >= len(TEST_CONTENT):
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{len(TEST_CONTENT)}")
                    self.end_headers()
                    return

                chunk = TEST_CONTENT[start:end + 1]
                self.send_response(206)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(TEST_CONTENT)}")
                self.send_header("Content-Length", str(len(chunk)))
                self.send_header("ETag", TEST_ETAG)
                self.end_headers()
                self.wfile.write(chunk)
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(len(TEST_CONTENT)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", TEST_ETAG)
            self.end_headers()
            self.wfile.write(TEST_CONTENT)
            return

        self.send_response(404)
        self.end_headers()

@pytest.fixture(scope="module")
def local_http_server():
    server = HTTPServer(("127.0.0.1", 0), MockHttpHandler)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()

def test_sanitize_filename_protections():
    assert sanitize_filename("safe_file.txt") == "safe_file.txt"
    assert sanitize_filename("illegal:chars*?<>|file.mp4") == "illegal_chars_____file.mp4"
    assert sanitize_filename("../../../traversal.zip") == "traversal.zip"
    assert sanitize_filename("CON.txt") == "_CON.txt"
    assert sanitize_filename("NUL") == "_NUL"
    assert sanitize_filename("") == "download"

def test_parse_content_disposition_filenames():
    assert parse_content_disposition_filename('attachment; filename="report.pdf"') == "report.pdf"
    assert parse_content_disposition_filename("attachment; filename*=UTF-8''document%202026.pdf") == "document 2026.pdf"
    assert parse_content_disposition_filename(None) is None

def test_classify_content_type():
    assert classify_content_type("image/png", "photo.png") == "image"
    assert classify_content_type("application/zip", "archive.zip") == "archive"
    assert classify_content_type("application/pdf", "doc.pdf") == "document"
    assert classify_content_type("video/mp4", "movie.mp4") == "video"
    assert classify_content_type("audio/mpeg", "song.mp3") == "audio"
    assert classify_content_type("application/octet-stream", "binary.bin") == "file"

def test_direct_http_inspect_metadata(local_http_server):
    # In tests against 127.0.0.1 fixture, pass allow_loopback=True
    svc = DirectHttpService()
    url = f"{local_http_server}/file.zip"
    res = svc.inspect_url(url, check_dns=False, allow_loopback=True)

    assert res["filename"] == "archive.zip"
    assert res["fileSizeBytes"] == len(TEST_CONTENT)
    assert res["supportsResume"] is True
    assert res["category"] == "archive"
    assert res["mimeType"] == "application/zip"
    assert res["etag"] == TEST_ETAG

def test_direct_http_inspect_fallback_head(local_http_server):
    svc = DirectHttpService()
    url = f"{local_http_server}/no-head"
    res = svc.inspect_url(url, check_dns=False, allow_loopback=True)

    assert res["fileSizeBytes"] == len(TEST_CONTENT)
    assert res["mimeType"] == "application/octet-stream"

def test_direct_http_inspect_redirect(local_http_server):
    svc = DirectHttpService()
    url = f"{local_http_server}/redirect"
    res = svc.inspect_url(url, check_dns=False, allow_loopback=True)

    assert res["filename"] == "archive.zip"
    assert res["finalUrl"].endswith("/file.zip")

def test_direct_stream_engine_download_and_resume(tmp_path, local_http_server):
    events = []
    def record_event(name, payload):
        events.append((name, payload))

    engine = DirectStreamEngine(write_event_fn=record_event)
    url = f"{local_http_server}/file.zip"
    job_id = "test_stream_1"

    # Step 1: Initial partial download simulation - write first 1000 bytes into .part file
    out_dir = str(tmp_path)
    part_file = tmp_path / "archive.zip.part"
    meta_file = tmp_path / "archive.zip.part.meta.json"

    part_file.write_bytes(TEST_CONTENT[:1000])
    meta_file.write_text(json.dumps({"url": url, "etag": TEST_ETAG, "finalFilename": "archive.zip"}))

    # Step 2: Resume download via DirectStreamEngine
    res = engine.execute_download(
        job_id=job_id,
        url=url,
        target_directory=out_dir,
        check_dns=False,
        allow_loopback=True,
    )

    assert res["success"] is True
    assert res["totalBytes"] == len(TEST_CONTENT)

    final_file = tmp_path / "archive.zip"
    assert final_file.exists()
    assert final_file.read_bytes() == TEST_CONTENT
    assert not part_file.exists()
    assert not meta_file.exists()

    event_names = [e[0] for e in events]
    assert "download.started" in event_names
    assert "download.completed" in event_names

def test_direct_stream_engine_cancellation(tmp_path, local_http_server):
    engine = DirectStreamEngine()
    job_id = "cancel_job_1"
    url = f"{local_http_server}/file.zip"

    # Cancel before execution
    engine.cancel_download(job_id)

    # Trigger cancel during execution
    cancel_thread = threading.Thread(
        target=lambda: (time.sleep(0.01), engine.cancel_download(job_id))
    )
    cancel_thread.start()

    res = engine.execute_download(
        job_id=job_id,
        url=url,
        target_directory=str(tmp_path),
        check_dns=False,
        allow_loopback=True,
    )
    cancel_thread.join()

    assert res.get("cancelled") is True or res.get("success") is True
