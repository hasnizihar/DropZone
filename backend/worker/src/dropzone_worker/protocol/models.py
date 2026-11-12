from datetime import datetime, timezone
import uuid
from typing import Any, Dict, Optional

PROTOCOL_VERSION = "1.0"

def get_utc_iso_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

class ProtocolMessage:
    def __init__(
        self,
        msg_type: str,
        command: str,
        payload: Optional[Dict[str, Any]] = None,
        msg_id: Optional[str] = None,
        protocol_version: str = PROTOCOL_VERSION,
        timestamp: Optional[str] = None,
    ):
        self.protocol_version = protocol_version
        self.id = msg_id or str(uuid.uuid4())
        self.type = msg_type
        self.command = command
        self.payload = payload if payload is not None else {}
        self.timestamp = timestamp or get_utc_iso_timestamp()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "protocolVersion": self.protocol_version,
            "id": self.id,
            "type": self.type,
            "command": self.command,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProtocolMessage":
        return cls(
            msg_type=data.get("type", "request"),
            command=data.get("command", ""),
            payload=data.get("payload", {}),
            msg_id=data.get("id"),
            protocol_version=data.get("protocolVersion", PROTOCOL_VERSION),
            timestamp=data.get("timestamp"),
        )

def create_response(request_id: str, command: str, payload: Dict[str, Any]) -> ProtocolMessage:
    return ProtocolMessage(
        msg_type="response",
        command=command,
        payload=payload,
        msg_id=request_id,
    )

def create_error(
    request_id: Optional[str],
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    command: Optional[str] = None,
) -> ProtocolMessage:
    err_payload = {"code": code, "message": message}
    if details:
        err_payload["details"] = details
    return ProtocolMessage(
        msg_type="error",
        command=command or "error",
        payload=err_payload,
        msg_id=request_id or str(uuid.uuid4()),
    )

def create_event(event_name: str, payload: Dict[str, Any]) -> ProtocolMessage:
    return ProtocolMessage(
        msg_type="event",
        command=event_name,
        payload=payload,
    )
