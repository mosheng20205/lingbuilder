import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';

async function writeFixture(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

test('CEF3 native dependency materializer rejects a stale Bridge header without resource-body ABI', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cef3-stale-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, 'sdk');
  await Promise.all([
    writeFixture(path.join(sdk, 'include', 'cef_app.h'), '#pragma once\n'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.h'), '#pragma once\n'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.lib'), 'bridge-lib'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.dll'), 'bridge-dll'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'libcef.dll'), 'cef'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'chrome_elf.dll'), 'chrome'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'v8_context_snapshot.bin'), 'snapshot')
  ]);
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.cef3.browser', isBuiltin: true, isInstalled: true, diagnostics: [] };
  const previous = process.env.CEF3_SDK_ROOT;
  const previousCacheRoot = process.env.LINGBUILDER_SDK_CACHE_ROOT;
  process.env.CEF3_SDK_ROOT = sdk;
  // 钉空缓存根：机器级缓存若装有带新 ABI 的 CEF3 SDK，会按“优者胜”压过本用例的陈旧夹具。
  process.env.LINGBUILDER_SDK_CACHE_ROOT = path.join(root, 'empty-cache');
  try {
    const plan = await materializeModuleNativeDependencies([module], {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    });
    assert.match(plan.blockingDiagnostics.join('\n'), /LB_CEF3_ResourceResponseBodyBegin/u);
  } finally {
    if (previous === undefined) delete process.env.CEF3_SDK_ROOT;
    else process.env.CEF3_SDK_ROOT = previous;
    if (previousCacheRoot === undefined) delete process.env.LINGBUILDER_SDK_CACHE_ROOT;
    else process.env.LINGBUILDER_SDK_CACHE_ROOT = previousCacheRoot;
  }
});

test('CEF3 native dependency materializer finds the repository SDK above a nested example project', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cef3-ancestor-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, '.lingbuilder', 'modules', 'lingbuilder.cef3.sdk', 'sdk');
  const header = '#pragma once\nvoid LB_CEF3_ResourceResponseBodyBegin();\nvoid LB_CEF3_BrowserSetWindowBounds();\n// ancestor-sdk\n';
  await Promise.all([
    writeFixture(path.join(sdk, 'include', 'cef_app.h'), '#pragma once\n'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.h'), header),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.lib'), 'bridge-lib'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.dll'), 'bridge-dll'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'libcef.dll'), 'cef'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'chrome_elf.dll'), 'chrome'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'v8_context_snapshot.bin'), 'snapshot')
  ]);
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.cef3.browser', isBuiltin: true, isInstalled: true, diagnostics: [] };
  const previousSdkRoot = process.env.CEF3_SDK_ROOT;
  const previousCacheRoot = process.env.LINGBUILDER_SDK_CACHE_ROOT;
  delete process.env.CEF3_SDK_ROOT;
  process.env.LINGBUILDER_SDK_CACHE_ROOT = path.join(root, 'empty-cache');
  try {
    const buildDir = path.join(root, 'examples', 'collection', 'episode-11', 'project', '.lingbuilder-build', 'project', 'x64', 'Debug');
    const plan = await materializeModuleNativeDependencies([module], {
      buildDir, sourceDir: path.join(buildDir, 'src'), binDir: path.join(buildDir, 'bin'),
      exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    });
    assert.deepEqual(plan.blockingDiagnostics, []);
    assert.equal(await fs.readFile(path.join(buildDir, 'src', 'modules', 'lingbuilder.cef3.browser', 'include', 'LingBuilderCefBridge.h'), 'utf8'), header);
  } finally {
    if (previousSdkRoot === undefined) delete process.env.CEF3_SDK_ROOT;
    else process.env.CEF3_SDK_ROOT = previousSdkRoot;
    if (previousCacheRoot === undefined) delete process.env.LINGBUILDER_SDK_CACHE_ROOT;
    else process.env.LINGBUILDER_SDK_CACHE_ROOT = previousCacheRoot;
  }
});

test('CEF3 native dependency materializer rejects a Bridge header without popup-window-bounds ABI', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cef3-no-bounds-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, 'sdk');
  await Promise.all([
    writeFixture(path.join(sdk, 'include', 'cef_app.h'), '#pragma once\n'),
    // 有资源正文 ABI、无弹窗窗口边界 ABI：生成器已发射 LB_CEF3_BrowserSetWindowBounds
    // 调用，旧 header 会让用户工程在链接末端报「找不到标识符」，必须在物化阶段拦截。
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.h'),
      '#pragma once\nvoid LB_CEF3_ResourceResponseBodyBegin();\n'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.lib'), 'bridge-lib'),
    writeFixture(path.join(sdk, 'bridge', 'x64', 'LingBuilderCefBridge.dll'), 'bridge-dll'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'libcef.dll'), 'cef'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'chrome_elf.dll'), 'chrome'),
    writeFixture(path.join(sdk, 'bin', 'x64', 'v8_context_snapshot.bin'), 'snapshot')
  ]);
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  assert.ok(manifest);
  const module: InstalledModule = { manifest, installPath: 'builtin://lingbuilder.cef3.browser', isBuiltin: true, isInstalled: true, diagnostics: [] };
  const previous = process.env.CEF3_SDK_ROOT;
  const previousCacheRoot = process.env.LINGBUILDER_SDK_CACHE_ROOT;
  process.env.CEF3_SDK_ROOT = sdk;
  process.env.LINGBUILDER_SDK_CACHE_ROOT = path.join(root, 'empty-cache');
  try {
    const plan = await materializeModuleNativeDependencies([module], {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    });
    assert.match(plan.blockingDiagnostics.join('\n'), /LB_CEF3_BrowserSetWindowBounds/u);
  } finally {
    if (previous === undefined) delete process.env.CEF3_SDK_ROOT;
    else process.env.CEF3_SDK_ROOT = previous;
    if (previousCacheRoot === undefined) delete process.env.LINGBUILDER_SDK_CACHE_ROOT;
    else process.env.LINGBUILDER_SDK_CACHE_ROOT = previousCacheRoot;
  }
});
