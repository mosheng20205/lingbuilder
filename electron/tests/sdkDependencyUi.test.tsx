import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import type { SdkDependencyStatus } from '../src/services/sdkDependencies/sdkDependencyService';

test('SDK 安装对话框提供确认、进度、取消、重试和共享缓存说明', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/SdkDependencyInstallerDialog.tsx'),
    'utf8'
  );
  assert.match(source, /安装项目所需 SDK/u);
  assert.match(source, /所有 LingBuilder 工作区共享/u);
  assert.match(source, /role="progressbar"/u);
  assert.match(source, /进度 \{snapshot\.job\.progress/u);
  assert.match(source, /bytesPerSecond !== null/u);
  assert.match(source, /取消下载/u);
  assert.match(source, /重试安装/u);
  assert.match(source, /SHA-256/u);
  assert.doesNotMatch(source, /window\.confirm/u);
});

test('统一请求包装器只在 SDK 安装成功后重放一次原请求', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const dependency: SdkDependencyStatus = {
    id: 'cef3', moduleId: 'lingbuilder.cef3.sdk', name: 'CEF3 环境 SDK', version: 'test',
    platform: 'windows-x64', archiveBytes: 10, installed: false, installPath: null, source: null
  };
  let operationCalls = 0;
  let statusCalls = 0;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url === '/operation') {
      operationCalls += 1;
      return operationCalls === 1
        ? Response.json({ ok: false, code: 'SDK_DEPENDENCY_REQUIRED', dependencies: [dependency] }, { status: 409 })
        : Response.json({ ok: true });
    }
    if (url === '/api/sdk-dependencies/status') {
      statusCalls += 1;
      return Response.json({
        ok: true,
        dependencies: [{ ...dependency, installed: statusCalls > 1 }],
        job: statusCalls > 1
          ? { id: 'job', dependencyId: 'cef3', state: 'succeeded', active: false, message: '完成', downloadedBytes: 10, totalBytes: 10, progress: 100, bytesPerSecond: null, startedAt: '', finishedAt: '', error: null }
          : { id: null, dependencyId: null, state: 'idle', active: false, message: '空闲', downloadedBytes: 0, totalBytes: 0, progress: null, bytesPerSecond: null, startedAt: null, finishedAt: null, error: null }
      });
    }
    if (url === '/api/sdk-dependencies/install') {
      return Response.json({ ok: true, job: { id: 'job', dependencyId: 'cef3', state: 'downloading', active: true, message: '下载', downloadedBytes: 0, totalBytes: 10, progress: 0, bytesPerSecond: 1, startedAt: '', finishedAt: null, error: null } }, { status: 202 });
    }
    throw new Error(`未预期请求：${url}`);
  };
  const { fetchWithSdkDependencies, sdkDependencyPromptCoordinator } = await import('../src/services/sdkDependencies/sdkDependencyClient');
  const responsePromise = fetchWithSdkDependencies(() => fetch('/operation'));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(sdkDependencyPromptCoordinator.getSnapshot().open, true);
  await sdkDependencyPromptCoordinator.install();
  const response = await responsePromise;
  assert.equal((await response.json() as { ok: boolean }).ok, true);
  assert.equal(operationCalls, 2);
  assert.equal(statusCalls, 2);
});

test('同一安装流程会合并并发请求后到达的 SDK 依赖', async () => {
  const { SdkDependencyPromptCoordinator } = await import('../src/services/sdkDependencies/sdkDependencyClient');
  const coordinator = new SdkDependencyPromptCoordinator();
  const cef3: SdkDependencyStatus = {
    id: 'cef3', moduleId: 'lingbuilder.cef3.sdk', name: 'CEF3 环境 SDK', version: 'test',
    platform: 'windows-x64', archiveBytes: 10, installed: false, installPath: null, source: null
  };
  const fbro: SdkDependencyStatus = {
    id: 'fbro', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro 环境 SDK', version: 'test',
    platform: 'windows-x64', archiveBytes: 20, installed: false, installPath: null, source: null
  };
  const first = coordinator.requestInstall([cef3]);
  const second = coordinator.requestInstall([fbro]);
  assert.equal(first, second);
  assert.deepEqual(coordinator.getSnapshot().dependencies.map(item => item.id), ['cef3', 'fbro']);
  await coordinator.cancel();
  await assert.rejects(first, /取消/u);
});
