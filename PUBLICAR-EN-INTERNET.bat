@echo off
title Boxario - Publicar
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-gui.ps1"
if errorlevel 1 (
  echo.
  echo La ventana no abrio por un error. Presiona una tecla...
  pause >nul
)
