[CmdletBinding()]
param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$ips = @(
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object InterfaceMetric, SkipAsSource |
    Select-Object -ExpandProperty IPAddress -Unique
)

Write-Host "Serving VIA from: $repo"
Write-Host "Desktop URL: http://127.0.0.1:$Port/"
if ($ips.Count) {
  Write-Host 'Phone URLs (same Wi-Fi):'
  foreach ($ip in $ips) {
    Write-Host "  http://${ip}:$Port/"
  }
} else {
  Write-Warning 'No LAN IPv4 address detected. Connect this PC to Wi-Fi/Ethernet and retry.'
}

Write-Host ''
Write-Host 'If your phone cannot connect, allow Python through Windows Firewall when prompted.'
Write-Host 'Press Ctrl+C to stop the server.'
Write-Host ''

python -m http.server $Port --bind 0.0.0.0
