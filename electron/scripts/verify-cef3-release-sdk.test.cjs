const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  collectDirectoryInventory,
  compareInventories,
  crc32File,
  parseSevenZipListing
} = require('./verify-cef3-release-sdk.cjs');
const beforePackHook = require('./verify-cef3-before-pack.cjs');
const afterPackHook = require('./verify-cef3-after-pack.cjs');

test('Electron Builder 钩子从 packager.projectDir 解析仓库根目录', () => {
  const electronProjectDir = path.resolve(__dirname, '..');
  const expected = path.resolve(electronProjectDir, '..');
  const context = { packager: { projectDir: electronProjectDir } };
  assert.equal(beforePackHook.resolveProjectRoot(context), expected);
  assert.equal(afterPackHook.resolveProjectRoot(context), expected);
});

test('CRC32 与目录清单可精确检测发布文件变化', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cef-release-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, 'sdk'), { recursive: true });
  await fsp.writeFile(path.join(root, 'sdk', 'sample.bin'), Buffer.from('CEF3-release-check', 'utf8'));
  assert.equal(await crc32File(path.join(root, 'sdk', 'sample.bin')), 'B2DD832E');
  const expected = await collectDirectoryInventory(root);
  compareInventories(expected, new Map(expected), '测试目录');
  const changed = new Map(expected);
  changed.set('sdk/sample.bin', { size: 18, crc32: '00000000' });
  assert.throws(() => compareInventories(expected, changed, '测试目录'), /不一致/u);
});

test('7-Zip 列表解析保留路径、大小和 CRC', () => {
  const parsed = parseSevenZipListing([
    'Path = resources\\default-workspace\\.lingbuilder\\modules\\lingbuilder.cef3.sdk\\sdk\\Release\\libcef.dll',
    'Size = 275568128',
    'Packed Size = 79785823',
    'Attributes = A',
    'CRC = D4C82DCA',
    '',
    'Path = resources\\default-workspace\\.lingbuilder\\modules\\lingbuilder.cef3.sdk\\sdk\\Resources',
    'Size = 0',
    'Attributes = D',
    'CRC = ',
    ''
  ].join('\r\n'));
  assert.deepEqual(parsed.get('resources\\default-workspace\\.lingbuilder\\modules\\lingbuilder.cef3.sdk\\sdk\\Release\\libcef.dll'), {
    size: 275568128,
    crc32: 'D4C82DCA',
    isDirectory: false
  });
});
