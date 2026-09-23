@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
cd /d T:\electron\lingbuilder\electron\.tmp-probe\out
cl /nologo /utf-8 /std:c++17 /EHsc /DUNICODE /D_UNICODE /c main.cpp /Fo:main.obj > compile.log 2>&1
echo exit=%errorlevel%
findstr /C:"error" compile.log | more +0
