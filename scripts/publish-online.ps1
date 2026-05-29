# Sube cambios a GitHub; Vercel despliega automaticamente a produccion.
param(
  [string]$Message = "Update desde PC"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

git add -A
git reset HEAD -- abrir_chrome_debug.bat 2>$null

$status = git status --porcelain
if (-not $status) {
  Write-Host "No hay cambios para publicar."
  exit 0
}

git commit -m $Message
git push origin main

Write-Host ""
Write-Host "Listo. Vercel desplegara en 1-2 minutos:"
Write-Host "https://paqueteria-saas.vercel.app"
Write-Host ""
Write-Host "Sigue el progreso en: https://vercel.com/dashboard"
