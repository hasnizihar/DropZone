import json
from typing import Dict, Any
from .errors import ProtocolErrorCode, WorkerProtocolError
from .models import ProtocolMessage

MAX_LINE_LENGTH = 2 * 1024 * 1024  # 2MB maximum per JSON line

def parse_incoming_line(line: str) -> ProtocolMessage:
    if not line:
        raise WorkerProtocolError(ProtocolErrorCode.MALFORMED_JSON, "Empty message line received")

    if len(line) > MAX_LINE_LENGTH:
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            f"Message exceeds maximum allowed length of {MAX_LINE_LENGTH} bytes"
        )

    try:
        data = json.loads(line)
    except json.JSONDecodeError as exc:
        raise WorkerProtocolError(
            ProtocolErrorCode.MALFORMED_JSON,
            f"Invalid JSON format: {exc.msg}",
            {"line": exc.lineno, "col": exc.colno}
        )

    if not isinstance(data, dict):
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            "Root protocol message must be a JSON object"
        )

    # Validate essential fields
    msg_id = data.get("id")
    if not msg_id or not isinstance(msg_id, str):
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            "Protocol message missing required string field 'id'"
        )

    msg_type = data.get("type")
    if not msg_type or msg_type not in ("request", "response", "event", "error"):
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            f"Invalid or missing 'type' field: {msg_type}"
        )

    command = data.get("command")
    if not command or not isinstance(command, str):
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            "Protocol message missing required string field 'command'"
        )

    payload = data.get("payload")
    if payload is not None and not isinstance(payload, dict):
        raise WorkerProtocolError(
            ProtocolErrorCode.VALIDATION_ERROR,
            "'payload' must be a JSON object"
        )

    return ProtocolMessage.from_dict(data)

