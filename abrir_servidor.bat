@echo off
setlocal

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File scripts\start-dev-server.ps1
pause
