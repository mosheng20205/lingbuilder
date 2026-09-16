// 校验 yl-verification-report.txt：exe 探针逐行 KEY=VALUE（首个等号切分），全部断言通过输出 ALL-PASS。
// 用法：node verify.mjs <报告文件路径>
import fs from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('用法：node verify.mjs <yl-verification-report.txt 路径>');
  process.exit(2);
}
const text = fs.readFileSync(reportPath, 'utf8');
const lines = text.split(/\r?\n/).filter(line => line.length > 0);
const values = new Map();
for (const line of lines) {
  const index = line.indexOf('=');
  if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
}

const failures = [];
function check(key, expected) {
  const actual = values.get(key);
  if (actual !== expected) failures.push(`${key}: 期望 [${expected}] 实际 [${actual}]`);
}

// —— 批次 A：文件流句柄族 ——
function checkHandle(key) {
  const actual = values.get(key);
  if (actual === undefined || Number(actual) < 1) failures.push(`${key}: 期望 ≥1 的文件号，实际 [${actual}]`);
}
checkHandle('A打开');
check('A写文本行', '1');
check('A写文本行二', '1');
check('A取长度', '36');
check('A读入一行', '第一行内容A');
check('A未到尾', '1');
check('A读一行后位置', '18');
check('A余读长度', '18');
check('A已到尾', '1');
check('A读写位置', '36');
check('A读入定长', '第一行');
check('A插入文本', '1');
check('A插入后位置', '0');
check('A插入后长度', '43');
check('A插入后首行', '头插-第一行内容A');
check('A删除数据', '1');
check('A删除后长度', '36');
check('A删除后位置', '0');
check('A插入行后长度', '41');
check('A插入行后首行', '零');
check('A删除行数据', '1');
check('A删除行后长度', '36');
check('A删除行后首行', '第一行内容A');
check('A读入字节集', '231 一=172');
check('A锁定', '1');
check('A解锁', '1');
check('A写出字节集', '1');
check('A二进制长度', '9 首字节=66');
check('A写出数据', '1');
check('A读入数据逻辑', '1 小数十倍=25 文本=混合值');
check('A数据已到尾', '1');
check('A枚举递归', String.raw`2 一=演示子目录\一.txt 二=演示子目录\嵌套\三.txt`);
check('A枚举单层', String.raw`1 一=演示子目录\一.txt`);
check('A目录枚举', String.raw`1 一=演示子目录\嵌套`);

// —— 批次 B：文本处理 ——
check('B取左边', 'Ling');
check('B取右边', 'uilder');
check('B码点转字符', '你');
check('B取码点', '22909');
check('B删首', '内容  ');
check('B删尾', '  内容');

// —— 批次 C：日期时间 ——
check('C指定 年', '2026 月=9 日=16 星期=4 时=8 分=30 秒=5');
check('C二月天数', '28 闰年二月=29');
check('C加一月 月', '10 日=16');
check('C一月三十一加一月 月', '2 日=28');
check('C间隔日', '1 间隔秒=86400');
check('C解析 时', '12 分=30 秒=25');
check('C紧凑解析 年', '2026 分=30');
check('C解析失败值', '0');
check('C到文本', '2026年09月16日08时30分05秒');
check('C取日期时', '0 取时间年=2000');
check('C现行 年', '2026 月=9');

// —— 批次 D：数学与字节集 ——
check('D取整', '-8 绝对取整=-7');
check('D舍入整', '1057 舍入一位=10567');
check('D符号', '-1');
check('D正弦千', '841 余弦千=540 正切百=155');
check('D反正切百万', '785398 对数一百=0 反对数十万=271828');
const random = values.get('D随机');
if (random === undefined || Number(random) < 1 || Number(random) > 10) failures.push(`D随机: 期望 1～10，实际 [${random}]`);
check('D从文本长', '2 重复长=6 首字节=65');
check('D分段', '3 段一首=97 段二首=98');
check('D十六进制', 'FF 负数=FFFFFFFF');
check('D八进制', '10 十六解析=255 八解析=8');

if (!lines.includes('DONE')) failures.push('报告缺少 DONE 结束标记');

if (failures.length) {
  console.error('FAIL：断言未全部通过');
  for (const failure of failures) console.error('  ' + failure);
  console.error(`共 ${failures.length} 项失败；报告行数 ${lines.length}`);
  process.exit(1);
}
console.log(`ALL-PASS：${lines.length} 行报告全部断言通过`);
