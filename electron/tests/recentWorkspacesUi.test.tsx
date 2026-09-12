import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('欢迎页支持搜索最近工作区并进入全部工作区选择器', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/WelcomePage.tsx'),
    'utf8'
  );
  assert.match(source, /搜索最近工作区/u);
  assert.match(source, /搜索工作区名称或路径…/u);
  assert.match(source, /data-welcome-workspace-search/u);
  assert.match(source, /清空工作区搜索/u);
  assert.match(source, /查看全部（共 \{recentWorkspaces\.length\} 个）…/u);
  assert.match(source, /data-welcome-show-all-workspaces/u);
  assert.match(source, /没有匹配「\{workspaceQuery\.trim\(\)\}」的工作区/u);
  assert.match(source, /onForgetWorkspace: \(workspacePath: string\) => void \| Promise<void>/u);
  assert.match(source, /<RecentWorkspacesDialog/u);
  assert.match(source, /initialQuery=\{workspaceQuery\}/u);
  assert.match(source, /onForgetWorkspace=\{workspacePath => \{ void onForgetWorkspace\(workspacePath\); \}\}/u);
});

test('全部最近工作区选择器支持过滤、键盘选择、移除单条并可访问', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/RecentWorkspacesDialog.tsx'),
    'utf8'
  );
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /aria-labelledby="recent-workspaces-dialog-title"/u);
  assert.match(source, /aria-label="搜索最近工作区"/u);
  assert.match(source, /data-recent-workspace-search/u);
  assert.match(source, /data-recent-workspace-list/u);
  assert.match(source, /data-recent-workspace=\{workspacePath\}/u);
  assert.match(source, /aria-label=\{`从最近列表移除 \$\{workspaceLabel\(workspacePath\)\}`\}/u);
  assert.match(source, /event\.key === 'Escape'/u);
  assert.match(source, /event\.key === 'ArrowDown'/u);
  assert.match(source, /event\.key === 'ArrowUp'/u);
  assert.match(source, /event\.key === 'Enter'/u);
  assert.match(source, /全部最近工作区/u);
  assert.match(source, /暂无最近工作区/u);
  assert.match(source, /没有匹配「\{query\.trim\(\)\}」的工作区/u);
  assert.match(source, /共 \{recentWorkspaces\.length\} 个工作区/u);
});

test('欢迎页与工作台文件菜单都接入选择器，移除动作走 forgetRecent IPC', async () => {
  const [appSource, serviceSource, preloadSource, mainSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/workspaceService.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/preload.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8')
  ]);
  assert.match(appSource, /const handleForgetRecentWorkspace = async \(workspacePath: string\): Promise<void> =>/u);
  assert.match(appSource, /await workspaceApi\.forgetRecent\(workspacePath\)/u);
  assert.match(appSource, /setRecentWorkspaces\(await workspaceApi\.listRecent\(\)\)/u);
  assert.match(appSource, /onForgetWorkspace=\{handleForgetRecentWorkspace\}/u);
  assert.match(appSource, /const \[showRecentWorkspacesDialog, setShowRecentWorkspacesDialog\] = useState\(false\)/u);
  assert.match(appSource, /更多最近工作区…/u);
  assert.match(serviceSource, /export const RECENT_WORKSPACES_LIMIT = 200/u);
  assert.match(serviceSource, /slice\(0, RECENT_WORKSPACES_LIMIT\)/u);
  assert.match(preloadSource, /forgetRecent: \(workspacePath: string\) => ipcRenderer\.invoke\('workspace:forget-recent', workspacePath\)/u);
  assert.match(mainSource, /ipcMain\.handle\('workspace:forget-recent'/u);
});
