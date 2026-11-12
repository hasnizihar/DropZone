import pytest
from unittest.mock import patch
from dropzone_worker.services.url_validator import (
    validate_url,
    validate_redirect,
    resolve_and_validate_host,
    is_ip_disallowed,
)
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

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("gopher://example.com/resource")
    assert exc_info.value.code == ProtocolErrorCode.UNSUPPORTED_URL

def test_reject_embedded_credentials():
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("https://user:password@example.com/file.zip")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

def test_reject_private_and_loopback_destinations():
    # Localhost
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://localhost:3000/api")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # IPv4 Loopback
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://127.0.0.1:8000/video.mp4")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # IPv6 Loopback
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://[::1]:8080/data")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Private Class C
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("https://192.168.1.50/stream")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Private Class A & B
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("https://10.0.0.1/file")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("https://172.16.0.1/file")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Cloud Metadata Endpoint (AWS / GCP / Azure)
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    # Disallowed suffix (.local / .internal / .localhost)
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://server.local/asset.png")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_url("http://app.internal/asset.png")
    assert exc_info.value.code == ProtocolErrorCode.INVALID_URL

def test_resolve_and_validate_host_rebinding_protection():
    # Mock socket.getaddrinfo to simulate domain resolving to a private IP
    with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("127.0.0.1", 80))]):
        with pytest.raises(WorkerProtocolError) as exc_info:
            resolve_and_validate_host("evil-rebind.com")
        assert exc_info.value.code == ProtocolErrorCode.INVALID_URL
        assert "disallowed private/local IP" in str(exc_info.value.message)

    # Mock public IP resolution
    with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        # Should not raise
        resolve_and_validate_host("example.com")

def test_validate_redirect_safety():
    # Valid redirect
    orig = "https://example.com/start"
    res = validate_redirect(orig, "/next/file.zip", redirect_count=0)
    assert res == "https://example.com/next/file.zip"

    # Absolute valid redirect
    res2 = validate_redirect(orig, "https://cdn.example.com/file.zip", redirect_count=1)
    assert res2 == "https://cdn.example.com/file.zip"

    # Downgrade rejection (HTTPS -> HTTP)
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_redirect("https://example.com/secure", "http://example.com/insecure", redirect_count=0)
    assert exc_info.value.code == ProtocolErrorCode.NETWORK_ERROR

    # Exceeded max redirects
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_redirect(orig, "/loop", redirect_count=5, max_redirects=5)
    assert exc_info.value.code == ProtocolErrorCode.NETWORK_ERROR

    # Redirect to internal IP
    with pytest.raises(WorkerProtocolError) as exc_info:
        validate_redirect(orig, "http://127.0.0.1/admin", redirect_count=1)
    assert exc_info.value.code in (ProtocolErrorCode.INVALID_URL, ProtocolErrorCode.NETWORK_ERROR)
