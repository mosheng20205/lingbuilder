import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('sponsor dialog renders the local QR image and accessible close controls', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SponsorDialog.tsx'), 'utf8');
  assert.match(source, /赞助 LingBuilder/u);
  assert.match(source, /支付宝和微信赞助二维码/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /关闭赞助窗口/u);
  assert.match(source, /赞助二维码\.png/u);
  await fs.access(path.resolve(import.meta.dirname, '../../image/赞助二维码.png'));
});

test('help menu exposes sponsor and QQ group commands through the shared command path', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  const preload = await fs.readFile(path.resolve(import.meta.dirname, '../electron/preload.ts'), 'utf8');
  const main = await fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8');
  assert.match(source, /workbench\.action\.help\.openSponsor/u);
  assert.match(source, /workbench\.action\.help\.openQQGroup/u);
  assert.match(source, /window\.open\(LINGBUILDER_QQ_GROUP_URL/u);
  assert.match(source, /赞助/u);
  assert.match(source, /交流QQ群/u);
  assert.match(preload, /community:open-qq-group/u);
  assert.match(main, /https:\/\/qm\.qq\.com\/q\/q2VNHZXLXy/u);
});
