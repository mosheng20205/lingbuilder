// P2 浏览器实测用的本地 mock 云端 API（仅本地验证，不参与生产）。
// 用法：node tests/sdk-catalog-mock-server.mjs  → 监听 127.0.0.1:17900
// 登录邮箱决定角色：super@admin → super_admin；support@admin → support；其他 → operator。
import http from 'node:http';

const seedResources = [
  {
    id: 'cef3-sdk', moduleId: 'lingbuilder.fbro.sdk', name: 'CEF3 运行时（按需下载）', platform: 'windows-x64',
    requiredModuleIds: ['lingbuilder.fbro.browser'], criticalFiles: ['libcef.dll', 'chrome_elf.dll', 'v8_context_snapshot.bin'],
    version: '127.0.0', sdkVersion: '0.6.0', archiveName: 'cef3-runtime-127.0.0.7z', downloadUrl: 'https://msimgimg.xyz/sdk/cef3-runtime-127.0.0.7z',
    archiveBytes: 186457476, sha256: 'b984477a0000000000000000000000000000000000000000000000000000dc55', fileCount: 182, expandedBytes: 512000000
  },
  {
    id: 'fbro-sdk', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro VIP 运行时（按需下载）', platform: 'windows-x64',
    requiredModuleIds: ['lingbuilder.fbro.browser'], criticalFiles: ['FBrowserCEF3lib.dll', 'FBrowserVIP.dll'],
    version: '5.0.2', sdkVersion: '0.6.0', archiveName: 'fbro-vip-5.0.2.7z', downloadUrl: 'https://msimgimg.xyz/sdk/fbro-vip-5.0.2.7z',
    archiveBytes: 245575922, sha256: '99ed17b20000000000000000000000000000000000000000000000000000361f', fileCount: 96, expandedBytes: 640000000
  }
];

const state = {
  sequence: 3,
  manifest: {
    payload: JSON.stringify({ schemaVersion: 1, sequence: 3, resources: seedResources }),
    keyId: 'a1b2c3d4e5f60718',
    signature: 'mock-signature-not-verified-by-admin',
    publishedAt: new Date(Date.now() - 86400000).toISOString()
  },
  releases: [
    { id: 'r3', sequence: 3, keyId: 'a1b2c3d4e5f60718', note: '初始化导入内置清单', createdBy: 'super@admin', createdAt: new Date(Date.now() - 86400000).toISOString(), payloadBytes: 1200 }
  ]
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

const json = (res, code, value) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...cors }); res.end(JSON.stringify(value)); };
const readBody = req => new Promise(resolve => { let data = ''; req.on('data', chunk => { data += chunk; }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method === 'POST' && url.pathname === '/v1/auth/login') {
    const body = await readBody(req);
    const role = body.email === 'super@admin' ? 'super_admin' : body.email === 'support@admin' ? 'support' : 'operator';
    return json(res, 200, { accessToken: `mock-${role}`, refreshToken: `mock-refresh-${role}`, user: { id: 'user-1', email: body.email, role, mfa: true } });
  }
  if (req.method === 'POST' && url.pathname === '/v1/auth/token/refresh') {
    const body = await readBody(req);
    const role = String(body.refreshToken || '').includes('super') ? 'super_admin' : String(body.refreshToken || '').includes('support') ? 'support' : 'operator';
    return json(res, 200, { accessToken: `mock-${role}`, refreshToken: `mock-refresh-${role}` });
  }
  if (url.pathname === '/v1/me') {
    const role = String(req.headers.authorization || '').includes('super_admin') ? 'super_admin' : String(req.headers.authorization || '').includes('support') ? 'support' : 'operator';
    return json(res, 200, { ok: true, user: { id: 'user-1', email: `${role}@admin`, role, mfa: true } });
  }
  if (url.pathname === '/v1/site/sdk-catalog') return json(res, 200, { ok: true, manifest: state.manifest });
  if (url.pathname === '/v1/admin/site/sdk-catalog/history') return json(res, 200, { ok: true, releases: state.releases });
  if (req.method === 'POST' && url.pathname === '/v1/admin/site/sdk-catalog') {
    const role = String(req.headers.authorization || '').includes('super_admin') ? 'super_admin' : String(req.headers.authorization || '').includes('support') ? 'support' : 'operator';
    if (role === 'support' || role === 'auditor') return json(res, 403, { message: '当前角色无权发布 SDK 下载清单。' });
    const body = await readBody(req);
    if (!Array.isArray(body.resources) || !body.resources.length) return json(res, 400, { message: '资源列表不能为空。' });
    state.sequence += 1;
    const payload = JSON.stringify({ schemaVersion: 1, sequence: state.sequence, resources: body.resources });
    state.manifest = { payload, keyId: 'a1b2c3d4e5f60718', signature: 'mock-signature-not-verified-by-admin', publishedAt: new Date().toISOString() };
    state.releases.unshift({ id: `r${state.sequence}`, sequence: state.sequence, keyId: state.manifest.keyId, note: body.note || null, createdBy: `${role}@admin`, createdAt: state.manifest.publishedAt, payloadBytes: payload.length });
    return json(res, 200, { ok: true, manifest: state.manifest });
  }
  if (url.pathname === '/v1/admin/site/r2-upload/config') return json(res, 200, { endpoint: 'http://127.0.0.1:17900/mock-r2', token: 'mock' });
  if (url.pathname.startsWith('/v1/admin/')) return json(res, 200, {});
  return json(res, 404, { message: 'mock 未实现该端点' });
}).listen(17900, '127.0.0.1', () => console.log('mock cloud api on http://127.0.0.1:17900'));
