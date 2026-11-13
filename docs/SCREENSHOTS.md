# DROPZONE Screenshot & Visual Media Guide

This document defines the official visual media checklist, capture specifications, and presentation standards for DROPZONE.

---

## 1. Official Capture Specifications

To maintain brand consistency across the GitHub repository, releases, and documentation, capture all application screenshots according to these parameters:

- **Display Resolution**: 1920x1080 (1080p) or 2560x1440 (1440p) at 100% OS DPI scaling.
- **Window Dimensions**: 1240 x 820 pixels (the default DROPZONE launch size).
- **Color Profile**: sRGB.
- **Image Format**: PNG (compressed via OptiPNG or TinyPNG) or WebP.
- **Theme**: Dark Mode (Near Black `#121417`, Acid Lime `#D4FF5C`, Warm Off-White `#F5F3EF`).
- **Asset Directory**: Save screenshots to `docs/images/` using lowercase kebab-case naming.

---

## 2. Screenshot Capture Checklist

Capture the following 6 core application views for repository documentation:

| View Name | Target Image Path | Content & State to Demonstrate |
| :--- | :--- | :--- |
| **Dashboard** | `docs/images/screenshot-dashboard.png` | Main overview showing system engines status (yt-dlp version, FFmpeg ready, Python runtime), quick-download input bar, and recent download summary cards. |
| **URL Analyzer** | `docs/images/screenshot-analyzer.png` | Deep format inspection of a video URL showing thumbnail, stream title, format tabs (Video + Audio, Video Only, Audio Only), resolution pills (4K, 1080p, 720p), codec badges, and conversion options. |
| **Downloads Queue** | `docs/images/screenshot-queue.png` | Active downloading view with progress bars in Acid Lime (`#D4FF5C`), speed readouts (MB/s), downloaded/total bytes, ETA counters, and pause/resume/cancel controls. |
| **Batch Downloader** | `docs/images/screenshot-batch.png` | Multi-URL batch ingestion showing the text/file import dropzone, parsed URL table, detected categories (`MEDIA`, `FILE`, `IMAGE`), and batch progress controls. |
| **Download History** | `docs/images/screenshot-history.png` | Durable SQLite history view showing search bar, category & status dropdown filters, paginated completed jobs, "Open Folder" action, and clear history modal. |
| **Settings & Audio Conversion** | `docs/images/screenshot-settings.png` | Application preferences showing download directory selector, concurrency slider (default: 3), default audio format (MP3/FLAC/M4A), bitrate selector, and SQLite database health card. |

---

## 3. Brand Tokens Reference

When creating visual graphics, banners, or social previews for DROPZONE, use strictly official tokens:

| Token Name | Hex Code | Role & Application |
| :--- | :--- | :--- |
| **Near Black** | `#121417` | Canvas background, card containers, dialog backdrops |
| **Warm Off-White** | `#F5F3EF` | Primary headers, stream titles, button text, readable body |
| **Acid Lime** | `#D4FF5C` | Primary accent, download progress bars, active tabs, CTA buttons |
| **Graphite Grey** | `#282C35` / `#858B93` | Borders, subtle dividers, secondary metadata captions |

