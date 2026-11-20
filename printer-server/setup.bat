@echo off
setlocal
title FLOW Print Server - POS Hardware Setup
color 0A

echo =====================================================================
echo           FLOW POS PRINT SERVER - HARDWARE SETUP WIZARD
echo =====================================================================
echo.

cd /d "%~dp0"

REM 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% equ 0 goto node_found

echo [!] Node.js is NOT installed on this machine.
echo.
echo [*] Checking for Windows Package Manager (winget)...
where winget >nul 2>nul
if %errorlevel% neq 0 goto manual_node

echo [*] Attempting automatic Node.js LTS installation via winget...
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if %errorlevel% neq 0 goto manual_node

echo.
echo [*] Node.js was installed successfully!
echo [*] Please close this window and run setup.bat again.
echo.
pause
exit /b 0

:manual_node
echo.
echo =====================================================================
echo [ACTION REQUIRED] Please install Node.js:
echo   1. Open your browser and go to: https://nodejs.org
echo   2. Download and install the LTS version (Windows Installer .msi)
echo   3. After installation finishes, run setup.bat again.
echo =====================================================================
echo.
pause
exit /b 1

:node_found
echo [OK] Node.js is installed:
node -v
echo.

REM 2. Check Dependencies
if exist "node_modules\@supabase\supabase-js" (
    if exist "node_modules\tslib" (
        echo [OK] Required dependencies are already bundled and ready.
        echo.
        goto menu
    )
)

echo [*] Installing print server dependencies...
call npm install --omit=dev
if %errorlevel% neq 0 goto npm_error

echo.
echo [OK] Dependencies installed successfully!
echo.
goto menu

:npm_error
echo.
echo [WARNING] npm install encountered an issue.
echo If your POS hardware is offline, copy the complete printer-server folder including node_modules.
echo.
pause

:menu
echo =====================================================================
echo Choose how you would like to run the Print Server:
echo   1. Install as 24/7 Background Windows Service [Recommended for POS]
echo   2. Run Interactively in Console Window
echo   3. Exit
echo =====================================================================
echo.
set "choice="
set /p choice="Enter your choice [1, 2, or 3]: "

if "%choice%"=="1" goto install_service
if "%choice%"=="2" goto run_interactive
if "%choice%"=="3" goto do_exit
if "%choice%"=="" goto do_exit

echo.
echo [!] Invalid option '%choice%'. Please enter 1, 2, or 3.
echo.
pause
goto menu

:install_service
echo.
echo [*] Launching background service installer...
call "%~dp0install-service.bat"
goto finished

:run_interactive
echo.
echo [*] Launching console server...
call "%~dp0start-server.bat"
goto finished

:do_exit
echo.
echo Setup completed. You can start the server anytime using start-server.bat
goto finished

:finished
echo.
pause
