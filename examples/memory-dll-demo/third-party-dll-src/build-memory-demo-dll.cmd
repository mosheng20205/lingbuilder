@echo off
rem 构建「内存加载 DLL」演示用的第三方 DLL（x64 + Win32）。
rem 用法: build-memory-demo-dll.cmd <输出目录>
rem   <输出目录> 下生成 bin\x64\memory_demo.dll 与 bin\Win32\memory_demo.dll
rem Visual Studio 位置可用 VCVARS 环境变量覆盖。
rem 说明：/MT 静态 CRT，使 DLL 只依赖 kernel32 等系统 DLL，便于内存加载时不缺依赖；
rem       /EHsc 生成 C++ 异常处理代码，用于验证手工映射时 x64 异常表（.pdata）已注册。
setlocal
if "%~1"=="" (
    echo usage: build-memory-demo-dll.cmd ^<out-dir^>
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
if not exist "%OUTDIR%\bin\x64" mkdir "%OUTDIR%\bin\x64"
if not exist "%OUTDIR%\obj\x64" mkdir "%OUTDIR%\obj\x64"
cl /nologo /LD /MT /O2 /W4 /EHsc /Zi /utf-8 "%SRCDIR%memory_demo.cpp" /Fd:"%OUTDIR%\obj\x64\memory_demo.pdb" /Fe:"%OUTDIR%\bin\x64\memory_demo.dll" /Fo:"%OUTDIR%\obj\x64\\" /link /DEBUG /IMPLIB:"%OUTDIR%\obj\x64\memory_demo.lib"
if errorlevel 1 exit /b 1

call "%VCVARS%" x86
if errorlevel 1 exit /b 1
if not exist "%OUTDIR%\bin\Win32" mkdir "%OUTDIR%\bin\Win32"
if not exist "%OUTDIR%\obj\Win32" mkdir "%OUTDIR%\obj\Win32"
cl /nologo /LD /MT /O2 /W4 /EHsc /Zi /utf-8 "%SRCDIR%memory_demo.cpp" /Fd:"%OUTDIR%\obj\Win32\memory_demo.pdb" /Fe:"%OUTDIR%\bin\Win32\memory_demo.dll" /Fo:"%OUTDIR%\obj\Win32\\" /link /DEBUG /IMPLIB:"%OUTDIR%\obj\Win32\memory_demo.lib"
if errorlevel 1 exit /b 1

echo memory_demo build OK
endlocal
