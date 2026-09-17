// 校验 system-net-report.txt：全部断言通过输出 ALL-PASS。
import fs from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('用法：node verify.mjs <system-net-report.txt 路径>');
  process.exit(2);
}
const values = new Map();
for (const line of fs.readFileSync(reportPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const index = line.indexOf('=');
  if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
}
const failures = [];
function check(key, expected) {
  const actual = values.get(key);
  if (actual !== expected) failures.push(`${key}: 期望 [${expected}] 实际 [${actual}]`);
}
check('D输出包含', '真');
check('D退出码', '0');
check('N网卡数大于0', '真');
check('NMAC长度17', '真');
check('NIP数大于0', '真');
check('K快捷方式', '真');
check('A静音状态', '假');
check('DONE', '1');
if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ALL-PASS system-net（' + values.size + ' 项断言全部通过）');
