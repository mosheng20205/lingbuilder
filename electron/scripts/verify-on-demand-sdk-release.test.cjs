const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SDK_MODULE_IDS, verifyUnpacked } = require('./verify-on-demand-sdk-release.cjs');

test('瘦身发布目录保留 SDK 模块元数据且拒绝夹带 sdk 目录', async t => {
  const appOutDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-slim-sdk-'));
  t.after(() => fsp.rm(appOutDir, { recursive: true, force: true }));
  for (const moduleId of SDK_MODULE_IDS) {
    const root = path.join(appOutDir, 'resources', 'default-workspace', '.lingbuilder', 'modules', moduleId);
    await fsp.mkdir(root, { recursive: true });
    await fsp.writeFile(path.join(root, 'lingbuilder.module.json'), `${JSON.stringify({ schemaVersion: 2, id: moduleId, version: '1.0.0' })}\n`);
    await fsp.writeFile(path.join(root, 'README.md'), '# 按需下载 SDK\n'.padEnd(160, '说明'));
  }
  const result = await verifyUnpacked(appOutDir);
  assert.equal(result.modules.length, 2);
  const sdkRoot = path.join(appOutDir, 'resources', 'default-workspace', '.lingbuilder', 'modules', SDK_MODULE_IDS[0], 'sdk');
  await fsp.mkdir(sdkRoot, { recursive: true });
  await assert.rejects(verifyUnpacked(appOutDir), /仍包含.*sdk/u);
  await fsp.rm(sdkRoot, { recursive: true, force: true });
  const hiddenRuntime = path.join(appOutDir, 'resources', 'docs', 'examples', 'runtime', 'libcef.dll');
  await fsp.mkdir(path.dirname(hiddenRuntime), { recursive: true });
  await fsp.writeFile(hiddenRuntime, 'hidden SDK copy');
  await assert.rejects(verifyUnpacked(appOutDir), /仍夹带.*libcef\.dll/u);
});
