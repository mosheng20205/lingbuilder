!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

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
!macroend

!macro customUnInstall
  ; customUnInstall 在安装文件被删除前执行，此时 PATH 维护脚本仍可用。
  !insertmacro UpdateLingBuilderUserPath "remove"
!macroend
