$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$taskName = "FlowPosPrintServer"

Write-Host "Stopping and removing task: $taskName..." -ForegroundColor Yellow
try {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "[OK] Task $taskName unregistered successfully." -ForegroundColor Green
} catch {
    Write-Host "[!] Could not unregister task: $($_.Exception.Message)" -ForegroundColor Red
}

# Stop any process listening on 9191
Get-NetTCPConnection -LocalPort 9191 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

Write-Host "[OK] Background service stopped and removed." -ForegroundColor Green
