from typing import List, Dict, Any, Optional

def clean_codec(codec: Optional[str]) -> Optional[str]:
    if not codec or codec.lower() in ("none", "null"):
        return None
    return str(codec)

def build_quality_label(height: Optional[int], fps: Optional[float], is_audio: bool, abr: Optional[float]) -> str:
    if is_audio:
        if abr:
            return f"{int(abr)} kbps Audio"
        return "Audio Stream"
    if height:
        label = f"{height}p"
        if fps and fps > 30:
            label += f" {int(fps)}fps"
        return label
    return "Standard Quality"

def normalize_single_format(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    format_id = str(raw.get("format_id") or "").strip()
    if not format_id:
        return None

    ext = str(raw.get("ext") or "mp4").lower().strip()
    vcodec = clean_codec(raw.get("vcodec"))
    acodec = clean_codec(raw.get("acodec"))

    has_video = vcodec is not None
    has_audio = acodec is not None

    if not has_video and not has_audio:
        # Format has neither video nor audio (e.g. storyboard/mhtml)
        return None

    is_combined = has_video and has_audio
    is_video = has_video and not has_audio
    is_audio = has_audio and not has_video

    height = raw.get("height")
    width = raw.get("width")
    fps = raw.get("fps")

    resolution = None
    if width and height:
        resolution = f"{width}x{height}"
    elif height:
        resolution = f"{height}p"
    elif is_audio:
        resolution = "Audio Only"

    exact_size = raw.get("filesize")
    approx_size = raw.get("filesize_approx")

    quality_label = build_quality_label(height, fps, is_audio, raw.get("abr") or raw.get("tbr"))

    return {
        "formatId": format_id,
        "formatNote": raw.get("format_note"),
        "extension": ext,
        "container": raw.get("container") or ext,
        "resolution": resolution,
        "width": width,
        "height": height,
        "fps": fps,
        "videoCodec": vcodec,
        "audioCodec": acodec,
        "audioBitrate": raw.get("abr"),
        "videoBitrate": raw.get("vbr"),
        "totalBitrate": raw.get("tbr"),
        "fileSizeBytes": int(exact_size) if exact_size and exact_size > 0 else None,
        "estimatedFileSizeBytes": int(approx_size) if approx_size and approx_size > 0 else None,
        "isVideo": is_video,
        "isAudio": is_audio,
        "isCombined": is_combined,
        "hasVideo": has_video,
        "hasAudio": has_audio,
        "qualityLabel": quality_label,
    }

def normalize_formats(info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extracts, normalizes, and deterministically sorts all media formats available for the content.
    Sorts video streams highest resolution first; sorts audio streams highest bitrate first.
    """
    raw_formats = info.get("formats")
    if not isinstance(raw_formats, list) or not raw_formats:
        # Sometimes direct video info has properties at root
        single = normalize_single_format(info)
        return [single] if single else []

    normalized_list = []
    seen_ids = set()

    for raw in raw_formats:
        if not isinstance(raw, dict):
            continue
        item = normalize_single_format(raw)
        if item and item["formatId"] not in seen_ids:
            seen_ids.add(item["formatId"])
            normalized_list.append(item)

    # Sort deterministically
    def sort_key(fmt: Dict[str, Any]):
        # Category order: Combined (3) -> Video (2) -> Audio (1)
        type_rank = 3 if fmt["isCombined"] else (2 if fmt["isVideo"] else 1)
        res_rank = fmt.get("height") or 0
        bitrate_rank = fmt.get("totalBitrate") or fmt.get("audioBitrate") or 0
        return (type_rank, res_rank, bitrate_rank)

    normalized_list.sort(key=sort_key, reverse=True)
    return normalized_list
