const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('安装器和卸载器在升级前关闭全部 LingBuilder Electron 进程', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'installer', 'installer.nsh'), 'utf8');
  assert.match(source, /!macro customCheckAppRunning/u);
  assert.match(source, /!macro StopLingBuilderProcesses/u);
  assert.match(source, /\$\{APP_EXECUTABLE_FILENAME\}/u);
  assert.match(source, /nsProcess::_CloseProcess/u);
  assert.match(source, /nsProcess::_FindProcess/u);
  assert.match(source, /!macro SkipLegacyLingBuilderUninstaller/u);
  assert.match(source, /DeleteRegValue HKCU/u);
  assert.match(source, /\$\{UNINSTALL_APP_KEY\}/u);
  assert.match(source, /!macro customUnInstallCheck/u);
  assert.match(source, /继续执行覆盖安装/u);
  assert.match(source, /lingbuilder\.cef3\.sdk\\sdk/u);
  assert.match(source, /lingbuilder\.fbro\.sdk\\sdk/u);
  assert.doesNotMatch(source, /-EncodedCommand/u);
  assert.match(source, /以管理员身份重新运行/u);
});

test('解压后核对核心文件并在被锁时修复（customFiles_x64，注册表写入前）', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'installer', 'installer.nsh'), 'utf8');
  assert.match(source, /!macro customFiles_x64/u);
  assert.match(source, /!macro LbCompareAsarWithPackage/u);
  assert.match(source, /Function LbGetFileSizeBytes/u);
  // 兜底直解压会删 7z-out：修复前必须先重解压权威副本再比对/补拷。
  assert.match(source, /Nsis7z::Extract "\$PLUGINSDIR\\app-64\.\$\{COMPRESSION_METHOD\}"/u);
  // 改名让位（.lb-stale）是绕开运行中 exe / 被持有 asar 文件锁的核心手法，失败必须回滚。
  assert.match(source, /\.lb-stale/u);
  assert.match(source, /Rename "\$INSTDIR\\LingBuilder\.exe" "\$INSTDIR\\LingBuilder\.exe\.lb-stale"/u);
  assert.match(source, /Rename "\$INSTDIR\\resources\\app\.asar" "\$INSTDIR\\resources\\app\.asar\.lb-stale"/u);
  // 3 轮修复仍失败：中文中止弹窗 + 退出码 87，且发生在 registryAddInstallInfo 之前（不写假注册表）。
  assert.match(source, /安装已中止：核心程序文件/u);
  assert.match(source, /SetErrorLevel 87/u);
  assert.match(source, /任务管理器/u);
});
