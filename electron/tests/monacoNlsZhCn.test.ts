// Monaco 专业模式内置界面简体中文 NLS 的数据与注入回归测试。
// 数据由 scripts/generate-monaco-zh-cn-nls.ts 生成；升级 monaco-editor 后必须重跑
// npm run monaco:nls-zh-cn（构建门禁 verify-local-monaco-build.cjs 也会拦截版本错位）。
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ANCHOR_ENGLISH_LABELS, collectEsmMessageIndices, loadZhCnTable } from '../scripts/generate-monaco-zh-cn-nls';
import { MONACO_NLS_SOURCE_VERSION, MONACO_ZH_CN_MESSAGES } from '../src/services/monacoNls/monacoNlsZhCnMessages';
// 副作用导入：验证注入模块可独立生效（真实链路中它在 MonacoCodeEditor.tsx 首位导入）。
import '../src/services/monacoNls/monacoNlsZhCn';

const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff]/u;

function findIndicesByEnglish(english: string): number[] {
  const indices: number[] = [];
  for (const [index, label] of collectEsmMessageIndices()) {
    if (label === english) indices.push(index);
  }
  return indices;
}

test('Monaco 中文 NLS 数据版本与安装的 monaco-editor 保持一致', () => {
  const packageJsonPath = fileURLToPath(new URL('../node_modules/monaco-editor/package.json', import.meta.url));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string };
  assert.equal(MONACO_NLS_SOURCE_VERSION, packageJson.version);
});

test('注入模块已把中文 NLS 表写入全局且语言标记为 zh-cn', () => {
  assert.equal(globalThis._VSCODE_NLS_LANGUAGE, 'zh-cn');
  assert.ok(Array.isArray(globalThis._VSCODE_NLS_MESSAGES));
  assert.ok(globalThis._VSCODE_NLS_MESSAGES.length > 0);
  assert.equal(globalThis._VSCODE_NLS_MESSAGES, MONACO_ZH_CN_MESSAGES);
});

test('数据表与随包官方语言表逐条一致', () => {
  // loadZhCnTable 的数组产生自 vm 上下文（跨 realm 原型不同），先拷贝到当前 realm 再比较。
  assert.deepEqual([...MONACO_ZH_CN_MESSAGES], [...loadZhCnTable()]);
});

test('右键菜单锚点词条全部提供中文翻译', () => {
  for (const english of ANCHOR_ENGLISH_LABELS) {
    const indices = findIndicesByEnglish(english);
    assert.ok(indices.length > 0, `ESM 中未找到锚点词条：${english}`);
    for (const index of indices) {
      const translated = MONACO_ZH_CN_MESSAGES[index];
      assert.equal(typeof translated, 'string', `锚点「${english}」（索引 ${index}）为未翻译回退`);
      assert.match(translated as string, CJK_PATTERN, `锚点「${english}」（索引 ${index}）缺少中文`);
    }
  }
});

test('关键菜单文案使用官方中文翻译', () => {
  const expectations: Array<readonly [string, string]> = [
    ['Cut', '剪切'],
    ['Copy', '复制'],
    ['Paste', '粘贴'],
    ['Go to Definition', '转到定义'],
    ['Command Palette', '命令面板'],
    ['Format Document', '格式化文档'],
    ['Rename Symbol', '重命名符号']
  ];
  for (const [english, expected] of expectations) {
    const indices = findIndicesByEnglish(english);
    assert.ok(indices.length > 0, `ESM 中未找到词条：${english}`);
    for (const index of indices) {
      assert.equal(MONACO_ZH_CN_MESSAGES[index], expected, `索引 ${index}（${english}）翻译不符`);
    }
  }
});

test('未翻译词条保留 null 以便运行时回退英文，不产生空文案', () => {
  assert.ok(MONACO_ZH_CN_MESSAGES.length > 2000);
  assert.ok(MONACO_ZH_CN_MESSAGES.some(entry => entry === null), '官方表应存在未翻译回退词条');
  assert.ok(MONACO_ZH_CN_MESSAGES.every(entry => entry === null || entry.length > 0), '数据表不允许空字符串文案');
});
