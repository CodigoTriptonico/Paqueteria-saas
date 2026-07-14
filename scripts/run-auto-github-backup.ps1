$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source

Set-Location -LiteralPath $repoRoot
& $node (Join-Path $PSScriptRoot "auto-github-backup.mjs")
exit $LASTEXITCODE
