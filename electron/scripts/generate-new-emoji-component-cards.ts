/**
 * 从 new_emoji 模块清单确定性生成 93 张组件卡（docs/components/<slug>.md）。
 *
 * 清单是客观契约（属性/事件/代码创建命令）的唯一来源；人工只维护
 * docs/modules/new-emoji/component-cards/<Type>.md 里的「惯用要点与红线」段，
 * 由本脚本拼进卡片，避免整份文档手写在清单之外腐烂。
 *
 * 用法：
 *   npm run module:new-emoji-cards                       # 写进已安装模块目录
 *   npm run module:new-emoji-cards -- --out <模块根目录>  # 打包期写进待打包目录
 *   npm run module:new-emoji-cards -- --check            # 只校验不写盘
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const MODULE_ID = 'lingbuilder.new_emoji.ui';
const CARD_DIR_NAME = 'lingbuilder-components';
const NATIVE_DOC_DIR_NAME = 'components';
const CARD_INDEX_README = 'README.md';
const PENDING_MARK = '待补';
const COMMANDS_PER_CARD = 40;

interface DesignerEvent {
  name: string;
  label: string;
  handlerPattern: string;
  parameters?: Array<{ name: string; type: string; description?: string }>;
}

interface DesignerControl {
  type: string;
  namespacedType?: string;
  label: string;
  category?: string;
  backend?: string;
  previewType?: string;
  isContainer?: boolean;
  isVisual?: boolean;
  nativeAdapter?: string;
  layout?: { mode?: string; coordinateSpace?: string; adapterId?: string; slots?: string[]; capacity?: number; acceptedDesignerTypes?: string[] };
  defaultProps?: Record<string, unknown>;
  properties?: Array<{
    key: string;
    label: string;
    type: string;
    defaultValue?: unknown;
    options?: Array<{ value: string; label: string }>;
    description?: string;
    group?: string;
    level?: string;
  }>;
  events?: DesignerEvent[];
  runtimeControl?: {
    lingCppType: string;
    createCommand: string;
    createParameters?: Array<{ name: string; type: string; role?: string; optional?: boolean; defaultValue?: unknown }>;
    lookupByTagTextCommand?: string;
    lookupByTagIntegerCommand?: string;
    validCommand?: string;
    parentKinds?: string[];
  };
}

interface ModuleCommand {
  name: string;
  signature: string;
  description?: string;
  returnType?: string;
  visibility?: string | null;
}

interface ModuleManifest {
  id: string;
  version: string;
  contributes?: {
    commands?: ModuleCommand[];
    designerControls?: DesignerControl[];
  };
}

const EVENT_PARAMETER_TYPES: Record<string, string> = {
  int: '整数型',
  integer: '整数型',
  long: '长整数型',
  int64: '长整数型',
  float: '小数型',
  double: '双精度小数型',
  bool: '逻辑型',
  boolean: '逻辑型',
  wideString: '文本型',
  utf8String: '文本型',
  string: '文本型',
  text: '文本型'
};

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPosix(value: string): string {
  return value.replace(/\\/gu, '/');
}

/** catalog 提供权威 slug 映射（documentation 字段），缺省时按 type 推导。 */
function loadDocumentationSlugs(moduleRoot: string, controls: DesignerControl[]): Map<string, string> {
  const slugs = new Map<string, string>();
  const catalogPath = path.join(moduleRoot, 'docs', 'lingbuilder-designer-catalog.json');
  if (fs.existsSync(catalogPath)) {
    try {
      const catalog = readJson(catalogPath) as { components?: Array<{ id?: string; documentation?: string }> };
      for (const component of catalog.components || []) {
        if (component.id && component.documentation) slugs.set(component.id, toPosix(component.documentation).split('/').pop() || '');
      }
    } catch {
      // 目录损坏时回退到 type 推导，仍能让卡片可寻址。
    }
  }
  for (const control of controls) {
    if (!slugs.has(control.type)) slugs.set(control.type, `${kebab(control.type)}.md`);
  }
  return slugs;
}

function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
}

function renderValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? '真' : '假';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function skeletonLines(control: DesignerControl, commands: ModuleCommand[]): string[] {
  const runtime = control.runtimeControl;
  if (!runtime) return [];
  const parameters = runtime.createParameters || [];
  const defaults = control.defaultProps || {};
  const byRole: Record<string, string> = {
    parent: '当前窗口',
    x: renderValue(defaults.x ?? 20) || '20',
    y: renderValue(defaults.y ?? 20) || '20',
    width: renderValue(defaults.width ?? 200) || '200',
    height: renderValue(defaults.height ?? 40) || '40'
  };
  const argumentList: string[] = [];
  for (const parameter of parameters) {
    if (parameter.optional) continue;
    const role = parameter.role || '';
    if (byRole[role]) {
      argumentList.push(byRole[role]);
      continue;
    }
    if (role === 'content' || parameter.type === 'wideString' || parameter.type === 'utf8String') {
      argumentList.push(`"${renderValue(defaults.content) || control.label.split(' ')[0]}"`);
      continue;
    }
    if (parameter.type === 'bool' || parameter.type === 'boolean') {
      argumentList.push('真');
      continue;
    }
    argumentList.push('0');
  }
  const variable = `${runtime.lingCppType.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/gu, '') || '控件'}示例`;
  argumentList.push(`"${variable}标记"`, '1');
  const lines = [`局部 ${runtime.lingCppType} ${variable} = ${runtime.createCommand}(${argumentList.join(', ')})`];
  const bindCommand = commands.find(command => command.name.startsWith(`${runtime.lingCppType}_绑定`));
  if (bindCommand) {
    const eventLabel = bindCommand.name.split('_绑定')[1] || '';
    const event = (control.events || []).find(item => item.label === eventLabel);
    const handler = `${variable.replace('示例', '')}示例被触发`;
    const parametersText = event
      ? (event.parameters || [])
        .map(parameter => `${EVENT_PARAMETER_TYPES[parameter.type] || '整数型'} ${parameter.name}`)
        .join(', ')
      : '';
    lines.push(`${bindCommand.name}(${variable}, &${handler})`);
    lines.push(`// 处理器签名：事件 ${eventLabel || '未知'}(${parametersText})`);
  }
  return lines;
}

function relatedCommands(control: DesignerControl, commands: ModuleCommand[]): ModuleCommand[] {
  const lingType = control.runtimeControl?.lingCppType;
  if (!lingType) return [];
  const prefix = `${lingType}_`;
  return commands.filter(command => command.name.startsWith(prefix) && command.visibility !== 'internal');
}

function renderCard(control: DesignerControl, manifest: ModuleManifest, slug: string, overlay: string | null): string {
  const runtime = control.runtimeControl;
  const commands = manifest.contributes?.commands || [];
  const lines: string[] = [];
  lines.push(`# ${control.label}（${control.namespacedType || `${manifest.id}/${control.type}`}）`);
  lines.push('');
  lines.push('> 本文件由 `npm run module:new-emoji-cards` 从模块清单确定性生成；只有「惯用要点与红线」来自人工 overlay，其余段落改清单后重新生成本文件即可。');
  lines.push('');
  lines.push(`- 设计后端：${control.backend || 'new-emoji'} ｜ 画布预览类型：${control.previewType || '（无）'} ｜ 容器：${control.isContainer ? '是' : '否'} ｜ 可视：${control.isVisual === false ? '否' : '是'}`);
  if (runtime) {
    lines.push(`- 代码创建：\`${runtime.createCommand}\` → 返回 \`${runtime.lingCppType}\`；允许父级：${(runtime.parentKinds || []).join(' / ') || '（未声明）'}`);
    lines.push(`- 跨事件取引用：\`${runtime.lookupByTagTextCommand}\` / \`${runtime.lookupByTagIntegerCommand}\`；有效性判断：\`${runtime.validCommand}\``);
  }
  lines.push(`- 设计器里引用本控件用 \`designerType: "${control.namespacedType || `${manifest.id}/${control.type}`}"\`；本卡路径 \`docs/${CARD_DIR_NAME}/${slug}\``);
  lines.push(`- 原生 API 文档（\`EU_*\` 导出、状态读回与 Python 示例）：\`docs/components/${slug}\`，需要时用 \`lingbuilder.file.read\` 按该相对路径在模块目录内读取。`);
  const skeleton = skeletonLines(control, commands);
  if (skeleton.length) {
    lines.push('');
    lines.push('```lcpp');
    lines.push(...skeleton);
    lines.push('```');
  }
  lines.push('');
  lines.push('## 属性');
  lines.push('');
  const properties = control.properties || [];
  if (!properties.length) {
    lines.push('（清单未声明可编辑属性；只有布局与内容属性。）');
  } else {
    lines.push('| 属性 | 中文标签 | 类型 | 默认值 | 可选值 | 分组 | 说明 |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const property of properties) {
      const options = (property.options || []).map(option => `${option.value}=${option.label}`).join(' ');
      lines.push(`| \`${property.key}\` | ${property.label} | ${property.type} | ${renderValue(property.defaultValue)} | ${options || ''} | ${property.group || ''} | ${(property.description || '').replace(/\|/gu, '\\|')} |`);
    }
  }
  lines.push('');
  lines.push('## 默认属性（设计器新建控件时写入模型）');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(control.defaultProps || {}, null, 2));
  lines.push('```');
  if (control.isContainer && control.layout) {
    lines.push('');
    lines.push(`容器布局协议：mode=${control.layout.mode}，坐标系=${control.layout.coordinateSpace || 'window'}，适配器=${control.layout.adapterId || '（默认）'}${control.layout.capacity ? `，容量=${control.layout.capacity}` : ''}${control.layout.acceptedDesignerTypes?.length ? `，接受=${control.layout.acceptedDesignerTypes.join(' / ')}` : ''}`);
  }
  lines.push('');
  lines.push('## 事件与处理器命名');
  lines.push('');
  const events = control.events || [];
  if (!events.length) {
    lines.push('（清单未声明事件。）');
  } else {
    lines.push('| 事件 | 中文名 | 设计器模型事件键 | 处理器命名 | 处理器参数 |');
    lines.push('|---|---|---|---|---|');
    for (const event of events) {
      const parameters = (event.parameters || [])
        .map(parameter => `${EVENT_PARAMETER_TYPES[parameter.type] || '整数型'} ${parameter.name}`)
        .join(', ');
      lines.push(`| ${event.name} | ${event.label} | \`${event.name}\` | \`${event.handlerPattern}\` | ${parameters || '无'} |`);
    }
    lines.push('');
    lines.push('处理器命名里的 `{controlName}` 即控件的稳定中文名；`_控件名_…` 形态只用于设计器模型控件，代码创建的控件用 `X_绑定…(控件, &处理器名)`。');
  }
  const related = relatedCommands(control, commands);
  if (related.length) {
    lines.push('');
    lines.push(`## 本控件命令族（${related.length} 条，最多列 ${COMMANDS_PER_CARD} 条）`);
    lines.push('');
    for (const command of related.slice(0, COMMANDS_PER_CARD)) {
      lines.push(`- \`${command.signature}\` —— ${(command.description || '').split('\n')[0].slice(0, 90)}`);
    }
    if (related.length > COMMANDS_PER_CARD) {
      lines.push(`- ……其余 ${related.length - COMMANDS_PER_CARD} 条用 \`lingbuilder.module.info\` 的 \`query\` 按命令名查。`);
    }
  }
  lines.push('');
  lines.push('## 惯用要点与红线');
  lines.push('');
  lines.push(overlay && overlay.trim()
    ? stripOverlayHeading(overlay)
    : `${PENDING_MARK}：本卡目前只有清单派生的客观契约，尚无人工红线段。补充位置：\`electron/docs/modules/new-emoji/component-cards/${control.type}.md\`。`);
  lines.push('');
  return lines.join('\n');
}

function overlayPath(controlType: string): string {
  return path.resolve(scriptDir, '..', 'docs', 'modules', 'new-emoji', 'component-cards', `${controlType}.md`);
}

/** overlay 只保留要点正文：首行 H1 标题与其后空行不并入卡片。 */
function stripOverlayHeading(overlay: string): string {
  const lines = overlay.trim().split(/\r?\n/u);
  while (lines.length && (lines[0].startsWith('# ') || !lines[0].trim())) lines.shift();
  return lines.join('\n').trim();
}

interface Options {
  outDir: string | null;
  check: boolean;
  moduleRoot: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { outDir: null, check: false, moduleRoot: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') options.check = true;
    else if (argument === '--out') options.outDir = path.resolve(argv[++index]);
    else if (argument === '--module-root') options.moduleRoot = path.resolve(argv[++index]);
  }
  return options;
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const moduleRoot = options.moduleRoot || path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
  const manifestPath = path.join(moduleRoot, 'lingbuilder.module.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`未找到模块清单：${manifestPath}（请先安装或铺设 ${MODULE_ID}）`);
    return 1;
  }
  const manifest = readJson(manifestPath) as ModuleManifest;
  const controls = manifest.contributes?.designerControls || [];
  if (!controls.length) {
    console.error('模块清单没有 contributes.designerControls 条目，无法生成组件卡。');
    return 1;
  }
  const slugs = loadDocumentationSlugs(moduleRoot, controls);
  const targetRoot = options.outDir || moduleRoot;
  const cardRoot = path.join(targetRoot, 'docs', CARD_DIR_NAME);
  const written: string[] = [];
  const missingOverlay: string[] = [];
  let pending = 0;

  for (const control of controls) {
    const slug = slugs.get(control.type) || `${kebab(control.type)}.md`;
    const filePath = path.join(cardRoot, slug);
    const source = overlayPath(control.type);
    const overlay = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : null;
    if (!overlay) missingOverlay.push(control.type);
    const content = renderCard(control, manifest, slug, overlay);
    if (content.includes(PENDING_MARK)) pending += 1;
    written.push(path.relative(repoRoot, filePath).replace(/\\/gu, '/'));
    if (options.check) {
      if (!fs.existsSync(filePath)) {
        console.error(`缺少组件卡：${path.relative(repoRoot, filePath)}`);
        return 1;
      }
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${content.replace(/\r\n/gu, '\n')}\n`, 'utf8');
    }
  }

  if (options.check) {
    if (!fs.existsSync(path.join(cardRoot, CARD_INDEX_README))) {
      console.error(`缺少组件卡索引：${CARD_DIR_NAME}/${CARD_INDEX_README}`);
      return 1;
    }
    console.log(`组件卡校验通过：${written.length} 张存在于 ${toPosix(cardRoot)}`);
    return 0;
  }
  const indexEntries = controls.map(control => {
    const file = slugs.get(control.type) || `${kebab(control.type)}.md`;
    return {
      type: control.type,
      label: control.label,
      documentation: `${CARD_DIR_NAME}/${file}`,
      nativeDocumentation: `${NATIVE_DOC_DIR_NAME}/${file}`,
      lingCppType: control.runtimeControl?.lingCppType || '',
      createCommand: control.runtimeControl?.createCommand || '',
      hasHumanNotes: !missingOverlay.includes(control.type)
    };
  });
  const rows: string[] = [];
  rows.push(`# ${manifest.id} 组件契约卡索引`);
  rows.push('');
  rows.push(`> 由 \`npm run module:new-emoji-cards\` 生成（模块版本 ${manifest.version}）。每张卡片给出中文控件类型、代码创建命令与参数顺序、属性表与枚举取值、事件与处理器命名、可粘贴骨架；「红线」列标记该卡是否已补人工惯用要点。`);
  rows.push('');
  rows.push('| 控件 | 中文名 | 契约卡 | 上游 API 文档 | 红线 |');
  rows.push('|---|---|---|---|---|');
  for (const entry of indexEntries) {
    rows.push(`| \`${entry.type}\` | ${entry.label} | [${entry.documentation.split('/').pop()}](./${entry.documentation.split('/').pop()}) | [${entry.nativeDocumentation.split('/').pop()}](../${entry.nativeDocumentation}) | ${entry.hasHumanNotes ? '已补' : PENDING_MARK} |`);
  }
  fs.writeFileSync(path.join(cardRoot, CARD_INDEX_README), `${rows.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(cardRoot, 'index.json'), `${JSON.stringify({
    schemaVersion: 1,
    moduleId: manifest.id,
    moduleVersion: manifest.version,
    controls: indexEntries
  }, null, 2)}\n`, 'utf8');
  console.log(`组件卡生成完成：${written.length} 张 → ${toPosix(cardRoot)}`);
  console.log(`其中无人工红线段（待补）：${pending} 张；已覆盖 overlay：${written.length - pending} 张`);
  return 0;
}

process.exitCode = main();
