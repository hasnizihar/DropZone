# DROPZONE Development Milestones, Plans & Release Audits

This directory serves as the engineering archive for DROPZONE. It records the architectural specifications, phase milestones, post-release test audits, and security diagnoses leading up to **`v1.0.0-alpha.12`**.

---

## 1. Development Milestones & Phase Specifications

The core architecture of DROPZONE was planned and implemented across incremental milestones:

| Plan / Milestone | Title & Focus | Key Deliverables |
| :--- | :--- | :--- |
| **[`p1.0.0.md`](p1.0.0.md)** | **Project Foundations & Architecture** | Monorepo structure (`apps/desktop`, `packages/shared`, `backend/worker`), Electron + Vite scaffolding, React 18 frontend, brand token definitions. |
| **[`p1.0.1.md`](p1.0.1.md)** | **Worker Foundation & JSON Lines Protocol** | Subprocess worker architecture, bi-directional newline-delimited JSON IPC, heartbeat mechanism, graceful shutdown lifecycle. |
| **[`p1.0.2.md`](p1.0.2.md)** | **Media Extraction & URL Analyzer** | yt-dlp metadata extraction, stream format inspection (resolution pills, audio codecs, bitrates, video-only / audio-only streams). |
| **[`p1.0.3.md`](p1.0.3.md)** | **Core Downloads & Queue State Machine** | QueueManager state transitions (`PENDING` → `DOWNLOADING` → `COMPLETED`/`FAILED`), concurrency governor, pause/resume/cancel mechanics. |
| **[`p1.0.4.md`](p1.0.4.md)** | **Direct HTTP Streaming & Gallery Service** | HTTP/HTTPS chunked downloads, `gallery-dl` image set extraction, temporary `.part` file buffer allocation. |
| **[`p1.0.5.md`](p1.0.5.md)** | **Worker Service Integration & Resilience** | Fault isolation, worker self-healing / auto-restart on crash, unhandled rejection containment. |
| **[`p1.0.6.md`](p1.0.6.md)** | **FFmpeg Integration & Audio Extraction** | FFmpeg discovery, stream remuxing (MP4/MKV/WebM), audio transcoding (MP3, M4A, FLAC, WAV, OPUS) with selectable bitrates. |
| **[`p1.0.7.md`](p1.0.7.md)** | **SQLite WASM Persistence & History** | `sql.js` inlined WebAssembly persistence, schema migrations (`schema.sql`), durable download history, crash recovery on restart. |
| **[`p1.0.8.md`](p1.0.8.md)** | **Batch Processing & Playlist Ingestion** | Bulk text/CSV URL import, playlist pagination (up to 200 items), parallel URL analysis, unified batch download queue. |
| **[`p1.0.9.md`](p1.0.9.md)** | **Design System & Acid Lime Polish** | High-contrast dark theme, Near Black (`#121417`), Acid Lime (`#D4FF5C`), Lucide icons, custom scrollbars, toast notifications. |
| **[`p1.0.10.md`](p1.0.10.md)** | **Multi-Platform Compatibility Matrix** | Validation across 12 platforms (YouTube, Vimeo, SoundCloud, Direct HTTP, etc.), test harnesses, platform matrix generation. |
| **[`p1.0.11.md`](p1.0.11.md)** | **Open-Source Identity & Publisher Config** | MIT license audit, `THIRD_PARTY_NOTICES.md`, GPL boundary isolation, authoritative `AppUserModelId` (`com.dropzone.desktop`). |
| **[`p1.0.12.md`](p1.0.12.md)** | **Release Packaging & Distribution** | Electron-builder configuration, NSIS fallback installer, portable executable, binary size optimization. |

---

## 2. Hardening, Bug Fixes & Resilience Plans

Post-alpha testing revealed specific real-world edge cases that were methodically resolved:

| Plan / Milestone | Title & Focus | Resolution |
| :--- | :--- | :--- |
| **[`p1.0.12-final-audit.md`](p1.0.12-final-audit.md)** | **Milestone 12 Final Release Audit** | Comprehensive launch readiness assessment, verifying binary integrity, dependency security, and license notices. |
| **[`p1.0.13-download-verification.md`](p1.0.13-download-verification.md)** | **Live Download Verification Matrix** | Real-network validation matrix across varied MIME types and file sizes (W3C PDF, 100MB test files, audio tracks). |
| **[`p1.0.14-resume-investigation.md`](p1.0.14-resume-investigation.md)** | **HTTP 429 & Resume Resilience** | Rate-limiting mitigation: `Retry-After` header parsing, bounded exponential backoff (2s → 30s), byte-offset validation without data corruption. |
| **[`p1.0.15-duplicate-filename-fix.md`](p1.0.15-duplicate-filename-fix.md)** | **Duplicate Filename Collision Prevention** | Multi-stage reservation system: guarantees `file (1).ext`, `file (2).ext` allocation across concurrent jobs and existing disk files. |

---

## 3. Packaging, Security & Code-Signing Reports

Engineering audits evaluating installer performance, Windows Defender SmartScreen, and Smart App Control (SAC):

| Document | Purpose & Summary |
| :--- | :--- |
| **[`INNO_SETUP_IMPLEMENTATION_REPORT.md`](INNO_SETUP_IMPLEMENTATION_REPORT.md)** | Full report on replacing NSIS with Inno Setup 6 (`installer/dropzone.iss`). Achieved an 11.4 MB (9.0%) reduction in installer file size down to **115.28 MB**, added custom wizard branding, clean uninstall routines, and preserved NSIS as fallback. |
| **[`INNO_SETUP_REAL_MACHINE_TEST.md`](INNO_SETUP_REAL_MACHINE_TEST.md)** | Real-hardware execution test of the Inno Setup installer on Windows 11. Confirmed hash integrity, verified binary metadata, and captured the exact Windows application-control block. |
| **[`WINDOWS_CODE_SIGNING_DIAGNOSIS.md`](WINDOWS_CODE_SIGNING_DIAGNOSIS.md)** | In-depth security analysis distinguishing Smart App Control (SAC) policy `VerifiedAndReputableDesktop` from Enterprise WDAC. Explains cloud HSM Authenticode signing options (SSL.com eSigner / Certum SimplySign) and geographical eligibility. |
| **[`PUBLISHER_AND_CODESIGNING_AUDIT.md`](PUBLISHER_AND_CODESIGNING_AUDIT.md)** | Comprehensive audit of publisher identity (`Hz Creatives`), PE version headers, and Authenticode signing requirements across all project binaries. |
| **[`PUBLIC_ALPHA_RELEASE_AUDIT.md`](PUBLIC_ALPHA_RELEASE_AUDIT.md)** | End-to-end audit for the public alpha release, reviewing repository hygiene, code quality, test coverage, and documentation. |
| **[`GITHUB_RELEASE_DRAFT.md`](GITHUB_RELEASE_DRAFT.md)** | Official GitHub release notes copy for `v1.0.0-alpha.12` with direct download links, SHA-256 hashes, changelog highlights, and verification instructions. |
| **[`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md)** | Pre-flight signoff checklist covering automated tests, packaging checks, documentation references, and git status. |

