Write-Host "============================================================"
Write-Host "DROPZONE: Diagnostic Run - Windows Application Control"
Write-Host "============================================================"

# 1. DeviceGuard WMI Inspection
Write-Host "`n--- [1] Win32_DeviceGuard WMI Status ---"
try {
    $dg = Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop
    [PSCustomObject]@{
        AvailableSecurityProperties = ($dg.AvailableSecurityProperties -join ", ")
        RequiredSecurityProperties  = ($dg.RequiredSecurityProperties -join ", ")
        SecurityServicesConfigured  = ($dg.SecurityServicesConfigured -join ", ")
        SecurityServicesRunning     = ($dg.SecurityServicesRunning -join ", ")
        UsermodeCodeIntegrityPolicyEnforcementStatus = $dg.UsermodeCodeIntegrityPolicyEnforcementStatus
        VersionConfigured           = $dg.VersionConfigured
        VersionRunning              = $dg.VersionRunning
        VirtualizationBasedSecurityStatus = $dg.VirtualizationBasedSecurityStatus
    } | Format-List
} catch {
    Write-Host "Error querying Win32_DeviceGuard: $($_.Exception.Message)"
}

# 2. System Workgroup / Domain / MDM Status
Write-Host "`n--- [2] System & Organization Management Status ---"
try {
    $cs = Get-CimInstance Win32_ComputerSystem
    Write-Host "Computer Name: $($cs.Name)"
    Write-Host "PartOfDomain:  $($cs.PartOfDomain)"
    Write-Host "Domain:        $($cs.Domain)"
    Write-Host "Workgroup:     $($cs.Workgroup)"
} catch {
    Write-Host "Error querying Win32_ComputerSystem: $($_.Exception.Message)"
}

# 3. Smart App Control Registry Inspection
Write-Host "`n--- [3] Smart App Control (SAC) Registry Status ---"
try {
    $sacKey = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
    if (Test-Path $sacKey) {
        $props = Get-ItemProperty -Path $sacKey -ErrorAction SilentlyContinue
        Write-Host "VerifiedAndReputablePolicyState: $($props.VerifiedAndReputablePolicyState)"
        switch ($props.VerifiedAndReputablePolicyState) {
            0 { Write-Host "  -> Interpretation: SAC is OFF" -ForegroundColor Yellow }
            1 { Write-Host "  -> Interpretation: SAC is ON / ENFORCED" -ForegroundColor Red }
            2 { Write-Host "  -> Interpretation: SAC is in EVALUATION mode" -ForegroundColor Yellow }
            Default { Write-Host "  -> Value not set or unknown" -ForegroundColor Gray }
        }
        Write-Host "AppControlEnforcementPolicy:     $($props.AppControlEnforcementPolicy)"
    } else {
        Write-Host "Registry path $sacKey not found."
    }
} catch {
    Write-Host "Error checking SAC registry: $($_.Exception.Message)"
}

# 4. CiTool Application Control Policy Inspection
Write-Host "`n--- [4] CiTool Active Policies Inspection ---"
$citoolPath = Get-Command citool.exe -ErrorAction SilentlyContinue
if ($citoolPath) {
    Write-Host "CiTool found at: $($citoolPath.Source)"
    try {
        & citool.exe -lp -json | Out-String | Write-Host
    } catch {
        Write-Host "Error running citool -lp -json: $($_.Exception.Message)"
        & citool.exe -lp | Out-String | Write-Host
    }
} else {
    Write-Host "citool.exe not found on PATH. Checking C:\Windows\System32\citool.exe..."
    if (Test-Path "C:\Windows\System32\citool.exe") {
        try {
            & C:\Windows\System32\citool.exe -lp -json | Out-String | Write-Host
        } catch {
            & C:\Windows\System32\citool.exe -lp | Out-String | Write-Host
        }
    } else {
        Write-Host "citool.exe is not present on this Windows build."
    }
}

# 5. Check Active Code Integrity Policies on Disk
Write-Host "`n--- [5] Active Code Integrity Policy Files on Disk ---"
$cipPath = "C:\Windows\System32\CodeIntegrity\CiPolicies\Active"
if (Test-Path $cipPath) {
    Get-ChildItem -Path $cipPath | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
} else {
    Write-Host "Path not accessible: $cipPath"
}

# 6. Deep Dive into Code Integrity Event 3077 & 3033
Write-Host "`n--- [6] Recent Code Integrity Event 3077 Details ---"
try {
    $ciEvents = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-CodeIntegrity/Operational'; Id=3077} -MaxEvents 3 -ErrorAction Stop
    foreach ($evt in $ciEvents) {
        Write-Host "Event Time: $($evt.TimeCreated)"
        Write-Host "Event Message:"
        Write-Host $evt.Message
        Write-Host "--- Event Properties ---"
        for ($i = 0; $i -lt $evt.Properties.Count; $i++) {
            Write-Host "  Property[$i]: $($evt.Properties[$i].Value)"
        }
        Write-Host "------------------------"
    }
} catch {
    Write-Host "Error querying Code Integrity event log: $($_.Exception.Message)"
}

