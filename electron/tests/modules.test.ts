import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getLingCppCompletions, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { validateModuleManifest } from '../src/services/modules/manifest';
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
  assert.match(vcxproj, /<ClCompile Include="main\.cpp" \/>/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\src\\new_emoji_bridge\.cpp/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\include/);
  assert.match(vcxproj, /modules\\lingbuilder\.new_emoji\.ui\\lib\\Win32\\new_emoji\.lib/);
  assert.match(vcxproj, /new_emoji\.dll/);
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
