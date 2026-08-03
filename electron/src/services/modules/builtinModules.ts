import { LingBuilderModuleManifest, ModuleCommandBinding, ModuleCommandBindingParameter } from './types';
import { normalizeControlReferenceCallSnippet, normalizeControlReferenceParameter, normalizeControlReferenceSnippet } from './bindingValueType';
import { getWin32ControlsForModule, Win32ControlModuleId } from '../windowDesigner/win32ControlRegistry';
import { STANDARD_LIBRARY_MODULES } from './standardLibraryModules';
import { PROTOBUF_MODULE } from './protobufModule';
import { SYSTEM_LIBRARY_MODULES } from './systemLibraryModules';
import { NETWORK_LIBRARY_MODULES } from './networkLibraryModules';
import { DATA_MEDIA_MODULES } from './dataMediaModules';
import { PLATFORM_ADVANCED_MODULES } from './platformAdvancedModules';
import { CEF3_BROWSER_EVENT_NAMES } from './cef3BrowserEvents';
import { EDGEVIEW_BROWSER_EVENT_NAMES } from './edgeViewBrowserEvents';
import { EDGEVIEW_SAFE_API_BINDINGS, EDGEVIEW_SAFE_API_COMMANDS } from './edgeViewApiCatalog';
import { LIST_VIEW_ADVANCED_BINDINGS, LIST_VIEW_ADVANCED_COMMANDS } from './listViewApiCatalog';
import { DATA_GRID_BINDINGS, DATA_GRID_COMMANDS } from './dataGridApiCatalog';
import { FBRO_SUBMODULES } from './fbroModules';
import { CEF3_SUBMODULES } from './cef3Modules';
import { OPENCV_MODULE } from './opencvModules';
import { THREADING_MODULE } from './threadingModule';
import { HTTP_SERVER_MODULE } from './httpServerModule';
import { WEBSOCKET_CLIENT_MODULE } from './webSocketClientModule';
import { WEBSOCKET_SERVER_MODULE } from './webSocketServerModule';

function createControlContributions(moduleId: Win32ControlModuleId) {
  return getWin32ControlsForModule(moduleId).map(definition => ({
    type: definition.type,
    label: definition.label,
    category: definition.category,
    icon: definition.icon,
    isContainer: definition.isContainer,
    isVisual: definition.isVisual,
    nativeAdapter: definition.nativeAdapter,
    requiredLibraries: definition.requiredLibraries,
    layout: getBuiltinContainerLayout(definition.type),
    defaultProps: definition.defaultProps,
    properties: definition.properties,
    events: definition.events.map(event => ({
      name: event.name,
      label: event.label,
      handlerPattern: `_{controlName}_${event.handlerSuffix}`
    }))
  }));
}

function getBuiltinContainerLayout(type: string) {
  if (type === 'GroupBox') {
    return { mode: 'absolute' as const, coordinateSpace: 'window' as const, adapterId: 'win32.groupbox.absolute' };
  }
  if (type === 'TabControl') {
    return { mode: 'slots' as const, coordinateSpace: 'window' as const, adapterId: 'win32.tab.slots' };
  }
  return undefined;
}

function createControlTypes(moduleId: Win32ControlModuleId) {
  return getWin32ControlsForModule(moduleId).map(definition => ({
    name: definition.label.split('/')[0],
    description: `Win32 ${definition.label}控件。`,
    cppType: 'HWND'
  }));
}

function ensureBuiltinX64Target(manifest: LingBuilderModuleManifest): LingBuilderModuleManifest {
  const targets = manifest.targets || [];
  if (targets.some(target => target.id === 'windows-msvc-x64')) return manifest;
  const win32Target = targets.find(target => target.id === 'windows-msvc-win32');
  if (!win32Target) return manifest;
  return {
    ...manifest,
    targets: [
      ...targets,
      { ...win32Target, id: 'windows-msvc-x64', arch: 'x64' }
    ]
  };
}

function normalizeBuiltinControlReferences(manifest: LingBuilderModuleManifest): LingBuilderModuleManifest {
  const bindings = (manifest.bindings?.commands || []).map(binding => {
    const parameters = (binding.parameters || []).map(parameter => normalizeBuiltinControlParameter(manifest.id, binding.command, parameter));
    return {
      ...binding,
      parameters,
      example: normalizeControlReferenceCallSnippet(binding.example, parameters)
    };
  });
  const bindingByCommand = new Map(bindings.map(binding => [binding.command, binding]));
  const commands = (manifest.contributes?.commands || []).map(command => {
    const binding = bindingByCommand.get(command.name);
    return binding ? {
      ...command,
      insertText: normalizeControlReferenceCallSnippet(command.insertText, binding.parameters)
    } : command;
  });
  const snippets = (manifest.contributes?.snippets || []).map(snippet => ({
    ...snippet,
    insertText: normalizeBuiltinSnippetCalls(snippet.insertText, bindings)
  }));
  return {
    ...manifest,
    contributes: manifest.contributes ? { ...manifest.contributes, commands, snippets } : manifest.contributes,
    bindings: manifest.bindings ? { ...manifest.bindings, commands: bindings } : manifest.bindings
  };
}

function normalizeBuiltinControlParameter(
  moduleId: string,
  command: string,
  parameter: ModuleCommandBindingParameter
): ModuleCommandBindingParameter {
  const converted = parameter;
  if (converted.type !== 'controlRef') return converted;
  const resourceTypes = command.startsWith('文件对话框_') ? ['FileDialog']
    : command.startsWith('上下文菜单_') ? ['ContextMenu']
      : command.startsWith('弹出菜单_') ? ['PopupMenu']
        : command === '菜单_取最后项目' ? ['ContextMenu', 'PopupMenu']
          : command.startsWith('属性页_') ? ['PropertySheet']
            : parameter.name === '图像列表ID' ? ['ImageList']
              : undefined;
  if (resourceTypes) return normalizeControlReferenceParameter(converted, {
    controlTypes: resourceTypes,
    controlKinds: ['resource'],
    scope: 'project'
  });
  const moduleTypes = moduleId.startsWith('lingbuilder.cef3') ? ['CefBrowser']
    : moduleId.startsWith('lingbuilder.fbro') ? ['FBroBrowser']
      : moduleId === 'lingbuilder.edgeview' ? ['EdgeBrowser']
        : undefined;
  const commandTypes = command.startsWith('颜色选择器_') ? ['ColorPicker']
    : command.startsWith('列表视图_') ? ['ListView']
      : command.startsWith('表格_') ? ['DataGrid']
        : command.startsWith('树形框_') ? ['TreeView']
          : command.startsWith('选项卡_') ? ['TabControl']
            : command.startsWith('视频播放器_') ? ['VideoPlayer']
              : undefined;
  return normalizeControlReferenceParameter(converted, { controlTypes: parameter.controlTypes || commandTypes || moduleTypes });
}

function normalizeBuiltinSnippetCalls(value: string, bindings: readonly ModuleCommandBinding[]): string {
  return normalizeControlReferenceSnippet(value, bindings) || value;
}

export const BUILTIN_MODULES: LingBuilderModuleManifest[] = [
  ...STANDARD_LIBRARY_MODULES,
  PROTOBUF_MODULE,
  ...SYSTEM_LIBRARY_MODULES,
  ...NETWORK_LIBRARY_MODULES,
  ...DATA_MEDIA_MODULES,
  OPENCV_MODULE,
  ...PLATFORM_ADVANCED_MODULES,
  {
    schemaVersion: 2,
    id: 'lingbuilder.win32.basic',
    name: 'Win32窗口基础模块',
    version: '1.0.0',
    category: '界面',
    description: '提供窗口、基础控件、信息框、调试输出和结束等中文 C++ 基础能力。',
    author: 'LingBuilder',
    tags: ['内置', 'Win32', '中文代码'],
    contributes: {
      commands: [
        {
          name: '信息框',
          signature: '信息框(内容, 标志, 标题)',
          description: '显示一个 Win32 系统消息框。',
          insertText: '信息框("$1", 64, "提示")',
          returnType: '整数型'
        },
        {
          name: '调试输出',
          signature: '调试输出(参数1, 参数2, ...)',
          description: '向调试输出窗口和控制台输出任意数量的文本、整数、逻辑值等参数，参数使用英文逗号分隔。',
          insertText: '调试输出("$1", $2)',
          returnType: '空'
        },
        {
          name: '结束',
          signature: '结束()',
          description: '关闭当前窗口。',
          insertText: '结束()',
          returnType: '空'
        },
        { name: '到文本', signature: '到文本(值)', description: '把整数、长整数、小数、逻辑值或文本确定性转换为文本；逻辑值返回“真”或“假”。', insertText: '到文本($1)', returnType: '文本型' },
        { name: '格式化文本', signature: '格式化文本(格式模板, 参数...)', description: '按顺序用参数替换格式模板中的 {}；使用 {{ 和 }} 输出字面量花括号。参数不足时保留未替换的 {}，多余参数忽略。', insertText: '格式化文本("$1：{}", $2)', returnType: '文本型' },
        { name: '到整数', signature: '到整数(文本)', description: '把文本转换为整数；空文本或无法转换的内容返回 0。', insertText: '到整数("$1")', returnType: '整数型' },
        { name: '取鼠标水平位置', signature: '取鼠标水平位置()', description: '返回鼠标指针当前相对于屏幕左边的水平位置，单位为像素点。初级命令。', insertText: '取鼠标水平位置()', returnType: '整数型' },
        { name: '取鼠标垂直位置', signature: '取鼠标垂直位置()', description: '返回鼠标指针当前相对于屏幕顶边的垂直位置，单位为像素点。初级命令。', insertText: '取鼠标垂直位置()', returnType: '整数型' },
        { name: '控件_设置文本', signature: '控件_设置文本(控件名, 文本)', description: '设置当前窗口中指定控件的文本。', insertText: '控件_设置文本($1, "$2")', returnType: '逻辑型' },
        { name: '控件_设置图片', signature: '控件_设置图片(控件名, 图片路径)', description: '设置图片框显示的本地图片；支持项目 assets 相对路径或本地完整路径，空路径清空图片。', insertText: '控件_设置图片($1, "assets/$2")', returnType: '逻辑型' },
        { name: '控件_取文本', signature: '控件_取文本(控件名)', description: '读取指定控件的当前文本。', insertText: '控件_取文本($1)', returnType: '文本型' },
        { name: '控件_设置启用', signature: '控件_设置启用(控件名, 启用)', description: '启用或禁用指定控件。', insertText: '控件_设置启用($1, 真)', returnType: '逻辑型' },
        { name: '控件_设置可见', signature: '控件_设置可见(控件名, 可见)', description: '显示或隐藏指定控件。', insertText: '控件_设置可见($1, 真)', returnType: '逻辑型' },
        { name: '控件_设置位置大小', signature: '控件_设置位置大小(控件名, 横坐标, 纵坐标, 宽度, 高度)', description: '按当前窗口客户区像素坐标移动指定控件并调整大小，适合在窗口大小事件中实现自适应布局。', insertText: '控件_设置位置大小($1, $2, $3, $4, $5)', returnType: '逻辑型' },
        { name: '控件_设置勾选', signature: '控件_设置勾选(控件名, 勾选)', description: '设置复选框、单选框或切换按钮状态。', insertText: '控件_设置勾选($1, 真)', returnType: '逻辑型' },
        { name: '控件_取勾选', signature: '控件_取勾选(控件名)', description: '读取控件勾选状态。', insertText: '控件_取勾选($1)', returnType: '逻辑型' },
        { name: '控件_设置数值', signature: '控件_设置数值(控件名, 数值)', description: '设置进度条、滑块、调节器或滚动条数值。', insertText: '控件_设置数值($1, 50)', returnType: '逻辑型' },
        { name: '控件_取数值', signature: '控件_取数值(控件名)', description: '读取数值型控件当前值。', insertText: '控件_取数值($1)', returnType: '整数型' },
        { name: '控件_设置选择项', signature: '控件_设置选择项(控件名, 索引)', description: '设置列表、组合框、列表视图或选项卡选择项。', insertText: '控件_设置选择项($1, 0)', returnType: '逻辑型' },
        { name: '控件_取选择项', signature: '控件_取选择项(控件名)', description: '读取选择项索引。', insertText: '控件_取选择项($1)', returnType: '整数型' },
        { name: '控件_添加项目', signature: '控件_添加项目(控件名, 文本)', description: '向列表框、组合框或增强组合框追加项目。', insertText: '控件_添加项目($1, "$2")', returnType: '整数型' },
        { name: '控件_清空项目', signature: '控件_清空项目(控件名)', description: '清空集合控件项目。', insertText: '控件_清空项目($1)', returnType: '逻辑型' },
        { name: '窗口_取消关闭', signature: '窗口_取消关闭()', description: '在窗口“关闭前”事件中取消本次关闭请求。', insertText: '窗口_取消关闭()', returnType: '逻辑型' },
        { name: '窗口_取事件宽度', signature: '窗口_取事件宽度()', description: '返回最近窗口大小事件中的客户区宽度。', insertText: '窗口_取事件宽度()', returnType: '整数型' },
        { name: '窗口_取事件高度', signature: '窗口_取事件高度()', description: '返回最近窗口大小事件中的客户区高度。', insertText: '窗口_取事件高度()', returnType: '整数型' },
        { name: '窗口_取事件横坐标', signature: '窗口_取事件横坐标()', description: '返回最近窗口移动事件中的屏幕横坐标。', insertText: '窗口_取事件横坐标()', returnType: '整数型' },
        { name: '窗口_取事件纵坐标', signature: '窗口_取事件纵坐标()', description: '返回最近窗口移动事件中的屏幕纵坐标。', insertText: '窗口_取事件纵坐标()', returnType: '整数型' },
        { name: '窗口_取是否激活', signature: '窗口_取是否激活()', description: '返回当前窗口是否为活动窗口。', insertText: '窗口_取是否激活()', returnType: '逻辑型' },
        { name: '窗口_取是否可见', signature: '窗口_取是否可见()', description: '返回当前窗口是否可见。', insertText: '窗口_取是否可见()', returnType: '逻辑型' },
        { name: '窗口_取当前状态', signature: '窗口_取当前状态()', description: '返回窗口状态：0 正常、1 最小化、2 最大化。', insertText: '窗口_取当前状态()', returnType: '整数型' },
        { name: '窗口_取事件键码', signature: '窗口_取事件键码()', description: '返回最近键盘事件中的 Win32 虚拟键码。', insertText: '窗口_取事件键码()', returnType: '整数型' },
        { name: '窗口_取事件字符', signature: '窗口_取事件字符()', description: '返回最近字符输入事件中的 Unicode 字符。', insertText: '窗口_取事件字符()', returnType: '文本型' },
        { name: '窗口_取Ctrl键状态', signature: '窗口_取Ctrl键状态()', description: '返回最近键盘事件发生时 Ctrl 键是否按下。', insertText: '窗口_取Ctrl键状态()', returnType: '逻辑型' },
        { name: '窗口_取Shift键状态', signature: '窗口_取Shift键状态()', description: '返回最近键盘事件发生时 Shift 键是否按下。', insertText: '窗口_取Shift键状态()', returnType: '逻辑型' },
        { name: '窗口_取Alt键状态', signature: '窗口_取Alt键状态()', description: '返回最近键盘事件发生时 Alt 键是否按下。', insertText: '窗口_取Alt键状态()', returnType: '逻辑型' },
        { name: '窗口_标记按键已处理', signature: '窗口_标记按键已处理()', description: '在窗口键盘事件中阻止消息继续交给子控件或默认窗口过程。', insertText: '窗口_标记按键已处理()', returnType: '逻辑型' },
        { name: '窗口_取事件DPI', signature: '窗口_取事件DPI()', description: '返回最近 DPI 改变事件中的新 DPI。', insertText: '窗口_取事件DPI()', returnType: '整数型' },
        { name: '窗口_取拖入文件数量', signature: '窗口_取拖入文件数量()', description: '返回最近文件拖入事件中的文件和目录数量。', insertText: '窗口_取拖入文件数量()', returnType: '整数型' },
        { name: '窗口_取拖入文件', signature: '窗口_取拖入文件(索引)', description: '按从 0 开始的索引返回最近拖入的 Unicode 路径，越界返回空文本。', insertText: '窗口_取拖入文件(0)', returnType: '文本型' }
      ],
      types: [
        { name: '窗口', description: 'Win32 窗口基类。', cppType: 'LingWindowBase' },
        ...createControlTypes('lingbuilder.win32.basic')
      ],
      designerControls: createControlContributions('lingbuilder.win32.basic'),
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        libs: ['comctl32.lib'],
        defines: ['UNICODE', '_UNICODE']
      }
    ],
    bindings: {
      commands: [
        {
          command: '信息框',
          runtimeName: '信息框',
          parameters: [
            { name: '内容', type: 'wideString' },
            { name: '标志', type: 'int' },
            { name: '标题', type: 'wideString' }
          ],
          returnType: 'int',
          encoding: 'wide',
          example: '信息框("你好", 64, "提示")'
        },
        {
          command: '调试输出',
          runtimeName: '调试输出',
          parameters: [{ name: '内容', type: 'lingValue', variadic: true }],
          returnType: 'void',
          encoding: 'wide',
          example: '调试输出("当前选择项", 控件_取选择项(列表框1), 真)'
        },
        {
          command: '结束',
          runtimeName: '结束',
          parameters: [],
          returnType: 'void',
          example: '结束()'
        },
        { command: '到文本', runtimeName: '到文本', parameters: [{ name: '值', type: 'raw' }], returnType: 'wideString', encoding: 'wide', example: '到文本(123)' },
        { command: '格式化文本', runtimeName: '格式化文本', parameters: [{ name: '格式模板', type: 'wideString' }, { name: '参数', type: 'raw', description: '可继续传入任意数量的文本、整数、小数或逻辑值。' }], returnType: 'wideString', encoding: 'wide', example: '格式化文本("姓名：{}，年龄：{}", "小林", 18)' },
        { command: '到整数', runtimeName: '到整数', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
        { command: '取鼠标水平位置', runtimeName: '取鼠标水平位置', parameters: [], returnType: 'int' },
        { command: '取鼠标垂直位置', runtimeName: '取鼠标垂直位置', parameters: [], returnType: 'int' },
        { command: '控件_设置文本', runtimeName: '控件_设置文本', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_设置图片', runtimeName: '控件_设置图片', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '图片路径', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_取文本', runtimeName: '控件_取文本', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
        { command: '控件_设置启用', runtimeName: '控件_设置启用', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_设置可见', runtimeName: '控件_设置可见', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '可见', type: 'bool' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_设置位置大小', runtimeName: '控件_设置位置大小', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_设置勾选', runtimeName: '控件_设置勾选', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '勾选', type: 'bool' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_取勾选', runtimeName: '控件_取勾选', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_设置数值', runtimeName: '控件_设置数值', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '数值', type: 'int' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_取数值', runtimeName: '控件_取数值', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
        { command: '控件_设置选择项', runtimeName: '控件_设置选择项', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '索引', type: 'int' }], returnType: 'bool', encoding: 'wide' },
        { command: '控件_取选择项', runtimeName: '控件_取选择项', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
        { command: '控件_添加项目', runtimeName: '控件_添加项目', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
        { command: '控件_清空项目', runtimeName: '控件_清空项目', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' },
        { command: '窗口_取消关闭', runtimeName: '窗口_取消关闭', parameters: [], returnType: 'bool' },
        { command: '窗口_取事件宽度', runtimeName: '窗口_取事件宽度', parameters: [], returnType: 'int' },
        { command: '窗口_取事件高度', runtimeName: '窗口_取事件高度', parameters: [], returnType: 'int' },
        { command: '窗口_取事件横坐标', runtimeName: '窗口_取事件横坐标', parameters: [], returnType: 'int' },
        { command: '窗口_取事件纵坐标', runtimeName: '窗口_取事件纵坐标', parameters: [], returnType: 'int' },
        { command: '窗口_取是否激活', runtimeName: '窗口_取是否激活', parameters: [], returnType: 'bool' },
        { command: '窗口_取是否可见', runtimeName: '窗口_取是否可见', parameters: [], returnType: 'bool' },
        { command: '窗口_取当前状态', runtimeName: '窗口_取当前状态', parameters: [], returnType: 'int' },
        { command: '窗口_取事件键码', runtimeName: '窗口_取事件键码', parameters: [], returnType: 'int' },
        { command: '窗口_取事件字符', runtimeName: '窗口_取事件字符', parameters: [], returnType: 'wideString', encoding: 'wide' },
        { command: '窗口_取Ctrl键状态', runtimeName: '窗口_取Ctrl键状态', parameters: [], returnType: 'bool' },
        { command: '窗口_取Shift键状态', runtimeName: '窗口_取Shift键状态', parameters: [], returnType: 'bool' },
        { command: '窗口_取Alt键状态', runtimeName: '窗口_取Alt键状态', parameters: [], returnType: 'bool' },
        { command: '窗口_标记按键已处理', runtimeName: '窗口_标记按键已处理', parameters: [], returnType: 'bool' },
        { command: '窗口_取事件DPI', runtimeName: '窗口_取事件DPI', parameters: [], returnType: 'int' },
        { command: '窗口_取拖入文件数量', runtimeName: '窗口_取拖入文件数量', parameters: [], returnType: 'int' },
        { command: '窗口_取拖入文件', runtimeName: '窗口_取拖入文件', parameters: [{ name: '索引', type: 'int' }], returnType: 'wideString', encoding: 'wide' }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.win32.common-controls',
    name: 'Win32高级控件模块',
    version: '1.0.0',
    category: '界面',
    description: '提供非可视文件对话框、列表视图、树形视图、选项卡、日期、工具栏、状态栏、富文本和系统通用对话框等标准 Win32 能力。',
    author: 'LingBuilder',
    tags: ['内置', 'Win32', 'Common Controls', '富文本', '系统对话框'],
    contributes: {
      commands: [
        { name: '打开文件', signature: '打开文件(标题, 筛选器)', description: '显示 Windows 文件打开对话框并返回路径。', insertText: '打开文件("选择文件", "所有文件|*.*")', returnType: '文本型' },
        { name: '保存文件', signature: '保存文件(标题, 筛选器)', description: '显示 Windows 文件保存对话框并返回路径。', insertText: '保存文件("保存文件", "所有文件|*.*")', returnType: '文本型' },
        { name: '选择文件夹', signature: '选择文件夹(标题)', description: '显示 Windows 文件夹选择对话框并返回路径。', insertText: '选择文件夹("选择文件夹")', returnType: '文本型' },
        { name: '选择颜色', signature: '选择颜色(默认颜色)', description: '显示系统颜色对话框并返回 COLORREF 整数。', insertText: '选择颜色(0)', returnType: '整数型' },
        { name: '颜色选择器_打开', signature: '颜色选择器_打开(控件名)', description: '打开指定颜色选择器的系统选色窗口；控件设置为不可视时仍可由按钮或其他事件调用。', insertText: '颜色选择器_打开(颜色选择器1)', returnType: '逻辑型' },
        { name: '颜色选择器_置颜色', signature: '颜色选择器_置颜色(控件名, 颜色)', description: '设置颜色选择器当前 COLORREF 颜色，并在颜色变化时触发事件。', insertText: '颜色选择器_置颜色(颜色选择器1, 0)', returnType: '逻辑型' },
        { name: '颜色选择器_取颜色', signature: '颜色选择器_取颜色(控件名)', description: '返回颜色选择器当前 COLORREF 整数。', insertText: '颜色选择器_取颜色(颜色选择器1)', returnType: '整数型' },
        { name: '选择字体', signature: '选择字体(默认字号)', description: '显示系统字体对话框并返回字体说明。', insertText: '选择字体(12)', returnType: '文本型' },
        { name: '查找文本', signature: '查找文本(默认文本)', description: '显示系统查找对话框。', insertText: '查找文本("$1")', returnType: '空' },
        { name: '替换文本', signature: '替换文本(查找内容, 替换内容)', description: '显示系统替换对话框。', insertText: '替换文本("$1", "$2")', returnType: '空' },
        { name: '打印', signature: '打印()', description: '显示系统打印对话框。', insertText: '打印()', returnType: '逻辑型' },
        { name: '页面设置', signature: '页面设置()', description: '显示系统页面设置对话框。', insertText: '页面设置()', returnType: '逻辑型' },
        { name: '任务对话框', signature: '任务对话框(标题, 内容)', description: '显示 Windows Task Dialog。', insertText: '任务对话框("提示", "$1")', returnType: '整数型' }
        ,{ name: '系统对话框_状态', signature: '系统对话框_状态()', description: '返回最近文件或目录对话框状态：1 成功、0 取消、-1 错误。', insertText: '系统对话框_状态()', returnType: '整数型' }
        ,{ name: '工具栏_最后命令', signature: '工具栏_最后命令()', description: '返回最近点击的工具栏按钮命令 ID。', insertText: '工具栏_最后命令()', returnType: '整数型' }
        ,{ name: '状态栏_最后分区', signature: '状态栏_最后分区()', description: '返回最近双击的状态栏分区索引。', insertText: '状态栏_最后分区()', returnType: '整数型' }
        ,{ name: '查找替换_动作', signature: '查找替换_动作()', description: '返回最近查找替换动作。', insertText: '查找替换_动作()', returnType: '文本型' }
        ,{ name: '查找替换_查找内容', signature: '查找替换_查找内容()', description: '返回查找替换对话框中的查找文本。', insertText: '查找替换_查找内容()', returnType: '文本型' }
        ,{ name: '查找替换_替换内容', signature: '查找替换_替换内容()', description: '返回查找替换对话框中的替换文本。', insertText: '查找替换_替换内容()', returnType: '文本型' }
        ,{ name: '打印文本', signature: '打印文本(文档名, 文本)', description: '选择打印机并把指定文本作为真实打印文档输出。', insertText: '打印文本("文档", "$1")', returnType: '逻辑型' }
        ,{ name: '页面设置_左边距', signature: '页面设置_左边距()', description: '返回最近页面设置的左边距。', insertText: '页面设置_左边距()', returnType: '整数型' }
        ,{ name: '页面设置_上边距', signature: '页面设置_上边距()', description: '返回最近页面设置的上边距。', insertText: '页面设置_上边距()', returnType: '整数型' }
        ,{ name: '页面设置_右边距', signature: '页面设置_右边距()', description: '返回最近页面设置的右边距。', insertText: '页面设置_右边距()', returnType: '整数型' }
        ,{ name: '页面设置_下边距', signature: '页面设置_下边距()', description: '返回最近页面设置的下边距。', insertText: '页面设置_下边距()', returnType: '整数型' }
        ,{ name: '属性页_显示', signature: '属性页_显示(属性页)', description: '显示设计器资源中定义的顶层 Windows PropertySheet。', insertText: '属性页_显示(属性页1)', returnType: '整数型' }
        ,{ name: '列表视图_创建行', signature: '列表视图_创建行(单元格...)', description: '按参数顺序创建类型化列表视图行；文本、整数、小数和逻辑值会确定性转换为单元格文本。', insertText: '列表视图_创建行("$1", "$2")', returnType: '列表视图行' }
        ,{ name: '列表视图_创建行集合', signature: '列表视图_创建行集合(行...)', description: '把一个或多个列表视图行组成可批量提交的类型化行集合。', insertText: '列表视图_创建行集合(列表视图_创建行("$1", "$2"), 列表视图_创建行("$3", "$4"))', returnType: '列表视图行集合' }
        ,{ name: '列表视图_添加行', signature: '列表视图_添加行(控件名, 列表视图行)', description: '向 ListView 追加类型化单元格数组；继续兼容旧式 Tab 分隔文本。', insertText: '列表视图_添加行($1, 列表视图_创建行("$2", "$3"))', returnType: '整数型' }
        ,{ name: '列表视图_插入行', signature: '列表视图_插入行(控件名, 行索引, 列表视图行)', description: '在指定的零基行索引插入类型化单元格数组；继续兼容旧式 Tab 分隔文本。', insertText: '列表视图_插入行($1, 0, 列表视图_创建行("$2", "$3"))', returnType: '整数型' }
        ,{ name: '列表视图_删除行', signature: '列表视图_删除行(控件名, 行索引)', description: '删除指定的零基行索引。', insertText: '列表视图_删除行($1, 0)', returnType: '逻辑型' }
        ,{ name: '列表视图_设置单元格', signature: '列表视图_设置单元格(控件名, 行索引, 列索引, 文本)', description: '修改指定零基行、列索引的单元格。', insertText: '列表视图_设置单元格($1, 0, 1, "$2")', returnType: '逻辑型' }
        ,{ name: '列表视图_取单元格', signature: '列表视图_取单元格(控件名, 行索引, 列索引)', description: '读取指定零基行、列索引的单元格文本。', insertText: '列表视图_取单元格($1, 0, 1)', returnType: '文本型' }
        ,{ name: '列表视图_取行数', signature: '列表视图_取行数(控件名)', description: '返回列表视图当前数据行数。', insertText: '列表视图_取行数($1)', returnType: '整数型' }
        ,{ name: '列表视图_批量添加行', signature: '列表视图_批量添加行(控件名, 列表视图行集合)', description: '一次追加类型化行集合，内部自动关闭并恢复重绘；继续兼容旧式多行 TSV 文本。', insertText: '列表视图_批量添加行($1, 列表视图_创建行集合(列表视图_创建行("$2", "$3"), 列表视图_创建行("$4", "$5")))', returnType: '整数型' }
        ,{ name: '列表视图_开始批量更新', signature: '列表视图_开始批量更新(控件名)', description: '暂停 ListView 重绘；必须与结束批量更新成对调用。', insertText: '列表视图_开始批量更新($1)', returnType: '逻辑型' }
        ,{ name: '列表视图_结束批量更新', signature: '列表视图_结束批量更新(控件名)', description: '结束一层批量更新，并在最外层结束时恢复重绘。', insertText: '列表视图_结束批量更新($1)', returnType: '逻辑型' }
        ,{ name: '列表视图_排序', signature: '列表视图_排序(控件名, 列索引, 升序)', description: '按指定列文本稳定排序，列索引从 0 开始。', insertText: '列表视图_排序($1, 0, 真)', returnType: '逻辑型' }
        ,{ name: '列表视图_取最后单击列', signature: '列表视图_取最后单击列(控件名)', description: '返回最近一次表头单击的零基列索引；尚未单击时返回 -1。', insertText: '列表视图_取最后单击列($1)', returnType: '整数型' }
        ,{ name: '列表视图_取虚拟模式', signature: '列表视图_取虚拟模式(控件名)', description: '返回控件是否以 Win32 LVS_OWNERDATA 虚拟模式创建。', insertText: '列表视图_取虚拟模式($1)', returnType: '逻辑型' }
        ,{ name: '列表视图_设置虚拟行数', signature: '列表视图_设置虚拟行数(控件名, 行数)', description: '设置虚拟 ListView 的总行数；设计器必须先开启虚拟列表模式。', insertText: '列表视图_设置虚拟行数($1, 15000)', returnType: '逻辑型' }
        ,{ name: '列表视图_设置虚拟行', signature: '列表视图_设置虚拟行(控件名, 行索引, 列表视图行)', description: '用类型化单元格数组设置虚拟 ListView 指定行，不创建真实行项目；继续兼容旧式 Tab 分隔文本。', insertText: '列表视图_设置虚拟行($1, 0, 列表视图_创建行("$2", "$3"))', returnType: '逻辑型' }
        ,...LIST_VIEW_ADVANCED_COMMANDS
        ,...DATA_GRID_COMMANDS
        ,{ name: '树形框_添加节点', signature: '树形框_添加节点(控件名, 父节点文字, 节点文字)', description: '向 TreeView 根级或指定父节点追加节点。', insertText: '树形框_添加节点($1, "", "$2")', returnType: '逻辑型' }
        ,{ name: '选项卡_添加页', signature: '选项卡_添加页(控件名, 标题)', description: '向 TabControl 追加标签页。', insertText: '选项卡_添加页($1, "$2")', returnType: '整数型' }
        ,{ name: '选项卡_设置隐藏表头', signature: '选项卡_设置隐藏表头(控件名, 隐藏)', description: '运行时隐藏或显示 TabControl 的标签表头，并重新布局当前页面。', insertText: '选项卡_设置隐藏表头($1, 真)', returnType: '逻辑型' }
        ,{ name: '选项卡_取隐藏表头', signature: '选项卡_取隐藏表头(控件名)', description: '读取 TabControl 当前是否隐藏标签表头。', insertText: '选项卡_取隐藏表头($1)', returnType: '逻辑型' }
        ,{ name: '文件对话框_打开', signature: '文件对话框_打开(组件名)', description: '打开设计器中配置的非可视文件对话框，并保存选择结果。', insertText: '文件对话框_打开(文件对话框1)', returnType: '逻辑型' }
        ,{ name: '文件对话框_清空', signature: '文件对话框_清空(组件名)', description: '清空文件对话框组件最近选择或拖入的文件。', insertText: '文件对话框_清空(文件对话框1)', returnType: '逻辑型' }
        ,{ name: '文件对话框_取文件数量', signature: '文件对话框_取文件数量(组件名)', description: '返回文件对话框组件最近选择或拖入的文件数量。', insertText: '文件对话框_取文件数量(文件对话框1)', returnType: '整数型' }
        ,{ name: '文件对话框_取文件', signature: '文件对话框_取文件(组件名, 索引)', description: '返回文件对话框组件指定索引的完整文件路径。', insertText: '文件对话框_取文件(文件对话框1, 0)', returnType: '文本型' }
        ,{ name: '上下文菜单_显示', signature: '上下文菜单_显示(组件名)', description: '在鼠标位置主动显示上下文菜单；绑定目标右键时无需手动调用。', insertText: '上下文菜单_显示(上下文菜单1)', returnType: '逻辑型' }
        ,{ name: '弹出菜单_显示', signature: '弹出菜单_显示(组件名)', description: '在当前鼠标位置显示弹出菜单。', insertText: '弹出菜单_显示(弹出菜单1)', returnType: '逻辑型' }
        ,{ name: '弹出菜单_在坐标显示', signature: '弹出菜单_在坐标显示(组件名, 横坐标, 纵坐标)', description: '在指定的屏幕像素坐标显示弹出菜单。', insertText: '弹出菜单_在坐标显示(弹出菜单1, 取鼠标水平位置(), 取鼠标垂直位置())', returnType: '逻辑型' }
        ,{ name: '菜单_取最后项目', signature: '菜单_取最后项目(组件名)', description: '返回指定上下文菜单或弹出菜单最近选择的稳定菜单项 ID。', insertText: '菜单_取最后项目(弹出菜单1)', returnType: '文本型' }
        ,{ name: '视频播放器_设置文件', signature: '视频播放器_设置文件(控件名, 视频路径)', description: '切换视频播放器的本地媒体文件；支持 MP4、WMV 等 Media Foundation 可解码格式。', insertText: '视频播放器_设置文件(视频播放器1, "assets/$1.mp4")', returnType: '逻辑型' }
        ,{ name: '视频播放器_播放', signature: '视频播放器_播放(控件名)', description: '播放或继续播放指定视频。', insertText: '视频播放器_播放(视频播放器1)', returnType: '逻辑型' }
        ,{ name: '视频播放器_暂停', signature: '视频播放器_暂停(控件名)', description: '暂停指定视频。', insertText: '视频播放器_暂停(视频播放器1)', returnType: '逻辑型' }
        ,{ name: '视频播放器_停止', signature: '视频播放器_停止(控件名)', description: '停止指定视频。', insertText: '视频播放器_停止(视频播放器1)', returnType: '逻辑型' }
        ,{ name: '视频播放器_设置音量', signature: '视频播放器_设置音量(控件名, 音量)', description: '设置视频音量，范围 0～100。', insertText: '视频播放器_设置音量(视频播放器1, 100)', returnType: '逻辑型' }
        ,{ name: '视频播放器_取状态', signature: '视频播放器_取状态(控件名)', description: '返回 Media Foundation 播放器状态；未创建时返回 -1。', insertText: '视频播放器_取状态(视频播放器1)', returnType: '整数型' }
      ],
      types: [
        ...createControlTypes('lingbuilder.win32.common-controls'),
        { name: '列表视图行', kind: 'array', elementType: '文本型', description: 'ListView 一行按列排列的类型化单元格文本数组。' },
        { name: '列表视图行集合', kind: 'array', elementType: '列表视图行', description: '可批量追加到 ListView 的类型化行数组。' }
      ],
      designerControls: createControlContributions('lingbuilder.win32.common-controls'),
      snippets: [
        { label: '选择文件并输出', insertText: '调试输出(打开文件("选择文件", "所有文件|*.*"))', description: '选择一个文件并输出路径。' },
        { label: '任务对话框提示', insertText: '任务对话框("LingBuilder", "操作完成")', description: '显示标准 Windows 任务对话框。' }
      ]
    },
    targets: [{
      id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc',
      libs: ['comctl32.lib', 'comdlg32.lib', 'ole32.lib', 'shell32.lib', 'shlwapi.lib', 'mfplat.lib', 'mfplay.lib', 'mfuuid.lib'],
      defines: ['UNICODE', '_UNICODE', 'LINGBUILDER_WIN32_COMMON_CONTROLS']
    }],
    bindings: {
      commands: [
        { command: '打开文件', runtimeName: '打开文件', parameters: [{ name: '标题', type: 'wideString' }, { name: '筛选器', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '保存文件', runtimeName: '保存文件', parameters: [{ name: '标题', type: 'wideString' }, { name: '筛选器', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '选择文件夹', runtimeName: '选择文件夹', parameters: [{ name: '标题', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '选择颜色', runtimeName: '选择颜色', parameters: [{ name: '默认颜色', type: 'int' }], returnType: 'int' },
        { command: '颜色选择器_打开', runtimeName: '颜色选择器_打开', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' },
        { command: '颜色选择器_置颜色', runtimeName: '颜色选择器_置颜色', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '颜色', type: 'int' }], returnType: 'bool', encoding: 'wide' },
        { command: '颜色选择器_取颜色', runtimeName: '颜色选择器_取颜色', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
        { command: '选择字体', runtimeName: '选择字体', parameters: [{ name: '默认字号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
        { command: '查找文本', runtimeName: '查找文本', parameters: [{ name: '默认文本', type: 'wideString' }], returnType: 'void', encoding: 'wide' },
        { command: '替换文本', runtimeName: '替换文本', parameters: [{ name: '查找内容', type: 'wideString' }, { name: '替换内容', type: 'wideString' }], returnType: 'void', encoding: 'wide' },
        { command: '打印', runtimeName: '打印', parameters: [], returnType: 'bool' },
        { command: '页面设置', runtimeName: '页面设置', parameters: [], returnType: 'bool' },
        { command: '任务对话框', runtimeName: '任务对话框', parameters: [{ name: '标题', type: 'wideString' }, { name: '内容', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '系统对话框_状态', runtimeName: '系统对话框_状态', parameters: [], returnType: 'int' }
        ,{ command: '工具栏_最后命令', runtimeName: '工具栏_最后命令', parameters: [], returnType: 'int' }
        ,{ command: '状态栏_最后分区', runtimeName: '状态栏_最后分区', parameters: [], returnType: 'int' }
        ,{ command: '查找替换_动作', runtimeName: '查找替换_动作', parameters: [], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '查找替换_查找内容', runtimeName: '查找替换_查找内容', parameters: [], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '查找替换_替换内容', runtimeName: '查找替换_替换内容', parameters: [], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '打印文本', runtimeName: '打印文本', parameters: [{ name: '文档名', type: 'wideString' }, { name: '文本', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '页面设置_左边距', runtimeName: '页面设置_左边距', parameters: [], returnType: 'int' }
        ,{ command: '页面设置_上边距', runtimeName: '页面设置_上边距', parameters: [], returnType: 'int' }
        ,{ command: '页面设置_右边距', runtimeName: '页面设置_右边距', parameters: [], returnType: 'int' }
        ,{ command: '页面设置_下边距', runtimeName: '页面设置_下边距', parameters: [], returnType: 'int' }
        ,{ command: '属性页_显示', runtimeName: '属性页_显示', parameters: [{ name: '属性页', type: 'controlRef', controlTypes: ['PropertySheet'], controlKinds: ['resource'], scope: 'project' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_创建行', runtimeName: '列表视图_创建行', parameters: [{ name: '单元格', type: 'raw', description: '可继续传入任意数量的文本、整数、小数或逻辑值。' }], returnType: 'raw', encoding: 'wide' }
        ,{ command: '列表视图_创建行集合', runtimeName: '列表视图_创建行集合', parameters: [{ name: '行', type: 'raw', description: '可继续传入任意数量的列表视图行。' }], returnType: 'raw' }
        ,{ command: '列表视图_添加行', runtimeName: '列表视图_添加行', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行数据', type: 'raw', description: '列表视图行；兼容旧式 Tab 分隔文本。' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_插入行', runtimeName: '列表视图_插入行', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行索引', type: 'int' }, { name: '行数据', type: 'raw', description: '列表视图行；兼容旧式 Tab 分隔文本。' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_删除行', runtimeName: '列表视图_删除行', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行索引', type: 'int' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_设置单元格', runtimeName: '列表视图_设置单元格', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行索引', type: 'int' }, { name: '列索引', type: 'int' }, { name: '文本', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_取单元格', runtimeName: '列表视图_取单元格', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行索引', type: 'int' }, { name: '列索引', type: 'int' }], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '列表视图_取行数', runtimeName: '列表视图_取行数', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_批量添加行', runtimeName: '列表视图_批量添加行', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行集合', type: 'raw', description: '列表视图行集合；兼容旧式多行 TSV 文本。' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_开始批量更新', runtimeName: '列表视图_开始批量更新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_结束批量更新', runtimeName: '列表视图_结束批量更新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_排序', runtimeName: '列表视图_排序', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '列索引', type: 'int' }, { name: '升序', type: 'bool' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_取最后单击列', runtimeName: '列表视图_取最后单击列', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_取虚拟模式', runtimeName: '列表视图_取虚拟模式', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_设置虚拟行数', runtimeName: '列表视图_设置虚拟行数', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行数', type: 'int' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '列表视图_设置虚拟行', runtimeName: '列表视图_设置虚拟行', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '行索引', type: 'int' }, { name: '行数据', type: 'raw', description: '列表视图行；兼容旧式 Tab 分隔文本。' }], returnType: 'bool', encoding: 'wide' }
        ,...LIST_VIEW_ADVANCED_BINDINGS
        ,...DATA_GRID_BINDINGS
        ,{ command: '树形框_添加节点', runtimeName: '树形框_添加节点', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '父节点文字', type: 'wideString' }, { name: '节点文字', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '选项卡_添加页', runtimeName: '选项卡_添加页', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '标题', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '选项卡_设置隐藏表头', runtimeName: '选项卡_设置隐藏表头', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '隐藏', type: 'bool' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '选项卡_取隐藏表头', runtimeName: '选项卡_取隐藏表头', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '文件对话框_打开', runtimeName: '文件对话框_打开', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['FileDialog'], controlKinds: ['resource'], scope: 'project' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '文件对话框_清空', runtimeName: '文件对话框_清空', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['FileDialog'], controlKinds: ['resource'], scope: 'project' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '文件对话框_取文件数量', runtimeName: '文件对话框_取文件数量', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['FileDialog'], controlKinds: ['resource'], scope: 'project' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '文件对话框_取文件', runtimeName: '文件对话框_取文件', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['FileDialog'], controlKinds: ['resource'], scope: 'project' }, { name: '索引', type: 'int' }], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '上下文菜单_显示', runtimeName: '上下文菜单_显示', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['ContextMenu'], controlKinds: ['resource'], scope: 'project' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '弹出菜单_显示', runtimeName: '弹出菜单_显示', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['PopupMenu'], controlKinds: ['resource'], scope: 'project' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '弹出菜单_在坐标显示', runtimeName: '弹出菜单_在坐标显示', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['PopupMenu'], controlKinds: ['resource'], scope: 'project' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '菜单_取最后项目', runtimeName: '菜单_取最后项目', parameters: [{ name: '组件名', type: 'controlRef', controlTypes: ['ContextMenu', 'PopupMenu'], controlKinds: ['resource'], scope: 'project' }], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '视频播放器_设置文件', runtimeName: '视频播放器_设置文件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '视频路径', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '视频播放器_播放', runtimeName: '视频播放器_播放', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '视频播放器_暂停', runtimeName: '视频播放器_暂停', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '视频播放器_停止', runtimeName: '视频播放器_停止', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '视频播放器_设置音量', runtimeName: '视频播放器_设置音量', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '音量', type: 'int' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '视频播放器_取状态', runtimeName: '视频播放器_取状态', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.edgeview',
    name: 'EdgeView 浏览器模块',
    version: '1.2.0',
    minLingBuilderVersion: '0.2.7',
    category: '界面',
    description: '基于 Microsoft Edge WebView2，把浏览器嵌入任意 Win32 窗口组件句柄，并提供导航、网页消息、浏览器事件和 JavaScript 返回值。',
    author: 'LingBuilder',
    tags: ['内置', 'Edge', 'WebView2', '浏览器', 'JavaScript'],
    contributes: {
      designerControls: createControlContributions('lingbuilder.edgeview'),
      commands: [
        ...EDGEVIEW_SAFE_API_COMMANDS,
        { name: 'EdgeView_创建', signature: 'EdgeView_创建(父组件句柄, 地址)', description: '在指定 HWND 组件客户区内创建 EdgeView；传 0 时嵌入当前窗口。成功返回 1。', insertText: 'EdgeView_创建(0, "https://example.com")', returnType: '整数型' },
        { name: 'EdgeView_创建实例', signature: 'EdgeView_创建实例(实例编号, 父组件句柄, 地址, 独立缓存目录)', description: '创建具名 EdgeView 实例；不同缓存目录拥有独立 Cookie、存储和会话。', insertText: 'EdgeView_创建实例(1, 0, "https://example.com", ".edgeview/cache-1")', returnType: '整数型' },
        { name: 'EdgeView_创建实例代理', signature: 'EdgeView_创建实例代理(实例编号, 父组件句柄, 地址, 独立缓存目录, 代理地址)', description: '创建使用独立代理的 EdgeView 实例；该代理覆盖全局代理。', insertText: 'EdgeView_创建实例代理(1, 0, "https://example.com", ".edgeview/cache-1", "http://127.0.0.1:7890")', returnType: '整数型' },
        { name: 'EdgeView_创建区域', signature: 'EdgeView_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录)', description: '在当前窗口指定区域创建独立承载 HWND 和 EdgeView 实例。', insertText: 'EdgeView_创建区域(1, 10, 10, 480, 500, "https://example.com", ".edgeview/cache-1")', returnType: '整数型' },
        { name: 'EdgeView_创建区域代理', signature: 'EdgeView_创建区域代理(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)', description: '在指定区域创建使用独立代理的 EdgeView 实例。', insertText: 'EdgeView_创建区域代理(1, 10, 10, 480, 500, "https://example.com", ".edgeview/cache-1", "socks5://127.0.0.1:1080")', returnType: '整数型' },
        { name: 'EdgeView_设置全局代理', signature: 'EdgeView_设置全局代理(代理地址)', description: '设置后续新建 EdgeView 实例默认使用的 HTTP/HTTPS/SOCKS5 代理；现有实例不变。', insertText: 'EdgeView_设置全局代理("http://127.0.0.1:7890")', returnType: '整数型' },
        { name: 'EdgeView_清除全局代理', signature: 'EdgeView_清除全局代理()', description: '清除后续新建实例的全局代理，现有实例不变。', insertText: 'EdgeView_清除全局代理()', returnType: '空' },
        { name: 'EdgeView_取全局代理', signature: 'EdgeView_取全局代理()', description: '返回当前 EdgeView 全局代理设置。', insertText: 'EdgeView_取全局代理()', returnType: '文本型' },
        { name: 'EdgeView_取实例代理', signature: 'EdgeView_取实例代理(实例编号)', description: '返回指定实例创建时实际采用的代理地址。', insertText: 'EdgeView_取实例代理(1)', returnType: '文本型' },
        { name: 'EdgeView_绑定事件', signature: 'EdgeView_绑定事件(实例编号, 事件名, &处理器名)', description: `绑定 WebView2 完整事件目录中的中文事件；当前目录共 ${EDGEVIEW_BROWSER_EVENT_NAMES.length} 项。旧字符串处理器仍兼容，但会产生迁移警告。`, insertText: 'EdgeView_绑定事件(1, "导航完成", &$1)', returnType: '整数型' },
        { name: 'EdgeView_监听开发者工具事件', signature: 'EdgeView_监听开发者工具事件(实例编号, 协议事件名)', description: '监听指定 Chromium DevTools Protocol 事件，触发“开发者工具协议事件”。', insertText: 'EdgeView_监听开发者工具事件(1, "Console.messageAdded")', returnType: '整数型' },
        { name: 'EdgeView_等待事件', signature: 'EdgeView_等待事件(实例编号, 事件名, 超时毫秒)', description: '泵送窗口消息并等待指定浏览器事件，成功返回 1，超时返回 0。', insertText: 'EdgeView_等待事件(1, "导航完成", 15000)', returnType: '整数型' },
        { name: 'EdgeView_导航', signature: 'EdgeView_导航(地址)', description: '导航到 HTTP/HTTPS 地址或本地文件地址。', insertText: 'EdgeView_导航("https://example.com")', returnType: '整数型' },
        { name: 'EdgeView_导航实例', signature: 'EdgeView_导航实例(实例编号, 地址)', description: '让指定 EdgeView 实例导航。', insertText: 'EdgeView_导航实例(1, "https://example.com")', returnType: '整数型' },
        { name: 'EdgeView_执行JS', signature: 'EdgeView_执行JS(脚本)', description: '执行 JavaScript 并等待异步回调，返回 WebView2 的 JSON 编码结果；失败返回空文本。', insertText: 'EdgeView_执行JS("document.title")', returnType: '文本型' },
        { name: 'EdgeView_执行JS实例', signature: 'EdgeView_执行JS实例(实例编号, 脚本)', description: '在指定实例执行 JavaScript，并返回 WebView2 JSON 编码结果。', insertText: 'EdgeView_执行JS实例(1, "document.title")', returnType: '文本型' },
        { name: 'EdgeView_取最近事件', signature: 'EdgeView_取最近事件()', description: '返回最近触发的 WebView2 中文事件名。', insertText: 'EdgeView_取最近事件()', returnType: '文本型' },
        { name: 'EdgeView_取事件数据', signature: 'EdgeView_取事件数据()', description: '返回最近事件携带的 UTF-16 JSON 对象文本。', insertText: 'EdgeView_取事件数据()', returnType: '文本型' },
        { name: 'EdgeView_取最近事件实例', signature: 'EdgeView_取最近事件实例(实例编号)', description: '返回指定浏览器实例最近事件名。', insertText: 'EdgeView_取最近事件实例(1)', returnType: '文本型' },
        { name: 'EdgeView_取事件数据实例', signature: 'EdgeView_取事件数据实例(实例编号)', description: '返回指定浏览器实例最近事件携带的数据。', insertText: 'EdgeView_取事件数据实例(1)', returnType: '文本型' },
        { name: 'EdgeView_后退', signature: 'EdgeView_后退()', description: '浏览器可以后退时返回上一页。', insertText: 'EdgeView_后退()', returnType: '整数型' },
        { name: 'EdgeView_前进', signature: 'EdgeView_前进()', description: '浏览器可以前进时进入下一页。', insertText: 'EdgeView_前进()', returnType: '整数型' },
        { name: 'EdgeView_刷新', signature: 'EdgeView_刷新()', description: '刷新当前网页。', insertText: 'EdgeView_刷新()', returnType: '空' },
        { name: 'EdgeView_关闭', signature: 'EdgeView_关闭()', description: '关闭浏览器控制器并释放 WebView2 资源。', insertText: 'EdgeView_关闭()', returnType: '空' }
        ,{ name: 'EdgeView_关闭实例', signature: 'EdgeView_关闭实例(实例编号)', description: '关闭指定 EdgeView 实例并释放其承载窗口。', insertText: 'EdgeView_关闭实例(1)', returnType: '空' }
        ,{ name: 'EdgeView_创建控件', signature: 'EdgeView_创建控件(控件名)', description: '使用设计器属性重新创建指定 Edge 浏览器控件；空文本创建当前窗口全部 Edge 浏览器控件。', insertText: 'EdgeView_创建控件($1)', returnType: '整数型' }
        ,{ name: 'EdgeView_导航控件', signature: 'EdgeView_导航控件(控件名, 地址)', description: '让指定设计器 Edge 浏览器控件导航到新地址。', insertText: 'EdgeView_导航控件($1, "https://example.com")', returnType: '整数型' }
        ,{ name: 'EdgeView_执行JS控件', signature: 'EdgeView_执行JS控件(控件名, 脚本)', description: '在指定设计器 Edge 浏览器控件中执行 JavaScript 并返回 JSON 编码结果。', insertText: 'EdgeView_执行JS控件($1, "document.title")', returnType: '文本型' }
        ,{ name: 'EdgeView_取最近事件控件', signature: 'EdgeView_取最近事件控件(控件名)', description: '读取指定设计器 Edge 浏览器控件最近触发的事件名。', insertText: 'EdgeView_取最近事件控件($1)', returnType: '文本型' }
        ,{ name: 'EdgeView_取事件数据控件', signature: 'EdgeView_取事件数据控件(控件名)', description: '读取指定设计器 Edge 浏览器控件最近事件的数据。', insertText: 'EdgeView_取事件数据控件($1)', returnType: '文本型' }
        ,{ name: 'EdgeView_后退控件', signature: 'EdgeView_后退控件(控件名)', description: '让指定设计器 Edge 浏览器控件后退。', insertText: 'EdgeView_后退控件($1)', returnType: '整数型' }
        ,{ name: 'EdgeView_前进控件', signature: 'EdgeView_前进控件(控件名)', description: '让指定设计器 Edge 浏览器控件前进。', insertText: 'EdgeView_前进控件($1)', returnType: '整数型' }
        ,{ name: 'EdgeView_刷新控件', signature: 'EdgeView_刷新控件(控件名)', description: '刷新指定设计器 Edge 浏览器控件。', insertText: 'EdgeView_刷新控件($1)', returnType: '空' }
        ,{ name: 'EdgeView_关闭控件', signature: 'EdgeView_关闭控件(控件名)', description: '关闭指定设计器 Edge 浏览器控件并保留设计器宿主占位。', insertText: 'EdgeView_关闭控件($1)', returnType: '空' }
        ,{ name: 'EdgeView_绑定控件事件', signature: 'EdgeView_绑定控件事件(控件名, 事件名, &处理器名)', description: `按控件名绑定 WebView2 完整事件目录中的中文事件；当前目录共 ${EDGEVIEW_BROWSER_EVENT_NAMES.length} 项。旧字符串处理器仍兼容，但会产生迁移警告。`, insertText: 'EdgeView_绑定控件事件($1, "导航完成", &$2)', returnType: '整数型' }
        ,{ name: 'EdgeView_监听开发者工具事件控件', signature: 'EdgeView_监听开发者工具事件控件(控件名, 协议事件名)', description: '按设计器控件名监听 Chromium DevTools Protocol 事件。', insertText: 'EdgeView_监听开发者工具事件控件($1, "Console.messageAdded")', returnType: '整数型' }
      ],
      types: [{ name: 'EdgeView浏览器', description: '嵌入 Win32 HWND 的 Microsoft Edge WebView2 浏览器。', cppType: 'ICoreWebView2*' }],
      snippets: [{ label: 'EdgeView 嵌入与 JS 返回值', insertText: 'EdgeView_创建(0, "https://example.com")\n调试输出(EdgeView_执行JS("document.title"))\n调试输出(EdgeView_取最近事件())\n调试输出(EdgeView_取事件数据())', description: '在当前窗口嵌入 EdgeView，并读取网页标题与最近浏览器事件。' }]
    },
    targets: [
      { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/WebView2.h', 'include/WebView2EnvironmentOptions.h'], libs: ['ole32.lib'], runtimeFiles: ['bin/x86/WebView2Loader.dll'], defines: ['LINGBUILDER_EDGEVIEW_MODULE'] },
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/WebView2.h', 'include/WebView2EnvironmentOptions.h'], libs: ['ole32.lib'], runtimeFiles: ['bin/x64/WebView2Loader.dll'], defines: ['LINGBUILDER_EDGEVIEW_MODULE'] }
    ],
    bindings: { commands: [
      ...EDGEVIEW_SAFE_API_BINDINGS,
      { command: 'EdgeView_创建', runtimeName: 'EdgeView_创建', parameters: [{ name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建实例', runtimeName: 'EdgeView_创建实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建实例代理', runtimeName: 'EdgeView_创建实例代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建区域', runtimeName: 'EdgeView_创建区域', parameters: [{ name: '实例编号', type: 'int' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建区域代理', runtimeName: 'EdgeView_创建区域代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_设置全局代理', runtimeName: 'EdgeView_设置全局代理', parameters: [{ name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_清除全局代理', runtimeName: 'EdgeView_清除全局代理', parameters: [], returnType: 'void' },
      { command: 'EdgeView_取全局代理', runtimeName: 'EdgeView_取全局代理', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取实例代理', runtimeName: 'EdgeView_取实例代理', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_绑定事件', runtimeName: 'EdgeView_绑定事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '事件名', type: 'wideString' }, { name: '处理器名', type: 'handler', description: '新代码必须使用 &处理器名；旧字符串写法仅兼容迁移。' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_监听开发者工具事件', runtimeName: 'EdgeView_监听开发者工具事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '协议事件名', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_等待事件', runtimeName: 'EdgeView_等待事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '事件名', type: 'wideString' }, { name: '超时毫秒', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_导航', runtimeName: 'EdgeView_导航', parameters: [{ name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_导航实例', runtimeName: 'EdgeView_导航实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_执行JS', runtimeName: 'EdgeView_执行JS', parameters: [{ name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_执行JS实例', runtimeName: 'EdgeView_执行JS实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取最近事件', runtimeName: 'EdgeView_取最近事件', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取事件数据', runtimeName: 'EdgeView_取事件数据', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取最近事件实例', runtimeName: 'EdgeView_取最近事件实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取事件数据实例', runtimeName: 'EdgeView_取事件数据实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_后退', runtimeName: 'EdgeView_后退', parameters: [], returnType: 'int' },
      { command: 'EdgeView_前进', runtimeName: 'EdgeView_前进', parameters: [], returnType: 'int' },
      { command: 'EdgeView_刷新', runtimeName: 'EdgeView_刷新', parameters: [], returnType: 'void' },
      { command: 'EdgeView_关闭', runtimeName: 'EdgeView_关闭', parameters: [], returnType: 'void' },
      { command: 'EdgeView_关闭实例', runtimeName: 'EdgeView_关闭实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'void' }
      ,{ command: 'EdgeView_创建控件', runtimeName: 'EdgeView_创建控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_导航控件', runtimeName: 'EdgeView_导航控件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_执行JS控件', runtimeName: 'EdgeView_执行JS控件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView_取最近事件控件', runtimeName: 'EdgeView_取最近事件控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView_取事件数据控件', runtimeName: 'EdgeView_取事件数据控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView_后退控件', runtimeName: 'EdgeView_后退控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_前进控件', runtimeName: 'EdgeView_前进控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_刷新控件', runtimeName: 'EdgeView_刷新控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' }
      ,{ command: 'EdgeView_关闭控件', runtimeName: 'EdgeView_关闭控件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' }
      ,{ command: 'EdgeView_绑定控件事件', runtimeName: 'EdgeView_绑定控件事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString' }, { name: '处理器名', type: 'handler', description: '新代码必须使用 &处理器名；旧字符串写法仅兼容迁移。' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_监听开发者工具事件控件', runtimeName: 'EdgeView_监听开发者工具事件控件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '协议事件名', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
    ] }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.cef3.browser',
    name: 'CEF3浏览器模块',
    version: '3.0.0-alpha.2',
    category: '界面',
    description: '基于 Chromium Embedded Framework 3，提供设计器浏览器控件、中文命令和集中式浏览器事件目录。',
    author: 'LingBuilder',
    tags: ['内置', 'CEF3', 'Chromium', '浏览器', 'JavaScript'],
    compatibility: {
      conflicts: [{ moduleId: 'lingbuilder.fbro.browser', reason: 'LingBuilder CEF3 使用 CEF 150，而 FBro 固定使用 CEF 135；同一进程不能加载两个 ABI 不兼容的 libcef.dll。' }]
    },
    contributes: {
      designerControls: createControlContributions('lingbuilder.cef3.browser'),
      commands: [
        { name: 'CEF3_导航', signature: 'CEF3_导航(控件名, 地址)', description: '让指定 CEF3 浏览器控件导航到 HTTP/HTTPS 地址或本地文件地址。', insertText: 'CEF3_导航($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'CEF3_打开原生UI浏览器', signature: 'CEF3_打开原生UI浏览器(控件名, 地址)', description: '使用 CEF Chrome Runtime 创建带原生地址栏和浏览器界面的独立顶层窗口，并纳入指定内嵌控件的 popup 生命周期管理。', insertText: 'CEF3_打开原生UI浏览器($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'CEF3_执行JS', aliases: ['Runtime.evaluate'], signature: 'CEF3_执行JS(控件名, 脚本)', description: '通过 DevTools Runtime.evaluate 执行 JavaScript，最多等待 5 秒并返回 JSON 结果；新代码优先使用异步任务接口。', insertText: 'CEF3_执行JS($1, "document.title")', returnType: '文本型' },
        { name: 'CEF3_后退', signature: 'CEF3_后退(控件名)', description: '指定 CEF3 浏览器控件可以后退时返回上一页，成功返回 1。', insertText: 'CEF3_后退($1)', returnType: '整数型' },
        { name: 'CEF3_前进', signature: 'CEF3_前进(控件名)', description: '指定 CEF3 浏览器控件可以前进时进入下一页，成功返回 1。', insertText: 'CEF3_前进($1)', returnType: '整数型' },
        { name: 'CEF3_刷新', signature: 'CEF3_刷新(控件名)', description: '刷新指定 CEF3 浏览器控件的当前网页。', insertText: 'CEF3_刷新($1)', returnType: '空' },
        { name: 'CEF3_停止', signature: 'CEF3_停止(控件名)', description: '停止指定 CEF3 浏览器控件的当前导航。', insertText: 'CEF3_停止($1)', returnType: '空' },
        { name: 'CEF3_取标题', signature: 'CEF3_取标题(控件名)', description: '返回指定 CEF3 浏览器控件当前网页标题。', insertText: 'CEF3_取标题($1)', returnType: '文本型' },
        { name: 'CEF3_取地址', signature: 'CEF3_取地址(控件名)', description: '返回指定 CEF3 浏览器控件当前网页地址。', insertText: 'CEF3_取地址($1)', returnType: '文本型' },
        { name: 'CEF3_设置缓存目录', aliases: ['CefRequestContext::CreateContext'], signature: 'CEF3_设置缓存目录(控件名, 目录)', description: '设置实例独立 RequestContext 的缓存目录标识；实际目录被安全映射到全局 root_cache_path 的直接子目录。需在创建前设置。', insertText: 'CEF3_设置缓存目录($1, "cache-2")', returnType: '整数型' },
        { name: 'CEF3_设置代理', aliases: ['CefPreferenceManager::SetPreference'], signature: 'CEF3_设置代理(控件名, 代理地址)', description: '为实例独立 RequestContext 设置 HTTP/HTTPS/SOCKS5 代理；空文本使用直连。需在创建前设置。', insertText: 'CEF3_设置代理($1, "http://127.0.0.1:7890")', returnType: '整数型' },
        { name: 'CEF3_创建', signature: 'CEF3_创建(控件名)', description: '使用属性面板配置的地址、缓存目录和代理参数初始化指定 CEF3 浏览器控件；传空控件名时初始化当前窗口全部 CEF3 控件。成功返回 1。', insertText: 'CEF3_创建($1)', returnType: '整数型' },
        { name: 'CEF3_关闭', signature: 'CEF3_关闭(控件名)', description: '关闭指定 CEF3 浏览器控件并释放 Chromium 资源。', insertText: 'CEF3_关闭($1)', returnType: '空' },
        { name: 'CEF3_取最近事件', signature: 'CEF3_取最近事件(控件名)', description: `返回最近 CEF3 事件名；当前目录包含 ${CEF3_BROWSER_EVENT_NAMES.length} 个浏览器回调。`, insertText: 'CEF3_取最近事件($1)', returnType: '文本型' },
        { name: 'CEF3_取事件数据', signature: 'CEF3_取事件数据(控件名)', description: '返回最近事件的主要文本数据。', insertText: 'CEF3_取事件数据($1)', returnType: '文本型' },
        { name: 'CEF3_取事件字段', signature: 'CEF3_取事件字段(控件名, 字段名)', description: '读取最近事件的命名字段，例如 url、frameId、statusCode、progress、commandId。', insertText: 'CEF3_取事件字段($1, "url")', returnType: '文本型' },
        { name: 'CEF3_设置事件结果', signature: 'CEF3_设置事件结果(控件名, 结果)', description: '设置当前同步事件结果：0=默认、1=允许/继续、2=拒绝/取消、3=已处理。', insertText: 'CEF3_设置事件结果($1, 1)', returnType: '整数型' },
        { name: 'CEF3_设置事件返回文本', signature: 'CEF3_设置事件返回文本(控件名, 文本)', description: '设置当前事件的返回文本，例如修改后的 URL、下载路径、对话框输入或身份验证信息。', insertText: 'CEF3_设置事件返回文本($1, "$2")', returnType: '整数型' },
        { name: 'CEF3_绑定事件', signature: 'CEF3_绑定事件(控件名, 事件名, 处理器)', description: `绑定 CEF3 浏览器事件目录（${CEF3_BROWSER_EVENT_NAMES.length} 项）到当前窗口无参数中文事件或方法；处理器必须使用 &处理器名。`, insertText: 'CEF3_绑定事件($1, "加载完成", &$2)', returnType: '整数型' },
        { name: 'CEF3_是否可后退', signature: 'CEF3_是否可后退(控件名)', description: '指定 CEF3 浏览器控件可以后退时返回 1。', insertText: 'CEF3_是否可后退($1)', returnType: '整数型' },
        { name: 'CEF3_是否可前进', signature: 'CEF3_是否可前进(控件名)', description: '指定 CEF3 浏览器控件可以前进时返回 1。', insertText: 'CEF3_是否可前进($1)', returnType: '整数型' },
        { name: 'CEF3_是否加载中', signature: 'CEF3_是否加载中(控件名)', description: '指定 CEF3 浏览器控件正在加载网页时返回 1。', insertText: 'CEF3_是否加载中($1)', returnType: '整数型' }
      ],
      types: [{ name: 'CEF3浏览器', description: '由 LingBuilderCefBridge 管理的 CEF 150 浏览器句柄。', cppType: 'LB_CEF3_HANDLE' }],
      snippets: [{ label: 'CEF3 浏览器导航与 JS 返回值', insertText: 'CEF3_导航(浏览器1, "https://www.baidu.com")\n调试输出(CEF3_执行JS(浏览器1, "document.title"))\n调试输出(CEF3_取最近事件(浏览器1))', description: '在 CEF3 浏览器控件中导航，并读取网页标题与最近事件。' }],
      docs: [{ title: 'CEF3 模块说明', path: 'README.md' }],
      examples: [{ title: '双浏览器示例', path: 'examples/双浏览器示例.lcpp', description: '在同一窗口创建两个独立缓存目录的 CEF3 浏览器控件。' }]
    },
    targets: [
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/LingBuilderCefBridge.h'], libs: ['modules/lingbuilder.cef3.browser/lib/x64/LingBuilderCefBridge.lib'], runtimeFiles: ['bin/x64/libcef.dll', 'bin/x64/chrome_elf.dll', 'bin/x64/LingBuilderCefBridge.dll'], defines: ['LINGBUILDER_CEF3_MODULE'] }
    ],
    bindings: { commands: [
      { command: 'CEF3_导航', runtimeName: 'CEF3_导航', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_导航(浏览器1, "https://www.baidu.com")' },
      { command: 'CEF3_打开原生UI浏览器', runtimeName: 'CEF3_打开原生UI浏览器', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_打开原生UI浏览器(浏览器1, "https://www.baidu.com")' },
      { command: 'CEF3_执行JS', runtimeName: 'CEF3_执行JS', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide', example: 'CEF3_执行JS(浏览器1, "document.title")' },
      { command: 'CEF3_后退', runtimeName: 'CEF3_后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_前进', runtimeName: 'CEF3_前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_刷新', runtimeName: 'CEF3_刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_停止', runtimeName: 'CEF3_停止', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_取标题', runtimeName: 'CEF3_取标题', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取地址', runtimeName: 'CEF3_取地址', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_设置缓存目录', runtimeName: 'CEF3_设置缓存目录', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_设置代理', runtimeName: 'CEF3_设置代理', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_创建', runtimeName: 'CEF3_创建', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_关闭', runtimeName: 'CEF3_关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_取最近事件', runtimeName: 'CEF3_取最近事件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取事件数据', runtimeName: 'CEF3_取事件数据', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取事件字段', runtimeName: 'CEF3_取事件字段', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '字段名', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_设置事件结果', runtimeName: 'CEF3_设置事件结果', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '结果', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_设置事件返回文本', runtimeName: 'CEF3_设置事件返回文本', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_绑定事件', runtimeName: 'CEF3_绑定事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString', description: '事件名' }, { name: '处理器', type: 'handler', description: '必须使用 &处理器名' }], returnType: 'int', encoding: 'wide', example: 'CEF3_绑定事件(浏览器1, "加载完成", &浏览器1_加载完成)' },
      { command: 'CEF3_是否可后退', runtimeName: 'CEF3_是否可后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否可前进', runtimeName: 'CEF3_是否可前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否加载中', runtimeName: 'CEF3_是否加载中', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
    ] }
  },
  ...CEF3_SUBMODULES,
  {
    schemaVersion: 2,
    id: 'lingbuilder.fbro.browser',
    name: 'FBro指纹浏览器模块',
    version: '2.1.0',
    category: '界面',
    description: '通过隔离的 C ABI 桥接层使用 FBro/FBrowser CEF 135 x64，提供设计器浏览器控件、基础浏览器控制和结构化指纹配置。',
    author: 'LingBuilder',
    tags: ['内置', 'FBro', 'FBrowser', '指纹浏览器', 'CEF135', 'x64'],
    compatibility: {
      conflicts: [{ moduleId: 'lingbuilder.cef3.browser', reason: 'FBro 固定使用 CEF 135，而 LingBuilder CEF3 模块使用 CEF 150；同一进程不能加载两个 ABI 不兼容的 libcef.dll。' }]
    },
    contributes: {
      designerControls: createControlContributions('lingbuilder.fbro.browser'),
      commands: [
        { name: 'FBro_创建', aliases: ['LB_FBro_Create', 'LB_FBro_CreateEx'], signature: 'FBro_创建(控件名)', description: '使用设计器属性创建指定 FBro 浏览器；空控件名创建当前窗口全部 FBro 控件。', insertText: 'FBro_创建($1)', returnType: '整数型' },
        { name: 'FBro_打开谷歌原生UI浏览器', aliases: ['LB_FBro_CreateChromeUi'], signature: 'FBro_打开谷歌原生UI浏览器(控件名, 地址)', description: '基于指定内嵌 FBro 实例的会话创建 Chrome Runtime 独立顶层浏览器；不接收或复用 LingBuilder 窗口句柄。', insertText: 'FBro_打开谷歌原生UI浏览器($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'FBro_关闭', aliases: ['LB_FBro_Close'], signature: 'FBro_关闭(控件名)', description: '关闭指定 FBro 浏览器并释放实例。', insertText: 'FBro_关闭($1)', returnType: '空' },
        { name: 'FBro_导航', aliases: ['LB_FBro_Navigate'], signature: 'FBro_导航(控件名, 地址)', description: '让指定 FBro 浏览器导航到目标地址。', insertText: 'FBro_导航($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'FBro_刷新', aliases: ['LB_FBro_Reload'], signature: 'FBro_刷新(控件名)', description: '刷新指定 FBro 浏览器。', insertText: 'FBro_刷新($1)', returnType: '空' },
        { name: 'FBro_后退', aliases: ['LB_FBro_GoBack'], signature: 'FBro_后退(控件名)', description: '浏览器可以后退时返回上一页。', insertText: 'FBro_后退($1)', returnType: '整数型' },
        { name: 'FBro_前进', aliases: ['LB_FBro_GoForward'], signature: 'FBro_前进(控件名)', description: '浏览器可以前进时进入下一页。', insertText: 'FBro_前进($1)', returnType: '整数型' },
        { name: 'FBro_停止', aliases: ['LB_FBro_Stop'], signature: 'FBro_停止(控件名)', description: '停止指定浏览器当前导航。', insertText: 'FBro_停止($1)', returnType: '空' },
        { name: 'FBro_是否可后退', aliases: ['LB_FBro_CanGoBack'], signature: 'FBro_是否可后退(控件名)', description: '返回指定浏览器当前是否存在可后退的历史记录。', insertText: 'FBro_是否可后退($1)', returnType: '整数型' },
        { name: 'FBro_是否可前进', aliases: ['LB_FBro_CanGoForward'], signature: 'FBro_是否可前进(控件名)', description: '返回指定浏览器当前是否存在可前进的历史记录。', insertText: 'FBro_是否可前进($1)', returnType: '整数型' },
        { name: 'FBro_是否加载中', aliases: ['LB_FBro_IsLoading'], signature: 'FBro_是否加载中(控件名)', description: '返回指定浏览器是否正在加载页面。', insertText: 'FBro_是否加载中($1)', returnType: '整数型' },
        { name: 'FBro_取缩放级别', aliases: ['LB_FBro_GetZoomLevel'], signature: 'FBro_取缩放级别(控件名)', description: '读取浏览器宿主当前缩放级别。', insertText: 'FBro_取缩放级别($1)', returnType: '小数型' },
        { name: 'FBro_设置缩放级别', aliases: ['LB_FBro_SetZoomLevel'], signature: 'FBro_设置缩放级别(控件名, 级别)', description: '设置浏览器宿主缩放级别。', insertText: 'FBro_设置缩放级别($1, 0)', returnType: '整数型' },
        { name: 'FBro_是否静音', aliases: ['LB_FBro_IsAudioMuted'], signature: 'FBro_是否静音(控件名)', description: '返回指定浏览器是否已静音。', insertText: 'FBro_是否静音($1)', returnType: '整数型' },
        { name: 'FBro_设置静音', aliases: ['LB_FBro_SetAudioMuted'], signature: 'FBro_设置静音(控件名, 是否静音)', description: '设置指定浏览器的音频静音状态。', insertText: 'FBro_设置静音($1, 真)', returnType: '整数型' },
        { name: 'FBro_设置焦点', aliases: ['LB_FBro_SendFocusEvent'], signature: 'FBro_设置焦点(控件名, 是否聚焦)', description: '向浏览器宿主发送焦点状态。', insertText: 'FBro_设置焦点($1, 真)', returnType: '整数型' },
        { name: 'FBro_查找', aliases: ['LB_FBro_Find'], signature: 'FBro_查找(控件名, 文本, 向前, 区分大小写, 查找下一个)', description: '在当前页面中查找文本。', insertText: 'FBro_查找($1, "$2", 真, 假, 假)', returnType: '整数型' },
        { name: 'FBro_停止查找', aliases: ['LB_FBro_StopFinding'], signature: 'FBro_停止查找(控件名, 清除选择)', description: '停止页面查找并可选清除当前选择。', insertText: 'FBro_停止查找($1, 真)', returnType: '整数型' },
        { name: 'FBro_是否打开开发者工具', aliases: ['LB_FBro_HasDevTools'], signature: 'FBro_是否打开开发者工具(控件名)', description: '返回指定浏览器是否已有 DevTools 实例。', insertText: 'FBro_是否打开开发者工具($1)', returnType: '整数型' },
        { name: 'FBro_关闭开发者工具', aliases: ['LB_FBro_CloseDevTools'], signature: 'FBro_关闭开发者工具(控件名)', description: '关闭指定浏览器的 DevTools。', insertText: 'FBro_关闭开发者工具($1)', returnType: '整数型' },
        { name: 'FBro_强制刷新', aliases: ['LB_FBro_ReloadIgnoreCache'], signature: 'FBro_强制刷新(控件名)', description: '忽略缓存重新加载当前页面。', insertText: 'FBro_强制刷新($1)', returnType: '整数型' },
        { name: 'FBro_取浏览器标识', aliases: ['LB_FBro_GetIdentifier'], signature: 'FBro_取浏览器标识(控件名)', description: '返回 FBro/CEF 分配的浏览器标识。', insertText: 'FBro_取浏览器标识($1)', returnType: '整数型' },
        { name: 'FBro_是否同一实例', aliases: ['LB_FBro_IsSame'], signature: 'FBro_是否同一实例(控件名, 另一控件名)', description: '判断两个受管控件是否引用同一个底层浏览器。', insertText: 'FBro_是否同一实例($1, $2)', returnType: '整数型' },
        { name: 'FBro_是否弹出窗口', aliases: ['LB_FBro_IsPopup'], signature: 'FBro_是否弹出窗口(控件名)', description: '返回底层浏览器是否为 popup。', insertText: 'FBro_是否弹出窗口($1)', returnType: '整数型' },
        { name: 'FBro_是否有文档', aliases: ['LB_FBro_HasDocument'], signature: 'FBro_是否有文档(控件名)', description: '返回浏览器是否已加载文档。', insertText: 'FBro_是否有文档($1)', returnType: '整数型' },
        { name: 'FBro_尝试关闭', aliases: ['LB_FBro_TryCloseBrowser'], signature: 'FBro_尝试关闭(控件名)', description: '请求浏览器按官方关闭协议完成关闭。', insertText: 'FBro_尝试关闭($1)', returnType: '整数型' },
        { name: 'FBro_设置宿主焦点', aliases: ['LB_FBro_SetFocus'], signature: 'FBro_设置宿主焦点(控件名, 是否聚焦)', description: '设置浏览器宿主的焦点状态。', insertText: 'FBro_设置宿主焦点($1, 真)', returnType: '整数型' },
        { name: 'FBro_是否有视图', aliases: ['LB_FBro_HasView'], signature: 'FBro_是否有视图(控件名)', description: '返回浏览器宿主是否具有可用视图。', insertText: 'FBro_是否有视图($1)', returnType: '整数型' },
        { name: 'FBro_设置自动调整大小', aliases: ['LB_FBro_SetAutoResizeEnabled'], signature: 'FBro_设置自动调整大小(控件名, 启用, 最小高度, 最小宽度, 最大高度, 最大宽度)', description: '设置官方宿主自动调整大小范围；范围必须非负且最大值不小于最小值。', insertText: 'FBro_设置自动调整大小($1, 真, 100, 100, 1080, 1920)', returnType: '整数型' },
        { name: 'FBro_执行JS', aliases: ['LB_FBro_ExecuteJs'], signature: 'FBro_执行JS(控件名, 脚本)', description: '通过桥接层执行 JavaScript，返回 UTF-16 结果或中文错误。', insertText: 'FBro_执行JS($1, "document.title")', returnType: '文本型' },
        { name: 'FBro_取标题', aliases: ['LB_FBro_GetTitle'], signature: 'FBro_取标题(控件名)', description: '返回最近一次标题事件记录的网页标题。', insertText: 'FBro_取标题($1)', returnType: '文本型' },
        { name: 'FBro_取地址', aliases: ['LB_FBro_GetUrl'], signature: 'FBro_取地址(控件名)', description: '返回指定浏览器当前地址。', insertText: 'FBro_取地址($1)', returnType: '文本型' },
        { name: 'FBro_设置代理', aliases: ['LB_FBro_SetProxy'], signature: 'FBro_设置代理(控件名, 代理地址)', description: '设置创建前使用的代理地址；空文本表示直连。', insertText: 'FBro_设置代理($1, "$2")', returnType: '整数型' },
        { name: 'FBro_设置缓存目录', aliases: ['LB_FBro_SetProfileDirectory'], signature: 'FBro_设置缓存目录(控件名, 目录)', description: '设置创建前使用的独立缓存目录。', insertText: 'FBro_设置缓存目录($1, "$2")', returnType: '整数型' },
        { name: 'FBro_设置UserAgent', aliases: ['LB_FBro_SetUserAgent'], signature: 'FBro_设置UserAgent(控件名, UserAgent)', description: '设置创建前使用的 User-Agent。', insertText: 'FBro_设置UserAgent($1, "$2")', returnType: '整数型' },
        { name: 'FBro_取Cookie', aliases: ['LB_FBro_GetCookies'], signature: 'FBro_取Cookie(控件名, 地址)', description: '异步读取指定地址 Cookie；首版返回桥接层最近快照。', insertText: 'FBro_取Cookie($1, "$2")', returnType: '文本型' },
        { name: 'FBro_清空Cookie', aliases: ['LB_FBro_ClearCookies'], signature: 'FBro_清空Cookie(控件名, 地址)', description: '删除指定地址的 Cookie。', insertText: 'FBro_清空Cookie($1, "$2")', returnType: '整数型' },
        { name: 'FBro指纹_应用配置', aliases: ['LB_FBro_ApplyFingerprintJson'], signature: 'FBro指纹_应用配置(控件名, JSON)', description: '应用结构化指纹 JSON；未配置 VIP 授权时返回 0 并记录中文错误。', insertText: 'FBro指纹_应用配置($1, "$2")', returnType: '整数型' },
        { name: 'FBro指纹_取调用次数', aliases: ['LB_FBro_GetFingerprintCallCount'], signature: 'FBro指纹_取调用次数(控件名)', description: '返回 FBro VIP 指纹调用次数。', insertText: 'FBro指纹_取调用次数($1)', returnType: '文本型' },
        { name: 'FBro指纹_清空调用次数', aliases: ['LB_FBro_ClearFingerprintCallCount'], signature: 'FBro指纹_清空调用次数(控件名)', description: '清空指定浏览器的指纹调用次数。', insertText: 'FBro指纹_清空调用次数($1)', returnType: '整数型' },
        { name: 'FBro_取最近事件', aliases: ['LB_FBro_GetLastEvent'], signature: 'FBro_取最近事件(控件名)', description: '返回最近 FBro 浏览器事件名。', insertText: 'FBro_取最近事件($1)', returnType: '文本型' },
        { name: 'FBro_取最近错误', aliases: ['LB_FBro_GetLastError'], signature: 'FBro_取最近错误(控件名)', description: '返回桥接层最近中文错误。', insertText: 'FBro_取最近错误($1)', returnType: '文本型' }
      ],
      types: [{ name: 'FBro浏览器', description: '由 LingBuilderFbroBridge 管理的不透明 FBro 浏览器句柄。', cppType: 'LB_FBRO_HANDLE' }],
      snippets: [{ label: 'FBro 指纹浏览器基础操作', insertText: 'FBro_创建(FBro浏览器1)\nFBro_导航(FBro浏览器1, "https://www.baidu.com")\n调试输出(FBro_取地址(FBro浏览器1))', description: '创建 FBro 控件并导航。' }]
    },
    targets: [{
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      includeDirs: ['include'], headers: ['include/LingBuilderFbroBridge.h'],
      libs: ['modules/lingbuilder.fbro.browser/lib/x64/LingBuilderFbroBridge.lib'],
      runtimeFiles: ['bin/x64/LingBuilderFbroBridge.dll'], defines: ['LINGBUILDER_FBRO_MODULE']
    }],
    bindings: { commands: [
      { command: 'FBro_创建', runtimeName: 'FBro_创建', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_打开谷歌原生UI浏览器', runtimeName: 'FBro_打开谷歌原生UI浏览器', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'FBro_打开谷歌原生UI浏览器(FBro浏览器1, "https://www.baidu.com")' },
      { command: 'FBro_关闭', runtimeName: 'FBro_关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'FBro_导航', runtimeName: 'FBro_导航', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_刷新', runtimeName: 'FBro_刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'FBro_后退', runtimeName: 'FBro_后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_前进', runtimeName: 'FBro_前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_停止', runtimeName: 'FBro_停止', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'FBro_是否可后退', runtimeName: 'FBro_是否可后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否可前进', runtimeName: 'FBro_是否可前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否加载中', runtimeName: 'FBro_是否加载中', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取缩放级别', runtimeName: 'FBro_取缩放级别', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'double', encoding: 'wide' },
      { command: 'FBro_设置缩放级别', runtimeName: 'FBro_设置缩放级别', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '级别', type: 'double' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否静音', runtimeName: 'FBro_是否静音', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置静音', runtimeName: 'FBro_设置静音', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否静音', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置焦点', runtimeName: 'FBro_设置焦点', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否聚焦', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_查找', runtimeName: 'FBro_查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }, { name: '向前', type: 'bool' }, { name: '区分大小写', type: 'bool' }, { name: '查找下一个', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_停止查找', runtimeName: 'FBro_停止查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '清除选择', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否打开开发者工具', runtimeName: 'FBro_是否打开开发者工具', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_关闭开发者工具', runtimeName: 'FBro_关闭开发者工具', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_强制刷新', runtimeName: 'FBro_强制刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取浏览器标识', runtimeName: 'FBro_取浏览器标识', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否同一实例', runtimeName: 'FBro_是否同一实例', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '另一控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否弹出窗口', runtimeName: 'FBro_是否弹出窗口', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否有文档', runtimeName: 'FBro_是否有文档', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_尝试关闭', runtimeName: 'FBro_尝试关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置宿主焦点', runtimeName: 'FBro_设置宿主焦点', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否聚焦', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否有视图', runtimeName: 'FBro_是否有视图', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置自动调整大小', runtimeName: 'FBro_设置自动调整大小', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }, { name: '最小高度', type: 'int' }, { name: '最小宽度', type: 'int' }, { name: '最大高度', type: 'int' }, { name: '最大宽度', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_执行JS', runtimeName: 'FBro_执行JS', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取标题', runtimeName: 'FBro_取标题', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取地址', runtimeName: 'FBro_取地址', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_设置代理', runtimeName: 'FBro_设置代理', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置缓存目录', runtimeName: 'FBro_设置缓存目录', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_设置UserAgent', runtimeName: 'FBro_设置UserAgent', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'UserAgent', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取Cookie', runtimeName: 'FBro_取Cookie', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_清空Cookie', runtimeName: 'FBro_清空Cookie', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro指纹_应用配置', runtimeName: 'FBro指纹_应用配置', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'JSON', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro指纹_取调用次数', runtimeName: 'FBro指纹_取调用次数', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro指纹_清空调用次数', runtimeName: 'FBro指纹_清空调用次数', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取最近事件', runtimeName: 'FBro_取最近事件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取最近错误', runtimeName: 'FBro_取最近错误', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' }
    ] }
  },
  ...FBRO_SUBMODULES,
  THREADING_MODULE,
  WEBSOCKET_CLIENT_MODULE,
  HTTP_SERVER_MODULE,
  WEBSOCKET_SERVER_MODULE
].map(normalizeBuiltinControlReferences).map(ensureBuiltinX64Target);
