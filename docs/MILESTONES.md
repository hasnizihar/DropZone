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
- **Status:** Complete
- **Scope:**
  - Dedicated `FFmpegService` in Python worker managing post-processing subprocesses without blocking the JSON Lines protocol.
  - Executable discovery for FFmpeg and FFprobe across system `PATH`, environment variables (`DROPZONE_FFMPEG_PATH`), and Windows package locations.
  - Audio extraction with codec allowlists:
    - MP3 (`libmp3lame`, 128k–320k)
    - M4A (`aac`, 128k–256k)
    - WAV (`pcm_s16le`)
    - FLAC (`flac`)
    - OPUS (`libopus`, 96k–192k)
  - Video container remuxing with stream copying (`-c copy`) for MP4, MKV, WebM, and MOV to prevent unnecessary transcoding quality loss.
  - Audio and video stream merging (`-map 0:v:0 -map 1:a:0 -c copy`).
  - Metadata embedding (`title`, `artist`, `album`, `date`) and ID3v2 cover art attachment.
  - Safe output pipeline: `Input -> Temporary Output (.tmp.ext) -> FFprobe Verification -> Atomic Rename -> Final Output`.
  - Structured progress tracking parsing `-progress pipe:1` with throttled event dispatch (max 4 events/sec).
  - Cooperative cancellation with Windows process tree termination via `psutil`.
  - QueueManager lifecycle integration:
    - Dedicated `processing` status between download and completion.
    - Preserves source file on disk during processing failure.
    - Direct post-processing retry re-using downloaded source file without redownloading.
    - Cascading cancellation propagating to active FFmpeg subprocesses.
  - UI enhancements:
    - `AnalyzerPage`: Conversion mode tabs (`Original Stream`, `Extract Audio`, `Remux Container`), codec pills, bitrate selectors, metadata/thumbnail embedding checkboxes.
    - `DownloadsPage`: Distinct `PROCESSING` badge, secondary stage progress bar, and dedicated "Retry FX" button.
    - `SettingsPage`: Default audio format, default bitrate, default remux container, source file retention toggle, and FFprobe probe telemetry.
  - Verified acceptance: 52/52 Pytest tests passing, 55/55 Vitest tests passing across 10 test suites, zero TypeScript errors (`tsc --noEmit`), and clean production build.

---

## Milestone 8: Settings Persistence & Download History (SQLite)
- **Status:** Complete (Commit `[M8 Commit]`)
- **Scope:**
  - Dedicated persistence layer in Electron Main utilizing WebAssembly-powered SQLite (`sql.js`).
  - Stored under Electron `app.getPath('userData')/dropzone.db` with safe directory creation and atomic disk commit (`.tmp` -> `fs.renameSync`).
  - Automated versioned schema migrations (`schema_migrations`) applying initial schema v1 transactionally.
  - Foreign key enforcement (`PRAGMA foreign_keys = ON;`) and prepared statement parameterized query safety.
  - Automatic corruption recovery: detects file corruption, creates timestamped backup (`dropzone.db.corrupted.<timestamp>`), and initializes clean database.
  - `SettingsRepository`: durable storage for user preferences (concurrency, directories, audio formats, bitrates, containers, retention) with Zod validation and safe default fallback.
  - "Reset to Defaults" functionality restoring initial state across database and live application.
  - `JobRepository`: durable download history preserving parent-child hierarchies (batch, playlists, image galleries) and post-processing metadata.
  - History query API supporting keyword search, category filtering, status filtering, sorting, and pagination.
  - Authoritative `QueueManager` startup hydration & recovery policy:
    - Reconciles interrupted live downloads (`downloading` -> `failed` with code `DOWNLOAD_INTERRUPTED`).
    - Reconciles interrupted post-processing (`processing` -> `failed` with code `POSTPROCESS_INTERRUPTED`).
    - Enables instant direct retry for interrupted post-processing jobs without re-downloading source files.
    - Recalculates aggregate status and progress for parent containers.
  - Safe file operations: distinguished database record removal from physical file deletion, with safe path checks.
  - UI integration:
    - `HistoryPage`: fully functional table with search, category & status dropdowns, pagination, clear history modal, open file/folder buttons, retry button, record deletion, and physical file deletion.
    - `SettingsPage`: reset to factory defaults button and SQLite persistence telemetry status card.
  - Verified acceptance: 70/70 Vitest tests passing across 12 test suites, 52/52 Pytest tests passing, 0 TypeScript errors on shared & desktop, and clean production build.

---

## Milestone 9: QA & Fault-Tolerance Hardening
- **Status:** Complete (Commit `[Current Commit]`)
- **Scope:**
  - Comprehensive quality assurance, reliability, security, and fault-tolerance hardening pass across all application subsystems.
  - Queue state machine transition guards:
    - Strict status checks preventing invalid pause on terminal states (`completed`, `failed`, `cancelled`).
    - Guard against invalid resume on non-paused jobs (`downloading`, `pending`, `completed`, `failed`).
    - Guard against invalid retry on active jobs; partial container retry re-queuing only failed/cancelled children while preserving completed children.
    - Idempotent safe no-op on duplicate cancellations.
    - Hard concurrency ceiling enforcement (`activeJobIds.size < maxConcurrentDownloads`) under rapid scheduling race conditions.
  - Late worker event shields:
    - Electron Main automatically rejects late progress, completion, failure, or cancellation events arriving after terminal states (`completed`, `cancelled`, `failed`), preventing UI telemetry regression and state corruption.
  - Database persistence serialization & atomic safety:
    - Added `hasPendingSave` flag in `DatabaseManager` to serialize rapid overlapping disk flushes without dropping writes.
    - Added `.tmp` staging file cleanup on failed write or rename error.
  - Network & filesystem error classification in Python worker:
    - Fixed `requests.Response` boolean evaluation bug in `direct_http_service` and `direct_stream_engine` (`if last_response is None:` instead of `if not last_response:`).
    - Mapped HTTP 429 to `ProtocolErrorCode.RATE_LIMITED`, HTTP 401/403 to `ProtocolErrorCode.AUTH_REQUIRED`, HTTP 500–504 to `ProtocolErrorCode.NETWORK_ERROR`.
    - Mapped disk full and write `OSError` to `ProtocolErrorCode.FILE_WRITE_ERROR`.
  - SSRF & redirect security regression verification:
    - Blocked redirect to cloud metadata (`169.254.169.254`, `fd00:ec2::254`).
    - Blocked redirect to localhost / private RFC 1918 IPs (`127.0.0.1`, `10.0.0.1`, `192.168.1.1`).
    - Blocked insecure HTTPS-to-HTTP protocol downgrades and redirect loops (> 5 hops).
  - Subprocess & path resolution hardening:
    - Multi-level parent directory candidate search for Python worker root and executable on Windows.
    - Graceful process tree termination and PSUtil cleanup.
  - Electron runtime smoke testing:
    - Automated runtime smoke test script (`scripts/smoke-test.cjs` / `npm run smoke:electron`) verifying that Electron main, SQLite database, Settings, History, and Python Worker launch, connect, and shut down cleanly with exit code 0.
  - Verified acceptance: 56/56 Pytest tests passing, 83/83 Vitest tests passing across 13 test files, 0 TypeScript errors, clean production bundle, and verified Electron runtime smoke test.

---

## Milestone 10: Packaging & Windows Distribution
- **Status:** Complete (2026-11-13)
- **Scope:**
  - Automated production packaging via `electron-builder` producing both a Windows NSIS installer and a zero-install portable Windows package.
  - Built standalone Python worker executable (`dropzone-worker.exe`, 29.57 MB) utilizing PyInstaller with dynamic package metadata collection for `yt-dlp`, `gallery-dl`, `requests`, `psutil`, `pydantic`, eliminating any global Python interpreter dependency on the user's PC.
  - Generated multi-resolution Windows application assets (`icon.ico` and `icon.png` in 16x16 through 256x256) aligned with DROPZONE design tokens (Near Black `#121417`, Acid Lime `#D4FF5C`, Warm Off-White `#F5F3EF`, Graphite Grey `#282C35`).
  - Runtime worker executable resolution in `WorkerProcess.ts` discovering packaged `dropzone-worker.exe` in `process.resourcesPath` while preserving development python scripts.
  - Windows Application Control (Smart App Control / WDAC) idempotency patch (`scripts/patch-electron-builder.cjs`) allowing NSIS uninstaller generation via binary parsing (`UninstallerReader.exec`) without requiring unsigned execution.
  - Evidence-based external FFmpeg distribution policy with clear missing-dependency states, runtime detection, and configuration overrides.
  - Packaged runtime smoke tests (`scripts/smoke-test-packaged.cjs` / `npm run smoke:packaged`) validating main process boot, SQLite initialization, settings load, standalone worker protocol handshake, and clean shutdown.
  - Third-party licensing audit and comprehensive `THIRD_PARTY_NOTICES.md` covering Electron, Chromium, Node.js, Python, yt-dlp, gallery-dl, requests, psutil, sql.js, and FFmpeg.
  - Verified SHA-256 checksums in `release/SHA256SUMS.txt`.
  - Verified acceptance: 56/56 Pytest tests passing, 83/83 Vitest tests passing across 13 test files, zero TypeScript errors across all workspaces, clean production build, and verified packaged application smoke test.

---

## Milestone 11: Open-Source Identity, MIT Licensing & Windows Publisher Configuration
- **Status:** Complete (2026-11-13)
- **Scope:**
  - Established formal MIT open-source license with `LICENSE` file under copyright of `Hz Creatives (KR Hasni Zihar)`.
  - Configured consistent publisher and author identity across all package metadata (`package.json`, `apps/desktop/package.json`, `packages/shared/package.json`, and `pyproject.toml`).
  - Added Windows publisher metadata (`publisherName: "Hz Creatives"`, `legalTrademarks`) in `electron-builder.yml`.
  - Prepared Authenticode code-signing configuration supporting environment variables (`CSC_LINK`, `CSC_NAME`, `CSC_KEY_PASSWORD`) without committing secrets or breaking unsigned builds.
  - Documented Windows trust layers, Smart App Control (SAC) architecture, and code-signing instructions in `docs/WINDOWS_SIGNING_GUIDE.md`.
  - Created open-source repository governance templates: `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, and `.github/PULL_REQUEST_TEMPLATE.md`.
  - Updated `README.md` with explicit MIT license terms, third-party companion license notices, and ethical use boundaries.
  - Updated `AboutPage.tsx` to surface publisher attribution and MIT license details.
  - Re-verified all test suites (Pytest, Vitest, TypeScript, production builds, and smoke tests).

---

## Milestone 12: Final Release Audit & Public Launch Readiness
- **Status:** Complete (2026-11-13)
- **Scope:**
  - Conducted comprehensive, evidence-based quality audit of DROPZONE across repository, source code, packaging, legal attribution, and release readiness.
  - Resolved version synchronization mismatch, aligning workspace descriptors to unified release version `1.0.0-alpha.11` across root `package.json`, `apps/desktop/package.json`, and `packages/shared/package.json`.
  - Cleaned repository structure by removing dead placeholder directory `packages/database`, standardizing all SQLite persistence in `apps/desktop/electron/database/`.
  - Rewrote user-first `README.md` with official identity, prominent Windows download table, features overview, 3-step walkthrough, accurate project architecture diagram, external FFmpeg installation guide (`winget install Gyan.FFmpeg`), SmartScreen/SAC explanation, and eliminated broken local `file:///` links with valid relative markdown links.
  - Created `docs/SCREENSHOTS.md` with official visual capture specifications and 6 core view checklists.
  - Created `.github/workflows/ci.yml` establishing multi-job CI pipeline on Windows (Python 3.12 pytest, Node 22 typecheck & Vitest tests, and production build verification).
  - Created `docs/RELEASE_CHECKSUMS.md` documenting official SHA-256 cryptographic hashes for verifiable releases.
  - Re-verified third-party GPL/MIT license compatibility: verified bundled `gallery-dl` compliance via source distribution under `backend/worker/` and attribution in `THIRD_PARTY_NOTICES.md`.
  - Rebuilt packaged Windows distribution artifacts (`DROPZONE-Setup-1.0.0-alpha.11-x64.exe` and `DROPZONE-Portable-1.0.0-alpha.11-x64.exe`).
  - Executed full verification suite: 56/56 Python tests passing, 83/83 Vitest tests passing, clean TypeScript checks, successful Electron runtime smoke test, and packaged application smoke test.
  - Created authoritative release audit report `Plan/p1.0.12-final-audit.md` declaring official verdict: `READY FOR PUBLIC ALPHA`.
