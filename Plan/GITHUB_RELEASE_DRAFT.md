# DROPZONE v1.0.0-alpha.12 — Universal Desktop Download Manager (Public Alpha)

**Release Tag**: `v1.0.0-alpha.12`  
**Target Branch**: `master`  
**License**: MIT  
**Platform**: Windows 10 / Windows 11 (64-bit)  
**Publisher**: `Hz Creatives (KR Hasni Zihar)`  

---

## What is DROPZONE?

DROPZONE is a modern, high-contrast, local-first Windows desktop download manager engineered for reliability, transparency, and deep format control. Built on Electron, React, and an embedded Python companion worker packaging `yt-dlp` and `gallery-dl`, DROPZONE pairs high-throughput multi-engine downloading with a zero-telemetry architecture.

---

## What's Changed in v1.0.0-alpha.12

This release delivers fundamental reliability hardening, resolving edge-case bugs in duplicate filename allocation and HTTP 429 rate-limited server resumption, while introducing user interface polish and platform testing frameworks.

### 🛡️ Critical Fixes & Reliability
- **Atomic Duplicate Download Filename Overwrites (Stage 8.2)**:
  - Resolved an issue where queuing the same URL multiple times caused subsequent downloads to silently overwrite existing completed files on disk.
  - Implemented atomic destination filename reservation (`reserveUniqueFilename` and `resolveUniqueFilename`) in `QueueManager` across in-memory queues, SQLite history, and disk `.part` files.
  - Added compound extension preservation (`.tar.gz`, `.tar.bz2`, etc.) and Windows reserved device name protection (`CON`, `PRN`, `AUX`, `NUL`, `COM1-COM9`, `LPT1-LPT9`).
  - Added pre-rename collision guards before `os.replace` in `direct_stream_engine.py`.
  - Prevented double extension artifacts (`.mp4.mp4`) in `yt-dlp` post-processing.
- **HTTP 429 Rate Limiting & Resume Resilience (Stage 5.1)**:
  - Resolved intermittent resume failures on rate-limited servers (`proof.ovh.net/files/100Mb.dat`).
  - Added RFC 9110 compliant `Retry-After` header parsing supporting both numeric seconds and HTTP-date strings.
  - Implemented bounded exponential backoff with jitter on HTTP 429 responses.
  - Cached sidecar metadata (`.part.meta.json`), eliminating redundant HEAD/GET network probes on resume.
  - Enforced strict `Content-Range` header verification, safely truncating to byte 0 if a server ignores byte-range requests.
- **Queue Deduplication & Store State Synchronization**:
  - Eliminated phantom duplicate job rendering in the Downloads queue by harmonizing Zustand store deduplication with authoritative Electron main process state.

### ✨ User Interface & Usability
- **One-Click Clipboard Paste**: Added interactive paste button icons inside URL inputs in both `AnalyzerPage` and `DashboardPage`.
- **Visual Inspection Progress**: Integrated indeterminate visual progress animation during deep video manifest inspection.
- **Extended Probing Timeout**: Increased Electron IPC inspection timeout to 60,000ms for heavy video manifests.
- **Stream Auto-Merging**: Configured automatic merging of separate DASH video and audio streams into single MP4 containers via yt-dlp.

### 📚 Documentation & Open-Source Hardening
- Added [PRIVACY.md](PRIVACY.md) documenting zero telemetry, local storage in `%APPDATA%\DROPZONE\`, and network boundary controls.
- Added [docs/INSTALLATION.md](docs/INSTALLATION.md) covering Windows Setup, Portable binaries, SmartScreen guidance, and FFmpeg setup.
- Added [docs/BUILDING.md](docs/BUILDING.md) detailing monorepo compilation, worker building, and packaging.
- Added [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) covering worker health, rate limiting, and duplicate filename behavior.
- Documented 5-tier platform compatibility matrix in [docs/PLATFORM_COMPATIBILITY_MATRIX.md](docs/PLATFORM_COMPATIBILITY_MATRIX.md).

---

## Official Release Assets

| Package | Filename | Description | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **Windows Installer** | `DROPZONE-Setup-1.0.0-alpha.12-x64.exe` | Standard setup wizard with Desktop & Start Menu shortcuts, safe uninstaller, and user data retention. | `28507c3ed6c40c696bdc33ad6ae7d0646ae0ec6ba2847b6c8ea00ee6fc5ce294` |
| **Portable Binary** | `DROPZONE-Portable-1.0.0-alpha.12-x64.exe` | Zero-install standalone executable for USB drives or restricted permissions. | `39c2edcbddb4ea897e2f5dd00fbea9840f9a08ea7056ec91780082afb26993e2` |

---

## Verifying Checksums

Verify your download in Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 "DROPZONE-Setup-1.0.0-alpha.12-x64.exe"
Get-FileHash -Algorithm SHA256 "DROPZONE-Portable-1.0.0-alpha.12-x64.exe"
```

Official SHA-256 hashes are recorded in [docs/RELEASE_CHECKSUMS.md](docs/RELEASE_CHECKSUMS.md).

---

## Known Limitations

1. **Vimeo DRM/Protected Streams**: Web client streams protected by Widevine DRM require authorized session keys and cannot be extracted anonymously.
2. **Reddit Authenticated Media**: Feeds gated behind Reddit login require user session cookies.
3. **Flickr Restricted Albums**: Private or restricted photo albums return HTTP 403 without API authentication.
4. **External FFmpeg Requirement**: FFmpeg is not bundled directly due to licensing and size; users must have FFmpeg installed (`winget install Gyan.FFmpeg`) or copied to `%APPDATA%\DROPZONE\resources\ffmpeg\` for audio conversion and high-res video muxing.
5. **Windows SmartScreen Prompt**: Releases are signed with publisher metadata (`Hz Creatives`) but lack an EV hardware certificate; Windows SmartScreen will display an "Unknown Publisher" prompt on initial launch. Click **More info** > **Run anyway** to launch.

