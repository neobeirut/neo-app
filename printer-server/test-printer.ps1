Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "               FLOW PRINT SERVER HARDWARE DIAGNOSTIC                " -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Server Health
try {
    Write-Host "1. Querying Local Print Server Health (http://127.0.0.1:9191/status)..." -ForegroundColor Cyan
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:9191/status" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   [OK] Server Status : ONLINE" -ForegroundColor Green
    Write-Host "   Service        : $($status.service) v$($status.version)"
    Write-Host "   Branch         : $($status.branch)"
    Write-Host "   Printers Synced: $($status.printers_count)"
    Write-Host "   Local IPs      : $($status.ip_addresses -join ', ')"
    Write-Host "   Exchange Rate  : $($status.exchange_rate) LBP"
} catch {
    Write-Host "   [FAIL] Could not connect to http://127.0.0.1:9191. Is the print server running?" -ForegroundColor Red
}

Write-Host ""

# 2. Windows Printers
Write-Host "2. Detecting Local Windows Spooler Printers..." -ForegroundColor Cyan
try {
    $printers = Get-Printer | Select-Object Name, PortName, DriverName
    $printers | Format-Table -AutoSize
} catch {
    Write-Host "   [!] Could not query Windows printers: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
$send = Read-Host "Would you like to send a test print chit now? (y/n)"
if ($send -eq 'y' -or $send -eq 'Y') {
    try {
        Write-Host "Sending test print chit..." -ForegroundColor Yellow
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:9191/api/test-print" -Method Post -Body "{}" -ContentType "application/json" -TimeoutSec 5
        if ($res.success) {
            Write-Host "[SUCCESS] Test chit dispatched successfully!" -ForegroundColor Green
        } else {
            Write-Host "[FAILED] $($res.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Diagnostic complete. Press Enter to exit..."
Read-Host
