$files = @(
    "release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe",
    "release\DROPZONE-Portable-1.0.0-alpha.12-x64.exe",
    "apps\desktop\resources\worker\dropzone-worker.exe",
    "release\win-unpacked\DROPZONE.exe",
    "release\win-unpacked\resources\worker\dropzone-worker.exe"
)

foreach ($f in $files) {
    Write-Host "============================================================"
    Write-Host "FILE: $f"
    if (Test-Path $f) {
        Write-Host "--- AUTHENTICODE SIGNATURE ---"
        $sig = Get-AuthenticodeSignature $f
        [PSCustomObject]@{
            Status = $sig.Status
            StatusMessage = $sig.StatusMessage
            SignerSubject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "None" }
            SignerIssuer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Issuer } else { "None" }
            TimeStamper = if ($sig.TimeStamperCertificate) { $sig.TimeStamperCertificate.Subject } else { "None" }
        } | Format-List

        Write-Host "--- VERSION INFO ---"
        $vi = (Get-Item $f).VersionInfo
        [PSCustomObject]@{
            FileName = $vi.FileName
            CompanyName = $vi.CompanyName
            FileDescription = $vi.FileDescription
            FileVersion = $vi.FileVersion
            ProductVersion = $vi.ProductVersion
            ProductName = $vi.ProductName
            LegalCopyright = $vi.LegalCopyright
            LegalTrademarks = $vi.LegalTrademarks
            OriginalFilename = $vi.OriginalFilename
            InternalName = $vi.InternalName
        } | Format-List
    } else {
        Write-Host "File does not exist: $f"
    }
}

