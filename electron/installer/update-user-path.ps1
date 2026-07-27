param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('add', 'remove')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$Directory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Normalize-PathEntry {
  param([string]$Value)

  $trimmed = $Value.Trim().Trim('"')
  if (-not $trimmed) {
    return ''
  }

  try {
    return [IO.Path]::GetFullPath($trimmed).TrimEnd(
      [IO.Path]::DirectorySeparatorChar,
      [IO.Path]::AltDirectorySeparatorChar
    )
  }
  catch {
    return $trimmed.TrimEnd('\', '/')
  }
}

$target = Normalize-PathEntry $Directory
if (-not $target) {
  throw 'Cannot add an empty directory to the user PATH.'
}

$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = @()
if ($currentPath) {
  $entries = @($currentPath -split ';' | Where-Object { $_.Trim() })
}

$filtered = @($entries | Where-Object {
  -not [string]::Equals(
    (Normalize-PathEntry $_),
    $target,
    [StringComparison]::OrdinalIgnoreCase
  )
})

if ($Action -eq 'add') {
  $filtered += $target
}

[Environment]::SetEnvironmentVariable('Path', ($filtered -join ';'), 'User')
Write-Output "LingBuilder CLI user PATH update completed: action=$Action target=$target"
