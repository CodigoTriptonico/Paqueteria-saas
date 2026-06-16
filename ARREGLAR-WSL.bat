@echo off
title Actualizar WSL (administrador)
echo.
echo Este script debe ejecutarse COMO ADMINISTRADOR.
echo Clic derecho en este archivo -^> Ejecutar como administrador
echo.
pause

echo Actualizando WSL...
wsl --update

echo.
echo Instalando componentes WSL si faltan...
wsl --install --no-distribution

echo.
echo Habilitando Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

echo.
echo Listo. REINICIA el PC, abre Docker Desktop y luego:
echo   npm run env:local
echo   npm run supabase:start
echo   npm run db:apply
echo   npm run dev
echo.
pause
