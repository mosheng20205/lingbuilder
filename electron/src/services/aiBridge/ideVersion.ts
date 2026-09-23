import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 主进程托管启动链（aiBridgeManagerService / agentRuntimeService）注入 IDE 版本的
 * 环境变量通道；外部 AI 客户端自建的 stdio 宿主拿不到它，会走就近 package.json 回退。
 */
export const IDE_VERSION_ENV = 'LINGBUILDER_IDE_VERSION';

/** 兜底值：无法从环境变量与 package.json 任何一处取得版本时的显式「未知」，仍满足 MCP serverInfo 的 semver 形状。 */
export const IDE_VERSION_UNKNOWN = '0.0.0';

const VERSION_PATTERN = /^[\x21-\x7e]{1,40}$/;
let cachedPackageJsonVersion: string | undefined;

/**
 * 解析当前 LingBuilder IDE 版本（纯 Node，禁止 import electron：cli.cjs 会在
 * 外部 AI 客户端拉起的普通 Node 宿主里运行）。顺序：环境变量 → 就近 package.json
 * （源码布局 / dist bundle / 打包 asar 各差若干级，逐级向上找）→ 未知兜底。
 */
export function resolveIdeVersion(options: { environment?: NodeJS.ProcessEnv; startDir?: string } = {}): string {
  const environment = options.environment || process.env;
  const fromEnv = String(environment[IDE_VERSION_ENV] || '').trim();
  if (VERSION_PATTERN.test(fromEnv)) return fromEnv;
  if (cachedPackageJsonVersion === undefined) {
    cachedPackageJsonVersion = findPackageJsonVersion(options.startDir || defaultStartDir());
  }
  return cachedPackageJsonVersion || IDE_VERSION_UNKNOWN;
}

/** cli.cjs（CJS bundle）有 __dirname；tsx / node --test 的 ESM 环境没有，退回 import.meta.url。 */
function defaultStartDir(): string {
  if (typeof __dirname === 'string' && __dirname) return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

/** 仅供测试：清空 package.json 版本缓存，避免用例间相互污染。 */
export function resetIdeVersionCacheForTest(): void {
  cachedPackageJsonVersion = undefined;
}

function findPackageJsonVersion(startDir: string): string {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8')) as { version?: unknown };
      const version = String(parsed.version || '').trim();
      if (VERSION_PATTERN.test(version)) return version;
    } catch {
      // 本级没有可用的 package.json，继续向上。
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return '';
}
