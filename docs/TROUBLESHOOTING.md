# DROPZONE Troubleshooting & Diagnostic Guide

This document lists common issues, error messages, and their solutions when running or packaging DROPZONE.

---

## 1. Engine & Subprocess Issues

### Issue: "Worker Status: Unhealthy" or Startup Handshake Timeout
**Symptom**: The footer status shows `Worker: unhealthy` in red or orange, or URL analysis fails immediately.

**Common Causes & Fixes**:
1. **Antivirus or Windows Defender Heuristic Block**:
   - Because `dropzone-worker.exe` is a PyInstaller single-file binary, overly aggressive third-party antivirus utilities may sandbox or quarantine it in `%LOCALAPPDATA%\Temp\_MEIxxxxxx`.
   - **Fix**: Whitelist `dropzone-worker.exe` or `%APPDATA%\DROPZONE\` in your security software.
2. **Zombie Worker Process**:
   - An orphaned background process from a previous crash may be locking the named pipe or stdio channel.
   - **Fix**: Open Windows Task Manager (Ctrl+Shift+Esc), locate any stray `dropzone-worker.exe` or `python.exe` processes under DROPZONE, and terminate them.
   - You can also click **Restart Worker** in DROPZONE's **Settings** tab.

---

## 2. Windows Defender SmartScreen Warnings

### Issue: "Windows protected your PC — Microsoft Defender SmartScreen"
**Symptom**: Blue overlay stating "Unknown Publisher" appears on first launch.

**Explanation & Resolution**:
- DROPZONE is an independent, free open-source project. Code-signing certificates cost hundreds of dollars annually; without one, Windows displays this prompt until thousands of users have launched the binary.
- **Resolution**: Click **More info**, then click **Run anyway**.
- To verify the binary before running, calculate its SHA-256 hash using `Get-FileHash` and compare it against [docs/RELEASE_CHECKSUMS.md](RELEASE_CHECKSUMS.md).

---

## 3. Audio Extraction & FFmpeg Issues

### Issue: "FFmpeg Suite: Not Available" or Video Muxing Fails
**Symptom**: You can inspect videos and download 360p/720p with sound, but 1080p/4K or "Audio Only (MP3)" options fail or state FFmpeg is missing.

**Resolution**:
High-definition media platforms serve video and audio as separate DASH streams. FFmpeg is required to merge them into a single MP4/MKV file, or to transcode audio streams into MP3/FLAC.

1. Install FFmpeg in PowerShell:
   ```powershell
   winget install Gyan.FFmpeg
   ```
2. Or manually extract `ffmpeg.exe` and `ffprobe.exe` into:
   ```
   %APPDATA%\DROPZONE\resources\ffmpeg\
   ```
3. Restart DROPZONE. The Dashboard will immediately reflect FFmpeg as **Ready**.

---

## 4. Download Failures & Rate Limiting

### Issue: "Rate limited by server (HTTP 429)"
**Symptom**: Download fails or pauses with an HTTP 429 error code during rapid resumption.

**Resolution**:
- DROPZONE includes automatic RFC 9110 compliant `Retry-After` parsing and bounded exponential backoff.
- If a server temporarily rate limits your IP address, DROPZONE will preserve your partial `.part` file, pause requests for the requested cooldown duration, and resume automatically without byte corruption.
- Avoid hammering public file mirrors with high concurrency; reduce concurrency in **Settings** to 1 or 2 if downloading from aggressive servers.

### Issue: Extraction Fails on Reddit, Vimeo, or Instagram
**Symptom**: "Inspection Error: Login required" or "DRM-protected stream".

**Resolution**:
- Some platforms strictly require authenticated session cookies or utilize widevine DRM encryption:
  - **Vimeo**: DRM-protected private streams cannot be extracted without authorized playback keys.
  - **Reddit**: Age-gated or NSFW feeds may require Reddit session cookies.
  - **Flickr**: Private or restricted albums return HTTP 403.
- These are platform-side security restrictions, not engine defects. Public YouTube, Vimeo embeds, TikTok, Instagram Reels, and direct HTTP/HTTPS files work out of the box.

---

## 5. Duplicate Filenames & Destination Behavior

### Question: Why did my file download as `MyVideo (1).mp4` instead of `MyVideo.mp4`?
**Explanation**:
- DROPZONE implements **Stage 8.2 Atomic Duplicate Overwrite Prevention**.
- If a completed file named `MyVideo.mp4` or an active partial file (`MyVideo.mp4.part`) already exists in your destination directory, DROPZONE guarantees that your existing file is never destroyed.
- Subsequent downloads of the same name or URL will automatically and deterministically receive `(1)`, `(2)`, `(3)` suffix allocation.

---

## 6. Resetting Application State & SQLite Database

### Issue: Corrupted History or Preferences
If the local database becomes damaged or you wish to perform a complete factory reset:

1. Close DROPZONE completely.
2. Press `Win + R`, type `%APPDATA%\DROPZONE`, and press Enter.
3. Backup or delete `dropzone.db`.
4. Launch DROPZONE. A clean, validated SQLite database will be initialized with default schema v1.

