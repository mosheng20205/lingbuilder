import fs from 'node:fs/promises';
import path from 'node:path';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const root = path.join(repoRoot, 'AI 视频自主生产', 'EdgeView 浏览器模块合集');
const builtin = (id: string): InstalledModule => {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
};

async function readJson(file: string): Promise<any> { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function checkProject(projectDir: string, expectedId?: string) {
  const solution = await readJson(path.join(projectDir, '.lingbuilder', 'solution.json'));
  if (expectedId && solution.startupProjectId !== expectedId) throw new Error(`${projectDir}: startupProjectId 不匹配`);
  const project = solution.projects?.[0];
  if (!project) throw new Error(`${projectDir}: 缺少启动项目`);
  const projectId = project.id as string;
  const modules = await readJson(path.join(projectDir, '.lingbuilder', 'projects', projectId, 'project-modules.json'));
  if (!modules.enabledModuleIds.includes('lingbuilder.edgeview')) throw new Error(`${projectDir}: 未启用 lingbuilder.edgeview`);
  const designer = await readJson(path.join(projectDir, '.lingbuilder', 'projects', projectId, 'window-designer.json'));
  const source = await fs.readFile(path.join(projectDir, project.sourceRoot, 'MainWindow.lcpp'), 'utf8');
  const controls = designer.windows?.flatMap((window: any) => window.controls || []) || [];
  const controlNames = new Set(controls.map((control: any) => control.name));
  const aliases = new Map([['会话A', '会话A'], ['会话B', '会话B']]);
  for (const name of source.matchAll(/(?:EdgeView|控件_)[^\s(]+\(([^,\)\s]+)/gu)) {
    const candidate = name[1];
    if (candidate && !candidate.startsWith('"') && /浏览器控件|会话A|会话B/u.test(candidate) && !controlNames.has(candidate) && !aliases.has(candidate)) throw new Error(`${projectDir}: 找不到控件“${candidate}”`);
  }
  if (/(?:EdgeView_(?:导航控件|执行JS控件|绑定控件事件)|EdgeView事件_取字段)\(\s*"[^"\n]+"/u.test(source)) throw new Error(`${projectDir}: 发现疑似带引号的控件引用`);
  if (/绑定(?:控件)?事件[^\n]*,\s*"[^"\n]+"\s*\)/u.test(source) && !/&/u.test(source)) throw new Error(`${projectDir}: 事件处理器缺少 & 引用`);
  const enabledModules = modules.enabledModuleIds
    .filter((id: string) => BUILTIN_MODULES.some(item => item.id === id))
    .map((id: string) => builtin(id));
  const generated = generateLingCppNativeWin32Project(designer, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(`${projectDir}: ${generated.blockingDiagnostics.join('；')}`);
  const referenced = source.match(/(?:EdgeView|控件_)[^\s(]+/gu) || [];
  return { projectId, controls: designer.windows?.reduce((sum: number, window: any) => sum + (window.controls?.length || 0), 0), sourceBytes: Buffer.byteLength(source, 'utf8'), referencedCommands: referenced.length };
}

async function main() {
  const results: any[] = [];
  for (const no of ['01','02','03','04','05','06','07','09','10','11','12']) {
    const episodeDir = path.join(root, no, '示例项目');
    const solution = await readJson(path.join(episodeDir, '.lingbuilder', 'solution.json'));
    results.push({ episode: no, ...(await checkProject(episodeDir, solution.startupProjectId)) });
  }
  for (const name of ['替换响应', '读取响应']) {
    const dir = path.join(root, '08', '示例项目', name);
    const solution = await readJson(path.join(dir, '.lingbuilder', 'solution.json'));
    results.push({ episode: '08-' + name, ...(await checkProject(dir, solution.startupProjectId)) });
  }
  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
