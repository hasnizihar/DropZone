import ipaddress
import re
import socket
from urllib.parse import urlparse, urljoin
from typing import Optional, List
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

DISALLOWED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "broadcasthost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "metadata.aws",
}

DISALLOWED_DOMAINS = (
    ".local",
    ".internal",
    ".localhost",
    ".onion",
    ".invalid",
    ".test",
)

METADATA_IPS = {
    "169.254.169.254",  # AWS / GCP / Azure metadata
    "fd00:ec2::254",     # AWS IPv6 metadata
}

def is_ip_disallowed(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip_str in METADATA_IPS:
            return True
        if ip.version == 6 and ip.ipv4_mapped:
            return is_ip_disallowed(str(ip.ipv4_mapped))
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        )
    except ValueError:
        return False

def _clean_hostname(hostname: str) -> str:
    h = hostname.lower().strip()
    if h.startswith("[") and h.endswith("]"):
        h = h[1:-1]
    # Only strip port if it's not a multi-colon IPv6 address
    if h.count(":") == 1:
        h = h.split(":")[0]
    return h

def is_private_or_local_host(hostname: str) -> bool:
    if not hostname:
        return True
    lower = _clean_hostname(hostname)
    if lower in DISALLOWED_HOSTNAMES:
        return True
    if any(lower.endswith(suffix) for suffix in DISALLOWED_DOMAINS):
        return True
    if is_ip_disallowed(lower):
        return True
    return False

def resolve_and_validate_host(hostname: str) -> None:
    """
    Resolves hostname via DNS and verifies that all returned IP addresses are public.
    Protects against DNS rebinding and internal network probing.
    """
    clean_host = _clean_hostname(hostname)
    if is_private_or_local_host(clean_host):
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            f"Access to private, loopback, or local host '{hostname}' is not permitted."
        )

    try:
        ipaddress.ip_address(clean_host)
        return
    except ValueError:
        pass

    try:
        addrinfo = socket.getaddrinfo(clean_host, None)
    except Exception as exc:
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            f"Failed to resolve hostname '{hostname}': {exc}"
        )

    for entry in addrinfo:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        if is_ip_disallowed(ip_str):
            raise WorkerProtocolError(
                ProtocolErrorCode.INVALID_URL,
                f"Hostname '{hostname}' resolved to disallowed private/local IP '{ip_str}'."
            )

def validate_url(url: str, check_dns: bool = False, allow_loopback: bool = False) -> str:
    """
    Validates and normalizes user-submitted URLs.
    Enforces HTTP/HTTPS scheme, blocks userinfo credentials, and blocks local/private network resources.
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

    if parsed.username or parsed.password:
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            "URLs containing embedded credentials (user:password) are not permitted."
        )

    hostname = parsed.hostname
    if not hostname:
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            "URL is missing a valid hostname."
        )

    if not allow_loopback and is_private_or_local_host(hostname):
        raise WorkerProtocolError(
            ProtocolErrorCode.INVALID_URL,
            f"Access to private, loopback, or local host '{hostname}' is not permitted."
        )

    if check_dns and not allow_loopback:
        resolve_and_validate_host(hostname)

    return cleaned

def validate_redirect(
    original_url: str,
    location_header: str,
    redirect_count: int,
    max_redirects: int = 5,
    allow_downgrade: bool = False,
    check_dns: bool = False,
    allow_loopback: bool = False,
) -> str:
    """
    Validates an HTTP redirect target URL, preventing redirect loops, scheme downgrades,
    and redirection to private/internal networks.
    """
    if redirect_count >= max_redirects:
        raise WorkerProtocolError(
            ProtocolErrorCode.NETWORK_ERROR,
            f"Exceeded maximum redirect limit of {max_redirects} hops."
        )

    target_url = urljoin(original_url, location_header.strip())

    orig_parsed = urlparse(original_url)
    target_parsed = urlparse(target_url)

    if not allow_downgrade and orig_parsed.scheme.lower() == "https" and target_parsed.scheme.lower() == "http":
        raise WorkerProtocolError(
            ProtocolErrorCode.NETWORK_ERROR,
            f"Insecure protocol downgrade from HTTPS to HTTP during redirect to '{target_url}' is not permitted."
        )

    return validate_url(target_url, check_dns=check_dns, allow_loopback=allow_loopback)
