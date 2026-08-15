!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "nsProcess.nsh"
!include "WinMessages.nsh"

; Electron 的主、渲染和 GPU 子进程都使用 LingBuilder.exe。nsProcess 的
; CloseProcess 会先关闭窗口、等待 3 秒，再结束仍在运行的同名进程。
!macro StopLingBuilderProcesses
  nsProcess::_CloseProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  Sleep 500
  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $0
!macroend

; 0.3.0 之前的卸载器会把自身的辅助进程当作应用占用。此安装器已负责
; 覆盖核心文件、重写卸载注册信息并删除旧 SDK，因此升级时跳过旧卸载器。
!macro SkipLegacyLingBuilderUninstaller
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  DeleteRegValue HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
!macroend

; 同时编译进安装器和卸载器。先礼貌关闭主窗口，再按安装目录清理全部残留进程。
!macro customCheckAppRunning
  DetailPrint "正在关闭已运行的 LingBuilder…"
  retryLingBuilderShutdown:
    !insertmacro StopLingBuilderProcesses
    ${If} $0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "LingBuilder 仍在运行，或该进程以管理员权限启动。请在任务管理器的“详细信息”中结束所有 LingBuilder.exe；若仍无法结束，请关闭安装器后以管理员身份重新运行。" /SD IDCANCEL IDRETRY retryLingBuilderShutdown
      Abort
    ${EndIf}
    !ifndef BUILD_UNINSTALLER
      !insertmacro SkipLegacyLingBuilderUninstaller
    !endif
!macroend

; 兼容已安装的旧版卸载器。即使旧卸载器的占用检测错误返回失败，当前
; 安装器仍可覆盖文件并接管卸载注册信息，不再重复弹出默认“无法关闭”。
!macro customUnInstallCheck
  DetailPrint "旧版本卸载器未完全退出，继续执行覆盖安装。"
  ClearErrors
  StrCpy $R0 0
!macroend

!ifndef BUILD_UNINSTALLER
  Var LingBuilderCliPathCheckbox
  Var LingBuilderAddCliToPath

  !macro customInit
    ; 静默安装也默认启用 CLI；交互安装可在自定义页面取消。
    StrCpy $LingBuilderAddCliToPath "1"
  !macroend

  !macro customPageAfterChangeDir
    Page custom LingBuilderCliPathPageCreate LingBuilderCliPathPageLeave
  !macroend

  Function LingBuilderCliPathPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 28u "命令行工具可以在 PowerShell、命令提示符和外部 AI / MCP 客户端中调用 LingBuilder 能力。"
    Pop $0
    ${NSD_CreateCheckbox} 0 38u 100% 14u "将 LingBuilder CLI 添加到当前用户 PATH（推荐）"
    Pop $LingBuilderCliPathCheckbox
    ${NSD_Check} $LingBuilderCliPathCheckbox

    nsDialogs::Show
  FunctionEnd

  Function LingBuilderCliPathPageLeave
    ${NSD_GetState} $LingBuilderCliPathCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $LingBuilderAddCliToPath "1"
    ${Else}
      StrCpy $LingBuilderAddCliToPath "0"
    ${EndIf}
  FunctionEnd
!endif

!macro UpdateLingBuilderUserPath ACTION
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\update-user-path.ps1" -Action ${ACTION} -Directory "$INSTDIR"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "LingBuilder CLI PATH ${ACTION} 失败，退出码：$0"
  ${EndIf}
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customInstall
  ; 升级过程中旧卸载器若未能删除目录，也不得保留旧版随包 SDK。
  RMDir /r "$INSTDIR\resources\default-workspace\.lingbuilder\modules\lingbuilder.cef3.sdk\sdk"
  RMDir /r "$INSTDIR\resources\default-workspace\.lingbuilder\modules\lingbuilder.fbro.sdk\sdk"

  ; WebView2 是 EdgeView 原生项目的运行依赖。仅在注册表未检测到时执行随包冻结的微软 Evergreen Bootstrapper。
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
    SetOutPath "$PLUGINSDIR"
    File /oname=MicrosoftEdgeWebview2Setup.exe "${BUILD_RESOURCES_DIR}\vendor\MicrosoftEdgeWebview2Setup.exe"
    DetailPrint "正在安装 Microsoft Edge WebView2 Runtime…"
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
    ${If} $1 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "WebView2 Runtime 自动安装未完成（退出码 $1）。LingBuilder 仍可启动，稍后可在“工具 → 环境修复中心”重试。"
    ${EndIf}
  ${EndIf}

  ${If} $LingBuilderAddCliToPath == "1"
    !insertmacro UpdateLingBuilderUserPath "add"
  ${Else}
    ; 重新安装时取消勾选，应移除旧版可能留下的 PATH 项。
    !insertmacro UpdateLingBuilderUserPath "remove"
  ${EndIf}

  ; 完成页直接启动已安装的 EXE，避免 Windows 快捷方式关联异常阻止首次启动。
  StrCpy $launchLink "$appExe"
!macroend

!macro customUnInstall
  ; customUnInstall 在安装文件被删除前执行，此时 PATH 维护脚本仍可用。
  !insertmacro UpdateLingBuilderUserPath "remove"
!macroend
