import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  WORKBENCH_CONFIGURATION_KEYS,
  createWorkbenchConfigurationService
} from '../src/services/configuration/workbenchConfiguration';
import {
  ConfigurationPersistenceError,
  ConfigurationValidationError
} from '../src/services/configuration/types';

test('workbench configuration requires absolute host paths and fixes the workspace settings location', async () => {
  assert.throws(
    () => createWorkbenchConfigurationService({
      workspaceRoot: './workspace',
      userSettingsPath: path.resolve('user-settings.json')
    }),
    (error: unknown) => assertUnsafePath(error, /工作区根目录/u)
  );
  assert.throws(
    () => createWorkbenchConfigurationService({
      workspaceRoot: path.resolve('workspace'),
      userSettingsPath: './user-settings.json'
    }),
    (error: unknown) => assertUnsafePath(error, /用户设置文件/u)
  );

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-paths-'));
  const workspaceRoot = path.join(root, 'workspace', '..', 'workspace');
  const userSettingsPath = path.join(root, 'profile', 'settings.json');
  const service = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });

  assert.equal(service.workspaceRoot, path.resolve(workspaceRoot));
  assert.equal(
    service.workspaceSettingsPath,
    path.join(path.resolve(workspaceRoot), '.lingbuilder', 'settings.json')
  );
  assert.equal(service.userSettingsPath, path.resolve(userSettingsPath));
});

test('workspace values override user values and snapshot exposes inspection, metadata and diagnostics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-snapshot-'));
  const workspaceRoot = path.join(root, 'workspace');
  const userSettingsPath = path.join(root, 'profile', 'settings.json');
  const workspaceSettingsPath = path.join(workspaceRoot, '.lingbuilder', 'settings.json');
  await writeSettings(userSettingsPath, {
    'editor.fontSize': 16,
    'editor.experienceMode': 'professional',
    'workbench.colorTheme': 'light'
  });
  await writeSettings(workspaceSettingsPath, {
    'editor.fontSize': 19,
    'workbench.sidebar.visible': false
  });

  const service = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });
  await service.initialize();

  assert.equal(service.get('editor.fontSize'), 19);
  assert.equal(service.get('editor.experienceMode'), 'professional');
  assert.equal(service.get('workbench.panel.visible'), true);

  const snapshot = service.snapshot();
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(snapshot.settings.map(item => item.metadata.key), [...WORKBENCH_CONFIGURATION_KEYS]);
  const fontSize = snapshot.settings.find(item => item.metadata.key === 'editor.fontSize');
  assert.ok(fontSize);
  assert.equal(fontSize.metadata.minimum, 10);
  assert.equal(fontSize.metadata.maximum, 24);
  assert.deepEqual(fontSize.inspection, {
    key: 'editor.fontSize',
    defaultValue: 13,
    userValue: 16,
    workspaceValue: 19,
    value: 19,
    source: 'workspace'
  });
  assert.deepEqual(snapshot.diagnostics, []);
  assert.deepEqual(
    JSON.parse(service.serializeSnapshot()),
    JSON.parse(JSON.stringify(snapshot))
  );

  fontSize.metadata.title = '被外部修改';
  assert.notEqual(service.snapshot().settings[0].metadata.title, '被外部修改');
});

test('keyboard shortcut overrides accept only objects whose values are non-empty strings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-shortcuts-'));
  const service = createWorkbenchConfigurationService({
    workspaceRoot: path.join(root, 'workspace'),
    userSettingsPath: path.join(root, 'profile', 'settings.json')
  });
  await service.initialize();

  await assert.rejects(
    () => service.update('keyboard.shortcuts', ['Ctrl+S'], 'user'),
    (error: unknown) => assertValidationError(error, 'keyboard.shortcuts')
  );
  await assert.rejects(
    () => service.update('keyboard.shortcuts', { 'workbench.togglePanel': true }, 'workspace'),
    (error: unknown) => assertValidationError(error, 'keyboard.shortcuts')
  );
  await assert.rejects(
    () => service.update('keyboard.shortcuts', { 'workbench.togglePanel': '' }, 'workspace'),
    (error: unknown) => assertValidationError(error, 'keyboard.shortcuts')
  );

  const shortcuts = {
    'workbench.action.files.save': 'Ctrl+S',
    'workbench.action.panel.toggle': 'Ctrl+J'
  };
  await service.update('keyboard.shortcuts', shortcuts, 'workspace');
  assert.deepEqual(service.get('keyboard.shortcuts'), shortcuts);
});

test('keyboard shortcut persistence normalizes safe strokes and rejects input-stealing or conflicting bindings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-shortcut-safety-'));
  const service = createWorkbenchConfigurationService({
    workspaceRoot: path.join(root, 'workspace'),
    userSettingsPath: path.join(root, 'profile', 'settings.json')
  });
  await service.initialize();

  await assert.rejects(
    () => service.update('keyboard.shortcuts', { 'workbench.action.build.run': 'A' }, 'user'),
    (error: unknown) => assertValidationError(error, 'keyboard.shortcuts')
  );
  await assert.rejects(
    () => service.update('keyboard.shortcuts', { 'workbench.action.build.run': 'Ctrl+S' }, 'user'),
    (error: unknown) => assertValidationError(error, 'keyboard.shortcuts')
  );

  await service.update('keyboard.shortcuts', {
    'workbench.action.files.save': ' control + shift + s '
  }, 'user');
  assert.deepEqual(service.get('keyboard.shortcuts'), {
    'workbench.action.files.save': 'Ctrl+Shift+S'
  });
});

test('unsafe shortcuts from an existing settings file are diagnosed and fall back without registering', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-shortcut-load-'));
  const workspaceRoot = path.join(root, 'workspace');
  const userSettingsPath = path.join(root, 'profile', 'settings.json');
  await writeSettings(userSettingsPath, {
    'keyboard.shortcuts': { 'workbench.action.build.run': 'A' }
  });

  const service = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });
  await service.initialize();
  assert.deepEqual(service.get('keyboard.shortcuts'), {});
  assert.ok(service.getDiagnostics().some(diagnostic => (
    diagnostic.code === 'INVALID_VALUE'
    && diagnostic.key === 'keyboard.shortcuts'
  )));
});

test('workbench schema enforces font bounds, experience modes, themes and visibility booleans', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-schema-'));
  const service = createWorkbenchConfigurationService({
    workspaceRoot: path.join(root, 'workspace'),
    userSettingsPath: path.join(root, 'profile', 'settings.json')
  });
  await service.initialize();

  for (const invalidFontSize of [9, 25]) {
    await assert.rejects(
      () => service.update('editor.fontSize', invalidFontSize, 'user'),
      (error: unknown) => assertValidationError(error, 'editor.fontSize')
    );
  }
  await assert.rejects(
    () => service.update('editor.experienceMode', 'expert', 'user'),
    (error: unknown) => assertValidationError(error, 'editor.experienceMode')
  );
  await assert.rejects(
    () => service.update('workbench.colorTheme', 'blue', 'user'),
    (error: unknown) => assertValidationError(error, 'workbench.colorTheme')
  );
  await assert.rejects(
    () => service.update('workbench.sidebar.visible', 'yes', 'workspace'),
    (error: unknown) => assertValidationError(error, 'workbench.sidebar.visible')
  );

  await service.update('editor.fontSize', 24, 'workspace');
  await service.update('editor.experienceMode', 'native', 'workspace');
  await service.update('workbench.colorTheme', 'light', 'workspace');
  assert.equal(service.get('editor.fontSize'), 24);
  assert.equal(service.get('editor.experienceMode'), 'native');
  assert.equal(service.get('workbench.colorTheme'), 'light');
});

test('user and workspace updates persist independently and reload with the same priority', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-persistence-'));
  const workspaceRoot = path.join(root, 'workspace');
  const userSettingsPath = path.join(root, 'profile', 'settings.json');
  const workspaceSettingsPath = path.join(workspaceRoot, '.lingbuilder', 'settings.json');
  const service = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });

  await service.update('editor.fontSize', 15, 'user');
  await service.update('editor.fontSize', 21, 'workspace');
  await service.update('workbench.aiPanel.visible', false, 'user');
  await service.update('workbench.panel.visible', false, 'workspace');

  assert.deepEqual(JSON.parse(await fs.readFile(userSettingsPath, 'utf8')), {
    schemaVersion: 1,
    values: {
      'editor.fontSize': 15,
      'workbench.aiPanel.visible': false
    }
  });
  assert.deepEqual(JSON.parse(await fs.readFile(workspaceSettingsPath, 'utf8')), {
    schemaVersion: 1,
    values: {
      'editor.fontSize': 21,
      'workbench.panel.visible': false
    }
  });

  const reloaded = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });
  await reloaded.initialize();
  assert.equal(reloaded.get('editor.fontSize'), 21);
  assert.equal(reloaded.get('workbench.aiPanel.visible'), false);
  assert.equal(reloaded.get('workbench.panel.visible'), false);
  assert.equal(reloaded.inspect('editor.fontSize').source, 'workspace');
});

test('snapshot includes persisted-file diagnostics without leaking mutable service state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workbench-diagnostics-'));
  const workspaceRoot = path.join(root, 'workspace');
  const userSettingsPath = path.join(root, 'profile', 'settings.json');
  await fs.mkdir(path.dirname(userSettingsPath), { recursive: true });
  await fs.writeFile(userSettingsPath, '{ 损坏的 JSON', 'utf8');

  const service = createWorkbenchConfigurationService({ workspaceRoot, userSettingsPath });
  await service.initialize();
  const snapshot = service.snapshot();

  assert.ok(snapshot.diagnostics.some(item => item.code === 'CORRUPT_FILE' && item.target === 'user'));
  snapshot.diagnostics[0].message = '被外部修改';
  assert.notEqual(service.getDiagnostics()[0].message, '被外部修改');
});

async function writeSettings(
  filePath: string,
  values: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ schemaVersion: 1, values }, null, 2)}\n`, 'utf8');
}

function assertUnsafePath(error: unknown, pattern: RegExp): true {
  assert.ok(error instanceof ConfigurationPersistenceError);
  assert.equal(error.code, 'UNSAFE_PATH');
  assert.match(error.message, pattern);
  return true;
}

function assertValidationError(error: unknown, key: string): true {
  assert.ok(error instanceof ConfigurationValidationError);
  assert.equal(error.key, key);
  return true;
}
