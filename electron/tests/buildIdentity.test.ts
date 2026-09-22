import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diskBuildDiffersFromRunning,
  readBuildMetaFile,
  resolveBuildMetaPath
} from '../electron/buildIdentity';

test('resolveBuildMetaPath 从 dist-electron 指向 asar 内 dist/build-meta.json', () => {
  const resolved = resolveBuildMetaPath('C:/app/resources/app.asar/dist-electron');
  assert.ok(resolved.endsWith('dist/build-meta.json'.split('/').join(path.sep)));
});

test('readBuildMetaFile 读取合法清单、拒绝缺失/损坏/缺字段', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-meta-'));
  try {
    const validPath = path.join(root, 'build-meta.json');
    await fs.writeFile(validPath, JSON.stringify({
      version: '0.7.6',
      buildTime: '2026-09-20T10:17:25.000Z',
      gitHash: 'ae03eed'
    }), 'utf8');
    const meta = readBuildMetaFile(validPath);
    assert.equal(meta?.version, '0.7.6');
    assert.equal(meta?.buildTime, '2026-09-20T10:17:25.000Z');
    assert.equal(meta?.gitHash, 'ae03eed');

    assert.equal(readBuildMetaFile(path.join(root, 'missing.json')), undefined);

    const brokenPath = path.join(root, 'broken.json');
    await fs.writeFile(brokenPath, '{not json', 'utf8');
    assert.equal(readBuildMetaFile(brokenPath), undefined);

    const incompletePath = path.join(root, 'incomplete.json');
    await fs.writeFile(incompletePath, JSON.stringify({ version: '0.7.6' }), 'utf8');
    assert.equal(readBuildMetaFile(incompletePath), undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('diskBuildDiffersFromRunning：同构建不重启，升级/同版本重装都判为需要自愈', () => {
  const running = { version: '0.7.6', buildTime: '2026-09-20T10:17:25.000Z', gitHash: 'aaa' };
  const sameBuild = { version: '0.7.6', buildTime: '2026-09-20T10:17:25.000Z', gitHash: 'aaa' };
  const rebuilt = { version: '0.7.6', buildTime: '2026-09-20T18:17:25.000Z', gitHash: 'bbb' };
  const upgraded = { version: '0.8.0', buildTime: '2026-09-21T09:00:00.000Z', gitHash: 'ccc' };
  assert.equal(diskBuildDiffersFromRunning(sameBuild, running), false);
  // 同版本号重打包（今天 0.7.6 的实际场景）：构建时间不同就必须自愈。
  assert.equal(diskBuildDiffersFromRunning(rebuilt, running), true);
  assert.equal(diskBuildDiffersFromRunning(upgraded, running), true);
  // 任一侧读不到（旧安装包没有 meta）不触发，保持既有行为。
  assert.equal(diskBuildDiffersFromRunning(undefined, running), false);
  assert.equal(diskBuildDiffersFromRunning(rebuilt, undefined), false);
});

test('构建自愈链路源码断言：构建链生成 meta、main 自愈重启、渲染层构建时间戳', async () => {
  const scriptSource = await fs.readFile(path.join(process.cwd(), 'scripts', 'write-build-meta.cjs'), 'utf8');
  assert.match(scriptSource, /build-meta\.json/u);
  assert.match(scriptSource, /buildTime/u);
  const packageSource = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
  assert.match(packageSource, /write-build-meta\.cjs/u);
  const mainSource = await fs.readFile(path.join(process.cwd(), 'electron', 'main.ts'), 'utf8');
  assert.match(mainSource, /diskBuildDiffersFromRunning\(diskBuildMeta, runningBuildMeta\)/u);
  assert.match(mainSource, /app\.relaunch\(\)/u);
  assert.match(mainSource, /build-self-heal-marker\.json/u);
  const serviceSource = await fs.readFile(path.join(process.cwd(), 'src', 'services', 'product', 'buildInfo.ts'), 'utf8');
  assert.match(serviceSource, /build-meta\.json/u);
  const labelSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'BuildStampLabel.tsx'), 'utf8');
  assert.match(labelSource, /构建 /u);
});
