import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getLingCppCompletions, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { STANDARD_LIBRARY_MODULES } from '../src/services/modules/standardLibraryModules';
import { SYSTEM_LIBRARY_MODULES } from '../src/services/modules/systemLibraryModules';
import { NETWORK_LIBRARY_MODULES } from '../src/services/modules/networkLibraryModules';
import { DATA_MEDIA_MODULES } from '../src/services/modules/dataMediaModules';
import { PLATFORM_ADVANCED_MODULES } from '../src/services/modules/platformAdvancedModules';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { createModuleService } from '../src/services/modules/moduleService';
import { createMarketIndex, validateModuleDirectory } from '../src/services/modules/moduleSdkService';
import { getPreferredModuleTarget } from '../src/services/modules/targetResolver';
import {
  describeLingCppModuleContextForAi,
  getBeginnerModuleCodeCompletions,
  getBeginnerModuleCommandHints
} from '../src/services/modules/moduleContextAdapters';
import { InstalledModule } from '../src/services/modules/types';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

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

test('标准库模块命令、binding、Win32/x64 target 保持完整对应', () => {
  const expectedIds = [
    'lingbuilder.std.text',
    'lingbuilder.std.bytes',
    'lingbuilder.std.encoding',
    'lingbuilder.std.math',
    'lingbuilder.std.datetime',
    'lingbuilder.std.regex',
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
      '        JSON_是否有效("{}")',
      '    结束',
      '结束类'
    ].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /const wchar_t\* 文本_转大写\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /const wchar_t\* 编码_Base64解码\(const wchar_t\* text\)/u);
  assert.match(mainCpp, /bool JSON_是否有效\(const wchar_t\* json\)/u);
  assert.match(mainCpp, /调试输出\(文本_转大写\(L"LingBuilder"\)\);/u);
  assert.match(mainCpp, /调试输出\(编码_Base64解码\(L"5L2g5aW9"\)\);/u);
  assert.match(mainCpp, /JSON_是否有效\(L"\{\}"\);/u);
});

test('文件、配置、系统、进程、输入和窗口模块提供完整确定性绑定', () => {
  assert.equal(SYSTEM_LIBRARY_MODULES.length, 13);
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
});

test('网络基础模块提供请求、状态、错误和关闭闭环', () => {
  assert.deepEqual(NETWORK_LIBRARY_MODULES.map(module => module.id), [
    'lingbuilder.net.http-client', 'lingbuilder.net.tcp', 'lingbuilder.net.udp',
    'lingbuilder.net.dns', 'lingbuilder.net.url', 'lingbuilder.net.cookie', 'lingbuilder.net.ftp'
  ]);
  for (const manifest of NETWORK_LIBRARY_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
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
  assert.match(mainCpp, /bool FTP_连接\(const wchar_t\* host/u);
  assert.match(mainCpp, /HTTP客户端_GET\(L"https:\/\/example\.com"\);/u);
});

test('数据、数据库、加密、图像和媒体模块提供可生成实现', () => {
  assert.equal(DATA_MEDIA_MODULES.length, 11);
  for (const manifest of DATA_MEDIA_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
  const enabledModules: InstalledModule[] = DATA_MEDIA_MODULES.map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        哈希_SHA256文本("LingBuilder")', '        ODBC_关闭()', '        SQLite_关闭()', '        图像_取宽度("图片.png")', '        音频_停止()', '    结束', '结束类'].join('\n'),
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /const wchar_t\* CSV_取字段/u);
  assert.match(mainCpp, /const wchar_t\* 哈希_SHA256文本/u);
  assert.match(mainCpp, /const wchar_t\* 数据保护_加密文本/u);
  assert.match(mainCpp, /bool ODBC_连接/u);
  assert.match(mainCpp, /bool SQLite_加载运行库/u);
  assert.match(mainCpp, /bool 图像_缩放/u);
  assert.match(mainCpp, /bool 截图_主屏到PNG/u);
  assert.match(mainCpp, /long long 位图_取像素ARGB/u);
  assert.match(mainCpp, /int 图标_取数量/u);
  assert.match(mainCpp, /bool 识图_模板匹配/u);
  assert.match(mainCpp, /bool 音频_播放WAV/u);
});

test('平台扩展和高风险模块保持独立启用并具有确定性运行时', () => {
  assert.equal(PLATFORM_ADVANCED_MODULES.length, 12);
  for (const manifest of PLATFORM_ADVANCED_MODULES) {
    assert.equal(validateModuleManifest(manifest).diagnostics.length, 0, `${manifest.id} manifest 应通过校验`);
    assert.deepEqual(manifest.bindings?.commands?.map(binding => binding.command), manifest.contributes?.commands?.map(command => command.name));
  }
  const enabledModules: InstalledModule[] = PLATFORM_ADVANCED_MODULES.map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: ['类 MainWindow', '    事件 _MainWindow_创建完毕()', '        IPC_关闭()', '        键盘钩子_停止()', '        COM_关闭()', '    结束', '结束类'].join('\n'), enabledModules });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  ['压缩_ZIP创建', 'SMTP_发送普通邮件', 'IPC_创建管道服务端', '菜单_创建', '托盘_添加', '辅助_取名称', '内存_申请', '键盘钩子_启动', '进程内存_打开', 'COM_创建对象', 'CPU_取厂商', '设备_打开'].forEach(name => assert.ok(mainCpp.includes(name), `缺少 ${name} C++ 运行时`));
});

test('模块封装清单覆盖实际内置模块注册表', async () => {
  const checklist = await fs.readFile(path.resolve('..', 'MODULE_ENCAPSULATION_CHECKLIST.md'), 'utf8');
  assert.match(checklist, /58 个内置模块、389 条中文命令/u);
  assert.match(checklist, /51 个模块、287 条命令/u);
  for (const manifest of BUILTIN_MODULES) {
    assert.ok(checklist.includes(`\`${manifest.id}\``), `封装清单缺少 ${manifest.id}`);
  }
});

test('module service defaults ordinary projects to Win32 basic module only', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-defaults-'));
  const service = createModuleService(root);

  const enabledModules = await service.getEnabledProjectModules('fresh-win32-project');
  assert.deepEqual(enabledModules.map(module => module.manifest.id), ['lingbuilder.win32.basic']);

  await assert.rejects(
    () => service.disableModuleForProject('fresh-win32-project', 'lingbuilder.win32.basic'),
    /不能禁用/
  );
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
  assert.ok(Object.values(hints).some(hint => hint.signature.includes('SQL')));

  const aiSummary = describeLingCppModuleContextForAi(moduleContext);
  assert.ok(aiSummary.includes('com.example.sqlite'));
  assert.ok(aiSummary.includes('com.example.disabled'));
  assert.ok(aiSummary.includes('SQL'));
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

test('built-in WebSocket client module contributes commands and deterministic C++ bindings', () => {
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

  assert.ok(completions.some(item => item.label === 'WS_连接'));
  assert.ok(completions.some(item => item.label === 'WebSocket 回显测试'));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        WS_连接("wss://echo.websocket.events")',
      '        WS_发送文本("你好")',
      '        WS_接收到调试输出()',
      '        WS_关闭()',
      '结束类'
    ].join('\n'),
    enabledModules: [module]
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.ok(mainCpp.includes('#include <winhttp.h>'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "winhttp.lib")'));
  assert.ok(mainCpp.includes('int WS_连接(const wchar_t* url)'));
  assert.ok(mainCpp.includes('WinHttpSetOption(wsRequest_, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0)'));
  assert.ok(mainCpp.includes('WS_连接(L"wss://echo.websocket.events");'));
  assert.ok(mainCpp.includes('WS_发送文本(L"你好");'));
  assert.ok(mainCpp.includes('WS_接收到调试输出();'));
  assert.ok(moduleReport.includes('WebSocket 客户端模块'));
  assert.ok(moduleReport.includes('winhttp.lib'));
});

test('built-in EdgeView module contributes HWND embedding, browser events and JavaScript results', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
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
  assert.ok(completions.some(item => item.label === 'EdgeView 嵌入与 JS 返回值'));
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    enabledModules: [module],
    lingCppSourceCode: [
      '类 MainWindow',
      '  事件 _MainWindow_创建完毕()',
      '    EdgeView_创建区域(1, 10, 10, 300, 400, "https://example.com", ".edgeview/cache-1")',
      '    EdgeView_创建区域(2, 320, 10, 300, 400, "https://example.org", ".edgeview/cache-2")',
      '    EdgeView_绑定事件(1, "导航完成", "浏览器1_导航完成")',
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
  assert.ok(mainCpp.includes('std::map<int, std::unique_ptr<EdgeViewInstance>> edgeViews_'));
  assert.ok(mainCpp.includes('std::wstring EdgeView_执行JS实例'));
  assert.ok(mainCpp.includes('add_NavigationCompleted'));
  assert.ok(mainCpp.includes('add_WebMessageReceived'));
  assert.ok(mainCpp.includes('add_ContextMenuRequested'));
  assert.ok(mainCpp.includes('CreateContextMenuItem(L"刷新"'));
  assert.ok(mainCpp.includes('EdgeView_刷新实例(instanceId);'));
  assert.ok(mainCpp.includes('std::wstring edgeViewGlobalProxy_'));
  assert.ok(mainCpp.includes('L"--proxy-server=" + raw->proxyServer'));
  assert.ok(mainCpp.includes('environmentOptions->put_AdditionalBrowserArguments'));
  assert.ok(mainCpp.includes('EdgeView_调整全部大小();'));
  assert.ok(mainCpp.includes('WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS'));
  assert.ok(mainCpp.includes('controller->put_IsVisible(TRUE);'));
  assert.ok(mainCpp.includes('instance.controller->NotifyParentWindowPositionChanged();'));
  assert.ok(mainCpp.includes('SetWindowPos(raw->host, HWND_TOP'));
  assert.ok(mainCpp.includes('if (callback == L"浏览器1_导航完成") { 浏览器1_导航完成(); return; }'));
  assert.ok(mainCpp.includes('EdgeView_创建区域(1, 10, 10, 300, 400, L"https://example.com", L".edgeview/cache-1");'));
});

test('built-in threading module contributes safe background task commands and C++ runtime', () => {
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
  assert.ok(completions.some(item => item.label === '线程_启动延时输出'));
  assert.ok(completions.some(item => item.label === '多线程并行输出示例'));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        线程_启动延时输出("后台完成", 20)',
      '        线程_等待全部()',
      '        线程_活动数量()',
      '结束类'
    ].join('\n'),
    enabledModules: [module]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.ok(mainCpp.includes('#include <thread>'));
  assert.ok(mainCpp.includes('int 线程_启动延时输出(const wchar_t* text, int delayMs)'));
  assert.ok(mainCpp.includes('const int safeDelayMs = (std::max)(0, delayMs);'));
  assert.ok(mainCpp.includes('output += L"\\n";'));
  assert.ok(mainCpp.includes('线程_启动延时输出(L"后台完成", 20);'));
  assert.ok(mainCpp.includes('线程_等待全部();'));
  assert.ok(mainCpp.includes('std::vector<std::thread> threadTasks_'));
  assert.ok(moduleReport.includes('多线程模块'));
});

test('built-in HTTP and WebSocket server modules contribute commands and deterministic C++ bindings', () => {
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

  assert.ok(completions.some(item => item.label === 'HTTP_启动服务'));
  assert.ok(completions.some(item => item.label === 'HTTP 本地文本服务'));
  assert.ok(completions.some(item => item.label === 'WSS_启动服务'));
  assert.ok(completions.some(item => item.label === 'WebSocket 本地回显服务'));

  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 _MainWindow_创建完毕()',
      '        HTTP_启动服务(8080)',
      '        HTTP_等待请求到调试输出()',
      '        HTTP_回复文本("你好 HTTP")',
      '        HTTP_关闭服务()',
      '        WSS_启动服务(18080)',
      '        WSS_等待连接()',
      '        WSS_发送文本("你好 WebSocket")',
      '        WSS_关闭服务()',
      '结束类'
    ].join('\n'),
    enabledModules: modules
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const moduleReport = generated.files.find(file => file.relativePath === 'module-dependencies.txt')?.content || '';
  assert.ok(mainCpp.includes('#include <winsock2.h>'));
  assert.ok(mainCpp.includes('#include <wincrypt.h>'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "ws2_32.lib")'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "advapi32.lib")'));
  assert.ok(mainCpp.includes('int HTTP_启动服务(int port)'));
  assert.ok(mainCpp.includes('int WSS_启动服务(int port)'));
  assert.ok(mainCpp.includes('std::string MakeWebSocketAcceptKey'));
  assert.ok(mainCpp.includes('HTTP_启动服务(8080);'));
  assert.ok(mainCpp.includes('HTTP_回复文本(L"你好 HTTP");'));
  assert.ok(mainCpp.includes('WSS_发送文本(L"你好 WebSocket");'));
  assert.ok(moduleReport.includes('HTTP 服务端模块'));
  assert.ok(moduleReport.includes('WebSocket 服务端模块'));
  assert.ok(moduleReport.includes('ws2_32.lib'));
  assert.ok(moduleReport.includes('advapi32.lib'));
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

test('EdgeView native dependencies restore headers and architecture loader from NuGet cache', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-edgeview-sdk-'));
  const previousNugetPackages = process.env.NUGET_PACKAGES;
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
    assert.equal(plan.diagnostics.length, 0);
    assert.ok(plan.includeDirs.some(item => item.endsWith(path.join('lingbuilder.edgeview', 'include'))));
    assert.equal(await fs.readFile(path.join(tempRoot, 'bin', 'WebView2Loader.dll')).then(value => value.length), 3);
    assert.equal(await fs.readFile(path.join(tempRoot, 'export', 'modules', 'lingbuilder.edgeview', 'include', 'WebView2.h'), 'utf8'), '// header');
    assert.equal(await fs.readFile(path.join(tempRoot, 'export', 'modules', 'lingbuilder.edgeview', 'bin', 'x64', 'WebView2Loader.dll')).then(value => value.length), 4);
  } finally {
    if (previousNugetPackages === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previousNugetPackages;
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

test('generated new_emoji bridge completions match binding parameter counts', async () => {
  const manifestPath = path.join(process.cwd(), '..', '.lingbuilder', 'module-build', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const highLevelNames = [
    'NE_创建窗口',
    'NE_创建深色窗口',
    'NE_显示窗口',
    'NE_运行消息循环',
    'NE_销毁窗口',
    'NE_创建容器',
    'NE_创建文本',
    'NE_创建按钮',
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
});

test('exportVisualStudioProject writes sln and vcxproj with module dependencies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-vs-export-'));
  const module = createNewEmojiTestModule(path.join(root, 'installed'));
  const result = await exportVisualStudioProject({
    projectDir: root,
    projectId: 'new-emoji-yolo-demo',
    generatedFiles: [
      { relativePath: 'main.cpp', content: '' },
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
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\src\\new_emoji_bridge\.cpp/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\include/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\lib\\Win32\\new_emoji\.lib/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\lib\\x64\\new_emoji\.lib/);
  assert.match(vcxproj, /new_emoji\.dll/);
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

test('new_emoji bridge template keeps UTF-8 buffers alive for native controls', async () => {
  const script = await fs.readFile(path.join(process.cwd(), 'scripts', 'generate-new-emoji-module.cjs'), 'utf8');
  assert.match(script, /static std::vector<std::unique_ptr<std::string>>& NE_Utf8Pool/);
  assert.match(script, /static auto\* pool = new std::vector<std::unique_ptr<std::string>>\(\)/);
  assert.match(script, /static const std::string& NE_KeepUtf8/);
  assert.match(script, /std::string bytes\(static_cast<size_t>\(needed\), '\\\\0'\)/);
  assert.match(script, /bytes\.pop_back\(\)/);
  assert.match(script, /reinterpret_cast<const unsigned char\*>\(textBytes\.c_str\(\)\)/);
  assert.doesNotMatch(script, /static std::vector<unsigned char> NE_ToUtf8/);
  assert.doesNotMatch(script, /std::vector<unsigned char> bytes\(static_cast<size_t>\(needed - 1\)\)/);
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
        commands: [{ name: '执行SQL', signature: '执行SQL(语句)', description: '执行 SQL。', insertText: '执行SQL("$1")' }],
        types: [{ name: '数据库连接', description: '数据库连接句柄。' }],
        snippets: [{ label: '打开数据库模板', insertText: '打开数据库("$1")', description: '打开数据库。' }]
      },
      bindings: { commands: [{ command: '执行SQL', runtimeName: 'ExecuteSql', parameters: [{ name: '语句', type: 'wideString' }], returnType: 'int' }] }
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
