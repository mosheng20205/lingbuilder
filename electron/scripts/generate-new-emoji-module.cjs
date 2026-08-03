const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');

const execFileAsync = promisify(execFile);

const MODULE_ID = 'lingbuilder.new_emoji.ui';
const MODULE_NAME = 'new_emoji 原生界面库';
const DEFAULT_SOURCE = 'T:\\github\\new_emoji';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = __dirname;
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.NEW_EMOJI_ROOT || DEFAULT_SOURCE);
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'new_emoji.lbmod');

  await assertNewEmojiSource(sourceRoot);
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });

  const exports = await parseExports(path.join(sourceRoot, 'src', 'new_emoji.def'));
  const prototypes = await parsePrototypes(path.join(sourceRoot, 'src', 'exports.h'));
  const apiManifest = await readJson(path.join(sourceRoot, 'docs', 'ai', 'api_manifest.full.json'), []);
  const designerCatalogPath = path.join(sourceRoot, 'docs', 'ai', 'lingbuilder_designer_catalog.json');
  const designerCatalogSource = await fs.readFile(designerCatalogPath, 'utf8');
  const designerCatalog = JSON.parse(designerCatalogSource);
  validateDesignerCatalog(designerCatalog, exports, prototypes);
  const commands = buildCommands(exports, prototypes, apiManifest);

  const designerCatalogSha256 = crypto.createHash('sha256').update(designerCatalogSource).digest('hex');
  await writeText(path.join(workRoot, 'lingbuilder.module.json'), JSON.stringify(buildManifest(commands, designerCatalog, designerCatalogSha256), null, 2) + '\n');
  await writeText(path.join(workRoot, 'include', 'new_emoji_bridge.h'), bridgeHeader());
  await writeText(path.join(workRoot, 'src', 'new_emoji_bridge.cpp'), bridgeSource());
  await copyFile(path.join(sourceRoot, 'src', 'exports.h'), path.join(workRoot, 'include', 'exports.h'));
  await copyFile(path.join(sourceRoot, 'src', 'element_types.h'), path.join(workRoot, 'include', 'element_types.h'));
  await writeText(path.join(workRoot, 'docs', 'lingbuilder-designer-catalog.json'), designerCatalogSource.endsWith('\n') ? designerCatalogSource : `${designerCatalogSource}\n`);
  await writeText(path.join(workRoot, 'docs', 'new_emoji-api.json'), JSON.stringify({
    source: sourceRoot,
    generatedAt: new Date().toISOString(),
    exportCount: exports.length,
    commands
  }, null, 2) + '\n');
  await writeText(path.join(workRoot, 'README.md'), moduleReadme(exports.length));

  await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.dll'), path.join(workRoot, 'bin', 'Win32', 'new_emoji.dll'));
  await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.lib'), path.join(workRoot, 'lib', 'Win32', 'new_emoji.lib'));
  await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.dll'), path.join(workRoot, 'bin', 'x64', 'new_emoji.dll'));
  await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.lib'), path.join(workRoot, 'lib', 'x64', 'new_emoji.lib'));
  await copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'), path.join(workRoot, 'assets', 'lingbuilder-newemoji-window.ico'));
  await copyFile(path.join(sourceRoot, 'LICENSE'), path.join(workRoot, 'LICENSE'));

  await fs.mkdir(packageDir, { recursive: true });
  await fs.rm(packagePath, { force: true });
  await compressArchive(workRoot, packagePath);

  if (args.install) {
    const installPath = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
    await fs.rm(installPath, { recursive: true, force: true });
    await copyDirectory(workRoot, installPath);
    console.log(`Installed ${MODULE_ID} to ${installPath}`);
    console.log('Project module references were left unchanged.');
  }

  console.log(`Generated ${MODULE_NAME}`);
  console.log(`Module directory: ${workRoot}`);
  console.log(`Package: ${packagePath}`);
  console.log(`Command count: ${commands.length}`);
}

function validateDesignerCatalog(catalog, exports, prototypes) {
  if (catalog?.schemaVersion !== 1 || catalog?.moduleId !== MODULE_ID) throw new Error('new_emoji LingBuilder Designer Catalog 版本或模块 ID 无效。');
  if (!Array.isArray(catalog.components) || catalog.components.length !== 92) throw new Error(`new_emoji 组件目录必须包含 92 个组件，实际 ${catalog?.components?.length || 0}。`);
  if (!Array.isArray(catalog.rawExports) || catalog.rawExports.length !== exports.length) throw new Error(`new_emoji 导出目录数量与 .def 不一致：${catalog?.rawExports?.length || 0}/${exports.length}。`);
  const catalogExports = new Set(catalog.rawExports.map(item => item.name));
  const missing = exports.filter(name => !catalogExports.has(name) || !prototypes.has(name));
  if (missing.length) throw new Error(`new_emoji 存在未分类或无声明导出：${missing.slice(0, 20).join(', ')}`);
}

function parseArgs(args) {
  const result = { install: false, source: '' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--install') result.install = true;
    if (arg === '--source') result.source = args[index + 1] || '';
  }
  return result;
}

async function assertNewEmojiSource(sourceRoot) {
  const required = [
    'src/new_emoji.def',
    'src/exports.h',
    'docs/ai/api_manifest.full.json',
    'bin/Win32/Release/new_emoji.dll',
    'bin/Win32/Release/new_emoji.lib',
    'bin/x64/Release/new_emoji.dll',
    'bin/x64/Release/new_emoji.lib'
  ];
  for (const relativePath of required) {
    try {
      await fs.stat(path.join(sourceRoot, relativePath));
    } catch {
      throw new Error(`new_emoji source is missing ${relativePath}: ${sourceRoot}`);
    }
  }
}

async function parseExports(defPath) {
  const exports = [];
  let inExports = false;
  for (const rawLine of (await fs.readFile(defPath, 'utf8')).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.toUpperCase() === 'EXPORTS') {
      inExports = true;
      continue;
    }
    if (inExports) exports.push(line.split(/\s+/u)[0]);
  }
  return exports;
}

async function parsePrototypes(exportsHeaderPath) {
  const text = await fs.readFile(exportsHeaderPath, 'utf8');
  const pattern = /([\w\s\*]+?)\s+__stdcall\s+(EU_\w+)\s*\((.*?)\);/gsu;
  const prototypes = new Map();
  let match;
  while ((match = pattern.exec(text))) {
    const returnType = normalizeSpace(match[1]);
    const name = match[2];
    const params = splitParams(match[3]).map(parseParam);
    prototypes.set(name, { returnType, params });
  }
  return prototypes;
}

function splitParams(params) {
  const result = [];
  let current = '';
  let depth = 0;
  for (const char of params) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      const item = normalizeSpace(current);
      if (item && item !== 'void') result.push(item);
      current = '';
      continue;
    }
    current += char;
  }
  const tail = normalizeSpace(current);
  if (tail && tail !== 'void') result.push(tail);
  return result;
}

function parseParam(param) {
  const fnPtr = param.match(/(.+?)\(\*\s*(\w+)\s*\)\s*\((.*)\)$/u);
  if (fnPtr) return { type: 'callback', name: fnPtr[2] };
  const match = param.match(/(.+?)\s*([A-Za-z_]\w*)$/u);
  if (!match) return { type: normalizeSpace(param), name: 'value' };
  return { type: normalizeSpace(match[1]), name: match[2] };
}

function buildCommands(exports, prototypes, apiManifest) {
  const commandNamesByExport = new Map();
  for (const item of apiManifest) {
    const entry = item?.bindings?.e_language?.entry || item?.create_export;
    const commandName = item?.bindings?.e_language?.command_name;
    if (entry && commandName && !commandNamesByExport.has(entry)) {
      commandNamesByExport.set(entry, commandName);
    }
  }

  const commands = [];
  const seen = new Set();
  for (const command of bridgeCommands()) {
    commands.push(command);
    seen.add(command.name);
  }

  for (const exportName of exports) {
    const prototype = prototypes.get(exportName) || { returnType: 'int', params: [] };
    let name = commandNamesByExport.get(exportName) || `NE_${exportName}`;
    if (seen.has(name)) name = `NE_${exportName}`;
    seen.add(name);
    commands.push({
      name,
      signature: `${name}(${prototype.params.map(param => param.name).join(', ')})`,
      description: `${MODULE_NAME} 底层导出 ${exportName}。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。`,
      insertText: `${name}(${prototype.params.map((_, index) => `$${index + 1}`).join(', ')})`,
      returnType: mapReturnType(prototype.returnType),
      runtimeName: exportName,
      visibility: 'advanced'
    });
  }

  return commands;
}

function bridgeCommands() {
  return [
    ['NE_创建窗口', 'NE_创建窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 原生窗口。', '窗口句柄'],
    ['NE_创建深色窗口', 'NE_创建深色窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 深色原生窗口。', '窗口句柄'],
    ['NE_显示窗口', 'NE_显示窗口(窗口句柄, 是否显示)', '显示或隐藏 new_emoji 窗口。', '空'],
    ['NE_显示并激活窗口', 'NE_显示并激活窗口(窗口句柄)', '恢复、显示并激活 new_emoji 窗口。', '空'],
    ['NE_运行消息循环', 'NE_运行消息循环()', '运行 new_emoji Win32 消息循环。', '整数型'],
    ['NE_销毁窗口', 'NE_销毁窗口(窗口句柄)', '销毁 new_emoji 窗口。', '空'],
    ['NE_创建容器', 'NE_创建容器(窗口句柄, 父元素ID, X, Y, 宽度, 高度)', '创建 new_emoji 容器。', '整数型'],
    ['NE_创建文本', 'NE_创建文本(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 文本元素。', '整数型'],
    ['NE_创建按钮', 'NE_创建按钮(窗口句柄, 父元素ID, 表情, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 按钮。', '整数型'],
    ['NE_创建编辑框', 'NE_创建编辑框(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 编辑框。', '整数型'],
    ['NE_创建复选框', 'NE_创建复选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)', '创建 new_emoji 复选框。', '整数型'],
    ['NE_创建单选框', 'NE_创建单选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)', '创建 new_emoji 单选框。', '整数型'],
    ['NE_创建列表框', 'NE_创建列表框(窗口句柄, 父元素ID, 标题, 项目文本, 默认选中项, X, Y, 宽度, 高度)', '创建 new_emoji 列表框，项目文本使用 | 分隔。', '整数型'],
    ['NE_创建图片', 'NE_创建图片(窗口句柄, 父元素ID, 图片源, 替代文本, 填充方式, X, Y, 宽度, 高度)', '创建 new_emoji 图片，填充方式 0-4 依次为 contain、cover、fill、none、scale-down。', '整数型'],
    ['NE_创建进度条', 'NE_创建进度条(窗口句柄, 父元素ID, 文本, 进度值, X, Y, 宽度, 高度)', '创建 new_emoji 进度条。', '整数型'],
    ['NE_创建上传', 'NE_创建上传(窗口句柄, 父元素ID, 标题, 提示, 初始文件, X, Y, 宽度, 高度)', '创建 new_emoji 文件上传组件。', '整数型'],
    ['NE_设置上传选项', 'NE_设置上传选项(窗口句柄, 元素ID, 允许多选, 自动上传, 样式, 显示文件列表, 显示提示, 显示操作, 允许拖拽, 文件数量上限, 单文件上限KB, 允许文件类型)', '设置上传组件的选择、显示、拖拽和文件限制。', '空'],
    ['NE_打开上传文件选择', 'NE_打开上传文件选择(窗口句柄, 元素ID)', '打开上传组件的系统文件选择对话框。', '整数型'],
    ['NE_开始上传', 'NE_开始上传(窗口句柄, 元素ID, 文件索引)', '触发上传组件指定文件的上传操作。', '整数型'],
    ['NE_清空上传文件', 'NE_清空上传文件(窗口句柄, 元素ID)', '清空上传组件文件列表。', '空'],
    ['NE_取上传文件数量', 'NE_取上传文件数量(窗口句柄, 元素ID)', '返回上传组件当前文件数量。', '整数型'],
    ['NE_取最近上传选择文件', 'NE_取最近上传选择文件()', '在上传事件中返回最近选择或拖入的文件路径，多个路径以 | 分隔。', '文本型'],
    ['NE_取最近上传动作', 'NE_取最近上传动作()', '在上传操作事件中返回动作编号。', '整数型'],
    ['NE_取最近上传文件索引', 'NE_取最近上传文件索引()', '在上传操作事件中返回文件索引。', '整数型'],
    ['NE_取最近上传进度值', 'NE_取最近上传进度值()', '在上传操作事件中返回进度或动作附加值。', '整数型'],
    ['NE_设置窗口标题', 'NE_设置窗口标题(窗口句柄, 标题)', '设置 new_emoji 窗口标题。', '空']
  ].map(([name, signature, description, returnType]) => ({
    name,
    signature,
    description,
    insertText: buildInsertTextFromSignature(name, signature),
    returnType,
    runtimeName: name,
    visibility: 'default'
  }));
}

function buildInsertTextFromSignature(name, signature) {
  const parameters = parseBindingParameters(signature);
  return `${name}(${parameters.map((_, index) => `$${index + 1}`).join(', ')})`;
}

function buildManifest(commands, designerCatalog, designerCatalogSha256) {
  const commandContributions = commands.map(({ runtimeName, ...command }) => command);
  const bindings = commands.map(command => ({
    command: command.name,
    runtimeName: command.runtimeName || command.name,
    parameters: parseBindingParameters(command.signature),
    returnType: mapBindingReturnType(command.returnType),
    encoding: command.name.startsWith('NE_EU_') ? 'raw' : 'wide',
    example: command.insertText || command.signature
  }));
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: MODULE_NAME,
    version: '1.0.0',
    category: '界面',
    description: '集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL，提供中文/emoji 友好的原生控件能力。',
    author: 'new_emoji contributors / LingBuilder',
    license: 'MIT',
    tags: ['界面', 'Direct2D', 'DirectWrite', 'emoji', 'Windows', '原生控件'],
    contributes: {
      commands: commandContributions,
      designerControls: newEmojiDesignerControls(designerCatalog),
      types: [
        { name: 'NE窗口句柄', description: 'new_emoji 原生窗口句柄。', cppType: 'HWND' },
        { name: 'NE元素ID', description: 'new_emoji Element 元素编号。', cppType: 'int' }
      ],
      snippets: [
        {
          label: 'new_emoji 最小窗口',
          insertText: [
            'NE_创建窗口("new_emoji 示例", 120, 120, 860, 560)',
            'NE_运行消息循环()'
          ].join('\n'),
          description: '插入 new_emoji 最小窗口调用。'
        }
      ],
      docs: [
        { title: 'new_emoji API 索引', path: 'docs/new_emoji-api.json' },
        { title: 'new_emoji 模块说明', path: 'README.md' }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/new_emoji_bridge.h', 'include/exports.h', 'include/element_types.h'],
        sources: ['src/new_emoji_bridge.cpp'],
        libs: ['lib/Win32/new_emoji.lib'],
        runtimeFiles: ['bin/Win32/new_emoji.dll', 'assets/lingbuilder-newemoji-window.ico'],
        defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
      },
      {
        id: 'windows-msvc-x64',
        platform: 'windows',
        arch: 'x64',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/new_emoji_bridge.h', 'include/exports.h', 'include/element_types.h'],
        sources: ['src/new_emoji_bridge.cpp'],
        libs: ['lib/x64/new_emoji.lib'],
        runtimeFiles: ['bin/x64/new_emoji.dll', 'assets/lingbuilder-newemoji-window.ico'],
        defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
      }
    ],
    bindings: { commands: bindings },
    designer: {
      backend: 'new-emoji',
      path: 'docs/lingbuilder-designer-catalog.json',
      schemaVersion: designerCatalog.schemaVersion,
      sha256: designerCatalogSha256
    },
    publish: {
      repository: 'T:/github/new_emoji'
    }
  };
}

function newEmojiDesignerControls(catalog) {
  return catalog.components.map(component => {
    const componentEvents = [...(component.events || []), ...(component.isVisual === false ? [] : COMMON_DESIGNER_EVENTS)]
      .filter((event, index, items) => items.findIndex(item => item.name === event.name) === index);
    const createExport = catalog.rawExports.find(item => item.name === component.createExport);
    const previewType = inferPreviewType(component.id, component.isContainer);
    const createAliases = CREATE_PARAMETER_ALIASES[component.id] || {};
    const createParameters = createExport.parameters.map(parameter => {
      const normalizedName = snakeToCamel(parameter.name.replace(/_(bytes|len)$/u, ''));
      const propertyKey = createAliases[normalizedName];
      return propertyKey ? { ...parameter, propertyKey } : parameter;
    });
    const createPropertyKeys = new Set(createParameters
      .map(parameter => parameter.propertyKey || snakeToCamel(parameter.name.replace(/_(bytes|len)$/u, '')))
      .filter(key => !['hwnd', 'parentId', 'x', 'y', 'w', 'h'].includes(key)));
    const propertySetters = [
      ...inferPropertySetters(component, catalog.rawExports),
      ...getCustomPropertySetters(component)
    ];
    if (component.id === 'Image') {
      const imageStyle = propertySetters.find(setter => setter.command === 'EU_SetImageStyle');
      if (imageStyle && !imageStyle.propertyKeys.includes('borderless')) imageStyle.propertyKeys.push('borderless');
    }
    const eventBindings = inferEventBindings({ ...component, events: componentEvents }, catalog.rawExports);
    const specialPropertyCommands = SPECIAL_PROPERTY_COMMANDS[component.id] || {};
    const setterByProperty = new Map(propertySetters.flatMap(setter => setter.propertyKeys.map(key => [key, setter.command])));
    Object.entries(specialPropertyCommands).forEach(([key, command]) => setterByProperty.set(key, command));
    const bindingByEvent = new Map(eventBindings.map(binding => [binding.eventName, binding.command]));
    const properties = (component.properties || []).map(property => ({
      key: property.key,
      label: property.label,
      type: property.type,
      defaultValue: component.id === 'Tabs' && property.key === 'items'
        ? ['标签页 1']
        : component.id === 'Tabs' && property.key === 'contentVisible'
          ? true
          : property.defaultValue,
      options: property.options,
      description: property.description,
      group: property.group,
      level: property.level,
      ...(createPropertyKeys.has(property.key)
        ? { runtimeCommand: component.createExport }
        : setterByProperty.has(property.key)
          ? { runtimeCommand: setterByProperty.get(property.key) }
          : {})
    }));
    return {
      type: component.id,
      namespacedType: component.namespacedId || `${MODULE_ID}/${component.id}`,
      previewType,
      label: component.label,
      category: component.category || 'new_emoji 原生控件',
      icon: component.id,
      backend: 'new-emoji',
      nativeAdapter: `new-emoji-${component.id.toLowerCase()}`,
      isContainer: component.isContainer === true,
      ...(component.id === 'Tabs' ? {
        layout: {
          mode: 'slots',
          coordinateSpace: 'window',
          adapterId: 'new-emoji.tabs.pages'
        }
      } : {}),
      isVisual: component.isVisual !== false,
      defaultProps: {
        content: component.label.replace(/\s+[A-Za-z][A-Za-z0-9]*$/u, ''),
        width: component.defaultWidth,
        height: component.defaultHeight,
        background: 'transparent',
        foreground: '#F8FAFC',
        ...Object.fromEntries(properties.map(property => [property.key, property.defaultValue])),
        ...(component.id === 'Tabs' ? { contentVisible: true } : {})
      },
      properties,
      events: componentEvents.map(event => ({
        name: event.name,
        ...(newEmojiEventAliases(component.id, event.name).length
          ? { aliases: newEmojiEventAliases(component.id, event.name) }
          : {}),
        label: event.label,
        group: event.group,
        handlerPattern: event.handlerPattern || `_{controlName}_${event.label}`,
        parameters: event.parameters || [],
        ...(bindingByEvent.has(event.name) ? { runtimeCommand: bindingByEvent.get(event.name) } : {})
      })),
      runtime: {
        createCommand: component.createExport,
        createReturnType: createExport.returnType,
        createParameters,
        propertyCommands: specialPropertyCommands,
        propertySetters,
        eventBindings
      }
    };
  });
}

const CREATE_PARAMETER_ALIASES = {
  MessageBox: { text: 'body', boxType: 'messageType' },
  Header: { text: 'title' },
  Aside: { text: 'title' },
  Main: { text: 'title' },
  Footer: { text: 'title' }
};

const SPECIAL_PROPERTY_COMMANDS = { Table: {
  tableFilters: 'LB_NE_ApplyTableFilters',
  tableColumnAligns: 'LB_NE_ApplyTableColumnAligns',
  tableRowAligns: 'LB_NE_ApplyTableRowAligns',
  tableCellAligns: 'LB_NE_ApplyTableCellAligns',
  tableRowStyles: 'LB_NE_ApplyTableRowStyles',
  tableColumnEditOverrides: 'LB_NE_ApplyTableColumnEditOverrides',
  tableCellEditOverrides: 'LB_NE_ApplyTableCellEditOverrides'
} };

const PROPERTY_PARAMETER_ALIASES = {
  'Button.EU_SetButtonStateColors': {
    hoverBg: 'hoverBackgroundColor', hoverBorder: 'hoverBorderColor', hoverFg: 'hoverForegroundColor',
    pressedBg: 'pressedBackgroundColor', pressedBorder: 'pressedBorderColor', pressedFg: 'pressedForegroundColor'
  },
  'Panel.EU_SetPanelStyle': { bg: 'backgroundColor', border: 'borderColor', radius: 'cornerRadius' },
  'Container.EU_SetContainerLayout': { direction: 'orientation' },
  'Border.EU_SetBorderOptions': { color: 'borderColor', width: 'borderWidth' },
  'InfoBox.EU_SetInfoBoxOptions': { type: 'infoType', accent: 'accentColor' },
  'Divider.EU_SetDividerOptions': { width: 'lineWidth', text: 'content' },
  'Progress.EU_SetProgressColors': { fill: 'fillColor', track: 'trackColor', text: 'progressTextColor' },
  'Menu.EU_SetMenuColors': {
    bg: 'menuBackgroundColor',
    textColor: 'menuTextColor',
    activeTextColor: 'menuActiveTextColor',
    hoverBg: 'menuHoverBackgroundColor',
    disabledTextColor: 'menuDisabledTextColor',
    border: 'menuBorderColor'
  },
  'IconButton.EU_SetIconButtonPadding': {
    left: 'paddingLeft', top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom'
  },
  'Table.EU_SetTableColumnsEx': { columns: 'tableColumnsEx' },
  'Table.EU_SetTableRowsEx': { rows: 'tableRowsEx' },
  'Table.EU_SetTableCellOverridesUtf8': { spec: 'tableCellOverrides' },
  'Table.EU_SetTableSpansUtf8': { spec: 'tableSpans' },
  'Table.EU_SetTableBorderColor': { color: 'tableBorderColor' },
  'Table.EU_SetTableBorderWidth': { width: 'tableBorderWidth' },
  'Table.EU_SetTableSelectedRows': { rows: 'selectedRows' },
  'Table.EU_SetTableSort': { col: 'sortColumn', descending: 'sortDescending' },
  'Table.EU_SetTableSearch': { value: 'searchText' },
  'Table.EU_SetTableScroll': { x: 'scrollX', row: 'scrollRow' },
  'Table.EU_SetTableViewportOptions': {
    maxHeight: 'tableMaxHeight', fixedHeader: 'tableFixedHeader',
    horizontalScroll: 'tableHorizontalScroll', showSummary: 'tableShowSummary'
  },
  'Table.EU_SetTableSummary': { values: 'tableSummary' },
  'Table.EU_SetTableTreeOptions': {
    enabled: 'tableTreeEnabled', indent: 'tableTreeIndent', lazy: 'tableTreeLazy'
  },
  'Table.EU_SetTableHeaderDragOptions': {
    columnResize: 'tableColumnResize', headerHeightResize: 'tableHeaderHeightResize',
    minColWidth: 'tableMinColumnWidth', maxColWidth: 'tableMaxColumnWidth',
    minHeaderHeight: 'tableMinHeaderHeight', maxHeaderHeight: 'tableMaxHeaderHeight'
  },
  'Table.EU_SetTableDoubleClickEdit': { enabled: 'tableDoubleClickEdit' },
  'Table.EU_SetTableVirtualOptions': {
    enabled: 'tableVirtualEnabled', rowCount: 'tableVirtualRowCount', cacheWindow: 'tableVirtualCacheWindow'
  },
  'Image.EU_SetImageStyle': {
    bg: 'imageBackgroundColor', border: 'imageBorderColor', borderWidth: 'borderWidth', radius: 'radius', padding: 'padding'
  },
  'Image.EU_SetImagePreviewEnabled': { enabled: 'previewEnabled' },
  'Image.EU_SetImagePreview': { open: 'previewOpen' },
  'Image.EU_SetImagePreviewTransform': { scalePercent: 'previewScale', offsetX: 'previewOffsetX', offsetY: 'previewOffsetY' },
  'Image.EU_SetImageCacheEnabled': { enabled: 'cacheEnabled' },
  'Image.EU_SetImagePreviewList': { sources: 'previewList' },
  'Image.EU_SetImagePreviewIndex': { index: 'previewIndex' },
  'Image.EU_SetImagePlaceholder': {
    icon: 'placeholderIcon', text: 'placeholderText', fg: 'placeholderTextColor', bg: 'placeholderBackgroundColor'
  },
  'Image.EU_SetImageErrorContent': {
    icon: 'errorIcon', text: 'errorText', fg: 'errorTextColor', bg: 'errorBackgroundColor'
  },
  'Link.EU_SetLinkOptions': { type: 'linkType' },
  'Link.EU_SetLinkContent': { prefix: 'prefixIcon', suffix: 'suffixIcon' },
  'Omnibox.EU_SetOmniboxSecurityState': { state: 'securityState', bytes: 'securityText' },
  'Omnibox.EU_SetOmniboxPrefixChip': {
    icon: 'prefixIcon', text: 'prefixText', bgColor: 'prefixBg', fgColor: 'prefixFg'
  },
  'Omnibox.EU_SetOmniboxActionIcons': { icons: 'actionIcons' },
  'Omnibox.EU_SetOmniboxSuggestionItems': { items: 'suggestions' },
  'Omnibox.EU_SetOmniboxSuggestionOpen': { open: 'suggestionOpen' },
  'Omnibox.EU_SetOmniboxSuggestionSelected': { index: 'suggestionSelected' },
  'Tour.EU_SetTourOptions': {
    mask: 'mask', targetX: 'targetX', targetY: 'targetY', targetW: 'targetWidth', targetH: 'targetHeight'
  },
  'Tour.EU_SetTourTargetElement': { targetElementId: 'targetElementId', padding: 'targetPadding' },
  'Tour.EU_SetTourMaskBehavior': { passThrough: 'maskPassThrough', closeOnMask: 'closeOnMask' },
  'Rate.EU_SetRateMax': { maxValue: 'max' },
  'Rate.EU_SetRateDisplayOptions': {
    showText: 'showText', showScore: 'showScore', textColor: 'textColor', template: 'scoreTemplate'
  },
  'DatePicker.EU_SetDatePickerPlaceholder': { bytes: 'placeholder', text: 'placeholder' },
  'DatePicker.EU_SetDatePickerFormat': { bytes: 'dateFormat' },
  'DatePicker.EU_SetDatePickerDisabledDatesUtf8': { dates: 'disabledDates' },
  'DateTimePicker.EU_SetDateTimePickerOptions': { today: 'today', showToday: 'showToday', minuteStep: 'minuteStep' },
  'Calendar.EU_SetCalendarRange': { minYyyymmdd: 'minDate', maxYyyymmdd: 'maxDate' },
  'Calendar.EU_SetCalendarOptions': { today: 'today', showToday: 'showToday' },
  'BrowserViewport.EU_SetBrowserViewportPlaceholder': {
    title: 'placeholderTitle', desc: 'placeholderDesc', icon: 'placeholderIcon'
  },
  'BrowserViewport.EU_SetBrowserViewportScreenshot': { bytes: 'screenshot' },
  'Empty.EU_SetEmptyOptions': { icon: 'icon', action: 'actionText' },
  'Empty.EU_SetEmptyActionClicked': { clicked: 'actionClicked' },
  'Transfer.EU_SetTransferSelected': { leftSelected: 'leftSelected', rightSelected: 'rightSelected' },
  'Transfer.EU_SetTransferOptions': { filterable: 'filterable' },
  'InputNumber.EU_SetInputNumberRange': { minimum: 'min', maximum: 'max' },
  'Slider.EU_SetSliderRange': { minimum: 'min', maximum: 'max', stepValue: 'step' },
  'Table.EU_SetTableEmptyText': { text: 'emptyText' },
  'Table.EU_SetTableSelectedRow': { rowIndex: 'selectedRow' },
  'Table.EU_SetTableSort': { columnIndex: 'sortColumn', desc: 'sortDescending' },
  'Table.EU_SetTableSelectionMode': { mode: 'selectionMode' },
  'ListBox.EU_SetListBoxItemsEx': { items: 'listBoxItemsEx' },
  'ListBox.EU_SetListBoxSelectedIndex': { index: 'selectedIndex' },
  'ListBox.EU_SetListBoxSelectedKeys': { keys: 'selectedKeys' },
  'ListBox.EU_SetListBoxVirtualItemCount': { count: 'virtualItemCount' },
  'Menu.EU_SetMenuExpandedUtf8': { indices: 'expandedIndices' },
  'Tabs.EU_SetTabsPosition': { tabPosition: 'position' },
  'Tabs.EU_SetTabsHeaderAlign': { align: 'headerAlign' },
  'Tabs.EU_SetTabsHeaderVisible': { visible: 'headerVisible' },
  'Tabs.EU_SetTabsContentVisible': { visible: 'contentVisible' },
  'Dialog.EU_SetDialogOptions': { w: 'dialogWidth', h: 'dialogHeight' },
  'Notification.EU_SetNotificationOptions': { notifyType: 'messageType', durationMs: 'duration' },
  'Message.EU_SetMessageText': { bytes: 'body' },
  'Message.EU_SetMessageOptions': { durationMs: 'duration' },
  'Icon.EU_SetIconOptions': { rotationDegrees: 'rotation' },
  'Layout.EU_SetLayoutOptions': { orientation: 'orientation' },
  'SelectV2.EU_SetSelectV2OptionAlignment': { alignment: 'optionAlign' },
  'SelectV2.EU_SetSelectV2ValueAlignment': { alignment: 'valueAlign' },
  'InputNumber.EU_SetInputNumberStepStrictly': { strict: 'stepStrictly' },
  'Tag.EU_SetTagSize': { sizePreset: 'size' },
  'Tag.EU_SetTagThemeColor': { color: 'themeColor' },
  'Badge.EU_SetBadgeMax': { maxValue: 'max' },
  'Progress.EU_SetProgressColorStops': { stops: 'colorStops' },
  'Progress.EU_SetProgressTextTemplate': { bytes: 'textTemplate' },
  'Avatar.EU_SetAvatarSource': { src: 'source' },
  'Avatar.EU_SetAvatarFallbackSource': { src: 'fallbackSource' },
  'Collapse.EU_SetCollapseAdvancedOptions': { allowCollapse: 'allowCollapse', animated: 'animated', disabled: 'disabledIndices' },
  'Tree.EU_SetTreeDataJson': { json: 'treeDataJson' },
  'TreeSelect.EU_SetTreeSelectDataJson': { json: 'treeDataJson' },
  'Autocomplete.EU_SetAutocompletePlaceholder': { text: 'placeholder' },
  'TimePicker.EU_SetTimePickerRange': { minHhmm: 'minTime', maxHhmm: 'maxTime' },
  'TimeSelect.EU_SetTimeSelectRange': { minHhmm: 'minTime', maxHhmm: 'maxTime' },
  'TimeSelect.EU_SetTimeSelectPlaceholder': { text: 'placeholder' },
  'PageHeader.EU_SetPageHeaderActions': { items: 'actions' },
  'PageHeader.EU_SetPageHeaderBreadcrumbs': { items: 'breadcrumbs' },
  'Watermark.EU_SetWatermarkOptions': { rotationDegrees: 'rotation', alpha: 'alpha' },
  'Carousel.EU_SetCarouselAutoplay': { enabled: 'autoplay', intervalMs: 'intervalMs' },
  'Loading.EU_SetLoadingTarget': { targetElementId: 'targetElementId', padding: 'targetPadding' },
  'Popover.EU_SetPopoverArrow': { visible: 'showArrow', size: 'arrowSize' },
  'Popover.EU_SetPopoverElevation': { level: 'elevation' },
  'Popover.EU_SetPopoverAutoPlacement': { enabled: 'autoPlacement' },
  'Popconfirm.EU_SetPopconfirmIcon': { icon: 'icon', iconColor: 'iconColor', visible: 'iconVisible' },
  'IconButton.EU_SetIconButtonBadge': { bytes: 'badge', visible: 'badgeVisible' },
  'IconButton.EU_SetIconButtonIconSize': { size: 'iconSize' },
  'Omnibox.EU_SetOmniboxActionIcons': { bytes: 'actionIcons' },
  'Omnibox.EU_SetOmniboxSuggestionItems': { bytes: 'suggestions' },
  'Image.EU_SetImagePreviewList': { sources: 'previewList', selectedIndex: 'previewIndex' },
  'DatePicker.EU_SetDatePickerOptions': { todayYyyymmdd: 'today', showToday: 'showToday', dateFormat: 'dateFormat' },
  'DateTimePicker.EU_SetDateTimePickerOptions': { todayYyyymmdd: 'today', showToday: 'showToday', minuteStep: 'minuteStep', dateFormat: 'dateFormat' },
  'Calendar.EU_SetCalendarOptions': { todayYyyymmdd: 'today', showToday: 'showToday' },
  'Slider.EU_SetSliderRange': { minValue: 'min', maxValue: 'max' },
  'Slider.EU_SetSliderOptions': { step: 'step' },
  'InputNumber.EU_SetInputNumberRange': { minValue: 'min', maxValue: 'max' },
  'Loading.EU_SetLoadingStyle': {
    background: 'backgroundColor', spinnerColor: 'spinnerColor', textColor: 'loadingTextColor'
  },
  'Calendar.EU_SetCalendarDateRange': { minimum: 'minDate', maximum: 'maxDate' },
  'Input.EU_SetInputPrefixChip': { bgColor: 'prefixBg', fgColor: 'prefixFg' },
};

const PROPERTY_PARAMETER_LITERALS = {
  'Container.EU_SetContainerLayout': { enabled: 1 },
  'Dialog.EU_SetDialogOptions': { closeOnMask: 1 },
  'Slider.EU_SetSliderOptions': { showTooltip: 1 }
};

// Designer properties use human-friendly units while the native ABI may use a
// factor. Keep that conversion in the generated runtime mapping instead of
// teaching the C++ generator about a specific new_emoji control.
const PROPERTY_PARAMETER_VALUE_SCALES = {
  'Icon.EU_SetIconOptions': { scale: 0.01 }
};

function getCustomPropertySetters(component) {
  const textRegions = new Set(['Header', 'Aside', 'Main', 'Footer']);
  const result = [];
  if (component.id === 'Link') {
    result.push({
      command: 'EU_SetTextOptions',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'align', type: 'int', propertyKey: 'align' }, { name: 'valign', type: 'int', propertyKey: 'valign' },
        { name: 'wrap', type: 'int', propertyKey: 'wrap' }, { name: 'ellipsis', type: 'int', propertyKey: 'ellipsis' }
      ],
      propertyKeys: ['align', 'valign', 'wrap', 'ellipsis']
    });
  }
  if (component.id === 'Container') {
    result.push({
      command: 'EU_SetPanelLayout',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'fill_parent', type: 'int', literal: 0 }, { name: 'content_layout', type: 'int', literal: 0 }
      ],
      propertyKeys: []
    });
    result.push({
      command: 'EU_SetPanelStyle',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'bg', type: 'Color', propertyKey: 'backgroundColor' }, { name: 'border', type: 'Color', propertyKey: 'borderColor' },
        { name: 'border_width', type: 'float', literal: 1 }, { name: 'radius', type: 'float', literal: 0 },
        { name: 'padding', type: 'int', literal: 0 }
      ],
      propertyKeys: ['borderColor']
    });
  }
  if (textRegions.has(component.id)) {
    result.push({
      command: 'EU_SetElementText',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'bytes', type: 'const unsigned char*', propertyKey: 'title' },
        { name: 'len', type: 'int', lengthOf: 'title' }
      ],
      propertyKeys: ['title']
    });
    result.push({
      command: 'EU_SetContainerRegionTextOptions',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'align', type: 'int', propertyKey: 'align' }, { name: 'valign', type: 'int', literal: 1 }
      ],
      propertyKeys: ['align']
    });
  }
  if (textRegions.has(component.id) || component.id === 'Container' || component.id === 'Layout') {
    result.push({
      command: 'EU_SetElementColor',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'bg', type: 'Color', propertyKey: 'backgroundColor' },
        { name: 'fg', type: 'Color', propertyKey: 'foreground' }
      ],
      propertyKeys: ['backgroundColor']
    });
  }
  if (component.id === 'Transfer') {
    for (const [side, key] of [[0, 'leftSelected'], [1, 'rightSelected']]) {
      result.push({
        command: 'EU_SetTransferSelected',
        parameters: [
          { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
          { name: 'side', type: 'int', literal: side }, { name: 'selected_index', type: 'int', propertyKey: key }
        ],
        propertyKeys: [key]
      });
    }
    result.push({
      command: 'EU_SetTransferOptions',
      parameters: [
        { name: 'hwnd', type: 'HWND' }, { name: 'element_id', type: 'int' },
        { name: 'filterable', type: 'int', propertyKey: 'filterable' },
        { name: 'multiple', type: 'int', literal: 0 }, { name: 'show_footer', type: 'int', literal: 0 },
        { name: 'show_select_all', type: 'int', literal: 0 }, { name: 'show_count', type: 'int', literal: 0 },
        { name: 'render_mode', type: 'int', literal: 0 }
      ],
      propertyKeys: ['filterable']
    });
  }
  return result;
}

function inferPropertySetters(component, rawExports) {
  const propertyKeys = new Set((component.properties || []).map(property => property.key));
  const setters = [];
  for (const runtimeExport of rawExports) {
    if (!runtimeExport.name.startsWith(`EU_Set${component.id}`)
      || runtimeExport.name.endsWith('Callback')
      || runtimeExport.name.includes('Provider')) continue;
    const aliases = PROPERTY_PARAMETER_ALIASES[`${component.id}.${runtimeExport.name}`] || {};
    const literals = PROPERTY_PARAMETER_LITERALS[`${component.id}.${runtimeExport.name}`] || {};
    const valueScales = PROPERTY_PARAMETER_VALUE_SCALES[`${component.id}.${runtimeExport.name}`] || {};
    const parameters = [];
    const mappedKeys = new Set();
    let supported = true;
    let lastTextPropertyKey;
    for (const parameter of runtimeExport.parameters || []) {
      const normalizedName = snakeToCamel(parameter.name.replace(/_(bytes|len)$/u, ''));
      if (normalizedName === 'hwnd' || normalizedName === 'elementId') {
        parameters.push({ name: parameter.name, type: parameter.type });
        continue;
      }
      if (normalizedName === 'len' && lastTextPropertyKey && parameter.type === 'int') {
        parameters.push({ name: parameter.name, type: parameter.type, lengthOf: lastTextPropertyKey });
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(literals, normalizedName)) {
        parameters.push({ name: parameter.name, type: parameter.type, literal: literals[normalizedName] });
        continue;
      }
      if (!/^(?:int|float|double|Color|const unsigned char\*)$/u.test(parameter.type)) {
        supported = false;
        break;
      }
      const propertyKey = aliases[normalizedName]
        || inferPropertyKey(normalizedName, propertyKeys);
      if (!propertyKey) {
        supported = false;
        break;
      }
      mappedKeys.add(propertyKey);
      parameters.push({
        name: parameter.name,
        type: parameter.type,
        ...(parameter.name.endsWith('_len')
          ? { lengthOf: propertyKey }
          : {
              propertyKey,
              ...(typeof valueScales[normalizedName] === 'number'
                ? { valueScale: valueScales[normalizedName] }
                : {})
            })
      });
      if (parameter.type === 'const unsigned char*') lastTextPropertyKey = propertyKey;
    }
    if (supported && mappedKeys.size > 0) {
      setters.push({ command: runtimeExport.name, parameters, propertyKeys: [...mappedKeys] });
    }
  }
  return setters;
}

function inferPropertyKey(normalizedName, propertyKeys) {
  if (propertyKeys.has(normalizedName)) return normalizedName;
  const candidates = [
    `${normalizedName}Color`,
    normalizedName === 'bg' ? 'backgroundColor' : '',
    normalizedName === 'border' ? 'borderColor' : '',
    normalizedName === 'width' ? 'borderWidth' : '',
    normalizedName === 'radius' ? 'cornerRadius' : '',
    normalizedName === 'minimum' ? 'min' : '',
    normalizedName === 'maximum' ? 'max' : ''
  ].filter(Boolean);
  return candidates.find(candidate => propertyKeys.has(candidate));
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase());
}

const COMMON_DESIGNER_EVENTS = [
  { name: 'MouseEnter', label: '鼠标进入', group: '鼠标' },
  { name: 'MouseLeave', label: '鼠标离开', group: '鼠标' },
  { name: 'MouseDown', label: '鼠标按下', group: '鼠标' },
  { name: 'MouseUp', label: '鼠标抬起', group: '鼠标' },
  { name: 'MouseDoubleClick', label: '鼠标双击', group: '鼠标' },
  { name: 'MouseMove', label: '鼠标移动', group: '鼠标' },
  { name: 'MouseWheel', label: '鼠标滚轮', group: '鼠标' },
  { name: 'GotFocus', label: '获得焦点', group: '焦点' },
  { name: 'LostFocus', label: '失去焦点', group: '焦点' }
];

const COMMON_EVENT_BINDINGS = {
  MouseEnter: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 1],
  MouseLeave: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 2],
  MouseDown: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 3],
  MouseUp: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 4],
  MouseDoubleClick: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 5],
  MouseMove: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 6],
  MouseWheel: ['EU_SetElementMouseCallback', 'ElementMouseCallback', 7],
  GotFocus: ['EU_SetElementFocusCallback', 'ElementFocusCallback', 1],
  LostFocus: ['EU_SetElementFocusCallback', 'ElementFocusCallback', 0]
};

// LingBuilder 通用预览控件与 new_emoji 原生目录存在少量同义事件名。
const NEW_EMOJI_EVENT_ALIASES = {
  'Button.Clicked': ['Click'],
  'Card.Clicked': ['Click'],
  'Link.Clicked': ['Click'],
  'PageHeader.Clicked': ['Click'],
  'IconButton.Clicked': ['Click'],
  'Checkbox.ValueChanged': ['Checked', 'Unchecked'],
  'Radio.ValueChanged': ['Checked', 'Unchecked'],
  'ListBox.ItemDoubleClicked': ['DoubleClick']
};

function newEmojiEventAliases(componentId, eventName) {
  return NEW_EMOJI_EVENT_ALIASES[`${componentId}.${eventName}`] || [];
}

const EVENT_BINDINGS = {
  'Button.Clicked': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Input.TextChanged': ['EU_SetInputTextCallback', 'ElementTextCallback'],
  'EditBox.TextChanged': ['EU_SetEditBoxTextCallback', 'ElementTextCallback'],
  'Table.CellClicked': ['EU_SetTableCellClickCallback', 'TableCellCallback'],
  'Table.CellAction': ['EU_SetTableCellActionCallback', 'TableCellCallback'],
  'Table.CellEdit': ['EU_SetTableCellEditCallback', 'TableCellEditCallback'],
  'Table.ContextMenu': ['EU_SetTableContextMenuCallback', 'TableContextMenuCallback'],
  'Table.VirtualRow': ['EU_SetTableVirtualRowProvider', 'TableVirtualRowCallback'],
  'ListBox.SelectionChanged': ['EU_SetListBoxChangeCallback', 'ElementTextCallback'],
  'ListBox.ItemClicked': ['EU_SetListBoxItemClickCallback', 'ElementValueCallback'],
  'ListBox.ItemDoubleClicked': ['EU_SetListBoxItemDoubleClickCallback', 'ElementValueCallback'],
  'ListBox.Edit': ['EU_SetListBoxEditCallback', 'ListBoxEditCallback'],
  'ListBox.Reorder': ['EU_SetListBoxReorderCallback', 'ElementReorderCallback'],
  'ListBox.ContextMenu': ['EU_SetListBoxContextMenuCallback', 'ElementValueCallback'],
  'Card.Clicked': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Menu.MenuCommand': ['EU_SetMenuSelectCallback', 'MenuSelectCallback'],
  'Tabs.SelectionChanged': ['EU_SetTabsChangeCallback', 'ElementValueCallback'],
  'Dialog.Closed': ['EU_SetDialogBeforeCloseCallback', 'ElementBeforeCloseCallback'],
  'Drawer.Closed': ['EU_SetDrawerCloseCallback', 'ElementValueCallback'],
  'Notification.Closed': ['EU_SetNotificationCloseCallback', 'ElementValueCallback'],
  'Message.Closed': ['EU_SetMessageCloseCallback', 'ElementValueCallback'],
  'MessageBox.Result': ['EU_SetMessageBoxResultCallback', 'MessageBoxExCallback'],
  'Link.Clicked': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Checkbox.ValueChanged': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Radio.ValueChanged': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Switch.ValueChanged': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Slider.ValueChanged': ['EU_SetSliderValueCallback', 'ElementValueCallback'],
  'Select.SelectionChanged': ['EU_SetSelectChangeCallback', 'ElementValueCallback'],
  'SelectV2.SelectionChanged': ['EU_SetSelectV2ChangeCallback', 'ElementValueCallback'],
  'InputNumber.ValueChanged': ['EU_SetInputNumberValueCallback', 'ElementValueCallback'],
  'InputTag.TextChanged': ['EU_SetInputTagChangeCallback', 'ElementTextCallback'],
  'InputGroup.TextChanged': ['EU_SetElementTextChangeCallback', 'ElementClickCallback'],
  'Rate.ValueChanged': ['EU_SetRateChangeCallback', 'ElementValueCallback'],
  'ColorPicker.ValueChanged': ['EU_SetColorPickerChangeCallback', 'ElementValueCallback'],
  'Tag.Closed': ['EU_SetTagCloseCallback', 'ElementClickCallback'],
  'Alert.Closed': ['EU_SetAlertCloseCallback', 'ElementValueCallback'],
  'Breadcrumb.SelectionChanged': ['EU_SetBreadcrumbSelectCallback', 'ElementValueCallback'],
  'Pagination.ValueChanged': ['EU_SetPaginationChangeCallback', 'ElementValueCallback'],
  'Steps.SelectionChanged': ['EU_SetStepsChangeCallback', 'ElementValueCallback'],
  'Collapse.SelectionChanged': ['EU_SetCollapseChangeCallback', 'ElementValueCallback'],
  'Calendar.SelectionChanged': ['EU_SetCalendarChangeCallback', 'ElementValueCallback'],
  'Tree.NodeEvent': ['EU_SetTreeNodeEventCallback', 'TreeNodeEventCallback'],
  'Tree.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'Tree.LazyLoad': ['EU_SetTreeLazyLoadCallback', 'TreeNodeEventCallback'],
  'Tree.Drag': ['EU_SetTreeDragCallback', 'TreeNodeEventCallback'],
  'Tree.AllowDrag': ['EU_SetTreeAllowDragCallback', 'TreeNodeAllowDragCallback'],
  'Tree.AllowDrop': ['EU_SetTreeAllowDropCallback', 'TreeNodeAllowDropCallback'],
  'TreeSelect.NodeEvent': ['EU_SetTreeSelectNodeEventCallback', 'TreeNodeEventCallback'],
  'TreeSelect.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'TreeSelect.LazyLoad': ['EU_SetTreeSelectLazyLoadCallback', 'TreeNodeEventCallback'],
  'TreeSelect.Drag': ['EU_SetTreeSelectDragCallback', 'TreeNodeEventCallback'],
  'TreeSelect.AllowDrag': ['EU_SetTreeSelectAllowDragCallback', 'TreeNodeAllowDragCallback'],
  'TreeSelect.AllowDrop': ['EU_SetTreeSelectAllowDropCallback', 'TreeNodeAllowDropCallback'],
  'DatePicker.DisabledDate': ['EU_SetDatePickerDisabledDateCallback', 'DateDisabledCallback'],
  'Transfer.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'Autocomplete.TextChanged': ['EU_SetElementTextChangeCallback', 'ElementClickCallback'],
  'Mentions.TextChanged': ['EU_SetElementTextChangeCallback', 'ElementClickCallback'],
  'Cascader.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'DatePicker.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'TimePicker.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'DateTimePicker.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'TimeSelect.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'Dropdown.Command': ['EU_SetDropdownCommandCallback', 'DropdownCommandCallback'],
  'Dropdown.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'Anchor.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'Segmented.SelectionChanged': ['EU_SetElementSelectionChangeCallback', 'ElementClickCallback'],
  'PageHeader.Clicked': ['EU_SetElementClickCallback', 'ElementClickCallback'],
  'Upload.FilesSelected': ['EU_SetUploadSelectCallback', 'ElementTextCallback'],
  'Upload.UploadAction': ['EU_SetUploadActionCallback', 'ElementValueCallback'],
  'Popover.ValueChanged': ['EU_SetPopoverActionCallback', 'ElementValueCallback'],
  'Popconfirm.ValueChanged': ['EU_SetPopconfirmResultCallback', 'ElementValueCallback'],
  'Omnibox.TextChanged': ['EU_SetOmniboxCommitCallback', 'ElementTextCallback'],
  'Omnibox.ValueChanged': ['EU_SetOmniboxIconButtonCallback', 'ElementValueCallback']
  ,'IconButton.Clicked': ['EU_SetElementClickCallback', 'ElementClickCallback']
};

function inferEventBindings(component, rawExports) {
  const available = new Set(rawExports.map(item => item.name));
  return (component.events || []).flatMap(event => {
    const binding = EVENT_BINDINGS[`${component.id}.${event.name}`] || COMMON_EVENT_BINDINGS[event.name];
    if (!binding || !available.has(binding[0])) return [];
    const aliases = newEmojiEventAliases(component.id, event.name);
    return [{ eventName: event.name, ...(aliases.length ? { aliases } : {}), command: binding[0], callbackType: binding[1], ...(binding[2] === undefined ? {} : { eventCode: binding[2] }) }];
  });
}

function inferPreviewType(type, isContainer) {
  if (/Tabs/u.test(type)) return 'TabControl';
  if (isContainer) return 'Grid';
  if (/Button|Upload/u.test(type)) return 'Button';
  if (/Input|Edit|Autocomplete|Mention|Cascader|Select/u.test(type)) return 'TextBox';
  if (/Checkbox/u.test(type)) return 'CheckBox';
  if (/Radio/u.test(type)) return 'RadioButton';
  if (/ListBox|Menu|Dropdown/u.test(type)) return 'ListBox';
  if (/Table|Descriptions/u.test(type)) return 'ListView';
  if (/Tree/u.test(type)) return 'TreeView';
  if (/Image|Avatar|Carousel|Rate/u.test(type)) return 'Image';
  if (/Progress|Slider/u.test(type)) return 'ProgressBar';
  return 'Label';
}

function parseBindingParameters(signature) {
  const match = signature.match(/^[^(（]+[（(](.*)[）)]/u);
  if (!match || !match[1].trim()) return [];
  return match[1].split(/[，,]/u).map(part => part.trim()).filter(Boolean).map(name => ({
    name,
    type: inferBindingParameterType(name)
  }));
}

function inferBindingParameterType(name) {
  if (/标题|文本|表情|内容|图片源|项目|^提示$|初始文件|文件类型/u.test(name)) return 'wideString';
  if (/句柄|hwnd|HWND/u.test(name)) return 'handle';
  if (/是否|允许|自动|显示|visible/u.test(name)) return 'bool';
  if (/bytes|len|指针|callback/u.test(name)) return 'raw';
  return 'int';
}

function mapBindingReturnType(returnType) {
  if (returnType === '空') return 'void';
  if (returnType === '窗口句柄') return 'handle';
  if (returnType === '文本型') return 'wideString';
  if (returnType === '逻辑型') return 'bool';
  if (returnType === '小数型') return 'double';
  return 'int';
}

function bridgeHeader() {
  return `#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

HWND NE_创建窗口(const wchar_t* title, int x, int y, int width, int height);
HWND NE_创建深色窗口(const wchar_t* title, int x, int y, int width, int height);
void NE_显示窗口(HWND hwnd, int visible);
void NE_显示并激活窗口(HWND hwnd);
int NE_运行消息循环();
void NE_销毁窗口(HWND hwnd);
int NE_创建容器(HWND hwnd, int parentId, int x, int y, int width, int height);
int NE_创建文本(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height);
int NE_创建按钮(HWND hwnd, int parentId, const wchar_t* emoji, const wchar_t* text, int x, int y, int width, int height);
int NE_创建编辑框(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height);
int NE_创建复选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height);
int NE_创建单选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height);
int NE_创建列表框(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* items, int selectedIndex, int x, int y, int width, int height);
int NE_创建图片(HWND hwnd, int parentId, const wchar_t* source, const wchar_t* alt, int fit, int x, int y, int width, int height);
int NE_创建进度条(HWND hwnd, int parentId, const wchar_t* text, int percentage, int x, int y, int width, int height);
int NE_创建上传(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* tip, const wchar_t* files, int x, int y, int width, int height);
void NE_设置上传选项(HWND hwnd, int elementId, int multiple, int autoUpload, int styleMode, int showFileList, int showTip, int showActions, int dropEnabled, int limit, int maxSizeKb, const wchar_t* accept);
int NE_打开上传文件选择(HWND hwnd, int elementId);
int NE_开始上传(HWND hwnd, int elementId, int fileIndex);
void NE_清空上传文件(HWND hwnd, int elementId);
int NE_取上传文件数量(HWND hwnd, int elementId);
using NE上传选择回调 = void (__stdcall *)(int elementId, const unsigned char* utf8, int length);
using NE上传操作回调 = void (__stdcall *)(int elementId, int action, int fileIndex, int value);
void NE_设置上传事件(HWND hwnd, int elementId, NE上传选择回调 selectCallback, NE上传操作回调 actionCallback);
const wchar_t* NE_取最近上传选择文件();
int NE_取最近上传动作();
int NE_取最近上传文件索引();
int NE_取最近上传进度值();
void NE_设置元素状态(HWND hwnd, int elementId, int visible, int enabled, unsigned int background, unsigned int foreground);
void NE_设置元素焦点(HWND hwnd, int elementId);
void NE_设置元素字体(HWND hwnd, int elementId, const wchar_t* fontFamily, int fontSize);
void NE_设置窗口标题(HWND hwnd, const wchar_t* title);
`;
}

function bridgeSource() {
  return `#include "new_emoji_bridge.h"
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

using NEColor = unsigned int;

__declspec(dllimport) HWND __stdcall EU_CreateWindow(const unsigned char* title_bytes, int title_len, int x, int y, int w, int h, NEColor titlebar_color);
__declspec(dllimport) HWND __stdcall EU_CreateWindowDark(const unsigned char* title_bytes, int title_len, int x, int y, int w, int h, NEColor titlebar_color);
__declspec(dllimport) void __stdcall EU_ShowWindow(HWND hwnd, int visible);
__declspec(dllimport) int __stdcall EU_RunMessageLoop();
__declspec(dllimport) void __stdcall EU_DestroyWindow(HWND hwnd);
__declspec(dllimport) int __stdcall EU_CreateContainer(HWND hwnd, int parent_id, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateText(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateButton(HWND hwnd, int parent_id, const unsigned char* emoji_bytes, int emoji_len, const unsigned char* text_bytes, int text_len, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateEditBox(HWND hwnd, int parent_id, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateCheckbox(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int checked, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateRadio(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int checked, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateListBox(HWND hwnd, int parent_id, const unsigned char* title_bytes, int title_len, const unsigned char* items_bytes, int items_len, int x, int y, int w, int h);
__declspec(dllimport) void __stdcall EU_SetListBoxSelectedIndex(HWND hwnd, int element_id, int index);
__declspec(dllimport) int __stdcall EU_CreateImage(HWND hwnd, int parent_id, const unsigned char* src_bytes, int src_len, const unsigned char* alt_bytes, int alt_len, int fit, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateProgress(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int percentage, int status, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateUpload(HWND hwnd, int parent_id, const unsigned char* title_bytes, int title_len, const unsigned char* tip_bytes, int tip_len, const unsigned char* files_bytes, int files_len, int x, int y, int w, int h);
__declspec(dllimport) void __stdcall EU_SetUploadOptions(HWND hwnd, int element_id, int multiple, int auto_upload);
__declspec(dllimport) void __stdcall EU_SetUploadStyle(HWND hwnd, int element_id, int style_mode, int show_file_list, int show_tip, int show_actions, int drop_enabled);
__declspec(dllimport) void __stdcall EU_SetUploadConstraints(HWND hwnd, int element_id, int limit, int max_size_kb, const unsigned char* accept_bytes, int accept_len);
__declspec(dllimport) int __stdcall EU_OpenUploadFileDialog(HWND hwnd, int element_id);
__declspec(dllimport) int __stdcall EU_StartUpload(HWND hwnd, int element_id, int file_index);
__declspec(dllimport) void __stdcall EU_ClearUploadFiles(HWND hwnd, int element_id);
__declspec(dllimport) int __stdcall EU_GetUploadFileCount(HWND hwnd, int element_id);
using NEElementTextCallback = void (__stdcall *)(int, const unsigned char*, int);
using NEElementValueCallback = void (__stdcall *)(int, int, int, int);
__declspec(dllimport) void __stdcall EU_SetUploadSelectCallback(HWND hwnd, int element_id, NEElementTextCallback cb);
__declspec(dllimport) void __stdcall EU_SetUploadActionCallback(HWND hwnd, int element_id, NEElementValueCallback cb);
__declspec(dllimport) void __stdcall EU_SetElementText(HWND hwnd, int element_id, const unsigned char* bytes, int len);
__declspec(dllimport) void __stdcall EU_SetElementVisible(HWND hwnd, int element_id, int visible);
__declspec(dllimport) void __stdcall EU_SetElementEnabled(HWND hwnd, int element_id, int enabled);
__declspec(dllimport) void __stdcall EU_SetElementColor(HWND hwnd, int element_id, NEColor background, NEColor foreground);
__declspec(dllimport) void __stdcall EU_SetElementFocus(HWND hwnd, int element_id);
__declspec(dllimport) void __stdcall EU_SetElementFontInt(HWND hwnd, int element_id, const unsigned char* font_bytes, int font_len, int size);
__declspec(dllimport) void __stdcall EU_SetWindowTitle(HWND hwnd, const unsigned char* bytes, int len);

static std::vector<std::unique_ptr<std::string>>& NE_Utf8Pool() {
    static auto* pool = new std::vector<std::unique_ptr<std::string>>();
    return *pool;
}

static const std::string& NE_KeepUtf8(const wchar_t* text) {
    auto& pool = NE_Utf8Pool();
    if (!text) {
        pool.push_back(std::make_unique<std::string>());
        return *pool.back();
    }
    int needed = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
    if (needed <= 1) {
        pool.push_back(std::make_unique<std::string>());
        return *pool.back();
    }
    std::string bytes(static_cast<size_t>(needed), '\\0');
    WideCharToMultiByte(CP_UTF8, 0, text, -1, bytes.data(), needed, nullptr, nullptr);
    bytes.pop_back();
    pool.push_back(std::make_unique<std::string>(std::move(bytes)));
    return *pool.back();
}

struct NEUploadCallbacks { NE上传选择回调 select = nullptr; NE上传操作回调 action = nullptr; };
static std::unordered_map<int, NEUploadCallbacks> g_neUploadCallbacks;
static std::wstring g_neLastUploadFiles;
static int g_neLastUploadAction = 0;
static int g_neLastUploadIndex = -1;
static int g_neLastUploadValue = 0;

static std::wstring NE_FromUtf8(const unsigned char* bytes, int length) {
    if (!bytes || length <= 0) return {};
    int needed = MultiByteToWideChar(CP_UTF8, 0, reinterpret_cast<const char*>(bytes), length, nullptr, 0);
    if (needed <= 0) return {};
    std::wstring result(static_cast<size_t>(needed), L'\\0');
    MultiByteToWideChar(CP_UTF8, 0, reinterpret_cast<const char*>(bytes), length, result.data(), needed);
    return result;
}

static void __stdcall NE_UploadSelectDispatch(int elementId, const unsigned char* utf8, int length) {
    g_neLastUploadFiles = NE_FromUtf8(utf8, length);
    auto found = g_neUploadCallbacks.find(elementId);
    if (found != g_neUploadCallbacks.end() && found->second.select) found->second.select(elementId, utf8, length);
}

static void __stdcall NE_UploadActionDispatch(int elementId, int action, int fileIndex, int value) {
    g_neLastUploadAction = action;
    g_neLastUploadIndex = fileIndex;
    g_neLastUploadValue = value;
    auto found = g_neUploadCallbacks.find(elementId);
    if (found != g_neUploadCallbacks.end() && found->second.action) found->second.action(elementId, action, fileIndex, value);
}

HWND NE_创建窗口(const wchar_t* title, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    HWND hwnd = EU_CreateWindow(reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), x, y, width, height, 0xFF202020);
    if (hwnd) EU_ShowWindow(hwnd, 1);
    return hwnd;
}

HWND NE_创建深色窗口(const wchar_t* title, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    HWND hwnd = EU_CreateWindowDark(reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), x, y, width, height, 0xFF202020);
    if (hwnd) EU_ShowWindow(hwnd, 1);
    return hwnd;
}

void NE_显示窗口(HWND hwnd, int visible) {
    EU_ShowWindow(hwnd, visible);
}

void NE_显示并激活窗口(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return;

    HWND foregroundWindow = GetForegroundWindow();
    DWORD currentThreadId = GetCurrentThreadId();
    DWORD foregroundThreadId = foregroundWindow
        ? GetWindowThreadProcessId(foregroundWindow, nullptr)
        : 0;
    BOOL inputAttached = foregroundThreadId != 0
        && foregroundThreadId != currentThreadId
        && AttachThreadInput(currentThreadId, foregroundThreadId, TRUE);

    ShowWindow(hwnd, IsIconic(hwnd) ? SW_RESTORE : SW_SHOW);
    UpdateWindow(hwnd);

    // 只短暂提升到最上层，确保由 IDE/F5 后台进程启动时窗口也能进入可见层级；
    // 随即还原普通窗口层级，避免应用长期保持“总在最前”。
    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW);
    SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    SetActiveWindow(hwnd);
    SetFocus(hwnd);

    if (inputAttached) {
        AttachThreadInput(currentThreadId, foregroundThreadId, FALSE);
    }
}

int NE_运行消息循环() {
    return EU_RunMessageLoop();
}

void NE_销毁窗口(HWND hwnd) {
    EU_DestroyWindow(hwnd);
}

int NE_创建容器(HWND hwnd, int parentId, int x, int y, int width, int height) {
    return EU_CreateContainer(hwnd, parentId, x, y, width, height);
}

int NE_创建文本(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateText(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), x, y, width, height);
}

int NE_创建按钮(HWND hwnd, int parentId, const wchar_t* emoji, const wchar_t* text, int x, int y, int width, int height) {
    const std::string& emojiBytes = NE_KeepUtf8(emoji);
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateButton(hwnd, parentId, reinterpret_cast<const unsigned char*>(emojiBytes.c_str()), static_cast<int>(emojiBytes.size()), reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), x, y, width, height);
}

int NE_创建编辑框(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height) {
    int elementId = EU_CreateEditBox(hwnd, parentId, x, y, width, height);
    const std::string& textBytes = NE_KeepUtf8(text);
    if (elementId > 0 && !textBytes.empty()) EU_SetElementText(hwnd, elementId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()));
    return elementId;
}

int NE_创建复选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateCheckbox(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), checked, x, y, width, height);
}

int NE_创建单选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateRadio(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), checked, x, y, width, height);
}

int NE_创建列表框(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* items, int selectedIndex, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    const std::string& itemBytes = NE_KeepUtf8(items);
    int elementId = EU_CreateListBox(hwnd, parentId, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), reinterpret_cast<const unsigned char*>(itemBytes.c_str()), static_cast<int>(itemBytes.size()), x, y, width, height);
    if (elementId > 0 && selectedIndex >= 0) EU_SetListBoxSelectedIndex(hwnd, elementId, selectedIndex);
    return elementId;
}

int NE_创建图片(HWND hwnd, int parentId, const wchar_t* source, const wchar_t* alt, int fit, int x, int y, int width, int height) {
    const std::string& sourceBytes = NE_KeepUtf8(source);
    const std::string& altBytes = NE_KeepUtf8(alt);
    return EU_CreateImage(hwnd, parentId, reinterpret_cast<const unsigned char*>(sourceBytes.c_str()), static_cast<int>(sourceBytes.size()), reinterpret_cast<const unsigned char*>(altBytes.c_str()), static_cast<int>(altBytes.size()), fit, x, y, width, height);
}

int NE_创建进度条(HWND hwnd, int parentId, const wchar_t* text, int percentage, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateProgress(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), percentage, 0, x, y, width, height);
}

int NE_创建上传(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* tip, const wchar_t* files, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    const std::string& tipBytes = NE_KeepUtf8(tip);
    const std::string& fileBytes = NE_KeepUtf8(files);
    return EU_CreateUpload(hwnd, parentId, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), reinterpret_cast<const unsigned char*>(tipBytes.c_str()), static_cast<int>(tipBytes.size()), reinterpret_cast<const unsigned char*>(fileBytes.c_str()), static_cast<int>(fileBytes.size()), x, y, width, height);
}

void NE_设置上传选项(HWND hwnd, int elementId, int multiple, int autoUpload, int styleMode, int showFileList, int showTip, int showActions, int dropEnabled, int limit, int maxSizeKb, const wchar_t* accept) {
    if (elementId <= 0) return;
    const std::string& acceptBytes = NE_KeepUtf8(accept);
    EU_SetUploadOptions(hwnd, elementId, multiple, autoUpload);
    EU_SetUploadStyle(hwnd, elementId, styleMode, showFileList, showTip, showActions, dropEnabled);
    EU_SetUploadConstraints(hwnd, elementId, limit, maxSizeKb, reinterpret_cast<const unsigned char*>(acceptBytes.c_str()), static_cast<int>(acceptBytes.size()));
}

int NE_打开上传文件选择(HWND hwnd, int elementId) { return EU_OpenUploadFileDialog(hwnd, elementId); }
int NE_开始上传(HWND hwnd, int elementId, int fileIndex) { return EU_StartUpload(hwnd, elementId, fileIndex); }
void NE_清空上传文件(HWND hwnd, int elementId) { EU_ClearUploadFiles(hwnd, elementId); }
int NE_取上传文件数量(HWND hwnd, int elementId) { return EU_GetUploadFileCount(hwnd, elementId); }

void NE_设置上传事件(HWND hwnd, int elementId, NE上传选择回调 selectCallback, NE上传操作回调 actionCallback) {
    if (elementId <= 0) return;
    g_neUploadCallbacks[elementId] = { selectCallback, actionCallback };
    EU_SetUploadSelectCallback(hwnd, elementId, NE_UploadSelectDispatch);
    EU_SetUploadActionCallback(hwnd, elementId, NE_UploadActionDispatch);
}

const wchar_t* NE_取最近上传选择文件() { return g_neLastUploadFiles.c_str(); }
int NE_取最近上传动作() { return g_neLastUploadAction; }
int NE_取最近上传文件索引() { return g_neLastUploadIndex; }
int NE_取最近上传进度值() { return g_neLastUploadValue; }

void NE_设置元素状态(HWND hwnd, int elementId, int visible, int enabled, unsigned int background, unsigned int foreground) {
    if (elementId <= 0) return;
    EU_SetElementVisible(hwnd, elementId, visible);
    EU_SetElementEnabled(hwnd, elementId, enabled);
    EU_SetElementColor(hwnd, elementId, background, foreground);
}

void NE_设置元素焦点(HWND hwnd, int elementId) {
    if (!hwnd || elementId <= 0) return;
    EU_SetElementFocus(hwnd, elementId);
}

void NE_设置元素字体(HWND hwnd, int elementId, const wchar_t* fontFamily, int fontSize) {
    if (!hwnd || elementId <= 0) return;
    const std::string& fontBytes = NE_KeepUtf8(fontFamily && fontFamily[0] ? fontFamily : L"Microsoft YaHei UI");
    EU_SetElementFontInt(hwnd, elementId, reinterpret_cast<const unsigned char*>(fontBytes.c_str()), static_cast<int>(fontBytes.size()), fontSize > 0 ? fontSize : 12);
}

void NE_设置窗口标题(HWND hwnd, const wchar_t* title) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    EU_SetWindowTitle(hwnd, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()));
}
`;
}

function moduleReadme(exportCount) {
  return `# new_emoji 原生界面库模块

该模块由 LingBuilder 脚本从 new_emoji 工程生成，打包 Win32/x64 DLL 与导入库。

设计器图标的“缩放”属性使用百分比（100 表示原始大小），生成器会按 EU_SetIconOptions ABI 要求转换为倍率（1.0）。直接调用底层 API 时，scale 仍使用倍率。

- 模块 ID：${MODULE_ID}
- 导出 API 数：${exportCount}
- 默认 F5 预览平台：Win32
- 当前 .lib 导入库需要 MSVC/Visual Studio Build Tools 链接

推荐在 .lcpp 中优先使用 NE_ 前缀的中文桥接命令；NE_EU_* 命令是底层高级入口，参数仍遵循 new_emoji DLL 的 UTF-8 字节指针和长度规则。Tabs 的“显示标签页表头”属性对应 EU_SetTabsHeaderVisible，关闭后内容区占满标签页区域。
`;
}

function mapReturnType(cType) {
  if (cType === 'void') return '空';
  if (cType === 'HWND') return '窗口句柄';
  if (cType === 'int') return '整数型';
  if (cType === 'Color' || cType === 'unsigned int') return '整数型';
  if (cType === 'float') return '小数型';
  return '整数型';
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) await copyFile(sourcePath, targetPath);
  }
}

async function compressArchive(sourceDir, targetPath) {
  const tempZipPath = `${targetPath}.zip`;
  await fs.rm(tempZipPath, { force: true });
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path ${quotePs(path.join(sourceDir, '*'))} -DestinationPath ${quotePs(tempZipPath)} -Force`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await fs.rename(tempZipPath, targetPath);
}

function quotePs(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
