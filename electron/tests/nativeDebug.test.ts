import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NativeDebugService, type DebugConnection } from '../src/services/debug/nativeDebugService';
import { mapSourceBreakpointsForDebug } from '../src/services/debug/sourceBreakpointMapper';

class FakeConnection extends EventEmitter implements DebugConnection {
  requests: Array<{ command: string; args: any }> = []; terminated = false;
  async request<T = any>(command: string, args?: unknown): Promise<T> {
    this.requests.push({ command, args });
    if (command === 'launch' || command === 'attach') queueMicrotask(() => this.emit('event:initialized', {}));
    if (command === 'setBreakpoints') return { breakpoints: (args as any).breakpoints.map((item: any, index: number) => ({ id: index + 1, verified: true, line: item.line })) } as T;
    if (command === 'threads') return { threads: [{ id: 7, name: '主线程' }, { id: 8, name: '工作线程' }] } as T;
    if (command === 'stackTrace') return { stackFrames: [{ id: 70, name: 'main', line: 2, column: 3, source: { path: 'demo.cpp', name: 'demo.cpp' } }, { id: 71, name: 'caller', line: 10, column: 1 }] } as T;
    if (command === 'scopes') return { scopes: [{ name: '局部变量', variablesReference: 700, expensive: false }, { name: 'Registers', presentationHint: 'registers', variablesReference: 900, expensive: false }] } as T;
    if (command === 'variables') return { variables: (args as any).variablesReference === 900 ? [{ name: 'rax', value: '0x10', variablesReference: 0 }] : [{ name: 'value', value: '3', type: 'int', evaluateName: 'value', variablesReference: 701, memoryReference: '0x1000' }, { name: 'flag', value: 'true', type: 'bool', variablesReference: 0 }] } as T;
    if (command === 'evaluate') return { result: '4', type: 'int', variablesReference: 0 } as T;
    if (command === 'readMemory') return { address: '0x1000', data: Buffer.from([0x48, 0x89, 0xe5]).toString('base64'), unreadableBytes: 1 } as T;
    if (command === 'disassemble') return { instructions: [{ address: '0x1000', instruction: 'push rbp', symbol: 'main' }] } as T;
    return {} as T;
  }
  waitForEvent<T = any>(event: string): Promise<T> { return new Promise(resolve => this.once(`event:${event}`, resolve)); }
  respond() {}
  terminate() { this.terminated = true; this.emit('close', new Error('terminated')); }
}

test('native debug service configures verified ordinary/conditional breakpoints and controls stopped threads', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-debug-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const program = path.join(root, 'demo.exe'); const source = path.join(root, 'demo.cpp'); await fs.writeFile(program, 'exe'); await fs.writeFile(source, 'line1\nline2\n');
  const connection = new FakeConnection(); const service = new NativeDebugService(root, { resolveAdapter: async () => 'fake-adapter.exe', createConnection: () => connection });
  const started = await service.start({ program, breakpoints: [{ sourcePath: source, line: 1 }, { sourcePath: source, line: 2, condition: 'value == 1' }] });
  assert.equal(started.state, 'running'); assert.equal(started.breakpoints.every(item => item.verified), true);
  assert.equal((connection.requests.find(item => item.command === 'setBreakpoints')?.args.breakpoints[1]).condition, 'value == 1');
  connection.emit('event', { type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 7 } });
  assert.equal(service.getSnapshot()?.state, 'stopped');
  const inspection = await service.inspect(); assert.deepEqual(inspection.threads.map(item => item.name), ['主线程', '工作线程']);
  assert.equal(inspection.stackFrames[0].name, 'main'); assert.equal(inspection.scopes[0].variables[0].value, '3');
  assert.equal((await service.variables(701))[1].name, 'flag'); assert.equal((await service.evaluate('value + 1', 70)).result, '4');
  await service.next();
  assert.equal(connection.requests.at(-1)?.command, 'next');
  connection.emit('event', { type: 'event', event: 'stopped', body: { reason: 'step', threadId: 7 } }); await service.continue();
  assert.equal(connection.requests.at(-1)?.command, 'continue'); await service.stop(); assert.equal(service.getSnapshot()?.state, 'terminated');
});

test('advanced debug supports attach, dump, remote, registers, memory and disassembly', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-debug-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const program = path.join(root, 'demo.exe'); const dump = path.join(root, 'demo.dmp'); await fs.writeFile(program, 'exe'); await fs.writeFile(dump, 'dump');
  for (const mode of ['attach', 'dump', 'remote'] as const) {
    const connection = new FakeConnection(); const service = new NativeDebugService(root, { resolveAdapter: async () => 'lldb-dap.exe', createConnection: () => connection });
    if (mode === 'attach') await service.attach({ pid: 123, program });
    else if (mode === 'dump') await service.openDump({ program, coreFile: dump });
    else await service.connectRemote({ program, host: 'localhost', port: 1234 });
    const attach = connection.requests.find(item => item.command === 'attach')?.args;
    if (mode === 'attach') assert.equal(attach.pid, 123); if (mode === 'dump') assert.equal(attach.coreFile, dump);
    if (mode === 'remote') assert.deepEqual([attach['gdb-remote-host'], attach['gdb-remote-port']], ['localhost', 1234]);
    connection.emit('event', { type: 'event', event: 'stopped', body: { reason: 'pause', threadId: 7 } });
    assert.equal((await service.registers(70))[0].name, 'rax'); assert.deepEqual((await service.readMemory('0x1000', 0, 3)).bytes, [0x48, 0x89, 0xe5]);
    assert.equal((await service.disassemble('0x1000', 0, 1))[0].instruction, 'push rbp'); await service.stop();
  }
});

test('native debug service rejects path escapes, invalid conditions and control while running', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-debug-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const program = path.join(root, 'demo.exe'); const source = path.join(root, 'demo.cpp'); await fs.writeFile(program, 'exe'); await fs.writeFile(source, 'x');
  const service = new NativeDebugService(root, { resolveAdapter: async () => 'fake', createConnection: () => new FakeConnection() });
  await assert.rejects(service.start({ program: path.join(root, '..', 'outside.exe') }), /工作区|ENOENT/u);
  await assert.rejects(service.start({ program, breakpoints: [{ sourcePath: source, line: 1, condition: 'bad\ncondition' }] }), /条件断点/u);
  await service.start({ program, breakpoints: [] }); await assert.rejects(service.next(), /未停在断点/u); await service.stop();
  await assert.rejects(service.inspect(), /没有可操作|暂停/u);
});

test('LingCpp breakpoints map to the narrowest generated C++ range and retain conditions', () => {
  const mapped = mapSourceBreakpointsForDebug([{ filePath: 'src/Main.lcpp', line: 12, condition: 'count > 2' }], [
    { generatedFile: 'main.cpp', generatedStartLine: 100, generatedEndLine: 120, sourceFile: 'src/Main.lcpp', sourceStartLine: 10, sourceEndLine: 20, kind: 'method', symbolName: 'run' },
    { generatedFile: 'main.cpp', generatedStartLine: 108, generatedEndLine: 109, sourceFile: 'src/Main.lcpp', sourceStartLine: 12, sourceEndLine: 12, kind: 'statement', symbolName: 'statement' }
  ], 'C:/build/src');
  assert.equal(mapped[0].line, 108); assert.equal(mapped[0].condition, 'count > 2'); assert.equal(mapped[0].clientLine, 12);
  assert.throws(() => mapSourceBreakpointsForDebug([{ filePath: 'src/Main.lcpp', line: 99 }], [], 'C:/build/src'), /无法.*映射/u);
});
