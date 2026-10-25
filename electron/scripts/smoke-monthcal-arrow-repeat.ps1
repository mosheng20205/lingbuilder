param(
  [string]$Exe = "T:\electron\lingbuilder\.lingbuilder-build\monthcal-repeat-probe\x64\Release\bin\monthcal-repeat-probe.exe",
  [string]$OutDir = "T:\electron\lingbuilder\.lingbuilder-build\monthcal-repeat-probe\shots",
  [double]$RelX = -1,
  [double]$RelY = -1,
  [double]$ClickDx = -99999,
  [double]$ClickDy = -99999,
  [int]$Clicks = 0,
  [int]$ClickGapMs = 60,
  [int]$SampleCount = 8,
  [int]$SampleGapMs = 250,
  [string]$Mode = "shot",
  [string]$CaptureRegion = "cal",
  [int]$LabelX = 20,
  [int]$LabelY = 330,
  [int]$LabelW = 360,
  [int]$LabelH = 24
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class W32 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hwnd, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hwnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, ref POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@

[void][W32]::SetProcessDPIAware()

$script:found = [IntPtr]::Zero
$script:child = [IntPtr]::Zero

function Get-TopWindowForPid([int]$targetPid) {
  $script:found = [IntPtr]::Zero
  $cb = [W32+EnumProc]{
    param($hwnd, $lParam)
    $procId = 0
    [void][W32]::GetWindowThreadProcessId($hwnd, [ref]$procId)
    if ($procId -eq $targetPid -and [W32]::IsWindowVisible($hwnd)) {
      $sb = New-Object System.Text.StringBuilder 512
      [void][W32]::GetWindowTextW($hwnd, $sb, 512)
      if ($sb.Length -gt 0) { $script:found = $hwnd; return $false }
    }
    return $true
  }
  [void][W32]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Find-ChildByClass([IntPtr]$parent, [string]$className) {
  $script:child = [IntPtr]::Zero
  $cb = [W32+EnumProc]{
    param($hwnd, $lParam)
    $sb = New-Object System.Text.StringBuilder 256
    [void][W32]::GetClassNameW($hwnd, $sb, 256)
    if ($sb.ToString() -eq $className) { $script:child = $hwnd; return $false }
    return $true
  }
  [void][W32]::EnumChildWindows($parent, $cb, [IntPtr]::Zero)
  return $script:child
}

function Save-Shot([int]$left, [int]$top, [int]$width, [int]$height, [string]$filePath) {
  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($left, $top, 0, 0, (New-Object System.Drawing.Size $width, $height))
  $g.Dispose()
  $bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Get-HashShort([string]$filePath) {
  return (Get-FileHash -Algorithm MD5 -Path $filePath).Hash.Substring(0, 12)
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$proc = Start-Process -FilePath $Exe -PassThru
Start-Sleep -Milliseconds 1500
$main = Get-TopWindowForPid $proc.Id
if ($main -eq [IntPtr]::Zero) { Write-Output "ERROR: main window not found"; $proc.Kill(); exit 1 }
[void][W32]::SetForegroundWindow($main)
Start-Sleep -Milliseconds 400
$cal = Find-ChildByClass $main "SysMonthCal32"
if ($cal -eq [IntPtr]::Zero) { Write-Output "ERROR: SysMonthCal32 child not found"; $proc.Kill(); exit 1 }

$dpi = [W32]::GetDpiForWindow($main)
if ($dpi -eq 0) { $dpi = 96 }
$scale = $dpi / 96.0

$calRect = New-Object W32+RECT
[void][W32]::GetWindowRect($cal, [ref]$calRect)
$calW = $calRect.Right - $calRect.Left
$calH = $calRect.Bottom - $calRect.Top
Write-Output ("CAL rect={0},{1},{2},{3} size={4}x{5} dpi={6}" -f $calRect.Left, $calRect.Top, $calRect.Right, $calRect.Bottom, $calW, $calH, $dpi)

# 截取区域：cal=月历整体；label=底部长条（验证事件处理器是否改写了标签文本）
if ($CaptureRegion -eq "label") {
  $origin = New-Object W32+POINT
  $origin.X = 0; $origin.Y = 0
  [void][W32]::ClientToScreen($main, [ref]$origin)
  $capLeft = $origin.X + [int][Math]::Round($LabelX * $scale)
  $capTop = $origin.Y + [int][Math]::Round($LabelY * $scale)
  $capW = [int][Math]::Round($LabelW * $scale)
  $capH = [int][Math]::Round($LabelH * $scale)
} else {
  $capLeft = $calRect.Left; $capTop = $calRect.Top; $capW = $calW; $capH = $calH
}
Write-Output ("CAPTURE region={0} rect={1},{2} size={3}x{4}" -f $CaptureRegion, $capLeft, $capTop, $capW, $capH)

Save-Shot $capLeft $capTop $capW $capH ("{0}\before.png" -f $OutDir)
Write-Output ("BEFORE_HASH=" + (Get-HashShort ("{0}\before.png" -f $OutDir)))

if ($Mode -eq "click") {
  if ($ClickDx -ne -99999 -and $ClickDy -ne -99999) {
    $clickX = $calRect.Left + [int][Math]::Round($ClickDx * $scale)
    $clickY = $calRect.Top + [int][Math]::Round($ClickDy * $scale)
  } else {
    $clickX = $calRect.Left + [int][Math]::Round($calW * $RelX)
    $clickY = $calRect.Top + [int][Math]::Round($calH * $RelY)
  }
  if ($Clicks -eq 0) { $Clicks = 1 }
  for ($i = 1; $i -le $Clicks; $i++) {
    [void][W32]::SetCursorPos($clickX, $clickY)
    Start-Sleep -Milliseconds 12
    [W32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 20
    [W32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds $ClickGapMs
  }
  Write-Output ("CLICKED {0}x at {1},{2}" -f $Clicks, $clickX, $clickY)
  $hashes = @()
  for ($i = 0; $i -le $SampleCount; $i++) {
    $framePath = "{0}\sample-{1:D2}.png" -f $OutDir, $i
    Save-Shot $capLeft $capTop $capW $capH $framePath
    $hash = Get-HashShort $framePath
    $hashes += $hash
    Write-Output ("SAMPLE t={0}ms hash={1}" -f ($i * $SampleGapMs), $hash)
    Start-Sleep -Milliseconds $SampleGapMs
  }
  $distinct = ($hashes | Sort-Object -Unique)
  Write-Output ("DISTINCT_FRAMES_AFTER_RELEASE={0}" -f $distinct.Count)
  Write-Output ("FINAL_VS_BEFORE_CHANGED={0}" -f ($hashes[-1] -ne (Get-HashShort ("{0}\before.png" -f $OutDir))))
}
$proc.Kill()
$proc.WaitForExit()
Write-Output "DONE"
