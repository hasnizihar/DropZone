# DROPZONE Architecture Specification

DROPZONE is structured as a multi-tier, local-first desktop application with distinct separation of concerns, secure inter-process communication, and resilient worker subprocess isolation.

---

## 1. High-Level Architecture Diagram

```
+-------------------------------------------------------------+
|                     RENDERER PROCESS                        |
|                                                             |
|   +-------------------+  +-------------------------------+  |
|   |  React Components |  |   Zustand Application Store   |  |
|   |  - Dashboard      |  |   - Job Queue State           |  |
|   |  - URL Analyzer   |  |   - UI Notifications          |  |
|   |  - Downloads View |  |   - System Engine Status      |  |
|   |  - Batch Process  |  |   - Worker Subprocess Status  |  |
|   +-------------------+  +-------------------------------+  |
+-------------------------------------------------------------+
                              |
                     Preload (Secure IPC)
               contextBridge / Typed Contracts
                              |
+-------------------------------------------------------------+
|                   ELECTRON MAIN PROCESS                     |
|                                                             |
|  +--------------------+  +-------------------------------+  |
|  | Window Lifecycle   |  | IPC Handlers & Validators     |  |
|  | Native Shell/FS    |  | Job State Machine Manager     |  |
|  +--------------------+  +-------------------------------+  |
|                              |                              |
|                              v                              |
|                  +-----------------------+                  |
|                  |     WorkerManager     |                  |
|                  | - Process Lifecycle   |                  |
|                  | - JSON Lines Protocol |                  |
|                  | - Heartbeat Ping/Pong |                  |
|                  | - Crash Auto-Recovery |                  |
|                  +-----------------------+                  |
+-------------------------------------------------------------+
                              |
                  Structured JSON Lines (stdio)
                              |
+-------------------------------------------------------------+
|                   PYTHON WORKER SUBPROCESS                  |
|                                                             |
|  +-------------------------------------------------------+  |
|  |                  Dispatch Controller                  |  |
|  +-------------------------------------------------------+  |
|    - Bootstrap & Logging Isolation (stderr)                 |
|    - Protocol Parser & Compact JSON Serializer              |
|    - Command Handlers: hello, ping, get_status, shutdown    |
|    - Health Monitor & Telemetry                             |
|    - Signal & Lifecycle Handlers                            |
+-------------------------------------------------------------+
```

---

## 2. Process Boundary & Worker Lifecycle

### 2.1 Single State Authority
Electron Main is the sole authoritative owner of application state and download job state. The Python worker functions as a stateless command executor and asynchronous event emitter.

### 2.2 Worker Lifecycle States
```
STOPPED ──► STARTING ──► [worker.ready / hello] ──► HEALTHY
                            │                         │
                            ▼                         ├── Heartbeat timeout ──► DEGRADED
                         FAILED                       │                             │
                                                      │ (consecutive failures >= 3) ▼
                                                      ├──────────────────────► UNHEALTHY
                                                      │                             │
                                                      │                             ▼
                                                      │                        RESTARTING
                                                      │                             │
                                                      │                             ▼
                                                      │                         STARTING
                                                      ▼
                                              graceful shutdown ──► STOPPING ──► STOPPED
```

### 2.3 JSON Lines (JSONL) Protocol Specification
Communication over standard input/output follows the DROPZONE Protocol v1.0. Every line is an independent JSON object terminated by `\n`:

```json
{
  "protocolVersion": "1.0",
  "id": "req_1710000000_abc123_1",
  "type": "request",
  "command": "ping",
  "payload": {},
  "timestamp": "2026-11-12T12:00:00Z"
}
```

- **Stdout**: Dedicated exclusively to newline-delimited protocol JSON objects.
- **Stderr**: Dedicated exclusively to diagnostic logs and tracebacks.

### 2.4 Heartbeat & Health Telemetry
- Heartbeat interval: **5 seconds**.
- Heartbeat response timeout: **3 seconds**.
- Maximum consecutive failures before marking `unhealthy`: **3**.
- State returns to `healthy` automatically upon the next successful ping.

### 2.5 Crash Recovery
- Unexpected subprocess exits trigger an immediate rejection of all pending requests with `WorkerCrashError`.
- Exponential backoff is calculated: `min(1000 * 2^(attempt-1), 15000)ms`.
- Maximum automatic restarts: **3**.
- Intentional shutdowns (`stop()`, app quit) cancel recovery attempts and clean up child processes gracefully.

---

## 3. Security Boundary
- Preload script uses `contextBridge.exposeInMainWorld` to expose only safe, explicit methods.
- URLs submitted to the analyzer are validated against known protocols (http, https).
- Target file paths are sanitized to prevent directory traversal attacks (`..`).
- Subprocess spawning uses `child_process.spawn()` with `shell: false` and strict argument arrays.
