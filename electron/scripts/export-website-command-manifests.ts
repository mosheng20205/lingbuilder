import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectWebsiteCommandManifests, commandCountOf } from './websiteCommandManifestSources.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..');
const outputArgIndex = process.argv.indexOf('--output');
const requestedOutput = outputArgIndex >= 0 ? process.argv[outputArgIndex + 1] : '';
const outputPath = requestedOutput
  ? path.resolve(process.cwd(), requestedOutput)
  : path.join(workspaceRoot, '.lingbuilder', 'website-command-manifests.json');

const manifests = await collectWebsiteCommandManifests();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifests, null, 2)}\n`, 'utf8');

const totalCommands = manifests.reduce((sum, manifest) => sum + commandCountOf(manifest), 0);
process.stdout.write(`已导出 ${manifests.length} 个模块、${totalCommands} 条命令到 ${outputPath}\n`);
