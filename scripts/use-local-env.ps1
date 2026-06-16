$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$localPath = Join-Path $root ".env.local"
$remotePath = Join-Path $root ".env.remote"
$templatePath = Join-Path $root ".env.local.template"

if (Test-Path $localPath) {
  $current = Get-Content $localPath -Raw
  if ($current -match "supabase\.co" -and -not (Test-Path $remotePath)) {
    Copy-Item $localPath $remotePath
    Write-Host "Respaldo de la nube guardado en .env.remote"
  }
}

if (-not (Test-Path $templatePath)) {
  Write-Error "Falta .env.local.template"
}

$lines = Get-Content $templatePath
$extras = @()
if (Test-Path $remotePath) {
  foreach ($line in Get-Content $remotePath) {
    if ($line -match "^(GOOGLE_MAPS_API_KEY|PLATFORM_OWNER_EMAIL|DEFAULT_PHONE_COUNTRY_CODE)=") {
      $extras += $line
    }
  }
}

if ($extras.Count -gt 0) {
  $lines += ""
  $lines += "# Conservado desde .env.remote"
  $lines += $extras
}

Set-Content -Path $localPath -Value $lines -Encoding utf8

Write-Host ""
Write-Host "Listo: .env.local apunta a Supabase LOCAL (127.0.0.1)."
Write-Host "1. Instala y abre Docker Desktop"
Write-Host "2. npm run supabase:start"
Write-Host "3. npm run db:apply"
Write-Host "4. npm run dev"
