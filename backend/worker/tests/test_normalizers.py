import pytest
from dropzone_worker.services.metadata_normalizer import normalize_metadata, format_duration
from dropzone_worker.services.format_normalizer import normalize_formats

MOCK_YTDLP_INFO = {
    "id": "dQw4w9WgXcQ",
    "title": "Sample Rick Astley Video",
    "description": "The official sample music video for Rick Astley",
    "uploader": "RickAstleyVEVO",
    "uploader_url": "https://www.youtube.com/@RickAstleyVEVO",
    "extractor": "youtube",
    "extractor_key": "Youtube",
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "duration": 213,
    "upload_date": "20091025",
    "view_count": 1400000000,
    "like_count": 15000000,
    "formats": [
        {
            "format_id": "140",
            "ext": "m4a",
            "vcodec": "none",
            "acodec": "mp4a.40.2",
            "abr": 128,
            "tbr": 128,
            "filesize": 3450000,
        },
        {
            "format_id": "136",
            "ext": "mp4",
            "height": 720,
            "width": 1280,
            "fps": 30,
            "vcodec": "avc1.4d401f",
            "acodec": "none",
            "vbr": 1200,
            "tbr": 1200,
            "filesize_approx": 35000000,
        },
        {
            "format_id": "137",
            "ext": "mp4",
            "height": 1080,
            "width": 1920,
            "fps": 60,
            "vcodec": "avc1.640028",
            "acodec": "none",
            "vbr": 2500,
            "tbr": 2500,
            "filesize": 75000000,
        },
        {
            "format_id": "18",
            "ext": "mp4",
            "height": 360,
            "width": 640,
            "fps": 30,
            "vcodec": "avc1.42001E",
            "acodec": "mp4a.40.2",
            "tbr": 500,
            "filesize": 15000000,
        },
    ],
}

def test_duration_formatter():
    assert format_duration(45) == "0m 45s"
    assert format_duration(213) == "3m 33s"
    assert format_duration(3665) == "1h 01m 05s"
    assert format_duration(None) is None

def test_metadata_normalization():
    norm = normalize_metadata(MOCK_YTDLP_INFO, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert norm["id"] == "dQw4w9WgXcQ"
    assert norm["title"] == "Sample Rick Astley Video"
    assert norm["platform"] == "Youtube"
    assert norm["extractor"] == "Youtube"
    assert norm["uploader"] == "RickAstleyVEVO"
    assert norm["durationSeconds"] == 213.0
    assert norm["durationFormatted"] == "3m 33s"
    assert norm["uploadDate"] == "2009-10-25"
    assert norm["thumbnailUrl"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
    assert norm["mediaType"] == "video"
    assert norm["isPlaylist"] is False

def test_format_normalization_and_sorting():
    formats = normalize_formats(MOCK_YTDLP_INFO)
    assert len(formats) == 4

    # Combined format (format 18) or highest resolution should be at the top
    combined = [f for f in formats if f["isCombined"]]
    assert len(combined) == 1
    assert combined[0]["formatId"] == "18"
    assert combined[0]["resolution"] == "640x360"

    video_only = [f for f in formats if f["isVideo"]]
    assert len(video_only) == 2
    # 1080p should precede 720p
    assert video_only[0]["formatId"] == "137"
    assert video_only[0]["height"] == 1080
    assert video_only[0]["fps"] == 60
    assert video_only[0]["fileSizeBytes"] == 75000000
    assert video_only[0]["estimatedFileSizeBytes"] is None

    assert video_only[1]["formatId"] == "136"
    assert video_only[1]["height"] == 720
    assert video_only[1]["fileSizeBytes"] is None
    assert video_only[1]["estimatedFileSizeBytes"] == 35000000

    audio_only = [f for f in formats if f["isAudio"]]
    assert len(audio_only) == 1
    assert audio_only[0]["formatId"] == "140"
    assert audio_only[0]["audioBitrate"] == 128
