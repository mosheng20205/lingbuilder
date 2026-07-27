import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export interface GitFileStatus { path: string; indexStatus: string; workingTreeStatus: string; originalPath?: string }
export interface GitStatus { isRepository: boolean; branch: string; upstream?: string; ahead: number; behind: number; files: GitFileStatus[]; error?: string }
export interface GitBranch { name: string; current: boolean; commit: string; subject: string }
export interface GitCommit { hash: string; shortHash: string; parents: string[]; authorName: string; authorEmail: string; authoredAt: string; subject: string; refs: string[] }
export interface GitBlameLine { line: number; hash: string; author: string; authorEmail: string; authoredAt: string; summary: string; text: string }
export interface GitRemote { name: string; fetchUrl: string; pushUrl: string }
export interface GitPullRequest { number?: number; url: string; title: string; state: string }
export interface GitConflictDetail { path: string; base: string; ours: string; theirs: string; working: string }
export interface GitDiff { path: string; staged: boolean; patch: string; truncated: boolean; binary: boolean }
export interface PullRequestProvider { create(input: { repository: string; head: string; base: string; title: string; body: string }): Promise<GitPullRequest> }
type Runner = (args: string[], options?: { timeout?: number }) => Promise<{ stdout: string; stderr: string }>;

const MAX_DIFF_BYTES = 2 * 1024 * 1024;

export class GitService {
  private rootPromise: Promise<string> | undefined;
  constructor(private readonly workspaceRoot: string, private readonly runner?: Runner, private readonly pullRequestProvider: PullRequestProvider = new GhCliPullRequestProvider()) {}

  async status(): Promise<GitStatus> {
    try {
      const scope = await this.repositoryScope();
      const args = ['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all'];
      if (scope.repoRelativeWorkspace) args.push('--', scope.repoRelativeWorkspace);
      const output = await this.run(args);
      const records = output.stdout.split('\0').filter(Boolean); const header = records.shift() || ''; const branchInfo = parseBranchHeader(header);
      const files: GitFileStatus[] = [];
      for (let index = 0; index < records.length; index++) {
        const record = records[index]; if (record.length < 4) continue;
        const repoPath = normalizeGitPath(record.slice(3));
        const originalRepoPath = record[0] === 'R' || record[0] === 'C'
          ? normalizeGitPath(records[++index] || '')
          : undefined;
        const workspacePath = toWorkspaceRelativeGitPath(repoPath, scope.repoRelativeWorkspace);
        if (workspacePath === undefined) continue;
        const item: GitFileStatus = { indexStatus: record[0] === ' ' ? '' : record[0], workingTreeStatus: record[1] === ' ' ? '' : record[1], path: workspacePath };
        if (originalRepoPath) item.originalPath = toWorkspaceRelativeGitPath(originalRepoPath, scope.repoRelativeWorkspace);
        files.push(item);
      }
      return { isRepository: true, ...branchInfo, files };
    } catch (error) { return { isRepository: false, branch: '', ahead: 0, behind: 0, files: [], error: message(error, '无法读取 Git 状态。') }; }
  }

  async init(defaultBranch = 'main'): Promise<GitStatus> {
    const branch = validateBranchName(defaultBranch);
    const workspace = await fs.realpath(this.workspaceRoot);
    try {
      await this.execute(['rev-parse', '--show-toplevel'], workspace, 10_000);
      throw new Error('当前工作区已经位于 Git 仓库中。');
    } catch (error) {
      if (message(error, '').includes('已经位于 Git 仓库')) throw error;
    }
    await this.execute(['init', `--initial-branch=${branch}`], workspace, 20_000);
    this.rootPromise = undefined;
    return await this.status();
  }

  async stage(paths: string[]): Promise<GitStatus> { await this.runPathCommand(['add', '--'], paths); return await this.status(); }
  async unstage(paths: string[]): Promise<GitStatus> {
    const repo = await this.repositoryRoot();
    try { await this.run(['restore', '--staged', '--'], await this.validatePaths(paths)); }
    catch { await this.run(['reset', '--quiet', 'HEAD', '--'], await this.validatePaths(paths)); }
    if (!repo) throw new Error('当前目录不是 Git 仓库。'); return await this.status();
  }

  async commit(commitMessage: string): Promise<{ commit: GitCommit; status: GitStatus }> {
    const value = commitMessage?.trim(); if (!value || value.length > 4000 || /\0/u.test(value)) throw new Error('提交说明不能为空且不能超过 4000 个字符。');
    await this.run(['commit', '--message', value], undefined, 60_000);
    const commit = (await this.history(1))[0]; if (!commit) throw new Error('Git 提交完成，但无法读取新提交。');
    return { commit, status: await this.status() };
  }

  async diff(filePath: string, staged = false): Promise<GitDiff> {
    const workspacePath = normalizeWorkspaceRelativePath(filePath);
    const [relative] = await this.validatePaths([workspacePath]);
    const status = await this.status();
    const file = status.files.find(item => item.path === workspacePath);
    if (!file) throw new Error('该文件当前没有 Git 更改。');

    if (!staged && file.workingTreeStatus === '?') {
      const absolute = await this.workspaceFilePath(workspacePath, true);
      const bytes = await fs.readFile(absolute);
      const binary = bytes.includes(0);
      if (binary) return { path: workspacePath, staged, patch: '二进制文件，无法显示文本差异。', truncated: false, binary: true };
      const body = bytes.toString('utf8').split(/\r?\n/u).map(line => `+${line}`).join('\n');
      const patch = `diff --git a/${workspacePath} b/${workspacePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${workspacePath}\n@@ -0,0 +1 @@\n${body}`;
      const limited = limitUtf8(patch, MAX_DIFF_BYTES);
      return { path: workspacePath, staged, patch: limited.value, truncated: limited.truncated, binary: false };
    }

    const args = ['diff', '--no-ext-diff', '--no-color', '--unified=3'];
    if (staged) args.push('--cached');
    args.push('--', relative);
    const output = await this.run(args, undefined, 30_000);
    const binary = /(?:Binary files .* differ|GIT binary patch)/u.test(output.stdout);
    const limited = limitUtf8(output.stdout || '该区域没有可显示的文本差异。', MAX_DIFF_BYTES);
    return { path: workspacePath, staged, patch: limited.value, truncated: limited.truncated, binary };
  }

  async discard(paths: string[]): Promise<GitStatus> {
    const normalizedPaths = paths.map(normalizeWorkspaceRelativePath);
    const status = await this.status();
    const records = new Map(status.files.map(item => [item.path, item]));
    const tracked: string[] = [];
    for (const workspacePath of normalizedPaths) {
      const record = records.get(workspacePath);
      if (!record || !record.workingTreeStatus) throw new Error(`文件 ${workspacePath} 没有可放弃的未暂存更改。`);
      if (isConflictStatus(`${record.indexStatus}${record.workingTreeStatus}`)) throw new Error(`文件 ${workspacePath} 存在冲突，请使用冲突面板解决。`);
      if (record.workingTreeStatus === '?') {
        const absolute = await this.workspaceFilePath(workspacePath);
        const stat = await fs.lstat(absolute);
        if (stat.isDirectory()) throw new Error('不能通过 Git 更改面板删除目录。');
        await fs.rm(absolute, { force: false });
      } else {
        tracked.push(workspacePath);
      }
    }
    if (tracked.length) await this.run(['restore', '--worktree', '--'], await this.validatePaths(tracked));
    return await this.status();
  }

  async branches(): Promise<GitBranch[]> {
    const output = await this.run(['for-each-ref', '--format=%(HEAD)%00%(refname:short)%00%(objectname)%00%(subject)', 'refs/heads/']);
    return output.stdout.split(/\r?\n/u).filter(Boolean).map(line => { const [head, name, commit, ...subject] = line.split('\0'); return { current: head === '*', name, commit, subject: subject.join('\0') }; });
  }
  async createBranch(name: string, checkout = true): Promise<GitBranch[]> { const valid = validateBranchName(name); await this.run(checkout ? ['switch', '--create', valid] : ['branch', valid]); return await this.branches(); }
  async checkoutBranch(name: string): Promise<GitBranch[]> { await this.run(['switch', validateBranchName(name)]); return await this.branches(); }
  async deleteBranch(name: string): Promise<GitBranch[]> { await this.run(['branch', '--delete', validateBranchName(name)]); return await this.branches(); }

  async remotes(): Promise<GitRemote[]> {
    const output = await this.run(['remote', '--verbose']); const records = new Map<string, GitRemote>();
    for (const line of output.stdout.split(/\r?\n/u)) { const match = line.match(/^(\S+)\s+(.+?)\s+\((fetch|push)\)$/u); if (!match) continue; const current = records.get(match[1]) || { name: match[1], fetchUrl: '', pushUrl: '' }; if (match[3] === 'fetch') current.fetchUrl = match[2]; else current.pushUrl = match[2]; records.set(match[1], current); }
    return [...records.values()];
  }
  async addRemote(name: string, url: string): Promise<GitRemote[]> { await this.run(['remote', 'add', validateRemoteName(name), validateRemoteUrl(url)]); return await this.remotes(); }
  async setRemoteUrl(name: string, url: string): Promise<GitRemote[]> { await this.run(['remote', 'set-url', validateRemoteName(name), validateRemoteUrl(url)]); return await this.remotes(); }
  async removeRemote(name: string): Promise<GitRemote[]> { await this.run(['remote', 'remove', validateRemoteName(name)]); return await this.remotes(); }
  async fetch(remote = 'origin'): Promise<GitStatus> { await this.run(['fetch', '--prune', validateRemoteName(remote)], undefined, 120_000); return await this.status(); }
  async pull(remote: string, branch: string, strategy: 'merge' | 'rebase' | 'ff-only' = 'ff-only'): Promise<GitStatus> {
    if (!['merge', 'rebase', 'ff-only'].includes(strategy)) throw new Error('拉取策略无效。');
    const args = ['pull']; if (strategy === 'rebase') args.push('--rebase'); else if (strategy === 'ff-only') args.push('--ff-only'); else args.push('--no-rebase');
    args.push(validateRemoteName(remote), validateBranchName(branch)); await this.run(args, undefined, 120_000); return await this.status();
  }
  async push(remote: string, branch: string, setUpstream = false): Promise<GitStatus> { const args = ['push']; if (setUpstream) args.push('--set-upstream'); args.push(validateRemoteName(remote), validateBranchName(branch)); await this.run(args, undefined, 120_000); return await this.status(); }
  async merge(branch: string): Promise<GitStatus> { try { await this.run(['merge', '--no-edit', validateBranchName(branch)], undefined, 120_000); } catch (error) { const conflicts = await this.conflicts(); if (conflicts.length) throw new Error(`合并产生 ${conflicts.length} 个冲突，请在冲突面板解决后继续或中止。`); throw error; } return await this.status(); }
  async rebase(branch: string): Promise<GitStatus> { try { await this.run(['rebase', validateBranchName(branch)], undefined, 120_000); } catch (error) { const conflicts = await this.conflicts(); if (conflicts.length) throw new Error(`变基产生 ${conflicts.length} 个冲突，请在冲突面板解决后继续或中止。`); throw error; } return await this.status(); }
  async abortIntegration(kind: 'merge' | 'rebase'): Promise<GitStatus> { validateIntegrationKind(kind); await this.run([kind, '--abort']); return await this.status(); }
  async continueIntegration(kind: 'merge' | 'rebase'): Promise<GitStatus> { validateIntegrationKind(kind); if ((await this.conflicts()).length) throw new Error('仍有未解决的冲突，不能继续。'); await this.run(kind === 'merge' ? ['commit', '--no-edit'] : ['-c', 'core.editor=true', 'rebase', '--continue'], undefined, 120_000); return await this.status(); }
  async conflicts(): Promise<GitFileStatus[]> { const status = await this.status(); return status.files.filter(item => isConflictStatus(`${item.indexStatus}${item.workingTreeStatus}`)); }
  async conflictDetail(filePath: string): Promise<GitConflictDetail> { const workspacePath = normalizeWorkspaceRelativePath(filePath); const [relative] = await this.validatePaths([workspacePath]); const readStage = async (stage: number) => { try { return (await this.run(['show', `:${stage}:${relative}`])).stdout; } catch { return ''; } }; const workingPath = await this.workspaceFilePath(workspacePath, true).catch(() => ''); return { path: workspacePath, base: await readStage(1), ours: await readStage(2), theirs: await readStage(3), working: workingPath ? await fs.readFile(workingPath, 'utf8').catch(() => '') : '' }; }
  async resolveConflict(filePath: string, resolution: 'ours' | 'theirs' | 'manual', content?: string): Promise<GitStatus> { if (!['ours', 'theirs', 'manual'].includes(resolution)) throw new Error('冲突解决方式无效。'); const workspacePath = normalizeWorkspaceRelativePath(filePath); const [relative] = await this.validatePaths([workspacePath]); if (resolution !== 'manual') await this.run(['checkout', `--${resolution}`, '--', relative]); else { if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) throw new Error('手工合并内容无效或超过 5 MB。'); if (/^(?:<<<<<<<|=======|>>>>>>>)/mu.test(content)) throw new Error('手工合并内容仍包含 Git 冲突标记，请处理完毕后再保存。'); await fs.writeFile(await this.workspaceWritePath(workspacePath), content, 'utf8'); } await this.run(['add', '--', relative]); return await this.status(); }

  async createPullRequest(options: { remote?: string; base: string; head?: string; title: string; body?: string }): Promise<GitPullRequest> {
    const remoteName = validateRemoteName(options.remote || 'origin'); const remote = (await this.remotes()).find(item => item.name === remoteName); if (!remote) throw new Error(`找不到远程仓库 ${remoteName}。`);
    const repository = parseGitHubRepository(remote.pushUrl || remote.fetchUrl); const status = await this.status(); const head = validateBranchName(options.head || status.branch); const base = validateBranchName(options.base);
    const title = validPullRequestText(options.title, 256, 'PR 标题'); const body = validPullRequestText(options.body || '', 16_000, 'PR 说明', true);
    return await this.pullRequestProvider.create({ repository, head, base, title, body });
  }

  async history(limit = 50, skip = 0): Promise<GitCommit[]> {
    const safeLimit = integer(limit, 1, 200, '历史数量'); const safeSkip = integer(skip, 0, 100_000, '历史偏移');
    const format = '%H%x00%h%x00%P%x00%an%x00%ae%x00%aI%x00%s%x00%D%x1e';
    const output = await this.run(['log', `--max-count=${safeLimit}`, `--skip=${safeSkip}`, `--format=${format}`]);
    return output.stdout.split('\x1e').map(item => item.trim()).filter(Boolean).map(item => { const [hash, shortHash, parents, authorName, authorEmail, authoredAt, subject, refs] = item.split('\0'); return { hash, shortHash, parents: parents ? parents.split(' ') : [], authorName, authorEmail, authoredAt, subject, refs: refs ? refs.split(', ').filter(Boolean) : [] }; });
  }

  async blame(filePath: string, startLine = 1, endLine = startLine): Promise<GitBlameLine[]> {
    const relative = (await this.validatePaths([filePath]))[0]; const start = integer(startLine, 1, 10_000_000, '起始行'); const end = integer(endLine, start, Math.min(start + 999, 10_000_000), '结束行');
    const output = await this.run(['blame', '--line-porcelain', `-L${start},${end}`, '--', relative]); return parseBlame(output.stdout);
  }

  private async runPathCommand(prefix: string[], paths: string[]): Promise<void> { await this.run(prefix, await this.validatePaths(paths)); }
  private async validatePaths(values: string[]): Promise<string[]> {
    if (!Array.isArray(values) || values.length < 1 || values.length > 500) throw new Error('请选择 1 到 500 个工作区文件。');
    const workspace = await fs.realpath(this.workspaceRoot); const repo = await this.repositoryRoot(); const result: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error('Git 文件路径无效。');
      const absolute = path.resolve(workspace, value); const workspaceRelative = path.relative(workspace, absolute);
      if (workspaceRelative.startsWith('..') || path.isAbsolute(workspaceRelative)) throw new Error('Git 文件路径不能超出当前工作区。');
      result.push(normalizeGitPath(path.relative(repo, absolute)));
    }
    return [...new Set(result)];
  }
  private async workspaceFilePath(value: string, verifyExistingTarget = false): Promise<string> {
    const workspace = await fs.realpath(this.workspaceRoot);
    const absolute = path.resolve(workspace, value);
    const relative = path.relative(workspace, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Git 文件路径不能超出当前工作区。');
    if (verifyExistingTarget) {
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error('Git 文件路径不能是符号链接。');
      const realTarget = await fs.realpath(absolute);
      const realRelative = path.relative(workspace, realTarget);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('Git 文件路径不能超出当前工作区。');
      return realTarget;
    }
    return absolute;
  }
  private async workspaceWritePath(value: string): Promise<string> {
    const absolute = await this.workspaceFilePath(value);
    const workspace = await fs.realpath(this.workspaceRoot);
    const parent = await fs.realpath(path.dirname(absolute));
    const parentRelative = path.relative(workspace, parent);
    if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) throw new Error('Git 文件路径不能超出当前工作区。');
    try { if ((await fs.lstat(absolute)).isSymbolicLink()) throw new Error('Git 文件路径不能是符号链接。'); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    return absolute;
  }
  private async repositoryScope(): Promise<{ repo: string; repoRelativeWorkspace: string }> {
    const [repo, workspace] = await Promise.all([this.repositoryRoot(), fs.realpath(this.workspaceRoot)]);
    return { repo, repoRelativeWorkspace: normalizeGitPath(path.relative(repo, workspace)) };
  }
  private async repositoryRoot(): Promise<string> {
    this.rootPromise ||= (async () => {
      const workspace = await fs.realpath(this.workspaceRoot); const output = await this.execute(['rev-parse', '--show-toplevel'], workspace, 10_000); const repo = await fs.realpath(output.stdout.trim());
      const relative = path.relative(repo, workspace); if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Git 仓库与当前工作区不匹配。'); return repo;
    })();
    try { return await this.rootPromise; }
    catch (error) { this.rootPromise = undefined; throw error; }
  }
  private async run(args: string[], trailing?: string[], timeout = 20_000): Promise<{ stdout: string; stderr: string }> { const root = await this.repositoryRoot(); return await this.execute([...args, ...(trailing || [])], root, timeout); }
  private async execute(args: string[], cwd: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
    try { return this.runner ? await this.runner(args, { timeout }) : await execFileAsync('git', args, { cwd, timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }) as { stdout: string; stderr: string }; }
    catch (error: any) { throw new Error(String(error?.stderr || error?.message || 'Git 命令执行失败。').trim()); }
  }
}

function parseBranchHeader(value: string): Omit<GitStatus, 'isRepository' | 'files' | 'error'> { const raw = value.startsWith('## ') ? value.slice(3) : value; const unborn = raw.match(/^(?:No commits yet on|Initial commit on) (.+)$/u); if (unborn) return { branch: unborn[1], ahead: 0, behind: 0 }; const [head, tracking = ''] = raw.split('...'); const match = tracking.match(/^(.*?) \[(.*?)\]$/u); const state = match?.[2] || ''; return { branch: head === 'HEAD (no branch)' ? '' : head, upstream: match?.[1] || (tracking || undefined), ahead: Number(state.match(/ahead (\d+)/u)?.[1] || 0), behind: Number(state.match(/behind (\d+)/u)?.[1] || 0) }; }
function normalizeGitPath(value: string): string { return value.replace(/\\/gu, '/'); }
function normalizeWorkspaceRelativePath(value: string): string { const result = normalizeGitPath(value?.trim() || '').replace(/^\.\//u, ''); if (!result || result.startsWith('/') || result.split('/').includes('..') || result.includes('\0')) throw new Error('Git 文件路径无效。'); return result; }
function toWorkspaceRelativeGitPath(repoPath: string, repoRelativeWorkspace: string): string | undefined { if (!repoRelativeWorkspace) return repoPath; const prefix = `${repoRelativeWorkspace}/`; return repoPath === repoRelativeWorkspace ? '' : repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : undefined; }
function validateBranchName(value: string): string { const result = value?.trim(); const forbidden = /[\s~^:?*\[\\\0]/u.test(result || ''); if (!result || result.length > 200 || result.startsWith('-') || forbidden || result.includes('..') || result.includes('@{') || result.includes('/.') || result.includes('.lock/') || result.endsWith('.lock') || result.endsWith('/') || result.endsWith('.')) throw new Error('分支名称无效。'); return result; }
function integer(value: number, min: number, max: number, label: string): number { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}无效。`); return value; }
function message(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback; }
function parseBlame(output: string): GitBlameLine[] { const lines = output.split(/\r?\n/u); const result: GitBlameLine[] = []; let meta: any = {}; for (const line of lines) { const header = line.match(/^([0-9a-f^]{40}) \d+ (\d+)(?: \d+)?$/u); if (header) { meta = { hash: header[1].replace(/^\^/u, ''), line: Number(header[2]) }; continue; } const pair = line.match(/^(author|author-mail|author-time|summary) (.*)$/u); if (pair) { meta[pair[1]] = pair[2]; continue; } if (line.startsWith('\t')) result.push({ line: meta.line, hash: meta.hash, author: meta.author || '', authorEmail: String(meta['author-mail'] || '').replace(/^<|>$/gu, ''), authoredAt: new Date(Number(meta['author-time'] || 0) * 1000).toISOString(), summary: meta.summary || '', text: line.slice(1) }); } return result; }
function validateRemoteName(value: string): string { const result = value?.trim(); if (!result || result.length > 200 || !/^[a-z0-9._-]+$/iu.test(result) || result.startsWith('-')) throw new Error('远程仓库名称无效。'); return result; }
function validateRemoteUrl(value: string): string { const result = value?.trim(); if (!result || result.length > 2048 || result.startsWith('-') || /[\0\r\n]/u.test(result)) throw new Error('远程仓库地址无效。'); return result; }
function isConflictStatus(value: string): boolean { return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(value); }
function validateIntegrationKind(value: string): asserts value is 'merge' | 'rebase' { if (value !== 'merge' && value !== 'rebase') throw new Error('集成操作类型无效。'); }
function parseGitHubRepository(url: string): string { const match = url.trim().match(/(?:github\.com[/:])([^/\s:]+)\/([^/\s]+?)(?:\.git)?$/iu); if (!match) throw new Error('当前远程地址不是可识别的 GitHub 仓库，无法创建 PR。'); return `${match[1]}/${match[2]}`; }
function validPullRequestText(value: string, max: number, label: string, allowEmpty = false): string { const result = value.trim(); if ((!allowEmpty && !result) || result.length > max || /\0/u.test(result)) throw new Error(`${label}无效。`); return result; }
function limitUtf8(value: string, maxBytes: number): { value: string; truncated: boolean } { const bytes = Buffer.from(value, 'utf8'); if (bytes.length <= maxBytes) return { value, truncated: false }; return { value: `${bytes.subarray(0, maxBytes).toString('utf8')}\n\n……差异内容超过 2 MB，已截断。`, truncated: true }; }

export class GhCliPullRequestProvider implements PullRequestProvider {
  async create(input: { repository: string; head: string; base: string; title: string; body: string }): Promise<GitPullRequest> {
    try {
      const result = await execFileAsync('gh', ['pr', 'create', '--repo', input.repository, '--head', input.head, '--base', input.base, '--title', input.title, '--body', input.body], { timeout: 120_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
      const url = result.stdout.trim().split(/\r?\n/u).find(line => /^https:\/\//u.test(line)); if (!url) throw new Error('GitHub CLI 未返回 PR 地址。'); const number = Number(url.match(/\/pull\/(\d+)/u)?.[1]); return { number: Number.isInteger(number) ? number : undefined, url, title: input.title, state: 'OPEN' };
    } catch (error: any) { throw new Error(`创建 PR 失败：${String(error?.stderr || error?.message || '请确认已安装 gh 并完成登录。').trim()}`); }
  }
}
