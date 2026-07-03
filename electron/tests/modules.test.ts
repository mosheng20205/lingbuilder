import test from 'node:test';
import assert from 'node:assert/strict';

import { getLingCppCompletions, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';

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
    schemaVersion: 1,
    id: 'com.example.sqlite',
    name: 'SQLite数据库模块',
    version: '1.0.0',
    category: '数据库',
    description: '提供 SQLite 数据库访问能力。',
    contributes: {
      commands: [{ name: '执行SQL', signature: '执行SQL(语句)', description: '执行一条 SQL 语句。' }],
      cpp: { headers: ['include/sqlite_bridge.h'], sources: ['src/sqlite_bridge.cpp'] }
    }
  });

  assert.equal(valid.diagnostics.length, 0);
  assert.equal(valid.manifest?.id, 'com.example.sqlite');

  const invalid = validateModuleManifest({
    schemaVersion: 1,
    id: 'com.example.bad',
    name: '坏模块',
    version: '1.0.0',
    category: '数据库',
    description: '包含不安全路径。',
    contributes: {
      cpp: { headers: ['../secret.h'] }
    }
  });

  assert.ok(invalid.diagnostics.some(message => message.includes('安全')));
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

test('generateLingCppNativeWin32Project emits module dependency report', () => {
  const module: InstalledModule = {
    ...createTestModule(),
    manifest: {
      ...createTestModule().manifest,
      id: 'com.example.native',
      name: '原生扩展模块',
      category: '系统',
      contributes: {
        commands: [{ name: '原生命令', signature: '原生命令()', description: '测试命令。' }],
        cpp: {
          headers: ['include/native_bridge.h'],
          sources: ['src/native_bridge.cpp'],
          libs: ['native_bridge.lib'],
          defines: ['LINGBUILDER_NATIVE_BRIDGE']
        }
      }
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
  assert.ok(mainCpp.includes('#pragma comment(lib, "native_bridge.lib")'));
  assert.ok(moduleReport.includes('原生扩展模块'));
  assert.ok(moduleReport.includes('include/native_bridge.h'));
});

function createTestModule(): InstalledModule {
  return {
    isInstalled: true,
    installPath: 'C:/modules/com.example.sqlite',
    diagnostics: [],
    manifest: {
      schemaVersion: 1,
      id: 'com.example.sqlite',
      name: 'SQLite数据库模块',
      version: '1.0.0',
      category: '数据库',
      description: '提供 SQLite 数据库访问能力。',
      contributes: {
        commands: [{ name: '执行SQL', signature: '执行SQL(语句)', description: '执行 SQL。', insertText: '执行SQL("$1")' }],
        types: [{ name: '数据库连接', description: '数据库连接句柄。' }],
        snippets: [{ label: '打开数据库模板', insertText: '打开数据库("$1")', description: '打开数据库。' }]
      }
    }
  };
}
