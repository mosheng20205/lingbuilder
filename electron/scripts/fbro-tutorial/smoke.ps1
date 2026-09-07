param(
  [Parameter(Mandatory = $true)][string]$BinDir,
  [Parameter(Mandatory = $true)][string]$Id,
  [int]$AliveSeconds = 10,
  [string]$ClickButtons = '',
  [int]$WindowWaitSeconds = 10,
  [int]$ClickDelayMs = 2500
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool EnumChildWindows(System.IntPtr h, EnumProc f, System.IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(System.IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr h);
[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int SendMessageW(System.IntPtr h, uint m, int w, System.Text.StringBuilder l);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder s, int n);
public delegate bool EnumProc(System.IntPtr h, System.IntPtr l);
'@

$exe = Join-Path $BinDir 'LingBuilderPreview.exe'
if (-not (Test-Path $exe)) { Write-Output "FAIL 缺少 exe: $exe"; exit 1 }

$outFile = Join-Path $env:TEMP "fbro-smoke-$Id.out"
$errFile = Join-Path $env:TEMP "fbro-smoke-$Id.err"
Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue

# 严格清场：同机残留的 FBro 进程会改变 SDK 的多实例判定并锁住 bin 目录，
# 导致后续实例迟迟不显示窗口。只清理构建产物目录下的进程，不动用户自己的程序。
function Stop-BuildProcesses {
  $victims = @(Get-Process -Name FBroSubprocess, LingBuilderPreview, LingBuilderFbroHost -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path -like '*\.lingbuilder-build\*' })
  foreach ($v in $victims) { Stop-Process -Id $v.Id -Force -ErrorAction SilentlyContinue }
  return $victims.Count
}
$purged = Stop-BuildProcesses
if ($purged -gt 0) { Write-Output ("启动前清理残留进程: " + $purged); Start-Sleep -Seconds 4 }

$before = @{}
foreach ($p in Get-Process -Name FBroSubprocess, LingBuilderPreview, LingBuilderFbroHost -ErrorAction SilentlyContinue) { $before[$p.Id] = $true }

$proc = Start-Process -FilePath $exe -WorkingDirectory $BinDir -PassThru `
  -RedirectStandardOutput $outFile -RedirectStandardError $errFile
$procId = $proc.Id
Start-Sleep -Seconds 5

if ($proc.HasExited) {
  Write-Output "FAIL 启动后立即退出，退出码 $($proc.ExitCode)"
  if (Test-Path $outFile) { Get-Content $outFile -Encoding UTF8 | Select-Object -First 20 }
  exit 1
}

function Get-MainWindowInfo([int]$targetPid) {
  $hits = New-Object System.Collections.ArrayList
  $cb = [W.U+EnumProc] {
    param($h, $l)
    $q = 0
    [void][W.U]::GetWindowThreadProcessId($h, [ref]$q)
    if ($q -eq $targetPid -and [W.U]::IsWindowVisible($h)) {
      $sb = New-Object System.Text.StringBuilder 256
      [void][W.U]::GetWindowText($h, $sb, 256)
      $t = $sb.ToString()
      if ($t -and $t -notlike 'GDI+ Window*') { [void]$hits.Add(@($h, $t)) }
    }
    return $true
  }
  [void][W.U]::EnumWindows($cb, [System.IntPtr]::Zero)
  if ($hits.Count -gt 0) { return $hits[0] }
  return $null
}

function Get-ChildTexts([System.IntPtr]$parent) {
  $items = New-Object System.Collections.ArrayList
  $cb = [W.U+EnumProc] {
    param($h, $l)
    $sb = New-Object System.Text.StringBuilder 512
    [void][W.U]::GetWindowText($h, $sb, 512)
    $t = $sb.ToString()
    if ($t) { [void]$items.Add(@($t, $h)) }
    return $true
  }
  [void][W.U]::EnumChildWindows($parent, $cb, [System.IntPtr]::Zero)
  return $items
}

$main = $null
for ($i = 0; $i -lt ($WindowWaitSeconds * 2) -and -not $main; $i++) { $main = Get-MainWindowInfo $procId; if (-not $main) { Start-Sleep -Milliseconds 500 } }
if ($main) { Write-Output ("窗口: " + $main[1] + "  句柄=" + $main[0]) } else { Write-Output "窗口: 未取得" }

$captions = @()
if ($ClickButtons) { $captions = $ClickButtons.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } }

if ($captions.Count -gt 0 -and $main) {
  $mainHandle = [System.IntPtr]$main[0]
  $map = @{}
  foreach ($c in (Get-ChildTexts $mainHandle)) { if (-not $map.ContainsKey($c[0])) { $map[$c[0]] = $c[1] } }
  foreach ($caption in $captions) {
    if ($map.ContainsKey($caption)) {
      [void][W.U]::SendMessage([System.IntPtr]$map[$caption], 0x00F5, [System.IntPtr]::Zero, [System.IntPtr]::Zero)
      Write-Output "点击: $caption"
      Start-Sleep -Milliseconds $ClickDelayMs
    } else {
      Write-Output "点击: $caption  -> 未找到该按钮"
    }
  }
}

Start-Sleep -Seconds $AliveSeconds
$proc.Refresh()
$alive = -not $proc.HasExited
Write-Output ("存活: " + $alive)
Write-Output ("本次 FBro 子进程数: " + @(Get-Process -Name FBroSubprocess, LingBuilderFbroHost -ErrorAction SilentlyContinue | Where-Object { -not $before.ContainsKey($_.Id) }).Count)

if ($main) {
  Write-Output '--- 界面文本 ---'
  foreach ($t in ((Get-ChildTexts ([System.IntPtr]$main[0])) | ForEach-Object { $_[0] } | Select-Object -Unique)) { Write-Output ("  " + $t) }

  # 列表框内容需要用 LB_GETCOUNT / LB_GETTEXT 读取，这是事件与自动化结果的主要证据
  $lists = New-Object System.Collections.ArrayList
  $cbL = [W.U+EnumProc] {
    param($h, $l)
    $cn = New-Object System.Text.StringBuilder 64
    [void][W.U]::GetClassName($h, $cn, 64)
    if ($cn.ToString() -eq 'ListBox') { [void]$lists.Add($h) }
    return $true
  }
  [void][W.U]::EnumChildWindows([System.IntPtr]$main[0], $cbL, [System.IntPtr]::Zero)
  foreach ($lb in $lists) {
    $count = [W.U]::SendMessage($lb, 0x018B, [System.IntPtr]::Zero, [System.IntPtr]::Zero).ToInt32()
    Write-Output ("--- 列表框 " + $lb + " 共 " + $count + " 项 ---")
    for ($k = 0; $k -lt [Math]::Min($count, 25); $k++) {
      $buf = New-Object System.Text.StringBuilder 1024
      [void][W.U]::SendMessageW($lb, 0x0189, $k, $buf)
      Write-Output ("  [" + $k + "] " + $buf.ToString())
    }
  }
}

Write-Output '--- 调试输出 ---'
if (Test-Path $outFile) { Get-Content $outFile -Encoding UTF8 | Select-Object -First 40 }
if ((Test-Path $errFile) -and (Get-Item $errFile).Length -gt 0) {
  Write-Output '--- stderr ---'
  Get-Content $errFile -Encoding UTF8 | Select-Object -First 8
}

Write-Output '--- 产物 ---'
foreach ($d in @('演示页面', '演示表单', '演示输出')) {
  $full = Join-Path $BinDir $d
  if (Test-Path $full) { Get-ChildItem $full | ForEach-Object { Write-Output ("  " + $d + "/" + $_.Name + "  " + $_.Length + " 字节") } }
}

if (-not $proc.HasExited) {
  if ($main) { [void][W.U]::SendMessage([System.IntPtr]$main[0], 0x0010, [System.IntPtr]::Zero, [System.IntPtr]::Zero) }  # WM_CLOSE
  for ($w = 0; $w -lt 30 -and -not $proc.HasExited; $w++) { Start-Sleep -Milliseconds 500; $proc.Refresh() }
  Write-Output ("优雅关闭: " + $proc.HasExited)
  if (-not $proc.HasExited) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2
foreach ($c in @(Get-Process -Name FBroSubprocess, LingBuilderFbroHost -ErrorAction SilentlyContinue | Where-Object { -not $before.ContainsKey($_.Id) })) {
  Stop-Process -Id $c.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1
$leftover = @(Get-Process -Name FBroSubprocess, LingBuilderPreview, LingBuilderFbroHost -ErrorAction SilentlyContinue | Where-Object { -not $before.ContainsKey($_.Id) })
if ($leftover.Count -gt 0) { foreach ($l in $leftover) { Stop-Process -Id $l.Id -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 3 }
Write-Output ("回收后残留: " + @(Get-Process -Name FBroSubprocess, LingBuilderPreview, LingBuilderFbroHost -ErrorAction SilentlyContinue | Where-Object { -not $before.ContainsKey($_.Id) }).Count)
if ($alive -and $main) { Write-Output "RESULT PASS" } else { Write-Output "RESULT FAIL" }
