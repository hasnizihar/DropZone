# DROPZONE

**Universal Desktop Download Manager**

DROPZONE is a high-performance, modular desktop application designed for downloading, managing, and converting media and files from a wide range of online sources. Engineered with a Windows-first architecture, a dark minimalist aesthetic, and robust error recovery, DROPZONE integrates state-of-the-art download engines under a unified interface.

---

## Key Features

- **Universal Media Engine**: Integrates `yt-dlp` and dedicated HTTP streaming engines with automatic provider detection.
- **Deep Format Inspection**: Inspect any media URL to extract available resolutions, video bitrates, audio codecs, and file sizes.
- **Direct & Gallery Extraction**: High-throughput direct HTTP/HTTPS streaming with pause/resume support, chunked transfers, and image gallery bulk extraction.
- **Playlist & Batch Processing**: Bounded inspection of media playlists (up to 200 items) and multi-URL batch ingestion (up to 50 URLs via paste or text/csv upload) with independent parallel analysis, parent-child queue architecture, selective item downloading, and partial failure retry.
- **Queue & Concurrency Management**: Authoritative job state machine (`pending`, `analyzing`, `ready`, `downloading`, `paused`, `completed`, `failed`, `cancelled`) with configurable concurrency (default: 3).
- **FFmpeg Post-Processing & Audio Extraction**: Audio extraction (MP3, M4A, WAV, FLAC, OPUS) with selectable bitrates, video remuxing (MP4, MKV, WebM, MOV) with stream copying, audio/video stream merging, metadata tagging, and cover art embedding.
- **SQLite Settings & Download History**: Durable local-first SQLite persistence (`dropzone.db`) via WebAssembly, versioned migrations, startup queue hydration & crash recovery, preferences persistence with factory reset, and searchable, filterable, paginated download history.
- **Hardened Fault-Tolerance & Reliability**: Terminal state idempotency, late worker event shields, concurrent database save serialization, network error normalization, and SSRF/redirect defense regression verification.
- **Local-First & Secure**: Strict Electron sandboxing, context isolation, zero remote telemetry, local SQLite persistence, and path traversal protection.

---

## Design System & Brand Identity

DROPZONE is built with a restrained, high-contrast dark aesthetic:
- **Near Black** (`#121417` - 45%): Core application background and deep surface layers.
- **Warm Off-White** (`#F5F3EF` - 35%): High-readability headings, active text, and high-contrast data readouts.
- **Acid Lime** (`#D4FF5C` - 15%): Primary action buttons, active navigation markers, download progress indicators, and selected states.
- **Graphite Grey** (`#858B93` - 5%): Subtle borders, secondary labels, and neutral status indicators.

---

## Project Structure

```
dropzone/
├── apps/
│   └── desktop/            # Electron + React + Vite + Tailwind desktop application
│       ├── electron/       # Main process, secure preload, and IPC channels
│       └── src/            # React UI, Zustand state stores, layout, and pages
├── packages/
│   ├── shared/             # Domain types, Zod schemas, IPC contracts
│   └── database/           # SQLite persistence layer and migrations
├── backend/
│   ├── worker/             # Python 3 worker with JSON Lines protocol
│   └── tests/              # Pytest suite for worker & engines
├── docs/                   # Architectural specs, milestones, test records
└── README.md
```

---

## Quick Start (Development)

### Prerequisites
- Node.js >= 20
- Python >= 3.10
- FFmpeg (on PATH or packaged)

### Installation
```bash
# Install Node dependencies
npm install

# Run the desktop application in development mode
npm run dev
```

---

## Testing

```bash
# Run Vitest unit, state machine, and fault-tolerance tests
npm test

# Run Python worker & network fault-injection tests
npm run test:python

# Run Electron runtime smoke test
npm run smoke:electron

# Run Packaged application smoke test
npm run smoke:packaged
```

---

## Windows Release & Distribution

### Release Artifacts
DROPZONE v1.0.0-alpha.10 provides two Windows distribution packages:
1. **NSIS Installer (`DROPZONE-Setup-1.0.0-alpha.10-x64.exe`)**:
   - Standard setup wizard with custom directory selection.
   - Start Menu and Desktop shortcuts.
   - Preserves user settings, SQLite database, and downloads during updates and uninstall.
2. **Portable Executable (`DROPZONE-Portable-1.0.0-alpha.10-x64.exe`)**:
   - Single-file zero-install executable.
   - Requires no administrator privileges.
   - Preserves settings and history in `%APPDATA%\DROPZONE`.

### Bundled Standalone Python Worker
DROPZONE bundles a standalone, self-contained Python worker (`dropzone-worker.exe`), which includes Python 3.12, `yt-dlp`, `gallery-dl`, `requests`, and `psutil`. Users do not need a globally installed Python runtime.

### Packaging Commands
```bash
# Compile standalone Python worker
npm run build:worker

# Generate application icons
npm run build:icons

# Package Windows NSIS installer
npm run package:win

# Package Windows Portable executable
npm run package:portable

# Package both installer and portable packages
npm run package:all
```

### Checksums & Verification
Release packages can be verified using SHA-256 hashes published in `release/SHA256SUMS.txt`:
```powershell
Get-FileHash -Algorithm SHA256 release\DROPZONE-Setup-1.0.0-alpha.10-x64.exe
Get-FileHash -Algorithm SHA256 release\DROPZONE-Portable-1.0.0-alpha.10-x64.exe
```

---

## Windows Code Signing & Publisher Verification

DROPZONE builds are packaged with official publisher metadata (`Hz Creatives`).

In development and pre-release alpha distributions without a dedicated Authenticode code-signing certificate installed, Windows 11 Smart App Control (SAC) or Microsoft Defender SmartScreen may display an unknown publisher prompt. For technical details on Authenticode integration, hardware token signing, and how Smart App Control evaluates binary reputation, refer to the [Windows Code Signing Guide](file:///d:/INDEX/DropZone/docs/WINDOWS_SIGNING_GUIDE.md).

---

## Contributing & Security

- **Contributions**: Contributions, bug reports, and feature requests are welcome! Please read [CONTRIBUTING.md](file:///d:/INDEX/DropZone/CONTRIBUTING.md) for local development workflows and pull request guidelines.
- **Security Vulnerabilities**: For responsible disclosure of potential security vulnerabilities, please refer to [SECURITY.md](file:///d:/INDEX/DropZone/SECURITY.md).

---

## License & Legal Notices

DROPZONE is open-source software licensed under the **[MIT License](file:///d:/INDEX/DropZone/LICENSE)**.

```
Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)
```

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions of the MIT License.

### Third-Party Software & Companion Engines
DROPZONE interfaces with and bundles several open-source libraries and command-line engines (including `Electron`, `yt-dlp`, `gallery-dl`, `sql.js`, and `FFmpeg`). Each third-party component retains its original open-source license (such as GPLv3, The Unlicense, Apache 2.0, BSD-3-Clause, and MIT). For complete license texts and architectural attribution, see **[THIRD_PARTY_NOTICES.md](file:///d:/INDEX/DropZone/THIRD_PARTY_NOTICES.md)**.

### Responsible Use Notice
The MIT License grants rights to the DROPZONE software itself. It does not grant rights to download, convert, or distribute copyrighted, protected, or restricted content without authorization from the respective rights holder, nor does it grant permission to bypass access restrictions or anti-bot protections. Users are solely responsible for ensuring their usage complies with all applicable laws and third-party terms of service.



