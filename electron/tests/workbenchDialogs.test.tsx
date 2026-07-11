import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import CommandPalette from '../src/components/CommandPalette';
import SettingsDialog from '../src/components/SettingsDialog';
import type { CommandPresentation, RegisteredCommand } from '../src/services/commands';
import {
  WORKBENCH_CONFIGURATION_METADATA,
  WORKBENCH_CONFIGURATION_SCHEMA,
  type WorkbenchConfigurationSnapshot
} from '../src/services/configuration';

const commands: CommandPresentation[] = [
  {
    id: 'workbench.action.files.save',
    title: '保存工作区',
    aliases: ['Save Workspace'],
    category: '文件',
    description: '保存当前工作区。',
    keybindings: ['Ctrl+S'],
    keybindingPriority: 0,
    order: 1,
    whenMatched: true,
    enabled: true
  },
  {
    id: 'workbench.action.build.run',
    title: '生成并运行当前项目',
    aliases: ['Build and Run'],
    category: '生成',
    keybindings: ['F5'],
    keybindingPriority: 0,
    order: 2,
    whenMatched: true,
    enabled: false
  }
];

const snapshot: WorkbenchConfigurationSnapshot = {
  schemaVersion: 1,
  settings: WORKBENCH_CONFIGURATION_METADATA.map(metadata => ({
    metadata,
    inspection: {
      key: metadata.key,
      defaultValue: WORKBENCH_CONFIGURATION_SCHEMA[metadata.key].default,
      userValue: undefined,
      workspaceValue: undefined,
      value: WORKBENCH_CONFIGURATION_SCHEMA[metadata.key].default,
      source: 'default'
    }
  })),
  diagnostics: []
};

test('command palette renders an accessible dialog, searchable listbox, command states, and shortcuts', () => {
  const markup = renderToStaticMarkup(
    <CommandPalette
      open
      query="保存"
      commands={commands}
      isDarkMode
      onQueryChange={() => undefined}
      onExecute={async () => true}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /role="combobox"/u);
  assert.match(markup, /role="listbox"/u);
  assert.match(markup, /role="option"/u);
  assert.match(markup, /保存工作区/u);
  assert.match(markup, /Ctrl\+S/u);
  assert.match(markup, /aria-disabled="true"/u);
  assert.match(markup, /关闭命令面板/u);
});

test('closed command palette does not leave a hidden interactive surface', () => {
  const markup = renderToStaticMarkup(
    <CommandPalette
      open={false}
      query=""
      commands={commands}
      isDarkMode
      onQueryChange={() => undefined}
      onExecute={async () => true}
      onClose={() => undefined}
    />
  );
  assert.equal(markup, '');
});

test('settings dialog exposes scope, search, categories, effective values, and reset controls', () => {
  const markup = renderToStaticMarkup(
    <SettingsDialog
      open
      snapshot={snapshot}
      commands={commands as RegisteredCommand[]}
      isDarkMode={false}
      loading={false}
      onUpdate={async () => true}
      onReset={async () => true}
      onClose={() => undefined}
      onReload={async () => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /用户设置适用于所有工作区/u);
  assert.match(markup, /<option value="user" selected="">用户<\/option>/u);
  assert.match(markup, /<option value="workspace">当前工作区<\/option>/u);
  assert.match(markup, /搜索设置、命令或快捷键/u);
  assert.match(markup, /键盘快捷键/u);
  assert.match(markup, /编辑器字号/u);
  assert.match(markup, /恢复默认/u);
});

test('settings dialog renders Chinese loading and failure states', () => {
  const loading = renderToStaticMarkup(
    <SettingsDialog
      open
      snapshot={null}
      commands={[]}
      isDarkMode
      loading
      onUpdate={async () => false}
      onReset={async () => false}
      onClose={() => undefined}
      onReload={async () => undefined}
    />
  );
  assert.match(loading, /role="status"/u);
  assert.match(loading, /正在读取用户与工作区设置/u);

  const failed = renderToStaticMarkup(
    <SettingsDialog
      open
      snapshot={null}
      commands={[]}
      isDarkMode
      loading={false}
      error="模拟读取失败"
      onUpdate={async () => false}
      onReset={async () => false}
      onClose={() => undefined}
      onReload={async () => undefined}
    />
  );
  assert.match(failed, /role="alert"/u);
  assert.match(failed, /模拟读取失败/u);
  assert.match(failed, /重试/u);
});
