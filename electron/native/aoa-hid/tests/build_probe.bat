@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
cl /nologo /EHsc /W1 /I "T:\electron\lingbuilder\.lingbuilder-build\aoa-viewer\x64\Debug\modules\lingbuilder.aoahid\include" start_probe2.cpp /link /LIBPATH:"T:\electron\lingbuilder\.lingbuilder-build\aoa-viewer\x64\Debug\modules\lingbuilder.aoahid\lib\x64" libusb-1.0.lib /OUT:start_probe2.exe
