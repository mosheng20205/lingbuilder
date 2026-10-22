@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /W4 /EHsc /utf-8 /Ithird_party\libusb\include probe.cpp /Fe:probe.exe /link /LIBPATH:third_party\libusb\VS2013\MS64\dll libusb-1.0.lib
