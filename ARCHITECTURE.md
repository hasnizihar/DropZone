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
- URLs submitted to the analyzer are validated against known protocols (http, https) and defensive network checks (`UrlValidator` rejects private, loopback, and cloud metadata IP ranges).
- Target file paths are sanitized to prevent directory traversal attacks (`..`).
- Subprocess spawning uses `child_process.spawn()` with `shell: false` and strict argument arrays.

---

## 4. Media Extraction Architecture (Milestone 3)

### 4.1 Non-Blocking Extraction Model
To maintain heartbeat responsiveness (`ping`/`pong`) during long extractions, the Python worker implements non-blocking execution via a bounded `ThreadPoolExecutor(max_workers=2)`. Stdio writes are guarded by a `threading.Lock()` to prevent interleaving of JSON lines.

### 4.2 Extraction Pipeline
```
Raw URL Input
   │
   ▼
UrlValidator (Protocol & private IP checks: 127.0.0.1, 10.x, 172.x, 192.168.x, 169.254.x)
   │
   ▼
YtDlpEngine (YoutubeDL with download=False, noplaylist=True, stderr logging)
   │
   ├─► MetadataNormalizer (Title, platform, duration, views, uploader, thumbnails)
   └─► FormatNormalizer (Resolution, codecs, container, exact vs estimated sizes, sorting)
   │
   ▼
Dispatcher Event / Response Emitter
   ├─► 'analysis.started'
   ├─► Response Payload (success: true, metadata, formats, durationMs)
   └─► 'analysis.completed' / 'analysis.failed'
```

### 4.3 Format Classification & Size Fidelity
Formats are cleanly categorized into `isCombined` (audio + video), `isVideo` (video stream only), and `isAudio` (audio stream only). Exact sizes (`filesize`) and estimated sizes (`filesize_approx`) are strictly segregated to avoid misleading the user with inaccurate file sizes.

---

## 5. Download Queue & Scheduler Architecture (Milestone 4)

### 5.1 Single Authority Queue Management
Electron Main's `QueueManager` is the single authority for queue order, state transitions, and concurrency management. React renders state and triggers user actions; the Python worker performs file transfer and post-processing without maintaining queue state.

### 5.2 Concurrency & Scheduler Model
- Concurrency limit is dynamically controlled by `maxConcurrentDownloads` (default: 3).
- Active jobs are tracked in an in-memory set (`activeJobIds`).
- Pending jobs are scheduled via FIFO queue order.
- When an active download completes, fails, pauses, or cancels, its concurrency slot is freed, and the next eligible pending job is immediately scheduled.

### 5.3 Progress Throttling & Stdio Safety
Download progress callbacks inside `yt-dlp` are throttled to a maximum of 4 events per second (250ms interval) per active job. All stdout writes are guarded by an inter-thread lock, preventing interleaved JSON Lines and protecting IPC protocol integrity.

---

## 6. Direct HTTP Streaming & Gallery Architecture (Milestone 5)

### 6.1 Direct HTTP/HTTPS Chunked Streaming Engine
Direct file downloads stream network bytes directly to disk in bounded 64 KB chunks without loading files into memory. 
- Files write to an active `.part` temporary file.
- Resumption verifies remote ETag and Last-Modified using HTTP Range headers (`Range: bytes={existing_bytes}-` and `If-Range`).
- If the server returns `206 Partial Content`, downloads resume seamlessly.
- If the server returns `200 OK`, Range was ignored or resource modified; `.part` safely resets to byte 0.
- If the server returns `416 Range Not Satisfiable`, the engine verifies if `.part` is already complete, or resets safely.
- Upon completion, the `.part` file is atomically renamed via `os.replace` to the final filename.

### 6.2 Gallery Extraction & Parent-Child Queue Model
- Integrates `gallery-dl` for supported image hosts alongside direct image resource detection.
- Extraction is bounded (default max 50 items) to prevent runaway crawling.
- When a user downloads a gallery, `QueueManager` adds a parent container job (`engine: 'image-gallery'`) and creates child download jobs (`engine: 'direct-http'`) for each selected asset.
- Child jobs compete fairly within the single authoritative FIFO concurrency scheduler (`maxConcurrentDownloads: 3`).
- Parent jobs aggregate progress, completed asset count, and cancellation/pause state across child jobs.
