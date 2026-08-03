import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('system AI account tokens stay in Electron safeStorage and streaming is cancellable', () => {
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  const assistant = fs.readFileSync(new URL('../src/components/AiAssistant.tsx', import.meta.url), 'utf8');
  assert.match(main, /safeStorage\.encryptString/u);
  assert.match(main, /cloud-refresh-token\.bin/u);
  assert.doesNotMatch(assistant, /localStorage.*refresh/iu);
  assert.match(cloud, /AbortController/u);
  assert.match(assistant, /系统 AI/u);
  assert.match(assistant, /零保留/u);
});

test('收费模块授权失败只向界面返回可操作的中文错误', () => {
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  const inspector = fs.readFileSync(new URL('../src/components/ModuleInspector.tsx', import.meta.url), 'utf8');
  assert.match(main, /cloud-modules:authorize[\s\S]+return \{ ok: false, error:/u);
  assert.match(cloud, /无法连接 LingBuilder 云端服务/u);
  assert.match(cloud, /请先注册并登录 LingBuilder 账号/u);
  assert.match(inspector, /formatModuleOperationError/u);
  assert.match(inspector, /无法连接模块授权服务/u);
  assert.match(inspector, /QRCode\.toDataURL/u);
  assert.match(inspector, /扫码付款/u);
  assert.doesNotMatch(inspector, /项目模块状态更新失败：\$\{error instanceof Error/u);
});

test('收费模块只经登录后的受保护接口下载并完成签名与摘要校验', () => {
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../cloud/api/src/modules/module-commerce.controller.ts', import.meta.url), 'utf8');
  const packageConfig = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const moduleResource = packageConfig.build.extraResources.find((item: any) => item.to === 'default-workspace/.lingbuilder/modules');
  assert.match(cloud, /modules\/artifacts\/latest/u);
  assert.match(cloud, /crypto\.verify/u);
  assert.match(cloud, /SHA-256/u);
  assert.match(controller, /modules\/artifacts\/:artifactId\/download/u);
  assert.doesNotMatch(controller, /module-store\/catalog/u);
  assert.ok(moduleResource.filter.includes('!lingbuilder.new_emoji.ui/**/*'));
});

test('安装包必须明确选择公网 HTTPS 或离线云端模式', () => {
  const script = fs.readFileSync(new URL('../scripts/prepare-cloud-release-config.cjs', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  assert.match(script, /startsWith\('https:\/\/'\)/u);
  assert.match(script, /LINGBUILDER_CLOUD_RELEASE_MODE/u);
  assert.match(script, /cloudMode: 'offline'/u);
  assert.match(main, /cloud-release\.json/u);
  assert.match(main, /cloud-offline\.invalid/u);
  assert.match(main, /cloud-config-missing\.invalid/u);
});
