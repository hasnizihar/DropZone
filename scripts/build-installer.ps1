<#
.SYNOPSIS
    Builds the DROPZONE Inno Setup Windows Installer.

.DESCRIPTION
    Validates dependencies, compiles production Electron and standalone Python worker,
    locates ISCC.exe (Inno Setup Compiler), and packages the installer.

.PARAMETER InnoCompilerPath
    Optional manual path to ISCC.exe. If omitted, standard locations are searched.

.PARAMETER OutputFilename
    Optional base filename for the output installer (default: DROPZONE-Setup-1.0.0-alpha.12-x64).

.PARAMETER SkipBuild
    If specified, reuses the existing win-unpacked directory without recompiling.
#>

[CmdletBinding()]
param(
    [string]$InnoCompilerPath,
    [string]$OutputFilename = "DROPZONE-Setup-1.0.0-alpha.12-x64",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ReleaseDir = Join-Path $ProjectRoot "release"
$UnpackedDir = Join-Path $ReleaseDir "win-unpacked"
$IssPath = Join-Path $ProjectRoot "installer\dropzone.iss"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DROPZONE | Inno Setup Windows Installer Builder" -ForegroundColor Cyan
Write-Host " Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host " Output File:  $OutputFilename.exe" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. Locate Inno Setup Compiler (ISCC.exe)
# -----------------------------------------------------------------------------
function Find-ISCC {
    param([string]$CustomPath)

    if ($CustomPath -and (Test-Path $CustomPath)) {
        return $CustomPath
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe",
        "C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
    )

    # Check PATH
    $pathCmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($pathCmd) {
        return $pathCmd.Source
    }

    foreach ($c in $candidates) {
        if (Test-Path $c) {
            return $c
        }
    }

    return $null
}

$ISCC = Find-ISCC -CustomPath $InnoCompilerPath
if (-not $ISCC) {
    Write-Error "Inno Setup Compiler (ISCC.exe) not found! Install via 'winget install JRSoftware.InnoSetup' or provide -InnoCompilerPath."
    exit 1
}
Write-Host "[1/6] Found Inno Setup Compiler: $ISCC" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Validate / Build Python Companion Worker
# -----------------------------------------------------------------------------
$WorkerExe = Join-Path $ProjectRoot "apps\desktop\resources\worker\dropzone-worker.exe"
if (-not (Test-Path $WorkerExe)) {
    Write-Host "[2/6] Compiling standalone Python companion worker..." -ForegroundColor Yellow
    & python (Join-Path $ProjectRoot "scripts\build-worker.py")
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build standalone Python worker."
        exit 1
    }
} else {
    Write-Host "[2/6] Standalone worker present: $WorkerExe" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Validate / Build Electron Production Bundle
# -----------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "[3/6] Building Electron production application and unpacking..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    try {
        # Run desktop build
        npm run build --workspace=@dropzone/desktop
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Electron desktop build failed."
            exit 1
        }

        # Build unpacked directory with electron-builder
        Push-Location (Join-Path $ProjectRoot "apps\desktop")
        try {
            npx electron-builder --win --dir --config electron-builder.yml
            if ($LASTEXITCODE -ne 0) {
                Write-Error "electron-builder unpack failed."
                exit 1
            }
        } finally {
            PopLocation
        }
    } finally {
        PopLocation
    }
} else {
    Write-Host "[3/6] Skipping build step (using existing unpacked application)." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 4. Validate Production Unpacked Runtime Directory
# -----------------------------------------------------------------------------
Write-Host "[4/6] Validating unpacked production files in: $UnpackedDir" -ForegroundColor Yellow

$RequiredFiles = @(
    (Join-Path $UnpackedDir "DROPZONE.exe"),
    (Join-Path $UnpackedDir "resources\app.asar"),
    (Join-Path $UnpackedDir "resources\worker\dropzone-worker.exe")
)

foreach ($rf in $RequiredFiles) {
    if (-not (Test-Path $rf)) {
        Write-Error "Missing critical runtime file in win-unpacked: $rf"
        exit 1
    }
}
Write-Host "      All critical runtime binaries verified." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 5. Compile Inno Setup Script
# -----------------------------------------------------------------------------
Write-Host "[5/6] Compiling Inno Setup Script: $IssPath..." -ForegroundColor Yellow

$InnoArgs = @(
    "/Qp",
    "/O`"$ReleaseDir`"",
    "/F`"$OutputFilename`"",
    $IssPath
)

Push-Location (Split-Path $IssPath -Parent)
try {
    $proc = Start-Process -FilePath $ISCC -ArgumentList $InnoArgs -NoNewWindow -PassThru -Wait
    if ($proc.ExitCode -ne 0) {
        Write-Error "ISCC compilation failed with exit code $($proc.ExitCode)."
        exit $proc.ExitCode
    }
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# 6. Verify Installer Output & Cryptographic SHA-256
# -----------------------------------------------------------------------------
$InstallerPath = Join-Path $ReleaseDir "$OutputFilename.exe"
if (-not (Test-Path $InstallerPath)) {
    Write-Error "Expected installer output was not generated: $InstallerPath"
    exit 1
}

$FileItem = Get-Item $InstallerPath
$FileHash = (Get-FileHash -Path $InstallerPath -Algorithm SHA256).Hash

Write-Host "============================================================" -ForegroundColor Green
Write-Host " BUILD SUCCESS: Inno Setup Installer Generated" -ForegroundColor Green
Write-Host " File:      $($FileItem.FullName)" -ForegroundColor White
Write-Host " Size:      $($FileItem.Length) bytes ($([math]::Round($FileItem.Length / 1MB, 2)) MB)" -ForegroundColor White
Write-Host " SHA-256:   $FileHash" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green

