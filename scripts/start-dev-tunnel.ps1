$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cloudflared = Join-Path $root "tools\cloudflared.exe"
$port = 3000
$localUrl = "http://127.0.0.1:$port"
$nextOut = Join-Path $root ".next-dev.out.log"
$nextErr = Join-Path $root ".next-dev.err.log"
$tunnelOut = Join-Path $root ".cloudflared.out.log"
$tunnelErr = Join-Path $root ".cloudflared.err.log"
$urlFile = Join-Path $root ".dev-tunnel.url"

if (-not (Test-Path -LiteralPath $cloudflared)) {
  throw "Missing tools\cloudflared.exe. Download it first from Cloudflare."
}

function Stop-ListenerOnPort([int]$listenPort) {
  $connections = netstat -ano | Select-String ":\s*$listenPort\s+.*LISTENING"
  foreach ($line in $connections) {
    $processId = ($line -split '\s+')[-1]
    if ($processId -match '^\d+$' -and $processId -ne '0') {
      Write-Host "Stopping process $processId on port $listenPort..."
      Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Modo desarrollo (hot reload al guardar archivos)."
Write-Host "Reiniciando next dev en :$port ..."
Stop-ListenerOnPort $port
Start-Sleep -Seconds 1

Remove-Item -LiteralPath $nextOut,$nextErr -Force -ErrorAction SilentlyContinue
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev" `
  -WorkingDirectory $root `
  -RedirectStandardOutput $nextOut `
  -RedirectStandardError $nextErr `
  -WindowStyle Hidden

$isUp = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $localUrl -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $isUp = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $isUp) {
  throw "next dev did not start. Check .next-dev.err.log"
}

Remove-Item -LiteralPath $tunnelOut,$tunnelErr -Force -ErrorAction SilentlyContinue

Write-Host "Starting Cloudflare Tunnel..."
Start-Process -FilePath $cloudflared `
  -ArgumentList "tunnel","--url",$localUrl `
  -WorkingDirectory $root `
  -RedirectStandardOutput $tunnelOut `
  -RedirectStandardError $tunnelErr `
  -WindowStyle Hidden

$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $log = ""
  if (Test-Path -LiteralPath $tunnelErr) {
    $log += Get-Content -LiteralPath $tunnelErr -Raw
  }
  if (Test-Path -LiteralPath $tunnelOut) {
    $log += Get-Content -LiteralPath $tunnelOut -Raw
  }

  $match = [regex]::Match($log, "https://[a-z0-9-]+\.trycloudflare\.com")
  if ($match.Success) {
    $publicUrl = $match.Value
    break
  }
}

if (-not $publicUrl) {
  throw "Tunnel started but URL was not found. Check .cloudflared.err.log"
}

Set-Content -LiteralPath $urlFile -Value $publicUrl -Encoding utf8

Write-Host ""
Write-Host "DEV + TUNNEL (cambios en vivo al guardar):"
Write-Host $publicUrl
Write-Host ""
Write-Host "Local: $localUrl"
Write-Host "Logs: .next-dev.err.log | .cloudflared.err.log"
Write-Host "Para produccion sin hot reload usa: npm run preview"
