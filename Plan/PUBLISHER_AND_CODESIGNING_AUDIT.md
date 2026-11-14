# DROPZONE | Publisher Identity & Windows Code-Signing Audit

**Project**: [DROPZONE](file:///d:/INDEX/DropZone)  
**Evaluated Version**: `1.0.0-alpha.12`  
**Platform**: Windows 10 / Windows 11 (x64)  
**Publisher / Brand**: `Hz Creatives`  
**Author / Copyright Holder**: `KR Hasni Zihar (Hz Creatives)`  
**Legal Copyright**: `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`  
**License**: MIT  
**Date of Audit**: November 13, 2026  
**Auditor**: Lead Windows Systems & Release Engineer  

---

## 1. Executive Summary

This audit provides an exhaustive, evidence-backed evaluation of the publisher identity configuration, Windows Authenticode digital signatures, and SmartScreen trust profile for the DROPZONE universal desktop download manager.

### Key Findings & Verdicts

| Dimension | Audit Status | Current State |
| :--- | :---: | :--- |
| **Authenticode Signature** | **`UNSIGNED`** | Neither the installer, portable binary, nor bundled worker executable possess a digital signature. |
| **Windows Verified Publisher** | **`ACTION REQUIRED`** | Windows Defender SmartScreen and Windows UAC report the application as **"Unknown Publisher"**. |
| **Installer PE Metadata** | **`METADATA VERIFIED`** | `DROPZONE-Setup-*.exe` and `DROPZONE-Portable-*.exe` correctly declare `Hz Creatives` in PE resources. |
| **Worker Subprocess PE Metadata** | **`ACTION REQUIRED`** | `dropzone-worker.exe` contains **zero** Windows version information (CompanyName, FileDescription, etc. are empty). |
| **Runtime Identity Binding** | **`ACTION REQUIRED`** | `app.setAppUserModelId('com.dropzone.desktop')` is missing from the Electron main process startup sequence. |

> [!CRITICAL]
> **Metadata is NOT Authentication**: Plain-text Windows PE resource metadata (`CompanyName: "Hz Creatives"`) is completely distinct from a cryptographic Authenticode digital signature. Windows UAC and SmartScreen ignore PE strings and treat all unsigned executables as untrusted regardless of the declared company name. DROPZONE does **not** currently have a Verified Publisher signature on Windows.

---

## 2. Current Publisher Metadata Inventory

Every layer of the project's manifests and configuration files was inspected to map how publisher identity is declared across the codebase:

| Location | Property | Configured Value | Status / Alignment |
| :--- | :--- | :--- | :---: |
| **`package.json` (root)** | `name` | `dropzone-root` | Monorepo Root |
| | `version` | `1.0.0-alpha.12` | Synced |
| | `author` | `Hz Creatives (KR Hasni Zihar)` | Aligned |
| | `description` | `Universal Desktop Download Manager` | Aligned |
| | `license` | `MIT` | Aligned |
| **`apps/desktop/package.json`** | `name` | `@dropzone/desktop` | Workspace Package |
| | `productName` | *(Missing - not defined)* | **Inconsistency** (defined only in YML) |
| | `version` | `1.0.0-alpha.12` | Synced |
| | `author` | `Hz Creatives (KR Hasni Zihar)` | Aligned |
| | `description` | `Universal Desktop Download Manager` | Aligned |
| | `license` | `MIT` | Aligned |
| **`packages/shared/package.json`** | `name` | `@dropzone/shared` | Synced |
| | `version` | `1.0.0-alpha.12` | Synced |
| | `author` | `Hz Creatives (KR Hasni Zihar)` | Aligned |
| **`apps/desktop/electron-builder.yml`** | `appId` | `com.dropzone.desktop` | Aligned |
| | `productName` | `DROPZONE` | Aligned |
| | `copyright` | `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)` | Aligned |
| | `win.legalTrademarks` | `DROPZONE is an open-source project by Hz Creatives.` | Aligned |
| | `win.signtoolOptions.publisherName` | `Hz Creatives` | Configured (signing disabled) |
| | `nsis.shortcutName` | `DROPZONE` | Aligned |
| **`backend/worker/pyproject.toml`** | `project.name` | `dropzone-worker` | Aligned |
| | `project.version` | `1.0.0` | Internal Worker |
| | `project.authors` | `Hz Creatives (KR Hasni Zihar)` | Aligned |
| **`LICENSE`** | Copyright Header | `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)` | Aligned |
| **`THIRD_PARTY_NOTICES.md`** | Attribution | Hz Creatives & upstream acknowledgements | Aligned |

---

## 3. Current Digital-Signature Status

All binaries currently present in the release and resource directories were inspected using PowerShell's native cryptographic command:

```powershell
Get-AuthenticodeSignature <path_to_binary>
```

### Empirical Signature Results

| Target Binary | File Size | Authenticode Status | Status Message | Signer Certificate |
| :--- | :---: | :---: | :--- | :---: |
| `release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe` | 132,941,018 B | **`NotSigned`** | *The file is not digitally signed.* | `None` |
| `release\DROPZONE-Portable-1.0.0-alpha.12-x64.exe` | 118,692,138 B | **`NotSigned`** | *The file is not digitally signed.* | `None` |
| `release\win-unpacked\DROPZONE.exe` | 179,307,520 B | **`NotSigned`** | *The file is not digitally signed.* | `None` |
| `apps\desktop\resources\worker\dropzone-worker.exe` | 31,020,443 B | **`NotSigned`** | *The file is not digitally signed.* | `None` |
| `release\win-unpacked\resources\worker\dropzone-worker.exe` | 31,020,443 B | **`NotSigned`** | *The file is not digitally signed.* | `None` |

**Conclusion**: Not a single executable in the DROPZONE release artifact tree is signed. Code-signing is completely bypassed during packaging.

---

## 4. Binary-by-Binary Verification Results

Inspection of executable version resources (`(Get-Item <exe>).VersionInfo`) revealed the following embedded attributes:

### 4.1 NSIS Installer: `DROPZONE-Setup-1.0.0-alpha.12-x64.exe`
- **Authenticode Status**: `NotSigned`
- **CompanyName**: `Hz Creatives`
- **ProductName**: `DROPZONE`
- **FileDescription**: `Universal Desktop Download Manager`
- **FileVersion**: `1.0.0-alpha.12`
- **ProductVersion**: `1.0.0-alpha.12`
- **LegalCopyright**: `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`
- **LegalTrademarks**: `DROPZONE is an open-source project by Hz Creatives.`
- **InternalName**: *(Empty)*
- **OriginalFilename**: *(Empty)*
- **Status Evaluation**: `METADATA VERIFIED` / `UNSIGNED`

### 4.2 Portable Executable: `DROPZONE-Portable-1.0.0-alpha.12-x64.exe`
- **Authenticode Status**: `NotSigned`
- **CompanyName**: `Hz Creatives`
- **ProductName**: `DROPZONE`
- **FileDescription**: `Universal Desktop Download Manager`
- **FileVersion**: `1.0.0-alpha.12`
- **ProductVersion**: `1.0.0-alpha.12`
- **LegalCopyright**: `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`
- **LegalTrademarks**: `DROPZONE is an open-source project by Hz Creatives.`
- **InternalName**: *(Empty)*
- **OriginalFilename**: *(Empty)*
- **Status Evaluation**: `METADATA VERIFIED` / `UNSIGNED`

### 4.3 Unpacked Electron Main Binary: `release\win-unpacked\DROPZONE.exe`
- **Authenticode Status**: `NotSigned`
- **CompanyName**: `Hz Creatives`
- **ProductName**: `DROPZONE`
- **FileDescription**: `DROPZONE`
- **FileVersion**: `1.0.0-alpha.12`
- **ProductVersion**: `1.0.0.0` *(Electron PE 4-part numeric format)*
- **LegalCopyright**: `Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)`
- **LegalTrademarks**: `DROPZONE is an open-source project by Hz Creatives.`
- **InternalName**: `DROPZONE`
- **OriginalFilename**: *(Empty)*
- **Status Evaluation**: `METADATA VERIFIED` / `UNSIGNED`

### 4.4 Standalone Companion Worker: `dropzone-worker.exe`
- **Authenticode Status**: `NotSigned`
- **CompanyName**: `""` *(Empty / Unset)*
- **ProductName**: `""` *(Empty / Unset)*
- **FileDescription**: `""` *(Empty / Unset)*
- **FileVersion**: `""` *(Empty / Unset)*
- **ProductVersion**: `""` *(Empty / Unset)*
- **LegalCopyright**: `""` *(Empty / Unset)*
- **LegalTrademarks**: `""` *(Empty / Unset)*
- **InternalName**: `""` *(Empty / Unset)*
- **OriginalFilename**: `""` *(Empty / Unset)*
- **Status Evaluation**: **`ACTION REQUIRED`** / `UNSIGNED`

---

## 5. Metadata Inconsistencies & Omissions

The repository audit identified three concrete metadata defects that should be corrected:

### 1. PyInstaller Worker Lacks PE Version Resources
- **Issue**: `scripts/build-worker.py` invokes PyInstaller with `--onefile` and hidden imports, but does not provide `--version-file`. Consequently, PyInstaller emits an executable with completely blank PE version headers.
- **Impact**: In Windows File Explorer, Properties $\rightarrow$ Details is blank. Windows Defender Application Control (WDAC) and Smart App Control (SAC) treat anonymous executables with higher suspicion.
- **Remediation**: Create a `scripts/worker_version_info.txt` definition file containing CompanyName, FileDescription, LegalCopyright, and FileVersion, and add `--version-file=scripts/worker_version_info.txt` to `pyinstaller_args`.

### 2. Missing `app.setAppUserModelId` in Main Process
- **Issue**: While `electron-builder.yml` configures `appId: com.dropzone.desktop`, `apps/desktop/electron/main/index.ts` never invokes `app.setAppUserModelId('com.dropzone.desktop')` during application initialization.
- **Impact**: Windows taskbar icon grouping, jump lists, and desktop toast notifications are associated with generic Electron process identifiers instead of the authoritative DROPZONE application identity.
- **Remediation**: Insert `app.setAppUserModelId('com.dropzone.desktop');` immediately before `createWindow()` in `index.ts`.

### 3. FileDescription Discrepancy Between Unpacked and Installer Executables
- **Issue**: In `win-unpacked/DROPZONE.exe`, `FileDescription` is `"DROPZONE"`. In `DROPZONE-Setup-*.exe` and `DROPZONE-Portable-*.exe`, `FileDescription` is `"Universal Desktop Download Manager"`.
- **Impact**: Cosmetic difference in Task Manager processes vs. Installer prompts.
- **Remediation**: Explicitly set `"productName": "DROPZONE"` in `apps/desktop/package.json` to harmonize Electron's auto-generated metadata.

---

## 6. Windows Publisher Identity & Trust Model

Understanding how Windows establishes publisher identity is crucial for setting release expectations.

```
                  ┌──────────────────────────────────────────────┐
                  │          Windows Application Binary          │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │    PE Resource Strings    │                   │   Authenticode Signature  │
   │  (CompanyName, Version)   │                   │ (PKCS #7 / SHA-256 Hash)  │
   └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                 │                                               │
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │      INFORMATIONAL        │                   │      AUTHENTICATION       │
   │ Explorer File Properties  │                   │  Cryptographic Integrity  │
   │  Zero Security Guarantee  │                   │   Identity Verification   │
   └───────────────────────────┘                   └─────────────┬─────────────┘
                                                                 │
                                                   ┌─────────────┴─────────────┐
                                                   ▼                           ▼
                                     ┌───────────────────────────┐┌───────────────────────────┐
                                     │    User Account Control   ││   Defender SmartScreen    │
                                     │  "Verified Publisher: X"  ││  Cloud Reputation Model   │
                                     └───────────────────────────┘└───────────────────────────┘
```

### 6.1 The 4 Levels of Windows Trust

#### A. Application Publisher Metadata (Unsigned)
- Plain-text strings embedded in the binary's resource section.
- Any party can insert any company name without proof or cost.
- **Windows Behavior**: Ignored by security systems. Windows UAC displays a generic yellow/amber elevation prompt with **"Publisher: Unknown"**. Windows SmartScreen flags the download as potentially untrusted.

#### B. Self-Signed Certificate
- A certificate generated locally by the developer (`New-SelfSignedCertificate`).
- Not anchored in the Microsoft Trusted Root Certification Authorities program.
- **Windows Behavior**: Triggers error `CERT_E_UNTRUSTEDROOT` (`0x800B0109`). SmartScreen presents an aggressive block. UAC warns that the certificate is untrusted. Provides **no benefit** for public distribution and can increase user friction compared to unsigned binaries.

#### C. Trusted Authenticode Digital Signature
- Issued by a publicly trusted Certificate Authority (CA) audited under the WebTrust / CA/Browser Forum rules (DigiCert, Sectigo, SSL.com, GlobalSign, or Microsoft Trusted Signing).
- The CA rigorously vets the legal applicant (KYC/KYB):
  - Validates government ID or corporate registry filings.
  - Confirms physical existence, domain ownership, and phone number.
- **Windows Behavior**: Cryptographically proves the binary has not been modified since signing. Windows UAC displays a blue prompt with **"Verified Publisher: Hz Creatives"**.

#### D. Windows SmartScreen Cloud Reputation
- SmartScreen is an independent, telemetry-driven cloud reputation system operated by Microsoft Defender.
- **Crucial Rule**: Having a valid Authenticode signature does **NOT** grant instant SmartScreen reputation!
- Reputation is tied to the certificate's public key hash and the application's file hash. It accumulates as Windows users across the world download, install, and execute the file without malware detections.
- Historically, EV (Extended Validation) certificates received immediate reputation; however, under modern Microsoft policies, even newly issued EV certificates and Microsoft Trusted Signing keys must build baseline telemetry.

---

## 7. Legal Identity Requirements for "Hz Creatives"

To obtain a publicly trusted code-signing certificate that displays **"Hz Creatives"** as the Verified Publisher, specific legal requirements must be met:

### Scenario A: "Hz Creatives" as a Formally Registered Business Entity
- **Requirements**:
  - Registered company (LLC, Corporation, or Sole Proprietorship with a registered Business Name Certificate) in a recognized government registry (e.g., state business registrar, Registrar of Companies).
  - Active D-U-N-S (Dun & Bradstreet) number or listing in an authorized legal directory.
  - Verifiable business phone number listed in public directory services (e.g., YellowPages, Dun & Bradstreet).
  - Corporate officer authorized to verify the application.
- **Outcome**: The certificate Subject will be issued as:  
  `CN = Hz Creatives, O = Hz Creatives, L = <City>, C = <Country>`
- **Windows UAC Display**: `Verified Publisher: Hz Creatives`

### Scenario B: "Hz Creatives" as an Unregistered Brand / Trade Name
- **Legal Reality**: Under CA/Browser Forum Baseline Requirements, a Certificate Authority **cannot** issue an Organization Validation (OV) certificate to an informal brand or trade name that lacks formal legal entity registration.
- **Alternative**: An **Individual Code Signing Certificate** must be obtained by the creator (`KR Hasni Zihar`).
- **Requirements**:
  - Government-issued photo identification (Passport or National ID).
  - Proof of physical residence (Utility bill, bank statement within 90 days).
  - Identity verification session (Biometric video check or notarized attestation).
- **Outcome**: The certificate Subject will be issued as:  
  `CN = KR Hasni Zihar, O = KR Hasni Zihar, L = <City>, C = <Country>`  
  *(Note: "Hz Creatives" may only appear as a DBA suffix `KR Hasni Zihar (Hz Creatives)` if an official Fictitious Name / DBA filing is approved by a government authority).*
- **Windows UAC Display**: `Verified Publisher: KR Hasni Zihar`

---

## 8. Code-Signing Options Comparison

| Evaluation Criteria | 1. Microsoft Trusted Signing (Recommended) | 2. Standard Commercial OV Certificate | 3. Commercial EV Certificate | 4. Self-Signed Certificate | 5. Unsigned Distribution (Current State) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Trust Level** | **Full Authenticode Trust** (Microsoft Public PKI) | **Full Authenticode Trust** (Public CA) | **Full Authenticode Trust** (Public CA) | **Untrusted Root** (`CERT_E_UNTRUSTEDROOT`) | **Untrusted** (`NotSigned`) |
| **UAC Dialog** | Blue: "Verified Publisher" | Blue: "Verified Publisher" | Blue: "Verified Publisher" | Red / Yellow: Untrusted warning | Yellow: "Unknown Publisher" |
| **SmartScreen Impact** | Rapid reputation accumulation | Builds reputation over time | Accelerated reputation | Severe warning / blocked | Shows "Windows protected your PC" |
| **Annual Cost** | **\$9.99 / month** (\$120/yr, 100 signatures/mo free) | **\$200 - \$450 / year** + HSM cloud fees | **\$400 - \$800+ / year** + HSM cloud fees | **\$0 (Free)** | **\$0 (Free)** |
| **Key Storage** | Secure Cloud (Microsoft Azure HSM) | FIPS 140-2 Level 2 USB Token or Cloud KMS | FIPS 140-2 Level 2 USB Token or Cloud KMS | Local disk file (.pfx) | None required |
| **Physical Token?** | **No** (Fully cloud-native) | Yes (or paid cloud KMS subscription) | Yes (or paid cloud KMS subscription) | No | No |
| **CI/CD Automation** | **Native** via GitHub Action / Azure CLI | Difficult (requires remote HSM bridging) | Difficult (requires remote HSM bridging) | Trivial (insecure) | N/A |
| **Open-Source Fit** | **Ideal for open-source developers** | Expensive, high operational overhead | Prohibitive cost for indie projects | **Unsuitable** for public release | **Acceptable for Alpha** with checksums |

---

## 9. Recommended Code-Signing Strategy for DROPZONE

### Phase 1: Current Alpha Release (`v1.0.0-alpha.12`) $\rightarrow$ **Transparent Unsigned Distribution**
- Given that acquiring a commercial certificate involves legal entity vetting (1–7 business days) and financial cost, DROPZONE should proceed with its public alpha release as **Unsigned Open-Source Software**.
- Mitigate user friction transparently:
  1. Clearly document the Windows SmartScreen prompt in [README.md](file:///d:/INDEX/DropZone/README.md) and [docs/INSTALLATION.md](file:///d:/INDEX/DropZone/docs/INSTALLATION.md).
  2. Provide step-by-step guidance: Click **"More info"** $\rightarrow$ **"Run anyway"**.
  3. Publish exact SHA-256 checksums in [docs/RELEASE_CHECKSUMS.md](file:///d:/INDEX/DropZone/docs/RELEASE_CHECKSUMS.md) and [release/SHA256SUMS.txt](file:///d:/INDEX/DropZone/release/SHA256SUMS.txt).
  4. Provide the built-in PowerShell hash verification command for security-conscious users.

### Phase 2: Beta / General Availability Release $\rightarrow$ **Microsoft Trusted Signing**
- **Why Microsoft Trusted Signing is the #1 Recommendation**:
  1. **Affordability**: \$9.99/month (vs. \$500+/yr for traditional EV certificates).
  2. **No Hardware USB Dongles**: Since June 2023, CAs require physical USB tokens shipped via courier or expensive cloud HSM services. Microsoft Trusted Signing operates entirely within Azure's secure cloud infrastructure.
  3. **Seamless CI/CD Integration**: Supports official GitHub Actions (`azure/trusted-signing-action`) with zero secret leakage.
  4. **Direct Microsoft Integration**: Backed directly by Microsoft PKI, expediting Windows Defender trust.

---

## 10. Proposed Signing Architecture & Implementation Plan

When a signing certificate or Microsoft Trusted Signing service is activated, signing must follow an exact multi-binary dependency order:

```
Step 1: PyInstaller Worker Build
   └─ Compile dropzone-worker.exe
   └─ Sign dropzone-worker.exe with RFC 3161 Timestamp
        │
Step 2: Electron Application Build
   └─ Compile main, preload, and renderer
   └─ Package unpacked application (release/win-unpacked/)
        │
Step 3: Unpacked Executable Signing
   └─ Sign release/win-unpacked/DROPZONE.exe
        │
Step 4: Distributable Package Generation
   └─ electron-builder compiles NSIS installer & Portable executable
   └─ Sign uninstaller (uninstall.exe)
   └─ Sign DROPZONE-Setup-*.exe
   └─ Sign DROPZONE-Portable-*.exe
        │
Step 5: Integrity Checksum Generation (POST-SIGNING)
   └─ Recalculate SHA-256 on signed setup and portable binaries
   └─ Overwrite release/SHA256SUMS.txt and update docs/RELEASE_CHECKSUMS.md
```

> [!WARNING]
> **Checksum Ordering Rule**: Digitally signing an executable appends a signature block to the PE certificate table, altering its cryptographic hash. Calculating SHA-256 hashes must **ALWAYS** occur after code signing is finalized.

### Proposed Signing Scripts (Ready for Future Activation)

#### A. PyInstaller Worker Version Definition (`scripts/worker_version_info.txt`)
```python
# UTF-8
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 12),
    prodvers=(1, 0, 0, 12),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
        StringTable(
          u'040904B0',
          [StringStruct(u'CompanyName', u'Hz Creatives'),
          StringStruct(u'FileDescription', u'DROPZONE Background Download Engine'),
          StringStruct(u'FileVersion', u'1.0.0-alpha.12'),
          StringStruct(u'InternalName', u'dropzone-worker'),
          StringStruct(u'LegalCopyright', u'Copyright (c) 2026 Hz Creatives (KR Hasni Zihar)'),
          StringStruct(u'OriginalFilename', u'dropzone-worker.exe'),
          StringStruct(u'ProductName', u'DROPZONE'),
          StringStruct(u'ProductVersion', u'1.0.0-alpha.12')])
      ]
    ),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
```

#### B. Electron-Builder Signing Integration (`apps/desktop/electron-builder.yml`)
```yaml
win:
  target:
    - target: nsis
      arch:
        - x64
    - target: portable
      arch:
        - x64
  icon: resources/icon.ico
  # Hook to custom signing script or Microsoft Trusted Signing
  sign: "./scripts/sign-windows.cjs"
  signtoolOptions:
    publisherName: "Hz Creatives"
    signingHashAlgorithms:
      - sha256
```

#### C. Custom Signing Hook (`apps/desktop/scripts/sign-windows.cjs`)
```javascript
const cp = require('child_process');
const path = require('path');

exports.default = async function (configuration) {
  const filePath = configuration.path;
  console.log(`[Authenticode Sign] Signing binary: ${filePath}`);

  // In production with Microsoft Trusted Signing / signtool:
  // signtool sign /v /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /dlib ...
  // Or with traditional Certificate Store:
  const signtool = 'signtool.exe';
  const args = [
    'sign',
    '/fd', 'SHA256',
    '/tr', 'http://timestamp.digicert.com',
    '/td', 'SHA256',
    '/sm', // Machine store (or /dlib for cloud HSM)
    '/n', 'Hz Creatives',
    filePath
  ];

  if (!process.env.ENABLE_CODE_SIGNING) {
    console.log(`[Authenticode Sign] Code signing disabled in current environment. Skipping: ${filePath}`);
    return;
  }

  cp.execFileSync(signtool, args, { stdio: 'inherit' });
};
```

---

## 11. Security & Key Management Rules

1. **Never Commit Secrets**: Private keys (`.pfx`, `.p12`), certificate passwords, or Azure credentials must **never** be checked into Git. `.gitignore` must continue to exclude `*.pfx`, `*.p12`, `*.key`, and `*.cer`.
2. **Environment Variable Injection**: Use GitHub Secrets (`AZURE_CREDENTIALS`, `SIGNING_PROFILE`) or encrypted CI/CD runners.
3. **Mandatory RFC 3161 Timestamping**: Always pass `/tr http://timestamp.digicert.com /td SHA256`. Without a timestamp, the digital signature expires the moment the certificate reaches its validity date. With a timestamp, the binary remains valid indefinitely.

---

## 12. Verification & Validation Commands

To independently audit the signature and metadata of any DROPZONE executable on Windows, run the following PowerShell commands:

### Verify Authenticode Signature
```powershell
Get-AuthenticodeSignature "release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe" | Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate
```

*Expected output once signed with a trusted certificate:*
- **Status**: `Valid`
- **SignerCertificate.Subject**: `CN=Hz Creatives, ...` (or `CN=KR Hasni Zihar, ...`)
- **SignerCertificate.Issuer**: `CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1` (or equivalent)
- **TimeStamperCertificate**: Valid timestamp authority certificate

### Verify PE Version Resources
```powershell
(Get-Item "release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe").VersionInfo | Format-List CompanyName, ProductName, FileDescription, FileVersion, LegalCopyright
```

---

## 13. Exact Remaining Actions Before Public Release

- [x] Full codebase and binary metadata audit completed.
- [x] Authenticode signature status evaluated across all binaries (`NotSigned`).
- [x] Metadata defects identified (Worker PE resources, `app.setAppUserModelId`).
- [x] Cryptographic SHA-256 hashes generated and recorded in documentation.
- [x] SmartScreen user guidance and unsigned distribution disclaimer verified in `README.md` and `docs/INSTALLATION.md`.
- [ ] *(Post-Alpha Roadmap)* Register for Microsoft Trusted Signing in Azure.
- [ ] *(Post-Alpha Roadmap)* Add `worker_version_info.txt` to PyInstaller build script.
- [ ] *(Post-Alpha Roadmap)* Integrate signing hook into automated release workflow.

---

**Audit Completed**: November 13, 2026  
**Document Generated**: `Plan/PUBLISHER_AND_CODESIGNING_AUDIT.md`  
**Classification**: Public Release Audit Report  

