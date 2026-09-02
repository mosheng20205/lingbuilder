import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('更新对话框覆盖发现、下载进度、校验、安装与失败重试的完整状态机', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/UpdateDialog.tsx'),
    'utf8'
  );
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /role="progressbar"/u);
  assert.match(source, /role="alert"/u);
  assert.match(source, /发现新版本/u);
  assert.match(source, /立即更新/u);
  assert.match(source, /前往官网下载/u);
  assert.match(source, /稍后再说/u);
  assert.match(source, /后台下载/u);
  assert.match(source, /取消下载/u);
  assert.match(source, /正在校验安装包完整性/u);
  assert.match(source, /立即安装并重启/u);
  assert.match(source, /重试下载/u);
  assert.match(source, /重试安装/u);
  assert.match(source, /updates\?\.download/u);
  assert.match(source, /updates\?\.cancel/u);
  assert.match(source, /updates\?\.install/u);
  assert.match(source, /updates\?\.status/u);
  assert.match(source, /onProgress/u);
  assert.match(source, /bytesPerSecond/u);
  assert.doesNotMatch(source, /window\.confirm/u);
});

test('主进程注册更新 IPC、进度广播与残留清理，且下载入口使用主进程缓存', async () => {
  const mainSource = await fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8');
  assert.match(mainSource, /ipcMain\.handle\('app:check-update'/u);
  assert.match(mainSource, /ipcMain\.handle\('app:update:download'/u);
  assert.match(mainSource, /ipcMain\.handle\('app:update:cancel'/u);
  assert.match(mainSource, /ipcMain\.handle\('app:update:status'/u);
  assert.match(mainSource, /ipcMain\.handle\('app:update:install'/u);
  assert.match(mainSource, /'app-update:progress'/u);
  assert.match(mainSource, /cleanupAbandoned\(\)/u);
  assert.match(mainSource, /updateDownloadService\.download\(lastVersionCheck\)/u);
  assert.match(mainSource, /shutdownAndExit\(0\)/u);

  const preloadSource = await fs.readFile(path.resolve(import.meta.dirname, '../electron/preload.ts'), 'utf8');
  assert.match(preloadSource, /invoke\('app:update:download'\)/u);
  assert.match(preloadSource, /invoke\('app:update:cancel'\)/u);
  assert.match(preloadSource, /invoke\('app:update:status'\)/u);
  assert.match(preloadSource, /invoke\('app:update:install'\)/u);
  assert.match(preloadSource, /on\('app-update:progress'/u);
});

test('检查更新结果携带官网回退与安装包直链，App 命令描述指向应用内更新', async () => {
  const versionCheckSource = await fs.readFile(path.resolve(import.meta.dirname, '../electron/versionCheckService.ts'), 'utf8');
  assert.match(versionCheckSource, /websiteUrl: string/u);
  assert.match(versionCheckSource, /downloadUrl\?: string \| null/u);
  assert.match(versionCheckSource, /sha256\?: string \| null/u);

  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  assert.match(appSource, /import UpdateDialog/u);
  assert.match(appSource, /<UpdateDialog/u);
  assert.match(appSource, /currentVersionLabel=\{LINGBUILDER_DISPLAY_VERSION\}/u);
  assert.match(appSource, /可直接在 IDE 内下载并安装更新/u);
  assert.match(appSource, /Boolean\(updateCheckState\)/u);

  const dialogSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/UpdateDialog.tsx'), 'utf8');
  assert.match(dialogSource, /info\.websiteUrl \|\| OFFICIAL_SITE_URL/u);
});
