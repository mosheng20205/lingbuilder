/**
 * 生成 OP 后台图色模块（lingbuilder.op）的生成器注入运行时。
 *
 * 组成：
 *   1. 手写核心：electron/native/op/lb_op_runtime_core.cpp
 *      （错误处理 + 214 个中文命令包装函数，函数名 = bindings.runtimeName）
 *   2. 生成互操作层：从 electron/native/op/op_c_api.h（上游 0.4.8.3 钉版）解析
 *      全部 OP_C_API 导出，产出函数指针 typedef + 指针表 + LoadLibrary 加载器，
 *      替换核心中的 //@generated-interop@ 标记行注入。
 *
 * 交叉校验（任一失败即拒绝生成）：
 *   * 头文件解析出的导出数必须等于 214（钉版漂移立即阻断）；
 *   * 核心中的包装函数名集合必须与 opModules.ts 的 bindings.runtimeName 完全一致；
 *   * 最终 C++ 不得含反引号与美元符号花括号序列（String.raw 注入安全）。
 *
 * `--check` 模式比对现有 src/services/windowDesigner/opRuntime.ts 是否漂移。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OP_MODULE, OP_UPSTREAM_VERSION } from '../src/services/modules/opModules';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // electron/
const headerPath = path.join(root, 'native', 'op', 'op_c_api.h');
const corePath = path.join(root, 'native', 'op', 'lb_op_runtime_core.cpp');
const outPath = path.join(root, 'src', 'services', 'windowDesigner', 'opRuntime.ts');
const MARKER = '//@generated-interop@';
/** 上游 0.4.8.3 的全部 C API 导出数（含未导出的 OpSetOcrEngine：互操作层加载它，命令面不暴露）。 */
const EXPECTED_EXPORT_COUNT = 214;

interface OpExport {
  name: string;
  returnType: string;
  params: string;
}

/** binding 参数 → 包装函数 C++ 形参类型（同名末 token），与 lb_op_runtime_core.cpp 的手写签名一一对应。 */
function signatureTypeOf(parameter: { type?: string; byRef?: boolean }): string {
  const type = parameter.type || '';
  if (parameter.byRef) {
    if (type === 'int') return 'int*';
    if (type === 'longLong') return 'long long*';
    if (type === 'float') return 'float*';
    if (type === 'double') return 'double*';
    if (type === 'int*') return 'int*';
  }
  switch (type) {
    case 'OP句柄':
    case 'longLong':
      return 'long long';
    case 'int':
      return 'int';
    case 'wideString':
      return 'const wchar_t*';
    case 'bool':
      return 'bool';
    case 'double':
      return 'double';
    case 'float':
      return 'float';
    case 'bytes':
      return 'const std::vector<unsigned char>&';
    default:
      return type;
  }
}

function parseHeaderExports(headerText: string): OpExport[] {
  const joined = headerText.replace(/\r/g, '').replace(/\n\s+/g, ' ');
  const re = /OP_C_API\s+([\w\s\*]+?)\s*OP_CALL\s+(\w+)\s*\(([^)]*)\)\s*;/g;
  const exports: OpExport[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(joined))) {
    const returnType = (match[1] || '').replace(/\s+/g, ' ').trim().replace(/\s*\*\s*/g, '*');
    const name = (match[2] || '').trim();
    const params = (match[3] || '').replace(/\s+/g, ' ').trim().replace(/\s*\*\s*/g, '*');
    if (!name || name === 'OP_CALL') continue;
    exports.push({ name, returnType, params });
  }
  return exports;
}

function normalizeType(type: string): string {
  // 参数串是「类型 + 形参名」整体（如 "op_handle handle"），按前缀替换类型部分。
  return type === 'op_handle' ? 'void*' : type.replace(/^op_handle\b/, 'void*');
}

function splitTopLevel(params: string): string[] {
  if (!params || params === 'void') return [];
  return params.split(',').map(part => part.trim()).filter(Boolean);
}

/** x86 stdcall 装饰名的栈字节数：64 位类型 8 字节，其余（含指针）一律 4 字节。 */
function x86StdcallBytes(params: string): number {
  return splitTopLevel(params).reduce((total, param) => {
    const type = param.split(/\s+/)[0] || '';
    if (type === 'double' || type === 'int64_t' || type === 'unsigned long long' || type === 'long long') return total + 8;
    return total + 4;
  }, 0);
}

function renderInterop(exportList: OpExport[]): string {
  const typedefs: string[] = [];
  const pointers: string[] = [];
  const loaders: string[] = [];
  const checkers: string[] = [];
  for (const item of exportList) {
    const paramList = splitTopLevel(item.params)
      .map(param => normalizeType(param))
      .join(', ');
    typedefs.push(`typedef ${normalizeType(item.returnType)} (__stdcall *fn_${item.name})(${paramList});`);
    pointers.push(`inline fn_${item.name} p_${item.name} = nullptr;`);
    // x86 stdcall 导出带装饰名（_Name@栈字节），x64 无装饰；加载器两个名字都试。
    loaders.push(`LBOP_LOAD(${item.name}, "_${item.name}@${x86StdcallBytes(item.params)}")`);
    checkers.push(`LBOP_CHECK(${item.name})`);
  }
  return `// ============================================================================
// 以下互操作层（函数指针 typedef + 指针表 + 加载器）由 scripts/generate-op-runtime.ts
// 从 native/op/op_c_api.h（上游 ${OP_UPSTREAM_VERSION} 钉版）自动生成，禁止手改。
// 升级上游版本必须重跑 M0/M3 全套回归并同步 third_party/op/NOTICE.md 基线。
// ============================================================================

${typedefs.join('\n')}

${pointers.join('\n')}

namespace impl {

inline bool loadAll() {
#ifdef _WIN64
    const wchar_t* dllName = L"op_c_api_x64.dll";
#else
    const wchar_t* dllName = L"op_c_api_x86.dll";
#endif
    wchar_t exePath[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring exeDir(exePath);
    const size_t lastSlash = exeDir.find_last_of(L'\\\\');
    if (lastSlash != std::wstring::npos) exeDir.resize(lastSlash);
    const std::wstring fullPath = exeDir + L"\\\\" + dllName;
    HMODULE module = LoadLibraryW(fullPath.c_str());
    if (!module) module = LoadLibraryW(dllName);
    if (!module) {
        g_loadError = std::wstring(L"无法加载随包运行库 ") + dllName + L"（应与 exe 同目录，构建时会自动复制）。";
        return false;
    }
    // 运行库常驻不卸载：内部工作线程无法安全停止，卸载必然崩溃。
    // x86 stdcall 导出是 _Name@N 装饰名（dumpbin 实证），x64 是裸名；两个都试。
    auto lbopGetProc = [](HMODULE m, const char* plain, const char* decorated) -> FARPROC {
        FARPROC proc = ::GetProcAddress(m, plain);
        return proc ? proc : ::GetProcAddress(m, decorated);
    };
#define LBOP_LOAD(fn, deco) p_##fn = reinterpret_cast<fn_##fn>(reinterpret_cast<void*>(lbopGetProc(module, #fn, deco)));
${loaders.join('\n')}
#undef LBOP_LOAD
    std::wstring missing;
#define WIDEN2(x) L##x
#define WIDEN(x) WIDEN2(x)
#define LBOP_CHECK(fn) if (!p_##fn) { if (!missing.empty()) missing += L", "; missing += WIDEN(#fn); }
${checkers.join('\n')}
#undef LBOP_CHECK
#undef WIDEN
#undef WIDEN2
    if (!missing.empty()) {
        g_loadError = L"随包运行库版本不匹配，缺少导出：" + missing + L"。请重新安装 LingBuilder 或反馈客服。";
        return false;
    }
    return true;
}

} // namespace impl
`;
}

function buildRuntime(): string {
  const headerText = fs.readFileSync(headerPath, 'utf8');
  const coreText = fs.readFileSync(corePath, 'utf8').replace(/\r\n/g, '\n');
  const exportList = parseHeaderExports(headerText);
  if (exportList.length !== EXPECTED_EXPORT_COUNT) {
    throw new Error(`op_c_api.h 解析出 ${exportList.length} 个导出，期望 ${EXPECTED_EXPORT_COUNT}（钉版漂移，禁止生成）`);
  }
  const exportNames = new Set(exportList.map(item => item.name));
  if (exportNames.size !== exportList.length) throw new Error('op_c_api.h 存在重复导出名');

  const markerIndex = coreText.indexOf(MARKER);
  if (markerIndex < 0) throw new Error('核心源码缺少 //@generated-interop@ 标记行');
  const partB = coreText.slice(markerIndex + MARKER.length);

  const wrapperNames = new Set<string>();
  const wrapperRe = /inline\s+(?:bool|int|void|float|double|long long|std::wstring)\s+(后台_[\p{L}\p{N}_]+)\s*\(/gu;
  let wrapperMatch: RegExpExecArray | null;
  while ((wrapperMatch = wrapperRe.exec(partB))) wrapperNames.add(wrapperMatch[1] || '');

  const bindingNames = new Set<string>(OP_MODULE.bindings.commands.map(command => command.runtimeName));
  const missingWrappers = [...bindingNames].filter(name => !wrapperNames.has(name));
  const extraWrappers = [...wrapperNames].filter(name => !bindingNames.has(name));
  if (missingWrappers.length || extraWrappers.length) {
    throw new Error(`包装函数与 bindings.runtimeName 不一致：缺包装 [${missingWrappers.join(', ')}] 多包装 [${extraWrappers.join(', ')}]`);
  }
  if (wrapperNames.size !== bindingNames.size) throw new Error('包装函数数量与 bindings 数量不一致');

  // 签名级交叉校验：包装函数 C++ 形参必须与 binding 参数逐位一致（类型映射见 signatureTypeOf）。
  const bindingByRuntimeName = new Map(OP_MODULE.bindings.commands.map(command => [command.runtimeName, command]));
  const signatureRe = /inline\s+(?:bool|int|void|float|double|long long|std::wstring)\s+(后台_[\p{L}\p{N}_]+)\s*\(([^)]*)\)\s*\{/gu;
  const signatureMismatches: string[] = [];
  while ((wrapperMatch = signatureRe.exec(partB))) {
    const name = wrapperMatch[1] || '';
    const binding = bindingByRuntimeName.get(name);
    if (!binding) continue;
    const wrapperParams = (wrapperMatch[2] || '').split(',').map(part => part.trim()).filter(Boolean).map(part => {
      const tokens = part.split(/\s+/);
      return tokens.length > 1 ? tokens.slice(0, -1).join(' ') : (tokens[0] || '');
    });
    const bindingParams = binding.parameters || [];
    if (wrapperParams.length !== bindingParams.length) {
      signatureMismatches.push(`${name}: 包装 ${wrapperParams.length} 参 vs binding ${bindingParams.length} 参`);
      continue;
    }
    for (let index = 0; index < bindingParams.length; index += 1) {
      const wrapperType = wrapperParams[index] || '';
      const expected = signatureTypeOf(bindingParams[index] || ({} as { type?: string; byRef?: boolean }));
      if (wrapperType !== expected) signatureMismatches.push(`${name} 第 ${index + 1} 参：包装 ${wrapperType} vs binding 应为 ${expected}`);
    }
  }
  if (signatureMismatches.length) {
    throw new Error(`包装函数签名与 binding 不一致：\n${signatureMismatches.join('\n')}`);
  }

  const runtime = coreText.slice(0, markerIndex) + renderInterop(exportList) + partB;
  if (runtime.includes('`') || runtime.includes('${')) {
    throw new Error('OP 运行时源码含反引号或美元符号花括号序列，String.raw 注入不安全');
  }
  // 导出的未暴露命令 OpSetOcrEngine 不在命令面：互操作层仍加载它的函数指针（无害），
  // 但不得出现后端_ 包装，上面的集合校验已保证。
  return runtime;
}

function render(runtime: string): string {
  return `/**
 * OP 后台图色模块（lingbuilder.op）生成器注入运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/op/lb_op_runtime_core.cpp + op_c_api.h（上游 ${OP_UPSTREAM_VERSION} 钉版）
 * 再生命令：npm run op:runtime（--check 模式供门禁）
 * 注入点：lingCppWin32Project.ts 中 generateOpRuntime(enabledModules)，
 * 模块启用时拼进生成的 C++ 工程（Win32 与 new_emoji 双后端一致）。
 * 运行库 op_c_api_x64.dll / op_c_api_x86.dll 由 materializeOpRuntime 按架构复制到 exe 同目录。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const OP_RUNTIME_MODULE_ID = '${OP_MODULE.id}';

export const OP_RUNTIME = String.raw\`${runtime}\`;

/** 模块启用时返回运行时源码，未启用返回空串。 */
export function generateOpRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === OP_RUNTIME_MODULE_ID) ? OP_RUNTIME : '';
}
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const runtime = buildRuntime();
  const moduleTs = render(runtime);
  if (check) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (existing !== moduleTs) {
      console.error('opRuntime.ts 与 native 源码/命令面漂移：请运行 npm run op:runtime 重新生成');
      process.exit(1);
    }
    console.log('opRuntime.ts 无漂移');
    return;
  }
  fs.writeFileSync(outPath, moduleTs, 'utf8');
  console.log(`opRuntime.ts 已生成：${OP_MODULE.bindings.commands.length} 条命令，互操作层 ${EXPECTED_EXPORT_COUNT} 个函数指针`);
}

main();
