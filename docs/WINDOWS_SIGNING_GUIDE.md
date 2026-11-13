# Windows Code Signing, Publisher Identity & Smart App Control Guide

This guide details DROPZONE's Windows packaging trust model, explains why Windows security controls (Smart App Control and Microsoft Defender SmartScreen) interact with newly released binaries, and documents how to configure Authenticode signing in release pipelines.

---

## 1. Understanding Windows Trust Layers

There is a fundamental difference between **Application Metadata**, **Authenticode Signatures**, and **Smart App Control Reputation**:

| Layer | What It Is | How It Works | Does It Stop SmartScreen / Smart App Control? |
| :--- | :--- | :--- | :--- |
| **Publisher Metadata** | Plaintext PE resource strings (`CompanyName`, `PublisherName`, `LegalTrademarks`) embedded in `.exe` files. | Displayed in Windows File Properties and standard UAC dialogues. Anyone can put any string here. | **No.** Windows does not verify identity based on plaintext metadata. |
| **Authenticode Signature** | Cryptographic signature using an X.509 certificate issued by a trusted Certificate Authority (CA) such as DigiCert, Sectigo, or GlobalSign. | Uses SHA-256 hashing to verify the binary has not been tampered with and cryptographically proves the author's identity. | **Helps, but does not immediately guarantee trust.** Standard OV certificates still require reputation building. EV (Extended Validation) certificates or Microsoft Hardware Developer Program signing establish immediate SmartScreen reputation. |
| **Smart App Control (SAC) & SmartScreen** | Cloud-powered AI reputation engine in Windows 11. | Analyzes binary popularity, execution prevalence, developer identity, and telemetry across millions of Windows machines. | **Only binary reputation or trusted signature clears it.** If an unsigned executable is newly compiled or rare, Smart App Control blocks it by default to protect users against unknown payloads. |

> [!IMPORTANT]
> Merely setting `publisherName: "Hz Creatives"` in `electron-builder.yml` or package metadata establishes developer attribution in file properties, but **does not make the executable trusted by Windows**. Only an Authenticode digital signature combined with Microsoft cloud reputation establishes full publisher verification.

---

## 2. Windows 11 Smart App Control (SAC) Architecture

On Windows 11 systems where Smart App Control is in **Enforced** mode (`UsermodeCodeIntegrityPolicyEnforcementStatus = 2`):
- Any binary executed in user-mode that lacks an Authenticode signature or known Microsoft cloud reputation is blocked by kernel code integrity (`An Application Control policy has blocked this file` / `errno: -4094`).
- For open-source developers distributing unsigned alpha/beta releases, users may need to run portable builds or allow the application through their Windows security settings.
- **We do not recommend turning off Smart App Control or weakening Windows security settings.** Instead, establishing trust through legitimate code signing and building reputation on public releases is the standard industry path.

---

## 3. Configuring Authenticode Signing in DROPZONE

DROPZONE's packaging infrastructure (`electron-builder`) is already **signing-ready**. When signing certificates are not present in the environment, the build automatically skips signing and produces clean unsigned binaries for testing and local distribution.

When an Authenticode certificate is acquired, signing is enabled simply by exposing standard environment variables without altering project source code.

### Option A: Standard PFX / PKCS#12 Certificate File
If you have a `.pfx` code-signing certificate (such as an OV certificate):

1. **Environment Variables**:
   ```powershell
   # Path to certificate file
   $env:CSC_LINK = "C:\secure\certificates\HzCreatives_CodeSigning.pfx"
   
   # Certificate password
   $env:CSC_KEY_PASSWORD = "YourSecurePasswordHere"
   ```

2. **Run Packaging**:
   ```powershell
   npm run package:win
   ```
   `electron-builder` will automatically invoke `signtool.exe`, sign `DROPZONE.exe`, `dropzone-worker.exe`, and the final `DROPZONE-Setup-1.0.0-alpha.10-x64.exe` installer with a SHA-256 timestamp.

### Option B: Hardware Security Module (HSM) / Token-Based EV Signing
Industry regulations require modern Extended Validation (EV) certificates to reside on physical USB tokens (e.g. YubiKey, SafeNet) or cloud HSMs (Azure Key Vault, DigiCert KeyLocker, SSL.com eSigner):

1. **Windows Certificate Store**:
   Install the token drivers and import the certificate into the CurrentUser or LocalMachine certificate store.

2. **Environment Variables**:
   ```powershell
   # Subject name or Certificate SHA-1 Thumbprint
   $env:CSC_NAME = "Hz Creatives"
   
   # Optional: Hardware token PIN / password
   $env:CSC_KEY_PASSWORD = "TokenPinOrPassword"
   ```

### Option C: GitHub Actions CI/CD Signing
In GitHub repository secrets:
1. Store base64-encoded PFX in secret `WINDOWS_CERTIFICATE_BASE64`.
2. Store password in secret `WINDOWS_CERTIFICATE_PASSWORD`.
3. In workflow:
   ```yaml
   - name: Build and Package Windows
     env:
       CSC_LINK: ${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}
       CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
     run: npm run package:all
   ```

---

## 4. Security & Secret Protection Guarantees

- **No Secrets in Source**: No `.pfx`, `.cer`, private keys, or passwords may ever be committed to the Git repository.
- **Graceful Unsigned Fallback**: If `CSC_LINK` or `CSC_NAME` is unset, `electron-builder` skips signing with:
  `• no code signing certificate configured, signing is skipped`
  The build succeeds and produces functional, inspectable binaries.

