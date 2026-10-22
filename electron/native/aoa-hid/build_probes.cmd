@echo off
REM Build AOA robustness verification probes (2026-10-21).
REM Outputs go to .probe64\ and .run64\ (local scratch dirs).
REM   .probe64\ff48_probe.exe     enumerate/open FF48+FF40, GET_PROTOCOL, interface dump (P2 evidence)
REM   .probe64\winusb_probe.exe   enumerate child WinUSB interface paths, try CreateFile + GET_PROTOCOL
REM   .probe64\mi01_all.exe       scan every device interface class matching the instance id
REM   .probe64\share_matrix.exe   access x share matrix + security descriptor (rule out exclusive open)
REM   .probe64\ff48_deep.exe      full device list + open result + FF48 config descriptor
REM   .probe64\start_probe.exe    drive AOA switch step by step, print every step result (P4 diagnostics)
REM   .probe64\usb_port_cycle.exe hub port power cycle (software replug; clears remove-device leftovers)
REM   .probe64\devnode_ctl.exe    devnode disable/enable/restart/reenum
REM   .probe64\devnode_tree.exe   print devnode tree with status bits (DN_WILL_BE_REMOVED etc.)
REM   .probe64\force_bind.exe     force-update a live device to a given INF (driver binding experiment)
REM   .probe64\wrap_test.exe      libusb_wrap_sys_device over a WinUSB handle
REM   .probe64\iface_scan.exe     list every device-interface class registered for a matching instance
REM   .probe64\wu_open_test.exe   compare WinUSB open modes for the ADB child vs the parent node
REM   .probe64\usbdk_probe.exe    LIBUSB_OPTION_USE_USBDK behaviour when UsbDk is absent (fallback safety)
REM   .run64\verify.exe           bridge-level acceptance: list / open <serial> / pump <serial> [sec] / hold <serial>
REM Usage: build_probes.cmd  then  cd .run64  and run  verify.exe list
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
if not exist .probe64 mkdir .probe64
if not exist .run64 mkdir .run64
set "INC=/Ithird_party\libusb\include"
set "LNK=/link /LIBPATH:third_party\libusb\VS2013\MS64\dll libusb-1.0.lib"
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS %INC% tests\ff48_probe.cpp  /Fe:.probe64\ff48_probe.exe  %LNK% || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS %INC% tests\ff48_deep.cpp   /Fe:.probe64\ff48_deep.exe   %LNK% || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS %INC% tests\start_probe.cpp /Fe:.probe64\start_probe.exe %LNK% || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS %INC% tests\wrap_test.cpp   /Fe:.probe64\wrap_test.exe   %LNK% || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS %INC% tests\usbdk_probe.cpp  /Fe:.probe64\usbdk_probe.exe  %LNK% || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\iface_scan.cpp     /Fe:.probe64\iface_scan.exe     || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\wu_open_test.cpp   /Fe:.probe64\wu_open_test.exe   || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\winusb_probe.cpp    /Fe:.probe64\winusb_probe.exe    || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\mi01_all.cpp        /Fe:.probe64\mi01_all.exe        || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\share_matrix.cpp    /Fe:.probe64\share_matrix.exe    || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\usb_port_cycle.cpp  /Fe:.probe64\usb_port_cycle.exe  || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\devnode_ctl.cpp     /Fe:.probe64\devnode_ctl.exe     || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\devnode_tree.cpp    /Fe:.probe64\devnode_tree.exe    || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS tests\force_bind.cpp      /Fe:.probe64\force_bind.exe      || exit /b 1
cl /nologo /W4 /EHsc /utf-8 /D_CRT_SECURE_NO_WARNINGS /Iinclude %INC% src\aoa_device.cpp src\aoa_hid_core.cpp src\aoa_record.cpp src\aoa_bridge.cpp tests\verify_aoahid.cpp /Fe:.run64\verify.exe %LNK% || exit /b 1
copy /y third_party\libusb\MinGW64\dll\libusb-1.0.dll .probe64\ >nul
copy /y third_party\libusb\MinGW64\dll\libusb-1.0.dll .run64\ >nul
echo probes built: .probe64\*.exe  .run64\verify.exe
