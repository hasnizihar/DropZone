# DROPZONE Privacy Policy & Local-First Architecture

**Effective Date**: November 13, 2026  
**Applies to**: DROPZONE Universal Desktop Download Manager (All Editions)

---

## 1. Core Privacy Philosophy: Zero Telemetry

DROPZONE is built from the ground up as a **100% local-first desktop application**. We believe personal download habits, media interests, and file collections are fundamentally private. 

- **No Remote Telemetry**: DROPZONE does not transmit any analytics, crash reports, heartbeat pings, or usage statistics to developers, maintainers, or third-party servers.
- **No User Accounts**: DROPZONE requires no registration, account creation, email address, or authentication to use.
- **No Cloud Syncing**: Your download queue, completed history, and application preferences never leave your personal computer.

---

## 2. Data Stored on Your Computer

All application data is stored strictly in your local user profile:

| Data Type | Storage Location | Purpose & Retention |
| :--- | :--- | :--- |
| **Download History** | `%APPDATA%\DROPZONE\dropzone.db` | Local SQLite database recording job IDs, URLs, filenames, byte sizes, status, and completion timestamps. Retained until you manually clear it. |
| **User Settings** | `%APPDATA%\DROPZONE\dropzone.db` | Download directories, concurrency limits, audio format preferences, and retry settings. |
| **Temporary Files** | Target download directory | Partial download segments (`.part`) and sidecar metadata (`.part.meta.json`). Automatically renamed or cleaned up upon completion or cancellation. |
| **Application Logs** | Session memory only | Ephemeral diagnostics logged to stdio during execution; never uploaded. |

You have complete control over this data at all times:
- Click **Clear Completed** in the Downloads queue or **Clear History** in the History tab to permanently wipe records.
- Deleting `%APPDATA%\DROPZONE\` restores DROPZONE to a fresh state with zero residual data.

---

## 3. Network Activity Disclosures

DROPZONE initiates outbound network connections **only** when explicitly instructed by you:

1. **Direct HTTP/HTTPS File Downloads**:
   - Initiates HTTP `HEAD` and `GET` requests directly to the target URL provided in the URL Analyzer, Dashboard, or Batch interface.
   - Respects HTTP `Range` headers for byte resumption.
2. **Media Stream Probing & Ingestion**:
   - Spawns the companion worker (`yt-dlp` / `gallery-dl`) to fetch video manifests and media streams directly from the hosting platform of the submitted URL.
   - Transmits standard browser-like User-Agent headers to ensure compatibility with hosting providers.
3. **No Secondary Traffic**:
   - DROPZONE never sends query URLs, extracted titles, file hashes, or IP addresses to any intermediary proxy, tracking relay, or analytics clearinghouse.

---

## 4. Security & Isolation

- **Chromium Sandboxing**: Electron renderer windows operate with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- **SSRF & Private Network Protection**: DROPZONE's companion engine validates destination hosts and blocks requests targeting loopback, link-local, AWS/GCP/Azure cloud metadata endpoints (`169.254.169.254`), and private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).

---

## 5. Contact & Questions

For questions or security disclosures regarding DROPZONE's local-first architecture, please review [SECURITY.md](SECURITY.md) or open an issue on the [GitHub Repository](https://github.com/hasnizihar/DropZone).

