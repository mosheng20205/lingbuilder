/**
 * 内置模块文档生成器：从 BUILTIN_MODULES 清单确定性生成「模块使用说明」Markdown。
 *
 * - 生成范围：builtinModuleDocuments.ts 登记表中的模块（未手工内联 docs 的那 60 家），
 *   写入 electron/<登记路径>（默认 docs/modules/<slug>/README.md）。
 * - `--check` 模式不写盘，逐字比对现有文件与生成结果，内容漂移即退出码 1
 *   （tests/modules.test.ts 的文档门禁直接消费本导出，清单变化后必须重跑生成）。
 * - 覆盖面门禁：任何内置模块若既没有内联 docs 也不在登记表，立即报错列出清单，
 *   保证「每个内置模块的详情页文档页签都至少有一篇可读文档」。
 * - 内容来源只有模块清单本身（命令/参数/常量/类型/片段/依赖），不虚构行为；家族关系
 *   （CEF3/FBro 子模块指向主模块）是结构性事实，写成固定提示。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { BUILTIN_MODULE_DOCUMENT_PATHS } from '../src/services/modules/builtinModuleDocuments';
import { collectTargetDependencies } from '../src/services/modules/modulePublicInfo';
import { formatModulePublicType } from '../src/services/modules/modulePublicTypeService';
import type { LingBuilderModuleManifest, ModuleCommandBinding, ModuleCommandContribution } from '../src/services/modules/types';

export const GENERATED_DOC_MARKER = '<!-- 本文档由 electron/scripts/generate-builtin-module-docs.ts 从模块清单自动生成（npm run module:builtin-docs）。手工编辑会被覆盖；要接管维护，请把 contributes.docs 写回模块清单并从 builtinModuleDocuments.ts 移除该模块，再改写本文档。 -->';

const VALUE_TYPE_LABELS: Readonly<Record<string, string>> = {
  void: '无返回值',
  int: '整数型',
  longLong: '长整数型',
  double: '小数型',
  float: '单精度小数型',
  bool: '逻辑型',
  wideString: '文本型',
  bytes: '字节集',
  array: '数组',
  arrayElement: '数组成员（类型随数组元素）',
  handle: '句柄',
  lingValue: '通用型',
  raw: '任意值',
  controlRef: '控件引用',
  handler: '处理器'
};

const FAMILY_NOTES: Readonly<Record<string, string>> = {
  'lingbuilder.cef3.browser': '本模块是 CEF3 浏览器内核的主模块；`lingbuilder.cef3.*` 子模块（自动化、事件、会话、无头渲染等）的命令通常与本模块创建的浏览器实例或会话配合使用，具体以各命令说明为准。',
  'lingbuilder.fbro.browser': '本模块是 FBro 指纹浏览器的主模块；`lingbuilder.fbro.*` 子模块（自动化、事件、会话、传输等）的命令通常与本模块创建的浏览器实例或会话配合使用，具体以各命令说明为准。'
};

function formatValueType(value: string | undefined): string {
  if (!value) return '—';
  return VALUE_TYPE_LABELS[value] || value;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

function getFamilyNote(manifest: LingBuilderModuleManifest): string {
  if (FAMILY_NOTES[manifest.id]) return FAMILY_NOTES[manifest.id];
  if (manifest.id.startsWith('lingbuilder.cef3.')) {
    return `本模块是 CEF3 浏览器内核（\`lingbuilder.cef3.browser\`）的子能力模块：浏览器的创建、导航与生命周期入口命令见主模块文档，本模块命令通常与主模块创建的实例或会话配合使用，具体以各命令说明为准。`;
  }
  if (manifest.id.startsWith('lingbuilder.fbro.')) {
    return `本模块是 FBro 指纹浏览器（\`lingbuilder.fbro.browser\`）的子能力模块：浏览器的创建、导航与生命周期入口命令见主模块文档，本模块命令通常与主模块创建的实例或会话配合使用，具体以各命令说明为准。`;
  }
  return '';
}

function groupCommands(commands: readonly ModuleCommandContribution[]): Array<{ label: string; commands: ModuleCommandContribution[] }> {
  const groups = new Map<string, ModuleCommandContribution[]>();
  for (const command of commands) {
    const label = command.category || '全部命令';
    const bucket = groups.get(label);
    if (bucket) bucket.push(command);
    else groups.set(label, [command]);
  }
  return [...groups.entries()].map(([label, grouped]) => ({ label, commands: grouped }));
}

function renderCommandSection(command: ModuleCommandContribution, binding: ModuleCommandBinding | undefined): string {
  const lines: string[] = [];
  lines.push(`#### ${command.name}`, '');
  lines.push(`- 签名：\`${command.signature}\``);
  const returnType = command.returnType || binding?.returnType;
  if (returnType) lines.push(`- 返回值：${formatValueType(returnType)}`);
  if (command.returnDescription) lines.push(`- 返回值说明：${command.returnDescription}`);
  if (command.description) lines.push(`- 说明：${command.description}`);
  if (command.aliases?.length) {
    lines.push(`- 别名：${command.aliases.map(alias => `\`${alias}\``).join('、')}（兼容旧写法，生成代码使用主名）。`);
  }
  if (command.visibility === 'advanced') {
    lines.push(`- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。`);
  }
  const parameters = binding?.parameters || [];
  if (parameters.length > 0) {
    lines.push('- 参数：');
    for (const parameter of parameters) {
      const description = parameter.description ? `：${parameter.description}` : '';
      lines.push(`  - ${parameter.name}（${formatValueType(parameter.type)}）${description}`);
    }
    if (parameters.some(parameter => parameter.type === 'handler')) {
      lines.push(`  - ⚠️ 处理器参数必须使用 \`&处理器名\` 引用语法传入，不能写成带引号的字符串。`);
    }
    if (parameters.some(parameter => parameter.type === 'controlRef')) {
      lines.push(`  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 \`控件_设置文本(操作结果, "完成")\`。`);
    }
  }
  const example = binding?.example;
  if (example && !example.includes('```')) {
    lines.push('- 示例：', '', '```', example, '```', '');
  }
  return lines.join('\n');
}

export function generateBuiltinModuleDocMarkdown(manifest: LingBuilderModuleManifest): string {
  const contributes = manifest.contributes || {};
  const commands = contributes.commands || [];
  const lines: string[] = [];
  lines.push(GENERATED_DOC_MARKER, '');
  lines.push(`# ${manifest.name}使用说明`, '');
  lines.push(`| 项目 | 内容 |`, `| --- | --- |`);
  lines.push(`| 模块 ID | \`${manifest.id}\` |`);
  lines.push(`| 版本 | ${manifest.version} |`);
  lines.push(`| 分类 | ${manifest.category} |`);
  lines.push(`| 命令数 | ${commands.length} |`);
  lines.push('');
  if (manifest.description) lines.push(manifest.description, '');
  const familyNote = getFamilyNote(manifest);
  if (familyNote) lines.push(`> ${familyNote}`, '');

  lines.push('## 启用方式', '');
  lines.push(
    '本模块为 LingBuilder 内置模块，随 IDE 一起分发，无需单独安装。在「模块」面板或解决方案树的模块节点确认其处于「已启用」状态后，即可在当前项目的 `.lcpp` 代码中直接调用下列命令；未启用时语言服务会给出带启用路径的中文诊断。',
    ''
  );

  if (commands.length > 0) {
    const bindings = new Map((manifest.bindings?.commands || []).map(binding => [binding.command, binding]));
    lines.push(`## 命令参考（共 ${commands.length} 条）`, '');
    for (const group of groupCommands(commands)) {
      lines.push(`### ${group.label}`, '');
      for (const command of group.commands) {
        // 段落之间必须空行分隔：无示例的命令以列表行结尾，紧跟的 #### 标题会被解析进列表项。
        lines.push(renderCommandSection(command, bindings.get(command.name)), '');
      }
    }
  }

  const constants = contributes.constants || [];
  if (constants.length > 0) {
    lines.push(`## 公开常量（共 ${constants.length} 条）`, '');
    lines.push('| 常量 | 类型 | 值 | 说明 |', '| --- | --- | --- | --- |');
    for (const constant of constants) {
      const valueText = typeof constant.value === 'string'
        ? `"${constant.value}"`
        : typeof constant.value === 'boolean'
          ? (constant.value ? '真' : '假')
          : String(constant.value);
      const description = `${constant.level === 'advanced' ? '（高级）' : ''}${constant.description || ''}`.trim();
      lines.push(`| \`${constant.name}\` | ${escapeTableCell(constant.type)} | ${escapeTableCell(valueText)} | ${escapeTableCell(description)} |`);
    }
    lines.push('');
    lines.push('常量在 `.lcpp` 源码中以 `#常量名` 形式引用。', '');
  }

  const types = contributes.types || [];
  if (types.length > 0) {
    lines.push(`## 公开类型（共 ${types.length} 条）`, '');
    for (const type of types) {
      lines.push(`### ${type.name}`, '');
      lines.push(`- 声明：${formatModulePublicType(type)}`);
      if (type.description) lines.push(`- 说明：${type.description}`);
      lines.push('');
      if ((type.fields || []).length > 0) {
        lines.push('| 字段 | 类型 | 说明 |', '| --- | --- | --- |');
        for (const field of type.fields || []) {
          const fieldText = `${field.type}${field.isArray ? '[]' : ''}${field.initialValue?.trim() ? ` = ${field.initialValue.trim()}` : ''}`;
          lines.push(`| ${escapeTableCell(field.name)} | ${escapeTableCell(fieldText)} | ${escapeTableCell(field.description || '')} |`);
        }
        lines.push('');
      }
    }
  }

  const snippets = contributes.snippets || [];
  if (snippets.length > 0) {
    lines.push(`## 代码片段（共 ${snippets.length} 条）`, '');
    for (const snippet of snippets) {
      lines.push(`### ${snippet.label}`, '');
      if (snippet.description) lines.push(snippet.description, '');
      if (!snippet.insertText.includes('```')) {
        lines.push('```', snippet.insertText, '```', '');
      }
    }
  }

  const dependencies = collectTargetDependencies(manifest.targets || []);
  if (dependencies.length > 0) {
    lines.push('## 构建与运行依赖', '');
    const byTarget = new Map<string, Array<{ label: string; value: string }>>();
    for (const dependency of dependencies) {
      const bucket = byTarget.get(dependency.description) || [];
      bucket.push({ label: dependency.label, value: dependency.value });
      byTarget.set(dependency.description, bucket);
    }
    for (const [target, rows] of byTarget) {
      lines.push(`**${target}**`, '');
      for (const row of rows) {
        if (row.label === '目标') continue;
        lines.push(`- ${row.label}：\`${row.value}\``);
      }
      lines.push('');
    }
  }

  lines.push('## 更多帮助', '');
  lines.push(
    '- 在 IDE 中打开本模块详情页（模块面板点击模块名称），「接口」页签可搜索全部命令与参数说明。',
    '- 命令行为以 IDE 内补全与悬停提示为准，二者与本文同源于模块清单。',
    ''
  );
  return lines.join('\n');
}

export interface BuiltinDocsAuditResult {
  ok: boolean;
  problems: string[];
  generatedCount: number;
}

function getElectronRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function resolveDocFile(electronRoot: string, documentPath: string): string {
  return path.join(electronRoot, ...documentPath.split('/'));
}

/**
 * 全量审计：覆盖面（每个内置模块都有文档）+ 登记文件存在性（含手工内联 docs）+ 生成内容同步。
 * `checkGenerated` 为 false 时跳过逐字比对（生成模式在写盘前调用），true 时用于 --check 与测试门禁。
 */
export function auditBuiltinModuleDocs(options: { checkGenerated: boolean; electronRoot?: string }): BuiltinDocsAuditResult {
  const electronRoot = options.electronRoot || getElectronRoot();
  const problems: string[] = [];
  const manifestById = new Map(BUILTIN_MODULES.map(module => [module.id, module]));

  const uncovered = BUILTIN_MODULES.filter(module => !(module.contributes?.docs?.length) && !BUILTIN_MODULE_DOCUMENT_PATHS[module.id]);
  if (uncovered.length > 0) {
    problems.push(`以下内置模块没有登记任何文档（既无内联 contributes.docs 也不在 builtinModuleDocuments.ts 登记表）：${uncovered.map(module => module.id).join('、')}`);
  }

  for (const [moduleId, documentPath] of Object.entries(BUILTIN_MODULE_DOCUMENT_PATHS)) {
    const manifest = manifestById.get(moduleId);
    if (!manifest) {
      problems.push(`登记表中的模块不存在：${moduleId}`);
      continue;
    }
    const file = resolveDocFile(electronRoot, documentPath);
    if (!fs.existsSync(file)) {
      problems.push(`${moduleId} 的文档文件缺失：${documentPath}（运行 npm run module:builtin-docs 生成）`);
      continue;
    }
    if (options.checkGenerated) {
      const expected = generateBuiltinModuleDocMarkdown(manifest);
      const actual = fs.readFileSync(file, 'utf8');
      if (actual !== expected) {
        problems.push(`${moduleId} 的文档与清单不同步：${documentPath}（清单已变化，请重跑 npm run module:builtin-docs）`);
      }
    }
  }

  for (const module of BUILTIN_MODULES) {
    for (const doc of module.contributes?.docs || []) {
      const file = resolveDocFile(electronRoot, doc.path);
      if (!fs.existsSync(file)) {
        problems.push(`${module.id} 登记的文档文件不存在：${doc.path}`);
      }
    }
  }

  return { ok: problems.length === 0, problems, generatedCount: Object.keys(BUILTIN_MODULE_DOCUMENT_PATHS).length };
}

function main(): number {
  const electronRoot = getElectronRoot();
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    const result = auditBuiltinModuleDocs({ checkGenerated: true, electronRoot });
    if (!result.ok) {
      for (const problem of result.problems) console.error(`[内置模块文档] ${problem}`);
      console.error(`--check 失败：共 ${result.problems.length} 个问题。`);
      return 1;
    }
    console.log(`--check 通过：${result.generatedCount} 篇生成文档与清单同步，全部登记文件存在。`);
    return 0;
  }

  let written = 0;
  const manifestById = new Map(BUILTIN_MODULES.map(module => [module.id, module]));
  for (const [moduleId, documentPath] of Object.entries(BUILTIN_MODULE_DOCUMENT_PATHS)) {
    const manifest = manifestById.get(moduleId);
    if (!manifest) {
      console.error(`[内置模块文档] 登记表中的模块不存在：${moduleId}`);
      return 1;
    }
    const file = resolveDocFile(electronRoot, documentPath);
    const content = generateBuiltinModuleDocMarkdown(manifest);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (existing !== content) {
      fs.writeFileSync(file, content, 'utf8');
      written += 1;
    }
  }
  const result = auditBuiltinModuleDocs({ checkGenerated: false, electronRoot });
  if (!result.ok) {
    for (const problem of result.problems) console.error(`[内置模块文档] ${problem}`);
    return 1;
  }
  console.log(`生成完成：登记表 ${result.generatedCount} 篇，本次写入 ${written} 篇；覆盖面与文件存在性审计通过。`);
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exitCode = main();
}
