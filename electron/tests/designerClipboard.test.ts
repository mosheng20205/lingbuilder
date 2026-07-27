import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesignerContainerLayoutRegistry } from '../src/services/windowDesigner/containerLayoutRegistry';
import { DesignerClipboardService, parseDesignerClipboard, serializeDesignerClipboard } from '../src/services/windowDesigner/designerClipboardService';
import type { LingControl, LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';

function control(id: string, type: LingControl['type'], parentId?: string, x = 10, y = 10): LingControl {
  return { id, type, parentId, name: id, content: id, x, y, width: 100, height: 30, fontSize: 12, background: '#fff', foreground: '#000', isEnabled: true, visibility: 'Visible' };
}

function windowModel(id: string, controls: LingControl[]): LingWindowModel {
  return { id, fileName: `${id}.xml`, className: id, title: id, width: 800, height: 600, background: '#fff', description: '', designerBackend: 'win32', controls };
}

test('clipboard keeps a copied container subtree and adapts only its root to a Tab slot', () => {
  const layouts = createDesignerContainerLayoutRegistry();
  const service = new DesignerClipboardService(layouts);
  const group = control('group', 'GroupBox', undefined, 30, 40);
  group.height = 200;
  const child = control('child', 'Button', 'group', 50, 80);
  const tab = control('tab', 'TabControl', undefined, 300, 40);
  tab.height = 260;
  tab.properties = { tabs: [{ id: 'page1', title: '页 1' }, { id: 'page2', title: '页 2' }], selectedIndex: 1 };
  const sourceWindow = windowModel('source', [group, child]);
  const targetWindow = windowModel('target', [tab]);
  const project: LingWindowProject = { schemaVersion: 2, id: 'project', name: 'P', windows: [sourceWindow, targetWindow] };
  const payload = service.createPayload(project, sourceWindow, ['group'], { resolveModuleId: () => 'lingbuilder.win32.basic' });
  assert.deepEqual(payload.rootControlIds, ['group']);
  assert.deepEqual(payload.controls.map(item => item.id), ['group', 'child']);
  const plan = service.planPaste(payload, project, targetWindow, {
    target: { parentId: 'tab', containerSlot: 'page2' },
    enabledModules: new Set(['lingbuilder.win32.basic']),
    supportsControl: () => true
  });
  assert.equal(plan.ok, true);
  const pastedRoot = plan.window.controls.find(item => plan.insertedControlIds.includes(item.id))!;
  const pastedChild = plan.window.controls.find(item => item.parentId === pastedRoot.id)!;
  assert.equal(pastedRoot.parentId, 'tab');
  assert.equal(pastedRoot.containerSlot, 'page2');
  assert.equal(pastedChild.containerSlot, undefined);
  assert.equal(pastedChild.x - pastedRoot.x, child.x - group.x);
  assert.equal(pastedChild.y - pastedRoot.y, child.y - group.y);
});

test('clipboard records fragments from different parents and converts roots to flow order', () => {
  const layouts = createDesignerContainerLayoutRegistry();
  layouts.registerContainer('module/FlowPanel', { mode: 'flow', orientation: 'vertical', coordinateSpace: 'parent' });
  const service = new DesignerClipboardService(layouts);
  const parentA = control('a', 'GroupBox');
  const parentB = control('b', 'GroupBox');
  const first = control('first', 'Button', 'a', 40, 70);
  const second = control('second', 'Button', 'b', 240, 170);
  const flow = control('flow', 'Grid', undefined, 400, 50);
  flow.designerType = 'module/FlowPanel';
  const source = windowModel('source', [parentA, parentB, first, second]);
  const target = windowModel('target', [flow]);
  const project: LingWindowProject = { schemaVersion: 2, id: 'p', name: 'P', windows: [source, target] };
  const payload = service.createPayload(project, source, ['first', 'second']);
  assert.equal(payload.fragments.length, 2);
  const plan = service.planPaste(payload, project, target, { target: { parentId: 'flow' }, supportsControl: () => true });
  assert.equal(plan.ok, true);
  const inserted = plan.window.controls.filter(item => plan.insertedControlIds.includes(item.id));
  assert.deepEqual(inserted.map(item => item.designerLayout?.kind), ['flow', 'flow']);
  assert.ok(inserted[1].y > inserted[0].y);
});

test('single-child adapter rejects an occupied target atomically', () => {
  const layouts = createDesignerContainerLayoutRegistry();
  layouts.registerContainer('module/Single', { mode: 'single', capacity: 1 });
  const service = new DesignerClipboardService(layouts);
  const source = windowModel('source', [control('copy', 'Button')]);
  const parent = control('single', 'Grid'); parent.designerType = 'module/Single';
  const target = windowModel('target', [parent, control('occupied', 'Label', 'single')]);
  const project: LingWindowProject = { schemaVersion: 2, id: 'p', name: 'P', windows: [source, target] };
  const payload = service.createPayload(project, source, ['copy']);
  const plan = service.planPaste(payload, project, target, { target: { parentId: 'single' }, supportsControl: () => true });
  assert.equal(plan.ok, false);
  assert.equal(plan.window.controls.length, 2);
  assert.match(plan.errors.join(''), /只能容纳一个/);
});

test('clipboard serialization rejects corrupted data', () => {
  assert.throws(() => parseDesignerClipboard('plain text'), /LingBuilder/);
  assert.throws(() => parseDesignerClipboard('LINGBUILDER_DESIGNER_CONTROLS:{'), /损坏/);
  const layouts = createDesignerContainerLayoutRegistry();
  const service = new DesignerClipboardService(layouts);
  const source = windowModel('source', [control('copy', 'Button')]);
  const project: LingWindowProject = { schemaVersion: 2, id: 'p', name: 'P', windows: [source] };
  assert.equal(parseDesignerClipboard(serializeDesignerClipboard(service.createPayload(project, source, ['copy']))).controls.length, 1);
});
