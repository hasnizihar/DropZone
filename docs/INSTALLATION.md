# DROPZONE Installation Guide for Windows

This guide covers installing and setting up DROPZONE on **Windows 10** and **Windows 11 (64-bit)**.

---

## 1. Choosing Your Package

DROPZONE is distributed in two official packaging formats:

| Package | Filename | Recommended For |
| :--- | :--- | :--- |
| **Setup Installer (Inno Setup)** | `DROPZONE-Setup-1.0.0-alpha.12-x64.exe` | General users. Clean modern installation wizard with directory selection, desktop & Start Menu shortcuts, and seamless uninstallation via Windows Settings. Per-user install ({localappdata}\Programs\DROPZONE) requiring no administrator privileges. |
| **Portable Executable** | `DROPZONE-Portable-1.0.0-alpha.12-x64.exe` | Power users, USB flash drives, and environments where administrative installation is restricted. Requires zero installation and leaves no system registry entries. |

Download the latest binaries from the [GitHub Releases](https://github.com/hasnizihar/DropZone/releases) page.

---

## 2. Windows Defender SmartScreen & Smart App Control

DROPZONE is an independent, non-commercial open-source project. Because we do not purchase costly enterprise Extended Validation (EV) code-signing certificates, Windows Defender SmartScreen or Smart App Control may display an *"Unknown Publisher"* notification on initial launch.

### How to Proceed:
1. When the blue SmartScreen dialog appears, click **More info**.
2. Click **Run anyway**.

> [!NOTE]
> This dialog is standard behavior for all unsigned or newly released open-source Windows software until it builds cryptographic download reputation with Microsoft telemetry. DROPZONE contains zero telemetry and zero adware. For full transparency, see [docs/WINDOWS_SIGNING_GUIDE.md](WINDOWS_SIGNING_GUIDE.md).

---

## 3. Verifying Cryptographic Checksums

Before running the installer or portable binary, you can verify its cryptographic integrity against our official hashes:

1. Open **PowerShell**.
2. Run:
   ```powershell
   Get-FileHash -Algorithm SHA256 .\DROPZONE-Setup-1.0.0-alpha.12-x64.exe
   ```
3. Compare the generated 64-character hash with the official values in [docs/RELEASE_CHECKSUMS.md](RELEASE_CHECKSUMS.md).

---

## 4. Setting Up FFmpeg (Recommended)

DROPZONE bundles a self-contained Python companion worker (`dropzone-worker.exe`) that executes `yt-dlp` and `gallery-dl`. **You do NOT need to install Python.**

However, for advanced post-processing tasks (such as merging high-resolution DASH video/audio streams, extracting MP3 audio from videos, or remuxing containers to MP4/MKV), **FFmpeg** is required:

### Option A: Install via WinGet (Easiest)
Open PowerShell and run:
```powershell
winget install Gyan.FFmpeg
```
Restart DROPZONE. The Dashboard and Settings pages will immediately show FFmpeg status as **Ready**.

### Option B: Portable Local Placement
1. Download a pre-built static build from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) or [ffmpeg.org](https://ffmpeg.org/).
2. Extract `ffmpeg.exe` and `ffprobe.exe`.
3. Copy both executables directly into:
   ```
   %APPDATA%\DROPZONE\resources\ffmpeg\
   ```
4. DROPZONE scans this folder automatically on startup.

---

## 5. Uninstallation

### Setup Installer:
- Go to Windows **Settings** > **Apps** > **Installed apps**.
- Find **DROPZONE**, click the three dots, and select **Uninstall**.
- All application binaries and shortcuts will be cleanly removed.
- *Optional*: Your download history and preferences are preserved in `%APPDATA%\DROPZONE\dropzone.db`. If you wish to completely wipe all local data, delete that folder.

### Portable Executable:
- Simply delete the `DROPZONE-Portable-*.exe` file and any generated local temp directories.

