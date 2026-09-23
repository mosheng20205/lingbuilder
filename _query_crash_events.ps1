$ErrorActionPreference = 'SilentlyContinue'
$events = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Application Error'} -MaxEvents 30
foreach ($e in $events) {
  if ($e.Message -match 'LingBuilder') {
    Write-Output ('TIME: ' + $e.TimeCreated.ToString('MM-dd HH:mm:ss'))
    $lines = $e.Message -split "`r?`n"
    foreach ($l in $lines[0..12]) { if ($l.Trim()) { Write-Output ('  ' + $l.Trim()) } }
    Write-Output '----'
  }
}
