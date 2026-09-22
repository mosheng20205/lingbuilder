import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AiBridgeService } from '../src/services/aiBridge/aiBridgeService';
import { createModuleService } from '../src/services/modules/moduleService';

/**
 * P4（2026-09-21）：Windows 目录联接（mklink /J）的 readdir dirent 报 isSymbolicLink 而非 isDirectory。
 * 「把模块目录联接进 .lingbuilder/modules 省磁盘」必须与真实目录同语义——此前被静默跳过，
 * 用户看到的是构建报「项目尚未启用 xxx 模块」，无从自查。
 */

function fixtureManifest(id: string, name: string) {
  return {
    schemaVersion: 2,
    id,
    name,
    version: '1.0.0',
    category: '其他',
    description: '目录联接扫描测试模块。',
    contributes: {
      commands: [{ name: '联接探针_命令', signature: '联接探针_命令()', description: '测试命令。', insertText: '联接探针_命令()', returnType: '空' }],
      docs: [{ title: '使用说明', path: 'docs/usage.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    targets: [{
      id: 'windows-msvc-win32',
      platform: 'windows',
      arch: 'win32',
      toolchain: 'msvc',
      includeDirs: [],
      headers: [],
      libs: [],
      runtimeFiles: []
    }],
    bindings: { commands: [{ command: '联接探针_命令', runtimeName: '联接探针_命令', returnType: 'void' }] }
  };
}

async function writeModuleFiles(moduleDir: string, manifest: unknown): Promise<void> {
  await fs.mkdir(path.join(moduleDir, 'docs'), { recursive: true });
  await fs.mkdir(path.join(moduleDir, 'examples'), { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'lingbuilder.module.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(path.join(moduleDir, 'docs', 'usage.md'), '# 使用说明\n', 'utf8');
  await fs.writeFile(path.join(moduleDir, 'examples', 'demo.lcpp'), '类 Demo\n结束类\n', 'utf8');
}

test('目录联接（junction）接入的模块能被识别为已安装/已启用', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-mod-junction-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const realModuleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-mod-junction-src-'));
  t.after(() => fs.rm(realModuleDir, { recursive: true, force: true }));
  const manifest = fixtureManifest('sample.junction.mod', '联接模块');
  await writeModuleFiles(realModuleDir, manifest);

  const modulesDir = path.join(workspaceRoot, '.lingbuilder', 'modules');
  await fs.mkdir(modulesDir, { recursive: true });
  try {
    await fs.symlink(realModuleDir, path.join(modulesDir, 'sample.junction.mod'), 'junction');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建目录联接。');
      return;
    }
    throw error;
  }

  const service = createModuleService(workspaceRoot);
  const scanned = await service.scanInstalledModules();
  const found = scanned.find(item => item.manifest.id === 'sample.junction.mod');
  assert.ok(found, 'junction 接入的模块必须被扫描识别，不得静默跳过');
  assert.equal(found.isInstalled, true);
  assert.doesNotMatch(found.diagnostics.join('\n'), /清单读取失败/u);
  assert.match(found.installPath.replace(/\\/gu, '/'), /sample\.junction\.mod$/u);

  // 启用到项目后再次扫描：enabled 状态必须一致（构建门禁消费同一出口）。
  await service.enableModuleForProject('lingbuilder-ui-project', 'sample.junction.mod');
  const reScanned = (await service.scanInstalledModules('lingbuilder-ui-project'))
    .find(item => item.manifest.id === 'sample.junction.mod');
  assert.equal(reScanned?.isEnabledForProject, true, 'junction 模块启用后必须参与构建模块集合');
});

test('失效的目录联接给出中文诊断，不静默跳过', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-mod-junction-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const modulesDir = path.join(workspaceRoot, '.lingbuilder', 'modules');
  await fs.mkdir(modulesDir, { recursive: true });
  try {
    await fs.symlink(path.join(workspaceRoot, 'no-such-target'), path.join(modulesDir, 'broken.junction.mod'), 'junction');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建目录联接。');
      return;
    }
    throw error;
  }

  const service = createModuleService(workspaceRoot);
  const scanned = await service.scanInstalledModules();
  const broken = scanned.find(item => item.installPath.replace(/\\/gu, '/').endsWith('broken.junction.mod'));
  assert.ok(broken, '失效联接必须产生条目');
  assert.match(broken.diagnostics.join('\n'), /目录联接|符号链接/u, '必须给出中文诊断说明如何修复');
});

test('module.info 的 enabled/installPath 自带作用域，跨工作区路径必须显式标注（P6）', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-mod-junction-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const realModuleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-mod-junction-src-'));
  t.after(() => fs.rm(realModuleDir, { recursive: true, force: true }));
  await writeModuleFiles(realModuleDir, fixtureManifest('sample.junction.mod', '联接模块'));

  const modulesDir = path.join(workspaceRoot, '.lingbuilder', 'modules');
  await fs.mkdir(modulesDir, { recursive: true });
  try {
    await fs.symlink(realModuleDir, path.join(modulesDir, 'sample.junction.mod'), 'junction');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建目录联接。');
      return;
    }
    throw error;
  }

  const service = new AiBridgeService({
    workspaceRoot, host: '127.0.0.1', port: 0, token: 'junction-info-token',
    permission: 'readonly', allowRemote: false, enableMcp: false
  });
  t.after(() => service.shutdown());
  try {
    const info = await service.getModuleInfo({ moduleId: 'sample.junction.mod' });
    assert.equal(info.installPathScope, 'workspace');
    // 联接指向工作区之外：路径必须带「工作区之外」标注，不得返回未标注的跨工作区路径。
    assert.equal(info.installPathOutsideWorkspace, true);
    assert.match(String(info.installPathNote), /工作区之外/u);
    assert.equal(path.resolve(String(info.scannedWorkspaceRoot)), path.resolve(workspaceRoot));
    assert.equal(info.enabledForProject, 'lingbuilder-ui-project');
    assert.match(String(info.enabledScopeNote), /enabledForProject/u);

    // 内置模块：标注 builtin，且不得误标「工作区之外」。
    const builtin = await service.getModuleInfo({ moduleId: 'lingbuilder.database.sqlite' });
    assert.equal(builtin.installPathScope, 'builtin');
    assert.ok(!builtin.installPathOutsideWorkspace);
  } finally {
    await service.shutdown();
  }
});
