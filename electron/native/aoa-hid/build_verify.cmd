@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS /Iinclude /Ithird_party\libusb\include src\aoa_device.cpp src\aoa_hid_core.cpp src\aoa_record.cpp src\aoa_bridge.cpp tests\verify_aoahid.cpp /Fe:.run64\verify.exe /link /LIBPATH:third_party\libusb\VS2013\MS64\dll libusb-1.0.lib
