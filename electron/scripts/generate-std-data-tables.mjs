// 生成 std.pinyin / std.lunar 模块所需的 C++ 数据表（stdDataTables.ts）。
// 数据来源（均为 MIT 许可）：
//   1. 拼音码表：mozillazg/pinyin-data pinyin.txt（含全部多音字读音，按频率排序）
//      https://github.com/mozillazg/pinyin-data
//   2. 农历年历位表与节气压缩表：jjonline/calendar.js src/constant/{Lunar,SolarTerm}.js
//      https://github.com/jjonline/calendar.js
// 用法：node scripts/generate-std-data-tables.mjs <pinyin.txt> <Lunar.js> <SolarTerm.js>
//       缺省路径指向 ../../.deploy/w1-data/（本机下载副本）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = path.resolve(HERE, '../../.deploy/w1-data');
const PINYIN_TXT = args[0] || path.join(dir, 'pinyin.txt');
const LUNAR_JS = args[1] || path.join(dir, 'Lunar.js');
const SOLAR_JS = args[2] || path.join(dir, 'SolarTerm.js');
const OUT = path.resolve(HERE, '../src/services/windowDesigner/stdDataTables.ts');

// ---------- 拼音 ----------
const TONE_MARKS = new Set(['\u0300', '\u0301', '\u0304', '\u030C']);
function stripTone(syllable) {
  const nfd = syllable.normalize('NFD');
  let out = '';
  for (const ch of nfd) if (!TONE_MARKS.has(ch)) out += ch;
  return out.normalize('NFC');
}
const isCjkCandidate = code =>
  (code >= 0x2E80 && code <= 0x9FFF) || code === 0x3007 ||
  (code >= 0x3400 && code <= 0x4DBF) || (code >= 0xF900 && code <= 0xFAFF);

const syllablePool = new Map(); // syllable -> index
const poolOf = s => {
  let idx = syllablePool.get(s);
  if (idx === undefined) { idx = syllablePool.size; syllablePool.set(s, idx); }
  return idx;
};
const entries = []; // {code, readings:[poolIdx]}
for (const line of fs.readFileSync(PINYIN_TXT, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^U\+([0-9A-Fa-f]+):\s*([^#]+?)\s*(?:#.*)?$/);
  if (!m) continue;
  const code = parseInt(m[1], 16);
  if (!isCjkCandidate(code)) continue;
  const readings = [];
  for (const raw of m[2].split(',')) {
    const syl = stripTone(raw.trim());
    if (!syl) continue;
    const idx = poolOf(syl);
    if (!readings.includes(idx)) readings.push(idx);
  }
  if (readings.length) entries.push({ code, readings });
}
entries.sort((a, b) => a.code - b.code);

const syllables = [...syllablePool.keys()];
const lists = []; // flat: [count, i1, i2...]
const offsets = [];
for (const e of entries) {
  offsets.push(lists.length);
  lists.push(e.readings.length);
  for (const idx of e.readings) lists.push(idx);
}

// ---------- 农历 ----------
const lunarSrc = fs.readFileSync(LUNAR_JS, 'utf8');
const lunarMatch = lunarSrc.match(/lunarInfo\s*=\s*(\[[\s\S]*?\]);/);
if (!lunarMatch) throw new Error('Lunar.js 中未找到 lunarInfo');
const lunarInfo = [...lunarMatch[1].matchAll(/0x([0-9a-fA-F]+)/g)].map(m => parseInt(m[1], 16));
if (lunarInfo.length !== 1101) throw new Error(`lunarInfo 应为 1101 项（1900-3000），实际 ${lunarInfo.length}`);

const solarSrc = fs.readFileSync(SOLAR_JS, 'utf8');
if (!/sTermInfo/.test(solarSrc)) throw new Error('SolarTerm.js 校验失败（仅作来源占位，节气改用天文算法计算）');

// ---------- 节气：Meeus 低精度太阳视黄经直接求解（1901-2100，日与时刻分钟） ----------
// 视黄经精度约 0.01°（≈15 分钟），远优于日级需求。时刻按北京时间（UTC+8）。
const LUNAR_TERM_BASE_YEAR = 1901;
const SOLAR_TERM_YEAR_COUNT = 2100 - LUNAR_TERM_BASE_YEAR + 1;
function solarApparentLongitude(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const rad = Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * rad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * rad)
    + 0.000289 * Math.sin(3 * M * rad);
  const omega = 125.04 - 1934.136 * T;
  let lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad);
  lambda = ((lambda % 360) + 360) % 360;
  return lambda;
}
function termJde(year, termIndex) {
  // termIndex: 0=冬至(270°) 1=小寒(285°) ... 23=大雪(255°)，按黄经每 15° 一档
  const target = ((termIndex * 15 + 270) % 360);
  // 初值：当年 1 月 1 日前后起算；冬至（index 0）锚定到 12 月下旬，避免向回收敛到上一年
  let jde = 2451544.5 + (year - 2000) * 365.2422 + (termIndex === 0 ? 355.0 : termIndex * 15.21875);
  for (let i = 0; i < 6; i++) {
    const lambda = solarApparentLongitude(jde);
    let diff = target - lambda;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    jde += diff / 0.9856473;
  }
  return jde;
}
const termDays = [];
const termMinutes = [];
for (let year = LUNAR_TERM_BASE_YEAR; year <= 2100; year++) {
  const days = [];
  const minutes = [];
  for (let n = 1; n <= 24; n++) {
    // n: 1=小寒 ... 24=冬至 → 黄经序列 index：小寒=1(285°)...冬至=0(270°)
    const jde = termJde(year, n === 24 ? 0 : n);
    // JD（TT，近似 UT）+ 8 小时为北京时间；当地日期 = floor(JD + 8/24 + 0.5)
    const shifted = jde + 8 / 24 + 0.5;
    const dayNumber = Math.floor(shifted);
    const frac = shifted - dayNumber; // 0..1，一天内的小数
    const minute = Math.round(frac * 1440) % 1440;
    const date = new Date(Date.UTC(2000, 0, 1) + (dayNumber - 2451545) * 86400000);
    const month = date.getUTCMonth() + 1;
    const dayOfMonth = date.getUTCDate();
    // 一致性校验：节气所在公历月必须与序号公式一致，日必须在 1～31
    const formulaMonth = Math.floor((n + 1) / 2);
    if (month !== formulaMonth) throw new Error(`节气月份与序号公式不符：${year} 第${n}个节气落在 ${month} 月`);
    if (dayOfMonth < 1 || dayOfMonth > 31) throw new Error(`节气日越界：${year} 第${n}个节气 = ${dayOfMonth}`);
    days.push(dayOfMonth);
    minutes.push(minute);
  }
  termDays.push(days);
  termMinutes.push(minutes);
}
// 锚点校验（公开历表常识）
function assertTerm(year, n, month, day, hour, minute) {
  const idx = year - LUNAR_TERM_BASE_YEAR;
  const actualDay = termDays[idx][n - 1];
  const gotMin = termMinutes[idx][n - 1];
  const gotHour = Math.floor(gotMin / 60);
  if (actualDay !== day) throw new Error(`节气锚点不符：${year} 第${n}个节气应为 ${month}-${day}，表值 ${actualDay} 日`);
  if (hour !== null && Math.abs(gotHour * 60 + (gotMin % 60) - (hour * 60 + minute)) > 30) {
    throw new Error(`节气时刻偏差过大：${year} 第${n}个节气 ${gotHour}:${gotMin % 60}，期望约 ${hour}:${minute}`);
  }
}
assertTerm(2024, 7, 4, 4, 15, 2);   // 2024 清明 4月4日 15:02
assertTerm(2025, 3, 2, 3, 22, 10);  // 2025 立春 2月3日 22:10
assertTerm(2024, 24, 12, 21, 17, 20); // 2024 冬至 12月21日 17:20
assertTerm(2026, 3, 2, 4, null);    // 2026 立春 2月4日
assertTerm(1987, 3, 2, 4, null);    // 1987 立春 2月4日（jjonline 文档示例）

// ---------- 输出 ----------
function fmtArray(name, type, values, perLine) {
  const parts = values.map(v => v.toString());
  const lines = [];
  for (let i = 0; i < parts.length; i += perLine) lines.push('    ' + parts.slice(i, i + perLine).join(', ') + ',');
  return `static const ${type} ${name}[] = {\n${lines.join('\n')}\n};`;
}
function fmtWideArray(name, values, perLine) {
  const parts = values.map(v => `L"${v}"`);
  const lines = [];
  for (let i = 0; i < parts.length; i += perLine) lines.push('    ' + parts.slice(i, i + perLine).join(', ') + ',');
  return `static const wchar_t* const ${name}[] = {\n${lines.join('\n')}\n};`;
}

const pinyinCpp = `// 拼音码表：由 mozillazg/pinyin-data（MIT）生成，读音按常用频率排序，去声调、保留 ü。
${fmtWideArray('g_lbPinyinSyllables', syllables, 12)}
static const int g_lbPinyinSyllableCount = ${syllables.length};
${fmtArray('g_lbPinyinChars', 'unsigned int', entries.map(e => e.code), 12)}
static const int g_lbPinyinCharCount = ${entries.length};
${fmtArray('g_lbPinyinOffsets', 'unsigned short', offsets, 16)}
${fmtArray('g_lbPinyinLists', 'unsigned short', lists, 16)}

// 二分查找汉字读音表；未收录返回 -1。
static int LB_PinyinFindChar(wchar_t ch) {
    int low = 0, high = g_lbPinyinCharCount - 1;
    while (low <= high) {
        const int mid = (low + high) / 2;
        if (g_lbPinyinChars[mid] == static_cast<unsigned int>(ch)) return mid;
        if (g_lbPinyinChars[mid] < static_cast<unsigned int>(ch)) low = mid + 1; else high = mid - 1;
    }
    return -1;
}`;

const lunarCpp = `// 农历年历位表（1900-3000，jjonline/calendar.js，MIT）：每年 1 个十六进制位域，
// 位含义为公开通用口径：低 4 位闰月月份（0 无闰），其后 12 位逐月大小（1 大 0 小），高位年份扩展。
static const unsigned int g_lbLunarInfo[${lunarInfo.length}] = {
${lunarInfo.map((v, i) => `    0x${v.toString(16).padStart(5, '0')},` + ((i + 1) % 8 === 0 ? '\n' : '')).join('')}
};
static const int g_lbLunarBaseYear = 1900;
static const int g_lbLunarYearCount = ${lunarInfo.length};
// 节气日与时刻表（1901-2100，Meeus 低精度太阳视黄经天文计算，北京时间）：
// 每年 24 个节气（1=小寒 ... 24=冬至），days 为公历日，minutes 为当日 0 时起的分钟数。
static const unsigned char g_lbSolarTermDays[${termDays.length}][24] = {
${termDays.map(row => '    {' + row.map(v => `(unsigned char)${v}`).join(', ') + '},').join('\n')}
};
static const unsigned short g_lbSolarTermMinutes[${termMinutes.length}][24] = {
${termMinutes.map(row => '    {' + row.join(', ') + '},').join('\n')}
};
static const int g_lbSolarTermBaseYear = ${LUNAR_TERM_BASE_YEAR};
static const int g_lbSolarTermYearCount = ${termDays.length};`;

const file = `// 本文件由 scripts/generate-std-data-tables.mjs 生成，勿手工编辑。
// 数据来源：拼音 mozillazg/pinyin-data（MIT）、农历/节气 jjonline/calendar.js（MIT）。
// 生成方式：cd electron && node scripts/generate-std-data-tables.mjs

export const LB_PINYIN_TABLE_CPP = String.raw\`${pinyinCpp}\`;

export const LB_LUNAR_TABLE_CPP = String.raw\`${lunarCpp}\`;
`;

fs.writeFileSync(OUT, file, 'utf8');
console.log(`已生成 ${OUT}`);
console.log(`拼音：${entries.length} 个汉字，${syllables.length} 个音节，${lists.length} 项读音列表`);
console.log(`农历：${lunarInfo.length} 年位表，${termDays.length} 年节气表；锚点校验全部通过`);
