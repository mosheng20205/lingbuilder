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
