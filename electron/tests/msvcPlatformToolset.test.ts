import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  detectLatestMsvcPlatformToolset,
  FALLBACK_MSVC_PLATFORM_TOOLSET,
  parseToolsetVersionNumber,
  type MsvcPlatformToolsetDetectorDependencies
} from '../src/services/windowDesigner/msvcPlatformToolset';
import { createVisualStudioProjectExportContent } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { createWindowsDllProjectFiles } from '../src/services/solution/windowsDllProjectService';

function createDetectorDependencies(options: {
  platform?: NodeJS.Platform;
  vswhereExecutable?: string | null;
  installationPath?: string;
  /** 以 Windows 路径为键的目录树；未登记的路径按不存在处理。 */
  tree?: Record<string, string[]>;
}): MsvcPlatformToolsetDetectorDependencies {
  const tree = options.tree || {};
  return {
    platform: options.platform ?? 'win32',
    environment: { 'ProgramFiles(x86)': 'C:\\Program Files (x86)' },
    vswhereExecutable: options.vswhereExecutable,
    runCommand: async (command, args) => {
      if (command.endsWith('vswhere.exe') && args.includes('-property')) {
        return options.installationPath
          ? { exitCode: 0, stdout: `${options.installationPath}\r\n` }
          : { exitCode: 1, stdout: '' };
      }
      return { exitCode: 1, stdout: '' };
    },
    fileExists: async filePath => Boolean(tree[filePath]) || filePath.endsWith('vswhere.exe'),
    directoryExists: async directoryPath => Boolean(tree[directoryPath]),
    readSubdirectoryNames: async directoryPath => {
      const names = tree[directoryPath];
      if (!names) {
        const error = new Error(`ENOENT: ${directoryPath}`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      return names;
    }
  };
}

function createVisualStudioTree(installationPath: string, tree: Record<string, string[]>): void {
  const vcRoot = `${installationPath}\\MSBuild\\Microsoft\\VC`;
  tree[vcRoot] = ['v170', 'v180'];
  for (const versionDirectory of ['v170', 'v180']) {
    tree[`${vcRoot}\\${versionDirectory}\\Platforms`] = ['Win32', 'x64'];
    for (const platformDirectory of ['Win32', 'x64']) {
      tree[`${vcRoot}\\${versionDirectory}\\Platforms\\${platformDirectory}\\PlatformToolsets`] = ['v143'];
    }
  }
}

test('探测本机最新 MSVC 平台工具集并跨 Win32/x64 求交集', async () => {
  const installationPath = 'C:\\Program Files\\Microsoft Visual Studio\\18\\Community';
  const tree: Record<string, string[]> = {};
  const vcRoot = `${installationPath}\\MSBuild\\Microsoft\\VC`;
  tree[vcRoot] = ['v170', 'v180'];
  for (const versionDirectory of ['v170', 'v180']) {
    tree[`${vcRoot}\\${versionDirectory}\\Platforms`] = ['Win32', 'x64'];
  }
  tree[`${vcRoot}\\v170\\Platforms\\Win32\\PlatformToolsets`] = ['v142', 'v143'];
  tree[`${vcRoot}\\v170\\Platforms\\x64\\PlatformToolsets`] = ['v142', 'v143'];
  tree[`${vcRoot}\\v180\\Platforms\\Win32\\PlatformToolsets`] = ['v143', 'v145'];
  tree[`${vcRoot}\\v180\\Platforms\\x64\\PlatformToolsets`] = ['v145'];

  const probe = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    installationPath,
    tree
  }));

  assert.equal(probe.toolset, 'v145');
  assert.equal(probe.source, 'detected');
  assert.equal(probe.installationPath, installationPath);
});

test('仅在 x64 存在的新工具集不会被钉入，回退到两平台共有的最新工具集', async () => {
  const installationPath = 'C:\\VS\\Community';
  const tree: Record<string, string[]> = {};
  const vcRoot = `${installationPath}\\MSBuild\\Microsoft\\VC`;
  tree[vcRoot] = ['v180'];
  tree[`${vcRoot}\\v180\\Platforms`] = ['Win32', 'x64'];
  tree[`${vcRoot}\\v180\\Platforms\\Win32\\PlatformToolsets`] = ['v143'];
  tree[`${vcRoot}\\v180\\Platforms\\x64\\PlatformToolsets`] = ['v143', 'v145'];

  const probe = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    installationPath,
    tree
  }));

  assert.equal(probe.toolset, 'v143');
  assert.equal(probe.source, 'detected');
});

test('没有 vswhere、没有 C++ 安装或没有工具集目录时回退 v143', async () => {
  const missingVswhere = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    vswhereExecutable: null,
    installationPath: 'C:\\VS'
  }));
  assert.equal(missingVswhere.toolset, FALLBACK_MSVC_PLATFORM_TOOLSET);
  assert.equal(missingVswhere.source, 'fallback');

  const noInstallation = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    vswhereExecutable: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',
    installationPath: null
  }));
  assert.equal(noInstallation.toolset, FALLBACK_MSVC_PLATFORM_TOOLSET);

  const installationPath = 'C:\\VS\\Empty';
  const emptyTree = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    installationPath,
    tree: {}
  }));
  assert.equal(emptyTree.toolset, FALLBACK_MSVC_PLATFORM_TOOLSET);
  assert.equal(emptyTree.source, 'fallback');

  const toolsetDirectoriesOnly = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    installationPath,
    tree: {
      [`${installationPath}\\MSBuild\\Microsoft\\VC`]: ['v180'],
      [`${installationPath}\\MSBuild\\Microsoft\\VC\\v180\\Platforms`]: ['Win32', 'x64']
    }
  }));
  assert.equal(toolsetDirectoriesOnly.toolset, FALLBACK_MSVC_PLATFORM_TOOLSET);
});

test('非 Windows 平台直接回退 v143', async () => {
  const probe = await detectLatestMsvcPlatformToolset(createDetectorDependencies({
    platform: 'linux',
    installationPath: 'C:\\VS'
  }));
  assert.equal(probe.toolset, FALLBACK_MSVC_PLATFORM_TOOLSET);
  assert.equal(probe.source, 'fallback');
});

test('parseToolsetVersionNumber 只接受 v+数字 形式', () => {
  assert.equal(parseToolsetVersionNumber('v145'), 145);
  assert.equal(parseToolsetVersionNumber('v143'), 143);
  assert.equal(parseToolsetVersionNumber('llvm'), null);
  assert.equal(parseToolsetVersionNumber('v145xp'), null);
});

function extractVcxprojContent(options: {
  platformToolset?: string;
  contentFiles?: string[];
}): string {
  const content = createVisualStudioProjectExportContent({
    projectDir: '.',
    projectId: 'toolset-demo',
    generatedFiles: [],
    enabledModules: [],
    ...(options.contentFiles ? { contentFiles: options.contentFiles } : {}),
    ...(options.platformToolset ? { platformToolset: options.platformToolset } : {})
  });
  return content.files.find(file => file.relativePath.endsWith('.vcxproj'))?.content || '';
}

function decodeVcxprojEntities(value: string): string {
  return value
    .replace(/&#xD;/gu, '\r')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

test('导出内容把显式工具集钉入全部四个配置', () => {
  const vcxproj = extractVcxprojContent({ platformToolset: 'v145' });
  const toolsets = [...vcxproj.matchAll(/<PlatformToolset>([^<]+)<\/PlatformToolset>/gu)].map(match => match[1]);
  assert.deepEqual(toolsets, ['v145', 'v145', 'v145', 'v145']);
  assert.ok(!vcxproj.includes('v143'));
});

test('未指定工具集时保持 v143 兼容行为', () => {
  const vcxproj = extractVcxprojContent({});
  const toolsets = [...vcxproj.matchAll(/<PlatformToolset>([^<]+)<\/PlatformToolset>/gu)].map(match => match[1]);
  assert.deepEqual(toolsets, ['v143', 'v143', 'v143', 'v143']);
});

test('后置复制命令以 &#xD; 字符引用换行并先兜底创建 OutDir', () => {
  const vcxproj = extractVcxprojContent({ platformToolset: 'v145', contentFiles: ['resources/lingbuilder-app.ico'] });
  const commandMatch = vcxproj.match(/<Command>([\s\S]*?)<\/Command>/u);
  assert.ok(commandMatch, 'vcxproj 应包含 PostBuildEvent Command');

  const rawCommand = commandMatch[1]!;
  assert.ok(rawCommand.includes('&#xD;'), '命令换行的 CR 必须写成 &#xD; 字符引用，避免 XML 把 CRLF 规范化为 LF');
  assert.ok(!/\r/.test(rawCommand.replace(/&#xD;/gu, '')), '除 &#xD; 引用外不应残留字面 CR（LF 保留字面是 VS 自身的保存行为）');

  const decoded = decodeVcxprojEntities(rawCommand);
  const lines = decoded.split('\r\n');
  assert.equal(lines[0], 'if not exist "$(OutDir)" mkdir "$(OutDir)"');
  assert.deepEqual(lines.slice(1), [
    'if not exist "$(OutDir)resources" mkdir "$(OutDir)resources"',
    'if exist "$(ProjectDir)resources\\lingbuilder-app.ico" copy /Y "$(ProjectDir)resources\\lingbuilder-app.ico" "$(OutDir)resources\\lingbuilder-app.ico"'
  ]);
});

test('exportVisualStudioProject 尊重显式工具集并写盘', async () => {
  const { exportVisualStudioProject } = await import('../src/services/windowDesigner/visualStudioProjectExporter');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-toolset-'));
  try {
    const result = await exportVisualStudioProject({
      projectDir,
      projectId: 'toolset-demo',
      generatedFiles: [],
      enabledModules: [],
      platformToolset: 'v145'
    });
    const vcxproj = await fs.readFile(result.projectPath, 'utf8');
    const toolsets = [...vcxproj.matchAll(/<PlatformToolset>([^<]+)<\/PlatformToolset>/gu)].map(match => match[1]);
    assert.deepEqual(toolsets, ['v145', 'v145', 'v145', 'v145']);
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
});

test('windows-dll 模板透传平台工具集', () => {
  const files = createWindowsDllProjectFiles('dll-demo', 'DLL 演示', { platformToolset: 'v145' });
  const vcxproj = files.find(file => file.relativePath.endsWith('.vcxproj'));
  assert.ok(vcxproj);
  const toolsets = [...vcxproj.content.matchAll(/<PlatformToolset>([^<]+)<\/PlatformToolset>/gu)].map(match => match[1]);
  assert.deepEqual(toolsets, ['v145', 'v145', 'v145', 'v145']);
});
