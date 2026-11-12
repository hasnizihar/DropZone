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
# Run Vitest unit & component tests
npm test

# Run Python worker tests
npm run test:python
```

