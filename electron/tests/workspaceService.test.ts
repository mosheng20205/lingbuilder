import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildWorkspaceWindowLaunch, DesktopWorkspaceService, findWorkspaceFileArgument, getArgumentValue, isWorkspaceFilePath, RECENT_WORKSPACES_LIMIT, resolveWorkspaceDropTarget } from '../electron/workspaceService';

test('workspace service prefers --workspace and remembers it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-arg-'));
  const target = path.join(root, 'target');
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', target],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });

  assert.equal(await service.resolveInitialWorkspace(), target);
  const state = JSON.parse(await fs.readFile(path.join(root, 'UserData', 'workspace-state.json'), 'utf8'));
  assert.equal(state.lastWorkspace, target);
  assert.equal(getArgumentValue(['app', '--workspace=E:\\项目'], '--workspace'), 'E:\\项目');
});

test('packaged workspace history is isolated from legacy development history', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const userDataPath = path.join(root, 'UserData');
  const developmentWorkspace = path.join(root, 'repository');
  await fs.mkdir(developmentWorkspace, { recursive: true });
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(path.join(userDataPath, 'workspace-state.json'), JSON.stringify({
    schemaVersion: 2,
    lastWorkspace: developmentWorkspace,
    recentWorkspaces: [developmentWorkspace]
  }));

  const packaged = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe'],
    documentsPath: path.join(root, 'Documents'),
    userDataPath,
    profile: 'packaged'
  });
  const initial = await packaged.resolveInitialWorkspace();
  assert.notEqual(initial, developmentWorkspace);
  assert.equal(initial, path.join(root, 'Documents', 'LingBuilder', '起始工作区'));
  assert.deepEqual(await packaged.listRecentWorkspaces(), [initial]);
  assert.ok(await exists(path.join(userDataPath, 'workspace-state.packaged.json')));
});

test('closing a solution can allocate a fresh workspace without deleting the old one', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-fresh-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe'],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData'),
    profile: 'packaged'
  });
  const first = await service.createFreshWorkspace();
  const second = await service.createFreshWorkspace();
  assert.equal(path.basename(first), '新建工作区');
  assert.equal(path.basename(second), '新建工作区 2');
  assert.ok(await exists(first));
  assert.ok(await exists(second));
});

test('workspace service accepts a .lbsln through the explicit --workspace argument', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-arg-entry-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.lingbuilder'));
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), '{}');
  const entryPath = path.join(root, 'Demo.lbsln');
  await fs.writeFile(entryPath, JSON.stringify({ schemaVersion: 1, kind: 'lingbuilder-solution', solutionFile: '.lingbuilder/solution.json' }));
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', entryPath],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });
  assert.equal(await service.resolveInitialWorkspace(), root);
});

test('workspace seed copies missing files and never overwrites user changes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-seed-'));
  const source = path.join(root, 'seed');
  const documents = path.join(root, 'Documents');
  const target = path.join(documents, 'LingBuilder', '起始工作区');
  await fs.mkdir(path.join(source, 'src'), { recursive: true });
  await fs.writeFile(path.join(source, 'src', 'Main.lcpp'), '初始内容', 'utf8');

  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe'],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserData'),
    defaultWorkspaceSource: source,
    seedVersion: '2.0.0'
  });

  assert.equal(await service.resolveInitialWorkspace(), target);
  await fs.writeFile(path.join(target, 'src', 'Main.lcpp'), '用户修改', 'utf8');
  await service.seedDefaultWorkspace();
  assert.equal(await fs.readFile(path.join(target, 'src', 'Main.lcpp'), 'utf8'), '用户修改');
  const marker = JSON.parse(await fs.readFile(path.join(target, '.lingbuilder', 'seed.json'), 'utf8'));
  assert.equal(marker.seedVersion, '2.0.0');
});

test('workspace service migrates recents, deduplicates, bounds history, and forgets entries', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-recents-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const userDataPath = path.join(root, 'UserData');
  await fs.mkdir(userDataPath, { recursive: true });
  const first = path.join(root, 'first'); await fs.mkdir(first);
  await fs.writeFile(path.join(userDataPath, 'workspace-state.json'), JSON.stringify({ schemaVersion: 1, lastWorkspace: first }));
  const service = new DesktopWorkspaceService({ argv: ['app'], documentsPath: root, userDataPath });
  assert.deepEqual(await service.listRecentWorkspaces(), [first]);
  for (let index = 0; index < 12; index += 1) await service.rememberWorkspace(path.join(root, `workspace-${index}`));
  const recent = await service.listRecentWorkspaces();
  assert.equal(recent.length, 13);
  assert.equal(recent[0], path.join(root, 'workspace-11'));
  await service.rememberWorkspace(recent[1]);
  assert.equal((await service.listRecentWorkspaces())[0], recent[1]);
  await service.forgetWorkspace(recent[1]);
  assert.equal((await service.listRecentWorkspaces()).includes(recent[1]), false);
});

test(`recent workspace history keeps at most ${RECENT_WORKSPACES_LIMIT} entries for the welcome page full list`, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-limit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new DesktopWorkspaceService({
    argv: ['app'],
    documentsPath: root,
    userDataPath: path.join(root, 'UserData')
  });
  for (let index = 0; index < RECENT_WORKSPACES_LIMIT + 5; index += 1) {
    await service.rememberWorkspace(path.join(root, `workspace-${String(index).padStart(4, '0')}`));
  }
  const recent = await service.listRecentWorkspaces();
  assert.equal(recent.length, RECENT_WORKSPACES_LIMIT);
  assert.equal(recent[0], path.resolve(path.join(root, `workspace-${String(RECENT_WORKSPACES_LIMIT + 4).padStart(4, '0')}`)));
  assert.equal(recent[recent.length - 1], path.resolve(path.join(root, 'workspace-0005')));
});

test('workspace service persists window state and validates dropped files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-drop-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  const source = path.join(project, 'Main.lcpp'); await fs.writeFile(source, '类 Main\n结束类\n');
  const unsupported = path.join(project, 'readme.txt'); await fs.writeFile(unsupported, 'x');
  assert.equal(await resolveWorkspaceDropTarget(project), project);
  assert.equal(await resolveWorkspaceDropTarget(source), project);
  await assert.rejects(resolveWorkspaceDropTarget(unsupported), /不支持/u);
  const service = new DesktopWorkspaceService({ argv: ['app', source], documentsPath: root, userDataPath: path.join(root, 'profile') });
  assert.equal(await service.resolveInitialWorkspace(), project);
  await service.rememberWindowState({ x: 20, y: 30, width: 1200, height: 800, maximized: true });
  assert.deepEqual(await service.getWindowState(), { x: 20, y: 30, width: 1200, height: 800, maximized: true });
});

test('a valid .lbsln opens its workspace and damaged entries are rejected', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lbsln-open-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.lingbuilder'), { recursive: true });
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), '{}', 'utf8');
  const entryPath = path.join(root, '演示解决方案.lbsln');
  await fs.writeFile(entryPath, JSON.stringify({
    schemaVersion: 1,
    kind: 'lingbuilder-solution',
    solutionFile: '.lingbuilder/solution.json'
  }), 'utf8');
  assert.equal(await resolveWorkspaceDropTarget(entryPath), root);
  await fs.writeFile(entryPath, JSON.stringify({ schemaVersion: 1, kind: 'unknown', solutionFile: '.lingbuilder/solution.json' }), 'utf8');
  await assert.rejects(resolveWorkspaceDropTarget(entryPath), /不是有效/u);
});

test('second-instance transfer recognizes every associated workspace file argument', () => {
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\演示\\多线程全功能演示解决方案.lbsln']), 'D:\\演示\\多线程全功能演示解决方案.lbsln');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', '--workspace', 'X:\\已有', 'C:\\工作区.LBSLN']), 'C:\\工作区.LBSLN');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\工作区.lingbuilder']), 'D:\\工作区.lingbuilder');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\工作区.lbworkspace']), 'D:\\工作区.lbworkspace');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\源码.lcpp']), 'D:\\源码.lcpp');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\工程.sln']), 'D:\\工程.sln');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\工程.code-workspace']), 'D:\\工程.code-workspace');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\旧工程.e']), 'D:\\旧工程.e');
  // 模块包与源码包属于 second-instance 的其他分支，不能混进工作区切换。
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'D:\\模块.lbmod', 'D:\\源码包.lcpppkg']), undefined);
  // 只跳过 flag 本身，flag 的取值参数照常参与匹配（与 findLbmodArgument 同口径）。
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', '--workspace', 'D:\\演示\\解决方案.lbsln']), 'D:\\演示\\解决方案.lbsln');
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe', 'readme.txt']), undefined);
  assert.equal(findWorkspaceFileArgument(['LingBuilder.exe']), undefined);
  assert.ok(isWorkspaceFilePath('C:\\任何\\X.e'));
  assert.ok(!isWorkspaceFilePath('C:\\任何\\X.lcpppkg'));
});

test('new workspace windows use an isolated process with an explicit workspace argument', () => {
  const packaged = buildWorkspaceWindowLaunch({ packaged: true, executablePath: 'LingBuilder.exe', mainEntryPath: 'main.cjs', workspacePath: 'C:\\项目' });
  assert.equal(packaged.command, 'LingBuilder.exe');
  assert.deepEqual(packaged.args.slice(-3), ['--workspace', path.resolve('C:\\项目'), '--new-window']);
  const development = buildWorkspaceWindowLaunch({ packaged: false, executablePath: 'electron.exe', mainEntryPath: 'dist/main.cjs', workspacePath: 'C:\\项目' });
  assert.equal(development.args[0], path.resolve('dist/main.cjs'));
  assert.deepEqual(development.args.slice(-4), ['--workspace', path.resolve('C:\\项目'), '--new-window', '--managed-dev-server']);
});

test('workspace switching reuses the current local service instead of reloading Electron', async () => {
  const mainSource = await fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8');
  const serverSource = await fs.readFile(path.resolve(import.meta.dirname, '../server.ts'), 'utf8');
  const desktopSource = await fs.readFile(path.resolve(import.meta.dirname, '../scripts/start-electron.cjs'), 'utf8');
  assert.doesNotMatch(mainSource, /开发模式切换工作区后请重新运行 npm run dev/u);
  assert.match(mainSource, /requestRendererApi\('\/api\/workspace\/switch'/u);
  assert.doesNotMatch(mainSource, /startManagedRendererServer\(candidateWorkspace\)/u);
  assert.match(mainSource, /webContents\.send\('workspace:changed'/u);
  assert.match(serverSource, /app\.post\("\/api\/workspace\/switch"/u);
  assert.match(serverSource, /workspaceRuntimeVersion/u);
  assert.match(mainSource, /NODE_ENV: app\.isPackaged \? 'production' : 'development'/u);
  assert.match(mainSource, /process\.argv\.includes\('--managed-dev-server'\)/u);
  assert.match(desktopSource, /'run', 'build:server'/u);
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

test('双击 .lcpppkg 冷启动会记为文件关联来源，目录参数不会', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-initial-source-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const documents = path.join(root, 'Documents');

  // 双击工作区里的一个源文件：属于文件关联启动，桌面宿主据此跳过欢迎页。
  const project = path.join(root, 'project');
  await fs.mkdir(project, { recursive: true });
  const sourceFile = path.join(project, 'Main.lcpp');
  await fs.writeFile(sourceFile, '类 Main\n结束类\n', 'utf8');
  const opened = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', sourceFile],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserDataFile')
  });
  assert.equal(await opened.resolveInitialWorkspace(), project);
  assert.equal(opened.lastInitialWorkspaceSource, 'associated-file');

  // 开发态 `electron .` 传的是目录，欢迎页行为必须保持不变。
  const fromDirectory = new DesktopWorkspaceService({
    argv: ['electron.exe', project],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserDataDir')
  });
  assert.equal(await fromDirectory.resolveInitialWorkspace(), project);
  assert.equal(fromDirectory.lastInitialWorkspaceSource, 'associated-directory');

  // 普通启动（无参数）走历史记录或种子工作区，同样不跳过欢迎页。
  const plain = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe'],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserDataPlain')
  });
  await plain.resolveInitialWorkspace();
  assert.equal(plain.lastInitialWorkspaceSource, 'seed');

  // --workspace 是自动化/开发参数，不算文件关联。
  const explicit = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', project],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserDataArg')
  });
  await explicit.resolveInitialWorkspace();
  assert.equal(explicit.lastInitialWorkspaceSource, 'argument');
});

test('bundled protobuf SDK is provisioned into the workspace without clobbering user files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-protobuf-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundledSource = path.join(root, 'resources', 'default-workspace', '.lingbuilder', 'toolchains', 'protobuf');
  await fs.mkdir(path.join(bundledSource, 'bin', 'x64'), { recursive: true });
  await fs.mkdir(path.join(bundledSource, 'include', 'google', 'protobuf'), { recursive: true });
  await fs.writeFile(path.join(bundledSource, 'runtime-manifest.json'), '{"sdkVersion":"27.3.0"}', 'utf8');
  await fs.writeFile(path.join(bundledSource, 'bin', 'protoc.exe'), 'protoc', 'utf8');
  await fs.writeFile(path.join(bundledSource, 'bin', 'x64', 'libprotobuf.dll'), 'dll', 'utf8');
  await fs.writeFile(path.join(bundledSource, 'include', 'google', 'protobuf', 'descriptor.h'), 'header', 'utf8');

  const workspace = path.join(root, '现有工作区');
  await fs.mkdir(workspace, { recursive: true });
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', workspace],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData'),
    bundledProtobufSdkSource: bundledSource
  });
  await service.resolveInitialWorkspace();
  const toolchain = path.join(workspace, '.lingbuilder', 'toolchains', 'protobuf');
  assert.equal(await fs.readFile(path.join(toolchain, 'runtime-manifest.json'), 'utf8'), '{"sdkVersion":"27.3.0"}');
  assert.equal(await fs.readFile(path.join(toolchain, 'bin', 'x64', 'libprotobuf.dll'), 'utf8'), 'dll');
  assert.equal(await fs.readFile(path.join(toolchain, 'include', 'google', 'protobuf', 'descriptor.h'), 'utf8'), 'header');

  // 用户自备文件不得被覆盖；bundled 源缺失时也不抛错。
  await fs.writeFile(path.join(toolchain, 'bin', 'x64', 'libprotobuf.dll'), 'user-sdk', 'utf8');
  await fs.writeFile(path.join(bundledSource, 'bin', 'x64', 'libprotobuf.dll'), 'newer', 'utf8');
  const withoutBundled = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', workspace],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });
  await withoutBundled.resolveInitialWorkspace();
  assert.equal(await fs.readFile(path.join(toolchain, 'bin', 'x64', 'libprotobuf.dll'), 'utf8'), 'user-sdk');

  await service.rememberWorkspace(workspace);
  assert.equal(await fs.readFile(path.join(toolchain, 'bin', 'x64', 'libprotobuf.dll'), 'utf8'), 'user-sdk');
});

test('bundled default-workspace modules are provisioned into existing workspaces without clobbering', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-modules-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const defaultWorkspaceSource = path.join(root, 'resources', 'default-workspace');
  const modulesSource = path.join(defaultWorkspaceSource, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  await fs.mkdir(path.join(modulesSource, 'bin', 'x64'), { recursive: true });
  await fs.mkdir(path.join(modulesSource, 'docs'), { recursive: true });
  await fs.writeFile(path.join(modulesSource, 'lingbuilder.module.json'), '{"id":"lingbuilder.new_emoji.ui","version":"2.0.0"}', 'utf8');
  await fs.writeFile(path.join(modulesSource, 'bin', 'x64', 'new_emoji.dll'), 'dll', 'utf8');
  await fs.writeFile(path.join(modulesSource, 'docs', 'rich-list.md'), '文档', 'utf8');

  const workspace = path.join(root, '现有工作区');
  // 老工作区已有同 ID 模块的旧文件：只补缺，绝不覆盖用户已有内容。
  await fs.mkdir(path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'bin', 'x64'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'bin', 'x64', 'new_emoji.dll'), 'user-dll', 'utf8');

  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', workspace],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData'),
    defaultWorkspaceSource
  });
  await service.resolveInitialWorkspace();
  const installed = path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  assert.equal(await fs.readFile(path.join(installed, 'lingbuilder.module.json'), 'utf8'), '{"id":"lingbuilder.new_emoji.ui","version":"2.0.0"}');
  assert.equal(await fs.readFile(path.join(installed, 'bin', 'x64', 'new_emoji.dll'), 'utf8'), 'user-dll');
  assert.equal(await fs.readFile(path.join(installed, 'docs', 'rich-list.md'), 'utf8'), '文档');

  // 随包源缺失（如开发态没有 default-workspace）时不抛错、不清空工作区。
  const withoutBundled = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', workspace],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });
  await withoutBundled.resolveInitialWorkspace();
  assert.ok(await exists(path.join(installed, 'lingbuilder.module.json')));
  assert.equal(await fs.readFile(path.join(installed, 'bin', 'x64', 'new_emoji.dll'), 'utf8'), 'user-dll');
});
