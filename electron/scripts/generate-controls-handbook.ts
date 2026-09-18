/**
 * 生成官网「基础与高级控件使用手册」（/controls，kind=CONTROL）的全部文章。
 *
 * 数据来源只有两处，保证文档与实现一致：
 * 1. src/services/windowDesigner/win32ControlRegistry.ts —— 控件属性、事件、原生类。
 * 2. src/services/modules/builtinModules.ts —— 模块清单里的中文命令（含专属命令族）。
 *
 * 输出：
 * - .deploy/controls-handbook/articles.json  全部文章的结构化数据
 * - .deploy/controls-handbook/articles.sql   生产库幂等 upsert SQL（WebsiteGuideArticle）
 *
 * 渲染约束：官网 MarkdownText 只支持 `# `/`## ` 标题、`- `/`N. ` 列表、围栏代码块和
 * 行内反引号；不支持表格、加粗、链接与三级标题，本脚本的输出必须遵守（validateArticle 把关）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWin32ControlsForModule,
  getWin32RuntimeControlContract,
  WIN32_CONTROL_DEFINITIONS,
} from '../src/services/windowDesigner/win32ControlRegistry';
import type { Win32ControlDefinition, Win32ControlModuleId, Win32ControlPropertyDefinition } from '../src/services/windowDesigner/win32ControlRegistry';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

const OUT_DIR = fileURLToPath(new URL('../../.deploy/controls-handbook/', import.meta.url));

interface HandbookArticle {
  slug: string;
  title: string;
  summary: string;
  category: string;
  kind: 'CONTROL';
  tags: string[];
  sortOrder: number;
  bodyMarkdown: string;
}

const MODULE_DISPLAY: Record<string, { name: string; tag: string }> = {
  'lingbuilder.win32.basic': { name: 'Win32窗口基础模块', tag: 'Win32 基础控件' },
  'lingbuilder.win32.common-controls': { name: 'Win32高级控件模块', tag: 'Win32 高级控件' },
  'lingbuilder.edgeview': { name: 'EdgeView 浏览器模块', tag: '浏览器控件' },
  'lingbuilder.cef3.browser': { name: 'CEF3浏览器模块', tag: '浏览器控件' },
  'lingbuilder.fbro.browser': { name: 'FBro指纹浏览器模块', tag: '浏览器控件' },
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  text: '文本', hotkey: '热键', number: '数字', boolean: '开关', enum: '枚举', color: '颜色',
  file: '文件', stringList: '文本列表', columns: '列集合', dataGridColumns: '列配置',
  dataGridRows: '数据行', treeNodes: '节点集合', tabs: '标签页', date: '日期',
  controlRef: '控件引用', recordList: '记录列表',
};

/** 控件专属命令族前缀 → 设计器控件类型，与模块清单中的命令命名一一对应。 */
const FAMILY_PREFIXES: Array<{ prefix: string; types: string[] }> = [
  { prefix: '颜色选择器_', types: ['ColorPicker'] },
  { prefix: '列表视图_', types: ['ListView'] },
  { prefix: '表格_', types: ['DataGrid'] },
  { prefix: '树形框_', types: ['TreeView'] },
  { prefix: '选项卡_', types: ['TabControl'] },
  { prefix: '视频播放器_', types: ['VideoPlayer'] },
  { prefix: '文件对话框_', types: ['FileDialog'] },
  { prefix: '上下文菜单_', types: ['ContextMenu'] },
  { prefix: '弹出菜单_', types: ['PopupMenu'] },
  { prefix: '属性页_', types: ['PropertySheet'] },
  { prefix: '工具栏_', types: ['ToolBar'] },
  { prefix: '状态栏_', types: ['StatusBar'] },
];

/** 通用命令适用面，取自模块清单中各命令描述文字里点名的控件。 */
const GENERIC_APPLICABILITY: Array<{ command: string; types: string[] }> = [
  { command: '控件_设置勾选', types: ['CheckBox', 'RadioButton'] },
  { command: '控件_取勾选', types: ['CheckBox', 'RadioButton'] },
  { command: '控件_设置数值', types: ['ScrollBar', 'ProgressBar', 'TrackBar', 'UpDown', 'FlatScrollBar'] },
  { command: '控件_取数值', types: ['ScrollBar', 'ProgressBar', 'TrackBar', 'UpDown', 'FlatScrollBar'] },
  { command: '控件_设置选择项', types: ['ListBox', 'ComboBox', 'ComboBoxEx', 'ListView', 'TabControl'] },
  { command: '控件_取选择项', types: ['ListBox', 'ComboBox', 'ComboBoxEx', 'ListView', 'TabControl'] },
  { command: '控件_添加项目', types: ['ListBox', 'ComboBox', 'ComboBoxEx'] },
  { command: '控件_清空项目', types: ['ListBox', 'ComboBox', 'ComboBoxEx'] },
  { command: '控件_设置图片', types: ['Image'] },
];

const isNonVisual = (definition: Win32ControlDefinition) => definition.isVisual === false;
const chineseName = (definition: Win32ControlDefinition) =>
  getWin32RuntimeControlContract(definition)?.lingCppType ?? definition.label.split('/')[0];
const instanceName = (definition: Win32ControlDefinition) => `${chineseName(definition)}1`;
const moduleManifest = (moduleId: string) => BUILTIN_MODULES.find(manifest => manifest.id === moduleId);
const designerTypeToName = new Map(WIN32_CONTROL_DEFINITIONS.map(definition => [definition.type, `${chineseName(definition)}（${definition.type}）`]));
const friendlyControlTypes = (types: string[]) => types.map(type => designerTypeToName.get(type.includes('/') ? type.split('/')[1] : type) ?? type).join('、');

function formatDefaultValue(property: Win32ControlPropertyDefinition): string {
  const value = property.defaultValue;
  if (typeof value === 'boolean') return value ? '真' : '假';
  if (typeof value === 'number') return String(value);
  if (property.type === 'enum' && typeof value === 'string') {
    const matched = property.options?.find(item => item.value === value);
    return matched ? `「${matched.label}」` : `「${value}」`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '空';
    if (property.key === 'tabs') return `${value.length} 个标签页`;
    const titles = value.map(item => String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).id ?? '')).filter(Boolean);
    return titles.length ? `默认含 ${titles.join('、')}` : `${value.length} 项`;
  }
  if (typeof value === 'string') return value ? `「${value}」` : '空';
  return '空';
}

function describeControlRef(property: Win32ControlPropertyDefinition): string {
  const parts: string[] = [];
  if (property.controlKinds?.length) {
    parts.push(property.controlKinds.map(kind => kind === 'visual' ? '可视控件' : kind === 'resource' ? '设计器资源' : '非可视组件').join(' / '));
  }
  if (property.controlTypes?.length) parts.push(`只允许引用 ${friendlyControlTypes(property.controlTypes)}`);
  if (property.scope === 'currentWindow') parts.push('作用域为当前窗口');
  if (property.scope === 'project') parts.push('作用域为整个项目');
  const detail = parts.length ? `（${parts.join('；')}）` : '';
  return `${property.label}${detail}：填写控件名时不加引号。`;
}

function propertyLine(property: Win32ControlPropertyDefinition): string {
  if (property.type === 'controlRef') return `- \`${property.key}\`（控件引用）：${describeControlRef(property)}`;
  const bits = [PROPERTY_TYPE_LABELS[property.type] ?? property.type, `默认 ${formatDefaultValue(property)}`];
  if (property.type === 'number' && property.min !== undefined) {
    bits.push(property.max !== undefined ? `范围 ${property.min}～${property.max}` : `最小 ${property.min}`);
  }
  let line = `- \`${property.key}\`（${bits.join('，')}）`;
  if (property.options?.length) line += `：可选 ${property.options.map(item => item.label).join(' / ')}。`;
  else line += `：${property.label}。`;
  if (property.description) line += `${property.description}`;
  return line;
}

function eventLines(definition: Win32ControlDefinition): string[] {
  const name = instanceName(definition);
  const primary = primaryEvent(definition);
  return definition.events.map(item => {
    const marker = item === primary ? '（主事件）' : '';
    return `- \`${item.label}\`${marker}：处理器命名为 \`${name}_${item.handlerSuffix}\`。`;
  });
}

function bindNote(definition: Win32ControlDefinition): string {
  const contract = getWin32RuntimeControlContract(definition);
  if (contract && definition.events.length) {
    const first = definition.events[0];
    return `以上事件均可在事件面板里创建处理器；代码中也可以用 \`${contract.lingCppType}_绑定${first.label}(控件, &处理器名)\` 动态绑定，用 \`${contract.lingCppType}_解绑${first.label}(控件)\` 解绑，处理器名必须带 \`&\`。`;
  }
  if (definition.events.length) {
    return `以上事件在事件面板里创建处理器后，由原生运行时在事件触发时调用对应 \`.子程序\`。`;
  }
  return `本控件没有公开事件；如需交互，直接在其它事件处理器里用命令读写它的属性。`;
}

function creationSection(definition: Win32ControlDefinition): string[] {
  const contract = getWin32RuntimeControlContract(definition);
  if (!contract) return [];
  const ref = contract.createCommand === '控件_创建按钮' ? '动态按钮' : '动态控件';
  const lines = [
    '',
    '## 代码创建与查找',
    '',
    '除了从工具箱拖入，也可以在 `.lcpp` 里用中文命令在运行时创建：',
    '',
    '```lcpp',
    `局部 ${contract.lingCppType} ${ref} = ${contract.createCommand}(当前窗口, 20, 20, ${definition.defaultProps.width}, ${definition.defaultProps.height}, "${definition.defaultProps.content || contract.lingCppType}", "${chineseName(definition)}", 1001)`,
    `如果 (控件_是否有效(${ref}))`,
    `    调试输出("创建成功")`,
    '如果结束',
    `局部 ${contract.lingCppType} 按标记查找 = 通过标记文本获取${contract.lingCppType}("${chineseName(definition)}")`,
    '```',
    '',
    '创建签名统一为「父级、横坐标、纵坐标、宽度、高度、文本、可选标记文本、可选标记整数」，父级可以使用 `当前窗口` 或容器控件。标记用于此后按标记查找；重复标记会返回无效引用并输出中文运行日志。代码创建的控件只存在于本次运行时，不会写回设计器。',
  ];
  return lines;
}

function primaryEvent(definition: Win32ControlDefinition) {
  const browser = definition.moduleId !== 'lingbuilder.win32.basic' && definition.moduleId !== 'lingbuilder.win32.common-controls';
  if (!browser) return definition.events[0];
  // 浏览器控件的事件目录很大，示例优先挑「浏览器创建完成 / 首次导航」这类入门事件。
  return definition.events.find(item => item.handlerSuffix === '浏览器创建完成')
    ?? definition.events.find(item => /导航|加载完成/.test(item.label))
    ?? definition.events[0];
}

function exampleSection(definition: Win32ControlDefinition): string[] {
  const name = instanceName(definition);
  const type = definition.type;
  const lines: string[] = ['', '## 使用示例', ''];
  const primary = primaryEvent(definition);
  const family = familyCommands(definition);
  if (!primary) {
    // 没有公开事件的控件（含非可视资源）改为演示第一个专属命令；两者都没有就不出示例章节。
    if (!family.length) return [];
    const call = family[0].signature.split('(')[0];
    lines.push('```lcpp', `${call}(${name})`, '```', '');
    return lines;
  }
  lines.push('```lcpp', `.子程序 ${name}_${primary.handlerSuffix}`);
  if (type === 'TextBox' || type === 'RichEdit') lines.push(`    调试输出("当前内容：", 控件_取文本(${name}))`);
  else if (GENERIC_APPLICABILITY.some(item => item.command === '控件_取勾选' && item.types.includes(type))) lines.push(`    如果 (控件_取勾选(${name}))`, `        调试输出("已选中")`, '    如果结束');
  else if (GENERIC_APPLICABILITY.some(item => item.command === '控件_取选择项' && item.types.includes(type))) lines.push(`    调试输出("当前选择项索引：", 控件_取选择项(${name}))`);
  else if (GENERIC_APPLICABILITY.some(item => item.command === '控件_取数值' && item.types.includes(type))) lines.push(`    调试输出("当前数值：", 控件_取数值(${name}))`);
  else lines.push(`    调试输出("${chineseName(definition)}事件触发")`);
  lines.push('结束', '```', '');
  return lines;
}

function familyCommands(definition: Win32ControlDefinition): Array<{ name: string; signature: string; description: string }> {
  const manifest = moduleManifest(definition.moduleId);
  const commands = manifest?.contributes?.commands ?? [];
  const matched = FAMILY_PREFIXES
    .filter(family => family.types.includes(definition.type))
    .flatMap(family => commands.filter(command => command.name.startsWith(family.prefix)));
  if (definition.type === 'ContextMenu' || definition.type === 'PopupMenu') {
    const shared = commands.find(command => command.name === '菜单_取最后项目');
    if (shared && !matched.includes(shared)) matched.push(shared);
  }
  return matched.map(command => ({ name: command.name, signature: command.signature, description: command.description }));
}

function browserCommandSection(definition: Win32ControlDefinition): string[] {
  const manifest = moduleManifest(definition.moduleId);
  const commands = (manifest?.contributes?.commands ?? []) as Array<{ name: string; signature: string; description: string; visibility?: string }>;
  const advanced = commands.filter(command => command.visibility === 'advanced').length;
  let list: Array<{ name: string; signature: string; description: string }>;
  if (definition.type === 'EdgeBrowser') {
    list = commands.filter(command => !command.visibility && command.name.includes('控件'))
      .map(command => ({ name: command.name, signature: command.signature, description: command.description }));
  } else if (definition.type === 'CefBrowser') {
    list = commands.filter(command => !command.visibility)
      .map(command => ({ name: command.name, signature: command.signature, description: command.description }));
  } else {
    list = commands.filter(command => !command.visibility && command.name.startsWith('FBro_'))
      .map(command => ({ name: command.name, signature: command.signature, description: command.description }));
  }
  if (!list.length) return [];
  const lines = ['', '## 常用命令', '', `本模块共有 ${commands.length} 条中文命令${advanced ? `，其中 ${advanced} 条高级命令` : ''}；以下列出与设计器控件配合使用的常用命令，完整清单见 IDE「模块」页的本模块文档与命令补全。`, ''];
  for (const command of list) lines.push(`- \`${command.signature}\`：${command.description}`);
  return lines;
}

function validateArticle(article: HandbookArticle): void {
  let inCode = false;
  for (const line of article.bodyMarkdown.split('\n')) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (line.startsWith('###')) throw new Error(`三级标题不支持: ${article.slug}: ${line}`);
    if (line.startsWith('#') && !line.startsWith('# ') && !line.startsWith('## ')) throw new Error(`非法标题: ${article.slug}: ${line}`);
    if (line.trimStart().startsWith('|')) throw new Error(`表格不支持: ${article.slug}: ${line}`);
    if (line.includes('**')) throw new Error(`加粗不支持: ${article.slug}: ${line}`);
    if (line.includes('](')) throw new Error(`链接不支持: ${article.slug}: ${line}`);
    if (line.trim() === '---') throw new Error(`分隔线不支持: ${article.slug}`);
  }
  if (inCode) throw new Error(`代码块未闭合: ${article.slug}`);
}

function controlArticle(definition: Win32ControlDefinition, sortOrder: number): HandbookArticle {
  const name = chineseName(definition);
  const display = MODULE_DISPLAY[definition.moduleId];
  const slug = `control-${definition.type.toLowerCase()}`;
  const nonVisual = isNonVisual(definition);
  const title = `${name}（${definition.type}）`;
  const summary = nonVisual
    ? `非可视设计器资源：${definition.label}的属性、事件与中文命令用法。`
    : `${name}控件的设计器属性、事件绑定、中文命令与原生运行结果。`;
  const tags = [display.tag, '设计器', '中文命令'];

  const lines: string[] = [];
  lines.push(`# ${title}`, '');
  if (nonVisual) {
    lines.push(`${name}是 \`${display.name}\` 提供的非可视设计器资源，不占用窗口布局；拖入设计器后出现在组件区，在代码里用控件名（不加引号）引用。`, '');
  } else {
    lines.push(`${name}由 \`${display.name}\`（\`${definition.moduleId}\`）提供，对应 Win32 原生控件类 \`${definition.nativeClass}\`，工具箱分类「${definition.category}」。`, '');
  }

  lines.push('## 设计器属性', '');
  lines.push(`把控件${nonVisual ? '拖入设计器' : '从工具箱拖入窗口'}后，可在属性面板修改以下属性（格式：\`键\`（类型，默认值））：`, '');
  if (!(definition.defaultProps.width === 0 && definition.defaultProps.height === 0)) {
    lines.push(`- 默认大小：${definition.defaultProps.width} × ${definition.defaultProps.height} 像素。`);
  }
  if (definition.defaultProps.content) lines.push(`- 初始内容：「${definition.defaultProps.content}」。`);
  for (const property of definition.properties) lines.push(propertyLine(property));
  if (definition.requiredLibraries?.length) lines.push(`- 附加链接库：${definition.requiredLibraries.join('、')}（由构建自动处理）。`);

  lines.push('', '## 事件', '');
  if (definition.events.length) {
    lines.push(...eventLines(definition), '', bindNote(definition));
  } else {
    lines.push('本控件没有公开事件。');
  }

  lines.push(...creationSection(definition));
  lines.push(...exampleSection(definition));

  const family = familyCommands(definition);
  if (family.length) {
    lines.push('', '## 专属命令', '', '除通用控件命令外，本控件还有以下专属中文命令：', '');
    for (const command of family) lines.push(`- \`${command.signature}\`：${command.description}`);
  }
  if (definition.moduleId !== 'lingbuilder.win32.basic' && definition.moduleId !== 'lingbuilder.win32.common-controls') {
    lines.push(...browserCommandSection(definition));
  } else {
    lines.push('', '通用控件命令（`控件_设置文本`、`控件_取文本`、`控件_设置可见` 等）的完整说明见《基础控件使用手册》。');
  }

  const article: HandbookArticle = { slug, title, summary, category: display.tag, kind: 'CONTROL', tags, sortOrder, bodyMarkdown: lines.join('\n') };
  validateArticle(article);
  return article;
}

function overviewIndex(entries: Win32ControlDefinition[]): string[] {
  return entries.map((definition, index) => `${index + 1}. ${chineseName(definition)}（${definition.type}）${definition.label !== chineseName(definition) && !definition.label.startsWith(chineseName(definition)) ? `，设计器名「${definition.label}」` : ''}：工具箱分类「${definition.category}」。`);
}

function basicOverview(sortOrder: number): HandbookArticle {
  const controls = getWin32ControlsForModule('lingbuilder.win32.basic');
  const manifest = moduleManifest('lingbuilder.win32.basic');
  const commands = manifest?.contributes?.commands ?? [];
  const generic = commands.filter(command => command.name.startsWith('控件_'));
  const windowCommands = commands.filter(command => command.name.startsWith('窗口_'));

  const lines: string[] = [];
  lines.push(
    '# 基础控件',
    '',
    '基础控件由 `lingbuilder.win32.basic`（Win32窗口基础模块）提供，共 12 个可视控件，全部对应真实 Win32 原生控件，F5 构建、原生预览与 Visual Studio 导出使用同一套生成与注册逻辑。每个控件实例都拥有独立的主窗口句柄，窗口销毁后引用自动失效。',
    '',
    '## 控件目录',
    '',
    ...overviewIndex(controls),
    '',
    `另有 1 个旧项目兼容容器「Grid（网格容器）」，仅用于打开历史项目，不在工具箱与运行时创建目录中。`,
    '',
    '## 设计器用法',
    '',
    '把控件从工具箱拖入窗口后，在属性面板修改名称、文本、位置和状态；在事件面板双击事件即可创建处理器，IDE 会生成对应的 `.子程序`。运行行为以中文代码编辑器中的事件代码为准：',
    '',
    '```lcpp',
    '.子程序 开始按钮_被单击',
    '    信息框("你好，LingBuilder！", 64, "提示")',
    '结束',
    '```',
    '',
    '## 运行时创建与查找',
    '',
    '每种控件都提供「创建 + 两种标记查找」三条运行时命令，签名统一为「父级、横坐标、纵坐标、宽度、高度、文本、可选标记文本、可选标记整数」：',
    '',
    '```lcpp',
    '局部 按钮 动态按钮 = 控件_创建按钮(当前窗口, 20, 20, 120, 36, "确定", "确认", 1002)',
    '局部 按钮 文本查找 = 通过标记文本获取按钮("确认")',
    '局部 编辑框 整数查找 = 通过标记整数获取编辑框(1001)',
    '如果 (控件_是否有效(动态按钮))',
    '    控件_设置启用(动态按钮, 真)',
    '    按钮_绑定被单击(动态按钮, &动态按钮被单击)',
    '如果结束',
    '```',
    '',
    '操作查找结果前可先调用 `控件_是否有效`；无效引用上的操作安全失败，不会访问悬空句柄。控件引用可作局部变量、方法参数和返回值，但不能作为常量、数组或跨线程传递。',
    '',
    '## 通用控件命令',
    '',
    '以下命令对所有控件通用，第一个参数填写控件名（不加引号）或类型化控件引用：',
    '',
    ...generic.map(command => `- \`${command.signature}\`：${command.description}`),
    '',
    '## 窗口命令',
    '',
    '窗口层命令用于读取事件附带的上下文和控制窗口行为：',
    '',
    ...windowCommands.map(command => `- \`${command.signature}\`：${command.description}`),
    '',
    '## 平台说明',
    '',
    '当前支持 Windows（MSVC，Win32 / x64），链接 `comctl32.lib`。本模块的所有可视控件遵守「一控件实例一个独立主 HWND」规则，即使控件初始隐藏也会创建真实句柄。',
  );
  const article: HandbookArticle = {
    slug: 'basic-controls', title: '基础控件使用手册', category: '基础控件', kind: 'CONTROL',
    summary: '窗口、按钮、标签、编辑框等基础 Win32 控件的设计器与中文代码用法。',
    tags: ['Win32 基础控件', '设计器', '中文命令'], sortOrder, bodyMarkdown: lines.join('\n'),
  };
  validateArticle(article);
  return article;
}

function advancedOverview(sortOrder: number): HandbookArticle {
  const controls = getWin32ControlsForModule('lingbuilder.win32.common-controls');
  const visual = controls.filter(definition => !isNonVisual(definition));
  const nonVisual = controls.filter(isNonVisual);
  const manifest = moduleManifest('lingbuilder.win32.common-controls');
  const commands = manifest?.contributes?.commands ?? [];
  const runtime = commands.filter(command => command.name.startsWith('控件_创建') || command.name.startsWith('通过标记'));
  const dialogs = commands.filter(command => ['打开文件', '保存文件', '选择文件夹', '选择颜色', '选择字体', '查找文本', '替换文本', '打印', '打印文本', '页面设置', '任务对话框', '系统对话框_状态'].includes(command.name) || command.name.startsWith('查找替换_') || command.name.startsWith('页面设置_'));
  const families = commands.filter(command =>
    (FAMILY_PREFIXES.some(family => command.name.startsWith(family.prefix)) || command.name === '菜单_取最后项目')
    && !/_(绑定|解绑)/.test(command.name));

  const lines: string[] = [];
  lines.push(
    '# 高级控件',
    '',
    '高级控件由 `lingbuilder.win32.common-controls`（Win32高级控件模块）提供，包含 ' + `${visual.length} 个可视控件和 ${nonVisual.length} 个非可视资源，对应 Windows 通用控件（Common Controls）、系统对话框与 Media Foundation 媒体能力。`,
    '',
    '## 可视控件目录',
    '',
    ...overviewIndex(visual),
    '',
    '## 非可视资源目录',
    '',
    ...nonVisual.map((definition, index) => `${index + 1}. ${chineseName(definition)}（${definition.type}）：${definition.label}，拖入后出现在组件区，不占窗口布局。`),
    '',
    `另有 Rebar、Pager 2 个旧项目兼容容器（Rebar 容器、分页容器），仅用于打开历史项目。`,
    '',
    '## 设计器用法',
    '',
    '可视控件拖入窗口后在属性面板配置，在事件面板创建处理器；非可视资源拖入后通过「打开控件」「右键目标」等属性绑定到窗口里的按钮或控件。运行行为以中文代码编辑器中的事件代码为准。',
    '',
    '## 运行时创建与查找',
    '',
    '全部可视控件同样支持「创建 + 两种标记查找」运行时命令，例如：',
    '',
    '```lcpp',
    '局部 列表视图 动态列表 = 控件_创建列表视图(当前窗口, 20, 20, 320, 180, "", "动态列表", 2001)',
    '局部 列表视图 按标记查找 = 通过标记文本获取列表视图("动态列表")',
    '```',
    '',
    '运行时创建命令共 ' + `${runtime.length} 条，签名与基础控件一致；非可视资源不走创建命令，直接按控件名引用。`,
    '',
    '## 系统对话框命令',
    '',
    '本模块内置一组与文件、颜色、字体、打印相关的系统对话框命令：',
    '',
    ...dialogs.map(command => `- \`${command.signature}\`：${command.description}`),
    '',
    '## 控件专属命令族',
    '',
    '集合类控件各有自己的专属命令族（完整签名见对应控件文章）：',
    '',
    ...families.map(command => `- \`${command.signature}\`：${command.description}`),
    '',
    '## 平台说明',
    '',
    '当前支持 Windows（MSVC，Win32 / x64），链接 `comctl32.lib`、`comdlg32.lib`、`ole32.lib`、`shell32.lib`、`shlwapi.lib`、`mfplat.lib`、`mfplay.lib`、`mfuuid.lib`。媒体控件（动画控件、视频播放器）基于 Media Foundation，浏览器类控件（EdgeView、CEF3、FBro）见浏览器控件文章。',
  );
  const article: HandbookArticle = {
    slug: 'advanced-controls', title: '高级控件使用手册', category: '高级控件', kind: 'CONTROL',
    summary: '列表视图、树形框、数据表格、系统对话框和媒体控件的使用说明。',
    tags: ['Win32 高级控件', '设计器', '中文命令'], sortOrder, bodyMarkdown: lines.join('\n'),
  };
  validateArticle(article);
  return article;
}

function main(): void {
  const articles: HandbookArticle[] = [];
  articles.push(basicOverview(10));
  getWin32ControlsForModule('lingbuilder.win32.basic').forEach((definition, index) => articles.push(controlArticle(definition, 11 + index)));
  articles.push(advancedOverview(30));
  getWin32ControlsForModule('lingbuilder.win32.common-controls').forEach((definition, index) => articles.push(controlArticle(definition, 31 + index)));
  const browserModuleIds = ['lingbuilder.edgeview', 'lingbuilder.cef3.browser', 'lingbuilder.fbro.browser'] as const;
  let browserSort = 57;
  for (const moduleId of browserModuleIds) {
    for (const definition of getWin32ControlsForModule(moduleId as Win32ControlModuleId)) {
      articles.push(controlArticle(definition, browserSort));
      browserSort += 1;
    }
  }

  const slugs = new Set<string>();
  for (const article of articles) {
    if (slugs.has(article.slug)) throw new Error(`slug 重复: ${article.slug}`);
    slugs.add(article.slug);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'articles.json'), JSON.stringify(articles, null, 2), 'utf8');

  const sqlValue = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const sql = [
    '-- 官网「基础与高级控件使用手册」全量 upsert（幂等，按 slug）',
    'BEGIN;',
    ...articles.map(article => {
      const tags = `ARRAY[${article.tags.map(tag => sqlValue(tag)).join(',')}]::text[]`;
      const values = `(gen_random_uuid()::text, ${sqlValue(article.slug)}, ${sqlValue(article.title)}, ${sqlValue(article.summary)}, 'CONTROL', ${sqlValue(article.category)}, ${sqlValue(article.bodyMarkdown)}, '', ${tags}, '', 'PUBLISHED', ${article.sortOrder}, now(), now())`;
      return `INSERT INTO "WebsiteGuideArticle" ("id","slug","title","summary","kind","category","bodyMarkdown","coverImageUrl","tags","minimumVersion","publicationStatus","sortOrder","createdAt","updatedAt")\nVALUES ${values}\nON CONFLICT ("slug") DO UPDATE SET "title"=EXCLUDED."title", "summary"=EXCLUDED."summary", "kind"=EXCLUDED."kind", "category"=EXCLUDED."category", "bodyMarkdown"=EXCLUDED."bodyMarkdown", "tags"=EXCLUDED."tags", "publicationStatus"=EXCLUDED."publicationStatus", "sortOrder"=EXCLUDED."sortOrder", "updatedAt"=now();`;
    }),
    'COMMIT;',
  ].join('\n\n');
  writeFileSync(join(OUT_DIR, 'articles.sql'), sql + '\n', 'utf8');

  console.log(`生成 ${articles.length} 篇文章：`);
  for (const article of articles) {
    console.log(`  ${String(article.sortOrder).padStart(3)}  ${article.slug.padEnd(24)} ${article.title}  (${article.bodyMarkdown.length} 字符)`);
  }
}

main();
