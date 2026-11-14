# DROPZONE Build & Packaging Guide

This document describes how to compile, build, test, and package DROPZONE from source on Windows.

---

## 1. Prerequisites

Ensure the following tools are installed on your build machine:

- **Operating System**: Windows 10 or Windows 11 (64-bit).
- **Node.js**: Version 20.x or 22.x LTS ([nodejs.org](https://nodejs.org/)).
- **Python**: Version 3.10, 3.11, or 3.12 (64-bit) with `pip` ([python.org](https://www.python.org/)).
- **Git**: For source version control ([git-scm.com](https://git-scm.com/)).
- **FFmpeg** *(optional for development, recommended for full testing)*: `winget install Gyan.FFmpeg`.

---

## 2. Workspace Setup

Clone the repository and install all npm dependencies across the monorepo workspaces:

```bash
git clone https://github.com/hasnizihar/DropZone.git
cd DropZone

# Install dependencies across all npm workspaces
npm install
```

Install the Python worker development dependencies:

```bash
cd backend/worker
pip install -e .
pip install pytest pyinstaller requests psutil pydantic yt-dlp gallery-dl
cd ../..
```

---

## 3. Building the Companion Python Worker

DROPZONE bundles a standalone companion worker binary (`dropzone-worker.exe`) to execute `yt-dlp` and `gallery-dl` without requiring users to install Python:

```bash
npm run build:worker
```

This executes `python scripts/build-worker.py`, which uses PyInstaller to package `backend/worker/src/dropzone_worker/__main__.py` and outputs the single-file executable to:
```
apps/desktop/resources/worker/dropzone-worker.exe
```

---

## 4. Running in Development Mode

To start the desktop application in development mode with Hot Module Replacement (HMR):

```bash
npm run dev
```

This concurrently runs:
1. `vite` dev server on `http://localhost:5173`.
2. `scripts/build-electron.mjs` compiling Electron main and preload scripts.
3. Electron launching with `NODE_ENV=development`.

---

## 5. Running Test Suites

### Desktop & Frontend Tests (Vitest)
```bash
npm test
```
Runs 99+ tests across unit, integration, persistence, fault tolerance, and filename collision suites.

### Worker Tests (Pytest)
```bash
npm run test:python
```
Runs 66+ tests across protocol encoding, stream resumption, 429 backoff, sidecar metadata, and process lifecycle.

### End-to-End Verification Scripts
```bash
# Test HTTP 429 backoff and byte-range resumption
python scripts/test-resume-resilience.py

# Test duplicate download filename overwrite prevention
python scripts/test-duplicate-filenames.py

# Test real media downloads through worker pipeline
python scripts/test-real-downloads.py
```

### Static Typechecking
```bash
npm run typecheck --workspace=@dropzone/shared
npm run typecheck --workspace=@dropzone/desktop
```

---

## 6. Packaging Release Artifacts

DROPZONE provides an Inno Setup Windows installer as its primary setup wizard, alongside a zero-install portable executable.

### Prerequisites for Inno Setup Installer:
Install Inno Setup 6 (free & open source):
```powershell
winget install JRSoftware.InnoSetup
```

### Build Inno Setup Installer
```powershell
# Automatically builds electron, unpacks runtime, and compiles Inno Setup installer
npm run package:inno

# Or execute script directly with options:
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1
```

### Verify Installer Integrity & Sandbox Installation
```powershell
npm run verify:installer
```

### Package Portable Standalone Executable Only
```bash
npm run package:portable
```

Outputs are generated in the root `release/` directory:
- `release/DROPZONE-Setup-<version>-x64.exe`
- `release/DROPZONE-Portable-<version>-x64.exe`

---

## 7. Verifying Packaged Binaries

Run automated smoke tests against the freshly compiled distribution:

```bash
# Smoke test packaged executable
npm run smoke:packaged
```
This verifies that:
1. The packaged executable launches cleanly.
2. The bundled `dropzone-worker.exe` is found in `resources/worker/`.
3. Handshake and ping/pong IPC requests succeed.
4. Clean shutdown occurs without zombie background processes.

