@echo off
setlocal
title Uninstall FLOW Print Server Service
color 0C
cd /d "%~dp0"

echo =====================================================================
echo       UNINSTALLING FLOW PRINT SERVER BACKGROUND SERVICE
echo =====================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-service.ps1"

echo.
pause
