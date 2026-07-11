import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ConfigurationChangeEvent,
  ConfigurationPersistenceError,
  ConfigurationSchema,
  ConfigurationStorageAdapter,
  ConfigurationValidationError,
  PersistedConfigurationDocument,
  createConfigurationService,
  createJsonFileConfigurationStorageAdapter,
  createMemoryConfigurationStorageAdapter
} from '../src/services/configuration';

const schema: ConfigurationSchema = {
  'editor.fontSize': {
    type: 'integer',
    default: 13,
    minimum: 10,
    maximum: 24
  },
  'editor.mode': {
    type: 'string',
    default: 'beginner',
    enum: ['beginner', 'professional', 'native']
  },
  'files.exclude': {
    type: 'array',
    default: [],
    items: { type: 'string', minLength: 1 }
  },
  'build.profile': {
    type: 'object',
    default: { architecture: 'x64', optimize: false },
    required: ['architecture', 'optimize'],
    properties: {
      architecture: { type: 'string', enum: ['x86', 'x64'] },
      optimize: { type: 'boolean' }
    },
    additionalProperties: false
  }
};

test('configuration precedence is workspace, user, then default and inspection identifies source', async () => {
  const user = createMemoryConfigurationStorageAdapter('user', {
    schemaVersion: 1,
    values: { 'editor.fontSize': 16, 'editor.mode': 'professional' }
  });
  const workspace = createMemoryConfigurationStorageAdapter('workspace', {
    schemaVersion: 1,
    values: { 'editor.fontSize': 18 }
  });
  const service = createConfigurationService({ schema, userStorage: user, workspaceStorage: workspace });
  await service.initialize();

  assert.equal(service.get('editor.fontSize'), 18);
  assert.equal(service.get('editor.mode'), 'professional');
  assert.deepEqual(service.get('files.exclude'), []);
  assert.deepEqual(service.inspect('editor.fontSize'), {
    key: 'editor.fontSize',
    defaultValue: 13,
    userValue: 16,
    workspaceValue: 18,
    value: 18,
    source: 'workspace'
  });
});

test('schema validates types, ranges, enums, arrays and object properties', async () => {
  const service = createConfigurationService({ schema });
  await service.initialize();

  await assert.rejects(
    () => service.update('editor.fontSize', 25, 'user'),
    (error: unknown) => assertValidationError(error, 'editor.fontSize', /不能大于 24/u)
  );
  await assert.rejects(
    () => service.update('editor.mode', 'expert', 'user'),
    (error: unknown) => assertValidationError(error, 'editor.mode', /允许值/u)
  );
  await assert.rejects(
    () => service.update('files.exclude', ['dist', ''], 'workspace'),
    (error: unknown) => assertValidationError(error, 'files.exclude', /长度不能小于 1/u)
  );
  await assert.rejects(
    () => service.update('build.profile', { architecture: 'arm64', optimize: true, extra: true }, 'workspace'),
    (error: unknown) => assertValidationError(error, 'build.profile', /允许值|不是允许的属性/u)
  );
  await assert.rejects(
    () => service.update('unknown.setting', true, 'user'),
    (error: unknown) => assertValidationError(error, 'unknown.setting', /未在 schema 中注册/u)
  );
  assert.equal(service.get('editor.fontSize'), 13);
});

test('update and delete persist their scope and emit isolated effective change events', async () => {
  const user = createMemoryConfigurationStorageAdapter('user');
  const workspace = createMemoryConfigurationStorageAdapter('workspace');
  const service = createConfigurationService({ schema, userStorage: user, workspaceStorage: workspace });
  await service.initialize();
  const events: ConfigurationChangeEvent[] = [];
  service.onDidChange(event => events.push(event));
  service.onDidChange(() => { throw new Error('监听器故障'); });

  await service.update('editor.fontSize', 15, 'user');
  await service.update('editor.fontSize', 20, 'workspace');
  await service.update('editor.fontSize', 17, 'user');
  await service.delete('editor.fontSize', 'workspace');
  await service.delete('editor.fontSize', 'user');

  assert.equal(service.get('editor.fontSize'), 13);
  assert.equal(events.length, 5);
  assert.equal(events[2].effectiveChanged, false);
  assert.equal(events[2].oldEffectiveValue, 20);
  assert.equal(events[2].newEffectiveValue, 20);
  assert.equal(events[3].newEffectiveValue, 17);
  assert.deepEqual(user.snapshot(), { schemaVersion: 1, values: {} });
  assert.deepEqual(workspace.snapshot(), { schemaVersion: 1, values: {} });
});

test('change subscription can be disposed and returned values cannot mutate stored settings', async () => {
  const service = createConfigurationService({ schema });
  await service.initialize();
  let eventCount = 0;
  const subscription = service.onDidChange(() => { eventCount += 1; });
  const profile = service.get<{ architecture: string; optimize: boolean }>('build.profile');
  profile.architecture = 'mutated';
  assert.deepEqual(service.get('build.profile'), { architecture: 'x64', optimize: false });

  await service.update('editor.fontSize', 14, 'user');
  subscription.dispose();
  await service.update('editor.fontSize', 15, 'user');
  assert.equal(eventCount, 1);
});

test('legacy documents migrate, unknown and invalid values are diagnosed in Chinese and normalized', async () => {
  const user = createMemoryConfigurationStorageAdapter('user', {
    'editor.fontSize': '很大',
    'editor.mode': 'professional',
    'old.removedSetting': true
  });
  const service = createConfigurationService({ schema, userStorage: user });
  await service.initialize();

  assert.equal(service.get('editor.fontSize'), 13);
  assert.equal(service.get('editor.mode'), 'professional');
  assert.deepEqual(user.snapshot(), {
    schemaVersion: 1,
    values: { 'editor.mode': 'professional' }
  });
  const diagnostics = service.getDiagnostics();
  assert.ok(diagnostics.some(item => item.code === 'LEGACY_MIGRATED' && /已将用户旧版设置迁移/u.test(item.message)));
  assert.ok(diagnostics.some(item => item.code === 'UNKNOWN_KEY' && /未知项/u.test(item.message)));
  assert.ok(diagnostics.some(item => item.code === 'INVALID_VALUE' && /无效.*回退/u.test(item.message)));
});

test('version 0 document migrates while unsupported future version remains untouched', async () => {
  const user = createMemoryConfigurationStorageAdapter('user', {
    schemaVersion: 0,
    settings: { 'editor.fontSize': 14 }
  });
  const futureDocument = { schemaVersion: 99, values: { 'editor.fontSize': 22 } };
  const workspace = createMemoryConfigurationStorageAdapter('workspace', futureDocument);
  const service = createConfigurationService({ schema, userStorage: user, workspaceStorage: workspace });
  await service.initialize();

  assert.equal(service.get('editor.fontSize'), 14);
  assert.deepEqual(user.snapshot(), { schemaVersion: 1, values: { 'editor.fontSize': 14 } });
  assert.deepEqual(workspace.snapshot(), futureDocument);
  assert.ok(service.getDiagnostics().some(item => item.code === 'UNSUPPORTED_VERSION' && /不受支持.*未被修改/u.test(item.message)));
});

test('JSON file adapter reports corrupt content in Chinese, preserves it, then recovers on explicit update', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-configuration-'));
  const filePath = path.join(root, '.lingbuilder', 'settings.json');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '{ "editor.fontSize": 18, 损坏', 'utf8');
  let resolveCount = 0;
  const storage = createJsonFileConfigurationStorageAdapter({
    id: 'workspace-file',
    resolveFilePath: async () => {
      resolveCount += 1;
      return filePath;
    }
  });
  const service = createConfigurationService({ schema, workspaceStorage: storage });
  await service.initialize();

  assert.equal(service.get('editor.fontSize'), 13);
  assert.match(await fs.readFile(filePath, 'utf8'), /损坏/u);
  assert.ok(service.getDiagnostics().some(item => item.code === 'CORRUPT_FILE' && /不是合法 JSON.*保留原文件/u.test(item.message)));

  await service.update('editor.fontSize', 19, 'workspace');
  assert.equal(resolveCount, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), {
    schemaVersion: 1,
    values: { 'editor.fontSize': 19 }
  });
});

test('JSON file adapter requires a host-injected validated absolute path', async () => {
  const adapter = createJsonFileConfigurationStorageAdapter({
    id: 'unsafe',
    resolveFilePath: () => '../settings.json'
  });
  await assert.rejects(
    () => adapter.read(),
    (error: unknown) => {
      assert.ok(error instanceof ConfigurationPersistenceError);
      assert.equal(error.code, 'UNSAFE_PATH');
      assert.match(error.message, /安全|绝对路径/u);
      return true;
    }
  );

  const rejected = createJsonFileConfigurationStorageAdapter({
    id: 'rejected',
    resolveFilePath: () => { throw new Error('路径越界'); }
  });
  await assert.rejects(
    () => rejected.write({ schemaVersion: 1, values: {} }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigurationPersistenceError);
      assert.equal(error.code, 'UNSAFE_PATH');
      assert.match(error.message, /路径越界/u);
      return true;
    }
  );
});

test('persistence failure rolls back memory value and does not emit a change event', async () => {
  const storage: ConfigurationStorageAdapter = {
    id: 'failing',
    read: async () => undefined,
    write: async (_document: PersistedConfigurationDocument) => {
      throw new ConfigurationPersistenceError('WRITE_FAILED', '模拟保存失败');
    }
  };
  const service = createConfigurationService({ schema, userStorage: storage });
  await service.initialize();
  let eventCount = 0;
  service.onDidChange(() => { eventCount += 1; });

  await assert.rejects(() => service.update('editor.fontSize', 16, 'user'), /模拟保存失败/u);
  assert.equal(service.get('editor.fontSize'), 13);
  assert.equal(eventCount, 0);
  assert.ok(service.getDiagnostics().some(item => item.code === 'WRITE_FAILED' && /模拟保存失败/u.test(item.message)));
});

function assertValidationError(error: unknown, key: string, pattern: RegExp): true {
  assert.ok(error instanceof ConfigurationValidationError);
  assert.equal(error.key, key);
  assert.match(error.message, pattern);
  return true;
}
