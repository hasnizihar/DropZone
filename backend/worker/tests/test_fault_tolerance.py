import os
import time
import socket
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import pytest

from dropzone_worker.services.direct_stream_engine import DirectStreamEngine
from dropzone_worker.services.url_validator import (
    validate_url,
    validate_redirect,
    is_private_or_local_host,
    is_ip_disallowed,
)
from dropzone_worker.services.ffmpeg_service import FFmpegService
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

class FaultInjectionHttpHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress console logging in tests

    def do_HEAD(self):
        if self.path == "/error-429":
            self.send_response(429)
            self.end_headers()
        elif self.path == "/error-403":
            self.send_response(403)
            self.end_headers()
        elif self.path == "/error-401":
            self.send_response(401)
            self.end_headers()
        elif self.path == "/error-500":
            self.send_response(500)
            self.end_headers()
        elif self.path == "/error-503":
            self.send_response(503)
            self.end_headers()
        elif self.path == "/error-418":
            self.send_response(418)
            self.end_headers()
        else:
            self.send_response(200)
            self.send_header("Content-Length", "1000")
            self.end_headers()

    def do_GET(self):
        if self.path == "/error-429":
            self.send_response(429)
            self.end_headers()
        elif self.path == "/error-403":
            self.send_response(403)
            self.end_headers()
        elif self.path == "/error-401":
            self.send_response(401)
            self.end_headers()
        elif self.path == "/error-500":
            self.send_response(500)
            self.end_headers()
        elif self.path == "/error-503":
            self.send_response(503)
            self.end_headers()
        elif self.path == "/error-418":
            self.send_response(418)
            self.end_headers()
        elif self.path == "/ok-stream":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", "500")
            self.end_headers()
            self.wfile.write(b"X" * 500)
        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture(scope="module")
def fault_http_server():
    server = HTTPServer(("127.0.0.1", 0), FaultInjectionHttpHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


def test_direct_stream_engine_http_error_categorization(fault_http_server, tmp_path):
    engine = DirectStreamEngine()
    dest_dir = str(tmp_path / "downloads")
    os.makedirs(dest_dir, exist_ok=True)

    # 1. HTTP 429 Rate Limited
    with pytest.raises(WorkerProtocolError) as exc_429:
        engine.execute_download(
            job_id="job_429",
            url=f"{fault_http_server}/error-429",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_429.value.code == ProtocolErrorCode.RATE_LIMITED

    # 2. HTTP 403 / 401 Auth Required
    with pytest.raises(WorkerProtocolError) as exc_403:
        engine.execute_download(
            job_id="job_403",
            url=f"{fault_http_server}/error-403",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_403.value.code == ProtocolErrorCode.AUTH_REQUIRED

    # 3. HTTP 500 / 503 Network Error
    with pytest.raises(WorkerProtocolError) as exc_500:
        engine.execute_download(
            job_id="job_500",
            url=f"{fault_http_server}/error-500",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_500.value.code == ProtocolErrorCode.NETWORK_ERROR

    with pytest.raises(WorkerProtocolError) as exc_503:
        engine.execute_download(
            job_id="job_503",
            url=f"{fault_http_server}/error-503",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_503.value.code == ProtocolErrorCode.NETWORK_ERROR

    # 4. Other HTTP error (e.g. 418) -> DOWNLOAD_FAILED
    with pytest.raises(WorkerProtocolError) as exc_418:
        engine.execute_download(
            job_id="job_418",
            url=f"{fault_http_server}/error-418",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_418.value.code == ProtocolErrorCode.DOWNLOAD_FAILED


def test_direct_stream_engine_disk_write_error_handling(fault_http_server, tmp_path, monkeypatch):
    """Verifies that filesystem write failures (such as disk full) map cleanly to FILE_WRITE_ERROR."""
    engine = DirectStreamEngine()
    dest_dir = str(tmp_path / "disk_error_test")
    os.makedirs(dest_dir, exist_ok=True)

    # Monkeypatch built-in open to simulate disk write failure (ENOSPC / OSError)
    real_open = open
    def mock_open_failure(file, mode="r", *args, **kwargs):
        if "w" in mode or "a" in mode:
            raise OSError(28, "No space left on device")
        return real_open(file, mode, *args, **kwargs)

    monkeypatch.setattr("builtins.open", mock_open_failure)

    with pytest.raises(WorkerProtocolError) as exc_info:
        engine.execute_download(
            job_id="job_disk_full",
            url=f"{fault_http_server}/ok-stream",
            target_directory=dest_dir,
            allow_loopback=True,
            check_dns=False,
        )
    assert exc_info.value.code == ProtocolErrorCode.FILE_WRITE_ERROR
    assert "Filesystem write error" in exc_info.value.message


def test_ssrf_and_redirect_security_protections():
    """Validates SSRF defences against cloud metadata, private IPs, and protocol downgrades."""
    # 1. Cloud Metadata addresses
    assert is_ip_disallowed("169.254.169.254") is True
    assert is_ip_disallowed("fd00:ec2::254") is True

    # 2. Redirect to cloud metadata must be rejected (INVALID_URL)
    with pytest.raises(WorkerProtocolError) as exc_meta:
        validate_redirect(
            original_url="http://example.com/download",
            location_header="http://169.254.169.254/latest/meta-data/",
            redirect_count=1,
            allow_loopback=False,
        )
    assert exc_meta.value.code == ProtocolErrorCode.INVALID_URL

    # 3. Redirect to private RFC 1918 addresses must be rejected
    with pytest.raises(WorkerProtocolError):
        validate_redirect(
            original_url="http://example.com/download",
            location_header="http://192.168.1.1/admin",
            redirect_count=1,
            allow_loopback=False,
        )

    with pytest.raises(WorkerProtocolError):
        validate_redirect(
            original_url="http://example.com/download",
            location_header="http://10.0.0.1/secret",
            redirect_count=1,
            allow_loopback=False,
        )

    # 4. HTTPS to HTTP protocol downgrade must be rejected
    with pytest.raises(WorkerProtocolError) as exc_downgrade:
        validate_redirect(
            original_url="https://secure.example.com/file.zip",
            location_header="http://insecure.example.com/file.zip",
            redirect_count=1,
            allow_downgrade=False,
        )
    assert exc_downgrade.value.code == ProtocolErrorCode.NETWORK_ERROR
    assert "Insecure protocol downgrade" in exc_downgrade.value.message

    # 5. Exceeding max redirects (redirect loops) must be rejected
    with pytest.raises(WorkerProtocolError) as exc_loop:
        validate_redirect(
            original_url="https://example.com/step5",
            location_header="https://example.com/step6",
            redirect_count=5,
            max_redirects=5,
        )
    assert exc_loop.value.code == ProtocolErrorCode.NETWORK_ERROR
    assert "Exceeded maximum redirect limit" in exc_loop.value.message


def test_ffmpeg_service_fault_tolerance(tmp_path):
    """Verifies FFmpeg service fault-tolerance on missing inputs, invalid options, and probes."""
    service = FFmpegService()
    service._ffmpeg_path = service._ffmpeg_path or "mock_ffmpeg"

    # 1. Missing input file
    with pytest.raises(WorkerProtocolError) as exc_missing:
        service.execute_postprocess(
            job_id="job_nonexistent",
            input_path=str(tmp_path / "non_existent_input.mp4"),
            action="extract_audio",
            target_directory=str(tmp_path),
            audio_format="mp3",
        )
    assert exc_missing.value.code == ProtocolErrorCode.FILE_WRITE_ERROR

    # 2. Unsupported audio format
    dummy_input = tmp_path / "test.mp4"
    dummy_input.write_bytes(b"dummy media content")
    with pytest.raises(WorkerProtocolError) as exc_fmt:
        service.execute_postprocess(
            job_id="job_bad_fmt",
            input_path=str(dummy_input),
            action="extract_audio",
            target_directory=str(tmp_path),
            audio_format="unsupported_format_xyz",
        )
    assert exc_fmt.value.code == ProtocolErrorCode.VALIDATION_ERROR

    # 3. Unsupported container
    with pytest.raises(WorkerProtocolError) as exc_cont:
        service.execute_postprocess(
            job_id="job_bad_cont",
            input_path=str(dummy_input),
            action="remux",
            target_directory=str(tmp_path),
            remux_container="unsupported_container_xyz",
        )
    assert exc_cont.value.code == ProtocolErrorCode.VALIDATION_ERROR

    # 4. Probing a 0-byte file returns safe error object rather than crashing
    empty_file = tmp_path / "empty.mp4"
    empty_file.write_bytes(b"")
    if service.get_status().get("probeAvailable"):
        probe_res = service.probe_file(str(empty_file))
        assert probe_res.get("valid") is False
        assert "0 bytes" in probe_res.get("error", "")

    # 5. Cancelling an inactive or already completed job returns False safely
    cancel_inactive = service.cancel_postprocess("non_existent_job_123")
    assert cancel_inactive is False
