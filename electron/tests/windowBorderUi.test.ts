import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const [designerSource, serviceSource] = await Promise.all([
  fs.readFile(path.resolve(import.meta.dirname, '../src/components/WpfDesigner.tsx'), 'utf8'),
  fs.readFile(path.resolve(import.meta.dirname, '../src/services/windowDesigner/windowDesignerService.ts'), 'utf8')
]);

test('属性面板边框下拉锚定：统一选项来源、拖动开关、最大化禁用、缩放开关禁用', () => {
  assert.ok(designerSource.includes('DEFAULT_WINDOW_BORDER_STYLE'));
  assert.ok(designerSource.includes('LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => ('));
  assert.ok(designerSource.includes('label="允许拖动移动窗口"'));
  assert.ok(designerSource.includes("disabled={(window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE) === 'none'}"));
  assert.ok(designerSource.includes("disabled={option.flag === 0x08 && (window.borderStyle || DEFAULT_WINDOW_BORDER_STYLE) === 'none'}"));
  assert.ok(!designerSource.includes('label="禁止拖拽调整大小"'));
});

test('边框切换与缩放 flag 同步 borderStyle 派生', () => {
  assert.ok(designerSource.includes('const hasSizingBorder = deriveLingWindowBorderStyle(borderStyle);'));
  assert.ok(designerSource.includes('resizable: hasSizingBorder,'));
  assert.ok(!designerSource.includes("maximizable: borderStyle === 'none'"));
  assert.ok(designerSource.includes('toggleBorderFamily(window.borderStyle, enabled)'));
});

test('windowFrame 派生与内容偏移统一消费边框映射', () => {
  assert.ok(designerSource.includes('normalizeLingWindowFrame(window.windowFrame, deriveLingWindowBorderStyle(window.borderStyle), window.cornerStyle)'));
  assert.ok(serviceSource.includes('resolveLingWindowBorder(window.borderStyle, true).captionKind'));
  assert.ok(serviceSource.includes("captionKind === 'thin' ? DESIGNER_THIN_TITLE_BAR_HEIGHT : DESIGNER_TITLE_BAR_HEIGHT"));
});
