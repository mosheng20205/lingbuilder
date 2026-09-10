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

test('标题栏升级徽标：静默检查驱动徽标与悬浮更新说明，点击接入应用内更新', async () => {
  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  // 徽标状态与点击动作：保存检查载荷，点击复用现有更新对话框。
  assert.match(appSource, /const \[updateBadgePayload, setUpdateBadgePayload\]/u);
  assert.match(appSource, /setUpdateCheckState\(createUpdateDialogInfo\(updateBadgePayload\)\)/u);
  // 徽标与悬浮面板渲染在标题栏：排除窗口拖拽区，悬浮面板展示版本号与更新说明。
  assert.match(appSource, /window-no-drag relative flex shrink-0 items-center/u);
  assert.match(appSource, /发现新版本 v\{updateBadgePayload\.latestVersion/u);
  assert.match(appSource, /\{updateBadgePayload\.releaseNotes \|\|/u);
  // 启动静默检查保留首启弹窗，并增加周期复查只刷新徽标。
  assert.match(appSource, /runSilentUpdateCheck\(true\), 5000\)/u);
  assert.match(appSource, /runSilentUpdateCheck\(false\), 30 \* 60 \* 1000\)/u);
  // 手动「检查更新」命令与徽标状态同步：已是最新时清除徽标。
  assert.match(appSource, /setUpdateBadgePayload\(result\.hasUpdate \? result : null\);/u);
});
