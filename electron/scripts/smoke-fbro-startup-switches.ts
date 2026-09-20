// FBro 启动开关真机冒烟（跨域 EnableCrossFrame / 禁用代理 DisableProxy 与 .lcpp 字面声明烘焙）。
//
// 三组独立构建，逐键归因，不用「命令行里出现了某个开关」糊弄过去：
//   A. 只声明 enableCrossFrame —— 官方 FBroHsCommandLine_EnableCrossFrame 真实写入的开关
//      （真机回读钉死为 --disable-web-security 与 --disable-site-isolation-trials）必须出现，
//      --no-proxy-server 必须不出现，并且跨源 iframe 读回必须真的成功（CROSS_OK）。
//   B. 只声明 disableProxy —— --no-proxy-server 必须出现，跨域开关必须不出现，
//      跨源 iframe 读回必须仍然失败（证明 A 的放开确实来自 enableCrossFrame，而不是环境默认）。
//   C. 不做任何声明（对照组）—— 按契约 FBro_取启动命令行() 为空，跨源 iframe 读回失败。
//
// 另附生成期断言：字面 JSON 必须原样烘焙进 LB_FBro_SetStartupSwitches，烘焙标志为 true。
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const CROSS_OK_TITLE = 'FBRO-CROSS-CHILD-TITLE';
/** 官方 EnableCrossFrame 实际落到 CEF 命令行的开关（真机回读钉死，禁止再靠猜拼法）。 */
const CROSS_FRAME_TOKENS = ['--disable-web-security', '--disable-site-isolation-trials'];
/** 官方 DisableProxy 实际落到命令行的开关。 */
const DISABLE_PROXY_TOKEN = '--no-proxy-server';

async function resolveMsbuild(): Promise<string> {
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  try {
    const { stdout } = await execFileAsync(vswhere, [
      '-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild',
      '-find', 'MSBuild\\**\\Bin\\MSBuild.exe'
    ], { windowsHide: true });
    const found = stdout.split(/\r?\n/u).map(line => line.trim())
      .find(line => line.toLowerCase().endsWith('msbuild.exe'));
    if (found) return found;
  } catch { /* fall through to pinned path */ }
  return 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return {
    manifest, installPath: `builtin://${id}`, isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
}

const enabledModules = [
  builtin('lingbuilder.win32.basic'),
  builtin('lingbuilder.fbro.browser'),
  builtin('lingbuilder.fbro.events')
];

/** 两个端口即两个源：父页在 A 端口，iframe 子页在 B 端口，跨源读 contentDocument 必然受同源策略约束。 */
async function startFixtureServers(): Promise<{ parentUrl: string; close: () => Promise<void> }> {
  const servers: http.Server[] = [];
  const serve = async (pages: Record<string, () => string>) => {
    const server = http.createServer((request, response) => {
      const page = String(request.url || '/').replace(/^\//u, '').split('?')[0] || '';
      const make = pages[page];
      if (!make) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('missing');
        return;
      }
      const body = make();
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body)
      });
      response.end(body);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    servers.push(server);
    return server;
  };
  const childServer = await serve({
    'child.html': () => `<!doctype html><html><head><meta charset="utf-8"><title>${CROSS_OK_TITLE}</title>`
      + '</head><body><main>child</main></body></html>'
  });
  const childPort = (childServer.address() as { port: number }).port;
  // 探测挂在 iframe 自己的 onload 上：父页 load 与 CEF OnLoadEnd 的先后关系不稳定，
  // 挂在子帧加载完成时读 contentDocument 才能确定「子页已就绪」这一前提成立。
  const parentPage = () => '<!doctype html><html><head><meta charset="utf-8"><title>PARENT</title></head><body>'
    + '<script>'
    + 'function lbProbe(){'
    + '  var out;'
    + '  try {'
    + "    var doc = document.getElementById('frame').contentDocument;"
    + "    out = doc ? 'CROSS_OK:' + doc.title : 'CROSS_NULL';"
    + '  } catch (error) {'
    + "    out = 'CROSS_ERR:' + ((error && error.name) ? error.name : 'UNKNOWN');"
    + '  }'
    + "  document.title = out;"
    + '}'
    + '</script>'
    + `<iframe id="frame" src="http://127.0.0.1:${childPort}/child.html" onload="lbProbe()"></iframe>`
    + '</body></html>';
  const parentServer = await serve({ 'parent.html': parentPage });
  const parentPort = (parentServer.address() as { port: number }).port;
  return {
    parentUrl: `http://127.0.0.1:${parentPort}/parent.html`,
    close: async () => {
      await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    }
  };
}

async function buildConsoleProject(options: { tag: string; sourceCode: string; expectBaked: boolean; bakedLiteral?: string }) {
  const projectDir = path.join(repoRoot, '.lingbuilder-build', `fbro-switch-${options.tag}-${process.pid}`);
  const project: LingWindowProject = {
    id: `fbro-switch-smoke-${options.tag}`,
    name: 'FBro 启动开关冒烟',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow',
      title: 'FBro 启动开关冒烟', width: 640, height: 480, background: '#202020',
      description: 'FBro 启动开关冒烟', controls: []
    }],
    resources: []
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules, lingCppSourceCode: options.sourceCode,
    lingCppSourceFilePath: 'src/MainWindow.lcpp', outputKind: 'console-application'
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const expect = (condition: boolean, label: string) => {
    if (!condition) throw new Error(`FBro 启动开关冒烟断言失败（${options.tag}）：${label}`);
  };
  expect(/static const bool g_lingFbroStartupSwitchesBaked = true;/u.test(mainCpp) === options.expectBaked,
    `烘焙标志必须为 ${options.expectBaked}`);
  if (options.bakedLiteral) {
    expect(mainCpp.includes(`LB_FBro_SetStartupSwitches(L"${options.bakedLiteral}"`),
      '字面声明必须原样烘焙进初始化前的启动开关登记');
  } else {
    expect(!mainCpp.includes('LB_FBro_SetStartupSwitches('), '未声明时不得烘焙任何启动开关登记');
  }
  for (let attempt = 0; ; attempt += 1) {
    try { await fs.rm(projectDir, { recursive: true, force: true }); break; }
    catch (error) {
      if (attempt >= 8 || !['EBUSY', 'EPERM'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  for (const candidate of [
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repoRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ]) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
      break;
    } catch { /* try next */ }
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir, projectId: project.id, generatedFiles: generated.files,
    enabledModules, projectKind: 'console-application'
  });
  const msbuild = await resolveMsbuild();
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/nodeReuse:false', '/t:Build',
    '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  return { executable, tag: options.tag };
}

async function runCase(executable: string, tag: string) {
  const { stdout } = await execFileAsync(executable, [], {
    cwd: path.dirname(executable), windowsHide: true, timeout: 240_000, maxBuffer: 16 * 1024 * 1024
  });
  console.log(`[${tag} stdout]`, stdout.trim());
  // 调试输出 的多参数形态是「名字=, 值」，取值时先剥掉分隔用的前导逗号。
  const field = (name: string) => {
    const line = stdout.split(/\r?\n/u).find(item => item.includes(`${name}=`)) || '';
    if (!line) return '';
    return line.slice(line.indexOf(`${name}=`) + name.length + 1).replace(/^\s*,\s*/u, '').trim();
  };
  const probes = [field('R1'), field('R2'), field('R3')].filter(value => value !== '');
  return { commandLine: field('CMDLINE'), probes, probe: probes[probes.length - 1] || '', baked: field('BAKED'), wait: field('WAIT') };
}

function sourceCode(parentUrl: string, declaration: string): string {
  const read = '文档标题 = FBro_实例执行JS(实例, "document.title")';
  return [
    '类 MainWindow', '公开', '  整数型 启动()',
    '    局部 长整数型 实例',
    '    局部 整数型 已烘焙',
    '    局部 文本型 文档标题',
    `    ${declaration}`,
    `    实例 = FBro_后台创建("${parentUrl}", "", "")`,
    '    调试输出("BAKED=", 已烘焙)',
    '    调试输出("WAIT=", FBro_实例等待加载超时(实例, 30000))',
    // 子帧 onload 与宿主读到标题之间有毫秒级竞态：连读三次，任一次命中即算，
    // 断言只接受带 CROSS_ 前缀的探测结果，不接受父页原始标题 PARENT。
    `    ${read}`,
    '    调试输出("R1=", 文档标题)',
    '    调试输出("二次等待=", FBro_实例等待加载超时(实例, 3000))',
    `    ${read}`,
    '    调试输出("R2=", 文档标题)',
    `    ${read}`,
    '    调试输出("R3=", 文档标题)',
    '    调试输出("CMDLINE=", FBro_取启动命令行())',
    '    FBro_实例关闭(实例)',
    '    返回 (0)',
    '  结束', '结束类'
  ].join('\n');
}

async function main() {
  const fixtures = await startFixtureServers();
  try {
    const cases = [
      {
        tag: 'cross-frame',
        declaration: '已烘焙 = FBro_设置启动开关JSON("{\\"enableCrossFrame\\":true}")',
        bakedLiteral: '{\\"enableCrossFrame\\":true}',
        hasTokens: CROSS_FRAME_TOKENS,
        lacksTokens: [DISABLE_PROXY_TOKEN],
        crossAllowed: true
      },
      {
        tag: 'proxy',
        declaration: '已烘焙 = FBro_设置启动开关JSON("{\\"disableProxy\\":true}")',
        bakedLiteral: '{\\"disableProxy\\":true}',
        hasTokens: [DISABLE_PROXY_TOKEN],
        lacksTokens: CROSS_FRAME_TOKENS,
        crossAllowed: false
      },
      {
        tag: 'baseline',
        declaration: '已烘焙 = 0',
        bakedLiteral: '',
        hasTokens: [],
        lacksTokens: [...CROSS_FRAME_TOKENS, DISABLE_PROXY_TOKEN],
        crossAllowed: false
      }
    ];
    const results: Array<{ tag: string; commandLine: string; probe: string; probes: string[]; baked: string; wait: string }> = [];
    for (const item of cases) {
      const built = await buildConsoleProject({
        tag: item.tag,
        sourceCode: sourceCode(fixtures.parentUrl, item.declaration),
        expectBaked: Boolean(item.bakedLiteral),
        bakedLiteral: item.bakedLiteral || undefined
      });
      const outcome = await runCase(built.executable, item.tag);
      results.push({ tag: item.tag, ...outcome });
    }
    const expect = (condition: boolean, label: string) => {
      if (!condition) throw new Error(`FBro 启动开关冒烟断言失败：${label}`);
    };
    for (const item of cases) {
      const outcome = results.find(entry => entry.tag === item.tag)!;
      expect(outcome.wait === '1', `${item.tag} 页面加载完成（WAIT=${outcome.wait}）`);
      for (const token of item.hasTokens) {
        expect(outcome.commandLine.includes(token), `${item.tag} 命令行含 ${token}`);
      }
      for (const token of item.lacksTokens) {
        expect(!outcome.commandLine.includes(token), `${item.tag} 命令行不得含 ${token}（逐键归因，不能靠别组开关蒙过去）`);
      }
      if (item.bakedLiteral) {
        expect(outcome.baked === '1', `${item.tag} FBro_设置启动开关JSON 运行期返回 1（本次声明已烘焙），实际 ${outcome.baked}`);
      } else {
        expect(outcome.baked === '0', `${item.tag} 对照组未声明开关，必须返回 0，实际 ${outcome.baked}`);
      }
      expect(outcome.probes.some(probe => probe.startsWith('CROSS_')),
        `${item.tag} 至少一次读回必须带 CROSS_ 探测前缀（父页 onload 探测未执行？）：${JSON.stringify(outcome.probes)}`);
      if (item.crossAllowed) {
        expect(outcome.probes.some(probe => probe === `CROSS_OK:${CROSS_OK_TITLE}`),
          `${item.tag} 开跨域后必须真读回跨源子页标题，实际 ${JSON.stringify(outcome.probes)}`);
      } else {
        expect(outcome.probes.every(probe => !probe.startsWith(`CROSS_OK:`)),
          `${item.tag} 未开跨域时不得读回跨源 iframe，实际 ${JSON.stringify(outcome.probes)}`);
      }
    }
    expect(results.find(entry => entry.tag === 'baseline')!.commandLine === '',
      '对照组按契约命令行文本为空（未启用任何开关时为空）');
    console.log('[fbro-startup-switches] OK', JSON.stringify(results, null, 1));
  } finally {
    await fixtures.close();
  }
}

main().catch(error => {
  console.error('[fbro-startup-switches] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
