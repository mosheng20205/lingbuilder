import crypto from 'node:crypto';
import path from 'node:path';

export interface ServerRuntimeConfig {
  environment: 'development' | 'production';
  workspaceRoot: string;
  staticRoot?: string;
  rulebookPath: string;
  host: '127.0.0.1' | '::1';
  port: number;
  sessionToken: string;
  devNoAuth: boolean;
  aiBridgeEnabled: boolean;
  aiBridgeToken: string;
}

export interface ServerReadyInfo {
  host: ServerRuntimeConfig['host'];
  port: number;
  origin: string;
  workspaceRoot: string;
  pid: number;
}

export const SERVER_READY_PREFIX = 'LINGBUILDER_SERVER_READY ';

export function resolveServerRuntimeConfig(environment: NodeJS.ProcessEnv): ServerRuntimeConfig {
  const mode = environment.NODE_ENV === 'production' ? 'production' : 'development';
  const workspaceRoot = requireAbsolutePath(environment.LINGBUILDER_WORKSPACE_ROOT, 'LINGBUILDER_WORKSPACE_ROOT');
  const rulebookPath = requireAbsolutePath(
    environment.LINGBUILDER_RULEBOOK_PATH || environment.RULEBOOK_PATH,
    'RULEBOOK_PATH'
  );
  const staticRoot = optionalAbsolutePath(
    environment.LINGBUILDER_STATIC_ROOT || environment.STATIC_ROOT,
    'STATIC_ROOT'
  );
  if (mode === 'production' && !staticRoot) {
    throw new Error('生产模式必须配置绝对路径 LINGBUILDER_STATIC_ROOT。');
  }

  const rawHost = (environment.HOST || '127.0.0.1').trim().toLowerCase();
  const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
  if (host !== '127.0.0.1' && host !== '::1') {
    throw new Error('LingBuilder IDE 服务只允许监听 127.0.0.1 或 ::1，禁止开放远程地址。');
  }

  const port = parsePort(environment.PORT || '3000');
  const sessionToken = (environment.LINGBUILDER_SESSION_TOKEN || environment.SESSION_TOKEN || '').trim();
  const devNoAuth = mode === 'development'
    && environment.LINGBUILDER_DEV_NO_AUTH === 'true';
  if (!sessionToken && !devNoAuth) {
    throw new Error('LingBuilder IDE 服务必须配置 LINGBUILDER_SESSION_TOKEN；仅开发模式可显式启用 LINGBUILDER_DEV_NO_AUTH=true。');
  }

  const aiBridgeEnabled = environment.LINGBUILDER_AI_BRIDGE_ENABLED === 'true';
  const aiBridgeToken = (environment.LINGBUILDER_AI_BRIDGE_TOKEN || '').trim();
  if (aiBridgeEnabled && !aiBridgeToken) {
    throw new Error('启用内嵌 AI Bridge 时必须配置非空 LINGBUILDER_AI_BRIDGE_TOKEN。');
  }

  return {
    environment: mode,
    workspaceRoot,
    staticRoot,
    rulebookPath,
    host,
    port,
    sessionToken,
    devNoAuth,
    aiBridgeEnabled,
    aiBridgeToken
  };
}

export function formatServerReady(info: ServerReadyInfo): string {
  return `${SERVER_READY_PREFIX}${JSON.stringify(info)}`;
}

export function isServerSessionAuthorized(config: ServerRuntimeConfig, suppliedToken: string): boolean {
  if (config.devNoAuth) return true;
  if (!suppliedToken || !config.sessionToken) return false;
  const actualBuffer = Buffer.from(suppliedToken);
  const expectedBuffer = Buffer.from(config.sessionToken);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function parsePort(value: string): number {
  if (!/^\d+$/u.test(value.trim())) throw new Error(`无效 PORT：${value}`);
  const port = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error(`无效 PORT：${value}`);
  }
  return port;
}

function requireAbsolutePath(value: string | undefined, name: string): string {
  const resolved = optionalAbsolutePath(value, name);
  if (!resolved) throw new Error(`缺少必需运行配置 ${name}。`);
  return resolved;
}

function optionalAbsolutePath(value: string | undefined, name: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!path.isAbsolute(trimmed)) throw new Error(`${name} 必须是绝对路径。`);
  return path.resolve(trimmed);
}
