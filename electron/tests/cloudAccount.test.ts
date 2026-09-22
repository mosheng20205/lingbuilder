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
  // 2026-09-22：AI 面板引擎收敛为本机 Agent（自带模型通道，不消耗云端点数），面板内不再有任何账号/点数 UI；
  // 账号与点数入口改由标题栏与欢迎页常驻承担。
  assert.doesNotMatch(assistant, /\u767b\u5f55|\u6ce8\u518c|\u53ef\u7528\u70b9\u6570|cloudAccountSessionStore/u);
  const titleBar = fs.readFileSync(new URL('../src/components/CloudAccountTitleBarEntry.tsx', import.meta.url), 'utf8');
  assert.match(titleBar, /\u767b\u5f55/u);
  assert.match(titleBar, /subscribeCloudAccountSession|getCloudAccountSessionState/u);
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

test('启用收费模块未登录时弹出全局登录框并在登录后自动继续授权', () => {
  const inspector = fs.readFileSync(new URL('../src/components/ModuleInspector.tsx', import.meta.url), 'utf8');
  const loginService = fs.readFileSync(new URL('../src/services/workbench/cloudAccountLoginService.ts', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  // 门禁收敛为 ensurePaidModuleAccess：先查 session，未登录弹全局登录框，取消则中止启用。
  assert.match(inspector, /const ensurePaidModuleAccess = async \(module: InstalledModule\)/u);
  assert.match(inspector, /await cloudModules\.session\(\)\.catch\(\(\) => null\)/u);
  assert.match(inspector, /if \(!session\?\.authenticated\) \{\s*const login = await requestCloudAccountLogin/u);
  assert.match(inspector, /已取消登录，未启用/u);
  // 登录成功后同一次点击流程内自动重跑授权并继续启用（不再有旧的纯 throw 状态文字门禁）。
  assert.match(inspector, /正在校验「\$\{module\.manifest\.name\}」授权/u);
  assert.match(inspector, /if \(!enabled && isPaidModule\(module\.manifest\.id\) && !await ensurePaidModuleAccess\(module\)\) return;/u);
  assert.doesNotMatch(inspector, /if \(!authorization\?\.status\?\.allowed\) throw new Error\(authorization\?\.status\?\.reason/u);
  // 已登录但无权益时给出购买引导而不是只写状态文字。
  assert.match(inspector, /需要模块授权/u);
  assert.match(inspector, /去购买/u);
  // 登录弹窗服务与顶层挂载齐备。
  assert.match(loginService, /export function requestCloudAccountLogin/u);
  assert.match(app, /<CloudAccountLoginDialog/u);
  assert.match(app, /subscribeCloudAccountLoginDialog\(setCloudAccountLoginDialog\)/u);
});

test('忘记密码走弹窗两步重置且云端 forgot 有 IP 限流', () => {
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const preload = fs.readFileSync(new URL('../electron/preload.ts', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  const apiTypes = fs.readFileSync(new URL('../src/electron-api.d.ts', import.meta.url), 'utf8');
  const dialog = fs.readFileSync(new URL('../src/components/CloudAccountLoginDialog.tsx', import.meta.url), 'utf8');
  const assistant = fs.readFileSync(new URL('../src/components/AiAssistant.tsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(cloud, /forgotPassword[\s\S]*\/v1\/auth\/password\/forgot/u);
  assert.match(cloud, /resetPassword[\s\S]*\/v1\/auth\/password\/reset/u);
  assert.match(main, /ipcMain\.handle\('cloud-account:forgot-password'/u);
  assert.match(main, /ipcMain\.handle\('cloud-account:reset-password'/u);
  assert.match(preload, /forgotPassword: \(value: \{ email: string \}\)/u);
  assert.match(preload, /resetPassword: \(value: \{ token: string; password: string \}\)/u);
  assert.match(apiTypes, /forgotPassword: \(value: \{ email: string \}\) => Promise<\{ ok: boolean \}>/u);
  // 两步重置在同一弹窗内完成：邮箱 → 令牌+新密码（本地校验与云端规则一致）→ 回登录态。
  assert.match(dialog, /发送重置邮件/u);
  assert.match(dialog, /重置令牌/u);
  assert.match(dialog, /密码需要 10 至 128 位，并同时包含字母和数字/u);
  assert.match(dialog, /密码已重置/u);
  assert.match(dialog, /忘记密码？/u);
  // 2026-09-22：AI 面板不再承载账号入口，登录/注册/忘记密码改由设置「账号」分类与命令出口复用同一个顶层对话框。
  const settings = fs.readFileSync(new URL('../src/components/SettingsDialog.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(assistant, /requestCloudAccountLogin|openAccountDialog/u);
  assert.match(settings, /requestCloudAccountLogin\(\{ initialMode: 'reset' \}\)/u);
  assert.match(settings, /requestCloudAccountLogin\(\{ initialMode: 'register' \}\)/u);
  assert.match(app, /requestCloudAccountLogin\(\{ initialMode: 'reset' \}\)/u);
  // 云端 forgot 必须有 IP 限流且防枚举恒 ok。
  const cloudService = fs.readFileSync(new URL('../../cloud/api/src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(cloudService, /auth:forgot:\$\{ip \|\| 'unknown'\}`, 20, 900\)/u);
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
  // 导入结果结构与诊断校验收口到 aiModuleGenerationFlow（聊天面板与模块面板共用唯一实现）。
  const moduleFlow = fs.readFileSync(new URL('../src/services/modules/aiModuleGenerationFlow.ts', import.meta.url), 'utf8');
  assert.match(moduleFlow, /typeof imported\.moduleId !== 'string'/u);
  assert.match(moduleFlow, /typeof item === 'string'/u);
});

test('AI 面板编辑链随工作区切换重建并在提示词中携带控件运行时命令清单', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  // 工作区切换必须重建面板 AI 服务：AiBridgeService 在构造期快照 workspaceRoot，
  // 单例复用会让提案/应用继续读写切换前的旧工作区（写读分裂、应用后画布无变化）。
  assert.match(server, /panelAiBridgeService = createPanelAiBridgeService\(\)/u);
  assert.match(server, /panelAiBridgeService = createPanelAiBridgeService\(\);[\s\S]{0,400}workspaceRuntimeVersion \+= 1/u);
  // planner 提示词必须携带涉及控件的规范运行时命令清单并禁止成员调用写法
  // （数据表格1.添加行 这类写法不被源码支持，会以「找不到功能库」阻断构建）。
  assert.match(server, /describeInvolvedDesignerControlCommands\(context\.designerProject\)/u);
  assert.match(server, /禁止使用「控件名\.方法\(\.\.\.\)」成员调用写法/u);
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
  // new_emoji.ui 必须随安装包内置（排除仅限 cef3/fbro 两个大体积 SDK），漏包会让用户启用外壳时报缺依赖。
  assert.ok(!moduleResource.filter.some((item: string) => item.includes('new_emoji')), 'lingbuilder.new_emoji.ui 不得被 extraResources 排除');
  assert.ok(moduleResource.filter.includes('!lingbuilder.cef3.sdk/**/*'));
  assert.ok(moduleResource.filter.includes('!lingbuilder.fbro.sdk/**/*'));
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
