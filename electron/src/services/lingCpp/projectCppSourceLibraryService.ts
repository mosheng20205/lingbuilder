import {
  LingCppCppSourceLibrary,
  LingCppCppSourceCommand,
  LingCppCppClass,
  LingCppCppClassMethod,
  LingCppCppSourceStruct,
  LingCppCppSourceStructField,
  LingCppParameter,
  LingCppDiagnostic
} from './types';
import { parseLingCpp } from './parser';
import { InstalledModule, LingBuilderModuleManifest, ModuleBindingValueType } from '../modules/types';

/** 项目 C++ 源码库声明专用源码文件（与 项目DLL命令.lcpp 同构）。 */
export const PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME = '项目C++源码库.lcpp';

export const PROJECT_CPP_SOURCE_MODULE_ID = 'lingbuilder.project.cppsrc';

export const EMPTY_PROJECT_CPP_SOURCE_LIBRARY_SOURCE = [
  '包 项目C++源码库',
  '',
  '// 本文件用于把别人写好的 C++ 函数（.h/.cpp 源码）声明为中文命令：源码直接并入生成的工程一起编译，',
  '// 同编译器同运行库，没有 DLL 边界，也不需要先编译出 DLL。',
  '// 用法：',
  '//   C++源码库 数学库',
  '//     源码 = cpp/mymath.cpp',
  '//     头文件 = cpp/mymath.h        ← 可选；不写则按声明自动生成期望签名前置声明',
  '//     整数型 加法计算(整数型 a, 整数型 b) = add',
  '//   结束C++源码库',
  '// 「= 函数名」是源码里的全局 C++ 函数名（英文标识符），命令名用中文。',
  '// 类型支持：整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、文本型、字节集、指针整数。',
  '// 文本型参数在 C++ 侧写 const wchar_t*（或 std::wstring 值参）；字节集写 const std::vector<unsigned char>&。',
  '// 传址参数在 C++ 侧写指针（如 int*），调用端自动传 &变量。',
  '// 回调参数（传函数）：`处理器 进度回调(整数型 已下载, 整数型 总大小)`，C++ 侧收 std::function<void(int, int)>，',
  '//  .lcpp 调用时传 &子程序名；回调线程与调用线程一致，不要在回调外长期保存。',
  '// 类（句柄化）：`类 计数器 = Counter` + `方法 计数器 创建(整数型 初始值)` / `方法 空 销毁()` /',
  '//  `方法 整数型 取当前() = get_value` + `结束类`；合成 计数器_创建/销毁/取当前 命令，句柄=长整数型；类必须配「头文件 =」。'
].join('\n');

export function isProjectCppSourceLibraryFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/gu, '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  return fileName.toLocaleLowerCase() === PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME.toLocaleLowerCase();
}

/**
 * C++ 源码库类型映射：同一工程直接编译，没有 DLL 的 ABI 限制，但生成调用点与期望签名
 * 必须一致，因此仍然维护一张显式白名单；表外类型给明确中文诊断，不静默生成错误结果。
 * 文本型 → const wchar_t*（C++ 侧写 std::wstring 值参可隐式转换）；字节集 → const std::vector<unsigned char>&。
 */
const CPP_SOURCE_TYPE_MAP: Record<string, { abi: ModuleBindingValueType; cpp: string; returnCpp?: string }> = {
  '空': { abi: 'void', cpp: 'void' },
  '整数型': { abi: 'int', cpp: 'int' },
  '整数': { abi: 'int', cpp: 'int' },
  '长整数型': { abi: 'longLong', cpp: 'long long' },
  '长整数': { abi: 'longLong', cpp: 'long long' },
  '小数型': { abi: 'double', cpp: 'double' },
  '小数': { abi: 'double', cpp: 'double' },
  '单精度小数型': { abi: 'float', cpp: 'float' },
  '单精度小数': { abi: 'float', cpp: 'float' },
  '逻辑型': { abi: 'bool', cpp: 'bool' },
  '逻辑': { abi: 'bool', cpp: 'bool' },
  '字节型': { abi: 'int', cpp: 'unsigned char' },
  '字节': { abi: 'int', cpp: 'unsigned char' },
  '文本型': { abi: 'wideString', cpp: 'const wchar_t*' },
  '文本': { abi: 'wideString', cpp: 'const wchar_t*' },
  // 字节集：参数位按 const 引用传（零拷贝）；返回位必须按值——C++ 按值返回的函数与
  // 「const& 返回」声明是两个不同的修饰名，混用会 LNK2001（真机 smoke 实抓）。
  '字节集': { abi: 'bytes', cpp: 'const std::vector<unsigned char>&', returnCpp: 'std::vector<unsigned char>' },
  // 指针尺寸整数（uintptr_t）：承接 C++ 侧的 HANDLE/SIZE_T/指针宽度返回值，调用端按长整数型交互。
  '指针整数': { abi: 'longLong', cpp: 'uintptr_t' }
};

/** 数组元素类型（v3）：`类型[]` 一维数组；文本型元素用 std::wstring（数组不能存裸指针）。 */
const CPP_SOURCE_ARRAY_ELEMENT_TYPE_MAP: Record<string, string> = {
  '整数型': 'int',
  '整数': 'int',
  '长整数型': 'long long',
  '长整数': 'long long',
  '小数型': 'double',
  '小数': 'double',
  '单精度小数型': 'float',
  '单精度小数': 'float',
  '逻辑型': 'bool',
  '逻辑': 'bool',
  '字节型': 'unsigned char',
  '字节': 'unsigned char',
  '文本型': 'std::wstring',
  '文本': 'std::wstring',
  '指针整数': 'uintptr_t'
};

/** `类型[]` → 数组元素 C++ 类型；非数组或元素不支持返回 undefined。 */
export function resolveCppArrayElementType(chineseType: string): string | undefined {
  const match = chineseType.trim().match(/^(.+?)\s*(?:\[\]|［］)$/u);
  if (!match) return undefined;
  return CPP_SOURCE_ARRAY_ELEMENT_TYPE_MAP[match[1].trim()];
}

export function resolveCppSourceType(chineseType: string): { abi: ModuleBindingValueType; cpp: string; returnCpp?: string } | undefined {
  // `类型[]` 一维数组（v3）：参数位 const 引用、返回位按值；abi 走 array（生成调用点把
  // .lcpp 数组变量原样直译为 std::vector，与字节集同机制）。
  const arrayElement = resolveCppArrayElementType(chineseType);
  if (arrayElement) {
    return { abi: 'array', cpp: `const std::vector<${arrayElement}>&`, returnCpp: `std::vector<${arrayElement}>` };
  }
  return CPP_SOURCE_TYPE_MAP[chineseType.trim()];
}

/** 返回值位置的 C++ 类型：字节集/数组按值返回，其余与参数位一致。 */
export function resolveCppSourceReturnCppType(chineseType: string): string | undefined {
  const mapped = resolveCppSourceType(chineseType);
  if (!mapped) return undefined;
  return mapped.returnCpp || mapped.cpp;
}

/** 传址形参类型（基类型指针）；文本/字节集/数组/空/处理器不支持传址，返回 undefined。 */
export function resolveCppSourcePointerType(chineseType: string): string | undefined {
  if (resolveCppArrayElementType(chineseType)) return undefined;
  const mapped = resolveCppSourceType(chineseType);
  if (!mapped || mapped.cpp === 'void' || mapped.abi === 'wideString' || mapped.abi === 'bytes' || mapped.abi === 'array') return undefined;
  return `${mapped.cpp}*`;
}

/**
 * 结构体字段类型（v6）：标量与 DLL 字段表同形；文本型 → std::wstring——同工程编译没有
 * DLL 的定长/布局约束，这是与 DLL 结构体管线的本质区别。数组/嵌套结构体/字节集字段不支持。
 */
export const CPP_SOURCE_STRUCT_FIELD_TYPE_MAP: Record<string, string> = {
  '整数型': 'int',
  '整数': 'int',
  '长整数型': 'long long',
  '长整数': 'long long',
  '小数型': 'double',
  '小数': 'double',
  '单精度小数型': 'float',
  '单精度小数': 'float',
  '逻辑型': 'bool',
  '逻辑': 'bool',
  '字节型': 'unsigned char',
  '字节': 'unsigned char',
  '指针整数': 'uintptr_t',
  '文本型': 'std::wstring',
  '文本': 'std::wstring'
};

/** 结构体字段的 C++ 成员类型（文本型 → std::wstring）；不支持的字段类型返回 undefined。 */
export function resolveCppSourceStructFieldCppType(chineseType: string): string | undefined {
  return CPP_SOURCE_STRUCT_FIELD_TYPE_MAP[chineseType.trim()];
}

/** 字段 C++ 成员类型 → 合成取/置命令的 binding abi（与参数位白名单的 abi 同源）。 */
export function resolveCppSourceStructFieldAbi(chineseType: string): ModuleBindingValueType {
  const mapped = resolveCppSourceType(chineseType.trim());
  return (mapped?.abi || 'raw') as ModuleBindingValueType;
}

/** 字段 → 取/置命令的调用端中文类型（指针整数按长整数型交互，与 DLL 字段口径一致）。 */
export function resolveCppSourceStructFieldCallerType(chineseType: string): string {
  return chineseType.trim() === '指针整数' ? '长整数型' : chineseType.trim();
}

/** 库内结构体按中文名查找（v6：结构体为库内作用域，与 DLL 结构体同范式）。 */
export function resolveCppSourceLibraryStruct(library: LingCppCppSourceLibrary, typeName: string): LingCppCppSourceStruct | undefined {
  return library.structs.find(item => item.name === typeName);
}

/** 命令参数/返回的结构体感知类型解析结果。 */
export interface CppSourceResolvedCommandType {
  abi: ModuleBindingValueType;
  /** 参数位 C++ 类型（结构体 → `const Struct&`）。 */
  cpp: string;
  /** 返回位 C++ 类型（结构体按值）。 */
  returnCpp?: string;
  isStruct: boolean;
  structCppName?: string;
}

/**
 * 命令参数/返回类型解析（v6 结构体感知）：基础类型走既有白名单；命中本库结构体时
 * abi=longLong（.lcpp 侧以句柄持有）、参数位 `const Struct&`、返回位按值 `Struct`。
 * 结构体为库内作用域：其它库的同名类型不解析（诊断给出定向中文提示）。
 */
export function resolveCppSourceCommandType(chineseType: string, library: LingCppCppSourceLibrary): CppSourceResolvedCommandType | undefined {
  const structItem = resolveCppSourceLibraryStruct(library, chineseType.trim());
  if (structItem) {
    return {
      abi: 'longLong',
      cpp: `const ${structItem.cppName}&`,
      returnCpp: structItem.cppName,
      isStruct: true,
      structCppName: structItem.cppName
    };
  }
  const mapped = resolveCppSourceType(chineseType);
  return mapped ? { ...mapped, isStruct: false } : undefined;
}

/** C++ 函数名必须是 ASCII C++ 标识符（生成调用点与链接诊断都按它走）。 */
export function isUsableCppSourceSymbolName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

/** 从项目源码集合中识别声明文件并合成虚拟模块；无声明文件时返回 undefined。 */
export function createProjectCppSourceDeclarationModuleFromSources(
  sources: Array<{ filePath: string; sourceCode: string }>,
  projectId: string
): InstalledModule | undefined {
  const source = sources.find(item => isProjectCppSourceLibraryFilePath(item.filePath));
  if (!source || !source.sourceCode.trim()) return undefined;
  const parsed = parseLingCpp(source.sourceCode);
  return createProjectCppSourceDeclarationModule(parsed.program.cppLibraries || [], projectId);
}

/**
 * 声明文件守卫诊断：类型白名单、`= C++函数名` 必填且为 ASCII 标识符、命令/C++ 名跨库唯一、
 * 缺「源码 =」；路径形状与缺结束语句已由解析器上抛。
 */
export function getProjectCppSourceLibraryDiagnostics(sourceCode: string): LingCppDiagnostic[] {
  const parsed = parseLingCpp(sourceCode);
  const diagnostics: LingCppDiagnostic[] = [];
  const sourceLines = sourceCode.split(/\r?\n/);
  let diagnosticSequence = 0;
  const push = (line: number, message: string, suggestion: string) => {
    diagnosticSequence += 1;
    diagnostics.push({
      id: `project-cpp-source-${line}-${diagnosticSequence}`,
      line,
      level: 'error',
      message,
      codeSnippet: (sourceLines[line - 1] || '').trim(),
      suggestion
    });
  };
  const supportedTypes = '整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、文本型、字节集、指针整数、类型[]（一维数组）';
  const seenCommandNames = new Map<string, string>();
  const seenCppNames = new Map<string, string>();
  const seenClassNames = new Map<string, string>();
  const seenStructNames = new Map<string, string>();
  // 文件级结构体注册表：区分「类型不支持」与「结构体在别的库（库内作用域）」两类提示。
  const structOwnerByName = new Map<string, string>();
  parsed.program.cppLibraries.forEach(library => {
    library.structs.forEach(structItem => structOwnerByName.set(structItem.name, library.name));
  });
  // `library` 传入时为函数命令上下文（v6：参数可引用本库结构体，句柄语义）；类方法上下文不传——
  // 类方法在调用点内联展开，结构体解引用需要声明头适配器，暂不支持。
  const checkParameterList = (ownerLabel: string, line: number, parameters: LingCppParameter[], library?: LingCppCppSourceLibrary) => {
    parameters.forEach(parameter => {
      if (parameter.type === '处理器') {
        const signature = parameter.handlerSignatureParameters || [];
        if (signature.length === 0) {
          push(line, `${ownerLabel} 的处理器参数「${parameter.name}」缺少内联签名。`, '请写成 `处理器 名(类型 参数, ...)`，例如 `处理器 进度回调(整数型 已下载)`；C++ 侧收 std::function<...>。');
        }
        if (parameter.handlerReturnType && !resolveCppSourceReturnCppType(parameter.handlerReturnType)) {
          push(line, `${ownerLabel} 的处理器参数「${parameter.name}」回传类型「${parameter.handlerReturnType}」不支持。`, `仅支持：${supportedTypes}；缺省返回为空。`);
        }
        if (parameter.handlerMarshalUiThread && parameter.handlerReturnType) {
          push(line, `${ownerLabel} 的处理器参数「${parameter.name}」声明了「界面线程」封送且带非空返回。`, '封送是异步投递（fire-and-forget），无法同步拿回返回值；请去掉 `回传 类型` 或去掉 `界面线程`。');
        }
        signature.forEach(signatureParameter => {
          if (signatureParameter.type === '处理器') {
            push(line, `${ownerLabel} 的回调签名不允许嵌套处理器参数「${signatureParameter.name}」。`, '回调签名只接受基础类型参数；回调返回固定为空（v2 边界）。');
            return;
          }
          if (structOwnerByName.has(signatureParameter.type.trim())) {
            push(line, `${ownerLabel} 的回调签名参数「${signatureParameter.name}」类型「${signatureParameter.type}」是结构体。`, '回调签名暂不支持结构体参数；请拆成标量参数逐个传递。');
            return;
          }
          if (!resolveCppSourceType(signatureParameter.type)) {
            push(line, `${ownerLabel} 的回调签名参数「${signatureParameter.name}」类型「${signatureParameter.type}」不支持。`, `仅支持：${supportedTypes}、类型[]（一维数组）。`);
            return;
          }
          if (signatureParameter.byRef) {
            push(line, `${ownerLabel} 的回调签名参数「${signatureParameter.name}」不支持传址。`, '回调形参按值传递，C++ 侧写 std::function<void(类型, ...) >。');
          }
        });
        return;
      }
      if (library && resolveCppSourceCommandType(parameter.type, library)?.isStruct) {
        if (parameter.byRef) {
          push(line, `${ownerLabel} 的结构体参数「${parameter.name}」不支持传址。`, '结构体参数以句柄传入（生成端自动解引用为 const Struct&），无需传址。');
        }
        return;
      }
      if (!resolveCppSourceType(parameter.type)) {
        const structOwner = structOwnerByName.get(parameter.type.trim());
        if (structOwner) {
          if (library) {
            push(line, `${ownerLabel} 的参数「${parameter.name}」类型「${parameter.type}」是「${structOwner}」库的结构体。`, '结构体为库内作用域：请把该命令移进「' + structOwner + '」库，或把结构体声明到当前库。');
          } else {
            push(line, `${ownerLabel} 的参数「${parameter.name}」类型「${parameter.type}」是结构体。`, '类方法暂不支持结构体参数（调用点内联展开无法解引用句柄）；请用函数命令传递结构体。');
          }
          return;
        }
        push(line, `${ownerLabel} 的参数「${parameter.name}」类型「${parameter.type}」不支持。`, `仅支持：${supportedTypes}、处理器（回调）、类型[]（一维数组，如 整数型[]）${library ? '、本库结构体名（句柄语义）' : ''}。`);
        return;
      }
      if (parameter.byRef && resolveCppSourcePointerType(parameter.type) === undefined) {
        push(line, `${ownerLabel} 的传址参数「${parameter.name}」类型「${parameter.type}」不支持传址。`, '仅整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、指针整数支持传址；文本型/字节集请改为返回值。');
      }
    });
  };
  parsed.program.cppLibraries.forEach(library => {
    if (library.commands.length === 0 && library.classes.length === 0 && library.structs.length === 0) return;
    if (library.commands.length > 0 && library.sourceFiles.length === 0) {
      push(library.line, `C++源码库 ${library.name} 未声明「源码 =」。`, '请添加一行 `源码 = cpp/xxx.cpp` 指向参与编译的 C++ 源码文件（纯类库方法全内联在头文件里时可不带源码）。');
    }
    library.commands.forEach(command => {
      const commandOwner = seenCommandNames.get(command.name);
      if (commandOwner) {
        push(command.line, `C++ 源码命令 ${command.name} 与「${commandOwner}」库中的命令重名。`, '命令名在整个声明文件内必须唯一（合成模块按命令名注册补全与调用）。');
      } else {
        seenCommandNames.set(command.name, library.name);
        const conflictOwner = seenClassNames.get(command.name) || seenStructNames.get(command.name);
        if (conflictOwner) {
          const conflictKind = seenClassNames.has(command.name) ? '类' : '结构体';
          push(command.line, `C++ 源码命令 ${command.name} 与「${conflictOwner}」库的${conflictKind}重名。`, '声明文件内命令/类/结构体名必须互不相同。');
        }
      }
      if (!command.cppName) {
        push(command.line, `C++ 源码命令 ${command.name} 缺少 C++ 函数名。`, `请写成「${command.returnType} ${command.name}(...${')'} = 函数名」，函数名是源码里的全局 C++ 函数（英文标识符），例如 = add。`);
        return;
      }
      if (!isUsableCppSourceSymbolName(command.cppName)) {
        push(command.line, `C++ 源码命令 ${command.name} 的函数名「${command.cppName}」不是合法的英文 C++ 标识符。`, '函数名只能用英文字母、数字、下划线且不以数字开头；中文请写在命令名上。');
        return;
      }
      const cppOwner = seenCppNames.get(command.cppName);
      if (cppOwner) {
        push(command.line, `C++ 函数名 ${command.cppName} 被「${cppOwner}」库的命令占用。`, '两条命令不能指向同一个 C++ 函数；请各写一条声明或合并命令。');
      } else {
        seenCppNames.set(command.cppName, library.name);
      }
      const returnType = resolveCppSourceCommandType(command.returnType, library);
      if (!returnType) {
        push(command.line, `C++ 源码命令 ${command.name} 的返回类型「${command.returnType}」不支持。`, `仅支持：${supportedTypes}、本库结构体名（按句柄返回）。`);
      }
      checkParameterList(`C++ 源码命令 ${command.name}`, command.line, command.parameters, library);
    });
    // 类块：类名/C++类名、头文件来源、创建/销毁保留名语义、方法签名。
    library.classes.forEach(classItem => {
      if (!isUsableCppSourceSymbolName(classItem.cppName)) {
        push(classItem.line, `类 ${classItem.name} 的 C++ 类名「${classItem.cppName}」不是合法的英文 C++ 标识符。`, '请写成 `类 中文名 = 英文类名`，例如 = Counter。');
      }
      const classOwner = seenClassNames.get(classItem.name);
      if (classOwner) {
        push(classItem.line, `类 ${classItem.name} 与「${classOwner}」库中的类重名。`, '类名在整个声明文件内必须唯一（合成的 创建/销毁/方法 命令依赖它命名）。');
      } else {
        seenClassNames.set(classItem.name, library.name);
        const conflictOwner = seenCommandNames.get(classItem.name) || seenStructNames.get(classItem.name);
        if (conflictOwner) {
          const conflictKind = seenCommandNames.has(classItem.name) ? '命令' : '结构体';
          push(classItem.line, `类 ${classItem.name} 与「${conflictOwner}」库的${conflictKind}重名。`, '声明文件内命令/类/结构体名必须互不相同。');
        }
      }
      if (library.headerFiles.length === 0) {
        push(classItem.line, `类 ${classItem.name} 所在库未声明「头文件 =」。`, '类定义必须来自头文件（生成代码要 new/delete 完整类型），请在库内添加 `头文件 = cpp/xxx.h`。');
      }
      if (library.namespaceName) {
        diagnosticSequence += 1;
        diagnostics.push({
          id: `project-cpp-source-${classItem.line}-${diagnosticSequence}`,
          line: classItem.line,
          level: 'warning',
          message: `类 ${classItem.name} 暂不支持命名空间，「命名空间 = ${library.namespaceName}」只作用于函数命令。`,
          codeSnippet: classItem.name,
          suggestion: '类定义来自头文件且类名按原样解析；如需命名空间内的类，请在头文件里 using 后把 C++ 类名写成带限定的形式暂不支持——请把类放在独立的无命名空间库。'
        });
      }
      const seenMethods = new Set<string>();
      classItem.methods.forEach(method => {
        if (seenMethods.has(method.name)) {
          push(method.line, `类 ${classItem.name} 的方法 ${method.name} 重复声明。`, '方法名在本类内必须唯一。');
          return;
        }
        seenMethods.add(method.name);
        if (method.name === '创建') {
          if (method.returnType !== classItem.name) {
            push(method.line, `类 ${classItem.name} 的「创建」方法返回类型必须是本类名。`, `请写成 \`方法 ${classItem.name} 创建(参数...)\`。`);
          }
        } else if (method.name === '销毁') {
          if (method.returnType !== '空') {
            push(method.line, `类 ${classItem.name} 的「销毁」方法返回类型必须是空。`, '销毁对应 delete，没有返回值。');
          }
          if (method.parameters.length > 0) {
            push(method.line, `类 ${classItem.name} 的「销毁」方法不能声明参数。`, '销毁只收句柄（自动生成），请删除参数表。');
          }
        } else {
          if (!method.cppName) {
            push(method.line, `类 ${classItem.name} 的方法 ${method.name} 缺少 C++ 方法名。`, `请写成 \`方法 ${method.returnType} ${method.name}(...) = 方法名\`。`);
          } else if (!isUsableCppSourceSymbolName(method.cppName)) {
            push(method.line, `类 ${classItem.name} 的方法 ${method.name} 的 C++ 方法名「${method.cppName}」不是合法的英文 C++ 标识符。`, '方法名只能用英文字母、数字、下划线且不以数字开头。');
          }
          const methodReturn = resolveCppSourceType(method.returnType);
          if (!methodReturn) {
            if (structOwnerByName.has(method.returnType.trim())) {
              push(method.line, `类 ${classItem.name} 的方法 ${method.name} 返回类型「${method.returnType}」是结构体。`, '类方法暂不支持返回结构体（调用点内联展开无法包裹句柄）；请用函数命令返回结构体。');
            } else {
              push(method.line, `类 ${classItem.name} 的方法 ${method.name} 返回类型「${method.returnType}」不支持。`, `仅支持：${supportedTypes}；返回类对象本身暂不支持。`);
            }
          }
        }
        checkParameterList(`类 ${classItem.name} 的方法 ${method.name}`, method.line, method.parameters);
      });
    });
    // 结构体块（v6）：C++ 类型名、跨类名冲突、字段类型白名单、命名空间提示。
    library.structs.forEach(structItem => {
      const structOwner = seenStructNames.get(structItem.name);
      if (structOwner) {
        push(structItem.line, `结构体 ${structItem.name} 与「${structOwner}」库中的结构体重名。`, '结构体名在整个声明文件内必须唯一（访问器命令按 结构名_字段名 合成）。');
      } else {
        seenStructNames.set(structItem.name, library.name);
      }
      if (!isUsableCppSourceSymbolName(structItem.cppName)) {
        push(structItem.line, `结构体 ${structItem.name} 的 C++ 类型名「${structItem.cppName}」不是合法的英文标识符。`, '请写成 `结构体 中文名 = 英文类型名`，例如 = Point。');
      }
      if (library.namespaceName) {
        diagnosticSequence += 1;
        diagnostics.push({
          id: `project-cpp-source-${structItem.line}-${diagnosticSequence}`,
          line: structItem.line,
          level: 'error',
          message: `结构体 ${structItem.name} 暂不支持命名空间，「命名空间 = ${library.namespaceName}」只作用于函数命令。`,
          codeSnippet: structItem.name,
          suggestion: '请把结构体移到独立的无命名空间库（结构体定义与适配器都发在无命名空间区块，混用会链接失败）。'
        });
      }
      structItem.fields.forEach(field => {
        if (resolveCppSourceStructFieldCppType(field.type)) return;
        if (structOwnerByName.has(field.type.trim())) {
          push(field.line, `结构体 ${structItem.name} 的字段「${field.name}」类型「${field.type}」是结构体。`, '暂不支持嵌套结构体字段；请拆成两个扁平结构体分别声明与调用。');
          return;
        }
        if (/\[\]|［］/u.test(field.type)) {
          push(field.line, `结构体 ${structItem.name} 的字段「${field.name}」类型「${field.type}」不支持。`, '暂不支持数组字段；标量与文本型字段可直接声明（文本型字段即 std::wstring）。');
          return;
        }
        push(field.line, `结构体 ${structItem.name} 的字段「${field.name}」类型「${field.type}」不支持。`, '仅支持：整数型、长整数型、小数型、单精度小数型、逻辑型、字节型、指针整数、文本型（std::wstring）。');
      });
    });
  });
  // 访问器命令名（结构名_创建/销毁/取字段/置字段）与显式命令声明共用同一命令名空间。
  const declaredCommandNames = new Set(parsed.program.cppLibraries.flatMap(library => library.commands.map(command => command.name)));
  parsed.program.cppLibraries.forEach(library => {
    library.structs.forEach(structItem => {
      const accessorNames = [
        `${structItem.name}_创建`,
        `${structItem.name}_销毁`,
        ...structItem.fields.flatMap(field => [`${structItem.name}_取${field.name}`, `${structItem.name}_置${field.name}`])
      ];
      accessorNames.forEach(accessorName => {
        if (declaredCommandNames.has(accessorName)) {
          push(structItem.line, `结构体 ${structItem.name} 的访问器命令 ${accessorName} 与已声明的命令重名。`, '自动访问器命令名（结构名_创建/销毁/取字段/置字段）必须唯一；请改命令名或结构体/字段名。');
        }
      });
    });
  });
  return diagnostics;
}

/** 合成 binding 参数形状（handler 与普通参数的统一形态）。 */
interface CppSourceBindingParameter {
  name: string;
  type: ModuleBindingValueType;
  description: string;
  byRef?: boolean;
  handlerSignature?: { parameterTypes: string[]; returnType: string };
  /** v6.2 跨线程封送：回调被工作线程触发时经 PostMessage 投递到界面线程执行。 */
  handlerMarshalUiThread?: boolean;
}

  const toBindingParameters = (parameters: LingCppParameter[]): CppSourceBindingParameter[] => parameters.map(parameter => {
    if (parameter.type === '处理器') {
      // 回调参数：binding 用现成 handler 词表 + handlerSignature（语言服务校验 &子程序签名，
      // 返回类型非空时按相容性校验）；生成器按 cppCallback invocation 把实参展开为 std::function 兼容 lambda。
      // 界面线程（v6.2）：显式封送标记经 binding 传给生成器（改发 PostMessage 封送 lambda）。
      return {
        name: parameter.name,
        type: 'handler' as ModuleBindingValueType,
        description: parameter.note || '回调参数；.lcpp 传 &子程序名，C++ 侧收 std::function<...>。',
        handlerSignature: {
          parameterTypes: (parameter.handlerSignatureParameters || []).map(signatureParameter => signatureParameter.type),
          returnType: parameter.handlerReturnType || '空'
        },
        ...(parameter.handlerMarshalUiThread ? { handlerMarshalUiThread: true } : {})
      };
    }
  const mapped = resolveCppSourceType(parameter.type);
  return {
    name: parameter.name,
    type: (mapped?.abi || 'raw') as ModuleBindingValueType,
    description: parameter.note || 'C++ 源码函数参数。',
    byRef: parameter.byRef === true ? true : undefined,
    // 数组形参按 const 引用输入（v3）：语言服务跳过模块数组命令的就地出参校验。
    ...(mapped?.abi === 'array' ? { cppConstRefArray: true } : {})
  };
});

/** 类是否带处理器形参（决定 binding invocation 形态）。 */
const hasHandlerParameter = (parameters: LingCppParameter[]) => parameters.some(parameter => parameter.type === '处理器');

/** 类方法在异常包装里的合成 C++ 名（与声明头生成共用同一规则，保证绑定与包装一一对应）。 */
export function cppClassSyntheticCppName(classItem: LingCppCppClass, method: LingCppCppClassMethod): string {
  if (method.name === '创建') return `New_${classItem.cppName}`;
  if (method.name === '销毁') return `Delete_${classItem.cppName}`;
  return `M_${method.cppName || method.name}`;
}

interface CppClassSynthesizedItem {
  commands: Array<{
    name: string;
    signature: string;
    description: string;
    insertText: string;
    returnType: string;
    category: '其他';
    visibility: 'default';
  }>;
  bindings: Array<{
    command: string;
    runtimeName: string;
    parameters: CppSourceBindingParameter[];
    returnType: ModuleBindingValueType;
    encoding: 'wide';
    example: string;
    invocation?: { kind: 'cppClassMethod'; className: string; cppMethodName?: string; form: 'constructor' | 'destructor' | 'method' };
  }>;
}

/**
 * 类块 → 全局命令合成（与 DLL 结构体访问器同范式）：
 * `类名_创建(构造参数...) → 长整数型句柄`、`类名_销毁(对象)`、`类名_方法名(对象, 参数...)`。
 * 调用点经 cppClassMethod invocation 发射 new/delete/成员方法调用；
 * wrapPrefix 存在（异常捕获库）时 runtimeName 改指包装且省略 invocation（包装在声明头内完成 new/delete/强转）。
 */
const buildCppClassDeclarationItems = (classItem: LingCppCppClass, wrapPrefix?: string): CppClassSynthesizedItem => {
  const prefix = `${classItem.name}_`;
  const wrapOf = (method: LingCppCppClassMethod) => (wrapPrefix ? `${wrapPrefix}${cppClassSyntheticCppName(classItem, method)}` : undefined);
  const commands: CppClassSynthesizedItem['commands'] = [];
  const bindings: CppClassSynthesizedItem['bindings'] = [];
  const constructorMethod = classItem.methods.find(method => method.name === '创建');
  if (constructorMethod) {
    const parameterNames = constructorMethod.parameters.map(parameter => parameter.name).join(', ');
    commands.push({
      name: `${prefix}创建`,
      signature: `${prefix}创建(${parameterNames})`,
      description: constructorMethod.remark || `构造一个 ${classItem.cppName} 对象并返回句柄；用完请调用 ${prefix}销毁 释放。`,
      insertText: `${prefix}创建(${parameterNames})`,
      returnType: '长整数型',
      category: '其他',
      visibility: 'default'
    });
    bindings.push({
      command: `${prefix}创建`,
      runtimeName: wrapOf(constructorMethod) || `${prefix}创建`,
      parameters: toBindingParameters(constructorMethod.parameters),
      returnType: 'longLong',
      encoding: 'wide',
      example: `${prefix}创建(${parameterNames})`,
      ...(wrapOf(constructorMethod) ? {} : { invocation: { kind: 'cppClassMethod' as const, className: classItem.cppName, form: 'constructor' as const } })
    });
  }
  const destructorMethod = classItem.methods.find(method => method.name === '销毁');
  if (destructorMethod) {
    commands.push({
      name: `${prefix}销毁`,
      signature: `${prefix}销毁(对象)`,
      description: destructorMethod.remark || `释放 ${prefix}创建 返回的 ${classItem.name} 对象（delete）。`,
      insertText: `${prefix}销毁()`,
      returnType: '空',
      category: '其他',
      visibility: 'default'
    });
    bindings.push({
      command: `${prefix}销毁`,
      runtimeName: wrapOf(destructorMethod) || `${prefix}销毁`,
      parameters: [{ name: '对象', type: 'longLong' as ModuleBindingValueType, description: `${classItem.name} 对象句柄（由 ${prefix}创建 返回）。` }],
      returnType: 'void',
      encoding: 'wide',
      example: `${prefix}销毁(对象)`,
      ...(wrapOf(destructorMethod) ? {} : { invocation: { kind: 'cppClassMethod' as const, className: classItem.cppName, form: 'destructor' as const } })
    });
  }
  classItem.methods.forEach(method => {
    if (method.name === '创建' || method.name === '销毁') return;
    if (method.isPublic === false) return;
    const parameterNames = method.parameters.map(parameter => parameter.name).join(', ');
    const commandName = `${prefix}${method.name}`;
    commands.push({
      name: commandName,
      signature: `${commandName}(对象${parameterNames ? `, ${parameterNames}` : ''})`,
      description: method.remark || `调用 ${classItem.name}（${classItem.cppName}）对象的 ${method.cppName || method.name} 方法。`,
      insertText: `${commandName}(${parameterNames})`,
      returnType: method.returnType,
      category: '其他',
      visibility: 'default'
    });
    bindings.push({
      command: commandName,
      runtimeName: wrapOf(method) || commandName,
      parameters: [{ name: '对象', type: 'longLong' as ModuleBindingValueType, description: `${classItem.name} 对象句柄（由 ${prefix}创建 返回）。` }, ...toBindingParameters(method.parameters)],
      returnType: resolveCppSourceType(method.returnType)?.abi || 'void',
      encoding: 'wide',
      example: `${commandName}(对象${parameterNames ? `, ${parameterNames}` : ''})`,
      ...(wrapOf(method) ? {} : { invocation: { kind: 'cppClassMethod' as const, className: classItem.cppName, cppMethodName: method.cppName, form: 'method' as const } })
    });
  });
  return { commands, bindings };
};

/**
 * 结构体访问器合成（v6，与 DLL 结构体访问器同范式）：
 * `结构名_创建()`（零初始化）/ `结构名_销毁(句柄)` / 每字段一对 `结构名_取X(句柄)` / `结构名_置X(句柄, 值)`。
 * C++ 实现全部内联在声明头（调用点按 runtimeName 直接调用，无需 invocation）；
 * 空句柄安全：取返回零值、置忽略。文本型字段取/置按 文本型 交互（C++ 侧 std::wstring）。
 */
const buildCppStructAccessorItems = (structItem: LingCppCppSourceStruct): CppClassSynthesizedItem => {
  const prefix = `${structItem.name}_`;
  const commands: CppClassSynthesizedItem['commands'] = [];
  const bindings: CppClassSynthesizedItem['bindings'] = [];
  commands.push({
    name: `${prefix}创建`,
    signature: `${prefix}创建()`,
    description: `创建一个零初始化的 ${structItem.name}（${structItem.cppName}）结构体并返回句柄；用完请调用 ${prefix}销毁 释放。`,
    insertText: `${prefix}创建()`,
    returnType: '长整数型',
    category: '其他',
    visibility: 'default'
  });
  bindings.push({
    command: `${prefix}创建`,
    runtimeName: `${prefix}创建`,
    parameters: [],
    returnType: 'longLong',
    encoding: 'wide',
    example: `${prefix}创建()`
  });
  commands.push({
    name: `${prefix}销毁`,
    signature: `${prefix}销毁(句柄)`,
    description: `释放 ${prefix}创建 返回的 ${structItem.name} 结构体（delete）。`,
    insertText: `${prefix}销毁()`,
    returnType: '空',
    category: '其他',
    visibility: 'default'
  });
  bindings.push({
    command: `${prefix}销毁`,
    runtimeName: `${prefix}销毁`,
    parameters: [{ name: '句柄', type: 'longLong' as ModuleBindingValueType, description: `${structItem.name} 结构体句柄。` }],
    returnType: 'void',
    encoding: 'wide',
    example: `${prefix}销毁(句柄)`
  });
  structItem.fields.forEach(field => {
    const callerType = resolveCppSourceStructFieldCallerType(field.type);
    const fieldNote = field.note ? `（${field.note}）` : '';
    const abi = resolveCppSourceStructFieldAbi(field.type);
    commands.push({
      name: `${prefix}取${field.name}`,
      signature: `${prefix}取${field.name}(句柄)`,
      description: `读取 ${structItem.name} 的 ${field.name} 字段${fieldNote}；句柄为零时返回零值。`,
      insertText: `${prefix}取${field.name}(句柄)`,
      returnType: callerType,
      category: '其他',
      visibility: 'default'
    });
    commands.push({
      name: `${prefix}置${field.name}`,
      signature: `${prefix}置${field.name}(句柄, 值)`,
      description: `写入 ${structItem.name} 的 ${field.name} 字段${fieldNote}；句柄为零时忽略。`,
      insertText: `${prefix}置${field.name}(句柄, )`,
      returnType: '空',
      category: '其他',
      visibility: 'default'
    });
    bindings.push({
      command: `${prefix}取${field.name}`,
      runtimeName: `${prefix}取${field.name}`,
      parameters: [{ name: '句柄', type: 'longLong' as ModuleBindingValueType, description: `${structItem.name} 结构体句柄。` }],
      returnType: abi,
      encoding: 'wide',
      example: `${prefix}取${field.name}(句柄)`
    });
    bindings.push({
      command: `${prefix}置${field.name}`,
      runtimeName: `${prefix}置${field.name}`,
      parameters: [
        { name: '句柄', type: 'longLong' as ModuleBindingValueType, description: `${structItem.name} 结构体句柄。` },
        { name: '值', type: abi, description: `要写入的 ${field.name} 值。` }
      ],
      returnType: 'void',
      encoding: 'wide',
      example: `${prefix}置${field.name}(句柄, 值)`
    });
  });
  return { commands, bindings };
};

/** 命令是否带结构体参数/返回（决定 runtimeName 是否指向声明头适配器）。 */
const commandUsesCppSourceStruct = (library: LingCppCppSourceLibrary, command: LingCppCppSourceCommand): boolean =>
  resolveCppSourceCommandType(command.returnType, library)?.isStruct === true
  || command.parameters.some(parameter => resolveCppSourceCommandType(parameter.type, library)?.isStruct === true);

/** 命令参数 binding（v6 结构体感知）：结构体参数按句柄（longLong）声明，其余走 toBindingParameters。 */
const toCommandBindingParameters = (library: LingCppCppSourceLibrary, parameters: LingCppParameter[]): CppSourceBindingParameter[] =>
  parameters.map(parameter => {
    const resolved = resolveCppSourceCommandType(parameter.type, library);
    if (resolved?.isStruct) {
      return {
        name: parameter.name,
        type: 'longLong' as ModuleBindingValueType,
        description: parameter.note || `${parameter.type} 结构体句柄（由 ${parameter.type}_创建 创建、${parameter.type}_销毁 释放；生成端自动解引用为 const ${resolved.structCppName}&）。`
      };
    }
    return toBindingParameters([parameter])[0];
  });

/**
 * 由项目 C++ 源码库声明合成虚拟模块（lingbuilder.project.cppsrc）。
 * 注入 enabledModules 后，诊断/补全/实参类型门禁/C++ 生成自动复用模块链路；
 * targets.sources 里的路径是物化后的 `modules/<id>/sources/<相对路径>` 布局，
 * vcxproj 导出与多 TU 编译都按它登记。
 */
export function createProjectCppSourceDeclarationModule(cppLibraries: LingCppCppSourceLibrary[], projectId: string): InstalledModule | undefined {
  const libraries = cppLibraries.filter(library => library.commands.length > 0 || library.classes.length > 0 || library.structs.length > 0);
  if (libraries.length === 0) return undefined;
  // 异常捕获（v3）：捕获库的全部命令改调 try/catch 包装（runtimeName = 包装名，cppClassMethod
  // invocation 同时省略——包装在声明头内完成 new/delete/强转），并自动登记 <库名>_取错误() 命令。
  // 库序号与声明头生成（generateProjectCppSourceDeclarationHeader）用同一份过滤后的 libraries 顺序。
  const wrappedLibraries = libraries.map((library, index) => ({
    library,
    wrapPrefix: library.exceptionCapture ? `LB_CppSrcWrap_${index + 1}_` : undefined
  }));
  const effectiveClassItems = wrappedLibraries
    .filter(({ library }) => library.classes.length > 0)
    .flatMap(({ library, wrapPrefix }) => library.classes.map(classItem => buildCppClassDeclarationItems(classItem, wrapPrefix)));
  // 结构体访问器（v6）：与命名空间互斥（诊断阻断，这里防御性跳过命名空间库）。
  const effectiveStructItems = libraries
    .filter(library => library.structs.length > 0 && !library.namespaceName)
    .flatMap(library => library.structs.map(buildCppStructAccessorItems));
  // C++ 函数名登记为别名：敲 add 能筛出「加法计算」，上屏仍是中文主名。与任何命令名或别名冲突时不登记。
  const declaredNames = new Set<string>([
    ...libraries.flatMap(library => library.commands.map(command => command.name)),
    ...effectiveClassItems.flatMap(item => item.commands.map(command => command.name)),
    ...effectiveStructItems.flatMap(item => item.commands.map(command => command.name))
  ]);
  const usedAliases = new Set<string>();
  const cppAliasOf = (command: LingCppCppSourceCommand): string[] | undefined => {
    const alias = command.cppName?.trim();
    if (!alias || alias === command.name || declaredNames.has(alias) || usedAliases.has(alias)) return undefined;
    usedAliases.add(alias);
    return [alias];
  };
  const sourceFiles = [...new Set(libraries.flatMap(library => library.sourceFiles.map(file => `sources/${file.relativePath}`)))];
  const errorCommandItems = wrappedLibraries.filter(({ library }) => library.exceptionCapture);
  const manifest: LingBuilderModuleManifest = {
    schemaVersion: 2,
    id: PROJECT_CPP_SOURCE_MODULE_ID,
    name: '项目 C++ 源码库',
    version: '1.3.0',
    category: '其他',
    description: '由项目「C++ 源码库」声明合成的项目级模块：中文命令直连项目内 C++ 源码函数/类（源码并入生成工程一起编译）。',
    author: 'LingBuilder',
    tags: ['项目声明', 'C++源码'],
    contributes: {
      // 类名/结构体名登记为不透明句柄类型（v5/v6）：`局部 计数器 对象 = 0`、`局部 点 句柄 = 0`
      // 直接可用——语言服务未知类型诊断与赋值/实参相容按 cppType=long long 归入基础类别，
      // 生成器 toCppType 同映射。
      types: [
        ...libraries.flatMap(library => library.classes.map(classItem => ({
          name: classItem.name,
          description: `类 ${classItem.name}（${classItem.cppName}）的句柄类型；由 ${classItem.name}_创建/${classItem.name}_销毁 管理生命周期。`,
          cppType: 'long long'
        }))),
        ...libraries.flatMap(library => library.structs.map(structItem => ({
          name: structItem.name,
          description: `结构体 ${structItem.name}（${structItem.cppName}）的句柄类型；由 ${structItem.name}_创建/${structItem.name}_销毁 管理生命周期。`,
          cppType: 'long long'
        })))
      ],
      commands: [
        ...libraries.flatMap(library => library.commands
          .filter(command => command.isPublic !== false)
          .map(command => ({
            name: command.name,
            aliases: cppAliasOf(command),
            signature: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
            description: command.remark || `调用源码库「${library.name}」的 C++ 函数${command.cppName ? `（${command.cppName}）` : ''}。`,
            insertText: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
            returnType: command.returnType,
            category: '其他' as const,
            visibility: 'default' as const
          }))),
        ...effectiveClassItems.flatMap(item => item.commands),
        ...effectiveStructItems.flatMap(item => item.commands),
        ...errorCommandItems.flatMap(({ library }) => [{
          name: `${library.name}_取错误`,
          signature: `${library.name}_取错误()`,
          description: `读取源码库「${library.name}」（异常 = 捕获）最近一次被捕获的 C++ 异常文本并清空；没有异常时返回空文本。`,
          insertText: `${library.name}_取错误()`,
          returnType: '文本型',
          category: '其他' as const,
          visibility: 'default' as const
        }])
      ]
    },
    targets: ['Win32', 'x64'].map(arch => ({
      id: arch === 'Win32' ? 'windows-msvc-win32' : 'windows-msvc-x64',
      platform: 'windows' as const,
      arch: (arch === 'Win32' ? 'win32' : 'x64') as 'win32' | 'x64',
      toolchain: 'msvc' as const,
      includeDirs: ['include'],
      headers: ['include/CppSourceLibraries.h'],
      sources: sourceFiles
    })),
    bindings: {
      commands: [
        ...wrappedLibraries.flatMap(({ library, wrapPrefix }) => library.commands.map(command => ({
          command: command.name,
          // 带结构体参数/返回的命令（v6）：runtimeName 指向声明头适配器（按中文命令名命名的
          // inline 函数，负责句柄解引用/返回堆包裹）；捕获库由包装体兼任适配器（首分支）。
          runtimeName: (wrapPrefix && command.cppName) ? `${wrapPrefix}${command.cppName}`
            : library.namespaceName ? command.name
            : commandUsesCppSourceStruct(library, command) ? toLocalCppIdentifier(command.name)
            : (command.cppName || command.name),
          parameters: toCommandBindingParameters(library, command.parameters),
          returnType: resolveCppSourceCommandType(command.returnType, library)?.abi || 'void',
          encoding: 'wide' as const,
          example: `${command.name}(${command.parameters.map(parameter => parameter.name).join(', ')})`,
          ...(hasHandlerParameter(command.parameters) ? { invocation: { kind: 'cppCallback' } as const } : {})
        }))),
        ...effectiveClassItems.flatMap(item => item.bindings),
        ...effectiveStructItems.flatMap(item => item.bindings),
        ...errorCommandItems.map(({ library }) => ({
          command: `${library.name}_取错误`,
          runtimeName: 'LB_CppSrcTakeError',
          parameters: [],
          returnType: 'wideString' as ModuleBindingValueType,
          encoding: 'wide' as const,
          example: `${library.name}_取错误()`
        }))
      ]
    }
  };
  return {
    manifest,
    installPath: `__project_cppsrc__/${projectId}`,
    isBuiltin: false,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

/** 处理器参数的 C++ 形参类型：std::function<返回(签名形参...)>（返回缺省 void，`回传 类型` 指定非空返回）。 */
export function getCppHandlerParameterCppType(parameter: LingCppParameter): string {
  const signatureTypes = (parameter.handlerSignatureParameters || [])
    .map(signatureParameter => resolveCppSourceType(signatureParameter.type)?.cpp || 'int');
  const returnCpp = parameter.handlerReturnType
    ? resolveCppSourceReturnCppType(parameter.handlerReturnType) || 'void'
    : 'void';
  return `std::function<${returnCpp}(${signatureTypes.join(', ')})>`;
}

/** 生成 C++ 前置声明/形参时单个参数的 C++ 类型（处理器 → std::function；传址 → 指针）。 */
const getParameterCppTypeForDeclaration = (parameter: LingCppParameter): string => {
  if (parameter.type === '处理器') return getCppHandlerParameterCppType(parameter);
  if (parameter.byRef) return resolveCppSourcePointerType(parameter.type) || 'void*';
  return resolveCppSourceType(parameter.type)?.cpp || 'void*';
};

/** 声明库内是否有处理器参数（命令或类方法）：有则声明头需要 <functional>。 */
const hasHandlerParameterInLibraries = (libraries: LingCppCppSourceLibrary[]): boolean =>
  libraries.some(library =>
    library.commands.some(command => hasHandlerParameter(command.parameters))
    || library.classes.some(classItem => classItem.methods.some(method => hasHandlerParameter(method.parameters))));

/**
 * 声明命令的 C++ 声明头（构建期写入 modules/lingbuilder.project.cppsrc/include/）。
 * - 有「头文件 =」的库：只 #include 用户头文件（声明以头文件为准，避免与用户定义 C2556/C2373 冲突）。
 * - 没有头文件的库：按声明发「期望签名」前置声明（C++ 链接）；用户定义必须与此一致，否则链接期 LNK2019。
 * - 类块不生成声明（类定义来自头文件，声明期诊断强制「头文件 =」）；回调参数生成 std::function<...> 形参。
 * - 结构体块（v6）：无头文件库在期望签名**之前**直接发 struct 定义（同工程编译无布局/ABI 约束，
 *   文本型字段 = std::wstring）；头文件库只发注释（定义来自头文件，字段行是访问器契约）。
 *   随后发全部访问器 inline（创建/销毁/取X/置X）与结构体命令适配器（句柄解引用/返回堆包裹）。
 * - 「异常 = 捕获」的库（v3）：额外发 try/catch 包装函数（真实函数照常声明/包含，绑定改调包装），
 *   异常文本经 LB_CppSrcTakeError()（即 <库名>_取错误() 命令）读取；结构体命令的包装体兼任适配器。
 */
export function generateProjectCppSourceDeclarationHeader(cppLibraries: LingCppCppSourceLibrary[]): string {
  const libraries = cppLibraries.filter(library => library.commands.length > 0 || library.classes.length > 0 || library.structs.length > 0);
  if (libraries.length === 0) return '';
  const needsExceptionRuntime = libraries.some(library => library.exceptionCapture);
  const needsWstringInclude = libraries.some(library => library.structs.some(structItem =>
    structItem.fields.some(field => resolveCppSourceStructFieldCppType(field.type) === 'std::wstring')));
  const lines: string[] = [
    '// 由 LingBuilder 项目 C++ 源码库声明自动生成：中文命令 → 项目内 C++ 源码函数（同一工程直接编译，无 DLL 边界）。',
    '// C++ 侧必须是全局自由函数，签名与下方声明一致；签名不一致会在链接期报 LNK2019 未解析符号。',
    '// 文本型参数/返回按 const wchar_t* 声明（C++ 侧定义写 std::wstring 值参/返回也可，构造/转换隐式兼容）。',
    '// 结构体参数按 const 结构体& 声明、结构体返回按值声明（.lcpp 侧一律以长整数型句柄持有，',
    '// 无头文件的库请在本文件里直接取结构体定义：#include "CppSourceLibraries.h" 即可）。',
    '#pragma once',
    '#include <cstdint>',
    '#include <cwchar>',
    '#include <vector>',
    ...(hasHandlerParameterInLibraries(libraries) ? ['#include <functional>'] : []),
    ...(needsExceptionRuntime || needsWstringInclude ? ['#include <string>'] : []),
    ''
  ];
  // 异常捕获运行时必须在库区块（含包装函数）之前：包装体引用 LB_CppSrcRecordCppError。
  if (needsExceptionRuntime) {
    lines.push('#ifdef __cplusplus', '', '// ===== 异常捕获运行时（「异常 = 捕获」库共用）：线程局部最近一次异常文本 =====', '');
    lines.push(EXCEPTION_RUNTIME_BLOCK);
    lines.push('#endif', '');
  }
  libraries.forEach((library, libraryIndex) => {
    const wrapPrefix = library.exceptionCapture ? `LB_CppSrcWrap_${libraryIndex + 1}_` : undefined;
    // 命名空间（v4）：函数命令的 C++ 函数位于该命名空间；限定名只在生成头内部使用
    //（前置声明进 namespace 块 / 包装体与转发函数限定调用），绑定经转发函数按命令名调用。
    // 结构体不支持命名空间（声明期诊断阻断，这里防御性跳过结构体发射）。
    const qualifiedCppName = (cppName: string) => library.namespaceName ? `${library.namespaceName}::${cppName}` : cppName;
    if (library.headerFiles.length > 0) {
      lines.push(`// ${library.name}：使用项目自带头文件，声明以头文件为准。`);
      library.headerFiles.forEach(header => {
        lines.push(`#include "../sources/${header.relativePath}"`);
      });
      library.classes.forEach(classItem => {
        lines.push(`// 类 ${classItem.name} → ${classItem.cppName}（类定义来自上方头文件；调用形如 new ${classItem.cppName}(...)/delete/对象->方法(...)）。`);
      });
      library.structs.forEach(structItem => {
        lines.push(`// 结构体 ${structItem.name} → ${structItem.cppName}（定义来自上方头文件；.lcpp 侧以句柄持有，字段访问用 ${structItem.name}_取X/${structItem.name}_置X。`);
        lines.push(`//   若编译报 ${structItem.cppName} 未定义：头文件里没有该 struct 定义（可能经其它头引入），请补齐定义或把结构体移到无头文件库。`);
      });
      lines.push('');
    } else if (library.namespaceName) {
      lines.push(`// ${library.name}：命名空间 ${library.namespaceName} 内的期望签名前置声明。`);
      lines.push(`namespace ${library.namespaceName} {`);
      library.commands.forEach(command => {
        if (command.remark) lines.push(`  // ${command.remark}`);
        const returnType = resolveCppSourceReturnCppType(command.returnType) || 'void';
        const parameters = command.parameters.map((parameter, index) => `${getParameterCppTypeForDeclaration(parameter)} p${index}`);
        lines.push(`  ${returnType} ${command.cppName || command.name}(${parameters.join(', ')});`);
      });
      lines.push('}');
      lines.push('');
    } else {
      lines.push(`// ${library.name}：按声明发前置声明（期望签名）。`);
      // 结构体定义（v6）：必须在期望签名之前（签名引用结构体类型）；C++ 源码 include 本文件即可拿到定义。
      library.structs.forEach(structItem => {
        lines.push(`// 结构体 ${structItem.name} → ${structItem.cppName}（由声明生成；.lcpp 侧以句柄持有，字段访问用 ${structItem.name}_取X/${structItem.name}_置X）。`);
        lines.push(`struct ${structItem.cppName} {`);
        structItem.fields.forEach(field => {
          const memberType = resolveCppSourceStructFieldCppType(field.type) || 'int';
          lines.push(`    ${memberType} ${toLocalCppIdentifier(field.name)};${field.note ? ` // ${field.note}` : ''}`);
        });
        lines.push('};');
        lines.push('');
      });
      library.commands.forEach(command => {
        if (command.remark) lines.push(`// ${command.remark}`);
        // 期望签名与用户 C++ 定义一致：结构体参数 = const Struct&、结构体返回 = 按值 Struct
        //（适配器才是收句柄的一方，它由我们生成并调用这里的真实函数）。
        const returnResolved = resolveCppSourceCommandType(command.returnType, library);
        const returnType = returnResolved?.isStruct ? returnResolved.structCppName : (resolveCppSourceReturnCppType(command.returnType) || 'void');
        const parameters = command.parameters.map((parameter, index) => {
          const resolved = resolveCppSourceCommandType(parameter.type, library);
          return `${resolved?.isStruct ? resolved.cpp : getParameterCppTypeForDeclaration(parameter)} p${index}`;
        });
        lines.push(`${returnType} ${command.cppName || command.name}(${parameters.join(', ')});`);
      });
      lines.push('');
    }
    // 结构体访问器与命令适配器（v6）：仅无命名空间库（命名空间+结构体被诊断阻断）。
    if (!library.namespaceName) {
      library.structs.forEach(structItem => {
        const cppName = structItem.cppName;
        const prefix = `${structItem.name}_`;
        lines.push(`// 结构体 ${structItem.name} 访问器：句柄为零时取值返回零值、写入忽略。`);
        lines.push(`inline long long ${prefix}创建() { return reinterpret_cast<long long>(new ${cppName}()); }`);
        lines.push(`inline void ${prefix}销毁(long long lbHandle) { if (lbHandle) delete reinterpret_cast<${cppName}*>(lbHandle); }`);
        structItem.fields.forEach(field => {
          const memberType = resolveCppSourceStructFieldCppType(field.type) || 'int';
          const memberName = toLocalCppIdentifier(field.name);
          const zeroValue = field.type.trim() === '逻辑型' ? 'false'
            : field.type.trim() === '小数型' ? '0.0'
            : field.type.trim() === '单精度小数型' ? '0.0f'
            : '0';
          if (resolveCppSourceStructFieldCppType(field.type) === 'std::wstring') {
            lines.push(`inline const wchar_t* ${prefix}取${field.name}(long long lbHandle) { return lbHandle ? reinterpret_cast<${cppName}*>(lbHandle)->${memberName}.c_str() : L""; }`);
            lines.push(`inline void ${prefix}置${field.name}(long long lbHandle, const wchar_t* lbValue) { if (lbHandle) reinterpret_cast<${cppName}*>(lbHandle)->${memberName} = lbValue ? lbValue : L""; }`);
          } else {
            lines.push(`inline ${memberType} ${prefix}取${field.name}(long long lbHandle) { return lbHandle ? reinterpret_cast<${cppName}*>(lbHandle)->${memberName} : ${zeroValue}; }`);
            lines.push(`inline void ${prefix}置${field.name}(long long lbHandle, ${memberType} lbValue) { if (lbHandle) reinterpret_cast<${cppName}*>(lbHandle)->${memberName} = lbValue; }`);
          }
        });
        lines.push('');
      });
      // 命令适配器（v6）：带结构体参数/返回且未开异常捕获的命令——句柄解引用与返回堆包裹
      // 都在适配器内完成，binding runtimeName 指向适配器（按中文命令名命名，与转发函数同范式）；
      // 捕获库不另发适配器（包装体兼任）。
      if (!wrapPrefix) {
        library.commands.forEach(command => {
          if (!command.cppName) return;
          if (!commandUsesCppSourceStruct(library, command)) return;
          const adapterName = toLocalCppIdentifier(command.name);
          const adapterParameters = command.parameters.map((parameter, index) => {
            const resolved = resolveCppSourceCommandType(parameter.type, library);
            return `${resolved?.isStruct ? 'long long' : getParameterCppTypeForDeclaration(parameter)} p${index}`;
          });
          const argumentList = command.parameters.map((parameter, index) => {
            const resolved = resolveCppSourceCommandType(parameter.type, library);
            return resolved?.isStruct ? `*reinterpret_cast<${resolved.structCppName}*>(p${index})` : `p${index}`;
          }).join(', ');
          const call = `${qualifiedCppName(command.cppName)}(${argumentList})`;
          const returnResolved = resolveCppSourceCommandType(command.returnType, library);
          if (returnResolved?.isStruct) {
            lines.push(`// 命令适配器：${command.name} → ${command.cppName}（返回按值，堆包裹为句柄；用完必须 ${returnResolved.structCppName} 对应的 销毁 命令释放）。`);
            lines.push(`inline long long ${adapterName}(${adapterParameters.join(', ')}) { return reinterpret_cast<long long>(new ${returnResolved.structCppName}(${call})); }`);
          } else {
            lines.push(`// 命令适配器：${command.name} → ${command.cppName}（结构体参数按句柄传入，此处解引用为 const 引用）。`);
            lines.push(`inline ${resolveCppSourceReturnCppType(command.returnType) || 'void'} ${adapterName}(${adapterParameters.join(', ')}) { return ${call}; }`);
          }
          lines.push('');
        });
      }
    }
    // 命名空间且未开异常捕获：按中文命令名发全局转发函数（绑定 runtimeName = 命令名）。
    if (library.namespaceName && !library.exceptionCapture) {
      library.commands.forEach(command => {
        const returnType = resolveCppSourceReturnCppType(command.returnType) || 'void';
        const parameters = command.parameters.map((parameter, index) => `${getParameterCppTypeForDeclaration(parameter)} p${index}`).join(', ');
        const argumentList = command.parameters.map((_, index) => `p${index}`).join(', ');
        lines.push(`inline ${returnType} ${toLocalCppIdentifier(command.name)}(${parameters}) { return ${qualifiedCppName(command.cppName || command.name)}(${argumentList}); }`);
      });
      lines.push('');
    }
    if (!wrapPrefix) return;
    // ===== 异常捕获包装（真实函数照常声明/包含，绑定改调包装） =====
    library.commands.forEach(command => {
      if (!command.cppName) return;
      // 结构体命令（v6）：包装体兼任适配器——参数位收句柄并解引用，返回位堆包裹为句柄。
      const returnResolved = resolveCppSourceCommandType(command.returnType, library);
      const isStructReturn = returnResolved?.isStruct === true;
      const returnType = isStructReturn ? 'long long' : (resolveCppSourceReturnCppType(command.returnType) || 'void');
      const parameterList = command.parameters.map((parameter, index) => {
        const resolved = resolveCppSourceCommandType(parameter.type, library);
        return `${resolved?.isStruct ? 'long long' : getParameterCppTypeForDeclaration(parameter)} p${index}`;
      }).join(', ');
      const argumentList = command.parameters.map((parameter, index) => {
        const resolved = resolveCppSourceCommandType(parameter.type, library);
        return resolved?.isStruct ? `*reinterpret_cast<${resolved.structCppName}*>(p${index})` : `p${index}`;
      }).join(', ');
      const call = `${qualifiedCppName(command.cppName)}(${argumentList})`;
      const wrappedCall = isStructReturn ? `reinterpret_cast<long long>(new ${returnResolved.structCppName}(${call}))` : call;
      const fallback = isStructReturn ? '0' : cppSourceFallbackReturn(returnType);
      lines.push(`// ${library.name} 异常包装：${command.name} → ${command.cppName}`);
      lines.push(`inline ${returnType} ${wrapPrefix}${command.cppName}(${parameterList}) {`);
      lines.push(`    try { ${fallback === undefined ? `${wrappedCall};` : `return ${wrappedCall};`} }`);
      lines.push('    catch (const std::exception& lbError) { LB_CppSrcRecordCppError(lbError.what()); }');
      lines.push('    catch (...) { LB_CppSrcRecordCppError(nullptr); }');
      if (fallback !== undefined) lines.push(`    return ${fallback};`);
      lines.push('}');
      lines.push('');
    });
    library.classes.forEach(classItem => {
      classItem.methods.forEach(method => {
        const synthetic = cppClassSyntheticCppName(classItem, method);
        const isConstructor = method.name === '创建';
        const isDestructor = method.name === '销毁';
        const returnType = isConstructor ? 'long long' : isDestructor ? 'void' : resolveCppSourceReturnCppType(method.returnType) || 'void';
        const declaredParameters = isDestructor ? [] : method.parameters;
        const parameterList = [
          ...(isConstructor ? [] : ['long long p0']),
          ...declaredParameters.map((parameter, index) => `${getParameterCppTypeForDeclaration(parameter)} p${index + (isConstructor ? 0 : 1)}`)
        ].join(', ');
        const innerArguments = declaredParameters.map((_, index) => `p${index + (isConstructor ? 0 : 1)}`).join(', ');
        let innerCall: string;
        if (isConstructor) innerCall = `reinterpret_cast<long long>(new ${classItem.cppName}(${innerArguments}))`;
        else if (isDestructor) innerCall = `delete reinterpret_cast<${classItem.cppName}*>(p0)`;
        else innerCall = `reinterpret_cast<${classItem.cppName}*>(p0)->${method.cppName || method.name}(${innerArguments})`;
        const fallback = isConstructor ? '0' : isDestructor ? undefined : cppSourceFallbackReturn(returnType);
        lines.push(`// ${library.name} 类 ${classItem.name} 异常包装：${method.name} → ${synthetic}`);
        lines.push(`inline ${returnType} ${wrapPrefix}${synthetic}(${parameterList}) {`);
        lines.push(`    try { ${fallback === undefined && !isConstructor ? `${innerCall};` : `return ${innerCall};`} }`);
        lines.push('    catch (const std::exception& lbError) { LB_CppSrcRecordCppError(lbError.what()); }');
        lines.push('    catch (...) { LB_CppSrcRecordCppError(nullptr); }');
        if (fallback !== undefined) lines.push(`    return ${fallback};`);
        lines.push('}');
        lines.push('');
      });
    });
  });
  return lines.join('\n');
}

/** 包装函数捕获异常后的确定性兜底返回值（保证不把未初始化值往外传）。 */
function cppSourceFallbackReturn(cppType: string): string | undefined {
  switch (cppType) {
    case 'void': return undefined;
    case 'bool': return 'false';
    case 'const wchar_t*': return 'L""';
    case 'double': return '0.0';
    case 'float': return '0.0f';
    default: return '0';
  }
}

/** 中文命令名作为转发函数名：替换非法字符为下划线（与生成器 toCppIdentifier 同口径的最小实现）。 */
function toLocalCppIdentifier(name: string): string {
  return name.replace(/[^\w一-龥]/gu, '_');
}

/** 异常捕获运行时（自包含标准 C++：thread_local 槽位 + 自带 UTF-8 → 宽字符转换，不依赖 Windows 头）。 */
const EXCEPTION_RUNTIME_BLOCK = [
  'inline std::wstring& LB_CppSrcLastErrorSlot() {',
  '    thread_local std::wstring lbError;',
  '    return lbError;',
  '}',
  '',
  'inline std::wstring LingBuilderCppSrcUtf8ToWide(const char* lbText) {',
  '    std::wstring lbOut;',
  '    if (!lbText) return lbOut;',
  '    const unsigned char* lbBytes = reinterpret_cast<const unsigned char*>(lbText);',
  '    int lbIndex = 0;',
  '    while (lbBytes[lbIndex] != 0) {',
  '        unsigned int lbCodePoint = 0;',
  '        unsigned char lbLead = lbBytes[lbIndex];',
  '        int lbExtra = 0;',
  '        if (lbLead < 0x80) { lbCodePoint = lbLead; }',
  '        else if ((lbLead & 0xE0) == 0xC0) { lbCodePoint = lbLead & 0x1Fu; lbExtra = 1; }',
  '        else if ((lbLead & 0xF0) == 0xE0) { lbCodePoint = lbLead & 0x0Fu; lbExtra = 2; }',
  '        else if ((lbLead & 0xF8) == 0xF0) { lbCodePoint = lbLead & 0x07u; lbExtra = 3; }',
  '        else { lbIndex += 1; continue; }',
  '        lbIndex += 1;',
  '        bool lbValid = true;',
  '        for (int i = 0; i < lbExtra; ++i) {',
  '            unsigned char lbCont = lbBytes[lbIndex];',
  '            if ((lbCont & 0xC0) != 0x80) { lbValid = false; break; }',
  '            lbCodePoint = (lbCodePoint << 6) | (lbCont & 0x3Fu);',
  '            lbIndex += 1;',
  '        }',
  '        if (!lbValid) continue;',
  '        if (lbCodePoint < 0x10000) lbOut.push_back(static_cast<wchar_t>(lbCodePoint));',
  '        else {',
  '            lbCodePoint -= 0x10000;',
  '            lbOut.push_back(static_cast<wchar_t>(0xD800u + (lbCodePoint >> 10)));',
  '            lbOut.push_back(static_cast<wchar_t>(0xDC00u + (lbCodePoint & 0x3FFu)));',
  '        }',
  '    }',
  '    return lbOut;',
  '}',
  '',
  'inline void LB_CppSrcRecordCppError(const char* lbText) {',
  '    LB_CppSrcLastErrorSlot() = lbText ? LingBuilderCppSrcUtf8ToWide(lbText) : std::wstring(L"未知 C++ 异常。");',
  '}',
  '',
  'inline std::wstring LB_CppSrcTakeError() {',
  '    std::wstring lbResult = std::move(LB_CppSrcLastErrorSlot());',
  '    return lbResult;',
  '}'
].join('\n');

/** 参数序列化片段：处理器参数带内联签名（`处理器 名(类型 名, ...) [回传 类型] [界面线程]`）。 */
const serializeCppParameterText = (parameter: LingCppParameter): string => {
  if (parameter.type === '处理器') {
    const signature = (parameter.handlerSignatureParameters || [])
      .map(signatureParameter => `${signatureParameter.type} ${signatureParameter.name}${signatureParameter.byRef ? ' 传址' : ''}`)
      .join(', ');
    const returnType = parameter.handlerReturnType ? ` 回传 ${parameter.handlerReturnType}` : '';
    const marshal = parameter.handlerMarshalUiThread ? ' 界面线程' : '';
    return `处理器 ${parameter.name}(${signature})${returnType}${marshal}`;
  }
  const byRef = parameter.byRef ? ' 传址' : '';
  const note = parameter.note ? ` // ${parameter.note}` : '';
  return `${parameter.type} ${parameter.name}${byRef}${note}`;
};

/** 单条 C++ 源码命令的声明行序列（声明行 + 备注 + 公开标记），供整库与单命令序列化共用。 */
const serializeCppSourceCommandLines = (command: LingCppCppSourceCommand): string[] => {
  const parameters = command.parameters.map(serializeCppParameterText).join(', ');
  const alias = command.cppName ? ` = ${command.cppName}` : '';
  const lines = [`  ${command.returnType} ${command.name}(${parameters})${alias}`];
  if (command.remark) lines.push(`  备注: ${command.remark}`);
  if (command.isPublic === false) lines.push('  公开 = 假');
  return lines;
};

/** 类方法行序列（带 `方法 ` 前缀，序列化结构缺一不可——结构化编辑器写回靠它保字段）。 */
const serializeCppClassMethodLines = (method: LingCppCppClassMethod): string[] => {
  const parameters = method.parameters.map(serializeCppParameterText).join(', ');
  const alias = method.cppName ? ` = ${method.cppName}` : '';
  const lines = [`    方法 ${method.returnType} ${method.name}(${parameters})${alias}`];
  if (method.remark) lines.push(`      备注: ${method.remark}`);
  if (method.isPublic === false) lines.push('      公开 = 假');
  return lines;
};

/** 序列化 C++ 源码库为声明源码（结构化编辑器的写回通道）。 */
export function serializeProjectCppSourceLibraries(packageName: string, cppLibraries: LingCppCppSourceLibrary[]): string {
  const lines: string[] = [`包 ${packageName}`];
  cppLibraries.forEach(library => {
    lines.push('', `C++源码库 ${library.name}`);
    if (library.exceptionCapture) lines.push('  异常 = 捕获');
    if (library.namespaceName) lines.push(`  命名空间 = ${library.namespaceName}`);
    library.sourceFiles.forEach(file => {
      lines.push(`  源码 = ${file.relativePath}`);
    });
    library.headerFiles.forEach(file => {
      lines.push(`  头文件 = ${file.relativePath}`);
    });
    library.includeDirs.forEach(file => {
      lines.push(`  包含目录 = ${file.relativePath}`);
    });
    if ((library.sourceFiles.length > 0 || library.headerFiles.length > 0 || library.includeDirs.length > 0 || library.exceptionCapture) && (library.classes.length > 0 || library.structs.length > 0 || library.commands.length > 0)) {
      lines.push('');
    }
    library.classes.forEach(classItem => {
      lines.push(`  类 ${classItem.name} = ${classItem.cppName}`);
      classItem.methods.forEach(method => {
        // 无方法名的模型行写回即丢：跳过，由编辑器入口与诊断兜住非空。
        if (!method.name.trim()) return;
        lines.push(...serializeCppClassMethodLines(method));
      });
      lines.push('  结束类');
    });
    if (library.classes.length > 0 && (library.structs.length > 0 || library.commands.length > 0)) {
      lines.push('');
    }
    library.structs.forEach(structItem => {
      lines.push(`  结构体 ${structItem.name} = ${structItem.cppName}`);
      structItem.fields.forEach(field => {
        // 无字段名的模型行写回即丢：跳过，由编辑器入口与诊断兜住非空（与命令名同口径）。
        if (!field.name.trim()) return;
        lines.push(`    ${field.type} ${field.name}${field.note ? ` // ${field.note}` : ''}`);
      });
      lines.push('  结束结构体');
    });
    if (library.structs.length > 0 && library.commands.length > 0) {
      lines.push('');
    }
    library.commands.forEach(command => {
      // 无命令名的模型序列化出来是解析器不认的死行，写出即丢：跳过它，
      // 让文件内容与表格模型保持一致，命令名非空由编辑器入口和诊断负责兜住。
      if (!command.name.trim()) return;
      lines.push(...serializeCppSourceCommandLines(command));
    });
    lines.push('结束C++源码库');
  });
  return lines.join('\n') + '\n';
}

/** 「复制此命令」产出的裸命令声明片段（无 C++源码库 包裹），粘贴时并入目标项目的当前库。 */
export function serializeCppSourceCommandSnippet(command: LingCppCppSourceCommand): string {
  return serializeCppSourceCommandLines(command)
    .map(line => line.replace(/^ {2}/u, ''))
    .join('\n') + '\n';
}

/** 裸声明片段兜底解析时使用的临时库名，不会写回用户源码。 */
const PASTED_CPP_SNIPPET_LIBRARY_NAME = '粘贴片段';

/**
 * 解析剪贴板中的 C++ 源码命令声明。优先按 `C++源码库 … 结束C++源码库` 整库块解析；
 * 识别不到时把文本包进临时库按「裸命令声明」再解析一次，`bare` 为真表示调用方应把命令
 * 并入当前库，而不是新建一个名为临时库的库。
 */
export function parseCppSourceDeclarationSnippet(text: string): { libraries: LingCppCppSourceLibrary[]; bare: boolean } {
  const withCommands = (source: string) =>
    (parseLingCpp(source).program.cppLibraries || []).filter(library => library.commands.length > 0);
  const wholeLibraries = withCommands(text);
  if (wholeLibraries.length > 0) return { libraries: wholeLibraries, bare: false };
  const bare = withCommands(`包 粘贴片段\nC++源码库 ${PASTED_CPP_SNIPPET_LIBRARY_NAME}\n${text}\n结束C++源码库`);
  return bare.length > 0 ? { libraries: bare, bare: true } : { libraries: [], bare: false };
}

/** 头文件解析返回值/参数类型 → 中文类型的映射表（与源码库类型白名单一致）。 */
const CPP_HEADER_RETURN_TYPE_MAP: Array<[RegExp, string]> = [
  [/^const\s+wchar_t\s*\*$/u, '文本型'],
  [/^wchar_t\s*\*$/u, '文本型'],
  [/^const\s+std::wstring$/u, '文本型'],
  [/^std::wstring$/u, '文本型'],
  [/^uintptr_t$/u, '指针整数'],
  [/^size_t$/u, '指针整数'],
  [/^unsigned\s+long\s+long$/u, '长整数型'],
  [/^long\s+long$/u, '长整数型'],
  [/^int$/u, '整数型'],
  [/^double$/u, '小数型'],
  [/^float$/u, '单精度小数型'],
  [/^bool$/u, '逻辑型'],
  [/^unsigned\s+char$/u, '字节型'],
  [/^void$/u, '空']
];

const cppHeaderTypeToChinese = (typeText: string): string | undefined => {
  const normalized = typeText.replace(/\s+/gu, ' ').trim();
  for (const [pattern, chinese] of CPP_HEADER_RETURN_TYPE_MAP) {
    if (pattern.test(normalized)) return chinese;
  }
  return undefined;
};

/**
 * 从 .h 头文件文本解析声明行，生成 C++ 源码库声明初稿。
 * 类型限定为源码库白名单的 C++ 写法；带模板/引用出参等复杂签名直接跳过（导入是初稿，用户再手补）。
 */
export function parseCppHeaderDeclarations(headerText: string): LingCppCppSourceCommand[] {
  const joined = headerText
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/\/\/.*$/u, '').trim())
    .join(' ');
  const typeAlternation = [
    'const\\s+wchar_t\\s*\\*',
    'wchar_t\\s*\\*',
    'const\\s+std::wstring',
    'std::wstring',
    'uintptr_t',
    'size_t',
    'unsigned\\s+long\\s+long',
    'unsigned\\s+char',
    'long\\s+long',
    'int',
    'double',
    'float',
    'bool',
    'void'
  ].join('|');
  const declarationRe = new RegExp(
    `(?:extern\\s+"C"\\s+)?(?:__declspec\\s*\\([^)]*\\)\\s*)?(${typeAlternation})(?:\\s*(?:__cdecl|__stdcall))?\\s*([*&])?\\s+\\*?\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\(([^()]*)\\)`,
    'gu'
  );
  const parameterRe = new RegExp(`(${typeAlternation})(?:\\s*([*&]))?\\s*\\*?\\s*([A-Za-z_][A-Za-z0-9_]*)?`, 'gu');
  const commands: LingCppCppSourceCommand[] = [];
  let match: RegExpExecArray | null;
  while ((match = declarationRe.exec(joined)) !== null) {
    const chineseReturn = cppHeaderTypeToChinese(match[1] || '');
    const name = match[3] || '';
    if (!chineseReturn || !name) continue;
    const parameters: LingCppParameter[] = [];
    const parameterText = (match[4] || '').trim();
    if (parameterText && parameterText !== 'void') {
      // 按顶层逗号切分（白名单类型不含逗号；vector/模板参数直接整段跳过）。
      const pieces = parameterText.split(/[,，]/u).map(piece => piece.trim()).filter(Boolean);
      pieces.forEach((piece, index) => {
        if (piece.includes('<') || piece.includes('[')) return; // 模板/数组参数：初稿跳过，留用户手补。
        let parameterMatch: RegExpExecArray | null;
        parameterRe.lastIndex = 0;
        parameterMatch = parameterRe.exec(piece);
        if (!parameterMatch) return;
        const chineseType = cppHeaderTypeToChinese(parameterMatch[1] || '');
        if (!chineseType) return;
        const isReference = (parameterMatch[2] || '') === '&' && chineseType !== '文本型';
        const parameter: LingCppParameter = {
          name: parameterMatch[3] || `参数${index + 1}`,
          type: chineseType
        };
        // 指针形参无法区分「输出传址」与「缓冲区」：除文本型外一律按传址初稿，用户可取消。
        if ((parameterMatch[2] || '') === '*' && chineseType !== '文本型') parameter.byRef = true;
        if (isReference) parameter.byRef = true;
        parameters.push(parameter);
      });
      // 有参数解析不出来时整条跳过：残缺签名生成的调用必然 LNK2019，比缺这条命令更误导。
      if (parameters.length !== pieces.length) continue;
    }
    commands.push({
      name,
      returnType: chineseReturn,
      parameters,
      cppName: name,
      line: commands.length + 1
    });
  }
  return commands;
}
