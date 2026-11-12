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

---

## 7. Playlist & Batch Processing Architecture (Milestone 6)

### 7.1 Bounded Playlist Extraction
- Uses `yt-dlp` in flat extraction mode (`extract_flat=True`, `noplaylist=False`, `playlistend=200`) without downloading media during inspection.
- Normalizes playlist metadata (`id`, `title`, `url`, `source`, `totalCount`, `extractedCount`, `isTruncated`, `warnings`, `entries`).
- Unavailable, deleted, or private videos are normalized with `isAvailable: false`, preventing failed download attempts.
- Truncation warnings are surfaced when playlists exceed the inspection limit.

### 7.2 Multi-URL Batch Parsing & Independent Analysis
- Batch URLs are parsed via `batchParser.ts`, stripping surrounding prose, deduplicating URLs, and enforcing a maximum of 50 items per batch.
- Each URL is analyzed independently through the unified inspection pipeline across media, files, images, galleries, and playlists.
- Analysis failures on individual URLs do not abort the remaining batch items.

### 7.3 Container Jobs & Partial Retry Architecture
- Parent container jobs (`engine: 'playlist' | 'batch' | 'image-gallery'`) are excluded from download concurrency slots.
- Child jobs compete fairly within the authoritative scheduler (`maxConcurrentDownloads: 3`).
- Deterministic filename collisions are prevented via `resolveUniqueFilename`.
- Parent jobs accurately reflect aggregate progress, completed item counts, and terminal states:
  - All children completed -> `completed`.
  - All children cancelled -> `cancelled`.
  - Mixed completed/failed -> `failed` with `isPartialFailure: true` (`PARTIAL_FAILURE`).
- **Partial Retry**: Retrying a parent container job resets and re-queues only failed or cancelled children, strictly preserving successful downloads.
- Cascading cancellation and cascading removal ensure child jobs are never orphaned.

## 8. FFmpeg Post-Processing & Audio Extraction Architecture (Milestone 7)

### 8.1 Post-Processing Pipeline
- **Dedicated Service Layer**: Implemented `FFmpegService` within the Python worker subprocess. Subprocesses run in dedicated threads within `ThreadPoolExecutor`, completely avoiding event loop or stdio protocol blockage.
- **Pipeline Progression**: `URL Analysis → Download → Post-Processing → Verification (FFprobe) → Completed`.
- **Atomic File Commit**:
  1. Writes to temporary output (`.tmp.ext`).
  2. Runs `probe_file` via `ffprobe` to verify non-zero size, valid container format, readable stream codecs, and valid duration.
  3. Atomically replaces `.tmp.ext` to the final destination via `os.replace`.
  4. On failure, incomplete temporary files are safely removed while preserving the source download.

### 8.2 Supported Codecs & Remuxing Rules
- **Audio Extraction**:
  - MP3: `libmp3lame` (128k, 192k, 256k, 320k)
  - M4A: `aac` (128k, 192k, 256k)
  - WAV: `pcm_s16le`
  - FLAC: `flac`
  - OPUS: `libopus` (96k, 128k, 160k, 192k)
- **Container Remuxing**: Supports MP4, MKV, WebM, and MOV containers. Automatically prioritizes stream copying (`-c copy`) to avoid transcoding quality loss.
- **Stream Merging**: Combines separate video-only and audio-only streams into single synchronized files (`-map 0:v:0 -map 1:a:0 -c copy`).
- **Metadata & Cover Art**: Embeds track titles, artists, albums, and dates; attaches album art using ID3v2 for MP3 and native stream attachments for FLAC.

### 8.3 Authoritative Queue Integration & Direct Retry
- **Processing Stage**: `QueueManager` manages the `processing` status between download completion and final success. Concurrency slots are released only when post-processing finishes.
- **Cached Source Retention**: If post-processing fails, `sourcePath` is retained on disk. Calling `retryJob` skips redownloading entirely and re-executes post-processing directly from the local file.
- **Process Cancellation**: Terminating or cancelling a processing job kills the underlying FFmpeg process tree cleanly via `psutil`, preventing zombie processes on Windows.

---

## 9. SQLite Persistence & Download History Architecture (Milestone 8)

### 9.1 Database Ownership & WebAssembly Architecture
- **Single Authoritative Owner**: Electron Main is the sole owner and reader/writer of the SQLite database. UI renderers interact exclusively through typed, schema-validated IPC invocations.
- **Engine Selection (`sql.js` WebAssembly)**:
  - Uses official SQLite 3 compiled to WebAssembly via `sql.js` (`sql-wasm-inline.js`).
  - Completely avoids Windows native module (`.node`) compilation and code integrity / Windows Defender Application Control (WDAC) blocks (`ERR_DLOPEN_FAILED`) that affect native C++ drivers like `better-sqlite3`.
  - Operates at in-memory speeds with debounced and transaction-triggered atomic disk commits (`fs.writeFileSync(tmp) -> fs.renameSync(db)`).
- **Database Location**:
  - Located securely at `path.join(app.getPath('userData'), 'dropzone.db')`.
  - Never stored in the source repository or hardcoded user paths.
  - Automatically creates parent directories safely.

### 9.2 Versioned Schema & Migration Framework
- **Migration Tracking**: Managed through `schema_migrations` (`version`, `name`, `applied_at`).
- **Sequential Execution**: Migrations execute sequentially inside atomic transactions.
- **Schema v1 Tables**:
  - `settings`: Key-value configuration store for application preferences.
  - `download_jobs`: Complete record of all active and historic jobs, preserving parent-child relationships (`FOREIGN KEY (parent_job_id) REFERENCES download_jobs(id) ON DELETE CASCADE`), post-processing parameters, error details, and byte counts.
  - Performance indexes: Indexing on `status`, `category`, `created_at`, and `parent_job_id`.
- **Integrity Probing & Corruption Recovery**: Automatically runs `PRAGMA integrity_check;`. If file corruption is detected, creates a timestamped backup (`dropzone.db.corrupted.<timestamp>`) and initializes a clean schema without crashing.

### 9.3 Startup Hydration & Interrupted Job Recovery Policy
- **Authoritative Scheduler Preservation**: `QueueManager` remains the live execution authority and in-memory scheduler. SQLite acts as the durable log, recording state changes without holding open locks during downloads.
- **State Recovery Rules on Startup**:
  - `completed` → Restored as `completed`.
  - `failed` → Restored as `failed`.
  - `cancelled` → Restored as `cancelled`.
  - `pending` → Restored as `pending` (scheduled FIFO if `autoStartDownloads` is enabled).
  - `downloading` → Reconciled to `failed` with error code `DOWNLOAD_INTERRUPTED` ("Download was interrupted when the application was closed").
  - `processing` → Reconciled to `failed` with error code `POSTPROCESS_INTERRUPTED` ("Post-processing was interrupted when the application was closed; can be retried directly").
  - Parent container jobs aggregate restored child states and recompute completed counts and progress.
- **Direct Retry**: Retrying an interrupted processing job reuses the local `sourcePath` directly without re-downloading.

