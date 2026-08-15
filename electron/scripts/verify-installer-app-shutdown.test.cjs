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
