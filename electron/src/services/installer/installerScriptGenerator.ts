import path from 'node:path';

/**
 * LingBuilder 安装包 NSIS 脚本生成器（纯函数，无文件系统访问）。
 *
 * 输入是构建产物清单（installer-build-manifest.json + bin 目录文件列表），
 * 输出可直接交给 makensis 编译的 .nsi 文本。脚本固定：
 * - Unicode true + MUI2 + 简体中文界面（中文优先原则）；
 * - 权限跟随项目构建属性（requireAdministrator → admin，否则 per-user 免 UAC）；
 * - 安装前检测旧主程序被占用（运行中进程锁文件是安装失败的常见根因）；
 * - 静态生成文件清单与卸载清单（确定性、可单测，不依赖运行期记录）。
 */

export const INSTALLER_NSI_SCHEMA_VERSION = 1;

export interface InstallerNsiPayloadFile {
  /** 相对 bin 目录的相对路径，统一 / 分隔。 */
  relativePath: string;
  /** makensis File 指令引用的绝对源路径。 */
  absolutePath: string;
  sizeBytes?: number;
}

/** 安装目录策略：auto 跟随构建属性（requireAdministrator），perMachine 强制全部用户，perUser 强制当前用户。 */
export type InstallerInstallMode = 'auto' | 'perMachine' | 'perUser';

export interface InstallerNsiSpec {
  appName: string;
  /** bin 目录中的主程序文件名，例如 我的项目.exe。 */
  exeFileName: string;
  /** 语义化版本（1.0 / 1.0.0 / 1.0.0.1 均可），生成时规范为 x.x.x.x。 */
  version: string;
  architecture: 'x64' | 'x86';
  requireAdministrator: boolean;
  /** 构建链使用 /MD 动态 CRT 时为 true，安装包会在日志与完成页提示运行库依赖。 */
  requiresDynamicCrt: boolean;
  files: InstallerNsiPayloadFile[];
  /** 输出安装包文件名（makensis 以脚本所在目录为工作目录，这里写相对文件名）。 */
  outputFileName: string;
  publisher?: string;
  /** 安装器/卸载器图标（.ico 绝对路径，与主程序 exe 同源）；缺省用 NSIS 默认图标。 */
  iconPath?: string;
  /** 捆绑 VC++ 运行库链式安装；仅 /MD 构建有意义，提供后安装段会检测并按需静默链装。 */
  bundleVcRedist?: { fileName: string; absolutePath: string; architecture: 'x64' | 'x86' };
  /** 安装目录策略；缺省 auto。 */
  installMode?: InstallerInstallMode;
}

export interface InstallerNsiResult {
  script: string;
  version: string;
  warnings: string[];
}

const NSIS_MAX_FILE_SIZE_FIELD = 65535;

/** NSIS 双引号字符串转义：$ → $$，" → $\"。 */
export function escapeNsisString(value: string): string {
  return value.replace(/\$/gu, '$$$$').replace(/"/gu, '$\\"');
}

/** 安装包内使用的显示名：去掉引号与换行，压缩空白。 */
export function sanitizeInstallerDisplayName(value: string, fallback = ''): string {
  const cleaned = value.replace(/["\r\n\t]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return cleaned || fallback;
}

/** 主程序/安装包文件名：只保留最后一段路径，去非法字符，确保带扩展名。 */
export function sanitizeInstallerFileName(value: string, fallbackBase: string, extension: '.exe'): string {
  const base = path.basename(value.replace(/[\\]/gu, '/')).replace(/["\r\n\t:*?<>|]/gu, '').trim();
  const withExt = base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
  return withExt !== extension ? withExt : `${fallbackBase}${extension}`;
}

/** 规范为 NSIS VIProductVersion 要求的 x.x.x.x（每段 0~65535）。 */
export function normalizeInstallerVersion(value: string, fallback = '1.0.0.0'): string {
  const parts = String(value || '').trim().split('.').map(part => {
    const numeric = Number.parseInt(part, 10);
    return Number.isFinite(numeric) && numeric >= 0 ? Math.min(numeric, NSIS_MAX_FILE_SIZE_FIELD) : 0;
  });
  while (parts.length < 4) parts.push(0);
  const clipped = parts.slice(0, 4);
  if (clipped.every(part => part === 0)) return fallback;
  return clipped.join('.');
}

function groupFilesByDirectory(files: InstallerNsiPayloadFile[]): Array<{ directory: string; files: InstallerNsiPayloadFile[] }> {
  const groups = new Map<string, InstallerNsiPayloadFile[]>();
  for (const file of files) {
    const normalized = file.relativePath.replace(/[\\/]+/gu, '/').replace(/^\/+/u, '');
    const directory = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
    const entry = { ...file, relativePath: normalized };
    const bucket = groups.get(directory);
    if (bucket) bucket.push(entry);
    else groups.set(directory, [entry]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([directory, groupFiles]) => ({
      directory,
      files: groupFiles.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0))
    }));
}

function toInstallRelativePath(relativePath: string): string {
  return relativePath.replace(/\//gu, '\\');
}

/**
 * 生成 .nsi 脚本文本。所有路径用绝对源路径 + /oname 安装相对路径，
 * makensis 以脚本所在目录为工作目录，OutFile 写相对文件名即可落在同目录。
 */
export function generateInstallerNsi(spec: InstallerNsiSpec): InstallerNsiResult {
  const warnings: string[] = [];
  const appName = sanitizeInstallerDisplayName(spec.appName || 'LingBuilder 应用', 'LingBuilder 应用');
  const publisher = sanitizeInstallerDisplayName(spec.publisher || appName, appName);
  const exeFileName = sanitizeInstallerFileName(spec.exeFileName || 'app.exe', 'app', '.exe');
  const outputFileName = sanitizeInstallerFileName(spec.outputFileName || 'setup.exe', 'setup', '.exe');
  const version = normalizeInstallerVersion(spec.version);
  if (String(spec.version || '').trim() && normalizeInstallerVersion(spec.version) !== String(spec.version).trim()) {
    warnings.push(`版本号「${spec.version}」已规范为 ${version}（NSIS 要求 x.x.x.x 四段数字）。`);
  }
  if (!Array.isArray(spec.files) || spec.files.length === 0) {
    throw new Error('安装包文件清单为空：构建输出目录没有可打包的文件。请先成功构建（F5 或「生成」）再导出安装包。');
  }

  const appDefine = escapeNsisString(appName);
  const publisherDefine = escapeNsisString(publisher);
  const exeDefine = escapeNsisString(exeFileName);
  const uninstallKey = `${appName} (${version})`;
  const uninstallKeyDefine = escapeNsisString(uninstallKey);
  const programFilesDir = spec.architecture === 'x64' ? '$PROGRAMFILES64' : '$PROGRAMFILES32';
  // 安装目录策略：perMachine 强制管理员+Program Files；perUser 强制当前用户+免提权；auto 跟随构建属性。
  const requestedMode: InstallerInstallMode = spec.installMode === 'perMachine' || spec.installMode === 'perUser'
    ? spec.installMode
    : 'auto';
  const installMode: InstallerInstallMode = requestedMode === 'auto'
    ? (spec.requireAdministrator ? 'perMachine' : 'perUser')
    : requestedMode;
  const adminInstall = installMode === 'perMachine';
  const installDir = adminInstall
    ? `InstallDir "${programFilesDir}\\${appDefine}"`
    : 'InstallDir "$LOCALAPPDATA\\Programs\\${APP_NAME}"';
  const executionLevel = adminInstall ? 'RequestExecutionLevel admin' : 'RequestExecutionLevel user';
  const regView = spec.architecture === 'x64' ? 'SetRegView 64' : 'SetRegView 32';
  const regRoot = adminInstall ? 'HKLM' : 'HKCU';
  const uninstallRegPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${UNINSTALL_KEY}';
  if (requestedMode !== 'auto' && installMode !== (spec.requireAdministrator ? 'perMachine' : 'perUser')) {
    warnings.push(`安装目录策略已按「${installMode === 'perMachine' ? '安装到所有用户（需管理员）' : '仅当前用户（免管理员）'}」执行，与项目构建属性的管理员设置不同步；程序自身的 UAC 行为由 exe 清单决定，不受安装器影响。`);
  }

  const lines: string[] = [];
  lines.push('; LingBuilder 安装包脚本（由 LingBuilder IDE 自动生成，请勿手工编辑；重新导出会整体覆盖）。');
  lines.push(`; 项目：${appName} · 版本 ${version} · ${spec.architecture.toUpperCase()} · ${adminInstall ? '管理员权限' : '当前用户权限'}${requestedMode !== 'auto' ? `（策略 ${requestedMode}）` : ''}`);
  lines.push('Unicode true');
  lines.push('!include "MUI2.nsh"');
  lines.push('');
  lines.push(`!define APP_NAME "${appDefine}"`);
  lines.push(`!define APP_EXE "${exeDefine}"`);
  lines.push(`!define APP_VERSION "${version}"`);
  lines.push(`!define APP_PUBLISHER "${publisherDefine}"`);
  lines.push(`!define UNINSTALL_KEY "${uninstallKeyDefine}"`);
  lines.push('');
  lines.push(`Name "${appDefine}"`);
  lines.push(`OutFile "${escapeNsisString(outputFileName)}"`);
  lines.push(executionLevel);
  lines.push(installDir);
  const iconPath = (spec.iconPath || '').trim();
  if (iconPath) {
    lines.push(`!define MUI_ICON "${escapeNsisString(iconPath)}"`);
    lines.push(`!define MUI_UNICON "${escapeNsisString(iconPath)}"`);
  }
  lines.push('ShowInstDetails show');
  lines.push('ShowUnInstDetails show');
  lines.push('');
  lines.push(`VIProductVersion "${version}"`);
  lines.push(`VIAddVersionKey "ProductName" "${appDefine}"`);
  lines.push(`VIAddVersionKey "FileDescription" "${appDefine} 安装程序"`);
  lines.push(`VIAddVersionKey "ProductVersion" "${version}"`);
  lines.push(`VIAddVersionKey "FileVersion" "${version}"`);
  lines.push(`VIAddVersionKey "LegalCopyright" "Copyright (C) ${publisherDefine}"`);
  lines.push(`VIAddVersionKey "OriginalFilename" "${escapeNsisString(outputFileName)}"`);
  lines.push('');
  lines.push('!define MUI_ABORTWARNING');
  lines.push('!insertmacro MUI_PAGE_WELCOME');
  lines.push('!insertmacro MUI_PAGE_DIRECTORY');
  lines.push('!insertmacro MUI_PAGE_INSTFILES');
  lines.push('!insertmacro MUI_PAGE_FINISH');
  lines.push('!insertmacro MUI_UNPAGE_CONFIRM');
  lines.push('!insertmacro MUI_UNPAGE_INSTFILES');
  lines.push('!insertmacro MUI_LANGUAGE "SimpChinese"');
  lines.push('');
  lines.push('Section "Install" SecInstall');
  lines.push('  SetOutPath "$INSTDIR"');
  // 旧进程占用检测：尝试删除旧主程序，被占用说明程序仍在运行。
  lines.push('  check_running:');
  lines.push('  IfFileExists "$INSTDIR\\${APP_EXE}" 0 done_running');
  lines.push('  ClearErrors');
  lines.push('  Delete "$INSTDIR\\${APP_EXE}"');
  lines.push('  IfErrors 0 done_running');
  lines.push(`  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "检测到「$\\r$\\n${appDefine}$\\r$\\n」可能正在运行，无法覆盖安装。$\\r$\\n$\\r$\\n请先退出程序，再点「重试」继续安装。" IDRETRY check_running`);
  lines.push('  Abort');
  lines.push('  done_running:');
  lines.push('');

  const groups = groupFilesByDirectory(spec.files);
  for (const group of groups) {
    if (group.directory) {
      lines.push(`  SetOutPath "$INSTDIR\\${escapeNsisString(toInstallRelativePath(group.directory))}"`);
    }
    for (const file of group.files) {
      lines.push(`  File "/oname=${escapeNsisString(toInstallRelativePath(path.basename(file.relativePath)))}" "${escapeNsisString(file.absolutePath)}"`);
    }
    lines.push('');
  }

  if (spec.bundleVcRedist) {
    const redistDefine = escapeNsisString(spec.bundleVcRedist.fileName);
    const runtimeKey = spec.bundleVcRedist.architecture === 'x64'
      ? 'SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64'
      : 'SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x86';
    lines.push(`  File "/oname=${redistDefine}" "${escapeNsisString(spec.bundleVcRedist.absolutePath)}"`);
    lines.push('  ; VC++ 运行库检测与按需链式安装（已装则跳过；装完即删包）');
    lines.push('  StrCpy $0 0');
    lines.push(`  ReadRegDWORD $0 HKLM "${runtimeKey}" "Installed"`);
    lines.push('  IntCmpU $0 1 vc_redist_done vc_redist_install vc_redist_done');
    lines.push('  vc_redist_install:');
    lines.push('  DetailPrint "正在安装 VC++ 运行库，请稍候..."');
    lines.push(`  ExecWait '"$INSTDIR\\${redistDefine}" /install /quiet /norestart' $0`);
    lines.push('  IntCmpU $0 0 vc_redist_ok vc_redist_warn vc_redist_maybe_reboot');
    lines.push('  vc_redist_maybe_reboot:');
    lines.push('  IntCmpU $0 3010 vc_redist_reboot vc_redist_warn vc_redist_warn');
    lines.push('  vc_redist_reboot:');
    lines.push('  DetailPrint "VC++ 运行库安装完成，需要重启系统后生效。"');
    lines.push('  Goto vc_redist_delete');
    lines.push('  vc_redist_ok:');
    lines.push('  DetailPrint "VC++ 运行库安装完成。"');
    lines.push('  Goto vc_redist_delete');
    lines.push('  vc_redist_warn:');
    lines.push('  DetailPrint "VC++ 运行库链式安装未成功（退出代码 $0）。若程序启动提示缺少 VCRUNTIME140.dll，请以管理员身份手动运行安装目录下的 vc_redist 安装包。"');
    lines.push('  vc_redist_delete:');
    lines.push(`  Delete "$INSTDIR\\${redistDefine}"`);
    lines.push('  vc_redist_done:');
    lines.push('');
  }

  lines.push('  ; 开始菜单快捷方式与卸载入口');
  lines.push('  CreateDirectory "$SMPROGRAMS\\${APP_NAME}"');
  lines.push('  CreateShortcut "$SMPROGRAMS\\${APP_NAME}\\${APP_NAME}.lnk" "$INSTDIR\\${APP_EXE}"');
  lines.push('  CreateShortcut "$SMPROGRAMS\\${APP_NAME}\\卸载 ${APP_NAME}.lnk" "$INSTDIR\\Uninstall.exe"');
  lines.push('  WriteUninstaller "$INSTDIR\\Uninstall.exe"');
  lines.push(`  ${regView}`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "DisplayName" "${appDefine}"`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "DisplayVersion" "${version}"`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "Publisher" "${publisherDefine}"`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "DisplayIcon" "$INSTDIR\\${exeDefine}"`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "InstallLocation" "$INSTDIR"`);
  lines.push(`  WriteRegStr ${regRoot} "${uninstallRegPath}" "UninstallString" "$INSTDIR\\Uninstall.exe"`);
  lines.push(`  WriteRegDWORD ${regRoot} "${uninstallRegPath}" "NoModify" 1`);
  lines.push(`  WriteRegDWORD ${regRoot} "${uninstallRegPath}" "NoRepair" 1`);
  if (spec.requiresDynamicCrt && !spec.bundleVcRedist) {
    lines.push('  DetailPrint "提示：本程序使用动态 CRT（/MD）构建，目标机器需要 VC++ 运行库；若启动报缺少 VCRUNTIME140.dll，请安装 vc_redist.x64.exe。"');
    warnings.push('构建使用 /MD 动态 CRT：目标机器需要 VC++ 运行库（安装包完成页会提示；导出时勾选「捆绑 VC++ 运行库」可自动链式安装）。');
  }
  lines.push('SectionEnd');
  lines.push('');
  lines.push('Section Uninstall');
  lines.push(`  ${regView}`);
  lines.push(`  DeleteRegKey ${regRoot} "${uninstallRegPath}"`);
  lines.push('  Delete "$SMPROGRAMS\\${APP_NAME}\\${APP_NAME}.lnk"');
  lines.push('  Delete "$SMPROGRAMS\\${APP_NAME}\\卸载 ${APP_NAME}.lnk"');
  lines.push('  RMDir "$SMPROGRAMS\\${APP_NAME}"');
  lines.push('  check_uninstall_running:');
  lines.push('  IfFileExists "$INSTDIR\\${APP_EXE}" 0 done_uninstall_running');
  lines.push('  ClearErrors');
  lines.push('  Delete "$INSTDIR\\${APP_EXE}"');
  lines.push('  IfErrors 0 done_uninstall_running');
  lines.push(`  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "「${appDefine}」仍在运行，无法删除。请先退出程序再点「重试」。" IDRETRY check_uninstall_running`);
  lines.push('  Abort');
  lines.push('  done_uninstall_running:');
  for (const group of groups) {
    for (const file of group.files) {
      if (path.win32.basename(file.relativePath) === 'Uninstall.exe') continue;
      lines.push(`  Delete "$INSTDIR\\${escapeNsisString(toInstallRelativePath(file.relativePath))}"`);
    }
  }
  const directoriesDeepestFirst = groups.map(group => group.directory).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const directory of directoriesDeepestFirst) {
    lines.push(`  RMDir "$INSTDIR\\${escapeNsisString(toInstallRelativePath(directory))}"`);
  }
  lines.push('  Delete "$INSTDIR\\Uninstall.exe"');
  lines.push('  RMDir "$INSTDIR"');
  lines.push('SectionEnd');
  lines.push('');

  return { script: lines.join('\r\n'), version, warnings };
}
