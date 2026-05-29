param(
  [bool]$FullCheck,
  [string]$ProjectRoot,
  [string]$OnlineUrl
)

Set-Location $ProjectRoot

$localRunning = $false
try {
  $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  $localRunning = [bool]$conn
} catch { }

$onlineOk = $false
try {
  $res = Invoke-WebRequest -Uri $OnlineUrl -Method Head -TimeoutSec 5 -UseBasicParsing
  $onlineOk = ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400)
} catch { }

$sync = @{ State = "idle"; Detail = "Comprobando..." }

if ($FullCheck) {
  try {
    git fetch origin main --quiet 2>$null
  } catch {
    return @{
      LocalRunning = $localRunning
      OnlineOk     = $onlineOk
      Sync         = @{ State = "warn"; Detail = "Sin internet o GitHub no responde" }
    }
  }
}

$localHead = (git rev-parse HEAD 2>$null)
$remoteHead = (git rev-parse origin/main 2>$null)
$dirty = git status --porcelain

if (-not $localHead -or -not $remoteHead) {
  $sync = @{ State = "warn"; Detail = "No se pudo leer Git" }
} elseif ($dirty) {
  $count = ($dirty | Measure-Object).Count
  $sync = @{ State = "warn"; Detail = "$count archivo(s) sin publicar en Vercel" }
} elseif ($localHead -ne $remoteHead) {
  $ahead = 0
  $behind = 0
  try {
    $ahead = [int](git rev-list --count origin/main..HEAD 2>$null)
    $behind = [int](git rev-list --count HEAD..origin/main 2>$null)
  } catch { }

  if ($ahead -gt 0) {
    $sync = @{ State = "warn"; Detail = "$ahead commit(s) en tu PC que Vercel aun no tiene" }
  } elseif ($behind -gt 0) {
    $sync = @{ State = "warn"; Detail = "GitHub tiene $behind commit(s) mas nuevos que tu PC" }
  } else {
    $shortLocal = $localHead.Substring(0, 7)
    $sync = @{ State = "ok"; Detail = "Todo publicado (commit $shortLocal)" }
  }
} else {
  $shortLocal = $localHead.Substring(0, 7)
  $sync = @{ State = "ok"; Detail = "Todo publicado (commit $shortLocal)" }
}

@{
  LocalRunning = $localRunning
  OnlineOk     = $onlineOk
  Sync         = $sync
}
