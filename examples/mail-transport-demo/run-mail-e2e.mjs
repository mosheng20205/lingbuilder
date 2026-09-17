// 启动本地 POP3/IMAP/SMTP 回放服务 → 运行演示 exe → 校验三份报告/抓包 → 清理。
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const binDir = process.argv[2];
if (!binDir) { console.error('用法：node run-mail-e2e.mjs <bin目录>'); process.exit(2); }

const stubs = spawn(process.execPath, [new URL('./stub-servers.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const exe = path.join(binDir, 'LingBuilderPreview.exe');
const proc = spawn(exe, [], { cwd: binDir, stdio: 'ignore' });
let exited = 0;
proc.on('exit', c => { exited = c ?? 0; });

await new Promise(r => setTimeout(r, 6000));
try { execSync(`taskkill /F /IM LingBuilderPreview.exe`, { stdio: 'ignore' }); } catch {}
try { proc.kill(); } catch {}

await new Promise(r => setTimeout(r, 500));
stubs.kill();

let failures = 0;
const values = new Map();
for (const report of ['mail-transport-report.txt']) {
  const full = path.join(binDir, report);
  if (!fs.existsSync(full)) { failures++; console.error(`FAIL: ${report} 缺失`); continue; }
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
}
function check(key, expected) {
  if (values.get(key) !== expected) { failures++; console.error(`FAIL ${key}: 期望 [${expected}] 实际 [${values.get(key)}]`); }
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

let smtpOk = 0;
for (const file of fs.readdirSync(binDir)) {
  if (!file.startsWith('smtp-captured-')) continue;
  const content = fs.readFileSync(path.join(binDir, file), 'utf8');
  if (content.includes('text/html') && content.includes('<b>LB_HTML_OK</b>') && content.includes('=?UTF-8?B?')) smtpOk++;
  if (content.includes('attachment') && content.includes(Buffer.from('LB_ATTACHMENT_CONTENT').toString('base64'))) smtpOk++;
}
if (smtpOk < 2) { failures++; console.error(`FAIL SMTP 抓包断言不足：${smtpOk}/2`); }

const attachPath = path.join(binDir, 'pop3-attachment.bin');
if (fs.existsSync(attachPath) && fs.readFileSync(attachPath, 'utf8') === 'LB_ATTACHMENT_CONTENT') { /* ok */ }
else { failures++; console.error('FAIL POP3 附件内容不符'); }

if (failures) { console.error(`MAIL-E2E FAIL：${failures} 项`); process.exit(1); }
console.log('ALL-PASS mail-transport（报告与抓包断言全部通过）');
