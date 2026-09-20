import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getLingCppCompletions, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { ARIA2_COMMAND_SPECS, ARIA2_MODULE, ARIA2_MODULE_ID } from '../src/services/modules/aria2Module';
import { CEF3_BROWSER_EVENTS } from '../src/services/modules/cef3BrowserEvents';
import { CEF3_SAFE_API_CATALOG } from '../src/services/modules/cef3SafeApiCatalog.generated';
import { EDGEVIEW_BROWSER_EVENTS, EDGEVIEW_COMPOSITION_ONLY_EVENTS } from '../src/services/modules/edgeViewBrowserEvents';
import { EDGEVIEW_SAFE_API_CATALOG, validateEdgeViewApiCatalog } from '../src/services/modules/edgeViewApiCatalog';
import { EDGEVIEW_SAFE_API_NATIVE_MEMBERS } from '../src/services/windowDesigner/edgeViewRuntime';
import { FBRO_EVENT_CATALOG, FBRO_PUBLIC_BROWSER_EVENTS } from '../src/services/modules/fbroEventCatalog';
import { FBRO_VIP_API_CATALOG, generateFbroVipIndividualRuntime } from '../src/services/modules/fbroVipApiCatalog';
import { STANDARD_LIBRARY_MODULES } from '../src/services/modules/standardLibraryModules';
import { SYSTEM_LIBRARY_MODULES } from '../src/services/modules/systemLibraryModules';
import { DISK_COMMAND_NAMES, DISK_PUBLIC_TYPES } from '../src/services/modules/diskApiCatalog';
import { KEYBOARD_COMMAND_NAMES } from '../src/services/modules/keyboardApiCatalog';
import { MOUSE_COMMAND_NAMES } from '../src/services/modules/mouseApiCatalog';
import { NETWORK_LIBRARY_MODULES } from '../src/services/modules/networkLibraryModules';
import { DATA_MEDIA_MODULES } from '../src/services/modules/dataMediaModules';
import { PLATFORM_ADVANCED_MODULES } from '../src/services/modules/platformAdvancedModules';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { auditControlReferenceManifests } from '../src/services/modules/controlReferenceAuditService';
import { createModuleService } from '../src/services/modules/moduleService';
import {
  ModuleDocumentationError,
  readModuleDocumentation
} from '../src/services/modules/moduleDocumentationService';
import { normalizeModulePublicInfoSearchText } from '../src/services/modules/modulePublicInfoSearch';
import {
  CEF3_ADVANCED_MODULE_IDS,
  CEF3_MODULE_FAMILY,
  CEF3_STANDARD_MODULE_IDS,
  countModuleCommands,
  FBRO_ADVANCED_MODULE_IDS,
  FBRO_MODULE_FAMILY,
  FBRO_STANDARD_MODULE_IDS,
  OPENCV_MODULE_FAMILY,
  getFbroFamilyModules,
  getModuleFamilyModules,
  getModuleFamilySearchText,
  isFbroStandardFamilyEnabled,
  isModuleFamilyStandardEnabled,
  isModuleHiddenByFamily
} from '../src/services/modules/moduleFamilies';
import { createMarketIndex, importAiModuleFiles, migrateCppModule, validateModuleDirectory } from '../src/services/modules/moduleSdkService';
import { getPreferredModuleTarget } from '../src/services/modules/targetResolver';
import {
  describeLingCppModuleContextForAi,
  getBeginnerModuleCodeCompletions,
  getBeginnerModuleCommandHints
} from '../src/services/modules/moduleContextAdapters';
import { InstalledModule } from '../src/services/modules/types';
import { EDGEVIEW_WEBVIEW2_SDK_VERSION, exportModuleNativeDependencies, inferWorkspaceRootFromBuildDir, materializeModuleNativeDependencies, peExportProbe } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { createControlToolboxGroups } from '../src/services/windowDesigner/controlToolboxModel';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { createWindowsMsvcLinkLibraries } from '../src/services/windowDesigner/windowsSystemLibraries';
import { OPENCV_COMMAND_NAMES, OPENCV_MODULE_ID, OPENCV_SDK_MODULE_ID } from '../src/services/modules/opencvModules';
import { normalizeControlReferenceCallSnippet } from '../src/services/modules/bindingValueType';
import { getEnabledModuleStructuredTypeDiagnostics } from '../src/services/modules/modulePublicTypeService';
import { THREADING_COMMAND_SPECS, THREADING_LEGACY_COMMANDS } from '../src/services/modules/threadingModule';
import { HTTP_SERVER_COMMAND_SPECS } from '../src/services/modules/httpServerModule';
import { WEBSOCKET_CLIENT_COMMAND_SPECS } from '../src/services/modules/webSocketClientModule';
import { WEBSOCKET_SERVER_COMMAND_SPECS } from '../src/services/modules/webSocketServerModule';
import { normalizeControlReferenceSourceLiterals } from '../scripts/lib/control-reference-source-audit';
import { getWin32RuntimeControlContracts } from '../src/services/windowDesigner/win32ControlRegistry';
import { getLingCppControlReferenceDiagnostics } from '../src/services/lingCpp/controlReferenceService';
import { generateFbroBrowserManagerRuntime } from '../src/services/windowDesigner/fbroBrowserManagerRuntime';
import { generateAria2Runtime } from '../src/services/windowDesigner/aria2Runtime';

const sampleProject: LingWindowProject = {
  id: 'module-test-project',
  name: '模块测试项目',
  windows: [
    {
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#202020',
      description: '主窗口',
      controls: []
    }
  ]
};

const execFileAsync = promisify(execFile);

test('FBro 多浏览器示例使用分组框承载三个浏览器控件', async () => {
  const workspaceRoot = path.resolve(process.cwd(), '..');
  const exampleRoot = path.join(workspaceRoot, 'examples', 'fbro-multi-browser-demo');
  const designer = JSON.parse(await fs.readFile(path.join(exampleRoot, 'src', '.lingbuilder', 'window-designer.json'), 'utf8')) as {
    windows: Array<{ controls: Array<{ type: string; parentId?: string; id: string }> }>;
  };
  const controls = designer.windows[0]?.controls || [];
  const groupBoxes = controls.filter(control => control.type === 'GroupBox');
  const browsers = controls.filter(control => control.type === 'FBroBrowser');
  assert.equal(groupBoxes.length, 3);
  assert.equal(browsers.length, 3);
  assert.ok(browsers.every(browser => browser.parentId && groupBoxes.some(group => group.id === browser.parentId)));
  assert.match(await fs.readFile(path.join(exampleRoot, 'src', 'FBro多浏览器示例.lcpp'), 'utf8'), /FBro_导航\(浏览器[123]/u);
});

test('FBro 模块文档声明安装、控件和示例专题且文件存在', async () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.fbro.browser');
  const docs = manifest?.contributes?.docs || [];
  const expected = [
    'docs/modules/fbro/README.md',
    'docs/modules/fbro/installation.md',
    'docs/modules/fbro/control.md',
    'docs/modules/fbro/examples.md'
  ];
  assert.deepEqual(docs.map(doc => doc.path), expected);
  for (const relativePath of expected) {
    await fs.access(path.resolve(process.cwd(), relativePath));
  }
  const readme = await fs.readFile(path.resolve(process.cwd(), 'docs/modules/fbro/README.md'), 'utf8');
  assert.match(readme, /SDK 安装与环境检查/u);
  assert.match(readme, /FBroBrowser 控件与进程模式/u);
  assert.match(readme, /多浏览器分组框示例/u);
});

test('Aria2 内置模块的清单、文档、生成运行时和原生资产保持一致', async t => {
  if (process.platform !== 'win32') {
    t.skip('Aria2 首版只支持 Windows x64。');
    return;
  }
  assert.equal(validateModuleManifest(ARIA2_MODULE).diagnostics.length, 0);
  assert.equal(ARIA2_MODULE.targets?.map(target => target.id).join(','), 'windows-msvc-x64');
  assert.deepEqual(
    ARIA2_MODULE.bindings?.commands?.map(binding => binding.command),
    ARIA2_MODULE.contributes?.commands?.map(command => command.name)
  );
  assert.deepEqual(ARIA2_COMMAND_SPECS.map(command => command.name), [
    'Aria2_下载', 'Aria2_等待', 'Aria2_取状态', 'Aria2_取进度',
    'Aria2_取已下载字节', 'Aria2_取总字节', 'Aria2_取错误', 'Aria2_取下载速度',
    'Aria2_取保存目录', 'Aria2_打开目录', 'Aria2_停止', 'Aria2_释放'
  ]);
  const downloadBinding = ARIA2_MODULE.bindings?.commands?.find(binding => binding.command === 'Aria2_下载');
  const progressHandler = downloadBinding?.parameters?.[5];
  assert.equal(progressHandler?.type, 'handler');
  assert.equal(progressHandler?.optional, true);
  assert.deepEqual(progressHandler?.handlerSignature, {
    parameterTypes: ['Aria2任务', '整数型', '长整数型', '长整数型', '长整数型', '文本型'],
    returnType: '空'
  });
  const module: InstalledModule = {
    manifest: ARIA2_MODULE,
    installPath: `builtin://${ARIA2_MODULE_ID}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const manual = await readModuleDocumentation(module, 'docs/modules/aria2/README.md', {
    workspaceRoot: process.cwd(),
    resourceRoot: process.cwd()
  });
  assert.match(manual.content, /GPLv2|GNU GPL/u);
  assert.match(manual.content, /Aria2_取下载速度/u);
  assert.match(manual.content, /Aria2_取保存目录/u);
  assert.match(manual.content, /Aria2_打开目录/u);
  assert.match(manual.content, /下载进度处理器/u);
  const example = await fs.readFile(path.join(process.cwd(), 'docs/modules/aria2/examples/basic.lcpp'), 'utf8');
  assert.match(example, /Aria2_下载/u);
  assert.match(example, /&下载进度/u);
  const runtime = generateAria2Runtime([module]);
  assert.match(runtime, /CreateProcessW/u);
  assert.match(runtime, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/u);
  assert.match(runtime, /ShellExecuteW/u);
  assert.match(runtime, /ParseOutputDownloadSpeed/u);
  assert.match(runtime, /ProgressMessage/u);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-module-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const layout = {
    buildDir: path.join(root, 'build'),
    sourceDir: path.join(root, 'source'),
    binDir: path.join(root, 'bin'),
    exportDir: path.join(root, 'export'),
    preferredTargetId: 'windows-msvc-x64'
  };
  const plan = await materializeModuleNativeDependencies([module], layout);
  assert.deepEqual(plan.blockingDiagnostics, []);
  for (const file of ['aria2c.exe', 'COPYING', 'NOTICE.md']) {
    assert.ok(await fs.stat(path.join(layout.binDir, file)));
    assert.ok(await fs.stat(path.join(layout.exportDir, 'modules', ARIA2_MODULE_ID, 'runtime', file)));
  }
  assert.deepEqual(await exportModuleNativeDependencies([module], path.join(root, 'portable')), []);
  assert.ok(await fs.stat(path.join(root, 'portable', 'aria2c.exe')));
});

async function collectModuleSourceFilesForControlRefAudit(root: string): Promise<string[]> {
  const result: string[] = [];
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(fullPath);
    }
  };
  await walk(root);
  return result.sort();
}

test('标准库模块命令、binding、Win32/x64 target 保持完整对应', () => {
  const expectedIds = [
    'lingbuilder.std.text',
    'lingbuilder.std.array',
    'lingbuilder.std.bytes',
    'lingbuilder.std.encoding',
    'lingbuilder.std.math',
    'lingbuilder.std.datetime',
    'lingbuilder.std.regex',
    'lingbuilder.std.buffer',
    'lingbuilder.std.map',
    'lingbuilder.std.bigint',
    'lingbuilder.std.pinyin',
    'lingbuilder.std.lunar',
    'lingbuilder.data.json',
    'lingbuilder.data.xml'
  ];
  assert.deepEqual(STANDARD_LIBRARY_MODULES.map(module => module.id), expectedIds);

  for (const manifest of STANDARD_LIBRARY_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
    const bindingNames = manifest.bindings?.commands?.map(binding => binding.command) || [];
    assert.deepEqual(bindingNames, commandNames, `${manifest.id} 的命令与 binding 必须逐项对应`);
    assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-win32', 'windows-msvc-x64']);
    assert.ok(BUILTIN_MODULES.some(module => module.id === manifest.id));
  }
});

test('句柄族名义返回类型（文件号/日期时间）登记且 contributes 与 binding 类型成对', () => {
  const modules = new Map(BUILTIN_MODULES.map(module => [module.id, module]));

  const fsCore = modules.get('lingbuilder.fs.core');
  assert.ok(fsCore, '文件目录模块必须内置注册');
  assert.deepEqual(
    fsCore?.contributes?.types?.filter(type => type.name === '文件号').map(type => type.cppType),
    ['long long'],
    '文件目录模块必须登记「文件号」名义类型'
  );
  const fileOpen = fsCore?.contributes?.commands?.find(command => command.name === '文件_打开');
  const fileOpenBinding = fsCore?.bindings?.commands?.find(binding => binding.command === '文件_打开');
  assert.equal(fileOpen?.returnType, '文件号', '文件_打开 的 .lcpp 返回类型必须是 文件号');
  assert.equal(fileOpenBinding?.returnType, 'longLong', '文件_打开 的 binding ABI 类型必须是 longLong');

  const datetime = modules.get('lingbuilder.std.datetime');
  assert.ok(datetime, '日期时间模块必须内置注册');
  assert.deepEqual(
    datetime?.contributes?.types?.filter(type => type.name === '日期时间').map(type => type.cppType),
    ['long long'],
    '日期时间模块必须登记「日期时间」名义类型'
  );
  const now = datetime?.contributes?.commands?.find(command => command.name === '时间_取现行');
  const nowBinding = datetime?.bindings?.commands?.find(binding => binding.command === '时间_取现行');
  assert.equal(now?.returnType, '日期时间', '时间_取现行 的 .lcpp 返回类型必须是 日期时间');
  assert.equal(nowBinding?.returnType, 'longLong', '时间_取现行 的 binding ABI 类型必须是 longLong');

  // 句柄族：文件_打开 的可选参数必须带默认值且位于参数表尾部；变参读写命令必须按 lingValue 声明。
  const openParams = fileOpenBinding?.parameters || [];
  assert.ok(openParams.slice(1).every(parameter => parameter.optional === true), '文件_打开 只有路径是必填参数');
  const readData = fsCore?.bindings?.commands?.find(binding => binding.command === '文件_读入数据');
  const readDataVariadic = readData?.parameters?.find(parameter => parameter.variadic === true);
  assert.equal(readDataVariadic?.type, 'lingValue', '文件_读入数据 的可变参数必须是 lingValue');
  assert.equal(readDataVariadic?.byRef, true, '文件_读入数据 的可变参数必须传址以写回变量');
  const writeData = fsCore?.bindings?.commands?.find(binding => binding.command === '文件_写出数据');
  const writeDataVariadic = writeData?.parameters?.find(parameter => parameter.variadic === true);
  assert.equal(writeDataVariadic?.type, 'lingValue', '文件_写出数据 的可变参数必须是 lingValue');
});

test('全部内置方法的控件参数统一使用 controlRef、裸补全和明确运行时元数据', () => {
  const audit = auditControlReferenceManifests(BUILTIN_MODULES);
  assert.deepEqual(audit.violations, []);
  assert.deepEqual(
    {
      modules: audit.moduleCount,
      commands: audit.commandCount,
      parameters: audit.parameterCount,
      controlReferences: audit.controlReferenceCount,
      commandDigest: audit.commandDigest,
      parameterDigest: audit.parameterDigest
    },
    {
      // 基线 2026-09-09 写回：COM 自动化模块 2.0 句柄制升级，6 条命令扩展为
      // 24 条（免注册创建、OCX 宿主、事件挂接映射、类型化属性与带参方法、
      // 接口信息），新增 父窗口 controlRef 参数与文本参数白名单三项
      // （组件DLL路径、注册/注销组件路径），并补充 COM_注册组件/COM_注销组件/
      // COM_取组件路径 三条命令（对齐易语言动态注册/卸载例程）。
      // 再增删内置命令或其参数、改写命令描述时必须同步这两个摘要，否则覆盖面会无声缩小。
      // 基线 2026-09-10 写回：FBro 浏览器模块新增输入注入 5 命令（发送鼠标单击/移动/滚轮、
      // 发送按键、发送触摸事件），命令 +5、参数 +38、控件参数 +5。
      // 追加 2026-09-10 批次 2：FBro 填表补齐 16 命令（选择框/选择项/内外文本/内外代码/
      // 属性读写、元素是否存在、触发事件），命令 +16、参数 +59；填表族与易语言 22 条公开命令对齐。
      // 追加 2026-09-10 批次 3：FBro传输_生成PDF 与 FBro图像_下载阻塞变体，
      // 命令 +2、参数 +8、控件参数 +2（异步取数一句话写完）。
      // 追加 2026-09-10 批次 4：右键菜单模型——FBro菜单_* 31 条 + FBro右键参数_* 16 条，
      // 命令 +47、参数 +101（菜单句柄/参数句柄为 longLong，控件参数不变）。
      // 追加 2026-09-10 批次 5：FBro下载_* 下载项快照 16 条（transfer 6→22），
      // 下载开始/进度更新事件新增 downloadItem 受管句柄字段。
      // 追加 2026-09-10 批次 6：FBro响应_* 响应对象 19 条（objects 208→227），
      // 资源响应到达/资源加载完成事件新增 response 受管句柄字段。
      // 基线 2026-09-11 写回：新增 MySQL 数据库模块（lingbuilder.database.mysql 1.0.0），
      // 43 条命令、71 参数，全部为受管句柄/文本/数值参数，无控件参数。
      // 基线 2026-09-12 写回：新增 Excel 表格模块（lingbuilder.data.excel 1.0.0），
      // 45 条命令、97 参数，全部为受管句柄/文本/数值/布尔参数，无控件参数。
      // 基线 2026-09-12 写回：CEF3 浏览器模块新增 JS 交互三条命令
      //（CEF3_启用JS扩展 3 参数、CEF3_查询应答 3 参数、CEF3_查询应答失败 4 参数），
      // 每条的控件名为 controlRef，控件参数 +3。
      // 基线 2026-09-13 写回：网页访问模块（lingbuilder.web.http 1.1.1）转为内置模块入账，
      // 12 条命令、26 参数（异步族 6 条 + 同步族 6 条，完成处理器为 handler 参数），
      // 全部为文本/数值/布尔/字节集/handler 参数，无控件参数；写回值按当前工作区实算，
      // 已含并行会话先行入账的漂移（写回前实算 87/3343/5857，摘要 4e971704/44f3e937）。
      // 基线 2026-09-13 写回：正则表达式模块补齐 5 命令（取所有匹配/取第N个匹配/
      // 取分组/取所有分组/取匹配位置，+5 命令 +8 参数）；多线程模块 2.1.0 新增
      // 队列族 8 命令（+8 命令 +21 参数）；新增缓冲区模块（lingbuilder.std.buffer
      // 1.0.0，16 命令 +23 参数）。合计 +1 模块 +29 命令 +52 参数，无控件参数。
      // 基线 2026-09-13 追加写回（第二批）：文本处理模块 +8（分割/倒找/替换子文本/
      // 删全部空白/到全角/到半角/重复/插入，+8 命令 +18 参数）；多线程模块队列族
      // 扩多元素类型 +4（入队整数/出队整数/入队字节集/出队字节集，+10 参数）；
      // 字节集 +5（寻找/倒找/替换/插入/删除，+16 参数）；缓冲区 +1（寻找，+3 参数）。
      // 合计 +18 命令 +47 参数，无控件参数，模块数不变。
      // 基线 2026-09-14 写回：系统外壳模块（lingbuilder.system.shell）新增
      // 系统_取运行目录 命令（+1 命令，0 参数，无控件参数），返回当前运行
      // exe 所在目录（不带尾部反斜杠），对齐易语言「取运行目录」；模块数不变。
      // 基线 2026-09-16 写回（易语言支持库迁移批次）：文件目录模块 +25 命令
      //（文件流句柄族 23 条：打开/关闭/关闭全部/移动读写位置/移到文件首/移到文件尾/
      // 读入字节集/写出字节集/读入文本/写出文本/读入一行/写文本行/读入数据/写出数据/
      // 是否在文件尾/取读写位置/取长度/插入字节集/插入文本/插入文本行/删除数据/锁定/解锁；
      // 枚举族 2 条：文件_枚举/目录_枚举），+86 参数，新增「文件号」名义类型；
      // 文本处理模块 +6（取左边/取右边/码点转字符/取码点/删首空白/删尾空白），
      // 日期时间模块 +17（取现行/置现行/从文本/到文本/指定/年月日星期时分秒/增减/
      // 取间隔/取某月天数/取日期/取时间），新增「日期时间」名义类型；数学模块 +11
      //（取整/绝对取整/四舍五入/取符号/正弦/余弦/正切/反正切/自然对数/反对数/置随机种子）；
      // 字节与十六进制模块 +7（字节集_从文本/重复/分割 + 数值_到十六进制文本/到八进制文本/
      // 十六进制解析/八进制解析）。合计 +66 命令 +108 参数，无控件参数，模块数不变。
      // 基线 2026-09-16 追加写回（variadic 补标）：格式化文本/列表视图_创建行/
      // 列表视图_创建行集合 的可变参形参补 variadic: true 并按清单校验要求从 raw
      // 切换为 lingValue；命令/参数计数与命令摘要不变，仅参数摘要变化。
      // 基线 2026-09-16 再追加（SQLite 2.2 加密算法支持）：SQLite_设置加密算法
      //（+1 命令 +1 参数）、SQLite_探测加密算法（+1 命令 +2 参数）入账，无控件参数。
      // 基线 2026-09-16 追加写回（中优先级九能力·第一波）：新增 lingbuilder.std.map
      //（28 命令 44 参数）、lingbuilder.std.bigint（15 命令 25 参数）、lingbuilder.std.pinyin
      //（8 命令 12 参数）、lingbuilder.std.lunar（14 命令 19 参数），无控件参数。
      // 基线 2026-09-16 追加写回（中优先级九能力·第二波）：新增 lingbuilder.console（12 命令
      // 19 参数）、键盘模块 2.1 全局热键族（+3 命令 +3 参数）、Win32 高级控件模块打印机族
      //（+4 命令 +8 参数），无控件参数。
      // 基线 2026-09-17 追加写回（快速补缺批次）：进程管理模块 DOS 执行结果族（+2 命令 +2 参数）、
      // DNS 与 IP 模块网卡信息族（+4 命令 +2 参数）、系统外壳模块（+5 命令 +4 参数）、基础音频
      // 模块静音族（+2 命令 +1 参数），无控件参数。
      // 基线 2026-09-17 再追加写回（待办收尾批次）：新增 lingbuilder.net.pop3 邮件接收模块
      //（18 命令 28 参数）与 lingbuilder.net.imap IMAP邮件接收模块（15 命令 23 参数），无控件参数。
      // 基线 2026-09-17 内存加载批次：新增 lingbuilder.advanced.memorydll 内存加载DLL模块
      //（7 命令 12 参数），无控件参数。
      // 基线 2026-09-17 内嵌资源批次：新增 lingbuilder.resource.embed 内嵌资源模块（8 命令 7 参数），无控件参数。
      // 基线 2026-09-18 写回（进程内存扫描批次）：进程管理模块进程枚举族（+2 命令 +3 参数）、
      // 进程内存模块 1.1.0 扫描族（+7 命令 +12 参数）、系统信息模块管理员自检（+1 命令），无控件参数。
      // 基线 2026-09-18 再写回（Chromium 密文能力补缺批次）：Windows数据保护模块 +2 命令
      //（数据保护_加密字节集/解密字节集，各 1 参数，解密自动剥离 Chromium 的 "DPAPI" 前缀）、
      // 对称加密模块 +4 条裸 AEAD 命令（AES-256/AES-128-GCM 加密裸与解密裸，各 4 参数，
      // 密钥/随机数/密文全走字节集且无自描述头）、Cookie文本模块 +3 命令（导出 Netscape 与
      // EditThisCookie JSON 各 1 参数 + Cookie_取错误），合计 +9 命令 +20 参数，无控件参数。
      // 基线 2026-09-18 再写回（CSV 表格导入与按编码读取批次）：CSV 数据模块 1.1.0 +13 命令
      //（CSV_打开文件 4 参数、CSV_解析文本 3 参数、数据表_行数/列数/列名/取文本/单元格类型/
      // 取整数/取小数/取布尔/单元格为空/关闭 共 23 参数、数据表_取错误 0 参数）合计 +30 参数，
      // 新登记名义类型 表格数据（long long 句柄）；SQLite 模块 2.3.0 内置 csv 虚拟表并新增
      // SQLite_取虚拟表支持（+1 命令 +1 参数）；编码转换模块 +2 命令（编码_字节集转文本 /
      // 编码_文本转字节集，各 2 参数）；文件目录模块 文件_读取文本 补可选 编码名称 参数（+1 参数）。
      // 合计 +16 命令 +36 参数，无控件参数，模块数不变。
      // 基线 2026-09-18 再写回（EdgeView Cookie 注入批次）：lingbuilder.edgeview 1.3.0
      // 新增 EdgeView会话_置Cookie带属性（9 参数）与 EdgeView会话_批量置Cookie（2 参数），
      // 合计 +2 命令 +11 参数，控件参数 +2（两条命令首参均为 EdgeBrowser controlRef）。
      // 基线 2026-09-19 再写回（EdgeView 多店铺弹窗批次）：lingbuilder.edgeview 1.4.0
      // 新增 14 条实例编号寻址命令（创建弹窗浏览器/关闭全部实例/枚举实例JSON/置实例可见/
      // 置实例大小/取实例大小JSON/置实例标题/置用户代理实例/取用户代理实例/批量置Cookie实例/
      // 置Cookie带属性实例/删除全部Cookie实例/取Cookie实例异步/清理全部浏览数据实例异步），
      // 合计 +14 命令 +35 参数，无控件参数（全部走 实例编号 整数寻址）。
      // 基线 2026-09-19 再写回（EdgeView 弹窗独立代理）：lingbuilder.edgeview 1.5.0
      // 新增 EdgeView_创建弹窗浏览器代理（8 参数，末参 代理地址），合计 +1 命令 +8 参数。
      // 基线 2026-09-19 再写回（FBro shell 多店铺能力对齐批次）：lingbuilder.new_emoji.fbro-shell 1.3.0
      // 新增 浏览器外壳_新建独立实例代理（6 参数：稳定ID/地址/标题/缓存目录/代理地址/用户代理）；
      // 浏览器外壳_设置实例Cookie 透传 HttpOnly/Secure/Domain/Path（签名不变）。合计 +1 命令 +6 参数。
      // 基线 2026-09-19 再写回（CEF3 枚举/关闭全部公开化）：lingbuilder.cef3.browser
      // 新增 CEF3_枚举实例JSON 与 CEF3_关闭全部实例（各 0 参数，复用现有 cefBrowsers_/CEF3_关闭全部）。合计 +2 命令。
      // 基线 2026-09-19 再写回（CEF3 设计器无关弹窗）：新增 CEF3_创建弹窗浏览器（4 参数，走 BrowserCreateChrome + 独立 profile + 每实例代理）。合计 +1 命令 +4 参数。
      // 基线 2026-09-19 再写回（CEF3 内嵌区域动态）：新增 CEF3_创建区域（8 参数，运行时自建 WS_CHILD 承载 + 独立 profile + 每实例代理）。合计 +1 命令 +8 参数。
      // 基线 2026-09-19 再写回（CEF3 实例版会话句柄）：新增 CEF3会话_取上下文实例（1 参数，按实例编号取 RequestContext 句柄，解锁弹窗/区域的句柄版 CEF3会话_* 命令）。合计 +1 命令 +1 参数。
      // 基线 2026-09-19 再写回（CEF3 实例级 UA，纯运行时改「资源加载前」请求头 User-Agent）：新增 CEF3_设置用户代理/取用户代理（各 controlRef+UA）与 CEF3_设置实例用户代理/取实例用户代理（各 实例编号+UA）。合计 +4 命令 +6 参数 +2 controlRef。
      // 基线 2026-09-19 再写回（FBro 内嵌区域动态，复用已出货 EMBEDDED 跨进程路径）：新增 浏览器外壳_新建内嵌实例区域（9 参数）与 浏览器外壳_取内嵌区域实例JSON（0 参数）。合计 +2 命令 +9 参数。
      // 基线 2026-09-19 再写回（FBro win32 动态内嵌区域，不依赖 new_emoji）：lingbuilder.fbro.browser 2.8.0
      // 新增 FBro_创建区域（9 参数：实例编号/左/顶/宽/高 int + 地址/缓存目录/代理地址/用户代理 wideString）、
      // FBro_取区域实例JSON（0 参数）、FBro_关闭全部区域（0 参数）。合计 +3 命令 +9 参数，无控件参数。
      // 基线 2026-09-19 再写回（HTTP 客户端 2.1.0 Cookie 注入族）：lingbuilder.net.http-client 新增
      // HTTP客户端_置Cookie（5 参数）、HTTP客户端_请求置Cookie（2 参数）、HTTP客户端_取CookieJSON（1 参数）、
      // HTTP客户端_删除全部Cookie（1 参数）。合计 +4 命令 +9 参数，无控件参数；写回值按 HEAD+本批改动的隔离快照实算。
      // 基线 2026-09-19 再写回（三浏览器内核填表/跨域/框架能力补齐）：CEF3 automation 子模块
      // 新增 CEF3框架_* 25 条与 CEF3填表_*（写入族）12 条、CEF3平台_* 跨域白名单 3 条；
      // EdgeView 新增 EdgeView填表_* 22 条与创建选项附加参数/跨域开关 4 条。控件参数新增
      // 按 controlRef 声明的浏览器控件名；EdgeView创建选项_置/取附加参数 的
      // 「附加浏览器启动参数」是 Chromium 命令行开关文本，进文本参数白名单。
      // 基线 2026-09-20 再写回（FBro 启动开关批次4）：lingbuilder.fbro.browser 2.9.0 新增
      // FBro_设置启动开关JSON（1 参数「开关JSON」，文本参数、非控件引用）与 FBroBrowser
      // 「启用跨域模式/禁用代理」两个创建期属性；合计 +1 命令 +1 参数，控件引用数不变。
      // 基线 2026-09-20 再写回（CEF3 无头浏览器 Task 6）：lingbuilder.cef3.browser 新增
      // CEF3_创建无头浏览器 与 16 条 CEF3无头_* 实例编号命令（共 +17 命令、+29 参数）；
      // 全部按「实例编号:int」寻址，不引入新的 controlRef，故控件引用计数不变。
      // 基线 2026-09-20 再写回（CEF3 代理缺口补齐）：新增 CEF3_设置全局代理/清除全局代理/取全局代理/
      // 取实例代理 共 +4 命令、+2 参数；代理认证两条因 CEF 150 不投递代理 407（真机二分）本轮不登记。
      // 基线 2026-09-20 再写回（lingbuilder.cef3.osr 首批）：新增 1 模块、5 条按浏览器句柄寻址的 OSR 命令、+9 参数；另补 CEF3无头_等待出帧 +1 命令、+2 参数；
      // 句柄是 longLong 而非 controlRef，控件引用计数同样不变。
      modules: 99,
      commands: 3816,
      parameters: 6765,
      controlReferences: 1340,
      commandDigest: '13dcb3f0',
      parameterDigest: 'c9aff182'
    },
    '内置模块的每个方法和每个参数必须进入稳定 controlRef 审计目录'
  );
  const suspiciousTextParameters: string[] = [];
  const controlNamePattern = /^(?:控件|控件名|组件|组件名|目标控件|父控件|浏览器|浏览器控件|表格控件|列表视图控件|图像列表|图像列表ID|属性页|菜单组件)$/u;

  for (const manifest of BUILTIN_MODULES) {
    assert.deepEqual(validateModuleManifest(manifest).diagnostics, [], `${manifest.id} 应通过 controlRef 清单门禁`);
    const contributions = new Map((manifest.contributes?.commands || []).map(command => [command.name, command]));
    for (const binding of manifest.bindings?.commands || []) {
      for (const parameter of binding.parameters || []) {
        if ((parameter.type === 'wideString' || parameter.type === 'utf8String') && controlNamePattern.test(parameter.name)) {
          suspiciousTextParameters.push(`${manifest.id}/${binding.command}/${parameter.name}`);
        }
        if (parameter.type !== 'controlRef') continue;
        assert.ok(parameter.controlKinds?.length, `${manifest.id}/${binding.command}/${parameter.name} 缺少 controlKinds`);
        assert.ok(parameter.scope, `${manifest.id}/${binding.command}/${parameter.name} 缺少 scope`);
        assert.ok(
          parameter.runtimeRepresentation === 'wideName'
            || parameter.runtimeRepresentation === 'stableId'
            || parameter.runtimeRepresentation === 'nativeHandle',
          `${manifest.id}/${binding.command}/${parameter.name} 必须声明确定性的控件运行时表示`
        );
      }
      if (!(binding.parameters || []).some(parameter => parameter.type === 'controlRef')) continue;
      const contribution = contributions.get(binding.command);
      assert.equal(
        normalizeControlReferenceCallSnippet(contribution?.insertText, binding.parameters),
        contribution?.insertText,
        `${manifest.id}/${binding.command} 的补全不得给控件引用加引号`
      );
      assert.equal(
        normalizeControlReferenceCallSnippet(binding.example, binding.parameters),
        binding.example,
        `${manifest.id}/${binding.command} 的示例不得给控件引用加引号`
      );
    }
  }

  assert.deepEqual(suspiciousTextParameters, []);
});

test('Win32 内置容器贡献声明与设计器布局注册表保持一致', () => {
  const basic = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic');
  const commonControls = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.common-controls');
  assert.deepEqual(basic?.contributes?.designerControls?.find(control => control.type === 'GroupBox')?.layout, {
    mode: 'absolute', coordinateSpace: 'window', adapterId: 'win32.groupbox.absolute'
  });
  assert.deepEqual(commonControls?.contributes?.designerControls?.find(control => control.type === 'TabControl')?.layout, {
    mode: 'slots', coordinateSpace: 'window', adapterId: 'win32.tab.slots'
  });
  assert.equal(validateModuleManifest(basic).diagnostics.length, 0);
  assert.equal(validateModuleManifest(commonControls).diagnostics.length, 0);
});

test('Win32 32 个公开可视控件声明类型化运行时创建和标记查找契约', () => {
  const contracts = [
    ...getWin32RuntimeControlContracts('lingbuilder.win32.basic'),
    ...getWin32RuntimeControlContracts('lingbuilder.win32.common-controls')
  ];
  assert.equal(contracts.length, 32);
  assert.equal(new Set(contracts.map(contract => contract.lingCppType)).size, 32);
  assert.equal(new Set(contracts.map(contract => contract.createCommand)).size, 32);
  for (const contract of contracts) {
    assert.equal(contract.cppType, 'LingControlRef');
    assert.deepEqual(contract.createParameters.slice(-2).map(parameter => [parameter.role, parameter.optional, parameter.defaultValue]), [
      ['tagText', true, ''],
      ['tagInteger', true, null]
    ]);
    const manifest = BUILTIN_MODULES.find(module => module.contributes?.designerControls?.some(control => control.type === contract.designerType && control.runtimeControl?.lingCppType === contract.lingCppType));
    assert.ok(manifest, `${contract.designerType} 必须由内置模块贡献运行时契约`);
    assert.ok(manifest.contributes?.commands?.some(command => command.name === contract.createCommand));
    assert.ok(manifest.contributes?.commands?.some(command => command.name === contract.lookupByTagTextCommand));
    assert.ok(manifest.contributes?.commands?.some(command => command.name === contract.lookupByTagIntegerCommand));
    assert.equal(manifest.bindings?.commands?.find(binding => binding.command === contract.createCommand)?.returnType, contract.lingCppType);
  }
});

test('模块清单拒绝缺失运行时创建映射和非尾部可选参数', () => {
  const basic = structuredClone(BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!);
  const firstControl = basic.contributes!.designerControls!.find(control => control.runtimeControl)!;
  basic.bindings!.commands = basic.bindings!.commands!.filter(binding => binding.command !== firstControl.runtimeControl!.createCommand);
  assert.ok(validateModuleManifest(basic).diagnostics.some(diagnostic => diagnostic.includes('缺少 bindings.commands 映射')));

  const optionalOrder = structuredClone(BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!);
  const createBinding = optionalOrder.bindings!.commands!.find(binding => binding.command.startsWith('控件_创建'))!;
  createBinding.parameters!.push({ name: '错误必填参数', type: 'int' });
  assert.ok(validateModuleManifest(optionalOrder).diagnostics.some(diagnostic => diagnostic.includes('必填参数不能位于可选参数之后')));
});

test('AI 导入口径要求中文命令与 bindings 成对，默认清单口径不受影响', () => {
  const manifest = {
    schemaVersion: 2,
    name: '成对校验探针',
    version: '1.0.0',
    category: '其他',
    description: '用于校验中文命令与绑定成对的测试模块。',
    contributes: {
      commands: [
        { name: '探针_有绑定', signature: '探针_有绑定()', description: '有 C++ 绑定。', insertText: '探针_有绑定()', returnType: '空' },
        { name: '探针_缺绑定', signature: '探针_缺绑定()', description: '只有补全没有绑定。', insertText: '探针_缺绑定()', returnType: '空' }
      ],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/最小示例.lcpp' }]
    },
    bindings: {
      commands: [{ command: '探针_有绑定', runtimeName: '探针_有绑定', returnType: 'void', encoding: 'wide' }]
    }
  };
  const pairingMessage = (items: string[]) => items.some(item => item.includes('缺少 bindings.commands 映射'));

  assert.ok(!pairingMessage(validateModuleManifest(manifest).diagnostics), '默认口径不得新增配对诊断，避免影响已安装模块');
  const strict = validateModuleManifest(manifest, { requireCommandBindings: true }).diagnostics;
  assert.ok(strict.some(item => item.includes('探针_缺绑定') && item.includes('缺少 bindings.commands 映射')), JSON.stringify(strict));
  assert.ok(!strict.some(item => item.includes('探针_有绑定')), '已成对的命令不得报错');

  const withoutBindings = structuredClone(manifest) as any;
  delete withoutBindings.bindings;
  assert.ok(pairingMessage(validateModuleManifest(withoutBindings, { requireCommandBindings: true }).diagnostics),
    '整体缺少 bindings 的 AI 输出必须被拦下');
});

test('模块源目录中的 controlRef 补全、示例和代码片段全部保持裸引用', async () => {
  const moduleSourceRoot = path.resolve(process.cwd(), 'src', 'services', 'modules');
  const sourceFiles = await collectModuleSourceFilesForControlRefAudit(moduleSourceRoot);
  const violations: string[] = [];
  for (const filePath of sourceFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    const audit = normalizeControlReferenceSourceLiterals(source, filePath, BUILTIN_MODULES);
    audit.changes.forEach(change => violations.push(`${path.relative(moduleSourceRoot, filePath)}:${change.line}`));
  }
  // 2026-09-16 写回 54→55：项目 DLL 命令声明功能新增 projectDllMaterializeService.ts（已重新确认全量字面量扫描 0 违规）。
  // 2026-09-18 写回 56→57：模块公开常量功能新增 moduleConstantService.ts（已重新确认全量字面量扫描 0 违规）。
  assert.equal(sourceFiles.length, 57, '模块源文件数量变化时必须重新确认 controlRef 源字面量覆盖范围');
  assert.deepEqual(violations, []);

  const unsafe = 'const command = { insertText: \'控件_设置文本("操作结果", "$2")\' };';
  const normalized = normalizeControlReferenceSourceLiterals(unsafe, 'unsafe.ts', BUILTIN_MODULES);
  assert.equal(normalized.changes.length, 1);
  assert.match(normalized.source, /控件_设置文本\(操作结果, "\$2"\)/u);

  const nestedUnsafe = 'const snippet = { insertText: \'调试输出(CEF3_执行JS("浏览器1", "document.title"))\' };';
  const nestedNormalized = normalizeControlReferenceSourceLiterals(nestedUnsafe, 'nested-unsafe.ts', BUILTIN_MODULES);
  assert.equal(nestedNormalized.changes.length, 1);
  assert.match(nestedNormalized.source, /调试输出\(CEF3_执行JS\(浏览器1, "document.title"\)\)/u);
});

test('第三方模块清单拒绝文本型控件参数和带引号的 controlRef 代码片段', () => {
  const legacy = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.legacy-control',
    name: '旧控件模块',
    version: '1.0.0',
    category: '界面',
    description: '测试旧参数。',
    author: 'Test',
    contributes: { commands: [{ name: '旧命令', signature: '旧命令(控件名)', description: '旧命令', insertText: '旧命令("$1")' }] },
    targets: [],
    bindings: { commands: [{ command: '旧命令', runtimeName: '旧命令', parameters: [{ name: '控件名', type: 'wideString' }], returnType: 'bool' }] }
  });
  assert.ok(legacy.diagnostics.some(message => message.includes('必须声明为 controlRef')));

  const quoted = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.quoted-control',
    name: '引号控件模块',
    version: '1.0.0',
    category: '界面',
    description: '测试引号参数。',
    author: 'Test',
    contributes: {
      commands: [{ name: '设置控件', signature: '设置控件(控件名)', description: '设置控件', insertText: '设置控件("$1")' }],
      snippets: [{ label: '嵌套旧写法', insertText: '调试输出(设置控件("按钮1"))', description: '必须拒绝嵌套引号。' }]
    },
    targets: [],
    bindings: { commands: [{ command: '设置控件', runtimeName: '设置控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', example: '设置控件("按钮1")' }] }
  });
  assert.ok(quoted.diagnostics.some(message => message.includes('insertText 不得')));
  assert.ok(quoted.diagnostics.some(message => message.includes('example 不得')));
  assert.ok(quoted.diagnostics.some(message => message.includes('包括嵌套命令')));
});

test('模块清单接受泛型数组参数，但拒绝无法定型或跨 DLL 的用法', () => {
  const valid = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.generic-array',
    name: '泛型数组模块',
    version: '1.0.0',
    category: '其他',
    description: '对元素类型透明的数组命令。',
    contributes: {
      commands: [{ name: '集合_取首个', signature: '集合_取首个(数组)', description: '读取首个成员。', returnType: '数组成员' }]
    },
    targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }],
    bindings: {
      commands: [{
        command: '集合_取首个',
        runtimeName: '集合_取首个',
        parameters: [{ name: '数组', type: 'array' }],
        returnType: 'arrayElement'
      }]
    }
  });
  assert.deepEqual(valid.diagnostics, []);

  const undeterminedElement = validateModuleManifest({
    ...valid.manifest,
    id: 'third.party.generic-array-undetermined',
    bindings: {
      commands: [{
        command: '集合_取首个',
        runtimeName: '集合_取首个',
        parameters: [{ name: '值', type: 'arrayElement' }],
        returnType: 'arrayElement'
      }]
    }
  });
  assert.equal(
    undeterminedElement.diagnostics.filter(message => message.includes('必须同时声明一个 array 参数')).length,
    2,
    'arrayElement 参数和返回值都必须要求同命令存在 array 参数'
  );

  const arrayReturnType = validateModuleManifest({
    ...valid.manifest,
    id: 'third.party.generic-array-return',
    bindings: {
      commands: [{
        command: '集合_取首个',
        runtimeName: '集合_取首个',
        parameters: [{ name: '数组', type: 'array' }],
        returnType: 'array'
      }]
    }
  });
  assert.ok(arrayReturnType.diagnostics.some(message => message.includes('不能把 array 作为 returnType')));

  const dllTarget = validateModuleManifest({
    ...valid.manifest,
    id: 'third.party.generic-array-dll',
    targets: [{
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      libs: ['lib/array.lib'], runtimeFiles: ['bin/array.dll']
    }]
  });
  assert.ok(dllTarget.diagnostics.some(message => message.includes('不能通过原生 DLL ABI 直接传递泛型数组参数')));
});

test('模块清单公开记录和数组类型，并拒绝不安全结构契约', () => {
  const valid = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.public-types',
    name: '公开类型模块',
    version: '1.0.0',
    category: '其他',
    description: '公开 LingCpp 记录与数组。',
    contributes: {
      types: [
        {
          name: '网络地址',
          kind: 'record',
          description: '网络地址值。',
          fields: [
            { name: '主机', type: '文本型', initialValue: '""', description: '主机名称。' },
            { name: '端口', type: '整数型', initialValue: '0', description: '端口号。' }
          ]
        },
        {
          name: '服务器信息',
          kind: 'record',
          description: '服务器信息值。',
          fields: [
            { name: '地址', type: '网络地址' },
            { name: '标签', type: '文本型', isArray: true }
          ]
        },
        { name: '服务器列表', kind: 'array', elementType: '服务器信息', description: '服务器信息数组。' },
        { name: '原生会话', description: '旧式不透明类型。', cppType: 'long long' }
      ]
    }
  });
  assert.deepEqual(valid.diagnostics, []);

  const unsafeDllAbi = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.unsafe-structured-abi',
    name: '错误结构 ABI 模块',
    version: '1.0.0',
    category: '其他',
    description: '错误地让 DLL 直接返回 C++ 结构。',
    contributes: {
      types: [{ name: '原生结果', kind: 'record', description: '错误示例。', fields: [{ name: '编号', type: '整数型' }] }],
      commands: [{ name: '读取结果', signature: '读取结果()', description: '错误示例。', returnType: '原生结果' }]
    },
    targets: [{
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      libs: ['lib/result.lib'], runtimeFiles: ['bin/result.dll']
    }],
    bindings: { commands: [{ command: '读取结果', runtimeName: 'ReadResult', returnType: '原生结果' }] }
  });
  assert.ok(unsafeDllAbi.diagnostics.some(message => message.includes('不能通过原生 DLL ABI 直接返回结构化类型')));

  const invalid = validateModuleManifest({
    schemaVersion: 2,
    id: 'third.party.invalid-public-types',
    name: '错误公开类型模块',
    version: '1.0.0',
    category: '其他',
    description: '包含错误结构定义。',
    contributes: {
      types: [
        {
          name: '类型A',
          kind: 'record',
          description: 'A。',
          cppType: 'NativeA',
          fields: [
            { name: '项目', type: '类型B', initialValue: '类型B()' },
            { name: '数据', type: '字节集', initialValue: '"错误"' },
            { name: '数量', type: '整数型', initialValue: '"错误"' }
          ]
        },
        { name: '类型B', kind: 'array', description: 'B。', elementType: '类型A' },
        { name: '未知集合', kind: 'array', description: '未知。', elementType: '未公开类型' }
      ]
    }
  });
  assert.ok(invalid.diagnostics.some(message => message.includes('不能使用 cppType')));
  assert.ok(invalid.diagnostics.some(message => message.includes('循环嵌套')));
  assert.ok(invalid.diagnostics.some(message => message.includes('未公开或不安全')));
  assert.ok(invalid.diagnostics.some(message => message.includes('数组、字节集或结构化字段只能默认空初始化')));
  assert.ok(
    invalid.diagnostics.some(message => message.includes('initialValue 与字段类型 整数型 不兼容')),
    invalid.diagnostics.join('\n')
  );

  const opaqueModule = createTestModule();
  opaqueModule.manifest.id = 'third.party.opaque-owner';
  opaqueModule.manifest.contributes = {
    types: [{ name: '共享类型', kind: 'opaque', description: '旧式不透明类型。', cppType: 'long long' }]
  };
  const recordModule = createTestModule();
  recordModule.manifest.id = 'third.party.record-owner';
  recordModule.manifest.contributes = {
    types: [{ name: '共享类型', kind: 'record', description: '结构化值。', fields: [{ name: '编号', type: '整数型' }] }]
  };
  assert.match(
    getEnabledModuleStructuredTypeDiagnostics({
      availableModules: [opaqueModule, recordModule],
      enabledModules: [opaqueModule, recordModule]
    }).join('\n'),
    /结构化类型不能与其他公开类型同名/u
  );
});

test('模块 SDK 拒绝缺少 controlRef 元数据或带引号补全的 C++ 迁移配置', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-control-ref-sdk-'));
  const configPath = path.join(root, 'module.json');
  const outDir = path.join(root, 'out');
  const baseConfig = {
    id: 'third.party.control-sdk',
    name: '控件 SDK 测试',
    commands: [{
      name: '设置控件',
      runtimeName: 'SetControl',
      insertText: '设置控件($1)',
      parameters: [{ name: '控件名', type: 'controlRef' }]
    }]
  };
  await fs.writeFile(configPath, JSON.stringify(baseConfig), 'utf8');
  await assert.rejects(() => migrateCppModule(configPath, outDir), /controlKinds/u);

  await fs.writeFile(configPath, JSON.stringify({
    ...baseConfig,
    commands: [{
      ...baseConfig.commands[0],
      insertText: '设置控件("$1")',
      parameters: [{
        name: '控件名', type: 'controlRef', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'wideName'
      }]
    }]
  }), 'utf8');
  await assert.rejects(() => migrateCppModule(configPath, outDir), /SDK 拒绝/u);
});

test('工作区已安装模块全部通过 controlRef 清单和示例门禁', async () => {
  const modulesRoot = path.resolve(process.cwd(), '..', '.lingbuilder', 'modules');
  const entries = await fs.readdir(modulesRoot, { withFileTypes: true });
  const auditedManifests = new Map(BUILTIN_MODULES.map(manifest => [manifest.id, manifest]));
  let manifestCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(modulesRoot, entry.name, 'lingbuilder.module.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      manifestCount += 1;
      assert.deepEqual(validateModuleManifest(manifest).diagnostics, [], `${entry.name} 必须通过第三方模块 controlRef 门禁`);
      if (!auditedManifests.has(manifest.id)) auditedManifests.set(manifest.id, manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  assert.ok(manifestCount >= 7, `预计至少审计 7 份已安装模块清单，实际 ${manifestCount}`);
  const audit = auditControlReferenceManifests([...auditedManifests.values()]);
  assert.deepEqual(audit.violations, []);
  assert.deepEqual({
    modules: audit.moduleCount,
    commands: audit.commandCount,
    parameters: audit.parameterCount,
    controlReferences: audit.controlReferenceCount,
    commandDigest: audit.commandDigest,
    parameterDigest: audit.parameterDigest
  }, {
      // 基线 2026-09-18 写回（进程内存扫描批次）：BUILTIN + 本机 5 份磁盘模块清单
      //（cef3.sdk / fbro.sdk / new_emoji.ui / demo.mathdll / demo.projectdll）实算；
      // 内置部分 98/3640/6301（见上一用例），磁盘部分含并行会话装入的 demo 模块两份。
      modules: 103,
      commands: 7657,
      parameters: 18422,
      controlReferences: 5061,
      commandDigest: '7a01207c',
      parameterDigest: '945b01db'
  }, '内置、官方和当前工作区第三方模块的每个方法与参数都必须进入全量审计');
});

test('OpenCV 模块公开完整中文 API、真实 binding 和 x64-only target', () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === OPENCV_MODULE_ID);
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-x64']);
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), OPENCV_COMMAND_NAMES);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), OPENCV_COMMAND_NAMES);
  assert.ok(OPENCV_COMMAND_NAMES.includes('OpenCV_分析缺口'));
  assert.ok(OPENCV_COMMAND_NAMES.includes('OpenCV结果_取JSON'));
  assert.equal(OPENCV_MODULE_FAMILY.rootModuleId, OPENCV_MODULE_ID);
  assert.deepEqual(OPENCV_MODULE_FAMILY.assetModuleIds, [OPENCV_SDK_MODULE_ID]);
  assert.equal(isModuleHiddenByFamily(OPENCV_SDK_MODULE_ID), true);
});

test('OpenCV 模块生成稳定 C ABI 包装且不暴露 cv::Mat', () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === OPENCV_MODULE_ID)!;
  const module: InstalledModule = { manifest, installPath: `builtin://${OPENCV_MODULE_ID}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出(OpenCV_取版本())\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath.endsWith('.cpp'))?.content || '';
  assert.match(cpp, /#include "LingBuilderOpenCvBridge\.h"/u);
  assert.match(cpp, /LB_OCV_AnalyzeGap/u);
  assert.match(cpp, /OpenCV_分析缺口/u);
  assert.doesNotMatch(cpp, /cv::Mat/u);
});

test('编码转换模块公开完整的文本安全字符编码、BOM 与通用转码命令', () => {
  const manifest = STANDARD_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.std.encoding')!;
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  const requiredCommands = [
    '编码_文本转UTF8', '编码_UTF8转文本',
    '编码_文本转UTF16LE', '编码_UTF16LE转文本', '编码_文本转UTF16BE', '编码_UTF16BE转文本',
    '编码_文本转UTF32LE', '编码_UTF32LE转文本', '编码_文本转UTF32BE', '编码_UTF32BE转文本',
    '编码_文本转ANSI', '编码_ANSI转文本', '编码_文本转GBK', '编码_GBK转文本',
    '编码_文本转GB2312', '编码_GB2312转文本', '编码_文本转GB18030', '编码_GB18030转文本',
    '编码_转换', '编码_添加BOM', '编码_删除BOM', '编码_是否有BOM', '编码_检测BOM', '编码_检测'
  ];
  requiredCommands.forEach(command => assert.ok(commandNames.has(command), `编码模块缺少命令：${command}`));
  assert.match(manifest.contributes?.commands?.find(command => command.name === '编码_文本转UTF8')?.description || '', /十六进制/u);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
});

test('数组操作模块对元素类型透明地提供成员数、增删改查、排序和重定义', async () => {
  const manifest = STANDARD_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.std.array')!;
  const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
  assert.deepEqual(commandNames, [
    '数组_取成员数', '数组_是否为空', '数组_取成员', '数组_置成员', '数组_加入成员', '数组_插入成员',
    '数组_删除成员', '数组_清空', '数组_查找', '数组_是否包含', '数组_排序', '数组_倒序', '数组_重定义'
  ]);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), commandNames);
  // 模块不引入新的公开类型：命令直接作用于语言原有的数组声明。
  assert.equal(manifest.contributes?.types, undefined);
  const bindings = new Map((manifest.bindings?.commands || []).map(binding => [binding.command, binding]));
  bindings.forEach((binding, command) => assert.ok(
    (binding.parameters || []).some(parameter => parameter.type === 'array'),
    `${command} 必须声明 array 参数`
  ));
  assert.equal(bindings.get('数组_取成员')?.returnType, 'arrayElement');
  assert.deepEqual(bindings.get('数组_加入成员')?.parameters?.map(parameter => parameter.type), ['array', 'arrayElement']);
  // 数组按 std::vector 原样传递，不能被误判成需要宽字符 ABI 转换的命令。
  assert.equal(bindings.get('数组_加入成员')?.encoding, undefined);
  assert.deepEqual(manifest.contributes?.docs, [{ title: '数组操作模块', path: 'docs/modules/array/README.md' }]);
  const document = await fs.readFile(path.join(process.cwd(), 'docs', 'modules', 'array', 'README.md'), 'utf8');
  assert.match(document, /std::vector<T>/u);
  assert.match(document, /数组_取成员数/u);

  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.std.array'].map(moduleId => {
    const module = BUILTIN_MODULES.find(item => item.id === moduleId)!;
    return { manifest: module, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  });
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 文本型 名单[]',
      '        局部 整数型 编号[]',
      '        数组_加入成员(名单, "张三")',
      '        数组_插入成员(名单, 0, "李四")',
      '        数组_置成员(名单, 1, "王五")',
      '        数组_排序(名单, 真)',
      '        数组_倒序(名单)',
      '        数组_重定义(编号, 4)',
      '        调试输出(数组_取成员数(名单), 数组_取成员(名单, 0), 数组_查找(名单, "王五"))',
      '        数组_删除成员(名单, 0)',
      '        数组_清空(名单)',
      '    结束',
      '结束类'
    ].join('\n')
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  [
    'template <typename T> int 数组_取成员数(const std::vector<T>& items)',
    'template <typename T, typename V> int 数组_加入成员(std::vector<T>& items, V&& value)',
    'struct LB_ArrayEquatable',
    'struct LB_ArrayOrderable'
  ].forEach(symbol => assert.ok(mainCpp.includes(symbol), `数组运行时缺少 ${symbol}`));
  assert.match(mainCpp, /std::vector<std::wstring> 名单\{\};/u);
  assert.match(mainCpp, /std::vector<int> 编号\{\};/u);
  assert.match(mainCpp, /数组_加入成员\(名单, L"张三"\);/u);
  assert.match(mainCpp, /数组_排序\(名单, true\);/u);
  assert.match(mainCpp, /数组_取成员\(名单, 0\)/u);

  // 文本数组成员与字面量比较必须生成值比较；按指针比较会静默恒假。
  const textComparison = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 文本型 名单[]',
      '        局部 整数型 编号[]',
      '        数组_加入成员(名单, "张三")',
      '        如果真 (数组_取成员(名单, 0) == "张三")',
      '            调试输出("命中")',
      '        如果真结束',
      '        如果真 (数组_取成员(编号, 0) == 0)',
      '            调试输出("整数成员按数值比较")',
      '        如果真结束',
      '    结束',
      '结束类'
    ].join('\n')
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(textComparison, /std::wstring\(LingCppWideArg\(数组_取成员\(名单, 0\)\)\)==LingCppWideArg\(L"张三"\)/u);
  // 整数数组不能被误判成文本，否则会把 int 塞进 LingCppWideArg。
  assert.match(textComparison, /if \(数组_取成员\(编号, 0\)==0\)/u);

  // 未启用模块时不得注入数组运行时。
  const withoutArrayModule = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: enabledModules.filter(module => module.manifest.id !== 'lingbuilder.std.array'),
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出("无数组模块")\n    结束\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.doesNotMatch(withoutArrayModule, /数组_取成员数/u);
});

test('JSON 数据模块 2.0 提供受管 DOM、Pointer、Patch、Schema 与可导出的确定性运行时', async () => {
  const manifest = STANDARD_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.data.json')!;
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  assert.equal(manifest.version, '2.0.0');
  assert.deepEqual(manifest.contributes?.types, [{
    name: 'JSON值',
    kind: 'opaque',
    cppType: 'long long',
    description: '受管 JSON DOM 句柄。对象、数组和标量均可表示；通过 JSON_释放释放长期保留的值。'
  }]);
  [
    'JSON_解析', 'JSON_创建对象', 'JSON_创建数组', 'JSON_创建文本', 'JSON_序列化格式化',
    'JSON_对象_设置', 'JSON_数组_添加', 'JSON_指针_取', 'JSON_指针_设置', 'JSON_应用补丁',
    'JSON_合并补丁', 'JSON_生成补丁', 'JSON_Schema验证', 'JSON_取最后错误'
  ].forEach(command => assert.ok(commandNames.has(command), `JSON 模块缺少命令：${command}`));
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  assert.deepEqual(manifest.contributes?.docs, [{ title: 'JSON 数据模块 2.0 使用说明', path: 'docs/modules/json/README.md' }]);
  const document = await fs.readFile(path.join(process.cwd(), 'docs', 'modules', 'json', 'README.md'), 'utf8');
  assert.match(document, /RFC 8259/u);
  assert.match(document, /JSON_应用补丁/u);

  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.data.json'].map(moduleId => {
    const module = BUILTIN_MODULES.find(item => item.id === moduleId)!;
    return { manifest: module, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  });
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 JSON值 数据 = JSON_创建对象()',
      '        局部 JSON值 名称 = JSON_创建文本("LingBuilder")',
      '        JSON_对象_设置(数据, "name", 名称)',
      '        JSON_指针_设置(数据, "/edition", JSON_创建整数(2), 真)',
      '        JSON_应用补丁(数据, "[{\\"op\\":\\"replace\\",\\"path\\":\\"/edition\\",\\"value\\":3}]")',
      '        JSON_Schema验证(数据, "{\\"type\\":\\"object\\",\\"required\\":[\\"name\\"]}")',
      '        调试输出(JSON_序列化格式化(数据, 2))',
      '        JSON_释放(名称)',
      '        JSON_释放(数据)',
      '    结束',
      '结束类'
    ].join('\n')
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  [
    'namespace LingBuilderJson', 'long long JSON_解析(const wchar_t* json)', 'bool JSON_对象_设置',
    'bool JSON_指针_设置', 'bool JSON_应用补丁', 'bool JSON_Schema验证', 'kMaxInputChars'
  ].forEach(symbol => assert.ok(mainCpp.includes(symbol), `JSON 运行时缺少 ${symbol}`));
  assert.match(mainCpp, /long long 数据 = JSON_创建对象\(\);/u);
  assert.match(mainCpp, /JSON_对象_设置\(数据, L"name", 名称\);/u);
  assert.match(mainCpp, /JSON_指针_设置\(数据, L"\/edition", JSON_创建整数\(2\), true\);/u);
  assert.match(mainCpp, /JSON_Schema验证\(数据, L"\{\\"type\\":\\"object\\",\\"required\\":\[\\"name\\"\]\}"\);/u);

  const escapedJsonLocals = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 文本型 JSON文本 = "{\\"name\\":\\"LingBuilder\\"}"',
      '        局部 文本型 规则 = "{\\"type\\":\\"object\\"}"',
      '        局部 JSON值 数据 = JSON_解析(JSON文本)',
      '        JSON_Schema验证(数据, 规则)',
      '        JSON_释放(数据)',
      '    结束',
      '结束类'
    ].join('\n')
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(escapedJsonLocals, /std::wstring JSON文本 = L"/u);
  assert.match(escapedJsonLocals, /std::wstring 规则 = L"/u);
  assert.match(escapedJsonLocals, /JSON_解析\(LingCppWideArg\(JSON文本\)\)/u);
  assert.match(escapedJsonLocals, /JSON_Schema验证\(数据, LingCppWideArg\(规则\)\)/u);
});

test('标准库模块生成独立 C++ 运行时并翻译嵌套中文调用', () => {
  const moduleIds = ['lingbuilder.win32.basic', 'lingbuilder.std.text', 'lingbuilder.std.encoding', 'lingbuilder.data.json'];
  const enabledModules: InstalledModule[] = moduleIds.map(moduleId => {
    const manifest = BUILTIN_MODULES.find(module => module.id === moduleId);
    assert.ok(manifest, `缺少内置模块 ${moduleId}`);
    return {
      manifest,
      installPath: `builtin://${moduleId}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    };
  });
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        调试输出(文本_转大写("LingBuilder"))',
      '        调试输出(编码_Base64解码("5L2g5aW9"))',
      '        调试输出(编码_UTF8转文本(编码_文本转UTF8("你好")))',
      '        调试输出(编码_文本转UTF8(到文本(123)))',
      '        调试输出(编码_转换("E4BDA0E5A5BD", "UTF-8", "UTF-16LE"))',
      '        调试输出(编码_检测BOM(编码_添加BOM("E4BDA0E5A5BD", "UTF-8")))',
      '        JSON_是否有效("{}")',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /const wchar_t\* 文本_转大写\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /const wchar_t\* 编码_Base64解码\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /const wchar_t\* 编码_文本转UTF32BE\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /const wchar_t\* 编码_GB18030转文本\(const wchar_t\* hex\)/u);
  assert.match(mainCpp, /const wchar_t\* 编码_转换\(const wchar_t\* hex/u);
  assert.match(mainCpp, /const wchar_t\* 编码_检测BOM\(const wchar_t\* hex\)/u);
  assert.match(mainCpp, /bool JSON_是否有效\(const wchar_t\* json\)/u);
  assert.match(mainCpp, /调试输出\(文本_转大写\(L"LingBuilder"\)\);/u);
  assert.match(mainCpp, /调试输出\(编码_Base64解码\(L"5L2g5aW9"\)\);/u);
  assert.match(mainCpp, /调试输出\(编码_UTF8转文本\(编码_文本转UTF8\(L"你好"\)\)\);/u);
  assert.match(mainCpp, /调试输出\(编码_文本转UTF8\(到文本\(123\)\)\);/u);
  assert.match(mainCpp, /编码_转换\(L"E4BDA0E5A5BD", L"UTF-8", L"UTF-16LE"\)/u);
  assert.match(mainCpp, /编码_检测BOM\(编码_添加BOM\(L"E4BDA0E5A5BD", L"UTF-8"\)\)/u);
  assert.match(mainCpp, /JSON_是否有效\(L"\{\}"\);/u);
});

test('编码与 JSON 标准库运行时不依赖字节模块提供十六进制辅助函数', () => {
  for (const moduleId of ['lingbuilder.std.encoding', 'lingbuilder.data.json']) {
    const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', moduleId].map(enabledModuleId => {
      const manifest = BUILTIN_MODULES.find(module => module.id === enabledModuleId);
      assert.ok(manifest, `缺少内置模块 ${enabledModuleId}`);
      return {
        manifest,
        installPath: `builtin://${enabledModuleId}`,
        isBuiltin: true,
        isInstalled: true,
        isEnabledForProject: true,
        diagnostics: []
      };
    });
    const generated = generateLingCppNativeWin32Project(sampleProject, { enabledModules });
    const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
    const helperDefinition = 'static int LB_HexDigit(wchar_t value)';
    const helperDefinitionIndex = mainCpp.indexOf(helperDefinition);
    const helperUseIndex = mainCpp.indexOf('LB_HexDigit(', helperDefinitionIndex + helperDefinition.length);

    assert.ok(helperDefinitionIndex >= 0, `${moduleId} 应生成共享的 LB_HexDigit 定义`);
    assert.ok(helperUseIndex > helperDefinitionIndex, `${moduleId} 应在使用 LB_HexDigit 前生成定义`);
    assert.equal(mainCpp.split(helperDefinition).length - 1, 1, `${moduleId} 只能生成一次 LB_HexDigit 定义`);
    assert.ok(!enabledModules.some(module => module.manifest.id === 'lingbuilder.std.bytes'));
  }
});

test('文件、配置、系统、进程、输入和窗口模块提供完整确定性绑定', () => {
  assert.equal(SYSTEM_LIBRARY_MODULES.length, 14);
  for (const manifest of SYSTEM_LIBRARY_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(
      manifest.bindings?.commands?.map(binding => binding.command),
      manifest.contributes?.commands?.map(command => command.name),
      `${manifest.id} 的命令与 binding 必须逐项对应`
    );
    assert.ok(BUILTIN_MODULES.some(module => module.id === manifest.id));
  }

  const selectedIds = ['lingbuilder.fs.core', 'lingbuilder.config.ini', 'lingbuilder.system.info', 'lingbuilder.process', 'lingbuilder.input.mouse', 'lingbuilder.win32.window-utils'];
  const enabledModules: InstalledModule[] = selectedIds.map(moduleId => ({
    manifest: SYSTEM_LIBRARY_MODULES.find(module => module.id === moduleId)!,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        文件_写入文本("验证.txt", "中文")',
      '        INI_写整数("设置.ini", "窗口", "宽度", 800)',
      '        鼠标_移动(10, 20)',
      '        窗口_开始拖拽(窗口_按标题查找("无边框演示"))',
      '        窗口_开始边缘缩放(窗口_按标题查找("无边框演示"), 17)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /bool 文件_写入文本\(const wchar_t\* path, const wchar_t\* content\)/u);
  assert.match(mainCpp, /bool INI_写整数\(const wchar_t\* file/u);
  assert.match(mainCpp, /const wchar_t\* 系统_取Windows版本\(\)/u);
  assert.match(mainCpp, /int 程序_启动\(const wchar_t\* commandLine/u);
  assert.match(mainCpp, /bool 鼠标_移动\(int x, int y\)/u);
  assert.match(mainCpp, /bool 窗口_设置标题\(long long handle/u);
  assert.match(mainCpp, /文件_写入文本\(L"验证\.txt", L"中文"\);/u);

  const windowUtilsManifest = SYSTEM_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.win32.window-utils')!;
  const windowUtilsCommands = windowUtilsManifest.contributes?.commands?.map(command => command.name) ?? [];
  for (const name of ['窗口_是否最大化', '窗口_取边界JSON', '窗口_开始拖拽', '窗口_开始边缘缩放']) {
    assert.ok(windowUtilsCommands.includes(name), `${name} 必须登记进 Win32窗口操作模块命令清单`);
  }
  assert.match(mainCpp, /bool 窗口_是否最大化\(long long handle\)/u);
  assert.match(mainCpp, /const wchar_t\* 窗口_取边界JSON\(long long handle\)/u);
  assert.match(mainCpp, /bool 窗口_开始拖拽\(long long handle\)/u);
  assert.match(mainCpp, /bool 窗口_开始边缘缩放\(long long handle, int edge\)/u);
  assert.match(mainCpp, /SendMessageW\(window, WM_NCLBUTTONDOWN, HTCAPTION, 0\)/u);
  assert.match(mainCpp, /窗口_开始边缘缩放\([^,]+, 17\);/u);
});

test('剪贴板模块支持图片字节集和保留动画帧的 GIF 剪贴板格式', () => {
  const manifest = SYSTEM_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.system.clipboard')!;
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(validateModuleManifest(manifest).diagnostics, []);
  const commandNames = [
    '剪贴板_置文本', '剪贴板_取文本', '剪贴板_是否有文本',
    '剪贴板_置图片字节集', '剪贴板_取图片字节集', '剪贴板_是否有图片', '剪贴板_取图片格式',
    '剪贴板_置GIF字节集', '剪贴板_取GIF字节集', '剪贴板_清空'
  ];
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), commandNames);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), commandNames);
  for (const name of ['剪贴板_置图片字节集', '剪贴板_置GIF字节集']) {
    assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === name)?.parameters?.map(parameter => parameter.type), ['bytes']);
  }
  for (const name of ['剪贴板_取图片字节集', '剪贴板_取GIF字节集']) {
    assert.equal(manifest.bindings?.commands?.find(binding => binding.command === name)?.returnType, 'bytes');
  }
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/clipboard/README.md');

  const installed: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.system.clipboard',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 字节集 图片数据',
    '        剪贴板_置图片字节集(图片数据)',
    '        图片数据 = 剪贴板_取图片字节集()',
    '        剪贴板_置GIF字节集(图片数据)',
    '        剪贴板_取GIF字节集()',
    '        剪贴板_是否有图片()',
    '        剪贴板_取图片格式()',
    '    结束',
    '结束类'
  ].join('\n');
  const languageDiagnostics = getLingCppSemanticDiagnostics(
    source,
    undefined,
    'src/MainWindow.lcpp',
    { availableModules: [installed], enabledModules: [installed] }
  );
  assert.equal(languageDiagnostics.filter(item => item.level === 'error').length, 0, languageDiagnostics.map(item => item.message).join('\n'));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: source,
    enabledModules: [installed]
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /bool 剪贴板_置图片字节集\(const std::vector<unsigned char>& imageBytes\)/u);
  assert.match(cpp, /std::vector<unsigned char> 剪贴板_取图片字节集\(\)/u);
  assert.match(cpp, /bool 剪贴板_置GIF字节集\(const std::vector<unsigned char>& imageBytes\)/u);
  assert.match(cpp, /std::vector<unsigned char> 剪贴板_取GIF字节集\(\)/u);
  assert.match(cpp, /RegisterClipboardFormatW\(L"GIF"\)/u);
  assert.match(cpp, /RegisterClipboardFormatW\(L"image\/gif"\)/u);
  assert.match(cpp, /RegisterClipboardFormatW\(L"HTML Format"\)/u);
  assert.match(cpp, /StartFragment:/u);
  assert.match(cpp, /if \(!gifFormat\) return false;/u);
  assert.match(cpp, /SetClipboardData\(gifFormat, gifMemory\)/u);
  assert.match(cpp, /SetClipboardData\(gifMimeFormat, gifMimeMemory\)/u);
  assert.match(cpp, /CF_DIBV5/u);
  assert.match(cpp, /GetDIBits/u);
  assert.match(cpp, /std::vector<unsigned char> 图片数据\{\};/u);
  assert.match(cpp, /剪贴板_置图片字节集\(图片数据\);/u);
});

test('键盘输入模块分类公开全局、前台与 HWND 后台能力', () => {
  const manifest = SYSTEM_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.input.keyboard')!;
  assert.equal(manifest.version, '2.1.0');
  assert.deepEqual(validateModuleManifest(manifest).diagnostics, []);
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), KEYBOARD_COMMAND_NAMES);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), KEYBOARD_COMMAND_NAMES);
  assert.equal(KEYBOARD_COMMAND_NAMES.length, 34);
  assert.deepEqual(
    Array.from(new Set(manifest.contributes?.commands?.map(command => command.category))).sort(),
    ['全局状态', '全局热键', '兼容入口', '前台输入（SendInput）', '后台窗口（PostMessage）', '键码转换'].sort()
  );
  for (const command of manifest.contributes?.commands || []) {
    assert.match(command.description, /^\[/u, `${command.name} 必须首先标明作用范围`);
    assert.match(command.description, /占用键盘|独占实体键盘|占用实体键盘/u, `${command.name} 必须说明实体键盘影响`);
  }
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/keyboard/README.md');

  const installed: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.input.keyboard',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 整数型 控制键 = 键盘_键名取键代码("Ctrl键")',
    '        局部 整数型 扫描码 = 键盘_键代码取扫描码(13)',
    '        键盘_窗口_输入文本(0, "后台")',
    '    结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/MainWindow.lcpp', {
    availableModules: [installed], enabledModules: [installed]
  });
  assert.equal(diagnostics.filter(item => item.level === 'error').length, 0, diagnostics.map(item => item.message).join('\n'));
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, enabledModules: [installed] });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /bool 键盘_前台_输入文本\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /bool 键盘_窗口_按下\(long long windowHandle, int keyCode, bool systemKey\)/u);
  assert.match(mainCpp, /PostMessageW\(window, message/u);
  assert.match(mainCpp, /SendInput\(static_cast<UINT>\(inputs\.size\(\)\)/u);
  assert.match(mainCpp, /键盘_窗口_输入文本\(0, L"后台"\);/u);
});

test('鼠标输入模块按前台、窗口消息和 UI Automation 三类公开完整能力', () => {
  const manifest = SYSTEM_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.input.mouse')!;
  assert.equal(manifest.version, '2.0.0');
  assert.deepEqual(validateModuleManifest(manifest).diagnostics, []);
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), MOUSE_COMMAND_NAMES);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), MOUSE_COMMAND_NAMES);
  assert.equal(MOUSE_COMMAND_NAMES.length, 29);
  assert.deepEqual(
    Array.from(new Set(manifest.contributes?.commands?.map(command => command.category))).sort(),
    ['全局真实输入（前台）', '窗口消息输入（后台）', 'UI Automation（后台）'].sort()
  );
  for (const command of manifest.contributes?.commands || []) {
    assert.match(command.description, /^\[/u, `${command.name} 必须首先标明作用范围`);
    assert.match(command.description, /占用系统鼠标|不占用系统鼠标/u, `${command.name} 必须说明是否占用系统鼠标`);
  }
  const windowCommands = manifest.contributes?.commands?.filter(command => command.name.startsWith('鼠标_窗口消息')) || [];
  const uiaCommands = manifest.contributes?.commands?.filter(command => command.name.startsWith('鼠标_UIA_')) || [];
  assert.equal(windowCommands.length, 6);
  assert.equal(uiaCommands.length, 8);
  for (const command of [...windowCommands, ...uiaCommands]) {
    const binding = manifest.bindings?.commands?.find(item => item.command === command.name);
    assert.equal(binding?.parameters?.[0]?.type, 'handle', `${command.name} 的目标参数必须是句柄`);
  }
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/mouse/README.md');

  const installed: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.input.mouse',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        鼠标_相对移动(1, 2)',
    '        鼠标_窗口消息移动(0, 20, 30)',
    '        鼠标_UIA_按名称查找(0, "确定")',
    '        鼠标_UIA_调用(0)',
    '        鼠标_UIA_设置文本(0, "后台文本")',
    '        鼠标_UIA_释放(0)',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: source,
    enabledModules: [installed]
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /#include <UIAutomation\.h>/u);
  assert.match(mainCpp, /#include <wrl\.h>/u);
  assert.match(mainCpp, /#pragma comment\(lib, "uiautomationcore\.lib"\)/u);
  assert.match(mainCpp, /PostMessageW\(window, message/u);
  assert.match(mainCpp, /IUIAutomationInvokePattern/u);
  assert.match(mainCpp, /GetCurrentPattern\(UIA_InvokePatternId/u);
  assert.match(mainCpp, /bool 鼠标_窗口消息移动\(long long windowHandle, int x, int y\)/u);
  assert.match(mainCpp, /long long 鼠标_UIA_按名称查找\(long long windowHandle, const wchar_t\* name\)/u);
  assert.match(mainCpp, /鼠标_UIA_设置文本\(0, L"后台文本"\);/u);
});

test('磁盘信息模块完整公开卷、物理磁盘和分区的结构化只读能力', () => {
  const manifest = SYSTEM_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.system.disk')!;
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(validateModuleManifest(manifest).diagnostics, []);
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), DISK_COMMAND_NAMES);
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), DISK_COMMAND_NAMES);
  assert.equal(DISK_COMMAND_NAMES.length, 28);
  assert.equal(DISK_PUBLIC_TYPES.length, 8);
  assert.equal(manifest.contributes?.types?.filter(type => type.kind === 'record').length, 4);
  assert.equal(manifest.contributes?.types?.filter(type => type.kind === 'array').length, 4);
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === '磁盘_枚举逻辑驱动器')?.returnType, '磁盘卷信息列表');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === '磁盘_取物理磁盘信息')?.returnType, '物理磁盘信息');

  const installed: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.system.disk',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 磁盘卷信息列表 卷列表 = 磁盘_枚举逻辑驱动器()',
    '        局部 磁盘容量信息 容量 = 磁盘_取容量信息(".")',
    '        局部 物理磁盘信息列表 物理磁盘 = 磁盘_枚举物理磁盘()',
    '        局部 磁盘分区信息列表 分区 = 磁盘_取分区列表(0)',
    '    结束',
    '结束类'
  ].join('\n');
  const languageDiagnostics = getLingCppSemanticDiagnostics(
    source,
    undefined,
    'src/MainWindow.lcpp',
    { availableModules: [installed], enabledModules: [installed] }
  );
  assert.equal(languageDiagnostics.filter(item => item.level === 'error').length, 0, languageDiagnostics.map(item => item.message).join('\n'));

  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, enabledModules: [installed] });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const typeIndex = cpp.indexOf('struct 磁盘容量信息');
  const runtimeIndex = cpp.indexOf('磁盘容量信息 磁盘_取容量信息');
  assert.ok(typeIndex >= 0 && runtimeIndex > typeIndex, '公开结构体必须先于磁盘运行时定义');
  assert.match(cpp, /std::vector<磁盘卷信息> 磁盘_枚举逻辑驱动器\(\)/u);
  assert.match(cpp, /物理磁盘信息 磁盘_取物理磁盘信息\(int diskNumber\)/u);
  assert.match(cpp, /std::vector<磁盘分区信息> 磁盘_取分区列表\(int diskNumber\)/u);
  assert.match(cpp, /std::vector<磁盘卷信息> 卷列表 = 磁盘_枚举逻辑驱动器\(\);/u);
  assert.match(cpp, /磁盘容量信息 容量 = 磁盘_取容量信息\(L"\."\);/u);
  assert.match(cpp, /#include <winioctl\.h>/u);
});

test('Win32 基础模块全局提供初级鼠标屏幕位置命令', () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const horizontal = manifest.contributes?.commands?.find(command => command.name === '取鼠标水平位置');
  const vertical = manifest.contributes?.commands?.find(command => command.name === '取鼠标垂直位置');
  assert.equal(horizontal?.signature, '取鼠标水平位置()');
  assert.match(horizontal?.description || '', /屏幕左边.*像素点.*初级命令/u);
  assert.equal(vertical?.signature, '取鼠标垂直位置()');
  assert.match(vertical?.description || '', /屏幕顶边.*像素点.*初级命令/u);
  assert.deepEqual(
    manifest.bindings?.commands?.filter(binding => binding.command.startsWith('取鼠标')).map(binding => [binding.command, binding.parameters, binding.returnType]),
    [
      ['取鼠标水平位置', [], 'int'],
      ['取鼠标垂直位置', [], 'int']
    ]
  );
});

test('Win32 基础模块提供可变参数占位符文本格式化命令', () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const contribution = manifest.contributes?.commands?.find(command => command.name === '格式化文本');
  const binding = manifest.bindings?.commands?.find(command => command.command === '格式化文本');

  assert.equal(contribution?.signature, '格式化文本(格式模板, 参数...)');
  assert.match(contribution?.description || '', /\{\}.*\{\{.*\}\}/u);
  assert.equal(binding?.runtimeName, '格式化文本');
  // 可变参形参按清单校验要求声明为 variadic lingValue（lingValue 必须 variadic: true）。
  assert.deepEqual(binding?.parameters?.map(parameter => [parameter.type, parameter.variadic === true]), [['wideString', false], ['lingValue', true]]);
  assert.equal(binding?.returnType, 'wideString');
});

test('网络基础模块提供请求、状态、错误和关闭闭环', () => {
  assert.deepEqual(NETWORK_LIBRARY_MODULES.map(module => module.id), [
    'lingbuilder.net.http-client', 'lingbuilder.cdp.client', 'lingbuilder.web.http', 'lingbuilder.net.tcp', 'lingbuilder.net.udp',
    'lingbuilder.net.dns', 'lingbuilder.net.url', 'lingbuilder.net.cookie', 'lingbuilder.net.ftp',
        'lingbuilder.net.pop3', 'lingbuilder.net.imap'
  ]);
  for (const manifest of NETWORK_LIBRARY_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
  assert.equal(NETWORK_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.net.http-client')?.minLingBuilderVersion, '0.2.8');
  const enabledModules: InstalledModule[] = NETWORK_LIBRARY_MODULES.map(manifest => ({
    manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        HTTP客户端_GET("https://example.com")', '        TCP_关闭()', '        UDP_关闭()', '        FTP_关闭()', '    结束', '结束类'].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /bool HTTP客户端_请求\(const wchar_t\* method/u);
  assert.match(mainCpp, /bool TCP_连接\(const wchar_t\* host/u);
  assert.match(mainCpp, /bool UDP_绑定\(int port\)/u);
  assert.match(mainCpp, /const wchar_t\* DNS_解析首个地址/u);
  assert.match(mainCpp, /static LB_UrlParts LB_ParseUrl/u);
  assert.match(mainCpp, /const wchar_t\* Cookie_设置/u);
  for (const commandName of ['Cookie_导出Netscape', 'Cookie_导出EditThisCookieJSON', 'Cookie_取错误']) {
    const cookieManifest = NETWORK_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.net.cookie')!;
    assert.ok(cookieManifest.contributes?.commands?.some(command => command.name === commandName), `Cookie 清单缺少 ${commandName}`);
    assert.ok(cookieManifest.bindings?.commands?.some(binding => binding.command === commandName && binding.runtimeName === commandName), `Cookie binding 缺少 ${commandName}`);
    assert.match(mainCpp, new RegExp(`const wchar_t\\* ${commandName}\\(`, 'u'), `Cookie 生成运行时缺少 ${commandName}`);
  }
  assert.match(mainCpp, /static bool LB_CookieReadRows/u);
  assert.match(mainCpp, /# Netscape HTTP Cookie File/u);
  assert.match(mainCpp, /bool FTP_连接\(const wchar_t\* host/u);
  assert.match(mainCpp, /HTTP客户端_GET\(L"https:\/\/example\.com"\);/u);
});

test('数据、数据库、加密、图像和媒体模块提供可生成实现', () => {
  assert.equal(DATA_MEDIA_MODULES.length, 16);
  for (const manifest of DATA_MEDIA_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
  const enabledModules: InstalledModule[] = DATA_MEDIA_MODULES.map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        哈希_SHA256文本("LingBuilder")', '        ODBC_关闭()', '        SQLite_关闭()', '        MySQL_关闭全部()', '        图像_取宽度("图片.png")', '        音频_停止()', '    结束', '结束类'].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /const wchar_t\* CSV_取字段/u);
  assert.match(mainCpp, /LB_HASH_PAIR\(SHA256/u);
  assert.match(mainCpp, /const wchar_t\* 哈希_BLAKE3文本/u);
  assert.match(mainCpp, /const wchar_t\* 密码_Argon2id哈希/u);
  assert.match(mainCpp, /LB_AEAD_WRAPPERS\(AES256GCM/u);
  assert.match(mainCpp, /const wchar_t\* 非对称_RSA生成私钥/u);
  assert.match(mainCpp, /const wchar_t\* 数据保护_加密文本/u);
  for (const runtimeSymbol of [
    'std::vector<unsigned char> 数据保护_加密字节集',
    'std::vector<unsigned char> 数据保护_解密字节集',
    'static std::vector<uint8_t> LB_SymmetricRawAead',
    'LB_RAW_AEAD_WRAPPERS(AES256GCM, "AES-256/GCM", 32, "AES-256-GCM")',
    'LB_RAW_AEAD_WRAPPERS(AES128GCM, "AES-128/GCM", 16, "AES-128-GCM")'
  ]) {
    assert.ok(mainCpp.includes(runtimeSymbol), `加密运行时缺少 ${runtimeSymbol}`);
  }
  // 裸 AEAD 与 DPAPI 字节集都必须字节进字节出，不能夹带 UTF-8 文本转换，否则二进制密钥会被破坏。
  const rawAeadBody = mainCpp.slice(mainCpp.indexOf('static std::vector<uint8_t> LB_SymmetricRawAead'), mainCpp.indexOf('#define LB_LEGACY_WRAPPERS'));
  assert.ok(!rawAeadBody.includes('LB_WideToUtf8'), '裸 AEAD 运行时不得把明文或密文按 UTF-8 文本转换');
  assert.ok(rawAeadBody.includes('return LB_SymmetricRawAead(true') && rawAeadBody.includes('return LB_SymmetricRawAead(false'), 'AES-256/AES-128 裸加解密必须成对复用同一实现');
  assert.match(mainCpp, /bool ODBC_连接/u);
  assert.match(mainCpp, /bool SQLite_加载运行库/u);
  assert.match(mainCpp, /long long MySQL_连接/u);
  assert.match(mainCpp, /void MySQL_关闭全部/u);
  assert.match(mainCpp, /LoadLibraryW\(path && path\[0\] \? path : L"libmariadb\.dll"\)/u);
  assert.match(mainCpp, /bool 图像_缩放/u);
  assert.match(mainCpp, /bool 截图_主屏到PNG/u);
  assert.match(mainCpp, /long long 位图_取像素ARGB/u);
  assert.match(mainCpp, /int 图标_取数量/u);
  assert.match(mainCpp, /bool 识图_模板匹配/u);
  assert.match(mainCpp, /bool 音频_播放WAV/u);
});

test('CSV 1.1 记录级解析与按编码读取：跨行引号字段、GBK 自动识别与表格快照句柄', () => {
  const manifest = DATA_MEDIA_MODULES.find(module => module.id === 'lingbuilder.data.csv')!;
  const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
  const bindingNames = manifest.bindings?.commands?.map(binding => binding.command) || [];
  assert.equal(manifest.version, '1.1.0');
  assert.equal(commandNames.length, 18);
  assert.deepEqual(bindingNames, commandNames, 'CSV 命令必须成对进入 contributes 与 bindings');
  assert.deepEqual(manifest.contributes?.types?.map(type => [type.name, type.cppType]), [['表格数据', 'long long']]);
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/csv/README.md');
  for (const required of ['CSV_打开文件', 'CSV_解析文本', '数据表_行数', '数据表_列数', '数据表_列名', '数据表_取文本', '数据表_单元格类型', '数据表_取整数', '数据表_取小数', '数据表_取布尔', '数据表_单元格为空', '数据表_关闭', '数据表_取错误']) {
    assert.ok(commandNames.includes(required), `CSV 1.1 缺少 ${required}`);
  }

  const openFile = manifest.bindings?.commands?.find(binding => binding.command === 'CSV_打开文件');
  assert.deepEqual(openFile?.parameters?.map(parameter => [parameter.name, parameter.type]), [
    ['文件路径', 'wideString'], ['编码名称', 'wideString'], ['分隔符', 'wideString'], ['含表头', 'bool']
  ]);
  assert.ok(openFile?.parameters?.[0]?.optional !== true, '文件路径必须必填');
  assert.deepEqual(openFile?.parameters?.slice(1)?.map(parameter => parameter.optional), [true, true, true], '可选参数必须位于尾部');
  assert.equal(openFile?.returnType, '表格数据');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === '数据表_行数')?.returnType, 'int');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === '数据表_关闭')?.returnType, 'bool');

  // 文件与字节集编码入口：缺省 UTF-8 语义不变，中文编码走同一份内核。
  const fsCore = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.fs.core')!;
  const readFileBinding = fsCore?.bindings?.commands?.find(binding => binding.command === '文件_读取文本');
  assert.deepEqual(readFileBinding?.parameters?.map(parameter => [parameter.name, parameter.type, parameter.optional === true]), [
    ['路径', 'wideString', false], ['编码名称', 'wideString', true]
  ]);
  const encoding = STANDARD_LIBRARY_MODULES.find(module => module.id === 'lingbuilder.std.encoding')!;
  const bytesToText = encoding.bindings?.commands?.find(binding => binding.command === '编码_字节集转文本');
  assert.deepEqual(bytesToText?.parameters?.map(parameter => parameter.type), ['bytes', 'wideString']);
  assert.equal(encoding.bindings?.commands?.find(binding => binding.command === '编码_文本转字节集')?.returnType, 'bytes');

  const sqliteManifest = DATA_MEDIA_MODULES.find(module => module.id === 'lingbuilder.database.sqlite')!;
  const enabledModules: InstalledModule[] = [manifest, sqliteManifest].map(item => ({
    manifest: item, installPath: `builtin://${item.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 表格数据 表 = CSV_打开文件("员工.csv", "GBK")',
      '        如果 (表 != 0)',
      '            调试输出(数据表_列名(表, 1))',
      '            调试输出(数据表_取文本(表, 1, 2))',
      '            数据表_关闭(表)',
      '        否则',
      '            调试输出(数据表_取错误())',
      '        如果结束',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(generated.blockingDiagnostics, [], '表格数据 名义类型必须通过语义检查');
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /CSV_打开文件\(L"员工\.csv", L"GBK"\);/u);
  assert.match(mainCpp, /数据表_列名\(表, 1\)/u);
  for (const symbol of [
    'static bool LB_CsvScanRecord', 'static bool LB_CsvNextRecord', 'static std::vector<std::vector<std::wstring>> LB_CsvParseRecords',
    'static LB_EncodingKind LB_AutoDetectEncodingKind', 'static bool LB_DecodeFileText',
    'long long CSV_打开文件(const wchar_t* path, const wchar_t* encoding = L"AUTO", const wchar_t* delimiter = L",", bool hasHeader = true)',
    'const wchar_t* 数据表_取文本', 'bool 数据表_关闭'
  ]) {
    assert.ok(mainCpp.includes(symbol), `CSV 运行时缺少 ${symbol}`);
  }
  // CSV 与 SQLite 同时启用：记录扫描器与编码内核各只有一份，虚拟表复用同一实现。
  assert.equal((mainCpp.match(/#define LB_TABULAR_SOURCE_RUNTIME_INCLUDED/gu) || []).length, 1, '表格内核被重复铺设');
  assert.equal((mainCpp.match(/#define LB_TEXT_CODECS_RUNTIME_INCLUDED/gu) || []).length, 1, '文本编解码内核被重复铺设');
  assert.ok(mainCpp.includes('create_module(database, "csv", &CsvVtabModule, nullptr)'), 'CSV 模块启用时 csv 虚拟表必须仍可用');

  // 使用骨架必须真的能编译：占位符填好后逐条塞进窗口事件再生成一次。
  const snippetSources: Array<{ label: string; snippet?: { insertText: string }; expect: string }> = [
    { label: 'CSV 表格快照骨架', snippet: (manifest.contributes?.snippets || []).find(item => item.label === 'CSV 读取表格快照'), expect: '数据表_列名' },
    { label: 'CSV 虚拟表入库骨架', snippet: (sqliteManifest.contributes?.snippets || []).find(item => item.label === 'CSV 虚拟表直连入库'), expect: 'CREATE VIRTUAL TABLE 导入_员工 USING csv' }
  ];
  for (const { label, snippet, expect } of snippetSources) {
    assert.ok(snippet, `缺少 ${label}`);
    const body = (snippet!.insertText || '')
      .replace(/\$1/gu, '员工.csv')
      .split('\n')
      .map(line => `    ${line}`);
    const snippetGenerated = generateLingCppNativeWin32Project(sampleProject, {
      lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', ...body, '    结束', '结束类'].join('\n'),
      enabledModules: [manifest, sqliteManifest].map(item => ({
        manifest: item, installPath: `builtin://${item.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
      }))
    });
    assert.deepEqual(snippetGenerated.blockingDiagnostics, [], `${label} 必须无阻断诊断`);
    const snippetCpp = snippetGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
    assert.ok(snippetCpp.includes(expect), `${label} 必须生成 ${expect}`);
  }
});

test('SQLite 2.3 提供多连接、参数化查询、事务、WAL、备份、多算法加密、csv 虚拟表和完整错误闭环', () => {
  const manifest = DATA_MEDIA_MODULES.find(module => module.id === 'lingbuilder.database.sqlite')!;
  const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
  const bindingNames = manifest.bindings?.commands?.map(binding => binding.command) || [];
  assert.equal(manifest.version, '2.3.0');
  assert.equal(commandNames.length, 73);
  assert.deepEqual(bindingNames, commandNames);
  assert.deepEqual(manifest.contributes?.types?.map(type => [type.name, type.cppType]), [
    ['SQLite连接', 'long long'],
    ['SQLite语句', 'long long']
  ]);
  for (const required of [
    'SQLite_打开连接', 'SQLite_打开加密库', 'SQLite_打开加密连接', 'SQLite_运行库是否支持加密', 'SQLite_设置加密算法', 'SQLite_探测加密算法', 'SQLite_准备', 'SQLite_绑定空值', 'SQLite_绑定长整数', 'SQLite_绑定文本', 'SQLite_绑定字节集',
    'SQLite_语句步进', 'SQLite_取列类型', 'SQLite_取列字节集', 'SQLite_开始事务', 'SQLite_创建保存点',
    'SQLite_启用WAL', 'SQLite_WAL检查点', 'SQLite_备份到文件', 'SQLite_完整性检查', 'SQLite_中断',
    'SQLite_取扩展错误码', 'SQLite_取系统错误码'
  ]) {
    assert.ok(commandNames.includes(required), `SQLite 2.2 缺少 ${required}`);
  }
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_绑定字节集')?.parameters?.map(parameter => parameter.type),
    ['SQLite语句', 'int', 'bytes']
  );
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_打开加密连接')?.parameters?.map(parameter => parameter.type),
    ['wideString', 'wideString', 'int', 'int']
  );
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_设置加密算法')?.parameters?.map(parameter => [parameter.name, parameter.type]),
    [['算法', 'wideString']]
  );
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_探测加密算法')?.parameters?.map(parameter => [parameter.name, parameter.type]),
    [['数据库路径', 'wideString'], ['密码', 'wideString']]
  );
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_设置加密算法')?.returnType, 'bool');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_探测加密算法')?.returnType, 'wideString');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_取列字节集')?.returnType, 'bytes');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_打开连接')?.returnType, 'SQLite连接');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_打开加密连接')?.returnType, 'SQLite连接');
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/sqlite/README.md');
  assert.equal(manifest.contributes?.docs?.[0]?.title, 'SQLite 数据库模块 2.3 使用说明');
  assert.ok(commandNames.includes('SQLite_取虚拟表支持'), 'SQLite 2.3 必须暴露虚拟表能力自查命令');
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_取虚拟表支持')?.parameters?.map(parameter => parameter.type),
    ['SQLite连接']
  );
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'SQLite_取虚拟表支持')?.returnType, 'wideString');

  const enabledModules: InstalledModule[] = [{
    manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  }];
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 SQLite连接 数据库 = SQLite_打开连接("data/app.db", 0, 5000)',
      '        局部 SQLite语句 查询 = SQLite_准备(数据库, "SELECT ?1")',
      '        SQLite_绑定文本(查询, 1, "中文")',
      '        SQLite_语句释放(查询)',
      '        SQLite_关闭连接(数据库)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const runtimeSymbol of [
    'namespace LingBuilderSqlite', 'long long SQLite_打开连接', 'long long SQLite_准备',
    'bool SQLite_绑定字节集', 'std::vector<unsigned char> SQLite_取列字节集',
    'bool SQLite_备份到文件', 'const wchar_t* SQLite_完整性检查'
  ]) {
    assert.ok(mainCpp.includes(runtimeSymbol), `SQLite 生成运行时缺少 ${runtimeSymbol}`);
  }
  assert.match(mainCpp, /SQLite_打开连接\(L"data\/app\.db", 0, 5000\)/u);
  assert.match(mainCpp, /SQLite_绑定文本\(查询, 1, L"中文"\)/u);

  // csv 虚拟表随 SQLite 模块铺设：虚拟表 ABI 结构、参数解析与注册调用都要真实生成。
  for (const vtabSymbol of [
    'struct sqlite3_vtab', 'struct sqlite3_module', 'static const sqlite3_module CsvVtabModule',
    'static int CsvVtabConnect', 'declare_vtab(database, declaration.c_str())',
    'create_module(database, "csv", &CsvVtabModule, nullptr)',
    'const wchar_t* SQLite_取虚拟表支持'
  ]) {
    assert.ok(mainCpp.includes(vtabSymbol), `SQLite csv 虚拟表缺少 ${vtabSymbol}`);
  }
  const openConnectionBody = mainCpp.slice(mainCpp.indexOf('static long long OpenConnection'), mainCpp.indexOf('bool SQLite_加载运行库'));
  assert.ok(openConnectionBody.includes('csvVirtualTablesReady = RegisterCsvVirtualTable(database)'), 'csv 虚拟表必须在打开连接时注册');
  assert.ok(
    openConnectionBody.indexOf('busy_timeout(database, waitMilliseconds)') < openConnectionBody.indexOf('RegisterCsvVirtualTable(database)'),
    '虚拟表注册必须晚于忙等待设置，失败连接不参与注册'
  );
  assert.equal((mainCpp.match(/#define LB_TEXT_CODECS_RUNTIME_INCLUDED/gu) || []).length, 1, '文本编解码内核必须只铺设一份');
  assert.equal((mainCpp.match(/static bool LB_CsvNextRecord/gu) || []).length, 1, 'CSV 记录扫描器必须只铺设一份');

  const encryptedGenerated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 SQLite连接 安全库 = SQLite_打开加密连接("data/app.db", "我的密码", 0, 5000)',
      '        如果 (SQLite_运行库是否支持加密())',
      '            SQLite_打开加密库("data/cache.db", "另一个密码")',
      '        如果结束',
      '        SQLite_关闭连接(安全库)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(encryptedGenerated.blockingDiagnostics, []);
  const encryptedMainCpp = encryptedGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const runtimeSymbol of [
    'using FnKey = int(*)(sqlite3*, const char*, int);',
    'long long SQLite_打开加密连接(const wchar_t* path, const wchar_t* password, int mode, int waitMilliseconds)',
    'bool SQLite_打开加密库(const wchar_t* path, const wchar_t* password)',
    'bool SQLite_运行库是否支持加密()',
    'PRAGMA cipher=sqlcipher',
    'SELECT count(*) FROM sqlite_master'
  ]) {
    assert.ok(encryptedMainCpp.includes(runtimeSymbol), `SQLite 加密运行时缺少 ${runtimeSymbol}`);
  }
  assert.match(encryptedMainCpp, /SQLite_打开加密连接\(L"data\/app\.db", L"我的密码", 0, 5000\)/u);
  assert.match(encryptedMainCpp, /SQLite_打开加密库\(L"data\/cache\.db", L"另一个密码"\)/u);

  const algorithmGenerated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        文本型 算法 = SQLite_探测加密算法("data/legacy.db", "旧密码")',
      '        如果 (算法 != "")',
      '            SQLite_设置加密算法(算法)',
      '        如果结束',
      '        SQLite_设置加密算法("rc4")',
      '        局部 SQLite连接 旧库 = SQLite_打开加密连接("data/legacy.db", "旧密码", 2, 5000)',
      '        SQLite_关闭连接(旧库)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(algorithmGenerated.blockingDiagnostics, []);
  const algorithmMainCpp = algorithmGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const runtimeSymbol of [
    'bool SQLite_设置加密算法(const wchar_t* algorithm)',
    'const wchar_t* SQLite_探测加密算法(const wchar_t* path, const wchar_t* password)',
    'PRAGMA cipher_compatibility=3',
    'PRAGMA cipher=rc4'
  ]) {
    assert.ok(algorithmMainCpp.includes(runtimeSymbol), `SQLite 多算法加密运行时缺少 ${runtimeSymbol}`);
  }
  assert.ok(algorithmMainCpp.includes('SnapshotPendingCipher'), 'SQLite 加密打开路径必须按待用算法注入 PRAGMA');
  assert.match(algorithmMainCpp, /SQLite_探测加密算法\(L"data\/legacy\.db", L"旧密码"\)/u);
  assert.match(algorithmMainCpp, /SQLite_设置加密算法\(L"rc4"\)/u);
  assert.match(algorithmMainCpp, /SQLite_打开加密连接\(L"data\/legacy\.db", L"旧密码", 2, 5000\)/u);
});

test('MySQL 1.0 提供密码连接、参数化查询、事务和完整错误闭环', () => {
  const manifest = DATA_MEDIA_MODULES.find(module => module.id === 'lingbuilder.database.mysql')!;
  const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
  const bindingNames = manifest.bindings?.commands?.map(binding => binding.command) || [];
  assert.equal(manifest.version, '1.0.0');
  assert.equal(commandNames.length, 43);
  assert.deepEqual(bindingNames, commandNames);
  assert.deepEqual(manifest.contributes?.types?.map(type => [type.name, type.cppType]), [
    ['MySQL连接', 'long long'],
    ['MySQL语句', 'long long']
  ]);
  for (const required of [
    'MySQL_加载运行库', 'MySQL_连接', 'MySQL_连接扩展', 'MySQL_关闭连接', 'MySQL_取错误',
    'MySQL_准备', 'MySQL_绑定空值', 'MySQL_绑定长整数', 'MySQL_绑定文本', 'MySQL_绑定字节集',
    'MySQL_语句执行', 'MySQL_语句步进', 'MySQL_语句重置', 'MySQL_语句释放', 'MySQL_取列是否为空',
    'MySQL_取列长整数', 'MySQL_取列字节集', 'MySQL_开始事务', 'MySQL_提交', 'MySQL_回滚',
    'MySQL_设置自动提交', 'MySQL_取最后插入ID', 'MySQL_取连接错误'
  ]) {
    assert.ok(commandNames.includes(required), `MySQL 1.0 缺少 ${required}`);
  }
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_绑定字节集')?.parameters?.map(parameter => parameter.type),
    ['MySQL语句', 'int', 'bytes']
  );
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_连接')?.parameters?.map(parameter => parameter.type),
    ['wideString', 'int', 'wideString', 'wideString', 'wideString']
  );
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_连接扩展')?.parameters?.map(parameter => parameter.type),
    ['wideString', 'int', 'wideString', 'wideString', 'wideString', 'int', 'bool']
  );
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_连接')?.returnType, 'MySQL连接');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_准备')?.returnType, 'MySQL语句');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'MySQL_取列字节集')?.returnType, 'bytes');
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/mysql/README.md');
  assert.deepEqual(
    manifest.targets?.map(target => [target.id, target.runtimeFiles]),
    [
      ['windows-msvc-win32', ['x86/libmariadb.dll']],
      ['windows-msvc-x64', ['x64/libmariadb.dll']]
    ]
  );

  const enabledModules: InstalledModule[] = [{
    manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  }];
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 MySQL连接 数据库 = MySQL_连接("127.0.0.1", 3306, "root", "机密密码", "test")',
      '        局部 MySQL语句 写入 = MySQL_准备(数据库, "INSERT INTO users(name, score) VALUES(?, ?)")',
      '        MySQL_绑定文本(写入, 1, "中文张三")',
      '        MySQL_绑定整数(写入, 2, 95)',
      '        MySQL_语句执行(写入)',
      '        MySQL_语句释放(写入)',
      '        MySQL_开始事务(数据库)',
      '        MySQL_提交(数据库)',
      '        MySQL_关闭连接(数据库)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const runtimeSymbol of [
    'namespace LingBuilderMysql',
    'long long MySQL_连接(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database)',
    'long long MySQL_连接扩展(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database, int timeoutSeconds, bool enableSsl)',
    'long long MySQL_准备(long long connectionId, const wchar_t* sql)',
    'int MySQL_语句步进(long long statementId)',
    'const wchar_t* MySQL_取列文本(long long statementId, int columnIndex)',
    'std::vector<unsigned char> MySQL_取列字节集(long long statementId, int columnIndex)',
    'bool MySQL_开始事务(long long connectionId)',
    'LoadLibraryW(path && path[0] ? path : L"libmariadb.dll")',
    'OptSslEnforce = 38',
    'std::string charset = "utf8mb4"'
  ]) {
    assert.ok(mainCpp.includes(runtimeSymbol), `MySQL 生成运行时缺少 ${runtimeSymbol}`);
  }
  assert.match(mainCpp, /MySQL_连接\(L"127\.0\.0\.1", 3306, L"root", L"机密密码", L"test"\)/u);
  assert.match(mainCpp, /MySQL_绑定文本\(写入, 1, L"中文张三"\)/u);
});

test('Excel 表格模块 1.0 提供创建/打开双模式、单元格级读写与格式能力', async () => {
  const manifest = DATA_MEDIA_MODULES.find(module => module.id === 'lingbuilder.data.excel')!;
  const commandNames = manifest.contributes?.commands?.map(command => command.name) || [];
  const bindingNames = manifest.bindings?.commands?.map(binding => binding.command) || [];
  assert.equal(manifest.version, '1.0.0');
  assert.equal(commandNames.length, 45);
  assert.deepEqual(bindingNames, commandNames);
  assert.deepEqual(manifest.contributes?.types?.map(type => [type.name, type.cppType]), [['Excel工作簿', 'long long']]);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  for (const required of [
    'Excel_创建工作簿', 'Excel_打开工作簿', 'Excel_保存', 'Excel_另存为', 'Excel_关闭',
    'Excel_取工作表数量', 'Excel_取工作表名', 'Excel_取当前工作表', 'Excel_置当前工作表', 'Excel_添加工作表', 'Excel_删除工作表',
    'Excel_写文本', 'Excel_写数值', 'Excel_写布尔', 'Excel_写公式', 'Excel_写日期', 'Excel_清除单元格',
    'Excel_读单元格文本', 'Excel_读单元格数值', 'Excel_读单元格公式', 'Excel_取单元格类型', 'Excel_是否为空单元格',
    'Excel_写一行', 'Excel_追加行', 'Excel_读区域', 'Excel_取已用范围',
    'Excel_置列宽', 'Excel_置行高', 'Excel_合并单元格', 'Excel_冻结窗格', 'Excel_置数字格式', 'Excel_置加粗', 'Excel_置字号', 'Excel_置字体颜色', 'Excel_置背景色', 'Excel_置水平对齐',
    'Excel_插入行', 'Excel_删除行', 'Excel_插入列', 'Excel_删除列',
    'Excel_日期转序列', 'Excel_序列转日期', 'Excel_取错误', 'Excel_取版本', 'Excel_是否可用'
  ]) {
    assert.ok(commandNames.includes(required), `Excel 1.0 缺少 ${required}`);
  }
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'Excel_创建工作簿')?.returnType, 'Excel工作簿');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'Excel_打开工作簿')?.returnType, 'Excel工作簿');
  assert.deepEqual(
    manifest.bindings?.commands?.find(binding => binding.command === 'Excel_写一行')?.parameters?.map(parameter => parameter.type),
    ['Excel工作簿', 'wideString', 'wideString', 'wideString']
  );
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'Excel_追加行')?.returnType, 'int');
  assert.equal(manifest.contributes?.docs?.[0]?.path, 'docs/modules/excel/README.md');
  await fs.access(path.resolve('docs', 'modules', 'excel', 'README.md')).then(() => null, () => { throw new Error('Excel 模块随包文档必须存在'); });
  assert.deepEqual(
    manifest.targets?.map(target => [target.id, target.runtimeFiles]),
    [
      ['windows-msvc-win32', ['x86/LingBuilderExcel.dll']],
      ['windows-msvc-x64', ['x64/LingBuilderExcel.dll']]
    ]
  );
  const enabledModules: InstalledModule[] = [{
    manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  }];
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 Excel工作簿 报表 = Excel_创建工作簿("报表/月度.xlsx")',
      '        Excel_写一行(报表, "A1", "姓名\t销量", "\t")',
      '        Excel_追加行(报表, "张三\t12", "\t")',
      '        Excel_置加粗(报表, "A1", 真)',
      '        如果 Excel_保存(报表)',
      '            调试输出("已保存")',
      '        结束',
      '        Excel_关闭(报表)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const runtimeSymbol of [
    'namespace LingBuilderExcelBridge',
    'long long Excel_创建工作簿(const wchar_t* 文件路径)',
    'bool Excel_写一行(long long 工作簿, const wchar_t* 起始单元格, const wchar_t* 行内容, const wchar_t* 分隔符)',
    'int Excel_追加行(long long 工作簿, const wchar_t* 行内容, const wchar_t* 分隔符)',
    'bool Excel_置加粗(long long 工作簿, const wchar_t* 单元格, bool 启用)',
    'LoadLibraryW(L"LingBuilderExcel.dll")',
    'fCreate && fOpen && fSave'
  ]) {
    assert.ok(mainCpp.includes(runtimeSymbol), `Excel 生成运行时缺少 ${runtimeSymbol}`);
  }
  assert.match(mainCpp, /Excel_创建工作簿\(L"报表\/月度\.xlsx"\)/u);
  assert.match(mainCpp, /Excel_写一行\(报表, L"A1", L"姓名\t销量", L"\t"\)/u);
});
test('平台扩展和高风险模块保持独立启用并具有确定性运行时', () => {
  assert.equal(PLATFORM_ADVANCED_MODULES.length, 13);
  for (const manifest of PLATFORM_ADVANCED_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
  const enabledModules: InstalledModule[] = PLATFORM_ADVANCED_MODULES.map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        IPC_关闭()', '        键盘钩子_停止()', '        COM_关闭(0)', '    结束', '结束类'].join('\n'), enabledModules });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  ['压缩_ZIP创建', 'SMTP_发送普通邮件', 'IPC_创建管道服务端', '菜单_创建', '托盘_添加', '辅助_取名称', '内存_申请', '内存DLL_加载', '内存DLL_取函数地址', '内存DLL_卸载', '键盘钩子_启动', '进程内存_打开', 'COM_创建对象', 'CPU_取厂商', '设备_打开'].forEach(name => assert.ok(mainCpp.includes(name), `缺少 ${name} C++ 运行时`));
});

test('进程内存扫描族命令登记清单与 binding，并生成真实运行时符号', () => {
  const manifest = PLATFORM_ADVANCED_MODULES.find(item => item.id === 'lingbuilder.advanced.process-memory');
  assert.ok(manifest);
  assert.equal(manifest.version, '1.1.0');
  assert.ok(manifest.dependencies?.some(dependency => dependency.moduleId === 'lingbuilder.std.buffer'), '进程内存模块必须声明缓冲区模块依赖');
  assert.ok(!manifest.description.includes('不默认启用'), '模块描述必须与默认启用语义一致');
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  ['进程内存_打开', '进程内存_读整数', '进程内存_写整数', '进程内存_读字节集', '进程内存_读到缓冲区', '进程内存_枚举区域JSON', '进程内存_扫描字节集', '进程内存_扫描字节集JSON', '进程内存_取错误码', '进程内存_取错误', '进程内存_关闭'].forEach(name => {
    assert.ok(commandNames.has(name), `缺少命令 ${name}`);
  });
  const scan = manifest.bindings?.commands?.find(binding => binding.command === '进程内存_扫描字节集');
  assert.ok(scan, '进程内存_扫描字节集 必须有 binding');
  assert.equal(scan?.parameters?.[1]?.type, 'bytes', '特征字节集参数必须是字节集类型');
  assert.equal(scan?.parameters?.[3]?.type, 'array', '结果数组参数必须是数组类型');
  const readBytes = manifest.bindings?.commands?.find(binding => binding.command === '进程内存_读字节集');
  assert.equal(readBytes?.returnType, 'bytes', '读字节集 返回字节集');

  const processModule = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.process');
  assert.ok(processModule);
  const processCommands = new Set(processModule.contributes?.commands?.map(command => command.name));
  ['进程_按名称取ID列表', '进程_按名称取ID列表JSON'].forEach(name => {
    assert.ok(processCommands.has(name), `进程管理模块缺少命令 ${name}`);
  });
  const systemInfo = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.system.info');
  assert.ok(systemInfo?.contributes?.commands?.some(command => command.name === '系统_是否管理员'), '系统信息模块缺少 系统_是否管理员');

  const enabledModules: InstalledModule[] = [processModule, systemInfo, ...PLATFORM_ADVANCED_MODULES.filter(item => item.id === 'lingbuilder.advanced.process-memory' || item.id === 'lingbuilder.std.buffer')]
    .map(m => ({ manifest: m, installPath: `builtin://${m.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 文本型 名单[]',
      '        进程_按名称取ID列表("explorer.exe", 名单)',
      '        局部 文本型 JSON名单',
      '        JSON名单 = 进程_按名称取ID列表JSON("explorer.exe")',
      '        调试输出(系统_是否管理员())',
      '        调试输出(进程内存_取错误())',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  ['CreateToolhelp32Snapshot', '进程_按名称取ID列表', '进程_按名称取ID列表JSON', '系统_是否管理员', 'AllocateAndInitializeSid', 'CheckTokenMembership', '进程内存_读字节集', '进程内存_读到缓冲区', 'VirtualQueryEx', '进程内存_枚举区域JSON', '进程内存_扫描字节集', '进程内存_扫描字节集JSON', '进程内存_取错误码', '进程内存_取错误', 'ReadProcessMemory', '缓冲区_从字节集'].forEach(name => assert.ok(mainCpp.includes(name), `生成运行时缺少 ${name}`));
});

test('requireAdministrator 通过导出工程 UAC 节与直编链接参数生效，缺省保持 asInvoker', async () => {
  const { createVisualStudioProjectExportContent } = await import('../src/services/windowDesigner/visualStudioProjectExporter');
  const { REQUIRE_ADMINISTRATOR_LINK_ARGS } = await import('../src/services/windowDesigner/windowsSystemLibraries');

  assert.deepEqual([...REQUIRE_ADMINISTRATOR_LINK_ARGS], ["/MANIFESTUAC:level='requireAdministrator'"], '直编链接参数必须请求 requireAdministrator 提权级别');

  const baseOptions: import('../src/services/windowDesigner/visualStudioProjectExporter').VisualStudioProjectExportOptions = {
    projectDir: 'unused',
    projectId: 'uac-demo',
    generatedFiles: [],
    enabledModules: [],
    platformToolset: 'v143'
  };
  const withUac = createVisualStudioProjectExportContent({ ...baseOptions, requireAdministrator: true });
  const withUacVcxproj = withUac.files.find(file => file.relativePath.endsWith('.vcxproj'))?.content || '';
  assert.match(withUacVcxproj, /<UACExecutionLevel>RequireAdministrator<\/UACExecutionLevel>/u);
  assert.match(withUacVcxproj, /<EnableUAC>true<\/EnableUAC>/u);

  const withoutUac = createVisualStudioProjectExportContent({ ...baseOptions });
  const withoutUacVcxproj = withoutUac.files.find(file => file.relativePath.endsWith('.vcxproj'))?.content || '';
  assert.ok(!withoutUacVcxproj.includes('UACExecutionLevel'), '缺省导出不得写入 UAC 节（保持 asInvoker 历史行为）');
});

test('COM 自动化模块 2.0 提供句柄制创建、免注册、OCX 宿主、事件挂接与接口信息', () => {
  const manifest = PLATFORM_ADVANCED_MODULES.find(item => item.id === 'lingbuilder.advanced.com');
  assert.ok(manifest);
  assert.equal(manifest.version, '2.0.0');
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, 'COM manifest 应通过校验');
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  ['COM_创建对象', 'COM_创建对象免注册', 'COM_创建OCX组件', 'COM_取OCX对象', 'COM_取文本属性', 'COM_取数值属性', 'COM_取逻辑属性', 'COM_取对象属性', 'COM_置文本属性', 'COM_调用方法', 'COM_调用文本方法', 'COM_调用数值方法', 'COM_调用逻辑方法', 'COM_调用对象方法', 'COM_挂接事件', 'COM_映射事件', 'COM_取消挂接事件', 'COM_取事件对象参数', 'COM_启用OCX消息转发', 'COM_移除OCX消息转发', 'COM_取接口信息', 'COM_关闭', 'COM_关闭全部', 'COM_取错误'].forEach(name => {
    assert.ok(commandNames.has(name), `缺少命令 ${name}`);
  });
  const mapping = manifest.bindings?.commands?.find(binding => binding.command === 'COM_映射事件');
  assert.ok(mapping, 'COM_映射事件 必须有 binding');
  const handlerParameter = mapping?.parameters?.find(parameter => parameter.type === 'handler');
  assert.deepEqual(handlerParameter?.handlerSignature, { parameterTypes: ['整数型', '文本型'], returnType: '空' });
  const ocx = manifest.bindings?.commands?.find(binding => binding.command === 'COM_创建OCX组件');
  const parentParameter = ocx?.parameters?.find(parameter => parameter.type === 'controlRef');
  assert.equal(parentParameter?.runtimeRepresentation, 'nativeHandle');
  assert.equal(parentParameter?.scope, 'currentWindow');

  const comModule: InstalledModule = { manifest: manifest!, installPath: 'builtin://lingbuilder.advanced.com', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const source = [
    '类 MainWindow',
    '    长整数型 浏览器',
    '    事件 _MainWindow_创建完毕()',
    '        浏览器 = COM_创建OCX组件(当前窗口, "{8856F961-340A-11D0-A96B-00C04FD705A2}", 12, 64, 620, 380, 1)',
    '        COM_挂接事件(浏览器)',
    '        COM_映射事件(浏览器, 102, &网页_状态文本改变, 7)',
    '        COM_启用OCX消息转发()',
    '        COM_调用方法(浏览器, "Navigate2", "https://www.lingbuilder.com")',
    '        COM_取接口信息(浏览器)',
    '    结束',
    '    事件 网页_状态文本改变(整数型 用户数据, 文本型 参数文本)',
    '        调试输出(参数文本)',
    '    结束',
    '结束类'
  ].join('\n');
  const completions = getLingCppCompletions({ source: 'COM_', line: 1, column: 5 }, { enabledModules: [comModule], availableModules: [comModule] });
  assert.ok(completions.some(item => item.label === 'COM_创建对象免注册'));
  const languageContext = { availableModules: [comModule], enabledModules: [comModule] };
  const validDiagnostics = getLingCppSemanticDiagnostics(source, undefined, 'src/MainWindow.lcpp', languageContext)
    .filter(item => item.id.startsWith('lingcpp-handler-'));
  assert.deepEqual(validDiagnostics, [], `事件处理器签名应通过校验：${JSON.stringify(validDiagnostics)}`);
  const badHandlerDiagnostics = getLingCppSemanticDiagnostics(source.replace('&网页_状态文本改变', '网页_状态文本改变'), undefined, 'src/MainWindow.lcpp', languageContext)
    .filter(item => item.id.includes('lingcpp-handler-reference'));
  assert.ok(badHandlerDiagnostics.some(item => item.level === 'error'), '处理器必须使用 &引用语法');

  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, enabledModules: [comModule] });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  ['LingComEventSink', 'LB_ComCreateRegistryFree', 'LB_ComCreateOcx', 'LB_ComDescribeObject', 'WM_LINGBUILDER_COM_EVENT', 'LB_ComDrainQueuedEvents', 'COM_关闭全部()'].forEach(name => assert.ok(mainCpp.includes(name), `缺少 COM v2 运行时 ${name}`));
  assert.ok(mainCpp.includes('LingDispatchComEventByName(const wchar_t* handler, long long userData, const wchar_t* paramsText) override'), '窗口类必须生成 COM 事件派发分支');
  assert.ok(mainCpp.includes('网页_状态文本改变(lbUserData, lbParams)'), '派发分支必须调用映射的中文处理器');
  assert.ok(mainCpp.includes('LingCppControlNativeHandle(L"当前窗口")') || mainCpp.includes('hwnd_'), 'controlRef 父窗口必须解析为原生窗口句柄');
});

test('模块封装清单覆盖实际内置模块注册表', async () => {
  const checklist = await fs.readFile(path.resolve('..', 'docs', 'MODULE_ENCAPSULATION_CHECKLIST.md'), 'utf8');
  const commandCount = BUILTIN_MODULES.reduce((total, manifest) => total + (manifest.contributes?.commands?.length ?? 0), 0);
  assert.ok(checklist.includes(`${BUILTIN_MODULES.length} 个内置模块、${commandCount} 条中文命令`));
  assert.match(checklist, /51 个模块、336 条命令/u);
  assert.match(checklist, /`lingbuilder\.std\.encoding` \| 编码转换模块 \| 32/u);
  assert.match(checklist, /`lingbuilder\.win32\.basic` \| Win32 窗口基础模块 \| 206/u);
  for (const manifest of BUILTIN_MODULES) {
    assert.ok(checklist.includes(`\`${manifest.id}\``), `封装清单缺少 ${manifest.id}`);
  }
});

test('module service defaults ordinary projects to basic, process-memory and its buffer dependency', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-defaults-'));
  const service = createModuleService(root);

  const enabledModules = await service.getEnabledProjectModules('fresh-win32-project');
  assert.deepEqual(
    new Set(enabledModules.map(module => module.manifest.id)),
    new Set(['lingbuilder.win32.basic', 'lingbuilder.advanced.process-memory', 'lingbuilder.std.buffer'])
  );

  await assert.rejects(
    () => service.disableModuleForProject('fresh-win32-project', 'lingbuilder.win32.basic'),
    /不能禁用/
  );
});

test('default-enabled process-memory module can be opted out and re-enabled per project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-optout-'));
  await writeSolutionFixture(root, ['project-a']);
  const service = createModuleService(root);

  await service.disableModuleForProject('project-a', 'lingbuilder.advanced.process-memory');
  const afterDisable = new Set((await service.getEnabledProjectModules('project-a')).map(module => module.manifest.id));
  assert.ok(!afterDisable.has('lingbuilder.advanced.process-memory'), '显式禁用后默认补齐不得再把进程内存模块加回来');
  assert.ok(afterDisable.has('lingbuilder.std.buffer'), '缓冲区模块是独立依赖，禁用主模块后仍保留');

  const refsOnDisk = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'projects', 'project-a', 'project-modules.json'), 'utf8'));
  assert.ok(refsOnDisk.optOutDefaultModuleIds.includes('lingbuilder.advanced.process-memory'), 'opt-out 必须持久化到 project-modules.json');

  await service.enableModuleForProject('project-a', 'lingbuilder.advanced.process-memory');
  const afterEnable = new Set((await service.getEnabledProjectModules('project-a')).map(module => module.manifest.id));
  assert.ok(afterEnable.has('lingbuilder.advanced.process-memory') && afterEnable.has('lingbuilder.std.buffer'), '重新启用后进程内存模块连同缓冲区依赖一起生效');
});

test('Win32基础模块贡献窗口事件上下文命令和确定性绑定', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  const bindingNames = new Set(manifest.bindings?.commands?.map(binding => binding.command));
  ['窗口_取消关闭', '窗口_取事件宽度', '窗口_取事件字符', '窗口_标记按键已处理', '窗口_取事件DPI', '窗口_取拖入文件'].forEach(name => {
    assert.ok(commandNames.has(name), `${name} 应提供中文补全`);
    assert.ok(bindingNames.has(name), `${name} 应提供确定性 C++ binding`);
  });

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.win32.basic',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const completions = getLingCppCompletions(
    { source: '窗口_', line: 1, column: 4 },
    { enabledModules: [module], availableModules: [module] }
  );
  assert.ok(completions.some(item => item.label === '窗口_取消关闭'));
  assert.ok(completions.some(item => item.label === '窗口_取拖入文件'));

  const parameterDiagnostics = getLingCppSemanticDiagnostics(
    '类 MainWindow\n    事件 _MainWindow_关闭前(整数型 原因)\n    结束\n结束类',
    { ...sampleProject, windows: [{ ...sampleProject.windows[0], events: { Closing: '_MainWindow_关闭前' } }] }
  );
  assert.ok(parameterDiagnostics.some(item => item.id.includes('lingcpp-window-event-parameters')));

  const generated = generateLingCppNativeWin32Project({
    ...sampleProject,
    windows: [{ ...sampleProject.windows[0], events: { Closing: '_MainWindow_关闭前', FileDropped: '_MainWindow_文件被拖入' } }]
  }, {
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_关闭前()',
      '        窗口_取消关闭()',
      '    结束',
      '    事件 _MainWindow_文件被拖入()',
      '        调试输出(窗口_取拖入文件(0))',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules: [module]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /窗口_取消关闭\(\);/u);
  assert.match(mainCpp, /调试输出\(窗口_取拖入文件\(0\)\);/u);
});

test('module project references stay isolated and unknown project writes are rejected', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-projects-'));
  await writeSolutionFixture(root, ['project-a', 'project-b']);
  const manifest = createTestModule().manifest;
  await writeFixture(
    path.join(root, '.lingbuilder', 'modules', manifest.id, 'lingbuilder.module.json'),
    JSON.stringify(manifest, null, 2)
  );
  const service = createModuleService(root);

  await service.enableModuleForProject('project-a', manifest.id);
  assert.ok((await service.getEnabledProjectModules('project-a')).some(module => module.manifest.id === manifest.id));
  assert.ok(!(await service.getEnabledProjectModules('project-b')).some(module => module.manifest.id === manifest.id));
  await assert.rejects(() => service.enableModuleForProject('missing-project', manifest.id), /项目不存在/);
});

test('existing solution projects without a manifest inherit the workspace module selection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-inheritance-'));
  await writeSolutionFixture(root, ['project-a']);
  await writeFixture(path.join(root, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'],
    pinnedVersions: {
      'lingbuilder.win32.basic': '1.0.0',
      'lingbuilder.win32.common-controls': '1.0.0'
    }
  }, null, 2));

  const service = createModuleService(root);
  const enabled = await service.getEnabledProjectModules('project-a');
  assert.ok(enabled.some(module => module.manifest.id === 'lingbuilder.win32.common-controls'));
  // 继承工作区选择之外，默认启用补齐还会追加 进程内存模块（含其依赖 缓冲区模块）。
  assert.deepEqual(await service.getProjectModuleIds('project-a'), [
    'lingbuilder.win32.basic',
    'lingbuilder.win32.common-controls',
    'lingbuilder.advanced.process-memory',
    'lingbuilder.std.buffer'
  ]);
});

test('module enable plan is side-effect free and can join a source copy transaction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-plan-'));
  await writeSolutionFixture(root, ['project-a']);
  const manifest = createTestModule().manifest;
  await writeFixture(
    path.join(root, '.lingbuilder', 'modules', manifest.id, 'lingbuilder.module.json'),
    JSON.stringify(manifest, null, 2)
  );
  const service = createModuleService(root);
  const plan = await service.planEnableModulesForProject('project-a', [manifest.id]);
  assert.deepEqual(plan.addedModuleIds, [manifest.id]);
  assert.match(plan.targetPath, /projects[\\/]project-a[\\/]project-modules\.json$/u);
  assert.ok(JSON.parse(plan.sourceCode).enabledModuleIds.includes(manifest.id));
  assert.ok(!(await service.getEnabledProjectModules('project-a')).some(module => module.manifest.id === manifest.id));
});

test('FBro submodules recursively enable the 2.1.0 v3 event core and require confirmed cascade disable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-fbro-dependencies-'));
  await writeSolutionFixture(root, ['project-a']);
  const service = createModuleService(root);

  const plan = await service.planEnableModulesForProject('project-a', ['lingbuilder.fbro.objects', 'lingbuilder.fbro.events']);
  assert.deepEqual(plan.requestedModuleIds, ['lingbuilder.fbro.objects', 'lingbuilder.fbro.events']);
  assert.deepEqual(plan.dependencyModuleIds, ['lingbuilder.fbro.browser']);
  assert.equal(plan.addedModuleIds[0], 'lingbuilder.fbro.browser');
  await service.enableModuleForProject('project-a', 'lingbuilder.fbro.objects');
  await service.enableModuleForProject('project-a', 'lingbuilder.fbro.events');

  const disablePlan = await service.planDisableModuleForProject('project-a', 'lingbuilder.fbro.browser');
  assert.deepEqual(new Set(disablePlan.dependentModuleIds), new Set(['lingbuilder.fbro.objects', 'lingbuilder.fbro.events']));
  await assert.rejects(() => service.disableModuleForProject('project-a', 'lingbuilder.fbro.browser'), /级联禁用/u);
  await service.disableModuleForProject('project-a', 'lingbuilder.fbro.browser', { cascade: true });
  const enabled = await service.getEnabledProjectModules('project-a');
  assert.ok(!enabled.some(item => item.manifest.id.startsWith('lingbuilder.fbro.')));
});

test('FBro browser 2.5 keeps 2.1 submodules compatible with the v3 event core', () => {
  const callable = BUILTIN_MODULES.filter(module => module.id.startsWith('lingbuilder.fbro.')
    && module.id !== 'lingbuilder.fbro.sdk');
  assert.deepEqual(new Set(callable.map(module => module.id)), new Set([
    'lingbuilder.fbro.browser',
    'lingbuilder.fbro.events',
    'lingbuilder.fbro.session',
    'lingbuilder.fbro.transfer',
    'lingbuilder.fbro.automation',
    'lingbuilder.fbro.objects',
    'lingbuilder.fbro.network',
    'lingbuilder.fbro.vip'
  ]));
  assert.equal(callable.find(module => module.id === 'lingbuilder.fbro.browser')?.version, '2.9.0');
  assert.ok(callable.filter(module => module.id !== 'lingbuilder.fbro.browser').every(module => module.version === '2.1.0'));
  assert.ok(callable.filter(module => module.id !== 'lingbuilder.fbro.browser').every(module =>
    module.dependencies?.some(dependency => dependency.moduleId === 'lingbuilder.fbro.browser'
      && dependency.minimumVersion === '2.1.0')));
});

test('FBro module family exposes one manager entry and atomically enables the standard feature set', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-fbro-family-'));
  await writeSolutionFixture(root, ['project-a']);
  const service = createModuleService(root);
  const installed = await service.scanInstalledModules('project-a');
  const family = getFbroFamilyModules(installed);

  assert.equal(family.length, FBRO_MODULE_FAMILY.features.length);
  // 基线 2026-09-20 写回：FBro 批次4 新增 FBro_设置启动开关JSON（跨域/禁用代理等 9 键白名单）。
  assert.equal(countModuleCommands(family), 692);
  assert.equal(isModuleHiddenByFamily('lingbuilder.fbro.browser'), false);
  assert.equal(isModuleHiddenByFamily('lingbuilder.fbro.objects'), true);
  assert.equal(isModuleHiddenByFamily('lingbuilder.fbro.sdk'), true);

  const plan = await service.enableModulesForProject('project-a', FBRO_STANDARD_MODULE_IDS);
  assert.deepEqual(new Set(plan.requestedModuleIds), new Set(FBRO_STANDARD_MODULE_IDS));
  const enabled = await service.getEnabledProjectModules('project-a');
  const enabledIds = new Set(enabled.map(module => module.manifest.id));
  assert.ok(FBRO_STANDARD_MODULE_IDS.every(moduleId => enabledIds.has(moduleId)));
  assert.ok(FBRO_ADVANCED_MODULE_IDS.every(moduleId => !enabledIds.has(moduleId)));
  assert.equal(isFbroStandardFamilyEnabled(getFbroFamilyModules(enabled)), true);
});

test('CEF3 module family exposes one manager entry, searchable feature domains and optional advanced modules', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cef3-family-'));
  await writeSolutionFixture(root, ['project-a']);
  const service = createModuleService(root);
  const installed = await service.scanInstalledModules('project-a');
  const family = getModuleFamilyModules(installed, CEF3_MODULE_FAMILY);

  assert.equal(family.length, CEF3_MODULE_FAMILY.features.length);
  assert.ok(countModuleCommands(family) >= 240);
  assert.equal(isModuleHiddenByFamily('lingbuilder.cef3.browser'), false);
  assert.equal(isModuleHiddenByFamily('lingbuilder.cef3.objects'), true);
  assert.equal(isModuleHiddenByFamily('lingbuilder.cef3.sdk'), true);
  assert.match(getModuleFamilySearchText(CEF3_MODULE_FAMILY, family), /cef3平台_取chrome实验说明/u);

  const plan = await service.enableModulesForProject('project-a', CEF3_STANDARD_MODULE_IDS);
  assert.deepEqual(new Set(plan.requestedModuleIds), new Set(CEF3_STANDARD_MODULE_IDS));
  const enabled = await service.getEnabledProjectModules('project-a');
  const enabledIds = new Set(enabled.map(module => module.manifest.id));
  assert.ok(CEF3_STANDARD_MODULE_IDS.every(moduleId => enabledIds.has(moduleId)));
  assert.ok(CEF3_ADVANCED_MODULE_IDS.every(moduleId => !enabledIds.has(moduleId)));
  assert.equal(isModuleFamilyStandardEnabled(
    CEF3_MODULE_FAMILY,
    getModuleFamilyModules(enabled, CEF3_MODULE_FAMILY)
  ), true);
});

test('module dependency planning blocks insufficient versions and cycles before writing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-dependency-errors-'));
  await writeSolutionFixture(root, ['project-a']);
  const moduleDirectory = (id: string) => path.join(root, '.lingbuilder', 'modules', id, 'lingbuilder.module.json');
  const base = (id: string, version: string, dependencies: Array<{ moduleId: string; minimumVersion: string }> = []) => ({
    schemaVersion: 2,
    id,
    name: id,
    version,
    category: '其他',
    description: `${id} test module`,
    dependencies
  });
  await writeFixture(moduleDirectory('com.example.dep-core'), JSON.stringify(base('com.example.dep-core', '1.9.0'), null, 2));
  await writeFixture(moduleDirectory('com.example.dep-feature'), JSON.stringify(base('com.example.dep-feature', '1.0.0', [
    { moduleId: 'com.example.dep-core', minimumVersion: '2.0.0' }
  ]), null, 2));
  const service = createModuleService(root);
  await assert.rejects(
    () => service.planEnableModulesForProject('project-a', ['com.example.dep-feature']),
    /需要 com\.example\.dep-core@>=2\.0\.0/u
  );
  await writeFixture(moduleDirectory('com.example.dep-core'), JSON.stringify(base('com.example.dep-core', '2.0.0', [
    { moduleId: 'com.example.dep-feature', minimumVersion: '1.0.0' }
  ]), null, 2));
  await assert.rejects(
    () => service.planEnableModulesForProject('project-a', ['com.example.dep-feature']),
    /依赖循环/u
  );
  const projectModulesPath = path.join(root, '.lingbuilder', 'projects', 'project-a', 'project-modules.json');
  assert.ok(!(await exists(projectModulesPath)), '失败的依赖计划不得写入项目模块文件');
});

test('FBro English aliases participate in completion and deterministic binding resolution', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.fbro.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const completions = getLingCppCompletions(
    { source: 'LB_FBro_Nav', line: 1, column: 12 },
    { enabledModules: [module], availableModules: [module] }
  );
  assert.ok(completions.some(item => item.label === 'FBro_导航' && item.aliases?.includes('LB_FBro_Navigate')));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        LB_FBro_Navigate("FBro浏览器1", "https://example.com")\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /FBro_导航\(L"FBro浏览器1", L"https:\/\/example\.com"\);/u);
});

test('FBro official SDK coverage catalog remains complete and classified', async () => {
  await execFileAsync(process.execPath, ['scripts/generate-fbro-api-coverage.cjs', '--check'], { cwd: path.resolve(import.meta.dirname, '..') });
  const catalog = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '..', 'src', 'services', 'modules', 'fbroApiCoverage.generated.json'), 'utf8')) as {
    headerCount: number;
    signatureCount: number;
    rawDeclarationCount: number;
    eventSlotCount: number;
    uniqueEventSignatureCount: number;
    eventClassCounts: Record<string, number>;
    eventCatalog: Array<{ eventId: string; ownerClass: string; officialName: string; synchronous: boolean; timeoutMilliseconds: number; maxHz: number; bridgeStatus: string; exposure: string; classificationReason: string; responseSchema: unknown; testId: string }>;
    signatures: Array<{
      officialName: string;
      moduleId: string;
      chineseName: string;
      wrapperSymbol: string;
      overloadCount: number;
      overloads: Array<{ overloadId: string; returnCodec: { codec: string }; parameters: Array<{ codec: string }> }>;
      classification: string;
      implementationStatus: string;
      classificationReason: string;
    }>;
  };
        // 基线 2026-09-09 写回：FBro 官方 SDK 升级到火山版 5.39.53（chromium 135.0.7049.115），
      // 头 77→73、签名族 1079→1071（删除 FBroClientBase/FBroExtension/FBroExtensionHandler/FBroRenderHandler 四头）。
      assert.equal(catalog.headerCount, 73);
  assert.equal(catalog.signatureCount, 1071);
  assert.equal(catalog.rawDeclarationCount, 1083);
  assert.equal(catalog.signatures.length, 1071);
  assert.ok(catalog.signatures.every(item => ['highLevel', 'advancedSafe', 'internal'].includes(item.classification)
    && ['implemented', 'planned', 'notApplicable'].includes(item.implementationStatus)
    && item.classificationReason.length > 0));
  assert.equal(catalog.signatures.filter(item => item.classification === 'advancedSafe' && item.implementationStatus === 'implemented').length, 550);
  assert.equal(catalog.signatures.filter(item => item.classification === 'advancedSafe' && item.implementationStatus === 'planned').length, 450);
  assert.equal(catalog.signatures.filter(item => item.implementationStatus === 'notApplicable').length, 15);
  assert.match(catalog.signatures.find(item => item.officialName === 'FBroHsBrowserHost_RunFileDialog')?.classificationReason || '', /阻塞/u);
  assert.ok(catalog.signatures.filter(item => item.classification === 'highLevel').every(item => item.implementationStatus === 'implemented'));
  assert.ok(catalog.signatures.every(item => /^LB_FBroV2_[0-9a-f]{16}$/u.test(item.wrapperSymbol)
    && item.overloads.length === item.overloadCount
    && item.overloads.every(overload => overload.overloadId && overload.returnCodec.codec
      && overload.parameters.every(parameter => parameter.codec))));
  assert.ok(catalog.signatures.every(item => !/功能[0-9A-F]{4}/u.test(item.chineseName)));
  assert.equal(catalog.eventSlotCount, 174);
  assert.equal(catalog.uniqueEventSignatureCount, 158);
  assert.equal(catalog.eventCatalog.length, 174);
  assert.equal(catalog.eventClassCounts.FBroHsBroEvent, 90);
  assert.equal(catalog.eventClassCounts.FBroHsInitEvent, 31);
  assert.equal(catalog.eventCatalog.filter(item => item.bridgeStatus === 'implemented').length, 102);
  assert.equal(catalog.eventCatalog.filter(item => item.bridgeStatus === 'managed').length, 63);
  const browserAuthBoundary = catalog.eventCatalog.find(item => item.ownerClass === 'FBroHsBroEvent'
    && item.officialName === 'GetAuthCredentials');
  assert.equal(browserAuthBoundary?.bridgeStatus, 'managed');
  assert.equal(browserAuthBoundary?.exposure, 'managed');
  assert.match(browserAuthBoundary?.classificationReason || '', /Basic Auth|未经过/u);
  assert.equal(catalog.eventCatalog.filter(item => ['planned', 'needsReview'].includes(item.bridgeStatus)).length, 0);
  assert.equal(new Set(catalog.eventCatalog.map(item => item.eventId)).size, 174);
  assert.ok(catalog.eventCatalog.every(item => item.responseSchema && item.testId));
  assert.ok(catalog.eventCatalog.filter(item => item.synchronous).every(item => item.timeoutMilliseconds === 2000));
  assert.ok(catalog.eventCatalog.filter(item => /Paint/u.test(item.officialName)).every(item => item.maxHz === 60));

  const vip = catalog.signatures.filter(item => item.moduleId === 'lingbuilder.fbro.vip');
  assert.equal(vip.length, 188);
  assert.equal(vip.filter(item => item.implementationStatus === 'implemented').length, 188);
  assert.equal(vip.filter(item => item.implementationStatus === 'planned').length, 0);
  const directFingerprintSurface = vip.filter(item => /(FingerPrint|FingerCount|SetVir|VIPUserAgentData)/u.test(item.officialName));
  assert.equal(directFingerprintSurface.length, 87);
  assert.ok(directFingerprintSurface.every(item => item.implementationStatus === 'implemented'));
});

test('FBro VIP 188 项逐项公开并通过安全 C ABI、模块 binding 与双后端运行时接入', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.vip');
  assert.ok(manifest);
  assert.equal(FBRO_VIP_API_CATALOG.length, 188);
  assert.equal(manifest.contributes?.commands?.length, 198);
  assert.equal(manifest.contributes?.commands?.filter(item => item.officialCapability).length, 188);
  assert.equal(manifest.contributes?.commands?.filter(item => item.capabilityKind === 'single').length, 179);
  assert.equal(manifest.contributes?.commands?.filter(item => item.capabilityKind === 'managed').length, 6);
  assert.equal(manifest.contributes?.commands?.filter(item => item.capabilityKind === 'secureReplacement').length, 3);
  assert.equal(manifest.contributes?.commands?.filter(item => item.capabilityKind === 'aggregate').length, 10);
  assert.equal(new Set(FBRO_VIP_API_CATALOG.map(item => item.command.name)).size, 188);
  assert.ok(FBRO_VIP_API_CATALOG.every(item => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(item.command.name)));
  assert.ok(FBRO_VIP_API_CATALOG.every(item => item.command.category && item.command.aliases?.includes(item.officialName)));
  assert.ok(FBRO_VIP_API_CATALOG.some(item => item.command.name === 'FBroVIP_DOM_取文档'
    && item.officialName === 'FBroHsDevToolsDOM_getDocument'));
  assert.ok(FBRO_VIP_API_CATALOG.some(item => item.command.name === 'FBroVIP_浏览器扩展_安装CRX'
    && item.officialName === 'FBroHsVIPRequestContext_InstallCrx'));
  assert.ok(FBRO_VIP_API_CATALOG.some(item => item.command.name === 'FBroVIP_授权状态_设置授权密钥'
    && item.capabilityKind === 'secureReplacement' && item.command.visibility === 'internal'));
  assert.ok(manifest.contributes?.commands?.some(item => item.name === 'FBroVIP_取已应用配置JSON'
    && item.aliases?.includes('LB_FBro_GetAppliedFingerprintJson') && item.capabilityKind === 'aggregate'));
  assert.deepEqual(manifest.bindings?.commands?.map(item => item.command), manifest.contributes?.commands?.map(item => item.name));

  const win32Runtime = generateFbroVipIndividualRuntime(false);
  const newEmojiRuntime = generateFbroVipIndividualRuntime(true);
  assert.match(win32Runtime, /FBroVIP单项_[0-9A-F]{12}\(const wchar_t\* controlName, const wchar_t\* argsJson\)/u);
  assert.match(win32Runtime, /FBro指纹_DOM异步命令\(controlName, L"FBroHsDevToolsDOM_getDocument", argsJson\)/u);
  assert.match(win32Runtime, /FBroVIP单项_应用配置路径\(controlName, L"gpuVendor", argsJson\)/u);
  assert.match(newEmojiRuntime, /static long long FBroVIP单项_[0-9A-F]{12}/u);
  assert.equal((win32Runtime.match(/FBroVIP单项_[0-9A-F]{12}\(/gu) || []).length, 188);
  assert.equal((newEmojiRuntime.match(/FBroVIP单项_[0-9A-F]{12}\(/gu) || []).length, 188);

  const bridge = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  const bridgeHeader = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8');
  const generator = await fs.readFile(path.resolve(import.meta.dirname, '..', 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts'), 'utf8');
  for (const symbol of [
    'FBroHsVIPControl_SetVirGPUVendor', 'FBroHsVIPControl_SetVirLongitudeAndLatitude',
    'FBroHsVIPControl_SetVirWebrtcIP', 'FBroHsVIPControl_SetVirTimeZone',
    'FBroHsVIPControl_SetCanvasFingerPrint_constant', 'FBroHsVIPControl_SetWebGLFingerPrint_random',
    'FBroHsVIPUserAgentData_Create', 'FBroHsVIPUserAgentData_SetBrands',
    'FBroHsVIPUserAgentData_GetFormFactors', 'FBroDoubleString_Creat', 'FBroCefStringList_Creat',
    'FBroHsDevToolsDOM_getDocument', 'FBroHsVIPRequestContext_InstallCrx',
    'FBroHsVIPResourceHandler_AddChangeData', 'FBroHsVIPControl_AddResponseFilterChangeData',
    'FBroHsVIPControl_RuntimeEvaluate', 'FBroHsVIPControl_DispatchTouchEvent',
    'FBroHsVIPControl_AddDevToolsMessageObserver', 'FBroSetVipEvent', 'FBroHsVIPCommandLine_SetProxy'
  ]) assert.match(bridge, new RegExp(`\\b${symbol}\\b`, 'u'));
  assert.match(bridgeHeader, /LB_FBro_GetAppliedFingerprintJson/u);
  assert.match(bridgeHeader, /LB_FBro_VipDomCommandAsync/u);
  assert.match(bridgeHeader, /LB_FBro_VipExtensionCommandAsync/u);
  assert.match(bridgeHeader, /LB_FBro_VipResourceCommandAsync/u);
  assert.match(bridgeHeader, /LB_FBro_VipDevToolsCommandAsync/u);
  assert.equal((generator.match(/FBro指纹_取已应用配置\(const wchar_t\*/gu) || []).length, 2);
  assert.equal((generator.match(/FBro指纹_DOM异步命令\(const wchar_t\*/gu) || []).length, 2);
  assert.equal((generator.match(/FBro指纹_扩展异步命令\(const wchar_t\*/gu) || []).length, 2);
  assert.equal((generator.match(/FBro指纹_资源规则异步命令\(const wchar_t\*/gu) || []).length, 2);
  assert.equal((generator.match(/FBro指纹_开发者工具异步命令\(const wchar_t\*/gu) || []).length, 2);
  assert.equal((generator.match(/generateFbroVipIndividualRuntime\(/gu) || []).length, 2);
  assert.match(bridge, /\\"configuration\\"/u);
  assert.match(bridge, /\\"userAgent\\"/u);
});

test('模块公开信息搜索忽略命令标识符分隔符', () => {
  const normalizedCatalog = FBRO_VIP_API_CATALOG.map(item => ({
    name: item.command.name,
    searchText: normalizeModulePublicInfoSearchText([
      item.command.name,
      item.command.signature,
      item.command.description
    ].join(' '))
  }));
  for (const [query, expectedName] of [
    ['DOM取文档', 'FBroVIP_DOM_取文档'],
    ['安装CRX', 'FBroVIP_浏览器扩展_安装CRX'],
    ['GPU厂商', 'FBroVIP_GPUWebGL_设置GPU厂商']
  ]) {
    const normalizedQuery = normalizeModulePublicInfoSearchText(query);
    assert.ok(normalizedCatalog.some(item => item.name === expectedName && item.searchText.includes(normalizedQuery)));
  }
});

test('FBro Frame 使用类型化句柄并由普通 Win32 与 New_Emoji 共用官方调用', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.automation');
  assert.ok(manifest);
  assert.equal(manifest.contributes?.commands?.length, 72);
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'FBro框架_取主框架'
    && command.aliases?.includes('FBroHsBrowser_GetMainFrame')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'FBro框架_取标识'
    && command.aliases?.includes('FBroHsBrowserFrame_GetIdentifier')));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [{ manifest, installPath: 'builtin://lingbuilder.fbro.automation', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }],
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        FBro框架_取主框架("FBro浏览器1")\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /LB_FBro_BrowserGetMainFrame/u);
  assert.match(cpp, /LB_FBro_FrameGetIdentifier/u);
  assert.match(cpp, /LB_FBro_FrameExecuteJavaScript/u);
  assert.match(cpp, /LB_FBro_ObjectRelease/u);
});

test('FBro Session CookieManager 与缓存清理使用受管异步任务和官方 Bridge 调用', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.session');
  assert.ok(manifest);
  assert.equal(manifest.contributes?.commands?.length, 14);
  for (const [command, alias] of [
    ['FBro会话_异步取全部Cookie', 'LB_FBro_CookieVisitAllAsync'],
    ['FBro会话_异步取地址Cookie', 'LB_FBro_CookieVisitUrlAsync'],
    ['FBro会话_异步设置Cookie', 'LB_FBro_CookieSetAsync'],
    ['FBro会话_异步删除Cookie', 'LB_FBro_CookieDeleteAsync'],
    ['FBro会话_异步刷新Cookie存储', 'LB_FBro_CookieFlushAsync'],
    ['FBro会话_异步清理缓存', 'LB_FBro_ClearCacheAsync'],
    ['FBro会话_异步清理全局缓存', 'LB_FBro_ClearGlobalCacheAsync']
  ]) {
    assert.ok(manifest.contributes?.commands?.some(item => item.name === command && item.aliases?.includes(alias)));
  }
  const bridge = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  for (const symbol of [
    'FBroHsBrowserHost_GetRequestContext', 'FBroHsRequestContext_GetCookieManager',
    'FBroHsCookieManager_GetGlobalManager', 'FBroHsCookieManager_VisitAllCookies',
    'FBroHsCookieManager_VisitUrlCookies', 'FBroHsCookieManager_DeleteCookies',
    'FBroHsBrowser_ClearCacheData', 'FBroHsBrowser_ClearGlobalCacheData',
    'FBroHsBrowserHost_StartDownload', 'FBroHsBrowserHost_Print'
  ]) assert.match(bridge, new RegExp(`\\b${symbol}\\b`, 'u'));
  assert.match(bridge, /class BridgeSetCookieCallback[\s\S]*?OnComplete\(bool success\)[\s\S]*?CompleteTextTask/u);
  assert.match(bridge, /class BridgeCookieFlushCallback[\s\S]*?OnComplete\(\)[\s\S]*?CompleteTextTask/u);
  assert.match(bridge, /CefRefPtr<BridgeSetCookieCallback> callback = new BridgeSetCookieCallback\(task_\);/u);
  assert.match(bridge, /manager->SetCookie\(CefString\(arguments_\[0\]\), cookie, callback\)/u);
  assert.match(bridge, /CefRefPtr<BridgeCookieFlushCallback> callback = new BridgeCookieFlushCallback\(task_\);/u);
  assert.match(bridge, /manager->FlushStore\(callback\)/u);
  const bridgeHeader = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8');
  const sessionDeclarations = bridgeHeader.match(/LB_FBro_(?:Cookie\w+Async|Clear(?:Global)?CacheAsync)\([^;]+;/gu) || [];
  assert.equal(sessionDeclarations.length, 8);
  assert.ok(sessionDeclarations.every(declaration => !/CefRefPtr|std::|CefCookieManager/u.test(declaration)));
  assert.match(bridge, /LB_FBro_TaskRelease[\s\S]*?status = LB_FBRO_TASK_CANCELLED;[\s\S]*?callback = nullptr;/u);
});

test('FBro 宿主信息、实例注册表与等价能力命令使用真实 Bridge 查询调用', async () => {
  const browser = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  const session = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.session');
  const objects = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.objects');
  assert.ok(browser);
  assert.ok(session);
  assert.ok(objects);
  const manifestFor = (moduleId: string) => (
    moduleId === 'lingbuilder.fbro.browser' ? browser : moduleId === 'lingbuilder.fbro.session' ? session : objects);
  for (const [moduleId, command, alias] of [
    ['lingbuilder.fbro.browser', 'FBro_取窗口句柄', 'LB_FBro_GetWindowHandle'],
    ['lingbuilder.fbro.browser', 'FBro_取打开者窗口句柄', 'LB_FBro_GetOpenerWindowHandle'],
    ['lingbuilder.fbro.browser', 'FBro_取父窗口句柄', 'LB_FBro_GetParentWindowHandle'],
    ['lingbuilder.fbro.browser', 'FBro_取运行时样式', 'LB_FBro_GetRuntimeStyle'],
    ['lingbuilder.fbro.browser', 'FBro_取SDK版本JSON', 'LB_FBro_GetSdkVersionJson'],
    ['lingbuilder.fbro.browser', 'FBro_取实例数量', 'LB_FBro_GetInstanceCount'],
    ['lingbuilder.fbro.browser', 'FBro_取实例句柄列表JSON', 'LB_FBro_GetInstanceHandlesJson'],
    ['lingbuilder.fbro.browser', 'FBro_取实例标记列表JSON', 'LB_FBro_GetInstanceFlagsJson'],
    ['lingbuilder.fbro.browser', 'FBro_是否存活', 'LB_FBro_IsInstanceAlive'],
    ['lingbuilder.fbro.browser', 'FBro_显示开发者工具窗口', 'LB_FBro_ShowDevToolsWindowAsync'],
    ['lingbuilder.fbro.browser', 'FBro_移动浏览器窗口', 'LB_FBro_MoveBrowserWindowAsync'],
    ['lingbuilder.fbro.browser', 'FBro_取创建标记', 'LB_FBro_GetBrowserFlag'],
    ['lingbuilder.fbro.browser', 'FBro_取附加信息JSON', 'LB_FBro_GetBrowserExtraInfoJson'],
    ['lingbuilder.fbro.session', 'FBro会话_是否全局上下文', 'LB_FBro_IsGlobalRequestContext'],
    ['lingbuilder.fbro.session', 'FBro会话_取上下文缓存路径', 'LB_FBro_GetRequestContextCachePath'],
    ['lingbuilder.fbro.objects', 'FBro缓冲_是否有效', 'LB_FBro_IsBufferValid'],
    ['lingbuilder.fbro.objects', 'FBro工具_创建数据URI', 'LB_FBro_CreateDataUri']
  ] as const) {
    const manifest = manifestFor(moduleId);
    assert.ok(manifest?.contributes?.commands?.some(item => item.name === command && item.aliases?.includes(alias)),
      `${command} 缺少命令或官方别名`);
    assert.ok(manifest?.bindings?.commands?.some(item => item.command === command && item.runtimeName === command),
      `${command} 缺少确定性 binding`);
  }
  const [bridge, bridgeHeader, generatorSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts'), 'utf8')
  ]);
  for (const symbol of [
    'FBroHsBrowserHost_GetWindowHandle', 'FBroHsBrowserHost_GetOpenerWindowHandle',
    'FBroHsBrowserHost_GetParent', 'FBroHsBrowserHost_GetRuntimeStyle',
    'FBroHsBrowserHost_MoveWindow', 'FBroHsBrowserHost_ShowDevTools',
    'FBroHsVersion_GetMain', 'FBroHsVersion_GetEdit', 'FBroHsVersion_GetDedug',
    'FBroHsRequestContext_IsGlobal', 'FBroHsRequestContext_GetCachePath',
    'FBroHsRequestContext_GetGlobalContext',
    'FBroHsBrowser_GetFlag', 'FBroHsBrowser_GetExtrainfo', 'FBroHsGetDataURI'
  ]) assert.match(bridge, new RegExp(`\\b${symbol}\\b`, 'u'));
  for (const runtime of [
    'LB_FBro_GetWindowHandle', 'LB_FBro_GetOpenerWindowHandle', 'LB_FBro_GetParentWindowHandle',
    'LB_FBro_GetRuntimeStyle', 'LB_FBro_GetSdkVersionJson', 'LB_FBro_GetInstanceCount',
    'LB_FBro_GetInstanceHandlesJson', 'LB_FBro_GetInstanceFlagsJson', 'LB_FBro_IsInstanceAlive',
    'LB_FBro_ShowDevToolsWindowAsync', 'LB_FBro_MoveBrowserWindowAsync',
    'LB_FBro_GetBrowserFlag', 'LB_FBro_GetBrowserExtraInfoJson',
    'LB_FBro_IsGlobalRequestContext', 'LB_FBro_GetRequestContextCachePath',
    'LB_FBro_IsBufferValid', 'LB_FBro_CreateDataUri'
  ]) {
    assert.match(bridgeHeader, new RegExp(`LB_FBRO_API .*\\b${runtime}\\b`, 'u'), `${runtime} 缺少桥导出声明`);
    const occurrences = generatorSource.split(runtime).length - 1;
    assert.ok(occurrences >= 2, `${runtime} 缺少双模板 wrapper（实际 ${occurrences}）`);
  }
});

test('FBro Transfer PDF、文件对话框与 VIP 截图使用任务和受管缓冲', async () => {
  const transfer = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.transfer');
  const objects = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.objects');
  assert.ok(transfer);
  assert.ok(objects);
  assert.equal(transfer.contributes?.commands?.length, 22);
  assert.ok(objects.contributes?.commands?.some(item => item.name === 'FBro任务_取缓冲' && item.aliases?.includes('LB_FBro_TaskGetBuffer')));
  for (const [command, alias] of [
    ['FBro传输_异步生成PDF', 'LB_FBro_PrintToPdfAsync'],
    ['FBro传输_异步打开文件对话框', 'LB_FBro_RunFileDialogAsync'],
    ['FBro传输_异步截图', 'LB_FBro_CaptureScreenshotAsync']
  ]) assert.ok(transfer.contributes?.commands?.some(item => item.name === command && item.aliases?.includes(alias)));
  const bridge = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  for (const symbol of [
    'FBroHsBrowserHost_PrintToPDF', 'IFileOpenDialog', 'CLSID_FileSaveDialog', 'CoCreateInstance',
    'FBroHsVIPControl_PageCaptureScreenshot', 'CefBase64Decode'
  ]) assert.match(bridge, new RegExp(`\\b${symbol}\\b`, 'u'));
  assert.doesNotMatch(bridge, /FBroHsBrowserHost_RunFileDialog|GetHost\(\)->RunFileDialog/u);
  assert.match(bridge, /std::thread\(RunWindowsFileDialog[\s\S]*?\.detach\(\)/u);
  assert.match(bridge, /FBro 截图需要有效 VIP Key/u);
  const bridgeHeader = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8');
  const declarations = bridgeHeader.match(/LB_FBro_(?:PrintToPdf|RunFileDialog|CaptureScreenshot)Async\([^;]+;/gu) || [];
  assert.equal(declarations.length, 3);
  assert.ok(declarations.every(declaration => !/CefRefPtr|std::|FBroPdfPrintSettings|FBroCefStringList/u.test(declaration)));
});

test('FBro Value、Dictionary、List、Stream、Image、Certificate 使用类型化受管句柄并生成真实 Bridge 调用', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.objects');
  assert.ok(manifest);
  assert.equal(manifest.contributes?.commands?.length, 227);
  assert.deepEqual(
    manifest.bindings?.commands?.map(binding => binding.command),
    manifest.contributes?.commands?.map(command => command.name)
  );
  for (const [command, alias] of [
    ['FBro值_创建', 'FBroHsValue_Create'],
    ['FBro值_设置字典', 'FBroHsValue_SetDictionary'],
    ['FBro字典_取键列表JSON', 'FBroHsDictionaryValue_GetKeys'],
    ['FBro字典_设置文本', 'FBroHsDictionaryValue_SetString'],
    ['FBro列表_取整数', 'FBroHsListValue_GetInt'],
    ['FBro列表_设置二进制', 'FBroHsListValue_SetBinary'],
    ['FBro流_从缓冲创建', 'FBroStream_CreateForData'],
    ['FBro图像_异步下载', 'FBroHsBrowserHost_DownloadImage'],
    ['FBro证书_取DER缓冲', 'FBroHsX509Certificate_GetDEREncoded'],
    ['FBro证书主体_取通用名', 'FBroHsX509CertPrincipal_GetCommonName'],
    ['FBro拖放数据_取图像', 'FBroHsDragData_GetImage']
  ]) {
    assert.ok(manifest.contributes?.commands?.some(item => item.name === command && item.aliases?.includes(alias)));
  }
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.fbro.objects',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 长整数型 值 = FBro值_创建()',
      '        FBro值_设置整数(值, 42)',
      '        局部 长整数型 字典 = FBro字典_创建()',
      '        FBro字典_设置文本(字典, "name", "LingBuilder")',
      '        局部 长整数型 列表 = FBro列表_创建()',
      '        FBro列表_设置数量(列表, 1)',
      '        FBro字典_设置列表(字典, "items", 列表)',
      '        局部 长整数型 键列表 = FBro字典_取列表(字典, "items")',
      '        局部 长整数型 缓冲 = FBro缓冲_从文本("AB")',
      '        FBro列表_设置二进制(列表, 0, 缓冲)',
      '        局部 长整数型 流 = FBro流_从缓冲创建(缓冲)',
      '        局部 长整数型 已读 = FBro流_读取(流, 1, 2)',
      '        FBro对象_释放(值)',
      '    结束',
      '结束类'
    ].join('\n')
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const symbol of [
    'LB_FBro_ValueCreate', 'LB_FBro_ValueSetInt',
    'LB_FBro_ValueSetDictionary', 'LB_FBro_ValueGetBinary',
    'LB_FBro_DictionaryCreate', 'LB_FBro_DictionarySetString', 'LB_FBro_DictionaryGetKeysJson',
    'LB_FBro_ListCreate', 'LB_FBro_ListSetSize', 'LB_FBro_ListSetBinary',
    'LB_FBro_StreamCreateForBuffer', 'LB_FBro_StreamRead',
    'LB_FBro_TaskWait', 'LB_FBro_TaskGetObject',
    'LB_FBro_DownloadImageAsync', 'LB_FBro_ImageGetAsPng',
    'LB_FBro_GetCurrentCertificateAsync', 'LB_FBro_CertificateGetDerEncoded',
    'LB_FBro_PrincipalGetCommonName', 'LB_FBro_GetLastEventObject',
    'LB_FBro_DragDataGetImage', 'LB_FBro_ObjectRelease'
  ]) assert.ok(cpp.includes(symbol), `生成运行时缺少 ${symbol}`);

  const bridge = await fs.readFile(path.resolve('native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  assert.match(bridge, /std::unordered_map<LB_FBRO_OBJECT_HANDLE, std::shared_ptr<ObjectState>> g_objects/u);
  assert.match(bridge, /owner_thread != GetCurrentThreadId\(\)/u);
  assert.match(bridge, /type != expected_type/u);
  assert.match(bridge, /EraseObjectTree\(object\)/u);
  assert.match(bridge, /FBroHsValue_Create\(\)/u);
  assert.match(bridge, /FBroHsDictionaryValue_Create\(\)/u);
  assert.match(bridge, /FBroHsListValue_Create\(\)/u);
  assert.match(bridge, /FBroHsBinaryValue_Create\(/u);
  assert.match(bridge, /FBroStream_CreateForData\(/u);
  assert.match(bridge, /FBroHsBrowserHost_DownloadImage\(/u);
  assert.match(bridge, /FBroHsImage_GetAsPNG\(/u);
  assert.match(bridge, /GetVisibleNavigationEntry\(\)/u);
  assert.match(bridge, /FBroHsX509Certificate_GetDEREncoded\(/u);
  assert.match(bridge, /FBroHsX509CertPrincipal_GetCommonName\(/u);
  assert.match(bridge, /FBroHsDragData_Clone\(/u);
  assert.match(bridge, /LB_FBRO_EVENT_CERTIFICATE_ERROR/u);
  assert.match(bridge, /LB_FBRO_EVENT_DRAG_ENTER/u);
});

test('uninstall removes module references from every solution project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-uninstall-'));
  await writeSolutionFixture(root, ['lingbuilder-ui-project', 'project-b']);
  const moduleId = 'com.example.shared';
  await writeFixture(
    path.join(root, '.lingbuilder', 'modules', moduleId, 'lingbuilder.module.json'),
    JSON.stringify({
      schemaVersion: 2,
      id: moduleId,
      name: '共享模块',
      version: '1.0.0',
      category: '其他',
      description: '卸载引用清理测试。'
    }, null, 2)
  );
  const references = {
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', moduleId],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0', [moduleId]: '1.0.0' }
  };
  const defaultReferencePath = path.join(root, '.lingbuilder', 'project-modules.json');
  const projectBReferencePath = path.join(root, '.lingbuilder', 'projects', 'project-b', 'project-modules.json');
  await Promise.all([
    writeFixture(defaultReferencePath, JSON.stringify(references, null, 2)),
    writeFixture(projectBReferencePath, JSON.stringify(references, null, 2))
  ]);

  await createModuleService(root).uninstallModule(moduleId);
  for (const referencePath of [defaultReferencePath, projectBReferencePath]) {
    const saved = JSON.parse(await fs.readFile(referencePath, 'utf8'));
    assert.ok(!saved.enabledModuleIds.includes(moduleId));
    assert.equal(saved.pinnedVersions[moduleId], undefined);
  }
});

test('链接模块开发源后扫描指向源目录，源改动免重装即时生效，取消链接后移除', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-devlink-'));
  await writeSolutionFixture(root, ['lingbuilder-ui-project']);
  const sourceDir = path.join(root, '.lingbuilder', 'module-build', 'dev-src');
  const manifest = {
    schemaVersion: 2,
    id: 'com.example.devlink',
    name: '开发源模块',
    version: '1.0.0',
    category: '其他',
    description: '开发源链接测试。'
  };
  await writeFixture(path.join(sourceDir, 'lingbuilder.module.json'), JSON.stringify(manifest, null, 2));

  const service = createModuleService(root);
  const { link, module } = await service.linkModuleDevSource('.lingbuilder/module-build/dev-src');
  assert.equal(link.moduleId, 'com.example.devlink');
  assert.equal(link.sourcePath, '.lingbuilder/module-build/dev-src');
  assert.ok(module.isDevLink);
  assert.equal(module.installPath, path.resolve(sourceDir));
  // 链接不落地 .lingbuilder/modules：磁盘上不产生安装目录。
  await assert.rejects(fs.access(path.join(root, '.lingbuilder', 'modules', 'com.example.devlink')));

  // 改源目录清单版本 → 重新扫描即拿到新版本（无需重新打包安装）。
  await writeFixture(path.join(sourceDir, 'lingbuilder.module.json'), JSON.stringify({ ...manifest, version: '1.0.1' }, null, 2));
  const rescanned = (await service.scanInstalledModules()).find(item => item.manifest.id === 'com.example.devlink');
  assert.equal(rescanned?.manifest.version, '1.0.1');
  assert.ok(rescanned?.isDevLink);

  await service.unlinkModuleDevSource('com.example.devlink');
  const afterUnlink = (await service.scanInstalledModules()).find(item => item.manifest.id === 'com.example.devlink');
  assert.equal(afterUnlink, undefined);
  // 取消链接绝不删除开发源文件。
  assert.ok(await fs.readFile(path.join(sourceDir, 'lingbuilder.module.json'), 'utf8'));
});

test('开发源链接拒绝绝对路径、越界、安装目录、缺失清单与内置 ID', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-devlink-guard-'));
  await writeSolutionFixture(root, ['lingbuilder-ui-project']);
  const service = createModuleService(root);

  await assert.rejects(() => service.linkModuleDevSource('C:/Windows'), /工作区相对路径/);
  await assert.rejects(() => service.linkModuleDevSource('../outside'), /工作区/);
  await assert.rejects(() => service.linkModuleDevSource('.lingbuilder/modules/com.x'), /不能指向已安装模块目录/);
  await assert.rejects(() => service.linkModuleDevSource('.lingbuilder/module-build/missing'), /不存在或不是目录/);

  await fs.mkdir(path.join(root, '.lingbuilder', 'module-build', 'empty-src'), { recursive: true });
  await assert.rejects(() => service.linkModuleDevSource('.lingbuilder/module-build/empty-src'), /缺少有效/);

  await writeFixture(
    path.join(root, '.lingbuilder', 'module-build', 'builtin-src', 'lingbuilder.module.json'),
    JSON.stringify({ schemaVersion: 2, id: 'lingbuilder.win32.basic', name: '伪装内置', version: '1.0.0', category: '其他', description: '内置 ID 拒绝测试。' }, null, 2)
  );
  await assert.rejects(() => service.linkModuleDevSource('.lingbuilder/module-build/builtin-src'), /内置模块/);
});

test('已链接开发源的模块：安装包被拒绝安装，卸载只断链不删源', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-devlink-install-'));
  await writeSolutionFixture(root, ['lingbuilder-ui-project']);
  const service = createModuleService(root);
  const devDir = path.join(root, '.lingbuilder', 'module-build', 'devlink-src');
  const manifest = {
    schemaVersion: 2,
    id: 'com.example.devlink2',
    name: '开发源模块二',
    version: '1.0.0',
    category: '其他',
    description: '安装守卫与卸载断链测试。'
  };
  await writeFixture(path.join(devDir, 'lingbuilder.module.json'), JSON.stringify(manifest, null, 2));
  await service.linkModuleDevSource('.lingbuilder/module-build/devlink-src');

  // 同 ID 新包正常预览，但安装被开发源链接守卫拒绝。
  const packageDir = path.join(root, 'package-src');
  await writeFixture(path.join(packageDir, 'lingbuilder.module.json'), JSON.stringify({ ...manifest, version: '2.0.0' }, null, 2));
  const packagePath = path.join(root, 'devlink2.lbmod');
  await createLbmodArchive(packageDir, packagePath);
  const preview = await service.previewPackageInstall(packagePath);
  assert.equal(preview.canInstall, true);
  await assert.rejects(() => service.installPackage(preview.previewId), /已链接开发源/);

  // 「卸载」链接模块 = 断链：源目录文件必须原样保留。
  await service.uninstallModule('com.example.devlink2');
  assert.ok(await fs.readFile(path.join(devDir, 'lingbuilder.module.json'), 'utf8'));
  const afterUninstall = (await service.scanInstalledModules()).find(item => item.manifest.id === 'com.example.devlink2');
  assert.equal(afterUninstall, undefined);
});

test('开发源链接优先于同 ID 已安装目录，扫描不产生重复条目', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-devlink-shadow-'));
  await writeSolutionFixture(root, ['lingbuilder-ui-project']);
  const installedManifest = {
    schemaVersion: 2,
    id: 'com.example.devlink3',
    name: '已安装旧版',
    version: '9.9.9',
    category: '其他',
    description: '被开发源链接遮蔽的安装目录。'
  };
  await writeFixture(path.join(root, '.lingbuilder', 'modules', 'com.example.devlink3', 'lingbuilder.module.json'), JSON.stringify(installedManifest, null, 2));
  await writeFixture(
    path.join(root, '.lingbuilder', 'module-build', 'devlink3-src', 'lingbuilder.module.json'),
    JSON.stringify({ ...installedManifest, name: '开发源新版', version: '0.1.0' }, null, 2)
  );

  const service = createModuleService(root);
  await service.linkModuleDevSource('.lingbuilder/module-build/devlink3-src');
  const matched = (await service.scanInstalledModules()).filter(item => item.manifest.id === 'com.example.devlink3');
  assert.equal(matched.length, 1);
  assert.equal(matched[0].manifest.version, '0.1.0');
  assert.ok(matched[0].isDevLink);
});

test('module validation, preview and pack reject missing declared files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-completeness-'));
  const moduleDir = path.join(root, 'module');
  const manifest = {
    schemaVersion: 2,
    id: 'com.example.incomplete',
    name: '不完整模块',
    version: '1.0.0',
    category: '其他',
    description: '用于校验缺失资源。',
    contributes: {
      docs: [{ title: '使用说明', path: 'docs/usage.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    targets: [{
      id: 'windows-msvc-win32',
      platform: 'windows',
      arch: 'win32',
      toolchain: 'msvc',
      includeDirs: ['include'],
      headers: ['include/missing.h'],
      libs: ['lib/missing.lib'],
      runtimeFiles: ['bin/missing.dll']
    }]
  };
  await writeFixture(path.join(moduleDir, 'lingbuilder.module.json'), JSON.stringify(manifest, null, 2));
  await fs.mkdir(path.join(moduleDir, 'include'), { recursive: true });

  const validation = await validateModuleDirectory(moduleDir);
  assert.ok(validation.diagnostics.some(message => message.includes('文档不存在')));
  assert.ok(validation.diagnostics.some(message => message.includes('示例不存在')));
  assert.ok(validation.diagnostics.some(message => message.includes('库文件不存在')));

  const service = createModuleService(root);
  await assert.rejects(
    () => service.exportModulePackage(moduleDir, path.join(root, 'incomplete.lbmod')),
    /模块内容不完整/
  );

  const packagePath = path.join(root, 'incomplete.lbmod');
  await createLbmodArchive(moduleDir, packagePath);
  const preview = await service.previewPackageInstall(packagePath);
  assert.equal(preview.canInstall, false);
  assert.ok(preview.diagnostics.some(message => message.includes('文档不存在')));
});

test('AI 模块导入在校验完整前不写入目标目录，并保留旧目录内容', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-import-transaction-'));
  const moduleDir = path.join(root, 'module');
  const manifest = JSON.stringify({
    schemaVersion: 2,
    id: 'ai.transaction.module',
    name: '事务导入模块',
    version: '1.0.0',
    category: 'AI',
    description: '验证 AI 模块导入事务。',
    contributes: {
      commands: [{ name: '事务命令', signature: '事务命令()', description: '测试命令。', insertText: '事务命令()', returnType: '空' }],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: { commands: [{ command: '事务命令', runtimeName: '事务命令', returnType: 'void' }] }
  });

  await assert.rejects(
    () => importAiModuleFiles([{ path: 'lingbuilder.module.json', content: manifest }], moduleDir),
    /模块内容校验未通过[\s\S]*文档不存在/u
  );
  await assert.rejects(() => fs.stat(moduleDir), { code: 'ENOENT' });

  await fs.mkdir(path.join(moduleDir, 'old'), { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'old', 'keep.txt'), '保留旧文件', 'utf8');
  await fs.writeFile(path.join(moduleDir, 'lingbuilder.module.json'), '旧版本', 'utf8');
  await assert.rejects(
    () => importAiModuleFiles([{ path: 'lingbuilder.module.json', content: manifest }], moduleDir),
    /模块内容校验未通过[\s\S]*文档不存在/u
  );
  assert.equal(await fs.readFile(path.join(moduleDir, 'lingbuilder.module.json'), 'utf8'), '旧版本');
  assert.equal(await fs.readFile(path.join(moduleDir, 'old', 'keep.txt'), 'utf8'), '保留旧文件');
});

test('AI 模块导入成功后原子替换并保留旧目录中未提交的文件', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-import-success-'));
  const moduleDir = path.join(root, 'module');
  await fs.mkdir(path.join(moduleDir, 'old'), { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'old', 'keep.txt'), '保留旧文件', 'utf8');
  await fs.writeFile(path.join(moduleDir, 'README.md'), '旧说明', 'utf8');
  const manifest = JSON.stringify({
    schemaVersion: 2,
    id: 'ai.atomic.module',
    name: '原子导入模块',
    version: '1.0.0',
    category: 'AI',
    description: '验证成功导入。',
    contributes: {
      commands: [{ name: '原子命令', signature: '原子命令()', description: '测试命令。', insertText: '原子命令()', returnType: '空' }],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: { commands: [{ command: '原子命令', runtimeName: '原子命令', returnType: 'void' }] }
  });
  const result = await importAiModuleFiles([
    { path: 'lingbuilder.module.json', content: manifest },
    { path: 'README.md', content: '# 原子导入模块' },
    { path: 'examples/demo.lcpp', content: '原子命令()' }
  ], moduleDir);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.overwrittenExisting, true);
  assert.equal(await fs.readFile(path.join(moduleDir, 'lingbuilder.module.json'), 'utf8'), manifest);
  assert.equal(await fs.readFile(path.join(moduleDir, 'old', 'keep.txt'), 'utf8'), '保留旧文件');
});

test('AI 模块导入拒绝大小写冲突路径并避免写入目标目录', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-import-case-'));
  const moduleDir = path.join(root, 'module');
  const manifest = JSON.stringify({
    schemaVersion: 2,
    id: 'ai.case.module',
    name: '大小写模块',
    version: '1.0.0',
    category: 'AI',
    description: '测试路径冲突。',
    contributes: {
      commands: [{ name: '命令', signature: '命令()', description: '测试命令。', insertText: '命令()', returnType: '空' }],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: { commands: [{ command: '命令', runtimeName: '命令', returnType: 'void' }] }
  });

  await assert.rejects(
    () => importAiModuleFiles([
      { path: 'lingbuilder.module.json', content: manifest },
      { path: 'README.md', content: '大写路径' },
      { path: 'readme.md', content: '小写路径' },
      { path: 'examples/demo.lcpp', content: '命令()' }
    ], moduleDir),
    /文件路径大小写冲突/u
  );
  await assert.rejects(() => fs.stat(moduleDir), { code: 'ENOENT' });
});

test('AI 模块导入拒绝与旧目录文件发生大小写冲突的路径', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-import-existing-case-'));
  const moduleDir = path.join(root, 'module');
  await fs.mkdir(moduleDir, { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'README.md'), '旧说明', 'utf8');
  const manifest = JSON.stringify({
    schemaVersion: 2,
    id: 'ai.existing-case.module',
    name: '旧目录大小写模块',
    version: '1.0.0',
    category: 'AI',
    description: '测试旧目录路径冲突。',
    contributes: {
      commands: [{ name: '命令', signature: '命令()', description: '测试命令。', insertText: '命令()', returnType: '空' }],
      docs: [{ title: '说明', path: 'readme.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: { commands: [{ command: '命令', runtimeName: '命令', returnType: 'void' }] }
  });

  await assert.rejects(
    () => importAiModuleFiles([
      { path: 'lingbuilder.module.json', content: manifest },
      { path: 'readme.md', content: '新说明' },
      { path: 'examples/demo.lcpp', content: '命令()' }
    ], moduleDir),
    /文件路径大小写冲突/u
  );
  assert.equal(await fs.readFile(path.join(moduleDir, 'README.md'), 'utf8'), '旧说明');
});

test('AI 模块严格清单校验对错误字段类型返回中文诊断而不是 TypeError', () => {
  const base = {
    schemaVersion: 2,
    id: 'ai.invalid.shape',
    name: '错误结构模块',
    version: '1.0.0',
    category: 'AI',
    description: '验证错误字段类型。'
  };
  const cases: Array<[string, (manifest: any) => void, string]> = [
    ['contributes.commands', manifest => { manifest.contributes.commands = '错误'; }, 'contributes.commands 必须是数组'],
    ['contributes.docs', manifest => { manifest.contributes.docs = '错误'; }, 'docs.path 必须是数组'],
    ['contributes.examples', manifest => { manifest.contributes.examples = '错误'; }, 'examples.path 必须是数组'],
    ['contributes.snippets', manifest => { manifest.contributes.snippets = '错误'; }, 'contributes.snippets 必须是数组'],
    ['contributes.types', manifest => { manifest.contributes.types = '错误'; }, 'contributes.types 必须是数组'],
    ['bindings.commands', manifest => { manifest.bindings.commands = '错误'; }, 'bindings.commands 必须是数组'],
    ['binding.parameters', manifest => { manifest.bindings.commands = [{ command: '命令', runtimeName: '命令', parameters: '错误' }]; }, 'parameters 必须是数组'],
    ['targets', manifest => { manifest.targets = '错误'; }, 'targets 必须是数组']
  ];
  for (const [name, mutate, expected] of cases) {
    const manifest: any = structuredClone(base);
    manifest.contributes = { commands: [], docs: [], examples: [], types: [], snippets: [] };
    manifest.bindings = { commands: [] };
    mutate(manifest);
    const result = validateModuleManifest(manifest, { requireCommandBindings: true });
    assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes(expected)), `${name}: ${result.diagnostics.join('\n')}`);
  }
});

test('AI 严格清单校验拒绝会让补全崩溃的片段和命令字段', () => {
  const result = validateModuleManifest({
    schemaVersion: 2,
    id: 'ai.invalid.completion',
    name: '错误补全模块',
    version: '1.0.0',
    category: 'AI',
    description: '测试补全字段。',
    contributes: {
      commands: [{ name: '命令', signature: '命令()', description: '测试。', insertText: 42 }],
      snippets: [{ label: '', insertText: '', description: '' }],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: { commands: [{ command: '命令', runtimeName: '命令', returnType: 'void' }] }
  }, { requireCommandBindings: true });

  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('insertText 必须是非空文本')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('snippets[0].label')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('snippets[0].insertText')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('snippets[0].description')));
});

test('AI 严格清单校验要求文档、示例和至少一项可用模块贡献', () => {
  const result = validateModuleManifest({
    schemaVersion: 2,
    id: 'ai.incomplete.module',
    name: '不完整 AI 模块',
    version: '1.0.0',
    category: 'AI',
    description: '只有清单。'
  }, { requireCommandBindings: true });

  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('至少声明一份文档')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('至少声明一个示例')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('至少需要一个可用贡献')));
});

test('AI 严格清单校验拒绝重复的命令 binding', () => {
  const result = validateModuleManifest({
    schemaVersion: 2,
    id: 'ai.duplicate.binding',
    name: '重复 binding 模块',
    version: '1.0.0',
    category: 'AI',
    description: '测试重复 binding。',
    contributes: {
      commands: [{ name: '重复命令', signature: '重复命令()', description: '测试。' }],
      docs: [{ title: '说明', path: 'README.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    bindings: {
      commands: [
        { command: '重复命令', runtimeName: 'First' },
        { command: '重复命令', runtimeName: 'Second' }
      ]
    }
  }, { requireCommandBindings: true });

  assert.ok(result.diagnostics.some(diagnostic => diagnostic.includes('binding 命令重复：重复命令')));
});

test('module documentation service reads only declared UTF-8 files inside the installed module', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-docs-'));
  const moduleId = 'com.example.documented';
  const installPath = path.join(root, '.lingbuilder', 'modules', moduleId);
  const documentPath = 'docs/usage.md';
  await writeFixture(path.join(installPath, documentPath), '# 使用说明\n\n这是模块文档。');
  const module: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: moduleId,
      name: '文档测试模块',
      version: '1.0.0',
      category: '其他',
      description: '验证模块文档受限读取。',
      contributes: {
        docs: [{ title: '使用说明', path: documentPath }],
        examples: [{ title: '最小示例', path: 'examples/最小示例.lcpp', description: '验证示例也可在模块详情打开。' }]
      }
    },
    installPath,
    isInstalled: true,
    diagnostics: []
  };
  await writeFixture(path.join(installPath, 'examples/最小示例.lcpp'), '包 最小示例\n');

  const document = await readModuleDocumentation(module, documentPath, { workspaceRoot: root });
  assert.equal(document.title, '使用说明');
  assert.equal(document.format, 'markdown');
  assert.match(document.content, /这是模块文档/u);
  // 模块详情页把 contributes.examples 一并列为可打开项，读取端必须同样认它（历史缺陷：全部报「未声明」）。
  const example = await readModuleDocumentation(module, 'examples/最小示例.lcpp', { workspaceRoot: root });
  assert.equal(example.title, '最小示例');
  assert.match(example.content, /包 最小示例/u);
  await assert.rejects(
    () => readModuleDocumentation(module, 'docs/private.md', { workspaceRoot: root }),
    (error: unknown) => error instanceof ModuleDocumentationError
      && error.code === 'MODULE_DOCUMENT_NOT_DECLARED'
  );
  await assert.rejects(
    () => readModuleDocumentation(module, '../outside.md', { workspaceRoot: root }),
    (error: unknown) => error instanceof ModuleDocumentationError
      && error.code === 'MODULE_DOCUMENT_INVALID_PATH'
  );
});

test('built-in module documentation resolves from its packaged asset module', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-builtin-module-docs-'));
  const installPath = path.join(root, '.lingbuilder', 'modules', 'lingbuilder.cef3.sdk');
  await writeFixture(path.join(installPath, 'README.md'), '# CEF3 模块说明');
  const module = BUILTIN_MODULES.find(candidate => candidate.id === 'lingbuilder.cef3.browser');
  assert.ok(module);
  const document = await readModuleDocumentation({
    manifest: module,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    diagnostics: []
  }, 'README.md', { workspaceRoot: root });
  assert.match(document.content, /CEF3 模块说明/u);

  const resourceRoot = path.join(root, 'resources');
  const threadingDocumentPath = 'docs/modules/threading/README.md';
  await writeFixture(path.join(resourceRoot, threadingDocumentPath), '# 多线程模块使用说明');
  const threadingModule = BUILTIN_MODULES.find(candidate => candidate.id === 'lingbuilder.threading');
  assert.ok(threadingModule);
  const threadingDocument = await readModuleDocumentation({
    manifest: threadingModule,
    installPath: 'builtin://lingbuilder.threading',
    isBuiltin: true,
    isInstalled: true,
    diagnostics: []
  }, threadingDocumentPath, { workspaceRoot: root, resourceRoot });
  assert.match(threadingDocument.content, /多线程模块使用说明/u);
});

test('Win32 runtime control module documents are declared and readable from packaged resources', async () => {
  const resourceRoot = path.resolve('.');
  for (const id of ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls']) {
    const manifest = BUILTIN_MODULES.find(candidate => candidate.id === id);
    assert.ok(manifest);
    const declared = manifest.contributes?.docs?.[0];
    assert.ok(declared?.path.startsWith('docs/modules/win32-'));
    const document = await readModuleDocumentation({
      manifest,
      installPath: `builtin://${id}`,
      isBuiltin: true,
      isInstalled: true,
      diagnostics: []
    }, declared.path, { workspaceRoot: path.resolve('..'), resourceRoot });
    assert.match(document.content, /标记文本/u);
    assert.match(document.content, /控件_是否有效/u);
    assert.match(document.content, /Win32\/x64/u);
  }
});

test('market index can store portable workspace-relative package paths without changing CLI defaults', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-market-'));
  const packagePath = path.join(root, '.lingbuilder', 'module-packages', 'demo.lbmod');
  const relativeOut = path.join(root, '.lingbuilder', 'relative-market.json');
  const absoluteOut = path.join(root, '.lingbuilder', 'absolute-market.json');
  await writeFixture(packagePath, 'package');

  await createMarketIndex([packagePath], relativeOut, { packagePathRoot: root });
  await createMarketIndex([packagePath], absoluteOut);
  const relativeMarket = JSON.parse(await fs.readFile(relativeOut, 'utf8'));
  const absoluteMarket = JSON.parse(await fs.readFile(absoluteOut, 'utf8'));
  assert.equal(relativeMarket.modules[0].packagePath, '.lingbuilder/module-packages/demo.lbmod');
  assert.equal(absoluteMarket.modules[0].packagePath, path.resolve(packagePath));
});

test('module manifest validation accepts valid modules and rejects unsafe cpp paths', () => {
  const valid = validateModuleManifest({
    schemaVersion: 2,
    id: 'com.example.sqlite',
    name: 'SQLite数据库模块',
    version: '1.0.0',
    category: '数据库',
    description: '提供 SQLite 数据库访问能力。',
    contributes: {
      commands: [{ name: '执行SQL', signature: '执行SQL(语句)', description: '执行一条 SQL 语句。' }]
    },
    targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', headers: ['include/sqlite_bridge.h'], sources: ['src/sqlite_bridge.cpp'] }],
    bindings: { commands: [{ command: '执行SQL', runtimeName: 'ExecuteSql', parameters: [{ name: '语句', type: 'wideString' }], returnType: 'int' }] }
  });

  assert.equal(valid.diagnostics.length, 0);
  assert.equal(valid.manifest?.id, 'com.example.sqlite');

  const invalid = validateModuleManifest({
    schemaVersion: 2,
    id: 'com.example.bad',
    name: '坏模块',
    version: '1.0.0',
    category: '数据库',
    description: '包含不安全路径。',
    targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', headers: ['../secret.h'] }]
  });

  assert.ok(invalid.diagnostics.some(message => message.includes('安全')));
});

test('module manifest validation rejects v1 packages with migration guidance', () => {
  const invalid = validateModuleManifest({
    schemaVersion: 1,
    id: 'com.example.legacy',
    name: '旧模块',
    version: '1.0.0',
    category: '其他',
    description: '旧版模块。'
  });
  assert.ok(invalid.diagnostics.some(message => message.includes('schemaVersion 必须为 2')));
});

test('LingCpp language service consumes module completions and disabled-module diagnostics', () => {
  const sqliteModule = createTestModule();

  const completions = getLingCppCompletions(
    { source: '', line: 1, column: 1 },
    { enabledModules: [sqliteModule], availableModules: [sqliteModule] }
  );

  assert.ok(completions.some(item => item.label === '执行SQL'));
  assert.ok(completions.some(item => item.label === '数据库连接'));
  assert.ok(completions.some(item => item.label === '打开数据库模板'));

  const diagnostics = getLingCppSemanticDiagnostics(
    '执行SQL("select 1")',
    undefined,
    undefined,
    { enabledModules: [], availableModules: [sqliteModule] }
  );

  assert.ok(diagnostics.some(item => item.id.includes('lingcpp-module-disabled-com.example.sqlite')));
});

test('module context adapters feed beginner IDE and AI assistant context', () => {
  const sqliteModule = createTestModule();
  const disabledModule: InstalledModule = {
    ...createTestModule(),
    manifest: {
      ...createTestModule().manifest,
      id: 'com.example.disabled',
      name: 'DisabledNetwork',
      description: 'Disabled test module'
    },
    isEnabledForProject: false
  };
  const moduleContext = {
    enabledModules: [sqliteModule],
    availableModules: [sqliteModule, disabledModule]
  };

  const beginnerCompletions = getBeginnerModuleCodeCompletions(moduleContext);
  assert.ok(beginnerCompletions.some(item => item.kind === 'command' && item.insertText.includes('SQL')));
  assert.ok(beginnerCompletions.some(item => item.kind === 'type'));

  const hints = getBeginnerModuleCommandHints(moduleContext);
  assert.equal(hints.执行SQL.returnDescription, '返回受影响的记录数量。');
  assert.deepEqual(hints.执行SQL.parameters, [{
    name: '语句',
    type: '文本型',
    note: '要执行的 SQL 语句。'
  }]);

  const aiSummary = describeLingCppModuleContextForAi(moduleContext);
  assert.ok(aiSummary.includes('com.example.sqlite'));
  assert.ok(aiSummary.includes('com.example.disabled'));
  assert.ok(aiSummary.includes('SQL'));
});

test('中文模块命令支持拼音首字母、全拼和中文拼音混合补全', () => {
  const manifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic');
  assert.ok(manifest);
  const basicModule: InstalledModule = {
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const moduleContext = { enabledModules: [basicModule], availableModules: [basicModule] };
  const beginnerCompletion = getBeginnerModuleCodeCompletions(moduleContext)
    .find(item => item.label === '控件_设置选择项');

  assert.ok(beginnerCompletion);
  assert.ok(beginnerCompletion.aliases.some(alias => alias.startsWith('kj_')));
  assert.ok(beginnerCompletion.aliases.some(alias => alias.startsWith('控件_sz')));
  assert.ok(beginnerCompletion.aliases.some(alias => alias.startsWith('kongjian_shezhi')));
  assert.ok(getLingCppCompletions(
    { source: '', line: 1, column: 3, triggerText: 'kj' },
    moduleContext
  ).some(item => item.label === '控件_设置选择项'));
  assert.ok(getLingCppCompletions(
    { source: '', line: 1, column: 6, triggerText: '控件_sz' },
    moduleContext
  ).some(item => item.label === '控件_设置选择项'));
  const integerCompletion = getBeginnerModuleCodeCompletions(moduleContext)
    .find(item => item.label === '到整数');
  const textCompletion = getBeginnerModuleCodeCompletions(moduleContext)
    .find(item => item.label === '到文本');
  const formatCompletion = getBeginnerModuleCodeCompletions(moduleContext)
    .find(item => item.label === '格式化文本');
  assert.ok(integerCompletion?.aliases.includes('dzs'));
  assert.ok(textCompletion?.aliases.includes('dwb'));
  assert.ok(formatCompletion?.aliases.includes('gshwb'));
  assert.match(formatCompletion?.insertText || '', /格式化文本\("：\{\}"/u);
  assert.ok(getLingCppCompletions(
    { source: '', line: 1, column: 4, triggerText: 'dzs' },
    moduleContext
  ).some(item => item.label === '到整数'));
  assert.ok(getLingCppCompletions(
    { source: '', line: 1, column: 4, triggerText: 'dwb' },
    moduleContext
  ).some(item => item.label === '到文本'));
  assert.ok(getLingCppCompletions(
    { source: '', line: 1, column: 5, triggerText: 'gshwb' },
    moduleContext
  ).some(item => item.label === '格式化文本'));
});

test('generateLingCppNativeWin32Project emits module dependency report', () => {
  const module: InstalledModule = {
    ...createTestModule(),
    manifest: {
      ...createTestModule().manifest,
      id: 'com.example.native',
      name: '原生扩展模块',
      category: '系统',
      contributes: {
        commands: [{ name: '原生命令', signature: '原生命令()', description: '测试命令。' }]
      },
      targets: [
        {
          id: 'windows-msvc-win32',
          platform: 'windows',
          arch: 'win32',
          toolchain: 'msvc',
          headers: ['include/native_bridge.h'],
          sources: ['src/native_bridge.cpp'],
          libs: ['native_bridge.lib'],
          defines: ['LINGBUILDER_NATIVE_BRIDGE']
        }
      ],
      bindings: { commands: [{ command: '原生命令', runtimeName: 'NativeCommand', returnType: 'void' }] }
    }
  };

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: '',
    enabledModules: [module]
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';

  assert.ok(mainCpp.includes('LingBuilder 模块: 原生扩展模块'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "modules/com.example.native/native_bridge.lib")'));
  assert.ok(moduleReport.includes('原生扩展模块'));
  assert.ok(moduleReport.includes('include/native_bridge.h'));
});

test('new_emoji style module manifest supports full command and runtime contributions', () => {
  const validation = validateModuleManifest({
    schemaVersion: 2,
    id: 'lingbuilder.new_emoji.ui',
    name: 'new_emoji 原生界面库',
    version: '1.0.0',
    category: '界面',
    description: '集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL。',
    contributes: {
      commands: [
        { name: 'NE_创建窗口', signature: 'NE_创建窗口(标题, X, Y, 宽度, 高度)', description: '创建 new_emoji 原生窗口。' },
        { name: '创建按钮', signature: '创建按钮(hwnd, parent_id, emoji_bytes, emoji_len, text_bytes, text_len, x, y, w, h)', description: 'new_emoji 创建按钮底层导出。' }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/new_emoji_bridge.h'],
        sources: ['src/new_emoji_bridge.cpp'],
        libs: ['lib/Win32/new_emoji.lib'],
        runtimeFiles: ['bin/Win32/new_emoji.dll'],
        defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
      }
    ],
    bindings: {
      commands: [
        { command: 'NE_创建窗口', runtimeName: 'NE_创建窗口', parameters: [{ name: '标题', type: 'wideString' }], returnType: 'handle' },
        { command: '创建按钮', runtimeName: 'EU_CreateButton', returnType: 'int', encoding: 'raw' }
      ]
    }
  });

  assert.equal(validation.diagnostics.length, 0);
  assert.equal(validation.manifest?.id, 'lingbuilder.new_emoji.ui');
});

test('new_emoji module commands feed completion and disabled-module diagnostics', () => {
  const module = createNewEmojiTestModule('C:/modules/lingbuilder.new_emoji.ui');
  assert.equal(getPreferredModuleTarget(module, 'windows-msvc-win32')?.arch, 'win32');
  assert.equal(getPreferredModuleTarget(module, 'windows-msvc-x64')?.arch, 'x64');
  const completions = getLingCppCompletions(
    { source: '', line: 1, column: 1 },
    { enabledModules: [module], availableModules: [module] }
  );

  assert.ok(completions.some(item => item.label === 'NE_创建窗口'));
  assert.ok(completions.some(item => item.label === '创建按钮'));

  const diagnostics = getLingCppSemanticDiagnostics(
    'NE_创建窗口("示例", 120, 120, 860, 560)',
    undefined,
    undefined,
    { enabledModules: [], availableModules: [module] }
  );

  assert.ok(diagnostics.some(item => item.id.includes('lingcpp-module-disabled-lingbuilder.new_emoji.ui')));
});

test('built-in WebSocket client 2.0 contributes managed commands and deterministic dual-backend C++ bindings', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.websocket.client');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.websocket.client',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };

  const completions = getLingCppCompletions(
    { source: '', line: 1, column: 1 },
    { enabledModules: [module], availableModules: [module] }
  );

  assert.ok(!completions.some(item => item.label === 'WS_连接'));
  assert.ok(completions.some(item => item.label === 'WS_创建连接'));
  assert.ok(completions.some(item => item.label === 'WebSocket 受管客户端'));

  const commands = manifest.contributes?.commands || [];
  const bindings = manifest.bindings?.commands || [];
  assert.equal(manifest.version, '2.0.0');
  assert.equal(manifest.minLingBuilderVersion, '0.2.8');
  assert.equal(WEBSOCKET_CLIENT_COMMAND_SPECS.length, 51);
  assert.equal(commands.length, 51);
  assert.equal(bindings.length, 51);
  assert.deepEqual(new Set(commands.map(item => item.name)), new Set(bindings.map(item => item.command)));
  assert.deepEqual(manifest.contributes?.types?.map(item => item.name), ['WebSocket连接']);
  assert.equal(manifest.contributes?.types?.[0]?.cppType, 'long long');
  assert.deepEqual(manifest.targets?.map(item => item.id), ['windows-msvc-win32', 'windows-msvc-x64']);
  assert.deepEqual(manifest.contributes?.docs, [{ title: 'WebSocket 客户端模块 2.0 使用说明', path: 'docs/modules/websocket-client/README.md' }]);
  ['WS_绑定已连接处理器', 'WS_绑定消息处理器', 'WS_绑定已断开处理器', 'WS_绑定错误处理器', 'WS_绑定重连处理器']
    .forEach(command => {
      const handler = bindings.find(item => item.command === command)?.parameters?.[1];
      assert.equal(handler?.type, 'handler');
      assert.deepEqual(handler?.handlerSignature, { parameterTypes: [], returnType: '空' });
    });
  ['WS_连接', 'WS_发送文本', 'WS_接收到调试输出', 'WS_接收文本', 'WS_关闭']
    .forEach(command => assert.equal(commands.find(item => item.name === command)?.visibility, 'advanced'));

  const handlerDiagnostics = getLingCppSemanticDiagnostics([
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        WS_绑定消息处理器(WS_创建连接(), "错误写法")',
    '        WS_绑定错误处理器(WS_创建连接(), &带参数处理器)',
    '    结束',
    '    事件 带参数处理器(整数型 状态)',
    '    结束',
    '结束类'
  ].join('\n'), undefined, 'MainWindow.lcpp', { enabledModules: [module], availableModules: [module] });
  assert.ok(handlerDiagnostics.some(item => item.level === 'error' && item.message.includes('必须使用 &处理器名')));
  assert.ok(handlerDiagnostics.some(item => item.level === 'error' && item.message.includes('带参数处理器 签名不匹配')));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 WebSocket连接 连接 = WS_创建连接()',
      '        WS_配置连接(连接, "wss://example.com/ws?token=1")',
      '        WS_设置资源限制(连接, 15000, 60000, 16, 8)',
      '        WS_设置Origin(连接, "https://example.com")',
      '        WS_设置子协议(连接, "chat.v2, chat.v1")',
      '        WS_设置TLS验证(连接, 真, 假, "")',
      '        WS_设置自动重连(连接, 真, 8, 500, 30000)',
      '        WS_绑定已连接处理器(连接, &连接成功)',
      '        WS_绑定消息处理器(连接, &收到消息)',
      '        WS_开始连接(连接)',
      '    结束',
      '    事件 连接成功()',
      '        WS_发送文本到连接(WS_取当前连接(), "你好")',
      '    结束',
      '    事件 收到消息()',
      '        如果 (WS_取当前消息类型() == "文本")',
      '            调试输出(WS_取当前文本())',
      '        如果结束',
      '结束类'
    ].join('\n'),
    enabledModules: [module]
  });

  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.ok(mainCpp.includes('#include <winhttp.h>'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "winhttp.lib")'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "crypt32.lib")'));
  assert.ok(mainCpp.includes('class LingWebSocketClientRuntime'));
  assert.ok(mainCpp.includes('WinHttpWebSocketReceive('));
  assert.ok(mainCpp.includes('CryptHashCertificate2(BCRYPT_SHA256_ALGORITHM'));
  assert.ok(mainCpp.includes('case WM_LINGBUILDER_WS_CLIENT_EVENT:'));
  assert.ok(mainCpp.includes('long long WS_创建连接()'));
  assert.ok(mainCpp.includes('int WS_连接(const wchar_t* url)'));
  assert.ok(mainCpp.includes('WinHttpSetOption(request, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0)'));
  assert.ok(mainCpp.includes('WS_配置连接(连接, L"wss://example.com/ws?token=1");'));
  assert.ok(mainCpp.includes('WS_设置TLS验证(连接, true, false, L"");'));
  assert.ok(mainCpp.includes('WS_绑定消息处理器(连接, L"收到消息");'));
  assert.ok(mainCpp.includes('WS_发送文本到连接(WS_取当前连接(), L"你好");'));
  assert.ok(mainCpp.includes('std::wstring(LingCppWideArg(WS_取当前消息类型()))==LingCppWideArg(L"文本")'));
  assert.ok(moduleReport.includes('WebSocket 客户端模块'));
  assert.ok(moduleReport.includes('winhttp.lib'));
  assert.ok(moduleReport.includes('crypt32.lib'));

  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: 'WebSocket 客户端双后端测试',
      targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const newEmojiGenerated = generateLingCppNativeWin32Project({
    ...sampleProject,
    id: 'websocket-client-new-emoji-test',
    windows: sampleProject.windows.map(window => ({ ...window, designerBackend: 'new-emoji' }))
  }, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        局部 WebSocket连接 连接 = WS_创建连接()',
      '        WS_配置连接(连接, "ws://127.0.0.1:18080/ws")',
      '        WS_绑定消息处理器(连接, &收到消息)',
      '        WS_开始连接(连接)',
      '    结束',
      '    事件 收到消息()',
      '        WS_发送文本到连接(WS_取当前连接(), WS_取当前文本())',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules: [newEmojiModule, module]
  });
  assert.deepEqual(newEmojiGenerated.blockingDiagnostics, []);
  const newEmojiCpp = newEmojiGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(newEmojiCpp.includes('static LingWebSocketClientRuntime g_wsClientRuntime'));
  assert.ok(newEmojiCpp.includes('LB_NE_CreateWebSocketClientEventWindow'));
  assert.ok(newEmojiCpp.includes('static long long WS_创建连接();'));
  assert.ok(newEmojiCpp.indexOf('static long long WS_创建连接();') < newEmojiCpp.indexOf('static void MainWindow_创建完毕() {'));
});

test('built-in EdgeView module contributes HWND embedding, browser events and JavaScript results', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  const designer = manifest.contributes?.designerControls?.find(control => control.type === 'EdgeBrowser');
  assert.equal(designer?.nativeAdapter, 'edgeview-browser');
  assert.equal(EDGEVIEW_BROWSER_EVENTS.length, 71);
  assert.equal(EDGEVIEW_BROWSER_EVENTS.length + EDGEVIEW_COMPOSITION_ONLY_EVENTS.length, 73);
  assert.equal(new Set(EDGEVIEW_BROWSER_EVENTS.map(event => event.id)).size, EDGEVIEW_BROWSER_EVENTS.length);
  assert.equal(new Set(EDGEVIEW_BROWSER_EVENTS.map(event => event.name)).size, EDGEVIEW_BROWSER_EVENTS.length);
  assert.deepEqual(
    designer?.events?.map(event => event.name),
    EDGEVIEW_BROWSER_EVENTS.map(event => event.designerId || event.id)
  );
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.edgeview',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const completions = getLingCppCompletions(
    { source: 'EdgeView_', line: 1, column: 10 },
    { enabledModules: [module], availableModules: [module] }
  );
  assert.ok(completions.some(item => item.label === 'EdgeView_创建'));
  assert.ok(completions.some(item => item.label === 'EdgeView_创建区域'));
  assert.ok(completions.some(item => item.label === 'EdgeView_绑定事件'));
  assert.ok(completions.some(item => item.label === 'EdgeView_设置全局代理'));
  assert.ok(completions.some(item => item.label === 'EdgeView_创建区域代理'));
  assert.ok(completions.some(item => item.label === 'EdgeView_执行JS'));
  assert.ok(completions.some(item => item.label === 'EdgeView_导航控件'));
  assert.ok(completions.some(item => item.label === 'EdgeView_监听开发者工具事件'));
  assert.ok(completions.some(item => item.label === 'EdgeView_监听开发者工具事件控件'));
  assert.ok(completions.some(item => item.label === 'EdgeView脚本_执行异步'));
  assert.ok(completions.some(item => item.label === 'EdgeView会话_取Cookie异步'));
  assert.ok(completions.some(item => item.label === 'EdgeView 嵌入与 JS 返回值'));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: [
      '类 MainWindow',
      '  事件 _MainWindow_创建完毕()',
      '    EdgeView_创建区域(1, 10, 10, 300, 400, "https://example.com", ".edgeview/cache-1")',
      '    EdgeView_创建区域(2, 320, 10, 300, 400, "https://example.org", ".edgeview/cache-2")',
      '    EdgeView_绑定事件(1, "导航完成", "浏览器1_导航完成")',
      '    EdgeView_监听开发者工具事件(1, "Console.messageAdded")',
      '  结束',
      '  事件 浏览器1_导航完成()',
      '    调试输出("浏览器1回调")',
      '  结束',
      '结束类'
    ].join('\n')
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('#include <WebView2.h>'));
  assert.ok(mainCpp.includes('#define LINGBUILDER_EDGEVIEW_MODULE'));
  assert.ok(mainCpp.includes('int EdgeView_创建实例(int instanceId'));
  assert.ok(mainCpp.includes('int EdgeView_创建区域(int instanceId'));
  // C-2：EdgeView 区域/弹窗/实例尺寸按逻辑坐标（DIP）随窗口 DPI 缩放，不得把请求值直接当物理像素。
  assert.ok(mainCpp.includes('ScaleForDpi(x, dpi_), ScaleForDpi(y, dpi_), ScaleForDpi(width, dpi_), ScaleForDpi(height, dpi_), hwnd_'));
  assert.ok(mainCpp.includes('const UINT effectivePopupDpi = popupDpi ? popupDpi : dpi_;'));
  assert.ok(mainCpp.includes('AdjustWindowRectForDpiValue(&windowRect, style, FALSE, 0, effectivePopupDpi);'));
  assert.ok(mainCpp.includes('RECT windowRect = { 0, 0, ScaleForDpi(width, effectivePopupDpi), ScaleForDpi(height, effectivePopupDpi) };'));
  assert.ok(mainCpp.includes('RECT bounds = { 0, 0, ScaleForDpi(width, effectiveDpi), ScaleForDpi(height, effectiveDpi) };'));
  assert.equal(mainCpp.includes('RECT windowRect = { 0, 0, width, height };'), false);
  assert.ok(mainCpp.includes('std::map<int, std::shared_ptr<EdgeViewInstance>> edgeViews_'));
  assert.ok(mainCpp.includes('std::shared_ptr<EdgeViewTaskState> EdgeView任务_新建'));
  assert.ok(mainCpp.includes('控件已经关闭或重建，已拒绝迟到回调'));
  assert.ok(mainCpp.includes('std::wstring EdgeView_执行JS实例'));
  assert.ok(mainCpp.includes('add_NavigationCompleted'));
  assert.ok(mainCpp.includes('add_WebMessageReceived'));
  assert.ok(mainCpp.includes('add_ContextMenuRequested'));
  for (const event of EDGEVIEW_BROWSER_EVENTS) {
    const nativeEventName = event.id.includes('.') ? event.id.slice(event.id.lastIndexOf('.') + 1) : event.id;
    assert.ok(mainCpp.includes(`add_${nativeEventName}`), `缺少 WebView2 事件订阅：${event.id}`);
    assert.ok(mainCpp.includes(`TextEquals(eventName, L"${event.name}")`), `缺少设计器事件映射：${event.name}`);
  }
  assert.ok(mainCpp.includes('ICoreWebView2Frame7'));
  assert.ok(mainCpp.includes('ICoreWebView2Environment8'));
  assert.ok(mainCpp.includes('ICoreWebView2Profile8'));
  assert.ok(mainCpp.includes('ICoreWebView2Find'));
  assert.ok(mainCpp.includes('GetDevToolsProtocolEventReceiver'));
  assert.ok(mainCpp.includes('std::map<std::wstring, UINT64> eventCounts'));
  assert.ok(mainCpp.includes('CreateContextMenuItem(L"刷新"'));
  assert.ok(mainCpp.includes('EdgeView_刷新实例(raw->id);'));
  assert.ok(mainCpp.includes('std::wstring edgeViewGlobalProxy_'));
  assert.ok(mainCpp.includes('L"--proxy-server=" + raw->proxyServer'));
  assert.ok(mainCpp.includes('environmentOptions->put_AdditionalBrowserArguments'));
  assert.ok(mainCpp.includes('EdgeView_调整全部大小();'));
  assert.ok(mainCpp.includes('LB_WindowBorderStyleToDwStyle(spec_.borderStyle, spec_.maximizable) | WS_CLIPCHILDREN | WS_CLIPSIBLINGS'));
  assert.ok(mainCpp.includes('controller->put_IsVisible(TRUE);'));
  assert.ok(mainCpp.includes('instance.controller->NotifyParentWindowPositionChanged();'));
  assert.ok(mainCpp.includes('SetWindowPos(instance->host, HWND_TOP'));
  assert.ok(mainCpp.includes('if (callback == L"浏览器1_导航完成") { 浏览器1_导航完成(); return; }'));
  assert.ok(mainCpp.includes('EdgeView_创建区域(1, 10, 10, 300, 400, L"https://example.com", L".edgeview/cache-1");'));
  assert.ok(mainCpp.includes('EdgeView_监听开发者工具事件(1, L"Console.messageAdded");'));
});

test('EdgeView user documentation is generated from the unified event catalog', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.ok(manifest.contributes?.docs?.some(document => (
    document.path === 'docs/modules/edgeview/README.md'
  )));

  const document = await fs.readFile(
    new URL('../docs/modules/edgeview/README.md', import.meta.url),
    'utf8'
  );
  assert.match(document, new RegExp(`普通 HWND 可达事件。事件名称、稳定 WebView2 标识`));
  assert.match(document, new RegExp(`目录项数：${EDGEVIEW_BROWSER_EVENTS.length}；`));
  assert.ok(document.includes('EdgeView_绑定控件事件'));
  assert.ok(document.includes('EdgeView事件_取字段'));
  for (const [index, event] of EDGEVIEW_BROWSER_EVENTS.entries()) {
    assert.ok(
      document.includes(`| ${index + 1} | ${event.name} | \`${event.id}\``),
      `用户文档缺少事件：${event.name}`
    );
  }
  for (const event of EDGEVIEW_COMPOSITION_ONLY_EVENTS) {
    assert.ok(document.includes(`| \`${event.id}\` | ${event.name} |`));
  }
});

test('CEF3 user documentation covers the unified event catalog and every public family command', async () => {
  const coreManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(coreManifest);
  assert.ok(coreManifest.contributes?.docs?.some(document => (
    document.path === 'docs/modules/cef3/README.md'
  )));
  const expectedCoverageDocuments = [
    'browser', 'events', 'session', 'transfer', 'objects', 'automation',
    'stream-handlers', 'network', 'devtools', 'devtools-observer', 'views', 'osr', 'platform', 'examples'
  ].map(name => `docs/modules/cef3/${name}.md`);
  assert.ok(expectedCoverageDocuments.every(expected => (
    coreManifest.contributes?.docs?.some(document => document.path === expected)
  )));
  const examplePath = 'docs/modules/cef3/examples/CEF3多浏览器窗体.lcpp';
  assert.equal(coreManifest.contributes?.examples?.[0]?.path, examplePath);
  await fs.access(path.resolve(process.cwd(), examplePath));
  const exampleDocument = await fs.readFile(
    new URL('../docs/modules/cef3/examples.md', import.meta.url),
    'utf8'
  );
  assert.match(exampleDocument, /GroupBox/u);
  assert.match(exampleDocument, /cef3-browser-multi-demo/u);
  assert.match(exampleDocument, /controlRef/u);

  const family = BUILTIN_MODULES.filter(item => item.id.startsWith('lingbuilder.cef3'));
  const publicCommands = family.flatMap(module => (
    module.contributes?.commands?.filter(command => command.visibility !== 'internal') || []
  ));
  const document = await fs.readFile(
    new URL('../docs/modules/cef3/README.md', import.meta.url),
    'utf8'
  );

  // 2026-09-12 写回：CEF3 JS 交互新增「查询请求（OnQuery）/ 查询已取消（OnQueryCanceled）」
  // 两个事件条目与 CEF3_启用JS扩展 / CEF3_查询应答 / CEF3_查询应答失败 三条公开命令。
  assert.equal(CEF3_BROWSER_EVENTS.length, 98);
  // 2026-09-19 再写回：CEF3 多店铺能力对齐新增 CEF3_创建弹窗浏览器 / CEF3_创建区域 / CEF3_枚举实例JSON / CEF3_关闭全部实例 / CEF3会话_取上下文实例 / CEF3_设置用户代理 / CEF3_设置实例用户代理 / CEF3_取用户代理 / CEF3_取实例用户代理（9 条公开命令）。
  // 2026-09-19 再写回：三内核填表/框架能力补齐给 CEF3 新增 CEF3框架_* 25 条、
  // CEF3填表_*（写入族）12 条、CEF3平台_* 跨域白名单 3 条，公开命令 411 → 451；
  // CEF3 无头浏览器（Task 6）再公开 17 条实例编号命令，451 → 468；
  // CEF3 代理缺口补齐再公开 6 条（全局代理三件 + 代理认证两件 + 取实例代理），468 → 472。
  // 2026-09-20 再写回：lingbuilder.cef3.osr 首批 5 条按句柄寻址的 OSR 命令（重绘/帧率读写/两个订阅位），472 → 478。
  assert.equal(publicCommands.length, 478);
  const threadEntries = CEF3_SAFE_API_CATALOG.filter(entry => entry.functionId.includes('.cef_thread_capi.'));
  assert.equal(threadEntries.length, 5);
  assert.ok(threadEntries.every(entry => entry.implementationStatus === 'implemented'));
  assert.deepEqual(
    threadEntries.find(entry => entry.officialName === 'cef_thread_create')?.inputCodecs,
    ['utf16', 'integer', 'integer', 'boolean', 'integer']
  );
  assert.equal(
    threadEntries.find(entry => entry.officialName === 'get_platform_thread_id')?.outputCodec,
    'integer'
  );
  assert.equal(
    threadEntries.find(entry => entry.officialName === 'get_task_runner')?.ownership,
    'managedTaskRunnerHandle'
  );
  assert.equal(threadEntries.find(entry => entry.officialName === 'is_running')?.outputCodec, 'boolean');
  assert.equal(threadEntries.find(entry => entry.officialName === 'stop')?.outputCodec, 'void');
  const beginTracingEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'cef_begin_tracing');
  assert.deepEqual(beginTracingEntry?.inputCodecs, ['utf16']);
  assert.equal(beginTracingEntry?.outputCodec, 'typedHandle');
  assert.equal(beginTracingEntry?.ownership, 'managedTaskHandle');
  assert.equal(beginTracingEntry?.execution, 'asyncTask');
  assert.equal(beginTracingEntry?.implementationStatus, 'implemented');
  const endTracingEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'cef_end_tracing');
  assert.deepEqual(endTracingEntry?.inputCodecs, ['utf16']);
  assert.equal(endTracingEntry?.outputCodec, 'typedHandle');
  assert.equal(endTracingEntry?.ownership, 'managedTaskHandle');
  assert.equal(endTracingEntry?.execution, 'asyncTask');
  assert.equal(endTracingEntry?.implementationStatus, 'implemented');
  const imeFinishEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'ime_finish_composing_text');
  assert.deepEqual(imeFinishEntry?.inputCodecs, ['typedHandle', 'boolean']);
  assert.equal(imeFinishEntry?.implementationStatus, 'implemented');
  const addWordEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'add_word_to_dictionary');
  assert.deepEqual(addWordEntry?.inputCodecs, ['typedHandle', 'utf16']);
  assert.equal(addWordEntry?.implementationStatus, 'implemented');
  const replaceMisspellingEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'replace_misspelling');
  assert.deepEqual(replaceMisspellingEntry?.inputCodecs, ['typedHandle', 'utf16']);
  assert.equal(replaceMisspellingEntry?.implementationStatus, 'implemented');
  const dragSourceEndedEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'drag_source_system_drag_ended');
  assert.deepEqual(dragSourceEndedEntry?.inputCodecs, ['typedHandle']);
  assert.equal(dragSourceEndedEntry?.implementationStatus, 'implemented');
  const dragTargetLeaveEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'drag_target_drag_leave');
  assert.deepEqual(dragTargetLeaveEntry?.inputCodecs, ['typedHandle']);
  assert.equal(dragTargetLeaveEntry?.implementationStatus, 'implemented');
  const wasHiddenEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'was_hidden');
  assert.deepEqual(wasHiddenEntry?.inputCodecs, ['typedHandle', 'boolean']);
  assert.equal(wasHiddenEntry?.implementationStatus, 'implemented');
  const exitFullscreenEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'exit_fullscreen');
  assert.deepEqual(exitFullscreenEntry?.inputCodecs, ['typedHandle', 'boolean']);
  assert.equal(exitFullscreenEntry?.implementationStatus, 'implemented');
  const hasViewEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'has_view');
  assert.deepEqual(hasViewEntry?.inputCodecs, ['typedHandle']);
  assert.equal(hasViewEntry?.outputCodec, 'boolean');
  assert.equal(hasViewEntry?.implementationStatus, 'implemented');
  const zoomEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'zoom');
  assert.deepEqual(zoomEntry?.inputCodecs, ['typedHandle', 'integer']);
  assert.equal(zoomEntry?.outputCodec, 'void');
  assert.equal(zoomEntry?.implementationStatus, 'implemented');
  const mouseMoveEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'send_mouse_move_event');
  assert.deepEqual(mouseMoveEntry?.inputCodecs, ['typedHandle', 'integer', 'integer', 'integer', 'boolean']);
  assert.equal(mouseMoveEntry?.outputCodec, 'void');
  assert.equal(mouseMoveEntry?.implementationStatus, 'implemented');
  const mouseWheelEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'send_mouse_wheel_event');
  assert.deepEqual(mouseWheelEntry?.inputCodecs, ['typedHandle', 'integer', 'integer', 'integer', 'integer']);
  assert.equal(mouseWheelEntry?.outputCodec, 'void');
  assert.equal(mouseWheelEntry?.implementationStatus, 'implemented');
  const touchEntry = CEF3_SAFE_API_CATALOG.find(entry => entry.officialName === 'send_touch_event');
  assert.deepEqual(touchEntry?.inputCodecs, ['typedHandle', 'integer', 'double', 'double', 'double', 'double', 'double', 'double', 'integer', 'integer', 'integer']);
  assert.equal(touchEntry?.outputCodec, 'void');
  assert.equal(touchEntry?.implementationStatus, 'implemented');
  assert.ok(document.includes('`CEF3_执行缩放`'));
  assert.ok(document.includes('`CEF3_发送鼠标移动事件`'));
  assert.ok(document.includes('`CEF3_发送鼠标滚轮事件`'));
  assert.ok(document.includes('`CEF3_发送触摸事件`'));
  assert.ok(document.includes('CEF3_绑定事件(浏览器1, "新窗口打开前", &处理新窗口)'));
  assert.ok(document.includes(`目录项数：${CEF3_BROWSER_EVENTS.length}；模块数：${family.length}；用户接口数：${publicCommands.length}。`));
  for (const [index, event] of CEF3_BROWSER_EVENTS.entries()) {
    assert.ok(
      document.includes(`| ${index + 1} | ${event.name} | \`${event.id}\``),
      `CEF3 用户文档缺少事件：${event.name}`
    );
  }
  for (const command of publicCommands) {
    assert.ok(
      document.includes(`| \`${command.name}\` | \`${command.signature}\``),
      `CEF3 用户文档缺少接口：${command.name}`
    );
  }
  const browserReference = await fs.readFile(
    new URL('../docs/modules/cef3/browser.md', import.meta.url),
    'utf8'
  );
  assert.ok(browserReference.includes('CEF3_是否禁用窗口渲染'));
  assert.ok(browserReference.includes('`is_window_rendering_disabled`'));
  assert.ok(browserReference.includes('CEF3_是否已准备关闭'));
  assert.ok(browserReference.includes('`is_ready_to_be_closed`'));
  assert.ok(browserReference.includes('CEF3_是否渲染进程无响应'));
  assert.ok(browserReference.includes('`is_render_process_unresponsive`'));
  assert.ok(browserReference.includes('CEF3_取运行时样式'));
  assert.ok(browserReference.includes('`get_runtime_style`'));
  assert.ok(browserReference.includes('CEF3_取缩放级别'));
  assert.ok(browserReference.includes('`get_zoom_level`'));
  assert.ok(browserReference.includes('CEF3_取默认缩放级别'));
  assert.ok(browserReference.includes('`get_default_zoom_level`'));
  assert.ok(browserReference.includes('CEF3_设置缩放级别'));
  assert.ok(browserReference.includes('`set_zoom_level`'));
  assert.ok(browserReference.includes('CEF3_执行缩放'));
  assert.ok(browserReference.includes('`zoom`'));
  assert.ok(browserReference.includes('CEF3_尝试关闭'));
  assert.ok(browserReference.includes('`try_close_browser`'));
  assert.ok(browserReference.includes('CEF3_通知窗口移动或调整大小'));
  assert.ok(browserReference.includes('`notify_move_or_resize_started`'));
  assert.ok(browserReference.includes('CEF3_通知屏幕信息已改变'));
  assert.ok(browserReference.includes('`notify_screen_info_changed`'));
  assert.ok(browserReference.includes('CEF3_发送捕获丢失事件'));
  assert.ok(browserReference.includes('`send_capture_lost_event`'));
  assert.ok(browserReference.includes('CEF3_取消输入法组合文本'));
  assert.ok(browserReference.includes('`ime_cancel_composition`'));
  assert.ok(browserReference.includes('CEF3_完成输入法组合文本'));
  assert.ok(browserReference.includes('`ime_finish_composing_text`'));
  assert.ok(browserReference.includes('CEF3_添加单词到词典'));
  assert.ok(browserReference.includes('`add_word_to_dictionary`'));
  assert.ok(browserReference.includes('CEF3_替换拼写错误'));
  assert.ok(browserReference.includes('CEF3_通知系统拖放结束'));
  assert.ok(browserReference.includes('CEF3_通知拖放目标离开'));
  assert.ok(browserReference.includes('CEF3_通知隐藏状态'));
  assert.ok(browserReference.includes('`replace_misspelling`'));
  assert.ok(browserReference.includes('CEF3_退出网页全屏'));
  assert.ok(browserReference.includes('`exit_fullscreen`'));
  assert.ok(browserReference.includes('CEF3_是否使用浏览器视图'));
  assert.ok(browserReference.includes('`has_view`'));
  assert.ok(browserReference.includes('CEF3_取打开者浏览器ID'));
  assert.ok(browserReference.includes('`get_opener_identifier`'));
});

test('FBro user documentation covers public events, classified slots and public family commands', async () => {
  const coreManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(coreManifest);
  assert.ok(coreManifest.contributes?.docs?.some(document => (
    document.path === 'docs/modules/fbro/README.md'
  )));

  const family = BUILTIN_MODULES.filter(item => item.id.startsWith('lingbuilder.fbro'));
  const allCommands = family.flatMap(module => module.contributes?.commands || []);
  const publicCommands = allCommands.filter(command => command.visibility !== 'internal');
  const internalCommands = allCommands.filter(command => command.visibility === 'internal');
  const managedCount = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'managed').length;
  const internalCount = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'internal').length;
  const notApplicableCount = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'notApplicable').length;
  const document = await fs.readFile(
    new URL('../docs/modules/fbro/README.md', import.meta.url),
    'utf8'
  );

  assert.equal(FBRO_EVENT_CATALOG.length, 174);
  assert.equal(new Set(FBRO_EVENT_CATALOG.map(event => event.eventToken)).size, 158);
  assert.equal(FBRO_PUBLIC_BROWSER_EVENTS.length, 102);
  // 基线 2026-09-20 写回：FBro 批次4 公开命令 682 → 683（新增 FBro_设置启动开关JSON）。
  assert.equal(publicCommands.length, 683);
  assert.equal(internalCommands.length, 9);
  assert.ok(document.includes('FBro_绑定事件(FBro浏览器1, "新窗口打开前", &处理新窗口)'));
  assert.ok(document.includes(
    `类方法事件槽位：${FBRO_EVENT_CATALOG.length}；唯一事件签名：158；公开事件：${FBRO_PUBLIC_BROWSER_EVENTS.length}；Bridge 托管：${managedCount}；内部事件：${internalCount}；不适用：${notApplicableCount}；模块数：${family.length}；用户接口数：${publicCommands.length}。`
  ));
  for (const event of FBRO_EVENT_CATALOG) {
    assert.ok(document.includes(`\`${event.eventId}\``), `FBro 用户文档缺少事件槽位：${event.eventId}`);
  }
  for (const command of publicCommands) {
    assert.ok(
      document.includes(`| \`${command.name}\` | \`${command.signature}\``),
      `FBro 用户文档缺少接口：${command.name}`
    );
  }
  for (const command of internalCommands) {
    assert.ok(!document.includes(`\`${command.name}\``), `FBro 内部接口不应出现在用户文档：${command.name}`);
  }
});

test('EdgeView 安全 API 目录、binding、处理器补全和运行时符号保持一一对应', () => {
  assert.deepEqual(validateEdgeViewApiCatalog(), []);
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.equal(manifest.version, '1.5.0');
  assert.equal(manifest.minLingBuilderVersion, '0.2.7');
  const commandNames = new Set(manifest.contributes?.commands?.map(command => command.name));
  const bindings = new Map(manifest.bindings?.commands?.map(binding => [binding.command, binding]));
  for (const entry of EDGEVIEW_SAFE_API_CATALOG) {
    assert.ok(commandNames.has(entry.command.name), `缺少 contribution：${entry.command.name}`);
    assert.ok(bindings.has(entry.command.name), `缺少 binding：${entry.command.name}`);
  }
  const bindEvent = bindings.get('EdgeView_绑定控件事件');
  assert.equal(bindEvent?.parameters?.at(-1)?.type, 'handler');
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.edgeview', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const modern = getLingCppSemanticDiagnostics('EdgeView_绑定控件事件("浏览器1", "导航完成", &浏览器1_导航完成)', undefined, undefined, { enabledModules: [module], availableModules: [module] });
  assert.ok(!modern.some(item => item.id.includes('handler-reference-migration')));
  const legacy = getLingCppSemanticDiagnostics('EdgeView_绑定控件事件("浏览器1", "导航完成", "浏览器1_导航完成")', undefined, undefined, { enabledModules: [module], availableModules: [module] });
  assert.ok(legacy.some(item => item.id.includes('handler-reference-migration') && item.suggestion?.includes('&浏览器1_导航完成')));
});

test('EdgeView 1.4.0 多店铺弹窗与实例编号寻址命令进入清单、绑定与生成 C++', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  const contributions = new Set(manifest.contributes?.commands?.map(command => command.name));
  const bindings = new Map(manifest.bindings?.commands?.map(binding => [binding.command, binding]));
  const newCommands = [
    'EdgeView_创建弹窗浏览器', 'EdgeView_创建弹窗浏览器代理', 'EdgeView_关闭全部实例', 'EdgeView_枚举实例JSON',
    'EdgeView_置实例可见', 'EdgeView_置实例大小', 'EdgeView_取实例大小JSON', 'EdgeView_置实例标题',
    'EdgeView设置_置用户代理实例', 'EdgeView设置_取用户代理实例',
    'EdgeView会话_批量置Cookie实例', 'EdgeView会话_置Cookie带属性实例', 'EdgeView会话_删除全部Cookie实例',
    'EdgeView会话_取Cookie实例异步', 'EdgeView会话_清理全部浏览数据实例异步'
  ];
  for (const name of newCommands) {
    assert.ok(contributions.has(name), `缺少 contribution：${name}`);
    assert.ok(bindings.has(name), `缺少 binding：${name}`);
  }
  // 实例编号寻址命令首参必须是 int（实例编号），不得是 controlRef。
  for (const name of newCommands) {
    const first = bindings.get(name)?.parameters?.[0];
    if (first && first.name === '实例编号') assert.equal(first.type, 'int', `${name} 实例编号 应为 int`);
  }
  assert.equal(bindings.get('EdgeView会话_取Cookie实例异步')?.parameters?.at(-1)?.type, 'handler');
  // 弹窗代理变体末参必须是 代理地址（wideString），实现每店铺独立出口 IP。
  assert.equal(bindings.get('EdgeView_创建弹窗浏览器代理')?.parameters?.at(-1)?.name, '代理地址');
  assert.equal(bindings.get('EdgeView_创建弹窗浏览器代理')?.parameters?.at(-1)?.type, 'wideString');
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.edgeview', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const completions = getLingCppCompletions({ source: 'EdgeView_创建弹窗', line: 1, column: 15 }, { enabledModules: [module], availableModules: [module] });
  assert.ok(completions.some(item => item.label === 'EdgeView_创建弹窗浏览器'));
  assert.ok(completions.some(item => item.label === 'EdgeView_创建弹窗浏览器代理'));
  assert.ok(completions.some(item => item.label === 'EdgeView会话_批量置Cookie实例'));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: [
      '类 MainWindow',
      '  事件 _MainWindow_创建完毕()',
      '    EdgeView_创建弹窗浏览器(1, "StoreA", 1000, 720, "https://example.com", ".edgeview/cache-1", "Mozilla/5.0")',
      '    EdgeView_创建弹窗浏览器代理(2, "StoreB", 1000, 720, "https://example.org", ".edgeview/cache-2", "Mozilla/5.0", "http://127.0.0.1:7890")',
      '    EdgeView会话_批量置Cookie实例(1, "[{\\"name\\":\\"PASS_ID\\",\\"value\\":\\"v\\",\\"domain\\":\\"example.com\\",\\"path\\":\\"/\\",\\"secure\\":true,\\"httpOnly\\":true,\\"sameSite\\":1}]")',
      '    EdgeView设置_置用户代理实例(1, "Mozilla/5.0 Test")',
      '    EdgeView_置实例可见(1, 0)',
      '    EdgeView_置实例大小(1, 1200, 800)',
      '    EdgeView_置实例标题(1, "StoreB")',
      '    EdgeView_关闭全部实例()',
      '  结束',
      '结束类'
    ].join('\n')
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('int EdgeView_创建弹窗浏览器(int instanceId'), '缺少 创建弹窗浏览器 运行时定义');
  assert.ok(mainCpp.includes('int EdgeView_创建弹窗浏览器代理(int instanceId'), '缺少 创建弹窗浏览器代理 运行时定义');
  assert.ok(mainCpp.includes('L"LingBuilderEdgeViewPopup"'), '缺少弹窗窗口类名');
  assert.ok(mainCpp.includes('WS_EX_APPWINDOW'), '弹窗顶层窗口缺少 WS_EX_APPWINDOW');
  assert.ok(mainCpp.includes('EdgeView弹窗窗口过程'), '缺少弹窗窗口过程');
  assert.ok(mainCpp.includes('uaSettings2->put_UserAgent'), '创建弹窗未按实例应用 UA');
  assert.ok(mainCpp.includes('popupProxy'), '弹窗未按实例参数应用独立代理');
  assert.ok(mainCpp.includes('int EdgeView会话_批量置Cookie实例(int instanceId'), '缺少 批量置Cookie实例 运行时定义');
  assert.ok(mainCpp.includes('int EdgeView设置_置用户代理实例(int instanceId'), '缺少 置用户代理实例 运行时定义');
  assert.ok(mainCpp.includes('std::wstring EdgeView_枚举实例JSON'), '缺少 枚举实例JSON 运行时定义');
  assert.ok(mainCpp.includes('int EdgeView_关闭全部实例'), '缺少 关闭全部实例 运行时定义');
  assert.ok(mainCpp.includes('int EdgeView_置实例可见(int instanceId'), '缺少 置实例可见 运行时定义');
  // 生成调用点应为宽字符实参 + 实例编号整数。
  assert.ok(mainCpp.includes('EdgeView_创建弹窗浏览器(1, L"StoreA", 1000, 720, L"https://example.com", L".edgeview/cache-1", L"Mozilla/5.0");'));
  assert.ok(mainCpp.includes('EdgeView_创建弹窗浏览器代理(2, L"StoreB", 1000, 720, L"https://example.org", L".edgeview/cache-2", L"Mozilla/5.0", L"http://127.0.0.1:7890");'));
  assert.ok(mainCpp.includes('EdgeView_关闭全部实例();'));
});

test('CEF3 与 FBro 多店铺能力：弹窗/枚举/关闭全部/实例代理进入清单、绑定与生成 C++', () => {
  const cef3 = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  const shell = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.new_emoji.fbro-shell');
  assert.ok(cef3 && shell);
  const cef3Names = new Set(cef3!.contributes?.commands?.map(command => command.name));
  const cef3Bindings = new Map(cef3!.bindings?.commands?.map(binding => [binding.command, binding]));
  for (const name of ['CEF3_创建弹窗浏览器', 'CEF3_创建区域', 'CEF3_枚举实例JSON', 'CEF3_关闭全部实例', 'CEF3会话_取上下文实例', 'CEF3_设置用户代理', 'CEF3_设置实例用户代理', 'CEF3_取用户代理', 'CEF3_取实例用户代理']) {
    assert.ok(cef3Names.has(name), `CEF3 缺少 contribution：${name}`);
    assert.ok(cef3Bindings.has(name), `CEF3 缺少 binding：${name}`);
  }
  // 弹窗首参为整数实例编号（非 controlRef）。
  assert.equal(cef3Bindings.get('CEF3_创建弹窗浏览器')?.parameters?.[0]?.type, 'int');
  // 实例版会话句柄：首参为整数实例编号、返回长整数型（RequestContext 受管句柄）。
  assert.equal(cef3Bindings.get('CEF3会话_取上下文实例')?.parameters?.[0]?.type, 'int');
  assert.equal(cef3Bindings.get('CEF3会话_取上下文实例')?.returnType, 'longLong');
  // 实例级 UA：控件版首参 controlRef、实例版首参 int，均以 wideString 承载 UA。
  assert.deepEqual(cef3Bindings.get('CEF3_设置用户代理')?.parameters?.map(p => p.type), ['controlRef', 'wideString']);
  assert.deepEqual(cef3Bindings.get('CEF3_设置实例用户代理')?.parameters?.map(p => p.type), ['int', 'wideString']);
  const shellNames = new Set(shell!.contributes?.commands?.map(command => command.name));
  const shellBindings = new Map(shell!.bindings?.commands?.map(binding => [binding.command, binding]));
  assert.ok(shellNames.has('浏览器外壳_新建独立实例代理') && shellBindings.has('浏览器外壳_新建独立实例代理'), 'FBro shell 缺少 新建独立实例代理');
  assert.equal(shellBindings.get('浏览器外壳_新建独立实例代理')?.parameters?.[4]?.name, '代理地址');
  assert.equal(shellBindings.get('浏览器外壳_新建独立实例代理')?.parameters?.[5]?.name, '用户代理');
  // FBro 内嵌区域动态（与 EdgeView/CEF3 创建区域同口径）：命令入清单+绑定，参数首为稳定ID、坐标 int。
  assert.ok(shellNames.has('浏览器外壳_新建内嵌实例区域') && shellBindings.has('浏览器外壳_新建内嵌实例区域'), 'FBro shell 缺少 新建内嵌实例区域');
  assert.ok(shellNames.has('浏览器外壳_取内嵌区域实例JSON') && shellBindings.has('浏览器外壳_取内嵌区域实例JSON'), 'FBro shell 缺少 取内嵌区域实例JSON');
  assert.deepEqual(shellBindings.get('浏览器外壳_新建内嵌实例区域')?.parameters?.map(p => p.type),
    ['wideString', 'int', 'int', 'int', 'int', 'wideString', 'wideString', 'wideString', 'wideString']);
  // 生成 C++ 校验：CEF3 弹窗走 Chrome Runtime、枚举/关闭全部符号存在、宽字符调用点正确。
  const cef3Module: InstalledModule = { manifest: cef3!, installPath: 'builtin://lingbuilder.cef3.browser', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [cef3Module],
    lingCppSourceCode: [
      '类 MainWindow',
      '  事件 _MainWindow_创建完毕()',
      '    CEF3_创建弹窗浏览器(1, "https://example.com", ".cef3/store-a", "http://127.0.0.1:7890")',
      '    CEF3会话_取上下文实例(1)',
      '    CEF3_枚举实例JSON()',
      '    CEF3_关闭全部实例()',
      '  结束',
      '结束类'
    ].join('\n')
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('int CEF3_创建弹窗浏览器(int instanceId'), '缺少 CEF3_创建弹窗浏览器 运行时定义');
  assert.ok(mainCpp.includes('LB_CEF3_BrowserCreateChrome'), 'CEF3 弹窗未走 Chrome Runtime');
  assert.ok(mainCpp.includes('std::wstring CEF3_枚举实例JSON'), '缺少 CEF3_枚举实例JSON 运行时定义');
  assert.ok(mainCpp.includes('int CEF3_关闭全部实例'), '缺少 CEF3_关闭全部实例 运行时定义');
  assert.ok(mainCpp.includes('long long CEF3会话_取上下文实例(int instanceId'), '缺少 CEF3会话_取上下文实例 运行时定义');
  assert.ok(mainCpp.includes('CEF3会话_取上下文实例(1);'), 'CEF3 实例版会话句柄调用点缺失');
  assert.ok(mainCpp.includes('int CEF3_设置实例用户代理(int instanceId, const wchar_t* userAgent'), '缺少 CEF3_设置实例用户代理 运行时定义');
  assert.ok(mainCpp.includes('LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad'), 'CEF3 实例级 UA 未点亮资源加载前订阅');
  assert.ok(mainCpp.includes('LB_CEF3_RequestSetHeaderByName'), 'CEF3 事件回调缺少逐实例 User-Agent 请求头改写');
  assert.ok(mainCpp.includes('activeInstance->userAgent.c_str(), 1)'), 'CEF3 事件回调未按实例改写 UA 头');
  assert.ok(mainCpp.includes('L"User-Agent"'), 'CEF3 UA 改写目标头名缺失');
  assert.ok(mainCpp.includes('CEF3_创建弹窗浏览器(1, L"https://example.com", L".cef3/store-a", L"http://127.0.0.1:7890");'), 'CEF3 弹窗宽字符调用点不符');
});

test('EdgeView 导出路径、响应正文时效、回调内同步等待与控件级等待事件保持统一契约', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.deepEqual(validateModuleManifest(manifest).diagnostics, []);

  // 控件级等待事件必须和 _导航控件/_执行JS控件 一样走 controlRef + 裸引用补全。
  const waitControl = manifest.contributes?.commands?.find(command => command.name === 'EdgeView_等待事件控件');
  assert.ok(waitControl, '缺少 EdgeView_等待事件控件 补全贡献');
  assert.equal(waitControl.returnType, '整数型');
  assert.doesNotMatch(waitControl.insertText || '', /["'\u201c]\$1/u);
  const waitBinding = manifest.bindings?.commands?.find(binding => binding.command === 'EdgeView_等待事件控件');
  assert.ok(waitBinding, '缺少 EdgeView_等待事件控件 binding');
  assert.equal(waitBinding.parameters?.[0]?.type, 'controlRef');
  assert.deepEqual((waitBinding.parameters || []).slice(1).map(parameter => parameter.type), ['wideString', 'int']);

  const runtime = EDGEVIEW_SAFE_API_NATIVE_MEMBERS;
  // WebView2 的 PrintToPdf 只接受绝对路径；导出类命令统一先解析路径，任务结果回报绝对落盘位置。
  assert.match(runtime, /const std::wstring target = EdgeView_取绝对路径\(filePath\);/u);
  assert.match(runtime, /PrintToPdf\(target\.c_str\(\)/u);
  assert.doesNotMatch(runtime, /PrintToPdf\(filePath/u);
  assert.equal((runtime.match(/EdgeView_取绝对路径\(filePath\)/gu) || []).length, 5, 'PDF、PDF 流、截图、图标与下载路径都要统一解析绝对路径');
  // 清单声明的 设置JSON 必须有真实实现，不能继续作为被丢掉的哑参数。
  assert.match(runtime, /EdgeView打印_应用设置JSON\(controlName, settingsJson\)/u);
  assert.match(runtime, /shouldPrintBackgrounds/u);
  assert.match(runtime, /EdgeView_打印设置JSON可用\(settingsJson\)/u);
  // 响应正文只在 Web资源响应收到 处理器执行期间可读，失败必须给中文约束说明。
  assert.match(runtime, /EdgeView_说明响应正文时效/u);
  assert.match(runtime, /必须在 Web资源响应收到 处理器执行期间/u);

  const module: InstalledModule = {
    manifest, installPath: 'builtin://lingbuilder.edgeview', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'edge-1', type: 'EdgeBrowser', name: '浏览器1', content: '',
        x: 20, y: 35, width: 285, height: 170, background: '#ffffff', foreground: '#000000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'https://example.com' }, events: {}
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [module],
    lingCppSourceCode: ['类 MainWindow', '  事件 _MainWindow_创建完毕()', '    EdgeView_等待事件控件(浏览器1, "导航完成", 8000)', '  结束', '结束类'].join('\n')
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(generated.blockingDiagnostics.join('\n'), '');
  assert.match(mainCpp, /int EdgeView_等待事件控件\(const wchar_t\* controlName, const wchar_t\* eventName, int timeoutMilliseconds\)/u);
  assert.match(mainCpp, /EdgeView_等待事件控件\(L"浏览器1", L"导航完成", 8000\)/u);
  // 同步执行接口在 WebView2 回调里只会等满 15 秒，必须立刻返回并给出中文诊断。
  assert.match(mainCpp, /if \(instance->eventDecisionActive\) \{ EdgeView_报告回调内同步等待\(L"EdgeView_执行JS"\); return L""; \}/u);
  assert.match(mainCpp, /void EdgeView_报告回调内同步等待\(const wchar_t\* command\)/u);
  // 下载路径决策：WebView2 的 put_ResultFilePath 只收绝对路径且要求父目录已存在，
  // 模块必须自己补全绝对路径、建父目录，并把 HRESULT 变成可见的中文诊断，不能静默失败。
  assert.match(runtime, /instance->eventDownloadPath = target;/u);
  assert.match(runtime, /EdgeView_确保父目录\(target\);/u);
  assert.doesNotMatch(runtime, /EdgeView事件_设置下载路径\(const wchar_t\* controlName, const wchar_t\* filePath\) \{ return EdgeView事件_设置返回文本/u);
  assert.match(runtime, /EdgeView下载_取路径错误/u);
  assert.match(runtime, /resultFilePathError/u);
  assert.match(mainCpp, /const HRESULT pathResult = args->put_ResultFilePath\(raw->eventDownloadPath\.c_str\(\)\);/u);
  assert.match(mainCpp, /EdgeView事件_设置下载路径 未生效/u);
  assert.match(mainCpp, /instance\.eventDownloadPath\.clear\(\);/u);
  // 事件内读到的 path 是决策前快照，必须同时回传本次请求的落点，调用方才能自证。
  assert.match(runtime, /\{L"pendingResultFilePath", EdgeView下载_取请求路径\(controlName, downloadId\)\}/u);
  assert.match(mainCpp, /raw->eventDownloadPaths\[downloadId\] = raw->eventDownloadPath;/u);
});

test('EdgeView designer controls create multiple WebView2 children and bind to generated parent HWNDs', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.edgeview',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [
        {
          id: 'browser-group', type: 'GroupBox', name: '浏览器容器', content: '浏览器容器',
          x: 10, y: 10, width: 610, height: 210, background: '#202020', foreground: '#ffffff',
          fontSize: 14, isEnabled: true, visibility: 'Visible', properties: {}
        },
        {
          id: 'edge-1', parentId: 'browser-group', type: 'EdgeBrowser', name: '浏览器1', content: '',
          x: 20, y: 35, width: 285, height: 170, background: '#ffffff', foreground: '#000000',
          fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'https://example.com' },
          events: { NavigationCompleted: '浏览器1_导航完成' }
        },
        {
          id: 'edge-2', parentId: 'browser-group', type: 'EdgeBrowser', name: '浏览器2', content: '',
          x: 320, y: 35, width: 285, height: 170, background: '#ffffff', foreground: '#000000',
          fontSize: 14, isEnabled: true, visibility: 'Visible',
          properties: { url: 'https://example.org', cacheDir: '.edgeview/custom-2', proxyMode: 'custom', proxyServer: 'http://127.0.0.1:7890' },
          events: { WebMessageReceived: '浏览器2_网页消息' }
        }
      ]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [module],
    lingCppSourceCode: [
      '类 MainWindow',
      '  事件 浏览器1_导航完成()',
      '    EdgeView_导航控件("浏览器2", "https://www.bing.com")',
      '  结束',
      '  事件 浏览器2_网页消息()',
      '    调试输出(EdgeView_取事件数据控件("浏览器2"))',
      '  结束',
      '结束类'
    ].join('\n')
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /virtual void OnWindowCreated\(\) \{ EdgeView_创建控件\(nullptr\);/u);
  assert.match(mainCpp, /IsType\(control, L"EdgeBrowser"\)/u);
  assert.match(mainCpp, /EdgeView_创建核心\(control\.id, runtime->hwnd, false/u);
  assert.match(mainCpp, /GetEventHandler\(\*control, EdgeView_取设计器事件ID/u);
  assert.match(mainCpp, /NavigationCompleted=浏览器1_导航完成/u);
  assert.match(mainCpp, /WebMessageReceived=浏览器2_网页消息/u);
  assert.match(mainCpp, /\.edgeview\/edge-1/u);
  assert.match(mainCpp, /\.edgeview\/custom-2/u);
  assert.match(mainCpp, /EdgeView_导航控件\(L"浏览器2", L"https:\/\/www\.bing\.com"\);/u);
  assert.match(mainCpp, /EdgeView_取事件数据控件\(L"浏览器2"\)/u);
});

test('built-in threading module contributes managed task commands and C++ runtime', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.threading');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.threading',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const completions = getLingCppCompletions(
    { source: '', line: 1, column: 1 },
    { enabledModules: [module], availableModules: [module] }
  );
  assert.ok(completions.some(item => item.label === '线程_提交完成'));
  assert.ok(completions.some(item => item.label === '线程池_创建'));
  assert.ok(completions.some(item => item.label === '线程任务多参数与完成回调'));
  THREADING_LEGACY_COMMANDS.forEach(command => assert.ok(!completions.some(item => item.label === command)));
  assert.equal(manifest.version, '2.1.0');
  assert.deepEqual(manifest.contributes?.commands?.map(command => command.name), THREADING_COMMAND_SPECS.map(command => command.name));
  assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), THREADING_COMMAND_SPECS.map(command => command.name));

  const missingVariadic = structuredClone(manifest);
  const missingVariadicBinding = missingVariadic.bindings?.commands?.find(binding => binding.command === '线程_提交');
  missingVariadicBinding!.parameters![1]!.variadic = false;
  const missingVariadicDiagnostics = validateModuleManifest(missingVariadic).diagnostics;
  assert.ok(missingVariadicDiagnostics.some(message => message.includes('lingValue 参数必须声明 variadic: true')));
  assert.ok(missingVariadicDiagnostics.some(message => message.includes('variadicParameterIndex 必须指向 variadic lingValue 参数')));

  const invalidWorkerIndex = structuredClone(manifest);
  const invalidWorkerBinding = invalidWorkerIndex.bindings?.commands?.find(binding => binding.command === '线程_提交');
  invalidWorkerBinding!.invocation!.workerParameterIndex = 1;
  assert.ok(validateModuleManifest(invalidWorkerIndex).diagnostics.some(message => message.includes('workerParameterIndex 必须指向 handler 参数')));

  const misplacedVariadic = structuredClone(manifest);
  const misplacedBinding = misplacedVariadic.bindings?.commands?.find(binding => binding.command === '线程_提交');
  misplacedBinding!.parameters!.push({ name: '非法尾参数', type: 'int' });
  assert.ok(validateModuleManifest(misplacedVariadic).diagnostics.some(message => message.includes('可变参数必须位于参数列表末尾')));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        线程池 后台池 = 线程池_创建(4, 100)',
      '        线程任务 任务 = 线程_提交进度(&后台工作, &工作进度, &工作完成, 7, "批次A")',
      '        线程_请求取消(任务)',
      '    整数型 后台工作(整数型 数值, 文本型 批次)',
      '        线程_报告进度(100, 批次)',
      '        返回 数值',
      '    空 工作进度(线程任务 任务, 整数型 百分比, 文本型 说明)',
      '        调试输出(说明)',
      '    空 工作完成(线程任务 任务, 整数型 结果)',
      '        调试输出("完成")',
      '结束类'
    ].join('\n'),
    enabledModules: [module]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.deepEqual(generated.blockingDiagnostics, []);
  assert.ok(mainCpp.includes('#include <thread>'));
  assert.ok(mainCpp.includes('class LingThreadProjectRuntime'));
  assert.ok(mainCpp.includes('return LingThreadProjectRuntime::Instance().SubmitProgress'));
  assert.ok(mainCpp.includes('threadOwnerToken_ = LingThreadRegisterWindowOwner(hwnd_);'));
  assert.ok(mainCpp.includes('RegisterOwner(std::function<void(long long)> notify)'));
  assert.ok(!mainCpp.includes('long long RegisterOwner(HWND window)'));
  const threadingCore = mainCpp.slice(
    mainCpp.indexOf('class LingThreadProjectRuntime'),
    mainCpp.indexOf('// Win32 is only the notification/error adapter')
  );
  assert.doesNotMatch(threadingCore, /\b(?:HWND|HANDLE|PostMessageW|OutputDebugStringW)\b/u);
  assert.ok(mainCpp.includes('long long 后台池 = 线程池_创建(4, 100);'));
  assert.ok(mainCpp.includes('lbArg1 = 7, lbArg2 = L"批次A"'));
  assert.ok(mainCpp.includes('return this->后台工作(lbArg1, lbArg2);'));
  assert.ok(mainCpp.includes('this->工作进度(lbTask, lbPercent, lbText);'));
  assert.ok(mainCpp.includes('this->工作完成(lbTask, std::forward<decltype(lbResult)>(lbResult)...);'));
  assert.ok(mainCpp.includes('else (*completion)(taskId, Result{});'));
  assert.ok(mainCpp.includes('线程_请求取消(任务);'));
  assert.ok(!mainCpp.includes('batchProgress_'));
  assert.ok(!mainCpp.includes('std::vector<std::thread> threadTasks_'));
  assert.ok(moduleReport.includes('多线程模块'));
});

test('threading 2.0 blocks legacy commands and invalid managed handlers', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.threading')!;
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.threading', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        线程_启动延时输出("旧调用", 20)',
    '        线程_提交完成("错误工作", &错误完成, 1, "多余参数")',
    '    整数型 错误工作(整数型 数值)',
    '        返回 数值',
    '    整数型 错误完成(线程任务 任务)',
    '        返回 1',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'MainWindow.lcpp', { enabledModules: [module], availableModules: [module] });
  assert.ok(diagnostics.some(item => item.level === 'error' && item.message.includes('已删除旧命令 线程_启动延时输出')));
  assert.ok(diagnostics.some(item => item.level === 'error' && item.message.includes('必须使用 &处理器名')));
});

test('threading 2.0 validates typed variadic handlers and all controlRef bindings', () => {
  const threadingManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.threading')!;
  const threading: InstalledModule = { manifest: threadingManifest, installPath: 'builtin://lingbuilder.threading', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const controlModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'test.control-ref-worker',
      name: '测试控件模块',
      version: '1.0.0',
      category: '界面',
      description: '仅用于验证工作处理器动态阻断 controlRef binding。',
      contributes: {
        commands: [{ name: '读取目标内容', signature: '读取目标内容(目标)', description: '测试动态 controlRef 禁用。' }],
        types: [{ name: '外部句柄', description: '测试禁止跨线程复制的普通 opaque。', cppType: 'long long' }]
      },
      targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc' }],
      bindings: { commands: [{
        command: '读取目标内容',
        runtimeName: '读取目标内容',
        parameters: [{ name: '目标', type: 'controlRef', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'wideName' }],
        returnType: 'wideString'
      }] }
    },
    installPath: 'builtin://test.control-ref-worker',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        线程_提交完成(&混合工作, &错误完成, 7, "批次A")',
    '        线程_提交(&零参数工作)',
    '        线程_提交(&句柄工作, 1)',
    '    整数型 混合工作(整数型 数值, 文本型 批次)',
    '        文本型 内容 = 读取目标内容(结果标签)',
    '        返回 数值',
    '    空 零参数工作()',
    '        线程_协作等待(0)',
    '    空 句柄工作(外部句柄 值)',
    '        线程_协作等待(0)',
    '    整数型 错误完成(线程任务 任务, 文本型 结果)',
    '        返回 1',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, 'MainWindow.lcpp', { enabledModules: [threading, controlModule], availableModules: [threading, controlModule] });
  assert.ok(
    diagnostics.some(item => item.level === 'error' && item.message.includes('不能调用 UI/controlRef 命令 读取目标内容')),
    diagnostics.map(item => item.message).join('\n')
  );
  assert.ok(diagnostics.some(item => item.level === 'error' && item.message.includes('完成处理器 错误完成') && item.message.includes('返回类型不匹配')));
  assert.ok(diagnostics.some(item => item.level === 'error' && item.message.includes('类型 外部句柄 不能在线程间按值深拷贝')));
  assert.ok(!diagnostics.some(item => item.message.includes('零参数工作需要')));
});

test('built-in HTTP and WebSocket server modules contribute managed commands and deterministic C++ bindings', async () => {
  const httpManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.http.server');
  const websocketManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.websocket.server');
  assert.ok(httpManifest);
  assert.ok(websocketManifest);
  assert.equal(validateModuleManifest(httpManifest).diagnostics.length, 0);
  assert.equal(validateModuleManifest(websocketManifest).diagnostics.length, 0);

  const modules: InstalledModule[] = [
    {
      manifest: httpManifest,
      installPath: 'builtin://lingbuilder.http.server',
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    },
    {
      manifest: websocketManifest,
      installPath: 'builtin://lingbuilder.websocket.server',
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }
  ];

  const completions = getLingCppCompletions(
    { source: '', line: 1, column: 1 },
    { enabledModules: modules, availableModules: modules }
  );

  assert.ok(!completions.some(item => item.label === 'HTTP_启动服务'));
  assert.ok(completions.some(item => item.label === 'HTTP_创建服务'));
  assert.ok(completions.some(item => item.label === 'HTTP 受管 JSON 服务'));
  assert.ok(completions.some(item => item.label === 'WSS_创建服务'));
  assert.ok(completions.some(item => item.label === 'WebSocket 受管消息服务'));
  assert.ok(!completions.some(item => item.label === 'WSS_启动服务'));

  const httpCommands = httpManifest.contributes?.commands || [];
  const httpBindings = httpManifest.bindings?.commands || [];
  assert.equal(httpManifest.version, '2.1.0');
  assert.equal(HTTP_SERVER_COMMAND_SPECS.length, 51);
  assert.equal(httpCommands.length, 51);
  assert.equal(httpBindings.length, 51);
  assert.deepEqual(new Set(httpCommands.map(item => item.name)), new Set(httpBindings.map(item => item.command)));
  assert.deepEqual(httpManifest.contributes?.types?.map(item => item.name), ['HTTP服务端', 'HTTP请求']);
  assert.deepEqual(httpManifest.contributes?.docs, [{ title: 'HTTP 服务端模块使用说明', path: 'docs/modules/http-server/README.md' }]);
  assert.ok((await fs.readFile(path.join(process.cwd(), 'docs', 'modules', 'http-server', 'README.md'), 'utf8')).trim().length > 0);
  // 静态路由与连接轮转：binding 参数形状与生成落点
  const staticRouteBinding = httpBindings.find(item => item.command === 'HTTP_添加静态路由');
  assert.deepEqual(staticRouteBinding?.parameters?.map(item => item.name), ['服务端', '方法', '路径模式', '响应内容', '内容类型']);
  assert.equal(staticRouteBinding?.returnType, 'bool');
  assert.equal(staticRouteBinding?.encoding, 'wide');
  const staticFileBinding = httpBindings.find(item => item.command === 'HTTP_添加静态文件路由');
  assert.deepEqual(staticFileBinding?.parameters?.map(item => item.name), ['服务端', '方法', '路径模式', '文件路径', '下载名称', '内容类型']);
  const rotationBinding = httpBindings.find(item => item.command === 'HTTP_设置连接轮转');
  assert.deepEqual(rotationBinding?.parameters?.map(item => item.type), ['HTTP服务端', 'int']);
  assert.equal(rotationBinding?.encoding, 'raw');
  for (const command of ['HTTP_添加静态路由', 'HTTP_添加静态文件路由', 'HTTP_设置连接轮转']) {
    const spec = HTTP_SERVER_COMMAND_SPECS.find(item => item.name === command);
    assert.ok(spec, `缺少命令规格：${command}`);
    assert.ok(spec!.parameters.every(item => item.description.trim().length > 0), `${command} 参数说明不齐备`);
  }
  ['HTTP_绑定请求处理器', 'HTTP_添加路由'].forEach(command => {
    const handler = httpBindings.find(item => item.command === command)?.parameters?.find(item => item.type === 'handler');
    assert.deepEqual(handler?.handlerSignature, { parameterTypes: [], returnType: '空' });
  });
  ['HTTP_启动服务', 'HTTP_等待请求', 'HTTP_等待请求到调试输出', 'HTTP_回复文本', 'HTTP_关闭服务']
    .forEach(command => assert.equal(httpCommands.find(item => item.name === command)?.visibility, 'advanced'));

  const websocketCommands = websocketManifest.contributes?.commands || [];
  const websocketBindings = websocketManifest.bindings?.commands || [];
  assert.equal(websocketManifest.version, '2.0.0');
  assert.equal(websocketManifest.minLingBuilderVersion, '0.2.8');
  assert.equal(WEBSOCKET_SERVER_COMMAND_SPECS.length, 50);
  assert.equal(websocketCommands.length, 50);
  assert.equal(websocketBindings.length, 50);
  assert.deepEqual(new Set(websocketCommands.map(item => item.name)), new Set(websocketBindings.map(item => item.command)));
  assert.deepEqual(websocketManifest.contributes?.types?.map(item => item.name), ['WebSocket服务端', 'WebSocket客户端']);
  assert.deepEqual(websocketManifest.targets?.map(item => item.id), ['windows-msvc-win32', 'windows-msvc-x64']);
  assert.deepEqual(websocketManifest.contributes?.docs, [{ title: 'WebSocket 服务端模块 2.0 使用说明', path: 'docs/modules/websocket-server/README.md' }]);
  assert.ok((await fs.readFile(path.join(process.cwd(), 'docs', 'modules', 'websocket-server', 'README.md'), 'utf8')).trim().length > 0);
  const handlerCommands = ['WSS_绑定连接处理器', 'WSS_绑定消息处理器', 'WSS_绑定断开处理器', 'WSS_绑定错误处理器'];
  handlerCommands.forEach(command => assert.equal(websocketBindings.find(item => item.command === command)?.parameters?.[1]?.type, 'handler'));
  const legacyCommands = ['WSS_启动服务', 'WSS_等待连接', 'WSS_接收文本', 'WSS_接收到调试输出', 'WSS_发送文本', 'WSS_关闭服务'];
  legacyCommands.forEach(command => assert.equal(websocketCommands.find(item => item.name === command)?.visibility, 'advanced'));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    HTTP服务端 HTTP服务',
      '    事件 _MainWindow_创建完毕()',
      '        HTTP服务 = HTTP_创建服务()',
      '        HTTP_配置服务(HTTP服务, "127.0.0.1", 8080, 4, 256)',
      '        HTTP_设置请求限制(HTTP服务, 64, 16, 30000)',
      '        HTTP_添加路由(HTTP服务, "GET", "/api/health", &处理健康检查)',
      '        HTTP_添加静态路由(HTTP服务, "GET", "/api/data", "{\\"ok\\":1}", "application/json; charset=utf-8")',
      '        HTTP_添加静态文件路由(HTTP服务, "GET", "/page", "site/index.html", "page.html", "text/html; charset=utf-8")',
      '        HTTP_设置连接轮转(HTTP服务, 500)',
      '        HTTP_绑定请求处理器(HTTP服务, &处理未匹配请求)',
      '        HTTP_启动(HTTP服务)',
      '        局部 WebSocket服务端 服务 = WSS_创建服务()',
      '        WSS_配置服务(服务, "127.0.0.1", 18080, 128)',
      '        WSS_设置资源限制(服务, 64, 16, 8, 30000)',
      '        WSS_设置心跳(服务, 30000, 10000)',
      '        WSS_绑定消息处理器(服务, &收到消息)',
      '        WSS_启动(服务)',
      '    结束',
      '    事件 收到消息()',
      '        如果 (WSS_取当前消息类型() == "文本")',
      '            WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本())',
      '        如果结束',
      '    结束',
      '    事件 处理健康检查()',
      '        局部 HTTP请求 请求 = HTTP_取当前请求()',
      '        HTTP_设置响应头(请求, "Cache-Control", "no-store")',
      '        HTTP_发送JSON(请求, "{\\"ok\\":true}", 200)',
      '    结束',
      '    事件 处理未匹配请求()',
      '        HTTP_发送文本(HTTP_取当前请求(), "没有该接口", "text/plain; charset=utf-8", 404)',
      '结束类'
    ].join('\n'),
    enabledModules: modules
  });
  assert.deepEqual(generated.blockingDiagnostics, []);

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.ok(mainCpp.includes('#include <winsock2.h>'));
  assert.ok(mainCpp.includes('#include <wincrypt.h>'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "ws2_32.lib")'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "advapi32.lib")'));
  assert.ok(mainCpp.includes('class LingHttpServerRuntime'));
  assert.ok(mainCpp.includes('!allowExternal && !IsLoopbackAddress(item->ai_addr)'));
  assert.ok(mainCpp.includes('!TryUrlDecode(encodedPath, false, request.path)'));
  assert.ok(!mainCpp.includes('host.rfind(L"127.", 0) == 0'));
  assert.ok(mainCpp.includes('long long HTTP_创建服务()'));
  assert.ok(mainCpp.includes('case WM_LINGBUILDER_HTTP_SERVER_REQUEST:'));
  assert.ok(mainCpp.includes('class LingWebSocketServerRuntime'));
  assert.ok(mainCpp.includes('WSAPoll('));
  assert.ok(mainCpp.includes('bool ProcessFrames('));
  assert.ok(mainCpp.includes('case WM_LINGBUILDER_WSS_EVENT:'));
  assert.ok(mainCpp.includes('bool WSS_配置服务(long long server'));
  assert.ok(mainCpp.includes('HTTP_配置服务(HTTP服务, L"127.0.0.1", 8080, 4, 256);'));
  assert.ok(mainCpp.includes('HTTP_添加路由(HTTP服务, L"GET", L"/api/health", L"处理健康检查");'));
  assert.ok(mainCpp.includes('HTTP_添加静态路由(HTTP服务, L"GET", L"/api/data", L"{\\"ok\\":1}", L"application/json; charset=utf-8");'));
  assert.ok(mainCpp.includes('HTTP_添加静态文件路由(HTTP服务, L"GET", L"/page", L"site/index.html", L"page.html", L"text/html; charset=utf-8");'));
  assert.ok(mainCpp.includes('HTTP_设置连接轮转(HTTP服务, 500);'));
  assert.ok(mainCpp.includes('HTTP_发送JSON(请求, L"{\\"ok\\":true}", 200);'));
  assert.ok(mainCpp.includes('WSS_配置服务(服务, L"127.0.0.1", 18080, 128);'));
  assert.ok(mainCpp.includes('WSS_绑定消息处理器(服务, L"收到消息");'));
  assert.ok(mainCpp.includes('std::wstring(LingCppWideArg(WSS_取当前消息类型()))==LingCppWideArg(L"文本")'));
  assert.ok(mainCpp.includes('WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本());'));
  assert.ok(moduleReport.includes('HTTP 服务端模块'));
  assert.ok(moduleReport.includes('WebSocket 服务端模块'));
  assert.ok(moduleReport.includes('ws2_32.lib'));
  assert.ok(moduleReport.includes('advapi32.lib'));

  const httpHandlerDiagnostics = getLingCppSemanticDiagnostics([
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        HTTP_绑定请求处理器(HTTP_创建服务(), "错误写法")',
    '        HTTP_添加路由(HTTP_创建服务(), "GET", "/", &带参数处理器)',
    '    结束',
    '    事件 带参数处理器(整数型 状态)',
    '    结束',
    '结束类'
  ].join('\n'), undefined, 'MainWindow.lcpp', { enabledModules: [modules[0]!], availableModules: [modules[0]!] });
  assert.ok(httpHandlerDiagnostics.some(item => item.level === 'error' && item.message.includes('必须使用 &处理器名')));
  assert.ok(httpHandlerDiagnostics.some(item => item.level === 'error' && item.message.includes('带参数处理器 签名不匹配')));

  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: 'WebSocket 双后端生成测试',
      targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const newEmojiProject: LingWindowProject = {
    ...sampleProject,
    id: 'websocket-new-emoji-test',
    windows: sampleProject.windows.map(window => ({ ...window, designerBackend: 'new-emoji' }))
  };
  const newEmojiGenerated = generateLingCppNativeWin32Project(newEmojiProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    HTTP服务端 HTTP服务',
      '    事件 _MainWindow_创建完毕()',
      '        HTTP服务 = HTTP_创建服务()',
      '        HTTP_绑定请求处理器(HTTP服务, &处理HTTP请求)',
      '        局部 WebSocket服务端 服务 = WSS_创建服务()',
      '        WSS_绑定消息处理器(服务, &收到消息)',
      '    结束',
      '    事件 收到消息()',
      '        WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本())',
      '    结束',
      '    事件 处理HTTP请求()',
      '        HTTP_发送JSON(HTTP_取当前请求(), "{\\"backend\\":\\"new_emoji\\"}", 200)',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules: [newEmojiModule, modules[0]!, modules[1]!]
  });
  assert.deepEqual(newEmojiGenerated.blockingDiagnostics, []);
  const newEmojiCpp = newEmojiGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(newEmojiCpp.includes('static LingWebSocketServerRuntime g_wssRuntime'));
  assert.ok(newEmojiCpp.includes('static LingHttpServerRuntime g_httpServerRuntime'));
  assert.ok(newEmojiCpp.includes('LB_NE_CreateHttpServerEventWindow'));
  assert.ok(newEmojiCpp.includes('LB_NE_DispatchHttpServerRequest'));
  assert.ok(newEmojiCpp.includes('static long long HTTP服务{};'));
  assert.ok(newEmojiCpp.includes('LB_NE_CreateWebSocketEventWindow'));
  assert.ok(newEmojiCpp.includes('LB_NE_DispatchWebSocketServerEvent'));
  assert.ok(newEmojiCpp.includes('static bool WSS_发送文本给客户端'));
  const webSocketDeclarationIndex = newEmojiCpp.indexOf('static long long WSS_创建服务();');
  assert.ok(newEmojiCpp.includes('static bool WSS_配置服务(long long server, const wchar_t* address, int port, int maximumClients);'));
  assert.ok(newEmojiCpp.includes('static void WSS_关闭服务();'));
  const createdHandlerDefinitionIndex = newEmojiCpp.indexOf('static void MainWindow_创建完毕() {');
  assert.ok(webSocketDeclarationIndex >= 0);
  assert.ok(createdHandlerDefinitionIndex >= 0);
  assert.ok(webSocketDeclarationIndex < createdHandlerDefinitionIndex);
});

test('materializeModuleNativeDependencies copies module source, libs and runtime files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-new-emoji-module-'));
  const installPath = path.join(root, 'installed');
  const buildDir = path.join(root, 'build');
  const sourceDir = path.join(buildDir, 'src');
  const binDir = path.join(buildDir, 'bin');
  const exportDir = path.join(root, 'export');

  await Promise.all([
    writeFixture(path.join(installPath, 'include', 'new_emoji_bridge.h'), '#pragma once\n'),
    writeFixture(path.join(installPath, 'src', 'new_emoji_bridge.cpp'), '#include "new_emoji_bridge.h"\n'),
    writeFixture(path.join(installPath, 'lib', 'Win32', 'new_emoji.lib'), 'fake lib\n'),
    writeFixture(path.join(installPath, 'bin', 'Win32', 'new_emoji.dll'), 'fake dll\n')
    , writeFixture(path.join(installPath, 'lib', 'x64', 'new_emoji.lib'), 'fake x64 lib\n')
    , writeFixture(path.join(installPath, 'bin', 'x64', 'new_emoji.dll'), 'fake x64 dll\n')
  ]);

  const plan = await materializeModuleNativeDependencies([createNewEmojiTestModule(installPath)], {
    buildDir,
    sourceDir,
    binDir,
    exportDir
  });

  assert.equal(plan.diagnostics.length, 0);
  assert.equal(plan.requiresMsvc, true);
  assert.ok(plan.includeDirs.some(item => item.endsWith(path.join('modules', 'lingbuilder.new_emoji.ui', 'include'))));
  assert.ok(plan.sourceFiles.some(item => item.endsWith(path.join('src', 'new_emoji_bridge.cpp'))));
  assert.ok(plan.libFiles.some(item => item.endsWith(path.join('lib', 'Win32', 'new_emoji.lib'))));
  assert.ok(await exists(path.join(sourceDir, 'modules', 'lingbuilder.new_emoji.ui', 'include', 'new_emoji_bridge.h')));
  assert.ok(await exists(path.join(buildDir, 'modules', 'lingbuilder.new_emoji.ui', 'lib', 'Win32', 'new_emoji.lib')));
  assert.ok(await exists(path.join(exportDir, 'modules', 'lingbuilder.new_emoji.ui', 'bin', 'Win32', 'new_emoji.dll')));
  assert.ok(await exists(path.join(binDir, 'new_emoji.dll')));
});

test('EdgeView native dependencies reject an arbitrary latest NuGet cache version', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-edgeview-sdk-'));
  const previousNugetPackages = process.env.NUGET_PACKAGES;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    const packageRoot = path.join(tempRoot, 'packages', 'microsoft.web.webview2', '1.0.9999.1', 'build', 'native');
    await fs.mkdir(path.join(packageRoot, 'include'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'x86'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'x64'), { recursive: true });
    await fs.writeFile(path.join(packageRoot, 'include', 'WebView2.h'), '// header', 'utf8');
    await fs.writeFile(path.join(packageRoot, 'include', 'WebView2EnvironmentOptions.h'), '// options', 'utf8');
    await fs.writeFile(path.join(packageRoot, 'x86', 'WebView2Loader.dll'), Buffer.from([1, 2, 3]));
    await fs.writeFile(path.join(packageRoot, 'x64', 'WebView2Loader.dll'), Buffer.from([4, 5, 6, 7]));
    process.env.NUGET_PACKAGES = path.join(tempRoot, 'packages');
    process.env.USERPROFILE = tempRoot;
    const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
    assert.ok(manifest);
    const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.edgeview', isBuiltin: true, isInstalled: true, diagnostics: [] };
    const plan = await materializeModuleNativeDependencies([module], {
      buildDir: path.join(tempRoot, 'build'),
      sourceDir: path.join(tempRoot, 'source'),
      binDir: path.join(tempRoot, 'bin'),
      exportDir: path.join(tempRoot, 'export'),
      preferredTargetId: 'windows-msvc-win32'
    });
    assert.ok(plan.diagnostics.some(item => item.includes('固定版本 Microsoft.Web.WebView2 1.0.4078.44')));
    assert.equal(plan.includeDirs.some(item => item.endsWith(path.join('lingbuilder.edgeview', 'include'))), false);
    assert.equal(await exists(path.join(tempRoot, 'bin', 'WebView2Loader.dll')), false);
  } finally {
    if (previousNugetPackages === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previousNugetPackages;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('EdgeView native dependencies materialize the static WebView2 loader library', async () => {
  const nugetRoot = process.env.NUGET_PACKAGES || path.join(os.homedir(), '.nuget', 'packages');
  const realHeader = path.join(nugetRoot, 'microsoft.web.webview2', EDGEVIEW_WEBVIEW2_SDK_VERSION, 'build', 'native', 'include', 'WebView2.h');
  if (!(await exists(realHeader))) {
    return;
  }
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-edgeview-static-'));
  const previousNugetPackages = process.env.NUGET_PACKAGES;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    // 用真实 WebView2.h（通过固定版本哈希门禁）+ 假静态库构造固定版本包。
    const packageRoot = path.join(tempRoot, 'packages', 'microsoft.web.webview2', EDGEVIEW_WEBVIEW2_SDK_VERSION, 'build', 'native');
    await fs.mkdir(path.join(packageRoot, 'include'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'x86'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'x64'), { recursive: true });
    await fs.copyFile(realHeader, path.join(packageRoot, 'include', 'WebView2.h'));
    await fs.writeFile(path.join(packageRoot, 'include', 'WebView2EnvironmentOptions.h'), '// options', 'utf8');
    await fs.writeFile(path.join(packageRoot, 'x86', 'WebView2LoaderStatic.lib'), Buffer.from([1, 2, 3]));
    await fs.writeFile(path.join(packageRoot, 'x64', 'WebView2LoaderStatic.lib'), Buffer.from([4, 5, 6, 7]));
    process.env.NUGET_PACKAGES = path.join(tempRoot, 'packages');
    process.env.USERPROFILE = tempRoot;
    const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
    assert.ok(manifest);
    const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.edgeview', isBuiltin: true, isInstalled: true, diagnostics: [] };
    const buildDir = path.join(tempRoot, 'build');
    const plan = await materializeModuleNativeDependencies([module], {
      buildDir,
      sourceDir: path.join(tempRoot, 'source'),
      binDir: path.join(tempRoot, 'bin'),
      exportDir: path.join(tempRoot, 'export'),
      preferredTargetId: 'windows-msvc-x64'
    });
    assert.ok(plan.libFiles.some(item => item.endsWith(path.join('lingbuilder.edgeview', 'lib', 'x64', 'WebView2LoaderStatic.lib'))));
    assert.ok(await exists(path.join(buildDir, 'modules', 'lingbuilder.edgeview', 'lib', 'x64', 'WebView2LoaderStatic.lib')));
    assert.ok(await exists(path.join(tempRoot, 'export', 'modules', 'lingbuilder.edgeview', 'lib', 'x86', 'WebView2LoaderStatic.lib')));
    // 单文件分发：不再向 exe 目录部署 WebView2Loader.dll。
    assert.equal(plan.runtimeFiles.some(item => item.includes('WebView2Loader.dll')), false);
    assert.equal(await exists(path.join(tempRoot, 'bin', 'WebView2Loader.dll')), false);
  } finally {
    if (previousNugetPackages === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previousNugetPackages;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('Win32 native builds never fall back to an incompatible module target', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-incompatible-target-'));
  const module: InstalledModule = {
    isInstalled: true,
    installPath: path.join(root, 'installed'),
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.linux-only',
      name: 'Linux 专用模块',
      version: '1.0.0',
      category: '系统',
      description: '不兼容 Win32 的测试模块。',
      targets: [{
        id: 'linux-gcc-x64',
        platform: 'linux',
        arch: 'x64',
        toolchain: 'gcc',
        libs: ['lib/liblinux.a']
      }]
    }
  };
  assert.equal(getPreferredModuleTarget(module), undefined);

  const plan = await materializeModuleNativeDependencies([module], {
    buildDir: path.join(root, 'build'),
    sourceDir: path.join(root, 'source'),
    binDir: path.join(root, 'bin'),
    exportDir: path.join(root, 'export')
  });
  assert.equal(plan.libFiles.length, 0);
  assert.ok(plan.diagnostics.some(message => message.includes('未提供兼容目标 windows-msvc-win32')));

  const generated = generateLingCppNativeWin32Project(sampleProject, { enabledModules: [module] });
  assert.ok(generated.diagnostics.some(message => message.includes('未提供兼容目标 windows-msvc-win32')));
  assert.doesNotMatch(generated.files.find(file => file.relativePath === 'main.cpp')?.content || '', /liblinux\.a/);
});

test('web HTTP async command translates handler references and emits a UI-thread completion bridge', () => {
  const manifest = {
    schemaVersion: 2 as const,
    id: 'lingbuilder.web.http',
    name: '网页访问模块',
    version: '1.1.0',
    category: '网络' as const,
    description: '在后台线程中访问网页并回到 UI 线程。',
    contributes: {
      commands: [
        { name: '网页_异步访问', signature: '网页_异步访问(网址, 访问方式, 完成处理器)', description: '启动异步网页访问。', returnType: '整数型' },
        { name: '网页_异步取当前请求编号', signature: '网页_异步取当前请求编号()', description: '读取当前完成请求编号。', returnType: '整数型' },
        { name: '网页_异步取返回文本', signature: '网页_异步取返回文本(请求编号)', description: '读取请求文本。', returnType: '文本型' }
      ]
    },
    targets: [{
      id: 'windows-msvc-win32', platform: 'windows' as const, arch: 'win32' as const, toolchain: 'msvc' as const,
      headers: ['include/web_http_bridge.h'], sources: ['src/web_http_bridge.cpp'], defines: ['LINGBUILDER_WEB_HTTP_MODULE']
    }],
    bindings: {
      commands: [
        {
          command: '网页_异步访问', runtimeName: '网页_异步访问', returnType: 'int' as const,
          parameters: [
            { name: '网址', type: 'wideString' as const },
            { name: '访问方式', type: 'int' as const },
            { name: '完成处理器', type: 'handler' as const }
          ]
        },
        { command: '网页_异步取当前请求编号', runtimeName: '网页_异步取当前请求编号', parameters: [], returnType: 'int' as const },
        { command: '网页_异步取返回文本', runtimeName: '网页_异步取返回文本', parameters: [{ name: '请求编号', type: 'int' as const }], returnType: 'wideString' as const }
      ]
    }
  };
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);

  const module: InstalledModule = {
    manifest,
    installPath: 'C:/modules/lingbuilder.web.http',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = [
    '类 MainWindow',
    '    整数型 请求编号',
    '    事件 _按钮1_被单击()',
    '        请求编号 = 网页_异步访问("https://ipinfo.io/json", 0, &获取IP完成)',
    '    结束',
    '    事件 获取IP完成()',
    '        请求编号 = 网页_异步取当前请求编号()',
    '        调试输出(网页_异步取返回文本(请求编号))',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.ok(cpp.includes('网页_异步访问(L"https://ipinfo.io/json", 0, L"获取IP完成")'));
  assert.ok(cpp.includes('WM_LINGBUILDER_WEB_ASYNC_COMPLETE'));
  assert.ok(cpp.includes('DispatchAsyncWebEvent'));
  assert.ok(cpp.includes('if (callback == L"获取IP完成") { 获取IP完成(); return; }'));
  assert.doesNotMatch(cpp, /&获取IP完成/);
});

test('CEF3 module exposes the complete event catalog and generates thread-safe handler bridges', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const designer = manifest.contributes?.designerControls?.find(control => control.type === 'CefBrowser');
  assert.equal(designer?.events?.length, CEF3_BROWSER_EVENTS.length);
  assert.ok(CEF3_BROWSER_EVENTS.length >= 90);
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_取事件字段'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_读资源响应正文'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_设置事件结果'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_打开原生UI浏览器'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否静音'
    && command.aliases?.includes('is_audio_muted')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否有文档'
    && command.aliases?.includes('has_document')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否有效'
    && command.aliases?.includes('is_valid')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否弹出窗口'
    && command.aliases?.includes('is_popup')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否同一实例'
    && command.aliases?.includes('is_same')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否禁用窗口渲染'
    && command.aliases?.includes('is_window_rendering_disabled')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否网页全屏'
    && command.aliases?.includes('is_fullscreen')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否已准备关闭'
    && command.aliases?.includes('is_ready_to_be_closed')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_是否渲染进程无响应'
    && command.aliases?.includes('is_render_process_unresponsive')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_取运行时样式'
    && command.aliases?.includes('get_runtime_style')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_取缩放级别'
    && command.aliases?.includes('get_zoom_level')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_取默认缩放级别'
    && command.aliases?.includes('get_default_zoom_level')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_设置缩放级别'
    && command.aliases?.includes('set_zoom_level')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_执行缩放'
    && command.aliases?.includes('zoom')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_尝试关闭'
    && command.aliases?.includes('try_close_browser')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_通知窗口移动或调整大小'
    && command.aliases?.includes('notify_move_or_resize_started')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_通知屏幕信息已改变'
    && command.aliases?.includes('notify_screen_info_changed')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_发送捕获丢失事件'
    && command.aliases?.includes('send_capture_lost_event')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_取消输入法组合文本'
    && command.aliases?.includes('ime_cancel_composition')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_完成输入法组合文本'
    && command.aliases?.includes('ime_finish_composing_text')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_添加单词到词典'
    && command.aliases?.includes('add_word_to_dictionary')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_替换拼写错误'
    && command.aliases?.includes('replace_misspelling')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_通知系统拖放结束'
    && command.aliases?.includes('drag_source_system_drag_ended')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_通知拖放目标离开'
    && command.aliases?.includes('drag_target_drag_leave')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_通知隐藏状态'
    && command.aliases?.includes('was_hidden')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_强制刷新'
    && command.aliases?.includes('reload_ignore_cache')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_发送按键事件'
    && command.aliases?.includes('send_key_event')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_发送鼠标移动事件'
    && command.aliases?.includes('send_mouse_move_event')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_发送鼠标滚轮事件'
    && command.aliases?.includes('send_mouse_wheel_event')));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_发送触摸事件'
    && command.aliases?.includes('send_touch_event')));
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否静音')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否有文档')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否有效')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否弹出窗口')?.parameters?.[0]?.type, 'controlRef');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否同一实例')?.parameters?.map(parameter => parameter.type), ['controlRef', 'controlRef']);
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否禁用窗口渲染')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否网页全屏')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否已准备关闭')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_是否渲染进程无响应')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_取运行时样式')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_取缩放级别')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_取默认缩放级别')?.parameters?.[0]?.type, 'controlRef');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_设置缩放级别')?.parameters?.map(parameter => parameter.type), ['controlRef', 'double']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_执行缩放')?.parameters?.map(parameter => parameter.type), ['controlRef', 'int']);
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_尝试关闭')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_通知窗口移动或调整大小')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_通知屏幕信息已改变')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_发送捕获丢失事件')?.parameters?.[0]?.type, 'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_取消输入法组合文本')?.parameters?.[0]?.type, 'controlRef');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_完成输入法组合文本')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'bool']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_添加单词到词典')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'wideString']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_替换拼写错误')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'wideString']);
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_通知系统拖放结束')?.parameters?.[0]?.type,
    'controlRef');
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_通知拖放目标离开')?.parameters?.[0]?.type,
    'controlRef');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_通知隐藏状态')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'bool']);
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_强制刷新')?.parameters?.[0]?.type, 'controlRef');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_发送按键事件')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'int', 'longLong', 'int', 'int', 'bool', 'int', 'int', 'bool']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_发送鼠标移动事件')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'int', 'int', 'longLong', 'bool']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_发送鼠标滚轮事件')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'int', 'int', 'longLong', 'int', 'int']);
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_发送触摸事件')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'int', 'double', 'double', 'double', 'double', 'double', 'double', 'int', 'longLong', 'int']);
  assert.equal(manifest.compatibility?.conflicts?.length || 0, 0);
  assert.equal(manifest.version, '3.0.0-alpha.5');
  assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-x64']);
  assert.ok(manifest.targets?.[0]?.libs?.some(item => item.endsWith('LingBuilderCefBridge.lib')));
  assert.ok(!manifest.targets?.[0]?.libs?.some(item => item.endsWith('libcef.lib')));
  assert.ok(!manifest.targets?.[0]?.libs?.some(item => item.endsWith('libcef_dll_wrapper.lib')));
  assert.deepEqual(manifest.targets?.[0]?.headers, ['include/LingBuilderCefBridge.h']);
  assert.ok(manifest.targets?.[0]?.runtimeFiles?.some(item => item.endsWith('LingBuilderCefBridge.dll')));
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_绑定事件')?.parameters?.[2]?.type, 'handler');
  assert.deepEqual(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_读资源响应正文')?.parameters?.map(parameter => parameter.type),
    ['controlRef', 'longLong', 'handler']);
  for (const id of ['lingbuilder.cef3.events', 'lingbuilder.cef3.objects', 'lingbuilder.cef3.session',
    'lingbuilder.cef3.network', 'lingbuilder.cef3.transfer', 'lingbuilder.cef3.automation',
    'lingbuilder.cef3.devtools', 'lingbuilder.cef3.views', 'lingbuilder.cef3.platform']) {
    const submodule = BUILTIN_MODULES.find(item => item.id === id);
    assert.ok(submodule, `缺少CEF3子模块：${id}`);
    assert.equal(validateModuleManifest(submodule).diagnostics.length, 0);
    assert.ok((submodule.contributes?.commands?.length || 0) > 0, `${id} 不得注册为空模块`);
  }
  const objects = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.objects');
  for (const command of ['CEF3缓冲_从十六进制', 'CEF3缓冲_从文件', 'CEF3缓冲_取大小',
    'CEF3缓冲_到十六进制', 'CEF3缓冲_保存文件', 'CEF3缓冲_释放',
    'CEF3缓冲_复制', 'CEF3缓冲_是否有效', 'CEF3缓冲_是否被拥有',
    'CEF3缓冲_是否同一对象', 'CEF3缓冲_是否相等',
    'CEF3值_创建', 'CEF3值_复制', 'CEF3值_是否有效', 'CEF3值_是否被拥有', 'CEF3值_是否只读',
    'CEF3值_是否同一对象', 'CEF3值_是否相等', 'CEF3值_设文本', 'CEF3值_设字典', 'CEF3值_设列表',
    'CEF3值_取文本', 'CEF3值_取字典', 'CEF3值_取列表', 'CEF3值_到JSON', 'CEF3值_释放',
    'CEF3字典_创建', 'CEF3字典_复制', 'CEF3字典_是否有效', 'CEF3字典_是否被拥有',
    'CEF3字典_是否只读', 'CEF3字典_是否同一对象', 'CEF3字典_是否相等',
    'CEF3字典_设值', 'CEF3字典_取值', 'CEF3字典_到JSON', 'CEF3字典_释放',
    'CEF3列表_创建', 'CEF3列表_复制', 'CEF3列表_是否有效', 'CEF3列表_是否被拥有',
    'CEF3列表_是否只读', 'CEF3列表_是否同一对象', 'CEF3列表_是否相等',
    'CEF3列表_设值', 'CEF3列表_取值', 'CEF3列表_到JSON', 'CEF3列表_释放',
    'CEF3菜单_创建', 'CEF3菜单_是否子菜单', 'CEF3菜单_清空', 'CEF3菜单_取数量',
    'CEF3菜单_添加分隔线', 'CEF3菜单_添加项目', 'CEF3菜单_添加勾选项目',
    'CEF3菜单_添加单选项目', 'CEF3菜单_添加子菜单', 'CEF3菜单_删除项目',
    'CEF3菜单_取索引', 'CEF3菜单_按索引取命令ID', 'CEF3菜单_按索引设命令ID',
    'CEF3菜单_取标题', 'CEF3菜单_设标题', 'CEF3菜单_取类型', 'CEF3菜单_取组ID',
    'CEF3菜单_设组ID', 'CEF3菜单_取子菜单', 'CEF3菜单_是否可见', 'CEF3菜单_设置可见',
    'CEF3菜单_是否启用', 'CEF3菜单_设置启用', 'CEF3菜单_是否勾选', 'CEF3菜单_设置勾选',
    'CEF3菜单_释放',
    'CEF3图像_创建', 'CEF3图像_添加位图', 'CEF3图像_添加PNG', 'CEF3图像_添加JPEG',
    'CEF3图像_取表示信息', 'CEF3图像_取位图缓冲', 'CEF3图像_取PNG缓冲',
    'CEF3图像_取JPEG缓冲', 'CEF3图像_释放',
    'CEF3导航项_取当前可见', 'CEF3导航项_是否有效', 'CEF3导航项_取地址',
    'CEF3导航项_读取历史',
    'CEF3导航项_取显示地址', 'CEF3导航项_取原始地址', 'CEF3导航项_取标题',
    'CEF3导航项_取跳转类型', 'CEF3导航项_是否含提交数据', 'CEF3导航项_取完成时间',
    'CEF3导航项_取HTTP状态码', 'CEF3导航项_释放',
    'CEF3证书_取当前', 'CEF3证书_取主体', 'CEF3证书_取颁发者', 'CEF3证书_取序列号缓冲',
    'CEF3证书_是否安全连接', 'CEF3证书_取证书状态', 'CEF3证书_取SSL版本', 'CEF3证书_取内容状态',
    'CEF3证书_取DER缓冲', 'CEF3证书_取PEM缓冲', 'CEF3证书_取生效时间', 'CEF3证书_取失效时间',
    'CEF3证书_取颁发链数量', 'CEF3证书_取DER颁发链项', 'CEF3证书_取PEM颁发链项', 'CEF3证书_释放',
    'CEF3证书主体_取显示名', 'CEF3证书主体_取通用名', 'CEF3证书主体_取地区名',
    'CEF3证书主体_取省州名', 'CEF3证书主体_取国家名', 'CEF3证书主体_取组织JSON',
    'CEF3证书主体_取组织单位JSON', 'CEF3证书主体_释放']) {
    assert.ok(objects?.contributes?.commands?.some(item => item.name === command), `CEF3 objects 缺少 ${command}`);
    assert.ok(objects?.bindings?.commands?.some(item => item.command === command), `CEF3 objects 缺少 ${command} binding`);
  }
  const session = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.session');
  assert.ok(session?.dependencies?.some(item => item.moduleId === 'lingbuilder.cef3.objects'));
  for (const command of ['CEF3会话_取上下文', 'CEF3会话_上下文取缓存目录', 'CEF3会话_清理HTTP缓存',
    'CEF3会话_是否有首选项', 'CEF3会话_首选项是否可写', 'CEF3会话_取首选项',
    'CEF3会话_取全部首选项', 'CEF3会话_设置首选项', 'CEF3会话_清理证书例外',
    'CEF3会话_清理HTTP认证', 'CEF3会话_关闭全部连接',
    'CEF3会话_Cookie读取全部', 'CEF3会话_Cookie按地址读取', 'CEF3会话_Cookie设置',
    'CEF3会话_Cookie删除', 'CEF3会话_Cookie落盘', 'CEF3会话_释放上下文']) {
    assert.ok(session?.contributes?.commands?.some(item => item.name === command), `CEF3 session 缺少 ${command}`);
    assert.ok(session?.bindings?.commands?.some(item => item.command === command), `CEF3 session 缺少 ${command} binding`);
  }
  const automation = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.automation');
  for (const command of ['CEF3Hook_注册脚本', 'CEF3Hook_移除脚本', 'CEF3Hook_清空脚本',
    'CEF3Hook_取脚本列表', 'CEF3Hook_回复页面消息']) {
    assert.ok(automation?.contributes?.commands?.some(item => item.name === command), `CEF3 automation 缺少 ${command}`);
    assert.ok(automation?.bindings?.commands?.some(item => item.command === command), `CEF3 automation 缺少 ${command} binding`);
  }
  const platform = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.platform');
  assert.ok(platform?.contributes?.commands?.some(item => item.name === 'CEF3平台_设置可嵌套任务'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3平台_设置可嵌套任务'));
  assert.ok(platform?.contributes?.commands?.some(item => item.name === 'CEF3平台_结束跟踪'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3平台_结束跟踪'));
  assert.ok(platform?.contributes?.commands?.some(item => item.name === 'CEF3命令行_创建'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_创建'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_是否有效'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_是否只读'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_复制'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_从参数数组初始化'
    && item.parameters?.[1]?.type === 'CEF3文本数组'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_从文本初始化'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取完整文本'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取程序'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_设置程序'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_是否有开关'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_是否有指定开关'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_添加开关'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_添加带值开关'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取开关值'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_移除开关'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_是否有参数'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_添加参数'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_重置'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取参数向量' && item.returnType === 'CEF3文本数组'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取参数列表' && item.returnType === 'CEF3文本数组'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取开关列表' && item.returnType === 'CEF3命令行开关数组'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_前置包装器'));
  assert.ok(platform?.bindings?.commands?.some(item => item.command === 'CEF3命令行_取全局'));
  assert.ok(platform?.contributes?.types?.some(item => item.name === 'CEF3文本数组' && item.kind === 'array'));
  assert.ok(platform?.contributes?.types?.some(item => item.name === 'CEF3命令行开关' && item.kind === 'record'));

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'https://example.com' },
        events: { OnConsoleMessage: '浏览器1_控制台消息' }
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    CEF3_绑定事件("浏览器1", "控制台消息", &浏览器1_控制台消息)\n  结束\n  事件 浏览器1_控制台消息()\n    调试输出(CEF3_取事件字段("浏览器1", "message"))\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /WM_LINGBUILDER_CEF_EVENT/);
  for (const event of CEF3_BROWSER_EVENTS) {
    assert.ok(cpp.includes(`L"${event.name}"`), `生成运行时缺少 CEF3 事件：${event.name}`);
  }
  assert.match(cpp, /CEF3_取事件字段/);
  assert.match(cpp, /CEF3_绑定事件\(L"浏览器1", L"控制台消息", L"浏览器1_控制台消息"\)/);
  assert.match(cpp, /#include <LingBuilderCefBridge\.h>/);
  assert.match(cpp, /LB_CEF3_GetAbiVersion/);
  assert.match(cpp, /LB_CEF3_ExecuteSubProcess/);
  assert.match(cpp, /LB_CEF3_Initialize/);
  assert.match(cpp, /LB_CEF3_BrowserCreate/);
  assert.match(cpp, /LB_CEF3_BrowserIsValid/);
  assert.match(cpp, /LB_CEF3_BrowserIsPopup/);
  assert.match(cpp, /LB_CEF3_BrowserIsSame/);
  assert.match(cpp, /LB_CEF3_BrowserIsWindowRenderingDisabled/);
  assert.match(cpp, /LB_CEF3_BrowserIsFullscreen/);
  assert.match(cpp, /LB_CEF3_BrowserIsReadyToBeClosed/);
  assert.match(cpp, /LB_CEF3_BrowserIsRenderProcessUnresponsive/);
  assert.match(cpp, /LB_CEF3_BrowserGetRuntimeStyle/);
  assert.match(cpp, /LB_CEF3_BrowserGetZoomLevel/);
  assert.match(cpp, /LB_CEF3_BrowserGetDefaultZoomLevel/);
  assert.match(cpp, /LB_CEF3_BrowserSetZoomLevel/);
  assert.match(cpp, /LB_CEF3_BrowserTryClose/);
  assert.match(cpp, /LB_CEF3_BrowserNotifyMoveOrResizeStarted/);
  assert.match(cpp, /LB_CEF3_BrowserNotifyScreenInfoChanged/);
  assert.match(cpp, /LB_CEF3_BrowserSendCaptureLostEvent/);
  assert.match(cpp, /LB_CEF3_BrowserImeCancelComposition/);
  assert.match(cpp, /LB_CEF3_BrowserReloadIgnoreCache/);
  assert.match(cpp, /LB_CEF3_BrowserSendKeyEvent/);
  assert.match(cpp, /LB_CEF3_BrowserHasDocument/);
  assert.match(cpp, /LB_CEF3_BrowserIsAudioMuted/);
  assert.match(cpp, /LB_CEF3_BrowserEvaluateJavaScript/);
  assert.match(cpp, /LB_CEF3_JsHookRegister/);
  assert.match(cpp, /LB_CEF3_JsHookRemove/);
  assert.match(cpp, /LB_CEF3_JsHookList/);
  assert.match(cpp, /LB_CEF3_JsHookReply/);
  assert.match(cpp, /LB_CEF3_GetMimeType/);
  assert.match(cpp, /LB_CEF3_SetNestableTasksAllowed/);
  assert.match(cpp, /LB_CEF3_CommandLineCreate/);
  assert.match(cpp, /LB_CEF3_CommandLineIsValid/);
  assert.match(cpp, /LB_CEF3_CommandLineIsReadOnly/);
  assert.match(cpp, /LB_CEF3_CommandLineCopy/);
  assert.match(cpp, /LB_CEF3_CommandLineInitFromArgv/);
  assert.match(cpp, /LB_CEF3_CommandLineInitFromString/);
  assert.match(cpp, /LB_CEF3_CommandLineGetString/);
  assert.match(cpp, /LB_CEF3_CommandLineGetProgram/);
  assert.match(cpp, /LB_CEF3_CommandLineSetProgram/);
  assert.match(cpp, /LB_CEF3_CommandLineHasSwitches/);
  assert.match(cpp, /LB_CEF3_CommandLineHasSwitch/);
  assert.match(cpp, /LB_CEF3_CommandLineAppendSwitch/);
  assert.match(cpp, /LB_CEF3_CommandLineAppendSwitchWithValue/);
  assert.match(cpp, /LB_CEF3_CommandLineGetSwitchValue/);
  assert.match(cpp, /LB_CEF3_CommandLineRemoveSwitch/);
  assert.match(cpp, /LB_CEF3_CommandLineHasArguments/);
  assert.match(cpp, /LB_CEF3_CommandLineAppendArgument/);
  assert.match(cpp, /LB_CEF3_CommandLineReset/);
  assert.match(cpp, /LB_CEF3_CommandLineGetArgv/);
  assert.match(cpp, /LB_CEF3_CommandLineGetArguments/);
  assert.match(cpp, /LB_CEF3_CommandLineGetSwitches/);
  assert.match(cpp, /LB_CEF3_CommandLinePrependWrapper/);
  assert.match(cpp, /LB_CEF3_CommandLineGetGlobal/);
  assert.match(cpp, /std::vector<CEF3命令行开关>/);
  assert.match(cpp, /LB_CEF3_CommandLineRelease/);
  assert.match(cpp, /LB_CEF3_BufferCreate/);
  assert.match(cpp, /LB_CEF3_BufferClone/);
  assert.match(cpp, /LB_CEF3_BufferSaveFile/);
  assert.match(cpp, /LB_CEF3_ValueCreate/);
  assert.match(cpp, /LB_CEF3_ValueCopy/);
  assert.match(cpp, /LB_CEF3_ValueSetDictionary/);
  assert.match(cpp, /LB_CEF3_ValueGetList/);
  assert.match(cpp, /LB_CEF3_DictionaryCopy/);
  assert.match(cpp, /LB_CEF3_DictionarySetValue/);
  assert.match(cpp, /LB_CEF3_ListCopy/);
  assert.match(cpp, /LB_CEF3_ListSetValue/);
  assert.match(cpp, /LB_CEF3_MenuCreate/);
  assert.match(cpp, /LB_CEF3_MenuAddSubMenu/);
  assert.match(cpp, /LB_CEF3_MenuInsertSubMenuAt/);
  assert.match(cpp, /LB_CEF3_MenuGetAcceleratorAtJson/);
  assert.match(cpp, /LB_CEF3_MenuSetColorAt/);
  assert.match(cpp, /LB_CEF3_MenuSetFontListAt/);
  assert.match(cpp, /LB_CEF3_MenuSetChecked/);
  assert.match(cpp, /LB_CEF3_MenuRelease/);
  assert.match(cpp, /LB_CEF3_ImageCreate/);
  assert.match(cpp, /LB_CEF3_ImageAddBitmap/);
  assert.match(cpp, /LB_CEF3_ImageGetAsPng/);
  assert.match(cpp, /LB_CEF3_ImageRelease/);
  assert.match(cpp, /LB_CEF3_BrowserGetVisibleNavigationEntry/);
  assert.match(cpp, /LB_CEF3_BrowserGetNavigationEntries/);
  assert.match(cpp, /LB_CEF3_NavigationEntryGetUrl/);
  assert.match(cpp, /LB_CEF3_NavigationEntryRelease/);
  assert.match(cpp, /LB_CEF3_BrowserGetCurrentCertificate/);
  assert.match(cpp, /LB_CEF3_CertificateGetSslVersion/);
  assert.match(cpp, /LB_CEF3_CertificateGetDerEncoded/);
  assert.match(cpp, /LB_CEF3_CertificatePrincipalGetCommonName/);
  assert.match(cpp, /LB_CEF3_CertificateRelease/);
  assert.match(cpp, /LB_CEF3_BrowserGetRequestContext/);
  assert.match(cpp, /LB_CEF3_RequestContextGetPreference/);
  assert.match(cpp, /LB_CEF3_RequestContextSetPreference/);
  assert.match(cpp, /LB_CEF3_RequestContextClearHttpCache/);
  assert.match(cpp, /LB_CEF3_RequestContextClearCertificateExceptions/);
  assert.match(cpp, /LB_CEF3_RequestContextCloseAllConnections/);
  assert.match(cpp, /LB_CEF3_CookieSet/);
  assert.match(cpp, /LB_CEF3_CookieVisitUrl/);
  assert.doesNotMatch(cpp, /CEF3等待独立RequestContext初始化超时/);
  assert.doesNotMatch(cpp, /#include <include\/cef_/);
  assert.doesNotMatch(cpp, /CefRefPtr|CefClient|CefBrowserHost|CefExecuteProcess|CefShutdown/);
  assert.match(cpp, /int CEF3_打开原生UI浏览器\(const wchar_t\* controlName, const wchar_t\* address\)/);
  assert.match(cpp, /int CEF3_打开原生UI浏览器\(const wchar_t\* controlName, const std::wstring& address\)/);
  assert.match(cpp, /std::vector<unsigned long long> bridgePopupHandles;/);
  assert.match(cpp, /LB_CEF3_BrowserCreateChrome/);
  assert.match(cpp, /LB_CEF3_BrowserClose/);
});

test('CEF3_取资源地址 同时登记清单与 binding，并在生成的 C++ 里有真实运行时实现', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);

  const contributed = manifest.contributes?.commands?.find(item => item.name === 'CEF3_取资源地址');
  assert.ok(contributed, 'CEF3_取资源地址 必须登记到 contributes.commands');
  assert.equal(contributed.returnType, '文本型');
  assert.notEqual(contributed.visibility, 'internal', '该命令面向示例与终端用户，必须公开');

  const binding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_取资源地址');
  assert.ok(binding, 'CEF3_取资源地址 必须有确定性 binding，否则后端命令契约会阻断生成');
  assert.deepEqual(binding.parameters.map(parameter => parameter.type), ['wideString']);
  assert.equal(binding.returnType, 'wideString');

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    局部 文本型 地址 = CEF3_取资源地址("pages/index.html")\n    CEF3_导航(浏览器1, 地址)\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 契约声称支持就必须有真实、可编译、可链接的运行时符号，不能只有补全和 binding。
  assert.match(cpp, /std::wstring CEF3_取资源地址\(const wchar_t\* relativePath\)/);
  assert.match(cpp, /static std::wstring Cef3PercentEncodeUrlPath\(const std::wstring& value\)/);
  assert.match(cpp, /static bool Cef3LooksLikeUrl\(const std::wstring& value\)/);
  assert.match(cpp, /static std::wstring Cef3BuildFileUrl\(std::wstring path\)/);
  // 相对路径必须拼到 exe 同级 assets 下，而不是原样交给导航；形参是 const wchar_t* 所以取 c_str()。
  assert.match(cpp, /ResolveRuntimeAssetPath\(\(L"assets\/" \+ value\)\.c_str\(\)\)/);
  // 结果先落文本型局部变量，再经 LingCppWideArg 桥接到 CEF3_导航 的 const wchar_t* 地址形参；
  // 控件名仍按裸 controlRef 生成宽字符。
  assert.match(cpp, /std::wstring 地址 = CEF3_取资源地址\(L"pages\/index\.html"\);/);
  assert.match(cpp, /CEF3_导航\(L"浏览器1", LingCppWideArg\(地址\)\);/);
});

test('CEF3框架_* 命令族登记清单与 binding，并在生成的 C++ 里有真实运行时实现', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.automation');
  assert.ok(manifest);

  const contributed = (manifest.contributes?.commands || []).filter(item => item.name.startsWith('CEF3框架_'));
  const bound = (manifest.bindings?.commands || []).filter(item => item.command.startsWith('CEF3框架_'));
  assert.ok(contributed.length >= 25, 'CEF3框架_* 必须成套公开，不得只补若干条');
  assert.deepEqual(
    contributed.map(item => item.name).sort(),
    bound.map(item => item.command).sort(),
    '每条 CEF3框架_* 都必须有确定性 binding，否则后端命令契约会阻断生成'
  );
  const controlNameCommands = ['CEF3框架_取主框架', 'CEF3框架_取焦点框架', 'CEF3框架_按标识取框架', 'CEF3框架_按名称取框架',
    'CEF3框架_取框架数量', 'CEF3框架_取标识列表JSON', 'CEF3框架_取名称列表JSON'];
  for (const name of controlNameCommands) {
    const binding = bound.find(item => item.command === name);
    assert.equal(binding?.parameters?.[0]?.type, 'controlRef', `${name} 的控件参数必须是 controlRef`);
  }

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.automation',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3自动化模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    局部 长整数型 主框架 = CEF3框架_取主框架(浏览器1)\n    局部 长整数型 子框架 = CEF3框架_按名称取框架(浏览器1, "login")\n    CEF3框架_执行JS(子框架, "document.title = \\"改过的标题\\";", "", 1)\n    CEF3框架_载入地址(主框架, "https://example.com")\n    CEF3框架_释放(子框架)\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 契约声称支持就必须有真实运行时符号：每个包装都必须落到 LB_CEF3_* 桥导出。
  assert.match(cpp, /long long CEF3框架_取主框架\(const wchar_t\* controlName\)/);
  assert.match(cpp, /long long CEF3框架_按名称取框架\(const wchar_t\* controlName, const std::wstring& name\)/);
  assert.match(cpp, /int CEF3框架_执行JS\(long long frameHandle, const std::wstring& code, const std::wstring& scriptUrl, int startLine\)/);
  assert.match(cpp, /LB_CEF3_BrowserGetFrameByName/);
  assert.match(cpp, /LB_CEF3_BrowserGetFrameIdentifiers/);
  assert.match(cpp, /LB_CEF3_FrameExecuteJavaScript/);
  assert.match(cpp, /LB_CEF3_FrameIsMain/);
  assert.match(cpp, /CEF3_框架文本列表转JSON/);
  // 主框架没有专用桥导出，必须由标识枚举 + 主框架判定推导，不能伪造句柄。
  // 判定必须显式比 1：LB_CEF3_FrameIsMain 在句柄解析失败时返回负数错误码，真值判断会把失败当命中。
  assert.match(cpp, /if \(LB_CEF3_FrameIsMain\(frame\) == 1\) return static_cast<long long>\(frame\);/);
  // 调用点：控件名走宽字符、框架句柄走整数。
  assert.match(cpp, /CEF3框架_按名称取框架\((L"浏览器1", L"login"\));/);
});

test('CEF3填表_写入命令族登记清单与 binding，并生成按帧执行的真实运行时', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.automation');
  assert.ok(manifest);

  const writeCommands = ['点击元素', '滚动到元素', '聚焦元素', '赋值',
    '置选择框', '置选择项', '置内文本', '置外文本',
    '置内代码', '置外代码', '置属性', '触发事件']
    .map(suffix => 'CEF3填表_' + suffix);

  const contributed = (manifest.contributes?.commands || []).filter(item => item.name.startsWith('CEF3填表_'));
  const bound = (manifest.bindings?.commands || []).filter(item => item.command.startsWith('CEF3填表_'));
  assert.deepEqual(contributed.map(item => item.name).sort(), writeCommands.slice().sort(),
    '当前框架桥只支持主帧带结果求值，填表族只能先入账写类命令，不得登记无法真实工作的读取命令');
  assert.deepEqual(contributed.map(item => item.name).sort(), bound.map(item => item.command).sort());
  assert.ok(contributed.every(item => item.visibility !== 'advanced'), '填表命令面向业务用户，必须进常规补全');

  const assign = bound.find(item => item.command === 'CEF3填表_赋值');
  assert.deepEqual(assign?.parameters?.map(parameter => parameter.type),
    ['longLong', 'wideString', 'int', 'wideString']);

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.automation',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3自动化模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    局部 长整数型 主框架 = CEF3框架_取主框架(浏览器1)\n    CEF3填表_赋值(主框架, "input[name=user]", 0, "张三")\n    CEF3填表_置选择框(主框架, "#agree", 0, 真)\n    CEF3填表_触发事件(主框架, "input#kw", 0, "keydown", 13)\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 忘记调用帧句柄就等于只改了主帧：写入必须落到 LB_CEF3_FrameExecuteJavaScript。
  assert.match(cpp, /CEF3填表_赋值\(long long frameHandle, const std::wstring& selector, int index, const std::wstring& value\)/);
  assert.ok(cpp.includes("CEF3_填表_执行(frameHandle, L\"setValue\", selector, index, value, L\"\");"), "填表写入必须经共享派发器落到目标框架");
  assert.ok(cpp.includes("CEF3_填表_执行(frameHandle, L\"dispatchEvent\", selector, index, eventName, std::to_wstring(keyCode));"), "合成事件必须转发事件名与按键代码");
  assert.match(cpp, /LB_CEF3_FrameExecuteJavaScript\(frame, call\.c_str\(\), L"", 1\)/);
  // 助手脚本必须是可调用函数且转义安全（不得把真实换行塞进 C 字面量）。
  assert.match(cpp, /static const wchar_t\* CEF3_填表助手脚本\(\)/);
  assert.match(cpp, /function lbTianBiao\(op, selector, index, a, b\)/);
  assert.ok(!/CEF3_填表助手脚本\(\) \{[\s\S]{0,400}?\n\s+var list;/.test(cpp),
    '助手脚本里的换行必须转义为 \\n，不能出现跨行 C 字符串');
  assert.match(cpp, /CEF3填表_赋值\(主框架, L"input\[name=user\]", 0, L"张三"\);/);
});

test('CEF3 跨域白名单三条命令登记清单、binding 与生成期运行时', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.platform');
  assert.ok(manifest);
  for (const name of ['CEF3平台_添加跨域白名单', 'CEF3平台_删除跨域白名单', 'CEF3平台_清空跨域白名单']) {
    const contributed = manifest.contributes?.commands?.find(item => item.name === name);
    assert.ok(contributed, `${name} 必须登记到 contributes.commands`);
    assert.equal(contributed.visibility, 'advanced', `${name} 属于安全策略类命令，默认不进常规补全`);
    const binding = manifest.bindings?.commands?.find(item => item.command === name);
    assert.ok(binding, `${name} 必须有确定性 binding`);
  }
  const addBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3平台_添加跨域白名单');
  assert.deepEqual(
    addBinding?.parameters?.map(parameter => parameter.type),
    ['wideString', 'wideString', 'wideString', 'bool']
  );

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.platform',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3平台工具模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    CEF3平台_添加跨域白名单("https://a.example.com", "https", "b.example.com", 1)\n    CEF3平台_清空跨域白名单()\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int CEF3平台_添加跨域白名单\(const wchar_t\* sourceOrigin, const wchar_t\* targetProtocol,/);
  assert.match(cpp, /LB_CEF3_AddCrossOriginWhitelistEntry/);
  assert.match(cpp, /LB_CEF3_ClearCrossOriginWhitelist/);
});

test('CEF3_读资源响应正文 生成事件上下文约束和 Bridge 调用', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const binding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_读资源响应正文');
  assert.ok(binding);
  assert.deepEqual(binding.parameters.map(parameter => parameter.type), ['controlRef', 'longLong', 'handler']);

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 资源响应到达()\n    CEF3_读资源响应正文(浏览器1, 65536, &资源响应正文到达)\n  结束\n  事件 资源响应正文到达()\n    调试输出(CEF3_取事件字段(浏览器1, "bodyText"))\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int CEF3_读资源响应正文\(const wchar_t\* controlName, long long maxBytes, const wchar_t\* handler\)/);
  assert.match(cpp, /LB_CEF3_ResourceResponseBodyBegin/);
  assert.match(cpp, /只能在“资源响应到达”处理器中调用/);
  assert.match(cpp, /资源响应正文到达/);
});

test('CEF3 JS 交互：cefQuery 通道初始化前注册、查询事件派发与应答命令有真实运行时', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const enableBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_启用JS扩展');
  const respondBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_查询应答');
  const failBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_查询应答失败');
  assert.ok(enableBinding && respondBinding && failBinding);
  assert.deepEqual(enableBinding.parameters.map(parameter => parameter.type), ['controlRef', 'wideString', 'wideString']);
  assert.deepEqual(respondBinding.parameters.map(parameter => parameter.type), ['controlRef', 'wideString', 'wideString']);
  assert.deepEqual(failBinding.parameters.map(parameter => parameter.type), ['controlRef', 'wideString', 'int', 'wideString']);

  // 事件目录：OnQuery / OnQueryCanceled 与桥接中文名一致。
  assert.ok(CEF3_BROWSER_EVENTS.some(event => event.id === 'OnQuery' && event.name === '查询请求'));
  assert.ok(CEF3_BROWSER_EVENTS.some(event => event.id === 'OnQueryCanceled' && event.name === '查询已取消'));

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible',
        properties: { url: 'about:blank', jsQueryFunctions: 'cefQuery,cefQueryCancel' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 查询请求到达()\n    CEF3_查询应答(浏览器1, CEF3_取事件字段(浏览器1, "queryId"), "本地数据")\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 生成期把控件属性 jsQueryFunctions 烘焙到 CEF3_初始化，且注册必须发生在 LB_CEF3_Initialize 之前。
  assert.match(cpp, /LB_CEF3_EnableJsQuery\(queryName\.c_str\(\), cancelName\.c_str\(\)\)/);
  assert.ok(
    cpp.indexOf('LB_CEF3_EnableJsQuery(queryName.c_str(), cancelName.c_str())')
      < cpp.indexOf('LB_CEF3_Initialize(&bridgeConfig)'),
    'JS 交互通道注册必须出现在 LB_CEF3_Initialize 之前');
  // 多通道：属性里多条通道以 ';' 分隔，跨控件重名通道只注册一次。
  const multiChannelProject: LingWindowProject = {
    ...project,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible',
        properties: { url: 'about:blank', jsQueryFunctions: 'cefQuery,cefQueryCancel;secondQuery,secondQueryCancel' },
        events: {}
      }, {
        id: 'cef2', type: 'CefBrowser', name: '浏览器2', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible',
        properties: { url: 'about:blank', jsQueryFunctions: 'secondQuery,secondQueryCancel;thirdQuery' },
        events: {}
      }]
    }]
  };
  const multiCpp = generateLingCppNativeWin32Project(
    multiChannelProject, { lingCppSourceCode: source, enabledModules: [module] }
  ).files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(multiCpp, /jsQueryFunctions \+= records\[0\]\[4\];/);
  assert.match(multiCpp, /std::vector<std::wstring> registeredChannels;/);
  assert.match(multiCpp, /if \(registered == queryName\) \{ duplicate = true; break; \}/);

  // 应答命令生成成员函数并调用真实桥导出。
  assert.match(cpp, /int CEF3_查询应答\(const wchar_t\* controlName, const wchar_t\* queryId, const wchar_t\* resultText\)/);
  assert.match(cpp, /int CEF3_查询应答失败\(const wchar_t\* controlName, const wchar_t\* queryId, int errorCode, const wchar_t\* errorText\)/);
  assert.match(cpp, /LB_CEF3_JsQueryRespond/);
  // 查询请求处理器通过 CEF3_绑定事件 绑定并派发。
  assert.match(cpp, /查询请求到达/);

  // 桥源码：EnableJsQuery 的注册校验在 LB_CEF3_Initialize 置位之前才有意义——
  // 断言桥导出真实存在且渲染侧经 MessageRouter 注入查询函数。
  const bridgeSource = await fs.readFile(new URL('../native/cef3-bridge/LingBuilderCefBridge.cpp', import.meta.url), 'utf8');
  assert.match(bridgeSource, /int LB_CEF3_CALL LB_CEF3_EnableJsQuery/);
  assert.match(bridgeSource, /int LB_CEF3_CALL LB_CEF3_JsQueryRespond/);
  assert.match(bridgeSource, /CefMessageRouterRendererSide::Create/);
  assert.match(bridgeSource, /CefMessageRouterBrowserSide::Handler/);
  // 多通道：通道配置是向量、命令行用 ';' 串联，对外查询ID 由桥全局递增分配（不重号）。
  assert.match(bridgeSource, /std::vector<JsQueryChannelConfig> g_js_query_channels;/);
  assert.match(bridgeSource, /kJsQueryChannelSeparator/);
  assert.match(bridgeSource, /g_js_query_sequence\.fetch_add\(1\)/);
  assert.match(bridgeSource, /\\"channelIndex\\"/);
  // 查询事件经受管通道派发，且取消通知派发「查询已取消」。
  assert.match(bridgeSource, /L"查询请求"/);
  assert.match(bridgeSource, /OnQueryCanceled/);
  assert.match(bridgeSource, /L"查询已取消"/);
  const bridgeHeader = await fs.readFile(new URL('../native/cef3-bridge/LingBuilderCefBridge.h', import.meta.url), 'utf8');
  assert.match(bridgeHeader, /LB_CEF3_EnableJsQuery/);
  assert.match(bridgeHeader, /LB_CEF3_JsQueryRespond/);
});

test('CEF3_替换资源响应内容 在创建前排队并在桥接句柄就绪时附加替换过滤器', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const replaceBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_替换资源响应内容');
  assert.ok(replaceBinding);
  assert.deepEqual(replaceBinding.parameters.map(parameter => parameter.type), ['controlRef', 'wideString', 'wideString']);
  const clearBinding = manifest.bindings?.commands?.find(item => item.command === 'CEF3_清除资源响应替换');
  assert.ok(clearBinding);
  assert.deepEqual(clearBinding.parameters.map(parameter => parameter.type), ['controlRef']);

  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  // 创建完毕里先配置替换再导航：桥接句柄尚未就绪，替换必须排队并在创建单个的同步点附加，
  // 这样初始导航的首个资源请求已经走替换过滤器。
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    CEF3_替换资源响应内容(浏览器1, "原始价格", "会员价格")\n    CEF3_导航(浏览器1, "https://example.com/demo")\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int CEF3_替换资源响应内容\(const wchar_t\* controlName, const wchar_t\* findText, const wchar_t\* replacementText\)/);
  assert.match(cpp, /int CEF3_应用资源响应替换\(CefBrowserInstance\* instance, const wchar_t\* findText, const wchar_t\* replacementText\)/);
  assert.match(cpp, /int CEF3_清除资源响应替换\(const wchar_t\* controlName\)/);
  assert.match(cpp, /LB_CEF3_ResponseFilterCreate/);
  assert.match(cpp, /LB_CEF3_ResponseFilterSetReplacement/);
  assert.match(cpp, /LB_CEF3_ResourceRequestHandlerSetResponseFilter\(instance->bridgeHandle, filter\)/);
  // 排队配置必须在 CEF3_创建单个 内、桥接订阅补齐之后立即应用，赶在初始导航请求之前。
  assert.match(cpp, /CEF3_补齐Bridge订阅\(\*instance\);[\s\S]{0,600}?if \(instance->hasPendingReplace\) \{[\s\S]{0,600}?CEF3_应用资源响应替换\(instance, queuedFind\.c_str\(\), queuedReplace\.c_str\(\)\);/);
  assert.match(cpp, /查找内容不能为空/);
});

test('CEF3_清除资源响应替换 移除排队配置并向桥接传递空过滤器', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    CEF3_替换资源响应内容(浏览器1, "原始价格", "会员价格")\n  结束\n  事件 _停止按钮_被单击()\n    CEF3_清除资源响应替换(浏览器1)\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /LB_CEF3_ResourceRequestHandlerSetResponseFilter\(instance->bridgeHandle, 0\)/);
  assert.match(cpp, /instance->hasPendingReplace = false;/);
});

test('CEF3_导航 在桥接句柄就绪前排队，并在浏览器创建完成事件里补发', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.cef3.browser',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'cef', type: 'CefBrowser', name: '浏览器1', content: '', x: 0, y: 0,
        width: 400, height: 300, background: '#fff', foreground: '#000',
        fontSize: 14, isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n使用 CEF3浏览器模块\n类 MainWindow : 窗口\n公开\n  事件 _MainWindow_创建完毕()\n    CEF3_导航(浏览器1, "https://example.com")\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // LB_CEF3_BrowserCreate 只把 CefBrowserHost::CreateBrowser 投递到 CEF UI 线程，句柄立刻返回，
  // 此刻 LB_CEF3_BrowserLoadUrl 会以「CEF3浏览器尚未创建完成」失败。创建完毕里发起的导航必须先排队，
  // 等桥接层发出「浏览器创建完成」（该事件发出前 state->browser 已写入）再补发。
  assert.match(cpp, /bool bridgeReady = false;/);
  assert.match(cpp, /std::wstring pendingNavigation;/);
  assert.match(cpp, /if \(!instance->bridgeReady\) \{\s*\n\s*instance->pendingNavigation = address;\s*\n\s*return 1;\s*\n\s*\}/);
  assert.match(cpp, /if \(TextEquals\(eventName, L"浏览器创建完成"\) && !instance\.bridgeReady\) \{/);
  assert.match(cpp, /LB_CEF3_BrowserLoadUrl\(instance\.bridgeHandle, target\.c_str\(\)\) == LB_CEF3_OK/);
  // 补发必须排在事件派发之前：用户没有绑定「浏览器创建完成」时也要能补发导航。
  const flush = cpp.indexOf('TextEquals(eventName, L"浏览器创建完成")');
  const dispatch = cpp.indexOf('void CEF3_投递事件(');
  assert.ok(flush >= 0 && dispatch > flush, '补发导航必须无条件先于事件派发，否则未绑定该事件时不会执行');
});

test('FBro module contributes a toolbox designer control and C ABI generated runtime', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-x64']);
  assert.equal(manifest.compatibility?.conflicts?.length || 0, 0);
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'FBro_打开谷歌原生UI浏览器'));
  for (const name of ['FBro_是否可后退', 'FBro_是否可前进', 'FBro_是否加载中', 'FBro_取缩放级别',
    'FBro_设置缩放级别', 'FBro_是否静音', 'FBro_设置静音', 'FBro_设置焦点', 'FBro_查找',
    'FBro_停止查找', 'FBro_是否打开开发者工具', 'FBro_关闭开发者工具', 'FBro_强制刷新',
    'FBro_取浏览器标识', 'FBro_是否同一实例', 'FBro_是否弹出窗口', 'FBro_是否有文档',
    'FBro_尝试关闭', 'FBro_设置宿主焦点', 'FBro_是否有视图', 'FBro_设置自动调整大小',
    'FBro_取进程状态', 'FBro_取进程ID', 'FBro_取调试端口', 'FBro_重启进程',
    'FBro_显示', 'FBro_隐藏', 'FBro_调整大小', 'FBro_截图到文件']) {
    assert.ok(manifest.contributes?.commands?.some(command => command.name === name), `缺少 ${name} contribution`);
    assert.ok(manifest.bindings?.commands?.some(binding => binding.command === name), `缺少 ${name} binding`);
  }
  const designer = manifest.contributes?.designerControls?.find(control => control.type === 'FBroBrowser');
  assert.equal(designer?.label, 'FBro指纹浏览器');
  assert.equal(designer?.nativeAdapter, 'fbro-browser');
  assert.equal(designer?.events?.length, 94);
  assert.ok(designer?.events?.every(event => /^fbro\.event\.fbrohs(?:broevent|initevent)\./u.test(event.name)));
  assert.ok(!designer?.events?.some(event => /getauthcredentials/u.test(event.name)));
  const browserGroup = createControlToolboxGroups(['Button', 'FBroBrowser'], false).find(group => group.id === 'browser');
  assert.deepEqual(browserGroup?.controlTypes, ['FBroBrowser']);

  const module: InstalledModule = {
    manifest, installPath: 'builtin://lingbuilder.fbro.browser', isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 12, y: 20,
        width: 480, height: 320, background: '#ffffff', foreground: '#000000', fontSize: 14,
        isEnabled: true, visibility: 'Visible',
        properties: { url: 'https://example.com', cacheDir: '', fingerprintProfile: '{"seed":42}' },
        events: { Created: 'FBro浏览器1_创建完成', LoadEnd: 'FBro浏览器1_加载完成' }
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [module],
    lingCppSourceCode: '类 MainWindow\n    事件 FBro浏览器1_创建完成()\n        FBro_导航("FBro浏览器1", "https://example.com")\n        FBro_设置缩放级别("FBro浏览器1", 1.25)\n        FBro_设置静音("FBro浏览器1", 真)\n        FBro_设置焦点("FBro浏览器1", 真)\n        FBro_查找("FBro浏览器1", "LingBuilder", 真, 假, 假)\n        FBro_停止查找("FBro浏览器1", 真)\n        调试输出(FBro_是否可后退("FBro浏览器1"), FBro_是否可前进("FBro浏览器1"), FBro_是否加载中("FBro浏览器1"), FBro_取缩放级别("FBro浏览器1"), FBro_是否静音("FBro浏览器1"), FBro_是否打开开发者工具("FBro浏览器1"))\n        FBro_关闭开发者工具("FBro浏览器1")\n        FBro_打开谷歌原生UI浏览器("FBro浏览器1", "https://example.com")\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /#include <LingBuilderFbroBridge\.h>/u);
  assert.ok(cpp.indexOf('#define LINGBUILDER_FBRO_MODULE') < cpp.indexOf('#if defined(LINGBUILDER_FBRO_MODULE) && __has_include(<LingBuilderFbroBridge.h>)'));
  assert.match(cpp, /IsType\(control, L"FBroBrowser"\)/u);
  assert.match(cpp, /LB_FBro_Create/u);
  assert.match(cpp, /LB_FBro_SetEventCallbackV3/u);
  assert.match(cpp, /LB_FBRO_EVENT_FLAG_SYNCHRONOUS/u);
  assert.match(cpp, /int FBro_导航\(const wchar_t\* controlName, const std::wstring& address\)/u);
  assert.match(cpp, /LB_FBro_CreateChromeUi/u);
  assert.match(cpp, /int FBro_打开谷歌原生UI浏览器\(const wchar_t\* controlName, const wchar_t\* address\)/u);
  assert.match(cpp, /int FBro_打开谷歌原生UI浏览器\(const wchar_t\* controlName, const std::wstring& address\)/u);
  assert.match(cpp, /std::map<LB_FBRO_HANDLE, PopupState> chromeUiInstances;/u);
  assert.match(cpp, /for \(const auto& popup : item\.second->chromeUiInstances\)/u);
  assert.match(cpp, /LB_FBro_SetEventCallbackV2/u);
  assert.match(cpp, /SendMessageTimeoutW/u);
  assert.match(cpp, /FBro_取事件字段/u);
  assert.match(cpp, /long long FBro_取事件延续\(const wchar_t\* controlName\)/u);
  assert.match(cpp, /designerHandler = GetEventHandler\(\*control, key\)/u);
  for (const symbol of ['LB_FBro_CanGoBack', 'LB_FBro_CanGoForward', 'LB_FBro_IsLoading', 'LB_FBro_GetZoomLevel',
    'LB_FBro_SetZoomLevel', 'LB_FBro_IsAudioMuted', 'LB_FBro_SetAudioMuted', 'LB_FBro_SendFocusEvent',
    'LB_FBro_Find', 'LB_FBro_StopFinding', 'LB_FBro_HasDevTools', 'LB_FBro_CloseDevTools',
    'LB_FBro_ReloadIgnoreCache', 'LB_FBro_GetIdentifier', 'LB_FBro_IsSame', 'LB_FBro_IsPopup',
    'LB_FBro_HasDocument', 'LB_FBro_TryCloseBrowser', 'LB_FBro_SetFocus', 'LB_FBro_HasView',
    'LB_FBro_SetAutoResizeEnabled']) {
    assert.match(cpp, new RegExp(symbol, 'u'), `生成运行时缺少 ${symbol}`);
  }
  assert.match(cpp, /WM_LINGBUILDER_FBRO_EVENT/u);
  assert.match(cpp, /bool FBro_是否全部关闭\(\) const/u);
  assert.match(cpp, /void FBro_开始应用关闭\(\)/u);
  assert.match(cpp, /fbroClosePending_ = true/u);
  assert.match(cpp, /SetTimer\(hwnd_, 0x4C46, 5000/u);
  assert.match(cpp, /\.fbro-global-cache\/profile-fbro-1/u);
  assert.doesNotMatch(cpp, /CefRefPtr<FBro/u);
  // 进程内 FBro 初始化必须走 InitializeEx 并自动预留回环 CDP 调试端口。
  assert.match(cpp, /static bool LB_FBroInitializeInProcess\(const std::wstring& runtimeDirectory\)/u);
  assert.match(cpp, /options\.remote_debugging_port = port;/u);
  assert.match(cpp, /if \(!LB_FBroInitializeInProcess\(fbroRuntimeDirectory\)\)/u);
  assert.match(cpp, /fbroInitialized_ = LB_FBroInitializeInProcess\(runtimeDirectory\) \? 1 : 0;/u);
  assert.match(cpp, /: \(fbroInitialized_ \? g_lingFbroInProcessDebuggingPort : 0\);/u);
  assert.doesNotMatch(cpp, /LB_FBro_Initialize\(/u);
});

test('进程内 FBro 调试端口随 enableDevTools 开关并支持全关', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest, installPath: 'builtin://lingbuilder.fbro.browser', isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const projectWithDevTools = (enableDevTools: boolean | undefined, processMode = 'in-process'): LingWindowProject => ({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 10, y: 10,
        width: 480, height: 320, background: '#ffffff', foreground: '#000000', fontSize: 14,
        isEnabled: true, visibility: 'Visible',
        properties: {
          processMode, url: 'about:blank',
          ...(enableDevTools === undefined ? {} : { enableDevTools })
        },
        events: {}
      }]
    }]
  });
  // 默认（设计器属性缺省为 true）与显式 true：进程内初始化预留回环调试端口。
  for (const enableDevTools of [undefined, true] as const) {
    const generated = generateLingCppNativeWin32Project(projectWithDevTools(enableDevTools), {
      enabledModules: [module], lingCppSourceCode: ''
    });
    const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
    assert.match(cpp, /WSAStartup\(MAKEWORD\(2, 2\), &wsaData\)/u, `enableDevTools=${enableDevTools} 应预留调试端口`);
    assert.ok(!cpp.includes('不预留 CDP 调试端口'));
  }
  // 显式 false：不预留端口（remote_debugging_port 保持 0），初始化仍走 InitializeEx。
  const disabled = generateLingCppNativeWin32Project(projectWithDevTools(false), {
    enabledModules: [module], lingCppSourceCode: ''
  });
  const cpp = disabled.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(!cpp.includes('WSAStartup(MAKEWORD(2, 2), &wsaData)'), 'enableDevTools=false 不得预留调试端口');
  assert.match(cpp, /不预留 CDP 调试端口/u);
  assert.match(cpp, /options\.remote_debugging_port = port;/u);
  // 独立进程模式：进程内端口烘焙不参与，仍由 Host 按 enableDevTools 决定。
  const independent = generateLingCppNativeWin32Project(projectWithDevTools(undefined, 'independent-embedded'), {
    enabledModules: [module], lingCppSourceCode: ''
  });
  const independentCpp = independent.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(!independentCpp.includes('if (!LB_FBroInitializeInProcess(fbroRuntimeDirectory))'));
});

test('FBro bridge serializes browser creation onto the CEF UI thread and contains profiles under root cache', async () => {
  const bridgeSource = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  assert.match(bridgeSource, /CefPostTask\(TID_UI, new BridgeBrowserStartTask\(handle\)\)/u);
  assert.match(bridgeSource, /ResolveProfileDirectory/u);
  assert.match(bridgeSource, /normalized_root \/ \(L"profile-"/u);
  assert.doesNotMatch(bridgeSource, /g_browsers\.emplace\(handle, std::move\(state\)\);\s*StartBrowser\(\*raw\)/u);
  assert.match(bridgeSource, /LB_FBRO_EVENT_BEFORE_POPUP/u);
  assert.match(bridgeSource, /Notify\(\*state, LB_FBRO_EVENT_BEFORE_POPUP, target_url\.ToWString\(\)\)/u);
  assert.match(bridgeSource, /if \(frame && !target_url\.empty\(\)\) frame->LoadURL\(target_url\);\s*return true;\s*\}\s*void OnBeforeClose/u,
    '即将打开新窗口必须在当前浏览器 frame 中打开，并阻止额外弹窗');
  assert.match(bridgeSource, /LB_FBRO_EVENT_PACKET_V2/u);
  assert.match(bridgeSource, /LB_FBro_SetEventCallbackV2/u);
  assert.match(bridgeSource, /LB_FBro_CreateChromeUi/u);
  assert.match(bridgeSource, /window\.runtime_style = CEF_RUNTIME_STYLE_CHROME;/u);
  assert.match(bridgeSource, /window\.parent_window = nullptr;/u);
  assert.match(bridgeSource, /window\.window = nullptr;/u);
  assert.match(bridgeSource, /window\.ex_style = WS_EX_APPWINDOW;/u);
  assert.doesNotMatch(bridgeSource, /LB_FBro_CreateChromeUi\(HWND/u);
  assert.match(bridgeSource, /RequestBrowserCloseBatchAndWait/u);
  assert.match(bridgeSource, /ContinuationTimerLoop/u);
  assert.match(bridgeSource, /g_continuation_timer_condition\.wait_until/u);
  assert.doesNotMatch(bridgeSource, /BridgeContinuationTimeoutTask/u);
  assert.match(bridgeSource, /callback->Cancel\(\)/u);
});

test('FBro browser manager passes Chromium internal URLs without an HTTP allowlist', async () => {
  const runtime = generateFbroBrowserManagerRuntime(true).methods;
  assert.match(runtime, /return !value\.empty\(\) && value\.find_first_of\(L"\\r\\n"\) == std::wstring::npos/u);
  assert.match(runtime, /if \(!instance \|\| !浏览器管理器_地址可导航\(url\)\) return false;/u);
  assert.doesNotMatch(runtime, /url\.rfind\(L"https?:\/\//u);
  assert.match(runtime, /normalized == L"chrome:\/\/extensions"/u);
  assert.match(runtime, /FBro 嵌入式 Alloy 运行时不提供 Chrome 自带的扩展管理界面/u);
  assert.match(runtime, /data:text\/html;charset=utf-8,/u);

  const projectSource = await fs.readFile(
    path.resolve(import.meta.dirname, '..', '..', 'src', 'win32-fbro-multi-browser-manager', 'MainWindow.lcpp'),
    'utf8'
  );
  assert.doesNotMatch(projectSource, /请输入 http:\/\/ 或 https:\/\/ 地址/u);
});

test('FBro browser manager synchronizes addresses, verifies extension injection, and resizes after source layout', async () => {
  const [bridgeSource, projectSource, win32GeneratorSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', '..', 'src', 'win32-fbro-multi-browser-manager', 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts'), 'utf8')
  ]);
  const generatedRuntime = generateFbroBrowserManagerRuntime(true);
  const runtime = generatedRuntime.methods;
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  const bindAddress = manifest?.bindings?.commands.find(item => item.command === '浏览器管理器_绑定地址栏');

  assert.equal(bindAddress?.parameters[0]?.type, 'controlRef');
  assert.deepEqual(bindAddress?.parameters[0]?.controlTypes, ['TextBox']);
  assert.equal(bindAddress?.parameters[0]?.runtimeRepresentation, 'nativeHandle');
  assert.match(generatedRuntime.members, /int addressControlId = 0;/u);
  assert.match(runtime, /SetWindowTextW\(address->hwnd, instance \? instance->url\.c_str\(\) : L""\)/u);
  assert.match(runtime, /packet\.eventName == L"AddressChanged"/u);
  assert.match(runtime, /document\.getElementById\('doubao-downloader'\) \? 'root'/u);
  assert.match(runtime, /data-lingbuilder-doubao-downloader/u);
  assert.match(runtime, /assetsRoot = \(executableDirectory \/ L"assets"\)/u);
  assert.match(runtime, /projectAsset = \(iterator->path\(\) \/ L"doubao-downloader"\)/u);
  assert.match(generatedRuntime.members, /bool pluginReloadedAfterRegistration = false;/u);
  assert.match(runtime, /浏览器管理器_逻辑\(instance, L"reload"\)/u);
  assert.match(runtime, /instance\.pluginStatus = L"插件已生效"/u);
  assert.match(runtime, /instance\.pluginStatus = L"插件未在当前页面生效"/u);
  assert.match(runtime, /浏览器管理器_处理插件检查定时器/u);
  assert.match(bridgeSource, /CefRequestContext::CreateContext\(context_settings, nullptr\)/u);
  assert.match(bridgeSource, /FBroHsVIPRequestContext_LoadExtension\(state\.request_context, state\.extension_directory\)/u);
  // 在线 VIP 授权校验会经 FBrowserVIP -> FBrowserCEF3lib -> libcef，因此必须在 CEF
  // 初始化完成之后调用。放在 InitPro 之前会让 libcef 触发 CHECK(0x80000003) 并杀死
  // Host 进程；完整崩溃转储已把出错帧定位到 LB_FBro_InitializeEx -> FBrowserVIP。
  // 断言比较的是 LB_FBro_InitializeEx 内的真实调用顺序，而不是函数定义位置。
  assert.match(bridgeSource, /ApplyPendingLicenseAfterInitialize\(\)/u);
  const initializeBody = bridgeSource.slice(
    bridgeSource.indexOf('int __stdcall LB_FBro_InitializeEx(')
  );
  const initProCall = initializeBody.indexOf('if (!FBroHsInitPro(&settings, g_init_event, 1024))');
  const licenseCall = initializeBody.indexOf('ApplyPendingLicenseAfterInitialize()');
  const extensionPlusCall = initializeBody.indexOf('FBroHsVIPRequestContext_EnableExtensionPlus();');
  assert.ok(initProCall >= 0 && licenseCall >= 0 && extensionPlusCall >= 0,
    'LB_FBro_InitializeEx 必须同时包含 InitPro、授权应用与高级扩展开关调用');
  assert.ok(initProCall < licenseCall, 'FBro VIP 在线授权必须在 FBro 初始化之后设置');
  assert.ok(initProCall < extensionPlusCall, '高级扩展开关必须在 InitPro 之后启用');
  assert.match(bridgeSource, /SecureZeroMemory\(credential\.data\(\), credential\.size\(\) \* sizeof\(wchar_t\)\)/u);
  assert.match(bridgeSource, /OnCreateExtension is also raised for FBro\/Chromium built-in extensions/u);
  assert.ok(
    bridgeSource.indexOf('FBroHsVIPRequestContext_LoadExtension(state.request_context, state.extension_directory)')
      < bridgeSource.indexOf('if (!FBroHsCreate('),
    '扩展必须在创建浏览器前加载到独立 RequestContext'
  );
  assert.doesNotMatch(bridgeSource, /AppendSwitchWithValue\(\s*"load-extension"/u);
  assert.match(projectSource, /浏览器管理器_绑定地址栏\(地址输入\)/u);
  assert.match(projectSource, /空 调整布局\(\)[\s\S]*控件_设置位置大小\(浏览器页面,[\s\S]*窗口高度 - 92 \* 当前DPI \/ 96\)/u);
  assert.match(projectSource, /事件 _MainWindow_大小被改变\(\)\s+调整布局\(\)/u);
  const sizeBlockStart = win32GeneratorSource.indexOf('        case WM_SIZE:',
    win32GeneratorSource.indexOf('class LingWindowBase'));
  const sizeBlock = win32GeneratorSource.slice(
    sizeBlockStart,
    win32GeneratorSource.indexOf('        case WM_ACTIVATE:', sizeBlockStart)
  );
  assert.ok(sizeBlock.indexOf('DispatchWindowEvent(L"SizeChanged")') < sizeBlock.indexOf('FBro_调整全部大小()'));
  assert.match(win32GeneratorSource, /浏览器管理器_处理插件检查定时器\(static_cast<UINT_PTR>\(wParam\)\)/u);
  assert.match(win32GeneratorSource, /LB_NE_BrowserShellExtensionPath\(\)[\s\S]{0,800}assetsRoot/u);
});

test('FBro browser manager observes downloads without canceling the default transfer', async () => {
  const [bridgeSource, bridgeHeader, processRuntime, projectSource, designerText] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroProcessRuntime.hpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', '..', 'src', 'win32-fbro-multi-browser-manager', 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', '..', '.lingbuilder', 'projects', 'win32-fbro-multi-browser-manager', 'window-designer.json'), 'utf8')
  ]);
  const runtime = generateFbroBrowserManagerRuntime(true).methods;
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  const bindDownloadView = manifest?.bindings?.commands.find(item => item.command === '浏览器管理器_绑定下载视图');
  assert.equal(bindDownloadView?.parameters[0]?.type, 'controlRef');
  assert.deepEqual(bindDownloadView?.parameters[0]?.controlTypes, ['TextBox', 'Label']);
  assert.equal(bindDownloadView?.parameters[1]?.type, 'controlRef');
  assert.deepEqual(bindDownloadView?.parameters[1]?.controlTypes, ['ProgressBar']);
  assert.match(bridgeHeader, /LB_FBRO_EVENT_DOWNLOAD_START = 16/u);
  assert.match(bridgeHeader, /LB_FBRO_EVENT_DOWNLOAD_UPDATED = 17/u);
  assert.match(bridgeSource, /DispatchPassiveLegacyEvent\(handle_, LB_FBRO_EVENT_DOWNLOAD_START, fields\)/u);
  assert.match(bridgeSource, /FBroHsBeforeDownloadCallback_Continue\(callback, CefString\(\), false\)/u);
  assert.match(bridgeSource, /DispatchPassiveLegacyEvent\(handle_, LB_FBRO_EVENT_DOWNLOAD_UPDATED, fields\)/u);
  for (const field of ['isInProgress', 'isComplete', 'isCanceled', 'currentSpeed', 'suggestedName', 'fullPath']) {
    assert.match(bridgeSource, new RegExp(`L"${field}"`, 'u'), `下载事件缺少真实字段 ${field}`);
  }
  assert.match(processRuntime, /eventCode == LB_FBRO_EVENT_DOWNLOAD_START \? L"OnBeforeDownload"/u);
  assert.match(processRuntime, /eventCode == LB_FBRO_EVENT_DOWNLOAD_UPDATED \? L"OnDownloadUpdated"/u);
  assert.match(runtime, /if \(packet\.eventName == L"OnBeforeDownload"\)/u);
  assert.match(runtime, /if \(packet\.eventName == L"OnDownloadUpdated"\)/u);
  assert.match(runtime, /instance\.downloadStatus = L"下载完成"/u);
  assert.match(runtime, /std::filesystem::is_directory\(directory, error\)/u);
  assert.match(projectSource, /浏览器管理器_绑定下载视图\(实例详情, 下载进度\)/u);
  assert.match(projectSource, /浏览器管理器_打开当前下载目录\(\)/u);
  const designer = JSON.parse(designerText) as LingWindowProject;
  const detail = designer.windows[0]?.controls.find(control => control.id === 'instance-detail');
  const progress = designer.windows[0]?.controls.find(control => control.id === 'download-progress');
  const openDownload = designer.windows[0]?.controls.find(control => control.id === 'open-download');
  assert.equal(detail?.type, 'TextBox');
  assert.equal(detail?.properties?.readOnly, true);
  assert.equal(detail?.properties?.multiline, true);
  assert.equal(progress?.type, 'ProgressBar');
  assert.equal(progress?.properties?.maximum, 100);
  assert.equal(openDownload?.type, 'Button');
});

test('FBro 桥接 DLL 导出探测识别陈旧 SDK 与非 PE 文件', () => {
  /** 构造只含解析所需字段的最小 PE32+ 文件：一个节、导出表含给定名称。 */
  const buildMinimalPe = (exportNames: string[]): Buffer => {
    const headerSize = 0x200;
    const sectionRva = 0x1000;
    const sectionRaw = 0x200;
    const sectionSize = 0x2000;
    const buffer = Buffer.alloc(headerSize + sectionSize);
    buffer.writeUInt16LE(0x5a4d, 0); // MZ
    buffer.writeUInt32LE(0x40, 0x3c); // e_lfanew
    buffer.writeUInt32LE(0x00004550, 0x40); // PE 头
    buffer.writeUInt16LE(0x8664, 0x44); // machine
    buffer.writeUInt16LE(1, 0x46); // numberOfSections
    buffer.writeUInt16LE(240, 0x54); // sizeOfOptionalHeader
    const optional = 0x58;
    buffer.writeUInt16LE(0x20b, optional); // PE32+
    buffer.writeUInt32LE(sectionRva, optional + 112); // export dir RVA
    buffer.writeUInt32LE(64 + exportNames.length * 4 + 4 * exportNames.length + 256, optional + 116);
    const section = optional + 240;
    buffer.writeUInt32LE(sectionSize, section + 8); // virtualSize
    buffer.writeUInt32LE(sectionRva, section + 12); // virtualAddress
    buffer.writeUInt32LE(sectionSize, section + 16); // sizeOfRawData
    buffer.writeUInt32LE(sectionRaw, section + 20); // pointerToRawData
    // 导出目录在节首，随后函数地址表/名称表/序号表/字符串
    const dir = sectionRaw;
    const functionsRva = sectionRva + 64;
    const namesRva = functionsRva + 4 * exportNames.length;
    const ordinalsRva = namesRva + 4 * exportNames.length;
    const stringsRva = ordinalsRva + 2 * exportNames.length;
    buffer.writeUInt32LE(exportNames.length, dir + 20); // numberOfFunctions
    buffer.writeUInt32LE(exportNames.length, dir + 24); // numberOfNames
    buffer.writeUInt32LE(functionsRva, dir + 28);
    buffer.writeUInt32LE(namesRva, dir + 32);
    buffer.writeUInt32LE(ordinalsRva, dir + 36);
    let stringCursor = stringsRva;
    exportNames.forEach((name, index) => {
      buffer.writeUInt32LE(functionsRva + index * 4, functionsRva - sectionRva + sectionRaw + index * 4);
      buffer.writeUInt32LE(stringCursor, namesRva - sectionRva + sectionRaw + index * 4);
      const nameOffset = stringCursor - sectionRva + sectionRaw;
      buffer.write(name, nameOffset, 'latin1');
      buffer.writeUInt8(0, nameOffset + Buffer.byteLength(name, 'latin1'));
      stringCursor += Buffer.byteLength(name, 'latin1') + 1;
    });
    return buffer;
  };

  const good = buildMinimalPe(['LB_FBro_ResourceBodyBegin', 'LB_FBro_Navigate']);
  assert.equal(peExportProbe(good, 'LB_FBro_ResourceBodyBegin'), 'has');
  assert.equal(peExportProbe(good, 'LB_FBro_ResourceBodyBeginOld'), 'missing');
  assert.equal(peExportProbe(Buffer.from('not a pe file'), 'LB_FBro_ResourceBodyBegin'), 'notPe');
});

test('FBro_替换资源响应内容族 生成 VIP 资源规则调用与同步包装', async () => {
  const browserManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(browserManifest);
  for (const [name, types] of [
    ['FBro_替换资源响应内容', ['controlRef', 'wideString', 'wideString']],
    ['FBro_替换资源响应文件', ['controlRef', 'wideString', 'wideString']],
    ['FBro_清除资源响应替换', ['controlRef', 'wideString']],
    ['FBro_清空资源响应替换', ['controlRef']]
  ] as const) {
    const binding = browserManifest.bindings?.commands?.find(item => item.command === name);
    assert.ok(binding, name);
    assert.deepEqual(binding.parameters.map(parameter => parameter.type), [...types]);
  }

  const modules: InstalledModule[] = [browserManifest].map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-replace', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 0, y: 0,
        width: 320, height: 200, background: '#fff', foreground: '#000', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试
类 MainWindow : 窗口
公开
  事件 测试()
    FBro_替换资源响应内容(FBro浏览器1, "https://www.example.com/target", "<h1>已替换</h1>")
    FBro_替换资源响应文件(FBro浏览器1, "https://www.example.com/page", "替换页.html")
    FBro_清除资源响应替换(FBro浏览器1, "https://www.example.com/target")
    FBro_清空资源响应替换(FBro浏览器1)
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: modules });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int FBro_替换资源响应内容\(const wchar_t\* controlName, const wchar_t\* url, const wchar_t\* content\)/);
  assert.match(cpp, /LB_FBro_VipResourceCommandAsync\(instance->handle, command, args\.c_str\(\), nullptr, nullptr\)/);
  assert.match(cpp, /LB_FBro_BufferCreate\(utf8\.data\(\), utf8\.size\(\)\)/);
  assert.match(cpp, /LB_FBro_BufferRelease\(buffer\)/);
  assert.match(cpp, /FBroHsVIPControl_AddResourceHandlerChangeData/);
  assert.match(cpp, /FBroHsVIPControl_AddResourceHandlerChangeFile/);
  assert.match(cpp, /FBroHsVIPControl_DeleteResourceHandlerChangeData/);
  assert.match(cpp, /FBroHsVIPControl_DeleteResourceHandlerAllData/);
  assert.ok(cpp.includes('mimeType' + String.fromCharCode(92) + '"' + ':' + String.fromCharCode(92) + '"' + 'text/html'), '生成的 args 应含转义的 mimeType 键值');
  assert.match(cpp, /FBro_替换资源响应内容\(L"FBro浏览器1", L"https:\/\/www\.example\.com\/target", L"<h1>已替换<\/h1>"\)/);
  assert.match(cpp, /FBro_清空资源响应替换\(L"FBro浏览器1"\)/);
});

test('FBro_替换资源响应文本族 生成非 VIP 查找替换桥接调用', async () => {
  const browserManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(browserManifest);
  for (const [name, types] of [
    ['FBro_替换资源响应文本', ['controlRef', 'wideString', 'wideString']],
    ['FBro_清除资源响应文本替换', ['controlRef']]
  ] as const) {
    const binding = browserManifest.bindings?.commands?.find(item => item.command === name);
    assert.ok(binding, name);
    assert.deepEqual(binding.parameters.map(parameter => parameter.type), [...types]);
  }
  assert.ok(browserManifest.contributes?.commands?.find(item => item.name === 'FBro_替换资源响应文本')?.aliases?.includes('LB_FBro_ResourceReplaceSet'));
  assert.ok(browserManifest.contributes?.commands?.find(item => item.name === 'FBro_清除资源响应文本替换')?.aliases?.includes('LB_FBro_ResourceReplaceClear'));

  const modules: InstalledModule[] = [browserManifest].map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-replace-text', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 0, y: 0,
        width: 320, height: 200, background: '#fff', foreground: '#000', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试
类 MainWindow : 窗口
公开
  事件 测试()
    FBro_替换资源响应文本(FBro浏览器1, "原始价格", "会员价格")
    FBro_清除资源响应文本替换(FBro浏览器1)
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: modules });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int FBro_替换资源响应文本\(const wchar_t\* controlName, const wchar_t\* findText, const wchar_t\* replacementText\)/);
  assert.match(cpp, /int FBro_清除资源响应文本替换\(const wchar_t\* controlName\)/);
  // 非 VIP 路径：同步导出 + 受管缓冲，不经过 VIP 资源规则任务
  assert.match(cpp, /LB_FBro_ResourceReplaceSet\(instance->handle, findBuffer, replacementBuffer\)/);
  assert.match(cpp, /LB_FBro_ResourceReplaceClear\(instance->handle\)/);
  assert.match(cpp, /FBro_替换资源响应文本\(L"FBro浏览器1", L"原始价格", L"会员价格"\)/);
  assert.match(cpp, /FBro_清除资源响应文本替换\(L"FBro浏览器1"\)/);
  const textHelperBody = cpp.slice(
    cpp.indexOf('int FBro_替换资源响应文本('),
    cpp.indexOf('int FBro_清除资源响应文本替换('));
  assert.ok(!textHelperBody.includes('VipResourceCommandAsync'), '非 VIP 替换命令不得依赖 VIP 资源规则任务');
  assert.ok(textHelperBody.includes('LB_FBro_BufferRelease(findBuffer)'), '替换配置设置完成后必须释放受管缓冲');
});

test('FBro_读资源响应正文 生成事件上下文约束、桥接调用与合成事件', async () => {
  const browserManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  const eventsManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.events');
  assert.ok(browserManifest && eventsManifest);
  const binding = eventsManifest.bindings?.commands?.find(item => item.command === 'FBro_读资源响应正文');
  assert.ok(binding);
  assert.deepEqual(binding.parameters.map(parameter => parameter.type), ['controlRef', 'longLong', 'handler']);
  const handlerParameter = binding.parameters[2];
  assert.match(handlerParameter.description ?? '', /&处理器名/);

  const modules: InstalledModule[] = [browserManifest, eventsManifest].map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-body', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 0, y: 0,
        width: 320, height: 200, background: '#fff', foreground: '#000', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试\n类 MainWindow : 窗口\n公开\n  事件 处理资源响应()\n    FBro_读资源响应正文(FBro浏览器1, 65536, &资源正文到达)\n  结束\n  事件 资源正文到达()\n    调试输出(FBro_取事件字段(FBro浏览器1, "body_text"))\n  结束\n结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: modules });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int FBro_读资源响应正文\(const wchar_t\* controlName, long long maxBytes, const wchar_t\* handler\)/);
  assert.match(cpp, /LB_FBro_ResourceBodyBegin/);
  assert.match(cpp, /只能在“资源响应到达”处理器中调用/);
  assert.match(cpp, /资源响应正文到达/);
  assert.match(cpp, /FBro_读资源响应正文\(L"FBro浏览器1", 65536, L"资源正文到达"\)/);

  // 桥接契约：三个资源事件为手写覆盖（生成文件只留标记），稳定事件 ID 不变，
  // 且导出、字段构建、正文过滤器和捕获入口都真实存在。
  const bridge = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  const overrides = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'FbroEventOverrides.generated.inc'), 'utf8');
  assert.match(overrides, /\/\/ custom override: OnResourceResponse/);
  assert.match(overrides, /\/\/ custom override: OnResourceLoadComplete/);
  assert.match(overrides, /\/\/ custom override: GetResourceResponseFilter/);
  assert.match(bridge, /bool OnResourceResponse\(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,\s+CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response\) override/);
  assert.match(bridge, /fbro\.event\.fbrohsbroevent\.onresourceresponse\.8841d0c12824/);
  assert.match(bridge, /fbro\.event\.fbrohsbroevent\.onresourceloadcomplete\.b58a5747af0a/);
  assert.match(bridge, /fbro\.bridge\.resource_response_body/);
  assert.match(bridge, /std::wstring BuildResourceFieldsJson\(/);
  assert.match(bridge, /class LingFbroResourceBodyFilter final : public FBroHsResponseFilter/);
  assert.match(bridge, /FBroHsResponseFilter_Create\(hs_filter\)/);
  assert.match(bridge, /void End\(int64_t\) override \{ DispatchResourceBodyEvent\(handle_, capture_, L""\); \}/);
  assert.match(bridge, /int __stdcall LB_FBro_ResourceBodyBegin\(LB_FBRO_HANDLE browser, uint64_t request_id,\s+int64_t max_bytes\)/);
  const bridgeHeader = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8');
  assert.match(bridgeHeader, /LB_FBro_ResourceBodyBegin/);
});

test('FBro v3 continuation JSON keeps escaped quotes inside one UTF-16 module argument', () => {  const browserManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  const eventsManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.events');
  assert.ok(browserManifest && eventsManifest);
  const modules: InstalledModule[] = [browserManifest, eventsManifest].map(manifest => ({
    manifest,
    installPath: `builtin://${manifest.id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'fbro-json', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 0, y: 0,
        width: 320, height: 200, background: '#fff', foreground: '#000', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' }
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: modules,
    lingCppSourceCode: '类 MainWindow\n    事件 测试()\n        FBro事件_完成延续(FBro_取事件延续(FBro浏览器1), "{\\"action\\":1}")\n    结束\n结束类'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /FBro事件_完成延续\(FBro_取事件延续\(L"FBro浏览器1"\), L"\{\\"action\\":1\}"\)/u);
});

test('FBro UI beginner project exposes embedded and hostless Chrome UI actions', async () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const source = await fs.readFile(path.join(root, 'src', 'fbro-ui', 'MainWindow.lcpp'), 'utf8');
  const project = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'projects', 'fbro-ui', 'window-designer.json'), 'utf8')) as LingWindowProject;
  const modules = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'projects', 'fbro-ui', 'project-modules.json'), 'utf8')) as { enabledModuleIds: string[] };
  assert.ok(modules.enabledModuleIds.includes('lingbuilder.fbro.browser'));
  assert.ok(project.windows[0]?.controls.some(control => control.type === 'FBroBrowser'));
  assert.ok(project.windows[0]?.controls.some(control => control.name === '内嵌打开按钮'));
  assert.ok(project.windows[0]?.controls.some(control => control.name === '谷歌原生UI按钮'));
  assert.match(source, /FBro_导航\(FBro指纹浏览器1/u);
  assert.match(source, /FBro_打开谷歌原生UI浏览器\(FBro指纹浏览器1/u);
  assert.match(source, /FBro_取最近事件\(FBro指纹浏览器1\)/u);
});

test('FBro resize never blocks the host message loop or recursively moves Chromium descendants', async () => {
  const bridgeSource = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  assert.match(bridgeSource, /std::unique_lock<std::recursive_mutex> lock\(g_mutex, std::try_to_lock\)/u);
  assert.match(bridgeSource, /GetWindow\(host, GW_CHILD\)/u);
  assert.match(bridgeSource, /GetWindow\(child, GW_HWNDNEXT\)/u);
  assert.doesNotMatch(bridgeSource, /EnumChildWindows\(state->host/u);
});

test('FBro beginner browser keeps every navigation control DPI aligned while resizing', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '..', '..', 'src', 'fbro', 'MainWindow.lcpp'), 'utf8');
  assert.match(source, /局部 整数型 当前DPI = 窗口_取事件DPI\(\)/u);
  for (const name of ['后退按钮', '前进按钮', '刷新按钮', '地址栏', '导航按钮', 'FBro指纹浏览器1']) {
    assert.match(source, new RegExp(`控件_设置位置大小\\(${name}`, 'u'));
  }
  assert.match(source, /50 \* 当前DPI \/ 96/u);
});

test('FBro bridge reports invalid VIP authorization without exposing the supplied key', async () => {
  const bridgeSource = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  assert.match(bridgeSource, /FBroHsOnlineLicenseControl_GetError/u);
  assert.match(bridgeSource, /FBro VIP 授权码校验失败/u);
  assert.match(bridgeSource, /RedactLicenseCredential\(/u);
  assert.match(bridgeSource, /error\.replace\(position, supplied\.size\(\), L"\[已隐藏\]"\)/u);
  assert.match(bridgeSource, /SecureZeroMemory\(vip_key/u);
  assert.match(bridgeSource, /SecureZeroMemory\(authorization_code/u);
  assert.match(bridgeSource, /SecureZeroMemory\(credential\.data\(\), credential\.size\(\) \* sizeof\(wchar_t\)\)/u);
  assert.match(bridgeSource, /SecureClearPendingLicenseCredential\(\)/u);
  assert.match(bridgeSource, /StopContinuationTimerThread\(\)/u);
  assert.match(bridgeSource, /if \(!had_live_browsers\) FBroQuitMessageLoop\(\)/u);
  assert.match(bridgeSource, /FBroShutdown\(FALSE\)/u);
});

test('FBro SDK discovery resolves the workspace above deeply nested build configurations', () => {
  const workspace = path.resolve('C:/workspace/lingbuilder');
  const buildDir = path.join(workspace, '.lingbuilder-build', 'fbro', 'x64', 'Debug');
  assert.equal(inferWorkspaceRootFromBuildDir(buildDir), workspace);
});

test('未启用 FBro 的公共 Win32 运行时仍具备自包含的事件 fallback 类型', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出("普通窗口")\n    结束\n结束类',
    enabledModules: []
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /#define LINGBUILDER_FBRO_AVAILABLE 0/u);
  assert.match(cpp, /using LB_FBRO_CONTINUATION_HANDLE = unsigned long long;/u);
  assert.match(cpp, /LB_FBRO_EVENT_CREATED = 1/u);
  assert.match(cpp, /LB_FBRO_EVENT_DRAG_ENTER = 9/u);
});

test('FBro native dependency materializer preserves directories and only repairs changed files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-fbro-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, 'sdk');
  const runtimeFiles = new Map([
    ['libcef.dll', Buffer.from('cef-runtime')],
    ['locales/zh-CN.pak', Buffer.from('zh-cn-runtime')]
  ]);
  const fbroV3Header = [
    '#pragma once',
    '#define LB_FBRO_ABI_VERSION_V3 0x00030000u',
    'typedef unsigned long long LB_FBRO_CONTINUATION_HANDLE;',
    'typedef struct LB_FBRO_EVENT_PACKET_V3 {} LB_FBRO_EVENT_PACKET_V3;',
    'typedef struct LB_FBRO_EVENT_RESPONSE_V3 {} LB_FBRO_EVENT_RESPONSE_V3;',
    'void LB_FBro_SetEventCallbackV3();',
    'void LB_FBro_SetEventSubscription();',
    'void LB_FBro_CompleteEventContinuation();',
    'void LB_FBro_CancelEventContinuation();',
    'void LB_FBro_CreateEx2();',
    'void LB_FBro_CookieSetJsonAsync();'
  ].join('\n');
  await writeFixture(path.join(sdk, 'include', 'LingBuilderFbroBridge.h'), `${fbroV3Header}\n`);
  await writeFixture(path.join(sdk, 'include', 'LingBuilderFbroProcessRuntime.hpp'), '#pragma once\n');
  await writeFixture(path.join(sdk, 'include', 'nlohmann', 'json.hpp'), '#pragma once\n');
  await writeFixture(path.join(sdk, 'include', 'nlohmann', 'LICENSE.MIT'), 'MIT License\n');
  await writeFixture(path.join(sdk, 'lib', 'x64', 'LingBuilderFbroBridge.lib'), 'bridge-lib');
  await writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderFbroBridge.dll'), 'bridge-dll');
  const files = [];
  for (const [relative, content] of runtimeFiles) {
    const target = path.join(sdk, 'runtime', 'x64', ...relative.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    files.push({ path: relative, size: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') });
  }
  await fs.writeFile(path.join(sdk, 'runtime-manifest.json'), JSON.stringify({
    schemaVersion: 1, sdkVersion: '135.0.21', architecture: 'x64', bridgeVersion: '2.9.0', files
  }), 'utf8');
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.fbro.browser', isBuiltin: true, isInstalled: true, diagnostics: [] };
  const previous = process.env.FBRO_SDK_ROOT;
  process.env.FBRO_SDK_ROOT = sdk;
  try {
    const layout = {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'),
      preferredTargetId: 'windows-msvc-x64'
    };
    const first = await materializeModuleNativeDependencies([module], layout);
    assert.deepEqual(first.diagnostics, []);
    assert.equal((await fs.readFile(path.join(layout.binDir, 'locales', 'zh-CN.pak'))).toString(), 'zh-cn-runtime');
    assert.equal((await fs.readFile(path.join(layout.exportDir, 'modules', 'lingbuilder.fbro.browser', 'runtime', 'x64', 'locales', 'zh-CN.pak'))).toString(), 'zh-cn-runtime');
    assert.ok(await exists(path.join(layout.buildDir, 'modules', 'lingbuilder.fbro.browser', 'materialize-fbro-runtime.ps1')));
    assert.ok(await exists(path.join(layout.exportDir, 'modules', 'lingbuilder.fbro.browser', 'materialize-fbro-runtime.ps1')));
    const cefPath = path.join(layout.binDir, 'libcef.dll');
    const firstMtime = (await fs.stat(cefPath)).mtimeMs;
    await new Promise(resolve => setTimeout(resolve, 25));
    const second = await materializeModuleNativeDependencies([module], layout);
    assert.deepEqual(second.diagnostics, []);
    assert.equal((await fs.stat(cefPath)).mtimeMs, firstMtime);
    await fs.writeFile(cefPath, 'broken-runtime');
    const repaired = await materializeModuleNativeDependencies([module], layout);
    assert.deepEqual(repaired.diagnostics, []);
    assert.equal((await fs.readFile(cefPath)).toString(), 'cef-runtime');
    assert.ok(await exists(path.join(layout.binDir, '.lingbuilder-fbro-runtime.json')));
    await fs.writeFile(path.join(sdk, 'include', 'LingBuilderFbroBridge.h'), '#pragma once\n', 'utf8');
    const staleBridge = await materializeModuleNativeDependencies([module], layout);
    assert.match(staleBridge.blockingDiagnostics.join('\n'), /不是完整 C ABI v3.*LB_FBRO_ABI_VERSION_V3/u);
  } finally {
    if (previous === undefined) delete process.env.FBRO_SDK_ROOT;
    else process.env.FBRO_SDK_ROOT = previous;
  }
});

test('FBro 与 CEF3 仅阻断进程内控件，独立进程共存时隔离两套 CEF 运行时', async () => {
  const ids = ['lingbuilder.fbro.browser', 'lingbuilder.cef3.browser'];
  const modules = ids.map(id => {
    const manifest = BUILTIN_MODULES.find(item => item.id === id);
    assert.ok(manifest);
    return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, diagnostics: [] } as InstalledModule;
  });
  const projectWithMode = (processMode: 'in-process' | 'independent-embedded' | 'independent-window'): LingWindowProject => ({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: `fbro-${processMode}`,
        type: 'FBroBrowser',
        name: 'FBro浏览器1',
        content: '',
        x: 10,
        y: 10,
        width: 320,
        height: 200,
        background: '#ffffff',
        foreground: '#000000',
        fontSize: 14,
        isEnabled: true,
        visibility: 'Visible',
        properties: { processMode, url: 'about:blank' }
      }]
    }]
  });
  const inProcess = generateLingCppNativeWin32Project(projectWithMode('in-process'), { enabledModules: modules });
  assert.match(inProcess.blockingDiagnostics.join('\n'), /进程内模式.*CEF 135\/150/u);
  for (const mode of ['independent-embedded', 'independent-window'] as const) {
    const isolated = generateLingCppNativeWin32Project(projectWithMode(mode), { enabledModules: modules });
    assert.doesNotMatch(isolated.blockingDiagnostics.join('\n'), /CEF 135\/150/u);
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-fbro-conflict-'));
  const fbroSdk = path.join(root, 'fbro-sdk');
  const cef3Sdk = path.join(root, 'cef3-sdk');
  const fbroHeader = [
    '#pragma once',
    '#define LB_FBRO_ABI_VERSION_V3 0x00030000u',
    'typedef unsigned long long LB_FBRO_CONTINUATION_HANDLE;',
    'typedef struct LB_FBRO_EVENT_PACKET_V3 {} LB_FBRO_EVENT_PACKET_V3;',
    'typedef struct LB_FBRO_EVENT_RESPONSE_V3 {} LB_FBRO_EVENT_RESPONSE_V3;',
    'void LB_FBro_SetEventCallbackV3();',
    'void LB_FBro_SetEventSubscription();',
    'void LB_FBro_CompleteEventContinuation();',
    'void LB_FBro_CancelEventContinuation();',
    'void LB_FBro_CreateEx2();',
    'void LB_FBro_CookieSetJsonAsync();'
  ].join('\n');
  const fbroCef = Buffer.from('fbro-cef-135');
  const fbroFiles = [{
    path: 'libcef.dll',
    size: fbroCef.length,
    sha256: crypto.createHash('sha256').update(fbroCef).digest('hex')
  }];
  await Promise.all([
    writeFixture(path.join(fbroSdk, 'include', 'LingBuilderFbroBridge.h'), `${fbroHeader}\n`),
    writeFixture(path.join(fbroSdk, 'include', 'LingBuilderFbroProcessRuntime.hpp'), '#pragma once\n'),
    writeFixture(path.join(fbroSdk, 'include', 'nlohmann', 'json.hpp'), '#pragma once\n'),
    writeFixture(path.join(fbroSdk, 'include', 'nlohmann', 'LICENSE.MIT'), 'MIT License\n'),
    writeFixture(path.join(fbroSdk, 'lib', 'x64', 'LingBuilderFbroBridge.lib'), 'fbro-bridge-lib'),
    writeFixture(path.join(fbroSdk, 'bridge', 'x64', 'LingBuilderFbroBridge.dll'), 'fbro-bridge-dll'),
    writeFixture(path.join(fbroSdk, 'runtime', 'x64', 'libcef.dll'), fbroCef.toString()),
    writeFixture(path.join(fbroSdk, 'runtime-manifest.json'), JSON.stringify({
      schemaVersion: 1,
      sdkVersion: '135.0.21',
      architecture: 'x64',
      bridgeVersion: '2.9.0',
      files: fbroFiles
    })),
    writeFixture(path.join(cef3Sdk, 'include', 'cef_app.h'), '#pragma once\n'),
    writeFixture(path.join(cef3Sdk, 'bridge', 'x64', 'LingBuilderCefBridge.h'), '#pragma once\nint LB_CEF3_ResourceResponseBodyBegin();\n'),
    writeFixture(path.join(cef3Sdk, 'bridge', 'x64', 'LingBuilderCefBridge.lib'), 'cef3-bridge-lib'),
    writeFixture(path.join(cef3Sdk, 'bridge', 'x64', 'LingBuilderCefBridge.dll'), 'cef3-bridge-dll'),
    writeFixture(path.join(cef3Sdk, 'bin', 'x64', 'libcef.dll'), 'cef3-cef-150'),
    writeFixture(path.join(cef3Sdk, 'bin', 'x64', 'chrome_elf.dll'), 'cef3-chrome-elf'),
    writeFixture(path.join(cef3Sdk, 'bin', 'x64', 'v8_context_snapshot.bin'), 'cef3-v8-snapshot')
  ]);
  const previousFbroSdk = process.env.FBRO_SDK_ROOT;
  const previousCef3Sdk = process.env.CEF3_SDK_ROOT;
  process.env.FBRO_SDK_ROOT = fbroSdk;
  process.env.CEF3_SDK_ROOT = cef3Sdk;
  try {
    await fs.mkdir(path.join(root, 'bin'), { recursive: true });
    const plan = await materializeModuleNativeDependencies(modules, {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    });
    assert.deepEqual(plan.blockingDiagnostics, []);
    assert.deepEqual(plan.diagnostics, []);
    assert.equal(await fs.readFile(path.join(root, 'bin', 'libcef.dll'), 'utf8'), 'cef3-cef-150');
    assert.equal(await fs.readFile(path.join(root, 'bin', 'fbro-host', 'libcef.dll'), 'utf8'), 'fbro-cef-135');
    assert.equal(await exists(path.join(root, 'bin', 'LingBuilderFbroBridge.dll')), false);
    assert.equal(await fs.readFile(path.join(root, 'bin', 'fbro-host', 'LingBuilderFbroBridge.dll'), 'utf8'), 'fbro-bridge-dll');
  } finally {
    if (previousFbroSdk === undefined) delete process.env.FBRO_SDK_ROOT;
    else process.env.FBRO_SDK_ROOT = previousFbroSdk;
    if (previousCef3Sdk === undefined) delete process.env.CEF3_SDK_ROOT;
    else process.env.CEF3_SDK_ROOT = previousCef3Sdk;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OpenCV SDK materializer validates hashes and materializes x64 Bridge assets', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-opencv-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, 'sdk');
  const fixtureFiles = new Map<string, Buffer>([
    ['include/LingBuilderOpenCvBridge.h', Buffer.from('#pragma once\n')],
    ['lib/x64/LingBuilderOpenCvBridge.lib', Buffer.from('bridge-lib')],
    ['bin/x64/LingBuilderOpenCvBridge.dll', Buffer.from('bridge-dll')],
    ['bin/x64/opencv_core4140.dll', Buffer.from('core-dll')],
    ['bin/x64/opencv_imgproc4140.dll', Buffer.from('imgproc-dll')],
    ['bin/x64/opencv_imgcodecs4140.dll', Buffer.from('imgcodecs-dll')]
  ]);
  const files = [];
  for (const [relative, content] of fixtureFiles) {
    const target = path.join(sdk, ...relative.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    files.push({ path: relative, size: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') });
  }
  await fs.writeFile(path.join(sdk, 'runtime-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    opencvVersion: '4.14.0',
    bridgeVersion: '1.0.0',
    bridgeAbiVersion: 1,
    architecture: 'x64',
    toolset: 'msvc-v143',
    runtimeLibrary: 'MD',
    files
  }), 'utf8');
  const manifest = BUILTIN_MODULES.find(item => item.id === OPENCV_MODULE_ID)!;
  const module: InstalledModule = { manifest, installPath: `builtin://${OPENCV_MODULE_ID}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const previous = process.env.LINGBUILDER_OPENCV_SDK_ROOT;
  process.env.LINGBUILDER_OPENCV_SDK_ROOT = sdk;
  try {
    const layout = {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    };
    const plan = await materializeModuleNativeDependencies([module], layout);
    assert.deepEqual(plan.blockingDiagnostics, []);
    assert.equal(plan.requiresDynamicCrt, true);
    assert.ok(plan.includeDirs.some(item => item.endsWith(path.join(OPENCV_SDK_MODULE_ID, 'include'))));
    assert.ok(plan.libFiles.some(item => item.endsWith('LingBuilderOpenCvBridge.lib')));
    for (const name of ['LingBuilderOpenCvBridge.dll', 'opencv_core4140.dll', 'opencv_imgproc4140.dll', 'opencv_imgcodecs4140.dll']) {
      assert.ok(await exists(path.join(layout.binDir, name)), `缺少运行时 ${name}`);
    }
    await fs.writeFile(path.join(sdk, 'bin', 'x64', 'opencv_core4140.dll'), 'broken');
    const damaged = await materializeModuleNativeDependencies([module], layout);
    assert.match(damaged.blockingDiagnostics.join('\n'), /哈希不一致/u);
    const win32 = await materializeModuleNativeDependencies([module], { ...layout, preferredTargetId: 'windows-msvc-win32' });
    assert.match(win32.blockingDiagnostics.join('\n'), /仅支持.*x64/u);
  } finally {
    if (previous === undefined) delete process.env.LINGBUILDER_OPENCV_SDK_ROOT;
    else process.env.LINGBUILDER_OPENCV_SDK_ROOT = previous;
  }
});

test('generated new_emoji bridge completions match binding parameter counts', async () => {
  const manifestPath = path.join(process.cwd(), '..', '.lingbuilder', 'module-build', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(manifest.contributes.designerControls.length, 93);
  const runtimeControls = manifest.contributes.designerControls.filter((control: any) => control.runtimeControl);
  assert.equal(runtimeControls.length, 93);
  assert.equal(new Set(runtimeControls.map((control: any) => control.runtimeControl.lingCppType)).size, 93);
  assert.equal(runtimeControls.filter((control: any) => control.runtimeControl.createCommand).length, 93);
  assert.equal(runtimeControls.filter((control: any) => control.runtimeControl.lookupByTagTextCommand).length, 93);
  assert.equal(runtimeControls.filter((control: any) => control.runtimeControl.lookupByTagIntegerCommand).length, 93);
  const runtimeEventCount = runtimeControls.reduce((count: number, control: any) => count + (control.runtime?.eventBindings?.length || 0), 0);
  // 基线 2026-09-15 写回（第三批）：Tabs 新增 ItemAdded（新增标签页）、ItemsReordered（拖拽重排）
  // 事件绑定，事件绑定 921→923；同批新增 NE标签页_ 运行时操作族/浏览器模式族 21 条宽字符桥接命令
  // 与逐项「禁用」字段随 EU_SetTabsItemsEx 高阶协议传入原生。
  assert.equal(runtimeEventCount, 923);
  assert.equal(manifest.contributes.commands.filter((command: any) => /_绑定/u.test(command.name)).length, 923);
  assert.equal(manifest.contributes.commands.filter((command: any) => /_解绑/u.test(command.name)).length, 923);
  const handlerBindings = manifest.bindings.commands.filter((binding: any) => binding.parameters?.some((parameter: any) => parameter.type === 'handler'));
  assert.equal(handlerBindings.filter((binding: any) => /_绑定/u.test(binding.command)).length, 923);
  assert.equal(handlerBindings.filter((binding: any) => !/_绑定/u.test(binding.command)).length, 92);
  const buttonCommand = manifest.bindings.commands.find((binding: any) => binding.command === 'NE_EU_SetButtonStateColors');
  assert.deepEqual(buttonCommand.parameters[1], {
    name: 'element_id',
    type: 'controlRef',
    controlTypes: ['lingbuilder.new_emoji.ui/Button'],
    controlKinds: ['visual'],
    scope: 'currentWindow',
    runtimeRepresentation: 'stableId'
  });
  const tourTargetCommand = manifest.bindings.commands.find((binding: any) => binding.command === 'NE_EU_SetTourTargetElement');
  assert.equal(tourTargetCommand.parameters[1].type, 'controlRef');
  assert.deepEqual(tourTargetCommand.parameters[1].controlTypes, ['lingbuilder.new_emoji.ui/Tour']);
  assert.equal(tourTargetCommand.parameters[2].type, 'controlRef');
  const dialogGetter = manifest.bindings.commands.find((binding: any) => binding.command === 'NE_EU_GetDialogAdvancedOptions');
  assert.equal(dialogGetter.parameters.find((parameter: any) => parameter.name === 'content_parent_id').type, 'int');
  assert.equal(dialogGetter.parameters.find((parameter: any) => parameter.name === 'footer_parent_id').type, 'int');
  const autocompleteGetter = manifest.bindings.commands.find((binding: any) => binding.command === 'NE_EU_GetAutocompleteOptions');
  assert.equal(autocompleteGetter.parameters.find((parameter: any) => parameter.name === 'request_id').type, 'int');
  const previewSelection = manifest.bindings.commands.find((binding: any) => binding.command === 'NE_EU_PreviewSetSelection');
  assert.equal(previewSelection.parameters.find((parameter: any) => parameter.name === 'ids').type, 'int');
  assert.equal(previewSelection.parameters.find((parameter: any) => parameter.name === 'primary_id').type, 'controlRef');
  for (const control of runtimeControls) {
    const contract = control.runtimeControl;
    assert.ok(manifest.bindings.commands.some((binding: any) => binding.command === contract.createCommand));
    assert.ok(manifest.bindings.commands.some((binding: any) => binding.command === contract.lookupByTagTextCommand));
    assert.ok(manifest.bindings.commands.some((binding: any) => binding.command === contract.lookupByTagIntegerCommand));
  }
  assert.equal(manifest.contributes.commands.filter((command: { visibility?: string }) => command.visibility === 'advanced').length, 1618);
  assert.ok(manifest.contributes.designerControls.every((control: any) => (
    control.namespacedType?.startsWith('lingbuilder.new_emoji.ui/')
    && control.backend === 'new-emoji'
    && control.runtime?.createCommand
    && Array.isArray(control.runtime?.createParameters)
  )));
  assert.ok(manifest.contributes.designerControls.every((control: any) => (
    control.properties.every((property: any) => Boolean(property.runtimeCommand))
    && control.events.every((event: any) => Boolean(event.runtimeCommand))
  )), 'new_emoji 所有目录属性和事件都必须具有真实运行时映射');
  const installedModule: InstalledModule = {
    manifest,
    installPath: path.dirname(manifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const wrongTypeSource = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 NE编辑框 输入框 = 通过标记文本获取NE编辑框("输入")',
    '        NE_EU_SetButtonStateColors(0, 输入框, 0, 0, 0, 0, 0, 0)',
    '    结束',
    '结束类'
  ].join('\n');
  const wrongTypeDiagnostics = getLingCppControlReferenceDiagnostics(
    wrongTypeSource,
    sampleProject,
    { enabledModules: [installedModule], availableModules: [installedModule] },
    'src/MainWindow.lcpp'
  );
  assert.ok(wrongTypeDiagnostics.some(item => item.id.startsWith('lingcpp-control-reference-type-') && item.message.includes('NE编辑框')));
  const buttonContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Button');
  const tableContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Table');
  const listBoxContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'ListBox');
  const richListContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'RichList');
  const tabsContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Tabs');
  const tableEvent = (name: string) => tableContribution.events.find((event: { name: string }) => event.name === name);
  const listBoxEvent = (name: string) => listBoxContribution.events.find((event: { name: string }) => event.name === name);
  const richListEvent = (name: string) => richListContribution.events.find((event: { name: string }) => event.name === name);
  assert.deepEqual(tableEvent('CellClicked').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['行号', 'int'], ['列号', 'int']
  ]);
  assert.deepEqual(tableEvent('CellAction').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['行号', 'int'], ['列号', 'int'], ['动作', 'int'], ['值', 'int']
  ]);
  assert.deepEqual(tableEvent('CellEdit').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['行号', 'int'], ['列号', 'int'], ['动作', 'int'], ['文本', 'wideString']
  ]);
  assert.deepEqual(tableEvent('ContextMenu').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['行号', 'int'], ['列号', 'int'], ['区域', 'int'], ['横坐标', 'int'], ['纵坐标', 'int']
  ]);
  assert.deepEqual(tableEvent('VirtualRow').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [['行号', 'int']]);
  assert.deepEqual(tableEvent('VirtualRow').starterStatements, ['NE_设置表格虚拟行数据("")']);
  assert.deepEqual(listBoxEvent('SelectionChanged').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['选中键列表', 'wideString']
  ]);
  assert.deepEqual(listBoxEvent('ItemClicked').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['项目索引', 'int'], ['起始位置', 'int'], ['结束位置', 'int']
  ]);
  assert.deepEqual(listBoxEvent('ItemDoubleClicked').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['项目索引', 'int'], ['触发方式', 'int'], ['附加值', 'int']
  ]);
  assert.deepEqual(listBoxEvent('Edit').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['项目索引', 'int'], ['编辑字段', 'int'], ['动作', 'int'], ['文本', 'wideString']
  ]);
  assert.deepEqual(listBoxEvent('Reorder').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['原索引', 'int'], ['新索引', 'int'], ['数量', 'int']
  ]);
  assert.deepEqual(listBoxEvent('ContextMenu').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['项目索引', 'int'], ['横坐标', 'int'], ['纵坐标', 'int']
  ]);
  for (const eventName of ['MouseEnter', 'MouseLeave', 'GotFocus', 'LostFocus']) {
    assert.deepEqual(listBoxEvent(eventName).parameters, [], `ListBox.${eventName} 不应伪造额外参数`);
  }
  assert.deepEqual(listBoxEvent('MouseDown').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['横坐标', 'int'], ['纵坐标', 'int'], ['鼠标按钮', 'int']
  ]);
  assert.deepEqual(listBoxEvent('MouseMove').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['横坐标', 'int'], ['纵坐标', 'int']
  ]);
  assert.deepEqual(listBoxEvent('MouseWheel').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['横坐标', 'int'], ['纵坐标', 'int'], ['滚轮增量', 'int']
  ]);
  assert.deepEqual(tableEvent('MouseDown').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['横坐标', 'int'], ['纵坐标', 'int'], ['鼠标按钮', 'int']
  ]);
  assert.equal(richListContribution.previewType, 'ListView');
  assert.equal(richListContribution.namespacedType, 'lingbuilder.new_emoji.ui/RichList');
  assert.deepEqual(richListEvent('SelectionChanged').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
    ['选中键列表', 'wideString']
  ]);
  for (const eventName of ['ItemClicked', 'ItemDoubleClicked', 'ButtonClicked', 'BadgeClicked', 'CountdownEnd', 'ContextMenu']) {
    assert.deepEqual(richListEvent(eventName).parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [
      ['事件数据', 'wideString']
    ]);
  }
  assert.deepEqual(
    richListContribution.runtime.createParameters
      .filter((parameter: { name: string }) => ['template_bytes', 'template_len', 'items_bytes', 'items_len'].includes(parameter.name))
      .map((parameter: { name: string; propertyKey?: string }) => [parameter.name, parameter.propertyKey]),
    [
      ['template_bytes', 'templateJson'], ['template_len', 'templateJson'],
      ['items_bytes', 'itemsJson'], ['items_len', 'itemsJson']
    ]
  );
  const richListSetter = (command: string) => richListContribution.runtime.propertySetters.find((setter: { command: string }) => setter.command === command);
  assert.deepEqual(richListSetter('EU_SetRichListTemplate').propertyKeys, ['templateJson']);
  assert.deepEqual(richListSetter('EU_SetRichListItems').propertyKeys, ['itemsJson']);
  assert.deepEqual(richListSetter('EU_SetRichListSelectedKeys').propertyKeys, ['selectedKeys']);
  assert.ok(manifest.contributes.docs.some((document: { path: string }) => document.path === 'docs/rich-list.md'));
  const virtualRowDataBinding = manifest.bindings.commands.find((binding: { command: string }) => binding.command === 'NE_设置表格虚拟行数据');
  assert.deepEqual(virtualRowDataBinding.parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [['行数据', 'wideString']]);
  assert.equal(tabsContribution.previewType, 'TabControl');
  assert.equal(tabsContribution.isContainer, true);
  assert.deepEqual(tabsContribution.layout, {
    mode: 'slots',
    coordinateSpace: 'window',
    adapterId: 'new-emoji.tabs.pages'
  });
  assert.deepEqual(tabsContribution.defaultProps.items, [{
    id: 'page1',
    title: '标签页 1',
    icon: '',
    closable: true,
    disabled: false,
    pinned: false,
    loading: false,
    muted: false,
    alerting: false
  }]);
  assert.equal(tabsContribution.defaultProps.headerVisible, true);
  const headerVisibleProperty = tabsContribution.properties.find((property: { key: string }) => property.key === 'headerVisible');
  assert.ok(headerVisibleProperty);
  assert.equal(headerVisibleProperty.label, '显示标签页表头');
  assert.equal(headerVisibleProperty.type, 'boolean');
  assert.equal(headerVisibleProperty.defaultValue, true);
  assert.equal(headerVisibleProperty.runtimeCommand, 'EU_SetTabsHeaderVisible');
  const headerVisibleSetter = tabsContribution.runtime.propertySetters.find((setter: { command: string }) => setter.command === 'EU_SetTabsHeaderVisible');
  assert.ok(headerVisibleSetter);
  assert.equal(headerVisibleSetter.parameters.find((parameter: { name: string }) => parameter.name === 'visible')?.propertyKey, 'headerVisible');
  assert.equal(tabsContribution.defaultProps.contentVisible, true);
  const generated = generateLingCppNativeWin32Project({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      designerBackend: 'new-emoji',
      controls: [
        {
          id: 'button', type: buttonContribution.previewType, designerType: buttonContribution.namespacedType,
          name: '按钮1', content: '确定', x: 20, y: 20, width: 140, height: 42,
          fontSize: 14, background: '#FF303133', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: { ...buttonContribution.defaultProps, hoverBackgroundColor: '#FF409EFF' },
          events: { Click: '_按钮1_被单击', MouseEnter: '按钮1_鼠标进入' }
        },
        {
          id: 'table', type: tableContribution.previewType, designerType: tableContribution.namespacedType,
          name: '表格1', content: '表格', x: 20, y: 80, width: 420, height: 220,
          fontSize: 14, background: '#FF202020', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: { ...tableContribution.defaultProps, tableColumnAligns: 'col=0\theader=center\tcell=right' },
          events: {
            CellClicked: '_表格1_单元格点击',
            CellAction: '_表格1_单元格动作',
            CellEdit: '_表格1_单元格编辑',
            ContextMenu: '_表格1_表格右键菜单',
            VirtualRow: '_表格1_虚拟行数据源',
            MouseDown: '_表格1_鼠标按下'
          }
        },
        {
          id: 'tabs', type: tabsContribution.previewType, designerType: tabsContribution.namespacedType,
          name: '功能标签页', content: '标签页', x: 20, y: 320, width: 420, height: 180,
          fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: {
            ...tabsContribution.defaultProps,
            tabs: [{ id: 'overview', title: '概览' }, { id: 'settings', title: '设置' }],
            items: ['概览', '设置'], activeIndex: 0, headerVisible: false, contentVisible: false
          },
          events: {}
        },
        {
          id: 'overview-button', parentId: 'tabs', containerSlot: 'overview',
          type: buttonContribution.previewType, designerType: buttonContribution.namespacedType,
          name: '概览按钮', content: '概览操作', x: 40, y: 390, width: 140, height: 42,
          fontSize: 14, background: '#FF303133', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: { ...buttonContribution.defaultProps }, events: {}
        },
        {
          id: 'settings-button', parentId: 'tabs', containerSlot: 'settings',
          type: buttonContribution.previewType, designerType: buttonContribution.namespacedType,
          name: '设置按钮', content: '设置操作', x: 40, y: 390, width: 140, height: 42,
          fontSize: 14, background: '#FF303133', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: { ...buttonContribution.defaultProps }, events: {}
        },
        {
          id: 'rich-list', type: richListContribution.previewType, designerType: richListContribution.namespacedType,
          name: '富列表1', content: '富列表', x: 470, y: 20, width: 420, height: 280,
          fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: {
            ...richListContribution.defaultProps,
            title: '任务队列',
            templateJson: ['{"template":{"rowHeight":72,"nodes":[]}}'],
            itemsJson: ['{"items":[{"key":"task-1","data":{"title":"构建 IDE"}}]}'],
            selectedKeys: ['["task-1"]'],
            selectionMode: '1', rowHeight: 72, scrollY: 8, virtualItemCount: 20
          },
          events: {
            SelectionChanged: '_富列表1_选择变化',
            ItemClicked: '_富列表1_项目点击',
            ButtonClicked: '_富列表1_按钮点击',
            ContextMenu: '_富列表1_项目右键菜单'
          }
        }
      ]
    }]
  }, {
    enabledModules: [installedModule],
    lingCppSourceCode: [
      '包 测试',
      '类 MainWindow : 窗口',
      '公开',
      '  事件 _按钮1_被单击()',
      '    信息框("按钮", 64, "事件触发")',
      '    调试输出("点击")',
      '  结束',
      '  事件 按钮1_鼠标进入()',
      '    调试输出("进入")',
      '  结束',
      '  事件 _表格1_单元格点击(整数型 行号, 整数型 列号)',
      '    调试输出(行号, 列号)',
      '  结束',
      '  事件 _表格1_单元格动作(整数型 行号, 整数型 列号, 整数型 动作, 整数型 值)',
      '    调试输出(动作, 值)',
      '  结束',
      '  事件 _表格1_单元格编辑(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)',
      '    调试输出(文本)',
      '  结束',
      '  事件 _表格1_表格右键菜单(整数型 行号, 整数型 列号, 整数型 区域, 整数型 横坐标, 整数型 纵坐标)',
      '    调试输出(区域, 横坐标, 纵坐标)',
      '  结束',
      '  事件 _表格1_虚拟行数据源(整数型 行号)',
      '    NE_设置表格虚拟行数据("key=virtual\\tcells=虚拟行")',
      '  结束',
      '  事件 _表格1_鼠标按下(整数型 横坐标, 整数型 纵坐标, 整数型 鼠标按钮)',
      '    调试输出(横坐标, 纵坐标, 鼠标按钮)',
      '  结束',
      '  事件 _富列表1_选择变化(文本型 选中键列表)',
      '    调试输出(选中键列表)',
      '  结束',
      '  事件 _富列表1_项目点击(文本型 事件数据)',
      '    调试输出(事件数据)',
      '  结束',
      '  事件 _富列表1_按钮点击(文本型 事件数据)',
      '    调试输出(事件数据)',
      '  结束',
      '  事件 _富列表1_项目右键菜单(文本型 事件数据)',
      '    调试输出(事件数据)',
      '  结束',
      '结束类'
    ].join('\n')
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /EU_SetButtonStateColors\(/u);
  assert.match(cpp, /static void __stdcall LB_NE_Event_[^(]+\(int lb_element_id\)[\s\S]*信息框\(L"按钮", MB_OK \| MB_ICONINFORMATION, L"事件触发"\)/u);
  assert.match(cpp, /EU_SetElementClickCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetElementMouseCallback\(/u);
  assert.match(cpp, /std::printf\("\[调试输出\] %s\\n", utf8\.data\(\)\);/u);
  assert.match(cpp, /std::fflush\(stdout\);/u);
  assert.match(cpp, /int 行号 = lb_row;\s+int 列号 = lb_col;/u);
  assert.match(cpp, /std::wstring 文本 = LB_NE_FromUtf8\(lb_utf8, lb_utf8_length\);/u);
  assert.match(cpp, /int 横坐标 = lb_x;\s+int 纵坐标 = lb_y;\s+int 鼠标按钮 = lb_data;/u);
  assert.match(cpp, /NE_清空表格虚拟行数据\(\);[\s\S]*NE_设置表格虚拟行数据\(L"key=virtual\\tcells=虚拟行"\);/u);
  assert.match(cpp, /lb_cache_pending = true;[\s\S]*std::memcpy\(lb_buffer, lb_cached_utf8\.data\(\)/u);
  assert.match(cpp, /EU_SetTableVirtualRowProvider\(g_newEmojiWindow, ne_element_2, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetTableColumnAlign\(g_newEmojiWindow/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"概览\|设置"\)/u);
  // EU_SetTabsItemsEx 高阶协议 6 字段：标题\tID\t内容\t图标\t禁用\t可关闭。
  assert.match(cpp, /LB_NE_ToUtf8\(L"概览\\toverview\\t \\t\\t0\\t1\|设置\\tsettings\\t \\t\\t0\\t1"\)/u);
  assert.match(cpp, /EU_CreateTabs\(g_newEmojiWindow/u);
  assert.match(cpp, /EU_SetTabsHeaderVisible\(g_newEmojiWindow, ne_element_3, 0\)/u);
  assert.match(cpp, /EU_SetTabsContentVisible\(g_newEmojiWindow, ne_element_3, 1\)/u);
  assert.match(cpp, /EU_CreatePanel\(g_newEmojiWindow, 0, 20, 320, 420, 180\)/u);
  assert.match(cpp, /int ne_tab_page_3_1 = EU_CreatePanel\(/u);
  assert.match(cpp, /int ne_tab_page_3_2 = EU_CreatePanel\(/u);
  assert.match(cpp, /EU_SetPanelStyle\(g_newEmojiWindow, ne_tab_page_3_1, 0xff242941u, 0x00000000u, 0\.0f, 0\.0f, 0\)/u);
  assert.match(cpp, /EU_SetPanelStyle\(g_newEmojiWindow, ne_tab_page_3_2, 0xff242941u, 0x00000000u, 0\.0f, 0\.0f, 0\)/u);
  assert.match(cpp, /EU_SetTabsPageElements\(g_newEmojiWindow, ne_element_3,/u);
  assert.match(cpp, /EU_CreateButton\(g_newEmojiWindow, ne_tab_page_3_1,/u);
  assert.match(cpp, /EU_CreateButton\(g_newEmojiWindow, ne_tab_page_3_2,/u);
  assert.doesNotMatch(cpp, /EU_SetTabsContentVisible\(g_newEmojiWindow, ne_element_3, 0\)/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"任务队列"\)/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"\{\\"template\\":\{\\"rowHeight\\":72,\\"nodes\\":\[\]\}\}"\)/u);
  assert.match(cpp, /EU_CreateRichList\(g_newEmojiWindow, 0,/u);
  assert.match(cpp, /EU_SetRichListSelectedKeys\(g_newEmojiWindow, ne_element_6,/u);
  assert.match(cpp, /EU_SetRichListOptions\(g_newEmojiWindow, ne_element_6, 1, 1, 0, 0, 1, 1\)/u);
  assert.match(cpp, /EU_SetRichListStyle\(g_newEmojiWindow, ne_element_6, 72, 10, 6, 12, 0,/u);
  assert.match(cpp, /EU_SetRichListScroll\(g_newEmojiWindow, ne_element_6, 8\)/u);
  assert.match(cpp, /EU_SetRichListVirtualItemCount\(g_newEmojiWindow, ne_element_6, 20\)/u);
  assert.match(cpp, /std::wstring 选中键列表 = LB_NE_FromUtf8\(lb_utf8, lb_utf8_length\);/u);
  assert.match(cpp, /lb_event_json\.find\(L"\\"event\\":\\"item_click\\""\)/u);
  assert.match(cpp, /lb_event_json\.find\(L"\\"event\\":\\"button_click\\""\)/u);
  assert.match(cpp, /lb_event_json\.find\(L"\\"event\\":\\"context_menu\\""\)/u);
  assert.match(cpp, /std::wstring 事件数据 = lb_event_json;/u);
  assert.match(cpp, /EU_SetRichListChangeCallback\(g_newEmojiWindow, ne_element_6, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetRichListEventCallback\(g_newEmojiWindow, ne_element_6, LB_NE_Event_/u);
  assert.equal(generated.blockingDiagnostics.length, 0);
  const nonVirtualRichListGenerated = generateLingCppNativeWin32Project({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      designerBackend: 'new-emoji',
      controls: [{
        id: 'rich-list', type: richListContribution.previewType, designerType: richListContribution.namespacedType,
        name: '普通富列表', content: '富列表', x: 20, y: 20, width: 420, height: 280,
        fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
        properties: {
          ...richListContribution.defaultProps,
          itemsJson: ['{"items":[{"key":"task-1","data":{"title":"构建 IDE"}}]}'],
          virtualItemCount: 0
        },
        events: {}
      }]
    }]
  }, {
    enabledModules: [installedModule],
    lingCppSourceCode: '类 MainWindow\n结束类'
  });
  const nonVirtualRichListCpp = nonVirtualRichListGenerated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(nonVirtualRichListCpp, /EU_SetRichListItems\(/u);
  assert.doesNotMatch(nonVirtualRichListCpp, /EU_SetRichListVirtualItemCount\([^\n]+, 0\);/u);
  assert.equal(nonVirtualRichListGenerated.blockingDiagnostics.length, 0);
  assert.equal(manifest.designer.schemaVersion, 1);
  assert.match(manifest.designer.sha256, /^[a-f0-9]{64}$/u);
  const highLevelNames = [
    'NE_创建窗口',
    'NE_创建深色窗口',
    'NE_显示窗口',
    'NE_显示并激活窗口',
    'NE_运行消息循环',
    'NE_销毁窗口',
    'NE_创建容器',
    'NE_创建文本',
    'NE_创建按钮',
    'NE_创建编辑框',
    'NE_创建复选框',
    'NE_创建单选框',
    'NE_创建列表框',
    'NE_创建图片',
    'NE_创建进度条',
    'NE_创建上传',
    'NE_设置上传选项',
    'NE_打开上传文件选择',
    'NE_开始上传',
    'NE_清空上传文件',
    'NE_取上传文件数量',
    'NE_取最近上传选择文件',
    'NE_取最近上传动作',
    'NE_取最近上传文件索引',
    'NE_取最近上传进度值',
    'NE_设置窗口标题'
  ];
  for (const name of highLevelNames) {
    const command = manifest.contributes.commands.find((item: { name: string }) => item.name === name);
    const binding = manifest.bindings.commands.find((item: { command: string }) => item.command === name);
    assert.ok(command, `缺少命令 ${name}`);
    assert.ok(binding, `缺少 binding ${name}`);
    const placeholders = [...String(command.insertText).matchAll(/\$(\d+)/gu)].map(match => Number(match[1]));
    const parameterCount = Array.isArray(binding.parameters) ? binding.parameters.length : 0;
    assert.deepEqual(placeholders, Array.from({ length: parameterCount }, (_, index) => index + 1), `${name} 的补全占位符与参数不一致`);
    assert.equal(binding.example, command.insertText);
  }
  const runLoop = manifest.contributes.commands.find((item: { name: string }) => item.name === 'NE_运行消息循环');
  assert.equal(runLoop.insertText, 'NE_运行消息循环()');
  const uploadOptions = manifest.bindings.commands.find((item: { command: string }) => item.command === 'NE_设置上传选项');
  assert.deepEqual(
    uploadOptions.parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]),
    [
      ['窗口句柄', 'handle'], ['元素ID', 'controlRef'], ['允许多选', 'bool'], ['自动上传', 'bool'],
      ['样式', 'int'], ['显示文件列表', 'bool'], ['显示提示', 'bool'], ['显示操作', 'bool'],
      ['允许拖拽', 'bool'], ['文件数量上限', 'int'], ['单文件上限KB', 'int'], ['允许文件类型', 'wideString']
    ]
  );
});

test('new_emoji 数据桥接命令以 controlRef/宽字符声明并生成宽字符 C++ 与按名派发的消息框跳板', async () => {
  const manifestPath = path.join(process.cwd(), '..', '.lingbuilder', 'module-build', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const bindings = new Map((manifest.bindings.commands as Array<{ command: string; parameters?: Array<Record<string, unknown>> }>).map(binding => [binding.command, binding]));
  const expectedDataBridges: Array<[string, Array<[string, string, string?]>]> = [
    ['NE表格_设置列', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Table'], ['列配置', 'wideString']]],
    ['NE表格_设置行数据', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Table'], ['行数据', 'wideString']]],
    ['NE表格_添加行', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Table'], ['行数据', 'wideString']]],
    ['NE表格_插入行', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Table'], ['行号', 'int'], ['行数据', 'wideString']]],
    ['NE富列表_设置模板', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['模板JSON', 'wideString']]],
    ['NE富列表_设置条目', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['条目JSON', 'wideString']]],
    ['NE富列表_添加条目', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['条目JSON', 'wideString']]],
    ['NE富列表_设置选中键', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['选中键JSON', 'wideString']]],
    ['NE富列表_设置倒计时', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['键', 'wideString'], ['节点', 'wideString'], ['目标毫秒', 'int'], ['格式', 'wideString'], ['是否暂停', 'bool']]],
    ['NE富列表_设置倒计时状态', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/RichList'], ['键', 'wideString'], ['节点', 'wideString'], ['是否暂停', 'bool']]],
    ['NE富列表_设置虚拟行数据', [['行数据', 'wideString']]],
    ['NE菜单_设置项目', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Menu'], ['项目文本', 'wideString']]],
    ['NE菜单_设置项目图标', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Menu'], ['项目索引', 'int'], ['图标', 'wideString']]],
    ['NE菜单_设置项目快捷键', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Menu'], ['项目索引', 'int'], ['快捷键', 'wideString']]],
    ['NE菜单_设置项目元数据', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Menu'], ['图标列表', 'wideString'], ['分组列表', 'wideString'], ['链接列表', 'wideString'], ['目标列表', 'wideString'], ['命令列表', 'wideString']]],
    ['NE徽标_设置文本', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Badge'], ['文本', 'wideString']]],
    ['NE标签页_设置激活索引', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs'], ['索引', 'int']]],
    ['NE标签页_取激活索引', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs']]],
    ['NE标签页_取激活标题', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs']]],
    ['NE标签页_取项目数量', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs']]],
    ['NE标签页_添加项目', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs'], ['标题', 'wideString']]],
    ['NE标签页_关闭项目', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs'], ['索引', 'int']]],
    ['NE标签页_设置项目状态', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs'], ['索引', 'int'], ['加载中', 'bool'], ['固定', 'bool'], ['静音', 'bool'], ['提醒', 'bool']]],
    ['NE标签页_设置拖拽选项', [['控件', 'controlRef', 'lingbuilder.new_emoji.ui/Tabs'], ['允许重排', 'bool'], ['允许分离', 'bool']]],
    ['NE_设置窗口图标', [['窗口句柄', 'handle'], ['图标路径', 'wideString']]],
    ['NE_设置主题令牌', [['窗口句柄', 'handle'], ['令牌名', 'wideString'], ['颜色值', 'int']]]
  ];
  for (const [name, parameters] of expectedDataBridges) {
    const binding = bindings.get(name);
    assert.ok(binding, `缺少数据桥接 binding ${name}`);
    assert.deepEqual(
      (binding!.parameters || []).map(parameter => [parameter.name, parameter.type]),
      parameters.map(([parameterName, type]) => [parameterName, type]),
      `${name} 的参数签名不符`
    );
    if (parameters[0]?.[2]) {
      assert.deepEqual((binding!.parameters || [])[0].controlTypes, [parameters[0]![2]!], `${name} 的控件类型约束不符`);
    }
  }
  assert.deepEqual((bindings.get('NE_显示消息框')!.parameters || []).at(-1)?.handlerSignature, { parameterTypes: ['整数型', '整数型'], returnType: '空' });
  assert.deepEqual((bindings.get('NE_显示确认框')!.parameters || []).at(-1)?.handlerSignature, { parameterTypes: ['整数型', '整数型'], returnType: '空' });
  assert.deepEqual((bindings.get('NE_显示扩展消息框')!.parameters || []).at(-1)?.handlerSignature, { parameterTypes: ['整数型', '整数型', '文本型'], returnType: '空' });
  const richListContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'RichList');
  const virtualRowEvent = richListContribution.events.find((event: { name: string }) => event.name === 'VirtualRow');
  assert.ok(virtualRowEvent, 'RichList 缺少 VirtualRow 事件贡献');
  assert.equal(virtualRowEvent.label, '虚拟数据源');
  assert.deepEqual(virtualRowEvent.parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [['行号', 'int']]);
  assert.deepEqual(virtualRowEvent.starterStatements, ['NE富列表_设置虚拟行数据("")']);
  assert.equal(virtualRowEvent.runtimeCommand, 'EU_SetRichListVirtualItemProvider');

  const installedModule: InstalledModule = {
    manifest,
    installPath: path.dirname(manifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const tableContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Table');
  const menuContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Menu');
  const badgeContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Badge');
  const buildControl = (contribution: any, id: string, name: string) => ({
    id, type: contribution.previewType, designerType: contribution.namespacedType,
    name, content: name, x: 20, y: 20, width: 320, height: 180,
    fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible' as const,
    properties: { ...contribution.defaultProps }, events: {}
  });
  const tabsContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Tabs');
  assert.ok(tabsContribution, '缺少 Tabs 控件贡献');
  assert.deepEqual(
    tabsContribution.events.filter((event: { name: string }) => ['ItemClosed', 'ItemAdded', 'ItemsReordered'].includes(event.name)).map((event: { name: string; label: string }) => [event.name, event.label]),
    [['ItemClosed', '关闭标签页'], ['ItemAdded', '新增标签页'], ['ItemsReordered', '拖拽重排']]
  );
  assert.deepEqual(tabsContribution.events.find((event: { name: string }) => event.name === 'ItemAdded').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [['新项目索引', 'int']]);
  assert.deepEqual(tabsContribution.events.find((event: { name: string }) => event.name === 'ItemsReordered').parameters.map((parameter: { name: string; type: string }) => [parameter.name, parameter.type]), [['原索引', 'int'], ['新索引', 'int'], ['项目总数', 'int']]);
  const generated = generateLingCppNativeWin32Project({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      designerBackend: 'new-emoji',
      controls: [
        buildControl(tableContribution, 'table', '表格1'),
        buildControl(richListContribution, 'rich-list', '富列表1'),
        buildControl(menuContribution, 'menu', '菜单1'),
        buildControl(badgeContribution, 'badge', '徽标1'),
        {
          ...buildControl(tabsContribution, 'tabs', '标签页1'),
          events: { ItemAdded: '_标签页1_新增标签页', ItemsReordered: '_标签页1_拖拽重排' }
        }
      ]
    }]
  }, {
    enabledModules: [installedModule],
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 创建完毕()',
      '        NE表格_设置列(表格1, "列文本")',
      '        NE表格_设置行数据(表格1, "行数组文本")',
      '        NE表格_添加行(表格1, "行文本")',
      '        NE表格_插入行(表格1, 0, "行文本")',
      '        NE富列表_设置模板(富列表1, "模板文本")',
      '        NE富列表_设置条目(富列表1, "条目数组文本")',
      '        NE富列表_添加条目(富列表1, "条目文本")',
      '        NE富列表_设置选中键(富列表1, "键数组文本")',
      '        NE富列表_设置倒计时(富列表1, "item1", ".countdown", 1790000000000, "HH:mm:ss", 假)',
      '        NE富列表_设置倒计时状态(富列表1, "item1", ".countdown", 假)',
      '        NE富列表_绑定虚拟数据源(富列表1, &富列表虚拟数据)',
      '        NE菜单_设置项目(菜单1, "项目文本")',
      '        NE菜单_设置项目图标(菜单1, 0, "图标")',
      '        NE菜单_设置项目快捷键(菜单1, 1, "Ctrl+O")',
      '        NE菜单_设置项目元数据(菜单1, "", "", "", "", "命令文本")',
      '        NE徽标_设置文本(徽标1, "new")',
      '        NE标签页_设置激活索引(标签页1, 1)',
      '        NE标签页_添加项目(标签页1, "新标签页")',
      '        NE标签页_取激活标题(标签页1)',
      '        NE标签页_设置项目状态(标签页1, 1, 假, 真, 假, 真)',
      '        NE标签页_设置拖拽选项(标签页1, 真, 假)',
      '        NE_设置窗口图标(当前窗口, "图标路径")',
      '        NE_设置主题令牌(当前窗口, "panel.bg", 4288621312)',
      '        NE_显示消息框(当前窗口, "提示", "正文", "确定", &消息框已关闭)',
      '        NE_显示确认框(当前窗口, "删除", "正文", "删除", "取消", &确认框已关闭)',
      '        NE_显示扩展消息框(当前窗口, "反馈", "正文", "提交", "取消", 4, 真, 真, 假, 真, &扩展消息框已关闭)',
      '    结束',
      '    事件 富列表虚拟数据(整数型 行号)',
      '        NE富列表_设置虚拟行数据("条目文本")',
      '    结束',
      '    事件 消息框已关闭(整数型 结果编号, 整数型 结果值)',
      '        调试输出(结果值)',
      '    结束',
      '    事件 确认框已关闭(整数型 结果编号, 整数型 结果值)',
      '        调试输出(结果值)',
      '    结束',
      '    事件 扩展消息框已关闭(整数型 结果编号, 整数型 动作, 文本型 输入文本)',
      '        调试输出(动作, 输入文本)',
      '    结束',
      '    事件 _标签页1_新增标签页(整数型 新项目索引)',
      '        调试输出(新项目索引)',
      '    结束',
      '    事件 _标签页1_拖拽重排(整数型 原索引, 整数型 新索引, 整数型 项目总数)',
      '        调试输出(原索引, 新索引, 项目总数)',
      '    结束',
      '结束类'
    ].join('\n')
  });
  assert.equal(generated.blockingDiagnostics.length, 0);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // 数据桥接：调用点发宽字符，助手内经 LB_NE_ToUtf8 调原生导出。
  assert.match(cpp, /NE表格_设置行数据\(L"表格1", L"行数组文本"\);/u);
  assert.match(cpp, /static bool NE表格_设置行数据\(const wchar_t\* controlName, const std::wstring& rowsJson\)[\s\S]{0,240}EU_SetTableRowsEx\(g_newEmojiWindow, element->id,/u);
  assert.match(cpp, /NE表格_插入行\(L"表格1", 0, L"行文本"\);/u);
  assert.match(cpp, /NE富列表_设置倒计时\(L"富列表1", L"item1", L"\.countdown", 1790000000000, L"HH:mm:ss", false\);/u);
  assert.match(cpp, /NE徽标_设置文本\(L"徽标1", L"new"\);/u);
  assert.match(cpp, /static void NE徽标_设置文本\(const wchar_t\* controlName, const std::wstring& text\)[\s\S]{0,240}EU_SetBadgeValue\(g_newEmojiWindow, element->id,/u);
  assert.match(cpp, /NE菜单_设置项目\(L"菜单1", L"项目文本"\);/u);
  assert.match(cpp, /static void NE菜单_设置项目\(const wchar_t\* controlName, const std::wstring& itemsText\)[\s\S]{0,240}EU_SetMenuItems\(g_newEmojiWindow, element->id,/u);
  assert.match(cpp, /NE_设置窗口图标\(g_newEmojiWindow, L"图标路径"\);/u);
  assert.match(cpp, /NE_设置主题令牌\(g_newEmojiWindow, L"panel\.bg", 4288621312\);/u);
  // handle 参数支持 当前窗口 → g_newEmojiWindow。
  assert.match(cpp, /NE_显示确认框\(g_newEmojiWindow, L"删除", L"正文", L"删除", L"取消", L"确认框已关闭"\);/u);
  assert.match(cpp, /static int NE_显示确认框\(HWND hwnd, const std::wstring& title,[\s\S]{0,200}const wchar_t\* handlerName\)/u);
  assert.match(cpp, /EU_ShowConfirmBox\(hwnd,/u);
  assert.match(cpp, /LB_NE_FindMsgBoxResultHandler\(handlerName\)\);/u);
  // 消息框回调按 &处理器名 派发：每处理器一个静态跳板 + wcscmp 查找表。
  assert.match(cpp, /static void __stdcall LB_NE_MsgBoxResultCb_\d+\(int lb_messagebox_id, int lb_result\) \{\s+int 结果编号 = lb_messagebox_id;\s+int 结果值 = lb_result;/u);
  assert.match(cpp, /std::wcscmp\(handlerName, L"确认框已关闭"\)/u);
  assert.match(cpp, /std::wcscmp\(handlerName, L"消息框已关闭"\)/u);
  assert.match(cpp, /static void __stdcall LB_NE_MsgBoxExCb_\d+\(int lb_messagebox_id, int lb_action, const unsigned char\* lb_value_utf8, int lb_value_utf8_length\) \{\s+int 结果编号 = lb_messagebox_id;\s+int 动作 = lb_action;\s+std::wstring 输入文本 = LB_NE_FromUtf8\(lb_value_utf8, lb_value_utf8_length\);/u);
  // 富列表虚拟数据源：绑定命令注册运行时事件，跳板按两阶段缓冲区协议回填数据槽。
  assert.match(cpp, /NE富列表_绑定虚拟数据源\(LingCppControlStableId\(L"富列表1"\), L"富列表虚拟数据"\);/u);
  assert.match(cpp, /EU_SetRichListVirtualItemProvider\(g_newEmojiWindow, elementId, LB_NE_RuntimeEvent_/u);
  assert.match(cpp, /static int __stdcall LB_NE_RuntimeEvent_\d+\(int lb_element_id, int lb_index, unsigned char\* lb_buffer, int lb_buffer_size\) \{/u);
  assert.match(cpp, /NE_清空富列表虚拟行数据\(\);[\s\S]{0,600}int 行号 = lb_index;[\s\S]{0,600}NE富列表_设置虚拟行数据\(L"条目文本"\);[\s\S]{0,600}LB_NE_ToUtf8\(NE_取富列表虚拟行数据\(\)\)/u);
  // 标签页运行时命令族：宽字符调用 → 助手 → 原生导出。
  assert.match(cpp, /NE标签页_设置激活索引\(L"标签页1", 1\);/u);
  assert.match(cpp, /static int NE标签页_设置激活索引\(const wchar_t\* controlName, int index\)[\s\S]{0,200}EU_SetTabsActive\(g_newEmojiWindow, element->id, index\);/u);
  assert.match(cpp, /NE标签页_添加项目\(L"标签页1", L"新标签页"\);/u);
  assert.match(cpp, /static int NE标签页_添加项目\(const wchar_t\* controlName, const std::wstring& title\)[\s\S]{0,300}EU_AddTabsItem\(g_newEmojiWindow, element->id,/u);
  assert.match(cpp, /static std::wstring NE标签页_取激活标题\(const wchar_t\* controlName\)[\s\S]{0,260}EU_GetTabsActiveName\(g_newEmojiWindow, element->id, buffer, size\)/u);
  assert.match(cpp, /NE标签页_设置项目状态\(L"标签页1", 1, false, true, false, true\);/u);
  assert.match(cpp, /static int NE标签页_设置项目状态\(const wchar_t\* controlName, int index, int loading, int pinned, int muted, int alerting\)[\s\S]{0,240}EU_SetTabsItemChromeState\(g_newEmojiWindow, element->id, index, loading, pinned, muted, alerting\);/u);
  assert.match(cpp, /NE标签页_设置拖拽选项\(L"标签页1", true, false\);/u);
  assert.match(cpp, /EU_SetTabsDragOptions\(g_newEmojiWindow, element->id, reorderEnabled, detachEnabled\);/u);
  // 逐项「禁用/图标/可关闭」随 EU_SetTabsItemsEx 六字段高阶协议传入原生（默认项：未禁用、可关闭）。
  assert.match(cpp, /LB_NE_ToUtf8\(L"标签页 1\\tpage1\\t \\t\\t0\\t1"\)/u);
  // 新增标签页 / 拖拽重排 事件按原生回调 ABI 生成强类型参数跳板。
  assert.match(cpp, /EU_SetTabsAddCallback\(g_newEmojiWindow, ne_element_\d+, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetTabsReorderCallback\(g_newEmojiWindow, ne_element_\d+, LB_NE_Event_/u);
  assert.match(cpp, /int 新项目索引 = lb_value;/u);
  assert.match(cpp, /int 原索引 = lb_from_index;\s+int 新索引 = lb_to_index;\s+int 项目总数 = lb_count;/u);
});

test('new_emoji Tabs can host one independent FBro HWND browser on each page', async () => {
  const manifestPath = path.join(process.cwd(), '..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const newEmojiManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const tabsContribution = newEmojiManifest.contributes.designerControls.find((control: { type: string }) => control.type === 'Tabs');
  assert.ok(tabsContribution);
  const fbroManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(fbroManifest);
  const enabledModules: InstalledModule[] = [
    {
      manifest: newEmojiManifest,
      installPath: path.dirname(manifestPath),
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    },
    {
      manifest: fbroManifest,
      installPath: 'builtin://lingbuilder.fbro.browser',
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }
  ];
  const tabs = {
    id: 'browser-tabs', type: tabsContribution.previewType, designerType: tabsContribution.namespacedType,
    name: '浏览器标签页', content: '浏览器标签页', x: 12, y: 12, width: 900, height: 600,
    fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible' as const,
    properties: {
      ...tabsContribution.defaultProps,
      tabs: [
        { id: 'page1', title: '浏览器一' },
        { id: 'page2', title: '浏览器二' },
        { id: 'page3', title: '浏览器三' }
      ],
      items: ['浏览器一', '浏览器二', '浏览器三'], activeIndex: 0, contentVisible: true
    },
    events: {}
  };
  const browsers = ['page1', 'page2', 'page3'].map((slot, index) => ({
    id: `fbro-${index + 1}`, parentId: tabs.id, containerSlot: slot, type: 'FBroBrowser' as const,
    name: `FBro浏览器${index + 1}`, content: 'FBro指纹浏览器', x: 20, y: 60, width: 884, height: 540,
    fontSize: 12, background: '#FFFFFF', foreground: '#111827', isEnabled: true, visibility: 'Visible' as const,
    properties: { url: `https://example.com/?tab=${index + 1}`, cacheDir: '', enableJs: true, loadImages: true },
    events: {}
  }));
  const generated = generateLingCppNativeWin32Project({
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      designerBackend: 'new-emoji',
      width: 940,
      height: 660,
      controls: [tabs, ...browsers]
    }]
  }, {
    enabledModules,
    lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        FBro_导航(FBro浏览器1, "https://example.com")\n        调试输出("三个 FBro 标签页已创建")\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(generated.blockingDiagnostics.length, 0);
  assert.doesNotMatch(generated.diagnostics.join('\n'), /new_emoji 设计器暂不支持控件.*FBro/u);
  assert.match(cpp, /#include <LingBuilderFbroBridge\.h>/u);
  assert.equal((cpp.match(/LB_NE_RegisterFbro\(L"FBro浏览器/g) || []).length, 3);
  assert.match(cpp, /LB_NE_RegisterFbro\(L"FBro浏览器1"[\s\S]*ne_element_1, 0, 1\);/u);
  assert.match(cpp, /LB_NE_RegisterFbro\(L"FBro浏览器2"[\s\S]*ne_element_1, 1, 1\);/u);
  assert.match(cpp, /LB_NE_RegisterFbro\(L"FBro浏览器3"[\s\S]*ne_element_1, 2, 1\);/u);
  assert.match(cpp, /EU_SetTabsChangeCallback\(g_newEmojiWindow, ne_element_1, LB_NE_FbroTabs_1\)/u);
  assert.match(cpp, /LB_NE_UpdateFbroTabVisibility\(element_id, value\)/u);
  assert.match(cpp, /browser\.tabActiveIndex = tabElementId > 0 \? \(std::max\)\(0, EU_GetTabsActive/u);
  assert.match(cpp, /if \(elementId == browser\.tabElementId && activeIndex >= 0\) browser\.tabActiveIndex = activeIndex/u);
  assert.match(cpp, /packet->eventName == L"Created"[\s\S]*LB_NE_UpdateFbroTabVisibility\(browser\.tabElementId, browser\.tabActiveIndex\)/u);
  assert.match(cpp, /config\.visible = browser\.configuredVisible\s*&& \(browser\.tabElementId <= 0 \|\| browser\.tabIndex == browser\.tabActiveIndex\)/u);
  assert.match(cpp, /LingFbroProcessController::Instance\(\)\.Start\(config, false\)/u);
  assert.match(cpp, /LB_FBro_CreateEx\(browser\.host/u);
  assert.match(cpp, /FBro_导航\(L"FBro浏览器1", L"https:\/\/example\.com"\)/u);
  assert.match(cpp, /ShowWindow\(browser\.host, visible \? SW_SHOW : SW_HIDE\)/u);
  assert.match(cpp, /const UINT dpi = g_newEmojiWindow \? GetDpiForWindow\(g_newEmojiWindow\) : 96/u);
  assert.match(cpp, /scale\(y \+ titleBarLogicalHeight\)/u);
  assert.match(cpp, /if \(!dispatched && \*legacy\) LB_NE_DispatchFbroEvent/u);
  assert.match(cpp, /wWinMain[\s\S]*CoInitializeEx\([^;]+\);\s*if \(!LB_NE_InitializeFbro\(\)\)[\s\S]*g_newEmojiWindow = NE_/u);
  assert.match(cpp, /NE_显示并激活窗口\(g_newEmojiWindow\);\s*LB_NE_UpdateFbroTabVisibility\(0, -1\);/u);
  const browserGroup = createControlToolboxGroups(['FBroBrowser'], true).find(group => group.id === 'browser');
  assert.deepEqual(browserGroup?.controlTypes, ['FBroBrowser']);
});

test('new_emoji container designerControls all declare layout contributions', async () => {
  const manifestPath = path.join(process.cwd(), '..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const newEmojiManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const containers = newEmojiManifest.contributes.designerControls.filter((control: { isContainer?: boolean }) => control.isContainer === true);
  assert.ok(containers.length >= 11);
  const validModes = ['absolute', 'flow', 'stack', 'grid', 'dock', 'slots', 'single', 'custom'];
  for (const control of containers) {
    assert.ok(control.layout, `容器 ${control.type} 未声明 layout，设计器将按 legacy 绝对坐标兜底。`);
    assert.ok(validModes.includes(control.layout.mode), `容器 ${control.type} 的 layout.mode 无效：${control.layout.mode}`);
    assert.ok(!control.layout.coordinateSpace || ['window', 'parent'].includes(control.layout.coordinateSpace), `容器 ${control.type} 的 layout.coordinateSpace 无效。`);
  }
  const tabs = containers.find((control: { type: string }) => control.type === 'Tabs');
  assert.deepEqual(tabs.layout, { mode: 'slots', coordinateSpace: 'window', adapterId: 'new-emoji.tabs.pages' });
  for (const type of ['Panel', 'Card', 'Container', 'Header', 'Aside', 'Main', 'Footer', 'Layout', 'Border', 'Collapse']) {
    const control = containers.find((item: { type: string }) => item.type === type);
    assert.ok(control, `缺少容器控件 ${type}。`);
    assert.deepEqual(control.layout, {
      mode: 'absolute',
      coordinateSpace: 'window',
      adapterId: `new-emoji.${type.toLowerCase()}.absolute`
    });
  }
});

test('exportVisualStudioProject writes sln and vcxproj with module dependencies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-export-'));
  const module = createNewEmojiTestModule(path.join(root, 'installed'));
  const result = await exportVisualStudioProject({
    projectDir: root,
    projectId: 'new-emoji-yolo-demo',
    generatedFiles: [
      { relativePath: 'main.cpp', content: '' },
      { relativePath: 'lingbuilder-app.rc', content: '#define IDI_LINGBUILDER_APP 101\nIDI_LINGBUILDER_APP ICON "resources/lingbuilder-app.ico"\n' },
      { relativePath: 'layout.json', content: '{}' }
    ],
    enabledModules: [module]
  });

  assert.ok(result.solutionPath.endsWith('new-emoji-yolo-demo.sln'));
  assert.ok(await exists(result.solutionPath));
  assert.ok(await exists(result.projectPath));
  assert.ok(await exists(result.filtersPath));

  const vcxproj = await fs.readFile(result.projectPath, 'utf8');
  assert.match(vcxproj, /<Platform>Win32<\/Platform>/);
  assert.match(vcxproj, /<Platform>x64<\/Platform>/);
  assert.match(vcxproj, /<ClCompile Include="main\.cpp" \/>/);
  assert.match(vcxproj, /<ResourceCompile Include="lingbuilder-app\.rc" \/>/);
  assert.doesNotMatch(vcxproj, /<None Include="lingbuilder-app\.rc" \/>/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\src\\new_emoji_bridge\.cpp/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\include/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\lib\\Win32\\new_emoji\.lib/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\lib\\x64\\new_emoji\.lib/);
  assert.match(vcxproj, /new_emoji\.dll/);
  const filters = await fs.readFile(result.filtersPath, 'utf8');
  assert.match(filters, /<Filter Include="资源文件">/u);
  assert.match(filters, /<ResourceCompile Include="lingbuilder-app\.rc">/u);
});

test('exportVisualStudioProject selects the correct FBro runtime source for F5 and portable exports', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.fbro.browser',
    isBuiltin: true,
    isInstalled: true,
    diagnostics: []
  };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-fbro-'));
  const build = await exportVisualStudioProject({
    projectDir: path.join(root, 'build'),
    projectId: 'fbro-build',
    generatedFiles: [{ relativePath: 'src/main.cpp', content: '' }],
    enabledModules: [module],
    fbroRuntimeFromBuildBin: true
  });
  const portable = await exportVisualStudioProject({
    projectDir: path.join(root, 'portable'),
    projectId: 'fbro-portable',
    generatedFiles: [{ relativePath: 'main.cpp', content: '' }],
    enabledModules: [module]
  });
  const buildProject = await fs.readFile(build.projectPath, 'utf8');
  const portableProject = await fs.readFile(portable.projectPath, 'utf8');
  assert.match(buildProject, /-RuntimeRoot &quot;\$\(ProjectDir\)bin&quot;/u);
  assert.doesNotMatch(portableProject, /-RuntimeRoot/u);
  assert.match(portableProject, /materialize-fbro-runtime\.ps1/u);
});

test('exportVisualStudioProject emits x64-only OpenCV configurations and SDK dependencies', async () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === OPENCV_MODULE_ID)!;
  const module: InstalledModule = { manifest, installPath: `builtin://${OPENCV_MODULE_ID}`, isBuiltin: true, isInstalled: true, diagnostics: [] };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-opencv-'));
  const result = await exportVisualStudioProject({
    projectDir: root,
    projectId: 'opencv-demo',
    generatedFiles: [{ relativePath: 'main.cpp', content: '' }],
    enabledModules: [module]
  });
  const solution = await fs.readFile(result.solutionPath, 'utf8');
  const project = await fs.readFile(result.projectPath, 'utf8');
  assert.doesNotMatch(solution, /Win32/u);
  assert.doesNotMatch(project, /<Platform>Win32<\/Platform>/u);
  assert.match(project, /<Platform>x64<\/Platform>/u);
  assert.match(project, /LingBuilderOpenCvBridge\.lib/u);
  assert.match(project, /opencv_core4140\.dll/u);
  assert.match(project, /<RuntimeLibrary>MultiThreadedDLL<\/RuntimeLibrary>/u);
});

test('exportVisualStudioProject applies native module C++20 and dynamic CRT requirements', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-cpp20-'));
  const result = await exportVisualStudioProject({
    projectDir: root,
    projectId: 'cef3-cpp20',
    generatedFiles: [{ relativePath: 'main.cpp', content: '' }],
    enabledModules: [],
    requiredCppStandard: 20,
    requiresDynamicCrt: true
  });

  const vcxproj = await fs.readFile(result.projectPath, 'utf8');
  assert.equal((vcxproj.match(/<LanguageStandard>stdcpp20<\/LanguageStandard>/g) || []).length, 4);
  assert.equal((vcxproj.match(/<RuntimeLibrary>MultiThreadedDLL<\/RuntimeLibrary>/g) || []).length, 4);
  assert.equal((vcxproj.match(/<UseDebugLibraries>false<\/UseDebugLibraries>/g) || []).length, 4);
  assert.doesNotMatch(vcxproj, /_DEBUG/);
  assert.doesNotMatch(vcxproj, /<LanguageStandard>stdcpp17<\/LanguageStandard>/);
  assert.match(vcxproj, /<OutDir>\$\(ProjectDir\)\$\(Platform\)\\\$\(Configuration\)\\bin\\<\/OutDir>/u);
});

test('exportVisualStudioProject links built-in module system libraries without module-relative paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-builtin-libs-'));
  const modules: InstalledModule[] = ['lingbuilder.http.server', 'lingbuilder.websocket.server', 'lingbuilder.websocket.client']
    .map(id => {
      const manifest = BUILTIN_MODULES.find(item => item.id === id);
      assert.ok(manifest);
      return {
        manifest,
        installPath: `builtin://${id}`,
        isBuiltin: true,
        isInstalled: true,
        isEnabledForProject: true,
        diagnostics: []
      };
    });

  const result = await exportVisualStudioProject({
    projectDir: root,
    projectId: 'builtin-network-libs',
    generatedFiles: [{ relativePath: 'main.cpp', content: '' }],
    enabledModules: modules
  });

  const vcxproj = await fs.readFile(result.projectPath, 'utf8');
  assert.match(vcxproj, /ws2_32\.lib/);
  assert.match(vcxproj, /advapi32\.lib/);
  assert.match(vcxproj, /winhttp\.lib/);
  assert.doesNotMatch(vcxproj, /modules\\lingbuilder\.http\.server\\ws2_32\.lib/);
  assert.doesNotMatch(vcxproj, /modules\\lingbuilder\.websocket\.server\\advapi32\.lib/);
  assert.doesNotMatch(vcxproj, /modules\\lingbuilder\.websocket\.client\\winhttp\.lib/);
});

test('F5 and Visual Studio exports share complete Windows system libraries', () => {
  const libraries = createWindowsMsvcLinkLibraries(['custom.lib', 'WS2_32.LIB']);
  for (const required of ['shell32.lib', 'ws2_32.lib', 'winhttp.lib', 'crypt32.lib', 'delayimp.lib']) {
    assert.ok(libraries.some(library => library.toLocaleLowerCase() === required), `缺少 ${required}`);
  }
  assert.equal(libraries.filter(library => library.toLocaleLowerCase() === 'ws2_32.lib').length, 1);
  assert.equal(libraries.at(-1), 'custom.lib');
});

test('new_emoji bridge template keeps UTF-8 buffers alive for native controls', async () => {
  const script = await fs.readFile(path.join(process.cwd(), 'scripts', 'generate-new-emoji-module.cjs'), 'utf8');
  assert.match(script, /static std::vector<std::unique_ptr<std::string>>& NE_Utf8Pool/);
  assert.match(script, /static auto\* pool = new std::vector<std::unique_ptr<std::string>>\(\)/);
  assert.match(script, /static const std::string& NE_KeepUtf8/);
  assert.match(script, /std::string bytes\(static_cast<size_t>\(needed\), '\\\\0'\)/);
  assert.match(script, /bytes\.pop_back\(\)/);
  assert.match(script, /reinterpret_cast<const unsigned char\*>\(textBytes\.c_str\(\)\)/);
  assert.match(script, /void NE_设置元素焦点\(HWND hwnd, int elementId\)/u);
  assert.match(script, /EU_SetElementFocus\(hwnd, elementId\)/u);
  assert.match(script, /void NE_显示并激活窗口\(HWND hwnd\)/u);
  assert.match(script, /GetWindowThreadProcessId\(foregroundWindow, nullptr\)/u);
  assert.match(script, /AttachThreadInput\(currentThreadId, foregroundThreadId, TRUE\)/u);
  assert.match(script, /ShowWindow\(hwnd, IsIconic\(hwnd\) \? SW_RESTORE : SW_SHOW\)/u);
  assert.match(script, /SetWindowPos\(hwnd, HWND_TOPMOST/u);
  assert.match(script, /SetWindowPos\(hwnd, HWND_NOTOPMOST/u);
  assert.match(script, /SetForegroundWindow\(hwnd\)/u);
  assert.match(script, /SetActiveWindow\(hwnd\)/u);
  assert.match(script, /SetFocus\(hwnd\)/u);
  assert.match(script, /AttachThreadInput\(currentThreadId, foregroundThreadId, FALSE\)/u);
  assert.match(script, /image', 'lingbuilder-ide-icon-v2\.ico'/u);
  assert.match(script, /assets\/lingbuilder-newemoji-window\.ico/u);
  assert.doesNotMatch(script, /static std::vector<unsigned char> NE_ToUtf8/);
  assert.doesNotMatch(script, /std::vector<unsigned char> bytes\(static_cast<size_t>\(needed - 1\)\)/);
});

test('module manager interface action opens the viewport-level public information dialog', async () => {
  const inspectorSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'ModuleInspector.tsx'), 'utf8');
  const dialogSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'ModulePublicInfoDialog.tsx'), 'utf8');
  const documentPreviewSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'ModuleDocumentPreview.tsx'), 'utf8');
  const serverSource = await fs.readFile(path.join(process.cwd(), 'server.ts'), 'utf8');
  const sidebarSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(inspectorSource, /onInspect=\{\(\) => inspectModule\(module\.manifest\.id\)\}/);
  assert.match(inspectorSource, /<ModulePublicInfoDialog/);
  assert.doesNotMatch(inspectorSource, /<ModuleDetailPanel/);
  // 收费模块卡按钮必须按版本比较分支：已安装且无更新时不得宣称「下载更新」（内置模块误导 bug，2026-09-18）。
  assert.match(inspectorSource, /重新下载安装/);
  assert.match(inspectorSource, /下载更新 v\$\{installedVersion\} → v\$\{latestVersion\} 并预览安装/);
  assert.match(inspectorSource, /已安装 v\{installedVersion\}/);
  assert.doesNotMatch(inspectorSource, /installed \? '下载更新并预览安装'/);
  assert.match(dialogSource, /createPortal\(/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /模块公开信息 - \{manifest\.name\}/);
  assert.match(dialogSource, /if \(event\.key === 'Escape'\)/);
  assert.match(dialogSource, /if \(event\.target === event\.currentTarget\) onClose\(\)/);
  assert.match(inspectorSource, /isModuleHiddenByFamily/);
  assert.match(inspectorSource, /moduleIds: standardModuleIds/);
  assert.match(inspectorSource, /内部依赖和只读 SDK 已自动收起/);
  assert.match(dialogSource, /\{family\?\.displayName \|\| '模块'\} 功能范围/);
  assert.match(dialogSource, /禁用\$\{feature\.label\}/);
  assert.match(dialogSource, /启用\$\{feature\.label\}/);
  assert.doesNotMatch(dialogSource, /启用高级功能/);
  assert.match(dialogSource, /功能分类/);
  assert.match(dialogSource, /function ModuleFamilyFeatureTreeGroup/);
  assert.match(dialogSource, /const commandItems = items\.filter\(item => item\.groupId === 'commands'\)/);
  assert.match(dialogSource, /公开记录/);
  assert.match(dialogSource, /公开数组/);
  assert.match(dialogSource, /字段 · \$\{field\.name\}/);
  // 模块公开常量必须在弹窗可见（2026-09-20）：contributes.constants 收集、常量分组与 #名称 引用形态。
  assert.match(dialogSource, /contributes\.constants \|\| \[\]/);
  assert.match(dialogSource, /groupId: 'constants'/);
  assert.match(dialogSource, /declaration: `#\$\{constant\.name\} = \$\{valueText\}`/);
  assert.match(dialogSource, /\{ id: 'constants', label: '常量' \}/);
  // 模块随包示例必须在弹窗可打开（2026-09-20）：examples 分组与文档共用同一预览链路。
  assert.match(dialogSource, /contributes\.examples \|\| \[\]/);
  assert.match(dialogSource, /\{ id: 'examples', label: '示例' \}/);
  assert.match(dialogSource, /item\.groupId === 'docs' \|\| item\.groupId === 'examples'/);
  assert.match(dialogSource, /<ModuleDocumentPreview/);
  assert.match(documentPreviewSource, /ReactMarkdown/);
  assert.match(documentPreviewSource, /正在读取模块文档/);
  assert.match(documentPreviewSource, /无法预览模块文档/);
  assert.match(serverSource, /app\.get\("\/api\/modules\/document"/);
  assert.match(serverSource, /readModuleDocumentation/);
  assert.match(dialogSource, /<PublicInfoTreeItem/);
  assert.match(dialogSource, /\{!isFamilyView && groups\.map\(group => \(/);
  assert.match(dialogSource, /其他公开信息/);
  assert.match(dialogSource, /条接口命令/);
  assert.match(sidebarSource, /visibleProjectModules = projectModules\.filter\(module => !isModuleHiddenByFamily/);
  assert.match(sidebarSource, /getModuleFamilySearchText\(definition, modules\)/);
});

function createTestModule(): InstalledModule {
  return {
    isInstalled: true,
    installPath: 'C:/modules/com.example.sqlite',
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.sqlite',
      name: 'SQLite数据库模块',
      version: '1.0.0',
      category: '数据库',
      description: '提供 SQLite 数据库访问能力。',
      contributes: {
        commands: [{
          name: '执行SQL',
          signature: '执行SQL(语句)',
          description: '执行 SQL。',
          insertText: '执行SQL("$1")',
          returnType: '整数型',
          returnDescription: '返回受影响的记录数量。'
        }],
        types: [{ name: '数据库连接', description: '数据库连接句柄。' }],
        snippets: [{ label: '打开数据库模板', insertText: '打开数据库("$1")', description: '打开数据库。' }]
      },
      bindings: { commands: [{
        command: '执行SQL',
        runtimeName: 'ExecuteSql',
        parameters: [{ name: '语句', type: 'wideString', description: '要执行的 SQL 语句。' }],
        returnType: 'int'
      }] }
    }
  };
}

function createNewEmojiTestModule(installPath: string): InstalledModule {
  return {
    isInstalled: true,
    installPath,
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL。',
      contributes: {
        commands: [
          { name: 'NE_创建窗口', signature: 'NE_创建窗口(标题, X, Y, 宽度, 高度)', description: '创建 new_emoji 原生窗口。', insertText: 'NE_创建窗口("$1", 120, 120, 860, 560)' },
          { name: '创建按钮', signature: '创建按钮(hwnd, parent_id, emoji_bytes, emoji_len, text_bytes, text_len, x, y, w, h)', description: 'new_emoji 创建按钮底层导出。' }
        ]
      },
      targets: [
        {
          id: 'windows-msvc-win32',
          platform: 'windows',
          arch: 'win32',
          toolchain: 'msvc',
          includeDirs: ['include'],
          headers: ['include/new_emoji_bridge.h'],
          sources: ['src/new_emoji_bridge.cpp'],
          libs: ['lib/Win32/new_emoji.lib'],
          runtimeFiles: ['bin/Win32/new_emoji.dll'],
          defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
        },
        {
          id: 'windows-msvc-x64',
          platform: 'windows',
          arch: 'x64',
          toolchain: 'msvc',
          includeDirs: ['include'],
          headers: ['include/new_emoji_bridge.h'],
          sources: ['src/new_emoji_bridge.cpp'],
          libs: ['lib/x64/new_emoji.lib'],
          runtimeFiles: ['bin/x64/new_emoji.dll'],
          defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
        }
      ],
      bindings: {
        commands: [
          { command: 'NE_创建窗口', runtimeName: 'NE_创建窗口', parameters: [{ name: '标题', type: 'wideString' }], returnType: 'handle' },
          { command: '创建按钮', runtimeName: 'EU_CreateButton', returnType: 'int', encoding: 'raw' }
        ]
      }
    }
  };
}

async function writeFixture(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeSolutionFixture(root: string, projectIds: string[]): Promise<void> {
  await writeFixture(path.join(root, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'test-solution',
    name: '模块测试解决方案',
    startupProjectId: projectIds[0],
    projects: projectIds.map(projectId => ({
      id: projectId,
      name: projectId,
      type: 'visual-cpp',
      sourceRoot: `src/${projectId}`,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`
    }))
  }, null, 2));
}

async function createLbmodArchive(sourceDir: string, targetPath: string): Promise<void> {
  const zipPath = `${targetPath}.zip`;
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path ${quotePowerShell(path.join(sourceDir, '*'))} -DestinationPath ${quotePowerShell(zipPath)} -Force`
  ], { windowsHide: true });
  await fs.rename(zipPath, targetPath);
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

test('按钮常规命名事件未绑定时生成启动警告', async () => {
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      events: {},
      controls: [{
        id: 'clear-btn', type: 'Button', name: '清除按钮', content: '清除替换并重载', x: 0, y: 0,
        width: 220, height: 30, background: '#333', foreground: '#fff', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: {}, events: {}
      }]
    }]
  };
  const source = `包 测试
类 MainWindow : 窗口
公开
  事件 _MainWindow_创建完毕()
  结束
  事件 _清除按钮_被单击()
    调试输出("cleared")
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [] });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /WarnUnboundControlEvents\(\) override/);
  assert.match(cpp, /未绑定 Click 事件/);
  assert.match(cpp, /WarnUnboundControlEvents\(\);/);

  // 已在设计器绑定 Click 时不产生警告
  const wired = JSON.parse(JSON.stringify(project));
  wired.windows[0].controls[0].events = { Click: '_清除按钮_被单击' };
  const generatedWired = generateLingCppNativeWin32Project(wired, { lingCppSourceCode: source, enabledModules: [] });
  const cppWired = generatedWired.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.doesNotMatch(cppWired, /WarnUnboundControlEvents\(\) override/);
});

test('contributes.constants 清单门禁：命名、类型、字面量与重复校验', () => {
  const base = { schemaVersion: 2 as const, id: 'com.example.const', name: '常量门禁', version: '1.0.0', category: '其他' as const, description: '常量门禁测试。' };
  const valid = validateModuleManifest({
    ...base,
    contributes: { constants: [
      { name: '键盘1', type: '整数型', value: 49, description: '虚拟键码。' },
      { name: '标题', type: '文本型', value: '示例', description: '标题文本。' },
      { name: '启用', type: '逻辑型', value: false, description: '开关。' },
      { name: '比率', type: '小数型', value: 1.5, description: '比率。' },
      { name: '高级常量', type: '整数型', value: 2, description: 'advanced 常量。', level: 'advanced' }
    ] }
  });
  assert.equal(valid.diagnostics.length, 0, valid.diagnostics.join('\n'));

  const invalid = validateModuleManifest({
    ...base,
    contributes: { constants: [
      { name: '1错误', type: '整数型', value: 1, description: '数字开头。' },
      { name: '错类型', type: '字节集', value: 1, description: '不允许的类型。' },
      { name: '错字面量', type: '整数型', value: 'abc', description: '字面量类型不符。' },
      { name: '错逻辑字面量', type: '逻辑型', value: '真', description: '必须 true/false。' },
      { name: '键盘1', type: '整数型', value: 2, description: '与第一条重复。' },
      { name: '缺说明', type: '整数型', value: 1, description: '' },
      { name: '坏级别', type: '整数型', value: 1, description: 'x', level: 'internal' },
      { name: '键盘1', type: '整数型', value: 50, description: '与第 5 条重复。' }
    ] }
  });
  const joined = invalid.diagnostics.join('\n');
  assert.match(joined, /constants\[0\]\.name 必须是有效的 LingCpp 常量名称/u);
  assert.match(joined, /constants\[1\]\.type 只允许/u);
  assert.match(joined, /错字面量 的 value 必须是整数/u);
  assert.match(joined, /错逻辑字面量 的 value 必须是 true 或 false/u);
  assert.match(joined, /模块常量名称重复：键盘1/u);
  assert.match(joined, /constants\[5\]\.description 必须是非空中文说明/u);
  assert.match(joined, /constants\[6\]\.level 只允许 basic 或 advanced/u);
});
