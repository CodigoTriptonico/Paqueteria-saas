$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$localPath = Join-Path $root ".env.local"
$templatePath = Join-Path $root ".env.local.template"

if (-not (Test-Path $templatePath)) {
  Write-Error "Falta .env.local.template"
}

$preserveKeys = @(
  "PLATFORM_OWNER_EMAIL",
  "PLATFORM_OWNER_PASSWORD",
  "GOOGLE_MAPS_API_KEY",
  "DEFAULT_PHONE_COUNTRY_CODE"
)
$preserved = @{}

if (Test-Path $localPath) {
  foreach ($line in Get-Content $localPath) {
    foreach ($key in $preserveKeys) {
      if ($line -match "^$key=") {
        $preserved[$key] = $line
      }
    }
  }
}

$lines = Get-Content $templatePath
if ($preserved.Count -gt 0) {
  $lines = $lines | Where-Object {
    $trimmed = $_.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      return $true
    }
    $key = $trimmed.Split("=", 2)[0]
    -not $preserved.ContainsKey($key)
  }
  $lines += ""
  $lines += "# Conservado de tu .env.local anterior"
  foreach ($key in $preserveKeys) {
    if ($preserved.ContainsKey($key)) {
      $lines += $preserved[$key]
    }
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($localPath, $lines, $utf8NoBom)

Write-Host ""
Write-Host "Listo: .env.local apunta a Supabase LOCAL (127.0.0.1)."
Write-Host "1. Docker Desktop en marcha"
Write-Host "2. npm run supabase:start"
Write-Host "3. npm run db:apply"
Write-Host "4. npm run db:restore-owner"
Write-Host "5. npm run dev"
