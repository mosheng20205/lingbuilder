import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type {
  LingBuilderModuleManifest,
  InstalledModule,
  LingCppModuleContext,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution
} from '../src/services/modules/types';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(electronRoot, '..');
const demosRoot = path.join(workspaceRoot, 'examples', 'module-demos');
const exportsRoot = path.join(workspaceRoot, 'exports');
const solutionPath = path.join(workspaceRoot, '.lingbuilder', 'solution.json');
const MODULE_DEMO_FOLDER_ID = 'module-complete-demos';
const PROJECT_PREFIX = 'module-demo-';
const MAX_TABS = 12;
const PREFERRED_COMMANDS_PER_TAB = 20;
const EXTERNAL_MODULE_IDS = [
  'lingbuilder.new_emoji.ui',
  'lingbuilder.web.http',
  'lingbuilder.cef3.sdk',
  'lingbuilder.fbro.sdk',
  'lingbuilder.crypto.sdk'
] as const;

interface DemoModule {
  manifest: LingBuilderModuleManifest;
  builtin: boolean;
  installPath?: string;
}

interface DemoGroup {
  index: number;
  commands: Array<{ contribution: ModuleCommandContribution; binding: ModuleCommandBinding }>;
}

interface DemoIndexEntry {
  moduleId: string;
  moduleName: string;
  projectId: string;
  commandCount: number;
  controlCount: number;
  groupCount: number;
  builtin: boolean;
  sourceRoot: string;
  packageName: string;
  packageBytes?: number;
}

interface ControlReferenceFixture {
  key: string;
  name: string;
  type: string;
  kind: 'visual' | 'nonVisual' | 'resource';
}

interface PortableSolution {
  schemaVersion: 2;
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  folders?: Array<{ id: string; name: string }>;
  projects: Array<Record<string, unknown> & { id: string }>;
}

const verifyOnly = process.argv.includes('--verify-only');
const skipExport = process.argv.includes('--skip-export');
const deepVerify = process.argv.includes('--deep');
const syncSolutionOnly = process.argv.includes('--sync-solution');
const renamePackagesOnly = process.argv.includes('--rename-packages');
const moduleArgumentIndex = process.argv.indexOf('--module');
const selectedModuleId = moduleArgumentIndex >= 0 ? process.argv[moduleArgumentIndex + 1]?.trim() : undefined;

async function main(): Promise<void> {
  const allModules = await loadAllModules();
  const modules = selectedModuleId ? allModules.filter(module => module.manifest.id === selectedModuleId) : allModules;
  if (selectedModuleId && modules.length === 0) throw new Error(`找不到模块：${selectedModuleId}`);
  const duplicateIds = duplicateValues(modules.map(module => module.manifest.id));
  if (duplicateIds.length) throw new Error(`模块 ID 重复：${duplicateIds.join('、')}`);

  if (verifyOnly) {
    const verified = await verifyGeneratedDemos(modules, deepVerify, allModules);
    console.log(`模块演示验证通过：${verified.length} 个项目，${verified.reduce((sum, item) => sum + item.commandCount, 0)} 条命令。`);
    return;
  }

  if (syncSolutionOnly) {
    await updateRootSolution(modules.map(module => describeDemoEntry(module)), !selectedModuleId);
    console.log(`解决方案入口已同步：${modules.length} 个模块演示项目。`);
    return;
  }

  if (renamePackagesOnly) {
    const entries = modules.map(module => describeDemoEntry(module));
    await fs.mkdir(exportsRoot, { recursive: true });
    for (const [index, entry] of entries.entries()) {
      const oldPath = path.join(exportsRoot, `${PROJECT_PREFIX}${entry.moduleId}.lcpppkg`);
      const newPath = path.join(exportsRoot, entry.packageName);
      if (oldPath !== newPath && await exists(oldPath)) {
        if (await exists(newPath)) throw new Error(`目标中文源码包已存在，未覆盖：${entry.packageName}`);
        await fs.rename(oldPath, newPath);
      }
      entry.packageBytes = (await fs.stat(newPath)).size;
      const percent = (((index + 1) / entries.length) * 100).toFixed(2);
      console.log(`[${index + 1}/${entries.length}，${percent}%] ${entry.moduleName} -> ${entry.packageName}`);
    }
    await writeDemoIndex(entries);
    console.log(`中文源码包命名完成：${entries.length}/${entries.length}，100%。`);
    return;
  }

  await fs.mkdir(demosRoot, { recursive: true });
  await fs.mkdir(exportsRoot, { recursive: true });
  const entries: DemoIndexEntry[] = [];
  for (const module of modules) entries.push(await generateModuleDemo(module));
  await updateRootSolution(entries, !selectedModuleId);
  let indexEntries = entries;
  if (selectedModuleId) {
    const indexPath = path.join(demosRoot, 'module-demo-index.json');
    const existing = JSON.parse(await fs.readFile(indexPath, 'utf8')) as { modules?: DemoIndexEntry[] };
    indexEntries = [...(existing.modules || []).filter(entry => entry.moduleId !== selectedModuleId), ...entries]
      .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  }
  await writeDemoIndex(indexEntries);

  if (!skipExport) {
    const sourcePackages = createLcppSourcePackageService(workspaceRoot);
    for (const [index, entry] of entries.entries()) {
      const target = path.join(exportsRoot, entry.packageName);
      const result = await sourcePackages.exportProject(entry.projectId, target, '0.2.7-module-demos');
      entry.packageBytes = (await fs.stat(result.packagePath)).size;
      console.log(`[${index + 1}/${entries.length}] 已导出 ${entry.moduleId} -> ${entry.packageName}`);
    }
    if (selectedModuleId) {
      const updated = indexEntries.map(entry => entry.moduleId === selectedModuleId ? entries[0] : entry);
      await writeDemoIndex(updated);
    } else await writeDemoIndex(entries);
  }

  await verifyGeneratedDemos(modules, !skipExport, allModules);
  console.log(`模块演示生成完成：${entries.length} 个项目，${entries.reduce((sum, item) => sum + item.commandCount, 0)} 条命令。`);
}

async function loadAllModules(): Promise<DemoModule[]> {
  const modules: DemoModule[] = BUILTIN_MODULES.map(manifest => ({ manifest, builtin: true }));
  for (const id of EXTERNAL_MODULE_IDS) {
    const installPath = path.join(workspaceRoot, '.lingbuilder', 'modules', id);
    const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as LingBuilderModuleManifest;
    modules.push({ manifest, builtin: false, installPath });
  }
  return modules.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
}

async function generateModuleDemo(module: DemoModule): Promise<DemoIndexEntry> {
  const { manifest } = module;
  const projectId = projectIdFor(manifest.id);
  const slug = manifest.id;
  const projectRoot = path.join(demosRoot, slug);
  const sourceRoot = path.join(projectRoot, 'src');
  const configRoot = path.join(projectRoot, 'config');
  const designerRoot = path.join(workspaceRoot, '.lingbuilder', 'projects', projectId);
  const commands = pairCommands(manifest);
  const groups = createGroups(commands);
  const isNewEmoji = manifest.id === 'lingbuilder.new_emoji.ui';
  const enabledModuleIds = unique([
    'lingbuilder.win32.basic',
    ...(isNewEmoji ? [] : ['lingbuilder.win32.common-controls']),
    manifest.id
  ]);

  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(configRoot, { recursive: true });
  await fs.mkdir(designerRoot, { recursive: true });
  await fs.writeFile(path.join(sourceRoot, 'MainWindow.lcpp'), createSource(manifest, groups), 'utf8');
  if (manifest.id === 'lingbuilder.edgeview') {
    await fs.writeFile(path.join(sourceRoot, 'EdgeMultiControlWindow.lcpp'), createEdgeViewMultiControlSource(), 'utf8');
  }
  await fs.writeFile(path.join(sourceRoot, '项目全局变量.lcpp'), '// 本模块演示不需要项目级全局变量。\n', 'utf8');
  await fs.writeFile(path.join(sourceRoot, '项目数据类型.lcpp'), '// 本模块演示不需要项目级自定义数据类型。\n', 'utf8');
  await fs.writeFile(path.join(sourceRoot, 'README.md'), createModuleReadme(manifest, groups, module.builtin), 'utf8');
  await fs.writeFile(path.join(sourceRoot, '模块命令清单.json'), JSON.stringify(createCommandCatalog(manifest, commands), null, 2), 'utf8');
  await fs.writeFile(path.join(configRoot, 'config.ini'), `[project]\nname=${manifest.name}完整演示\nmoduleId=${manifest.id}\n`, 'utf8');
  await fs.writeFile(path.join(designerRoot, 'window-designer.json'), JSON.stringify(createDesigner(manifest, groups, isNewEmoji), null, 2), 'utf8');
  await fs.writeFile(path.join(designerRoot, 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds,
    pinnedVersions: Object.fromEntries(enabledModuleIds.map(id => [id, versionFor(id, manifest)]))
  }, null, 2), 'utf8');

  return {
    moduleId: manifest.id,
    moduleName: manifest.name,
    projectId,
    commandCount: commands.length,
    controlCount: manifest.contributes?.designerControls?.length || 0,
    groupCount: groups.length,
    builtin: module.builtin,
    sourceRoot: path.relative(workspaceRoot, sourceRoot).replace(/\\/g, '/'),
    packageName: packageFileNameFor(manifest)
  };
}

function describeDemoEntry(module: DemoModule): DemoIndexEntry {
  const commands = pairCommands(module.manifest);
  return {
    moduleId: module.manifest.id,
    moduleName: module.manifest.name,
    projectId: projectIdFor(module.manifest.id),
    commandCount: commands.length,
    controlCount: module.manifest.contributes?.designerControls?.length || 0,
    groupCount: createGroups(commands).length,
    builtin: module.builtin,
    sourceRoot: `examples/module-demos/${module.manifest.id}/src`,
    packageName: packageFileNameFor(module.manifest)
  };
}

function pairCommands(manifest: LingBuilderModuleManifest): Array<{ contribution: ModuleCommandContribution; binding: ModuleCommandBinding }> {
  const contributions = manifest.contributes?.commands || [];
  const bindings = manifest.bindings?.commands || [];
  const contributionByName = new Map(contributions.map(command => [command.name, command]));
  const bindingByName = new Map(bindings.map(binding => [binding.command, binding]));
  const missingBindings = contributions.filter(command => !bindingByName.has(command.name));
  const missingContributions = bindings.filter(binding => !contributionByName.has(binding.command));
  if (missingBindings.length || missingContributions.length) {
    throw new Error(`${manifest.id} contribution/binding 不一致：缺少 binding ${missingBindings.map(item => item.name).join(',')}；缺少 contribution ${missingContributions.map(item => item.command).join(',')}`);
  }
  return contributions.map(contribution => ({ contribution, binding: bindingByName.get(contribution.name)! }));
}

function createGroups(commands: Array<{ contribution: ModuleCommandContribution; binding: ModuleCommandBinding }>): DemoGroup[] {
  if (commands.length === 0) return [{ index: 1, commands: [] }];
  const groupCount = Math.min(MAX_TABS, Math.max(1, Math.ceil(commands.length / PREFERRED_COMMANDS_PER_TAB)));
  const groupSize = Math.ceil(commands.length / groupCount);
  const groups: DemoGroup[] = [];
  for (let offset = 0; offset < commands.length; offset += groupSize) {
    groups.push({ index: groups.length + 1, commands: commands.slice(offset, offset + groupSize) });
  }
  return groups;
}

function createSource(manifest: LingBuilderModuleManifest, groups: DemoGroup[]): string {
  if (manifest.id === 'lingbuilder.data.json') return createJsonDemoSource(manifest);
  const controlFixtures = createControlReferenceFixtures(manifest);
  const lines = [
    `包 ${safeIdentifier(manifest.name)}完整演示`,
    '使用 Win32窗口基础模块',
    ...(manifest.id === 'lingbuilder.win32.basic' ? [] : [`使用 ${manifest.name.replace(/\s+/gu, '')}`]),
    '',
    '// 本项目由模块清单自动生成；每条 binding 命令都在下方具有真实调用语句。',
    '// 为避免误删文件、启动进程、访问网络或操作设备，必须先勾选“允许实际执行”才会进入命令调用区。',
    '类 MainWindow : 公开 窗口',
    '    事件 _MainWindow_创建完毕()',
    '        控件_设置选择项(命令分组选项卡, 0)',
    `        控件_设置文本(演示状态, "${escapeLcppString(manifest.name)}：${(manifest.bindings?.commands || []).length} 条命令，默认处于安全预览模式。")`,
    `        调试输出("已加载模块演示：${escapeLcppString(manifest.id)}")`,
    ...(manifest.id === 'lingbuilder.edgeview' ? ['        打开窗口("Edge 多控件安全示例", "居中")'] : []),
    '    结束',
    ''
  ];

  for (const group of groups) {
    const range = groupRange(group, groups);
    lines.push(`    事件 _运行第${pad(group.index)}组_被单击()`);
    lines.push(`        控件_设置文本(演示状态, "${escapeLcppString(range)}；源码内含完整签名、参数、返回值与调用。")`);
    if (group.commands.length === 0) {
      lines.push(`        调试输出("${escapeLcppString(manifest.name)} 是只读资产模块，不公开 LCPP 命令。")`);
    } else {
      lines.push('        如果 (控件_取勾选(允许实际执行))');
      for (const [offset, item] of group.commands.entries()) {
        const absoluteIndex = groups.slice(0, group.index - 1).reduce((sum, current) => sum + current.commands.length, 0) + offset + 1;
        lines.push(`            // 命令ID：${item.contribution.name}`);
        lines.push(`            // [${absoluteIndex}] ${sanitizeComment(item.contribution.signature)}`);
        lines.push(`            // 功能：${sanitizeComment(item.contribution.description)}`);
        lines.push(`            // 参数：${describeParameters(item.binding.parameters)}；返回：${item.binding.returnType || 'void'}；可见性：${item.contribution.visibility || 'default'}`);
        lines.push(`            ${createInvocation(item.binding, controlFixtures)}`);
      }
      lines.push('        如果结束');
      lines.push(`        调试输出("已查看 ${escapeLcppString(range)}；勾选允许实际执行后会使用演示参数调用。")`);
    }
    lines.push('    结束', '');
  }

  if (manifest.id === 'lingbuilder.threading') {
    lines.push(
      '    空 模块演示工作()',
      '        线程_协作等待(1)',
      '    结束',
      '',
      '    空 模块演示进度工作()',
      '        线程_报告进度(100, "演示工作完成")',
      '    结束',
      '',
      '    空 模块演示进度(线程任务 任务, 整数型 百分比, 文本型 说明)',
      '        调试输出(说明)',
      '    结束',
      '',
      '    空 模块演示完成(线程任务 任务)',
      '        调试输出("模块演示任务完成")',
      '    结束',
      ''
    );
  } else {
    const handlers = new Map<string, ModuleCommandBindingParameter>();
    for (const binding of manifest.bindings?.commands || []) {
      for (const parameter of binding.parameters || []) {
        if (parameter.type === 'handler') handlers.set(handlerDemoName(parameter), parameter);
      }
    }
    for (const [name, parameter] of handlers) {
      const parameters = (parameter.handlerSignature?.parameterTypes || [])
        .map((type, index) => `${type} 参数${index + 1}`)
        .join(', ');
      lines.push(`    事件 ${name}(${parameters})`, '        调试输出("模块演示回调已触发。")', '    结束', '');
    }
  }
  lines.push('结束类', '');
  return lines.join('\n');
}

function createJsonDemoSource(manifest: LingBuilderModuleManifest): string {
  const lines = [
    `包 ${safeIdentifier(manifest.name)}完整演示`,
    '使用 Win32窗口基础模块',
    '使用 JSON数据模块',
    '',
    '// JSON 2.0 三页实战示例：解析/读取、创建各种类型、Pointer/Patch/Schema。',
    '// 勾选“允许实际执行”后运行当前页；所有 JSON值 都在页尾显式释放。',
    '类 MainWindow : 公开 窗口',
    '    事件 _MainWindow_创建完毕()',
    '        控件_设置选择项(命令分组选项卡, 0)',
    '        控件_设置文本(演示状态, "JSON 数据模块 2.0：解析、创建、Pointer、Patch 与 Schema 示例。")',
    '        调试输出("已加载 JSON 数据模块 2.0 演示。")',
    '    结束',
    '',
    '    事件 _运行第01组_被单击()',
    '        控件_设置文本(演示状态, "解析与类型读取：对象、数组、文本、整数、小数、逻辑和 null。")',
    '        如果 (控件_取勾选(允许实际执行))',
    '            // 命令ID：JSON_是否有效',
    '            JSON_是否有效("{\\"名称\\":\\"LingBuilder\\",\\"版本\\":2}")',
    '            // 命令ID：JSON_转义文本',
    '            调试输出(JSON_转义文本("带引号和反斜杠的文本"))',
    '            // 命令ID：JSON_反转义文本',
    '            调试输出(JSON_反转义文本(JSON_转义文本("反转义示例")))',
    '            局部 文本型 JSON文本 = "{\\"名称\\":\\"LingBuilder\\",\\"版本\\":2,\\"比例\\":3.14,\\"启用\\":true,\\"可选\\":null,\\"标签\\":[\\"中文\\",\\"C++\\"]}"',
    '            // 命令ID：JSON_解析',
    '            局部 JSON值 根 = JSON_解析(JSON文本)',
    '            如果 (根 = 0)',
    '                调试输出(JSON_取最后错误())',
    '            否则',
    '                // 命令ID：JSON_序列化',
    '                调试输出(JSON_序列化(根))',
    '                // 命令ID：JSON_序列化格式化',
    '                调试输出(JSON_序列化格式化(根, 2))',
    '                // 命令ID：JSON_格式化文本',
    '                调试输出(JSON_格式化文本(JSON文本, 2))',
    '                // 命令ID：JSON_压缩文本',
    '                调试输出(JSON_压缩文本(JSON文本))',
    '                // 命令ID：JSON_取类型',
    '                调试输出("根类型：", JSON_取类型(根))',
    '                // 命令ID：JSON_是否对象',
    '                调试输出("是否对象：", JSON_是否对象(根))',
    '                // 命令ID：JSON_对象_数量',
    '                调试输出("对象成员数：", JSON_对象_数量(根))',
    '                // 命令ID：JSON_对象_是否包含',
    '                调试输出("包含名称：", JSON_对象_是否包含(根, "名称"))',
    '                // 命令ID：JSON_指针_取',
    '                局部 JSON值 名称 = JSON_指针_取(根, "/名称")',
    '                局部 JSON值 版本 = JSON_指针_取(根, "/版本")',
    '                局部 JSON值 比例 = JSON_指针_取(根, "/比例")',
    '                局部 JSON值 启用 = JSON_指针_取(根, "/启用")',
    '                局部 JSON值 可选 = JSON_指针_取(根, "/可选")',
    '                局部 JSON值 标签 = JSON_指针_取(根, "/标签")',
    '                // 命令ID：JSON_取文本值',
    '                调试输出("名称：", JSON_取文本值(名称, "未知"))',
    '                // 命令ID：JSON_取整数值',
    '                调试输出("版本：", JSON_取整数值(版本, -1))',
    '                // 命令ID：JSON_取小数值',
    '                调试输出("比例：", JSON_取小数值(比例, 0.0))',
    '                // 命令ID：JSON_取逻辑值',
    '                调试输出("启用：", JSON_取逻辑值(启用, 假))',
    '                // 命令ID：JSON_是否文本',
    '                调试输出("名称是文本：", JSON_是否文本(名称))',
    '                // 命令ID：JSON_是否数字',
    '                调试输出("版本是数字：", JSON_是否数字(版本))',
    '                // 命令ID：JSON_是否逻辑',
    '                调试输出("启用是逻辑：", JSON_是否逻辑(启用))',
    '                // 命令ID：JSON_是否空',
    '                调试输出("可选是 null：", JSON_是否空(可选))',
    '                // 命令ID：JSON_是否数组',
    '                调试输出("标签是数组：", JSON_是否数组(标签))',
    '                // 命令ID：JSON_数组_数量',
    '                调试输出("标签数量：", JSON_数组_数量(标签))',
    '                // 命令ID：JSON_数组_取',
    '                局部 JSON值 第一个标签 = JSON_数组_取(标签, 0)',
    '                调试输出("第一个标签：", JSON_取文本值(第一个标签, ""))',
    '                // 命令ID：JSON_克隆',
    '                局部 JSON值 副本 = JSON_克隆(根)',
    '                调试输出("克隆结果：", JSON_序列化(副本))',
    '                // 命令ID：JSON_取最后错误',
    '                调试输出("最近错误（成功后应为空）：", JSON_取最后错误())',
    '                // 命令ID：JSON_取文本',
    '                调试输出("兼容文本读取：", JSON_取文本(JSON文本, "名称"))',
    '                // 命令ID：JSON_取整数',
    '                调试输出("兼容整数读取：", JSON_取整数(JSON文本, "版本", -1))',
    '                // 命令ID：JSON_取逻辑',
    '                调试输出("兼容逻辑读取：", JSON_取逻辑(JSON文本, "启用", 假))',
    '                // 命令ID：JSON_释放',
    '                JSON_释放(第一个标签)',
    '                JSON_释放(标签)',
    '                JSON_释放(可选)',
    '                JSON_释放(启用)',
    '                JSON_释放(比例)',
    '                JSON_释放(版本)',
    '                JSON_释放(名称)',
    '                JSON_释放(副本)',
    '                JSON_释放(根)',
    '            如果结束',
    '        如果结束',
    '        调试输出("第 1 页完成：已读取 JSON 中的各种类型。")',
    '    结束',
    '',
    '    事件 _运行第02组_被单击()',
    '        控件_设置文本(演示状态, "创建各种 JSON 类型：null、文本、整数、长整数、小数、逻辑、数组和对象。")',
    '        如果 (控件_取勾选(允许实际执行))',
    '            // 命令ID：JSON_创建空',
    '            局部 JSON值 空值 = JSON_创建空()',
    '            // 命令ID：JSON_创建文本',
    '            局部 JSON值 文本值 = JSON_创建文本("LingBuilder 中文 IDE")',
    '            // 命令ID：JSON_创建整数',
    '            局部 JSON值 整数值 = JSON_创建整数(42)',
    '            // 命令ID：JSON_创建长整数',
    '            局部 JSON值 长整数值 = JSON_创建长整数(900719925474099)',
    '            // 命令ID：JSON_创建小数',
    '            局部 JSON值 小数值 = JSON_创建小数(3.1415926)',
    '            // 命令ID：JSON_创建逻辑',
    '            局部 JSON值 逻辑值 = JSON_创建逻辑(真)',
    '            // 命令ID：JSON_创建数组',
    '            局部 JSON值 数组 = JSON_创建数组()',
    '            // 命令ID：JSON_数组_添加',
    '            JSON_数组_添加(数组, 文本值)',
    '            JSON_数组_添加(数组, 整数值)',
    '            JSON_数组_添加(数组, 逻辑值)',
    '            // 命令ID：JSON_数组_插入',
    '            JSON_数组_插入(数组, 1, 小数值)',
    '            // 命令ID：JSON_数组_设置',
    '            JSON_数组_设置(数组, 0, 长整数值)',
    '            // 命令ID：JSON_取长整数值',
    '            调试输出("长整数读取：", JSON_取长整数值(长整数值, 0))',
    '            // 命令ID：JSON_对象_设置',
    '            // 命令ID：JSON_创建对象',
    '            局部 JSON值 对象 = JSON_创建对象()',
    '            JSON_对象_设置(对象, "空", 空值)',
    '            JSON_对象_设置(对象, "文本", 文本值)',
    '            JSON_对象_设置(对象, "整数", 整数值)',
    '            JSON_对象_设置(对象, "长整数", 长整数值)',
    '            JSON_对象_设置(对象, "小数", 小数值)',
    '            JSON_对象_设置(对象, "逻辑", 逻辑值)',
    '            JSON_对象_设置(对象, "数组", 数组)',
    '            // 命令ID：JSON_对象_数量',
    '            调试输出("对象成员数：", JSON_对象_数量(对象))',
    '            // 命令ID：JSON_对象_键列表',
    '            调试输出("对象键列表：", JSON_对象_键列表(对象))',
    '            // 命令ID：JSON_对象_是否包含',
    '            调试输出("包含数组：", JSON_对象_是否包含(对象, "数组"))',
    '            // 命令ID：JSON_对象_取',
    '            局部 JSON值 读取值 = JSON_对象_取(对象, "文本")',
    '            调试输出("读取对象成员：", JSON_取文本值(读取值, ""))',
    '            // 命令ID：JSON_对象_移除',
    '            JSON_对象_移除(对象, "逻辑")',
    '            // 命令ID：JSON_数组_数量',
    '            调试输出("数组成员数：", JSON_数组_数量(数组))',
    '            // 命令ID：JSON_序列化格式化',
    '            调试输出(JSON_序列化格式化(对象, 2))',
    '            // 命令ID：JSON_数组_移除',
    '            JSON_数组_移除(数组, 1)',
    '            // 命令ID：JSON_数组_清空',
    '            JSON_数组_清空(数组)',
    '            // 命令ID：JSON_对象_清空',
    '            JSON_对象_清空(对象)',
    '            // 命令ID：JSON_释放',
    '            JSON_释放(读取值)',
    '            JSON_释放(对象)',
    '            JSON_释放(数组)',
    '            JSON_释放(逻辑值)',
    '            JSON_释放(小数值)',
    '            JSON_释放(长整数值)',
    '            JSON_释放(整数值)',
    '            JSON_释放(文本值)',
    '            JSON_释放(空值)',
    '        如果结束',
    '        调试输出("第 2 页完成：所有 JSON 基础类型已创建并序列化。")',
    '    结束',
    '',
    '    事件 _运行第03组_被单击()',
    '        控件_设置文本(演示状态, "Pointer、Patch 与 Schema：嵌套修改、原子补丁和中文校验错误。")',
    '        如果 (控件_取勾选(允许实际执行))',
    '            局部 JSON值 文档 = JSON_解析("{\\"用户\\":{\\"名称\\":\\"小明\\",\\"等级\\":3},\\"标签\\":[\\"中文\\"]}")',
    '            // 命令ID：JSON_指针_设置',
    '            局部 JSON值 新名称 = JSON_创建文本("LingBuilder 用户")',
    '            JSON_指针_设置(文档, "/用户/名称", 新名称, 假)',
    '            // 命令ID：JSON_指针_取',
    '            局部 JSON值 当前名称 = JSON_指针_取(文档, "/用户/名称")',
    '            调试输出("Pointer 读取：", JSON_取文本值(当前名称, ""))',
    '            // 命令ID：JSON_指针_移除',
    '            JSON_指针_移除(文档, "/用户/等级")',
    '            局部 JSON值 目标 = JSON_解析("{\\"用户\\":{\\"名称\\":\\"LingBuilder 用户\\"},\\"标签\\":[\\"中文\\",\\"JSON\\"]}")',
    '            // 命令ID：JSON_生成补丁',
    '            局部 文本型 自动补丁 = JSON_生成补丁(文档, 目标)',
    '            调试输出("生成的 RFC 6902 补丁：", 自动补丁)',
    '            // 命令ID：JSON_应用补丁',
    '            JSON_应用补丁(文档, "[{\\"op\\":\\"add\\",\\"path\\":\\"/标签/-\\",\\"value\\":\\"补丁\\"}]")',
    '            // 命令ID：JSON_合并补丁',
    '            JSON_合并补丁(文档, "{\\"来源\\":\\"Merge Patch\\"}")',
    '            局部 文本型 规则 = "{\\"type\\":\\"object\\",\\"required\\":[\\"用户\\"],\\"properties\\":{\\"用户\\":{\\"type\\":\\"object\\",\\"required\\":[\\"名称\\"]}}}"',
    '            // 命令ID：JSON_Schema验证',
    '            如果 (JSON_Schema验证(文档, 规则) = 假)',
    '                调试输出("Schema 错误：", JSON_取最后错误())',
    '            如果结束',
    '            调试输出(JSON_序列化格式化(文档, 2))',
    '            // 命令ID：JSON_释放',
    '            JSON_释放(当前名称)',
    '            JSON_释放(新名称)',
    '            JSON_释放(目标)',
    '            JSON_释放(文档)',
    '        如果结束',
    '        调试输出("第 3 页完成：Pointer、Patch 和 Schema 均为本地确定性操作。")',
    '    结束',
    '',
    '结束类',
    ''
  ];
  return lines.join('\n');
}

function createInvocation(binding: ModuleCommandBinding, controlFixtures: readonly ControlReferenceFixture[]): string {
  const args = (binding.parameters || []).flatMap((parameter, index) => {
    if (parameter.variadic) return [];
    if (binding.invocation?.kind === 'managedTask' && parameter.type === 'handler') {
      if (index === binding.invocation.progressParameterIndex) return ['&模块演示进度'];
      if (index === binding.invocation.completionParameterIndex) return ['&模块演示完成'];
      if (index === binding.invocation.workerParameterIndex) {
        return [binding.invocation.progressParameterIndex === undefined ? '&模块演示工作' : '&模块演示进度工作'];
      }
    }
    return [defaultArgument(parameter, index, controlFixtures)];
  });
  return `${binding.command}(${args.join(', ')})`;
}

function defaultArgument(
  parameter: ModuleCommandBindingParameter,
  index: number,
  controlFixtures: readonly ControlReferenceFixture[]
): string {
  if (parameter.type === 'handler') return `&${handlerDemoName(parameter)}`;
  if (parameter.type === 'controlRef') return selectControlReferenceFixture(parameter, controlFixtures).name;
  if (parameter.type === 'wideString' || parameter.type === 'utf8String') {
    const name = parameter.name.toLowerCase();
    if (/url|网址|地址/u.test(name)) return '"https://example.com"';
    if (/文件|路径/u.test(name)) return '"module-demo-temp.txt"';
    if (/目录/u.test(name)) return '"."';
    if (/json|配置|指纹/u.test(name)) return '"{}"';
    if (/控件/u.test(name)) return '"演示输出"';
    if (/事件/u.test(name)) return '"演示事件"';
    return `"演示参数${index + 1}"`;
  }
  if (parameter.type === 'bool') return '真';
  if (parameter.type === 'bytes') return '{}';
  if (parameter.type === 'double') return '1.0';
  if (parameter.type === 'longLong') return '1';
  if (parameter.type === 'int') return '1';
  return '0';
}

function handlerDemoName(parameter: ModuleCommandBindingParameter): string {
  const signature = parameter.handlerSignature;
  if (!signature?.parameterTypes.length) return '模块演示回调';
  const suffix = [...signature.parameterTypes, signature.returnType]
    .map(type => safeIdentifier(type) || '值')
    .join('_');
  return `模块演示回调_${suffix}`;
}

function createDesigner(manifest: LingBuilderModuleManifest, groups: DemoGroup[], newEmoji: boolean) {
  const jsonTabTitles = ['解析与类型读取', '创建各种 JSON 类型', 'Pointer、Patch 与 Schema'];
  const tabs = groups.map(group => ({
    id: `group-${pad(group.index)}`,
    title: manifest.id === 'lingbuilder.data.json' ? (jsonTabTitles[group.index - 1] || `第${pad(group.index)}组`) : `第${pad(group.index)}组`,
    image: -1
  }));
  const controls: Array<Record<string, unknown>> = [];
  controls.push(controlBase({
    id: 'title', type: 'Label', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Text' : undefined,
    name: '标题', content: `${manifest.name} · 全命令演示`, x: 24, y: 18, width: 1080, height: 36,
    fontSize: 21, fontBold: true, foreground: '#F8FAFC'
  }));
  controls.push(controlBase({
    id: 'safe-toggle', type: 'CheckBox', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/CheckBox' : undefined,
    name: '允许实际执行', content: '允许实际执行（可能访问网络、文件、进程或设备）', x: 24, y: 62, width: 560, height: 34,
    background: '#7F1D1D', foreground: '#FEE2E2', properties: { checked: false }
  }));
  controls.push(controlBase({
    id: 'status', type: 'Label', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Text' : undefined,
    name: '演示状态', content: '默认安全预览：查看源码和清单，不实际执行命令。', x: 604, y: 62, width: 500, height: 34,
    background: '#172554', foreground: '#DBEAFE'
  }));
  controls.push(controlBase({
    id: 'tabs', type: 'TabControl', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Tabs' : undefined,
    name: '命令分组选项卡', content: '', x: 24, y: 112, width: 1080, height: 590,
    background: '#1E293B', foreground: '#E2E8F0',
    properties: newEmoji
      ? { items: tabs.map(tab => tab.title), tabs, activeIndex: 0, selectedIndex: 0, tabType: '0', position: '0', headerAlign: '1', closable: false, addable: false, editable: false, contentVisible: true }
      : { tabs, selectedIndex: 0, hideHeader: false }
  }));
  for (const group of groups) {
    const slot = `group-${pad(group.index)}`;
    const range = groupRange(group, groups);
    const tabTitle = tabs[group.index - 1]?.title || `第${pad(group.index)}组`;
    controls.push(controlBase({
      id: `group-${pad(group.index)}-title`, type: 'Label', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Text' : undefined,
      name: `${tabTitle}说明`, content: manifest.id === 'lingbuilder.data.json' ? tabTitle : range, x: 58, y: 174, width: 980, height: 76,
      fontSize: 16, fontBold: true, background: '#0F172A', foreground: '#7DD3FC', parentId: 'tabs', containerSlot: slot
    }));
    controls.push(controlBase({
      id: `group-${pad(group.index)}-detail`, type: 'Label', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Text' : undefined,
      name: `第${pad(group.index)}组详情`, content: group.commands.length
        ? manifest.id === 'lingbuilder.data.json'
          ? (group.index === 1
            ? '解析嵌套对象并读取文本、整数、小数、逻辑、null 和数组元素；同时查看兼容接口。'
            : group.index === 2
              ? '创建 null、文本、整数、长整数、小数、逻辑、数组和对象，演示深度复制与生命周期。'
              : '用 JSON Pointer 定位和修改，用 JSON Patch/Merge Patch 原子更新，最后执行 Schema 核心校验。')
          : `本页覆盖 ${group.commands.length} 条命令。完整签名、功能、参数、返回值和调用位于 MainWindow.lcpp 与模块命令清单.json。`
        : '该模块是只读 SDK/资产载体，没有 LCPP 命令；本项目说明其版本、用途和消费方式。',
      x: 58, y: 274, width: 980, height: 110, background: '#111827', foreground: '#CBD5E1', parentId: 'tabs', containerSlot: slot
    }));
    controls.push(controlBase({
      id: `group-${pad(group.index)}-run`, type: 'Button', designerType: newEmoji ? 'lingbuilder.new_emoji.ui/Button' : undefined,
      name: `运行第${pad(group.index)}组`, content: group.commands.length
        ? manifest.id === 'lingbuilder.data.json' ? `运行：${tabTitle}` : `查看/运行第 ${pad(group.index)} 组`
        : '查看资产模块说明',
      x: 58, y: 420, width: 300, height: 44, background: '#0369A1', foreground: '#FFFFFF', parentId: 'tabs', containerSlot: slot,
      events: { Click: `_运行第${pad(group.index)}组_被单击` }
    }));
  }
  const controlFixtures = createControlReferenceFixtures(manifest);
  controlFixtures.filter(fixture => fixture.kind !== 'resource' && !isBuiltinDemoFixture(fixture)).forEach((fixture, index) => {
    controls.push(controlBase({
      id: `control-ref-${fixture.key}`,
      type: fixture.type,
      name: fixture.name,
      content: `${fixture.type} controlRef 演示对象`,
      x: 24 + (index % 6) * 8,
      y: 716 + Math.floor(index / 6) * 8,
      width: 2,
      height: 2,
      visibility: 'Collapsed'
    }));
  });
  const windows: Array<Record<string, unknown>> = [{
    id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: `${manifest.name}完整演示`,
    width: 1140, height: 760, background: '#0F172A', titleBarBackground: '#111827', titleBarForeground: '#F8FAFC',
    description: manifest.id === 'lingbuilder.data.json'
      ? '通过三个选项卡演示 JSON 解析、各种类型创建、Pointer、Patch、Merge Patch 和 Schema 核心校验。'
      : `逐条覆盖 ${manifest.bindings?.commands?.length || 0} 条模块命令。`, designerBackend: newEmoji ? 'new-emoji' : 'win32',
    openPlacement: 'center', resizable: true, maximizable: true, events: { Loaded: '_MainWindow_创建完毕' }, controls
  }];
  if (manifest.id === 'lingbuilder.edgeview') windows.push(createEdgeViewMultiControlWindow());
  return {
    schemaVersion: 2,
    id: projectIdFor(manifest.id),
    name: `${manifest.name}完整演示`,
    resources: controlFixtures
      .filter(fixture => fixture.kind === 'resource')
      .map(createControlReferenceResource),
    windows
  };
}

function createEdgeViewMultiControlSource(): string {
  return [
    '类 EdgeMultiControlWindow : 公开 窗口',
    '    事件 _EdgeMultiControlWindow_创建完毕()',
    '        EdgeView脚本_文档预注入异步(根级Edge, "document.body.innerHTML=\'LingBuilder EdgeView root\'", &根级脚本完成)',
    '    结束',
    '',
    '    事件 根级脚本完成()',
    '        调试输出(EdgeView任务_取结果(EdgeView任务_取当前任务ID()))',
    '        EdgeView任务_释放(EdgeView任务_取当前任务ID())',
    '    结束',
    '结束类',
    ''
  ].join('\n');
}

function createEdgeViewMultiControlWindow(): Record<string, unknown> {
  return {
    id: 'edge-multi-control-window', fileName: 'EdgeMultiControlWindow.xml', className: 'EdgeMultiControlWindow', title: 'Edge 多控件安全示例',
    width: 1180, height: 760, background: '#111827', titleBarBackground: '#0F172A', titleBarForeground: '#F8FAFC',
    description: '根级、分组框和选项卡页中的四个 Edge 控件均拥有独立 HWND、Profile 和 UDF。', designerBackend: 'win32',
    openPlacement: 'center', resizable: true, maximizable: true, events: { Loaded: '_EdgeMultiControlWindow_创建完毕' },
    controls: [
      controlBase({ id: 'edge-root', type: 'EdgeBrowser', designerType: 'lingbuilder.edgeview/EdgeBrowser', name: '根级Edge', x: 18, y: 18, width: 520, height: 300,
        properties: { url: 'about:blank', cacheDir: '.edgeview/demo-root', userAgent: 'LingBuilder-EdgeView-Demo/1.1', enableScript: true, enableWebMessage: true, enableDevTools: false, enableContextMenu: true, enableStatusBar: true, zoomFactor: 100, muteAudio: false, defaultBackgroundColor: '#FFFFFF', allowExternalDrop: false, profileName: 'demo-root', inPrivate: false, language: 'zh-CN', trackingPrevention: 'balanced', enableAutofill: false, enablePasswordAutosave: false } }),
      controlBase({ id: 'edge-group', type: 'GroupBox', name: 'Edge 分组框', content: '分组框内独立 Edge', x: 560, y: 18, width: 570, height: 320, background: '#1E293B' }),
      controlBase({ id: 'edge-in-group', parentId: 'edge-group', type: 'EdgeBrowser', designerType: 'lingbuilder.edgeview/EdgeBrowser', name: '分组框 Edge', x: 16, y: 42, width: 530, height: 250,
        properties: { url: 'about:blank', cacheDir: '.edgeview/demo-group', profileName: 'demo-group', muteAudio: true, enableDevTools: false } }),
      controlBase({ id: 'edge-tabs', type: 'TabControl', name: 'Edge 选项卡', x: 18, y: 360, width: 1112, height: 330, background: '#1E293B',
        properties: { tabs: [{ id: 'edge-page-a', title: '独立页面 A', image: -1 }, { id: 'edge-page-b', title: '独立页面 B', image: -1 }], selectedIndex: 0, hideHeader: false } }),
      controlBase({ id: 'edge-in-tab-a', parentId: 'edge-tabs', containerSlot: 'edge-page-a', type: 'EdgeBrowser', designerType: 'lingbuilder.edgeview/EdgeBrowser', name: '选项卡 Edge A', x: 18, y: 48, width: 1040, height: 235,
        properties: { url: 'about:blank', cacheDir: '.edgeview/demo-tab-a', profileName: 'demo-tab-a', enableDevTools: false } }),
      controlBase({ id: 'edge-in-tab-b', parentId: 'edge-tabs', containerSlot: 'edge-page-b', type: 'EdgeBrowser', designerType: 'lingbuilder.edgeview/EdgeBrowser', name: '选项卡 Edge B', x: 18, y: 48, width: 1040, height: 235, visibility: 'Collapsed',
        properties: { url: 'about:blank', cacheDir: '.edgeview/demo-tab-b', profileName: 'demo-tab-b', inPrivate: true, enableDevTools: false } })
    ]
  };
}

function controlBase(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    content: '', x: 0, y: 0, width: 120, height: 32, fontSize: 12, fontFamily: 'Microsoft YaHei UI',
    fontBold: false, fontItalic: false, fontUnderline: false, background: 'transparent', foreground: '#F8FAFC',
    isEnabled: true, visibility: 'Visible', properties: {}, ...input
  };
  if (!result.designerType) delete result.designerType;
  return result;
}

function createModuleReadme(manifest: LingBuilderModuleManifest, groups: DemoGroup[], builtin: boolean): string {
  const commands = groups.flatMap(group => group.commands);
  const lines = [
    `# ${manifest.name}完整演示`, '',
    `- 模块 ID：\`${manifest.id}\``,
    `- 版本：\`${manifest.version}\``,
    `- 类型：${builtin ? 'LingBuilder 内置模块' : '外置/资产模块'}`,
    `- 命令数：${commands.length}`,
    `- 设计器控件数：${manifest.contributes?.designerControls?.length || 0}`,
    `- 分组数：${groups.length}`, '',
    '## 使用方式', '',
    '打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。', '',
    '每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。', '',
    '## 模块说明', '', manifest.description || '无额外说明。', ''
  ];
  if (manifest.id === 'lingbuilder.data.json') {
    lines.push(
      '## 本示例的三个选项卡', '',
      '| 选项卡 | 内容 |',
      '|---|---|',
      '| 解析与类型读取 | 解析嵌套对象，读取文本、整数、长整数、小数、逻辑、null 和数组元素，并展示兼容接口。 |',
      '| 创建各种 JSON 类型 | 创建 null、文本、整数、长整数、小数、逻辑、数组和对象，演示对象/数组操作、深度复制和释放。 |',
      '| Pointer、Patch 与 Schema | 使用 RFC 6901 Pointer 定位，RFC 6902/RFC 7396 原子更新，生成补丁并执行 Schema 核心校验。 |', '',
      '运行时默认处于安全预览状态；勾选“允许实际执行”后，点击当前选项卡按钮才会调用本地 JSON API。', ''
    );
  }
  lines.push('## 命令清单', '');
  if (commands.length === 0) {
    lines.push('该模块不公开 LCPP 命令，是由其它模块自动消费的 SDK/二进制资产载体。', '');
  } else {
    lines.push('| # | 命令 | 签名 | 返回 | 说明 |', '|---:|---|---|---|---|');
    commands.forEach((item, index) => lines.push(`| ${index + 1} | \`${escapeMarkdown(item.contribution.name)}\` | \`${escapeMarkdown(item.contribution.signature)}\` | ${escapeMarkdown(item.binding.returnType || 'void')} | ${escapeMarkdown(item.contribution.description)} |`));
    lines.push('');
  }
  return lines.join('\n');
}

function createCommandCatalog(manifest: LingBuilderModuleManifest, commands: Array<{ contribution: ModuleCommandContribution; binding: ModuleCommandBinding }>) {
  const controlFixtures = createControlReferenceFixtures(manifest);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    module: { id: manifest.id, name: manifest.name, version: manifest.version, description: manifest.description },
    commandCount: commands.length,
    commands: commands.map((item, index) => ({ index: index + 1, ...item.contribution, binding: item.binding, demoInvocation: createInvocation(item.binding, controlFixtures) }))
  };
}

function createControlReferenceFixtures(manifest: LingBuilderModuleManifest): ControlReferenceFixture[] {
  const fixtures = new Map<string, ControlReferenceFixture>();
  for (const binding of manifest.bindings?.commands || []) {
    for (const parameter of binding.parameters || []) {
      if (parameter.type !== 'controlRef') continue;
      const kind = parameter.controlKinds?.[0] || 'visual';
      const type = parameter.controlTypes?.[0] || (kind === 'resource' ? 'ImageList' : 'Label');
      const key = `${kind}-${safeIdentifier(type) || 'Any'}`;
      if (!fixtures.has(key)) fixtures.set(key, {
        key,
        kind,
        type,
        name: fixtureName(type, kind)
      });
    }
  }
  return [...fixtures.values()];
}

function selectControlReferenceFixture(
  parameter: ModuleCommandBindingParameter,
  fixtures: readonly ControlReferenceFixture[]
): ControlReferenceFixture {
  const allowedKinds = new Set(parameter.controlKinds?.length ? parameter.controlKinds : ['visual']);
  const allowedTypes = new Set(parameter.controlTypes || []);
  const matched = fixtures.find(fixture => allowedKinds.has(fixture.kind)
    && (allowedTypes.size === 0 || allowedTypes.has(fixture.type)));
  if (!matched) throw new Error(`无法为 controlRef 参数“${parameter.name}”生成兼容设计器对象。`);
  return matched;
}

function fixtureName(type: string, kind: ControlReferenceFixture['kind']): string {
  const safeType = safeIdentifier(type) || '对象';
  if (kind === 'resource') return `演示${safeType}资源`;
  if (type === 'Label') return '演示状态';
  if (type === 'CheckBox') return '允许实际执行';
  if (type === 'TabControl') return '命令分组选项卡';
  return `演示${safeType}控件`;
}

function isBuiltinDemoFixture(fixture: ControlReferenceFixture): boolean {
  return fixture.name === '演示状态'
    || fixture.name === '允许实际执行'
    || fixture.name === '命令分组选项卡';
}

function createControlReferenceResource(fixture: ControlReferenceFixture): Record<string, unknown> {
  const base = { id: `control-ref-${fixture.key}`, type: fixture.type, name: fixture.name };
  if (fixture.type === 'ImageList') return { ...base, imageWidth: 16, imageHeight: 16, images: [] };
  if (fixture.type === 'FileDialog') return {
    ...base,
    mode: 'open',
    title: '选择文件',
    filter: '所有文件|*.*',
    initialDirectory: '.',
    defaultFileName: '',
    allowMultiple: false,
    pickFolders: false,
    bindButtonId: '',
    dropTargetControlId: '',
    selectedFiles: [],
    events: {}
  };
  if (fixture.type === 'ContextMenu' || fixture.type === 'PopupMenu') return {
    ...base,
    items: [],
    bindControlId: '',
    lastCommandId: 0,
    events: {}
  };
  if (fixture.type === 'PropertySheet') return {
    ...base,
    title: '属性',
    pages: [{ id: 'page-1', title: '常规', content: '' }]
  };
  return base;
}

async function updateRootSolution(entries: DemoIndexEntry[], pruneMissingGeneratedProjects = true): Promise<void> {
  const solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as PortableSolution;
  solution.folders ||= [];
  if (!solution.folders.some(folder => folder.id === MODULE_DEMO_FOLDER_ID)) solution.folders.push({ id: MODULE_DEMO_FOLDER_ID, name: '模块完整演示' });
  const generatedIds = new Set(entries.map(entry => entry.projectId));
  if (pruneMissingGeneratedProjects) {
    solution.projects = solution.projects.filter(project => !project.id.startsWith(PROJECT_PREFIX) || generatedIds.has(project.id));
  }
  for (const entry of entries) {
    const project = {
      type: 'visual-cpp', id: entry.projectId, name: `${entry.moduleName}完整演示`,
      sourceRoot: entry.sourceRoot, configRoot: `examples/module-demos/${entry.moduleId}/config`,
      designerPath: `.lingbuilder/projects/${entry.projectId}/window-designer.json`, isDefault: false, references: [], solutionFolderId: MODULE_DEMO_FOLDER_ID
    };
    const index = solution.projects.findIndex(existing => existing.id === entry.projectId);
    if (index >= 0) solution.projects[index] = project;
    else solution.projects.push(project);
  }
  await fs.writeFile(solutionPath, JSON.stringify(solution, null, 2), 'utf8');
  const solutionEntryPath = path.join(workspaceRoot, `${solution.name}.lbsln`);
  await fs.writeFile(solutionEntryPath, JSON.stringify({
    schemaVersion: 1,
    kind: 'lingbuilder-solution',
    id: solution.id,
    name: solution.name,
    solutionFile: '.lingbuilder/solution.json',
    startupProjectId: solution.startupProjectId,
    startupProjectIds: solution.startupProjectIds,
    folders: solution.folders || [],
    projects: solution.projects.map(project => ({
      id: project.id,
      name: project.name,
      type: project.type,
      sourceRoot: project.sourceRoot,
      ...(project.projectFile ? { projectFile: project.projectFile } : {}),
      ...(project.solutionFolderId ? { solutionFolderId: project.solutionFolderId } : {}),
      references: project.references || []
    }))
  }, null, 2), 'utf8');
}

async function writeDemoIndex(entries: DemoIndexEntry[]): Promise<void> {
  const lines = [
    '# LingBuilder 全模块演示项目', '',
    `本目录由 \`npm run module:demos -w lingbuilder-electron\` 根据实际模块清单生成，共 ${entries.length} 个独立项目。`, '',
    '每个项目逐条覆盖目标模块全部 binding 命令；命令较多时使用 TabControl 分组。源码包输出到仓库根目录 `exports/`。', '',
    '| 模块 | 项目 | 命令 | 控件 | 分组 | 源码包 |', '|---|---|---:|---:|---:|---|'
  ];
  entries.forEach(entry => lines.push(`| \`${entry.moduleId}\` ${entry.moduleName} | \`${entry.projectId}\` | ${entry.commandCount} | ${entry.controlCount} | ${entry.groupCount} | \`${entry.packageName}\` |`));
  lines.push('');
  await fs.writeFile(path.join(demosRoot, 'README.md'), lines.join('\n'), 'utf8');
  await fs.writeFile(path.join(demosRoot, 'module-demo-index.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), modules: entries }, null, 2), 'utf8');
  await fs.writeFile(path.join(exportsRoot, 'module-demo-index.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), modules: entries }, null, 2), 'utf8');
}

async function verifyGeneratedDemos(modules: DemoModule[], requirePackages: boolean, contextModules: DemoModule[] = modules): Promise<DemoIndexEntry[]> {
  const entries: DemoIndexEntry[] = [];
  const packageService = requirePackages ? createLcppSourcePackageService(workspaceRoot) : undefined;
  const manifestsById = new Map(contextModules.map(module => [module.manifest.id, module]));
  for (const module of modules) {
    const manifest = module.manifest;
    const projectId = projectIdFor(manifest.id);
    const sourcePath = path.join(demosRoot, manifest.id, 'src', 'MainWindow.lcpp');
    const source = await fs.readFile(sourcePath, 'utf8');
    const commands = pairCommands(manifest);
    const missing = commands.filter(item => !source.includes(`// 命令ID：${item.contribution.name}\n`) || !source.includes(`${item.binding.command}(`));
    if (missing.length) throw new Error(`${manifest.id} 演示缺少命令：${missing.map(item => item.binding.command).join('、')}`);
    const parseErrors = parseLingCpp(source).diagnostics.filter(diagnostic => diagnostic.level === 'error');
    if (parseErrors.length) throw new Error(`${manifest.id} 演示源码结构错误：${parseErrors.slice(0, 5).map(item => `${item.line}:${item.message}`).join('；')}`);
    const designer = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json'), 'utf8'));
    if (designer.windows?.[0]?.controls?.filter((control: { type?: string }) => control.type === 'TabControl').length !== 1) throw new Error(`${manifest.id} 缺少唯一命令分组选项卡。`);
    const enabledIds = unique(['lingbuilder.win32.basic', ...(manifest.id === 'lingbuilder.new_emoji.ui' ? [] : ['lingbuilder.win32.common-controls']), manifest.id]);
    const enabledModules: InstalledModule[] = enabledIds.map(id => {
      const target = manifestsById.get(id);
      if (!target) throw new Error(`${manifest.id} 演示缺少模块上下文：${id}`);
      return {
        manifest: target.manifest,
        installPath: target.installPath || `builtin://${id}`,
        isBuiltin: target.builtin,
        isInstalled: true,
        isEnabledForProject: true,
        diagnostics: []
      };
    });
    const moduleContext: LingCppModuleContext = { enabledModules, availableModules: [], showAdvancedApi: true };
    const semanticErrors = getLingCppSemanticDiagnostics(source, designer, sourcePath, moduleContext).filter(diagnostic => diagnostic.level === 'error');
    if (semanticErrors.length) throw new Error(`${manifest.id} 演示源码语义错误：${semanticErrors.slice(0, 5).map(item => `${item.line}:${item.message}`).join('；')}`);
    const packageName = packageFileNameFor(manifest);
    let packageBytes: number | undefined;
    if (requirePackages) {
      const packagePath = path.join(exportsRoot, packageName);
      packageBytes = (await fs.stat(packagePath)).size;
      const preview = await packageService!.inspectPackage(packagePath);
      if (preview.manifest.startupProjectId !== projectId || preview.manifest.projects.length !== 1) {
        throw new Error(`${manifest.id} 源码包启动项目或项目数量错误。`);
      }
      if (!preview.manifest.modules.some(requirement => requirement.projectId === projectId && requirement.id === manifest.id)) {
        throw new Error(`${manifest.id} 源码包缺少目标模块引用。`);
      }
      if (!preview.manifest.files.some(file => file.path.endsWith('/MainWindow.lcpp') || file.path === 'src/MainWindow.lcpp')) {
        throw new Error(`${manifest.id} 源码包缺少 MainWindow.lcpp。`);
      }
      console.log(`已深度校验源码包：${manifest.id}`);
    }
    entries.push({ moduleId: manifest.id, moduleName: manifest.name, projectId, commandCount: commands.length, controlCount: manifest.contributes?.designerControls?.length || 0, groupCount: createGroups(commands).length, builtin: module.builtin, sourceRoot: path.relative(workspaceRoot, path.dirname(sourcePath)).replace(/\\/g, '/'), packageName, packageBytes });
  }
  return entries;
}

function projectIdFor(moduleId: string): string {
  return `${PROJECT_PREFIX}${moduleId}`.slice(0, 80);
}

function packageFileNameFor(manifest: LingBuilderModuleManifest): string {
  const preferredNames: Record<string, string> = {
    'lingbuilder.new_emoji.ui': '新表情原生界面库完整演示',
    'lingbuilder.cef3.sdk': 'CEF3内核SDK包（64位）完整演示',
    'lingbuilder.fbro.sdk': 'FBro135内置SDK（64位）完整演示',
    'lingbuilder.crypto.sdk': 'LingBuilder密码学SDK完整演示'
  };
  const baseName = preferredNames[manifest.id] || `${manifest.name.replace(/\s+/gu, '')}完整演示`;
  return `${baseName.replace(/[<>:"/\\|?*]/gu, '').replace(/[. ]+$/gu, '')}.lcpppkg`;
}

function versionFor(id: string, target: LingBuilderModuleManifest): string {
  if (id === target.id) return target.version;
  return BUILTIN_MODULES.find(module => module.id === id)?.version || '1.0.0';
}

function groupRange(group: DemoGroup, allGroups: DemoGroup[]): string {
  if (!group.commands.length) return '资产模块说明（无可调用命令）';
  const start = allGroups.slice(0, group.index - 1).reduce((sum, item) => sum + item.commands.length, 0) + 1;
  const end = start + group.commands.length - 1;
  return `命令 ${start}–${end}：${group.commands[0]!.contribution.name} 至 ${group.commands.at(-1)!.contribution.name}`;
}

function describeParameters(parameters: ModuleCommandBindingParameter[] | undefined): string {
  return parameters?.length ? parameters.map(parameter => `${parameter.name}:${parameter.type}`).join('，') : '无';
}

function safeIdentifier(value: string): string {
  return value.replace(/[^\p{L}\p{N}_]/gu, '');
}

function sanitizeComment(value: string | undefined): string {
  return String(value || '无').replace(/[\r\n]+/gu, ' ').replace(/\/\*/gu, '/ *').replace(/\*\//gu, '* /');
}

function escapeLcppString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
}

function escapeMarkdown(value: string | undefined): string {
  return String(value || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach(value => seen.has(value) ? duplicates.add(value) : seen.add(value));
  return [...duplicates];
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

await main();
