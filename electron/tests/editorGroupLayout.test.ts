import assert from 'node:assert/strict';
import test from 'node:test';
import { closeEditorGroup, closeEditorGroupTab, createEditorGroupLayout, moveEditorTab, restoreEditorGroupLayout, selectEditorGroupTab, splitEditorGroup } from '../src/services/editor/editorGroupLayout';

test('editor groups split, select, move, close tabs and collapse empty groups deterministically', () => {
  let layout = createEditorGroupLayout(['a.cpp', 'b.cpp'], 'a.cpp');
  layout = splitEditorGroup(layout, 'a.cpp', 'vertical');
  assert.equal(layout.groups.length, 2); assert.equal(layout.orientation, 'vertical');
  layout = selectEditorGroupTab(layout, 'group-2', 'c.cpp');
  assert.deepEqual(layout.groups[1].tabs, ['a.cpp', 'c.cpp']);
  layout = moveEditorTab(layout, 'group-1', 'group-2', 'b.cpp');
  assert.deepEqual(layout.groups[1].tabs, ['a.cpp', 'c.cpp', 'b.cpp']);
  layout = closeEditorGroupTab(layout, 'group-2', 'a.cpp');
  assert.equal(layout.groups[1].tabs.includes('a.cpp'), false);
  layout = closeEditorGroup(layout, 'group-2');
  assert.equal(layout.groups.length, 1); assert.equal(layout.activeGroupId, 'group-1');
});

test('editor layout restore filters missing files, deduplicates tabs, bounds groups, and recovers corrupt state', () => {
  const restored = restoreEditorGroupLayout({ schemaVersion: 1, orientation: 'horizontal', activeGroupId: 'group-2', groups: [
    { tabs: ['a.cpp', 'missing.cpp', 'a.cpp'], activePath: 'missing.cpp' },
    { tabs: ['b.cpp'], activePath: 'b.cpp' },
    { tabs: ['c.cpp'], activePath: 'c.cpp' }
  ] }, ['a.cpp', 'b.cpp', 'c.cpp'], 'a.cpp');
  assert.equal(restored.groups.length, 2); assert.deepEqual(restored.groups[0].tabs, ['a.cpp']); assert.equal(restored.groups[0].activePath, 'a.cpp');
  assert.equal(restored.activeGroupId, 'group-2');
  assert.deepEqual(restoreEditorGroupLayout('broken', ['a.cpp'], 'a.cpp').groups[0].tabs, ['a.cpp']);
});
