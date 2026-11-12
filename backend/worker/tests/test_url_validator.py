import pytest
from dropzone_worker.services.url_validator import validate_url
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

def test_valid_http_https_urls():
    assert validate_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert validate_url("http://example.com/video.mp4   ") == "http://example.com/video.mp4"
    assert validate_url("https://vimeo.com/12345678") == "https://vimeo.com/12345678"

def test_reject_empty_or_malformed_url():
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("    ")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("not-a-url")
    assert exc_info.value.code == ProtocolErrorCode.UNSUPPORTED_URL

def test_reject_unsupported_schemes():
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("file:///C:/Users/secret.txt")
    assert exc_info.value.code == ProtocolErrorCode.UNSUPPORTED_URL

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("ftp://example.com/file.zip")
    assert exc_info.value.code == ProtocolErrorCode.UNSUPPORTED_URL

def test_reject_private_and_loopback_destinations():
    # Localhost
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://localhost:3000/api")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # IPv4 Loopback
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://127.0.0.1:8000/video.mp4")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Private Class C
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("https://192.168.1.50/stream")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Cloud Metadata Endpoint (AWS / GCP / Azure)
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL
