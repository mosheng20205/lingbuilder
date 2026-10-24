@echo off
rem build_word_bridge.cmd [x86|x64] - builds LingBuilderWord.dll (word-bridge)
setlocal EnableDelayedExpansion
if "%~1"=="" goto :usage
set ARCH=%~1

set VSROOT=C:\Program Files\Microsoft Visual Studio\18\Community
if exist "!VSROOT!\VC\Auxiliary\Build\vcvars64.bat" goto :havevs

set VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe
if exist "!VSWHERE!" goto :runvswhere
set VSWHERE=%ProgramFiles%\Microsoft Visual Studio\Installer\vswhere.exe
if exist "!VSWHERE!" goto :runvswhere
echo Visual Studio C++ toolchain not found
exit /b 2

:runvswhere
"!VSWHERE!" -latest -property installationPath>"%TEMP%\lb_wordbridge_vsroot.txt"
set /p VSROOT=<"%TEMP%\lb_wordbridge_vsroot.txt"
del "%TEMP%\lb_wordbridge_vsroot.txt" >nul 2>&1

:havevs
if "!VSROOT!"=="" echo Visual Studio C++ toolchain not found & exit /b 2
if /i "%ARCH%"=="x64" set VCVARS=!VSROOT!\VC\Auxiliary\Build\vcvars64.bat
if /i not "%ARCH%"=="x64" set VCVARS=!VSROOT!\VC\Auxiliary\Build\vcvarsamd64_x86.bat
if exist "!VCVARS!" goto :havevcvars
echo vcvars script not found: !VCVARS!
exit /b 2

:havevcvars
call "!VCVARS!" >nul
if errorlevel 1 echo failed to call vcvars & exit /b 2

set SRCROOT=%~dp0..
set OUTROOT=%~dp0..\..\..\.lingbuilder-build\word-bridge-build
if not exist "!OUTROOT!" mkdir "!OUTROOT!"
cd /d "%~dp0"
cl /nologo /LD /MT /O2 /EHsc /std:c++17 /utf-8 /W3 /DUNICODE /D_UNICODE /DNOMINMAX /DWIN32_LEAN_AND_MEAN /DLBPDF_WITH_MINIZ /I"!SRCROOT!\common" /I"!SRCROOT!\pdf-writer" /I"!SRCROOT!\archive-zlib" wordBridge.cpp "!SRCROOT!\archive-zlib\miniz.c" /Fe:"!OUTROOT!\LingBuilderWord_!ARCH!.dll" /Fo:"!OUTROOT!\\" /link /DEF:wordBridge.def gdi32.lib user32.lib
if errorlevel 1 exit /b 1
echo build ok: !OUTROOT!\LingBuilderWord_!ARCH!.dll
exit /b 0

:usage
echo usage: build_word_bridge.cmd x64 or build_word_bridge.cmd x86
exit /b 2
