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

## 验证锚点（2026-09-18 真机）

- 面板链冒烟 9/9：`LINGBUILDER_AI_BRIDGE_ENABLED=false` 时面板路由仍可用；
- 内嵌 Bridge 开启时外部 `files[]` 草稿真实落盘（非假注释）；
- 幽灵控件草稿在 apply 被中文阻断且磁盘零写入；
- `apply` 响应契约 `{ok, proposal, nextSourceCode, appliedFiles, designerProject?}` 不变。
