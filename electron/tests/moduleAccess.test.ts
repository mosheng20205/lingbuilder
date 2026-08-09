import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { ModuleAccessService, type LocalModuleAccessPermit } from '../src/services/modules/moduleAccessService';

function signedPermit(moduleId = 'lingbuilder.new_emoji.ui', expiresInMs = 60_000) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const keyId = crypto.createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
  const now = new Date();
  const issuedAt = expiresInMs < 0 ? new Date(now.getTime() + expiresInMs - 60_000) : now;
  const payload: LocalModuleAccessPermit['payload'] = {
    version: 1,
    keyId,
    userId: 'user-1',
    moduleId,
    source: 'purchase',
    policyVersion: 3,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    serverTime: now.toISOString()
  };
  const permit = { payload, signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), pair.privateKey).toString('base64url') };
  const key = { keyId, algorithm: 'Ed25519', publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  return { permit, key };
}

test('收费模块默认拒绝，签名 Permit 同步后允许且退出登录可立即清除', () => {
  const access = new ModuleAccessService();
  assert.equal(access.status('lingbuilder.new_emoji.ui').allowed, false);
  const signed = signedPermit();
  assert.equal(access.sync(signed)?.allowed, true);
  assert.doesNotThrow(() => access.assertAccess('lingbuilder.new_emoji.ui'));
  access.clear();
  assert.throws(() => access.assertAccess('lingbuilder.new_emoji.ui'), /./u);
});

test('Permit 模块 ID 或签名被篡改时拒绝授权', () => {
  const access = new ModuleAccessService();
  const signed = signedPermit();
  const tampered = structuredClone(signed.permit);
  tampered.payload.moduleId = 'lingbuilder.other.paid';
  assert.throws(() => access.sync({ permit: tampered, key: signed.key, paidModuleIds: ['lingbuilder.other.paid'] }), /./u);
});

test('签名正确但过期的 Permit 保留明确过期诊断', () => {
  const access = new ModuleAccessService();
  const signed = signedPermit('lingbuilder.new_emoji.ui', -60_000);
  const status = access.sync(signed);
  assert.equal(status?.allowed, false);
  assert.equal(status?.code, 'MODULE_ENTITLEMENT_EXPIRED');
  assert.match(status?.reason || '', /离线授权已过期/u);
  assert.throws(() => access.assertAccess('lingbuilder.new_emoji.ui'), /离线授权已过期/u);
});
