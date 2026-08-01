import coverage from './fbroApiCoverage.generated.json';
import type {
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandContribution
} from './types';

type VipRoute = 'dom' | 'extension' | 'resource' | 'devtools' | 'config' | 'appliedInfo'
  | 'licenseInfo' | 'fingerCount' | 'clearFingerCount' | 'managed' | 'secureReplacement';

interface CoverageSignature {
  officialName: string;
  officialSignature: string;
  signatureHash: string;
  moduleId: string;
}

export interface FbroVipApiCatalogEntry {
  officialName: string;
  officialSignature: string;
  category: string;
  capabilityKind: NonNullable<ModuleCommandContribution['capabilityKind']>;
  route: VipRoute;
  configPath?: string;
  command: ModuleCommandContribution;
  binding: ModuleCommandBinding;
}

export const FBRO_VIP_AGGREGATE_CATEGORY = '批量与通用高级入口';

const MANAGED_CAPABILITIES = new Set([
  'FBroSetVipEvent',
  'FBroHsBrowser_GetVIPControl',
  'FBroHsVIPControl_IsNULL',
  'FBroHsVIPControl_GetBrowser',
  'FBroHsVIPUserAgentData_Create',
  'FBroHsVIPControl_PageCaptureScreenshot'
]);

const SECURE_REPLACEMENTS = new Set([
  'FBroHsBrowser_SetLicenceKey',
  'FBroHsOnlineLicenseControl_SetKey',
  'FBroHsVIPCommandLine_SetProxy'
]);

const DEVTOOLS_ACTIONS = new Set([
  'FBroHsVIPControl_AddDevToolsMessageObserver',
  'FBroHsVIPControl_DeleteDevToolsMessageObserver',
  'FBroHsVIPControl_AddTabAt',
  'FBroHsVIPControl_DispatchKeyEvent',
  'FBroHsVIPControl_DispatchMouseEvent',
  'FBroHsVIPControl_DispatchTouchEvent',
  'FBroHsVIPControl_ExecuteDevToolsMethod',
  'FBroHsVIPControl_PageGetContextID',
  'FBroHsVIPControl_RuntimeEnable',
  'FBroHsVIPControl_RuntimeEvaluate',
  'FBroHsVIPControl_RuntimeEvaluate_FrameID',
  'FBroHsVIPControl_SendDevToolsMessage'
]);

const CONFIG_PATHS: Record<string, string> = {
  FBroHsVIPControl_SetVirProductSub: 'productSub',
  FBroHsVIPControl_SetVirVendor: 'vendor',
  FBroHsVIPControl_SetVirVendorSub: 'vendorSub',
  FBroHsVIPControl_SetVirPlatform: 'platform',
  FBroHsVIPControl_SetVirAcceptlanguages: 'acceptLanguages',
  FBroHsVIPControl_SetVirLanguages: 'languages',
  FBroHsVIPControl_SetVirAppCodeName: 'appCodeName',
  FBroHsVIPControl_SetVirAppName: 'appName',
  FBroHsVIPControl_SetVirAppVersion: 'appVersion',
  FBroHsVIPControl_SetVirProduct: 'product',
  FBroHsVIPControl_SetVirHardwareConcurrency: 'hardwareConcurrency',
  FBroHsVIPControl_SetVirCookieEnabled: 'cookieEnabled',
  FBroHsVIPControl_SetVirDeviceMemory: 'deviceMemory',
  FBroHsVIPControl_SetVirJavaEnabled: 'javaEnabled',
  FBroHsVIPControl_SetVirWebdriver: 'webdriver',
  FBroHsVIPControl_SetVirOnLine: 'online',
  FBroHsVIPControl_SetVirCanvas2DFontFingerprint: 'canvas2dFontFingerprint',
  FBroHsVIPControl_SetVirScreencolorDepth: 'screenColorDepth',
  FBroHsVIPControl_SetVirScreenpixelDepth: 'screenPixelDepth',
  FBroHsVIPControl_SetVirDevicePixelRatio: 'devicePixelRatio',
  FBroHsVIPControl_SetVirWebglvendor: 'webglVendor',
  FBroHsVIPControl_SetVirWebglrenderer: 'webglRenderer',
  FBroHsVIPControl_SetVirAudioInput: 'audioInput',
  FBroHsVIPControl_SetVirVideoInput: 'videoInput',
  FBroHsVIPControl_SetVirAudioOutput: 'audioOutput',
  FBroHsVIPControl_SetVirKernel: 'kernel',
  FBroHsVIPControl_SetVirSpeechSynthesisVoices: 'speechSynthesisVoices',
  FBroHsVIPControl_SetVirGPUVendor: 'gpuVendor',
  FBroHsVIPControl_SetVirGPUArchitecture: 'gpuArchitecture',
  FBroHsVIPControl_SetVirGPUDevice: 'gpuDevice',
  FBroHsVIPControl_SetVirGPUDescription: 'gpuDescription',
  FBroHsVIPControl_SetVirGPUSubgroupMinSize: 'gpuSubgroupMinSize',
  FBroHsVIPControl_SetVirGPUSubgroupMaxSize: 'gpuSubgroupMaxSize',
  FBroHsVIPControl_SetVirisTrusted: 'isTrusted',
  FBroHsVIPControl_SetWebFeatureKernel: 'webFeatureKernel',
  FBroHsVIPControl_SetCSSKernel: 'cssKernel',
  FBroHsVIPControl_SetV8Kernel: 'v8Kernel',
  FBroHsVIPControl_SetDisableDebugger: 'disableDebugger',
  FBroHsVIPControl_SetDisableConsoleDebug: 'disableConsoleDebug',
  FBroHsVIPControl_SetDisableConsoleWarn: 'disableConsoleWarn',
  FBroHsVIPControl_SetDisableConsoleError: 'disableConsoleError',
  FBroHsVIPControl_SetDisableConsoleInfo: 'disableConsoleInfo',
  FBroHsVIPControl_SetDisableConsoleLog: 'disableConsoleLog',
  FBroHsVIPControl_SetDisableConsoleAssert: 'disableConsoleAssert',
  FBroHsVIPControl_SetDisableConsoleDir: 'disableConsoleDir',
  FBroHsVIPControl_SetDisableConsoleTable: 'disableConsoleTable',
  FBroHsVIPControl_SetDisableConsoleGroup: 'disableConsoleGroup',
  FBroHsVIPControl_SetDisableConsoleTime: 'disableConsoleTime',
  FBroHsVIPControl_SetDisableConsoleProfile: 'disableConsoleProfile',
  FBroHsVIPControl_SetDisableConsoleCount: 'disableConsoleCount',
  FBroHsVIPControl_SetDisableConsoleTrace: 'disableConsoleTrace',
  FBroHsVIPControl_SetDisableConsoleClear: 'disableConsoleClear',
  FBroHsVIPControl_EnableWebsocketClientHook: 'enableWebsocketClientHook',
  FBroHsVIPControl_ClearAllData: 'clearAllData',
  FBroHsVIPControl_ClearS5Auth: 'clearS5Auth',
  FBroHsVIPControl_SetEmitTouchEventsForMouse: 'emitTouchEventsForMouse',
  FBroHsVIPControl_SetDisablePerformanceCheck: 'performanceCheck',
  FBroHsVIPControl_SetS5Auth: 's5Auth',
  FBroHsVIPGlobal_SetS5Auth: 's5Auth',
  FBroHsVIPControl_SetPlugins: 'plugins',
  FBroHsVIPControl_SetVirCSSFontFingerprint: 'cssFontFingerprint',
  FBroHsVIPControl_SetVirRectFingerprint: 'rectFingerprint',
  FBroHsVIPControl_SetVirWebrtcIP: 'webrtc',
  FBroHsVIPControl_SetVirTimeZone: 'timeZone',
  FBroHsVIPControl_SetTouchEventEmulationEnabled: 'touchEmulation',
  FBroHsVIPControl_SetVirBatteryManagerCharging: 'battery.charging',
  FBroHsVIPControl_SetVirBatteryManagerChargingTime: 'battery.chargingTime',
  FBroHsVIPControl_SetVirBatteryManagerDischargingTime: 'battery.dischargingTime',
  FBroHsVIPControl_SetVirBatteryManagerLevel: 'battery.level',
  FBroHsVIPControl_SetVirLongitudeAndLatitude: 'geolocation',
  FBroHsVIPControl_SetVirViewport: 'viewport',
  FBroHsVIPControl_SetSSLCipher: 'sslCipher',
  FBroHsVIPControl_SetVirOrientation: 'orientation',
  FBroHsVIPControl_SetVirGPULimits: 'gpuLimits',
  FBroHsVIPControl_SetCanvasFingerPrint_constant: 'fingerprints.canvas.constant',
  FBroHsVIPControl_SetCanvasFingerPrint_random: 'fingerprints.canvas',
  FBroHsVIPControl_SetWebGLFingerPrint_constant: 'fingerprints.webgl.constant',
  FBroHsVIPControl_SetWebGLFingerPrint_random: 'fingerprints.webgl',
  FBroHsVIPControl_SetAudioFingerPrint_constant: 'fingerprints.audio.constant',
  FBroHsVIPControl_SetAudioFingerPrint_random: 'fingerprints.audio',
  FBroHsVIPControl_SetVirUserAgent: 'userAgent'
};

const USER_AGENT_FIELDS: Record<string, string> = {
  MainUserAgent: 'mainUserAgent',
  MainAcceptLanguage: 'mainAcceptLanguage',
  MainPlatform: 'mainPlatform',
  FullVersion: 'fullVersion',
  Platform: 'platform',
  PlatformVersion: 'platformVersion',
  Architecture: 'architecture',
  Model: 'model',
  Mobile: 'mobile',
  Bitness: 'bitness',
  Wow64: 'wow64',
  Brands: 'brands',
  FullVersionList: 'fullVersionList',
  FormFactors: 'formFactors'
};

const USER_AGENT_LABELS: Record<string, string> = {
  MainUserAgent: '主User-Agent', MainAcceptLanguage: '主接受语言', MainPlatform: '主平台', FullVersion: '完整版本',
  Platform: '平台', PlatformVersion: '平台版本', Architecture: '架构', Model: '设备型号', Mobile: '移动设备标记',
  Bitness: '系统位数', Wow64: 'WOW64标记', Brands: '品牌列表', FullVersionList: '完整版本列表', FormFactors: '设备形态列表'
};

const CONFIG_LABELS: Record<string, string> = {
  productSub: '产品子版本', vendor: '厂商', vendorSub: '厂商子版本', platform: '平台', acceptLanguages: '接受语言',
  languages: '语言列表', appCodeName: '应用代码名', appName: '应用名', appVersion: '应用版本', product: '产品名',
  hardwareConcurrency: '硬件并发数', cookieEnabled: 'Cookie启用状态', deviceMemory: '设备内存', javaEnabled: 'Java启用状态',
  webdriver: 'WebDriver标记', online: '在线状态', canvas2dFontFingerprint: 'Canvas字体指纹', screenColorDepth: '屏幕颜色深度',
  screenPixelDepth: '屏幕像素深度', devicePixelRatio: '设备像素比', webglVendor: 'WebGL厂商', webglRenderer: 'WebGL渲染器',
  audioInput: '音频输入设备', videoInput: '视频输入设备', audioOutput: '音频输出设备', kernel: '浏览器内核',
  speechSynthesisVoices: '语音合成声音', gpuVendor: 'GPU厂商', gpuArchitecture: 'GPU架构', gpuDevice: 'GPU设备',
  gpuDescription: 'GPU描述', gpuSubgroupMinSize: 'GPU子组最小值', gpuSubgroupMaxSize: 'GPU子组最大值', isTrusted: '可信事件标记',
  webFeatureKernel: 'Web功能内核', cssKernel: 'CSS内核', v8Kernel: 'V8内核', disableDebugger: '禁用调试器',
  disableConsoleDebug: '禁用Console Debug', disableConsoleWarn: '禁用Console Warn', disableConsoleError: '禁用Console Error',
  disableConsoleInfo: '禁用Console Info', disableConsoleLog: '禁用Console Log', disableConsoleAssert: '禁用Console Assert',
  disableConsoleDir: '禁用Console Dir', disableConsoleTable: '禁用Console Table', disableConsoleGroup: '禁用Console Group',
  disableConsoleTime: '禁用Console Time', disableConsoleProfile: '禁用Console Profile', disableConsoleCount: '禁用Console Count',
  disableConsoleTrace: '禁用Console Trace', disableConsoleClear: '禁用Console Clear', enableWebsocketClientHook: '启用WebSocket客户端钩子',
  clearAllData: '清空全部数据', clearS5Auth: '清空S5认证', emitTouchEventsForMouse: '鼠标模拟触摸事件',
  performanceCheck: '性能检查范围', s5Auth: 'S5代理认证', plugins: '插件指纹', cssFontFingerprint: 'CSS字体指纹',
  rectFingerprint: '矩形指纹', webrtc: 'WebRTC地址', timeZone: '时区', touchEmulation: '触摸事件模拟',
  'battery.charging': '电池充电状态', 'battery.chargingTime': '电池充电时间', 'battery.dischargingTime': '电池放电时间',
  'battery.level': '电池电量', geolocation: '地理位置', viewport: '视口', sslCipher: 'SSL密码套件', orientation: '屏幕方向',
  gpuLimits: 'GPU限制', 'fingerprints.canvas.constant': 'Canvas固定指纹', 'fingerprints.canvas': 'Canvas随机指纹',
  'fingerprints.webgl.constant': 'WebGL固定指纹', 'fingerprints.webgl': 'WebGL随机指纹',
  'fingerprints.audio.constant': '音频固定指纹', 'fingerprints.audio': '音频随机指纹', userAgent: 'User-Agent Data'
};

const SPECIAL_COMMAND_LABELS: Record<string, string> = {
  FBroBrowser_IsLicenceKey: '是否已配置授权密钥',
  FBroHsBrowser_GetExpirationTime: '取授权到期时间',
  FBroHsBrowser_GetFunctionStr: '取授权功能',
  FBroHsBrowser_GetMachineCode: '取机器码',
  FBroHsBrowser_GetRegistrationTime: '取授权注册时间',
  FBroHsBrowser_GetVersionStr: '取授权版本',
  FBroHsBrowser_GetVIPControl: '取VIP控件状态',
  FBroHsBrowser_SetLicenceKey: '设置授权密钥',
  FBroHsOnlineLicenseControl_GetError: '取在线授权错误',
  FBroHsOnlineLicenseControl_GetShowLicenseDevTool: '取开发者工具授权',
  FBroHsOnlineLicenseControl_GetShowLicenseEndDate: '取授权结束日期',
  FBroHsOnlineLicenseControl_GetShowLicenseFunction: '取授权功能范围',
  FBroHsOnlineLicenseControl_GetShowLicenseStartDate: '取授权开始日期',
  FBroHsOnlineLicenseControl_GetShowLicenseSysVersion: '取授权系统版本',
  FBroHsOnlineLicenseControl_GetShowLicenseType: '取授权类型',
  FBroHsOnlineLicenseControl_SetKey: '设置在线授权密钥',
  FBroHsVIPControl_AddResourceHandlerChangeData: '添加实例资源缓冲替换',
  FBroHsVIPControl_AddResourceHandlerChangeFile: '添加实例资源文件替换',
  FBroHsVIPControl_AddResponseFilterChangeData: '添加实例响应替换',
  FBroHsVIPControl_DeleteResourceHandlerAllData: '清空实例资源替换',
  FBroHsVIPControl_DeleteResourceHandlerChangeData: '删除实例资源替换',
  FBroHsVIPControl_DeleteResponseFilterAllData: '清空实例响应替换',
  FBroHsVIPControl_DeletResponseFiltereChangeData: '删除实例响应替换',
  FBroHsVIPControl_GetFingerCount: '取调用次数',
  FBroHsVIPControl_ClearFingerCount: '清空调用次数',
  FBroHsVIPControl_IsNULL: '检查VIP控件可用性',
  FBroHsVIPControl_GetBrowser: '取所属浏览器状态',
  FBroHsVIPCommandLine_SetProxy: '设置启动代理',
  FBroHsVIPGlobal_SetS5Auth: '设置全局S5代理认证',
  FBroHsVIPUserAgentData_Create: '创建User-Agent Data',
  FBroSetVipEvent: '设置VIP事件适配器'
};

const FIELD_LABELS: Record<string, string> = {
  ProductSub: '产品子版本', Vendor: '厂商', VendorSub: '厂商子版本', Platform: '平台',
  Acceptlanguages: '接受语言', Languages: '语言列表', AppCodeName: '应用代码名', AppName: '应用名',
  AppVersion: '应用版本', Product: '产品名', HardwareConcurrency: '硬件并发数', CookieEnabled: 'Cookie启用状态',
  DeviceMemory: '设备内存', JavaEnabled: 'Java启用状态', Webdriver: 'WebDriver标记', OnLine: '在线状态',
  Canvas2DFontFingerprint: 'Canvas字体指纹', ScreencolorDepth: '屏幕颜色深度', ScreenpixelDepth: '屏幕像素深度',
  DevicePixelRatio: '设备像素比', Webglvendor: 'WebGL厂商', Webglrenderer: 'WebGL渲染器', AudioInput: '音频输入设备',
  VideoInput: '视频输入设备', AudioOutput: '音频输出设备', Kernel: '浏览器内核', SpeechSynthesisVoices: '语音合成声音',
  GPUVendor: 'GPU厂商', GPUArchitecture: 'GPU架构', GPUDevice: 'GPU设备', GPUDescription: 'GPU描述',
  GPUSubgroupMinSize: 'GPU子组最小值', GPUSubgroupMaxSize: 'GPU子组最大值', GPULimits: 'GPU限制',
  isTrusted: '可信事件标记', ScreenHeightAndWidth: '屏幕高度与宽度', ScreenavailHeightAndWidth: '可用屏幕高度与宽度',
  ScreenXAndY: '屏幕坐标', RectFingerprint: '矩形指纹', WebrtcIP: 'WebRTC地址', TimeZone: '时区',
  Viewport: '视口', Orientation: '屏幕方向', LongitudeAndLatitude: '地理位置', CSSFontFingerprint: 'CSS字体指纹',
  BatteryManagerCharging: '电池充电状态', BatteryManagerChargingTime: '电池充电时间',
  BatteryManagerDischargingTime: '电池放电时间', BatteryManagerLevel: '电池电量', UserAgent: 'User-Agent Data'
};

const ACTION_LABELS: Record<string, string> = {
  enable: '启用', disable: '禁用', getDocument: '取文档', getAttributes: '取属性', getOuterHTML: '取外部HTML',
  getContainerForNode: '取节点容器', querySelector: '查询选择器', querySelectorAll: '查询全部选择器',
  performSearch: '执行搜索', getSearchResults: '取搜索结果', discardSearchResults: '丢弃搜索结果',
  focusElement: '聚焦元素', removeAttribute: '删除属性', removeNode: '删除节点', setAttributeValue: '设置属性值',
  setAttributesAsText: '按文本设置属性', setNodeName: '设置节点名', setNodeValue: '设置节点值', setOuterHTML: '设置外部HTML',
  EnableExtensionPlus: '启用扩展增强', LoadExtension: '加载扩展目录', InstallCrx: '安装CRX', UnstallExtension: '卸载扩展',
  GetExtensionName: '取扩展名称', GetExtensionPath: '取扩展路径', GetExtensionURL: '取扩展地址',
  AddChangeData: '添加缓冲替换', AddChangeFile: '添加文件替换', DeleteChangeData: '删除替换规则', DeleteAllData: '清空替换规则',
  AddDevToolsMessageObserver: '添加消息观察器', DeleteDevToolsMessageObserver: '删除消息观察器',
  AddTabAt: '添加标签页', DispatchKeyEvent: '发送键盘事件', DispatchMouseEvent: '发送鼠标事件',
  DispatchTouchEvent: '发送触摸事件', ExecuteDevToolsMethod: '执行DevTools方法', PageGetContextID: '取页面上下文ID',
  RuntimeEnable: '启用Runtime', RuntimeEvaluate: '执行表达式', RuntimeEvaluate_FrameID: '按框架执行表达式',
  SendDevToolsMessage: '发送DevTools消息', PageCaptureScreenshot: '页面截图'
};

function routeFor(officialName: string): { route: VipRoute; configPath?: string } {
  if (MANAGED_CAPABILITIES.has(officialName)) return { route: 'managed' };
  if (SECURE_REPLACEMENTS.has(officialName)) return { route: 'secureReplacement' };
  if (officialName.startsWith('FBroHsDevToolsDOM_')) return { route: 'dom' };
  if (officialName.startsWith('FBroHsVIPRequestContext_')) return { route: 'extension' };
  if (/ResourceHandler|ResponseFilter/u.test(officialName)) return { route: 'resource' };
  if (DEVTOOLS_ACTIONS.has(officialName)) return { route: 'devtools' };
  if (officialName === 'FBroHsVIPControl_GetFingerCount') return { route: 'fingerCount' };
  if (officialName === 'FBroHsVIPControl_ClearFingerCount') return { route: 'clearFingerCount' };
  if (/^(?:FBroBrowser_IsLicenceKey|FBroHsBrowser_Get(?:ExpirationTime|FunctionStr|MachineCode|RegistrationTime|VersionStr)|FBroHsOnlineLicenseControl_Get)/u.test(officialName)) {
    return { route: 'licenseInfo' };
  }
  const userAgentMatch = officialName.match(/^FBroHsVIPUserAgentData_(Set|Get)(.+)$/u);
  if (userAgentMatch) {
    if (userAgentMatch[1] === 'Get') return { route: 'appliedInfo' };
    return { route: 'config', configPath: `userAgent.${USER_AGENT_FIELDS[userAgentMatch[2]] || lowerFirst(userAgentMatch[2])}` };
  }
  if (CONFIG_PATHS[officialName]) return { route: 'config', configPath: CONFIG_PATHS[officialName] };
  if (/^FBroHsVIPControl_(?:Set|Clear|Enable)/u.test(officialName) || officialName.startsWith('FBroHsVIPGlobal_')) {
    return { route: 'config' };
  }
  return { route: 'managed' };
}

function categoryFor(officialName: string): string {
  if (officialName.startsWith('FBroHsDevToolsDOM_')) return 'DOM';
  if (officialName.startsWith('FBroHsVIPRequestContext_')) return '浏览器扩展';
  if (/ResourceHandler/u.test(officialName)) return '资源替换';
  if (/ResponseFilter/u.test(officialName)) return '响应过滤';
  if (DEVTOOLS_ACTIONS.has(officialName) || /DevTools/u.test(officialName)) return 'DevTools 与输入';
  if (/VIPUserAgentData|SetVirUserAgent/u.test(officialName)) return 'User-Agent Data';
  if (/Screen|Viewport|Orientation|DevicePixelRatio/u.test(officialName)) return '屏幕与视口';
  if (/GPU|WebGL|Webgl/u.test(officialName)) return 'GPU 与 WebGL';
  if (/Canvas|AudioFinger|RectFingerprint|CSSFontFingerprint/u.test(officialName)) return 'Canvas、字体与音频指纹';
  if (/Battery/u.test(officialName)) return '电池';
  if (/Longitude|Latitude|TimeZone/u.test(officialName)) return '位置与时区';
  if (/AudioInput|AudioOutput|VideoInput|Plugins|SpeechSynthesis/u.test(officialName)) return '设备与插件';
  if (/Disable|Kernel|Trusted|TouchEvent|Performance/u.test(officialName)) return '内核与反检测';
  if (/Licence|License|Expiration|Registration|MachineCode|VersionStr|FunctionStr/u.test(officialName)) return '授权状态';
  if (/S5|Proxy|SSL|Webrtc/u.test(officialName)) return '网络与代理';
  if (/FingerCount/u.test(officialName)) return '调用统计';
  if (MANAGED_CAPABILITIES.has(officialName)) return 'Bridge 自动管理';
  return '浏览器指纹';
}

function commandNameFor(officialName: string, category: string): string {
  if (SPECIAL_COMMAND_LABELS[officialName]) return `FBroVIP_${sanitizeCategory(category)}_${SPECIAL_COMMAND_LABELS[officialName]}`;
  if (CONFIG_PATHS[officialName]) return `FBroVIP_${sanitizeCategory(category)}_设置${CONFIG_LABELS[CONFIG_PATHS[officialName]] || splitIdentifier(CONFIG_PATHS[officialName])}`;
  let action = officialName;
  for (const prefix of [
    'FBroHsDevToolsDOM_', 'FBroHsVIPRequestContext_', 'FBroHsVIPResourceHandler_', 'FBroHsVIPResponseFilter_',
    'FBroHsVIPUserAgentData_', 'FBroHsVIPControl_', 'FBroHsVIPGlobal_', 'FBroHsOnlineLicenseControl_',
    'FBroHsVIPCommandLine_', 'FBroHsBrowser_', 'FBroBrowser_', 'FBro'
  ]) {
    if (action.startsWith(prefix)) { action = action.slice(prefix.length); break; }
  }
  const directLabel = ACTION_LABELS[action];
  if (directLabel) return `FBroVIP_${sanitizeCategory(category)}_${directLabel}`;
  if (action.startsWith('SetVir')) return `FBroVIP_${sanitizeCategory(category)}_设置${FIELD_LABELS[action.slice(6)] || splitIdentifier(action.slice(6))}`;
  const userAgentMatch = action.match(/^(Set|Get)(.+)$/u);
  if (userAgentMatch && category === 'User-Agent Data') {
    return `FBroVIP_UserAgent_${userAgentMatch[1] === 'Set' ? '设置' : '取'}${USER_AGENT_LABELS[userAgentMatch[2]] || splitIdentifier(userAgentMatch[2])}`;
  }
  const verbPairs: Array<[RegExp, string]> = [
    [/^Get/u, '取'], [/^Set/u, '设置'], [/^Add/u, '添加'], [/^Delete/u, '删除'], [/^Delet/u, '删除'],
    [/^Clear/u, '清空'], [/^Enable/u, '启用'], [/^Disable/u, '禁用'], [/^Create/u, '创建'], [/^Creat/u, '创建'],
    [/^Install/u, '安装'], [/^Unstall/u, '卸载'], [/^Is/u, '是否'], [/^Execute/u, '执行'], [/^Dispatch/u, '发送']
  ];
  for (const [pattern, label] of verbPairs) {
    if (pattern.test(action)) return `FBroVIP_${sanitizeCategory(category)}_${label}${splitIdentifier(action.replace(pattern, ''))}`;
  }
  return `FBroVIP_${sanitizeCategory(category)}_${splitIdentifier(action)}`;
}

function splitIdentifier(value: string): string {
  const replacements: Record<string, string> = {
    Browser: '浏览器', Error: '错误', Show: '显示', Start: '开始', End: '结束', Date: '日期', Sys: '系统',
    Type: '类型', DevTool: '开发者工具', Function: '功能', Version: '版本', Expiration: '到期', Registration: '注册',
    Machine: '机器', Code: '码', Key: '密钥', Proxy: '代理', Data: '数据', File: '文件', Message: '消息', Observer: '观察器',
    Context: '上下文', Runtime: '运行时', Evaluate: '求值', Frame: '框架', ID: '标识', Event: '事件', Control: '控件',
    String: '文本', Size: '数量', Current: '当前', Value: '值', Global: '全局', Websocket: 'WebSocket', Client: '客户端', Hook: '钩子'
  };
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/_/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .map(token => replacements[token] || token)
    .join('');
}

function sanitizeCategory(category: string): string {
  return category.replace(/[\s、与·-]+/gu, '');
}

function sanitizeCommandIdentifier(commandName: string): string {
  return commandName.replace(/[^\p{L}\p{N}_]+/gu, '');
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function capabilityKindFor(route: VipRoute): NonNullable<ModuleCommandContribution['capabilityKind']> {
  if (route === 'managed') return 'managed';
  if (route === 'secureReplacement') return 'secureReplacement';
  return 'single';
}

function returnTypeFor(route: VipRoute): ModuleBindingValueType {
  if (['dom', 'extension', 'resource', 'devtools'].includes(route)) return 'longLong';
  if (route === 'config' || route === 'clearFingerCount') return 'int';
  return 'wideString';
}

function returnLabel(type: ModuleBindingValueType): string {
  if (type === 'longLong') return '长整数型';
  if (type === 'int') return '整数型';
  return '文本型';
}

function descriptionFor(signature: CoverageSignature, route: VipRoute, configPath?: string): string {
  const official = `官方接口：${signature.officialSignature}。`;
  if (route === 'managed') return `${official}该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。`;
  if (route === 'secureReplacement') return `${official}该原始入口涉及授权 Key、代理凭据或初始化时序，已由“浏览器凭据设置中心”或现有安全高级入口替代；不会把 Key 写入 .lcpp。`;
  if (route === 'config') return `${official}这是独立的安全指纹命令；参数JSON为${configPath ? `路径 ${configPath} 对应的完整 JSON 值` : '该接口对应的完整指纹配置补丁'}，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。`;
  if (route === 'appliedInfo') return `${official}返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。`;
  if (route === 'licenseInfo') return `${official}返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。`;
  if (route === 'fingerCount' || route === 'clearFingerCount') return `${official}复用受控 VIP 调用统计接口。`;
  return `${official}命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。`;
}

const vipSignatures = (coverage.signatures as CoverageSignature[])
  .filter(item => item.moduleId === 'lingbuilder.fbro.vip')
  .sort((left, right) => left.officialName.localeCompare(right.officialName, 'en'));

const usedCommandNames = new Set<string>();

export const FBRO_VIP_API_CATALOG: FbroVipApiCatalogEntry[] = vipSignatures.map(signature => {
  const routeDefinition = routeFor(signature.officialName);
  const category = categoryFor(signature.officialName);
  const baseName = sanitizeCommandIdentifier(commandNameFor(signature.officialName, category));
  const commandName = usedCommandNames.has(baseName)
    ? `${baseName}_${signature.signatureHash.slice(0, 6).toUpperCase()}`
    : baseName;
  usedCommandNames.add(commandName);
  const returnType = returnTypeFor(routeDefinition.route);
  const capabilityKind = capabilityKindFor(routeDefinition.route);
  const parameters = [
    { name: '控件名', type: 'controlRef' as const, description: '所属 FBro 浏览器设计器控件名。' },
    { name: '参数JSON', type: 'wideString' as const, description: '该固定接口的 UTF-16 JSON 参数；无参数时传 {}。' }
  ];
  const runtimeName = `FBroVIP单项_${signature.signatureHash.slice(0, 12).toUpperCase()}`;
  return {
    officialName: signature.officialName,
    officialSignature: signature.officialSignature,
    category,
    capabilityKind,
    route: routeDefinition.route,
    configPath: routeDefinition.configPath,
    command: {
      name: commandName,
      aliases: [signature.officialName],
      signature: `${commandName}(控件名, 参数JSON)`,
      description: descriptionFor(signature, routeDefinition.route, routeDefinition.configPath),
      insertText: `${commandName}("$1", "$2")`,
      returnType: returnLabel(returnType),
      category,
      capabilityKind,
      officialCapability: true,
      visibility: capabilityKind === 'single' ? 'advanced' : 'internal'
    },
    binding: {
      command: commandName,
      runtimeName,
      parameters,
      returnType,
      encoding: 'wide',
      example: `${commandName}("FBro浏览器1", "{}")`
    }
  };
});

export const FBRO_VIP_OFFICIAL_ENTRIES = FBRO_VIP_API_CATALOG.map(entry => ({
  command: entry.command,
  binding: entry.binding
}));

export function generateFbroVipIndividualRuntime(staticFunctions: boolean): string {
  const indent = staticFunctions ? '' : '    ';
  const prefix = staticFunctions ? 'static ' : '';
  const helper = `${indent}${prefix}int FBroVIP单项_应用配置路径(const wchar_t* controlName, const wchar_t* path, const wchar_t* argsJson) {\n`
    + `${indent}    const std::wstring value = argsJson && *argsJson ? argsJson : L"null";\n`
    + `${indent}    const std::wstring key = path ? path : L"";\n`
    + `${indent}    if (key.empty()) return FBro指纹_应用配置(controlName, value.c_str());\n`
    + `${indent}    std::vector<std::wstring> parts; std::wstring current;\n`
    + `${indent}    for (wchar_t ch : key) { if (ch == L'.') { parts.push_back(current); current.clear(); } else current.push_back(ch); }\n`
    + `${indent}    if (!current.empty()) parts.push_back(current);\n`
    + `${indent}    std::wstring patch;\n`
    + `${indent}    for (const auto& part : parts) patch += L"{\\\"" + part + L"\\\":";\n`
    + `${indent}    patch += value;\n`
    + `${indent}    for (size_t index = 0; index < parts.size(); ++index) patch += L"}";\n`
    + `${indent}    return FBro指纹_应用配置(controlName, patch.c_str());\n`
    + `${indent}}\n`;
  const wrappers = FBRO_VIP_API_CATALOG.map(entry => {
    const signature = `${indent}${prefix}${cppReturnType(returnTypeFor(entry.route))} ${entry.binding.runtimeName}(const wchar_t* controlName, const wchar_t* argsJson)`;
    let body: string;
    if (entry.route === 'dom') body = `return FBro指纹_DOM异步命令(controlName, L"${entry.officialName}", argsJson);`;
    else if (entry.route === 'extension') body = `return FBro指纹_扩展异步命令(controlName, L"${entry.officialName}", argsJson);`;
    else if (entry.route === 'resource') body = `return FBro指纹_资源规则异步命令(controlName, L"${entry.officialName}", argsJson);`;
    else if (entry.route === 'devtools') body = `return FBro指纹_开发者工具异步命令(controlName, L"${entry.officialName}", argsJson);`;
    else if (entry.route === 'config') body = `return FBroVIP单项_应用配置路径(controlName, L"${entry.configPath || ''}", argsJson);`;
    else if (entry.route === 'appliedInfo') body = 'return FBro指纹_取已应用配置(controlName);';
    else if (entry.route === 'licenseInfo') body = 'return FBro指纹_取授权信息();';
    else if (entry.route === 'fingerCount') body = 'return FBro指纹_取调用次数(controlName);';
    else if (entry.route === 'clearFingerCount') body = 'return FBro指纹_清空调用次数(controlName);';
    else if (entry.route === 'secureReplacement') body = `return std::wstring(L"${entry.officialName} 已由浏览器凭据设置中心或安全高级入口替代，不允许在源码中传入 Key/凭据");`;
    else body = `return std::wstring(L"${entry.officialName} 由 LingBuilder FBro Bridge 自动管理，无需操作 SDK 对象句柄");`;
    return `${signature} { ${body} }`;
  }).join('\n');
  return `${helper}${wrappers}`;
}

function cppReturnType(type: ModuleBindingValueType): string {
  if (type === 'longLong') return 'long long';
  if (type === 'int') return 'int';
  return 'std::wstring';
}
