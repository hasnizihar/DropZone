# DROPZONE Release Checksums & Integrity Verification

This document provides cryptographic SHA-256 hashes for all official DROPZONE releases. Users and system administrators should verify downloaded binaries before execution.

---

## Current Release: v1.0.0-alpha.12 (2026-11-13)

| Package Filename | Target Architecture | SHA-256 Checksum |
| :--- | :--- | :--- |
| `DROPZONE-Setup-1.0.0-alpha.12-x64.exe` | Windows 10/11 x64 (NSIS Installer) | `28507c3ed6c40c696bdc33ad6ae7d0646ae0ec6ba2847b6c8ea00ee6fc5ce294` |
| `DROPZONE-Portable-1.0.0-alpha.12-x64.exe` | Windows 10/11 x64 (Portable Binary) | `39c2edcbddb4ea897e2f5dd00fbea9840f9a08ea7056ec91780082afb26993e2` |
| `dropzone-worker.exe` | Bundled Standalone Python Worker | `903d629bd8136d0843f5763d3e9a1acb4e0e47d213fe056ba6830e317722c827` |

---

## Previous Release: v1.0.0-alpha.11 (2026-11-13)

| Package Filename | Target Architecture | SHA-256 Checksum |
| :--- | :--- | :--- |
| `DROPZONE-Setup-1.0.0-alpha.11-x64.exe` | Windows 10/11 x64 (NSIS Installer) | `9029419fb68adaa1126ca69209f682a5c0c688384d58aefd6d906da4bb1498fe` |
| `DROPZONE-Portable-1.0.0-alpha.11-x64.exe` | Windows 10/11 x64 (Portable Binary) | `916ed91cfdc017a6c0786ecc0b47bac6111c117afc34d52ca154cdb72db6600f` |
| `dropzone-worker.exe` | Bundled Standalone Python Worker | `c180c54f6cc8a450d0d5807e32e17de0a1c19779ed295c23f120d1a2ed6a0701` |

---

## Previous Release: v1.0.0-alpha.10 (2026-11-13)

| Package Filename | Target Architecture | SHA-256 Checksum |
| :--- | :--- | :--- |
| `DROPZONE-Setup-1.0.0-alpha.10-x64.exe` | Windows 10/11 x64 (NSIS Installer) | `586a6403f5a5acf2cc4535aca463a2972b672b3ea90446fecaff0d2e988451fe` |
| `DROPZONE-Portable-1.0.0-alpha.10-x64.exe` | Windows 10/11 x64 (Portable Binary) | `6646c8dac52f7d2bb53278fd473290b5d568e5e035dcac4ae3a1fdada9ff5c29` |
| `dropzone-worker.exe` | Bundled Standalone Python Worker | `8b7e9e6b3d2363c9f95c78950e51695d4783469ec172a9d535dba0c947caadd7` |

---

## Verification Instructions

### In Windows PowerShell
Run the built-in `Get-FileHash` cmdlet against your downloaded file:

```powershell
Get-FileHash -Algorithm SHA256 "DROPZONE-Setup-1.0.0-alpha.11-x64.exe"
```

Verify that the returned hash matches the table above.

### Automated Hash Check (PowerShell)
```powershell
$expected = "9029419fb68adaa1126ca69209f682a5c0c688384d58aefd6d906da4bb1498fe"
$actual = (Get-FileHash -Algorithm SHA256 "DROPZONE-Setup-1.0.0-alpha.11-x64.exe").Hash.ToLower()

if ($expected -eq $actual) {
    Write-Host "Verification PASSED: Binary integrity confirmed." -ForegroundColor Green
} else {
    Write-Error "Verification FAILED: Checksum does not match!"
}
```

### In Linux / macOS / WSL
```bash
sha256sum DROPZONE-Setup-1.0.0-alpha.11-x64.exe
```

