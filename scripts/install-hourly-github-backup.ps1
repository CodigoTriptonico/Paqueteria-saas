$ErrorActionPreference = "Stop"

$taskName = "PaqueteriaSaasHourlyGitHubBackup"
$runner = Join-Path $PSScriptRoot "run-auto-github-backup.ps1"
$startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
$shortRunner = (& cmd.exe /d /c "for %I in (`"$runner`") do @echo %~sI").Trim()
if (-not $shortRunner) {
  throw "Could not resolve a Windows-safe path for $runner."
}
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shortRunner"

& schtasks.exe /Create /TN $taskName /TR $taskCommand /SC HOURLY /MO 1 /ST $startTime /F
if ($LASTEXITCODE -ne 0) {
  throw "Could not create $taskName."
}

Write-Output "Created $taskName. First scheduled run: $startTime."
