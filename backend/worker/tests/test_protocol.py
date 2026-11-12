import pytest
from dropzone_worker.protocol.models import (
    ProtocolMessage,
    create_response,
    create_error,
    create_event,
)
from dropzone_worker.protocol.parser import parse_incoming_line
from dropzone_worker.protocol.serializer import serialize_message
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

def test_parse_valid_request():
    line = '{"protocolVersion":"1.0","id":"req-1","type":"request","command":"ping","payload":{}}'
    msg = parse_incoming_line(line)

    assert msg.protocol_version == "1.0"
    assert msg.id == "req-1"
    assert msg.type == "request"
    assert msg.command == "ping"
    assert msg.payload == {}

def test_parse_malformed_json():
    with pytest.raises(WorkerProtocolError) as exc_info:
        parse_incoming_line("{not-valid-json}")
    assert exc_info.value.code == ProtocolErrorCode.MALFORMED_JSON

def test_parse_missing_required_fields():
    # Missing command
    with pytest.raises(WorkerProtocolError) as exc_info:
        parse_incoming_line('{"protocolVersion":"1.0","id":"req-1","type":"request"}')
    assert exc_info.value.code == ProtocolErrorCode.VALIDATION_ERROR

    # Missing id
    with pytest.raises(WorkerProtocolError) as exc_info:
        parse_incoming_line('{"protocolVersion":"1.0","type":"request","command":"ping"}')
    assert exc_info.value.code == ProtocolErrorCode.VALIDATION_ERROR

def test_serialization():
    msg = create_response("req-123", "ping", {"pong": True})
    serialized = serialize_message(msg)

    assert '"id":"req-123"' in serialized
    assert '"command":"ping"' in serialized
    assert '"type":"response"' in serialized
    assert '"pong":true' in serialized

def test_create_error():
    err = create_error("req-abc", ProtocolErrorCode.UNKNOWN_COMMAND, "Unknown cmd")
    assert err.type == "error"
    assert err.id == "req-abc"
    assert err.payload["code"] == ProtocolErrorCode.UNKNOWN_COMMAND
    assert err.payload["message"] == "Unknown cmd"

def test_create_event():
    evt = create_event("worker.ready", {"pid": 9999})
    assert evt.type == "event"
    assert evt.command == "worker.ready"
    assert evt.payload["pid"] == 9999
