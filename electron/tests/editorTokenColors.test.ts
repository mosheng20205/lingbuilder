import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID,
  LINGCPP_COMMENT_TOKEN_COLORS,
  LINGCPP_CONSTANT_TOKEN_COLORS,
  LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS,
  LINGCPP_TOKEN_COLOR_OVERRIDE_VALUE_PATTERN,
  LINGCPP_TOKEN_COLOR_PRESETS,
  LINGCPP_TOKEN_COLOR_ROLE_META,
  getActiveLingCppTokenColorSettings,
  getLingCppCommentTokenColor,
  getLingCppConstantTokenColor,
  getLingCppControlReferenceTokenColor,
  getLingCppStringTokenColor,
  getLingCppTokenColorOverrideKey,
  getLingCppTokenColorPreset,
  getLingCppTokenColorRoleForKind,
  normalizeLingCppTokenColorSettings,
  resolveLingCppTokenColor,
  resolveLingCppTokenColors,
  setActiveLingCppTokenColorSettings,
  subscribeLingCppTokenColorSettings
} from '../src/services/lingCpp/semanticTheme';
import { getEplTokenColorTheme } from '../src/services/eplTokenizer';

const HEX = /^#[0-9a-fA-F]{6}$/u;

test('默认「翠绿」预设逐条复刻历史硬编码令牌色，未自定义时渲染不变', () => {
  const preset = getLingCppTokenColorPreset('default');
  assert.equal(preset.id, DEFAULT_LINGCPP_TOKEN_COLOR_PRESET_ID);
  assert.equal(preset.colors.comment.light, LINGCPP_COMMENT_TOKEN_COLORS.light);
  assert.equal(preset.colors.comment.dark, LINGCPP_COMMENT_TOKEN_COLORS.dark);
  assert.equal(preset.colors.constant.light, LINGCPP_CONSTANT_TOKEN_COLORS.light);
  assert.equal(preset.colors.constant.dark, LINGCPP_CONSTANT_TOKEN_COLORS.dark);
  assert.equal(preset.colors.controlReference.light, LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light);
  assert.equal(preset.colors.controlReference.dark, LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark);
  assert.equal(preset.colors.local.light, '#047857');
  assert.equal(preset.colors.local.dark, '#9df59c');
  assert.equal(preset.colors.keyword.light, '#1d4ed8');
  assert.equal(preset.colors.moduleCommand.dark, '#22d3ee');
});

test('每个预设都为全部令牌角色提供合法的亮/暗颜色，角色元数据与角色一一对应', () => {
  const ids = LINGCPP_TOKEN_COLOR_PRESETS.map(preset => preset.id);
  assert.deepEqual(new Set(ids).size, ids.length, '预设 id 不得重复');

  const roleSet = new Set(LINGCPP_TOKEN_COLOR_ROLE_META.map(meta => meta.role));
  for (const preset of LINGCPP_TOKEN_COLOR_PRESETS) {
    const presetRoles = Object.keys(preset.colors);
    assert.equal(presetRoles.length, roleSet.size, `预设 ${preset.id} 必须覆盖全部角色`);
    for (const [role, pair] of Object.entries(preset.colors)) {
      assert.ok(roleSet.has(role as never), `预设 ${preset.id} 的角色 ${role} 必须在 UI 元数据中登记`);
      assert.match(pair.light, HEX, `预设 ${preset.id}.${role}.light 必须是 #rrggbb`);
      assert.match(pair.dark, HEX, `预设 ${preset.id}.${role}.dark 必须是 #rrggbb`);
    }
  }
});

test('normalize 丢弃未知角色、未知模式与非法颜色，并把合法颜色归一为小写', () => {
  assert.deepEqual(normalizeLingCppTokenColorSettings(null), { themeId: 'default', overrides: {} });
  assert.deepEqual(normalizeLingCppTokenColorSettings([1, 2]), { themeId: 'default', overrides: {} });

  const normalized = normalizeLingCppTokenColorSettings({
    themeId: 'vscode',
    overrides: {
      'local.light': '#AABBCC',
      'comment.dark': '#010203',
      'bogus.light': '#010203',
      'local.mid': '#010203',
      'local.dark': 'blue',
      'procedure.light': '#abc',
      'constant.light': 123
    }
  });
  assert.equal(normalized.themeId, 'vscode');
  assert.deepEqual(normalized.overrides, {
    'local.light': '#aabbcc',
    'comment.dark': '#010203'
  });
});

test('resolve 依次消费覆盖色与预设色，未知主题回退默认预设', () => {
  const settings = { themeId: 'vscode', overrides: { [getLingCppTokenColorOverrideKey('local', 'dark')]: '#010203' } };
  assert.equal(resolveLingCppTokenColor('local', settings, true), '#010203');
  assert.equal(resolveLingCppTokenColor('local', settings, false), '#001080', '亮色不受暗色覆盖影响');

  const fallback = getLingCppTokenColorPreset('不存在');
  assert.equal(fallback.id, 'default');
  assert.equal(
    resolveLingCppTokenColor('keyword', { themeId: '不存在', overrides: {} }, false),
    getLingCppTokenColorPreset('default').colors.keyword.light
  );

  const palette = resolveLingCppTokenColors({ themeId: 'default', overrides: {} }, true);
  assert.equal(palette.comment, LINGCPP_COMMENT_TOKEN_COLORS.dark);
  assert.equal(typeof palette.controlReference, 'string');
  assert.match(LINGCPP_TOKEN_COLOR_OVERRIDE_VALUE_PATTERN.test('#A1B2C3') ? 'ok' : 'bad', /ok/u);
});

test('令牌语义类型到配色角色的映射保持与新手编辑器 kind 一致', () => {
  assert.equal(getLingCppTokenColorRoleForKind('module-command'), 'moduleCommand');
  assert.equal(getLingCppTokenColorRoleForKind('control-reference'), 'controlReference');
  assert.equal(getLingCppTokenColorRoleForKind('native-marker'), 'nativeMarker');
  assert.equal(getLingCppTokenColorRoleForKind('identifier'), 'identifier');
  assert.equal(getLingCppTokenColorRoleForKind('local'), 'local');
});

test('活动设置存储只在有效内容变化时通知，语义色 getter 即时反映覆盖', () => {
  const previous = getActiveLingCppTokenColorSettings();
  try {
    let notifications = 0;
    const unsubscribe = subscribeLingCppTokenColorSettings(() => { notifications += 1; });

    assert.equal(setActiveLingCppTokenColorSettings({ themeId: previous.themeId, overrides: previous.overrides }), false, '相同设置不通知');
    assert.equal(notifications, 0);

    assert.equal(setActiveLingCppTokenColorSettings({
      themeId: 'default',
      overrides: { 'comment.dark': '#0a0b0c' }
    }), true, '新设置通知订阅者');
    assert.equal(notifications, 1);
    assert.equal(getLingCppCommentTokenColor(true), '#0a0b0c');
    assert.equal(getLingCppCommentTokenColor(false), LINGCPP_COMMENT_TOKEN_COLORS.light, '亮色不受暗色覆盖影响');
    assert.equal(getLingCppConstantTokenColor(true), LINGCPP_CONSTANT_TOKEN_COLORS.dark);
    assert.equal(getLingCppControlReferenceTokenColor(false), LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light);

    setActiveLingCppTokenColorSettings({ themeId: 'ocean', overrides: { 'string.light': '#A1B2C3' } });
    assert.equal(getLingCppStringTokenColor(false), '#a1b2c3');

    unsubscribe();
    setActiveLingCppTokenColorSettings({ themeId: 'default', overrides: {} });
    assert.equal(notifications, 2, '退订后不再通知');
  } finally {
    setActiveLingCppTokenColorSettings(previous);
  }
  assert.deepEqual(getActiveLingCppTokenColorSettings(), previous);
});

test('EPL 结构编辑器主题消费活动调色板：默认对齐历史常量，覆盖后跟随', () => {
  const previous = getActiveLingCppTokenColorSettings();
  try {
    const defaultTheme = getEplTokenColorTheme(true);
    assert.equal(defaultTheme.comment, LINGCPP_COMMENT_TOKEN_COLORS.dark);
    assert.equal(defaultTheme.constant, LINGCPP_CONSTANT_TOKEN_COLORS.dark);

    setActiveLingCppTokenColorSettings({ themeId: 'vscode', overrides: { 'comment.light': '#123456' } });
    const customLight = getEplTokenColorTheme(false);
    assert.equal(customLight.comment, '#123456');
    assert.equal(customLight.variable, getLingCppTokenColorPreset('vscode').colors.local.light);
  } finally {
    setActiveLingCppTokenColorSettings(previous);
  }
});
