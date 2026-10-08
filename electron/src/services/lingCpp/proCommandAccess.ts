import type { LingCppModuleContext } from '../modules/types';

/** Pro 专享命令诊断 id 前缀：未授权调用在编辑器为 warning、构建链路为 error（阻断）。 */
export const PRO_COMMAND_DIAGNOSTIC_ID_PREFIX = 'lingcpp-pro-command-';
/** IDE 主进程向构建/桥进程注入 Pro 授权状态的环境变量名（JSON 序列化的 ProCommandAuthorizationState）。 */
export const PRO_ACCESS_ENV_NAME = 'LINGBUILDER_PRO_ACCESS';

/**
 * Pro 命令授权状态：来自登录会话（/v1/me 的 pro 字段）。
 * null / 缺省表示状态未知——按未授权处理（fail-closed，与收费模块门禁同口径），但编辑器只 warning 不打断输入。
 */
export interface ProCommandAuthorizationState {
  active: boolean;
  /** 会员到期时间（ISO）；永久买断为空。仅用于提示文案与宽限判定。 */
  endsAt?: string | null;
  /** 离线宽限截止（ISO）：与 Permit 的 72h 离线语义对齐，宽限期内按已授权放行。 */
  offlineUntil?: string | null;
}

/** 解析 LINGBUILDER_PRO_ACCESS 环境变量；缺失或非法返回 null（未知状态）。 */
export function parseProAccessEnv(value: string | undefined | null): ProCommandAuthorizationState | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProCommandAuthorizationState;
    if (!parsed || typeof parsed.active !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pro 授权是否生效：active 且（无宽限截止或仍在宽限期内）。
 * 授权口径（2026-10-05 拍板）：Pro 通用——生效中的 Pro 会员可使用全部收费模块
 * 与免费模块内的 Pro 专享命令；单模块权益与限免对「模块级」收费照旧生效，
 * 对 Pro 命令的扩展放行（该模块有效权益）留作后续扩展点，当前从严只认 Pro。
 */
export function isProAccessActive(state: ProCommandAuthorizationState | null | undefined, now: Date = new Date()): boolean {
  if (!state || state.active !== true) return false;
  if (state.offlineUntil) {
    const until = Date.parse(state.offlineUntil);
    if (Number.isFinite(until) && now.getTime() > until) return false;
  }
  return true;
}

/** 模块清单里某命令是否被标记为 Pro 专享（bindings 与 contributes 任一处标记即成立）。 */
export function isProMarkedCommand(entry: { access?: 'pro' } | undefined, contribution?: { access?: 'pro' } | undefined): boolean {
  return entry?.access === 'pro' || contribution?.access === 'pro';
}

/** 供调用方组装中文开通指引（诊断 suggestion / 门禁阻断文案同一口径）。 */
export function formatProCommandHint(): string {
  return '开通 Pro 后即可使用：可在 设置 → 账号 查看会员状态；赞助活动（截止 2026-11-11）累计满 ¥99 可直接转 Pro，或联系管理员开通。';
}

export type { LingCppModuleContext };
