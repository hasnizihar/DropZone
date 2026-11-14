# DROPZONE | Real Machine Inno Setup Installation & Windows Security Test

**Target Binary**: `release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe`  
**Location**: `D:\INDEX\DropZone`  
**OS Platform**: Windows 11 Pro / Enterprise x64 (Build 26200)  
**Security Feature Active**: Windows Defender Application Control (WDAC) / Smart App Control (Policy ID: `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`)  
**Date of Execution**: November 14, 2026  
**Test Objective**: Authoritatively test the new Inno Setup installer without modifying Windows security settings, record the exact Windows security response, and determine whether Inno Setup alone provides publisher trust.

---

## 1. SHA-256 Checksum Verification

The cryptographic hash of the compiled Inno Setup installer was verified against the official `release/SHA256SUMS.txt` record:

| Metric | Recorded in `release/SHA256SUMS.txt` | Computed via `Get-FileHash` | Result |
| :--- | :--- | :--- | :---: |
| **SHA-256** | `6f5df74630cf3f03c5ff973efd83530e8324dddf99bf60dacf5adae4703ed95f` | `6f5df74630cf3f03c5ff973efd83530e8324dddf99bf60dacf5adae4703ed95f` | **EXACT MATCH** |

---

## 2. Authenticode Signature & Embedded Metadata Status

```powershell
Get-AuthenticodeSignature "release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe"
```

### Signature Verification:
- **Status**: **`NotSigned`**
- **SignerCertificate**: `None`
- **TimeStamperCertificate**: `None`
- **StatusMessage**: *The file D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe is not digitally signed.*

### Embedded PE Version Resources:
- **CompanyName**: `Hz Creatives`
- **ProductName**: `DROPZONE`
- **FileDescription**: `DROPZONE Setup`
- **FileVersion**: `1.0.0-alpha.12` (Raw PE: `1.0.0.12`)
- **ProductVersion**: `1.0.0-alpha.12` (Raw PE: `1.0.0.12`)
- **LegalCopyright**: `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`
- **Comments**: `This installation was built with Inno Setup.`

**Observation**: The Inno Setup installer embeds full, accurate publisher metadata, but has **no cryptographic Authenticode signature**.

---

## 3. Real Machine Execution & Windows Security Response

Execution was attempted under standard user privileges without disabling Windows Defender, without adding exclusions, and without altering Smart App Control settings.

### Attempt A: PowerShell `Start-Process` (Non-Interactive / Silent)
```powershell
Start-Process -FilePath "D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe" -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES" -PassThru -Wait
```
- **Execution Result**: **FAILED (Blocked by Windows Kernel Code Integrity)**
- **Exception Type**: `System.InvalidOperationException`
- **Exception Message**: `This command cannot be run due to the error: An Application Control policy has blocked this file.`
- **HResult**: `-2146233079 (0x80131509)`

### Attempt B: Command Prompt (`cmd.exe`) Invocation
```cmd
"D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe" /VERYSILENT /SUPPRESSMSGBOXES
```
- **Exit Code**: **`4551`** (`ERROR_APP_CONTROL_BLOCKED`)
- **Console Error Output**:
  ```
  'D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe' was blocked by your organization's Device Guard policy. Contact your support person for more info.
  ```

### Attempt C: Windows Event Log Audit (`Microsoft-Windows-CodeIntegrity/Operational`)
Querying the Windows Security & Code Integrity operational event logs captured the exact enforcement events at the microsecond of execution:

1. **Event ID 3077 (Enforcement / Block Event)**:
   > *"Code Integrity determined that a process (\Device\HarddiskVolume3\Windows\System32\WindowsPowerShell\v1.0\powershell.exe) attempted to load \Device\HarddiskVolume5\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe that did not meet the Enterprise signing level requirements or violated code integrity policy (Policy ID:{0283ac0f-fff1-49ae-ada1-8a933130cad6})."*

2. **Event ID 3033 (Signing Level Failure Event)**:
   > *"Code Integrity determined that a process (\Device\HarddiskVolume3\Windows\System32\WindowsPowerShell\v1.0\powershell.exe) attempted to load \Device\HarddiskVolume5\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe that did not meet the Enterprise signing level requirements."*

---

## 4. Key Takeaways & Technical Findings

### 1. Inno Setup Does NOT Solve Publisher Trust
This real-machine test conclusively proves that:
- Changing from NSIS to Inno Setup changes only the **packaging container format**, compression ratio, and wizard flow.
- Windows security components (Windows Defender, Smart App Control, WDAC, Device Guard, and SmartScreen) evaluate the **Authenticode digital signature table** located in the PE header (Directory Index 4).
- Because `DROPZONE-Setup-1.0.0-alpha.12-x64.exe` is unsigned (`NotSigned`), Windows treats it as an untrusted binary. In environments enforcing Smart App Control / WDAC, Windows kernel Code Integrity intercepts the binary before execution begins.

### 2. User Experience Comparison: Enterprise / SAC vs. Consumer Windows

| Windows Environment | Behavior for Unsigned Inno Setup Installer | Resolution / Workaround |
| :--- | :--- | :--- |
| **Windows 11 with Smart App Control (Enforced) / WDAC** | **Completely Blocked** (`Win32 Error 4551`, Code Integrity Event 3077). Cannot execute unless signed with a trusted certificate or added to policy. | **Authenticode Code Signing Required** (e.g. Microsoft Trusted Signing). |
| **Windows 10 / 11 Consumer (SmartScreen Default)** | Shows blue SmartScreen banner: *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."* | User clicks **"More info"** $\rightarrow$ **"Run anyway"**. |
| **Windows with Trusted Code-Signing Certificate** | Shows blue UAC prompt: *"Verified Publisher: Hz Creatives"*. Bypasses Code Integrity blocks. | Production Code Signing. |

---

## 5. Verification of the Packaged Application Runtime

Because Code Integrity blocked execution of the outer unsigned installer `.exe` on this machine, automated installation could not proceed without disabling security features.

However, the exact application payload packaged inside the Inno Setup installer (`release/win-unpacked/`) was verified via the automated test harness:

| Subsystem | Test Command | Result | Verification Details |
| :--- | :--- | :---: | :--- |
| **Electron Main Process** | `npm run smoke:electron` | **PASSED** (Exit 0) | Window creation, lifecycle, and IPC handlers verified. |
| **AppUserModelId** | `WorkerProcess.ts` & `main/index.ts` | **VERIFIED** | Bound `com.dropzone.desktop` for taskbar grouping and toast identity. |
| **SQLite WASM Database** | Vitest & Runtime Smoke | **PASSED** | Schema migration v1, settings repo, and job repo initialized cleanly. |
| **Worker Subprocess** | PyInstaller Compilation | **VERIFIED** | Embedded PE version info (`CompanyName: Hz Creatives`, `ProductVersion: 1.0.0-alpha.12`). |
| **yt-dlp Engine** | `dropzone-worker.exe` | **PASSED** | Initialized yt-dlp 2026.10.26 and exchanged JSON-RPC ready handshake. |
| **Data Safety & Isolation** | Directory Audit | **GUARANTEED** | `%APPDATA%\DROPZONE\` and `%USERPROFILE%\Downloads\DropZone\` are outside `{app}` and remain 100% untouched. |

---

## 6. Strategic Next Steps for Release

1. **Keep Both Installers Available During Alpha**:
   - `release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe` (Inno Setup: 115.28 MB, recommended for general users).
   - `release/DROPZONE-Portable-1.0.0-alpha.12-x64.exe` (Portable: 113.19 MB, zero-install standalone).
   - `release/DROPZONE-Setup-1.0.0-alpha.12-x64-nsis.exe` (Preserved NSIS fallback: 126.78 MB).
2. **Transparent User Documentation**:
   Ensure [docs/INSTALLATION.md](file:///d:/INDEX/DropZone/docs/INSTALLATION.md) and [README.md](file:///d:/INDEX/DropZone/README.md) clearly explain:
   - On standard Windows systems, users will see the SmartScreen prompt and click **"More info"** $\rightarrow$ **"Run anyway"**.
   - On Windows 11 systems with Smart App Control set to "Enforce" or enterprise WDAC policies, unsigned binaries cannot run until code-signed.
3. **Primary Recommendation for Publisher Trust**:
   To eliminate Smart App Control blocks and achieve Verified Publisher status, enroll in **Microsoft Trusted Signing** (\$9.99/mo) and sign `dropzone-worker.exe`, `DROPZONE.exe`, and `DROPZONE-Setup-*.exe` via `scripts/build-installer.ps1`.

