import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesignerContainerLayoutRegistry } from '../src/services/windowDesigner/containerLayoutRegistry';
import { applyDesignerEditEnvelope, getDesignerModelRevision } from '../src/services/windowDesigner/designerExtensionEditService';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';

function makeProject(locked = false): LingWindowProject {
  const control: LingControl = { id: 'button', type: 'Button', name: '按钮1', content: '按钮', x: 10, y: 20, width: 100, height: 30, fontSize: 12, background: '#fff', foreground: '#000', isEnabled: true, visibility: 'Visible', designerLocked: locked || undefined };
  return { schemaVersion: 2, id: 'p', name: 'P', windows: [{ id: 'w', fileName: 'w.xml', className: 'W', title: 'W', width: 800, height: 600, background: '#fff', description: '', controls: [control] }] };
}

test('designer extension edits are revision checked and atomic', () => {
  const project = makeProject();
  const layouts = createDesignerContainerLayoutRegistry();
  const next = applyDesignerEditEnvelope(project, 'w', {
    kind: 'lingbuilder.designer.edit',
    baseRevision: getDesignerModelRevision(project),
    operations: [
      { type: 'update', controlId: 'button', fields: { content: '已修改' } },
      { type: 'move', controlId: 'button', x: 80, y: 90 }
    ]
  }, layouts, () => true);
  assert.equal(next.windows[0].controls[0].content, '已修改');
  assert.equal(next.windows[0].controls[0].x, 80);
  assert.equal(project.windows[0].controls[0].content, '按钮');
  assert.throws(() => applyDesignerEditEnvelope(project, 'w', {
    kind: 'lingbuilder.designer.edit', baseRevision: 'stale', operations: [{ type: 'move', controlId: 'button', x: 1, y: 1 }]
  }, layouts, () => true), /过期/);
});

test('designer extension cannot move locked controls or update forbidden fields', () => {
  const project = makeProject(true);
  const layouts = createDesignerContainerLayoutRegistry();
  assert.throws(() => applyDesignerEditEnvelope(project, 'w', {
    kind: 'lingbuilder.designer.edit', baseRevision: getDesignerModelRevision(project), operations: [{ type: 'move', controlId: 'button', x: 1, y: 1 }]
  }, layouts, () => true), /已锁定/);
  assert.throws(() => applyDesignerEditEnvelope(project, 'w', {
    kind: 'lingbuilder.designer.edit', baseRevision: getDesignerModelRevision(project), operations: [{ type: 'update', controlId: 'button', fields: { id: 'hijack' } as never }]
  }, layouts, () => true), /不允许字段/);
});
