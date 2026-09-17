// 校验 std-algo-report.txt：exe 探针逐行 KEY=VALUE（首个等号切分），全部断言通过输出 ALL-PASS。
// 用法：node verify.mjs <报告文件路径>
import fs from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('用法：node verify.mjs <std-algo-report.txt 路径>');
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

// —— 哈希表与栈 ——
check('M初数', '0');
check('M置文本', '真');
check('M取文本', '96');
check('M置整数', '真');
check('M取整数', '128');
check('M包含', '真');
check('M包含缺', '假');
check('M上次操作', '假');
check('M键数', '2');
check('M数量', '2');
check('M删除', '真');
check('M删后数', '1');
check('S弹一出', '第二步')
check('S弹出二', '第一步');
check('S空弹', '假');
check('S压整数', '真');
check('S弹整数', '77');

// —— 大数运算 ——
check('B加', '100000000000000000000');
check('B乘', '300000000000000000000');
check('B除', '42857142857142857142');
check('B符号', '-1');
check('B大于', '真');
check('B负文本', '-12345678901234567890123456789');

// —— 拼音处理 ——
check('P全拼', 'zhong-wen-bian-cheng');
check('P首字母', 'zwbc');
check('P声母', 'zhwbch');
check('P韵母', 'ongenianeng');
check('P匹配', '真');
check('P发音数', '3');
check('P首读音', 'zhong');

// —— 农历日期 ——
check('L闰月', '6');
check('L春节', '2026年02月17日');
check('L农历文本', '丙午（马）年正月初一');
check('L闰月反查', '-6');
check('L干支', '丙午');
check('L属相', '马');
check('L立春', '2026年02月04日');
check('L节气名', '冬至');
const sizhu = values.get('L四柱') ?? '';
if (!/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]年 /.test(sizhu) || !/时$/.test(sizhu)) {
  failures.push(`L四柱: 格式不符 [${sizhu}]`);
}
check('DONE', '1');

if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ALL-PASS std-algo-wave1（' + values.size + ' 项断言全部通过）');
