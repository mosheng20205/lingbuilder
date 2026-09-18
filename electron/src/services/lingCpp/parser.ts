import {
  LingCppAccessModifier,
  LingCppAst,
  LingCppAstNode,
  LingCppAstNodeKind,
  LingCppClass,
  LingCppConstant,
  LingCppDataField,
  LingCppDataType,
  LingCppDiagnostic,
  LingCppDllCommand,
  LingCppDllLibrary,
  LingCppDllStruct,
  LingCppDllStructField,
  LingCppGlobalVariable,
  LingCppFunctionLibrary,
  LingCppLocalVariable,
  LingCppMember,
  LingCppMethod,
  LingCppParameter,
  LingCppParseResult,
  LingCppProgram,
  LingCppSourceRange,
  LingCppStatement,
  LingCppSymbolIndex
} from './types';
import { LingCppControlFlowLine, lingCppControlFlowEndLabel, parseLingCppControlFlowLine } from './controlFlow';
import {
  LING_CPP_TEXT_BLOCK_DELIMITER,
  LingCppTextBlockRange,
  collectLingCppTextBlockLines,
  lineContainsLingCppTextBlockDelimiter,
  matchLingCppTextBlockOpening,
  scanLingCppTextBlockRanges
} from './textBlock';

export const LING_CPP_KEYWORDS = [
  '包',
  '使用',
  '类',
  '公开',
  '私有',
  '保护',
  '构造',
  '析构',
  '事件',
  '空',
  '返回',
  '如果',
  '否则',
  '如果结束',
  '循环',
  '循环结束',
  '结束类',
  '静态',
  '局部',
  '局部常量',
  '如果真',
  '否则如果',
  '如果真结束',
  '选择',
  '分支',
  '默认',
  '选择结束',
  '判断循环首',
  '判断循环尾',
  '循环判断首',
  '循环判断尾',
  '计次循环首',
  '计次循环尾',
  '变量循环首',
  '变量循环尾',
  '枚举循环首',
  '枚举循环尾',
  '跳出循环',
  '到循环尾',
  '继续循环',
  '尝试',
  '捕获',
  '最终',
  '尝试结束',
  '抛出',
  '常量',
  '全局',
  '数据类型',
  '结束数据类型',
  '功能库',
  '结束功能库'
];

export const LING_CPP_COMMANDS = [
  '信息框',
  '调试输出',
  '格式化文本',
  '结束',
  '打开窗口',
  '载入窗口',
  '载入新窗口',
  '窗口_打开',
  '窗口_关闭',
  '窗口_置标题',
  '窗口_取标题'
];

export function isLingCppCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed === '注释' || trimmed.startsWith('注释 ');
}

/** Read the single declaration note immediately preceding a source line. */
export function readLingCppDeclarationNote(lines: string[], lineNumber: number): string | undefined {
  for (let index = lineNumber - 2; index >= 0; index -= 1) {
    const previous = lines[index];
    if (previous === undefined) return undefined;
    const trimmed = previous.trim();
    if (parseLingCppParameterNoteLine(trimmed)) continue;
    if (trimmed.startsWith('//')) return trimmed.slice(2).trim();
    if (trimmed === '注释') return '';
    if (trimmed.startsWith('注释 ')) return trimmed.slice('注释'.length).trim();
    break;
  }
  return undefined;
}

function parseLingCppParameterNoteLine(line: string): { name: string; note: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('//')) return undefined;
  const content = trimmed.slice(2).trim();
  if (!content.startsWith('参数备注')) return undefined;
  const rest = content.slice('参数备注'.length).replace(/^\s*[:：]?\s*/u, '').trim();
  if (!rest) return undefined;
  const separator = rest.search(/\s*[:：=＝]\s*/u);
  if (separator < 0) return { name: rest, note: '' };
  const separatorText = rest.slice(separator).match(/^\s*[:：=＝]\s*/u)?.[0] || ':';
  return {
    name: rest.slice(0, separator).trim(),
    note: rest.slice(separator + separatorText.length).trim()
  };
}

function readLingCppParameterNotes(lines: string[], lineNumber: number): Map<string, string> {
  const notes = new Map<string, string>();
  for (let index = lineNumber - 2; index >= 0; index -= 1) {
    const parsed = parseLingCppParameterNoteLine(lines[index] || '');
    if (parsed) {
      notes.set(normalizeIdentifier(parsed.name), parsed.note);
      continue;
    }
    if (isLingCppCommentLine(lines[index] || '')) continue;
    break;
  }
  return notes;
}

export const LING_CPP_TYPES = [
  '窗体',
  '文本型',
  '整数型',
  '长整数型',
  '逻辑型',
  '小数型',
  '单精度小数型',
  '双精度小数型',
  '字节集',
  '对象',
  '窗口',
  '按钮',
  '编辑框',
  '标签',
  '复选框',
  '单选框',
  '进度条',
  '下拉框'
];

const TYPE_NAME_SOURCE = '[\\p{L}_][\\p{L}\\p{N}_]*';
const TYPE_EXPRESSION_SOURCE = `${TYPE_NAME_SOURCE}(?:\\[\\]|［］)?`;
const CLASS_RE = /^类\s+([\w\u4e00-\u9fa5]+)(?:\s*[:：]\s*(?:公开|私有|保护)?\s*([\w\u4e00-\u9fa5]+))?/;
const FUNCTION_LIBRARY_RE = new RegExp(`^功能库\\s+(${TYPE_NAME_SOURCE})$`, 'u');
const DLL_LIBRARY_RE = new RegExp(`^DLL命令库\\s+(${TYPE_NAME_SOURCE})$`, 'u');
const DLL_STRUCT_RE = new RegExp(`^结构体\\s+(${TYPE_NAME_SOURCE})(?:\\s*=\\s*(${TYPE_NAME_SOURCE}))?$`, 'u');
const DLL_SDK_HEADER_RE = /^头文件\s*=\s*([A-Za-z0-9_][A-Za-z0-9_./]*)$/u;
const DLL_STRUCT_FIELD_RE = new RegExp(`^(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*\\[\\s*(\\d+)\\s*\\])?(?:\\s*//\\s*(.*))?$`, 'u');
const DLL_ARCH_RE = /^(Win32|x64)\s*=\s*["“]([^"”]+)["”]$/u;
const DLL_SYSTEM_RE = /^系统\s*=\s*真$/u;
const DLL_LOAD_MODE_RE = /^加载方式\s*[=＝]\s*(内存|内存加载|文件|落盘)$/u;
const DLL_PUBLIC_RE = /^公开\s*=\s*(真|假)$/u;
const DLL_REMARK_RE = /^备注\s*[:：]?\s*(.+)$/u;
const DLL_COMMAND_RE = new RegExp(`^(空|${TYPE_EXPRESSION_SOURCE})\\s+(${TYPE_NAME_SOURCE})\\s*[（(]([^）)]*)[）)](?:\\s*=\\s*(${TYPE_NAME_SOURCE}))?(?:\\s+(cdecl|stdcall))?$`, 'u');
const DATA_TYPE_RE = new RegExp(`^数据类型\\s+(${TYPE_NAME_SOURCE})$`, 'u');
const DATA_FIELD_RE = new RegExp(`^(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.+))?$`, 'u');
const CONSTANT_RE = new RegExp(`^常量\\s+(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.*))?$`, 'u');
const GLOBAL_RE = new RegExp(`^全局\\s+(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.+))?$`, 'u');
const ACCESS_RE = /^(公开|私有|保护)\s*[:：]?$/;
const METHOD_RE = new RegExp(
  `^(静态\\s+)?(事件|构造|析构|空|${TYPE_EXPRESSION_SOURCE})\\s*(${TYPE_NAME_SOURCE})?\\s*[（(]([^）)]*)[）)]`, 'u'
);
const MEMBER_RE = new RegExp(`^(静态\\s+)?(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.+))?$`, 'u');
const LOCAL_CONSTANT_RE = new RegExp(`^局部常量\\s+(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.*))?$`, 'u');
const LOCAL_RE = new RegExp(`^(?:局部\\s+)?(${TYPE_NAME_SOURCE})\\s+(${TYPE_NAME_SOURCE})(?:\\s*(\\[\\]|［］))?(?:\\s*[=＝]\\s*(.+))?$`, 'u');

export function parseLingCpp(source: string): LingCppParseResult {
  const diagnostics: LingCppDiagnostic[] = [];
  const program: LingCppProgram = {
    packageName: '',
    uses: [],
    constants: [],
    globals: [],
    dataTypes: [],
    functionLibraries: [],
    dllLibraries: [],
    classes: [],
    diagnostics,
    source
  };

  const lines = source.split(/\r?\n/);
  // 多行文本块预扫描：块内物理行在行循环里被整体跳过，开始行收敛为单条语句。
  const textBlockScan = scanLingCppTextBlockRanges(lines);
  const textBlockByOpenLine = new Map<number, LingCppTextBlockRange>(
    textBlockScan.ranges.map(range => [range.openLine, range])
  );
  const textBlockConsumedLines = collectLingCppTextBlockLines(textBlockScan, lines.length);
  const textBlockStrayCloses = new Set(textBlockScan.strayCloseLines);
  let currentClass: LingCppClass | null = null;
  let currentClassNode: LingCppAstNode | null = null;
  let currentAccess: LingCppAccessModifier = '私有';
  let currentMethod: LingCppMethod | null = null;
  let currentMethodNode: LingCppAstNode | null = null;
  let currentDataType: LingCppDataType | null = null;
  let currentDataTypeNode: LingCppAstNode | null = null;
  let currentFunctionLibrary: LingCppFunctionLibrary | null = null;
  let currentFunctionLibraryNode: LingCppAstNode | null = null;
  let currentDllLibrary: LingCppDllLibrary | null = null;
  let currentDllLibraryNode: LingCppAstNode | null = null;
  let currentDllStruct: LingCppDllStruct | null = null;
  const astNodes: LingCppAstNode[] = [];
  const rootNode = createAstNode('program', '源文件', 1, lines[0] || '', undefined, {
    range: createDocumentRange(lines)
  });
  astNodes.push(rootNode);

  const pushNode = (node: LingCppAstNode, parent: LingCppAstNode | null = rootNode) => {
    if (parent) {
      node.parentId = parent.id;
      parent.children.push(node);
    }
    astNodes.push(node);
    return node;
  };

  const closeCurrentMethod = (endLine: number) => {
    if (!currentMethod || !currentMethodNode) return;
    const safeEndLine = Math.max(currentMethod.line, Math.min(Math.max(1, lines.length), endLine));
    currentMethod.endLine = safeEndLine;
    setNodeEndRange(currentMethodNode, lines, safeEndLine);
    currentMethod = null;
    currentMethodNode = null;
  };

  const closeCurrentClass = (endLine: number) => {
    if (!currentClass || !currentClassNode) return;
    closeCurrentMethod(Math.max(currentClass.line, endLine - 1));
    const safeEndLine = Math.max(currentClass.line, Math.min(Math.max(1, lines.length), endLine));
    currentClass.endLine = safeEndLine;
    setNodeEndRange(currentClassNode, lines, safeEndLine);
    currentClass = null;
    currentClassNode = null;
    currentAccess = '私有';
  };

  const closeCurrentFunctionLibrary = (endLine: number) => {
    if (!currentFunctionLibrary || !currentFunctionLibraryNode) return;
    closeCurrentMethod(Math.max(currentFunctionLibrary.line, endLine - 1));
    const safeEndLine = Math.max(currentFunctionLibrary.line, Math.min(Math.max(1, lines.length), endLine));
    currentFunctionLibrary.endLine = safeEndLine;
    setNodeEndRange(currentFunctionLibraryNode, lines, safeEndLine);
    currentFunctionLibrary = null;
    currentFunctionLibraryNode = null;
    currentAccess = '公开';
  };

  const closeCurrentDllLibrary = (endLine: number) => {
    if (!currentDllLibrary || !currentDllLibraryNode) return;
    const safeEndLine = Math.max(currentDllLibrary.line, Math.min(Math.max(1, lines.length), endLine));
    currentDllLibrary.endLine = safeEndLine;
    setNodeEndRange(currentDllLibraryNode, lines, safeEndLine);
    currentDllLibrary = null;
    currentDllLibraryNode = null;
    currentDllStruct = null;
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    // 文本块内部行与结束标记不参与任何行级语法；开始行落到兜底时收敛为单条语句。
    if (textBlockConsumedLines.has(lineNumber) && !textBlockByOpenLine.has(lineNumber)) return;
    if (textBlockStrayCloses.has(lineNumber)) {
      diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的文本块结束标记。', `请删除该行，或在前面补写「变量 = ${LING_CPP_TEXT_BLOCK_DELIMITER}」开始行。`));
      return;
    }

    if (!trimmed) {
      appendStatement(currentMethod, line, lineNumber);
      return;
    }

    if (isLingCppCommentLine(trimmed)) {
      appendStatement(currentMethod, line, lineNumber);
      pushNode(createAstNode('comment', trimmed, lineNumber, line, currentMethodNode?.id || currentClassNode?.id || currentFunctionLibraryNode?.id || currentDataTypeNode?.id || rootNode.id, {
        value: trimmed
      }), currentMethodNode || currentClassNode || currentFunctionLibraryNode || currentDataTypeNode || rootNode);
      return;
    }

    if (trimmed === '结束数据类型') {
      if (!currentDataType || !currentDataTypeNode) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的结束数据类型。', '请删除该行，或在前面添加数据类型声明。'));
        return;
      }
      currentDataType.endLine = lineNumber;
      setNodeEndRange(currentDataTypeNode, lines, lineNumber);
      currentDataType = null;
      currentDataTypeNode = null;
      return;
    }

    const dllLibraryMatch = !currentClass && !currentDataType && !currentFunctionLibrary && !currentDllLibrary
      ? trimmed.match(DLL_LIBRARY_RE)
      : null;
    if (dllLibraryMatch) {
      if (currentMethod) closeCurrentMethod(lineNumber - 1);
      currentDllLibrary = {
        name: dllLibraryMatch[1],
        line: lineNumber,
        archFiles: [],
        commands: [],
        structs: [],
        sdkHeaders: []
      };
      currentDllLibraryNode = pushNode(createAstNode('dll-library', currentDllLibrary.name, lineNumber, line, rootNode.id, {
        detail: '项目 DLL 命令库'
      }));
      program.dllLibraries.push(currentDllLibrary);
      return;
    }
    if (trimmed === '结束DLL命令库') {
      if (!currentDllLibrary || !currentDllLibraryNode) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的结束DLL命令库。', '请删除该行，或在前面添加 DLL命令库 声明。'));
        return;
      }
      if (currentDllStruct) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, `结构体 ${currentDllStruct.name} 缺少 结束结构体。`, '请在结构体字段后添加一行 `结束结构体`。'));
      }
      closeCurrentDllLibrary(lineNumber);
      return;
    }
    if (currentDllLibrary) {
      const dllSdkHeaderMatch = trimmed.match(DLL_SDK_HEADER_RE);
      if (dllSdkHeaderMatch) {
        const headerName = (dllSdkHeaderMatch[1] || '').trim();
        if (currentDllLibrary.sdkHeaders.includes(headerName)) return;
        currentDllLibrary.sdkHeaders.push(headerName);
        pushNode(createAstNode('dll-arch', `头文件 = ${headerName}`, lineNumber, line, currentDllLibraryNode?.id, {
          detail: '生成 C++ 时额外引入的 SDK 头文件'
        }), currentDllLibraryNode);
        return;
      }
      const dllStructMatch = !currentDllStruct ? trimmed.match(DLL_STRUCT_RE) : null;
      if (dllStructMatch) {
        const structName = dllStructMatch[1] || '';
        const aliasTypeName = (dllStructMatch[2] || '').trim() || undefined;
        if (currentDllLibrary.structs.some(item => item.name === structName)) {
          diagnostics.push(createDiagnostic('error', lineNumber, line, `结构体 ${structName} 重复声明。`, '结构体名在库内必须唯一。'));
          return;
        }
        currentDllStruct = { name: structName, line: lineNumber, fields: [] };
        if (aliasTypeName) currentDllStruct.aliasTypeName = aliasTypeName;
        currentDllLibrary.structs.push(currentDllStruct);
        pushNode(createAstNode('dll-struct', structName, lineNumber, line, currentDllLibraryNode?.id, {
          detail: aliasTypeName ? `结构体别名：${structName} = ${aliasTypeName}` : 'DLL 结构体'
        }), currentDllLibraryNode);
        return;
      }
      if (currentDllStruct) {
        if (trimmed === '结束结构体') {
          if (currentDllStruct.fields.length === 0) {
            diagnostics.push(createDiagnostic('error', lineNumber, line, `结构体 ${currentDllStruct.name} 没有任何字段。`, '请在 结构体 与 结束结构体 之间声明字段，例如 `整数型 dwSize`。'));
          }
          currentDllStruct = null;
          return;
        }
        const structFieldMatch = trimmed.match(DLL_STRUCT_FIELD_RE);
        if (structFieldMatch) {
          const fieldType = structFieldMatch[1] || '';
          const fieldName = structFieldMatch[2] || '';
          const arrayLengthText = structFieldMatch[3] || '';
          if (currentDllStruct.fields.some(item => item.name === fieldName)) {
            diagnostics.push(createDiagnostic('error', lineNumber, line, `结构体 ${currentDllStruct.name} 的字段 ${fieldName} 重复声明。`, '字段名在结构体内必须唯一。'));
            return;
          }
          const field: LingCppDllStructField = { name: fieldName, type: fieldType, line: lineNumber };
          if (arrayLengthText) field.arrayLength = Number.parseInt(arrayLengthText, 10);
          const noteText = (structFieldMatch[4] || '').trim();
          if (noteText) field.note = noteText;
          currentDllStruct.fields.push(field);
          pushNode(createAstNode('dll-struct-field', fieldName, lineNumber, line, currentDllLibraryNode?.id, {
            detail: `${fieldType}${field.arrayLength !== undefined ? `[${field.arrayLength}]` : ''} ${fieldName}`
          }), currentDllLibraryNode);
          return;
        }
        diagnostics.push(createDiagnostic('error', lineNumber, line, '无法识别的结构体字段行。', '格式：`类型 字段名`、定长文本 `文本型 字段名[260]`，用 `结束结构体` 收尾。'));
        return;
      }
      if (DLL_SYSTEM_RE.test(trimmed)) {
        currentDllLibrary.isSystem = true;
        pushNode(createAstNode('dll-arch', '系统 = 真', lineNumber, line, currentDllLibraryNode?.id, {
          detail: '系统 DLL（免分发）'
        }), currentDllLibraryNode);
        return;
      }
      if (DLL_LOAD_MODE_RE.test(trimmed)) {
        const memory = /内存/u.test(trimmed.match(DLL_LOAD_MODE_RE)?.[1] || '');
        currentDllLibrary.memoryLoad = memory;
        pushNode(createAstNode('dll-arch', trimmed, lineNumber, line, currentDllLibraryNode?.id, {
          detail: memory ? '内存加载（不落盘）' : '同目录加载'
        }), currentDllLibraryNode);
        return;
      }
      const dllRemarkMatch = trimmed.match(DLL_REMARK_RE);
      if (dllRemarkMatch) {
        const target = currentDllLibrary.commands[currentDllLibrary.commands.length - 1];
        if (!target) {
          diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的备注行。', '备注必须写在某条声明命令的下一行。'));
          return;
        }
        target.remark = (dllRemarkMatch[1] || '').trim();
        return;
      }
      const dllPublicMatch = trimmed.match(DLL_PUBLIC_RE);
      if (dllPublicMatch) {
        const target = currentDllLibrary.commands[currentDllLibrary.commands.length - 1];
        if (!target) {
          diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的「公开」标记行。', '公开标记必须写在某条声明命令的下一行，例如 `公开 = 假`。'));
          return;
        }
        target.isPublic = dllPublicMatch[1] === '真';
        return;
      }
      const dllArchMatch = trimmed.match(DLL_ARCH_RE);
      if (dllArchMatch) {
        const relativePath = (dllArchMatch[2] || '').trim().replace(/\\/gu, '/');
        if (!/\.dll$/iu.test(relativePath) || relativePath.includes('..') || /^[a-zA-Z]:/u.test(relativePath) || relativePath.startsWith('/')) {
          diagnostics.push(createDiagnostic('error', lineNumber, line, 'DLL 路径必须是项目内相对的 .dll 文件。', `示例：Win32 = "dll/Win32/${currentDllLibrary.name}.dll"`));
          return;
        }
        currentDllLibrary.archFiles = currentDllLibrary.archFiles.filter(item => item.arch !== dllArchMatch[1]);
        currentDllLibrary.archFiles.push({ arch: dllArchMatch[1] as 'Win32' | 'x64', relativePath, line: lineNumber });
        pushNode(createAstNode('dll-arch', `${dllArchMatch[1]} = ${relativePath}`, lineNumber, line, currentDllLibraryNode?.id, {
          detail: '架构 DLL 文件'
        }), currentDllLibraryNode);
        return;
      }
      const dllCommandMatch = trimmed.match(DLL_COMMAND_RE);
      if (dllCommandMatch) {
        const commandName = dllCommandMatch[2] || '';
        if (currentDllLibrary.commands.some(item => item.name === commandName)) {
          diagnostics.push(createDiagnostic('error', lineNumber, line, `DLL 命令 ${commandName} 重复声明。`, '命令名即 DLL 导出函数名，请保持唯一。'));
          return;
        }
        const parameters = (dllCommandMatch[3] || '').split(/[,，]/u).map(piece => piece.trim()).filter(Boolean).map((piece, index) => {
          let note: string | undefined;
          const noteSeparator = piece.indexOf('//');
          if (noteSeparator >= 0) {
            const noteText = piece.slice(noteSeparator + 2).trim();
            if (noteText) note = noteText;
            piece = piece.slice(0, noteSeparator).trim();
          }
          const pieces = piece.split(/\s+/u).filter(Boolean);
          const byRef = pieces[pieces.length - 1] === '传址';
          if (byRef) pieces.pop();
          const parameterType = pieces[0] || '文本型';
          const parameterName = pieces.length > 1 ? pieces.slice(1).join('') : `参数${index + 1}`;
          const parameter: LingCppParameter & { line: number } = { name: parameterName, type: parameterType, byRef, line: lineNumber };
          if (note !== undefined) parameter.note = note;
          return parameter;
        });
        const command: LingCppDllCommand = {
          name: commandName,
          returnType: dllCommandMatch[1] || '空',
          parameters,
          callingConvention: dllCommandMatch[5] === 'stdcall' ? 'stdcall' : 'cdecl',
          exportName: dllCommandMatch[4] || undefined,
          line: lineNumber
        };
        currentDllLibrary.commands.push(command);
        pushNode(createAstNode('dll-command', commandName, lineNumber, line, currentDllLibraryNode?.id, {
          returnType: command.returnType,
          detail: `${command.returnType} ${commandName}(${parameters.map(parameter => `${parameter.type}${parameter.byRef ? '*' : ''} ${parameter.name}`).join(', ')})${command.exportName ? ` = ${command.exportName}` : ''}${command.callingConvention === 'stdcall' ? ' stdcall' : ''}`
        }), currentDllLibraryNode);
        return;
      }
      if (ACCESS_RE.test(trimmed)) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, 'DLL 命令库不支持访问修饰符。', '声明的导出函数即对外命令，无需公开/私有区分。'));
        return;
      }
      if (trimmed === '结束') {
        diagnostics.push(createDiagnostic('error', lineNumber, line, 'DLL 命令库不支持「结束」标记。', '请继续写声明行，或用 `结束DLL命令库` 收尾。'));
        return;
      }
      diagnostics.push(createDiagnostic('error', lineNumber, line, '无法识别的 DLL 命令声明行。', '格式：`返回类型 命令名(类型 参数, ...) [= 导出名] [stdcall]`、`Win32 = "dll/..."`、`系统 = 真` 或 `备注: 文本`。'));
      return;
    }

    const dataTypeMatch = !currentClass && !currentFunctionLibrary && !currentDataType ? trimmed.match(DATA_TYPE_RE) : null;
    if (dataTypeMatch) {
      currentDataType = { name: dataTypeMatch[1], line: lineNumber, fields: [] };
      program.dataTypes.push(currentDataType);
      currentDataTypeNode = pushNode(createAstNode('data-type', currentDataType.name, lineNumber, line, rootNode.id, {
        detail: '项目自定义数据类型'
      }));
      return;
    }

    if (currentDataType && currentDataTypeNode) {
      const fieldMatch = trimmed.match(DATA_FIELD_RE);
      if (!fieldMatch) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, `数据类型 ${currentDataType.name} 中的字段声明无效。`, '请写成 `类型 字段名`，可追加 [] 或字面量默认值。'));
        pushNode(createAstNode('statement', trimmed, lineNumber, line, currentDataTypeNode.id, {
          value: trimmed,
          detail: '无效字段声明'
        }), currentDataTypeNode);
        return;
      }
      const field: LingCppDataField = {
        type: fieldMatch[1],
        name: fieldMatch[2],
        line: lineNumber,
        isArray: Boolean(fieldMatch[3]),
        initialValue: fieldMatch[4]?.trim()
      };
      currentDataType.fields.push(field);
      pushNode(createAstNode('data-field', field.name, lineNumber, line, currentDataTypeNode.id, {
        type: field.type,
        value: field.initialValue,
        isArray: field.isArray,
        detail: [field.type, field.isArray ? '数组' : '', field.initialValue ? `= ${field.initialValue}` : ''].filter(Boolean).join(' ')
      }), currentDataTypeNode);
      return;
    }

    if (trimmed.startsWith('包 ')) {
      program.packageName = trimmed.slice('包'.length).trim();
      pushNode(createAstNode('package', program.packageName, lineNumber, line, rootNode.id, {
        value: program.packageName
      }));
      return;
    }

    if (trimmed.startsWith('使用 ')) {
      const useName = trimmed.slice('使用'.length).trim();
      program.uses.push(useName);
      pushNode(createAstNode('use', useName, lineNumber, line, rootNode.id, {
        value: useName
      }));
      return;
    }

    const constantMatch = !currentClass && !currentFunctionLibrary ? trimmed.match(CONSTANT_RE) : null;
    if (constantMatch) {
      const constant: LingCppConstant = {
        type: constantMatch[1],
        name: constantMatch[2],
        line: lineNumber,
        initialValue: constantMatch[4]?.trim() || ''
      };
      program.constants.push(constant);
      pushNode(createAstNode('constant', constant.name, lineNumber, line, rootNode.id, {
        type: constant.type,
        value: constant.initialValue,
        detail: [constant.type, constant.initialValue ? `= ${constant.initialValue}` : '未初始化'].join(' ')
      }));
      if (constantMatch[3]) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, `项目常量 ${constant.name} 不支持数组。`, '请使用基础标量类型，并删除数组标记。'));
      }
      return;
    }

    const globalMatch = !currentClass && !currentFunctionLibrary ? trimmed.match(GLOBAL_RE) : null;
    if (globalMatch) {
      const global: LingCppGlobalVariable = {
        type: globalMatch[1],
        name: globalMatch[2],
        line: lineNumber,
        isArray: Boolean(globalMatch[3]),
        initialValue: globalMatch[4]?.trim()
      };
      program.globals.push(global);
      pushNode(createAstNode('global', global.name, lineNumber, line, rootNode.id, {
        type: global.type,
        value: global.initialValue,
        isArray: global.isArray,
        detail: [global.type, global.isArray ? '数组' : '', global.initialValue ? `= ${global.initialValue}` : ''].filter(Boolean).join(' ')
      }));
      return;
    }

    const functionLibraryMatch = !currentClass && !currentDataType && !currentFunctionLibrary
      ? trimmed.match(FUNCTION_LIBRARY_RE)
      : null;
    if (functionLibraryMatch) {
      currentFunctionLibrary = {
        name: functionLibraryMatch[1],
        line: lineNumber,
        methods: []
      };
      currentFunctionLibraryNode = pushNode(createAstNode('function-library', currentFunctionLibrary.name, lineNumber, line, rootNode.id, {
        detail: '项目功能库'
      }));
      currentAccess = '公开';
      program.functionLibraries.push(currentFunctionLibrary);
      return;
    }

    if (trimmed === '结束功能库') {
      if (!currentFunctionLibrary) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '多余的结束功能库。', '请删除该行，或在前面添加功能库声明。'));
        return;
      }
      closeCurrentFunctionLibrary(lineNumber);
      return;
    }

    const classMatch = !currentFunctionLibrary ? trimmed.match(CLASS_RE) : null;
    if (classMatch) {
      if (currentClass) closeCurrentClass(lineNumber - 1);
      currentClass = {
        name: classMatch[1],
        baseClass: classMatch[2] || undefined,
        line: lineNumber,
        members: [],
        methods: []
      };
      currentClassNode = pushNode(createAstNode('class', currentClass.name, lineNumber, line, rootNode.id, {
        access: currentAccess,
        type: currentClass.baseClass,
        detail: currentClass.baseClass ? `继承 ${currentClass.baseClass}` : '类'
      }));
      currentAccess = '私有';
      program.classes.push(currentClass);
      return;
    }

    if (trimmed === '结束类') {
      closeCurrentClass(lineNumber);
      return;
    }

    const accessMatch = trimmed.match(ACCESS_RE);
    if (accessMatch) {
      closeCurrentMethod(lineNumber - 1);
      currentAccess = accessMatch[1] as LingCppAccessModifier;
      if (!currentClass && !currentFunctionLibrary) {
        diagnostics.push(createDiagnostic('warning', lineNumber, line, '访问修饰符必须写在类或功能库内部。', '请把公开或私有段移动到对应结构内。'));
      }
      if (currentFunctionLibrary && currentAccess === '保护') {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '功能库不支持保护访问。', '请改用公开或私有。'));
      }
      pushNode(createAstNode('access', currentAccess, lineNumber, line, currentClassNode?.id || currentFunctionLibraryNode?.id || rootNode.id, {
        access: currentAccess,
        detail: '访问修饰符'
      }), currentClassNode || currentFunctionLibraryNode || rootNode);
      return;
    }

    if (trimmed === '结束' && currentMethod) {
      closeCurrentMethod(lineNumber);
      return;
    }

    if (!currentClass && !currentFunctionLibrary) {
      diagnostics.push(createDiagnostic('warning', lineNumber, line, '类外语句不会参与中文 C++ 生成。', '请把语句放入 `类 ... 结束类` 内。'));
      pushNode(createAstNode('statement', trimmed, lineNumber, line, rootNode.id, {
        value: trimmed,
        detail: '类外语句'
      }));
      return;
    }

    const methodMatch = trimmed.match(METHOD_RE);
    if (methodMatch && isMethodDeclaration(trimmed, methodMatch[2], methodMatch[3])) {
      closeCurrentMethod(lineNumber - 1);
      const isStatic = Boolean(methodMatch[1]);
      const prefix = methodMatch[2];
      const declaredName = methodMatch[3]?.trim();
      const method: LingCppMethod = {
        name: normalizeMethodName(prefix, declaredName, currentClass?.name || currentFunctionLibrary?.name || ''),
        returnType: methodReturnType(prefix),
        access: currentAccess,
        isStatic: isStatic && methodKind(prefix) === 'method',
        kind: methodKind(prefix),
        line: lineNumber,
        parameters: parseParameters(methodMatch[4] || '', readLingCppParameterNotes(lines, lineNumber)),
        locals: [],
        statements: []
      };
      method.note = readLingCppDeclarationNote(lines, lineNumber);
      if (currentFunctionLibrary && method.kind !== 'method') {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '功能库只允许普通功能，不能声明事件、构造或析构。', '请使用 `空 功能名()` 或带返回类型的普通功能。'));
      }
      (currentClass?.methods || currentFunctionLibrary?.methods)?.push(method);
      currentMethod = method;
      const methodNodeKind = method.kind;
      currentMethodNode = pushNode(createAstNode(methodNodeKind, method.name, lineNumber, line, currentClassNode?.id, {
        access: currentAccess,
        returnType: method.returnType,
        isStatic: method.isStatic,
        detail: method.kind === 'event' ? '事件处理器' : method.returnType
      }), currentClassNode || currentFunctionLibraryNode);
      method.parameters.forEach(parameter => {
        pushNode(createAstNode('parameter', parameter.name, lineNumber, line, currentMethodNode?.id, {
          type: parameter.type,
          detail: '参数'
        }), currentMethodNode);
      });
      return;
    }

    const localConstantMatch = currentMethod ? trimmed.match(LOCAL_CONSTANT_RE) : null;
    if (localConstantMatch && currentMethod && currentMethodNode) {
      const local: LingCppLocalVariable = {
        type: localConstantMatch[1],
        name: localConstantMatch[2],
        line: lineNumber,
        initialValue: localConstantMatch[4]?.trim(),
        note: readLingCppDeclarationNote(lines, lineNumber),
        isArray: Boolean(localConstantMatch[3]),
        isConstant: true
      };
      (currentMethod.locals ||= []).push(local);
      pushNode(createAstNode('local', local.name, lineNumber, line, currentMethodNode.id, {
        type: local.type,
        value: local.initialValue,
        isArray: local.isArray,
        isConstant: true,
        detail: ['局部常量', local.type, local.initialValue ? `= ${local.initialValue}` : '未初始化'].filter(Boolean).join(' ')
      }), currentMethodNode);
      if (local.isArray) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, `局部常量 ${local.name} 不支持数组。`, '请删除数组标记，或改用普通局部变量。'));
      }
      if (!local.initialValue) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, `局部常量 ${local.name} 必须填写初始值。`, '请在声明时使用字面量、前置值或命令结果初始化。'));
      }
      return;
    }

    if (!currentMethod && trimmed.startsWith('局部常量')) {
      diagnostics.push(createDiagnostic('error', lineNumber, line, '局部常量只能声明在事件、方法、构造或功能库函数内部。', '请把声明移动到目标子程序正文中。'));
      pushNode(createAstNode('statement', trimmed, lineNumber, line, currentClassNode?.id || currentFunctionLibraryNode?.id, {
        value: trimmed,
        detail: '无效的局部常量声明'
      }), currentClassNode || currentFunctionLibraryNode);
      return;
    }

    const localMatch = currentMethod ? trimmed.match(LOCAL_RE) : null;
    if (localMatch && currentMethod && currentMethodNode && !LING_CPP_KEYWORDS.includes(localMatch[1])) {
      const local: LingCppLocalVariable = {
        type: localMatch[1],
        name: localMatch[2],
        line: lineNumber,
        initialValue: localMatch[4]?.trim(),
        note: readLingCppDeclarationNote(lines, lineNumber),
        isArray: Boolean(localMatch[3])
      };
      (currentMethod.locals ||= []).push(local);
      pushNode(createAstNode('local', local.name, lineNumber, line, currentMethodNode.id, {
        type: local.type,
        value: local.initialValue,
        isArray: local.isArray,
        detail: [local.type, local.isArray ? '数组' : '', local.initialValue ? `= ${local.initialValue}` : ''].filter(Boolean).join(' ')
      }), currentMethodNode);
      return;
    }

    const memberMatch = trimmed.match(MEMBER_RE);
    if (memberMatch && !currentMethod && currentFunctionLibrary) {
      diagnostics.push(createDiagnostic('error', lineNumber, line, '首版功能库不支持成员变量或状态。', '请把数据通过参数传入并通过返回值传出。'));
      pushNode(createAstNode('statement', trimmed, lineNumber, line, currentFunctionLibraryNode?.id, {
        value: trimmed,
        detail: '功能库不支持成员状态'
      }), currentFunctionLibraryNode);
      return;
    }

    if (memberMatch && !currentMethod) {
      const member: LingCppMember = {
        type: memberMatch[2],
        name: memberMatch[3],
        access: currentAccess,
        line: lineNumber,
        initialValue: memberMatch[5]?.trim(),
        isStatic: Boolean(memberMatch[1]),
        isArray: Boolean(memberMatch[4])
      };
      currentClass.members.push(member);
      pushNode(createAstNode('member', member.name, lineNumber, line, currentClassNode?.id, {
        access: member.access,
        type: member.type,
        value: member.initialValue,
        isStatic: member.isStatic,
        isArray: member.isArray,
        detail: [
          member.isStatic ? '静态' : '',
          member.type,
          member.isArray ? '数组' : '',
          member.initialValue ? `= ${member.initialValue}` : ''
        ].filter(Boolean).join(' ')
      }), currentClassNode);
      return;
    }

    const blockRange = textBlockByOpenLine.get(lineNumber);
    if (blockRange) {
      if (!currentMethod) {
        diagnostics.push(createDiagnostic('error', lineNumber, line, '多行文本块只能写在事件、方法、构造或功能库函数内部。', '请把「变量 = """」开始行移动到子程序正文中。'));
      } else {
        const contentLines = lines.slice(lineNumber, blockRange.closeLine - 1);
        const statement: LingCppStatement = {
          line: lineNumber,
          indent: line.match(/^\s*/)?.[0] || '',
          text: [trimmed, ...contentLines, LING_CPP_TEXT_BLOCK_DELIMITER].join('\n'),
          endLine: blockRange.closeLine
        };
        currentMethod.statements.push(statement);
        pushNode(createAstNode('statement', trimmed, lineNumber, line, currentMethodNode?.id, {
          value: statement.text,
          detail: '多行文本块'
        }), currentMethodNode);
      }
      return;
    }

    if (lineContainsLingCppTextBlockDelimiter(trimmed) && !matchLingCppTextBlockOpening(trimmed)) {
      diagnostics.push(createDiagnostic('error', lineNumber, line, `多行文本块标记 ${LING_CPP_TEXT_BLOCK_DELIMITER} 只能写在「变量 = ${LING_CPP_TEXT_BLOCK_DELIMITER}」行尾，或作为单独一行的结束标记。`, '一期仅支持赋值右部文本块；命令实参、返回值和类型声明初值请先赋值给变量再引用。'));
    }

    const statement = appendStatement(currentMethod, line, lineNumber);
    pushNode(createAstNode('statement', trimmed, lineNumber, line, currentMethodNode?.id || currentClassNode?.id || currentFunctionLibraryNode?.id, {
      value: statement?.text || trimmed,
      detail: currentMethod ? '方法语句' : '未识别类成员'
    }), currentMethodNode || currentClassNode || currentFunctionLibraryNode);
  });

  if (textBlockScan.unclosedOpenLine) {
    diagnostics.push(createDiagnostic(
      'error',
      textBlockScan.unclosedOpenLine,
      lines[textBlockScan.unclosedOpenLine - 1] || '',
      '多行文本块缺少结束标记。',
      `请在块末尾单独一行补写 ${LING_CPP_TEXT_BLOCK_DELIMITER}。`
    ));
  }
  textBlockScan.contentAfterCloseLines.forEach(lineNumber => {
    diagnostics.push(createDiagnostic(
      'error',
      lineNumber,
      lines[lineNumber - 1] || '',
      '多行文本块结束标记后不得再有内容。',
      `请删除 ${LING_CPP_TEXT_BLOCK_DELIMITER} 之后的内容，结束标记必须单独成行。`
    ));
  });
  [
    ...program.constants.map(constant => ({ name: constant.name, line: constant.line, initialValue: constant.initialValue })),
    ...program.globals.map(global => ({ name: global.name, line: global.line, initialValue: global.initialValue })),
    ...program.dataTypes.flatMap(dataType => dataType.fields.map(field => ({ name: `${dataType.name} 字段 ${field.name}`, line: field.line, initialValue: field.initialValue }))),
    ...program.classes.flatMap(cls => [
      ...cls.members.map(member => ({ name: member.name, line: member.line, initialValue: member.initialValue })),
      ...cls.methods.flatMap(method => (method.locals || []).map(local => ({ name: local.name, line: local.line, initialValue: local.initialValue })))
    ]),
    ...program.functionLibraries.flatMap(library =>
      library.methods.flatMap(method => (method.locals || []).map(local => ({ name: local.name, line: local.line, initialValue: local.initialValue })))
    )
  ].forEach(declaration => {
    if (!declaration.initialValue || !declaration.initialValue.includes(LING_CPP_TEXT_BLOCK_DELIMITER)) return;
    diagnostics.push(createDiagnostic(
      'error',
      declaration.line,
      lines[declaration.line - 1] || declaration.name,
      `多行文本块不能作为「${declaration.name}」的声明初值。`,
      `请先单独声明「${declaration.name}」，再在方法体内用「${declaration.name} = ${LING_CPP_TEXT_BLOCK_DELIMITER}」开始文本块赋值。`
    ));
  });

  if (currentMethod) closeCurrentMethod(lines.length);
  if (currentDataType && currentDataTypeNode) {
    currentDataType.endLine = lines.length;
    setNodeEndRange(currentDataTypeNode, lines, lines.length);
    diagnostics.push(createDiagnostic('error', currentDataType.line, lines[currentDataType.line - 1] || currentDataType.name, `数据类型 ${currentDataType.name} 缺少结束语句。`, '请在字段末尾添加 `结束数据类型`。'));
  }
  if (currentFunctionLibrary && currentFunctionLibraryNode) {
    currentFunctionLibrary.endLine = lines.length;
    setNodeEndRange(currentFunctionLibraryNode, lines, lines.length);
    diagnostics.push(createDiagnostic('error', currentFunctionLibrary.line, lines[currentFunctionLibrary.line - 1] || `功能库 ${currentFunctionLibrary.name}`, '功能库声明缺少结束语句。', '请在功能库末尾添加 `结束功能库`。'));
  }
  if (currentDllLibrary && currentDllLibraryNode) {
    currentDllLibrary.endLine = lines.length;
    setNodeEndRange(currentDllLibraryNode, lines, lines.length);
    diagnostics.push(createDiagnostic('error', currentDllLibrary.line, lines[currentDllLibrary.line - 1] || `DLL命令库 ${currentDllLibrary.name}`, 'DLL命令库 声明缺少结束语句。', '请在末尾添加 `结束DLL命令库`。'));
  }
  if (currentClass && currentClassNode) {
    currentClass.endLine = lines.length;
    setNodeEndRange(currentClassNode, lines, lines.length);
    diagnostics.push(createDiagnostic('error', currentClass.line, lines[currentClass.line - 1] || `类 ${currentClass.name}`, '类声明缺少结束语句。', '请在类末尾添加 `结束类`。'));
  }

  const declaredDataTypes = new Set<string>();
  program.dataTypes.forEach(dataType => {
    const normalized = normalizeIdentifier(dataType.name);
    if (declaredDataTypes.has(normalized)) diagnostics.push(createDiagnostic('error', dataType.line, dataType.name, `数据类型 ${dataType.name} 重复声明。`, '请为项目数据类型使用唯一名称。'));
    declaredDataTypes.add(normalized);
    const fields = new Set<string>();
    dataType.fields.forEach(field => {
      const fieldName = normalizeIdentifier(field.name);
      if (fields.has(fieldName)) diagnostics.push(createDiagnostic('error', field.line, field.name, `数据类型 ${dataType.name} 中的字段 ${field.name} 重复声明。`, '请为同一数据类型的字段使用唯一名称。'));
      fields.add(fieldName);
    });
  });

  const declaredGlobals = new Set<string>();
  program.constants.forEach(constant => {
    const normalized = normalizeIdentifier(constant.name);
    if (declaredGlobals.has(normalized)) {
      diagnostics.push(createDiagnostic('error', constant.line, lines[constant.line - 1] || constant.name, `项目常量 ${constant.name} 重复声明。`, '请为项目常量使用唯一名称。'));
    }
    declaredGlobals.add(normalized);
  });
  program.globals.forEach(global => {
    const normalized = normalizeIdentifier(global.name);
    if (declaredGlobals.has(normalized)) {
      diagnostics.push(createDiagnostic('error', global.line, lines[global.line - 1] || global.name, `项目符号 ${global.name} 与已有常量或全局变量重名。`, '请为项目常量和全局变量使用唯一名称。'));
    }
    declaredGlobals.add(normalized);
  });

  program.classes.forEach(cls => {
    // “创建完毕”事件（含“_窗口名_创建完毕”窗口 Loaded 钩子）是易语言风格的初始化入口，
    // 与 构造() 二选一即可；已有初始化入口的类不需要再提示补构造函数。
    const hasCreationCompletedEvent = cls.methods.some(method =>
      method.kind === 'event' && (method.name === '创建完毕' || method.name.endsWith('_创建完毕')));
    if (!cls.methods.some(method => method.kind === 'constructor') && !hasCreationCompletedEvent) {
      diagnostics.push(createDiagnostic('info', cls.line, `类 ${cls.name}`, `类 ${cls.name} 未声明构造函数。`, '可添加 `公开: 构造()` 初始化窗口状态。'));
    }
    cls.methods.forEach(method => {
      diagnostics.push(...validateMethodLocalDeclarations(method, lines));
      diagnostics.push(...validateLingCppControlFlow(method, lines));
      diagnostics.push(...validateLocalConstantPlacement(method, lines));
    });
  });

  const declaredLibraries = new Set<string>();
  program.functionLibraries.forEach(library => {
    const normalized = normalizeIdentifier(library.name);
    if (declaredLibraries.has(normalized)) diagnostics.push(createDiagnostic('error', library.line, library.name, `功能库 ${library.name} 重复声明。`, '一个项目中的功能库名称必须唯一。'));
    declaredLibraries.add(normalized);
    const methodNames = new Set<string>();
    library.methods.forEach(method => {
      const methodName = normalizeIdentifier(method.name);
      if (methodNames.has(methodName)) diagnostics.push(createDiagnostic('error', method.line, method.name, `功能库 ${library.name} 中的功能 ${method.name} 重复声明。`, '首版功能库不支持重载，请使用唯一功能名。'));
      methodNames.add(methodName);
      diagnostics.push(...validateMethodLocalDeclarations(method, lines));
      diagnostics.push(...validateLingCppControlFlow(method, lines));
      diagnostics.push(...validateLocalConstantPlacement(method, lines));
    });
  });

  const symbolIndex = buildLingCppSymbolIndex(astNodes);
  const ast: LingCppAst = {
    version: 1,
    source,
    range: createDocumentRange(lines),
    root: rootNode,
    nodes: astNodes,
    symbolIndex,
    diagnostics,
    program
  };

  return { program, ast, symbolIndex, diagnostics };
}

export function getLingCppDiagnostics(source: string): LingCppDiagnostic[] {
  return parseLingCpp(source).diagnostics;
}

export function findLingCppMethod(program: LingCppProgram, handlerName: string): LingCppMethod | undefined {
  const normalized = normalizeIdentifier(handlerName);
  for (const cls of program.classes) {
    const direct = cls.methods.find(method => normalizeIdentifier(method.name) === normalized);
    if (direct) return direct;
    const withoutPrefix = cls.methods.find(method => normalizeIdentifier(`${cls.name}_${method.name}`) === normalized);
    if (withoutPrefix) return withoutPrefix;
  }
  return undefined;
}

export function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^_+/, '').replace(/\s+/g, '');
}

function validateLingCppControlFlow(method: LingCppMethod, sourceLines: string[]): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  const stack: Array<{
    control: LingCppControlFlowLine;
    line: number;
    hasElse?: boolean;
    hasDefault?: boolean;
    hasCatch?: boolean;
    hasFinally?: boolean;
  }> = [];
  const report = (statement: LingCppStatement, message: string, suggestion: string, level: LingCppDiagnostic['level'] = 'error') => {
    diagnostics.push(createDiagnostic(level, statement.line, sourceLines[statement.line - 1] || statement.text, message, suggestion));
  };

  method.statements.forEach(statement => {
    const control = parseLingCppControlFlowLine(statement.text);
    if (!control) return;
    const top = stack.at(-1);

    if (control.role === 'start' && control.family) {
      if ((control.family === 'if' || control.loopKind === 'while') && !control.expression) {
        report(statement, `${control.keyword} 缺少条件表达式。`, `请写成 ${control.keyword} (条件)。`);
      }
      if (control.family === 'select' && !control.expression) {
        report(statement, `${control.keyword} 缺少选择表达式。`, '请写成 选择 (整数表达式)。');
      }
      const expectedArguments = control.loopKind === 'count' ? [1, 2]
        : control.loopKind === 'range' ? [4]
          : control.loopKind === 'foreach' ? [2]
            : undefined;
      if (expectedArguments && !expectedArguments.includes(control.arguments.length)) {
        report(statement, `${control.keyword} 的参数数量不正确。`,
          control.loopKind === 'count'
            ? '请写成 计次循环首 (次数, [计次变量])。'
            : control.loopKind === 'range'
              ? '请写成 变量循环首 (起始值, 目标值, 递增值, 循环变量)。'
              : '请写成 枚举循环首 (集合, 当前项)。');
      }
      stack.push({ control, line: statement.line });
      return;
    }

    if (control.role === 'branch' && control.family) {
      if (!top || top.control.family !== control.family) {
        report(statement, `${control.keyword} 没有对应的${control.family === 'if' ? '如果' : control.family === 'select' ? '选择' : '尝试'}结构。`, '请把分支放入匹配的控制结构内。');
        return;
      }
      if (control.branchKind === 'elseif' && top.hasElse) report(statement, '否则之后不能再写否则如果。', '请把否则如果移动到否则之前。');
      if (control.branchKind === 'else') {
        if (top.hasElse) report(statement, '同一个如果结构只能有一个否则分支。', '请合并或删除重复的否则分支。');
        top.hasElse = true;
      }
      if (control.branchKind === 'case' && control.arguments.length === 0) report(statement, '分支缺少匹配值。', '请写成 分支 (值)。');
      if (control.branchKind === 'default') {
        if (top.hasDefault) report(statement, '同一个选择结构只能有一个默认分支。', '请合并或删除重复的默认分支。');
        top.hasDefault = true;
      }
      if (control.branchKind === 'catch') {
        if (top.hasFinally) report(statement, '最终之后不能再写捕获分支。', '请把捕获移动到最终之前。');
        top.hasCatch = true;
      }
      if (control.branchKind === 'finally') {
        if (top.hasFinally) report(statement, '同一个尝试结构只能有一个最终分支。', '请合并或删除重复的最终分支。');
        top.hasFinally = true;
      }
      return;
    }

    if (control.role === 'end' && control.family) {
      if (!top || top.control.family !== control.family) {
        report(statement, `多余或错位的 ${control.keyword}。`, '请检查控制结构的嵌套顺序。');
        return;
      }
      if (control.family === 'try' && !top.hasCatch && !top.hasFinally) {
        report(statement, '尝试结构至少需要一个捕获或最终分支。', '请在尝试结束前添加捕获或最终。');
      }
      stack.pop();
      return;
    }

    if ((control.role === 'break' || control.role === 'continue') && !stack.some(entry => entry.control.family === 'loop')) {
      report(statement, `${control.keyword} 只能在循环内部使用。`, '请把该命令移动到循环体内。');
    }
    if (control.role === 'throw' && !control.expression) {
      report(statement, '抛出命令缺少错误信息。', '请写成 抛出("错误信息")。');
    }
  });

  stack.forEach(entry => {
    diagnostics.push(createDiagnostic(
      'error',
      entry.line,
      sourceLines[entry.line - 1] || entry.control.keyword,
      `${entry.control.keyword} 结构缺少结束语句。`,
      `请添加 ${lingCppControlFlowEndLabel(entry.control)}。`
    ));
  });
  return diagnostics;
}

function validateMethodLocalDeclarations(method: LingCppMethod, sourceLines: string[]): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  const declaredNames = new Set(method.parameters.map(parameter => normalizeIdentifier(parameter.name)));
  (method.locals || []).forEach(local => {
    const normalized = normalizeIdentifier(local.name);
    if (declaredNames.has(normalized)) {
      const label = local.isConstant ? '局部常量' : '局部变量';
      diagnostics.push(createDiagnostic('error', local.line, sourceLines[local.line - 1] || local.name, `${label} ${local.name} 与同一子程序中的参数或局部声明重名。`, '请为每个参数、局部变量和局部常量使用唯一名称。'));
    }
    declaredNames.add(normalized);
  });
  return diagnostics;
}

function validateLocalConstantPlacement(method: LingCppMethod, sourceLines: string[]): LingCppDiagnostic[] {
  const diagnostics: LingCppDiagnostic[] = [];
  const entries = [
    ...method.statements.map(statement => ({ kind: 'statement' as const, line: statement.line, statement })),
    ...(method.locals || []).filter(local => local.isConstant).map(local => ({ kind: 'constant' as const, line: local.line, local }))
  ].sort((left, right) => left.line - right.line);
  const stack: LingCppControlFlowLine[] = [];

  entries.forEach(entry => {
    if (entry.kind === 'constant') {
      if (stack.length > 0) {
        diagnostics.push(createDiagnostic(
          'error',
          entry.local.line,
          sourceLines[entry.local.line - 1] || entry.local.name,
          `局部常量 ${entry.local.name} 不能声明在如果、循环、选择或尝试等控制块内部。`,
          '请把局部常量移动到当前控制块之前或结束之后。'
        ));
      }
      return;
    }

    const control = parseLingCppControlFlowLine(entry.statement.text);
    if (!control) return;
    if (control.role === 'end' && control.family) {
      if (stack.at(-1)?.family === control.family) stack.pop();
      return;
    }
    if (control.role === 'start' && control.family) stack.push(control);
  });
  return diagnostics;
}

export function buildLingCppSymbolIndex(nodes: LingCppAstNode[]): LingCppSymbolIndex {
  const index: LingCppSymbolIndex = {
    declarations: [],
    classes: [],
    constants: [],
    globals: [],
    dataTypes: [],
    dataFields: [],
    functionLibraries: [],
    members: [],
    locals: [],
    methods: [],
    events: [],
    byName: {},
    byLine: {}
  };

  nodes.forEach(node => {
    if (node.kind === 'package' || node.kind === 'use' || node.kind === 'constant' || node.kind === 'global' || node.kind === 'data-type' || node.kind === 'data-field' || node.kind === 'function-library' || node.kind === 'designer') index.declarations.push(node);
    if (node.kind === 'class') index.classes.push(node);
    if (node.kind === 'constant') index.constants.push(node);
    if (node.kind === 'global') index.globals.push(node);
    if (node.kind === 'data-type') index.dataTypes.push(node);
    if (node.kind === 'data-field') index.dataFields.push(node);
    if (node.kind === 'function-library') index.functionLibraries.push(node);
    if (node.kind === 'member') index.members.push(node);
    if (node.kind === 'local') index.locals.push(node);
    if (node.kind === 'constructor' || node.kind === 'destructor' || node.kind === 'method') index.methods.push(node);
    if (node.kind === 'event') index.events.push(node);
    const normalizedName = normalizeIdentifier(node.name);
    if (normalizedName) {
      index.byName[normalizedName] = [...(index.byName[normalizedName] || []), node];
    }
    index.byLine[node.range.startLine] = [...(index.byLine[node.range.startLine] || []), node];
  });

  return index;
}

function appendStatement(method: LingCppMethod | null, line: string, lineNumber: number): LingCppStatement | undefined {
  if (!method) return undefined;
  const indent = line.match(/^\s*/)?.[0] || '';
  const text = line.slice(indent.length);
  const statement: LingCppStatement = { line: lineNumber, indent, text };
  method.statements.push(statement);
  return statement;
}

function parseParameters(raw: string, notes: Map<string, string> = new Map()): LingCppParameter[] {
  return splitParameterParts(raw)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const { definition, defaultValue } = splitParameterDefault(part);
      const [type, ...nameParts] = definition.split(/\s+/u).filter(Boolean);
      const name = nameParts.join('');
      const parameter: LingCppParameter = {
        type: name ? type : '对象',
        name: name || type
      };
      if (defaultValue) parameter.defaultValue = defaultValue;
      const note = notes.get(normalizeIdentifier(parameter.name));
      if (note !== undefined) parameter.note = note;
      return parameter;
    });
}

function splitParameterParts(raw: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;

  for (const char of raw) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
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
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}

function splitParameterDefault(part: string): { definition: string; defaultValue?: string } {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < part.length; index += 1) {
    const char = part[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === '=' && depth === 0) {
      const definition = part.slice(0, index).trim();
      const defaultValue = part.slice(index + 1).trim();
      return { definition, defaultValue: defaultValue || undefined };
    }
  }

  return { definition: part.trim() };
}

function isMethodDeclaration(trimmed: string, prefix: string, declaredName?: string): boolean {
  if (prefix === '构造' || prefix === '析构') return true;
  // 如果、循环、返回等关键字可能后接"名称(...)"形态的条件或调用（如 `如果 支持加密()`），
  // 它们不能成为子程序返回类型；只有 事件/空/静态 既是关键字又是合法声明前缀。
  if (LING_CPP_KEYWORDS.includes(prefix) && prefix !== '事件' && prefix !== '空' && prefix !== '静态') return false;
  if (!declaredName?.trim()) return false;
  const withoutStatic = trimmed.replace(/^静态\s+/u, '');
  return new RegExp(`^${escapeRegexLiteral(prefix)}\\s+`, 'u').test(withoutStatic);
}

function normalizeMethodName(prefix: string, declaredName: string | undefined, className: string): string {
  if (prefix === '构造') return className;
  if (prefix === '析构') return `销毁_${className}`;
  return declaredName || '未命名方法';
}

function methodReturnType(prefix: string): string {
  if (prefix === '事件' || prefix === '构造' || prefix === '析构') return '空';
  return prefix;
}

function methodKind(prefix: string): LingCppMethod['kind'] {
  if (prefix === '构造') return 'constructor';
  if (prefix === '析构') return 'destructor';
  if (prefix === '事件') return 'event';
  return 'method';
}

function createDiagnostic(
  level: LingCppDiagnostic['level'],
  line: number,
  codeSnippet: string,
  message: string,
  suggestion: string
): LingCppDiagnostic {
  return {
    id: `lingcpp-${level}-${line}-${message}`,
    line,
    level,
    message,
    codeSnippet,
    suggestion
  };
}

function createAstNode(
  kind: LingCppAstNodeKind,
  name: string,
  lineNumber: number,
  lineText: string,
  parentId?: string,
  overrides: Partial<Omit<LingCppAstNode, 'id' | 'kind' | 'name' | 'children'>> = {}
): LingCppAstNode {
  const normalizedName = normalizeIdentifier(name) || kind;
  return {
    id: `lingcpp-ast-${kind}-${lineNumber}-${normalizedName}`,
    kind,
    name,
    range: overrides.range || createLineRange(lineNumber, lineText),
    parentId,
    detail: overrides.detail,
    value: overrides.value,
    access: overrides.access,
    type: overrides.type,
    returnType: overrides.returnType,
    isStatic: overrides.isStatic,
    isArray: overrides.isArray,
    isConstant: overrides.isConstant,
    children: []
  };
}

function createLineRange(lineNumber: number, lineText: string): LingCppSourceRange {
  const trimmed = lineText.trim();
  const startColumn = trimmed ? lineText.indexOf(trimmed) + 1 : 1;
  return {
    startLine: lineNumber,
    startColumn,
    endLine: lineNumber,
    endColumn: lineText.length + 1
  };
}

function createDocumentRange(lines: string[]): LingCppSourceRange {
  const safeLineCount = Math.max(1, lines.length);
  return {
    startLine: 1,
    startColumn: 1,
    endLine: safeLineCount,
    endColumn: (lines[safeLineCount - 1] || '').length + 1
  };
}

function setNodeEndRange(node: LingCppAstNode, lines: string[], endLine: number): void {
  const safeLine = Math.max(node.range.startLine, Math.min(Math.max(1, lines.length), endLine));
  node.range.endLine = safeLine;
  node.range.endColumn = (lines[safeLine - 1] || '').length + 1;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
