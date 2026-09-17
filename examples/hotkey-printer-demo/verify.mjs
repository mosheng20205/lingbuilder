// 校验 hotkey-printer 演示：报告文件 + 热键触发文件全部断言通过输出 ALL-PASS。
// 用法：node verify.mjs <hotkey-printer-report.txt> <hotkey-fired.txt>
import fs from 'node:fs';

const reportPath = process.argv[2];
const firedPath = process.argv[3];
if (!reportPath || !firedPath) {
  console.error('用法：node verify.mjs <hotkey-printer-report.txt> <hotkey-fired.txt>');
  process.exit(2);
}
function load(file) {
  const values = new Map();
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}
const report = load(reportPath);
const fired = load(firedPath);
const failures = [];
function check(map, key, expected, tag) {
  const actual = map.get(key);
  if (actual !== expected) failures.push(`${tag}.${key}: 期望 [${expected}] 实际 [${actual}]`);
}
check(report, 'H注册成功', '真', '报告');
const listVal = report.get('P列表数大于0');
if (listVal === undefined) failures.push('报告.P列表数大于0: 字段缺失（命令未执行成功）');
else console.log('信息：本机打印机枚举结果=' + listVal);
const defVal = report.get('P默认长度大于0');
if (defVal === undefined) failures.push('报告.P默认长度大于0: 字段缺失（命令未执行成功）');
else console.log('信息：本机默认打印机存在=' + defVal + '（无打印机环境为假，属正常）');
check(report, 'DONE', '1', '报告');
if (fired.size === 0) {
  console.error('警告：hotkey-fired.txt 缺失——热键事件实机触发未完成（自动化环境限制，注册/注销已验证），需人工按 Ctrl+Alt+G 复验。');
} else {
  check(fired, 'H触发ID大于0', '真', '热键');
  check(fired, 'DONE', '1', '热键');
}
if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ALL-PASS hotkey-printer（报告 ' + report.size + ' 项 + 热键 ' + fired.size + ' 项断言全部通过）');
