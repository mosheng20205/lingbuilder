import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('source control panel exposes staging, commit, branch, history and blame actions', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SourceControlPanel.tsx'), 'utf8');
  assert.match(source, /Git 源代码管理/u); assert.match(source, /提交已暂存更改/u); assert.match(source, /\/api\/source-control\/stage/u); assert.match(source, /\/api\/source-control\/unstage/u);
  assert.match(source, /\/api\/source-control\/commit/u); assert.match(source, /\/api\/source-control\/branches/u); assert.match(source, /\/api\/source-control\/history/u); assert.match(source, /\/api\/source-control\/blame/u);
  assert.match(source, /新建分支/u); assert.match(source, /role="alert"/u);
  assert.match(source, /\/api\/source-control\/(?:fetch|pull|push)/u); assert.match(source, /\/api\/source-control\/(?:merge|rebase)/u);
  assert.match(source, /\/api\/source-control\/conflicts/u); assert.match(source, /\/api\/source-control\/pull-requests/u); assert.match(source, /创建 PR/u);
  assert.match(source, /三方冲突编辑/u); assert.match(source, /保存合并结果/u); assert.match(source, /conflicts\/file/u);
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
});

test('solution explorer visually groups projects apart from their child nodes', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.match(source, /data-solution-project=/u);
  assert.match(source, /mb-2 last:mb-0 overflow-hidden rounded-md border/u);
  assert.match(source, /flex min-h-8 items-center/u);
});
