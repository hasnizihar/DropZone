import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional, Callable
from ..protocol.models import ProtocolMessage, create_response, create_error, create_event
from ..protocol.errors import ProtocolErrorCode, WorkerProtocolError
from .health import WorkerHealthMonitor
from .lifecycle import WorkerLifecycle
from ..services.media_analyzer import MediaAnalyzerService
from .. import __version__, PROTOCOL_VERSION

logger = logging.getLogger("dropzone_worker")

class CommandDispatcher:
    def __init__(
        self,
        health: WorkerHealthMonitor,
        lifecycle: WorkerLifecycle,
        analyzer: Optional[MediaAnalyzerService] = None,
        write_message_fn: Optional[Callable[[ProtocolMessage], None]] = None,
        max_workers: int = 2,
    ):
        self.health = health
        self.lifecycle = lifecycle
        self.analyzer = analyzer or MediaAnalyzerService()
        self.write_message_fn = write_message_fn
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="analyzer_worker")

        self._handlers = {
            "hello": self._handle_hello,
            "ping": self._handle_ping,
            "get_status": self._handle_get_status,
            "shutdown": self._handle_shutdown,
            "analyze_url": self._handle_analyze_url,
        }

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

        # Synchronous dispatch
        payload = handler(request.payload)
        return create_response(request.id, request.command, payload)

    def _dispatch_async_analyze(self, request: ProtocolMessage):
        url = request.payload.get("url")

        def _worker_task():
            # 1. Emit analysis.started event
            self._safe_write(
                create_event("analysis.started", {"url": url, "requestId": request.id})
            )

            try:
                result = self.analyzer.analyze(url)
                # 2. Emit response with extracted metadata & formats
                self._safe_write(
                    create_response(request.id, request.command, result)
                )
                # 3. Emit analysis.completed event
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
            "capabilities": ["ping", "hello", "get_status", "shutdown", "analyze_url"],
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
        if "analyze_url" not in status_info["capabilities"]:
            status_info["capabilities"].append("analyze_url")
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
