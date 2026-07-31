export type EdgeViewEventSource =
  | 'webView'
  | 'controller'
  | 'environment'
  | 'download'
  | 'find'
  | 'frame'
  | 'notification'
  | 'profile'
  | 'worker'
  | 'devTools'
  | 'contextMenuItem';

export interface EdgeViewBrowserEventDefinition {
  id: string;
  name: string;
  category: string;
  source: EdgeViewEventSource;
  description: string;
  /** Preserve the four IDs used by projects created before the full event catalog. */
  designerId?: string;
}

export const EDGEVIEW_COMPOSITION_ONLY_EVENTS = [
  { id: 'CompositionController.CursorChanged', name: '合成控制器鼠标指针改变' },
  { id: 'CompositionController.NonClientRegionChanged', name: '合成控制器非客户区改变' }
] as const;

const define = (
  category: string,
  source: EdgeViewEventSource,
  events: Array<[id: string, name: string, description: string, designerId?: string]>
): EdgeViewBrowserEventDefinition[] => events.map(([id, name, description, designerId]) => ({
  id,
  name,
  category,
  source,
  description,
  designerId
}));

/**
 * Stable add_* events exposed by Microsoft.Web.WebView2 1.0.4078.44 for a
 * windowed HWND controller and the event objects reachable from it.
 * CompositionController-only CursorChanged/NonClientRegionChanged are not
 * listed because LingBuilder deliberately uses ICoreWebView2Controller.
 */
export const EDGEVIEW_BROWSER_EVENTS: readonly EdgeViewBrowserEventDefinition[] = [
  ...define('导航与加载', 'webView', [
    ['NavigationStarting', '导航开始', '顶层页面开始导航。', 'NavigationStarting'],
    ['ContentLoading', '内容加载', '顶层页面开始加载内容。'],
    ['SourceChanged', '地址改变', '浏览器当前地址改变。'],
    ['HistoryChanged', '历史记录改变', '前进、后退历史记录状态改变。'],
    ['NavigationCompleted', '导航完成', '顶层页面导航完成或失败。', 'NavigationCompleted'],
    ['FrameNavigationStarting', '框架导航开始', '任意框架开始导航。'],
    ['FrameNavigationCompleted', '框架导航完成', '任意框架导航完成或失败。'],
    ['DOMContentLoaded', 'DOM加载完成', '顶层页面 DOMContentLoaded。'],
    ['DocumentTitleChanged', '标题改变', '网页标题改变。', 'TitleChanged'],
    ['ContainsFullScreenElementChanged', '全屏元素状态改变', '网页进入或退出全屏元素状态。'],
    ['WindowCloseRequested', '窗口关闭请求', '网页脚本请求关闭当前窗口。']
  ]),
  ...define('脚本、消息与窗口', 'webView', [
    ['ScriptDialogOpening', '脚本对话框打开', '网页请求 alert、confirm、prompt 或 beforeunload 对话框。'],
    ['WebMessageReceived', '网页消息', '收到网页通过 chrome.webview.postMessage 发送的消息。', 'WebMessageReceived'],
    ['NewWindowRequested', '新窗口请求', '网页请求打开新窗口。'],
    ['LaunchingExternalUriScheme', '外部URI方案启动', '网页请求启动系统外部 URI 方案。']
  ]),
  ...define('网络、权限与安全', 'webView', [
    ['PermissionRequested', '权限请求', '网页请求摄像头、麦克风、定位等权限。'],
    ['WebResourceRequested', 'Web资源请求', '匹配过滤器的网络资源请求即将发送。'],
    ['WebResourceResponseReceived', 'Web资源响应收到', '网络资源响应已收到。'],
    ['ClientCertificateRequested', '客户端证书请求', '服务器请求客户端证书。'],
    ['BasicAuthenticationRequested', '基本身份验证请求', '服务器请求 HTTP 基本身份验证。'],
    ['ServerCertificateErrorDetected', '服务器证书错误', '检测到服务器 TLS 证书错误。'],
    ['SaveFileSecurityCheckStarting', '保存文件安全检查开始', '保存文件前执行安全检查。'],
    ['ScreenCaptureStarting', '屏幕捕获开始', '网页内容即将被屏幕捕获。']
  ]),
  ...define('进程、下载与界面', 'webView', [
    ['ProcessFailed', '进程失败', '浏览器或渲染进程失败。'],
    ['FrameCreated', '框架创建', '顶层 WebView 创建了子框架。'],
    ['DownloadStarting', '下载开始', '网页下载任务开始。'],
    ['IsMutedChanged', '静音状态改变', '浏览器静音状态改变。'],
    ['IsDocumentPlayingAudioChanged', '音频播放状态改变', '文档是否播放音频的状态改变。'],
    ['IsDefaultDownloadDialogOpenChanged', '下载对话框状态改变', '默认下载对话框打开状态改变。'],
    ['ContextMenuRequested', '右键菜单请求', '网页请求显示上下文菜单。'],
    ['StatusBarTextChanged', '状态栏文本改变', '浏览器状态栏文本改变。'],
    ['FaviconChanged', '网站图标改变', '当前网页 Favicon 地址改变。'],
    ['NotificationReceived', '网页通知收到', '收到网页通知。'],
    ['SaveAsUIShowing', '另存为界面显示', '浏览器将显示另存为界面。']
  ]),
  ...define('控制器', 'controller', [
    ['Controller.ZoomFactorChanged', '缩放比例改变', '浏览器控制器缩放比例改变。'],
    ['Controller.MoveFocusRequested', '移动焦点请求', '浏览器请求把焦点移入或移出控件。'],
    ['Controller.GotFocus', '浏览器获得焦点', '浏览器控制器获得焦点。'],
    ['Controller.LostFocus', '浏览器失去焦点', '浏览器控制器失去焦点。'],
    ['Controller.AcceleratorKeyPressed', '浏览器快捷键按下', '浏览器控制器收到加速键。'],
    ['Controller.RasterizationScaleChanged', '光栅化缩放改变', '控制器光栅化缩放比例改变。']
  ]),
  ...define('浏览器环境', 'environment', [
    ['Environment.NewBrowserVersionAvailable', '新浏览器版本可用', 'WebView2 Runtime 新版本可用于后续进程。'],
    ['Environment.BrowserProcessExited', '浏览器进程退出', 'WebView2 浏览器进程退出。'],
    ['Environment.ProcessInfosChanged', '进程信息改变', 'WebView2 进程信息集合改变。']
  ]),
  ...define('下载任务', 'download', [
    ['Download.BytesReceivedChanged', '下载字节数改变', '下载任务已接收字节数改变。'],
    ['Download.EstimatedEndTimeChanged', '下载预计结束时间改变', '下载任务预计结束时间改变。'],
    ['Download.StateChanged', '下载状态改变', '下载任务状态改变。']
  ]),
  ...define('页内查找', 'find', [
    ['Find.ActiveMatchIndexChanged', '查找当前匹配改变', '页内查找当前匹配序号改变。'],
    ['Find.MatchCountChanged', '查找匹配数改变', '页内查找匹配总数改变。']
  ]),
  ...define('子框架', 'frame', [
    ['Frame.NameChanged', '子框架名称改变', '子框架名称改变。'],
    ['Frame.Destroyed', '子框架销毁', '子框架对象销毁。'],
    ['Frame.NavigationStarting', '子框架导航开始', '指定子框架开始导航。'],
    ['Frame.ContentLoading', '子框架内容加载', '指定子框架开始加载内容。'],
    ['Frame.NavigationCompleted', '子框架导航完成', '指定子框架导航完成或失败。'],
    ['Frame.DOMContentLoaded', '子框架DOM加载完成', '指定子框架 DOMContentLoaded。'],
    ['Frame.WebMessageReceived', '子框架网页消息', '收到指定子框架发送的网页消息。'],
    ['Frame.PermissionRequested', '子框架权限请求', '指定子框架请求网页权限。'],
    ['Frame.ScreenCaptureStarting', '子框架屏幕捕获开始', '指定子框架即将被屏幕捕获。'],
    ['Frame.FrameCreated', '嵌套子框架创建', '指定子框架创建了嵌套子框架。'],
    ['Frame.DedicatedWorkerCreated', '框架专用工作线程创建', '指定子框架创建了 Dedicated Worker。']
  ]),
  ...define('关联对象', 'notification', [
    ['Notification.CloseRequested', '网页通知关闭请求', '网页通知对象请求关闭。']
  ]),
  ...define('关联对象', 'profile', [
    ['Profile.Deleted', '浏览器配置删除', '当前 WebView2 Profile 已删除。']
  ]),
  ...define('工作线程', 'worker', [
    ['DedicatedWorkerCreated', '专用工作线程创建', '当前 WebView 创建了 Dedicated Worker。'],
    ['DedicatedWorker.Destroying', '专用工作线程销毁', 'Dedicated Worker 即将销毁。'],
    ['DedicatedWorker.WebMessageReceived', '专用工作线程消息', '收到 Dedicated Worker 网页消息。'],
    ['ServiceWorker.ServiceWorkerRegistered', '服务工作线程注册', 'Service Worker 注册可用。'],
    ['ServiceWorker.ServiceWorkerActivated', '服务工作线程激活', 'Service Worker 已激活。'],
    ['ServiceWorker.Unregistering', '服务工作线程注销', 'Service Worker 注册即将注销。'],
    ['SharedWorker.SharedWorkerCreated', '共享工作线程创建', 'Shared Worker 已创建。'],
    ['SharedWorker.Destroying', '共享工作线程销毁', 'Shared Worker 即将销毁。']
  ]),
  ...define('关联对象', 'devTools', [
    ['DevToolsProtocolEventReceived', '开发者工具协议事件', '收到已监听的 Chromium DevTools Protocol 事件。']
  ]),
  ...define('关联对象', 'contextMenuItem', [
    ['ContextMenuItem.CustomItemSelected', '自定义右键菜单项选择', '用户选择 LingBuilder 注入的 WebView2 菜单项。']
  ])
] as const;

export const EDGEVIEW_BROWSER_EVENT_NAMES = EDGEVIEW_BROWSER_EVENTS.map(event => event.name);
