import subprocess
import sys
import os
import json
import time

def test_full_worker_process_stdio():
    worker_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
    env = os.environ.copy()
    env["PYTHONPATH"] = worker_src

    proc = subprocess.Popen(
        [sys.executable, "-m", "dropzone_worker"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env=env,
    )

    try:
        # 1. Expect initial worker.ready event
        ready_line = proc.stdout.readline()
        ready_data = json.loads(ready_line)
        assert ready_data["type"] == "event"
        assert ready_data["command"] == "worker.ready"
        assert "pid" in ready_data["payload"]

        # 2. Send 'hello' handshake request
        hello_req = json.dumps({
            "protocolVersion": "1.0",
            "id": "test-hello-1",
            "type": "request",
            "command": "hello",
            "payload": {"client": "IntegrationTest", "version": "1.0.0"},
            "timestamp": "2026-11-12T12:00:00Z"
        }) + "\n"
        proc.stdin.write(hello_req)
        proc.stdin.flush()

        hello_res_line = proc.stdout.readline()
        hello_res = json.loads(hello_res_line)
        assert hello_res["id"] == "test-hello-1"
        assert hello_res["type"] == "response"
        assert "capabilities" in hello_res["payload"]

        # 3. Send 'ping' heartbeat request
        ping_req = json.dumps({
            "protocolVersion": "1.0",
            "id": "test-ping-1",
            "type": "request",
            "command": "ping",
            "payload": {},
            "timestamp": "2026-11-12T12:00:01Z"
        }) + "\n"
        proc.stdin.write(ping_req)
        proc.stdin.flush()

        ping_res_line = proc.stdout.readline()
        ping_res = json.loads(ping_res_line)
        assert ping_res["id"] == "test-ping-1"
        assert ping_res["payload"]["pong"] is True

        # 4. Send 'shutdown' request
        shutdown_req = json.dumps({
            "protocolVersion": "1.0",
            "id": "test-shutdown-1",
            "type": "request",
            "command": "shutdown",
            "payload": {},
            "timestamp": "2026-11-12T12:00:02Z"
        }) + "\n"
        proc.stdin.write(shutdown_req)
        proc.stdin.flush()

        shutdown_res_line = proc.stdout.readline()
        shutdown_res = json.loads(shutdown_res_line)
        assert shutdown_res["id"] == "test-shutdown-1"
        assert shutdown_res["payload"]["shuttingDown"] is True

        # 5. Expect final worker.shutting_down event
        event_line = proc.stdout.readline()
        event_data = json.loads(event_line)
        assert event_data["type"] == "event"
        assert event_data["command"] == "worker.shutting_down"

        # Worker should terminate with code 0
        exit_code = proc.wait(timeout=5)
        assert exit_code == 0

    finally:
        if proc.poll() is None:
            proc.kill()
