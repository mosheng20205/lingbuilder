import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildModuleDemoSpawnPlan,
  isValidModuleDemoId,
  listModuleDemoIds,
  prepareModuleDemoWorkspace,
  type ModuleDemoServiceOptions
} from '../electron/moduleDemoService';
import { collectPublicInfoItems } from '../src/services/modules/modulePublicInfo';
import type { InstalledModule } from '../src/services/modules/types';

async function createFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-demos-'));
  for (const moduleId of ['lingbuilder.demo.alpha', 'lingbuilder.demo.beta']) {
    const demoRoot = path.join(root, moduleId);
    await fs.mkdir(path.join(demoRoot, 'src'), { recursive: true });
    await fs.mkdir(path.join(demoRoot, 'config'), { recursive: true });
    await fs.writeFile(path.join(demoRoot, 'src', 'MainWindow.lcpp'), `.版本 2\n\n.子程序 _按钮1_被单击\n${moduleId}\n`, 'utf8');
    await fs.writeFile(path.join(demoRoot, 'config', 'config.ini'), '[project]\n', 'utf8');
  }
  // 结构不像工作区的目录与散文件：不应作为例程暴露。
  await fs.mkdir(path.join(root, 'lingbuilder.demo.empty'), { recursive: true });
  await fs.writeFile(path.join(root, 'notes.txt'), 'x', 'utf8');
  return root;
}

function createOptions(fixtureRoot: string, targetRoot: string, userDataRoot: string): ModuleDemoServiceOptions {
  return {
    demoSourceRoot: fixtureRoot,
    documentsPath: targetRoot,
    demoUserDataRoot: userDataRoot
  };
}

test('例程 ID 校验放行模块 ID、拒绝路径穿越与非法字符', () => {
  assert.equal(isValidModuleDemoId('lingbuilder.crypto.symmetric'), true);
  assert.equal(isValidModuleDemoId('lingbuilder.new_emoji.ui'), true);
  assert.equal(isValidModuleDemoId('../secret'), false);
  assert.equal(isValidModuleDemoId('lingbuilder..demo'), false);
  assert.equal(isValidModuleDemoId('lingbuilder/demo'), false);
  assert.equal(isValidModuleDemoId('lingbuilder\\demo'), false);
  assert.equal(isValidModuleDemoId(''), false);
  assert.equal(isValidModuleDemoId(undefined as unknown as string), false);
});

test('枚举随包例程只认工作区结构目录，根目录缺失返回空', async () => {
  const fixtureRoot = await createFixtureRoot();
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-demo-target-'));
  const userDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-demo-userdata-'));
  try {
    assert.deepEqual(await listModuleDemoIds(createOptions(fixtureRoot, targetRoot, userDataRoot)), [
      'lingbuilder.demo.alpha',
      'lingbuilder.demo.beta'
    ]);
    assert.deepEqual(
      await listModuleDemoIds(createOptions(path.join(fixtureRoot, '不存在'), targetRoot, userDataRoot)),
      []
    );
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.rm(targetRoot, { recursive: true, force: true });
    await fs.rm(userDataRoot, { recursive: true, force: true });
  }
});

test('准备例程工作区：全新复制、复用保留用户改动、半份拷贝自愈', async () => {
  const fixtureRoot = await createFixtureRoot();
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-demo-target-'));
  const userDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-demo-userdata-'));
  try {
    const options = createOptions(fixtureRoot, targetRoot, userDataRoot);

    // 全新复制：落到 文档/LingBuilder 例程/<模块ID>。
    const first = await prepareModuleDemoWorkspace(options, 'lingbuilder.demo.alpha');
    assert.equal(first.ok, true);
    const workspacePath = path.join(targetRoot, 'LingBuilder 例程', 'lingbuilder.demo.alpha');
    assert.equal(first.workspacePath, workspacePath);
    assert.equal(
      await fs.readFile(path.join(workspacePath, 'src', 'MainWindow.lcpp'), 'utf8'),
      `.版本 2\n\n.子程序 _按钮1_被单击\nlingbuilder.demo.alpha\n`
    );

    // 复用口径：用户改动与新增文件绝不覆盖；删除的官方文件补齐（自愈半份拷贝）。
    const mainPath = path.join(workspacePath, 'src', 'MainWindow.lcpp');
    await fs.writeFile(mainPath, '用户改动后的代码', 'utf8');
    await fs.writeFile(path.join(workspacePath, 'src', '我的笔记.txt'), '用户内容', 'utf8');
    await fs.rm(path.join(workspacePath, 'config', 'config.ini'));
    const second = await prepareModuleDemoWorkspace(options, 'lingbuilder.demo.alpha');
    assert.equal(second.ok, true);
    assert.equal(second.workspacePath, workspacePath);
    assert.equal(await fs.readFile(mainPath, 'utf8'), '用户改动后的代码');
    assert.equal(await fs.readFile(path.join(workspacePath, 'src', '我的笔记.txt'), 'utf8'), '用户内容');
    assert.equal(await fs.readFile(path.join(workspacePath, 'config', 'config.ini'), 'utf8'), '[project]\n');

    // 非法 ID 与缺失例程给出中文错误，不落盘。
    const invalid = await prepareModuleDemoWorkspace(options, '../escape');
    assert.equal(invalid.ok, false);
    assert.match(invalid.error || '', /例程标识不合法/u);
    const missing = await prepareModuleDemoWorkspace(options, 'lingbuilder.demo.missing');
    assert.equal(missing.ok, false);
    assert.match(missing.error || '', /没有模块.*的例程文件/u);
    await assert.rejects(() => fs.stat(path.join(targetRoot, 'LingBuilder 例程', 'lingbuilder.demo.missing')));
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.rm(targetRoot, { recursive: true, force: true });
    await fs.rm(userDataRoot, { recursive: true, force: true });
  }
});

test('新 IDE 启动计划：独立 userData 绕开单实例锁，开发态显式 app 路径', () => {
  const workspacePath = path.join(os.tmpdir(), 'LingBuilder 例程', 'lingbuilder.demo.alpha');
  const devPlan = buildModuleDemoSpawnPlan({
    isPackaged: false,
    execPath: 'C:/electron/electron.exe',
    appPath: 'T:/electron/lingbuilder/electron',
    workspacePath,
    demoUserDataDir: 'C:/userData/module-demo-runtime/lingbuilder.demo.alpha',
    parentEnv: { PATH: 'kept' }
  });
  assert.deepEqual(devPlan.args, ['T:/electron/lingbuilder/electron', '--workspace', workspacePath]);
  assert.equal(devPlan.env.LINGBUILDER_REC_USER_DATA, 'C:/userData/module-demo-runtime/lingbuilder.demo.alpha');
  assert.equal(devPlan.env.PATH, 'kept');

  const packagedPlan = buildModuleDemoSpawnPlan({
    isPackaged: true,
    execPath: 'C:/Program Files/LingBuilder/LingBuilder.exe',
    appPath: 'C:/Program Files/LingBuilder/resources/app.asar',
    workspacePath,
    demoUserDataDir: 'C:/userData/module-demo-runtime/lingbuilder.demo.alpha'
  });
  assert.deepEqual(packagedPlan.args, ['--workspace', workspacePath]);
});

test('公开信息收集为随包例程模块补「示例」条目，未随包模块不受影响', () => {  const module = {
    manifest: {
      id: 'lingbuilder.demo.alpha',
      name: '演示模块',
      version: '1.0.0',
      contributes: {
        examples: [{ title: '清单示例', path: 'examples/最小示例.lcpp' }]
      }
    }
  } as unknown as InstalledModule;

  const withDemo = collectPublicInfoItems(module, { bundledDemoModuleIds: new Set(['lingbuilder.demo.alpha']) });
  const demoItems = withDemo.filter(item => item.demoModuleId === 'lingbuilder.demo.alpha');
  assert.equal(demoItems.length, 1);
  assert.equal(demoItems[0].groupId, 'examples');
  assert.equal(demoItems[0].name, '演示模块 例程');
  // 清单里已声明的 examples 与例程共存，两种示例各有用途。
  assert.equal(withDemo.filter(item => item.groupId === 'examples').length, 2);

  const withoutDemo = collectPublicInfoItems(module);
  assert.equal(withoutDemo.filter(item => item.demoModuleId).length, 0);
  assert.equal(withoutDemo.filter(item => item.groupId === 'examples').length, 1);
});

test('打包配置把精简后的 module-demos 随 extraResources 分发', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    build?: { extraResources?: Array<{ from?: string; to?: string; filter?: string[] }> };
  };
  const entry = (packageJson.build?.extraResources || []).find(item => item.to === 'module-demos');
  assert.ok(entry, 'extraResources 缺少 module-demos 条目');
  assert.equal(entry.from, '../examples/module-demos');
  assert.ok((entry.filter || []).includes('!**/模块命令清单.json'), '例程分发必须剔除 MCP 演示语料 JSON');
  assert.ok((entry.filter || []).includes('!**/README.md'));
});
