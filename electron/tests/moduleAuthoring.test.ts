import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModuleService } from '../src/services/modules/moduleService';

test('欢迎页新建模块：module-build 骨架落盘 + category/description 进清单 + 自动登记开发源', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-author-'));
  try {
    const service = createModuleService(root);
    const result = await service.createModuleSource({
      id: 'com.demo.greeter',
      name: '问候模块',
      category: '系统',
      description: '测试用问候模块。'
    });
    assert.equal(result.moduleId, 'com.demo.greeter');
    assert.equal(result.sourcePath, '.lingbuilder/module-build/com.demo.greeter');
    assert.equal(result.manifest.category, '系统');
    assert.equal(result.manifest.description, '测试用问候模块。');
    const moduleRoot = path.join(root, '.lingbuilder', 'module-build', 'com.demo.greeter');
    const manifestRaw = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8'));
    assert.equal(manifestRaw.name, '问候模块');
    assert.ok(Array.isArray(manifestRaw.contributes.constants) && manifestRaw.contributes.constants.length > 0);
    assert.ok(Array.isArray(manifestRaw.contributes.docs) && manifestRaw.contributes.docs.length > 0);
    // 骨架文件：README、使用说明与最小示例都必须真实存在。
    await fs.access(path.join(moduleRoot, 'README.md'));
    await fs.access(path.join(moduleRoot, 'docs', 'usage.md'));
    await fs.access(path.join(moduleRoot, 'examples', '最小示例.lcpp'));
    await fs.access(path.join(moduleRoot, 'src', 'module_bridge.cpp'));
    // 自动登记开发源：模块页扫描立即以 isDevLink 呈现。
    const scanned = (await service.scanInstalledModules()).find(item => item.manifest.id === 'com.demo.greeter');
    assert.ok(scanned?.isDevLink);
    assert.equal(scanned?.manifest.name, '问候模块');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('新建模块拒绝非法 ID 与重复目录（中文诊断）', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-author-guard-'));
  try {
    const service = createModuleService(root);
    await assert.rejects(() => service.createModuleSource({ id: 'Bad_ID' }), /模块 ID/);
    await assert.rejects(() => service.createModuleSource({ id: 'ab' }), /模块 ID/);
    await assert.rejects(() => service.createModuleSource({ id: 'com.demo.badcat', category: '游戏' }), /模块分类只允许/);
    await service.createModuleSource({ id: 'com.demo.dup', name: '重复测试' });
    await assert.rejects(() => service.createModuleSource({ id: 'com.demo.dup', name: '重复测试' }), /目标目录已存在/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('打开模块包：lbmod 解开为可编辑源码并登记开发源，重复打开被拒', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-open-'));
  try {
    const service = createModuleService(root);
    const created = await service.createModuleSource({
      id: 'com.demo.repack',
      name: '重打包模块',
      category: '系统',
      description: '解开重打包测试。'
    });
    await fs.mkdir(path.join(root, '.lingbuilder', 'module-packages'), { recursive: true });
    const packagePath = path.join(root, '.lingbuilder', 'module-packages', 'repack.lbmod');
    await service.exportModulePackage(created.sourceDir, packagePath);

    // 模拟「拿到 .lbmod、还没有源码」的场景：取消链接并删除源码目录。
    await service.unlinkModuleDevSource('com.demo.repack');
    await fs.rm(created.sourceDir, { recursive: true, force: true });

    const opened = await service.openModulePackageAsSource(packagePath);
    assert.equal(opened.moduleId, 'com.demo.repack');
    assert.equal(opened.sourcePath, '.lingbuilder/module-build/com.demo.repack');
    assert.deepEqual(opened.diagnostics, []);
    const manifestRaw = JSON.parse(await fs.readFile(path.join(opened.sourceDir, 'lingbuilder.module.json'), 'utf8'));
    assert.equal(manifestRaw.id, 'com.demo.repack');
    await fs.access(path.join(opened.sourceDir, 'examples', '最小示例.lcpp'));
    const scanned = (await service.scanInstalledModules()).find(item => item.manifest.id === 'com.demo.repack');
    assert.ok(scanned?.isDevLink);
    // 同一模块包重复打开：目标目录已存在必须中文拒绝，绝不静默覆盖。
    await assert.rejects(() => service.openModulePackageAsSource(packagePath), /目标目录已存在/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('打开模块包拒绝损坏文件、缺失文件与非 .lbmod 扩展名', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-open-guard-'));
  try {
    const service = createModuleService(root);
    const brokenPath = path.join(root, 'broken.lbmod');
    await fs.writeFile(brokenPath, 'this is not a zip archive', 'utf8');
    await assert.rejects(() => service.openModulePackageAsSource(brokenPath), /模块包/);
    await assert.rejects(() => service.openModulePackageAsSource(path.join(root, 'missing.lbmod')), /模块包文件不存在/);
    const wrongExtPath = path.join(root, 'wrong.txt');
    await fs.writeFile(wrongExtPath, 'x', 'utf8');
    await assert.rejects(() => service.openModulePackageAsSource(wrongExtPath), /\.lbmod/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('欢迎页模块入口接线（源码断言）：新建模块按钮与两个端点', async () => {
  const welcomeSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'WelcomePage.tsx'), 'utf8');
  assert.match(welcomeSource, /新建模块/);
  assert.match(welcomeSource, /<CreateModuleDialog/);
  const dialogSource = await fs.readFile(path.join(process.cwd(), 'src', 'components', 'CreateModuleDialog.tsx'), 'utf8');
  assert.match(dialogSource, /\/api\/modules\/developer\/create/);
  assert.match(dialogSource, /\/api\/modules\/developer\/open-package/);
  const serverSource = await fs.readFile(path.join(process.cwd(), 'server.ts'), 'utf8');
  assert.match(serverSource, /app\.post\("\/api\/modules\/developer\/create"/);
  assert.match(serverSource, /app\.post\("\/api\/modules\/developer\/open-package"/);
  assert.match(serverSource, /createModuleSource\(/);
  assert.match(serverSource, /openModulePackageAsSource\(/);
});
