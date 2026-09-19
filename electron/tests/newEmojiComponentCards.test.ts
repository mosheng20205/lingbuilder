import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const fsMkdtemp = (prefix: string) => fsp.mkdtemp(path.join(os.tmpdir(), prefix));
const fsRm = (target: string, options: { recursive: boolean; force: boolean }) => fsp.rm(target, options);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const MODULE_ID = 'lingbuilder.new_emoji.ui';
const moduleRoot = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
const manifestPath = path.join(moduleRoot, 'lingbuilder.module.json');
const cardRoot = path.join(moduleRoot, 'docs', 'lingbuilder-components');
const overlayRoot = path.join(repoRoot, 'electron', 'docs', 'modules', 'new-emoji', 'component-cards');
const MIN_HUMAN_NOTES = 20;

interface ManifestLike {
  id: string;
  contributes?: {
    commands?: Array<{ name: string }>;
    designerControls?: Array<{
      type: string;
      label: string;
      runtimeControl?: { lingCppType?: string; createCommand?: string };
    }>;
  };
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const installed = fs.existsSync(manifestPath) && fs.existsSync(cardRoot);

test('new_emoji 组件卡覆盖清单全部控件且带可核对的创建契约', { skip: !installed }, () => {
  const manifest = readJson(manifestPath) as ManifestLike;
  const controls = manifest.contributes?.designerControls || [];
  const index = readJson(path.join(cardRoot, 'index.json')) as {
    controls: Array<{ type: string; documentation: string; nativeDocumentation: string; hasHumanNotes: boolean }>;
  };
  assert.equal(controls.length >= 90, true, '控件数量不应低于清单条目');
  assert.equal(index.controls.length, controls.length, '组件卡数量必须与清单控件一一对应');

  let withHumanNotes = 0;
  for (const entry of index.controls) {
    const control = controls.find(item => item.type === entry.type);
    assert.ok(control, `组件卡索引出现清单外的控件：${entry.type}`);
    const cardPath = path.join(moduleRoot, 'docs', ...entry.documentation.split('/'));
    assert.ok(fs.existsSync(cardPath), `缺少组件卡：${entry.documentation}`);
    const card = fs.readFileSync(cardPath, 'utf8');
    assert.ok(card.includes(`# ${control!.label}`), `${entry.documentation} 标题与清单 label 不一致`);
    if (control!.runtimeControl?.createCommand) {
      assert.ok(card.includes(control!.runtimeControl.createCommand), `${entry.documentation} 未写代码创建命令`);
    }
    if (control!.runtimeControl?.lingCppType) {
      assert.ok(card.includes(control!.runtimeControl.lingCppType), `${entry.documentation} 未写中文控件类型`);
    }
    assert.match(card, /## 惯用要点与红线/u, `${entry.documentation} 缺少红线段落`);
    if (entry.hasHumanNotes) {
      withHumanNotes += 1;
      assert.ok(!card.includes('待补'), `${entry.documentation} 标记已覆盖却仍含待补占位`);
    }
  }
  assert.ok(withHumanNotes >= MIN_HUMAN_NOTES, `人工红线卡不足：${withHumanNotes}/${MIN_HUMAN_NOTES}`);
});

test('new_emoji 设计器目录声明的组件文档不得悬空', { skip: !installed }, () => {
  const catalogPath = path.join(moduleRoot, 'docs', 'lingbuilder-designer-catalog.json');
  if (!fs.existsSync(catalogPath)) return;
  const catalog = readJson(catalogPath) as { components?: Array<{ id?: string; documentation?: string }> };
  const dangling = (catalog.components || []).filter(component => !component.documentation
    || !fs.existsSync(path.join(moduleRoot, ...component.documentation.replace(/\\/gu, '/').split('/'))))
    .map(component => `${component.id} -> ${component.documentation || '(未声明)'}`);
  assert.deepEqual(dangling, [], '设计器目录里的 documentation 引用必须有真实文件随包分发');
});

test('new_emoji 组件卡红线段引用的命令必须真实存在于模块清单', { skip: !installed }, () => {
  const manifest = readJson(manifestPath) as ManifestLike;
  const known = new Set((manifest.contributes?.commands || []).map(command => command.name));
  const pattern = /[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*_[A-Za-z0-9_\u4e00-\u9fff]+(?=\s*\()/gu;
  const unknown: string[] = [];
  for (const file of fs.readdirSync(overlayRoot).filter(name => name.endsWith('.md'))) {
    const text = stripFenceComments(fs.readFileSync(path.join(overlayRoot, file), 'utf8'));
    for (const token of new Set(text.match(pattern) || [])) {
      if (!known.has(token)) unknown.push(`${file}: ${token}`);
    }
  }
  assert.deepEqual(unknown, [], '红线段不得引用模块清单里不存在的命令');
});

/** 反向引导句里的假设命令名不是声明，剔除后再比对。 */
function stripFenceComments(text: string): string {
  return text.split(/\r?\n/u).filter(line => !line.includes('不要猜') && !line.includes('别按')).join('\n');
}

/**
 * 组件卡随模块包发布走的是「以 --module-root 指向待打包目录再生成一次」这条路径
 * （generate-new-emoji-module.cjs 里调用），这里用临时目录复现，并顺带验幂等。
 */
test('new_emoji 组件卡可对独立模块根重新生成且字节稳定', { skip: !installed }, async () => {
  const staging = await fsMkdtemp('lb-ne-cards-');
  try {
    fs.copyFileSync(manifestPath, path.join(staging, 'lingbuilder.module.json'));
    fs.mkdirSync(path.join(staging, 'docs'), { recursive: true });
    fs.copyFileSync(path.join(moduleRoot, 'docs', 'lingbuilder-designer-catalog.json'),
      path.join(staging, 'docs', 'lingbuilder-designer-catalog.json'));
    const script = path.join(repoRoot, 'electron', 'scripts', 'generate-new-emoji-component-cards.ts');
    const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const run = () => execFileAsync(process.execPath, [tsxCli, script, '--module-root', staging], {
      cwd: path.join(repoRoot, 'electron'),
      maxBuffer: 32 * 1024 * 1024
    });
    await run();
    const first = snapshotCards(staging);
    await run();
    const second = snapshotCards(staging);
    const controlCount = (readJson(manifestPath) as ManifestLike).contributes?.designerControls?.length || 0;
    assert.ok(controlCount >= 90);
    assert.equal(Object.keys(first).length, controlCount + 2, '每张控件卡 + index.json + README 索引');
    assert.deepEqual(Object.keys(second), Object.keys(first), '二次生成文件集合不应变化');
    for (const [file, hash] of Object.entries(first)) {
      assert.equal(second[file], hash, `${file} 二次生成内容漂移，生成器不幂等`);
    }
  } finally {
    await fsRm(staging, { recursive: true, force: true });
  }
});

function snapshotCards(root: string): Record<string, string> {
  const dir = path.join(root, 'docs', 'lingbuilder-components');
  const snapshot: Record<string, string> = {};
  for (const file of fs.readdirSync(dir)) {
    snapshot[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex');
  }
  return snapshot;
}
