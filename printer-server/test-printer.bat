@echo off
title FLOW Print Server Diagnostics
color 0E
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-printer.ps1"
