import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

/**
 * 本机授权代理的客户端侧（纯 Node，供 CLI/stdio 宿主使用，不得引入 Electron 依赖）。
 * 外部 AI 客户端（Codex/Claude/Gemini）拉起的 stdio 宿主环境里没有模块 Permit 与浏览器凭据，
 * 这里按候选路径找到正在运行的 IDE 主进程留下的发现文件，再走回环换取。
 * 任何一步失败都只返回降级结果，调用方必须保持 fail-closed。
 */

export type LocalAuthorizationKind = 'module-access' | 'fbro-vip';

export interface LocalAuthorizationResult {
  ok: boolean;
  value: string;
  message: string;
}

export interface LocalModuleAuthorizationResult {
  ok: boolean;
  /** 换发成功后的最新模块授权状态（base64url），可直接交给门禁 sync。 */
  value: string;
  message: string;
  /** false=IDE 侧本机授权代理不可达（未运行或已关闭），换发请求根本没有发生。 */
  reachable: boolean;
}

export interface LocalAuthorizationDiscovery {
  version: number;
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

const REQUEST_TIMEOUT_MS = 1500;
const AUTHORIZATION_PROXY_UNREACHABLE_MESSAGE =
  '未找到正在运行的 LingBuilder 本机授权代理（LingBuilder 未启动，或已在「AI Bridge 连接中心」关闭外部 AI 授权）。请保持 LingBuilder 运行并登录账号后重试。';

export function resolveLocalAuthorizationCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const fileName = 'ai-bridge-local-auth.json';
  if (env.LINGBUILDER_LOCAL_AUTH_FILE) return [path.resolve(env.LINGBUILDER_LOCAL_AUTH_FILE)];
  const roaming = process.platform === 'win32'
    ? env.APPDATA || (env.USERPROFILE ? path.join(env.USERPROFILE, 'AppData', 'Roaming') : '')
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const dirs: string[] = [];
  const push = (dir?: string | null) => {
    if (dir && !dirs.includes(dir)) dirs.push(dir);
  };
  push(env.LINGBUILDER_REC_USER_DATA);
  // 打包版 productName 是 LingBuilder，开发态沿用 package.json name，两者都要找。
  push(roaming ? path.join(roaming, 'LingBuilder') : '');
  push(roaming ? path.join(roaming, 'lingbuilder-electron') : '');
  if (process.platform === 'win32' && env.LOCALAPPDATA) push(path.join(env.LOCALAPPDATA, 'LingBuilder'));
  return dirs.map(dir => path.resolve(dir, fileName));
}

export function readLocalAuthorizationDiscovery(candidates = resolveLocalAuthorizationCandidates()): LocalAuthorizationDiscovery | null {
  for (const file of candidates) {
    let parsed: LocalAuthorizationDiscovery | null = null;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as LocalAuthorizationDiscovery;
    } catch {
      continue;
    }
    if (!parsed || parsed.version !== 1 || !Number.isInteger(parsed.port) || parsed.port < 1024 || parsed.port > 65_535) continue;
    if (typeof parsed.token !== 'string' || parsed.token.length < 32) continue;
    // 崩溃退出会留下发现文件；PID 已不存在即视为陈旧，绝不把请求打给被复用的端口。
    if (!isProcessAlive(parsed.pid)) continue;
    return parsed;
  }
  return null;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Windows 上对存在但无权限的进程可能抛 EPERM，这同样说明进程在。
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

interface LocalAuthorityExchangePayload {
  ok?: boolean;
  moduleAccessState?: string;
  fbroVipKey?: string;
  authorizeErrors?: { moduleId: string; message: string }[];
}

interface LocalAuthorityExchangeResult {
  reachable: boolean;
  status: number;
  payload: LocalAuthorityExchangePayload | null;
  errorMessage: string;
}

function postLocalAuthorityExchange(body: { kind: LocalAuthorizationKind; authorizeModuleIds?: string[] }): Promise<LocalAuthorityExchangeResult> {
  const discovery = readLocalAuthorizationDiscovery();
  if (!discovery) {
    return Promise.resolve({ reachable: false, status: 0, payload: null, errorMessage: AUTHORIZATION_PROXY_UNREACHABLE_MESSAGE });
  }
  return new Promise<LocalAuthorityExchangeResult>(resolve => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: '127.0.0.1',
      port: discovery.port,
      path: '/local-authority/exchange',
      method: 'POST',
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(serialized),
        Authorization: `Bearer ${discovery.token}`
      }
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
      response.on('end', () => {
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          resolve({ reachable: true, status, payload: null, errorMessage: `本机授权代理返回 HTTP ${status}。` });
          return;
        }
        try {
          resolve({ reachable: true, status, payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) as LocalAuthorityExchangePayload, errorMessage: '' });
        } catch {
          resolve({ reachable: true, status, payload: null, errorMessage: '本机授权代理响应不是合法 JSON。' });
        }
      });
    });
    request.on('timeout', () => { request.destroy(new Error('本机授权换取超时。')); });
    request.on('error', error => resolve({ reachable: false, status: 0, payload: null, errorMessage: `本机授权换取失败：${error.message}` }));
    request.end(serialized);
  });
}

export function requestLocalAuthorization(kind: LocalAuthorizationKind): Promise<LocalAuthorizationResult> {
  return postLocalAuthorityExchange({ kind }).then(result => {
    if (!result.reachable) return { ok: false, value: '', message: result.errorMessage };
    if (result.status < 200 || result.status >= 300) return { ok: false, value: '', message: result.errorMessage };
    const payload = result.payload;
    if (!payload) return { ok: false, value: '', message: result.errorMessage };
    const value = String(kind === 'fbro-vip' ? payload.fbroVipKey || '' : payload.moduleAccessState || '');
    return payload.ok && value ? { ok: true, value, message: '' } : { ok: false, value: '', message: '本机授权代理没有返回可用凭据。' };
  });
}

/**
 * 按需换发：请 IDE 主进程用登录态向云端换发单个收费模块的 Permit，并回传换发后的最新授权状态。
 * reachable=true 且 ok=false 时 message 是 IDE 给出的权威中文原因（未登录 / 无权益 / 云端失败）。
 */
export function requestModuleAuthorizationExchange(moduleId: string): Promise<LocalModuleAuthorizationResult> {
  return postLocalAuthorityExchange({ kind: 'module-access', authorizeModuleIds: [moduleId] }).then(result => {
    if (!result.reachable) return { ok: false, value: '', message: result.errorMessage, reachable: false };
    if (result.status < 200 || result.status >= 300) return { ok: false, value: '', message: result.errorMessage, reachable: true };
    const payload = result.payload;
    if (!payload) return { ok: false, value: '', message: result.errorMessage, reachable: true };
    // 请求里带了 moduleId，authorizeErrors 里有它的失败原因时优先透出（state 里可能仍带着其他模块的成功结果）。
    const authorizeErrors = payload.authorizeErrors || [];
    const failure = authorizeErrors.find(item => item.moduleId === moduleId) || (authorizeErrors.length > 0 ? authorizeErrors[0] : undefined);
    if (failure) return { ok: false, value: '', message: failure.message, reachable: true };
    if (payload.ok && payload.moduleAccessState) return { ok: true, value: payload.moduleAccessState, message: '', reachable: true };
    return { ok: false, value: '', message: '本机授权代理没有返回可用凭据。', reachable: true };
  });
}
