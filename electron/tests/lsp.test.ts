import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { ClangdService, type ClangdProcess } from '../src/services/lsp/clangdService';
import { JsonRpcConnection, type JsonRpcMessage } from '../src/services/lsp/jsonRpcConnection';
import { lspRangeToMonaco, markupToText, normalizeCompletionItems, normalizeLspLocations, requestLsp } from '../src/services/lsp/lspClient';
import { applyTextEdits, LspWorkspaceEditService } from '../src/services/lsp/lspWorkspaceEditService';
import { MonacoFilePathRegistry } from '../src/services/lsp/monacoFilePathRegistry';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const frame = (message: JsonRpcMessage) => { const body = Buffer.from(JSON.stringify(message)); return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]); };

test('JSON-RPC connection parses fragmented frames, correlates responses, and sends cancellation', async () => {
  const input = new PassThrough(); const output = new PassThrough(); const sent: Buffer[] = [];
  output.on('data', chunk => sent.push(Buffer.from(chunk)));
  const connection = new JsonRpcConnection(input, output);
  const request = connection.request<{ ok: boolean }>('demo/request', { value: 1 });
  const response = frame({ jsonrpc: '2.0', id: 1, result: { ok: true } });
  input.write(response.subarray(0, 9)); input.write(response.subarray(9));
  assert.deepEqual(await request, { ok: true });
  const controller = new AbortController();
  const cancelled = connection.request('slow', {}, controller.signal); controller.abort();
  await assert.rejects(cancelled, /已取消/u);
  assert.match(Buffer.concat(sent).toString(), /\$\/cancelRequest/u);
});

test('clangd session initializes, syncs versions, forwards diagnostics, and shuts down', async () => {
  const fake = new FakeClangdProcess();
  const service = new ClangdService({ workspaceRoot: process.cwd(), spawnProcess: () => fake });
  const diagnostics: unknown[] = []; service.on('diagnostics', value => diagnostics.push(value));
  assert.equal((await service.start()).state, 'ready');
  await service.openDocument('src/main.cpp', 'int main() {}');
  assert.equal(await service.changeDocument('src/main.cpp', [{ text: 'int main(){return 0;}' }]), 2);
  fake.send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri: 'file:///main.cpp', diagnostics: [{ message: 'demo' }] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(diagnostics.length, 1);
  assert.deepEqual(fake.methods.filter(method => method.startsWith('textDocument/')), ['textDocument/didOpen', 'textDocument/didChange']);
  await service.closeDocument('src/main.cpp');
  await service.stop();
  assert.equal(service.getStatus().state, 'stopped');
});

test('clangd restarts after a crash, reopens documents, and falls back when unavailable', async () => {
  const processes = [new FakeClangdProcess(), new FakeClangdProcess()]; let spawnCount = 0;
  const service = new ClangdService({ workspaceRoot: process.cwd(), restartDelayMs: 0, spawnProcess: () => processes[spawnCount++] });
  await service.openDocument('src/restart.cpp', 'int value;');
  processes[0].emit('exit', 9, null);
  await waitFor(() => service.getStatus().state === 'ready' && spawnCount === 2);
  assert.equal(service.getStatus().restartCount, 1);
  assert.ok(processes[1].methods.includes('textDocument/didOpen'));
  const missing = new ClangdService({ workspaceRoot: process.cwd(), spawnProcess: () => { const error: any = new Error('missing'); error.code = 'ENOENT'; throw error; } });
  assert.equal((await missing.start()).state, 'unavailable');
  assert.match(missing.getStatus().message, /降级/u);
  await service.stop();
});

test('LSP browser adapter maps positions, completions, hover markup, and location links', async t => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_url: any, init: any) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true, result: { items: [{ label: 'demo' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await requestLsp<any>({ method: 'textDocument/completion', filePath: 'src/main.cpp', line: 3, column: 5 });
  assert.deepEqual(requestBody.position, { line: 2, character: 4 });
  assert.deepEqual(normalizeCompletionItems(result), [{ label: 'demo' }]);
  assert.equal(markupToText([{ value: 'a' }, 'b']), 'a\n\nb');
  assert.deepEqual(lspRangeToMonaco({ start: { line: 1, character: 2 }, end: { line: 3, character: 4 } }), {
    startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5
  });
  assert.deepEqual(normalizeLspLocations({ targetUri: 'file:///a.cpp', targetSelectionRange: { start: {}, end: {} } })[0].uri, 'file:///a.cpp');
});

test('Monaco clangd path registry follows A.cpp to B.cpp switches and file renames', () => {
  const registry = new MonacoFilePathRegistry();
  const primaryEditor = {};
  const secondaryEditor = {};

  registry.bind(primaryEditor, 'lingbuilder-model://workspace/project/src/A.cpp', 'src/A.cpp');
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/A.cpp'), 'src/A.cpp');

  registry.bind(primaryEditor, 'lingbuilder-model://workspace/project/src/B.cpp', 'src/B.cpp');
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/A.cpp'), undefined);
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/B.cpp'), 'src/B.cpp');

  registry.bind(primaryEditor, 'lingbuilder-model://workspace/project/src/B.cpp', 'src/Renamed.cpp');
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/B.cpp'), 'src/Renamed.cpp');

  registry.bind(secondaryEditor, 'lingbuilder-model://workspace/project/src/B.cpp', 'src/Renamed.cpp');
  registry.release(primaryEditor);
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/B.cpp'), 'src/Renamed.cpp');
  registry.release(secondaryEditor);
  assert.equal(registry.resolve('lingbuilder-model://workspace/project/src/B.cpp'), undefined);
});

test('LSP workspace edit previews and atomically applies cross-file UTF-16 edits', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lsp-edit-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, 'a.cpp'); const second = path.join(root, 'b.hpp');
  await fs.writeFile(first, 'int oldName = 1;\r\n'); await fs.writeFile(second, 'extern int oldName;\n');
  const service = new LspWorkspaceEditService(root);
  const preview = await service.preview({ changes: {
    [pathToFileURL(first).href]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 11 } }, newText: 'newName' }],
    [pathToFileURL(second).href]: [{ range: { start: { line: 0, character: 11 }, end: { line: 0, character: 18 } }, newText: 'newName' }]
  } });
  assert.equal(preview.files.length, 2); assert.match(preview.files[0].after, /newName/u);
  await service.apply(preview.previewId);
  assert.match(await fs.readFile(first, 'utf8'), /newName/u); assert.match(await fs.readFile(second, 'utf8'), /newName/u);
});

test('LSP workspace edit rejects overlap, path escape, and stale previews without overwriting disk', async t => {
  assert.throws(() => applyTextEdits('abcdef', [
    { range: { start: { line: 0, character: 1 }, end: { line: 0, character: 4 } }, newText: 'x' },
    { range: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } }, newText: 'y' }
  ]), /重叠/u);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lsp-edit-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const inside = path.join(root, 'main.cpp'); const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.cpp`);
  await fs.writeFile(inside, 'int old;'); await fs.writeFile(outside, 'int outside;'); t.after(() => fs.rm(outside, { force: true }));
  const service = new LspWorkspaceEditService(root);
  await assert.rejects(service.preview({ changes: { [pathToFileURL(outside).href]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 11 } }, newText: 'x' }] } }), /越界/u);
  const preview = await service.preview({ changes: { [pathToFileURL(inside).href]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 7 } }, newText: 'new' }] } });
  await fs.writeFile(inside, 'int external;');
  await assert.rejects(service.apply(preview.previewId), /外部修改/u);
  assert.equal(await fs.readFile(inside, 'utf8'), 'int external;');
});

class FakeClangdProcess extends EventEmitter implements ClangdProcess {
  stdin = new PassThrough(); stdout = new PassThrough(); stderr = new PassThrough(); pid = 4242; methods: string[] = [];
  private buffer = Buffer.alloc(0);
  constructor() { super(); this.stdin.on('data', chunk => this.consume(Buffer.from(chunk))); }
  kill(): boolean { queueMicrotask(() => this.emit('exit', 0, null)); return true; }
  send(message: JsonRpcMessage): void { this.stdout.write(frame(message)); }
  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n'); if (headerEnd < 0) return;
      const length = Number(/Content-Length:\s*(\d+)/iu.exec(this.buffer.subarray(0, headerEnd).toString())?.[1]);
      if (this.buffer.length < headerEnd + 4 + length) return;
      const message = JSON.parse(this.buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString()) as JsonRpcMessage;
      this.buffer = this.buffer.subarray(headerEnd + 4 + length);
      if (message.method) this.methods.push(message.method);
      if (message.id !== undefined) this.send({ jsonrpc: '2.0', id: message.id, result: message.method === 'initialize' ? { capabilities: { textDocumentSync: 2 } } : null });
    }
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('wait timeout'); await new Promise(resolve => setTimeout(resolve, 5)); }
}
