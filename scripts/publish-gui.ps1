Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$onlineUrl = "https://paqueteria-saas.vercel.app"
$localUrl = "http://localhost:3000/login"
$vercelDashboard = "https://vercel.com/pabloisazai-gmailcoms-projects/paqueteria-saas"
$vercelSettings = "$vercelDashboard/settings"
$vercelDeployments = "$vercelDashboard/deployments"

Set-Location $projectRoot

function Open-InChrome([string]$targetUrl) {
  if (-not $targetUrl) { return }
  $chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($chrome in $chromePaths) {
    if (Test-Path $chrome) {
      Start-Process -FilePath $chrome -ArgumentList $targetUrl | Out-Null
      return
    }
  }
  Start-Process $targetUrl | Out-Null
}

# Paleta alineada con globals.css del SaaS
$theme = @{
  Bg           = [System.Drawing.Color]::FromArgb(41, 49, 45)    # surface-shell
  Panel        = [System.Drawing.Color]::FromArgb(30, 38, 35)    # surface-panel
  Card         = [System.Drawing.Color]::FromArgb(42, 50, 47)    # surface-inset
  CardBorder   = [System.Drawing.Color]::FromArgb(26, 32, 30)
  Text         = [System.Drawing.Color]::FromArgb(226, 232, 240)
  Muted        = [System.Drawing.Color]::FromArgb(148, 163, 184)
  Accent       = [System.Drawing.Color]::FromArgb(52, 211, 153)
  AccentHover  = [System.Drawing.Color]::FromArgb(45, 185, 135)
  Primary      = [System.Drawing.Color]::FromArgb(61, 115, 96)
  PrimaryHover = [System.Drawing.Color]::FromArgb(72, 130, 108)
  Secondary    = [System.Drawing.Color]::FromArgb(71, 85, 79)
  SecondaryHover = [System.Drawing.Color]::FromArgb(82, 98, 91)
  Danger       = [System.Drawing.Color]::FromArgb(127, 58, 58)
  DangerHover  = [System.Drawing.Color]::FromArgb(153, 68, 68)
  LogBg        = [System.Drawing.Color]::FromArgb(26, 32, 30)
  Ok           = [System.Drawing.Color]::FromArgb(52, 211, 153)
  Warn         = [System.Drawing.Color]::FromArgb(251, 191, 36)
  Error        = [System.Drawing.Color]::FromArgb(248, 113, 113)
  Idle         = [System.Drawing.Color]::FromArgb(100, 116, 139)
}

# Layout horizontal: ventana ancha, secciones en filas y dos columnas
$formW = 920
$layout = @{
  Pad      = 16
  ColGap   = 10
  FormW    = $formW
  SectionW = 0
  ColW     = 0
  Col2X    = 0
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Paquemas"
$form.ClientSize = New-Object System.Drawing.Size($formW, 400)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $theme.Bg
$form.ForeColor = $theme.Text
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Padding = New-Object System.Windows.Forms.Padding(0)

$layout.SectionW = $formW - ($layout.Pad * 2)
$layout.ColW = [int](($layout.SectionW - $layout.ColGap) / 2)
$layout.Col2X = $layout.Pad + $layout.ColW + $layout.ColGap

function Get-SectionMetrics([int]$width) {
  $innerW = $width - ($layout.Pad * 2)
  $half = [int](($innerW - $layout.ColGap) / 2)
  return @{
    InnerW   = $innerW
    BtnHalfW = $half
    BtnCol2X = $layout.Pad + $half + $layout.ColGap
    BtnFullW = $innerW
    ThirdW   = [int](($innerW - ($layout.ColGap * 2)) / 3)
  }
}

function Add-Control($parent, $control) {
  if ($parent -is [System.Windows.Forms.Form]) {
    $parent.Controls.Add($control)
  } else {
    $parent.Controls.Add($control)
  }
  return $control
}

function New-Section($parent, $title, $subtitle, $x, $y, $width, $height) {
  $wrap = New-Object System.Windows.Forms.Panel
  $wrap.Location = New-Object System.Drawing.Point($x, $y)
  $wrap.Size = New-Object System.Drawing.Size($width, $height)
  $wrap.BackColor = $theme.Panel
  Add-Control $parent $wrap | Out-Null

  $metrics = Get-SectionMetrics $width
  $innerW = $metrics.InnerW

  $titleLbl = New-Object System.Windows.Forms.Label
  $titleLbl.Text = $title
  $titleLbl.Location = New-Object System.Drawing.Point($layout.Pad, 10)
  $titleLbl.Size = New-Object System.Drawing.Size($innerW, 22)
  $titleLbl.ForeColor = $theme.Text
  $titleLbl.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
  $titleLbl.BackColor = $theme.Panel
  Add-Control $wrap $titleLbl | Out-Null

  $contentTop = 36
  if ($subtitle) {
    $subLbl = New-Object System.Windows.Forms.Label
    $subLbl.Text = $subtitle
    $subLbl.Location = New-Object System.Drawing.Point($layout.Pad, 30)
    $subLbl.Size = New-Object System.Drawing.Size($innerW, 22)
    $subLbl.ForeColor = $theme.Muted
    $subLbl.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $subLbl.BackColor = $theme.Panel
    Add-Control $wrap $subLbl | Out-Null
    $contentTop = 56
  }

  return @{
    Panel      = $wrap
    ContentTop = $contentTop
    Metrics    = $metrics
  }
}

function Set-ButtonStyle($btn, $back, $hover, $bold = $false) {
  $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $btn.FlatAppearance.BorderSize = 0
  $btn.BackColor = $back
  $btn.ForeColor = [System.Drawing.Color]::White
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $btn.Font = New-Object System.Drawing.Font("Segoe UI", 9.25, $style)
  $btn.Cursor = [System.Windows.Forms.Cursors]::Hand
  $btn.UseVisualStyleBackColor = $false
  $btn.Tag = @{ Back = $back; Hover = $hover }
  $btn.Add_MouseEnter({
    param($sender, $e)
    $t = $sender.Tag
    if ($t -is [hashtable]) { $sender.BackColor = $t.Hover }
  })
  $btn.Add_MouseLeave({
    param($sender, $e)
    $t = $sender.Tag
    if ($t -is [hashtable]) { $sender.BackColor = $t.Back }
  })
}

function New-ActionButton($parent, $text, $x, $y, $w, $h, $variant) {
  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = $text
  $btn.Location = New-Object System.Drawing.Point($x, $y)
  $btn.Size = New-Object System.Drawing.Size($w, $h)
  switch ($variant) {
    "primary"   { Set-ButtonStyle $btn $theme.Primary $theme.PrimaryHover $true }
    "accent"    { Set-ButtonStyle $btn $theme.Accent $theme.AccentHover $true }
    "secondary" { Set-ButtonStyle $btn $theme.Secondary $theme.SecondaryHover }
    "danger"    { Set-ButtonStyle $btn $theme.Danger $theme.DangerHover }
    default     { Set-ButtonStyle $btn $theme.Secondary $theme.SecondaryHover }
  }
  Add-Control $parent $btn | Out-Null
  return $btn
}

function Get-DisplayUrl([string]$url) {
  try {
    $u = [Uri]$url
    $path = $u.PathAndQuery
    if ($path -eq "/") { $path = "" }
    return "$($u.Host)$path"
  } catch {
    return $url
  }
}

function New-LinkBlock($parent, $title, $url, $x, $y, $width) {
  $block = New-Object System.Windows.Forms.Panel
  $block.Location = New-Object System.Drawing.Point($x, $y)
  $block.Size = New-Object System.Drawing.Size($width, 50)
  $block.BackColor = $theme.Card
  $block.Cursor = [System.Windows.Forms.Cursors]::Hand
  Add-Control $parent $block | Out-Null

  $titleLbl = New-Object System.Windows.Forms.Label
  $titleLbl.Text = $title
  $titleLbl.Location = New-Object System.Drawing.Point(12, 8)
  $titleLbl.Size = New-Object System.Drawing.Size(($width - 24), 16)
  $titleLbl.ForeColor = $theme.Muted
  $titleLbl.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
  $titleLbl.BackColor = $theme.Card
  $titleLbl.Cursor = [System.Windows.Forms.Cursors]::Hand
  Add-Control $block $titleLbl | Out-Null

  $urlLbl = New-Object System.Windows.Forms.Label
  $urlLbl.Text = Get-DisplayUrl $url
  $urlLbl.Location = New-Object System.Drawing.Point(12, 26)
  $urlLbl.Size = New-Object System.Drawing.Size(($width - 24), 22)
  $urlLbl.ForeColor = $theme.Accent
  $urlLbl.Font = New-Object System.Drawing.Font("Segoe UI", 9)
  $urlLbl.BackColor = $theme.Card
  $urlLbl.Cursor = [System.Windows.Forms.Cursors]::Hand
  $urlLbl.AutoEllipsis = $true
  Add-Control $block $urlLbl | Out-Null
  $script:linkToolTip.SetToolTip($block, $url)
  $script:linkToolTip.SetToolTip($titleLbl, $url)
  $script:linkToolTip.SetToolTip($urlLbl, $url)

  $block.Tag = $url
  $titleLbl.Tag = $url
  $urlLbl.Tag = $url
  $onLinkClick = {
    param($sender, $e)
    $linkUrl = [string]$sender.Tag
    if ($linkUrl) { Open-InChrome $linkUrl }
  }
  $block.Add_Click($onLinkClick)
  $titleLbl.Add_Click($onLinkClick)
  $urlLbl.Add_Click($onLinkClick)

  return @{
    Block = $block
    Title = $titleLbl
    Url   = $urlLbl
  }
}

function Set-LinkBlockState($ref, [string]$state) {
  if (-not $ref) { return }
  $palette = @{
    ok    = @{
      Bg    = [System.Drawing.Color]::FromArgb(35, 90, 68)
      Url   = [System.Drawing.Color]::FromArgb(110, 231, 183)
      Title = [System.Drawing.Color]::FromArgb(220, 252, 231)
    }
    error = @{
      Bg    = [System.Drawing.Color]::FromArgb(95, 45, 45)
      Url   = [System.Drawing.Color]::FromArgb(252, 165, 165)
      Title = [System.Drawing.Color]::FromArgb(254, 226, 226)
    }
    idle  = @{
      Bg    = $theme.Card
      Url   = $theme.Muted
      Title = $theme.Muted
    }
  }
  $p = $palette[$state]
  if (-not $p) { $p = $palette.idle }
  foreach ($ctrl in @($ref.Block, $ref.Title, $ref.Url)) {
    $ctrl.BackColor = $p.Bg
  }
  $ref.Title.ForeColor = $p.Title
  $ref.Url.ForeColor = $p.Url
}

function Test-LocalServerRunning {
  try {
    $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool]$conn
  } catch {
    return $false
  }
}

function Stop-LocalServer {
  $killed = 0
  try {
    $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $listeners) {
      if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        $killed++
      }
    }
  } catch { }
  return $killed
}

function Start-LocalServer {
  if (Test-LocalServerRunning) { return "already" }
  $devCmd = "Set-Location '$projectRoot'; npm run dev"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $devCmd
  return "started"
}

function Test-OnlineReachable {
  try {
    $res = Invoke-WebRequest -Uri $onlineUrl -Method Head -TimeoutSec 5 -UseBasicParsing
    return $res.StatusCode -ge 200 -and $res.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Get-SyncStatus([switch]$SkipFetch) {
  $result = @{ State = "idle"; Detail = "Comprobando..." }

  if (-not $SkipFetch) {
    try {
      git fetch origin main --quiet 2>$null
    } catch {
      $result.State = "warn"
      $result.Detail = "Sin internet o GitHub no responde"
      return $result
    }
  }

  $localHead = (git rev-parse HEAD 2>$null)
  $remoteHead = (git rev-parse origin/main 2>$null)
  $dirty = git status --porcelain

  if (-not $localHead -or -not $remoteHead) {
    $result.State = "warn"
    $result.Detail = "No se pudo leer Git"
    return $result
  }

  $shortLocal = $localHead.Substring(0, 7)

  if ($dirty) {
    $count = ($dirty | Measure-Object).Count
    $result.State = "warn"
    $result.Detail = "$count archivo(s) sin publicar en Vercel"
    return $result
  }

  if ($localHead -ne $remoteHead) {
    $ahead = 0
    $behind = 0
    try {
      $ahead = [int](git rev-list --count origin/main..HEAD 2>$null)
      $behind = [int](git rev-list --count HEAD..origin/main 2>$null)
    } catch { }

    if ($ahead -gt 0) {
      $result.State = "warn"
      $result.Detail = "$ahead commit(s) en tu PC que Vercel aun no tiene"
      return $result
    }
    if ($behind -gt 0) {
      $result.State = "warn"
      $result.Detail = "GitHub tiene $behind commit(s) mas nuevos que tu PC"
      return $result
    }
  }

  $result.State = "ok"
  $result.Detail = "Todo publicado (commit $shortLocal)"
  return $result
}

# --- Layout ---
$content = New-Object System.Windows.Forms.Panel
$content.Dock = "Fill"
$content.AutoScroll = $false
$content.BackColor = $theme.Bg
Add-Control $form $content | Out-Null

$header = New-Object System.Windows.Forms.Label
$header.Text = "Paquemas"
$header.Location = New-Object System.Drawing.Point($layout.Pad, 14)
$header.Size = New-Object System.Drawing.Size(180, 32)
$header.ForeColor = $theme.Text
$header.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$header.BackColor = $theme.Bg
Add-Control $content $header | Out-Null

$tagline = New-Object System.Windows.Forms.Label
$tagline.Text = "Publica y prueba tu app desde el escritorio"
$tagline.Location = New-Object System.Drawing.Point(200, 22)
$tagline.Size = New-Object System.Drawing.Size(($layout.SectionW - 184), 20)
$tagline.ForeColor = $theme.Muted
$tagline.BackColor = $theme.Bg
Add-Control $content $tagline | Out-Null

$script:linkToolTip = New-Object System.Windows.Forms.ToolTip
$script:linkToolTip.AutoPopDelay = 10000

$btnRowH = 34
$y = 54

# Enlaces: tarjeta verde/roja + botones de control debajo
$linkCardH = 50
$linkCtlH = 30
$linksH = 56 + $linkCardH + 8 + $linkCtlH + 8 + $linkCtlH + 12
$linksSec = New-Section $content "Enlaces" "Verde = activo, rojo = apagado. Se actualiza cada 15 s. Clic abre Chrome." $layout.Pad $y $layout.SectionW $linksH
$lm = $linksSec.Metrics
$linkW = $lm.BtnHalfW
$linkY = $linksSec.ContentTop
$linkX2 = $layout.Pad + $linkW + $layout.ColGap
$script:linkLocal = New-LinkBlock $linksSec.Panel "Local (tu PC)" $localUrl $layout.Pad $linkY $linkW
$script:linkOnline = New-LinkBlock $linksSec.Panel "Online (Vercel)" "$onlineUrl/login" $linkX2 $linkY $linkW
Set-LinkBlockState $script:linkLocal "idle"
Set-LinkBlockState $script:linkOnline "idle"

$ctlY1 = $linkY + $linkCardH + 8
$ctlY2 = $ctlY1 + $linkCtlH + 6
$ctlHalf = [int](($linkW - $layout.ColGap) / 2)
$ctlHalf2 = $layout.Pad + $ctlHalf + $layout.ColGap
$ctlHalfOnline2 = $linkX2 + $ctlHalf + $layout.ColGap

$btnStartLocal = New-ActionButton $linksSec.Panel "Iniciar" $layout.Pad $ctlY1 $ctlHalf $linkCtlH "primary"
$btnStopLocal = New-ActionButton $linksSec.Panel "Apagar" $ctlHalf2 $ctlY1 $ctlHalf $linkCtlH "danger"

$btnUpdateOnline = New-ActionButton $linksSec.Panel "Publicar" $linkX2 $ctlY1 $ctlHalf $linkCtlH "accent"
$btnRedeployOnline = New-ActionButton $linksSec.Panel "Redesplegar" $ctlHalfOnline2 $ctlY1 $ctlHalf $linkCtlH "secondary"

$onlineHalf = $ctlHalf
$btnVercelPanel = New-ActionButton $linksSec.Panel "Panel Vercel" $linkX2 $ctlY2 $onlineHalf $linkCtlH "secondary"
$btnPauseOnline = New-ActionButton $linksSec.Panel "Pausar sitio" ($linkX2 + $onlineHalf + $layout.ColGap) $ctlY2 $onlineHalf $linkCtlH "danger"
$y += $linksH + 12

# Mensaje de commit (publicar)
$commitH = 88
$commitSec = New-Section $content "Mensaje al publicar" "Opcional: texto del commit en GitHub" $layout.Pad $y $layout.SectionW $commitH
$cm = $commitSec.Metrics
$msgBox = New-Object System.Windows.Forms.TextBox
$msgBox.Location = New-Object System.Drawing.Point($layout.Pad, $commitSec.ContentTop)
$msgBox.Size = New-Object System.Drawing.Size($cm.InnerW, 28)
$msgBox.Text = "Actualizacion desde mi PC"
$msgBox.BackColor = $theme.Card
$msgBox.ForeColor = $theme.Text
$msgBox.BorderStyle = "FixedSingle"
$msgBox.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
Add-Control $commitSec.Panel $msgBox | Out-Null
$y += $commitH + 12

$statusBox = New-Object System.Windows.Forms.TextBox
$statusBox.Location = New-Object System.Drawing.Point($layout.Pad, $y)
$statusBox.Size = New-Object System.Drawing.Size($layout.SectionW, 52)
$statusBox.Multiline = $true
$statusBox.ReadOnly = $true
$statusBox.ScrollBars = "None"
$statusBox.BackColor = $theme.LogBg
$statusBox.ForeColor = $theme.Muted
$statusBox.BorderStyle = "None"
$statusBox.Font = New-Object System.Drawing.Font("Consolas", 8.25)
Add-Control $content $statusBox | Out-Null

$formHeight = $y + $statusBox.Height + $layout.Pad + 12
$form.ClientSize = New-Object System.Drawing.Size($formW, $formHeight)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 15000

function Write-Status([string]$text) {
  $statusBox.AppendText("$text`r`n")
  $statusBox.SelectionStart = $statusBox.Text.Length
  $statusBox.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

function Set-ActionButtonsEnabled([bool]$enabled) {
  $btnStartLocal.Enabled = $enabled
  $btnStopLocal.Enabled = $enabled
  $btnUpdateOnline.Enabled = $enabled
  $btnRedeployOnline.Enabled = $enabled
  $btnVercelPanel.Enabled = $enabled
  $btnPauseOnline.Enabled = $enabled
}

function Publish-OnlineFromPc {
  $msg = $msgBox.Text.Trim()
  if (-not $msg) { $msg = "Actualizacion desde mi PC" }

  git add -A 2>&1 | ForEach-Object { Write-Status $_ }
  git reset HEAD -- abrir_chrome_debug.bat 2>$null

  $porcelain = git status --porcelain
  if (-not $porcelain) {
    $ahead = 0
    try { $ahead = [int](git rev-list --count origin/main..HEAD 2>$null) } catch { }
    if ($ahead -gt 0) {
      Write-Status "Subiendo $ahead commit(s) pendiente(s)..."
      git push origin main 2>&1 | ForEach-Object { Write-Status $_ }
    } else {
      Write-Status "No hay archivos nuevos. Codigo ya estaba en GitHub."
    }
  } else {
    Write-Status "Guardando en GitHub..."
    git commit -m $msg 2>&1 | ForEach-Object { Write-Status $_ }
    Write-Status "Enviando a Vercel..."
    git push origin main 2>&1 | ForEach-Object { Write-Status $_ }
  }

  Write-Status "Listo. Vercel construye en 1-2 min: $onlineUrl"
}

function Invoke-VercelRedeploy {
  Set-Location $projectRoot
  Write-Status "Redesplegando en Vercel (mismo codigo, build nuevo)..."
  npx vercel redeploy --prod --yes 2>&1 | ForEach-Object { Write-Status $_ }
}

$script:indicatorBusy = $false
$script:lastSyncDetail = $null
$script:indicatorJob = $null
$script:indicatorPollTimer = $null
$script:indicatorChecksPath = Join-Path $PSScriptRoot "publish-indicator-checks.ps1"
$script:projectRootPath = "$projectRoot"

function Stop-IndicatorJob {
  if ($script:indicatorPollTimer) {
    $script:indicatorPollTimer.Stop()
    $script:indicatorPollTimer.Dispose()
    $script:indicatorPollTimer = $null
  }
  if ($script:indicatorJob) {
    Stop-Job $script:indicatorJob -ErrorAction SilentlyContinue
    Remove-Job $script:indicatorJob -Force -ErrorAction SilentlyContinue
    $script:indicatorJob = $null
  }
}

function Apply-IndicatorSnapshot($snapshot) {
  if ($snapshot.LocalRunning) {
    Set-LinkBlockState $script:linkLocal "ok"
  } else {
    Set-LinkBlockState $script:linkLocal "error"
  }

  if ($snapshot.OnlineOk) {
    Set-LinkBlockState $script:linkOnline "ok"
  } else {
    Set-LinkBlockState $script:linkOnline "error"
  }

  if ($snapshot.Sync -and $snapshot.Sync.Detail) {
    $detail = $snapshot.Sync.Detail
    if ($script:lastSyncDetail -ne $detail) {
      Write-Status "Git: $detail"
      $script:lastSyncDetail = $detail
    }
  }
}

function Start-IndicatorRefresh([switch]$FullCheck) {
  if ($script:indicatorBusy) { return }
  Stop-IndicatorJob

  $script:indicatorBusy = $true
  Set-LinkBlockState $script:linkLocal "idle"
  Set-LinkBlockState $script:linkOnline "idle"

  $doFetch = [bool]$FullCheck
  $script:indicatorJob = Start-Job -FilePath $script:indicatorChecksPath -ArgumentList $doFetch, $script:projectRootPath, $onlineUrl

  $script:indicatorPollTimer = New-Object System.Windows.Forms.Timer
  $script:indicatorPollTimer.Interval = 300
  $script:indicatorPollTimer.Add_Tick({
    if (-not $script:indicatorJob) { return }

    $state = $script:indicatorJob.State
    if ($state -eq "Running") { return }

    $script:indicatorPollTimer.Stop()

    try {
      if ($state -eq "Completed") {
        $snapshot = Receive-Job $script:indicatorJob -ErrorAction Stop
        Apply-IndicatorSnapshot $snapshot
      } else {
        Write-Status "No se pudo comprobar el estado."
      }
    } catch {
      Write-Status "Error al comprobar: $($_.Exception.Message)"
    } finally {
      Stop-IndicatorJob
      $script:indicatorBusy = $false
    }
  })
  $script:indicatorPollTimer.Start()
}

$timer.Add_Tick({ Start-IndicatorRefresh })
$timer.Start()

Write-Status "$projectRoot"
Write-Status ""
Start-IndicatorRefresh -FullCheck

$btnStartLocal.Add_Click({
  Write-Status ""
  $result = Start-LocalServer
  if ($result -eq "already") {
    Write-Status "El servidor local ya estaba encendido."
  } else {
    Write-Status "Iniciando servidor... espera unos segundos."
    Write-Status "Se abre una ventana de terminal (no la cierres)."
  }
  Start-Sleep -Seconds 2
  Start-IndicatorRefresh
})

$btnStopLocal.Add_Click({
  Write-Status ""
  if (-not (Test-LocalServerRunning)) {
    Write-Status "El servidor local ya estaba apagado."
  } else {
    $n = Stop-LocalServer
    Write-Status "Servidor apagado ($n proceso(s))."
  }
  Start-IndicatorRefresh
})

$btnUpdateOnline.Add_Click({
  Set-ActionButtonsEnabled $false
  try {
    Write-Status ""
    Write-Status "=== Publicar cambios ==="
    Publish-OnlineFromPc
    [System.Windows.Forms.MessageBox]::Show(
      "Codigo enviado a GitHub.`n`nVercel actualizara en 1-2 min:`n$onlineUrl/login",
      "Paquemas",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
  } catch {
    Write-Status "ERROR: $($_.Exception.Message)"
  } finally {
    Set-ActionButtonsEnabled $true
    Start-Sleep -Seconds 2
    Start-IndicatorRefresh -FullCheck
  }
})

$btnRedeployOnline.Add_Click({
  Set-ActionButtonsEnabled $false
  try {
    Write-Status ""
    Write-Status "=== Redesplegar ==="
    Invoke-VercelRedeploy
    Write-Status "Redespliegue solicitado."
  } catch {
    Write-Status "ERROR: $($_.Exception.Message)"
  } finally {
    Set-ActionButtonsEnabled $true
    Start-IndicatorRefresh -FullCheck
  }
})

$btnVercelPanel.Add_Click({
  Open-InChrome $vercelDeployments
  Write-Status "Abriendo Vercel..."
})

$btnPauseOnline.Add_Click({
  $answer = [System.Windows.Forms.MessageBox]::Show(
@'
Vercel no tiene un boton de "apagar" como en tu PC.

Para ocultar el sitio del publico puedes eliminar el proyecto o quitar el dominio en Settings.

Abrir Settings de Vercel ahora?
'@,
    "Pausar sitio online",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($answer -eq [System.Windows.Forms.DialogResult]::Yes) {
    Open-InChrome $vercelSettings
    Write-Status "Abriendo ajustes en Vercel..."
  }
})

$form.Add_FormClosed({
  $timer.Stop()
  Stop-IndicatorJob
})
[void]$form.ShowDialog()
