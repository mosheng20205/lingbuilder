import { NativeCppImportResult, LingControl, LingControlType, LingWindowModel, LingWindowProject } from './types';
import { getPrimaryEventNameForType, getLingWindowSourceFileName } from './windowDesignerService';

interface NativeImportManifestLike {
  selectedWindow?: {
    fileName?: string;
    className?: string;
    title?: string;
  };
}

interface ImportNativeCppOptions {
  project?: LingWindowProject;
  activeWindowId?: string;
  manifestText?: string;
}

interface ParsedCppMethod {
  name: string;
  returnType: string;
  parameters: Array<{ type: string; name: string }>;
  bodyLines: string[];
}

const SUPPORTED_CONTROL_TYPES = new Set<LingControlType>([
  'Button',
  'TextBox',
  'Label',
  'CheckBox',
  'RadioButton',
  'ProgressBar',
  'ComboBox',
  'Grid'
]);

export function importNativeCppToLingBuilder(
  cppSource: string,
  options: ImportNativeCppOptions = {}
): NativeCppImportResult {
  const manifest = parseManifest(options.manifestText);
  const diagnostics: string[] = [];
  const report: string[] = [];
  const preservedNativeBlocks: string[] = [];
  const normalizedSource = cppSource.replace(/\r\n/g, '\n');
  const parsedWindow = parseWindowMetadata(normalizedSource, manifest, options.project, options.activeWindowId);
  const controls = parseControls(normalizedSource);
  const methods = parseClassMethods(normalizedSource).filter(method => !isFrameworkMethod(method.name));

  report.push(`识别窗口：${parsedWindow.className}`);
  report.push(`识别控件：${controls.length} 个`);
  report.push(`识别方法：${methods.length} 个`);

  const eventHandlers = new Set(
    controls
      .flatMap(control => Object.values(control.events || {}))
      .filter(Boolean)
  );

  const methodBlocks = methods.map(method => {
    const statements = translateCppBodyToLingCpp(method.bodyLines, preservedNativeBlocks);
    const parameterText = method.parameters
      .map(parameter => `${parameter.type} ${parameter.name}`)
      .join(', ');

    if (eventHandlers.has(method.name)) {
      return [
        `    事件 ${method.name}(${parameterText})`,
        ...indentLingCppStatements(statements)
      ].join('\n');
    }

    return [
      `    ${method.returnType} ${method.name}(${parameterText})`,
      ...indentLingCppStatements(statements)
    ].join('\n');
  });

  if (controls.length === 0) {
    diagnostics.push('未能从原生 C++ 中识别控件结构，设计器将沿用当前项目窗口。');
  }

  if (methods.length === 0) {
    diagnostics.push('未识别到可转换的方法，已保留原生 C++ 行为为 @ 代码块。');
  }

  if (preservedNativeBlocks.length > 0) {
    report.push(`保留原生 C++ 代码：${preservedNativeBlocks.length} 行`);
  }

  const sourceFileName = getLingWindowSourceFileName(parsedWindow.fileName, parsedWindow.className);
  const lcppSource = [
    '包 NativeImported',
    '使用 Win32窗口',
    '使用 标准控件',
    '',
    `类 ${parsedWindow.className} : 公开 窗体`,
    '公开:',
    `    文本型 关联设计文件 = "${sourceFileName.replace(/\.lcpp$/i, '.xml')}"`,
    ...controls.map(control => `    ${mapControlTypeToLing(control.type)} ${control.name}`),
    '',
    ...methodBlocks,
    '结束类'
  ].join('\n');

  const nextWindow: LingWindowModel = {
    ...(findTargetWindow(options.project, options.activeWindowId) || createFallbackWindow()),
    id: findTargetWindow(options.project, options.activeWindowId)?.id || 'imported-window',
    fileName: parsedWindow.fileName,
    className: parsedWindow.className,
    title: parsedWindow.title,
    controls
  };

  return {
    lcppSource,
    designerProjectPatch: {
      windows: mergeProjectWindows(options.project, nextWindow, options.activeWindowId)
    },
    preservedNativeBlocks,
    diagnostics,
    report
  };
}

function parseManifest(manifestText?: string): NativeImportManifestLike | undefined {
  if (!manifestText?.trim()) return undefined;
  try {
    return JSON.parse(manifestText) as NativeImportManifestLike;
  } catch {
    return undefined;
  }
}

function parseWindowMetadata(
  cppSource: string,
  manifest: NativeImportManifestLike | undefined,
  project?: LingWindowProject,
  activeWindowId?: string
): { className: string; fileName: string; title: string } {
  const targetWindow = findTargetWindow(project, activeWindowId);
  const manifestWindow = manifest?.selectedWindow;
  const specMatch = cppSource.match(/g_windows\[\]\s*=\s*\{\s*\{\s*\d+,\s*L"([^"]+)",\s*L"([^"]+)"/s);
  const classMatch = cppSource.match(/class\s+([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\s*:\s*public\s+LingWindowBase/);

  const className = manifestWindow?.className || specMatch?.[1] || classMatch?.[1] || targetWindow?.className || '导入窗体';
  const title = manifestWindow?.title || specMatch?.[2] || targetWindow?.title || className;
  const fileName = manifestWindow?.fileName || targetWindow?.fileName || `${className}.xml`;

  return { className, title, fileName };
}

function parseControls(cppSource: string): LingControl[] {
  const arrayMatch = cppSource.match(/g_controls_\d+\[\]\s*=\s*\{([\s\S]*?)\n\};/);
  if (!arrayMatch) return [];

  const entryPattern = /\{\s*(\d+),\s*L"([^"]*)",\s*L"([^"]*)",\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*RGB\((\d+),\s*(\d+),\s*(\d+)\),\s*RGB\((\d+),\s*(\d+),\s*(\d+)\),\s*(true|false),\s*(\d+),\s*L"([^"]*)"\s*\}/g;
  const controls: LingControl[] = [];
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(arrayMatch[1] || '')) !== null) {
    const type = normalizeControlType(match[2] || '');
    if (!type || !SUPPORTED_CONTROL_TYPES.has(type)) continue;
    const handlerName = (match[17] || '').trim();
    const controlName = inferControlName(type, controls.length + 1, match[3] || '');
    controls.push({
      id: `imported_${type.toLowerCase()}_${controls.length + 1}`,
      type,
      name: controlName,
      content: unescapeCppWideString(match[3] || ''),
      x: Number.parseInt(match[4] || '0', 10),
      y: Number.parseInt(match[5] || '0', 10),
      width: Number.parseInt(match[6] || '120', 10),
      height: Number.parseInt(match[7] || '36', 10),
      fontSize: Number.parseInt(match[8] || '12', 10),
      background: toHexColor(match[9], match[10], match[11]),
      foreground: toHexColor(match[12], match[13], match[14]),
      isEnabled: match[15] === 'true',
      visibility: 'Visible',
      events: handlerName ? { [getPrimaryEventNameForType(type)]: handlerName } : undefined
    });
  }

  return controls;
}

function parseClassMethods(cppSource: string): ParsedCppMethod[] {
  const classMatch = cppSource.match(/class\s+[A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*\s*:\s*public\s+LingWindowBase\s*\{([\s\S]*?)\n\};/);
  const classBody = classMatch?.[1];
  if (!classBody) return [];

  const lines = classBody.split('\n');
  const methods: ParsedCppMethod[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const signature = lines[index]?.trim() || '';
    const match = signature.match(/^([A-Za-z_:\u4e00-\u9fa5][\w:\u4e00-\u9fa5<>*&\s]*)\s+([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\(([^)]*)\)\s*\{$/);
    if (!match) continue;

    let braceDepth = 1;
    const bodyLines: string[] = [];
    let endIndex = index;
    for (let scan = index + 1; scan < lines.length; scan += 1) {
      const text = lines[scan] || '';
      for (const char of text) {
        if (char === '{') braceDepth += 1;
        if (char === '}') braceDepth -= 1;
      }
      if (braceDepth <= 0) {
        endIndex = scan;
        break;
      }
      bodyLines.push(text);
    }

    methods.push({
      name: match[2] || '未命名功能',
      returnType: mapCppTypeToLing(match[1] || 'void'),
      parameters: parseCppParameters(match[3] || ''),
      bodyLines
    });
    index = endIndex;
  }

  return methods;
}

function parseCppParameters(raw: string): Array<{ type: string; name: string }> {
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const match = item.match(/(.+?)\s+([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)$/);
      return {
        type: mapCppTypeToLing(match?.[1] || 'void*'),
        name: match?.[2] || '参数'
      };
    });
}

function translateCppBodyToLingCpp(bodyLines: string[], preservedNativeBlocks: string[]): string[] {
  const result: string[] = [];
  bodyLines
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const translated = translateCppLine(line);
      if (translated) {
        result.push(translated);
        return;
      }
      preservedNativeBlocks.push(line);
      result.push(`@ ${line}`);
    });

  if (result.length === 0) {
    result.push('调试输出("待补充逻辑")');
  }

  return result;
}

function translateCppLine(line: string): string | undefined {
  const debugMatch = line.match(/OutputDebugStringW\(L"([^"]*)\\n?"\);?/);
  if (debugMatch) {
    return `调试输出("${unescapeCppWideString(debugMatch[1] || '')}")`;
  }

  const messageBoxMatch = line.match(/MessageBoxW\([^,]+,\s*L"([^"]*)",\s*L"([^"]*)",\s*([A-Z_|]+)\)/);
  if (messageBoxMatch) {
    return `信息框("${unescapeCppWideString(messageBoxMatch[1] || '')}", ${mapMessageBoxFlagsToNumber(messageBoxMatch[3] || 'MB_OK')}, "${unescapeCppWideString(messageBoxMatch[2] || '')}")`;
  }

  if (/DestroyWindow\(hwnd_\)|PostQuitMessage\(0\)|结束\(\);/.test(line)) {
    return '结束()';
  }

  const returnMatch = line.match(/^return\s+(.+);$/);
  if (returnMatch) {
    return `返回 (${normalizeCppExpression(returnMatch[1] || '')})`;
  }

  if (/^return;/.test(line)) {
    return '返回';
  }

  const callMatch = line.match(/^([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\((.*)\);$/);
  if (callMatch && !['if', 'while', 'switch'].includes(callMatch[1])) {
    return `${callMatch[1]}(${normalizeCppArguments(callMatch[2] || '')})`;
  }

  return undefined;
}

function normalizeCppArguments(raw: string): string {
  if (!raw.trim()) return '';
  return raw
    .split(',')
    .map(part => normalizeCppExpression(part.trim()))
    .join(', ');
}

function normalizeCppExpression(value: string): string {
  const trimmed = value.trim();
  if (/^L"([^"]*)"$/.test(trimmed)) {
    return `"${unescapeCppWideString(trimmed.slice(2, -1))}"`;
  }
  if (trimmed === 'true') return '真';
  if (trimmed === 'false') return '假';
  return trimmed;
}

function indentLingCppStatements(lines: string[]): string[] {
  return lines.map(line => `        ${line}`);
}

function mapCppTypeToLing(type: string): string {
  const normalized = type.replace(/\bconst\b/g, '').replace(/[&*]/g, '').trim();
  if (/^void$/i.test(normalized)) return '空';
  if (/std::wstring|wstring|wchar_t/i.test(normalized)) return '文本型';
  if (/^bool$/i.test(normalized)) return '逻辑型';
  if (/^double|float$/i.test(normalized)) return '小数型';
  if (/^long long$/i.test(normalized)) return '长整数型';
  if (/^int|long|short$/i.test(normalized)) return '整数型';
  return '文本型';
}

function mapControlTypeToLing(type: LingControlType): string {
  switch (type) {
    case 'Button':
      return '按钮';
    case 'TextBox':
      return '编辑框';
    case 'Label':
      return '标签';
    case 'CheckBox':
      return '复选框';
    case 'RadioButton':
      return '单选框';
    case 'ProgressBar':
      return '进度条';
    case 'ComboBox':
      return '下拉框';
    case 'Grid':
      return '控件';
    default:
      return '控件';
  }
}

function normalizeControlType(type: string): LingControlType | undefined {
  switch (type) {
    case 'Button':
    case 'TextBox':
    case 'Label':
    case 'CheckBox':
    case 'RadioButton':
    case 'ProgressBar':
    case 'ComboBox':
    case 'Grid':
      return type;
    default:
      return undefined;
  }
}

function inferControlName(type: LingControlType, index: number, content: string): string {
  const trimmed = unescapeCppWideString(content).trim();
  if (trimmed) {
    const safe = trimmed.replace(/\s+/g, '');
    if (safe.length <= 16) return safe;
  }

  switch (type) {
    case 'Button':
      return `按钮${index}`;
    case 'TextBox':
      return `编辑框${index}`;
    case 'Label':
      return `标签${index}`;
    case 'CheckBox':
      return `复选框${index}`;
    case 'RadioButton':
      return `单选框${index}`;
    case 'ProgressBar':
      return `进度条${index}`;
    case 'ComboBox':
      return `下拉框${index}`;
    case 'Grid':
      return `控件${index}`;
  }
}

function isFrameworkMethod(name: string): boolean {
  return [
    'DispatchLingEvent',
    'OnWindowCreated',
    'WindowProc',
    'Open',
    'CreateMenuForWindow',
    'RebuildControls',
    'DestroyControls'
  ].includes(name);
}

function findTargetWindow(project?: LingWindowProject, activeWindowId?: string): LingWindowModel | undefined {
  if (!project?.windows?.length) return undefined;
  return project.windows.find(window => window.id === activeWindowId) || project.windows[0];
}

function mergeProjectWindows(project: LingWindowProject | undefined, nextWindow: LingWindowModel, activeWindowId?: string): LingWindowModel[] {
  if (!project?.windows?.length) return [nextWindow];
  let replaced = false;
  const windows = project.windows.map(window => {
    if (window.id === (activeWindowId || nextWindow.id)) {
      replaced = true;
      return { ...window, ...nextWindow };
    }
    return window;
  });
  if (replaced) return windows;
  return [nextWindow, ...windows.slice(1)];
}

function createFallbackWindow(): LingWindowModel {
  return {
    id: 'imported-window',
    fileName: 'ImportedWindow.xml',
    className: '导入窗体',
    title: '导入窗体',
    width: 700,
    height: 420,
    background: '#1E1E24',
    description: '由原生 C++ 适配生成',
    controls: []
  };
}

function toHexColor(r?: string, g?: string, b?: string): string {
  return `#${[r, g, b].map(value => Number.parseInt(value || '0', 10).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function unescapeCppWideString(value: string): string {
  return value
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function mapMessageBoxFlagsToNumber(flags: string): number {
  let base = 0;
  if (flags.includes('MB_OKCANCEL')) base = 1;
  else if (flags.includes('MB_ABORTRETRYIGNORE')) base = 2;
  else if (flags.includes('MB_YESNOCANCEL')) base = 3;
  else if (flags.includes('MB_YESNO')) base = 4;
  else if (flags.includes('MB_RETRYCANCEL')) base = 5;

  if (flags.includes('MB_ICONERROR')) return base + 16;
  if (flags.includes('MB_ICONQUESTION')) return base + 32;
  if (flags.includes('MB_ICONWARNING')) return base + 48;
  if (flags.includes('MB_ICONINFORMATION')) return base + 64;
  return base;
}
