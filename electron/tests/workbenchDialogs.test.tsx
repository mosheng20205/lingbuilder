import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import CommandPalette from '../src/components/CommandPalette';
import SettingsDialog from '../src/components/SettingsDialog';
import ProjectNameDialog from '../src/components/ProjectNameDialog';
import ProjectTypeDialog from '../src/components/ProjectTypeDialog';
import ProjectBuildPropertiesDialog, { resolveProjectBuildKindInfo } from '../src/components/ProjectBuildPropertiesDialog';
import WorkbenchConfirmDialog from '../src/components/WorkbenchConfirmDialog';
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

test('recovery confirmation uses an in-app dialog instead of blocking window.confirm', () => {
  const markup = renderToStaticMarkup(
    <WorkbenchConfirmDialog
      open
      title="发现未保存的编辑"
      description={"检测到 2026/8/16 12:00:00 保存的未保存编辑。\n恢复只会进入编辑器内存，不会立即覆盖磁盘。"}
      confirmLabel="恢复"
      cancelLabel="不恢复"
      isDarkMode
      onResult={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /发现未保存的编辑/u);
  assert.match(markup, /恢复只会进入编辑器内存/u);
  assert.match(markup, /恢复/u);
  assert.match(markup, /不恢复/u);
});

test('closed workbench confirm dialog does not leave a hidden interactive surface', () => {
  const markup = renderToStaticMarkup(
    <WorkbenchConfirmDialog
      open={false}
      title="发现未保存的编辑"
      isDarkMode
      onResult={() => undefined}
    />
  );

  assert.equal(markup, '');
});

test('workbench alert dialog renders a single acknowledge button without cancel', () => {
  const markup = renderToStaticMarkup(
    <WorkbenchConfirmDialog
      open
      kind="alert"
      title="操作已被阻止"
      description="该项目结构文件不能在 IDE 中删除。"
      confirmLabel="知道了"
      isDarkMode
      onResult={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /操作已被阻止/u);
  assert.match(markup, /知道了/u);
  assert.doesNotMatch(markup, /type="button"[^>]*>\s*<\/button>\s*<button/u, 'alert 模式只应有一个按钮');
  assert.equal((markup.match(/<button/gu) || []).length, 1, 'alert 模式应只有一个按钮');
});

test('workbench prompt dialog renders a labelled input and both buttons', () => {
  const markup = renderToStaticMarkup(
    <WorkbenchConfirmDialog
      open
      kind="prompt"
      title="重命名文件"
      description="输入新的文件名。"
      inputLabel="新名称"
      inputValue="MainWindow.xml"
      inputPlaceholder="请输入名称"
      confirmLabel="重命名"
      cancelLabel="取消"
      isDarkMode
      onResult={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-label="新名称"/u);
  assert.match(markup, /placeholder="请输入名称"/u);
  assert.match(markup, /value="MainWindow\.xml"/u);
  assert.equal((markup.match(/<button/gu) || []).length, 2, 'prompt 模式应有取消与确认两个按钮');
});

test('welcome project type dialog exposes Windows UI, DLL and console projects', () => {
  const markup = renderToStaticMarkup(
    <ProjectTypeDialog
      open
      isDarkMode
      onSelectWindowsUi={() => undefined}
      onSelectWindowsDll={() => undefined}
      onSelectWindowsConsole={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /Windows 界面设计/u);
  assert.match(markup, /Windows 平台 DLL 开发/u);
  assert.match(markup, /Windows 控制台程序/u);
  assert.match(markup, /Mac 界面设计/u);
  assert.match(markup, /Mac 平台动态库开发/u);
  assert.match(markup, /Mac 控制台程序/u);
  assert.match(markup, /data-project-type="windows-ui"(?![^>]*\sdisabled="")/u);
  assert.match(markup, /data-project-type="windows-dll"(?![^>]*\sdisabled="")/u);
  assert.match(markup, /data-project-type="windows-console"(?![^>]*\sdisabled="")/u);
  assert.match(markup, /data-project-type="mac-ui"[^>]*\sdisabled=""/u);
  assert.match(markup, /data-project-type="mac-library"[^>]*\sdisabled=""/u);
  assert.match(markup, /data-project-type="mac-console"[^>]*\sdisabled=""/u);
  assert.equal((markup.match(/>规划中</gu) || []).length, 3);
  assert.match(markup, /当前开放 Windows 界面设计、Windows 平台 DLL 开发和 Windows 控制台程序/u);
});

test('closed project type dialog does not leave a hidden interactive surface', () => {
  const markup = renderToStaticMarkup(
    <ProjectTypeDialog
      open={false}
      isDarkMode
      onSelectWindowsUi={() => undefined}
      onSelectWindowsDll={() => undefined}
      onSelectWindowsConsole={() => undefined}
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

test('busy create dialog keeps a cancel escape hatch only when the caller supports cancelling', () => {
  const cancellableMarkup = renderToStaticMarkup(
    <ProjectNameDialog
      open
      value="LingBuilder项目20"
      isDarkMode
      busy
      onChange={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
      onCancelBusy={() => undefined}
    />
  );

  assert.match(cancellableMarkup, /正在创建…/u);
  assert.match(cancellableMarkup, /<button type="button"[^>]*>取消等待<\/button>/u, 'busy 且支持取消时，取消按钮应保持可点击');
  assert.match(cancellableMarkup, /<button type="submit" disabled=""/u, 'busy 时确认按钮仍应禁用');
  assert.doesNotMatch(cancellableMarkup, /仍在等待本地服务响应/u, '10 秒无响应提示在静态渲染中不应立即出现');

  const legacyMarkup = renderToStaticMarkup(
    <ProjectNameDialog
      open
      value="LingBuilder项目20"
      isDarkMode
      busy
      onChange={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );
  assert.match(legacyMarkup, /<button type="button" disabled=""[^>]*>取消<\/button>/u, '未提供取消回调时保持旧的禁用行为');
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

test('project build properties dialog names the project kind (EXE / DLL / console / module)', () => {
  assert.match(resolveProjectBuildKindInfo('visual-cpp').title, /Windows 界面程序（EXE）/u);
  assert.match(resolveProjectBuildKindInfo('visual-cpp', 'dll').title, /动态链接库（DLL）/u);
  assert.match(resolveProjectBuildKindInfo('windows-dll', 'dll').title, /动态链接库（DLL）/u);
  assert.match(resolveProjectBuildKindInfo('windows-console').title, /控制台程序（EXE）/u);
  assert.match(resolveProjectBuildKindInfo('external-msbuild').title, /MSBuild 外部工程（EXE）/u);
  assert.match(resolveProjectBuildKindInfo('external-cmake', 'dll').title, /CMake 外部工程（DLL）/u);
});

test('build properties dialog shows the type box and editable configuration for DLL projects', () => {
  const markup = renderToStaticMarkup(
    <ProjectBuildPropertiesDialog
      open
      isDarkMode
      projectName="DLL项目2"
      projectType="windows-dll"
      outputType="dll"
      editable
      initialValue={{ configuration: 'Debug', architecture: 'Win32', additionalArgumentsText: '' }}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /data-role="project-kind"/u);
  assert.match(markup, /动态链接库（DLL）/u);
  assert.match(markup, /aria-label="构建模式"/u);
  assert.match(markup, /aria-label="构建架构"/u);
  assert.match(markup, /aria-label="附加参数"/u);
  assert.match(markup, /保存/u);
});

test('build properties dialog is read-only for window projects and flags module dev sources', () => {
  const markup = renderToStaticMarkup(
    <ProjectBuildPropertiesDialog
      open
      isDarkMode
      projectName="问候项目"
      projectType="visual-cpp"
      editable={false}
      workspaceEffectiveLabel="Debug · Win32（跟随工作区构建配置）"
      linkedModule={{ id: 'lingbuilder.demo.greeter', name: '问候模块' }}
      initialValue={{ configuration: 'Debug', architecture: 'Win32', additionalArgumentsText: '' }}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );

  assert.match(markup, /Windows 界面程序（EXE）/u);
  assert.match(markup, /Debug · Win32（跟随工作区构建配置）/u);
  assert.match(markup, /data-role="linked-module"/u);
  assert.match(markup, /lingbuilder\.demo\.greeter/u);
  assert.match(markup, /模块项目/u);
  assert.doesNotMatch(markup, /aria-label="构建模式"/u);
  assert.match(markup, /关闭/u);
});
