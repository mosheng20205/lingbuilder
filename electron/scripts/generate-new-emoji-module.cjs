const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');

const execFileAsync = promisify(execFile);

const MODULE_ID = 'lingbuilder.new_emoji.ui';
const MODULE_NAME = 'new_emoji 原生界面库';
const DEFAULT_SOURCE = 'T:\\github\\new_emoji';
const EXPECTED_DESIGNER_COMPONENT_COUNT = 93;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = __dirname;
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.NEW_EMOJI_ROOT || DEFAULT_SOURCE);
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const installPath = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'new_emoji.lbmod');
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-new-emoji-module-'));
  const generatedRoot = path.join(tempRoot, MODULE_ID);

  try {
    await assertNewEmojiSource(sourceRoot);
    await fs.mkdir(generatedRoot, { recursive: true });

    const exports = await parseExports(path.join(sourceRoot, 'src', 'new_emoji.def'));
    const prototypes = await parsePrototypes(path.join(sourceRoot, 'src', 'exports.h'));
    const callbackTypes = await parseCallbackTypedefs(path.join(sourceRoot, 'src', 'element_types.h'));
    const apiManifest = await readJson(path.join(sourceRoot, 'docs', 'ai', 'api_manifest.full.json'), []);
    const { catalog: designerCatalog, source: designerCatalogSource } = await loadDesignerCatalog(sourceRoot, exports, prototypes);
    const commands = buildCommands(exports, prototypes, apiManifest, callbackTypes);

    const designerCatalogSha256 = crypto.createHash('sha256').update(designerCatalogSource).digest('hex');
    const manifest = buildManifest(commands, designerCatalog, designerCatalogSha256);
    validateGeneratedCallbackBindings(manifest, commands);
    await writeText(path.join(generatedRoot, 'lingbuilder.module.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeText(path.join(generatedRoot, 'include', 'new_emoji_bridge.h'), bridgeHeader());
    await writeText(path.join(generatedRoot, 'src', 'new_emoji_bridge.cpp'), bridgeSource());
    await copyFile(path.join(sourceRoot, 'src', 'exports.h'), path.join(generatedRoot, 'include', 'exports.h'));
    await copyFile(path.join(sourceRoot, 'src', 'element_types.h'), path.join(generatedRoot, 'include', 'element_types.h'));
    await writeText(path.join(generatedRoot, 'docs', 'lingbuilder-designer-catalog.json'), designerCatalogSource.endsWith('\n') ? designerCatalogSource : `${designerCatalogSource}\n`);
    await copyFile(path.join(sourceRoot, 'docs', 'components', 'rich-list.md'), path.join(generatedRoot, 'docs', 'rich-list.md'));
    await copyFile(path.join(sourceRoot, 'docs', 'components', 'window-frame.md'), path.join(generatedRoot, 'docs', 'window-frame.md'));
    await writeText(path.join(generatedRoot, 'docs', 'new_emoji-api.json'), JSON.stringify({
      source: 'new_emoji upstream headers and AI manifests',
      exportCount: exports.length,
      commands
    }, null, 2) + '\n');
    await writeText(path.join(generatedRoot, 'README.md'), moduleReadme(exports.length));

    await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.dll'), path.join(generatedRoot, 'bin', 'Win32', 'new_emoji.dll'));
    await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.lib'), path.join(generatedRoot, 'lib', 'Win32', 'new_emoji.lib'));
    await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.dll'), path.join(generatedRoot, 'bin', 'x64', 'new_emoji.dll'));
    await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.lib'), path.join(generatedRoot, 'lib', 'x64', 'new_emoji.lib'));
    await copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'), path.join(generatedRoot, 'assets', 'lingbuilder-newemoji-window.ico'));
    await copyFile(path.join(sourceRoot, 'LICENSE'), path.join(generatedRoot, 'LICENSE'));

    if (args.check) {
      await assertDirectoryMatches(generatedRoot, workRoot, 'module-build');
      await assertDirectoryMatches(generatedRoot, installPath, 'installed module');
      await assertPackageMatches(generatedRoot, packagePath, tempRoot);
      console.log(`Verified ${MODULE_ID}: module-build, installed module and package are identical.`);
    } else {
      await replaceDirectoryAtomically(generatedRoot, workRoot);
      await fs.mkdir(packageDir, { recursive: true });
      const tempPackage = path.join(tempRoot, 'new_emoji.lbmod');
      await compressArchive(workRoot, tempPackage);
      await replaceFileAtomically(tempPackage, packagePath);

      if (args.install) {
        const installTemp = path.join(tempRoot, `${MODULE_ID}-install`);
        await copyDirectory(workRoot, installTemp);
        await replaceDirectoryAtomically(installTemp, installPath);
        console.log(`Installed ${MODULE_ID} to ${installPath}`);
        console.log('Project module references were left unchanged.');
      }

      console.log(`Generated ${MODULE_NAME}`);
      console.log(`Module directory: ${workRoot}`);
      console.log(`Package: ${packagePath}`);
      console.log(`Command count: ${commands.length}`);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function validateDesignerCatalog(catalog, exports, prototypes) {
  if (catalog?.schemaVersion !== 1 || catalog?.moduleId !== MODULE_ID) throw new Error('new_emoji LingBuilder Designer Catalog 版本或模块 ID 无效。');
  if (!Array.isArray(catalog.components) || catalog.components.length !== EXPECTED_DESIGNER_COMPONENT_COUNT) throw new Error(`new_emoji 组件目录必须包含 ${EXPECTED_DESIGNER_COMPONENT_COUNT} 个组件，实际 ${catalog?.components?.length || 0}。`);
  if (!Array.isArray(catalog.rawExports) || catalog.rawExports.length !== exports.length) throw new Error(`new_emoji 导出目录数量与 .def 不一致：${catalog?.rawExports?.length || 0}/${exports.length}。`);
  const catalogExports = new Set(catalog.rawExports.map(item => item.name));
  const missing = exports.filter(name => !catalogExports.has(name) || !prototypes.has(name));
  if (missing.length) throw new Error(`new_emoji 存在未分类或无声明导出：${missing.slice(0, 20).join(', ')}`);
}

async function loadDesignerCatalog(sourceRoot, exports, prototypes) {
  const catalogPath = path.join(sourceRoot, 'docs', 'ai', 'lingbuilder_designer_catalog.json');
  const source = await fs.readFile(catalogPath, 'utf8');
  const catalog = JSON.parse(source);
  try {
    validateDesignerCatalog(catalog, exports, prototypes);
    return { catalog, source: normalizeDesignerCatalogSource(catalog) };
  } catch (catalogError) {
    const exporterProject = path.join(sourceRoot, 'tools', 'LingBuilderCatalogExporter', 'LingBuilderCatalogExporter.csproj');
    try {
      await fs.stat(exporterProject);
    } catch {
      throw catalogError;
    }

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-new-emoji-catalog-'));
    const generatedPath = path.join(tempRoot, 'lingbuilder_designer_catalog.json');
    try {
      console.log(`Designer Catalog 已过期，正在从上游元数据重新生成：${catalogError.message}`);
      await execFileAsync('dotnet', [
        'run', '--project', exporterProject, '-f', 'net48', '--no-restore', '--', sourceRoot, generatedPath
      ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
      const generatedSource = await fs.readFile(generatedPath, 'utf8');
      const generatedCatalog = JSON.parse(generatedSource);
      validateDesignerCatalog(generatedCatalog, exports, prototypes);
      return { catalog: generatedCatalog, source: normalizeDesignerCatalogSource(generatedCatalog) };
    } catch (error) {
      throw new Error(`${catalogError.message}\n自动重新生成 Designer Catalog 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
}

function normalizeDesignerCatalogSource(catalog) {
  const stableCatalog = structuredClone(catalog);
  delete stableCatalog.generatedAt;
  return `${JSON.stringify(stableCatalog, null, 2)}\n`;
}

function parseArgs(args) {
  const result = { install: false, check: false, source: '' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--install') result.install = true;
    if (arg === '--check') result.check = true;
    if (arg === '--source') result.source = args[index + 1] || '';
  }
  if (result.check && result.install) throw new Error('--check 与 --install 不能同时使用。');
  return result;
}

async function assertNewEmojiSource(sourceRoot) {
  const required = [
    'src/new_emoji.def',
    'src/exports.h',
    'src/element_types.h',
    'docs/ai/api_manifest.full.json',
    'docs/components/rich-list.md',
    'docs/components/window-frame.md',
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

async function parseCallbackTypedefs(elementTypesPath) {
  const text = await fs.readFile(elementTypesPath, 'utf8');
  const pattern = /typedef\s+(.+?)\s*\(\s*__stdcall\s*\*\s*(\w+)\s*\)\s*\((.*?)\)\s*;/gsu;
  const callbacks = new Map();
  let match;
  while ((match = pattern.exec(text))) {
    callbacks.set(match[2], {
      returnType: normalizeSpace(match[1]),
      params: splitParams(match[3]).map(parseParam)
    });
  }
  if (!callbacks.has('WindowResizeCallback') || !callbacks.has('WindowCloseCallback')) {
    throw new Error('new_emoji element_types.h 缺少窗口回调 typedef。');
  }
  return callbacks;
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

function buildCommands(exports, prototypes, apiManifest, callbackTypes) {
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
    const nativeParameters = prototype.params.map(parameter => {
      const callback = callbackTypes.get(parameter.type);
      return callback ? { ...parameter, callbackSignature: callback } : parameter;
    });
    commands.push({
      name,
      signature: `${name}(${prototype.params.map(param => param.name).join(', ')})`,
      description: `${MODULE_NAME} 底层导出 ${exportName}。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。`,
      insertText: `${name}(${prototype.params.map((_, index) => `$${index + 1}`).join(', ')})`,
      returnType: mapReturnType(prototype.returnType),
      runtimeName: exportName,
      nativeParameters,
      visibility: 'advanced'
    });
  }

  return commands;
}

function bridgeCommands() {
  return [
    ['NE_创建窗口', 'NE_创建窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 原生窗口。', '窗口句柄'],
    ['NE_创建深色窗口', 'NE_创建深色窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 深色原生窗口。', '窗口句柄'],
    ['NE_创建浏览器外壳窗口', 'NE_创建浏览器外壳窗口(标题, X, Y, 宽度, 高度)', '使用 0x3F 浏览器框架预设创建无系统标题栏窗口。', '窗口句柄'],
    ['NE_创建自定义框架窗口', 'NE_创建自定义框架窗口(标题, X, Y, 宽度, 高度, 框架标志)', '使用精确 frame flags 创建 new_emoji 窗口。', '窗口句柄'],
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
    ['NE_设置表格虚拟行数据', 'NE_设置表格虚拟行数据(行数据)', '在 Table 的 VirtualRow 同步事件中设置本次返回的 UTF-8 高级行协议文本。', '空'],
    ['NE_设置窗口标题', 'NE_设置窗口标题(窗口句柄, 标题)', '设置 new_emoji 窗口标题。', '空']
    ,['NE_设置窗口缩放边框', 'NE_设置窗口缩放边框(窗口句柄, 左, 上, 右, 下)', '设置无边框窗口四边缩放命中尺寸。', '空']
    ,['NE_清空窗口拖拽区', 'NE_清空窗口拖拽区(窗口句柄)', '清空窗口全部自定义拖拽区域。', '空']
    ,['NE_设置窗口拖拽区', 'NE_设置窗口拖拽区(窗口句柄, X, Y, 宽度, 高度, 是否启用)', '添加或移除窗口自定义拖拽区域。', '空']
    ,['NE_清空窗口非拖拽区', 'NE_清空窗口非拖拽区(窗口句柄)', '清空窗口全部交互排除区域。', '空']
    ,['NE_设置窗口非拖拽区', 'NE_设置窗口非拖拽区(窗口句柄, X, Y, 宽度, 高度, 是否启用)', '添加或移除窗口交互排除区域。', '空']
    ,['NE_设置元素窗口命令', 'NE_设置元素窗口命令(窗口句柄, 元素ID, 命令)', '把元素点击映射为最小化、最大化/还原或关闭。', '空']
    ,['NE_设置窗口圆角', 'NE_设置窗口圆角(窗口句柄, 是否启用, 半径)', '设置窗口圆角和逻辑像素半径。', '空']
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
  const designerControls = newEmojiDesignerControls(designerCatalog);
  const runtimeCatalog = buildNewEmojiRuntimeControlCatalog(designerControls);
  const controlBindingContext = buildNewEmojiControlBindingContext(designerControls);
  const portableControlCommands = buildPortableControlCommands();
  const dataBridgeCommands = newEmojiDataBridgeCommands(designerControls);
  const propertyBridgeCommands = newEmojiPropertyBridgeCommands(designerControls, new Set(commands.map(command => command.name)));
  for (const item of propertyBridgeCommands) {
    const owner = designerControls.find(item2 => item2.type === item.propertyCommand.type);
    if (!owner) throw new Error(`属性命令 ${item.command.name} 找不到控件类型 ${item.propertyCommand.type}`);
    if (!owner.runtime.propertyBridgeCommands) owner.runtime.propertyBridgeCommands = [];
    owner.runtime.propertyBridgeCommands.push(item.propertyCommand);
  }
  const commandContributions = [
    ...commands.map(({ runtimeName, nativeParameters, ...command }) => command),
    ...portableControlCommands.map(item => item.command),
    ...dataBridgeCommands.map(item => item.command),
    ...propertyBridgeCommands.map(item => item.command),
    {
      name: '控件_是否有效',
      signature: '控件_是否有效(控件)',
      description: '判断 new_emoji 类型化控件引用是否仍指向当前窗口内存活的元素。',
      insertText: '控件_是否有效($1)',
      returnType: '逻辑型'
    },
    ...runtimeCatalog.flatMap(item => item.commands)
  ];
  const bindings = [...commands.map(command => {
    const runtimeName = command.runtimeName || command.name;
    return {
      command: command.name,
      runtimeName,
      parameters: parseBindingParameters(command.signature).map((parameter, index) => normalizeNewEmojiControlBindingParameter(
        parameter,
        runtimeName,
        command.nativeParameters?.[index],
        controlBindingContext
      )),
      returnType: mapBindingReturnType(command.returnType),
      encoding: command.name.startsWith('NE_EU_') ? 'raw' : 'wide',
      example: command.insertText || command.signature
    };
  }), ...portableControlCommands.map(item => item.binding), ...dataBridgeCommands.map(item => item.binding), ...propertyBridgeCommands.map(item => item.binding), {
    command: '控件_是否有效',
    runtimeName: '控件_是否有效',
    parameters: [{
      name: '控件', type: 'controlRef', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId'
    }],
    returnType: 'bool'
  }, ...runtimeCatalog.flatMap(item => item.bindings)];
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: MODULE_NAME,
    version: '2.0.0',
    minLingBuilderVersion: '0.3.0',
    category: '界面',
    description: '集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL，提供中文/emoji 友好的原生控件能力。',
    author: 'new_emoji contributors / LingBuilder',
    license: 'MIT',
    tags: ['界面', 'Direct2D', 'DirectWrite', 'emoji', 'Windows', '原生控件'],
    contributes: {
      commands: commandContributions,
      designerControls,
      types: [
        { name: 'NE窗口句柄', description: 'new_emoji 原生窗口句柄。', cppType: 'HWND' },
        { name: 'NE元素ID', description: 'new_emoji Element 元素编号。', cppType: 'int' },
        ...runtimeCatalog.map(item => ({
          name: item.contract.lingCppType,
          description: `new_emoji ${item.control.label}的非拥有型运行时控件引用。`,
          cppType: 'LingControlRef'
        }))
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
        { title: 'RichList 富列表', path: 'docs/rich-list.md' },
        { title: '窗口框架与浏览器外壳', path: 'docs/window-frame.md' },
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
    }
  };
}

function buildNewEmojiControlBindingContext(designerControls) {
  const controlTypesByCommand = new Map();
  const add = (command, controlType) => {
    if (!command || !controlType) return;
    const types = controlTypesByCommand.get(command) || new Set();
    types.add(controlType);
    controlTypesByCommand.set(command, types);
  };
  for (const control of designerControls.filter(item => item.isVisual !== false)) {
    const controlType = control.namespacedType;
    add(control.runtime?.createCommand, controlType);
    for (const setter of control.runtime?.propertySetters || []) add(setter.command, controlType);
    for (const event of control.runtime?.eventBindings || []) add(event.command, controlType);
  }
  return {
    designerControls,
    controlTypesByCommand,
    containerTypes: designerControls
      .filter(control => control.isVisual !== false && control.isContainer === true)
      .map(control => control.namespacedType)
  };
}

const NEW_EMOJI_SINGLE_CONTROL_ID_PARAMETERS = new Set([
  'element_id', 'parent_id', 'container_id', 'target_element_id', 'popup_id', 'anchor_element_id',
  'child_id', 'layout_id', 'dropdown_element_id', 'submenu_element_id', 'target_container_id',
  'loading_id', 'primary_id', '元素ID', '父元素ID'
]);

// 官方 ABI 语义为「任意可视元素」的通用命令：element_id 不允许按注册组件收窄，
// 否则 .lcpp 侧对文本/按钮等控件设色会被 controlRef 门禁误拦（component_gallery 实测）。
const NEW_EMOJI_UNIVERSAL_ELEMENT_COMMANDS = new Set(['EU_SetElementColor']);

function normalizeNewEmojiControlBindingParameter(parameter, runtimeName, nativeParameter, context) {
  if (nativeParameter?.callbackSignature) {
    return {
      name: parameter.name,
      type: 'handler',
      description: `new_emoji ${nativeParameter.type} 回调处理器，源码必须使用 &处理器名。`,
      handlerSignature: toLingCppHandlerSignature(nativeParameter.callbackSignature)
    };
  }
  if (!NEW_EMOJI_SINGLE_CONTROL_ID_PARAMETERS.has(parameter.name)) return parameter;
  if (nativeParameter?.type?.includes('*')) return parameter;

  let controlTypes;
  if (parameter.name === 'parent_id' || parameter.name === '父元素ID' || parameter.name === 'target_container_id') {
    controlTypes = context.containerTypes;
  } else if (parameter.name === 'element_id') {
    controlTypes = NEW_EMOJI_UNIVERSAL_ELEMENT_COMMANDS.has(runtimeName.replace(/^NE_EU_/u, ''))
      ? context.designerControls.filter(control => control.isVisual !== false).map(control => control.namespacedType)
      : [...(context.controlTypesByCommand.get(runtimeName) || inferNewEmojiCommandControlTypes(runtimeName, context.designerControls))];
  } else if (parameter.name === '元素ID' && /上传/u.test(runtimeName)) {
    controlTypes = context.designerControls.filter(control => control.type === 'Upload').map(control => control.namespacedType);
  } else {
    const typeByParameter = {
      layout_id: 'Layout',
      dropdown_element_id: 'Dropdown',
      submenu_element_id: 'Menu',
      loading_id: 'Loading'
    };
    const expectedType = typeByParameter[parameter.name];
    controlTypes = expectedType
      ? context.designerControls.filter(control => control.type === expectedType).map(control => control.namespacedType)
      : [];
  }

  return {
    name: parameter.name,
    type: 'controlRef',
    ...(controlTypes?.length ? { controlTypes } : {}),
    controlKinds: ['visual'],
    scope: 'currentWindow',
    runtimeRepresentation: 'stableId'
  };
}

function toLingCppHandlerSignature(callback) {
  const parameterTypes = [];
  for (let index = 0; index < callback.params.length; index += 1) {
    const parameter = callback.params[index];
    const next = callback.params[index + 1];
    if (/unsigned char\s*\*/u.test(parameter.type)) {
      parameterTypes.push('文本型');
      if (next && next.type === 'int' && /len|length|size/u.test(next.name)) index += 1;
      continue;
    }
    if (/wchar_t\s*\*/u.test(parameter.type)) {
      parameterTypes.push('文本型');
      continue;
    }
    if (parameter.type === 'HWND') parameterTypes.push('NE窗口句柄');
    else if (parameter.type === 'float' || parameter.type === 'double') parameterTypes.push('小数型');
    else if (/long long|int64|uint64/u.test(parameter.type)) parameterTypes.push('长整数型');
    else parameterTypes.push('整数型');
  }
  return {
    parameterTypes,
    returnType: callback.returnType === 'void' ? '空' : callback.returnType === 'float' || callback.returnType === 'double' ? '小数型' : '整数型'
  };
}

function validateGeneratedCallbackBindings(manifest, commands) {
  const nativeCallbackCommands = new Map(commands
    .filter(command => command.nativeParameters?.some(parameter => parameter.callbackSignature))
    .map(command => [command.name, command]));
  const bindings = new Map((manifest.bindings?.commands || []).map(binding => [binding.command, binding]));
  const invalid = [];
  for (const [name, command] of nativeCallbackCommands) {
    const binding = bindings.get(name);
    const callbackIndexes = command.nativeParameters
      .map((parameter, index) => parameter.callbackSignature ? index : -1)
      .filter(index => index >= 0);
    if (!binding || callbackIndexes.some(index => binding.parameters?.[index]?.type !== 'handler' || !binding.parameters?.[index]?.handlerSignature)) {
      invalid.push(name);
    }
  }
  if (invalid.length) throw new Error(`new_emoji 回调 binding 未声明为 handler：${invalid.slice(0, 20).join(', ')}`);
}

function inferNewEmojiCommandControlTypes(runtimeName, designerControls) {
  if (!runtimeName.startsWith('EU_') || /Element/u.test(runtimeName)) return [];
  const matching = designerControls
    .filter(control => control.isVisual !== false && runtimeName.includes(control.type))
    .sort((left, right) => right.type.length - left.type.length);
  if (!matching.length) return [];
  const longest = matching[0].type.length;
  return matching.filter(control => control.type.length === longest).map(control => control.namespacedType);
}

function buildPortableControlCommands() {
  const specs = [
    ['控件_取文本', '控件_取文本(控件)', '读取控件当前文本。', '文本型', [], 'wideString'],
    ['控件_设置文本', '控件_设置文本(控件, 文本)', '设置控件文本。', '逻辑型', [['文本', 'wideString']], 'bool'],
    ['控件_设置图片', '控件_设置图片(控件, 图片路径)', '设置图片控件的本地图片路径。', '逻辑型', [['图片路径', 'wideString']], 'bool'],
    ['控件_设置启用', '控件_设置启用(控件, 启用)', '启用或禁用控件。', '逻辑型', [['启用', 'bool']], 'bool'],
    ['控件_设置可见', '控件_设置可见(控件, 可见)', '显示或隐藏控件。', '逻辑型', [['可见', 'bool']], 'bool'],
    ['控件_设置位置大小', '控件_设置位置大小(控件, 横坐标, 纵坐标, 宽度, 高度)', '设置控件的位置和尺寸。', '逻辑型', [['横坐标', 'int'], ['纵坐标', 'int'], ['宽度', 'int'], ['高度', 'int']], 'bool'],
    ['控件_设置勾选', '控件_设置勾选(控件, 勾选)', '设置支持勾选状态的控件。', '逻辑型', [['勾选', 'bool']], 'bool'],
    ['控件_取勾选', '控件_取勾选(控件)', '读取控件勾选状态。', '逻辑型', [], 'bool'],
    ['控件_设置数值', '控件_设置数值(控件, 数值)', '设置数值型控件的当前值。', '逻辑型', [['数值', 'int']], 'bool'],
    ['控件_取数值', '控件_取数值(控件)', '读取数值型控件的当前值。', '整数型', [], 'int'],
    ['控件_设置选择项', '控件_设置选择项(控件, 索引)', '设置选择型控件的当前项。', '逻辑型', [['索引', 'int']], 'bool'],
    ['控件_取选择项', '控件_取选择项(控件)', '读取选择型控件的当前项。', '整数型', [], 'int'],
    ['控件_添加项目', '控件_添加项目(控件, 文本)', '向支持的集合控件添加项目。', '整数型', [['文本', 'wideString']], 'int'],
    ['控件_清空项目', '控件_清空项目(控件)', '清空支持的集合控件项目。', '逻辑型', [], 'bool']
  ];
  return specs.map(([name, signature, description, returnType, parameters, bindingReturnType]) => ({
    command: {
      name,
      signature,
      description,
      insertText: buildInsertTextFromSignature(name, signature),
      returnType
    },
    binding: {
      command: name,
      runtimeName: name,
      parameters: [{
        name: '控件', type: 'controlRef', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'wideName'
      }, ...parameters.map(([parameterName, type]) => ({ name: parameterName, type }))],
      returnType: bindingReturnType,
      encoding: parameters.some(([, type]) => type === 'wideString') || bindingReturnType === 'wideString' ? 'wide' : undefined
    }
  }));
}

// 显式声明的数据型桥接命令：对应的 native 导出参数是 UTF-8 字节指针+长度，
// 从 .lcpp 直接传字符串会编译失败（宽指针与字节指针 ABI 不匹配）；这些命令
// 的运行时由生成模板提供宽字符版助手（见 lingCppWin32Project.ts 的 LB_NE 数据桥接段），
// 消息框处理器通过 LB_NE_FindMsgBox*Handler 按名字派发到 &处理器名 方法。
function newEmojiDataBridgeCommands(designerControls) {
  const controlParameter = (types, description) => ({
    name: '控件', type: 'controlRef', controlTypes: types, controlKinds: ['visual'],
    scope: 'currentWindow', runtimeRepresentation: 'wideName', description
  });
  const build = (name, signature, description, returnType, parameters, example) => ({
    command: {
      name,
      signature,
      description,
      insertText: buildInsertTextFromSignature(name, signature),
      returnType,
      visibility: 'default'
    },
    binding: {
      command: name,
      runtimeName: name,
      parameters,
      returnType: mapBindingReturnType(returnType),
      encoding: 'wide',
      example
    }
  });
  const tableType = controlTypesOf(designerControls, 'Table');
  const richListType = controlTypesOf(designerControls, 'RichList');
  const menuType = controlTypesOf(designerControls, 'Menu');
  const badgeType = controlTypesOf(designerControls, 'Badge');
  const tabsType = controlTypesOf(designerControls, 'Tabs');
  const windowParameter = { name: '窗口句柄', type: 'handle', description: 'new_emoji 窗口句柄。' };
  return [
    build('NE表格_设置列', 'NE表格_设置列(控件, 列配置)',
      '设置 new_emoji 表格列。列配置为 new_emoji 表格列 JSON 数组文本，与 NE_EU_SetTableColumnsEx 的高阶协议一致。',
      '逻辑型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '列配置', type: 'wideString', description: '表格列 JSON 数组文本。' }],
      'NE表格_设置列(表格1, "[{\\"key\\":\\"name\\",\\"title\\":\\"名称\\"}]")'),
    build('NE表格_设置行数据', 'NE表格_设置行数据(控件, 行数据)',
      '整体替换 new_emoji 表格行数据。行数据为 new_emoji 高阶行协议 JSON 数组文本，与 NE_EU_SetTableRowsEx 一致。',
      '逻辑型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行数据', type: 'wideString', description: '表格行 JSON 数组文本。' }],
      'NE表格_设置行数据(表格1, 行数组文本)'),
    build('NE表格_添加行', 'NE表格_添加行(控件, 行数据)',
      '向 new_emoji 表格追加一行，行数据为高阶行协议 JSON 文本，返回新行索引（失败返回 -1）。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行数据', type: 'wideString', description: '单行 JSON 文本。' }],
      'NE表格_添加行(表格1, 行文本)'),
    build('NE表格_插入行', 'NE表格_插入行(控件, 行号, 行数据)',
      '向 new_emoji 表格指定位置插入一行，行数据为高阶行协议 JSON 文本，返回插入后的行索引（失败返回 -1）。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行号', type: 'int', description: '插入位置，从 0 开始。' }, { name: '行数据', type: 'wideString', description: '单行 JSON 文本。' }],
      'NE表格_插入行(表格1, 0, 行文本)'),
    build('NE富列表_设置模板', 'NE富列表_设置模板(控件, 模板JSON)',
      '设置 new_emoji 富列表节点模板。模板为 new_emoji 高阶模板 JSON 文本，与 NE_EU_SetRichListTemplate 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '模板JSON', type: 'wideString', description: '富列表节点模板 JSON 文本。' }],
      'NE富列表_设置模板(富列表1, 模板文本)'),
    build('NE富列表_设置条目', 'NE富列表_设置条目(控件, 条目JSON)',
      '整体替换 new_emoji 富列表条目。条目为 new_emoji 高阶条目 JSON 数组文本，与 NE_EU_SetRichListItems 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '条目JSON', type: 'wideString', description: '富列表条目 JSON 数组文本。' }],
      'NE富列表_设置条目(富列表1, 条目文本)'),
    build('NE富列表_添加条目', 'NE富列表_添加条目(控件, 条目JSON)',
      '向 new_emoji 富列表追加一个条目，条目为高阶条目 JSON 文本，返回条目索引（失败返回 -1）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '条目JSON', type: 'wideString', description: '单个条目 JSON 文本。' }],
      'NE富列表_添加条目(富列表1, 条目文本)'),
    build('NE富列表_设置选中键', 'NE富列表_设置选中键(控件, 选中键JSON)',
      '设置 new_emoji 富列表当前选中条目的 key JSON 数组文本，与 NE_EU_SetRichListSelectedKeys 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '选中键JSON', type: 'wideString', description: '选中 key 的 JSON 数组文本。' }],
      'NE富列表_设置选中键(富列表1, "[\\"item1\\"]")'),
    build('NE富列表_设置倒计时', 'NE富列表_设置倒计时(控件, 键, 节点, 目标毫秒, 格式, 是否暂停)',
      '为 new_emoji 富列表条目设置倒计时。目标毫秒为 Unix 毫秒时间戳，格式为时间显示格式文本，与 NE_EU_SetRichListCountdown 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '节点', type: 'wideString', description: '倒计时节点选择器。' }, { name: '目标毫秒', type: 'int', description: '目标 Unix 毫秒时间戳。' }, { name: '格式', type: 'wideString', description: '倒计时显示格式。' }, { name: '是否暂停', type: 'bool', description: '是否暂停倒计时。' }],
      'NE富列表_设置倒计时(富列表1, "item1", ".countdown", 1790000000000, "HH:mm:ss", 假)'),
    build('NE富列表_设置倒计时状态', 'NE富列表_设置倒计时状态(控件, 键, 节点, 是否暂停)',
      '更新 new_emoji 富列表已有倒计时的暂停/继续状态，与 NE_EU_SetRichListCountdownState 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '节点', type: 'wideString', description: '倒计时节点选择器。' }, { name: '是否暂停', type: 'bool', description: '是否暂停倒计时。' }],
      'NE富列表_设置倒计时状态(富列表1, "item1", ".countdown", 假)'),
    build('NE富列表_设置虚拟行数据', 'NE富列表_设置虚拟行数据(行数据)',
      '在 NE富列表 的虚拟数据源同步事件处理器中调用，设置本次返回的条目 JSON 文本，与表格的 NE_设置表格虚拟行数据 同范式。',
      '空', [{ name: '行数据', type: 'wideString', description: '本次返回的条目 JSON 文本。' }],
      'NE富列表_设置虚拟行数据(条目文本)'),
    build('NE菜单_设置项目', 'NE菜单_设置项目(控件, 项目文本)',
      '设置 new_emoji 菜单项目。项目文本为 new_emoji 高阶菜单协议文本（换行分隔项目，> 前缀表示子菜单层级），与 NE_EU_SetMenuItems 一致。',
      '空', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目文本', type: 'wideString', description: '菜单项目协议文本。' }],
      'NE菜单_设置项目(菜单1, "文件\\n>新建\\n>打开\\n视图")'),
    build('NE菜单_设置项目图标', 'NE菜单_设置项目图标(控件, 项目索引, 图标)',
      '设置 new_emoji 菜单指定项目（从 0 开始）的图标，与 NE_EU_SetMenuItemIcon 一致。',
      '空', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目索引', type: 'int', description: '菜单项目索引，从 0 开始。' }, { name: '图标', type: 'wideString', description: '图标资源文本。' }],
      'NE菜单_设置项目图标(菜单1, 0, "📁")'),
    build('NE菜单_设置项目快捷键', 'NE菜单_设置项目快捷键(控件, 项目索引, 快捷键)',
      '设置 new_emoji 菜单指定项目（从 0 开始）的快捷键提示文本，与 NE_EU_SetMenuItemShortcut 一致。',
      '空', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目索引', type: 'int', description: '菜单项目索引，从 0 开始。' }, { name: '快捷键', type: 'wideString', description: '快捷键提示文本，如 Ctrl+O。' }],
      'NE菜单_设置项目快捷键(菜单1, 1, "Ctrl+O")'),
    build('NE菜单_设置项目元数据', 'NE菜单_设置项目元数据(控件, 图标列表, 分组列表, 链接列表, 目标列表, 命令列表)',
      '批量设置 new_emoji 菜单项目元数据（图标、分组、链接、目标、稳定命令），参数为 new_emoji 高阶协议 JSON 文本，空文本表示不设置，与 NE_EU_SetMenuItemMetaUtf8 一致。',
      '空', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '图标列表', type: 'wideString', description: '图标协议 JSON 文本，空文本表示不设置。' }, { name: '分组列表', type: 'wideString', description: '分组协议 JSON 文本，空文本表示不设置。' }, { name: '链接列表', type: 'wideString', description: '链接协议 JSON 文本，空文本表示不设置。' }, { name: '目标列表', type: 'wideString', description: '目标协议 JSON 文本，空文本表示不设置。' }, { name: '命令列表', type: 'wideString', description: '稳定命令协议 JSON 文本，空文本表示不设置。' }],
      'NE菜单_设置项目元数据(菜单1, "", "", "", "", 命令文本)'),
    build('NE徽标_设置文本', 'NE徽标_设置文本(控件, 文本)',
      '设置 new_emoji 徽标显示文本（如 "3"、"new"），与 NE_EU_SetBadgeValue 一致；纯数字可用控件_设置数值。',
      '空', [controlParameter(badgeType, '当前窗口中的 NE徽标 控件。'), { name: '文本', type: 'wideString', description: '徽标显示文本。' }],
      'NE徽标_设置文本(徽标1, "new")'),
    build('NE标签页_设置激活索引', 'NE标签页_设置激活索引(控件, 索引)',
      '设置 new_emoji 标签页当前激活的项目索引（从 0 开始），与 NE_EU_SetTabsActive 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '索引', type: 'int', description: '要激活的项目索引，从 0 开始。' }],
      'NE标签页_设置激活索引(标签页1, 1)'),
    build('NE标签页_取激活索引', 'NE标签页_取激活索引(控件)',
      '读取 new_emoji 标签页当前激活的项目索引，与 NE_EU_GetTabsActive 一致。',
      '整数型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。')],
      'NE标签页_取激活索引(标签页1)'),
    build('NE标签页_取激活标题', 'NE标签页_取激活标题(控件)',
      '读取 new_emoji 标签页当前激活项目的标题文本，与 NE_EU_GetTabsActiveName 一致。',
      '文本型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。')],
      'NE标签页_取激活标题(标签页1)'),
    build('NE标签页_取项目数量', 'NE标签页_取项目数量(控件)',
      '读取 new_emoji 标签页项目总数，与 NE_EU_GetTabsItemCount 一致。',
      '整数型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。')],
      'NE标签页_取项目数量(标签页1)'),
    build('NE标签页_添加项目', 'NE标签页_添加项目(控件, 标题)',
      '向 new_emoji 标签页末尾追加一个项目，与 NE_EU_AddTabsItem 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '标题', type: 'wideString', description: '新项目标题文本。' }],
      'NE标签页_添加项目(标签页1, "新标签页")'),
    build('NE标签页_关闭项目', 'NE标签页_关闭项目(控件, 索引)',
      '关闭 new_emoji 标签页指定项目（从 0 开始），与 NE_EU_CloseTabsItem 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '索引', type: 'int', description: '要关闭的项目索引，从 0 开始。' }],
      'NE标签页_关闭项目(标签页1, 0)'),
    build('NE标签页_设置滚动偏移', 'NE标签页_设置滚动偏移(控件, 偏移)',
      '设置 new_emoji 标签页表头滚动偏移，与 NE_EU_SetTabsScroll 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '偏移', type: 'int', description: '表头滚动偏移像素。' }],
      'NE标签页_设置滚动偏移(标签页1, 40)'),
    build('NE标签页_滚动', 'NE标签页_滚动(控件, 增量)',
      '让 new_emoji 标签页表头按增量滚动，正数向右、负数向左，与 NE_EU_TabsScroll 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '增量', type: 'int', description: '滚动增量像素。' }],
      'NE标签页_滚动(标签页1, -32)'),
    build('NE标签页_设置标签样式', 'NE标签页_设置标签样式(控件, 样式)',
      '设置 new_emoji 标签页样式：0 线条、1 卡片、2 边框卡片，与 NE_EU_SetTabsType 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '样式', type: 'int', description: '0 线条、1 卡片、2 边框卡片。' }],
      'NE标签页_设置标签样式(标签页1, 1)'),
    build('NE标签页_设置标签位置', 'NE标签页_设置标签位置(控件, 位置)',
      '设置 new_emoji 标签页表头位置：0 顶部、1 右侧、2 底部、3 左侧，与 NE_EU_SetTabsPosition 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '位置', type: 'int', description: '0 顶部、1 右侧、2 底部、3 左侧。' }],
      'NE标签页_设置标签位置(标签页1, 2)'),
    build('NE标签页_设置表头对齐', 'NE标签页_设置表头对齐(控件, 对齐)',
      '设置 new_emoji 标签页表头文字对齐：0 左对齐、1 居中、2 右对齐，与 NE_EU_SetTabsHeaderAlign 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '对齐', type: 'int', description: '0 左对齐、1 居中、2 右对齐。' }],
      'NE标签页_设置表头对齐(标签页1, 1)'),
    build('NE标签页_设置表头可见', 'NE标签页_设置表头可见(控件, 可见)',
      '设置 new_emoji 标签页是否显示表头，与 NE_EU_SetTabsHeaderVisible 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '可见', type: 'bool', description: '是否显示表头。' }],
      'NE标签页_设置表头可见(标签页1, 假)'),
    build('NE标签页_设置可编辑', 'NE标签页_设置可编辑(控件, 可编辑)',
      '设置 new_emoji 标签页是否允许双击重命名项目，与 NE_EU_SetTabsEditable 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '可编辑', type: 'bool', description: '是否允许双击重命名。' }],
      'NE标签页_设置可编辑(标签页1, 真)'),
    build('NE标签页_设置内容可见', 'NE标签页_设置内容可见(控件, 可见)',
      '设置 new_emoji 标签页内容区是否可见，与 NE_EU_SetTabsContentVisible 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '可见', type: 'bool', description: '内容区是否可见。' }],
      'NE标签页_设置内容可见(标签页1, 真)'),
    build('NE标签页_启用浏览器模式', 'NE标签页_启用浏览器模式(控件, 启用)',
      '启用 new_emoji 标签页的浏览器式（Chrome）绘制，与 NE_EU_SetTabsChromeMode 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '启用', type: 'bool', description: '是否启用浏览器模式。' }],
      'NE标签页_启用浏览器模式(标签页1, 真)'),
    build('NE标签页_设置浏览器度量', 'NE标签页_设置浏览器度量(控件, 最小宽度, 最大宽度, 固定宽度, 标题高度, 重叠)',
      '设置 new_emoji 标签页浏览器模式的标签宽度、高度和重叠度量，与 NE_EU_SetTabsChromeMetrics 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '最小宽度', type: 'int', description: '单个标签最小逻辑宽度。' }, { name: '最大宽度', type: 'int', description: '单个标签最大逻辑宽度。' }, { name: '固定宽度', type: 'int', description: '固定（钉住）标签的逻辑宽度。' }, { name: '标题高度', type: 'int', description: '标签标题的逻辑高度。' }, { name: '重叠', type: 'int', description: '相邻标签重叠的逻辑像素。' }],
      'NE标签页_设置浏览器度量(标签页1, 96, 220, 46, 32, 0)'),
    build('NE标签页_设置项目图标', 'NE标签页_设置项目图标(控件, 索引, 图标)',
      '设置 new_emoji 标签页指定项目的图标，与 NE_EU_SetTabsItemIcon 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '索引', type: 'int', description: '项目索引，从 0 开始。' }, { name: '图标', type: 'wideString', description: '图标资源文本。' }],
      'NE标签页_设置项目图标(标签页1, 0, "📁")'),
    build('NE标签页_设置项目可关闭', 'NE标签页_设置项目可关闭(控件, 索引, 可关闭)',
      '设置 new_emoji 标签页指定项目是否显示关闭按钮，与 NE_EU_SetTabsItemClosable 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '索引', type: 'int', description: '项目索引，从 0 开始。' }, { name: '可关闭', type: 'bool', description: '是否允许关闭。' }],
      'NE标签页_设置项目可关闭(标签页1, 0, 假)'),
    build('NE标签页_设置项目状态', 'NE标签页_设置项目状态(控件, 索引, 加载中, 固定, 静音, 提醒)',
      '批量设置 new_emoji 标签页项目的加载中、固定、静音、提醒状态（浏览器模式视觉），与 NE_EU_SetTabsItemChromeState 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '索引', type: 'int', description: '项目索引，从 0 开始。' }, { name: '加载中', type: 'bool', description: '是否显示加载中。' }, { name: '固定', type: 'bool', description: '是否固定标签。' }, { name: '静音', type: 'bool', description: '是否显示静音。' }, { name: '提醒', type: 'bool', description: '是否显示提醒圆点。' }],
      'NE标签页_设置项目状态(标签页1, 1, 假, 真, 假, 真)'),
    build('NE标签页_设置新建按钮可见', 'NE标签页_设置新建按钮可见(控件, 可见)',
      '设置 new_emoji 标签页浏览器模式的「新建标签页」按钮是否可见，与 NE_EU_SetTabsNewButtonVisible 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '可见', type: 'bool', description: '新建按钮是否可见。' }],
      'NE标签页_设置新建按钮可见(标签页1, 假)'),
    build('NE标签页_设置拖拽选项', 'NE标签页_设置拖拽选项(控件, 允许重排, 允许分离)',
      '设置 new_emoji 标签页是否允许拖拽重排和拖出分离，与 NE_EU_SetTabsDragOptions 一致。',
      '逻辑型', [controlParameter(tabsType, '当前窗口中的 NE标签页 控件。'), { name: '允许重排', type: 'bool', description: '是否允许拖动改变顺序。' }, { name: '允许分离', type: 'bool', description: '是否允许拖出当前窗口。' }],
      'NE标签页_设置拖拽选项(标签页1, 真, 假)'),
    build('NE_设置窗口图标', 'NE_设置窗口图标(窗口句柄, 图标路径)',
      '从本地 .ico 文件路径设置 new_emoji 窗口图标，与 NE_EU_SetWindowIcon 一致。',
      '整数型', [windowParameter, { name: '图标路径', type: 'wideString', description: '窗口图标文件完整路径。' }],
      'NE_设置窗口图标(窗口1, "C:\\\\icons\\\\app.ico")'),
    build('NE_设置主题令牌', 'NE_设置主题令牌(窗口句柄, 令牌名, 颜色值)',
      '设置 new_emoji 主题令牌颜色（0xAARRGGBB），与 NE_EU_SetThemeToken 一致。',
      '整数型', [windowParameter, { name: '令牌名', type: 'wideString', description: '主题令牌名称，如 panel.bg。' }, { name: '颜色值', type: 'int', description: '0xAARRGGBB 颜色值。' }],
      'NE_设置主题令牌(窗口1, "panel.bg", 4288621312)'),
    build('NE_显示消息框', 'NE_显示消息框(窗口句柄, 标题, 文本, 确认文本, 处理器)',
      '显示 new_emoji 消息框（单个确认按钮）。处理器使用 &处理器名 引用，收到（结果编号, 结果值）两个整数参数；结果值 1 确认、2 关闭。',
      '整数型', [windowParameter, { name: '标题', type: 'wideString', description: '消息框标题。' }, { name: '文本', type: 'wideString', description: '消息框正文。' }, { name: '确认文本', type: 'wideString', description: '确认按钮文本。' }, { name: '处理器', type: 'handler', description: '关闭回调处理器，&处理器名 引用。', handlerSignature: { parameterTypes: ['整数型', '整数型'], returnType: '空' } }],
      'NE_显示消息框(窗口1, "提示", "操作已完成", "确定", &消息框已关闭)'),
    build('NE_显示确认框', 'NE_显示确认框(窗口句柄, 标题, 文本, 确认文本, 取消文本, 处理器)',
      '显示 new_emoji 确认框（确认+取消按钮）。处理器使用 &处理器名 引用，收到（结果编号, 结果值）两个整数参数；结果值 1 确认、2 取消、3 关闭。',
      '整数型', [windowParameter, { name: '标题', type: 'wideString', description: '确认框标题。' }, { name: '文本', type: 'wideString', description: '确认框正文。' }, { name: '确认文本', type: 'wideString', description: '确认按钮文本。' }, { name: '取消文本', type: 'wideString', description: '取消按钮文本。' }, { name: '处理器', type: 'handler', description: '关闭回调处理器，&处理器名 引用。', handlerSignature: { parameterTypes: ['整数型', '整数型'], returnType: '空' } }],
      'NE_显示确认框(窗口1, "删除", "确定删除当前账号吗？", "删除", "取消", &确认框已关闭)'),
    build('NE_显示扩展消息框', 'NE_显示扩展消息框(窗口句柄, 标题, 文本, 确认文本, 取消文本, 框类型, 显示取消, 居中, 富文本, 区分取消关闭, 处理器)',
      '显示 new_emoji 扩展消息框。框类型与 new_emoji 高阶类型一致；处理器使用 &处理器名 引用，收到（结果编号, 动作, 输入文本）参数，输入文本仅在提问类消息框有值。',
      '整数型', [windowParameter, { name: '标题', type: 'wideString', description: '消息框标题。' }, { name: '文本', type: 'wideString', description: '消息框正文，富文本时可为受限 HTML。' }, { name: '确认文本', type: 'wideString', description: '确认按钮文本。' }, { name: '取消文本', type: 'wideString', description: '取消按钮文本。' }, { name: '框类型', type: 'int', description: 'new_emoji 消息框类型编号。' }, { name: '显示取消', type: 'bool', description: '是否显示取消按钮。' }, { name: '居中', type: 'bool', description: '是否居中显示。' }, { name: '富文本', type: 'bool', description: '正文是否按富文本渲染。' }, { name: '区分取消关闭', type: 'bool', description: '是否区分取消按钮与关闭按钮的动作编号。' }, { name: '处理器', type: 'handler', description: '关闭回调处理器，&处理器名 引用。', handlerSignature: { parameterTypes: ['整数型', '整数型', '文本型'], returnType: '空' } }],
      'NE_显示扩展消息框(窗口1, "反馈", "请描述问题", "提交", "取消", 4, 真, 真, 假, 真, &反馈框已关闭)'),
    // ===== Post 异步投递族：可在工作线程安全投递到界面线程执行 =====
    build('NE表格_投递设置行数据', 'NE表格_投递设置行数据(控件, 行数据)',
      '向界面线程投递整体替换 new_emoji 表格行数据（可在工作线程调用），与 NE_EU_PostSetTableRowsEx 一致。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行数据', type: 'wideString', description: '表格行 JSON 数组文本。' }],
      'NE表格_投递设置行数据(表格1, 行数组文本)'),
    build('NE表格_投递添加行', 'NE表格_投递添加行(控件, 行数据)',
      '向界面线程投递向 new_emoji 表格追加一行（可在工作线程调用）。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行数据', type: 'wideString', description: '单行 JSON 文本。' }],
      'NE表格_投递添加行(表格1, 行文本)'),
    build('NE表格_投递插入行', 'NE表格_投递插入行(控件, 行号, 行数据)',
      '向界面线程投递向 new_emoji 表格指定位置插入一行（可在工作线程调用）。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行号', type: 'int', description: '插入位置，从 0 开始。' }, { name: '行数据', type: 'wideString', description: '单行 JSON 文本。' }],
      'NE表格_投递插入行(表格1, 0, 行文本)'),
    build('NE表格_投递清空行', 'NE表格_投递清空行(控件)',
      '向界面线程投递清空 new_emoji 表格全部行（可在工作线程调用）。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。')],
      'NE表格_投递清空行(表格1)'),
    build('NE菜单_投递项目', 'NE菜单_投递项目(控件, 项目文本)',
      '向界面线程投递设置 new_emoji 菜单项目（可在工作线程调用），协议与 NE菜单_设置项目 一致。',
      '整数型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目文本', type: 'wideString', description: '菜单项目协议文本。' }],
      'NE菜单_投递项目(菜单1, "文件\\n>新建")'),
    build('NE菜单_投递项目图标', 'NE菜单_投递项目图标(控件, 项目索引, 图标)',
      '向界面线程投递设置 new_emoji 菜单指定项目图标（可在工作线程调用）。',
      '整数型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目索引', type: 'int', description: '菜单项目索引，从 0 开始。' }, { name: '图标', type: 'wideString', description: '图标资源文本。' }],
      'NE菜单_投递项目图标(菜单1, 0, "📁")'),
    build('NE菜单_投递项目快捷键', 'NE菜单_投递项目快捷键(控件, 项目索引, 快捷键)',
      '向界面线程投递设置 new_emoji 菜单指定项目快捷键提示（可在工作线程调用）。',
      '整数型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目索引', type: 'int', description: '菜单项目索引，从 0 开始。' }, { name: '快捷键', type: 'wideString', description: '快捷键提示文本，如 Ctrl+O。' }],
      'NE菜单_投递项目快捷键(菜单1, 1, "Ctrl+O")'),
    build('NE菜单_投递展开状态', 'NE菜单_投递展开状态(控件, 展开索引JSON)',
      '向界面线程投递设置 new_emoji 多级菜单展开项（可在工作线程调用），展开索引为 JSON 数组文本，与 NE_EU_PostSetMenuExpandedUtf8 一致。',
      '整数型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '展开索引JSON', type: 'wideString', description: '展开项索引 JSON 数组文本。' }],
      'NE菜单_投递展开状态(菜单1, "[0,2]")'),
    build('NE徽标_投递设置文本', 'NE徽标_投递设置文本(控件, 文本)',
      '向界面线程投递设置 new_emoji 徽标显示文本（可在工作线程调用）。',
      '整数型', [controlParameter(badgeType, '当前窗口中的 NE徽标 控件。'), { name: '文本', type: 'wideString', description: '徽标显示文本。' }],
      'NE徽标_投递设置文本(徽标1, "new")'),
    build('NE富列表_投递设置模板', 'NE富列表_投递设置模板(控件, 模板JSON)',
      '向界面线程投递设置 new_emoji 富列表节点模板（可在工作线程调用）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '模板JSON', type: 'wideString', description: '富列表节点模板 JSON 文本。' }],
      'NE富列表_投递设置模板(富列表1, 模板文本)'),
    build('NE富列表_投递设置条目', 'NE富列表_投递设置条目(控件, 条目JSON)',
      '向界面线程投递整体替换 new_emoji 富列表条目（可在工作线程调用）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '条目JSON', type: 'wideString', description: '富列表条目 JSON 数组文本。' }],
      'NE富列表_投递设置条目(富列表1, 条目文本)'),
    build('NE富列表_投递添加条目', 'NE富列表_投递添加条目(控件, 条目JSON)',
      '向界面线程投递向 new_emoji 富列表追加一个条目（可在工作线程调用）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '条目JSON', type: 'wideString', description: '单个条目 JSON 文本。' }],
      'NE富列表_投递添加条目(富列表1, 条目文本)'),
    build('NE富列表_投递更新条目', 'NE富列表_投递更新条目(控件, 键, 条目JSON)',
      '向界面线程投递按键更新 new_emoji 富列表条目（可在工作线程调用），与 NE_EU_PostUpdateRichListItem 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '条目JSON', type: 'wideString', description: '新条目 JSON 文本。' }],
      'NE富列表_投递更新条目(富列表1, "item1", 条目文本)'),
    build('NE富列表_投递删除条目', 'NE富列表_投递删除条目(控件, 键)',
      '向界面线程投递按键删除 new_emoji 富列表条目（可在工作线程调用）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }],
      'NE富列表_投递删除条目(富列表1, "item1")'),
    build('NE富列表_投递条目覆盖', 'NE富列表_投递条目覆盖(控件, 键, 覆盖JSON)',
      '向界面线程投递设置 new_emoji 富列表条目节点级覆盖（可在工作线程调用），与 NE_EU_PostSetRichListItemOverride 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '覆盖JSON', type: 'wideString', description: '节点覆盖 JSON 文本。' }],
      'NE富列表_投递条目覆盖(富列表1, "item1", 覆盖文本)'),
    build('NE富列表_投递设置选中键', 'NE富列表_投递设置选中键(控件, 选中键JSON)',
      '向界面线程投递设置 new_emoji 富列表选中 key（可在工作线程调用）。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '选中键JSON', type: 'wideString', description: '选中 key 的 JSON 数组文本。' }],
      'NE富列表_投递设置选中键(富列表1, "[\\"item1\\"]")'),
    // ===== 运行时信息读取（原生输出指针参数封装为文本/JSON 返回） =====
    build('NE表格_取单元格值', 'NE表格_取单元格值(控件, 行号, 列号)',
      '读取 new_emoji 表格指定单元格文本。',
      '文本型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行号', type: 'int', description: '行索引，从 0 开始。' }, { name: '列号', type: 'int', description: '列索引，从 0 开始。' }],
      'NE表格_取单元格值(表格1, 0, 1)'),
    build('NE表格_取双击编辑状态', 'NE表格_取双击编辑状态(控件)',
      '读取 new_emoji 表格双击编辑状态，返回 JSON 文本（enabled/editingRow/editingCol）。',
      '文本型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。')],
      'NE表格_取双击编辑状态(表格1)'),
    build('NE表格_取单元格双击可编辑', 'NE表格_取单元格双击可编辑(控件, 行号, 列号)',
      '判断 new_emoji 表格指定单元格当前是否允许双击编辑，返回 1/0。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '行号', type: 'int', description: '行索引，从 0 开始。' }, { name: '列号', type: 'int', description: '列索引，从 0 开始。' }],
      'NE表格_取单元格双击可编辑(表格1, 0, 1)'),
    build('NE菜单_取状态', 'NE菜单_取状态(控件)',
      '读取 new_emoji 菜单运行状态，返回 JSON 文本（activeIndex/itemCount/orientation/activeLevel/visibleCount/expandedCount/hoverIndex）。',
      '文本型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。')],
      'NE菜单_取状态(菜单1)'),
    build('NE菜单_取活动路径', 'NE菜单_取活动路径(控件)',
      '读取 new_emoji 菜单当前活动项层级路径文本。',
      '文本型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。')],
      'NE菜单_取活动路径(菜单1)'),
    build('NE菜单_取颜色', 'NE菜单_取颜色(控件)',
      '读取 new_emoji 菜单当前配色，返回 JSON 文本（background/textColor/activeTextColor/hoverBackground/disabledTextColor/border，0xAARRGGBB）。',
      '文本型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。')],
      'NE菜单_取颜色(菜单1)'),
    build('NE菜单_取项目元数据', 'NE菜单_取项目元数据(控件, 项目索引)',
      '读取 new_emoji 菜单指定项目元数据，返回 JSON 文本（icon/href/target/command/isGroup/disabled/level）。',
      '文本型', [controlParameter(menuType, '当前窗口中的 NE菜单 控件。'), { name: '项目索引', type: 'int', description: '菜单项目索引，从 0 开始。' }],
      'NE菜单_取项目元数据(菜单1, 0)'),
    build('NE富列表_取模板', 'NE富列表_取模板(控件)',
      '读取 new_emoji 富列表当前节点模板 JSON 文本。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_取模板(富列表1)'),
    build('NE富列表_取条目们', 'NE富列表_取条目们(控件)',
      '读取 new_emoji 富列表全部条目 JSON 文本。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_取条目们(富列表1)'),
    build('NE富列表_取条目', 'NE富列表_取条目(控件, 索引)',
      '按索引读取 new_emoji 富列表单个条目 JSON 文本。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '索引', type: 'int', description: '条目索引，从 0 开始。' }],
      'NE富列表_取条目(富列表1, 0)'),
    build('NE富列表_取选中键', 'NE富列表_取选中键(控件)',
      '读取 new_emoji 富列表当前选中 key 的 JSON 数组文本。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_取选中键(富列表1)'),
    build('NE富列表_取选项', 'NE富列表_取选项(控件)',
      '读取 new_emoji 富列表选项，返回 JSON 文本（selectionMode/bordered/zebra/compact/keyboardNavigation/showScrollbar）。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_取选项(富列表1)'),
    build('NE富列表_取样式', 'NE富列表_取样式(控件)',
      '读取 new_emoji 富列表样式，返回 JSON 文本（rowHeight/paddingX/paddingY/scrollbarWidth/align/selectedColor/hoverColor）。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_取样式(富列表1)'),
    build('NE富列表_取倒计时状态', 'NE富列表_取倒计时状态(控件, 键, 节点)',
      '读取 new_emoji 富列表条目倒计时状态 JSON 文本。',
      '文本型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '节点', type: 'wideString', description: '倒计时节点选择器。' }],
      'NE富列表_取倒计时状态(富列表1, "item1", ".countdown")'),
    build('NE富列表_更新条目', 'NE富列表_更新条目(控件, 键, 条目JSON)',
      '按键更新 new_emoji 富列表条目内容，与 NE_EU_UpdateRichListItem 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '条目JSON', type: 'wideString', description: '新条目 JSON 文本。' }],
      'NE富列表_更新条目(富列表1, "item1", 条目文本)'),
    build('NE富列表_删除条目', 'NE富列表_删除条目(控件, 键)',
      '按键删除 new_emoji 富列表条目。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }],
      'NE富列表_删除条目(富列表1, "item1")'),
    build('NE富列表_条目覆盖', 'NE富列表_条目覆盖(控件, 键, 覆盖JSON)',
      '设置 new_emoji 富列表条目节点级覆盖 JSON 文本，与 NE_EU_SetRichListItemOverride 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '覆盖JSON', type: 'wideString', description: '节点覆盖 JSON 文本。' }],
      'NE富列表_条目覆盖(富列表1, "item1", 覆盖文本)'),
    build('NE富列表_追加倒计时', 'NE富列表_追加倒计时(控件, 键, 节点, 追加毫秒)',
      '为 new_emoji 富列表已有倒计时追加毫秒数（负数回拨），与 NE_EU_AddRichListCountdownTime 一致。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。'), { name: '键', type: 'wideString', description: '条目 key。' }, { name: '节点', type: 'wideString', description: '倒计时节点选择器。' }, { name: '追加毫秒', type: 'int', description: '追加的毫秒数，可为负。' }],
      'NE富列表_追加倒计时(富列表1, "item1", ".countdown", 60000)'),
    build('NE富列表_清空条目', 'NE富列表_清空条目(控件)',
      '清空 new_emoji 富列表全部条目，返回剩余条目数。',
      '整数型', [controlParameter(richListType, '当前窗口中的 NE富列表 控件。')],
      'NE富列表_清空条目(富列表1)'),
    // ===== 特殊运行时能力 =====
    build('NE_设置窗口图标字节', 'NE_设置窗口图标字节(窗口句柄, 图标字节集)',
      '从内存字节集设置 new_emoji 窗口图标（.ico/.png 字节），与 NE_EU_SetWindowIconFromBytes 一致。',
      '整数型', [windowParameter, { name: '图标字节集', type: 'bytes', description: '图标文件完整字节集。' }],
      'NE_设置窗口图标字节(窗口1, 图标字节)'),
    build('NE_显示提问框', 'NE_显示提问框(窗口句柄, 标题, 文本, 占位文本, 初始值, 校验模式, 错误提示, 确认文本, 取消文本, 框类型, 居中, 富文本, 区分取消关闭, 处理器)',
      '显示 new_emoji 提问框（带输入框）。处理器使用 &处理器名 引用，收到（结果编号, 动作, 输入文本）参数。',
      '整数型', [windowParameter, { name: '标题', type: 'wideString', description: '提问框标题。' }, { name: '文本', type: 'wideString', description: '提问框正文。' }, { name: '占位文本', type: 'wideString', description: '输入框占位文本。' }, { name: '初始值', type: 'wideString', description: '输入框初始值。' }, { name: '校验模式', type: 'wideString', description: '输入校验模式文本，空文本不校验。' }, { name: '错误提示', type: 'wideString', description: '校验失败错误提示。' }, { name: '确认文本', type: 'wideString', description: '确认按钮文本。' }, { name: '取消文本', type: 'wideString', description: '取消按钮文本。' }, { name: '框类型', type: 'int', description: 'new_emoji 消息框类型编号。' }, { name: '居中', type: 'bool', description: '是否居中显示。' }, { name: '富文本', type: 'bool', description: '正文是否按富文本渲染。' }, { name: '区分取消关闭', type: 'bool', description: '是否区分取消按钮与关闭按钮的动作编号。' }, { name: '处理器', type: 'handler', description: '关闭回调处理器，&处理器名 引用。', handlerSignature: { parameterTypes: ['整数型', '整数型', '文本型'], returnType: '空' } }],
      'NE_显示提问框(窗口1, "重命名", "请输入新名称", "新名称", "", "", "", "确定", "取消", 4, 真, 假, 真, &提问框已关闭)'),
    build('NE_显示通知', 'NE_显示通知(窗口句柄, 标题, 正文, 通知类型, 可关闭, 时长毫秒, 摆放, 偏移, 富文本, 宽度, 高度)',
      '弹出 new_emoji 运行时通知，返回通知编号；摆放 0 右下、1 右上、2 左下、3 左上。',
      '整数型', [windowParameter, { name: '标题', type: 'wideString', description: '通知标题。' }, { name: '正文', type: 'wideString', description: '通知正文。' }, { name: '通知类型', type: 'int', description: 'new_emoji 通知类型编号。' }, { name: '可关闭', type: 'bool', description: '是否显示关闭按钮。' }, { name: '时长毫秒', type: 'int', description: '自动关闭时长毫秒，0 表示不自动关闭。' }, { name: '摆放', type: 'int', description: '0 右下、1 右上、2 左下、3 左上。' }, { name: '偏移', type: 'int', description: '距屏幕边缘像素。' }, { name: '富文本', type: 'bool', description: '正文是否按富文本渲染。' }, { name: '宽度', type: 'int', description: '通知宽度，0 使用默认。' }, { name: '高度', type: 'int', description: '通知高度，0 使用默认。' }],
      'NE_显示通知(窗口1, "构建完成", "产物已输出", 1, 真, 4000, 0, 24, 假, 0, 0)'),
    build('NE_显示加载遮罩', 'NE_显示加载遮罩(窗口句柄, 目标控件, 文本, 全屏, 锁输入, 背景色, 圈颜色, 文本颜色, 样式)',
      '显示 new_emoji 加载遮罩，返回加载编号；传 0 加载编号给 NE_关闭加载遮罩 结束。',
      '整数型', [windowParameter, { name: '目标控件', type: 'controlRef', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'wideName', description: '承载遮罩的控件，当前窗口传 0。' }, { name: '文本', type: 'wideString', description: '加载提示文本。' }, { name: '全屏', type: 'bool', description: '是否全屏遮罩。' }, { name: '锁输入', type: 'bool', description: '是否锁定输入。' }, { name: '背景色', type: 'int', description: '0xAARRGGBB 背景色，0 使用默认。' }, { name: '圈颜色', type: 'int', description: '0xAARRGGBB 加载圈颜色，0 使用默认。' }, { name: '文本颜色', type: 'int', description: '0xAARRGGBB 文本颜色，0 使用默认。' }, { name: '样式', type: 'int', description: '加载圈样式编号。' }],
      'NE_显示加载遮罩(窗口1, 0, "加载中…", 真, 真, 0, 0, 0, 0)'),
    build('NE_关闭加载遮罩', 'NE_关闭加载遮罩(窗口句柄, 加载编号)',
      '关闭 NE_显示加载遮罩 返回的加载遮罩。',
      '空', [windowParameter, { name: '加载编号', type: 'int', description: 'NE_显示加载遮罩 返回的编号。' }],
      'NE_关闭加载遮罩(窗口1, 加载编号)'),
    build('NE表格_导出Excel', 'NE表格_导出Excel(控件, 文件路径, 标志)',
      '把 new_emoji 表格导出为 Excel 文件，与 NE_EU_ExportTableExcel 一致。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '文件路径', type: 'wideString', description: '目标 .xlsx 文件完整路径。' }, { name: '标志', type: 'int', description: '导出标志位。' }],
      'NE表格_导出Excel(表格1, "D:\\\\data\\\\订单.xlsx", 0)'),
    build('NE表格_导入Excel', 'NE表格_导入Excel(控件, 文件路径, 标志)',
      '从 Excel 文件导入数据到 new_emoji 表格，与 NE_EU_ImportTableExcel 一致。',
      '整数型', [controlParameter(tableType, '当前窗口中的 NE表格 控件。'), { name: '文件路径', type: 'wideString', description: '来源 .xlsx 文件完整路径。' }, { name: '标志', type: 'int', description: '导入标志位。' }],
      'NE表格_导入Excel(表格1, "D:\\\\data\\\\订单.xlsx", 0)')
  ];
}

// 已由手工桥接命令覆盖的底层导出：属性命令自动生成时跳过，避免重复。
const HAND_BRIDGE_EU_CALLS = new Set([
  'EU_SetTableColumnsEx', 'EU_SetTableRowsEx', 'EU_AddTableRow', 'EU_InsertTableRow',
  'EU_SetRichListTemplate', 'EU_SetRichListItems', 'EU_AddRichListItem', 'EU_SetRichListSelectedKeys',
  'EU_SetRichListCountdown', 'EU_SetRichListCountdownState',
  'EU_SetMenuItems', 'EU_SetMenuItemIcon', 'EU_SetMenuItemShortcut', 'EU_SetMenuItemMetaUtf8',
  'EU_SetBadgeValue', 'EU_SetWindowIcon', 'EU_SetThemeToken',
  'EU_ShowMessageBox', 'EU_ShowConfirmBox', 'EU_ShowMessageBoxEx'
]);

// 属性命令自动生成：把每个控件属性面板背后的 EU_Set* 宽字符 setter 封装成
// `NE<类型>_设置<属性中文>` 运行时命令（只封装带 UTF-8 字节指针参数的 setter；
// 纯数值 setter 已可经 NE_EU_* 直调）。C++ 助手由 lingCppWin32Project 按
// control.runtime.propertyBridgeCommands 描述符统一生成。
function newEmojiPropertyBridgeCommands(designerControls, existingCommandNames) {
  const result = [];
  const seen = new Set(existingCommandNames);
  for (const control of designerControls) {
    if (control.isVisual === false) continue;
    const setters = control.runtime?.propertySetters || [];
    const labelByKey = new Map((control.properties || []).map(property => [property.key, property.label]));
    const usedNames = new Set();
    for (const setter of setters) {
      if (HAND_BRIDGE_EU_CALLS.has(setter.command)) continue;
      if (!setter.parameters.some(parameter => parameter.type === 'const unsigned char*')) continue;
      const bindingParameters = [{
        name: '控件', type: 'controlRef', controlTypes: [control.namespacedType], controlKinds: ['visual'],
        scope: 'currentWindow', runtimeRepresentation: 'wideName', description: `当前窗口中的 ${control.label} 控件。`
      }];
      const args = [];
      const utf8VarByGroup = new Map();
      let nextIndex = 1;
      for (const parameter of setter.parameters) {
        const key = parameter.propertyKey;
        if (parameter.name === 'hwnd') { args.push({ kind: 'hwnd' }); continue; }
        if (parameter.name === 'element_id') { args.push({ kind: 'id' }); continue; }
        if (parameter.literal !== undefined) { args.push({ kind: 'literal', value: parameter.literal }); continue; }
        if (parameter.type === 'const unsigned char*') {
          const label = labelByKey.get(key) || key;
          bindingParameters.push({ name: label, type: 'wideString', description: `${control.label} 属性「${label}」文本。` });
          utf8VarByGroup.set(key, nextIndex);
          args.push({ kind: 'utf8', param: nextIndex });
          nextIndex += 1;
          continue;
        }
        if (parameter.lengthOf) {
          const index = utf8VarByGroup.get(parameter.lengthOf);
          if (index === undefined) return [];
          args.push({ kind: 'utf8len', param: index });
          continue;
        }
        const label = labelByKey.get(key) || key;
        const isFloat = parameter.type === 'float' || parameter.type === 'double';
        bindingParameters.push({ name: label, type: isFloat ? 'double' : 'int', description: `${control.label} 属性「${label}」数值。` });
        args.push({ kind: isFloat ? 'float' : 'int', param: nextIndex, ...(parameter.valueScale ? { scale: parameter.valueScale } : {}) });
        nextIndex += 1;
      }
      const firstKey = setter.parameters.find(parameter => parameter.propertyKey)?.propertyKey || '';
      const firstLabel = labelByKey.get(firstKey) || firstKey || setter.command;
      const baseLabel = String(firstLabel).replace(/[^\p{L}\p{N}_]+/gu, '');
      let name = `${newEmojiLingCppType(control)}_设置${baseLabel}`;
      let suffix = 2;
      while (seen.has(name) || usedNames.has(name)) {
        name = `${newEmojiLingCppType(control)}_设置${baseLabel}${suffix}`;
        suffix += 1;
      }
      seen.add(name);
      usedNames.add(name);
      const keys = (setter.propertyKeys || []).map(key => labelByKey.get(key) || key).join('、');
      const parameterText = bindingParameters.slice(1).map(parameter => parameter.name).join(', ');
      const signature = `${name}(控件, ${parameterText})`;
      result.push({
        command: {
          name,
          signature,
          description: `设置 ${control.label} 的${keys || '属性'}。对应 ${setter.command} 的宽字符封装，禁止改调 NE_EU_${setter.command}。`,
          insertText: buildInsertTextFromSignature(name, signature),
          returnType: '逻辑型',
          visibility: 'default'
        },
        binding: {
          command: name,
          runtimeName: name,
          parameters: bindingParameters,
          returnType: 'bool',
          encoding: 'wide',
          example: `${name}(当前窗口, ${parameterText})`
        },
        propertyCommand: {
          command: name,
          type: control.type,
          eu: setter.command,
          args
        }
      });
    }
  }
  return result;
}

function controlTypesOf(designerControls, type) {
  return designerControls
    .filter(control => control.type === type && control.isVisual !== false)
    .map(control => control.namespacedType);
}

function buildNewEmojiRuntimeControlCatalog(designerControls) {
  const visualControls = designerControls.filter(control => control.isVisual !== false);
  const typeNames = new Set();
  const commandNames = new Set();
  return visualControls.map(control => {
    const lingCppType = newEmojiLingCppType(control);
    if (typeNames.has(lingCppType)) throw new Error(`new_emoji 运行时控件类型名重复：${lingCppType}`);
    typeNames.add(lingCppType);
    const contract = {
      lingCppType,
      cppType: 'LingControlRef',
      createCommand: `控件_创建${lingCppType}`,
      createParameters: [
        { name: '父级', type: '控件容器', role: 'parent' },
        { name: '横坐标', type: 'int', role: 'x' },
        { name: '纵坐标', type: 'int', role: 'y' },
        { name: '宽度', type: 'int', role: 'width' },
        { name: '高度', type: 'int', role: 'height' },
        { name: '文本', type: 'wideString', role: 'content' },
        { name: '标记文本', type: 'wideString', role: 'tagText', optional: true, defaultValue: '' },
        { name: '标记整数', type: 'int', role: 'tagInteger', optional: true, defaultValue: null }
      ],
      lookupByTagTextCommand: `通过标记文本获取${lingCppType}`,
      lookupByTagIntegerCommand: `通过标记整数获取${lingCppType}`,
      validCommand: '控件_是否有效',
      parentKinds: ['window', 'container', 'tabPage'],
      tagScope: 'currentWindowAndConcreteType'
    };
    [contract.createCommand, contract.lookupByTagTextCommand, contract.lookupByTagIntegerCommand].forEach(command => {
      if (commandNames.has(command)) throw new Error(`new_emoji 运行时控件命令名重复：${command}`);
      commandNames.add(command);
    });
    control.runtimeControl = contract;
    const runtimeEvents = (control.runtime?.eventBindings || []).map(eventBinding => {
      const event = (control.events || []).find(item => item.name === eventBinding.eventName);
      if (!event) throw new Error(`new_emoji ${control.type}.${eventBinding.eventName} 缺少事件贡献。`);
      const bindCommand = `${lingCppType}_绑定${event.label}`;
      const unbindCommand = `${lingCppType}_解绑${event.label}`;
      [bindCommand, unbindCommand].forEach(command => {
        if (commandNames.has(command)) throw new Error(`new_emoji 运行时事件命令名重复：${command}`);
        commandNames.add(command);
      });
      return { event, eventBinding, bindCommand, unbindCommand };
    });
    return {
      control,
      contract,
      commands: [{
        name: contract.createCommand,
        signature: `${contract.createCommand}(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])`,
        description: `在当前 new_emoji 窗口运行时创建${lingCppType}，窗口拥有元素生命周期。`,
        insertText: `${contract.createCommand}(当前窗口, $1, $2, $3, $4, "$5", "$6", $7)`,
        returnType: lingCppType
      }, {
        name: contract.lookupByTagTextCommand,
        signature: `${contract.lookupByTagTextCommand}(标记文本)`,
        description: `按区分大小写的非空文本标记查找${lingCppType}，找不到时返回无效引用。`,
        insertText: `${contract.lookupByTagTextCommand}("$1")`,
        returnType: lingCppType
      }, {
        name: contract.lookupByTagIntegerCommand,
        signature: `${contract.lookupByTagIntegerCommand}(标记整数)`,
        description: `按有符号 32 位整数标记查找${lingCppType}，找不到时返回无效引用。`,
        insertText: `${contract.lookupByTagIntegerCommand}($1)`,
        returnType: lingCppType
      }, ...runtimeEvents.flatMap(item => [{
        name: item.bindCommand,
        signature: `${item.bindCommand}(控件, 处理器)`,
        description: `为${lingCppType}实例绑定“${item.event.label}”处理器，处理器必须使用 &名称。`,
        insertText: `${item.bindCommand}($1, &$2)`,
        returnType: '逻辑型'
      }, {
        name: item.unbindCommand,
        signature: `${item.unbindCommand}(控件)`,
        description: `移除${lingCppType}实例由代码绑定的“${item.event.label}”处理器。`,
        insertText: `${item.unbindCommand}($1)`,
        returnType: '逻辑型'
      }])],
      bindings: [{
        command: contract.createCommand,
        runtimeName: contract.createCommand,
        parameters: [{
          name: '父级', type: 'controlRef', description: '当前窗口、new_emoji 容器或标签页页面。',
          controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId'
        },
        { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' },
        { name: '宽度', type: 'int' }, { name: '高度', type: 'int' },
        { name: '文本', type: 'wideString' },
        { name: '标记文本', type: 'wideString', optional: true, defaultValue: '' },
        { name: '标记整数', type: 'int', optional: true, defaultValue: null }],
        returnType: lingCppType,
        encoding: 'wide',
        example: `${contract.createCommand}(当前窗口, 20, 20, 120, 36, "${lingCppType}", "", 0)`
      }, {
        command: contract.lookupByTagTextCommand,
        runtimeName: contract.lookupByTagTextCommand,
        parameters: [{ name: '标记文本', type: 'wideString' }],
        returnType: lingCppType,
        encoding: 'wide'
      }, {
        command: contract.lookupByTagIntegerCommand,
        runtimeName: contract.lookupByTagIntegerCommand,
        parameters: [{ name: '标记整数', type: 'int' }],
        returnType: lingCppType
      }, ...runtimeEvents.flatMap(item => {
        const controlParameter = {
          name: '控件', type: 'controlRef', controlTypes: [control.namespacedType], controlKinds: ['visual'],
          scope: 'currentWindow', runtimeRepresentation: 'stableId'
        };
        return [{
          command: item.bindCommand,
          runtimeName: item.bindCommand,
          parameters: [controlParameter, {
            name: '处理器', type: 'handler', handlerSignature: {
              // 处理器签名必须用 .lcpp 中文类型名；目录事件的参数类型是 C++ 风格（int/wideString），
              // 直接透传会让语言服务的签名校验把合法处理器判为不匹配。
              parameterTypes: (item.event.parameters || []).map(parameter => toLingCppEventParameterType(parameter.type)),
              returnType: '空'
            }
          }],
          returnType: 'bool'
        }, {
          command: item.unbindCommand,
          runtimeName: item.unbindCommand,
          parameters: [controlParameter],
          returnType: 'bool'
        }];
      })]
    };
  });
}

function newEmojiLingCppType(control) {
  const englishSuffix = new RegExp(`\\s+${escapeRegExp(control.type)}$`, 'iu');
  const label = String(control.label || control.type).replace(englishSuffix, '').replace(/[^\p{L}\p{N}_]+/gu, '');
  return `NE${label || control.type.replace(/[^A-Za-z0-9_]+/gu, '')}`;
}

function toLingCppEventParameterType(type) {
  if (type === 'int') return '整数型';
  if (type === 'wideString') return '文本型';
  if (type === 'bool') return '逻辑型';
  if (type === 'float' || type === 'double') return '小数型';
  if (type === 'longLong') return '长整数型';
  return type;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function newEmojiDesignerControls(catalog) {
  const componentTypes = new Map(catalog.components.map(component => [
    component.id,
    component.namespacedId || `${MODULE_ID}/${component.id}`
  ]));
  const containerTypes = catalog.components
    .filter(component => component.isVisual !== false && component.isContainer === true)
    .map(component => component.namespacedId || `${MODULE_ID}/${component.id}`);
  return catalog.components.map(component => {
    const extraEvents = COMPONENT_EXTRA_EVENTS[component.id] || [];
    const componentEvents = [...(component.events || []), ...(component.isVisual === false ? [] : COMMON_DESIGNER_EVENTS), ...extraEvents]
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
    const properties = (component.properties || []).map(property => {
      const contractKey = `${component.id}.${property.key}`;
      const relationship = NEW_EMOJI_DESIGNER_RELATIONSHIPS[contractKey];
      const recordList = NEW_EMOJI_DESIGNER_RECORD_LISTS[contractKey];
      return {
        key: property.key,
        label: property.label,
        type: relationship ? 'controlRef' : recordList ? 'recordList' : property.type,
        defaultValue: relationship
          ? ''
          : recordList
            ? recordList.defaultValue
            : component.id === 'Tabs' && property.key === 'contentVisible'
              ? true
              : property.defaultValue,
        options: property.options,
        description: property.description,
        group: property.group,
        level: property.level,
        ...(relationship ? {
          controlTypes: relationship.controlTypes === 'containers'
            ? containerTypes
            : (relationship.controlTypes || []).map(type => componentTypes.get(type) || `${MODULE_ID}/${type}`),
          controlKinds: ['visual'],
          scope: 'currentWindow',
          runtimeRepresentation: 'stableId'
        } : {}),
        ...(recordList ? {
          recordKey: recordList.recordKey,
          fields: recordList.fields.map(field => ({
            ...field,
            ...(field.controlTypes ? {
              controlTypes: field.controlTypes.map(type => componentTypes.get(type) || `${MODULE_ID}/${type}`)
            } : {})
          }))
        } : {}),
        ...(createPropertyKeys.has(property.key)
          ? { runtimeCommand: component.createExport }
          : setterByProperty.has(property.key)
            ? { runtimeCommand: setterByProperty.get(property.key) }
            : {})
      };
    });
    for (const synthetic of NEW_EMOJI_SYNTHETIC_RECORD_LISTS[component.id] || []) {
      properties.push({
        ...synthetic,
        type: 'recordList',
        defaultValue: synthetic.defaultValue || [],
        fields: synthetic.fields.map(field => ({
          ...field,
          ...(field.controlTypes ? {
            controlTypes: field.controlTypes.map(type => componentTypes.get(type) || `${MODULE_ID}/${type}`)
          } : {})
        }))
      });
    }
    if (component.id === 'Container' && !properties.some(property => property.key === 'flowEnabled')) {
      properties.push({
        key: 'flowEnabled',
        label: '启用流式布局',
        type: 'boolean',
        defaultValue: true,
        description: '关闭后保留子控件的绝对坐标，适用于浏览器外壳等自由布局。',
        group: '布局',
        level: 'basic',
        runtimeCommand: 'EU_SetContainerLayout'
      });
    }
    if (component.id === 'IconButton' && !properties.some(property => property.key === 'windowCommand')) {
      properties.push({
        key: 'windowCommand',
        label: '窗口命令',
        type: 'enum',
        defaultValue: '0',
        options: [
          { value: '0', label: '无' },
          { value: '1', label: '最小化' },
          { value: '2', label: '最大化/还原' },
          { value: '3', label: '关闭' }
        ],
        description: '为浏览器框架窗口提供原生窗口按钮命中行为。',
        group: '窗口框架',
        level: 'basic',
        runtimeCommand: 'NE_设置元素窗口命令'
      });
    }
    if (component.id === 'Tabs') {
      properties.push(
        {
          key: 'chromeMode', label: 'Chrome 标签样式', type: 'boolean', defaultValue: false,
          description: '启用浏览器式标签页绘制。', group: '浏览器外壳', level: 'basic', runtimeCommand: 'EU_SetTabsChromeMode'
        },
        {
          key: 'chromeMinWidth', label: '标签最小宽度', type: 'number', defaultValue: 96,
          description: 'Chrome 模式下单个标签页的最小逻辑宽度。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsChromeMetrics'
        },
        {
          key: 'chromeMaxWidth', label: '标签最大宽度', type: 'number', defaultValue: 220,
          description: 'Chrome 模式下单个标签页的最大逻辑宽度。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsChromeMetrics'
        },
        {
          key: 'chromePinnedWidth', label: '固定标签宽度', type: 'number', defaultValue: 46,
          description: 'Chrome 模式下固定标签页的逻辑宽度。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsChromeMetrics'
        },
        {
          key: 'chromeTabHeight', label: '标签高度', type: 'number', defaultValue: 32,
          description: 'Chrome 模式下标签页标题的逻辑高度。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsChromeMetrics'
        },
        {
          key: 'chromeOverlap', label: '标签重叠', type: 'number', defaultValue: 0,
          description: '相邻 Chrome 标签页的重叠逻辑像素。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsChromeMetrics'
        },
        {
          key: 'newButtonVisible', label: '内置新建按钮', type: 'boolean', defaultValue: true,
          description: '显示 Tabs 自带的新建标签按钮；独立按钮布局可关闭此项。', group: '浏览器外壳', level: 'basic', runtimeCommand: 'EU_SetTabsNewButtonVisible'
        },
        {
          key: 'reorderEnabled', label: '允许标签重排', type: 'boolean', defaultValue: true,
          description: '允许用户拖动标签页改变顺序。', group: '浏览器外壳', level: 'basic', runtimeCommand: 'EU_SetTabsDragOptions'
        },
        {
          key: 'detachEnabled', label: '允许标签分离', type: 'boolean', defaultValue: false,
          description: '允许把标签页拖出当前窗口。', group: '浏览器外壳', level: 'advanced', runtimeCommand: 'EU_SetTabsDragOptions'
        }
      );
    }
    if (component.id === 'Menu') {
      properties.push(
        {
          key: 'anchorElementId', label: '弹层锚点', type: 'controlRef', defaultValue: '',
          description: '菜单弹出时使用的可视控件稳定 ID。', group: '弹层', level: 'basic',
          controlTypes: [], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId',
          runtimeCommand: 'EU_SetPopupAnchorElement'
        },
        {
          key: 'popupTrigger', label: '弹出触发', type: 'enum', defaultValue: 'none',
          options: [
            { value: 'none', label: '仅由代码控制' },
            { value: 'dropdown', label: '按钮下拉' },
            { value: 'right_click', label: '右键' },
            { value: 'left_click', label: '左键' },
            { value: 'hover', label: '悬停' }
          ],
          description: '右键等触发会在创建全部控件后绑定到锚点。', group: '弹层', level: 'basic', runtimeCommand: 'EU_SetElementPopup'
        },
        {
          key: 'popupPlacement', label: '弹出位置', type: 'number', defaultValue: 3,
          description: 'new_emoji 原生弹层位置编号。', group: '弹层', level: 'basic', runtimeCommand: 'EU_SetPopupPlacement'
        },
        {
          key: 'popupOffsetX', label: '水平偏移', type: 'number', defaultValue: 0,
          description: '弹层相对锚点的水平逻辑像素偏移。', group: '弹层', level: 'advanced', runtimeCommand: 'EU_SetPopupPlacement'
        },
        {
          key: 'popupOffsetY', label: '垂直偏移', type: 'number', defaultValue: 0,
          description: '弹层相对锚点的垂直逻辑像素偏移。', group: '弹层', level: 'advanced', runtimeCommand: 'EU_SetPopupPlacement'
        },
        {
          key: 'popupOpen', label: '初始打开', type: 'boolean', defaultValue: false,
          description: '窗口创建后是否立即打开菜单。', group: '弹层', level: 'advanced', runtimeCommand: 'EU_SetPopupOpen'
        },
        {
          key: 'popupCloseOnOutside', label: '外部单击关闭', type: 'boolean', defaultValue: true,
          description: '单击菜单外部时关闭弹层。', group: '弹层', level: 'basic', runtimeCommand: 'EU_SetPopupDismissBehavior'
        },
        {
          key: 'popupCloseOnEscape', label: 'Escape 关闭', type: 'boolean', defaultValue: true,
          description: '按 Escape 时关闭弹层。', group: '弹层', level: 'basic', runtimeCommand: 'EU_SetPopupDismissBehavior'
        }
      );
    }
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
      ...(component.isContainer === true ? {
        layout: component.id === 'Tabs' ? {
          mode: 'slots',
          coordinateSpace: 'window',
          adapterId: 'new-emoji.tabs.pages'
        } : {
          mode: 'absolute',
          coordinateSpace: 'window',
          adapterId: `new-emoji.${component.id.toLowerCase()}.absolute`
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
        parameters: NEW_EMOJI_EVENT_PARAMETERS[`${component.id}.${event.name}`] || event.parameters || [],
        ...(NEW_EMOJI_EVENT_STARTERS[`${component.id}.${event.name}`]
          ? { starterStatements: NEW_EMOJI_EVENT_STARTERS[`${component.id}.${event.name}`] }
          : {}),
        ...(bindingByEvent.has(event.name) ? { runtimeCommand: bindingByEvent.get(event.name) } : {})
      })),
      runtime: {
        createCommand: component.createExport,
        createReturnType: createExport.returnType,
        createParameters,
        ...(APPLY_CONTENT_COMMANDS[component.id] ? { applyContentCommand: APPLY_CONTENT_COMMANDS[component.id] } : {}),
        propertyCommands: specialPropertyCommands,
        propertySetters,
        eventBindings
      }
    };
  });
}

const NEW_EMOJI_DESIGNER_RELATIONSHIPS = {
  'Anchor.targetContainerId': { controlTypes: 'containers' },
  'Watermark.containerId': { controlTypes: 'containers' },
  'Tour.targetElementId': {},
  'Loading.targetElementId': {},
  'Popover.anchorElementId': {},
  'IconButton.dropdownElementId': { controlTypes: ['Dropdown', 'Menu', 'Popover'] }
};

const NEW_EMOJI_DESIGNER_RECORD_LISTS = {
  'Tabs.items': {
    recordKey: 'id',
    defaultValue: [{ id: 'page1', title: '标签页 1', icon: '', closable: true, disabled: false, pinned: false, loading: false, muted: false, alerting: false }],
    fields: [
      { key: 'id', label: '稳定 ID', type: 'text', required: true },
      { key: 'title', label: '标题', type: 'text', required: true },
      { key: 'icon', label: '图标', type: 'text', defaultValue: '' },
      { key: 'closable', label: '可关闭', type: 'boolean', defaultValue: true },
      { key: 'disabled', label: '禁用', type: 'boolean', defaultValue: false },
      { key: 'pinned', label: '固定', type: 'boolean', defaultValue: false },
      { key: 'loading', label: '加载中', type: 'boolean', defaultValue: false },
      { key: 'muted', label: '静音', type: 'boolean', defaultValue: false },
      { key: 'alerting', label: '提醒', type: 'boolean', defaultValue: false }
    ]
  },
  'Omnibox.suggestions': {
    recordKey: 'id',
    defaultValue: [],
    fields: [
      { key: 'id', label: '稳定 ID', type: 'text', required: true },
      { key: 'title', label: '标题', type: 'text', required: true },
      { key: 'url', label: '地址', type: 'text', defaultValue: '' },
      { key: 'icon', label: '图标', type: 'text', defaultValue: '' },
      { key: 'description', label: '说明', type: 'text', defaultValue: '' }
    ]
  },
  'Omnibox.actionIcons': {
    recordKey: 'id',
    defaultValue: [],
    fields: [
      { key: 'id', label: '稳定 ID', type: 'text', required: true },
      { key: 'icon', label: '图标', type: 'text', required: true },
      { key: 'tooltip', label: '提示', type: 'text', defaultValue: '' },
      { key: 'enabled', label: '启用', type: 'boolean', defaultValue: true }
    ]
  }
};

const NEW_EMOJI_SYNTHETIC_RECORD_LISTS = {
  Menu: [{
    key: 'menuItems',
    label: '菜单项',
    recordKey: 'id',
    defaultValue: [],
    group: '菜单项',
    level: 'basic',
    runtimeCommand: 'LB_NE_ApplyMenuItems',
    fields: [
      { key: 'id', label: '稳定 ID', type: 'text', required: true },
      { key: 'command', label: '命令', type: 'text', required: true },
      { key: 'title', label: '标题', type: 'text', required: true },
      { key: 'icon', label: '图标', type: 'text', defaultValue: '' },
      { key: 'shortcut', label: '快捷键', type: 'text', defaultValue: '' },
      { key: 'separator', label: '分隔符', type: 'boolean', defaultValue: false },
      { key: 'checked', label: '勾选', type: 'boolean', defaultValue: false },
      { key: 'disabled', label: '禁用', type: 'boolean', defaultValue: false },
      {
        key: 'submenu', label: '子菜单', type: 'controlRef', defaultValue: '', controlTypes: ['Menu'],
        controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId'
      }
    ]
  }]
};

const CREATE_PARAMETER_ALIASES = {
  MessageBox: { text: 'body', boxType: 'messageType' },
  RichList: { template: 'templateJson', items: 'itemsJson' },
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
  'Container.EU_SetContainerLayout': { enabled: 'flowEnabled', direction: 'orientation' },
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
  'RichList.EU_SetRichListTemplate': { bytes: 'templateJson' },
  'RichList.EU_SetRichListItems': { bytes: 'itemsJson' },
  'RichList.EU_SetRichListSelectedKeys': { bytes: 'selectedKeys' },
  'RichList.EU_SetRichListVirtualItemCount': { count: 'virtualItemCount' },
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

const eventParameter = (name, type, description) => ({ name, type, description });

const COMMON_DESIGNER_EVENTS = [
  { name: 'MouseEnter', label: '鼠标进入', group: '鼠标' },
  { name: 'MouseLeave', label: '鼠标离开', group: '鼠标' },
  { name: 'MouseDown', label: '鼠标按下', group: '鼠标', parameters: [
    eventParameter('横坐标', 'int', '相对控件内容区的 X 坐标。'), eventParameter('纵坐标', 'int', '相对控件内容区的 Y 坐标。'),
    eventParameter('鼠标按钮', 'int', '1 表示左键，2 表示右键。')
  ] },
  { name: 'MouseUp', label: '鼠标抬起', group: '鼠标', parameters: [
    eventParameter('横坐标', 'int', '相对控件内容区的 X 坐标。'), eventParameter('纵坐标', 'int', '相对控件内容区的 Y 坐标。'),
    eventParameter('鼠标按钮', 'int', '1 表示左键，2 表示右键。')
  ] },
  { name: 'MouseDoubleClick', label: '鼠标双击', group: '鼠标', parameters: [
    eventParameter('横坐标', 'int', '相对控件内容区的 X 坐标。'), eventParameter('纵坐标', 'int', '相对控件内容区的 Y 坐标。'),
    eventParameter('鼠标按钮', 'int', '当前为 1，表示左键。')
  ] },
  { name: 'MouseMove', label: '鼠标移动', group: '鼠标', parameters: [
    eventParameter('横坐标', 'int', '相对控件内容区的 X 坐标。'), eventParameter('纵坐标', 'int', '相对控件内容区的 Y 坐标。')
  ] },
  { name: 'MouseWheel', label: '鼠标滚轮', group: '鼠标', parameters: [
    eventParameter('横坐标', 'int', '相对控件内容区的 X 坐标。'), eventParameter('纵坐标', 'int', '相对控件内容区的 Y 坐标。'),
    eventParameter('滚轮增量', 'int', 'Win32 滚轮增量，正数向上、负数向下。')
  ] },
  { name: 'GotFocus', label: '获得焦点', group: '焦点' },
  { name: 'LostFocus', label: '失去焦点', group: '焦点' }
];

const NEW_EMOJI_EVENT_PARAMETERS = {
  'Table.CellClicked': [
    eventParameter('行号', 'int', '从 0 开始的行索引。'),
    eventParameter('列号', 'int', '从 0 开始的列索引。')
  ],
  'Table.CellAction': [
    eventParameter('行号', 'int', '从 0 开始的行索引。'),
    eventParameter('列号', 'int', '从 0 开始的列索引。'),
    eventParameter('动作', 'int', '单元格动作编号。'),
    eventParameter('值', 'int', '动作附加值。')
  ],
  'Table.CellEdit': [
    eventParameter('行号', 'int', '从 0 开始的行索引。'),
    eventParameter('列号', 'int', '从 0 开始的列索引。'),
    eventParameter('动作', 'int', '1 开始、2 提交、3 取消。'),
    eventParameter('文本', 'wideString', '按 UTF-8 解码后的单元格文本。')
  ],
  'Table.ContextMenu': [
    eventParameter('行号', 'int', '从 0 开始的行索引，非数据区可能为 -1。'),
    eventParameter('列号', 'int', '从 0 开始的列索引，非数据区可能为 -1。'),
    eventParameter('区域', 'int', '1 单元格、2 表头、3 空白、4 滚动条或非数据区。'),
    eventParameter('横坐标', 'int', '右键位置的 X 坐标。'),
    eventParameter('纵坐标', 'int', '右键位置的 Y 坐标。')
  ],
  'Table.VirtualRow': [eventParameter('行号', 'int', '当前请求的虚拟行索引，从 0 开始。')],
  'Tabs.SelectionChanged': [
    eventParameter('选中索引', 'int', '当前激活标签页的索引，从 0 开始；没有项目时为 -1。'),
    eventParameter('项目数量', 'int', '当前标签页项目总数。'),
    eventParameter('动作', 'int', '动作编号：1 代码设置，2 鼠标，3 键盘，4 关闭，5 新增，6 滚动。')
  ],
  'Omnibox.TextChanged': [
    eventParameter('地址', 'wideString', '用户提交的 UTF-8 地址或搜索文本。')
  ],
  'Omnibox.ValueChanged': [
    eventParameter('图标索引', 'int', '被触发动作图标的索引。'),
    eventParameter('起始位置', 'int', '上游回调提供的选择起始位置。'),
    eventParameter('结束位置', 'int', '上游回调提供的选择结束位置。')
  ],
  'Menu.MenuCommand': [
    eventParameter('项目索引', 'int', '从 0 开始的菜单项索引。'),
    eventParameter('菜单路径', 'wideString', '按 UTF-8 解码后的层级菜单路径。'),
    eventParameter('命令', 'wideString', '菜单项 recordList 中保存的稳定命令。')
  ],
  'ListBox.SelectionChanged': [
    eventParameter('选中键列表', 'wideString', '当前选中项目的 key 列表，按 new_emoji 的 UTF-8 文本协议返回。')
  ],
  'ListBox.ItemClicked': [
    eventParameter('项目索引', 'int', '被点击项目的索引，从 0 开始。'),
    eventParameter('起始位置', 'int', '通用值范围起点；列表框项目点击当前为 0。'),
    eventParameter('结束位置', 'int', '通用值范围终点；列表框项目点击当前为 0。')
  ],
  'ListBox.ItemDoubleClicked': [
    eventParameter('项目索引', 'int', '被双击或通过键盘确认的项目索引，从 0 开始。'),
    eventParameter('触发方式', 'int', '0 表示鼠标双击，1 表示键盘 Enter。'),
    eventParameter('附加值', 'int', '回调保留附加值；当前列表框双击为 0。')
  ],
  'ListBox.Edit': [
    eventParameter('项目索引', 'int', '正在编辑的项目索引，从 0 开始。'),
    eventParameter('编辑字段', 'int', '0 文本、1 描述、2 标签、3 value。'),
    eventParameter('动作', 'int', '1 开始、2 提交、3 取消。'),
    eventParameter('文本', 'wideString', '编辑动作对应的 UTF-8 文本。')
  ],
  'ListBox.Reorder': [
    eventParameter('原索引', 'int', '拖拽前项目索引，从 0 开始。'),
    eventParameter('新索引', 'int', '拖拽后项目索引，从 0 开始。'),
    eventParameter('数量', 'int', '本次重排的项目数量。')
  ],
  'ListBox.ContextMenu': [
    eventParameter('项目索引', 'int', '触发右键菜单的项目索引，从 0 开始。'),
    eventParameter('横坐标', 'int', '右键位置相对控件内容区的 X 坐标。'),
    eventParameter('纵坐标', 'int', '右键位置相对控件内容区的 Y 坐标。')
  ],
  'RichList.SelectionChanged': [
    eventParameter('选中键列表', 'wideString', '当前选中项目 key 的 JSON 数组。')
  ],
  'RichList.ItemClicked': [eventParameter('事件数据', 'wideString', '包含项目 key、索引和坐标的原生 JSON。')],
  'RichList.ItemDoubleClicked': [eventParameter('事件数据', 'wideString', '包含项目 key、索引和坐标的原生 JSON。')],
  'RichList.ButtonClicked': [eventParameter('事件数据', 'wideString', '包含项目、节点和 actionId 的原生 JSON。')],
  'RichList.BadgeClicked': [eventParameter('事件数据', 'wideString', '包含项目、节点和 actionId 的原生 JSON。')],
  'RichList.CountdownEnd': [eventParameter('事件数据', 'wideString', '包含项目、倒计时节点和 actionId 的原生 JSON。')],
  'RichList.ContextMenu': [eventParameter('事件数据', 'wideString', '包含项目 key、索引和坐标的原生 JSON。')],
  'RichList.VirtualRow': [eventParameter('行号', 'int', '当前请求的虚拟条目索引，从 0 开始。')]
  ,
  'Tabs.ItemClosed': [eventParameter('项目索引', 'int', '被关闭标签页的索引，从 0 开始。')],
  'Tabs.ItemAdded': [eventParameter('新项目索引', 'int', '新增标签页的索引，从 0 开始。')],
  'Tabs.ItemsReordered': [
    eventParameter('原索引', 'int', '被拖动标签页的原索引，从 0 开始。'),
    eventParameter('新索引', 'int', '拖放后的新索引，从 0 开始。'),
    eventParameter('项目总数', 'int', '重排完成后的项目总数。')
  ],
  'Menu.ContextMenu': [
    eventParameter('项目索引', 'int', '右键命中的菜单项目索引，从 0 开始。'),
    eventParameter('附加值一', 'int', '原生回调 range_start，含义随控件实现。'),
    eventParameter('附加值二', 'int', '原生回调 range_end，含义随控件实现。')
  ]
};

const NEW_EMOJI_EVENT_STARTERS = {
  'Table.VirtualRow': ['NE_设置表格虚拟行数据("")'],
  'RichList.VirtualRow': ['NE富列表_设置虚拟行数据("")']
};

// 创建函数不携带文本参数的组件：设计器「显示内容」在创建后经该原生命令写入（ABI：hwnd, element_id, bytes, len）。
const APPLY_CONTENT_COMMANDS = {
  EditBox: 'EU_SetElementText'
};

// 生成器侧合成的组件事件：上游目录没有对应事件、但原生导出具备该回调能力。
const COMPONENT_EXTRA_EVENTS = {
  Tabs: [
    { name: 'ItemClosed', label: '关闭标签页', group: '标签页', parameters: [
      eventParameter('项目索引', 'int', '被关闭标签页的索引，从 0 开始。')
    ] },
    { name: 'ItemAdded', label: '新增标签页', group: '标签页', parameters: [
      eventParameter('新项目索引', 'int', '新增标签页的索引，从 0 开始。')
    ] },
    { name: 'ItemsReordered', label: '拖拽重排', group: '标签页', parameters: [
      eventParameter('原索引', 'int', '被拖动标签页的原索引，从 0 开始。'),
      eventParameter('新索引', 'int', '拖放后的新索引，从 0 开始。'),
      eventParameter('项目总数', 'int', '重排完成后的项目总数。')
    ] }
  ],
  Menu: [
    { name: 'ContextMenu', label: '右键菜单', group: '鼠标', parameters: [
      eventParameter('项目索引', 'int', '右键命中的菜单项目索引，从 0 开始。'),
      eventParameter('附加值一', 'int', '原生回调 range_start，含义随控件实现。'),
      eventParameter('附加值二', 'int', '原生回调 range_end，含义随控件实现。')
    ] }
  ],
  RichList: [
    { name: 'VirtualRow', label: '虚拟数据源', group: '数据', parameters: [
      eventParameter('行号', 'int', '当前请求的虚拟条目索引，从 0 开始。')
    ] }
  ]
};

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
  'RichList.SelectionChanged': ['EU_SetRichListChangeCallback', 'ElementTextCallback'],
  'RichList.ItemClicked': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.ItemDoubleClicked': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.ButtonClicked': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.BadgeClicked': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.CountdownEnd': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.ContextMenu': ['EU_SetRichListEventCallback', 'RichListEventCallback'],
  'RichList.VirtualRow': ['EU_SetRichListVirtualItemProvider', 'RichListVirtualItemCallback'],
  'Tabs.ItemClosed': ['EU_SetTabsCloseCallback', 'ElementValueCallback'],
  'Tabs.ItemAdded': ['EU_SetTabsAddCallback', 'ElementValueCallback'],
  'Tabs.ItemsReordered': ['EU_SetTabsReorderCallback', 'ElementReorderCallback'],
  'Menu.ContextMenu': ['EU_SetContextMenuCallback', 'ElementValueCallback'],
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

const RICH_LIST_EVENT_PAYLOADS = {
  'RichList.ItemClicked': 'item_click',
  'RichList.ItemDoubleClicked': 'item_double_click',
  'RichList.ButtonClicked': 'button_click',
  'RichList.BadgeClicked': 'badge_click',
  'RichList.CountdownEnd': 'countdown_end',
  'RichList.ContextMenu': 'context_menu'
};

function inferEventBindings(component, rawExports) {
  const available = new Set(rawExports.map(item => item.name));
  return (component.events || []).flatMap(event => {
    const binding = EVENT_BINDINGS[`${component.id}.${event.name}`] || COMMON_EVENT_BINDINGS[event.name];
    if (!binding || !available.has(binding[0])) return [];
    const aliases = newEmojiEventAliases(component.id, event.name);
    const payloadEvent = RICH_LIST_EVENT_PAYLOADS[`${component.id}.${event.name}`];
    return [{ eventName: event.name, ...(aliases.length ? { aliases } : {}), command: binding[0], callbackType: binding[1], ...(binding[2] === undefined ? {} : { eventCode: binding[2] }), ...(payloadEvent ? { payloadEvent } : {}) }];
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
  if (/Table|Descriptions|RichList/u.test(type)) return 'ListView';
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
  if (/标题|文本|表情|内容|图片源|项目|^提示$|初始文件|文件类型|行数据/u.test(name)) return 'wideString';
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
HWND NE_创建浏览器外壳窗口(const wchar_t* title, int x, int y, int width, int height);
HWND NE_创建自定义框架窗口(const wchar_t* title, int x, int y, int width, int height, int frameFlags);
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
void NE_设置表格虚拟行数据(const wchar_t* rowData);
void NE_清空表格虚拟行数据();
const wchar_t* NE_取表格虚拟行数据();
void NE_设置元素状态(HWND hwnd, int elementId, int visible, int enabled, unsigned int background, unsigned int foreground);
void NE_设置元素焦点(HWND hwnd, int elementId);
void NE_设置元素字体(HWND hwnd, int elementId, const wchar_t* fontFamily, int fontSize);
void NE_设置窗口标题(HWND hwnd, const wchar_t* title);
void NE_设置窗口缩放边框(HWND hwnd, int left, int top, int right, int bottom);
void NE_清空窗口拖拽区(HWND hwnd);
void NE_设置窗口拖拽区(HWND hwnd, int x, int y, int width, int height, int enabled);
void NE_清空窗口非拖拽区(HWND hwnd);
void NE_设置窗口非拖拽区(HWND hwnd, int x, int y, int width, int height, int enabled);
void NE_设置元素窗口命令(HWND hwnd, int elementId, int command);
void NE_设置窗口圆角(HWND hwnd, int enabled, int radius);
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
__declspec(dllimport) HWND __stdcall EU_CreateWindowEx(const unsigned char* title_bytes, int title_len, int x, int y, int w, int h, NEColor titlebar_color, int frame_flags);
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
__declspec(dllimport) void __stdcall EU_SetWindowResizeBorder(HWND hwnd, int left, int top, int right, int bottom);
__declspec(dllimport) void __stdcall EU_ClearWindowDragRegions(HWND hwnd);
__declspec(dllimport) void __stdcall EU_SetWindowDragRegion(HWND hwnd, int x, int y, int w, int h, int enabled);
__declspec(dllimport) void __stdcall EU_ClearWindowNoDragRegions(HWND hwnd);
__declspec(dllimport) void __stdcall EU_SetWindowNoDragRegion(HWND hwnd, int x, int y, int w, int h, int enabled);
__declspec(dllimport) void __stdcall EU_SetElementWindowCommand(HWND hwnd, int element_id, int command);
__declspec(dllimport) void __stdcall EU_SetWindowRoundedCorners(HWND hwnd, int enabled, int radius);

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
static thread_local std::wstring g_neTableVirtualRowData;

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

HWND NE_创建自定义框架窗口(const wchar_t* title, int x, int y, int width, int height, int frameFlags) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    HWND hwnd = EU_CreateWindowEx(reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), x, y, width, height, 0xFF202020, frameFlags);
    if (hwnd) EU_ShowWindow(hwnd, 1);
    return hwnd;
}

HWND NE_创建浏览器外壳窗口(const wchar_t* title, int x, int y, int width, int height) {
    return NE_创建自定义框架窗口(title, x, y, width, height, 0x3F);
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

void NE_设置窗口缩放边框(HWND hwnd, int left, int top, int right, int bottom) { EU_SetWindowResizeBorder(hwnd, left, top, right, bottom); }
void NE_清空窗口拖拽区(HWND hwnd) { EU_ClearWindowDragRegions(hwnd); }
void NE_设置窗口拖拽区(HWND hwnd, int x, int y, int width, int height, int enabled) { EU_SetWindowDragRegion(hwnd, x, y, width, height, enabled); }
void NE_清空窗口非拖拽区(HWND hwnd) { EU_ClearWindowNoDragRegions(hwnd); }
void NE_设置窗口非拖拽区(HWND hwnd, int x, int y, int width, int height, int enabled) { EU_SetWindowNoDragRegion(hwnd, x, y, width, height, enabled); }
void NE_设置元素窗口命令(HWND hwnd, int elementId, int command) { EU_SetElementWindowCommand(hwnd, elementId, command); }
void NE_设置窗口圆角(HWND hwnd, int enabled, int radius) { EU_SetWindowRoundedCorners(hwnd, enabled, radius); }

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
void NE_设置表格虚拟行数据(const wchar_t* rowData) { g_neTableVirtualRowData = rowData ? rowData : L""; }
void NE_清空表格虚拟行数据() { g_neTableVirtualRowData.clear(); }
const wchar_t* NE_取表格虚拟行数据() { return g_neTableVirtualRowData.c_str(); }

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

## 运行时控件引用

93 个公开可视控件都提供类型化 LingCpp 变量、高层创建、文本标记查找、整数标记查找和已声明事件的绑定/解绑命令。创建命令统一为 \`控件_创建NE类型(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])\`；父级可使用只读 \`当前窗口\`、容器引用或标签页容器。代码创建的元素只属于本次窗口运行时，不写回设计器模型。

标记始终可省略。文本标记会先去除首尾空白，空文本表示未设置，并按区分大小写的 UTF-16 文本精确匹配；整数标记是有符号 32 位值，0 和负数都有效。非空标记在“当前窗口 + 具体控件类型 + 标记类别”范围内唯一，重复创建返回无效引用并输出中文原因。只传整数标记时，文本位置传 \`""\`。

\`控件_是否有效\`用于检查创建或查找结果。窗口销毁后引用自动失效；对无效引用执行操作会安全失败，不访问旧元素 ID。通用命令、专属 \`NE_EU_*\` 命令和成员语法都接受兼容的控件变量；专属命令会按具体控件类型诊断错误变量。原生元素 ID 参数在 binding 中使用 \`controlRef(stableId)\`，输出指针、请求 ID、索引和 ID 数组仍保持原 ABI 类型。

\`\`\`lcpp
局部 NE按钮 动态按钮 = 控件_创建NE按钮(当前窗口, 20, 20, 120, 36, "确定", "确认", 1002)
局部 NE按钮 查找按钮 = 通过标记文本获取NE按钮("确认")
如果 (控件_是否有效(查找按钮))
    查找按钮.内容 = "已找到"
    NE按钮_绑定被点击(查找按钮, &动态按钮被点击)
如果结束
\`\`\`

非可视组件不生成上述接口。运行时控件引用只能作为局部变量、方法参数或返回值，不能作为常量、数组、程序集成员、项目全局变量，也不能传入工作线程。

RichList / 富列表已作为命名空间设计器控件提供，设计器属性直接配置模板 JSON、项目 JSON、选择模式、样式、滚动和虚拟项目数。选择变化事件返回选中 key 的 JSON 数组，其余富列表事件返回包含 event、itemKey、itemIndex、nodeId、actionId、x、y 的原生 JSON。

## 数据桥接命令（宽字符版）

下列命令为底层 UTF-8 字节指针导出的宽字符封装，\`.lcpp\` 直接传字符串即可，生成器自动完成 UTF-8 转换；请勿改调参数相同的 \`NE_EU_*\` 底层命令（宽指针与字节指针 ABI 不匹配，无法编译）：

- 表格数据：\`NE表格_设置列\` / \`NE表格_设置行数据\` / \`NE表格_添加行\` / \`NE表格_插入行\`（列与行使用 new_emoji 高阶 JSON 协议文本）。
- 富列表数据：\`NE富列表_设置模板\` / \`NE富列表_设置条目\` / \`NE富列表_添加条目\` / \`NE富列表_设置选中键\` / \`NE富列表_设置倒计时\` / \`NE富列表_设置倒计时状态\`；虚拟列表在 \`NE富列表_绑定虚拟数据源\` 的处理器中调用 \`NE富列表_设置虚拟行数据("条目 JSON")\` 回填（与表格的 \`NE_设置表格虚拟行数据\` 同范式）。
- 菜单项目：\`NE菜单_设置项目\`（换行分隔项目，\`>\` 前缀表示子菜单层级）/ \`NE菜单_设置项目图标\` / \`NE菜单_设置项目快捷键\` / \`NE菜单_设置项目元数据\`。
- 徽标文本：\`NE徽标_设置文本\`。
- 标签页运行时：\`NE标签页_设置激活索引\` / \`取激活索引\` / \`取激活标题\` / \`取项目数量\` / \`添加项目\` / \`关闭项目\` / \`设置滚动偏移\` / \`滚动\`，以及运行时样式族 \`设置标签样式\`（0 线条、1 卡片、2 边框卡片）/ \`设置标签位置\`（0 顶部、1 右侧、2 底部、3 左侧）/ \`设置表头对齐\` / \`设置表头可见\` / \`设置可编辑\` / \`设置内容可见\` / \`启用浏览器模式\` / \`设置浏览器度量\` / \`设置项目图标\` / \`设置项目可关闭\` / \`设置项目状态\`（加载中/固定/静音/提醒）/ \`设置新建按钮可见\` / \`设置拖拽选项\`。
- 窗口级：\`NE_设置窗口图标\`（.ico 文件路径）、\`NE_设置主题令牌\`（令牌名 + 0xAARRGGBB 颜色值）。
- 消息框：\`NE_显示消息框\` / \`NE_显示确认框\` / \`NE_显示扩展消息框\`。处理器使用 \`&处理器名\` 引用；结果值 1 确认、2 取消/关闭，扩展消息框额外携带输入文本。这些命令的窗口句柄参数可写 \`当前窗口\`。

- Post 异步投递族：\`NE表格_投递设置行数据 / 投递添加行 / 投递插入行 / 投递清空行\`、\`NE菜单_投递项目 / 投递项目图标 / 投递项目快捷键 / 投递展开状态\`、\`NE徽标_投递设置文本\`、\`NE富列表_投递设置模板 / 投递设置条目 / 投递添加条目 / 投递更新条目 / 投递删除条目 / 投递条目覆盖 / 投递设置选中键\`——可在工作线程调用，由界面线程执行实际 setter。
- 运行时读取族（输出指针参数封装为文本/JSON 返回）：\`NE表格_取单元格值 / 取双击编辑状态 / 取单元格双击可编辑\`、\`NE菜单_取状态 / 取活动路径 / 取颜色 / 取项目元数据\`、\`NE富列表_取模板 / 取条目们 / 取条目 / 取选中键 / 取选项 / 取样式 / 取倒计时状态\`。
- 特殊能力：\`NE_显示提问框\`（带输入框，处理器收输入文本）、\`NE_显示通知\`、\`NE_显示加载遮罩 / NE_关闭加载遮罩\`、\`NE_设置窗口图标字节\`（内存字节集图标）、\`NE表格_导出Excel / 导入Excel\`。
- 属性命令（自动生成）：全部 93 控件属性面板背后带 UTF-8 字节参数的 setter，均自动生成 \`NE<类型>_设置<属性>\` 宽字符命令（约 130 条，含标签页 chrome、图标按钮配色、地址栏建议项、图表数据、日期格式等），按需生成 C++，未引用不产出。

\`\`\`lcpp
NE表格_设置行数据(表格1, "行数组文本")
NE富列表_绑定虚拟数据源(富列表1, &富列表虚拟数据)
NE_显示确认框(当前窗口, "删除", "确定删除吗？", "删除", "取消", &确认框已关闭)
\`\`\`

Table 事件会按原生 ABI 自动生成行号、列号、动作、文本、坐标等强类型参数。VirtualRow 处理器接收行号，并通过 NE_设置表格虚拟行数据("高级行协议") 返回本次虚拟行；生成器负责 UTF-8 转换和两阶段缓冲区查询。

 ListBox 的 SelectionChanged、ItemClicked、ItemDoubleClicked、Edit、Reorder、ContextMenu 事件会按 new_emoji 回调 ABI 自动生成选中键、项目索引、编辑字段/动作、重排索引和右键坐标等强类型参数；MouseDown、MouseUp、MouseDoubleClick、MouseMove、MouseWheel 同样保留坐标/按钮/滚轮参数，进入、离开和焦点事件无额外参数。
 Tabs 的 SelectionChanged 事件会自动生成选中索引、项目数量和动作三个整数参数；动作编号 1/2/3/4/5/6 分别表示代码设置、鼠标、键盘、关闭、新增和滚动，并按 EU_SetTabsChangeCallback 的 ElementValueCallback ABI 映射。ItemAdded（新增标签页）事件返回新项目索引；ItemsReordered（拖拽重排）事件返回原索引、新索引和项目总数。逐项「禁用」状态通过标签项数据随 \`EU_SetTabsItemsEx\` 高阶协议（标题\\tID\\t内容\\t图标\\t禁用\\t可关闭）传入原生。
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

async function replaceDirectoryAtomically(source, target) {
  const parent = path.dirname(target);
  const next = path.join(parent, `.${path.basename(target)}.next-${process.pid}`);
  const previous = path.join(parent, `.${path.basename(target)}.previous-${process.pid}`);
  await fs.mkdir(parent, { recursive: true });
  await fs.rm(next, { recursive: true, force: true });
  await fs.rm(previous, { recursive: true, force: true });
  try {
    await fs.rename(source, next);
  } catch (error) {
    // 系统临时目录与工作区可能在不同盘符（EXDEV），此时退化为复制后替换。
    if (error?.code !== 'EXDEV') throw error;
    await copyDirectory(source, next);
    await fs.rm(source, { recursive: true, force: true });
  }
  let hadPrevious = false;
  try {
    await fs.rename(target, previous);
    hadPrevious = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    await fs.rename(next, target);
    await fs.rm(previous, { recursive: true, force: true });
  } catch (error) {
    if (hadPrevious) await fs.rename(previous, target).catch(() => undefined);
    throw error;
  }
}

async function replaceFileAtomically(source, target) {
  const next = `${target}.next-${process.pid}`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rm(next, { force: true });
  try {
    await fs.rename(source, next);
  } catch (error) {
    // 系统临时目录与工作区可能在不同盘符（EXDEV），此时退化为复制后替换。
    if (error?.code !== 'EXDEV') throw error;
    await fs.copyFile(source, next);
    await fs.rm(source, { force: true });
  }
  await fs.rm(target, { force: true });
  await fs.rename(next, target);
}

async function directoryDigest(root) {
  const files = [];
  async function visit(current, relative) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath, entryRelative);
      else if (entry.isFile()) {
        const content = await fs.readFile(entryPath);
        files.push(`${entryRelative}\0${crypto.createHash('sha256').update(content).digest('hex')}`);
      }
    }
  }
  await visit(root, '');
  return crypto.createHash('sha256').update(files.join('\n')).digest('hex');
}

async function assertDirectoryMatches(expected, actual, label) {
  try {
    await fs.stat(actual);
  } catch {
    throw new Error(`${label} 不存在：${actual}`);
  }
  const [expectedDigest, actualDigest] = await Promise.all([directoryDigest(expected), directoryDigest(actual)]);
  if (expectedDigest !== actualDigest) {
    throw new Error(`${label} 与当前上游生成结果不一致；请运行 npm run module:new-emoji -- --install。`);
  }
}

async function assertPackageMatches(expected, packagePath, tempRoot) {
  try {
    await fs.stat(packagePath);
  } catch {
    throw new Error(`模块包不存在：${packagePath}`);
  }
  const zipPath = path.join(tempRoot, 'installed-package.zip');
  const extractRoot = path.join(tempRoot, 'installed-package');
  await fs.copyFile(packagePath, zipPath);
  await fs.mkdir(extractRoot, { recursive: true });
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath ${quotePs(zipPath)} -DestinationPath ${quotePs(extractRoot)} -Force`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await assertDirectoryMatches(expected, extractRoot, 'new_emoji.lbmod');
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
