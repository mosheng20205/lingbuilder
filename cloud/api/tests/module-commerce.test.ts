import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ModuleArtifactService } from '../src/modules/module-artifact.service.js';
import { ModuleCommerceService } from '../src/modules/module-commerce.service.js';
import { PaymentProviderService } from '../src/modules/payment-provider.service.js';
import { artifactSignaturePayload, moduleSigningAcceptedKeyIds, moduleSigningPublicKey } from '../src/modules/module-signing-key.js';

test('支付宝回调必须使用官方 RSA2 公钥验证签名和商户身份', () => {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const values: Record<string, string> = { app_id: 'app-1', notify_id: 'notify-1', out_trade_no: 'order-1', trade_status: 'TRADE_SUCCESS', total_amount: '99.00' };
  const canonical = Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('&');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(canonical), pair.privateKey).toString('base64');
  const raw = new URLSearchParams({ ...values, sign_type: 'RSA2', sign: signature }).toString();
  const previous = snapshotEnv(['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY_PEM', 'ALIPAY_PUBLIC_KEY_PEM', 'ALIPAY_NOTIFY_URL']);
  Object.assign(process.env, {
    ALIPAY_APP_ID: 'app-1',
    ALIPAY_PRIVATE_KEY_PEM: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    ALIPAY_PUBLIC_KEY_PEM: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    ALIPAY_NOTIFY_URL: 'https://api.example.test/v1/module-payments/alipay/webhook'
  });
  try {
    const service = new PaymentProviderService();
    assert.equal(service.verifyWebhook('ALIPAY', raw, {}).eventId, 'notify-1');
    assert.throws(() => service.verifyWebhook('ALIPAY', raw.replace('99.00', '98.00'), {}), /签名/u);
  } finally { restoreEnv(previous); }
});

test('官方商户参数未配置时不允许创建支付订单', async () => {
  const names = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY_PEM', 'ALIPAY_PUBLIC_KEY_PEM', 'ALIPAY_NOTIFY_URL'];
  const previous = snapshotEnv(names);
  for (const name of names) delete process.env[name];
  try {
    const service = new PaymentProviderService();
    await assert.rejects(service.createOrder('ALIPAY', { id: 'order-1', subject: 'module', amountMinor: 100n, expiresAt: new Date(Date.now() + 60_000) }), /ALIPAY_APP_ID/u);
    assert.equal(service.configurationStatus().providers.find(item => item.id === 'alipay')?.ready, false);
  } finally { restoreEnv(previous); }
});

test('模块制品签名载荷包含身份、版本、架构、摘要和大小', () => {
  const payload = artifactSignaturePayload({ id: 'artifact-1', moduleId: 'lingbuilder.new_emoji.ui', version: '1.2.3', arch: 'any', sha256: 'a'.repeat(64), sizeBytes: '1024' }).toString('utf8');
  for (const value of ['artifact-1', 'lingbuilder.new_emoji.ui', '1.2.3', 'any', '1024']) assert.match(payload, new RegExp(value, 'u'));
});

test('收费模块制品上传会校验 v2 manifest、保存摘要并生成可验证签名', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-artifact-'));
  const previousStorage = process.env.MODULE_ARTIFACT_STORAGE_DIR;
  process.env.MODULE_ARTIFACT_STORAGE_DIR = root;
  const product = { id: 'product-1', moduleId: 'lingbuilder.new_emoji.ui', name: 'NewEmoji' };
  const prisma = {
    moduleProduct: { findUnique: async () => product },
    moduleArtifact: {
      findUnique: async () => null,
      upsert: async (args: any) => ({ ...args.create, product, createdAt: new Date() })
    },
    adminAuditLog: { create: async () => ({}) }
  };
  try {
    const service = new ModuleArtifactService(prisma as never, {} as never);
    await service.onModuleInit();
    const archive = storedZip('lingbuilder.module.json', Buffer.from(JSON.stringify({ schemaVersion: 2, id: product.moduleId, version: '1.0.0' })));
    async function* body() { yield archive.subarray(0, 31); yield archive.subarray(31); }
    const artifact: any = await service.upload(body(), { moduleId: product.moduleId, version: '1.0.0', arch: 'any', fileName: 'new-emoji.lbmod' }, 'admin-1');
    assert.equal(artifact.sha256, crypto.createHash('sha256').update(archive).digest('hex'));
    const payload = artifactSignaturePayload({ id: artifact.id, moduleId: artifact.moduleId, version: artifact.version, arch: artifact.arch, sha256: artifact.sha256, sizeBytes: artifact.sizeBytes });
    assert.equal(crypto.verify(null, payload, crypto.createPublicKey(artifact.publicKeyPem), Buffer.from(artifact.signature, 'base64url')), true);
  } finally {
    if (previousStorage === undefined) delete process.env.MODULE_ARTIFACT_STORAGE_DIR; else process.env.MODULE_ARTIFACT_STORAGE_DIR = previousStorage;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('未知商品不能通过非计费回退获得签名 Permit', async () => {
  const prisma = { moduleProduct: { findUnique: async () => null } };
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  await assert.rejects(commerce.issuePermit('user-1', 'lingbuilder.unknown.paid-module'), (error: any) => error?.code === 'MODULE_PAYMENT_REQUIRED');
});

test('permit 轮换列表缺省只包含当前签发密钥', () => {
  const previous = snapshotEnv(['MODULE_PERMIT_PRIVATE_KEY_PEM', 'MODULE_PERMIT_PUBLIC_KEY_PEM', 'MODULE_PERMIT_ACCEPTED_KEY_IDS']);
  delete process.env.MODULE_PERMIT_ACCEPTED_KEY_IDS;
  try {
    const key = moduleSigningPublicKey();
    assert.deepEqual(moduleSigningAcceptedKeyIds(), [key.keyId]);
  } finally { restoreEnv(previous); }
});

test('permit 轮换列表解析配置、去重并强制包含当前签发密钥', () => {
  const key = moduleSigningPublicKey();
  const previous = snapshotEnv(['MODULE_PERMIT_PRIVATE_KEY_PEM', 'MODULE_PERMIT_PUBLIC_KEY_PEM', 'MODULE_PERMIT_ACCEPTED_KEY_IDS']);
  Object.assign(process.env, { MODULE_PERMIT_ACCEPTED_KEY_IDS: ` AAAABBBBCCCCDDDD , ${key.keyId} , ${key.keyId} ` });
  try {
    assert.deepEqual(moduleSigningAcceptedKeyIds(), ['aaaabbbbccccdddd', key.keyId]);
    assert.throws(() => {
      process.env.MODULE_PERMIT_ACCEPTED_KEY_IDS = 'zzzz';
      moduleSigningAcceptedKeyIds();
    }, /16 位十六进制/u);
    assert.throws(() => {
      process.env.MODULE_PERMIT_ACCEPTED_KEY_IDS = '1111222233334444';
      moduleSigningAcceptedKeyIds();
    }, /当前签发密钥/u);
  } finally { restoreEnv(previous); }
});

function snapshotEnv(names: string[]) { return new Map(names.map(name => [name, process.env[name]])); }
function restoreEnv(values: Map<string, string | undefined>) { for (const [name, value] of values) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }

function storedZip(name: string, content: Buffer) {
  const fileName = Buffer.from(name, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(fileName.length, 28);
  const centralOffset = local.length + fileName.length + content.length;
  const centralSize = central.length + fileName.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, fileName, content, central, fileName, end]);
}
