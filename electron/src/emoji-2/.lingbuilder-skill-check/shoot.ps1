param(
  [Parameter(Mandatory=$true)][string]$Exe,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$WaitSeconds = 8
)

# Pure-ASCII script on purpose: a UTF-8 script without BOM gets decoded as GBK by
# Windows PowerShell, and CJK comment bytes can corrupt the surrounding syntax.

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinCap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

[void][WinCap]::SetProcessDPIAware()

$proc = Start-Process -FilePath $Exe -PassThru
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$hwnd = [IntPtr]::Zero
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  $proc.Refresh()
  if ($proc.HasExited) { break }
  if ($proc.MainWindowHandle -ne [IntPtr]::Zero) { $hwnd = $proc.MainWindowHandle; break }
}

if ($proc.HasExited) {
  Write-Output "EXITED code=$($proc.ExitCode)"
  exit 2
}
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output "NO-WINDOW"
  $proc.Kill()
  exit 3
}

[void][WinCap]::ShowWindow($hwnd, 5)
[void][WinCap]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 1500

$rect = New-Object WinCap+RECT
[void][WinCap]::GetWindowRect($hwnd, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Output "HWND=$hwnd SIZE=${w}x${h} AT=$($rect.Left),$($rect.Top) VISIBLE=$([WinCap]::IsWindowVisible($hwnd))"

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
$ok = [WinCap]::PrintWindow($hwnd, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "PRINTWINDOW=$ok SAVED=$Out BYTES=$((Get-Item $Out).Length)"

Start-Sleep -Milliseconds 300
if (-not $proc.HasExited) { $proc.Kill() }
Write-Output "CLOSED"
