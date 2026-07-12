[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ExecutablePath,

    [int[]]$ButtonIds = @(1006, 1007, 1011),

    [int[]]$CheckboxIds = @(1008),

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ButtonIds.Count -eq 0) {
    throw 'ButtonIds must contain at least one button control ID.'
}

if ($CheckboxIds.Count -eq 0) {
    throw 'CheckboxIds must contain at least one checkbox control ID.'
}

$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath).Path
$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutputDirectory) | Out-Null

if (-not ('LingBuilder.OwnerDrawButtonSmoke.NativeMethods' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace LingBuilder.OwnerDrawButtonSmoke
{
    public static class NativeMethods
    {
        public const uint INPUT_MOUSE = 0;
        public const uint INPUT_KEYBOARD = 1;
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
        public const uint KEYEVENTF_KEYUP = 0x0002;
        public const ushort VK_TAB = 0x09;
        public const ushort VK_SPACE = 0x20;
        public const uint GA_ROOT = 2;
        public const int GWL_STYLE = -16;
        public const long BS_TYPEMASK = 0x0000000F;
        public const long BS_OWNERDRAW = 0x0000000B;
        public const int SW_RESTORE = 9;
        public const uint WM_CHANGEUISTATE = 0x0127;
        public const uint WM_UPDATEUISTATE = 0x0128;
        public const uint BM_GETCHECK = 0x00F0;
        public const uint BM_SETCHECK = 0x00F1;
        public const int BST_UNCHECKED = 0;
        public const int BST_CHECKED = 1;
        public const uint UIS_SET = 1;
        public const uint UIS_CLEAR = 2;
        public const uint UISF_HIDEFOCUS = 0x1;
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_SHOWWINDOW = 0x0040;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct INPUTUNION
        {
            [FieldOffset(0)]
            public MOUSEINPUT mi;

            [FieldOffset(0)]
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public INPUTUNION data;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr GetDlgItem(IntPtr parent, int controlId);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool IsWindow(IntPtr hwnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool IsWindowVisible(IntPtr hwnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool EnableWindow(IntPtr hwnd, bool enabled);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetCursorPos(out POINT point);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
        private static extern IntPtr GetWindowLongPtr64(IntPtr hwnd, int index);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
        private static extern int GetWindowLong32(IntPtr hwnd, int index);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint inputCount, INPUT[] inputs, int inputSize);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool AttachThreadInput(uint currentThreadId, uint targetThreadId, bool attach);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetFocus(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern IntPtr GetFocus();

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetForegroundWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern IntPtr WindowFromPoint(POINT point);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool BringWindowToTop(IntPtr hwnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool ShowWindow(IntPtr hwnd, int command);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetWindowPos(
            IntPtr hwnd,
            IntPtr insertAfter,
            int x,
            int y,
            int width,
            int height,
            uint flags);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

        [DllImport("dwmapi.dll")]
        private static extern int DwmFlush();

        public static void TryEnablePerMonitorDpi()
        {
            try
            {
                // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
                SetProcessDpiAwarenessContext(new IntPtr(-4));
            }
            catch (EntryPointNotFoundException)
            {
            }
        }

        public static string ReadClassName(IntPtr hwnd)
        {
            var buffer = new StringBuilder(256);
            return GetClassName(hwnd, buffer, buffer.Capacity) > 0 ? buffer.ToString() : string.Empty;
        }

        public static void MoveCursor(int x, int y)
        {
            if (!SetCursorPos(x, y))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SetCursorPos failed");
            }
        }

        public static POINT ReadCursorPosition()
        {
            POINT point;
            if (!GetCursorPos(out point))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "GetCursorPos failed");
            }
            return point;
        }

        public static long ReadWindowStyle(IntPtr hwnd)
        {
            return IntPtr.Size == 8
                ? GetWindowLongPtr64(hwnd, GWL_STYLE).ToInt64()
                : GetWindowLong32(hwnd, GWL_STYLE);
        }

        public static bool IsSafeMouseTarget(IntPtr button, IntPtr root)
        {
            POINT point = ReadCursorPosition();
            IntPtr hit = WindowFromPoint(point);
            return GetForegroundWindow() == root
                && hit == button
                && GetAncestor(hit, GA_ROOT) == root;
        }

        public static void SendMouseButton(uint flag)
        {
            var inputs = new INPUT[1];
            inputs[0].type = INPUT_MOUSE;
            inputs[0].data.mi.dwFlags = flag;
            if (SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT))) != 1)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SendInput failed");
            }
        }

        public static void SendKeyPress(ushort virtualKey)
        {
            var inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].data.ki.wVk = virtualKey;
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].data.ki.wVk = virtualKey;
            inputs[1].data.ki.dwFlags = KEYEVENTF_KEYUP;
            if (SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT))) != 2)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SendInput keyboard failed");
            }
        }

        public static int ReadCheckState(IntPtr hwnd)
        {
            return unchecked((int)SendMessage(hwnd, BM_GETCHECK, UIntPtr.Zero, IntPtr.Zero).ToInt64());
        }

        public static void WriteCheckState(IntPtr hwnd, int state)
        {
            SendMessage(hwnd, BM_SETCHECK, new UIntPtr(unchecked((uint)state)), IntPtr.Zero);
        }

        public static bool FocusAttached(IntPtr hwnd)
        {
            uint processId;
            uint targetThreadId = GetWindowThreadProcessId(hwnd, out processId);
            uint currentThreadId = GetCurrentThreadId();
            bool attached = currentThreadId != targetThreadId
                && AttachThreadInput(currentThreadId, targetThreadId, true);

            try
            {
                IntPtr root = GetAncestor(hwnd, GA_ROOT);
                if (root != IntPtr.Zero)
                {
                    ShowWindow(root, SW_RESTORE);
                    BringWindowToTop(root);
                    SetForegroundWindow(root);
                }
                SetFocus(hwnd);
                return GetFocus() == hwnd;
            }
            finally
            {
                if (attached)
                {
                    AttachThreadInput(currentThreadId, targetThreadId, false);
                }
            }
        }

        public static bool ActivateAttached(IntPtr root)
        {
            uint ignoredProcessId;
            uint currentThreadId = GetCurrentThreadId();
            uint targetThreadId = GetWindowThreadProcessId(root, out ignoredProcessId);
            IntPtr foreground = GetForegroundWindow();
            uint foregroundThreadId = foreground == IntPtr.Zero
                ? 0
                : GetWindowThreadProcessId(foreground, out ignoredProcessId);
            bool attachedTarget = currentThreadId != targetThreadId
                && AttachThreadInput(currentThreadId, targetThreadId, true);
            bool attachedForeground = foregroundThreadId != 0
                && foregroundThreadId != currentThreadId
                && foregroundThreadId != targetThreadId
                && AttachThreadInput(currentThreadId, foregroundThreadId, true);
            try
            {
                ShowWindow(root, SW_RESTORE);
                BringWindowToTop(root);
                SetForegroundWindow(root);
                return GetForegroundWindow() == root;
            }
            finally
            {
                if (attachedForeground)
                {
                    AttachThreadInput(currentThreadId, foregroundThreadId, false);
                }
                if (attachedTarget)
                {
                    AttachThreadInput(currentThreadId, targetThreadId, false);
                }
            }
        }

        public static IntPtr ReadFocusedWindow(IntPtr targetWindow)
        {
            uint processId;
            uint targetThreadId = GetWindowThreadProcessId(targetWindow, out processId);
            uint currentThreadId = GetCurrentThreadId();
            bool attached = currentThreadId != targetThreadId
                && AttachThreadInput(currentThreadId, targetThreadId, true);
            try
            {
                return GetFocus();
            }
            finally
            {
                if (attached)
                {
                    AttachThreadInput(currentThreadId, targetThreadId, false);
                }
            }
        }

        public static void RevealFocusCues(IntPtr root, IntPtr button)
        {
            ulong packedState = ((ulong)UISF_HIDEFOCUS << 16) | UIS_CLEAR;
            UIntPtr state = new UIntPtr(packedState);
            SendMessage(root, WM_CHANGEUISTATE, state, IntPtr.Zero);
            SendMessage(root, WM_UPDATEUISTATE, state, IntPtr.Zero);
            SendMessage(button, WM_UPDATEUISTATE, state, IntPtr.Zero);
        }

        public static void HideFocusCues(IntPtr root, IntPtr button)
        {
            ulong packedState = ((ulong)UISF_HIDEFOCUS << 16) | UIS_SET;
            UIntPtr state = new UIntPtr(packedState);
            SendMessage(root, WM_CHANGEUISTATE, state, IntPtr.Zero);
            SendMessage(root, WM_UPDATEUISTATE, state, IntPtr.Zero);
            SendMessage(button, WM_UPDATEUISTATE, state, IntPtr.Zero);
        }

        public static void FlushDesktopComposition()
        {
            try
            {
                DwmFlush();
            }
            catch (DllNotFoundException)
            {
            }
        }
    }
}
'@
}

[LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::TryEnablePerMonitorDpi()
Add-Type -AssemblyName System.Drawing

$script:SmokeErrors = [System.Collections.Generic.List[string]]::new()
$script:MouseButtonDown = $false
$script:SafePoint = $null
$script:OriginalCursorPosition = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCursorPosition()
$script:StartedProcess = $null
$script:ButtonsToRestore = [System.Collections.Generic.List[System.IntPtr]]::new()
$script:CheckboxesToRestore = [System.Collections.Generic.List[object]]::new()

$thresholds = [ordered]@{
    stateChangedPixelRatioMinimum = 0.10
    stateMeanChannelDeltaMinimum = 1.50
    focusChangedPixelRatioMinimum = 0.002
    stableChangedPixelRatioMaximum = 0.005
    stableMeanChannelDeltaMaximum = 0.20
    checkboxIndicatorChangedPixelRatioMinimum = 0.003
    checkboxIndicatorMeanChannelDeltaMinimum = 0.15
}

function Add-SmokeAssertion {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        $script:SmokeErrors.Add($Message)
    }
}

function Wait-ForUi {
    param([int]$Milliseconds = 240)

    Start-Sleep -Milliseconds $Milliseconds
    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FlushDesktopComposition()
    Start-Sleep -Milliseconds 40
}

function Get-NativeRect {
    param(
        [Parameter(Mandatory = $true)]
        [System.IntPtr]$WindowHandle
    )

    $nativeRect = New-Object LingBuilder.OwnerDrawButtonSmoke.NativeMethods+RECT
    if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetWindowRect($WindowHandle, [ref]$nativeRect)) {
        throw "GetWindowRect failed for handle $WindowHandle."
    }

    [pscustomobject][ordered]@{
        left = $nativeRect.Left
        top = $nativeRect.Top
        right = $nativeRect.Right
        bottom = $nativeRect.Bottom
        width = $nativeRect.Right - $nativeRect.Left
        height = $nativeRect.Bottom - $nativeRect.Top
    }
}

function Get-RectSignature {
    param([Parameter(Mandatory = $true)]$Rect)

    "$($Rect.left),$($Rect.top),$($Rect.right),$($Rect.bottom)"
}

function Save-ScreenRegion {
    param(
        [Parameter(Mandatory = $true)]$Rect,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if ($Rect.width -le 0 -or $Rect.height -le 0) {
        throw "Invalid capture rectangle: $(Get-RectSignature -Rect $Rect)"
    }

    $bitmap = [System.Drawing.Bitmap]::new(
        $Rect.width,
        $Rect.height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen(
            $Rect.left,
            $Rect.top,
            0,
            0,
            $bitmap.Size,
            [System.Drawing.CopyPixelOperation]::SourceCopy)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Get-ImageSummary {
    param([Parameter(Mandatory = $true)][string]$Path)

    $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
    try {
        $counts = [System.Collections.Generic.Dictionary[int, int]]::new()
        $dominantArgb = 0
        $dominantCount = 0
        for ($y = 0; $y -lt $bitmap.Height; $y++) {
            for ($x = 0; $x -lt $bitmap.Width; $x++) {
                $argb = $bitmap.GetPixel($x, $y).ToArgb()
                $count = 0
                if ($counts.TryGetValue($argb, [ref]$count)) {
                    $count++
                    $counts[$argb] = $count
                }
                else {
                    $count = 1
                    $counts.Add($argb, $count)
                }
                if ($count -gt $dominantCount) {
                    $dominantArgb = $argb
                    $dominantCount = $count
                }
            }
        }

        $dominant = [System.Drawing.Color]::FromArgb($dominantArgb)
        [pscustomobject][ordered]@{
            path = [System.IO.Path]::GetFullPath($Path)
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
            width = $bitmap.Width
            height = $bitmap.Height
            dominantColor = ('#{0:X2}{1:X2}{2:X2}' -f $dominant.R, $dominant.G, $dominant.B)
            dominantPixelRatio = [Math]::Round($dominantCount / [double]($bitmap.Width * $bitmap.Height), 6)
        }
    }
    finally {
        $bitmap.Dispose()
    }
}

function Compare-Images {
    param(
        [Parameter(Mandatory = $true)][string]$FirstPath,
        [Parameter(Mandatory = $true)][string]$SecondPath
    )

    $first = [System.Drawing.Bitmap]::FromFile($FirstPath)
    $second = [System.Drawing.Bitmap]::FromFile($SecondPath)
    try {
        if ($first.Width -ne $second.Width -or $first.Height -ne $second.Height) {
            throw "Image dimensions differ: $FirstPath / $SecondPath"
        }

        $changedPixels = 0L
        $channelDeltaTotal = 0L
        $pixelCount = [long]($first.Width * $first.Height)
        $minimumChangedX = $first.Width
        $minimumChangedY = $first.Height
        $maximumChangedX = -1
        $maximumChangedY = -1
        for ($y = 0; $y -lt $first.Height; $y++) {
            for ($x = 0; $x -lt $first.Width; $x++) {
                $firstColor = $first.GetPixel($x, $y)
                $secondColor = $second.GetPixel($x, $y)
                if ($firstColor.ToArgb() -ne $secondColor.ToArgb()) {
                    $changedPixels++
                    $minimumChangedX = [Math]::Min($minimumChangedX, $x)
                    $minimumChangedY = [Math]::Min($minimumChangedY, $y)
                    $maximumChangedX = [Math]::Max($maximumChangedX, $x)
                    $maximumChangedY = [Math]::Max($maximumChangedY, $y)
                }
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.R - [int]$secondColor.R)
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.G - [int]$secondColor.G)
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.B - [int]$secondColor.B)
            }
        }

        $changedBoundingBox = $null
        if ($changedPixels -gt 0) {
            $changedBoundingBox = [ordered]@{
                left = $minimumChangedX
                top = $minimumChangedY
                right = $maximumChangedX
                bottom = $maximumChangedY
                width = $maximumChangedX - $minimumChangedX + 1
                height = $maximumChangedY - $minimumChangedY + 1
            }
        }

        [pscustomobject][ordered]@{
            changedPixels = $changedPixels
            pixelCount = $pixelCount
            changedPixelRatio = [Math]::Round($changedPixels / [double]$pixelCount, 6)
            meanChannelDelta = [Math]::Round($channelDeltaTotal / [double]($pixelCount * 3), 6)
            rightmostChangedX = $maximumChangedX
            changedBoundingBox = $changedBoundingBox
        }
    }
    finally {
        $first.Dispose()
        $second.Dispose()
    }
}

function Compare-CheckboxIndicatorImages {
    param(
        [Parameter(Mandatory = $true)][string]$FirstPath,
        [Parameter(Mandatory = $true)][string]$SecondPath
    )

    $first = [System.Drawing.Bitmap]::FromFile($FirstPath)
    $second = [System.Drawing.Bitmap]::FromFile($SecondPath)
    try {
        if ($first.Width -ne $second.Width -or $first.Height -ne $second.Height) {
            throw "Image dimensions differ: $FirstPath / $SecondPath"
        }

        # Owner-draw checkboxes render the square indicator at the left edge. Restricting
        # this comparison to that area proves the visual check mark changed, instead of
        # accepting an unrelated label or focus-ring change elsewhere in the control.
        $indicatorWidth = [Math]::Min($first.Width, [Math]::Max(16, $first.Height + 8))
        $changedPixels = 0L
        $channelDeltaTotal = 0L
        $pixelCount = [long]($indicatorWidth * $first.Height)
        for ($y = 0; $y -lt $first.Height; $y++) {
            for ($x = 0; $x -lt $indicatorWidth; $x++) {
                $firstColor = $first.GetPixel($x, $y)
                $secondColor = $second.GetPixel($x, $y)
                if ($firstColor.ToArgb() -ne $secondColor.ToArgb()) {
                    $changedPixels++
                }
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.R - [int]$secondColor.R)
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.G - [int]$secondColor.G)
                $channelDeltaTotal += [Math]::Abs([int]$firstColor.B - [int]$secondColor.B)
            }
        }

        [pscustomobject][ordered]@{
            region = [ordered]@{
                left = 0
                top = 0
                width = $indicatorWidth
                height = $first.Height
            }
            changedPixels = $changedPixels
            pixelCount = $pixelCount
            changedPixelRatio = [Math]::Round($changedPixels / [double]$pixelCount, 6)
            meanChannelDelta = [Math]::Round($channelDeltaTotal / [double]($pixelCount * 3), 6)
        }
    }
    finally {
        $first.Dispose()
        $second.Dispose()
    }
}

function Capture-ButtonState {
    param(
        [Parameter(Mandatory = $true)][int]$ButtonId,
        [Parameter(Mandatory = $true)][System.IntPtr]$ButtonHandle,
        [Parameter(Mandatory = $true)][string]$StateName
    )

    $rect = Get-NativeRect -WindowHandle $ButtonHandle
    $path = Join-Path $resolvedOutputDirectory "button-$ButtonId-$StateName.png"
    Save-ScreenRegion -Rect $rect -Path $path
    [pscustomobject][ordered]@{
        rect = $rect
        image = Get-ImageSummary -Path $path
    }
}

function Capture-CheckboxState {
    param(
        [Parameter(Mandatory = $true)][int]$CheckboxId,
        [Parameter(Mandatory = $true)][System.IntPtr]$CheckboxHandle,
        [Parameter(Mandatory = $true)][string]$StateName
    )

    $rect = Get-NativeRect -WindowHandle $CheckboxHandle
    $path = Join-Path $resolvedOutputDirectory "checkbox-$CheckboxId-$StateName.png"
    Save-ScreenRegion -Rect $rect -Path $path
    [pscustomobject][ordered]@{
        rect = $rect
        image = Get-ImageSummary -Path $path
        checkState = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($CheckboxHandle)
    }
}

function Invoke-SafeCheckboxClick {
    param(
        [Parameter(Mandatory = $true)][int]$CheckboxId,
        [Parameter(Mandatory = $true)][System.IntPtr]$CheckboxHandle,
        [Parameter(Mandatory = $true)][System.IntPtr]$MainWindow,
        [Parameter(Mandatory = $true)]$Rect
    )

    Move-CursorToRectCenter -Rect $Rect
    Wait-ForUi -Milliseconds 120
    if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsSafeMouseTarget($CheckboxHandle, $MainWindow)) {
        throw "Refusing LEFTDOWN because the foreground hit target is not checkbox $CheckboxId."
    }
    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendMouseButton(
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MOUSEEVENTF_LEFTDOWN)
    $script:MouseButtonDown = $true
    Wait-ForUi -Milliseconds 100
    if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsSafeMouseTarget($CheckboxHandle, $MainWindow)) {
        throw "Refusing LEFTUP because the foreground hit target is not checkbox $CheckboxId."
    }
    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendMouseButton(
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MOUSEEVENTF_LEFTUP)
    $script:MouseButtonDown = $false
    Wait-ForUi -Milliseconds 180
}

function Move-CursorToRectCenter {
    param([Parameter(Mandatory = $true)]$Rect)

    $x = [int][Math]::Floor(($Rect.left + $Rect.right) / 2.0)
    $y = [int][Math]::Floor(($Rect.top + $Rect.bottom) / 2.0)
    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($x, $y)
}

$metrics = [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString('o')
    executablePath = $resolvedExecutable
    outputDirectory = $resolvedOutputDirectory
    processId = $null
    mainWindowHandle = $null
    mainWindowRect = $null
    thresholds = $thresholds
    buttons = @()
    checkboxes = @()
    passed = $false
    errors = @()
}

try {
    $script:StartedProcess = Start-Process -FilePath $resolvedExecutable -PassThru
    $metrics.processId = $script:StartedProcess.Id

    try {
        $script:StartedProcess.WaitForInputIdle(15000) | Out-Null
    }
    catch {
        # MainWindowHandle polling below is authoritative for this smoke test.
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    $mainWindow = [System.IntPtr]::Zero
    while ([DateTime]::UtcNow -lt $deadline) {
        $script:StartedProcess.Refresh()
        $mainWindow = [System.IntPtr]$script:StartedProcess.MainWindowHandle
        if (($mainWindow -ne [System.IntPtr]::Zero) -and
            ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindow($mainWindow)) -and
            ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindowVisible($mainWindow))) {
            break
        }
        Start-Sleep -Milliseconds 100
    }

    if ($mainWindow -eq [System.IntPtr]::Zero) {
        throw 'No visible main window appeared within 15 seconds of launching the EXE.'
    }

    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ShowWindow(
        $mainWindow,
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SW_RESTORE) | Out-Null
    $showFlags = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SWP_NOSIZE -bor
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SWP_SHOWWINDOW
    $positioned = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SetWindowPos(
        $mainWindow,
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HWND_TOPMOST,
        32,
        32,
        0,
        0,
        $showFlags)
    if (-not $positioned) {
        throw 'Failed to position the smoke-test window before real input.'
    }
    [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ActivateAttached($mainWindow) | Out-Null
    $foregroundDeadline = [DateTime]::UtcNow.AddSeconds(3)
    do {
        Wait-ForUi -Milliseconds 120
        if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -eq $mainWindow) {
            break
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ActivateAttached($mainWindow) | Out-Null
    } while ([DateTime]::UtcNow -lt $foregroundDeadline)
    if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -ne $mainWindow) {
        throw 'The smoke-test window did not become foreground; real input was not sent.'
    }

    $mainRect = Get-NativeRect -WindowHandle $mainWindow
    $metrics.mainWindowHandle = $mainWindow.ToInt64()
    $metrics.mainWindowRect = $mainRect
    $script:SafePoint = [pscustomobject]@{
        x = [Math]::Max($mainRect.left + 8, $mainRect.right - 18)
        y = [Math]::Max($mainRect.top + 8, $mainRect.bottom - 18)
    }

    foreach ($buttonId in $ButtonIds) {
        $button = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetDlgItem($mainWindow, $buttonId)
        if ($button -eq [System.IntPtr]::Zero) {
            throw "Control ID $buttonId was not found under the main window."
        }
        if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindowVisible($button)) {
            throw "Control ID $buttonId is not visible and cannot be screen-tested."
        }

        $className = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadClassName($button)
        if ($className -ne 'Button') {
            throw "Control ID $buttonId uses window class '$className' instead of 'Button'."
        }
        $windowStyle = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadWindowStyle($button)
        $buttonType = $windowStyle -band [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BS_TYPEMASK
        if ($buttonType -ne [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BS_OWNERDRAW) {
            throw ('Control ID {0} is not BS_OWNERDRAW: style=0x{1:X}, type=0x{2:X}.' -f
                $buttonId, $windowStyle, $buttonType)
        }
        $script:ButtonsToRestore.Add($button)

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::EnableWindow($button, $true) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $button)
        Wait-ForUi

        $states = [ordered]@{}
        $states.normal = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'normal'
        $normalSignature = Get-RectSignature -Rect $states.normal.rect

        Move-CursorToRectCenter -Rect $states.normal.rect
        Wait-ForUi
        $states.hover = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'hover'

        if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsSafeMouseTarget($button, $mainWindow)) {
            throw "Refusing LEFTDOWN because the foreground hit target is not button $buttonId."
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendMouseButton(
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MOUSEEVENTF_LEFTDOWN)
        $script:MouseButtonDown = $true
        Wait-ForUi -Milliseconds 160
        $states.pressed = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'pressed'

        # Avoid BN_CLICKED: leave the button while held, then release outside it.
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        Wait-ForUi -Milliseconds 120
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendMouseButton(
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MOUSEEVENTF_LEFTUP)
        $script:MouseButtonDown = $false
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        Wait-ForUi
        $states.recovered = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'normal-recovered'

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::RevealFocusCues($mainWindow, $button)
        $focused = $false
        $tabSteps = 0
        for ($step = 1; $step -le 24; $step++) {
            if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -ne $mainWindow) {
                throw "Refusing Tab input because the smoke-test window lost foreground while testing button $buttonId."
            }
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendKeyPress(
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::VK_TAB)
            Wait-ForUi -Milliseconds 80
            $focusedWindow = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadFocusedWindow($mainWindow)
            if ($focusedWindow -eq $button) {
                $focused = $true
                $tabSteps = $step
                break
            }
        }
        Add-SmokeAssertion -Condition $focused -Message "Button $buttonId was not reachable through real Tab navigation."
        if (-not $focused) {
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($button) | Out-Null
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::RevealFocusCues($mainWindow, $button)
        Wait-ForUi
        $states.focus = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'focus'

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $button)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        Wait-ForUi
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::EnableWindow($button, $false) | Out-Null
        Wait-ForUi
        $states.disabled = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'disabled'

        Move-CursorToRectCenter -Rect $states.disabled.rect
        Wait-ForUi
        $states.disabledHover = Capture-ButtonState -ButtonId $buttonId -ButtonHandle $button -StateName 'disabled-hover'

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::EnableWindow($button, $true) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        Wait-ForUi

        foreach ($stateName in @('hover', 'pressed', 'recovered', 'focus', 'disabled', 'disabledHover')) {
            $stateSignature = Get-RectSignature -Rect $states[$stateName].rect
            Add-SmokeAssertion -Condition ($stateSignature -eq $normalSignature) -Message (
                "Button $buttonId changed its window rectangle in state ${stateName}: $normalSignature -> $stateSignature")
        }

        $comparisons = [ordered]@{
            normalToHover = Compare-Images -FirstPath $states.normal.image.path -SecondPath $states.hover.image.path
            normalToPressed = Compare-Images -FirstPath $states.normal.image.path -SecondPath $states.pressed.image.path
            hoverToPressed = Compare-Images -FirstPath $states.hover.image.path -SecondPath $states.pressed.image.path
            normalToRecovered = Compare-Images -FirstPath $states.normal.image.path -SecondPath $states.recovered.image.path
            normalToFocus = Compare-Images -FirstPath $states.normal.image.path -SecondPath $states.focus.image.path
            normalToDisabled = Compare-Images -FirstPath $states.normal.image.path -SecondPath $states.disabled.image.path
            disabledToDisabledHover = Compare-Images -FirstPath $states.disabled.image.path -SecondPath $states.disabledHover.image.path
        }

        foreach ($comparisonName in @('normalToHover', 'normalToPressed', 'hoverToPressed', 'normalToDisabled')) {
            $comparison = $comparisons[$comparisonName]
            $stateChanged =
                ($comparison.changedPixelRatio -ge $thresholds.stateChangedPixelRatioMinimum) -and
                ($comparison.meanChannelDelta -ge $thresholds.stateMeanChannelDeltaMinimum)
            Add-SmokeAssertion -Condition $stateChanged -Message (
                "Button $buttonId has insufficient color change for ${comparisonName}: changedPixelRatio=$($comparison.changedPixelRatio), meanChannelDelta=$($comparison.meanChannelDelta).")
        }

        Add-SmokeAssertion -Condition (
            $comparisons.normalToFocus.changedPixelRatio -ge $thresholds.focusChangedPixelRatioMinimum
        ) -Message (
            "Button $buttonId has no recognizable focus-ring difference: changedPixelRatio=$($comparisons.normalToFocus.changedPixelRatio).")

        $recoveredIsStable =
            ($comparisons.normalToRecovered.changedPixelRatio -le $thresholds.stableChangedPixelRatioMaximum) -and
            ($comparisons.normalToRecovered.meanChannelDelta -le $thresholds.stableMeanChannelDeltaMaximum)
        Add-SmokeAssertion -Condition $recoveredIsStable -Message (
            "Button $buttonId did not return to normal after leave/release: changedPixelRatio=$($comparisons.normalToRecovered.changedPixelRatio), meanChannelDelta=$($comparisons.normalToRecovered.meanChannelDelta).")

        $disabledHoverIsStable =
            ($comparisons.disabledToDisabledHover.changedPixelRatio -le $thresholds.stableChangedPixelRatioMaximum) -and
            ($comparisons.disabledToDisabledHover.meanChannelDelta -le $thresholds.stableMeanChannelDeltaMaximum)
        Add-SmokeAssertion -Condition $disabledHoverIsStable -Message (
            "Button $buttonId still reacts to hover while disabled: changedPixelRatio=$($comparisons.disabledToDisabledHover.changedPixelRatio), meanChannelDelta=$($comparisons.disabledToDisabledHover.meanChannelDelta).")

        $metrics.buttons += [ordered]@{
            id = $buttonId
            handle = $button.ToInt64()
            className = $className
            windowStyle = ('0x{0:X}' -f $windowStyle)
            buttonType = ('0x{0:X}' -f $buttonType)
            focusVerified = $focused
            tabSteps = $tabSteps
            rectSignature = $normalSignature
            states = $states
            comparisons = $comparisons
        }
    }

    foreach ($checkboxId in $CheckboxIds) {
        $checkbox = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetDlgItem($mainWindow, $checkboxId)
        if ($checkbox -eq [System.IntPtr]::Zero) {
            throw "Checkbox control ID $checkboxId was not found under the main window."
        }
        if (-not [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindowVisible($checkbox)) {
            throw "Checkbox control ID $checkboxId is not visible and cannot be screen-tested."
        }

        $className = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadClassName($checkbox)
        if ($className -ne 'Button') {
            throw "Checkbox control ID $checkboxId uses window class '$className' instead of 'Button'."
        }
        $windowStyle = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadWindowStyle($checkbox)
        $buttonType = $windowStyle -band [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BS_TYPEMASK
        if ($buttonType -ne [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BS_OWNERDRAW) {
            throw ('Checkbox control ID {0} is not BS_OWNERDRAW: style=0x{1:X}, type=0x{2:X}.' -f
                $checkboxId, $windowStyle, $buttonType)
        }

        $originalCheckState = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        $script:CheckboxesToRestore.Add([pscustomobject]@{
            handle = $checkbox
            checkState = $originalCheckState
        })
        $script:ButtonsToRestore.Add($checkbox)

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::EnableWindow($checkbox, $true) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::WriteCheckState(
            $checkbox,
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_UNCHECKED)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $checkbox)
        Wait-ForUi

        $programmaticUncheckedState = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        Add-SmokeAssertion -Condition (
            $programmaticUncheckedState -eq [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_UNCHECKED
        ) -Message (
            "Checkbox $checkboxId did not accept BM_SETCHECK(BST_UNCHECKED); BM_GETCHECK returned $programmaticUncheckedState.")

        $states = [ordered]@{}
        $states.mouseUnchecked = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'mouse-unchecked'
        $normalSignature = Get-RectSignature -Rect $states.mouseUnchecked.rect

        Invoke-SafeCheckboxClick `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -MainWindow $mainWindow `
            -Rect $states.mouseUnchecked.rect
        $afterFirstMouseClick = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        Add-SmokeAssertion -Condition (
            $afterFirstMouseClick -eq [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_CHECKED
        ) -Message (
            "Checkbox $checkboxId did not become checked after a real mouse click; BM_GETCHECK returned $afterFirstMouseClick.")

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $checkbox)
        Wait-ForUi
        $states.mouseChecked = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'mouse-checked'

        Invoke-SafeCheckboxClick `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -MainWindow $mainWindow `
            -Rect $states.mouseChecked.rect
        $afterSecondMouseClick = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        Add-SmokeAssertion -Condition (
            $afterSecondMouseClick -eq [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_UNCHECKED
        ) -Message (
            "Checkbox $checkboxId did not return to unchecked after the second real mouse click; BM_GETCHECK returned $afterSecondMouseClick.")

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $checkbox)
        Wait-ForUi
        $states.mouseUncheckedRecovered = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'mouse-unchecked-recovered'

        # Exercise the keyboard path through the same navigation a user uses: real Tab
        # traversal to the checkbox, followed by real Space key presses.
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::WriteCheckState(
            $checkbox,
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_UNCHECKED)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::RevealFocusCues($mainWindow, $checkbox)
        Wait-ForUi

        $focused = $false
        $tabSteps = 0
        for ($step = 1; $step -le 48; $step++) {
            if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -ne $mainWindow) {
                throw "Refusing Tab input because the smoke-test window lost foreground while testing checkbox $checkboxId."
            }
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendKeyPress(
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::VK_TAB)
            Wait-ForUi -Milliseconds 80
            $focusedWindow = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadFocusedWindow($mainWindow)
            if ($focusedWindow -eq $checkbox) {
                $focused = $true
                $tabSteps = $step
                break
            }
        }
        Add-SmokeAssertion -Condition $focused -Message (
            "Checkbox $checkboxId was not reachable through real Tab navigation.")
        if (-not $focused) {
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($checkbox) | Out-Null
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::RevealFocusCues($mainWindow, $checkbox)
        Wait-ForUi
        $states.keyboardUncheckedFocused = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'keyboard-unchecked-focused'

        if (([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -ne $mainWindow) -or
            ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadFocusedWindow($mainWindow) -ne $checkbox)) {
            throw "Refusing Space input because checkbox $checkboxId is not focused in the foreground window."
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendKeyPress(
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::VK_SPACE)
        Wait-ForUi -Milliseconds 180
        $afterFirstSpace = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        Add-SmokeAssertion -Condition (
            $afterFirstSpace -eq [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_CHECKED
        ) -Message (
            "Checkbox $checkboxId did not become checked after real Tab + Space input; BM_GETCHECK returned $afterFirstSpace.")
        $states.keyboardCheckedFocused = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'keyboard-checked-focused'

        if (([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::GetForegroundWindow() -ne $mainWindow) -or
            ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadFocusedWindow($mainWindow) -ne $checkbox)) {
            throw "Refusing the second Space input because checkbox $checkboxId lost foreground focus."
        }
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendKeyPress(
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::VK_SPACE)
        Wait-ForUi -Milliseconds 180
        $afterSecondSpace = [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::ReadCheckState($checkbox)
        Add-SmokeAssertion -Condition (
            $afterSecondSpace -eq [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::BST_UNCHECKED
        ) -Message (
            "Checkbox $checkboxId did not return to unchecked after the second Space input; BM_GETCHECK returned $afterSecondSpace.")
        $states.keyboardUncheckedRecovered = Capture-CheckboxState `
            -CheckboxId $checkboxId `
            -CheckboxHandle $checkbox `
            -StateName 'keyboard-unchecked-recovered'

        foreach ($stateName in @(
            'mouseChecked',
            'mouseUncheckedRecovered',
            'keyboardUncheckedFocused',
            'keyboardCheckedFocused',
            'keyboardUncheckedRecovered')) {
            $stateSignature = Get-RectSignature -Rect $states[$stateName].rect
            Add-SmokeAssertion -Condition ($stateSignature -eq $normalSignature) -Message (
                "Checkbox $checkboxId changed its window rectangle in state ${stateName}: $normalSignature -> $stateSignature")
        }

        $comparisons = [ordered]@{
            mouseUncheckedToChecked = Compare-Images `
                -FirstPath $states.mouseUnchecked.image.path `
                -SecondPath $states.mouseChecked.image.path
            mouseIndicatorUncheckedToChecked = Compare-CheckboxIndicatorImages `
                -FirstPath $states.mouseUnchecked.image.path `
                -SecondPath $states.mouseChecked.image.path
            mouseUncheckedToRecovered = Compare-Images `
                -FirstPath $states.mouseUnchecked.image.path `
                -SecondPath $states.mouseUncheckedRecovered.image.path
            unfocusedUncheckedToFocusedUnchecked = Compare-Images `
                -FirstPath $states.mouseUnchecked.image.path `
                -SecondPath $states.keyboardUncheckedFocused.image.path
            keyboardUncheckedToChecked = Compare-Images `
                -FirstPath $states.keyboardUncheckedFocused.image.path `
                -SecondPath $states.keyboardCheckedFocused.image.path
            keyboardIndicatorUncheckedToChecked = Compare-CheckboxIndicatorImages `
                -FirstPath $states.keyboardUncheckedFocused.image.path `
                -SecondPath $states.keyboardCheckedFocused.image.path
            keyboardUncheckedToRecovered = Compare-Images `
                -FirstPath $states.keyboardUncheckedFocused.image.path `
                -SecondPath $states.keyboardUncheckedRecovered.image.path
        }

        $leftIndicatorLimitExclusive = [Math]::Max(
            1,
            [Math]::Min(48, [int][Math]::Floor($states.mouseUnchecked.rect.width * 0.25)))
        foreach ($comparisonName in @(
            'mouseUncheckedToChecked',
            'unfocusedUncheckedToFocusedUnchecked',
            'keyboardUncheckedToChecked')) {
            $comparison = $comparisons[$comparisonName]
            $changeStayedInsideIndicator =
                ($comparison.changedPixels -gt 0) -and
                ($comparison.rightmostChangedX -ge 0) -and
                ($comparison.rightmostChangedX -lt $leftIndicatorLimitExclusive)
            Add-SmokeAssertion -Condition $changeStayedInsideIndicator -Message (
                "Checkbox $checkboxId leaked check/focus drawing into its label or row for ${comparisonName}: rightmostChangedX=$($comparison.rightmostChangedX), allowedX<${leftIndicatorLimitExclusive}, bbox=$($comparison.changedBoundingBox | ConvertTo-Json -Compress).")
        }

        foreach ($comparisonName in @(
            'mouseIndicatorUncheckedToChecked',
            'keyboardIndicatorUncheckedToChecked')) {
            $comparison = $comparisons[$comparisonName]
            $checkMarkVisible =
                ($comparison.changedPixelRatio -ge $thresholds.checkboxIndicatorChangedPixelRatioMinimum) -and
                ($comparison.meanChannelDelta -ge $thresholds.checkboxIndicatorMeanChannelDeltaMinimum)
            Add-SmokeAssertion -Condition $checkMarkVisible -Message (
                "Checkbox $checkboxId has no recognizable check-mark pixel change for ${comparisonName}: changedPixelRatio=$($comparison.changedPixelRatio), meanChannelDelta=$($comparison.meanChannelDelta).")
        }

        foreach ($comparisonName in @('mouseUncheckedToRecovered', 'keyboardUncheckedToRecovered')) {
            $comparison = $comparisons[$comparisonName]
            $uncheckedRecovered =
                ($comparison.changedPixelRatio -le $thresholds.stableChangedPixelRatioMaximum) -and
                ($comparison.meanChannelDelta -le $thresholds.stableMeanChannelDeltaMaximum)
            Add-SmokeAssertion -Condition $uncheckedRecovered -Message (
                "Checkbox $checkboxId did not visually recover after toggling for ${comparisonName}: changedPixelRatio=$($comparison.changedPixelRatio), meanChannelDelta=$($comparison.meanChannelDelta).")
        }

        $metrics.checkboxes += [ordered]@{
            id = $checkboxId
            handle = $checkbox.ToInt64()
            className = $className
            windowStyle = ('0x{0:X}' -f $windowStyle)
            buttonType = ('0x{0:X}' -f $buttonType)
            originalCheckState = $originalCheckState
            programmaticUncheckedState = $programmaticUncheckedState
            mouseStates = [ordered]@{
                afterFirstClick = $afterFirstMouseClick
                afterSecondClick = $afterSecondMouseClick
            }
            keyboardStates = [ordered]@{
                focusVerified = $focused
                tabSteps = $tabSteps
                afterFirstSpace = $afterFirstSpace
                afterSecondSpace = $afterSecondSpace
            }
            rectSignature = $normalSignature
            indicatorRegionRightExclusive = $leftIndicatorLimitExclusive
            states = $states
            comparisons = $comparisons
        }

        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::FocusAttached($mainWindow) | Out-Null
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::HideFocusCues($mainWindow, $checkbox)
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
        Wait-ForUi
    }

    $metrics.passed = $script:SmokeErrors.Count -eq 0
    $metrics.errors = @($script:SmokeErrors)
}
catch {
    $script:SmokeErrors.Add($_.Exception.Message)
    $metrics.passed = $false
    $metrics.errors = @($script:SmokeErrors)
}
finally {
    if ($script:MouseButtonDown) {
        try {
            if ($null -ne $script:SafePoint) {
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor($script:SafePoint.x, $script:SafePoint.y)
            }
            [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::SendMouseButton(
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MOUSEEVENTF_LEFTUP)
        }
        catch {
        }
        $script:MouseButtonDown = $false
    }

    foreach ($checkboxRestore in $script:CheckboxesToRestore) {
        try {
            if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindow($checkboxRestore.handle)) {
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::WriteCheckState(
                    $checkboxRestore.handle,
                    $checkboxRestore.checkState)
            }
        }
        catch {
        }
    }

    foreach ($button in $script:ButtonsToRestore) {
        try {
            if ([LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::IsWindow($button)) {
                [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::EnableWindow($button, $true) | Out-Null
            }
        }
        catch {
        }
    }

    try {
        [LingBuilder.OwnerDrawButtonSmoke.NativeMethods]::MoveCursor(
            $script:OriginalCursorPosition.X,
            $script:OriginalCursorPosition.Y)
    }
    catch {
    }

    if ($null -ne $script:StartedProcess) {
        try {
            if (-not $script:StartedProcess.HasExited) {
                Stop-Process -Id $script:StartedProcess.Id -Force
                $script:StartedProcess.WaitForExit(3000) | Out-Null
            }
        }
        catch {
        }
    }

    $metrics.generatedAt = [DateTimeOffset]::Now.ToString('o')
    $metrics.errors = @($script:SmokeErrors)
    $metrics.passed = $script:SmokeErrors.Count -eq 0
    $metricsPath = Join-Path $resolvedOutputDirectory 'metrics.json'
    $metrics | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $metricsPath -Encoding utf8
}

if (-not $metrics.passed) {
    throw ("Owner-draw button visual smoke failed:`n - " + ($metrics.errors -join "`n - "))
}

Write-Host "Owner-draw button visual smoke passed."
Write-Host "Metrics: $(Join-Path $resolvedOutputDirectory 'metrics.json')"
foreach ($buttonMetric in $metrics.buttons) {
    Write-Host (
        "Button {0}: normal={1}, hover={2}, pressed={3}, focusRatio={4}, disabledHoverRatio={5}" -f
        $buttonMetric.id,
        $buttonMetric.states.normal.image.dominantColor,
        $buttonMetric.states.hover.image.dominantColor,
        $buttonMetric.states.pressed.image.dominantColor,
        $buttonMetric.comparisons.normalToFocus.changedPixelRatio,
        $buttonMetric.comparisons.disabledToDisabledHover.changedPixelRatio)
}
foreach ($checkboxMetric in $metrics.checkboxes) {
    Write-Host (
        "Checkbox {0}: mouse={1}->{2}, keyboard={3}->{4}, mouseCheckPixels={5}, keyboardCheckPixels={6}, checkBBox={7}, focusBBox={8}, allowedX<{9}" -f
        $checkboxMetric.id,
        $checkboxMetric.mouseStates.afterFirstClick,
        $checkboxMetric.mouseStates.afterSecondClick,
        $checkboxMetric.keyboardStates.afterFirstSpace,
        $checkboxMetric.keyboardStates.afterSecondSpace,
        $checkboxMetric.comparisons.mouseIndicatorUncheckedToChecked.changedPixelRatio,
        $checkboxMetric.comparisons.keyboardIndicatorUncheckedToChecked.changedPixelRatio,
        ($checkboxMetric.comparisons.mouseUncheckedToChecked.changedBoundingBox | ConvertTo-Json -Compress),
        ($checkboxMetric.comparisons.unfocusedUncheckedToFocusedUnchecked.changedBoundingBox | ConvertTo-Json -Compress),
        $checkboxMetric.indicatorRegionRightExclusive)
}
