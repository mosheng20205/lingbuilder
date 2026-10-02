/**
 * 阶段B2 迁移工具：把 rtSegWindowBase（窗口基座类）按「族」切成带标签的片段数组，
 * 使 EdgeView / FBro / CEF3 三个浏览器族的代码块可按模块启用情况整体裁剪。
 *
 * - 片段 = { family: 'core'|'edgeview'|'fbro'|'cef3', text }；核心片段恒保留，
 *   浏览器片段仅在对应模块启用时拼入（类内浏览器方法自带 #if 宏 stub 回退，
 *   裁剪仅移除「模块未启用时必然走不到」的文本）。
 * - OnWindowCreated 一行与两处 else-if 浏览器分支做行内切分，保证任意裁剪组合下语法完整。
 * - 脚本自校验：全部片段按序拼接必须与原段逐字节一致，否则拒绝写盘。
 *
 * 运行：cd electron && node scripts/split-runtime-windowbase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts');
const DECL_MARKER = 'const rtSegWindowBase = `';

const src = fs.readFileSync(FILE, 'utf8');
const declIdx = src.indexOf(DECL_MARKER);
if (declIdx < 0) throw new Error('未找到 rtSegWindowBase 段声明（可能已切分过）');
const declLineStart = src.lastIndexOf('\n', declIdx) + 1;
const contentStart = declIdx + DECL_MARKER.length;

// —— 扫描段字面量闭合位置（栈式状态机：${} 嵌套、嵌套模板、字符串，插值内 C++ 的 `}` 不干扰）——
let i = -1;
{
  const stack = [{ type: 'tpl', nested: false }];
  i = contentStart;
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
        if (top.braces === 0) stack.pop();
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
      i += 2;
      continue;
    }
    i += 1;
  }
  if (!(stack.length === 1 && !stack[0].nested)) throw new Error('模板扫描未正常闭合');
}
const templateEnd = i;
const body = src.slice(contentStart, templateEnd);
const bodyLines = body.split('\n');
const BASE = src.slice(0, contentStart).split('\n').length; // 声明行 = 片段第 1 行的绝对行号

function line(at) {
  const l = bodyLines[at - BASE];
  if (l === undefined) throw new Error(`行 ${at} 超出片段范围`);
  return l;
}
function expect(at, prefix, label) {
  const l = line(at);
  if (!l.startsWith(prefix)) {
    throw new Error(`切点 ${label || at}（行 ${at}）断言失败：期望以「${prefix}」开头，实际「${l}」`);
  }
}
// matcher 收到 (content, absoluteLine)
function findLine(from, to, matcher, label) {
  for (let at = from; at <= to; at++) {
    if (matcher(line(at), at)) return at;
  }
  throw new Error(`在 ${from}-${to} 内找不到切点：${label}`);
}

// —— 切点定位与断言 ——
expect(12753, '        EdgeView_关闭();', '析构EV');
expect(12754, '        FBro_关闭全部();', '析构FB');
expect(12815, '            EdgeView_关闭设计器控件();', 'DPI EV');
expect(13216, '    virtual void OnWindowCreated() { EdgeView_创建控件(nullptr); CEF3_创建(nullptr);', 'OnWindowCreated');
expect(13518, '    int EdgeView_创建(long long parentHandle, const wchar_t* address) {', 'EV块首');
expect(14774, '${fbroBrowserManagerRuntime.methods}', 'FB块首');
// EV 块以「// 旧单实例…」注释 + #if 0 开场（死代码守卫），必须整体进 EV 片段保持 #if/#endif 配平。
const evBlockStart = findLine(13510, 13518, l => l.includes('旧单实例实现保留在生成模板中'), 'EV块首注释');
expect(evBlockStart + 1, '#if 0', 'EV块首死代码守卫');
const fbBlockStart = 14774;
const cefBlockStart = findLine(16755, 16770, l => l.includes('================= CEF3 浏览器模块运行时'), 'CEF块首注释');
expect(cefBlockStart + 1, '#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE', 'CEF块首整体守卫');
const xhsLine = findLine(22975, 23005, l => l.includes('选择系统项目'), 'core2恢复(选择系统项目)');
const cefBlockEnd = findLine(Math.max(xhsLine - 4, cefBlockStart), xhsLine - 1, l => l.trim() === '#endif', 'CEF块尾整体守卫收口');
expect(cefBlockEnd, '#endif', 'CEF块尾#endif');

const fbResize1 = findLine(24728, 24745, l => l.includes('FBro_调整全部大小'), 'resize FB');
const cefResize1 = fbResize1 + 1;
expect(cefResize1, '', 'noop');
const evResizeGuardStart = findLine(fbResize1, fbResize1 + 6, l => l.trim() === '#if LINGBUILDER_EDGEVIEW_AVAILABLE', 'resize EV guard');
const evResizeGuardEnd = findLine(evResizeGuardStart, evResizeGuardStart + 4, l => l.trim() === '#endif', 'resize EV endif');

const cefBranchOpen = findLine(28690, 28712, l => l.trim().startsWith('} else if (IsType(control, L"CefBrowser"))'), 'CEF else-if');
const fbBranchOpen = findLine(cefBranchOpen + 1, cefBranchOpen + 40, l => l.trim().startsWith('} else if (IsType(control, L"FBroBrowser"))'), 'FB else-if');
const fbBranchClose = findLine(fbBranchOpen + 1, fbBranchOpen + 45, (l, at) => l === '        }' && at > fbBranchOpen + 3, 'FB else-if 收尾');
const cefCaseOpen = findLine(28950, 28975, l => l.includes('case WM_LINGBUILDER_CEF_EVENT'), 'CEF case');
const fbroCaseOpen = findLine(cefCaseOpen + 1, cefCaseOpen + 12, l => l.includes('case WM_LINGBUILDER_FBRO_EVENT:'), 'FBRO case');
const fbroProcGuard = findLine(fbroCaseOpen + 1, fbroCaseOpen + 25, (l, at) => l.trim() === '#if LINGBUILDER_FBRO_AVAILABLE' && line(at + 1).includes('WM_LINGBUILDER_FBRO_PROCESS_EVENT'), 'FBRO process guard');
const fbroProcGuardEnd = findLine(fbroProcGuard + 1, fbroProcGuard + 8, l => l.trim() === '#endif', 'FBRO process endif');

const fbCloseGuard = findLine(29100, 29130, (l, at) => {
  if (l.trim() !== '#if LINGBUILDER_FBRO_AVAILABLE') return false;
  for (let k = 1; k <= 6; k++) if (line(at + k).includes('FBro_是否全部关闭')) return true;
  return false;
}, 'FB close guard');
const fbCloseGuardEnd = findLine(fbCloseGuard + 1, fbCloseGuard + 20, l => l.trim() === '#endif', 'FB close endif');
const evResizeGuard2Start = findLine(fbCloseGuardEnd + 1, fbCloseGuardEnd + 55, (l, at) => l.trim() === '#if LINGBUILDER_EDGEVIEW_AVAILABLE' && line(at + 1).includes('EdgeView_随窗口调整设计器控件'), 'EV resize2 guard');
const evResizeGuard2End = evResizeGuard2Start + 3;
const cefResize2 = evResizeGuard2End + 1;
const fbResize2 = evResizeGuard2End + 2;
expect(cefResize2, '            CEF3_调整全部大小();', 'resize2 CEF');
expect(fbResize2, '            FBro_调整全部大小();', 'resize2 FB');

const evDpiClose = findLine(29190, 29210, l => l.includes('EdgeView_关闭设计器控件'), 'DPI2 EV close');
const fbRebuild1 = findLine(evDpiClose + 1, evDpiClose + 8, (l, at) => l.trim() === '#if LINGBUILDER_FBRO_AVAILABLE' && line(at + 1).includes('浏览器管理器_控件重建前'), 'FB rebuild1');
const fbRebuild1End = fbRebuild1 + 2;
const fbRebuild2 = findLine(fbRebuild1End + 1, fbRebuild1End + 12, (l, at) => l.trim() === '#if LINGBUILDER_FBRO_AVAILABLE' && line(at + 1).includes('浏览器管理器_控件重建后'), 'FB rebuild2');
const fbRebuild2End = fbRebuild2 + 2;
const evRecreate = findLine(fbRebuild2End + 1, fbRebuild2End + 8, (l, at) => l.trim() === '#if LINGBUILDER_EDGEVIEW_AVAILABLE' && line(at + 1).includes('EdgeView_创建控件'), 'EV recreate');
const evRecreateEnd = evRecreate + 2;
const evResize3 = findLine(evRecreateEnd + 1, evRecreateEnd + 8, (l, at) => l.trim() === '#if LINGBUILDER_EDGEVIEW_AVAILABLE' && line(at + 1).includes('EdgeView_调整全部大小'), 'EV resize3');
const evResize3End = evResize3 + 2;
const cefResize3 = evResize3End + 1;
const fbResize3 = evResize3End + 2;

const evDestroy = findLine(29495, 29515, l => l.includes('EdgeView_关闭();'), 'destroy EV');
const cefDestroy = evDestroy + 1;
const fbDestroy = evDestroy + 2;

// —— 组装片段序列（严格线性覆盖 [BASE .. 末行]）——
const pieces = [];
const LAST = BASE + bodyLines.length - 1;
function push(family, from, to) {
  if (to === from - 1) return; // 相邻裁剪块之间无核心行：空片段直接跳过
  if (to < from) throw new Error(`片段区间倒置：${family} ${from}-${to}`);
  if (pieces.length > 0 && from !== pieces[pieces.length - 1].endLine + 1) {
    throw new Error(`片段不连续：${family} ${from} 紧跟 ${pieces[pieces.length - 1].endLine}`);
  }
  const text = bodyLines.slice(from - BASE, to - BASE + 1).join('\n');
  pieces.push({ family, text: text + (to === LAST ? '' : '\n'), endLine: to });
}
function splitLine(at, cuts) {
  const l = line(at);
  if (pieces.length > 0 && at !== pieces[pieces.length - 1].endLine + 1) {
    throw new Error('splitLine 前片段不连续');
  }
  let cursor = 0;
  for (const c of cuts) {
    pieces.push({ family: c.family, text: l.slice(cursor, c.afterIndex), endLine: at });
    cursor = c.afterIndex;
  }
  pieces.push({ family: 'core', text: l.slice(cursor) + (at === LAST ? '' : '\n'), endLine: at });
}

push('core', BASE, 12752);
push('edgeview', 12753, 12753);
push('fbro', 12754, 12754);
push('core', 12755, 12814);
push('edgeview', 12815, 12815);
push('core', 12816, 13215);
{
  const l = line(13216);
  const cuts = [
    { family: 'core', afterIndex: l.indexOf('EdgeView_创建控件') },
    { family: 'edgeview', afterIndex: l.indexOf('CEF3_创建') },
    { family: 'cef3', afterIndex: l.indexOf('FBro_创建(nullptr)') },
    { family: 'fbro', afterIndex: l.indexOf('EdgeView_创建无头资源();') },
    { family: 'edgeview', afterIndex: l.indexOf('LingBuilder_CEF3_创建无头资源();') },
    { family: 'cef3', afterIndex: l.indexOf('时钟_启动默认组件') }
  ];
  splitLine(13216, cuts);
}
push('core', 13217, evBlockStart - 1);
push('edgeview', evBlockStart, fbBlockStart - 1);
push('fbro', fbBlockStart, cefBlockStart - 1);
push('cef3', cefBlockStart, cefBlockEnd);
push('core', cefBlockEnd + 1, fbResize1 - 1);
push('fbro', fbResize1, fbResize1);
push('cef3', cefResize1, cefResize1);
push('edgeview', evResizeGuardStart, evResizeGuardEnd);
push('core', evResizeGuardEnd + 1, cefBranchOpen - 1);
{
  // CEF else-if 前导「}」归 core（无换行，与本行其余部分同线）；FB else-if 前导「}」
  // 归 cef3（负责收 CEF 括号）；FB 块以自带「}」收尾。四种裁剪组合均语法完整。
  const l1 = line(cefBranchOpen);
  pieces.push({ family: 'core', text: l1.slice(0, l1.indexOf('}') + 1), endLine: cefBranchOpen });
  pieces.push({ family: 'cef3', text: ' else if' + l1.slice(l1.indexOf('else if') + 'else if'.length) + '\n', endLine: cefBranchOpen });
  pieces.push({ family: 'cef3', text: bodyLines.slice(cefBranchOpen + 1 - BASE, fbBranchOpen - BASE).join('\n') + '\n', endLine: fbBranchOpen - 1 });
  const l2 = line(fbBranchOpen);
  pieces.push({ family: 'cef3', text: l2.slice(0, l2.indexOf('}') + 1), endLine: fbBranchOpen });
  pieces.push({ family: 'fbro', text: ' else if' + l2.slice(l2.indexOf('else if') + 'else if'.length) + '\n', endLine: fbBranchOpen });
  pieces.push({ family: 'fbro', text: bodyLines.slice(fbBranchOpen + 1 - BASE, fbBranchClose - BASE + 1).join('\n') + '\n', endLine: fbBranchClose });
}
push('core', fbBranchClose + 1, cefCaseOpen - 1);
push('cef3', cefCaseOpen, fbroCaseOpen - 1);
push('fbro', fbroCaseOpen, fbroProcGuard - 1);
push('fbro', fbroProcGuard, fbroProcGuardEnd);
push('core', fbroProcGuardEnd + 1, fbCloseGuard - 1);
push('fbro', fbCloseGuard, fbCloseGuardEnd);
push('core', fbCloseGuardEnd + 1, evResizeGuard2Start - 1);
push('edgeview', evResizeGuard2Start, evResizeGuard2End);
push('cef3', cefResize2, cefResize2);
push('fbro', fbResize2, fbResize2);
push('core', fbResize2 + 1, evDpiClose - 1);
push('edgeview', evDpiClose, evDpiClose);
push('fbro', fbRebuild1, fbRebuild1End);
push('core', fbRebuild1End + 1, fbRebuild2 - 1);
push('fbro', fbRebuild2, fbRebuild2End);
push('core', fbRebuild2End + 1, evRecreate - 1);
push('edgeview', evRecreate, evRecreateEnd);
push('core', evRecreateEnd + 1, evResize3 - 1);
push('edgeview', evResize3, evResize3End);
push('cef3', cefResize3, cefResize3);
push('fbro', fbResize3, fbResize3);
push('core', fbResize3 + 1, evDestroy - 1);
push('edgeview', evDestroy, evDestroy);
push('cef3', cefDestroy, cefDestroy);
push('fbro', fbDestroy, fbDestroy);
push('core', fbDestroy + 1, LAST);

// —— 自校验：拼接必须与原段逐字节一致 ——
const rejoined = pieces.map(p => p.text).join('');
if (rejoined !== body) {
  const a = rejoined.split('\n');
  const b = body.split('\n');
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    if (a[k] !== b[k]) {
      throw new Error(`片段拼接还原失败 @第${k + 1}行\nNEW: ${JSON.stringify(a[k])}\nOLD: ${JSON.stringify(b[k])}`);
    }
  }
}
const byFamily = {};
for (const p of pieces) byFamily[p.family] = (byFamily[p.family] || 0) + p.text.split('\n').length - 1;
console.log('片段数:', pieces.length, '行数分布:', JSON.stringify(byFamily));

// —— 重写声明（片段文本原样保留 ${} 插值与转义）——
const declIndent = '  ';
let out = src.slice(0, declLineStart);
out += `${declIndent}const windowBaseParts: Array<{ family: 'core' | 'edgeview' | 'fbro' | 'cef3'; text: string }> = [\n`;
for (const p of pieces) {
  out += `${declIndent}  { family: '${p.family}', text: \`${p.text}\` },\n`;
}
out += `${declIndent}];\n`;
out += src.slice(templateEnd + 1).replace(/^;/, '');
fs.writeFileSync(FILE, out, 'utf8');
console.log('rtSegWindowBase 已切分为', pieces.length, '个带族标签片段');
