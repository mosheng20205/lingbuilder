import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditorColorSettings } from '../src/components/SettingsDialog';
import {
  WORKBENCH_CONFIGURATION_METADATA,
  WORKBENCH_CONFIGURATION_SCHEMA,
  type WorkbenchConfigurationSnapshot
} from '../src/services/configuration';
import type { ConfigurationValue } from '../src/services/configuration/types';

function createSnapshot(overrides: {
  themeUserValue?: ConfigurationValue;
  overridesUserValue?: ConfigurationValue;
}): WorkbenchConfigurationSnapshot {
  return {
    schemaVersion: 1,
    settings: WORKBENCH_CONFIGURATION_METADATA.map(metadata => ({
      metadata,
      inspection: {
        key: metadata.key,
        defaultValue: WORKBENCH_CONFIGURATION_SCHEMA[metadata.key].default,
        userValue: metadata.key === 'editor.tokenTheme'
          ? overrides.themeUserValue
          : metadata.key === 'editor.tokenColorOverrides'
            ? overrides.overridesUserValue
            : undefined,
        workspaceValue: undefined,
        value: WORKBENCH_CONFIGURATION_SCHEMA[metadata.key].default,
        source: 'default'
      }
    })),
    diagnostics: []
  };
}

test('编辑器颜色分区渲染主题选择、双模式预览与全部令牌角色行', () => {
  const markup = renderToStaticMarkup(
    <EditorColorSettings
      snapshot={createSnapshot({})}
      target="user"
      isDarkMode={false}
      fieldClass="field"
      mutedClass="muted"
      onUpdate={async () => true}
      onReset={async () => true}
    />
  );

  assert.match(markup, /id="editor-token-theme"/u, '主题下拉必须存在');
  assert.match(markup, /<option value="default"/u);
  assert.match(markup, /<option value="eyuyan"/u);
  assert.match(markup, /<option value="vscode"/u);
  assert.match(markup, /<option value="ocean"/u);
  assert.match(markup, /aria-label="亮色预览"/u);
  assert.match(markup, /aria-label="暗色预览"/u);
  assert.match(markup, /恢复当前作用域默认/u);
  assert.match(markup, /代码令牌/u);
  assert.match(markup, /内嵌 C\+\+（@ 行）/u);
  assert.match(markup, /关键字/u);
  assert.match(markup, /局部变量与参数/u);
  assert.match(markup, /注释/u);
  assert.match(markup, /控件引用/u);
  assert.match(markup, /aria-label="亮色颜色"/u);
  assert.match(markup, /aria-label="暗色颜色"/u);
  assert.match(markup, /aria-label="恢复亮色默认"/u);
  assert.match(markup, /继承自默认值/u, '未覆盖时必须如实显示继承来源');
});

test('用户覆盖的颜色让对应恢复按钮可用，未覆盖单元格保持禁用', () => {
  const markup = renderToStaticMarkup(
    <EditorColorSettings
      snapshot={createSnapshot({
        themeUserValue: 'vscode',
        overridesUserValue: { 'comment.light': '#123456', 'local.dark': '#654321' }
      })}
      target="user"
      isDarkMode
      fieldClass="field"
      mutedClass="muted"
      onUpdate={async () => true}
      onReset={async () => true}
    />
  );

  assert.match(markup, /<option value="vscode" selected="">/u);
  assert.match(markup, /用户覆盖/u);
  // React 按属性顺序渲染：disabled 按钮形如 `<button type="button" disabled="" aria-label=…>`，
  // 可用按钮没有 disabled 前缀，借此统计可单独恢复的单元格数。
  const enabledResetCount = (markup.match(/<button type="button" aria-label="恢复(?:亮色|暗色)默认"/gu) || []).length;
  assert.equal(enabledResetCount, 2, '只有被覆盖的两个单元格允许单独恢复');

  const withoutOverrides = renderToStaticMarkup(
    <EditorColorSettings
      snapshot={createSnapshot({})}
      target="user"
      isDarkMode
      fieldClass="field"
      mutedClass="muted"
      onUpdate={async () => true}
      onReset={async () => true}
    />
  );
  const enabledWithoutOverrides = (withoutOverrides.match(/<button type="button" aria-label="恢复(?:亮色|暗色)默认"/gu) || []).length;
  assert.equal(enabledWithoutOverrides, 0, '无覆盖时全部恢复按钮禁用');
});
