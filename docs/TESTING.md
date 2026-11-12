# Testing Strategy & Execution Guide

DROPZONE maintains an automated test suite across all layers to ensure high reliability, crash recovery, and data integrity.

---

## Testing Matrix

| Layer | Framework | Scope |
| :--- | :--- | :--- |
| **Shared Models & Schemas** | Vitest | Zod schemas, validation, IPC types |
| **Renderer UI & State** | Vitest + React Testing Library | Component rendering, state updates, format picker |
| **Electron Main & IPC** | Vitest (Node environment) | Path sanitization, IPC payload validation, concurrency |
| **Python Worker & Engines** | Pytest | JSON Lines protocol, yt-dlp inspection, HTTP range resume |

---

## Running Tests

### Running Frontend & Shared Tests
```bash
npm test
```

### Running Backend Tests
```bash
npm run test:python
```

