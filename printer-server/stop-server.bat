@echo off
title Stop FLOW Print Server
color 0C
cd /d "%~dp0"

echo Stopping any running FLOW Print Server instances on port 9191...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 9191 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Done.
timeout /t 2 >nul
