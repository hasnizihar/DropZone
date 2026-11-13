# DROPZONE Release Checksums & Integrity Verification

This document provides cryptographic SHA-256 hashes for all official DROPZONE releases. Users and system administrators should verify downloaded binaries before execution.

---

## Current Release: v1.0.0-alpha.11 (2026-11-13)

| Package Filename | Target Architecture | SHA-256 Checksum |
| :--- | :--- | :--- |
| `DROPZONE-Setup-1.0.0-alpha.11-x64.exe` | Windows 10/11 x64 (NSIS Installer) | `477dfc9d66292069c7a375d3c73072a6ddc22b0483b61783c59bbb8165274967` |
| `DROPZONE-Portable-1.0.0-alpha.11-x64.exe` | Windows 10/11 x64 (Portable Binary) | `b6b6b5014e501c4949d912d3369067459e4c0cb419c20455a38fa45963a8430a` |
| `dropzone-worker.exe` | Bundled Standalone Python Worker | `8b7e9e6b3d2363c9f95c78950e51695d4783469ec172a9d535dba0c947caadd7` |

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
$expected = "477dfc9d66292069c7a375d3c73072a6ddc22b0483b61783c59bbb8165274967"
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

