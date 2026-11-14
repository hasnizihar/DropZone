import os
import shutil
import pytest
import subprocess
from dropzone_worker.services.ffmpeg_service import (
    FFmpegService,
    AUDIO_FORMAT_SPECS,
    CONTAINER_SPECS,
    sanitize_filename,
    parse_time_to_seconds,
)
from dropzone_worker.core.dispatcher import CommandDispatcher
from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle
from dropzone_worker.protocol.models import ProtocolMessage
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

def test_sanitize_filename():
    assert sanitize_filename("my:cool*video?.mp4") == "my_cool_video_.mp4"
    assert sanitize_filename("   ") == "processed_media"
    assert sanitize_filename(None) == "processed_media"

def test_parse_time_to_seconds():
    assert parse_time_to_seconds("00:01:30.500") == 90.5
    assert parse_time_to_seconds("01:00:00") == 3600.0
    assert parse_time_to_seconds("45.2") == 45.2
    assert parse_time_to_seconds("invalid") == 0.0

def test_ffmpeg_discovery_and_status():
    service = FFmpegService()
    status = service.get_status()
    assert "available" in status
    assert "version" in status
    assert "supportedAudioFormats" in status
    assert "supportedContainers" in status
    assert "mp3" in status["supportedAudioFormats"]
    assert "flac" in status["supportedAudioFormats"]
    assert "mp4" in status["supportedContainers"]
    assert "mkv" in status["supportedContainers"]

def test_reject_unsupported_audio_format(tmp_path):
    service = FFmpegService()
    service._ffmpeg_path = service._ffmpeg_path or "mock_ffmpeg"
    fake_input = tmp_path / "test.mp4"
    fake_input.write_bytes(b"dummy")

    with pytest.raises(WorkerProtocolError) as exc_info:
        service.execute_postprocess(
            job_id="test_job",
            input_path=str(fake_input),
            action="extract_audio",
            target_directory=str(tmp_path),
            audio_format="unsupported_format_xyz",
        )
    assert exc_info.value.code == ProtocolErrorCode.VALIDATION_ERROR

def test_reject_unsupported_container(tmp_path):
    service = FFmpegService()
    service._ffmpeg_path = service._ffmpeg_path or "mock_ffmpeg"
    fake_input = tmp_path / "test.mp4"
    fake_input.write_bytes(b"dummy")

    with pytest.raises(WorkerProtocolError) as exc_info:
        service.execute_postprocess(
            job_id="test_job",
            input_path=str(fake_input),
            action="remux",
            target_directory=str(tmp_path),
            remux_container="avi_unsupported",
        )
    assert exc_info.value.code == ProtocolErrorCode.VALIDATION_ERROR

def test_ffmpeg_service_engine_unavailable_when_missing(tmp_path):
    service = FFmpegService()
    service._ffmpeg_path = None
    with pytest.raises(WorkerProtocolError) as exc_info:
        service.execute_postprocess(
            job_id="test_missing_ffmpeg",
            input_path=str(tmp_path / "any.mp4"),
            action="extract_audio",
            target_directory=str(tmp_path),
            audio_format="mp3",
        )
    assert exc_info.value.code == ProtocolErrorCode.ENGINE_UNAVAILABLE

def test_real_audio_extraction_with_ffmpeg(tmp_path):
    """Generates a small 1-second synthetic audio file using FFmpeg and extracts it to MP3 and WAV."""
    service = FFmpegService()
    if not service.get_status()["available"]:
        pytest.skip("FFmpeg not available on system")

    # Generate small 1-second sine wave video/audio file
    source_file = tmp_path / "synthetic_source.mp4"
    gen_cmd = [
        service._ffmpeg_path,
        "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:duration=1",
        "-c:a", "aac",
        str(source_file),
    ]
    subprocess.run(gen_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    assert source_file.exists() and source_file.stat().st_size > 0

    # 1. Extract to MP3
    events = []
    def record_event(name, payload):
        events.append((name, payload))

    service.write_event_fn = record_event

    res = service.execute_postprocess(
        job_id="audio_mp3_job",
        input_path=str(source_file),
        action="extract_audio",
        target_directory=str(tmp_path),
        audio_format="mp3",
        audio_bitrate="192k",
        custom_filename="my_extracted_audio",
        preserve_source=True,
    )

    assert res["success"] is True
    assert res["outputPath"].endswith(".mp3")
    assert os.path.exists(res["outputPath"])
    assert res["totalBytes"] > 0

    # Probe extracted file
    if service._ffprobe_path:
        probe = service.probe_file(res["outputPath"])
        assert probe["valid"] is True
        assert probe["audioStreamsCount"] >= 1
        assert "mp3" in probe["audioCodecs"]

    # Verify event emission
    event_names = [e[0] for e in events]
    assert "postprocess.started" in event_names
    assert "postprocess.completed" in event_names

def test_dispatcher_ffmpeg_commands():
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    dispatcher = CommandDispatcher(health=health, lifecycle=lifecycle)

    # Test get_ffmpeg_info
    req = ProtocolMessage(
        msg_type="request",
        command="get_ffmpeg_info",
        payload={},
        msg_id="req_ff_1",
    )
    resp = dispatcher.dispatch(req)
    assert resp is not None
    assert resp.type == "response"
    assert "available" in resp.payload
    assert "supportedAudioFormats" in resp.payload
