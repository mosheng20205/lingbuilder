import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disposeWorkbenchTextModelsForSource,
  renameWorkbenchTextModelsForSource,
  workbenchTextModelService
} from '../src/services/textModel';

const workspaceId = 'lifecycle-workspace';
const projectId = 'project-a';

test('source rename preserves source and native preview model identities and view states', () => {
  workbenchTextModelService.disposeAll();
  const source = { workspaceId, projectId, filePath: 'src/a.lcpp' };
  const target = { workspaceId, projectId, filePath: 'src/renamed.lcpp' };
  const native = { workspaceId, projectId, filePath: '__native_preview__/src/a.lcpp/main.cpp' };
  const sourceRecord = workbenchTextModelService.ensure(source);
  const nativeRecord = workbenchTextModelService.ensure(native);
  workbenchTextModelService.saveViewState(native, 'native:main.cpp', {
    cursor: { line: 8, column: 3 },
    selection: { anchor: { line: 8, column: 3 }, active: { line: 8, column: 5 } },
    scrollTop: 100,
    scrollLeft: 4
  });

  assert.equal(renameWorkbenchTextModelsForSource(source, target), 2);
  assert.equal(workbenchTextModelService.get(target)?.modelId, sourceRecord.modelId);
  const renamedNative = { workspaceId, projectId, filePath: '__native_preview__/src/renamed.lcpp/main.cpp' };
  assert.equal(workbenchTextModelService.get(renamedNative)?.modelId, nativeRecord.modelId);
  assert.equal(workbenchTextModelService.getViewState(renamedNative, 'native:main.cpp')?.cursor.line, 8);
});

test('source delete releases its source and native descendants without touching another source', () => {
  workbenchTextModelService.disposeAll();
  const source = { workspaceId, projectId, filePath: 'src/a.lcpp' };
  const other = { workspaceId, projectId, filePath: 'src/b.lcpp' };
  workbenchTextModelService.ensure(source);
  workbenchTextModelService.ensure({ ...source, filePath: '__native_preview__/src/a.lcpp/main.cpp' });
  workbenchTextModelService.ensure({ ...source, filePath: '__native_preview__/src/a.lcpp/layout.json' });
  workbenchTextModelService.ensure(other);

  assert.equal(disposeWorkbenchTextModelsForSource(source), 3);
  assert.equal(workbenchTextModelService.get(source), undefined);
  assert.ok(workbenchTextModelService.get(other));
  workbenchTextModelService.disposeAll();
});

