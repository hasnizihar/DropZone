import logging
import sys
from typing import Optional, Dict, Any
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

class YtDlpStderrLogger:
    """Redirects all yt-dlp output to stderr logger so stdout remains clean for JSON Lines."""
    def debug(self, msg: str):
        if not msg.startswith("[debug] "):
            logger.debug(f"[yt-dlp] {msg}")

    def info(self, msg: str):
        logger.info(f"[yt-dlp] {msg}")

    def warning(self, msg: str):
        logger.warning(f"[yt-dlp] {msg}")

    def error(self, msg: str):
        logger.error(f"[yt-dlp] {msg}")

class YtDlpEngine:
    def __init__(self):
        self._version: Optional[str] = None
        self._is_available = False
        self._init_engine()

    def _init_engine(self):
        try:
            import yt_dlp
            import yt_dlp.version
            self._version = getattr(yt_dlp.version, "__version__", "unknown")
            self._is_available = True
            logger.info(f"Initialized yt-dlp engine version: {self._version}")
        except Exception as exc:
            self._is_available = False
            self._version = None
            logger.warning(f"yt-dlp engine unavailable: {exc}")

    @property
    def is_available(self) -> bool:
        return self._is_available

    @property
    def version(self) -> Optional[str]:
        return self._version

    def extract_info(self, url: str) -> Dict[str, Any]:
        if not self._is_available:
            raise WorkerProtocolError(
                ProtocolErrorCode.ENGINE_UNAVAILABLE,
                "yt-dlp library is not installed or available in Python environment."
            )

        import yt_dlp

        ydl_opts = {
            "extract_flat": False,
            "skip_download": True,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "logger": YtDlpStderrLogger(),
            "socket_timeout": 15,
            "retries": 2,
            "no_color": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise WorkerProtocolError(
                        ProtocolErrorCode.EXTRACTION_FAILED,
                        "yt-dlp returned no metadata for URL."
                    )
                return info
        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            lower = msg.lower()
            if "private" in lower:
                code = ProtocolErrorCode.PRIVATE_CONTENT
            elif "sign in" in lower or "members-only" in lower or "login" in lower:
                code = ProtocolErrorCode.AUTH_REQUIRED
            elif "geo" in lower or "not available in your country" in lower:
                code = ProtocolErrorCode.GEO_RESTRICTED
            elif "429" in lower or "too many requests" in lower or "rate limit" in lower:
                code = ProtocolErrorCode.RATE_LIMITED
            elif "timed out" in lower or "timeout" in lower:
                code = ProtocolErrorCode.NETWORK_TIMEOUT
            elif "unsupported url" in lower:
                code = ProtocolErrorCode.UNSUPPORTED_URL
            elif "connection" in lower or "getaddrinfo" in lower:
                code = ProtocolErrorCode.NETWORK_ERROR
            else:
                code = ProtocolErrorCode.EXTRACTION_FAILED

            # Clean error string
            cleaned_msg = re_clean_error(msg)
            raise WorkerProtocolError(code, cleaned_msg)
        except Exception as exc:
            logger.error(f"Unexpected extraction error for {url}: {exc}", exc_info=True)
            raise WorkerProtocolError(ProtocolErrorCode.EXTRACTION_FAILED, f"Failed to extract media: {exc}")

def re_clean_error(raw: str) -> str:
    cleaned = raw.replace("ERROR: ", "").strip()
    # Strip any trailing tracebacks
    if "\n" in cleaned:
        cleaned = cleaned.split("\n")[0].strip()
    return cleaned
