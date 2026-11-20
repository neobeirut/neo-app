@echo off
cd /d "%~dp0"
if not exist "data" mkdir "data"
echo =================================================== >> "data\server.log"
echo [START] %DATE% %TIME% >> "data\server.log"
node print-server.js >> "data\server.log" 2>&1
echo [EXIT] Code: %ERRORLEVEL% at %DATE% %TIME% >> "data\server.log"
