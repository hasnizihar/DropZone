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
