@echo off
title Boxario - Desarrollo local
cd /d "%~dp0"

echo.
echo === Boxario: base de datos LOCAL (Docker) ===
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop no esta instalado o no esta en el PATH.
  echo Instala: https://docs.docker.com/desktop/
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta corriendo. Abre Docker Desktop y espera a que inicie.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo Creando .env.local desde plantilla local...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\use-local-env.ps1"
)

echo Iniciando Supabase local (primera vez puede tardar varios minutos)...
call npx supabase start
if errorlevel 1 (
  echo.
  echo No se pudo iniciar Supabase local.
  pause
  exit /b 1
)

echo.
echo Aplicando migraciones...
call npm run db:apply
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Iniciando la app en http://localhost:3000 ...
start "" "http://localhost:3000/login"
call npm run dev
