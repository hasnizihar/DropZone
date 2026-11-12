import ipaddress
import re
from urllib.parse import urlparse
from typing import Tuple
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

DISALLOWED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "broadcasthost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
}

def is_private_or_local_host(hostname: str) -> bool:
    if not hostname:
        return True
    lower = hostname.lower().strip().split(":")[0]  # Remove port if present
    if lower in DISALLOWED_HOSTS:
        return True
    if lower.endswith(".local") or lower.endswith(".internal") or lower.endswith(".localhost"):
        return True

    # Check IP addresses
    try:
        ip = ipaddress.ip_address(lower)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return True
    except ValueError:
        pass

    return False

def validate_url(url: str) -> str:
    """
    Validates and normalizes user-submitted URLs.
    Enforces HTTP/HTTPS scheme and blocks access to local/private network resources.
    """
    if not url or not isinstance(url, str):
        raise WorkerProtocolError(ProtocolErrorCode.INVALID_URL, "URL cannot be empty")

    cleaned = url.strip()
    if not cleaned:
        raise WorkerProtocolError(ProtocolErrorCode.INVALID_URL, "URL cannot be empty")

    try:
        parsed = urlparse(cleaned)
    except Exception as exc:
        raise WorkerProtocolError(ProtocolErrorCode.INVALID_URL, f"Malformed URL: {exc}")

    if parsed.scheme.lower() not in ("http", "https"):
        raise WorkerProtocolError(
            ProtocolErrorCode.UNSUPPORTED_URL,
            f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted."
        )

    if not parsed.netloc:
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            "URL is missing a valid hostname or network location."
        )

    hostname = parsed.hostname
    if not hostname or is_private_or_local_host(hostname):
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            f"Access to private, loopback, or local host '{hostname}' is not permitted."
        )

    return cleaned
