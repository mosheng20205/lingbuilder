import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LING_WINDOW_BORDER_STYLE_OPTIONS,
  deriveLingWindowBorderStyle,
  generateWindowBorderHelperCpp,
  normalizeLingWindowBorderStyle,
  resolveLingWindowBorder,
  toWindowBorderCxxValue
} from '../src/services/windowDesigner/windowBorderStyle';

test('边框枚举选项与易语言 7 值一致', () => {
  assert.deepEqual(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.label), [
    '无边框', '普通可调边框', '普通固定边框', '窄标题可调边框', '窄标题固定边框', '镜框式可调边框', '镜框式固定边框'
  ]);
  assert.deepEqual(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.value), [
    'none', 'normal-resizable', 'normal-fixed', 'thin-title-resizable', 'thin-title-fixed', 'frame-resizable', 'frame-fixed'
  ]);
});

test('resolveLingWindowBorder 返回 Win32 宏表达式', () => {
  assert.equal(resolveLingWindowBorder('none', true).dwStyle, 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX');
  assert.equal(resolveLingWindowBorder('none', true).dwExStyle, '0');
  assert.equal(resolveLingWindowBorder('none', true).hasCaption, false);
  assert.equal(resolveLingWindowBorder('normal-resizable', true).dwStyle, 'WS_OVERLAPPEDWINDOW');
  assert.equal(resolveLingWindowBorder('normal-fixed', true).dwStyle, '(WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME)');
  assert.equal(resolveLingWindowBorder('thin-title-resizable', true).dwExStyle, 'WS_EX_TOOLWINDOW');
  assert.equal(resolveLingWindowBorder('thin-title-resizable', true).captionKind, 'thin');
  assert.equal(resolveLingWindowBorder('thin-title-fixed', true).dwExStyle, 'WS_EX_TOOLWINDOW');
  assert.equal(resolveLingWindowBorder('frame-resizable', true).dwExStyle, 'WS_EX_DLGMODALFRAME');
  assert.equal(resolveLingWindowBorder('frame-fixed', true).dwExStyle, 'WS_EX_DLGMODALFRAME');
  assert.equal(resolveLingWindowBorder('normal-resizable', false).dwStyle, '(WS_OVERLAPPEDWINDOW & ~WS_MAXIMIZEBOX)');
  assert.equal(resolveLingWindowBorder('none', false).dwStyle, 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX');
  assert.equal(resolveLingWindowBorder(undefined, true).dwStyle, 'WS_OVERLAPPEDWINDOW');
});

test('deriveLingWindowBorderStyle 按枚举派生 resizable', () => {
  assert.equal(deriveLingWindowBorderStyle('none'), false);
  assert.equal(deriveLingWindowBorderStyle('normal-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('normal-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle('thin-title-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('thin-title-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle('frame-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('frame-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle(undefined), true);
});

test('normalizeLingWindowBorderStyle 迁移旧项目', () => {
  assert.equal(normalizeLingWindowBorderStyle(undefined, false), 'normal-fixed');
  assert.equal(normalizeLingWindowBorderStyle(undefined, true), 'normal-resizable');
  assert.equal(normalizeLingWindowBorderStyle(undefined, undefined), 'normal-resizable');
  assert.equal(normalizeLingWindowBorderStyle('none', false), 'none');
});

test('toWindowBorderCxxValue 对齐易语言编号', () => {
  assert.equal(toWindowBorderCxxValue('none'), 0);
  assert.equal(toWindowBorderCxxValue('normal-resizable'), 1);
  assert.equal(toWindowBorderCxxValue('normal-fixed'), 2);
  assert.equal(toWindowBorderCxxValue('thin-title-resizable'), 3);
  assert.equal(toWindowBorderCxxValue('thin-title-fixed'), 4);
  assert.equal(toWindowBorderCxxValue('frame-resizable'), 5);
  assert.equal(toWindowBorderCxxValue('frame-fixed'), 6);
});

test('generateWindowBorderHelperCpp 生成 C++ 辅助函数', () => {
  const code = generateWindowBorderHelperCpp();
  assert.ok(code.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(code.includes('LB_WindowBorderStyleToDwExStyle'));
  assert.ok(code.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(code.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));
  assert.ok(code.includes('WS_EX_TOOLWINDOW'));
  assert.ok(code.includes('WS_EX_DLGMODALFRAME'));
});
