# Changelog

All notable changes to the DROPZONE project will be documented in this file.

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

