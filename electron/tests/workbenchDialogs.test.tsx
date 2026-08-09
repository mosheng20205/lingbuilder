import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import CommandPalette from '../src/components/CommandPalette';
import SettingsDialog from '../src/components/SettingsDialog';
import ProjectNameDialog from '../src/components/ProjectNameDialog';
import ProjectTypeDialog from '../src/components/ProjectTypeDialog';
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

test('new solution project uses an in-app input dialog instead of a browser prompt', () => {
  const markup = renderToStaticMarkup(
    <ProjectNameDialog
      open
      value="LingBuilder项目3"
      isDarkMode
      onChange={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /新建解决方案项目/u);
  assert.match(markup, /aria-label="项目名称"/u);
  assert.match(markup, /LingBuilder项目3/u);
  assert.match(markup, /创建项目/u);
});

test('welcome project type dialog exposes one available Windows UI project and three planned types', () => {
  const markup = renderToStaticMarkup(
    <ProjectTypeDialog
      open
      isDarkMode
      onSelectWindowsUi={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /Windows 界面设计/u);
  assert.match(markup, /Windows 平台 DLL 开发/u);
  assert.match(markup, /Mac 界面设计/u);
  assert.match(markup, /Mac 平台动态库开发/u);
  assert.match(markup, /data-project-type="windows-ui"(?![^>]*\sdisabled="")/u);
  assert.match(markup, /data-project-type="windows-dll"[^>]*\sdisabled=""/u);
  assert.match(markup, /data-project-type="mac-ui"[^>]*\sdisabled=""/u);
  assert.match(markup, /data-project-type="mac-library"[^>]*\sdisabled=""/u);
  assert.equal((markup.match(/>规划中</gu) || []).length, 3);
  assert.match(markup, /当前仅开放 Windows 界面设计/u);
});

test('closed project type dialog does not leave a hidden interactive surface', () => {
  const markup = renderToStaticMarkup(
    <ProjectTypeDialog
      open={false}
      isDarkMode
      onSelectWindowsUi={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.equal(markup, '');
});

test('solution folders and project rename reuse the in-app name dialog', () => {
  const folderMarkup = renderToStaticMarkup(
    <ProjectNameDialog
      open
      value="工具集合"
      isDarkMode
      title="新建解决方案文件夹"
      description="创建逻辑文件夹，不移动项目文件。"
      label="文件夹名称"
      confirmLabel="创建文件夹"
      dialogId="solution-folder-title"
      inputId="solution-folder-name"
      onChange={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );
  const renameMarkup = renderToStaticMarkup(
    <ProjectNameDialog
      open
      value="中文工具项目"
      isDarkMode
      title="重命名项目"
      description="项目 ID 和磁盘路径保持不变。"
      label="新的项目名称"
      confirmLabel="确认重命名"
      dialogId="rename-project-title"
      inputId="rename-project-name"
      onChange={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(folderMarkup, /新建解决方案文件夹/u);
  assert.match(folderMarkup, /aria-label="文件夹名称"/u);
  assert.match(folderMarkup, /创建文件夹/u);
  assert.match(renameMarkup, /重命名项目/u);
  assert.match(renameMarkup, /aria-label="新的项目名称"/u);
  assert.match(renameMarkup, /确认重命名/u);
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
