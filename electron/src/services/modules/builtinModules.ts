import { LingBuilderModuleManifest, ModuleCommandBinding, ModuleCommandBindingParameter } from './types';
import { normalizeControlReferenceCallSnippet, normalizeControlReferenceParameter, normalizeControlReferenceSnippet, normalizeHandlerParameter, type ParamDocTable } from './bindingValueType';
import { getWin32ControlsForModule, getWin32RuntimeControlContract, getWin32RuntimeControlContracts, Win32ControlModuleId, Win32RuntimeControlParameterRole } from '../windowDesigner/win32ControlRegistry';
import { STANDARD_LIBRARY_MODULES } from './standardLibraryModules';
import { PROTOBUF_MODULE } from './protobufModule';
import { ARIA2_MODULE } from './aria2Module';
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
import { EMBEDDED_RESOURCE_MODULE } from './resourceEmbedModule';
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
    })),
    runtimeControl: getWin32RuntimeControlContract(definition)
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
  return getWin32ControlsForModule(moduleId).map(definition => {
    const contract = getWin32RuntimeControlContract(definition);
    return {
      name: contract?.lingCppType || definition.label.split('/')[0],
      description: contract
        ? `Win32 ${definition.label}控件的非拥有型运行时引用。`
        : `Win32 ${definition.label}组件。`,
      cppType: contract?.cppType || 'HWND'
    };
  });
}

function createRuntimeControlCommandContributions(moduleId: Win32ControlModuleId) {
  return getWin32RuntimeControlContracts(moduleId).flatMap(contract => [
    {
      name: contract.createCommand,
      signature: `${contract.createCommand}(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])`,
      description: `在当前窗口运行时创建${contract.lingCppType}；窗口拥有生命周期，代码获得非拥有型引用。`,
      insertText: `${contract.createCommand}(当前窗口, $1, $2, $3, $4, "$5", "$6", $7)`,
      returnType: contract.lingCppType
    },
    {
      name: contract.lookupByTagTextCommand,
      signature: `${contract.lookupByTagTextCommand}(标记文本)`,
      description: `在当前窗口按区分大小写的非空文本标记查找${contract.lingCppType}，找不到时返回无效引用。`,
      insertText: `${contract.lookupByTagTextCommand}("$1")`,
      returnType: contract.lingCppType
    },
    {
      name: contract.lookupByTagIntegerCommand,
      signature: `${contract.lookupByTagIntegerCommand}(标记整数)`,
      description: `在当前窗口按有符号 32 位整数标记查找${contract.lingCppType}，找不到时返回无效引用。`,
      insertText: `${contract.lookupByTagIntegerCommand}($1)`,
      returnType: contract.lingCppType
    }
  ]);
}

function createRuntimeControlEventCommandContributions(moduleId: Win32ControlModuleId) {
  return getWin32ControlsForModule(moduleId).flatMap(definition => {
    const contract = getWin32RuntimeControlContract(definition);
    if (!contract) return [];
    return definition.events.flatMap(event => {
      const bindCommand = `${contract.lingCppType}_绑定${event.label}`;
      const unbindCommand = `${contract.lingCppType}_解绑${event.label}`;
      return [{
        name: bindCommand,
        signature: `${bindCommand}(控件, 处理器)`,
        description: `为${contract.lingCppType}实例绑定“${event.label}”处理器，处理器必须使用 &名称。`,
        insertText: `${bindCommand}($1, &$2)`,
        returnType: '逻辑型'
      }, {
        name: unbindCommand,
        signature: `${unbindCommand}(控件)`,
        description: `移除${contract.lingCppType}实例由代码绑定的“${event.label}”处理器。`,
        insertText: `${unbindCommand}($1)`,
        returnType: '逻辑型'
      }];
    });
  });
}

// 运行时控件的创建与标记查找命令由契约集中生成，参数语义按 lingCppWin32Project.ts 的 CreateRuntimeControl
// 与 HasDuplicateTag 实现核实，因此说明也在这里按 role 集中生成，避免逐控件重复手写。
const RUNTIME_CONTROL_ROLE_DESCRIPTIONS: Record<Win32RuntimeControlParameterRole, string> = {
  parent: '当前窗口、可视容器控件或选项卡页面容器。',
  x: '控件左上角在父容器客户区内的横坐标，使用与设计器一致的逻辑坐标，运行时按窗口 DPI 缩放。',
  y: '控件左上角在父容器客户区内的纵坐标，使用与设计器一致的逻辑坐标，运行时按窗口 DPI 缩放。',
  width: '控件宽度，逻辑坐标单位；必须大于 0，否则创建失败并输出中文日志。',
  height: '控件高度，逻辑坐标单位；必须大于 0，否则创建失败并输出中文日志。',
  content: '控件初始文本；空文本表示创建后不设置任何文字。',
  tagText: '可选的文本标记，创建时会去掉首尾空白；同一窗口内同类型控件的非空文本标记必须唯一，重复时创建失败。',
  tagInteger: '可选的整数标记，用于 通过标记整数获取 查找；0 也算已设置的标记，同一窗口内同类型控件的非空标记必须唯一。'
};

const RUNTIME_CONTROL_LOOKUP_DESCRIPTIONS: Record<string, string> = {
  标记文本: '创建控件时写入的文本标记，区分大小写；没有匹配的控件时返回无效引用。',
  标记整数: '创建控件时写入的整数标记；没有匹配的控件时返回无效引用。'
};

function createRuntimeControlBindings(moduleId: Win32ControlModuleId): ModuleCommandBinding[] {
  return getWin32RuntimeControlContracts(moduleId).flatMap(contract => {
    const parameters: ModuleCommandBindingParameter[] = contract.createParameters.map(parameter => parameter.role === 'parent'
      ? {
          name: parameter.name,
          type: 'controlRef',
          description: '当前窗口、可视容器控件或选项卡页面容器。',
          controlKinds: ['visual'],
          scope: 'currentWindow',
          runtimeRepresentation: 'nativeHandle'
        }
      : {
          name: parameter.name,
          type: parameter.type,
          description: RUNTIME_CONTROL_ROLE_DESCRIPTIONS[parameter.role],
          optional: parameter.optional,
          defaultValue: parameter.defaultValue
        });
    return [
      {
        command: contract.createCommand,
        runtimeName: contract.createCommand,
        parameters,
        returnType: contract.lingCppType,
        encoding: 'wide',
        example: `${contract.createCommand}(当前窗口, 20, 20, 120, 36, "${contract.lingCppType}", "", 1001)`
      },
      {
        command: contract.lookupByTagTextCommand,
        runtimeName: contract.lookupByTagTextCommand,
        parameters: [{ name: '标记文本', type: 'wideString', description: RUNTIME_CONTROL_LOOKUP_DESCRIPTIONS.标记文本 }],
        returnType: contract.lingCppType,
        encoding: 'wide'
      },
      {
        command: contract.lookupByTagIntegerCommand,
        runtimeName: contract.lookupByTagIntegerCommand,
        parameters: [{ name: '标记整数', type: 'int', description: RUNTIME_CONTROL_LOOKUP_DESCRIPTIONS.标记整数 }],
        returnType: contract.lingCppType
      }
    ];
  });
}

function createRuntimeControlEventBindings(moduleId: Win32ControlModuleId): ModuleCommandBinding[] {
  return getWin32ControlsForModule(moduleId).flatMap(definition => {
    const contract = getWin32RuntimeControlContract(definition);
    if (!contract) return [];
    return definition.events.flatMap(event => {
      const bindCommand = `${contract.lingCppType}_绑定${event.label}`;
      const unbindCommand = `${contract.lingCppType}_解绑${event.label}`;
      const controlParameter: ModuleCommandBindingParameter = {
        name: '控件',
        type: 'controlRef',
        controlTypes: [definition.type],
        controlKinds: ['visual'],
        scope: 'currentWindow',
        runtimeRepresentation: 'wideName'
      };
      return [{
        command: bindCommand,
        runtimeName: bindCommand,
        parameters: [controlParameter, {
          name: '处理器',
          type: 'handler',
          handlerSignature: { parameterTypes: [], returnType: '空' }
        }],
        returnType: 'bool'
      }, {
        command: unbindCommand,
        runtimeName: unbindCommand,
        parameters: [controlParameter],
        returnType: 'bool'
      }];
    });
  });
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
    const parameters = (binding.parameters || []).map(parameter => describeBuiltinParameter(binding.command, normalizeBuiltinControlParameter(manifest.id, binding.command, parameter)));
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

// CEF3 真无头（CEF 官方 windowless / OSR）中文命令面：18 条命令一律以「实例编号」为首参寻址，
// 不接收 controlRef、不创建任何窗口。清单（contributes.commands）、binding 与运行时包装三处必须成对，
// 本常量是这三处的共同名单来源，新增无头命令只改这里与下面两段表。
const CEF3_HEADLESS_COMMAND_NAMES = [
  'CEF3_创建无头浏览器', 'CEF3无头_是否已创建', 'CEF3无头_设置视口', 'CEF3无头_取视口JSON',
  'CEF3无头_取渲染帧数', 'CEF3无头_等待出帧', 'CEF3无头_导航', 'CEF3无头_是否加载中', 'CEF3无头_等待加载完成',
  'CEF3无头_取标题', 'CEF3无头_取地址', 'CEF3无头_取主框架', 'CEF3无头_取浏览器句柄',
  'CEF3无头_执行JS', 'CEF3无头_取页面文本', 'CEF3无头_取页面源码', 'CEF3无头_取事件JSON',
  'CEF3无头_关闭'
];

const BUILTIN_PARAM_DOCS: ParamDocTable = {
  内容: '对话框正文或要写入的文本内容。',
  标题: '对话框或窗口标题文本。',
  '窗口_设置自身标题::标题': '要写入当前窗口标题栏的完整文本；传空文本清空标题栏文字。',
  标志: '信息框类型值：按钮与图标组合，可相加（0 确定、1 确定/取消、4 是/否、16 错误图标、32 询问图标、48 警告图标、64 信息图标）。',
  值: '要写入或转换的值。',
  '到文本::值': '要转换成文本的任意值。',
  'CEF3_设置崩溃键值::值': '崩溃键对应的值文本。',
  格式模板: '格式模板文本；用 {} 占位并按顺序填充后续参数。',
  文本: '要写入或查找的文本内容。',
  图片路径: '图片文件路径。',
  启用: '真=开启，假=关闭。',
  可见: '真=显示，假=隐藏。',
  横坐标: 'X 坐标，相对浏览器或窗口客户区。',
  纵坐标: 'Y 坐标，相对浏览器或窗口客户区。',
  宽度: '宽度（像素）。',
  高度: '高度（像素）。',
  勾选: '真=勾选，假=取消勾选。',
  数值: '要设置的整数值。',
  索引: '项目下标，从 0 起。',
  筛选器: '文件类型筛选器文本，格式 "说明|*.扩展名|..."，如 "文本文件|*.txt|全部文件|*.*"。',
  默认颜色: '对话框初始选中的颜色值（0x00BBGGRR）。',
  颜色: '颜色值（0x00BBGGRR）。',
  默认字号: '字体对话框初始选中的字号。',
  默认文本: '查找对话框的初始文本。',
  查找内容: '要查找的文本。',
  替换内容: '要替换成的文本。',
  文档名: '打印任务显示的文档名称。',
  行索引: '行下标，从 0 起。',
  列索引: '列下标，从 0 起。',
  升序: '真=按该列升序排序，假=降序。',
  行数: '虚拟模式下的总行数。',
  选中: '真=选中该行。',
  起始行: '查找起始行下标；传 -1 表示从头查找。',
  部分匹配: '真=按前缀部分匹配，假=整行精确匹配。',
  部位: '矩形部位文本（"item" 整行或 "label" 标签）。',
  允许部分可见: '真=该行部分进入视口即算可见。',
  横向像素: '水平滚动像素量。',
  纵向像素: '垂直滚动像素量。',
  结束行: '重绘结束行下标（含）。',
  视图: '视图模式文本（"details"、"list"、"largeicon"、"smallicon"、"tile"）。',
  样式名: '扩展样式名称，取值见列表视图文档。',
  红: '红色分量 0~255。',
  绿: '绿色分量 0~255。',
  蓝: '蓝色分量 0~255。',
  组ID: '分组 ID（自定义整数，同组行归为一组）。',
  可编辑: '真=允许双击编辑标签。',
  在后方: '真=插入标记放在该行后方，假=放在行上。',
  水平: '水平图标间距（像素）。',
  垂直: '垂直图标间距（像素）。',
  排列: '图标排列方式名称，取值见列表视图文档。',
  类型: '图像列表类型文本（"normal"、"small"、"state"）。',
  毫秒: '时间数值（毫秒）。',
  图像索引: '图像列表中的图标下标，从 0 起。',
  数据: '要绑定到该行的自定义整数值。',
  父节点文字: '父节点显示文本。',
  节点文字: '新节点显示文本。',
  隐藏: '真=隐藏。',
  视频路径: '视频文件路径。',
  音量: '音量 0~100，越界值被钳制。',
  对齐: '列对齐文本："left"、"center" 或 "right"；其他值按左对齐。',
  'FBro_替换资源响应文件::文件路径': '替换用的本地文件路径；文件内容作为命中规则的响应整体返回。',
  路径: '截图保存路径。',
  格式: '图像格式 "png" 或 "jpeg"。',
  质量: 'JPEG 压缩质量 0~100；png 忽略。',
  父组件句柄: '承载 EdgeView 的父窗口或组件 HWND；传 0 嵌入当前窗口。',
  实例编号: 'EdgeView 实例的正整数编号；后续命令按它指定实例。',
  视口宽: 'OSR 无头浏览器的页面视口宽度（CSS 像素），必须是正整数，传 0 或负数直接创建/设置失败；它决定页面布局宽度与媒体查询结果，默认 1280。',
  视口高: 'OSR 无头浏览器的页面视口高度（CSS 像素），必须是正整数，传 0 或负数直接创建/设置失败；无头实例不产生窗口，该值只影响页面布局与渲染尺寸，默认 720。',
  // CEF3 无头（OSR）命令全部按实例编号寻址，而上面的全局「实例编号」是 EdgeView 口径，
  // 必须逐条按无头语义覆盖（同时把「不是控件名、不加引号」写进参数说明，堵住 controlRef 误用）。
  ...Object.fromEntries(CEF3_HEADLESS_COMMAND_NAMES.map(command => [`${command}::实例编号`,
    'CEF3 无头（OSR）浏览器实例的正整数编号，取自 CEF3_创建无头浏览器 的首参；它是运行期编号而不是设计器控件名，写裸数字不加引号，实例不存在时命令一律返回失败值并给中文诊断。'])),
  // 无头命令的阻塞等待一律显式带超时（CEF 侧没有任务等待导出，只能轮询），口径逐条写清超时后返回什么。
  'CEF3无头_等待加载完成::超时毫秒': '最长等待毫秒数；传 0 或负数按默认 30000，超时返回 0 并给中文诊断，绝不无限等待。',
  'CEF3无头_等待出帧::超时毫秒': '最长等待毫秒数；传 0 或负数按默认 10000，超时返回 0 并给含当前帧数的中文诊断，绝不无限等待。',
  'CEF3无头_取页面文本::超时毫秒': '最长等待毫秒数；传 0 或负数按默认 30000，超时返回空文本并给中文诊断。',
  'CEF3无头_取页面源码::超时毫秒': '最长等待毫秒数；传 0 或负数按默认 30000，超时返回空文本并给中文诊断。',
  // CEF3 全局代理（与 EdgeView 同口径补齐）；带认证代理不被 CEF 150 支持，红线写在命令描述。
  'CEF3_设置全局代理::代理地址': '全局代理地址，格式 "scheme://host:port"（如 "http://127.0.0.1:7890"、"socks5://127.0.0.1:1080"）；空文本清除。只影响之后新建实例；不得把用户名密码拼进地址，带认证的代理改用 FBro/EdgeView。',
  'CEF3_取实例代理::实例编号': 'CEF3 设计器无关实例的正整数编号（创建弹窗浏览器 / 创建区域 / 创建无头浏览器 的首参），写裸数字不加引号；返回实例自带代理，为空时显示全局代理回落值。',
  实例句柄: 'FBro_后台创建 返回的后台浏览器实例句柄（长整数）；实例关闭或进程退出后失效。',
  地址: '完整 URL 或本地文件路径。',
  独立缓存目录: '实例专用缓存目录（相对工作目录或绝对路径）；相同目录共享会话数据。',
  代理地址: '代理地址，如 "http://127.0.0.1:7890" 或 "socks5://127.0.0.1:1080"。',
  事件名: '中文事件名，如 "导航完成"，取值见事件清单。',
  协议事件名: 'Chromium DevTools Protocol 事件名，如 "Console.messageAdded"。',
  超时毫秒: '最长等待毫秒数，超时返回 0。',
  等待毫秒: '本次泵送的等待毫秒数；0=只清空当前消息队列不等待，返回处理掉的消息数。',
  脚本: 'JavaScript 源码文本。',
  左: '左边界 X 坐标（像素或 DIP，视命令而定）。',
  顶: '顶边界 Y 坐标（像素或 DIP，视命令而定）。',
  宽: '宽度（像素或 DIP，视命令而定）。',
  高: '高度（像素或 DIP，视命令而定）。',
  // EdgeView 几何命令运行时统一按逻辑坐标（DIP）接收并按窗口 DPI 缩放（与 win32.basic 控件口径一致），显式声明口径避免「像素或 DIP」歧义。
  ...Object.fromEntries(['EdgeView_创建弹窗浏览器', 'EdgeView_创建弹窗浏览器代理', 'EdgeView_创建弹窗浏览器初始隐藏', 'EdgeView_创建弹窗浏览器初始隐藏代理', 'EdgeView_创建区域', 'EdgeView_创建区域代理', 'EdgeView_置实例大小'].flatMap(command => Object.entries({
    左: '左边界 X 坐标（逻辑坐标/DIP，运行时按窗口 DPI 缩放）。',
    顶: '顶边界 Y 坐标（逻辑坐标/DIP，运行时按窗口 DPI 缩放）。',
    宽: '宽度（逻辑坐标/DIP，运行时按窗口 DPI 缩放）。',
    高: '高度（逻辑坐标/DIP，运行时按窗口 DPI 缩放）。'
  }).map(([name, description]) => [`${command}::${name}`, description]))),
  键: '崩溃报告键名。',
  'CEF3_取命令资源ID::名称': '命令资源名，如 "IDC_BACK"。',
  相对路径: '资源相对路径（相对生成的资源目录）。',
  目录: '缓存目录路径。',
  字段名: '当前事件 JSON 的字段名，取值见事件说明。',
  最大字节数: '允许捕获的正文最大字节数，超出部分截断。',
  结果: '同步事件结果：0 默认、1 允许/继续、2 拒绝/取消、3 已处理。',
  级别: 'CEF 缩放级别（对数刻度，0 表示 100%，每 ±1 约增减 20%）。',
  缩放命令: '缩放命令：0 缩小、1 重置、2 放大。',
  保留选择: '真=完成输入法组合时保留当前选区。',
  单词: '要加入词典或替换的单词。',
  是否隐藏: '真=通知浏览器控件已被隐藏。',
  是否调整大小: '真=退出全屏时同步调整控件大小。',
  向前: '真=按正方向查找下一处。',
  区分大小写: '真=区分大小写。',
  查找下一个: '真=从当前位置查找下一个匹配，假=从头查找。',
  清除选择: '真=停止查找时清除当前选区。',
  是否聚焦: '真=把焦点移入浏览器。',
  X: '相对浏览器客户区的 X 坐标。',
  Y: '相对浏览器客户区的 Y 坐标。',
  修饰键: 'CEF 事件标志位掩码（EVENTFLAG_* 组合），0 表示无修饰键。',
  按钮类型: '鼠标按钮：0 左键、1 中键、2 右键。',
  是否抬起: '真=发送抬起事件，假=按下事件。',
  单击次数: '连击次数：1 单击、2 双击，依此类推。',
  是否离开: '真=鼠标离开事件。',
  横向增量: '滚轮横向滚动增量。',
  纵向增量: '滚轮纵向滚动增量。',
  触点ID: '触点编号，多指触控时用于区分触点。',
  半径X: '触点 X 方向半径。',
  半径Y: '触点 Y 方向半径。',
  旋转角度: '触点旋转角度（弧度）。',
  压力: '触点压力 0.0~1.0。',
  指针类型: '指针类型：0 触摸、1 鼠标、2 笔、3 橡皮擦、4 未知。',
  Windows键码: 'Windows 虚拟键码（VK_*），如 65=A。',
  原生键码: '平台原生键码/扫描码。',
  是否系统键: '真=系统键事件（如 Alt 组合）。',
  字符编码: '字符的 UTF-16 代码单元。',
  未修改字符编码: '未经修饰键修改的字符 UTF-16 代码单元。',
  焦点在可编辑字段: '真=当前焦点位于可编辑字段。',
  是否静音: '真=静音。',
  最小高度: '自动调整的最小高度（像素）。',
  最小宽度: '自动调整的最小宽度（像素）。',
  最大高度: '自动调整的最大高度（像素）。',
  最大宽度: '自动调整的最大宽度（像素）。',
  UserAgent: '要设置的 User-Agent 字符串。',
  JSON: '完整指纹配置 JSON 文本。',
  缓存目录: '实例专用缓存目录路径。',
  附加信息JSON: '实例附加信息 JSON 文本。',
  查询函数名: '页面发起 cefQuery 查询使用的全局函数名。',
  取消函数名: '页面取消查询使用的全局函数名。',
  工作区键: '浏览器管理器的工作区标识键，用于实例列表持久化。',
  名称: '实例显示名称。',
  清除数据: '真=同时清除实例的缓存数据。',
  包含Cookie: '真=清理时同时删除 Cookie。',
  文件: '导出或导入 Cookie 的文件路径。',
  全部网站: '真=导出全部网站的 Cookie。',
  覆盖冲突: '真=导入时覆盖同名 Cookie。',
  'FBro_替换资源响应内容::地址': 'URL 匹配规则；命中规则的响应会被整体替换。',
  'FBro_替换资源响应文件::地址': 'URL 匹配规则；命中规则的响应会被文件内容整体替换。',
  'FBro_清除资源响应替换::地址': '要清除替换规则的 URL 匹配规则。',
  'FBro_替换资源响应内容::内容': '替换后的响应内容文本。',
  事件类型: '触摸事件类型：0 松开、1 按下、2 移动、3 取消。',
  'FBro_发送按键事件::事件类型': '按键事件类型：0 原始按下、1 按下、2 松开、3 字符。',
  选中键JSON: '列表选择动作携带的选中键 JSON 文本。',
  稳定ID: '实例的稳定 ID 文本，唯一标识一个外壳实例。',
  新名称: '实例的新显示名称。',
  工作台键: '工作台标识键，用于外壳实例列表持久化恢复。',
  事件JSON: '实例列表 UI 动作事件 JSON 文本。',
  Cookie文本: '要写入的 Cookie 文本，格式与导出文件一致。',
  默认地址: 'Cookie 对话框默认显示的地址。',
  包含过期: '真=导入时包含已过期的 Cookie。',
  新索引: '标签页新位置下标，从 0 起。',
  代理: '实例代理地址，空文本表示直连。',
  指纹JSON: '指纹配置 JSON 文本。',
  窗口标题: '独立顶层弹窗窗口的标题栏文本，便于人工识别店铺。',
  用户代理: '要使用的 User-Agent 字符串；需在首次导航前生效，建议建弹窗时直接传入。',
  Cookie列表JSON: 'Cookie JSON 数组文本，每项为含 name/value/domain/path 的对象，可选 expires（UTC 秒）、secure、httpOnly、sameSite（0 None、1 Lax、2 Strict）；None 必须同时 secure=true。',
  域: 'Cookie 生效域名，如 mms.example.com；Cookie 管理器要求非空。',
  过期时间: 'Cookie 过期时间（UTC 秒数）；会话 Cookie 传 -1，早于当前时间的过期值会被 WebView2 拒绝写入。',
  安全: '真=Secure Cookie（仅 HTTPS 发送），传 1/0。',
  仅HTTP: '真=HttpOnly Cookie（禁止 document.cookie 读写），传 1/0。',
  同源策略: 'Cookie SameSite 级别：0 None、1 Lax、2 Strict。'
};

function describeBuiltinParameter(command: string, parameter: ModuleCommandBindingParameter): ModuleCommandBindingParameter {
  if ((parameter.description || '').trim()) return parameter;
  const description = BUILTIN_PARAM_DOCS[`${command}::${parameter.name}`] || BUILTIN_PARAM_DOCS[parameter.name];
  return description ? { ...parameter, description } : parameter;
}

/**
 * 说明必填门禁：任何内置模块存在缺说明参数时在加载期直接抛错，
 * 新增或修改命令必须同步补 BUILTIN_PARAM_DOCS 或各 catalog 集中表。
 */
function assertBuiltinParameterDescriptions(manifest: LingBuilderModuleManifest): LingBuilderModuleManifest {
  const missing: string[] = [];
  for (const command of manifest.bindings?.commands ?? []) {
    for (const parameter of command.parameters ?? []) {
      if (!(parameter.description || '').trim()) missing.push(`${command.command} :: ${parameter.name}`);
    }
  }
  if (missing.length) throw new Error(`内置模块参数缺少中文说明：${manifest.id} :: ${missing.join(', ')}`);
  return manifest;
}

function normalizeBuiltinControlParameter(
  moduleId: string,
  command: string,
  parameter: ModuleCommandBindingParameter
): ModuleCommandBindingParameter {
  const converted = normalizeHandlerParameter(parameter);
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
  // FBro 模块族（browser/events 等）命令的控件名参数同时接受可视 FBroBrowser 控件与「FBro无头浏览器」设计器资源。
  // fbroModules 的 api() 会预置 controlTypes ['FBroBrowser'] 与缺省 kinds ['visual']，此处按「仅可视 FBroBrowser」识别并扩类。
  const fbroVisualOnlyKinds = !parameter.controlKinds?.length
    || (parameter.controlKinds.length === 1 && parameter.controlKinds[0] === 'visual');
  const fbroBrowserOnlyTypes = !parameter.controlTypes?.length
    || (parameter.controlTypes.length === 1 && parameter.controlTypes[0] === 'FBroBrowser');
  if (moduleId.startsWith('lingbuilder.fbro') && fbroVisualOnlyKinds && fbroBrowserOnlyTypes) {
    return normalizeControlReferenceParameter({
      ...converted,
      controlTypes: ['FBroBrowser', 'FBroHeadlessBrowser'],
      controlKinds: ['visual', 'resource'],
      // 旧的「仅可视控件」描述必须清空重生成，避免与实际 kinds 契约不一致。
      description: undefined
    });
  }
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
  ARIA2_MODULE,
  PROTOBUF_MODULE,
  ...SYSTEM_LIBRARY_MODULES,
  ...NETWORK_LIBRARY_MODULES,
  ...DATA_MEDIA_MODULES,
  OPENCV_MODULE,
  EMBEDDED_RESOURCE_MODULE,
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
        { name: '控件_设置位置大小', signature: '控件_设置位置大小(控件名, 横坐标, 纵坐标, 宽度, 高度)', description: '按逻辑坐标（与设计器坐标一致，自动按窗口 DPI 缩放）移动指定控件并调整大小，适合在创建完毕或窗口大小事件中实现自适应布局。', insertText: '控件_设置位置大小($1, $2, $3, $4, $5)', returnType: '逻辑型' },
        { name: '控件_设置勾选', signature: '控件_设置勾选(控件名, 勾选)', description: '设置复选框、单选框或切换按钮状态。', insertText: '控件_设置勾选($1, 真)', returnType: '逻辑型' },
        { name: '控件_取勾选', signature: '控件_取勾选(控件名)', description: '读取控件勾选状态。', insertText: '控件_取勾选($1)', returnType: '逻辑型' },
        { name: '控件_设置数值', signature: '控件_设置数值(控件名, 数值)', description: '设置进度条、滑块、调节器或滚动条数值。', insertText: '控件_设置数值($1, 50)', returnType: '逻辑型' },
        { name: '控件_取数值', signature: '控件_取数值(控件名)', description: '读取数值型控件当前值。', insertText: '控件_取数值($1)', returnType: '整数型' },
        { name: '控件_设置选择项', signature: '控件_设置选择项(控件名, 索引)', description: '设置列表、组合框、列表视图或选项卡选择项。', insertText: '控件_设置选择项($1, 0)', returnType: '逻辑型' },
        { name: '控件_取选择项', signature: '控件_取选择项(控件名)', description: '读取选择项索引。', insertText: '控件_取选择项($1)', returnType: '整数型' },
        { name: '控件_添加项目', signature: '控件_添加项目(控件名, 文本)', description: '向列表框、组合框或增强组合框追加项目。', insertText: '控件_添加项目($1, "$2")', returnType: '整数型' },
        { name: '控件_清空项目', signature: '控件_清空项目(控件名)', description: '清空集合控件项目。', insertText: '控件_清空项目($1)', returnType: '逻辑型' },
        { name: '控件_是否有效', signature: '控件_是否有效(控件)', description: '判断类型化控件引用是否仍指向当前窗口内存活的控件。', insertText: '控件_是否有效($1)', returnType: '逻辑型' },
        ...createRuntimeControlCommandContributions('lingbuilder.win32.basic'),
        ...createRuntimeControlEventCommandContributions('lingbuilder.win32.basic'),
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
        { name: '窗口_取拖入文件', signature: '窗口_取拖入文件(索引)', description: '按从 0 开始的索引返回最近拖入的 Unicode 路径，越界返回空文本。', insertText: '窗口_取拖入文件(0)', returnType: '文本型' },
        { name: '窗口_取自身句柄', signature: '窗口_取自身句柄()', description: '返回当前窗口自己的 HWND（长整数），窗口尚未创建时返回 0；用于给 窗口_设置标题、窗口_移动 等以 HWND 为首参的窗口操作命令提供句柄，纯 Win32 项目取自身句柄只有这一条入口。', insertText: '窗口_取自身句柄()', returnType: '长整数型' },
        { name: '窗口_取自身标题', signature: '窗口_取自身标题()', description: '返回当前窗口标题栏文本，窗口尚未创建时返回空文本。', insertText: '窗口_取自身标题()', returnType: '文本型' },
        { name: '窗口_设置自身标题', signature: '窗口_设置自身标题(标题)', description: '直接修改当前窗口标题栏文本，无需先取句柄；传空文本清空标题，成功返回真。', insertText: '窗口_设置自身标题("$1")', returnType: '逻辑型' }
      ],
      types: [
        { name: '窗口', description: 'Win32 窗口基类。', cppType: 'LingWindowBase' },
        ...createControlTypes('lingbuilder.win32.basic')
      ],
      designerControls: createControlContributions('lingbuilder.win32.basic'),
      docs: [{ title: 'Win32 基础控件运行时创建', path: 'docs/modules/win32-basic/README.md' }]
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
        { command: '格式化文本', runtimeName: '格式化文本', parameters: [{ name: '格式模板', type: 'wideString' }, { name: '参数', type: 'lingValue', variadic: true, description: '可继续传入任意数量的文本、整数、小数或逻辑值。' }], returnType: 'wideString', encoding: 'wide', example: '格式化文本("姓名：{}，年龄：{}", "小林", 18)' },
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
        { command: '控件_是否有效', runtimeName: '控件_是否有效', parameters: [{ name: '控件', type: 'controlRef' }], returnType: 'bool' },
        ...createRuntimeControlBindings('lingbuilder.win32.basic'),
        ...createRuntimeControlEventBindings('lingbuilder.win32.basic'),
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
        { command: '窗口_取拖入文件', runtimeName: '窗口_取拖入文件', parameters: [{ name: '索引', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
        { command: '窗口_取自身句柄', runtimeName: '窗口_取自身句柄', parameters: [], returnType: 'longLong' },
        { command: '窗口_取自身标题', runtimeName: '窗口_取自身标题', parameters: [], returnType: 'wideString', encoding: 'wide' },
        { command: '窗口_设置自身标题', runtimeName: '窗口_设置自身标题', parameters: [{ name: '标题', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
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
        ...createRuntimeControlCommandContributions('lingbuilder.win32.common-controls'),
        ...createRuntimeControlEventCommandContributions('lingbuilder.win32.common-controls'),
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
        ,{ name: '打印机_取列表', signature: '打印机_取列表(结果数组)', description: '把本机可用的打印机名称写入文本型数组，返回打印机数量。', insertText: '打印机_取列表($1)', returnType: '整数型' }
        ,{ name: '打印机_取默认', signature: '打印机_取默认()', description: '返回当前默认打印机的名称；读取失败返回空文本。', insertText: '打印机_取默认()', returnType: '文本型' }
        ,{ name: '打印机_置默认', signature: '打印机_置默认(名称)', description: '把指定名称的打印机设为系统默认；名称不存在或无权限返回假。', insertText: '打印机_置默认("$1")', returnType: '逻辑型' }
        ,{ name: '打印机_是否在线', signature: '打印机_是否在线(名称)', description: '判断指定打印机当前是否可用（非脱机状态）；名称不存在返回假。', insertText: '打印机_是否在线("$1")', returnType: '逻辑型' }
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
      docs: [{ title: 'Win32 高级控件运行时创建', path: 'docs/modules/win32-common-controls/README.md' }],
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
        ...createRuntimeControlBindings('lingbuilder.win32.common-controls'),
        ...createRuntimeControlEventBindings('lingbuilder.win32.common-controls'),
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
        ,{ command: '打印机_取列表', runtimeName: '打印机_取列表', parameters: [{ name: '结果数组', type: 'array', description: '接收打印机名称的文本型数组变量，调用前会先清空原有内容。' }], returnType: 'int' }
        ,{ command: '打印机_取默认', runtimeName: '打印机_取默认', parameters: [], returnType: 'wideString', encoding: 'wide' }
        ,{ command: '打印机_置默认', runtimeName: '打印机_置默认', parameters: [{ name: '名称', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '打印机_是否在线', runtimeName: '打印机_是否在线', parameters: [{ name: '名称', type: 'wideString' }], returnType: 'bool', encoding: 'wide' }
        ,{ command: '属性页_显示', runtimeName: '属性页_显示', parameters: [{ name: '属性页', type: 'controlRef', controlTypes: ['PropertySheet'], controlKinds: ['resource'], scope: 'project' }], returnType: 'int', encoding: 'wide' }
        ,{ command: '列表视图_创建行', runtimeName: '列表视图_创建行', parameters: [{ name: '单元格', type: 'lingValue', variadic: true, description: '可继续传入任意数量的文本、整数、小数或逻辑值。' }], returnType: 'raw', encoding: 'wide' }
        ,{ command: '列表视图_创建行集合', runtimeName: '列表视图_创建行集合', parameters: [{ name: '行', type: 'lingValue', variadic: true, description: '可继续传入任意数量的列表视图行。' }], returnType: 'raw' }
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
    version: '1.5.1',
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
        { name: 'EdgeView_绑定事件', signature: 'EdgeView_绑定事件(实例编号, 事件名, &处理器名)', description: `绑定 WebView2 完整事件清单中的中文事件；当前清单共 ${EDGEVIEW_BROWSER_EVENT_NAMES.length} 项。旧字符串处理器仍兼容，但会产生迁移警告。`, insertText: 'EdgeView_绑定事件(1, "导航完成", &$1)', returnType: '整数型' },
        { name: 'EdgeView_监听开发者工具事件', signature: 'EdgeView_监听开发者工具事件(实例编号, 协议事件名)', description: '监听指定 Chromium DevTools Protocol 事件，触发“开发者工具协议事件”。', insertText: 'EdgeView_监听开发者工具事件(1, "Console.messageAdded")', returnType: '整数型' },
        { name: 'EdgeView_等待事件', signature: 'EdgeView_等待事件(实例编号, 事件名, 超时毫秒)', description: '泵送窗口消息并等待指定浏览器事件，成功返回 1，超时返回 0。', insertText: 'EdgeView_等待事件(1, "导航完成", 15000)', returnType: '整数型' },
        { name: 'EdgeView_等待事件控件', signature: 'EdgeView_等待事件控件(控件名, 事件名, 超时毫秒)', description: '在设计器 Edge 浏览器控件上泵送消息并等待指定中文事件，成功返回 1，超时或控件不存在返回 0。用于在“创建完毕”里等页面就绪后再调用同步命令；不能在其它浏览器事件处理器内调用，否则同样会等满超时。', insertText: 'EdgeView_等待事件控件($1, "导航完成", 5000)', returnType: '整数型' },
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
        ,{ name: 'EdgeView_绑定控件事件', signature: 'EdgeView_绑定控件事件(控件名, 事件名, &处理器名)', description: `按控件名绑定 WebView2 完整事件清单中的中文事件；当前清单共 ${EDGEVIEW_BROWSER_EVENT_NAMES.length} 项。旧字符串处理器仍兼容，但会产生迁移警告。`, insertText: 'EdgeView_绑定控件事件($1, "导航完成", &$2)', returnType: '整数型' }
        ,{ name: 'EdgeView_监听开发者工具事件控件', signature: 'EdgeView_监听开发者工具事件控件(控件名, 协议事件名)', description: '按设计器控件名监听 Chromium DevTools Protocol 事件。', insertText: 'EdgeView_监听开发者工具事件控件($1, "Console.messageAdded")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建弹窗浏览器', signature: 'EdgeView_创建弹窗浏览器(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)', description: '创建独立顶层浏览器弹窗（任务栏可见、可独立拖动缩放、页面随窗口自适应），用指定独立缓存目录实现店铺间 Cookie/存储隔离，并在首次导航前应用 User-Agent。实例编号供 导航实例/关闭实例/绑定事件/等待事件/执行JS实例/会话命令 复用；关闭主窗口会连带关闭全部弹窗。代理沿用 EdgeView_设置全局代理；要每个弹窗各走独立代理 IP 请用 EdgeView_创建弹窗浏览器代理。成功返回 1。', insertText: 'EdgeView_创建弹窗浏览器(1, "浏览器", 1000, 720, "https://example.com", ".edgeview/cache-1", "")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建弹窗浏览器代理', signature: 'EdgeView_创建弹窗浏览器代理(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理, 代理地址)', description: '创建带独立代理的顶层浏览器弹窗：代理地址非空时该弹窗用专属 HTTP/HTTPS/SOCKS5 代理（配合不同独立缓存目录=独立浏览器进程，实现每店铺独立出口 IP）；代理地址为空时回落到 EdgeView_设置全局代理，与创建实例/创建实例代理同一语义。', insertText: 'EdgeView_创建弹窗浏览器代理(1, "浏览器", 1000, 720, "https://example.com", ".edgeview/cache-1", "", "http://127.0.0.1:7890")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建弹窗浏览器初始隐藏', signature: 'EdgeView_创建弹窗浏览器初始隐藏(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)', description: '与 EdgeView_创建弹窗浏览器 相同，但宿主窗口创建时不显示（消除首帧闪窗），需要人工可见时用 EdgeView_置实例可见(实例编号, 真) 唤出；适合先建后按需展示的多开场景。', insertText: 'EdgeView_创建弹窗浏览器初始隐藏(1, "浏览器", 1000, 720, "https://example.com", ".edgeview/cache-1", "")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建弹窗浏览器初始隐藏代理', signature: 'EdgeView_创建弹窗浏览器初始隐藏代理(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理, 代理地址)', description: '带独立代理的初始隐藏弹窗：代理语义与 EdgeView_创建弹窗浏览器代理 相同（空值回落全局代理），窗口创建时不显示，置实例可见 可唤出。', insertText: 'EdgeView_创建弹窗浏览器初始隐藏代理(1, "浏览器", 1000, 720, "https://example.com", ".edgeview/cache-1", "", "http://127.0.0.1:7890")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建无头实例', signature: 'EdgeView_创建无头实例(实例编号, 地址, 独立缓存目录)', description: '创建无界面 EdgeView 浏览器：内部挂一个从不调用 ShowWindow 的离屏隐藏宿主（WebView2 官方无头 API 不存在，控制器必须挂窗口，这是平台允许的最接近无头形态），任务栏与界面完全不可见。导航实例/执行JS实例/等待事件/绑定事件/会话 Cookie 族/UA/独立代理等全部实例编号命令照常可用；控制台项目可用（创建与等待自带消息泵）。rAF/IntersectionObserver 等可见性相关行为按隐藏页节流；截图类命令在无头实例上不可用，需要页面图像请改用 CDP_启动浏览器（真无头独立进程）。返回 1 成功。', insertText: 'EdgeView_创建无头实例(1, "https://example.com", ".edgeview/headless-1")', returnType: '整数型' }
        ,{ name: 'EdgeView_创建无头实例代理', signature: 'EdgeView_创建无头实例代理(实例编号, 地址, 独立缓存目录, 用户代理, 代理地址)', description: '创建带独立用户代理与独立代理的无头 EdgeView 实例：代理地址非空走专属代理（空值回落 EdgeView_设置全局代理）；用户代理需传非空且等效真实 UA。适合后台多账号抓取/自动化，界面零显示。', insertText: 'EdgeView_创建无头实例代理(1, "https://example.com", ".edgeview/headless-1", "Mozilla/5.0", "http://127.0.0.1:7890")', returnType: '整数型' }
        ,{ name: 'EdgeView_泵消息', signature: 'EdgeView_泵消息(等待毫秒)', description: '泵送当前线程消息队列指定毫秒（0=只清队列不等待），返回处理掉的消息数；用于控制台/无头场景驱动 WebView2 回调、线程完成处理器与 CDP/HTTP/WS 派发消息（等待事件、创建无头实例内部已自带泵，通常只需在等待多个异步结果时循环调用）。遇 WM_QUIT 立即返回。', insertText: 'EdgeView_泵消息(1000)', returnType: '整数型' }
        ,{ name: 'EdgeView_关闭全部实例', signature: 'EdgeView_关闭全部实例()', description: '关闭当前全部 EdgeView 实例（弹窗、区域、控件实例一并释放）并返回关闭数量。', insertText: 'EdgeView_关闭全部实例()', returnType: '整数型' }
        ,{ name: 'EdgeView_枚举实例JSON', signature: 'EdgeView_枚举实例JSON()', description: '返回当前全部 EdgeView 实例的 JSON 数组，每项含 实例编号/窗口标题/地址/缓存目录/代理/是否弹窗/是否无头/是否有效，供调用方自省与列表展示。', insertText: 'EdgeView_枚举实例JSON()', returnType: '文本型' }
        ,{ name: 'EdgeView_置实例可见', signature: 'EdgeView_置实例可见(实例编号, 可见)', description: '按实例编号显示或隐藏：弹窗实例连带顶层窗口显隐，区域/控件实例调整控制器可见性。', insertText: 'EdgeView_置实例可见(1, 1)', returnType: '整数型' }
        ,{ name: 'EdgeView_置实例大小', signature: 'EdgeView_置实例大小(实例编号, 宽, 高)', description: '按实例编号设置浏览器尺寸；弹窗实例调整顶层窗口客户区并自适应，区域/控件实例设置控制器边界。', insertText: 'EdgeView_置实例大小(1, 1200, 800)', returnType: '整数型' }
        ,{ name: 'EdgeView_取实例大小JSON', signature: 'EdgeView_取实例大小JSON(实例编号)', description: '按实例编号返回当前客户区尺寸 JSON：{"宽":..,"高":..}。', insertText: 'EdgeView_取实例大小JSON(1)', returnType: '文本型' }
        ,{ name: 'EdgeView_置实例标题', signature: 'EdgeView_置实例标题(实例编号, 标题)', description: '按实例编号设置弹窗顶层窗口标题，便于人工识别店铺。', insertText: 'EdgeView_置实例标题(1, "店铺B")', returnType: '整数型' }
        ,{ name: 'EdgeView设置_置用户代理实例', signature: 'EdgeView设置_置用户代理实例(实例编号, 用户代理)', description: '按实例编号设置 User-Agent；建议用 EdgeView_创建弹窗浏览器 的 用户代理 参数在首次导航前设定，运行时再改首个请求已带旧 UA。', insertText: 'EdgeView设置_置用户代理实例(1, "Mozilla/5.0")', returnType: '整数型' }
        ,{ name: 'EdgeView设置_取用户代理实例', signature: 'EdgeView设置_取用户代理实例(实例编号)', description: '按实例编号读取当前 User-Agent。', insertText: 'EdgeView设置_取用户代理实例(1)', returnType: '文本型' }
        ,{ name: 'EdgeView会话_批量置Cookie实例', signature: 'EdgeView会话_批量置Cookie实例(实例编号, Cookie列表JSON)', description: '按实例编号批量注入 Cookie，返回成功条数。Cookie列表JSON 为含 name/value/domain/path 的数组，可带 expires（UTC 秒，会话 Cookie 用 -1 或省略）、secure、httpOnly、sameSite（0 None/1 Lax/2 Strict，None 必须同时 secure）。这是注入 HttpOnly Cookie 的正确方式，禁止用 JavaScript document.cookie。', insertText: 'EdgeView会话_批量置Cookie实例(1, "[]")', returnType: '整数型' }
        ,{ name: 'EdgeView会话_置Cookie带属性实例', signature: 'EdgeView会话_置Cookie带属性实例(实例编号, 名称, 值, 域, 路径, 过期时间, 安全, 仅HTTP, 同源策略)', description: '按实例编号创建或更新带完整属性的 Cookie；过期时间为 UTC 秒（会话 Cookie 传 -1），安全/仅HTTP 传 1/0，同源策略 0 None/1 Lax/2 Strict。', insertText: 'EdgeView会话_置Cookie带属性实例(1, "PASS_ID", "值", "example.com", "/", -1, 1, 1, 1)', returnType: '整数型' }
        ,{ name: 'EdgeView会话_删除全部Cookie实例', signature: 'EdgeView会话_删除全部Cookie实例(实例编号)', description: '按实例编号删除该实例 Profile 的全部 Cookie。', insertText: 'EdgeView会话_删除全部Cookie实例(1)', returnType: '整数型' }
        ,{ name: 'EdgeView会话_取Cookie实例异步', signature: 'EdgeView会话_取Cookie实例异步(实例编号, 地址, &完成处理器)', description: '按实例编号异步读取指定地址的 Cookie 列表 JSON，完成后在 完成处理器 里用 EdgeView任务_取结果 取值，可校验 httpOnly 标志是否回读成功。', insertText: 'EdgeView会话_取Cookie实例异步(1, "https://example.com", &$1)', returnType: '长整数型' }
        ,{ name: 'EdgeView会话_清理全部浏览数据实例异步', signature: 'EdgeView会话_清理全部浏览数据实例异步(实例编号, &完成处理器)', description: '按实例编号异步清理该实例 Profile 的全部浏览数据。', insertText: 'EdgeView会话_清理全部浏览数据实例异步(1, &$1)', returnType: '长整数型' }
      ],
      types: [{ name: 'EdgeView浏览器', description: '嵌入 Win32 HWND 的 Microsoft Edge WebView2 浏览器。', cppType: 'ICoreWebView2*' }],
      snippets: [{ label: 'EdgeView 嵌入与 JS 返回值', insertText: 'EdgeView_创建(0, "https://example.com")\n调试输出(EdgeView_执行JS("document.title"))\n调试输出(EdgeView_取最近事件())\n调试输出(EdgeView_取事件数据())', description: '在当前窗口嵌入 EdgeView，并读取网页标题与最近浏览器事件。' }, { label: 'EdgeView 动态内嵌多店铺区域', insertText: 'EdgeView_创建区域(1, 10, 60, 600, 500, "https://www.example.com", ".edgeview/store-a")\nEdgeView_创建区域(2, 630, 60, 600, 500, "https://www.example.com", ".edgeview/store-b")\n调试输出(EdgeView_枚举实例JSON())\nEdgeView_关闭全部实例()', description: '在窗口客户区两个矩形各内嵌一个独立 EdgeView 实例（各自独立缓存目录=独立浏览器进程），EdgeView_枚举实例JSON 枚举、EdgeView_关闭全部实例 回收；每店铺独立出口 IP 用 EdgeView_创建区域代理。' }],
      docs: [
        { title: 'EdgeView 事件参考', path: 'docs/modules/edgeview/README.md' },
        { title: 'EdgeView 完整 API 参考（289 条）', path: 'docs/modules/edgeview/API.md' }
      ]
    },
    targets: [
      { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/WebView2.h', 'include/WebView2EnvironmentOptions.h'], libs: ['ole32.lib', 'lib/x86/WebView2LoaderStatic.lib'], defines: ['LINGBUILDER_EDGEVIEW_MODULE'] },
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/WebView2.h', 'include/WebView2EnvironmentOptions.h'], libs: ['ole32.lib', 'lib/x64/WebView2LoaderStatic.lib'], defines: ['LINGBUILDER_EDGEVIEW_MODULE'] }
    ],
    bindings: { commands: [
      ...EDGEVIEW_SAFE_API_BINDINGS,
      { command: 'EdgeView_创建', runtimeName: 'EdgeView_创建', parameters: [{ name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建实例', runtimeName: 'EdgeView_创建实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建实例代理', runtimeName: 'EdgeView_创建实例代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '父组件句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建区域', runtimeName: 'EdgeView_创建区域', parameters: [{ name: '实例编号', type: 'int' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建区域代理', runtimeName: 'EdgeView_创建区域代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建弹窗浏览器初始隐藏', runtimeName: 'EdgeView_创建弹窗浏览器初始隐藏', parameters: [{ name: '实例编号', type: 'int' }, { name: '窗口标题', type: 'wideString' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '用户代理', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建弹窗浏览器初始隐藏代理', runtimeName: 'EdgeView_创建弹窗浏览器初始隐藏代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '窗口标题', type: 'wideString' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '用户代理', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建无头实例', runtimeName: 'EdgeView_创建无头实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_创建无头实例代理', runtimeName: 'EdgeView_创建无头实例代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '用户代理', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_泵消息', runtimeName: 'EdgeView_泵消息', parameters: [{ name: '等待毫秒', type: 'int' }], returnType: 'int', encoding: 'raw' },
      { command: 'EdgeView_设置全局代理', runtimeName: 'EdgeView_设置全局代理', parameters: [{ name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_清除全局代理', runtimeName: 'EdgeView_清除全局代理', parameters: [], returnType: 'void' },
      { command: 'EdgeView_取全局代理', runtimeName: 'EdgeView_取全局代理', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_取实例代理', runtimeName: 'EdgeView_取实例代理', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'EdgeView_绑定事件', runtimeName: 'EdgeView_绑定事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '事件名', type: 'wideString' }, { name: '处理器名', type: 'handler', description: '新代码必须使用 &处理器名；旧字符串写法仅兼容迁移。' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_监听开发者工具事件', runtimeName: 'EdgeView_监听开发者工具事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '协议事件名', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_等待事件', runtimeName: 'EdgeView_等待事件', parameters: [{ name: '实例编号', type: 'int' }, { name: '事件名', type: 'wideString' }, { name: '超时毫秒', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'EdgeView_等待事件控件', runtimeName: 'EdgeView_等待事件控件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString' }, { name: '超时毫秒', type: 'int' }], returnType: 'int', encoding: 'wide' },
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
      ,{ command: 'EdgeView_创建弹窗浏览器', runtimeName: 'EdgeView_创建弹窗浏览器', parameters: [{ name: '实例编号', type: 'int' }, { name: '窗口标题', type: 'wideString' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '用户代理', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_创建弹窗浏览器代理', runtimeName: 'EdgeView_创建弹窗浏览器代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '窗口标题', type: 'wideString' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '用户代理', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView_关闭全部实例', runtimeName: 'EdgeView_关闭全部实例', parameters: [], returnType: 'int' }
      ,{ command: 'EdgeView_枚举实例JSON', runtimeName: 'EdgeView_枚举实例JSON', parameters: [], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView_置实例可见', runtimeName: 'EdgeView_置实例可见', parameters: [{ name: '实例编号', type: 'int' }, { name: '可见', type: 'bool' }], returnType: 'int' }
      ,{ command: 'EdgeView_置实例大小', runtimeName: 'EdgeView_置实例大小', parameters: [{ name: '实例编号', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }], returnType: 'int' }
      ,{ command: 'EdgeView_取实例大小JSON', runtimeName: 'EdgeView_取实例大小JSON', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView_置实例标题', runtimeName: 'EdgeView_置实例标题', parameters: [{ name: '实例编号', type: 'int' }, { name: '标题', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView设置_置用户代理实例', runtimeName: 'EdgeView设置_置用户代理实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '用户代理', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView设置_取用户代理实例', runtimeName: 'EdgeView设置_取用户代理实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' }
      ,{ command: 'EdgeView会话_批量置Cookie实例', runtimeName: 'EdgeView会话_批量置Cookie实例', parameters: [{ name: '实例编号', type: 'int' }, { name: 'Cookie列表JSON', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView会话_置Cookie带属性实例', runtimeName: 'EdgeView会话_置Cookie带属性实例', parameters: [{ name: '实例编号', type: 'int' }, { name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' }, { name: '域', type: 'wideString' }, { name: '路径', type: 'wideString' }, { name: '过期时间', type: 'double' }, { name: '安全', type: 'bool' }, { name: '仅HTTP', type: 'bool' }, { name: '同源策略', type: 'int' }], returnType: 'int', encoding: 'wide' }
      ,{ command: 'EdgeView会话_删除全部Cookie实例', runtimeName: 'EdgeView会话_删除全部Cookie实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'int' }
      ,{ command: 'EdgeView会话_取Cookie实例异步', runtimeName: 'EdgeView会话_取Cookie实例异步', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '完成处理器', type: 'handler', description: '新代码必须使用 &处理器名。' }], returnType: 'longLong', encoding: 'wide' }
      ,{ command: 'EdgeView会话_清理全部浏览数据实例异步', runtimeName: 'EdgeView会话_清理全部浏览数据实例异步', parameters: [{ name: '实例编号', type: 'int' }, { name: '完成处理器', type: 'handler', description: '新代码必须使用 &处理器名。' }], returnType: 'longLong', encoding: 'wide' }
    ] }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.cef3.browser',
    name: 'CEF3浏览器模块',
    version: '3.0.0-alpha.5',
    category: '界面',
    description: '基于 Chromium Embedded Framework 3，提供设计器浏览器控件、中文命令和集中式浏览器事件目录。',
    author: 'LingBuilder',
    tags: ['内置', 'CEF3', 'Chromium', '浏览器', 'JavaScript'],
    contributes: {
      designerControls: createControlContributions('lingbuilder.cef3.browser'),
      commands: [
        { name: 'CEF3_是否启用崩溃报告', aliases: ['cef_crash_reporting_enabled'], signature: 'CEF3_是否启用崩溃报告()', description: '返回当前 CEF 崩溃报告配置是否启用。', insertText: 'CEF3_是否启用崩溃报告()', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_设置崩溃键值', aliases: ['cef_set_crash_key_value'], signature: 'CEF3_设置崩溃键值(键, 值)', description: '设置或清除发送到 CEF 崩溃报告的键值元数据；值为空文本时清除该键。', insertText: 'CEF3_设置崩溃键值("场景", "首页")', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_取命令资源ID', aliases: ['cef_id_for_command_id_name'], signature: 'CEF3_取命令资源ID(名称)', description: '按当前 CEF/Chromium 版本把 IDC 命令名称转换为数值 ID；未知名称返回 -1。', insertText: 'CEF3_取命令资源ID("IDC_BACK")', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_导航', signature: 'CEF3_导航(控件名, 地址)', description: '让指定 CEF3 浏览器控件导航到 HTTP/HTTPS 地址或本地文件地址。', insertText: 'CEF3_导航($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'CEF3_打开原生UI浏览器', signature: 'CEF3_打开原生UI浏览器(控件名, 地址)', description: '使用 CEF Chrome Runtime 创建带原生地址栏和浏览器界面的独立顶层窗口，并纳入指定内嵌控件的 popup 生命周期管理。', insertText: 'CEF3_打开原生UI浏览器($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'CEF3_创建弹窗浏览器', signature: 'CEF3_创建弹窗浏览器(实例编号, 地址, 独立缓存目录, 代理地址)', description: '不依赖设计器控件，用 CEF Chrome Runtime 凭空创建独立顶层浏览器弹窗：不同 实例编号 + 不同 独立缓存目录（独立 profile）实现店铺间 Cookie/缓存隔离，代理地址非空即该弹窗独立出口 IP。实例登记进运行时表，可被 CEF3_枚举实例JSON 列出、由 CEF3_关闭全部实例 统一关闭；实例级 UA 用 CEF3_设置实例用户代理 设置。', insertText: 'CEF3_创建弹窗浏览器(1, "https://www.example.com", ".cef3/store-a", "")', returnType: '整数型' },
        { name: 'CEF3_创建无头浏览器', signature: 'CEF3_创建无头浏览器(实例编号, 地址, 独立缓存目录, 代理地址, 视口宽, 视口高)', description: '用 CEF 官方无窗口渲染（OSR）创建不产生任何窗口的浏览器实例，控制台项目可直接调用：地址传空为 about:blank，独立缓存目录传空用默认 cef3-headless-<实例编号>，代理地址非空即该实例独立出口 IP，视口默认 1280×720（宽高传非正数直接失败）。实例登记进运行时表，可被 CEF3_枚举实例JSON 列出（mode 为 windowless）、由 CEF3_关闭全部实例 统一关闭。一期无画面输出，取内容用 CEF3无头_取页面文本 / CEF3无头_执行JS；截图未开放，禁止用创建可见窗口再隐藏的方式冒充无头。', insertText: 'CEF3_创建无头浏览器(1, "https://www.example.com", ".cef3/headless-1", "", 1280, 720)', returnType: '整数型' },
        { name: 'CEF3无头_是否已创建', signature: 'CEF3无头_是否已创建(实例编号)', description: '按实例编号查询无头浏览器实例是否仍存在且已创建：返回 1 已创建，0 表示实例不存在或已关闭。无头实例没有宿主窗口、派发不了中文事件处理器，创建结果只能靠本命令与 CEF3无头_取视口JSON 回读，不要凭假设往下走。', insertText: 'CEF3无头_是否已创建(1)', returnType: '整数型' },
        { name: 'CEF3无头_设置视口', signature: 'CEF3无头_设置视口(实例编号, 视口宽, 视口高)', description: '修改无头浏览器实例的渲染视口（CSS 像素），宽高必须为正整数；写入成功后向 CEF 请求重查视口并立即重绘，决定后续布局宽度与媒体查询结果。返回 1 表示视口已生效。两条口径必须知道：一、写入与刷新是两步，宿主刷新请求未确认时视口其实已经写入，此时本命令仍返回 1 并给出中文诊断「视口已写入，但刷新未确认」，不得按失败处理；二、设定值不是永久权威，出帧后 CEF 会把实际渲染尺寸回写，读取当前尺寸一律用 CEF3无头_取视口JSON。', insertText: 'CEF3无头_设置视口(1, 1024, 640)', returnType: '整数型' },
        { name: 'CEF3无头_取视口JSON', signature: 'CEF3无头_取视口JSON(实例编号)', description: '读取无头浏览器实例当前生效的视口，返回 {"width":…,"height":…,"paintCount":…}。这里的宽高是 CEF 的实际渲染尺寸，不是设定值的回显：每次出帧 CEF 会把该帧真实尺寸回写进存储视口，因此读到的可能不等于 CEF3无头_设置视口 刚传入的数字，判断布局尺寸只能以此为准。paintCount 是已交付像素帧计数，不代表宿主已取走帧内容。实例不存在或该实例不是无窗口 OSR 浏览器时返回空文本，并原样转述 CEF3 桥给出的中文原因。', insertText: '调试输出(CEF3无头_取视口JSON(1))', returnType: '文本型' },
        { name: 'CEF3无头_取渲染帧数', signature: 'CEF3无头_取渲染帧数(实例编号)', description: '返回无头浏览器实例至今交付的 OSR 像素帧数量（长整数）。一期不外发像素内容，本计数是唯一可用的「确实在无窗口渲染」证据：大于 0 说明页面已出帧，长期为 0 说明页面没出帧（未加载、被阻塞或视口无效）。实例不存在或该实例不是无窗口 OSR 浏览器返回 0 并转述桥的中文原因。', insertText: '局部 长整数型 帧数 = CEF3无头_取渲染帧数(1)', returnType: '长整数型' },
        { name: 'CEF3无头_等待出帧', signature: 'CEF3无头_等待出帧(实例编号, 超时毫秒)', description: '带超时地等该无头实例交付第一帧 OSR 像素，出帧返回 1。为什么必须单独等：CEF 的「加载完成」与「首帧交付」是两件事——真机实测窗口项目里 CEF3无头_等待加载完成 刚返回时 CEF3无头_取渲染帧数 仍然是 0，约半秒后才交付第一帧，只读一次就把「没出帧」当结论是错的。等待期间每过 500 毫秒周期性请求一次视图重绘：无窗口浏览器没有宿主可见性变化来催帧，重绘请求是把渲染管线叫醒的唯一手段。超时毫秒传 0 或负数按默认 10000；超时或实例不存在返回 0 并给含当前帧数的中文诊断，绝不无限等待。一期不外发帧内容，本命令只证明「确实在无窗口渲染」，不是截图能力。', insertText: 'CEF3无头_等待出帧(1, 8000)', returnType: '整数型' },
        { name: 'CEF3无头_导航', signature: 'CEF3无头_导航(实例编号, 地址)', description: '让指定实例编号的无头浏览器导航到 HTTP/HTTPS 或本地文件地址；不依赖设计器控件、不依赖消息泵。桥的创建是异步的，CEF 侧浏览器尚未建好时本次导航只登记为排队目标，由「浏览器创建完成」事件或下一次就绪确认（CEF3无头_等待加载完成 / 再次导航）补发，因此创建后立刻导航不会失败也不会静默丢失。成功或已排队返回 1，地址为空文本或实例不存在返回 0。', insertText: 'CEF3无头_导航(1, "https://www.example.com")', returnType: '整数型' },
        { name: 'CEF3无头_是否加载中', signature: 'CEF3无头_是否加载中(实例编号)', description: '该无头浏览器正在加载网页时返回 1，否则 0；实例不存在返回 0。红线：桥的浏览器创建是异步投递到 CEF UI 线程的，创建尚未完成时本命令同样返回 0，因此 0 只表示「此刻没在加载」，绝不能当作「浏览器已建好」或「加载已结束」的判据。无头实例派发不了事件处理器，加载进度只能靠本命令与 CEF3无头_等待加载完成 轮询。', insertText: 'CEF3无头_是否加载中(1)', returnType: '整数型' },
        { name: 'CEF3无头_等待加载完成', signature: 'CEF3无头_等待加载完成(实例编号, 超时毫秒)', description: '无头实例读取标题、执行JS、取页面内容之前的必用前置命令，两段轮询共用同一个总超时：第一段每 20 毫秒轮询确认 CEF 真的把浏览器对象建出来（创建是异步投递到 CEF UI 线程的）；第二段每 50 毫秒轮询确认「主文档已提交 且 不在加载中」。为什么必须两段并且要问主文档：浏览器对象没建好时「是否加载中」返回 0，建好与导航真正开始之间那一拍它同样返回 0，只轮询加载状态会把这两种「还没开始」都误判成「已加载完」，导致后续命令读到空文本。全程不依赖消息泵、消息循环或无头泵窗口，控制台项目可直接调用。超时毫秒传 0 或负数按默认 30000；超时返回 0 并按阶段给出中文诊断（创建未完成 / 加载未结束），绝不无限等待。实例不存在返回 0。', insertText: 'CEF3无头_等待加载完成(1, 15000)', returnType: '整数型' },
        { name: 'CEF3无头_取标题', signature: 'CEF3无头_取标题(实例编号)', description: '返回无头浏览器当前页面标题，与控件版 CEF3_取标题 复用同一份运行时实现，只是按实例编号寻址、不需要设计器控件。实例不存在或页面尚未产生标题返回空文本。', insertText: '局部 文本型 标题 = CEF3无头_取标题(1)', returnType: '文本型' },
        { name: 'CEF3无头_取地址', signature: 'CEF3无头_取地址(实例编号)', description: '返回无头浏览器当前页面地址，与控件版 CEF3_取地址 复用同一份运行时实现，按实例编号寻址。实例不存在返回空文本。导航后立刻读取可能仍是旧地址，先等 CEF3无头_等待加载完成。', insertText: '局部 文本型 地址 = CEF3无头_取地址(1)', returnType: '文本型' },
        { name: 'CEF3无头_取主框架', signature: 'CEF3无头_取主框架(实例编号)', description: '取得无头浏览器实例的主框架受管句柄（实例编号寻址，不需要设计器控件）；随后全部句柄版命令零改动可用：CEF3框架_执行JS、CEF3框架_取源码异步、CEF3框架_取文本异步、CEF3填表_点击元素/赋值/置选择项、CEF3DOM_*。这是页面内容与表单操作的唯一入口，不要拿它当 OSR 帧命令的句柄。句柄是 64 位受管值且高位恒置 1，在 .lcpp 里必然显示为负数：判断有效一律用「!= 0」，写「> 0」会把每个合法句柄判成无效。页面尚未产生框架或实例不存在返回 0。', insertText: '局部 长整数型 框架 = CEF3无头_取主框架(1)', returnType: '长整数型' },
        { name: 'CEF3无头_取浏览器句柄', signature: 'CEF3无头_取浏览器句柄(实例编号)', description: '取得无头浏览器实例的受管浏览器句柄（实例编号寻址），供浏览器级 OSR 命令使用：CEF3OSR_请求重绘、CEF3OSR_设置窗口外帧率、CEF3OSR_取窗口外帧率、CEF3离屏_订阅像素帧、CEF3离屏_订阅视图矩形。句柄由运行时托管，用户侧不得释放，实例关闭后失效返回 0；句柄是 64 位受管值、在 .lcpp 里通常显示为负数，判断有效只用「!= 0」。取页面内容请改用 CEF3无头_取主框架，不要用本句柄拼第二套内容链路。', insertText: '局部 长整数型 句柄 = CEF3无头_取浏览器句柄(1)', returnType: '长整数型' },
        { name: 'CEF3无头_执行JS', signature: 'CEF3无头_执行JS(实例编号, 脚本)', description: '在无头浏览器实例里执行 JavaScript 并返回 JSON 结果文本，与控件版 CEF3_执行JS 复用同一份 DevTools Runtime.evaluate 实现与最多 5 秒超时口径，只是按实例编号寻址、不需要设计器控件。实例不存在或浏览器尚未创建返回空文本并给中文诊断。填表与 DOM 批量操作请走 CEF3无头_取主框架 再接句柄版命令，不要为无头实例另造第二套页面链路。', insertText: '调试输出(CEF3无头_执行JS(1, "document.title"))', returnType: '文本型' },
        { name: 'CEF3无头_取页面文本', signature: 'CEF3无头_取页面文本(实例编号, 超时毫秒)', description: '同步取该无头实例主框架的可见纯文本：内部按 CEF3框架_取文本异步 发起任务后每 50 毫秒轮询任务状态（CEF 侧没有任务等待导出），因此不依赖消息泵，控制台可直接用。超时毫秒传 0 或负数按默认 30000；超时、实例不存在或页面还没有主框架都返回空文本并给中文诊断。只要文本判断时优先用本命令，需要 HTML 结构再用 CEF3无头_取页面源码。', insertText: '调试输出(CEF3无头_取页面文本(1, 15000))', returnType: '文本型' },
        { name: 'CEF3无头_取页面源码', signature: 'CEF3无头_取页面源码(实例编号, 超时毫秒)', description: '同步取该无头实例主框架的完整 HTML 源码，等待方式与超时口径同 CEF3无头_取页面文本（CEF3框架_取源码异步 + 50 毫秒轮询，默认超时 30000 毫秒）。源码可能很大，取回后先按需截取再输出日志；超时或实例/框架不存在返回空文本并给中文诊断。', insertText: '调试输出(CEF3无头_取页面源码(1, 15000))', returnType: '文本型' },
        { name: 'CEF3无头_取事件JSON', signature: 'CEF3无头_取事件JSON(实例编号)', description: '返回该无头实例缓冲的 CEF 事件 JSON 数组，每项含 事件名 与 字段。无头实例没有宿主窗口，控件版事件派发会因缺少宿主直接丢弃，所以事件被写进实例内的有界环形缓冲：上限 200 条，超限丢最旧，本命令只读不清空。给无头实例绑定中文事件处理器无效，只能靠本命令轮询取事件。实例不存在返回空文本。', insertText: '调试输出(CEF3无头_取事件JSON(1))', returnType: '文本型' },
        { name: 'CEF3无头_关闭', signature: 'CEF3无头_关闭(实例编号)', description: '按实例编号关闭无头浏览器并释放其受管桥句柄（含由它派生的弹窗别名句柄），返回 1 表示已关闭，0 表示实例不存在。关闭后同一实例编号可以再次 CEF3_创建无头浏览器。进程退出时运行时会统一回收全部无头实例，正常流程不必逐个调用。', insertText: 'CEF3无头_关闭(1)', returnType: '整数型' },
        { name: 'CEF3_创建区域', signature: 'CEF3_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)', description: '不依赖设计器控件，在当前窗口指定矩形区域创建独立 CEF3 浏览器实例（运行时自建承载子窗口 + 独立 profile 缓存目录 + 可选独立代理），用于动态数量的内嵌多浏览器；实例登记进运行时表，可被 CEF3_枚举实例JSON 列出、由 CEF3_关闭全部实例 统一关闭。', insertText: 'CEF3_创建区域(1, 10, 10, 480, 500, "https://www.example.com", ".cef3/store-a", "")', returnType: '整数型' },
        { name: 'CEF3会话_取上下文实例', signature: 'CEF3会话_取上下文实例(实例编号)', description: '取得设计器无关实例（CEF3_创建弹窗浏览器 / CEF3_创建区域 的实例编号）的 RequestContext 受管句柄，随后即可用全部句柄版 CEF3会话_* 命令（Cookie 设置/遍历/删除、清缓存、首选项）对该弹窗/区域实例操作；实例不存在或未创建返回 0，用完用 CEF3会话_释放上下文 释放。', insertText: '局部 长整数型 上下文 = CEF3会话_取上下文实例(1)', returnType: '长整数型' },
        { name: 'CEF3_设置用户代理', signature: 'CEF3_设置用户代理(控件名, 用户代理)', description: '为指定 CEF3 浏览器控件实例设置独立用户代理（UA）。CEF 无 per-browser settings，本命令在「资源加载前」事件里改写请求头 User-Agent，逐实例隔离；用户代理置空则清除覆盖。', insertText: 'CEF3_设置用户代理(浏览器1, "Mozilla/5.0 (store-A)")', returnType: '整数型' },
        { name: 'CEF3_设置实例用户代理', signature: 'CEF3_设置实例用户代理(实例编号, 用户代理)', description: '为设计器无关实例（CEF3_创建弹窗浏览器 / CEF3_创建区域 的实例编号）设置独立用户代理，实现多店铺弹窗/区域各自不同 UA；置空清除覆盖，实例不存在返回 0。', insertText: 'CEF3_设置实例用户代理(1, "Mozilla/5.0 (store-A)")', returnType: '整数型' },
        { name: 'CEF3_取用户代理', signature: 'CEF3_取用户代理(控件名)', description: '读取指定 CEF3 浏览器控件实例当前设置的独立用户代理，未设置返回空文本。', insertText: 'CEF3_取用户代理(浏览器1)', returnType: '文本型' },
        { name: 'CEF3_取实例用户代理', signature: 'CEF3_取实例用户代理(实例编号)', description: '读取设计器无关实例（弹窗/区域实例编号）当前设置的独立用户代理，未设置或实例不存在返回空文本。', insertText: 'CEF3_取实例用户代理(1)', returnType: '文本型' },
        { name: 'CEF3_关闭全部实例', signature: 'CEF3_关闭全部实例()', description: '关闭当前全部 CEF3 浏览器实例（含内嵌控件与独立顶层弹窗）并释放受管句柄，返回关闭数量。', insertText: 'CEF3_关闭全部实例()', returnType: '整数型' },
        { name: 'CEF3_枚举实例JSON', signature: 'CEF3_枚举实例JSON()', description: '返回当前全部 CEF3 实例的 JSON 数组，每项含 controlId/地址/标题/缓存目录/代理，供调用方自省与多实例列表展示。', insertText: 'CEF3_枚举实例JSON()', returnType: '文本型' },
        { name: 'CEF3_执行JS', aliases: ['Runtime.evaluate'], signature: 'CEF3_执行JS(控件名, 脚本)', description: '通过 DevTools Runtime.evaluate 执行 JavaScript，最多等待 5 秒并返回 JSON 结果；新代码优先使用异步任务接口。', insertText: 'CEF3_执行JS($1, "document.title")', returnType: '文本型' },
        { name: 'CEF3_后退', signature: 'CEF3_后退(控件名)', description: '指定 CEF3 浏览器控件可以后退时返回上一页，成功返回 1。', insertText: 'CEF3_后退($1)', returnType: '整数型' },
        { name: 'CEF3_前进', signature: 'CEF3_前进(控件名)', description: '指定 CEF3 浏览器控件可以前进时进入下一页，成功返回 1。', insertText: 'CEF3_前进($1)', returnType: '整数型' },
        { name: 'CEF3_刷新', signature: 'CEF3_刷新(控件名)', description: '刷新指定 CEF3 浏览器控件的当前网页。', insertText: 'CEF3_刷新($1)', returnType: '空' },
        { name: 'CEF3_停止', signature: 'CEF3_停止(控件名)', description: '停止指定 CEF3 浏览器控件的当前导航。', insertText: 'CEF3_停止($1)', returnType: '空' },
        { name: 'CEF3_取标题', signature: 'CEF3_取标题(控件名)', description: '返回指定 CEF3 浏览器控件当前网页标题。', insertText: 'CEF3_取标题($1)', returnType: '文本型' },
        { name: 'CEF3_取地址', signature: 'CEF3_取地址(控件名)', description: '返回指定 CEF3 浏览器控件当前网页地址。', insertText: 'CEF3_取地址($1)', returnType: '文本型' },
        { name: 'CEF3_取资源地址', signature: 'CEF3_取资源地址(相对路径)', description: '把相对路径解析为随程序一起部署在 exe 同级 assets 目录下的文件地址，返回已按 UTF-8 转义的 file:/// URL，用于加载本地测试页，避免在源码里写死机器特定绝对路径。传入盘符绝对路径、UNC 路径或已带协议的完整地址时原样返回，可重复套用。地址形参是宽字符串指针，因此结果必须先赋给文本型局部变量再传给 CEF3_导航，不能直接内联嵌套。', insertText: '局部 文本型 地址 = CEF3_取资源地址("index.html")\nCEF3_导航($1, 地址)', returnType: '文本型' },
        { name: 'CEF3_设置缓存目录', aliases: ['CefRequestContext::CreateContext'], signature: 'CEF3_设置缓存目录(控件名, 目录)', description: '设置实例独立 RequestContext 的缓存目录标识；实际目录被安全映射到全局 root_cache_path 的直接子目录。需在创建前设置。', insertText: 'CEF3_设置缓存目录($1, "cache-2")', returnType: '整数型' },
        { name: 'CEF3_设置代理', aliases: ['CefPreferenceManager::SetPreference'], signature: 'CEF3_设置代理(控件名, 代理地址)', description: '为实例独立 RequestContext 设置 HTTP/HTTPS/SOCKS5 代理；空文本使用直连。需在创建前设置。', insertText: 'CEF3_设置代理($1, "http://127.0.0.1:7890")', returnType: '整数型' },
        { name: 'CEF3_设置全局代理', signature: 'CEF3_设置全局代理(代理地址)', description: '设置之后新建 CEF3 实例（控件 / 弹窗 / 区域 / 无头）默认使用的 HTTP/HTTPS/SOCKS5 全局代理；实例创建时自带代理优先，传空给 CEF3_设置代理 的显式直连不参与回落，已创建实例不受影响。代理地址传空文本等价于 CEF3_清除全局代理。带认证（用户名/密码）的代理当前不被 CEF3 支持：CEF 150 不把代理 407 挑战投递给客户端（真机验证），需要代理认证请改用 FBro（FBro会话_设置代理认证）或 EdgeView；也禁止把凭据拼进代理地址。成功返回 1。', insertText: 'CEF3_设置全局代理("http://127.0.0.1:7890")', returnType: '整数型' },
        { name: 'CEF3_清除全局代理', signature: 'CEF3_清除全局代理()', description: '清除 CEF3 全局代理，之后新建实例回到各自的代理设置；已创建实例不变。成功返回 1。', insertText: 'CEF3_清除全局代理()', returnType: '整数型' },
        { name: 'CEF3_取全局代理', signature: 'CEF3_取全局代理()', description: '返回当前 CEF3 全局代理地址；未设置返回空文本。', insertText: '调试输出(CEF3_取全局代理())', returnType: '文本型' },
        { name: 'CEF3_取实例代理', signature: 'CEF3_取实例代理(实例编号)', description: '按实例编号返回设计器无关实例（CEF3_创建弹窗浏览器 / CEF3_创建区域 / CEF3_创建无头浏览器）实际采用的代理地址：实例自带代理优先，未设置时显示全局代理回落值；返回空文本表示该实例按系统代理或直接连接。实例不存在返回空文本并给中文诊断。', insertText: '调试输出(CEF3_取实例代理(1))', returnType: '文本型' },
        { name: 'CEF3_创建', signature: 'CEF3_创建(控件名)', description: '使用属性面板配置的地址、缓存目录和代理参数初始化指定 CEF3 浏览器控件；传空控件名时初始化当前窗口全部 CEF3 控件。成功返回 1。', insertText: 'CEF3_创建($1)', returnType: '整数型' },
        { name: 'CEF3_执行消息循环工作', aliases: ['cef_do_message_loop_work'], signature: 'CEF3_执行消息循环工作()', description: '在 CEF 消息循环模式下执行一次非阻塞消息循环工作；Bridge 会安全调度到 CEF UI 线程。', insertText: 'CEF3_执行消息循环工作()', returnType: '空', visibility: 'advanced' },
        { name: 'CEF3_关闭', signature: 'CEF3_关闭(控件名)', description: '关闭指定 CEF3 浏览器控件并释放 Chromium 资源。', insertText: 'CEF3_关闭($1)', returnType: '空' },
        { name: 'CEF3_取最近事件', signature: 'CEF3_取最近事件(控件名)', description: `返回最近 CEF3 事件名；当前事件清单共 ${CEF3_BROWSER_EVENT_NAMES.length} 个浏览器回调。`, insertText: 'CEF3_取最近事件($1)', returnType: '文本型' },
        { name: 'CEF3_取事件数据', signature: 'CEF3_取事件数据(控件名)', description: '返回最近事件的主要文本数据。', insertText: 'CEF3_取事件数据($1)', returnType: '文本型' },
        { name: 'CEF3_取事件字段', signature: 'CEF3_取事件字段(控件名, 字段名)', description: '读取最近事件的命名字段，例如 url、frameId、statusCode、progress、commandId。', insertText: 'CEF3_取事件字段($1, "url")', returnType: '文本型' },
        { name: 'CEF3_读资源响应正文', signature: 'CEF3_读资源响应正文(控件名, 最大字节数, 完成处理器)', description: '在“资源响应到达”处理器执行期间，为当前资源安装有界正文捕获；完成后触发“资源响应正文到达”，通过 CEF3_取事件字段读取 bodyText、bodyBase64、receivedBytes、truncated 和 error。不会重新发起请求。', insertText: 'CEF3_读资源响应正文($1, 1048576, &$2)', returnType: '整数型' },
        { name: 'CEF3_替换资源响应内容', signature: 'CEF3_替换资源响应内容(控件名, 查找内容, 替换内容)', description: '为指定 CEF3 浏览器配置响应正文查找替换：之后加载的资源正文中的“查找内容”（按 UTF-8 字节匹配）会被“替换内容”改写，替换内容为空表示删除。二进制安全、流式处理，对整只浏览器全部资源生效；重复调用以最后一次为准。浏览器未就绪时自动排队，导航前配置可覆盖首个页面。只修改响应正文，不改变响应头和状态码。', insertText: 'CEF3_替换资源响应内容($1, "原始文本", "替换文本")', returnType: '整数型' },
        { name: 'CEF3_清除资源响应替换', signature: 'CEF3_清除资源响应替换(控件名)', description: '移除指定 CEF3 浏览器当前的响应替换配置，之后加载的资源恢复原始正文；已加载页面不受影响。同时取消尚未生效的排队配置。', insertText: 'CEF3_清除资源响应替换($1)', returnType: '整数型' },
        { name: 'CEF3_设置事件结果', signature: 'CEF3_设置事件结果(控件名, 结果)', description: '设置当前同步事件结果：0=默认、1=允许/继续、2=拒绝/取消、3=已处理。', insertText: 'CEF3_设置事件结果($1, 1)', returnType: '整数型' },
        { name: 'CEF3_设置事件返回文本', signature: 'CEF3_设置事件返回文本(控件名, 文本)', description: '设置当前事件的返回文本，例如修改后的 URL、下载路径、对话框输入或身份验证信息。', insertText: 'CEF3_设置事件返回文本($1, "$2")', returnType: '整数型' },
        { name: 'CEF3_绑定事件', signature: 'CEF3_绑定事件(控件名, 事件名, 处理器)', description: `绑定 CEF3 浏览器事件清单（${CEF3_BROWSER_EVENT_NAMES.length} 项）到当前窗口无参数中文事件或方法；处理器必须使用 &处理器名。`, insertText: 'CEF3_绑定事件($1, "加载完成", &$2)', returnType: '整数型' },
        { name: 'CEF3_启用JS扩展', signature: 'CEF3_启用JS扩展(控件名, 查询函数名, 取消函数名)', description: '启用页面调用原生的 JS 交互（cefQuery）通道：页面通过 window.查询函数名({request, onSuccess, onFailure}) 发起查询，原生通过「查询请求」事件接收并用 CEF3_查询应答 / CEF3_查询应答失败 应答。通道必须在 CEF 初始化之前配置——请优先使用 CEF3 浏览器控件的 jsQueryFunctions 属性（格式“查询函数名,取消函数名”），本命令仅在初始化前调用有效，初始化后调用返回 0。一个程序可注册多条通道（各通道的查询函数名互不重复），同名重复调用按幂等成功处理；「查询请求」事件的 channelIndex 字段标明来源通道序号（0 起）。', insertText: 'CEF3_启用JS扩展($1, "cefQuery", "cefQueryCancel")', returnType: '整数型' },
        { name: 'CEF3_查询应答', signature: 'CEF3_查询应答(控件名, 查询ID, 结果文本)', description: '应答「查询请求」事件：查询ID 从事件字段 queryId 读取（数字文本，原样传回），结果文本回传给页面 onSuccess。每条查询只能应答一次；未应答的查询 120 秒后自动对页面回错误码 -4。', insertText: 'CEF3_查询应答($1, CEF3_取事件字段($1, "queryId"), "完成")', returnType: '整数型' },
        { name: 'CEF3_查询应答失败', signature: 'CEF3_查询应答失败(控件名, 查询ID, 错误码, 错误文本)', description: '以失败结果应答「查询请求」事件：错误码与错误文本回传给页面 onFailure（错误码 0 视为 -1）。每条查询只能应答一次。', insertText: 'CEF3_查询应答失败($1, CEF3_取事件字段($1, "queryId"), -1, "没有数据")', returnType: '整数型' },
        { name: 'CEF3_是否可后退', signature: 'CEF3_是否可后退(控件名)', description: '指定 CEF3 浏览器控件可以后退时返回 1。', insertText: 'CEF3_是否可后退($1)', returnType: '整数型' },
        { name: 'CEF3_是否可前进', signature: 'CEF3_是否可前进(控件名)', description: '指定 CEF3 浏览器控件可以前进时返回 1。', insertText: 'CEF3_是否可前进($1)', returnType: '整数型' },
        { name: 'CEF3_是否加载中', signature: 'CEF3_是否加载中(控件名)', description: '指定 CEF3 浏览器控件正在加载网页时返回 1。', insertText: 'CEF3_是否加载中($1)', returnType: '整数型' },
        { name: 'CEF3_是否有效', aliases: ['is_valid'], signature: 'CEF3_是否有效(控件名)', description: '指定 CEF3 浏览器控件的原生浏览器对象仍有效时返回 1。', insertText: 'CEF3_是否有效($1)', returnType: '整数型' },
        { name: 'CEF3_是否弹出窗口', aliases: ['is_popup'], signature: 'CEF3_是否弹出窗口(控件名)', description: '指定 CEF3 浏览器对象由弹出窗口流程创建时返回 1。', insertText: 'CEF3_是否弹出窗口($1)', returnType: '整数型' },
        { name: 'CEF3_是否同一实例', aliases: ['is_same'], signature: 'CEF3_是否同一实例(控件名, 另一控件名)', description: '两个 CEF3 浏览器控件引用同一原生浏览器对象时返回 1。', insertText: 'CEF3_是否同一实例($1, $2)', returnType: '整数型' },
        { name: 'CEF3_是否有文档', aliases: ['has_document'], signature: 'CEF3_是否有文档(控件名)', description: '指定 CEF3 浏览器控件已经加载文档时返回 1。', insertText: 'CEF3_是否有文档($1)', returnType: '整数型' },
        { name: 'CEF3_是否禁用窗口渲染', aliases: ['is_window_rendering_disabled'], signature: 'CEF3_是否禁用窗口渲染(控件名)', description: '指定 CEF3 浏览器使用无窗口/OSR 渲染时返回 1；普通窗口浏览器返回 0。', insertText: 'CEF3_是否禁用窗口渲染($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_是否网页全屏', aliases: ['is_fullscreen'], signature: 'CEF3_是否网页全屏(控件名)', description: '指定 CEF3 浏览器的网页通过 JavaScript Fullscreen API 进入全屏时返回 1，不表示宿主窗口是否最大化。', insertText: 'CEF3_是否网页全屏($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_是否使用浏览器视图', aliases: ['has_view'], signature: 'CEF3_是否使用浏览器视图(控件名)', description: '指定浏览器由 CEF Views 框架的 CefBrowserView 包装时返回 1，否则返回 0。', insertText: 'CEF3_是否使用浏览器视图($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_取打开者浏览器ID', aliases: ['get_opener_identifier'], signature: 'CEF3_取打开者浏览器ID(控件名)', description: '返回创建当前弹出浏览器的浏览器唯一 ID；当前浏览器不是弹出浏览器时返回 0。', insertText: 'CEF3_取打开者浏览器ID($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_是否已准备关闭', aliases: ['is_ready_to_be_closed'], signature: 'CEF3_是否已准备关闭(控件名)', description: '浏览器进入必须完成的关闭阶段时返回 1；返回 1 后应尽快销毁对应宿主窗口或视图层级。', insertText: 'CEF3_是否已准备关闭($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_是否渲染进程无响应', aliases: ['is_render_process_unresponsive'], signature: 'CEF3_是否渲染进程无响应(控件名)', description: '关联渲染进程至少 15 秒未处理输入事件时返回 1；状态变化也可通过“渲染进程无响应/恢复响应”事件接收。', insertText: 'CEF3_是否渲染进程无响应($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_取运行时样式', aliases: ['get_runtime_style'], signature: 'CEF3_取运行时样式(控件名)', description: '返回浏览器运行时样式：0 默认、1 Chrome、2 Alloy；无窗口/OSR 浏览器固定为 Alloy。', insertText: 'CEF3_取运行时样式($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_取缩放级别', aliases: ['get_zoom_level'], signature: 'CEF3_取缩放级别(控件名)', description: '读取浏览器当前缩放级别；0.0 表示默认缩放，正数放大，负数缩小。', insertText: 'CEF3_取缩放级别($1)', returnType: '小数型' },
        { name: 'CEF3_取默认缩放级别', aliases: ['get_default_zoom_level'], signature: 'CEF3_取默认缩放级别(控件名)', description: '读取浏览器宿主的默认缩放级别；未配置默认缩放时返回 0.0。', insertText: 'CEF3_取默认缩放级别($1)', returnType: '小数型' },
        { name: 'CEF3_设置缩放级别', aliases: ['set_zoom_level'], signature: 'CEF3_设置缩放级别(控件名, 级别)', description: '设置浏览器当前缩放级别；传入 0.0 可恢复宿主默认缩放。', insertText: 'CEF3_设置缩放级别($1, 0.0)', returnType: '整数型' },
        { name: 'CEF3_是否可缩放', aliases: ['can_zoom'], signature: 'CEF3_是否可缩放(控件名, 缩放命令)', description: '判断浏览器是否可执行指定缩放命令：0 缩小、1 重置、2 放大；可执行时返回 1。', insertText: 'CEF3_是否可缩放($1, 2)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_执行缩放', aliases: ['zoom'], signature: 'CEF3_执行缩放(控件名, 缩放命令)', description: '执行浏览器缩放动作：0 缩小、1 重置、2 放大；调用前可用 CEF3_是否可缩放 查询，当前命令不可执行时返回失败状态。', insertText: 'CEF3_执行缩放($1, 2)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_尝试关闭', aliases: ['try_close_browser'], signature: 'CEF3_尝试关闭(控件名)', description: '按 CEF 生命周期协议请求关闭；返回 1 时宿主窗口可立即销毁，返回 0 时应等待关闭回调。', insertText: 'CEF3_尝试关闭($1)', returnType: '整数型' },
        { name: 'CEF3_通知窗口移动或调整大小', aliases: ['notify_move_or_resize_started'], signature: 'CEF3_通知窗口移动或调整大小(控件名)', description: '通知 CEF 浏览器宿主其顶层窗口已经开始移动或调整大小，使屏幕坐标、弹出层和渲染位置及时刷新。', insertText: 'CEF3_通知窗口移动或调整大小($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_通知屏幕信息已改变', aliases: ['notify_screen_info_changed'], signature: 'CEF3_通知屏幕信息已改变(控件名)', description: '通知 CEF 屏幕尺寸、位置或缩放信息已经改变；用于 OSR 或客户端提供外部根窗口的浏览器。', insertText: 'CEF3_通知屏幕信息已改变($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_发送捕获丢失事件', aliases: ['send_capture_lost_event'], signature: 'CEF3_发送捕获丢失事件(控件名)', description: '在宿主失去鼠标捕获时通知指定 CEF 浏览器；主要用于禁用窗口渲染的 OSR 输入链路。', insertText: 'CEF3_发送捕获丢失事件($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_取消输入法组合文本', aliases: ['ime_cancel_composition'], signature: 'CEF3_取消输入法组合文本(控件名)', description: '取消并丢弃指定 OSR 浏览器当前的输入法组合文本，不把组合节点内容提交到页面。', insertText: 'CEF3_取消输入法组合文本($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_完成输入法组合文本', aliases: ['ime_finish_composing_text'], signature: 'CEF3_完成输入法组合文本(控件名, 保留选择)', description: '提交指定 OSR 浏览器当前的输入法组合文本，并选择是否保留现有选区。', insertText: 'CEF3_完成输入法组合文本($1, 真)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_添加单词到词典', aliases: ['add_word_to_dictionary'], signature: 'CEF3_添加单词到词典(控件名, 单词)', description: '把非空单词加入指定浏览器配置使用的自定义拼写检查词典。', insertText: 'CEF3_添加单词到词典($1, "$2")', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_替换拼写错误', aliases: ['replace_misspelling'], signature: 'CEF3_替换拼写错误(控件名, 单词)', description: '用非空单词替换指定浏览器页面中当前选中的拼写错误文本。', insertText: 'CEF3_替换拼写错误($1, "$2")', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_通知系统拖放结束', aliases: ['drag_source_system_drag_ended'], signature: 'CEF3_通知系统拖放结束(控件名)', description: '在系统拖放循环结束后通知指定浏览器，使 CEF 清理拖放源状态。', insertText: 'CEF3_通知系统拖放结束($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_通知拖放目标离开', aliases: ['drag_target_drag_leave'], signature: 'CEF3_通知拖放目标离开(控件名)', description: '在拖动对象离开浏览器目标区域时通知 CEF 清理目标端拖放状态。', insertText: 'CEF3_通知拖放目标离开($1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_通知隐藏状态', aliases: ['was_hidden'], signature: 'CEF3_通知隐藏状态(控件名, 是否隐藏)', description: '通知无窗口渲染浏览器的宿主已经隐藏或重新显示，使 CEF 暂停或恢复绘制。', insertText: 'CEF3_通知隐藏状态($1, 真)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_退出网页全屏', aliases: ['exit_fullscreen'], signature: 'CEF3_退出网页全屏(控件名, 是否调整大小)', description: '退出网页 Fullscreen API 状态；退出后将引起浏览器视图尺寸变化时，第二个参数传真。', insertText: 'CEF3_退出网页全屏($1, 真)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_强制刷新', aliases: ['reload_ignore_cache'], signature: 'CEF3_强制刷新(控件名)', description: '忽略 HTTP 缓存重新加载指定 CEF3 浏览器控件的当前页面。', insertText: 'CEF3_强制刷新($1)', returnType: '空' },
        { name: 'CEF3_页内查找', aliases: ['find'], signature: 'CEF3_页内查找(控件名, 文本, 向前, 区分大小写, 查找下一个)', description: '在指定 CEF3 浏览器的当前页面查找文本；查找进度和最终结果通过“页内查找结果”事件返回。', insertText: 'CEF3_页内查找($1, "$2", 真, 假, 假)', returnType: '整数型' },
        { name: 'CEF3_停止页内查找', aliases: ['stop_finding'], signature: 'CEF3_停止页内查找(控件名, 清除选择)', description: '停止指定 CEF3 浏览器的页内查找，并可选择清除当前选区。', insertText: 'CEF3_停止页内查找($1, 真)', returnType: '整数型' },
        { name: 'CEF3_设置焦点', aliases: ['set_focus'], signature: 'CEF3_设置焦点(控件名, 是否聚焦)', description: '设置指定 CEF3 浏览器宿主的焦点状态。', insertText: 'CEF3_设置焦点($1, 真)', returnType: '整数型' },
        { name: 'CEF3_发送鼠标单击事件', aliases: ['send_mouse_click_event'], signature: 'CEF3_发送鼠标单击事件(控件名, X, Y, 修饰键, 按钮类型, 是否抬起, 单击次数)', description: '向指定 CEF3 浏览器发送类型化鼠标按下或抬起事件；按钮类型为 0 左键、1 中键、2 右键。', insertText: 'CEF3_发送鼠标单击事件($1, 10, 10, 0, 0, 假, 1)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_发送鼠标移动事件', aliases: ['send_mouse_move_event'], signature: 'CEF3_发送鼠标移动事件(控件名, X, Y, 修饰键, 是否离开)', description: '向指定 CEF3 浏览器发送类型化鼠标移动事件；坐标相对浏览器视图左上角，离开时最后一个参数传真。', insertText: 'CEF3_发送鼠标移动事件($1, 10, 10, 0, 假)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_发送鼠标滚轮事件', aliases: ['send_mouse_wheel_event'], signature: 'CEF3_发送鼠标滚轮事件(控件名, X, Y, 修饰键, 横向增量, 纵向增量)', description: '向指定 CEF3 浏览器发送类型化鼠标滚轮事件；坐标相对浏览器视图左上角，增量可为负数。', insertText: 'CEF3_发送鼠标滚轮事件($1, 10, 10, 0, 0, 120)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_发送触摸事件', aliases: ['send_touch_event'], signature: 'CEF3_发送触摸事件(控件名, 触点ID, X, Y, 半径X, 半径Y, 旋转角度, 压力, 事件类型, 修饰键, 指针类型)', description: '向无窗口/OSR CEF3 浏览器发送类型化触摸事件；事件类型为 0 松开、1 按下、2 移动、3 取消，指针类型为 0 触摸、1 鼠标、2 笔、3 橡皮擦、4 未知，压力范围为 0.0 到 1.0。', insertText: 'CEF3_发送触摸事件($1, 0, 10.0, 10.0, 0.0, 0.0, 0.0, 0.5, 1, 0, 0)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_发送按键事件', aliases: ['send_key_event'], signature: 'CEF3_发送按键事件(控件名, 类型, 修饰键, Windows键码, 原生键码, 是否系统键, 字符编码, 未修改字符编码, 焦点在可编辑字段)', description: '向指定 CEF3 浏览器发送类型化按键事件；类型取 0 原始按下、1 按下、2 松开或 3 字符，字符使用 UTF-16 代码单元。', insertText: 'CEF3_发送按键事件($1, 0, 0, 65, 65, 假, 97, 97, 假)', returnType: '整数型', visibility: 'advanced' },
        { name: 'CEF3_是否静音', aliases: ['is_audio_muted'], signature: 'CEF3_是否静音(控件名)', description: '指定 CEF3 浏览器控件的音频已静音时返回 1。', insertText: 'CEF3_是否静音($1)', returnType: '整数型' }
      ],
      types: [{ name: 'CEF3浏览器', description: '由 LingBuilderCefBridge 管理的 CEF 150 浏览器句柄。', cppType: 'LB_CEF3_HANDLE' }],
      snippets: [{ label: 'CEF3 浏览器导航与 JS 返回值', insertText: 'CEF3_导航(浏览器1, "https://www.baidu.com")\n调试输出(CEF3_执行JS(浏览器1, "document.title"))\n调试输出(CEF3_取最近事件(浏览器1))', description: '在 CEF3 浏览器控件中导航，并读取网页标题与最近事件。' }, { label: 'CEF3 动态内嵌多店铺区域', insertText: 'CEF3_创建区域(1, 10, 60, 600, 500, "https://www.example.com", ".cef3/store-a", "")\nCEF3_创建区域(2, 630, 60, 600, 500, "https://www.example.com", ".cef3/store-b", "http://127.0.0.1:7890")\nCEF3_设置实例用户代理(1, "Mozilla/5.0 (store-A)")\n调试输出(CEF3_枚举实例JSON())\nCEF3_关闭全部实例()', description: '不依赖设计器控件，在窗口客户区两个矩形各内嵌一个独立 CEF3 实例（各自独立缓存/代理），用 CEF3_设置实例用户代理 设请求头级各异 UA，CEF3_枚举实例JSON 枚举、CEF3_关闭全部实例 回收。' },  { label: 'CEF3 多店铺独立出口 IP（全局代理 + 实例代理）', insertText: 'CEF3_设置全局代理("http://127.0.0.1:7890")\nCEF3_创建弹窗浏览器(1, "https://www.example.com", ".cef3/store-a", "")\nCEF3_创建区域(2, 10, 60, 600, 500, "https://www.example.com", ".cef3/store-b", "http://127.0.0.1:7891")\n调试输出(CEF3_取实例代理(1))\n调试输出(CEF3_取实例代理(2))', description: 'store-a 弹窗不带代理、自动回落全局代理；store-b 区域自带独立代理实现独立出口 IP（不同上游代理=不同出口；带认证的代理不被 CEF 150 支持，需要时改用 FBro/EdgeView）；CEF3_取实例代理 回读各实例实际生效的代理。' }, { label: 'CEF3 无头抓取（控制台项目）', insertText: 'CEF3_创建无头浏览器(1, "https://www.example.com", ".cef3/headless-1", "", 1024, 640)\nCEF3无头_导航(1, "https://www.example.com/list")\nCEF3无头_等待加载完成(1, 25000)\n局部 文本型 标题 = CEF3无头_取标题(1)\n调试输出(标题)\n局部 文本型 脚本结果 = CEF3无头_执行JS(1, "document.title")\n调试输出(脚本结果)\n局部 文本型 页面源码 = CEF3无头_取页面源码(1, 20000)\n局部 文本型 页面文本 = CEF3无头_取页面文本(1, 20000)\nCEF3无头_等待出帧(1, 8000)\n调试输出(CEF3无头_取视口JSON(1))\n局部 长整数型 浏览器句柄 = CEF3无头_取浏览器句柄(1)\n局部 长整数型 主框架 = CEF3无头_取主框架(1)\n调试输出(CEF3无头_取事件JSON(1))\nCEF3无头_关闭(1)', description: '控制台项目无头抓取标准链路（CEF 官方 OSR，全程不创建任何窗口）：创建后立刻导航会自动排队补发，不静默丢失；取内容前先 CEF3无头_等待加载完成，判断真的在渲染用 CEF3无头_等待出帧（加载完成≠已出帧，真机首帧晚约半秒）；受管句柄判有效只用 != 0（64 位受管句柄按 int64 恒为负数，写 > 0 会把合法句柄全部判无效）；CEF3无头_执行JS 返回 DevTools 信封 JSON 不是裸值；控制台派发不了事件处理器，事件用 CEF3无头_取事件JSON 轮询；截图未开放（CEF3离屏_订阅像素帧 只点亮订阅位、不外发帧内容），表单/DOM 操作用主框架句柄接 CEF3框架_*/CEF3填表_*；窗口/设计器形态范本见 examples/cef3-headless-demo/src/无头抓取示例.lcpp。' }],
      docs: [
        { title: 'CEF3 模块说明', path: 'README.md' },
        { title: 'CEF3 事件与接口参考', path: 'docs/modules/cef3/README.md' },
        { title: 'CEF3 基础浏览器官方接口参考', path: 'docs/modules/cef3/browser.md' },
        { title: 'CEF3 事件与回调官方接口参考', path: 'docs/modules/cef3/events.md' },
        { title: 'CEF3 会话与请求上下文官方接口参考', path: 'docs/modules/cef3/session.md' },
        { title: 'CEF3 下载打印与传输官方接口参考', path: 'docs/modules/cef3/transfer.md' },
        { title: 'CEF3 受管读写流处理器专题', path: 'docs/modules/cef3/stream-handlers.md' },
        { title: 'CEF3 受管对象官方接口参考', path: 'docs/modules/cef3/objects.md' },
        { title: 'CEF3 自动化 DOM V8 与 JSHook 参考', path: 'docs/modules/cef3/automation.md' },
        { title: 'CEF3 网络请求与资源官方接口参考', path: 'docs/modules/cef3/network.md' },
        { title: 'CEF3 开发者工具官方接口参考', path: 'docs/modules/cef3/devtools.md' },
        { title: 'CEF3 DevTools Observer 用户指南', path: 'docs/modules/cef3/devtools-observer.md' },
        { title: 'CEF3 Views 官方接口参考', path: 'docs/modules/cef3/views.md' },
        { title: 'CEF3 OSR 官方接口参考', path: 'docs/modules/cef3/osr.md' },
        { title: 'CEF3 平台与工具官方接口参考', path: 'docs/modules/cef3/platform.md' },
        { title: 'CEF3 多浏览器示例与故障排查', path: 'docs/modules/cef3/examples.md' }
      ],
      examples: [{ title: '双浏览器示例', path: 'docs/modules/cef3/examples/CEF3多浏览器窗体.lcpp', description: '在同一窗口用两个 GroupBox 分组承载独立 CEF3 浏览器控件，并分别绑定加载事件。' }]
    },
    targets: [
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['include'], headers: ['include/LingBuilderCefBridge.h'], libs: ['modules/lingbuilder.cef3.browser/lib/x64/LingBuilderCefBridge.lib'], runtimeFiles: ['bin/x64/libcef.dll', 'bin/x64/chrome_elf.dll', 'bin/x64/LingBuilderCefBridge.dll'], defines: ['LINGBUILDER_CEF3_MODULE'] }
    ],
    bindings: { commands: [
      { command: 'CEF3_是否启用崩溃报告', runtimeName: 'CEF3_是否启用崩溃报告', parameters: [], returnType: 'int' },
      { command: 'CEF3_设置崩溃键值', runtimeName: 'CEF3_设置崩溃键值', parameters: [{ name: '键', type: 'wideString' }, { name: '值', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_设置崩溃键值("场景", "首页")' },
      { command: 'CEF3_取命令资源ID', runtimeName: 'CEF3_取命令资源ID', parameters: [{ name: '名称', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_取命令资源ID("IDC_BACK")' },
      { command: 'CEF3_导航', runtimeName: 'CEF3_导航', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_导航(浏览器1, "https://www.baidu.com")' },
      { command: 'CEF3_打开原生UI浏览器', runtimeName: 'CEF3_打开原生UI浏览器', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_打开原生UI浏览器(浏览器1, "https://www.baidu.com")' },
      { command: 'CEF3_创建弹窗浏览器', runtimeName: 'CEF3_创建弹窗浏览器', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_创建无头浏览器', runtimeName: 'CEF3_创建无头浏览器', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }, { name: '视口宽', type: 'int' }, { name: '视口高', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3无头_是否已创建', runtimeName: 'CEF3无头_是否已创建', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'int' },
      { command: 'CEF3无头_设置视口', runtimeName: 'CEF3无头_设置视口', parameters: [{ name: '实例编号', type: 'int' }, { name: '视口宽', type: 'int' }, { name: '视口高', type: 'int' }], returnType: 'int' },
      { command: 'CEF3无头_取视口JSON', runtimeName: 'CEF3无头_取视口JSON', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取渲染帧数', runtimeName: 'CEF3无头_取渲染帧数', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'longLong' },
      { command: 'CEF3无头_等待出帧', runtimeName: 'CEF3无头_等待出帧', parameters: [{ name: '实例编号', type: 'int' }, { name: '超时毫秒', type: 'int' }], returnType: 'int' },
      { command: 'CEF3无头_导航', runtimeName: 'CEF3无头_导航', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3无头_是否加载中', runtimeName: 'CEF3无头_是否加载中', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'int' },
      { command: 'CEF3无头_等待加载完成', runtimeName: 'CEF3无头_等待加载完成', parameters: [{ name: '实例编号', type: 'int' }, { name: '超时毫秒', type: 'int' }], returnType: 'int' },
      { command: 'CEF3无头_取标题', runtimeName: 'CEF3无头_取标题', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取地址', runtimeName: 'CEF3无头_取地址', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取主框架', runtimeName: 'CEF3无头_取主框架', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'longLong' },
      { command: 'CEF3无头_取浏览器句柄', runtimeName: 'CEF3无头_取浏览器句柄', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'longLong' },
      { command: 'CEF3无头_执行JS', runtimeName: 'CEF3无头_执行JS', parameters: [{ name: '实例编号', type: 'int' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取页面文本', runtimeName: 'CEF3无头_取页面文本', parameters: [{ name: '实例编号', type: 'int' }, { name: '超时毫秒', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取页面源码', runtimeName: 'CEF3无头_取页面源码', parameters: [{ name: '实例编号', type: 'int' }, { name: '超时毫秒', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_取事件JSON', runtimeName: 'CEF3无头_取事件JSON', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3无头_关闭', runtimeName: 'CEF3无头_关闭', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'int' },
      { command: 'CEF3_创建区域', runtimeName: 'CEF3_创建区域', parameters: [{ name: '实例编号', type: 'int' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3会话_取上下文实例', runtimeName: 'CEF3会话_取上下文实例', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'CEF3_设置用户代理', runtimeName: 'CEF3_设置用户代理', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '用户代理', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_设置用户代理(浏览器1, "Mozilla/5.0 (store-A)")' },
      { command: 'CEF3_设置实例用户代理', runtimeName: 'CEF3_设置实例用户代理', parameters: [{ name: '实例编号', type: 'int' }, { name: '用户代理', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_取用户代理', runtimeName: 'CEF3_取用户代理', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide', example: 'CEF3_取用户代理(浏览器1)' },
      { command: 'CEF3_取实例用户代理', runtimeName: 'CEF3_取实例用户代理', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_关闭全部实例', runtimeName: 'CEF3_关闭全部实例', parameters: [], returnType: 'int' },
      { command: 'CEF3_枚举实例JSON', runtimeName: 'CEF3_枚举实例JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_执行JS', runtimeName: 'CEF3_执行JS', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide', example: 'CEF3_执行JS(浏览器1, "document.title")' },
      { command: 'CEF3_后退', runtimeName: 'CEF3_后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_前进', runtimeName: 'CEF3_前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_刷新', runtimeName: 'CEF3_刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_停止', runtimeName: 'CEF3_停止', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_取标题', runtimeName: 'CEF3_取标题', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取地址', runtimeName: 'CEF3_取地址', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取资源地址', runtimeName: 'CEF3_取资源地址', parameters: [{ name: '相对路径', type: 'wideString' }], returnType: 'wideString', encoding: 'wide', example: '局部 文本型 地址 = CEF3_取资源地址("index.html")\nCEF3_导航(浏览器1, 地址)' },
      { command: 'CEF3_设置缓存目录', runtimeName: 'CEF3_设置缓存目录', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '目录', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_设置代理', runtimeName: 'CEF3_设置代理', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_设置全局代理', runtimeName: 'CEF3_设置全局代理', parameters: [{ name: '代理地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_清除全局代理', runtimeName: 'CEF3_清除全局代理', parameters: [], returnType: 'int' },
      { command: 'CEF3_取全局代理', runtimeName: 'CEF3_取全局代理', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取实例代理', runtimeName: 'CEF3_取实例代理', parameters: [{ name: '实例编号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_创建', runtimeName: 'CEF3_创建', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_执行消息循环工作', runtimeName: 'LB_CEF3_DoMessageLoopWork', parameters: [], returnType: 'void' },
      { command: 'CEF3_关闭', runtimeName: 'CEF3_关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_取最近事件', runtimeName: 'CEF3_取最近事件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取事件数据', runtimeName: 'CEF3_取事件数据', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_取事件字段', runtimeName: 'CEF3_取事件字段', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '字段名', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'CEF3_读资源响应正文', runtimeName: 'CEF3_读资源响应正文', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '最大字节数', type: 'longLong' }, { name: '完成处理器', type: 'handler', description: '必须使用 &处理器名；只能在“资源响应到达”处理器中调用。' }], returnType: 'int', encoding: 'wide', example: 'CEF3_读资源响应正文(浏览器1, 1048576, &资源正文到达)' },
      { command: 'CEF3_替换资源响应内容', runtimeName: 'CEF3_替换资源响应内容', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '查找内容', type: 'wideString', description: '按 UTF-8 字节匹配的查找文本，不能为空。' }, { name: '替换内容', type: 'wideString', description: '替换后的文本；空文本表示删除查找内容。' }], returnType: 'int', encoding: 'wide', example: 'CEF3_替换资源响应内容(浏览器1, "原始价格", "会员价格")\nCEF3_导航(浏览器1, 地址)' },
      { command: 'CEF3_清除资源响应替换', runtimeName: 'CEF3_清除资源响应替换', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide', example: 'CEF3_清除资源响应替换(浏览器1)' },
      { command: 'CEF3_设置事件结果', runtimeName: 'CEF3_设置事件结果', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '结果', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_设置事件返回文本', runtimeName: 'CEF3_设置事件返回文本', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_绑定事件', runtimeName: 'CEF3_绑定事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString', description: '事件名' }, { name: '处理器', type: 'handler', description: '必须使用 &处理器名' }], returnType: 'int', encoding: 'wide', example: 'CEF3_绑定事件(浏览器1, "加载完成", &浏览器1_加载完成)' },
      { command: 'CEF3_启用JS扩展', runtimeName: 'CEF3_启用JS扩展', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '查询函数名', type: 'wideString', description: '页面调用的查询函数名，留空使用 cefQuery。' }, { name: '取消函数名', type: 'wideString', description: '页面取消查询的函数名，留空使用 cefQueryCancel。' }], returnType: 'int', encoding: 'wide', example: 'CEF3_启用JS扩展(浏览器1, "cefQuery", "cefQueryCancel")' },
      { command: 'CEF3_查询应答', runtimeName: 'CEF3_查询应答', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '查询ID', type: 'wideString', description: '「查询请求」事件 queryId 字段的数字文本，应答时原样传回。' }, { name: '结果文本', type: 'wideString', description: '回传给页面 onSuccess 的结果。' }], returnType: 'int', encoding: 'wide', example: 'CEF3_查询应答(浏览器1, CEF3_取事件字段(浏览器1, "queryId"), "完成")' },
      { command: 'CEF3_查询应答失败', runtimeName: 'CEF3_查询应答失败', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '查询ID', type: 'wideString', description: '「查询请求」事件 queryId 字段的数字文本，应答时原样传回。' }, { name: '错误码', type: 'int', description: '回传给页面 onFailure 的错误码，0 视为 -1。' }, { name: '错误文本', type: 'wideString', description: '回传给页面 onFailure 的错误说明。' }], returnType: 'int', encoding: 'wide', example: 'CEF3_查询应答失败(浏览器1, CEF3_取事件字段(浏览器1, "queryId"), -1, "本地没有对应数据")' },
      { command: 'CEF3_是否可后退', runtimeName: 'CEF3_是否可后退', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否可前进', runtimeName: 'CEF3_是否可前进', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否加载中', runtimeName: 'CEF3_是否加载中', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否有效', runtimeName: 'CEF3_是否有效', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否弹出窗口', runtimeName: 'CEF3_是否弹出窗口', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否同一实例', runtimeName: 'CEF3_是否同一实例', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '另一控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否有文档', runtimeName: 'CEF3_是否有文档', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否禁用窗口渲染', runtimeName: 'CEF3_是否禁用窗口渲染', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否网页全屏', runtimeName: 'CEF3_是否网页全屏', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否使用浏览器视图', runtimeName: 'CEF3_是否使用浏览器视图', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_取打开者浏览器ID', runtimeName: 'CEF3_取打开者浏览器ID', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否已准备关闭', runtimeName: 'CEF3_是否已准备关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否渲染进程无响应', runtimeName: 'CEF3_是否渲染进程无响应', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_取运行时样式', runtimeName: 'CEF3_取运行时样式', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_取缩放级别', runtimeName: 'CEF3_取缩放级别', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'double', encoding: 'wide' },
      { command: 'CEF3_取默认缩放级别', runtimeName: 'CEF3_取默认缩放级别', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'double', encoding: 'wide' },
      { command: 'CEF3_设置缩放级别', runtimeName: 'CEF3_设置缩放级别', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '级别', type: 'double' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否可缩放', runtimeName: 'CEF3_是否可缩放', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '缩放命令', type: 'int' }], returnType: 'int', encoding: 'wide', example: 'CEF3_是否可缩放(浏览器1, 2)' },
      { command: 'CEF3_执行缩放', runtimeName: 'CEF3_执行缩放', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '缩放命令', type: 'int' }], returnType: 'int', encoding: 'wide', example: 'CEF3_执行缩放(浏览器1, 2)' },
      { command: 'CEF3_尝试关闭', runtimeName: 'CEF3_尝试关闭', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_通知窗口移动或调整大小', runtimeName: 'CEF3_通知窗口移动或调整大小', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_通知屏幕信息已改变', runtimeName: 'CEF3_通知屏幕信息已改变', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_发送捕获丢失事件', runtimeName: 'CEF3_发送捕获丢失事件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_取消输入法组合文本', runtimeName: 'CEF3_取消输入法组合文本', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_完成输入法组合文本', runtimeName: 'CEF3_完成输入法组合文本', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '保留选择', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_完成输入法组合文本(浏览器1, 真)' },
      { command: 'CEF3_添加单词到词典', runtimeName: 'CEF3_添加单词到词典', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '单词', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_添加单词到词典(浏览器1, "LingBuilder")' },
      { command: 'CEF3_替换拼写错误', runtimeName: 'CEF3_替换拼写错误', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '单词', type: 'wideString' }], returnType: 'int', encoding: 'wide', example: 'CEF3_替换拼写错误(浏览器1, "LingBuilder")' },
      { command: 'CEF3_通知系统拖放结束', runtimeName: 'CEF3_通知系统拖放结束', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide', example: 'CEF3_通知系统拖放结束(浏览器1)' },
      { command: 'CEF3_通知拖放目标离开', runtimeName: 'CEF3_通知拖放目标离开', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide', example: 'CEF3_通知拖放目标离开(浏览器1)' },
      { command: 'CEF3_通知隐藏状态', runtimeName: 'CEF3_通知隐藏状态', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否隐藏', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_通知隐藏状态(浏览器1, 真)' },
      { command: 'CEF3_退出网页全屏', runtimeName: 'CEF3_退出网页全屏', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否调整大小', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_退出网页全屏(浏览器1, 真)' },
      { command: 'CEF3_强制刷新', runtimeName: 'CEF3_强制刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'void', encoding: 'wide' },
      { command: 'CEF3_页内查找', runtimeName: 'CEF3_页内查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }, { name: '向前', type: 'bool' }, { name: '区分大小写', type: 'bool' }, { name: '查找下一个', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_页内查找(浏览器1, "LingBuilder", 真, 假, 假)' },
      { command: 'CEF3_停止页内查找', runtimeName: 'CEF3_停止页内查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '清除选择', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_停止页内查找(浏览器1, 真)' },
      { command: 'CEF3_设置焦点', runtimeName: 'CEF3_设置焦点', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '是否聚焦', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_设置焦点(浏览器1, 真)' },
      { command: 'CEF3_发送鼠标单击事件', runtimeName: 'CEF3_发送鼠标单击事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'X', type: 'int' }, { name: 'Y', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '按钮类型', type: 'int' }, { name: '是否抬起', type: 'bool' }, { name: '单击次数', type: 'int' }], returnType: 'int', encoding: 'wide', example: 'CEF3_发送鼠标单击事件(浏览器1, 10, 10, 0, 0, 假, 1)' },
      { command: 'CEF3_发送鼠标移动事件', runtimeName: 'CEF3_发送鼠标移动事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'X', type: 'int' }, { name: 'Y', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '是否离开', type: 'bool' }], returnType: 'int', encoding: 'wide', example: 'CEF3_发送鼠标移动事件(浏览器1, 10, 10, 0, 假)' },
      { command: 'CEF3_发送鼠标滚轮事件', runtimeName: 'CEF3_发送鼠标滚轮事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'X', type: 'int' }, { name: 'Y', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '横向增量', type: 'int' }, { name: '纵向增量', type: 'int' }], returnType: 'int', encoding: 'wide', example: 'CEF3_发送鼠标滚轮事件(浏览器1, 10, 10, 0, 0, 120)' },
      { command: 'CEF3_发送触摸事件', runtimeName: 'CEF3_发送触摸事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '触点ID', type: 'int' }, { name: 'X', type: 'double' }, { name: 'Y', type: 'double' }, { name: '半径X', type: 'double' }, { name: '半径Y', type: 'double' }, { name: '旋转角度', type: 'double' }, { name: '压力', type: 'double' }, { name: '事件类型', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '指针类型', type: 'int' }], returnType: 'int', encoding: 'wide', example: 'CEF3_发送触摸事件(浏览器1, 0, 10.0, 10.0, 0.0, 0.0, 0.0, 0.5, 1, 0, 0)' },
      { command: 'CEF3_发送按键事件', runtimeName: 'CEF3_发送按键事件', parameters: [
        { name: '控件名', type: 'controlRef' }, { name: '类型', type: 'int' }, { name: '修饰键', type: 'longLong' },
        { name: 'Windows键码', type: 'int' }, { name: '原生键码', type: 'int' }, { name: '是否系统键', type: 'bool' },
        { name: '字符编码', type: 'int' }, { name: '未修改字符编码', type: 'int' }, { name: '焦点在可编辑字段', type: 'bool' }
      ], returnType: 'int', encoding: 'wide' },
      { command: 'CEF3_是否静音', runtimeName: 'CEF3_是否静音', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' }
    ] }
  },
  ...CEF3_SUBMODULES,
  {
    schemaVersion: 2,
    id: 'lingbuilder.fbro.browser',
    name: 'FBro指纹浏览器模块',
    version: '2.9.0',
    category: '界面',
    description: '通过隔离的 C ABI 桥接层使用 FBro/FBrowser CEF 135 x64，支持进程内、独立进程嵌入和独立顶层窗口三种宿主模式。',
    author: 'LingBuilder',
    tags: ['内置', 'FBro', 'FBrowser', '指纹浏览器', 'CEF135', 'x64'],
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
{ name: 'FBro_发送鼠标单击事件', aliases: ['LB_FBro_SendMouseClickEvent'], signature: 'FBro_发送鼠标单击事件(控件名, 按钮类型, 横坐标, 纵坐标, 修饰键, 是否抬起, 单击次数)', description: '在浏览器内指定坐标合成一次真实鼠标点击（走内核输入管线，等效真实用户点击）。按钮类型 0=左键 1=中键 2=右键；双击传单击次数 2。', insertText: 'FBro_发送鼠标单击事件($1, 0, 120, 240, 0, 假, 1)', returnType: '整数型' },
{ name: 'FBro_发送鼠标移动事件', aliases: ['LB_FBro_SendMouseMoveEvent'], signature: 'FBro_发送鼠标移动事件(控件名, 横坐标, 纵坐标, 修饰键, 是否离开)', description: '在浏览器内合成鼠标移动事件；是否离开为真表示鼠标移出浏览器视图。', insertText: 'FBro_发送鼠标移动事件($1, 120, 240, 0, 假)', returnType: '整数型' },
{ name: 'FBro_发送鼠标滚轮事件', aliases: ['LB_FBro_SendMouseWheelEvent'], signature: 'FBro_发送鼠标滚轮事件(控件名, 横坐标, 纵坐标, 修饰键, 横向增量, 纵向增量)', description: '在浏览器内合成鼠标滚轮滚动；增量正值向上/向左，负值向下/向右。', insertText: 'FBro_发送鼠标滚轮事件($1, 120, 240, 0, 0, 120)', returnType: '整数型' },
{ name: 'FBro_发送按键事件', aliases: ['LB_FBro_SendKeyEvent'], signature: 'FBro_发送按键事件(控件名, 事件类型, 修饰键, Windows键码, 原生键码, 是否系统键, 字符编码, 未修改字符编码, 焦点在可编辑字段)', description: '向浏览器合成按键事件（真实输入管线，可触发 isTrusted 按键）。事件类型 0=原始按下 1=按下 2=释放 3=字符输入；字符编码低 8 位为低字节、高 8 位为高字节。', insertText: 'FBro_发送按键事件($1, 3, 0, 0, 0, 假, 65, 65, 假)', returnType: '整数型' },
{ name: 'FBro_发送触摸事件', aliases: ['LB_FBro_SendTouchEvent'], signature: 'FBro_发送触摸事件(控件名, 事件类型, 修饰键, 指针类型, 触点ID, 横坐标, 纵坐标, 半径X, 半径Y, 旋转角度, 压力)', description: '向浏览器合成触摸事件（触点型输入）。压力范围 0~1；旋转角度单位为弧度。', insertText: 'FBro_发送触摸事件($1, 1, 0, 0, 0, 120.0, 240.0, 4.0, 4.0, 0.0, 0.5)', returnType: '整数型' },
        { name: 'FBro_查找', aliases: ['LB_FBro_Find'], signature: 'FBro_查找(控件名, 文本, 向前, 区分大小写, 查找下一个)', description: '在当前页面中查找文本。', insertText: 'FBro_查找($1, "$2", 真, 假, 假)', returnType: '整数型' },
        { name: 'FBro_停止查找', aliases: ['LB_FBro_StopFinding'], signature: 'FBro_停止查找(控件名, 清除选择)', description: '停止页面查找并可选清除当前选择。', insertText: 'FBro_停止查找($1, 真)', returnType: '整数型' },
        { name: 'FBro_是否打开开发者工具', aliases: ['LB_FBro_HasDevTools'], signature: 'FBro_是否打开开发者工具(控件名)', description: '返回指定浏览器是否已有 DevTools 实例。', insertText: 'FBro_是否打开开发者工具($1)', returnType: '整数型' },
        { name: 'FBro_关闭开发者工具', aliases: ['LB_FBro_CloseDevTools'], signature: 'FBro_关闭开发者工具(控件名)', description: '关闭指定浏览器的 DevTools。', insertText: 'FBro_关闭开发者工具($1)', returnType: '整数型' },
        { name: 'FBro_强制刷新', aliases: ['LB_FBro_ReloadIgnoreCache'], signature: 'FBro_强制刷新(控件名)', description: '忽略缓存重新加载当前页面。', insertText: 'FBro_强制刷新($1)', returnType: '整数型' },
        { name: 'FBro_取浏览器标识', aliases: ['LB_FBro_GetIdentifier'], signature: 'FBro_取浏览器标识(控件名)', description: '返回 FBro/CEF 分配的浏览器标识。', insertText: 'FBro_取浏览器标识($1)', returnType: '整数型' },
        { name: 'FBro_是否同一实例', aliases: ['LB_FBro_IsSame'], signature: 'FBro_是否同一实例(控件名, 另一控件名)', description: '判断两个受管控件是否引用同一个底层浏览器。', insertText: 'FBro_是否同一实例($1, $2)', returnType: '整数型' },
        { name: 'FBro_是否弹出窗口', aliases: ['LB_FBro_IsPopup'], signature: 'FBro_是否弹出窗口(控件名)', description: '返回底层浏览器是否为 popup。', insertText: 'FBro_是否弹出窗口($1)', returnType: '整数型' },
        { name: 'FBro_取主浏览器', aliases: ['LB_FBro_BrowserHostGetMainBrowser'], signature: 'FBro_取主浏览器(控件名)', description: '返回弹出窗口所属主浏览器的已登记实例句柄（长整数）；本实例即主浏览器时返回自身句柄，未知浏览器返回 0。', insertText: 'FBro_取主浏览器($1)', returnType: '长整数型' },
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
        { name: 'FBro_替换资源响应内容', signature: 'FBro_替换资源响应内容(控件名, 地址, 内容)', description: '按地址精确匹配，把匹配资源的响应整体替换为 UTF-8 文本内容（类型 text/html）。需 FBro VIP 授权且浏览器已创建；重复调用同地址以最后一次为准，不清空其它规则。', insertText: 'FBro_替换资源响应内容($1, "https://www.example.com/target", "<h1>已替换</h1>")', returnType: '整数型' },
        { name: 'FBro_替换资源响应文件', signature: 'FBro_替换资源响应文件(控件名, 地址, 文件路径)', description: '按地址精确匹配，把匹配资源的响应整体替换为本地文件内容，MIME 按扩展名推断（html/css/js/json/图片等，缺省 application/octet-stream）。需 FBro VIP 授权且浏览器已创建；支持绝对路径或程序目录相对路径。', insertText: 'FBro_替换资源响应文件($1, "https://www.example.com/target", "替换页.html")', returnType: '整数型' },
        { name: 'FBro_清除资源响应替换', signature: 'FBro_清除资源响应替换(控件名, 地址)', description: '删除指定地址的响应替换规则，恢复原始响应。', insertText: 'FBro_清除资源响应替换($1, "https://www.example.com/target")', returnType: '整数型' },
        { name: 'FBro_清空资源响应替换', signature: 'FBro_清空资源响应替换(控件名)', description: '清空该浏览器的全部响应替换规则。', insertText: 'FBro_清空资源响应替换($1)', returnType: '整数型' },
        { name: 'FBro_替换资源响应文本', aliases: ['LB_FBro_ResourceReplaceSet'], signature: 'FBro_替换资源响应文本(控件名, 查找内容, 替换内容)', description: '为指定浏览器配置响应正文查找替换：之后加载的资源正文按 UTF-8 字节匹配“查找内容”，命中处流式改写为“替换内容”（空文本表示删除）。二进制安全、不重新发起请求，对整只浏览器全部资源生效；重复调用以最后一次为准，正在加载的资源不受影响。无需 FBro VIP 授权。只修改响应正文，不改变响应头和状态码。', insertText: 'FBro_替换资源响应文本($1, "原始文本", "替换文本")', returnType: '整数型' },
        { name: 'FBro_清除资源响应文本替换', aliases: ['LB_FBro_ResourceReplaceClear'], signature: 'FBro_清除资源响应文本替换(控件名)', description: '移除指定 FBro 浏览器当前的响应正文查找替换配置，之后加载的资源恢复原始正文；已加载页面不受影响。无需 FBro VIP 授权。', insertText: 'FBro_清除资源响应文本替换($1)', returnType: '整数型' },
        { name: 'FBro指纹_应用配置', aliases: ['LB_FBro_ApplyFingerprintJson'], signature: 'FBro指纹_应用配置(控件名, JSON)', description: '应用结构化指纹 JSON；未配置 VIP 授权时返回 0 并记录中文错误。', insertText: 'FBro指纹_应用配置($1, "$2")', returnType: '整数型' },
        { name: 'FBro指纹_取调用次数', aliases: ['LB_FBro_GetFingerprintCallCount'], signature: 'FBro指纹_取调用次数(控件名)', description: '返回 FBro VIP 指纹调用次数。', insertText: 'FBro指纹_取调用次数($1)', returnType: '文本型' },
        { name: 'FBro指纹_清空调用次数', aliases: ['LB_FBro_ClearFingerprintCallCount'], signature: 'FBro指纹_清空调用次数(控件名)', description: '清空指定浏览器的指纹调用次数。', insertText: 'FBro指纹_清空调用次数($1)', returnType: '整数型' },
        { name: 'FBro_取最近事件', aliases: ['LB_FBro_GetLastEvent'], signature: 'FBro_取最近事件(控件名)', description: '返回最近 FBro 浏览器事件名。', insertText: 'FBro_取最近事件($1)', returnType: '文本型' },
        { name: 'FBro_取最近错误', aliases: ['LB_FBro_GetLastError'], signature: 'FBro_取最近错误(控件名)', description: '返回桥接层最近中文错误。', insertText: 'FBro_取最近错误($1)', returnType: '文本型' },
        { name: 'FBro_取进程状态', signature: 'FBro_取进程状态(控件名)', description: '返回独立进程实例状态；进程内模式返回“进程内”。', insertText: 'FBro_取进程状态($1)', returnType: '文本型' },
        { name: 'FBro_取进程ID', signature: 'FBro_取进程ID(控件名)', description: '返回独立 FBro Host 的进程 ID；进程内模式返回 0。', insertText: 'FBro_取进程ID($1)', returnType: '整数型' },
        { name: 'FBro_取调试端口', signature: 'FBro_取调试端口(控件名)', description: '返回本机 CDP 调试端口：独立进程返回 Host 端口；进程内模式在初始化时按控件 enableDevTools 属性决定是否预留回环端口（任一进程内控件启用即开启）。返回 0 表示尚未初始化、未启用开发者工具或端口预留失败。', insertText: 'FBro_取调试端口($1)', returnType: '整数型' },
        { name: 'FBro_重启进程', signature: 'FBro_重启进程(控件名)', description: '关闭并重新启动独立 FBro Host，保留该控件的配置与独立 Profile。', insertText: 'FBro_重启进程($1)', returnType: '整数型' },
        { name: 'FBro_显示', signature: 'FBro_显示(控件名)', description: '显示独立浏览器窗口或嵌入宿主。', insertText: 'FBro_显示($1)', returnType: '整数型' },
        { name: 'FBro_隐藏', signature: 'FBro_隐藏(控件名)', description: '隐藏独立浏览器窗口或嵌入宿主。', insertText: 'FBro_隐藏($1)', returnType: '整数型' },
        { name: 'FBro_是否显示', signature: 'FBro_是否显示(控件名)', description: '返回 FBro 嵌入宿主当前是否可见；可用于过滤后台实例事件。', insertText: 'FBro_是否显示($1)', returnType: '整数型' },
        { name: 'FBro_调整大小', signature: 'FBro_调整大小(控件名, 宽度, 高度)', description: '调整独立浏览器客户区大小。', insertText: 'FBro_调整大小($1, 960, 640)', returnType: '整数型' },
        { name: 'FBro_截图到文件', signature: 'FBro_截图到文件(控件名, 路径, 格式, 质量)', description: '同步保存当前页面截图；格式为 png/jpeg/webp，质量范围 1-100。', insertText: 'FBro_截图到文件($1, "$2", "png", 90)', returnType: '整数型' },
        { name: 'FBro_取窗口句柄', aliases: ['LB_FBro_GetWindowHandle'], signature: 'FBro_取窗口句柄(控件名)', description: '返回浏览器底层窗口 HWND（长整数）；窗口尚未创建时返回 0。', insertText: 'FBro_取窗口句柄($1)', returnType: '长整数型' },
        { name: 'FBro_取打开者窗口句柄', aliases: ['LB_FBro_GetOpenerWindowHandle'], signature: 'FBro_取打开者窗口句柄(控件名)', description: '返回创建该浏览器的打开者窗口 HWND；无打开者时返回 0。', insertText: 'FBro_取打开者窗口句柄($1)', returnType: '长整数型' },
        { name: 'FBro_取父窗口句柄', aliases: ['LB_FBro_GetParentWindowHandle'], signature: 'FBro_取父窗口句柄(控件名)', description: '返回浏览器窗口的父窗口 HWND。', insertText: 'FBro_取父窗口句柄($1)', returnType: '长整数型' },
        { name: 'FBro_取运行时样式', aliases: ['LB_FBro_GetRuntimeStyle'], signature: 'FBro_取运行时样式(控件名)', description: '返回官方运行时样式（0=Alloy，1=Chrome）。', insertText: 'FBro_取运行时样式($1)', returnType: '整数型' },
        { name: 'FBro_取SDK版本JSON', aliases: ['LB_FBro_GetSdkVersionJson'], signature: 'FBro_取SDK版本JSON()', description: '返回官方 SDK 版本 JSON（main/edit/debug 三个整数字段）。', insertText: 'FBro_取SDK版本JSON()', returnType: '文本型' },
        { name: 'FBro_取实例数量', aliases: ['LB_FBro_GetInstanceCount'], signature: 'FBro_取实例数量()', description: '返回桥接层当前存活的 FBro 浏览器实例数量。', insertText: 'FBro_取实例数量()', returnType: '整数型' },
        { name: 'FBro_取实例句柄列表JSON', aliases: ['LB_FBro_GetInstanceHandlesJson'], signature: 'FBro_取实例句柄列表JSON()', description: '返回桥接层当前存活实例句柄的 JSON 数组，如 [1,2]。', insertText: 'FBro_取实例句柄列表JSON()', returnType: '文本型' },
        { name: 'FBro_取实例标记列表JSON', aliases: ['LB_FBro_GetInstanceFlagsJson'], signature: 'FBro_取实例标记列表JSON()', description: '返回桥接层当前存活实例创建标记的 JSON 字符串数组；进程内实例标记即实例句柄字符串。', insertText: 'FBro_取实例标记列表JSON()', returnType: '文本型' },
        { name: 'FBro_是否存活', aliases: ['LB_FBro_IsInstanceAlive'], signature: 'FBro_是否存活(控件名)', description: '返回指定控件对应的底层浏览器是否仍然存活（未创建或已关闭返回 0）。', insertText: 'FBro_是否存活($1)', returnType: '整数型' },
        { name: 'FBro_显示开发者工具窗口', aliases: ['LB_FBro_ShowDevToolsWindowAsync'], signature: 'FBro_显示开发者工具窗口(控件名, 标题, X, Y, 宽度, 高度)', description: '打开官方 DevTools 顶层窗口（异步任务）；位置尺寸用默认值可全传 0。返回任务句柄，用 FBro任务_* 读取。', insertText: 'FBro_显示开发者工具窗口($1, "开发者工具", 0, 0, 0, 0)', returnType: '长整数型' },
        { name: 'FBro_移动浏览器窗口', aliases: ['LB_FBro_MoveBrowserWindowAsync'], signature: 'FBro_移动浏览器窗口(控件名, X, Y, 宽度, 高度)', description: '在 UI 线程移动浏览器底层窗口（异步任务）；嵌入模式下通常改用设计器布局。返回任务句柄，用 FBro任务_* 读取。', insertText: 'FBro_移动浏览器窗口($1, 100, 100, 960, 640)', returnType: '长整数型' },
        { name: 'FBro_取创建标记', aliases: ['LB_FBro_GetBrowserFlag'], signature: 'FBro_取创建标记(控件名)', description: '返回浏览器创建时传入的官方标记字符串。', insertText: 'FBro_取创建标记($1)', returnType: '文本型' },
        { name: 'FBro_取附加信息JSON', aliases: ['LB_FBro_GetBrowserExtraInfoJson'], signature: 'FBro_取附加信息JSON(控件名)', description: '返回浏览器创建期附加信息字典的 UTF-16 JSON；未设置时返回 {}。', insertText: 'FBro_取附加信息JSON($1)', returnType: '文本型' },
        { name: 'FBro_后台创建', aliases: ['LB_FBro_CreateBackground'], signature: 'FBro_后台创建(地址, 缓存目录, 附加信息JSON)', description: '创建无窗口承载的后台浏览器实例并返回实例句柄；事件照常分发，可用 FBro事件_* 与句柄命令操作。附加信息 JSON 传空跳过。', insertText: 'FBro_后台创建("https://www.baidu.com", "", "")', returnType: '整数型' },
        { name: 'FBro_取启动命令行', aliases: ['LB_FBro_GetStartupCommandLine'], signature: 'FBro_取启动命令行()', description: '返回初始化时按控件启动开关构建的官方命令行文本；未启用任何开关时为空。', insertText: 'FBro_取启动命令行()', returnType: '文本型' },
        { name: 'FBro_设置启动开关JSON', aliases: ['LB_FBro_SetStartupSwitches'], signature: 'FBro_设置启动开关JSON(开关JSON)', description: '声明进程级 CEF 启动命令行开关：开关只在浏览器初始化前的 OnBeforeCommandLineProcessing 应用一次，因此本命令必须写成调用处的字面 JSON 文本，生成器把它烘焙进初始化代码（与 FBro_启用无头模式 同范式）；运行期调用不改变进程状态，返回 1 表示本次声明已烘焙生效、0 表示未烘焙。可用键（值只能是 true/false）：disableGpu、disableGpuCache、disableGpuBlockList、enableMediaStream、enableSpeechInput、enableAutoplay、headless、enableCrossFrame（官方跨域模式，跨框架/跨域操作）、disableProxy；白名单外的键或非法 JSON 会在生成前中文阻断，禁止借本命令传任意 Chromium 开关。设计器 FBroBrowser 控件的同名启动开关属性是同一份配置的图形入口，两者冲突时以本命令的字面声明为准。作用范围红线：9 个键**仅进程内模式生效**（独立进程 Host 由零参数启动、开关未透传），且开关是进程级的——放开后本进程所有进程内实例都受影响，跨域只在受控内网或自有页面使用；跨内核选型见「跨域/同源策略放开三内核选型」：CEF3 有逐条跨域白名单命令，EdgeView 用创建期属性/环境变量开关。', insertText: 'FBro_设置启动开关JSON("{\\"enableCrossFrame\\":true}")', returnType: '整数型' },
        { name: 'FBro_启用无头模式', aliases: [], signature: 'FBro_启用无头模式()', description: '声明本程序以无头模式启动：该开关是 CEF 进程级启动命令行开关，生成器在生成期烘焙进初始化代码（必须在 CEF 初始化前生效，运行期调用点不改变进程状态），返回 1 表示已烘焙无头模式、0 表示未启用。无头模式下本进程所有进程内浏览器均无窗口渲染，禁止与可见 FBroBrowser 控件混用；无窗口创建浏览器请用 FBro_后台创建。', insertText: 'FBro_启用无头模式()', returnType: '整数型' },
        { name: 'FBro_实例导航', signature: 'FBro_实例导航(实例句柄, 地址)', description: '让 FBro_后台创建 返回的后台实例句柄直接导航，返回桥接成功码；不依赖控件名与消息泵，控制台无头场景可用。', insertText: 'FBro_实例导航($1, "https://www.baidu.com")', returnType: '整数型' },
        { name: 'FBro_实例等待加载超时', signature: 'FBro_实例等待加载超时(实例句柄, 超时毫秒)', description: '轮询等待后台实例加载完成，成功返回 1、超时或句柄无效返回 0；控制台等无消息循环场景同样可用，超时上限 600000 毫秒。', insertText: 'FBro_实例等待加载超时($1, 15000)', returnType: '整数型' },
        { name: 'FBro_实例执行JS', signature: 'FBro_实例执行JS(实例句柄, 脚本)', description: '在后台实例句柄上同步执行 JavaScript 并返回 UTF-16 结果文本；建议先 FBro_实例等待加载超时 再取 document.title、location.href 等。', insertText: 'FBro_实例执行JS($1, "document.title")', returnType: '文本型' },
        { name: 'FBro_实例是否存活', signature: 'FBro_实例是否存活(实例句柄)', description: '返回后台实例句柄是否仍存活；已关闭或句柄无效返回 0。', insertText: 'FBro_实例是否存活($1)', returnType: '整数型' },
        { name: 'FBro_实例关闭', signature: 'FBro_实例关闭(实例句柄)', description: '关闭并销毁 FBro_后台创建 建立的后台实例；这是进程内最后一个浏览器时桥接层会随之收尾。', insertText: 'FBro_实例关闭($1)', returnType: '整数型' },
        { name: 'FBro_实例绑定事件', signature: 'FBro_实例绑定事件(实例句柄, 事件名, &处理器)', description: '窗口程序为后台实例句柄绑定中文事件处理器（事件经属窗消息泵派发）；控制台程序没有消息泵，处理器不会触发，请改用 FBro_实例等待加载超时 与 FBro_实例执行JS 同步读取。', insertText: 'FBro_实例绑定事件($1, "LoadEnd", &$2)', returnType: '整数型' },
        { name: 'FBro_实例取最近事件', signature: 'FBro_实例取最近事件(实例句柄)', description: '返回后台实例句柄最近一次已派发事件的事件名；无事件记录返回空文本。', insertText: 'FBro_实例取最近事件($1)', returnType: '文本型' },
        { name: 'FBro_实例取事件数据', signature: 'FBro_实例取事件数据(实例句柄)', description: '返回后台实例句柄最近一次事件的 data 文本（标题、地址、错误说明等随事件而定）；无事件记录返回空文本。', insertText: 'FBro_实例取事件数据($1)', returnType: '文本型' },
        { name: 'FBro_启用JS扩展', aliases: ['LB_FBro_EnableJsQuery'], signature: 'FBro_启用JS扩展(查询函数名, 取消函数名)', description: '注册页面调用原生函数通道，可多次调用注册多条通道（如 cefQuery 与 cefQuerytest），全部通道共用同一个 OnQuery 处理器。页面执行 查询函数名(请求文本) 触发 OnQuery 事件：用 FBro_取事件字段 读 request，用 FBro事件_完成延续 回传 {"success":true,"result":"..."} 或 {"success":false,"error":"..."}。必须在首个浏览器初始化前调用；窗口程序建议改用 FBroBrowser 控件属性 jsQueryFunctions（格式 cefQuery,cefQueryCancel;cefQuerytest,cefQueryCanceltest）在生成期自动注册。', insertText: 'FBro_启用JS扩展("cefQuery", "cefQueryCancel")', returnType: '整数型' },
        { name: '浏览器管理器_初始化', signature: '浏览器管理器_初始化(页面选项卡, 实例列表, 工作区键)', description: '绑定普通 Win32 隐藏表头选项卡和列表框，恢复独立实例并为每个实例启动一个 FBro Host。', insertText: '浏览器管理器_初始化($1, $2, "$3")', returnType: '整数型' },
        { name: '浏览器管理器_绑定地址栏', signature: '浏览器管理器_绑定地址栏(地址控件)', description: '绑定当前窗口文本框；网页地址事件和实例切换会直接同步真实当前地址。', insertText: '浏览器管理器_绑定地址栏($1)', returnType: '逻辑型' },
        { name: '浏览器管理器_绑定下载视图', signature: '浏览器管理器_绑定下载视图(详情控件, 进度条)', description: '绑定只读文本框或标签及原生进度条；下载事件到达和实例切换时实时显示当前实例的文件、目录、百分比与完成状态。', insertText: '浏览器管理器_绑定下载视图($1, $2)', returnType: '逻辑型' },
        { name: '浏览器管理器_新增实例', signature: '浏览器管理器_新增实例(名称, 地址)', description: '生成稳定 ID、独立页面 HWND 和独立 Profile，并启动新的嵌入式 FBro Host。', insertText: '浏览器管理器_新增实例("浏览器 $1", "https://www.baidu.com")', returnType: '逻辑型' },
        { name: '浏览器管理器_切换索引', signature: '浏览器管理器_切换索引(索引)', description: '按左侧列表索引切换实例；先显示并聚焦目标页面，再隐藏其它页面。', insertText: '浏览器管理器_切换索引($1)', returnType: '逻辑型' },
        { name: '浏览器管理器_重命名当前', signature: '浏览器管理器_重命名当前(名称)', description: '重命名当前实例，不改变稳定 ID、Profile 或登录状态。', insertText: '浏览器管理器_重命名当前("$1")', returnType: '逻辑型' },
        { name: '浏览器管理器_删除当前', signature: '浏览器管理器_删除当前(清除数据)', description: '删除当前实例并可选二次确认清除受管 Profile；始终保留至少一个实例。', insertText: '浏览器管理器_删除当前($1)', returnType: '文本型' },
        { name: '浏览器管理器_导航', signature: '浏览器管理器_导航(地址)', description: '让当前独立 Host 导航并持久化最后地址，不限制协议；chrome://extensions/ 在嵌入式 Alloy 模式中显示 LingBuilder 的真实扩展检查页。', insertText: '浏览器管理器_导航("$1")', returnType: '逻辑型' },
        { name: '浏览器管理器_后退', signature: '浏览器管理器_后退()', description: '当前实例后退。', insertText: '浏览器管理器_后退()', returnType: '逻辑型' },
        { name: '浏览器管理器_前进', signature: '浏览器管理器_前进()', description: '当前实例前进。', insertText: '浏览器管理器_前进()', returnType: '逻辑型' },
        { name: '浏览器管理器_刷新', signature: '浏览器管理器_刷新()', description: '刷新当前实例。', insertText: '浏览器管理器_刷新()', returnType: '逻辑型' },
        { name: '浏览器管理器_停止', signature: '浏览器管理器_停止()', description: '停止当前实例加载。', insertText: '浏览器管理器_停止()', returnType: '逻辑型' },
        { name: '浏览器管理器_强制刷新', signature: '浏览器管理器_强制刷新()', description: '忽略缓存刷新当前实例。', insertText: '浏览器管理器_强制刷新()', returnType: '逻辑型' },
        { name: '浏览器管理器_打开当前缓存目录', signature: '浏览器管理器_打开当前缓存目录()', description: '打开通过规范路径和重解析点边界校验的当前 Profile。', insertText: '浏览器管理器_打开当前缓存目录()', returnType: '逻辑型' },
        { name: '浏览器管理器_打开当前下载目录', signature: '浏览器管理器_打开当前下载目录()', description: '验证最近下载目录真实存在后，在 Windows 文件资源管理器中打开。', insertText: '浏览器管理器_打开当前下载目录()', returnType: '逻辑型' },
        { name: '浏览器管理器_清理当前缓存', signature: '浏览器管理器_清理当前缓存(包含Cookie)', description: '调用当前 FBro Host 清理真实缓存；包含 Cookie 时同时清理登录和插件存储。', insertText: '浏览器管理器_清理当前缓存($1)', returnType: '逻辑型' },
        { name: '浏览器管理器_导出Cookie', signature: '浏览器管理器_导出Cookie(文件, 全部网站)', description: '预览数量和敏感信息警告后，从当前 Host 的 CookieManager 原子导出结构化 JSON。', insertText: '浏览器管理器_导出Cookie("cookies.lingbuilder.json", $1)', returnType: '文本型' },
        { name: '浏览器管理器_导入Cookie', signature: '浏览器管理器_导入Cookie(文件, 覆盖冲突)', description: '预览有效、无效、过期、域名和冲突统计后写入当前 Host，并刷新页面。', insertText: '浏览器管理器_导入Cookie("cookies.lingbuilder.json", $1)', returnType: '文本型' },
        { name: '浏览器管理器_取当前稳定ID', signature: '浏览器管理器_取当前稳定ID()', description: '返回当前实例稳定 ID。', insertText: '浏览器管理器_取当前稳定ID()', returnType: '文本型' },
        { name: '浏览器管理器_取当前名称', signature: '浏览器管理器_取当前名称()', description: '返回当前实例显示名称。', insertText: '浏览器管理器_取当前名称()', returnType: '文本型' },
        { name: '浏览器管理器_取当前地址', signature: '浏览器管理器_取当前地址()', description: '返回当前实例最后地址。', insertText: '浏览器管理器_取当前地址()', returnType: '文本型' },
        { name: '浏览器管理器_取当前插件状态', signature: '浏览器管理器_取当前插件状态()', description: '返回当前实例扩展登记及豆包页面 DOM 生效检查状态。', insertText: '浏览器管理器_取当前插件状态()', returnType: '文本型' },
        { name: '浏览器管理器_取当前插件错误', signature: '浏览器管理器_取当前插件错误()', description: '返回当前实例插件清单或加载错误。', insertText: '浏览器管理器_取当前插件错误()', returnType: '文本型' },
        { name: '浏览器管理器_取当前下载状态', signature: '浏览器管理器_取当前下载状态()', description: '返回当前实例最近下载的准备、进度、完成或取消状态。', insertText: '浏览器管理器_取当前下载状态()', returnType: '文本型' },
        { name: '浏览器管理器_取当前下载文件', signature: '浏览器管理器_取当前下载文件()', description: '返回当前实例最近下载的文件名。', insertText: '浏览器管理器_取当前下载文件()', returnType: '文本型' },
        { name: '浏览器管理器_取当前下载完整路径', signature: '浏览器管理器_取当前下载完整路径()', description: '返回 FBro 报告的当前实例最近下载完整路径。', insertText: '浏览器管理器_取当前下载完整路径()', returnType: '文本型' },
        { name: '浏览器管理器_取当前下载目录', signature: '浏览器管理器_取当前下载目录()', description: '返回从最近下载完整路径解析出的目录。', insertText: '浏览器管理器_取当前下载目录()', returnType: '文本型' },
        { name: '浏览器管理器_取当前错误', signature: '浏览器管理器_取当前错误()', description: '返回当前实例最近的 Host 错误。', insertText: '浏览器管理器_取当前错误()', returnType: '文本型' },
        { name: '浏览器管理器_取持久化诊断', signature: '浏览器管理器_取持久化诊断()', description: '返回损坏恢复、重复实例或原子写入诊断。', insertText: '浏览器管理器_取持久化诊断()', returnType: '文本型' },
        { name: '浏览器管理器_取当前缓存目录', signature: '浏览器管理器_取当前缓存目录()', description: '返回当前实例由稳定 ID 派生的本机 Profile 目录。', insertText: '浏览器管理器_取当前缓存目录()', returnType: '文本型' },
        { name: '浏览器管理器_取当前进程状态', signature: '浏览器管理器_取当前进程状态()', description: '返回当前独立 Host 状态。', insertText: '浏览器管理器_取当前进程状态()', returnType: '文本型' },
        { name: '浏览器管理器_取当前进程ID', signature: '浏览器管理器_取当前进程ID()', description: '返回当前独立 Host PID。', insertText: '浏览器管理器_取当前进程ID()', returnType: '整数型' },
        { name: '浏览器管理器_取当前页面句柄', signature: '浏览器管理器_取当前页面句柄()', description: '返回当前实例独立页面 HWND，仅用于诊断生命周期。', insertText: '浏览器管理器_取当前页面句柄()', returnType: '长整数型' },
        { name: '浏览器管理器_取实例数量', signature: '浏览器管理器_取实例数量()', description: '返回当前实例数量。', insertText: '浏览器管理器_取实例数量()', returnType: '整数型' },
        { name: '浏览器管理器_取实例顺序JSON', signature: '浏览器管理器_取实例顺序JSON()', description: '返回稳定 ID 顺序 JSON。', insertText: '浏览器管理器_取实例顺序JSON()', returnType: '文本型' },
        { name: '浏览器管理器_取运行快照JSON', signature: '浏览器管理器_取运行快照JSON()', description: '返回不含 Cookie 的 ID、Profile、页面 HWND、PID 和插件状态诊断快照。', insertText: '浏览器管理器_取运行快照JSON()', returnType: '文本型' },
        { name: 'FBro_创建区域', signature: 'FBro_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 缓存目录, 代理地址, 用户代理)', description: '在普通 Win32 宿主窗口客户区的指定矩形内动态内嵌一个独立进程 FBro 浏览器（不依赖 new_emoji），每个实例编号拥有独立 Profile/缓存/代理/UA，可多次调用创建任意数量区域。返回 1 表示成功、0 表示失败。实例编号需唯一；左/顶/宽/高为逻辑坐标（按 DPI 自动缩放）；缓存目录留空时自动按编号派生；代理地址与用户代理留空表示使用默认。', insertText: 'FBro_创建区域($1, $2, $3, $4, $5, "https://www.baidu.com", "", "", "")', returnType: '整数型' },
        { name: 'FBro_取区域实例JSON', signature: 'FBro_取区域实例JSON()', description: '返回由 FBro_创建区域 建出的全部动态内嵌区域实例的紧凑 JSON（实例编号、地址、矩形与运行状态），用于枚举当前内嵌浏览器。', insertText: 'FBro_取区域实例JSON()', returnType: '文本型' },
        { name: 'FBro_关闭全部区域', signature: 'FBro_关闭全部区域()', description: '关闭并销毁全部由 FBro_创建区域 建出的动态内嵌区域实例，返回关闭数量。', insertText: 'FBro_关闭全部区域()', returnType: '整数型' }
      ],
      types: [{ name: 'FBro浏览器', description: '由 LingBuilderFbroBridge 管理的不透明 FBro 浏览器句柄。', cppType: 'LB_FBRO_HANDLE' }],
      snippets: [{ label: 'FBro 指纹浏览器基础操作', insertText: 'FBro_创建(FBro浏览器1)\nFBro_导航(FBro浏览器1, "https://www.baidu.com")\n调试输出(FBro_取地址(FBro浏览器1))', description: '创建 FBro 控件并导航。' }, { label: 'FBro 无头后台抓取（控制台/窗口通用）', insertText: 'FBro_启用无头模式()\n局部 长整数型 实例\n实例 = FBro_后台创建("https://www.baidu.com", "", "")\n调试输出("加载完成=", FBro_实例等待加载超时(实例, 15000))\n调试输出("标题=", FBro_实例执行JS(实例, "document.title"))\nFBro_实例关闭(实例)', description: '声明进程级无头模式后用后台实例句柄同步抓取页面（控制台无消息泵时的标准取数链路）；无头模式与进程内可见 FBroBrowser 控件互斥，设计器场景改用「FBro无头浏览器」组件。' }, { label: 'FBro 跨域前置开关与命令行回读', insertText: 'FBro_设置启动开关JSON("{\\"enableCrossFrame\\":true}")\nFBro_创建(FBro浏览器1)\nFBro_导航(FBro浏览器1, "https://example.com")\n调试输出("命令行=", FBro_取启动命令行())', description: '跨源 iframe 读取前置：开关文本必须是调用处的字面 JSON（生成期烘焙进初始化，仅进程内模式生效），放开后本进程所有进程内实例都不再受同源限制，只在受控内网或自有页面使用；用 FBro_取启动命令行 回读实际生效命令行做正反对照，取值/填表走 FBro框架_* 与 FBro填表_*。' }, { label: 'FBro 动态内嵌多店铺区域', insertText: 'FBro_创建区域(1, 10, 60, 600, 500, "https://www.example.com", ".fbro-region/store-a", "", "")\nFBro_创建区域(2, 630, 60, 600, 500, "https://www.example.com", ".fbro-region/store-b", "http://127.0.0.1:7890", "")\n调试输出(FBro_取区域实例JSON())\nFBro_关闭全部区域()', description: '在普通 Win32 窗口客户区两个矩形各内嵌一个独立进程 FBro 浏览器（各自独立缓存/代理，不依赖 new_emoji），用 FBro_取区域实例JSON 枚举、FBro_关闭全部区域 回收。注意：用户代理参数只改 navigator.userAgent，不改出站 HTTP 头。' }],
      docs: [
        { title: 'FBro 事件与接口参考', path: 'docs/modules/fbro/README.md' },
        { title: 'FBro SDK 安装与环境检查', path: 'docs/modules/fbro/installation.md' },
        { title: 'FBroBrowser 控件与进程模式', path: 'docs/modules/fbro/control.md' },
        { title: 'FBro 示例与故障排查', path: 'docs/modules/fbro/examples.md' }
      ]
    },
    targets: [{
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      includeDirs: ['include'], headers: ['include/LingBuilderFbroBridge.h', 'include/LingBuilderFbroProcessRuntime.hpp'],
      libs: ['lib/x64/LingBuilderFbroBridge.lib'],
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
{ command: 'FBro_发送鼠标单击事件', runtimeName: 'FBro_发送鼠标单击事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '按钮类型', type: 'int' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '是否抬起', type: 'bool' }, { name: '单击次数', type: 'int' }], returnType: 'int', encoding: 'wide' },
{ command: 'FBro_发送鼠标移动事件', runtimeName: 'FBro_发送鼠标移动事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '是否离开', type: 'bool' }], returnType: 'int', encoding: 'wide' },
{ command: 'FBro_发送鼠标滚轮事件', runtimeName: 'FBro_发送鼠标滚轮事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '横向增量', type: 'int' }, { name: '纵向增量', type: 'int' }], returnType: 'int', encoding: 'wide' },
{ command: 'FBro_发送按键事件', runtimeName: 'FBro_发送按键事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件类型', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: 'Windows键码', type: 'int' }, { name: '原生键码', type: 'int' }, { name: '是否系统键', type: 'bool' }, { name: '字符编码', type: 'int' }, { name: '未修改字符编码', type: 'int' }, { name: '焦点在可编辑字段', type: 'bool' }], returnType: 'int', encoding: 'wide' },
{ command: 'FBro_发送触摸事件', runtimeName: 'FBro_发送触摸事件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '事件类型', type: 'int' }, { name: '修饰键', type: 'longLong' }, { name: '指针类型', type: 'int' }, { name: '触点ID', type: 'int' }, { name: '横坐标', type: 'double' }, { name: '纵坐标', type: 'double' }, { name: '半径X', type: 'double' }, { name: '半径Y', type: 'double' }, { name: '旋转角度', type: 'double' }, { name: '压力', type: 'double' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_查找', runtimeName: 'FBro_查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }, { name: '向前', type: 'bool' }, { name: '区分大小写', type: 'bool' }, { name: '查找下一个', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_停止查找', runtimeName: 'FBro_停止查找', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '清除选择', type: 'bool' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否打开开发者工具', runtimeName: 'FBro_是否打开开发者工具', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_关闭开发者工具', runtimeName: 'FBro_关闭开发者工具', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_强制刷新', runtimeName: 'FBro_强制刷新', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取浏览器标识', runtimeName: 'FBro_取浏览器标识', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否同一实例', runtimeName: 'FBro_是否同一实例', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '另一控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否弹出窗口', runtimeName: 'FBro_是否弹出窗口', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取主浏览器', runtimeName: 'FBro_取主浏览器', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'longLong', encoding: 'wide' },
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
      { command: 'FBro_替换资源响应内容', runtimeName: 'FBro_替换资源响应内容', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '内容', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_替换资源响应文件', runtimeName: 'FBro_替换资源响应文件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '文件路径', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_清除资源响应替换', runtimeName: 'FBro_清除资源响应替换', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_清空资源响应替换', runtimeName: 'FBro_清空资源响应替换', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_替换资源响应文本', runtimeName: 'FBro_替换资源响应文本', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '查找内容', type: 'wideString', description: '按 UTF-8 字节匹配的查找文本，不能为空。' }, { name: '替换内容', type: 'wideString', description: '替换后的文本；空文本表示删除查找内容。' }], returnType: 'int', encoding: 'wide', example: 'FBro_替换资源响应文本(FBro浏览器1, "原始价格", "会员价格")\nFBro_导航(FBro浏览器1, 地址)' },
      { command: 'FBro_清除资源响应文本替换', runtimeName: 'FBro_清除资源响应文本替换', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide', example: 'FBro_清除资源响应文本替换(FBro浏览器1)' },
      { command: 'FBro指纹_应用配置', runtimeName: 'FBro指纹_应用配置', parameters: [{ name: '控件名', type: 'controlRef' }, { name: 'JSON', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro指纹_取调用次数', runtimeName: 'FBro指纹_取调用次数', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro指纹_清空调用次数', runtimeName: 'FBro指纹_清空调用次数', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取最近事件', runtimeName: 'FBro_取最近事件', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取最近错误', runtimeName: 'FBro_取最近错误', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取进程状态', runtimeName: 'FBro_取进程状态', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取进程ID', runtimeName: 'FBro_取进程ID', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取调试端口', runtimeName: 'FBro_取调试端口', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_重启进程', runtimeName: 'FBro_重启进程', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_显示', runtimeName: 'FBro_显示', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_隐藏', runtimeName: 'FBro_隐藏', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_是否显示', runtimeName: 'FBro_是否显示', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_调整大小', runtimeName: 'FBro_调整大小', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_截图到文件', runtimeName: 'FBro_截图到文件', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '路径', type: 'wideString' }, { name: '格式', type: 'wideString' }, { name: '质量', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取窗口句柄', runtimeName: 'FBro_取窗口句柄', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'FBro_取打开者窗口句柄', runtimeName: 'FBro_取打开者窗口句柄', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'FBro_取父窗口句柄', runtimeName: 'FBro_取父窗口句柄', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'FBro_取运行时样式', runtimeName: 'FBro_取运行时样式', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取SDK版本JSON', runtimeName: 'FBro_取SDK版本JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取实例数量', runtimeName: 'FBro_取实例数量', parameters: [], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取实例句柄列表JSON', runtimeName: 'FBro_取实例句柄列表JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取实例标记列表JSON', runtimeName: 'FBro_取实例标记列表JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_是否存活', runtimeName: 'FBro_是否存活', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_显示开发者工具窗口', runtimeName: 'FBro_显示开发者工具窗口', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '标题', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'FBro_移动浏览器窗口', runtimeName: 'FBro_移动浏览器窗口', parameters: [{ name: '控件名', type: 'controlRef' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], returnType: 'longLong', encoding: 'wide' },
      { command: 'FBro_取创建标记', runtimeName: 'FBro_取创建标记', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_取附加信息JSON', runtimeName: 'FBro_取附加信息JSON', parameters: [{ name: '控件名', type: 'controlRef' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_后台创建', runtimeName: 'FBro_后台创建', parameters: [{ name: '地址', type: 'wideString' }, { name: '缓存目录', type: 'wideString' }, { name: '附加信息JSON', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取启动命令行', runtimeName: 'FBro_取启动命令行', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_设置启动开关JSON', runtimeName: 'FBro_设置启动开关JSON', parameters: [{ name: '开关JSON', type: 'wideString', description: '单层 JSON 文本，键限启动开关白名单、值只能是 true 或 false，例如 {"enableCrossFrame":true}；必须是调用处的字面文本，生成期烘焙进初始化。' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_启用无头模式', runtimeName: 'FBro_启用无头模式', parameters: [], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_实例导航', runtimeName: 'FBro_实例导航', parameters: [{ name: '实例句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_实例等待加载超时', runtimeName: 'FBro_实例等待加载超时', parameters: [{ name: '实例句柄', type: 'longLong' }, { name: '超时毫秒', type: 'int' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_实例执行JS', runtimeName: 'FBro_实例执行JS', parameters: [{ name: '实例句柄', type: 'longLong' }, { name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_实例是否存活', runtimeName: 'FBro_实例是否存活', parameters: [{ name: '实例句柄', type: 'longLong' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_实例关闭', runtimeName: 'FBro_实例关闭', parameters: [{ name: '实例句柄', type: 'longLong' }], returnType: 'void', encoding: 'wide' },
      { command: 'FBro_实例绑定事件', runtimeName: 'FBro_实例绑定事件', parameters: [{ name: '实例句柄', type: 'longLong' }, { name: '事件名', type: 'wideString' }, { name: '处理器', type: 'handler' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_实例取最近事件', runtimeName: 'FBro_实例取最近事件', parameters: [{ name: '实例句柄', type: 'longLong' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_实例取事件数据', runtimeName: 'FBro_实例取事件数据', parameters: [{ name: '实例句柄', type: 'longLong' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_启用JS扩展', runtimeName: 'FBro_启用JS扩展', parameters: [{ name: '查询函数名', type: 'wideString' }, { name: '取消函数名', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: '浏览器管理器_初始化', runtimeName: '浏览器管理器_初始化', parameters: [
        { name: '页面选项卡', type: 'controlRef', controlTypes: ['TabControl'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' },
        { name: '实例列表', type: 'controlRef', controlTypes: ['ListBox'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' },
        { name: '工作区键', type: 'wideString' }
      ], returnType: 'int', encoding: 'wide', example: '浏览器管理器_初始化(浏览器页面, 浏览器实例列表, "win32-fbro-multi-browser-manager")' },
      { command: '浏览器管理器_绑定地址栏', runtimeName: '浏览器管理器_绑定地址栏', parameters: [
        { name: '地址控件', type: 'controlRef', controlTypes: ['TextBox'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' }
      ], returnType: 'bool', encoding: 'wide', example: '浏览器管理器_绑定地址栏(地址输入)' },
      { command: '浏览器管理器_绑定下载视图', runtimeName: '浏览器管理器_绑定下载视图', parameters: [
        { name: '详情控件', type: 'controlRef', controlTypes: ['TextBox', 'Label'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' },
        { name: '进度条', type: 'controlRef', controlTypes: ['ProgressBar'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' }
      ], returnType: 'bool', encoding: 'wide', example: '浏览器管理器_绑定下载视图(实例详情, 下载进度)' },
      { command: '浏览器管理器_新增实例', runtimeName: '浏览器管理器_新增实例', parameters: [{ name: '名称', type: 'wideString' }, { name: '地址', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_切换索引', runtimeName: '浏览器管理器_切换索引', parameters: [{ name: '索引', type: 'int' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_重命名当前', runtimeName: '浏览器管理器_重命名当前', parameters: [{ name: '名称', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_删除当前', runtimeName: '浏览器管理器_删除当前', parameters: [{ name: '清除数据', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_导航', runtimeName: '浏览器管理器_导航', parameters: [{ name: '地址', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_后退', runtimeName: '浏览器管理器_后退', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_前进', runtimeName: '浏览器管理器_前进', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_刷新', runtimeName: '浏览器管理器_刷新', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_停止', runtimeName: '浏览器管理器_停止', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_强制刷新', runtimeName: '浏览器管理器_强制刷新', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_打开当前缓存目录', runtimeName: '浏览器管理器_打开当前缓存目录', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_打开当前下载目录', runtimeName: '浏览器管理器_打开当前下载目录', parameters: [], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_清理当前缓存', runtimeName: '浏览器管理器_清理当前缓存', parameters: [{ name: '包含Cookie', type: 'bool' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器管理器_导出Cookie', runtimeName: '浏览器管理器_导出Cookie', parameters: [{ name: '文件', type: 'wideString' }, { name: '全部网站', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_导入Cookie', runtimeName: '浏览器管理器_导入Cookie', parameters: [{ name: '文件', type: 'wideString' }, { name: '覆盖冲突', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前稳定ID', runtimeName: '浏览器管理器_取当前稳定ID', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前名称', runtimeName: '浏览器管理器_取当前名称', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前地址', runtimeName: '浏览器管理器_取当前地址', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前插件状态', runtimeName: '浏览器管理器_取当前插件状态', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前插件错误', runtimeName: '浏览器管理器_取当前插件错误', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前下载状态', runtimeName: '浏览器管理器_取当前下载状态', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前下载文件', runtimeName: '浏览器管理器_取当前下载文件', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前下载完整路径', runtimeName: '浏览器管理器_取当前下载完整路径', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前下载目录', runtimeName: '浏览器管理器_取当前下载目录', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前错误', runtimeName: '浏览器管理器_取当前错误', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取持久化诊断', runtimeName: '浏览器管理器_取持久化诊断', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前缓存目录', runtimeName: '浏览器管理器_取当前缓存目录', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前进程状态', runtimeName: '浏览器管理器_取当前进程状态', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取当前进程ID', runtimeName: '浏览器管理器_取当前进程ID', parameters: [], returnType: 'int', encoding: 'wide' },
      { command: '浏览器管理器_取当前页面句柄', runtimeName: '浏览器管理器_取当前页面句柄', parameters: [], returnType: 'longLong', encoding: 'wide' },
      { command: '浏览器管理器_取实例数量', runtimeName: '浏览器管理器_取实例数量', parameters: [], returnType: 'int', encoding: 'wide' },
      { command: '浏览器管理器_取实例顺序JSON', runtimeName: '浏览器管理器_取实例顺序JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器管理器_取运行快照JSON', runtimeName: '浏览器管理器_取运行快照JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_创建区域', runtimeName: 'FBro_创建区域', parameters: [{ name: '实例编号', type: 'int', description: '区域实例唯一编号，重复编号会拒绝创建。' }, { name: '左', type: 'int', description: '承载矩形相对宿主窗口客户区的逻辑横坐标，按 DPI 自动缩放。' }, { name: '顶', type: 'int', description: '承载矩形相对宿主窗口客户区的逻辑纵坐标，按 DPI 自动缩放。' }, { name: '宽', type: 'int', description: '承载矩形逻辑宽度，必须大于 0。' }, { name: '高', type: 'int', description: '承载矩形逻辑高度，必须大于 0。' }, { name: '地址', type: 'wideString', description: '初始导航地址，留空按 about:blank。' }, { name: '缓存目录', type: 'wideString', description: '独立 Profile/缓存目录，留空按实例编号自动派生。' }, { name: '代理地址', type: 'wideString', description: '该实例独立代理，留空表示不使用代理。' }, { name: '用户代理', type: 'wideString', description: '该实例独立 UA，留空表示使用默认。' }], returnType: 'int', encoding: 'wide' },
      { command: 'FBro_取区域实例JSON', runtimeName: 'FBro_取区域实例JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: 'FBro_关闭全部区域', runtimeName: 'FBro_关闭全部区域', parameters: [], returnType: 'int', encoding: 'wide' }
    ] }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.new_emoji.fbro-shell',
    name: 'new_emoji FBro 浏览器外壳',
    version: '1.4.0',
    minLingBuilderVersion: '0.3.0',
    category: '界面',
    description: '在 new_emoji 浏览器框架窗口中按稳定 ID 管理 FBro x64 独立会话、RichList、原生 HWND 和隔离 Profile。',
    author: 'LingBuilder',
    tags: ['内置', 'new_emoji', 'FBro', '浏览器外壳', 'x64'],
    dependencies: [
      { moduleId: 'lingbuilder.new_emoji.ui', minimumVersion: '2.0.0' },
      { moduleId: 'lingbuilder.fbro.browser', minimumVersion: '2.2.0' }
    ],
    contributes: {
      commands: [
        { name: '浏览器外壳_创建', signature: '浏览器外壳_创建(标签页控件, 页面占位控件, 状态处理器)', description: '绑定 Tabs 和 BrowserViewport，占位区仅用于加载/错误提示，真实网页由独立 FBro HWND 渲染。', insertText: '浏览器外壳_创建($1, $2, &$3)', returnType: '逻辑型' },
        { name: '浏览器外壳_绑定实例列表', signature: '浏览器外壳_绑定实例列表(实例列表控件)', description: '把动态标签集合、进程状态、PID 和选中项同步到 RichList。', insertText: '浏览器外壳_绑定实例列表($1)', returnType: '逻辑型' },
        { name: '浏览器外壳_选择列表键', signature: '浏览器外壳_选择列表键(选中键JSON)', description: '使用 RichList SelectionChanged 返回的选中键 JSON 切换动态实例。', insertText: '浏览器外壳_选择列表键($1)', returnType: '逻辑型' },
        { name: '浏览器外壳_销毁', signature: '浏览器外壳_销毁()', description: '关闭全部受管标签页和 FBro 子宿主。', insertText: '浏览器外壳_销毁()', returnType: '空' },
        { name: '浏览器外壳_新建标签页', signature: '浏览器外壳_新建标签页(稳定ID, 地址, 标题)', description: '创建稳定 ID 对应的独立 FBro 句柄和宿主 HWND。', insertText: '浏览器外壳_新建标签页("$1", "$2", "$3")', returnType: '逻辑型' },
        { name: '浏览器外壳_新建独立实例', signature: '浏览器外壳_新建独立实例(稳定ID, 地址, 标题, 缓存目录)', description: '动态创建一个独立 Host 进程、独立 WebSocket 会话、独立 Profile 和伴随 HWND；没有固定数量上限。', insertText: '浏览器外壳_新建独立实例("$1", "$2", "$3", "$4")', returnType: '逻辑型' },
        { name: '浏览器外壳_新建独立实例代理', signature: '浏览器外壳_新建独立实例代理(稳定ID, 地址, 标题, 缓存目录, 代理地址, 用户代理)', description: '动态创建带独立代理和 User-Agent 的独立实例：代理地址非空即该店铺独立出口 IP（独立 Host 进程天然隔离），用户代理在进程启动前写入 config；空值分别回落直连与 FBro 默认 UA。多店铺独立代理/UA 验证首选。', insertText: '浏览器外壳_新建独立实例代理("$1", "$2", "$3", "$4", "http://127.0.0.1:7890", "Mozilla/5.0")', returnType: '逻辑型' },
        { name: '浏览器外壳_新建内嵌实例区域', signature: '浏览器外壳_新建内嵌实例区域(稳定ID, 左, 顶, 宽, 高, 地址, 缓存目录, 代理地址, 用户代理)', description: '把 FBro 独立进程浏览器内嵌到当前宿主窗口的指定矩形区域（复用已出货的独立进程嵌入路径，跨进程浏览器作为子窗口挂到该矩形承载窗），可同时内嵌多个、各自独立缓存/代理/UA，随主窗口缩放与 DPI 变化跟随各自矩形——与 EdgeView_创建区域 / CEF3_创建区域 同口径的动态内嵌多店铺浏览器。稳定ID 供后续 浏览器外壳_导航实例/关闭实例/设置实例Cookie/取实例状态 等按 ID 操作；重复 ID 或缓存目录被占用返回假。坐标尺寸为逻辑像素。', insertText: '浏览器外壳_新建内嵌实例区域("store-a", 10, 60, 600, 400, "https://www.example.com", ".fbro-region/store-a", "", "")', returnType: '逻辑型' },
        { name: '浏览器外壳_取内嵌区域实例JSON', signature: '浏览器外壳_取内嵌区域实例JSON()', description: '返回当前全部内嵌区域 FBro 实例的 JSON 数组，每项含 稳定ID/地址/标题/左/顶/宽/高/状态/是否有效，供动态多店铺内嵌列表自省。', insertText: '浏览器外壳_取内嵌区域实例JSON()', returnType: '文本型' },
        { name: '浏览器外壳_启用实例持久化', signature: '浏览器外壳_启用实例持久化(工作台键)', description: '从 LocalAppData 中的 UTF-8 原子 JSON 恢复稳定 ID、名称、顺序、地址和独立 Profile；返回恢复数量，损坏时返回 -1。', insertText: '浏览器外壳_启用实例持久化("$1")', returnType: '整数型' },
        { name: '浏览器外壳_取持久化诊断', signature: '浏览器外壳_取持久化诊断()', description: '返回配置恢复或原子写入的中文诊断，不包含 Cookie。', insertText: '浏览器外壳_取持久化诊断()', returnType: '文本型' },
        { name: '浏览器外壳_重命名实例', signature: '浏览器外壳_重命名实例(稳定ID, 新名称)', description: '修改显示名称并立即持久化，不改变稳定 ID 或缓存路径。', insertText: '浏览器外壳_重命名实例("$1", "$2")', returnType: '逻辑型' },
        { name: '浏览器外壳_关闭实例', signature: '浏览器外壳_关闭实例(稳定ID)', description: '释放指定独立会话的 Host 和伴随 HWND，但保留 RichList 表项、稳定 ID、地址与缓存目录。', insertText: '浏览器外壳_关闭实例("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_重新打开实例', signature: '浏览器外壳_重新打开实例(稳定ID)', description: '使用原稳定 ID、地址和缓存目录重新创建已关闭的独立会话。', insertText: '浏览器外壳_重新打开实例("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_删除实例', signature: '浏览器外壳_删除实例(稳定ID)', description: '关闭并删除指定会话的 RichList 表项和运行时绑定；默认保留缓存目录。', insertText: '浏览器外壳_删除实例("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_确认删除实例', signature: '浏览器外壳_确认删除实例(稳定ID, 清除数据)', description: '提供保留缓存或二次确认清除数据两种路径，并限制删除目标只能位于当前工作台 profiles 根目录。', insertText: '浏览器外壳_确认删除实例("$1", $2)', returnType: '文本型' },
        { name: '浏览器外壳_打开实例缓存目录', signature: '浏览器外壳_打开实例缓存目录(稳定ID)', description: '在资源管理器打开经过受管根目录校验的实例 Profile。', insertText: '浏览器外壳_打开实例缓存目录("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_清理实例缓存', signature: '浏览器外壳_清理实例缓存(稳定ID, 包含Cookie)', description: '通过目标独立 FBro Host 清理真实缓存；可选择同时清理 Cookie 和插件私有数据。', insertText: '浏览器外壳_清理实例缓存("$1", $2)', returnType: '逻辑型' },
        { name: '浏览器外壳_导出实例Cookie', signature: '浏览器外壳_导出实例Cookie(稳定ID, 文件, 全部网站)', description: '从目标实例的真实 FBro CookieManager 导出 LingBuilder JSON；不会写入普通日志。', insertText: '浏览器外壳_导出实例Cookie("$1", "$2", $3)', returnType: '文本型' },
        { name: '浏览器外壳_导入实例Cookie', signature: '浏览器外壳_导入实例Cookie(稳定ID, 文件, 覆盖冲突, 包含过期)', description: '预览有效、无效、过期、域名和冲突后，将结构化 Cookie 写入目标实例并刷新页面。', insertText: '浏览器外壳_导入实例Cookie("$1", "$2", $3, $4)', returnType: '文本型' },
        { name: '浏览器外壳_取当前插件状态', signature: '浏览器外壳_取当前插件状态()', description: '返回当前实例的插件已加载、加载中、加载失败或缺失状态。', insertText: '浏览器外壳_取当前插件状态()', returnType: '文本型' },
        { name: '浏览器外壳_取当前插件错误', signature: '浏览器外壳_取当前插件错误()', description: '返回当前实例最近的插件清单或 FBro 加载错误。', insertText: '浏览器外壳_取当前插件错误()', returnType: '文本型' },
        { name: '浏览器外壳_处理实例列表动作', signature: '浏览器外壳_处理实例列表动作(事件JSON)', description: '按 RichList ItemClicked/ButtonClicked 的 itemKey/actionId 切换会话，或执行关闭、删除、Cookie 和稳定 ID 排序，返回中文状态。', insertText: '浏览器外壳_处理实例列表动作($1)', returnType: '文本型' },
        { name: '浏览器外壳_设置实例Cookie', signature: '浏览器外壳_设置实例Cookie(稳定ID, 地址, Cookie文本)', description: '通过指定独立 Host 的 FBro Cookie API 写入 Cookie；不会输出敏感明文。', insertText: '浏览器外壳_设置实例Cookie("$1", "$2", "$3")', returnType: '逻辑型' },
        { name: '浏览器外壳_打开Cookie对话框', signature: '浏览器外壳_打开Cookie对话框(稳定ID, 默认地址)', description: '打开包含目标网址与 Cookie 文本输入的中文模态对话框，并仅写入指定稳定会话。', insertText: '浏览器外壳_打开Cookie对话框("$1", "$2")', returnType: '文本型' },
        { name: '浏览器外壳_取实例Cookie', signature: '浏览器外壳_取实例Cookie(稳定ID, 地址)', description: '通过指定独立 Host 读取 Cookie，用于隔离验证；调用方不得记录敏感结果。', insertText: '浏览器外壳_取实例Cookie("$1", "$2")', returnType: '文本型' },
        { name: '浏览器外壳_取实例状态', signature: '浏览器外壳_取实例状态(稳定ID)', description: '返回已打开、已关闭或不存在。', insertText: '浏览器外壳_取实例状态("$1")', returnType: '文本型' },
        { name: '浏览器外壳_取实例缓存目录', signature: '浏览器外壳_取实例缓存目录(稳定ID)', description: '返回稳定会话绑定的独立缓存目录。', insertText: '浏览器外壳_取实例缓存目录("$1")', returnType: '文本型' },
        { name: '浏览器外壳_取实例进程ID', signature: '浏览器外壳_取实例进程ID(稳定ID)', description: '返回指定已打开独立会话的 Host PID。', insertText: '浏览器外壳_取实例进程ID("$1")', returnType: '整数型' },
        { name: '浏览器外壳_取实例宿主句柄', signature: '浏览器外壳_取实例宿主句柄(稳定ID)', description: '返回指定已打开独立会话的伴随宿主 HWND。', insertText: '浏览器外壳_取实例宿主句柄("$1")', returnType: '长整数型' },
        { name: '浏览器外壳_取实例顺序JSON', signature: '浏览器外壳_取实例顺序JSON()', description: '返回当前 RichList 稳定 ID 顺序的 JSON 数组。', insertText: '浏览器外壳_取实例顺序JSON()', returnType: '文本型' },
        { name: '浏览器外壳_生成稳定实例ID', signature: '浏览器外壳_生成稳定实例ID()', description: '使用系统随机数生成不会因重命名改变的浏览器实例 ID。', insertText: '浏览器外壳_生成稳定实例ID()', returnType: '文本型' },
        { name: '浏览器外壳_新建空白标签页', signature: '浏览器外壳_新建空白标签页()', description: '使用运行时生成的稳定 ID 新建并选择空白标签页。', insertText: '浏览器外壳_新建空白标签页()', returnType: '逻辑型' },
        { name: '浏览器外壳_关闭标签页', signature: '浏览器外壳_关闭标签页(稳定ID)', description: '关闭并销毁指定稳定 ID 的标签页。', insertText: '浏览器外壳_关闭标签页("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_关闭当前标签页', signature: '浏览器外壳_关闭当前标签页()', description: '关闭当前选中的标签页。', insertText: '浏览器外壳_关闭当前标签页()', returnType: '逻辑型' },
        { name: '浏览器外壳_关闭其他标签页', signature: '浏览器外壳_关闭其他标签页()', description: '保留当前标签页并关闭、销毁其余标签页宿主。', insertText: '浏览器外壳_关闭其他标签页()', returnType: '逻辑型' },
        { name: '浏览器外壳_取标签页数量', signature: '浏览器外壳_取标签页数量()', description: '返回浏览器外壳当前受管标签页数量。', insertText: '浏览器外壳_取标签页数量()', returnType: '整数型' },
        { name: '浏览器外壳_选择标签页', signature: '浏览器外壳_选择标签页(稳定ID)', description: '只显示指定稳定 ID 的页面宿主。', insertText: '浏览器外壳_选择标签页("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_重排标签页', signature: '浏览器外壳_重排标签页(稳定ID, 新索引)', description: '按稳定 ID 重排标签页和运行时映射。', insertText: '浏览器外壳_重排标签页("$1", $2)', returnType: '逻辑型' },
        { name: '浏览器外壳_导航', signature: '浏览器外壳_导航(地址)', description: '让当前标签页导航到地址。', insertText: '浏览器外壳_导航("$1")', returnType: '逻辑型' },
        { name: '浏览器外壳_后退', signature: '浏览器外壳_后退()', description: '当前标签页后退。', insertText: '浏览器外壳_后退()', returnType: '逻辑型' },
        { name: '浏览器外壳_前进', signature: '浏览器外壳_前进()', description: '当前标签页前进。', insertText: '浏览器外壳_前进()', returnType: '逻辑型' },
        { name: '浏览器外壳_刷新', signature: '浏览器外壳_刷新()', description: '刷新当前标签页。', insertText: '浏览器外壳_刷新()', returnType: '空' },
        { name: '浏览器外壳_停止', signature: '浏览器外壳_停止()', description: '停止当前标签页加载。', insertText: '浏览器外壳_停止()', returnType: '空' },
        { name: '浏览器外壳_取地址', signature: '浏览器外壳_取地址()', description: '读取当前标签页地址。', insertText: '浏览器外壳_取地址()', returnType: '文本型' },
        { name: '浏览器外壳_取标题', signature: '浏览器外壳_取标题()', description: '读取当前标签页标题。', insertText: '浏览器外壳_取标题()', returnType: '文本型' },
        { name: '浏览器外壳_取当前稳定ID', signature: '浏览器外壳_取当前稳定ID()', description: '返回当前实例的稳定 ID。', insertText: '浏览器外壳_取当前稳定ID()', returnType: '文本型' },
        { name: '浏览器外壳_取当前进程状态', signature: '浏览器外壳_取当前进程状态()', description: '返回当前独立 Host 的启动状态。', insertText: '浏览器外壳_取当前进程状态()', returnType: '文本型' },
        { name: '浏览器外壳_取当前进程ID', signature: '浏览器外壳_取当前进程ID()', description: '返回当前独立 Host 的 PID。', insertText: '浏览器外壳_取当前进程ID()', returnType: '整数型' },
        { name: '浏览器外壳_取当前调试端口', signature: '浏览器外壳_取当前调试端口()', description: '返回当前独立 Host 的随机 CDP 端口。', insertText: '浏览器外壳_取当前调试端口()', returnType: '整数型' },
        { name: '浏览器外壳_取当前错误', signature: '浏览器外壳_取当前错误()', description: '返回当前实例最近的进程或 FBro 错误。', insertText: '浏览器外壳_取当前错误()', returnType: '文本型' },
        { name: '浏览器外壳_强制刷新', signature: '浏览器外壳_强制刷新()', description: '忽略缓存刷新当前实例。', insertText: '浏览器外壳_强制刷新()', returnType: '逻辑型' },
        { name: '浏览器外壳_执行JS', signature: '浏览器外壳_执行JS(脚本)', description: '通过 WebSocket 在当前独立 Host 中同步执行 JavaScript。', insertText: '浏览器外壳_执行JS("$1")', returnType: '文本型' },
        { name: '浏览器外壳_取Cookie', signature: '浏览器外壳_取Cookie(地址)', description: '通过 WebSocket 读取当前独立 Host 指定地址的 Cookie。', insertText: '浏览器外壳_取Cookie("$1")', returnType: '文本型' },
        { name: '浏览器外壳_截图到文件', signature: '浏览器外壳_截图到文件(路径, 格式, 质量)', description: '让当前独立 Host 截图并保存到文件。', insertText: '浏览器外壳_截图到文件("$1", "png", 90)', returnType: '逻辑型' },
        { name: '浏览器外壳_隐藏当前', signature: '浏览器外壳_隐藏当前()', description: '隐藏当前 Host，但保持进程和页面状态。', insertText: '浏览器外壳_隐藏当前()', returnType: '逻辑型' },
        { name: '浏览器外壳_显示当前', signature: '浏览器外壳_显示当前()', description: '恢复显示当前 Host。', insertText: '浏览器外壳_显示当前()', returnType: '逻辑型' },
        { name: '浏览器外壳_取当前代理', signature: '浏览器外壳_取当前代理()', description: '读取当前实例保存的代理地址。', insertText: '浏览器外壳_取当前代理()', returnType: '文本型' },
        { name: '浏览器外壳_取当前UserAgent', signature: '浏览器外壳_取当前UserAgent()', description: '读取当前实例保存的 User-Agent。', insertText: '浏览器外壳_取当前UserAgent()', returnType: '文本型' },
        { name: '浏览器外壳_取当前指纹配置', signature: '浏览器外壳_取当前指纹配置()', description: '读取当前实例保存的指纹 JSON。', insertText: '浏览器外壳_取当前指纹配置()', returnType: '文本型' },
        { name: '浏览器外壳_取当前视口宽度', signature: '浏览器外壳_取当前视口宽度()', description: '读取当前实例视口宽度。', insertText: '浏览器外壳_取当前视口宽度()', returnType: '整数型' },
        { name: '浏览器外壳_取当前视口高度', signature: '浏览器外壳_取当前视口高度()', description: '读取当前实例视口高度。', insertText: '浏览器外壳_取当前视口高度()', returnType: '整数型' },
        { name: '浏览器外壳_按配置重建当前', signature: '浏览器外壳_按配置重建当前(代理, UserAgent, 指纹JSON, 宽度, 高度)', description: '保留稳定 ID 与 Profile，关闭并按新配置重启当前独立 Host。', insertText: '浏览器外壳_按配置重建当前("$1", "$2", "$3", $4, $5)', returnType: '逻辑型' },
        { name: '浏览器外壳_聚焦地址栏', signature: '浏览器外壳_聚焦地址栏(地址栏控件)', description: '把键盘焦点切换到指定 new_emoji Omnibox。', insertText: '浏览器外壳_聚焦地址栏($1)', returnType: '逻辑型' }
      ],
      snippets: [{ label: 'new_emoji FBro 浏览器外壳', insertText: '浏览器外壳_创建(浏览器标签页, 浏览器页面占位, &浏览器状态改变)\n浏览器外壳_新建标签页("home", "https://www.baidu.com", "新标签页")', description: '创建一个真实 FBro 标签页。' }],
      docs: [{ title: 'new_emoji FBro 浏览器外壳', path: 'docs/modules/fbro-shell/README.md' }],
      examples: [{ title: '完整浏览器外壳示例', path: 'docs/modules/fbro-shell/examples/MainWindow.lcpp' }]
    },
    targets: [{
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      defines: ['LINGBUILDER_NEW_EMOJI_FBRO_SHELL_MODULE']
    }],
    bindings: { commands: [
      { command: '浏览器外壳_创建', runtimeName: '浏览器外壳_创建', parameters: [
        { name: '标签页控件', type: 'controlRef', controlTypes: ['lingbuilder.new_emoji.ui/Tabs'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId' },
        { name: '页面占位控件', type: 'controlRef', controlTypes: ['lingbuilder.new_emoji.ui/BrowserViewport'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId' },
        { name: '状态处理器', type: 'handler', handlerSignature: { parameterTypes: ['整数型', '文本型', '文本型', '逻辑型'], returnType: '空' } }
      ], returnType: 'bool' },
      { command: '浏览器外壳_绑定实例列表', runtimeName: '浏览器外壳_绑定实例列表', parameters: [
        { name: '实例列表控件', type: 'controlRef', controlTypes: ['lingbuilder.new_emoji.ui/RichList'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId' }
      ], returnType: 'bool' },
      { command: '浏览器外壳_选择列表键', runtimeName: '浏览器外壳_选择列表键', parameters: [{ name: '选中键JSON', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_销毁', runtimeName: '浏览器外壳_销毁', parameters: [], returnType: 'void' },
      { command: '浏览器外壳_新建标签页', runtimeName: '浏览器外壳_新建标签页', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '地址', type: 'wideString' }, { name: '标题', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_新建独立实例', runtimeName: '浏览器外壳_新建独立实例', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '地址', type: 'wideString' }, { name: '标题', type: 'wideString' }, { name: '缓存目录', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_新建独立实例代理', runtimeName: '浏览器外壳_新建独立实例代理', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '地址', type: 'wideString' }, { name: '标题', type: 'wideString' }, { name: '缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }, { name: '用户代理', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_新建内嵌实例区域', runtimeName: '浏览器外壳_新建内嵌实例区域', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }, { name: '用户代理', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_取内嵌区域实例JSON', runtimeName: '浏览器外壳_取内嵌区域实例JSON', parameters: [], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_启用实例持久化', runtimeName: '浏览器外壳_启用实例持久化', parameters: [{ name: '工作台键', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: '浏览器外壳_取持久化诊断', runtimeName: '浏览器外壳_取持久化诊断', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_重命名实例', runtimeName: '浏览器外壳_重命名实例', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '新名称', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_关闭实例', runtimeName: '浏览器外壳_关闭实例', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_重新打开实例', runtimeName: '浏览器外壳_重新打开实例', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_删除实例', runtimeName: '浏览器外壳_删除实例', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_确认删除实例', runtimeName: '浏览器外壳_确认删除实例', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '清除数据', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_打开实例缓存目录', runtimeName: '浏览器外壳_打开实例缓存目录', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_清理实例缓存', runtimeName: '浏览器外壳_清理实例缓存', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '包含Cookie', type: 'bool' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_导出实例Cookie', runtimeName: '浏览器外壳_导出实例Cookie', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '文件', type: 'wideString' }, { name: '全部网站', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_导入实例Cookie', runtimeName: '浏览器外壳_导入实例Cookie', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '文件', type: 'wideString' }, { name: '覆盖冲突', type: 'bool' }, { name: '包含过期', type: 'bool' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取当前插件状态', runtimeName: '浏览器外壳_取当前插件状态', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前插件错误', runtimeName: '浏览器外壳_取当前插件错误', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_处理实例列表动作', runtimeName: '浏览器外壳_处理实例列表动作', parameters: [{ name: '事件JSON', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_设置实例Cookie', runtimeName: '浏览器外壳_设置实例Cookie', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '地址', type: 'wideString' }, { name: 'Cookie文本', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_打开Cookie对话框', runtimeName: '浏览器外壳_打开Cookie对话框', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '默认地址', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取实例Cookie', runtimeName: '浏览器外壳_取实例Cookie', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '地址', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取实例状态', runtimeName: '浏览器外壳_取实例状态', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取实例缓存目录', runtimeName: '浏览器外壳_取实例缓存目录', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取实例进程ID', runtimeName: '浏览器外壳_取实例进程ID', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'int', encoding: 'wide' },
      { command: '浏览器外壳_取实例宿主句柄', runtimeName: '浏览器外壳_取实例宿主句柄', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'longLong', encoding: 'wide' },
      { command: '浏览器外壳_取实例顺序JSON', runtimeName: '浏览器外壳_取实例顺序JSON', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_生成稳定实例ID', runtimeName: '浏览器外壳_生成稳定实例ID', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_新建空白标签页', runtimeName: '浏览器外壳_新建空白标签页', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_关闭标签页', runtimeName: '浏览器外壳_关闭标签页', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_关闭当前标签页', runtimeName: '浏览器外壳_关闭当前标签页', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_关闭其他标签页', runtimeName: '浏览器外壳_关闭其他标签页', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_取标签页数量', runtimeName: '浏览器外壳_取标签页数量', parameters: [], returnType: 'int' },
      { command: '浏览器外壳_选择标签页', runtimeName: '浏览器外壳_选择标签页', parameters: [{ name: '稳定ID', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_重排标签页', runtimeName: '浏览器外壳_重排标签页', parameters: [{ name: '稳定ID', type: 'wideString' }, { name: '新索引', type: 'int' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_导航', runtimeName: '浏览器外壳_导航', parameters: [{ name: '地址', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_后退', runtimeName: '浏览器外壳_后退', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_前进', runtimeName: '浏览器外壳_前进', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_刷新', runtimeName: '浏览器外壳_刷新', parameters: [], returnType: 'void' },
      { command: '浏览器外壳_停止', runtimeName: '浏览器外壳_停止', parameters: [], returnType: 'void' },
      { command: '浏览器外壳_取地址', runtimeName: '浏览器外壳_取地址', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取标题', runtimeName: '浏览器外壳_取标题', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前稳定ID', runtimeName: '浏览器外壳_取当前稳定ID', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前进程状态', runtimeName: '浏览器外壳_取当前进程状态', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前进程ID', runtimeName: '浏览器外壳_取当前进程ID', parameters: [], returnType: 'int' },
      { command: '浏览器外壳_取当前调试端口', runtimeName: '浏览器外壳_取当前调试端口', parameters: [], returnType: 'int' },
      { command: '浏览器外壳_取当前错误', runtimeName: '浏览器外壳_取当前错误', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_强制刷新', runtimeName: '浏览器外壳_强制刷新', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_执行JS', runtimeName: '浏览器外壳_执行JS', parameters: [{ name: '脚本', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_取Cookie', runtimeName: '浏览器外壳_取Cookie', parameters: [{ name: '地址', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
      { command: '浏览器外壳_截图到文件', runtimeName: '浏览器外壳_截图到文件', parameters: [{ name: '路径', type: 'wideString' }, { name: '格式', type: 'wideString' }, { name: '质量', type: 'int' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_隐藏当前', runtimeName: '浏览器外壳_隐藏当前', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_显示当前', runtimeName: '浏览器外壳_显示当前', parameters: [], returnType: 'bool' },
      { command: '浏览器外壳_取当前代理', runtimeName: '浏览器外壳_取当前代理', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前UserAgent', runtimeName: '浏览器外壳_取当前UserAgent', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前指纹配置', runtimeName: '浏览器外壳_取当前指纹配置', parameters: [], returnType: 'wideString' },
      { command: '浏览器外壳_取当前视口宽度', runtimeName: '浏览器外壳_取当前视口宽度', parameters: [], returnType: 'int' },
      { command: '浏览器外壳_取当前视口高度', runtimeName: '浏览器外壳_取当前视口高度', parameters: [], returnType: 'int' },
      { command: '浏览器外壳_按配置重建当前', runtimeName: '浏览器外壳_按配置重建当前', parameters: [{ name: '代理', type: 'wideString' }, { name: 'UserAgent', type: 'wideString' }, { name: '指纹JSON', type: 'wideString' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], returnType: 'bool', encoding: 'wide' },
      { command: '浏览器外壳_聚焦地址栏', runtimeName: '浏览器外壳_聚焦地址栏', parameters: [
        { name: '地址栏控件', type: 'controlRef', controlTypes: ['lingbuilder.new_emoji.ui/Omnibox'], controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'stableId' }
      ], returnType: 'bool' }
    ] }
  },
  ...FBRO_SUBMODULES,
  THREADING_MODULE,
  WEBSOCKET_CLIENT_MODULE,
  HTTP_SERVER_MODULE,
  WEBSOCKET_SERVER_MODULE
].map(normalizeBuiltinControlReferences).map(ensureBuiltinX64Target).map(assertBuiltinParameterDescriptions);

/**
 * 无头命令成对门禁（加载期抛错，与参数说明门禁同一口径）：
 * CEF3_HEADLESS_COMMAND_NAMES 的每条命令必须同时出现在 lingbuilder.cef3.browser 的
 * contributes.commands 与 bindings.commands 里，首参必须是整数型「实例编号」，
 * 任何参数都不得是 controlRef（无头实例没有控件宿主）。只登记一半会让补全给出
 * 调用不上的命令、或让生成器产出清单里查不到的中文命令，二者都只能在运行期暴露。
 */
(() => {
  const headless = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  const declared = new Set((headless?.contributes?.commands ?? []).map(item => item.name));
  const bindings = headless?.bindings?.commands ?? [];
  const problems: string[] = [];
  for (const name of CEF3_HEADLESS_COMMAND_NAMES) {
    if (!declared.has(name)) problems.push(`${name} 缺 contributes.commands 声明`);
    const binding = bindings.find(item => item.command === name);
    if (!binding) { problems.push(`${name} 缺 bindings.commands 映射`); continue; }
    if (binding.parameters?.[0]?.name !== '实例编号' || binding.parameters[0].type !== 'int') {
      problems.push(`${name} 的首参必须是整数型 实例编号`);
    }
    for (const parameter of binding.parameters ?? []) {
      if (parameter.type === 'controlRef') problems.push(`${name} 的 ${parameter.name} 不得是 controlRef`);
    }
  }
  if (problems.length) throw new Error(`CEF3 无头命令清单与绑定不成对或寻址口径不符：${problems.join('；')}`);
})();
