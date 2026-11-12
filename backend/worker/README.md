# DROPZONE Worker Engine

The background Python worker process for the DROPZONE Universal Desktop Download Manager. Communicates with Electron via JSON Lines (JSONL) protocol over `stdin`/`stdout`.

---

## Architecture Overview

```
Electron Main Process
       │  stdin  (JSONL Requests)
       ▼
dropzone_worker
  ├── Core (Dispatcher, Health, Lifecycle)
  ├── Engines (YtDlpEngine)
  ├── Services (UrlValidator, MetadataNormalizer, FormatNormalizer, MediaAnalyzerService)
  ├── Protocol (Models, Parser, Serializer, Errors)
  └── Utils (Logging configuration)
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
| `analyze_url` | Non-blocking media inspection with yt-dlp | `{"url": "https://..."}` |
| `start_download` | Executes video/audio download via yt-dlp | `{"jobId": "...", "url": "...", "targetDirectory": "..."}` |
| `cancel_download` | Aborts active download for job | `{"jobId": "..."}` |
| `pause_download` | Cooperatively pauses active download | `{"jobId": "..."}` |

---

## Events Emitted

- `worker.ready`: Emitted immediately upon process initialization.
- `worker.shutting_down`: Emitted prior to process exit.
- `worker.status`: Telemetry updates.
- `worker.error`: Error notifications.
- `analysis.started`: Fired when a media analysis worker thread starts.
- `analysis.completed`: Fired upon successful format & metadata extraction.
- `analysis.failed`: Fired on validation or extraction failure.
- `download.started`: Fired when a download task begins executing.
- `download.progress`: Real-time download progress (percentage, bytes, speed, ETA).
- `download.completed`: Fired on successful file download and postprocessing.
- `download.failed`: Fired on download failure or network exception.
- `download.cancelled`: Fired when a download is cancelled by user.
- `download.paused`: Fired when a download is cooperatively paused.

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

