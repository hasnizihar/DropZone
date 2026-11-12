# DROPZONE: Implementation Milestones

This document tracks progress through the 10 core milestones defined in the DROPZONE Master Development Plan.

---

## Milestone 1: Project Foundation
- **Status:** Completed (2026-11-12)
- **Scope:**
  - Inspect development environment & tools (Node.js 24, Python 3.12, FFmpeg 9.0.2, yt-dlp 2026.10.26).
  - Initialize Git repository and workspace structure (`apps/desktop`, `packages/shared`, `backend/worker`).
  - Configure Electron 34, React 18, TypeScript 5.7, Vite 6, and Tailwind CSS.
  - Establish DROPZONE design tokens (Near Black `#121417`, Warm Off-White `#F5F3EF`, Acid Lime `#D4FF5C`, Graphite Grey `#858B93`).
  - Implement full application navigation shell: Dashboard, URL Analyzer, Downloads queue, Batch processing, History archive, Settings, and About views.
  - Implement secure IPC layer (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, typed preload).
  - Add development and build scripts.
  - Verified acceptance: Full TypeScript typecheck passed (`tsc --noEmit`), automated test suite passed (3 test suites, 8 unit/UI tests in Vitest), production build generated, and smoke launch succeeded with Electron.

---

## Milestone 2: Worker Foundation & JSON Lines Protocol
- **Status:** Completed (2026-11-12)
- **Scope:**
  - Implemented modular Python background worker in `backend/worker/src/dropzone_worker/` with `bootstrap.py`, `__main__.py`, protocol models, parser, serializer, command dispatcher (`hello`, `ping`, `get_status`, `shutdown`), and isolated stderr logging.
  - Defined strongly-typed TypeScript protocol contracts and Zod schemas in `packages/shared/src/protocol/`.
  - Implemented Electron `WorkerManager`, `WorkerProcess`, `WorkerHealthMonitor`, and streaming JSON Lines parser with request/response correlation, heartbeat ping/pong (5s interval, 3s timeout), and automatic crash recovery with exponential backoff (max 3 restarts).
  - Wired worker lifecycle and telemetry into Electron main process, secure preload IPC bridge, Zustand state store, and Settings / Sidebar UI with manual worker restart action.
  - Verified acceptance: 13/13 Pytest tests passing, 18/18 Vitest tests passing (including full integration test spawning the Python subprocess), clean TypeScript typecheck across all workspaces, production build, and Electron startup smoke test.

---

## Milestone 3: Media Extraction
- **Status:** Completed (2026-11-12)
- **Scope:**
  - Integrated `yt-dlp` Python library into background worker with `YoutubeDL(download=False)` and isolated stderr logger (`YtDlpStderrLogger`).
  - Implemented URL security boundary (`url_validator.py`): enforces HTTP/HTTPS schemes, blocks loopback/private IPs (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`).
  - Built normalization services: `metadata_normalizer.py` (title, platform, uploader, upload date, duration, views/likes, thumbnails) and `format_normalizer.py` (resolution, codecs, container, exact vs estimated size separation, sorting).
  - Implemented non-blocking worker execution using bounded thread pool (`ThreadPoolExecutor(max_workers=2)`) emitting `analysis.started`, `analysis.completed`, `analysis.failed` events without blocking heartbeat ping/pong.
  - Extended shared TypeScript contracts (`metadata.ts`, `formats.ts`, `analysis.ts`, `commands.ts`, `events.ts`) and Zod validation schemas.
  - Wired real metadata and format discovery into Electron IPC (`ANALYZER_INSPECT`), Zustand store (`useAppStore`), `AnalyzerPage` (format filter tabs, exact/estimated size badges, codec tags), and `DashboardPage`.
  - Verified acceptance: 22/22 Pytest tests passing, 27/27 Vitest tests passing (including WorkerManager security loopback rejection integration test), clean TypeScript compilation (`tsc --noEmit`), and production build.

---

## Milestone 4: Core Downloads & Queue Management
- **Status:** Completed (2026-11-12)
- **Scope:**
  - Implemented authoritative `QueueManager` in Electron Main as single source of truth for queue ordering, state machine, dynamic concurrency limits (`maxConcurrentDownloads`), and lifecycle events.
  - Implemented download state machine (`pending` -> `downloading` -> `completed` / `failed` / `cancelled` / `paused`), pause/resume cooperative mechanics, retry logic, and remove/clear completed.
  - Built `DownloadService` in Python worker utilizing `yt-dlp` in execution mode (`download=True`), Windows filename sanitization, path traversal defensive checks, and cooperative `threading.Event` cancellation.
  - Implemented throttled real-time progress events (`download.progress`) reporting percentage, downloaded/total bytes, speed bytes/sec, and ETA.
  - Extended shared protocol contracts (`start_download`, `cancel_download`, `pause_download`, and corresponding events) with Zod validation schemas.
  - Integrated `AnalyzerPage` ("Start Download" and "Add to Queue") and `DownloadsPage` with live progress bars, speed counters, status badges, and action controls.
  - In accordance with architecture guidelines, SQLite persistence is deferred to Milestone 8.
  - Verified acceptance: 26/26 Pytest tests passing, 34/34 Vitest tests passing across 7 suites (including full QueueManager state machine tests and worker integration tests), zero TypeScript compilation errors, and successful production build.

---

## Milestone 5: Direct Files & Image Downloader
- **Status:** Complete
- **Scope:**
  - Direct HTTP/HTTPS streaming engine using chunked transfer (64 KB chunks).
  - HTTP Range header support (`bytes=START-`) and `If-Range` validation for safe resume into `.part` files.
  - Sidecar `.part.meta.json` transfer metadata verification to prevent corruption across modified resources.
  - Comprehensive filename extraction (RFC 6266 / RFC 5987 UTF-8 `filename*`, path fallback, MIME fallback) and Windows reserved name protection.
  - SSRF protection: loopback, private IPv4/IPv6, link-local, cloud metadata IP, and DNS rebinding protection via `getaddrinfo`.
  - Secure redirect validation preventing loops, protocol downgrades, and redirect-based SSRF.
  - Single and bulk image extraction / gallery handling via `gallery-dl` with bounded extraction limits (max 50 items).
  - Authoritative QueueManager integration: gallery parent jobs manage child asset jobs under the single concurrency limit (FIFO, max slots: 3).
  - Real-time pause/resume/cancel controls and UI badges (`MEDIA`, `FILE`, `IMAGE`, `GALLERY`) in `AnalyzerPage` and `DownloadsPage`.
  - Verified acceptance: 41/41 Pytest tests passing, 37/37 Vitest tests passing across 7 suites, zero TypeScript errors (`tsc --noEmit`), and clean production build.

---

## Milestone 6: Playlist & Batch Processing
- **Status:** Complete
- **Scope:**
  - Dedicated bounded playlist inspection (max 200 items, `extract_flat=True`, `playlistend`) without downloading media.
  - Playlist metadata normalization (`id`, `title`, `url`, `source`, `totalCount`, `extractedCount`, `isTruncated`, `warnings`, `entries`).
  - Handling of unavailable, deleted, or private videos (`isAvailable: false`, `selected: false`) without bypass attempts.
  - Multi-URL batch parsing (`batchParser.ts`) with robust whitespace normalization, prose stripping, deduplication, and max 50 URLs bounding with excess reporting.
  - Independent batch URL analysis across all supported types (`media`, `file`, `image`, `gallery`, `playlist`) with individual status tracking (`pending`, `analyzing`, `ready`, `unsupported`, `failed`).
  - Unified `QueueManager` parent-child container architecture for playlists and batches (`engine: 'playlist' | 'batch'`):
    - Parent container jobs do not consume active download slots (`maxConcurrentDownloads: 3`).
    - Individual child jobs compete fairly under the authoritative concurrency scheduler.
    - Deterministic filename collision resolution preventing overwrite conflicts.
    - Partial failure tracking (`isPartialFailure: true`, `PARTIAL_FAILURE`).
    - Partial retry: Retrying a parent re-queues only failed/cancelled children, preserving completed items.
    - Cascading cancellation and removal preventing orphaned jobs.
  - React UI:
    - `AnalyzerPage`: Playlist entry selection panel with Select All / Deselect All, truncation warning, and `PLAYLIST` badge.
    - `BatchPage`: Complete batch review workflow with text/file ingestion, multi-type badges, individual retry, remove, and enqueue controls.
    - `DownloadsPage`: `PLAYLIST` and `BATCH` badges, partial failure indicators, and live retry controls.
  - Verified acceptance: 45/45 Pytest tests passing, 49/49 Vitest tests passing across 9 suites, zero TypeScript errors (`tsc --noEmit`), and clean production build.

---

## Milestone 7: FFmpeg & Audio Post-Processing
- **Status:** Pending
- **Scope:**
  - FFmpeg integration for post-processing.
  - Audio extraction to MP3, M4A, WAV, FLAC.
  - Video stream and audio stream merging.
  - Codec validation and clean error handling.

---

## Milestone 8: Settings & Polish
- **Status:** Pending
- **Scope:**
  - Persistent application settings (storage directory, speed limits, network timeouts).
  - History view with search, filter, direct file reveal, re-download.
  - Keyboard shortcuts and accessibility.
  - Toast notifications and system notifications.

---

## Milestone 9: Quality Assurance & Hardening
- **Status:** Pending
- **Scope:**
  - Automated test execution across frontend (`vitest`) and backend (`pytest`).
  - Worker crash recovery simulation.
  - Edge case handling (offline, slow connection, invalid URLs, path traversal protection).

---

## Milestone 10: Packaging & Distribution
- **Status:** Pending
- **Scope:**
  - Packaging with `electron-builder`.
  - Windows NSIS installer and portable `.exe`.
  - Binary bundling verification and release documentation.
