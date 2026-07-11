import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeTestDebugService } from '../src/services/testing/nodeTestDebugService';
import { TestExplorerService } from '../src/services/testing/testExplorerService';

test('Node test debug adapter starts Inspector paused, continues and terminates', { timeout: 30_000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-node-debug-')); t.after(() => fs.rm(root, { recursive: true, force: true })); await fs.mkdir(path.join(root, 'tests')); await fs.writeFile(path.join(root, 'tests', 'debug.test.ts'), `import test from 'node:test'; import assert from 'node:assert/strict'; test('debug me', () => assert.equal(2, 2));`);
  const explorer = new TestExplorerService(root); const item = (await explorer.discover())[0]; const configuration = explorer.debugConfiguration(item.id); const debug = new NodeTestDebugService(); t.after(() => debug.stop());
  const paused = await debug.start({ testId: item.id, program: configuration.program, args: configuration.args, cwd: configuration.cwd }); assert.equal(paused.state, 'paused'); assert.match(paused.inspectorUrl || '', /^ws:\/\//u);
  assert.equal((await debug.continue()).state, 'running'); const deadline = Date.now() + 15_000; while (debug.getSnapshot()?.state !== 'terminated' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(debug.getSnapshot()?.state, 'terminated');
});
