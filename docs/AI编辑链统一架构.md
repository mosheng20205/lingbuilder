# AI 编辑链统一架构（面板与 AI Bridge）

> 状态：2026-09-18 收口落地（方案 A，经批复）。提交：`f5b0f19`（项目质量结构修）、`5ced438`（面板编辑链收口）。
> 本文档是「AI 改代码」这条链的**维护边界契约**：新增或修改编辑类功能前必读，禁止绕开本契约再造第二套实现。

## 一句话结论

IDE AI 面板与外部 AI（MCP / REST / CLI）的**编辑事务与校验**已统一为唯一实现 `AiBridgeService`；
以后改「怎么校验、怎么写盘」只需要改这一处，两边同时生效。
未统一的部分只剩两类：**AI 草稿怎么生成（planner）** 和 **面板 UI 交互**。

## 唯一实现：AiBridgeService

代码位置：`electron/src/services/aiBridge/aiBridgeService.ts`。

统一承载的能力（面板与 Bridge 共用，任何一处都不得另写副本）：

| 能力 | 说明 |
|---|---|
| 路径校验 | `WorkspacePathPolicy` 限定 `--workspace` 内 + 写入白名单文本文件，符号链接拒绝 |
| 提案形态 | `files[]` 三选一：`updatedSource`（全量，≤256KB）/ `updatedLines` / `edits`（行级增量） |
| 设计器一致性 | `areDesignerProjectsEquivalent` 键序不敏感深比较；漂移基准取磁盘快照（`designerProjectDiskBaseline`），禁止 `JSON.stringify` 相等比较 |
| 控件引用门禁 | `edit.apply` 与 `build.run`/`native.preview`/`native.export` 对窗口项目最终源码校验 controlRef，缺失控件中文阻断（`lingcpp-control-reference-*`） |
| 幻影项目封堵 | 拒绝向未注册的 `.lingbuilder/projects/<id>/` 与裸 `window-designer.json` 写入 |
| 编码/EOL 保留 | `decodeTextFile`/写回保持原文件编码与换行风格 |
| 原子写盘 | 临时文件 + 原子替换 |
| 审计 | `.lingbuilder/ai-bridge-log.jsonl` |

## 两个入口宿主

```
外部 AI（MCP stdio / HTTP /api/ai-bridge/* / CLI）
        │  files[] 草稿自带（caller-draft）；无 planner
        ▼
AiBridgeService.proposeEdit / applyEdit          ◄── 唯一事务实现
        ▲
        │  显式传入 planner
IDE AI 面板（/api/lingcpp/edit/propose|from-system-draft|apply）
   planner = planLingCppEditWithGemini（系统 AI 云端链路）
```

- `electron/server.ts` 构造**面板专用实例** `panelAiBridgeService`（permission 固定 `yolo`：
  面板是本地受信 UI，「提案预览 + 用户确认」就是它的批准环节；审计仍写 ai-bridge-log）。
- 内嵌 `/api/ai-bridge` router 与独立 `lingbuilder ai-server` 一样**不注入 planner**，
  外部 AI 的 `files[]` 草稿在两种宿主下行为一致（历史上内嵌路由全局注入 planner 会把
  外部草稿降级成本地假注释草稿，已修）。
- 系统 AI planner 由面板 propose 路由**显式传入**（保留 Gemini 失败降级本地安全草稿与
  502 根因文案）；`from-system-draft` 以固定 planner 维持系统 AI 的 strict 设计器联动策略
  （`designerEditPolicy`），与外部 caller-draft 的宽松策略区分。
- **propose 阶段的设计器门禁（2026-09-22 收口）**：strict 路径不再用指令关键词猜「这是不是布局
  需求」。旧口径把「窗口/按钮/显示/移动」命中即要求设计器模型必须变化，纯行为需求（如「给按钮1
  加点击计数」）会被误拒。现在的唯一判据是事实：把提案落盘后的源码跑 `controlRef` 语义诊断，
  引用了模型中不存在的控件才中文阻断并指向 `updatedDesignerProject`；否则按纯源码提案受理，
  AI 原样回传的等价模型直接丢弃、不写回设计器。「美化界面」类宽泛视觉请求仍保留本地产出可预览
  布局的降级方案。该判定的唯一实现是 `src/services/lingCpp/controlReferenceAdmission.ts`
  （`collectControlReferenceAdmissionProblems` + `formatControlReferenceAdmissionBlock`），
  propose / apply / build 三个入口共用，禁止再各自复制一套控件引用校验。
- **同一次收口的其余三层（2026-09-22）**：只改本地判据不足以根治，同一根因在四层各有一份副本：
  - **BYOK planner（`server.ts` 的 `planLingCppEditWithGemini`）**：`designerProject` 不再按关键词
    设为 schema 必填，也不再对非美化请求做「必须落实为真实布局属性变化」的纠正重试——那会逼模型
    乱改颜色与位置。现在只有宽泛美化请求强制回传布局；完整设计器 JSON 的输出预算改为
    「有设计器上下文即 32000」（否则大模型布局会被截断）；`files: []` + 真实布局变化视为合法的
    纯布局草稿，不再报「AI 未返回有效的多文件编辑结果」。
  - **云端系统 AI（`cloud/api/src/ai/ai.service.ts`）**：删除该侧的 `isDesignerEditInstruction`
    关键词门禁与「未返回完整设计器模型」硬阻断（控件门禁只在本地有权威模型与解析器时执行）；
    等价模型直接丢弃不下发、美化请求仍走视觉回退、`files: []` + 布局变化放行。顺带修掉同文件内
    两处白名单缺陷：工作区路径按 Windows 大小写不敏感匹配（`MainWindow.lcpp` 回成小写不再被拒），
    新建额度只数新建文件（改一个已有文件不再吃掉 `maxCount`，导致合法新文件被静默丢弃）。
    **改 `parseEditDraft` 语义必须与本地 `from-system-draft` 路由双侧同步**（两包不共享代码）。
  - **面板路由（`AiAssistant.tsx`）**：新增 `isLikelyAskingOnlyInstruction`，纯问答（“解释一下如何
    修改按钮颜色”“如何安装 .lbmod 模块？”）既不进编辑提案链也不进模块生成流；句中只要有祈使
    （帮我/请把/加上/修复…）仍按改动请求处理。
  - **结果播报与画布刷新**：提案结果统一走 `describeEditProposalOutcome`，如实区分「涉及设计器布局
    改动，应用后界面设计器会立即重绘」与「界面布局未发生变化（本次仅源码改动）」（后者由提案字段
    `designerUnchanged` 驱动）；`App.tsx` 允许纯布局提案（0 个文件）按成功结算，重载刷新画布时保留
    仍然存在的活动窗口与选中控件，`AiBridgeService.applyEdit` 对「只改布局」给出对应中文播报。
- **无实际改动不再假成功**：`proposeLingCppEdit` 在 AI 显式给出草稿、但源码与设计器都与当前内容
  一致时中文拒绝（`AI 未产生任何实际改动…`），不再产出一份点了「应用提案」却什么都没变的空提案；
  `files: []` 也不再触发本地占位注释降级（占位注释只保留给 planner 完全没给草稿的本地安全提案）。
  回归锚点：`tests/lingcpp.test.ts`（纯布局提案 / 无改动拒绝 / 等价模型明示）、
  `tests/aiConnectionSession.test.ts`（问答路由 / 播报出口 / planner 与云端贯通）、
  `cloud/api/tests/ai-edit.test.ts`（关键词不再阻断 / 纯布局放行 / 大小写与新建额度）。

## 仍然各自保留的部分（不算重复实现）

1. **planner / AI 生成侧**：面板的 Gemini planner、提示词组装、云端账号与计费、流式聊天
   （`electron/server.ts` + `cloud/api`）；MCP 侧没有 planner，外部 AI 自带草稿。
2. **面板 UI 层**：提案预览、Diff 编辑器（`applyExternalSourceCode` 回注）、用户确认、
   应用后编辑器状态刷新——仅面板有；Bridge 的「确认」是 `approved:true` 参数。
3. **权限口径**：面板固定 yolo；Bridge 按 readonly / preview / yolo 三档。

## 维护规则（防止乱改）

- 改「怎么校验、怎么写盘、门禁、审计、增量形态」→ **只改 `AiBridgeService`**，
  禁止在面板路由、renderer 或 aiEditService 里补一份平行逻辑。
- 改「AI 怎么生成草稿」→ planner / 提示词 / 云端路由，不触碰事务层。
- 改交互 → 面板组件，写盘结果一律以 `applyEdit` 落盘后的磁盘回读为准。
- 新增任何编辑类能力（面板或 MCP 侧）必须走同一 `proposeEdit → applyEdit` 链；
  `proposeLingCppEdit + applyWorkspaceEditToFiles` 已退出面板链路，
  **不得再作为第二套编辑事务入口复活**（`aiEditService` 仅保留 planner 内部使用的
  提案构造辅助）。
- 设计器模型比较一律 `areDesignerProjectsEquivalent`；非 object 形态（二次
  `JSON.stringify`）在入口给「必须是 JSON object，收到 string」级中文 schema 错误。
- 契约变更（响应形状、门禁语义、权限口径）必须同步：本文件、`LingBuilder AI 规则手册.md`
  外部 AI 节、AGENTS.md「AI Bridge 实现规则」、`electron/README.md`、当天更新记录，
  并跑 `cd electron && npm run lint && npm run test:lingcpp`。

## 聊天链（2026-09-20 收口）

编辑事务之外的另一半「能力重叠」是**模型调用适配**与**聊天**：

- **Provider 适配唯一层**：`electron/src/services/ai/aiProviderService.ts`。
  `resolveAiConnectionConfig` / `generateAiText` / `generateAiChat`（多轮 messages，
  含 SSE 流式 `onDelta`/`onReasoning`）/ `testAiConnection` / `listAiModels` 只此一份；
  server.ts 的汉化翻译、连接测试、模型列表、编辑 planner、模块 AI 生成与聊天端点
  全部经它调用。新增协议（如通义/Kimi）只改本文件，禁止在任何路由里再写 provider 分支。
- **聊天端点**：`POST /api/ai/chat`（`server.ts`）。入参为真实多轮 `messages`
  （user/assistant）+ `aiConfig` + 可选 `activeFile` 节选；system = LingBuilder 助手
  人格 + 当前文件节选 + 规则手册（`attachLingBuilderAiRulebook`，与编辑 planner、
  翻译链同源注入）。`stream:true` 走 SSE（`delta`/`reasoning` 事件 + `{ok, reply}` 收尾）。
- **历史禁令**：BYOK 聊天曾把整段 prompt 当「待翻译字符串」塞进 `/api/translate`，
  遇 DeepSeek 这类严格遵循翻译指令的模型被原文回显（用户提问被复读）。该通道已废弃，
  `/api/translate` 只服务批量汉化与一键智能汉化两处真实调用方。
- **与 MCP 的边界**：Bridge 没有、也不需要有聊天工具——外部 AI 自带模型与大脑，
  只消费 LingBuilder 的上下文与事务工具；聊天链是面板专属能力，不算缺口。

## BYOK 配置生命周期（2026-09-22 收口）

背景：编辑提案链被上游 401（DeepSeek 报「Your api key: \*\*\*\*669d is invalid」，
尾缀与用户当前 Key 一致），而同一把 Key 聊天链 200、curl 直连 200。真机抓包复盘
结论：面板的 `aiConfig.apiKey` 是挂载后从凭据库（`credentials:ai:get` → safeStorage）
异步回填的，编辑请求若赶在回填前发出就带着**空 Key** 打服务端；服务端
`resolveAiConnectionConfig` 对空 Key 回落到 `GEMINI_API_KEY` 等**server 进程启动时
固化的环境变量快照**——旧值顶替新 Key 出网，即产生「尾缀吻合却 401」的假象。
（另一个伴生问题：「给按钮1加上点击计数」这类口语指令缺动词匹配，被路由进聊天
而不是编辑提案。）

修复口径（两层，缺一不可）：

1. **服务端**（`aiProviderService.resolveAiConnectionConfig`）：调用方**显式传入**
   `aiConfig` 对象（propose/chat/translate/connect/models、模块 AI 生成、编辑 planner）
   时，配置只取请求体——缺 `apiKey` 就是缺，**绝不回落环境变量**；环境变量兜底仅
   保留给未传配置对象的系统路径（如一键智能汉化不带 `aiConfig`）。这消灭了
   「启动时旧 Key 顶替逐请求新 Key」的整个类别。provider=deepseek 仍固定走
   `generateAiText` 的 deepseek 分支（`baseUrl + /chat/completions`、Bearer Key、
   `thinking:{type:"disabled"}`），权限语义（面板链 permission=yolo）、审计与
   「planner 失败降级本地安全提案 + 502 根因透出」不变。
2. **面板**（`AiAssistant.resolveByokAiConfig`）：BYOK 的编辑提案与聊天在发送前
   若 state 里 Key 为空，先 `credentials.getAiApiKey()` 取最新值（并回填 state）；
   仍取不到直接给中文错误，不发注定失败的请求。
3. **路由**：`isLikelyDesignerEditInstruction` 的动词表补「加上/加个」（仍要求与
   设计器目标词同现，不放宽纯代码编辑判定 `isLikelyCodeEditInstruction`），
   「给按钮1加上点击计数」按用户预期进入编辑提案链。

验证锚点：`tests/aiProviderChat.test.ts` 新增两条——「请求体 Key 优先，环境变量
旧 Key 不顶替」（断言上游收到的 Authorization 就是请求体 Key）与「显式配置缺 Key
不回落环境变量」（断言 mock provider 零请求、提案本地降级、聊天报缺 Key）；
`tests/aiConnectionSession.test.ts` 钉住「加上/加个」路由与不放宽面。真机
（dev 3001 + electron 9222，DeepSeek 真端点）：提案卡片出现且「应用提案」
写回 `src/MainWindow.lcpp` 与设计器模型，全程无 401。

## 验证锚点（2026-09-18 真机）

- 面板链冒烟 9/9：`LINGBUILDER_AI_BRIDGE_ENABLED=false` 时面板路由仍可用；
- 内嵌 Bridge 开启时外部 `files[]` 草稿真实落盘（非假注释）；
- 幽灵控件草稿在 apply 被中文阻断且磁盘零写入；
- `apply` 响应契约 `{ok, proposal, nextSourceCode, appliedFiles, designerProject?}` 不变。

## 新建文件白名单与模块生成路由（2026-09-21 收口）

背景：用户在聊天面板发「生成 demo.math2 模块」被 `isLikelyCodeEditInstruction`
误判成代码修改（`demo_add` 里的 "add" 子串命中无词边界英文关键词），请求进了云端
编辑链；而编辑链的文件白名单只含已有工作区文件，模块新文件必然被过滤成空，
云端报 `EDIT_DRAFT_INVALID`「AI 未返回有效的完整文件修改结果」。

修复分四层：

1. **意图路由**：`isLikelyCodeEditInstruction` 英文关键词加 `\b` 词边界；新增
   `isLikelyModuleGenerationInstruction`（模块+生成动词 / `lingbuilder.module.json` /
   `.lbmod` / 模块开发规范），命中即走模块生成专用链，永不进编辑提案。
2. **模块生成链唯一实现**：`electron/src/services/modules/aiModuleGenerationFlow.ts`
   承载「多阶段生成（清单→其余文件→补全）→ 契约解析重试 → 导入 module-build」
   编排；聊天面板（`AiAssistant`）与模块面板（`ModuleInspector`）都消费它，
   禁止再复制第二套编排。二进制产物（dll/lib/图片等）不计入待补全文件。
3. **newFiles 新建白名单**：`AiEditRequest.newFiles`（contracts `AiNewFileAllowance`：
   `paths` 显式路径 / `directories`+`extensions`+`maxCount` 目录许可，上限 10 个）。
   云端 `parseEditDraft` 与本地 `from-system-draft` 双层放行声明范围内的新路径；
   渲染层由 `deriveAiNewFileAllowance`（`src/services/ai/aiEditFileScope.ts`）从指令
   推导（点名文件→显式路径落活动文件目录；「新建功能库」不点名→活动目录内 .lcpp）。
   本地侧新路径以空基准进入提案，写盘安全仍由 `AiBridgeService` 的
   WorkspacePathPolicy + 可写扩展名白名单在 apply 强制（与 MCP `edit.propose`
   「磁盘不存在按新建空文件处理」同语义）。云端校验副本在
   `cloud/api/src/ai/ai.service.ts` 的 `normalizeNewFileAllowance`（两包不共享代码，
   改语义必须双侧同步）。electron 根 tsconfig 未开 strictNullChecks，
   **非 strict 下布尔判别式联合不收窄**，结果类型一律用单一接口（`ok: boolean` +
   可选字段），禁用 `{ok:true}|{ok:false}` 形态。
4. **云端留痕与错误区分**：`EDIT_DRAFT_INVALID` 保留真实错误码（DB `errorCode` 与
   SSE `error.code`，不再统一记成 `PROVIDER_FAILED`）；解析失败把模型原始输出前
   1200 字符写入容器日志；`parseEditDraft` 错误信息区分「模型没给文件草稿」与
   「给了但路径全部被白名单过滤」（后者点名被拒路径并提示 newFiles 声明方式）。

回归：`tests/aiConnectionSession.test.ts`（词边界/模块意图/白名单推导匹配）、
`tests/aiModuleGenerationFlow.test.ts`（清单登记比对/契约解析）、
`cloud/api/tests/ai-edit.test.ts`（newFiles 放行/拒绝消息/形状校验）。

## 设计器 apply 客户端守卫基准修正（2026-09-21）

用户验收中实测：「只在画布上设计过、从未落盘」的项目，AI 面板的设计器提案**必然**
应用失败——「提交应用的窗口设计器模型与磁盘版本不一致」。根因：面板画布模型的
持久化只有 localStorage 原型回退，`window-designer.json` 只在项目创建/提案应用/
构建时写盘；提案生成时 planner 看到的是**画布模型**，而 apply 的客户端一致性守卫
却拿提交的画布模型与**磁盘**比对，画布领先磁盘时结构性必败（重试无意义）。

修正（事务层单点，`AiBridgeService.applyEdit` + `proposeLingCppEdit`）：

- 提案新增 `designerCallerBaseline` = `proposeLingCppEdit` 时 `context.designerProject`
  （planner 实际看到的画布/调用方模型）。
- **客户端一致性守卫**：`request.designerProject` 改为与 `designerCallerBaseline`
  （缺省回落 `designerProjectOriginal`）比对——语义是「画布在提案生成后是否又被修改」，
  被拒文案相应改为「与提案生成时的画布模型不一致」。
- **磁盘漂移守卫**（`designerProjectOriginal` vs 应用时最新磁盘）保持不变，外部修改
  仍会被拦截。两道守卫基准不可混用：客户端守卫防「提案过时」，磁盘守卫防「磁盘被外人改」。
- 验证锚点：`tests/aiBridge.test.ts`「applies panel proposals whose canvas is ahead
  of disk and rejects stale canvas」（画布领先磁盘可应用 + 画布漂移拦截 + 磁盘漂移拦截）。

### 面板服务必须随工作区切换重建（2026-09-21 追加）

`switchWorkspaceRuntime` 切换工作区时重建了全部工作区绑定服务，但漏掉了
`panelAiBridgeService`——它在模块加载期用启动时的 `workspaceRoot` 快照构造
`AiBridgeService`（内部派生 pathPolicy/solutionService/moduleService 等）。
工作区切换后：界面路由（`getSolutionService()` 等）读新工作区，AI 提案/应用
却继续读写旧工作区——「写读分裂」，表现为应用成功但画布/文件毫无变化。
已改为 `createPanelAiBridgeService()` 工厂 + `let` 绑定，切换时重建。
**新增强制**：任何新增的工作区绑定单例（尤其是 AI 链）必须加入
`switchWorkspaceRuntime` 的重建名单；内嵌 AI Bridge 路由（挂载期绑定实例）
尚有同型问题，记为债务（开发环境默认关闭、桌面版切换走独立进程）。

## 内嵌 Agent 引擎与工具遮蔽（2026-09-22 P1）

AI 面板新增第三个引擎候选：本机内嵌 Agent 运行时（DeepSeek Harness，主进程服务
`electron/electron/agentRuntime/`，IPC `agent-runtime:*`）。它**不是第二套编辑事务**：

- 它只跑「规划 + 模型调用 + 工具循环」，所有 LingBuilder 能力一律经 AI Bridge MCP；
- 写盘、构建、运行由面板在用户确认提案后经 `AiBridgeService` 代执行；
- MCP 侧用 `--mcp-toolset agent` 摘掉 `edit.apply / build.run / native.preview / native.export /
  project.create / project.create.undo / module.writeFiles / module.pack / module.install`；
- dsh 侧用生成的 profile overlay 把 15 个本地工具行整行 `disabled: true`，模型只看得见 `mcp__lingbuilder__*`。

**为什么必须遮蔽而不是靠权限模式**：preview 下模型自己传 `approved=true` 一样能落盘，
「提示模型不要调用」不是防线。三层边界（dsh 工具行 / MCP 工具集 / 面板代执行）必须同时成立，
改任何一层都要回 `tests/agentRuntime.test.ts` 与 `tests/aiBridge.test.ts` 的 agent 工具集用例核对。

**工作区绑定**：`agentRuntime` 是工作区绑定单例，已按上文「新增强制」接入
`switchWorkspaceRuntime` 与 `shutdownAndExit`（`dispose()` 回收 dsh 子进程及其 MCP 子进程）。

**宿主事实**：dsh 的 ESM 插件树在 `ELECTRON_RUN_AS_NODE` 下整树导入失败，必须是真实 Node
（`^22.19 || >=24`）；我们自己的单文件 CJS `cli.cjs` 才可以用 Electron 当 Node 宿主。
系统 AI 云端账号、点数计费与 BYOK 链不受本引擎影响。

### 提案跨进程交接（P2，2026-09-22 落地）

dsh 的 MCP 子进程与 IDE 本地服务是两个进程，而 `aiEditService.ts` 的提案 store 是**进程内
Map**——直接把面板接上去必然「未找到编辑提案」。交接实现：

- `src/services/lingCpp/agentProposalStore.ts` 是唯一交接出口：工作区
  `.lingbuilder/agent-proposals/<proposalId>.json`，提案 ID 必须过固定正则
  （`lingcpp-edit-` + UUID），否则等同任意路径写入；30 分钟过期、最多 20 条、
  apply 成功即删除（不在工作区留源码草稿）。
- 开关是 `AiBridgeServerOptions.agentProposalHandoff`：只有 `--mcp-toolset agent` 的
  stdio 宿主与 `panelAiBridgeService` 开启；外部 AI 客户端一律不开。
- `AiBridgeService.resolveEditProposal()` 是「内存 store → 交接目录」的唯一取回入口，
  `applyEdit` 与 `resolveApplyWorkspaceFiles` 都必须走它。漏掉后者的症状极具误导性：
  报「文件在 AI 提案生成后已发生变化」的假漂移。
- `server.ts` 新增只读 `GET /api/lingcpp/edit/agent-proposal`（取最新未应用提案），
  `/api/lingcpp/edit/apply` 按 ID 回退读盘。
- 面板 `AiConnectionMode` 增加 `'agent'`（第三个页签「本机 Agent」）。`runAgentTurn`
  只提交需求并展示提案（`setEditProposal`），落盘仍由现有 `handleApplyProposal` 走唯一
  apply 事务；**渲染层不得出现任何直接写文件的分支**。

真机验收口径（改任一环节都要复跑）：agent 的工具序列必须是
`workspace_list → file_read → edit_propose`；提案落盘前源文件不变；由**另一进程**的
`AiBridgeService.applyEdit` 按 ID 成功应用；交接目录随后清空；被遮蔽工具零调用。
