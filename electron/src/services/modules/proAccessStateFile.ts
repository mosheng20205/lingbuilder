import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Pro 会员授权状态落盘文件（credentials/pro-access-state.json）：
 * IDE 主进程在启动、登录、退出与 Permit 30 分钟巡检时重写（72h 离线宽限随之续期）；
 * 本地服务（server.ts 的 F5 构建）与 AI Bridge ai-server（cli.ts 的 build.run 门禁）
 * 在构建时读取——它们与 IDE 同机，membership 状态非机密，直接读文件即可，
 * 不需要也不应该经env静态注入（登录发生在服务 fork 之后时 env 不会更新）。
 * 读取侧缺文件/缺字段一律返回 null（未知状态，按未授权 fail-closed，与 Permit 门禁同口径）。
 */

export const PRO_ACCESS_STATE_FILE_NAME = 'pro-access-state.json';
/** 与收费模块 Permit 的 72h 离线宽限同口径（module-commerce OFFLINE_PERMIT_MS）。 */
export const PRO_ACCESS_OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;

export interface ProAccessStateFilePayload {
  active: boolean;
  endsAt?: string | null;
  offlineUntil?: string | null;
  writtenAt?: string;
}

export function proAccessStateFromSessionPro(pro: { active?: boolean; endsAt?: string | null } | null | undefined, now: Date = new Date()): ProAccessStateFilePayload {
  const active = Boolean(pro && pro.active === true);
  return {
    active,
    endsAt: (pro && pro.endsAt) || null,
    offlineUntil: active ? new Date(now.getTime() + PRO_ACCESS_OFFLINE_GRACE_MS).toISOString() : null,
    writtenAt: now.toISOString()
  };
}

/** 主进程写入（原子替换）；目录不存在时自动创建。 */
export function writeProAccessStateFile(userDataDir: string, payload: ProAccessStateFilePayload): void {
  const target = path.join(userDataDir, 'credentials', PRO_ACCESS_STATE_FILE_NAME);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

/** 与本机授权代理发现文件同一组候选 userData 目录（打包版/开发态/录制实例全覆盖）。 */
export function resolveProAccessStateCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.LINGBUILDER_PRO_ACCESS_FILE) return [path.resolve(env.LINGBUILDER_PRO_ACCESS_FILE)];
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
  return dirs.map(dir => path.join(dir, 'credentials', PRO_ACCESS_STATE_FILE_NAME));
}

/** 读取生效中的状态：多候选按 writtenAt 取最新；离线宽限已过视为未授权。 */
export function readProAccessStateFile(candidates: string[] = resolveProAccessStateCandidates(), now: Date = new Date()): ProAccessStateFilePayload | null {
  let newest: ProAccessStateFilePayload | null = null;
  for (const file of candidates) {
    let parsed: ProAccessStateFilePayload | null = null;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ProAccessStateFilePayload;
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.active !== 'boolean') continue;
    if (!newest || (parsed.writtenAt || '') > (newest.writtenAt || '')) newest = parsed;
  }
  if (!newest || newest.active !== true) return newest && newest.active === false ? newest : null;
  if (newest.offlineUntil) {
    const until = Date.parse(newest.offlineUntil);
    if (Number.isFinite(until) && now.getTime() > until) return { ...newest, active: false };
  }
  return newest;
}

// ---------- Pro 专享命令远程开关（管理后台维护，公开端点下发，主进程落盘） ----------

export const PRO_COMMAND_RULES_FILE_NAME = 'pro-command-rules.json';

export interface ProCommandRulesFilePayload {
  rules: Record<string, string[]>;
  updatedAt?: string;
  writtenAt?: string;
}

export function writeProCommandRulesFile(userDataDir: string, payload: ProCommandRulesFilePayload): void {
  const target = path.join(userDataDir, 'credentials', PRO_COMMAND_RULES_FILE_NAME);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

/** 读取远程规则缓存：多候选取 writtenAt 最新；无文件/非法返回 null（=只有清单标记生效）。 */
export function readProCommandRulesFile(candidates: string[] = resolveProAccessStateCandidates()): ProCommandRulesFilePayload | null {
  let newest: ProCommandRulesFilePayload | null = null;
  for (const file of candidates) {
    let parsed: ProCommandRulesFilePayload | null = null;
    try {
      parsed = JSON.parse(fs.readFileSync(file.replace(PRO_ACCESS_STATE_FILE_NAME, PRO_COMMAND_RULES_FILE_NAME), 'utf8')) as ProCommandRulesFilePayload;
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.rules !== 'object' || parsed.rules === null) continue;
    if (!newest || (parsed.writtenAt || '') > (newest.writtenAt || '')) newest = parsed;
  }
  return newest;
}

/**
 * 把远程规则增量并入启用模块的清单标记（access:'pro'）：
 * 只加不减——清单里已标的命令不受远端影响（"减收费"随包版本走）；
 * 不修改原对象（模块上下文有引用稳定性契约），无规则时原数组原样返回。
 */
export function applyProCommandRules<T extends { manifest: { id: string; bindings?: { commands?: Array<{ command: string; access?: 'pro' }> }; contributes?: { commands?: Array<{ name: string; aliases?: string[]; access?: 'pro' }> } } }>(
  enabledModules: T[],
  rules: Record<string, string[]> | null | undefined
): T[] {
  if (!rules || Object.keys(rules).length === 0) return enabledModules;
  let mutated = false;
  const result = enabledModules.map(module => {
    const commands = rules[module.manifest.id];
    if (!commands || commands.length === 0) return module;
    const marked = new Set(commands);
    const manifest = module.manifest as typeof module.manifest & {
      bindings?: { commands?: Array<{ command: string; access?: 'pro' }> };
      contributes?: { commands?: Array<{ name: string; aliases?: string[]; access?: 'pro' }> };
    };
    const bindingsCommands = manifest.bindings?.commands || [];
    const contributedCommands = manifest.contributes?.commands || [];
    const needsChange = bindingsCommands.some(binding => marked.has(binding.command) && binding.access !== 'pro')
      || contributedCommands.some(command => marked.has(command.name) && command.access !== 'pro');
    if (!needsChange) return module;
    mutated = true;
    const nextManifest = {
      ...manifest,
      bindings: { ...manifest.bindings, commands: bindingsCommands.map(binding => (marked.has(binding.command) ? { ...binding, access: 'pro' as const } : binding)) },
      contributes: { ...manifest.contributes, commands: contributedCommands.map(command => (marked.has(command.name) ? { ...command, access: 'pro' as const } : command)) }
    };
    return { ...module, manifest: nextManifest };
  });
  return mutated ? result : enabledModules;
}
