@echo off
setlocal
for /f "usebackq tokens=*" %%i in (`"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -property installationPath`) do set VSPATH=%%i
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
if not exist build mkdir build
cl /nologo /utf-8 /EHsc /std:c++17 /O2 driver_main.cpp /Fe:build\wxocr_driver.exe user32.lib gdi32.lib > build\cl.log 2>&1
if errorlevel 1 (
  type build\cl.log
  exit /b 1
)
echo BUILD OK
