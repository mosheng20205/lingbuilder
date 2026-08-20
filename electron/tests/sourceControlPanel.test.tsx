import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('source control panel exposes staging, commit, branch, history and blame actions', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  assert.match(source, /Git 源代码管理/u); assert.match(source, /提交已暂存更改/u); assert.match(source, /mutate\('stage'/u); assert.match(source, /mutate\('unstage'/u);
  assert.match(source, /mutate\('commit'/u); assert.match(source, /\/api\/source-control\/branches/u); assert.match(source, /\/api\/source-control\/history/u); assert.match(source, /\/api\/source-control\/blame/u);
  assert.match(source, /新建分支/u); assert.match(source, /role="alert"/u);
  assert.match(source, /mutate\('fetch'/u); assert.match(source, /mutate\('pull'/u); assert.match(source, /mutate\('push'/u); assert.match(source, /openIntegrationDialog\('merge'/u); assert.match(source, /openIntegrationDialog\('rebase'/u);
  assert.match(source, /\/api\/source-control\/conflicts/u); assert.match(source, /pull-request\.create/u); assert.match(source, /创建 PR/u);
  assert.match(source, /三方冲突编辑/u); assert.match(source, /保存合并结果/u); assert.match(source, /conflicts\/file/u);
});

test('source control panel completes diff, discard, repository initialization, remote management and refresh flows', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  assert.match(source, /\/api\/source-control\/diff/u); assert.match(source, /查看工作区差异/u); assert.match(source, /查看已暂存差异/u);
  assert.match(source, /mutate\('discard'/u); assert.match(source, /将从磁盘永久删除且无法撤销/u); assert.match(source, /初始化仓库/u); assert.match(source, /mutate\('init'/u);
  assert.match(source, /添加远程/u); assert.match(source, /remote\.add/u); assert.match(source, /remote\.update/u); assert.match(source, /remote\.remove/u);
  assert.match(source, /visibilitychange/u); assert.match(source, /addEventListener\('focus'/u); assert.match(source, /disabled=\{busy\}/u);
  assert.match(source, /aria-modal="true"/u); assert.match(source, /git-dialog-title/u); assert.doesNotMatch(source, /window\.(?:prompt|confirm|alert)/u);
});

test('sidebar renders the real source control panel instead of a status-only badge', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.match(source, /<SourceControlPanel/u); assert.doesNotMatch(source, /Git: 当前目录未检测到可用仓库状态/u);
  assert.match(source, /handleTabClick\('git'\)/u); assert.match(source, />Git更改</u);
  assert.match(source, /variant="full"/u); assert.match(source, /aria-label="打开 Git 更改"/u);
});

test('Git changes view separates working and staged files and exposes a command entry', async () => {
  const panel = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  const app = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  assert.match(panel, /更改 <span/u); assert.match(panel, /已暂存的更改/u);
  assert.match(panel, /工作树是干净的/u); assert.match(panel, /variant === 'full'/u);
  assert.match(app, /workbench\.action\.git\.openChanges/u); assert.match(app, /lingbuilder-open-git-changes/u);
  assert.match(app, /workbench\.action\.git\.execute/u); assert.match(panel, /onExecuteCommand/u);
});

test('source control panel exposes stash, tag, history pagination and side-by-side diff features', async () => {
  const panel = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  const sidebar = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.match(panel, /贮藏栈/u); assert.match(panel, /mutate\('stash\.save'/u); assert.match(panel, /mutate\('stash\.apply'/u); assert.match(panel, /mutate\('stash\.drop'/u);
  assert.match(panel, /没有贮藏条目/u);
  assert.match(panel, /新建 Git 标签/u); assert.match(panel, /mutate\('tag\.create'/u); assert.match(panel, /mutate\('tag\.delete'/u); assert.match(panel, /没有本地标签/u);
  assert.match(panel, /加载更多/u); assert.match(panel, /已加载全部提交/u);
  assert.match(panel, /DiffEditor/u); assert.match(panel, /renderSideBySide/u); assert.match(panel, /并排差异视图/u); assert.match(panel, /补丁文本视图/u);
  assert.match(panel, /activeFilePath/u);
  assert.match(panel, /groupByDirectory/u); assert.match(panel, /toggleCollapsedGroup/u); assert.match(panel, /aria-expanded=\{!collapsed\}/u);
  assert.match(panel, /\/api\/source-control\/stashes/u); assert.match(panel, /\/api\/source-control\/tags/u);
  assert.match(sidebar, /activeFilePath=\{activeFile\?\.path/u);
});

test('source control panel surfaces remote address entry and bulk staging actions in the changes view', async () => {
  const panel = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  assert.match(panel, /未设置推送地址，点击配置/u); assert.match(panel, /远程同步<\/button>/u);
  assert.match(panel, /跟踪远程分支/u); assert.match(panel, /远程仓库（推送\/拉取地址设置）/u);
  assert.match(panel, /mutate\('stage\.all'/u); assert.match(panel, /mutate\('unstage\.all'/u);
  assert.match(panel, />全部暂存</u); assert.match(panel, />全部取消暂存</u);
  assert.match(panel, /暂存全部并提交/u);
  assert.match(panel, /暂存此文件/u); assert.match(panel, /取消暂存此文件/u);
  assert.doesNotMatch(panel, /type="checkbox"/u);
  assert.doesNotMatch(panel, /selectedWorkingPaths/u); assert.doesNotMatch(panel, /selectedStagedPaths/u);
});

test('solution explorer visually groups projects apart from their child nodes', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.match(source, /data-solution-project=/u);
  assert.match(source, /mb-2 last:mb-0 overflow-hidden rounded-md border/u);
  assert.match(source, /flex min-h-8 items-center/u);
});
