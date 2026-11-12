import os
import re
import logging
import mimetypes
import email.message
from urllib.parse import urlparse, unquote
from typing import Dict, Any, Optional, Tuple
import requests

from .url_validator import validate_url, validate_redirect, resolve_and_validate_host
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".tiff", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv", ".wmv"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".flac", ".wav", ".aac", ".ogg", ".opus"}
ARCHIVE_EXTENSIONS = {".zip", ".tar", ".gz", ".7z", ".rar", ".bz2", ".xz"}
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"}

def sanitize_filename(name: Optional[str]) -> str:
    """Sanitizes filename for Windows filesystem, stripping illegal characters and reserved names."""
    if not name or not isinstance(name, str):
        return "download"
    # Strip directory path separators and path traversal
    base_name = os.path.basename(name.replace("\\", "/"))
    clean = re.sub(r'[\\/*?:"<>|\x00-\x1f]', "_", base_name).strip()
    clean = clean.rstrip(". ")
    if not clean:
        clean = "download"

    # Protect against Windows device names (e.g. CON, NUL.txt, PRN)
    stem = clean.split(".")[0].upper()
    if stem in WINDOWS_RESERVED_NAMES:
        clean = f"_{clean}"

    return clean[:180]

def parse_content_disposition_filename(cd_header: Optional[str]) -> Optional[str]:
    """Extracts filename from Content-Disposition header, honoring RFC 6266 and RFC 5987."""
    if not cd_header:
        return None
    try:
        msg = email.message.Message()
        msg["content-disposition"] = cd_header
        fname = msg.get_filename()
        if fname:
            return sanitize_filename(fname)
    except Exception as exc:
        logger.debug(f"Failed to parse Content-Disposition header '{cd_header}': {exc}")
    return None

def classify_content_type(mime_type: str, filename: str) -> str:
    """Classifies content into DROPZONE categories: image, video, audio, archive, document, file."""
    lower_mime = (mime_type or "").lower().split(";")[0].strip()
    ext = os.path.splitext(filename.lower())[1]

    if lower_mime.startswith("image/") or ext in IMAGE_EXTENSIONS:
        return "image"
    if lower_mime.startswith("video/") or ext in VIDEO_EXTENSIONS:
        return "video"
    if lower_mime.startswith("audio/") or ext in AUDIO_EXTENSIONS:
        return "audio"
    if "zip" in lower_mime or "tar" in lower_mime or "compressed" in lower_mime or ext in ARCHIVE_EXTENSIONS:
        return "archive"
    if "pdf" in lower_mime or "word" in lower_mime or "sheet" in lower_mime or ext in DOCUMENT_EXTENSIONS:
        return "document"
    return "file"

class DirectHttpService:
    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DROPZONE/1.0"
        ),
        "Accept": "*/*",
    }

    def __init__(self, timeout: float = 12.0, max_redirects: int = 5):
        self.timeout = timeout
        self.max_redirects = max_redirects

    def inspect_url(self, url: str, check_dns: bool = True, allow_loopback: bool = False) -> Dict[str, Any]:
        """
        Inspects remote HTTP/HTTPS resource headers without downloading the full body.
        Protects against SSRF, redirects, and loops.
        """
        current_url = validate_url(url, check_dns=check_dns, allow_loopback=allow_loopback)
        redirect_count = 0
        session = requests.Session()
        session.headers.update(self.DEFAULT_HEADERS)

        last_response = None
        while redirect_count <= self.max_redirects:
            resp = None
            try:
                # 1. Try HEAD request first
                head_resp = session.head(
                    current_url,
                    timeout=self.timeout,
                    allow_redirects=False,
                )
                if head_resp.status_code not in (405, 501):
                    resp = head_resp
            except requests.RequestException:
                resp = None

            # 2. Fallback to GET with stream=True if HEAD fails or is rejected
            if resp is None:
                try:
                    resp = session.get(
                        current_url,
                        timeout=self.timeout,
                        allow_redirects=False,
                        stream=True,
                    )
                except Exception as exc:
                    raise WorkerProtocolError(
                        ProtocolErrorCode.NETWORK_ERROR,
                        f"Failed to connect to '{current_url}': {exc}"
                    )

            # Check for redirect status
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location")
                if not location:
                    break
                current_url = validate_redirect(
                    current_url,
                    location,
                    redirect_count=redirect_count,
                    max_redirects=self.max_redirects,
                    check_dns=check_dns,
                    allow_loopback=allow_loopback,
                )
                redirect_count += 1
                resp.close()
                continue

            last_response = resp
            break

        if last_response is None:
            raise WorkerProtocolError(
                ProtocolErrorCode.NETWORK_ERROR,
                f"Failed to inspect URL '{url}': No response obtained."
            )

        headers = last_response.headers
        status_code = last_response.status_code
        last_response.close()

        if status_code >= 400:
            if status_code == 429:
                raise WorkerProtocolError(
                    ProtocolErrorCode.RATE_LIMITED,
                    f"Rate limited by server (HTTP 429) at '{current_url}'."
                )
            elif status_code in (401, 403):
                raise WorkerProtocolError(
                    ProtocolErrorCode.AUTH_REQUIRED,
                    f"Access forbidden or authentication required (HTTP {status_code}) at '{current_url}'."
                )
            elif status_code in (500, 502, 503, 504):
                raise WorkerProtocolError(
                    ProtocolErrorCode.NETWORK_ERROR,
                    f"Remote server error (HTTP {status_code}) at '{current_url}'."
                )
            else:
                raise WorkerProtocolError(
                    ProtocolErrorCode.DOWNLOAD_FAILED,
                    f"HTTP {status_code} error from server at '{current_url}'."
                )

        # Parse Content-Type and MIME
        content_type_raw = headers.get("Content-Type", "application/octet-stream")
        mime_type = content_type_raw.split(";")[0].strip().lower()

        # Parse Content-Length
        content_length_header = headers.get("Content-Length")
        file_size_bytes: Optional[int] = None
        if content_length_header and content_length_header.isdigit():
            file_size_bytes = int(content_length_header)

        # Parse Accept-Ranges
        accept_ranges_header = headers.get("Accept-Ranges", "")
        supports_resume = "bytes" in accept_ranges_header.lower()

        etag = headers.get("ETag")
        last_modified = headers.get("Last-Modified")
        content_disposition = headers.get("Content-Disposition")

        # Determine safe filename
        cd_filename = parse_content_disposition_filename(content_disposition)
        if cd_filename:
            filename = cd_filename
        else:
            parsed = urlparse(current_url)
            path_base = unquote(parsed.path).split("/")[-1].split("?")[0].strip()
            if path_base and "." in path_base:
                filename = sanitize_filename(path_base)
            else:
                stem = path_base or "download"
                guessed_ext = mimetypes.guess_extension(mime_type) or ""
                filename = sanitize_filename(f"{stem}{guessed_ext}")

        category = classify_content_type(mime_type, filename)
        is_webpage = mime_type in ("text/html", "application/xhtml+xml")

        return {
            "url": url,
            "finalUrl": current_url,
            "filename": filename,
            "mimeType": mime_type,
            "fileSizeBytes": file_size_bytes,
            "estimatedFileSizeBytes": file_size_bytes,
            "supportsResume": supports_resume and (file_size_bytes is not None),
            "etag": etag,
            "lastModified": last_modified,
            "contentDisposition": content_disposition,
            "category": category,
            "isWebpage": is_webpage,
            "downloadType": "image" if category == "image" else ("file" if not is_webpage else "webpage"),
        }
