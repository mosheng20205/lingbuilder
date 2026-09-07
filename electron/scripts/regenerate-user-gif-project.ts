import fs from 'node:fs/promises';
import path from 'node:path';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const projectDir = process.argv[2];
if (!projectDir) throw new Error('用法：tsx regenerate-user-gif-project.ts <generated/cpp/project-dir>');

const layoutPath = path.join(projectDir, 'layout.json');
const project = JSON.parse(await fs.readFile(layoutPath, 'utf8')) as LingWindowProject;
const sourceRoot = path.resolve(projectDir, '..', '..', '..', 'src');
const sourceFiles = await fs.readdir(sourceRoot, { recursive: true });
const lingCppSources = [] as { filePath: string; sourceCode: string }[];
for (const entry of sourceFiles) {
  if (typeof entry !== 'string' || !entry.toLowerCase().endsWith('.lcpp')) continue;
  const absolute = path.join(sourceRoot, entry);
  const relative = path.relative(path.resolve(projectDir, '..', '..', '..'), absolute).replace(/\\/gu, '/');
  lingCppSources.push({ filePath: relative, sourceCode: await fs.readFile(absolute, 'utf8') });
}
if (lingCppSources.length === 0) throw new Error(`未找到 .lcpp 源码：${sourceRoot}`);

const enabledModules: InstalledModule[] = [];
const moduleIds = new Set<string>(['lingbuilder.win32.basic']);
for (const id of moduleIds) {
  const manifest = BUILTIN_MODULES.find(module => module.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  enabledModules.push({ manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] });
}

const generated = generateLingCppNativeWin32Project(project, {
  activeWindowId: project.windows[0]?.id,
  lingCppSources,
  enabledModules,
});
if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
for (const file of generated.files) {
  const target = path.resolve(projectDir, file.relativePath);
  if (!target.startsWith(`${path.resolve(projectDir)}${path.sep}`)) throw new Error(`生成路径越界：${file.relativePath}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.content, 'utf8');
}
console.log(JSON.stringify({ ok: true, projectDir, sources: lingCppSources.map(item => item.filePath), files: generated.files.map(file => file.relativePath), blockingDiagnostics: generated.blockingDiagnostics }, null, 2));
