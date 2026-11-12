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

3. **Verify Python Dependencies:**
   ```bash
   python -m pip install -r backend/requirements.txt
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   This command starts the Vite development server on `http://127.0.0.1:5173`, compiles the Electron main and preload scripts, and launches Electron.

---

## Workspace Scripts

- `npm run dev`: Runs renderer and main process concurrently with hot reload.
- `npm run build`: Compiles main, preload, and bundles React application for production.
- `npm test`: Runs Vitest unit and component tests.
- `npm run test:python`: Runs Python worker test suite with Pytest.

---

## Coding Standards

1. **Strict TypeScript**: Avoid `any`. Define strong types in `@dropzone/shared`.
2. **Design Tokens**: Adhere strictly to the DROPZONE color palette:
   - Near Black: `#121417`
   - Warm Off-White: `#F5F3EF`
   - Acid Lime: `#D4FF5C`
   - Graphite Grey: `#858B93`
3. **IPC Boundaries**: Never expose `child_process`, `fs`, or Node builtins directly to the renderer. Use the typed `window.dropzone` API.
