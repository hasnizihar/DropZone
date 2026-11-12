import pytest
from unittest.mock import MagicMock, patch
from dropzone_worker.services.playlist_service import PlaylistService, DEFAULT_MAX_PLAYLIST_ENTRIES
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode
from dropzone_worker.core.dispatcher import CommandDispatcher
from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle
from dropzone_worker.protocol.models import ProtocolMessage

def test_is_playlist_url_detection():
    service = PlaylistService()
    
    # Valid playlist URLs
    assert service.is_playlist_url("https://www.youtube.com/playlist?list=PL12345abcdef") is True
    assert service.is_playlist_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL12345abcdef") is True
    assert service.is_playlist_url("https://soundcloud.com/artist/sets/great-album") is True
    assert service.is_playlist_url("https://bandcamp.com/album/ambient-works") is True
    
    # Non-playlist URLs
    assert service.is_playlist_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") is False
    assert service.is_playlist_url("https://example.com/file.zip") is False
    assert service.is_playlist_url("") is False
    assert service.is_playlist_url(None) is False

def test_normalize_playlist_complete():
    service = PlaylistService(max_entries=10)
    raw_mock_info = {
        "id": "PL_sample_123",
        "title": "Favorite Soundtracks",
        "extractor_key": "YoutubeTab",
        "playlist_count": 3,
        "entries": [
            {
                "id": "vid1",
                "title": "Track 1 - Prologue",
                "url": "https://www.youtube.com/watch?v=vid1",
                "duration": 185,
                "thumbnail": "https://img.youtube.com/vi/vid1/default.jpg",
                "uploader": "Soundtrack Artist",
            },
            {
                "id": "vid2",
                "title": "[Deleted video]",
                "url": "",
                "duration": None,
            },
            {
                "id": "vid3",
                "title": "Track 3 - Finale",
                "url": "https://www.youtube.com/watch?v=vid3",
                "duration": 360,
                "uploader": "Soundtrack Artist",
            },
        ],
    }

    result = service._normalize_playlist(raw_mock_info, "https://youtube.com/playlist?list=PL_sample_123", limit=10)
    
    assert result["success"] is True
    assert result["id"] == "PL_sample_123"
    assert result["title"] == "Favorite Soundtracks"
    assert result["totalCount"] == 3
    assert result["extractedCount"] == 3
    assert result["isTruncated"] is False
    assert len(result["entries"]) == 3

    # Check track 1
    t1 = result["entries"][0]
    assert t1["id"] == "vid1"
    assert t1["index"] == 1
    assert t1["title"] == "Track 1 - Prologue"
    assert t1["duration"] == 185.0
    assert t1["durationFormatted"] == "3m 05s"
    assert t1["isAvailable"] is True
    assert t1["selected"] is True

    # Check track 2 (deleted/unavailable)
    t2 = result["entries"][1]
    assert t2["index"] == 2
    assert t2["isAvailable"] is False
    assert t2["selected"] is False
    assert "[Unavailable" in t2["title"]

    # Check track 3
    t3 = result["entries"][2]
    assert t3["index"] == 3
    assert t3["isAvailable"] is True
    assert t3["selected"] is True

def test_normalize_playlist_bounded_truncation():
    service = PlaylistService(max_entries=2)
    raw_mock_info = {
        "id": "PL_large_500",
        "title": "Huge Playlist (500 videos)",
        "extractor_key": "YoutubeTab",
        "playlist_count": 500,
        "entries": [
            {"id": "v1", "title": "Video 1", "url": "https://youtube.com/watch?v=v1", "duration": 60},
            {"id": "v2", "title": "Video 2", "url": "https://youtube.com/watch?v=v2", "duration": 120},
            {"id": "v3", "title": "Video 3", "url": "https://youtube.com/watch?v=v3", "duration": 180},
        ],
    }

    result = service._normalize_playlist(raw_mock_info, "https://youtube.com/playlist?list=PL_large_500", limit=2)
    assert result["totalCount"] == 500
    assert result["extractedCount"] == 2
    assert result["isTruncated"] is True
    assert len(result["warnings"]) == 1
    assert "exceeds inspection limit" in result["warnings"][0]
    assert len(result["entries"]) == 2

def test_dispatcher_inspect_playlist_and_batch():
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    playlist_mock = MagicMock()
    playlist_mock.extract_playlist.return_value = {
        "success": True,
        "id": "PL_test",
        "title": "Mock Playlist",
        "url": "https://example.com/playlist",
        "entries": [],
        "totalCount": 0,
        "extractedCount": 0,
        "isTruncated": False,
        "downloadType": "playlist",
    }
    
    dispatcher = CommandDispatcher(
        health=health,
        lifecycle=lifecycle,
        playlist_service=playlist_mock,
    )

    # 1. Test inspect_playlist
    req = ProtocolMessage(
        msg_type="request",
        command="inspect_playlist",
        payload={"url": "https://example.com/playlist", "maxEntries": 50},
        msg_id="req_pl",
    )
    resp = dispatcher.dispatch(req)
    assert resp is not None
    assert resp.type == "response"
    assert resp.payload["id"] == "PL_test"
    assert resp.payload["downloadType"] == "playlist"
    playlist_mock.extract_playlist.assert_called_once_with("https://example.com/playlist", max_entries=50)

    # 2. Test inspect_batch
    batch_req = ProtocolMessage(
        msg_type="request",
        command="inspect_batch",
        payload={"urls": ["https://example.com/file1.zip", "https://example.com/file2.zip"]},
        msg_id="req_batch",
    )
    with patch.object(dispatcher, "_analyze_unified") as mock_unified:
        mock_unified.side_effect = [
            {"downloadType": "file", "title": "file1.zip", "source": "example.com"},
            Exception("Simulated network timeout"),
        ]
        batch_resp = dispatcher.dispatch(batch_req)
        assert batch_resp is not None
        assert batch_resp.payload["success"] is True
        results = batch_resp.payload["results"]
        assert len(results) == 2
        assert results[0]["status"] == "ready"
        assert results[0]["title"] == "file1.zip"
        assert results[1]["status"] == "failed"
        assert "Simulated network timeout" in results[1]["error"]
        assert batch_resp.payload["errorsCount"] == 1
