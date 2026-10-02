import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AgentRuntimeLegacyCleanupOptions {
  /** 打包版的 resources 目录；开发态传空即跳过安装目录清理。 */
  resourcesPath?: string;
  /** 当前 userData 目录；为空即跳过用户目录清理。 */
  userDataPath?: string;
  /** 延迟执行（毫秒），给启动让路；默认 30 秒后异步执行。 */
  delayMs?: number;
}

export interface AgentRuntimeLegacyCleanupResult {
  removed: string[];
  problems: string[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function removeIfExists(target: string, removed: string[], problems: string[]): Promise<void> {
  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat) return;
    await fs.rm(target, { recursive: true, force: true, maxRetries: 2 });
    removed.push(target);
  } catch (error) {
    problems.push(`清理内嵌 Agent 退场残留失败（${target}）：${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 内嵌 Agent 运行时（DeepSeek Harness）退场后的一次性静默清理（2026-10-02）：
 * - 安装目录：随包归档 agent-runtime.tar / agent-runtime.json，以及 ≤0.7.9 首包形态的
 *   散文件树 resources\dsh、resources\node（在安装器里删会被杀软逐个拦截并冻结进度条，
 *   必须留给应用启动后异步删，见 0.7.9 首包真机实测）；
 * - 用户目录：已释放的运行时 <userData>\agent-runtime 与不可写回落目录 <userData>\agent-runtime-bundle，
 *   以及加密保存的模型通道配置 credentials\agent-provider-settings.json。
 * 全部 best-effort：任何失败只记 problem，绝不影响启动。
 */
export async function removeLegacyAgentRuntimeArtifacts(options: AgentRuntimeLegacyCleanupOptions = {}): Promise<AgentRuntimeLegacyCleanupResult> {
  const delayMs = options.delayMs ?? 30_000;
  if (delayMs > 0) await sleep(delayMs);
  const removed: string[] = [];
  const problems: string[] = [];
  const targets: string[] = [];
  if (String(options.resourcesPath || '').trim()) {
    const resourcesPath = String(options.resourcesPath).trim();
    targets.push(
      path.join(resourcesPath, 'agent-runtime.tar'),
      path.join(resourcesPath, 'agent-runtime.json'),
      path.join(resourcesPath, 'dsh'),
      path.join(resourcesPath, 'node')
    );
  }
  if (String(options.userDataPath || '').trim()) {
    const userDataPath = String(options.userDataPath).trim();
    targets.push(
      path.join(userDataPath, 'agent-runtime'),
      path.join(userDataPath, 'agent-runtime-bundle'),
      path.join(userDataPath, 'credentials', 'agent-provider-settings.json')
    );
  }
  for (const target of targets) await removeIfExists(target, removed, problems);
  return { removed, problems };
}
