import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findOpenDebugAdapter, NativeDebugService } from '../src/services/debug/nativeDebugService';

test('real lldb-dap launches a native program, hits breakpoint, steps, hits condition and exits', { skip: process.platform !== 'win32', timeout: 60_000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-real-debug-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'debug.cpp'); const program = path.join(root, 'debug.exe');
  await fs.writeFile(source, ['int main() {', '  volatile int value = 0;', '  value += 1;', '  value += 2;', '  value += 0;', '  return value == 3 ? 0 : 1;', '}'].join('\r\n'), 'utf8');
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await promisify(execFile)(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) return t.skip('未找到 MSVC 工具链。');
  const vcvars = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  await promisify(execFile)('cmd.exe', ['/d', '/c', `call "${vcvars}" >nul && cl /nologo /EHsc /Od /Zi "${source}" /Fe:"${program}" /Fd:"${path.join(root, 'debug.pdb')}" /link /DEBUG /INCREMENTAL:NO`], { cwd: root, windowsHide: true, windowsVerbatimArguments: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  const adapter = await findOpenDebugAdapter(); assert.match(adapter, /lldb-dap\.exe$/iu);
  const service = new NativeDebugService(root, { resolveAdapter: async () => adapter }); t.after(() => service.stop());
  const started = await service.start({ program, cwd: root, breakpoints: [{ sourcePath: source, line: 3 }, { sourcePath: source, line: 5, condition: 'value == 3' }] });
  assert.equal(started.breakpoints.every(item => item.verified), true);
  await waitForState(service, 'stopped');
  const inspection = await service.inspect();
  assert.ok(inspection.threads.length >= 1); assert.ok(inspection.stackFrames.some(frame => frame.name.includes('main'))); assert.ok(inspection.scopes.length >= 1);
  const localValue = inspection.scopes.flatMap(scope => scope.variables).find(variable => variable.name === 'value');
  assert.equal(localValue?.value, '0'); assert.match((await service.evaluate('value + 10', inspection.frameId)).result, /10/u);
  const registers = await service.registers(inspection.frameId); assert.ok(registers.length > 0);
  const memoryReference = localValue?.memoryReference || inspection.stackFrames[0].instructionPointerReference; assert.ok(memoryReference);
  const memory = await service.readMemory(memoryReference!, 0, 16); assert.ok(memory.bytes.length > 0);
  const instructions = await service.disassemble(inspection.stackFrames[0].instructionPointerReference || memoryReference!, 0, 8); assert.ok(instructions.length > 0);
  const stepStopped = waitForState(service, 'stopped', service.getSnapshot()?.logs.length || 0); await service.next(); await stepStopped;
  assert.match((await service.evaluate('value', (await service.inspect()).frameId)).result, /1/u);
  const conditionStopped = waitForState(service, 'stopped', service.getSnapshot()?.logs.length || 0); await service.continue(); await conditionStopped;
  const terminated = waitForState(service, 'terminated'); await service.continue(); const final = await terminated;
  assert.equal(final.exitCode, 0);
});

async function waitForState(service: NativeDebugService, state: string, minimumLogs = -1): Promise<any> {
  const current = service.getSnapshot(); if (current?.state === state && current.logs.length > minimumLogs) return current;
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error(`等待调试状态 ${state} 超时：${JSON.stringify(service.getSnapshot())}`)); }, 15_000);
    const unsubscribe = service.subscribe(snapshot => { if (snapshot.state === state && snapshot.logs.length > minimumLogs) { clearTimeout(timeout); unsubscribe(); resolve(snapshot); } });
  });
}
