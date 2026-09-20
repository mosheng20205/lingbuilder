#!/usr/bin/env node
/**
 * 灵码 Skill 包随包完整性校验。
 *   node scripts/verify-skill-kit-package.cjs                 # 打包前：校验仓库内 skill-kit 与清单一致
 *   node scripts/verify-skill-kit-package.cjs --unpacked      # 打包后：校验 release/win-unpacked/resources/skill-kit 完整落包
 *   node scripts/verify-skill-kit-package.cjs --unpacked --dir <发布目录>   # 校验指定输出目录（独立发布目录时用）
 * 背景：examples/ 不随安装包分发导致打包版取不到语料是已踩过的坑，skill-kit 必须随包且可校验。
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const electronRoot = path.resolve(__dirname, '..');
const mode = process.argv.includes('--unpacked') ? 'unpacked' : 'source';
const dirIndex = process.argv.indexOf('--dir');
const explicitDir = dirIndex >= 0 ? String(process.argv[dirIndex + 1] || '').trim() : '';
const sourceDir = path.join(electronRoot, 'skill-kit');
const targetDir = mode === 'unpacked'
  ? path.join(explicitDir || path.join(electronRoot, 'release', 'win-unpacked'), 'resources', 'skill-kit')
  : sourceDir;
const problems = [];
const notes = [];

function fail(message) { problems.push(message); }

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`manifest.json 解析失败：${error.message}`);
    return null;
  }
}

const manifest = readManifest(targetDir);
if (!manifest) {
  fail(`${targetDir} 缺少可解析的 manifest.json（${mode === 'unpacked' ? '安装包未落包 skill-kit，检查 build.extraResources' : '仓库内 skill-kit 缺失'}）`);
} else {
  for (const entry of manifest.files || []) {
    const file = path.join(targetDir, entry.path);
    if (!fs.existsSync(file)) {
      fail(`缺失文件：${entry.path}`);
      continue;
    }
    const content = fs.readFileSync(file);
    if (content.length !== entry.bytes) fail(`${entry.path} 字节数不符：实际 ${content.length}，清单 ${entry.bytes}`);
    if (sha256(content) !== entry.sha256) fail(`${entry.path} SHA-256 与清单不一致`);
  }
  if (!fs.existsSync(path.join(targetDir, manifest.entrypoint || 'SKILL.md'))) fail(`入口文件不存在：${manifest.entrypoint}`);
  notes.push(`sequence=${manifest.sequence} version=${manifest.version} files=${(manifest.files || []).length}`);

  if (mode === 'unpacked') {
    const sourceManifest = readManifest(sourceDir);
    if (!sourceManifest) {
      fail(`仓库内 ${sourceDir} 不可用，无法比对`);
    } else if (sourceManifest.sequence !== manifest.sequence || sourceManifest.version !== manifest.version) {
      fail(`安装包与仓库的 skill-kit 版本不一致：包内 ${manifest.version}/${manifest.sequence}，仓库 ${sourceManifest.version}/${sourceManifest.sequence}`);
    } else {
      for (const entry of sourceManifest.files || []) {
        const packed = path.join(targetDir, entry.path);
        const origin = path.join(sourceDir, entry.path);
        if (!fs.existsSync(packed) || !fs.existsSync(origin)) continue;
        if (sha256(fs.readFileSync(packed)) !== sha256(fs.readFileSync(origin))) fail(`${entry.path} 包内内容与仓库不一致（旧包或漏更新）`);
      }
    }
  }
}

console.log(`[skill-kit] 模式：${mode}，目录：${targetDir}`);
for (const note of notes) console.log(`[skill-kit] ${note}`);
if (problems.length) {
  for (const problem of problems) console.error(`[skill-kit] 失败：${problem}`);
  process.exitCode = 1;
  return;
}
console.log('[skill-kit] 校验通过');
