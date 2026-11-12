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
|   |  - Batch Process  |  |   - User Settings             |  |
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
|                  | Worker Subprocess Mgr |                  |
|                  | - Heartbeat Ping/Pong |                  |
|                  | - Stdin/Stdout JSONL  |                  |
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
|         |                   |                    |          |
|         v                   v                    v          |
|  +---------------+  +-----------------+  +---------------+  |
|  | yt-dlp Engine |  | Direct HTTP Strm|  | FFmpeg Engine |  |
|  |  (Media & PL) |  | (Chunked/Resume)|  | (Mux/Convert) |  |
|  +---------------+  +-----------------+  +---------------+  |
+-------------------------------------------------------------+
```

---

## 2. Layer Definitions

### Layer A: Renderer (React + TypeScript + Vite + Tailwind)
- Runs in a fully sandboxed Chromium process (`nodeIntegration: false`, `contextIsolation: true`).
- Does not have direct filesystem or OS access.
- Interacts strictly through `window.dropzone` typed bridge.
- Uses Zustand stores for reactive queue updates and metrics streaming.

### Layer B: Main Process (Electron)
- Orchestrates window lifecycle, native dialogs, shell file execution, and tray.
- Validates all incoming IPC calls with strict runtime schemas.
- Manages the lifecycle of the Python background worker.

### Layer C: Download Queue & State Machine
- Manages job states:
  - `pending` -> `analyzing` -> `ready` -> `downloading` -> `completed`
  - Side branches: `paused`, `cancelled`, `failed`
- Enforces user-configured concurrency (default: 3 concurrent jobs).
- Computes aggregated download speed, total downloaded bytes, and time estimates.

### Layer D: Python Worker Subprocess
- Decouples long-running media extraction and streaming downloads from the UI.
- Communicates via newline-delimited JSON (JSON Lines) over `stdin` and `stdout`.
- Stderr is dedicated to diagnostic logging and does not pollute the IPC stream.
- Crashes in the Python worker are detected via heartbeat pings and automatically recovered.

### Layer E: Storage Layer
- Local SQLite database persists download history, queue metadata, engine versions, and user preferences across application reboots.

---

## 3. Security Boundary
- Preload script uses `contextBridge.exposeInMainWorld` to expose only safe, explicit methods.
- URLs submitted to the analyzer are validated against known protocols (http, https).
- Target file paths are sanitized to prevent directory traversal attacks (`..`).
