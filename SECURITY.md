# Security Policy & Guidelines

## Architecture Security Principles

DROPZONE enforces defense-in-depth principles across its desktop runtime:

1. **Chromium Sandboxing & Isolation**
   - `contextIsolation` is set to `true` for all `BrowserWindow` instances.
   - `nodeIntegration` is strictly `false`.
   - `webSecurity` is enabled.
   - External navigation and new window creations (`window.open`) are intercepted and opened exclusively via the native OS shell (`shell.openExternal`) after origin validation.

2. **IPC Validation**
   - The preload script exposes only explicit whitelisted methods via `contextBridge.exposeInMainWorld('dropzone', ...)`.
   - All payloads received in the main process are validated against expected schemas before processing.

3. **Filesystem & Subprocess Security**
   - No arbitrary command execution is allowed.
   - Download destination paths are normalized and checked to prevent path traversal (`..` escapes).
   - Filenames are sanitized, stripping invalid Windows characters (`\ / : * ? " < > |`) and control characters.
   - Downloaded files are never automatically executed upon completion.

4. **Credential & Privacy Protection**
   - Logs never record authentication tokens, cookies, or user credentials.
   - Diagnostic stderr output is scrubbed of sensitive URL query parameters where applicable.
