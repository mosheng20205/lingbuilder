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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJS = async expression => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 300));
  return res.result?.value;
};
const badgeState = () => evalJS(`(() => {
  const out = [];
  [...document.querySelectorAll('*')].forEach(el => {
    const t = (el.textContent || '');
    if (t.includes('DLL') && t.length <= 30) {
      const r = el.getBoundingClientRect();
      out.push({ tag: el.tagName, leaf: el.children.length === 0, text: t.trim(), codes: [...t.trim()].slice(0, 12).map(c => c.codePointAt(0)).join(','), badge: (el.textContent || '').includes('未创建'), vis: r.width > 0 });
    }
  });
  return JSON.stringify(out.slice(0, 14), null, 1);
})()`);
ws.onopen = async () => {
  try {
    await send('Runtime.enable');
    console.log(await badgeState());
  } catch (e) { console.error('FAIL', e.message); }
  ws.close();
};
