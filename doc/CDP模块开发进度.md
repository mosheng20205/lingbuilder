# CDP 模块开发进度

> 本文档是 CDP 客户端模块（`lingbuilder.cdp.client`）的跨会话交接记录，用于防止后续会话失忆。能力全景与逐阶段验收门禁见 `doc/CDP模块开发.md`；本文只记录"做到哪了、怎么做的、还剩什么、有哪些坑"。
>
> 最后更新：2026-08-22（阶段 3 第一批地基已落地，尚未完成）

## 一、当前状态总览

| 阶段 | 状态 | 说明 |
|---|---|---|
| 阶段 0 规划文档 | ✅ 完成 | `doc/CDP模块开发.md` 已升级为商业全场景能力全景 + 三阶段计划 |
| 阶段 1 会话内核 + 基础自动化 | ✅ 完成 | 58 条命令基线，真实 Edge headless 端到端验证通过（2026-08-22） |
| 阶段 2 商业增量 | ✅ 完成 | 模块升级 `2.0.0` / 97 条命令 / 4 个受管类型；真实 Edge headless Win32+x64 smoke 通过（2026-08-22） |
| 阶段 3 高阶 | 🚧 实施中 | 模块清单暂升 `3.0.0` / 144 条命令 / 14 个受管类型；Target/Session、binding、Debugger、Storage、证书安全与录制地基已生成并通过双架构编译，screencast、完整性能任务和确定性回放仍未完成 |

模块形态：**内置 v2 网络模块**（不是外置 `.lbmod`），与 http-client/websocket-client 同族，注册在 `networkLibraryModules.ts`，自动获得 Win32 与 new_emoji 双后端支持（`uiBackendCommandContract.ts` 的 `BACKEND_NEUTRAL_BUILTIN_MODULE_IDS`）。

## 二、阶段 1 已交付内容

### 2.1 关键文件地图

| 文件 | 职责 |
|---|---|
| `electron/src/services/modules/cdpClientModule.ts` | 模块清单：58 条命令 specs + 3 个公开类型（`CDP连接`/`CDP页面`/`CDP元素`，均为 `long long` 受管句柄）+ targets（win32/x64，`winhttp.lib`+`crypt32.lib`，define `LINGBUILDER_CDP_CLIENT_MODULE`）+ docs/snippets |
| `electron/src/services/windowDesigner/cdpClientRuntime.ts` | C++ 运行时文本，三段 `String.raw`：`CDP_JSON_RUNTIME`（零依赖 `LingCdpJson` 解析/序列化）+ `CDP_CLIENT_RUNTIME`（`class LingCdpRuntime` 会话内核）+ `CDP_CLIENT_WINDOW_METHODS`（58 个中文包装方法，win32 成员版与 new_emoji 全局版共用同一段文本做前缀替换） |
| `electron/docs/modules/cdp-client/README.md` | 模块正式文档（`contributes.docs` 指向它），含安全边界与已知限制 |
| `electron/tests/cdpClientRuntime.test.ts` | 生成回归：清单完整性/双后端注入/未启用隔离，4 个 test |
| `electron/scripts/smoke-cdp-native.ts` | 真实浏览器端到端 smoke，`npm run smoke:cdp-native` |
| `electron/src/services/modules/networkLibraryModules.ts` | 模块注册点（加在 `HTTP_CLIENT_MODULE` 之后） |
| `electron/src/services/windowDesigner/lingCppWin32Project.ts` | 生成器注入（见 2.3） |
| `electron/package.json` | `"smoke:cdp-native": "tsx scripts/smoke-cdp-native.ts"` |

**注意：不要把模块注册进 `builtinModules.ts` 的数组**——它经 `NETWORK_LIBRARY_MODULES` 展开进入；双处注册会重复。

### 2.2 阶段 1 命令基线（58 条，按分类；阶段 2 后总数为 97）

- **连接（8）**：`CDP_连接`(回环限制)、`CDP_连接远程`(advanced)、`CDP_断开连接`、`CDP_取连接数量`、`CDP_是否已连接`、`CDP_取连接状态`、`CDP_取浏览器版本`、`CDP_绑定连接事件`
- **页面（9）**：`CDP_附加页面`(/json/list 匹配)、`CDP_新建页面`、`CDP_关闭页面`、`CDP_激活页面`、`CDP_取页面数量`、`CDP_取页面网址`(缓存)、`CDP_取页面标题`(异步)、`CDP_取页面HTML`(异步)、`CDP_绑定页面事件`
- **导航（5）**：`CDP_打开网址`(等 loadEventFired)、`CDP_刷新页面`、`CDP_后退页面`、`CDP_前进页面`、`CDP_停止加载`
- **脚本（1）**：`CDP_执行脚本`(awaitPromise+returnByValue，异常中文诊断)
- **元素（6）**：`CDP_查询元素`(同步创建引用存 pageId+选择器)、`CDP_点击元素`(scrollIntoView+getBoundingClientRect 中心+mousePressed/Released)、`CDP_输入文本`(focus evaluate→逐字符 char 键事件)、`CDP_取元素文本`、`CDP_取元素属性`、`CDP_取元素数量`
- **输入（8）**：`CDP_鼠标移动`、`CDP_鼠标单击`、`CDP_鼠标按下`、`CDP_鼠标释放`、`CDP_鼠标滚轮`、`CDP_按键`、`CDP_组合键`(Ctrl/Shift/Alt/Meta)、`CDP_插入文本`(Input.insertTextInput，headless 不可靠仅保留)
- **网络（7）**：`CDP_绑定网络事件`、`CDP_取网络响应体`、`CDP_取Cookie`、`CDP_置Cookie`、`CDP_删除Cookie`、`CDP_清空缓存`、`CDP_清空Cookie`
- **监听（2）**：`CDP_绑定控制台事件`、`CDP_绑定页面异常`
- **输出（2）**：`CDP_截图`(PNG base64 写盘)、`CDP_打印PDF`
- **快照（10）**：`CDP_取当前事件类型/事件文本/事件详情/错误/网络网址/网络方法/网络编号/网络状态/连接/页面`

事件类型全集：`已就绪`、`连接失败`、`已断开`、`页面就绪`、`页面失败`、`加载完成`、`页面销毁`、`命令完成`、`命令失败`、`网络请求`、`网络响应`、`网络完成`、`网络失败`、`控制台`、`页面异常`。

### 2.3 运行时架构要点

- **多开核心**：`connections_`（`unordered_map<long long, shared_ptr<Connection>>`），每连接独立 WinHTTP WebSocket、`nextMsgId` 原子计数、`pending` 回调表、接收线程。`CDP_连接` 立即返回受管 ID，握手在后台线程（`/json/version` HTTP 发现 → WebSocket 升级 → 接收循环）。
- **命令模型**：`SendCommand(connection, method, paramsJson, kind, handler, aux, sessionId)` 构造 `{"id","method","sessionId?","params"}` JSON 发送；响应用 `PendingKind` 枚举分发。当前枚举值：Internal=0、TextResult=1、WriteBase64File=2、AttachTarget=4、CreateTarget=5、NavigateWait=6、SuccessOnly=8、ElementClick=9、FocusThenType=10、AttachWaitLoad=11、CheckReady=12（CheckReady 已无调用方，保留作防御）。`aux` 字段复用存 pageId、文件路径或 `页面ID\t文本`（FocusThenType）。
- **页面就绪时序（关键，勿回退）**：`CDP_新建页面` = `Target.createTarget{url:"about:blank"}` → `Target.attachToTarget{flatten:true}` → 附加响应设 `readyPending=true` → Page/Runtime/Network/Log enable → `Page.navigate{目标url}` → 响应设 `loadPending=true` → `Page.loadEventFired` 事件到达时 `readyPending` 优先消费 → Emit"页面就绪"；否则 `loadPending` → Emit"加载完成"。`CDP_附加页面`（已有页面）走 AttachTarget 立即就绪。
- **事件投递**：Emit → events_ 表（上限 65536，丢弃最旧）→ `notify_` PostMessage → Win32 后端 `WM_LINGBUILDER_CDP_CLIENT_EVENT`（`WM_APP+0x58`）→ `DispatchEvent` → `DispatchCdpClientEvent(handler)` 按名字派发到无参 .lcpp 处理器；new_emoji 后端用 `LingBuilder.NewEmoji.CdpClientEventWindow` 隐藏消息窗口（复用 `webSocketDispatchCases` 同款派发生成）。
- **断线处理**：接收循环把 `ERROR_WINHTTP_TIMEOUT` 当 continue（CDP 长连接空闲不能断，与 WS 客户端模块行为不同）；连接断开时 `FailPendingAll` 把全部未完成 pending Emit"命令失败"。
- **元素命令实现策略**：全部走 `Runtime.evaluate`（选择器经 `LingCdpJson::Escape` 注入），不用 DOM 域 nodeIds——导航后无需维护节点失效。

### 2.4 生成器注入点（lingCppWin32Project.ts）

修改新后端命令时参照 WS 客户端（`webSocketClient*`）的同构位置：

- **new_emoji 后端**：generate 调用（~863 行）、`webSocketHandlerMethods` 条件（加 `|| cdpClientRuntime`）、`cdpClientIntegration`/`cdpClientEventWindowSetup`/`cdpClientCleanup`（WS 客户端同款三件套）、槽位（runtime 文本 ~1542、声明 ~2137、integration ~2150、setup ~2190、cleanup 两处）。
- **Win32 后端**：generate 调用 + 构造初始化/字段/Shutdown（~6782）、消息号 `WM_APP+0x58`（~7273）、runtime 槽位（~8432）、构造拼接、Shutdown 拼接、窗口字段（~8659）、窗口方法（~16156）、窗口过程 case（WM_LINGBUILDER_CDP_CLIENT_EVENT，`#ifdef LINGBUILDER_CDP_CLIENT_MODULE`）、基类虚函数 `DispatchCdpClientEvent`、派生类 override（用 `edgeDispatchCases`）。
- **下一个可用消息号：`WM_APP + 0x59`**（0x58 已被 CDP 占用）。

### 2.5 验证方式

```bash
cd electron
npx tsx --test tests/cdpClientRuntime.test.ts   # 专项回归（4 test）
npm run test:lingcpp                             # 全套（lingcpp 180 + modules 771 等）
npm run lint                                     # tsc 双工程
npm run build
npm run smoke:cdp-native                         # 真实 Edge/Chrome headless 端到端
```

smoke 自动：找浏览器（`LINGBUILDER_CDP_SMOKE_BROWSER` 环境变量或常见 Edge/Chrome 路径）→ 随机端口启动 `--headless=new --remote-debugging-port` → 生成 .lcpp → MSBuild Win32+x64 → 运行 exe 断言退出码 0 → 校验截图 PNG 文件头。exe 内部验证链：双连接并存 → 断开备用 → 新建页面（data URL）→ 页面就绪 → 查询元素 → 输入文本 → 脚本取值断言 → 截图 → 断开 → `ExitProcess(0)`。失败时各步骤写 `cdp-debug.txt`（正斜杠路径）供排查。

### 2.6 测试基线（改动清单/命令数后必须同步更新）

`electron/tests/modules.test.ts` 硬编码基线，当前值：

- 内置模块审计（~218 行）：`modules: 84, commands: 2951, parameters: 5050, controlReferences: 1262, commandDigest: '7b4696d8', parameterDigest: 'fd5ddcb2'`
- 全量审计（~540 行）：`modules: 91, commands: 6754, parameters: 16593, controlReferences: 4806, commandDigest: '1801de74', parameterDigest: '58459be2'`
- 模块源文件数（~323 行）：`47`
- `MODULE_ENCAPSULATION_CHECKLIST.md`（仓库根）需含 `84 个内置模块、2951 条中文命令` 与 CDP 行（`lingbuilder.cdp.client` | 97）
- 网络模块列表测试（~1046 行）期望数组含 `lingbuilder.cdp.client`（在 http-client 之后）

新增命令时：跑 `modules.test.ts`，按报错中的 actual 值更新基线；摘要值无法手算，直接抄测试输出。

### 2.7 文档同步状态（阶段 1 已全部同步）

- [x] `doc/CDP模块开发.md`（能力全景 + 阶段状态 + DSL 示例对齐实际命令）
- [x] `FUTURE_OPTIMIZATIONS.md`（阶段 1 完成条目 + 遗留超时定时器）
- [x] `MODULE_ECOSYSTEM_IMPLEMENTATION.md`（"CDP 客户端模块（2026-08）"章节）
- [x] `LingBuilder AI 规则手册.md`（CDP 命令生成规范，`electron/server.ts` 会注入 AI prompt）
- [x] `electron/README.md`（2026-08-22 条目）
- [x] `MODULE_ENCAPSULATION_CHECKLIST.md`
- [x] `更新记录/2026-08-22.md`
- [x] `electron/docs/modules/cdp-client/README.md`（模块正式文档）

## 三、阶段 2 已交付内容（`2.0.0`，97 条命令）

阶段 2 在阶段 1 的 58 条命令上新增 39 条命令和 `CDP拦截` 受管类型：

- **超时看门狗**：`CDP_设置命令超时`。`LingCdpRuntime` 构造时启动低频 watchdog（500ms）；`Pending` 记录 method+submittedAt，超时 Emit“命令失败”；页面 ready/load/lifecycle 各有独立 deadline。Shutdown 先停止并 join watchdog。默认命令 30s，导航/就绪使用 2 倍。
- **Fetch 拦截 9 条**：开始、继续、改写 URL/头、mock 响应（UTF-8 body→base64，8MB 上限）、终止、认证、取请求体、停止、当前拦截快照。每个 `CDP拦截` 只能裁决一次（`TakeIntercept` 原子移出）；页面销毁自动 fail 未裁决拦截；无处理器竞态自动放行/取消认证。
- **对话框 5 条**：绑定/应答 + 消息/类型/默认文本快照；未绑定时自动拒绝，防止页面脚本永久阻塞。
- **下载 4 条**：设置目录/拒绝、绑定事件、文件名/进度快照；`Browser.setDownloadBehavior` + downloadWillBegin/downloadProgress。
- **文件上传**：元素 selector evaluate 得 objectId → `DOM.setFileInputFiles`；校验真实文件存在。
- **生命周期等待**：load/DOMContentLoaded/networkIdle/networkAlmostIdle + 1-600s 独立超时。
- **设备仿真 9 条**：视口、UA、触摸、地理、时区、语言、暗色、CPU、重置。
- **网络仿真 3 条**：离线、限速、禁用缓存。
- **高阶便捷 6 条**：元素截图、取/设浏览器窗口边界、新页面/弹窗通知、鼠标拖拽、元素函数调用。

阶段 2 smoke 已真实验证（`npm run smoke:cdp-native`）：Win32+x64 编译、双连接、Fetch requestPaused + mock 响应、对话框事件/应答、下载事件、文件上传、暗色仿真、生命周期等待、截图及断开清理，退出码 0。smoke 构建目录改到系统临时目录 `lingbuilder-cdp-smoke-project`，避免中文仓库路径在 `.lcpp` 文件参数中被转义。

### 阶段 2 关键实现补充

- `PendingKind` 现扩展到 15：新增 SetFiles=13、GetWindowId=14、ElementShotRect=15。
- `Event` 新增 auxText/auxValue/interceptId，供对话框默认文本、下载进度、当前拦截快照。
- `PageSession` 新增 intercept/dialog handler、三个等待状态及 deadline；`Connection` 新增 download/newPage handler、commandTimeoutMs、downloadNames。
- `ParseHeaderArray` 严格要求 `[{"name":"...","value":"..."}]`；不要接受任意 JSON 或对象形态。
- `Page.handleJavaScriptDialog` / Fetch requestPaused 是阻塞型事件，文档和 AI 规则必须继续强调“尽快裁决”。

## 四、实现过程中确认的坑（跨会话必读）

1. **`.lcpp` 字符串会解释 `\` 转义**：传给命令的文件路径必须用正斜杠（Windows API 接受）；反斜杠路径会被吃掉字符（曾把截图路径写成 exe 同目录的粘连文件名）。
2. **`Target.createTarget` 的 `url` 参数必填**，且直接带目标 URL 创建存在 about:blank 中间导航竞态（就绪检查会在空白页阶段通过）——必须 `about:blank` 创建 + 显式 navigate + 等 load（见 2.3）。
3. **`Input.insertTextInput` 在 headless 下不更新输入框的值**：元素文本输入必须用逐字符 `Input.dispatchKeyEvent{type:"char"}`（`TypeTextIntoPage`，上限 4096 字符）；`CDP_插入文本` 保留直插语义但文档已标注限制。
4. **smoke 的 `LingWindowProject` 必须设 `iconStyle: 'none'`** 且不要 `schemaVersion: 2`，否则生成 `lingbuilder-app.rc` 引用不存在的 ico 导致 MSBuild 失败（图标物化在 IDE 构建链路，smoke 不做）。
5. **`.lcpp` 的 `@` 原生语句里不能写 handler 字符串参数**（语言诊断强制 `&处理器名`）也不能内嵌含单引号/复杂引号的 JS 字符串；smoke 中 `@` 只做断言/退出/无参快照读取，异步链全部用中文命令。
6. **MSVC 报 `_wfopen` C4996**：用 `_wfopen_s(&f, path, mode)`。
7. **不要把 bash 工作目录切进 smoke 构建目录**（`.lingbuilder-build/cdp-client-native-smoke`）——会 EBUSY 锁住 `fs.rm`；跑 MSBuild 用绝对路径在外部执行。
8. **更新记录文件可能被并行会话覆盖**：追加前先重新 Read 全文再 Edit。
9. **窗口过程 case 的文本无条件存在于生成 main.cpp**（`#ifdef` 只是 C++ 编译期门控）——"未启用"断言要用 `#define LINGBUILDER_CDP_CLIENT_MODULE` 或 runtime 类文本，不能断言 case 文本不存在。
10. **smoke 的调试输出**：fwprintf 中文到文件会变 `?`（宽模式问题），但 ASCII/错误文本可读；现有 smoke 在各失败步骤写 `cdp-debug.txt`。

## 五、阶段 3 当前进度与剩余工作

### 5.1 已落地（尚未宣告阶段完成）

- 模块清单已扩展到 `3.0.0`、144 条命令、14 个受管类型，并补齐 contributes、bindings 与 Win32/new_emoji 共用包装方法。
- 修正非标准 `Input.insertTextInput` 为标准 `Input.insertText`；Internal pending 也进入超时清理并记录协议错误；当前事件改为可重入事件栈。
- 新增 Target/Session/Frame/ExecutionContext O(1) 注册表，页面 flatten session 同步注册，支持 setAutoAttach、attached/detached、Worker/OOPIF 通用会话求值和绑定重放。
- 新增 Runtime binding、Overlay 矩形高亮、严格 JSON 多点触摸。
- 新增 Debugger 地基：enable/disable、URL 断点、暂停/恢复/单步、调用帧 generation、作用域属性和调用帧求值。
- 新增 Performance 指标、Storage usage 与显式确认的 exact-origin 清理。
- 新增证书错误严格门禁：exact origin 白名单、1–600 秒期限、逐次一次性裁决、30 秒未应答自动 cancel、关闭/断线恢复 override=false；无全局忽略开关。
- 新增 `lingbuilder.cdp.recording` schemaVersion 1 原子落盘与敏感字段占位符地基。
- 修复原子文件 writer 的重复定义/递归错误、PendingKind 与公开方法重名导致的 C++ 编译错误、连接主动断开未清理阶段 3 状态等问题。
- 当前专项生成测试 4/4；真实 Edge headless smoke 继续通过，MSVC Win32/x64 均编译成功。现有 smoke 仍主要覆盖阶段 2 链路，不能作为阶段 3 完成证据。

### 5.2 仍需完成

- Screencast 帧句柄、latest-only 有界队列、ack 与异步写盘。
- Tracing ReturnAsStream、CPU Profile、精确覆盖率、Heap Snapshot 的完整 `CDP任务` 生命周期、取消、进度、上限与原子提交。
- Worker/OOPIF、Debugger、Storage/Security 的协议注入状态机测试和真实浏览器分场景 smoke。
- 录制自动采集、locator resolver、schema validator、条件等待、重试/失败产物和真正的确定性回放执行器；当前 `CDP_加载回放` 只创建状态，不执行步骤。
- 事件队列按控制/进度/latest-only 分类，AttachWorker 裸 `detach()` 生命周期，以及剩余 `Pending.aux` 显式字段迁移。
- 完成全部文档同步、模块审计基线、`npm run lint`、`npm run test:lingcpp`、`npm run build` 与最终阶段 3 smoke 后，才能把阶段 3 标记完成。

### 5.3 阶段 3 验收门禁

1. `cdpClientModule.ts` 新命令四端一致（contributes + binding + 运行时包装方法 + 文档）；handler 参数必须带 `handlerSignature: { parameterTypes: [], returnType: '空' }`。
2. `tests/cdpClientRuntime.test.ts` 断言新命令生成；`modules.test.ts` 基线数字更新。
3. `smoke-cdp-native.ts` 扩展真实浏览器断言（OOPIF 自动附加、断点暂停/单步、性能追踪文件、覆盖率与堆快照等每域至少一项）。
4. 六文档同步：`doc/CDP模块开发.md`（阶段状态）、`FUTURE_OPTIMIZATIONS.md`、`MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`LingBuilder AI 规则手册.md`、`electron/README.md`、`MODULE_ENCAPSULATION_CHECKLIST.md` + 当日 `更新记录/`。
5. `npm run lint` / `npm run test:lingcpp` / `npm run build` / `npm run smoke:cdp-native` 全过。

## 六、新会话快速上手

1. 读 `AGENTS.md`（模块生态/AI Bridge/文档同步规则）+ `doc/CDP模块开发.md`（能力全景与阶段门禁）+ 本文档。
2. 阶段 3 优先从 `Target.setAutoAttach` + OOPIF/Worker 会话模型开始，再接 Debugger；先设计多 frame/session 的稳定句柄契约，不能直接复用 `CDP页面` 猜 session。
3. 改运行时 = 改 `cdpClientRuntime.ts` 的 `String.raw` 文本；改完先跑专项测试，再跑 smoke（真实编译会暴露 C++ 语法错误）。
4. 新消息号用 `WM_APP+0x59` 起；新 PendingKind 枚举值接着 15 往后排。
5. CDP 是后端无关网络模块：不依赖 `LingWindowBase`/`HWND`，不注册 UI 后端契约，不占 `HWND`，不注册可视控件。
