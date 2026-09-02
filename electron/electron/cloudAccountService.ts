import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface CloudSessionSnapshot { authenticated: boolean; email?: string; balance?: { available: string; reserved: string }; error?: string }
type StreamListener = (requestKey: string, event: unknown) => void;

export class CloudAccountService {
  private accessToken = ''; private refreshToken = ''; private email = ''; private readonly requests = new Map<string, AbortController>();
  constructor(private readonly origin: string, private readonly readRefresh: () => Promise<string>, private readonly writeRefresh: (value: string) => Promise<void>) {}
  async initialize() { this.refreshToken = await this.readRefresh(); if (this.refreshToken) await this.refresh().catch(() => this.clear()); }
  async register(email: string, password: string) { return await this.publicRequest('/v1/auth/register', { email, password }); }
  async verifyEmail(token: string) { return await this.publicRequest('/v1/auth/verify-email', { token }); }
  async login(email: string, password: string) { const value = await this.publicRequest('/v1/auth/login', { email, password, deviceName: 'LingBuilder IDE' }); await this.acceptTokens(value, email); return await this.snapshot(); }
  async logout() { if (this.refreshToken) await this.publicRequest('/v1/auth/logout', { refreshToken: this.refreshToken }).catch(() => undefined); await this.clear(); return { ok: true }; }
  async snapshot(): Promise<CloudSessionSnapshot> { if (!this.accessToken && this.refreshToken) await this.refresh().catch(() => this.clear()); if (!this.accessToken) return { authenticated: false }; try { const me = await this.request('/v1/me'); this.email = me.user.email; const balance = await this.request('/v1/usage/balance'); return { authenticated: true, email: this.email, balance: balance.balance }; } catch (error) { return { authenticated: false, error: error instanceof Error ? error.message : String(error) }; } }
  async models() { return await this.request('/v1/ai/models'); }
  async balance() { return await this.request('/v1/usage/balance'); }
  async moduleCatalog() {
    if (!this.accessToken && this.refreshToken) await this.refresh().catch(() => this.clear());
    if (!this.accessToken) return { ok: true, products: [], requiresLogin: true };
    return await this.request('/v1/modules/catalog');
  }
  async moduleEntitlements() { return await this.request('/v1/modules/entitlements'); }
  async modulePermit(moduleId: string) {
    if (!this.accessToken && this.refreshToken) await this.refresh();
    if (!this.accessToken) throw new Error('请先注册并登录 LingBuilder 账号，再启用收费模块。');
    const [permit, key, catalog] = await Promise.all([
      this.request('/v1/modules/permit', { method: 'POST', body: JSON.stringify({ moduleId }) }),
      this.request('/v1/modules/permit-key'),
      this.request('/v1/modules/catalog')
    ]);
    return { permit: permit.permit, key: { keyId: key.keyId, algorithm: key.algorithm }, paidModuleIds: (catalog.products || []).map((product: any) => product.moduleId) };
  }
  async createModuleOrder(offerId: string, provider: 'wechat'|'alipay', idempotencyKey: string) { return await this.request('/v1/module-orders', { method: 'POST', headers: { 'idempotency-key': idempotencyKey }, body: JSON.stringify({ offerId, provider }) }); }
  async rechargePackages() { return await this.request('/v1/credits/packages'); }
  async createRechargeOrder(packageId: string, provider: 'wechat'|'alipay', idempotencyKey: string) { return await this.request('/v1/credits/recharge', { method: 'POST', headers: { 'idempotency-key': idempotencyKey }, body: JSON.stringify({ packageId, provider }) }); }
  async rechargeOrder(orderId: string) { return await this.request(`/v1/credits/recharge/${encodeURIComponent(orderId)}`); }
  async downloadModuleArtifact(moduleId: string, arch: 'win32'|'x64'|'any', workspaceRoot: string) {
    if (!this.accessToken && this.refreshToken) await this.refresh();
    if (!this.accessToken) throw new Error('请先登录 LingBuilder 账号，再下载收费模块。');
    const metadataResponse = await this.request(`/v1/modules/artifacts/latest?moduleId=${encodeURIComponent(moduleId)}&arch=${encodeURIComponent(arch)}`);
    const artifact = metadataResponse?.artifact;
    if (!artifact || artifact.moduleId !== moduleId || !/^[a-f0-9]{64}$/u.test(String(artifact.sha256 || '')) || !/^\d+\.\d+\.\d+/u.test(String(artifact.version || ''))) throw new Error('云端返回的模块制品元数据无效。');
    const sizeBytes = Number(artifact.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 1024 * 1024 * 1024) throw new Error('云端模块制品大小无效或超过 1GB。');
    const publicKey = crypto.createPublicKey(String(artifact.publicKeyPem || ''));
    const publicDer = publicKey.export({ type: 'spki', format: 'der' });
    const keyId = crypto.createHash('sha256').update(publicDer).digest('hex').slice(0, 16);
    if (keyId !== artifact.keyId) throw new Error('模块制品签名密钥标识无效。');
    const signaturePayload = Buffer.from(['lingbuilder-module-artifact-v1', artifact.id, artifact.moduleId, artifact.version, artifact.arch, artifact.sha256, String(artifact.sizeBytes)].join('\n'), 'utf8');
    if (!crypto.verify(null, signaturePayload, publicKey, Buffer.from(String(artifact.signature || ''), 'base64url'))) throw new Error('模块制品元数据签名无效，已拒绝下载。');

    const packageDir = path.resolve(workspaceRoot, '.lingbuilder', 'module-packages');
    const safeModule = moduleId.replace(/[^a-z0-9._-]/giu, '-');
    const safeVersion = String(artifact.version).replace(/[^0-9A-Za-z.+-]/gu, '-');
    const fileName = `${safeModule}-${safeVersion}-${artifact.arch}.lbmod`;
    const targetPath = path.join(packageDir, fileName);
    const temporaryPath = `${targetPath}.${crypto.randomBytes(6).toString('hex')}.partial`;
    await fs.mkdir(packageDir, { recursive: true });
    const response = await this.fetchCloud(String(artifact.downloadPath), { headers: { authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok || !response.body) { const failure: any = await response.json().catch(() => ({})); throw new Error(failure.message || '收费模块下载失败。'); }
    const handle = await fs.open(temporaryPath, 'wx');
    const hash = crypto.createHash('sha256');
    let downloaded = 0;
    try {
      for await (const rawChunk of response.body as any) {
        const chunk = Buffer.from(rawChunk);
        downloaded += chunk.length;
        if (downloaded > sizeBytes) throw new Error('模块制品下载大小超过签名元数据。');
        hash.update(chunk);
        await handle.write(chunk);
      }
      await handle.close();
      if (downloaded !== sizeBytes || hash.digest('hex') !== artifact.sha256) throw new Error('模块制品 SHA-256 或文件大小校验失败。');
      await fs.rm(targetPath, { force: true });
      await fs.rename(temporaryPath, targetPath);
      return { ok: true, relativePath: `.lingbuilder/module-packages/${fileName}`, artifact: { id: artifact.id, moduleId, version: artifact.version, arch: artifact.arch, sha256: artifact.sha256 } };
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }
  async startAi(kind: 'chat'|'edit', payload: unknown, listener: StreamListener): Promise<string> { if (!this.accessToken) await this.refresh(); const requestKey = crypto.randomUUID(); const controller = new AbortController(); this.requests.set(requestKey, controller); void this.consumeStream(requestKey, kind, payload, controller, listener); return requestKey; }
  cancel(requestKey: string) { const controller = this.requests.get(requestKey); controller?.abort(); return Boolean(controller); }
  private async consumeStream(requestKey: string, kind: 'chat'|'edit', payload: unknown, controller: AbortController, listener: StreamListener) {
    // 访问令牌过期时刷新后自动重试一次，而不是要求用户手动重发。
    let refreshedOnce = false;
    let terminalEventSeen = false;
    try {
      for (;;) {
        const response = await fetch(`${this.origin}/v1/ai/${kind}/stream`, { method: 'POST', signal: controller.signal, headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(payload) });
        if (response.status === 401 && this.refreshToken && !refreshedOnce) { refreshedOnce = true; await this.refresh(); continue; }
        if (!response.ok || !response.body) { const failure: any = await response.json().catch(() => ({})); throw new Error(failure.message || '系统 AI 请求失败。'); }
        for await (const event of parseSse(response.body)) {
          if (event && (event.type === 'completed' || event.type === 'error')) terminalEventSeen = true;
          listener(requestKey, event);
        }
        return;
      }
    } catch (error) {
      terminalEventSeen = true;
      listener(requestKey, { type: 'error', requestId: requestKey, code: controller.signal.aborted ? 'REQUEST_CANCELLED' : 'PROVIDER_FAILED', message: controller.signal.aborted ? 'AI 请求已取消。' : error instanceof Error ? error.message : String(error), retryable: !controller.signal.aborted });
    } finally {
      this.requests.delete(requestKey);
      // SSE 流意外中断（未收到 completed/error）时补发终态事件，避免渲染端输入框永久禁用。
      if (!terminalEventSeen) listener(requestKey, { type: 'error', requestId: requestKey, code: 'PROVIDER_FAILED', message: '系统 AI 连接已中断，请重试。', retryable: true });
    }
  }
  private async refresh() { if (!this.refreshToken) throw new Error('尚未登录系统 AI。'); const value = await this.publicRequest('/v1/auth/refresh', { refreshToken: this.refreshToken }); await this.acceptTokens(value, this.email); }
  private async acceptTokens(value: any, email: string) { if (!value?.accessToken || !value?.refreshToken) throw new Error('云端未返回有效登录令牌。'); this.accessToken = value.accessToken; this.refreshToken = value.refreshToken; this.email = email; await this.writeRefresh(this.refreshToken); }
  private async clear() { this.accessToken = ''; this.refreshToken = ''; this.email = ''; await this.writeRefresh(''); }
  private async request(path: string, init: RequestInit = {}): Promise<any> { const response = await this.fetchCloud(path, { ...init, headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json', ...init.headers } }); const value: any = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.message || cloudStatusMessage(response.status)); return value; }
  private async publicRequest(path: string, body: unknown): Promise<any> { const response = await this.fetchCloud(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const value: any = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.message || cloudStatusMessage(response.status)); return value; }
  private async fetchCloud(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.origin}${path}`, init);
    } catch {
      throw new Error(`无法连接 LingBuilder 云端服务（${this.origin}），请确认云端 API 已启动并检查网络设置。`);
    }
  }
}

function cloudStatusMessage(status: number): string {
  if (status === 401) return '登录状态已失效，请重新登录 LingBuilder 账号。';
  if (status === 403) return '当前账号没有执行此操作的权限。';
  if (status === 402) return '当前账号尚未取得该收费模块的有效权益。';
  if (status >= 500) return 'LingBuilder 云端服务暂时不可用，请稍后重试。';
  return `LingBuilder 云端请求失败（状态码 ${status}）。`;
}

async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> { const reader = stream.getReader(); const decoder = new TextDecoder(); let buffer = ''; try { while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split(/\r?\n\r?\n/u); buffer = events.pop() || ''; for (const raw of events) { const data = raw.split(/\r?\n/u).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n'); if (data) yield JSON.parse(data); } } } finally { reader.releaseLock(); } }