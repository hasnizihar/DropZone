# DROPZONE Build, Packaging & Diagnostic Scripts

This directory contains build automation, test suites, packaging tools, and security diagnostic utilities for DROPZONE.

---

## Script Directory Index

### 1. Build & Compilation Scripts

| Script | Runtime | Purpose | How to Run |
| :--- | :--- | :--- | :--- |
| **`build-worker.py`** | Python 3.12+ | Compiles the standalone companion worker (`dropzone-worker.exe`) using PyInstaller, embedding Windows PE version metadata from `worker_version_info.txt`. Copies the compiled binary to `apps/desktop/resources/worker/`. | `npm run build:worker`<br>or `python scripts/build-worker.py` |
| **`build-installer.ps1`** | PowerShell | Compiles the Inno Setup 6 installer (`installer/dropzone.iss`) using `ISCC.exe` with solid LZMA2/ultra compression. Produces `release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe`. | `npm run package:inno`<br>or `powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1` |
| **`generate-icons.py`** | Python 3.12+ (Pillow) | Generates multi-resolution Windows icon (`icon.ico` with 16, 24, 32, 48, 64, 128, 256px layers) and standard PNGs from source artwork in `resources/icons/`. | `npm run build:icons`<br>or `python scripts/generate-icons.py` |
| **`patch-electron-builder.cjs`** | Node.js | Automated hook run during `postinstall` to configure electron-builder packaging settings and ensure clean dependency isolation. | `node scripts/patch-electron-builder.cjs` |
| **`worker_version_info.txt`** | Text (Resource) | Windows PE version resource definition file specifying FileVersion (`1.0.0.12`), ProductVersion, CompanyName (`Hz Creatives`), and LegalCopyright for `dropzone-worker.exe`. | *(Read by `build-worker.py`)* |

---

### 2. Verification & Smoke Test Suites

| Script | Runtime | Purpose | How to Run |
| :--- | :--- | :--- | :--- |
| **`smoke-test.cjs`** | Node.js | Fast development smoke test: launches the Electron main process, confirms IPC initialization, and terminates cleanly. | `npm run smoke:electron`<br>or `node scripts/smoke-test.cjs` |
| **`smoke-test-packaged.cjs`** | Node.js | Packaged application smoke test: launches `release/win-unpacked/DROPZONE.exe`, verifies window creation, checks companion worker process spawn, and verifies clean exit. | `npm run smoke:packaged`<br>or `node scripts/smoke-test-packaged.cjs` |
| **`verify-standalone-worker.cjs`** | Node.js | Tests the standalone `dropzone-worker.exe` over standard I/O JSON-Lines IPC protocol (`ping`, `version`, `formats`, `status`). | `node scripts/verify-standalone-worker.cjs` |
| **`verify-installer.ps1`** | PowerShell | Verifies compiled Inno Setup installer: validates file existence, size, SHA-256 hash, PE headers, and uncompressed payload readiness. | `npm run verify:installer`<br>or `powershell -ExecutionPolicy Bypass -File scripts/verify-installer.ps1` |

---

### 3. Automated Test Suites (Engines & Resilience)

| Script | Runtime | Purpose | How to Run |
| :--- | :--- | :--- | :--- |
| **`test-duplicate-filenames.py`** | Python 3.12+ | Automated test suite verifying unique destination allocation (`file.ext` → `file (1).ext`), active-job reservation locks, and concurrent filename safety. | `python scripts/test-duplicate-filenames.py` |
| **`test-resume-resilience.py`** | Python 3.12+ | Resilience test suite verifying HTTP 429 rate limit backoff, `Retry-After` header parsing, bounded exponential delay, and HTTP Range byte resume without byte corruption. | `python scripts/test-resume-resilience.py` |
| **`test-platform-matrix.py`** | Python 3.12+ | Live compatibility test harness across 12 diverse media platforms (YouTube, Vimeo, SoundCloud, Direct HTTP, etc.). Generates `docs/platform_matrix_results.json`. | `npm run test:platforms`<br>or `python scripts/test-platform-matrix.py` |
| **`test-real-downloads.py`** | Python 3.12+ | End-to-end real network download verification runner. Tests direct file transfer, streaming extraction, checksums, and outputs `docs/real_download_results.json`. | `npm run test:downloads`<br>or `python -u scripts/test-real-downloads.py` |

---

### 4. Security & Binary Inspection Utilities

| Script | Runtime | Purpose | How to Run |
| :--- | :--- | :--- | :--- |
| **`check-all-binaries.ps1`** | PowerShell | Inspects all release and packaged binaries (`Inno Setup`, `NSIS`, `Portable`, `win-unpacked`, `worker`), reporting SHA-256 hashes, PE FileVersion, ProductVersion, and Authenticode signature state. | `powershell -ExecutionPolicy Bypass -File scripts/check-all-binaries.ps1` |
| **`check-signatures.ps1`** | PowerShell | Runs `Get-AuthenticodeSignature` across all binaries in `release/`, checking certificate chain status and signature algorithm. | `powershell -ExecutionPolicy Bypass -File scripts/check-signatures.ps1` |
| **`diagnose-wdac.ps1`** | PowerShell | Diagnostic tool for Windows Application Control (WDAC) and Smart App Control (SAC). Queries `CiTool -lp`, checks `VerifiedAndReputableDesktop` policy state, inspects registry flags, and searches the Event Log for Code Integrity Event 3077. | `powershell -ExecutionPolicy Bypass -File scripts/diagnose-wdac.ps1` |
| **`test-real-install.ps1`** | PowerShell | Executes `release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe` on the host machine to test execution behavior, capturing exit codes and SAC block interception. | `powershell -ExecutionPolicy Bypass -File scripts/test-real-install.ps1` |

