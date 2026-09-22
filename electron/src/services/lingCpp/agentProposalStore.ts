import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceEditProposal } from './types';

/**
 * 内嵌 Agent 的提案交接目录。
 *
 * 面板内嵌 Agent 运行时的 MCP 子进程与 IDE 本地服务是两个进程，提案 store 是
 * 进程内 Map，所以模型生成的提案必须落到工作区内的受控目录，面板才能在用户
 * 点「应用提案」时按同一 ID 取回并走唯一 apply 事务。
 */
const AGENT_PROPOSAL_DIRECTORY = path.join('.lingbuilder', 'agent-proposals');
/** 提案 ID 形态固定（`lingcpp-edit-` + UUID）；不校验就会变成任意路径写入。 */
const PROPOSAL_ID_PATTERN = /^lingcpp-edit-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_PERSISTED_PROPOSALS = 20;
const MAX_PROPOSAL_BYTES = 4 * 1024 * 1024;

interface PersistedProposal {
  savedAt: string;
  expiresAt: number;
  proposal: WorkspaceEditProposal;
}

export function isPersistableProposalId(proposalId: string): boolean {
  return PROPOSAL_ID_PATTERN.test(String(proposalId || ''));
}

function proposalFile(workspaceRoot: string, proposalId: string): string {
  if (!isPersistableProposalId(proposalId)) throw new Error('提案 ID 无效，拒绝读写交接目录。');
  return path.join(workspaceRoot, AGENT_PROPOSAL_DIRECTORY, `${proposalId}.json`);
}

export async function persistAgentProposal(workspaceRoot: string, proposal: WorkspaceEditProposal): Promise<void> {
  const target = proposalFile(workspaceRoot, proposal.id);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const payload: PersistedProposal = {
    savedAt: new Date().toISOString(),
    expiresAt: Date.now() + 30 * 60_000,
    proposal
  };
  const text = JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(text, 'utf8') > MAX_PROPOSAL_BYTES) {
    throw new Error('提案内容过大，未写入交接目录；请改用增量形态重新生成提案。');
  }
  await fs.writeFile(target, text, 'utf8');
  await pruneAgentProposals(workspaceRoot).catch(() => undefined);
}

export async function readAgentProposal(workspaceRoot: string, proposalId: string): Promise<WorkspaceEditProposal | undefined> {
  if (!isPersistableProposalId(proposalId)) return undefined;
  let payload: PersistedProposal;
  try {
    payload = JSON.parse(await fs.readFile(proposalFile(workspaceRoot, proposalId), 'utf8')) as PersistedProposal;
  } catch {
    return undefined;
  }
  if (!Number.isFinite(payload?.expiresAt) || payload.expiresAt < Date.now() || !payload.proposal?.id || payload.proposal.id !== proposalId) {
    await deleteAgentProposal(workspaceRoot, proposalId).catch(() => undefined);
    return undefined;
  }
  return payload.proposal;
}

/** 删除交接文件；返回是否真的删掉了一份（面板「拒绝提案」要据此如实播报）。 */
export async function deleteAgentProposal(workspaceRoot: string, proposalId: string): Promise<boolean> {
  if (!isPersistableProposalId(proposalId)) return false;
  const target = proposalFile(workspaceRoot, proposalId);
  try {
    await fs.access(target);
  } catch {
    return false;
  }
  await fs.rm(target, { force: true });
  return true;
}

/** 面板在一轮 Agent 对话结束后取回最新一条未应用的提案，用于复用现有预览/应用 UI。 */
export async function readLatestAgentProposal(workspaceRoot: string): Promise<WorkspaceEditProposal | undefined> {
  const directory = path.join(workspaceRoot, AGENT_PROPOSAL_DIRECTORY);
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return undefined;
  }
  const files = entries.filter(name => isPersistableProposalId(name.replace(/\.json$/u, '')));
  const scored: Array<{ name: string; mtimeMs: number }> = [];
  for (const name of files) {
    try {
      scored.push({ name, mtimeMs: (await fs.stat(path.join(directory, name))).mtimeMs });
    } catch {
      continue;
    }
  }
  scored.sort((left, right) => right.mtimeMs - left.mtimeMs);
  for (const item of scored) {
    const proposal = await readAgentProposal(workspaceRoot, item.name.replace(/\.json$/u, ''));
    if (proposal) return proposal;
  }
  return undefined;
}

/** 只保留最新若干条且清掉过期项，避免交接目录无限增长留下源码草稿。 */
export async function pruneAgentProposals(workspaceRoot: string): Promise<void> {
  const directory = path.join(workspaceRoot, AGENT_PROPOSAL_DIRECTORY);
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return;
  }
  const files = entries.filter(name => name.endsWith('.json'));
  const scored: Array<{ name: string; mtimeMs: number; expired: boolean }> = [];
  for (const name of files) {
    try {
      const stat = await fs.stat(path.join(directory, name));
      let expired = false;
      try {
        const payload = JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')) as PersistedProposal;
        expired = !Number.isFinite(payload?.expiresAt) || payload.expiresAt < Date.now();
      } catch {
        expired = true;
      }
      scored.push({ name, mtimeMs: stat.mtimeMs, expired });
    } catch {
      continue;
    }
  }
  scored.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const stale = scored.filter((item, index) => item.expired || index >= MAX_PERSISTED_PROPOSALS);
  await Promise.all(stale.map(item => fs.rm(path.join(directory, item.name), { force: true }).catch(() => undefined)));
}
