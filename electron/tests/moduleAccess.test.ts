import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { ModuleAccessService, type LocalModuleAccessPermit } from '../src/services/modules/moduleAccessService';
import type { ModulePermitTrustAnchor } from '../src/services/modules/modulePermitTrustAnchors';

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
  const anchors: ModulePermitTrustAnchor[] = [{ keyId, publicKeyPem: key.publicKeyPem }];
  return { permit, key, anchors };
}

function otherPair() {
  const pair = crypto.generateKeyPairSync('ed25519');
  const keyId = crypto.createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
  return { keyId, publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}

test('锚内密钥签发的 Permit 同步后允许，退出登录可立即清除', () => {
  const signed = signedPermit();
  const access = new ModuleAccessService(signed.anchors);
  assert.equal(access.status('lingbuilder.new_emoji.ui').allowed, false);
  assert.equal(access.sync(signed)?.allowed, true);
  assert.doesNotThrow(() => access.assertAccess('lingbuilder.new_emoji.ui'));
  access.clear();
  assert.throws(() => access.assertAccess('lingbuilder.new_emoji.ui'), /./u);
});

test('空信任锚时签名合法的 Permit 也拒绝并给出锚诊断', () => {
  const signed = signedPermit();
  const access = new ModuleAccessService([]);
  const status = access.sync(signed);
  assert.equal(status?.allowed, false);
  assert.equal(status?.code, 'MODULE_PERMIT_ANCHOR_UNKNOWN');
  assert.match(status?.reason || '', /信任锚/u);
  assert.match(status?.reason || '', /升级/u);
});

test('服务端同步下发陌生公钥不再进入信任集（信任根回归）', () => {
  const stranger = signedPermit();
  const anchorPair = otherPair();
  const access = new ModuleAccessService([{ keyId: anchorPair.keyId, publicKeyPem: anchorPair.publicKeyPem }]);
  const status = access.sync({ permit: stranger.permit, key: stranger.key, paidModuleIds: ['lingbuilder.new_emoji.ui'] });
  assert.equal(status?.allowed, false);
  assert.equal(status?.code, 'MODULE_PERMIT_ANCHOR_UNKNOWN');
  assert.equal(access.status('lingbuilder.new_emoji.ui').paid, true);
  assert.equal(access.status('lingbuilder.new_emoji.ui').allowed, false);
});

test('云端 active keyId 不在锚内时提示轮换并要求升级 IDE', () => {
  const signed = signedPermit();
  const anchorPair = otherPair();
  const access = new ModuleAccessService([{ keyId: anchorPair.keyId, publicKeyPem: anchorPair.publicKeyPem }]);
  const status = access.sync({ permit: signed.permit, key: { keyId: signed.key.keyId, algorithm: 'Ed25519' } });
  assert.equal(status?.allowed, false);
  assert.equal(status?.code, 'MODULE_PERMIT_ANCHOR_UNKNOWN');
  assert.match(status?.reason || '', /轮换/u);
  assert.match(status?.reason || '', /升级/u);
  assert.match(status?.reason || '', new RegExp(signed.key.keyId, 'u'));
});

test('Permit 模块 ID 或签名被篡改时拒绝授权', () => {
  const signed = signedPermit();
  const access = new ModuleAccessService(signed.anchors);
  const tampered = structuredClone(signed.permit);
  tampered.payload.moduleId = 'lingbuilder.other.paid';
  assert.throws(() => access.sync({ permit: tampered, key: signed.key, paidModuleIds: ['lingbuilder.other.paid'] }), /./u);
});

test('签名正确但过期的 Permit 保留明确过期诊断', () => {
  const signed = signedPermit('lingbuilder.new_emoji.ui', -60_000);
  const access = new ModuleAccessService(signed.anchors);
  const status = access.sync(signed);
  assert.equal(status?.allowed, false);
  assert.equal(status?.code, 'MODULE_ENTITLEMENT_EXPIRED');
  assert.match(status?.reason || '', /离线授权已过期/u);
  assert.throws(() => access.assertAccess('lingbuilder.new_emoji.ui'), /离线授权已过期/u);
});

test('paidModuleIds 仍随同步合并进收费清单', () => {
  const access = new ModuleAccessService([]);
  access.sync({ paidModuleIds: ['lingbuilder.future.paid'] });
  const status = access.status('lingbuilder.future.paid');
  assert.equal(status.paid, true);
  assert.equal(status.allowed, false);
});

test('构造时拒绝无效信任锚（keyId 或非 Ed25519 公钥）', () => {
  assert.throws(() => new ModuleAccessService([{ keyId: 'not-hex', publicKeyPem: otherPair().publicKeyPem }]), /keyId/u);
  const { generateKeyPairSync } = crypto;
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(
    () => new ModuleAccessService([{ keyId: '0123456789abcdef', publicKeyPem: rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString() }]),
    /Ed25519/u
  );
});
