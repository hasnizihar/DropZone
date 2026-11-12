# Security Policy & Guidelines

## Architecture Security Principles

DROPZONE enforces defense-in-depth principles across its desktop runtime:

1. **Chromium Sandboxing & Isolation**
   - `contextIsolation` is set to `true` for all `BrowserWindow` instances.
   - `nodeIntegration` is strictly `false`.
   - `webSecurity` is enabled.
   - External navigation and new window creations (`window.open`) are intercepted and opened exclusively via the native OS shell (`shell.openExternal`) after origin validation.

2. **IPC Validation & Least Privilege**
   - The preload script exposes only explicit whitelisted methods via `contextBridge.exposeInMainWorld('dropzone', ...)`.
   - All incoming IPC requests are validated before processing.
   - React components never have direct access to `child_process`, `fs`, or Node builtins.

3. **Subprocess Isolation & Secure Execution**
   - Python worker is spawned with `shell: false` and strict arguments array to prevent command injection.
   - Communication with the worker occurs strictly over standard I/O via single-line JSON objects.
   - The worker protocol strictly rejects any command not defined in its dispatcher table (`UNKNOWN_COMMAND`).
   - Line length limits (2MB maximum) protect against memory exhaustion from oversized payloads.

4. **Filesystem & Path Security (Milestone 4)**
   - Download destination paths are normalized to prevent path traversal (`..` escapes).
   - Filenames are strictly sanitized via `sanitize_filename`, stripping invalid Windows characters (`\ / : * ? " < > | \0`), trimming trailing dots and whitespace, and bounding length to 180 characters.
   - Partial downloads use `.part` extensions and are never automatically executed upon completion.
   - User cancellation safely terminates in-flight writers without leaving corrupted target destination locks.

5. **Credential & Privacy Protection**
   - Worker stdout is reserved for protocol messages; all logging goes to stderr.
   - Logs never record authentication tokens, cookies, or user credentials.
   - Diagnostic output is scrubbed of sensitive query parameters where applicable.

6. **URL Validation & Network Security (Milestones 3 & 5)**
   - Media URLs are validated defensively prior to invocation (`UrlValidator`).
   - Allowed protocols are strictly restricted to `http` and `https` (rejecting `file:`, `data:`, `javascript:`, `ftp:`, `smb:`, etc.).
   - Access to private network addresses, loopback interfaces (`127.0.0.1`, `localhost`, `::1`), RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local IPs, and cloud metadata services (`169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`) is strictly blocked to prevent SSRF vulnerabilities.
   - Hostnames are resolved through DNS pre-flight verification (`getaddrinfo`) to prevent DNS rebinding attacks to internal infrastructure.
   - HTTP redirects are bounded (max 5 hops) and every intermediate location header is validated against SSRF rules; protocol downgrades (HTTPS -> HTTP) are strictly blocked.
   - Filenames are protected against Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and path traversal sequences.
   - Range-based download resumption requires remote resource validation (ETag / Last-Modified sidecar checks) to prevent silent data corruption.

7. **Batch & Playlist Security (Milestone 6)**
   - Batch URL ingestion is strictly bounded to a maximum of 50 URLs per operation, preventing memory exhaustion and runaway network requests.
   - Prose containing URLs is stripped of surrounding punctuation and non-HTTP tokens; freeform text is never evaluated into arbitrary commands or shell calls.
   - Every batch URL is independently validated through SSRF and DNS rebinding protections; batch mode never weakens URL security filters.
   - Playlist inspection is bounded (default max 200 items, `playlistend`) in flat non-downloading mode, preventing memory exhaustion and infinite-stream denial of service.
   - Private and restricted content is detected and marked unavailable without attempting authentication bypass or access control defeats.
   - Filename collision handling enforces deterministic unique names (`resolveUniqueFilename`), guaranteeing that multiple URLs in the same directory never overwrite completed files without explicit authorization.

8. **FFmpeg Subprocess Execution & Process Safety (Milestone 7)**
   - FFmpeg and FFprobe are executed strictly via Python's `subprocess.Popen` / `subprocess.run` with list-based arguments; `shell=True` is forbidden across the entire codebase to eliminate shell injection vulnerabilities.
   - User-supplied filenames are sanitized (`sanitize_filename`), stripping directory separators, control characters, and Windows reserved names.
   - Codecs, container formats, and audio bitrates are validated against strict allowlists (`AUDIO_FORMAT_SPECS`, `CONTAINER_SPECS`); arbitrary command options or custom filtergraphs are rejected.
   - Output files are written to isolated temporary files (`.tmp.ext`) and verified using FFprobe before atomic commitment (`os.replace`).
   - On error or user cancellation, temporary output files are cleaned up immediately, while valid source downloads are retained without loss.
   - FFmpeg process cancellation utilizes tree termination (`psutil`), preventing orphaned or runaway background encoding processes on Windows.

9. **SQLite Storage & Data Safety (Milestone 8)**
   - Renderer processes have no direct database access; all database queries and transactions are mediated exclusively by Electron Main through typed IPC channels.
   - SQL injection is eliminated by strictly utilizing parameterized queries (`?` bindings) and prepared statements across all read and write queries; untrusted user inputs are never interpolated into SQL strings.
   - Foreign key constraints are actively enforced (`PRAGMA foreign_keys = ON;`), maintaining referential integrity across parent-child container relationships and preventing orphaned records.
   - Application settings and job models are validated with Zod schemas before being persisted to or returned from SQLite; malformed or outdated records fall back to safe defaults.
   - Physical file deletion is strictly segregated from database record removal: deleting a history record leaves the downloaded file intact on disk. Physical file deletion requires explicit user confirmation and validates paths to ensure only targeted download files are unlinked.
   - Sensitive credentials, passwords, and authorization tokens are strictly forbidden from being stored in the SQLite database.
   - Database files are stored exclusively in the application's isolated `userData` directory, preventing source repository pollution or unauthorized file placement.

10. **Fault-Tolerance Hardening & State Integrity (Milestone 9)**
   - Terminal State Idempotency: `QueueManager` discards late progress, completion, failure, or cancellation events arriving after terminal states (`completed`, `cancelled`, `failed`), preventing UI telemetry regression and state corruption.
   - Database Write Serialization: `DatabaseManager` serializes overlapping `saveImmediately()` calls using a pending save queue (`hasPendingSave`), ensuring rapid state mutations are flushed to disk without race-condition data loss.
   - SSRF & Redirect Boundary Testing: Automated regression suites verify that redirects to cloud metadata (`169.254.169.254`, `fd00:ec2::254`), private IP subnets, and loopback are blocked, and HTTPS-to-HTTP scheme downgrades are rejected.
   - Subprocess Command Safety Audit: Confirmed 0 occurrences of `shell=True`, `eval()`, or `exec()` in production code. All subprocess calls (Python worker, FFmpeg, FFprobe) pass discrete argument arrays.
   - Safe Atomic Finalization: Staging files (`.tmp`) are cleaned up immediately upon filesystem error, and final files are renamed only after full verification.
