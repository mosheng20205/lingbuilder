import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType
} from './types';

export const CDP_CLIENT_MODULE_ID = 'lingbuilder.cdp.client';

type CdpClientCategory = '连接' | '页面' | '导航' | '脚本' | '元素' | '输入' | '网络' | '事件' | '截图' | '快照'
  | '目标' | '会话' | '绑定' | '调试' | '性能' | '存储' | '录制';

interface CdpClientCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: CdpClientCategory;
  insertText?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description?: string
): ModuleCommandBindingParameter => ({ name, type, description });

const handlerParameter = (label: string, description: string): ModuleCommandBindingParameter => ({
  name: label,
  type: 'handler',
  description,
  handlerSignature: { parameterTypes: [], returnType: '空' }
});

const specs: CdpClientCommandSpec[] = [
  // 连接与目标管理
  {
    name: 'CDP_连接', signature: 'CDP_连接(调试地址, 就绪处理器)', description: '连接本机 Chrome/Edge 调试端口（例如 http://127.0.0.1:9222），立即返回受管连接 ID；握手在后台完成，结果通过就绪处理器通知。默认仅允许 127.0.0.1、localhost 或 ::1。',
    parameters: [parameter('调试地址', 'wideString', '浏览器调试服务 HTTP 地址，例如 http://127.0.0.1:9222。'), handlerParameter('就绪处理器', '必须使用 &处理器名；连接就绪或失败时在 UI 线程执行，用 CDP_取当前事件类型 判断结果。')],
    returnType: 'CDP连接', returnLabel: 'CDP连接', category: '连接',
    insertText: 'CDP_连接("${1:http://127.0.0.1:9222}", &${2:连接就绪})'
  },
  {
    name: 'CDP_连接远程', signature: 'CDP_连接远程(调试地址, 就绪处理器)', description: '连接非本机 CDP 调试地址。远程调试端口会暴露浏览器完整控制权，仅在受信任网络中使用；连接前请确认目标地址与链路安全。',
    parameters: [parameter('调试地址', 'wideString', '远程浏览器调试服务 HTTP 地址。'), handlerParameter('就绪处理器', '必须使用 &处理器名；连接就绪或失败时在 UI 线程执行。')],
    returnType: 'CDP连接', returnLabel: 'CDP连接', category: '连接', visibility: 'advanced',
    insertText: 'CDP_连接远程("${1:http://远程主机:9222}", &${2:连接就绪})'
  },
  {
    name: 'CDP_断开连接', signature: 'CDP_断开连接(连接)', description: '断开并释放受管连接及其全部页面会话、元素引用和未完成回调。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  {
    name: 'CDP_取连接数量', signature: 'CDP_取连接数量()', description: '返回当前进程内并存的活动 CDP 连接数量；CDP 模块支持同时连接多个不同调试端口。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '连接'
  },
  {
    name: 'CDP_是否已连接', signature: 'CDP_是否已连接(连接)', description: '判断连接是否已完成 WebSocket 握手并处于可命令状态。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  {
    name: 'CDP_取连接状态', signature: 'CDP_取连接状态(连接)', description: '返回连接状态：未配置、连接中、已连接、已断开或错误。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'wideString', returnLabel: '文本型', category: '连接'
  },
  {
    name: 'CDP_取浏览器版本', signature: 'CDP_取浏览器版本(连接)', description: '返回连接就绪时缓存的浏览器版本信息（来自 /json/version）。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'wideString', returnLabel: '文本型', category: '连接'
  },
  // 页面会话
  {
    name: 'CDP_附加页面', signature: 'CDP_附加页面(连接, 网址, 就绪处理器)', description: '在调试端口的已有标签页中查找指定网址的页面并附加会话（flatten 模式），立即返回受管页面 ID；附加结果通过就绪处理器通知。',
    parameters: [parameter('连接', 'CDP连接'), parameter('网址', 'wideString', '要附加的页面网址，支持前缀匹配。'), handlerParameter('就绪处理器', '必须使用 &处理器名；页面就绪或失败时在 UI 线程执行。')],
    returnType: 'CDP页面', returnLabel: 'CDP页面', category: '页面',
    insertText: 'CDP_附加页面($1, "${2:https://example.com}", &${3:页面就绪})'
  },
  {
    name: 'CDP_新建页面', signature: 'CDP_新建页面(连接, 网址, 就绪处理器)', description: '通过 Target.createTarget 新建标签页并附加会话，立即返回受管页面 ID；结果通过就绪处理器通知。',
    parameters: [parameter('连接', 'CDP连接'), parameter('网址', 'wideString', '新页面初始网址。'), handlerParameter('就绪处理器', '必须使用 &处理器名；页面就绪或失败时在 UI 线程执行。')],
    returnType: 'CDP页面', returnLabel: 'CDP页面', category: '页面',
    insertText: 'CDP_新建页面($1, "${2:https://example.com}", &${3:页面就绪})'
  },
  {
    name: 'CDP_关闭页面', signature: 'CDP_关闭页面(页面)', description: '关闭标签页并释放页面会话；断开连接会同时释放全部页面。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '页面'
  },
  {
    name: 'CDP_激活页面', signature: 'CDP_激活页面(页面)', description: '把指定标签页切换为浏览器当前活动标签。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '页面'
  },
  {
    name: 'CDP_取页面数量', signature: 'CDP_取页面数量(连接)', description: '返回该连接当前的活动页面会话数量。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'int', returnLabel: '整数型', category: '页面'
  },
  {
    name: 'CDP_取页面网址', signature: 'CDP_取页面网址(页面)', description: '返回页面会话缓存的当前网址；导航后自动更新。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'wideString', returnLabel: '文本型', category: '页面'
  },
  {
    name: 'CDP_取页面标题', signature: 'CDP_取页面标题(页面, 完成处理器)', description: '异步读取页面标题；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '页面',
    insertText: 'CDP_取页面标题($1, &${2:取得标题})'
  },
  {
    name: 'CDP_取页面HTML', signature: 'CDP_取页面HTML(页面, 完成处理器)', description: '异步读取页面完整 outerHTML；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '页面'
  },
  // 导航
  {
    name: 'CDP_打开网址', signature: 'CDP_打开网址(页面, 网址, 完成处理器)', description: '导航到指定网址并等待页面加载完成（loadEventFired）后触发完成处理器。',
    parameters: [parameter('页面', 'CDP页面'), parameter('网址', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；加载完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '导航',
    insertText: 'CDP_打开网址($1, "${2:https://example.com}", &${3:加载完成})'
  },
  {
    name: 'CDP_刷新页面', signature: 'CDP_刷新页面(页面, 完成处理器)', description: '重新加载当前页面并等待加载完成后触发完成处理器。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；加载完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '导航'
  },
  {
    name: 'CDP_后退页面', signature: 'CDP_后退页面(页面, 完成处理器)', description: '导航到上一页并等待加载完成后触发完成处理器。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；加载完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '导航'
  },
  {
    name: 'CDP_前进页面', signature: 'CDP_前进页面(页面, 完成处理器)', description: '导航到下一页并等待加载完成后触发完成处理器。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；加载完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '导航'
  },
  {
    name: 'CDP_停止加载', signature: 'CDP_停止加载(页面)', description: '停止当前页面加载。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '导航'
  },
  // 脚本执行
  {
    name: 'CDP_执行脚本', signature: 'CDP_执行脚本(页面, 脚本代码, 完成处理器)', description: '在页面中执行 JavaScript（awaitPromise、returnByValue）；完成后用 CDP_取当前事件文本 读取结果文本，脚本抛出的异常会转为中文错误并保留原始信息。',
    parameters: [parameter('页面', 'CDP页面'), parameter('脚本代码', 'wideString', '要执行的 JavaScript 表达式；Promise 会等待解析。'), handlerParameter('完成处理器', '必须使用 &处理器名；执行完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '脚本',
    insertText: 'CDP_执行脚本($1, "${2:document.title}", &${3:执行完成})'
  },
  // 元素操作
  {
    name: 'CDP_查询元素', signature: 'CDP_查询元素(页面, 选择器)', description: '按 CSS 选择器创建元素引用；元素有效性在后续元素命令执行时校验，页面导航或元素移除后操作会返回中文错误。',
    parameters: [parameter('页面', 'CDP页面'), parameter('选择器', 'wideString', 'CSS 选择器，例如 #submit。')],
    returnType: 'CDP元素', returnLabel: 'CDP元素', category: '元素',
    insertText: 'CDP_查询元素($1, "${2:#submit}")'
  },
  {
    name: 'CDP_点击元素', signature: 'CDP_点击元素(元素, 完成处理器)', description: '滚动元素进入视口并在元素中心位置执行真实鼠标点击（mousePressed + mouseReleased）。',
    parameters: [parameter('元素', 'CDP元素'), handlerParameter('完成处理器', '必须使用 &处理器名；点击完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素',
    insertText: 'CDP_点击元素($1, &${2:点击完成})'
  },
  {
    name: 'CDP_输入文本', signature: 'CDP_输入文本(元素, 文本, 完成处理器)', description: '聚焦元素并逐字符发送键盘 char 事件输入文本（支持中文）；逐字符输入比 IME 直插在 headless 环境更可靠。',
    parameters: [parameter('元素', 'CDP元素'), parameter('文本', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；输入完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  {
    name: 'CDP_取元素文本', signature: 'CDP_取元素文本(元素, 完成处理器)', description: '异步读取元素 innerText；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('元素', 'CDP元素'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  {
    name: 'CDP_取元素属性', signature: 'CDP_取元素属性(元素, 属性名, 完成处理器)', description: '异步读取元素指定属性值；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('元素', 'CDP元素'), parameter('属性名', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  {
    name: 'CDP_取元素数量', signature: 'CDP_取元素数量(页面, 选择器, 完成处理器)', description: '异步统计匹配选择器的元素数量；完成后用 CDP_取当前事件文本 读取数量文本。',
    parameters: [parameter('页面', 'CDP页面'), parameter('选择器', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  // 坐标级输入
  {
    name: 'CDP_鼠标移动', signature: 'CDP_鼠标移动(页面, 横坐标, 纵坐标)', description: '把鼠标移动到页面视口内指定坐标（CSS 像素）。',
    parameters: [parameter('页面', 'CDP页面'), parameter('横坐标', 'int'), parameter('纵坐标', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_鼠标单击', signature: 'CDP_鼠标单击(页面, 横坐标, 纵坐标, 按钮, 次数)', description: '在指定坐标点击鼠标：按钮 0=左键 1=中键 2=右键；次数 2 表示双击。',
    parameters: [parameter('页面', 'CDP页面'), parameter('横坐标', 'int'), parameter('纵坐标', 'int'), parameter('按钮', 'int', '0=左键，1=中键，2=右键。'), parameter('次数', 'int', '点击次数，1=单击，2=双击。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_鼠标单击($1, $2, $3, 0, 1)'
  },
  {
    name: 'CDP_鼠标按下', signature: 'CDP_鼠标按下(页面, 横坐标, 纵坐标, 按钮)', description: '在指定坐标按下鼠标键不放；与 CDP_鼠标释放 配合实现拖拽。',
    parameters: [parameter('页面', 'CDP页面'), parameter('横坐标', 'int'), parameter('纵坐标', 'int'), parameter('按钮', 'int', '0=左键，1=中键，2=右键。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_鼠标释放', signature: 'CDP_鼠标释放(页面, 横坐标, 纵坐标, 按钮)', description: '释放指定坐标已按下的鼠标键。',
    parameters: [parameter('页面', 'CDP页面'), parameter('横坐标', 'int'), parameter('纵坐标', 'int'), parameter('按钮', 'int', '0=左键，1=中键，2=右键。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_鼠标滚轮', signature: 'CDP_鼠标滚轮(页面, 横坐标, 纵坐标, 横向增量, 纵向增量)', description: '在指定坐标发送滚轮事件；纵向负数向上、正数向下。',
    parameters: [parameter('页面', 'CDP页面'), parameter('横坐标', 'int'), parameter('纵坐标', 'int'), parameter('横向增量', 'int'), parameter('纵向增量', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_按键', signature: 'CDP_按键(页面, 键名)', description: '按下并释放一个按键；键名使用 CDP Key 值，例如 Enter、Tab、a、F5。',
    parameters: [parameter('页面', 'CDP页面'), parameter('键名', 'wideString', 'CDP Key 值，例如 Enter、Tab、a。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_按键($1, "Enter")'
  },
  {
    name: 'CDP_组合键', signature: 'CDP_组合键(页面, 修饰键, 键名)', description: '按下修饰键组合再按主键；修饰键使用逗号分隔，支持 Ctrl、Shift、Alt、Meta。',
    parameters: [parameter('页面', 'CDP页面'), parameter('修饰键', 'wideString', '逗号分隔：Ctrl、Shift、Alt、Meta。'), parameter('键名', 'wideString')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_组合键($1, "Ctrl", "a")'
  },
  {
    name: 'CDP_插入文本', signature: 'CDP_插入文本(页面, 文本)', description: '向当前焦点元素通过 Input.insertTextInput 直插文本，不产生按键事件；headless 环境可能不更新输入框的值，可靠输入请用 CDP_输入文本。',
    parameters: [parameter('页面', 'CDP页面'), parameter('文本', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  // 网络与 Cookie
  {
    name: 'CDP_绑定网络事件', signature: 'CDP_绑定网络事件(页面, 处理器)', description: '订阅页面网络事件：网络请求、网络响应、网络完成、网络失败；处理器内用 CDP_取当前网络系列命令读取快照。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名；网络事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_绑定网络事件($1, &${2:网络事件})'
  },
  {
    name: 'CDP_取网络响应体', signature: 'CDP_取网络响应体(页面, 请求编号, 完成处理器)', description: '按网络事件快照中的请求编号读取响应体文本；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('页面', 'CDP页面'), parameter('请求编号', 'wideString', '网络事件快照中的请求编号文本。'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_取Cookie', signature: 'CDP_取Cookie(连接, 网址, 完成处理器)', description: '读取指定网址相关 Cookie；完成后用 CDP_取当前事件文本 读取 JSON 结果。Cookie 属于敏感数据，不得写入日志或分享包。',
    parameters: [parameter('连接', 'CDP连接'), parameter('网址', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_置Cookie', signature: 'CDP_置Cookie(连接, 名称, 值, 网址, 完成处理器)', description: '为指定网址写入一个 Cookie。',
    parameters: [parameter('连接', 'CDP连接'), parameter('名称', 'wideString'), parameter('值', 'wideString'), parameter('网址', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_删除Cookie', signature: 'CDP_删除Cookie(连接, 名称, 网址, 完成处理器)', description: '删除指定网址下同名 Cookie。',
    parameters: [parameter('连接', 'CDP连接'), parameter('名称', 'wideString'), parameter('网址', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_清空缓存', signature: 'CDP_清空缓存(连接, 完成处理器)', description: '清除浏览器磁盘缓存。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_清空Cookie', signature: 'CDP_清空Cookie(连接, 完成处理器)', description: '清除浏览器全部 Cookie。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  // 控制台与异常
  {
    name: 'CDP_绑定控制台事件', signature: 'CDP_绑定控制台事件(页面, 处理器)', description: '订阅页面 console 输出；处理器内用 CDP_取当前事件文本 读取消息、CDP_取当前事件详情 读取级别。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名；控制台事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_绑定控制台事件($1, &${2:控制台消息})'
  },
  {
    name: 'CDP_绑定页面异常', signature: 'CDP_绑定页面异常(页面, 处理器)', description: '订阅页面未捕获异常；处理器内用 CDP_取当前事件文本 读取异常说明。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名；异常事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件'
  },
  // 截图与 PDF
  {
    name: 'CDP_截图', signature: 'CDP_截图(页面, 文件路径, 全页, 完成处理器)', description: '截图并保存为 PNG 文件；全页为真时捕获超出视口的完整页面。',
    parameters: [parameter('页面', 'CDP页面'), parameter('文件路径', 'wideString', 'PNG 输出绝对或相对路径。'), parameter('全页', 'bool', '真=整页截图，假=当前视口。'), handlerParameter('完成处理器', '必须使用 &处理器名；写入完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '截图',
    insertText: 'CDP_截图($1, "${2:screenshot.png}", 假, &${3:截图完成})'
  },
  {
    name: 'CDP_打印PDF', signature: 'CDP_打印PDF(页面, 文件路径, 完成处理器)', description: '把页面打印为 PDF 文件。',
    parameters: [parameter('页面', 'CDP页面'), parameter('文件路径', 'wideString', 'PDF 输出绝对或相对路径。'), handlerParameter('完成处理器', '必须使用 &处理器名；写入完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '截图'
  },
  // 事件绑定与快照
  {
    name: 'CDP_绑定连接事件', signature: 'CDP_绑定连接事件(连接, 处理器)', description: '订阅连接级事件：已就绪、连接失败、已断开、错误；处理器内用 CDP_取当前事件系列命令读取快照。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('处理器', '必须使用 &处理器名；连接事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_绑定连接事件($1, &${2:连接事件})'
  },
  {
    name: 'CDP_绑定页面事件', signature: 'CDP_绑定页面事件(页面, 处理器)', description: '订阅页面级事件：页面就绪、页面失败、加载完成、页面销毁；处理器内用 CDP_取当前事件系列命令读取快照。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名；页面事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件'
  },
  // ===== 阶段 2：命令超时与 Fetch 拦截 =====
  {
    name: 'CDP_设置命令超时', signature: 'CDP_设置命令超时(连接, 超时毫秒)', description: '设置该连接全部异步命令、导航/就绪等待的超时上限；超时会以“命令失败”事件通知。导航与就绪等待使用该值的两倍。',
    parameters: [parameter('连接', 'CDP连接'), parameter('超时毫秒', 'int', '1000 到 600000，默认 30000。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '连接',
    insertText: 'CDP_设置命令超时($1, 30000)'
  },
  {
    name: 'CDP_拦截开始', signature: 'CDP_拦截开始(页面, 网址模式, 处理器)', description: '开启 Fetch 域请求拦截：匹配网址模式（例如 *://api.example.com/*）的请求会暂停并触发“请求被拦截”事件。拦截期间浏览器网络挂起，处理器内必须尽快调用 CDP_拦截继续、CDP_拦截改写、CDP_拦截模拟响应或 CDP_拦截终止。',
    parameters: [parameter('页面', 'CDP页面'), parameter('网址模式', 'wideString', 'CDP 网址通配模式，* 表示全部。'), handlerParameter('处理器', '必须使用 &处理器名；拦截事件在 UI 线程执行，用 CDP_取当前连接 之外的网络快照命令读取网址、方法和请求编号，用返回的 CDP拦截 句柄裁决。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_拦截开始($1, "${2:*://api.example.com/*}", &${3:请求被拦截})'
  },
  {
    name: 'CDP_拦截继续', signature: 'CDP_拦截继续(拦截)', description: '原样放行被拦截的请求；每个拦截句柄只能裁决一次。',
    parameters: [parameter('拦截', 'CDP拦截')], returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_拦截改写', signature: 'CDP_拦截改写(拦截, 网址, 头JSON)', description: '改写请求后放行：网址为空表示不改网址；头JSON 为空表示不改头，非空时必须是 [{名称, 值}] 形式的 JSON 数组并整体替换请求头。',
    parameters: [parameter('拦截', 'CDP拦截'), parameter('网址', 'wideString', '新网址，空文本表示不改。'), parameter('头JSON', 'wideString', '例如 [{"name":"X-Test","value":"1"}]，空文本表示不改。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_拦截改写($1, "${2:https://mock.example.com/data}", "")'
  },
  {
    name: 'CDP_拦截模拟响应', signature: 'CDP_拦截模拟响应(拦截, 状态码, 头JSON, 响应体)', description: '不发往服务器，直接向被拦截请求返回模拟响应（mock）；响应体为 UTF-8 文本，不能超过 8MB。',
    parameters: [parameter('拦截', 'CDP拦截'), parameter('状态码', 'int', '100 到 599。'), parameter('头JSON', 'wideString', '例如 [{"name":"Content-Type","value":"text/html; charset=utf-8"}]，可为空。'), parameter('响应体', 'wideString', '模拟响应正文，可为空。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_拦截模拟响应($1, 200, "", "${2:mock}")'
  },
  {
    name: 'CDP_拦截终止', signature: 'CDP_拦截终止(拦截, 失败原因)', description: '以网络错误终止被拦截的请求；失败原因必须是 CDP 枚举文本，如 Failed、Aborted、TimedOut、NameNotResolved、BlockedByClient。',
    parameters: [parameter('拦截', 'CDP拦截'), parameter('失败原因', 'wideString', '默认 Failed。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_拦截终止($1, "Aborted")'
  },
  {
    name: 'CDP_拦截应答认证', signature: 'CDP_拦截应答认证(拦截, 用户名, 密码)', description: '应答“需要认证”事件：提供用户名密码继续请求；用户名为空表示取消认证。',
    parameters: [parameter('拦截', 'CDP拦截'), parameter('用户名', 'wideString', '为空表示取消认证。'), parameter('密码', 'wideString')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_取拦截请求体', signature: 'CDP_取拦截请求体(拦截, 完成处理器)', description: '读取被拦截请求的提交体文本；完成后用 CDP_取当前事件文本 读取结果。',
    parameters: [parameter('拦截', 'CDP拦截'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_拦截停止', signature: 'CDP_拦截停止(页面)', description: '停止该页面的请求拦截并放行后续网络。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  // ===== 阶段 2：对话框与下载 =====
  {
    name: 'CDP_绑定对话框事件', signature: 'CDP_绑定对话框事件(页面, 处理器)', description: '订阅 alert/confirm/prompt/beforeunload 对话框；对话框打开时页面脚本阻塞，处理器内必须尽快 CDP_应答对话框，未绑定时运行时自动拒绝。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名；对话框事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_绑定对话框事件($1, &${2:对话框出现})'
  },
  {
    name: 'CDP_应答对话框', signature: 'CDP_应答对话框(页面, 接受, 提示文本)', description: '应答当前对话框：接受为真等于确认/确定，提示文本用于 prompt 应答输入。',
    parameters: [parameter('页面', 'CDP页面'), parameter('接受', 'bool'), parameter('提示文本', 'wideString', 'prompt 对话框的应答文本，可为空。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_应答对话框($1, 真, "")'
  },
  {
    name: 'CDP_设置下载目录', signature: 'CDP_设置下载目录(连接, 目录, 允许)', description: '控制浏览器下载行为：允许为真时下载到指定目录（必须已存在），为假时拒绝全部下载。',
    parameters: [parameter('连接', 'CDP连接'), parameter('目录', 'wideString', '已存在的目录绝对路径。'), parameter('允许', 'bool')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_设置下载目录($1, "${2:C:\\downloads}", 真)'
  },
  {
    name: 'CDP_绑定下载事件', signature: 'CDP_绑定下载事件(连接, 处理器)', description: '订阅下载事件：下载开始、下载进度、下载完成、下载取消；需先用 CDP_设置下载目录 允许下载。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('处理器', '必须使用 &处理器名；下载事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_绑定下载事件($1, &${2:下载事件})'
  },
  // ===== 阶段 2：上传与等待 =====
  {
    name: 'CDP_设置元素文件', signature: 'CDP_设置元素文件(元素, 文件路径, 完成处理器)', description: '为文件选择控件元素设置上传文件（DOM.setFileInputFiles）；文件必须真实存在。',
    parameters: [parameter('元素', 'CDP元素'), parameter('文件路径', 'wideString', '本机文件绝对路径。'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素',
    insertText: 'CDP_设置元素文件($1, "${2:C:\\upload.txt}", &${3:上传完成})'
  },
  {
    name: 'CDP_等待加载', signature: 'CDP_等待加载(页面, 事件类型, 超时秒, 完成处理器)', description: '等待页面生命周期事件：0=load、1=DOMContentLoaded、2=networkIdle（网络空闲）、3=networkAlmostIdle；到达后触发命令完成，超时触发命令失败。',
    parameters: [parameter('页面', 'CDP页面'), parameter('事件类型', 'int', '0=load，1=DOMContentLoaded，2=networkIdle，3=networkAlmostIdle。'), parameter('超时秒', 'int', '1 到 600。'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或超时时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '导航',
    insertText: 'CDP_等待加载($1, 2, 30, &${2:等待完成})'
  },
  // ===== 阶段 2：设备与网络仿真 =====
  {
    name: 'CDP_设置视口', signature: 'CDP_设置视口(页面, 宽度, 高度)', description: '覆盖页面视口尺寸；用 CDP_重置仿真 恢复。',
    parameters: [parameter('页面', 'CDP页面'), parameter('宽度', 'int'), parameter('高度', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_设置视口($1, 1280, 720)'
  },
  {
    name: 'CDP_设置UserAgent', signature: 'CDP_设置UserAgent(页面, UserAgent)', description: '覆盖页面 User-Agent。',
    parameters: [parameter('页面', 'CDP页面'), parameter('UserAgent', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置触摸', signature: 'CDP_设置触摸(页面, 启用)', description: '启用或关闭触摸事件仿真。',
    parameters: [parameter('页面', 'CDP页面'), parameter('启用', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置地理位置', signature: 'CDP_设置地理位置(页面, 纬度, 经度)', description: '覆盖 Geolocation API 返回的坐标；纬度 -90 到 90，经度 -180 到 180。',
    parameters: [parameter('页面', 'CDP页面'), parameter('纬度', 'double'), parameter('经度', 'double')], returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_设置地理位置($1, 31.23, 121.47)'
  },
  {
    name: 'CDP_设置时区', signature: 'CDP_设置时区(页面, 时区)', description: '覆盖页面时区，例如 Asia/Shanghai。',
    parameters: [parameter('页面', 'CDP页面'), parameter('时区', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置语言', signature: 'CDP_设置语言(页面, 语言)', description: '覆盖页面语言区域，例如 zh-CN。',
    parameters: [parameter('页面', 'CDP页面'), parameter('语言', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置暗色模式', signature: 'CDP_设置暗色模式(页面, 启用)', description: '模拟 prefers-color-scheme 为 dark 或 light。',
    parameters: [parameter('页面', 'CDP页面'), parameter('启用', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置CPU节流', signature: 'CDP_设置CPU节流(页面, 倍率)', description: '按倍率降低页面 CPU 速度（1=不节流，20=20 倍慢）。',
    parameters: [parameter('页面', 'CDP页面'), parameter('倍率', 'int', '1 到 100。')], returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_设置CPU节流($1, 4)'
  },
  {
    name: 'CDP_重置仿真', signature: 'CDP_重置仿真(页面)', description: '清除视口、UserAgent、触摸、地理位置和媒体特性覆盖。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '输入'
  },
  {
    name: 'CDP_设置离线', signature: 'CDP_设置离线(页面, 离线)', description: '模拟网络离线/恢复。',
    parameters: [parameter('页面', 'CDP页面'), parameter('离线', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  {
    name: 'CDP_设置限速', signature: 'CDP_设置限速(页面, 延迟毫秒, 下行速率, 上行速率)', description: '模拟网络限速：速率为字节每秒，-1 表示不限。',
    parameters: [parameter('页面', 'CDP页面'), parameter('延迟毫秒', 'int'), parameter('下行速率', 'longLong', '字节每秒，-1 不限。'), parameter('上行速率', 'longLong', '字节每秒，-1 不限。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '网络',
    insertText: 'CDP_设置限速($1, 100, 65536, 16384)'
  },
  {
    name: 'CDP_禁用缓存', signature: 'CDP_禁用缓存(页面, 禁用)', description: '为后续请求禁用或恢复 HTTP 缓存。',
    parameters: [parameter('页面', 'CDP页面'), parameter('禁用', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '网络'
  },
  // ===== 阶段 2：元素截图、窗口边界、弹窗与拖拽 =====
  {
    name: 'CDP_截图元素', signature: 'CDP_截图元素(元素, 文件路径, 完成处理器)', description: '滚动元素进入视口并只截取元素区域保存为 PNG。',
    parameters: [parameter('元素', 'CDP元素'), parameter('文件路径', 'wideString', 'PNG 输出路径。'), handlerParameter('完成处理器', '必须使用 &处理器名；写入完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '截图',
    insertText: 'CDP_截图元素($1, "${2:element.png}", &${3:截图完成})'
  },
  {
    name: 'CDP_取窗口边界', signature: 'CDP_取窗口边界(页面, 完成处理器)', description: '异步读取浏览器窗口边界；完成后用 CDP_取当前事件文本 读取 JSON 结果（左、上、宽、高、状态）。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '页面'
  },
  {
    name: 'CDP_设置窗口边界', signature: 'CDP_设置窗口边界(页面, 左, 上, 宽度, 高度)', description: '调整浏览器窗口位置和大小；宽高必须在 100 到 10000 之间。',
    parameters: [parameter('页面', 'CDP页面'), parameter('左', 'int'), parameter('上', 'int'), parameter('宽度', 'int'), parameter('高度', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '页面'
  },
  {
    name: 'CDP_绑定新页面事件', signature: 'CDP_绑定新页面事件(连接, 处理器)', description: '订阅浏览器新标签页/弹窗事件“新页面出现”；包括 CDP_新建页面 自己创建的页面，事件文本为网址、详情为目标编号，可用 CDP_附加页面 附加。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('处理器', '必须使用 &处理器名；事件在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'CDP_绑定新页面事件($1, &${2:新页面出现})'
  },
  {
    name: 'CDP_鼠标拖拽', signature: 'CDP_鼠标拖拽(页面, 起点横坐标, 起点纵坐标, 终点横坐标, 终点纵坐标, 步数)', description: '按住左键从起点拖拽到终点，中途按步数插值移动。',
    parameters: [parameter('页面', 'CDP页面'), parameter('起点横坐标', 'int'), parameter('起点纵坐标', 'int'), parameter('终点横坐标', 'int'), parameter('终点纵坐标', 'int'), parameter('步数', 'int', '1 到 100。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '输入',
    insertText: 'CDP_鼠标拖拽($1, 100, 100, 300, 100, 10)'
  },
  {
    name: 'CDP_调用函数', signature: 'CDP_调用函数(元素, 函数代码, 完成处理器)', description: '把元素作为唯一参数调用页面函数，例如 function(x){return x.value}；完成后用 CDP_取当前事件文本 读取返回值。',
    parameters: [parameter('元素', 'CDP元素'), parameter('函数代码', 'wideString', '形如 function(x){...} 的函数表达式。'), handlerParameter('完成处理器', '必须使用 &处理器名；完成或失败时在 UI 线程执行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '元素',
    insertText: 'CDP_调用函数($1, "function(x){return x.value}", &${2:调用完成})'
  },
  // 阶段 3：Target / Session / Frame
  {
    name: 'CDP_设置自动附加', signature: 'CDP_设置自动附加(连接, 启用, 启动时等待调试器, 完成处理器)', description: '开启或关闭 flatten Target 自动附加，用于 OOPIF、Dedicated/Shared/Service Worker；完成结果通过处理器通知。',
    parameters: [parameter('连接', 'CDP连接'), parameter('启用', 'bool'), parameter('启动时等待调试器', 'bool'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '目标'
  },
  {
    name: 'CDP_绑定目标事件', signature: 'CDP_绑定目标事件(连接, 处理器)', description: '订阅目标附加、分离、创建、更新、销毁和崩溃事件。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '目标'
  },
  {
    name: 'CDP_枚举目标JSON', signature: 'CDP_枚举目标JSON(连接, 类型)', description: '返回当前连接已发现目标的 UTF-16 JSON 快照；类型为空时返回全部目标。',
    parameters: [parameter('连接', 'CDP连接'), parameter('类型', 'wideString')], returnType: 'wideString', returnLabel: '文本型', category: '目标'
  },
  {
    name: 'CDP_附加目标', signature: 'CDP_附加目标(目标, 完成处理器)', description: '异步附加通用 Target，立即返回受管会话句柄；最终结果通过处理器通知。',
    parameters: [parameter('目标', 'CDP目标'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'CDP会话', returnLabel: 'CDP会话', category: '目标'
  },
  {
    name: 'CDP_分离会话', signature: 'CDP_分离会话(会话)', description: '分离 OOPIF 或 Worker flatten 会话，并使该会话的待处理命令与调用帧失效。',
    parameters: [parameter('会话', 'CDP会话')], returnType: 'bool', returnLabel: '逻辑型', category: '会话'
  },
  {
    name: 'CDP_会话执行脚本', signature: 'CDP_会话执行脚本(会话, 脚本代码, 完成处理器)', description: '在指定 OOPIF/Worker 会话执行脚本，完成后从当前事件文本读取结果。',
    parameters: [parameter('会话', 'CDP会话'), parameter('脚本代码', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '会话'
  },
  {
    name: 'CDP_取目标JSON', signature: 'CDP_取目标JSON(目标)', description: '返回目标 ID、类型、URL 和关联会话等不可变 JSON 快照。',
    parameters: [parameter('目标', 'CDP目标')], returnType: 'wideString', returnLabel: '文本型', category: '目标'
  },
  {
    name: 'CDP_取会话JSON', signature: 'CDP_取会话JSON(会话)', description: '返回会话所属连接、Target、页面和 attached 状态 JSON 快照。',
    parameters: [parameter('会话', 'CDP会话')], returnType: 'wideString', returnLabel: '文本型', category: '会话'
  },
  {
    name: 'CDP_枚举帧JSON', signature: 'CDP_枚举帧JSON(页面)', description: '返回页面及 OOPIF 已知 Frame 的 JSON 数组。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'wideString', returnLabel: '文本型', category: '会话'
  },
  // 阶段 3：Runtime binding、Overlay、Touch
  {
    name: 'CDP_添加页面绑定', signature: 'CDP_添加页面绑定(页面, 名称, 处理器)', description: '安装 Runtime.addBinding 双向绑定，新附加的 OOPIF/Worker 会话会自动重放绑定。',
    parameters: [parameter('页面', 'CDP页面'), parameter('名称', 'wideString'), handlerParameter('处理器', '必须使用 &处理器名；调用载荷通过当前事件文本读取。')], returnType: 'CDP绑定', returnLabel: 'CDP绑定', category: '绑定'
  },
  {
    name: 'CDP_移除页面绑定', signature: 'CDP_移除页面绑定(绑定)', description: '移除受管 Runtime binding。',
    parameters: [parameter('绑定', 'CDP绑定')], returnType: 'bool', returnLabel: '逻辑型', category: '绑定'
  },
  {
    name: 'CDP_高亮元素', signature: 'CDP_高亮元素(元素, 填充颜色)', description: '通过 Overlay.highlightRect 高亮元素；当前颜色参数保留用于后续主题化。',
    parameters: [parameter('元素', 'CDP元素'), parameter('填充颜色', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  {
    name: 'CDP_隐藏高亮', signature: 'CDP_隐藏高亮(页面)', description: '隐藏页面当前 Overlay 高亮。',
    parameters: [parameter('页面', 'CDP页面')], returnType: 'bool', returnLabel: '逻辑型', category: '元素'
  },
  {
    name: 'CDP_派发触摸', signature: 'CDP_派发触摸(页面, 类型, 触点JSON)', description: '派发严格 JSON 多点触控事件，类型为 touchStart、touchMove、touchEnd 或 touchCancel，最多 16 个触点。',
    parameters: [parameter('页面', 'CDP页面'), parameter('类型', 'wideString'), parameter('触点JSON', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '输入', visibility: 'advanced'
  },
  // 阶段 3：Debugger
  ...([
    ['CDP_启用调试器', 'Debugger.enable'], ['CDP_禁用调试器', 'Debugger.disable'], ['CDP_暂停调试', 'Debugger.pause'], ['CDP_恢复调试', 'Debugger.resume']
  ] as const).map(([name, method]) => ({
    name, signature: `${name}(页面, 完成处理器)`, description: `发送 ${method}；请求接受与最终暂停/恢复事件分开通知。`,
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool' as const, returnLabel: '逻辑型', category: '调试' as const
  })),
  {
    name: 'CDP_绑定调试事件', signature: 'CDP_绑定调试事件(页面, 处理器)', description: '订阅调试暂停、恢复和断点解析事件。',
    parameters: [parameter('页面', 'CDP页面'), handlerParameter('处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '调试'
  },
  {
    name: 'CDP_设置断点', signature: 'CDP_设置断点(页面, 网址, 行, 列, 条件, 完成处理器)', description: '按 URL 设置断点；行列从 1 开始，返回受管断点句柄。',
    parameters: [parameter('页面', 'CDP页面'), parameter('网址', 'wideString'), parameter('行', 'int'), parameter('列', 'int'), parameter('条件', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'CDP断点', returnLabel: 'CDP断点', category: '调试'
  },
  {
    name: 'CDP_移除断点', signature: 'CDP_移除断点(断点, 完成处理器)', description: '移除已解析断点。',
    parameters: [parameter('断点', 'CDP断点'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '调试'
  },
  {
    name: 'CDP_调试单步', signature: 'CDP_调试单步(页面, 类型, 完成处理器)', description: '调试单步：0 越过、1 进入、2 跳出。',
    parameters: [parameter('页面', 'CDP页面'), parameter('类型', 'int'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '调试'
  },
  {
    name: 'CDP_取当前调用帧数量', signature: 'CDP_取当前调用帧数量()', description: '返回当前调试暂停事件中的调用帧数量。', parameters: [], returnType: 'int', returnLabel: '整数型', category: '调试'
  },
  {
    name: 'CDP_取当前调用帧', signature: 'CDP_取当前调用帧(索引)', description: '按零基索引返回当前暂停 generation 内有效的调用帧句柄。', parameters: [parameter('索引', 'int')], returnType: 'CDP调用帧', returnLabel: 'CDP调用帧', category: '调试'
  },
  {
    name: 'CDP_取调用帧JSON', signature: 'CDP_取调用帧JSON(调用帧)', description: '返回调用帧不可变 JSON 快照。', parameters: [parameter('调用帧', 'CDP调用帧')], returnType: 'wideString', returnLabel: '文本型', category: '调试'
  },
  {
    name: 'CDP_调用帧执行脚本', signature: 'CDP_调用帧执行脚本(调用帧, 脚本代码, 完成处理器)', description: '在暂停调用帧求值；恢复后旧调用帧立即失效。', parameters: [parameter('调用帧', 'CDP调用帧'), parameter('脚本代码', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '调试'
  },
  {
    name: 'CDP_取作用域变量', signature: 'CDP_取作用域变量(调用帧, 作用域索引, 最大数量, 完成处理器)', description: '读取调用帧作用域属性，最大数量限制为 5000。', parameters: [parameter('调用帧', 'CDP调用帧'), parameter('作用域索引', 'int'), parameter('最大数量', 'int'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '调试'
  },
  // 阶段 3：Performance / Storage / 录制
  {
    name: 'CDP_取性能指标', signature: 'CDP_取性能指标(页面, 完成处理器)', description: '启用 Performance 域并异步返回稳定 JSON 指标。', parameters: [parameter('页面', 'CDP页面'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '性能'
  },
  {
    name: 'CDP_取存储用量', signature: 'CDP_取存储用量(连接, 来源, 完成处理器)', description: '查询 exact http/https origin 的 usage/quota。', parameters: [parameter('连接', 'CDP连接'), parameter('来源', 'wideString'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '存储'
  },
  {
    name: 'CDP_清理来源数据', signature: 'CDP_清理来源数据(连接, 来源, 存储类型, 已确认, 完成处理器)', description: '清理 exact origin 的 allowlist 存储类型；必须显式确认破坏性操作。', parameters: [parameter('连接', 'CDP连接'), parameter('来源', 'wideString'), parameter('存储类型', 'wideString'), parameter('已确认', 'bool'), handlerParameter('完成处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '存储', visibility: 'advanced'
  },
  {
    name: 'CDP_开启证书错误接管', signature: 'CDP_开启证书错误接管(连接, 来源白名单, 有效秒数, 处理器)', description: '高级安全命令：仅对逗号分隔的 exact http/https origin 白名单，在 1–600 秒内接管证书错误；每次错误仍需单独裁决。',
    parameters: [parameter('连接', 'CDP连接'), parameter('来源白名单', 'wideString'), parameter('有效秒数', 'int'), handlerParameter('处理器', '必须使用 &处理器名；未应答或超时自动取消。')], returnType: 'bool', returnLabel: '逻辑型', category: '网络', visibility: 'advanced'
  },
  {
    name: 'CDP_裁决证书错误', signature: 'CDP_裁决证书错误(证书错误, 允许)', description: '对一次证书错误显式继续或取消；句柄只能使用一次。',
    parameters: [parameter('证书错误', 'CDP证书错误'), parameter('允许', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '网络', visibility: 'advanced'
  },
  {
    name: 'CDP_关闭证书错误接管', signature: 'CDP_关闭证书错误接管(连接)', description: '恢复浏览器默认证书校验并自动取消该连接所有未决证书错误。',
    parameters: [parameter('连接', 'CDP连接')], returnType: 'bool', returnLabel: '逻辑型', category: '网络', visibility: 'advanced'
  },
  {
    name: 'CDP_绑定安全状态事件', signature: 'CDP_绑定安全状态事件(连接, 处理器)', description: '订阅只读安全状态事件；不启用任何证书绕过。',
    parameters: [parameter('连接', 'CDP连接'), handlerParameter('处理器', '必须使用 &处理器名。')], returnType: 'bool', returnLabel: '逻辑型', category: '事件'
  },
  {
    name: 'CDP_开始录制', signature: 'CDP_开始录制(页面, 文件路径, 处理器)', description: '开始 schemaVersion 1 自动化录制并返回受管句柄。', parameters: [parameter('页面', 'CDP页面'), parameter('文件路径', 'wideString'), handlerParameter('处理器', '必须使用 &处理器名。')], returnType: 'CDP录制', returnLabel: 'CDP录制', category: '录制'
  },
  {
    name: 'CDP_记录步骤', signature: 'CDP_记录步骤(录制, 类型, 数据JSON)', description: '向录制追加结构化步骤；敏感字段会替换为 SECRET 占位符。', parameters: [parameter('录制', 'CDP录制'), parameter('类型', 'wideString'), parameter('数据JSON', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '录制'
  },
  {
    name: 'CDP_停止录制', signature: 'CDP_停止录制(录制)', description: '停止录制并原子写入版本化 JSON 文件。', parameters: [parameter('录制', 'CDP录制')], returnType: 'bool', returnLabel: '逻辑型', category: '录制'
  },
  {
    name: 'CDP_加载回放', signature: 'CDP_加载回放(连接, 文件路径)', description: '加载录制文件并返回回放句柄；执行器将在后续阶段 3 增量中启用。', parameters: [parameter('连接', 'CDP连接'), parameter('文件路径', 'wideString')], returnType: 'CDP回放', returnLabel: 'CDP回放', category: '录制'
  },
  {
    name: 'CDP_取录制状态', signature: 'CDP_取录制状态(录制)', description: '返回录制状态。', parameters: [parameter('录制', 'CDP录制')], returnType: 'wideString', returnLabel: '文本型', category: '录制'
  },
  {
    name: 'CDP_取回放状态', signature: 'CDP_取回放状态(回放)', description: '返回回放状态。', parameters: [parameter('回放', 'CDP回放')], returnType: 'wideString', returnLabel: '文本型', category: '录制'
  },
  ...([
    ['CDP_取当前目标', 'CDP目标', 'CDP目标', '返回当前 Target 事件对应的受管目标句柄。'],
    ['CDP_取当前会话', 'CDP会话', 'CDP会话', '返回当前 Target、Debugger 或 binding 事件对应的会话句柄。'],
    ['CDP_取当前帧', 'CDP帧', 'CDP帧', '返回当前 Frame 事件对应的帧句柄。'],
    ['CDP_取当前绑定', 'CDP绑定', 'CDP绑定', '返回当前 Runtime binding 事件对应的绑定句柄。'],
    ['CDP_取当前任务', 'CDP任务', 'CDP任务', '返回当前长任务事件对应的任务句柄。'],
    ['CDP_取当前断点', 'CDP断点', 'CDP断点', '返回当前断点事件对应的断点句柄。'],
    ['CDP_取当前证书错误', 'CDP证书错误', 'CDP证书错误', '返回当前证书错误事件的一次性裁决句柄。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}()`, description, parameters: [], returnType, returnLabel, category: '快照' as const
  })),
  ...([
    ['CDP_取当前事件类型', 'wideString', '文本型', '返回当前回调事件类型：已就绪、连接失败、已断开、页面就绪、页面失败、加载完成、页面销毁、命令完成、命令失败、网络请求、网络响应、网络完成、网络失败、请求被拦截、需要认证、对话框出现、下载开始、下载进度、下载完成、下载取消、新页面出现、控制台或页面异常。'],
    ['CDP_取当前事件文本', 'wideString', '文本型', '返回当前事件的结果文本、错误说明或 JSON 数据快照；拦截事件返回请求头 JSON。'],
    ['CDP_取当前事件详情', 'wideString', '文本型', '返回当前事件的补充信息，例如控制台级别、拦截阶段（请求/响应）、对话框类型或下载编号。'],
    ['CDP_取当前错误', 'wideString', '文本型', '返回当前事件的中文错误说明；无错误返回空文本。'],
    ['CDP_取当前网络网址', 'wideString', '文本型', '返回当前网络事件或拦截事件的请求网址。'],
    ['CDP_取当前网络方法', 'wideString', '文本型', '返回当前网络事件或拦截事件的 HTTP 方法。'],
    ['CDP_取当前网络编号', 'wideString', '文本型', '返回当前网络事件或拦截事件的请求编号，供 CDP_取网络响应体 使用。'],
    ['CDP_取当前对话框消息', 'wideString', '文本型', '返回当前对话框事件的提示消息。'],
    ['CDP_取当前对话框类型', 'wideString', '文本型', '返回当前对话框类型：alert、confirm、prompt 或 beforeunload。'],
    ['CDP_取当前对话框默认文本', 'wideString', '文本型', '返回 prompt 对话框的默认输入文本。'],
    ['CDP_取当前下载文件名', 'wideString', '文本型', '返回当前下载事件对应的建议文件名。'],
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}()`, description, parameters: [], returnType, returnLabel, category: '快照' as const
  })),
  {
    name: 'CDP_取当前网络状态', signature: 'CDP_取当前网络状态()', description: '返回当前网络响应事件或响应阶段拦截的 HTTP 状态码；其它事件返回 0。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '快照'
  },
  {
    name: 'CDP_取当前下载进度', signature: 'CDP_取当前下载进度()', description: '返回当前下载事件的百分比进度（0-100）。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '快照'
  },
  {
    name: 'CDP_取当前拦截', signature: 'CDP_取当前拦截()', description: '返回当前拦截事件对应的受管 CDP拦截 句柄，供 CDP_拦截继续、CDP_拦截改写、CDP_拦截模拟响应、CDP_拦截终止或 CDP_拦截应答认证 裁决。',
    parameters: [], returnType: 'CDP拦截', returnLabel: 'CDP拦截', category: '快照'
  },
  {
    name: 'CDP_取当前连接', signature: 'CDP_取当前连接()', description: '返回当前事件对应的受管连接 ID。',
    parameters: [], returnType: 'CDP连接', returnLabel: 'CDP连接', category: '快照'
  },
  {
    name: 'CDP_取当前页面', signature: 'CDP_取当前页面()', description: '返回当前事件对应的受管页面 ID；连接级事件返回 0。',
    parameters: [], returnType: 'CDP页面', returnLabel: 'CDP页面', category: '快照'
  }
];

function contribution(spec: CdpClientCommandSpec): ModuleCommandContribution {
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || `${spec.name}(${spec.parameters.map((item, index) => item.type === 'handler' ? `&$${index + 1}` : `$${index + 1}`).join(', ')})`,
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: 'managed',
    visibility: spec.visibility
  };
}

function binding(spec: CdpClientCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: spec.parameters.some(item => item.type === 'wideString' || item.type === 'handler') || spec.returnType === 'wideString' ? 'wide' : 'raw',
    example: spec.insertText?.replace(/\$\{\d+:([^}]*)\}/gu, '$1').replace(/\$\d+/gu, '示例值') || `${spec.name}()`,
    description: spec.description
  };
}

export const CDP_CLIENT_COMMAND_SPECS = specs;

export const CDP_CLIENT_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: CDP_CLIENT_MODULE_ID,
  name: 'CDP 客户端模块',
  version: '3.0.0',
  minLingBuilderVersion: '0.6.0',
  category: '网络',
  description: '提供 Chrome DevTools Protocol 受管客户端：多连接多调试端口并存、页面与 Target/Session flatten 路由、OOPIF/Worker、Runtime binding、Debugger、Performance、Storage 和严格证书裁决地基；阶段 3 的 screencast、完整性能任务与确定性回放仍在实施。',
  author: 'LingBuilder',
  license: 'LingBuilder Built-in Module License',
  tags: ['内置', '网络', 'CDP', 'Chrome DevTools Protocol', '浏览器自动化', '多连接', '请求拦截', 'WebSocket', '截图', '仿真'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'CDP连接', description: '进程内不复用的受管 CDP 浏览器连接 ID；支持多个连接并存，不暴露原生 WinHTTP 句柄。', cppType: 'long long' },
      { name: 'CDP页面', description: '从属于某个 CDP 连接的受管页面会话 ID，对应一个 flatten 模式 sessionId。', cppType: 'long long' },
      { name: 'CDP元素', description: '从属于某个页面会话的受管元素引用 ID，保存 CSS 选择器，操作时校验有效性。', cppType: 'long long' },
      { name: 'CDP拦截', description: '一次被暂停请求的受管拦截句柄；只能被继续、改写、模拟响应、终止或应答认证裁决一次。', cppType: 'long long' },
      { name: 'CDP目标', description: '浏览器 Target 的受管句柄，可表示 page、iframe、worker、shared_worker 或 service_worker。', cppType: 'long long' },
      { name: 'CDP会话', description: 'flatten 模式下 Target 会话的受管句柄，用于 OOPIF/Worker 独立命令路由。', cppType: 'long long' },
      { name: 'CDP帧', description: '页面 Frame 的受管句柄，包含所属会话、父 Frame 和 generation。', cppType: 'long long' },
      { name: 'CDP绑定', description: 'Runtime.addBinding 双向通信的受管句柄。', cppType: 'long long' },
      { name: 'CDP断点', description: 'Debugger 断点的受管句柄。', cppType: 'long long' },
      { name: 'CDP调用帧', description: '仅在当前暂停 generation 有效的 Debugger 调用帧句柄。', cppType: 'long long' },
      { name: 'CDP任务', description: 'Trace、CPU、覆盖率、Heap 等长任务的受管句柄。', cppType: 'long long' },
      { name: 'CDP证书错误', description: '一次证书错误裁决的受管句柄，仅允许继续或拒绝一次。', cppType: 'long long' },
      { name: 'CDP录制', description: '浏览器自动化录制的受管句柄。', cppType: 'long long' },
      { name: 'CDP回放', description: '版本化录制文件回放的受管句柄。', cppType: 'long long' }
    ],
    snippets: [
      {
        label: 'CDP 多连接自动化',
        insertText: 'CDP连接 连接A = CDP_连接("http://127.0.0.1:9222", &连接就绪)\nCDP连接 连接B = CDP_连接("http://127.0.0.1:9223", &连接就绪)\nCDP页面 页面 = CDP_新建页面(连接A, "https://example.com", &页面就绪)',
        description: '同时连接多个调试端口，每个连接独立 WebSocket、独立会话状态。'
      },
      {
        label: 'CDP 页面自动化处理链',
        insertText: '空 页面就绪()\n    如果 (CDP_取当前事件类型() == "页面就绪")\n        CDP_打开网址(CDP_取当前页面(), "https://example.com", &加载完成)\n    否则\n        调试输出(CDP_取当前错误())\n    如果结束\n结束\n\n空 加载完成()\n    CDP_元素 按钮 = CDP_查询元素(CDP_取当前页面(), "#submit")\n    CDP_点击元素(按钮, &点击完成)\n结束',
        description: '新建页面后等待加载、查询元素并点击的典型异步链。'
      }
    ],
    docs: [{ title: 'CDP 客户端模块 3.0 使用说明', path: 'docs/modules/cdp-client/README.md' }]
  },
  targets: [
    {
      id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_CDP_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    },
    {
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_CDP_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    }
  ],
  bindings: { commands: specs.map(binding) }
};
