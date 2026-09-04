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
  assert.match(assistant, /可用点数/u);
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

test('AI 模块导入失败结果提供复制完整错误详情的入口', () => {
  const inspector = fs.readFileSync(new URL('../src/components/ModuleInspector.tsx', import.meta.url), 'utf8');
  assert.match(inspector, /aria-label="复制 AI 模块错误详情"/u);
  assert.match(inspector, /formatAiModuleImportResultForClipboard\(result\)/u);
  assert.match(inspector, /复制 AI 模块错误详情失败，请选中错误文本后手动复制/u);
  assert.match(inspector, /document\.execCommand\('copy'\)/u);
  assert.match(inspector, /overwrittenExisting/u);
  assert.match(inspector, /复制 AI 模块解析诊断/u);
  assert.match(inspector, /const canImportAiFiles = parsedAiFiles\.files\.length > 0[\s\S]+?parsedAiFiles\.diagnostics\.length === 0/u);
  assert.match(inspector, /const importSucceeded = diagnostics.length === 0/u);
  assert.match(inspector, /AI 模块导入未通过：/u);
  assert.match(inspector, /typeof result\.result\.moduleId !== 'string'/u);
  assert.match(inspector, /typeof item === 'string'/u);
});

test('AI 模块手动校验和导出入口继续使用严格完整性门禁', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const moduleService = fs.readFileSync(new URL('../src/services/modules/moduleService.ts', import.meta.url), 'utf8');
  assert.match(server, /validateModuleDirectory\(resolvedModulePath, \{\s*requireCommandBindings: true,\s*requireNonEmptyDocumentsAndExamples: true\s*\}\)/u);
  assert.match(server, /exportModulePackage\(resolvedModuleDir, resolvedTargetPath, \{\s*requireCommandBindings: true,\s*requireNonEmptyDocumentsAndExamples: true\s*\}\)/u);
  assert.match(moduleService, /exportModulePackage\(moduleDir: string, targetPath: string, options: ModuleValidationOptions = \{\}\)/u);
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
