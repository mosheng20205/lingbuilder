param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'assets\module-demo-lingbuilder.opencv'
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null
$outputName = 'OpenCV' + [char]0x7F3A + [char]0x53E3 + [char]0x80CC + [char]0x666F + '.png'
$outputPath = Join-Path $outputRoot $outputName

function New-PuzzlePath {
  param([int]$X, [int]$Y)

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddRectangle([System.Drawing.Rectangle]::new($X, $Y + 22, 84, 88))
  $path.AddEllipse($X + 22, $Y, 40, 44)
  $path.AddEllipse($X + 68, $Y + 44, 32, 32)
  return $path
}

$bitmap = [System.Drawing.Bitmap]::new(512, 320, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$canvasBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0B1220'))
$panelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#E8EEF0'))
$pieceBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F97362'))
$gapBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#111827'))
$accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0F766E'))
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F8FAFC'))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#334155'))
$panelPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#94A3B8'), 2)
$arrowPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#0F766E'), 6)
$arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$titleFont = [System.Drawing.Font]::new('Segoe UI', 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$captionFont = [System.Drawing.Font]::new('Segoe UI', 13, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

try {
  $graphics.FillRectangle($canvasBrush, 0, 0, 512, 320)
  $graphics.DrawString('OPENCV GAP DETECTION FIXTURE', $titleFont, $labelBrush, 28, 20)
  $graphics.FillRectangle($panelBrush, 28, 62, 456, 214)
  $graphics.DrawRectangle($panelPen, 28, 62, 455, 213)

  $piecePath = New-PuzzlePath -X 82 -Y 108
  $gapPath = New-PuzzlePath -X 330 -Y 108
  try {
    $graphics.FillPath($pieceBrush, $piecePath)
    $graphics.FillEllipse($panelBrush, 66, 152, 32, 32)
    $graphics.FillEllipse($panelBrush, 104, 196, 40, 36)

    $graphics.FillPath($gapBrush, $gapPath)
    $graphics.FillEllipse($panelBrush, 314, 152, 32, 32)
    $graphics.FillEllipse($panelBrush, 352, 196, 40, 36)
  } finally {
    $piecePath.Dispose()
    $gapPath.Dispose()
  }

  $graphics.DrawLine($arrowPen, 205, 162, 286, 162)
  $graphics.DrawString('PIECE', $captionFont, $mutedBrush, 94, 244)
  $graphics.DrawString('VISIBLE GAP', $captionFont, $accentBrush, 334, 244)

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $titleFont.Dispose()
  $captionFont.Dispose()
  $arrowPen.Dispose()
  $panelPen.Dispose()
  $mutedBrush.Dispose()
  $labelBrush.Dispose()
  $accentBrush.Dispose()
  $gapBrush.Dispose()
  $pieceBrush.Dispose()
  $panelBrush.Dispose()
  $canvasBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output $outputPath
