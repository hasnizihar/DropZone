import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional, Callable
from ..protocol.models import (
    ProtocolMessage,
    create_response,
    create_error,
    create_event,
    PROTOCOL_VERSION,
)
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode
from ..__init__ import __version__
from .health import WorkerHealthMonitor
from .lifecycle import WorkerLifecycle
from ..services.media_analyzer import MediaAnalyzerService
from ..services.download_service import DownloadService

logger = logging.getLogger("dropzone_worker")

class CommandDispatcher:
    def __init__(
        self,
        health: WorkerHealthMonitor,
        lifecycle: WorkerLifecycle,
        analyzer: Optional[MediaAnalyzerService] = None,
        download_service: Optional[DownloadService] = None,
        write_message_fn: Optional[Callable[[ProtocolMessage], None]] = None,
        max_workers: int = 4,
    ):
        self.health = health
        self.lifecycle = lifecycle
        self.analyzer = analyzer or MediaAnalyzerService()
        self.write_message_fn = write_message_fn
        self.download_service = download_service or DownloadService(write_event_fn=self._write_event)
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="worker_task")

        self._handlers = {
            "hello": self._handle_hello,
            "ping": self._handle_ping,
            "get_status": self._handle_get_status,
            "shutdown": self._handle_shutdown,
            "analyze_url": self._handle_analyze_url,
            "start_download": self._handle_start_download,
            "cancel_download": self._handle_cancel_download,
            "pause_download": self._handle_pause_download,
        }

    def _write_event(self, event_name: str, payload: Dict[str, Any]):
        self._safe_write(create_event(event_name, payload))

    def dispatch(self, request: ProtocolMessage) -> Optional[ProtocolMessage]:
        self.health.record_request()
        cmd = request.command.lower()

        handler = self._handlers.get(cmd)
        if not handler:
            self.health.record_error()
            raise WorkerProtocolError(
                ProtocolErrorCode.UNKNOWN_COMMAND,
                f"Command '{request.command}' is not supported by worker"
            )

        if cmd == "analyze_url" and self.write_message_fn:
            # Execute asynchronously in thread pool to prevent blocking heartbeat
            self._dispatch_async_analyze(request)
            return None

        if cmd == "start_download" and self.write_message_fn:
            # Execute download asynchronously in thread pool to keep protocol responsive
            self._dispatch_async_download(request)
            return None

        # Synchronous dispatch
        payload = handler(request.payload)
        return create_response(request.id, request.command, payload)

    def _dispatch_async_analyze(self, request: ProtocolMessage):
        url = request.payload.get("url")

        def _worker_task():
            self._safe_write(
                create_event("analysis.started", {"url": url, "requestId": request.id})
            )

            try:
                result = self.analyzer.analyze(url)
                self._safe_write(
                    create_response(request.id, request.command, result)
                )
                self._safe_write(
                    create_event(
                        "analysis.completed",
                        {
                            "url": url,
                            "requestId": request.id,
                            "title": result["metadata"]["title"],
                            "formatsCount": len(result["formats"]),
                        },
                    )
                )
            except WorkerProtocolError as proto_err:
                self.health.record_error()
                logger.warning(f"Analysis failed for {url} [{proto_err.code}]: {proto_err.message}")
                self._safe_write(
                    create_error(
                        request_id=request.id,
                        code=proto_err.code,
                        message=proto_err.message,
                        details=proto_err.details,
                        command=request.command,
                    )
                )
                self._safe_write(
                    create_event(
                        "analysis.failed",
                        {"url": url, "requestId": request.id, "error": proto_err.message, "code": proto_err.code},
                    )
                )
            except Exception as unhandled_err:
                self.health.record_error()
                logger.error(f"Unexpected error in async analyzer for {url}: {unhandled_err}", exc_info=True)
                self._safe_write(
                    create_error(
                        request_id=request.id,
                        code=ProtocolErrorCode.INTERNAL_ERROR,
                        message=f"Analysis failed: {unhandled_err}",
                        command=request.command,
                    )
                )
                self._safe_write(
                    create_event(
                        "analysis.failed",
                        {"url": url, "requestId": request.id, "error": str(unhandled_err), "code": ProtocolErrorCode.INTERNAL_ERROR},
                    )
                )

        self.executor.submit(_worker_task)

    def _dispatch_async_download(self, request: ProtocolMessage):
        payload = request.payload or {}
        job_id = payload.get("jobId")
        url = payload.get("url")
        target_dir = payload.get("targetDirectory")
        format_id = payload.get("formatId")
        custom_filename = payload.get("customFilename")
        extract_audio = bool(payload.get("extractAudio", False))
        audio_format = payload.get("audioFormat", "mp3")

        def _download_task():
            try:
                res = self.download_service.execute_download(
                    job_id=job_id,
                    url=url,
                    target_directory=target_dir,
                    format_id=format_id,
                    custom_filename=custom_filename,
                    extract_audio=extract_audio,
                    audio_format=audio_format,
                )
                self._safe_write(create_response(request.id, request.command, res))
            except WorkerProtocolError as err:
                self.health.record_error()
                self._safe_write(
                    create_error(request.id, err.code, err.message, err.details, command=request.command)
                )
            except Exception as exc:
                self.health.record_error()
                logger.error(f"Unexpected error in async download for {job_id}: {exc}", exc_info=True)
                self._safe_write(
                    create_error(request.id, ProtocolErrorCode.INTERNAL_ERROR, str(exc), command=request.command)
                )

        self.executor.submit(_download_task)

    def _safe_write(self, msg: ProtocolMessage):
        if self.write_message_fn:
            try:
                self.write_message_fn(msg)
            except Exception as exc:
                logger.error(f"Failed to write async message: {exc}")

    def _handle_hello(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        client_name = payload.get("client", "Unknown Client")
        client_version = payload.get("version", "1.0.0")
        logger.info(f"Received handshake from client: {client_name} (v{client_version})")

        return {
            "workerVersion": __version__,
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": [
                "ping",
                "hello",
                "get_status",
                "shutdown",
                "analyze_url",
                "start_download",
                "cancel_download",
                "pause_download",
            ],
            "pid": self.health.get_status_payload()["pid"],
            "ytdlpVersion": self.analyzer.engine.version,
        }

    def _handle_ping(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.health.record_heartbeat()
        return {
            "pong": True,
            "uptimeSeconds": self.health.get_uptime_seconds(),
        }

    def _handle_get_status(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        status_info = self.health.get_status_payload()
        status_info["ytdlpVersion"] = self.analyzer.engine.version
        for cap in ["analyze_url", "start_download", "cancel_download", "pause_download"]:
            if cap not in status_info["capabilities"]:
                status_info["capabilities"].append(cap)
        return status_info

    def _handle_shutdown(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Graceful shutdown requested via protocol.")
        self.executor.shutdown(wait=False, cancel_futures=True)
        self.lifecycle.trigger_shutdown()
        return {
            "shuttingDown": True,
            "reason": payload.get("reason", "requested_by_host"),
        }

    def _handle_analyze_url(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = payload.get("url")
        return self.analyzer.analyze(url)

    def _handle_start_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.download_service.execute_download(
            job_id=payload.get("jobId"),
            url=payload.get("url"),
            target_directory=payload.get("targetDirectory"),
            format_id=payload.get("formatId"),
            custom_filename=payload.get("customFilename"),
            extract_audio=bool(payload.get("extractAudio", False)),
            audio_format=payload.get("audioFormat", "mp3"),
        )

    def _handle_cancel_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        if not job_id:
            raise WorkerProtocolError(ProtocolErrorCode.VALIDATION_ERROR, "Missing 'jobId' in cancel_download request")
        cancelled = self.download_service.cancel_download(job_id)
        return {"jobId": job_id, "cancelled": cancelled, "success": cancelled}

    def _handle_pause_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        if not job_id:
            raise WorkerProtocolError(ProtocolErrorCode.VALIDATION_ERROR, "Missing 'jobId' in pause_download request")
        paused = self.download_service.pause_download(job_id)
        return {"jobId": job_id, "paused": paused, "success": paused}
