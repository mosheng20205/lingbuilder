import crypto from 'node:crypto';

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

  sync(input: { permit?: LocalModuleAccessPermit; key?: { keyId: string; algorithm: string; publicKeyPem: string }; paidModuleIds?: string[] }): ModuleAccessStatus | undefined {
    for (const id of input.paidModuleIds || []) if (typeof id === 'string' && id) this.paidModuleIds.add(id);
    if (input.key) {
      if (input.key.algorithm !== 'Ed25519' || !/^[a-f0-9]{16}$/iu.test(input.key.keyId)) throw new Error('模块授权公钥元数据无效。');
      this.publicKeys.set(input.key.keyId, crypto.createPublicKey(input.key.publicKeyPem));
    }
    if (!input.permit) return undefined;
    this.verify(input.permit);
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

  private verify(permit: LocalModuleAccessPermit): void {
    const payload = permit?.payload;
    if (!payload || payload.version !== 1 || !payload.moduleId || !payload.userId) throw new Error('模块 Permit 内容无效。');
    const key = this.publicKeys.get(payload.keyId); if (!key) throw new Error('模块 Permit 的签发公钥尚未同步。');
    const issuedAt = Date.parse(payload.issuedAt); const expiresAt = Date.parse(payload.expiresAt); const serverTime = Date.parse(payload.serverTime);
    if (![issuedAt, expiresAt, serverTime].every(Number.isFinite) || expiresAt <= issuedAt) throw new Error('模块 Permit 时间字段无效。');
    const now = Date.now();
    if (this.lastServerTime && now + 5 * 60_000 < this.lastServerTime) throw new Error('检测到系统时间明显回拨，请联网重新校验模块授权。');
    if (now >= expiresAt) throw Object.assign(new Error(payload.source === 'free_window' ? '模块限时免费活动已经结束。' : '模块离线授权已过期，请联网重新校验。'), { code: payload.source === 'free_window' ? 'MODULE_FREE_WINDOW_ENDED' : 'MODULE_ENTITLEMENT_EXPIRED' });
    const valid = crypto.verify(null, Buffer.from(JSON.stringify(payload)), key, Buffer.from(permit.signature, 'base64url'));
    if (!valid) throw Object.assign(new Error('模块 Permit 签名无效。'), { code: 'MODULE_PERMIT_INVALID' });
  }
}
