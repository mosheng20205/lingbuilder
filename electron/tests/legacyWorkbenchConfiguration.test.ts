import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_EDITOR_EXPERIENCE_MODE_KEY,
  LEGACY_EDITOR_FONT_SIZE_KEY,
  planLegacyWorkbenchConfigurationMigration,
  WORKBENCH_CONFIGURATION_METADATA,
  WORKBENCH_CONFIGURATION_SCHEMA,
  type WorkbenchConfigurationSnapshot
} from '../src/services/configuration';

test('legacy renderer font and experience preferences migrate to user settings once', () => {
  const plan = planLegacyWorkbenchConfigurationMigration(createSnapshot(), {
    editorFontSize: '18',
    editorExperienceMode: 'professional'
  });
  assert.deepEqual(plan.updates, [
    { key: 'editor.fontSize', value: 18 },
    { key: 'editor.experienceMode', value: 'professional' }
  ]);
  assert.deepEqual(plan.storageKeysToClear, [
    LEGACY_EDITOR_FONT_SIZE_KEY,
    LEGACY_EDITOR_EXPERIENCE_MODE_KEY
  ]);
});

test('existing user settings win over stale legacy values while legacy keys are cleared', () => {
  const snapshot = createSnapshot({
    'editor.fontSize': 16,
    'editor.experienceMode': 'native'
  });
  const plan = planLegacyWorkbenchConfigurationMigration(snapshot, {
    editorFontSize: '22',
    editorExperienceMode: 'beginner'
  });
  assert.deepEqual(plan.updates, []);
  assert.equal(plan.storageKeysToClear.length, 2);
});

test('legacy font migration preserves the former clamp and ignores invalid modes', () => {
  const plan = planLegacyWorkbenchConfigurationMigration(createSnapshot(), {
    editorFontSize: '99',
    editorExperienceMode: 'unknown'
  });
  assert.deepEqual(plan.updates, [{ key: 'editor.fontSize', value: 24 }]);
  assert.equal(plan.storageKeysToClear.length, 2);
});

function createSnapshot(
  userValues: Partial<Record<'editor.fontSize' | 'editor.experienceMode', number | string>> = {}
): WorkbenchConfigurationSnapshot {
  return {
    schemaVersion: 1,
    diagnostics: [],
    settings: WORKBENCH_CONFIGURATION_METADATA.map(metadata => {
      const defaultValue = WORKBENCH_CONFIGURATION_SCHEMA[metadata.key].default;
      const userValue = userValues[metadata.key as keyof typeof userValues];
      return {
        metadata,
        inspection: {
          key: metadata.key,
          defaultValue,
          userValue,
          workspaceValue: undefined,
          value: userValue ?? defaultValue,
          source: userValue === undefined ? 'default' : 'user'
        }
      };
    })
  };
}
