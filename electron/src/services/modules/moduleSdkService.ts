import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { LINGBUILDER_MODULE_CATEGORIES, LingBuilderModuleCategory, LingBuilderModuleManifest, ModuleCommandContribution, ModuleCommandBinding, ModuleBindingValueType, ModuleControlReferenceKind, ModuleControlReferenceScope, ModuleControlRuntimeRepresentation } from './types';
import { validateModuleManifest, validateModuleManifestContents, type ModuleValidationOptions } from './manifest';
import { createModuleBindingSnippetArgument, normalizeControlReferenceCallSnippet } from './bindingValueType';

const MODULE_MANIFEST_FILE = 'lingbuilder.module.json';

export interface ModuleInitOptions {
  template: string;
  outDir: string;
  id?: string;
  name?: string;
  category?: string;
  description?: string;
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
    parameters?: Array<{
      name: string;
      type: string;
      description?: string;
      controlTypes?: string[];
      controlKinds?: ModuleControlReferenceKind[];
      scope?: ModuleControlReferenceScope;
      runtimeRepresentation?: ModuleControlRuntimeRepresentation;
    }>;
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

export interface AiModuleImportFileInput {
  path: string;
  content: string;
}

export interface AiModuleImportResult {
  manifest: LingBuilderModuleManifest;
  outDir: string;
  writtenFiles: string[];
  diagnostics: string[];
  overwrittenExisting: boolean;
}

const AI_MODULE_IMPORT_MAX_FILES = 200;
const AI_MODULE_IMPORT_MAX_FILE_BYTES = 1024 * 1024;
const AI_MODULE_IMPORT_MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const AI_MODULE_IMPORT_EXTENSIONS = new Set([
  '.json', '.md', '.markdown', '.txt', '.h', '.hh', '.hpp', '.hxx', '.inl',
  '.c', '.cc', '.cpp', '.cxx', '.lcpp', '.def', '.rc', '.rh',
  '.ini', '.cfg', '.yaml', '.yml', '.toml', '.xml', '.csv'
]);

function toSafeAiImportRelativePath(value: string): string | undefined {
  const normalized = value.trim().replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/').replace(/^\uFEFF/u, '');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/u.test(normalized)) return undefined;
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return undefined;
  const extension = normalized.slice(normalized.lastIndexOf('.')).toLowerCase();
  if (!AI_MODULE_IMPORT_EXTENSIONS.has(extension)) return undefined;
  return normalized;
}

export async function importAiModuleFiles(files: AiModuleImportFileInput[], outDir: string): Promise<AiModuleImportResult> {
  if (!Array.isArray(files) || files.length === 0) throw new Error('没有可导入的文件。');
  if (files.length > AI_MODULE_IMPORT_MAX_FILES) throw new Error(`单次导入最多 ${AI_MODULE_IMPORT_MAX_FILES} 个文件，当前 ${files.length} 个。`);

  const seenPaths = new Set<string>();
  const seenPathKeys = new Set<string>();
  const safeFiles: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('文件列表格式不正确：每个文件需要 path 和 content 文本字段。');
    }
    const safePath = toSafeAiImportRelativePath(file.path);
    if (!safePath) throw new Error(`文件路径不安全或类型不支持：${file.path}`);
    if (seenPaths.has(safePath)) throw new Error(`文件路径重复：${safePath}`);
    const pathKey = normalizeImportPathKey(safePath);
    if (seenPathKeys.has(pathKey)) throw new Error(`文件路径大小写冲突：${safePath}`);
    seenPaths.add(safePath);
    seenPathKeys.add(pathKey);
    const content = file.content.replace(/^\uFEFF/u, '');
    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength > AI_MODULE_IMPORT_MAX_FILE_BYTES) throw new Error(`文件 ${safePath} 超过 1 MB，请让 AI 拆分或精简。`);
    totalBytes += byteLength;
    if (totalBytes > AI_MODULE_IMPORT_MAX_TOTAL_BYTES) throw new Error('导入内容总量超过 10 MB，请让 AI 拆分后分批导入。');
    safeFiles.push({ path: safePath, content });
  }

  const manifestInput = safeFiles.find(file => file.path === MODULE_MANIFEST_FILE);
  if (!manifestInput) throw new Error(`缺少根目录 ${MODULE_MANIFEST_FILE}，无法确定模块 ID。`);

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestInput.content);
  } catch {
    throw new Error(`${MODULE_MANIFEST_FILE} 不是合法 JSON，请让 AI 重新输出。`);
  }
  const manifestValidation = validateModuleManifest(rawManifest, { requireCommandBindings: true });
  if (!manifestValidation.manifest) {
    throw new Error(`模块清单校验未通过：\n${manifestValidation.diagnostics.join('\n')}`);
  }
  const manifest = manifestValidation.manifest;
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(manifest.id)) {
    throw new Error(`模块 ID 不合法：${manifest.id}`);
  }

  const targetStat = await fs.lstat(outDir).catch((error: any) => {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  });
  if (targetStat && !targetStat.isDirectory()) throw new Error('AI 模块导入目标必须是目录。');

  const parentDir = path.dirname(outDir);
  await fs.mkdir(parentDir, { recursive: true });
  const stagingDir = await fs.mkdtemp(path.join(parentDir, `.${path.basename(outDir)}.ai-import-`));
  let stagingExists = true;
  let backupDir: string | undefined;
  let committed = false;
  const writtenFiles: string[] = safeFiles.map(file => file.path);
  const existingFileKeys = new Set<string>();
  const existingFilePaths = new Map<string, string>();
  try {
    if (targetStat) await copyDirectoryContents(outDir, stagingDir, existingFileKeys, existingFilePaths);
    for (const file of safeFiles) {
      const existingPath = existingFilePaths.get(normalizeImportPathKey(file.path));
      if (existingPath && existingPath !== file.path) {
        throw new Error(`文件路径大小写冲突：${existingPath} 与 ${file.path} 在不同平台上会指向同一个文件。`);
      }
      const target = path.join(stagingDir, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf8');
    }

    const directoryValidation = await validateModuleDirectory(stagingDir, {
      requireCommandBindings: true,
      requireNonEmptyDocumentsAndExamples: true
    });
    if (directoryValidation.diagnostics.length > 0) {
      throw new Error(`模块内容校验未通过：\n${directoryValidation.diagnostics.join('\n')}`);
    }

    const overwrittenExisting = safeFiles.some(file => existingFileKeys.has(normalizeImportPathKey(file.path)));
    if (targetStat) {
      backupDir = path.join(parentDir, `.${path.basename(outDir)}.ai-backup-${crypto.randomBytes(8).toString('hex')}`);
      await fs.rename(outDir, backupDir);
    }
    await fs.rename(stagingDir, outDir);
    stagingExists = false;
    committed = true;
    if (backupDir) {
      await fs.rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
      backupDir = undefined;
    }
    return { manifest, outDir, writtenFiles, diagnostics: [], overwrittenExisting };
  } catch (error) {
    if (backupDir && !committed) {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
      await fs.rename(backupDir, outDir).catch(() => undefined);
      backupDir = undefined;
    }
    throw error;
  } finally {
    if (stagingExists) await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    if (backupDir) await fs.rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizeImportPathKey(value: string): string {
  // Reject case-only aliases on every platform so a module remains portable
  // between Windows' case-insensitive and POSIX case-sensitive file systems.
  return value.replace(/\\/gu, '/').toLocaleLowerCase('en-US');
}

async function copyDirectoryContents(
  sourceDir: string,
  targetDir: string,
  existingFileKeys: Set<string>,
  existingFilePaths: Map<string, string>,
  relativePrefix = ''
): Promise<void> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`AI 模块导入目标包含符号链接，已拒绝访问：${entry.name}`);
    if (entry.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      await copyDirectoryContents(source, target, existingFileKeys, existingFilePaths, path.join(relativePrefix, entry.name));
      continue;
    }
    if (!entry.isFile()) throw new Error(`AI 模块导入目标包含不支持的文件类型：${entry.name}`);
    const relativePath = path.join(relativePrefix, entry.name).replace(/\\/gu, '/');
    const pathKey = normalizeImportPathKey(relativePath);
    const existingPath = existingFilePaths.get(pathKey);
    if (existingPath && existingPath !== relativePath) {
      throw new Error(`AI 模块导入目标存在大小写冲突路径：${existingPath} 与 ${relativePath}。`);
    }
    existingFileKeys.add(pathKey);
    existingFilePaths.set(pathKey, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
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

export async function validateModuleDirectory(modulePath: string, options: ModuleValidationOptions = {}): Promise<ModuleValidationResult> {
  const stat = await fs.stat(modulePath);
  const manifestPath = stat.isDirectory() ? path.join(modulePath, MODULE_MANIFEST_FILE) : modulePath;
  const moduleRoot = path.dirname(manifestPath);
  const raw = await fs.readFile(manifestPath, 'utf8');
  const validation = validateModuleManifest(JSON.parse(raw), options);
  const contentDiagnostics = validation.manifest
    ? await validateModuleManifestContents(moduleRoot, validation.manifest, options)
    : [];
  return {
    manifest: validation.manifest,
    diagnostics: [...validation.diagnostics, ...contentDiagnostics],
    manifestPath
  };
}

export async function migrateCppModule(configPath: string, outDir: string): Promise<LingBuilderModuleManifest> {
  const raw = JSON.parse(await fs.readFile(configPath, 'utf8')) as ModuleCppMigrationConfig;
  (raw.commands || []).forEach(command => {
    if (!command.insertText) return;
    const parameters = toBindingParameters(command.parameters || []);
    if (normalizeControlReferenceCallSnippet(command.insertText, parameters) !== command.insertText) {
      throw new Error(`命令 ${command.name} 的 insertText 给 controlRef 参数添加了双引号；SDK 拒绝生成退化模块。`);
    }
  });
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
  const templateCategory: LingBuilderModuleCategory = options.template.includes('ui')
    ? '界面'
    : options.template.includes('cpp') || options.template.includes('dll') ? '系统' : '其他';
  const requestedCategory = options.category?.trim();
  const category = requestedCategory && (LINGBUILDER_MODULE_CATEGORIES as readonly string[]).includes(requestedCategory)
    ? requestedCategory as LingBuilderModuleCategory
    : templateCategory;
  return {
    schemaVersion: 2,
    id,
    name,
    version: '1.0.0',
    category,
    description: options.description?.trim() || '由 LingBuilder 模块 SDK 创建的模块模板。',
    author: 'LingBuilder Module Author',
    tags: ['模板', options.template],
    contributes: {
      commands: [command],
      constants: [{ name: '示例常量', type: '整数型', value: 1, description: '模块模板示例常量；.lcpp 源码中用 #示例常量 引用。' }],
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
  const parameters = toBindingParameters(command.parameters || []);
  const generatedInsertText = `${command.name}(${parameters.map(createModuleBindingSnippetArgument).join(', ')})`;
  return {
    name: command.name,
    signature: command.signature || `${command.name}(${(command.parameters || []).map(parameter => parameter.name).join(', ')})`,
    description: command.description || `调用 C++ 运行时 ${command.runtimeName || command.name}。`,
    insertText: normalizeControlReferenceCallSnippet(command.insertText || generatedInsertText, parameters),
    returnType: command.returnType || '空'
  };
}

function toCommandBinding(command: NonNullable<ModuleCppMigrationConfig['commands']>[number]): ModuleCommandBinding {
  const parameters = toBindingParameters(command.parameters || []);
  return {
    command: command.name,
    runtimeName: command.runtimeName || command.name,
    parameters,
    returnType: normalizeBindingType(command.returnType || 'void'),
    encoding: 'wide',
    example: normalizeControlReferenceCallSnippet(command.insertText || command.signature || `${command.name}()`, parameters)
  };
}

function toBindingParameters(parameters: NonNullable<NonNullable<ModuleCppMigrationConfig['commands']>[number]['parameters']>): ModuleCommandBinding['parameters'] {
  return parameters.map(parameter => ({
    name: parameter.name,
    type: normalizeBindingType(parameter.type),
    description: parameter.description,
    controlTypes: parameter.controlTypes,
    controlKinds: parameter.controlKinds,
    scope: parameter.scope,
    runtimeRepresentation: parameter.runtimeRepresentation
  }));
}

function normalizeBindingType(value: string): ModuleBindingValueType {
  if (value === '整数型' || value === 'int') return 'int';
  if (value === '文本型' || value === 'wideString' || value === 'string') return 'wideString';
  if (value === '逻辑型' || value === 'bool') return 'bool';
  if (value === '小数型' || value === 'double') return 'double';
  if (value === '窗口句柄' || value === 'handle' || value === 'HWND') return 'handle';
  if (value === '控件' || value === '控件引用' || value === 'controlRef') return 'controlRef';
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
