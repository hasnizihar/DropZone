# DROPZONE Development Guide

## Environment Setup

### System Prerequisites
- **Node.js**: v20.x or higher (Tested with v24.20.0)
- **npm**: v10.x or higher (Tested with v11.19.0)
- **Python**: 3.10+ (Tested with 3.12.10)
- **FFmpeg**: Accessible on system PATH (or bundled in `resources/binaries/`)

### Setup Instructions

1. **Clone the Repository:**
   ```bash
   git clone <repo-url> dropzone
   cd dropzone
   ```

2. **Install Node Dependencies:**
   ```bash
   npm install
   ```

3. **Install Python Worker Dependencies & Pytest:**
   ```bash
   python -m pip install pytest pydantic psutil yt-dlp
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

---

## Python Worker Subprocess

### Python Executable Resolution
The Electron main process locates Python with the following precedence:
1. Custom configuration passed to `WorkerManager`.
2. Project virtual environment:
   - Windows: `backend/worker/.venv/Scripts/python.exe`
   - Linux/macOS: `backend/worker/.venv/bin/python`
3. System fallback: `python` (Windows) or `python3` (POSIX).

### Running Worker Independently
```bash
# From repository root (PowerShell)
$env:PYTHONPATH="backend/worker/src"; python -m dropzone_worker

# From repository root (Bash)
PYTHONPATH=backend/worker/src python -m dropzone_worker
```

---

## Testing Guide

### Running All TypeScript & UI Tests
```bash
npm test
```

### Running All Python Worker Tests
```bash
npm run test:python
# Or directly with pytest:
$env:PYTHONPATH="backend/worker/src"; python -m pytest backend/worker/tests -v
```

---

## Workspace Scripts

- `npm run dev`: Runs renderer and main process concurrently with hot reload.
- `npm run build`: Compiles main, preload, and bundles React application for production.
- `npm test`: Runs Vitest unit, component, and worker integration tests.
- `npm run test:python`: Runs Python worker test suite with Pytest.
