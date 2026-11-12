import logging
import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, parse_qs

from .url_validator import validate_url
from .metadata_normalizer import format_duration, extract_best_thumbnail
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode
from ..engines.ytdlp_engine import YtDlpStderrLogger

logger = logging.getLogger("dropzone_worker")

DEFAULT_MAX_PLAYLIST_ENTRIES = 200

# Patterns indicating a playlist or multi-item collection
PLAYLIST_PATTERNS = [
    re.compile(r"[?&]list=([a-zA-Z0-9_-]+)"),       # YouTube list parameter
    re.compile(r"/playlist\b", re.IGNORECASE),      # General playlist path
    re.compile(r"/sets/[^/?#]+", re.IGNORECASE),   # SoundCloud sets/albums
    re.compile(r"/album/[^/?#]+", re.IGNORECASE),   # Bandcamp / other albums
    re.compile(r"/series/\b", re.IGNORECASE),       # Series
]

class PlaylistService:
    def __init__(self, max_entries: int = DEFAULT_MAX_PLAYLIST_ENTRIES):
        self.max_entries = max_entries

    def is_playlist_url(self, url: str) -> bool:
        """
        Determines whether a URL indicates a playlist or multi-item collection.
        Distinguishes pure playlist URLs or URLs with playlist parameters.
        """
        if not url or not isinstance(url, str):
            return False

        parsed = urlparse(url)
        # Check query parameters (e.g., list=PLxxx)
        qs = parse_qs(parsed.query)
        if "list" in qs:
            return True

        # Check path patterns
        for pattern in PLAYLIST_PATTERNS:
            if pattern.search(url):
                return True

        return False

    def extract_playlist(
        self,
        raw_url: str,
        max_entries: Optional[int] = None,
        allow_loopback: bool = False,
    ) -> Dict[str, Any]:
        """
        Extracts playlist metadata in bounded, non-downloading flat mode.
        Returns normalized playlist information and individual entry summaries.
        """
        valid_url = validate_url(raw_url, allow_loopback=allow_loopback)
        limit = max_entries if (max_entries and max_entries > 0) else self.max_entries

        logger.info(f"Extracting playlist (limit: {limit}) for URL: {valid_url}")

        try:
            import yt_dlp
        except ImportError:
            raise WorkerProtocolError(
                ProtocolErrorCode.ENGINE_UNAVAILABLE,
                "yt-dlp is not available for playlist extraction."
            )

        ydl_opts = {
            "extract_flat": True,          # Fast metadata extraction without deep per-video formats
            "skip_download": True,
            "noplaylist": False,
            "playlistend": limit,
            "quiet": True,
            "no_warnings": True,
            "logger": YtDlpStderrLogger(),
            "socket_timeout": 15,
            "retries": 2,
            "no_color": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                raw_info = ydl.extract_info(valid_url, download=False)
        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            lower = msg.lower()
            if "private" in lower:
                code = ProtocolErrorCode.PRIVATE_CONTENT
            elif "sign in" in lower or "login" in lower or "members-only" in lower:
                code = ProtocolErrorCode.AUTH_REQUIRED
            elif "geo" in lower or "not available in your country" in lower:
                code = ProtocolErrorCode.GEO_RESTRICTED
            elif "429" in lower or "rate limit" in lower:
                code = ProtocolErrorCode.RATE_LIMITED
            elif "timed out" in lower or "timeout" in lower:
                code = ProtocolErrorCode.NETWORK_TIMEOUT
            elif "unsupported url" in lower:
                code = ProtocolErrorCode.UNSUPPORTED_URL
            else:
                code = ProtocolErrorCode.EXTRACTION_FAILED

            raise WorkerProtocolError(code, f"Playlist extraction failed: {msg}")
        except Exception as exc:
            raise WorkerProtocolError(
                ProtocolErrorCode.EXTRACTION_FAILED,
                f"Unexpected error during playlist extraction: {exc}"
            )

        if not raw_info:
            raise WorkerProtocolError(
                ProtocolErrorCode.EXTRACTION_FAILED,
                "yt-dlp returned empty metadata for playlist."
            )

        return self._normalize_playlist(raw_info, valid_url, limit)

    def _normalize_playlist(
        self,
        info: Dict[str, Any],
        source_url: str,
        limit: int
    ) -> Dict[str, Any]:
        """
        Normalizes raw yt-dlp playlist dict into structured PlaylistInfo.
        """
        playlist_id = str(info.get("id") or "playlist")
        title = str(info.get("title") or "Playlist").strip()
        extractor = str(info.get("extractor_key") or info.get("extractor") or "Playlist").strip()

        raw_entries = info.get("entries")
        entries_list: List[Dict[str, Any]] = []

        if raw_entries is not None:
            if isinstance(raw_entries, list):
                entries_list = raw_entries[:limit]
            else:
                # Iterator / generator from yt-dlp flat extraction
                try:
                    for item in raw_entries:
                        entries_list.append(item)
                        if len(entries_list) >= limit:
                            break
                except Exception as e:
                    logger.warning(f"Error consuming playlist entries generator: {e}")

        # Total count determination
        reported_total = info.get("playlist_count")
        if reported_total is None and "n_entries" in info:
            reported_total = info.get("n_entries")

        extracted_count = len(entries_list)
        total_count = reported_total if (reported_total and reported_total > extracted_count) else extracted_count
        is_truncated = bool(total_count > extracted_count or (reported_total and reported_total > limit))

        warnings: List[str] = []
        if is_truncated:
            warnings.append(
                f"Playlist exceeds inspection limit of {limit} entries. Showing first {extracted_count} items."
            )

        normalized_entries: List[Dict[str, Any]] = []

        for idx, entry in enumerate(entries_list, start=1):
            if not entry or not isinstance(entry, dict):
                normalized_entries.append({
                    "id": f"unavailable_{idx}",
                    "index": idx,
                    "url": "",
                    "title": f"[Unavailable Item #{idx}]",
                    "duration": None,
                    "durationFormatted": None,
                    "thumbnail": None,
                    "uploader": None,
                    "isAvailable": False,
                    "selected": False,
                })
                continue

            entry_id = str(entry.get("id") or f"item_{idx}")
            entry_title = str(entry.get("title") or "").strip()

            is_unavailable = (
                not entry_title or
                entry_title in ("[Private video]", "[Deleted video]", "[Unavailable video]", "[Unavailable]") or
                entry.get("availability") in ("needs_auth", "subscriber_only", "unlisted_or_private")
            )

            # Determine canonical URL
            entry_url = entry.get("url") or entry.get("webpage_url") or ""
            if entry_url and not entry_url.startswith("http"):
                # If flat extraction gives just a video ID for YouTube
                if "youtube" in extractor.lower() or entry.get("ie_key") == "Youtube":
                    entry_url = f"https://www.youtube.com/watch?v={entry_id}"

            duration = entry.get("duration")
            duration_secs = float(duration) if duration is not None else None
            thumbnail = extract_best_thumbnail(entry)

            normalized_entries.append({
                "id": entry_id,
                "index": idx,
                "url": entry_url,
                "title": entry_title if not is_unavailable else f"[Unavailable - {entry_title or 'Private'}]",
                "duration": duration_secs,
                "durationFormatted": format_duration(duration_secs),
                "thumbnail": thumbnail,
                "uploader": entry.get("uploader") or entry.get("channel"),
                "isAvailable": not is_unavailable and bool(entry_url),
                "selected": not is_unavailable and bool(entry_url),
            })

        return {
            "success": True,
            "id": playlist_id,
            "title": title,
            "url": source_url,
            "source": extractor,
            "extractor": extractor,
            "totalCount": total_count,
            "extractedCount": extracted_count,
            "isTruncated": is_truncated,
            "warnings": warnings,
            "entries": normalized_entries,
            "downloadType": "playlist",
        }
