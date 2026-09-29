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
  // 修法指引必须随文案一起给出（构建链路 402 直显这段文本）。
  assert.match(status?.reason || '', /模块面板重新启用|重新构建/u);
  try {
    access.assertAccess('lingbuilder.new_emoji.ui');
    assert.fail('assertAccess 应当抛出');
  } catch (error) {
    const thrown = error as Error & { moduleId?: string; status?: number; code?: string };
    assert.match(thrown.message, /离线授权已过期/u);
    // 构建端点依赖 moduleId 走共享授权恢复流（F5 402 → 登录/换发 → 重试）。
    assert.equal(thrown.moduleId, 'lingbuilder.new_emoji.ui');
    assert.equal(thrown.status, 402);
    assert.equal(thrown.code, 'MODULE_ENTITLEMENT_EXPIRED');
  }
});

test('listStatuses 返回全部已缓存 Permit 的状态（含过期），未同步模块不出现', () => {
  const signed = signedPermit('lingbuilder.new_emoji.ui', -60_000);
  const access = new ModuleAccessService(signed.anchors);
  assert.deepEqual(access.listStatuses(), []);
  access.sync(signed);
  const statuses = access.listStatuses();
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0]?.moduleId, 'lingbuilder.new_emoji.ui');
  assert.equal(statuses[0]?.allowed, false);
  assert.equal(statuses[0]?.code, 'MODULE_ENTITLEMENT_EXPIRED');
});

test('限时免费来源的过期 Permit 如实报本地授权过期（不断言活动已结束）并指引登录自动换发', () => {
  const signed = signedPermit('lingbuilder.new_emoji.ui', -60_000);
  const permit = structuredClone(signed.permit);
  permit.payload.source = 'free_window';
  const pair = crypto.generateKeyPairSync('ed25519');
  // 重新签名：改 source 后必须用测试自签密钥重签才能通过签名校验。
  const keyId = crypto.createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
  permit.payload.keyId = keyId;
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(permit.payload)), pair.privateKey).toString('base64url');
  const access = new ModuleAccessService([{ keyId, publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() }]);
  const status = access.sync({ permit: { ...permit, signature }, key: { keyId, algorithm: 'Ed25519', publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } });
  assert.equal(status?.code, 'MODULE_FREE_WINDOW_ENDED');
  assert.match(status?.reason || '', /本地限时免费授权已于/u);
  // 过期时间必须如实呈现（限免活动可能仍在进行，过期的是本地这份离线授权）。
  assert.ok((status?.reason || '').includes(new Date(permit.payload.expiresAt).toLocaleString()));
  assert.match(status?.reason || '', /限免活动可能仍在进行/u);
  assert.match(status?.reason || '', /登录 LingBuilder 账号后 IDE 会自动换发授权/u);
  // 与限免活动实况可能矛盾的表述禁止回归。
  assert.doesNotMatch(status?.reason || '', /活动已经结束/u);
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
