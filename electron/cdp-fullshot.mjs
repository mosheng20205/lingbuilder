import { writeFileSync } from 'fs';
const ws = new WebSocket(process.argv[2]);
let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
ws.onopen = async () => {
  try {
    await send('Page.enable');
    const res = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('T:/electron/lingbuilder/.deploy/current-state.png', Buffer.from(res.data, 'base64'));
    console.log('saved');
  } catch (e) { console.error('FAIL', e.message); }
  ws.close();
};
