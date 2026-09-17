// 校验 console-io-report.txt：全部断言通过输出 ALL-PASS。
import fs from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('用法：node verify.mjs <console-io-report.txt 路径>');
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
check('C光标', '2 3');
check('C宽度>0', '真');
check('C高度>0', '真');
check('DONE', '1');
if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ALL-PASS std-console-io（' + values.size + ' 项断言全部通过）');
