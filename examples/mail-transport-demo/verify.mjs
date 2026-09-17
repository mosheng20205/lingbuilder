// 校验邮件传输演示：mail-transport-report.txt + ini-enum-report.txt + SMTP 抓包。
// 用法：node verify.mjs <bin目录>
import fs from 'node:fs';
import path from 'node:path';

const binDir = process.argv[2];
if (!binDir) {
  console.error('用法：node verify.mjs <bin目录>');
  process.exit(2);
}
const failures = [];
const values = new Map();
for (const report of ['mail-transport-report.txt']) {
  const full = path.join(binDir, report);
  if (!fs.existsSync(full)) { failures.push(`${report} 缺失`); continue; }
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
}
function check(key, expected) {
  const actual = values.get(key);
  if (actual !== expected) failures.push(`${key}: 期望 [${expected}] 实际 [${actual}]`);
}
check('S发送HTML', '真');
check('S发送附件', '真');
check('P连接', '真');
check('P数量', '1');
check('P收信', '真');
check('P主题', '测试邮件');
check('P正文', 'LB_POP3_BODY');
check('P附件数', '1');
check('P附件落盘', '真');
check('I连接', '真');
check('I数量', '1');
check('I收信', '真');
check('I主题', '测试邮件');
check('I节数', '2');
check('I键数', '1');
check('DONE', '1');

// SMTP 抓包断言
const capturedDir = binDir;
let htmlData = '', attachData = '';
for (const file of fs.readdirSync(capturedDir)) {
  if (!file.startsWith('smtp-captured-')) continue;
  const content = fs.readFileSync(path.join(capturedDir, file), 'utf8');
  if (content.includes('text/html')) htmlData = content;
  else if (content.includes('attachment')) attachData = content;
}
if (!htmlData.includes('<b>LB_HTML_OK</b>')) failures.push('SMTP HTML 抓包缺少正文标记');
if (!htmlData.includes('=?UTF-8?B?')) failures.push('SMTP HTML 抓包缺少主题编码字');
if (!attachData.includes('Content-Disposition: attachment')) failures.push('SMTP 附件抓包缺少附件头');
if (!attachData.includes(Buffer.from('LB_ATTACHMENT_CONTENT').toString('base64'))) failures.push('SMTP 附件抓包缺少附件内容');

if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ALL-PASS mail-transport（' + values.size + ' 项报告断言 + SMTP 抓包 4 项全部通过）');
