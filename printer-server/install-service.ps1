# Self-elevate to Administrator if not elevated
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[*] Requesting Administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$taskName = "FlowPosPrintServer"
$serverDir = Split-Path -Parent $PSCommandPath
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
$runnerBat = Join-Path $serverDir "run-service.bat"
$logFile = Join-Path $serverDir "data\server.log"

if (-not $nodePath) {
    Write-Host "[ERROR] Node.js was not found in system PATH. Please install Node.js first!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   INSTALLING FLOW POS PRINT SERVER BACKGROUND SERVICE   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Working Directory : $serverDir"
Write-Host "Node Executable   : $nodePath"
Write-Host "Task Name         : $taskName"
Write-Host ""

# Ensure dependencies exist
if (-not (Test-Path (Join-Path $serverDir "node_modules\tslib")) -or -not (Test-Path (Join-Path $serverDir "node_modules\@supabase\supabase-js"))) {
    Write-Host "[*] Installing required dependencies (npm install)..." -ForegroundColor Yellow
    Set-Location $serverDir
    & npm install --omit=dev
}

# Unregister old task if exists
try {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "[*] Cleaned up prior task registration." -ForegroundColor Gray
} catch {}

# Kill any existing process on port 9191
Get-NetTCPConnection -LocalPort 9191 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# Ensure data directory exists
$dataDir = Join-Path $serverDir "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

# Create / update run-service.bat
$batContent = @"
@echo off
cd /d "$serverDir"
echo =================================================== >> "$logFile"
echo [START] %DATE% %TIME% >> "$logFile"
"$nodePath" "$serverDir\print-server.js" >> "$logFile" 2>&1
echo [EXIT] Code: %ERRORLEVEL% at %DATE% %TIME% >> "$logFile"
"@
Set-Content -Path $runnerBat -Value $batContent -Encoding ASCII

# Register Task: Runs at System Startup with highest privileges
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$runnerBat`"`"" -WorkingDirectory $serverDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest | Out-Null
Write-Host "[OK] Windows Auto-Start Task successfully created!" -ForegroundColor Green

# Start the task immediately
Write-Host "[*] Starting print server background process now..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName

# Wait and test connection
$started = $false
for ($i = 0; $i -lt 6; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:9191/status" -TimeoutSec 2 -ErrorAction Stop
        if ($res.ok) {
            $started = $true
            break
        }
    } catch {}
}

if ($started) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] FLOW Print Server is UP and RUNNING!" -ForegroundColor Green
    Write-Host " Version   : $($res.version)" -ForegroundColor Green
    Write-Host " Branch    : $($res.branch)" -ForegroundColor Green
    Write-Host " Dashboard : http://localhost:9191/manager" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "[*] Opening Manager Dashboard in browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:9191/manager"
} else {
    Write-Host ""
    Write-Host "[!] Background task started, but localhost:9191 did not respond in time." -ForegroundColor Yellow
    if (Test-Path $logFile) {
        Write-Host "--- Recent Server Log ($logFile) ---" -ForegroundColor Red
        Get-Content $logFile -Tail 15
        Write-Host "------------------------------------" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 TIP: Try double-clicking 'start-server.bat' to see live error output directly!" -ForegroundColor Yellow
}
