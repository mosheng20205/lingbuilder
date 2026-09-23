# analyze-lbdump.ps1 —— LingBuilderPreview.exe 崩溃转储取证（任务 4 配套）
#
# 用法：powershell -NoProfile -File scripts\analyze-lbdump.ps1 -Dump "$env:TEMP\lbdumps\LingBuilderPreview.exe.1234.dmp"
#
# 前置：已为目标 exe 开启 LocalDumps（DumpType=2 全内存转储，目录 %TEMP%\lbdumps，最多留 5 份）：
#   reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LingBuilderPreview.exe\LocalDumps" /v DumpFolder /t REG_EXPAND_SZ /d "%TEMP%\lbdumps" /f
#   reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LingBuilderPreview.exe\LocalDumps" /v DumpType /t REG_DWORD /d 2 /f
#   reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LingBuilderPreview.exe\LocalDumps" /v DumpCount /t REG_DWORD /d 5 /f
#
# 取证三件事：
#   ① 异常码        —— !analyze -v 的 ExceptionCode 段
#   ② 出错线程调用栈 —— .ecxr 后 kv 40（含 Child-SP/返回地址/函数名/参数）
#   ③ 崩溃时堆状态   —— !heap -s（观察是否有关键区/损坏标记，验证/排除堆破坏）
#
# 判读口径（写在这里避免临场发挥）：
#   - 转储目录出现 .dmp 且 ExceptionCode 非零        → 真实异常崩溃，按调用栈定位模块。
#   - 进程再次消失但 lbdumps 目录是空的、WER 也无记录 → 本地无异常路径被触发，
#     高度指向外部 TerminateProcess（例如被测软件的自我保护），属被测对象的对抗行为，
#     不是灵码代码生成的缺陷；不要为了“有产出”硬凑一个灵码 bug。
param(
  [Parameter(Mandatory = $true)][string]$Dump
)

$cdbCandidates = @(
  'C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe',
  'C:\Program Files\Windows Kits\10\Debuggers\x64\cdb.exe'
)
$cdb = $cdbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cdb) {
  Write-Error '未找到 cdb.exe：请安装 Windows SDK 的 Debugging Tools for Windows 后重试。'
  exit 2
}
if (-not (Test-Path $Dump)) {
  Write-Error "转储不存在：$Dump（先复现一次崩溃，再到 %TEMP%\lbdumps 找 .dmp）"
  exit 2
}

$symbolDir = Join-Path $env:TEMP 'lbdumps-symbols'
New-Item -ItemType Directory -Force -Path $symbolDir | Out-Null

Write-Host "== 转储：$Dump =="
& $cdb -z $Dump -y "srv*$symbolDir*https://msdl.microsoft.com/download/symbols" -c '!analyze -v; .ecxr; kv 40; !heap -s; q'
Write-Host ''
Write-Host '== 判读提示：找 ExceptionCode / 线程栈顶部模块 / !heap 输出中的损坏标记；'
Write-Host '   若整份转储是进程被TerminateProcess 时 LocalDumps 不会生成（本脚本对空目录直接报错），此时结论见文件头判读口径。'
