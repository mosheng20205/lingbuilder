import { LingControl, LingDesignerResource, LingFileDialogResource, LingPropertySheetResource, LingToolTipResource, LingWindowModel, LingWindowProject } from './types';
import { getLingWindowSourceFileName } from './windowDesignerService';
import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import {
  LingCppAst,
  LingCppClass,
  LingCppMethod,
  LingCppNativeSourceMapEntry,
  LingCppParameter,
  LingCppProgram,
  LingCppStatement
} from '../lingCpp/types';
import { InstalledModule } from '../modules/types';
import { BUILTIN_LIBRARY_COMMON_RUNTIME, generateStandardLibraryRuntime } from './standardLibraryRuntime';
import { generateSystemLibraryRuntime } from './systemLibraryRuntime';
import { generateNetworkLibraryRuntime } from './networkLibraryRuntime';
import { generateDataMediaRuntime } from './dataMediaRuntime';
import { generatePlatformAdvancedRuntime } from './platformAdvancedRuntime';
import { getPreferredModuleTarget, getUnsupportedModuleTargetDiagnostic } from '../modules/targetResolver';
import { getWin32ControlDefinition, WIN32_CONTROL_DEFINITIONS } from './win32ControlRegistry';
import { getWindowEventHandlerName } from './windowEventRegistry';
import {
  getNewEmojiUnsupportedControlDiagnostics,
  isNewEmojiDesignerControlSupported,
  NEW_EMOJI_MODULE_ID
} from './newEmojiDesignerAdapter';
import { getEffectiveControlState } from './controlHierarchy';
import { normalizeControlFont } from './controlFont';
import {
  parseEplControlMemberAssignmentRule,
  parseEplControlMemberRule,
  parseEplControlMethodCallRule,
  splitEplBinaryExpression
} from './eplToCppRules';

export interface LingCppNativeProjectFile {
  relativePath: string;
  content: string;
}

export interface GeneratedLingCppNativeProject {
  files: LingCppNativeProjectFile[];
  selectedWindow: LingWindowModel;
  diagnostics: string[];
  sourceMap: LingCppNativeSourceMapEntry[];
}

export interface GenerateLingCppNativeWin32ProjectOptions {
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  enabledModules?: InstalledModule[];
}

interface GeneratedWindowClassBlock {
  code: string;
  sourceMap: LingCppNativeSourceMapEntry[];
}

interface TranslatedStatementLine {
  code: string;
  sourceStartLine: number;
  sourceEndLine: number;
  kind: 'statement' | 'native-cpp';
}

interface OpenWindowCommand {
  target: string;
  placement?: string;
  x?: number;
  y?: number;
  hasCustomPosition?: boolean;
}

const TITLE_BAR_HEIGHT = 28;

export function generateLingCppNativeWin32Project(
  project: LingWindowProject,
  options: GenerateLingCppNativeWin32ProjectOptions = {}
): GeneratedLingCppNativeProject {
  const sourceCode = options.lingCppSourceCode || '';
  const parseResult = parseLingCpp(sourceCode);
  const selectedWindow = resolveNativeWindowForSource(project, options, parseResult.program);
  const enabledModules = options.enabledModules || [];
  const sourceFilePath = options.lingCppSourceFilePath || getLingWindowSourceFileName(selectedWindow.fileName, selectedWindow.className);
  const usesNewEmojiDesigner = enabledModules.some(module => module.manifest.id === NEW_EMOJI_MODULE_ID);
  const mainCppContent = usesNewEmojiDesigner
    ? generateNewEmojiMainCpp(selectedWindow, parseResult.ast.program, enabledModules)
    : generateMainCpp(project, selectedWindow, parseResult.ast, enabledModules);
  const sourceMap = generateLingCppNativeSourceMap(mainCppContent, project, parseResult.program, sourceFilePath);
  const manifestContent = generateNativeManifest(project, selectedWindow, enabledModules, sourceFilePath, sourceMap);
  const moduleTargetDiagnostics = enabledModules
    .filter(module => !module.isBuiltin)
    .map(module => getUnsupportedModuleTargetDiagnostic(module))
    .filter((diagnostic): diagnostic is string => Boolean(diagnostic));
  const enabledModuleIds = new Set(enabledModules.map(module => module.manifest.id));
  const missingControlModuleDiagnostics = project.windows.flatMap(window => window.controls.flatMap(control => {
    const definition = getWin32ControlDefinition(control.type);
    if (!definition || definition.moduleId === 'lingbuilder.win32.basic' || enabledModuleIds.has(definition.moduleId)) return [];
    return [`窗口“${window.title}”中的控件“${control.name}”需要启用模块 ${definition.moduleId}；控件已保留，未静默降级。`];
  }));
  const resourceDiagnostics = validateDesignerResources(project);
  const requestedWindow = project.windows.find(window => window.id === options.activeWindowId);
  const sourceWindowSelectionDiagnostic = requestedWindow && requestedWindow.id !== selectedWindow.id
    ? [`活动源码属于窗口“${selectedWindow.title}”，已忽略过期的设计器窗口“${requestedWindow.title}”。`]
    : [];
  const sourceClassNames = new Set(parseResult.program.classes.map(item => item.name));
  const sourceClassMismatchDiagnostic = sourceCode.trim() && !sourceClassNames.has(selectedWindow.className)
    ? [`当前源码未定义设计器窗口类“${selectedWindow.className}”；请同步窗口类名与 .lcpp 文件后再构建。`]
    : [];
  const newEmojiFontStyleDiagnostics = usesNewEmojiDesigner
    ? selectedWindow.controls
      .filter(control => control.fontBold === true || control.fontItalic === true || control.fontUnderline === true)
      .map(control => `new_emoji 控件“${control.name}”已保留粗体/斜体/下划线属性，但当前 DLL 通用字体 API 仅支持字体名称和字号。`)
    : [];
  const customIconDiagnostics = project.windows.flatMap(window => {
    if (window.iconStyle !== 'custom') return [];
    if (!window.iconPath?.trim()) return [`窗口“${window.title}”选择了自定义图标，但尚未指定 ICO 文件。`];
    if (!getSafeCustomWindowIconPath(window)) return [`窗口“${window.title}”的自定义图标必须是项目 assets 目录内的相对 ICO 路径：${window.iconPath}`];
    return [];
  });
  const legacyUploadDiagnostics = project.windows.flatMap(window => window.controls
    .filter(control => control.type === 'Upload' || control.type === 'DragUpload')
    .map(control => `窗口“${window.title}”仍包含已从 Win32 工具箱移除的旧上传控件“${control.name}”；当前继续兼容生成，请改用非可视“文件对话框”绑定现有按钮或拖放目标。`));

  return {
    selectedWindow,
    diagnostics: [
      ...parseResult.diagnostics.map(diagnostic => `第 ${diagnostic.line} 行：${diagnostic.message}`),
      ...sourceWindowSelectionDiagnostic,
      ...sourceClassMismatchDiagnostic,
      ...moduleTargetDiagnostics,
      ...missingControlModuleDiagnostics,
      ...(usesNewEmojiDesigner ? getNewEmojiUnsupportedControlDiagnostics(selectedWindow) : []),
      ...newEmojiFontStyleDiagnostics,
      ...customIconDiagnostics,
      ...legacyUploadDiagnostics,
      ...resourceDiagnostics
    ],
    sourceMap,
    files: [
      {
        relativePath: 'main.cpp',
        content: mainCppContent
      },
      {
        relativePath: 'layout.json',
        content: JSON.stringify(project, null, 2)
      },
      {
        relativePath: 'module-dependencies.txt',
        content: generateModuleDependencyReport(enabledModules)
      },
      {
        relativePath: 'README.txt',
        content: [
          'LingBuilder Chinese C++ Win32 project',
          '',
          `Project: ${project.name}`,
          `Selected window: ${selectedWindow.title}`,
          `Window count: ${project.windows.length}`,
          '',
          'This folder is generated from .lcpp source and the visual designer model.',
          'The generated main.cpp uses C++ classes for windows and dispatches UI events to class methods.'
        ].join('\n')
      },
      {
        relativePath: 'lingbuilder-native-manifest.json',
        content: manifestContent
      }
    ]
  };
}

function generateNewEmojiMainCpp(
  window: LingWindowModel,
  program: LingCppProgram,
  enabledModules: InstalledModule[]
): string {
  const controls = orderNewEmojiControls(window.controls
    .filter(control => (
      getEffectiveControlState(window.controls, control.id).visible
      && isNewEmojiDesignerControlSupported(control.type)
    ))
    .map(control => ({
      ...control,
      isEnabled: getEffectiveControlState(window.controls, control.id).enabled
    })));
  const variables = new Map(controls.map((control, index) => [control.id, `ne_element_${index + 1}`]));
  const uploadCallbacks = new Map<string, { select?: string; action?: string }>();
  const uploadCallbackBlocks: string[] = [];
  controls.forEach((control, index) => {
    if (control.type !== 'Upload' && control.type !== 'DragUpload') return;
    const selectHandler = control.events?.FilesSelected?.trim();
    const actionHandler = control.events?.UploadAction?.trim();
    const selectMethod = selectHandler ? findLingCppMethod(program, selectHandler) : undefined;
    const actionMethod = actionHandler ? findLingCppMethod(program, actionHandler) : undefined;
    const callbacks: { select?: string; action?: string } = {};
    if (selectMethod) {
      callbacks.select = `LB_UploadSelect_${index + 1}`;
      uploadCallbackBlocks.push(`static void __stdcall ${callbacks.select}(int, const unsigned char*, int) {\n${translateMethodStatements(selectMethod, enabledModules).replace(/^ {8}/gmu, '    ')}\n}`);
    }
    if (actionMethod) {
      callbacks.action = `LB_UploadAction_${index + 1}`;
      uploadCallbackBlocks.push(`static void __stdcall ${callbacks.action}(int, int, int, int) {\n${translateMethodStatements(actionMethod, enabledModules).replace(/^ {8}/gmu, '    ')}\n}`);
    }
    uploadCallbacks.set(control.id, callbacks);
  });
  const createLines = controls.flatMap(control => {
    const variable = variables.get(control.id)!;
    const parent = control.parentId ? window.controls.find(item => item.id === control.parentId) : undefined;
    const parentVariable = parent ? variables.get(parent.id) || '0' : '0';
    const x = parent ? control.x - parent.x : control.x;
    const y = parent ? control.y - parent.y : control.y;
    const text = `L"${escapeWideString(control.content)}"`;
    const font = normalizeControlFont(control);
    const checked = control.properties?.checked === true ? 1 : 0;
    const progress = parseControlValue(control);
    let call: string;
    const extraLines: string[] = [];
    switch (control.type) {
      case 'Button':
        call = `NE_创建按钮(g_newEmojiWindow, ${parentVariable}, L"", ${text}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'TextBox':
        call = `NE_创建编辑框(g_newEmojiWindow, ${parentVariable}, ${text}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'Label':
        call = `NE_创建文本(g_newEmojiWindow, ${parentVariable}, ${text}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'CheckBox':
        call = `NE_创建复选框(g_newEmojiWindow, ${parentVariable}, ${text}, ${checked}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'RadioButton':
        call = `NE_创建单选框(g_newEmojiWindow, ${parentVariable}, ${text}, ${checked}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'ListBox': {
        const rawItems = Array.isArray(control.properties?.items) ? control.properties.items : [];
        const itemLabels = rawItems.map(item => typeof item === 'string'
          ? item
          : String((item as Record<string, unknown>)?.title ?? (item as Record<string, unknown>)?.label ?? (item as Record<string, unknown>)?.text ?? ''));
        const items = control.properties?.sorted === true ? [...itemLabels].sort((left, right) => left.localeCompare(right, 'zh-CN')) : itemLabels;
        const itemSpec = `L"${escapeWideString(items.join('|'))}"`;
        const selectedIndex = numericControlProperty(control, 'selectedIndex', items.length > 0 ? 0 : -1);
        call = `NE_创建列表框(g_newEmojiWindow, ${parentVariable}, ${text}, ${itemSpec}, ${selectedIndex}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      }
      case 'Image': {
        const source = typeof control.properties?.imageSource === 'string' ? control.properties.imageSource : '';
        const stretch = typeof control.properties?.stretch === 'string' ? control.properties.stretch : 'uniform';
        const fit = stretch === 'uniformToFill' ? 1 : stretch === 'fill' ? 2 : stretch === 'none' ? 3 : 0;
        call = `NE_创建图片(g_newEmojiWindow, ${parentVariable}, L"${escapeWideString(source)}", ${text}, ${fit}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      }
      case 'ProgressBar':
        call = `NE_创建进度条(g_newEmojiWindow, ${parentVariable}, ${text}, ${progress}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'Grid':
        call = `NE_创建容器(g_newEmojiWindow, ${parentVariable}, ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        break;
      case 'Upload':
      case 'DragUpload': {
        const tip = String(control.properties?.tip || (control.type === 'DragUpload' ? '将文件拖到此处，或点击选择文件' : '支持点击选择文件'));
        const initialFiles = Array.isArray(control.properties?.initialFiles)
          ? control.properties.initialFiles.map(item => String(item)).join('|')
          : '';
        const multiple = control.properties?.multiple === false ? 0 : 1;
        const autoUpload = control.properties?.autoUpload === true ? 1 : 0;
        const styleMode = numericControlProperty(control, 'styleMode', control.type === 'DragUpload' ? 5 : 0);
        const showFileList = control.properties?.showFileList === false ? 0 : 1;
        const showTip = control.properties?.showTip === false ? 0 : 1;
        const showActions = control.properties?.showActions === false ? 0 : 1;
        const dropEnabled = control.type === 'DragUpload' || control.properties?.dropEnabled === true ? 1 : 0;
        const limit = numericControlProperty(control, 'limit', 0);
        const maxSizeKb = numericControlProperty(control, 'maxSizeKb', 0);
        const accept = String(control.properties?.accept || '*.*');
        call = `NE_创建上传(g_newEmojiWindow, ${parentVariable}, ${text}, L"${escapeWideString(tip)}", L"${escapeWideString(initialFiles)}", ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)})`;
        extraLines.push(`    NE_设置上传选项(g_newEmojiWindow, ${variable}, ${multiple}, ${autoUpload}, ${styleMode}, ${showFileList}, ${showTip}, ${showActions}, ${dropEnabled}, ${limit}, ${maxSizeKb}, L"${escapeWideString(accept)}");`);
        const callbacks = uploadCallbacks.get(control.id);
        if (callbacks?.select || callbacks?.action) {
          extraLines.push(`    NE_设置上传事件(g_newEmojiWindow, ${variable}, ${callbacks.select || 'nullptr'}, ${callbacks.action || 'nullptr'});`);
        }
        break;
      }
      default:
        return [];
    }
    return [
      `    int ${variable} = ${call};`,
      `    NE_设置元素状态(g_newEmojiWindow, ${variable}, 1, ${control.isEnabled ? 1 : 0}, ${toNewEmojiColor(control.background, 0x00000000)}, ${toNewEmojiColor(control.foreground, 0xfff8fafc)});`,
      `    NE_设置元素字体(g_newEmojiWindow, ${variable}, L"${escapeWideString(font.family)}", ${font.size});`,
      ...extraLines
    ];
  });
  const createdHandler = findWindowCreatedHandler(window, program);
  const createdMethod = createdHandler ? findLingCppMethod(program, createdHandler) : undefined;
  const createdBody = createdMethod
    ? translateMethodStatements(createdMethod, enabledModules).replace(/^ {8}/gmu, '    ')
    : '    调试输出(L"new_emoji 窗口创建完毕");';
  const darkWindow = isDarkBackground(window.background);
  const createWindow = darkWindow ? 'NE_创建深色窗口' : 'NE_创建窗口';
  const modulePreamble = generateModuleCppPreamble(enabledModules);
  const iconPath = getSafeCustomWindowIconPath(window);
  const iconSetup = window.iconStyle === 'none'
    ? `    SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_BIG, 0);\n    SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_SMALL, 0);`
    : window.iconStyle === 'system'
      ? `    SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(LoadIconW(nullptr, IDI_APPLICATION)));\n    SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(LoadIconW(nullptr, IDI_APPLICATION)));`
      : iconPath
        ? `    HICON customLargeIcon = reinterpret_cast<HICON>(LoadImageW(nullptr, L"${escapeWideString(iconPath)}", IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));\n    HICON customSmallIcon = reinterpret_cast<HICON>(LoadImageW(nullptr, L"${escapeWideString(iconPath)}", IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));\n    if (customLargeIcon) SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(customLargeIcon));\n    if (customSmallIcon) SendMessageW(g_newEmojiWindow, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(customSmallIcon));`
        : '';
  const iconCleanup = iconPath
    ? `    if (customLargeIcon) DestroyIcon(customLargeIcon);\n    if (customSmallIcon && customSmallIcon != customLargeIcon) DestroyIcon(customSmallIcon);`
    : '';

  return `#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <sstream>
#include <string>
#include "new_emoji_bridge.h"
${modulePreamble}

static HWND g_newEmojiWindow = nullptr;

static void 写入调试输出(const wchar_t* message) {
    OutputDebugStringW(message ? message : L"");
    OutputDebugStringW(L"\\r\\n");
}

static void 追加调试参数(std::wstring& output, bool value) { output += value ? L"真" : L"假"; }
static void 追加调试参数(std::wstring& output, const wchar_t* value) { output += value ? value : L"(空)"; }
static void 追加调试参数(std::wstring& output, const std::wstring& value) { output += value; }
template <typename T> static void 追加调试参数(std::wstring& output, const T& value) {
    std::wostringstream stream;
    stream << value;
    output += stream.str();
}
template <typename... Args> static void 调试输出(const Args&... args) {
    std::wstring output;
    bool first = true;
    auto append = [&](const auto& value) {
        if (!first) output += L", ";
        first = false;
        追加调试参数(output, value);
    };
    (append(args), ...);
    写入调试输出(output.c_str());
}

static int 信息框(const wchar_t* text, UINT flags = MB_OK, const wchar_t* title = L"LingBuilder") {
    return MessageBoxW(g_newEmojiWindow, text ? text : L"", title ? title : L"LingBuilder", flags);
}

static void 结束() {
    if (g_newEmojiWindow) {
        NE_销毁窗口(g_newEmojiWindow);
        g_newEmojiWindow = nullptr;
    }
}

${uploadCallbackBlocks.join('\n\n')}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    SetProcessDPIAware();
    g_newEmojiWindow = ${createWindow}(L"${escapeWideString(window.title)}", ${window.openPlacement === 'custom' ? int(window.openX ?? 120) : 120}, ${window.openPlacement === 'custom' ? int(window.openY ?? 80) : 80}, ${Math.max(360, int(window.width))}, ${Math.max(220, int(window.height))});
    if (!g_newEmojiWindow) {
        MessageBoxW(nullptr, L"new_emoji 原生窗口创建失败，请确认 new_emoji.dll 与 exe 位于同一目录。", L"LingBuilder 构建错误", MB_OK | MB_ICONERROR);
        return 2;
    }
${iconSetup}
${createLines.join('\n')}
${createdBody}
    if (!g_newEmojiWindow) return 0;
    int exitCode = NE_运行消息循环();
${iconCleanup}
    return exitCode;
}
`;
}

function orderNewEmojiControls(controls: LingControl[]): LingControl[] {
  const byId = new Map(controls.map(control => [control.id, control]));
  const ordered: LingControl[] = [];
  const visited = new Set<string>();
  const visit = (control: LingControl) => {
    if (visited.has(control.id)) return;
    const parent = control.parentId ? byId.get(control.parentId) : undefined;
    if (parent) visit(parent);
    visited.add(control.id);
    ordered.push(control);
  };
  controls.forEach(visit);
  return ordered;
}

function toNewEmojiColor(value: string, fallback: number): string {
  if (value === 'transparent') return '0x00000000u';
  const match = value.match(/^#([0-9a-f]{6})$/iu);
  if (!match) return `0x${fallback.toString(16).padStart(8, '0')}u`;
  return `0xFF${match[1]!.toUpperCase()}u`;
}

function isDarkBackground(value: string): boolean {
  const match = value.match(/^#([0-9a-f]{6})$/iu);
  if (!match) return true;
  const rgb = Number.parseInt(match[1]!, 16);
  const red = (rgb >> 16) & 0xff;
  const green = (rgb >> 8) & 0xff;
  const blue = rgb & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
}

function getSafeCustomWindowIconPath(window: LingWindowModel): string {
  if (window.iconStyle !== 'custom') return '';
  const normalized = window.iconPath?.trim().replace(/\\/gu, '/') || '';
  if (!normalized.toLowerCase().endsWith('.ico')) return '';
  if (!normalized.startsWith('assets/') || normalized.split('/').includes('..')) return '';
  if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(normalized)) return '';
  return normalized;
}

function resolveNativeWindowForSource(
  project: LingWindowProject,
  options: GenerateLingCppNativeWin32ProjectOptions,
  program: LingCppProgram
): LingWindowModel {
  const normalizedSourceName = options.lingCppSourceFilePath
    ?.replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.toLocaleLowerCase();
  if (normalizedSourceName) {
    const fileMatchedWindow = project.windows.find(window =>
      getLingWindowSourceFileName(window.fileName, window.className).toLocaleLowerCase() === normalizedSourceName
    );
    if (fileMatchedWindow) return fileMatchedWindow;
  }

  const classNames = new Set(program.classes.map(item => item.name));
  const classMatchedWindows = project.windows.filter(window => classNames.has(window.className));
  if (classMatchedWindows.length === 1) return classMatchedWindows[0];

  return project.windows.find(window => window.id === options.activeWindowId) || project.windows[0];
}

function validateDesignerResources(project: LingWindowProject): string[] {
  const diagnostics: string[] = [];
  const resources = project.resources || [];
  const ids = new Set<string>();
  const imageListIds = new Set<string>();
  const controlIds = new Set(project.windows.flatMap(window => window.controls.map(control => control.id)));
  const windowIds = new Set(project.windows.map(window => window.id));
  for (const resource of resources) {
    if (!resource.id.trim()) diagnostics.push('设计器资源 ID 不能为空。');
    else if (ids.has(resource.id)) diagnostics.push(`设计器资源 ID“${resource.id}”重复。`);
    ids.add(resource.id);
    if (resource.type === 'ImageList') {
      imageListIds.add(resource.id);
      if (resource.imageWidth < 1 || resource.imageHeight < 1) diagnostics.push(`图像列表“${resource.name}”的图片尺寸必须大于 0。`);
      for (const image of resource.images) {
        const normalized = image.replace(/\\/g, '/');
        if (/^(?:[a-zA-Z]:\/|\/|\\\\)/.test(image) || normalized.split('/').includes('..')) diagnostics.push(`图像列表“${resource.name}”包含不安全资源路径“${image}”，仅允许工作区内相对路径。`);
      }
    } else if (resource.type === 'ToolTip' && resource.targetControlId && !controlIds.has(resource.targetControlId)) {
      diagnostics.push(`工具提示“${resource.name}”引用了不存在的目标控件“${resource.targetControlId}”。`);
    } else if (resource.type === 'PropertySheet') {
      if (resource.pages.length === 0) diagnostics.push(`属性页“${resource.name}”至少需要一个页面。`);
      const pageIds = new Set<string>();
      for (const page of resource.pages) {
        if (!page.id.trim() || pageIds.has(page.id)) diagnostics.push(`属性页“${resource.name}”包含空白或重复的页面 ID“${page.id}”。`);
        if (page.sourceWindowId && !windowIds.has(page.sourceWindowId)) diagnostics.push(`属性页“${resource.name}”的页面“${page.title}”引用了不存在的模板窗口“${page.sourceWindowId}”。`);
        pageIds.add(page.id);
      }
    } else if (resource.type === 'FileDialog') {
      const owner = project.windows.find(window => window.id === resource.ownerWindowId);
      if (!owner) diagnostics.push(`文件对话框“${resource.name}”引用了不存在的所属窗口“${resource.ownerWindowId}”。`);
      if (resource.triggerControlId && !owner?.controls.some(control => control.id === resource.triggerControlId)) diagnostics.push(`文件对话框“${resource.name}”引用了不存在的打开触发控件“${resource.triggerControlId}”。`);
      if (resource.dropTargetId && resource.dropTargetId !== resource.ownerWindowId && !owner?.controls.some(control => control.id === resource.dropTargetId)) diagnostics.push(`文件对话框“${resource.name}”引用了不存在的拖放目标“${resource.dropTargetId}”。`);
      if (resource.allowDrop && !resource.dropTargetId) diagnostics.push(`文件对话框“${resource.name}”已允许拖拽，但尚未绑定拖放目标。`);
    }
  }
  for (const window of project.windows) {
    for (const control of window.controls) {
      const imageListId = control.properties?.imageListId;
      if (typeof imageListId === 'string' && imageListId && !imageListIds.has(imageListId)) {
        diagnostics.push(`窗口“${window.title}”中的控件“${control.name}”引用了不存在的图像列表“${imageListId}”。`);
      }
    }
  }
  return diagnostics;
}

function generateMainCpp(
  project: LingWindowProject,
  selectedWindow: LingWindowModel,
  ast: LingCppAst,
  enabledModules: InstalledModule[] = []
): string {
  const program = ast.program;
  const selectedWindowIndex = Math.max(0, project.windows.findIndex(window => window.id === selectedWindow.id));
  const controlArrays = project.windows
    .map((window, index) => generateControlArray(window, index, program, project.resources || []))
    .join('\n\n');
  const imageListSpecs = generateImageListSpecs(project);
  const propertySheetSpecs = generatePropertySheetSpecs(project);
  const fileDialogSpecs = generateFileDialogSpecs(project);
  const windowSpecs = project.windows
    .map((window, index) => generateWindowSpec(window, index, program))
    .join(',\n');
  const classDefinitions = project.windows
    .map((window, index) => generateWindowClass(window, index, program, enabledModules, project.resources || []))
    .join('\n\n');
  const factoryCases = project.windows
    .map((window, index) => `    case ${index}: return new ${toCppIdentifier(window.className)}(g_windows[${index}]);`)
    .join('\n');
  const moduleCppPreamble = generateModuleCppPreamble(enabledModules);
  const builtinLibraryFragments = [
    generateStandardLibraryRuntime(enabledModules),
    generateSystemLibraryRuntime(enabledModules),
    generateNetworkLibraryRuntime(enabledModules),
    generateDataMediaRuntime(enabledModules),
    generatePlatformAdvancedRuntime(enabledModules)
  ].filter(Boolean);
  const builtinLibraryRuntime = builtinLibraryFragments.length > 0
    ? `${BUILTIN_LIBRARY_COMMON_RUNTIME}\n${builtinLibraryFragments.join('\n')}`
    : '';
  const moduleFeatureDefines = enabledModules.some(module => module.manifest.id === 'lingbuilder.edgeview')
    ? '#ifndef LINGBUILDER_EDGEVIEW_MODULE\n#define LINGBUILDER_EDGEVIEW_MODULE\n#endif'
    : '';

  return `#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
${moduleFeatureDefines}

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winternl.h>
#include <commctrl.h>
#include <commdlg.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <richedit.h>
#include <wincodec.h>
#include <gdiplus.h>
#include <winhttp.h>
#include <wininet.h>
#include <wincrypt.h>
#include <bcrypt.h>
#include <sql.h>
#include <sqlext.h>
#include <mmsystem.h>
#include <oleacc.h>
#include <intrin.h>
#if defined(LINGBUILDER_EDGEVIEW_MODULE) && __has_include(<WebView2.h>)
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>
#include <wrl.h>
#define LINGBUILDER_EDGEVIEW_AVAILABLE 1
#else
#define LINGBUILDER_EDGEVIEW_AVAILABLE 0
#endif
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <ctime>
#include <cstring>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <random>
#include <regex>
#include <sstream>
#include <map>
#include <string>
#include <thread>
#include <mutex>
#include <memory>
#include <unordered_map>
#include <vector>

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "windowscodecs.lib")
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "odbc32.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "oleacc.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(linker, "/manifestdependency:\\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\\"")
${moduleCppPreamble}

static Gdiplus::Color ToGdiPlusColor(COLORREF color) {
    return Gdiplus::Color(255, GetRValue(color), GetGValue(color), GetBValue(color));
}

static void AddRoundedRectanglePath(Gdiplus::GraphicsPath& path, const Gdiplus::RectF& rect, float radius) {
    float safeRadius = std::max(0.0f, std::min(radius, std::min(rect.Width, rect.Height) / 2.0f));
    if (safeRadius <= 0.0f) { path.AddRectangle(rect); return; }
    float diameter = safeRadius * 2.0f;
    path.AddArc(rect.X, rect.Y, diameter, diameter, 180.0f, 90.0f);
    path.AddArc(rect.GetRight() - diameter, rect.Y, diameter, diameter, 270.0f, 90.0f);
    path.AddArc(rect.GetRight() - diameter, rect.GetBottom() - diameter, diameter, diameter, 0.0f, 90.0f);
    path.AddArc(rect.X, rect.GetBottom() - diameter, diameter, diameter, 90.0f, 90.0f);
    path.CloseFigure();
}

static bool DrawAntiAliasedRoundedRectangle(HDC hdc, const RECT& rect, int radius, COLORREF fill, COLORREF border, bool fillShape, float borderWidth = 1.0f) {
    Gdiplus::Graphics graphics(hdc);
    if (graphics.GetLastStatus() != Gdiplus::Ok) return false;
    graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    graphics.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
    Gdiplus::RectF bounds(static_cast<Gdiplus::REAL>(rect.left) + 0.5f, static_cast<Gdiplus::REAL>(rect.top) + 0.5f,
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.right - rect.left) - 1.0f),
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.bottom - rect.top) - 1.0f));
    Gdiplus::GraphicsPath path;
    AddRoundedRectanglePath(path, bounds, static_cast<float>(radius));
    if (fillShape) { Gdiplus::SolidBrush brush(ToGdiPlusColor(fill)); graphics.FillPath(&brush, &path); }
    Gdiplus::Pen pen(ToGdiPlusColor(border), borderWidth);
    graphics.DrawPath(&pen, &path);
    return true;
}

typedef HRESULT (WINAPI* DwmSetWindowAttributeFunction)(HWND, DWORD, LPCVOID, DWORD);

static DwmSetWindowAttributeFunction ResolveDwmSetWindowAttribute() {
    static HMODULE module = LoadLibraryW(L"dwmapi.dll");
    static DwmSetWindowAttributeFunction function = module
        ? reinterpret_cast<DwmSetWindowAttributeFunction>(GetProcAddress(module, "DwmSetWindowAttribute"))
        : nullptr;
    return function;
}

static HICON CreateLingBuilderWindowIcon(int size) {
    size = std::max(16, size);
    BITMAPV5HEADER header = {};
    header.bV5Size = sizeof(header);
    header.bV5Width = size;
    header.bV5Height = -size;
    header.bV5Planes = 1;
    header.bV5BitCount = 32;
    header.bV5Compression = BI_BITFIELDS;
    header.bV5RedMask = 0x00FF0000;
    header.bV5GreenMask = 0x0000FF00;
    header.bV5BlueMask = 0x000000FF;
    header.bV5AlphaMask = 0xFF000000;
    void* rawPixels = nullptr;
    HDC screen = GetDC(nullptr);
    HBITMAP color = CreateDIBSection(screen, reinterpret_cast<BITMAPINFO*>(&header), DIB_RGB_COLORS, &rawPixels, nullptr, 0);
    if (screen) ReleaseDC(nullptr, screen);
    if (!color || !rawPixels) { if (color) DeleteObject(color); return nullptr; }
    auto* pixels = static_cast<std::uint32_t*>(rawPixels);
    std::fill(pixels, pixels + size * size, 0u);
    auto put = [pixels, size](int x, int y, std::uint32_t argb) {
        if (x >= 0 && y >= 0 && x < size && y < size) pixels[y * size + x] = argb;
    };
    int left = std::max(2, size / 8);
    int top = std::max(2, size / 7);
    int right = size - left - 1;
    int bottom = size - std::max(5, size / 4);
    int stroke = std::max(2, size / 10);
    for (int y = top; y <= bottom; ++y) for (int x = left; x <= right; ++x) {
        bool border = x < left + stroke || x > right - stroke || y < top + stroke || y > bottom - stroke;
        put(x, y, border ? 0xFFFFB000u : 0xFF1F2937u);
    }
    int center = size / 2;
    for (int y = bottom + 1; y < std::min(size, bottom + 1 + stroke); ++y)
        for (int x = center - stroke / 2; x <= center + stroke / 2; ++x) put(x, y, 0xFFFFB000u);
    for (int y = std::min(size - 1, bottom + stroke); y < std::min(size, bottom + stroke * 2); ++y)
        for (int x = center - size / 5; x <= center + size / 5; ++x) put(x, y, 0xFFFFB000u);
    HBITMAP mask = CreateBitmap(size, size, 1, 1, nullptr);
    ICONINFO info = { TRUE, 0, 0, mask, color };
    HICON icon = CreateIconIndirect(&info);
    if (mask) DeleteObject(mask);
    DeleteObject(color);
    return icon;
}

struct ControlSpec {
    int id;
    int parentId;
    const wchar_t* type;
    const wchar_t* name;
    const wchar_t* text;
    int x;
    int y;
    int width;
    int height;
    int fontSize;
    const wchar_t* fontFamily;
    bool fontBold;
    bool fontItalic;
    bool fontUnderline;
    int cornerRadius;
    int listBorderWidth;
    COLORREF listBorderColor;
    COLORREF listSelectionStart;
    COLORREF listSelectionEnd;
    COLORREF listSelectionBorder;
    int listSelectionCornerRadius;
    int listItemHeight;
    int listItemSpacing;
    int listHeaderHeight;
    int listContentPadding;
    int listScrollBarVisibility;
    int listScrollBarWidth;
    COLORREF listScrollBarTrack;
    COLORREF listScrollBarThumb;
    int treeBorderWidth;
    COLORREF treeBorderColor;
    int treeNodeSpacing;
    int treeNodePadding;
    COLORREF background;
    bool backgroundTransparent;
    COLORREF foreground;
    bool enabled;
    const wchar_t* data;
    const wchar_t* data2;
    const wchar_t* tooltip;
    int tooltipDelay;
    const wchar_t* containerSlot;
    const wchar_t* option1;
    const wchar_t* option2;
    int minimum;
    int maximum;
    int value;
    int selectedIndex;
    unsigned int flags;
    const wchar_t* events;
};

struct ImageListSpec {
    const wchar_t* id;
    int width;
    int height;
    const wchar_t* images;
};

struct PropertySheetSpec { const wchar_t* id; const wchar_t* title; const wchar_t* pages; };
struct FileDialogSpec {
    const wchar_t* id; const wchar_t* name; int ownerWindowIndex;
    int triggerControlId; int dropTargetControlId; bool multiple; bool allowDrop;
    const wchar_t* title; const wchar_t* filter;
};
struct PropertySheetPageContext {
    const wchar_t* title; const wchar_t* content; const wchar_t* resourceId;
    void* eventOwner; void (*applied)(void*, const wchar_t*);
    void* pageOwner; void (*initialize)(void*, HWND);
};

enum ControlFlags : unsigned int {
    CF_CHECKED = 1u << 0, CF_THREE_STATE = 1u << 1, CF_MULTILINE = 1u << 2,
    CF_PASSWORD = 1u << 3, CF_READ_ONLY = 1u << 4, CF_NUMERIC = 1u << 5,
    CF_SORTED = 1u << 6, CF_MULTIPLE = 1u << 7, CF_EDITABLE = 1u << 8,
    CF_MARQUEE = 1u << 9, CF_GRID_LINES = 1u << 10, CF_CHECKBOXES = 1u << 11,
    CF_WORD_WRAP = 1u << 12, CF_AUTO_PLAY = 1u << 13, CF_LOOP = 1u << 14,
    CF_HORIZONTAL = 1u << 15, CF_BUTTON_DEFAULT = 1u << 16,
    CF_BUTTON_TOGGLE = 1u << 17, CF_BUTTON_SPLIT = 1u << 18,
    CF_BUTTON_COMMAND_LINK = 1u << 19, CF_ALIGN_CENTER = 1u << 20,
    CF_ALIGN_RIGHT = 1u << 21, CF_VIEW_ICON = 1u << 22,
    CF_VIEW_SMALL_ICON = 1u << 23, CF_VIEW_LIST = 1u << 24,
    CF_SHOW_BORDER = 1u << 25, CF_MULTI_SELECT = 1u << 26,
    CF_SHOW_LINES = 1u << 27, CF_HIDE_TAB_HEADER = 1u << 28
};

struct WindowSpec {
    int index;
    const wchar_t* className;
    const wchar_t* title;
    int width;
    int height;
    COLORREF background;
    COLORREF titleBarBackground;
    COLORREF titleBarForeground;
    int cornerPreference;
    const wchar_t* iconStyle;
    const wchar_t* iconPath;
    const wchar_t* openPlacement;
    int openX;
    int openY;
    const ControlSpec* controls;
    int controlCount;
    const wchar_t* menuItems;
    COLORREF menuBackground;
    COLORREF menuForeground;
    const wchar_t* menuFontFamily;
    int menuFontSize;
    bool menuFontBold;
    bool menuFontItalic;
    bool menuFontUnderline;
    const wchar_t* events;
};

struct RuntimeControl {
    int id;
    HWND hwnd;
    HWND frameHwnd;
    HFONT font;
    HBRUSH brush;
    HGDIOBJ resource;
    bool iconResource;
    bool mouseInside;
    int checkState;
    bool hideTabHeader;
    std::vector<std::wstring> uploadFiles;
};

struct RuntimeTabPage {
    int tabControlId;
    std::wstring slot;
    HWND hwnd;
    RECT contentRect;
};

static HINSTANCE g_instance = nullptr;
static int g_openWindowCount = 0;
static const wchar_t* GENERATED_WINDOW_CLASS = L"LingBuilderChineseCppWindowClass";

class LingWindowBase;
static LingWindowBase* CreateWindowObject(int windowIndex);

${imageListSpecs}
${propertySheetSpecs}
${fileDialogSpecs}

${controlArrays}

static WindowSpec g_windows[] = {
${windowSpecs}
};

static const int g_windowCount = static_cast<int>(sizeof(g_windows) / sizeof(g_windows[0]));
static const int g_startWindowIndex = ${selectedWindowIndex};

static HWND OpenGeneratedWindow(int windowIndex, int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false);
static HWND OpenGeneratedWindowByName(const wchar_t* windowName, int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false);

static void EnableDpiAwareness() {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (!user32) return;
    using SetProcessDpiAwarenessContextProc = BOOL (WINAPI*)(DPI_AWARENESS_CONTEXT);
    auto setDpiAwarenessContext = reinterpret_cast<SetProcessDpiAwarenessContextProc>(
        GetProcAddress(user32, "SetProcessDpiAwarenessContext")
    );
    if (setDpiAwarenessContext && setDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) return;
    using SetProcessDPIAwareProc = BOOL (WINAPI*)();
    auto setProcessDpiAware = reinterpret_cast<SetProcessDPIAwareProc>(GetProcAddress(user32, "SetProcessDPIAware"));
    if (setProcessDpiAware) setProcessDpiAware();
}

static UINT GetSystemDpiValue() {
    HDC hdc = GetDC(nullptr);
    UINT dpi = hdc ? static_cast<UINT>(GetDeviceCaps(hdc, LOGPIXELSX)) : 96;
    if (hdc) ReleaseDC(nullptr, hdc);
    return dpi ? dpi : 96;
}

static int ScaleForDpi(int value, UINT dpi) {
    return MulDiv(value, static_cast<int>(dpi ? dpi : 96), 96);
}

static HFONT CreateControlFont(const wchar_t* family, int cssPx, bool bold, bool italic, bool underline, UINT dpi) {
    return CreateFontW(
        -MulDiv(cssPx, static_cast<int>(dpi ? dpi : 96), 96),
        0, 0, 0, bold ? FW_BOLD : FW_NORMAL, italic ? TRUE : FALSE, underline ? TRUE : FALSE, FALSE, DEFAULT_CHARSET,
        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
        DEFAULT_PITCH | FF_SWISS, family && family[0] ? family : L"Microsoft YaHei UI"
    );
}

static bool IsType(const ControlSpec& control, const wchar_t* type) {
    return std::wcscmp(control.type, type) == 0;
}

static std::wstring GetEventHandler(const ControlSpec& control, const wchar_t* eventName) {
    if (!control.events || !eventName) return L"";
    std::wstring source(control.events);
    std::wstring prefix(eventName);
    prefix += L"=";
    size_t start = 0;
    while (start < source.size()) {
        size_t end = source.find(L'\\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (row.rfind(prefix, 0) == 0) return row.substr(prefix.size());
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return L"";
}

static std::wstring GetWindowEventHandler(const WindowSpec& window, const wchar_t* eventName) {
    if (!window.events || !eventName) return L"";
    std::wstring source(window.events);
    std::wstring prefix(eventName);
    prefix += L"=";
    size_t start = 0;
    while (start < source.size()) {
        size_t end = source.find(L'\\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (row.rfind(prefix, 0) == 0) return row.substr(prefix.size());
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return L"";
}

static std::vector<std::wstring> SplitControlData(const wchar_t* data) {
    std::vector<std::wstring> rows;
    if (!data) return rows;
    std::wstring source(data);
    size_t start = 0;
    while (start <= source.size()) {
        size_t end = source.find(L'\\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (!row.empty()) rows.push_back(row);
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return rows;
}

static std::vector<std::vector<std::wstring>> DecodeControlRecords(const wchar_t* data, int fieldCount) {
    std::vector<std::vector<std::wstring>> records;
    if (!data || fieldCount <= 0) return records;
    std::wstring source(data);
    size_t offset = 0;
    while (offset < source.size()) {
        std::vector<std::wstring> record;
        for (int fieldIndex = 0; fieldIndex < fieldCount; ++fieldIndex) {
            size_t colon = source.find(L':', offset);
            if (colon == std::wstring::npos || colon == offset) return records;
            size_t length = 0;
            for (size_t index = offset; index < colon; ++index) {
                if (source[index] < L'0' || source[index] > L'9') return records;
                length = length * 10 + static_cast<size_t>(source[index] - L'0');
            }
            offset = colon + 1;
            if (offset + length > source.size()) return records;
            record.push_back(source.substr(offset, length));
            offset += length;
        }
        records.push_back(std::move(record));
    }
    return records;
}

static bool ParseIsoDate(const wchar_t* value, SYSTEMTIME& result) {
    if (!value || !value[0]) return false;
    unsigned int year = 0, month = 0, day = 0;
    if (swscanf_s(value, L"%u-%u-%u", &year, &month, &day) != 3) return false;
    if (year < 1601 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    result = {}; result.wYear = static_cast<WORD>(year); result.wMonth = static_cast<WORD>(month); result.wDay = static_cast<WORD>(day);
    return true;
}

static WORD ParseHotKeyValue(const wchar_t* value) {
    if (!value || !value[0]) return 0;
    std::wstring text(value);
    std::transform(text.begin(), text.end(), text.begin(), ::towupper);
    BYTE modifiers = 0;
    if (text.find(L"CTRL+") != std::wstring::npos) modifiers |= HOTKEYF_CONTROL;
    if (text.find(L"ALT+") != std::wstring::npos) modifiers |= HOTKEYF_ALT;
    if (text.find(L"SHIFT+") != std::wstring::npos) modifiers |= HOTKEYF_SHIFT;
    size_t separator = text.find_last_of(L'+');
    std::wstring key = separator == std::wstring::npos ? text : text.substr(separator + 1);
    BYTE virtualKey = key.size() == 1 ? static_cast<BYTE>(key[0]) : 0;
    if (key == L"F1") virtualKey = VK_F1;
    else if (key == L"F2") virtualKey = VK_F2;
    else if (key == L"F3") virtualKey = VK_F3;
    else if (key == L"F4") virtualKey = VK_F4;
    else if (key == L"F5") virtualKey = VK_F5;
    else if (key == L"F6") virtualKey = VK_F6;
    else if (key == L"F7") virtualKey = VK_F7;
    else if (key == L"F8") virtualKey = VK_F8;
    else if (key == L"F9") virtualKey = VK_F9;
    else if (key == L"F10") virtualKey = VK_F10;
    else if (key == L"F11") virtualKey = VK_F11;
    else if (key == L"F12") virtualKey = VK_F12;
    return MAKEWORD(virtualKey, modifiers);
}

static bool TextEquals(const wchar_t* value, const wchar_t* expected);

static HBITMAP LoadWicBitmap(const wchar_t* path, int requestedWidth, int requestedHeight, const wchar_t* stretchMode) {
    if (!path || !path[0]) return nullptr;
    IWICImagingFactory* factory = nullptr;
    IWICBitmapDecoder* decoder = nullptr;
    IWICBitmapFrameDecode* frame = nullptr;
    IWICBitmapSource* source = nullptr;
    IWICBitmapScaler* scaler = nullptr;
    IWICFormatConverter* converter = nullptr;
    HBITMAP bitmap = nullptr;
    UINT sourceWidth = 0, sourceHeight = 0, targetWidth = 0, targetHeight = 0;
    BITMAPINFO info = {};
    void* pixels = nullptr;
    if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory)))) goto cleanup;
    if (FAILED(factory->CreateDecoderFromFilename(path, nullptr, GENERIC_READ, WICDecodeMetadataCacheOnLoad, &decoder))) goto cleanup;
    if (FAILED(decoder->GetFrame(0, &frame))) goto cleanup;
    if (FAILED(frame->GetSize(&sourceWidth, &sourceHeight)) || sourceWidth == 0 || sourceHeight == 0) goto cleanup;
    targetWidth = sourceWidth; targetHeight = sourceHeight;
    if (!TextEquals(stretchMode, L"none") && requestedWidth > 0 && requestedHeight > 0) {
        double scaleX = static_cast<double>(requestedWidth) / sourceWidth;
        double scaleY = static_cast<double>(requestedHeight) / sourceHeight;
        if (TextEquals(stretchMode, L"fill")) {
            targetWidth = requestedWidth; targetHeight = requestedHeight;
        } else {
            double scale = TextEquals(stretchMode, L"uniformToFill") ? std::max(scaleX, scaleY) : std::min(scaleX, scaleY);
            targetWidth = std::max(1u, static_cast<UINT>(sourceWidth * scale));
            targetHeight = std::max(1u, static_cast<UINT>(sourceHeight * scale));
        }
    }
    source = frame; source->AddRef();
    if (targetWidth != sourceWidth || targetHeight != sourceHeight) {
        if (FAILED(factory->CreateBitmapScaler(&scaler))) goto cleanup;
        if (FAILED(scaler->Initialize(frame, targetWidth, targetHeight, WICBitmapInterpolationModeFant))) goto cleanup;
        source->Release(); source = scaler; source->AddRef();
    }
    if (FAILED(factory->CreateFormatConverter(&converter))) goto cleanup;
    if (FAILED(converter->Initialize(source, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, nullptr, 0, WICBitmapPaletteTypeCustom))) goto cleanup;
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = static_cast<LONG>(targetWidth);
    info.bmiHeader.biHeight = -static_cast<LONG>(targetHeight);
    info.bmiHeader.biPlanes = 1; info.bmiHeader.biBitCount = 32; info.bmiHeader.biCompression = BI_RGB;
    bitmap = CreateDIBSection(nullptr, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
    if (!bitmap || !pixels) goto cleanup;
    if (FAILED(converter->CopyPixels(nullptr, targetWidth * 4, targetWidth * targetHeight * 4, static_cast<BYTE*>(pixels)))) {
        DeleteObject(bitmap); bitmap = nullptr;
    }
cleanup:
    if (converter) converter->Release();
    if (scaler) scaler->Release();
    if (source) source->Release();
    if (frame) frame->Release();
    if (decoder) decoder->Release();
    if (factory) factory->Release();
    return bitmap;
}

static bool TextEquals(const wchar_t* value, const wchar_t* expected) {
    return value && expected && std::wcscmp(value, expected) == 0;
}

struct RichEditStreamState { std::string bytes; size_t offset = 0; };
static DWORD CALLBACK StreamRichEditData(DWORD_PTR cookie, LPBYTE buffer, LONG count, LONG* written) {
    RichEditStreamState* state = reinterpret_cast<RichEditStreamState*>(cookie);
    if (!state || !buffer || !written) return 1;
    size_t remaining = state->bytes.size() - state->offset;
    size_t amount = std::min(remaining, static_cast<size_t>(count));
    if (amount > 0) std::memcpy(buffer, state->bytes.data() + state->offset, amount);
    state->offset += amount; *written = static_cast<LONG>(amount); return 0;
}

static std::vector<BYTE> BuildPropertySheetTemplate() {
    std::vector<BYTE> bytes(sizeof(DLGTEMPLATE) + sizeof(WORD) * 3, 0);
    DLGTEMPLATE* dialog = reinterpret_cast<DLGTEMPLATE*>(bytes.data());
    dialog->style = WS_CHILD | WS_VISIBLE | DS_CONTROL; dialog->dwExtendedStyle = 0; dialog->cdit = 0;
    dialog->x = 0; dialog->y = 0; dialog->cx = 250; dialog->cy = 170;
    return bytes;
}

static INT_PTR CALLBACK GeneratedPropertySheetPageProc(HWND dialog, UINT message, WPARAM, LPARAM lParam) {
    if (message == WM_INITDIALOG) {
        PROPSHEETPAGEW* page = reinterpret_cast<PROPSHEETPAGEW*>(lParam);
        PropertySheetPageContext* context = page ? reinterpret_cast<PropertySheetPageContext*>(page->lParam) : nullptr;
        SetWindowLongPtrW(dialog, DWLP_USER, reinterpret_cast<LONG_PTR>(context));
        if (context) CreateWindowExW(0, L"STATIC", context->content, WS_CHILD | WS_VISIBLE | SS_LEFT,
            12, 12, 330, 190, dialog, nullptr, GetModuleHandleW(nullptr), nullptr);
        if (context && context->initialize) context->initialize(context->pageOwner, dialog);
        return TRUE;
    }
    if (message == WM_NOTIFY) {
        NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
        if (header && header->code == PSN_APPLY) {
            PropertySheetPageContext* context = reinterpret_cast<PropertySheetPageContext*>(GetWindowLongPtrW(dialog, DWLP_USER));
            if (context && context->applied) context->applied(context->eventOwner, context->resourceId);
            SetWindowLongPtrW(dialog, DWLP_MSGRESULT, PSNRET_NOERROR); return TRUE;
        }
    }
    return FALSE;
}

static bool IsPlacement(const wchar_t* placement, const wchar_t* first, const wchar_t* second = nullptr, const wchar_t* third = nullptr) {
    return TextEquals(placement, first) || TextEquals(placement, second) || TextEquals(placement, third);
}

static void ResolveWindowPlacement(
    const WindowSpec& spec,
    int windowWidth,
    int windowHeight,
    const wchar_t* placementOverride,
    int xOverride,
    int yOverride,
    bool hasCustomPosition,
    int& x,
    int& y
) {
    const wchar_t* placement = placementOverride && placementOverride[0] ? placementOverride : spec.openPlacement;
    if (!placement || placement[0] == 0 || IsPlacement(placement, L"default", L"默认", L"系统默认")) return;

    const bool customPlacement = hasCustomPosition || IsPlacement(placement, L"custom", L"自定义", L"自定义坐标");
    if (customPlacement) {
        x = hasCustomPosition ? xOverride : spec.openX;
        y = hasCustomPosition ? yOverride : spec.openY;
        return;
    }

    RECT workArea = {};
    if (!SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0)) return;

    if (IsPlacement(placement, L"center", L"居中", L"居中显示")) {
        x = workArea.left + ((workArea.right - workArea.left) - windowWidth) / 2;
        y = workArea.top + ((workArea.bottom - workArea.top) - windowHeight) / 2;
        return;
    }
    if (IsPlacement(placement, L"top-left", L"left-top", L"左上角")) {
        x = workArea.left;
        y = workArea.top;
        return;
    }
    if (IsPlacement(placement, L"top-right", L"right-top", L"右上角")) {
        x = workArea.right - windowWidth;
        y = workArea.top;
        return;
    }
    if (IsPlacement(placement, L"bottom-left", L"left-bottom", L"左下角")) {
        x = workArea.left;
        y = workArea.bottom - windowHeight;
        return;
    }
    if (IsPlacement(placement, L"bottom-right", L"right-bottom", L"右下角")) {
        x = workArea.right - windowWidth;
        y = workArea.bottom - windowHeight;
    }
}

${builtinLibraryRuntime}

class LingWindowBase {
public:
    explicit LingWindowBase(const WindowSpec& spec)
        : spec_(spec),
          hwnd_(nullptr),
          windowBrush_(nullptr),
          menuBrush_(nullptr),
          menuFont_(nullptr),
          dpi_(96),
          wsSession_(nullptr),
          wsConnect_(nullptr),
          wsRequest_(nullptr),
          wsSocket_(nullptr),
          socketsStarted_(false),
          httpListenSocket_(INVALID_SOCKET),
          httpClientSocket_(INVALID_SOCKET),
          wsServerListenSocket_(INVALID_SOCKET),
          wsServerClientSocket_(INVALID_SOCKET) {}

    virtual ~LingWindowBase() {
        线程_等待全部();
        WS_关闭();
        HTTP_关闭服务();
        WSS_关闭服务();
        EdgeView_关闭();
        if (menuFont_) {
            DeleteObject(menuFont_);
            menuFont_ = nullptr;
        }
        if (socketsStarted_) {
            WSACleanup();
            socketsStarted_ = false;
        }
    }

    HWND Open(int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        dpi_ = GetSystemDpiValue();
        RECT rect = { 0, 0, ScaleForDpi(spec_.width, dpi_), ScaleForDpi(spec_.height, dpi_) };
        BOOL hasMenu = spec_.menuItems && spec_.menuItems[0] ? TRUE : FALSE;
        AdjustWindowRectEx(&rect, WS_OVERLAPPEDWINDOW, hasMenu, 0);
        int windowWidth = rect.right - rect.left;
        int windowHeight = rect.bottom - rect.top;
        int windowX = CW_USEDEFAULT;
        int windowY = CW_USEDEFAULT;
        ResolveWindowPlacement(spec_, windowWidth, windowHeight, placement, x, y, hasCustomPosition, windowX, windowY);

        hwnd_ = CreateWindowExW(
            0,
            GENERATED_WINDOW_CLASS,
            spec_.title,
            WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
            windowX,
            windowY,
            windowWidth,
            windowHeight,
            nullptr,
            CreateMenuForWindow(),
            g_instance,
            this
        );

        if (!hwnd_) return nullptr;
        ApplyWindowAppearance();
        ShowWindow(hwnd_, showCommand);
        UpdateWindow(hwnd_);
        SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        SetForegroundWindow(hwnd_);
        BringWindowToTop(hwnd_);
        SetFocus(hwnd_);
        SetTimer(hwnd_, 0x4C42, 900, nullptr);
        return hwnd_;
    }

    void AttachPropertyPage(HWND host) {
        hwnd_ = host; dpi_ = GetSystemDpiValue(); CreateImageLists(); RebuildControls();
    }

    void ReleasePropertyPage() {
        DestroyControls(); hwnd_ = nullptr;
    }

    static LingWindowBase* FromMessageWindow(HWND messageWindow) {
        if (!messageWindow) return nullptr;
        HWND root = GetAncestor(messageWindow, GA_ROOT);
        if (!root) root = messageWindow;
        return reinterpret_cast<LingWindowBase*>(GetWindowLongPtrW(root, GWLP_USERDATA));
    }

    bool PreTranslateKeyboardMessage(const MSG& message) {
        const wchar_t* eventName = nullptr;
        if (message.message == WM_KEYDOWN || message.message == WM_SYSKEYDOWN) eventName = L"KeyDown";
        else if (message.message == WM_KEYUP || message.message == WM_SYSKEYUP) eventName = L"KeyUp";
        else if (message.message == WM_CHAR || message.message == WM_SYSCHAR) eventName = L"TextInput";
        if (!eventName || GetWindowEventHandler(spec_, eventName).empty()) return false;

        eventKeyCode_ = static_cast<int>(message.wParam);
        eventCtrlDown_ = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
        eventShiftDown_ = (GetKeyState(VK_SHIFT) & 0x8000) != 0;
        eventAltDown_ = (GetKeyState(VK_MENU) & 0x8000) != 0;
        eventCharacter_.clear();

        if (message.message == WM_CHAR || message.message == WM_SYSCHAR) {
            wchar_t character = static_cast<wchar_t>(message.wParam);
            if (character >= 0xD800 && character <= 0xDBFF) {
                pendingHighSurrogate_ = character;
                return false;
            }
            if (pendingHighSurrogate_) {
                if (character >= 0xDC00 && character <= 0xDFFF) eventCharacter_.push_back(pendingHighSurrogate_);
                pendingHighSurrogate_ = 0;
            }
            eventCharacter_.push_back(character);
        }

        keyboardEventActive_ = true;
        keyboardHandled_ = false;
        DispatchWindowEvent(eventName);
        keyboardEventActive_ = false;
        return keyboardHandled_;
    }

protected:
    const WindowSpec& spec_;
    HWND hwnd_;
    std::vector<HWND> tooltipWindows_;
    std::vector<RuntimeControl> runtimeControls_;
    std::vector<RuntimeTabPage> tabPages_;
    std::map<std::wstring, HIMAGELIST> imageLists_;
    std::map<int, HIMAGELIST> listViewSizingImageLists_;
    HBRUSH windowBrush_;
    HBRUSH menuBrush_;
    HFONT menuFont_;
    HICON largeWindowIcon_ = nullptr;
    HICON smallWindowIcon_ = nullptr;
    bool ownsWindowIcons_ = false;
    UINT dpi_;
    bool closingEventActive_ = false;
    bool closingCancelled_ = false;
    bool keyboardEventActive_ = false;
    bool keyboardHandled_ = false;
    bool closedDispatched_ = false;
    bool active_ = false;
    bool visible_ = false;
    bool sizeBaselineReady_ = false;
    bool moveBaselineReady_ = false;
    bool windowStateBaselineReady_ = false;
    int listScrollDragControlId_ = 0;
    int listScrollDragOffset_ = 0;
    std::map<int, int> listWheelDeltaRemainders_;
    int eventWidth_ = 0;
    int eventHeight_ = 0;
    int eventX_ = 0;
    int eventY_ = 0;
    int windowState_ = 0;
    int eventKeyCode_ = 0;
    bool eventCtrlDown_ = false;
    bool eventShiftDown_ = false;
    bool eventAltDown_ = false;
    std::wstring eventCharacter_;
    wchar_t pendingHighSurrogate_ = 0;
    std::vector<std::wstring> droppedFiles_;
    std::map<std::wstring, std::vector<std::wstring>> fileDialogFiles_;
    HINTERNET wsSession_;
    HINTERNET wsConnect_;
    HINTERNET wsRequest_;
    HINTERNET wsSocket_;
    std::wstring wsLastMessage_;
    bool socketsStarted_;
    SOCKET httpListenSocket_;
    SOCKET httpClientSocket_;
    SOCKET wsServerListenSocket_;
    SOCKET wsServerClientSocket_;
    std::wstring httpLastRequest_;
    std::wstring wssLastMessage_;
    FINDREPLACEW findReplace_ = {};
    wchar_t findBuffer_[256] = {};
    wchar_t replaceBuffer_[256] = {};
    HWND findDialog_ = nullptr;
    int lastDialogStatus_ = 0;
    int lastToolbarCommand_ = 0;
    int lastStatusPart_ = -1;
    int nextToolbarCommandId_ = 60000;
    std::map<int, int> toolbarCommandOwners_;
    std::map<int, int> toolbarCommandValues_;
    std::wstring lastFindAction_;
    std::wstring lastFindText_;
    std::wstring lastReplaceText_;
    RECT lastPageMargins_ = {};
    std::vector<std::thread> threadTasks_;
    std::mutex threadTasksMutex_;
    std::atomic<int> activeThreadTasks_{0};
    std::atomic<int> nextThreadTaskId_{1};
    struct EdgeViewInstance {
        int id = 0;
        HWND host = nullptr;
        bool ownsHost = false;
        std::wstring cacheDirectory;
        std::wstring proxyServer;
        std::wstring lastEvent;
        std::wstring lastEventData;
        std::map<std::wstring, std::wstring> handlers;
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment;
        Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller;
        Microsoft::WRL::ComPtr<ICoreWebView2> webView;
#endif
    };
#if LINGBUILDER_EDGEVIEW_AVAILABLE
    HMODULE edgeViewLoader_ = nullptr;
#endif
    std::map<int, std::unique_ptr<EdgeViewInstance>> edgeViews_;
    std::wstring edgeViewGlobalProxy_;

    virtual void OnWindowCreated() { DispatchWindowEvent(L"Loaded"); }
    virtual void DispatchWindowEvent(const wchar_t* eventName) {
        std::wstring handler = GetWindowEventHandler(spec_, eventName);
        if (handler.empty()) return;
        std::wstring message = L"窗口事件未绑定到中文处理器：";
        message += handler;
        调试输出(message.c_str());
    }
    virtual void DispatchDesignerResourceEvent(const wchar_t*, const wchar_t*) {}

    virtual void DispatchEdgeViewEvent(const wchar_t* handler, int instanceId, const wchar_t* eventName, const wchar_t* data) {
        std::wstring message = L"EdgeView 事件未绑定到中文处理器：";
        message += handler ? handler : L"";
        message += L" / ";
        message += eventName ? eventName : L"";
        调试输出(message.c_str());
        (void)instanceId; (void)data;
    }

    virtual void DispatchLingEvent(const ControlSpec& control, const wchar_t* eventName) {
        std::wstring handler = GetEventHandler(control, eventName);
        if (handler.empty()) return;
        std::wstring message = L"已触发中文 C++ 事件：";
        message += handler;
        MessageBoxW(hwnd_, message.c_str(), L"LingBuilder 中文 C++", MB_OK | MB_ICONINFORMATION);
    }

    bool IsUploadControl(const ControlSpec& control) const {
        return IsType(control, L"Upload") || IsType(control, L"DragUpload");
    }

    void RefreshUploadFileList(RuntimeControl& runtime) {
        HWND list = GetDlgItem(runtime.hwnd, 2);
        if (!list) return;
        SendMessageW(list, LB_RESETCONTENT, 0, 0);
        for (const auto& path : runtime.uploadFiles) {
            size_t separator = path.find_last_of(L"\\\\/");
            const wchar_t* name = separator == std::wstring::npos ? path.c_str() : path.c_str() + separator + 1;
            SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(name));
        }
    }

    bool UploadFileMatches(const ControlSpec& control, const std::wstring& path) const {
        std::wstring accept = control.data2 ? control.data2 : L"*.*";
        if (accept.empty() || accept == L"*" || accept == L"*.*") return true;
        std::wstring lowerPath = path;
        std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(), [](wchar_t value) { return static_cast<wchar_t>(towlower(value)); });
        size_t start = 0;
        while (start <= accept.size()) {
            size_t end = accept.find_first_of(L",;|", start);
            std::wstring token = accept.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
            while (!token.empty() && iswspace(token.front())) token.erase(token.begin());
            while (!token.empty() && iswspace(token.back())) token.pop_back();
            std::transform(token.begin(), token.end(), token.begin(), [](wchar_t value) { return static_cast<wchar_t>(towlower(value)); });
            if (token == L"*" || token == L"*.*") return true;
            if (token.rfind(L"*.", 0) == 0) token.erase(token.begin());
            if (!token.empty() && token.front() != L'.' && token.find(L'/') == std::wstring::npos) token.insert(token.begin(), L'.');
            if (!token.empty() && token.front() == L'.' && lowerPath.size() >= token.size()
                && lowerPath.compare(lowerPath.size() - token.size(), token.size(), token) == 0) return true;
            start = end == std::wstring::npos ? accept.size() + 1 : end + 1;
        }
        return false;
    }

    bool AddUploadFiles(const ControlSpec& control, RuntimeControl& runtime, const std::vector<std::wstring>& files) {
        bool changed = false;
        for (const auto& path : files) {
            if (path.empty() || !UploadFileMatches(control, path)) continue;
            if (control.maximum > 0) {
                WIN32_FILE_ATTRIBUTE_DATA info = {};
                if (GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &info)) {
                    ULARGE_INTEGER size = {}; size.HighPart = info.nFileSizeHigh; size.LowPart = info.nFileSizeLow;
                    if (size.QuadPart > static_cast<ULONGLONG>(control.maximum) * 1024ull) continue;
                }
            }
            if (!(control.flags & CF_MULTIPLE)) runtime.uploadFiles.clear();
            if (std::find(runtime.uploadFiles.begin(), runtime.uploadFiles.end(), path) == runtime.uploadFiles.end()) {
                if (control.minimum > 0 && static_cast<int>(runtime.uploadFiles.size()) >= control.minimum) break;
                runtime.uploadFiles.push_back(path);
                changed = true;
            }
            if (!(control.flags & CF_MULTIPLE)) break;
        }
        if (!changed) return false;
        RefreshUploadFileList(runtime);
        DispatchLingEvent(control, L"FilesSelected");
        if (control.selectedIndex & 1) DispatchLingEvent(control, L"UploadAction");
        return true;
    }

    bool OpenUploadFileDialog(const ControlSpec& control, RuntimeControl& runtime) {
        HRESULT initialized = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        IFileOpenDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
        if (FAILED(result) || !dialog) { if (SUCCEEDED(initialized)) CoUninitialize(); return false; }
        FILEOPENDIALOGOPTIONS options = FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST;
        if (control.flags & CF_MULTIPLE) options |= FOS_ALLOWMULTISELECT;
        dialog->SetOptions(options);
        std::wstring accept = control.data2 && control.data2[0] ? control.data2 : L"*.*";
        std::wstring pattern;
        size_t patternStart = 0;
        while (patternStart <= accept.size()) {
            size_t patternEnd = accept.find_first_of(L",;|", patternStart);
            std::wstring token = accept.substr(patternStart, patternEnd == std::wstring::npos ? std::wstring::npos : patternEnd - patternStart);
            while (!token.empty() && iswspace(token.front())) token.erase(token.begin());
            while (!token.empty() && iswspace(token.back())) token.pop_back();
            if (!token.empty()) {
                if (token.front() == L'.') token.insert(token.begin(), L'*');
                if (!pattern.empty()) pattern += L';';
                pattern += token;
            }
            patternStart = patternEnd == std::wstring::npos ? accept.size() + 1 : patternEnd + 1;
        }
        if (pattern.empty()) pattern = L"*.*";
        COMDLG_FILTERSPEC filters[] = {{ L"允许的文件", pattern.c_str() }, { L"所有文件", L"*.*" }};
        dialog->SetFileTypes(2, filters);
        result = dialog->Show(hwnd_);
        std::vector<std::wstring> files;
        if (SUCCEEDED(result)) {
            IShellItemArray* items = nullptr;
            if (SUCCEEDED(dialog->GetResults(&items)) && items) {
                DWORD count = 0; items->GetCount(&count);
                for (DWORD index = 0; index < count; ++index) {
                    IShellItem* item = nullptr; PWSTR path = nullptr;
                    if (SUCCEEDED(items->GetItemAt(index, &item)) && item && SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                        files.emplace_back(path); CoTaskMemFree(path);
                    }
                    if (item) item->Release();
                }
                items->Release();
            }
        }
        dialog->Release();
        if (SUCCEEDED(initialized)) CoUninitialize();
        return AddUploadFiles(control, runtime, files);
    }

    bool 上传_打开文件选择(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) ? OpenUploadFileDialog(*control, *runtime) : false;
    }
    bool 上传_开始(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsUploadControl(*control)) return false;
        DispatchLingEvent(*control, L"UploadAction"); return true;
    }
    bool 上传_清空文件(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsUploadControl(*control)) return false;
        runtime->uploadFiles.clear(); RefreshUploadFileList(*runtime); return true;
    }
    int 上传_取文件数量(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) ? static_cast<int>(runtime->uploadFiles.size()) : 0;
    }
    std::wstring 上传_取文件(const wchar_t* controlName, int index) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) && index >= 0 && index < static_cast<int>(runtime->uploadFiles.size()) ? runtime->uploadFiles[static_cast<size_t>(index)] : L"";
    }

    void InitializeUploadControl(const ControlSpec& control, RuntimeControl& runtime) {
        auto labels = DecodeControlRecords(control.option2, 2);
        const wchar_t* triggerText = !labels.empty() && !labels[0][0].empty() ? labels[0][0].c_str() : L"选择文件";
        const wchar_t* submitText = !labels.empty() && !labels[0][1].empty() ? labels[0][1].c_str() : L"上传";
        int padding = ScaleForDpi(10, dpi_);
        int buttonHeight = ScaleForDpi(32, dpi_);
        int width = ScaleForDpi(control.width, dpi_);
        int height = ScaleForDpi(control.height, dpi_);
        int cursorY = padding;
        if (control.selectedIndex & 4) {
            HWND tip = CreateWindowExW(0, L"STATIC", control.option1 && control.option1[0] ? control.option1 : (IsType(control, L"DragUpload") ? L"将文件拖到这里，或点击选择文件" : L"支持点击选择文件"),
                WS_CHILD | WS_VISIBLE | SS_LEFT, padding, cursorY, std::max(20, width - padding * 2), ScaleForDpi(38, dpi_), runtime.hwnd, reinterpret_cast<HMENU>(4), g_instance, nullptr);
            if (tip && runtime.font) SendMessageW(tip, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
            cursorY += ScaleForDpi(42, dpi_);
        }
        HWND trigger = CreateWindowExW(0, L"BUTTON", triggerText, WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
            padding, cursorY, std::min(ScaleForDpi(130, dpi_), std::max(20, width - padding * 2)), buttonHeight,
            runtime.hwnd, reinterpret_cast<HMENU>(1), g_instance, nullptr);
        if (trigger && runtime.font) SendMessageW(trigger, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        cursorY += buttonHeight + padding;
        int actionSpace = (control.selectedIndex & 8) ? buttonHeight + padding : 0;
        if (control.selectedIndex & 2) {
            HWND list = CreateWindowExW(WS_EX_CLIENTEDGE, L"LISTBOX", L"", WS_CHILD | WS_VISIBLE | WS_VSCROLL | LBS_NOINTEGRALHEIGHT,
                padding, cursorY, std::max(20, width - padding * 2), std::max(28, height - cursorY - actionSpace - padding),
                runtime.hwnd, reinterpret_cast<HMENU>(2), g_instance, nullptr);
            if (list && runtime.font) SendMessageW(list, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        }
        if (control.selectedIndex & 8) {
            HWND submit = CreateWindowExW(0, L"BUTTON", submitText, WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
                std::max(padding, width - padding - ScaleForDpi(130, dpi_)), std::max(cursorY, height - padding - buttonHeight),
                std::min(ScaleForDpi(130, dpi_), std::max(20, width - padding * 2)), buttonHeight,
                runtime.hwnd, reinterpret_cast<HMENU>(3), g_instance, nullptr);
            if (submit && runtime.font) SendMessageW(submit, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        }
        auto initialFiles = DecodeControlRecords(control.data, 1);
        for (const auto& row : initialFiles) if (!row.empty() && !row[0].empty()) runtime.uploadFiles.push_back(row[0]);
        RefreshUploadFileList(runtime);
    }

    void 写入调试输出(const wchar_t* text) {
        if (!text || text[0] == 0) return;
        OutputDebugStringW(text);
        OutputDebugStringW(L"\\n");
        int sizeNeeded = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
        if (sizeNeeded > 0) {
            std::vector<char> utf8(sizeNeeded);
            WideCharToMultiByte(CP_UTF8, 0, text, -1, utf8.data(), sizeNeeded, nullptr, nullptr);
            std::printf("[调试输出] %s\\n", utf8.data());
            std::fflush(stdout);
        }
    }

    static void 追加调试参数(std::wstring& output, bool value) { output += value ? L"真" : L"假"; }
    static void 追加调试参数(std::wstring& output, const wchar_t* value) { output += value ? value : L"(空)"; }
    static void 追加调试参数(std::wstring& output, const std::wstring& value) { output += value; }
    template <typename T> static void 追加调试参数(std::wstring& output, const T& value) {
        std::wostringstream stream;
        stream << value;
        output += stream.str();
    }
    template <typename... Args> void 调试输出(const Args&... args) {
        std::wstring output;
        bool first = true;
        auto append = [&](const auto& value) {
            if (!first) output += L", ";
            first = false;
            追加调试参数(output, value);
        };
        (append(args), ...);
        写入调试输出(output.c_str());
    }

    int 信息框(const wchar_t* text, UINT flags, const wchar_t* title) {
        return MessageBoxW(hwnd_, text, title && title[0] ? title : L"LingBuilder 中文 C++", flags);
    }

    // 旧单实例实现保留在生成模板中但不参与编译，便于旧产物差异审查。
#if 0
    int EdgeView_创建(long long parentHandle, const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeView_关闭();
        edgeViewHost_ = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!edgeViewHost_ || !IsWindow(edgeViewHost_)) {
            调试输出(L"EdgeView 创建失败：父组件句柄无效。");
            return 0;
        }
        edgeViewLoader_ = LoadLibraryW(L"WebView2Loader.dll");
        if (!edgeViewLoader_) {
            调试输出(L"EdgeView 创建失败：未找到 WebView2Loader.dll。请安装 WebView2 SDK 并把 Loader DLL 放到 exe 同目录。");
            return 0;
        }
        using CreateEnvironmentProc = HRESULT (STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
        auto createEnvironment = reinterpret_cast<CreateEnvironmentProc>(GetProcAddress(edgeViewLoader_, "CreateCoreWebView2EnvironmentWithOptions"));
        if (!createEnvironment) {
            调试输出(L"EdgeView 创建失败：WebView2Loader.dll 不包含所需入口。");
            EdgeView_关闭();
            return 0;
        }
        bool completed = false;
        HRESULT result = E_FAIL;
        auto environmentCallback = Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, &completed, &result](HRESULT environmentResult, ICoreWebView2Environment* environment) -> HRESULT {
                result = environmentResult;
                if (SUCCEEDED(environmentResult) && environment) {
                    return environment->CreateCoreWebView2Controller(edgeViewHost_, Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [this, &completed, &result](HRESULT controllerResult, ICoreWebView2Controller* controller) -> HRESULT {
                            result = controllerResult;
                            if (SUCCEEDED(controllerResult) && controller) {
                                edgeViewController_ = controller;
                                controller->get_CoreWebView2(&edgeView_);
                                EdgeView_调整大小();
                                EdgeView_注册事件();
                            }
                            completed = true;
                            return S_OK;
                        }).Get());
                }
                completed = true;
                return S_OK;
            });
        result = createEnvironment(nullptr, nullptr, nullptr, environmentCallback.Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000) || !edgeView_) {
            调试输出(L"EdgeView 创建失败：无法初始化 WebView2 环境或等待超时。");
            EdgeView_关闭();
            return 0;
        }
        edgeViewLastEvent_ = L"浏览器创建完成";
        edgeViewLastEventData_ = address ? address : L"";
        if (address && address[0]) edgeView_->Navigate(address);
        return 1;
#else
        (void)parentHandle; (void)address;
        调试输出(L"EdgeView 不可用：当前 C++ 构建环境缺少 WebView2.h。请通过 NuGet 安装 Microsoft.Web.WebView2 SDK。");
        return 0;
#endif
    }

    int EdgeView_导航(const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        return edgeView_ && address && SUCCEEDED(edgeView_->Navigate(address)) ? 1 : 0;
#else
        (void)address; return 0;
#endif
    }

    std::wstring EdgeView_执行JS(const wchar_t* script) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (!edgeView_ || !script) return L"";
        bool completed = false;
        std::wstring value;
        HRESULT result = edgeView_->ExecuteScript(script, Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
            [&completed, &value](HRESULT error, LPCWSTR json) -> HRESULT {
                if (SUCCEEDED(error) && json) value = json;
                completed = true;
                return S_OK;
            }).Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000)) {
            调试输出(L"EdgeView 执行 JavaScript 失败或等待返回值超时。");
            return L"";
        }
        return value;
#else
        (void)script; return L"";
#endif
    }

    std::wstring EdgeView_取最近事件() const { return edgeViewLastEvent_; }
    std::wstring EdgeView_取事件数据() const { return edgeViewLastEventData_; }
    int EdgeView_后退() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        BOOL allowed = FALSE; if (!edgeView_ || FAILED(edgeView_->get_CanGoBack(&allowed)) || !allowed) return 0; edgeView_->GoBack(); return 1;
#else
        return 0;
#endif
    }
    int EdgeView_前进() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        BOOL allowed = FALSE; if (!edgeView_ || FAILED(edgeView_->get_CanGoForward(&allowed)) || !allowed) return 0; edgeView_->GoForward(); return 1;
#else
        return 0;
#endif
    }
    void EdgeView_刷新() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeView_) edgeView_->Reload();
#endif
    }
    void EdgeView_关闭() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeViewController_) edgeViewController_->Close();
        edgeView_.Reset(); edgeViewController_.Reset();
        if (edgeViewLoader_) { FreeLibrary(edgeViewLoader_); edgeViewLoader_ = nullptr; }
#endif
        edgeViewHost_ = nullptr;
    }

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    bool EdgeView_等待(bool* completed, DWORD timeout) {
        DWORD started = GetTickCount();
        MSG message = {};
        while (!*completed && GetTickCount() - started < timeout) {
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return *completed;
    }
    void EdgeView_调整大小() {
        if (!edgeViewController_ || !edgeViewHost_) return;
        RECT bounds = {}; GetClientRect(edgeViewHost_, &bounds); edgeViewController_->put_Bounds(bounds);
    }
    void EdgeView_记录事件(const wchar_t* name, const wchar_t* data) {
        edgeViewLastEvent_ = name ? name : L""; edgeViewLastEventData_ = data ? data : L"";
    }
    void EdgeView_注册事件() {
        if (!edgeView_) return;
        EventRegistrationToken token = {};
        edgeView_->add_NavigationStarting(Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>([this](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; args->get_Uri(&uri); EdgeView_记录事件(L"导航开始", uri); CoTaskMemFree(uri); return S_OK; }).Get(), &token);
        edgeView_->add_NavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>([this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; args->get_IsSuccess(&ok); EdgeView_记录事件(L"导航完成", ok ? L"成功" : L"失败"); return S_OK; }).Get(), &token);
        edgeView_->add_DocumentTitleChanged(Microsoft::WRL::Callback<ICoreWebView2DocumentTitleChangedEventHandler>([this](ICoreWebView2* sender, IUnknown*) -> HRESULT { LPWSTR title = nullptr; sender->get_DocumentTitle(&title); EdgeView_记录事件(L"标题改变", title); CoTaskMemFree(title); return S_OK; }).Get(), &token);
        edgeView_->add_WebMessageReceived(Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>([this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT { LPWSTR message = nullptr; if (FAILED(args->TryGetWebMessageAsString(&message))) args->get_WebMessageAsJson(&message); EdgeView_记录事件(L"网页消息", message); CoTaskMemFree(message); return S_OK; }).Get(), &token);
    }
#endif
#endif

    EdgeViewInstance* EdgeView_查找(int instanceId) {
        auto found = edgeViews_.find(instanceId);
        return found == edgeViews_.end() ? nullptr : found->second.get();
    }

    int EdgeView_创建(long long parentHandle, const wchar_t* address) {
        return EdgeView_创建实例(0, parentHandle, address, L"");
    }

    int EdgeView_创建实例(int instanceId, long long parentHandle, const wchar_t* address, const wchar_t* cacheDirectory) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (instanceId < 0) { 调试输出(L"EdgeView 创建失败：实例编号不能为负数。"); return 0; }
        EdgeView_关闭实例(instanceId);
        HWND host = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!host || !IsWindow(host)) { 调试输出(L"EdgeView 创建失败：父组件句柄无效。"); return 0; }
        return EdgeView_创建核心(instanceId, host, false, address, cacheDirectory, edgeViewGlobalProxy_.c_str());
#else
        (void)instanceId; (void)parentHandle; (void)address; (void)cacheDirectory;
        调试输出(L"EdgeView 不可用：构建环境缺少 WebView2.h，请恢复 Microsoft.Web.WebView2 SDK。");
        return 0;
#endif
    }

    int EdgeView_创建实例代理(int instanceId, long long parentHandle, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeView_关闭实例(instanceId);
        HWND host = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!host || !IsWindow(host)) { 调试输出(L"EdgeView 创建失败：父组件句柄无效。"); return 0; }
        return EdgeView_创建核心(instanceId, host, false, address, cacheDirectory, proxyServer);
#else
        (void)instanceId; (void)parentHandle; (void)address; (void)cacheDirectory; (void)proxyServer; return 0;
#endif
    }

    int EdgeView_创建区域(int instanceId, int x, int y, int width, int height, const wchar_t* address, const wchar_t* cacheDirectory) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (width <= 0 || height <= 0) { 调试输出(L"EdgeView 创建失败：区域宽高必须大于零。"); return 0; }
        EdgeView_关闭实例(instanceId);
        HWND host = CreateWindowExW(WS_EX_CONTROLPARENT, L"STATIC", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
            x, y, width, height, hwnd_, nullptr, g_instance, nullptr);
        if (!host) { 调试输出(L"EdgeView 创建失败：无法创建浏览器承载组件。"); return 0; }
        if (!EdgeView_创建核心(instanceId, host, true, address, cacheDirectory, edgeViewGlobalProxy_.c_str())) { DestroyWindow(host); return 0; }
        return 1;
#else
        (void)instanceId; (void)x; (void)y; (void)width; (void)height; (void)address; (void)cacheDirectory;
        return 0;
#endif
    }

    int EdgeView_创建区域代理(int instanceId, int x, int y, int width, int height, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (width <= 0 || height <= 0) return 0;
        EdgeView_关闭实例(instanceId);
        HWND host = CreateWindowExW(WS_EX_CONTROLPARENT, L"STATIC", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
            x, y, width, height, hwnd_, nullptr, g_instance, nullptr);
        if (!host) return 0;
        if (!EdgeView_创建核心(instanceId, host, true, address, cacheDirectory, proxyServer)) { DestroyWindow(host); return 0; }
        return 1;
#else
        (void)instanceId; (void)x; (void)y; (void)width; (void)height; (void)address; (void)cacheDirectory; (void)proxyServer; return 0;
#endif
    }

    bool EdgeView_代理有效(const wchar_t* proxyServer) const {
        if (!proxyServer || !proxyServer[0]) return true;
        std::wstring value(proxyServer);
        if (value.find_first_of(L" \\t\\r\\n\\\"") != std::wstring::npos) return false;
        return value.rfind(L"http://", 0) == 0 || value.rfind(L"https://", 0) == 0 || value.rfind(L"socks5://", 0) == 0;
    }
    int EdgeView_设置全局代理(const wchar_t* proxyServer) {
        if (!EdgeView_代理有效(proxyServer) || !proxyServer || !proxyServer[0]) {
            调试输出(L"EdgeView 全局代理无效：请使用 http://、https:// 或 socks5:// 地址，且不要包含空白或引号。");
            return 0;
        }
        edgeViewGlobalProxy_ = proxyServer;
        return 1;
    }
    void EdgeView_清除全局代理() { edgeViewGlobalProxy_.clear(); }
    std::wstring EdgeView_取全局代理() const { return edgeViewGlobalProxy_; }
    std::wstring EdgeView_取实例代理(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->proxyServer;
    }

    int EdgeView_绑定事件(int instanceId, const wchar_t* eventName, const wchar_t* handler) {
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !eventName || !eventName[0] || !handler || !handler[0]) return 0;
        instance->handlers[eventName] = handler;
        return 1;
    }

    int EdgeView_等待事件(int instanceId, const wchar_t* eventName, int timeoutMilliseconds) {
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !eventName || timeoutMilliseconds < 0) return 0;
        DWORD started = GetTickCount(); MSG message = {};
        while (GetTickCount() - started < static_cast<DWORD>(timeoutMilliseconds)) {
            if (instance->lastEvent == eventName) return 1;
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return instance->lastEvent == eventName ? 1 : 0;
    }

    int EdgeView_导航实例(int instanceId, const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !instance->webView || !address) return 0;
        instance->lastEvent.clear(); instance->lastEventData.clear();
        return SUCCEEDED(instance->webView->Navigate(address)) ? 1 : 0;
#else
        (void)instanceId; (void)address; return 0;
#endif
    }
    int EdgeView_导航(const wchar_t* address) { return EdgeView_导航实例(0, address); }

    std::wstring EdgeView_执行JS实例(int instanceId, const wchar_t* script) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !instance->webView || !script) return L"";
        bool completed = false;
        std::wstring value;
        HRESULT result = instance->webView->ExecuteScript(script, Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
            [&completed, &value](HRESULT error, LPCWSTR json) -> HRESULT {
                if (SUCCEEDED(error) && json) value = json;
                completed = true;
                return S_OK;
            }).Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000)) {
            调试输出(L"EdgeView 执行 JavaScript 失败或等待返回值超时。");
            return L"";
        }
        return value;
#else
        (void)instanceId; (void)script; return L"";
#endif
    }
    std::wstring EdgeView_执行JS(const wchar_t* script) { return EdgeView_执行JS实例(0, script); }

    std::wstring EdgeView_取最近事件实例(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->lastEvent;
    }
    std::wstring EdgeView_取事件数据实例(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->lastEventData;
    }
    std::wstring EdgeView_取最近事件() const { return EdgeView_取最近事件实例(0); }
    std::wstring EdgeView_取事件数据() const { return EdgeView_取事件数据实例(0); }

    int EdgeView_后退实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); BOOL allowed = FALSE;
        if (!instance || !instance->webView || FAILED(instance->webView->get_CanGoBack(&allowed)) || !allowed) return 0;
        instance->webView->GoBack(); return 1;
#else
        (void)instanceId; return 0;
#endif
    }
    int EdgeView_前进实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); BOOL allowed = FALSE;
        if (!instance || !instance->webView || FAILED(instance->webView->get_CanGoForward(&allowed)) || !allowed) return 0;
        instance->webView->GoForward(); return 1;
#else
        (void)instanceId; return 0;
#endif
    }
    int EdgeView_后退() { return EdgeView_后退实例(0); }
    int EdgeView_前进() { return EdgeView_前进实例(0); }
    void EdgeView_刷新实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); if (instance && instance->webView) instance->webView->Reload();
#else
        (void)instanceId;
#endif
    }
    void EdgeView_刷新() { EdgeView_刷新实例(0); }
    void EdgeView_关闭实例(int instanceId) {
        auto found = edgeViews_.find(instanceId);
        if (found == edgeViews_.end()) return;
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (found->second->controller) found->second->controller->Close();
#endif
        if (found->second->ownsHost && found->second->host && IsWindow(found->second->host)) DestroyWindow(found->second->host);
        edgeViews_.erase(found);
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeViews_.empty() && edgeViewLoader_) { FreeLibrary(edgeViewLoader_); edgeViewLoader_ = nullptr; }
#endif
    }
    void EdgeView_关闭() {
        while (!edgeViews_.empty()) EdgeView_关闭实例(edgeViews_.begin()->first);
    }

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    int EdgeView_创建核心(int instanceId, HWND host, bool ownsHost, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
        if (!EdgeView_代理有效(proxyServer)) {
            调试输出(L"EdgeView 创建失败：代理地址无效。");
            return 0;
        }
        if (!edgeViewLoader_) edgeViewLoader_ = LoadLibraryW(L"WebView2Loader.dll");
        if (!edgeViewLoader_) { 调试输出(L"EdgeView 创建失败：exe 同目录缺少 WebView2Loader.dll。"); return 0; }
        using CreateEnvironmentProc = HRESULT (STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
        auto createEnvironment = reinterpret_cast<CreateEnvironmentProc>(GetProcAddress(edgeViewLoader_, "CreateCoreWebView2EnvironmentWithOptions"));
        if (!createEnvironment) { 调试输出(L"EdgeView 创建失败：Loader 入口无效。"); return 0; }
        auto instance = std::make_unique<EdgeViewInstance>();
        instance->id = instanceId; instance->host = host; instance->ownsHost = ownsHost;
        instance->cacheDirectory = cacheDirectory ? cacheDirectory : L"";
        instance->proxyServer = proxyServer ? proxyServer : L"";
        EdgeViewInstance* raw = instance.get(); edgeViews_[instanceId] = std::move(instance);
        bool completed = false; HRESULT asyncResult = E_FAIL;
        auto environmentCallback = Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, raw, &completed, &asyncResult](HRESULT result, ICoreWebView2Environment* environment) -> HRESULT {
                asyncResult = result;
                if (FAILED(result) || !environment) { completed = true; return S_OK; }
                raw->environment = environment;
                return environment->CreateCoreWebView2Controller(raw->host, Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [this, raw, &completed, &asyncResult](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        asyncResult = result;
                        if (SUCCEEDED(result) && controller) {
                            raw->controller = controller; controller->get_CoreWebView2(&raw->webView);
                            controller->put_IsVisible(TRUE);
                            EdgeView_调整大小(*raw); EdgeView_注册事件(*raw);
                            ShowWindow(raw->host, SW_SHOW);
                            SetWindowPos(raw->host, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
                            InvalidateRect(raw->host, nullptr, TRUE);
                            UpdateWindow(raw->host);
                        }
                        completed = true; return S_OK;
                    }).Get());
            });
        Microsoft::WRL::ComPtr<CoreWebView2EnvironmentOptions> environmentOptions;
        if (!raw->proxyServer.empty()) {
            environmentOptions = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
            std::wstring arguments = L"--proxy-server=" + raw->proxyServer;
            environmentOptions->put_AdditionalBrowserArguments(arguments.c_str());
        }
        HRESULT startResult = createEnvironment(nullptr, raw->cacheDirectory.empty() ? nullptr : raw->cacheDirectory.c_str(), environmentOptions.Get(), environmentCallback.Get());
        if (FAILED(startResult) || !EdgeView_等待(&completed, 15000) || FAILED(asyncResult) || !raw->webView) {
            调试输出(L"EdgeView 创建失败：WebView2 环境初始化失败或超时。"); EdgeView_关闭实例(instanceId); return 0;
        }
        EdgeView_记录事件(*raw, L"浏览器创建完成", raw->cacheDirectory.c_str());
        if (address && address[0]) raw->webView->Navigate(address);
        return 1;
    }
    bool EdgeView_等待(bool* completed, DWORD timeout) {
        DWORD started = GetTickCount(); MSG message = {};
        while (!*completed && GetTickCount() - started < timeout) {
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return *completed;
    }
    void EdgeView_调整大小(EdgeViewInstance& instance) {
        if (!instance.controller || !instance.host) return;
        RECT bounds = {};
        GetClientRect(instance.host, &bounds);
        instance.controller->put_Bounds(bounds);
        instance.controller->NotifyParentWindowPositionChanged();
        instance.controller->put_IsVisible(IsWindowVisible(instance.host) ? TRUE : FALSE);
    }
    void EdgeView_调整全部大小() { for (auto& item : edgeViews_) EdgeView_调整大小(*item.second); }
    void EdgeView_记录事件(EdgeViewInstance& instance, const wchar_t* name, const wchar_t* data) {
        instance.lastEvent = name ? name : L""; instance.lastEventData = data ? data : L"";
        auto handler = instance.handlers.find(instance.lastEvent);
        if (handler != instance.handlers.end()) DispatchEdgeViewEvent(handler->second.c_str(), instance.id, instance.lastEvent.c_str(), instance.lastEventData.c_str());
    }
    void EdgeView_注册事件(EdgeViewInstance& instance) {
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        instance.webView->add_NavigationStarting(Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR value = nullptr; args->get_Uri(&value); EdgeView_记录事件(*raw, L"导航开始", value); CoTaskMemFree(value); return S_OK; }).Get(), &token);
        instance.webView->add_NavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; args->get_IsSuccess(&ok); EdgeView_记录事件(*raw, L"导航完成", ok ? L"成功" : L"失败"); return S_OK; }).Get(), &token);
        instance.webView->add_DocumentTitleChanged(Microsoft::WRL::Callback<ICoreWebView2DocumentTitleChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { LPWSTR value = nullptr; sender->get_DocumentTitle(&value); EdgeView_记录事件(*raw, L"标题改变", value); CoTaskMemFree(value); return S_OK; }).Get(), &token);
        instance.webView->add_WebMessageReceived(Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT { LPWSTR value = nullptr; if (FAILED(args->TryGetWebMessageAsString(&value))) args->get_WebMessageAsJson(&value); EdgeView_记录事件(*raw, L"网页消息", value); CoTaskMemFree(value); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2_11> webView11;
        if (SUCCEEDED(instance.webView.As(&webView11)) && webView11) {
            webView11->add_ContextMenuRequested(Microsoft::WRL::Callback<ICoreWebView2ContextMenuRequestedEventHandler>(
                [this, raw](ICoreWebView2*, ICoreWebView2ContextMenuRequestedEventArgs* args) -> HRESULT {
                    Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItemCollection> menuItems;
                    if (FAILED(args->get_MenuItems(&menuItems)) || !menuItems) return S_OK;
                    Microsoft::WRL::ComPtr<ICoreWebView2Environment9> environment9;
                    if (!raw->environment || FAILED(raw->environment.As(&environment9)) || !environment9) return S_OK;
                    Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItem> refreshItem;
                    if (FAILED(environment9->CreateContextMenuItem(L"刷新", nullptr, COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND, &refreshItem)) || !refreshItem) return S_OK;
                    EventRegistrationToken selectedToken = {};
                    refreshItem->add_CustomItemSelected(Microsoft::WRL::Callback<ICoreWebView2CustomItemSelectedEventHandler>(
                        [this, instanceId = raw->id](ICoreWebView2ContextMenuItem*, IUnknown*) -> HRESULT {
                            EdgeView_刷新实例(instanceId);
                            return S_OK;
                        }).Get(), &selectedToken);
                    UINT32 count = 0;
                    menuItems->get_Count(&count);
                    menuItems->InsertValueAtIndex(count, refreshItem.Get());
                    return S_OK;
                }).Get(), &token);
        }
    }
#else
    void EdgeView_调整全部大小() {}
#endif

    std::wstring 选择系统项目(const wchar_t* title, const wchar_t* filter, bool save, bool folder) {
        lastDialogStatus_ = -1;
        IFileDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(
            save ? CLSID_FileSaveDialog : CLSID_FileOpenDialog,
            nullptr,
            CLSCTX_INPROC_SERVER,
            IID_PPV_ARGS(&dialog)
        );
        if (FAILED(result) || !dialog) return L"";
        if (title && title[0]) dialog->SetTitle(title);
        std::vector<std::wstring> filterParts;
        if (filter && filter[0] && !folder) {
            std::wstring source(filter); size_t start = 0;
            while (start <= source.size()) { size_t end = source.find(L'|', start); filterParts.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
            if (filterParts.size() >= 2) {
                std::vector<COMDLG_FILTERSPEC> specs;
                for (size_t index = 0; index + 1 < filterParts.size(); index += 2) specs.push_back({ filterParts[index].c_str(), filterParts[index + 1].c_str() });
                dialog->SetFileTypes(static_cast<UINT>(specs.size()), specs.data()); dialog->SetFileTypeIndex(1);
            }
        }
        if (folder) {
            FILEOPENDIALOGOPTIONS options = {};
            dialog->GetOptions(&options);
            dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
        }
        std::wstring path;
        result = dialog->Show(hwnd_);
        if (SUCCEEDED(result)) {
            lastDialogStatus_ = 1;
            IShellItem* item = nullptr;
            if (SUCCEEDED(dialog->GetResult(&item)) && item) {
                PWSTR value = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &value)) && value) {
                    path = value;
                    CoTaskMemFree(value);
                }
                item->Release();
            }
        } else if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) lastDialogStatus_ = 0;
        dialog->Release();
        return path;
    }

    std::wstring 打开文件(const wchar_t* title, const wchar_t* filter) { return 选择系统项目(title, filter, false, false); }
    std::wstring 保存文件(const wchar_t* title, const wchar_t* filter) { return 选择系统项目(title, filter, true, false); }
    std::wstring 选择文件夹(const wchar_t* title) { return 选择系统项目(title, nullptr, false, true); }
    int 系统对话框_状态() const { return lastDialogStatus_; }

    const FileDialogSpec* FindFileDialog(const wchar_t* componentName) const {
        if (!componentName) return nullptr;
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex != spec_.index) continue;
            if (TextEquals(dialog.name, componentName) || TextEquals(dialog.id, componentName)) return &dialog;
        }
        return nullptr;
    }

    bool OpenFileDialogResource(const FileDialogSpec& spec) {
        lastDialogStatus_ = -1;
        IFileOpenDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
        if (FAILED(result) || !dialog) return false;
        if (spec.title && spec.title[0]) dialog->SetTitle(spec.title);
        FILEOPENDIALOGOPTIONS options = {};
        dialog->GetOptions(&options);
        dialog->SetOptions(options | FOS_FORCEFILESYSTEM | (spec.multiple ? FOS_ALLOWMULTISELECT : 0));
        std::vector<std::wstring> filterParts;
        if (spec.filter && spec.filter[0]) {
            std::wstring source(spec.filter); size_t start = 0;
            while (start <= source.size()) { size_t end = source.find(L'|', start); filterParts.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
            if (filterParts.size() >= 2) {
                std::vector<COMDLG_FILTERSPEC> filters;
                for (size_t index = 0; index + 1 < filterParts.size(); index += 2) filters.push_back({ filterParts[index].c_str(), filterParts[index + 1].c_str() });
                dialog->SetFileTypes(static_cast<UINT>(filters.size()), filters.data());
                dialog->SetFileTypeIndex(1);
            }
        }
        result = dialog->Show(hwnd_);
        if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
            lastDialogStatus_ = 0;
            dialog->Release();
            DispatchDesignerResourceEvent(spec.id, L"Cancelled");
            return false;
        }
        if (FAILED(result)) { dialog->Release(); return false; }
        std::vector<std::wstring> files;
        IShellItemArray* items = nullptr;
        if (SUCCEEDED(dialog->GetResults(&items)) && items) {
            DWORD count = 0; items->GetCount(&count);
            for (DWORD index = 0; index < count; ++index) {
                IShellItem* item = nullptr;
                if (FAILED(items->GetItemAt(index, &item)) || !item) continue;
                PWSTR path = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) { files.emplace_back(path); CoTaskMemFree(path); }
                item->Release();
            }
            items->Release();
        }
        dialog->Release();
        if (!spec.multiple && files.size() > 1) files.resize(1);
        UpdateFileDialogImageTarget(spec, files);
        fileDialogFiles_[spec.id] = std::move(files);
        lastDialogStatus_ = 1;
        DispatchDesignerResourceEvent(spec.id, L"FilesSelected");
        return true;
    }

    bool 文件对话框_打开(const wchar_t* componentName) {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) { lastDialogStatus_ = -1; return false; }
        return OpenFileDialogResource(*dialog);
    }
    bool 文件对话框_清空(const wchar_t* componentName) {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return false;
        fileDialogFiles_[dialog->id].clear();
        return true;
    }
    int 文件对话框_取文件数量(const wchar_t* componentName) const {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return 0;
        auto found = fileDialogFiles_.find(dialog->id);
        return found == fileDialogFiles_.end() ? 0 : static_cast<int>(found->second.size());
    }
    const wchar_t* 文件对话框_取文件(const wchar_t* componentName, int index) const {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return L"";
        auto found = fileDialogFiles_.find(dialog->id);
        return found != fileDialogFiles_.end() && index >= 0 && index < static_cast<int>(found->second.size()) ? found->second[static_cast<size_t>(index)].c_str() : L"";
    }
    bool HandleFileDialogTrigger(int controlId) {
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex == spec_.index && dialog.triggerControlId == controlId) return OpenFileDialogResource(dialog);
        }
        return false;
    }
    bool HasFileDialogDropTarget() const {
        for (int index = 0; index < g_fileDialogCount; ++index) if (g_fileDialogs[index].ownerWindowIndex == spec_.index && g_fileDialogs[index].allowDrop) return true;
        return false;
    }
    bool FileDialogAcceptsPath(const FileDialogSpec& dialog, const std::wstring& path) const {
        if (!dialog.filter || !dialog.filter[0]) return true;
        std::wstring source(dialog.filter); std::wstring patterns; size_t start = 0; int part = 0;
        while (start <= source.size()) {
            size_t end = source.find(L'|', start);
            std::wstring value = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
            if ((part % 2) == 1 && !value.empty()) { if (!patterns.empty()) patterns += L";"; patterns += value; }
            if (end == std::wstring::npos) break;
            start = end + 1; ++part;
        }
        return patterns.empty() || PathMatchSpecW(path.c_str(), patterns.c_str()) == TRUE;
    }
    void UpdateFileDialogImageTarget(const FileDialogSpec& dialog, const std::vector<std::wstring>& files) {
        if (dialog.dropTargetControlId == 0 || files.empty()) return;
        const ControlSpec* control = FindControl(dialog.dropTargetControlId);
        RuntimeControl* runtime = FindRuntimeControl(dialog.dropTargetControlId);
        if (!control || !runtime || !runtime->hwnd || !IsType(*control, L"Image")) return;
        HBITMAP bitmap = LoadWicBitmap(files.front().c_str(), ScaleForDpi(control->width, dpi_), ScaleForDpi(control->height, dpi_), control->option1);
        if (!bitmap) return;
        HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap)));
        if (previous && previous != bitmap) DeleteObject(previous);
        runtime->resource = bitmap;
        runtime->iconResource = false;
        InvalidateRect(runtime->hwnd, nullptr, TRUE);
    }
    bool HandleFileDialogDrop(POINT dropPoint, const std::vector<std::wstring>& files) {
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex != spec_.index || !dialog.allowDrop) continue;
            if (dialog.dropTargetControlId != 0) {
                RuntimeControl* runtime = FindRuntimeControl(dialog.dropTargetControlId);
                if (!runtime || !runtime->hwnd) continue;
                RECT bounds = {}; GetWindowRect(runtime->hwnd, &bounds);
                MapWindowPoints(HWND_DESKTOP, hwnd_, reinterpret_cast<POINT*>(&bounds), 2);
                if (!PtInRect(&bounds, dropPoint)) continue;
            }
            std::vector<std::wstring> accepted;
            for (const auto& path : files) if (FileDialogAcceptsPath(dialog, path)) accepted.push_back(path);
            if (accepted.empty()) return true;
            if (!dialog.multiple && accepted.size() > 1) accepted.resize(1);
            UpdateFileDialogImageTarget(dialog, accepted);
            fileDialogFiles_[dialog.id] = std::move(accepted);
            lastDialogStatus_ = 1;
            DispatchDesignerResourceEvent(dialog.id, L"FilesDropped");
            return true;
        }
        return false;
    }
    int 工具栏_最后命令() const { return lastToolbarCommand_; }
    int 状态栏_最后分区() const { return lastStatusPart_; }
    std::wstring 查找替换_动作() const { return lastFindAction_; }
    std::wstring 查找替换_查找内容() const { return lastFindText_; }
    std::wstring 查找替换_替换内容() const { return lastReplaceText_; }

    int 选择颜色(int defaultColor) {
        lastDialogStatus_ = 0;
        static COLORREF customColors[16] = {};
        CHOOSECOLORW dialog = {};
        dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_;
        dialog.rgbResult = static_cast<COLORREF>(defaultColor); dialog.lpCustColors = customColors;
        dialog.Flags = CC_FULLOPEN | CC_RGBINIT;
        if (!ChooseColorW(&dialog)) return defaultColor;
        lastDialogStatus_ = 1;
        return static_cast<int>(dialog.rgbResult);
    }

    std::wstring 选择字体(int defaultSize) {
        lastDialogStatus_ = 0;
        LOGFONTW font = {};
        wcscpy_s(font.lfFaceName, L"Microsoft YaHei UI");
        font.lfHeight = -MulDiv(defaultSize > 0 ? defaultSize : 12, static_cast<int>(dpi_), 72);
        CHOOSEFONTW dialog = {};
        dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_; dialog.lpLogFont = &font;
        dialog.Flags = CF_SCREENFONTS | CF_INITTOLOGFONTSTRUCT;
        if (!ChooseFontW(&dialog)) return L"";
        lastDialogStatus_ = 1;
        std::wstringstream result;
        result << font.lfFaceName << L"," << (dialog.iPointSize / 10);
        return result.str();
    }

    void 查找文本(const wchar_t* initial) {
        wcsncpy_s(findBuffer_, initial ? initial : L"", _TRUNCATE);
        findReplace_ = {}; findReplace_.lStructSize = sizeof(findReplace_); findReplace_.hwndOwner = hwnd_;
        findReplace_.lpstrFindWhat = findBuffer_; findReplace_.wFindWhatLen = 256;
        findDialog_ = FindTextW(&findReplace_);
        lastDialogStatus_ = findDialog_ ? 1 : -1;
    }

    void 替换文本(const wchar_t* initial, const wchar_t* replacement) {
        wcsncpy_s(findBuffer_, initial ? initial : L"", _TRUNCATE);
        wcsncpy_s(replaceBuffer_, replacement ? replacement : L"", _TRUNCATE);
        findReplace_ = {}; findReplace_.lStructSize = sizeof(findReplace_); findReplace_.hwndOwner = hwnd_;
        findReplace_.lpstrFindWhat = findBuffer_; findReplace_.wFindWhatLen = 256;
        findReplace_.lpstrReplaceWith = replaceBuffer_; findReplace_.wReplaceWithLen = 256;
        findDialog_ = ReplaceTextW(&findReplace_);
        lastDialogStatus_ = findDialog_ ? 1 : -1;
    }

    bool 打印文本(const wchar_t* documentName, const wchar_t* text) {
        lastDialogStatus_ = 0;
        PRINTDLGW dialog = {}; dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_;
        dialog.Flags = PD_RETURNDC | PD_NOPAGENUMS;
        bool accepted = PrintDlgW(&dialog) == TRUE;
        if (accepted && dialog.hDC) {
            DOCINFOW info = {}; info.cbSize = sizeof(info); info.lpszDocName = documentName && documentName[0] ? documentName : L"LingBuilder 文档";
            if (StartDocW(dialog.hDC, &info) > 0) {
                if (StartPage(dialog.hDC) > 0) {
                    RECT area = { 120, 120, GetDeviceCaps(dialog.hDC, HORZRES) - 120, GetDeviceCaps(dialog.hDC, VERTRES) - 120 };
                    std::wstring printable = text ? text : L"";
                    DrawTextW(dialog.hDC, printable.data(), static_cast<int>(printable.size()), &area, DT_LEFT | DT_TOP | DT_WORDBREAK | DT_NOPREFIX);
                    EndPage(dialog.hDC);
                }
                EndDoc(dialog.hDC);
                lastDialogStatus_ = 1;
            } else lastDialogStatus_ = -1;
        }
        if (dialog.hDC) DeleteDC(dialog.hDC);
        if (dialog.hDevMode) GlobalFree(dialog.hDevMode);
        if (dialog.hDevNames) GlobalFree(dialog.hDevNames);
        return accepted;
    }
    bool 打印() { return 打印文本(L"LingBuilder 文档", L""); }

    bool 页面设置() {
        lastDialogStatus_ = 0;
        PAGESETUPDLGW dialog = {}; dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_;
        bool accepted = PageSetupDlgW(&dialog) == TRUE;
        if (accepted) { lastPageMargins_ = dialog.rtMargin; lastDialogStatus_ = 1; }
        if (dialog.hDevMode) GlobalFree(dialog.hDevMode);
        if (dialog.hDevNames) GlobalFree(dialog.hDevNames);
        return accepted;
    }
    int 页面设置_左边距() const { return lastPageMargins_.left; }
    int 页面设置_上边距() const { return lastPageMargins_.top; }
    int 页面设置_右边距() const { return lastPageMargins_.right; }
    int 页面设置_下边距() const { return lastPageMargins_.bottom; }

    int 属性页_显示(const wchar_t* resourceId) {
        const PropertySheetSpec* spec = nullptr;
        for (int index = 0; index < g_propertySheetCount; ++index) if (TextEquals(g_propertySheets[index].id, resourceId)) { spec = &g_propertySheets[index]; break; }
        if (!spec) { lastDialogStatus_ = -1; 调试输出(L"属性页资源不存在。"); return -1; }
        auto rows = DecodeControlRecords(spec->pages, 4);
        if (rows.empty()) { lastDialogStatus_ = -1; 调试输出(L"属性页资源没有页面。"); return -1; }
        std::vector<PropertySheetPageContext> contexts(rows.size());
        std::vector<std::vector<BYTE>> templates(rows.size());
        std::vector<PROPSHEETPAGEW> pages(rows.size());
        std::vector<std::unique_ptr<LingWindowBase>> pageOwners(rows.size());
        for (size_t index = 0; index < rows.size(); ++index) {
            int sourceWindowIndex = _wtoi(rows[index][3].c_str());
            if (sourceWindowIndex >= 0 && sourceWindowIndex < g_windowCount) pageOwners[index].reset(CreateWindowObject(sourceWindowIndex));
            contexts[index] = { rows[index][1].c_str(), rows[index][2].c_str(), spec->id, this, nullptr, pageOwners[index].get(), nullptr };
            if (pageOwners[index]) contexts[index].initialize = [](void* owner, HWND host) { static_cast<LingWindowBase*>(owner)->AttachPropertyPage(host); };
            if (index == 0) contexts[index].applied = [](void* owner, const wchar_t* id) { static_cast<LingWindowBase*>(owner)->DispatchDesignerResourceEvent(id, L"Applied"); };
            templates[index] = BuildPropertySheetTemplate();
            PROPSHEETPAGEW page = {}; page.dwSize = sizeof(page); page.dwFlags = PSP_DLGINDIRECT | PSP_USETITLE;
            page.hInstance = g_instance; page.pResource = reinterpret_cast<LPCDLGTEMPLATE>(templates[index].data());
            page.pszTitle = contexts[index].title; page.pfnDlgProc = GeneratedPropertySheetPageProc; page.lParam = reinterpret_cast<LPARAM>(&contexts[index]);
            pages[index] = page;
        }
        PROPSHEETHEADERW header = {}; header.dwSize = sizeof(header); header.dwFlags = PSH_PROPSHEETPAGE | PSH_PROPTITLE;
        header.hwndParent = hwnd_; header.hInstance = g_instance; header.pszCaption = spec->title;
        header.nPages = static_cast<UINT>(pages.size()); header.ppsp = pages.data();
        INT_PTR result = PropertySheetW(&header); lastDialogStatus_ = result == -1 ? -1 : result == 0 ? 0 : 1;
        for (auto& owner : pageOwners) if (owner) owner->ReleasePropertyPage();
        return static_cast<int>(result);
    }

    int 任务对话框(const wchar_t* title, const wchar_t* content) {
        lastDialogStatus_ = -1;
        int button = 0;
        HRESULT result = TaskDialog(hwnd_, g_instance, title, title, content, TDCBF_OK_BUTTON, TD_INFORMATION_ICON, &button);
        if (FAILED(result)) { int fallback = MessageBoxW(hwnd_, content, title, MB_OK | MB_ICONINFORMATION); lastDialogStatus_ = fallback ? 1 : -1; return fallback; }
        lastDialogStatus_ = 1;
        return button;
    }

    void 结束() {
        if (hwnd_) PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    }

    int 线程_启动延时输出(const wchar_t* text, int delayMs) {
        const int taskId = nextThreadTaskId_.fetch_add(1);
        const std::wstring message = text ? text : L"";
        const int safeDelayMs = (std::max)(0, delayMs);
        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, message, safeDelayMs]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(safeDelayMs));
                std::wstring output = message;
                output += L"\\n";
                OutputDebugStringW(output.c_str());
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) {
            activeThreadTasks_.fetch_sub(1);
            调试输出(L"线程任务启动失败：无法创建后台线程。");
            return 0;
        }
        return taskId;
    }

    void 线程_等待全部() {
        std::vector<std::thread> tasks;
        {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            tasks.swap(threadTasks_);
        }
        for (auto& task : tasks) {
            if (task.joinable()) task.join();
        }
    }

    int 线程_活动数量() const {
        return activeThreadTasks_.load();
    }

    int 线程_硬件并发数() const {
        return static_cast<int>(std::thread::hardware_concurrency());
    }

    void 线程_休眠(int milliseconds) {
        std::this_thread::sleep_for(std::chrono::milliseconds((std::max)(0, milliseconds)));
    }

    int WS_连接(const wchar_t* url) {
        WS_关闭();
        if (!url || !url[0]) {
            调试输出(L"WebSocket 连接失败：地址为空。");
            return 0;
        }

        std::wstring normalizedUrl = url;
        if (normalizedUrl.rfind(L"ws://", 0) == 0) {
            normalizedUrl.replace(0, 5, L"http://");
        } else if (normalizedUrl.rfind(L"wss://", 0) == 0) {
            normalizedUrl.replace(0, 6, L"https://");
        }

        URL_COMPONENTSW parts = {};
        wchar_t host[256] = {};
        wchar_t path[2048] = {};
        parts.dwStructSize = sizeof(parts);
        parts.lpszHostName = host;
        parts.dwHostNameLength = static_cast<DWORD>(_countof(host));
        parts.lpszUrlPath = path;
        parts.dwUrlPathLength = static_cast<DWORD>(_countof(path));

        if (!WinHttpCrackUrl(normalizedUrl.c_str(), 0, 0, &parts)) {
            调试输出(L"WebSocket 连接失败：无法解析地址。");
            return 0;
        }

        bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        if (!(parts.nScheme == INTERNET_SCHEME_HTTP || parts.nScheme == INTERNET_SCHEME_HTTPS)) {
            调试输出(L"WebSocket 连接失败：地址必须使用 ws:// 或 wss://。");
            return 0;
        }

        wsSession_ = WinHttpOpen(L"LingBuilder WebSocket/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        if (!wsSession_) return WS_报告网络错误(L"WebSocket 连接失败：无法创建 WinHTTP 会话。");

        wsConnect_ = WinHttpConnect(wsSession_, host, parts.nPort, 0);
        if (!wsConnect_) return WS_报告网络错误(L"WebSocket 连接失败：无法连接主机。");

        const wchar_t* requestPath = path[0] ? path : L"/";
        DWORD flags = secure ? WINHTTP_FLAG_SECURE : 0;
        wsRequest_ = WinHttpOpenRequest(wsConnect_, L"GET", requestPath, nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
        if (!wsRequest_) return WS_报告网络错误(L"WebSocket 连接失败：无法创建握手请求。");

        if (!WinHttpSetOption(wsRequest_, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0)) {
            return WS_报告网络错误(L"WebSocket 连接失败：无法启用升级握手。");
        }
        if (!WinHttpSendRequest(wsRequest_, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0)) {
            return WS_报告网络错误(L"WebSocket 连接失败：发送握手请求失败。");
        }
        if (!WinHttpReceiveResponse(wsRequest_, nullptr)) {
            return WS_报告网络错误(L"WebSocket 连接失败：服务端握手响应失败。");
        }

        wsSocket_ = WinHttpWebSocketCompleteUpgrade(wsRequest_, 0);
        WinHttpCloseHandle(wsRequest_);
        wsRequest_ = nullptr;
        if (!wsSocket_) return WS_报告网络错误(L"WebSocket 连接失败：协议升级失败。");

        调试输出(L"WebSocket 已连接。");
        return 1;
    }

    int WS_发送文本(const wchar_t* text) {
        if (!wsSocket_) {
            调试输出(L"WebSocket 发送失败：尚未连接。");
            return 0;
        }
        std::string utf8 = WideToUtf8(text ? text : L"");
        DWORD result = WinHttpWebSocketSend(wsSocket_, WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE, utf8.empty() ? nullptr : utf8.data(), static_cast<DWORD>(utf8.size()));
        if (result != ERROR_SUCCESS) {
            SetLastError(result);
            return WS_报告网络错误(L"WebSocket 发送失败。");
        }
        return 1;
    }

    const wchar_t* WS_接收文本() {
        wsLastMessage_.clear();
        if (!wsSocket_) {
            调试输出(L"WebSocket 接收失败：尚未连接。");
            return wsLastMessage_.c_str();
        }

        std::string bytes;
        BYTE buffer[4096];
        WINHTTP_WEB_SOCKET_BUFFER_TYPE bufferType = WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE;
        DWORD bytesRead = 0;

        while (true) {
            DWORD result = WinHttpWebSocketReceive(wsSocket_, buffer, static_cast<DWORD>(sizeof(buffer)), &bytesRead, &bufferType);
            if (result != ERROR_SUCCESS) {
                SetLastError(result);
                WS_报告网络错误(L"WebSocket 接收失败。");
                return wsLastMessage_.c_str();
            }

            if (bufferType == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) {
                调试输出(L"WebSocket 已收到关闭帧。");
                WS_关闭();
                return wsLastMessage_.c_str();
            }

            if (bytesRead > 0) bytes.append(reinterpret_cast<const char*>(buffer), bytesRead);
            if (bufferType == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE || bufferType == WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE) break;
        }

        wsLastMessage_ = Utf8ToWide(bytes);
        return wsLastMessage_.c_str();
    }

    int WS_接收到调试输出() {
        const wchar_t* text = WS_接收文本();
        if (!text || !text[0]) return 0;
        调试输出(text);
        return 1;
    }

    void WS_关闭() {
        if (wsSocket_) {
            WinHttpWebSocketClose(wsSocket_, WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS, nullptr, 0);
            WinHttpCloseHandle(wsSocket_);
            wsSocket_ = nullptr;
        }
        if (wsRequest_) {
            WinHttpCloseHandle(wsRequest_);
            wsRequest_ = nullptr;
        }
        if (wsConnect_) {
            WinHttpCloseHandle(wsConnect_);
            wsConnect_ = nullptr;
        }
        if (wsSession_) {
            WinHttpCloseHandle(wsSession_);
            wsSession_ = nullptr;
        }
        wsLastMessage_.clear();
    }

    int HTTP_启动服务(int port) {
        HTTP_关闭服务();
        if (!EnsureSocketsStarted()) return 0;
        httpListenSocket_ = CreateListenSocket(port, L"HTTP 服务端启动失败");
        if (httpListenSocket_ == INVALID_SOCKET) return 0;
        std::wstring message = L"HTTP 服务端已启动，端口：";
        message += std::to_wstring(port);
        调试输出(message.c_str());
        return 1;
    }

    const wchar_t* HTTP_等待请求() {
        httpLastRequest_.clear();
        if (httpListenSocket_ == INVALID_SOCKET) {
            调试输出(L"HTTP 等待请求失败：服务尚未启动。");
            return httpLastRequest_.c_str();
        }
        CloseSocket(httpClientSocket_);
        httpClientSocket_ = accept(httpListenSocket_, nullptr, nullptr);
        if (httpClientSocket_ == INVALID_SOCKET) {
            ReportSocketError(L"HTTP 等待请求失败。");
            return httpLastRequest_.c_str();
        }
        httpLastRequest_ = Utf8ToWide(ReceiveHttpHeaders(httpClientSocket_));
        return httpLastRequest_.c_str();
    }

    int HTTP_等待请求到调试输出() {
        const wchar_t* request = HTTP_等待请求();
        if (!request || !request[0]) return 0;
        调试输出(request);
        return 1;
    }

    int HTTP_回复文本(const wchar_t* text) {
        if (httpClientSocket_ == INVALID_SOCKET) {
            调试输出(L"HTTP 回复失败：当前没有已接入的请求。");
            return 0;
        }
        std::string body = WideToUtf8(text ? text : L"");
        std::ostringstream response;
        response << "HTTP/1.1 200 OK\\r\\n"
                 << "Content-Type: text/plain; charset=utf-8\\r\\n"
                 << "Content-Length: " << body.size() << "\\r\\n"
                 << "Connection: close\\r\\n\\r\\n"
                 << body;
        const std::string payload = response.str();
        int ok = SendAll(httpClientSocket_, payload.data(), payload.size());
        CloseSocket(httpClientSocket_);
        return ok;
    }

    void HTTP_关闭服务() {
        CloseSocket(httpClientSocket_);
        CloseSocket(httpListenSocket_);
        httpLastRequest_.clear();
    }

    int WSS_启动服务(int port) {
        WSS_关闭服务();
        if (!EnsureSocketsStarted()) return 0;
        wsServerListenSocket_ = CreateListenSocket(port, L"WebSocket 服务端启动失败");
        if (wsServerListenSocket_ == INVALID_SOCKET) return 0;
        std::wstring message = L"WebSocket 服务端已启动，端口：";
        message += std::to_wstring(port);
        调试输出(message.c_str());
        return 1;
    }

    int WSS_等待连接() {
        if (wsServerListenSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端等待连接失败：服务尚未启动。");
            return 0;
        }
        CloseSocket(wsServerClientSocket_);
        wsServerClientSocket_ = accept(wsServerListenSocket_, nullptr, nullptr);
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            ReportSocketError(L"WebSocket 服务端接入失败。");
            return 0;
        }

        std::string request = ReceiveHttpHeaders(wsServerClientSocket_);
        std::string key = ExtractHttpHeader(request, "sec-websocket-key");
        if (key.empty()) {
            调试输出(L"WebSocket 服务端握手失败：缺少 Sec-WebSocket-Key。");
            CloseSocket(wsServerClientSocket_);
            return 0;
        }

        std::string acceptKey = MakeWebSocketAcceptKey(key);
        if (acceptKey.empty()) {
            调试输出(L"WebSocket 服务端握手失败：无法生成握手密钥。");
            CloseSocket(wsServerClientSocket_);
            return 0;
        }

        std::string response =
            "HTTP/1.1 101 Switching Protocols\\r\\n"
            "Upgrade: websocket\\r\\n"
            "Connection: Upgrade\\r\\n"
            "Sec-WebSocket-Accept: " + acceptKey + "\\r\\n\\r\\n";
        if (!SendAll(wsServerClientSocket_, response.data(), response.size())) {
            CloseSocket(wsServerClientSocket_);
            return 0;
        }
        调试输出(L"WebSocket 服务端已完成握手。");
        return 1;
    }

    const wchar_t* WSS_接收文本() {
        wssLastMessage_.clear();
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端接收失败：当前没有客户端连接。");
            return wssLastMessage_.c_str();
        }

        unsigned char header[2] = {};
        if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(header), 2)) {
            ReportSocketError(L"WebSocket 服务端读取帧失败。");
            return wssLastMessage_.c_str();
        }

        const bool masked = (header[1] & 0x80) != 0;
        uint64_t payloadLength = header[1] & 0x7f;
        if (payloadLength == 126) {
            unsigned char ext[2] = {};
            if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(ext), 2)) return wssLastMessage_.c_str();
            payloadLength = (static_cast<uint64_t>(ext[0]) << 8) | ext[1];
        } else if (payloadLength == 127) {
            unsigned char ext[8] = {};
            if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(ext), 8)) return wssLastMessage_.c_str();
            payloadLength = 0;
            for (int i = 0; i < 8; ++i) payloadLength = (payloadLength << 8) | ext[i];
        }
        if (payloadLength > 1024 * 1024) {
            调试输出(L"WebSocket 服务端接收失败：消息超过 1MB 限制。");
            return wssLastMessage_.c_str();
        }

        unsigned char mask[4] = {};
        if (masked && !RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(mask), 4)) return wssLastMessage_.c_str();
        std::string payload(static_cast<size_t>(payloadLength), '\\0');
        if (payloadLength > 0 && !RecvExact(wsServerClientSocket_, payload.data(), static_cast<int>(payload.size()))) return wssLastMessage_.c_str();
        if (masked) {
            for (size_t i = 0; i < payload.size(); ++i) payload[i] = static_cast<char>(payload[i] ^ mask[i % 4]);
        }

        const unsigned char opcode = header[0] & 0x0f;
        if (opcode == 0x8) {
            调试输出(L"WebSocket 服务端已收到关闭帧。");
            CloseSocket(wsServerClientSocket_);
            return wssLastMessage_.c_str();
        }
        wssLastMessage_ = Utf8ToWide(payload);
        return wssLastMessage_.c_str();
    }

    int WSS_接收到调试输出() {
        const wchar_t* text = WSS_接收文本();
        if (!text || !text[0]) return 0;
        调试输出(text);
        return 1;
    }

    int WSS_发送文本(const wchar_t* text) {
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端发送失败：当前没有客户端连接。");
            return 0;
        }
        std::string payload = WideToUtf8(text ? text : L"");
        std::string frame;
        frame.push_back(static_cast<char>(0x81));
        if (payload.size() <= 125) {
            frame.push_back(static_cast<char>(payload.size()));
        } else if (payload.size() <= 65535) {
            frame.push_back(static_cast<char>(126));
            frame.push_back(static_cast<char>((payload.size() >> 8) & 0xff));
            frame.push_back(static_cast<char>(payload.size() & 0xff));
        } else {
            frame.push_back(static_cast<char>(127));
            uint64_t length = static_cast<uint64_t>(payload.size());
            for (int i = 7; i >= 0; --i) frame.push_back(static_cast<char>((length >> (i * 8)) & 0xff));
        }
        frame += payload;
        return SendAll(wsServerClientSocket_, frame.data(), frame.size());
    }

    void WSS_关闭服务() {
        CloseSocket(wsServerClientSocket_);
        CloseSocket(wsServerListenSocket_);
        wssLastMessage_.clear();
    }

    HWND 窗口_打开(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        HWND opened = OpenGeneratedWindowByName(windowName, SW_SHOWNORMAL, placement, x, y, hasCustomPosition);
        if (!opened) {
            std::wstring message = L"未找到要打开的窗口：";
            message += (windowName && windowName[0]) ? windowName : L"(空)";
            调试输出(message.c_str());
        }
        return opened;
    }

    HWND 打开窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    HWND 载入窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    HWND 载入新窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    bool 窗口_取消关闭() {
        if (!closingEventActive_) return false;
        closingCancelled_ = true;
        return true;
    }
    int 窗口_取事件宽度() const { return eventWidth_; }
    int 窗口_取事件高度() const { return eventHeight_; }
    int 窗口_取事件横坐标() const { return eventX_; }
    int 窗口_取事件纵坐标() const { return eventY_; }
    bool 窗口_取是否激活() const { return active_; }
    bool 窗口_取是否可见() const { return hwnd_ && IsWindowVisible(hwnd_) != FALSE; }
    int 窗口_取当前状态() const { return windowState_; }
    int 窗口_取事件键码() const { return eventKeyCode_; }
    const wchar_t* 窗口_取事件字符() const { return eventCharacter_.c_str(); }
    bool 窗口_取Ctrl键状态() const { return eventCtrlDown_; }
    bool 窗口_取Shift键状态() const { return eventShiftDown_; }
    bool 窗口_取Alt键状态() const { return eventAltDown_; }
    bool 窗口_标记按键已处理() {
        if (!keyboardEventActive_) return false;
        keyboardHandled_ = true;
        return true;
    }
    int 窗口_取事件DPI() const { return static_cast<int>(dpi_); }
    int 窗口_取拖入文件数量() const { return static_cast<int>(droppedFiles_.size()); }
    const wchar_t* 窗口_取拖入文件(int index) const {
        return index >= 0 && index < static_cast<int>(droppedFiles_.size())
            ? droppedFiles_[static_cast<size_t>(index)].c_str()
            : L"";
    }

    int 到整数(const std::wstring& value) const {
        if (value.empty()) return 0;
        wchar_t* end = nullptr;
        long converted = wcstol(value.c_str(), &end, 10);
        return end == value.c_str() ? 0 : static_cast<int>(converted);
    }

    bool 控件_设置文本(const wchar_t* controlName, const std::wstring& text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        return SetWindowTextW(runtime->hwnd, text.c_str()) == TRUE;
    }
    bool 控件_设置图片(const wchar_t* controlName, const std::wstring& imagePath) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !runtime->hwnd || !control || !IsType(*control, L"Image")) return false;
        if (imagePath.empty()) {
            HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, 0));
            if (previous) DeleteObject(previous);
            runtime->resource = nullptr;
            runtime->iconResource = false;
            InvalidateRect(runtime->hwnd, nullptr, TRUE);
            return true;
        }
        HBITMAP bitmap = LoadWicBitmap(imagePath.c_str(), ScaleForDpi(control->width, dpi_), ScaleForDpi(control->height, dpi_), control->option1);
        if (!bitmap) return false;
        HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap)));
        if (previous && previous != bitmap) DeleteObject(previous);
        runtime->resource = bitmap;
        runtime->iconResource = false;
        InvalidateRect(runtime->hwnd, nullptr, TRUE);
        return true;
    }
    std::wstring 控件_取文本(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return L"";
        int length = GetWindowTextLengthW(runtime->hwnd); std::wstring value(static_cast<size_t>(length + 1), L'\\0');
        GetWindowTextW(runtime->hwnd, value.data(), length + 1); value.resize(static_cast<size_t>(length)); return value;
    }
    bool 控件_设置启用(const wchar_t* controlName, bool enabled) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        BOOL result = EnableWindow(runtime->hwnd, enabled);
        if (runtime->frameHwnd) EnableWindow(runtime->frameHwnd, enabled);
        return result != FALSE;
    }
    bool 控件_设置可见(const wchar_t* controlName, bool visible) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        ShowWindow(runtime->frameHwnd ? runtime->frameHwnd : runtime->hwnd, visible ? SW_SHOW : SW_HIDE);
        return true;
    }
    bool 控件_设置勾选(const wchar_t* controlName, bool checked) { RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false; SendMessageW(runtime->hwnd, BM_SETCHECK, checked ? BST_CHECKED : BST_UNCHECKED, 0); return true; }
    bool 控件_取勾选(const wchar_t* controlName) { RuntimeControl* runtime = FindRuntimeControlByName(controlName); return runtime && SendMessageW(runtime->hwnd, BM_GETCHECK, 0, 0) != BST_UNCHECKED; }
    bool 控件_设置数值(const wchar_t* controlName, int value) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        value = std::max(control->minimum, std::min(control->maximum, value));
        if (IsType(*control, L"ProgressBar")) SendMessageW(runtime->hwnd, PBM_SETPOS, value, 0);
        else if (IsType(*control, L"TrackBar")) SendMessageW(runtime->hwnd, TBM_SETPOS, TRUE, value);
        else if (IsType(*control, L"UpDown")) SendMessageW(runtime->hwnd, UDM_SETPOS32, 0, value);
        else if (IsType(*control, L"ScrollBar")) SetScrollPos(runtime->hwnd, SB_CTL, value, TRUE);
        else if (IsType(*control, L"FlatScrollBar")) FlatSB_SetScrollPos(runtime->hwnd, (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT, value, TRUE);
        else return false; return true;
    }
    int 控件_取数值(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return 0;
        if (IsType(*control, L"ProgressBar")) return static_cast<int>(SendMessageW(runtime->hwnd, PBM_GETPOS, 0, 0));
        if (IsType(*control, L"TrackBar")) return static_cast<int>(SendMessageW(runtime->hwnd, TBM_GETPOS, 0, 0));
        if (IsType(*control, L"UpDown")) return static_cast<int>(SendMessageW(runtime->hwnd, UDM_GETPOS32, 0, 0));
        if (IsType(*control, L"ScrollBar")) return GetScrollPos(runtime->hwnd, SB_CTL);
        if (IsType(*control, L"FlatScrollBar")) return FlatSB_GetScrollPos(runtime->hwnd, (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT);
        return 0;
    }
    bool 控件_设置选择项(const wchar_t* controlName, int index) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        if (IsType(*control, L"ListBox")) return SendMessageW(runtime->hwnd, LB_SETCURSEL, index, 0) != LB_ERR;
        if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) return SendMessageW(runtime->hwnd, CB_SETCURSEL, index, 0) != CB_ERR;
        if (IsType(*control, L"TabControl")) { TabCtrl_SetCurSel(runtime->hwnd, index); UpdateTabChildren(*control); return true; }
        if (IsType(*control, L"ListView")) { ListView_SetItemState(runtime->hwnd, index, LVIS_SELECTED | LVIS_FOCUSED, LVIS_SELECTED | LVIS_FOCUSED); return true; }
        return false;
    }
    int 控件_取选择项(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return -1;
        if (IsType(*control, L"ListBox")) return static_cast<int>(SendMessageW(runtime->hwnd, LB_GETCURSEL, 0, 0));
        if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) return static_cast<int>(SendMessageW(runtime->hwnd, CB_GETCURSEL, 0, 0));
        if (IsType(*control, L"TabControl")) return TabCtrl_GetCurSel(runtime->hwnd);
        if (IsType(*control, L"ListView")) return ListView_GetNextItem(runtime->hwnd, -1, LVNI_SELECTED);
        return -1;
    }
    int 控件_添加项目(const wchar_t* controlName, const wchar_t* text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return -1;
        if (IsType(*control, L"ListBox")) return static_cast<int>(SendMessageW(runtime->hwnd, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(text)));
        if (IsType(*control, L"ComboBox")) return static_cast<int>(SendMessageW(runtime->hwnd, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(text)));
        if (IsType(*control, L"ComboBoxEx")) { COMBOBOXEXITEMW item = {}; item.mask = CBEIF_TEXT; item.iItem = -1; item.pszText = const_cast<wchar_t*>(text ? text : L""); return static_cast<int>(SendMessageW(runtime->hwnd, CBEM_INSERTITEMW, 0, reinterpret_cast<LPARAM>(&item))); }
        return -1;
    }
    bool 控件_清空项目(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        if (IsType(*control, L"ListBox")) SendMessageW(runtime->hwnd, LB_RESETCONTENT, 0, 0);
        else if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) SendMessageW(runtime->hwnd, CB_RESETCONTENT, 0, 0);
        else if (IsType(*control, L"ListView")) ListView_DeleteAllItems(runtime->hwnd);
        else if (IsType(*control, L"TreeView")) TreeView_DeleteAllItems(runtime->hwnd);
        else if (IsType(*control, L"TabControl")) TabCtrl_DeleteAllItems(runtime->hwnd);
        else return false; return true;
    }
    int 列表视图_添加行(const wchar_t* controlName, const wchar_t* tabSeparatedCells) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"ListView")) return -1;
        std::vector<std::wstring> cells; std::wstring source = tabSeparatedCells ? tabSeparatedCells : L""; size_t start = 0;
        while (start <= source.size()) { size_t end = source.find(L'\t', start); cells.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
        LVITEMW item = {}; item.mask = LVIF_TEXT; item.iItem = ListView_GetItemCount(runtime->hwnd); item.pszText = const_cast<wchar_t*>((cells.empty() ? L"" : cells[0].c_str()));
        int row = ListView_InsertItem(runtime->hwnd, &item); for (int column = 1; row >= 0 && column < static_cast<int>(cells.size()); ++column) ListView_SetItemText(runtime->hwnd, row, column, const_cast<wchar_t*>(cells[column].c_str())); return row;
    }
    bool 树形框_添加节点(const wchar_t* controlName, const wchar_t* parentText, const wchar_t* text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"TreeView")) return false;
        HTREEITEM parent = parentText && parentText[0] ? FindTreeItemByText(runtime->hwnd, TreeView_GetRoot(runtime->hwnd), parentText) : TVI_ROOT;
        TVINSERTSTRUCTW item = {}; item.hParent = parent ? parent : TVI_ROOT; item.hInsertAfter = TVI_LAST; item.item.mask = TVIF_TEXT; item.item.pszText = const_cast<wchar_t*>(text ? text : L""); return TreeView_InsertItem(runtime->hwnd, &item) != nullptr;
    }
    int 选项卡_添加页(const wchar_t* controlName, const wchar_t* title) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"TabControl")) return -1;
        TCITEMW item = {}; item.mask = TCIF_TEXT; item.pszText = const_cast<wchar_t*>(title ? title : L""); int index = TabCtrl_GetItemCount(runtime->hwnd);
        int inserted = TabCtrl_InsertItem(runtime->hwnd, index, &item);
        if (inserted >= 0) UpdateTabHeaderMinimumWidth(*control, *runtime);
        return inserted;
    }
    bool 选项卡_设置隐藏表头(const wchar_t* controlName, bool hidden) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsType(*control, L"TabControl")) return false;
        runtime->hideTabHeader = hidden;
        RECT pageRect = {};
        GetClientRect(runtime->hwnd, &pageRect);
        if (!hidden) {
            SendMessageW(runtime->hwnd, TCM_SETPADDING, 0, MAKELPARAM(TabHeaderHorizontalPadding(), TabHeaderVerticalPadding()));
            UpdateTabHeaderMinimumWidth(*control, *runtime);
            TabCtrl_AdjustRect(runtime->hwnd, FALSE, &pageRect);
        }
        for (auto& page : tabPages_) {
            if (page.tabControlId != control->id) continue;
            page.contentRect = pageRect;
            SetWindowPos(page.hwnd, nullptr, pageRect.left, pageRect.top,
                std::max(0L, pageRect.right - pageRect.left),
                std::max(0L, pageRect.bottom - pageRect.top),
                SWP_NOZORDER | SWP_NOACTIVATE);
        }
        UpdateTabChildren(*control);
        RedrawWindow(runtime->hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN);
        return true;
    }
    bool 选项卡_取隐藏表头(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsType(*control, L"TabControl") && runtime->hideTabHeader;
    }

private:
    bool EnsureSocketsStarted() {
        if (socketsStarted_) return true;
        WSADATA data = {};
        int result = WSAStartup(MAKEWORD(2, 2), &data);
        if (result != 0) {
            std::wstring message = L"网络服务初始化失败，错误码：";
            message += std::to_wstring(result);
            调试输出(message.c_str());
            return false;
        }
        socketsStarted_ = true;
        return true;
    }

    SOCKET CreateListenSocket(int port, const wchar_t* errorPrefix) {
        if (port <= 0 || port > 65535) {
            调试输出(L"服务端启动失败：端口必须在 1 到 65535 之间。");
            return INVALID_SOCKET;
        }

        SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (server == INVALID_SOCKET) {
            ReportSocketError(errorPrefix);
            return INVALID_SOCKET;
        }

        u_long reuse = 1;
        setsockopt(server, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));

        sockaddr_in address = {};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        address.sin_port = htons(static_cast<u_short>(port));
        if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
            ReportSocketError(errorPrefix);
            closesocket(server);
            return INVALID_SOCKET;
        }
        if (listen(server, SOMAXCONN) == SOCKET_ERROR) {
            ReportSocketError(errorPrefix);
            closesocket(server);
            return INVALID_SOCKET;
        }
        return server;
    }

    void CloseSocket(SOCKET& value) {
        if (value != INVALID_SOCKET) {
            shutdown(value, SD_BOTH);
            closesocket(value);
            value = INVALID_SOCKET;
        }
    }

    int ReportSocketError(const wchar_t* prefix) {
        int error = WSAGetLastError();
        std::wstring message = prefix ? prefix : L"网络服务操作失败。";
        message += L" 错误码：";
        message += std::to_wstring(error);
        调试输出(message.c_str());
        return 0;
    }

    int SendAll(SOCKET socketValue, const char* data, size_t length) {
        size_t sentTotal = 0;
        while (sentTotal < length) {
            int sent = send(socketValue, data + sentTotal, static_cast<int>(length - sentTotal), 0);
            if (sent == SOCKET_ERROR || sent == 0) return ReportSocketError(L"网络服务发送失败。");
            sentTotal += static_cast<size_t>(sent);
        }
        return 1;
    }

    bool RecvExact(SOCKET socketValue, char* data, int length) {
        int receivedTotal = 0;
        while (receivedTotal < length) {
            int received = recv(socketValue, data + receivedTotal, length - receivedTotal, 0);
            if (received <= 0) {
                ReportSocketError(L"网络服务接收失败。");
                return false;
            }
            receivedTotal += received;
        }
        return true;
    }

    std::string ReceiveHttpHeaders(SOCKET socketValue) {
        std::string request;
        char buffer[1024];
        while (request.find("\\r\\n\\r\\n") == std::string::npos && request.size() < 64 * 1024) {
            int received = recv(socketValue, buffer, static_cast<int>(sizeof(buffer)), 0);
            if (received <= 0) break;
            request.append(buffer, static_cast<size_t>(received));
        }
        return request;
    }

    static std::string ToLowerAscii(std::string value) {
        std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
        return value;
    }

    static void TrimAscii(std::string& value) {
        const char* whitespace = " \\t\\r\\n";
        size_t first = value.find_first_not_of(whitespace);
        size_t last = value.find_last_not_of(whitespace);
        value = first == std::string::npos ? std::string() : value.substr(first, last - first + 1);
    }

    std::string ExtractHttpHeader(const std::string& request, const std::string& headerName) {
        std::istringstream stream(request);
        std::string line;
        std::string wanted = ToLowerAscii(headerName);
        while (std::getline(stream, line)) {
            size_t colon = line.find(':');
            if (colon == std::string::npos) continue;
            std::string name = ToLowerAscii(line.substr(0, colon));
            TrimAscii(name);
            if (name != wanted) continue;
            std::string value = line.substr(colon + 1);
            TrimAscii(value);
            return value;
        }
        return std::string();
    }

    std::string MakeWebSocketAcceptKey(const std::string& clientKey) {
        const std::string seed = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        HCRYPTPROV provider = 0;
        HCRYPTHASH hash = 0;
        BYTE digest[20] = {};
        DWORD digestSize = sizeof(digest);
        if (!CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) return std::string();
        if (!CryptCreateHash(provider, CALG_SHA1, 0, 0, &hash)) {
            CryptReleaseContext(provider, 0);
            return std::string();
        }
        BOOL ok = CryptHashData(hash, reinterpret_cast<const BYTE*>(seed.data()), static_cast<DWORD>(seed.size()), 0)
            && CryptGetHashParam(hash, HP_HASHVAL, digest, &digestSize, 0);
        CryptDestroyHash(hash);
        CryptReleaseContext(provider, 0);
        return ok ? Base64Encode(digest, digestSize) : std::string();
    }

    static std::string Base64Encode(const BYTE* data, DWORD length) {
        static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string out;
        for (DWORD i = 0; i < length; i += 3) {
            DWORD remaining = length - i;
            BYTE a = data[i];
            BYTE b = remaining > 1 ? data[i + 1] : 0;
            BYTE c = remaining > 2 ? data[i + 2] : 0;
            out.push_back(table[(a >> 2) & 0x3f]);
            out.push_back(table[((a & 0x03) << 4) | ((b >> 4) & 0x0f)]);
            out.push_back(remaining > 1 ? table[((b & 0x0f) << 2) | ((c >> 6) & 0x03)] : '=');
            out.push_back(remaining > 2 ? table[c & 0x3f] : '=');
        }
        return out;
    }

    int WS_报告网络错误(const wchar_t* prefix) {
        DWORD error = GetLastError();
        std::wstring message = prefix ? prefix : L"WebSocket 操作失败。";
        message += L" 错误码：";
        message += std::to_wstring(error);
        调试输出(message.c_str());
        WS_关闭();
        return 0;
    }

    std::string WideToUtf8(const wchar_t* text) {
        if (!text || !text[0]) return std::string();
        int needed = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
        if (needed <= 1) return std::string();
        std::string bytes(static_cast<size_t>(needed), '\\0');
        WideCharToMultiByte(CP_UTF8, 0, text, -1, bytes.data(), needed, nullptr, nullptr);
        bytes.pop_back();
        return bytes;
    }

    std::wstring Utf8ToWide(const std::string& bytes) {
        if (bytes.empty()) return std::wstring();
        int needed = MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
        if (needed <= 0) return std::wstring();
        std::wstring text(static_cast<size_t>(needed), L'\\0');
        MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), text.data(), needed);
        return text;
    }

    HMENU CreateMenuForWindow() {
        std::wstring items = spec_.menuItems ? spec_.menuItems : L"";
        if (items.find_first_not_of(L" \\t\\r\\n,") == std::wstring::npos) return nullptr;
        HMENU root = CreateMenu();
        HMENU windowMenu = CreatePopupMenu();
        size_t pos = 0;
        int index = 0;
        while (!items.empty()) {
            size_t next = items.find(L',', pos);
            std::wstring item = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            trim(item);
            if (!item.empty()) {
                AppendMenuW(windowMenu, MF_OWNERDRAW, 50000 + index, reinterpret_cast<LPCWSTR>(static_cast<ULONG_PTR>(index + 1)));
                ++index;
            }
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        if (index == 0) {
            DestroyMenu(windowMenu);
            DestroyMenu(root);
            return nullptr;
        }
        AppendMenuW(root, MF_POPUP | MF_OWNERDRAW, reinterpret_cast<UINT_PTR>(windowMenu), reinterpret_cast<LPCWSTR>(L"窗口"));
        menuFont_ = CreateControlFont(spec_.menuFontFamily, spec_.menuFontSize, spec_.menuFontBold, spec_.menuFontItalic, spec_.menuFontUnderline, dpi_);
        menuBrush_ = CreateSolidBrush(spec_.menuBackground);
        if (menuBrush_) {
            MENUINFO menuInfo = {};
            menuInfo.cbSize = sizeof(menuInfo);
            menuInfo.fMask = MIM_BACKGROUND;
            menuInfo.hbrBack = menuBrush_;
            SetMenuInfo(root, &menuInfo);
            SetMenuInfo(windowMenu, &menuInfo);
        }
        return root;
    }

    std::wstring GetOwnerDrawMenuText(UINT itemId) const {
        if (itemId < 50000 || itemId >= 50100) return L"窗口";
        std::wstring items = spec_.menuItems ? spec_.menuItems : L"";
        int target = static_cast<int>(itemId) - 50000;
        int index = 0;
        size_t pos = 0;
        while (pos <= items.size()) {
            size_t next = items.find(L',', pos);
            std::wstring text = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            trim(text);
            if (!text.empty() && index++ == target) return text;
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        return L"";
    }

    void PaintMenuBarItem(DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_MENU || !item->itemData || !menuBrush_) return;
        std::wstring text = GetOwnerDrawMenuText(item->itemID);
        FillRect(item->hDC, &item->rcItem, menuBrush_);
        if ((item->itemState & (ODS_SELECTED | ODS_HOTLIGHT)) != 0) {
            COLORREF base = spec_.menuBackground;
            HBRUSH hoverBrush = CreateSolidBrush(RGB(
                std::min(255, static_cast<int>(GetRValue(base)) + 28),
                std::min(255, static_cast<int>(GetGValue(base)) + 28),
                std::min(255, static_cast<int>(GetBValue(base)) + 28)));
            FillRect(item->hDC, &item->rcItem, hoverBrush);
            DeleteObject(hoverBrush);
        }
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, spec_.menuForeground);
        HGDIOBJ oldFont = menuFont_ ? SelectObject(item->hDC, menuFont_) : nullptr;
        RECT textRect = item->rcItem;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right -= ScaleForDpi(8, dpi_);
        DrawTextW(item->hDC, text.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        if (oldFont) SelectObject(item->hDC, oldFont);
    }

    void PaintMenuBarBackground() {
        HMENU menu = hwnd_ ? GetMenu(hwnd_) : nullptr;
        if (!menu || !menuBrush_) return;
        MENUBARINFO info = {};
        info.cbSize = sizeof(info);
        if (!GetMenuBarInfo(hwnd_, OBJID_MENU, 0, &info)) return;
        RECT windowRect = {};
        if (!GetWindowRect(hwnd_, &windowRect)) return;
        RECT barRect = info.rcBar;
        OffsetRect(&barRect, -windowRect.left, -windowRect.top);
        POINT clientOrigin = { 0, 0 };
        if (ClientToScreen(hwnd_, &clientOrigin)) {
            barRect.bottom = std::max(barRect.bottom, clientOrigin.y - windowRect.top);
        }
        HDC hdc = GetWindowDC(hwnd_);
        if (!hdc) return;
        FillRect(hdc, &barRect, menuBrush_);
        int count = GetMenuItemCount(menu);
        for (int position = 0; position < count; ++position) {
            RECT itemRect = {};
            if (!GetMenuItemRect(hwnd_, menu, position, &itemRect)) continue;
            OffsetRect(&itemRect, -windowRect.left, -windowRect.top);
            DRAWITEMSTRUCT item = {};
            item.CtlType = ODT_MENU;
            item.itemID = static_cast<UINT>(-1);
            item.itemState = (GetMenuState(menu, position, MF_BYPOSITION) & MF_HILITE) ? ODS_SELECTED : 0;
            item.hDC = hdc;
            item.rcItem = itemRect;
            item.itemData = reinterpret_cast<ULONG_PTR>(L"窗口");
            PaintMenuBarItem(&item);
        }
        ReleaseDC(hwnd_, hdc);
    }

    static void trim(std::wstring& value) {
        const wchar_t* whitespace = L" \\t\\r\\n";
        size_t first = value.find_first_not_of(whitespace);
        size_t last = value.find_last_not_of(whitespace);
        value = first == std::wstring::npos ? L"" : value.substr(first, last - first + 1);
    }

    const ControlSpec* FindControl(int id) const {
        for (int i = 0; i < spec_.controlCount; ++i) {
            if (spec_.controls[i].id == id) return &spec_.controls[i];
        }
        return nullptr;
    }

    RuntimeControl* FindRuntimeControl(int id) {
        for (auto& control : runtimeControls_) {
            if (control.id == id) return &control;
        }
        return nullptr;
    }

    const RuntimeControl* FindRuntimeControl(int id) const {
        for (const auto& control : runtimeControls_) {
            if (control.id == id) return &control;
        }
        return nullptr;
    }

    const ControlSpec* FindControlByName(const wchar_t* name) const {
        if (!name || !name[0]) return nullptr;
        for (int index = 0; index < spec_.controlCount; ++index) if (TextEquals(spec_.controls[index].name, name)) return &spec_.controls[index];
        return nullptr;
    }

    RuntimeControl* FindRuntimeControlByName(const wchar_t* name) {
        const ControlSpec* control = FindControlByName(name); return control ? FindRuntimeControl(control->id) : nullptr;
    }

    HTREEITEM FindTreeItemByText(HWND tree, HTREEITEM item, const wchar_t* text) {
        while (item) {
            wchar_t buffer[512] = {}; TVITEMW info = {}; info.mask = TVIF_TEXT; info.hItem = item; info.pszText = buffer; info.cchTextMax = 512;
            if (TreeView_GetItem(tree, &info) && TextEquals(buffer, text)) return item;
            HTREEITEM child = TreeView_GetChild(tree, item); HTREEITEM found = child ? FindTreeItemByText(tree, child, text) : nullptr; if (found) return found;
            item = TreeView_GetNextSibling(tree, item);
        }
        return nullptr;
    }

    void SelectRadioControl(const ControlSpec& selected, HWND selectedHwnd) {
        for (auto& runtime : runtimeControls_) {
            const ControlSpec* candidate = FindControl(runtime.id);
            if (!candidate || !IsType(*candidate, L"RadioButton") || candidate->id == selected.id) continue;
            bool sameNamedGroup = selected.option1 && selected.option1[0] && candidate->option1 && std::wcscmp(selected.option1, candidate->option1) == 0;
            bool sameDefaultGroup = (!selected.option1 || !selected.option1[0]) && (!candidate->option1 || !candidate->option1[0]) && candidate->parentId == selected.parentId;
            if (!(sameNamedGroup || sameDefaultGroup)) continue;
            if (SendMessageW(runtime.hwnd, BM_GETCHECK, 0, 0) == BST_CHECKED) {
                SendMessageW(runtime.hwnd, BM_SETCHECK, BST_UNCHECKED, 0);
                InvalidateRect(runtime.hwnd, nullptr, TRUE);
                DispatchLingEvent(*candidate, L"Unchecked");
            }
        }
        SendMessageW(selectedHwnd, BM_SETCHECK, BST_CHECKED, 0);
        InvalidateRect(selectedHwnd, nullptr, TRUE);
        DispatchLingEvent(selected, L"Checked");
    }

    RuntimeTabPage* FindTabPage(int tabControlId, const wchar_t* slot) {
        RuntimeTabPage* first = nullptr;
        for (auto& page : tabPages_) {
            if (page.tabControlId != tabControlId) continue;
            if (!first) first = &page;
            if (slot && slot[0] && page.slot == slot) return &page;
        }
        return first;
    }

    RuntimeTabPage* FindTabPageByHwnd(HWND hwnd) {
        for (auto& page : tabPages_) if (page.hwnd == hwnd) return &page;
        return nullptr;
    }

    COLORREF ResolveTabBackground(const ControlSpec& control) const {
        return control.backgroundTransparent ? GetSysColor(COLOR_WINDOW) : control.background;
    }

    void PaintTabPage(HWND hwnd, HDC hdc) {
        RuntimeTabPage* page = FindTabPageByHwnd(hwnd);
        const ControlSpec* control = page ? FindControl(page->tabControlId) : nullptr;
        RuntimeControl* tabRuntime = page ? FindRuntimeControl(page->tabControlId) : nullptr;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        HBRUSH brush = control && !control->backgroundTransparent
            ? CreateSolidBrush(control->background)
            : GetSysColorBrush(COLOR_WINDOW);
        FillRect(hdc, &clientRect, brush);
        if (control && !control->backgroundTransparent) DeleteObject(brush);
        if (control && (!tabRuntime || !tabRuntime->hideTabHeader)) {
            COLORREF border = BlendColor(ResolveTabBackground(*control), control->foreground, 18);
            HPEN pen = CreatePen(PS_SOLID, 1, border);
            HGDIOBJ oldPen = SelectObject(hdc, pen);
            HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            Rectangle(hdc, clientRect.left, clientRect.top, clientRect.right, clientRect.bottom);
            SelectObject(hdc, oldBrush);
            SelectObject(hdc, oldPen);
            DeleteObject(pen);
        }
    }

    static LRESULT CALLBACK TabPageSubclassProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam, UINT_PTR subclassId, DWORD_PTR referenceData) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (self && message == WM_ERASEBKGND) {
            self->PaintTabPage(hwnd, reinterpret_cast<HDC>(wParam));
            return 1;
        }
        if (self && message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            self->PaintTabPage(hwnd, hdc);
            EndPaint(hwnd, &paint);
            return 0;
        }
        if (self && (
            message == WM_COMMAND || message == WM_NOTIFY || message == WM_HSCROLL || message == WM_VSCROLL
            || message == WM_DRAWITEM || message == WM_MEASUREITEM || message == WM_COMPAREITEM || message == WM_DELETEITEM
            || message == WM_CTLCOLORSTATIC || message == WM_CTLCOLOREDIT || message == WM_CTLCOLORBTN
            || message == WM_CTLCOLORLISTBOX || message == WM_CTLCOLORSCROLLBAR
        )) return SendMessageW(self->hwnd_, message, wParam, lParam);
        if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, TabPageSubclassProc, subclassId);
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    void UpdateTabChildren(const ControlSpec& tabControl) {
        RuntimeControl* tabRuntime = FindRuntimeControl(tabControl.id);
        if (!tabRuntime || !tabRuntime->hwnd) return;
        auto tabs = DecodeControlRecords(tabControl.data, 3);
        int selectedIndex = TabCtrl_GetCurSel(tabRuntime->hwnd);
        std::wstring activeSlot = selectedIndex >= 0 && selectedIndex < static_cast<int>(tabs.size()) ? tabs[selectedIndex][0] : L"";
        RuntimeTabPage* activePage = nullptr;
        for (auto& page : tabPages_) {
            if (page.tabControlId != tabControl.id) continue;
            if (page.slot == activeSlot) activePage = &page;
            else ShowWindow(page.hwnd, SW_HIDE);
        }
        RedrawWindow(tabRuntime->hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_UPDATENOW);
        if (activePage) {
            const RECT& rect = activePage->contentRect;
            SetWindowPos(activePage->hwnd, HWND_TOP, rect.left, rect.top,
                std::max(0L, rect.right - rect.left),
                std::max(0L, rect.bottom - rect.top),
                SWP_NOACTIVATE | SWP_SHOWWINDOW);
            RedrawWindow(activePage->hwnd, nullptr, nullptr,
                RDW_INVALIDATE | RDW_ERASE | RDW_FRAME | RDW_ALLCHILDREN | RDW_UPDATENOW);
        }
    }

    void WireCompositeControls() {
        for (int index = 0; index < spec_.controlCount; ++index) {
            const ControlSpec& control = spec_.controls[index];
            RuntimeControl* runtime = FindRuntimeControl(control.id);
            if (!runtime || !runtime->hwnd) continue;
            if (IsType(control, L"UpDown") && control.option1 && control.option1[0]) {
                RuntimeControl* buddy = FindRuntimeControl(_wtoi(control.option1));
                if (buddy && buddy->hwnd) SendMessageW(runtime->hwnd, UDM_SETBUDDY, reinterpret_cast<WPARAM>(buddy->hwnd), 0);
            } else if (IsType(control, L"ReBar")) {
                auto bands = DecodeControlRecords(control.data, 4);
                for (const auto& band : bands) {
                    RuntimeControl* child = FindRuntimeControl(_wtoi(band[2].c_str()));
                    if (!child || !child->hwnd) continue;
                    REBARBANDINFOW info = {}; info.cbSize = sizeof(info);
                    info.fMask = RBBIM_TEXT | RBBIM_CHILD | RBBIM_CHILDSIZE | RBBIM_SIZE | RBBIM_STYLE;
                    info.fStyle = RBBS_CHILDEDGE | RBBS_GRIPPERALWAYS; info.lpText = const_cast<wchar_t*>(band[1].c_str());
                    info.hwndChild = child->frameHwnd ? child->frameHwnd : child->hwnd; info.cxMinChild = ScaleForDpi(40, dpi_); info.cyMinChild = ScaleForDpi(24, dpi_); info.cx = ScaleForDpi(_wtoi(band[3].c_str()), dpi_);
                    SendMessageW(runtime->hwnd, RB_INSERTBANDW, static_cast<WPARAM>(-1), reinterpret_cast<LPARAM>(&info));
                }
            } else if (IsType(control, L"Pager")) {
                for (auto& candidate : runtimeControls_) {
                    const ControlSpec* child = FindControl(candidate.id);
                    if (child && child->parentId == control.id) { SendMessageW(runtime->hwnd, PGM_SETCHILD, 0, reinterpret_cast<LPARAM>(candidate.frameHwnd ? candidate.frameHwnd : candidate.hwnd)); break; }
                }
            } else if (IsType(control, L"TabControl")) {
                UpdateTabChildren(control);
            }
        }
    }

    void AttachTooltip(HWND child, const ControlSpec& control) {
        if (!control.tooltip || !control.tooltip[0]) return;
        HWND tooltip = CreateWindowExW(WS_EX_TOPMOST, TOOLTIPS_CLASSW, nullptr,
            WS_POPUP | TTS_ALWAYSTIP | TTS_NOPREFIX,
            CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT,
            hwnd_, nullptr, g_instance, nullptr);
        if (!tooltip) return;
        SetWindowPos(tooltip, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        SendMessageW(tooltip, TTM_SETDELAYTIME, TTDT_INITIAL, MAKELPARAM(std::max(0, control.tooltipDelay), 0));
        TOOLINFOW info = {};
        info.cbSize = sizeof(info); info.uFlags = TTF_IDISHWND | TTF_SUBCLASS;
        info.hwnd = hwnd_; info.uId = reinterpret_cast<UINT_PTR>(child);
        info.lpszText = const_cast<wchar_t*>(control.tooltip);
        SendMessageW(tooltip, TTM_ADDTOOLW, 0, reinterpret_cast<LPARAM>(&info));
        tooltipWindows_.push_back(tooltip);
    }

    static COLORREF BlendColor(COLORREF source, COLORREF target, int targetPercent) {
        int percent = std::clamp(targetPercent, 0, 100);
        int sourcePercent = 100 - percent;
        return RGB(
            (GetRValue(source) * sourcePercent + GetRValue(target) * percent + 50) / 100,
            (GetGValue(source) * sourcePercent + GetGValue(target) * percent + 50) / 100,
            (GetBValue(source) * sourcePercent + GetBValue(target) * percent + 50) / 100
        );
    }

    bool IsButtonControl(const ControlSpec& control) const {
        return IsType(control, L"Button")
            || IsType(control, L"CheckBox")
            || IsType(control, L"RadioButton");
    }

    bool IsOwnerDrawControl(const ControlSpec& control) const {
        if (!IsButtonControl(control)) return false;
        if (IsType(control, L"CheckBox") || IsType(control, L"RadioButton")) return true;
        return IsType(control, L"Button")
            && !(control.flags & (CF_BUTTON_TOGGLE | CF_BUTTON_SPLIT | CF_BUTTON_COMMAND_LINK));
    }

    COLORREF ResolveControlSurroundingColor(const ControlSpec& control, HWND controlHwnd) const {
        HWND parentHwnd = controlHwnd ? GetParent(controlHwnd) : nullptr;
        for (const auto& page : tabPages_) {
            if (page.hwnd != parentHwnd) continue;
            const ControlSpec* tabControl = FindControl(page.tabControlId);
            return tabControl ? ResolveTabBackground(*tabControl) : GetSysColor(COLOR_WINDOW);
        }
        if (control.parentId > 0) {
            const ControlSpec* parent = FindControl(control.parentId);
            if (parent) {
                if (!parent->backgroundTransparent) return parent->background;
                const RuntimeControl* parentRuntime = FindRuntimeControl(parent->id);
                return ResolveControlSurroundingColor(*parent, parentRuntime ? parentRuntime->hwnd : nullptr);
            }
        }
        return spec_.background;
    }

    HBRUSH ResolveControlSurroundingBrush(const ControlSpec& control, HWND controlHwnd) const {
        HWND parentHwnd = controlHwnd ? GetParent(controlHwnd) : nullptr;
        for (const auto& page : tabPages_) {
            if (page.hwnd != parentHwnd) continue;
            const ControlSpec* tabControl = FindControl(page.tabControlId);
            if (!tabControl || tabControl->backgroundTransparent) return GetSysColorBrush(COLOR_WINDOW);
            const RuntimeControl* tabRuntime = FindRuntimeControl(page.tabControlId);
            return tabRuntime && tabRuntime->brush ? tabRuntime->brush : GetSysColorBrush(COLOR_WINDOW);
        }
        if (control.parentId > 0) {
            const RuntimeControl* parent = FindRuntimeControl(control.parentId);
            const ControlSpec* parentSpec = FindControl(control.parentId);
            if (parentSpec && parentSpec->backgroundTransparent) {
                return ResolveControlSurroundingBrush(*parentSpec, parent ? parent->hwnd : nullptr);
            }
            if (parent && parent->brush) return parent->brush;
        }
        return windowBrush_;
    }

    int TabHeaderHorizontalPadding() const { return ScaleForDpi(12, dpi_); }
    int TabHeaderVerticalPadding() const { return ScaleForDpi(4, dpi_); }
    int TabHeaderIconGap() const { return ScaleForDpi(6, dpi_); }

    void UpdateTabHeaderMinimumWidth(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.hwnd || runtime.hideTabHeader) return;
        HDC hdc = GetDC(runtime.hwnd);
        if (!hdc) return;
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        HIMAGELIST imageList = TabCtrl_GetImageList(runtime.hwnd);
        int iconWidth = 0;
        int iconHeight = 0;
        if (imageList) ImageList_GetIconSize(imageList, &iconWidth, &iconHeight);
        int minimumWidth = ScaleForDpi(48, dpi_);
        int itemCount = TabCtrl_GetItemCount(runtime.hwnd);
        for (int index = 0; index < itemCount; ++index) {
            wchar_t title[512] = {};
            TCITEMW item = {};
            item.mask = TCIF_TEXT | TCIF_IMAGE;
            item.pszText = title;
            item.cchTextMax = 512;
            item.iImage = -1;
            if (!TabCtrl_GetItem(runtime.hwnd, index, &item)) continue;
            SIZE textSize = {};
            GetTextExtentPoint32W(hdc, title, static_cast<int>(std::wcslen(title)), &textSize);
            int desiredWidth = textSize.cx + TabHeaderHorizontalPadding() * 2;
            if (imageList && item.iImage >= 0) desiredWidth += iconWidth + TabHeaderIconGap();
            minimumWidth = std::max(minimumWidth, desiredWidth);
        }
        if (oldFont) SelectObject(hdc, oldFont);
        ReleaseDC(runtime.hwnd, hdc);
        SendMessageW(runtime.hwnd, TCM_SETMINTABWIDTH, 0, minimumWidth);
        InvalidateRect(runtime.hwnd, nullptr, FALSE);
    }

    void PaintTabControl(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        COLORREF pageBackground = ResolveTabBackground(control);
        COLORREF headerBackground = BlendColor(pageBackground, RGB(0, 0, 0), 8);
        COLORREF selectedBackground = BlendColor(pageBackground, RGB(255, 255, 255), 7);
        COLORREF inactiveForeground = BlendColor(control.foreground, pageBackground, 30);
        COLORREF accent = RGB(245, 158, 11);
        if (runtime.hideTabHeader) {
            HBRUSH pageBrush = CreateSolidBrush(pageBackground);
            FillRect(hdc, &clientRect, pageBrush);
            DeleteObject(pageBrush);
            return;
        }
        HBRUSH headerBrush = CreateSolidBrush(headerBackground);
        FillRect(hdc, &clientRect, headerBrush);
        DeleteObject(headerBrush);

        int selectedIndex = TabCtrl_GetCurSel(hwnd);
        POINT cursor = {};
        GetCursorPos(&cursor);
        ScreenToClient(hwnd, &cursor);
        TCHITTESTINFO hit = { cursor, 0 };
        int hoveredIndex = PtInRect(&clientRect, cursor) ? TabCtrl_HitTest(hwnd, &hit) : -1;
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        HIMAGELIST imageList = TabCtrl_GetImageList(hwnd);
        int iconWidth = 0;
        int iconHeight = 0;
        if (imageList) ImageList_GetIconSize(imageList, &iconWidth, &iconHeight);

        int itemCount = TabCtrl_GetItemCount(hwnd);
        for (int index = 0; index < itemCount; ++index) {
            RECT itemRect = {};
            if (!TabCtrl_GetItemRect(hwnd, index, &itemRect)) continue;
            bool selected = index == selectedIndex;
            bool hovered = index == hoveredIndex && !selected;
            COLORREF itemBackground = selected
                ? selectedBackground
                : hovered ? BlendColor(headerBackground, RGB(255, 255, 255), 5) : headerBackground;
            HBRUSH itemBrush = CreateSolidBrush(itemBackground);
            FillRect(hdc, &itemRect, itemBrush);
            DeleteObject(itemBrush);
            wchar_t title[512] = {};
            TCITEMW tabItem = {};
            tabItem.mask = TCIF_TEXT | TCIF_IMAGE;
            tabItem.pszText = title;
            tabItem.cchTextMax = 512;
            tabItem.iImage = -1;
            TabCtrl_GetItem(hwnd, index, &tabItem);
            int padding = TabHeaderHorizontalPadding();
            RECT textRect = itemRect;
            textRect.left += padding;
            textRect.right -= padding;
            if (imageList && tabItem.iImage >= 0) {
                int iconTop = itemRect.top + (itemRect.bottom - itemRect.top - iconHeight) / 2;
                ImageList_Draw(imageList, tabItem.iImage, hdc, textRect.left, iconTop, ILD_TRANSPARENT);
                textRect.left += iconWidth + TabHeaderIconGap();
            }
            COLORREF textColor = IsWindowEnabled(hwnd)
                ? (selected ? control.foreground : inactiveForeground)
                : BlendColor(control.foreground, itemBackground, 55);
            SetTextColor(hdc, textColor);
            DrawTextW(hdc, title, -1, &textRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
            if (selected) {
                HBRUSH accentBrush = CreateSolidBrush(accent);
                RECT accentRect = { itemRect.left + ScaleForDpi(8, dpi_), itemRect.bottom - ScaleForDpi(2, dpi_), itemRect.right - ScaleForDpi(8, dpi_), itemRect.bottom };
                FillRect(hdc, &accentRect, accentBrush);
                DeleteObject(accentBrush);
            }
        }
        if (oldFont) SelectObject(hdc, oldFont);
    }

    bool PaintOwnerButton(const DRAWITEMSTRUCT* item) {
        if (!item) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime) return false;
        HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        bool pressed = enabled && (item->itemState & ODS_SELECTED);
        bool hovered = enabled && !pressed && runtime->mouseInside;
        bool focused = enabled
            && (item->itemState & ODS_FOCUS)
            && !(item->itemState & ODS_NOFOCUSRECT);
        COLORREF surrounding = ResolveControlSurroundingColor(*control, item->hwndItem);
        COLORREF background = control->background;
        COLORREF rowBackground = control->backgroundTransparent ? surrounding : control->background;
        COLORREF foreground = control->foreground;
        COLORREF border = BlendColor(control->background, RGB(255, 255, 255), 18);
        if (!enabled) {
            background = BlendColor(control->background, surrounding, 55);
            if (!control->backgroundTransparent) rowBackground = background;
            foreground = BlendColor(control->foreground, surrounding, 55);
            border = BlendColor(border, surrounding, 55);
        } else if (pressed) {
            background = BlendColor(control->background, RGB(0, 0, 0), 16);
            border = BlendColor(control->background, RGB(255, 255, 255), 24);
        } else if (hovered) {
            background = BlendColor(control->background, RGB(255, 255, 255), 10);
            border = BlendColor(control->background, RGB(255, 255, 255), 34);
        }
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, foreground);

        if (IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton")) {
            HBRUSH backgroundBrush = CreateSolidBrush(rowBackground);
            FillRect(item->hDC, &item->rcItem, backgroundBrush);
            DeleteObject(backgroundBrush);
            int boxSize = ScaleForDpi(14, dpi_);
            int boxTop = item->rcItem.top + (item->rcItem.bottom - item->rcItem.top - boxSize) / 2;
            RECT box = { item->rcItem.left, boxTop, item->rcItem.left + boxSize, boxTop + boxSize };
            HBRUSH boxBrush = CreateSolidBrush(RGB(17, 24, 39));
            COLORREF boxBorder = enabled
                ? (pressed
                    ? RGB(148, 163, 184)
                    : (hovered || focused) ? RGB(125, 211, 252) : RGB(100, 116, 139))
                : BlendColor(RGB(100, 116, 139), spec_.background, 55);
            HPEN borderPen = CreatePen(PS_SOLID, 1, boxBorder);
            HGDIOBJ oldBrush = SelectObject(item->hDC, boxBrush);
            HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
            if (IsType(*control, L"RadioButton")) Ellipse(item->hDC, box.left, box.top, box.right, box.bottom);
            else Rectangle(item->hDC, box.left, box.top, box.right, box.bottom);
            int checkState = static_cast<int>(SendMessageW(item->hwndItem, BM_GETCHECK, 0, 0));
            if (checkState != BST_UNCHECKED) {
                HPEN markPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(2, dpi_)), foreground);
                HGDIOBJ previousMarkPen = SelectObject(item->hDC, markPen);
                if (IsType(*control, L"RadioButton")) {
                    HBRUSH dot = CreateSolidBrush(foreground);
                    HGDIOBJ previousDotBrush = SelectObject(item->hDC, dot);
                    int inset = ScaleForDpi(4, dpi_); Ellipse(item->hDC, box.left + inset, box.top + inset, box.right - inset, box.bottom - inset);
                    SelectObject(item->hDC, previousDotBrush);
                    DeleteObject(dot);
                } else if (checkState == BST_INDETERMINATE) {
                    int centerY = box.top + boxSize / 2;
                    MoveToEx(item->hDC, box.left + ScaleForDpi(3, dpi_), centerY, nullptr);
                    LineTo(item->hDC, box.right - ScaleForDpi(3, dpi_), centerY);
                } else {
                    MoveToEx(item->hDC, box.left + ScaleForDpi(3, dpi_), box.top + ScaleForDpi(7, dpi_), nullptr);
                    LineTo(item->hDC, box.left + ScaleForDpi(6, dpi_), box.top + ScaleForDpi(10, dpi_));
                    LineTo(item->hDC, box.right - ScaleForDpi(3, dpi_), box.top + ScaleForDpi(4, dpi_));
                }
                SelectObject(item->hDC, previousMarkPen);
                DeleteObject(markPen);
            }
            SelectObject(item->hDC, oldBrush); SelectObject(item->hDC, oldPen);
            DeleteObject(boxBrush); DeleteObject(borderPen);
            RECT textRect = item->rcItem; textRect.left = box.right + ScaleForDpi(8, dpi_);
            DrawTextW(item->hDC, control->text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        } else {
            HBRUSH cornerBrush = CreateSolidBrush(surrounding);
            FillRect(item->hDC, &item->rcItem, cornerBrush);
            DeleteObject(cornerBrush);
            int itemWidth = static_cast<int>(item->rcItem.right - item->rcItem.left);
            int itemHeight = static_cast<int>(item->rcItem.bottom - item->rcItem.top);
            int maxRadius = std::max(0, std::min(itemWidth, itemHeight) / 2);
            int radius = std::clamp(ScaleForDpi(control->cornerRadius, dpi_), 0, maxRadius);
            if (!DrawAntiAliasedRoundedRectangle(item->hDC, item->rcItem, radius, background, border, true)) {
                HBRUSH buttonBrush = CreateSolidBrush(background);
                HPEN borderPen = CreatePen(PS_SOLID, 1, border);
                HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
                HGDIOBJ oldBrush = SelectObject(item->hDC, buttonBrush);
                if (radius == 0) Rectangle(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom);
                else RoundRect(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom, radius * 2, radius * 2);
                SelectObject(item->hDC, oldBrush); SelectObject(item->hDC, oldPen);
                DeleteObject(buttonBrush); DeleteObject(borderPen);
            }
            RECT textRect = item->rcItem;
            if (pressed) OffsetRect(&textRect, ScaleForDpi(1, dpi_), ScaleForDpi(1, dpi_));
            DrawTextW(item->hDC, control->text, -1, &textRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
        if (focused && !IsType(*control, L"CheckBox") && !IsType(*control, L"RadioButton")) {
            RECT focusRect = item->rcItem;
            int focusInset = std::max(ScaleForDpi(3, dpi_), 2);
            InflateRect(&focusRect, -focusInset, -focusInset);
            if (focusRect.right > focusRect.left && focusRect.bottom > focusRect.top) {
                int focusItemWidth = static_cast<int>(item->rcItem.right - item->rcItem.left);
                int focusItemHeight = static_cast<int>(item->rcItem.bottom - item->rcItem.top);
                int outerRadius = std::clamp(ScaleForDpi(control->cornerRadius, dpi_), 0,
                    std::max(0, std::min(focusItemWidth, focusItemHeight) / 2));
                int focusRadius = std::max(0, outerRadius - focusInset);
                if (!DrawAntiAliasedRoundedRectangle(item->hDC, focusRect, focusRadius, RGB(0, 0, 0), RGB(125, 211, 252), false,
                    static_cast<float>(std::max(1, ScaleForDpi(1, dpi_))))) {
                    HPEN focusPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(1, dpi_)), RGB(125, 211, 252));
                    HGDIOBJ oldFocusPen = SelectObject(item->hDC, focusPen);
                    HGDIOBJ oldFocusBrush = SelectObject(item->hDC, GetStockObject(NULL_BRUSH));
                    if (focusRadius == 0) Rectangle(item->hDC, focusRect.left, focusRect.top, focusRect.right, focusRect.bottom);
                    else RoundRect(item->hDC, focusRect.left, focusRect.top, focusRect.right, focusRect.bottom, focusRadius * 2, focusRadius * 2);
                    SelectObject(item->hDC, oldFocusBrush);
                    SelectObject(item->hDC, oldFocusPen);
                    DeleteObject(focusPen);
                }
            }
        }
        if (oldFont) SelectObject(item->hDC, oldFont);
        return true;
    }

    bool PaintOwnerListBox(const DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_LISTBOX) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime || !IsType(*control, L"ListBox")) return false;

        HBRUSH backgroundBrush = CreateSolidBrush(control->background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        bool selected = item->itemID != static_cast<UINT>(-1) && (item->itemState & ODS_SELECTED);
        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        if (selected) {
            RECT selectionRect = item->rcItem;
            int itemSpacing = std::max(0, ScaleForDpi(control->listItemSpacing, dpi_));
            selectionRect.top += itemSpacing / 2;
            selectionRect.bottom -= itemSpacing - itemSpacing / 2;
            InflateRect(&selectionRect, -ScaleForDpi(2, dpi_), -ScaleForDpi(1, dpi_));
            if (selectionRect.right > selectionRect.left && selectionRect.bottom > selectionRect.top) {
                Gdiplus::Graphics graphics(item->hDC);
                graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
                graphics.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
                Gdiplus::RectF bounds(
                    static_cast<Gdiplus::REAL>(selectionRect.left) + 0.5f,
                    static_cast<Gdiplus::REAL>(selectionRect.top) + 0.5f,
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.right - selectionRect.left) - 1.0f),
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.bottom - selectionRect.top) - 1.0f)
                );
                Gdiplus::GraphicsPath path;
                AddRoundedRectanglePath(path, bounds, static_cast<float>(ScaleForDpi(control->listSelectionCornerRadius, dpi_)));
                COLORREF start = enabled ? control->listSelectionStart : BlendColor(control->listSelectionStart, control->background, 55);
                COLORREF end = enabled ? control->listSelectionEnd : BlendColor(control->listSelectionEnd, control->background, 55);
                Gdiplus::PointF gradientStart(bounds.X, bounds.Y);
                Gdiplus::PointF gradientEnd(bounds.GetRight(), bounds.Y);
                Gdiplus::LinearGradientBrush selectionBrush(gradientStart, gradientEnd, ToGdiPlusColor(start), ToGdiPlusColor(end));
                graphics.FillPath(&selectionBrush, &path);
                COLORREF selectionBorder = enabled
                    ? control->listSelectionBorder
                    : BlendColor(control->listSelectionBorder, control->background, 55);
                Gdiplus::Pen borderPen(ToGdiPlusColor(selectionBorder), static_cast<float>(std::max(1, ScaleForDpi(1, dpi_))));
                graphics.DrawPath(&borderPen, &path);
            }
        }

        if (item->itemID != static_cast<UINT>(-1)) {
            int textLength = static_cast<int>(SendMessageW(item->hwndItem, LB_GETTEXTLEN, item->itemID, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\\0');
                SendMessageW(item->hwndItem, LB_GETTEXT, item->itemID, reinterpret_cast<LPARAM>(text.data()));
                HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
                SetBkMode(item->hDC, TRANSPARENT);
                SetTextColor(item->hDC, enabled ? control->foreground : BlendColor(control->foreground, control->background, 55));
                RECT textRect = item->rcItem;
                textRect.left += ScaleForDpi(10, dpi_);
                textRect.right -= ScaleForDpi(8, dpi_);
                DrawTextW(item->hDC, text.data(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
                if (oldFont) SelectObject(item->hDC, oldFont);
            }
        }
        return true;
    }

    void PaintGroupBox(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        if (!hwnd || !hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        HBRUSH backgroundBrush = CreateSolidBrush(control.background);
        FillRect(hdc, &clientRect, backgroundBrush);

        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        RECT titleRect = { 0, 0, 0, 0 };
        DrawTextW(hdc, control.text, -1, &titleRect, DT_CALCRECT | DT_SINGLELINE | DT_NOPREFIX);
        int horizontalPadding = ScaleForDpi(6, dpi_);
        int outerPadding = ScaleForDpi(8, dpi_);
        int titleHeight = std::max(ScaleForDpi(control.fontSize, dpi_), static_cast<int>(titleRect.bottom - titleRect.top));
        int frameTop = std::max(1, titleHeight / 2);
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0,
            std::max(0, std::min(static_cast<int>(clientRect.right - clientRect.left), static_cast<int>(clientRect.bottom - clientRect.top)) / 2));
        if (borderWidth > 0) {
            RECT frameRect = clientRect;
            frameRect.top += frameTop;
            frameRect.right = std::max(frameRect.left, frameRect.right - 1);
            frameRect.bottom = std::max(frameRect.top, frameRect.bottom - 1);
            HPEN borderPen = CreatePen(PS_SOLID, borderWidth, control.listBorderColor);
            HGDIOBJ oldPen = SelectObject(hdc, borderPen);
            HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            Rectangle(hdc, frameRect.left, frameRect.top, frameRect.right, frameRect.bottom);
            SelectObject(hdc, oldBrush);
            SelectObject(hdc, oldPen);
            DeleteObject(borderPen);
        }

        int clientWidth = std::max(0, static_cast<int>(clientRect.right - clientRect.left));
        int titleWidth = std::min(clientWidth, static_cast<int>(titleRect.right - titleRect.left) + horizontalPadding * 2);
        int titleLeft = outerPadding;
        if (TextEquals(control.option1, L"center")) titleLeft = std::max(0, (clientWidth - titleWidth) / 2);
        else if (TextEquals(control.option1, L"right")) titleLeft = std::max(0, clientWidth - titleWidth - outerPadding);
        titleRect.left = titleLeft;
        titleRect.top = 0;
        titleRect.right = std::min(static_cast<int>(clientRect.right), titleLeft + titleWidth);
        titleRect.bottom = std::min(static_cast<int>(clientRect.bottom), titleHeight);
        if (control.text && control.text[0]) {
            FillRect(hdc, &titleRect, backgroundBrush);
            RECT textRect = titleRect;
            textRect.left += horizontalPadding;
            textRect.right -= horizontalPadding;
            SetBkMode(hdc, TRANSPARENT);
            SetTextColor(hdc, IsWindowEnabled(hwnd) ? control.foreground : BlendColor(control.foreground, control.background, 55));
            DrawTextW(hdc, control.text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
        if (oldFont) SelectObject(hdc, oldFont);
        DeleteObject(backgroundBrush);
    }

    bool PaintOwnerComboBox(const DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_COMBOBOX) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime || !IsType(*control, L"ComboBox") || (control->flags & CF_EDITABLE)) return false;

        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        bool collapsedSelection = (item->itemState & ODS_COMBOBOXEDIT) != 0;
        bool selected = !collapsedSelection && item->itemID != static_cast<UINT>(-1) && (item->itemState & ODS_SELECTED);
        HBRUSH backgroundBrush = CreateSolidBrush(control->background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        if (selected) {
            RECT selectionRect = item->rcItem;
            InflateRect(&selectionRect, -ScaleForDpi(2, dpi_), -ScaleForDpi(1, dpi_));
            if (selectionRect.right > selectionRect.left && selectionRect.bottom > selectionRect.top) {
                Gdiplus::Graphics graphics(item->hDC);
                graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
                Gdiplus::RectF bounds(
                    static_cast<Gdiplus::REAL>(selectionRect.left) + 0.5f,
                    static_cast<Gdiplus::REAL>(selectionRect.top) + 0.5f,
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.right - selectionRect.left) - 1.0f),
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.bottom - selectionRect.top) - 1.0f)
                );
                Gdiplus::PointF gradientStart(bounds.X, bounds.Y);
                Gdiplus::PointF gradientEnd(bounds.GetRight(), bounds.Y);
                Gdiplus::LinearGradientBrush selectionBrush(
                    gradientStart, gradientEnd,
                    ToGdiPlusColor(enabled ? control->listSelectionStart : BlendColor(control->listSelectionStart, control->background, 55)),
                    ToGdiPlusColor(enabled ? control->listSelectionEnd : BlendColor(control->listSelectionEnd, control->background, 55))
                );
                graphics.FillRectangle(&selectionBrush, bounds);
            }
        }

        int index = item->itemID == static_cast<UINT>(-1)
            ? static_cast<int>(SendMessageW(item->hwndItem, CB_GETCURSEL, 0, 0))
            : static_cast<int>(item->itemID);
        if (index >= 0) {
            int textLength = static_cast<int>(SendMessageW(item->hwndItem, CB_GETLBTEXTLEN, index, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\\0');
                SendMessageW(item->hwndItem, CB_GETLBTEXT, index, reinterpret_cast<LPARAM>(text.data()));
                HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
                SetBkMode(item->hDC, TRANSPARENT);
                SetTextColor(item->hDC, enabled ? control->foreground : BlendColor(control->foreground, control->background, 55));
                RECT textRect = item->rcItem;
                textRect.left += ScaleForDpi(collapsedSelection ? 8 : 10, dpi_);
                textRect.right -= ScaleForDpi(6, dpi_);
                DrawTextW(item->hDC, text.data(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
                if (oldFont) SelectObject(item->hDC, oldFont);
            }
        }
        return true;
    }

    void PaintCollapsedComboBox(HWND hwnd, HDC hdc, const ControlSpec& control) {
        if (!hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        RECT collapsedRect = clientRect;
        collapsedRect.bottom = std::min(
            collapsedRect.bottom,
            collapsedRect.top + ScaleForDpi(control.height, dpi_)
        );
        if (collapsedRect.right <= collapsedRect.left || collapsedRect.bottom <= collapsedRect.top) return;
        int savedDc = SaveDC(hdc);
        IntersectClipRect(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom);
        const ControlSpec* parent = control.parentId ? FindControl(control.parentId) : nullptr;
        COLORREF surrounding = parent ? parent->background : spec_.background;
        HBRUSH surroundingBrush = CreateSolidBrush(surrounding);
        FillRect(hdc, &collapsedRect, surroundingBrush);
        DeleteObject(surroundingBrush);

        bool enabled = IsWindowEnabled(hwnd) != FALSE;
        COLORREF background = enabled ? control.background : BlendColor(control.background, surrounding, 45);
        COLORREF foreground = enabled ? control.foreground : BlendColor(control.foreground, background, 55);
        COLORREF border = enabled ? control.listBorderColor : BlendColor(control.listBorderColor, background, 55);
        int clientWidth = static_cast<int>(collapsedRect.right - collapsedRect.left);
        int clientHeight = static_cast<int>(collapsedRect.bottom - collapsedRect.top);
        int radius = std::clamp(ScaleForDpi(control.listSelectionCornerRadius, dpi_), 0,
            std::max(0, std::min(clientWidth, clientHeight) / 2));
        if (!DrawAntiAliasedRoundedRectangle(hdc, collapsedRect, radius, background, border, true)) {
            HBRUSH backgroundBrush = CreateSolidBrush(background);
            HPEN borderPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(1, dpi_)), border);
            HGDIOBJ oldBrush = SelectObject(hdc, backgroundBrush);
            HGDIOBJ oldBorderPen = SelectObject(hdc, borderPen);
            if (radius > 0) RoundRect(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom, radius * 2, radius * 2);
            else Rectangle(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom);
            SelectObject(hdc, oldBorderPen);
            SelectObject(hdc, oldBrush);
            DeleteObject(borderPen);
            DeleteObject(backgroundBrush);
        }

        int buttonWidth = std::clamp(clientHeight, ScaleForDpi(24, dpi_), ScaleForDpi(36, dpi_));
        RECT textRect = collapsedRect;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right -= buttonWidth + ScaleForDpi(2, dpi_);
        int selectedIndex = static_cast<int>(SendMessageW(hwnd, CB_GETCURSEL, 0, 0));
        std::wstring selectedText = control.text ? control.text : L"";
        if (selectedIndex >= 0) {
            int textLength = static_cast<int>(SendMessageW(hwnd, CB_GETLBTEXTLEN, selectedIndex, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\\0');
                SendMessageW(hwnd, CB_GETLBTEXT, selectedIndex, reinterpret_cast<LPARAM>(text.data()));
                selectedText.assign(text.data());
            }
        }
        RuntimeControl* runtime = FindRuntimeControl(control.id);
        HFONT oldFont = runtime && runtime->font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime->font)) : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, foreground);
        DrawTextW(hdc, selectedText.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        if (oldFont) SelectObject(hdc, oldFont);

        int centerX = collapsedRect.right - buttonWidth / 2;
        int centerY = (collapsedRect.top + collapsedRect.bottom) / 2;
        COLORREF arrowColor = enabled ? BlendColor(foreground, background, 28) : BlendColor(foreground, background, 55);
        Gdiplus::Graphics arrowGraphics(hdc);
        arrowGraphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
        Gdiplus::Pen arrowPen(ToGdiPlusColor(arrowColor), std::max(1.25f, static_cast<float>(ScaleForDpi(1, dpi_))));
        Gdiplus::PointF arrowPoints[] = {
            { static_cast<Gdiplus::REAL>(centerX - ScaleForDpi(4, dpi_)), static_cast<Gdiplus::REAL>(centerY - ScaleForDpi(2, dpi_)) },
            { static_cast<Gdiplus::REAL>(centerX), static_cast<Gdiplus::REAL>(centerY + ScaleForDpi(2, dpi_)) },
            { static_cast<Gdiplus::REAL>(centerX + ScaleForDpi(4, dpi_)), static_cast<Gdiplus::REAL>(centerY - ScaleForDpi(2, dpi_)) }
        };
        arrowGraphics.DrawLines(&arrowPen, arrowPoints, 3);
        if (savedDc) RestoreDC(hdc, savedDc);
    }

    LRESULT PaintListViewHeader(const ControlSpec& control, NMCUSTOMDRAW* draw) {
        if (!draw) return CDRF_DODEFAULT;
        if (draw->dwDrawStage == CDDS_PREPAINT) return CDRF_NOTIFYITEMDRAW | CDRF_NOTIFYPOSTPAINT;
        if (draw->dwDrawStage == CDDS_POSTPAINT) {
            RECT clientRect = {};
            if (!GetClientRect(draw->hdr.hwndFrom, &clientRect)) return CDRF_DODEFAULT;
            int paintedRight = clientRect.left;
            int itemCount = Header_GetItemCount(draw->hdr.hwndFrom);
            if (itemCount > 0) {
                RECT lastItemRect = {};
                if (Header_GetItemRect(draw->hdr.hwndFrom, itemCount - 1, &lastItemRect)) {
                    paintedRight = (std::min)(clientRect.right, lastItemRect.right);
                }
            }
            if (paintedRight < clientRect.right) {
                COLORREF background = BlendColor(control.background, RGB(255, 255, 255), 12);
                COLORREF border = BlendColor(control.background, RGB(255, 255, 255), 24);
                RECT trailingRect = { paintedRight, clientRect.top, clientRect.right, clientRect.bottom };
                HBRUSH brush = CreateSolidBrush(background);
                FillRect(draw->hdc, &trailingRect, brush);
                DeleteObject(brush);
                HPEN borderPen = CreatePen(PS_SOLID, 1, border);
                HGDIOBJ oldPen = SelectObject(draw->hdc, borderPen);
                MoveToEx(draw->hdc, trailingRect.left, trailingRect.bottom - 1, nullptr);
                LineTo(draw->hdc, trailingRect.right, trailingRect.bottom - 1);
                SelectObject(draw->hdc, oldPen);
                DeleteObject(borderPen);
            }
            return CDRF_DODEFAULT;
        }
        if (draw->dwDrawStage != CDDS_ITEMPREPAINT) return CDRF_DODEFAULT;
        wchar_t text[512] = {};
        HDITEMW item = {};
        item.mask = HDI_TEXT | HDI_FORMAT;
        item.pszText = text;
        item.cchTextMax = 512;
        Header_GetItem(draw->hdr.hwndFrom, static_cast<int>(draw->dwItemSpec), &item);
        COLORREF background = BlendColor(control.background, RGB(255, 255, 255), 12);
        COLORREF border = BlendColor(control.background, RGB(255, 255, 255), 24);
        HBRUSH brush = CreateSolidBrush(background);
        FillRect(draw->hdc, &draw->rc, brush);
        DeleteObject(brush);
        HPEN pen = CreatePen(PS_SOLID, 1, border);
        HGDIOBJ oldPen = SelectObject(draw->hdc, pen);
        MoveToEx(draw->hdc, draw->rc.right - 1, draw->rc.top, nullptr);
        LineTo(draw->hdc, draw->rc.right - 1, draw->rc.bottom);
        MoveToEx(draw->hdc, draw->rc.left, draw->rc.bottom - 1, nullptr);
        LineTo(draw->hdc, draw->rc.right, draw->rc.bottom - 1);
        SelectObject(draw->hdc, oldPen);
        DeleteObject(pen);
        RECT textRect = draw->rc;
        int padding = ScaleForDpi(6, dpi_);
        textRect.left += padding;
        textRect.right -= padding;
        SetBkMode(draw->hdc, TRANSPARENT);
        SetTextColor(draw->hdc, control.foreground);
        UINT format = DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX;
        if (item.fmt & HDF_CENTER) format |= DT_CENTER;
        else if (item.fmt & HDF_RIGHT) format |= DT_RIGHT;
        else format |= DT_LEFT;
        DrawTextW(draw->hdc, text, -1, &textRect, format);
        return CDRF_SKIPDEFAULT;
    }

    void ApplyWindowAppearance() {
        if (!hwnd_) return;
        if (DwmSetWindowAttributeFunction setAttribute = ResolveDwmSetWindowAttribute()) {
            BOOL dark = (GetRValue(spec_.titleBarBackground) * 299 + GetGValue(spec_.titleBarBackground) * 587 + GetBValue(spec_.titleBarBackground) * 114) < 128000;
            const DWORD useImmersiveDarkMode = 20;
            const DWORD cornerPreference = 33;
            const DWORD captionColor = 35;
            const DWORD textColor = 36;
            setAttribute(hwnd_, useImmersiveDarkMode, &dark, sizeof(dark));
            setAttribute(hwnd_, captionColor, &spec_.titleBarBackground, sizeof(spec_.titleBarBackground));
            setAttribute(hwnd_, textColor, &spec_.titleBarForeground, sizeof(spec_.titleBarForeground));
            if (spec_.cornerPreference >= 0) {
                setAttribute(hwnd_, cornerPreference, &spec_.cornerPreference, sizeof(spec_.cornerPreference));
            }
        }
        if (TextEquals(spec_.iconStyle, L"none")) return;
        if (TextEquals(spec_.iconStyle, L"system")) {
            largeWindowIcon_ = LoadIconW(nullptr, IDI_APPLICATION);
            smallWindowIcon_ = largeWindowIcon_;
        } else if (TextEquals(spec_.iconStyle, L"custom") && spec_.iconPath && spec_.iconPath[0]) {
            largeWindowIcon_ = reinterpret_cast<HICON>(LoadImageW(nullptr, spec_.iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
            smallWindowIcon_ = reinterpret_cast<HICON>(LoadImageW(nullptr, spec_.iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
            ownsWindowIcons_ = true;
        } else {
            largeWindowIcon_ = CreateLingBuilderWindowIcon(GetSystemMetrics(SM_CXICON));
            smallWindowIcon_ = CreateLingBuilderWindowIcon(GetSystemMetrics(SM_CXSMICON));
            ownsWindowIcons_ = true;
        }
        if (largeWindowIcon_) SendMessageW(hwnd_, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(largeWindowIcon_));
        if (smallWindowIcon_) SendMessageW(hwnd_, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(smallWindowIcon_));
    }

    void DestroyWindowIcons() {
        if (ownsWindowIcons_) {
            if (largeWindowIcon_) DestroyIcon(largeWindowIcon_);
            if (smallWindowIcon_ && smallWindowIcon_ != largeWindowIcon_) DestroyIcon(smallWindowIcon_);
        }
        largeWindowIcon_ = nullptr;
        smallWindowIcon_ = nullptr;
        ownsWindowIcons_ = false;
    }

    void CreateImageLists() {
        for (int index = 0; index < g_imageListCount; ++index) {
            const ImageListSpec& spec = g_imageLists[index];
            HIMAGELIST list = ImageList_Create(ScaleForDpi(spec.width, dpi_), ScaleForDpi(spec.height, dpi_), ILC_COLOR32 | ILC_MASK, 4, 4);
            if (!list) continue;
            auto images = DecodeControlRecords(spec.images, 1);
            for (const auto& image : images) {
                HBITMAP bitmap = LoadWicBitmap(image[0].c_str(), ScaleForDpi(spec.width, dpi_), ScaleForDpi(spec.height, dpi_), L"fill");
                if (bitmap) { ImageList_Add(list, bitmap, nullptr); DeleteObject(bitmap); }
            }
            imageLists_[spec.id] = list;
        }
    }

    HIMAGELIST FindImageList(const wchar_t* id) const {
        if (!id || !id[0]) return nullptr;
        auto found = imageLists_.find(id);
        return found == imageLists_.end() ? nullptr : found->second;
    }

    void ApplyTextBoxFrameRegion(HWND frameHwnd) {
        if (!frameHwnd) return;
        RECT rect = {}; GetClientRect(frameHwnd, &rect);
        int width = std::max(1, static_cast<int>(rect.right - rect.left));
        int height = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int cornerDiameter = std::max(ScaleForDpi(8, dpi_), 4);
        HRGN region = CreateRoundRectRgn(0, 0, width, height, cornerDiameter, cornerDiameter);
        if (!region) return;
        if (SetWindowRgn(frameHwnd, region, TRUE) == 0) DeleteObject(region);
    }

    void LayoutTextBoxControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int inset = std::max(ScaleForDpi(2, dpi_), 2);
        int contentWidth = std::max(1, frameWidth - inset * 2);
        int contentHeight = std::max(1, frameHeight - inset * 2);
        int editY = inset;
        int editHeight = contentHeight;
        if (!(control.flags & CF_MULTILINE)) {
            int textHeight = std::max(ScaleForDpi(control.fontSize, dpi_), 8);
            HDC hdc = GetDC(runtime.hwnd);
            if (hdc) {
                HGDIOBJ oldFont = runtime.font ? SelectObject(hdc, runtime.font) : nullptr;
                TEXTMETRICW metrics = {};
                if (GetTextMetricsW(hdc, &metrics)) textHeight = metrics.tmHeight + metrics.tmExternalLeading;
                if (oldFont) SelectObject(hdc, oldFont);
                ReleaseDC(runtime.hwnd, hdc);
            }
            editHeight = std::min(contentHeight, std::max(textHeight + ScaleForDpi(4, dpi_), ScaleForDpi(18, dpi_)));
            if (TextEquals(control.data2, L"bottom")) editY = std::max(inset, frameHeight - inset - editHeight);
            else if (!TextEquals(control.data2, L"top")) editY = std::max(inset, (frameHeight - editHeight) / 2);
        }
        SetWindowPos(runtime.hwnd, nullptr, inset, editY, contentWidth, editHeight,
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    static LRESULT CALLBACK TextBoxFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int cornerDiameter = std::max(ScaleForDpi(8, self->dpi_), 4);
                COLORREF borderColor = GetFocus() == runtime->hwnd
                    ? RGB(14, 165, 233)
                    : IsWindowEnabled(runtime->hwnd) ? RGB(51, 65, 85) : RGB(63, 63, 70);
                HBRUSH borderBrush = CreateSolidBrush(borderColor);
                HRGN outerRegion = CreateRoundRectRgn(
                    rect.left, rect.top, rect.right, rect.bottom,
                    cornerDiameter, cornerDiameter
                );
                if (borderBrush && outerRegion) FillRgn(hdc, outerRegion, borderBrush);
                int borderWidth = 1;
                if (rect.right - rect.left > borderWidth * 2 && rect.bottom - rect.top > borderWidth * 2) {
                    HRGN innerRegion = CreateRoundRectRgn(
                        rect.left + borderWidth, rect.top + borderWidth,
                        rect.right - borderWidth, rect.bottom - borderWidth,
                        std::max(2, cornerDiameter - borderWidth * 2),
                        std::max(2, cornerDiameter - borderWidth * 2)
                    );
                    if (innerRegion) {
                        if (runtime->brush) FillRgn(hdc, innerRegion, runtime->brush);
                        DeleteObject(innerRegion);
                    }
                }
                if (outerRegion) DeleteObject(outerRegion);
                if (borderBrush) DeleteObject(borderBrush);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->ApplyTextBoxFrameRegion(hwnd);
            self->LayoutTextBoxControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_LBUTTONDOWN) {
            if (IsWindowEnabled(runtime->hwnd)) SetFocus(runtime->hwnd);
            return 0;
        }
        if (message == WM_SETCURSOR) {
            SetCursor(LoadCursorW(nullptr, IDC_IBEAM));
            return TRUE;
        }
        if (message == WM_ENABLE) {
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, WM_COMMAND, wParam, lParam);
        } else if (message == WM_CTLCOLOREDIT || message == WM_CTLCOLORSTATIC) {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdc, control->foreground);
            SetBkColor(hdc, control->background);
            return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, TextBoxFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    int GetListBoxPageSize(const ControlSpec& control, const RuntimeControl& runtime) const {
        if (!runtime.frameHwnd) return 1;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int contentHeight = std::max(1, frameHeight - contentInset * 2);
        int itemHeight = std::max(1, ScaleForDpi(control.listItemHeight, dpi_));
        int itemSpacing = std::max(0, ScaleForDpi(control.listItemSpacing, dpi_));
        return std::max(1, contentHeight / std::max(1, itemHeight + itemSpacing));
    }

    bool ShouldShowListBoxScrollBar(const ControlSpec& control, const RuntimeControl& runtime) const {
        if (!runtime.hwnd || control.listScrollBarVisibility == 2) return false;
        if (control.listScrollBarVisibility == 1) return true;
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        return itemCount > GetListBoxPageSize(control, runtime);
    }

    bool GetListBoxScrollBarRects(const ControlSpec& control, const RuntimeControl& runtime, RECT& track, RECT& thumb) const {
        if (!runtime.frameHwnd || !runtime.hwnd || !ShouldShowListBoxScrollBar(control, runtime)) return false;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int scrollBarWidth = std::clamp(ScaleForDpi(control.listScrollBarWidth, dpi_), 1, std::max(1, frameWidth - contentInset * 2));
        track = { std::max(contentInset, frameWidth - contentInset - scrollBarWidth), contentInset,
            std::max(contentInset + 1, frameWidth - contentInset), std::max(contentInset + 1, frameHeight - contentInset) };
        int trackHeight = std::max(1, static_cast<int>(track.bottom - track.top));
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int pageSize = GetListBoxPageSize(control, runtime);
        int minimumThumb = std::min(trackHeight, std::max(ScaleForDpi(18, dpi_), scrollBarWidth * 2));
        int thumbHeight = itemCount <= pageSize || itemCount == 0
            ? trackHeight
            : std::max(minimumThumb, trackHeight * pageSize / itemCount);
        thumbHeight = std::min(trackHeight, thumbHeight);
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int topIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        int travel = std::max(0, trackHeight - thumbHeight);
        int thumbTop = track.top + (maximumTopIndex > 0 ? topIndex * travel / maximumTopIndex : 0);
        thumb = { track.left, thumbTop, track.right, thumbTop + thumbHeight };
        return true;
    }

    void SetListBoxScrollFromThumb(const ControlSpec& control, RuntimeControl& runtime, const RECT& track, const RECT& thumb, int desiredThumbTop) {
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int pageSize = GetListBoxPageSize(control, runtime);
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int travel = std::max(0, static_cast<int>((track.bottom - track.top) - (thumb.bottom - thumb.top)));
        int clampedTop = std::clamp(desiredThumbTop, static_cast<int>(track.top), static_cast<int>(track.top) + travel);
        int topIndex = travel > 0 ? (clampedTop - track.top) * maximumTopIndex / travel : 0;
        int currentTopIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        if (topIndex == currentTopIndex) return;
        SendMessageW(runtime.hwnd, LB_SETTOPINDEX, topIndex, 0);
        InvalidateRect(runtime.frameHwnd, nullptr, FALSE);
    }

    void ScrollListBoxByWheel(const ControlSpec& control, RuntimeControl& runtime, WPARAM wParam) {
        if (!runtime.hwnd) return;
        int& remainder = listWheelDeltaRemainders_[control.id];
        remainder += GET_WHEEL_DELTA_WPARAM(wParam);
        int detents = remainder / WHEEL_DELTA;
        remainder %= WHEEL_DELTA;
        if (detents == 0) return;

        UINT configuredLines = 3;
        SystemParametersInfoW(SPI_GETWHEELSCROLLLINES, 0, &configuredLines, 0);
        if (configuredLines == 0) return;
        int pageSize = GetListBoxPageSize(control, runtime);
        int itemsPerDetent = configuredLines == WHEEL_PAGESCROLL
            ? pageSize
            : std::max(1, static_cast<int>(configuredLines));
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int currentTopIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        int nextTopIndex = std::clamp(currentTopIndex - detents * itemsPerDetent, 0, maximumTopIndex);
        if (nextTopIndex == currentTopIndex) return;
        SendMessageW(runtime.hwnd, LB_SETTOPINDEX, nextTopIndex, 0);
        if (runtime.frameHwnd) InvalidateRect(runtime.frameHwnd, nullptr, FALSE);
    }

    void PaintListBoxScrollBar(HDC hdc, const ControlSpec& control, const RuntimeControl& runtime) {
        RECT track = {}, thumb = {};
        if (!GetListBoxScrollBarRects(control, runtime, track, thumb)) return;
        int radius = std::max(1, static_cast<int>(track.right - track.left) / 2);
        COLORREF trackColor = control.enabled ? control.listScrollBarTrack : BlendColor(control.listScrollBarTrack, control.background, 55);
        COLORREF thumbColor = control.enabled ? control.listScrollBarThumb : BlendColor(control.listScrollBarThumb, control.background, 55);
        DrawAntiAliasedRoundedRectangle(hdc, track, radius, trackColor, trackColor, true);
        DrawAntiAliasedRoundedRectangle(hdc, thumb, radius, thumbColor, thumbColor, true);
    }

    void LayoutListBoxControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int scrollBarSpace = ShouldShowListBoxScrollBar(control, runtime)
            ? std::clamp(ScaleForDpi(control.listScrollBarWidth + 2, dpi_), 1, std::max(1, frameWidth - contentInset * 2))
            : 0;
        SetWindowPos(runtime.hwnd, nullptr, contentInset, contentInset,
            std::max(1, frameWidth - contentInset * 2 - scrollBarSpace), std::max(1, frameHeight - contentInset * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    void LayoutListViewControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        SetWindowPos(runtime.hwnd, nullptr, borderWidth, borderWidth,
            std::max(1, frameWidth - borderWidth * 2), std::max(1, frameHeight - borderWidth * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    static LRESULT CALLBACK ListViewFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->listBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->listBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                if (borderWidth == 0 && runtime->brush) FillRect(hdc, &rect, runtime->brush);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutListViewControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_NOTIFY || message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, ListViewFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    void LayoutTreeViewControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.treeBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int horizontalPadding = std::clamp(ScaleForDpi(control.treeNodePadding, dpi_), 0, std::max(0, frameWidth / 4));
        int horizontalInset = std::clamp(borderWidth + horizontalPadding, 0, frameWidth / 2);
        SetWindowPos(runtime.hwnd, nullptr, horizontalInset, borderWidth,
            std::max(1, frameWidth - horizontalInset * 2), std::max(1, frameHeight - borderWidth * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);

        int textHeight = std::max(ScaleForDpi(control.fontSize, dpi_), 8);
        HDC hdc = GetDC(runtime.hwnd);
        if (hdc) {
            HFONT previous = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
            TEXTMETRICW metrics = {};
            if (GetTextMetricsW(hdc, &metrics)) textHeight = std::max(textHeight, static_cast<int>(metrics.tmHeight));
            if (previous) SelectObject(hdc, previous);
            ReleaseDC(runtime.hwnd, hdc);
        }
        int verticalPadding = ScaleForDpi(control.treeNodePadding, dpi_);
        int nodeSpacing = ScaleForDpi(control.treeNodeSpacing, dpi_);
        int itemHeight = std::max(1, textHeight + verticalPadding * 2 + nodeSpacing);
        SendMessageW(runtime.hwnd, TVM_SETITEMHEIGHT, static_cast<WPARAM>(itemHeight), 0);
        SendMessageW(runtime.hwnd, TVM_SETINDENT, static_cast<WPARAM>(std::max(ScaleForDpi(19, dpi_), ScaleForDpi(16 + control.treeNodePadding * 2, dpi_))), 0);
    }

    static LRESULT CALLBACK TreeViewFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->treeBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->treeBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                RECT contentRect = rect;
                InflateRect(&contentRect, -borderWidth, -borderWidth);
                if (runtime->brush && contentRect.right > contentRect.left && contentRect.bottom > contentRect.top) {
                    FillRect(hdc, &contentRect, runtime->brush);
                }
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutTreeViewControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_NOTIFY || message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, TreeViewFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    static LRESULT CALLBACK ListViewHeaderHeightSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        if (message == HDM_LAYOUT && control && lParam) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            HDLAYOUT* layout = reinterpret_cast<HDLAYOUT*>(lParam);
            int height = ScaleForDpi(control->listHeaderHeight, self->dpi_);
            if (layout->pwpos) layout->pwpos->cy = height;
            if (layout->prc) layout->prc->top = height;
            return result;
        }
        if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, ListViewHeaderHeightSubclassProc, subclassId);
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    HIMAGELIST CreateListViewSizingImageList(const ControlSpec& control, HIMAGELIST source) {
        int width = 1;
        int sourceHeight = 1;
        if (source) ImageList_GetIconSize(source, &width, &sourceHeight);
        int height = ScaleForDpi(control.listItemHeight, dpi_);
        int count = source ? ImageList_GetImageCount(source) : 0;
        HIMAGELIST sizing = ImageList_Create(std::max(1, width), std::max(1, height), ILC_COLOR32 | ILC_MASK, std::max(1, count), 1);
        if (!sizing) return source;
        for (int index = 0; index < count; ++index) {
            HICON icon = ImageList_GetIcon(source, index, ILD_TRANSPARENT);
            if (icon) {
                ImageList_AddIcon(sizing, icon);
                DestroyIcon(icon);
            }
        }
        listViewSizingImageLists_[control.id] = sizing;
        return sizing;
    }

    static LRESULT CALLBACK ListBoxFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->listBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->listBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                if (borderWidth == 0) {
                    if (runtime->brush) FillRect(hdc, &rect, runtime->brush);
                } else {
                    RECT contentRect = rect;
                    InflateRect(&contentRect, -borderWidth, -borderWidth);
                    if (contentRect.right > contentRect.left && contentRect.bottom > contentRect.top && runtime->brush) {
                        FillRect(hdc, &contentRect, runtime->brush);
                    }
                }
                self->PaintListBoxScrollBar(hdc, *control, *runtime);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutListBoxControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_MOUSEWHEEL) {
            self->ScrollListBoxByWheel(*control, *runtime, wParam);
            return 0;
        }
        if (message == WM_LBUTTONDOWN) {
            RECT track = {}, thumb = {};
            POINT point = { static_cast<short>(LOWORD(lParam)), static_cast<short>(HIWORD(lParam)) };
            if (self->GetListBoxScrollBarRects(*control, *runtime, track, thumb) && PtInRect(&track, point)) {
                SetFocus(runtime->hwnd);
                if (PtInRect(&thumb, point)) {
                    self->listScrollDragControlId_ = control->id;
                    self->listScrollDragOffset_ = point.y - thumb.top;
                    SetCapture(hwnd);
                } else {
                    int pageSize = self->GetListBoxPageSize(*control, *runtime);
                    int topIndex = static_cast<int>(SendMessageW(runtime->hwnd, LB_GETTOPINDEX, 0, 0));
                    SendMessageW(runtime->hwnd, LB_SETTOPINDEX, std::max(0, topIndex + (point.y < thumb.top ? -pageSize : pageSize)), 0);
                    InvalidateRect(hwnd, nullptr, FALSE);
                }
                return 0;
            }
        }
        if (message == WM_MOUSEMOVE && self->listScrollDragControlId_ == control->id && GetCapture() == hwnd) {
            RECT track = {}, thumb = {};
            if (self->GetListBoxScrollBarRects(*control, *runtime, track, thumb)) {
                int pointerY = static_cast<short>(HIWORD(lParam));
                self->SetListBoxScrollFromThumb(*control, *runtime, track, thumb, pointerY - self->listScrollDragOffset_);
            }
            return 0;
        }
        if ((message == WM_LBUTTONUP || message == WM_CAPTURECHANGED || message == WM_CANCELMODE)
            && self->listScrollDragControlId_ == control->id) {
            self->listScrollDragControlId_ = 0;
            self->listScrollDragOffset_ = 0;
            if (message == WM_LBUTTONUP && GetCapture() == hwnd) ReleaseCapture();
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_COMMAND || message == WM_DRAWITEM || message == WM_MEASUREITEM) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_CTLCOLORLISTBOX) {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdc, control->foreground);
            SetBkColor(hdc, control->background);
            return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, ListBoxFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    static LRESULT CALLBACK ControlSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (control && runtime) {
            if (self->IsUploadControl(*control)) {
                if (message == WM_COMMAND && HIWORD(wParam) == BN_CLICKED) {
                    if (LOWORD(wParam) == 1) self->OpenUploadFileDialog(*control, *runtime);
                    else if (LOWORD(wParam) == 3) self->DispatchLingEvent(*control, L"UploadAction");
                    return 0;
                }
                if (message == WM_CTLCOLORSTATIC || message == WM_CTLCOLORLISTBOX) {
                    HDC hdc = reinterpret_cast<HDC>(wParam);
                    SetTextColor(hdc, control->foreground); SetBkColor(hdc, control->background);
                    return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
                }
                if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, ControlSubclassProc, subclassId);
            }
            if (IsType(*control, L"GroupBox") && (
                message == WM_COMMAND
                || message == WM_NOTIFY
                || message == WM_DRAWITEM
                || message == WM_MEASUREITEM
                || message == WM_COMPAREITEM
                || message == WM_DELETEITEM
                || message == WM_HSCROLL
                || message == WM_VSCROLL
                || message == WM_CTLCOLORBTN
                || message == WM_CTLCOLORSTATIC
                || message == WM_CTLCOLOREDIT
                || message == WM_CTLCOLORLISTBOX
                || message == WM_CTLCOLORSCROLLBAR
            )) {
                return SendMessageW(self->hwnd_, message, wParam, lParam);
            }
            if (message == WM_NOTIFY && IsType(*control, L"ListView")) {
                NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
                if (header && header->code == NM_CUSTOMDRAW && header->hwndFrom == ListView_GetHeader(hwnd)) {
                    return self->PaintListViewHeader(*control, reinterpret_cast<NMCUSTOMDRAW*>(lParam));
                }
            }
            if (message == WM_CTLCOLORLISTBOX) {
                return SendMessageW(self->hwnd_, message, wParam, lParam);
            }
            if (IsType(*control, L"ListBox") && message == WM_MOUSEWHEEL) {
                self->ScrollListBoxByWheel(*control, *runtime, wParam);
                return 0;
            }
            if (IsType(*control, L"ListBox") && (
                message == WM_KEYDOWN
                || message == WM_VSCROLL
                || message == WM_LBUTTONUP
                || message == LB_ADDSTRING
                || message == LB_INSERTSTRING
                || message == LB_DELETESTRING
                || message == LB_RESETCONTENT
                || message == LB_SETTOPINDEX
                || message == LB_SETITEMHEIGHT
                || message == LB_SETCURSEL
                || message == LB_SETSEL
            )) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (runtime->frameHwnd) {
                    if (message == LB_ADDSTRING || message == LB_INSERTSTRING || message == LB_DELETESTRING
                        || message == LB_RESETCONTENT || message == LB_SETITEMHEIGHT) {
                        self->LayoutListBoxControl(*control, *runtime);
                    }
                    InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                }
                return result;
            }
            bool buttonControl = self->IsButtonControl(*control);
            bool ownerDraw = self->IsOwnerDrawControl(*control);
            bool ownerDrawSelection = IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton");
            if (ownerDrawSelection && message == BM_GETCHECK) {
                return static_cast<LRESULT>(runtime->checkState);
            }
            if (ownerDrawSelection && message == BM_SETCHECK) {
                int nextState = wParam == BST_CHECKED
                    ? BST_CHECKED
                    : wParam == BST_INDETERMINATE ? BST_INDETERMINATE : BST_UNCHECKED;
                if (runtime->checkState != nextState) {
                    runtime->checkState = nextState;
                    InvalidateRect(hwnd, nullptr, FALSE);
                    NotifyWinEvent(EVENT_OBJECT_STATECHANGE, hwnd, OBJID_CLIENT, CHILDID_SELF);
                }
                return 0;
            }
            if (message == WM_PAINT && IsType(*control, L"ProgressBar") && !(control->flags & CF_MARQUEE)) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                HDC hdc = GetDC(hwnd);
                if (hdc) {
                    RECT rect = {}; GetClientRect(hwnd, &rect);
                    int minimum = control->minimum;
                    int maximum = std::max(minimum + 1, control->maximum);
                    int current = static_cast<int>(SendMessageW(hwnd, PBM_GETPOS, 0, 0));
                    int percent = std::clamp((current - minimum) * 100 / (maximum - minimum), 0, 100);
                    wchar_t label[16] = {}; swprintf_s(label, L"%d%%", percent);
                    HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime->font)) : nullptr;
                    SetBkMode(hdc, TRANSPARENT);
                    RECT shadowRect = rect; OffsetRect(&shadowRect, 1, 1);
                    SetTextColor(hdc, RGB(24, 24, 28));
                    DrawTextW(hdc, label, -1, &shadowRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
                    SetTextColor(hdc, RGB(255, 255, 255));
                    DrawTextW(hdc, label, -1, &rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
                    if (oldFont) SelectObject(hdc, oldFont);
                    ReleaseDC(hwnd, hdc);
                }
                return result;
            }
            if (IsType(*control, L"GroupBox")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintGroupBox(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintGroupBox(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
            }
            if (IsType(*control, L"TabControl")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintTabControl(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintTabControl(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
                if (message == WM_MOUSEMOVE || message == WM_MOUSELEAVE) InvalidateRect(hwnd, nullptr, FALSE);
                if (message == WM_LBUTTONDOWN || message == WM_LBUTTONUP
                    || message == WM_KEYDOWN || message == WM_KEYUP
                    || message == WM_SETFOCUS || message == WM_KILLFOCUS) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    return result;
                }
            }
            if (IsType(*control, L"ComboBox") && !(control->flags & CF_EDITABLE)) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_NCPAINT) return 0;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintCollapsedComboBox(hwnd, hdc, *control);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintCollapsedComboBox(hwnd, reinterpret_cast<HDC>(wParam), *control);
                    return 0;
                }
            }
            if (message == WM_MOUSEMOVE && !runtime->mouseInside) {
                runtime->mouseInside = true;
                TRACKMOUSEEVENT tracking = { sizeof(TRACKMOUSEEVENT), TME_LEAVE, hwnd, 0 };
                TrackMouseEvent(&tracking);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"MouseEnter");
            } else if (message == WM_MOUSELEAVE) {
                runtime->mouseInside = false;
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"MouseLeave");
            } else if (message == WM_LBUTTONDOWN) {
                if (buttonControl) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    if (!IsWindow(hwnd)) return result;
                    RuntimeControl* liveRuntime = self->FindRuntimeControl(static_cast<int>(subclassId));
                    if (!liveRuntime || liveRuntime->hwnd != hwnd) return result;
                    if (ownerDraw) {
                        InvalidateRect(hwnd, nullptr, FALSE);
                        UpdateWindow(hwnd);
                    }
                    if (!IsWindow(hwnd)) return result;
                    self->DispatchLingEvent(*control, L"MouseDown");
                    return result;
                }
                self->DispatchLingEvent(*control, L"MouseDown");
            } else if (message == WM_SETFOCUS) {
                if (runtime->frameHwnd) InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"GotFocus");
            } else if (message == WM_KILLFOCUS) {
                if (runtime->frameHwnd) InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"LostFocus");
            } else if (message == WM_ENABLE) {
                runtime->mouseInside = false;
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                return result;
            } else if (
                message == WM_LBUTTONUP
                || message == WM_CAPTURECHANGED
                || message == WM_CANCELMODE
                || message == BM_SETSTATE
                || message == BM_SETCHECK
                || ((message == WM_KEYDOWN || message == WM_KEYUP) && wParam == VK_SPACE)
            ) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                return result;
            } else if (message == WM_NCDESTROY) {
                RemoveWindowSubclass(hwnd, ControlSubclassProc, subclassId);
            }
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    bool CreateGeneratedControl(const ControlSpec& control) {
        DWORD style = WS_CHILD | WS_VISIBLE;
        DWORD exStyle = 0;
        const wchar_t* className = L"STATIC";
        const wchar_t* text = control.text;
        HWND parentHwnd = hwnd_;
        int parentContentOffsetX = 0;
        int parentContentOffsetY = 0;
        if (control.parentId > 0) {
            RuntimeControl* parent = FindRuntimeControl(control.parentId);
            if (!parent || !parent->hwnd) return false;
            parentHwnd = parent->hwnd;
            const ControlSpec* parentSpec = FindControl(control.parentId);
            if (parentSpec && IsType(*parentSpec, L"TabControl")) {
                RuntimeTabPage* page = FindTabPage(parentSpec->id, control.containerSlot);
                if (!page || !page->hwnd) return false;
                parentHwnd = page->hwnd;
                parentContentOffsetX = page->contentRect.left;
                parentContentOffsetY = page->contentRect.top;
            }
        }

        if (!control.enabled) style |= WS_DISABLED;
        if (IsType(control, L"Button")) {
            className = L"BUTTON";
            style |= WS_TABSTOP;
            if (!(control.flags & (CF_BUTTON_TOGGLE | CF_BUTTON_SPLIT | CF_BUTTON_COMMAND_LINK))) style |= BS_OWNERDRAW;
            else if (control.flags & CF_BUTTON_DEFAULT) style |= BS_DEFPUSHBUTTON;
            else if (control.flags & CF_BUTTON_TOGGLE) style |= BS_AUTOCHECKBOX | BS_PUSHLIKE;
            else if (control.flags & CF_BUTTON_SPLIT) style |= BS_SPLITBUTTON;
            else if (control.flags & CF_BUTTON_COMMAND_LINK) style |= BS_COMMANDLINK;
            else style |= BS_PUSHBUTTON;
        } else if (IsType(control, L"TextBox")) {
            className = L"EDIT";
            style |= WS_TABSTOP;
            if (control.flags & CF_MULTILINE) style |= ES_MULTILINE | ES_WANTRETURN;
            if (TextEquals(control.option2, L"horizontal") || TextEquals(control.option2, L"both")) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            if (TextEquals(control.option2, L"vertical") || TextEquals(control.option2, L"both")) style |= ES_AUTOVSCROLL | WS_VSCROLL;
            if (!(control.flags & CF_MULTILINE)) style |= ES_AUTOHSCROLL;
            if (control.flags & CF_PASSWORD) style |= ES_PASSWORD;
            if (control.flags & CF_READ_ONLY) style |= ES_READONLY;
            if (control.flags & CF_NUMERIC) style |= ES_NUMBER;
            if (control.flags & CF_ALIGN_CENTER) style |= ES_CENTER;
            if (control.flags & CF_ALIGN_RIGHT) style |= ES_RIGHT;
            exStyle = 0;
        } else if (IsType(control, L"Label")) {
            className = L"STATIC";
            style |= SS_NOTIFY;
            if (TextEquals(control.option1, L"bitmap")) style |= SS_BITMAP | SS_CENTERIMAGE;
            else if (TextEquals(control.option1, L"icon")) style |= SS_ICON | SS_CENTERIMAGE;
            else if (TextEquals(control.option1, L"frame")) style |= SS_BLACKFRAME;
            else if (control.flags & CF_ALIGN_CENTER) style |= SS_CENTER;
            else if (control.flags & CF_ALIGN_RIGHT) style |= SS_RIGHT;
            else style |= SS_LEFT;
        } else if (IsType(control, L"CheckBox")) {
            className = L"BUTTON";
            style |= WS_TABSTOP | BS_OWNERDRAW;
        } else if (IsType(control, L"RadioButton")) {
            className = L"BUTTON";
            style |= WS_TABSTOP | BS_OWNERDRAW;
        } else if (IsType(control, L"GroupBox")) {
            className = L"STATIC";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            exStyle |= WS_EX_CONTROLPARENT;
        } else if (IsType(control, L"ListBox")) {
            className = L"LISTBOX";
            style |= WS_TABSTOP | LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS;
            if (control.flags & CF_SORTED) style |= LBS_SORT;
            if (control.flags & CF_MULTIPLE) style |= LBS_EXTENDEDSEL;
            exStyle = 0;
        } else if (IsType(control, L"ProgressBar")) {
            className = PROGRESS_CLASSW;
            text = L"";
        } else if (IsType(control, L"ComboBox")) {
            className = L"COMBOBOX";
            style |= (control.flags & CF_EDITABLE) ? CBS_DROPDOWN : CBS_DROPDOWNLIST;
            if (!(control.flags & CF_EDITABLE)) style |= CBS_OWNERDRAWFIXED | CBS_HASSTRINGS;
            if (control.flags & CF_SORTED) style |= CBS_SORT;
            style |= WS_VSCROLL;
        } else if (IsType(control, L"ScrollBar")) {
            className = L"SCROLLBAR";
            style |= (control.flags & CF_HORIZONTAL) ? SBS_HORZ : SBS_VERT;
        } else if (IsType(control, L"FlatScrollBar")) {
            className = L"STATIC";
            style |= WS_BORDER | ((control.flags & CF_HORIZONTAL) ? WS_HSCROLL : WS_VSCROLL);
        } else if (IsType(control, L"Image")) {
            className = L"STATIC";
            // Runtime image assignment uses STM_SETIMAGE with IMAGE_BITMAP, so
            // even an initially empty image control must keep the SS_BITMAP
            // type. Otherwise the path can load successfully while the STATIC
            // control still paints as a text placeholder.
            style |= SS_BITMAP | SS_CENTERIMAGE | SS_NOTIFY;
            if (!control.data || !control.data[0]) style |= WS_BORDER;
        } else if (IsType(control, L"Grid")) {
            className = L"STATIC";
            // SS_WHITERECT bypasses WM_CTLCOLORSTATIC and always paints a
            // system-white rectangle. Keep the static control neutral so the
            // shared control brush can paint the designer model background.
            style |= SS_NOTIFY;
            if (control.flags & CF_SHOW_BORDER) style |= WS_BORDER;
        } else if (IsUploadControl(control)) {
            className = L"STATIC";
            text = L"";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            exStyle |= WS_EX_CONTROLPARENT | WS_EX_CLIENTEDGE;
        } else if (IsType(control, L"ListView")) {
            className = WC_LISTVIEWW;
            if (control.flags & CF_VIEW_ICON) style |= LVS_ICON;
            else if (control.flags & CF_VIEW_SMALL_ICON) style |= LVS_SMALLICON;
            else if (control.flags & CF_VIEW_LIST) style |= LVS_LIST;
            else style |= LVS_REPORT;
            style |= LVS_SHOWSELALWAYS;
            if (!(control.flags & CF_MULTIPLE)) style |= LVS_SINGLESEL;
            exStyle = 0;
        } else if (IsType(control, L"TreeView")) {
            className = WC_TREEVIEWW;
            style |= TVS_HASBUTTONS | TVS_NONEVENHEIGHT;
            if (control.flags & CF_SHOW_LINES) style |= TVS_HASLINES | TVS_LINESATROOT;
            if (control.flags & CF_CHECKBOXES) style |= TVS_CHECKBOXES;
            exStyle = 0;
        } else if (IsType(control, L"TabControl")) {
            className = WC_TABCONTROLW;
            style |= WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
        } else if (IsType(control, L"Header")) {
            className = WC_HEADERW;
            // Header controls otherwise apply the common-control top alignment
            // behavior and can stretch into a full-width line at y=0 when their
            // tab page is shown. Keep the designer's explicit bounds instead.
            style |= HDS_BUTTONS | HDS_HORZ | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"ComboBoxEx")) {
            className = WC_COMBOBOXEXW;
            style |= CBS_DROPDOWNLIST;
        } else if (IsType(control, L"SysLink")) {
            className = WC_LINK;
        } else if (IsType(control, L"DateTimePicker")) {
            className = DATETIMEPICK_CLASSW;
            if (TextEquals(control.option1, L"longDate")) style |= DTS_LONGDATEFORMAT;
            else if (TextEquals(control.option1, L"time")) style |= DTS_TIMEFORMAT;
            else style |= DTS_SHORTDATEFORMAT;
        } else if (IsType(control, L"MonthCalendar")) {
            className = MONTHCAL_CLASSW;
            if (control.flags & CF_MULTI_SELECT) style |= MCS_MULTISELECT;
        } else if (IsType(control, L"TrackBar")) {
            className = TRACKBAR_CLASSW;
            style |= TBS_AUTOTICKS;
        } else if (IsType(control, L"UpDown")) {
            className = UPDOWN_CLASSW;
            style |= UDS_ARROWKEYS | UDS_SETBUDDYINT;
        } else if (IsType(control, L"HotKey")) {
            className = HOTKEY_CLASSW;
        } else if (IsType(control, L"IPAddress")) {
            className = WC_IPADDRESSW;
        } else if (IsType(control, L"ToolBar")) {
            className = TOOLBARCLASSNAMEW;
            style |= TBSTYLE_FLAT | TBSTYLE_TOOLTIPS | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"StatusBar")) {
            className = STATUSCLASSNAMEW;
            style |= CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"ReBar")) {
            className = REBARCLASSNAMEW;
            style |= RBS_VARHEIGHT | CCS_NODIVIDER | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"Pager")) {
            className = WC_PAGESCROLLERW;
            if (TextEquals(control.option1, L"vertical")) style |= PGS_VERT;
        } else if (IsType(control, L"RichEdit")) {
            className = MSFTEDIT_CLASS;
            style |= WS_BORDER;
            if (control.flags & CF_MULTILINE) style |= ES_MULTILINE | ES_WANTRETURN;
            if (TextEquals(control.option1, L"horizontal") || TextEquals(control.option1, L"both")) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            if (TextEquals(control.option1, L"vertical") || TextEquals(control.option1, L"both")) style |= ES_AUTOVSCROLL | WS_VSCROLL;
            if (control.flags & CF_READ_ONLY) style |= ES_READONLY;
            if (!(control.flags & CF_WORD_WRAP)) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            exStyle = WS_EX_CLIENTEDGE;
        } else if (IsType(control, L"Animation")) {
            className = ANIMATE_CLASSW;
            style |= ACS_CENTER | ACS_TRANSPARENT;
        }

        int controlX = ScaleForDpi(control.x, dpi_) - parentContentOffsetX;
        int controlY = ScaleForDpi(control.y, dpi_) - parentContentOffsetY;
        int controlWidth = ScaleForDpi(control.width, dpi_);
        int controlHeight = ScaleForDpi(control.height, dpi_);
        HWND frameHwnd = nullptr;
        HWND childParent = parentHwnd;
        int childX = controlX;
        int childY = controlY;
        int childWidth = controlWidth;
        int childHeight = controlHeight;
        if (IsType(control, L"ComboBox")) {
            int dropDownHeight = std::max(control.height, _wtoi(control.option2));
            childHeight = controlHeight + ScaleForDpi(dropDownHeight, dpi_);
        }
        if (IsType(control, L"TextBox") || IsType(control, L"ListBox") || IsType(control, L"ListView") || IsType(control, L"TreeView")) {
            DWORD frameStyle = WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | SS_NOTIFY;
            if (!control.enabled) frameStyle |= WS_DISABLED;
            frameHwnd = CreateWindowExW(
                0, L"STATIC", L"", frameStyle,
                controlX, controlY, controlWidth, controlHeight,
                parentHwnd, nullptr, g_instance, nullptr
            );
            if (!frameHwnd) return false;
            childParent = frameHwnd;
            childX = 0;
            childY = 0;
            childWidth = controlWidth;
            childHeight = controlHeight;
        }

        HWND child = CreateWindowExW(
            exStyle,
            className,
            text,
            style,
            childX,
            childY,
            childWidth,
            childHeight,
            childParent,
            reinterpret_cast<HMENU>(static_cast<INT_PTR>(control.id)),
            g_instance,
            nullptr
        );
        if (!child) {
            if (frameHwnd) DestroyWindow(frameHwnd);
            return false;
        }

        HFONT font = CreateControlFont(control.fontFamily, control.fontSize, control.fontBold, control.fontItalic, control.fontUnderline, dpi_);
        HBRUSH brush = CreateSolidBrush(control.background);
        runtimeControls_.push_back({
            control.id,
            child,
            frameHwnd,
            font,
            brush,
            nullptr,
            false,
            false,
            (control.flags & CF_CHECKED) ? BST_CHECKED : BST_UNCHECKED,
            (control.flags & CF_HIDE_TAB_HEADER) != 0
        });
        SetWindowSubclass(child, ControlSubclassProc, static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
        if (frameHwnd) {
            SetWindowSubclass(frameHwnd,
                IsType(control, L"ListBox") ? ListBoxFrameSubclassProc
                    : IsType(control, L"ListView") ? ListViewFrameSubclassProc
                    : IsType(control, L"TreeView") ? TreeViewFrameSubclassProc
                    : TextBoxFrameSubclassProc,
                static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
        }
        AttachTooltip(child, control);
        HIMAGELIST imageList = FindImageList(IsType(control, L"ListView") ? control.option2 : control.option1);
        if (IsType(control, L"ListView")) {
            ListView_SetImageList(child, CreateListViewSizingImageList(control, imageList), LVSIL_SMALL);
        } else if (imageList) {
            if (IsType(control, L"TreeView")) TreeView_SetImageList(child, imageList, TVSIL_NORMAL);
            else if (IsType(control, L"TabControl")) TabCtrl_SetImageList(child, imageList);
            else if (IsType(control, L"Header")) Header_SetImageList(child, imageList);
            else if (IsType(control, L"ComboBoxEx")) SendMessageW(child, CBEM_SETIMAGELIST, 0, reinterpret_cast<LPARAM>(imageList));
            else if (IsType(control, L"ToolBar")) SendMessageW(child, TB_SETIMAGELIST, 0, reinterpret_cast<LPARAM>(imageList));
        }
        if (font) SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
        if (IsUploadControl(control)) {
            InitializeUploadControl(control, runtimeControls_.back());
        } else if (IsType(control, L"TextBox")) {
            SendMessageW(child, EM_SETMARGINS, EC_LEFTMARGIN | EC_RIGHTMARGIN, MAKELPARAM(ScaleForDpi(10, dpi_), ScaleForDpi(10, dpi_)));
            RuntimeControl& runtime = runtimeControls_.back();
            ApplyTextBoxFrameRegion(frameHwnd);
            LayoutTextBoxControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"ListBox")) {
            RuntimeControl& runtime = runtimeControls_.back();
            SendMessageW(child, LB_SETITEMHEIGHT, 0, ScaleForDpi(control.listItemHeight + control.listItemSpacing, dpi_));
            LayoutListBoxControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"ListView")) {
            RuntimeControl& runtime = runtimeControls_.back();
            LayoutListViewControl(control, runtime);
            HWND header = ListView_GetHeader(child);
            if (header) {
                SetWindowSubclass(header, ListViewHeaderHeightSubclassProc,
                    static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
                SetWindowPos(child, nullptr, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            }
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"TreeView")) {
            RuntimeControl& runtime = runtimeControls_.back();
            LayoutTreeViewControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        }
        if ((IsType(control, L"CheckBox") || IsType(control, L"RadioButton") || IsType(control, L"Button")) && (control.flags & CF_CHECKED)) {
            SendMessageW(child, BM_SETCHECK, BST_CHECKED, 0);
        }
        if (IsType(control, L"ProgressBar")) {
            SendMessageW(child, PBM_SETRANGE32, control.minimum, control.maximum);
            SendMessageW(child, PBM_SETPOS, control.value, 0);
            SendMessageW(child, PBM_SETBKCOLOR, 0, static_cast<LPARAM>(control.background));
            SendMessageW(child, PBM_SETBARCOLOR, 0, static_cast<LPARAM>(control.foreground));
            if (control.flags & CF_MARQUEE) SendMessageW(child, PBM_SETMARQUEE, TRUE, 30);
        } else if (IsType(control, L"ComboBox")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty() && control.text[0]) rows.push_back({ control.text, L"-1" });
            for (const auto& row : rows) SendMessageW(child, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(row[0].c_str()));
            if (!(control.flags & CF_EDITABLE)) {
                SendMessageW(child, CB_SETITEMHEIGHT, static_cast<WPARAM>(-1), std::max(16, controlHeight - ScaleForDpi(6, dpi_)));
                SendMessageW(child, CB_SETITEMHEIGHT, 0, ScaleForDpi(control.listItemHeight, dpi_));
            }
            SendMessageW(child, CB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"SysLink") && control.data && control.data[0]) {
            std::wstring markup = L"<a href=\\\"";
            markup += control.data; markup += L"\\\">"; markup += control.text; markup += L"</a>";
            SetWindowTextW(child, markup.c_str());
        } else if (IsType(control, L"IPAddress") && control.data && control.data[0]) {
            unsigned int a = 0, b = 0, c = 0, d = 0;
            if (swscanf_s(control.data, L"%u.%u.%u.%u", &a, &b, &c, &d) == 4) {
                SendMessageW(child, IPM_SETADDRESS, 0, MAKEIPADDRESS(a, b, c, d));
            }
        } else if (IsType(control, L"DateTimePicker") && TextEquals(control.option1, L"custom") && control.option2 && control.option2[0]) {
            SendMessageW(child, DTM_SETFORMATW, 0, reinterpret_cast<LPARAM>(control.option2));
            SYSTEMTIME date = {}; if (ParseIsoDate(control.data, date)) SendMessageW(child, DTM_SETSYSTEMTIME, GDT_VALID, reinterpret_cast<LPARAM>(&date));
        } else if (IsType(control, L"DateTimePicker")) {
            SYSTEMTIME date = {}; if (ParseIsoDate(control.data, date)) SendMessageW(child, DTM_SETSYSTEMTIME, GDT_VALID, reinterpret_cast<LPARAM>(&date));
        } else if (IsType(control, L"MonthCalendar")) {
            SYSTEMTIME date = {}; if (ParseIsoDate(control.data, date)) {
                if (control.flags & CF_MULTI_SELECT) { SYSTEMTIME range[2] = { date, date }; SendMessageW(child, MCM_SETSELRANGE, 0, reinterpret_cast<LPARAM>(range)); }
                else SendMessageW(child, MCM_SETCURSEL, 0, reinterpret_cast<LPARAM>(&date));
            }
        } else if (IsType(control, L"HotKey")) {
            SendMessageW(child, HKM_SETHOTKEY, ParseHotKeyValue(control.data), 0);
        } else if (IsType(control, L"ListBox")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty() && control.text[0]) rows.push_back({ control.text, L"-1" });
            for (const auto& row : rows) SendMessageW(child, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(row[0].c_str()));
            if (control.flags & CF_MULTIPLE) SendMessageW(child, LB_SETSEL, TRUE, control.selectedIndex);
            else SendMessageW(child, LB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"ScrollBar")) {
            SetScrollRange(child, SB_CTL, control.minimum, control.maximum, FALSE);
            SetScrollPos(child, SB_CTL, control.value, TRUE);
        } else if (IsType(control, L"FlatScrollBar")) {
            InitializeFlatSB(child);
            int bar = (control.flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT;
            FlatSB_SetScrollRange(child, bar, control.minimum, control.maximum, FALSE);
            FlatSB_SetScrollPos(child, bar, control.value, TRUE);
        } else if (IsType(control, L"TrackBar")) {
            SendMessageW(child, TBM_SETRANGE, TRUE, MAKELPARAM(control.minimum, control.maximum));
            SendMessageW(child, TBM_SETPOS, TRUE, control.value);
            SendMessageW(child, TBM_SETTICFREQ, control.selectedIndex > 0 ? control.selectedIndex : 1, 0);
        } else if (IsType(control, L"UpDown")) {
            SendMessageW(child, UDM_SETRANGE32, control.minimum, control.maximum);
            SendMessageW(child, UDM_SETPOS32, 0, control.value);
            if (control.option1 && control.option1[0]) {
                int buddyId = _wtoi(control.option1);
                RuntimeControl* buddy = FindRuntimeControl(buddyId);
                if (buddy && buddy->hwnd) SendMessageW(child, UDM_SETBUDDY, reinterpret_cast<WPARAM>(buddy->hwnd), 0);
            }
        } else if (IsType(control, L"ListView")) {
            DWORD extended = LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER;
            if (control.flags & CF_GRID_LINES) extended |= LVS_EX_GRIDLINES;
            ListView_SetExtendedListViewStyle(child, extended);
            ListView_SetBkColor(child, control.background);
            ListView_SetTextBkColor(child, control.background);
            ListView_SetTextColor(child, control.foreground);
            auto columns = DecodeControlRecords(control.data, 4);
            if (columns.empty()) columns.push_back({ L"内容", L"140", L"-1", L"left" });
            bool alignFirstColumn = !columns.empty() && columns[0][3] != L"left";
            if (alignFirstColumn) {
                wchar_t emptyText[] = L"";
                LVCOLUMNW placeholder = { LVCF_TEXT | LVCF_WIDTH | LVCF_FMT, LVCFMT_LEFT, 0, emptyText };
                ListView_InsertColumn(child, 0, &placeholder);
            }
            for (int index = 0; index < static_cast<int>(columns.size()); ++index) {
                int image = _wtoi(columns[index][2].c_str());
                int format = columns[index][3] == L"center" ? LVCFMT_CENTER : columns[index][3] == L"right" ? LVCFMT_RIGHT : LVCFMT_LEFT;
                LVCOLUMNW column = { static_cast<UINT>(LVCF_TEXT | LVCF_WIDTH | LVCF_FMT | (image >= 0 ? LVCF_IMAGE : 0)), format, ScaleForDpi(_wtoi(columns[index][1].c_str()), dpi_), const_cast<wchar_t*>(columns[index][0].c_str()), 0, 0, image };
                ListView_InsertColumn(child, index + (alignFirstColumn ? 1 : 0), &column);
            }
            if (alignFirstColumn) ListView_DeleteColumn(child, 0);
            auto rows = DecodeControlRecords(control.data2, 3);
            for (int rowIndex = 0; rowIndex < static_cast<int>(rows.size()); ++rowIndex) {
                auto decodedCells = DecodeControlRecords(rows[rowIndex][1].c_str(), static_cast<int>(columns.size()));
                std::vector<std::wstring> cells = decodedCells.empty() ? std::vector<std::wstring>{ rows[rowIndex][0] } : decodedCells[0];
                int image = _wtoi(rows[rowIndex][2].c_str());
                LVITEMW item = { static_cast<UINT>(LVIF_TEXT | (image >= 0 ? LVIF_IMAGE : 0)), rowIndex, 0, 0, 0, const_cast<wchar_t*>(cells[0].c_str()), 0, image };
                int inserted = ListView_InsertItem(child, &item);
                for (int columnIndex = 1; columnIndex < static_cast<int>(cells.size()); ++columnIndex) ListView_SetItemText(child, inserted, columnIndex, const_cast<wchar_t*>(cells[columnIndex].c_str()));
            }
        } else if (IsType(control, L"TreeView")) {
            SendMessageW(child, TVM_SETBKCOLOR, 0, static_cast<LPARAM>(control.background));
            SendMessageW(child, TVM_SETTEXTCOLOR, 0, static_cast<LPARAM>(control.foreground));
            SendMessageW(child, TVM_SETLINECOLOR, 0, static_cast<LPARAM>(control.foreground));
            auto rows = DecodeControlRecords(control.data, 5);
            if (rows.empty() && control.text[0]) rows.push_back({ L"root", L"", control.text, L"-1", L"0" });
            std::map<std::wstring, HTREEITEM> insertedItems;
            for (const auto& row : rows) {
                TVINSERTSTRUCTW item = {};
                auto parent = insertedItems.find(row[1]);
                item.hParent = parent == insertedItems.end() ? TVI_ROOT : parent->second; item.hInsertAfter = TVI_LAST;
                int image = _wtoi(row[3].c_str());
                item.item.mask = TVIF_TEXT | (image >= 0 ? TVIF_IMAGE | TVIF_SELECTEDIMAGE : 0); item.item.pszText = const_cast<wchar_t*>(row[2].c_str()); item.item.iImage = image; item.item.iSelectedImage = image;
                insertedItems[row[0]] = TreeView_InsertItem(child, &item);
            }
            for (const auto& row : rows) {
                auto inserted = insertedItems.find(row[0]);
                if (row[4] == L"1" && inserted != insertedItems.end() && inserted->second) TreeView_Expand(child, inserted->second, TVE_EXPAND);
            }
        } else if (IsType(control, L"TabControl")) {
            auto rows = DecodeControlRecords(control.data, 3);
            if (rows.empty()) rows.push_back({ L"page1", L"标签页 1", L"-1" });
            SendMessageW(child, TCM_SETPADDING, 0, MAKELPARAM(TabHeaderHorizontalPadding(), TabHeaderVerticalPadding()));
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                int image = _wtoi(rows[index][2].c_str());
                TCITEMW item = { static_cast<UINT>(TCIF_TEXT | (image >= 0 ? TCIF_IMAGE : 0)), 0, 0, const_cast<wchar_t*>(rows[index][1].c_str()), 0, image };
                TabCtrl_InsertItem(child, index, &item);
            }
            UpdateTabHeaderMinimumWidth(control, runtimeControls_.back());
            TabCtrl_SetCurSel(child, control.selectedIndex);
            RECT pageRect = { 0, 0, controlWidth, controlHeight };
            if (!runtimeControls_.back().hideTabHeader) TabCtrl_AdjustRect(child, FALSE, &pageRect);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                HWND page = CreateWindowExW(
                    WS_EX_CONTROLPARENT,
                    L"STATIC",
                    L"",
                    WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | SS_NOTIFY,
                    pageRect.left,
                    pageRect.top,
                    std::max(0L, pageRect.right - pageRect.left),
                    std::max(0L, pageRect.bottom - pageRect.top),
                    child,
                    nullptr,
                    g_instance,
                    nullptr
                );
                if (!page) continue;
                SetWindowSubclass(page, TabPageSubclassProc,
                    static_cast<UINT_PTR>(control.id * 1000 + index + 1), reinterpret_cast<DWORD_PTR>(this));
                tabPages_.push_back({ control.id, rows[index][0], page, pageRect });
            }
        } else if (IsType(control, L"StatusBar")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty()) rows.push_back({ control.text, L"140" });
            std::vector<int> edges(rows.size(), 0);
            int edge = 0;
            for (size_t index = 0; index < rows.size(); ++index) { edge += _wtoi(rows[index][1].c_str()); edges[index] = index + 1 == rows.size() ? -1 : ScaleForDpi(edge, dpi_); }
            SendMessageW(child, SB_SETPARTS, static_cast<WPARAM>(edges.size()), reinterpret_cast<LPARAM>(edges.data()));
            for (size_t index = 0; index < rows.size(); ++index) SendMessageW(child, SB_SETTEXTW, index, reinterpret_cast<LPARAM>(rows[index][0].c_str()));
        } else if (IsType(control, L"RichEdit")) {
            SendMessageW(child, EM_SETEVENTMASK, 0, ENM_CHANGE | ENM_SELCHANGE);
            if (control.data && control.data[0]) {
                int byteCount = WideCharToMultiByte(CP_UTF8, 0, control.data, -1, nullptr, 0, nullptr, nullptr);
                RichEditStreamState state;
                if (byteCount > 1) {
                    state.bytes.resize(static_cast<size_t>(byteCount));
                    WideCharToMultiByte(CP_UTF8, 0, control.data, -1, state.bytes.data(), byteCount, nullptr, nullptr);
                    state.bytes.pop_back();
                    EDITSTREAM stream = {}; stream.dwCookie = reinterpret_cast<DWORD_PTR>(&state); stream.pfnCallback = StreamRichEditData;
                    SendMessageW(child, EM_STREAMIN, SF_RTF, reinterpret_cast<LPARAM>(&stream));
                }
            }
        } else if (IsType(control, L"Image") && control.data && control.data[0]) {
            HBITMAP bitmap = LoadWicBitmap(control.data, ScaleForDpi(control.width, dpi_), ScaleForDpi(control.height, dpi_), control.option1);
            if (bitmap) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap));
                RuntimeControl* runtime = FindRuntimeControl(control.id);
                if (runtime) runtime->resource = bitmap;
            }
        } else if (IsType(control, L"Label") && control.data && control.data[0] && TextEquals(control.option1, L"bitmap")) {
            HBITMAP bitmap = LoadWicBitmap(control.data, ScaleForDpi(control.width, dpi_), ScaleForDpi(control.height, dpi_), L"uniform");
            if (bitmap) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap));
                RuntimeControl* runtime = FindRuntimeControl(control.id); if (runtime) runtime->resource = bitmap;
            }
        } else if (IsType(control, L"Label") && control.data && control.data[0] && TextEquals(control.option1, L"icon")) {
            HICON icon = reinterpret_cast<HICON>(LoadImageW(nullptr, control.data, IMAGE_ICON, control.width, control.height, LR_LOADFROMFILE));
            if (icon) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_ICON, reinterpret_cast<LPARAM>(icon));
                RuntimeControl* runtime = FindRuntimeControl(control.id); if (runtime) { runtime->resource = icon; runtime->iconResource = true; }
            }
        } else if (IsType(control, L"Header")) {
            auto rows = DecodeControlRecords(control.data, 3);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                HDITEMW item = {}; int image = _wtoi(rows[index][2].c_str()); item.mask = HDI_TEXT | HDI_WIDTH | (image >= 0 ? HDI_IMAGE : 0); item.cxy = ScaleForDpi(_wtoi(rows[index][1].c_str()), dpi_); item.pszText = const_cast<wchar_t*>(rows[index][0].c_str()); item.iImage = image;
                Header_InsertItem(child, index, &item);
            }
        } else if (IsType(control, L"ComboBoxEx")) {
            auto rows = DecodeControlRecords(control.data, 2);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                COMBOBOXEXITEMW item = {}; int image = _wtoi(rows[index][1].c_str()); item.mask = CBEIF_TEXT | (image >= 0 ? CBEIF_IMAGE | CBEIF_SELECTEDIMAGE : 0); item.iItem = index; item.pszText = const_cast<wchar_t*>(rows[index][0].c_str()); item.iImage = image; item.iSelectedImage = image;
                SendMessageW(child, CBEM_INSERTITEMW, 0, reinterpret_cast<LPARAM>(&item));
            }
            SendMessageW(child, CB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"ToolBar")) {
            SendMessageW(child, TB_BUTTONSTRUCTSIZE, sizeof(TBBUTTON), 0);
            auto rows = DecodeControlRecords(control.data, 4);
            if (rows.empty() && control.text[0]) rows.push_back({ L"1", control.text, L"-1", L"button" });
            for (const auto& row : rows) {
                int logicalCommand = _wtoi(row[0].c_str());
                int nativeCommand = nextToolbarCommandId_ <= 65534 ? nextToolbarCommandId_++ : control.id;
                toolbarCommandOwners_[nativeCommand] = control.id;
                toolbarCommandValues_[nativeCommand] = logicalCommand > 0 ? logicalCommand : control.id;
                TBBUTTON button = {}; button.idCommand = nativeCommand; button.fsState = TBSTATE_ENABLED;
                button.fsStyle = row[3] == L"separator" ? BTNS_SEP : row[3] == L"check" ? BTNS_CHECK : row[3] == L"dropdown" ? BTNS_DROPDOWN : BTNS_BUTTON | BTNS_AUTOSIZE;
                button.iBitmap = _wtoi(row[2].c_str()); if (button.iBitmap < 0) button.iBitmap = I_IMAGENONE; button.iString = reinterpret_cast<INT_PTR>(row[1].c_str());
                SendMessageW(child, TB_ADDBUTTONSW, 1, reinterpret_cast<LPARAM>(&button));
            }
            SendMessageW(child, TB_AUTOSIZE, 0, 0);
            SetWindowPos(child, nullptr, childX, childY, childWidth, childHeight, SWP_NOZORDER | SWP_NOACTIVATE);
        } else if (IsType(control, L"ReBar")) {
            SetWindowPos(child, nullptr, childX, childY, childWidth, childHeight, SWP_NOZORDER | SWP_NOACTIVATE);
        } else if (IsType(control, L"Animation") && control.data && control.data[0]) {
            Animate_Open(child, control.data);
            if (control.flags & CF_AUTO_PLAY) Animate_Play(child, 0, -1, (control.flags & CF_LOOP) ? -1 : 1);
        }
        return true;
    }

    void RebuildControls() {
        std::vector<const ControlSpec*> pending;
        for (int i = 0; i < spec_.controlCount; ++i) pending.push_back(&spec_.controls[i]);
        while (!pending.empty()) {
            size_t before = pending.size();
            for (auto item = pending.begin(); item != pending.end();) {
                if (CreateGeneratedControl(**item)) item = pending.erase(item);
                else ++item;
            }
            if (pending.size() == before) {
                for (const ControlSpec* control : pending) {
                    ControlSpec rootFallback = *control;
                    rootFallback.parentId = 0;
                    CreateGeneratedControl(rootFallback);
                }
                break;
            }
        }
        WireCompositeControls();
    }

    void DestroyControls() {
        HWND child = GetWindow(hwnd_, GW_CHILD);
        while (child) {
            HWND next = GetWindow(child, GW_HWNDNEXT);
            DestroyWindow(child);
            child = next;
        }
        for (auto& control : runtimeControls_) {
            const ControlSpec* spec = FindControl(control.id);
            if (spec && IsType(*spec, L"FlatScrollBar") && control.hwnd) UninitializeFlatSB(control.hwnd);
            if (control.font) DeleteObject(control.font);
            if (control.brush) DeleteObject(control.brush);
            if (control.resource) {
                if (control.iconResource) DestroyIcon(reinterpret_cast<HICON>(control.resource));
                else DeleteObject(control.resource);
            }
        }
        runtimeControls_.clear();
        tabPages_.clear();
        toolbarCommandOwners_.clear(); toolbarCommandValues_.clear(); nextToolbarCommandId_ = 60000;
        for (auto& imageList : imageLists_) ImageList_Destroy(imageList.second);
        imageLists_.clear();
        for (auto& imageList : listViewSizingImageLists_) ImageList_Destroy(imageList.second);
        listViewSizingImageLists_.clear();
        for (HWND tooltip : tooltipWindows_) if (tooltip) DestroyWindow(tooltip);
        tooltipWindows_.clear();
    }

    LRESULT OnMessage(UINT message, WPARAM wParam, LPARAM lParam) {
        static const UINT findMessage = RegisterWindowMessageW(FINDMSGSTRINGW);
        if (message == findMessage) {
            FINDREPLACEW* event = reinterpret_cast<FINDREPLACEW*>(lParam);
            if (!event) return 0;
            lastFindText_ = event->lpstrFindWhat ? event->lpstrFindWhat : L"";
            lastReplaceText_ = event->lpstrReplaceWith ? event->lpstrReplaceWith : L"";
            if (event->Flags & FR_DIALOGTERM) { lastFindAction_ = L"关闭"; findDialog_ = nullptr; }
            else if (event->Flags & FR_REPLACEALL) lastFindAction_ = L"全部替换";
            else if (event->Flags & FR_REPLACE) lastFindAction_ = L"替换";
            else if (event->Flags & FR_FINDNEXT) lastFindAction_ = L"查找下一个";
            return 0;
        }
        switch (message) {
        case WM_NCPAINT: {
            LRESULT result = DefWindowProcW(hwnd_, message, wParam, lParam);
            PaintMenuBarBackground();
            return result;
        }
        case WM_NCACTIVATE: {
            LRESULT result = DefWindowProcW(hwnd_, message, wParam, lParam);
            PaintMenuBarBackground();
            return result;
        }
        case WM_MEASUREITEM: {
            MEASUREITEMSTRUCT* item = reinterpret_cast<MEASUREITEMSTRUCT*>(lParam);
            if (item && item->CtlType == ODT_MENU && item->itemData) {
                HDC hdc = GetDC(hwnd_);
                SIZE size = {};
                std::wstring text = GetOwnerDrawMenuText(item->itemID);
                if (hdc) {
                    HGDIOBJ oldFont = menuFont_ ? SelectObject(hdc, menuFont_) : nullptr;
                    GetTextExtentPoint32W(hdc, text.c_str(), static_cast<int>(text.size()), &size);
                    if (oldFont) SelectObject(hdc, oldFont);
                    ReleaseDC(hwnd_, hdc);
                }
                item->itemWidth = static_cast<UINT>(size.cx + ScaleForDpi(16, dpi_));
                item->itemHeight = static_cast<UINT>(std::max(static_cast<int>(size.cy) + ScaleForDpi(6, dpi_), GetSystemMetrics(SM_CYMENU)));
                return TRUE;
            }
            break;
        }
        case WM_CREATE: {
            windowBrush_ = CreateSolidBrush(spec_.background);
            ++g_openWindowCount;
            CreateImageLists();
            RebuildControls();
            bool acceptsDroppedFiles = !GetWindowEventHandler(spec_, L"FileDropped").empty() || HasFileDialogDropTarget();
            for (int index = 0; !acceptsDroppedFiles && index < spec_.controlCount; ++index) {
                acceptsDroppedFiles = IsUploadControl(spec_.controls[index]) && (spec_.controls[index].selectedIndex & 16);
            }
            if (acceptsDroppedFiles) DragAcceptFiles(hwnd_, TRUE);
            OnWindowCreated();
            return 0;
        }
        case WM_CLOSE:
            closingEventActive_ = true;
            closingCancelled_ = false;
            DispatchWindowEvent(L"Closing");
            closingEventActive_ = false;
            if (!closingCancelled_) DestroyWindow(hwnd_);
            return 0;
        case WM_SHOWWINDOW: {
            bool nextVisible = wParam != FALSE;
            if (visible_ != nextVisible) {
                visible_ = nextVisible;
                DispatchWindowEvent(L"VisibilityChanged");
            }
            break;
        }
        case WM_MOVE: {
            int nextX = static_cast<int>(static_cast<short>(LOWORD(lParam)));
            int nextY = static_cast<int>(static_cast<short>(HIWORD(lParam)));
            bool changed = eventX_ != nextX || eventY_ != nextY;
            eventX_ = nextX;
            eventY_ = nextY;
            if (moveBaselineReady_ && changed) DispatchWindowEvent(L"Moved");
            moveBaselineReady_ = true;
            return 0;
        }
        case WM_SIZE:
#if LINGBUILDER_EDGEVIEW_AVAILABLE
            EdgeView_调整全部大小();
#endif
            {
                int nextWidth = static_cast<int>(LOWORD(lParam));
                int nextHeight = static_cast<int>(HIWORD(lParam));
                int nextState = wParam == SIZE_MINIMIZED ? 1 : wParam == SIZE_MAXIMIZED ? 2 : 0;
                bool sizeChanged = eventWidth_ != nextWidth || eventHeight_ != nextHeight;
                bool stateChanged = windowState_ != nextState;
                eventWidth_ = nextWidth;
                eventHeight_ = nextHeight;
                windowState_ = nextState;
                if (sizeBaselineReady_ && sizeChanged) DispatchWindowEvent(L"SizeChanged");
                if (windowStateBaselineReady_ && stateChanged) {
                    DispatchWindowEvent(nextState == 1 ? L"Minimized" : nextState == 2 ? L"Maximized" : L"Restored");
                }
                sizeBaselineReady_ = true;
                windowStateBaselineReady_ = true;
            }
            return 0;
        case WM_ACTIVATE: {
            bool nextActive = LOWORD(wParam) != WA_INACTIVE;
            if (active_ != nextActive) {
                active_ = nextActive;
                DispatchWindowEvent(nextActive ? L"Activated" : L"Deactivated");
            }
            return 0;
        }
        case WM_SETFOCUS:
            DispatchWindowEvent(L"GotFocus");
            return 0;
        case WM_KILLFOCUS:
            DispatchWindowEvent(L"LostFocus");
            return 0;
        case WM_DPICHANGED: {
            dpi_ = HIWORD(wParam);
            RECT* suggested = reinterpret_cast<RECT*>(lParam);
            if (suggested) {
                SetWindowPos(hwnd_, nullptr, suggested->left, suggested->top,
                    suggested->right - suggested->left, suggested->bottom - suggested->top,
                    SWP_NOZORDER | SWP_NOACTIVATE);
            }
            DestroyControls();
            CreateImageLists();
            RebuildControls();
#if LINGBUILDER_EDGEVIEW_AVAILABLE
            EdgeView_调整全部大小();
#endif
            DispatchWindowEvent(L"DpiChanged");
            return 0;
        }
        case WM_DROPFILES: {
            HDROP drop = reinterpret_cast<HDROP>(wParam);
            POINT dropPoint = {}; DragQueryPoint(drop, &dropPoint);
            droppedFiles_.clear();
            UINT count = DragQueryFileW(drop, 0xFFFFFFFF, nullptr, 0);
            for (UINT index = 0; index < count; ++index) {
                UINT length = DragQueryFileW(drop, index, nullptr, 0);
                std::wstring path(static_cast<size_t>(length + 1), L'\\0');
                DragQueryFileW(drop, index, path.data(), length + 1);
                path.resize(static_cast<size_t>(length));
                droppedFiles_.push_back(path);
            }
            DragFinish(drop);
            for (auto& runtime : runtimeControls_) {
                const ControlSpec* control = FindControl(runtime.id);
                if (!control || !IsUploadControl(*control) || !(control->selectedIndex & 16)) continue;
                RECT bounds = {}; GetWindowRect(runtime.hwnd, &bounds);
                MapWindowPoints(HWND_DESKTOP, hwnd_, reinterpret_cast<POINT*>(&bounds), 2);
                if (PtInRect(&bounds, dropPoint)) {
                    AddUploadFiles(*control, runtime, droppedFiles_);
                    return 0;
                }
            }
            if (HandleFileDialogDrop(dropPoint, droppedFiles_)) return 0;
            DispatchWindowEvent(L"FileDropped");
            return 0;
        }
        case WM_TIMER:
            if (wParam == 0x4C42) {
                KillTimer(hwnd_, 0x4C42);
                SetWindowPos(hwnd_, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                SetForegroundWindow(hwnd_);
                BringWindowToTop(hwnd_);
                SetFocus(hwnd_);
                return 0;
            }
            break;
        case WM_COMMAND: {
            int controlId = LOWORD(wParam);
            int notification = HIWORD(wParam);
            const ControlSpec* control = FindControl(controlId);
            auto toolbarOwner = toolbarCommandOwners_.find(controlId);
            if (!control && toolbarOwner != toolbarCommandOwners_.end()) control = FindControl(toolbarOwner->second);
            if (!control && lParam) control = FindControl(GetDlgCtrlID(reinterpret_cast<HWND>(lParam)));
            if (controlId >= 50000 && controlId < 50100 && control) {
                DispatchLingEvent(*control, L"Select");
                return 0;
            }
            if (!control) return 0;
            if (notification == BN_CLICKED || notification == STN_CLICKED) HandleFileDialogTrigger(control->id);
            if (IsType(*control, L"CheckBox") && notification == BN_CLICKED) {
                HWND child = reinterpret_cast<HWND>(lParam);
                int currentState = static_cast<int>(SendMessageW(child, BM_GETCHECK, 0, 0));
                int nextState = BST_UNCHECKED;
                if (control->flags & CF_THREE_STATE) {
                    nextState = currentState == BST_UNCHECKED
                        ? BST_CHECKED
                        : currentState == BST_CHECKED ? BST_INDETERMINATE : BST_UNCHECKED;
                } else {
                    nextState = currentState == BST_CHECKED ? BST_UNCHECKED : BST_CHECKED;
                }
                SendMessageW(child, BM_SETCHECK, nextState, 0);
                InvalidateRect(child, nullptr, TRUE);
                DispatchLingEvent(*control, nextState == BST_CHECKED ? L"Checked" : L"Unchecked");
            } else if (IsType(*control, L"RadioButton") && notification == BN_CLICKED) {
                SelectRadioControl(*control, reinterpret_cast<HWND>(lParam));
            } else if ((IsType(*control, L"Button") || IsType(*control, L"Label") || IsType(*control, L"SysLink")) && (notification == BN_CLICKED || notification == STN_CLICKED)) {
                DispatchLingEvent(*control, L"Click");
            } else if ((IsType(*control, L"TextBox") || IsType(*control, L"RichEdit")) && notification == EN_CHANGE) {
                DispatchLingEvent(*control, L"TextChanged");
            } else if (IsType(*control, L"ListBox") && notification == LBN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"ListBox") && notification == LBN_DBLCLK) {
                DispatchLingEvent(*control, L"DoubleClick");
            } else if ((IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) && notification == CBN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if ((IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) && notification == CBN_EDITCHANGE) {
                DispatchLingEvent(*control, L"TextChanged");
            } else if (IsType(*control, L"HotKey") && notification == EN_CHANGE) {
                DispatchLingEvent(*control, L"ValueChanged");
            } else if (IsType(*control, L"ToolBar") && notification == 0) {
                auto logical = toolbarCommandValues_.find(controlId);
                lastToolbarCommand_ = logical == toolbarCommandValues_.end() ? controlId : logical->second;
                DispatchLingEvent(*control, L"Click");
            } else if (IsType(*control, L"Animation") && notification == ACN_STOP) {
                DispatchLingEvent(*control, L"Finished");
            }
            return 0;
        }
        case WM_DRAWITEM: {
            DRAWITEMSTRUCT* item = reinterpret_cast<DRAWITEMSTRUCT*>(lParam);
            if (item && item->CtlType == ODT_MENU && item->itemData) {
                PaintMenuBarItem(item);
                return TRUE;
            }
            return (PaintOwnerListBox(item)
                || PaintOwnerComboBox(item)
                || PaintOwnerButton(item)) ? TRUE : FALSE;
        }
        case WM_NOTIFY: {
            NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
            if (!header) return 0;
            const ControlSpec* control = FindControl(static_cast<int>(header->idFrom));
            if (!control) return 0;
            if ((IsType(*control, L"ListView") && header->code == LVN_ITEMCHANGED) ||
                (IsType(*control, L"TreeView") && header->code == TVN_SELCHANGEDW) ||
                (IsType(*control, L"TabControl") && header->code == TCN_SELCHANGE)) {
                if (IsType(*control, L"TabControl")) UpdateTabChildren(*control);
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"ListView") && header->code == LVN_COLUMNCLICK) {
                DispatchLingEvent(*control, L"ColumnClick");
            } else if ((IsType(*control, L"ListView") || IsType(*control, L"TreeView")) && header->code == NM_DBLCLK) {
                DispatchLingEvent(*control, L"DoubleClick");
            } else if (IsType(*control, L"TreeView") && header->code == TVN_ITEMEXPANDEDW) {
                NMTREEVIEWW* tree = reinterpret_cast<NMTREEVIEWW*>(lParam);
                DispatchLingEvent(*control, tree->action == TVE_COLLAPSE ? L"Collapsed" : L"Expanded");
            } else if (IsType(*control, L"Header") && header->code == HDN_ITEMCLICKW) {
                DispatchLingEvent(*control, L"ColumnClick");
            } else if (IsType(*control, L"Header") && header->code == HDN_ENDTRACKW) {
                DispatchLingEvent(*control, L"ColumnResized");
            } else if ((IsType(*control, L"DateTimePicker") && header->code == DTN_DATETIMECHANGE) ||
                       (IsType(*control, L"MonthCalendar") && header->code == MCN_SELCHANGE) ||
                       (IsType(*control, L"UpDown") && header->code == UDN_DELTAPOS) ||
                       (IsType(*control, L"IPAddress") && header->code == IPN_FIELDCHANGED)) {
                DispatchLingEvent(*control, L"ValueChanged");
            } else if (IsType(*control, L"SysLink") && (header->code == NM_CLICK || header->code == NM_RETURN)) {
                DispatchLingEvent(*control, L"Click");
            } else if (IsType(*control, L"RichEdit") && header->code == EN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"StatusBar") && header->code == NM_DBLCLK) {
                NMMOUSE* mouse = reinterpret_cast<NMMOUSE*>(lParam);
                lastStatusPart_ = mouse ? static_cast<int>(mouse->dwItemSpec) : -1;
                DispatchLingEvent(*control, L"DoubleClick");
            } else if (IsType(*control, L"Pager") && header->code == PGN_CALCSIZE) {
                NMPGCALCSIZE* size = reinterpret_cast<NMPGCALCSIZE*>(lParam);
                RuntimeControl* pager = FindRuntimeControl(control->id);
                if (size && pager) {
                    HWND child = GetWindow(pager->hwnd, GW_CHILD);
                    RECT area = {}; if (child) GetWindowRect(child, &area);
                    if (size->dwFlag == PGF_CALCWIDTH) size->iWidth = std::max(1L, area.right - area.left);
                    else size->iHeight = std::max(1L, area.bottom - area.top);
                }
            } else if (IsType(*control, L"Pager") && header->code == PGN_SCROLL) {
                DispatchLingEvent(*control, L"Scroll");
            }
            return 0;
        }
        case WM_HSCROLL:
        case WM_VSCROLL: {
            HWND child = reinterpret_cast<HWND>(lParam);
            if (!child) return 0;
            const ControlSpec* control = FindControl(GetDlgCtrlID(child));
            if (control && (IsType(*control, L"TrackBar") || IsType(*control, L"ScrollBar") || IsType(*control, L"FlatScrollBar"))) {
                if (IsType(*control, L"ScrollBar") || IsType(*control, L"FlatScrollBar")) {
                    int bar = (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT;
                    int position = IsType(*control, L"FlatScrollBar") ? FlatSB_GetScrollPos(child, bar) : GetScrollPos(child, SB_CTL);
                    switch (LOWORD(wParam)) {
                    case SB_LINELEFT: position -= 1; break;
                    case SB_LINERIGHT: position += 1; break;
                    case SB_PAGELEFT: position -= 10; break;
                    case SB_PAGERIGHT: position += 10; break;
                    case SB_THUMBPOSITION:
                    case SB_THUMBTRACK: position = HIWORD(wParam); break;
                    }
                    position = std::max(control->minimum, std::min(control->maximum, position));
                    if (IsType(*control, L"FlatScrollBar")) FlatSB_SetScrollPos(child, bar, position, TRUE);
                    else SetScrollPos(child, SB_CTL, position, TRUE);
                }
                DispatchLingEvent(*control, L"ValueChanged");
            }
            return 0;
        }
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLORBTN:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            HWND child = reinterpret_cast<HWND>(lParam);
            int controlId = GetDlgCtrlID(child);
            const ControlSpec* control = FindControl(controlId);
            RuntimeControl* runtime = FindRuntimeControl(controlId);
            if (control) {
                SetTextColor(hdc, control->foreground);
                if (message == WM_CTLCOLORSTATIC && control->backgroundTransparent && IsType(*control, L"Label")) {
                    SetBkMode(hdc, TRANSPARENT);
                    SetBkColor(hdc, ResolveControlSurroundingColor(*control, child));
                    return reinterpret_cast<LRESULT>(ResolveControlSurroundingBrush(*control, child));
                }
                SetBkColor(hdc, control->background);
            }
            if (runtime && runtime->brush) return reinterpret_cast<LRESULT>(runtime->brush);
            return reinterpret_cast<LRESULT>(windowBrush_);
        }
        case WM_ERASEBKGND: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            RECT rect;
            GetClientRect(hwnd_, &rect);
            FillRect(hdc, &rect, windowBrush_);
            return 1;
        }
        case WM_DESTROY:
            if (!closedDispatched_) {
                closedDispatched_ = true;
                DispatchWindowEvent(L"Closed");
            }
            DestroyControls();
            DestroyWindowIcons();
            if (windowBrush_) {
                DeleteObject(windowBrush_);
                windowBrush_ = nullptr;
            }
            if (menuBrush_) {
                DeleteObject(menuBrush_);
                menuBrush_ = nullptr;
            }
            if (menuFont_) {
                DeleteObject(menuFont_);
                menuFont_ = nullptr;
            }
            --g_openWindowCount;
            if (g_openWindowCount <= 0) PostQuitMessage(0);
            return 0;
        }
        return DefWindowProcW(hwnd_, message, wParam, lParam);
    }

public:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
        if (message == WM_NCCREATE) {
            auto createStruct = reinterpret_cast<CREATESTRUCTW*>(lParam);
            self = reinterpret_cast<LingWindowBase*>(createStruct->lpCreateParams);
            self->hwnd_ = hwnd;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
            return DefWindowProcW(hwnd, message, wParam, lParam);
        }
        if (!self) return DefWindowProcW(hwnd, message, wParam, lParam);
        LRESULT result = self->OnMessage(message, wParam, lParam);
        if (message == WM_NCDESTROY) {
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            delete self;
        }
        return result;
    }
};

${classDefinitions}

static LingWindowBase* CreateWindowObject(int windowIndex) {
    switch (windowIndex) {
${factoryCases}
    default: return nullptr;
    }
}

static HWND OpenGeneratedWindow(int windowIndex, int showCommand, const wchar_t* placement, int x, int y, bool hasCustomPosition) {
    LingWindowBase* window = CreateWindowObject(windowIndex);
    if (!window) return nullptr;
    HWND hwnd = window->Open(showCommand, placement, x, y, hasCustomPosition);
    if (!hwnd) {
        // If CreateWindowEx reached WM_NCCREATE, WM_NCDESTROY owns deletion.
        // Avoid double-free when user code closes the window during creation.
        return nullptr;
    }
    return hwnd;
}

static bool WindowSpecMatchesName(const WindowSpec& spec, const wchar_t* windowName) {
    if (!windowName || windowName[0] == 0) return false;
    return (spec.title && std::wcscmp(spec.title, windowName) == 0) ||
        (spec.className && std::wcscmp(spec.className, windowName) == 0);
}

static HWND OpenGeneratedWindowByName(const wchar_t* windowName, int showCommand, const wchar_t* placement, int x, int y, bool hasCustomPosition) {
    for (int index = 0; index < g_windowCount; ++index) {
        if (WindowSpecMatchesName(g_windows[index], windowName)) {
            return OpenGeneratedWindow(index, showCommand, placement, x, y, hasCustomPosition);
        }
    }
    return nullptr;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
    g_instance = instance;
    EnableDpiAwareness();
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    Gdiplus::GdiplusStartupInput gdiplusInput;
    ULONG_PTR gdiplusToken = 0;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusInput, nullptr);

    INITCOMMONCONTROLSEX controls = {};
    controls.dwSize = sizeof(INITCOMMONCONTROLSEX);
    controls.dwICC = ICC_WIN95_CLASSES | ICC_DATE_CLASSES | ICC_USEREX_CLASSES |
        ICC_COOL_CLASSES | ICC_BAR_CLASSES | ICC_TAB_CLASSES |
        ICC_TREEVIEW_CLASSES | ICC_LISTVIEW_CLASSES |
        ICC_PAGESCROLLER_CLASS | ICC_LINK_CLASS;
    InitCommonControlsEx(&controls);
    LoadLibraryW(L"Msftedit.dll");

    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.lpfnWndProc = LingWindowBase::WindowProc;
    windowClass.hInstance = instance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.hbrBackground = nullptr;
    windowClass.lpszClassName = GENERATED_WINDOW_CLASS;

    if (!RegisterClassExW(&windowClass)) { if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken); CoUninitialize(); return 0; }
    HWND startWindow = OpenGeneratedWindow(g_startWindowIndex, showCommand);

    MSG message;
    while (GetMessageW(&message, nullptr, 0, 0)) {
        HWND navigationRoot = message.hwnd ? GetAncestor(message.hwnd, GA_ROOT) : startWindow;
        LingWindowBase* messageOwner = LingWindowBase::FromMessageWindow(navigationRoot);
        if (messageOwner && messageOwner->PreTranslateKeyboardMessage(message)) continue;
        if (navigationRoot && IsWindow(navigationRoot) && IsDialogMessageW(navigationRoot, &message)) continue;
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
    if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken);
    CoUninitialize();
    return static_cast<int>(message.wParam);
}
`;
}

function generateNativeManifest(
  project: LingWindowProject,
  selectedWindow: LingWindowModel,
  enabledModules: InstalledModule[],
  sourceFilePath: string,
  sourceMap: LingCppNativeSourceMapEntry[]
): string {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name
    },
    selectedWindow: {
      id: selectedWindow.id,
      fileName: selectedWindow.fileName,
      className: selectedWindow.className,
      title: selectedWindow.title
    },
    sourceFilePath,
    modules: enabledModules.map(module => ({
      id: module.manifest.id,
      name: module.manifest.name,
      version: module.manifest.version,
      builtin: Boolean(module.isBuiltin)
    })),
    files: ['main.cpp', 'layout.json', 'module-dependencies.txt', 'README.txt', 'lingbuilder-native-manifest.json'],
    sourceMap
  }, null, 2);
}

function generateLingCppNativeSourceMap(
  mainCppContent: string,
  project: LingWindowProject,
  program: LingCppProgram,
  sourceFilePath: string
): LingCppNativeSourceMapEntry[] {
  const lines = mainCppContent.split('\n');
  const entries: LingCppNativeSourceMapEntry[] = [];
  project.windows.forEach(window => {
    const sourceClass = findLingCppClassForWindow(program, window);
    const className = sourceClass?.name || window.className;
    const classBoundary = findGeneratedClassBoundary(lines, toCppIdentifier(window.className));

    if (sourceClass && classBoundary) {
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: classBoundary.startLine,
        generatedEndLine: classBoundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: sourceClass.line,
        sourceEndLine: sourceClass.endLine || sourceClass.line,
        kind: 'class',
        symbolName: sourceClass.name,
        className: sourceClass.name
      });
    }

    const handlers = getWindowHandlers(window);
    const windowCreatedHandler = findWindowCreatedHandler(window, program);
    const methodHandlers = windowCreatedHandler
      ? [windowCreatedHandler, ...handlers.filter(handler => handler !== windowCreatedHandler)]
      : handlers;

    methodHandlers.forEach(handler => {
      const method = findLingCppMethod(program, handler);
      if (!method) return;
      const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(handler), classBoundary);
      if (!boundary) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: boundary.startLine,
        generatedEndLine: boundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: method.line,
        sourceEndLine: method.endLine || method.line,
        kind: 'event',
        symbolName: method.name,
        className
      });

      const statementEntries = translateMethodStatementsWithMetadata(method);
      let searchLine = boundary.startLine + 1;
      statementEntries.forEach(statement => {
        const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
        if (targetLine === -1) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: targetLine,
          generatedEndLine: targetLine,
          sourceFile: sourceFilePath,
          sourceStartLine: statement.sourceStartLine,
          sourceEndLine: statement.sourceEndLine,
          kind: statement.kind,
          symbolName: method.name,
          className
        });
        searchLine = targetLine + 1;
      });
    });

    (sourceClass?.methods || [])
      .filter(method => method.kind === 'method')
      .forEach(method => {
        const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(method.name), classBoundary);
        if (!boundary) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: boundary.startLine,
          generatedEndLine: boundary.endLine,
          sourceFile: sourceFilePath,
          sourceStartLine: method.line,
          sourceEndLine: method.endLine || method.line,
          kind: 'method',
          symbolName: method.name,
          className
        });

        const statementEntries = translateMethodStatementsWithMetadata(method);
        let searchLine = boundary.startLine + 1;
        statementEntries.forEach(statement => {
          const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
          if (targetLine === -1) return;
          entries.push({
            generatedFile: 'main.cpp',
            generatedStartLine: targetLine,
            generatedEndLine: targetLine,
            sourceFile: sourceFilePath,
            sourceStartLine: statement.sourceStartLine,
            sourceEndLine: statement.sourceEndLine,
            kind: statement.kind,
            symbolName: method.name,
            className
          });
          searchLine = targetLine + 1;
        });
      });
  });

  return entries;
}

function buildWindowClassSourceMap(
  classCode: string,
  window: LingWindowModel,
  program: LingCppProgram,
  sourceFilePath: string
): LingCppNativeSourceMapEntry[] {
  const lines = classCode.split('\n');
  const sourceClass = findLingCppClassForWindow(program, window);
  const entries: LingCppNativeSourceMapEntry[] = [];
  const className = sourceClass?.name || window.className;

  if (sourceClass) {
    entries.push({
      generatedFile: 'main.cpp',
      generatedStartLine: 1,
      generatedEndLine: lines.length,
      sourceFile: sourceFilePath,
      sourceStartLine: sourceClass.line,
      sourceEndLine: sourceClass.endLine || sourceClass.line,
      kind: 'class',
      symbolName: sourceClass.name,
      className: sourceClass.name
    });
  }

  const handlers = getWindowHandlers(window);
  const windowCreatedHandler = findWindowCreatedHandler(window, program);
  const methodHandlers = windowCreatedHandler
    ? [windowCreatedHandler, ...handlers.filter(handler => handler !== windowCreatedHandler)]
    : handlers;

  methodHandlers.forEach(handler => {
    const method = findLingCppMethod(program, handler);
    if (!method) return;
    const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(handler));
    if (!boundary) return;
    entries.push({
      generatedFile: 'main.cpp',
      generatedStartLine: boundary.startLine,
      generatedEndLine: boundary.endLine,
      sourceFile: sourceFilePath,
      sourceStartLine: method.line,
      sourceEndLine: method.endLine || method.line,
      kind: 'event',
      symbolName: method.name,
      className
    });

    const statementEntries = translateMethodStatementsWithMetadata(method);
    let searchLine = boundary.startLine + 1;
    statementEntries.forEach(statement => {
      const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
      if (targetLine === -1) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: targetLine,
        generatedEndLine: targetLine,
        sourceFile: sourceFilePath,
        sourceStartLine: statement.sourceStartLine,
        sourceEndLine: statement.sourceEndLine,
        kind: statement.kind,
        symbolName: method.name,
        className
      });
      searchLine = targetLine + 1;
    });
  });

  (sourceClass?.methods || [])
    .filter(method => method.kind === 'method')
    .forEach(method => {
      const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(method.name));
      if (!boundary) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: boundary.startLine,
        generatedEndLine: boundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: method.line,
        sourceEndLine: method.endLine || method.line,
        kind: 'method',
        symbolName: method.name,
        className
      });

      const statementEntries = translateMethodStatementsWithMetadata(method);
      let searchLine = boundary.startLine + 1;
      statementEntries.forEach(statement => {
        const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
        if (targetLine === -1) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: targetLine,
          generatedEndLine: targetLine,
          sourceFile: sourceFilePath,
          sourceStartLine: statement.sourceStartLine,
          sourceEndLine: statement.sourceEndLine,
          kind: statement.kind,
          symbolName: method.name,
          className
        });
        searchLine = targetLine + 1;
      });
    });

  return entries;
}

function findBlockStartLine(lines: string[], block: string, fromLine: number): number {
  const blockLines = block.split('\n');
  if (blockLines.length === 0) return -1;

  for (let line = Math.max(1, fromLine); line <= lines.length - blockLines.length + 1; line += 1) {
    let matched = true;
    for (let offset = 0; offset < blockLines.length; offset += 1) {
      if (lines[line + offset - 1] !== blockLines[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return line;
  }

  return -1;
}

function findGeneratedClassBoundary(
  lines: string[],
  cppIdentifier: string
): { startLine: number; endLine: number } | undefined {
  const classPattern = new RegExp(`^class\\s+${escapeRegexLiteral(cppIdentifier)}\\s*:\\s*public\\s+LingWindowBase`);
  for (let line = 1; line <= lines.length; line += 1) {
    if (!classPattern.test((lines[line - 1] || '').trim())) continue;
    for (let scan = line; scan <= lines.length; scan += 1) {
      if ((lines[scan - 1] || '').trim() === '};') {
        return { startLine: line, endLine: scan };
      }
    }
  }
  return undefined;
}

function findGeneratedMethodBoundary(
  lines: string[],
  cppIdentifier: string,
  range?: { startLine: number; endLine: number }
): { startLine: number; endLine: number } | undefined {
  const startLine = range?.startLine || 1;
  const endLine = range?.endLine || lines.length;
  const declarationPatterns = [
    new RegExp(`^\\s*void\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*int\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*long\\s+long\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*double\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*bool\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*unsigned\\s+char\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*std::wstring\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*HWND\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*void\\*\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`)
  ];
  const fallbackPattern = new RegExp(`\\b${escapeRegexLiteral(cppIdentifier)}\\s*\\(`);

  for (let line = startLine; line <= endLine; line += 1) {
    const text = lines[line - 1] || '';
    const isDeclaration = declarationPatterns.some(pattern => pattern.test(text));
    if (!isDeclaration && !fallbackPattern.test(text)) continue;
    let braceDepth = 0;
    let seenOpeningBrace = false;
    for (let scan = line; scan <= endLine; scan += 1) {
      const scanText = lines[scan - 1] || '';
      for (const char of scanText) {
        if (char === '{') {
          braceDepth += 1;
          seenOpeningBrace = true;
        } else if (char === '}') {
          braceDepth = Math.max(0, braceDepth - 1);
        }
      }
      if (seenOpeningBrace && braceDepth === 0) {
        return { startLine: line, endLine: scan };
      }
    }
  }

  return undefined;
}

function findGeneratedStatementLine(lines: string[], code: string, fromLine: number, endLine: number): number {
  for (let line = Math.max(1, fromLine); line <= Math.min(lines.length, endLine); line += 1) {
    if ((lines[line - 1] || '').trim() === code.trim()) {
      return line;
    }
  }
  return -1;
}

function generateModuleCppPreamble(enabledModules: InstalledModule[]): string {
  const lines: string[] = [];
  enabledModules.forEach(module => {
    const target = getPreferredModuleTarget(module);
    (target?.defines || []).forEach(define => {
      const safeDefine = toCppDefineIdentifier(define);
      lines.push(`#ifndef ${safeDefine}\n#define ${safeDefine}\n#endif`);
    });
  });
  enabledModules
    .filter(module => !module.isBuiltin)
    .forEach(module => {
      const target = getPreferredModuleTarget(module);
      const modulePath = `modules/${module.manifest.id}`;
      lines.push(`// LingBuilder 模块: ${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`);
      if (target) lines.push(`// 模块目标: ${target.id} / ${target.platform}-${target.toolchain}-${target.arch}`);
      (target?.headers || []).forEach(header => {
        lines.push(`#include "${escapeIncludePath(`${modulePath}/${header}`)}"`);
      });
      (target?.sources || []).forEach(source => lines.push(`// 模块源码: ${source}`));
      (target?.libs || []).forEach(lib => lines.push(`#pragma comment(lib, "${escapeWideString(`${modulePath}/${lib}`)}")`));
      (target?.runtimeFiles || []).forEach(runtimeFile => lines.push(`// 模块运行时文件: ${runtimeFile}`));
    });
  return lines.join('\n');
}

function generateModuleDependencyReport(enabledModules: InstalledModule[]): string {
  if (enabledModules.length === 0) return '当前项目未启用模块。';
  return enabledModules.map(module => {
    const target = getPreferredModuleTarget(module);
    return [
      `模块: ${module.manifest.name}`,
      `ID: ${module.manifest.id}`,
      `版本: ${module.manifest.version}`,
      `内置: ${module.isBuiltin ? '是' : '否'}`,
      `目标: ${target ? `${target.id} (${target.platform}/${target.toolchain}/${target.arch})` : '无'}`,
      ...(!target && !module.isBuiltin ? [getUnsupportedModuleTargetDiagnostic(module) || '未提供兼容的 Win32/MSVC 模块目标。'] : []),
      `命令数: ${module.manifest.contributes?.commands?.length || 0}`,
      `控件数: ${module.manifest.contributes?.designerControls?.length || 0}`,
      `头文件: ${(target?.headers || []).join(', ') || '无'}`,
      `源码: ${(target?.sources || []).join(', ') || '无'}`,
      `库: ${(target?.libs || []).join(', ') || '无'}`,
      `运行时文件: ${(target?.runtimeFiles || []).join(', ') || '无'}`
    ].join('\n');
  }).join('\n\n');
}

function generateWindowClass(window: LingWindowModel, windowIndex: number, program: LingCppProgram, enabledModules: InstalledModule[], resources: LingDesignerResource[]): string {
  const className = toCppIdentifier(window.className);
  const sourceClass = findLingCppClassForWindow(program, window);
  const handlers = getWindowHandlers(window);
  const propertySheets = resources.filter((resource): resource is LingPropertySheetResource => resource.type === 'PropertySheet');
  const fileDialogs = resources.filter((resource): resource is LingFileDialogResource => resource.type === 'FileDialog' && resource.ownerWindowId === window.id);
  const resourceHandlers = [
    ...propertySheets.filter(resource => resource.appliedHandler?.trim()).map(resource => resource.appliedHandler!.trim()),
    ...fileDialogs.flatMap(resource => [resource.filesSelectedHandler, resource.filesDroppedHandler, resource.cancelledHandler].filter((handler): handler is string => Boolean(handler?.trim())).map(handler => handler.trim()))
  ];
  const sourceEventHandlers = (sourceClass?.methods || []).filter(method => method.kind === 'event').map(method => method.name);
  const windowCreatedHandler = findWindowCreatedHandler(window, program);
  const allEventHandlers = [...new Set([...handlers, ...resourceHandlers, ...sourceEventHandlers])];
  const methodHandlers = windowCreatedHandler
    ? [windowCreatedHandler, ...allEventHandlers.filter(handler => handler !== windowCreatedHandler)]
    : allEventHandlers;
  const dispatchCases = handlers
    .map(handler => `        if (handler == L"${escapeWideString(handler)}") { ${toCppIdentifier(handler)}(); return; }`)
    .join('\n') || '        (void)control; (void)eventName;';
  const windowDispatchCases = allEventHandlers
    .map(handler => `        if (handler == L"${escapeWideString(handler)}") { ${toCppIdentifier(handler)}(); return; }`)
    .join('\n');
  const resourceDispatchCases = propertySheets.filter(resource => resource.appliedHandler?.trim())
    .map(resource => `        if (TextEquals(resourceId, L"${escapeWideString(resource.id)}") && TextEquals(eventName, L"Applied")) { ${toCppIdentifier(resource.appliedHandler!.trim())}(); return; }`)
    .concat(fileDialogs.flatMap(resource => [
      resource.filesSelectedHandler?.trim() ? `        if (TextEquals(resourceId, L"${escapeWideString(resource.id)}") && TextEquals(eventName, L"FilesSelected")) { ${toCppIdentifier(resource.filesSelectedHandler.trim())}(); return; }` : '',
      resource.filesDroppedHandler?.trim() ? `        if (TextEquals(resourceId, L"${escapeWideString(resource.id)}") && TextEquals(eventName, L"FilesDropped")) { ${toCppIdentifier(resource.filesDroppedHandler.trim())}(); return; }` : '',
      resource.cancelledHandler?.trim() ? `        if (TextEquals(resourceId, L"${escapeWideString(resource.id)}") && TextEquals(eventName, L"Cancelled")) { ${toCppIdentifier(resource.cancelledHandler.trim())}(); return; }` : ''
    ].filter(Boolean)))
    .join('\n');
  const eventMethods = methodHandlers
    .map(handler => generateHandlerMethod(handler, findLingCppMethod(program, handler), enabledModules));
  const userMethods = (sourceClass?.methods || []).filter(method => method.kind === 'method');
  const edgeCallbackMethods = (sourceClass?.methods || []).filter(method => method.parameters.length === 0 && (method.kind === 'event' || method.kind === 'method'));
  const edgeDispatchCases = edgeCallbackMethods
    .map(method => `        if (callback == L"${escapeWideString(method.name)}") { ${toCppIdentifier(method.name)}(); return; }`)
    .join('\n');
  const publicUserMethods = userMethods.filter(method => method.access === '公开').map(method => generateUserMethod(method, enabledModules));
  const protectedUserMethods = userMethods.filter(method => method.access === '保护').map(method => generateUserMethod(method, enabledModules));
  const privateUserMethods = userMethods.filter(method => method.access !== '公开' && method.access !== '保护').map(method => generateUserMethod(method, enabledModules));
  const publicUserMethodBlock = publicUserMethods.length ? `\n${publicUserMethods.join('\n\n')}\n` : '';
  const protectedUserMethodBlock = protectedUserMethods.length ? `\n${protectedUserMethods.join('\n\n')}\n` : '';
  const privateMethods = [...eventMethods, ...privateUserMethods].join('\n\n') || '    // 当前窗口暂无绑定事件。';
  return `class ${className} : public LingWindowBase {
public:
    explicit ${className}(const WindowSpec& spec) : LingWindowBase(spec) {}
${publicUserMethodBlock}

protected:
    void DispatchWindowEvent(const wchar_t* eventName) override {
        std::wstring handler = GetWindowEventHandler(spec_, eventName);
${windowDispatchCases || '        (void)handler;'}
        LingWindowBase::DispatchWindowEvent(eventName);
    }
    void DispatchDesignerResourceEvent(const wchar_t* resourceId, const wchar_t* eventName) override {
${resourceDispatchCases || '        (void)resourceId; (void)eventName;'}
    }
    void DispatchLingEvent(const ControlSpec& control, const wchar_t* eventName) override {
        std::wstring handler = GetEventHandler(control, eventName);
${dispatchCases}
        LingWindowBase::DispatchLingEvent(control, eventName);
    }
    void DispatchEdgeViewEvent(const wchar_t* handler, int instanceId, const wchar_t* eventName, const wchar_t* data) override {
        std::wstring callback = handler ? handler : L"";
${edgeDispatchCases || '        (void)callback;'}
        LingWindowBase::DispatchEdgeViewEvent(handler, instanceId, eventName, data);
    }
${protectedUserMethodBlock}

private:
${privateMethods}
};`;
}

function findLingCppClassForWindow(program: LingCppProgram, window: LingWindowModel): LingCppClass | undefined {
  const direct = program.classes.find(cls => cls.name === window.className);
  if (direct) return direct;
  return program.classes.find(cls => toCppIdentifier(cls.name) === toCppIdentifier(window.className));
}

function generateHandlerMethod(handler: string, method: LingCppMethod | undefined, enabledModules: InstalledModule[]): string {
  const body = method
    ? translateMethodStatements(method, enabledModules)
    : `        调试输出(L"未找到 ${escapeWideString(handler)} 的中文 C++ 事件实现。");`;
  return `    void ${toCppIdentifier(handler)}() {
${body || '        // 空事件处理器。'}
    }`;
}

function generateUserMethod(method: LingCppMethod, enabledModules: InstalledModule[]): string {
  const returnType = toCppType(method.returnType, 'return');
  const parameters = formatCppParameters(method.parameters);
  const body = translateMethodStatements(method, enabledModules);
  const fallbackReturn = defaultReturnStatement(returnType);
  const staticPrefix = method.isStatic ? 'static ' : '';
  const bodyWithFallback = [
    body,
    fallbackReturn ? `        ${fallbackReturn}` : ''
  ].filter(Boolean).join('\n') || '        // 空功能代码。';

  return `    ${staticPrefix}${returnType} ${toCppIdentifier(method.name)}(${parameters}) {
${bodyWithFallback}
    }`;
}

function formatCppParameters(parameters: LingCppParameter[]): string {
  return parameters
    .map(parameter => `${toCppType(parameter.type, 'parameter')} ${toCppIdentifier(parameter.name)}`)
    .join(', ');
}

function toCppType(type: string, position: 'parameter' | 'return'): string {
  const normalized = type.trim();
  if (!normalized || normalized === '空') return position === 'return' ? 'void' : 'void*';
  if (/^(文本型|文本|字符串|字符串型)$/u.test(normalized)) return 'std::wstring';
  if (/^(整数型|整数)$/u.test(normalized)) return 'int';
  if (/^(长整数型|长整数)$/u.test(normalized)) return 'long long';
  if (/^(小数型|小数|双精度|双精度型)$/u.test(normalized)) return 'double';
  if (/^(逻辑型|逻辑|布尔型|布尔)$/u.test(normalized)) return 'bool';
  if (/^(字节型|字节)$/u.test(normalized)) return 'unsigned char';
  if (/控件|窗体/u.test(normalized) || WIN32_CONTROL_DEFINITIONS.some(definition => (
    normalized === definition.label || normalized === definition.label.split('/')[0] || normalized === definition.type
  ))) return 'HWND';
  return 'void*';
}

function defaultReturnStatement(returnType: string): string {
  if (returnType === 'void') return '';
  if (returnType === 'bool') return 'return false;';
  if (returnType === 'std::wstring') return 'return L"";';
  if (returnType.endsWith('*')) return 'return nullptr;';
  if (returnType === 'double' || returnType === 'float') return 'return 0.0;';
  return 'return 0;';
}

function translateMethodStatementsWithMetadata(method: LingCppMethod, enabledModules: InstalledModule[] = []): TranslatedStatementLine[] {
  const lines: TranslatedStatementLine[] = [];

  for (let index = 0; index < method.statements.length; index += 1) {
    const currentStatement = method.statements[index];
    const nextStatement = method.statements[index + 1];
    const thirdStatement = method.statements[index + 2];
    const current = currentStatement?.text.trim() || '';
    const next = nextStatement?.text.trim() || '';
    const third = thirdStatement?.text.trim() || '';

    if (!current || !currentStatement) continue;

    const messageBox = parseMessageBox(current);
    if (
      messageBox &&
      /[=＝]{1,2}\s*6/.test(current) &&
      /^(\u7ed3\u675f)\s*[\uFF08(]?\s*[\uFF09)]?$/.test(next)
    ) {
      const consumesThird = third.startsWith('\u5982\u679c\u7ed3\u675f');
      lines.push({
        code: `if (\u4fe1\u606f\u6846(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}") == IDYES) { \u7ed3\u675f(); return; }`,
        sourceStartLine: currentStatement.line,
        sourceEndLine: consumesThird ? (thirdStatement?.line || nextStatement?.line || currentStatement.line) : (nextStatement?.line || currentStatement.line),
        kind: 'statement'
      });
      index += consumesThird ? 2 : 1;
      continue;
    }

    lines.push(translateStatementToMetadata(currentStatement, enabledModules));
  }

  return lines;
}

function translateStatementToMetadata(statement: LingCppStatement, enabledModules: InstalledModule[] = []): TranslatedStatementLine {
  const text = statement.text.trim();
  const nativeCpp = parseNativeCppStatement(text);

  return {
    code: nativeCpp !== undefined ? nativeCpp : translateStatement(text, enabledModules),
    sourceStartLine: statement.line,
    sourceEndLine: statement.line,
    kind: nativeCpp !== undefined ? 'native-cpp' : 'statement'
  };
}

function translateMethodStatements(method: LingCppMethod, enabledModules: InstalledModule[] = []): string {
  return translateMethodStatementsWithMetadata(method, enabledModules)
    .map(item => `        ${item.code}`)
    .join('\n');
}

function translateStatement(statement: string, enabledModules: InstalledModule[] = []): string {
  const nativeCpp = parseNativeCppStatement(statement);
  if (nativeCpp !== undefined) return nativeCpp;

  const messageBox = parseMessageBox(statement);
  if (/^如果(?:\s|[（(])/.test(statement) && messageBox && /[=＝]{1,2}\s*6/.test(statement)) {
    return `if (信息框(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}") == IDYES) { 结束(); return; }`;
  }
  if (messageBox) {
    return `信息框(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}");`;
  }

  const ifCondition = parseIfCondition(statement);
  if (ifCondition !== undefined) {
    return `if (${translateLingCppExpression(ifCondition, enabledModules)}) {`;
  }
  if (/^否则\s*$/u.test(statement)) {
    return '} else {';
  }
  if (/^如果结束\s*$/u.test(statement)) {
    return '}';
  }

  const debugMatch = statement.match(/调试输出\s*[（(]\s*[“"]([^”"]*)[”"]\s*[）)]/u);
  if (debugMatch) {
    return `调试输出(L"${escapeWideString(debugMatch[1] || '')}");`;
  }

  const openWindowCommand = parseOpenWindowCommand(statement);
  if (openWindowCommand !== undefined) {
    return formatOpenWindowCall(openWindowCommand);
  }

  const controlTextAssignment = parseEplControlMemberAssignmentRule(statement);
  if (controlTextAssignment) {
    return `${controlTextAssignment.setterRuntimeName}(L"${escapeWideString(controlTextAssignment.controlName)}", ${translateLingCppExpression(controlTextAssignment.valueExpression, enabledModules)});`;
  }

  const controlMethodCall = parseEplControlMethodCallRule(statement);
  if (controlMethodCall) {
    return `${controlMethodCall.runtimeName}(L"${escapeWideString(controlMethodCall.controlName)}", ${translateCallArguments(controlMethodCall.argumentsText, enabledModules)});`;
  }

  if (/^结束\s*[（(]?\s*[）)]?/.test(statement)) {
    return '结束();';
  }

  const returnValue = parseReturnValue(statement);
  if (returnValue !== undefined) {
    return `return ${translateLingCppExpression(returnValue, enabledModules)};`;
  }

  if (/^返回\b/.test(statement)) {
    return 'return;';
  }

  const callStatement = parseCallStatement(statement);
  if (callStatement) {
    const binding = findModuleCommandBinding(callStatement.name, enabledModules);
    if (binding) return `${toCppIdentifier(binding.runtimeName)}(${translateCallArguments(callStatement.argumentsText, enabledModules)});`;
    const looksLikeModuleCommand = enabledModules.some(module =>
      (module.manifest.contributes?.commands || []).some(command => command.name === callStatement.name)
    );
    if (looksLikeModuleCommand) {
      return `// 模块命令缺少 v2 binding，无法生成确定性 C++ 调用：${escapeCppComment(callStatement.name)}`;
    }
    return `${toCppIdentifier(callStatement.name)}(${translateCallArguments(callStatement.argumentsText, enabledModules)});`;
  }

  return `// 暂不支持的中文 C++ 语句：${escapeCppComment(statement)}`;
}

function findModuleCommandBinding(commandName: string, enabledModules: InstalledModule[]) {
  for (const module of enabledModules) {
    const binding = (module.manifest.bindings?.commands || []).find(item => item.command === commandName);
    if (binding) return binding;
  }
  return undefined;
}

function parseNativeCppStatement(statement: string): string | undefined {
  if (!statement.startsWith('@')) return undefined;
  const raw = statement.slice(1);
  return raw.startsWith(' ') ? raw.slice(1) : raw;
}

function parseReturnValue(statement: string): string | undefined {
  const parenthesized = statement.match(/^返回\s*[（(]\s*(.*?)\s*[）)]\s*;?$/u);
  if (parenthesized) return parenthesized[1]?.trim() || undefined;
  const plain = statement.match(/^返回\s+(.+?)\s*;?$/u);
  return plain?.[1]?.trim() || undefined;
}

function parseOpenWindowCommand(statement: string): OpenWindowCommand | undefined {
  const call = statement.match(/^(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*(.*?)\s*[）)]\s*;?$/u);
  const rawArguments = call?.[1]?.trim();
  if (rawArguments) {
    const args = splitCallArguments(rawArguments);
    const rawTarget = args[0]?.trim();
    if (!rawTarget) return undefined;
    const command: OpenWindowCommand = {
      target: stripLingCppStringLiteral(rawTarget)
    };

    const directX = parseIntegerArgument(args[1]);
    const directY = parseIntegerArgument(args[2]);
    if (directX !== undefined && directY !== undefined) {
      return { ...command, placement: 'custom', x: directX, y: directY, hasCustomPosition: true };
    }

    const rawPlacement = args[1]?.trim();
    if (rawPlacement) {
      command.placement = normalizeOpenWindowPlacement(stripLingCppStringLiteral(rawPlacement));
      const x = parseIntegerArgument(args[2]);
      const y = parseIntegerArgument(args[3]);
      if (x !== undefined && y !== undefined) {
        command.x = x;
        command.y = y;
        command.hasCustomPosition = true;
        command.placement = 'custom';
      }
    }

    return command;
  }

  const plain = statement.match(/^(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s+(.+?)\s*;?$/u);
  return plain?.[1] ? { target: stripLingCppStringLiteral(plain[1].trim()) } : undefined;
}

function formatOpenWindowCall(command: OpenWindowCommand): string {
  const target = `L"${escapeWideString(command.target)}"`;
  if (command.hasCustomPosition && command.x !== undefined && command.y !== undefined) {
    return `窗口_打开(${target}, L"custom", ${int(command.x)}, ${int(command.y)}, true);`;
  }
  if (command.placement) {
    return `窗口_打开(${target}, L"${escapeWideString(command.placement)}");`;
  }
  return `窗口_打开(${target});`;
}

function parseIntegerArgument(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^-?\d+$/u.test(trimmed)) return undefined;
  return Number.parseInt(trimmed, 10);
}

function normalizeOpenWindowPlacement(value: string | undefined): string {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'default';
  if (['center', 'middle', '居中', '居中显示', '屏幕居中'].includes(normalized)) return 'center';
  if (['top-left', 'left-top', '左上角', '左上', '左上方'].includes(normalized)) return 'top-left';
  if (['top-right', 'right-top', '右上角', '右上', '右上方'].includes(normalized)) return 'top-right';
  if (['bottom-left', 'left-bottom', '左下角', '左下', '左下方'].includes(normalized)) return 'bottom-left';
  if (['bottom-right', 'right-bottom', '右下角', '右下', '右下方'].includes(normalized)) return 'bottom-right';
  if (['custom', '自定义', '自定义坐标', '坐标'].includes(normalized)) return 'custom';
  if (['default', '默认', '系统默认'].includes(normalized)) return 'default';
  return value?.trim() || 'default';
}

function stripLingCppStringLiteral(value: string): string {
  const quoted = value.match(/^(?:L)?["“](.*)["”]$/u);
  return quoted ? (quoted[1] || '').trim() : value.trim();
}

function parseCallStatement(statement: string): { name: string; argumentsText: string } | undefined {
  const match = statement.match(/^([\w\u4e00-\u9fa5]+)\s*[（(](.*)[）)]\s*;?$/u);
  if (!match) return undefined;
  return {
    name: match[1] || '',
    argumentsText: match[2] || ''
  };
}

function translateCallArguments(raw: string, enabledModules: InstalledModule[] = []): string {
  return splitCallArguments(raw)
    .map(argument => translateLingCppExpression(argument, enabledModules))
    .join(', ');
}

function splitCallArguments(raw: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | '“' | null = null;

  for (const char of raw) {
    if (quote) {
      current += char;
      if ((quote === '"' && char === '"') || (quote === '“' && char === '”')) quote = null;
      continue;
    }
    if (char === '"' || char === '“') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if ((char === ',' || char === '，') && depth === 0) {
      if (current.trim()) args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function translateLingCppExpression(expression: string, enabledModules: InstalledModule[] = []): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  if (/^L"/u.test(trimmed)) return trimmed;
  const quoted = trimmed.match(/^["“]([^"”]*)["”]$/u);
  if (quoted) return `L"${escapeWideString(quoted[1] || '')}"`;
  if (trimmed === '真') return 'true';
  if (trimmed === '假') return 'false';
  const parenthesized = unwrapParenthesizedExpression(trimmed);
  if (parenthesized !== undefined) {
    return `(${translateLingCppExpression(parenthesized, enabledModules)})`;
  }
  const binaryExpression = splitEplBinaryExpression(trimmed);
  if (binaryExpression) {
    return `${translateLingCppExpression(binaryExpression.left, enabledModules)}${binaryExpression.operator}${translateLingCppExpression(binaryExpression.right, enabledModules)}`;
  }
  const controlTextProperty = parseEplControlMemberRule(trimmed);
  if (controlTextProperty) return `${controlTextProperty.getterRuntimeName}(L"${escapeWideString(controlTextProperty.controlName)}")`;
  const controlMethodCall = parseEplControlMethodCallRule(trimmed);
  if (controlMethodCall) {
    return `${controlMethodCall.runtimeName}(L"${escapeWideString(controlMethodCall.controlName)}", ${translateCallArguments(controlMethodCall.argumentsText, enabledModules)})`;
  }
  const call = parseCallStatement(trimmed);
  if (call) {
    const binding = findModuleCommandBinding(call.name, enabledModules);
    return `${toCppIdentifier(binding?.runtimeName || call.name)}(${translateCallArguments(call.argumentsText, enabledModules)})`;
  }
  return trimmed;
}

function parseIfCondition(statement: string): string | undefined {
  const match = statement.match(/^如果\s*[（(](.*)[）)]\s*;?$/u);
  return match?.[1]?.trim() || undefined;
}

function unwrapParenthesizedExpression(expression: string): string | undefined {
  if (!/^[（(].*[）)]$/su.test(expression)) return undefined;
  let depth = 0;
  let quote: '"' | '“' | null = null;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if ((quote === '"' && char === '"') || (quote === '“' && char === '”')) quote = null;
      continue;
    }
    if (char === '"' || char === '“') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '（') depth += 1;
    if (char === ')' || char === '）') depth -= 1;
    if (depth === 0 && index < expression.length - 1) return undefined;
  }
  return depth === 0 ? expression.slice(1, -1).trim() : undefined;
}

function parseMessageBox(statement: string): { text: string; flags: string; title: string } | undefined {
  const match = statement.match(/信息框\s*[（(]\s*[“"]([^”"]*)[”"]\s*[,，]\s*(\d+)\s*[,，]\s*[“"]([^”"]*)[”"]\s*[）)]/u);
  if (!match) return undefined;
  return {
    text: match[1] || '',
    flags: toMessageBoxFlagsExpression(Number.parseInt(match[2] || '0', 10)),
    title: match[3] || '提示'
  };
}

function toMessageBoxFlagsExpression(flagCode: number): string {
  const parts: string[] = [];
  switch (flagCode & 0x0f) {
    case 1:
      parts.push('MB_OKCANCEL');
      break;
    case 2:
      parts.push('MB_ABORTRETRYIGNORE');
      break;
    case 3:
      parts.push('MB_YESNOCANCEL');
      break;
    case 4:
      parts.push('MB_YESNO');
      break;
    case 5:
      parts.push('MB_RETRYCANCEL');
      break;
    default:
      parts.push('MB_OK');
      break;
  }
  const iconCode = flagCode & 0xf0;
  if (iconCode === 16) parts.push('MB_ICONERROR');
  if (iconCode === 32) parts.push('MB_ICONQUESTION');
  if (iconCode === 48) parts.push('MB_ICONWARNING');
  if (iconCode === 64) parts.push('MB_ICONINFORMATION');
  return parts.join(' | ');
}

function generateControlArray(window: LingWindowModel, windowIndex: number, program: LingCppProgram, resources: LingDesignerResource[]): string {
  const visibleControls = [...getVisibleControls(window)];
  const controlIds = new Map(visibleControls.map((control, index) => [control.id, index + 1001]));
  const items = ((window as any).menuItems || '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);

  items.forEach((item: string, idx: number) => {
    const handler = (window as any).menuEvents?.[`Item_${idx}`] || `_${window.className}_${item}_被选择`;
    visibleControls.push({
      id: `__virtual_menu_item_${windowIndex}_${idx}`,
      type: 'MenuItem' as any,
      name: item,
      content: item,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fontSize: 12,
      background: '#ffffff',
      foreground: '#000000',
      isEnabled: true,
      visibility: 'Visible',
      events: { Select: handler }
    });
  });

  const controls = visibleControls
    .map((control, index) => {
      let id = index + 1001;
      if (control.id.startsWith('__virtual_menu_item_')) {
        const parts = control.id.split('_');
        id = 50000 + Number.parseInt(parts[parts.length - 1], 10);
      }
      const parent = control.parentId ? visibleControls.find(item => item.id === control.parentId) : undefined;
      const tooltipResource = resources.find((resource): resource is LingToolTipResource => resource.type === 'ToolTip' && resource.targetControlId === control.id);
      const effectiveControl = tooltipResource
        ? { ...control, properties: { ...(control.properties || {}), toolTip: tooltipResource.text, toolTipDelay: tooltipResource.initialDelay } }
        : control;
      return generateControlSpec(effectiveControl, id, parent ? controlIds.get(parent.id) || 0 : 0, parent, controlIds, window.background);
    })
    .join(',\n') || '    { 0, 0, L"", L"", L"", 0, 0, 0, 0, 12, 0, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 4, 28, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(0, 0, 0), false, RGB(0, 0, 0), true, L"", L"", L"", 500, L"", L"", L"", 0, 100, 0, 0, 0, L"" }';

  return `static ControlSpec g_controls_${windowIndex}[] = {
${controls}
};`;
}

function generateImageListSpecs(project: LingWindowProject): string {
  const resources = (project.resources || []).filter(resource => resource.type === 'ImageList');
  const rows = resources.map(resource => `    { L"${escapeWideString(resource.id)}", ${int(resource.imageWidth)}, ${int(resource.imageHeight)}, L"${escapeWideString(encodeControlRecords(resource.images.map(image => [image])))}" }`);
  return rows.length > 0
    ? `static ImageListSpec g_imageLists[] = {\n${rows.join(',\n')}\n};\nstatic const int g_imageListCount = ${rows.length};`
    : 'static ImageListSpec g_imageLists[] = { { L"", 16, 16, L"" } };\nstatic const int g_imageListCount = 0;';
}

function generatePropertySheetSpecs(project: LingWindowProject): string {
  const resources = (project.resources || []).filter(resource => resource.type === 'PropertySheet');
  const rows = resources.map(resource => `    { L"${escapeWideString(resource.id)}", L"${escapeWideString(resource.title)}", L"${escapeWideString(encodeControlRecords(resource.pages.map(page => [page.id, page.title, page.content, String(Math.max(-1, project.windows.findIndex(window => window.id === page.sourceWindowId)))])))}" }`);
  return rows.length > 0
    ? `static PropertySheetSpec g_propertySheets[] = {\n${rows.join(',\n')}\n};\nstatic const int g_propertySheetCount = ${rows.length};`
    : 'static PropertySheetSpec g_propertySheets[] = { { L"", L"", L"" } };\nstatic const int g_propertySheetCount = 0;';
}

function generateFileDialogSpecs(project: LingWindowProject): string {
  const resources = (project.resources || []).filter((resource): resource is LingFileDialogResource => resource.type === 'FileDialog');
  const rows = resources.map(resource => {
    const ownerWindowIndex = project.windows.findIndex(window => window.id === resource.ownerWindowId);
    const ownerWindow = project.windows[ownerWindowIndex];
    const visibleControls = ownerWindow ? getVisibleControls(ownerWindow) : [];
    const controlId = (id: string) => {
      const index = visibleControls.findIndex(control => control.id === id);
      return index >= 0 ? index + 1001 : 0;
    };
    const triggerControlId = controlId(resource.triggerControlId);
    const dropTargetControlId = resource.dropTargetId === resource.ownerWindowId ? 0 : controlId(resource.dropTargetId);
    return `    { L"${escapeWideString(resource.id)}", L"${escapeWideString(resource.name)}", ${ownerWindowIndex}, ${triggerControlId}, ${dropTargetControlId}, ${resource.multiple ? 'true' : 'false'}, ${resource.allowDrop ? 'true' : 'false'}, L"${escapeWideString(resource.title)}", L"${escapeWideString(resource.filter)}" }`;
  });
  return rows.length > 0
    ? `static FileDialogSpec g_fileDialogs[] = {\n${rows.join(',\n')}\n};\nstatic const int g_fileDialogCount = ${rows.length};`
    : 'static FileDialogSpec g_fileDialogs[] = { { L"", L"", -1, 0, 0, false, false, L"", L"" } };\nstatic const int g_fileDialogCount = 0;';
}

function generateWindowSpec(window: LingWindowModel, windowIndex: number, program: LingCppProgram): string {
  const menuItemsStr = (window as any).menuItems || '';
  const visibleCount = getVisibleControls(window).length + menuItemsStr.split(',').map((item: string) => item.trim()).filter(Boolean).length;
  const openPlacement = normalizeOpenWindowPlacement(window.openPlacement || 'default');
  const openX = openPlacement === 'custom' ? int(window.openX ?? 120) : 'CW_USEDEFAULT';
  const openY = openPlacement === 'custom' ? int(window.openY ?? 80) : 'CW_USEDEFAULT';
  const cornerPreference = window.cornerStyle === 'square'
    ? 1
    : window.cornerStyle === 'rounded' ? 2 : window.cornerStyle === 'small-rounded' ? 3 : -1;
  const titleBarBackground = window.titleBarBackground || '#2D2D30';
  const titleBarForeground = window.titleBarForeground || '#CBD5E1';
  const iconStyle = window.iconStyle || 'lingbuilder';
  const iconPath = getSafeCustomWindowIconPath(window);
  const menuFont = normalizeControlFont({
    fontFamily: window.menuFontFamily,
    fontSize: window.menuFontSize ?? 11,
    fontBold: window.menuFontBold,
    fontItalic: window.menuFontItalic,
    fontUnderline: window.menuFontUnderline
  });
  const effectiveEvents = { ...(window.events || {}) };
  if (!effectiveEvents.Loaded) {
    const defaultLoaded = getWindowEventHandlerName(window.className, 'Loaded');
    const legacyLoaded = `${window.className}_创建完毕`;
    if (findLingCppMethod(program, defaultLoaded)) effectiveEvents.Loaded = defaultLoaded;
    else if (findLingCppMethod(program, legacyLoaded)) effectiveEvents.Loaded = legacyLoaded;
  }
  const events = Object.entries(effectiveEvents)
    .filter(([, handler]) => handler.trim())
    .map(([eventName, handler]) => `${eventName}=${handler.trim()}`)
    .join('\n');
  return `    { ${windowIndex}, L"${escapeWideString(window.className)}", L"${escapeWideString(window.title)}", ${Math.max(360, int(window.width))}, ${Math.max(220, int(window.height - TITLE_BAR_HEIGHT))}, ${toColorRef(window.background)}, ${toColorRef(titleBarBackground)}, ${toColorRef(titleBarForeground)}, ${cornerPreference}, L"${escapeWideString(iconStyle)}", L"${escapeWideString(iconPath)}", L"${escapeWideString(openPlacement)}", ${openX}, ${openY}, g_controls_${windowIndex}, ${visibleCount}, L"${escapeWideString(menuItemsStr)}", ${toColorRef(window.menuBackground || '#ffffff')}, ${toColorRef(window.menuForeground || '#000000')}, L"${escapeWideString(menuFont.family)}", ${menuFont.size}, ${menuFont.bold}, ${menuFont.italic}, ${menuFont.underline}, L"${escapeWideString(events)}" }`;
}

function generateControlSpec(
  control: LingControl,
  id: number,
  parentId = 0,
  parent?: LingControl,
  controlIds: Map<string, number> = new Map(),
  windowBackground = '#1E1E24'
): string {
  const events = Object.entries(control.events || {})
    .filter(([, handler]) => handler.trim())
    .map(([eventName, handler]) => `${eventName}=${handler.trim()}`)
    .join('\n');
  const background = control.background === 'transparent'
    ? control.type === 'ListView' ? '#0F172A' : windowBackground
    : control.background;
  const x = parent ? control.x - parent.x : control.x;
  const y = parent ? control.y - parent.y : control.y;
  const uploadControl = control.type === 'Upload' || control.type === 'DragUpload';
  const minimum = numericControlProperty(control, uploadControl ? 'limit' : 'minimum', 0);
  const maximum = numericControlProperty(control, uploadControl ? 'maxSizeKb' : 'maximum', uploadControl ? 0 : 100);
  const value = uploadControl ? numericControlProperty(control, 'styleMode', control.type === 'DragUpload' ? 5 : 0) : parseControlValue(control);
  const selectedIndex = control.type === 'TrackBar'
    ? numericControlProperty(control, 'tickFrequency', 1)
    : uploadControl
      ? (control.properties?.autoUpload === true ? 1 : 0)
        | (control.properties?.showFileList === false ? 0 : 2)
        | (control.properties?.showTip === false ? 0 : 4)
        | (control.properties?.showActions === false ? 0 : 8)
        | (control.type === 'DragUpload' || control.properties?.dropEnabled === true ? 16 : 0)
      : numericControlProperty(control, 'selectedIndex', 0);
  const [data, data2] = serializeControlData(control, controlIds);
  const tooltip = typeof control.properties?.toolTip === 'string' ? control.properties.toolTip : '';
  const tooltipDelay = numericControlProperty(control, 'toolTipDelay', 500);
  const containerSlot = control.containerSlot || '';
  const [option1, option2] = getControlOptions(control, controlIds);
  const flags = generateControlFlags(control);
  const cornerRadius = control.type === 'Button' ? clampInteger(control.properties?.cornerRadius, 6, 0, 100) : 0;
  const collectionControl = control.type === 'ListBox' || control.type === 'ComboBox' || control.type === 'ListView';
  const groupBoxControl = control.type === 'GroupBox';
  const borderControl = collectionControl || groupBoxControl;
  const borderVisible = groupBoxControl || control.type === 'ListBox'
    ? control.properties?.showBorder !== false
    : true;
  const listBorderWidth = borderControl && borderVisible ? clampInteger(control.properties?.borderWidth, 1, 0, 8) : 0;
  const listBorderColor = controlColorProperty(control, 'borderColor', groupBoxControl || control.type === 'ListView' ? '#64748B' : '#334155');
  const listSelectionStart = controlColorProperty(control, 'selectionStartColor', '#7C3AED');
  const listSelectionEnd = controlColorProperty(control, 'selectionEndColor', '#0891B2');
  const listSelectionBorder = controlColorProperty(control, 'selectionBorderColor', '#38BDF8');
  const listSelectionCornerRadius = collectionControl ? clampInteger(control.properties?.selectionCornerRadius, 4, 0, 24) : 0;
  const listItemHeight = collectionControl ? clampInteger(control.properties?.itemHeight, 28, 16, 96) : 28;
  const listItemSpacing = control.type === 'ListBox' ? clampInteger(control.properties?.itemSpacing, 0, 0, 24) : 0;
  const listHeaderHeight = control.type === 'ListView' ? clampInteger(control.properties?.headerHeight, 28, 16, 96) : 28;
  const listContentPadding = control.type === 'ListBox' ? clampInteger(control.properties?.contentPadding, 4, 0, 24) : 4;
  const listScrollBarVisibility = control.type === 'ListBox'
    ? control.properties?.scrollBarVisibility === 'visible' ? 1 : control.properties?.scrollBarVisibility === 'hidden' ? 2 : 0
    : 0;
  const listScrollBarWidth = control.type === 'ListBox' ? clampInteger(control.properties?.scrollBarWidth, 8, 4, 24) : 8;
  const listScrollBarTrack = controlColorProperty(control, 'scrollBarTrackColor', '#172033');
  const listScrollBarThumb = controlColorProperty(control, 'scrollBarThumbColor', '#0E7490');
  const treeControl = control.type === 'TreeView';
  const treeBorderWidth = treeControl ? clampInteger(control.properties?.borderWidth, 1, 0, 8) : 0;
  const treeBorderColor = controlColorProperty(control, 'borderColor', '#64748B');
  const treeNodeSpacing = treeControl ? clampInteger(control.properties?.nodeSpacing, 2, 0, 24) : 2;
  const treeNodePadding = treeControl ? clampInteger(control.properties?.nodePadding, 3, 0, 24) : 3;
  const font = normalizeControlFont(control);
  return `    { ${id}, ${parentId}, L"${control.type}", L"${escapeWideString(control.name)}", L"${escapeWideString(control.content)}", ${int(x)}, ${int(y)}, ${int(control.width)}, ${int(control.height)}, ${font.size}, L"${escapeWideString(font.family)}", ${font.bold ? 'true' : 'false'}, ${font.italic ? 'true' : 'false'}, ${font.underline ? 'true' : 'false'}, ${cornerRadius}, ${listBorderWidth}, ${toColorRef(listBorderColor)}, ${toColorRef(listSelectionStart)}, ${toColorRef(listSelectionEnd)}, ${toColorRef(listSelectionBorder)}, ${listSelectionCornerRadius}, ${listItemHeight}, ${listItemSpacing}, ${listHeaderHeight}, ${listContentPadding}, ${listScrollBarVisibility}, ${listScrollBarWidth}, ${toColorRef(listScrollBarTrack)}, ${toColorRef(listScrollBarThumb)}, ${treeBorderWidth}, ${toColorRef(treeBorderColor)}, ${treeNodeSpacing}, ${treeNodePadding}, ${toColorRef(background)}, ${control.background === 'transparent' ? 'true' : 'false'}, ${toColorRef(control.foreground)}, ${control.isEnabled ? 'true' : 'false'}, L"${escapeWideString(data)}", L"${escapeWideString(data2)}", L"${escapeWideString(tooltip)}", ${tooltipDelay}, L"${escapeWideString(containerSlot)}", L"${escapeWideString(option1)}", L"${escapeWideString(option2)}", ${minimum}, ${maximum}, ${value}, ${selectedIndex}, ${flags}, L"${escapeWideString(events)}" }`;
}

function controlColorProperty(control: LingControl, key: string, fallback: string): string {
  const value = control.properties?.[key];
  return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value) ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function getWindowHandlers(window: LingWindowModel): string[] {
  const handlers = new Set<string>();
  Object.values(window.events || {}).forEach(handler => {
    if (handler.trim()) handlers.add(handler.trim());
  });
  window.controls.forEach(control => {
    Object.values(control.events || {}).forEach(handler => {
      if (handler.trim()) handlers.add(handler.trim());
    });
  });
  Object.values((window as any).menuEvents || {}).forEach((handler: any) => {
    if (typeof handler === 'string' && handler.trim()) handlers.add(handler.trim());
  });
  return [...handlers];
}

function findWindowCreatedHandler(window: LingWindowModel, program: LingCppProgram): string | undefined {
  const candidates = [
    window.events?.Loaded?.trim(),
    `_${window.className}_创建完毕`,
    `${window.className}_创建完毕`
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find(candidate => Boolean(findLingCppMethod(program, candidate)));
}

function getVisibleControls(window: LingWindowModel): LingControl[] {
  return window.controls
    .filter(control => getEffectiveControlState(window.controls, control.id).visible)
    .map(control => ({
      ...control,
      isEnabled: getEffectiveControlState(window.controls, control.id).enabled
    }));
}

function parseControlValue(control: LingControl): number {
  const contentValue = Number.parseInt(control.content, 10);
  const configured = control.properties?.value;
  const value = control.type === 'ProgressBar' && !Number.isNaN(contentValue)
    ? contentValue
    : typeof configured === 'number' ? configured : contentValue;
  const minimum = numericControlProperty(control, 'minimum', 0);
  const maximum = numericControlProperty(control, 'maximum', 100);
  return Number.isNaN(value) ? minimum : Math.max(minimum, Math.min(maximum, value));
}

function numericControlProperty(control: LingControl, key: string, fallback: number): number {
  const value = control.properties?.[key];
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function serializeControlData(control: LingControl, controlIds: Map<string, number>): [string, string] {
  const properties = control.properties || {};
  const records = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
    ? value.map(item => typeof item === 'string' ? { text: item } : item).filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
    : [];
  const labelOf = (record: Record<string, unknown>) => String(record.title ?? record.label ?? record.name ?? record.text ?? record.id ?? '');
  const numberOf = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;

  if (control.type === 'TextBox') {
    return ['', typeof properties.verticalAlign === 'string' ? properties.verticalAlign : 'center'];
  }
  if (control.type === 'Upload' || control.type === 'DragUpload') {
    const initialFiles = Array.isArray(properties.initialFiles) ? properties.initialFiles.map(path => [String(path)]) : [];
    return [encodeControlRecords(initialFiles), typeof properties.accept === 'string' ? properties.accept : '*.*'];
  }

  if (control.type === 'ListBox' || control.type === 'ComboBox' || control.type === 'ComboBoxEx') {
    return [encodeControlRecords(records(properties.items).map(item => [labelOf(item), String(numberOf(item.image, -1))])), ''];
  }
  if (control.type === 'ListView') {
    const columns = records(properties.columns);
    const rows = records(properties.items);
    return [
      encodeControlRecords(columns.map(column => {
        const alignment = column.alignment === 'center' || column.alignment === 'right'
          ? column.alignment
          : 'left';
        return [labelOf(column), String(numberOf(column.width, 140)), String(numberOf(column.image, -1)), alignment];
      })),
      encodeControlRecords(rows.map((row, index) => {
        const cells = Array.isArray(row.cells) ? row.cells.map(cell => String(cell ?? '')) : [labelOf(row)];
        return [String(row.id ?? `row${index + 1}`), encodeControlFields(cells), String(numberOf(row.image, -1))];
      }))
    ];
  }
  if (control.type === 'TreeView') {
    const treeRows: string[][] = [];
    const visit = (items: unknown, parentId = '') => {
      records(items).forEach((item, index) => {
        const id = String(item.id ?? `${parentId || 'root'}_${index + 1}`);
        treeRows.push([id, parentId, labelOf(item), String(numberOf(item.image, -1)), item.expanded === true ? '1' : '0']);
        visit(item.children, id);
      });
    };
    visit(properties.nodes);
    return [encodeControlRecords(treeRows), ''];
  }
  if (control.type === 'TabControl' || control.type === 'PropertySheet') {
    return [encodeControlRecords(records(properties.tabs).map((tab, index) => [String(tab.id ?? `page${index + 1}`), labelOf(tab), String(numberOf(tab.image, -1))])), ''];
  }
  if (control.type === 'Header') {
    return [encodeControlRecords(records(properties.columns).map(column => [labelOf(column), String(numberOf(column.width, 120)), String(numberOf(column.image, -1))])), ''];
  }
  if (control.type === 'ToolBar') {
    return [encodeControlRecords(records(properties.buttons).map((button, index) => [String(button.id ?? index + 1), labelOf(button), String(numberOf(button.image, -1)), String(button.style ?? 'button')])), ''];
  }
  if (control.type === 'StatusBar') {
    return [encodeControlRecords(records(properties.parts).map(part => [labelOf(part), String(numberOf(part.width, 140))])), ''];
  }
  if (control.type === 'ReBar') {
    return [encodeControlRecords(records(properties.bands).map((band, index) => [String(band.id ?? index + 1), labelOf(band), String(controlIds.get(String(band.childControl ?? '')) || ''), String(numberOf(band.width, 200))])), ''];
  }
  if (control.type === 'RichEdit') {
    return [typeof properties.rtfText === 'string' ? properties.rtfText : '', ''];
  }
  const scalar = properties.imageSource ?? properties.aviSource ?? properties.url ?? properties.address ?? properties.hotKey
    ?? (typeof properties.value === 'string' ? properties.value : undefined);
  return [typeof scalar === 'string' ? scalar : '', ''];
}

function encodeControlFields(fields: string[]): string {
  return fields.map(field => `${field.length}:${field}`).join('');
}

function encodeControlRecords(records: string[][]): string {
  return records.map(record => encodeControlFields(record)).join('');
}

function generateControlFlags(control: LingControl): number {
  const properties = control.properties || {};
  const flags: Array<[string, number]> = [
    ['checked', 1 << 0], ['threeState', 1 << 1], ['multiline', 1 << 2],
    ['password', 1 << 3], ['readOnly', 1 << 4], ['numeric', 1 << 5],
    ['sorted', 1 << 6], ['multiple', 1 << 7], ['editable', 1 << 8],
    ['marquee', 1 << 9], ['gridLines', 1 << 10], ['checkBoxes', 1 << 11],
    ['wordWrap', 1 << 12], ['autoPlay', 1 << 13], ['loop', 1 << 14],
    ['hideHeader', 1 << 28]
  ];
  let result = flags.reduce((sum, [key, flag]) => properties[key] === true ? sum | flag : sum, 0);
  if (properties.orientation === 'horizontal') result |= 1 << 15;
  if (properties.buttonStyle === 'default') result |= 1 << 16;
  if (properties.buttonStyle === 'toggle') result |= 1 << 17;
  if (properties.buttonStyle === 'split') result |= 1 << 18;
  if (properties.buttonStyle === 'commandLink') result |= 1 << 19;
  if (properties.textAlign === 'center') result |= 1 << 20;
  if (properties.textAlign === 'right') result |= 1 << 21;
  if (properties.view === 'icon') result |= 1 << 22;
  if (properties.view === 'smallIcon') result |= 1 << 23;
  if (properties.view === 'list') result |= 1 << 24;
  if (properties.showBorder === true) result |= 1 << 25;
  if (properties.multiSelect === true) result |= 1 << 26;
  if (properties.showLines === true) result |= 1 << 27;
  return result;
}

function getControlOptions(control: LingControl, controlIds: Map<string, number>): [string, string] {
  const properties = control.properties || {};
  const stringValue = (key: string) => typeof properties[key] === 'string' ? String(properties[key]) : '';
  switch (control.type) {
    case 'Button': return [stringValue('buttonStyle'), ''];
    case 'TextBox': return [stringValue('textAlign'), stringValue('scrollBars')];
    case 'Label': return [stringValue('staticStyle'), stringValue('textAlign')];
    case 'RadioButton': return [stringValue('groupName'), ''];
    case 'GroupBox': return [stringValue('titleAlign') || 'left', ''];
    case 'ComboBox': return ['', String(clampInteger(properties.dropDownHeight, 160, 40, 600))];
    case 'ScrollBar':
    case 'FlatScrollBar':
    case 'Pager': return [stringValue('orientation'), ''];
    case 'Image': return [stringValue('stretch'), ''];
    case 'ListView': return [stringValue('view'), stringValue('imageListId')];
    case 'TreeView':
    case 'TabControl':
    case 'Header':
    case 'ComboBoxEx':
    case 'ToolBar': return [stringValue('imageListId'), ''];
    case 'DateTimePicker': return [stringValue('format'), stringValue('customFormat')];
    case 'RichEdit': return [stringValue('scrollBars'), ''];
    case 'Upload':
    case 'DragUpload': return [stringValue('tip'), encodeControlRecords([[stringValue('triggerText') || '选择文件', stringValue('submitText') || '上传']])];
    case 'UpDown': return [String(controlIds.get(stringValue('buddyControl')) || ''), ''];
    default: return ['', ''];
  }
}

function toColorRef(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 'RGB(30, 30, 36)';
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `RGB(${r}, ${g}, ${b})`;
}

function toCppIdentifier(value: string): string {
  const normalized = value.trim().replace(/[^\w\u4e00-\u9fa5]/g, '_').replace(/^_+/, '');
  const safe = normalized || '未命名';
  return /^\d/.test(safe) ? `_${safe}` : safe;
}

function toCppDefineIdentifier(value: string): string {
  const normalized = value.trim().replace(/[^\w]/g, '_').replace(/^_+/, '');
  const safe = normalized || 'LINGBUILDER_MODULE_DEFINE';
  return /^\d/.test(safe) ? `_${safe}` : safe;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeWideString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function escapeIncludePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/"/g, '\\"');
}

function escapeCppComment(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\*\//g, '* /');
}

function int(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}
