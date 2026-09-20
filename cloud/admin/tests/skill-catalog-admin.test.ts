import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  SKILL_ANCHORED_FIELDS,
  SKILL_UPDATABLE_FIELDS,
  buildSkillReleaseDiff,
  parseSkillReleaseJson,
  type SkillCatalogRelease
} from '../src/skillCatalogAdminModel';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const SHA = 'a'.repeat(64);

function release(overrides: Partial<SkillCatalogRelease> = {}): SkillCatalogRelease {
  return {
    id: 'lingbuilder.skill-kit',
    version: '0.2.0',
    entrypoint: 'SKILL.md',
    minIdeVersion: '0.7.6',
    installPromptTemplate: '请读取 {skillPath} 并按其中步骤安装。',
    files: [{ path: 'SKILL.md', bytes: 7727, sha256: SHA, downloadUrl: 'https://cdn.example.test/skill-kit/SKILL.md' }],
    ...overrides
  };
}

test('skill 清单字段二分：锚定与可更新互斥且覆盖全部字段', () => {
  assert.deepEqual([...SKILL_ANCHORED_FIELDS].sort(), ['entrypoint', 'id']);
  assert.deepEqual([...SKILL_UPDATABLE_FIELDS].sort(), ['files', 'installPromptTemplate', 'minIdeVersion', 'version']);
  for (const field of SKILL_ANCHORED_FIELDS) {
    assert.ok(!(SKILL_UPDATABLE_FIELDS as readonly string[]).includes(field), `${field} 不能同时属于两组`);
  }
  const covered = new Set<string>([...SKILL_ANCHORED_FIELDS, ...SKILL_UPDATABLE_FIELDS]);
  for (const key of Object.keys(release())) assert.ok(covered.has(key), `字段 ${key} 未归入任何一组`);
});

test('parseSkillReleaseJson 接受裸对象与 {release} 包装，错误一律中文', () => {
  const value = release();
  assert.deepEqual(parseSkillReleaseJson(JSON.stringify(value)), value);
  assert.deepEqual(parseSkillReleaseJson(JSON.stringify({ release: value })), value);
  assert.throws(() => parseSkillReleaseJson('不是 JSON'), /不是合法 JSON/u);
  assert.throws(() => parseSkillReleaseJson('[1,2]'), /必须是对象|需要 Skill 清单对象/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ id: 'Bad Id' }))), /包 ID/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ version: 'v2' }))), /语义版本/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ entrypoint: '..\\SKILL.md' }))), /相对路径/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ installPromptTemplate: '请读取文档安装。' }))), /\{skillPath\} 占位符/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [] }))), /文件清单不能为空/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [{ path: 'SKILL.md', bytes: 1, sha256: 'Z', downloadUrl: 'https://a.test' }] }))), /SHA-256/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [{ path: 'SKILL.md', bytes: 1, sha256: SHA, downloadUrl: 'http://a.test' }] }))), /HTTPS/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [{ path: 'other.md', bytes: 1, sha256: SHA, downloadUrl: 'https://a.test' }] }))), /入口文件/u);
});

test('parseSkillReleaseJson 拒绝重复路径与超限字节', () => {
  const file = { path: 'SKILL.md', bytes: 7727, sha256: SHA, downloadUrl: 'https://cdn.example.test/skill-kit/SKILL.md' };
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [file, file] }))), /路径重复/u);
  assert.throws(() => parseSkillReleaseJson(JSON.stringify(release({ files: [{ ...file, bytes: 6 * 1024 * 1024 }] }))), /字节数/u);
});

test('diff 只报可更新字段变更，锚定字段变更单独标红', () => {
  const before = release();
  const same = buildSkillReleaseDiff(before, release());
  assert.equal(same.kind, 'same-package');
  assert.equal(same.changes.length, 0);
  assert.equal(same.anchoredChanged.length, 0);

  const bumped = buildSkillReleaseDiff(before, release({ version: '0.3.0' }));
  assert.deepEqual(bumped.changes.map(change => change.field), ['version']);
  assert.equal(bumped.anchoredChanged.length, 0);

  const swapped = buildSkillReleaseDiff(before, release({ entrypoint: 'GUIDE.md', files: [{ ...before.files[0], path: 'GUIDE.md' }] }));
  assert.deepEqual(swapped.anchoredChanged, ['entrypoint']);
  assert.ok(swapped.changes.map(change => change.field).includes('files'));

  assert.equal(buildSkillReleaseDiff(null, before).kind, 'new-package');
});

test('后台页面与路由已接入两个 Skill 清单端点', () => {
  const page = read('../src/SkillCatalogAdmin.tsx');
  assert.match(page, /request\('\/v1\/site\/skill-catalog'\)/u);
  assert.match(page, /'\/v1\/admin\/site\/skill-catalog', \{ method: 'POST'/u);
  assert.match(page, /role === 'super_admin' \|\| role === 'operator'/u, '发布必须限 super_admin/operator');
  const shell = read('../src/main.tsx');
  assert.match(shell, /id:'skillcatalog',label:'灵码 Skill 发布'/u);
  assert.match(shell, /page==='skillcatalog'\?'site\/skill-catalog\/history'/u);
  assert.match(shell, /<SkillCatalogAdmin data=\{data\} request=\{request\} reload=\{reload\} role=\{role\}/u);
});
