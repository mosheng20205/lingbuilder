import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { decodeTextFile, encodeTextFile } from '../src/services/files/textFileService';
import type { TextFileEncoding } from '../src/services/files/types';
import {
  WorkspaceSearchService,
  createWorkspaceSearchService
} from '../src/services/workspace/workspaceSearchService';
import { WorkspaceSearchError } from '../src/services/workspace/workspaceSearchTypes';

test('plain search supports case, repeated matches and Unicode code-point columns', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'unicode.lcpp'), '首行\n😀x X x\n', 'utf8');
  const service = deterministicService(root);

  const insensitive = await service.query({
    query: 'x',
    scope: 'file',
    filePath: 'src/demo/unicode.lcpp'
  });
  assert.equal(insensitive.matches.length, 3);
  assert.deepEqual(
    insensitive.matches.map(match => [match.line, match.column, match.endColumn]),
    [[2, 2, 3], [2, 4, 5], [2, 6, 7]]
  );
  assert.ok(insensitive.matches.every(match => match.preview === '😀x X x'));
  assert.equal(new Set(insensitive.matches.map(match => match.id)).size, 3);

  const sensitive = await service.query({
    query: 'x',
    scope: 'file',
    filePath: 'src/demo/unicode.lcpp',
    matchCase: true
  });
  assert.equal(sensitive.matches.length, 2);
  assert.deepEqual(sensitive.matches.map(match => match.column), [2, 6]);
});

test('file, project and workspace scopes use project roots and ignore build/vendor directories', async () => {
  const root = await createWorkspace();
  const marker = '唯一搜索标记_E01';
  await Promise.all([
    fs.writeFile(path.join(root, 'src', 'demo', 'main.lcpp'), marker, 'utf8'),
    fs.writeFile(path.join(root, 'config', 'demo', 'app.ini'), marker, 'utf8'),
    fs.writeFile(path.join(root, 'outside.txt'), marker, 'utf8'),
    fs.mkdir(path.join(root, 'node_modules', 'dependency'), { recursive: true }),
    fs.mkdir(path.join(root, 'generated', 'cpp'), { recursive: true }),
    fs.mkdir(path.join(root, '.git', 'objects'), { recursive: true })
  ]);
  await Promise.all([
    fs.writeFile(path.join(root, 'node_modules', 'dependency', 'ignored.txt'), marker, 'utf8'),
    fs.writeFile(path.join(root, 'generated', 'cpp', 'ignored.cpp'), marker, 'utf8'),
    fs.writeFile(path.join(root, '.git', 'objects', 'ignored'), marker, 'utf8')
  ]);
  const service = deterministicService(root);

  const fileResult = await service.query({
    query: marker,
    scope: 'file',
    filePath: 'outside.txt'
  });
  assert.deepEqual(fileResult.matches.map(match => match.filePath), ['outside.txt']);

  const projectResult = await service.query({ query: marker, scope: 'project', projectId: 'demo' });
  assert.deepEqual(
    projectResult.matches.map(match => match.filePath).sort(),
    ['config/demo/app.ini', 'src/demo/main.lcpp']
  );

  const workspaceResult = await service.query({ query: marker, scope: 'workspace' });
  assert.deepEqual(
    workspaceResult.matches.map(match => match.filePath).sort(),
    ['config/demo/app.ini', 'outside.txt', 'src/demo/main.lcpp']
  );
});

test('regex preview supports capture, whole-match, dollar and zero-width replacement tokens', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'replace.lcpp'), '甲12乙34', 'utf8');
  const service = deterministicService(root);

  const query = await service.query({
    query: '(\\d+)',
    scope: 'file',
    filePath: 'src/demo/replace.lcpp',
    isRegex: true
  });
  const preview = await service.preview({
    queryId: query.queryId,
    replacement: '[$1|$&|$$]'
  });
  assert.equal(preview.replacementCount, 2);
  assert.equal(preview.files[0].after, '甲[12|12|$]乙[34|34|$]');

  const zeroQuery = await service.query({
    query: '(?=乙)',
    scope: 'file',
    filePath: 'src/demo/replace.lcpp',
    isRegex: true
  });
  assert.equal(zeroQuery.matches.length, 1);
  assert.equal(zeroQuery.matches[0].matchText, '');
  const zeroPreview = await service.preview({ queryId: zeroQuery.queryId, replacement: '零宽-' });
  assert.equal(zeroPreview.files[0].after, '甲12零宽-乙34');
});

test('apply and rollback preserve UTF BOM/UTF-16 encoding, EOL and original bytes', async () => {
  const root = await createWorkspace();
  const encodings: TextFileEncoding[] = ['utf8', 'utf8bom', 'utf16le', 'utf16be'];
  const originals = new Map<string, Buffer>();
  for (const encoding of encodings) {
    const relativePath = `src/demo/${encoding}.lcpp`;
    const bytes = encodeTextFile('目标\n第二个目标\n', { encoding, eol: 'crlf' });
    originals.set(relativePath, bytes);
    await fs.writeFile(path.join(root, ...relativePath.split('/')), bytes);
  }
  const service = deterministicService(root);
  const query = await service.query({ query: '目标', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '结果' });
  const applied = await service.apply({ previewId: preview.previewId });

  assert.equal(applied.replacementCount, 8);
  assert.equal(applied.updatedFiles.length, 4);
  for (const encoding of encodings) {
    const relativePath = `src/demo/${encoding}.lcpp`;
    const bytes = await fs.readFile(path.join(root, ...relativePath.split('/')));
    const decoded = decodeTextFile(bytes);
    assert.equal(decoded.format.encoding, encoding);
    assert.equal(decoded.format.eol, 'crlf');
    assert.equal(decoded.content, '结果\n第二个结果\n');
  }

  const rolledBack = await service.rollback({ transactionId: applied.transactionId });
  assert.equal(rolledBack.restoredFiles.length, 4);
  for (const [relativePath, original] of originals) {
    assert.deepEqual(await fs.readFile(path.join(root, ...relativePath.split('/'))), original);
  }
  await assert.rejects(
    () => service.rollback({ transactionId: applied.transactionId }),
    (error: unknown) => assertSearchError(error, 'TRANSACTION_NOT_FOUND', /不存在|已经回滚/u)
  );
});

test('preview and apply reject external changes before overwriting files', async () => {
  const root = await createWorkspace();
  const target = path.join(root, 'src', 'demo', 'external.lcpp');
  await fs.writeFile(target, '待替换', 'utf8');
  const service = deterministicService(root);

  const firstQuery = await service.query({
    query: '待替换',
    scope: 'file',
    filePath: 'src/demo/external.lcpp'
  });
  await fs.writeFile(target, '外部修改一', 'utf8');
  await assert.rejects(
    () => service.preview({ queryId: firstQuery.queryId, replacement: '结果' }),
    (error: unknown) => assertSearchError(error, 'FILE_CHANGED', /重新搜索|修改/u)
  );

  await fs.writeFile(target, '待替换', 'utf8');
  const secondQuery = await service.query({
    query: '待替换',
    scope: 'file',
    filePath: 'src/demo/external.lcpp'
  });
  const preview = await service.preview({ queryId: secondQuery.queryId, replacement: '结果' });
  await fs.writeFile(target, '外部修改二', 'utf8');
  await assert.rejects(
    () => service.apply({ previewId: preview.previewId }),
    (error: unknown) => assertSearchError(error, 'FILE_CHANGED', /修改|变化/u)
  );
  assert.equal(await fs.readFile(target, 'utf8'), '外部修改二');
});

test('a second-file write failure restores every already-written file byte-for-byte', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'b.lcpp');
  const firstOriginal = encodeTextFile('替换我\n', { encoding: 'utf8bom', eol: 'crlf' });
  const secondOriginal = encodeTextFile('替换我\n', { encoding: 'utf16be', eol: 'crlf' });
  await fs.writeFile(firstPath, firstOriginal);
  await fs.writeFile(secondPath, secondOriginal);

  let writeCount = 0;
  const service = deterministicService(root, {
    writeFile: async (filePath, data) => {
      writeCount += 1;
      if (writeCount === 2) throw new Error('模拟第二个文件写入失败');
      await fs.writeFile(filePath, data);
    }
  });
  const query = await service.query({ query: '替换我', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '已替换' });
  await assert.rejects(
    () => service.apply({ previewId: preview.previewId }),
    (error: unknown) => assertSearchError(error, 'WRITE_FAILED', /已恢复|写入失败/u)
  );
  assert.deepEqual(await fs.readFile(firstPath), firstOriginal);
  assert.deepEqual(await fs.readFile(secondPath), secondOriginal);
});

test('an injected second-file rename failure also restores the first file', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'b.lcpp');
  await fs.writeFile(firstPath, '原始替换', 'utf8');
  await fs.writeFile(secondPath, '原始替换', 'utf8');
  let renameCount = 0;
  const service = deterministicService(root, {
    rename: async (sourcePath, targetPath) => {
      renameCount += 1;
      if (renameCount === 2) throw new Error('模拟第二个文件原子重命名失败');
      await fs.rename(sourcePath, targetPath);
    }
  });
  const query = await service.query({ query: '替换', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '结果' });
  await assert.rejects(
    () => service.apply({ previewId: preview.previewId }),
    (error: unknown) => assertSearchError(error, 'WRITE_FAILED', /已恢复|写入失败/u)
  );
  assert.equal(await fs.readFile(firstPath, 'utf8'), '原始替换');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '原始替换');
});

test('post-rename verification failure restores the file that was already mutated', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'b.lcpp');
  await fs.writeFile(firstPath, '原始替换', 'utf8');
  await fs.writeFile(secondPath, '原始替换', 'utf8');
  let renameCount = 0;
  const service = deterministicService(root, {
    rename: async (sourcePath, targetPath) => {
      renameCount += 1;
      await fs.rename(sourcePath, targetPath);
      if (renameCount === 2) await fs.writeFile(targetPath, '模拟落盘后损坏', 'utf8');
    }
  });

  const query = await service.query({ query: '替换', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '结果' });
  await assert.rejects(
    () => service.apply({ previewId: preview.previewId }),
    (error: unknown) => assertSearchError(error, 'WRITE_FAILED', /校验失败/u)
  );
  assert.equal(await fs.readFile(firstPath, 'utf8'), '原始替换');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '原始替换');
});

test('rollback refuses changed applied bytes and rollback write failure rolls forward consistently', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'b.lcpp');
  await fs.writeFile(firstPath, '旧值', 'utf8');
  await fs.writeFile(secondPath, '旧值', 'utf8');

  let writeCount = 0;
  let failOnWrite = Number.POSITIVE_INFINITY;
  const service = deterministicService(root, {
    writeFile: async (filePath, data) => {
      writeCount += 1;
      if (writeCount === failOnWrite) throw new Error('模拟回滚第二文件写入失败');
      await fs.writeFile(filePath, data);
    }
  });
  const query = await service.query({ query: '旧值', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '新值' });
  const applied = await service.apply({ previewId: preview.previewId });
  assert.equal(await fs.readFile(firstPath, 'utf8'), '新值');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '新值');

  failOnWrite = writeCount + 2;
  await assert.rejects(
    () => service.rollback({ transactionId: applied.transactionId }),
    (error: unknown) => assertSearchError(error, 'WRITE_FAILED', /回滚写入失败|已应用状态/u)
  );
  assert.equal(await fs.readFile(firstPath, 'utf8'), '新值');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '新值');

  const conflictService = deterministicService(root);
  const conflictQuery = await conflictService.query({ query: '新值', scope: 'project', projectId: 'demo' });
  const conflictPreview = await conflictService.preview({ queryId: conflictQuery.queryId, replacement: '第三值' });
  const conflictApplied = await conflictService.apply({ previewId: conflictPreview.previewId });
  await fs.writeFile(firstPath, '用户后续编辑', 'utf8');
  await assert.rejects(
    () => conflictService.rollback({ transactionId: conflictApplied.transactionId }),
    (error: unknown) => assertSearchError(error, 'ROLLBACK_CONFLICT', /又被修改|无法回滚/u)
  );
  assert.equal(await fs.readFile(firstPath, 'utf8'), '用户后续编辑');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '第三值');
});

test('rollback verification failure rolls the just-restored file forward too', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'b.lcpp');
  await fs.writeFile(firstPath, '旧值', 'utf8');
  await fs.writeFile(secondPath, '旧值', 'utf8');

  let renameCount = 0;
  let corruptOnRename = Number.POSITIVE_INFINITY;
  const service = deterministicService(root, {
    rename: async (sourcePath, targetPath) => {
      renameCount += 1;
      await fs.rename(sourcePath, targetPath);
      if (renameCount === corruptOnRename) await fs.writeFile(targetPath, '模拟回滚后损坏', 'utf8');
    }
  });
  const query = await service.query({ query: '旧值', scope: 'project', projectId: 'demo' });
  const preview = await service.preview({ queryId: query.queryId, replacement: '新值' });
  const applied = await service.apply({ previewId: preview.previewId });

  corruptOnRename = renameCount + 2;
  await assert.rejects(
    () => service.rollback({ transactionId: applied.transactionId }),
    (error: unknown) => assertSearchError(error, 'WRITE_FAILED', /校验失败/u)
  );
  assert.equal(await fs.readFile(firstPath, 'utf8'), '新值');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '新值');

  corruptOnRename = Number.POSITIVE_INFINITY;
  const retried = await service.rollback({ transactionId: applied.transactionId });
  assert.deepEqual(retried.restoredFiles.sort(), [
    'src/demo/a.lcpp',
    'src/demo/b.lcpp'
  ]);
  assert.equal(await fs.readFile(firstPath, 'utf8'), '旧值');
  assert.equal(await fs.readFile(secondPath, 'utf8'), '旧值');
});

test('result limits, unsafe regex, long queries, large files and cache expiry have Chinese diagnostics', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'many.lcpp'), 'xxxx', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'demo', 'large.lcpp'), '超大文件内容', 'utf8');
  let now = 100;
  let id = 0;
  const service = createWorkspaceSearchService(root, {
    maxFileBytes: 5,
    maxQueryLength: 8,
    cacheTtlMs: 10,
    now: () => now,
    createId: () => String(++id)
  });
  const result = await service.query({
    query: 'x',
    scope: 'file',
    filePath: 'src/demo/many.lcpp',
    maxResults: 2
  });
  assert.equal(result.matches.length, 2);
  assert.equal(result.truncated, true);
  assert.ok(result.diagnostics.some(diagnostic => /上限|未返回/u.test(diagnostic.message)));
  await assert.rejects(
    () => service.preview({ queryId: result.queryId, replacement: 'y' }),
    (error: unknown) => assertSearchError(error, 'RESULT_TRUNCATED', /截断/u)
  );
  const selected = await service.preview({
    queryId: result.queryId,
    replacement: 'y',
    matchIds: [result.matches[0].id]
  });
  assert.equal(selected.replacementCount, 1);

  const large = await service.query({
    query: '超',
    scope: 'file',
    filePath: 'src/demo/large.lcpp'
  });
  assert.equal(large.matches.length, 0);
  assert.equal(large.skippedFiles, 1);
  assert.ok(large.diagnostics.some(diagnostic => /超过.*上限/u.test(diagnostic.message)));

  await assert.rejects(
    () => service.query({ query: '(a+)+$', scope: 'workspace', isRegex: true }),
    (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
  );
  await assert.rejects(
    () => service.query({ query: 'a+.*a+$', scope: 'workspace', isRegex: true }),
    (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
  );
  await assert.rejects(
    () => service.query({ query: 'a+a+$', scope: 'workspace', isRegex: true }),
    (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
  );
  await assert.rejects(
    () => service.query({ query: '\\d+\\w+$', scope: 'workspace', isRegex: true }),
    (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
  );
  await assert.rejects(
    () => service.query({ query: '(a)\\1', scope: 'workspace', isRegex: true }),
    (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
  );
  const defaultSafetyService = deterministicService(root);
  for (const unsafePattern of [
    '(?=(a))\\1',
    '(?<x>a)\\k<x>',
    '\\p{ASCII}+\\w+$',
    '(ab)+(ab)+$',
    `${'a?'.repeat(45)}${'a'.repeat(45)}$`,
    `${'a{0,1}'.repeat(20)}${'a'.repeat(20)}$`,
    'a{0,999999}$'
  ]) {
    await assert.rejects(
      () => defaultSafetyService.query({ query: unsafePattern, scope: 'workspace', isRegex: true }),
      (error: unknown) => assertSearchError(error, 'UNSAFE_REGEX', /灾难性回溯/u)
    );
  }
  await assert.rejects(
    () => service.query({ query: '123456789', scope: 'workspace' }),
    (error: unknown) => assertSearchError(error, 'QUERY_TOO_LONG', /过长/u)
  );

  now = 111;
  await assert.rejects(
    () => service.preview({
      queryId: result.queryId,
      replacement: 'y',
      matchIds: [result.matches[0].id]
    }),
    (error: unknown) => assertSearchError(error, 'QUERY_EXPIRED', /过期/u)
  );
});

test('query snapshots and replacement previews enforce aggregate memory bounds', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'a.lcpp'), '限制词', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'demo', 'b.lcpp'), `限制词${'大'.repeat(2_000)}`, 'utf8');

  const fileBoundService = createWorkspaceSearchService(root, {
    maxMatchedFiles: 1,
    maxRetainedBytes: 1024 * 1024,
    createId: (() => { let id = 0; return () => `file-${++id}`; })()
  });
  const fileBound = await fileBoundService.query({ query: '限制词', scope: 'project', projectId: 'demo' });
  assert.equal(fileBound.matches.length, 1);
  assert.equal(fileBound.truncated, true);
  assert.ok(fileBound.diagnostics.some(diagnostic => diagnostic.code === 'QUERY_SNAPSHOT_LIMIT'));
  assert.ok(!fileBound.diagnostics.some(diagnostic => diagnostic.code === 'RESULT_TRUNCATED'));
  const selectedPreview = await fileBoundService.preview({
    queryId: fileBound.queryId,
    replacement: '结果',
    matchIds: fileBound.matches.map(match => match.id)
  });
  assert.equal(selectedPreview.replacementCount, 1);

  const byteBoundService = createWorkspaceSearchService(root, {
    maxMatchedFiles: 10,
    maxRetainedBytes: 1024,
    createId: (() => { let id = 0; return () => `byte-${++id}`; })()
  });
  const byteBound = await byteBoundService.query({ query: '限制词', scope: 'project', projectId: 'demo' });
  assert.equal(byteBound.matches.length, 1);
  assert.equal(byteBound.truncated, true);
  assert.ok(byteBound.diagnostics.some(diagnostic => /内存安全|快照/u.test(diagnostic.message)));

  const previewBoundService = createWorkspaceSearchService(root, {
    maxPreviewBytes: 16,
    createId: (() => { let id = 0; return () => `preview-${++id}`; })()
  });
  const previewQuery = await previewBoundService.query({
    query: '限制词',
    scope: 'file',
    filePath: 'src/demo/a.lcpp'
  });
  await assert.rejects(
    () => previewBoundService.preview({ queryId: previewQuery.queryId, replacement: '结果' }),
    (error: unknown) => assertSearchError(error, 'PREVIEW_TOO_LARGE', /预览内容超过|安全上限/u)
  );
});

test('public match text and long-line previews are bounded by Unicode code points', async () => {
  const root = await createWorkspace();
  const longLine = `${'前'.repeat(50_000)}${'a'.repeat(1_100)}`;
  await fs.writeFile(path.join(root, 'src', 'demo', 'long-line.lcpp'), longLine, 'utf8');
  const service = deterministicService(root);

  const startedAt = performance.now();
  const zeroWidth = await service.query({
    query: '(?=a)',
    scope: 'file',
    filePath: 'src/demo/long-line.lcpp',
    isRegex: true,
    maxResults: 1_000
  });
  assert.equal(zeroWidth.matches.length, 1_000);
  assert.equal(zeroWidth.truncated, true);
  assert.ok(zeroWidth.matches.every(match => Array.from(match.preview).length <= 242));
  assert.ok(zeroWidth.matches.every(match => match.previewTruncated === true));
  assert.ok(performance.now() - startedAt < 2_000, '长单行 1000 个零宽匹配应保持线性扫描');

  const wholeLine = await service.query({
    query: '[\\s\\S]+',
    scope: 'file',
    filePath: 'src/demo/long-line.lcpp',
    isRegex: true
  });
  assert.equal(wholeLine.matches.length, 1);
  assert.equal(wholeLine.matches[0].matchTextTruncated, true);
  assert.equal(Array.from(wholeLine.matches[0].matchText).length, 257);
});

test('the shared cache byte budget evicts old query snapshots before exceeding its hard limit', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'cache.lcpp'), '缓存词', 'utf8');
  let id = 0;
  const service = createWorkspaceSearchService(root, {
    maxTotalCacheBytes: 1_300,
    maxCacheEntries: 20,
    createId: () => String(++id)
  });
  const first = await service.query({ query: '缓存词', scope: 'file', filePath: 'src/demo/cache.lcpp' });
  await service.query({ query: '缓存', scope: 'file', filePath: 'src/demo/cache.lcpp' });
  const latest = await service.query({ query: '词', scope: 'file', filePath: 'src/demo/cache.lcpp' });

  await assert.rejects(
    () => service.preview({ queryId: first.queryId, replacement: '旧' }),
    (error: unknown) => assertSearchError(error, 'QUERY_NOT_FOUND', /不存在|重新搜索/u)
  );
  const preview = await service.preview({ queryId: latest.queryId, replacement: '新' });
  assert.equal(preview.replacementCount, 1);
});

test('undo transactions are not silently evicted when their entry limit is reached', async () => {
  const root = await createWorkspace();
  const firstPath = path.join(root, 'src', 'demo', 'transaction-a.lcpp');
  const secondPath = path.join(root, 'src', 'demo', 'transaction-b.lcpp');
  await fs.writeFile(firstPath, '第一旧值', 'utf8');
  await fs.writeFile(secondPath, '第二旧值', 'utf8');
  const service = createWorkspaceSearchService(root, { maxTransactionEntries: 1 });

  const firstQuery = await service.query({ query: '旧值', scope: 'file', filePath: 'src/demo/transaction-a.lcpp' });
  const firstPreview = await service.preview({ queryId: firstQuery.queryId, replacement: '新值' });
  await service.apply({ previewId: firstPreview.previewId });

  const secondQuery = await service.query({ query: '旧值', scope: 'file', filePath: 'src/demo/transaction-b.lcpp' });
  const secondPreview = await service.preview({ queryId: secondQuery.queryId, replacement: '新值' });
  await assert.rejects(
    () => service.apply({ previewId: secondPreview.previewId }),
    (error: unknown) => assertSearchError(error, 'CACHE_CAPACITY_EXCEEDED', /事务.*上限|先撤销/u)
  );
  assert.equal(await fs.readFile(secondPath, 'utf8'), '第二旧值');
});

test('cross-file result limits distinguish exact-limit results and true truncation', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'limit-a.txt'), '限', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'demo', 'limit-b.txt'), '限', 'utf8');
  const service = deterministicService(root);
  const exact = await service.query({ query: '限', scope: 'project', projectId: 'demo', maxResults: 2 });
  assert.equal(exact.matches.length, 2);
  assert.equal(exact.truncated, false);

  await fs.writeFile(path.join(root, 'config', 'demo', 'limit-c.txt'), '限', 'utf8');
  const truncated = await service.query({ query: '限', scope: 'project', projectId: 'demo', maxResults: 2 });
  assert.equal(truncated.matches.length, 2);
  assert.equal(truncated.truncated, true);
  assert.ok(truncated.diagnostics.some(diagnostic => diagnostic.code === 'RESULT_TRUNCATED'));
});

test('NUL-containing binary-like files are skipped even when their bytes are valid UTF-8', async () => {
  const root = await createWorkspace();
  await fs.writeFile(path.join(root, 'src', 'demo', 'binary.dat'), Buffer.from('可见\0搜索词', 'utf8'));
  const service = deterministicService(root);
  const result = await service.query({ query: '搜索词', scope: 'project', projectId: 'demo' });
  assert.equal(result.matches.length, 0);
  assert.equal(result.skippedFiles, 1);
  assert.ok(result.diagnostics.some(diagnostic => {
    return diagnostic.code === 'BINARY_FILE_SKIPPED' && /NUL|二进制|避免损坏/u.test(diagnostic.message);
  }));
});

test('workspace traversal ignores symlinks and file scope rejects a symlink target', async t => {
  const root = await createWorkspace();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-search-outside-'));
  await fs.writeFile(path.join(outside, 'secret.txt'), '链接外唯一内容', 'utf8');
  const link = path.join(root, 'src', 'demo', 'linked');
  try {
    await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建符号链接或目录联接。');
      return;
    }
    throw error;
  }
  const service = deterministicService(root);
  const workspace = await service.query({ query: '链接外唯一内容', scope: 'workspace' });
  assert.equal(workspace.matches.length, 0);
  assert.ok(workspace.skippedFiles >= 1);
  assert.ok(workspace.diagnostics.some(diagnostic => /符号链接|目录联接/u.test(diagnostic.message)));

  await assert.rejects(
    () => service.query({
      query: '链接外唯一内容',
      scope: 'file',
      filePath: 'src/demo/linked/secret.txt'
    }),
    (error: unknown) => assertSearchError(error, 'PATH_REJECTED', /符号链接|目录联接/u)
  );
});

async function createWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-search-'));
  await Promise.all([
    fs.mkdir(path.join(root, 'src', 'demo'), { recursive: true }),
    fs.mkdir(path.join(root, 'config', 'demo'), { recursive: true }),
    fs.mkdir(path.join(root, '.lingbuilder'), { recursive: true })
  ]);
  await fs.writeFile(
    path.join(root, '.lingbuilder', 'solution.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'solution',
      name: '测试解决方案',
      startupProjectId: 'demo',
      projects: [{
        id: 'demo',
        name: '测试项目',
        type: 'visual-cpp',
        sourceRoot: 'src/demo',
        configRoot: 'config/demo',
        designerPath: '.lingbuilder/projects/demo/window-designer.json'
      }]
    }),
    'utf8'
  );
  return root;
}

function deterministicService(
  root: string,
  fileOperations?: Parameters<typeof createWorkspaceSearchService>[1] extends infer Options
    ? Options extends { fileOperations?: infer Operations }
      ? Operations
      : never
    : never
): WorkspaceSearchService {
  let id = 0;
  return createWorkspaceSearchService(root, {
    createId: () => String(++id),
    fileOperations
  });
}

function assertSearchError(
  error: unknown,
  code: WorkspaceSearchError['code'],
  messagePattern: RegExp
): true {
  assert.ok(error instanceof WorkspaceSearchError);
  assert.equal(error.code, code);
  assert.match(error.message, messagePattern);
  return true;
}
