[CmdletBinding()]
param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8064 }),
  [string]$Browse = $env:BROWSE
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$url = "http://127.0.0.1:$Port/?qa=1&guest=1"

if (-not $Browse) {
  $candidates = @(
    (Join-Path $HOME '.agents\skills\gstack\browse\dist\browse.exe'),
    (Join-Path $HOME '.claude\skills\gstack\browse\dist\browse.exe'),
    (Join-Path $repo '.claude\skills\gstack\browse\dist\browse.exe')
  )
  $Browse = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

if (-not $Browse -or -not (Test-Path -LiteralPath $Browse -PathType Leaf)) {
  throw 'browse binary not found. Pass -Browse or set the BROWSE environment variable.'
}

function Invoke-Browse {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  # browse writes normal daemon startup/status messages to stderr. Under the
  # script-wide Stop preference PowerShell turns those into terminating
  # NativeCommandError records before we can inspect the actual exit code.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $Browse @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "browse $($Arguments -join ' ') failed:`n$($output -join "`n")"
  }
  return $output
}

function Wait-AppReady {
  param([string]$Label)
  foreach ($attempt in 1..4) {
    Invoke-Browse goto $url | Out-Null
    Invoke-Browse wait --load | Out-Null
    foreach ($poll in 1..25) {
      $ready = (Invoke-Browse js "(window.VIA&&window.VIA.ready)?'1':'0'" | Select-Object -Last 1).Trim()
      if ($ready -eq '1') { return }
      Start-Sleep -Milliseconds 300
    }
    Write-Host "  ($Label attempt $attempt`: app not ready, re-navigating)"
  }
  throw "app never reported ready at $url ($Label)"
}

function Test-Viewport {
  param([string]$Label, [int]$Width, [int]$Height)
  Invoke-Browse viewport "${Width}x${Height}" | Out-Null
  Wait-AppReady $Label
  $verdictText = (Invoke-Browse eval tests/journey.eval.js | Select-Object -Last 1).Trim()
  Write-Host "$Label verdict: $verdictText"
  try { $verdict = $verdictText | ConvertFrom-Json }
  catch { throw "could not parse $Label verdict: $verdictText" }
  if ([int]$verdict.failed -ne 0) {
    throw "failed $Label checks: $($verdict.fails -join ', ')"
  }
}

$server = $null
try {
  $server = Start-Process -FilePath python -ArgumentList @(
    '-m', 'http.server', $Port, '--bind', '127.0.0.1'
  ) -WorkingDirectory $repo -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 1

  Test-Viewport desktop 1280 900
  Test-Viewport mobile 375 812
  Write-Host 'ALL JOURNEYS PASSED (desktop + mobile)'
}
finally {
  try { Invoke-Browse stop | Out-Null } catch { }
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
