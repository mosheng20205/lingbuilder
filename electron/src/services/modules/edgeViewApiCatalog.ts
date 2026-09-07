import type { ModuleBindingValueType, ModuleCommandBinding, ModuleCommandBindingParameter, ModuleCommandContribution } from './types';
import { createModuleBindingSnippetArgument, isWideStringAbiBindingType, normalizeControlReferenceCallSnippet, normalizeControlReferenceParameter } from './bindingValueType';

export const EDGEVIEW_SAFE_API_CAPABILITY = 'edgeview.safe-api.v1';
export const EDGEVIEW_SAFE_API_V2_CAPABILITY = 'edgeview.safe-api.v2';
export const EDGEVIEW_MINIMUM_SDK_VERSION = '1.0.3537.50';
export const EDGEVIEW_SDK_VERSION = '1.0.4078.44';
export const EDGEVIEW_MINIMUM_RUNTIME_MAJOR = 141;
export const EDGEVIEW_FULL_RUNTIME_MAJOR = 150;

export type EdgeViewApiFamily =
  | '任务' | '导航' | '脚本' | '设置' | '会话' | '下载' | '查找'
  | '打印' | '媒体' | '开发者工具' | '资源' | '事件'
  | '对象' | '框架' | '工作线程' | '扩展' | '权限' | '通知' | '缓冲' | '安全';

export interface EdgeViewApiCatalogEntry {
  family: EdgeViewApiFamily;
  command: ModuleCommandContribution;
  binding: ModuleCommandBinding;
  /** WebView2 SDK 中作为本命令确定性实现依据的接口成员。 */
  sdkMembers: string[];
  /** 生成的 C++ 类成员符号；覆盖检查会验证该符号真实存在。 */
  runtimeSymbol: string;
  /** 命令所属安全能力版本；v2 命令要求 Runtime 150。 */
  capability: 'edgeview.safe-api.v1' | 'edgeview.safe-api.v2';
  minimumRuntimeMajor: number;
  testId: string;
}

type Parameter = ModuleCommandBindingParameter;

function api(
  family: EdgeViewApiFamily,
  name: string,
  parameters: Parameter[],
  returnType: ModuleBindingValueType,
  description: string,
  sdkMembers: string[],
  options: { insertText?: string; runtimeName?: string; visibility?: 'default' | 'advanced'; capability?: 'edgeview.safe-api.v1' | 'edgeview.safe-api.v2'; minimumRuntimeMajor?: number; testId?: string } = {}
): EdgeViewApiCatalogEntry {
  const runtimeName = options.runtimeName || name;
  const normalizedParameters = parameters.map(parameter => normalizeControlReferenceParameter(parameter, { controlTypes: ['EdgeBrowser'] }));
  const argumentsText = normalizedParameters.map(createModuleBindingSnippetArgument).join(', ');
  const returnName = returnType === 'void' ? '空' : returnType === 'wideString' ? '文本型'
    : returnType === 'longLong' || returnType === 'handle' ? '长整数型'
      : returnType === 'double' ? '双精度小数型' : '整数型';
  return {
    family,
    command: {
      name,
      signature: `${name}(${normalizedParameters.map(parameter => parameter.name).join(', ')})`,
      description,
      insertText: normalizeControlReferenceCallSnippet(options.insertText, normalizedParameters) || `${name}(${argumentsText})`,
      returnType: returnName,
      visibility: options.visibility
    },
    binding: {
      command: name,
      runtimeName,
      parameters: normalizedParameters,
      returnType,
      encoding: normalizedParameters.some(parameter => isWideStringAbiBindingType(parameter.type)) || returnType === 'wideString' ? 'wide' : undefined
    },
    sdkMembers,
    runtimeSymbol: runtimeName,
    capability: options.capability || EDGEVIEW_SAFE_API_CAPABILITY,
    minimumRuntimeMajor: options.minimumRuntimeMajor || EDGEVIEW_MINIMUM_RUNTIME_MAJOR,
    testId: options.testId || `edgeview.command.${name}`
  };
}

const control: ModuleCommandBindingParameter = { name: '控件名', type: 'controlRef', controlTypes: ['EdgeBrowser'] };
const task = { name: '任务ID', type: 'longLong' as const };

export const EDGEVIEW_SAFE_API_CATALOG: EdgeViewApiCatalogEntry[] = [
  api('任务', 'EdgeView任务_取当前任务ID', [], 'longLong', '取得当前 EdgeView 完成处理器正在消费的任务 ID。', [], { visibility: 'advanced' }),
  api('任务', 'EdgeView任务_取状态', [task], 'int', '取得任务状态：0等待、1成功、2失败、3已取消、4已超时。', [], { visibility: 'advanced' }),
  api('任务', 'EdgeView任务_取结果', [task], 'wideString', '取得任务 UTF-16 文本或 JSON 结果。', [], { visibility: 'advanced' }),
  api('任务', 'EdgeView任务_取错误', [task], 'wideString', '取得任务的中文错误信息和 HRESULT。', [], { visibility: 'advanced' }),
  api('任务', 'EdgeView任务_取消', [task], 'int', '取消尚未完成的任务；迟到回调将被代际检查拒绝。', [], { visibility: 'advanced' }),
  api('任务', 'EdgeView任务_释放', [task], 'int', '释放任务及结果；运行中的任务会先取消。', [], { visibility: 'advanced' }),

  api('导航', 'EdgeView导航_HTML', [control, { name: 'HTML', type: 'wideString' }], 'int', '让指定控件导航到内存 HTML。', ['ICoreWebView2.NavigateToString']),
  api('导航', 'EdgeView导航_请求', [control, { name: '地址', type: 'wideString' }, { name: '方法', type: 'wideString' }, { name: '请求头', type: 'wideString' }, { name: '正文', type: 'wideString' }], 'int', '使用文本请求头和 UTF-8 正文导航，不暴露 IStream。', ['ICoreWebView2_2.Environment', 'ICoreWebView2_2.NavigateWithWebResourceRequest', 'ICoreWebView2Environment2.CreateWebResourceRequest'], { visibility: 'advanced' }),
  api('导航', 'EdgeView导航_停止', [control], 'int', '停止指定控件当前导航。', ['ICoreWebView2.Stop']),
  api('导航', 'EdgeView导航_取地址', [control], 'wideString', '取得当前页面地址。', ['ICoreWebView2.Source']),
  api('导航', 'EdgeView导航_取标题', [control], 'wideString', '取得当前文档标题。', ['ICoreWebView2.DocumentTitle']),
  api('导航', 'EdgeView导航_取状态JSON', [control], 'wideString', '取得后退、前进、挂起、主 Frame、进程、用户数据和故障报告目录状态 JSON。', ['ICoreWebView2.CanGoBack', 'ICoreWebView2.CanGoForward', 'ICoreWebView2.BrowserProcessId', 'ICoreWebView2_3.IsSuspended', 'ICoreWebView2_20.FrameId', 'ICoreWebView2Environment7.UserDataFolder', 'ICoreWebView2Environment11.FailureReportFolderPath']),
  api('导航', 'EdgeView导航_取进程信息异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '异步取得进程 ID、类型和关联 Frame 数量 JSON；旧 Runtime 使用基础进程集合。', ['ICoreWebView2Environment8.GetProcessInfos', 'ICoreWebView2Environment13.GetProcessExtendedInfos', 'ICoreWebView2ProcessExtendedInfo.ProcessInfo', 'ICoreWebView2ProcessExtendedInfo.AssociatedFrameInfos'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('导航', 'EdgeView导航_挂起异步', [control, { name: '完成处理器', type: 'handler', description: '必须使用 &处理器名' }], 'longLong', '异步挂起 WebView，返回任务 ID。', ['ICoreWebView2_3.TrySuspend']),
  api('导航', 'EdgeView导航_恢复', [control], 'int', '恢复已挂起的 WebView。', ['ICoreWebView2_3.Resume']),
  api('导航', 'EdgeView导航_设置虚拟主机', [control, { name: '主机名', type: 'wideString' }, { name: '目录', type: 'wideString' }, { name: '访问模式', type: 'int' }], 'int', '把虚拟主机映射到明确目录。', ['ICoreWebView2_3.SetVirtualHostNameToFolderMapping'], { visibility: 'advanced' }),
  api('导航', 'EdgeView导航_清除虚拟主机', [control, { name: '主机名', type: 'wideString' }], 'int', '清除指定虚拟主机映射。', ['ICoreWebView2_3.ClearVirtualHostNameToFolderMapping'], { visibility: 'advanced' }),

  api('脚本', 'EdgeView脚本_文档预注入异步', [control, { name: '脚本', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '注册文档创建前执行脚本，任务结果为脚本 ID。', ['ICoreWebView2.AddScriptToExecuteOnDocumentCreated']),
  api('脚本', 'EdgeView脚本_移除文档预注入', [control, { name: '脚本ID', type: 'wideString' }], 'int', '移除文档预注入脚本。', ['ICoreWebView2.RemoveScriptToExecuteOnDocumentCreated']),
  api('脚本', 'EdgeView脚本_执行异步', [control, { name: '脚本', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步执行 JavaScript，任务结果为 JSON。', ['ICoreWebView2.ExecuteScript']),
  api('脚本', 'EdgeView脚本_执行详情异步', [control, { name: '脚本', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步执行 JavaScript，返回成功、JSON、字符串结果和异常详情。', [
    'ICoreWebView2_21.ExecuteScriptWithResult', 'ICoreWebView2ExecuteScriptResult.Succeeded', 'ICoreWebView2ExecuteScriptResult.ResultAsJson',
    'ICoreWebView2ExecuteScriptResult.TryGetResultAsString', 'ICoreWebView2ExecuteScriptResult.Exception',
    'ICoreWebView2ScriptException.ColumnNumber', 'ICoreWebView2ScriptException.LineNumber', 'ICoreWebView2ScriptException.Message',
    'ICoreWebView2ScriptException.Name', 'ICoreWebView2ScriptException.ToJson'
  ], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('脚本', 'EdgeView脚本_发送字符串消息', [control, { name: '消息', type: 'wideString' }], 'int', '向网页发送字符串消息。', ['ICoreWebView2.PostWebMessageAsString']),
  api('脚本', 'EdgeView脚本_发送JSON消息', [control, { name: 'JSON', type: 'wideString' }], 'int', '向网页发送 JSON 消息。', ['ICoreWebView2.PostWebMessageAsJson']),

  ...[
    ['脚本执行', 'IsScriptEnabled', 1], ['网页消息', 'IsWebMessageEnabled', 1], ['脚本对话框', 'AreDefaultScriptDialogsEnabled', 1],
    ['状态栏', 'IsStatusBarEnabled', 1], ['开发者工具', 'AreDevToolsEnabled', 1], ['右键菜单', 'AreDefaultContextMenusEnabled', 1],
    ['缩放控制', 'IsZoomControlEnabled', 1], ['内置错误页', 'IsBuiltInErrorPageEnabled', 1], ['快捷键', 'AreBrowserAcceleratorKeysEnabled', 3],
    ['密码自动保存', 'IsPasswordAutosaveEnabled', 4], ['通用自动填充', 'IsGeneralAutofillEnabled', 4], ['捏合缩放', 'IsPinchZoomEnabled', 5],
    ['滑动导航', 'IsSwipeNavigationEnabled', 6]
  ].flatMap(([label, member, version]) => {
    const owner = Number(version) === 1 ? 'ICoreWebView2Settings' : `ICoreWebView2Settings${version}`;
    return [
    api('设置', `EdgeView设置_置${label}`, [control, { name: '启用', type: 'bool' }], 'int', `设置 ${label}。`, [`${owner}.${member}`]),
    api('设置', `EdgeView设置_取${label}`, [control], 'int', `取得 ${label} 状态。`, [`${owner}.${member}`])
  ]; }),
  api('设置', 'EdgeView设置_置用户代理', [control, { name: '用户代理', type: 'wideString' }], 'int', '设置控件 User-Agent。', ['ICoreWebView2Settings2.UserAgent']),
  api('设置', 'EdgeView设置_取用户代理', [control], 'wideString', '取得控件 User-Agent。', ['ICoreWebView2Settings2.UserAgent']),
  api('设置', 'EdgeView设置_置缩放', [control, { name: '缩放倍数', type: 'double' }], 'int', '设置控制器缩放倍数。', ['ICoreWebView2Controller.ZoomFactor']),
  api('设置', 'EdgeView设置_取缩放', [control], 'double', '取得控制器缩放倍数。', ['ICoreWebView2Controller.ZoomFactor']),
  api('设置', 'EdgeView设置_置静音', [control, { name: '静音', type: 'bool' }], 'int', '设置网页静音状态。', ['ICoreWebView2_8.IsMuted']),
  api('设置', 'EdgeView设置_取静音', [control], 'int', '取得网页静音状态。', ['ICoreWebView2_8.IsMuted']),
  api('设置', 'EdgeView设置_置背景色', [control, { name: 'ARGB', type: 'int' }], 'int', '设置控制器默认背景色。', ['ICoreWebView2Controller2.DefaultBackgroundColor']),
  api('设置', 'EdgeView设置_置可见', [control, { name: '可见', type: 'bool' }], 'int', '设置控制器可见性。', ['ICoreWebView2Controller.IsVisible']),
  api('设置', 'EdgeView设置_取可见', [control], 'int', '取得控制器可见性。', ['ICoreWebView2Controller.IsVisible']),
  api('设置', 'EdgeView设置_置边界', [control, { name: '左', type: 'int' }, { name: '顶', type: 'int' }, { name: '宽', type: 'int' }, { name: '高', type: 'int' }], 'int', '设置控制器边界。', ['ICoreWebView2Controller.Bounds', 'ICoreWebView2Controller.SetBoundsAndZoomFactor']),
  api('设置', 'EdgeView设置_取边界JSON', [control], 'wideString', '取得控制器边界 JSON。', ['ICoreWebView2Controller.Bounds']),
  api('设置', 'EdgeView设置_移动焦点', [control, { name: '原因', type: 'int' }], 'int', '按 WebView2 原因枚举移动焦点。', ['ICoreWebView2Controller.MoveFocus']),
  api('设置', 'EdgeView设置_置光栅化缩放', [control, { name: '缩放', type: 'double' }], 'int', '设置控制器光栅化缩放。', ['ICoreWebView2Controller3.RasterizationScale']),
  api('设置', 'EdgeView设置_取光栅化缩放', [control], 'double', '取得控制器光栅化缩放。', ['ICoreWebView2Controller3.RasterizationScale']),
  api('设置', 'EdgeView设置_置自动检测显示器缩放', [control, { name: '启用', type: 'bool' }], 'int', '设置是否自动检测显示器缩放。', ['ICoreWebView2Controller3.ShouldDetectMonitorScaleChanges']),
  api('设置', 'EdgeView设置_取自动检测显示器缩放', [control], 'int', '取得自动检测显示器缩放状态。', ['ICoreWebView2Controller3.ShouldDetectMonitorScaleChanges']),
  api('设置', 'EdgeView设置_置边界模式', [control, { name: '模式', type: 'int' }], 'int', '设置控制器边界模式。', ['ICoreWebView2Controller3.BoundsMode']),
  api('设置', 'EdgeView设置_取边界模式', [control], 'int', '取得控制器边界模式。', ['ICoreWebView2Controller3.BoundsMode']),
  api('设置', 'EdgeView设置_置允许外部拖放', [control, { name: '启用', type: 'bool' }], 'int', '设置是否允许外部拖放。', ['ICoreWebView2Controller4.AllowExternalDrop']),
  api('设置', 'EdgeView设置_取允许外部拖放', [control], 'int', '取得是否允许外部拖放。', ['ICoreWebView2Controller4.AllowExternalDrop']),
  api('设置', 'EdgeView设置_置PDF工具栏隐藏项', [control, { name: '掩码', type: 'int' }], 'int', '设置 PDF 工具栏隐藏项掩码。', ['ICoreWebView2Settings7.HiddenPdfToolbarItems']),
  api('设置', 'EdgeView设置_取PDF工具栏隐藏项', [control], 'int', '取得 PDF 工具栏隐藏项掩码。', ['ICoreWebView2Settings7.HiddenPdfToolbarItems']),
  api('设置', 'EdgeView设置_置信誉检查', [control, { name: '启用', type: 'bool' }], 'int', '设置是否要求 SmartScreen 信誉检查。', ['ICoreWebView2Settings8.IsReputationCheckingRequired']),
  api('设置', 'EdgeView设置_取信誉检查', [control], 'int', '取得信誉检查状态。', ['ICoreWebView2Settings8.IsReputationCheckingRequired']),
  api('设置', 'EdgeView设置_置内存目标级别', [control, { name: '级别', type: 'int' }], 'int', '设置 WebView 内存使用目标级别。', ['ICoreWebView2_19.MemoryUsageTargetLevel']),
  api('设置', 'EdgeView设置_取内存目标级别', [control], 'int', '取得 WebView 内存使用目标级别。', ['ICoreWebView2_19.MemoryUsageTargetLevel']),

  api('设置', 'EdgeView创建选项_置独占用户目录', [control, { name: '启用', type: 'bool' }], 'int', '设置创建期独占 UDF；修改后必须重建控件。', ['ICoreWebView2EnvironmentOptions2.ExclusiveUserDataFolderAccess'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取独占用户目录', [control], 'int', '取得创建期独占 UDF 设置。', ['ICoreWebView2EnvironmentOptions2.ExclusiveUserDataFolderAccess'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置自定义崩溃报告', [control, { name: '启用', type: 'bool' }], 'int', '设置创建期自定义崩溃报告开关。', ['ICoreWebView2EnvironmentOptions3.IsCustomCrashReportingEnabled'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取自定义崩溃报告', [control], 'int', '取得创建期自定义崩溃报告开关。', ['ICoreWebView2EnvironmentOptions3.IsCustomCrashReportingEnabled'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置跟踪保护', [control, { name: '启用', type: 'bool' }], 'int', '设置创建期跟踪保护开关。', ['ICoreWebView2EnvironmentOptions5.EnableTrackingPrevention'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取跟踪保护', [control], 'int', '取得创建期跟踪保护开关。', ['ICoreWebView2EnvironmentOptions5.EnableTrackingPrevention'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置浏览器扩展', [control, { name: '启用', type: 'bool' }], 'int', '设置创建期浏览器扩展开关。', ['ICoreWebView2EnvironmentOptions6.AreBrowserExtensionsEnabled'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取浏览器扩展', [control], 'int', '取得创建期浏览器扩展开关。', ['ICoreWebView2EnvironmentOptions6.AreBrowserExtensionsEnabled'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置通道搜索方式', [control, { name: '方式', type: 'int' }], 'int', '设置创建期 Runtime 通道搜索方式。', ['ICoreWebView2EnvironmentOptions7.ChannelSearchKind'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取通道搜索方式', [control], 'int', '取得创建期 Runtime 通道搜索方式。', ['ICoreWebView2EnvironmentOptions7.ChannelSearchKind'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置发布通道', [control, { name: '通道掩码', type: 'int' }], 'int', '设置创建期允许的 Runtime 发布通道掩码。', ['ICoreWebView2EnvironmentOptions7.ReleaseChannels'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取发布通道', [control], 'int', '取得创建期 Runtime 发布通道掩码。', ['ICoreWebView2EnvironmentOptions7.ReleaseChannels'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置滚动条样式', [control, { name: '样式', type: 'int' }], 'int', '设置创建期滚动条样式。', ['ICoreWebView2EnvironmentOptions8.ScrollBarStyle'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取滚动条样式', [control], 'int', '取得创建期滚动条样式。', ['ICoreWebView2EnvironmentOptions8.ScrollBarStyle'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置脚本区域', [control, { name: '区域', type: 'wideString' }], 'int', '设置创建期脚本区域；修改后必须重建。', ['ICoreWebView2ControllerOptions2.ScriptLocale'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取脚本区域', [control], 'wideString', '取得创建期脚本区域。', ['ICoreWebView2ControllerOptions2.ScriptLocale'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置默认背景色', [control, { name: 'ARGB', type: 'int' }], 'int', '设置控制器创建期默认背景色。', ['ICoreWebView2ControllerOptions3.DefaultBackgroundColor'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取默认背景色', [control], 'int', '取得控制器创建期默认背景色。', ['ICoreWebView2ControllerOptions3.DefaultBackgroundColor'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_置宿主输入处理', [control, { name: '启用', type: 'bool' }], 'int', '设置控制器创建期宿主输入处理开关。', ['ICoreWebView2ControllerOptions4.AllowHostInputProcessing'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_取宿主输入处理', [control], 'int', '取得控制器创建期宿主输入处理开关。', ['ICoreWebView2ControllerOptions4.AllowHostInputProcessing'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_添加自定义协议', [control, { name: '协议名', type: 'wideString' }, { name: '含权限部分', type: 'bool' }, { name: '视为安全', type: 'bool' }, { name: '允许来源', type: 'wideString' }], 'int', '添加安全的自定义协议注册；允许来源以分号分隔，修改后必须重建。', ['ICoreWebView2EnvironmentOptions4.GetCustomSchemeRegistrations', 'ICoreWebView2EnvironmentOptions4.SetCustomSchemeRegistrations', 'ICoreWebView2CustomSchemeRegistration.SchemeName', 'ICoreWebView2CustomSchemeRegistration.HasAuthorityComponent', 'ICoreWebView2CustomSchemeRegistration.TreatAsSecure', 'ICoreWebView2CustomSchemeRegistration.AllowedOrigins'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_清除自定义协议', [control], 'int', '清除当前控件的创建期自定义协议注册。', ['ICoreWebView2EnvironmentOptions4.GetCustomSchemeRegistrations', 'ICoreWebView2EnvironmentOptions4.SetCustomSchemeRegistrations'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('设置', 'EdgeView创建选项_重建控件', [control], 'int', '应用创建期选项并显式重建指定 Edge 控件。', [], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('会话', 'EdgeView会话_取ProfileJSON', [control], 'wideString', '取得 Profile 名称、路径、隐私模式和下载目录 JSON。', ['ICoreWebView2_13.Profile']),
  api('会话', 'EdgeView会话_取Cookie异步', [control, { name: '地址', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步取得 Cookie 列表 JSON。', ['ICoreWebView2CookieManager.GetCookies']),
  api('会话', 'EdgeView会话_置Cookie', [control, { name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' }, { name: '域', type: 'wideString' }, { name: '路径', type: 'wideString' }], 'int', '创建或更新 Cookie。', ['ICoreWebView2CookieManager.CreateCookie', 'ICoreWebView2CookieManager.AddOrUpdateCookie']),
  api('会话', 'EdgeView会话_删除Cookie', [control, { name: '名称', type: 'wideString' }, { name: '域', type: 'wideString' }, { name: '路径', type: 'wideString' }], 'int', '按名称、域和路径删除 Cookie。', ['ICoreWebView2CookieManager.DeleteCookiesWithDomainAndPath']),
  api('会话', 'EdgeView会话_删除全部Cookie', [control], 'int', '删除当前 Profile 全部 Cookie。', ['ICoreWebView2CookieManager.DeleteAllCookies']),
  api('会话', 'EdgeView会话_清理浏览数据异步', [control, { name: '数据类型掩码', type: 'longLong' }, { name: '完成处理器', type: 'handler' }], 'longLong', '按 WebView2 数据类型掩码清理浏览数据。', ['ICoreWebView2Profile2.ClearBrowsingData']),
  api('会话', 'EdgeView会话_清理全部浏览数据异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '清理当前 Profile 全部浏览数据。', ['ICoreWebView2Profile2.ClearBrowsingDataAll']),
  api('会话', 'EdgeView会话_按时间清理浏览数据异步', [control, { name: '数据类型掩码', type: 'longLong' }, { name: '开始时间', type: 'double' }, { name: '结束时间', type: 'double' }, { name: '完成处理器', type: 'handler' }], 'longLong', '按 Unix 秒时间范围清理浏览数据。', ['ICoreWebView2Profile2.ClearBrowsingDataInTimeRange']),
  api('会话', 'EdgeView会话_置下载目录', [control, { name: '目录', type: 'wideString' }], 'int', '设置 Profile 默认下载目录。', ['ICoreWebView2Profile.DefaultDownloadFolderPath']),
  api('会话', 'EdgeView会话_取下载目录', [control], 'wideString', '取得 Profile 默认下载目录。', ['ICoreWebView2Profile.DefaultDownloadFolderPath']),
  api('会话', 'EdgeView会话_置配色方案', [control, { name: '方案', type: 'int' }], 'int', '设置 Profile 首选配色方案。', ['ICoreWebView2Profile.PreferredColorScheme']),
  api('会话', 'EdgeView会话_取配色方案', [control], 'int', '取得 Profile 首选配色方案。', ['ICoreWebView2Profile.PreferredColorScheme']),
  api('会话', 'EdgeView会话_置跟踪保护', [control, { name: '级别', type: 'int' }], 'int', '设置 Profile 跟踪保护级别。', ['ICoreWebView2Profile3.PreferredTrackingPreventionLevel']),
  api('会话', 'EdgeView会话_取跟踪保护', [control], 'int', '取得 Profile 跟踪保护级别。', ['ICoreWebView2Profile3.PreferredTrackingPreventionLevel']),
  api('会话', 'EdgeView会话_置密码保存', [control, { name: '启用', type: 'bool' }], 'int', '设置 Profile 密码自动保存。', ['ICoreWebView2Profile6.IsPasswordAutosaveEnabled']),
  api('会话', 'EdgeView会话_取密码保存', [control], 'int', '取得 Profile 密码自动保存状态。', ['ICoreWebView2Profile6.IsPasswordAutosaveEnabled']),
  api('会话', 'EdgeView会话_置自动填充', [control, { name: '启用', type: 'bool' }], 'int', '设置 Profile 通用自动填充。', ['ICoreWebView2Profile6.IsGeneralAutofillEnabled']),
  api('会话', 'EdgeView会话_取自动填充', [control], 'int', '取得 Profile 通用自动填充状态。', ['ICoreWebView2Profile6.IsGeneralAutofillEnabled']),
  api('会话', 'EdgeView会话_删除Profile', [control], 'int', '删除当前 Profile；删除完成事件通过事件目录通知。', ['ICoreWebView2Profile8.Delete']),

  api('下载', 'EdgeView下载_取状态JSON', [control, { name: '下载ID', type: 'longLong' }], 'wideString', '取得受管下载状态、地址、MIME、进度、可恢复性、中断原因、本次请求的 pendingResultFilePath 与 put_ResultFilePath 的 resultFilePathError JSON。在「下载开始」处理器内读到的 path 是决策前的默认落点快照，要确认改路径是否生效必须在事件结束后再读。', [
    'ICoreWebView2DownloadOperation.State', 'ICoreWebView2DownloadOperation.BytesReceived', 'ICoreWebView2DownloadOperation.TotalBytesToReceive',
    'ICoreWebView2DownloadOperation.ResultFilePath', 'ICoreWebView2DownloadOperation.CanResume', 'ICoreWebView2DownloadOperation.ContentDisposition',
    'ICoreWebView2DownloadOperation.EstimatedEndTime', 'ICoreWebView2DownloadOperation.InterruptReason', 'ICoreWebView2DownloadOperation.MimeType',
    'ICoreWebView2DownloadOperation.Uri'
  ]),
  api('下载', 'EdgeView下载_暂停', [control, { name: '下载ID', type: 'longLong' }], 'int', '暂停受管下载。', ['ICoreWebView2DownloadOperation.Pause']),
  api('下载', 'EdgeView下载_恢复', [control, { name: '下载ID', type: 'longLong' }], 'int', '恢复受管下载。', ['ICoreWebView2DownloadOperation.Resume']),
  api('下载', 'EdgeView下载_取消', [control, { name: '下载ID', type: 'longLong' }], 'int', '取消受管下载。', ['ICoreWebView2DownloadOperation.Cancel']),
  api('下载', 'EdgeView下载_显示默认窗口', [control], 'int', '打开默认下载窗口。', ['ICoreWebView2_9.OpenDefaultDownloadDialog']),
  api('下载', 'EdgeView下载_关闭默认窗口', [control], 'int', '关闭默认下载窗口。', ['ICoreWebView2_9.CloseDefaultDownloadDialog']),
  api('下载', 'EdgeView下载_置窗口角对齐', [control, { name: '对齐', type: 'int' }], 'int', '设置默认下载窗口角对齐。', ['ICoreWebView2_9.DefaultDownloadDialogCornerAlignment']),
  api('下载', 'EdgeView下载_取窗口角对齐', [control], 'int', '取得默认下载窗口角对齐。', ['ICoreWebView2_9.DefaultDownloadDialogCornerAlignment']),
  api('下载', 'EdgeView下载_置窗口边距', [control, { name: '横向', type: 'int' }, { name: '纵向', type: 'int' }], 'int', '设置默认下载窗口边距。', ['ICoreWebView2_9.DefaultDownloadDialogMargin']),
  api('下载', 'EdgeView下载_取窗口边距JSON', [control], 'wideString', '取得默认下载窗口边距 JSON。', ['ICoreWebView2_9.DefaultDownloadDialogMargin']),

  api('查找', 'EdgeView查找_开始异步', [control, { name: '文本', type: 'wideString' }, { name: '选项JSON', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '开始页内查找，结果为匹配状态 JSON。', ['ICoreWebView2_28.Find']),
  api('查找', 'EdgeView查找_下一项', [control], 'int', '移动到下一匹配项。', ['ICoreWebView2Find.Start']),
  api('查找', 'EdgeView查找_上一项', [control], 'int', '移动到上一匹配项。', ['ICoreWebView2Find.Start']),
  api('查找', 'EdgeView查找_停止', [control], 'int', '停止页内查找并清除高亮。', ['ICoreWebView2Find.Stop']),
  api('查找', 'EdgeView查找_取状态JSON', [control], 'wideString', '取得匹配数量和当前索引 JSON。', ['ICoreWebView2Find.MatchCount', 'ICoreWebView2Find.ActiveMatchIndex']),

  ...[
    ['方向', 'Orientation'], ['每面页数', 'PagesPerSide'], ['份数', 'Copies'], ['逐份打印', 'Collation'],
    ['颜色模式', 'ColorMode'], ['双面模式', 'Duplex'], ['纸张类型', 'MediaSize']
  ].flatMap(([label, member]) => {
    const owner = ['Orientation'].includes(String(member)) ? 'ICoreWebView2PrintSettings' : 'ICoreWebView2PrintSettings2';
    return [
      api('打印', `EdgeView打印_置${label}`, [control, { name: '值', type: 'int' }], 'int', `设置打印${label}。`, [`${owner}.${member}`]),
      api('打印', `EdgeView打印_取${label}`, [control], 'int', `取得打印${label}。`, [`${owner}.${member}`])
    ];
  }),
  ...[
    ['缩放倍数', 'ScaleFactor'], ['纸张宽度', 'PageWidth'], ['纸张高度', 'PageHeight'], ['上边距', 'MarginTop'],
    ['下边距', 'MarginBottom'], ['左边距', 'MarginLeft'], ['右边距', 'MarginRight']
  ].flatMap(([label, member]) => [
    api('打印', `EdgeView打印_置${label}`, [control, { name: '值', type: 'double' }], 'int', `设置打印${label}。`, [`ICoreWebView2PrintSettings.${member}`]),
    api('打印', `EdgeView打印_取${label}`, [control], 'double', `取得打印${label}。`, [`ICoreWebView2PrintSettings.${member}`])
  ]),
  ...[
    ['打印背景', 'ShouldPrintBackgrounds'], ['仅打印选区', 'ShouldPrintSelectionOnly'], ['打印页眉页脚', 'ShouldPrintHeaderAndFooter']
  ].flatMap(([label, member]) => [
    api('打印', `EdgeView打印_置${label}`, [control, { name: '启用', type: 'bool' }], 'int', `设置是否${label}。`, [`ICoreWebView2PrintSettings.${member}`]),
    api('打印', `EdgeView打印_取${label}`, [control], 'int', `取得是否${label}。`, [`ICoreWebView2PrintSettings.${member}`])
  ]),
  ...[
    ['页眉标题', 'HeaderTitle', 'ICoreWebView2PrintSettings'], ['页脚地址', 'FooterUri', 'ICoreWebView2PrintSettings'],
    ['页面范围', 'PageRanges', 'ICoreWebView2PrintSettings2'], ['打印机名称', 'PrinterName', 'ICoreWebView2PrintSettings2']
  ].flatMap(([label, member, owner]) => [
    api('打印', `EdgeView打印_置${label}`, [control, { name: '文本', type: 'wideString' }], 'int', `设置打印${label}。`, [`${owner}.${member}`]),
    api('打印', `EdgeView打印_取${label}`, [control], 'wideString', `取得打印${label}。`, [`${owner}.${member}`])
  ]),
  api('打印', 'EdgeView打印_显示界面', [control, { name: '界面类型', type: 'int' }], 'int', '显示系统或浏览器打印界面。', ['ICoreWebView2_16.ShowPrintUI']),
  api('打印', 'EdgeView打印_PDF异步', [control, { name: '文件路径', type: 'wideString' }, { name: '设置JSON', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '把当前页面导出为 PDF 文件；相对路径先按当前工作目录解析成绝对路径再交给 WebView2，设置JSON 用 WebView2 驼峰键名覆盖本控件的打印设置，空对象表示不改设置。', ['ICoreWebView2_7.PrintToPdf']),
  api('打印', 'EdgeView打印_PDF流到文件异步', [control, { name: '文件路径', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '使用 PrintToPdfStream 后把二进制结果写入明确文件路径。', ['ICoreWebView2_16.PrintToPdfStream'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('打印', 'EdgeView打印_打印异步', [control, { name: '设置JSON', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步打印当前页面；设置JSON 用 WebView2 驼峰键名覆盖本控件的打印设置，空对象表示不改设置。', ['ICoreWebView2_16.Print']),

  api('媒体', 'EdgeView媒体_截图异步', [control, { name: '文件路径', type: 'wideString' }, { name: '格式', type: 'int' }, { name: '完成处理器', type: 'handler' }], 'longLong', '把页面截图写入文件路径（相对路径按当前工作目录解析），任务结果返回落盘后的绝对路径，不暴露 IStream。', ['ICoreWebView2.CapturePreview']),
  api('媒体', 'EdgeView媒体_取Favicon异步', [control, { name: '文件路径', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '把页面 Favicon 写入文件路径（相对路径按当前工作目录解析），任务结果返回落盘后的绝对路径。', ['ICoreWebView2_15.GetFavicon']),
  api('媒体', 'EdgeView媒体_取全屏状态', [control], 'int', '取得页面是否含全屏元素。', ['ICoreWebView2.ContainsFullScreenElement']),
  api('媒体', 'EdgeView媒体_取音频状态', [control], 'int', '取得页面是否正在播放音频。', ['ICoreWebView2_8.IsDocumentPlayingAudio']),

  api('开发者工具', 'EdgeView开发者工具_打开', [control], 'int', '打开开发者工具窗口。', ['ICoreWebView2.OpenDevToolsWindow']),
  api('开发者工具', 'EdgeView开发者工具_打开任务管理器', [control], 'int', '打开 WebView2 任务管理器。', ['ICoreWebView2_6.OpenTaskManagerWindow']),
  api('开发者工具', 'EdgeView开发者工具_调用异步', [control, { name: '方法', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '调用 DevTools Protocol 方法，结果为 JSON。', ['ICoreWebView2.CallDevToolsProtocolMethod']),
  api('开发者工具', 'EdgeView开发者工具_调用会话异步', [control, { name: '会话ID', type: 'wideString' }, { name: '方法', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '在指定 DevTools 会话调用协议方法。', ['ICoreWebView2_11.CallDevToolsProtocolMethodForSession']),

  api('资源', 'EdgeView资源_添加过滤器', [control, { name: 'URI模式', type: 'wideString' }, { name: '上下文', type: 'int' }, { name: '来源类型', type: 'int' }], 'int', '添加带请求来源类型的资源过滤器。', ['ICoreWebView2_22.AddWebResourceRequestedFilterWithRequestSourceKinds']),
  api('资源', 'EdgeView资源_移除过滤器', [control, { name: 'URI模式', type: 'wideString' }, { name: '上下文', type: 'int' }], 'int', '移除资源过滤器。', ['ICoreWebView2.RemoveWebResourceRequestedFilter']),
  api('资源', 'EdgeView资源_移除来源过滤器', [control, { name: 'URI模式', type: 'wideString' }, { name: '上下文', type: 'int' }, { name: '来源类型', type: 'int' }], 'int', '移除带请求来源类型的资源过滤器。', ['ICoreWebView2_22.RemoveWebResourceRequestedFilterWithRequestSourceKinds'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('资源', 'EdgeView资源_设置事件响应文本', [control, { name: '状态码', type: 'int' }, { name: '原因', type: 'wideString' }, { name: '响应头', type: 'wideString' }, { name: '正文', type: 'wideString' }], 'int', '在 Web资源请求同步事件中以限长 UTF-8 正文替换响应。', ['ICoreWebView2Environment.CreateWebResourceResponse', 'ICoreWebView2WebResourceRequestedEventArgs.Response'], { visibility: 'advanced' }),
  api('资源', 'EdgeView资源_读响应正文异步', [control, { name: '响应句柄', type: 'handle' }, { name: '最大字节数', type: 'longLong' }, { name: '完成处理器', type: 'handler' }], 'longLong', '把响应流限长读取为十六进制 JSON，不暴露 IStream；必须在 Web资源响应收到 处理器执行期间交给本命令，处理器返回后 WebView2 会释放该响应的正文，稍后读取一律失败。', ['ICoreWebView2WebResourceResponseView.GetContent'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' }),

  api('事件', 'EdgeView事件_取字段', [control, { name: '字段名', type: 'wideString' }], 'wideString', '取得当前同步事件字段；右键菜单目标等复合参数会预先转换为字段。', [
    'ICoreWebView2ContextMenuTarget.Kind', 'ICoreWebView2ContextMenuTarget.PageUri', 'ICoreWebView2ContextMenuTarget.FrameUri',
    'ICoreWebView2ContextMenuTarget.HasLinkUri', 'ICoreWebView2ContextMenuTarget.LinkUri', 'ICoreWebView2ContextMenuTarget.HasLinkText',
    'ICoreWebView2ContextMenuTarget.LinkText', 'ICoreWebView2ContextMenuTarget.HasSourceUri', 'ICoreWebView2ContextMenuTarget.SourceUri',
    'ICoreWebView2ContextMenuTarget.HasSelection', 'ICoreWebView2ContextMenuTarget.SelectionText', 'ICoreWebView2ContextMenuTarget.IsEditable',
    'ICoreWebView2ContextMenuTarget.IsRequestedForMainFrame',
    'ICoreWebView2WindowFeatures.HasPosition', 'ICoreWebView2WindowFeatures.HasSize', 'ICoreWebView2WindowFeatures.Height',
    'ICoreWebView2WindowFeatures.Left', 'ICoreWebView2WindowFeatures.Top', 'ICoreWebView2WindowFeatures.Width',
    'ICoreWebView2WindowFeatures.ShouldDisplayMenuBar', 'ICoreWebView2WindowFeatures.ShouldDisplayScrollBars',
    'ICoreWebView2WindowFeatures.ShouldDisplayStatus', 'ICoreWebView2WindowFeatures.ShouldDisplayToolbar',
    'ICoreWebView2ProcessFailedEventArgs2.ExitCode', 'ICoreWebView2ProcessFailedEventArgs2.ProcessDescription',
    'ICoreWebView2ProcessFailedEventArgs2.Reason', 'ICoreWebView2ProcessFailedEventArgs3.FailureSourceModulePath',
    'ICoreWebView2NavigationCompletedEventArgs2.HttpStatusCode', 'ICoreWebView2NavigationStartingEventArgs3.NavigationKind',
    'ICoreWebView2WebResourceRequestedEventArgs2.RequestedSourceKind', 'ICoreWebView2DevToolsProtocolEventReceivedEventArgs2.SessionId'
  ], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_设置动作', [control, { name: '动作', type: 'int' }], 'int', '设置当前同步事件动作；未设置时保持 WebView2 默认行为。', [], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_设置返回文本', [control, { name: '文本', type: 'wideString' }], 'int', '设置脚本对话框、认证或下载等事件返回文本。', [], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_设置认证', [control, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }], 'int', '设置当前基本身份验证请求凭据。', [], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_设置下载路径', [control, { name: '文件路径', type: 'wideString' }], 'int', '设置当前下载开始事件的目标文件路径。只能在「下载开始」同步处理器执行期间调用；相对路径会按当前工作目录补全成绝对路径并自动创建父目录；实际落点必须在事件结束后用下载状态查询接口再读一次确认。', ['ICoreWebView2DownloadStartingEventArgs.put_ResultFilePath'], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_取菜单项JSON', [control, { name: '菜单项句柄', type: 'handle' }], 'wideString', '取得受管 WebView2 菜单项名称、标签、命令 ID、类型、状态、快捷键、图标存在性和子项句柄。', [
    'ICoreWebView2ContextMenuItem.Children', 'ICoreWebView2ContextMenuItem.CommandId', 'ICoreWebView2ContextMenuItem.Icon',
    'ICoreWebView2ContextMenuItem.IsChecked', 'ICoreWebView2ContextMenuItem.IsEnabled', 'ICoreWebView2ContextMenuItem.Kind',
    'ICoreWebView2ContextMenuItem.Label', 'ICoreWebView2ContextMenuItem.Name', 'ICoreWebView2ContextMenuItem.ShortcutKeyDescription'
  ], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_置菜单项勾选', [control, { name: '菜单项句柄', type: 'handle' }, { name: '勾选', type: 'bool' }], 'int', '设置受管菜单项勾选状态。', ['ICoreWebView2ContextMenuItem.IsChecked'], { visibility: 'advanced' }),
  api('事件', 'EdgeView事件_置菜单项启用', [control, { name: '菜单项句柄', type: 'handle' }, { name: '启用', type: 'bool' }], 'int', '设置受管菜单项启用状态。', ['ICoreWebView2ContextMenuItem.IsEnabled'], { visibility: 'advanced' }),

  api('对象', 'EdgeView对象_取状态JSON', [{ name: '对象句柄', type: 'handle' }], 'wideString', '取得受管对象类型、所属控件、generation、线程和生命周期状态。', [], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' }),
  api('对象', 'EdgeView对象_释放', [{ name: '对象句柄', type: 'handle' }], 'int', '显式释放受管对象；句柄不会被复用。', [], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' }),

  api('框架', 'EdgeView框架_枚举JSON', [control], 'wideString', '枚举当前控件已发现的 Frame 受管句柄和层级信息。', ['ICoreWebView2_4.FrameCreated'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('框架', 'EdgeView框架_取信息JSON', [control, { name: '框架句柄', type: 'handle' }], 'wideString', '取得 Frame ID、名称、来源和生命周期信息。', ['ICoreWebView2Frame.Name', 'ICoreWebView2Frame.IsDestroyed', 'ICoreWebView2Frame5.FrameId'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('框架', 'EdgeView框架_执行脚本异步', [control, { name: '框架句柄', type: 'handle' }, { name: '脚本', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '在受管 Frame 中异步执行 JavaScript。', ['ICoreWebView2Frame2.ExecuteScript'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('框架', 'EdgeView框架_发送字符串消息', [control, { name: '框架句柄', type: 'handle' }, { name: '消息', type: 'wideString' }], 'int', '向受管 Frame 发送字符串消息。', ['ICoreWebView2Frame2.PostWebMessageAsString'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('框架', 'EdgeView框架_发送JSON消息', [control, { name: '框架句柄', type: 'handle' }, { name: 'JSON', type: 'wideString' }], 'int', '向受管 Frame 发送 JSON 消息。', ['ICoreWebView2Frame2.PostWebMessageAsJson'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('框架', 'EdgeView框架_发送共享缓冲', [control, { name: '框架句柄', type: 'handle' }, { name: '缓冲句柄', type: 'handle' }, { name: '访问模式', type: 'int' }, { name: '附加JSON', type: 'wideString' }], 'int', '把受管共享缓冲发送到指定 Frame。', ['ICoreWebView2Frame4.PostSharedBufferToScript'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('工作线程', 'EdgeView工作线程_枚举异步', [control, { name: '类型', type: 'int' }, { name: '完成处理器', type: 'handler' }], 'longLong', '枚举 Shared Worker 或 Service Worker；结果为受管句柄 JSON。', ['ICoreWebView2Profile9.ServiceWorkerManager', 'ICoreWebView2Profile9.SharedWorkerManager', 'ICoreWebView2ServiceWorkerManager.GetServiceWorkerRegistrations', 'ICoreWebView2SharedWorkerManager.GetSharedWorkers'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('工作线程', 'EdgeView工作线程_取信息JSON', [control, { name: '工作线程句柄', type: 'handle' }], 'wideString', '取得 Dedicated、Shared 或 Service Worker 类型及 URI 信息。', ['ICoreWebView2DedicatedWorker.ScriptUri', 'ICoreWebView2SharedWorker.ScriptUri', 'ICoreWebView2ServiceWorker.ScriptUri'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('工作线程', 'EdgeView工作线程_发送字符串消息', [control, { name: '工作线程句柄', type: 'handle' }, { name: '消息', type: 'wideString' }], 'int', '向支持消息的 Dedicated 或 Service Worker 发送字符串消息。', ['ICoreWebView2DedicatedWorker.PostWebMessageAsString', 'ICoreWebView2ServiceWorker.PostWebMessageAsString'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('工作线程', 'EdgeView工作线程_发送JSON消息', [control, { name: '工作线程句柄', type: 'handle' }, { name: 'JSON', type: 'wideString' }], 'int', '向支持消息的 Dedicated 或 Service Worker 发送 JSON 消息。', ['ICoreWebView2DedicatedWorker.PostWebMessageAsJson', 'ICoreWebView2ServiceWorker.PostWebMessageAsJson'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('工作线程', 'EdgeView工作线程_置ServiceWorker脚本API', [control, { name: '启用', type: 'bool' }], 'int', '设置 Service Worker 是否允许 WebView 脚本 API。', ['ICoreWebView2Profile9.AreWebViewScriptApisEnabledForServiceWorkers'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('工作线程', 'EdgeView工作线程_取ServiceWorker脚本API', [control], 'int', '取得 Service Worker 的 WebView 脚本 API 开关。', ['ICoreWebView2Profile9.AreWebViewScriptApisEnabledForServiceWorkers'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('扩展', 'EdgeView扩展_安装异步', [control, { name: '扩展目录', type: 'wideString' }, { name: '完成处理器', type: 'handler' }], 'longLong', '从显式目录安装浏览器扩展，结果为受管扩展句柄。', ['ICoreWebView2Profile7.AddBrowserExtension'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('扩展', 'EdgeView扩展_枚举异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '枚举当前 Profile 的浏览器扩展。', ['ICoreWebView2Profile7.GetBrowserExtensions'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('扩展', 'EdgeView扩展_置启用异步', [control, { name: '扩展句柄', type: 'handle' }, { name: '启用', type: 'bool' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步启用或禁用受管浏览器扩展。', ['ICoreWebView2BrowserExtension.Enable'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('扩展', 'EdgeView扩展_删除异步', [control, { name: '扩展句柄', type: 'handle' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步删除受管浏览器扩展。', ['ICoreWebView2BrowserExtension.Remove'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('权限', 'EdgeView权限_枚举异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '枚举当前 Profile 的非默认权限设置。', ['ICoreWebView2Profile4.GetNonDefaultPermissionSettings'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('权限', 'EdgeView权限_设置异步', [control, { name: '权限类型', type: 'int' }, { name: '来源', type: 'wideString' }, { name: '状态', type: 'int' }, { name: '完成处理器', type: 'handler' }], 'longLong', '异步设置指定来源的权限状态。', ['ICoreWebView2Profile4.SetPermissionState'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('通知', 'EdgeView通知_取信息JSON', [control, { name: '通知句柄', type: 'handle' }], 'wideString', '取得受管通知的标题、正文、语言和状态；来源由“通知收到”事件提供。', ['ICoreWebView2Notification.Title', 'ICoreWebView2Notification.Body', 'ICoreWebView2Notification.Language', 'ICoreWebView2NotificationReceivedEventArgs.SenderOrigin'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('通知', 'EdgeView通知_报告已显示', [control, { name: '通知句柄', type: 'handle' }], 'int', '向 WebView2 报告自定义通知已显示。', ['ICoreWebView2Notification.ReportShown'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('通知', 'EdgeView通知_报告单击', [control, { name: '通知句柄', type: 'handle' }], 'int', '向 WebView2 报告通知被单击。', ['ICoreWebView2Notification.ReportClicked'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('通知', 'EdgeView通知_报告关闭', [control, { name: '通知句柄', type: 'handle' }], 'int', '向 WebView2 报告通知已关闭。', ['ICoreWebView2Notification.ReportClosed'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('缓冲', 'EdgeView缓冲_创建', [control, { name: '字节数', type: 'longLong' }], 'handle', '创建不超过 16 MiB 的受管共享缓冲。', ['ICoreWebView2Environment12.CreateSharedBuffer'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('缓冲', 'EdgeView缓冲_取大小', [control, { name: '缓冲句柄', type: 'handle' }], 'longLong', '取得受管共享缓冲大小。', ['ICoreWebView2SharedBuffer.Size'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('缓冲', 'EdgeView缓冲_写十六进制', [control, { name: '缓冲句柄', type: 'handle' }, { name: '十六进制', type: 'wideString' }], 'int', '把限长十六进制数据写入受管共享缓冲。', ['ICoreWebView2SharedBuffer.Buffer'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('缓冲', 'EdgeView缓冲_读十六进制', [control, { name: '缓冲句柄', type: 'handle' }, { name: '最大字节数', type: 'longLong' }], 'wideString', '从受管共享缓冲读取限长十六进制。', ['ICoreWebView2SharedBuffer.Buffer'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('缓冲', 'EdgeView缓冲_发送到网页', [control, { name: '缓冲句柄', type: 'handle' }, { name: '访问模式', type: 'int' }, { name: '附加JSON', type: 'wideString' }], 'int', '把共享缓冲以只读或读写模式发送到网页。', ['ICoreWebView2_17.PostSharedBufferToScript'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),

  api('安全', 'EdgeView安全_取证书JSON', [control, { name: '证书句柄', type: 'handle' }], 'wideString', '取得受管客户端或服务器证书的主题、签发者、有效期、序列号、显示名和 PEM。', [
    'ICoreWebView2Certificate.Subject', 'ICoreWebView2Certificate.Issuer', 'ICoreWebView2Certificate.ValidFrom', 'ICoreWebView2Certificate.ValidTo',
    'ICoreWebView2Certificate.DerEncodedSerialNumber', 'ICoreWebView2Certificate.DisplayName', 'ICoreWebView2Certificate.ToPemEncoding',
    'ICoreWebView2ClientCertificate.Subject', 'ICoreWebView2ClientCertificate.Issuer', 'ICoreWebView2ClientCertificate.ValidFrom', 'ICoreWebView2ClientCertificate.ValidTo',
    'ICoreWebView2ClientCertificate.DerEncodedSerialNumber', 'ICoreWebView2ClientCertificate.DisplayName', 'ICoreWebView2ClientCertificate.ToPemEncoding', 'ICoreWebView2ClientCertificate.Kind'
  ], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('安全', 'EdgeView安全_选择客户端证书', [control, { name: '证书句柄', type: 'handle' }], 'int', '在客户端证书同步决策事件中选择受管证书。', ['ICoreWebView2ClientCertificateRequestedEventArgs.SelectedCertificate', 'ICoreWebView2ClientCertificateRequestedEventArgs.Handled'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('安全', 'EdgeView安全_清除证书错误决策异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '清除当前 WebView 的服务器证书错误持久决策。', ['ICoreWebView2_14.ClearServerCertificateErrorActions'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('安全', 'EdgeView安全_显示另存为界面异步', [control, { name: '完成处理器', type: 'handler' }], 'longLong', '显示 WebView2 另存为界面并返回状态。', ['ICoreWebView2_25.ShowSaveAsUI'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR }),
  api('对象', 'EdgeView对象_取文件路径', [control, { name: '对象句柄', type: 'handle' }], 'wideString', '从受管 File 对象取得安全文件路径。', ['ICoreWebView2File.Path'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' }),
  api('对象', 'EdgeView对象_创建文件系统句柄', [control, { name: '路径', type: 'wideString' }, { name: '目录', type: 'bool' }, { name: '权限', type: 'int' }], 'handle', '从绝对路径创建受管文件或目录句柄；拒绝相对路径和不存在路径。', ['ICoreWebView2Environment14.CreateWebFileSystemFileHandle', 'ICoreWebView2Environment14.CreateWebFileSystemDirectoryHandle'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' }),
  api('脚本', 'EdgeView脚本_发送附加对象JSON', [control, { name: 'JSON', type: 'wideString' }, { name: '对象句柄', type: 'handle' }], 'int', '向网页发送 JSON 与一个受管文件系统附加对象。', ['ICoreWebView2Environment14.CreateObjectCollection', 'ICoreWebView2_23.PostWebMessageAsJsonWithAdditionalObjects'], { capability: EDGEVIEW_SAFE_API_V2_CAPABILITY, minimumRuntimeMajor: EDGEVIEW_FULL_RUNTIME_MAJOR, visibility: 'advanced' })
];

export const EDGEVIEW_SAFE_API_COMMANDS = EDGEVIEW_SAFE_API_CATALOG.map(entry => entry.command);
export const EDGEVIEW_SAFE_API_BINDINGS = EDGEVIEW_SAFE_API_CATALOG.map(entry => entry.binding);

export function validateEdgeViewApiCatalog(): string[] {
  const diagnostics: string[] = [];
  const names = new Set<string>();
  for (const entry of EDGEVIEW_SAFE_API_CATALOG) {
    if (names.has(entry.command.name)) diagnostics.push(`EdgeView API 命令重复：${entry.command.name}`);
    names.add(entry.command.name);
    if (entry.command.name !== entry.binding.command) diagnostics.push(`EdgeView contribution/binding 不一致：${entry.command.name}`);
    if (!entry.runtimeSymbol) diagnostics.push(`EdgeView 命令缺少运行时符号：${entry.command.name}`);
    if (!entry.testId) diagnostics.push(`EdgeView 命令缺少测试 ID：${entry.command.name}`);
    for (const parameter of entry.binding.parameters || []) {
      if (parameter.type === 'handler' && !entry.command.insertText?.includes('&')) diagnostics.push(`EdgeView 处理器补全缺少 &：${entry.command.name}`);
    }
  }
  return diagnostics;
}
