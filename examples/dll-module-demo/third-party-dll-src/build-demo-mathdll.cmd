@echo off
rem Build demo_mathdll.dll (x64 + Win32) into a module output directory.
rem Usage: build-demo-mathdll.cmd <module-out-dir>
rem Visual Studio location can be overridden with the VCVARS environment variable.
setlocal
if "%~1"=="" (
    echo usage: build-demo-mathdll.cmd ^<module-out-dir^>
    exit /b 1
)
if not defined VCVARS set "VCVARS=C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
if not exist "%VCVARS%" (
    echo vcvarsall.bat not found: %VCVARS%
    exit /b 1
)
set "OUTDIR=%~f1"
set "SRCDIR=%~dp0"

call "%VCVARS%" x64
if errorlevel 1 exit /b 1
if not exist "%OUTDIR%\obj\x64" mkdir "%OUTDIR%\obj\x64"
if not exist "%OUTDIR%\bin\x64" mkdir "%OUTDIR%\bin\x64"
if not exist "%OUTDIR%\lib\x64" mkdir "%OUTDIR%\lib\x64"
cl /nologo /LD /O2 /W4 /utf-8 "%SRCDIR%demo_mathdll.c" /Fe:"%OUTDIR%\bin\x64\demo_mathdll.dll" /Fo:"%OUTDIR%\obj\x64\\" /link /IMPLIB:"%OUTDIR%\lib\x64\demo_mathdll.lib"
if errorlevel 1 exit /b 1

call "%VCVARS%" x86
if errorlevel 1 exit /b 1
if not exist "%OUTDIR%\obj\Win32" mkdir "%OUTDIR%\obj\Win32"
if not exist "%OUTDIR%\bin\Win32" mkdir "%OUTDIR%\bin\Win32"
if not exist "%OUTDIR%\lib\Win32" mkdir "%OUTDIR%\lib\Win32"
cl /nologo /LD /O2 /W4 /utf-8 "%SRCDIR%demo_mathdll.c" /Fe:"%OUTDIR%\bin\Win32\demo_mathdll.dll" /Fo:"%OUTDIR%\obj\Win32\\" /link /IMPLIB:"%OUTDIR%\lib\Win32\demo_mathdll.lib"
if errorlevel 1 exit /b 1

echo demo_mathdll build OK
endlocal
