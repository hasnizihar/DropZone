import pytest
from dropzone_worker.protocol.models import ProtocolMessage
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode
from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle
from dropzone_worker.core.dispatcher import CommandDispatcher

@pytest.fixture
def dispatcher_fixture():
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    dispatcher = CommandDispatcher(health, lifecycle)
    return dispatcher, health, lifecycle

def test_dispatch_hello(dispatcher_fixture):
    dispatcher, _, _ = dispatcher_fixture
    req = ProtocolMessage("request", "hello", {"client": "test_client", "version": "1.0"}, msg_id="req-hello")
    res = dispatcher.dispatch(req)

    assert res.type == "response"
    assert res.id == "req-hello"
    assert res.command == "hello"
    assert "capabilities" in res.payload
    assert "workerVersion" in res.payload

def test_dispatch_ping(dispatcher_fixture):
    dispatcher, health, _ = dispatcher_fixture
    req = ProtocolMessage("request", "ping", {}, msg_id="req-ping-1")
    res = dispatcher.dispatch(req)

    assert res.type == "response"
    assert res.id == "req-ping-1"
    assert res.payload.get("pong") is True
    assert health.requests_count == 1

def test_dispatch_get_status(dispatcher_fixture):
    dispatcher, _, _ = dispatcher_fixture
    req = ProtocolMessage("request", "get_status", {}, msg_id="req-status")
    res = dispatcher.dispatch(req)

    assert res.type == "response"
    assert res.id == "req-status"
    assert res.payload["status"] == "healthy"
    assert "pid" in res.payload
    assert "uptimeSeconds" in res.payload

def test_dispatch_shutdown(dispatcher_fixture):
    dispatcher, _, lifecycle = dispatcher_fixture
    assert lifecycle.is_running is True

    req = ProtocolMessage("request", "shutdown", {"reason": "test"}, msg_id="req-shutdown")
    res = dispatcher.dispatch(req)

    assert res.type == "response"
    assert res.id == "req-shutdown"
    assert res.payload.get("shuttingDown") is True
    assert lifecycle.is_shutting_down is True

def test_dispatch_unknown_command(dispatcher_fixture):
    dispatcher, health, _ = dispatcher_fixture
    req = ProtocolMessage("request", "invalid_nonexistent_command", {}, msg_id="req-bad")

    with pytest.raises(WorkerProtocolError) as exc_info:
        dispatcher.dispatch(req)

    assert exc_info.value.code == ProtocolErrorCode.UNKNOWN_COMMAND
    assert health.errors_count == 1

def test_dispatcher_analyze_unified_generic_fallback(dispatcher_fixture):
    dispatcher, _, _ = dispatcher_fixture
    # Verify that an archive URL falling back from generic routes to direct HTTP
    url = "https://github.com/hasnizihar/dropzone/archive/refs/tags/v1.0.0-alpha.10.zip"
    res = dispatcher._analyze_unified(url)
    assert res is not None
    assert "downloadType" in res
    assert res["downloadType"] in ("file", "gallery")

