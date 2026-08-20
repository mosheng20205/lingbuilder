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

test('Git service initializes an unborn repository, previews staged and working diffs, discards changes and manages remotes', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-complete-')); t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'workspace'); const bareA = path.join(parent, 'remote-a.git'); const bareB = path.join(parent, 'remote-b.git');
  await fs.mkdir(root); await git(parent, ['init', '--bare', bareA]); await git(parent, ['init', '--bare', bareB]);
  const service = new GitService(root);
  assert.equal((await service.status()).isRepository, false);
  let status = await service.init('main'); assert.equal(status.isRepository, true); assert.equal(status.branch, 'main');
  await git(root, ['config', 'user.name', 'Complete']); await git(root, ['config', 'user.email', 'complete@example.com']);

  await fs.writeFile(path.join(root, 'new.txt'), '第一行\n第二行\n', 'utf8');
  status = await service.status(); assert.equal(status.files[0].workingTreeStatus, '?');
  let diff = await service.diff('new.txt', false); assert.match(diff.patch, /\+第一行/u); assert.equal(diff.staged, false);
  await service.stage(['new.txt']); diff = await service.diff('new.txt', true); assert.match(diff.patch, /new file mode/u);
  await service.commit('首次提交');

  await fs.appendFile(path.join(root, 'new.txt'), '第三行\n'); diff = await service.diff('new.txt', false); assert.match(diff.patch, /\+第三行/u);
  status = await service.discard(['new.txt']); assert.equal(status.files.length, 0); assert.doesNotMatch(await fs.readFile(path.join(root, 'new.txt'), 'utf8'), /第三行/u);
  await fs.writeFile(path.join(root, 'temporary.txt'), '即将删除\n'); await service.discard(['temporary.txt']); await assert.rejects(fs.stat(path.join(root, 'temporary.txt')), /ENOENT/u);

  let remotes = await service.addRemote('origin', bareA); assert.equal(remotes[0].fetchUrl, bareA);
  remotes = await service.setRemoteUrl('origin', bareB); assert.equal(remotes[0].fetchUrl, bareB);
  remotes = await service.removeRemote('origin'); assert.equal(remotes.length, 0);
});

test('Git service scopes status and path operations to a nested workspace', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-nested-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'sub'); await fs.mkdir(workspace);
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'user.name', 'Nested']); await git(root, ['config', 'user.email', 'nested@example.com']);
  await fs.writeFile(path.join(root, 'outside.txt'), 'base\n'); await fs.writeFile(path.join(workspace, 'inside.txt'), 'base\n'); await git(root, ['add', '.']); await git(root, ['commit', '-m', 'base']);
  await fs.appendFile(path.join(root, 'outside.txt'), 'outside\n'); await fs.appendFile(path.join(workspace, 'inside.txt'), 'inside\n');

  const service = new GitService(workspace); const status = await service.status();
  assert.deepEqual(status.files.map(item => item.path), ['inside.txt']);
  await service.stage(['inside.txt']);
  const staged = await git(root, ['diff', '--cached', '--name-only']); assert.equal(staged.stdout.trim().replace(/\\/gu, '/'), 'sub/inside.txt');
  const outside = await git(root, ['diff', '--name-only']); assert.equal(outside.stdout.trim(), 'outside.txt');
});

test('Git service manages stashes end to end with validation', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-stash-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'core.autocrlf', 'false']); await git(root, ['config', 'user.name', 'Stash']); await git(root, ['config', 'user.email', 'stash@example.com']);
  await fs.writeFile(path.join(root, 'main.lcpp'), '第一版\n', 'utf8'); await git(root, ['add', 'main.lcpp']); await git(root, ['commit', '-m', '初始']);
  const service = new GitService(root);
  await assert.rejects(service.stashSave(''), /没有可贮藏的更改/u);
  await assert.rejects(service.stashApply(1000), /贮藏索引/u);
  await assert.rejects(service.stashSave('a'.repeat(501)), /贮藏说明/u);

  await fs.appendFile(path.join(root, 'main.lcpp'), '第二行\n'); await fs.writeFile(path.join(root, 'notes.txt'), '未跟踪\n');
  let stashes = await service.stashSave('中文贮藏说明', true);
  assert.equal(stashes.length, 1); assert.equal(stashes[0].index, 0); assert.match(stashes[0].message, /中文贮藏说明/u); assert.ok(stashes[0].createdAt);
  assert.equal((await fs.readFile(path.join(root, 'main.lcpp'), 'utf8')), '第一版\n');
  assert.equal((await service.status()).files.length, 0);

  await service.stashApply(0);
  assert.equal(await fs.readFile(path.join(root, 'main.lcpp'), 'utf8'), '第一版\n第二行\n');
  assert.match(await fs.readFile(path.join(root, 'notes.txt'), 'utf8'), /未跟踪/u);
  assert.equal((await service.stashList()).length, 1);

  await service.discard(['main.lcpp']); await service.discard(['notes.txt']);
  await service.stashApply(0, true);
  assert.equal((await service.stashList()).length, 0);
  assert.match(await fs.readFile(path.join(root, 'main.lcpp'), 'utf8'), /第二行/u);

  await fs.appendFile(path.join(root, 'main.lcpp'), '第三行\n');
  await service.stashSave(undefined, false);
  const afterDrop = await service.stashDrop(0);
  assert.equal(afterDrop.length, 0);
});

test('Git service creates, lists and deletes lightweight and annotated tags', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-tag-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'user.name', 'Tag']); await git(root, ['config', 'user.email', 'tag@example.com']);
  await fs.writeFile(path.join(root, 'a.txt'), 'a\n', 'utf8'); await git(root, ['add', 'a.txt']); await git(root, ['commit', '-m', '初始']);
  const service = new GitService(root);
  let tags = await service.createTag('v1.0.0');
  assert.equal(tags.length, 1); assert.equal(tags[0].name, 'v1.0.0'); assert.equal(tags[0].commit.length, 40);
  tags = await service.createTag('v2.0.0', '发布说明');
  assert.equal(tags.length, 2);
  assert.equal(tags.find(item => item.name === 'v2.0.0')?.subject, '发布说明');
  tags = await service.deleteTag('v1.0.0');
  assert.equal(tags.some(item => item.name === 'v1.0.0'), false);
  assert.equal(tags.some(item => item.name === 'v2.0.0'), true);
  await assert.rejects(service.createTag('bad name'), /标签名称/u);
  await assert.rejects(service.createTag('-bad'), /标签名称/u);
  await assert.rejects(service.createTag('a..b'), /标签名称/u);
  await assert.rejects(service.createTag('v1', 'x'.repeat(2001)), /标签说明/u);
});

test('Git service diff returns original and modified contents for side-by-side rendering', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-diff2-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'user.name', 'Diff']); await git(root, ['config', 'user.email', 'diff@example.com']);
  await fs.writeFile(path.join(root, 'main.lcpp'), '第一行\n', 'utf8'); await git(root, ['add', 'main.lcpp']); await git(root, ['commit', '-m', '初始']);
  const service = new GitService(root);

  await fs.appendFile(path.join(root, 'main.lcpp'), '第二行\n');
  let diff = await service.diff('main.lcpp', false);
  assert.equal(diff.original, '第一行\n'); assert.equal(diff.modified, '第一行\n第二行\n'); assert.equal(diff.language, 'lingcpp'); assert.equal(diff.binary, false);

  await service.stage(['main.lcpp']);
  diff = await service.diff('main.lcpp', true);
  assert.equal(diff.original, '第一行\n'); assert.equal(diff.modified, '第一行\n第二行\n');

  await fs.writeFile(path.join(root, 'new.lcpp'), '全新文件\n', 'utf8');
  diff = await service.diff('new.lcpp', false);
  assert.equal(diff.original, ''); assert.equal(diff.modified, '全新文件\n');

  await fs.unlink(path.join(root, 'main.lcpp'));
  diff = await service.diff('main.lcpp', false);
  assert.equal(diff.modified, ''); assert.equal(diff.original, '第一行\n第二行\n');
});

test('Git service stages and unstages everything including unborn repositories via bulk operations', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-bulk-')); t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'workspace'); await fs.mkdir(root);
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'core.autocrlf', 'false']); await git(root, ['config', 'user.name', 'Bulk']); await git(root, ['config', 'user.email', 'bulk@example.com']);
  const service = new GitService(root);

  await fs.writeFile(path.join(root, 'a.txt'), 'a\n', 'utf8'); await fs.writeFile(path.join(root, 'b.txt'), 'b\n', 'utf8');
  let status = await service.stageAll();
  assert.equal(status.files.length, 2); assert.equal(status.files.every(item => item.indexStatus === 'A'), true);
  status = await service.unstageAll();
  assert.equal(status.files.length, 2); assert.equal(status.files.every(item => item.workingTreeStatus === '?'), true);

  await service.stageAll(); await service.commit('首个提交');
  await fs.appendFile(path.join(root, 'a.txt'), '修改\n'); await fs.writeFile(path.join(root, 'c.txt'), 'c\n', 'utf8');
  status = await service.stageAll();
  assert.equal(status.files.length, 2); assert.equal(status.files.every(item => Boolean(item.indexStatus)), true);
  status = await service.unstageAll();
  assert.equal(status.files.filter(item => Boolean(item.indexStatus) && item.indexStatus !== '?').length, 0);
  assert.equal(status.files.length, 2); assert.equal(status.files.find(item => item.path === 'a.txt')?.workingTreeStatus, 'M');
});

test('Git service bulk stage and unstage respect a nested workspace scope', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-git-bulk-nested-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'sub'); await fs.mkdir(workspace);
  await git(root, ['init', '--initial-branch=main']); await git(root, ['config', 'core.autocrlf', 'false']); await git(root, ['config', 'user.name', 'Nested']); await git(root, ['config', 'user.email', 'nested@example.com']);
  await fs.writeFile(path.join(root, 'outside.txt'), 'base\n'); await fs.writeFile(path.join(workspace, 'inside.txt'), 'base\n'); await git(root, ['add', '.']); await git(root, ['commit', '-m', 'base']);
  await fs.appendFile(path.join(root, 'outside.txt'), 'outside\n'); await fs.appendFile(path.join(workspace, 'inside.txt'), 'inside\n');

  const service = new GitService(workspace);
  let status = await service.stageAll();
  assert.deepEqual(status.files.map(item => item.path), ['inside.txt']);
  assert.equal(status.files.every(item => Boolean(item.indexStatus)), true);
  const staged = await git(root, ['diff', '--cached', '--name-only']); assert.equal(staged.stdout.trim().replace(/\\/gu, '/'), 'sub/inside.txt');
  status = await service.unstageAll();
  assert.equal(status.files.find(item => item.path === 'inside.txt')?.workingTreeStatus, 'M');
  assert.equal(status.files.find(item => item.path === 'inside.txt')?.indexStatus, '');
});
