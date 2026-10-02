/**
 * 阶段A 迁移工具：把 generateMainCpp 里的单个巨型模板字符串
 * 切分为有序的段常量（rtSeg*），拼接结果与原模板逐字节一致。
 *
 * - 用状态机扫描模板内的 ${...} 插值跨度，切点落在插值内直接报错拒绝。
 * - 切点按模板内容行号（绝对行号）指定，并对每处做内容断言防错位。
 * - 幂等性：再次运行会因找不到原始单模板而退出（改造后不可重跑）；
 *   阶段B 需要更细分段时，请在本脚本基础上按新基线调整切点表。
 *
 * 运行：cd electron && node scripts/split-runtime-template.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts');
const MARKER = 'const generatedSource = `';

const src = fs.readFileSync(FILE, 'utf8');
if (!src.includes(MARKER)) {
  console.error('未找到单模板 generatedSource —— 可能已切分过，拒绝执行。');
  process.exit(1);
}

const markerIdx = src.indexOf(MARKER);
const contentStart = markerIdx + MARKER.length;

// —— 状态机：扫描模板内容，找出所有 ${...} 插值跨度（相对 contentStart 的偏移）——
const spans = [];
let scanEnd = -1;
{
  // 栈帧：{type:'tpl'|'interp'|'str', ...}
  const stack = [{ type: 'tpl', nested: false }];
  let spanStart = -1;
  let i = contentStart;
  while (i < src.length) {
    const c = src[i];
    const top = stack[stack.length - 1];
    if (c === '\\') { i += 2; continue; }
    if (top.type === 'str') {
      if (c === top.quote) stack.pop();
      i += 1;
      continue;
    }
    if (top.type === 'interp') {
      if (c === '{') { top.braces += 1; i += 1; continue; }
      if (c === '}') {
        top.braces -= 1;
        if (top.braces === 0) {
          if (spanStart >= 0) { spans.push([spanStart, i + 1]); spanStart = -1; }
          stack.pop();
        }
        i += 1;
        continue;
      }
      if (c === '\'' || c === '"') { stack.push({ type: 'str', quote: c }); i += 1; continue; }
      if (c === '`') { stack.push({ type: 'tpl', nested: true }); i += 1; continue; }
      i += 1;
      continue;
    }
    // top.type === 'tpl'
    if (c === '`') {
      if (top.nested) { stack.pop(); i += 1; continue; }
      break; // 主模板闭合
    }
    if (c === '$' && src[i + 1] === '{') {
      stack.push({ type: 'interp', braces: 1 });
      if (spanStart < 0) spanStart = i;
      i += 2;
      continue;
    }
    i += 1;
  }
  if (stack.length !== 1 || stack[0].nested) {
    console.error('模板扫描未正常闭合，状态栈异常：', JSON.stringify(stack));
    process.exit(1);
  }
  scanEnd = i;
}
const templateEnd = scanEnd; // 闭合反引号位置

const templateRaw = src.slice(contentStart, templateEnd);
const tLines = templateRaw.split('\n');
// 模板第一行内容在绝对行 START_ABS 上（与 "const generatedSource = `" 同行）。
const START_ABS = src.slice(0, contentStart).split('\n').length;

// —— 切点表：绝对行号 → 段名，含内容断言 ——
const CUTS = [
  { line: 10966, name: 'rtSegFinallyGuard', expect: 'class LingFinallyGuard {' },
  { line: 11016, name: 'rtSegPrinter', expect: '// ===== 打印机信息命令（winspool） =====' },
  { line: 11166, name: 'rtSegCoreStructs', expect: 'struct ControlSpec {' },
  { line: 11417, name: 'rtSegVideoCallback', expect: 'class LingVideoPlayerCallback final : public IMFPMediaPlayerCallback {' },
  { line: 11454, name: 'rtSegRuntimeControl', expect: 'struct RuntimeControl {' },
  { line: 11508, name: 'rtSegInfraMisc', expect: 'struct ModernColorPickerState {' },
  { line: 11838, name: 'rtSegForwardAndProjectData', expect: 'class LingWindowBase;' },
  { line: 12522, name: 'rtSegRichEditAndMisc', expect: 'struct RichEditStreamState {' },
  { line: 12648, name: 'rtSegWindowBase', expect: 'class LingWindowBase {' },
  { line: 29498, name: 'rtSegCefClient', expect: 'class LingCefClient final : public CefClient,' },
  { line: 29932, name: 'rtSegUserClasses', expect: '${classDefinitions}' },
  { line: 29933, name: 'rtSegFactoryAndEntry', expect: '${pureLogicDll ? \'#ifndef LINGBUILDER_PURE_LOGIC_DLL\' : \'\'}' }
];
const HEAD_NAME = 'rtSegHead';

// 校验切点：行内容断言 + 不落在插值跨度内 + 前一行不以反斜杠续行
function lineStartOffset(absLine) {
  // 模板内容第 k 行（k 从 1 起）= 绝对行 START_ABS + k - 1
  const rel = absLine - START_ABS;
  if (rel < 0 || rel > tLines.length) throw new Error(`切点 ${absLine} 超出模板范围`);
  let off = 0;
  for (let k = 0; k < rel; k++) off += tLines[k].length + 1;
  return off;
}
for (const cut of CUTS) {
  const rel = cut.line - START_ABS;
  const actual = tLines[rel];
  if (!actual || !actual.startsWith(cut.expect)) {
    throw new Error(`切点 ${cut.line} 内容断言失败：期望以「${cut.expect}」开头，实际「${actual}」`);
  }
  const off = lineStartOffset(cut.line);
  for (const [s, e] of spans) {
    if (off > s && off < e) throw new Error(`切点 ${cut.line} 落在插值跨度 [${s},${e}) 内`);
  }
  if (src[contentStart + off - 2] === '\\') {
    throw new Error(`切点 ${cut.line} 的上一行以反斜杠续行，禁止切分`);
  }
}

// —— 组段 ——
const boundaries = [
  { line: START_ABS, name: HEAD_NAME, expect: null },
  ...CUTS.map(c => ({ line: c.line, name: c.name }))
];
const segments = [];
for (let k = 0; k < boundaries.length; k++) {
  const fromRel = boundaries[k].line - START_ABS;
  const toRel = k + 1 < boundaries.length ? boundaries[k + 1].line - START_ABS : tLines.length;
  const body = tLines.slice(fromRel, toRel).join('\n');
  const isLast = k + 1 === boundaries.length;
  segments.push({ name: boundaries[k].name, body: isLast ? body : body + '\n', lines: toRel - fromRel });
}

// —— 生成新源码 ——
// out = 模板声明之前的内容（保留原缩进） + 各段声明 + 拼接声明 + 闭合反引号后的原文
const declIndent = '  ';
let out = src.slice(0, markerIdx);
for (const seg of segments) {
  out += `${declIndent}const ${seg.name} = \`${seg.body}\`;\n`;
}
out += `${declIndent}const generatedSource = ${segments.map(s => s.name).join('\n    + ')};`;
out += src.slice(templateEnd + 1);

fs.writeFileSync(FILE, out, 'utf8');

console.log(`模板 ${tLines.length} 行切分为 ${segments.length} 段：`);
for (const seg of segments) {
  console.log(`  ${seg.name.padEnd(32)} ${String(seg.lines).padStart(6)} 行`);
}
