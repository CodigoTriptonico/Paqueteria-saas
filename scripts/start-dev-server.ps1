$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "=== Boxario: servidor de desarrollo (una sola instancia) ==="
Write-Host ""

& node (Join-Path $PSScriptRoot "kill-dev-server.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo limpiar el servidor anterior. Cierra ventanas con npm run dev y reintenta."
}

$port = 3000
$listener = netstat -ano | Select-String ":\s*$port\s+.*LISTENING"
if ($listener) {
  throw "El puerto $port sigue ocupado. Cierra el proceso manualmente y reintenta."
}

Write-Host "Abriendo ventana visible con hot reload (Next.js + Turbopack)..."
Write-Host "Para detener: Ctrl+C en esa ventana."
Write-Host ""

$launch =
  "cd /d `"$root`" && " +
  "title Boxario Dev Server && " +
  "echo. && " +
  "echo Servidor de desarrollo - los cambios se aplican al guardar. && " +
  "echo Para detener: Ctrl+C aqui (no cierres la ventana con la X sin Ctrl+C). && " +
  "echo. && " +
  "npm run dev"

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $launch
