import fs from 'node:fs/promises';
import path from 'node:path';
import { LingBuilderModuleManifest, ModuleCommandContribution, ModuleCommandBinding, ModuleBindingValueType } from './types';
import { validateModuleManifest, validateModuleManifestContents } from './manifest';

const MODULE_MANIFEST_FILE = 'lingbuilder.module.json';

export interface ModuleInitOptions {
  template: string;
  outDir: string;
  id?: string;
  name?: string;
}

export interface ModuleCppMigrationConfig {
  id: string;
  name: string;
  version?: string;
  category?: LingBuilderModuleManifest['category'];
  description?: string;
  author?: string;
  headers?: string[];
  sources?: string[];
  libs?: string[];
  runtimeFiles?: string[];
  includeDirs?: string[];
  commands?: Array<{
    name: string;
    signature?: string;
    description?: string;
    runtimeName?: string;
    returnType?: string;
    insertText?: string;
    parameters?: Array<{ name: string; type: string; description?: string }>;
  }>;
  targetId?: string;
  arch?: 'win32' | 'x64';
  toolchain?: 'msvc' | 'gcc' | 'clang' | 'cmake' | 'any';
}

export interface ModuleValidationResult {
  manifest?: LingBuilderModuleManifest;
  diagnostics: string[];
  manifestPath: string;
}

export async function createModuleTemplate(options: ModuleInitOptions): Promise<LingBuilderModuleManifest> {
  const manifest = buildTemplateManifest(options);
  await fs.mkdir(options.outDir, { recursive: true });
  await fs.writeFile(path.join(options.outDir, MODULE_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.mkdir(path.join(options.outDir, 'docs'), { recursive: true });
  await fs.mkdir(path.join(options.outDir, 'examples'), { recursive: true });
  await fs.writeFile(path.join(options.outDir, 'README.md'), buildReadme(manifest), 'utf8');
  await fs.writeFile(path.join(options.outDir, 'docs', 'usage.md'), `# ${manifest.name} 使用说明\n\n在这里补充模块命令、示例和注意事项。\n`, 'utf8');
  await fs.writeFile(path.join(options.outDir, 'examples', '最小示例.lcpp'), buildExampleSource(manifest), 'utf8');
  if (options.template.includes('cpp') || options.template.includes('dll') || options.template.includes('ui')) {
    await fs.mkdir(path.join(options.outDir, 'include'), { recursive: true });
    await fs.mkdir(path.join(options.outDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(options.outDir, 'include', 'module_bridge.h'), '#pragma once\n\nint 示例命令();\n', 'utf8');
    await fs.writeFile(path.join(options.outDir, 'src', 'module_bridge.cpp'), '#include "module_bridge.h"\n\nint 示例命令() { return 0; }\n', 'utf8');
  }
  return manifest;
}

export async function validateModuleDirectory(modulePath: string): Promise<ModuleValidationResult> {
  const stat = await fs.stat(modulePath);
  const manifestPath = stat.isDirectory() ? path.join(modulePath, MODULE_MANIFEST_FILE) : modulePath;
  const moduleRoot = path.dirname(manifestPath);
  const raw = await fs.readFile(manifestPath, 'utf8');
  const validation = validateModuleManifest(JSON.parse(raw));
  const contentDiagnostics = validation.manifest
    ? await validateModuleManifestContents(moduleRoot, validation.manifest)
    : [];
  return {
    manifest: validation.manifest,
    diagnostics: [...validation.diagnostics, ...contentDiagnostics],
    manifestPath
  };
}

export async function migrateCppModule(configPath: string, outDir: string): Promise<LingBuilderModuleManifest> {
  const raw = JSON.parse(await fs.readFile(configPath, 'utf8')) as ModuleCppMigrationConfig;
  const commands = (raw.commands || []).map(toCommandContribution);
  const bindings = (raw.commands || []).map(toCommandBinding);
  const manifest: LingBuilderModuleManifest = {
    schemaVersion: 2,
    id: raw.id,
    name: raw.name,
    version: raw.version || '1.0.0',
    category: raw.category || '其他',
    description: raw.description || `从 C++ 库迁移生成的 ${raw.name} 模块。`,
    author: raw.author,
    tags: ['C++迁移', raw.toolchain || 'msvc'].filter(Boolean),
    contributes: {
      commands,
      docs: [{ title: '模块说明', path: 'README.md' }],
      examples: [{ title: '最小调用示例', path: 'examples/最小示例.lcpp' }]
    },
    targets: [
      {
        id: raw.targetId || `windows-${raw.toolchain || 'msvc'}-${raw.arch || 'win32'}`,
        platform: 'windows',
        arch: raw.arch || 'win32',
        toolchain: raw.toolchain || 'msvc',
        includeDirs: raw.includeDirs || inferIncludeDirs(raw.headers || []),
        headers: raw.headers || [],
        sources: raw.sources || [],
        libs: raw.libs || [],
        runtimeFiles: raw.runtimeFiles || []
      }
    ],
    bindings: { commands: bindings }
  };

  const validation = validateModuleManifest(manifest);
  if (!validation.manifest) throw new Error(validation.diagnostics.join('\n'));

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'examples'), { recursive: true });
  await fs.writeFile(path.join(outDir, MODULE_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(outDir, 'README.md'), buildCppMigrationReadme(manifest), 'utf8');
  await fs.writeFile(path.join(outDir, 'examples', '最小示例.lcpp'), buildExampleSource(manifest), 'utf8');
  return manifest;
}

export interface CreateMarketIndexOptions {
  packagePathRoot?: string;
}

export async function createMarketIndex(
  packagePaths: string[],
  outPath: string,
  options: CreateMarketIndexOptions = {}
): Promise<void> {
  const modules = [];
  for (const packagePath of packagePaths) {
    const resolvedPackagePath = path.resolve(packagePath);
    modules.push({
      id: path.basename(packagePath, path.extname(packagePath)),
      name: path.basename(packagePath, path.extname(packagePath)),
      version: '1.0.0',
      category: '其他',
      description: '由 LingBuilder 模块 SDK 生成的本地市场索引项。',
      packagePath: options.packagePathRoot
        ? toPortableRelativePath(options.packagePathRoot, resolvedPackagePath)
        : resolvedPackagePath
    });
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ schemaVersion: 1, modules }, null, 2) + '\n', 'utf8');
}

function toPortableRelativePath(root: string, targetPath: string): string {
  const relativePath = path.relative(path.resolve(root), targetPath).replace(/\\/g, '/');
  if (!relativePath || relativePath === '..' || relativePath.startsWith('../')) {
    throw new Error(`模块包不在市场索引工作区内：${targetPath}`);
  }
  return relativePath;
}

function buildTemplateManifest(options: ModuleInitOptions): LingBuilderModuleManifest {
  const id = options.id || `com.example.${sanitizeId(path.basename(options.outDir) || 'module')}`;
  const name = options.name || `${id} 模块`;
  const command: ModuleCommandContribution = {
    name: '示例命令',
    signature: '示例命令()',
    description: '模块模板生成的示例命令。',
    insertText: '示例命令()',
    returnType: '整数型'
  };
  return {
    schemaVersion: 2,
    id,
    name,
    version: '1.0.0',
    category: options.template.includes('ui') ? '界面' : options.template.includes('cpp') || options.template.includes('dll') ? '系统' : '其他',
    description: '由 LingBuilder 模块 SDK 创建的模块模板。',
    author: 'LingBuilder Module Author',
    tags: ['模板', options.template],
    contributes: {
      commands: [command],
      docs: [{ title: '使用说明', path: 'docs/usage.md' }],
      examples: [{ title: '最小示例', path: 'examples/最小示例.lcpp' }]
    },
    targets: options.template.includes('cpp') || options.template.includes('dll') || options.template.includes('ui')
      ? [{
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/module_bridge.h'],
        sources: ['src/module_bridge.cpp']
      }]
      : [],
    bindings: {
      commands: [{
        command: command.name,
        runtimeName: '示例命令',
        parameters: [],
        returnType: 'int',
        example: '示例命令()'
      }]
    }
  };
}

function toCommandContribution(command: NonNullable<ModuleCppMigrationConfig['commands']>[number]): ModuleCommandContribution {
  return {
    name: command.name,
    signature: command.signature || `${command.name}(${(command.parameters || []).map(parameter => parameter.name).join(', ')})`,
    description: command.description || `调用 C++ 运行时 ${command.runtimeName || command.name}。`,
    insertText: command.insertText || `${command.name}(${(command.parameters || []).map((_, index) => `$${index + 1}`).join(', ')})`,
    returnType: command.returnType || '空'
  };
}

function toCommandBinding(command: NonNullable<ModuleCppMigrationConfig['commands']>[number]): ModuleCommandBinding {
  return {
    command: command.name,
    runtimeName: command.runtimeName || command.name,
    parameters: (command.parameters || []).map(parameter => ({
      name: parameter.name,
      type: normalizeBindingType(parameter.type),
      description: parameter.description
    })),
    returnType: normalizeBindingType(command.returnType || 'void'),
    encoding: 'wide',
    example: command.insertText || command.signature || `${command.name}()`
  };
}

function normalizeBindingType(value: string): ModuleBindingValueType {
  if (value === '整数型' || value === 'int') return 'int';
  if (value === '文本型' || value === 'wideString' || value === 'string') return 'wideString';
  if (value === '逻辑型' || value === 'bool') return 'bool';
  if (value === '小数型' || value === 'double') return 'double';
  if (value === '窗口句柄' || value === 'handle' || value === 'HWND') return 'handle';
  if (value === '空' || value === 'void') return 'void';
  return 'raw';
}

function inferIncludeDirs(headers: string[]): string[] {
  return [...new Set(headers.map(header => header.replace(/\\/g, '/').split('/').slice(0, -1).join('/')).filter(Boolean))];
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'module';
}

function buildReadme(manifest: LingBuilderModuleManifest): string {
  return `# ${manifest.name}\n\n这是 LingBuilder schemaVersion 2 模块。\n\n## 打包\n\n\`\`\`bash\nlingbuilder module validate .\nlingbuilder module pack . --out ${manifest.id}.lbmod\n\`\`\`\n`;
}

function buildCppMigrationReadme(manifest: LingBuilderModuleManifest): string {
  return `# ${manifest.name}\n\n本模块由 C++ 迁移向导生成。请确认桥接源码、库文件架构和运行时 DLL 与目标平台一致。\n`;
}

function buildExampleSource(manifest: LingBuilderModuleManifest): string {
  const command = manifest.contributes?.commands?.[0];
  return [
    `包 ${manifest.id}`,
    `使用 ${manifest.name}`,
    '',
    '类 主窗口 : 窗口',
    '公开',
    '  事件 _主窗口_创建完毕()',
    command ? `    ${command.insertText || command.signature}` : '    调试输出("模块已加载")',
    '  结束',
    '结束类',
    ''
  ].join('\n');
}
