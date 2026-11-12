# DROPZONE Worker Engine

The background Python worker process for the DROPZONE Universal Desktop Download Manager. Communicates with Electron via JSON Lines (JSONL) protocol over `stdin`/`stdout`.

---

## Architecture Overview

```
Electron Main Process
       │  stdin  (JSONL Requests)
       ▼
dropzone_worker
  ├── Parser & Serializer
  ├── Protocol Models
  ├── Command Dispatcher (hello, ping, get_status, shutdown)
  ├── Health Monitor
  └── Lifecycle Manager
       │  stdout (JSONL Responses & Events)
       ▼
Electron Main Process
```

- **Stdout**: Reserved exclusively for protocol messages (one JSON object per line).
- **Stderr**: Reserved for human-readable diagnostic logging and tracebacks.

---

## Protocol Commands

| Command | Description | Payload Example |
| :--- | :--- | :--- |
| `hello` | Handshake & capabilities query | `{"client": "DropZone Electron", "version": "1.0.0"}` |
| `ping` | Heartbeat keepalive | `{}` |
| `get_status` | Detailed telemetry & health | `{}` |
| `shutdown` | Controlled graceful termination | `{"reason": "app_exit"}` |

---

## Events Emitted

- `worker.ready`: Emitted immediately upon process initialization.
- `worker.shutting_down`: Emitted prior to process exit.
- `worker.status`: Telemetry updates.
- `worker.error`: Error notifications.

---

## Running Independently

```bash
# From workspace root
python -m dropzone_worker
# Or with PYTHONPATH set:
python backend/worker/src/dropzone_worker/__main__.py
```

## Running Worker Tests

```bash
python -m pytest backend/worker/tests
```
