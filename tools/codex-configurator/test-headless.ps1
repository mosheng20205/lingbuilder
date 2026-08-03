$ErrorActionPreference = "Stop"

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ("lingbuilder-codex-configurator-" + [guid]::NewGuid().ToString("N"))
$config = Join-Path $workspace ".codex\config.toml"
$exe = Join-Path (Get-Location) "build\LingBuilderCodexConfigurator.exe"

function Invoke-Configurator([string[]] $arguments) {
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
  return $process.ExitCode
}

try {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $config) | Out-Null
  Set-Content -LiteralPath $config -Value "[features]`nfast_mode = true`n" -Encoding UTF8

  $previewExit = Invoke-Configurator @("--headless", "--workspace", $workspace, "--permission", "preview")
  $previewText = [System.IO.File]::ReadAllText($config)
  if ($previewExit -ne 0) { throw "preview exit=$previewExit" }
  if ($previewText -notmatch '\[features\]\s*fast_mode = true') { throw "unrelated TOML was not preserved" }
  if ($previewText -notmatch '--permission.*preview') { throw "preview permission was not written" }

  $yoloExit = Invoke-Configurator @("--headless", "--workspace", $workspace, "--permission", "yolo")
  $yoloText = [System.IO.File]::ReadAllText($config)
  if ($yoloExit -ne 0) { throw "yolo exit=$yoloExit" }
  if ($yoloText -notmatch '--permission.*yolo') { throw "yolo permission was not written" }

  Set-Content -LiteralPath $config -Value "[mcp_servers.lingbuilder_desktop]`ncommand = `"custom`"`n`n[features]`nfast_mode = true`n" -Encoding UTF8
  $conflictExit = Invoke-Configurator @("--headless", "--workspace", $workspace, "--permission", "preview")
  if ($conflictExit -ne 5) { throw "expected conflict exit 5, got $conflictExit" }
  $conflictText = [System.IO.File]::ReadAllText($config)
  if ($conflictText -notmatch 'command = "custom"') { throw "conflicting config was changed without force" }

  $forceExit = Invoke-Configurator @("--headless", "--workspace", $workspace, "--permission", "yolo", "--force")
  $forceText = [System.IO.File]::ReadAllText($config)
  if ($forceExit -ne 0) { throw "force exit=$forceExit" }
  if ($forceText -match 'command = "custom"') { throw "conflicting config was not replaced with force" }
  if ($forceText -notmatch '--permission.*yolo') { throw "forced yolo permission was not written" }
  if ($forceText -notmatch '\[features\]\s*fast_mode = true') { throw "features config was lost during force replacement" }

  $removeExit = Invoke-Configurator @("--headless", "--workspace", $workspace, "--remove")
  $removeText = [System.IO.File]::ReadAllText($config)
  if ($removeExit -ne 0) { throw "remove exit=$removeExit" }
  if ($removeText -match 'LingBuilder ChatGPT/Codex desktop MCP') { throw "managed block was not removed" }
  if ($removeText -notmatch '\[features\]\s*fast_mode = true') { throw "features config was lost during remove" }

  [pscustomobject]@{
    previewExit = $previewExit
    yoloExit = $yoloExit
    conflictExit = $conflictExit
    forceExit = $forceExit
    removeExit = $removeExit
    result = "pass"
  } | ConvertTo-Json
} finally {
  Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}
