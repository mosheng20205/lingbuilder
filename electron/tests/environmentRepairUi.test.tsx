import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('environment repair center exposes confirmation, progress, retry, accessibility, and optional tools', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/EnvironmentRepairCenter.tsx'),
    'utf8'
  );
  assert.match(source, /环境修复中心/u);
  assert.match(source, /\/api\/environment\/check/u);
  assert.match(source, /\/api\/environment\/repair\/start/u);
  assert.match(source, /\/api\/environment\/repair\/status/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /role="alertdialog"/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /重新检测/u);
  assert.match(source, /高级替代工具链/u);
  assert.match(source, /LingBuilder 原生 MSVC 构建环境/u);
  assert.match(source, /不能替代 LingBuilder 默认 Win32 构建/u);
  assert.match(source, /item\.required \? '必需' : '可选'/u);
  assert.match(source, /关闭窗口不会中断微软安装程序/u);
  assert.doesNotMatch(source, /window\.confirm/u);
});

test('Windows installer detects WebView2 and uses a frozen official bootstrapper', async () => {
  const [installer, packageJson, preparation] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../installer/installer.nsh'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../package.json'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../scripts/prepare-webview2-bootstrapper.cjs'), 'utf8')
  ]);
  assert.match(installer, /F3017226-FE2A-4295-8BDF-00C3A9A7E4C5/u);
  assert.match(installer, /MicrosoftEdgeWebview2Setup\.exe/u);
  assert.match(preparation, /已复用本地 WebView2 Bootstrapper/u);
  assert.match(preparation, /verifyMicrosoftSignature\(filePath\)/u);
  assert.match(installer, /\/silent \/install/u);
  assert.match(packageJson, /prepare:webview2/u);
  assert.match(packageJson, /installer\/installer\.nsh/u);
  assert.match(preparation, /LinkId=2124703/u);
  assert.match(preparation, /MZ/u);
  assert.match(preparation, /Get-AuthenticodeSignature/u);
  assert.match(preparation, /microsoft\.com/u);
});
