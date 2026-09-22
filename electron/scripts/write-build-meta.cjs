#!/usr/bin/env node
// 构建期生成 dist/build-meta.json：主进程「构建自愈重启」的身份判据 + 标题栏构建时间展示。
// 必须在 vite build 之后执行（vite 会清空 dist）；electron-builder files 含 dist/**，随 asar 分发。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const appDir = path.join(__dirname, '..');
const distDir = path.join(appDir, 'dist');
fs.mkdirSync(distDir, { recursive: true });

let gitHash = 'unknown';
try {
  gitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: appDir, encoding: 'utf8' }).trim() || 'unknown';
} catch {
  // 非 git 环境（如直接解包构建）容忍缺失。
}

const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const meta = {
  version: String(pkg.version || '0.0.0'),
  buildTime: new Date().toISOString(),
  gitHash
};
fs.writeFileSync(path.join(distDir, 'build-meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
console.log(`[build-meta] ${meta.version} · ${meta.buildTime} · ${meta.gitHash}`);
