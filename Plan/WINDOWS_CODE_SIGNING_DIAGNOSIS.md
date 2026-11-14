# DROPZONE | Windows Application Control & Code-Signing Diagnostic Report

**Project**: [DROPZONE](file:///d:/INDEX/DropZone)  
**Target Binary**: [`release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe`](file:///d:/INDEX/DropZone/release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe)  
**Location**: `D:\INDEX\DropZone`  
**Diagnostic Date**: November 14, 2026  
**Auditor**: Lead Windows Systems & Release Engineer  
**Document Status**: **FINAL FORENSIC DIAGNOSIS**

---

## 1. Executive Summary & Forensic Verdict

Following real-machine testing where the newly compiled Inno Setup installer (`DROPZONE-Setup-1.0.0-alpha.12-x64.exe`) was blocked by Windows security with error code `4551` and Event ID `3077`, an in-depth forensic investigation of the operating system's Code Integrity subsystems was conducted.

### Core Forensic Conclusions

1. **The Blocking Policy Is Smart App Control (SAC), NOT Enterprise WDAC**:
   - The blocking policy ID is `{0283AC0F-FFF1-49AE-ADA1-8A933130CAD6}`.
   - Code Integrity operational event property `Property[18]` explicitly names the policy: **`VerifiedAndReputableDesktop`**.
   - `VerifiedAndReputableDesktop` is Microsoft's official internal policy name for **Windows 11 Smart App Control**.
   - Registry inspection confirms `VerifiedAndReputablePolicyState = 1` (**Enforced**).
2. **The Machine Is NOT Organization-Managed**:
   - `PartOfDomain: False`, `Domain: WORKGROUP`, `Workgroup: WORKGROUP`.
   - The test machine is a standalone developer PC (`ZIHARHASNI`). There are no third-party enterprise MDM (Intune, AirWatch) or corporate Active Directory Group Policy Objects imposing custom whitelist rules.
3. **Why the Error Said "Device Guard Policy"**:
   - Windows 11 implements Smart App Control directly on top of the underlying Windows Defender Application Control (WDAC) / Device Guard kernel architecture. When SAC intercepts an untrusted executable, `cmd.exe` outputs the standard Windows Device Guard kernel error string (`Win32 Error 4551: ERROR_APP_CONTROL_BLOCKED`).
4. **Will a Publicly Trusted Commercial OV Certificate Satisfy This Policy?**:
   - **YES**. Smart App Control evaluates executables using a dual-gate model:
     - Gate 1: Microsoft Cloud AI reputation (newly compiled binaries have zero reputation).
     - Gate 2: **Valid Authenticode digital signature chaining to a root in the Microsoft Trusted Root Certificate Program**.
     - Because DROPZONE is currently `NotSigned`, it was blocked at Gate 2. Signing the installer, main executable, companion worker, and DLLs with a publicly trusted commercial Authenticode certificate (OV or Individual) **will satisfy the policy and permit execution**.
5. **Geographic Limitation Regarding Microsoft Trusted Signing**:
   - As correctly identified, **Microsoft Trusted Signing (formerly Azure Code Signing) is currently unavailable in Sri Lanka**. Microsoft restricts individual trust to the US and Canada, and organization trust to a limited set of eligible nations that excludes Sri Lanka.
   - Therefore, the recommended path for DROPZONE is a traditional **Organization Validation (OV)** or **Individual Code Signing Certificate** from a globally recognized CA supporting cloud HSM (e.g., **SSL.com eSigner** or **Certum SimplySign**).

---

## 2. Empirical Windows Diagnostic Findings

### 2.1 DeviceGuard WMI Inspection
```powershell
Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard
```

| WMI Property | Reported Value | Interpretation |
| :--- | :--- | :--- |
| **VirtualizationBasedSecurityStatus** | `2` | Virtualization-Based Security (VBS) is enabled and active. |
| **SecurityServicesConfigured** | `2` | Hypervisor-Enforced Code Integrity (HVCI) configured. |
| **SecurityServicesRunning** | `2, 7` | HVCI and Credential Guard / App Control active. |
| **UsermodeCodeIntegrityPolicyEnforcementStatus** | `2` | **Enforcement Mode Active** (User-mode code integrity policies are strictly enforced). |

### 2.2 System & Management Status
```powershell
Get-CimInstance Win32_ComputerSystem | Select-Object PartOfDomain, Domain, Workgroup
```
- **Computer Name**: `ZIHARHASNI`
- **PartOfDomain**: `False`
- **Domain**: `WORKGROUP`
- **Workgroup**: `WORKGROUP`
- **Verdict**: Standalone workstation. No corporate domain controller or enterprise IT administrator is managing code-signing policies.

### 2.3 Smart App Control (SAC) Registry Status
```powershell
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
```

| Registry Value | Data | Microsoft Source Meaning |
| :--- | :---: | :--- |
| **`VerifiedAndReputablePolicyState`** | **`1`** | **Smart App Control is ON / ENFORCED** (`0` = Off, `1` = Enforced, `2` = Evaluation). |
| **`AppControlEnforcementPolicy`** | `""` | No secondary custom enterprise XML policy applied. |

### 2.4 Active Code Integrity Policies on Disk
Located in `C:\Windows\System32\CodeIntegrity\CiPolicies\Active\`:

| Policy File Name | File Size | Origin / Description |
| :--- | :---: | :--- |
| **`{0283AC0F-FFF1-49AE-ADA1-8A933130CAD6}.cip`** | **7,079 bytes** | **Smart App Control (`VerifiedAndReputableDesktop`) Policy** |
| `{0939ED82-BFD5-4D32-B58E-D31D3C49715A}.cip` | 4,893 bytes | Microsoft Windows Kernel Component Policy |
| `{1283AC0F-FFF1-49AE-ADA1-8A933130CAD6}.cip` | 79,907 bytes | Microsoft Supplemental Driver Blocklist |
| `{1678656C-05EF-481F-BC5B-EBD8C991502D}.cip` | 4,655 bytes | Microsoft OS Component Code Integrity |
| `{1939ED82-BFD5-4D32-B58E-D31D3C49715A}.cip` | 4,913 bytes | Microsoft Default Base Policy |
| `{2678656C-05EF-481F-BC5B-EBD8C991502D}.cip` | 4,660 bytes | Microsoft Default Supplemental Policy |
| `{60FD87F8-4593-44A0-91B0-2E0DA022F248}.cip` | 10,853 bytes | Microsoft Vulnerable Driver Blocklist |
| `{784C4414-79F4-4C32-A6A5-F0FB42A51D0D}.cip` | 196,506 bytes | Microsoft Windows Recommended Driver Block Rules |

**Finding**: All `.cip` policy files on disk are standard Microsoft baseline policies shipped with Windows 11. There are **zero custom enterprise policies**.

### 2.5 Code Integrity Operational Event Log Audit
```powershell
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-CodeIntegrity/Operational'; Id=3077}
```

```
Event Time:    11/14/2026 10:02:19
Event ID:      3077 (Enforcement / Block Event)
Process:       \Device\HarddiskVolume3\Windows\System32\cmd.exe
Target File:   \Device\HarddiskVolume5\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe
Message:       Code Integrity determined that a process attempted to load ... that did not meet the 
               Enterprise signing level requirements or violated code integrity policy (Policy ID:{0283ac0f-fff1-49ae-ada1-8a933130cad6}).

--- Detailed Event Property Deserialization ---
Property[1]:   Target Path  = \Device\HarddiskVolume5\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe
Property[3]:   Parent Proc  = \Device\HarddiskVolume3\Windows\System32\cmd.exe
Property[18]:  Policy Name  = VerifiedAndReputableDesktop
Property[20]:  Policy Build = 27555.1000.240208
Property[28]:  Description  = DROPZONE Setup
Property[30]:  Product Name = DROPZONE
Property[31]:  Version      = 1.0.0.12
Property[32]:  Policy GUID  = 0283ac0f-fff1-49ae-ada1-8a933130cad6
```

---

## 3. How Smart App Control (`VerifiedAndReputableDesktop`) Operates

The following decision diagram illustrates how the active policy on this Windows 11 machine evaluates executables:

```
                  ┌──────────────────────────────────────────────┐
                  │       Target Binary Execution Request        │
                  │   (e.g., DROPZONE-Setup-1.0.0-alpha.12.exe)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │      Gate 1: Microsoft Cloud AI Service      │
                  │       Does file SHA-256 have positive        │
                  │             cloud reputation?                │
                  └──────────────┬───────────────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     │ NO (New Binary)       │ YES (Known Safe)
                     ▼                       ▼
      ┌──────────────────────────────┐   ┌───────────────────────┐
      │ Gate 2: Authenticode Check   │   │        ALLOWED        │
      │ Is binary signed by a valid  │   │  Execution Proceeds   │
      │ CA in Microsoft Root Program?│   └───────────────────────┘
      └──────────────┬───────────────┘
                     │
         ┌───────────┴───────────┐
         │ NO                    │ YES
         ▼                       ▼
┌─────────────────────────────┐  ┌───────────────────────────────┐
│           BLOCKED           │  │            ALLOWED            │
│  Win32 Error 4551           │  │   Authenticode Chain Valid    │
│  Code Integrity Event 3077  │  │   Execution Proceeds          │
└─────────────────────────────┘  └───────────────────────────────┘
```

### Why DROPZONE Was Blocked:
1. `DROPZONE-Setup-1.0.0-alpha.12-x64.exe` was compiled locally on November 13, 2026. Microsoft Cloud AI has never seen its SHA-256 hash (`6f5df746...`). Gate 1 produced an **unknown** determination.
2. The kernel proceeded to Gate 2. It inspected the executable's digital signature table.
3. The signature status was **`NotSigned`**.
4. The policy enforced a block, generating Event 3077 and returning Win32 error `4551`.

---

## 4. Complete Inventory of Binaries Requiring Signing

When Usermode Code Integrity Enforcement is active (`UsermodeCodeIntegrityPolicyEnforcementStatus = 2`), every executable and dynamic link library (.dll) loaded into memory must be signed. If only the installer is signed, the installer will run, but the installed application or companion worker will be blocked upon execution.

### Complete Signing Inventory:

| Component Type | Relative Path | Size | Current Status | Required Signing Step |
| :--- | :--- | :---: | :---: | :--- |
| **Setup Wizard** | `release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe` | 115.28 MB | `NotSigned` | Must be signed post-Inno compilation |
| **Portable Launcher** | `release/DROPZONE-Portable-1.0.0-alpha.12-x64.exe` | 113.19 MB | `NotSigned` | Must be signed post-portable packaging |
| **Electron Main** | `release/win-unpacked/DROPZONE.exe` | 181.74 MB | `NotSigned` | Must be signed before installer packaging |
| **Python Worker** | `resources/worker/dropzone-worker.exe` | 29.58 MB | `NotSigned` | Must be signed before Electron bundling |
| **Inno Uninstaller** | `unins000.exe` (generated at install time) | ~1.5 MB | N/A | Must be signed via Inno `SignedUninstaller=yes` |
| **Chromium Media** | `win-unpacked/ffmpeg.dll` | 2.84 MB | `NotSigned` | Must be signed before Electron bundling |
| **DirectX EGL** | `win-unpacked/libEGL.dll` | 479 KB | `NotSigned` | Must be signed before Electron bundling |
| **DirectX GLES** | `win-unpacked/libGLESv2.dll` | 7.73 MB | `NotSigned` | Must be signed before Electron bundling |
| **SwiftShader** | `win-unpacked/vk_swiftshader.dll` | 5.25 MB | `NotSigned` | Must be signed before Electron bundling |
| **Vulkan Loader** | `win-unpacked/vulkan-1.dll` | 856 KB | `NotSigned` | Must be signed before Electron bundling |
| *DirectX Compiler* | `win-unpacked/d3dcompiler_47.dll` | 4.68 MB | **`Valid`** | *(Already signed by Microsoft Corporation)* |

---

## 5. Commercial Code-Signing Analysis (Accounting for Regional Eligibility)

### 5.1 Why Microsoft Trusted Signing Is Ineligible
- Microsoft Trusted Signing requires identity vetting via Au10tix / Microsoft KYC.
- **Individual Public Trust**: Strictly limited to US and Canada.
- **Organization Public Trust**: Supported only in ~40 select countries. **Sri Lanka is not supported**.
- Attempting to use Microsoft Trusted Signing from Sri Lanka will fail at the Azure Identity Verification step.

### 5.2 Viable Commercial Certificate Authorities for Sri Lanka

Since June 1, 2023, CA/Browser Forum Baseline Requirements prohibit exporting private keys as local `.pfx` files. All code-signing keys must be stored on FIPS 140-2 Level 2 hardware. For developers in Sri Lanka, there are two practical approaches:

```
                                  Code-Signing Delivery Options
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
   ┌───────────────────────────┐                                 ┌───────────────────────────┐
   │    Physical Hardware      │                                 │     Cloud HSM / KMS       │
   │  FIPS USB Token (SafeNet) │                                 │  (Remote Digital Signing) │
   └─────────────┬─────────────┘                                 └─────────────┬─────────────┘
                 │                                                             │
   • Requires physical courier to Sri Lanka                      • Zero hardware shipping required
   • High international shipping & customs fees                  • Instant access via cloud CLI
   • Risk of hardware failure or loss                            • Fully automatable in CI/CD
   • Manual USB attachment for builds                            • Examples: SSL.com eSigner, Certum
```

#### Comparison of Global Certificate Authorities Supporting Sri Lanka:

| Certificate Provider | Supported Entity Types | Key Storage Method | Estimated Cost (Annual) | Suitability for DROPZONE |
| :--- | :--- | :--- | :---: | :--- |
| **SSL.com (eSigner)** | **Individual & Organization** | **Cloud HSM (eSigner)** | **\$249 - \$349 / yr** | **Highest Recommendation**. Global vetting, cloud signing CLI (`CodeSignTool`), zero shipping delays. |
| **Certum (SimplySign)** | **Individual & Organization** | **Cloud HSM (SimplySign)** | **€260 - €320 / yr** (~$280/yr) | **Strong Recommendation**. One of the only EU CAs explicitly validating individual developers in South Asia. |
| **Sectigo (via Resellers)** | Organization Only (Requires ROC) | Physical USB Token | \$220 - \$350 / yr + \$120 shipping | Moderate. Requires physical SafeNet USB delivery to Sri Lanka and formal corporate business registration. |
| **DigiCert** | Organization Only | Physical USB or DigiCert ONE | \$450 - \$800+ / yr | Prohibitive cost for an independent open-source project. |

### 5.3 Individual vs. Organization Requirements in Sri Lanka
- **Individual Validation (IV)**:
  - Requires: National Identity Card (NIC) or Sri Lankan Passport, proof of residence (recent utility bill or bank statement), biometric liveness check.
  - Certificate Subject: `CN = KR Hasni Zihar, O = KR Hasni Zihar, C = LK`.
  - Windows UAC Prompt: `Verified Publisher: KR Hasni Zihar`.
- **Organization Validation (OV)**:
  - Requires: Department of Registrar of Companies (ROC) Sri Lanka registration certificate (PV number / Form 1), registered office address, Dun & Bradstreet (D-U-N-S) listing, official telephone verification.
  - Certificate Subject: `CN = Hz Creatives, O = Hz Creatives, C = LK`.
  - Windows UAC Prompt: `Verified Publisher: Hz Creatives`.

---

## 6. Recommended Signing Pipeline Integration

When a certificate is acquired (e.g., via SSL.com eSigner or Certum SimplySign), signing is automated through a unified signing hook:

### 6.1 Dependency Build Order:
```
Step 1: Compile PyInstaller Worker
   └─ scripts/build-worker.py (embeds PE resources)
   └─ Sign: apps/desktop/resources/worker/dropzone-worker.exe
        │
Step 2: Build Unpacked Electron Runtime
   └─ npm run build:electron && vite build
   └─ electron-builder --win --dir
   └─ Sign all binaries in release/win-unpacked/:
        DROPZONE.exe, ffmpeg.dll, libEGL.dll, libGLESv2.dll, vk_swiftshader.dll, vulkan-1.dll
        │
Step 3: Compile Inno Setup Package
   └─ installer/dropzone.iss (with SignedUninstaller=yes)
   └─ Inno Setup automatically signs unins000.exe
   └─ Compile DROPZONE-Setup-1.0.0-alpha.12-x64.exe
   └─ Sign: release/DROPZONE-Setup-1.0.0-alpha.12-x64.exe
        │
Step 4: Compile Portable Package
   └─ electron-builder --win portable
   └─ Sign: release/DROPZONE-Portable-1.0.0-alpha.12-x64.exe
        │
Step 5: Generate Cryptographic Hashes (POST-SIGNING)
   └─ Calculate SHA-256 on all signed release binaries
   └─ Overwrite release/SHA256SUMS.txt and docs/RELEASE_CHECKSUMS.md
```

### 6.2 Proposed Signing Script Hook (`scripts/sign-binary.ps1`):
```powershell
param(
    [Parameter(Mandatory=$true)][string]$FilePath
)

# Example for SSL.com eSigner Cloud HSM:
# & CodeSignTool.exe sign -input_file_path $FilePath -username $env:ESIGNER_USER -password $env:ESIGNER_PASS -totp_secret $env:ESIGNER_TOTP

# Example for Windows SDK signtool with USB Token / Certum SimplySign:
$signtool = "signtool.exe"
$args = @(
    "sign",
    "/fd", "SHA256",
    "/tr", "http://timestamp.digicert.com",
    "/td", "SHA256",
    "/sm",
    "/n", "Hz Creatives",
    $FilePath
)
& $signtool $args
```

---

## 7. Concrete Decision Matrix & Next Steps

### Immediate Recommendation for Current Release (`v1.0.0-alpha.12`):
1. **Maintain Packaging Stability**:
   - The Inno Setup installer (`115.28 MB`) and Portable binary (`113.19 MB`) are complete, well-compressed, and verified.
   - Do not rebuild or modify the binaries further.
2. **Document Windows 11 Smart App Control Behavior Transparently**:
   - Update user documentation to clarify that on **consumer Windows machines**, standard SmartScreen displays *"Windows protected your PC"*, which users bypass via **"More info"** $\rightarrow$ **"Run anyway"**.
   - Note that on systems with **Smart App Control Enforced**, unsigned open-source applications cannot execute without a code-signing certificate.
3. **Target Code-Signing Acquisition for General Availability**:
   - For public releases requiring seamless execution under Smart App Control, acquire an Individual or Organization Code Signing certificate via **SSL.com (eSigner)** or **Certum (SimplySign)** to bypass geographic limitations while eliminating hardware token shipping.

