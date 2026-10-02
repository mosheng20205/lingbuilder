/**
 * 运行时拆分与按族裁剪的形态契约（2026-09-30 生成器瘦身改造）：
 * - 拆分形态：main.cpp 只含用户窗口/事件代码与入口，Win32 运行时基座在 lingbuilder_runtime.h；
 *   两文件仍编译为单一翻译单元（main.cpp #include 头文件），运行期语义与旧单文件一致。
 * - 裁剪：EdgeView/FBro/CEF3 家族运行时只在对应模块族启用时生成；
 *   未启用项目连浏览器族文本都不携带（不含依赖、不含死代码）。
 * - cef3.browser 项目走单文件形态（CEF3 桥接后处理作用于整份文档）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { buildGoldenFixtures } from './goldenFixtures';

function moduleById(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id)!;
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

const BUTTON_FIXTURE = buildGoldenFixtures().find(fixture => fixture.name === 'button-only')!;

function buttonProjectWithModules(ids: string[]): { project: LingWindowProject; enabledModules: InstalledModule[] } {
  return {
    project: BUTTON_FIXTURE.project,
    enabledModules: ids.map(moduleById)
  };
}

test('拆分形态：main.cpp 只含用户代码与入口，运行时在 lingbuilder_runtime.h', () => {
  const generated = generateLingCppNativeWin32Project(BUTTON_FIXTURE.project, BUTTON_FIXTURE.options);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  const header = generated.files.find(file => file.relativePath === 'lingbuilder_runtime.h')!.content;

  // main.cpp：横幅 + include + 用户窗口类 + 入口，百行级
  assert.match(mainCpp, /^\/\/ 由 LingBuilder 生成：本文件只包含窗口\/事件代码与程序入口。/u);
  assert.match(mainCpp, /#include "lingbuilder_runtime\.h"/u);
  assert.match(mainCpp, /class MainWindow : public LingWindowBase \{/u);
  assert.match(mainCpp, /_按钮1_被单击/u);
  assert.match(mainCpp, /wWinMain\(/u);
  const mainLines = mainCpp.split('\n').length;
  assert.ok(mainLines < 400, `main.cpp 应保持百行级，实际 ${mainLines} 行`);

  // 运行时头：基座类在头文件，且带 #pragma once 与生成说明
  assert.match(header, /^\/\/ 由 LingBuilder 生成的 Win32 运行时基座。/u);
  assert.match(header, /#pragma once/u);
  assert.match(header, /class LingWindowBase \{/u);
  assert.ok(header.split('\n').length > mainLines, '运行时头应远大于 main.cpp');

  // manifest 文件清单声明头文件；sourceMap 的用户类条目仍指向 main.cpp
  const manifest = JSON.parse(generated.files.find(file => file.relativePath === 'lingbuilder-native-manifest.json')!.content);
  assert.ok(manifest.files.includes('lingbuilder_runtime.h'), 'manifest.files 应包含 lingbuilder_runtime.h');
  const classEntry = manifest.sourceMap.find((entry: { kind: string }) => entry.kind === 'class');
  assert.equal(classEntry?.generatedFile, 'main.cpp', '用户类 sourceMap 条目应指向 main.cpp');
});

test('裁剪：未启用浏览器模块时三族运行时整族缺席，入口也不含浏览器调用', () => {
  const generated = generateLingCppNativeWin32Project(BUTTON_FIXTURE.project, BUTTON_FIXTURE.options);
  const all = generated.files.map(file => file.content).join('\n');
  for (const absent of [
    'int EdgeView_创建(',
    'FBro_查找实例(',
    'CEF3_确保实例(',
    'class LingCefClient final',
    'LB_FBro_BufferToHex'
  ]) {
    assert.ok(!all.includes(absent), `未启用浏览器模块时不应生成 ${absent}`);
  }
  // OnWindowCreated 按族裁剪后不再调用浏览器创建
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  const header = generated.files.find(file => file.relativePath === 'lingbuilder_runtime.h')!.content;
  for (const doc of [mainCpp, header]) {
    assert.ok(!doc.includes('EdgeView_创建控件'), 'OnWindowCreated 不应再含 EdgeView 创建调用');
    assert.ok(!doc.includes('CEF3_创建('), 'OnWindowCreated 不应再含 CEF3 创建调用');
    assert.ok(!doc.includes('FBro_创建('), 'OnWindowCreated 不应再含 FBro 创建调用');
  }
  // 窗口事件照常派发：创建完毕与按钮事件调用链仍在
  assert.match(header, /时钟_启动默认组件\(\); WarnUnboundControlEvents\(\); DispatchWindowEvent\(L"Loaded"\);/u);
});

test('裁剪：启用 FBro 模块后 FBro 族运行时随族回归', () => {
  const { project, enabledModules } = buttonProjectWithModules(['lingbuilder.fbro.browser']);
  const generated = generateLingCppNativeWin32Project(project, { ...BUTTON_FIXTURE.options, enabledModules });
  const header = generated.files.find(file => file.relativePath === 'lingbuilder_runtime.h')!.content;
  assert.match(header, /FBro_查找实例\(const wchar_t\* controlName\)/u);
  // 其他两族仍然缺席
  assert.ok(!header.includes('int EdgeView_创建('), '未启用 EdgeView 时其运行时不应生成');
  assert.ok(!header.includes('class LingCefClient final'), '未启用 CEF3 时其运行时不应生成');
});

test('cef3.browser 项目走单文件形态：无独立头文件，整份文档在 main.cpp', () => {
  const { project, enabledModules } = buttonProjectWithModules(['lingbuilder.cef3.browser']);
  const generated = generateLingCppNativeWin32Project(project, { ...BUTTON_FIXTURE.options, enabledModules });
  assert.ok(!generated.files.some(file => file.relativePath === 'lingbuilder_runtime.h'), '单文件形态不应产出运行时头');
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(mainCpp, /class LingWindowBase \{/u, '单文件形态的 main.cpp 应携带完整运行时');
  assert.match(mainCpp, /class MainWindow : public LingWindowBase \{/u);
  const manifest = JSON.parse(generated.files.find(file => file.relativePath === 'lingbuilder-native-manifest.json')!.content);
  assert.ok(!manifest.files.includes('lingbuilder_runtime.h'), '单文件形态 manifest 不应声明头文件');
});

test('家族判定按模块 ID 前缀：cef3 子模块（platform）同样带回 CEF3 族运行时', () => {
  const { project, enabledModules } = buttonProjectWithModules(['lingbuilder.cef3.platform']);
  const generated = generateLingCppNativeWin32Project(project, { ...BUTTON_FIXTURE.options, enabledModules });
  const header = generated.files.find(file => file.relativePath === 'lingbuilder_runtime.h')!.content;
  assert.match(header, /CEF3_确保实例\(int controlId\)/u, 'cef3 子模块启用时 CEF3 族运行时应在场');
});
