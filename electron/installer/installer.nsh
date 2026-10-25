!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "nsProcess.nsh"
!include "WinMessages.nsh"

; 安装器核心文件期望尺寸（app.asar / 主程序 exe 字节数）：makensis 编译期从
; release\win-unpacked 实测。编译发生在 electron-builder 打包与签名之后，这里的尺寸
; 与 app-64.7z 解到安装目录的最终文件一致（afterPack 钩子早于 exe 签名，实测会差一个
; 签名块，不能用——2026-10-25 实锤）。NSIS 3.04 无 !getsize，用 cmd for 取尺寸落盘后
; searchparse 进 define。相对锚点：BUILD_RESOURCES_DIR=electron\build，输出目录=release。
; 单阶段直解补丁（scripts/patch-nsis-single-phase-extract.cjs）取消了两段式解压的
; $PLUGINSDIR\7z-out 权威副本，被占用文件的「半更新」防护以此处期望尺寸为唯一核对基准。
!ifndef BUILD_UNINSTALLER
  !tempfile LBSZTMP
  !system 'cmd /c (for %A in ("${BUILD_RESOURCES_DIR}\..\release\win-unpacked\${PRODUCT_FILENAME}.exe") do @echo LB_EXE_SZ=%~zA-LB_END)>"${LBSZTMP}"'
  !searchparse /file "${LBSZTMP}" "LB_EXE_SZ=" LB_EXPECTED_EXE_SIZE "-LB_END"
  !system 'cmd /c (for %A in ("${BUILD_RESOURCES_DIR}\..\release\win-unpacked\resources\app.asar") do @echo LB_ASAR_SZ=%~zA-LB_END)>"${LBSZTMP}"'
  !searchparse /file "${LBSZTMP}" "LB_ASAR_SZ=" LB_EXPECTED_ASAR_SIZE "-LB_END"
  !delfile "${LBSZTMP}"
!endif

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
    ; 模板在安装段开头设了 SetDetailsPrint none；这里临时恢复显示，让用户能看到
    ; 每个阶段在做什么（关闭 AI 客户端 / 关闭 LingBuilder），避免长时间无反馈。
    SetDetailsPrint listonly
  !endif
  DetailPrint "正在关闭可能自动重启 LingBuilder MCP 宿主的 AI 客户端…"
  !insertmacro StopMcpHostRespawnSources
  ; 通用兜底：临时禁用 CLI 启动器。无论复活源是什么进程（ChatGPT/Codex 桌面、
  ; 自建 node CLI 代理等），宿主都经 lingbuilder.cmd 拉起，改名后重启必然失败；
  ; 复制阶段新包会重新放置 lingbuilder.cmd。
  ${If} ${FileExists} "$INSTDIR\lingbuilder.cmd"
    Delete "$INSTDIR\lingbuilder.cmd.disabled"
    Rename "$INSTDIR\lingbuilder.cmd" "$INSTDIR\lingbuilder.cmd.disabled"
  ${EndIf}
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
  ; 恢复模板静默口径（仅安装器）：随后的模板指令（解压等）不逐行刷屏，进度条由 Nsis7z 驱动。
  !ifndef BUILD_UNINSTALLER
    SetDetailsPrint none
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

  ; 尾部自检结论：ok / fail（以打包期期望尺寸为唯一基准）。
  Var LingBuilderSelfCheck

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

  ; 核对已安装核心文件与打包期期望尺寸：OUT 取 ok / diff（任一文件打不开按 diff 处理）。
  ; 单阶段直解后没有包内解出副本可比对（CopyFiles 保留打包期时间戳，mtime 也不可用），
  ; 期望尺寸由 afterPack 从 win-unpacked 实测生成，是「写入是否完整」的权威基准。
  ; 注意：本宏会插入进 Function 体（定义处就地编译），只能用命令行级 define
  ; （PRODUCT_FILENAME），不能用 common.nsh 才定义的 APP_EXECUTABLE_FILENAME。
  !macro LbVerifyCoreSizes OUT
    Push "$INSTDIR\resources\app.asar"
    Call LbGetFileSizeBytes
    Pop ${OUT}
    Push "$INSTDIR\${PRODUCT_FILENAME}.exe"
    Call LbGetFileSizeBytes
    Pop $9
    ${If} ${OUT} == "${LB_EXPECTED_ASAR_SIZE}"
    ${AndIf} $9 == "${LB_EXPECTED_EXE_SIZE}"
      StrCpy ${OUT} "ok"
    ${Else}
      StrCpy ${OUT} "diff"
    ${EndIf}
  !macroend

  !macro customInit
    ; 静默安装也默认启用 CLI；交互安装可在自定义页面取消。
    StrCpy $LingBuilderAddCliToPath "1"
  !macroend

  ; 直解完成、写注册表之前的核对与修复（customFiles_x64 由 electron-builder 在
  ; custom_files_post_decompression 处调用，先于 registryAddInstallInfo）。
  ; Nsis7z 直解到安装目录时会静默跳过被占用的文件：外部 AI 客户端复活的 MCP 宿主
  ; 恰好锁住 LingBuilder.exe/app.asar 时会得到「注册表新版本 + 磁盘旧核心文件」的
  ; 半更新（2026-10-13 实锤，0.8.20→0.8.21 在线更新死循环）。这里按期望尺寸核对，
  ; 不一致则杀进程、把被锁文件改名让位（.lb-stale，Windows 允许对运行中的 exe 与
  ; 被共享读持有的 asar 改名）后整体重解；3 轮仍失败则回滚改名并中止安装
  ; （退出码 87），不写假注册表。
  !macro customFiles_x64
    !ifdef ZIP_COMPRESSION
      ; ZIP 压缩形态没有 app-64.7z 可作修复源，跳过核对（本项目固定 7z，仅防御）。
      Goto lbCoreFilesVerified
    !endif
    ; 清理上次安装改名让位的残留（持锁进程退出后即可删除；失败忽略，下次再试）。
    Delete "$INSTDIR\resources\app.asar.lb-stale"
    Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}.lb-stale"
    !insertmacro LbVerifyCoreSizes $0
    ${If} $0 == "ok"
      Goto lbCoreFilesVerified
    ${EndIf}

    DetailPrint "检测到核心程序文件未被本次安装覆盖（安装期间被外部进程占用），正在修复…"
    StrCpy $LingBuilderCoreRepairTries 0

    lbCoreRepairLoop:
      IntOp $LingBuilderCoreRepairTries $LingBuilderCoreRepairTries + 1

      ; 先杀复活的同名宿主（含无窗口 stdio 进程），再改名让位后整体重解。
      !insertmacro StopLingBuilderProcesses
      Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}.lb-stale"
      Rename "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}.lb-stale"
      Delete "$INSTDIR\resources\app.asar.lb-stale"
      Rename "$INSTDIR\resources\app.asar" "$INSTDIR\resources\app.asar.lb-stale"

      SetOutPath "$INSTDIR"
      Nsis7z::Extract "$PLUGINSDIR\app-64.${COMPRESSION_METHOD}"
      SetOutPath "$INSTDIR"

      !insertmacro LbVerifyCoreSizes $0
      ${If} $0 == "ok"
        Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}.lb-stale"
        Delete "$INSTDIR\resources\app.asar.lb-stale"
        DetailPrint "核心程序文件修复完成，与安装包期望尺寸一致。"
        Goto lbCoreFilesVerified
      ${EndIf}
      ${If} $LingBuilderCoreRepairTries < 3
        Sleep 1000
        Goto lbCoreRepairLoop
      ${EndIf}

      ; 3 轮仍失败：先回滚改名让位（保证中止后旧版本仍能启动），再中止安装。
      ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      ${Else}
        Rename "$INSTDIR\${APP_EXECUTABLE_FILENAME}.lb-stale" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
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

  ; 尾部自检：把已安装核心文件与打包期期望尺寸逐一比对（ok / fail）。
  Function GetLingBuilderSelfCheck
    Push $0
    !insertmacro LbVerifyCoreSizes $0
    StrCpy $LingBuilderSelfCheck $0
    Pop $0
  FunctionEnd
!endif

; —— 用户 PATH 维护（HKCU\Environment\Path），纯 NSIS 实现 ——
; 旧实现经 powershell 跑 update-user-path.ps1：无签名安装器拉起 powershell 会被
; 安全软件重罚（真机实测单步 80~460 秒，是「安装尾部假死」的最大单一来源，
; 2026-10-25 定位）。此处语义与 ps1 对齐：剔除与安装目录等值的旧条目（去引号、
; 去首尾空白与尾部反斜杠后精确比较），add 时把安装目录追加到末尾。
; 红线：PATH 超过 7000 字符时跳过改写（NSIS 字符串上限保护，宁可不加也不截断）；
; 值含 % 时用 REG_EXPAND_SZ 写回，保持环境变量展开语义。
; 动作经 $R9 传入（"add"/"remove"）：宏在 customInstall 里只插入一次，避免同名标签重复。
!macro UpdateLingBuilderUserPath
  ClearErrors
  ReadRegStr $R1 HKCU "Environment" "Path"
  ${If} ${Errors}
    StrCpy $R1 ""
  ${EndIf}
  StrLen $R3 "$R1"
  ${If} $R3 > 7000
    DetailPrint "用户 PATH 过长（$R3 字符），已跳过自动维护，请手动将 $INSTDIR 加入 PATH。"
    Goto lbPathEnd
  ${EndIf}
  ; 目标目录规范化：去尾部反斜杠（盘根除外）
  StrCpy $R2 "$INSTDIR"
  lbPathTrimTarget:
    StrLen $R3 "$R2"
    ${If} $R3 > 3
      StrCpy $R4 "$R2" 1 $R3-1
      ${If} $R4 == "\"
        StrCpy $R2 "$R2" $R3-1
        Goto lbPathTrimTarget
      ${EndIf}
    ${EndIf}
  ; 逐条扫描：R3=输出，R4=当前条目，R5=剩余工作串，R6=输出是否已有条目
  StrCpy $R3 ""
  StrCpy $R4 ""
  StrCpy $R5 "$R1;"
  StrCpy $R6 0
  lbPathLoop:
    ${If} "$R5" == ""
      Goto lbPathDone
    ${EndIf}
    StrCpy $R8 "$R5" 1 0
    ${If} $R8 == ";"
      ; 条目终结 → 规范化 $R4
      lbEntryTrimL:
        ${If} "$R4" != ""
          StrCpy $R7 "$R4" 1 0
          ${If} $R7 == " "
          ${OrIf} $R7 == "$\""
            StrCpy $R4 "$R4" "" 1
            Goto lbEntryTrimL
          ${EndIf}
        ${EndIf}
      lbEntryTrimR:
        ${If} "$R4" != ""
          StrLen $R7 "$R4"
          StrCpy $R8 "$R4" 1 $R7-1
          ${If} $R8 == " "
          ${OrIf} $R8 == "$\""
            StrCpy $R4 "$R4" $R7-1
            Goto lbEntryTrimR
          ${EndIf}
        ${EndIf}
      lbEntryTrimSlash:
        StrLen $R7 "$R4"
        ${If} $R7 > 3
          StrCpy $R8 "$R4" 1 $R7-1
          ${If} $R8 == "\"
            StrCpy $R4 "$R4" $R7-1
            Goto lbEntryTrimSlash
          ${EndIf}
        ${EndIf}
      ${If} "$R4" != ""
        StrCmpS $R4 "$R2" lbPathSkipEntry 0
        ${If} $R6 == 1
          StrCpy $R3 "$R3;"
        ${EndIf}
        StrCpy $R3 "$R3$R4"
        StrCpy $R6 1
      ${EndIf}
      lbPathSkipEntry:
      StrCpy $R4 ""
      StrCpy $R5 "$R5" "" 1
      Goto lbPathLoop
    ${Else}
      StrCpy $R4 "$R4$R8"
      StrCpy $R5 "$R5" "" 1
      Goto lbPathLoop
    ${EndIf}
  lbPathDone:
  ${If} $R9 == "add"
    ${If} $R6 == 1
      StrCpy $R3 "$R3;$R2"
    ${Else}
      StrCpy $R3 "$R2"
    ${EndIf}
  ${EndIf}
  ${If} "$R3" == ""
    ${If} "$R1" != ""
      DeleteRegValue HKCU "Environment" "Path"
    ${EndIf}
    Goto lbPathWritten
  ${EndIf}
  ; 无条件 REG_EXPAND_SZ 写回：无 % 的值展开后不变；含 %VAR% 的值保持展开语义
  ; （ReadRegStr 对 REG_EXPAND_SZ 返回未展开原文，写回即还原）。本机 NSIS 的
  ; StrFunc 1.09 无 StrContains，故不做类型分流。
  WriteRegExpandStr HKCU "Environment" "Path" "$R3"
  lbPathWritten:
  DetailPrint "LingBuilder CLI PATH 维护完成（$R9）。"
  ; 广播环境变量变化：SendMessage HWND_BROADCAST 对每个顶层窗口逐个阻塞等待，
  ; 窗口多/有挂死窗口的机器上实测阻塞数分钟（2026-10-25 相探针实锤：堵 387 秒）。
  ; 这里用 SendMessageTimeout + SMTO_ABORTIFHUNG（每窗口 1 秒即放弃）。
  System::Call 'user32::SendMessageTimeout(p 0xffff, i ${WM_SETTINGCHANGE}, p 0, t "Environment", i 2, i 1000, *p .R0)'
  lbPathEnd:
!macroend

!macro customInstall
  ; 恢复阶段提示显示：复制完成后的收尾动作（WebView2 / PATH / 自检）可能耗时数秒到数分钟，
  ; 进度条不会动，必须让 DetailPrint 可见，否则用户感知为假死。
  SetDetailsPrint listonly
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
    DetailPrint "正在安装 Microsoft Edge WebView2 Runtime（首次约需数分钟，取决于网络）…"
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
    ${If} $1 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "WebView2 Runtime 自动安装未完成（退出码 $1）。LingBuilder 仍可启动，稍后可在“工具 → 环境修复中心”重试。"
    ${EndIf}
  ${EndIf}

  ${If} $LingBuilderAddCliToPath == "1"
    StrCpy $R9 "add"
  ${Else}
    ; 重新安装时取消勾选，应移除旧版可能留下的 PATH 项。
    StrCpy $R9 "remove"
  ${EndIf}
  !insertmacro UpdateLingBuilderUserPath

  ; 尾部清扫：复制期间若有 AI 客户端复活了 MCP 宿主，再补杀一轮同名进程。
  !insertmacro StopLingBuilderProcesses
  ${If} $0 == 0
    DetailPrint "安装期间检测到 LingBuilder 进程被重新启动，已再次结束。"
  ${EndIf}

  ; 尾部自检：已安装核心文件必须与打包期期望尺寸一致，否则说明写入期间
  ; 文件仍被占用、发生了半更新。交互模式弹中文警告；静默模式以退出码 87
  ; 结束，杜绝「exit 0 假成功」。
  Call GetLingBuilderSelfCheck
  ${If} $LingBuilderSelfCheck == "ok"
    DetailPrint "安装自检通过：核心程序文件与安装包内容一致。"
    Goto lingBuilderSelfCheckEnd
  ${EndIf}
  IfSilent 0 lingBuilderSelfCheckBox
    DetailPrint "警告：核心程序文件未被本次安装成功覆盖（写入期间仍被外部进程占用），安装未完全生效。请退出 LingBuilder 及会自动重启其 MCP 宿主的 AI 客户端后重新运行安装器。"
    SetErrorLevel 87
    Goto lingBuilderSelfCheckEnd
  lingBuilderSelfCheckBox:
    MessageBox MB_ICONEXCLAMATION|MB_OK "安装未完全生效：核心程序文件在本次安装期间未能被覆盖（可能仍被外部进程占用）。请退出 LingBuilder 及会自动重启其 MCP 宿主的 AI 客户端后重新运行本安装器。"
  lingBuilderSelfCheckEnd:

  ; 完成页直接启动已安装的 EXE，避免 Windows 快捷方式关联异常阻止首次启动。
  StrCpy $launchLink "$appExe"
!macroend

!macro customUnInstall
  ; customUnInstall 在安装文件被删除前执行；PATH 移除为纯注册表操作，无子进程。
  StrCpy $R9 "remove"
  !insertmacro UpdateLingBuilderUserPath
!macroend
