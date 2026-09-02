import crypto from 'node:crypto';

import { MODULE_PERMIT_TRUST_ANCHORS, type ModulePermitTrustAnchor } from './modulePermitTrustAnchors';

export interface LocalModuleAccessPermit {
  payload: {
    version: 1;
    keyId: string;
    userId: string;
    moduleId: string;
    source: string;
    policyVersion: number;
    issuedAt: string;
    expiresAt: string;
    serverTime: string;
  };
  signature: string;
}

export interface ModuleAccessStatus {
  moduleId: string;
  paid: boolean;
  allowed: boolean;
  source?: string;
  expiresAt?: string;
  reason?: string;
  code?: string;
}

const DEFAULT_PAID_MODULES = ['lingbuilder.new_emoji.ui'];

export class ModuleAccessService {
  private readonly paidModuleIds = new Set(DEFAULT_PAID_MODULES);
  private readonly permits = new Map<string, LocalModuleAccessPermit>();
  private readonly publicKeys = new Map<string, crypto.KeyObject>();
  private lastServerTime = 0;
  private lastActiveKeyId = '';

  constructor(trustAnchors: readonly ModulePermitTrustAnchor[] = MODULE_PERMIT_TRUST_ANCHORS) {
    for (const anchor of trustAnchors) {
      if (!/^[a-f0-9]{16}$/iu.test(anchor.keyId)) throw new Error(`模块 Permit 信任锚的 keyId 无效：${anchor.keyId}`);
      const key = crypto.createPublicKey(anchor.publicKeyPem);
      if (key.asymmetricKeyType !== 'ed25519') throw new Error(`模块 Permit 信任锚 ${anchor.keyId} 必须是 Ed25519 公钥。`);
      this.publicKeys.set(anchor.keyId, key);
    }
  }

  // key 只作为轮换元数据（记录云端当前签发 keyId），其中的 publicKeyPem 一律不进入信任集。
  sync(input: { permit?: LocalModuleAccessPermit; key?: { keyId?: string; algorithm?: string; publicKeyPem?: string }; paidModuleIds?: string[] }): ModuleAccessStatus | undefined {
    for (const id of input.paidModuleIds || []) if (typeof id === 'string' && id) this.paidModuleIds.add(id);
    if (typeof input.key?.keyId === 'string' && /^[a-f0-9]{16}$/iu.test(input.key.keyId)) this.lastActiveKeyId = input.key.keyId;
    if (!input.permit) return undefined;
    try {
      // Keep a cryptographically valid expired permit so callers receive the
      // actionable expiry diagnostic instead of falling back to "not purchased".
      this.verify(input.permit, true);
    } catch (error: any) {
      // 签发密钥不在信任锚（新密钥轮换/锚缺失）时保留诊断并返回拒绝状态，而不是让同步请求 400。
      if (error?.code === 'MODULE_PERMIT_ANCHOR_UNKNOWN') {
        return { moduleId: input.permit.payload.moduleId, paid: true, allowed: false, code: 'MODULE_PERMIT_ANCHOR_UNKNOWN', reason: error instanceof Error ? error.message : String(error) };
      }
      throw error;
    }
    const serverTime = Date.parse(input.permit.payload.serverTime);
    if (Number.isFinite(serverTime)) this.lastServerTime = Math.max(this.lastServerTime, serverTime);
    this.permits.set(input.permit.payload.moduleId, structuredClone(input.permit));
    return this.status(input.permit.payload.moduleId);
  }

  clear(): void { this.permits.clear(); }

  status(moduleId: string): ModuleAccessStatus {
    if (!this.paidModuleIds.has(moduleId)) return { moduleId, paid: false, allowed: true, source: 'unmetered' };
    const permit = this.permits.get(moduleId);
    if (!permit) return { moduleId, paid: true, allowed: false, code: 'MODULE_PAYMENT_REQUIRED', reason: '请先登录并购买该模块，或等待限时免费活动开始。' };
    try { this.verify(permit); }
    catch (error: any) { return { moduleId, paid: true, allowed: false, code: error?.code || 'MODULE_PERMIT_INVALID', reason: error instanceof Error ? error.message : String(error) }; }
    return { moduleId, paid: true, allowed: true, source: permit.payload.source, expiresAt: permit.payload.expiresAt };
  }

  assertAccess(moduleId: string): void {
    const status = this.status(moduleId);
    if (!status.allowed) throw Object.assign(new Error(status.reason || '收费模块授权无效。'), { status: 402, code: status.code || 'MODULE_PAYMENT_REQUIRED' });
  }

  private verify(permit: LocalModuleAccessPermit, allowExpired = false): void {
    const payload = permit?.payload;
    if (!payload || payload.version !== 1 || !payload.moduleId || !payload.userId) throw new Error('模块 Permit 内容无效。');
    const key = this.publicKeys.get(payload.keyId);
    if (!key) {
      const rotated = Boolean(this.lastActiveKeyId) && this.lastActiveKeyId === payload.keyId;
      throw Object.assign(new Error(rotated
        ? `云端已轮换模块 Permit 签发密钥（keyId ${payload.keyId}），当前 IDE 信任锚未包含该密钥，请升级 LingBuilder 后重新登录。`
        : `模块 Permit 的签发密钥（keyId ${payload.keyId}）不在 IDE 信任锚中，请升级 LingBuilder 后重新登录同步模块授权。`), { code: 'MODULE_PERMIT_ANCHOR_UNKNOWN' });
    }
    const issuedAt = Date.parse(payload.issuedAt); const expiresAt = Date.parse(payload.expiresAt); const serverTime = Date.parse(payload.serverTime);
    if (![issuedAt, expiresAt, serverTime].every(Number.isFinite) || expiresAt <= issuedAt) throw new Error('模块 Permit 时间字段无效。');
    const now = Date.now();
    const valid = crypto.verify(null, Buffer.from(JSON.stringify(payload)), key, Buffer.from(permit.signature, 'base64url'));
    if (!valid) throw Object.assign(new Error('模块 Permit 签名无效。'), { code: 'MODULE_PERMIT_INVALID' });
    if (this.lastServerTime && now + 5 * 60_000 < this.lastServerTime) throw new Error('检测到系统时间明显回拨，请联网重新校验模块授权。');
    if (!allowExpired && now >= expiresAt) throw Object.assign(new Error(payload.source === 'free_window' ? '模块限时免费活动已经结束。' : '模块离线授权已过期，请联网重新校验。'), { code: payload.source === 'free_window' ? 'MODULE_FREE_WINDOW_ENDED' : 'MODULE_ENTITLEMENT_EXPIRED' });
  }
}
