# Changelog

All notable changes to the DROPZONE project will be documented in this file.

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

