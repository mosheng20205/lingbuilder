import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * 2026-10-27 用户报告：新手模式展开层（＋号参数层）的引号中间无法输入中文，
 * 部分场景英文也无法输入。CDP 真机插桩实锤根因：
 * 受控 input 的 value 来自 beginnerCommandArgumentDrafts，但块级记忆化外壳
 * （CanvasItemSurface）的指纹只含草稿「键」（blockRevision 的 keys join）不含值；
 * 第二次击键起指纹不变 → 块跳过重渲 → input fiber 持旧 props → React 在 input
 * 事件后按旧值回写 DOM，输入被吞（中文输入法组合态同样被掐断）。
 * 修复契约：interactionSliceFor 必须把当前 targetKey 的参数草稿完整值带进所属块切片，
 * 让每次击键只重渲正在编辑的块；input 本体保持受控 + onInput 写回草稿形态。
 */
test('展开层参数输入框：参数草稿值进所属块交互切片（受控输入不被记忆化外壳吞字）', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/DiffViewer.tsx'), 'utf8');

  // 修复本体：interactionSliceFor 里按 targetKey 过滤参数草稿并携带完整值（|g: 切片）。
  assert.match(source, /const commandArgumentDrafts = Object\.entries\(beginnerCommandArgumentDrafts\)/u);
  assert.match(source, /draftKey\.startsWith\(`\$\{targetKey\}:`\)/u);
  assert.match(source, /\|g:\$\{commandArgumentDrafts\}/u);

  // input 本体必须保持受控形态：value 读草稿、onInput 写回草稿，不得退回 defaultValue。
  assert.match(source, /value=\{beginnerCommandArgumentDrafts\[draftKey\]/u);
  assert.match(source, /setBeginnerCommandArgumentDrafts\(current => \(\{ \.\.\.current, \[draftKey\]: value \}\)\)/u);
  assert.doesNotMatch(source, /data-beginner-command-argument=\{argumentIndex\}[\s\S]{0,400}defaultValue=/u);
});
