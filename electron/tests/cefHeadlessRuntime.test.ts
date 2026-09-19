import test from 'node:test';
import assert from 'node:assert/strict';

import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

// 无头运行时段与「无 HWND」扫描都针对 LingWindowBase 里无条件生成的 CEF3 运行时，
// 因此用例源码只放普通控制台程序体（不调用尚未登记的中文命令，避免未知命令诊断污染
// blockingDiagnostics 断言）。Task 9 复用本文件里的 project() 与 SOURCE 常量。
export const SOURCE = [
  '包 无头演示',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    调试输出("无头演示")',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');

export function project(): LingWindowProject {
  return {
    schemaVersion: 2,
    id: 'headless-demo',
    name: '无头示例',
    resources: [],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '程序',
      title: '无头示例', width: 640, height: 420, background: '#1e1e1e',
      description: '', designerBackend: 'win32', controls: []
    }]
  };
}

export function mainCpp(): string {
  const generated = generateLingCppNativeWin32Project(project(), {
    lingCppSourceCode: SOURCE,
    outputKind: 'console-application'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  return generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
}

test('headless creation goes through the windowless bridge export', () => {
  const code = mainCpp();
  assert.match(code, /static const int CEF3_运行时无头编号偏移 = 2000000;/);
  assert.match(code, /LB_CEF3_BROWSER_WINDOWLESS/);
  assert.match(code, /LB_CEF3_BROWSER_CONFIG_V4/);
  assert.match(code, /LB_CEF3_BrowserCreateWindowless\(/);
  assert.match(code, /bridgeConfig\.parent_window = 0;/);
  assert.match(code, /bridgeConfig\.osr_width = /);
});

test('headless runtime never creates an HWND', () => {
  const code = mainCpp();
  const start = code.indexOf('int CEF3_创建无头浏览器');
  const end = code.indexOf('int CEF3_创建弹窗浏览器');
  assert.ok(start >= 0 && end > start);
  const headlessBody = code.slice(start, end);
  // 先跑禁止令牌：命中即说明无头创建里混进了窗口或句柄转换。
  // hwnd_ 与 reinterpret_cast 必须在列——控制台/窗口入口都有隐藏的无头泵窗口 HWND，
  // 把 bridgeConfig.parent_window = reinterpret_cast<uint64_t>(hwnd_) 写进这里
  // 就是「隐窗伪装真无头」，正是本红线要拦的那个回归。
  for (const banned of [
    'CreateWindowExW', 'RegisterClassExW', 'ShowWindow', 'SetWindowPos',
    'LB_CEF3_BrowserCreateChrome', 'hwnd_', 'parent_window = reinterpret_cast', 'reinterpret_cast'
  ]) {
    assert.ok(!headlessBody.includes(banned), `无头创建路径不得出现 ${banned}`);
  }
  // 正向断言同样只针对无头函数体切片：parent_window = 0; 这行文本在弹窗创建路径里
  // 同样存在（CEF3_创建弹窗浏览器），整份文件匹配等于恒真、抓不住任何回归。
  assert.match(headlessBody, /bridgeConfig\.parent_window = 0;/);
  assert.match(headlessBody, /LB_CEF3_BrowserCreateWindowless\(&bridgeConfig\)/);
  assert.match(headlessBody, /LB_CEF3_BROWSER_WINDOWLESS/);
});

test('headless instances are addressed by instance number and released on shutdown', () => {
  const code = mainCpp();
  assert.match(code, /CefBrowserInstance\* CEF3_查找无头实例\(int instanceId\)/);
  assert.match(code, /CEF3_运行时无头编号偏移 \+ instanceId/);
  assert.match(code, /void LingBuilder_CEF3_关闭全部无头实例\(\)/);
  assert.match(code, /LB_CEF3_BrowserClose\(/);
  assert.match(code, /LB_CEF3_HandleRelease\(/);
});

test('instance enumeration reports the creation mode and the instance-level close covers headless keys', () => {
  const code = mainCpp();
  assert.match(code, /const wchar_t\* mode = L"control";/);
  assert.match(code, /instance\.controlId >= CEF3_运行时无头编号偏移\) mode = L"windowless";/);
  assert.match(code, /mode = instance\.host \? L"region" : L"chrome-popup";/);
  assert.match(code, /\+ L"," \+ q \+ L"mode" \+ q \+ L":" \+ q \+ mode \+ q/);
  // CEF3_关闭全部实例 必须先走无头专用回收（OSR 句柄 + map 条目），再交给通用关闭。
  const closeAllInstances = code.slice(
    code.indexOf('int CEF3_关闭全部实例() {'),
    code.indexOf('void LingBuilder_CEF3_退出回收() {')
  );
  assert.ok(closeAllInstances.includes('LingBuilder_CEF3_关闭全部无头实例();'), '实例级关闭必须覆盖无头键段');
  assert.ok(closeAllInstances.indexOf('LingBuilder_CEF3_关闭全部无头实例();') < closeAllInstances.indexOf('CEF3_关闭全部();'));
});

test('windowed exit recycle dereferences only registry-validated instances', () => {
  // 窗口入口才有 wWinMain 的 HWND 反查链路：无头实例回收要解引用 this，
  // 因此裸 GWLP_USERDATA 指针必须先过存活登记校验（HWND 值可能被回收给别的窗口）。
  const generated = generateLingCppNativeWin32Project(project(), { lingCppSourceCode: SOURCE });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const code = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(code, /while \(GetMessageW/u);
  assert.match(code, /LingBuilder_取存活实例\(LingWindowBase::FromMessageWindow\(startWindow\)\)/u);
  assert.doesNotMatch(code, /\? LingWindowBase::FromMessageWindow\(startWindow\) : nullptr;/u);
  assert.match(code, /LingBuilder_登记存活实例\(this\);/u);
  assert.match(code, /LingBuilder_注销存活实例\(this\);/u);
});
