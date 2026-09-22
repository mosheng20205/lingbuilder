# 提示词：修复灵码外部 AI 接入链路（Skill + AI Bridge MCP）

把下面 **【提示词正文】** 整段（含分隔线内所有内容）连同需求文档一起发给对方 AI。

---

## 【提示词正文】

你在 LingBuilder（灵码）中文 IDE 的源码仓库里工作，仓库根目录：`T:\electron\lingbuilder`。

任务：修复 **外部 AI 客户端接入链路**（`resources/skill-kit/SKILL.md` 接入指引 + AI Bridge 的 MCP 接口）中
已实测确认的 7 个问题。

**完整需求文档（先通读，这是唯一权威需求来源）**：
`T:\electron\lingbuilder\docs\外部AI接入链路优化需求.md`

文档里每条问题都给了：现象、可复现证据、**精确文件与行号**、建议改法、验收标准。
不要重新做调研，直接按文档动手；如果发现文档里的行号或结论与实际代码不符，
**以实际代码为准，并在最终报告里指出该偏差**。

### 背景（帮你建立判断力，不要跳过）

这份需求来自一次**真实的从零接入实测**，不是产品想象中的问题：
一个外部 AI 客户端按 `SKILL.md` 自安装 stdio MCP 配置 → 在 IDE 里新建一个 new_emoji 窗口项目 → 构建运行。
接入本身成功了（23 个工具、握手正常），问题全部出在**接入之后**：
授权门禁把「宿主进程启动早了」误报成「用户没买」、工作区错位后无从自查、
目录联接接入的模块被静默跳过、组件卡正文拿不到、指引把最关键的红线写在最后。

所以请把注意力放在**「外部 AI 第一次接入能不能顺利跑通」**这个视角上，
而不是「代码风格是否统一」。

### 硬性约束（违反即视为未完成）

1. **MCP 工具数必须保持 23 个**。`tests/aiBridge.test.ts:90` 有 `assert.equal(tools.tools.length, 23)`。
   P2（工作区自省）**必须**通过增强 `lingbuilder.workspace.list` 的返回实现，
   **禁止**新增 `workspace.info` 之类工具，禁止为它牺牲其他工具。
2. **改完 `MCP_INSTRUCTIONS`（`electron/src/services/aiBridge/mcpServer.ts:14-32`）或任何工具描述后，
   必须重建 bundle，否则等于没改**（外部 stdio 宿主只从 bundle 读 instructions）：
   ```bash
   cd T:\electron\lingbuilder\electron
   npx esbuild src/cli.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/cli.cjs
   ```
   并用真机 stdio 握手复验（不只是跑单测）。
3. **instructions 新增条款必须同步补断言**。现有锚点在 `tests/aiBridge.test.ts:112-155`，
   新增一条就补一条 `assert.match`，措辞类红线用 `assert.doesNotMatch`。
4. **fail-closed 不许放宽**。P1 允许「细分报错 + 一次惰性重试」，但**不得**为了让它通过而静默放行收费模块。
   授权确实无效时仍须拒绝。
5. **所有面向用户与外部 AI 的文案一律中文**，错误信息必须说清「为什么 + 怎么修」，
   禁止只说「失败」「无效」这类无行动信息的措辞。
6. 不要改动 `permission` 语义：`preview` 模式下写入与构建仍需显式 `approved=true`。

### 关键落点速查

| 问题 | 落点 |
|---|---|
| P1 门禁报错三分类 | `electron/src/services/modules/moduleAccessService.ts:75`，配合 `electron/src/cli.ts:76-87` |
| P2 工作区自省 | `electron/src/services/aiBridge/aiBridgeService.ts:296`、`mcpServer.ts:35` |
| P3 sourceRoot 硬前缀 | `electron/src/services/aiBridge/aiBridgeService.ts:1406`（对比同文件 `:1113`/`:1554` 的 `|| '.'` 口径） |
| P4 联接被跳过 | `electron/src/services/modules/moduleService.ts:92`（对比同文件 `:894` 的符号链接口径） |
| P5 组件卡正文/红线语义 | `electron/src/services/aiBridge/aiBridgeService.ts:622` 一带 |
| P6 enabled/installPath 作用域 | `electron/src/services/aiBridge/aiBridgeService.ts:599` 一带 |
| P7 SKILL.md 前置检查 | 仓库源 `electron/skill-kit/SKILL.md`（7727 字节）；打包产物为 `resources/skill-kit/SKILL.md`；**另有一份官网在线版 `cloud/admin/docs/guide/ai/skill.md` 需同步**（SKILL.md 正文承诺「官网发布更新版时以更新版为准」） |

### 实施顺序与要求

按文档第 4 节的批次推进：**第 1 批 P1+P2+P3 → 第 2 批 P4+P5 → 第 3 批 P6+P7**。
每批完成后跑一次 `tests/aiBridge.test.ts`（以及你改动涉及的其他测试），
第 1 批完成后要重建 bundle 并做一次真机 stdio 握手。

### 交付要求

1. 逐条说明每个问题的改法，**给出改动后的代码片段**（不要只说「已修复」）。
2. 报告**实际改了哪些文件**（路径 + 行号），以及与原文档的偏差（如有）。
3. 给出**真机验证证据**：
   - 重建后的 bundle 做 stdio 握手，列出工具数与 instructions 中的新条款；
   - P1 要分别验证「授权开启后再启动的宿主直接成功」与「开启前启动的宿主报错指向重启」两种情形；
   - P2 要给出 `workspace.list` 的响应片段，证明能读到工作区根绝对路径。
4. 说明**未做或做不到**的部分，以及原因。不要用「应该可以」这类措辞替代验证。
5. 最后附**完整的测试输出**（至少 `tests/aiBridge.test.ts`）。

### 验收口径

以文档第 5 节的验收清单为准，逐项打勾或说明未达成原因。
特别提醒：**「代码改完了」不等于完成**——P2 与 instructions 相关改动必须经过 bundle 重建 + 真机 stdio 握手复验。

---

## 【使用说明】（不要发给对方 AI）

- 把上面分隔线内的全部内容与 `docs/外部AI接入链路优化需求.md` 一起发给对方 AI。
- 如果对方 AI 有 MCP 接入能力，建议同时给它 `lingbuilder.workspace.list` 所需的配置，
  让它自己验证 P2（这正好是被修复的能力本身）。
- 预期工作量：第 1 批是主要工作量（P1 需要跨 `cli.ts` / `moduleAccessService.ts` 改数据流），
  P4 是**一行**的机械修复（对比 `moduleService.ts:894` 已有口径即可），P7 是纯文档。
- 如果对方 AI 想先看现状再动手，让它先跑基线（**已验证的本仓用法**）：
  ```bash
  cd T:\electron\lingbuilder\electron
  npm run test:lingcpp        # 含 tests/aiBridge.test.ts
  ```
  只想单跑接入相关用例时，按仓库既有写法显式列文件：
  ```bash
  node --import tsx --test tests/aiBridge.test.ts tests/moduleAccess.test.ts tests/skillKit.test.ts
  ```
  注意：**不要**用 `npx tsx --test <file>` 这类写法（本仓不用该形式）。
  另注：`skillKit.test.ts` 与 `tests/newEmojiComponentCards.test.ts` 覆盖了 skill-kit 分发与组件卡，
  改 P5/P7 时它们是相关回归。
