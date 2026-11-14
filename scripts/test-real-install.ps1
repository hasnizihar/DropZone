$Installer = "D:\INDEX\DropZone\release\DROPZONE-Setup-1.0.0-alpha.12-x64.exe"

Write-Host "============================================================"
Write-Host "Real Machine Test: Launching Inno Setup Installer"
Write-Host "Path: $Installer"
Write-Host "============================================================"

# Attempt 1: Start-Process without elevation
Write-Host "`n--- Test Attempt 1: Start-Process (Silent Execution) ---"
try {
    $proc = Start-Process -FilePath $Installer -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES" -PassThru -Wait -ErrorAction Stop
    Write-Host "Process Launched Successfully! ExitCode: $($proc.ExitCode)"
} catch {
    Write-Host "FAILED: Exception Caught:" -ForegroundColor Red
    Write-Host "Message:        $($_.Exception.Message)"
    Write-Host "Exception Type: $($_.Exception.GetType().FullName)"
    Write-Host "HResult:        $($_.Exception.HResult) (0x$($_.Exception.HResult.ToString('X8')))"
    if ($_.Exception.InnerException) {
        Write-Host "InnerMessage:   $($_.Exception.InnerException.Message)"
    }
}

# Attempt 2: Direct CMD / Shell Invocation
Write-Host "`n--- Test Attempt 2: Direct Shell Invocation via cmd.exe ---"
$cmdOutput = cmd.exe /c "`"$Installer`" /VERYSILENT /SUPPRESSMSGBOXES 2>&1"
Write-Host "cmd.exe exit code: $LASTEXITCODE"
Write-Host "cmd.exe output:    $cmdOutput"

# Check Windows Defender Event Logs or AppLocker/CodeIntegrity logs
Write-Host "`n--- Windows Security / AppControl Event Log Inspection ---"
$logNames = @(
    "Microsoft-Windows-AppLocker/EXE and DLL",
    "Microsoft-Windows-CodeIntegrity/Operational",
    "Microsoft-Windows-Windows Defender/Operational"
)

foreach ($logName in $logNames) {
    try {
        $events = Get-WinEvent -LogName $logName -MaxEvents 5 -ErrorAction SilentlyContinue | 
                  Where-Object { $_.Message -match "DROPZONE|dropzone" }
        if ($events) {
            Write-Host "Found matching events in $logName :"
            foreach ($e in $events) {
                Write-Host "  EventId: $($e.Id), Time: $($e.TimeCreated), Message: $($e.Message)"
            }
        } else {
            Write-Host "No DROPZONE specific events in $logName."
        }
    } catch {
        Write-Host "Could not query log $logName : $($_.Exception.Message)"
    }
}

