import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitService, type PullRequestProvider } from '../src/services/sourceControl/gitService';

const exec = promisify(execFile);
async function git(cwd: string, args: string[]) { return await exec('git', args, { cwd, windowsHide: true, encoding: 'utf8' }); }
async function identity(cwd: string, name: string) { await git(cwd, ['config', 'user.name', name]); await git(cwd, ['config', 'user.email', `${name.toLowerCase()}@example.com`]); }

test('Git service synchronizes a bare remote and completes merge/rebase conflict lifecycles', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-remote-')); t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const bare = path.join(parent, 'remote.git'); const local = path.join(parent, 'local'); const peer = path.join(parent, 'peer'); await fs.mkdir(local);
  await git(parent, ['init', '--bare', bare]); await git(local, ['init', '--initial-branch=main']); await identity(local, 'Local');
  await fs.writeFile(path.join(local, 'shared.txt'), 'base\n'); await git(local, ['add', '.']); await git(local, ['commit', '-m', 'base']); await git(local, ['remote', 'add', 'origin', bare]); await git(local, ['push', '--set-upstream', 'origin', 'main']);
  await git(parent, ['clone', bare, peer]); await identity(peer, 'Peer'); await git(peer, ['switch', 'main']); await fs.appendFile(path.join(peer, 'shared.txt'), 'peer\n'); await git(peer, ['add', '.']); await git(peer, ['commit', '-m', 'peer']); await git(peer, ['push']);
  const service = new GitService(local); assert.equal((await service.remotes())[0].name, 'origin'); await service.fetch('origin'); let status = await service.status(); assert.equal(status.behind, 1);
  status = await service.pull('origin', 'main', 'ff-only'); assert.equal(status.behind, 0); await fs.writeFile(path.join(local, 'local.txt'), 'local\n'); await service.stage(['local.txt']); await service.commit('local'); await service.push('origin', 'main');
  await git(local, ['switch', '-c', 'feature']); await fs.writeFile(path.join(local, 'conflict.txt'), 'feature\n'); await git(local, ['add', '.']); await git(local, ['commit', '-m', 'feature']); await git(local, ['switch', 'main']); await fs.writeFile(path.join(local, 'conflict.txt'), 'main\n'); await git(local, ['add', '.']); await git(local, ['commit', '-m', 'main conflict']);
  await assert.rejects(service.merge('feature'), /CONFLICT|冲突|Automatic merge failed/iu); assert.equal((await service.conflicts())[0].path, 'conflict.txt'); const detail = await service.conflictDetail('conflict.txt'); assert.match(detail.ours, /main/u); assert.match(detail.theirs, /feature/u); await assert.rejects(service.resolveConflict('conflict.txt', 'manual', detail.working), /冲突标记/u); await service.resolveConflict('conflict.txt', 'manual', 'main + feature\n'); await service.continueIntegration('merge'); assert.equal((await service.conflicts()).length, 0); assert.equal((await fs.readFile(path.join(local, 'conflict.txt'), 'utf8')).trim(), 'main + feature');
  await git(local, ['switch', '-c', 'rebase-case', 'feature^']); await fs.writeFile(path.join(local, 'conflict.txt'), 'rebase\n'); await git(local, ['add', '.']); await git(local, ['commit', '-m', 'rebase conflict']);
  await assert.rejects(service.rebase('main'), /CONFLICT|冲突|could not apply/iu); assert.ok((await service.conflicts()).length > 0); await service.abortIntegration('rebase'); assert.equal((await service.conflicts()).length, 0);
});

test('pull request provider receives a bounded GitHub repository contract and reports failures', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-pr-')); t.after(() => fs.rm(root, { recursive: true, force: true })); await git(root, ['init', '--initial-branch=feature']); await identity(root, 'PR'); await fs.writeFile(path.join(root, 'a.txt'), 'a'); await git(root, ['add', '.']); await git(root, ['commit', '-m', 'init']); await git(root, ['remote', 'add', 'origin', 'git@github.com:lingbuilder/demo.git']);
  let captured: any; const provider: PullRequestProvider = { create: async input => { captured = input; return { number: 12, url: 'https://github.com/lingbuilder/demo/pull/12', title: input.title, state: 'OPEN' }; } };
  const service = new GitService(root, undefined, provider); const pullRequest = await service.createPullRequest({ base: 'main', title: '中文 PR', body: '说明' });
  assert.equal(pullRequest.number, 12); assert.deepEqual(captured, { repository: 'lingbuilder/demo', head: 'feature', base: 'main', title: '中文 PR', body: '说明' });
  await git(root, ['remote', 'set-url', 'origin', 'https://example.com/no/repo.git']); await assert.rejects(service.createPullRequest({ base: 'main', title: 'bad' }), /GitHub/u);
  await assert.rejects(service.createPullRequest({ base: '../bad', title: 'bad' }), /GitHub|分支/u);
});
