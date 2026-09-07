import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { CEF3_BROWSER_EVENTS } from '../src/services/modules/cef3BrowserEvents';
import { CEF3_SAFE_API_BASELINE, CEF3_SAFE_API_CATALOG } from '../src/services/modules/cef3SafeApiCatalog.generated';
import {
  FBRO_EVENT_CATALOG,
  FBRO_PUBLIC_BROWSER_EVENTS,
  type FbroEventDefinition
} from '../src/services/modules/fbroEventCatalog';
import type {
  LingBuilderModuleManifest,
  ModuleCommandContribution
} from '../src/services/modules/types';

type DocumentTarget = 'cef3' | 'fbro';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes('--check');
const moduleArgumentIndex = process.argv.indexOf('--module');
const requestedTarget = moduleArgumentIndex >= 0
  ? process.argv[moduleArgumentIndex + 1] as DocumentTarget | undefined
  : undefined;

if (requestedTarget && requestedTarget !== 'cef3' && requestedTarget !== 'fbro') {
  throw new Error(`不支持的文档目标：${requestedTarget}`);
}

const targets: DocumentTarget[] = requestedTarget ? [requestedTarget] : ['cef3', 'fbro'];

const CEF3_KIND_LABELS = {
  notification: '通知',
  decision: '同步决策',
  highFrequency: '高频通知'
} as const;

const CEF3_COVERAGE_DOMAINS = [
  ['lingbuilder.cef3.browser', '基础浏览器', 'browser'],
  ['lingbuilder.cef3.events', '事件与回调', 'events'],
  ['lingbuilder.cef3.session', '会话与请求上下文', 'session'],
  ['lingbuilder.cef3.transfer', '下载、打印与传输', 'transfer'],
  ['lingbuilder.cef3.objects', '受管对象', 'objects'],
  ['lingbuilder.cef3.automation', '自动化、DOM、V8 与 JSHook', 'automation'],
  ['lingbuilder.cef3.network', '网络、请求与资源', 'network'],
  ['lingbuilder.cef3.devtools', '开发者工具', 'devtools'],
  ['lingbuilder.cef3.views', 'CEF Views', 'views'],
  ['lingbuilder.cef3.osr', '离屏渲染 OSR', 'osr'],
  ['lingbuilder.cef3.platform', '平台与工具', 'platform']
] as const;

const CEF3_COVERAGE_NOTES: Readonly<Record<string, readonly string[]>> = {
  'lingbuilder.cef3.browser': [
    '`cef_frame_t.send_process_message` 的 Bridge 入口接收受管浏览器句柄，固定解析当前主 Frame，并通过 CEF UI 线程调度发送；不会向调用方暴露 `CefFrame`、`CefRefPtr` 或 Frame 指针。',
    '`CEF3_绑定事件` 在登记中文处理器的同时点亮该事件所属处理器族的桥接订阅位。Bridge 按订阅位决定是否向 CEF 安装 `CefResourceRequestHandler`、`CefFrameHandler`、`CefPrintHandler` 等处理器以及回调体是否投递事件，订阅位为 0 时 CEF 根本不会调用回调，因此绑定前不存在“还要另外调用一次订阅命令”的步骤。已有 legacy 数字事件通道的事件（如「导航请求前」「下载开始」）不再点亮订阅位，否则同一事件会经两条通道各投递一次、处理器被调用两遍；映射表见 `services/modules/cef3BrowserEvents.ts` 的 `CEF3_EVENT_BRIDGE_SUBSCRIPTIONS`，由 `tests/cef3BridgeEventNames.test.ts` 与桥接源码逐条比对。离屏渲染（OSR）与 CEF Views 族事件不属于浏览器事件目录，仍需使用各自模块的订阅入口显式启用。',
    '`CEF3_创建` 是异步的：Bridge 只把 `CefBrowserHost::CreateBrowser` 投递到 CEF UI 线程，句柄立即返回，此时 CEF 浏览器对象尚未创建。`CEF3_导航` 会把地址排队，并在 Bridge 发出「浏览器创建完成」（该事件发出前浏览器对象已写入）时无条件补发，所以创建完毕事件里发起导航可以生效。其余依赖活动浏览器对象的命令（执行 JavaScript、页内查找、截图、缩放、静音、DevTools、Cookie 与请求上下文操作等）没有这套排队，在创建完成前调用会返回「CEF3浏览器尚未创建完成或已经关闭」，应当放在用户动作之后或「加载完成」事件里，不得用休眠或轮询绕过时序。'
  ],
  'lingbuilder.cef3.automation': [
    '`CefProcessMessage` 的名称、参数列表、复制、有效性、只读状态和发送均通过受管句柄访问；发送成功排队后消息句柄立即进入失效状态，符合 CEF 的内容所有权转移语义。',
    '`CefSharedProcessMessageBuilder` 的内存只以 `managedBuffer` 镜像返回，构建前由 Bridge 同步回 CEF 共享内存；构建会使 builder 失效并返回新的受管进程消息句柄。'
  ],
  'lingbuilder.cef3.osr': [
    '`CefSharedMemoryRegion` 使用独立受管句柄保存 CEF 生命周期；`memory()` 只返回 Bridge 拥有的缓冲副本，不公开共享内存原始地址。'
  ]
};

const FBRO_KIND_LABELS = {
  notification: '通知',
  decision: '同步决策',
  deferredDecision: '延迟决策',
  highFrequency: '高频通知',
  internal: '内部事件'
} as const;

const FBRO_EXPOSURE_LABELS = {
  public: '公开可绑定',
  managed: 'Bridge 托管',
  internal: '内部事件',
  notApplicable: '不适用'
} as const;

const FBRO_DEFAULT_ACTION_LABELS = {
  notify: '仅通知',
  continue: '继续',
  cancel: '取消'
} as const;

function escapeMarkdown(value: unknown): string {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('`', '\\`')
    .replaceAll('\r', ' ')
    .replaceAll('\n', '<br>');
}

function inlineCode(value: unknown): string {
  return `\`${escapeMarkdown(value)}\``;
}

function familyModules(prefix: string): LingBuilderModuleManifest[] {
  return BUILTIN_MODULES.filter(module => module.id.startsWith(prefix));
}

function userCommands(module: LingBuilderModuleManifest): ModuleCommandContribution[] {
  return (module.contributes?.commands || []).filter(command => command.visibility !== 'internal');
}

function countUserCommands(modules: LingBuilderModuleManifest[]): number {
  return modules.reduce((total, module) => total + userCommands(module).length, 0);
}

function renderModuleSummary(lines: string[], modules: LingBuilderModuleManifest[]): void {
  lines.push(
    '| 模块 | 模块 ID | 用户接口数 |',
    '|---|---|---:|'
  );
  for (const module of modules) {
    lines.push(`| ${escapeMarkdown(module.name)} | ${inlineCode(module.id)} | ${userCommands(module).length} |`);
  }
}

function renderCommandReference(lines: string[], modules: LingBuilderModuleManifest[]): void {
  modules.forEach((module, moduleIndex) => {
    const commands = userCommands(module);
    lines.push(
      '',
      `### ${moduleIndex + 1}. ${escapeMarkdown(module.name)}`,
      '',
      `${escapeMarkdown(module.description)} 模块 ID：${inlineCode(module.id)}；本节共 ${commands.length} 条用户接口。`,
      '',
      '| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |',
      '|---:|---|---|---|---|---|---|'
    );

    commands.forEach((command, commandIndex) => {
      lines.push([
        `| ${commandIndex + 1}`,
        inlineCode(command.name),
        inlineCode(command.signature),
        escapeMarkdown(command.returnType || '未声明'),
        command.visibility === 'advanced' ? '高级' : '常用',
        command.aliases?.length ? command.aliases.map(inlineCode).join('<br>') : '-',
        `${escapeMarkdown(command.description)} |`
      ].join(' | '));
    });
  });
}

function renderCef3Document(): string {
  const modules = familyModules('lingbuilder.cef3');
  const commandCount = countUserCommands(modules);
  const kindCounts = Object.fromEntries(
    Object.keys(CEF3_KIND_LABELS).map(kind => [kind, CEF3_BROWSER_EVENTS.filter(event => event.kind === kind).length])
  ) as Record<keyof typeof CEF3_KIND_LABELS, number>;
  const lines = [
    '<!-- 此文件由 electron/scripts/generate-cef3-fbro-event-docs.ts 生成。请修改 CEF3 事件目录或模块 manifest 后运行 npm run module:cef3-docs。 -->',
    '# CEF3 模块事件与接口参考',
    '',
    `本参考从 LingBuilder 的统一事件目录和实际模块 manifest 自动生成。CEF3 模块族当前包含 ${modules.length} 个模块、${CEF3_BROWSER_EVENTS.length} 项可绑定事件名称和 ${commandCount} 条面向用户的中文接口。`,
    '',
    '> 事件进入统一目录表示名称、分类和绑定契约已经确定，不代表对应 CEF 原生回调已经接通。`planned` 回调不能视为可调用能力；运行状态以当前版本的模块覆盖门禁和构建诊断为准。',
    '',
    '## 快速使用',
    '',
    '控件参数是裸 `controlRef`，处理器参数使用 `&处理器名`：',
    '',
    '```text',
    '绑定结果 = CEF3_绑定事件(浏览器1, "新窗口打开前", &处理新窗口)',
    '结束',
    '',
    '事件 处理新窗口()',
    '    目标地址 = CEF3_取事件字段(浏览器1, "url")',
    '    CEF3_设置事件结果(浏览器1, 2)',
    '    调试输出(目标地址)',
    '结束',
    '```',
    '',
    '- `CEF3_取事件数据` 返回当前或最近事件的主要文本；复杂事件用 `CEF3_取事件字段` 按字段名读取。',
    '- 同步决策处理器内可调用 `CEF3_设置事件结果`：`0=默认`、`1=允许/继续`、`2=拒绝/取消`、`3=已处理`。',
    '- 需要返回下载路径、修改后的 URL、对话框输入或认证文本时，在处理器返回前调用 `CEF3_设置事件返回文本`。',
    '- 高频事件由 Bridge 受控采样，回调不保证运行在 Win32 窗口线程；不要在事件处理器中执行长时间阻塞操作。',
    '',
    '## 统一事件目录',
    '',
    `目录统计：通知 ${kindCounts.notification} 项，同步决策 ${kindCounts.decision} 项，高频通知 ${kindCounts.highFrequency} 项。`,
    '',
    '| # | 中文事件名 | CEF 回调 | 旧设计器事件 ID | 分类 | 类型 | 说明 |',
    '|---:|---|---|---|---|---|---|'
  ];

  CEF3_BROWSER_EVENTS.forEach((event, index) => {
    lines.push([
      `| ${index + 1}`,
      escapeMarkdown(event.name),
      inlineCode(event.id),
      event.legacyDesignerId ? inlineCode(event.legacyDesignerId) : '-',
      escapeMarkdown(event.category),
      CEF3_KIND_LABELS[event.kind],
      `${escapeMarkdown(event.description)} |`
    ].join(' | '));
  });

  lines.push(
    '',
    '## 事件数据与决策约定',
    '',
    '- 事件正文和字段均由 Bridge 复制为 UTF-16 文本，不向 `.lcpp` 暴露 `CefRefPtr`、裸指针、STL 或 CEF 对象地址。',
    '- 常见字段包括 `url`、`frameId`、`statusCode`、`progress`、`commandId`；具体字段取决于已接通回调，未知字段返回空文本。',
    '- 普通通知异步投递到所属窗口；必须立即返回的决策事件同步投递。未设置结果时沿用该回调的 CEF 默认行为。',
    '- 事件目录以 CEF 150 windowed `CefBrowser` 为基线；当前随附 SDK、Bridge 和运行时仅支持 Windows x64。',
    '',
    '## 模块与接口总览',
    ''
  );
  renderModuleSummary(lines, modules);
  lines.push(
    '',
    `以下 ${commandCount} 条接口来自当前模块 manifest。模块详情、补全、诊断和 C++ binding 使用同一份清单。`,
    ''
  );
  renderCommandReference(lines, modules);
  lines.push(
    '',
    '## 受管读写流处理器',
    '',
    '传输模块提供基于受管缓冲的 `CefReadHandler`、`CefWriteHandler`、`CefStreamReader` 和 `CefStreamWriter`。完整生命周期、限制和 `.lcpp` 示例见 [受管读写流处理器专题](stream-handlers.md)。',
    'CEF3 DevTools Observer 的四个官方回调、订阅生命周期和动态协议 JSON 说明见 [DevTools Observer 用户指南](devtools-observer.md)。',
    '',
    '## 运行与安全边界',
    '',
    '- CEF3 模块族基于 CEF 150、C++20、MSVC 动态 CRT，并固定为 `windows-msvc-x64`。',
    '- 应用工程只包含 `LingBuilderCefBridge.h` 并链接 Bridge 导入库；应用层不得直接管理 CEF 生命周期或跨 DLL 释放对象。',
    '- 受管对象、任务和缓冲句柄必须用对应释放接口关闭；过期、类型错误或重复释放会返回稳定错误。',
    '- CEF3 的 CEF 150 与 FBro 进程内模式的 CEF 135 ABI 不兼容；只有全部 FBro 控件使用独立进程嵌入或独立进程窗口时才允许同项目启用。此时 FBro 运行时只物化到 `fbro-host/`，不得覆盖主程序目录中的 CEF3 运行时。',
    '',
    '## 相关来源',
    '',
    '- 事件目录：`electron/src/services/modules/cef3BrowserEvents.ts`',
    '- 模块清单：`electron/src/services/modules/builtinModules.ts`、`electron/src/services/modules/cef3Modules.ts`',
    '- 覆盖目录：`electron/src/services/modules/cef3ApiCoverage.generated.json`',
    '- 原生 Bridge：`electron/native/cef3-bridge/`',
    '',
    '## CEF 150 官方覆盖索引',
    '',
    `冻结基线：${inlineCode(CEF3_SAFE_API_BASELINE.cefVersion)} / ${inlineCode(CEF3_SAFE_API_BASELINE.platform)}。全部 ${CEF3_SAFE_API_CATALOG.length} 项官方签名已按功能域生成独立参考；每项保留真实实现状态，${inlineCode('planned')} 不会被描述为可调用。`,
    '',
    '| 功能域 | 模块 ID | 官方签名数 | 参考文档 |',
    '|---|---|---:|---|',
    ...CEF3_COVERAGE_DOMAINS.map(([moduleId, label, slug]) => {
      const count = CEF3_SAFE_API_CATALOG.filter(entry => entry.moduleId === moduleId).length;
      return `| ${label} | ${inlineCode(moduleId)} | ${count} | ${inlineCode(`${slug}.md`)} |`;
    }),
    '',
    `目录项数：${CEF3_BROWSER_EVENTS.length}；模块数：${modules.length}；用户接口数：${commandCount}。`,
    ''
  );

  return `${lines.join('\n')}\n`;
}

function renderCef3CoverageDocument(moduleId: string, label: string): string {
  const entries = CEF3_SAFE_API_CATALOG.filter(entry => entry.moduleId === moduleId);
  const counts = Object.fromEntries(['implemented', 'mapped', 'planned', 'internal', 'notApplicable'].map(status => [
    status,
    entries.filter(entry => entry.implementationStatus === status).length
  ]));
  const lines = [
    '<!-- 此文件由 electron/scripts/generate-cef3-fbro-event-docs.ts 生成，禁止手工维护第二份接口清单。 -->',
    `# CEF3 ${label}官方接口参考`,
    '',
    `模块 ID：${inlineCode(moduleId)}；CEF 基线：${inlineCode(CEF3_SAFE_API_BASELINE.cefVersion)}；共 ${entries.length} 项官方签名。`,
    '',
    `状态统计：implemented=${counts.implemented || 0}，mapped=${counts.mapped || 0}，planned=${counts.planned || 0}，internal=${counts.internal || 0}，notApplicable=${counts.notApplicable || 0}。`,
    '',
    '> `implemented` 才表示已有真实 Bridge 实现与测试定位。`planned` 是已分类的安全封装目标，不是当前可调用接口。',
    '',
    ...(CEF3_COVERAGE_NOTES[moduleId] || []).flatMap(note => [`- ${note}`, '']),
    '| # | 操作 ID | 中文映射 | 官方名/签名 | 编解码 | 线程/执行 | 所有权 | 状态 | 实现与测试 |',
    '|---:|---|---|---|---|---|---|---|---|'
  ];
  entries.forEach((entry, index) => {
    const locators = [entry.implementationLocator, entry.testLocator].filter(Boolean).map(inlineCode).join('<br>') || '-';
    const mapping = entry.wrapperSymbol ? `${inlineCode(entry.wrapperSymbol)}<br>${locators}` : locators;
    const commandNames: readonly string[] = (entry as unknown as {
      commandNames?: readonly string[];
    }).commandNames ?? [];
    const chineseMapping = commandNames.length > 0
      ? commandNames.map(name => escapeMarkdown(name)).join('<br>')
      : escapeMarkdown(entry.chineseName);
    lines.push([
      `| ${index + 1}`,
      inlineCode(entry.operationId),
      chineseMapping,
      `${inlineCode(entry.officialName)}<br>${inlineCode(entry.officialSignature)}`,
      `${entry.inputCodecs.map(inlineCode).join(', ') || '-'} → ${inlineCode(entry.outputCodec)}`,
      `${inlineCode(entry.thread)} / ${inlineCode(entry.execution)}`,
      inlineCode(entry.ownership),
      inlineCode(entry.implementationStatus),
      `${mapping} |`
    ].join(' | '));
  });
  lines.push('', '返回统一入口：`README.md`。', '');
  return `${lines.join('\n')}\n`;
}

function renderFbroFields(event: FbroEventDefinition): string {
  if (event.fields.length === 0) return '无';
  return event.fields.map(field => {
    const qualifiers = [
      field.nullable ? '可空' : '必填',
      field.direction === 'inout' ? '输入/输出' : '输入',
      field.ownership === 'bridgeCopiesOrManages' ? 'Bridge 管理' : '值复制'
    ].join('，');
    return `${inlineCode(field.name)}: ${inlineCode(field.type)} / ${inlineCode(field.sourceType)}（${qualifiers}）`;
  }).join('<br>');
}

function renderFbroResponse(event: FbroEventDefinition): string {
  if (Object.keys(event.responseSchema).length === 0) return '无';
  return inlineCode(JSON.stringify(event.responseSchema));
}

function renderFbroDocument(): string {
  const modules = familyModules('lingbuilder.fbro');
  const commandCount = countUserCommands(modules);
  const internalCommandCount = modules.reduce(
    (total, module) => total + (module.contributes?.commands || []).filter(command => command.visibility === 'internal').length,
    0
  );
  const managedEvents = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'managed');
  const internalEvents = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'internal');
  const notApplicableEvents = FBRO_EVENT_CATALOG.filter(event => event.exposure === 'notApplicable');
  const nonPublicEvents = FBRO_EVENT_CATALOG.filter(event => event.exposure !== 'public');
  const uniqueEventTokens = new Set(FBRO_EVENT_CATALOG.map(event => event.eventToken)).size;
  const lines = [
    '<!-- 此文件由 electron/scripts/generate-cef3-fbro-event-docs.ts 生成。请修改 FBro 事件目录或模块 manifest 后运行 npm run module:fbro-docs。 -->',
    '# FBro 模块事件与接口参考',
    '',
    `本参考从 FBro C ABI v3 事件目录和实际模块 manifest 自动生成。FBro 模块族当前包含 ${modules.length} 个模块、${FBRO_EVENT_CATALOG.length} 个类方法事件槽位、${uniqueEventTokens} 个唯一事件签名、${FBRO_PUBLIC_BROWSER_EVENTS.length} 项公开可绑定事件和 ${commandCount} 条面向用户的中文接口。`,
    '',
    '## 快速使用',
    '',
    '控件参数是裸 `controlRef`，处理器参数使用 `&处理器名`：',
    '',
    '```text',
    '绑定结果 = FBro_绑定事件(FBro浏览器1, "新窗口打开前", &处理新窗口)',
    '结束',
    '',
    '事件 处理新窗口()',
    '    目标地址 = FBro_取事件字段(FBro浏览器1, "target_url")',
    '    FBro_设置事件结果(FBro浏览器1, 2)',
    '    调试输出(目标地址)',
    '结束',
    '```',
    '',
    '- 事件名可使用中文名、官方英文名或登记的旧别名；运行时会归一化到稳定 `eventId`。',
    '- `FBro_取事件数据` 返回当前 UTF-16 JSON 事件包，`FBro_取事件字段` 读取单个字段。',
    '- 复杂同步响应使用 `FBro_设置事件响应JSON`；`FBro_设置事件结果` 和 `FBro_设置事件返回文本` 用于常见动作和文本返回值。',
    '- 延迟决策先用 `FBro_取事件延续` 取得受管延续句柄，再调用 `FBro事件_完成延续` 或 `FBro事件_取消延续`。延续只能完成一次。',
    '- 高频事件可用 `FBro_设置事件采样率` 调整每秒投递次数；`0` 表示暂停该事件。',
    '',
    '## 使用专题',
    '',
    '- [SDK 安装与环境检查](installation.md)：Windows x64、MSVC、FBro 135 SDK、Bridge 资产和首次构建检查。',
    '- [FBroBrowser 控件与进程模式](control.md)：设计器属性、`controlRef`、进程模式、缓存目录和多实例布局。',
    '- [FBro 示例与故障排查](examples.md)：单浏览器、多浏览器分组框示例、构建命令和常见错误。',
    '',
    '## 公开可绑定事件',
    '',
    `以下 ${FBRO_PUBLIC_BROWSER_EVENTS.length} 项事件属于 ${inlineCode('FBroHsBroEvent')} 且可由用户动态绑定。字段、响应 schema、默认动作、线程和超时均来自统一事件目录。`,
    '',
    '| # | 中文事件名 | 官方事件 | 稳定事件 ID / Token | 分类与类型 | 字段 | 响应 schema | 默认动作 / 超时 / 线程 |',
    '|---:|---|---|---|---|---|---|---|'
  ];

  FBRO_PUBLIC_BROWSER_EVENTS.forEach((event, index) => {
    const aliases = [...event.officialAliases, ...event.legacyAliases]
      .filter(alias => alias !== event.officialName);
    const official = aliases.length
      ? `${inlineCode(event.officialName)}<br>别名：${aliases.map(inlineCode).join('、')}`
      : inlineCode(event.officialName);
    const rate = event.maxHz > 0 ? `<br>默认采样：${event.maxHz} Hz` : '';
    lines.push([
      `| ${index + 1}`,
      escapeMarkdown(event.lingBuilderName),
      official,
      `${inlineCode(event.eventId)}<br>${inlineCode(event.eventToken)}`,
      `${escapeMarkdown(event.category)} / ${FBRO_KIND_LABELS[event.kind]}`,
      renderFbroFields(event),
      renderFbroResponse(event),
      `${FBRO_DEFAULT_ACTION_LABELS[event.defaultAction]} / ${event.timeoutMilliseconds} ms / ${inlineCode(event.thread)}${rate} |`
    ].join(' | '));
  });

  lines.push(
    '',
    '## Bridge 托管、内部与不适用事件',
    '',
    `其余 ${nonPublicEvents.length} 个类方法槽位不会作为用户可绑定事件出现：Bridge 托管 ${managedEvents.length} 项、内部事件 ${internalEvents.length} 项、不适用 ${notApplicableEvents.length} 项。它们保留在统一目录中用于覆盖审计，不能静默消失。`,
    '',
    '| # | 所属类 | 官方方法 | 稳定事件 ID / Token | 分类 | 原因 |',
    '|---:|---|---|---|---|---|'
  );

  nonPublicEvents.forEach((event, index) => {
    lines.push([
      `| ${index + 1}`,
      inlineCode(event.ownerClass),
      inlineCode(event.officialName),
      `${inlineCode(event.eventId)}<br>${inlineCode(event.eventToken)}`,
      FBRO_EXPOSURE_LABELS[event.exposure],
      `${escapeMarkdown(event.classificationReason)} |`
    ].join(' | '));
  });

  lines.push(
    '',
    '## 事件协议与安全约定',
    '',
    '- C ABI v3 只传递版本化事件包、UTF-16 JSON、POD、整数实例句柄、类型化对象句柄和受管延续句柄。原始 FBro/CEF 对象地址不会跨 DLL。',
    '- 即时决策必须在处理器返回前设置结果；延迟决策按目录使用 5 秒、30 秒或 120 秒等超时。超时后执行目录中的默认动作。',
    '- `managedHandle` 字段只能交给对应 FBro 受管对象接口；不要持久化或把句柄当作内存地址。',
    '- `responseSchema` 是 Bridge 接受的完整响应对象约束；未声明的字段会被拒绝，字段类型必须与 schema 一致。',
    '',
    '## 模块与接口总览',
    ''
  );
  renderModuleSummary(lines, modules);
  lines.push(
    '',
    `以下 ${commandCount} 条接口来自当前模块 manifest。另有 ${internalCommandCount} 条 Bridge 自动管理或凭据安全替代命令标记为 ${inlineCode('internal')}，不进入本用户接口目录，也不进入 Monaco 普通补全。`,
    ''
  );
  renderCommandReference(lines, modules);
  lines.push(
    '',
    '## 运行、授权与兼容边界',
    '',
    '- FBro 固定使用 CEF 135 x64、MSVC 和 Windows；模块 target 为 `windows-msvc-x64`。',
    '- FBro VIP 能力需要用户自己的有效授权。密钥由 IDE 凭据中心加密保存，只向受控运行进程临时注入；不要把密钥写入源码、模块包、日志或 AI 上下文。',
    '- `processMode` 支持 `in-process`、`independent-embedded`、`independent-window`。两种独立模式实行一浏览器一 Host 进程，通过随机回环 WebSocket 和一次性 Token 控制，并为每个实例分配独立 profile、CEF 根缓存、日志目录与 CDP 端口。new_emoji 后端非阻塞启动 Host，在真实 `Created` 事件后按 Tabs 当前索引同步 HWND 显隐。',
    '- FBro 进程内模式与 CEF3 的 CEF 150 ABI 不兼容；全部 FBro 控件独立时允许共存，CEF 135 和 FBro Bridge 只复制到 `fbro-host/`。',
    '- 独立模式当前覆盖核心导航、JS、缩放、静音、代理、指纹、显隐、尺寸、截图、关闭和进程管理；高级 Frame、Cookie、对象、任务和 VIP 单项 API 尚未全部远程化。',
    '- 应用工程只包含 `LingBuilderFbroBridge.h` 并链接 Bridge 导入库；不得跨 DLL 传递或释放 STL、`CefRefPtr`、FBro 对象或裸指针。',
    '',
    '## 相关来源',
    '',
    '- 事件目录：`electron/src/services/modules/fbroEventCatalog.ts`、`electron/src/services/modules/fbroApiCoverage.generated.json`',
    '- 模块清单：`electron/src/services/modules/builtinModules.ts`、`electron/src/services/modules/fbroModules.ts`、`electron/src/services/modules/fbroVipApiCatalog.ts`',
    '- 原生 Bridge：`electron/native/fbro-bridge/`',
    '',
    `类方法事件槽位：${FBRO_EVENT_CATALOG.length}；唯一事件签名：${uniqueEventTokens}；公开事件：${FBRO_PUBLIC_BROWSER_EVENTS.length}；Bridge 托管：${managedEvents.length}；内部事件：${internalEvents.length}；不适用：${notApplicableEvents.length}；模块数：${modules.length}；用户接口数：${commandCount}。`,
    ''
  );

  return `${lines.join('\n')}\n`;
}

const documents: Record<DocumentTarget, Array<{ outputPath: string; content: string; label: string }>> = {
  cef3: [{
    outputPath: path.resolve(scriptDirectory, '../docs/modules/cef3/README.md'),
    content: renderCef3Document(),
    label: 'CEF3'
  }, ...CEF3_COVERAGE_DOMAINS.map(([moduleId, label, slug]) => ({
    outputPath: path.resolve(scriptDirectory, `../docs/modules/cef3/${slug}.md`),
    content: renderCef3CoverageDocument(moduleId, label),
    label: `CEF3 ${label}`
  }))],
  fbro: [{
    outputPath: path.resolve(scriptDirectory, '../docs/modules/fbro/README.md'),
    content: renderFbroDocument(),
    label: 'FBro'
  }]
};

for (const target of targets) {
  for (const document of documents[target]) {
    if (checkOnly) {
      try {
        const existing = await fs.readFile(document.outputPath, 'utf8');
        if (existing !== document.content) {
          console.error(`${document.label} 事件与接口参考已过期：${document.outputPath}`);
          process.exitCode = 1;
        } else {
          console.log(`${document.label} 事件与接口参考已同步。`);
        }
      } catch (error) {
        console.error(`无法读取 ${document.label} 事件与接口参考：${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    } else {
      await fs.mkdir(path.dirname(document.outputPath), { recursive: true });
      await fs.writeFile(document.outputPath, document.content, 'utf8');
      console.log(`已生成 ${document.label} 事件与接口参考：${document.outputPath}`);
    }
  }
}
