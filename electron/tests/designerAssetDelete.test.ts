import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DesignerAssetService, findDesignerImageReferences } from '../src/services/windowDesigner/designerAssetService';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import type { TextFileSnapshot } from '../src/services/files/types';

const snapshot = (content: string): TextFileSnapshot => ({
  content,
  format: { encoding: 'utf8', eol: 'lf' },
  detectedEol: 'lf',
  hasFinalNewline: true
});

const projectFixture = (overrides: Partial<LingBuilderSolutionProject> = {}): LingBuilderSolutionProject => ({
  id: 'demo',
  name: '演示项目',
  type: 'visual-cpp',
  sourceRoot: 'src',
  configRoot: 'config',
  designerPath: '.lingbuilder/window-designer.json',
  isDefault: true,
  ...overrides
});

const designerFixture = (): LingWindowProject => ({
  schemaVersion: 2,
  id: 'demo',
  name: '演示项目',
  windows: [{
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: 'MainWindow',
    title: '主窗口',
    width: 480,
    height: 320,
    background: '#202028',
    description: '演示',
    iconPath: 'assets/demo/logo.png',
    controls: [
      {
        id: 'c1',
        type: 'Image',
        name: '图片框1',
        content: '',
        width: 64,
        height: 64,
        x: 8,
        y: 8,
        fontSize: 12,
        background: '#FFFFFF',
        foreground: '#000000',
        isEnabled: true,
        visibility: 'Visible',
        properties: { image: 'assets/demo/pic.png' }
      },
      {
        id: 'c2',
        type: 'Button',
        name: '按钮1',
        content: '确定',
        width: 72,
        height: 28,
        x: 8,
        y: 80,
        fontSize: 12,
        background: '#FFFFFF',
        foreground: '#000000',
        isEnabled: true,
        visibility: 'Visible'
      }
    ]
  }]
});

test('删除图片资源：可删除项目 assets 内文件，缺失与越界路径给中文诊断', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-asset-delete-'));
  try {
    const service = new DesignerAssetService(workspaceRoot);
    const project = projectFixture();
    const imagePath = path.join(workspaceRoot, 'assets', 'demo', 'logo.png');
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.writeFile(imagePath, 'png-bytes');

    await service.deleteProjectImage(project, 'assets/demo/logo.png');
    await assert.rejects(fs.access(imagePath));

    // 文件已删：给中文诊断而不是裸 ENOENT。
    await assert.rejects(
      service.deleteProjectImage(project, 'assets/demo/logo.png'),
      /图片资源不存在或已被删除。/u
    );
    // assets 目录之外的文件不能经此入口删除。
    await assert.rejects(
      service.deleteProjectImage(project, 'src/Main.lcpp'),
      /图片路径不属于当前项目 assets 目录。/u
    );
    // 非默认项目只能删自己 assets/<项目id>/ 作用域内的文件。
    const named = projectFixture({ id: 'game', isDefault: false });
    await assert.rejects(
      service.deleteProjectImage(named, 'assets/demo/logo.png'),
      /图片路径不属于当前项目 assets 目录。/u
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('引用扫描：设计器图标、控件属性与源码行都能命中，大小写与斜杠方向不敏感', () => {
  const designer = designerFixture();

  const picScan = findDesignerImageReferences({
    designerProject: designer,
    sourceFiles: {
      'src/Main.lcpp': snapshot([
        '类 主窗口',
        '事件 按钮1_被单击',
        '    图片框1.加载图片("assets/demo/pic.png")',
        '    信息框("无关文本", 0, 0)',
        '结束'
      ].join('\n'))
    },
    relativePath: 'assets/demo/pic.png'
  });
  assert.ok(picScan.hits.some(hit => hit.source === 'designer' && hit.location.includes('图片框1') && hit.detail.includes('image')),
    '控件属性引用必须命中并标出属性名');
  assert.ok(!picScan.hits.some(hit => hit.location.includes('按钮1')), '无关控件不得误报');
  assert.ok(!picScan.hits.some(hit => hit.source === 'designer' && hit.location.includes('图标')), '窗口图标未引用该图时不得误报');
  assert.ok(picScan.hits.some(hit => hit.source === 'source' && hit.location === 'src/Main.lcpp:3'),
    '源码命中必须带行号');
  assert.ok(!picScan.hits.some(hit => hit.source === 'source' && hit.detail.includes('无关文本')), '无关源码行不得误报');

  const logoScan = findDesignerImageReferences({
    designerProject: designer,
    sourceFiles: {
      'src/Other.lcpp': snapshot('标签1.设置图片("ASSETS\\DEMO\\LOGO.PNG")')
    },
    relativePath: 'assets/demo/logo.png'
  });
  assert.ok(logoScan.hits.some(hit => hit.source === 'designer' && hit.location.includes('图标') && hit.detail === 'assets/demo/logo.png'),
    '窗口图标引用必须命中');
  assert.ok(logoScan.hits.some(hit => hit.source === 'source' && hit.location === 'src/Other.lcpp:1'),
    '大小写与反斜杠写法也必须命中');
});

test('引用扫描：无引用时返回空清单', () => {
  const scan = findDesignerImageReferences({
    designerProject: designerFixture(),
    sourceFiles: { 'src/Main.lcpp': snapshot('信息框("你好", 0, 0)') },
    relativePath: 'assets/demo/missing.png'
  });
  assert.deepEqual(scan, { hits: [], truncated: 0 });
});

test('引用扫描：超过 50 条时截断并给出剩余计数', () => {
  const lines = Array.from({ length: 60 }, (_, index) => `图片框${index}.加载图片("assets/demo/pic.png")`);
  const scan = findDesignerImageReferences({
    sourceFiles: { 'src/Many.lcpp': snapshot(lines.join('\n')) },
    relativePath: 'assets/demo/pic.png'
  });
  assert.equal(scan.hits.length, 50);
  assert.equal(scan.truncated, 10);
});
