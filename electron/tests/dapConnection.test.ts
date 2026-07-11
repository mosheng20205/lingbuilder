import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { DapConnection } from '../src/services/debug/dapConnection';

class FakeChild extends EventEmitter {
  stdin = new PassThrough(); stdout = new PassThrough(); stderr = new PassThrough(); killed = false;
  kill() { this.killed = true; this.emit('exit', 0, null); return true; }
}
const frame = (message: unknown) => { const json = JSON.stringify(message); return Buffer.from(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`); };

test('DAP connection parses fragmented responses/events and correlates requests', async () => {
  const child = new FakeChild(); const connection = new DapConnection(child as any, 1000); let requestText = '';
  child.stdin.on('data', chunk => { requestText += String(chunk); });
  const response = connection.request('initialize', { clientID: 'lingbuilder' }); await new Promise(resolve => setImmediate(resolve));
  assert.match(requestText, /Content-Length:/u); assert.match(requestText, /initialize/u);
  const eventWait = connection.waitForEvent<{ reason: string }>('stopped');
  const data = Buffer.concat([frame({ seq: 2, type: 'response', request_seq: 1, command: 'initialize', success: true, body: { supportsConfigurationDoneRequest: true } }), frame({ seq: 3, type: 'event', event: 'stopped', body: { reason: 'breakpoint' } })]);
  child.stdout.write(data.subarray(0, 17)); child.stdout.write(data.subarray(17));
  assert.equal((await response).supportsConfigurationDoneRequest, true); assert.equal((await eventWait).reason, 'breakpoint');
});

test('DAP connection rejects failed, timed out and closed requests', async () => {
  const child = new FakeChild(); const connection = new DapConnection(child as any, 25);
  const failed = connection.request('launch'); child.stdout.write(frame({ seq: 2, type: 'response', request_seq: 1, command: 'launch', success: false, message: '启动失败' }));
  await assert.rejects(failed, /启动失败/u); await assert.rejects(connection.request('slow'), /超时/u);
  const pending = connection.request('threads', {}, 1000); connection.terminate(); await assert.rejects(pending, /终止|退出/u); assert.equal(child.killed, true);
});

test('DAP connection answers adapter requests and reports malformed frames', async () => {
  const child = new FakeChild(); const connection = new DapConnection(child as any); const errors: Error[] = []; connection.on('protocolError', error => errors.push(error));
  let written = ''; child.stdin.on('data', chunk => { written += String(chunk); });
  connection.on('request', request => connection.respond(request, false, undefined, '不支持反向请求'));
  child.stdout.write(Buffer.from('Bad: 1\r\n\r\n{}')); child.stdout.write(frame({ seq: 5, type: 'request', command: 'runInTerminal' })); await new Promise(resolve => setImmediate(resolve));
  assert.ok(errors.length >= 1); assert.match(written, /不支持反向请求/u);
  connection.terminate();
});
