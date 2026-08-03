$ErrorActionPreference = "Stop"

$toolDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = (Resolve-Path (Join-Path $toolDirectory "..\..")).Path
$buildDirectory = Join-Path $toolDirectory "build"
$outputPath = Join-Path $buildDirectory "LingBuilderCodexConfigurator.exe"
$stagedOutputPath = Join-Path $buildDirectory "LingBuilderCodexConfigurator.next.exe"
New-Item -ItemType Directory -Force -Path $buildDirectory | Out-Null

$newEmojiRoot = Join-Path $workspaceRoot ".lingbuilder\modules\lingbuilder.new_emoji.ui"
$newEmojiInclude = Join-Path $newEmojiRoot "include"
$newEmojiBridge = Join-Path $newEmojiRoot "src\new_emoji_bridge.cpp"
$newEmojiLibDirectory = Join-Path $newEmojiRoot "lib\x64"
$newEmojiLib = Join-Path $newEmojiLibDirectory "new_emoji.lib"
$newEmojiDll = Join-Path $newEmojiRoot "bin\x64\new_emoji.dll"
foreach ($requiredPath in @($newEmojiInclude, $newEmojiBridge, $newEmojiLib, $newEmojiDll)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "New_Emoji x64 运行时文件缺失：$requiredPath"
  }
}

$programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
$vsWhere = Join-Path $programFilesX86 "Microsoft Visual Studio\Installer\vswhere.exe"
$installationPath = ""
if (Test-Path -LiteralPath $vsWhere) {
  $installationPath = (& $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
}
if ([string]::IsNullOrWhiteSpace($installationPath)) {
  throw "Visual Studio C++ tools were not found. Install the Desktop development with C++ workload."
}

$vcvars = Join-Path $installationPath "VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path -LiteralPath $vcvars)) {
  throw "MSVC environment script was not found: $vcvars"
}

$sourcePath = Join-Path $toolDirectory "main.cpp"
$compile = 'call "{0}" && cl.exe /nologo /std:c++17 /utf-8 /W4 /EHsc /DUNICODE /D_UNICODE /DWIN32_LEAN_AND_MEAN /DLINGBUILDER_USE_NEW_EMOJI /I"{1}" "{2}" "{3}" /Fe:"{4}" /link /SUBSYSTEM:WINDOWS /LIBPATH:"{5}" new_emoji.lib comdlg32.lib comctl32.lib gdi32.lib ole32.lib shell32.lib user32.lib' -f $vcvars, $newEmojiInclude, $sourcePath, $newEmojiBridge, $stagedOutputPath, $newEmojiLibDirectory
& cmd.exe /d /s /c $compile
if ($LASTEXITCODE -ne 0) {
  throw "Configurator compilation failed with exit code $LASTEXITCODE"
}

$runtimePath = Join-Path $buildDirectory "new_emoji.dll"
if (Test-Path -LiteralPath $runtimePath) {
  $sourceHash = (Get-FileHash -LiteralPath $newEmojiDll -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) {
    try {
      Copy-Item -LiteralPath $newEmojiDll -Destination $runtimePath -Force
    } catch {
      throw "new_emoji.dll 正在使用中，请先关闭配置器后重试。"
    }
  }
} else {
  Copy-Item -LiteralPath $newEmojiDll -Destination $runtimePath -Force
}

try {
  $previousOutputPath = Join-Path $buildDirectory "LingBuilderCodexConfigurator.exe.previous"
  Move-Item -LiteralPath $outputPath -Destination $previousOutputPath -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $stagedOutputPath -Destination $outputPath -Force -ErrorAction Stop
} catch {
  throw "无法替换正式配置器，请先关闭正在运行的 LingBuilderCodexConfigurator.exe。"
}

Write-Host "Generated: $outputPath"
Write-Host "New_Emoji runtime: $runtimePath"
