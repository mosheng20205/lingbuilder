const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const BASELINES = [
  { version: '1.0.3537.50', runtimeMajor: 141, headerSha256: '387a0524c1a4498db32756a6d3b1f4d43a90ac80cb921527f15d3dbf4a857459' },
  { version: '1.0.4078.44', runtimeMajor: 150, headerSha256: 'dff1e3181ec7ec203a34ef6efa966590e0ef0ba1a5c3fe3b69da6508c2f8a02e' }
];

const EXCLUSIONS = [
  { pattern: /CompositionController|CompositionControllerOptions|PointerInfo|AutomationProvider|RootVisualTarget|SystemCursorId|NonClientRegion|DragStarting/iu, reason: '仅适用于 CompositionController、指针输入或自动化提供器，超出普通 HWND 后端边界。' },
  { pattern: /AddHostObjectToScript|AddHostObjectToScriptWithOrigins|RemoveHostObjectFromScript/iu, reason: 'Host Object 会注入任意 COM 对象，固定安全边界禁止公开。' },
  { pattern: /get_NativeWindow|get_ParentWindow|put_ParentWindow|GetFileMappingHandle/iu, reason: '返回或接收裸 HWND/HANDLE，固定安全边界禁止公开。' },
  { pattern: /ICoreWebView2CursorChangedEventHandler/iu, reason: 'CursorChanged 仅属于 CompositionController，普通 HWND 控制器不可达。' },
  { pattern: /ICoreWebView2BasicAuthenticationResponse\.get_(?:UserName|Password)/iu, reason: '认证响应 getter 可能回读敏感凭据；安全层只允许在当前决策事件内写入。' }
];

const INTERNAL_ADAPTERS = [
  { id: 'managed-task.completed-handler', owner: /CompletedHandler$/u, evidence: ['EdgeViewTaskState', 'EdgeView任务_完成'], reason: 'CompletedHandler 由五态受管任务统一消费。' },
  { id: 'event.dispatch-handler', owner: /EventHandler$/u, evidence: ['EdgeView_记录事件', 'Callback<'], reason: '事件处理器由事件目录和窗口线程分发器内部消费。' },
  { id: 'event.arguments-json', owner: /EventArgs$/u, evidence: ['EdgeView_事件数据', 'eventFields'], reason: '事件参数转换成限长 UTF-16 JSON 和同步决策上下文。' },
  { id: 'collection.json-enumerator', owner: /(?:Collection|CollectionView|List|Iterator)$/u, evidence: ['get_Count', 'GetValueAtIndex'], reason: '集合和迭代器由 JSON/受管句柄枚举适配器内部消费。' },
  { id: 'settings.typed-options', owner: /(?:Settings|Options|PrintSettings|FindOptions)$/u, evidence: ['EdgeView设置_', 'EdgeView打印_'], reason: '设置对象由类型化 getter/setter 或设置 JSON 适配器内部消费。' },
  { id: 'network.safe-resource', owner: /(?:HttpRequestHeaders|HttpResponseHeaders|WebResourceRequest|WebResourceResponse|WebResourceResponseView)$/u, evidence: ['EdgeView资源_', 'CreateWebResourceRequest'], reason: '请求、响应、头和正文由文本、十六进制、文件或受管缓冲适配。' },
  { id: 'session.cookie-json', owner: /(?:Cookie|CookieManager|CookieList)$/u, evidence: ['EdgeView会话_取Cookie异步', 'CreateCookie'], reason: 'Cookie 对象由类型化命令和 JSON 列表内部消费。' },
  { id: 'managed-object.safe-handle', owner: /(?:FrameInfo|ProcessInfo|ClientCertificate|Certificate|Notification|BrowserExtension|SharedBuffer|DedicatedWorker|SharedWorker|ServiceWorker|FileSystemHandle)/u, evidence: ['EdgeViewManagedObjectState', 'EdgeView对象_注册'], reason: '对象通过类型、控件 generation 与线程校验的不可复用句柄适配。' },
  { id: 'deferral.scoped-decision', owner: /Deferral$/u, evidence: ['eventDecisionActive', 'EdgeView_记录事件'], reason: 'Deferral 仅在同步决策事件作用域内部使用。' }
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const catalogPath = path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'edgeViewApiCatalog.ts');
  const eventsPath = path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'edgeViewBrowserEvents.ts');
  const runtimePaths = [
    path.join(repoRoot, 'electron', 'src', 'services', 'windowDesigner', 'edgeViewRuntime.ts'),
    path.join(repoRoot, 'electron', 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts')
  ];
  const outputPath = path.resolve(args.output || path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'edgeViewApiCoverage.generated.json'));
  const [catalog, events, ...runtimeParts] = await Promise.all([fs.readFile(catalogPath, 'utf8'), fs.readFile(eventsPath, 'utf8'), ...runtimePaths.map(file => fs.readFile(file, 'utf8'))]);
  const runtime = runtimeParts.join('\n');
  const catalogEntries = loadCatalogEntries(catalog, catalogPath);
  const catalogMembers = new Map();
  for (const entry of catalogEntries) for (const member of entry.sdkMembers || []) {
    const commands = catalogMembers.get(member) || []; commands.push(entry.command.name); catalogMembers.set(member, commands);
  }
  const runtimeSymbols = new Set(catalogEntries.map(entry => entry.runtimeSymbol));
  const generatedRuntimeSymbols = extractGeneratedSettingSymbols(runtime);
  for (const symbol of extractGeneratedPrintSymbols(runtime)) generatedRuntimeSymbols.add(symbol);
  const missingRuntimeSymbols = [...runtimeSymbols].filter(symbol => !runtime.includes(symbol) && !generatedRuntimeSymbols.has(symbol));
  if (missingRuntimeSymbols.length) throw new Error(`EdgeView 目录声称实现但缺少运行时符号：${missingRuntimeSymbols.join('、')}`);

  const baselineResults = [];
  for (const baseline of BASELINES) {
    const sdkRoot = resolveSdkRoot(args, baseline.version);
    const headerPath = path.join(sdkRoot, 'build', 'native', 'include', 'WebView2.h');
    const header = await fs.readFile(headerPath, 'utf8');
    const actualHash = sha256(header);
    if (actualHash !== baseline.headerSha256) throw new Error(`WebView2 ${baseline.version} 头文件哈希漂移：期望 ${baseline.headerSha256}，实际 ${actualHash}`);
    const methods = extractMethods(header).map(method => classify(method, baseline, catalogMembers, events, runtime));
    baselineResults.push({ ...baseline, package: 'Microsoft.Web.WebView2', headerSha256: actualHash, methodCount: methods.length, summary: summarize(methods), methods });
  }
  const oldIds = new Set(baselineResults[0].methods.map(method => `${method.owner}.${method.method}.${method.officialSignature}`));
  const delta = baselineResults[1].methods.filter(method => !oldIds.has(`${method.owner}.${method.method}.${method.officialSignature}`)).map(method => method.id);
  const result = {
    schemaVersion: 2,
    generatedFrom: 'build/native/include/WebView2.h',
    baselines: baselineResults,
    latest: { version: BASELINES[1].version, runtimeMajor: BASELINES[1].runtimeMajor, methodCount: baselineResults[1].methodCount, summary: baselineResults[1].summary },
    delta: { from: BASELINES[0].version, to: BASELINES[1].version, addedMethodCount: delta.length, addedMethodIds: delta },
    commandCount: runtimeSymbols.size,
    runtimeSymbolCheck: { checkedFiles: runtimePaths.map(file => path.relative(repoRoot, file).replaceAll('\\', '/')), missing: [] },
    excludedPolicy: EXCLUSIONS.map(item => item.reason),
    methods: baselineResults[1].methods
  };
  validate(result, args.complete);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.check) {
    const existing = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== json) throw new Error('EdgeView SDK 覆盖清单已漂移，请运行 npm run module:edgeview-coverage。');
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, 'utf8');
  }
  console.log(`EdgeView coverage: ${baselineResults.map(item => `${item.version} methods=${item.methodCount}`).join(', ')}, delta=${delta.length}, commands=${runtimeSymbols.size}, ${Object.entries(result.latest.summary).map(([key, value]) => `${key}=${value}`).join(', ')}`);
}

function resolveSdkRoot(args, version) {
  if (args.sdk && version === BASELINES[1].version) return path.resolve(args.sdk);
  const packageRoot = process.env.USERPROFILE || '';
  return path.join(packageRoot, '.nuget', 'packages', 'microsoft.web.webview2', version);
}

function loadCatalogEntries(source, fileName) {
  const compiled = ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const localRequire = specifier => {
    if (specifier !== './bindingValueType') throw new Error(`覆盖生成器不允许目录运行时依赖：${specifier}`);
    const dependencyPath = path.join(path.dirname(fileName), 'bindingValueType.ts');
    const dependencySource = require('node:fs').readFileSync(dependencyPath, 'utf8');
    const dependencyCompiled = ts.transpileModule(dependencySource, { fileName: dependencyPath, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const dependencyModule = { exports: {} };
    new Function('exports', 'require', 'module', '__filename', '__dirname', dependencyCompiled)(dependencyModule.exports, () => ({}), dependencyModule, dependencyPath, path.dirname(dependencyPath));
    return dependencyModule.exports;
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(module.exports, localRequire, module, fileName, path.dirname(fileName));
  const entries = module.exports.EDGEVIEW_SAFE_API_CATALOG;
  if (!Array.isArray(entries)) throw new Error('无法加载 EdgeView 集中式 API 目录。');
  return entries;
}

function extractCatalogMembers(source) {
  const result = new Map();
  const add = (member, command) => { const commands = result.get(member) || []; if (!commands.includes(command)) commands.push(command); result.set(member, commands); };
  for (const match of source.matchAll(/['"](ICoreWebView2[^'"]*\.[A-Za-z0-9_]+)['"]/gu)) {
    const prefix = source.slice(0, match.index); const apiStart = prefix.lastIndexOf('api('); const fragment = source.slice(apiStart, match.index + match[0].length);
    const command = fragment.match(/^api\(\s*'[^']+'\s*,\s*'([^']+)'/u)?.[1] || '内部生成命令';
    add(match[1], command);
  }
  const settingBlock = source.match(/\.\.\.\[([\s\S]*?)\]\.flatMap\(\(\[label, member, version\]\)/u)?.[1] || '';
  for (const match of settingBlock.matchAll(/\['([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\]/gu)) {
    const owner = Number(match[3]) === 1 ? 'ICoreWebView2Settings' : `ICoreWebView2Settings${match[3]}`;
    add(`${owner}.${match[2]}`, `EdgeView设置_取${match[1]}`); add(`${owner}.${match[2]}`, `EdgeView设置_置${match[1]}`);
  }
  return result;
}

function extractCatalogRuntimeSymbols(source) {
  const symbols = new Set([...source.matchAll(/\bapi\(\s*'[^']+'\s*,\s*'(EdgeView[^']+)'/gu)].map(match => match[1]));
  const generatedSettings = source.match(/\.\.\.\[([\s\S]*?)\]\.flatMap\(\(\[label, member(?:, version)?\]\)/u)?.[1] || '';
  for (const match of generatedSettings.matchAll(/\['([^']+)'\s*,\s*'[^']+'(?:\s*,\s*\d+)?\]/gu)) { symbols.add(`EdgeView设置_置${match[1]}`); symbols.add(`EdgeView设置_取${match[1]}`); }
  return symbols;
}

function extractGeneratedSettingSymbols(source) {
  const declaration = source.match(/const SETTING_MEMBERS[^=]*=\s*\[([\s\S]*?)\];/u)?.[1] || ''; const result = new Set();
  for (const match of declaration.matchAll(/\['([^']+)'\s*,\s*'[^']+'\s*,\s*\d+\]/gu)) { result.add(`EdgeView设置_置${match[1]}`); result.add(`EdgeView设置_取${match[1]}`); }
  return result;
}

function extractGeneratedPrintSymbols(source) {
  const body = source.match(/function printSettingsWrappers\(\): string \{([\s\S]*?)\n\}/u)?.[1] || ''; const result = new Set();
  for (const match of body.matchAll(/\['([^']+)'\s*,\s*'[^']+'/gu)) { result.add(`EdgeView打印_置${match[1]}`); result.add(`EdgeView打印_取${match[1]}`); }
  return result;
}

function extractMethods(source) {
  const result = []; const interfacePattern = /MIDL_INTERFACE\("[^"]+"\)\s+([A-Za-z0-9_]+)\s*:\s*public\s+[A-Za-z0-9_]+\s*\{([\s\S]*?)\n\s*\};/gu;
  for (const match of source.matchAll(interfacePattern)) {
    const owner = match[1].trim(); const body = match[2]; const methodPattern = /virtual(?:\s|\/\*[\s\S]*?\*\/)+HRESULT\s+STDMETHODCALLTYPE\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*=\s*0\s*;/gu;
    for (const method of body.matchAll(methodPattern)) {
      const officialName = method[1].replace(/^(?:get_|put_|add_|remove_)/u, ''); const officialSignature = normalize(method[0].replace(/^virtual\s+/u, ''));
      result.push({ id: `webview2.${owner}.${method[1]}.${sha256(officialSignature).slice(0, 12)}`, owner, method: method[1], officialName, officialSignature, minimumInterface: owner, signature: `${owner}.${officialName}` });
    }
  }
  return result.sort((left, right) => left.owner.localeCompare(right.owner, 'en') || left.method.localeCompare(right.method, 'en'));
}

function classify(method, baseline, catalogMembers, events, runtime) {
  const common = { ...method, minimumSdk: baseline.version, minimumRuntimeMajor: baseline.runtimeMajor };
  const catalogCommands = catalogMembers.get(method.signature) || [];
  const command = catalogCommands.find(value => method.method.startsWith('put_') ? value.includes('_置') : method.method.startsWith('get_') ? value.includes('_取') : true) || catalogCommands[0];
  if (command) return { ...common, status: 'implemented-public', chineseCommand: command, adapterId: `command.${command}`, runtimeSymbol: command, testId: `edgeview.command.${command}`, reason: '集中式目录声明了类型化中文命令，且运行时符号检查已通过。' };
  const exclusion = EXCLUSIONS.find(item => item.pattern.test(`${method.owner}.${method.method}`));
  if (exclusion) return { ...common, status: 'excluded', chineseCommand: null, adapterId: null, runtimeSymbol: null, testId: `edgeview.excluded.${method.owner}.${method.method}`, reason: exclusion.reason };
  if (/^(?:add_|remove_)/u.test(method.method)) {
    const eventDeclared = events.includes(`'${method.officialName}'`) || events.includes(`.${method.officialName}'`);
    const runtimeEvidence = runtime.includes(`add_${method.officialName}`);
    if (eventDeclared && runtimeEvidence) return { ...common, status: 'implemented-internal', chineseCommand: 'EdgeView_绑定控件事件', adapterId: 'event.catalog-registration', runtimeSymbol: `add_${method.officialName}`, testId: `edgeview.event.${method.owner}.${method.officialName}`, reason: '事件目录存在声明，运行时存在注册调用；注销由对象关闭和 generation 失效统一完成。' };
    return pending(common, '事件 add/remove 缺少事件目录声明或真实注册证据。');
  }
  if (runtime.includes(method.owner) && runtime.includes(`->${method.method}(`)) {
    return { ...common, status: 'implemented-internal', chineseCommand: null, adapterId: `native-call.${method.owner}.${method.method}`, runtimeSymbol: `${method.owner}->${method.method}`, testId: `edgeview.native-call.${method.owner}.${method.method}`, reason: '该成员由生成运行时中的显式接口调用内部消费，不向中文源码暴露 COM 对象。' };
  }
  for (const adapter of INTERNAL_ADAPTERS) {
    if (!adapter.owner.test(method.owner)) continue;
    if (!adapter.evidence.every(value => runtime.includes(value))) return pending(common, `适配器 ${adapter.id} 缺少运行时调用证据。`);
    if (/Handler$/u.test(method.owner) && !runtime.includes(method.owner)) return pending(common, `回调接口 ${method.owner} 尚未在运行时实例化。`);
    return { ...common, status: 'implemented-internal', chineseCommand: null, adapterId: adapter.id, runtimeSymbol: adapter.evidence.join(' + '), testId: `edgeview.adapter.${adapter.id}`, reason: adapter.reason };
  }
  return pending(common, '尚无公开中文命令、内部适配器或批准排除规则。');
}

function pending(common, reason) { return { ...common, status: 'pending', chineseCommand: null, adapterId: null, runtimeSymbol: null, testId: null, reason }; }
function summarize(methods) { return methods.reduce((result, item) => { result[item.status] = (result[item.status] || 0) + 1; return result; }, { 'implemented-public': 0, 'implemented-internal': 0, excluded: 0, pending: 0 }); }

function validate(result, complete) {
  const ids = new Set();
  for (const baseline of result.baselines) {
    for (const method of baseline.methods) {
      const scopedId = `${baseline.version}:${method.id}`; if (ids.has(scopedId)) throw new Error(`EdgeView 覆盖 ID 重复：${scopedId}`); ids.add(scopedId);
      if (!['implemented-public', 'implemented-internal', 'excluded', 'pending'].includes(method.status)) throw new Error(`EdgeView 方法状态无效：${method.id}`);
      if (!method.officialSignature || !method.minimumInterface || !method.reason) throw new Error(`EdgeView 覆盖条目不完整：${method.id}`);
      if (method.status.startsWith('implemented') && (!method.runtimeSymbol || !method.testId)) throw new Error(`EdgeView 已实现条目缺少符号或测试：${method.id}`);
      if (method.status === 'implemented-public' && !method.chineseCommand) throw new Error(`EdgeView 公开条目缺少中文命令：${method.id}`);
    }
  }
  if (complete && result.baselines.some(item => item.summary.pending > 0)) throw new Error(`EdgeView 完整覆盖门禁失败：${result.baselines.map(item => `${item.version} pending=${item.summary.pending}`).join('，')}`);
}

function parseArgs(argv) { const result = { check: false, complete: false }; for (let index = 0; index < argv.length; index += 1) { if (argv[index] === '--check') result.check = true; else if (argv[index] === '--complete') result.complete = true; else if (argv[index] === '--sdk') result.sdk = argv[++index]; else if (argv[index] === '--output') result.output = argv[++index]; } return result; }
function normalize(value) { return value.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\s+/gu, ' ').trim(); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
