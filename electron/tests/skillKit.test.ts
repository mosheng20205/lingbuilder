import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createManagedBlock } from '../electron/codexDesktopIntegrationService';

const electronRoot = path.resolve(import.meta.dirname, '..');
const skillKitRoot = path.join(electronRoot, 'skill-kit');
// 与 createManagedBlock 的入参对齐用的假安装目录；SKILL.md 里用 <IDE> 占位。
const FAKE_INSTALL = 'C:\\LingBuilder';

interface SkillKitManifest {
  schemaVersion: number;
  id: string;
  version: string;
  sequence: number;
  entrypoint: string;
  installPromptTemplate: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
}

async function readSkillFile(relative: string): Promise<Buffer> {
  return fs.readFile(path.join(skillKitRoot, relative));
}

test('skill-kit 清单与磁盘内容一致，内容变更必须显式推进 sequence', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(skillKitRoot, 'manifest.json'), 'utf8')) as SkillKitManifest;
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'lingbuilder.skill-kit');
  assert.ok(/^\d+\.\d+\.\d+$/u.test(manifest.version), 'version 必须是语义版本');
  assert.ok(Number.isInteger(manifest.sequence) && manifest.sequence >= 1, 'sequence 必须是从 1 起的整数（防回滚基准）');
  assert.ok(manifest.installPromptTemplate.includes('{skillPath}'), '复制指令模板必须预留绝对路径占位');

  const onDisk = (await fs.readdir(skillKitRoot, { recursive: true }))
    .filter(entry => typeof entry === 'string' && entry.includes('.') && !entry.startsWith(`${path.sep}`))
    .map(entry => entry.split(path.sep).join('/'))
    .filter(entry => entry !== 'manifest.json')
    .sort();
  assert.deepEqual(onDisk, [...manifest.files.map(file => file.path)].sort(), 'manifest.files 必须与磁盘文件一一对应');

  for (const file of manifest.files) {
    const content = await readSkillFile(file.path);
    assert.equal(content.length, file.bytes, `${file.path} 字节数与清单不一致`);
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'), file.sha256, `${file.path} 内容与清单不一致：改正文必须同步 sequence 与 sha256`);
  }
});

test('SKILL.md 的托管配置块与 createManagedBlock 逐要素同形', async () => {
  const markdown = (await readSkillFile('SKILL.md')).toString('utf8');
  const block = markdown.split('# lingbuilder:managed-block:begin')[1]?.split('# lingbuilder:managed-block:end')[0];
  assert.ok(block, 'SKILL.md 必须用 begin/end 标记留出可机读的托管块模板');

  // 模板里的 <IDE> 与转义层级由用户/AI 按本机替换，门禁比的是语义：同一批键、同样的参数顺序与取值。
  const canon = (value: string) => value.replaceAll('<IDE>', FAKE_INSTALL).replaceAll('\\\\', '/').replaceAll('\\', '/').trim();
  const parseArgs = (line: string) => JSON.parse(line.slice(line.indexOf('['), line.lastIndexOf(']') + 1)) as string[];
  const docLines = block.split(/\r?\n/u).map(canon).filter(line => line.length > 0);
  const productLines = createManagedBlock({
    runtimeExecutable: path.join(FAKE_INSTALL, 'LingBuilder.exe'),
    cliEntryPath: path.join(FAKE_INSTALL, 'resources', 'app.asar', 'dist', 'cli.cjs'),
    permission: 'preview'
  }).split(/\r?\n/u).map(canon).filter(line => line.length > 0 && !line.startsWith('#'));

  for (const expected of productLines) {
    if (expected.startsWith('args =')) {
      const docArg = docLines.find(line => line.startsWith('args ='));
      assert.ok(docArg, '模板缺少 args 行');
      assert.deepEqual(parseArgs(docArg).map(canon), parseArgs(expected).map(canon), 'args 参数集合与顺序必须和产品生成器完全一致');
      continue;
    }
    assert.ok(docLines.includes(expected), `模板缺少与产品一致的要素行：${expected}`);
  }
  assert.match(markdown, /禁止指向 `lingbuilder\.cmd`/u, '必须明文禁止宿主指向启动器脚本');
  assert.equal(/LINGBUILDER_AI_BRIDGE_TOKEN/u.test(markdown), false, 'stdio 模式不得要求或写入 HTTP Token');
});

test('SKILL.md 覆盖接入验收与 .lcpp 红线关键事实', async () => {
  const markdown = (await readSkillFile('SKILL.md')).toString('utf8');
  const required = [
    'resources\\app.asar\\dist\\cli.cjs',
    'ELECTRON_RUN_AS_NODE',
    '--mcp',
    '--stdio-only',
    '23 个',
    'updatedDesignerProject',
    '裸控件名',
    '&处理器名',
    '#常量名',
    'lingcpp-designer-controls-empty',
    'run.wait',
    'approved=true',
    '允许外部 AI 客户端使用本机授权'
  ];
  for (const fact of required) assert.ok(markdown.includes(fact), `SKILL.md 缺少关键事实：${fact}`);
  // 只写源码不产生界面是外部 AI 最常见的假成功，必须显式点破。
  assert.match(markdown, /只写 `\.lcpp` 不会产生界面/u);
});

test('skill-kit 已登记进安装包 extraResources，防止随包漏打', async () => {
  const config = JSON.parse(await fs.readFile(path.join(electronRoot, 'package.json'), 'utf8')) as {
    build: { extraResources: Array<{ from: string; to: string }> };
  };
  const entry = config.build.extraResources.find(item => item.from === 'skill-kit');
  assert.ok(entry, 'build.extraResources 必须包含 skill-kit → skill-kit');
  assert.equal(entry.to, 'skill-kit');
});
