import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('system AI account tokens stay in Electron safeStorage and streaming is cancellable', () => {
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  assert.match(main, /safeStorage\.encryptString/u);
  assert.match(main, /cloud-refresh-token\.bin/u);
  assert.match(cloud, /AbortController/u);
  // 2026-10-02：AI 助手面板与内嵌 Agent 运行时整体退场；账号令牌只留在主进程 safeStorage，
  // 渲染层源码不得出现刷新令牌的本地持久化（账号入口按产品口径保留在欢迎页/帮助菜单/设置页）。
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /localStorage.*refresh/iu);
  assert.doesNotMatch(app, /CloudAccountTitleBarEntry|workbench\.action\.account\.recharge/u, '标题栏点数徽标与充值命令必须退场');
  assert.match(app, /<CloudAccountLoginDialog/u, '登录弹窗仍由欢迎页与工作台常驻挂载');
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
  const recovery = fs.readFileSync(new URL('../src/services/modules/paidModuleAccessRecovery.ts', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  // 门禁收敛为共享恢复流：ensurePaidModuleAccess 调 recoverPaidModuleAccess（唯一出口），
  // 未登录由共享流弹全局登录框，登录后自动 authorizeModule 换发授权并继续。
  assert.match(inspector, /const ensurePaidModuleAccess = async \(module: InstalledModule\)/u);
  assert.match(inspector, /await recoverPaidModuleAccess\(module\.manifest\.id/u);
  assert.match(inspector, /已取消登录，未启用/u);
  assert.match(recovery, /const session = await bridge\.session\(\)\.catch\(\(\) => null\)/u);
  assert.match(recovery, /const login = await requestCloudAccountLogin/u);
  assert.match(recovery, /const authorization = await bridge\.authorizeModule\(moduleId\)\.catch\(\(\) => null\)/u);
  // 登录成功后同一次流程内自动换发授权并继续（不再有旧的纯 throw 状态文字门禁）。
  assert.match(recovery, /if \(authorization\.status\?\.allowed\) return \{ recovered: true/u);
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
  // 2026-10-02：AI 助手面板整体退场，登录/注册/忘记密码由设置「账号」分类与命令出口复用同一个顶层对话框。
  const settings = fs.readFileSync(new URL('../src/components/SettingsDialog.tsx', import.meta.url), 'utf8');
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

test('AI 面板编辑链与内嵌 Agent 已整体退场（2026-10-02），server.ts 不得残留面板服务实例', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /panelAiBridgeService|createPanelAiBridgeService|planLingCppEditWithGemini|agentProposalStore/u);
  assert.doesNotMatch(server, /\/api\/lingcpp\/edit\/|\/api\/ai\/chat|\/api\/ai\/conversations|\/api\/ai\/connect|\/api\/ai\/models/u);
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

test('刷新令牌清除语义收口：调用点禁止无条件 clear，清除仅限云端 401 判定且刷新在途去重', () => {
  const cloud = fs.readFileSync(new URL('../electron/cloudAccountService.ts', import.meta.url), 'utf8');
  // 2026-10-07：initialize/moduleCatalog/betaProgram 曾在刷新失败时无条件清空令牌文件，
  // 网络抖动或云端 5xx 就会永久丢登录（用户「装新包后登录状态丢失」的根因之一）。
  assert.doesNotMatch(cloud, /catch\(\(\) => this\.clear\(\)\)/u, '刷新失败禁止无条件清除登录凭据');
  assert.match(cloud, /refreshInFlight/u, '刷新必须有在途去重：同一令牌并发双发会触发云端重复使用检测并撤销全会话族');
  assert.match(cloud, /isCloudAuthInvalidError/u);
  assert.match(cloud, /已清除本地登录凭据/u);
  assert.match(cloud, /本地登录凭据已保留/u);
});

test('刷新令牌行为回归：401 才清凭据、网络失败保留并可再生、并发刷新合并为一次请求', async (t) => {
  const { CloudAccountService } = await import('../electron/cloudAccountService.ts');
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  // 场景一：启动恢复时云端明确 401（令牌失效/被撤销）→ 清除本地凭据并保留报错原因。
  let storedToken = 'stale-refresh-token';
  const service401 = new CloudAccountService('https://cloud.test', async () => storedToken, async (value) => { storedToken = value; });
  globalThis.fetch = (async () => jsonResponse({ message: '刷新令牌无效或已过期。' }, 401)) as never;
  await assert.rejects(service401.initialize(), /刷新令牌无效或已过期/u);
  assert.equal(storedToken, '', '云端 401 后必须清除本地刷新令牌');

  // 场景二：网络失败 → 令牌保留；云端恢复后同一令牌直接恢复登录，轮换令牌立即落盘。
  storedToken = 'kept-refresh-token';
  const serviceNet = new CloudAccountService('https://cloud.test', async () => storedToken, async (value) => { storedToken = value; });
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as never;
  await assert.rejects(serviceNet.initialize(), /无法连接 LingBuilder 云端服务/u);
  assert.equal(storedToken, 'kept-refresh-token', '网络失败后本地刷新令牌必须保留');
  assert.equal((await serviceNet.snapshot()).authenticated, false);
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.endsWith('/v1/auth/refresh')) return jsonResponse({ accessToken: 'at-1', refreshToken: 'rt-2', expiresIn: 900 });
    if (url.endsWith('/v1/me')) return jsonResponse({ user: { email: 'user@lingbuilder.test' } });
    if (url.endsWith('/v1/usage/balance')) return jsonResponse({ balance: { available: '0', reserved: '0' } });
    throw new Error(`unexpected url: ${url}`);
  }) as never;
  const session = await serviceNet.snapshot();
  assert.equal(session.authenticated, true, '网络恢复后同一令牌应能恢复登录');
  assert.equal(storedToken, 'rt-2', '轮换后的刷新令牌必须立即落盘');

  // 场景三：并发刷新共享同一在途请求，绝不把同一刷新令牌并发双发。
  let refreshCalls = 0;
  const serviceRace = new CloudAccountService('https://cloud.test', async () => 'rt-race', async () => undefined);
  globalThis.fetch = (async (input: any) => {
    if (String(input).endsWith('/v1/auth/refresh')) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return jsonResponse({ accessToken: 'at-2', refreshToken: 'rt-3', expiresIn: 900 });
    }
    if (String(input).endsWith('/v1/me')) return jsonResponse({ user: { email: 'user@lingbuilder.test' } });
    if (String(input).endsWith('/v1/usage/balance')) return jsonResponse({ balance: { available: '0', reserved: '0' } });
    if (String(input).endsWith('/v1/modules/catalog')) return jsonResponse({ ok: true, products: [] });
    throw new Error(`unexpected url: ${String(input)}`);
  }) as never;
  const initializeDone = serviceRace.initialize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.all([serviceRace.moduleCatalog(), serviceRace.snapshot(), serviceRace.currentAccessToken()]);
  await initializeDone;
  assert.equal(refreshCalls, 1, '并发刷新必须合并为一次请求');
});
