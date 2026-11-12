from typing import Dict, Any, Optional

def format_duration(seconds: Optional[float]) -> Optional[str]:
    if seconds is None or seconds < 0:
        return None
    total_secs = int(seconds)
    hours = total_secs // 3600
    minutes = (total_secs % 3600) // 60
    secs = total_secs % 60

    if hours > 0:
        return f"{hours}h {minutes:02d}m {secs:02d}s"
    return f"{minutes}m {secs:02d}s"

def extract_best_thumbnail(info: Dict[str, Any]) -> Optional[str]:
    # 1. Direct thumbnail field
    thumb = info.get("thumbnail")
    if thumb and isinstance(thumb, str) and thumb.startswith("http"):
        return thumb

    # 2. Thumbnails list
    thumbnails = info.get("thumbnails")
    if isinstance(thumbnails, list) and thumbnails:
        # Find highest resolution or last thumbnail
        sorted_thumbs = sorted(
            [t for t in thumbnails if isinstance(t, dict) and t.get("url")],
            key=lambda t: (t.get("preference", 0) or 0, t.get("width", 0) or 0),
            reverse=True,
        )
        if sorted_thumbs:
            return sorted_thumbs[0].get("url")

    return None

def determine_media_type(info: Dict[str, Any]) -> str:
    # Check yt-dlp _type or formats
    if info.get("_type") == "playlist":
        return "video"

    vcodec = info.get("vcodec")
    acodec = info.get("acodec")
    formats = info.get("formats") or []

    has_video = vcodec and vcodec != "none"
    has_audio = acodec and acodec != "none"

    if has_video:
        return "video"
    if has_audio:
        return "audio"

    # Inspect formats if root doesn't specify
    has_any_video = any(f.get("vcodec") and f.get("vcodec") != "none" for f in formats)
    if has_any_video:
        return "video"

    has_any_audio = any(f.get("acodec") and f.get("acodec") != "none" for f in formats)
    if has_any_audio:
        return "audio"

    return "video"  # Default assumption for video platforms

def normalize_metadata(info: Dict[str, Any], original_url: str) -> Dict[str, Any]:
    """
    Transforms raw yt-dlp metadata dictionary into application-level MediaMetadata.
    Guarantees that missing optional fields default cleanly to None or safe values.
    """
    media_id = str(info.get("id") or "")
    title = str(info.get("title") or "Untitled Media").strip()
    raw_desc = info.get("description")
    description = raw_desc[:500] if raw_desc and isinstance(raw_desc, str) else None

    extractor = str(info.get("extractor_key") or info.get("extractor") or "Generic").strip()
    platform = extractor.capitalize()

    duration = info.get("duration")
    duration_secs = float(duration) if duration is not None else None

    # Format upload date (e.g. '20261112' -> '2026-11-12')
    raw_date = info.get("upload_date")
    upload_date = None
    if raw_date and isinstance(raw_date, str) and len(raw_date) == 8:
        upload_date = f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"

    is_playlist = info.get("_type") == "playlist" or bool(info.get("playlist"))
    playlist_count = info.get("playlist_count") or (len(info.get("entries")) if info.get("entries") else None)

    return {
        "id": media_id,
        "title": title,
        "description": description,
        "uploader": info.get("uploader") or info.get("channel"),
        "uploaderUrl": info.get("uploader_url") or info.get("channel_url"),
        "platform": platform,
        "extractor": extractor,
        "originalUrl": original_url,
        "webpageUrl": info.get("webpage_url") or original_url,
        "thumbnailUrl": extract_best_thumbnail(info),
        "durationSeconds": duration_secs,
        "durationFormatted": format_duration(duration_secs),
        "uploadDate": upload_date,
        "viewCount": info.get("view_count"),
        "likeCount": info.get("like_count"),
        "mediaType": determine_media_type(info),
        "isPlaylist": is_playlist,
        "playlistCount": playlist_count,
    }
