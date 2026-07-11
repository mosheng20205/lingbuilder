import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CloudCliClient {
  private accessToken = '';
  constructor(private readonly origin = process.env.LINGBUILDER_CLOUD_API_URL || 'http://127.0.0.1:17900', private readonly store = new WindowsDpapiCredentialStore()) {}
  async login(log: (value: string) => void) {
    const code = await this.publicRequest('/v1/auth/device/code', { deviceName: `LingBuilder CLI @ ${os.hostname()}` });
    log(`请在浏览器中打开 ${code.verificationUri} 并输入设备码：${code.userCode}`); await openBrowser(code.verificationUri);
    const deadline = Date.now() + Number(code.expiresIn) * 1000;
    while (Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, Number(code.interval || 5) * 1000)); try { const tokens = await this.publicRequest('/v1/auth/device/token', { deviceCode: code.deviceCode }); await this.store.write(tokens.refreshToken); this.accessToken = tokens.accessToken; return { ok: true, message: 'LingBuilder CLI 登录成功。' }; } catch (error: any) { if (!/等待用户确认/u.test(error?.message || '')) throw error; } }
    throw new Error('设备登录已超时。');
  }
  async logout() { const refreshToken = await this.store.read(); if (refreshToken) await this.publicRequest('/v1/auth/logout', { refreshToken }).catch(() => undefined); await this.store.clear(); this.accessToken = ''; return { ok: true }; }
  async status() { try { await this.ensureAccess(); const value = await this.request('/v1/me'); return { authenticated: true, user: value.user }; } catch { return { authenticated: false }; } }
  async models() { await this.ensureAccess(); return await this.request('/v1/ai/models'); }
  async balance() { await this.ensureAccess(); return await this.request('/v1/usage/balance'); }
  async *chat(modelAlias: string, prompt: string): AsyncGenerator<any> { await this.ensureAccess(); const response = await fetch(`${this.origin}/v1/ai/chat/stream`, { method: 'POST', headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ modelAlias, messages: [{ role: 'user', content: prompt }], rulebookVersion: 'lingbuilder-rulebook-v1' }) }); if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).message || '系统 AI 请求失败。'); yield* parseSse(response.body); }
  private async ensureAccess() { if (this.accessToken) return; const refreshToken = await this.store.read(); if (!refreshToken) throw new Error('尚未登录，请先运行 lingbuilder auth login。'); const value = await this.publicRequest('/v1/auth/refresh', { refreshToken }); await this.store.write(value.refreshToken); this.accessToken = value.accessToken; }
  private async request(pathName: string) { const response = await fetch(`${this.origin}${pathName}`, { headers: { authorization: `Bearer ${this.accessToken}` } }); const value = await response.json(); if (!response.ok) throw new Error(value.message || 'LingBuilder 云端请求失败。'); return value; }
  private async publicRequest(pathName: string, body: unknown) { const response = await fetch(`${this.origin}${pathName}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const value = await response.json(); if (!response.ok) throw new Error(value.message || 'LingBuilder 云端请求失败。'); return value; }
}

export class WindowsDpapiCredentialStore {
  private readonly filePath = path.join(process.env.APPDATA || os.homedir(), 'LingBuilder', 'credentials', 'cli-refresh-token.dpapi');
  async write(value: string) { if (process.platform !== 'win32') throw new Error('当前 CLI 版本只允许在 Windows DPAPI 中持久化登录凭据。'); const encrypted = await runPowerShellDpapi('protect', value); await fs.mkdir(path.dirname(this.filePath), { recursive: true }); const temporary = `${this.filePath}.${process.pid}.tmp`; await fs.writeFile(temporary, encrypted, { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, this.filePath); }
  async read() { try { const encrypted = await fs.readFile(this.filePath, 'utf8'); return await runPowerShellDpapi('unprotect', encrypted); } catch (error: any) { if (error?.code === 'ENOENT') return ''; throw error; } }
  async clear() { await fs.rm(this.filePath, { force: true }); }
}

async function runPowerShellDpapi(operation: 'protect'|'unprotect', input: string): Promise<string> {
  const script = operation === 'protect'
    ? '$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p))'
    : '$v=[Console]::In.ReadToEnd();$b=[Convert]::FromBase64String($v);$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))';
  return await new Promise<string>((resolve, reject) => { const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout='';let stderr='';child.stdout.setEncoding('utf8').on('data',chunk=>stdout+=chunk);child.stderr.setEncoding('utf8').on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr||`Windows DPAPI 失败，代码 ${code}`)));child.stdin.end(input); });
}
async function openBrowser(url: string) { if (process.platform === 'win32') await execFileAsync('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true }); }
async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> { const reader=stream.getReader();const decoder=new TextDecoder();let buffer='';try{while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const events=buffer.split(/\r?\n\r?\n/u);buffer=events.pop()||'';for(const raw of events){const data=raw.split(/\r?\n/u).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');if(data)yield JSON.parse(data)}}}finally{reader.releaseLock()}}
