$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$localPath = Join-Path $root ".env.local"
$remotePath = Join-Path $root ".env.remote"

if (-not (Test-Path $remotePath)) {
  Write-Error "No existe .env.remote. Crea uno desde .env.remote.example o ejecuta env:local antes (guarda el respaldo)."
}

Copy-Item $remotePath $localPath -Force
Write-Host "Listo: .env.local vuelve a usar Supabase en la nube (.env.remote)."
