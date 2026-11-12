import os
import pytest
from unittest.mock import MagicMock, patch
from dropzone_worker.services.download_service import DownloadService, sanitize_filename, DownloadCancelledException
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode
from dropzone_worker.protocol.models import ProtocolMessage
from dropzone_worker.core.dispatcher import CommandDispatcher
from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle

def test_sanitize_filename():
    assert sanitize_filename("Normal File Name") == "Normal File Name"
    assert sanitize_filename("File: With / Illegal * Chars? <Yes> | OK") == "File_ With _ Illegal _ Chars_ _Yes_ _ OK"
    assert sanitize_filename("Trailing dots and spaces...   ") == "Trailing dots and spaces"
    assert sanitize_filename("") == "download"
    assert sanitize_filename(None) == "download"
    long_name = "a" * 300
    assert len(sanitize_filename(long_name)) == 180

def test_download_service_success(tmp_path):
    events = []
    def record_event(name, payload):
        events.append((name, payload))

    service = DownloadService(write_event_fn=record_event)

    test_file = tmp_path / "video.mp4"
    test_file.write_text("dummy video content")

    mock_ydl = MagicMock()
    mock_ydl.prepare_filename.return_value = str(test_file)
    mock_ydl.extract_info.return_value = {"id": "vid123", "title": "Test Video"}

    with patch("yt_dlp.YoutubeDL") as MockYoutubeDL:
        MockYoutubeDL.return_value.__enter__.return_value = mock_ydl

        res = service.execute_download(
            job_id="job_test_01",
            url="https://example.com/watch?v=123",
            target_directory=str(tmp_path),
            format_id="22",
            custom_filename="custom_title",
        )

        assert res["success"] is True
        assert res["jobId"] == "job_test_01"
        assert res["outputPath"] == str(test_file)
        assert res["totalBytes"] > 0

        # Check emitted events
        event_names = [e[0] for e in events]
        assert "download.started" in event_names
        assert "download.completed" in event_names

def test_download_service_cancellation(tmp_path):
    events = []
    service = DownloadService(write_event_fn=lambda name, payload: events.append((name, payload)))

    mock_ydl = MagicMock()
    def fake_extract_info(url, download=True):
        # Trigger progress hook with cancellation event set
        service.cancel_download("job_cancel_01")
        # Find the registered progress hook
        call_kwargs = MockYoutubeDL.call_args[0][0]
        hook = call_kwargs["progress_hooks"][0]
        hook({"status": "downloading", "downloaded_bytes": 100, "total_bytes": 1000})

    mock_ydl.extract_info.side_effect = fake_extract_info

    with patch("yt_dlp.YoutubeDL") as MockYoutubeDL:
        MockYoutubeDL.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(WorkerProtocolError) as exc_info:
            service.execute_download(
                job_id="job_cancel_01",
                url="https://example.com/watch?v=cancel",
                target_directory=str(tmp_path),
            )

        assert exc_info.value.code == ProtocolErrorCode.DOWNLOAD_CANCELLED
        event_names = [e[0] for e in events]
        assert "download.cancelled" in event_names

def test_dispatcher_download_commands(tmp_path):
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    mock_download_service = MagicMock()
    mock_download_service.execute_download.return_value = {
        "success": True,
        "jobId": "job_sync_1",
        "outputPath": str(tmp_path / "test.mp4"),
        "totalBytes": 1024,
    }
    mock_download_service.cancel_download.return_value = True
    mock_download_service.pause_download.return_value = True

    dispatcher = CommandDispatcher(health, lifecycle, download_service=mock_download_service)

    # 1. start_download
    req_start = ProtocolMessage(
        "request",
        "start_download",
        {"jobId": "job_sync_1", "url": "https://example.com/test", "targetDirectory": str(tmp_path)},
        msg_id="r1"
    )
    res_start = dispatcher.dispatch(req_start)
    assert res_start.type == "response"
    assert res_start.payload["success"] is True

    # 2. cancel_download
    req_cancel = ProtocolMessage("request", "cancel_download", {"jobId": "job_sync_1"}, msg_id="r2")
    res_cancel = dispatcher.dispatch(req_cancel)
    assert res_cancel.payload["cancelled"] is True

    # 3. pause_download
    req_pause = ProtocolMessage("request", "pause_download", {"jobId": "job_sync_1"}, msg_id="r3")
    res_pause = dispatcher.dispatch(req_pause)
    assert res_pause.payload["paused"] is True

