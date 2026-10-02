/**
 * C2a 迁移工具：把 windowBaseParts 的 core 片段按「控件/命令族」细切，
 * 使 数据表格/列表视图/选项卡/日期月历/IP地址框/工具栏状态栏/动画视频/颜色选择器/树形框/
 * 查找替换/打印/属性页/任务对话框 十三个族可按项目实际内容裁剪。
 *
 * 设计要点（与浏览器族同法并扩展）：
 * - 核心代码里仅引用 Win32 宏的 IsType 分支保持 core（族裁剪后成为惰性死代码，无需切）；
 *   只切「引用我们自己的符号」的连续区段、case 与分支。
 * - else-if 链内切分沿用阶段B规则：族片段 = 「 else if(...) 」+ 体 + 下一分支行首的「}」，
 *   任意裁剪组合语法完整（浏览器族已验证）。
 * - 自校验：全部片段按序拼接必须与原数组逐字节一致，否则拒绝写盘。
 *
 * 运行：cd electron && node scripts/split-runtime-control-families.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts');
let src = fs.readFileSync(FILE, 'utf8');

const FAMILIES = ['core', 'edgeview', 'fbro', 'cef3', 'datagrid', 'listview', 'tab', 'date', 'ip', 'toolbar', 'video', 'colorpicker', 'treeview', 'findreplace', 'print', 'propsheet', 'taskdialog'];

// —— 解析 windowBaseParts 数组 ——
const ARRAY_HEAD = 'const windowBaseParts: Array<{ family: ';
const arrIdx = src.indexOf(ARRAY_HEAD);
if (arrIdx < 0) throw new Error('未找到 windowBaseParts 声明');
const openBracket = src.indexOf('= [', arrIdx);
const entries = [];
let scanPos = src.indexOf('{', openBracket);
const entryRe = /\{ family: '([\w]+)', text: `/gu;
entryRe.lastIndex = scanPos;
let m;
while ((m = entryRe.exec(src)) !== null) {
  const family = m[1];
  const contentStart = m.index + m[0].length;
  // 扫描模板字面量闭合（${} 与转义）
  const stack = [{ type: 'tpl', nested: false }];
  let i = contentStart;
  while (i < src.length) {
    const c = src[i];
    const top = stack[stack.length - 1];
    if (c === '\\') { i += 2; continue; }
    if (top.type === 'str') { if (c === top.quote) stack.pop(); i += 1; continue; }
    if (top.type === 'interp') {
      if (c === '{') { top.braces += 1; i += 1; continue; }
      if (c === '}') { top.braces -= 1; if (top.braces === 0) stack.pop(); i += 1; continue; }
      if (c === '\'' || c === '"') { stack.push({ type: 'str', quote: c }); i += 1; continue; }
      if (c === '`') { stack.push({ type: 'tpl', nested: true }); i += 1; continue; }
      i += 1; continue;
    }
    if (c === '`') { if (top.nested) { stack.pop(); i += 1; continue; } break; }
    if (c === '$' && src[i + 1] === '{') { stack.push({ type: 'interp', braces: 1 }); i += 2; continue; }
    i += 1;
  }
  const text = src.slice(contentStart, i);
  if (!FAMILIES.includes(family)) throw new Error(`未知族标签: ${family}`);
  entries.push({ family, text });
  entryRe.lastIndex = i + 1;
  if (/^\s*\]/u.test(src.slice(i + 1))) break;
}
if (entries.length < 50) throw new Error(`条目数异常: ${entries.length}`);

// —— 原条目族标签 → 行段映射（合并行按原条目列区间存多段，各自保留原族）——
// 精确构建：部分片段文本不以 \n 结尾时，与下一片段首行合并为同一物理行；
// 合并行的段族按段各自裁剪（例：core 的行首「}」+ cef3 的「 else if…」头——
// 裁 cef3 时只删头段，lead 段保留，else-if 链语法由浏览器族切分的配对设计保证）。
const concatLines = [];
const lineSegments = []; // 每行: Array<{ family, colStart, colEnd }>
let prevEndsWithNewline = true;
for (const e of entries) {
  const els = e.text.split('\n');
  els.forEach((el, k) => {
    if (k === 0 && !prevEndsWithNewline && concatLines.length > 0) {
      const last = concatLines[concatLines.length - 1];
      const segs = lineSegments[lineSegments.length - 1];
      const lastSeg = segs[segs.length - 1];
      segs.push({ family: e.family, colStart: last.length, colEnd: last.length + el.length });
      concatLines[concatLines.length - 1] += el;
      return;
    }
    concatLines.push(el);
    lineSegments.push([{ family: e.family, colStart: 0, colEnd: el.length }]);
  });
  prevEndsWithNewline = e.text.endsWith('\n');
}
const concat = concatLines.join('\n');
console.log('解析到', entries.length, '个片段，拼接', concatLines.length, '行');

const lines = concat.split('\n');
const N = lines.length;

// —— 插值原子组：跨行 ${...} 插值的行不可拆到不同片段（嵌套模板会被截断）——
// 逐字符状态机：处理完一行后若仍在插值/嵌套模板内，则下一行并入同组。
const units = [];
const unitStartOfLine = new Array(N).fill(-1);
const unitEndOfLine = new Array(N).fill(-1);
{
  const stack = [{ type: 'tpl', nested: false }];
  let current = [];
  for (let li = 0; li < N; li++) {
    const line = lines[li];
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      const top = stack[stack.length - 1];
      if (c === '\\') { i += 2; continue; }
      if (top.type === 'str') { if (c === top.quote) stack.pop(); i += 1; continue; }
      if (top.type === 'interp') {
        if (c === '{') { top.braces += 1; i += 1; continue; }
        if (c === '}') { top.braces -= 1; if (top.braces === 0) stack.pop(); i += 1; continue; }
        if (c === '\'' || c === '"') { stack.push({ type: 'str', quote: c }); i += 1; continue; }
        if (c === '`') { stack.push({ type: 'tpl', nested: true }); i += 1; continue; }
        i += 1; continue;
      }
      // 模板上下文：反引号闭合嵌套模板（顶层闭合在数组扫描器处理）
      if (c === '`' && top.nested) { stack.pop(); i += 1; continue; }
      if (c === '$' && line[i + 1] === '{') { stack.push({ type: 'interp', braces: 1 }); i += 2; continue; }
      i += 1;
    }
    current.push(li);
    if (stack.length === 1) {
      units.push(current);
      unitStartOfLine[current[0]] = units.length - 1;
      unitEndOfLine[current[current.length - 1]] = units.length - 1;
      current = [];
    }
  }
  if (current.length) {
    units.push(current);
    unitStartOfLine[current[0]] = units.length - 1;
    unitEndOfLine[current[current.length - 1]] = units.length - 1;
  }
  const multi = units.filter(g => g.length > 1).length;
  console.log('原子组:', units.length, '（跨行插值组:', multi, '）');
}

// —— 锚点定位 ——
function findUnique(pattern, from = 0, to = N, label = String(pattern)) {
  const hits = [];
  const re = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.replace('g', '')) : null;
  for (let i = from; i < to; i++) {
    if (re ? re.test(lines[i]) : lines[i].includes(pattern)) hits.push(i);
  }
  if (hits.length !== 1) throw new Error(`锚点「${label}」命中 ${hits.length} 次（期望 1）`);
  return hits[0];
}
function findAfter(pattern, afterLine, label = String(pattern)) {
  return findUnique(pattern, afterLine + 1, N, label);
}

// —— 操作列表 ——
const ops = []; // { type:'span'|'line'|'chainRun', ... }
function span(startPat, endPat, family, label, afterLine = -1) {
  const s = afterLine >= 0 ? findAfter(startPat, afterLine, label + ':start') : findUnique(startPat, 0, N, label + ':start');
  const e = findUnique(endPat, s + 1, N, label + ':end');
  if (e <= s) throw new Error(`${label}: end <= start`);
  ops.push({ type: 'span', s, e, family, label });
}
function point(pat, family, label, afterLine = -1) {
  const s = afterLine >= 0 ? findAfter(pat, afterLine, label) : findUnique(pat, 0, N, label);
  ops.push({ type: 'span', s, e: s + 1, family, label });
}
// chainRun：segments = [{ sLine, eLine, family }]，run 末尾的收尾行（lead } 归最后族，余下归 core）
function chainRun(segments, endLinePat, label) {
  const nLine = findUnique(endLinePat, segments[segments.length - 1].eLine, N, label + ':end');
  ops.push({ type: 'chainRun', segments, nLine, label });
}

// —— 1) 类内命令/方法连续区段 ——
span('    bool 颜色选择器_打开(const wchar_t* controlName) {', '    void 查找文本(const wchar_t* initial) {', 'colorpicker', 'cp方法组');
span('    void 查找文本(const wchar_t* initial) {', '    bool 打印文本(const wchar_t* documentName, const wchar_t* text) {', 'findreplace', '查找替换组');
span('    bool 打印文本(const wchar_t* documentName, const wchar_t* text) {', '    int 属性页_显示(const wchar_t* resourceId) {', 'print', '打印组');
span('    int 属性页_显示(const wchar_t* resourceId) {', '    int 任务对话框(const wchar_t* title, const wchar_t* content) {', 'propsheet', '属性页组');
span('    int 任务对话框(const wchar_t* title, const wchar_t* content) {', '    void 结束() {', 'taskdialog', '任务对话框组');
span('    void ReleaseAnimatedBuffer(RuntimeControl& runtime) {', '    bool 控件_设置文本(const wchar_t* controlName, const std::wstring& text) {', 'video', 'video1');
span('    bool InitializeVideoPlayer(RuntimeControl& runtime, const ControlSpec& control', '    bool 控件_设置图片(const wchar_t* controlName, const std::wstring& imagePath) {', 'video', 'video2');
// DataGrid 方法组整体来自 dataGridNativeRuntime.ts 的插值（单行模板源），整行点切
point('${DATA_GRID_NATIVE_METHODS}', 'datagrid', 'dg1插值');
span('    static std::vector<std::wstring> ListViewSplitCells(const wchar_t* tabSeparate', '    bool 树形框_添加节点(const wchar_t* controlName, const wchar_t* parentText, const wch', 'listview', 'lv1');
span('    bool 树形框_添加节点(const wchar_t* controlName, const wchar_t* parentText, const wch', '    int 选项卡_添加页(const wchar_t* controlName, const wchar_t* title) {', 'treeview', 'tree1');
span('    int 选项卡_添加页(const wchar_t* controlName, const wchar_t* title) {', '    bool EnsureSocketsStarted() {', 'tab', 'tab1');
// 「控件_创建Xxx」创建目录整段来自 ${win32RuntimeControlMethods} 插值（生成期函数），
// 其族过滤在 generateWin32RuntimeControlMethods 源头实现，不在本脚本切。
span('    RuntimeTabPage* FindTabPage(int tabControlId, const wchar_t*', '    void WireCompositeControls() {', 'tab', 'tab3');
span('    void ApplyMonthCalendarColors(HWND calendar, const ControlSp', '    void ApplyWindowAppearance() {', 'date', 'date2');
span('    void PaintIPAddressChrome(HWND hwnd, HDC hdc, const ControlS', '    static LRESULT CALLBACK ControlSubclassProc(', 'ip', 'ip2');

// —— 2) 控制台/子类过程内的块（花括号配平扫描）——
function block(startPat, family, label, scopeAfter = -1) {
  const s = scopeAfter >= 0 ? findAfter(startPat, scopeAfter, label + ':start') : findUnique(startPat, 0, N, label + ':start');
  let depth = 0, seen = false, e = -1;
  for (let i = s; i < N; i++) {
    for (const c of lines[i]) {
      if (c === '{') { depth += 1; seen = true; }
      else if (c === '}') depth -= 1;
    }
    if (seen && depth === 0) { e = i + 1; break; }
  }
  if (e < 0) throw new Error(`${label}: 花括号未配平`);
  ops.push({ type: 'span', s, e, family, label });
}
const cspStart = findUnique('    static LRESULT CALLBACK ControlSubclassProc(', 0, N, 'ControlSubclassProc');
block('        if (IsType(*control, L"DataGrid") && runtime->dataGrid) {', 'datagrid', 'dg钩子');
block('            if (IsType(*control, L"DateTimePicker")) {', 'date', 'date绘制', cspStart);
block('if (IsType(*control, L"IPAddress") && message == WM_PAINT) {', 'ip', 'ip绘制1', cspStart);
block('if (IsType(*control, L"IPAddress") && message == WM_PRINTCLIENT) {', 'ip', 'ip绘制2', cspStart);
block('if (IsType(*control, L"IPAddress") && (message == WM_SIZE || message == WM_SETFONT))', 'ip', 'ip布局', cspStart);
block('            if (parentSpec && IsType(*parentSpec, L"TabControl")) {', 'tab', 'tab父容器', cspStart);

// —— 3) else-if 链内分支 ——

const dtpNotify = findUnique('} else if (IsType(*control, L"DateTimePicker") && header->code == DTN_DROPDOWN', 0, N, 'NTF-DTP分支');
const sharedSel = findAfter('} else if ((IsType(*control, L"ListView") && header->code == LVN_ITEMCHANGED', dtpNotify, 'NTF-共享选择分支');
chainRun([
  { sLine: dtpNotify, eLine: sharedSel - 1, family: 'date' }
], new RegExp('^\\s*\\} else if \\(\\(IsType\\(\\*control, L"ListView"\\) && header->code == LVN_ITEMCHANGED\\)'), 'NTF-date');
point('                if (IsType(*control, L"TabControl")) UpdateTabChildren(*control);', 'tab', 'NTF-tab行');

const colorPickerNotify = findUnique('} else if (IsType(*control, L"ColorPicker") && notification == BN_CLICKED) {', 0, N, 'NTF-颜色分支');
chainRun([
  { sLine: colorPickerNotify, eLine: colorPickerNotify + 1, family: 'colorpicker' }
], new RegExp('^\\s*\\} else if \\(\\(IsType\\(\\*control, L"Button"\\) \\|\\| IsType\\(\\*control, L"Label"\\)'), 'NTF-颜色');

// —— 4) WindowProc case ——
span('        case WM_LINGBUILDER_LAYOUT_DATE_PICKER: {', '        case WM_LINGBUILDER_VIDEO_EVENT: {', 'date', 'case-date');
span('        case WM_LINGBUILDER_VIDEO_EVENT: {', '        case WM_NCPAINT: {', 'video', 'case-video');

// —— 5) DestroyControls 动画清理块 ——
{
  // 该 if 为无花括号单语句，不能用花括号配平扫描（会越界吞块）——用显式行区间。
  const s = findUnique('            if (control.animatedTimer) KillTimer(hwnd_, control.animatedTimer);', 0, N, 'dc清理:start');
  const e = findAfter('            control.animatedImage = nullptr;', s, 'dc清理:end');
  ops.push({ type: 'span', s, e: e + 1, family: 'video', label: 'dc动画清理' });
}

// —— 6) 核心区残余族引用点（逐点/小块切，否则族裁剪后编译失败）——
// 控件_取选择项 的 TabControl 分支（调 UpdateTabChildren）
point('        if (IsType(*control, L"TabControl")) { TabCtrl_SetCurSel(runtime->hwnd, index); UpdateTabChi', 'tab', '取选择项tab行');
// WM_TIMER 动画推进（调 AdvanceAnimatedImage）
point('            if (AdvanceAnimatedImage(static_cast<UINT_PTR>(wParam))) return 0;', 'video', 'WM_TIMER动画行');
// SetWindowSubclass 接线三元里的 IP 分支（IPAddressFrameSubclassProc 随 ip 族裁剪；
// ListView/TreeView proc 体零家族引用，恒保留，接线不裁）
point('                    : IsType(control, L"IPAddress") ? IPAddressFrameSubclassProc', 'ip', '接线IP分支');
// WireCompositeControls 的 TabControl 分支（调 UpdateTabChildren）
{
  const pagerLine = findUnique('PGM_SETCHILD', 0, N, 'WireComposite-Pager');
  let tabBranch = -1;
  for (let i = pagerLine + 1; i < N; i++) {
    if (lines[i].includes('} else if (IsType(control, L"TabControl")) {')) { tabBranch = i; break; }
  }
  if (tabBranch < 0) throw new Error('WireComposite-tab分支未找到');
  if (!lines[tabBranch + 1].includes('UpdateTabChildren')) throw new Error('WireComposite-tab分支体不符');
  const nLine = tabBranch + 2;
  if (lines[nLine].trim() !== '}') throw new Error('WireComposite-tab收尾行形态异常');
  ops.push({ type: 'chainRun', segments: [{ sLine: tabBranch, eLine: tabBranch, family: 'tab' }], nLine, label: 'WireComposite-tab' });
}

// —— 检查重叠 + 原子组对齐 ——
ops.sort((a, b) => {
  const as = a.type === 'chainRun' ? a.segments[0].sLine : a.s;
  const bs = b.type === 'chainRun' ? b.segments[0].sLine : b.s;
  return as - bs;
});
const consumed = new Array(N).fill(false);
const consumedBy = new Array(N).fill('');
for (const op of ops) {
  const ranges = op.type === 'chainRun'
    ? op.segments.map(seg => [seg.sLine, seg.eLine]).concat([[op.nLine, op.nLine]])
    : [[op.s, op.e - 1]];
  for (const [a, b] of ranges) {
    for (let i = a; i <= b; i++) {
      if (consumed[i]) throw new Error(`操作重叠 @${i}: ${op.label} vs ${consumedBy[i]}`);
      consumed[i] = true; consumedBy[i] = op.label;
    }
  }
}
// 每个原子组必须整体属于同一操作（或整体 core）：组内任一行被操作覆盖 ⇒ 全组被同一操作覆盖
for (const group of units) {
  const tags = new Set(group.map(li => consumedBy[li]));
  if (tags.size > 1) throw new Error(`原子组跨操作 @${group[0]}-${group[group.length - 1]}: ${[...tags].join(',')}`);
}
// ops 只允许作用于原 core 条目的行：锚点落进浏览器/模块族条目 = 切分设计错误
// （合并行的段族取「行尾段」的族——分支头所在段决定该行的语法角色）
for (const op of ops) {
  const ranges = op.type === 'chainRun'
    ? op.segments.map(seg => [seg.sLine, seg.eLine]).concat([[op.nLine, op.nLine]])
    : [[op.s, op.e - 1]];
  for (const [a, b] of ranges) {
    for (let i = a; i <= b; i++) {
      const segs = lineSegments[i];
      const tailFam = segs[segs.length - 1].family;
      if (tailFam !== 'core') throw new Error(`操作「${op.label}」覆盖非 core 条目行 @${i}（原族 ${tailFam}）`);
    }
  }
}

// —— 构造新片段（字节空间：行区间 → 字节区间，裁剪=删字节段，字节精确还原）——
// 行 i 的字节区间：[lineByteStart[i], lineByteEnd(i))
const lineByteStart = new Array(N);
{
  let acc = 0;
  for (let li = 0; li < N; li++) { lineByteStart[li] = acc; acc += lines[li].length + 1; }
}
const TOTAL = concat.length;
function lineByteEnd(li) { return li + 1 < N ? lineByteStart[li + 1] : TOTAL; }

const pieces = []; // { family, text }
function emitRange(family, from, to) {
  if (to <= from) return;
  const text = concat.slice(from, to);
  const prev = pieces[pieces.length - 1];
  if (prev && prev.family === family) prev.text += text;
  else pieces.push({ family, text });
}
function leadLenOf(lineIdx) {
  const m = lines[lineIdx].match(/^(\s*\})/u);
  if (!m) throw new Error(`行 ${lineIdx + 1} 行首无「}」: ${lines[lineIdx].slice(0, 50)}`);
  return m[1].length;
}

let i = 0;
const opByStart = new Map();
for (const op of ops) {
  const s = op.type === 'chainRun' ? op.segments[0].sLine : op.s;
  if (opByStart.has(s)) throw new Error('同起点双操作');
  opByStart.set(s, op);
}
while (i < N) {
  const gi = unitStartOfLine[i];
  const group = units[gi];
  const op = opByStart.get(i);
  if (!op) {
    // 按行段（原条目）发射：合并行内各段保留各自族，裁剪时按段过滤。
    // 字节直连（不注入换行）——与真实生成器的文本直连一致。
    const from = lineByteStart[group[0]];
    const to = lineByteEnd(group[group.length - 1]);
    let cursor = from;
    for (let li = group[0]; li <= group[group.length - 1]; li++) {
      for (const seg of lineSegments[li]) {
        const segFrom = lineByteStart[li] + seg.colStart;
        const segTo = lineByteStart[li] + seg.colEnd;
        if (segFrom < cursor) continue; // 跨行段（不应出现）保护
        emitRange(seg.family, segFrom, segTo);
        cursor = segTo;
      }
      if (li < group[group.length - 1]) cursor += 1; // 跳过行间换行符（归无族，随相邻段保留——恒发 core）
      // 换行符必须恒保留（行边界语法），显式发 core：
      if (li < group[group.length - 1]) emitRange('core', cursor - 1, cursor);
    }
    i = group[group.length - 1] + 1;
    continue;
  }
  if (op.type === 'span') {
    emitRange(op.family, lineByteStart[op.s], lineByteEnd(op.e - 1));
    i = op.e;
    continue;
  }
  // chainRun：行首「}」（lead）归 core（字节行首前缀），行剩余归族；收尾行同理
  const segs = op.segments;
  const first = segs[0];
  emitRange('core', lineByteStart[first.sLine], lineByteStart[first.sLine] + leadLenOf(first.sLine));
  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const nLine = k + 1 < segs.length ? segs[k + 1].sLine : op.nLine;
    emitRange(seg.family, lineByteStart[seg.sLine] + leadLenOf(seg.sLine), lineByteStart[nLine] + leadLenOf(nLine));
  }
  emitRange('core', lineByteStart[op.nLine] + leadLenOf(op.nLine), lineByteEnd(op.nLine));
  i = op.nLine + 1;
}

// —— 自校验：拼接逐字节还原 ——
{
  const joined = pieces.map(p => p.text).join('');
  if (joined !== concat) {
    let k = 0;
    while (k < Math.min(joined.length, concat.length) && joined[k] === concat[k]) k += 1;
    throw new Error(`字节还原失败 @${k}\nNEW: ${JSON.stringify(joined.slice(k, k + 90))}\nOLD: ${JSON.stringify(concat.slice(k, k + 90))}`);
  }
}
const byFamily = {};
for (const p of pieces) byFamily[p.family] = (byFamily[p.family] || 0) + p.text.split('\n').length - 1;
console.log('新片段数:', pieces.length, '族行数分布:', JSON.stringify(byFamily));

// —— 写回（片段文本原样保留 ${} 与转义）——
  const declEndFix = src.indexOf('[\n', arrIdx) + 2;
  const arrayEnd = src.indexOf('\n  ];', declEndFix);
  if (arrayEnd < 0) throw new Error('未找到数组结尾');
  const declIndent = '  ';
  let out = src.slice(0, declEndFix);
  for (const p of pieces) {
    out += `${declIndent}  { family: '${p.family}', text: \`${p.text}\` },\n`;
  }
  out += `${declIndent}];`;
  out += src.slice(arrayEnd + '\n  ];'.length);
  fs.writeFileSync(FILE, out, 'utf8');
  console.log('windowBaseParts 已细切为', pieces.length, '个片段');
