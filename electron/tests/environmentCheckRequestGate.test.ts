import test from 'node:test';
import assert from 'node:assert/strict';

import { createEnvironmentCheckRequestGate } from '../src/services/tasks/environmentCheckRequestGate';

test('environment check request gate rejects duplicates and releases the active request', () => {
  const gate = createEnvironmentCheckRequestGate();
  const first = gate.begin();
  assert.ok(first);
  assert.equal(gate.isActive(), true);
  assert.equal(gate.begin(), null);

  first.finish();
  first.finish();
  assert.equal(gate.isActive(), false);
  assert.ok(gate.begin());
});

test('environment check request gate aborts an in-flight request on cleanup', () => {
  const gate = createEnvironmentCheckRequestGate();
  const lease = gate.begin();
  assert.ok(lease);
  assert.equal(lease.controller.signal.aborted, false);
  assert.equal(gate.cancel(), true);
  assert.equal(lease.controller.signal.aborted, true);
  assert.equal(gate.cancel(), false);
  assert.equal(gate.isActive(), false);
});
