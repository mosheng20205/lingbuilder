export type Cef3EventKind = 'notification' | 'decision' | 'highFrequency';

export interface Cef3BrowserEventDefinition {
  id: string;
  name: string;
  category: string;
  kind: Cef3EventKind;
  description: string;
  legacyDesignerId?: string;
}

const define = (
  category: string,
  kind: Cef3EventKind,
  events: Array<[id: string, name: string, description: string, legacyDesignerId?: string]>
): Cef3BrowserEventDefinition[] => events.map(([id, name, description, legacyDesignerId]) => ({
  id, name, category, kind, description, legacyDesignerId
}));

/** CEF 150 windowed CefBrowser callbacks exposed by CefClient and its request handlers. */
export const CEF3_BROWSER_EVENTS: readonly Cef3BrowserEventDefinition[] = [
  ...define('生命周期', 'notification', [
    ['OnAfterCreated', '浏览器创建完成', '浏览器对象创建完成。'],
    ['OnBeforeClose', '浏览器即将关闭', '浏览器销毁前通知。'],
    ['OnBeforePopupAborted', '新窗口打开已中止', '新窗口创建流程被中止。'],
    ['OnBeforeDevToolsPopup', '开发者工具窗口打开前', '开发者工具弹窗创建前通知。']
  ]),
  ...define('生命周期', 'decision', [
    ['DoClose', '浏览器请求关闭', '浏览器请求关闭，可接管。'],
    ['OnBeforePopup', '新窗口打开前', '网页请求打开新窗口，可允许、拒绝或接管。']
  ]),
  ...define('加载与显示', 'notification', [
    ['OnLoadingStateChange', '加载状态改变', '加载、前进和后退状态改变。'],
    ['OnLoadStart', '开始加载', '主框架或子框架开始加载。', 'LoadStart'],
    ['OnLoadEnd', '加载完成', '主框架或子框架加载完成。', 'LoadEnd'],
    ['OnLoadError', '加载失败', '主框架或子框架加载失败。', 'LoadError'],
    ['OnAddressChange', '地址被改变', '框架地址改变。', 'AddressChanged'],
    ['OnTitleChange', '标题被改变', '网页标题改变。', 'TitleChanged'],
    ['OnFaviconURLChange', '网页图标地址改变', '网页图标候选地址改变。'],
    ['OnFullscreenModeChange', '全屏状态改变', '网页进入或退出全屏。'],
    ['OnStatusMessage', '状态消息改变', '网页状态消息改变。'],
    ['OnMediaAccessChange', '媒体访问状态改变', '摄像头或麦克风使用状态改变。']
  ]),
  ...define('加载与显示', 'highFrequency', [
    ['OnLoadingProgressChange', '加载进度改变', '页面加载进度改变。']
  ]),
  ...define('加载与显示', 'decision', [
    ['OnTooltip', '工具提示显示', '工具提示显示前，可修改文本或接管。'],
    ['OnConsoleMessage', '控制台消息', 'JavaScript 控制台消息，可标记已处理。'],
    ['OnAutoResize', '自动调整大小', '浏览器请求自动调整大小。'],
    ['OnCursorChange', '鼠标指针改变', '网页请求改变鼠标指针。'],
    ['OnContentsBoundsChange', '内容边界改变', '网页请求改变内容边界。']
    ,['GetRootWindowScreenRect', '根窗口屏幕区域查询', '查询外部根窗口屏幕区域。']
  ]),
  ...define('菜单与对话框', 'notification', [
    ['OnBeforeContextMenu', '上下文菜单显示前', '网页上下文菜单显示前。'],
    ['OnContextMenuDismissed', '上下文菜单已关闭', '上下文菜单关闭。'],
    ['OnQuickMenuDismissed', '快速菜单已关闭', '快速菜单关闭。'],
    ['OnResetDialogState', '脚本对话框状态重置', '脚本对话框状态重置。'],
    ['OnDialogClosed', '脚本对话框已关闭', '脚本对话框关闭。']
  ]),
  ...define('菜单与对话框', 'decision', [
    ['RunContextMenu', '运行上下文菜单', '可接管网页上下文菜单。'],
    ['OnContextMenuCommand', '上下文菜单命令', '上下文菜单命令触发。'],
    ['RunQuickMenu', '运行快速菜单', '可接管快速菜单。'],
    ['OnQuickMenuCommand', '快速菜单命令', '快速菜单命令触发。'],
    ['OnFileDialog', '文件对话框请求', '网页请求文件或目录对话框。'],
    ['OnJSDialog', '脚本对话框请求', '网页请求 alert、confirm 或 prompt。'],
    ['OnBeforeUnloadDialog', '离开页面确认请求', '网页请求离开页面确认。']
  ]),
  ...define('输入与焦点', 'notification', [
    ['OnTakeFocus', '焦点即将移出', '焦点即将移出浏览器。'],
    ['OnGotFocus', '浏览器获得焦点', '浏览器获得焦点。'],
    ['OnDraggableRegionsChanged', '网页可拖动区域改变', '网页可拖动区域改变。'],
    ['OnFindResult', '页内查找结果', '页内查找结果更新。']
  ]),
  ...define('输入与焦点', 'decision', [
    ['OnSetFocus', '浏览器请求焦点', '浏览器请求获得焦点。'],
    ['OnPreKeyEvent', '键盘事件预处理', 'Chromium 处理键盘事件前。'],
    ['OnKeyEvent', '键盘事件', 'Chromium 未处理的键盘事件。'],
    ['OnDragEnter', '拖入浏览器', '拖放数据进入浏览器。'],
    ['OnChromeCommand', 'Chrome命令', 'Chrome 命令触发。'],
    ['IsChromeAppMenuItemVisible', '应用菜单项可见性查询', '查询应用菜单项可见性。'],
    ['IsChromeAppMenuItemEnabled', '应用菜单项启用查询', '查询应用菜单项启用状态。'],
    ['IsChromePageActionIconVisible', '页面动作图标可见性查询', '查询页面动作图标可见性。'],
    ['IsChromeToolbarButtonVisible', '工具栏按钮可见性查询', '查询工具栏按钮可见性。']
  ]),
  ...define('下载', 'decision', [
    ['CanDownload', '下载许可查询', '下载开始前查询是否允许。'],
    ['OnBeforeDownload', '下载开始', '下载目标确认前，可指定保存路径或取消。']
  ]),
  ...define('下载', 'highFrequency', [
    ['OnDownloadUpdated', '下载进度更新', '下载进度和状态更新。']
  ]),
  ...define('权限与安全', 'notification', [
    ['OnDismissPermissionPrompt', '网站权限提示关闭', '网站权限提示关闭。']
  ]),
  ...define('权限与安全', 'decision', [
    ['OnRequestMediaAccessPermission', '媒体权限请求', '网页请求摄像头或麦克风权限。'],
    ['OnShowPermissionPrompt', '网站权限请求', '网页请求网站权限。'],
    ['GetAuthCredentials', '身份验证请求', '服务器或代理请求凭据。'],
    ['OnCertificateError', '证书错误', 'HTTPS 证书验证失败。'],
    ['OnSelectClientCertificate', '客户端证书选择', '服务器请求客户端证书。']
  ]),
  ...define('网络与资源', 'decision', [
    ['OnBeforeBrowse', '导航请求前', '导航提交前，可取消。'],
    ['OnOpenURLFromTab', '标签页打开地址请求', '标签页打开地址前，可取消。'],
    ['OnBeforeResourceLoad', '资源加载前', '资源请求发送前，可修改或取消。'],
    ['OnResourceResponse', '资源响应到达', '资源响应头到达。'],
    ['OnProtocolExecution', '外部协议执行请求', '外部协议执行前，可允许或拒绝。'],
    ['CanSendCookie', '发送Cookie查询', 'Cookie 发送前，可拒绝。'],
    ['CanSaveCookie', '保存Cookie查询', 'Cookie 保存前，可拒绝。']
    ,['GetResourceRequestHandler', '资源请求处理器查询', '查询资源请求处理器与默认处理策略。']
    ,['GetCookieAccessFilter', 'Cookie过滤器查询', '查询资源请求的 Cookie 过滤器。']
    ,['GetResourceHandler', '自定义资源处理器查询', '查询自定义资源内容处理器。']
    ,['GetResourceResponseFilter', '资源响应过滤器查询', '查询资源响应内容过滤器。']
  ]),
  ...define('网络与资源', 'notification', [
    ['OnResourceRedirect', '资源重定向', '资源请求重定向，可修改新地址。']
  ]),
  ...define('网络与资源', 'highFrequency', [
    ['OnResourceLoadComplete', '资源加载完成', '资源加载完成、失败或取消。']
  ]),
  ...define('音频与打印', 'decision', [
    ['GetAudioParameters', '音频参数请求', '音频流开始前请求音频参数。'],
    ['OnPrintDialog', '打印对话框请求', '打印对话框请求。'],
    ['OnPrintJob', '打印任务提交', '打印任务提交。']
    ,['GetPdfPaperSize', 'PDF纸张大小查询', '查询 PDF 输出纸张大小。']
  ]),
  ...define('音频与打印', 'notification', [
    ['OnAudioStreamStarted', '音频流开始', '浏览器音频流开始。'],
    ['OnAudioStreamStopped', '音频流停止', '浏览器音频流停止。'],
    ['OnAudioStreamError', '音频流错误', '浏览器音频流错误。'],
    ['OnPrintStart', '打印开始', '打印任务开始。'],
    ['OnPrintSettings', '打印设置请求', '打印设置即将应用。'],
    ['OnPrintReset', '打印状态重置', '打印状态重置。']
  ]),
  ...define('音频与打印', 'highFrequency', [
    ['OnAudioStreamPacket', '音频数据包', '浏览器 PCM 音频数据包到达。']
  ]),
  ...define('框架与进程', 'notification', [
    ['OnFrameCreated', '框架创建', '主框架或子框架创建。'],
    ['OnFrameDestroyed', '框架销毁', '主框架或子框架销毁。'],
    ['OnFrameAttached', '框架附加', '框架连接到渲染进程。'],
    ['OnFrameDetached', '框架分离', '框架与渲染进程分离。'],
    ['OnMainFrameChanged', '主框架改变', '主框架对象改变。'],
    ['OnRenderViewReady', '渲染视图就绪', '渲染视图可接收消息。'],
    ['OnRenderProcessResponsive', '渲染进程恢复响应', '渲染进程恢复响应。'],
    ['OnRenderProcessTerminated', '渲染进程终止', '渲染进程终止。'],
    ['OnDocumentAvailableInMainFrame', '主文档可用', '主框架 document 已创建。'],
    ['OnProcessMessageReceived', '进程消息收到', '收到渲染进程消息。']
  ]),
  ...define('框架与进程', 'decision', [
    ['OnRenderProcessUnresponsive', '渲染进程无响应', '渲染进程无响应，可等待或终止。']
  ])
] as const;

export const CEF3_BROWSER_EVENT_NAMES = CEF3_BROWSER_EVENTS.map(event => event.name);
