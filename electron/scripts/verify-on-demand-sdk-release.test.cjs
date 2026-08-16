const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { EXCLUDED_MODULE_IDS, verifyUnpacked } = require('./verify-on-demand-sdk-release.cjs');

test('严格精简发布目录不包含 CEF3 或 FBro 模块且拒绝夹带运行时', async t => {
  const appOutDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-slim-sdk-'));
  t.after(() => fsp.rm(appOutDir, { recursive: true, force: true }));
  const aria2Root = path.join(appOutDir, 'resources', 'third_party', 'aria2');
  await fsp.mkdir(aria2Root, { recursive: true });
  await fsp.writeFile(path.join(aria2Root, 'aria2c.exe'), Buffer.alloc(1_000_000));
  await fsp.writeFile(path.join(aria2Root, 'COPYING'), '# GPLv2\n'.padEnd(1_000, '许可'));
  await fsp.writeFile(path.join(aria2Root, 'NOTICE.md'), '# aria2\n'.padEnd(200, '来源说明'));
  const result = await verifyUnpacked(appOutDir);
  assert.equal(result.modules.length, 2);
  const moduleRoot = path.join(appOutDir, 'resources', 'default-workspace', '.lingbuilder', 'modules', EXCLUDED_MODULE_IDS[0]);
  await fsp.mkdir(moduleRoot, { recursive: true });
  await assert.rejects(verifyUnpacked(appOutDir), /仍包含.*lingbuilder\.cef3\.sdk/u);
  await fsp.rm(moduleRoot, { recursive: true, force: true });
  const hiddenRuntime = path.join(appOutDir, 'resources', 'docs', 'examples', 'runtime', 'libcef.dll');
  await fsp.mkdir(path.dirname(hiddenRuntime), { recursive: true });
  await fsp.writeFile(hiddenRuntime, 'hidden SDK copy');
  await assert.rejects(verifyUnpacked(appOutDir), /仍夹带.*libcef\.dll/u);
});
