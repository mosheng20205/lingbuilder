import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createProjectFileMutationService,
  ProjectFileMutationError,
  ProjectFileMutationScope
} from '../src/services/workspace/projectFileMutationService';

const project: ProjectFileMutationScope = {
  sourceRoot: 'src/demo',
  configRoot: 'config/demo'
};

test('project file rename preserves UTF-8 bytes and returns normalized paths', async () => {
  const root = await createTempProject();
  const service = createProjectFileMutationService(root);
  const sourcePath = path.join(root, 'src', 'demo', '主窗口.lcpp');
  const original = Buffer.from('\uFEFF类 主窗口\r\n    调试输出("中文内容🙂")\r\n结束类\r\n', 'utf8');
  await fs.writeFile(sourcePath, original);

  const result = await service.renameFile({
    project,
    sourcePath: 'src/demo/主窗口.lcpp',
    targetPath: 'src/demo/程序入口.lcpp'
  });

  assert.deepEqual(result, {
    kind: 'rename',
    sourcePath: 'src/demo/主窗口.lcpp',
    targetPath: 'src/demo/程序入口.lcpp'
  });
  assert.equal(await exists(sourcePath), false);
  assert.deepEqual(await fs.readFile(path.join(root, 'src', 'demo', '程序入口.lcpp')), original);
});

test('project file delete removes a regular file from configRoot', async () => {
  const root = await createTempProject();
  const service = createProjectFileMutationService(root);
  const targetPath = path.join(root, 'config', 'demo', '项目配置.ini');
  await fs.writeFile(targetPath, '[项目]\n名称=中文示例\n', 'utf8');

  const result = await service.deleteFile({ project, filePath: 'config/demo/项目配置.ini' });

  assert.deepEqual(result, { kind: 'delete', filePath: 'config/demo/项目配置.ini' });
  assert.equal(await exists(targetPath), false);
});

test('project file mutations report Chinese missing and conflict errors without changing files', async () => {
  const root = await createTempProject();
  const service = createProjectFileMutationService(root);
  await fs.writeFile(path.join(root, 'src', 'demo', '旧文件.lcpp'), '旧内容', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'demo', '已存在.lcpp'), '保留内容', 'utf8');

  await assert.rejects(
    () => service.deleteFile({ project, filePath: 'src/demo/不存在.lcpp' }),
    (error: unknown) => assertMutationError(error, 'FILE_NOT_FOUND', /文件不存在/u)
  );
  await assert.rejects(
    () => service.renameFile({
      project,
      sourcePath: 'src/demo/旧文件.lcpp',
      targetPath: 'src/demo/已存在.lcpp'
    }),
    (error: unknown) => assertMutationError(error, 'TARGET_EXISTS', /目标文件已存在/u)
  );

  assert.equal(await fs.readFile(path.join(root, 'src', 'demo', '旧文件.lcpp'), 'utf8'), '旧内容');
  assert.equal(await fs.readFile(path.join(root, 'src', 'demo', '已存在.lcpp'), 'utf8'), '保留内容');
});

test('project file mutations reject workspace traversal and paths outside project roots', async () => {
  const root = await createTempProject();
  const service = createProjectFileMutationService(root);
  await fs.mkdir(path.join(root, 'src', 'other'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'demo', '安全.lcpp'), '安全内容', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'other', '其他项目.lcpp'), '其他项目内容', 'utf8');

  await assert.rejects(
    () => service.deleteFile({ project, filePath: '../工作区外.lcpp' }),
    (error: unknown) => assertMutationError(error, 'OUTSIDE_WORKSPACE', /路径越界/u)
  );
  await assert.rejects(
    () => service.deleteFile({ project, filePath: 'src/other/其他项目.lcpp' }),
    (error: unknown) => assertMutationError(error, 'OUTSIDE_PROJECT_ROOTS', /不属于当前项目/u)
  );
  await assert.rejects(
    () => service.renameFile({
      project,
      sourcePath: 'src/demo/安全.lcpp',
      targetPath: 'src/other/越界目标.lcpp'
    }),
    (error: unknown) => assertMutationError(error, 'OUTSIDE_PROJECT_ROOTS', /不属于当前项目/u)
  );

  assert.equal(await fs.readFile(path.join(root, 'src', 'demo', '安全.lcpp'), 'utf8'), '安全内容');
  assert.equal(await fs.readFile(path.join(root, 'src', 'other', '其他项目.lcpp'), 'utf8'), '其他项目内容');
});

test('project file mutations reject directories and missing destination parents', async () => {
  const root = await createTempProject();
  const service = createProjectFileMutationService(root);
  await fs.writeFile(path.join(root, 'src', 'demo', '入口.lcpp'), '入口', 'utf8');

  await assert.rejects(
    () => service.deleteFile({ project, filePath: 'src/demo' }),
    (error: unknown) => assertMutationError(error, 'OUTSIDE_PROJECT_ROOTS', /不属于当前项目/u)
  );
  await assert.rejects(
    () => service.deleteFile({ project, filePath: 'src/demo/子目录' }),
    (error: unknown) => assertMutationError(error, 'NOT_A_FILE', /只能修改普通文件/u)
  );
  await assert.rejects(
    () => service.renameFile({
      project,
      sourcePath: 'src/demo/入口.lcpp',
      targetPath: 'src/demo/尚未创建/入口.lcpp'
    }),
    (error: unknown) => assertMutationError(error, 'TARGET_DIRECTORY_NOT_FOUND', /目标目录不存在/u)
  );
});

test('project file mutations reject symlink and junction components', async t => {
  const root = await createTempProject();
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-file-mutation-outside-'));
  await fs.writeFile(path.join(outsideRoot, '外部.lcpp'), '外部内容', 'utf8');
  const linkPath = path.join(root, 'src', 'demo', '链接目录');

  try {
    await fs.symlink(outsideRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建符号链接或目录联接。');
      return;
    }
    throw error;
  }

  const service = createProjectFileMutationService(root);
  await assert.rejects(
    () => service.deleteFile({ project, filePath: 'src/demo/链接目录/外部.lcpp' }),
    (error: unknown) => assertMutationError(error, 'SYMLINK_NOT_ALLOWED', /符号链接|目录联接/u)
  );
  await assert.rejects(
    () => service.renameFile({
      project,
      sourcePath: 'src/demo/普通.lcpp',
      targetPath: 'src/demo/链接目录/新文件.lcpp'
    }),
    (error: unknown) => assertMutationError(error, 'SYMLINK_NOT_ALLOWED', /符号链接|目录联接/u)
  );
  assert.equal(await fs.readFile(path.join(outsideRoot, '外部.lcpp'), 'utf8'), '外部内容');
});

async function createTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-file-mutation-'));
  await Promise.all([
    fs.mkdir(path.join(root, 'src', 'demo', '子目录'), { recursive: true }),
    fs.mkdir(path.join(root, 'config', 'demo'), { recursive: true })
  ]);
  await fs.writeFile(path.join(root, 'src', 'demo', '普通.lcpp'), '普通内容', 'utf8');
  return root;
}

function assertMutationError(
  error: unknown,
  code: ProjectFileMutationError['code'],
  messagePattern: RegExp
): true {
  assert.ok(error instanceof ProjectFileMutationError);
  assert.equal(error.code, code);
  assert.match(error.message, messagePattern);
  return true;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
