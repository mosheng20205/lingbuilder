import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

interface ExtensionInput { id: string; root: string; main: string; activationEvents: string[]; permissions: string[] }
const extensions = new Map<string, ExtensionInput>(); const active = new Set<string>(); const commands = new Map<string, { extensionId: string; callback: (...args: any[]) => any }>(); const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>(); let sequence = 1;

process.on('message', message => void handle(message as any));
send({ type: 'ready' });
async function handle(message: any) {
  if (message.type === 'response') { const item = pending.get(message.id); if (!item) return; pending.delete(message.id); message.error ? item.reject(new Error(message.error)) : item.resolve(message.result); return; }
  if (message.type === 'initialize') { extensions.clear(); for (const item of message.extensions || []) extensions.set(item.id, item); send({ type: 'ready' }); return; }
  if (message.type === 'activate') { try { await activateForEvent(message.event); respond(message.id, { active: [...active] }); } catch (error) { fail(message.id, error); } return; }
  if (message.type === 'execute') { try { await activateForEvent(`onCommand:${message.command}`); const item = commands.get(message.command); if (!item) throw new Error(`扩展命令 ${message.command} 尚未注册。`); const result = await Promise.resolve(item.callback(...(message.args || []))); respond(message.id, result); } catch (error) { fail(message.id, error); } return; }
  if (message.type === 'shutdown') process.exit(0);
}
async function activateForEvent(event: string) { for (const extension of extensions.values()) if (!active.has(extension.id) && extension.activationEvents.some(value => value === '*' || value === event || (value.startsWith('workspaceContains:') && event === value))) await activate(extension); }
async function activate(extension: ExtensionInput) {
  const main = path.resolve(extension.root, extension.main); const relative = path.relative(extension.root, main); if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('扩展入口越界。'); const source = await fs.readFile(main, 'utf8'); const module = { exports: {} as any };
  const sandbox = vm.createContext({ console: Object.freeze({ log: (...args: any[]) => send({ type: 'log', extensionId: extension.id, message: args.map(String).join(' ') }), warn: (...args: any[]) => send({ type: 'log', extensionId: extension.id, message: args.map(String).join(' ') }), error: (...args: any[]) => send({ type: 'log', extensionId: extension.id, message: args.map(String).join(' ') }) }), setTimeout, clearTimeout, URL, TextEncoder, TextDecoder });
  const wrapper = new vm.Script(`(function(exports,module,require){"use strict";\n${source}\n})`, { filename: main }).runInContext(sandbox, { timeout: 5000 }); const deniedRequire = (name: string) => { throw new Error(`扩展无权加载 Node 模块：${name}`); }; wrapper(module.exports, module, deniedRequire);
  if (typeof module.exports.activate !== 'function') throw new Error('扩展入口必须导出 activate(context)。');
  const context = Object.freeze({ extensionId: extension.id, subscriptions: [], commands: Object.freeze({ registerCommand: (command: string, callback: (...args: any[]) => any) => { if (typeof command !== 'string' || typeof callback !== 'function') throw new Error('registerCommand 参数无效。'); commands.set(command, { extensionId: extension.id, callback }); return Object.freeze({ dispose: () => commands.delete(command) }); } }), workspace: Object.freeze({ readTextFile: (filePath: string) => hostCall(extension.id, 'workspace.readTextFile', { filePath }), writeTextFile: (filePath: string, content: string) => hostCall(extension.id, 'workspace.writeTextFile', { filePath, content }) }), window: Object.freeze({ showInformationMessage: (message: string) => hostCall(extension.id, 'window.showInformationMessage', { message }) }) });
  await Promise.resolve(module.exports.activate(context)); active.add(extension.id); send({ type: 'activated', extensionId: extension.id });
}
function hostCall(extensionId: string, method: string, params: any) { const id = sequence++; send({ type: 'hostCall', id, extensionId, method, params }); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
function respond(id: number, result: any) { send({ type: 'result', id, result }); } function fail(id: number, error: unknown) { send({ type: 'result', id, error: error instanceof Error ? error.message : String(error) }); }
function send(message: any) { process.send?.(message); }
