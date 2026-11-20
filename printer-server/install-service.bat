@echo off
setlocal
title Install FLOW Print Server Background Service
color 0E
cd /d "%~dp0"

echo =====================================================================
echo    REGISTERING FLOW PRINT SERVER AS WINDOWS AUTO-START SERVICE
echo =====================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH.
    echo Please install Node.js from https://nodejs.org before installing the service.
    echo.
    pause
    exit /b 1
)

echo Running PowerShell service installer with Administrator elevation...
echo If prompted by User Account Control (UAC), click YES to allow.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"

echo.
pause
