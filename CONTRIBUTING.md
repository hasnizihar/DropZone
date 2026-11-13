# Contributing to DROPZONE

Thank you for your interest in contributing to DROPZONE! DROPZONE is a local-first, universal desktop download manager developed as an open-source project by Hz Creatives.

---

## Code of Conduct & Principles

1. **Local-First & Privacy First**: DROPZONE does not collect telemetry, analytics, or user information. All network communication is restricted to user-directed downloads.
2. **Security & Sandboxing**: Electron sandboxing, context isolation, and strict input validation (SSRF defense, path traversal prevention) must never be bypassed or weakened.
3. **No Access Control Bypass**: DROPZONE respects platform terms and access controls. Do not submit pull requests intended to circumvent authentication, paywalls, DRM, or anti-bot protections.

---

## Development Setup

### Prerequisites
- **Node.js**: v20 or v22 LTS
- **Python**: 3.10+ (Python 3.12 recommended)
- **Git**: Latest version
- **FFmpeg**: Installed and available on system PATH (or via WinGet: `winget install Gyan.FFmpeg`)

### Initial Workspace Installation
```bash
# Clone the repository
git clone https://github.com/hasnizihar/dropzone.git
cd dropzone

# Install Node dependencies across monorepo workspaces
npm install

# (Optional) Install Python development dependencies for worker tests
pip install -r backend/worker/requirements.txt
```

### Running in Development
```bash
# Start desktop app with hot-reloading renderer and Electron main
npm run dev
```

---

## Testing & Quality Assurance

Before submitting any pull request, verify that all test suites pass with zero errors:

```bash
# Run Vitest frontend, store, and state machine tests
npm test

# Run Python background worker test suite
npm run test:python

# Perform full TypeScript compilation check
npm run typecheck --workspace=@dropzone/desktop

# Compile production bundle
npm run build

# Run Electron runtime smoke test
npm run smoke:electron

# Run Packaged application smoke test
npm run smoke:packaged
```

---

## Project Structure & Architecture

```
dropzone/
├── apps/
│   └── desktop/            # Electron + React 18 + Vite desktop application
│       ├── electron/       # Electron Main, secure preload bridge, SQLite persistence
│       ├── src/            # React UI components, Zustand stores, pages, brand tokens
│       └── resources/      # Application icons, bundled worker executables
├── packages/
│   └── shared/             # Domain types, Zod schemas, IPC channel contracts
├── backend/
│   └── worker/             # Python 3 worker engine with JSON Lines protocol
│       ├── src/            # Dispatcher, yt-dlp service, gallery-dl service, direct HTTP
│       └── tests/          # Pytest suite for engines, SSRF defenses, and protocols
├── scripts/                # Packaging, icon generation, smoke test automation
└── docs/                   # Architectural specifications, milestones, signing guide
```

---

## Commit Guidelines

We follow standard Conventional Commits formatting:
- `feat(scope): add new feature`
- `fix(scope): resolve bug or defect`
- `test(scope): add or update unit and integration tests`
- `docs(scope): update documentation or guides`
- `refactor(scope): refactor code without behavioral change`
- `chore(scope): repository maintenance, legal, or release tasks`

---

## Pull Request Checklist

When submitting a pull request:
1. Ensure PR description clearly states the problem solved and the implementation approach.
2. Verify all existing tests pass (`npm test`, `npm run test:python`).
3. Add new unit or integration tests covering added functionality or fixed defects.
4. Confirm no secrets, credentials, or personal paths are introduced.
5. Respect existing code formatting and architectural boundaries (Electron Main as sole state authority; Python worker as stateless executor).

