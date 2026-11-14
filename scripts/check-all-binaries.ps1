$binaries = Get-ChildItem -Path "release\win-unpacked" -Recurse -Include "*.exe", "*.dll"
$installers = Get-ChildItem -Path "release" -Filter "*.exe"

Write-Host "============================================================"
Write-Host "DROPZONE: Full Authenticode Signature Inventory"
Write-Host "============================================================"

Write-Host "`n--- Distributable Installers & Binaries (release/) ---"
foreach ($f in $installers) {
    $sig = Get-AuthenticodeSignature $f.FullName
    [PSCustomObject]@{
        Name   = $f.Name
        SizeMB = [math]::Round($f.Length / 1MB, 2)
        Status = $sig.Status
        Signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "None" }
    } | Format-Table -AutoSize
}

Write-Host "`n--- Unpacked Production Runtime Binaries (release/win-unpacked/) ---"
foreach ($b in $binaries) {
    $sig = Get-AuthenticodeSignature $b.FullName
    [PSCustomObject]@{
        RelativePath = $b.FullName.Substring((Resolve-Path "release\win-unpacked").Path.Length + 1)
        SizeKB       = [math]::Round($b.Length / 1KB, 1)
        Status       = $sig.Status
        Signer       = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "None" }
    } | Format-Table -AutoSize
}

