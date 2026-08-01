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
import { CEF3_BROWSER_EVENTS } from '../src/services/modules/cef3BrowserEvents';
import { EDGEVIEW_BROWSER_EVENTS, EDGEVIEW_COMPOSITION_ONLY_EVENTS } from '../src/services/modules/edgeViewBrowserEvents';
import { EDGEVIEW_SAFE_API_CATALOG, validateEdgeViewApiCatalog } from '../src/services/modules/edgeViewApiCatalog';
import { FBRO_VIP_API_CATALOG, generateFbroVipIndividualRuntime } from '../src/services/modules/fbroVipApiCatalog';
import { STANDARD_LIBRARY_MODULES } from '../src/services/modules/standardLibraryModules';
import { SYSTEM_LIBRARY_MODULES } from '../src/services/modules/systemLibraryModules';
import { NETWORK_LIBRARY_MODULES } from '../src/services/modules/networkLibraryModules';
import { DATA_MEDIA_MODULES } from '../src/services/modules/dataMediaModules';
import { PLATFORM_ADVANCED_MODULES } from '../src/services/modules/platformAdvancedModules';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { auditControlReferenceManifests } from '../src/services/modules/controlReferenceAuditService';
import { createModuleService } from '../src/services/modules/moduleService';
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
import { createMarketIndex, migrateCppModule, validateModuleDirectory } from '../src/services/modules/moduleSdkService';
import { getPreferredModuleTarget } from '../src/services/modules/targetResolver';
import {
  describeLingCppModuleContextForAi,
  getBeginnerModuleCodeCompletions,
  getBeginnerModuleCommandHints
} from '../src/services/modules/moduleContextAdapters';
import { InstalledModule } from '../src/services/modules/types';
import { inferWorkspaceRootFromBuildDir, materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { createControlToolboxGroups } from '../src/services/windowDesigner/controlToolboxModel';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { OPENCV_COMMAND_NAMES, OPENCV_MODULE_ID, OPENCV_SDK_MODULE_ID } from '../src/services/modules/opencvModules';
import { normalizeControlReferenceCallSnippet } from '../src/services/modules/bindingValueType';
import { normalizeControlReferenceSourceLiterals } from '../scripts/lib/control-reference-source-audit';

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
      modules: 80,
      commands: 1639,
      parameters: 2888,
      controlReferences: 777,
      commandDigest: '060f2e3b',
      parameterDigest: '34eb9b8f'
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
        assert.equal(parameter.runtimeRepresentation, 'wideName', `${manifest.id}/${binding.command}/${parameter.name} 必须确定性传递宽字符控件名`);
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

test('模块源目录中的 controlRef 补全、示例和代码片段全部保持裸引用', async () => {
  const moduleSourceRoot = path.resolve(process.cwd(), 'src', 'services', 'modules');
  const sourceFiles = await collectModuleSourceFilesForControlRefAudit(moduleSourceRoot);
  const violations: string[] = [];
  for (const filePath of sourceFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    const audit = normalizeControlReferenceSourceLiterals(source, filePath, BUILTIN_MODULES);
    audit.changes.forEach(change => violations.push(`${path.relative(moduleSourceRoot, filePath)}:${change.line}`));
  }
  assert.equal(sourceFiles.length, 28, '模块源文件数量变化时必须重新确认 controlRef 源字面量覆盖范围');
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
    modules: 86,
    commands: 3250,
    parameters: 10461,
    controlReferences: 777,
    commandDigest: 'eb24565d',
    parameterDigest: '425652d1'
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
  assert.deepEqual(binding?.parameters?.map(parameter => parameter.type), ['wideString', 'raw']);
  assert.equal(binding?.returnType, 'wideString');
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
  assert.equal(DATA_MEDIA_MODULES.length, 14);
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
  assert.match(mainCpp, /LB_HASH_PAIR\(SHA256/u);
  assert.match(mainCpp, /const wchar_t\* 哈希_BLAKE3文本/u);
  assert.match(mainCpp, /const wchar_t\* 密码_Argon2id哈希/u);
  assert.match(mainCpp, /LB_AEAD_WRAPPERS\(AES256GCM/u);
  assert.match(mainCpp, /const wchar_t\* 非对称_RSA生成私钥/u);
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
  const commandCount = BUILTIN_MODULES.reduce((total, manifest) => total + (manifest.contributes?.commands?.length ?? 0), 0);
  assert.ok(checklist.includes(`${BUILTIN_MODULES.length} 个内置模块、${commandCount} 条中文命令`));
  assert.match(checklist, /51 个模块、287 条命令/u);
  assert.match(checklist, /`lingbuilder\.std\.encoding` \| 编码转换模块 \| 30/u);
  assert.match(checklist, /`lingbuilder\.win32\.basic` \| Win32 窗口基础模块 \| 39/u);
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

test('all callable FBro modules stay on 2.1.0 and depend on the matching v3 event core', () => {
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
  assert.ok(callable.every(module => module.version === '2.1.0'));
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
  assert.equal(countModuleCommands(family), 426);
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
  assert.equal(catalog.headerCount, 77);
  assert.equal(catalog.signatureCount, 1079);
  assert.equal(catalog.rawDeclarationCount, 1091);
  assert.equal(catalog.signatures.length, 1079);
  assert.ok(catalog.signatures.every(item => ['highLevel', 'advancedSafe', 'internal'].includes(item.classification)
    && ['implemented', 'planned', 'notApplicable'].includes(item.implementationStatus)
    && item.classificationReason.length > 0));
  assert.equal(catalog.signatures.filter(item => item.classification === 'advancedSafe' && item.implementationStatus === 'implemented').length, 341);
  assert.equal(catalog.signatures.filter(item => item.classification === 'advancedSafe' && item.implementationStatus === 'planned').length, 678);
  assert.equal(catalog.signatures.filter(item => item.implementationStatus === 'notApplicable').length, 4);
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
  assert.equal(catalog.eventCatalog.filter(item => item.bridgeStatus === 'implemented').length, 89);
  assert.equal(catalog.eventCatalog.filter(item => item.bridgeStatus === 'managed').length, 76);
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
  assert.equal(manifest.contributes?.commands?.length, 25);
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
  assert.equal(manifest.contributes?.commands?.length, 10);
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
    'FBroHsCookieManager_VisitUrlCookies', 'FBroHsCookieManager_SetCookie',
    'FBroHsCookieManager_DeleteCookies', 'FBroHsCookieManager_FlushStore',
    'FBroHsBrowser_ClearCacheData', 'FBroHsBrowser_ClearGlobalCacheData',
    'FBroHsBrowserHost_StartDownload', 'FBroHsBrowserHost_Print'
  ]) assert.match(bridge, new RegExp(`\\b${symbol}\\b`, 'u'));
  const bridgeHeader = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'), 'utf8');
  const sessionDeclarations = bridgeHeader.match(/LB_FBro_(?:Cookie\w+Async|Clear(?:Global)?CacheAsync)\([^;]+;/gu) || [];
  assert.equal(sessionDeclarations.length, 7);
  assert.ok(sessionDeclarations.every(declaration => !/CefRefPtr|std::|CefCookieManager/u.test(declaration)));
  assert.match(bridge, /LB_FBro_TaskRelease[\s\S]*?status = LB_FBRO_TASK_CANCELLED;[\s\S]*?callback = nullptr;/u);
});

test('FBro Transfer PDF、文件对话框与 VIP 截图使用任务和受管缓冲', async () => {
  const transfer = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.transfer');
  const objects = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.objects');
  assert.ok(transfer);
  assert.ok(objects);
  assert.equal(transfer.contributes?.commands?.length, 5);
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
  assert.equal(manifest.contributes?.commands?.length, 132);
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
  assert.ok(mainCpp.includes('WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS'));
  assert.ok(mainCpp.includes('controller->put_IsVisible(TRUE);'));
  assert.ok(mainCpp.includes('instance.controller->NotifyParentWindowPositionChanged();'));
  assert.ok(mainCpp.includes('SetWindowPos(instance->host, HWND_TOP'));
  assert.ok(mainCpp.includes('if (callback == L"浏览器1_导航完成") { 浏览器1_导航完成(); return; }'));
  assert.ok(mainCpp.includes('EdgeView_创建区域(1, 10, 10, 300, 400, L"https://example.com", L".edgeview/cache-1");'));
  assert.ok(mainCpp.includes('EdgeView_监听开发者工具事件(1, L"Console.messageAdded");'));
});

test('EdgeView 安全 API 目录、binding、处理器补全和运行时符号保持一一对应', () => {
  assert.deepEqual(validateEdgeViewApiCatalog(), []);
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview');
  assert.ok(manifest);
  assert.equal(manifest.version, '1.2.0');
  assert.equal(manifest.minLingBuilderVersion, '0.2.8');
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
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_设置事件结果'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'CEF3_打开原生UI浏览器'));
  assert.ok(manifest.compatibility?.conflicts?.some(item => item.moduleId === 'lingbuilder.fbro.browser'));
  assert.equal(manifest.version, '3.0.0-alpha.2');
  assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-x64']);
  assert.ok(manifest.targets?.[0]?.libs?.some(item => item.endsWith('LingBuilderCefBridge.lib')));
  assert.ok(!manifest.targets?.[0]?.libs?.some(item => item.endsWith('libcef.lib')));
  assert.ok(!manifest.targets?.[0]?.libs?.some(item => item.endsWith('libcef_dll_wrapper.lib')));
  assert.deepEqual(manifest.targets?.[0]?.headers, ['include/LingBuilderCefBridge.h']);
  assert.ok(manifest.targets?.[0]?.runtimeFiles?.some(item => item.endsWith('LingBuilderCefBridge.dll')));
  assert.equal(manifest.bindings?.commands?.find(binding => binding.command === 'CEF3_绑定事件')?.parameters?.[2]?.type, 'handler');
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
  assert.match(cpp, /LB_CEF3_BrowserEvaluateJavaScript/);
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

test('FBro module contributes a toolbox designer control and C ABI generated runtime', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
  assert.ok(manifest);
  assert.equal(validateModuleManifest(manifest).diagnostics.length, 0);
  assert.deepEqual(manifest.targets?.map(target => target.id), ['windows-msvc-x64']);
  assert.ok(manifest.compatibility?.conflicts?.some(item => item.moduleId === 'lingbuilder.cef3.browser'));
  assert.ok(manifest.contributes?.commands?.some(command => command.name === 'FBro_打开谷歌原生UI浏览器'));
  for (const name of ['FBro_是否可后退', 'FBro_是否可前进', 'FBro_是否加载中', 'FBro_取缩放级别',
    'FBro_设置缩放级别', 'FBro_是否静音', 'FBro_设置静音', 'FBro_设置焦点', 'FBro_查找',
    'FBro_停止查找', 'FBro_是否打开开发者工具', 'FBro_关闭开发者工具', 'FBro_强制刷新',
    'FBro_取浏览器标识', 'FBro_是否同一实例', 'FBro_是否弹出窗口', 'FBro_是否有文档',
    'FBro_尝试关闭', 'FBro_设置宿主焦点', 'FBro_是否有视图', 'FBro_设置自动调整大小']) {
    assert.ok(manifest.contributes?.commands?.some(command => command.name === name), `缺少 ${name} contribution`);
    assert.ok(manifest.bindings?.commands?.some(binding => binding.command === name), `缺少 ${name} binding`);
  }
  const designer = manifest.contributes?.designerControls?.find(control => control.type === 'FBroBrowser');
  assert.equal(designer?.label, 'FBro指纹浏览器');
  assert.equal(designer?.nativeAdapter, 'fbro-browser');
  assert.equal(designer?.events?.length, 89);
  assert.ok(designer?.events?.every(event => event.name.startsWith('fbro.event.fbrohsbroevent.')));
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
});

test('FBro bridge serializes browser creation onto the CEF UI thread and contains profiles under root cache', async () => {
  const bridgeSource = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  assert.match(bridgeSource, /CefPostTask\(TID_UI, new BridgeBrowserStartTask\(handle\)\)/u);
  assert.match(bridgeSource, /ResolveProfileDirectory/u);
  assert.match(bridgeSource, /normalized_root \/ \(L"profile-"/u);
  assert.doesNotMatch(bridgeSource, /g_browsers\.emplace\(handle, std::move\(state\)\);\s*StartBrowser\(\*raw\)/u);
  assert.match(bridgeSource, /LB_FBRO_EVENT_BEFORE_POPUP/u);
  assert.match(bridgeSource, /Notify\(\*state, LB_FBRO_EVENT_BEFORE_POPUP, target_url\.ToWString\(\)\)/u);
  assert.match(bridgeSource, /return action != 1;\s*\}\s*void OnBeforeClose/u, '即将打开新窗口默认取消；同步事件显式放行时才创建弹窗');
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

test('FBro v3 continuation JSON keeps escaped quotes inside one UTF-16 module argument', () => {
  const browserManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser');
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
  assert.match(bridgeSource, /SecureZeroMemory\(vip_key/u);
  assert.match(bridgeSource, /g_license_error\.replace/u);
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
    'void LB_FBro_CancelEventContinuation();'
  ].join('\n');
  await writeFixture(path.join(sdk, 'include', 'LingBuilderFbroBridge.h'), `${fbroV3Header}\n`);
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
    schemaVersion: 1, sdkVersion: '135.0.21', architecture: 'x64', bridgeVersion: '2.1.0', files
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

test('FBro and CEF3 are blocked before native dependencies are materialized', async () => {
  const ids = ['lingbuilder.fbro.browser', 'lingbuilder.cef3.browser'];
  const modules = ids.map(id => {
    const manifest = BUILTIN_MODULES.find(item => item.id === id);
    assert.ok(manifest);
    return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, diagnostics: [] } as InstalledModule;
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-fbro-conflict-'));
  try {
    const plan = await materializeModuleNativeDependencies(modules, {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    });
    assert.match(plan.diagnostics.join('\n'), /CEF 135.*CEF 150/u);
    assert.match(plan.blockingDiagnostics.join('\n'), /CEF 135.*CEF 150/u);
    assert.equal(plan.runtimeFiles.length, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
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
  assert.equal(manifest.contributes.designerControls.length, 92);
  assert.equal(manifest.contributes.commands.filter((command: { visibility?: string }) => command.visibility === 'advanced').length, 1573);
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
  const buttonContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Button');
  const tableContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Table');
  const tabsContribution = manifest.contributes.designerControls.find((control: any) => control.type === 'Tabs');
  assert.equal(tabsContribution.previewType, 'TabControl');
  assert.equal(tabsContribution.isContainer, true);
  assert.deepEqual(tabsContribution.layout, {
    mode: 'slots',
    coordinateSpace: 'window',
    adapterId: 'new-emoji.tabs.pages'
  });
  assert.deepEqual(tabsContribution.defaultProps.items, ['标签页 1']);
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
          events: {}
        },
        {
          id: 'tabs', type: tabsContribution.previewType, designerType: tabsContribution.namespacedType,
          name: '功能标签页', content: '标签页', x: 20, y: 320, width: 420, height: 180,
          fontSize: 14, background: 'transparent', foreground: '#FFFFFFFF', isEnabled: true, visibility: 'Visible',
          properties: {
            ...tabsContribution.defaultProps,
            tabs: [{ id: 'overview', title: '概览' }, { id: 'settings', title: '设置' }],
            items: ['概览', '设置'], activeIndex: 0, contentVisible: false
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
        }
      ]
    }]
  }, {
    enabledModules: [installedModule],
    lingCppSourceCode: '包 测试\n类 MainWindow : 窗口\n公开\n  事件 _按钮1_被单击()\n    信息框("按钮", 64, "事件触发")\n    调试输出("点击")\n  结束\n  事件 按钮1_鼠标进入()\n    调试输出("进入")\n  结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /EU_SetButtonStateColors\(/u);
  assert.match(cpp, /static void __stdcall LB_NE_Event_[^(]+\(int\)[\s\S]*信息框\(L"按钮", MB_OK \| MB_ICONINFORMATION, L"事件触发"\)/u);
  assert.match(cpp, /EU_SetElementClickCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetElementMouseCallback\(/u);
  assert.match(cpp, /EU_SetTableColumnAlign\(g_newEmojiWindow/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"概览\|设置"\)/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"概览\\toverview\\t \|设置\\tsettings\\t "\)/u);
  assert.match(cpp, /EU_CreateTabs\(g_newEmojiWindow/u);
  assert.match(cpp, /EU_SetTabsContentVisible\(g_newEmojiWindow, ne_element_3, 1\)/u);
  assert.match(cpp, /int ne_tab_page_3_1 = EU_CreatePanel\(/u);
  assert.match(cpp, /int ne_tab_page_3_2 = EU_CreatePanel\(/u);
  assert.match(cpp, /EU_SetPanelStyle\(g_newEmojiWindow, ne_tab_page_3_1, 0xff242941u, 0x00000000u, 0\.0f, 0\.0f, 0\)/u);
  assert.match(cpp, /EU_SetPanelStyle\(g_newEmojiWindow, ne_tab_page_3_2, 0xff242941u, 0x00000000u, 0\.0f, 0\.0f, 0\)/u);
  assert.match(cpp, /EU_SetTabsPageElements\(g_newEmojiWindow, ne_element_3,/u);
  assert.match(cpp, /EU_CreateButton\(g_newEmojiWindow, ne_tab_page_3_1,/u);
  assert.match(cpp, /EU_CreateButton\(g_newEmojiWindow, ne_tab_page_3_2,/u);
  assert.doesNotMatch(cpp, /EU_SetTabsContentVisible\(g_newEmojiWindow, ne_element_3, 0\)/u);
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
      ['窗口句柄', 'handle'], ['元素ID', 'int'], ['允许多选', 'bool'], ['自动上传', 'bool'],
      ['样式', 'int'], ['显示文件列表', 'bool'], ['显示提示', 'bool'], ['显示操作', 'bool'],
      ['允许拖拽', 'bool'], ['文件数量上限', 'int'], ['单文件上限KB', 'int'], ['允许文件类型', 'wideString']
    ]
  );
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
  assert.match(cpp, /LB_FBro_CreateEx\(browser\.host/u);
  assert.match(cpp, /FBro_导航\(L"FBro浏览器1", L"https:\/\/example\.com"\)/u);
  assert.match(cpp, /ShowWindow\(browser\.host, visible \? SW_SHOW : SW_HIDE\)/u);
  assert.match(cpp, /const UINT dpi = g_newEmojiWindow \? GetDpiForWindow\(g_newEmojiWindow\) : 96/u);
  assert.match(cpp, /scale\(y \+ titleBarLogicalHeight\)/u);
  assert.match(cpp, /if \(!dispatched && \*legacy\) LB_NE_DispatchFbroEvent/u);
  assert.match(cpp, /wWinMain[\s\S]*CoInitializeEx\([^;]+\);\s*if \(!LB_NE_InitializeFbro\(\)\)[\s\S]*g_newEmojiWindow = NE_/u);
  const browserGroup = createControlToolboxGroups(['FBroBrowser'], true).find(group => group.id === 'browser');
  assert.deepEqual(browserGroup?.controlTypes, ['FBroBrowser']);
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
  const sidebarSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(inspectorSource, /onInspect=\{\(\) => inspectModule\(module\.manifest\.id\)\}/);
  assert.match(inspectorSource, /<ModulePublicInfoDialog/);
  assert.doesNotMatch(inspectorSource, /<ModuleDetailPanel/);
  assert.match(dialogSource, /createPortal\(/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /模块公开信息 - \{manifest\.name\}/);
  assert.match(dialogSource, /if \(event\.key === 'Escape'\)/);
  assert.match(dialogSource, /if \(event\.target === event\.currentTarget\) onClose\(\)/);
  assert.match(inspectorSource, /isModuleHiddenByFamily/);
  assert.match(inspectorSource, /moduleIds: standardModuleIds/);
  assert.match(inspectorSource, /内部依赖和只读 SDK 已自动收起/);
  assert.match(dialogSource, /\{family\?\.displayName \|\| '模块'\} 功能范围/);
  assert.match(dialogSource, /启用高级功能/);
  assert.match(dialogSource, /功能分类/);
  assert.match(dialogSource, /function ModuleFamilyFeatureTreeGroup/);
  assert.match(dialogSource, /const commandItems = items\.filter\(item => item\.groupId === 'commands'\)/);
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
