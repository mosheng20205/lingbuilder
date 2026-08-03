import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'websocket-server-native-smoke');
const newEmojiProjectDir = path.resolve(repoRoot, '.lingbuilder-build', 'websocket-server-new-emoji-native-smoke');

interface WebSocketFrame {
  opcode: number;
  final: boolean;
  payload: Buffer;
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

class RawWebSocketClient {
  private socket?: net.Socket;
  private buffered = Buffer.alloc(0);
  private frames: WebSocketFrame[] = [];
  private waiters: Array<(frame: WebSocketFrame) => void> = [];

  async connect(port: number, pathName = '/ws'): Promise<string> {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    const key = crypto.randomBytes(16).toString('base64');
    socket.write([
      `GET ${pathName} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      'Upgrade: websocket',
      'Connection: keep-alive, Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      'Origin: https://example.com',
      'Sec-WebSocket-Protocol: chat.v1, chat.v2',
      '',
      ''
    ].join('\r\n'));
    const response = await this.readHttpHeaders(socket);
    const expected = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    if (!response.startsWith('HTTP/1.1 101 ')) throw new Error(`WebSocket 握手失败：${response}`);
    if (!new RegExp(`^Sec-WebSocket-Accept: ${escapeRegExp(expected)}$`, 'imu').test(response)) throw new Error('WebSocket 握手摘要不正确。');
    socket.on('data', chunk => this.consume(chunk));
    return response;
  }

  send(opcode: number, payload: Buffer | string, final = true, masked = true): void {
    if (!this.socket) throw new Error('WebSocket 客户端尚未连接。');
    const content = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
    const header: number[] = [opcode | (final ? 0x80 : 0)];
    const maskFlag = masked ? 0x80 : 0;
    if (content.length <= 125) header.push(maskFlag | content.length);
    else if (content.length <= 65535) header.push(maskFlag | 126, (content.length >> 8) & 0xff, content.length & 0xff);
    else {
      header.push(maskFlag | 127);
      const length = BigInt(content.length);
      for (let shift = 56n; shift >= 0n; shift -= 8n) header.push(Number((length >> shift) & 0xffn));
    }
    if (!masked) {
      this.socket.write(Buffer.concat([Buffer.from(header), content]));
      return;
    }
    const mask = crypto.randomBytes(4);
    const encoded = Buffer.alloc(content.length);
    for (let index = 0; index < content.length; index++) encoded[index] = content[index] ^ mask[index % 4];
    this.socket.write(Buffer.concat([Buffer.from(header), mask, encoded]));
  }

  async nextFrame(timeoutMs = 5000): Promise<WebSocketFrame> {
    const queued = this.frames.shift();
    if (queued) return queued;
    return await new Promise<WebSocketFrame>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiters.indexOf(deliver);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error('等待 WebSocket 服务端帧超时。'));
      }, timeoutMs);
      const deliver = (frame: WebSocketFrame) => {
        clearTimeout(timeout);
        resolve(frame);
      };
      this.waiters.push(deliver);
    });
  }

  destroy(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }

  private async readHttpHeaders(socket: net.Socket): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      let received = Buffer.alloc(0);
      const timeout = setTimeout(() => reject(new Error('等待 WebSocket 握手响应超时。')), 5000);
      const onData = (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        const end = received.indexOf('\r\n\r\n');
        if (end < 0) return;
        clearTimeout(timeout);
        socket.off('data', onData);
        const remaining = received.subarray(end + 4);
        if (remaining.length) this.consume(remaining);
        resolve(received.subarray(0, end + 4).toString('utf8'));
      };
      socket.on('data', onData);
      socket.once('error', reject);
      socket.once('close', () => reject(new Error('WebSocket 握手完成前连接关闭。')));
    });
  }

  private consume(chunk: Buffer): void {
    this.buffered = Buffer.concat([this.buffered, chunk]);
    while (this.buffered.length >= 2) {
      const first = this.buffered[0];
      const second = this.buffered[1];
      let cursor = 2;
      let length = second & 0x7f;
      if (length === 126) {
        if (this.buffered.length < 4) return;
        length = this.buffered.readUInt16BE(2);
        cursor = 4;
      } else if (length === 127) {
        if (this.buffered.length < 10) return;
        const bigLength = this.buffered.readBigUInt64BE(2);
        if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('服务端帧过大。');
        length = Number(bigLength);
        cursor = 10;
      }
      const masked = (second & 0x80) !== 0;
      if (masked) cursor += 4;
      if (this.buffered.length < cursor + length) return;
      let payload = Buffer.from(this.buffered.subarray(cursor, cursor + length));
      if (masked) {
        const mask = this.buffered.subarray(cursor - 4, cursor);
        payload = Buffer.from(payload.map((value, index) => value ^ mask[index % 4]));
      }
      this.buffered = this.buffered.subarray(cursor + length);
      const frame = { opcode: first & 0x0f, final: (first & 0x80) !== 0, payload };
      const waiter = this.waiters.shift();
      if (waiter) waiter(frame);
      else this.frames.push(frame);
    }
  }
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('WebSocket 原生烟雾测试目录越出工作区。');
  const listenPort = await reserveAvailablePort();
  const enabledModules = [builtin('lingbuilder.websocket.server')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'websocket-server-native-smoke',
    name: 'WebSocket 服务端原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'WebSocket 服务端原生烟雾测试',
      width: 460, height: 220, background: '#202028', description: '验证 RFC 6455 多客户端服务端', controls: []
    }]
  };
  const source = createWebSocketSource(listenPort);
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window', lingCppSourceCode: source, lingCppSourceFilePath: 'src/MainWindow.lcpp', enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], {
      cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
    });
  }

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const executableDir = path.dirname(executable);
  const child = spawn(executable, [], { cwd: executableDir, windowsHide: true, stdio: 'ignore' });
  try {
    await waitForPort(listenPort, 10000);
    await runWebSocketProtocolChecks(listenPort);
  } finally {
    await stopChild(child);
  }

  const newEmoji = await smokeNewEmoji(msbuild);
  console.log(JSON.stringify({
    ok: true,
    win32: { projectDir, executable, port: listenPort, compiledPlatforms: ['Win32', 'x64'] },
    newEmoji,
    checks: ['handshake', 'origin', 'subprotocol', 'multi-client', 'fragmented-text', 'binary', 'ping-pong', 'mask-enforcement', 'close-handshake']
  }, null, 2));
}

function createWebSocketSource(port: number): string {
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 WebSocket服务端 服务 = WSS_创建服务()',
    `        WSS_配置服务(服务, "127.0.0.1", ${port}, 64)`,
    '        WSS_设置资源限制(服务, 64, 16, 8, 30000)',
    '        WSS_设置心跳(服务, 2000, 1000)',
    '        WSS_设置访问路径(服务, "/ws")',
    '        WSS_设置允许来源(服务, "https://example.com")',
    '        WSS_设置子协议(服务, "chat.v2, chat.v1")',
    '        WSS_绑定消息处理器(服务, &收到客户端消息)',
    '        WSS_启动(服务)',
    '    结束',
    '    事件 收到客户端消息()',
    '        如果 (WSS_取当前消息类型() == "文本")',
    '            WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本())',
    '        否则',
    '            WSS_发送二进制给客户端(WSS_取当前客户端(), WSS_取当前二进制())',
    '        如果结束',
    '    结束',
    '结束类'
  ].join('\n');
}

async function runWebSocketProtocolChecks(port: number): Promise<void> {
  const clients: RawWebSocketClient[] = [];
  try {
    const first = new RawWebSocketClient();
    const second = new RawWebSocketClient();
    clients.push(first, second);
    const response = await first.connect(port);
    await second.connect(port);
    if (!/^Sec-WebSocket-Protocol: chat\.v2$/imu.test(response)) throw new Error('服务端没有按优先级协商 chat.v2 子协议。');

    const utf8 = Buffer.from('分片中文消息', 'utf8');
    first.send(0x1, utf8.subarray(0, 5), false);
    first.send(0x0, utf8.subarray(5), true);
    const textEcho = await first.nextFrame();
    if (textEcho.opcode !== 0x1 || textEcho.payload.toString('utf8') !== '分片中文消息') {
      throw new Error(`文本分片回显失败：opcode=${textEcho.opcode}，final=${textEcho.final}，payload=${textEcho.payload.toString('hex')}，text=${JSON.stringify(textEcho.payload.toString('utf8'))}。`);
    }

    const binary = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
    second.send(0x2, binary);
    const binaryEcho = await second.nextFrame();
    if (binaryEcho.opcode !== 0x2 || !binaryEcho.payload.equals(binary)) throw new Error('二进制消息回显失败。');

    first.send(0x9, 'ping-data');
    const pong = await first.nextFrame();
    if (pong.opcode !== 0xA || pong.payload.toString('utf8') !== 'ping-data') throw new Error('Ping/Pong 控制帧处理失败。');

    const invalid = new RawWebSocketClient();
    clients.push(invalid);
    await invalid.connect(port);
    invalid.send(0x1, 'unmasked', true, false);
    const protocolClose = await invalid.nextFrame();
    if (protocolClose.opcode !== 0x8 || protocolClose.payload.readUInt16BE(0) !== 1002) throw new Error('未掩码客户端帧没有触发 1002 协议关闭。');

    first.send(0x8, Buffer.from([0x03, 0xE8]));
    const close = await first.nextFrame();
    if (close.opcode !== 0x8 || close.payload.readUInt16BE(0) !== 1000) throw new Error('关闭握手响应失败。');
  } finally {
    for (const client of clients) client.destroy();
  }
}

async function smokeNewEmoji(msbuild: string) {
  if (!newEmojiProjectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('New_Emoji WebSocket 烟雾测试目录越出工作区。');
  const port = await reserveAvailablePort();
  const installPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  const enabledModules: InstalledModule[] = [
    {
      manifest,
      installPath,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    },
    builtin('lingbuilder.websocket.server')
  ];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'websocket-server-new-emoji-native-smoke',
    name: 'New_Emoji WebSocket 服务端原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'New_Emoji WebSocket 服务端原生烟雾测试',
      designerBackend: 'new-emoji', width: 460, height: 220, background: '#202028', description: '验证 New_Emoji WebSocket UI 线程事件', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window', lingCppSourceCode: createWebSocketSource(port), lingCppSourceFilePath: 'src/MainWindow.lcpp', enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(newEmojiProjectDir, { recursive: true, force: true });
  await fs.mkdir(newEmojiProjectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(newEmojiProjectDir, file.relativePath);
    if (!target.startsWith(`${newEmojiProjectDir}${path.sep}`)) throw new Error(`New_Emoji 生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, newEmojiProjectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: newEmojiProjectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: newEmojiProjectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(newEmojiProjectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  try {
    await waitForPort(port, 10000);
    await runWebSocketProtocolChecks(port);
  } finally {
    await stopChild(child);
  }
  return { projectDir: newEmojiProjectDir, executable, port, compiledPlatforms: ['x64'] };
}

async function stopChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill();
  if (child.exitCode !== null) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 3000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function reserveAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配 WebSocket 原生烟雾测试端口。');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (connected) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`等待 WebSocket 服务端监听端口 ${port} 超时。`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
