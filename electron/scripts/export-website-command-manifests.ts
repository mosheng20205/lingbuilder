import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..');
const outputArgIndex = process.argv.indexOf('--output');
const requestedOutput = outputArgIndex >= 0 ? process.argv[outputArgIndex + 1] : '';
const outputPath = requestedOutput
  ? path.resolve(process.cwd(), requestedOutput)
  : path.join(workspaceRoot, '.lingbuilder', 'website-command-manifests.json');

const manifests = BUILTIN_MODULES
  .filter(manifest => (manifest.contributes?.commands?.length || 0) > 0 || (manifest.bindings?.commands?.length || 0) > 0)
  .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifests, null, 2)}\n`, 'utf8');

const commandNames = new Set(manifests.flatMap(manifest => [
  ...(manifest.contributes?.commands || []).map(command => command.name),
  ...(manifest.bindings?.commands || []).map(command => command.command)
]));
process.stdout.write(`已导出 ${manifests.length} 个模块、${commandNames.size} 个命令到 ${outputPath}\n`);
