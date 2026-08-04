#pragma once

#include <windows.h>
#include <string>

bool LB_WxMore_BindMonitor(HWND instanceList, HWND statusLabel, HWND logList);
bool LB_WxMore_StartWeixin(const std::wstring& executablePath);
bool LB_WxMore_RefreshNow();
void LB_WxMore_StopMonitor();
int LB_WxMore_InstanceCount();
int LB_WxMore_LoggedInCount();
const wchar_t* LB_WxMore_LastError();
