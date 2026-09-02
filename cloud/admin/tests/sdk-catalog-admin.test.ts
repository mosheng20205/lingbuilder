import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ANCHORED_FIELDS, UPDATABLE_FIELDS, buildCatalogDiff, parseResourcesJson } from '../src/sdkCatalogAdminModel';
import type { SdkCatalogResource } from '@lingbuilder/contracts';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const resource = (overrides: Partial<SdkCatalogResource> = {}): SdkCatalogResource => ({
  id: 'cef3-sdk', moduleId: 'lingbuilder.fbro.sdk', name: 'CEF3 运行时', platform: 'windows-x64',
  requiredModuleIds: [], criticalFiles: ['chrome_elf.dll'],
  version: '1.0.0', sdkVersion: '0.6.0', archiveName: 'cef3.7z', downloadUrl: 'https://msimgimg.xyz/cef3.7z',
  archiveBytes: 186457476, sha256: 'b984477a0000000000000000000000000000000000000000000000000000dc55',
  fileCount: 42, expandedBytes: 900000000, ...overrides
});

test('sdk catalog fields split exactly into anchored and updatable sets', () => {
  assert.deepEqual([...ANCHORED_FIELDS].sort(), ['criticalFiles', 'id', 'moduleId', 'name', 'platform', 'requiredModuleIds']);
  assert.deepEqual([...UPDATABLE_FIELDS].sort(), ['archiveBytes', 'archiveName', 'downloadUrl', 'expandedBytes', 'fileCount', 'sdkVersion', 'sha256', 'version']);
  for (const field of ANCHORED_FIELDS) assert.ok(!(UPDATABLE_FIELDS as readonly string[]).includes(field), `${field} 不能同时属于两组`);
});

test('parseResourcesJson accepts bare arrays and {resources} wrappers and rejects garbage in Chinese', () => {
  const list = [resource()];
  assert.deepEqual(parseResourcesJson(JSON.stringify(list)), list);
  assert.deepEqual(parseResourcesJson(JSON.stringify({ resources: list })), list);
  assert.throws(() => parseResourcesJson('不是 JSON'), /不是合法 JSON/u);
  assert.throws(() => parseResourcesJson('{"a":1}'), /resources/u);
  assert.throws(() => parseResourcesJson('[]'), /不能为空/u);
  assert.throws(() => parseResourcesJson('[1,2]'), /必须是对象/u);
});

test('buildCatalogDiff marks every resource as added on first publish', () => {
  const diff = buildCatalogDiff(null, [resource(), resource({ id: 'fbro-sdk', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro 运行时' })]);
  assert.equal(diff.length, 2);
  assert.ok(diff.every(entry => entry.kind === 'added'));
});

test('buildCatalogDiff reports only updatable changes and leaves anchored values out of changes', () => {
  const previous = [resource()];
  const next = [resource({ downloadUrl: 'https://msimgimg.xyz/cef3-new.7z', sha256: 'a'.repeat(64), criticalFiles: ['其他.dll'] })];
  const [entry] = buildCatalogDiff(previous, next);
  assert.equal(entry.kind, 'changed');
  assert.deepEqual(entry.changes.map(change => change.field).sort(), ['downloadUrl', 'sha256']);
  assert.equal(entry.changes[0].from, 'https://msimgimg.xyz/cef3.7z');
  assert.equal(entry.changes[0].to, 'https://msimgimg.xyz/cef3-new.7z');
  assert.deepEqual(entry.anchoredChanged, ['criticalFiles']);
});

test('buildCatalogDiff flags removed and unchanged resources and compares arrays literally', () => {
  const previous = [resource(), resource({ id: 'fbro-sdk', name: 'FBro 运行时' })];
  const kept = buildCatalogDiff(previous, [resource({ requiredModuleIds: ['lingbuilder.fbro.browser'] }), resource({ id: 'fbro-sdk', name: 'FBro 运行时' })]);
  assert.deepEqual(kept.map(entry => entry.kind), ['changed', 'unchanged']);
  const [changed] = kept;
  assert.deepEqual(changed.changes, []);
  assert.deepEqual(changed.anchoredChanged, ['requiredModuleIds']);
  const dropped = buildCatalogDiff(previous, [resource({ requiredModuleIds: ['lingbuilder.fbro.browser'] })]);
  assert.deepEqual(dropped.map(entry => entry.kind), ['changed', 'removed']);
  assert.equal(dropped[1].id, 'fbro-sdk');
  const same = buildCatalogDiff([resource()], [resource()]);
  assert.deepEqual(same.map(entry => entry.kind), ['unchanged']);
  assert.deepEqual(same[0].changes, []);
});

test('sdk catalog admin page wires nav, history route, role gating, diff confirm and upload fill-back', () => {
  const main = read('../src/main.tsx');
  assert.match(main, /'sdkcatalog'/u);
  assert.match(main, /SDK 下载源/u);
  assert.match(main, /site\/sdk-catalog\/history/u);
  const page = read('../src/SdkCatalogAdmin.tsx');
  assert.match(page, /@lingbuilder\/contracts/u);
  assert.match(page, /锚定/u);
  assert.match(page, /发布确认/u);
  assert.match(page, /IDE 生效/u);
  assert.match(page, /发布历史/u);
  assert.match(page, /回填/u);
  assert.match(page, /v1\/site\/sdk-catalog/u);
  assert.match(page, /v1\/admin\/site\/sdk-catalog/u);
  assert.match(page, /DirectUploadPanel/u);
  assert.match(page, /buildCatalogDiff/u);
  assert.match(page, /parseResourcesJson/u);
  for (const role of ['super_admin', 'operator', 'support', 'auditor']) assert.match(page, new RegExp(role, 'u'));
  assert.match(read('../src/WebsiteContentAdmin.tsx'), /export function DirectUploadPanel/u);
});
