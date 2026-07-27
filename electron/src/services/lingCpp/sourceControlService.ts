import { SourceControlStatus } from './types';

export type SourceControlMutation =
  | 'init'
  | 'stage'
  | 'unstage'
  | 'discard'
  | 'commit'
  | 'branch.create'
  | 'branch.checkout'
  | 'branch.delete'
  | 'remote.add'
  | 'remote.update'
  | 'remote.remove'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'merge'
  | 'rebase'
  | 'conflict.resolve'
  | 'integration.continue'
  | 'integration.abort'
  | 'pull-request.create';

export class SourceControlService {
  async getStatus(): Promise<SourceControlStatus> {
    try {
      const response = await fetch('/api/source-control/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      return {
        isRepository: false,
        branch: '',
        ahead: 0,
        behind: 0,
        files: [],
        error: error?.message || '无法读取 Git 状态'
      };
    }
  }

  async execute(operation: SourceControlMutation, payload: Record<string, unknown> = {}): Promise<unknown> {
    const route = mutationRoute(operation, payload);
    const response = await fetch(route.url, {
      method: route.method,
      headers: { 'Content-Type': 'application/json' },
      body: route.method === 'DELETE' ? undefined : JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Git 操作失败。');
    return body.result ?? body;
  }
}

function mutationRoute(operation: SourceControlMutation, payload: Record<string, unknown>): { method: 'POST' | 'PUT' | 'DELETE'; url: string } {
  const post = (url: string) => ({ method: 'POST' as const, url });
  switch (operation) {
    case 'init': return post('/api/source-control/init');
    case 'stage': return post('/api/source-control/stage');
    case 'unstage': return post('/api/source-control/unstage');
    case 'discard': return post('/api/source-control/discard');
    case 'commit': return post('/api/source-control/commit');
    case 'branch.create': return post('/api/source-control/branches');
    case 'branch.checkout': return post('/api/source-control/branches/checkout');
    case 'branch.delete': return { method: 'DELETE', url: `/api/source-control/branches/${encodeURIComponent(requiredString(payload.name, '分支名称'))}` };
    case 'remote.add': return post('/api/source-control/remotes');
    case 'remote.update': return { method: 'PUT', url: `/api/source-control/remotes/${encodeURIComponent(requiredString(payload.name, '远程仓库名称'))}` };
    case 'remote.remove': return { method: 'DELETE', url: `/api/source-control/remotes/${encodeURIComponent(requiredString(payload.name, '远程仓库名称'))}` };
    case 'fetch': return post('/api/source-control/fetch');
    case 'pull': return post('/api/source-control/pull');
    case 'push': return post('/api/source-control/push');
    case 'merge': return post('/api/source-control/merge');
    case 'rebase': return post('/api/source-control/rebase');
    case 'conflict.resolve': return post('/api/source-control/conflicts/resolve');
    case 'integration.continue': return post('/api/source-control/integration/continue');
    case 'integration.abort': return post('/api/source-control/integration/abort');
    case 'pull-request.create': return post('/api/source-control/pull-requests');
    default: throw new Error(`不支持的 Git 操作：${String(operation)}`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim();
}

export const sourceControlService = new SourceControlService();
