@echo off
title FLOW Print Server v2.2.0 (Port 9191)
color 0B
cd /d "%~dp0"

echo =====================================================================
echo              FLOW POS HARDWARE PRINT SERVER (PORT 9191)
echo =====================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH.
    echo Please run setup.bat first or install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Starting Print Server...
echo Manager Dashboard will be accessible at: http://localhost:9191/manager
echo.

node print-server.js

echo.
echo [!] Print server process ended.
pause
