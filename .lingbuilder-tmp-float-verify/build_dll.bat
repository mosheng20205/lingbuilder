@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
cl /nologo /LD mathf.c /Fe:mathf.dll
exit /b %ERRORLEVEL%
