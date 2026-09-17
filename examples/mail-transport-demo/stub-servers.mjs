// 本地邮件回放服务：POP3(1110) + IMAP(1143) + SMTP(1025)，用于 e2e 验证。
// 启动：node stub-servers.mjs（抓包与日志写到当前工作目录）
import net from 'node:net';
import fs from 'node:fs';

const ATTACHMENT_TEXT = 'LB_ATTACHMENT_CONTENT';
const ATTACHMENT_B64 = Buffer.from(ATTACHMENT_TEXT).toString('base64');
const SUBJECT_B64 = Buffer.from('测试邮件', 'utf8').toString('base64');

function messageRfc822() {
  return [
    'From: sender@example.com',
    'To: user@example.com',
    `Subject: =?UTF-8?B?${SUBJECT_B64}?=`,
    'Date: Wed, 16 Sep 2026 10:00:00 +0800',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="LB_STUB_BOUNDARY"',
    '',
    '--LB_STUB_BOUNDARY',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    'LB_POP3_BODY',
    '--LB_STUB_BOUNDARY',
    'Content-Type: application/octet-stream; name="attach.bin"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="attach.bin"',
    '',
    ATTACHMENT_B64,
    '--LB_STUB_BOUNDARY--',
    ''
  ].join('\r\n');
}

function safe(handler) {
  return socket => {
    socket.on('error', () => {});
    handler(socket);
  };
}

// ---- POP3 ----
const pop3 = net.createServer(safe(socket => {
  socket.write('+OK LB stub POP3 ready\r\n');
  socket.on('data', chunk => {
    for (const line of chunk.toString('utf8').split('\r\n').filter(Boolean)) {
      const upper = line.toUpperCase();
      if (upper.startsWith('USER') || upper.startsWith('PASS')) socket.write('+OK\r\n');
      else if (upper.startsWith('STAT')) socket.write('+OK 1 500\r\n');
      else if (upper.startsWith('LIST')) socket.write('+OK 1 500\r\n1 500\r\n.\r\n');
      else if (upper.startsWith('RETR')) {
        socket.write('+OK 500 octets\r\n');
        const stuffed = messageRfc822().split('\r\n').map(l => l.startsWith('.') ? '.' + l : l).join('\r\n');
        try { fs.writeFileSync(process.cwd() + '/retr-payload.txt', stuffed); } catch {}
        socket.write(stuffed);
        socket.write('.\r\n');
      }
      else if (upper.startsWith('DELE') || upper.startsWith('RSET')) socket.write('+OK\r\n');
      else if (upper.startsWith('QUIT')) { socket.write('+OK bye\r\n'); socket.end(); }
      else socket.write('+OK\r\n');
    }
  });
  socket.on('error', () => {});
}));
pop3.on('error', () => {});
pop3.listen(1110, '127.0.0.1');

// ---- IMAP ----
const imap = net.createServer(safe(socket => {
  socket.write('* OK LB stub IMAP ready\r\n');
  socket.on('data', chunk => {
    for (const line of chunk.toString('utf8').split('\r\n').filter(Boolean)) {
      const tag = line.split(' ')[0];
      const rest = line.slice(tag.length + 1).toUpperCase();
      if (rest.startsWith('LOGIN')) socket.write(`${tag} OK logged in\r\n`);
      else if (rest.startsWith('SELECT')) socket.write(`* 1 EXISTS\r\n* 0 RECENT\r\n${tag} OK selected\r\n`);
      else if (rest.startsWith('FETCH')) {
        const body = messageRfc822();
        socket.write(`* 1 FETCH (BODY[] {${Buffer.byteLength(body)}}\r\n${body})\r\n`);
        socket.write(`${tag} OK fetched\r\n`);
      }
      else if (rest.startsWith('NOOP')) socket.write(`${tag} OK noop\r\n`);
      else if (rest.startsWith('LOGOUT')) { socket.write(`* BYE\r\n${tag} OK bye\r\n`); socket.end(); }
      else socket.write(`${tag} OK\r\n`);
    }
  });
  socket.on('error', () => {});
}));
imap.on('error', () => {});
imap.listen(11143, '127.0.0.1');

// ---- SMTP ----
let smtpCaptureSeq = 0;
const smtp = net.createServer(safe(socket => {
  const _write = (t) => { try { fs.appendFileSync(process.cwd() + '/stub-log.txt', 'S ' + String(t).replace(/\r/g, '|').replace(/\n/g, '') + '\r\n'); } catch (e3) {} socket.write(t); };
  _write('220 LB stub SMTP ready\r\n');
  let authStage = 0;
  let buffer = '';
  let inData = false;
  let captured = '';
  let captureIndex = ++smtpCaptureSeq;
  socket.on('data', chunk => {
    buffer += chunk.toString('utf8');
    for (;;) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end < 0) break;
        captured += buffer.slice(0, end + 2) + '\r\n';
        buffer = buffer.slice(end + 5);
        inData = false;
        _write('250 accepted\r\n');
      } else {
        const end = buffer.indexOf('\r\n');
        if (end < 0) break;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        try { fs.appendFileSync(process.cwd() + '/stub-log.txt', 'C ' + line + '\r\n'); } catch (e2) {}
        const upper = line.toUpperCase();
        if (authStage === 1 || authStage === 2) {
          _write(authStage === 1 ? '334\r\n' : '235 ok\r\n');
          authStage = authStage === 1 ? 2 : 0;
        } else if (upper.startsWith('EHLO') || upper.startsWith('HELO') || upper.startsWith('MAIL') || upper.startsWith('RCPT')) {
          _write('250 ok\r\n');
        } else if (upper.startsWith('AUTH LOGIN')) {
          authStage = 1;
          _write('334\r\n');
        } else if (upper.startsWith('DATA')) {
          inData = true;
          _write('354 end with .\r\n');
        } else if (upper.startsWith('QUIT')) {
          _write('221 bye\r\n');
          socket.end();
        } else {
          _write('250 ok\r\n');
        }
      }
    }
    if (captured) {
      captureIndex += 1;
      fs.writeFileSync(process.cwd() + '/smtp-captured-' + captureIndex + '.txt', captured, 'utf8');
      captured = '';
    }
  });
  socket.on('error', () => {});
}));
smtp.on('error', () => {});
smtp.listen(1025, '127.0.0.1');

console.log('stubs ready: POP3 :1110, IMAP :1143, SMTP :1025');
setInterval(() => {}, 60000);
