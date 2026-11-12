import pytest
from unittest.mock import MagicMock
from dropzone_worker.services.media_analyzer import MediaAnalyzerService
from dropzone_worker.protocol.models import ProtocolMessage
from dropzone_worker.core.dispatcher import CommandDispatcher
from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle

MOCK_INFO = {
    "id": "dQw4w9WgXcQ",
    "title": "Sample Rick Astley Video",
    "description": "The official sample music video",
    "uploader": "RickAstleyVEVO",
    "extractor": "youtube",
    "extractor_key": "Youtube",
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "duration": 213,
    "upload_date": "20091025",
    "formats": [
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

def test_media_analyzer_service():
    mock_engine = MagicMock()
    mock_engine.extract_info.return_value = MOCK_INFO
    mock_engine.version = "2026.10.26"

    service = MediaAnalyzerService(mock_engine)
    result = service.analyze("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert result["success"] is True
    assert result["metadata"]["title"] == "Sample Rick Astley Video"
    assert len(result["formats"]) == 1
    assert result["extractor"]["name"] == "Youtube"
    assert isinstance(result["analysisDurationMs"], int)

def test_dispatcher_synchronous_analyze_url():
    mock_engine = MagicMock()
    mock_engine.extract_info.return_value = MOCK_INFO
    mock_engine.version = "2026.10.26"

    service = MediaAnalyzerService(mock_engine)
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()

    # Synchronous dispatcher (no write_message_fn)
    dispatcher = CommandDispatcher(health, lifecycle, analyzer=service)

    req = ProtocolMessage(
        "request",
        "analyze_url",
        {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        msg_id="req-sync-analyze",
    )
    res = dispatcher.dispatch(req)

    assert res is not None
    assert res.type == "response"
    assert res.id == "req-sync-analyze"
    assert res.payload["success"] is True
    assert res.payload["metadata"]["title"] == "Sample Rick Astley Video"
