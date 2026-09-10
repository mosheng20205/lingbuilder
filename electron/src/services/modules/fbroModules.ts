import type {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution
} from './types';
import { createModuleBindingSnippetArgument, isWideStringAbiBindingType, normalizeControlReferenceCallSnippet, normalizeControlReferenceParameter } from './bindingValueType';
import {
  FBRO_VIP_AGGREGATE_CATEGORY,
  FBRO_VIP_OFFICIAL_ENTRIES
} from './fbroVipApiCatalog';

const CORE_DEPENDENCY = [{ moduleId: 'lingbuilder.fbro.browser', minimumVersion: '2.1.0' }];
const TARGET = [{
  id: 'windows-msvc-x64' as const,
  platform: 'windows' as const,
  arch: 'x64' as const,
  toolchain: 'msvc' as const
}];

type Parameter = ModuleCommandBindingParameter;

function api(
  name: string,
  officialAlias: string,
  parameters: Parameter[],
  returnType: ModuleBindingValueType,
  description: string,
  options: {
    runtimeName?: string;
    visibility?: 'default' | 'advanced';
    example?: string;
    category?: string;
    capabilityKind?: ModuleCommandContribution['capabilityKind'];
  } = {}
): { command: ModuleCommandContribution; binding: ModuleCommandBinding } {
  const normalizedParameters = parameters.map(parameter => normalizeControlReferenceParameter(parameter, { controlTypes: ['FBroBrowser'] }));
  const signature = `${name}(${normalizedParameters.map(item => item.name).join(', ')})`;
  const normalizedExample = normalizeControlReferenceCallSnippet(options.example, normalizedParameters);
  return {
    command: {
      name,
      aliases: [officialAlias],
      signature,
      description,
      insertText: normalizedExample || `${name}(${normalizedParameters.map(createModuleBindingSnippetArgument).join(', ')})`,
      returnType: returnType === 'void' ? '空' : returnType === 'wideString' ? '文本型' : returnType === 'longLong' || returnType === 'handle' ? '长整数型' : returnType === 'double' ? '小数型' : returnType === 'bool' ? '逻辑型' : '整数型',
      category: options.category,
      capabilityKind: options.capabilityKind,
      visibility: options.visibility
    },
    binding: {
      command: name,
      runtimeName: options.runtimeName || name,
      parameters: normalizedParameters,
      returnType,
      encoding: normalizedParameters.some(item => isWideStringAbiBindingType(item.type)) ? 'wide' : undefined,
      example: normalizedExample
    }
  };
}

function module(
  id: string,
  name: string,
  category: LingBuilderModuleManifest['category'],
  description: string,
  entries: ReturnType<typeof api>[]
): LingBuilderModuleManifest {
  return {
    schemaVersion: 2,
    id,
    name,
    version: '2.1.0',
    category,
    description,
    author: 'LingBuilder',
    tags: ['内置', 'FBro', 'CEF135', 'x64'],
    dependencies: CORE_DEPENDENCY,
    contributes: {
      commands: entries.map(item => item.command)
    },
    targets: TARGET,
    bindings: {
      commands: entries.map(item => item.binding)
    }
  };
}

const eventEntries = [
  api('FBro_取事件数据', 'LB_FBro_GetLastEventData', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得当前处理中的事件主数据。'),
  api('FBro_取事件字段', 'LB_FBro_GetEventField', [{ name: '控件名', type: 'controlRef' }, { name: '字段名', type: 'wideString' }], 'wideString', '从 UTF-16 JSON 事件包读取结构化字段。'),
  api('FBro_设置事件结果', 'LB_FBro_SetEventResult', [{ name: '控件名', type: 'controlRef' }, { name: '动作', type: 'int' }], 'int', '设置同步事件动作；未设置时使用事件目录默认动作。'),
  api('FBro_设置事件返回文本', 'LB_FBro_SetEventResultText', [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], 'int', '设置同步事件返回文本。'),
  api('FBro_设置事件响应JSON', 'LB_FBro_SetEventResponseJson', [{ name: '控件名', type: 'controlRef' }, { name: '响应JSON', type: 'wideString' }], 'int', '设置 C ABI v3 事件结构化响应；回调返回后 Bridge 会立即复制。'),
  api('FBro_取事件对象', 'LB_FBro_GetLastEventObject', [{ name: '控件名', type: 'controlRef' }], 'longLong', '取得 CertificateError 或 DragEnter 事件携带的受管对象句柄。', { visibility: 'advanced' }),
  api('FBro_取事件延续', 'LB_FBro_GetLastEventContinuation', [{ name: '控件名', type: 'controlRef' }], 'longLong', '取得当前延迟决策事件的受管延续句柄；只允许传给完成或取消命令。', { visibility: 'advanced' }),
  api('FBro_取事件对象字段', 'LB_FBro_GetEventObjectField', [{ name: '控件名', type: 'controlRef' }, { name: '字段名', type: 'wideString' }], 'wideString', '读取事件包中复制后的对象字段或受管句柄字段。', { visibility: 'advanced' }),
  api('FBro事件_完成延续', 'LB_FBro_CompleteEventContinuation', [{ name: '延续句柄', type: 'longLong' }, { name: '响应JSON', type: 'wideString' }], 'int', '完成认证、权限、查询或下载等延迟决策；重复完成返回稳定错误码。', { visibility: 'advanced' }),
  api('FBro事件_取消延续', 'LB_FBro_CancelEventContinuation', [{ name: '延续句柄', type: 'longLong' }], 'int', '取消尚未完成的受管事件延续。', { visibility: 'advanced' }),
  api('FBro_设置事件采样率', 'LB_FBro_SetEventSamplingRate', [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString' }, { name: '每秒次数', type: 'int' }], 'int', '按浏览器和事件设置高频事件采样率；零表示暂停投递。'),
  api('FBro_绑定事件', 'LB_FBro_BindEvent', [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString' }, { name: '处理器', type: 'handler', description: '必须使用 &处理器名' }], 'int', '动态绑定 FBro 事件处理器。', { example: 'FBro_绑定事件(FBro浏览器1, "BeforePopup", &$1)' }),
  api('FBro_读资源响应正文', 'LB_FBro_ResourceBodyBegin', [{ name: '控件名', type: 'controlRef' }, { name: '最大字节数', type: 'longLong' }, { name: '完成处理器', type: 'handler', description: '必须使用 &处理器名；只能在“资源响应到达”处理器中调用。' }], 'int', '在“资源响应到达”处理器执行期间，为当前资源安装有界正文捕获；完成后触发“资源响应正文到达”，通过 FBro_取事件字段读取 url、status_code、mime_type、received_bytes、truncated、error、body_text 和 body_base64。不会重新发起请求。', { example: 'FBro_读资源响应正文($1, 1048576, &$2)' })
];

const sessionEntries = [
  api('FBro会话_取Cookie', 'LB_FBro_GetCookies', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], 'wideString', '读取指定 RequestContext 中的 Cookie。', { runtimeName: 'FBro_取Cookie' }),
  api('FBro会话_清空Cookie', 'LB_FBro_ClearCookies', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], 'int', '清空指定地址 Cookie。', { runtimeName: 'FBro_清空Cookie' }),
  api('FBro会话_设置代理认证', 'LB_FBro_SetProxy', [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }], 'int', '设置隔离会话代理及认证信息。'),
  api('FBro会话_异步取全部Cookie', 'LB_FBro_CookieVisitAllAsync', [{ name: '控件名', type: 'controlRef' }], 'longLong', '异步读取当前 RequestContext 的全部 Cookie，任务结果为 UTF-16 JSON 数组。'),
  api('FBro会话_异步取地址Cookie', 'LB_FBro_CookieVisitUrlAsync', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '包含HttpOnly', type: 'int' }], 'longLong', '异步读取指定地址 Cookie，任务结果为 UTF-16 JSON 数组。'),
  api('FBro会话_异步设置Cookie', 'LB_FBro_CookieSetAsync', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' }, { name: '域', type: 'wideString' }, { name: '路径', type: 'wideString' }, { name: '安全', type: 'int' }, { name: '仅HTTP', type: 'int' }], 'longLong', '通过官方 CookieManager 异步设置 Cookie，并返回受管任务 ID。'),
  api('FBro会话_异步删除Cookie', 'LB_FBro_CookieDeleteAsync', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '名称', type: 'wideString' }], 'longLong', '异步删除指定 Cookie；名称留空时删除该地址全部 Cookie。'),
  api('FBro会话_异步刷新Cookie存储', 'LB_FBro_CookieFlushAsync', [{ name: '控件名', type: 'controlRef' }], 'longLong', '异步请求 FBro 将 Cookie 写入持久化存储。'),
  api('FBro会话_异步清理缓存', 'LB_FBro_ClearCacheAsync', [{ name: '控件名', type: 'controlRef' }, { name: '来源', type: 'wideString' }, { name: '移除标志', type: 'int' }, { name: '配额标志', type: 'int' }], 'longLong', '异步清理当前浏览器实例指定来源的缓存数据。', { visibility: 'advanced' }),
  api('FBro会话_异步清理全局缓存', 'LB_FBro_ClearGlobalCacheAsync', [{ name: '来源', type: 'wideString' }, { name: '移除标志', type: 'int' }, { name: '配额标志', type: 'int' }], 'longLong', '异步清理所有 FBro 实例共享的全局缓存数据。', { visibility: 'advanced' }),
  api('FBro会话_是否全局上下文', 'LB_FBro_IsGlobalRequestContext', [{ name: '控件名', type: 'controlRef' }], 'int', '判断指定浏览器使用的 RequestContext 是否为全局上下文；独立 Profile 返回 0。', { visibility: 'advanced' }),
  api('FBro会话_取上下文缓存路径', 'LB_FBro_GetRequestContextCachePath', [{ name: '控件名', type: 'controlRef' }], 'wideString', '返回 RequestContext 缓存路径 JSON（global 与 cachePath 字段）；全局上下文同样返回其真实路径。', { visibility: 'advanced' }),
  api('FBro会话_创建上下文', 'LB_FBro_RequestContextCreateAsync', [{ name: '设置JSON', type: 'wideString' }], 'longLong', '运行时创建独立 RequestContext（设置 JSON：cachePath、persistSessionCookies、acceptLanguageList、cookieableSchemesList、cookieableSchemesExcludeDefaults）；任务结果包含 context 句柄，可传给 FBro会话_使用上下文重建。', { visibility: 'advanced' }),
  api('FBro会话_使用上下文重建', 'LB_FBro_RecreateBrowserWithContext', [{ name: '控件名', type: 'controlRef' }, { name: '上下文句柄', type: 'longLong' }], 'int', '让浏览器改用指定 RequestContext 原地重建：先关闭旧浏览器，关闭完成后自动以新上下文重启（指纹多 profile 场景）。', { visibility: 'advanced' })
];

const transferEntries = [
  api('FBro传输_开始下载', 'LB_FBro_StartDownload', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], 'int', '使用当前浏览器会话开始下载。'),
  api('FBro传输_打印', 'LB_FBro_Print', [{ name: '控件名', type: 'controlRef' }], 'int', '打开当前浏览器页面的原生打印流程。'),
  api('FBro传输_异步生成PDF', 'LB_FBro_PrintToPdfAsync', [{ name: '控件名', type: 'controlRef' }, { name: '输出路径', type: 'wideString' }, { name: '设置JSON', type: 'wideString' }], 'longLong', '异步生成 PDF；设置使用 UTF-16 JSON，任务结果包含成功状态和绝对路径。'),
  api('FBro传输_异步打开文件对话框', 'LB_FBro_RunFileDialogAsync', [{ name: '控件名', type: 'controlRef' }, { name: '模式', type: 'int' }, { name: '标题', type: 'wideString' }, { name: '默认路径', type: 'wideString' }, { name: '筛选器JSON', type: 'wideString' }], 'longLong', '调用独立 STA Windows 安全文件对话框；模式为 0打开、1多选、2文件夹、3保存，任务返回 cancelled 和 paths UTF-16 JSON 字段。'),
  api('FBro传输_异步截图', 'LB_FBro_CaptureScreenshotAsync', [{ name: '控件名', type: 'controlRef' }, { name: '格式', type: 'wideString' }, { name: '质量', type: 'int' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }, { name: '缩放', type: 'int' }, { name: '来自表面', type: 'bool' }, { name: '超出视口', type: 'bool' }], 'longLong', '通过 FBro VIP Page.captureScreenshot 异步截图；任务结果通过受管缓冲返回。')
];

const automationEntries = [
  api('FBro自动化_执行JS异步', 'LB_FBro_ExecuteJsAsync', [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], 'longLong', '异步执行 JavaScript 并返回受管任务 ID。', { visibility: 'advanced' }),
  api('FBro框架_取主框架', 'FBroHsBrowser_GetMainFrame', [{ name: '控件名', type: 'controlRef' }], 'longLong', '取得浏览器主框架的受管句柄。', { visibility: 'advanced' }),
  api('FBro框架_取焦点框架', 'FBroHsBrowser_GetFocusedFrame', [{ name: '控件名', type: 'controlRef' }], 'longLong', '取得当前焦点框架的受管句柄。', { visibility: 'advanced' }),
  api('FBro框架_按标识取框架', 'FBroHsBrowser_GetFrameById', [{ name: '控件名', type: 'controlRef' }, { name: '标识', type: 'wideString' }], 'longLong', '按官方字符串标识取得受管框架句柄。', { visibility: 'advanced' }),
  api('FBro框架_按名称取框架', 'FBroHsBrowser_GetFrameByName', [{ name: '控件名', type: 'controlRef' }, { name: '名称', type: 'wideString' }], 'longLong', '按框架名称取得受管框架句柄。', { visibility: 'advanced' }),
  api('FBro框架_取标识列表JSON', 'FBroHsBrowser_GetFrameIdentifiers', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得全部框架标识的 UTF-16 JSON 数组。', { visibility: 'advanced' }),
  api('FBro框架_取名称列表JSON', 'FBroHsBrowser_GetFrameNames', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得全部框架名称的 UTF-16 JSON 数组。', { visibility: 'advanced' }),
  api('FBro框架_是否有效', 'FBroHsBrowserFrame_IsValid', [{ name: '框架句柄', type: 'longLong' }], 'int', '检查受管框架是否仍有效。', { visibility: 'advanced' }),
  api('FBro框架_是否主框架', 'FBroHsBrowserFrame_IsMain', [{ name: '框架句柄', type: 'longLong' }], 'int', '检查是否为主框架。', { visibility: 'advanced' }),
  api('FBro框架_是否焦点框架', 'FBroHsBrowserFrame_IsFocused', [{ name: '框架句柄', type: 'longLong' }], 'int', '检查框架是否拥有焦点。', { visibility: 'advanced' }),
  api('FBro框架_取地址', 'FBroHsBrowserFrame_GetURL', [{ name: '框架句柄', type: 'longLong' }], 'wideString', '取得框架当前地址。', { visibility: 'advanced' }),
  api('FBro框架_取名称', 'FBroHsBrowserFrame_GetName', [{ name: '框架句柄', type: 'longLong' }], 'wideString', '取得框架名称。', { visibility: 'advanced' }),
  api('FBro框架_取标识', 'FBroHsBrowserFrame_GetIdentifier', [{ name: '框架句柄', type: 'longLong' }], 'wideString', '取得框架官方字符串标识。', { visibility: 'advanced' }),
  api('FBro框架_取父框架', 'FBroHsBrowserFrame_GetParent', [{ name: '框架句柄', type: 'longLong' }], 'longLong', '取得父框架受管句柄；主框架返回零。', { visibility: 'advanced' }),
  api('FBro框架_取浏览器实例', 'FBroHsBrowserFrame_GetBrowser', [{ name: '框架句柄', type: 'longLong' }], 'longLong', '取得框架所属的 LingBuilder 浏览器实例 ID。', { visibility: 'advanced' }),
  api('FBro框架_撤销', 'FBroHsBrowserFrame_Undo', [{ name: '框架句柄', type: 'longLong' }], 'int', '在框架中执行撤销。', { visibility: 'advanced' }),
  api('FBro框架_重做', 'FBroHsBrowserFrame_Redo', [{ name: '框架句柄', type: 'longLong' }], 'int', '在框架中执行重做。', { visibility: 'advanced' }),
  api('FBro框架_剪切', 'FBroHsBrowserFrame_Cut', [{ name: '框架句柄', type: 'longLong' }], 'int', '剪切框架当前选择。', { visibility: 'advanced' }),
  api('FBro框架_复制', 'FBroHsBrowserFrame_Copy', [{ name: '框架句柄', type: 'longLong' }], 'int', '复制框架当前选择。', { visibility: 'advanced' }),
  api('FBro框架_粘贴', 'FBroHsBrowserFrame_Paste', [{ name: '框架句柄', type: 'longLong' }], 'int', '在框架中粘贴。', { visibility: 'advanced' }),
  api('FBro框架_删除', 'FBroHsBrowserFrame_Delete', [{ name: '框架句柄', type: 'longLong' }], 'int', '删除框架当前选择。', { visibility: 'advanced' }),
  api('FBro框架_全选', 'FBroHsBrowserFrame_SelectAll', [{ name: '框架句柄', type: 'longLong' }], 'int', '全选框架内容。', { visibility: 'advanced' }),
  api('FBro框架_查看源代码', 'FBroHsBrowserFrame_ViewSource', [{ name: '框架句柄', type: 'longLong' }], 'int', '打开框架源代码查看器。', { visibility: 'advanced' }),
  api('FBro框架_载入地址', 'FBroHsBrowserFrame_LoadURL', [{ name: '框架句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }], 'int', '让指定框架载入地址。', { visibility: 'advanced' }),
  api('FBro框架_执行JS', 'FBroHsBrowserFrame_ExecuteJavaScript', [{ name: '框架句柄', type: 'longLong' }, { name: '脚本', type: 'wideString' }, { name: '脚本地址', type: 'wideString' }, { name: '起始行', type: 'int' }], 'int', '在指定框架执行 JavaScript，不等待返回值。', { visibility: 'advanced' }),
  api('FBro框架_载入请求', 'LB_FBro_FrameLoadRequest', [{ name: '框架句柄', type: 'longLong' }, { name: '请求句柄', type: 'longLong' }], 'int', '让指定框架按受管请求对象载入（URL、方法、头与提交体）。', { visibility: 'advanced' }),
  api('FBro框架_发送进程消息', 'LB_FBro_FrameSendProcessMessage', [{ name: '框架句柄', type: 'longLong' }, { name: '目标进程', type: 'int' }, { name: '消息句柄', type: 'longLong' }], 'int', '向目标进程发送进程消息；目标进程 0=浏览器进程、1=渲染进程。', { visibility: 'advanced' }),
  api('FBro框架_创建URL请求', 'LB_FBro_FrameCreateUrlRequestAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '请求句柄', type: 'longLong' }], 'longLong', '在框架所属上下文中异步发起 URL 请求；任务结果包含 urlRequest 句柄与 status/error/cached 字段。', { visibility: 'advanced' }),
  api('FBro异步请求_发起', 'LB_FBro_UrlRequestStartAsync', [{ name: '控件名', type: 'controlRef' }, { name: '请求句柄', type: 'longLong' }], 'longLong', '使用指定浏览器会话上下文异步发起受管 URL 请求；任务结果包含 urlRequest 句柄、status、error 与 cached。', { visibility: 'advanced' }),
  api('FBro异步请求_取状态', 'LB_FBro_UrlRequestGetStatus', [{ name: 'URL请求句柄', type: 'longLong' }], 'int', '读取 URL 请求官方状态（1=未知 2=进行中 3=成功 4=失败）。', { visibility: 'advanced' }),
  api('FBro异步请求_取原请求', 'LB_FBro_UrlRequestGetRequestObject', [{ name: 'URL请求句柄', type: 'longLong' }], 'longLong', '取得 URL 请求对应的受管请求对象句柄。', { visibility: 'advanced' }),
  api('FBro填表_点击元素', 'LB_FBro_FrameTianBiaoClick', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }], 'int', '按 CSS 选择器点击第 index 个匹配元素（从 0 起）。', { visibility: 'advanced' }),
  api('FBro填表_滚动到元素', 'LB_FBro_FrameTianBiaoScrollIntoView', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }, { name: '滚到顶部', type: 'bool' }], 'int', '把匹配元素滚动到可视区域；滚到顶部为真时贴顶，否则尽量贴底。', { visibility: 'advanced' }),
  api('FBro填表_聚焦元素', 'LB_FBro_FrameTianBiaoSetFocus', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }, { name: '是否聚焦', type: 'bool' }], 'int', '设置匹配元素的输入焦点。', { visibility: 'advanced' }),
  api('FBro填表_赋值', 'LB_FBro_FrameTianBiaoSetValue', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }, { name: '值', type: 'wideString' }], 'int', '设置匹配元素的值（等效表单赋值）。', { visibility: 'advanced' }),
  api('FBro填表_取值', 'LB_FBro_FrameTianBiaoGetValueAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }], 'wideString', '读取匹配元素的值；内部等待任务完成后返回 JSON 结果。', { visibility: 'advanced' }),
  api('FBro填表_取坐标', 'LB_FBro_FrameTianBiaoGetPointAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '选择器', type: 'wideString' }, { name: '序号', type: 'int' }], 'wideString', '读取匹配元素页面坐标；内部等待任务完成后返回 JSON 结果。', { visibility: 'advanced' }),
  api('FBro框架_取源码', 'LB_FBro_FrameGetSourceAsync', [{ name: '框架句柄', type: 'longLong' }], 'longLong', '异步取框架完整 HTML 源码；用 FBro任务_等待 + FBro任务_取缓冲 取 UTF-8 字节缓冲，再 FBro缓冲_保存文件 或 FBro缓冲_转文本。', { visibility: 'advanced' }),
  api('FBro框架_取文本', 'LB_FBro_FrameGetTextAsync', [{ name: '框架句柄', type: 'longLong' }], 'longLong', '异步取框架可见文本；用 FBro任务_等待 + FBro任务_取缓冲 取 UTF-8 字节缓冲，再 FBro缓冲_转文本。', { visibility: 'advanced' }),
  api('FBro框架_遍历DOM', 'LB_FBro_FrameVisitDomAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '最大深度', type: 'int' }, { name: '最大节点数', type: 'int' }], 'longLong', '按官方 VisitDOM 遍历框架 DOM 并序列化为受管快照；内部等待任务完成，返回快照句柄（0=失败），节点用 FBro遍历_* 按序号访问；深度/节点数传 0 使用默认值（16/4000）。', { visibility: 'advanced' }),
  api('FBro遍历_取标题', 'LB_FBro_DomGetTitle', [{ name: '快照句柄', type: 'longLong' }], 'wideString', '读取 DOM 快照对应的页面标题。', { visibility: 'advanced' }),
  api('FBro遍历_取基础地址', 'LB_FBro_DomGetBaseUrl', [{ name: '快照句柄', type: 'longLong' }], 'wideString', '读取 DOM 快照对应文档的基础地址。', { visibility: 'advanced' }),
  api('FBro遍历_取节点数', 'LB_FBro_DomGetNodeCount', [{ name: '快照句柄', type: 'longLong' }], 'int', '返回 DOM 快照捕获的节点总数。', { visibility: 'advanced' }),
  api('FBro遍历_取节点类型', 'LB_FBro_DomGetNodeType', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'int', '读取节点官方类型（0 未定义、1 元素、2 文本、3 注释等）。', { visibility: 'advanced' }),
  api('FBro遍历_取节点路径', 'LB_FBro_DomGetNodePath', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'wideString', '读取节点路径 JSON（如 [0,2,1]，从 Body 起逐层子序号）；可传给按路径写回命令。', { visibility: 'advanced' }),
  api('FBro遍历_取节点名称', 'LB_FBro_DomGetNodeName', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'wideString', '读取节点名称（元素标签名小写或特殊节点名）。', { visibility: 'advanced' }),
  api('FBro遍历_取节点值', 'LB_FBro_DomGetNodeValue', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'wideString', '读取节点值（文本/注释节点内容）。', { visibility: 'advanced' }),
  api('FBro遍历_取节点内部文本', 'LB_FBro_DomGetNodeInnerText', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'wideString', '读取元素的 innerText（超长截断到 4096 字符）。', { visibility: 'advanced' }),
  api('FBro遍历_取节点属性数', 'LB_FBro_DomGetNodeAttributeCount', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }], 'int', '返回元素节点捕获的属性个数。', { visibility: 'advanced' }),
  api('FBro遍历_取节点属性名', 'LB_FBro_DomGetNodeAttributeName', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }, { name: '属性序号', type: 'int' }], 'wideString', '按序号读取元素属性名。', { visibility: 'advanced' }),
  api('FBro遍历_取节点属性值', 'LB_FBro_DomGetNodeAttributeValue', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }, { name: '属性序号', type: 'int' }], 'wideString', '按序号读取元素属性值。', { visibility: 'advanced' }),
  api('FBro遍历_取节点属性', 'LB_FBro_DomGetNodeAttributeByName', [{ name: '快照句柄', type: 'longLong' }, { name: '节点序号', type: 'int' }, { name: '属性名', type: 'wideString' }], 'wideString', '按名称读取元素属性值；不存在返回空文本。', { visibility: 'advanced' }),
  api('FBro遍历_取焦点节点路径', 'LB_FBro_DomGetFocusedPath', [{ name: '快照句柄', type: 'longLong' }], 'wideString', '读取遍历当时的焦点节点路径 JSON；无焦点节点返回空。', { visibility: 'advanced' }),
  api('FBro遍历_按路径取序号', 'LB_FBro_DomFindNodeByPath', [{ name: '快照句柄', type: 'longLong' }, { name: '路径JSON', type: 'wideString' }], 'int', '把节点路径 JSON 换算成节点序号；未找到返回 -1。', { visibility: 'advanced' }),
  api('FBro遍历_按路径设属性', 'LB_FBro_DomSetAttributeByPathAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '路径JSON', type: 'wideString' }, { name: '属性名', type: 'wideString' }, { name: '属性值', type: 'wideString' }], 'int', '重新遍历定位路径节点并设置元素属性；内部等待任务完成，返回 1=成功。', { visibility: 'advanced' }),
  api('FBro遍历_按路径赋值', 'LB_FBro_DomSetValueByPathAsync', [{ name: '框架句柄', type: 'longLong' }, { name: '路径JSON', type: 'wideString' }, { name: '值', type: 'wideString' }], 'int', '重新遍历定位路径节点并写入节点值（表单赋值语义）；内部等待任务完成，返回 1=成功。', { visibility: 'advanced' })
];

const objectEntries = [
  api('FBro任务_取状态', 'LB_FBro_TaskGetStatus', [{ name: '任务ID', type: 'longLong' }], 'int', '查询异步任务状态。', { visibility: 'advanced' }),
  api('FBro任务_取结果', 'LB_FBro_TaskGetResult', [{ name: '任务ID', type: 'longLong' }], 'wideString', '取得异步任务 UTF-16 结果。', { visibility: 'advanced' }),
  api('FBro任务_取错误', 'LB_FBro_TaskGetError', [{ name: '任务ID', type: 'longLong' }], 'wideString', '取得异步任务中文错误。', { visibility: 'advanced' }),
  api('FBro任务_等待', 'LB_FBro_TaskWait', [{ name: '任务ID', type: 'longLong' }, { name: '超时毫秒', type: 'int' }], 'int', '等待任务进入完成、失败或取消状态，最长十分钟。', { visibility: 'advanced' }),
  api('FBro任务_取对象', 'LB_FBro_TaskGetObject', [{ name: '任务ID', type: 'longLong' }], 'longLong', '取得已完成任务返回的受管对象句柄。', { visibility: 'advanced' }),
  api('FBro任务_取缓冲', 'LB_FBro_TaskGetBuffer', [{ name: '任务ID', type: 'longLong' }], 'longLong', '取得已完成任务返回的受管二进制缓冲句柄。', { visibility: 'advanced' }),
  api('FBro任务_取消', 'LB_FBro_TaskCancel', [{ name: '任务ID', type: 'longLong' }], 'int', '取消尚未完成的任务。', { visibility: 'advanced' }),
  api('FBro任务_释放', 'LB_FBro_TaskRelease', [{ name: '任务ID', type: 'longLong' }], 'int', '释放任务句柄。', { visibility: 'advanced' }),
  api('FBro缓冲_从文本', 'LB_FBro_BufferCreate', [{ name: '文本', type: 'wideString' }], 'longLong', '把 UTF-16 文本复制到受管二进制缓冲并返回句柄。', { visibility: 'advanced' }),
  api('FBro缓冲_取大小', 'LB_FBro_BufferGetSize', [{ name: '缓冲句柄', type: 'longLong' }], 'longLong', '取得受管缓冲字节数。', { visibility: 'advanced' }),
  api('FBro缓冲_转十六进制', 'LB_FBro_BufferToHex', [{ name: '缓冲句柄', type: 'longLong' }], 'wideString', '把受管缓冲转换为十六进制文本。', { visibility: 'advanced' }),
  api('FBro缓冲_保存文件', 'LB_FBro_BufferSaveFile', [{ name: '缓冲句柄', type: 'longLong' }, { name: '路径', type: 'wideString' }], 'int', '保存受管缓冲到文件。', { visibility: 'advanced' }),
  api('FBro缓冲_释放', 'LB_FBro_BufferRelease', [{ name: '缓冲句柄', type: 'longLong' }], 'int', '释放受管缓冲句柄。', { visibility: 'advanced' }),
  api('FBro缓冲_转文本', 'LB_FBro_BufferToText', [{ name: '缓冲句柄', type: 'longLong' }], 'wideString', '按 UTF-8 解码受管缓冲并返回文本（单次上限约 16K 字符；大内容请用 FBro缓冲_保存文件）。', { visibility: 'advanced' }),
  api('FBro缓冲_是否有效', 'LB_FBro_IsBufferValid', [{ name: '缓冲句柄', type: 'longLong' }], 'int', '检查受管缓冲句柄是否仍然有效。', { visibility: 'advanced' }),
  api('FBro工具_创建数据URI', 'LB_FBro_CreateDataUri', [{ name: 'MIME类型', type: 'wideString' }, { name: '数据', type: 'wideString' }], 'wideString', '把文本数据编码为 data: URI；MIME 类型如 image/png、text/html。', { visibility: 'advanced' }),
  api('FBro请求_创建', 'LB_FBro_RequestCreate', [], 'longLong', '创建受管 HTTP 请求对象并返回句柄；可用 FBro框架_载入请求 或 FBro异步请求_发起 使用。', { visibility: 'advanced' }),
  api('FBro请求_取地址', 'LB_FBro_RequestGetUrl', [{ name: '请求句柄', type: 'longLong' }], 'wideString', '读取请求对象当前地址。', { visibility: 'advanced' }),
  api('FBro请求_取方法', 'LB_FBro_RequestGetMethod', [{ name: '请求句柄', type: 'longLong' }], 'wideString', '读取请求对象当前的 HTTP 方法（GET、POST 等）。', { visibility: 'advanced' }),
  api('FBro请求_设置地址', 'LB_FBro_RequestSetUrl', [{ name: '请求句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }], 'int', '设置请求对象地址。', { visibility: 'advanced' }),
  api('FBro请求_设置方法', 'LB_FBro_RequestSetMethod', [{ name: '请求句柄', type: 'longLong' }, { name: '方法', type: 'wideString' }], 'int', '设置请求方法，如 GET、POST。', { visibility: 'advanced' }),
  api('FBro请求_设置引用页', 'LB_FBro_RequestSetReferrer', [{ name: '请求句柄', type: 'longLong' }, { name: '引用页', type: 'wideString' }, { name: '策略', type: 'int' }], 'int', '设置请求引用页与策略（0=清除 1=省略 2=降级 3=始终 4=源）。', { visibility: 'advanced' }),
  api('FBro请求_设置头映射JSON', 'LB_FBro_RequestSetHeaderMapJson', [{ name: '请求句柄', type: 'longLong' }, { name: '头列表JSON', type: 'wideString' }], 'int', '按 [{"name":"...","value":"..."}] 数组设置请求头；不覆盖未列出的已有头。', { visibility: 'advanced' }),
  api('FBro请求_组合设置', 'LB_FBro_RequestComposeSet', [{ name: '请求句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '方法', type: 'wideString' }, { name: '提交数据句柄', type: 'longLong' }, { name: '头列表JSON', type: 'wideString' }], 'int', '一次性设置地址、方法、提交体与头；提交数据句柄传 0 跳过，头 JSON 传空跳过。', { visibility: 'advanced' }),
  api('FBro提交数据_创建', 'LB_FBro_PostDataCreate', [], 'longLong', '创建受管提交数据对象（POST 请求体）。', { visibility: 'advanced' }),
  api('FBro提交数据_添加元素', 'LB_FBro_PostDataAddElement', [{ name: '提交数据句柄', type: 'longLong' }, { name: '元素句柄', type: 'longLong' }], 'int', '向提交数据对象追加一个提交元素。', { visibility: 'advanced' }),
  api('FBro提交数据_取元素数量', 'LB_FBro_PostDataGetElementCount', [{ name: '提交数据句柄', type: 'longLong' }], 'int', '取得提交数据对象中的元素数量。', { visibility: 'advanced' }),
  api('FBro提交数据_取元素句柄列表JSON', 'LB_FBro_PostDataGetElementHandlesJson', [{ name: '提交数据句柄', type: 'longLong' }], 'wideString', '取得全部提交元素并注册为受管句柄，返回 JSON 数组。', { visibility: 'advanced' }),
  api('FBro提交数据_创建元素', 'LB_FBro_PostDataElementCreate', [], 'longLong', '创建受管提交元素。', { visibility: 'advanced' }),
  api('FBro提交数据_元素设字节', 'LB_FBro_PostDataElementSetBytes', [{ name: '元素句柄', type: 'longLong' }, { name: '文本', type: 'wideString' }], 'int', '把元素内容设为 UTF-8 字节（按文本传入）。', { visibility: 'advanced' }),
  api('FBro提交数据_元素取字节大小', 'LB_FBro_PostDataElementGetBytesCount', [{ name: '元素句柄', type: 'longLong' }], 'int', '取得元素字节大小。', { visibility: 'advanced' }),
  api('FBro提交数据_元素取文本', 'LB_FBro_PostDataElementGetText', [{ name: '元素句柄', type: 'longLong' }], 'wideString', '按 UTF-8 读取元素字节并返回文本。', { visibility: 'advanced' }),
  api('FBro消息_创建', 'LB_FBro_ProcessMessageCreate', [{ name: '消息名', type: 'wideString' }], 'longLong', '创建受管进程消息对象。', { visibility: 'advanced' }),
  api('FBro消息_取参数列表', 'LB_FBro_ProcessMessageGetArgumentList', [{ name: '消息句柄', type: 'longLong' }], 'longLong', '取得消息参数列表的受管 List 句柄；可用 FBro列表_* 读写。', { visibility: 'advanced' }),
  api('FBro菜单_添加项', 'LB_FBro_MenuModelAddItem', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '向右键菜单模型添加菜单项；仅可在“上下文菜单显示前”事件处理期内使用。', { visibility: 'advanced' }),
  api('FBro菜单_添加子菜单', 'LB_FBro_MenuModelAddSubMenu', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'longLong', '向右键菜单模型添加子菜单并返回其受管句柄；仅可在事件处理期内使用。', { visibility: 'advanced' }),
  api('FBro菜单_设置加速键', 'LB_FBro_MenuModelSetAccelerator', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '键码', type: 'int' }, { name: 'Shift', type: 'bool' }, { name: 'Ctrl', type: 'bool' }, { name: 'Alt', type: 'bool' }], 'int', '为菜单项设置加速键组合。', { visibility: 'advanced' }),
  api('FBro菜单_取颜色', 'LB_FBro_MenuModelGetColor', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '颜色类型', type: 'int' }], 'wideString', '读取菜单项颜色，返回 red/green/blue/alpha JSON。', { visibility: 'advanced' }),
  api('FBro右键参数_取X', 'LB_FBro_ContextMenuParamsGetX', [{ name: '参数句柄', type: 'longLong' }], 'int', '读取右键菜单弹出坐标 X；仅可在事件处理期内使用。', { visibility: 'advanced' }),
  api('FBro右键参数_取Y', 'LB_FBro_ContextMenuParamsGetY', [{ name: '参数句柄', type: 'longLong' }], 'int', '读取右键菜单弹出坐标 Y；仅可在事件处理期内使用。', { visibility: 'advanced' }),
  api('FBro右键参数_取类型标志', 'LB_FBro_ContextMenuParamsGetTypeFlags', [{ name: '参数句柄', type: 'longLong' }], 'int', '读取右键菜单上下文类型标志位（TypeFlags 位掩码）；仅可在事件处理期内使用。', { visibility: 'advanced' }),
  api('FBro对象_取类型', 'LB_FBro_ObjectGetType', [{ name: '对象句柄', type: 'longLong' }], 'int', '取得受管对象注册表类型。', { visibility: 'advanced' }),
  api('FBro对象_释放', 'LB_FBro_ObjectRelease', [{ name: '对象句柄', type: 'longLong' }], 'int', '释放受管对象；重复释放返回稳定错误码。', { visibility: 'advanced' }),

  api('FBro值_创建', 'FBroHsValue_Create', [], 'longLong', '创建受管 Value 对象并返回不透明句柄。', { visibility: 'advanced' }),
  api('FBro值_是否有效', 'FBroHsValue_IsValid', [{ name: '值句柄', type: 'longLong' }], 'int', '检查 Value 对象是否有效。', { visibility: 'advanced' }),
  api('FBro值_是否被拥有', 'FBroHsValue_IsOwned', [{ name: '值句柄', type: 'longLong' }], 'int', '检查 Value 对象是否已归属于其它容器。', { visibility: 'advanced' }),
  api('FBro值_是否只读', 'FBroHsValue_IsReadOnly', [{ name: '值句柄', type: 'longLong' }], 'int', '检查 Value 对象是否只读。', { visibility: 'advanced' }),
  api('FBro值_是否同一对象', 'FBroHsValue_IsSame', [{ name: '值句柄', type: 'longLong' }, { name: '另一值句柄', type: 'longLong' }], 'int', '检查两个 Value 句柄是否引用同一官方对象。', { visibility: 'advanced' }),
  api('FBro值_是否相等', 'FBroHsValue_IsEqual', [{ name: '值句柄', type: 'longLong' }, { name: '另一值句柄', type: 'longLong' }], 'int', '比较两个 Value 的内容。', { visibility: 'advanced' }),
  api('FBro值_复制', 'FBroHsValue_Copy', [{ name: '值句柄', type: 'longLong' }], 'longLong', '复制 Value 并返回独立受管句柄。', { visibility: 'advanced' }),
  api('FBro值_取类型', 'FBroHsValue_GetType', [{ name: '值句柄', type: 'longLong' }], 'int', '取得 Value 的官方值类型。', { visibility: 'advanced' }),
  api('FBro值_取逻辑', 'FBroHsValue_GetBool', [{ name: '值句柄', type: 'longLong' }], 'int', '读取逻辑值。', { visibility: 'advanced' }),
  api('FBro值_取整数', 'FBroHsValue_GetInt', [{ name: '值句柄', type: 'longLong' }], 'int', '读取整数值。', { visibility: 'advanced' }),
  api('FBro值_取小数', 'FBroHsValue_GetDouble', [{ name: '值句柄', type: 'longLong' }], 'double', '读取小数值。', { visibility: 'advanced' }),
  api('FBro值_取文本', 'FBroHsValue_GetString', [{ name: '值句柄', type: 'longLong' }], 'wideString', '读取 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro值_设为空', 'FBroHsValue_SetNull', [{ name: '值句柄', type: 'longLong' }], 'int', '把 Value 设置为空值。', { visibility: 'advanced' }),
  api('FBro值_设置逻辑', 'FBroHsValue_SetBool', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'bool' }], 'int', '写入逻辑值。', { visibility: 'advanced' }),
  api('FBro值_设置整数', 'FBroHsValue_SetInt', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'int' }], 'int', '写入整数值。', { visibility: 'advanced' }),
  api('FBro值_设置小数', 'FBroHsValue_SetDouble', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'double' }], 'int', '写入小数值。', { visibility: 'advanced' }),
  api('FBro值_设置文本', 'FBroHsValue_SetString', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'wideString' }], 'int', '写入 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro值_取二进制', 'FBroHsValue_GetBinary', [{ name: '值句柄', type: 'longLong' }], 'longLong', '复制二进制值到受管缓冲并返回句柄。', { visibility: 'advanced' }),
  api('FBro值_设置二进制', 'FBroHsValue_SetBinary', [{ name: '值句柄', type: 'longLong' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '从受管缓冲写入二进制值。', { visibility: 'advanced' }),
  api('FBro值_取字典', 'FBroHsValue_GetDictionary', [{ name: '值句柄', type: 'longLong' }], 'longLong', '取得受父对象管理的 Dictionary 句柄。', { visibility: 'advanced' }),
  api('FBro值_取列表', 'FBroHsValue_GetList', [{ name: '值句柄', type: 'longLong' }], 'longLong', '取得受父对象管理的 List 句柄。', { visibility: 'advanced' }),
  api('FBro值_设置字典', 'FBroHsValue_SetDictionary', [{ name: '值句柄', type: 'longLong' }, { name: '字典句柄', type: 'longLong' }], 'int', '把 Dictionary 交由 Value 管理。', { visibility: 'advanced' }),
  api('FBro值_设置列表', 'FBroHsValue_SetList', [{ name: '值句柄', type: 'longLong' }, { name: '列表句柄', type: 'longLong' }], 'int', '把 List 交由 Value 管理。', { visibility: 'advanced' }),

  api('FBro字典_创建', 'FBroHsDictionaryValue_Create', [], 'longLong', '创建受管 Dictionary 对象。', { visibility: 'advanced' }),
  api('FBro字典_是否有效', 'FBroHsDictionaryValue_IsValid', [{ name: '字典句柄', type: 'longLong' }], 'int', '检查 Dictionary 是否有效。', { visibility: 'advanced' }),
  api('FBro字典_是否被拥有', 'FBroHsDictionaryValue_IsOwned', [{ name: '字典句柄', type: 'longLong' }], 'int', '检查 Dictionary 是否已被拥有。', { visibility: 'advanced' }),
  api('FBro字典_是否只读', 'FBroHsDictionaryValue_IsReadOnly', [{ name: '字典句柄', type: 'longLong' }], 'int', '检查 Dictionary 是否只读。', { visibility: 'advanced' }),
  api('FBro字典_是否同一对象', 'FBroHsDictionaryValue_IsSame', [{ name: '字典句柄', type: 'longLong' }, { name: '另一字典句柄', type: 'longLong' }], 'int', '检查两个 Dictionary 句柄是否引用同一官方对象。', { visibility: 'advanced' }),
  api('FBro字典_是否相等', 'FBroHsDictionaryValue_IsEqual', [{ name: '字典句柄', type: 'longLong' }, { name: '另一字典句柄', type: 'longLong' }], 'int', '比较两个 Dictionary 的内容。', { visibility: 'advanced' }),
  api('FBro字典_复制', 'FBroHsDictionaryValue_Copy', [{ name: '字典句柄', type: 'longLong' }, { name: '排除空子项', type: 'bool' }], 'longLong', '复制 Dictionary 并返回独立受管句柄。', { visibility: 'advanced' }),
  api('FBro字典_取数量', 'FBroHsDictionaryValue_GetSize', [{ name: '字典句柄', type: 'longLong' }], 'int', '取得键数量。', { visibility: 'advanced' }),
  api('FBro字典_清空', 'FBroHsDictionaryValue_Clear', [{ name: '字典句柄', type: 'longLong' }], 'int', '删除全部键。', { visibility: 'advanced' }),
  api('FBro字典_是否存在键', 'FBroHsDictionaryValue_HasKey', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '检查键是否存在。', { visibility: 'advanced' }),
  api('FBro字典_删除', 'FBroHsDictionaryValue_Remove', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '删除指定键。', { visibility: 'advanced' }),
  api('FBro字典_取类型', 'FBroHsDictionaryValue_GetType', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '取得指定键的官方值类型。', { visibility: 'advanced' }),
  api('FBro字典_取逻辑', 'FBroHsDictionaryValue_GetBool', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '读取逻辑值。', { visibility: 'advanced' }),
  api('FBro字典_取整数', 'FBroHsDictionaryValue_GetInt', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '读取整数值。', { visibility: 'advanced' }),
  api('FBro字典_取小数', 'FBroHsDictionaryValue_GetDouble', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'double', '读取小数值。', { visibility: 'advanced' }),
  api('FBro字典_取文本', 'FBroHsDictionaryValue_GetString', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'wideString', '读取 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro字典_取键列表JSON', 'FBroHsDictionaryValue_GetKeys', [{ name: '字典句柄', type: 'longLong' }], 'wideString', '取得 UTF-16 JSON 键数组，不向源码暴露 StringList 或 STL。', { visibility: 'advanced' }),
  api('FBro字典_取值对象', 'FBroHsDictionaryValue_GetValue', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'longLong', '取得受字典管理的 Value 句柄。', { visibility: 'advanced' }),
  api('FBro字典_取二进制', 'FBroHsDictionaryValue_GetBinary', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'longLong', '复制指定键的二进制值到受管缓冲。', { visibility: 'advanced' }),
  api('FBro字典_取字典', 'FBroHsDictionaryValue_GetDictionary', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'longLong', '取得受父字典管理的 Dictionary 句柄。', { visibility: 'advanced' }),
  api('FBro字典_取列表', 'FBroHsDictionaryValue_GetList', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'longLong', '取得受父字典管理的 List 句柄。', { visibility: 'advanced' }),
  api('FBro字典_设为空', 'FBroHsDictionaryValue_SetNull', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '把指定键设置为空值。', { visibility: 'advanced' }),
  api('FBro字典_设置逻辑', 'FBroHsDictionaryValue_SetBool', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值', type: 'bool' }], 'int', '写入逻辑值。', { visibility: 'advanced' }),
  api('FBro字典_设置整数', 'FBroHsDictionaryValue_SetInt', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值', type: 'int' }], 'int', '写入整数值。', { visibility: 'advanced' }),
  api('FBro字典_设置小数', 'FBroHsDictionaryValue_SetDouble', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值', type: 'double' }], 'int', '写入小数值。', { visibility: 'advanced' }),
  api('FBro字典_设置文本', 'FBroHsDictionaryValue_SetString', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值', type: 'wideString' }], 'int', '写入 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro字典_设置值对象', 'FBroHsDictionaryValue_SetValue', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值句柄', type: 'longLong' }], 'int', '把 Value 交由指定键管理。', { visibility: 'advanced' }),
  api('FBro字典_设置二进制', 'FBroHsDictionaryValue_SetBinary', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '从受管缓冲写入指定键。', { visibility: 'advanced' }),
  api('FBro字典_设置字典', 'FBroHsDictionaryValue_SetDictionary', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '子字典句柄', type: 'longLong' }], 'int', '把子 Dictionary 交由指定键管理。', { visibility: 'advanced' }),
  api('FBro字典_设置列表', 'FBroHsDictionaryValue_SetList', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '列表句柄', type: 'longLong' }], 'int', '把 List 交由指定键管理。', { visibility: 'advanced' }),

  api('FBro列表_创建', 'FBroHsListValue_Create', [], 'longLong', '创建受管 List 对象。', { visibility: 'advanced' }),
  api('FBro列表_是否有效', 'FBroHsListValue_IsValid', [{ name: '列表句柄', type: 'longLong' }], 'int', '检查 List 是否有效。', { visibility: 'advanced' }),
  api('FBro列表_是否被拥有', 'FBroHsListValue_IsOwned', [{ name: '列表句柄', type: 'longLong' }], 'int', '检查 List 是否已被拥有。', { visibility: 'advanced' }),
  api('FBro列表_是否只读', 'FBroHsListValue_IsReadOnly', [{ name: '列表句柄', type: 'longLong' }], 'int', '检查 List 是否只读。', { visibility: 'advanced' }),
  api('FBro列表_是否同一对象', 'FBroHsListValue_IsSame', [{ name: '列表句柄', type: 'longLong' }, { name: '另一列表句柄', type: 'longLong' }], 'int', '检查两个 List 句柄是否引用同一官方对象。', { visibility: 'advanced' }),
  api('FBro列表_是否相等', 'FBroHsListValue_IsEqual', [{ name: '列表句柄', type: 'longLong' }, { name: '另一列表句柄', type: 'longLong' }], 'int', '比较两个 List 的内容。', { visibility: 'advanced' }),
  api('FBro列表_复制', 'FBroHsListValue_Copy', [{ name: '列表句柄', type: 'longLong' }], 'longLong', '复制 List 并返回独立受管句柄。', { visibility: 'advanced' }),
  api('FBro列表_设置数量', 'FBroHsListValue_SetSize', [{ name: '列表句柄', type: 'longLong' }, { name: '数量', type: 'int' }], 'int', '设置列表长度。', { visibility: 'advanced' }),
  api('FBro列表_取数量', 'FBroHsListValue_GetSize', [{ name: '列表句柄', type: 'longLong' }], 'int', '取得列表长度。', { visibility: 'advanced' }),
  api('FBro列表_清空', 'FBroHsListValue_Clear', [{ name: '列表句柄', type: 'longLong' }], 'int', '清空列表。', { visibility: 'advanced' }),
  api('FBro列表_删除', 'FBroHsListValue_Remove', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'int', '删除指定索引。', { visibility: 'advanced' }),
  api('FBro列表_取类型', 'FBroHsListValue_GetType', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'int', '取得指定索引的官方值类型。', { visibility: 'advanced' }),
  api('FBro列表_取逻辑', 'FBroHsListValue_GetBool', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'int', '读取逻辑值。', { visibility: 'advanced' }),
  api('FBro列表_取整数', 'FBroHsListValue_GetInt', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'int', '读取整数值。', { visibility: 'advanced' }),
  api('FBro列表_取小数', 'FBroHsListValue_GetDouble', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'double', '读取小数值。', { visibility: 'advanced' }),
  api('FBro列表_取文本', 'FBroHsListValue_GetString', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'wideString', '读取 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro列表_取值对象', 'FBroHsListValue_GetValue', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '取得受列表管理的 Value 句柄。', { visibility: 'advanced' }),
  api('FBro列表_取二进制', 'FBroHsListValue_GetBinary', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '复制指定项的二进制值到受管缓冲。', { visibility: 'advanced' }),
  api('FBro列表_取字典', 'FBroHsListValue_GetDictionary', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '取得受父列表管理的 Dictionary 句柄。', { visibility: 'advanced' }),
  api('FBro列表_取列表', 'FBroHsListValue_GetList', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '取得受父列表管理的 List 句柄。', { visibility: 'advanced' }),
  api('FBro列表_设为空', 'FBroHsListValue_SetNull', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'int', '把指定索引设置为空值。', { visibility: 'advanced' }),
  api('FBro列表_设置逻辑', 'FBroHsListValue_SetBool', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '值', type: 'bool' }], 'int', '写入逻辑值。', { visibility: 'advanced' }),
  api('FBro列表_设置整数', 'FBroHsListValue_SetInt', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '值', type: 'int' }], 'int', '写入整数值。', { visibility: 'advanced' }),
  api('FBro列表_设置小数', 'FBroHsListValue_SetDouble', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '值', type: 'double' }], 'int', '写入小数值。', { visibility: 'advanced' }),
  api('FBro列表_设置文本', 'FBroHsListValue_SetString', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '值', type: 'wideString' }], 'int', '写入 UTF-16 文本值。', { visibility: 'advanced' }),
  api('FBro列表_设置值对象', 'FBroHsListValue_SetValue', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '值句柄', type: 'longLong' }], 'int', '把 Value 交由指定索引管理。', { visibility: 'advanced' }),
  api('FBro列表_设置二进制', 'FBroHsListValue_SetBinary', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '从受管缓冲写入指定索引。', { visibility: 'advanced' }),
  api('FBro列表_设置字典', 'FBroHsListValue_SetDictionary', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '字典句柄', type: 'longLong' }], 'int', '把 Dictionary 交由指定索引管理。', { visibility: 'advanced' }),
  api('FBro列表_设置列表', 'FBroHsListValue_SetList', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '子列表句柄', type: 'longLong' }], 'int', '把子 List 交由指定索引管理。', { visibility: 'advanced' }),

  api('FBro流_从文件创建', 'FBroStream_CreateForFile', [{ name: '路径', type: 'wideString' }], 'longLong', '从文件创建受管只读 Stream 句柄。', { visibility: 'advanced' }),
  api('FBro流_从缓冲创建', 'FBroStream_CreateForData', [{ name: '缓冲句柄', type: 'longLong' }], 'longLong', '复制受管缓冲并创建内存 Stream，保证底层数据生命周期。', { visibility: 'advanced' }),
  api('FBro流_读取', 'FBroStream_Read', [{ name: '流句柄', type: 'longLong' }, { name: '元素大小', type: 'longLong' }, { name: '元素数量', type: 'longLong' }], 'longLong', '读取数据并返回新的受管缓冲句柄，单次最多 256 MiB。', { visibility: 'advanced' }),
  api('FBro流_定位', 'FBroStream_Seek', [{ name: '流句柄', type: 'longLong' }, { name: '偏移', type: 'longLong' }, { name: '基准', type: 'int' }], 'int', '按 0=开头、1=当前位置、2=结尾定位 Stream。', { visibility: 'advanced' }),
  api('FBro流_取位置', 'FBroStream_Tell', [{ name: '流句柄', type: 'longLong' }], 'longLong', '取得当前字节位置。', { visibility: 'advanced' }),
  api('FBro流_是否结束', 'FBroStream_Eof', [{ name: '流句柄', type: 'longLong' }], 'int', '检查 Stream 是否到达结尾。', { visibility: 'advanced' }),
  api('FBro流_是否可能阻塞', 'FBroStream_MayBlock', [{ name: '流句柄', type: 'longLong' }], 'int', '查询该 Stream 操作是否可能阻塞。', { visibility: 'advanced' }),

  api('FBro图像_异步下载', 'FBroHsBrowserHost_DownloadImage', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }, { name: '作为图标', type: 'bool' }, { name: '最大尺寸', type: 'int' }, { name: '绕过缓存', type: 'bool' }], 'longLong', '通过当前浏览器会话异步下载图像并返回任务 ID。', { visibility: 'advanced' }),
  api('FBro图像_是否为空', 'FBroHsImage_IsEmpty', [{ name: '图像句柄', type: 'longLong' }], 'int', '检查受管 Image 是否为空。', { visibility: 'advanced' }),
  api('FBro图像_取宽度', 'FBroHsImage_GetWidth', [{ name: '图像句柄', type: 'longLong' }], 'int', '取得图像 DIP 宽度。', { visibility: 'advanced' }),
  api('FBro图像_取高度', 'FBroHsImage_GetHeight', [{ name: '图像句柄', type: 'longLong' }], 'int', '取得图像 DIP 高度。', { visibility: 'advanced' }),
  api('FBro图像_取表示信息JSON', 'FBroHsImage_GetRepresentationInfo', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放因子', type: 'double' }], 'wideString', '返回实际缩放、像素宽度和像素高度的 UTF-16 JSON。', { visibility: 'advanced' }),
  api('FBro图像_转位图缓冲', 'FBroHsImage_GetAsBitmap', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放因子', type: 'double' }, { name: '颜色类型', type: 'int' }, { name: '透明类型', type: 'int' }], 'longLong', '把最接近的位图表示复制到受管缓冲。', { visibility: 'advanced' }),
  api('FBro图像_转JPEG缓冲', 'FBroHsImage_GetAsJPEG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放因子', type: 'double' }, { name: '质量', type: 'int' }], 'longLong', '把图像编码为 JPEG 受管缓冲。', { visibility: 'advanced' }),
  api('FBro图像_转PNG缓冲', 'FBroHsImage_GetAsPNG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放因子', type: 'double' }, { name: '保留透明', type: 'bool' }], 'longLong', '把图像编码为 PNG 受管缓冲。', { visibility: 'advanced' }),

  api('FBro证书_异步取当前', 'LB_FBro_GetCurrentCertificateAsync', [{ name: '控件名', type: 'controlRef' }], 'longLong', '从当前可见导航项异步取得 TLS 证书任务。', { visibility: 'advanced' }),
  api('FBro证书_取主体', 'FBroHsX509Certificate_GetSubject', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得受证书管理的主体 Principal 句柄。', { visibility: 'advanced' }),
  api('FBro证书_取颁发者', 'FBroHsX509Certificate_GetIssuer', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得受证书管理的颁发者 Principal 句柄。', { visibility: 'advanced' }),
  api('FBro证书_取序列号缓冲', 'FBroHsX509Certificate_GetSerialNumber', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书序列号受管缓冲。', { visibility: 'advanced' }),
  api('FBro证书_取DER缓冲', 'FBroHsX509Certificate_GetDEREncoded', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得 DER 编码证书受管缓冲。', { visibility: 'advanced' }),
  api('FBro证书_取PEM缓冲', 'FBroHsX509Certificate_GetPEMEncoded', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得 PEM 编码证书受管缓冲。', { visibility: 'advanced' }),
  api('FBro证书_取生效时间', 'FBroHsX509Certificate_GetValidStart', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书生效 Unix 时间。', { visibility: 'advanced' }),
  api('FBro证书_取失效时间', 'FBroHsX509Certificate_GetValidExpiry', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书失效 Unix 时间。', { visibility: 'advanced' }),
  api('FBro证书_取颁发链数量', 'FBroHsX509Certificate_GetIssuerChainSize', [{ name: '证书句柄', type: 'longLong' }], 'int', '取得颁发链数量。', { visibility: 'advanced' }),
  api('FBro证书_取DER颁发链项', 'FBroHsX509Certificate_GetDEREncodedIssuerChain', [{ name: '证书句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '取得指定颁发链项的 DER 受管缓冲。', { visibility: 'advanced' }),
  api('FBro证书_取PEM颁发链项', 'FBroHsX509Certificate_GetPEMEncodedIssuerChain', [{ name: '证书句柄', type: 'longLong' }, { name: '索引', type: 'int' }], 'longLong', '取得指定颁发链项的 PEM 受管缓冲。', { visibility: 'advanced' }),
  api('FBro证书主体_取显示名', 'FBroHsX509CertPrincipal_GetDisplayName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体显示名。', { visibility: 'advanced' }),
  api('FBro证书主体_取通用名', 'FBroHsX509CertPrincipal_GetCommonName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体通用名。', { visibility: 'advanced' }),
  api('FBro证书主体_取地区名', 'FBroHsX509CertPrincipal_GetLocalityName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体地区名。', { visibility: 'advanced' }),
  api('FBro证书主体_取省州名', 'FBroHsX509CertPrincipal_GetStateOrProvinceName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体省或州名。', { visibility: 'advanced' }),
  api('FBro证书主体_取国家名', 'FBroHsX509CertPrincipal_GetCountryName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体国家名。', { visibility: 'advanced' }),
  api('FBro证书主体_取组织JSON', 'FBroHsX509CertPrincipal_GetOrganizationNames', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得组织名 UTF-16 JSON 数组。', { visibility: 'advanced' }),
  api('FBro证书主体_取组织单位JSON', 'FBroHsX509CertPrincipal_GetOrganizationUnitNames', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得组织单位名 UTF-16 JSON 数组。', { visibility: 'advanced' }),
  api('FBro拖放数据_是否有图像', 'FBroHsDragData_HasImage', [{ name: '拖放数据句柄', type: 'longLong' }], 'int', '检查 DragEnter 事件对象是否携带图像。', { visibility: 'advanced' }),
  api('FBro拖放数据_取图像', 'FBroHsDragData_GetImage', [{ name: '拖放数据句柄', type: 'longLong' }], 'longLong', '从 DragEnter 事件对象取得受管 Image 句柄。', { visibility: 'advanced' })
];

const networkEntries = [
  api('FBro网络_设置代理', 'LB_FBro_SetProxy', [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }], 'int', '设置当前 FBro RequestContext 的代理。', { runtimeName: 'FBro_设置代理', visibility: 'advanced' }),
  api('FBro网络_设置代理认证', 'LB_FBro_SetProxyAuthentication', [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }], 'int', '设置代理与认证信息。', { runtimeName: 'FBro会话_设置代理认证', visibility: 'advanced' }),
  api('FBro服务器_创建', 'LB_FBro_ServerCreateAsync', [{ name: '控件名', type: 'controlRef' }, { name: '监听地址', type: 'wideString' }, { name: '端口', type: 'int' }, { name: '最大连接数', type: 'int' }], 'longLong', '在指定浏览器实例上创建内嵌 HTTP/WebSocket 服务器；任务结果包含 server 句柄与 address，服务器事件派发给该浏览器实例。', { visibility: 'advanced' }),
  api('FBro服务器_发送WebSocket文本', 'LB_FBro_ServerSendWebSocketMessage', [{ name: '服务器句柄', type: 'longLong' }, { name: '连接ID', type: 'int' }, { name: '文本', type: 'wideString' }], 'int', '向指定连接发送 WebSocket 文本帧（UTF-8）；自动投递到服务器 IO 线程。', { visibility: 'advanced' }),
  api('FBro服务器_发送WebSocket缓冲', 'LB_FBro_ServerSendWebSocketBuffer', [{ name: '服务器句柄', type: 'longLong' }, { name: '连接ID', type: 'int' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '向指定连接发送 WebSocket 二进制帧（受管缓冲）。', { visibility: 'advanced' }),
  api('FBro服务器_取地址', 'LB_FBro_ServerGetAddress', [{ name: '服务器句柄', type: 'longLong' }], 'wideString', '返回服务器监听地址。', { visibility: 'advanced' }),
  api('FBro服务器_是否存在连接', 'LB_FBro_ServerHasConnection', [{ name: '服务器句柄', type: 'longLong' }, { name: '连接ID', type: 'int' }], 'int', '判断指定连接是否仍然有效。', { visibility: 'advanced' }),
  api('FBro服务器_关闭', 'LB_FBro_ServerShutdown', [{ name: '服务器句柄', type: 'longLong' }], 'int', '关闭内嵌服务器并释放监听。', { visibility: 'advanced' }),
  api('FBro页面_发送文本', 'LB_FBro_SocketServerSendByBrowser', [{ name: '控件名', type: 'controlRef' }, { name: '通道名', type: 'wideString' }, { name: '文本', type: 'wideString' }], 'int', '按通道名把文本推送给页面内 WebSocket 拦截挂钩脚本（UTF-8 传输）；用于篡改/回发工作流。', { visibility: 'advanced' }),
  api('FBro页面_发送缓冲', 'LB_FBro_SocketServerSendByBrowserBuffer', [{ name: '控件名', type: 'controlRef' }, { name: '通道名', type: 'wideString' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '按通道名把受管缓冲字节推送给页面内拦截挂钩脚本。', { visibility: 'advanced' }),
  api('FBro页面_客户端发送文本', 'LB_FBro_SocketClientSendByBrowser', [{ name: '控件名', type: 'controlRef' }, { name: '通道名', type: 'wideString' }, { name: '文本', type: 'wideString' }], 'int', '按通道名把文本经客户端拦截通道推送给页面挂钩脚本。', { visibility: 'advanced' }),
  api('FBro页面_客户端发送缓冲', 'LB_FBro_SocketClientSendByBrowserBuffer', [{ name: '控件名', type: 'controlRef' }, { name: '通道名', type: 'wideString' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '按通道名把受管缓冲字节经客户端拦截通道推送给页面挂钩脚本。', { visibility: 'advanced' }),
  api('FBroWS客户端_是否空', 'LB_FBro_WssIsNull', [{ name: 'WS客户端句柄', type: 'longLong' }], 'int', '判断拦截事件下发的 WebSocket 客户端句柄是否为空。', { visibility: 'advanced' }),
  api('FBroWS客户端_取地址', 'LB_FBro_WssGetAddress', [{ name: 'WS客户端句柄', type: 'longLong' }], 'wideString', '读取被拦截 WebSocket 客户端的连接地址。', { visibility: 'advanced' }),
  api('FBroWS客户端_取协议', 'LB_FBro_WssGetProtocol', [{ name: 'WS客户端句柄', type: 'longLong' }], 'wideString', '读取被拦截 WebSocket 客户端的子协议。', { visibility: 'advanced' }),
  api('FBroWS客户端_取扩展', 'LB_FBro_WssGetExtensions', [{ name: 'WS客户端句柄', type: 'longLong' }], 'wideString', '读取被拦截 WebSocket 客户端的扩展协商结果。', { visibility: 'advanced' }),
  api('FBroWS客户端_发送文本', 'LB_FBro_WssSend', [{ name: 'WS客户端句柄', type: 'longLong' }, { name: '文本', type: 'wideString' }], 'int', '通过被拦截的 WebSocket 客户端发送文本帧。', { visibility: 'advanced' }),
  api('FBroWS客户端_发送缓冲', 'LB_FBro_WssSendBuffer', [{ name: 'WS客户端句柄', type: 'longLong' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '通过被拦截的 WebSocket 客户端发送二进制帧（受管缓冲）。', { visibility: 'advanced' })
];

const vipAggregateOptions = {
  visibility: 'advanced' as const,
  category: FBRO_VIP_AGGREGATE_CATEGORY,
  capabilityKind: 'aggregate' as const
};

const vipEntries = [
  ...FBRO_VIP_OFFICIAL_ENTRIES,
  api('FBroVIP_应用指纹JSON', 'LB_FBro_ApplyFingerprintJson', [{ name: '控件名', type: 'controlRef' }, { name: 'JSON', type: 'wideString' }], 'int', '通过 UTF-16 JSON 批量应用完整直接指纹配置，覆盖浏览器、屏幕、GPU、WebRTC、时区、电池、位置、设备、Canvas/WebGL/Audio 和 User-Agent Data；不会暴露 Key。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_应用配置' }),
  api('FBroVIP_取已应用配置JSON', 'LB_FBro_GetAppliedFingerprintJson', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得最近一次成功应用的规范化指纹配置与 User-Agent Data JSON。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_取已应用配置' }),
  api('FBroVIP_取授权信息JSON', 'LB_FBro_GetVipLicenseInfoJson', [], 'wideString', '读取脱敏的 VIP 授权状态、版本、授权范围和有效期；不返回 Key。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_取授权信息' }),
  api('FBroVIP_取调用次数', 'LB_FBro_GetFingerprintCallCount', [{ name: '控件名', type: 'controlRef' }], 'wideString', '查询 VIP 指纹调用次数。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_取调用次数' }),
  api('FBroVIP_清空调用次数', 'LB_FBro_ClearFingerprintCallCount', [{ name: '控件名', type: 'controlRef' }], 'int', '清空 VIP 指纹调用次数。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_清空调用次数' }),
  api('FBroVIP_DOM异步命令', 'LB_FBro_VipDomCommandAsync', [{ name: '控件名', type: 'controlRef' }, { name: '命令', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }], 'longLong', 'DOM 批量高级分发入口；单项 DOM 命令已经在 DOM 分类中分别公开。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_DOM异步命令' }),
  api('FBroVIP_扩展异步命令', 'LB_FBro_VipExtensionCommandAsync', [{ name: '控件名', type: 'controlRef' }, { name: '命令', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }], 'longLong', '扩展批量高级分发入口；文件路径必须位于生成程序目录内。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_扩展异步命令' }),
  api('FBroVIP_资源规则异步命令', 'LB_FBro_VipResourceCommandAsync', [{ name: '控件名', type: 'controlRef' }, { name: '命令', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }], 'longLong', '资源与响应规则批量高级分发入口；二进制数据只接受 FBro 受管缓冲句柄。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_资源规则异步命令' }),
  api('FBroVIP_开发者工具异步命令', 'LB_FBro_VipDevToolsCommandAsync', [{ name: '控件名', type: 'controlRef' }, { name: '命令', type: 'wideString' }, { name: '参数JSON', type: 'wideString' }], 'longLong', 'DevTools、Runtime 与输入批量高级分发入口；单项命令已经分别公开。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_开发者工具异步命令' }),
  api('FBroVIP_设置启动代理', 'LB_FBro_SetVipStartupProxy', [{ name: '地址', type: 'wideString' }, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }], 'int', '配置 VIP 启动代理；必须在首个 FBro 运行时初始化前调用，凭据只保存在 Bridge 内存中。', { ...vipAggregateOptions, runtimeName: 'FBro指纹_设置启动代理' })
];

export const FBRO_SUBMODULES: LingBuilderModuleManifest[] = [
  module('lingbuilder.fbro.events', 'FBro事件模块', '界面', '提供 UTF-16 JSON 事件包、同步决策与动态处理器绑定。', eventEntries),
  module('lingbuilder.fbro.session', 'FBro会话模块', '网络', '提供隔离 Profile、Cookie 和代理认证高层能力。', sessionEntries),
  module('lingbuilder.fbro.transfer', 'FBro传输模块', '网络', '提供下载与原生打印高层能力。', transferEntries),
  module('lingbuilder.fbro.automation', 'FBro自动化模块', '系统', '提供受管异步 JavaScript 任务与类型化 Frame 操作。', automationEntries),
  module('lingbuilder.fbro.objects', 'FBro受管对象模块', '系统', '提供任务、缓冲及 Value、Dictionary、List、Stream、Image、Certificate、DragData 的类型化不透明句柄 API。', objectEntries),
  module('lingbuilder.fbro.network', 'FBro高级网络模块', '网络', '提供显式启用的代理与认证高级 API。', networkEntries),
  module('lingbuilder.fbro.vip', 'FBro VIP 指纹模块', '系统', '提供不泄露授权信息的结构化 VIP 指纹入口。', vipEntries)
];
