import logging
from typing import Dict, Any
from ..protocol.models import ProtocolMessage, create_response
from ..protocol.errors import ProtocolErrorCode, WorkerProtocolError
from .health import WorkerHealthMonitor
from .lifecycle import WorkerLifecycle
from .. import __version__, PROTOCOL_VERSION

logger = logging.getLogger("dropzone_worker")

class CommandDispatcher:
    def __init__(self, health: WorkerHealthMonitor, lifecycle: WorkerLifecycle):
        self.health = health
        self.lifecycle = lifecycle
        self._handlers = {
            "hello": self._handle_hello,
            "ping": self._handle_ping,
            "get_status": self._handle_get_status,
            "shutdown": self._handle_shutdown,
        }

    def dispatch(self, request: ProtocolMessage) -> ProtocolMessage:
        self.health.record_request()
        cmd = request.command.lower()

        handler = self._handlers.get(cmd)
        if not handler:
            self.health.record_error()
            raise WorkerProtocolError(
                ProtocolErrorCode.UNKNOWN_COMMAND,
                f"Command '{request.command}' is not supported by worker"
            )

        payload = handler(request.payload)
        return create_response(request.id, request.command, payload)

    def _handle_hello(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        client_name = payload.get("client", "Unknown Client")
        client_version = payload.get("version", "1.0.0")
        logger.info(f"Received handshake from client: {client_name} (v{client_version})")

        return {
            "workerVersion": __version__,
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": ["ping", "hello", "get_status", "shutdown"],
            "pid": self.health.get_status_payload()["pid"],
        }

    def _handle_ping(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.health.record_heartbeat()
        return {
            "pong": True,
            "uptimeSeconds": self.health.get_uptime_seconds(),
        }

    def _handle_get_status(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.health.get_status_payload()

    def _handle_shutdown(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Graceful shutdown requested via protocol.")
        self.lifecycle.trigger_shutdown()
        return {
            "shuttingDown": True,
            "reason": payload.get("reason", "requested_by_host"),
        }
