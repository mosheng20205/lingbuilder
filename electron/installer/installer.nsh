!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "nsProcess.nsh"
!include "WinMessages.nsh"

Var LingBuilderKillTries

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

; AI 客户端（ChatGPT/Codex 桌面版、Claude、Gemini CLI）会通过 MCP stdio 自动重启
; LingBuilder.exe 宿主进程并锁住 app.asar。安装开始前直接结束这些已知拉起进程；
; 进程不存在时 taskkill 返回非零，忽略即可。
!macro StopMcpHostRespawnSources
  nsExec::ExecToLog 'taskkill /F /IM ChatGPT.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM Codex.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM claude.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM gemini.exe'
  Pop $0
!macroend

; 同时编译进安装器和卸载器。安装器先终结会复活 MCP 宿主的 AI 客户端，
; 再循环关闭 LingBuilder 进程（含无窗口的 stdio 宿主）直到确认无残留。
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    DetailPrint "正在关闭可能自动重启 LingBuilder MCP 宿主的 AI 客户端…"
    !insertmacro StopMcpHostRespawnSources
    ; 通用兜底：临时禁用 CLI 启动器。无论复活源是什么进程（ChatGPT/Codex 桌面、
    ; 自建 node CLI 代理等），宿主都经 lingbuilder.cmd 拉起，改名后重启必然失败；
    ; 复制阶段新包会重新放置 lingbuilder.cmd。
    ${If} ${FileExists} "$INSTDIR\lingbuilder.cmd"
      Delete "$INSTDIR\lingbuilder.cmd.disabled"
      Rename "$INSTDIR\lingbuilder.cmd" "$INSTDIR\lingbuilder.cmd.disabled"
    ${EndIf}
  !endif
  DetailPrint "正在关闭已运行的 LingBuilder…"
  StrCpy $LingBuilderKillTries 0
  tryStopLingBuilder:
    !insertmacro StopLingBuilderProcesses
    ${If} $0 != 0
      Goto lingBuilderShutdownDone
    ${EndIf}
    IntOp $LingBuilderKillTries $LingBuilderKillTries + 1
    ${If} $LingBuilderKillTries < 8
      Sleep 500
      Goto tryStopLingBuilder
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "LingBuilder 仍在运行（可能是 AI 客户端不断重启其 MCP 宿主），或该进程以管理员权限启动。请先退出 ChatGPT/Codex 等 AI 客户端；仍无法结束时请在任务管理器的“详细信息”中结束所有 LingBuilder.exe，若仍无法结束，请关闭安装器后以管理员身份重新运行。" /SD IDCANCEL IDRETRY retryStopLingBuilder
    Abort
    retryStopLingBuilder:
      StrCpy $LingBuilderKillTries 0
      Goto tryStopLingBuilder
  lingBuilderShutdownDone:
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

  ; 尾部自检结论：ok / fail / skip（skip=无法比对，例如走了兜底直解压路径）
  Var LingBuilderSelfCheck

  ; 比对已安装 app.asar 与包内解出副本（$PLUGINSDIR\7z-out）的字节数。
  ; CopyFiles 保留打包期时间戳，mtime 不可用作新鲜度判据；FileFunc GetSize
  ; 只支持目录，这里用 FileOpen+FileSeek END 取 32 位字节数（asar < 2GB）。
  Function GetLingBuilderSelfCheck
    Push $1
    Push $2
    Push $3
    StrCpy $LingBuilderSelfCheck "skip"
    ClearErrors
    FileOpen $1 "$INSTDIR\resources\app.asar" r
    IfErrors lbSelfCheckEnd
    FileSeek $1 0 END $2
    FileClose $1
    ClearErrors
    FileOpen $1 "$PLUGINSDIR\7z-out\resources\app.asar" r
    IfErrors lbSelfCheckEnd
    FileSeek $1 0 END $3
    FileClose $1
    ${If} $2 == $3
      StrCpy $LingBuilderSelfCheck "ok"
    ${Else}
      StrCpy $LingBuilderSelfCheck "fail"
    ${EndIf}
    lbSelfCheckEnd:
    Pop $3
    Pop $2
    Pop $1
  FunctionEnd

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
  ; 清理安装前临时禁用的启动器残留（新 lingbuilder.cmd 已随本次复制落盘）。
  Delete "$INSTDIR\lingbuilder.cmd.disabled"
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

  ; 尾部清扫：复制期间若有 AI 客户端复活了 MCP 宿主，再补杀一轮同名进程。
  !insertmacro StopLingBuilderProcesses
  ${If} $0 == 0
    DetailPrint "安装期间检测到 LingBuilder 进程被重新启动，已再次结束。"
  ${EndIf}

  ; 尾部自检：已安装 app.asar 必须与包内副本字节一致，否则说明复制期间
  ; 文件仍被占用、发生了半更新。交互模式弹中文警告；静默模式以退出码 87
  ; 结束，杜绝「exit 0 假成功」；无法比对（兜底直解压路径）时仅记录说明。
  Call GetLingBuilderSelfCheck
  ${If} $LingBuilderSelfCheck == "ok"
    DetailPrint "安装自检通过：核心程序文件与安装包内容一致。"
    Goto lingBuilderSelfCheckEnd
  ${EndIf}
  ${If} $LingBuilderSelfCheck == "skip"
    DetailPrint "安装自检跳过：未找到包内比对副本（走了兜底解压路径）。"
    Goto lingBuilderSelfCheckEnd
  ${EndIf}
  IfSilent 0 lingBuilderSelfCheckBox
    DetailPrint "警告：resources\app.asar 未被本次安装成功覆盖（复制期间仍被外部进程占用），安装未完全生效。请退出 LingBuilder 及会自动重启其 MCP 宿主的 AI 客户端后重新运行安装器。"
    SetErrorLevel 87
    Goto lingBuilderSelfCheckEnd
  lingBuilderSelfCheckBox:
    MessageBox MB_ICONEXCLAMATION|MB_OK "安装未完全生效：核心程序文件在本次安装期间未能被覆盖（可能仍被外部进程占用）。请退出 LingBuilder 及会自动重启其 MCP 宿主的 AI 客户端后重新运行本安装器。"
  lingBuilderSelfCheckEnd:

  ; 完成页直接启动已安装的 EXE，避免 Windows 快捷方式关联异常阻止首次启动。
  StrCpy $launchLink "$appExe"
!macroend

!macro customUnInstall
  ; customUnInstall 在安装文件被删除前执行，此时 PATH 维护脚本仍可用。
  !insertmacro UpdateLingBuilderUserPath "remove"
!macroend
