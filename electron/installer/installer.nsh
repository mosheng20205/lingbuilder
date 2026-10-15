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

  ; 仅安装器使用（customFiles_x64）：必须与下面的使用同处 BUILD_UNINSTALLER 守卫内，
  ; 否则卸载器构建（定义 BUILD_UNINSTALLER、不定义 customFiles_x64）会报
  ; NSIS 6001「变量未引用」，在 electron-builder 默认 -WX 下升级为构建失败（0.8.22 打包实锤）。
  Var LingBuilderCoreRepairTries

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

; 取文件字节数（32 位上限内）：栈入参=文件路径，栈出参=十进制字节数，打不开返回空串。
Function LbGetFileSizeBytes
  Exch $1
  Push $2
  Push $3
  ClearErrors
  FileOpen $2 $1 r
  ${If} ${Errors}
    StrCpy $3 ""
  ${Else}
    FileSeek $2 0 END $3
    FileClose $2
  ${EndIf}
  StrCpy $1 $3
  Pop $3
  Pop $2
  Exch $1
FunctionEnd

; 比对已装 app.asar 与包内解出副本（$PLUGINSDIR\7z-out）的字节数，OUT 取 same/diff/unknown。
; CopyFiles 保留打包期时间戳，mtime 不可用作新鲜度判据（与尾部 GetLingBuilderSelfCheck 同口径）。
!macro LbCompareAsarWithPackage OUT
  Push "$INSTDIR\resources\app.asar"
  Call LbGetFileSizeBytes
  Pop $9
  Push "$PLUGINSDIR\7z-out\resources\app.asar"
  Call LbGetFileSizeBytes
  Pop $8
  ${If} $9 == ""
  ${OrIf} $8 == ""
    StrCpy ${OUT} "unknown"
  ${ElseIf} $9 == $8
    StrCpy ${OUT} "same"
  ${Else}
    StrCpy ${OUT} "diff"
  ${EndIf}
!macroend

; 解压完成、写注册表之前的核对与修复（customFiles_x64 由 electron-builder 在
; custom_files_post_decompression 处调用，先于 registryAddInstallInfo）。
; 兜底直解压路径（extractUsing7za 里的 Nsis7z::Extract 直解到安装目录）会忽略被占用
; 文件的写入错误：外部 AI 客户端复活的 MCP 宿主恰好锁住 LingBuilder.exe/app.asar 时，
; 会得到「注册表新版本 + 磁盘旧核心文件」的半更新假成功（2026-10-13 实锤，0.8.20→
; 0.8.21 在线更新死循环）。这里核对，必要时杀进程补拷、把被锁文件改名让位（.lb-stale）
; 后重写——Windows 允许对运行中的 exe 与被共享读持有的 asar 改名，无需与宿主复活赛跑；
; 3 轮仍失败则回滚改名并中止安装（退出码 87），不写假注册表。
!macro customFiles_x64
  !ifdef ZIP_COMPRESSION
    ; ZIP 压缩形态没有 app-64.7z 可作权威副本，跳过核对（本项目固定 7z，仅防御）。
    Goto lbCoreFilesVerified
  !endif
  ; 清理上次安装改名让位的残留（持锁进程退出后即可删除；失败忽略，下次再试）。
  Delete "$INSTDIR\resources\app.asar.lb-stale"
  Delete "$INSTDIR\LingBuilder.exe.lb-stale"

  !insertmacro LbCompareAsarWithPackage $0
  ${If} $0 != "diff"
    Goto lbCoreFilesVerified
  ${EndIf}

  DetailPrint "检测到核心程序文件未被本次安装覆盖（安装期间被外部进程占用），正在修复…"
  StrCpy $LingBuilderCoreRepairTries 0

  lbCoreRepairLoop:
    IntOp $LingBuilderCoreRepairTries $LingBuilderCoreRepairTries + 1

    ; 兜底路径会删掉 7z-out：先确保权威比对/拷贝源存在（Nsis7z::Extract 解到当前目录）。
    IfFileExists "$PLUGINSDIR\7z-out\resources\app.asar" lbCoreRefReady 0
      Push $OUTDIR
      CreateDirectory "$PLUGINSDIR\7z-out"
      SetOutPath "$PLUGINSDIR\7z-out"
      Nsis7z::Extract "$PLUGINSDIR\app-64.${COMPRESSION_METHOD}"
      Pop $1
      Pop $2
      SetOutPath $2
    lbCoreRefReady:

    ; 先杀复活的同名宿主（含无窗口 stdio 进程）再全量补拷。
    !insertmacro StopLingBuilderProcesses
    ClearErrors
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\*" "$INSTDIR"
    ${IfNot} ${Errors}
      Goto lbCoreRepairVerify
    ${EndIf}
    DetailPrint "直接补拷失败（文件仍被占用），改为改名让位后重写…"
    Delete "$INSTDIR\LingBuilder.exe.lb-stale"
    Rename "$INSTDIR\LingBuilder.exe" "$INSTDIR\LingBuilder.exe.lb-stale"
    Delete "$INSTDIR\resources\app.asar.lb-stale"
    Rename "$INSTDIR\resources\app.asar" "$INSTDIR\resources\app.asar.lb-stale"
    ClearErrors
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\LingBuilder.exe" "$INSTDIR"
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\resources\app.asar" "$INSTDIR\resources"
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\*" "$INSTDIR"

    lbCoreRepairVerify:
    !insertmacro LbCompareAsarWithPackage $0
    ${If} $0 == "same"
      DetailPrint "核心程序文件修复完成，与安装包内容一致。"
      Goto lbCoreFilesVerified
    ${EndIf}
    ${If} $LingBuilderCoreRepairTries < 3
      Sleep 1000
      Goto lbCoreRepairLoop
    ${EndIf}

    ; 3 轮仍失败：先回滚改名让位（保证中止后旧版本仍能启动），再中止安装。
    ${If} ${FileExists} "$INSTDIR\LingBuilder.exe"
    ${Else}
      Rename "$INSTDIR\LingBuilder.exe.lb-stale" "$INSTDIR\LingBuilder.exe"
    ${EndIf}
    ${If} ${FileExists} "$INSTDIR\resources\app.asar"
    ${Else}
      Rename "$INSTDIR\resources\app.asar.lb-stale" "$INSTDIR\resources\app.asar"
    ${EndIf}
    IfSilent 0 lbCoreRepairFailBox
      DetailPrint "安装中止：核心程序文件被占用且无法修复（外部 AI 客户端可能在自动重启 LingBuilder MCP 宿主）。请退出相关 AI 客户端后重新运行安装器。"
      SetErrorLevel 87
      Quit
    lbCoreRepairFailBox:
      MessageBox MB_ICONEXCLAMATION|MB_OK "安装已中止：核心程序文件（LingBuilder.exe / app.asar）在本次安装期间被其它进程占用，自动修复未能成功。$\n$\n常见原因：连接 LingBuilder 的外部 AI 客户端（Codex / Claude / ZCode 等）在自动重启其 MCP 宿主进程并锁住程序文件。$\n$\n请先退出这些 AI 客户端（或在任务管理器「详细信息」中结束所有 LingBuilder.exe），然后重新运行本安装器。"
      SetErrorLevel 87
      Quit
  lbCoreFilesVerified:
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

  ; 0.7.9 首包曾在这里 RMDir /r 老版本的 resources\dsh\resources\node（约 2.6 万个文件），
  ; 结果被杀软逐个拦截、进度条在尾部冻结数分钟（真机实测）。旧运行时树与 2026-10-02 退场的
  ; 内嵌 Agent 运行时残留（agent-runtime.tar/json、<userData>\agent-runtime）一律由应用侧
  ; agentRuntimeLegacyCleanup 异步删除，安装器零等待，严禁把这类清理放回安装器。

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
