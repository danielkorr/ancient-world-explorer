# Mobile-width visual QA pass for VIA (PowerShell mirror of mobile-shots.sh).
# Serves the site, drives the ?qa=1 fixture through window.VIA.* at the 375x812
# production mobile breakpoint, and captures a viewport screenshot of each key
# flow into tests/screenshots/mobile/.
#
# Companion to run-journeys.ps1: that ASSERTS behavior (pass/fail); this CAPTURES
# layout so you (or a paired agent like Codex) can eyeball the mobile chrome +
# panels for regressions. Runs on ?qa=1 for headless stability — the heavy
# Itiner-e road canvas is skipped in that mode (see app.js `const QA`), so these
# shots cover CHROME + PANEL LAYOUT, not map imagery or the secondary-road
# network. Imagery and real iOS-Safari touch behavior still need a real device.
#
#   .\tests\mobile-shots.ps1
#   .\tests\mobile-shots.ps1 -Browse C:\path\to\browse.exe -Port 8065
[CmdletBinding()]
param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8065 }),
  [string]$Browse = $env:BROWSE
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$url = "http://127.0.0.1:$Port/?qa=1&guest=1"
$out = Join-Path $repo 'tests\screenshots\mobile'
New-Item -ItemType Directory -Force -Path $out | Out-Null

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
  # -AllowFailure: return output instead of throwing on non-zero exit, so a cold
  # daemon's first goto can be retried. Mirrors run-journeys.ps1.
  param(
    [switch]$AllowFailure,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $Browse @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "browse $($Arguments -join ' ') failed:`n$($output -join "`n")"
  }
  return $output
}

function Wait-AppReady {
  foreach ($attempt in 1..4) {
    Invoke-Browse -AllowFailure goto $url | Out-Null
    Invoke-Browse -AllowFailure wait --load | Out-Null
    foreach ($poll in 1..25) {
      $ready = (Invoke-Browse -AllowFailure js "(window.VIA&&window.VIA.ready)?'1':'0'" | Select-Object -Last 1)
      if ("$ready".Trim() -eq '1') { return }
      Start-Sleep -Milliseconds 300
    }
    Write-Host "  (attempt $attempt`: app not ready, re-navigating)"
  }
  throw "app never reported ready at $url"
}

function Capture-Shot {
  # Drive the page (optional js expression) then capture the 375x812 viewport.
  param([string]$Name, [string]$Driver)
  if ($Driver) { Invoke-Browse -AllowFailure js $Driver | Out-Null }
  Start-Sleep -Milliseconds 500   # let panel slide / era swap / render settle
  $path = Join-Path $out "$Name.png"
  Invoke-Browse -AllowFailure screenshot --viewport $path | Out-Null
  if (Test-Path -LiteralPath $path) { Write-Host "  + $Name.png" }
  else { Write-Host "  x $Name.png (capture failed)" }
}

$server = $null
$exitCode = 0
try {
  $server = Start-Process -FilePath python -ArgumentList @(
    '-m', 'http.server', $Port, '--bind', '127.0.0.1'
  ) -WorkingDirectory $repo -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 1

  Invoke-Browse viewport '375x812' | Out-Null
  Wait-AppReady
  Write-Host "Capturing mobile (375x812) flows -> $out\"

  # 00 - cold boot: map + topbar + shrunk era toggle + dock, no panel.
  Capture-Shot '00-boot'

  # 01 - search dropdown (open the mobile dock search, then a query hitting a road + sites).
  Capture-Shot '01-search' '(function(){ if(typeof openDockPanel==="function") openDockPanel("search"); var h=window.VIA.searchSites("appia"); return "hits:"+(h?h.length:0); })()'

  # 02 - curated site panel (rich: hero, details, related links, check-in row).
  Capture-Shot '02-site-panel' '(function(){ if(typeof closeSearchResults==="function") closeSearchResults(); window.VIA.openSite("cumae"); return window.VIA.getState().panelName; })()'

  # 03 - road panel (curated road tap -> the segment panel layout + nearby sites).
  Capture-Shot '03-road-panel' '(function(){ window.VIA.closePanel(); window.VIA.tapRoad("Via Appia"); return "road"; })()'

  # 04 - photo-quest panel (quest banner + share/email affordances).
  Capture-Shot '04-quest-panel' '(function(){ window.VIA.closePanel(); var q=window.VIA.firstQuestSite("photo"); if(q&&q.id) window.VIA.openSite(q.id); return q?q.id:"none"; })()'

  # 05 - full catalogue density (detail slider -> all sites, clustered, at mobile width).
  Capture-Shot '05-detail-all' '(function(){ window.VIA.closePanel(); window.VIA.setDetail(2); return window.VIA.getState().visibleSiteCount; })()'

  # 06 - modern era chrome (basemap swap; verify the toggle active state + layout).
  Capture-Shot '06-era-modern' '(function(){ window.VIA.setDetail(0); window.VIA.setEra("modern"); return window.VIA.getState().era; })()'

  # 07 - quest legend / key (the on-mobile legend popover).
  Capture-Shot '07-legend' '(function(){ window.VIA.setEra("ancient"); window.VIA.openLegend(); return "legend"; })()'

  $count = (Get-ChildItem -Path $out -Filter *.png | Measure-Object).Count
  Write-Host "DONE - $count shots in $out\"
}
catch {
  Write-Error $_
  $exitCode = 1
}
finally {
  try { Invoke-Browse -AllowFailure stop | Out-Null } catch { }
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}

exit $exitCode
