import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

/**
 * 本机授权代理：让外部 AI 客户端自动拉起的 AI Bridge stdio 宿主，能向正在运行的 IDE 主进程
 * 换取模块 Permit 与浏览器凭据（stdio 宿主的父进程是 Codex/Claude，环境里没有这两项）。
 * 换取之外还支持按需换发：宿主报出模块 ID，代理用 IDE 登录态向云端换 Permit 后回传最新状态——
 * 用户只要在 IDE 登录（Pro/已购/限免由云端判定），外部 AI 即可现场取得收费模块授权。
 *
 * 边界：只绑 127.0.0.1、随 IDE 启动默认开启（可在「AI Bridge 连接中心」关闭）、令牌随 IDE 启动轮换、
 * 发现文件只落在本机用户目录；响应内容绝不写日志。信任边界与 safeStorage 同为"同一登录用户"。
 */

export interface LocalAuthorizationPayload {
  moduleAccessState: string;
  fbroVipKey: string;
}

export interface LocalAuthorizationAuthorizeResult {
  ok: boolean;
  /** 失败时的权威中文原因（未登录 / 无权益 / 云端失败），原样回给门禁分类。 */
  message?: string;
}

export interface LocalAuthorizationOptions {
  userDataDir: string;
  enabled: boolean;
  readModulePermitCache: () => Promise<unknown[]>;
  resolveFbroVipKey: () => Promise<string>;
  /** 按需换发：用 IDE 登录态向云端换发单个收费模块的 Permit 并落缓存；缺省时按需换发按「未配置」拒绝。 */
  authorizeModule?: (moduleId: string) => Promise<LocalAuthorizationAuthorizeResult>;
  log?: (message: string) => void;
}

export interface LocalAuthorizationSnapshot {
  enabled: boolean;
  running: boolean;
  port: number;
  discoveryPath: string;
  exchanges: number;
  lastError: string;
}

export interface LocalAuthorizationDiscovery {
  version: 1;
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

const MAX_BODY_BYTES = 4096;

export function resolveLocalAuthorizationDiscoveryPath(userDataDir: string): string {
  return path.join(userDataDir, 'ai-bridge-local-auth.json');
}

export function encodeModuleAccessState(authorizations: unknown[]): string {
  return Buffer.from(JSON.stringify(authorizations), 'utf8').toString('base64url');
}

export class LocalAuthorizationService {
  private server: http.Server | null = null;
  private token = '';
  private port = 0;
  private exchanges = 0;
  private lastError = '';
  private stopping = false;

  constructor(private readonly options: LocalAuthorizationOptions) {}

  get discoveryPath(): string {
    return resolveLocalAuthorizationDiscoveryPath(this.options.userDataDir);
  }

  snapshot(): LocalAuthorizationSnapshot {
    return {
      enabled: this.options.enabled,
      running: this.server !== null,
      port: this.port,
      discoveryPath: this.discoveryPath,
      exchanges: this.exchanges,
      lastError: this.lastError
    };
  }

  async start(): Promise<LocalAuthorizationSnapshot> {
    await this.stop();
    if (!this.options.enabled) {
      await fs.rm(this.discoveryPath, { force: true }).catch(() => undefined);
      return this.snapshot();
    }
    this.token = crypto.randomBytes(32).toString('base64url');
    const server = http.createServer((request, response) => { void this.handle(request, response); });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('本机授权代理未能取得回环端口。');
    }
    this.server = server;
    this.port = address.port;
    this.lastError = '';
    const discovery: LocalAuthorizationDiscovery = {
      version: 1,
      port: this.port,
      token: this.token,
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    await fs.mkdir(path.dirname(this.discoveryPath), { recursive: true });
    const temporary = `${this.discoveryPath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(discovery, null, 2), 'utf8');
    await fs.rename(temporary, this.discoveryPath);
    this.options.log?.(`本机授权代理已启动（端口 ${this.port}）。`);
    return this.snapshot();
  }

  async stop(): Promise<LocalAuthorizationSnapshot> {
    const server = this.server;
    this.server = null;
    this.port = 0;
    this.token = '';
    await fs.rm(this.discoveryPath, { force: true }).catch(() => undefined);
    if (!server) return this.snapshot();
    this.stopping = true;
    server.closeAllConnections?.();
    await new Promise<void>(resolve => { server.close(() => resolve()); resolve(); });
    this.stopping = false;
    return this.snapshot();
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const write = (status: number, body: Record<string, unknown>) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST' || request.url !== '/local-authority/exchange') {
      write(404, { ok: false, error: '未知端点。' });
      return;
    }
    const remote = request.socket.remoteAddress || '';
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      this.lastError = '非回环来源请求已被拒绝。';
      write(403, { ok: false, error: '本机授权代理只接受回环来源。' });
      return;
    }
    if (!this.token) {
      write(403, { ok: false, error: '本机授权代理未开启。' });
      return;
    }
    const provided = String(request.headers.authorization || '').replace(/^Bearer\s+/iu, '');
    if (!timingSafeEqualText(provided, this.token)) {
      this.lastError = '换取令牌校验失败。';
      write(401, { ok: false, error: '本机授权换取令牌无效，请重新打开 LingBuilder 后重试。' });
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buffer.length;
        if (total > MAX_BODY_BYTES) throw new Error('请求体过大。');
        chunks.push(buffer);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      write(400, { ok: false, error: '本机授权换取请求格式无效。' });
      return;
    }
    let requested: { kind?: unknown; authorizeModuleIds?: unknown };
    try {
      requested = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { kind?: unknown; authorizeModuleIds?: unknown };
    } catch {
      write(400, { ok: false, error: '本机授权换取请求不是合法 JSON。' });
      return;
    }
    const kind = requested.kind === 'fbro-vip' ? 'fbro-vip' : 'module-access';
    const authorizeModuleIds = Array.isArray(requested.authorizeModuleIds)
      ? requested.authorizeModuleIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128).slice(0, 8)
      : [];
    try {
      const authorizeErrors: { moduleId: string; message: string }[] = [];
      if (kind === 'module-access' && authorizeModuleIds.length > 0) {
        if (!this.options.authorizeModule) {
          for (const moduleId of authorizeModuleIds) authorizeErrors.push({ moduleId, message: '本机授权代理未配置按需换发，请升级 LingBuilder 后重试。' });
        } else {
          for (const moduleId of authorizeModuleIds) {
            const outcome = await this.options.authorizeModule(moduleId);
            if (!outcome.ok) authorizeErrors.push({ moduleId, message: outcome.message || '模块授权换发失败，请稍后重试。' });
          }
        }
      }
      // 换发（无论成败）后重读缓存：成功者已落缓存，返回的 state 里直接带上新 Permit。
      const payload = await this.buildPayload(kind);
      this.exchanges += 1;
      // 只记录类别与次数，授权码、Permit 正文与换发失败原因绝不落日志。
      this.options.log?.(authorizeModuleIds.length > 0
        ? `本机授权代理完成一次 ${kind} 换取（按需换发 ${authorizeModuleIds.length - authorizeErrors.length}/${authorizeModuleIds.length} 成功）。`
        : `本机授权代理完成一次 ${kind} 换取。`);
      write(200, { ok: true, ...payload, ...(authorizeErrors.length > 0 ? { authorizeErrors } : {}) });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      write(500, { ok: false, error: '本机授权换取失败。' });
    }
  }

  private async buildPayload(kind: 'module-access' | 'fbro-vip'): Promise<LocalAuthorizationPayload> {
    if (kind === 'fbro-vip') {
      return { moduleAccessState: '', fbroVipKey: (await this.options.resolveFbroVipKey()).trim().slice(0, 4096) };
    }
    const authorizations = await this.options.readModulePermitCache();
    return { moduleAccessState: encodeModuleAccessState(Array.isArray(authorizations) ? authorizations : []), fbroVipKey: '' };
  }
}

function timingSafeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
