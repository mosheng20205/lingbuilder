@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS /Iinclude /Ithird_party\libusb\include /c src\aoa_device.cpp src\aoa_hid_core.cpp src\aoa_record.cpp src\aoa_bridge.cpp
lib /nologo /OUT:aoa_test.lib aoa_device.obj aoa_hid_core.obj aoa_record.obj aoa_bridge.obj
