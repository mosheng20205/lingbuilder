import { getBeginnerConstantInfoAtCursor, type BeginnerConstantInfo } from './beginnerConstantInfo';
import { scanBeginnerCodePrefix } from './beginnerCompletionContext';
import {
  getBeginnerLibraryCallAtCursor,
  getBeginnerLocalReferenceAtCursor,
  getBeginnerProcedureCallAtCursor,
  resolveBeginnerFunctionLibraryDefinition,
  resolveBeginnerProcedureDefinition,
  type BeginnerFunctionLibraryDefinition,
  type BeginnerLocalDeclarationHint,
  type BeginnerLocalReference
} from './beginnerDefinitionNavigation';
import { getBeginnerIdentifierSpanAtOffset } from './beginnerTextPosition';
import { normalizeIdentifier } from './parser';
import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from './textBlock';
import type { LingCppDataType, LingCppGlobalVariable, LingCppMethod, LingCppProgram, LingCppProjectFunctionLibrary } from './types';
import { getProjectGlobalNameAtCursor } from './projectConstantReferenceService';

export type BeginnerHoverKind =
  | 'constant'
  | 'local'
  | 'localConstant'
  | 'parameter'
  | 'global'
  | 'procedure'
  | 'handler'
  | 'library'
  | 'command'
  | 'control'
  | 'dataType'
  | 'moduleType'
  | 'basicType'
  | 'unknownType';

/** 新手编辑器「符号悬停气泡」的统一描述：识别器全链归一后的展示形态（单一接口，可选字段按 kind 取用）。 */
export interface BeginnerHoverInfo {
  kind: BeginnerHoverKind;
  /** 气泡首行的符号名（展示形态：常量带 #、处理器带 &、功能库为 库名.功能名）。 */
  name: string;
  /** 首行类型列：变量/参数的类型（含 数组 标记）、子程序返回类型、控件类型名。 */
  type?: string;
  /** 第二行：值、初始值/默认值/备注或参数表（已拼好的展示串）。 */
  detail?: string;
  /** 摘要/备注行：模块命令的精简摘要（≤120 字符）、功能库功能的备注合成文案。 */
  summary?: string;
  /** 来源/作用域说明行。 */
  origin?: string;
  /** 尾行的跳转提示文案；缺省不显示尾行。 */
  jumpLabel?: string;
}

/** 命令精简摘要截断长度：超长摘要按字符截断加省略号，完整说明仍由单击后的底部提示承载。 */
const COMMAND_SUMMARY_MAX_CHARS = 120;

/** 命令精简摘要前缀（成员访问/常量引用/处理器引用不冒充命令）。 */
const HOVER_COMMAND_PREFIX_BLOCK = /[.．#＃&＆]$/u;

export interface BeginnerHoverControlTarget {
  name: string;
  controlType: string;
  windowName: string;
  kind: 'visual' | 'nonVisual' | 'resource';
}

export interface BeginnerHoverInfoContext {
  /** 当前子程序所在类名：子程序定义解析与 Ctrl+单击跳转同口径（同类优先）。 */
  className: string;
  /** 当前子程序：局部变量/参数的声明详情（类型、初始值、备注）从这里取。 */
  method: LingCppMethod;
  /** 当前文件解析出的程序：子程序定义（返回类型/参数/备注/公开私有）从这里取。 */
  program?: LingCppProgram;
  libraries: ReadonlyArray<LingCppProjectFunctionLibrary>;
  /** 可跳转的子程序名集合（与 Ctrl+单击同一来源）。 */
  procedureNames: Iterable<string>;
  localDeclarations: ReadonlyArray<BeginnerLocalDeclarationHint>;
  globals: ReadonlyArray<LingCppGlobalVariable>;
  /** 常量值提示目录：与底部提示共用（# 前缀才命中，裸标识符不显示常量值）。 */
  constants: ReadonlyArray<BeginnerConstantInfo>;
  /** 模块命令名集合（与底部提示 beginnerCommandHints 同源）。 */
  commandNames: ReadonlySet<string>;
  /** 类型来源（项目数据类型 + 已启用模块公开类型）：代码行内类型名悬停用；缺省不在代码链识别类型。 */
  types?: BeginnerTypeHoverContext;
  /** 命令签名/摘要供给方；缺省只显示命令名。 */
  resolveCommandHint?: (name: string) => { signature?: string; returnType?: string; summary?: string } | undefined;
  /** 控件引用解析依赖 textarea 源位置映射与设计器模型，由调用方在链尾兜底。 */
  resolveControl?: (identifier: { start: number; end: number; name: string }) => BeginnerHoverControlTarget | undefined;
}

export interface BeginnerModuleTypeSummary {
  name: string;
  description?: string;
  moduleName: string;
  /** 模块清单 contributes.types[].kind；旧模块省略按 opaque（句柄类型）展示。 */
  kind?: 'opaque' | 'record' | 'array';
  fields?: ReadonlyArray<{ name: string; type: string; note?: string }>;
  elementType?: string;
}

export interface BeginnerTypeHoverContext {
  projectTypes: ReadonlyArray<LingCppDataType>;
  moduleTypes: ReadonlyArray<BeginnerModuleTypeSummary>;
}

/** 基础类型一句话说明：类型单元格/代码行悬停的基础兜底内容。 */
const BEGINNER_BASIC_TYPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  空: '无返回值 / 无数据，仅用于子程序返回值类型。',
  整数型: '32 位有符号整数（int），范围约 ±21 亿。',
  长整数型: '64 位有符号整数（long long）。',
  小数型: '32 位单精度浮点数（float），约 7 位有效数字。',
  双精度型: '64 位双精度浮点数（double），约 15 位有效数字。',
  逻辑型: '布尔值，只有 真 / 假 两种取值（bool）。',
  文本型: 'Unicode 宽字符文本，读写自动管理内存。',
  字节型: '8 位无符号字节（unsigned char），取值 0~255。',
  字节集: '字节数据缓冲区，可存放任意二进制内容。',
  指针整数: '存放内存地址的整数，宽度与程序位数一致。'
};

/** 类型单元格悬停的帮助文案（接替类型输入框原先的原生 title）。 */
export const BEGINNER_TYPE_INPUT_HELP = '支持中文、英文和拼音简写，例如 wb、zs、string、int';

/** 声明表类型单元格 / 代码行类型名的悬停信息。
 * 命中优先级：项目数据类型 → 模块公开类型 → 基础类型；空返回 null；
 * 未识别的非空类型名返回 unknownType 引导（只在类型单元格悬停使用，代码链不消费）。 */
export function getBeginnerTypeHoverInfo(
  rawType: string,
  context: BeginnerTypeHoverContext
): BeginnerHoverInfo | null {
  const typeName = normalizeHoverTypeName(rawType);
  if (!typeName) return null;
  const known = resolveKnownTypeHoverInfo(typeName, context);
  if (known) return known;
  return {
    kind: 'unknownType',
    name: typeName,
    detail: BEGINNER_TYPE_INPUT_HELP,
    origin: '未在项目数据类型与已启用模块中识别该类型'
  };
}

/** 代码链消费：只命中已识别的类型（项目/模块/基础），未识别返回 null（不得让任意标识符冒出「未识别类型」气泡）。 */
function resolveKnownTypeHoverInfo(typeName: string, context: BeginnerTypeHoverContext): BeginnerHoverInfo | null {
  const projectType = context.projectTypes.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(typeName));
  if (projectType) {
    const fields = projectType.fields || [];
    const fieldText = fields
      .slice(0, 6)
      .map(field => `${field.name} ${field.type}${field.isArray ? '[]' : ''}`)
      .join(' · ');
    return {
      kind: 'dataType',
      name: projectType.name,
      detail: fields.length === 0
        ? '无字段'
        : fields.length > 6
          ? `字段：${fieldText} …共 ${fields.length} 个字段`
          : `字段：${fieldText}`,
      origin: `项目数据类型 · 项目数据类型.lcpp${projectType.note ? ` · ${projectType.note}` : ''}`
    };
  }
  const moduleType = context.moduleTypes.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(typeName));
  if (moduleType) {
    return {
      kind: 'moduleType',
      name: moduleType.name,
      detail: moduleType.description ? truncateCommandSummary(moduleType.description) : undefined,
      origin: `模块「${moduleType.moduleName}」公开类型 · ${formatModuleTypeKindLabel(moduleType)}`
    };
  }
  const basicDescription = BEGINNER_BASIC_TYPE_DESCRIPTIONS[typeName];
  if (basicDescription) {
    return { kind: 'basicType', name: typeName, detail: basicDescription, origin: '基础类型' };
  }
  return null;
}

function formatModuleTypeKindLabel(moduleType: BeginnerModuleTypeSummary): string {
  if (moduleType.kind === 'record') return '记录类型（值语义）';
  if (moduleType.kind === 'array') return `数组类型（元素 ${moduleType.elementType || '未知'}）`;
  return '句柄类型';
}

function normalizeHoverTypeName(rawType: string): string {
  return rawType.trim().replace(/\s*(?:\[\]|［］)\s*$/u, '').trim();
}

/** 光标/悬停点处的符号悬停信息：识别优先级与 Ctrl 悬停跳转识别器同链
 *（#常量 → 库名.功能名 → 局部变量/参数/局部常量 → 子程序调用/&处理器 → 模块命令 → 项目全局变量 → 控件引用），
 * 保证「悬停说的」与「Ctrl+单击跳到的」永远是同一个符号。 */
export function getBeginnerHoverInfoAtOffset(
  value: string,
  offset: number,
  context: BeginnerHoverInfoContext
): BeginnerHoverInfo | null {
  const constant = getBeginnerConstantInfoAtCursor(value, offset, context.constants);
  if (constant) return buildConstantHoverInfo(constant);

  const libraryCall = getBeginnerLibraryCallAtCursor(value, offset, context.libraries);
  if (libraryCall) {
    const definition = resolveBeginnerFunctionLibraryDefinition(
      context.libraries,
      libraryCall.libraryName,
      libraryCall.functionName
    );
    if (definition) return buildLibraryHoverInfo(definition);
  }

  const localReference = getBeginnerLocalReferenceAtCursor(value, offset, context.localDeclarations);
  if (localReference) return buildLocalHoverInfo(localReference, context);

  const procedureCall = getBeginnerProcedureCallAtCursor(value, offset, context.procedureNames);
  if (procedureCall && context.program) {
    const definition = resolveBeginnerProcedureDefinition(context.program, context.className, procedureCall.name);
    if (definition) return buildProcedureHoverInfo(definition.method, procedureCall.viaHandler === true);
  }

  const command = getCommandHoverInfo(value, offset, context);
  if (command) return command;

  const globalName = getProjectGlobalNameAtCursor(
    value,
    offset,
    context.globals.map(global => global.name)
  );
  if (globalName) {
    const global = context.globals.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(globalName));
    return {
      kind: 'global',
      name: globalName,
      type: formatHoverType(global?.type, global?.isArray === true),
      detail: formatHoverDetail(global?.initialValue ? `初始值 ${global.initialValue}` : '', global?.note),
      origin: '项目全局变量 · 项目全局变量.lcpp · 全项目读写',
      jumpLabel: 'Ctrl+单击 转到声明'
    };
  }

  // 类型名兜底（手写 `局部 类型 名` 行等场景）：只认已识别类型，未识别不冒泡（避免任意标识符误报）。
  if (context.types) {
    const span = getBeginnerIdentifierSpanAtOffset(value, offset);
    if (span && span.end > span.start) {
      const typeName = normalizeHoverTypeName(value.slice(span.start, span.end));
      const typeInfo = typeName ? resolveKnownTypeHoverInfo(typeName, context.types) : null;
      if (typeInfo) return typeInfo;
    }
  }

  if (context.resolveControl) {
    const span = getBeginnerIdentifierSpanAtOffset(value, offset);
    if (span && span.end > span.start) {
      const control = context.resolveControl({ start: span.start, end: span.end, name: value.slice(span.start, span.end) });
      if (control) {
        return {
          kind: 'control',
          name: control.name,
          type: control.controlType,
          origin: `窗口「${control.windowName}」${
            control.kind === 'nonVisual' ? '非可视组件' : control.kind === 'resource' ? '设计器资源' : '控件'
          }`,
          jumpLabel: 'Ctrl+单击 打开设计器并定位'
        };
      }
    }
  }
  return null;
}

/** 悬停气泡的同符号判定：kind+名称+内容都一致才算同一符号（同一符号内 mousemove 不写状态，防整画布重渲）。 */
export function isSameBeginnerHoverInfo(a: BeginnerHoverInfo, b: BeginnerHoverInfo): boolean {
  return a.kind === b.kind
    && a.name === b.name
    && (a.type ?? '') === (b.type ?? '')
    && (a.detail ?? '') === (b.detail ?? '')
    && (a.summary ?? '') === (b.summary ?? '');
}

function buildConstantHoverInfo(constant: BeginnerConstantInfo): BeginnerHoverInfo {
  const isProjectConstant = constant.origin !== '模块常量';
  return {
    kind: 'constant',
    name: `#${constant.name}`,
    type: constant.type,
    detail: `值 ${constant.value}`,
    origin: isProjectConstant
      ? '项目常量 · 项目全局变量.lcpp · 只读'
      : `模块「${constant.moduleName || ''}」公开常量 · 只读`,
    jumpLabel: isProjectConstant ? 'Ctrl+单击 转到声明' : undefined
  };
}

function buildLocalHoverInfo(reference: BeginnerLocalReference, context: BeginnerHoverInfoContext): BeginnerHoverInfo {
  const normalizedName = normalizeIdentifier(reference.name);
  if (reference.kind === 'parameter') {
    const parameter = (context.method.parameters || []).find(item => normalizeIdentifier(item.name) === normalizedName);
    return {
      kind: 'parameter',
      name: reference.name,
      type: parameter?.type,
      detail: formatHoverDetail(parameter?.defaultValue ? `默认值 ${parameter.defaultValue}` : '', parameter?.note),
      origin: '子程序参数 · 仅当前子程序内有效',
      jumpLabel: 'Ctrl+单击 转到声明'
    };
  }
  const local = (context.method.locals || []).find(item => normalizeIdentifier(item.name) === normalizedName);
  const isLocalConstant = reference.kind === 'constant' || local?.isConstant === true;
  return {
    kind: isLocalConstant ? 'localConstant' : 'local',
    name: reference.name,
    type: formatHoverType(local?.type, local?.isArray === true),
    detail: formatHoverDetail(local?.initialValue ? `初始值 ${local.initialValue}` : '', local?.note),
    origin: isLocalConstant ? '局部常量 · 运行时初始化一次后只读' : '局部变量 · 仅当前子程序内有效',
    jumpLabel: 'Ctrl+单击 转到声明'
  };
}

function buildProcedureHoverInfo(method: LingCppMethod, viaHandler: boolean): BeginnerHoverInfo {
  const parameterText = (method.parameters || [])
    .map(parameter => `${parameter.type}${parameter.byRef ? '*' : ''} ${parameter.name}`)
    .join(', ');
  return {
    kind: viaHandler ? 'handler' : 'procedure',
    name: viaHandler ? `&${method.name}` : method.name,
    type: method.returnType,
    detail: parameterText ? `参数：${parameterText}` : '参数：无',
    origin: `${method.access}${method.isStatic ? ' · 静态' : ''}${method.note ? ` · ${method.note}` : ''}`,
    jumpLabel: viaHandler ? 'Ctrl+单击 转到处理器定义' : 'Ctrl+单击 转到定义'
  };
}

function buildLibraryHoverInfo(definition: BeginnerFunctionLibraryDefinition): BeginnerHoverInfo {
  const parameterText = (definition.method.parameters || [])
    .map(parameter => `${parameter.type}${parameter.byRef ? '*' : ''} ${parameter.name}`)
    .join(', ');
  return {
    kind: 'library',
    name: `${definition.libraryName}.${definition.method.name}`,
    type: definition.method.returnType,
    detail: parameterText ? `参数：${parameterText}` : '参数：无',
    // 备注与新手编辑器「子程序名」表同口径：前置注释行缺失时用「可复用功能代码」兜底。
    summary: `${definition.method.access === '公开' ? '对项目公开' : '仅功能库内部'} · ${definition.method.note || '可复用功能代码'}`,
    origin: `功能库「${definition.libraryName}」${definition.method.access}功能 · ${definition.filePath}`,
    jumpLabel: 'Ctrl+单击 转到定义'
  };
}

/** 模块命令识别：悬停点的裸标识符命中命令名集合即提示（与底部提示同一来源与边界：
 * `@` 内嵌 C++ 行、多行文本块、字符串/注释内不命中；`#常量`/`&处理器`/成员访问 `.` 后不冒充命令）。 */
function getCommandHoverInfo(value: string, offset: number, context: BeginnerHoverInfoContext): BeginnerHoverInfo | null {
  if (context.commandNames.size === 0) return null;
  const safeOffset = Math.max(0, Math.min(offset, value.length));
  const lineStart = safeOffset > 0 ? value.lastIndexOf('\n', safeOffset - 1) + 1 : 0;
  const nextNewline = value.indexOf('\n', safeOffset);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  const line = value.slice(lineStart, lineEnd);
  if (line.trimStart().startsWith('@')) return null;
  if (isTextBlockLine(value, lineStart)) return null;

  const span = getBeginnerIdentifierSpanAtOffset(value, safeOffset);
  if (!span || span.end <= span.start) return null;
  const identifier = value.slice(span.start, span.end);
  if (!context.commandNames.has(identifier)) return null;

  const linePrefix = value.slice(lineStart, span.start);
  if (HOVER_COMMAND_PREFIX_BLOCK.test(linePrefix.trimEnd())) return null;
  const prefixSyntax = scanBeginnerCodePrefix(linePrefix);
  if (prefixSyntax.isInsideString || prefixSyntax.isInsideComment) return null;

  const hint = context.resolveCommandHint?.(identifier);
  return {
    kind: 'command',
    name: identifier,
    detail: hint?.signature || undefined,
    summary: hint?.summary ? truncateCommandSummary(hint.summary) : undefined,
    origin: '模块命令 · 单击放入光标查看完整说明'
  };
}

function isTextBlockLine(value: string, lineStart: number): boolean {
  const lines = value.split('\n');
  return collectLingCppTextBlockLines(
    scanLingCppTextBlockRanges(lines),
    lines.length
  ).has(value.slice(0, lineStart).split('\n').length);
}

function truncateCommandSummary(text: string): string {
  const compact = text.replace(/\s+/gu, ' ').trim();
  return compact.length > COMMAND_SUMMARY_MAX_CHARS
    ? `${compact.slice(0, COMMAND_SUMMARY_MAX_CHARS)}…`
    : compact;
}

function formatHoverType(type: string | undefined, isArray: boolean): string | undefined {
  if (!type) return undefined;
  return isArray ? `${type} · 数组` : type;
}

function formatHoverDetail(primary: string | undefined, note: string | undefined): string | undefined {
  return [primary || '', note || ''].filter(Boolean).join(' · ') || undefined;
}
