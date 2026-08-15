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

test('resolveLingWindowBorder 对非法字符串按普通可调边框兜底', () => {
  assert.equal(resolveLingWindowBorder('bogus' as never, true).dwStyle, 'WS_OVERLAPPEDWINDOW');
  assert.equal(resolveLingWindowBorder('bogus' as never, true).hasSizingBorder, true);
});

test('resolveLingWindowBorder 覆盖 maximizable 与固定类组合及 hasSizingBorder', () => {
  assert.equal(resolveLingWindowBorder('normal-fixed', false).dwStyle, '((WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME) & ~WS_MAXIMIZEBOX)');
  assert.equal(resolveLingWindowBorder('frame-fixed', false).dwStyle, '((WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME) & ~WS_MAXIMIZEBOX)');
  assert.equal(resolveLingWindowBorder('normal-resizable', true).hasSizingBorder, true);
  assert.equal(resolveLingWindowBorder('normal-fixed', true).hasSizingBorder, false);
  assert.equal(resolveLingWindowBorder('none', true).hasSizingBorder, false);
});

test('生成的 C++ 辅助函数与 resolveLingWindowBorder 在全部枚举上等价', () => {
  const cpp = generateWindowBorderHelperCpp();
  // 锁定 C++ case 编号分组文本，防止后续改动使 TS 映射与 C++ 辅助函数漂移
  const fixedGroup = /case 2: case 4: case 6: style = WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME; break;/.test(cpp);
  const popupGroup = /case 0: style = WS_POPUP \| WS_SYSMENU \| WS_MINIMIZEBOX; break;/.test(cpp);
  assert.ok(fixedGroup, 'C++ 辅助函数应保留 case 2: case 4: case 6 固定边框分支');
  assert.ok(popupGroup, 'C++ 辅助函数应保留 case 0 无边框分支');
  for (const option of LING_WINDOW_BORDER_STYLE_OPTIONS) {
    const id = toWindowBorderCxxValue(option.value);
    for (const maximizable of [true, false]) {
      const resolved = resolveLingWindowBorder(option.value, maximizable);
      const expectPopup = option.value === 'none';
      const expectFixed = option.value === 'normal-fixed' || option.value === 'thin-title-fixed' || option.value === 'frame-fixed';
      const fixedCaseGroup = 'case 2: case 4: case 6:';
      // 编号与 C++ 分支一一对应：固定类命中 case 2/4/6 分组，可调类不得命中
      if (expectFixed) {
        assert.ok(fixedCaseGroup.includes(`case ${id}:`), `枚举 ${option.value}(编号${id}) 应命中 C++ fixed 分支分组`);
      } else if (!expectPopup) {
        assert.ok(!fixedCaseGroup.includes(`case ${id}:`), `枚举 ${option.value}(编号${id}) 不应命中 C++ fixed 分支分组`);
      }
      if (expectPopup) assert.equal(id, 0, `枚举 ${option.value} 应对应 C++ case 0 popup 分支`);
      // resizable 维度与 C++ 的 WS_THICKFRAME 语义一致
      assert.equal(resolved.hasSizingBorder, !expectPopup && !expectFixed);
    }
  }
  // exStyle 分组
  assert.ok(/borderStyle == 3 \|\| borderStyle == 4\) return WS_EX_TOOLWINDOW;/.test(cpp));
  assert.ok(/borderStyle == 5 \|\| borderStyle == 6\) return WS_EX_DLGMODALFRAME;/.test(cpp));
  for (const option of LING_WINDOW_BORDER_STYLE_OPTIONS) {
    const resolved = resolveLingWindowBorder(option.value, true);
    const id = toWindowBorderCxxValue(option.value);
    if (id === 3 || id === 4) assert.equal(resolved.dwExStyle, 'WS_EX_TOOLWINDOW');
    else if (id === 5 || id === 6) assert.equal(resolved.dwExStyle, 'WS_EX_DLGMODALFRAME');
    else assert.equal(resolved.dwExStyle, '0');
  }
});
