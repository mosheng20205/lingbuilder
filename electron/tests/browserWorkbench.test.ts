import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  BrowserCookieService,
  BrowserExtensionService,
  BrowserInstanceService,
  BrowserPersistenceService,
  BROWSER_INSTANCE_CONTEXT_MENU,
  BROWSER_WORKBENCH_COMMAND_IDS,
  createNativeBrowserInstanceMenuResource,
  createPortableBrowserWorkspaceConfig,
  isBrowserCookieExpired,
  registerBrowserWorkbenchCommands,
  validatePortableBrowserProfilePath,
  type BrowserCookieDocument,
  type BrowserCookieRecord,
  type BrowserPersistenceFileStore
} from '../src/services/browserWorkbench/index';
import { createCommandService } from '../src/services/commands/commandService';
import { getMenuService } from '../src/services/menus/menuService';

test('browser instance model keeps stable ids and portable profiles', () => {
  const service = new BrowserInstanceService(undefined, {
    createDefault: false,
    idFactory: () => 'browser-aaaaaaaa',
    now: () => new Date('2026-08-08T00:00:00.000Z')
  });
  const first = service.create({ name: '主账号' });
  const second = service.create({ id: 'browser-bbbbbbbb', name: '后台管理' });
  assert.equal(first.cacheDirectory, 'profiles/browser-aaaaaaaa');
  service.rename(first.id, '已重命名');
  assert.equal(service.selected().id, second.id);
  assert.equal(service.list()[0]?.id, first.id);
  assert.equal(service.list()[0]?.cacheDirectory, first.cacheDirectory);
  service.switch(first.id);
  assert.equal(service.delete(second.id).id, second.id);
  assert.throws(() => service.delete(first.id), /至少必须保留/);
  assert.throws(() => validatePortableBrowserProfilePath(first.id, '../other'), /可迁移相对路径/);
  assert.deepEqual(createPortableBrowserWorkspaceConfig().instances[0]?.cacheDirectory, 'profiles/browser-default');
});

test('browser persistence recovers a corrupt primary without overwriting it', async () => {
  const files = new Map<string, string>([
    ['browser-instances.json', '{broken'],
    ['browser-instances.json.bak', JSON.stringify(createPortableBrowserWorkspaceConfig())]
  ]);
  const moved: string[] = [];
  const store: BrowserPersistenceFileStore = {
    async readText(filePath) { const value = files.get(filePath); if (value === undefined) throw new Error('not found'); return value; },
    async writeText(filePath, content) { files.set(filePath, content); },
    async exists(filePath) { return files.has(filePath); },
    async ensureParent() {},
    async copyFile(source, target) { files.set(target, files.get(source)!); },
    async replaceFile(source, target) { files.set(target, files.get(source)!); files.delete(source); },
    async moveFile(source, target) { files.set(target, files.get(source)!); files.delete(source); moved.push(target); }
  };
  const result = await new BrowserPersistenceService(store, () => new Date('2026-08-08T00:00:00.000Z')).load('browser-instances.json');
  assert.equal(result.recoveredFromBackup, true);
  assert.equal(result.document?.instances[0]?.id, 'browser-default');
  assert.equal(moved.length, 1);
  assert.ok(result.diagnostic?.includes('主配置损坏'));
});

test('cookie service previews invalid, expired and conflicting records without leaking values', () => {
  const cookie: BrowserCookieRecord = {
    name: 'sid', value: 'secret-value', domain: '.example.com', path: '/', httpOnly: true, secure: true,
    sameSite: 2, priority: 1, session: false,
    expires: { year: 2030, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }
  };
  const expired = { ...cookie, name: 'old', expires: { year: 2020, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 } };
  const document = {
    format: 'lingbuilder.browser.cookies' as const, version: 1 as const, exportedAt: '',
    scope: { type: 'all' as const, url: '' }, cookies: [cookie, expired, { name: 'invalid' }]
  } as unknown as BrowserCookieDocument;
  const preview = new BrowserCookieService().preview(document, {
    existing: [cookie],
    now: new Date('2026-08-08T00:00:00.000Z')
  });
  assert.equal(preview.validCount, 2);
  assert.equal(preview.invalidCount, 1);
  assert.equal(preview.expiredCount, 1);
  assert.equal(preview.conflictCount, 1);
  assert.deepEqual(preview.domains, ['.example.com']);
  assert.equal(preview.accepted.length, 0);
  assert.equal(isBrowserCookieExpired(cookie, new Date('2026-08-08T00:00:00.000Z')), false);
  assert.ok(!JSON.stringify(preview).includes('secret-value'));
});

test('extension service resolves exe-relative plugin and reports manifest failures', async () => {
  const manifests = new Map<string, string>([['C:\\Program Files\\LingBuilder\\doubao-downloader\\manifest.json', JSON.stringify({ manifest_version: 3, name: 'Doubao', version: '2.0.4' })]]);
  const store = {
    async isDirectory(directory: string) { return directory.endsWith('doubao-downloader'); },
    async readText(filePath: string) { const value = manifests.get(filePath); if (!value) throw new Error('missing'); return value; }
  };
  const service = new BrowserExtensionService(store);
  const directory = service.resolveRuntimeDirectory('C:\\Program Files\\LingBuilder\\LingBuilder.exe');
  assert.equal(directory, 'C:\\Program Files\\LingBuilder\\doubao-downloader');
  assert.equal((await service.validate(directory)).status, '插件已加载');
  assert.equal((await service.validate('C:\\Missing\\doubao-downloader')).status, '插件缺失');
});

test('browser commands and instance context menu are registered through shared services', async () => {
  const commands = createCommandService();
  const calls: string[] = [];
  const adapter = {
    createInstance: () => { calls.push('create'); return 'created'; },
    switchInstance: (id: string) => { calls.push(`switch:${id}`); return id; },
    renameInstance: (id: string, name: string) => { calls.push(`rename:${id}:${name}`); return name; },
    deleteInstance: (id: string, mode: string) => { calls.push(`delete:${id}:${mode}`); return mode; },
    importCookies: (id: string) => { calls.push(`import:${id}`); return id; },
    exportCookies: (id: string, scope: string) => { calls.push(`export:${id}:${scope}`); return scope; },
    openCacheDirectory: (id: string) => { calls.push(`open:${id}`); return id; },
    clearCache: (id: string) => { calls.push(`clear:${id}`); return id; },
    exportSharePackage: (id?: string) => { calls.push(`share:${id || ''}`); return id; }
  };
  const registration = registerBrowserWorkbenchCommands(commands, adapter);
  await commands.executeCommand(BROWSER_WORKBENCH_COMMAND_IDS.switch, {
    'browserWorkbench.active': true,
    'browserWorkbench.instanceId': 'browser-aaaaaaaa'
  });
  const menu = getMenuService(commands).resolveMenu(BROWSER_INSTANCE_CONTEXT_MENU, {
    'browserWorkbench.active': true,
    'browserWorkbench.canDelete': true,
    'browserWorkbench.instanceId': 'browser-aaaaaaaa'
  }, { includeDisabled: true });
  assert.equal(menu.filter(item => item.kind === 'command').length, 9);
  assert.ok(menu.some(item => item.kind === 'command' && item.command.id === BROWSER_WORKBENCH_COMMAND_IDS.deleteClearData));
  assert.equal(calls[0], 'switch:browser-aaaaaaaa');
  registration.dispose();
  assert.equal(commands.hasCommand(BROWSER_WORKBENCH_COMMAND_IDS.switch), false);
  assert.equal(getMenuService(commands).resolveMenu(BROWSER_INSTANCE_CONTEXT_MENU, { 'browserWorkbench.active': true }).length, 0);
});

test('native instance menu remains declarative and includes both deletion policies', () => {
  const resource = createNativeBrowserInstanceMenuResource('main-window', 'browser-instance-list');
  assert.equal(resource.type, 'PopupMenu');
  assert.equal(resource.items.filter(item => !item.separator).length, 9);
  assert.ok(resource.items.some(item => item.selectedHandler === '_浏览器菜单_删除保留缓存'));
  assert.ok(resource.items.some(item => item.selectedHandler === '_浏览器菜单_删除并清数据'));
  assert.equal(resource.targetControlId, 'browser-instance-list');
});

test('generated protocol keeps general VIP lifecycle events separate from extension status', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '..', 'native', 'fbro-bridge', 'LingBuilderFbroProcessRuntime.hpp'), 'utf8');
  assert.ok(source.includes('value("phase", "") == "extension"'));
  assert.ok(source.includes('L"VipLifecycle"'));
  assert.ok(source.includes('LB_FBro_CookieSetJsonAsync'));
});

test('native smoke and package export enable the popup menu binding module', async () => {
  const [smoke, exporter] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '..', 'scripts', 'smoke-new-emoji-fbro-multi-browser-manager.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '..', 'scripts', 'export-new-emoji-fbro-multi-browser-manager-package.ts'), 'utf8')
  ]);
  assert.ok(smoke.includes("builtin('lingbuilder.win32.common-controls')"));
  assert.ok(smoke.includes('resolveSmokePersistenceDirectory'));
  assert.ok(smoke.includes('browser-workspaces'));
  assert.ok(exporter.includes("builtin('lingbuilder.win32.common-controls')"));
  assert.ok(exporter.includes("'lingbuilder.win32.common-controls'"));
});
