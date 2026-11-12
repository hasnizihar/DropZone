# Changelog

All notable changes to the DROPZONE project will be documented in this file.

## [1.0.0-alpha.8] - 2026-11-13

### Added
- **Local-First SQLite Persistence Engine**: Implemented `DatabaseManager` in Electron Main utilizing WebAssembly-powered SQLite (`sql.js`), eliminating native C++ `.node` compilation and Windows Application Control / WDAC DLL execution blocks.
- **Isolated User Storage Location**: Database securely placed at `app.getPath('userData')/dropzone.db` with safe directory initialization, debounced flushing, and atomic disk commits (`.tmp` -> `fs.renameSync`).
- **Versioned Schema & Migrations**: Automated versioned migration framework (`schema_migrations`) creating `settings` and `download_jobs` tables with performance indexes and foreign key enforcement (`PRAGMA foreign_keys = ON;`).
- **Database Corruption Auto-Recovery**: Integrated startup integrity probing (`PRAGMA integrity_check;`) that safely backs up corrupted files (`dropzone.db.corrupted.<timestamp>`) and initializes clean storage without crashing.
- **Persistent Application Settings**: Implemented `SettingsRepository` persisting user preferences (concurrency, directories, audio formats, bitrates, containers, retention) across application restarts with Zod validation.
- **Reset to Factory Defaults**: Added `settings:reset` IPC operation and UI button to reset preferences to verified defaults.
- **Durable Download History**: Implemented `JobRepository` with pagination, keyword search, category filtering, and status filtering preserving parent-child container hierarchies and post-processing metadata.
- **Authoritative Startup Hydration & Recovery Policy**:
  - `QueueManager` restores completed, failed, and cancelled jobs in durable state.
  - In-flight downloads are marked failed with `DOWNLOAD_INTERRUPTED` on startup.
  - In-flight post-processing is marked failed with `POSTPROCESS_INTERRUPTED` on startup, allowing direct retry from cached source.
  - Parent container jobs recalculate aggregate progress and counts from restored child states.
- **Safe Physical File Operations**: Strictly segregated database record removal from physical file deletion, requiring explicit user confirmation before unlinking files.
- **UI Enhancements**:
  - `HistoryPage`: Upgraded with search input, category filter dropdown, status filter dropdown, pagination controls, clear history modal, open file/folder buttons, retry action, and file deletion modal.
  - `SettingsPage`: Added "Reset to Defaults" button and SQLite database status card.
- **Comprehensive Test Suites**: Added 11 database tests (`sqliteDatabase.test.ts`) and 4 queue hydration tests (`queueHydration.test.ts`), bringing Vitest tests to 70 across 12 test files (plus 52 Pytest tests passing).

### Added
- **Dedicated FFmpeg Post-Processing Service**: Implemented `FFmpegService` in Python worker providing non-blocking post-processing via subprocess worker threads without saturating stdout protocol JSONL messages.
- **Audio Extraction with Codec Allowlists**: Support for extracting audio tracks to MP3 (`libmp3lame`, 128k–320k), M4A (`aac`, 128k–256k), WAV (`pcm_s16le`), FLAC (`flac`), and OPUS (`libopus`, 96k–192k) with selectable bitrates.
- **Lossless Stream Remuxing & Merging**: Video remuxing for MP4, MKV, WebM, and MOV containers prioritizing stream copying (`-c copy`) to avoid transcoding quality loss; merging separate video and audio tracks into single synchronized containers.
- **Metadata & Album Art Embedding**: Embedded audio tags (`title`, `artist`, `album`, `date`) and ID3v2/FLAC album art cover attachments.
- **Safe Atomic Output Workflow**: Two-phase output writing to temporary files (`.tmp.ext`), followed by FFprobe stream verification, and atomic commit via `os.replace` preventing corrupted target files.
- **Throttled Structured Progress**: Parsed FFmpeg `-progress pipe:1` reporting percentage, processing speed, out time, and active stage with 250ms throttling.
- **Cooperative Cancellation & Tree Termination**: Process cancellation using `psutil` terminating child process trees cleanly on Windows to prevent orphaned encoding tasks.
- **Authoritative Queue Integration & Direct Retry**: Seamless `processing` status managed in `QueueManager`; failed post-processing retains downloaded source on disk and allows immediate "Retry FX" without re-downloading.
- **UI Enhancements**:
  - `AnalyzerPage`: Added conversion tabs (`Original Stream`, `Extract Audio`, `Remux Container`), codec selector pills, bitrate options, and metadata embedding checkboxes.
  - `DownloadsPage`: Added distinct `PROCESSING` status badge, secondary progress bar, and "Retry FX" button.
  - `SettingsPage`: Post-processing defaults for audio format, bitrate, remux container, source retention toggle, and live FFprobe probe telemetry.
- **Comprehensive Test Suite**: Added 7 new Python tests (52 total) and 6 new Vitest tests (55 total across 10 test files) validating executable discovery, codec allowlists, argument construction, atomic output commits, queue transitions, and direct retry.

## [1.0.0-alpha.6] - 2026-11-12

### Added
- **Dedicated Bounded Playlist Inspection**: Implemented `PlaylistService` using `yt-dlp` with `extract_flat=True` and bounded extraction (`playlistend: 200`) without downloading media, normalizing entries, handling deleted/private items, and reporting truncation warnings.
- **Multi-URL Batch Ingestion & Parsing**: Added `batchParser.ts` for text paste and `.txt`/`.csv` file imports, robustly extracting URLs from mixed prose, commas, and newlines, deduplicating, and bounding to 50 URLs with excess count notifications.
- **Independent Parallel Batch Analysis**: Added `BATCH_INSPECT_MULTIPLE` workflow analyzing mixed media, file, image, gallery, and playlist URLs in parallel with individual statuses (`pending`, `analyzing`, `ready`, `unsupported`, `failed`).
- **Parent-Child Container Queue Architecture**: Extended `QueueManager` with non-blocking container jobs (`'playlist'`, `'batch'`) that manage child downloads without occupying concurrency slots (`maxConcurrentDownloads: 3`).
- **Deterministic Collision Resolution**: Implemented `resolveUniqueFilename` preventing file overwrite collisions across multi-item batch and playlist downloads.
- **Partial Failure & Partial Retry**: Added comprehensive partial failure tracking (`isPartialFailure: true`) where retrying a parent job re-queues only failed/cancelled children while preserving completed downloads.
- **Cascading Lifecycle Controls**: Cascading cancellation and removal for playlist and batch container jobs, ensuring clean resource cleanup with zero orphaned tasks.
- **Batch & Playlist UI**: Overhauled `BatchPage` with import dropzone/paste area, live item counters, mixed-type badges, per-item retry/remove controls, and destination folder selector; updated `AnalyzerPage` with playlist entry selection table; added playlist/batch badges to `DownloadsPage`.
- **Comprehensive Test Suite**: Added 4 new Pytest tests (45 total) and 12 new Vitest tests (49 total across 9 test files) verifying playlist parsing, bounded inspection, batch URL extraction, queue scheduling, partial retry, and UI rendering.

## [1.0.0-alpha.5] - 2026-11-12

### Added
- **Direct HTTP/HTTPS Chunked Streaming Engine**: Built `DirectStreamEngine` in Python worker streaming data in 64 KB chunks without loading full files into memory, writing incrementally to temporary `.part` files.
- **Resumable HTTP Range Requests**: Full support for HTTP `Range: bytes=START-` and `If-Range` headers with `206 Partial Content` append mode, `200 OK` safe reset on ignored ranges, and `416 Range Not Satisfiable` completed-file detection.
- **Transfer Sidecar Metadata**: Automatically records `.part.meta.json` tracking source URL, ETag, and Last-Modified to prevent corruption across altered remote files.
- **Image & Gallery Extraction**: Integrated `GalleryService` using `gallery_dl` with bounded results (max 50 items) and direct image inspection (`IMAGE_EXTENSIONS` and `image/*` MIME type).
- **SSRF & DNS Rebinding Defenses**: Enhanced `UrlValidator` with pre-flight DNS resolution verification (`socket.getaddrinfo`), blocking private/loopback/link-local IPv4/IPv6 addresses, cloud metadata endpoints (`169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`), and embedded credentials.
- **Redirect Security**: Validates all intermediate HTTP redirect targets (up to 5 hops) against SSRF rules and blocks insecure HTTPS-to-HTTP protocol downgrades.
- **Windows File Safety**: Protected against Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and path traversal sequences.
- **QueueManager Gallery Integration**: Seamless parent-child job architecture for multi-asset galleries; child jobs execute independently within the authoritative FIFO concurrency scheduler (`maxConcurrentDownloads: 3`).
- **UI & Discovery Enhancements**: Updated `AnalyzerPage` with distinct `MEDIA`, `FILE`, `IMAGE`, `GALLERY` badges, resumability indicators, image asset grid with select/deselect controls, and updated `DownloadsPage` with live Resume controls.
- **Comprehensive Test Suite**: Added 15 new Python tests (41 total) and 3 new Vitest tests (37 total) covering chunked streaming, range resumption, pause/cancellation, SSRF defenses, and gallery scheduling.

## [1.0.0-alpha.4] - 2026-11-12

### Added
- **Core Downloads Execution Engine**: Implemented `DownloadService` in Python worker powered by `yt-dlp` in execution mode (`download=True`) with audio extraction post-processing (`FFmpegExtractAudio`).
- **Authoritative QueueManager**: Built centralized `QueueManager` in Electron Main enforcing FIFO scheduling, dynamic concurrency limits (`maxConcurrentDownloads`), and complete state machine transitions (`pending`, `downloading`, `paused`, `completed`, `failed`, `cancelled`).
- **Cooperative Cancellation & Pause**: Integrated thread-safe cancellation tokens (`threading.Event`) inside yt-dlp progress hooks for instantaneous cancellation and safe pause reserving `.part` files.
- **Throttled Live Progress Telemetry**: Throttled progress event dispatching (max 4 events/sec per job) reporting percentage, downloaded/total bytes, speed bytes/sec, and ETA.
- **Protocol Extension**: Extended protocol commands (`start_download`, `cancel_download`, `pause_download`) and events (`download.started`, `download.progress`, `download.completed`, `download.failed`, `download.cancelled`, `download.paused`) with Zod validation.
- **Downloads UI & Analyzer Wiring**: Connected "Start Download" and "Add to Queue" actions in `AnalyzerPage` to live queue execution, and connected `DownloadsPage` with live progress bars, pause/resume/cancel controls, and speed counters.
- **Comprehensive Testing**: Added 4 new Python unit tests (26 total) and 7 new Vitest tests (34 total) covering QueueManager scheduling, concurrency bounds, pause/resume/retry lifecycle, and worker integration.

## [1.0.0-alpha.3] - 2026-11-12

### Added
- **yt-dlp Media Extraction Engine**: Integrated Python `yt-dlp` library with `YoutubeDL(download=False)` and isolated stderr logger (`YtDlpStderrLogger`) to guarantee stdout protocol purity.
- **URL Security Boundary**: Implemented defensive URL validator blocking local/loopback and private IPv4/IPv6 ranges (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`) and non-HTTP/HTTPS protocols.
- **Metadata & Format Normalizers**: Robust conversion of raw extractor metadata to strict `MediaMetadata` and `MediaFormat` models, distinguishing exact (`fileSizeBytes`) from estimated (`estimatedFileSizeBytes`) sizes.
- **Non-Blocking Dispatcher**: Added bounded `ThreadPoolExecutor(max_workers=2)` in worker dispatcher emitting asynchronous `analysis.started`, `analysis.completed`, and `analysis.failed` events without blocking heartbeat keepalives.
- **WorkerManager Analyzer API**: Added `workerManager.analyzeUrl(url, timeoutMs)` and wired `IPC_CHANNELS.ANALYZER_INSPECT` to live Python worker extraction.
- **URL Analyzer & Dashboard UI Integration**: Replaced static presets with live metadata cards (thumbnails, uploader, upload date, view count, duration) and interactive format selectors with filter tabs (`All`, `Combined`, `Video`, `Audio`).
- **Comprehensive Test Suite**: Added 9 new Python unit tests (22 total) and 9 new TypeScript/React tests (27 total) covering contracts, Zod schemas, URL validation, and full Electron-to-worker loopback rejection integration.

## [1.0.0-alpha.2] - 2026-11-12

### Added
- **Python Worker Subprocess**: Created modular `dropzone_worker` package with bootstrap, command dispatcher, and lifecycle management.
- **Bidirectional JSON Lines Protocol**: Built protocol v1.0 over stdin/stdout with request/response correlation, unique IDs, and structured error reporting.
- **Worker Health & Heartbeat**: Implemented keepalive ping/pong monitor (5s interval, 3s timeout) with automatic degraded/unhealthy status detection.
- **Crash Recovery**: Added automatic crash detection and controlled restart with exponential backoff (max 3 restarts).
- **TypeScript Contracts & Zod Schemas**: Strongly-typed protocol definitions in `@dropzone/shared`.
- **UI Integration**: Real-time worker telemetry in Settings and Sidebar with manual restart capability.
- **Pytest & Integration Tests**: Added 13 Pytest tests and full Electron-to-Python stdio Vitest integration tests.

## [1.0.0-alpha.1] - 2026-11-12

### Added
- **Monorepo Architecture**: Initialized npm workspace containing `apps/desktop` and `packages/shared`.
- **Design System & Tokens**: Integrated Near Black (`#121417`), Warm Off-White (`#F5F3EF`), Acid Lime (`#D4FF5C`), and Graphite Grey (`#858B93`).
- **Application Shell**: Complete desktop interface featuring Dashboard, URL Analyzer, Downloads queue, Batch downloader, History, Settings, and About views.
- **Secure IPC Layer**: Strict Electron context isolation and typed IPC contract bridge.
- **Comprehensive Documentation**: Complete architecture, testing, roadmap, and security guides.

