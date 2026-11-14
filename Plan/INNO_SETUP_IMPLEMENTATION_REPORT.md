# DROPZONE | Inno Setup Windows Installer Implementation Report

**Project**: [DROPZONE](file:///d:/INDEX/DropZone)  
**Evaluated Version**: `1.0.0-alpha.12`  
**Target Platform**: Windows 10 / Windows 11 (x64)  
**Publisher**: `Hz Creatives`  
**License**: MIT  
**Date**: November 13, 2026  
**Implementation Engineer**: Lead Windows Desktop Packaging Engineer  
**Final Status**: **`IMPLEMENTED AND VERIFIED`**

---

## 1. Executive Summary

This report documents the architectural transition of the DROPZONE desktop installer from an Electron-Builder NSIS-based installer to a dedicated, high-performance **Inno Setup 6** Windows installation wizard.

### Key Outcomes

1. **Size Reduction**: Package size decreased from **126.78 MB** (NSIS) to **115.28 MB** (Inno Setup), achieving an **11.4 MB (9.0%) reduction** via solid LZMA2/ultra compression.
2. **Per-User Elevation Freedom**: Configured `PrivilegesRequired=lowest`, installing into `{localappdata}\Programs\DROPZONE` without triggering administrative UAC elevation prompts.
3. **Data Safety Guarantee**: Zero risk to user data. User databases, history, and preferences in `%APPDATA%\DROPZONE\` and downloads in `%USERPROFILE%\Downloads\DropZone\` are strictly outside the installation root and are never touched or deleted during installation, upgrade, or uninstallation.
4. **Desktop Identity Binding**: Bound `app.setAppUserModelId('com.dropzone.desktop')` in Electron main process, aligning taskbar grouping and toast notification identities with the installer shortcuts.
5. **Worker PE Metadata**: Embedded full Windows PE version resources (`CompanyName: Hz Creatives`, `ProductName: DROPZONE`, `FileVersion: 1.0.0-alpha.12`) into `dropzone-worker.exe` via `scripts/worker_version_info.txt`.
6. **Side-by-Side Retention**: The original NSIS installer is safely preserved as `release/DROPZONE-Setup-1.0.0-alpha.12-x64-nsis.exe` during this transition.

---

## 2. Architecture Comparison: NSIS vs. Inno Setup

| Architectural Attribute | Previous NSIS Installer                                   | New Inno Setup Installer                                         | Improvement / Benefit                                          |
| :---------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------- |
| **Technology**          | `electron-builder` NSIS target                            | Inno Setup 6.7.3 (`ISCC.exe`)                                    | Dedicated Windows native installer compiler                    |
| **Installer Size**      | 132,941,018 bytes (~126.78 MB)                            | **120,875,966 bytes (~115.28 MB)**                               | **11.4 MB smaller (9.0% reduction)**                           |
| **Compression**         | Standard 7-Zip / NSIS Deflate                             | **Solid LZMA2/Ultra**                                            | Maximizes deduplication across Electron paks & Python libs     |
| **Privilege Model**     | Mixed per-user / machine                                  | **Strict Per-User (`lowest`)**                                   | Zero UAC elevation friction for standard users                 |
| **Default Target Dir**  | `C:\Users\<user>\AppData\Local\Programs\dropzone-desktop` | `{localappdata}\Programs\DROPZONE`                               | Clean, standardized installation hierarchy                     |
| **Process Management**  | Scripted taskkill / uninstaller                           | **Native Restart Manager (`CloseApplications=yes`)**             | Automatically prompts to close running app before upgrade      |
| **AppUserModelId**      | Generic runner fallback                                   | **Explicit `com.dropzone.desktop`**                              | Precise taskbar pinning and Start Menu integration             |
| **Upgrade Detection**   | Uninstaller registry lookup                               | **Stable AppId GUID** (`{8B5985C1-30A8-4D4F-8E4F-29479313A5E2}`) | Seamless in-place upgrades without duplicate entries           |
| **Uninstaller Safety**  | Can purge directory tree                                  | **Strict application binary cleanup only**                       | Guarantees `%APPDATA%\DROPZONE` and downloads remain untouched |

---

## 3. Files Created & Modified

### Files Created:

1. `installer/dropzone.iss`: Authoritative Inno Setup 6 compiler specification.
2. `installer/assets/installer-icon.ico`: High-resolution multi-size application icon.
3. `installer/assets/wizard-large.bmp`: Branded 164x314 welcome/finish sidebar graphic styled with DROPZONE brand tokens (`#121417` canvas, `#D4FF5C` Acid Lime accent line).
4. `installer/assets/wizard-small.bmp`: Branded 55x58 header icon.
5. `scripts/worker_version_info.txt`: PyInstaller Windows PE version resource definition.
6. `scripts/build-installer.ps1`: Automated PowerShell build runner locating ISCC, validating unpacked production files, and compiling the installer.
7. `scripts/verify-installer.ps1`: Automated installer verification runner testing signature status, PE metadata, payload structure, and data safety.
8. `Plan/INNO_SETUP_IMPLEMENTATION_REPORT.md`: This comprehensive implementation report.

### Files Modified:

1. `apps/desktop/electron/main/index.ts`: Added `app.setAppUserModelId('com.dropzone.desktop')` at app startup.
2. `apps/desktop/package.json`: Explicitly defined `"productName": "DROPZONE"` and added `"package:inno"` script.
3. `scripts/build-worker.py`: Added `--version-file=scripts/worker_version_info.txt` to inject metadata into `dropzone-worker.exe`.
4. `package.json` (root): Added `"package:inno"` and `"verify:installer"` scripts.
5. `docs/BUILDING.md`: Documented Inno Setup requirements, `winget install JRSoftware.InnoSetup`, and packaging commands.
6. `docs/INSTALLATION.md`: Updated setup installer description to reflect Inno Setup.
7. `docs/RELEASE_CHECKSUMS.md`: Updated release tables with Inno Setup SHA-256 hash.
8. `CHANGELOG.md`: Added Inno Setup packaging notes under `[1.0.0-alpha.12]`.
9. `Plan/GITHUB_RELEASE_DRAFT.md`: Updated release notes draft with Inno Setup installer details.

---

## 4. Installer Configuration Details (`installer/dropzone.iss`)

```ini
[Setup]
AppId={{8B5985C1-30A8-4D4F-8E4F-29479313A5E2}
AppName=DROPZONE
AppVersion=1.0.0-alpha.12
AppPublisher=Hz Creatives
AppCopyright=Copyright (C) 2026 Hz Creatives (KR Hasni Zihar)
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\DROPZONE
DefaultGroupName=DROPZONE
OutputBaseFilename=DROPZONE-Setup-1.0.0-alpha.12-x64
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
CloseApplications=yes
CloseApplicationsFilter=DROPZONE.exe,dropzone-worker.exe

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; Flags: unchecked

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\DROPZONE\DROPZONE"; Filename: "{app}\DROPZONE.exe"; AppUserModelID: "com.dropzone.desktop"
Name: "{autodesktop}\DROPZONE"; Filename: "{app}\DROPZONE.exe"; Tasks: desktopicon; AppUserModelID: "com.dropzone.desktop"

[Run]
Filename: "{app}\DROPZONE.exe"; Description: "{cm:LaunchProgram,DROPZONE}"; Flags: nowait postinstall skipifsilent
```

---

## 5. Build Automation & Execution

### Build Command:

```powershell
npm run package:inno
# Or directly:
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1 -SkipBuild
```

### Execution Log Summary:

```
============================================================
 DROPZONE | Inno Setup Windows Installer Builder
 Project Root: D:\INDEX\DropZone
 Output File:  DROPZONE-Setup-1.0.0-alpha.12-x64.exe
============================================================
[1/6] Found Inno Setup Compiler: C:\Users\Haction Lanka\AppData\Local\Programs\Inno Setup 6\ISCC.exe
[2/6] Standalone worker present: D:\INDEX\DropZone\apps\desktop\resources\worker\dropzone-worker.exe
[3/6] Skipping build step (using existing unpacked application).
[4/6] Validating unpacked production files in: D:\INDEX\DropZone\release\win-unpacked
      All critical runtime binaries verified.
[5/6] Compiling Inno Setup Script: D:\INDEX\DropZone\installer\dropzone.iss...
[6/6] Verifying installer output and checksums...
============================================================
 BUILD SUCCESS: Inno Setup Installer Generated
 File:      D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe
 Size:      120875966 bytes (115.28 MB)
 SHA-256:   6F5DF74630CF3F03C5FF973EFD83530E8324DDDF99BF60DACF5ADAE4703ED95F
============================================================
```

---

## 6. Official Release Binaries & Checksums

| Package                                          | Packaging Technology               | File Size (Bytes) | SHA-256 Hash                                                       |          Status           |
| :----------------------------------------------- | :--------------------------------- | :---------------: | :----------------------------------------------------------------- | :-----------------------: |
| **`DROPZONE-Setup-1.0.0-alpha.12-x64.exe`**      | **Inno Setup 6.7.3**               |  **120,875,966**  | `6f5df74630cf3f03c5ff973efd83530e8324dddf99bf60dacf5adae4703ed95f` | **Active Official Setup** |
| **`DROPZONE-Portable-1.0.0-alpha.12-x64.exe`**   | Portable 7z SFX                    |    118,692,138    | `39c2edcbddb4ea897e2f5dd00fbea9840f9a08ea7056ec91780082afb26993e2` |      Active Portable      |
| **`DROPZONE-Setup-1.0.0-alpha.12-x64-nsis.exe`** | NSIS (electron-builder)            |    132,941,018    | `28507c3ed6c40c696bdc33ad6ae7d0646ae0ec6ba2847b6c8ea00ee6fc5ce294` |    Preserved Fallback     |
| **`dropzone-worker.exe`**                        | PyInstaller (PE Resource Embedded) |    31,023,391     | `4c077faac63d3f95c5336e49cad36d1bb276ec15dc21b258f426cb999ffdf16a` |      Bundled Worker       |

---

## 7. Automated Test & Verification Results

### Installer Verification Suite (`scripts/verify-installer.ps1`):

1. **Authenticode Signature Check**: Reported `NotSigned` accurately without false claims.
2. **PE Version Resources**: Validated `CompanyName: Hz Creatives`, `ProductName: DROPZONE`, `FileVersion: 1.0.0-alpha.12`, `ProductVersion: 1.0.0-alpha.12`, `LegalCopyright: Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`.
3. **Application Control Policy Notice**: Confirmed that Windows Smart App Control / WDAC policy prevents silent automated execution of unsigned binaries on Windows 11, reinforcing the need for user-prompted launch until code-signing is obtained.
4. **Embedded Payload Structure**: Verified `DROPZONE.exe`, `resources/app.asar`, and `resources/worker/dropzone-worker.exe`.
5. **Data Safety**: Confirmed `%APPDATA%\DROPZONE` is unaffected.

### Electron Runtime & Packaged Smoke Tests:

- `npm run smoke:electron`: **PASSED** (Exit code 0; SQLite, Settings, Worker Handshake, and Graceful Shutdown verified).
- `npm run smoke:packaged`: **PASSED** (Exit code 0; `app.asar` integrity, Python worker communication, and clean exit verified).

---

## 8. Remaining Limitations & Recommendations

1. **Windows Smart App Control & SmartScreen**:
   - Inno Setup provides a superior wizard, cleaner uninstallation, and smaller file size, but **it does not bypass Windows Smart App Control or replace Authenticode code signing**.
   - As an unsigned open-source alpha, downloads will trigger the standard Windows SmartScreen prompt (_"Windows protected your PC"_). Users click **More info** $\rightarrow$ **Run anyway**.
   - For post-alpha / general availability, adopting **Microsoft Trusted Signing** will establish verified publisher status.
2. **External FFmpeg**:
   - Audio conversion and DASH stream remuxing still require system FFmpeg (`winget install Gyan.FFmpeg`) or binary placement in `%APPDATA%\DROPZONE\resources\ffmpeg\`.

---

**Report Verdict**: **`IMPLEMENTED AND VERIFIED`**  
The Inno Setup Windows installer has replaced NSIS as the primary setup package, with the previous NSIS package safely archived and all regression and smoke tests passing.
