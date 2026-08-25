const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SOURCE = 'T:\\编程工具\\win_android\\plugins\\vprj_win\\classlib\\sys\\FBrowser';
const EXPECTED_HEADER_COUNT = 77;
const EXPECTED_SIGNATURE_COUNT = 1079;
const EXPECTED_EVENT_SLOT_COUNT = 174;
const EXPECTED_UNIQUE_EVENT_SIGNATURE_COUNT = 158;
const EXPECTED_BRIDGE_VERSION = '2.1.0';
const REQUIRED_EVENT_V3_EXPORTS = Object.freeze([
  'LB_FBro_SetEventCallbackV3',
  'LB_FBro_SetEventSubscription',
  'LB_FBro_CompleteEventContinuation',
  'LB_FBro_CancelEventContinuation'
]);
const EXPECTED_EVENT_CLASS_COUNTS = Object.freeze({
  FBroHsBroEvent: 90,
  FBroHsInitEvent: 31,
  FBroHsResourceHandler: 8,
  FBroHsResponseFilter: 4,
  FBroHsDownloadImageCallback: 1,
  FBroHsFileDialogCallback: 1,
  FBroHsPdfPrintCallback: 1,
  FBroHsStringVisitor: 1,
  FBroHsJsCallback: 1,
  FBroHsDOMVisitor: 1,
  FBroHsTask: 1,
  FBroHsCookieVisitor: 3,
  FBroHsQueryHandler: 2,
  FBroHsV8Handler: 3,
  FBroHsV8Accessor: 4,
  FBroHsV8Interceptor: 6,
  FBroHsServerHandle: 8,
  FBroHsClearCacheCallback: 1,
  FBroHsURLRequestClient: 7
});
const IMPLEMENTED_EVENT_NAMES = new Map([
  ['OnAfterCreated', 'Created'],
  ['OnLoadEnd', 'LoadEnd'],
  ['OnAddressChange', 'AddressChanged'],
  ['OnBeforePopup', 'BeforePopup'],
  ['OnTitleChange', 'TitleChanged'],
  ['OnBeforeClose', 'Closed'],
  ['OnLoadError', 'Error'],
  ['OnCertificateError', 'CertificateError'],
  ['OnDragEnter', 'DragEnter']
]);

const MANAGED_CALLBACK_EVENT_NAMES = new Set([
  'GetAuthCredentials', 'OnBeforeDownload', 'OnBeforeResourceLoad', 'OnBeforeUnloadDialog',
  'OnDownloadUpdated', 'OnFileDialog', 'OnJSDialog', 'OnQuotaRequest',
  'OnRequestMediaAccessPermission', 'OnSelectClientCertificate', 'OnShowPermissionPrompt',
  'RunContextMenu', 'RunQuickMenu'
]);

const MANAGED_BROWSER_EVENT_BOUNDARIES = new Set([
  'GetAuthCredentials'
]);

const EVENT_RESPONSE_PROPERTIES = Object.freeze({
  GetAuthCredentials: { username: { type: 'utf16' }, password: { type: 'utf16' } },
  OnBeforeDownload: { path: { type: 'utf16' }, showDialog: { type: 'bool' } },
  OnBeforeUnloadDialog: { success: { type: 'bool' }, userInput: { type: 'utf16' } },
  OnDownloadUpdated: { downloadAction: { type: 'integer', enum: [0, 1, 2] } },
  OnFileDialog: { paths: { type: 'array', items: { type: 'utf16' } } },
  OnJSDialog: { success: { type: 'bool' }, userInput: { type: 'utf16' }, suppressMessage: { type: 'bool' } },
  OnRequestMediaAccessPermission: { allowedPermissions: { type: 'integer' } },
  OnSelectClientCertificate: { certificateIndex: { type: 'integer', minimum: -1 } },
  OnShowPermissionPrompt: { permissionResult: { type: 'integer' } },
  RunContextMenu: { commandId: { type: 'integer' }, eventFlags: { type: 'integer' } },
  RunQuickMenu: { commandId: { type: 'integer' }, eventFlags: { type: 'integer' } }
});

const INTERNAL_INIT_EVENTS = new Set([
  'OnBeforeCommandLineProcessing', 'OnRegisterCustomSchemes', 'OnContextInitialized',
  'OnBeforeChildProcessLaunch', 'OnScheduleMessagePumpWork', 'OnWebKitInitialized',
  'ClearData', 'FinishShutdown'
]);
const NORMALIZED_INIT_EVENTS = new Set([
  'OnProcessMessageReceived', 'OnLoadingStateChange', 'OnLoadStart', 'OnLoadEnd', 'OnLoadError'
]);

const LEGACY_EVENT_ALIASES = Object.freeze({
  OnAfterCreated: 'Created', OnLoadEnd: 'LoadEnd', OnAddressChange: 'AddressChanged',
  OnBeforePopup: 'BeforePopup', OnTitleChange: 'TitleChanged', OnBeforeClose: 'Closed',
  OnLoadError: 'Error', OnCertificateError: 'CertificateError', OnDragEnter: 'DragEnter'
});

const FBRO_EVENT_CHINESE_NAMES = new Map(Object.entries({
  GetRootScreenRect: '查询根窗口屏幕区域', GetScreenInfo: '查询屏幕信息', GetScreenPoint: '视图坐标转屏幕坐标',
  GetViewRect: '查询离屏视图区域', OnAcceleratedPaint: '加速绘制', OnPaint: '离屏绘制',
  OnImeCompositionRangeChanged: '输入法合成区域改变', OnPluginCrashed: '插件崩溃', OnPopupShow: '离屏弹窗显示状态改变',
  OnQuotaRequest: '存储配额请求', OnScrollOffsetChanged: '滚动偏移改变', OnTextSelectionChanged: '文本选择改变',
  OnVirtualKeyboardRequested: '虚拟键盘请求', ReceiveRenderProcessMessage: '收到渲染进程原始消息',
  StartDragging: '开始拖动', UpdateDragCursor: '更新拖动光标', DoFinish: '清理完成',
  Start: '开始', End: '结束', Visit: '访问数据', OnDownloadImageFinished: '图片下载完成',
  FBroHs_OnFileDialogDismissed: '文件对话框关闭', FinishShutdown: '完成关闭协调', GetDefaultClient: '取得默认浏览器客户端',
  OnBeforeChildProcessLaunch: '子进程启动前', OnBeforeCommandLineProcessing: '命令行处理前',
  OnBrowserCreated: '浏览器实例已创建', OnBrowserDestroyed: '浏览器实例已销毁',
  OnContextCreated: '渲染上下文已创建', OnContextInitialized: '浏览器上下文初始化完成',
  OnContextReleased: '渲染上下文已释放', OnFocusedNodeChanged: '焦点节点改变',
  OnRegisterCustomSchemes: '注册自定义协议', OnRequestContextInitialized: '请求上下文初始化完成',
  OnScheduleMessagePumpWork: '调度消息泵工作', OnUncaughtException: '脚本未捕获异常', OnWebKitInitialized: 'WebKit初始化完成',
  OnWebSocketClientClose: 'WebSocket客户端关闭', OnWebSocketClientConnect: 'WebSocket客户端连接',
  OnWebSocketClientCreate: 'WebSocket客户端创建', OnWebSocketClientMessage: 'WebSocket客户端消息',
  OnWebSocketClientSend: 'WebSocket客户端发送', Callback: '回调完成', OnPdfPrintFinished: 'PDF打印完成',
  OnQuery: '查询请求', OnQueryCanceled: '查询已取消', GetResponseHeaders: '取得响应头', Skip: '跳过资源数据',
  Filter: '过滤响应数据', InitFilter: '初始化响应过滤器', OnClientConnected: '客户端已连接',
  OnClientDisconnected: '客户端已断开', OnHttpRequest: 'HTTP请求到达', OnServerCreated: '服务器已创建',
  OnServerDestroyed: '服务器已销毁', OnWebSocketConnected: 'WebSocket已连接', OnWebSocketMessage: 'WebSocket消息到达',
  OnWebSocketRequest: 'WebSocket握手请求', OnDownloadData: '下载数据到达', OnDownloadProgress: '下载进度改变',
  OnRequestComplete: '请求完成', OnUploadProgress: '上传进度改变', Execute: '执行请求', Get: '读取值', Set: '写入值'
}));

const IMPLEMENTED_ADVANCED_EXPORTS = new Set([
  'FBroHsValue_Create', 'FBroHsValue_IsValid', 'FBroHsValue_IsOwned',
  'FBroHsValue_IsReadOnly', 'FBroHsValue_Copy', 'FBroHsValue_GetType',
  'FBroHsValue_GetBool', 'FBroHsValue_GetInt', 'FBroHsValue_GetDouble',
  'FBroHsValue_GetString', 'FBroHsValue_SetNull', 'FBroHsValue_SetBool',
  'FBroHsValue_SetInt', 'FBroHsValue_SetDouble', 'FBroHsValue_SetString',
  'FBroHsValue_IsSame', 'FBroHsValue_IsEqual', 'FBroHsValue_GetBinary',
  'FBroHsValue_SetBinary', 'FBroHsValue_GetDictionary', 'FBroHsValue_GetList',
  'FBroHsValue_SetDictionary', 'FBroHsValue_SetList',
  'FBroHsBinaryValue_Create', 'FBroHsBinaryValue_GetSize', 'FBroHsBinaryValue_GetData',
  'FBroHsDictionaryValue_Create', 'FBroHsDictionaryValue_IsValid',
  'FBroHsDictionaryValue_IsOwned', 'FBroHsDictionaryValue_IsReadOnly',
  'FBroHsDictionaryValue_Copy', 'FBroHsDictionaryValue_GetSize',
  'FBroHsDictionaryValue_Clear', 'FBroHsDictionaryValue_HasKey',
  'FBroHsDictionaryValue_Remove', 'FBroHsDictionaryValue_GetType',
  'FBroHsDictionaryValue_GetBool', 'FBroHsDictionaryValue_GetInt',
  'FBroHsDictionaryValue_GetDouble', 'FBroHsDictionaryValue_GetString',
  'FBroHsDictionaryValue_SetNull', 'FBroHsDictionaryValue_SetBool',
  'FBroHsDictionaryValue_SetInt', 'FBroHsDictionaryValue_SetDouble',
  'FBroHsDictionaryValue_SetString', 'FBroHsDictionaryValue_IsSame',
  'FBroHsDictionaryValue_IsEqual', 'FBroHsDictionaryValue_GetKeys',
  'FBroHsDictionaryValue_GetValue', 'FBroHsDictionaryValue_GetBinary',
  'FBroHsDictionaryValue_GetDictionary', 'FBroHsDictionaryValue_GetList',
  'FBroHsDictionaryValue_SetValue', 'FBroHsDictionaryValue_SetBinary',
  'FBroHsDictionaryValue_SetDictionary', 'FBroHsDictionaryValue_SetList',
  'FBroCefStringList_Size', 'FBroCefStringList_GetValue',
  'FBroHsListValue_Create', 'FBroHsListValue_IsValid', 'FBroHsListValue_IsOwned',
  'FBroHsListValue_IsReadOnly', 'FBroHsListValue_Copy', 'FBroHsListValue_SetSize',
  'FBroHsListValue_GetSize', 'FBroHsListValue_Clear', 'FBroHsListValue_Remove',
  'FBroHsListValue_GetType', 'FBroHsListValue_GetBool', 'FBroHsListValue_GetInt',
  'FBroHsListValue_GetDouble', 'FBroHsListValue_GetString',
  'FBroHsListValue_SetNull', 'FBroHsListValue_SetBool', 'FBroHsListValue_SetInt',
  'FBroHsListValue_SetDouble', 'FBroHsListValue_SetString', 'FBroHsListValue_IsSame',
  'FBroHsListValue_IsEqual', 'FBroHsListValue_GetValue', 'FBroHsListValue_GetBinary',
  'FBroHsListValue_GetDictionary', 'FBroHsListValue_GetList',
  'FBroHsListValue_SetValue', 'FBroHsListValue_SetBinary',
  'FBroHsListValue_SetDictionary', 'FBroHsListValue_SetList',
  'FBroStream_CreateForFile', 'FBroStream_CreateForData', 'FBroStream_Read',
  'FBroStream_Seek', 'FBroStream_Tell', 'FBroStream_Eof', 'FBroStream_MayBlock',
  'FBroHsBrowserHost_DownloadImage', 'FBroHsImage_IsEmpty', 'FBroHsImage_GetWidth',
  'FBroHsImage_GetHeight', 'FBroHsImage_GetRepresentationInfo', 'FBroHsImage_GetAsBitmap',
  'FBroHsImage_GetAsJPEG', 'FBroHsImage_GetAsPNG',
  'FBroHsSSLInfo_GetCertStatus', 'FBroHsSSLInfo_GetX509Certificate',
  'FBroHsX509Certificate_GetSubject', 'FBroHsX509Certificate_GetIssuer',
  'FBroHsX509Certificate_GetSerialNumber', 'FBroHsX509Certificate_GetDEREncoded',
  'FBroHsX509Certificate_GetPEMEncoded', 'FBroHsX509Certificate_GetValidStart',
  'FBroHsX509Certificate_GetValidExpiry', 'FBroHsX509Certificate_GetIssuerChainSize',
  'FBroHsX509Certificate_GetDEREncodedIssuerChain', 'FBroHsX509Certificate_GetPEMEncodedIssuerChain',
  'FBroHsX509CertPrincipal_GetDisplayName', 'FBroHsX509CertPrincipal_GetCommonName',
  'FBroHsX509CertPrincipal_GetLocalityName', 'FBroHsX509CertPrincipal_GetStateOrProvinceName',
  'FBroHsX509CertPrincipal_GetCountryName', 'FBroHsX509CertPrincipal_GetOrganizationNames',
  'FBroHsX509CertPrincipal_GetOrganizationUnitNames',
  'FBroBinaryValueList_Size', 'FBroBinaryValueList_GetValue',
  'FBroHsDragData_Clone', 'FBroHsDragData_HasImage', 'FBroHsDragData_GetImage',
  'FBroHsBrowserHost_GetRequestContext', 'FBroHsRequestContext_GetCookieManager',
  'FBroHsCookieManager_GetGlobalManager', 'FBroHsCookieManager_VisitAllCookies',
  'FBroHsCookieManager_VisitUrlCookies', 'FBroHsCookieManager_SetCookie',
  'FBroHsCookieManager_DeleteCookies', 'FBroHsCookieManager_FlushStore',
  'FBroHsBrowser_ClearCacheData', 'FBroHsBrowser_ClearGlobalCacheData',
  'FBroHsBrowserHost_StartDownload', 'FBroHsBrowserHost_Print',
  'FBroHsBrowserHost_PrintToPDF',
  'FBroHsVIPControl_PageCaptureScreenshot',
  'FBroHsBrowser_GetFocusedFrame', 'FBroHsBrowser_GetFrameById',
  'FBroHsBrowser_GetFrameByName', 'FBroHsBrowser_GetFrameIdentifiers',
  'FBroHsBrowser_GetFrameNames', 'FBroHsBrowserFrame_IsValid',
  'FBroHsBrowserFrame_GetURL', 'FBroHsBrowserFrame_Undo',
  'FBroHsBrowserFrame_Redo', 'FBroHsBrowserFrame_Cut',
  'FBroHsBrowserFrame_Copy', 'FBroHsBrowserFrame_Paste',
  'FBroHsBrowserFrame_Delete', 'FBroHsBrowserFrame_SelectAll',
  'FBroHsBrowserFrame_ViewSource', 'FBroHsBrowserFrame_IsMain',
  'FBroHsBrowserFrame_IsFocused', 'FBroHsBrowserFrame_GetName',
  'FBroHsBrowserFrame_GetIdentifier', 'FBroHsBrowserFrame_ExecuteJavaScript',
  'FBroHsBrowserFrame_GetParent', 'FBroHsBrowserFrame_GetBrowser'
]);

const IMPLEMENTED_VIP_EXPORT_PATTERNS = [
  /^FBroHsVIPControl_SetVir/u,
  /^FBroHsVIPUserAgentData_/u,
  /^FBroHsVIPControl_Set(?:Audio|Canvas|WebGL)FingerPrint_(?:constant|random)$/u,
  /^FBroHsVIPControl_SetDisable/u,
  /^FBroHsDevToolsDOM_/u,
  /^FBroHsVIPRequestContext_/u,
  /^FBroHsVIPResourceHandler_/u,
  /^FBroHsVIPResponseFilter_/u,
  /^FBroHsOnlineLicenseControl_GetShowLicense/u
];

const IMPLEMENTED_VIP_SUPPORT_EXPORTS = new Set([
  'FBroHsVIPControl_SetPlugins', 'FBroHsVIPControl_SetSSLCipher',
  'FBroHsVIPControl_SetTouchEventEmulationEnabled', 'FBroHsVIPControl_SetWebFeatureKernel',
  'FBroBrowser_IsLicenceKey', 'FBroHsBrowser_GetExpirationTime', 'FBroHsBrowser_GetFunctionStr',
  'FBroHsBrowser_GetMachineCode', 'FBroHsBrowser_GetRegistrationTime', 'FBroHsBrowser_GetVersionStr',
  'FBroHsBrowser_SetLicenceKey', 'FBroHsVIPControl_ClearAllData', 'FBroHsVIPControl_ClearS5Auth',
  'FBroHsVIPControl_EnableWebsocketClientHook', 'FBroHsVIPControl_GetBrowser',
  'FBroHsVIPControl_SetCSSKernel', 'FBroHsVIPControl_SetEmitTouchEventsForMouse',
  'FBroHsVIPControl_SetS5Auth', 'FBroHsVIPControl_SetV8Kernel', 'FBroHsVIPGlobal_SetS5Auth',
  'FBroHsVIPControl_AddResourceHandlerChangeData', 'FBroHsVIPControl_AddResourceHandlerChangeFile',
  'FBroHsVIPControl_DeleteResourceHandlerChangeData', 'FBroHsVIPControl_DeleteResourceHandlerAllData',
  'FBroHsVIPControl_AddResponseFilterChangeData', 'FBroHsVIPControl_DeletResponseFiltereChangeData',
  'FBroHsVIPControl_DeleteResponseFilterAllData',
  'FBroHsVIPControl_AddDevToolsMessageObserver', 'FBroHsVIPControl_DeleteDevToolsMessageObserver',
  'FBroHsVIPControl_AddTabAt', 'FBroHsVIPControl_DispatchKeyEvent',
  'FBroHsVIPControl_DispatchMouseEvent', 'FBroHsVIPControl_DispatchTouchEvent',
  'FBroHsVIPControl_ExecuteDevToolsMethod', 'FBroHsVIPControl_PageGetContextID',
  'FBroHsVIPControl_RuntimeEnable', 'FBroHsVIPControl_RuntimeEvaluate',
  'FBroHsVIPControl_RuntimeEvaluate_FrameID', 'FBroHsVIPControl_SendDevToolsMessage',
  'FBroSetVipEvent', 'FBroHsVIPCommandLine_SetProxy',
  'FBroCefStringList_Creat', 'FBroCefStringList_Add',
  'FBroDoubleString_Creat', 'FBroDoubleString_Add', 'FBroDoubleString_Size',
  'FBroDoubleString_ToBegin', 'FBroDoubleString_ToNext',
  'FBroDoubleString_GetCurrentData_Key', 'FBroDoubleString_GetCurrentData_Value'
]);

function isImplementedAdvancedExport(officialName) {
  return IMPLEMENTED_ADVANCED_EXPORTS.has(officialName)
    || IMPLEMENTED_VIP_SUPPORT_EXPORTS.has(officialName)
    || IMPLEMENTED_VIP_EXPORT_PATTERNS.some(pattern => pattern.test(officialName));
}

const NOT_APPLICABLE_EXPORTS = new Map([
  ['FBroHsBrowserHost_RunFileDialog', 'FBro 5.38.49 的辅助导出在 CEF UI 线程实测会阻塞且不创建对话框；Windows x64 高层命令改用独立 STA IFileDialog 和受管任务回调。']
]);

const HIGH_LEVEL_EXPORTS = new Set([
  'FBroHsBrowser_ClearProxy', 'FBroHsBrowser_GetMainFrame', 'FBroHsBrowser_GetVIPControl',
  'FBroHsBrowser_CanGoBack', 'FBroHsBrowser_CanGoForward', 'FBroHsBrowser_GoBack',
  'FBroHsBrowser_GetIdentifier', 'FBroHsBrowser_GoForward', 'FBroHsBrowser_HasDocument',
  'FBroHsBrowser_IsLoading', 'FBroHsBrowser_IsPopup', 'FBroHsBrowser_IsSame',
  'FBroHsBrowser_Reload', 'FBroHsBrowser_ReloadIgnoreCache',
  'FBroHsBrowser_SetProxy', 'FBroHsBrowser_StopLoad',
  'FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn', 'FBroHsBrowserFrame_LoadURL',
  'FBroHsBrowserHost_CloseBrowser', 'FBroHsBrowserHost_CloseDevTools', 'FBroHsBrowserHost_Find',
  'FBroHsBrowserHost_GetZoomLevel', 'FBroHsBrowserHost_HasDevTools',
  'FBroHsBrowserHost_HasView', 'FBroHsBrowserHost_IsAudioMuted', 'FBroHsBrowserHost_SendFocusEvent',
  'FBroHsBrowserHost_SetAudioMuted', 'FBroHsBrowserHost_SetAutoResizeEnabled',
  'FBroHsBrowserHost_SetFocus', 'FBroHsBrowserHost_SetZoomLevel',
  'FBroHsBrowserHost_StopFinding', 'FBroHsBrowserHost_TryCloseBrowser', 'FBroHsCreate', 'FBroHsInitPro',
  'FBroHsOnlineLicenseControl_GetError', 'FBroHsOnlineLicenseControl_SetKey',
  'FBroHsRequestContext_SetPreference', 'FBroHsVIPControl_ClearFingerCount',
  'FBroHsVIPControl_GetFingerCount', 'FBroHsVIPControl_IsNULL',
  'FBroHsVIPControl_SetAudioFingerPrint_random', 'FBroHsVIPControl_SetCanvasFingerPrint_random',
  'FBroHsVIPControl_SetVirDeviceMemory', 'FBroHsVIPControl_SetVirDevicePixelRatio',
  'FBroHsVIPControl_SetVirHardwareConcurrency', 'FBroHsVIPControl_SetVirLanguages',
  'FBroHsVIPControl_SetVirPlatform', 'FBroHsVIPControl_SetVirScreenHeightAndWidth',
  'FBroHsVIPControl_SetVirWebglrenderer', 'FBroHsVIPControl_SetVirWebglvendor',
  'FBroHsVIPControl_SetWebGLFingerPrint_random', 'FBroSetV8DefaultsHeapSize', 'FBroShutdown',
  'FBroString_Creat', 'FBroString_GetWcharData', 'FBroString_WSize'
]);

const NATIVE_CEF_EQUIVALENT_CALLS = new Map([
  ['FBroHsCookieManager_SetCookie', 'manager->SetCookie('],
  ['FBroHsCookieManager_FlushStore', 'manager->FlushStore(']
]);

const INTERNAL_NAME_PATTERNS = [
  /MallocManger_(?:New|Free)$/u,
  /(?:InitEvent|Event)Destroy$/u
];

const MODULE_RULES = [
  ['lingbuilder.fbro.vip', /VIP|Finger|UserAgentData/iu],
  ['lingbuilder.fbro.osr', /RenderHandler|SharedMemoryRegion|DragData|SendMouse|SendKey|Ime|ScreenInfo|Paint/iu],
  ['lingbuilder.fbro.network', /Request|Response|PostData|URLRequest|WebSocket|WSS|Server|Socket|Resource|Scheme|SSL/iu],
  ['lingbuilder.fbro.session', /RequestContext|Cookie|Extension|Proxy|Preference|Cache/iu],
  ['lingbuilder.fbro.transfer', /Download|Print|Pdf|Image|FileDialog|Screenshot/iu],
  ['lingbuilder.fbro.automation', /Frame|Dom|V8|ProcessMessage|Query|TaskRunner|DevTools|Command/iu],
  ['lingbuilder.fbro.events', /Event|Callback|Handler|Hook|Closure/iu],
  ['lingbuilder.fbro.objects', /Value|Dictionary|List|String|Stream|Certificate|Principal|MenuModel|MiddleData|ContextIdData/iu]
];

const MODULE_LABELS = {
  'lingbuilder.fbro.browser': '浏览器',
  'lingbuilder.fbro.events': '事件',
  'lingbuilder.fbro.session': '会话',
  'lingbuilder.fbro.transfer': '传输',
  'lingbuilder.fbro.automation': '自动化',
  'lingbuilder.fbro.vip': '指纹',
  'lingbuilder.fbro.network': '网络',
  'lingbuilder.fbro.osr': '离屏渲染',
  'lingbuilder.fbro.objects': '高级对象'
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.FBRO_OFFICIAL_ROOT || DEFAULT_SOURCE);
  const includeRoot = path.join(sourceRoot, 'src', 'env', 'FBrowserCEF3lib');
  const outputPath = path.resolve(args.output || path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'fbroApiCoverage.generated.json'));
  const markdownPath = path.resolve(args.markdown || path.join(repoRoot, 'docs', 'FBRO_API_COVERAGE.md'));
  const overridePath = path.join(repoRoot, 'electron', 'native', 'fbro-bridge', 'FbroEventOverrides.generated.inc');
  const bridgeSource = await fs.readFile(path.join(repoRoot, 'electron', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  const cefEventSource = await fs.readFile(path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'cef3BrowserEvents.ts'), 'utf8');
  for (const officialName of [...HIGH_LEVEL_EXPORTS, ...IMPLEMENTED_ADVANCED_EXPORTS, ...IMPLEMENTED_VIP_SUPPORT_EXPORTS]) {
    const equivalent = NATIVE_CEF_EQUIVALENT_CALLS.get(officialName);
    if (!bridgeSource.includes(officialName) && (!equivalent || !bridgeSource.includes(equivalent))) {
      throw new Error(`已实现封装标记缺少真实 Bridge 调用：${officialName}`);
    }
  }

  const headerNames = (await fs.readdir(includeRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.h'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (headerNames.length !== EXPECTED_HEADER_COUNT) {
    throw new Error(`FBro 公共头文件数量漂移：期望 ${EXPECTED_HEADER_COUNT}，实际 ${headerNames.length}。`);
  }

  const signatures = [];
  for (const header of headerNames) {
    const source = await fs.readFile(path.join(includeRoot, header), 'utf8');
    for (const declaration of extractExportDeclarations(source)) {
      const officialName = extractFunctionName(declaration);
      if (!officialName) throw new Error(`无法识别导出函数名：${header}: ${declaration}`);
      signatures.push({ header, officialName, officialSignature: declaration });
    }
  }

  const unique = new Map();
  for (const item of signatures) {
    const existing = unique.get(item.officialSignature);
    if (existing) existing.declaredInHeaders.push(item.header);
    else unique.set(item.officialSignature, { ...item, declaredInHeaders: [item.header] });
  }
  const sorted = [...unique.values()].sort((left, right) =>
    left.header.localeCompare(right.header, 'en')
      || left.officialName.localeCompare(right.officialName, 'en')
      || left.officialSignature.localeCompare(right.officialSignature, 'en'));
  for (const item of sorted) {
    const equivalent = NATIVE_CEF_EQUIVALENT_CALLS.get(item.officialName);
    if (isImplementedAdvancedExport(item.officialName) && !bridgeSource.includes(item.officialName)
      && (!equivalent || !bridgeSource.includes(equivalent))) {
      throw new Error(`已实现封装标记缺少真实 Bridge 调用：${item.officialName}`);
    }
  }
  const signatureGroups = new Map();
  for (const item of sorted) {
    const group = signatureGroups.get(item.officialName) || [];
    group.push(item);
    signatureGroups.set(item.officialName, group);
  }
  if (signatureGroups.size !== EXPECTED_SIGNATURE_COUNT) {
    throw new Error(`FBro 导出签名族数量漂移：期望 ${EXPECTED_SIGNATURE_COUNT}，实际 ${signatureGroups.size}（原始重载声明 ${sorted.length}）。`);
  }

  const entries = [...signatureGroups.values()].map(group => {
    const item = group[0];
    const officialSignatures = group.map(entry => entry.officialSignature);
    const signatureHash = sha256(officialSignatures.join('\n'));
    const moduleId = classifyModule(item.header, item.officialName);
    const classification = classifyCoverage(item.officialName);
    const overloads = group.map((entry, index) => createWrapperSignatureSpec(entry.officialSignature, signatureHash, index));
    const terminology = translateOperation(item.officialName.split('_').pop() || item.officialName);
    return {
      functionId: `fbro.${path.basename(item.header, '.h').toLowerCase()}.${item.officialName.toLowerCase()}.${signatureHash.slice(0, 12)}`,
      signatureHash,
      header: item.header,
      declaredInHeaders: [...new Set(group.flatMap(entry => entry.declaredInHeaders))],
      officialName: item.officialName,
      officialSignature: item.officialSignature,
      officialSignatures,
      overloadCount: officialSignatures.length,
      wrapperSymbol: `LB_FBroV2_${signatureHash.slice(0, 16)}`,
      overloads,
      moduleId,
      chineseName: createChineseCommandName(moduleId, terminology.text, signatureHash),
      terminologyStatus: terminology.untranslatedTokens.length === 0 ? 'translated' : 'needsReview',
      untranslatedTokens: terminology.untranslatedTokens,
      englishAliases: [item.officialName],
      classification: classification.kind,
      implementationStatus: classification.kind === 'highLevel' || isImplementedAdvancedExport(item.officialName)
        ? 'implemented'
        : NOT_APPLICABLE_EXPORTS.has(item.officialName) ? 'notApplicable'
        : classification.kind === 'internal' ? 'notApplicable' : 'planned',
      classificationReason: classification.reason,
      safetyBoundary: classification.kind === 'internal'
        ? '不进入 .lcpp；仅供桥接层内部实现。'
        : '仅允许 UTF-16 JSON、类型化不透明句柄和受管缓冲区；禁止裸指针、CefRefPtr、STL 与任意地址。'
    };
  });

  const duplicateNames = entries.filter(entry => entry.overloadCount > 1)
    .map(entry => ({ name: entry.officialName, count: entry.overloadCount }));
  const summary = entries.reduce((result, entry) => {
    result[entry.classification] += 1;
    result[entry.implementationStatus] += 1;
    result.modules[entry.moduleId] = (result.modules[entry.moduleId] || 0) + 1;
    return result;
  }, { highLevel: 0, advancedSafe: 0, internal: 0, implemented: 0, planned: 0, notApplicable: 0, modules: {} });
  const versionHeader = await fs.readFile(path.join(includeRoot, 'FBroVersion.h'), 'utf8');
  const cefVersionHeader = await fs.readFile(path.join(includeRoot, 'include', 'cef_version.h'), 'utf8');
  const eventHeader = await fs.readFile(path.join(includeRoot, 'FBroHsEvent.h'), 'utf8');
  const cefEventNames = extractCefEventNames(cefEventSource);
  const eventCatalog = createEventCatalog(eventHeader, cefEventNames);
  const eventOverrideSource = renderBrowserEventOverrides(eventCatalog);
  const catalog = {
    schemaVersion: 2,
    baseline: {
      fbroVersion: readFbroVersion(versionHeader),
      cefVersion: readDefine(cefVersionHeader, 'CEF_VERSION').split('+')[0],
      platform: 'windows-msvc-x64'
    },
    headerCount: headerNames.length,
    signatureCount: entries.length,
    rawDeclarationCount: sorted.length,
    duplicateNames,
    summary,
    headers: headerNames.map(header => ({
      header,
      signatureCount: entries.filter(entry => entry.header === header).length
    })),
    eventSlotCount: eventCatalog.length,
    uniqueEventSignatureCount: new Set(eventCatalog.map(item => `${item.officialName}:${item.signatureHash}`)).size,
    eventClassCounts: Object.fromEntries(Object.keys(EXPECTED_EVENT_CLASS_COUNTS).map(ownerClass => [
      ownerClass, eventCatalog.filter(item => item.ownerClass === ownerClass).length
    ])),
    eventCatalog,
    signatures: entries
  };

  validateCatalog(catalog);
  const json = `${JSON.stringify(catalog, null, 2)}\n`;
  if (args.check) {
    const existing = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== json) throw new Error(`FBro 覆盖清单已漂移，请运行 npm run module:fbro-coverage。`);
    const existingOverrides = await fs.readFile(overridePath, 'utf8').catch(() => '');
    if (existingOverrides !== eventOverrideSource) throw new Error('FBro 原生事件 override 已漂移，请运行 npm run module:fbro-coverage。');
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, 'utf8');
    await fs.writeFile(markdownPath, renderMarkdown(catalog), 'utf8');
    await fs.writeFile(overridePath, eventOverrideSource, 'utf8');
  }
  if (args.eventsComplete) {
    validateCompleteEvents(catalog, eventOverrideSource);
    await validateInstalledEventAbi(repoRoot);
  }
  console.log(`FBro coverage: ${catalog.headerCount} headers, ${catalog.signatureCount} signatures, `
    + `${summary.implemented} implemented, ${summary.planned} planned, ${summary.internal} internal.`);
}

function createWrapperSignatureSpec(signature, familyHash, index) {
  const officialName = extractFunctionName(signature);
  const open = signature.indexOf('(');
  const close = signature.lastIndexOf(')');
  const returnType = signature.slice(0, open)
    .replace(/^DLLEXPORT\s+/u, '')
    .replace(/\bTEXPORTS\b/gu, '')
    .replace(new RegExp(`${officialName}\\s*$`, 'u'), '')
    .replace(/\s+/gu, ' ')
    .trim();
  const parameters = splitCppParameters(signature.slice(open + 1, close)).map((parameter, parameterIndex) => {
    const parsed = parseCppParameter(parameter, parameterIndex);
    return { ...parsed, ...describeCodec(parsed.cppType, false, parsed.name) };
  });
  const returnCodec = describeCodec(returnType, true, 'return');
  return {
    overloadId: `${familyHash.slice(0, 12)}-${index + 1}`,
    returnType,
    returnCodec,
    parameters,
    thread: inferThread(officialName),
    execution: inferExecution(officialName, parameters),
    ownership: returnCodec.codec === 'objectHandle' ? 'bridgeOwned' : returnCodec.codec === 'bufferHandle' ? 'callerReleases' : 'value'
  };
}

function splitCppParameters(value) {
  if (!value.trim() || value.trim() === 'void') return [];
  const result = [];
  let start = 0;
  let angle = 0;
  let parentheses = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '<') angle += 1;
    else if (character === '>') angle = Math.max(0, angle - 1);
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === ',' && angle === 0 && parentheses === 0) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function parseCppParameter(parameter, index) {
  const withoutDefault = parameter.replace(/\s*=\s*[^,]+$/u, '').trim();
  const functionPointer = withoutDefault.match(/\(\s*[*&]\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/u);
  if (functionPointer) return { name: functionPointer[1], cppType: withoutDefault.replace(functionPointer[1], '').replace(/\s+/gu, ' ').trim() };
  const nameMatch = withoutDefault.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?$/u);
  const name = nameMatch?.[1] || `arg${index + 1}`;
  const cppType = nameMatch ? withoutDefault.slice(0, nameMatch.index).trim() : withoutDefault;
  return { name, cppType: cppType.replace(/\s+/gu, ' ') };
}

function describeCodec(cppType, isReturn, name) {
  const normalized = cppType.replace(/\bconst\b/gu, '').replace(/[&]/gu, '').replace(/\s+/gu, ' ').trim();
  const refPtr = normalized.match(/CefRefPtr\s*<\s*([^>]+)>/u);
  if (normalized === 'void') return { codec: 'void' };
  if (refPtr) return { codec: 'objectHandle', objectType: refPtr[1].trim() };
  if (/\b(?:bool|BOOL)\b/u.test(normalized)) return { codec: 'bool' };
  if (/\b(?:double|float)\b/u.test(normalized)) return { codec: 'double' };
  if (/\b(?:u?int(?:8|16|32|64)?_t|int|long|unsigned|size_t|DWORD|COLORREF)\b/u.test(normalized)
      || /::[A-Za-z_][A-Za-z0-9_]*$/u.test(normalized)) return { codec: 'integer' };
  if (/\b(?:CefString|FBroString|wchar_t\s*\*|char\s*\*)\b/u.test(normalized)) return { codec: 'utf16' };
  if (/\bHWND\b/u.test(normalized)) return { codec: 'hostWindowRef', source: 'designerControlName' };
  if (/\b(?:HANDLE|M_POINTER)\b/u.test(normalized) || /void\s*\*/u.test(normalized)) {
    return { codec: isReturn || /data|buffer|bytes/iu.test(name) ? 'bufferHandle' : 'opaqueHandle' };
  }
  if (/[*]/u.test(normalized) || /\b(?:POINT_|FBro|Cef)[A-Za-z0-9_]+\b/u.test(normalized)) return { codec: 'jsonStruct', schema: normalized.replace(/[\s*]/gu, '') };
  return { codec: 'integer', enumType: normalized };
}

function inferThread(officialName) {
  if (/V8|DOM|Render|ProcessMessage/iu.test(officialName)) return 'renderer';
  if (/Resource|Request|Response|Cookie|URLRequest|WebSocket|Scheme|Server/iu.test(officialName)) return 'io';
  if (/Browser|Frame|DevTools|Download|Print|Dialog|VIP/iu.test(officialName)) return 'ui';
  return 'any';
}

function inferExecution(officialName, parameters) {
  if (/Callback|Visit|Download|PrintToPDF|RunFileDialog|ExecuteDevTools|URLRequest/iu.test(officialName)
      || parameters.some(parameter => /callback|handler|visitor/iu.test(parameter.name))) return 'task';
  return 'sync';
}

function parseArgs(values) {
  const result = { source: '', output: '', markdown: '', check: false, eventsComplete: false };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--source') result.source = values[++index] || '';
    else if (values[index] === '--output') result.output = values[++index] || '';
    else if (values[index] === '--markdown') result.markdown = values[++index] || '';
    else if (values[index] === '--check') result.check = true;
    else if (values[index] === '--events-complete') result.eventsComplete = true;
  }
  return result;
}

function extractExportDeclarations(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/\/\/[^\r\n]*/gu, ' ')
    .replace(/^\s*#\s*define\s+DLLEXPORT\b[^\r\n]*/gmu, ' ');
  const declarations = [];
  const pattern = /\bDLLEXPORT\b([\s\S]*?);/gu;
  let match;
  while ((match = pattern.exec(withoutComments)) !== null) {
    const normalized = `DLLEXPORT ${match[1]}`.replace(/\s+/gu, ' ').trim();
    if (/\([^;]*\)$/u.test(normalized)) declarations.push(normalized);
  }
  return declarations;
}

function extractFunctionName(declaration) {
  const open = declaration.indexOf('(');
  if (open < 0) return '';
  const prefix = declaration.slice(0, open).replace(/\bTEXPORTS\b/gu, ' ').trim();
  return prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/u)?.[1] || '';
}

function createEventCatalog(source, cefEventNames) {
  return extractOwnedVirtualDeclarations(source).map(item => {
    const signatureHash = sha256(item.declaration);
    const parameters = splitCppParameters(item.declaration.slice(item.openParenthesis + 1, item.closeParenthesis))
      .map((parameter, index) => parseCppParameter(parameter, index));
    const parameterSchemas = parameters.map(parameter => createEventFieldSchema(parameter));
    const callbackParameter = parameters.find(parameter => /Callback|Continuation/iu.test(parameter.cppType));
    const highFrequency = /(?:Paint|AcceleratedPaint|Mouse|Scroll|Progress|AudioStreamPacket|Cursor|Drag|ImeComposition|TextSelection|DownloadData)/u.test(item.officialName);
    const internal = item.ownerClass === 'FBroHsInitEvent' && INTERNAL_INIT_EVENTS.has(item.officialName);
    const notApplicable = item.ownerClass === 'FBroHsFileDialogCallback';
    const managedBrowserBoundary = item.ownerClass === 'FBroHsBroEvent'
      && MANAGED_BROWSER_EVENT_BOUNDARIES.has(item.officialName);
    const exposure = internal ? 'internal'
      : notApplicable ? 'notApplicable'
      : managedBrowserBoundary ? 'managed'
      : item.ownerClass === 'FBroHsBroEvent' ? 'public'
      : item.ownerClass === 'FBroHsInitEvent' ? 'managed'
      : 'managed';
    const definition = cefEventNames.get(item.officialName);
    const translated = translateOperation(item.officialName.replace(/^On/u, ''));
    const confirmedName = FBRO_EVENT_CHINESE_NAMES.get(item.officialName);
    const lingBuilderName = definition?.name || createAdapterEventName(item.ownerClass, item.officialName, confirmedName || translated.text);
    const category = definition?.category || inferEventCategory(item.ownerClass, item.officialName);
    const kind = internal ? 'internal' : highFrequency ? 'highFrequency'
      : item.returnType !== 'void' || callbackParameter ? (callbackParameter ? 'deferredDecision' : 'decision')
      : 'notification';
    const timeoutMilliseconds = callbackParameter
      ? /File|Dialog|Download|Print/iu.test(item.officialName) ? 120000
        : /Auth|Certificate|Permission|Quota/iu.test(item.officialName) ? 5000 : 30000
      : item.returnType !== 'void' ? 2000 : 0;
    const bridgeStatus = internal ? 'internal' : notApplicable ? 'notApplicable'
      : managedBrowserBoundary ? 'managed'
      : item.ownerClass === 'FBroHsBroEvent' ? 'implemented' : 'managed';
    return {
      eventId: `fbro.event.${item.ownerClass.toLowerCase()}.${item.officialName.toLowerCase()}.${signatureHash.slice(0, 12)}`,
      eventToken: `0x${signatureHash.slice(0, 16)}`,
      ownerClass: item.ownerClass,
      officialName: item.officialName,
      officialAliases: [item.officialName],
      legacyAliases: LEGACY_EVENT_ALIASES[item.officialName] ? [LEGACY_EVENT_ALIASES[item.officialName]] : [],
      lingBuilderName,
      category,
      kind,
      exposure,
      thread: inferThread(item.officialName),
      signatureHash,
      officialSignature: item.declaration,
      returnType: item.returnType,
      synchronous: item.returnType !== 'void' && !callbackParameter,
      decisionMode: callbackParameter ? 'deferred' : item.returnType !== 'void' ? 'immediate' : 'notification',
      fields: parameterSchemas,
      responseSchema: createEventResponseSchema(item.returnType, parameters, callbackParameter, item.officialName),
      defaultAction: item.officialName === 'OnBeforePopup' ? 'cancel'
        : callbackParameter && /Auth|Certificate|Permission|Quota|File|Dialog|Download/iu.test(item.officialName) ? 'cancel'
        : item.returnType !== 'void' || callbackParameter ? 'continue' : 'notify',
      timeoutMilliseconds,
      maxHz: /(?:OnPaint|OnAcceleratedPaint)/u.test(item.officialName) ? 60 : highFrequency ? 10 : 0,
      ownership: 'copiedJsonAndManagedHandles',
      bridgeStatus,
      implementationStatus: bridgeStatus,
      implementation: managedBrowserBoundary ? 'BridgeBrowserEvent safe-cancel override with SDK trigger boundary'
        : item.ownerClass === 'FBroHsBroEvent' ? 'BridgeBrowserEvent override'
        : item.ownerClass === 'FBroHsInitEvent' ? 'BridgeInitEvent override or normalized browser event'
        : notApplicable ? 'Windows STA IFileDialog managed replacement'
        : `managed adapter: ${item.ownerClass}`,
      testId: `fbro-event-${item.ownerClass.toLowerCase()}-${item.officialName.toLowerCase()}-${signatureHash.slice(0, 8)}`,
      classificationReason: internal ? 'FBro/CEF 启动或关闭协调只能由 Bridge 生命周期管理。'
        : notApplicable ? '官方阻塞式文件对话框回调由现有 STA IFileDialog 受管任务替代。'
        : managedBrowserBoundary ? 'FBro 5.38.49 的可视 Basic Auth 登录 UI 未经过该 BroEvent override；Bridge 在回调实际到达时保持默认安全取消，但不作为可靠的普通窗口事件公开。'
        : exposure === 'public' ? '通过 C ABI v3 UTF-16 JSON 事件包公开，原始 SDK 对象不会跨边界。'
        : '通过受管任务、对象句柄或原生流式适配器完成，不向 .lcpp 暴露裸指针。'
    };
  }).sort((left, right) => left.ownerClass.localeCompare(right.ownerClass, 'en')
    || left.officialName.localeCompare(right.officialName, 'en')
    || left.signatureHash.localeCompare(right.signatureHash, 'en'));
}

function extractOwnedVirtualDeclarations(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/[^\r\n]*/gu, ' ');
  const declarations = [];
  const classPattern = /\bclass\s+(FBroHs[A-Za-z0-9_]+)\s*:[^{]+\{/gu;
  let classMatch;
  while ((classMatch = classPattern.exec(clean)) !== null) {
    let depth = 1;
    let classEnd = classPattern.lastIndex;
    while (classEnd < clean.length && depth > 0) {
      if (clean[classEnd] === '{') depth += 1;
      else if (clean[classEnd] === '}') depth -= 1;
      classEnd += 1;
    }
    const body = clean.slice(classPattern.lastIndex, classEnd - 1);
    const pattern = /\bvirtual\b/gu;
    let match;
    while ((match = pattern.exec(body)) !== null) {
      let parentheses = 0;
      let sawParameters = false;
      let end = -1;
      for (let index = pattern.lastIndex; index < body.length; index += 1) {
        const character = body[index];
        if (character === '(') { parentheses += 1; sawParameters = true; }
        else if (character === ')') parentheses = Math.max(0, parentheses - 1);
        else if (sawParameters && parentheses === 0 && (character === '{' || character === ';')) { end = index; break; }
      }
      if (end < 0) continue;
      const declaration = body.slice(match.index, end).replace(/\s+/gu, ' ').trim();
      const openParenthesis = declaration.indexOf('(');
      const closeParenthesis = declaration.lastIndexOf(')');
      const prefix = declaration.slice('virtual'.length, openParenthesis).trim();
      const nameMatch = prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/u);
      if (nameMatch) {
        declarations.push({
          ownerClass: classMatch[1], declaration, openParenthesis, closeParenthesis,
          officialName: nameMatch[1], returnType: prefix.slice(0, nameMatch.index).trim()
        });
      }
      pattern.lastIndex = end + 1;
    }
    classPattern.lastIndex = classEnd;
  }
  return declarations;
}

function extractCefEventNames(source) {
  const result = new Map();
  const categoryBlocks = [...source.matchAll(/\.\.\.define\('([^']+)',\s*'([^']+)',\s*\[([\s\S]*?)\]\)/gu)];
  for (const block of categoryBlocks) {
    for (const event of block[3].matchAll(/\['([^']+)',\s*'([^']+)',\s*'([^']+)'/gu)) {
      result.set(event[1], { name: event[2], description: event[3], category: block[1], kind: block[2] });
    }
  }
  return result;
}

function createAdapterEventName(ownerClass, officialName, translated) {
  const ownerNames = {
    FBroHsInitEvent: '初始化', FBroHsResourceHandler: '资源处理', FBroHsResponseFilter: '响应过滤',
    FBroHsDownloadImageCallback: '图片下载', FBroHsFileDialogCallback: '文件对话框',
    FBroHsPdfPrintCallback: 'PDF打印', FBroHsStringVisitor: '字符串访问', FBroHsJsCallback: 'JS执行',
    FBroHsDOMVisitor: 'DOM访问', FBroHsTask: '任务', FBroHsCookieVisitor: 'Cookie访问',
    FBroHsQueryHandler: '查询', FBroHsV8Handler: 'V8函数', FBroHsV8Accessor: 'V8属性',
    FBroHsV8Interceptor: 'V8拦截', FBroHsServerHandle: '本地服务器',
    FBroHsClearCacheCallback: '清缓存', FBroHsURLRequestClient: 'URL请求'
  };
  return `${ownerNames[ownerClass] || '浏览器'}${translated || officialName}`;
}

function inferEventCategory(ownerClass, officialName) {
  if (ownerClass === 'FBroHsInitEvent') return '初始化与渲染进程';
  if (/V8|DOM|Js|Query/iu.test(`${ownerClass} ${officialName}`)) return '脚本与自动化';
  if (/Request|Response|Resource|Server|WebSocket/iu.test(`${ownerClass} ${officialName}`)) return '网络与资源';
  if (/Download|Print|FileDialog|Image/iu.test(`${ownerClass} ${officialName}`)) return '下载与对话框';
  if (/Cookie|Cache/iu.test(`${ownerClass} ${officialName}`)) return '会话与存储';
  return '受管适配器';
}

function createEventFieldSchema(parameter) {
  const codec = describeCodec(parameter.cppType, false, parameter.name);
  const unsafe = codec.codec === 'opaqueHandle' || codec.codec === 'bufferHandle'
    || /CefRefPtr|CefRawPtr|void\s*\*|char\s*\*/u.test(parameter.cppType);
  return {
    name: parameter.name,
    sourceType: parameter.cppType,
    type: unsafe ? (/data|buffer|message/iu.test(parameter.name) ? 'bufferHandle' : 'managedHandle') : codec.codec,
    nullable: /[*]|CefRefPtr|CefRawPtr/u.test(parameter.cppType),
    direction: /[&]/u.test(parameter.cppType) && !/const/u.test(parameter.cppType) ? 'inout' : 'in',
    ownership: unsafe ? 'bridgeCopiesOrManages' : 'value'
  };
}

function createEventResponseSchema(returnType, parameters, callbackParameter, officialName) {
  const properties = { action: { type: 'integer', enum: [0, 1, 2, 3, 4] } };
  for (const parameter of parameters.filter(item => /[&]/u.test(item.cppType) && !/const/u.test(item.cppType))) {
    properties[parameter.name] = { type: describeCodec(parameter.cppType, false, parameter.name).codec };
  }
  if (callbackParameter) properties.continuation = { type: 'managedContinuation' };
  Object.assign(properties, EVENT_RESPONSE_PROPERTIES[officialName] || {});
  if (returnType !== 'void') properties.returnValue = { type: describeCodec(returnType, true, 'return').codec };
  return { type: 'object', properties, additionalProperties: false };
}

function renderBrowserEventOverrides(events) {
  const customBrowserEvents = new Set([...IMPLEMENTED_EVENT_NAMES.keys(), ...MANAGED_CALLBACK_EVENT_NAMES]);
  const customInitEvents = new Set([
    'OnBeforeCommandLineProcessing',
    'OnContextInitialized',
    'OnCreateExtension',
    'OnCreateExtensionError',
    'OnAddExtension',
    'OnRemoveExtension'
  ]);
  const sections = [];
  for (const [ownerClass, macro, customEvents] of [
    ['FBroHsBroEvent', 'LB_FBRO_BROWSER_EVENT_OVERRIDES', customBrowserEvents],
    ['FBroHsInitEvent', 'LB_FBRO_INIT_EVENT_OVERRIDES', customInitEvents]
  ]) {
    const lines = [`#if defined(${macro})`];
    for (const event of events.filter(item => item.ownerClass === ownerClass)) {
      lines.push(`// LB_FBRO_EVENT_OVERRIDE:${event.eventId}`);
      if (customEvents.has(event.officialName)) {
        lines.push(`// custom override: ${event.officialName}`);
        continue;
      }
      lines.push(renderEventOverrideMethod(event));
    }
    lines.push(`#endif // ${macro}`);
    sections.push(lines.join('\n'));
  }
  const legacyCodeSymbols = {
    Created: 'LB_FBRO_EVENT_CREATED', LoadEnd: 'LB_FBRO_EVENT_LOAD_END', AddressChanged: 'LB_FBRO_EVENT_ADDRESS_CHANGED',
    TitleChanged: 'LB_FBRO_EVENT_TITLE_CHANGED', Closed: 'LB_FBRO_EVENT_CLOSED', Error: 'LB_FBRO_EVENT_ERROR',
    BeforePopup: 'LB_FBRO_EVENT_BEFORE_POPUP', CertificateError: 'LB_FBRO_EVENT_CERTIFICATE_ERROR', DragEnter: 'LB_FBRO_EVENT_DRAG_ENTER'
  };
  const legacyCases = events.filter(event => event.ownerClass === 'FBroHsBroEvent' && event.legacyAliases.length > 0)
    .map(event => `case ${legacyCodeSymbols[event.legacyAliases[0]]}: return L"${event.eventId}";`).join('\n');
  const officialIdCases = events.filter(event => event.ownerClass === 'FBroHsBroEvent')
    .map(event => `if (std::wcscmp(official_name, L"${event.officialName}") == 0) return L"${event.eventId}";`).join('\n');
  const officialChineseCases = events.filter(event => event.ownerClass === 'FBroHsBroEvent')
    .map(event => `if (std::wcscmp(official_name, L"${event.officialName}") == 0) return L"${event.lingBuilderName}";`).join('\n');
  return `// Generated by scripts/generate-fbro-api-coverage.cjs. Do not edit.\n${sections.join('\n\n')}\n\n`
    + `#if defined(LB_FBRO_LEGACY_EVENT_ID_CASES)\n${legacyCases}\n#endif // LB_FBRO_LEGACY_EVENT_ID_CASES\n\n`
    + `#if defined(LB_FBRO_OFFICIAL_EVENT_ID_CASES)\n${officialIdCases}\n#endif // LB_FBRO_OFFICIAL_EVENT_ID_CASES\n\n`
    + `#if defined(LB_FBRO_OFFICIAL_EVENT_CHINESE_CASES)\n${officialChineseCases}\n#endif // LB_FBRO_OFFICIAL_EVENT_CHINESE_CASES\n`;
}

function renderEventOverrideMethod(event) {
  const declaration = event.officialSignature.replace(/^virtual\s+/u, '').trim();
  const open = declaration.indexOf('(');
  const close = declaration.lastIndexOf(')');
  const parameters = splitCppParameters(declaration.slice(open + 1, close))
    .map((parameter, index) => parseCppParameter(parameter, index));
  const fieldExpressions = parameters.map(parameter =>
    `{L"${parameter.name}", ${renderEventFieldExpression(parameter)}}`).join(', ');
  const fields = `BuildSafeFieldsJson({${fieldExpressions}})`;
  const flags = [event.synchronous ? 'LB_FBRO_EVENT_FLAG_SYNCHRONOUS' : '0',
    event.kind === 'deferredDecision' ? 'LB_FBRO_EVENT_FLAG_DEFERRED' : '0',
    event.kind === 'highFrequency' ? 'LB_FBRO_EVENT_FLAG_HIGH_FREQUENCY' : '0']
    .filter(value => value !== '0').join(' | ') || '0';
  const browserParameter = parameters.find(parameter => /^(?:browser|browsewr)$/iu.test(parameter.name));
  const outputParameters = parameters.filter(parameter => /[&]/u.test(parameter.cppType) && !/const/u.test(parameter.cppType));
  const responseArgument = event.ownerClass === 'FBroHsBroEvent' && outputParameters.length > 0
    ? ', &response_json' : '';
  const call = event.ownerClass === 'FBroHsBroEvent'
    ? `DispatchGeneratedBrowserEvent(handle_, L"${event.eventId}", L"${event.officialName}", L"${event.lingBuilderName}", ${fields}, ${flags}, ${event.maxHz}${responseArgument})`
    : browserParameter
      ? `DispatchGeneratedInitEvent(${browserParameter.name}, L"${event.eventId}", L"${event.officialName}", L"${event.lingBuilderName}", ${fields}, ${flags}, ${event.maxHz})`
      : `LB_FBRO_EVENT_ACTION_DEFAULT`;
  const normalizedInitEvent = event.ownerClass === 'FBroHsInitEvent'
    && NORMALIZED_INIT_EVENTS.has(event.officialName);
  const responsePrefix = responseArgument ? 'std::wstring response_json; ' : '';
  const applyResponses = responseArgument
    ? outputParameters.map(parameter => `ApplyEventResponse(response_json, "${parameter.name}", ${parameter.name});`).join(' ')
    : '';
  let body;
  if (event.returnType === 'void') body = call === 'LB_FBRO_EVENT_ACTION_DEFAULT' || normalizedInitEvent ? '' : `${responsePrefix}${call}; ${applyResponses}`;
  else if (event.returnType === 'bool') {
    const hasCallback = parameters.some(parameter => /Callback/iu.test(parameter.cppType));
    body = normalizedInitEvent ? 'return false;'
      : hasCallback ? `${call}; return false;`
      : event.officialName === 'CanDownload' ? `${responsePrefix}const int action = ${call}; ${applyResponses} return action != LB_FBRO_EVENT_ACTION_CANCEL;`
      : `${responsePrefix}const int action = ${call}; ${applyResponses} return action == LB_FBRO_EVENT_ACTION_CANCEL || action == LB_FBRO_EVENT_ACTION_HANDLED;`;
  } else if (event.returnType === 'CefResourceRequestHandler::ReturnValue') {
    body = `${responsePrefix}const int action = ${call}; ${applyResponses} return action == LB_FBRO_EVENT_ACTION_CANCEL ? RV_CANCEL : RV_CONTINUE;`;
  } else if (/^CefRefPtr</u.test(event.returnType)) {
    body = `${responsePrefix}${call}; ${applyResponses} return nullptr;`;
  } else {
    body = `${responsePrefix}${call}; ${applyResponses} return {};`;
  }
  return `  ${declaration} override { ${body} }`;
}

function renderEventFieldExpression(parameter) {
  const type = parameter.cppType;
  const name = parameter.name;
  if (/\bCefString\b/u.test(type)) return `${name}.ToWString()`;
  if (/CefRefPtr\s*<\s*CefFrame/u.test(type)) return `${name} ? ${name}->GetURL().ToWString() : L""`;
  if (/CefRefPtr|CefRawPtr|[*]/u.test(type)) return `${name} ? L"1" : L"0"`;
  if (/\b(?:bool|BOOL)\b/u.test(type)) return `${name} ? L"1" : L"0"`;
  if (/\bHANDLE\b/u.test(type)) {
    return `std::to_wstring(static_cast<long long>(reinterpret_cast<intptr_t>(${name})))`;
  }
  if (/\b(?:int|int64_t|size_t|unsigned|DWORD)\b/u.test(type) || /::/u.test(type)) {
    return `std::to_wstring(static_cast<long long>(${name}))`;
  }
  return `L"copied"`;
}

function validateCompleteEvents(catalog, overrideSource) {
  const events = catalog.eventCatalog;
  if (catalog.eventSlotCount !== EXPECTED_EVENT_SLOT_COUNT
      || catalog.uniqueEventSignatureCount !== EXPECTED_UNIQUE_EVENT_SIGNATURE_COUNT) {
    throw new Error(`FBro 事件统计不完整：槽位 ${catalog.eventSlotCount}/${EXPECTED_EVENT_SLOT_COUNT}，唯一签名 ${catalog.uniqueEventSignatureCount}/${EXPECTED_UNIQUE_EVENT_SIGNATURE_COUNT}。`);
  }
  for (const [ownerClass, expected] of Object.entries(EXPECTED_EVENT_CLASS_COUNTS)) {
    if (catalog.eventClassCounts[ownerClass] !== expected) {
      throw new Error(`FBro 事件类 ${ownerClass} 槽位漂移：${catalog.eventClassCounts[ownerClass]}/${expected}。`);
    }
  }
  if (events.some(event => ['planned', 'needsReview'].includes(event.bridgeStatus)
      || !event.ownerClass || !event.lingBuilderName || !event.category || !event.kind
      || !event.responseSchema || !event.defaultAction || !event.testId)) {
    throw new Error('FBro 事件目录仍存在 planned/needsReview 或缺失分类、schema、默认动作、测试标识。');
  }
  if (new Set(events.map(event => event.eventId)).size !== EXPECTED_EVENT_SLOT_COUNT) {
    throw new Error('FBro 事件目录存在重复稳定 ID。');
  }
  for (const event of events.filter(item => item.ownerClass === 'FBroHsBroEvent' || item.ownerClass === 'FBroHsInitEvent')) {
    if (!overrideSource.includes(`LB_FBRO_EVENT_OVERRIDE:${event.eventId}`)) {
      throw new Error(`FBro 事件缺少真实 override 标识：${event.eventId}`);
    }
  }
}

async function validateInstalledEventAbi(repoRoot) {
  const sdkRoot = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'sdk');
  const manifestPath = path.join(sdkRoot, 'runtime-manifest.json');
  const installedHeaderPath = path.join(sdkRoot, 'include', 'LingBuilderFbroBridge.h');
  const installedLibraryPath = path.join(sdkRoot, 'lib', 'x64', 'LingBuilderFbroBridge.lib');
  const installedDllPath = path.join(sdkRoot, 'bridge', 'x64', 'LingBuilderFbroBridge.dll');
  const sourceHeaderPath = path.join(repoRoot, 'electron', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => {
    throw new Error('FBro 事件完成门禁缺少已安装 SDK；请先运行 npm run module:fbro-sdk -- --install。');
  }));
  if (manifest.sdkVersion !== '135.0.21' || manifest.bridgeVersion !== EXPECTED_BRIDGE_VERSION || manifest.architecture !== 'x64') {
    throw new Error(`FBro 已安装 SDK 版本漂移：需要 135.0.21/Bridge ${EXPECTED_BRIDGE_VERSION}/x64，实际为 ${manifest.sdkVersion}/Bridge ${manifest.bridgeVersion}/${manifest.architecture}。`);
  }
  const [sourceHeader, installedHeader] = await Promise.all([
    fs.readFile(sourceHeaderPath, 'utf8'),
    fs.readFile(installedHeaderPath, 'utf8')
  ]);
  if (sourceHeader !== installedHeader) {
    throw new Error('FBro 已安装 SDK 头文件与当前 C ABI v3 源码不一致；请运行 npm run module:fbro-sdk -- --install。');
  }
  await fs.access(installedLibraryPath);
  const bridgeDll = await fs.readFile(installedDllPath);
  for (const symbol of REQUIRED_EVENT_V3_EXPORTS) {
    if (!bridgeDll.includes(Buffer.from(symbol, 'ascii'))) {
      throw new Error(`FBro 已安装 Bridge DLL 缺少 v3 导出：${symbol}。`);
    }
  }
}

function classifyModule(header, officialName) {
  const source = `${header} ${officialName}`;
  return MODULE_RULES.find(([, pattern]) => pattern.test(source))?.[0] || 'lingbuilder.fbro.browser';
}

function classifyCoverage(officialName) {
  if (HIGH_LEVEL_EXPORTS.has(officialName)) {
    return { kind: 'highLevel', reason: '已由现有中文高层 API 或其 C ABI v1 兼容实现直接使用。' };
  }
  if (INTERNAL_NAME_PATTERNS.some(pattern => pattern.test(officialName))) {
    return { kind: 'internal', reason: '分配器或事件适配器生命周期入口，只能由桥接实现调用，向 .lcpp 暴露会破坏句柄所有权。' };
  }
  if (NOT_APPLICABLE_EXPORTS.has(officialName)) {
    return { kind: 'advancedSafe', reason: NOT_APPLICABLE_EXPORTS.get(officialName) };
  }
  if (isImplementedAdvancedExport(officialName)) {
    return { kind: 'advancedSafe', reason: '已通过 C ABI v2 类型化对象句柄完成安全高级封装，并具有 contribution、binding、真实 Bridge 调用和原生测试。' };
  }
  return { kind: 'advancedSafe', reason: '已归入安全高级封装目标；必须通过 C ABI v2 类型化对象句柄、UTF-16 JSON、任务或受管缓冲逐项实现，当前不可据此视为已有运行时 wrapper。' };
}

function createChineseCommandName(moduleId, translatedOperation, signatureHash) {
  return `FBro高级_${MODULE_LABELS[moduleId]}_${translatedOperation}_${signatureHash.slice(0, 6).toUpperCase()}`;
}

function translateOperation(operation) {
  const words = operation.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').replace(/[_-]+/gu, ' ').split(/\s+/u).filter(Boolean);
  const dictionary = {
    Get: '取', Set: '设置', Is: '是否', Has: '是否有', Can: '能否', Create: '创建', Creat: '创建', New: '新建',
    Delete: '删除', Remove: '移除', Clear: '清空', Add: '添加', Insert: '插入', Copy: '复制', Close: '关闭',
    Open: '打开', Start: '开始', Stop: '停止', Continue: '继续', Cancel: '取消', Pause: '暂停', Resume: '恢复',
    Execute: '执行', Load: '加载', Save: '保存', Read: '读取', Write: '写入', Send: '发送', Receive: '接收',
    Find: '查找', Select: '选择', Visit: '访问', Register: '注册', Unregister: '注销', Resolve: '解析',
    Browser: '浏览器', Frame: '框架', Value: '值', Data: '数据', String: '文本', List: '列表', Dictionary: '字典',
    Request: '请求', Response: '响应', Context: '上下文', Cookie: 'Cookie', Cache: '缓存', Proxy: '代理',
    Url: '地址', URL: '地址', Title: '标题', Error: '错误', Result: '结果', Count: '数量', Size: '大小', Index: '索引',
    Name: '名称', Id: '编号', ID: '编号', Status: '状态', Type: '类型', Path: '路径', File: '文件', Image: '图像',
    Event: '事件', Handler: '处理器', Callback: '回调', Task: '任务', Host: '宿主', Focus: '焦点', Zoom: '缩放',
    Back: '后退', Forward: '前进', Reload: '刷新', Print: '打印', Download: '下载', Upload: '上传',
    Key: '按键', Mouse: '鼠标', Audio: '音频', Video: '视频', Device: '设备', Memory: '内存', Process: '进程',
    Message: '消息', Extension: '扩展', Certificate: '证书', Principal: '主体', Global: '全局', Main: '主',
    Current: '当前', Last: '最近', Default: '默认', Preference: '偏好', Settings: '设置', Info: '信息',
    To: '转', From: '从', By: '按', With: '使用', Without: '不使用', As: '作为', All: '全部', Item: '项目',
    Valid: '有效', Empty: '空', Same: '相同', Popup: '弹窗', Document: '文档', Identifier: '标识', Identifiers: '标识列表',
    Names: '名称列表', Level: '级别', Window: '窗口', Handle: '句柄', Source: '来源', Code: '代码',
    Success: '成功', Failure: '失败', Auth: '认证', Permission: '权限', Resource: '资源', Scheme: '协议',
    random: '随机', Random: '随机', NULL: '空', Wchar: '宽字符', WSize: '宽字符大小'
  };
  const untranslatedTokens = words.filter(word => !dictionary[word] && !/^[A-Z]{2,}$/u.test(word));
  const translated = words.map(word => dictionary[word] || word);
  return { text: translated.join('') || '接口', untranslatedTokens };
}

function validateCatalog(catalog) {
  if (catalog.signatures.some(entry => !entry.classification || !entry.implementationStatus || !entry.classificationReason || !entry.chineseName
      || /功能[0-9A-F]{4}/u.test(entry.chineseName))) {
    throw new Error('FBro 覆盖清单存在未分类、无理由或无中文名称的签名。');
  }
  const ids = new Set(catalog.signatures.map(entry => entry.functionId));
  const hashes = new Set(catalog.signatures.map(entry => `${entry.header}:${entry.signatureHash}`));
  if (ids.size !== catalog.signatureCount || hashes.size !== catalog.signatureCount) {
    throw new Error('FBro 覆盖清单存在稳定 ID 或签名哈希冲突。');
  }
  const classified = catalog.summary.highLevel + catalog.summary.advancedSafe + catalog.summary.internal;
  if (classified !== catalog.signatureCount) throw new Error('FBro 覆盖清单存在未分类签名。');
  if (catalog.eventCatalog.length === 0 || catalog.eventCatalog.some(event => !event.defaultAction || !event.bridgeStatus)) {
    throw new Error('FBro 事件目录为空或存在未定义默认动作/桥接状态的事件。');
  }
  if (catalog.signatures.some(entry => !entry.wrapperSymbol || entry.overloads.length !== entry.overloadCount
      || entry.overloads.some(overload => !overload.returnCodec?.codec || overload.parameters.some(parameter => !parameter.codec)))) {
    throw new Error('FBro wrapper 规范存在缺失的导出符号、重载或参数 codec。');
  }
}

function readFbroVersion(source) {
  return ['MAIN', 'EDIT', 'DEBUG'].map(part => source.match(new RegExp(`#define\\s+VERSIONS_${part}\\s+(\\d+)`, 'u'))?.[1] || '0').join('.');
}

function readDefine(source, name) {
  return source.match(new RegExp(`#define\\s+${name}\\s+"([^"]+)"`, 'u'))?.[1] || '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function renderMarkdown(catalog) {
  const moduleRows = Object.entries(catalog.summary.modules)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([moduleId, count]) => `| \`${moduleId}\` | ${MODULE_LABELS[moduleId]} | ${count} |`)
    .join('\n');
  return `# FBro API 覆盖清单\n\n`
    + `确定性基线：FBro ${catalog.baseline.fbroVersion}、CEF ${catalog.baseline.cefVersion}、${catalog.baseline.platform}。`
    + `火山 \`.v\` 二进制工程只用于火山 IDE 抽样核对，不参与本清单生成。\n\n`
    + `- 公共头文件：${catalog.headerCount}\n- 导出签名：${catalog.signatureCount}\n`
    + `- 高层封装：${catalog.summary.highLevel}\n- 高级安全封装：${catalog.summary.advancedSafe}（已实现 ${catalog.summary.implemented - catalog.summary.highLevel}，待实现 ${catalog.summary.planned}）\n- 内部/生命周期项：${catalog.summary.internal}\n\n`
    + `- 官方事件槽位：${catalog.eventSlotCount}\n- 唯一事件签名：${catalog.uniqueEventSignatureCount}\n`
    + `- 事件确定状态：${catalog.eventCatalog.length}（公开实现 ${catalog.eventCatalog.filter(event => event.bridgeStatus === 'implemented').length}，受管适配 ${catalog.eventCatalog.filter(event => event.bridgeStatus === 'managed').length}，内部生命周期 ${catalog.eventCatalog.filter(event => event.bridgeStatus === 'internal').length}，明确不适用 ${catalog.eventCatalog.filter(event => event.bridgeStatus === 'notApplicable').length}）\n\n`
    + `| 模块 ID | 中文能力域 | 签名数 |\n|---|---:|---:|\n${moduleRows}\n\n`
    + `逐签名稳定 ID、SHA-256、官方英文别名、中文主名称、分类、实现状态和理由位于 `
    + `\`electron/src/services/modules/fbroApiCoverage.generated.json\`。\n`;
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
