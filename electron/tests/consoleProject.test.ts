import test from 'node:test';
import assert from 'node:assert/strict';

import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { createVisualStudioProjectExportContent } from '../src/services/windowDesigner/visualStudioProjectExporter';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const CONSOLE_SOURCE = [
  '包 控制台程序',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    调试输出("你好，LingBuilder 控制台！")',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');

function createConsoleDesignerProject(className = '程序'): LingWindowProject {
  return {
    schemaVersion: 2,
    id: 'console-demo',
    name: '控制台示例',
    resources: [],
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className,
      title: '控制台示例 控制台',
      width: 640,
      height: 420,
      background: '#1e1e1e',
      description: '控制台模板宿主窗口（不创建）',
      designerBackend: 'win32',
      controls: []
    }]
  };
}

test('console entry guards the CEF subprocess before running the program body', () => {
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: CONSOLE_SOURCE,
    outputKind: 'console-application'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 守卫必须早于程序体，且先于运行时初始化（子进程只需返回退出码）。
  const guard = mainCpp.indexOf('lingbuilder_cef3_子进程守卫');
  const body = mainCpp.indexOf('consoleApp.启动()');
  assert.ok(guard >= 0, '缺少 CEF3 子进程守卫');
  assert.ok(body >= 0);
  assert.ok(guard < body, 'CEF3 子进程守卫必须在启动() 之前');
  assert.match(mainCpp, /cefExitCode >= 0/u);
  // 退出必须回收 CEF，否则无头实例与子进程残留。
  assert.ok(mainCpp.indexOf('consoleApp.LingBuilder_CEF3_退出回收()') > body, '退出回收必须在启动() 之后');
});

test('console application output generates a wmain entry that calls the 启动 method', () => {
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: CONSOLE_SOURCE,
    outputKind: 'console-application'
  });

  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /int wmain\(int argc, wchar_t\* argv\[\]\)/u);
  assert.doesNotMatch(mainCpp, /wWinMain/u);
  assert.match(mainCpp, /SetConsoleOutputCP\(CP_UTF8\)/u);
  assert.match(mainCpp, /LingBuilder_EnsureConsoleRuntimeInitialized\(\)/u);
  assert.match(mainCpp, /LingBuilder_控制台应用单例_程序\(\)/u);
  assert.match(mainCpp, /consoleApp\.启动\(\)/u);
  assert.doesNotMatch(mainCpp, /consoleApp\.启动\(\);\s*\n\s*return 0;/u);
  // 控制台程序不进入消息循环，wWinMain 入口被控制台入口段替换。
  assert.doesNotMatch(mainCpp, /while \(GetMessageW/u);
});

test('console entry supports 空 return type and returns zero', () => {
  const source = CONSOLE_SOURCE.replace('整数型 启动()', '空 启动()').replace('返回 (0)\n', '');
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: source,
    outputKind: 'console-application'
  });

  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /consoleApp\.启动\(\);\s*\n\s*return 0;/u);
});

test('console application missing the 启动 method is blocked with a Chinese diagnostic', () => {
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: '包 控制台程序\n\n类 程序\n公开\n结束类\n',
    outputKind: 'console-application'
  });

  assert.equal(generated.blockingDiagnostics.length, 1);
  assert.match(generated.blockingDiagnostics[0]!, /控制台程序缺少入口/u);
});

test('console application with multiple 启动 methods is blocked', () => {
  const source = `${CONSOLE_SOURCE}\n类 备用程序\n公开\n  整数型 启动()\n    返回 (1)\n  结束\n结束类\n`;
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: source,
    outputKind: 'console-application'
  });

  assert.match(generated.blockingDiagnostics.join('\n'), /控制台程序入口不唯一/u);
});

test('console entry with an unsupported return type is blocked', () => {
  const source = CONSOLE_SOURCE.replace('整数型 启动()', '逻辑型 启动()');
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: source,
    outputKind: 'console-application'
  });

  assert.match(generated.blockingDiagnostics.join('\n'), /返回值类型必须是“整数型”或“空”/u);
});

test('console generation aligns the generated window class with the renamed startup class', () => {
  const source = CONSOLE_SOURCE.replace('类 程序', '类 我的控制台程序');
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject('MainWindow'), {
    lingCppSourceCode: source,
    outputKind: 'console-application'
  });

  assert.deepEqual(generated.blockingDiagnostics, []);
  assert.equal(generated.selectedWindow.className, '我的控制台程序');
  assert.equal(generated.diagnostics.some(item => item.includes('未定义设计器窗口类')), false);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /LingBuilder_控制台应用单例_我的控制台程序\(\)/u);
  assert.match(mainCpp, /consoleApp\.启动\(\)/u);
});

test('console application Visual Studio project declares the Console subsystem', () => {
  const content = createVisualStudioProjectExportContent({
    projectDir: '.',
    projectId: 'console-demo',
    generatedFiles: [{ relativePath: 'main.cpp', content: CONSOLE_SOURCE }],
    enabledModules: [],
    projectKind: 'console-application'
  });
  const vcxproj = content.files.find(file => file.relativePath.endsWith('.vcxproj'))?.content || '';

  assert.match(vcxproj, /<ConfigurationType>Application<\/ConfigurationType>/u);
  assert.match(vcxproj, /<SubSystem>Console<\/SubSystem>/u);
  assert.doesNotMatch(vcxproj, /<SubSystem>Windows<\/SubSystem>/u);
});
