// lingbuilder.http.server 2.3.0 接口文档（OpenAPI + 离线 Swagger UI）真机冒烟：
// Win32+x64 双平台 MSVC 编译 → 运行 → 脚本侧逐项校验 /docs 页面、离线资源、openapi.json、
// Try it out 等价真实调用，并把 HTTP_取接口文档JSON 与 HTTP 服务回包逐字对拍。
// 另做族门控回归：未调用 HTTP_启用接口文档 的项目生成体不得携带 Swagger UI 资源。
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'http-openapi-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => port ? resolve(port) : reject(new Error('端口分配失败')));
    });
    probe.on('error', reject);
  });
}

function httpGet(port: number, requestPath: string): Promise<{ status: number; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: requestPath, timeout: 5000 }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk as Buffer));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        contentType: String(response.headers['content-type'] || ''),
        body: Buffer.concat(chunks)
      }));
    });
    request.on('timeout', () => { request.destroy(); reject(new Error(`请求超时：${requestPath}`)); });
    request.on('error', reject);
  });
}

function httpPostJson(port: number, requestPath: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json' } }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk as Buffer));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => { request.destroy(); reject(new Error(`请求超时：${requestPath}`)); });
    request.on('error', reject);
    request.end(body);
  });
}

async function waitForServer(port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const probe = await httpGet(port, '/docs');
      if (probe.status === 200) return;
    } catch {
      // 服务尚未就绪，继续轮询。
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('HTTP 冒烟服务 30 秒内未就绪。');
}

function buildProject(id: string, name: string, title: string, port: number, source: string): LingWindowProject {
  return {
    schemaVersion: 2,
    id,
    name,
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title, width: 420, height: 240, background: '#202028', description: name, controls: [] }]
  } as LingWindowProject;
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('http.server 接口文档冒烟测试目录越出工作区。');
  const port = await allocatePort();
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.http.server')];

  // —— 族门控回归（不编译，只查生成体）——
  const plainSource = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    `        HTTP服务端 服务 = HTTP_创建服务()`,
    `        HTTP_配置服务(服务, "127.0.0.1", ${port}, 4, 64)`,
    '        HTTP_添加静态路由(服务, "GET", "/api/health", "{\\"ok\\":true}", "application/json; charset=utf-8")',
    '        HTTP_启动(服务)',
    '    结束',
    '结束类'
  ].join('\n');
  const plainGenerated = generateLingCppNativeWin32Project(buildProject('http-openapi-plain', '接口文档族门控对照', '族门控对照', port, plainSource), { enabledModules, lingCppSourceCode: plainSource });
  if (plainGenerated.blockingDiagnostics.length) throw new Error(plainGenerated.blockingDiagnostics.join('\n'));
  const plainAll = plainGenerated.files.map(file => file.content).join('\n');
  // 门控对象是 1.7MB 离线资源字节集与门面（kLingBuilderSwaggerUi*）；运行时类常驻的
  // EnableDocs 页面模板（约 4KB，含 SwaggerUIBundle 字样）不属于门控范围。
  if (plainAll.includes('kLingBuilderSwaggerUi')) {
    throw new Error('族门控失效：未调用 HTTP_启用接口文档 的项目生成了 Swagger UI 离线资源。');
  }

  // —— 带接口文档的主冒烟工程 ——
  // 真实路由：/api/health 静态、/api/user 动态、/user/* 前缀动态；文档登记用 {id} 模板路径
  // 代表前缀路由（Try it out 发 /user/42 经前缀路由命中真实处理器）。
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        HTTP服务端 服务 = HTTP_创建服务()',
    `        HTTP_配置服务(服务, "127.0.0.1", ${port}, 4, 64)`,
    '        如果 (!HTTP_启用接口文档(服务, "/docs", "接口文档冒烟"))',
    '            @ ExitProcess(23);',
    '        如果结束',
    '        HTTP_添加静态路由(服务, "GET", "/api/health", "{\\"ok\\":true}", "application/json; charset=utf-8")',
    '        HTTP_添加路由(服务, "POST", "/api/user", &处理创建用户)',
    '        HTTP_添加路由(服务, "GET", "/user/*", &处理查询用户)',
    '        HTTP_登记接口(服务, "GET", "/api/health", "健康检查", "返回服务运行状态")',
    '        HTTP_登记接口(服务, "POST", "/api/user", "创建用户", "提交 JSON 建档")',
    '        HTTP_登记接口示例(服务, "POST", "/api/user", "{\\"姓名\\":\\"张三\\"}", "{\\"ok\\":true}", "application/json")',
    '        HTTP_登记接口(服务, "GET", "/user/{id}", "查询用户", "按编号查询用户")',
    '        HTTP_登记接口参数(服务, "GET", "/user/{id}", #接口参数_路径, "id", "用户编号", "42", 假)',
    '        HTTP_登记接口参数(服务, "GET", "/user/{id}", #接口参数_查询, "q", "关键字", "lingbuilder", 假)',
    '        文本型 文档JSON',
    '        文档JSON = HTTP_取接口文档JSON(服务)',
    '        如果 (文档JSON == "")',
    '            @ ExitProcess(21);',
    '        如果结束',
    `        @ { std::ofstream report("http-openapi-smoke-json.txt", std::ios::binary | std::ios::trunc); report << LB_WideToUtf8(文档JSON.c_str()); report.close(); }`,
    '        如果 (!HTTP_启动(服务))',
    '            @ ExitProcess(22);',
    '        如果结束',
    '    结束',
    '    事件 处理创建用户()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送JSON(请求, "{\\"ok\\":true,\\"姓名\\":\\"张三\\"}", 200)',
    '    结束',
    '    事件 处理查询用户()',
    '        HTTP请求 请求 = HTTP_取当前请求()',
    '        HTTP_发送JSON(请求, "{\\"ok\\":true,\\"查询\\":\\"已受理\\"}", 200)',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(buildProject('http-openapi-native-smoke', '接口文档原生冒烟测试', '接口文档冒烟', port, source), { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const generatedAll = generated.files.map(file => file.content).join('\n');
  if (!generatedAll.includes('kLingBuilderSwaggerUiJsBytes')) throw new Error('族门控失效：调用了 HTTP_启用接口文档 但生成体缺少 Swagger UI 资源。');

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: 'http-openapi-native-smoke', generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64']) {
    const started = Date.now();
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    console.log(`[smoke] ${platform} 编译完成（${((Date.now() - started) / 1000).toFixed(0)}s）`);
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const child = execFile(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }, () => undefined);
  try {
    await waitForServer(port);

    // ① /docs 页面
    const page = await httpGet(port, '/docs');
    if (page.status !== 200) throw new Error(`/docs 状态码 ${page.status}`);
    if (!page.contentType.includes('text/html')) throw new Error(`/docs Content-Type 异常：${page.contentType}`);
    const pageText = page.body.toString('utf8');
    if (!pageText.includes('SwaggerUIBundle')) throw new Error('/docs 页面缺少 SwaggerUIBundle 引导。');
    if (!pageText.includes('/docs/openapi.json')) throw new Error('/docs 页面未按前缀绝对路径引用规范地址。');

    // ② 离线资源
    const bundleJs = await httpGet(port, '/docs/swagger-ui-bundle.js');
    if (bundleJs.status !== 200 || bundleJs.body.length < 1024 * 1024) throw new Error(`swagger-ui-bundle.js 异常：status=${bundleJs.status} size=${bundleJs.body.length}`);
    if (!bundleJs.contentType.includes('text/javascript')) throw new Error(`swagger-ui-bundle.js Content-Type 异常：${bundleJs.contentType}`);
    if (!bundleJs.body.toString('utf8').includes('SwaggerUIBundle')) throw new Error('swagger-ui-bundle.js 内容缺失。');
    const bundleCss = await httpGet(port, '/docs/swagger-ui.css');
    if (bundleCss.status !== 200 || !bundleCss.contentType.includes('text/css')) throw new Error(`swagger-ui.css 异常：status=${bundleCss.status} ct=${bundleCss.contentType}`);

    // ③ openapi.json 结构
    const spec = await httpGet(port, '/docs/openapi.json');
    if (spec.status !== 200 || !spec.contentType.includes('application/json')) throw new Error(`openapi.json 异常：status=${spec.status} ct=${spec.contentType}`);
    const doc = JSON.parse(spec.body.toString('utf8')) as {
      openapi: string; info: { title: string }; servers: { url: string }[];
      paths: Record<string, Record<string, { summary?: string; description?: string; parameters?: { name: string; in: string; required: boolean; example?: string }[]; requestBody?: { content: Record<string, { example?: string }> }; responses?: Record<string, { content?: Record<string, { example?: string }> }> }>>;
    };
    if (doc.openapi !== '3.0.3') throw new Error(`openapi 版本异常：${doc.openapi}`);
    if (doc.info.title !== '接口文档冒烟') throw new Error(`info.title 异常：${doc.info.title}`);
    if (!doc.servers || doc.servers[0].url !== '/') throw new Error('servers 必须为同源 "/"。');
    const health = doc.paths['/api/health']?.get;
    if (!health || health.summary !== '健康检查') throw new Error('/api/health 登记缺失或名称不符。');
    const createUser = doc.paths['/api/user']?.post;
    if (!createUser || createUser.summary !== '创建用户') throw new Error('/api/user 登记缺失。');
    const requestExample = createUser.requestBody?.content?.['application/json']?.example;
    if (requestExample !== '{"姓名":"张三"}') throw new Error(`请求体示例不符：${JSON.stringify(requestExample)}`);
    const responseExample = createUser.responses?.['200']?.content?.['application/json']?.example;
    if (responseExample !== '{"ok":true}') throw new Error(`响应示例不符：${JSON.stringify(responseExample)}`);
    const queryUser = doc.paths['/user/{id}']?.get;
    if (!queryUser) throw new Error('/user/{id} 登记缺失。');
    const pathParam = queryUser.parameters?.find(item => item.name === 'id');
    if (!pathParam || pathParam.in !== 'path' || pathParam.required !== true) throw new Error('路径参数 id 必须 in=path 且强制必填。');
    const queryParam = queryUser.parameters?.find(item => item.name === 'q');
    if (!queryParam || queryParam.in !== 'query' || queryParam.required !== false || queryParam.example !== 'lingbuilder') throw new Error('查询参数 q 登记不符。');

    // ④ Try it out 等价真实调用（静态、动态、前缀路由各打一发）
    const healthCall = await httpGet(port, '/api/health');
    if (healthCall.status !== 200 || JSON.parse(healthCall.body.toString('utf8')).ok !== true) throw new Error('GET /api/health 调用失败。');
    const createCall = await httpPostJson(port, '/api/user', '{"姓名":"李四"}');
    if (createCall.status !== 200 || (JSON.parse(createCall.body) as { ok?: boolean }).ok !== true) throw new Error(`POST /api/user 调用失败：${createCall.body}`);
    const prefixCall = await httpGet(port, '/user/42?q=lingbuilder');
    if (prefixCall.status !== 200 || JSON.parse(prefixCall.body.toString('utf8')).ok !== true) throw new Error('GET /user/42（前缀路由承接 {id} 模板）调用失败。');

    // ⑤ 未登记文档的路径不得出现在规范里
    if (doc.paths['/docs'] || doc.paths['/docs/openapi.json']) throw new Error('文档内置路由不应出现在 openapi paths 中。');

    // ⑥ HTTP_取接口文档JSON 与服务回包逐字对拍
    const appJson = await fs.readFile(path.join(path.dirname(executable), 'http-openapi-smoke-json.txt'), 'utf8');
    const servedJson = spec.body.toString('utf8');
    if (appJson !== servedJson) throw new Error('HTTP_取接口文档JSON 与 /docs/openapi.json 回包不一致。');

    console.log(JSON.stringify({ ok: true, projectDir, executable, platforms: ['Win32', 'x64'], port, specPaths: Object.keys(doc.paths) }, null, 2));
  } finally {
    child.kill();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
