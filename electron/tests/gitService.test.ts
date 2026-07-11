import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitService } from '../src/services/sourceControl/gitService';

const exec = promisify(execFile);
async function git(cwd: string, args: string[]) { return await exec('git', args, { cwd, windowsHide: true, encoding: 'utf8' }); }

test('Git service stages, unstages, commits, branches, reads history and blame in a real repository', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'user.name', 'LingBuilder Test']); await git(root, ['config', 'user.email', 'test@lingbuilder.local']);
  await fs.writeFile(path.join(root, 'main.lcpp'), '第一行\n第二行\n', 'utf8'); await git(root, ['add', 'main.lcpp']); await git(root, ['commit', '-m', '初始提交']);
  const service = new GitService(root); assert.equal((await service.status()).branch, 'main');
  await fs.appendFile(path.join(root, 'main.lcpp'), '第三行\n'); await fs.writeFile(path.join(root, 'notes.txt'), '说明\n');
  let status = await service.status(); assert.equal(status.files.length, 2); assert.equal(status.files.find(item => item.path === 'main.lcpp')?.workingTreeStatus, 'M');
  status = await service.stage(['main.lcpp', 'notes.txt']); assert.equal(status.files.every(item => Boolean(item.indexStatus)), true);
  status = await service.unstage(['notes.txt']); assert.equal(status.files.find(item => item.path === 'notes.txt')?.indexStatus, '?');
  await service.stage(['notes.txt']); const committed = await service.commit('完成中文源码'); assert.equal(committed.commit.subject, '完成中文源码'); assert.equal(committed.status.files.length, 0);
  let branches = await service.createBranch('feature/git-ui'); assert.equal(branches.find(item => item.name === 'feature/git-ui')?.current, true);
  branches = await service.checkoutBranch('main'); assert.equal(branches.find(item => item.name === 'main')?.current, true); branches = await service.deleteBranch('feature/git-ui'); assert.equal(branches.some(item => item.name === 'feature/git-ui'), false);
  const history = await service.history(10); assert.equal(history.length, 2); assert.equal(history[0].authorName, 'LingBuilder Test');
  const blame = await service.blame('main.lcpp', 1, 3); assert.equal(blame.length, 3); assert.equal(blame[2].text, '第三行'); assert.equal(blame[2].summary, '完成中文源码');
});

test('Git service rejects workspace escapes, invalid branch names, empty commits and invalid ranges', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-safe-')); t.after(() => fs.rm(parent, { recursive: true, force: true })); const root = path.join(parent, 'workspace'); await fs.mkdir(root);
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'user.name', 'Test']); await git(root, ['config', 'user.email', 'test@example.com']); await fs.writeFile(path.join(root, 'a.txt'), 'a\n'); await git(root, ['add', 'a.txt']); await git(root, ['commit', '-m', 'init']);
  const service = new GitService(root);
  await assert.rejects(service.stage(['../outside.txt']), /不能超出/u); await assert.rejects(service.createBranch('../bad'), /分支名称/u);
  await assert.rejects(service.commit('   '), /提交说明/u); await assert.rejects(service.blame('a.txt', 0, 1), /起始行/u);
});
