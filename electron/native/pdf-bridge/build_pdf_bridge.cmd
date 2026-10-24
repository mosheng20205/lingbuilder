@echo off
rem build_pdf_bridge.cmd [x64] - builds LingBuilderPdf.dll (pdf-bridge, dynamically loads pdfium.dll)
setlocal
set ARCH=%~1
if "%ARCH%"=="" set ARCH=x64
set VSROOT=C:\Program Files\Microsoft Visual Studio\18\Community
set HERE=%~dp0
if not exist "!VSROOT!\VC\Auxiliary\Build\vcvars64.bat" goto :nofallback
set VCVARS=%VSROOT%\VC\Auxiliary\Build\vcvars64.bat
goto :havevars
:nofallback
set VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe
"%VSWHERE%" -latest -property installationPath>"%TEMP%\lb_pdfbridge_vsroot.txt"
set /p VSROOT=<"%TEMP%\lb_pdfbridge_vsroot.txt"
set VCVARS=%VSROOT%\VC\Auxiliary\Build\vcvars64.bat
:havevars
call "%VCVARS%" >nul
if errorlevel 1 echo failed to call vcvars & exit /b 2
set SRCROOT=%~dp0..
set OUTROOT=%~dp0..\..\..\.lingbuilder-build\pdf-bridge-build
if not exist "%OUTROOT%" mkdir "%OUTROOT%"
cd /d "%HERE%"
cl /nologo /LD /MT /O2 /EHsc /std:c++17 /utf-8 /W3 /DUNICODE /D_UNICODE /DNOMINMAX /DWIN32_LEAN_AND_MEAN /I"%SRCROOT%\common" /I"%SRCROOT%\word-bridge" /I"%SRCROOT%\archive-zlib" pdfBridge.cpp "%SRCROOT%\archive-zlib\miniz.c" /Fe:"%OUTROOT%\LingBuilderPdf_%ARCH%.dll" /link /DEF:pdfBridge.def ole32.lib oleaut32.lib gdi32.lib user32.lib
if errorlevel 1 exit /b 1
echo build ok: %OUTROOT%\LingBuilderPdf_%ARCH%.dll
exit /b 0
