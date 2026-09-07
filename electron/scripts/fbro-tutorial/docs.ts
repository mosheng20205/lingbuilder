import fs from 'node:fs';
import path from 'node:path';
import { EPISODES } from './projects.ts';
import { MODULE_NAMES } from './episodes.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const ROOT = path.join(repoRoot, 'AI 视频自主生产', 'FBro 指纹浏览器合集');

// 每集的录制映射、命令清单与边界说明（与口播稿 S1~S7 对齐）
const DOC = {
  'fbro-ep01-embed': {
    no: '01', script: '口播稿-FBro入门.md',
    goal: '用一个 FBro 指纹浏览器控件 + 一行 FBro_导航 完成进程内嵌入。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '启用模块', '模块面板启用 `lingbuilder.fbro.browser`（本项目已在 `.lingbuilder/project-modules.json` 中固定）'],
      ['S3', '拖控件', '设计器「浏览器控件」分组 → `FBro指纹浏览器`，对应控件 `浏览器1`'],
      ['S4', '一行导航 + F5', '`src/FBro入门窗体.lcpp` 创建完毕事件中的 `FBro_导航(浏览器1, "https://www.baidu.com")`'],
      ['S5', '能力速览三卡', 'Remotion 合成，无需运行'],
      ['S6', 'SDK 提示', '复用通用 SDK 下载素材'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_绑定事件', 'FBro_导航', 'FBro_是否加载中', 'FBro_取地址', 'FBro_取标题', 'FBro_取事件字段'],
    notes: [
      '控件随窗口自动创建，不需要调用 `FBro_创建`。',
      '演示地址使用百度首页（与口播稿一致）；本集是全合集里唯一依赖外网的常规镜头。'
    ]
  },
  'fbro-ep02-manager': {
    no: '02', script: '口播稿-浏览器管理器.md',
    goal: '用浏览器管理器统一编排多个 FBro 实例：实例列表、页面选项卡、地址栏与下载视图。',
    shots: [
      ['S1', '标题卡', '左侧 `实例列表` 与右侧 `页面选项卡` 同框'],
      ['S2', '准备界面', '设计器中的 `页面选项卡 / 实例列表 / 地址栏 / 下载详情 / 下载进度`'],
      ['S3', '初始化管理器', '`浏览器管理器_初始化(页面选项卡, 实例列表, "fbro-ep02-demo")`'],
      ['S4', '新增与切换', '按钮「新增实例」「切换到第一个」'],
      ['S5', '地址和进度', '`浏览器管理器_绑定地址栏` 与 `浏览器管理器_绑定下载视图`'],
      ['S6', '持久化与清理', '关闭重开后实例顺序恢复；按钮「删除当前实例」传 `假` 只删表项'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['浏览器管理器_初始化', '浏览器管理器_绑定地址栏', '浏览器管理器_绑定下载视图', '浏览器管理器_新增实例', '浏览器管理器_切换索引', '浏览器管理器_导航', '浏览器管理器_删除当前', '浏览器管理器_取实例数量', '浏览器管理器_取当前名称', '浏览器管理器_取当前地址', '浏览器管理器_取当前下载状态'],
    notes: [
      '管理器绑定的是普通 Win32 控件，不是 `FBroBrowser` 控件；本项目没有 FBro 浏览器控件。',
      '**实测**：`浏览器管理器_初始化` 会自动补一个名为「浏览器 1」的默认实例，其内置默认地址由管理器运行时决定，并非本教程页面。项目在初始化后显式调用 `浏览器管理器_导航(本地测试页)` 覆盖它；录制时请确认画面上不会出现无关站点。',
      '实例列表行尾可能出现「插件缺失：插件目录不存在或不可访问。」——这是管理器对可选插件目录的提示，不影响演示，录制时可裁掉。'
    ]
  },
  'fbro-ep03-isolation': {
    no: '03', script: '口播稿-会话隔离.md',
    goal: '两个独立缓存目录 + 独立 UserAgent 的实例，演示会话隔离与受控清理。',
    shots: [
      ['S1', '双实例并排', '`工作区A` / `工作区B` 两个 FBro 控件'],
      ['S2', '独立缓存目录', '属性面板「独立缓存目录」= `.fbro/ep03-workspace-a` / `-b`'],
      ['S3', '用户代理', '属性面板「User-Agent 标识」= `LingBuilder-FBro-Demo/WorkspaceA` / `WorkspaceB`'],
      ['S4', '工作区键', '本集不使用管理器；工作区键口径见第 02、11 集'],
      ['S5', '验证隔离', '两个实例各自加载本地测试页，按钮「读取站点数据」只输出长度'],
      ['S6', '清理范围', '按钮「清理指定站点数据」「清理工作区A缓存」'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_绑定事件', 'FBro_导航', 'FBro会话_取Cookie', 'FBro会话_清空Cookie', 'FBro会话_异步清理缓存'],
    notes: [
      '缓存目录与 UserAgent 都是创建期配置，已写在设计器属性里，运行期不再修改。',
      '站点数据只输出字符长度，绝不把内容打到日志或画面上。'
    ]
  },
  'fbro-ep04-fingerprint': {
    no: '04', script: '口播稿-指纹配置.md',
    goal: '在授权测试环境演示结构化指纹配置入口、脱敏授权状态与失败诊断。',
    shots: [
      ['S1', '安全标题卡', '无需项目操作'],
      ['S2', '授权前置', '按钮「读取授权状态」，只显示脱敏字段长度，不显示内容'],
      ['S3', '结构化配置', '按钮「应用脱敏配置」，夹具内联在 `.lcpp` 中且仅含演示字段'],
      ['S4', '查看结果', '按钮「读取已应用配置」'],
      ['S5', '创建时机', '口播说明；UserAgent/缓存目录属创建期配置'],
      ['S6', '失败诊断', '按钮「故意用无效配置」，展示返回码 + `FBro_取最近错误`'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBroVIP_取授权信息JSON', 'FBro指纹_应用配置', 'FBroVIP_取已应用配置JSON', 'FBro指纹_取调用次数', 'FBro_取最近错误'],
    notes: [
      '**授权注入方式（实测）**：FBro Bridge 在启动时读取环境变量 `LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE`（或 `LINGBUILDER_FBRO_VIP_KEY`），读取后立即从进程环境中清除。授权码只在运行环境注入，**不写入项目、源码、日志、截图或字幕**。',
      '**实测（重要）**：未授权环境下调用 `FBroVIP_取授权信息JSON()` 会让程序直接退出。本示例因此**不调用**该命令，改用 `FBro指纹_取调用次数` + `FBroVIP_取已应用配置JSON` 这两个不会崩溃的脱敏入口来展示状态；已在源码注释中写明原因。',
      '**实测**：`FBro指纹_应用配置` 的返回值**非 0 表示成功、0 表示未生效**，不要按「0 即成功」理解。已授权环境下脱敏夹具返回 1；残缺 JSON 返回 0。',
      '**实测**：残缺 JSON 返回 0 时，当前版本不一定给出中文诊断文本，`FBro_取最近错误` 可能为空；口播只能说「未生效」，不能承诺一定有诊断信息。',
      '没有有效授权时，本示例只展示返回码与最近错误，不伪造「配置已生效」。',
      '口播稿中的 `FBro指纹_应用配置` 与模块清单一致；`FBroVIP_*` 为 FBro VIP 指纹模块提供的脱敏读取入口。'
    ]
  },
  'fbro-ep05-hostmode': {
    no: '05', script: '口播稿-三种宿主模式.md',
    goal: '并列展示进程内嵌入、独立进程嵌入、独立顶层窗口三种宿主模式。',
    shots: [
      ['S1', '三模式卡', '三个 FBro 控件并排'],
      ['S2', '进程内嵌入', '`进程内浏览器`（`processMode: in-process`）'],
      ['S3', '独立进程嵌入', '`独立进程浏览器`（`independent-embedded`）'],
      ['S4', '独立顶层窗口', '`独立窗口浏览器`（`independent-window`）'],
      ['S5', '生命周期取舍', '按钮「刷新进程状态」输出三者的进程状态 / 进程 ID / 调试端口'],
      ['S6', 'ABI 与 Chrome UI', '按钮「打开谷歌原生 UI」；FBro=CEF 135，CEF3=CEF 150，进程内不可混用'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_取进程状态', 'FBro_取进程ID', 'FBro_取调试端口', 'FBro_打开谷歌原生UI浏览器'],
    notes: [
      '进程内模式没有独立调试端口，`FBro_取调试端口` 返回 0 属于预期。',
      '**实测**：三个浏览器会拉长首帧时间，冷缓存下主窗口可能十几秒后才出现；录制前先空跑一次让缓存变热。三种模式在同一窗口内并存已实测可用。',
      '**实测**：强制结束主程序时，`LingBuilderFbroHost` 与 `FBroSubprocess` 不会自动回收，会占用 `bin/.fbro/**` 导致下次构建报 `EBUSY`。请用窗口关闭按钮正常退出，或在清理步骤里一并结束这两类进程。'
    ]
  },
  'fbro-ep06-events': {
    no: '06', script: '口播稿-事件驱动.md',
    goal: '绑定导航、弹窗与加载事件，读取事件字段，演示同步决策与采样率。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '绑定事件', '`FBro_绑定事件(浏览器1, "导航请求前", &处理导航请求前)`，处理器必须带 `&`'],
      ['S3', '读取事件数据', '`FBro_取事件数据` / `FBro_取事件字段`'],
      ['S4', '同步决策', '「导航请求前」「标签页打开地址请求」用 `FBro_设置事件结果` 返回 1 继续 / 2 取消'],
      ['S5', '弹窗与延迟', '「新窗口打开前」按测试策略取消；延迟决策口径见代码尾注'],
      ['S6', '高频事件', '按钮「暂停高频事件」把「加载进度改变」采样率设为 0'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_绑定事件', 'FBro_取事件字段', 'FBro_取事件数据', 'FBro_设置事件结果', 'FBro_设置事件采样率'],
    notes: [
      '**字段实名（按 Bridge 实测）**：「导航请求前」只提供 `browser / frame / request / user_gesture / is_redirect`，**没有目标 URL 字段**；需要按地址决策请用「标签页打开地址请求」的 `target_url` 或「新窗口打开前」的 `url`。',
      '高频事件必须先显式订阅才会投递，采样率 0 表示暂停。'
    ]
  },
  'fbro-ep07-resource': {
    no: '07', script: '口播稿-获取资源响应.md',
    goal: '加载本地测试页，观察资源响应到达与资源加载完成两个公开事件。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '准备测试页', '`assets/` 内的 index.html / style.css / app.js / logo.svg；运行时会写到 exe 同级 `演示页面/`'],
      ['S3', '绑定资源响应', '`FBro_绑定事件(浏览器1, "资源响应到达", &处理资源响应)`'],
      ['S4', '输出公开字段', '`资源日志` 列表框输出 frame 与完整事件包 JSON'],
      ['S5', '加载完成统计', '「资源加载完成」的 `status` 与 `received_content_length`'],
      ['S6', '能力边界卡', '见下方「与口播稿的差异」'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_绑定事件', 'FBro_取事件字段', 'FBro_取事件数据', 'FBro_设置事件结果'],
    notes: [
      '**字段勘误（口播稿已于 2026-09-05 据此改写）**：初稿与选题列表写的 `FBro_取事件字段(浏览器1, "statusCode")`、`"mimeType"`、`"receivedBytes"` 在 FBro 上**不存在**。按 `electron/native/fbro-bridge/FbroEventOverrides.generated.inc` 实测：',
      '- 「资源响应到达」(`OnResourceResponse`) 实际字段只有 `browser`、`frame`（帧地址）、`request`、`response`（后两者是「是否存在」的 0/1 标记）。',
      '- 「资源加载完成」(`OnResourceLoadComplete`) 额外提供 `status`（URLRequestStatus 整数）与 `received_content_length`（接收字节数），字段名不是 `receivedBytes`。',
      '- `statusCode` / `mimeType` 是 **CEF3 模块**的字段（见 `lingCppWin32Project.ts` 的 CEF3 处理器），FBro Bridge 不提供。',
      '本集按实际字段演示，并保留「当前公开接口不暴露响应正文与响应头对象」的既定边界。口播稿已于 2026-09-05 按上述实测字段改写，稿内附勘误对照表。'
    ]
  },
  'fbro-ep08-cdp': {
    no: '08', script: '口播稿-CDP自动化.md',
    goal: '独立进程嵌入 + 开发者工具，取本机调试端口后用 CDP 完成取标题、查询元素与点击。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '先配宿主模式', '`浏览器1` 属性：`processMode = independent-embedded`、`enableDevTools = true`'],
      ['S3', '取得调试端口', '按钮「读取调试端口」→ `FBro_取调试端口`，输出 `http://127.0.0.1:<端口>`'],
      ['S4', '连接 CDP', '按钮「连接 CDP」→ `CDP_连接` → 就绪后 `CDP_附加页面(连接, "about:blank", …)`'],
      ['S5', '读取与点击', '按钮「读取页面标题」「查询并点击按钮」'],
      ['S6', '边界和清理', '按钮「断开并清理」'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro_取调试端口', 'CDP_连接', 'CDP_附加页面', 'CDP_打开网址', 'CDP_取页面标题', 'CDP_查询元素', 'CDP_点击元素', 'CDP_执行脚本', 'CDP_关闭页面', 'CDP_断开连接'],
    notes: [
      '**实测链路**：附加的是 Host 里已存在的 `about:blank` 页，再用 `CDP_打开网址` 导航到本地测试页。这样不依赖 FBro 侧导航时机，链路确定；直接用 file:// 前缀去 `CDP_附加页面` 会因为页面尚未导航而附加失败。',
      '独立进程 Host 启动较慢，冷缓存下主窗口可能 15~60 秒后才出现，端口也要等 Host 起来后才非 0。',
      'CDP 只连本机回环；只自动化自有测试页，不用于绕过任何网站规则。'
    ]
  },
  'fbro-ep09-form': {
    no: '09', script: '口播稿-网页填表.md',
    goal: '用 CDP 在自有测试表单上完成文本输入、下拉选择、复选、单选与提交结果校验。',
    shots: [
      ['S1', '标题卡与测试表单', '`assets/form.html`，运行时写到 exe 同级 `演示表单/`'],
      ['S2', '准备测试表单', '选择器 `#name` `#city` `#interest-email` `#contact-phone` `#submit` `#result`'],
      ['S3', '输入文本', '按钮「填写姓名」→ `CDP_查询元素` + `CDP_输入文本`（写入中文「测试用户」）'],
      ['S4', '选择下拉和单选', '按钮「选择城市与联系方式」→ `CDP_执行脚本` 设值并派发 change，`CDP_点击元素` 点单选'],
      ['S5', '勾选与提交', '按钮「勾选并提交」'],
      ['S6', '校验结果', '按钮「读取提交结果」→ `CDP_取元素文本(#result)`'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['CDP_连接', 'CDP_附加页面', 'CDP_打开网址', 'CDP_查询元素', 'CDP_输入文本', 'CDP_执行脚本', 'CDP_点击元素', 'CDP_取元素文本'],
    notes: [
      '文本输入用 `CDP_输入文本`（先聚焦再逐字符输入），不用可能丢值的直插文本。',
      '只操作本地测试表单，不涉及真实账号、密码、验证码、支付，也不绕过任何网站限制。'
    ]
  },
  'fbro-ep10-transfer': {
    no: '10', script: '口播稿-下载截图打印.md',
    goal: '演示下载、截图、PDF、打印与受管文件对话框，并在结束后清理临时产物。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '开始下载', '按钮「下载测试文件」→ `FBro传输_开始下载`'],
      ['S3', '观察进度', '「下载开始」「下载进度更新」事件写入 `传输日志`'],
      ['S4', '截图', '按钮「截图到文件」→ `FBro_截图到文件(浏览器1, "演示输出/页面截图.png", "png", 90)`'],
      ['S5', '打印与 PDF', '按钮「生成 PDF」（异步任务）与「打开打印流程」（系统对话框）'],
      ['S6', '文件对话框和清理', '按钮「受管文件对话框」「清理演示产物」'],
      ['S7', '尾板预告', '无需项目操作']
    ],
    commands: ['FBro传输_开始下载', 'FBro_截图到文件', 'FBro传输_异步生成PDF', 'FBro传输_打印', 'FBro传输_异步打开文件对话框', 'FBro任务_等待', 'FBro任务_取结果', 'FBro任务_释放'],
    notes: [
      '所有产物写入 exe 同级 `演示输出/`，演示结束请点「清理演示产物」。',
      '「打开打印流程」和「受管文件对话框」会弹出系统模态对话框，自动化脚本不点这两个按钮，录制时手动演示并及时关闭。',
      '下载地址使用百度首页（公开、可重复）；本集下载镜头需要网络。'
    ]
  },
  'fbro-ep11-workbench': {
    no: '11', script: '口播稿-FBro综合项目.md',
    goal: '收官项目：实例管理、会话隔离、事件日志、资源响应摘要、CDP 自动化与下载反馈串成一个工具。',
    shots: [
      ['S1', '标题卡', '无需项目操作'],
      ['S2', '设计器布局', '左侧实例列表、顶部地址栏、中部选项卡 + 独立进程浏览器、底部下载视图与工作日志'],
      ['S3', '初始化和实例', '`浏览器管理器_初始化` + 按钮「新增工作区」'],
      ['S4', '会话与事件', '「导航请求前」「新窗口打开前」写入 `工作日志`'],
      ['S5', '资源响应摘要', '「资源响应到达」累计计数写入状态标签'],
      ['S6', 'CDP 和下载', '按钮「连接 CDP 并取标题」「CDP 点击测试按钮」「下载测试文件」'],
      ['S7', 'F5 构建与收尾', '真实构建、错误列表 0、清理测试数据'],
    ],
    commands: ['浏览器管理器_初始化', '浏览器管理器_绑定地址栏', '浏览器管理器_绑定下载视图', '浏览器管理器_新增实例', '浏览器管理器_切换索引', '浏览器管理器_导航', '浏览器管理器_清理当前缓存', 'FBro_绑定事件', 'FBro_取事件字段', 'FBro_设置事件结果', 'FBro_取调试端口', 'CDP_连接', 'CDP_附加页面', 'CDP_打开网址', 'CDP_取页面标题', 'CDP_查询元素', 'CDP_点击元素', 'FBro传输_开始下载'],
    notes: [
      '本集同时使用「浏览器管理器」托管的实例和一个独立进程嵌入的 `浏览器1`：前者负责多工作区，后者负责事件与 CDP。',
      '资源响应摘要按第 07 集的实测字段口径，只做计数与公开字段展示，不宣称能读正文。',
      '收尾清理必须包含：关闭窗口、结束 `LingBuilderFbroHost` / `FBroSubprocess`、删除 `bin/演示页面`、`bin/.fbro/**` 测试 Profile。'
    ]
  }
};

const COMMON_PREREQ = [
  'Windows x64 + Visual Studio / MSVC 工具链（`cl` 可用）。',
  '已安装并通过校验的 FBro 环境 SDK（`lingbuilder.fbro.sdk`，CEF 135 x64）。命令行构建时可用 `FBRO_SDK_ROOT` 指向 SDK 目录。',
  '`bin` 目录需包含 `LingBuilderFbroBridge.dll`、`FBroSubprocess.exe`、`libcef.dll` 等运行时（构建会自动复制）。'
];

const COMMON_SAFETY = [
  '全程不得出现授权码、Permit、Key、真实账号、Cookie 明文或代理密码。',
  '只使用本地测试页与公开测试地址，不演示登录、验证码、支付、绕过检测或规避风控。',
  '录制素材、日志与截图不保留任何个人数据。'
];

function readme(ep, d) {
  const wsRel = `AI 视频自主生产/FBro 指纹浏览器合集/${ep.dir}/示例项目/${ep.id}`;
  return `# ${ep.name}

对应《FBro 指纹浏览器合集》第 ${d.no} 集，口播稿：\`../${d.script}\`。

**本集目标**：${d.goal}

## 打开与运行

1. 在 LingBuilder 中打开 \`.lingbuilder/solution.json\`。
2. 确认模块面板已启用下列模块（项目已固定版本，见 \`.lingbuilder/project-modules.json\`）。
3. 按 F5 构建运行，确认错误列表为 0。

### 启用模块

| 模块 ID | 名称 | 固定版本 |
| --- | --- | --- |
${ep.modules.concat(ep.extraModules || []).map(id => `| \`${id}\` | ${MODULE_NAMES[id][0]} | ${MODULE_NAMES[id][1]} |`).join('\n')}

## 口播分段 → 项目对应物

| 段 | 内容 | 项目中的对应位置 |
| --- | --- | --- |
${d.shots.map(([s, t, w]) => `| ${s} | ${t} | ${w} |`).join('\n')}

## 本集命令

${d.commands.map(c => `- \`${c}\``).join('\n')}

## 实测说明与边界

${d.notes.map(n => n.startsWith('-') ? n : `- ${n}`).join('\n')}

## 前置条件

${COMMON_PREREQ.map(p => `- ${p}`).join('\n')}

## 命令行构建

\`\`\`bash
cd electron
FBRO_SDK_ROOT=<FBro SDK 目录> node dist/cli.cjs project build \\
  --request "../${wsRel}/build-request.json" \\
  --workspace "../${wsRel}" --yes --json
\`\`\`

构建产物在 \`.lingbuilder-build/${ep.id}/\`（\`bin/LingBuilderPreview.exe\`），可复制工程在 \`generated/cpp/\`；这两个目录都是生成物，不要当作源码提交或改动。

## 安全红线

${COMMON_SAFETY.map(s => `- ${s}`).join('\n')}
`;
}

function runbook(ep, d) {
  return `# 录制准备记录 · 第 ${d.no} 集《${ep.name}》

## 录制前置检查

- [ ] 工作区路径可用；命令行构建已跑通、错误列表为 0。
- [ ] FBro 环境 SDK 已安装并校验通过。
- [ ] **确认本机没有其它 FBro 程序在跑**：任务管理器里 \`LingBuilderPreview\`、\`LingBuilderFbroHost\`、\`FBroSubprocess\` 必须为 0。同机并存的 FBro 实例会让新启动的程序主窗口长时间不显示（本集实测结论）。
- [ ] 已**空跑一次** exe 让 FBro 缓存变热：冷缓存下主窗口首帧可能要等十几秒。
- [ ] 演示环境已授权（VIP Permit），但授权码只存在于运行环境变量，不入镜、不入日志。
- [ ] 关闭「模块公开信息」弹窗，避免遮挡工具栏。
- [ ] 底部面板默认折叠；\`.lcpp\` 代码镜头使用新手模式。
${d.no === '08' || d.no === '09' || d.no === '11' ? '- [ ] `浏览器1` 属性确认：`processMode = independent-embedded`、`enableDevTools = true`。\n' : ''}
## 采集画幅

- 设计器 / 面板纯操作镜头：\`1280 × 720 DIP\`。
- 含 \`.lcpp\` 代码的镜头：**≥ \`1920 × 1080 DIP\`**，验收标准是单帧完整容纳一个事件块。

## 拍摄顺序

${d.shots.map(([s, t, w]) => `- **${s} ${t}**：${w}`).join('\n')}

## 运行镜头注意

- exe 启动后至少存活 3 秒再收尾；网页内容出现后再切镜头。
- 原生 exe 窗口内的点击/输入需要系统级鼠标键盘自动化，CDP 只能驱动 IDE 侧。
- 列表框日志滚动较快时，先点「清空日志」再演示单条链路。

## 收尾清理（必做）

1. 用窗口关闭按钮正常退出程序，让 FBro 走完关闭流程。
2. 确认 \`LingBuilderPreview\`、\`LingBuilderFbroHost\`、\`FBroSubprocess\` 三类进程都已退出；强杀会残留 Host 并锁住 \`bin/.fbro/**\`，导致下次构建报 \`EBUSY\`。
3. 删除演示产物：\`bin/演示页面\`、\`bin/演示表单\`、\`bin/演示输出\`、\`bin/.fbro/**\`。
4. 不要删除用户自己的工作区或 SDK 目录。

## 待录制当天终检

- [ ] 口播稿实名与当前界面/补全一致（尤其命令名与事件名）。
- [ ] 错误列表为 0 的画面可复现。
${d.no === '07' ? '- [x] 口播稿已于 2026-09-05 按实测字段改写（稿内含勘误对照表）；开拍前只需再核对当天运行输出与勘误表一致。\n' : ''}`;
}

export function writeEpisodeDocs(): number {
  let count = 0;
  for (const ep of EPISODES) {
    const d = DOC[ep.id];
    if (!d) { console.warn('缺少文档定义', ep.id); continue; }
    const base = path.join(ROOT, ep.dir, '示例项目', ep.id);
    fs.writeFileSync(path.join(base, 'README.md'), readme(ep, d), 'utf8');
    fs.writeFileSync(path.join(base, '录制准备记录.md'), runbook(ep, d), 'utf8');
    count += 2;
  }
  return count;
}
