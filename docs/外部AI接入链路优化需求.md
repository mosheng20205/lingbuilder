# 外部 AI 接入链路优化需求（灵码 Skill + AI Bridge MCP）

> 本文档来自一次**真实的从零接入实测**（2026-09-21）：一个外部 AI 客户端先按 `skill-kit/SKILL.md`
> 自安装 MCP 配置，再在 LingBuilder 里新建一个 new_emoji 窗口项目并构建运行。
> 下面每条都是该过程中**实际撞到**的问题，附可复现证据与精确落点。
> 写作目的：让接手的人不必重新踩一遍，能直接定位并修改。

---

## 0. 背景与实测环境

| 项 | 值 |
|---|---|
| IDE 版本 | 0.7.7（安装包 asar 内 `package.json`） |
| AI Bridge `serverInfo.version` | 0.6.6 |
| skill-kit `manifest.json` | version 0.1.0 / sequence 1 / minIdeVersion 0.7.6 / updatedAt 2026-09-19 |
| 安装目录 | `C:\Users\Administrator\AppData\Local\Programs\LingBuilder` |
| 入口脚本 | `<IDE>\resources\app.asar\dist\cli.cjs`（asar 内实测存在，10,661,632 字节） |
| 传输 | stdio MCP（`--workspace . --permission preview --mcp --stdio-only`），握手实测 23 个工具 |
| 目标模块 | `lingbuilder.new_emoji.ui`（**收费模块**） |

实测结论：**23 个工具齐全、握手正常、`workspace.list` 可用**——接入本身是成功的。
问题集中在「接入之后怎么顺利干活」，以及「出问题时报错能不能指对方向」。

---

## 1. 问题总表

| # | 问题 | 严重度 | 落点 | 类型 |
|---|---|---|---|---|
| P1 | 收费模块门禁把「宿主启动早」误报成「没购买」 | **高** | `moduleAccessService.ts:75` | 逻辑 |
| P2 | 没有工作区自省入口，工作区错位后全盘皆错 | **高** | `aiBridgeService.ts:296` / `mcpServer.ts:35` | 能力 |
| P3 | `sourceRoot` 硬前缀拒绝项目根源码，报错不给可用信息 | 中 | `aiBridgeService.ts:1406` | 易用性 |
| P4 | 模块扫描静默跳过目录联接（junction） | 中 | `moduleService.ts:92` | 逻辑 |
| P5 | `module.info` 有组件卡正文却只给路径，`hasHumanNotes` 语义矛盾 | 中 | `aiBridgeService.ts:622` 一带 | 信息设计 |
| P6 | `module.info` 的 `enabled`/`installPath` 与当前工作区不一致 | 低 | `aiBridgeService.ts:599` 一带 | 信息设计 |
| P7 | `SKILL.md` 缺前置可行性检查、全局/项目级落点规则 | 中 | `skill-kit/SKILL.md` | 文档 |

---

## 2. 逐条详述

### P1 收费模块门禁报错把人带错方向（最高优先级）

**现象**：MCP 的 `lingbuilder.project.create`（启用 `lingbuilder.new_emoji.ui`）返回：

```
Error: 请先登录并购买该模块，或等待限时免费活动开始。
```

**但实测该授权是有效的**：

- IDE 已登录，Permit 缓存存在（`%APPDATA%\lingbuilder-electron\credentials\module-permits.bin`，543 字节）。
- 本机授权代理正在运行（发现文件 `%APPDATA%\lingbuilder-electron\ai-bridge-local-auth.json`，port 30009，pid 存活的 LingBuilder 进程）。
- 按 CLI 的同一协议（`POST /local-authority/exchange`，`Authorization: Bearer <token>`，body `{"kind":"module-access"}`）
  换取成功，解出的凭据为：

```json
{ "moduleId": "lingbuilder.new_emoji.ui", "source": "free_window",
  "version": 1, "expiresAt": "2026-09-24T13:11:16.489Z", "expired": false }
```

**根因**：MCP 宿主进程在用户打开「允许外部 AI 客户端使用本机授权」**之前**就完成了握手，
其进程环境里没有 `LINGBUILDER_MODULE_ACCESS_STATE`；`cli.ts` 只在**启动时**换一次凭据
（`cli.ts:76-87`），失败后整场会话都不再重试。而 `ModuleAccessService.status()` 在
「没有 Permit」这一种状态下，永远报出「请先登录并购买该模块」——**无法区分「确实没买」
和「进程启动早了」。**

**落点**：`electron/src/services/modules/moduleAccessService.ts:75`

```ts
if (!permit) return { moduleId, paid: true, allowed: false, code: 'MODULE_PAYMENT_REQUIRED',
  reason: '请先登录并购买该模块，或等待限时免费活动开始。' };
```

**建议改法**（两种，建议都做）：

1. **细分根因**。在桥侧（`cli.ts` 换凭据处）保留换取结果，让 `status()`/门禁报错能区分：
   - 换到了凭据但进程未采用 → 「本机授权有效，但当前 AI 宿主的授权状态是启动时取得的，**重启该客户端 / 重连 MCP 即可生效**」
   - 换取失败且原因是「未找到本机授权代理」→ 「请在『帮助 → AI Bridge 连接中心』打开**允许外部 AI 客户端使用本机授权**」（这句现有文案是对的，保留）
   - 既无代理也无本地 Permit → 保留现有「请先登录并购买」文案
2. **允许一次惰性重试**。第一次换取失败后，在 `assertModuleAccess` 失败路径上再尝试一次换取；
   成功则热更新（Permit 缓存到宿主进程生命周期内）。避免「一次握手时序错误惩罚整场会话」。

**验收标准**：
- 在授权开启后再启动的宿主，`project.create` 应直接成功；
- 在授权开启**前**启动的宿主，报错文案必须明确指向「重启客户端/重连 MCP」，且不得出现「请先登录并购买」。

---

### P2 工作区没有自省入口，错了全盘皆错

**现象**：`--workspace .` 由客户端用自身工作目录解析。实测该 MCP 宿主指向
`T:\逆向\拼多多商家版\灵码`，而用户以为在 `T:\electron\lingbuilder\electron`。
**没有任何工具能查证**，直到调用 `lingcpp.diagnostics` 报出：

```
Error: ENOENT: no such file or directory, lstat 'T:\逆向\拼多多商家版\灵码\src\emoji-2'
```

才暴露出来（这条报错也是间接证据，不是直接说明）。

讽刺的是该信息**本来就存在**——CLI 启动时写进 stderr：
`LINGBUILDER_AI_BRIDGE_READY {"host":"stdio","workspaceRoot":"…"}`，
但那是给拉起它的宿主看的，MCP 协议里查不到。

**落点**：
- `electron/src/services/aiBridge/aiBridgeService.ts:296` `listWorkspaceTree()` 返回 `AiBridgeTreeEntry[]`
- `electron/src/services/aiBridge/mcpServer.ts:35` `lingbuilder.workspace.list` 工具描述仅「列出 LingBuilder 工作区文件树。」

**建议改法**（保持 23 个工具不变，**不要**为此加新工具）：

- 让 `lingbuilder.workspace.list` 的返回**带上工作区根绝对路径**。推荐在树数组首位返回一个合成根条目
  （不含 `type`/`children`，或加 `"type": "workspace"` 区分），字段名建议 `workspaceRoot` 或 `path`；
  并在工具 description 里写明「返回内容首项为工作区根绝对路径」，让 AI 一眼确认自己在哪。
- 同时把 `lingcpp.diagnostics` 的 `ENOENT` 建议改成人话：
  「目标文件不在当前 Bridge 工作区内。当前工作区为 `<X>`；如需改为 `<Y>`，请让客户端以该目录重启 MCP 宿主。」

**验收标准**：
- 调用 `workspace.list` 能在响应里读到工作区根绝对路径；
- 工作区错位时，报错文案直接给出当前工作区与修复办法。

---

### P3 `sourceRoot` 硬前缀拒绝「源码就在项目根」的项目

**现象**：项目源码在项目根（`.lcpp` 直接与 `.lingbuilder` 同级，无 `src/` 子目录）时，
按 `sourceRoot: '.'` + `filePath: './MainWindow.lcpp'` 提交 `lingCppSources`，报：

```
项目源码路径不属于当前项目源码目录：./MainWindow.lcpp
```

**根因**：`electron/src/services/aiBridge/aiBridgeService.ts:1406`

```ts
if (!filePath.startsWith(`${sourceRoot}/`)) throw new Error(`项目源码路径不属于当前项目源码目录：${source.filePath}`);
```

`sourceRoot` 为空串时会退化成「要求路径以 `/` 开头」；用 `'.'` 时 `normalizeFilePath`
把前导 `./` 保留、而 `${'.'}/` 恰好能匹配——**但一旦传入的路径被规范化掉 `./`，
或 sourceRoot 为空串，就必须把源码移进子目录才能通过**，而报错完全没提示这一点。

（对比：同文件 `:1113` / `:1554` 使用 `projectRef.sourceRoot || '.'` 有兜底，而 `:1397`
的 `sourceRoot` **没有兜底**——同一概念在代码里有两个不同口径。）

**建议改法**：
- `:1397` 加统一兜底（`|| '.'` 或 `|| ''`），空串/点号语义统一；
- 前缀校验对 `sourceRoot` 为 `.` 或空串的情况放行项目根文件；
- 报错文案补充可用信息，例如：
  「项目源码路径不属于当前项目源码目录：`./MainWindow.lcpp`（本项目 sourceRoot = `src`）。
  源码位于项目根目录时请把 sourceRoot 设为 `.`，或把 .lcpp 移入 `src/`。」

**验收标准**：
- `sourceRoot: '.'` 且 `filePath: 'MainWindow.lcpp'`（无前导 `./`）能通过；
- 报错时文案包含当前 `sourceRoot` 与两种修法。

---

### P4 模块扫描静默跳过目录联接（junction）

**现象**：为省磁盘用 `mklink /J` 把模块目录接进工作区 `.lingbuilder\modules\`，构建报：

```
当前窗口使用 new_emoji 后端，但项目尚未启用 lingbuilder.new_emoji.ui 模块。
```

而 `project-modules.json` 里该模块**已启用**、清单也能手动读到。改用**真实复制**（16.9 MB / 208 文件）后立刻通过。

**根因**：`electron/src/services/modules/moduleService.ts:92`

```ts
for (const entry of entries) {
  if (!entry.isDirectory()) continue;   // ← Node 对 junction 返回 isDirectory(): false
  …
}
```

`fs.readdir(withFileTypes)` 在 Windows 上把目录联接（reparse point）标为
`isSymbolicLink(): true` / `isDirectory(): false`，于是整个模块被静默跳过——**没有任何诊断**。
而 `<工作区>\.lingbuilder\modules` 是模块的**正式安装位置**，用联接省空间是开发者的自然选择。

**注意**：同文件 `:894` 已有 `if (!entry.isDirectory() || entry.isSymbolicLink()) continue;`，
说明另一处扫描是**显式**处理符号链接语义的——两处口径不一致。

**建议改法**（二选一，建议前者）：
- 识别 reparse point 并按目录处理：`entry.isDirectory() || entry.isSymbolicLink()`，
  随后用 `fs.stat()`（跟随链接）确认真是目录，再读取清单；
- 或保持跳过，但**必须给中文诊断**：「模块目录 `<name>` 是目录联接，当前扫描会跳过；
  请改用真实目录（复制模块）或使用开发源链接」。

**验收标准**：
- 用 `mklink /J` 接的模块能被识别为已安装/已启用；
- 若仍不支持，必须给出上述中文诊断，不得静默跳过。

---

### P5 `module.info` 有组件卡正文却只给路径，且 `hasHumanNotes` 语义矛盾

**现象**：为查清 `RichList` 怎么用，外部 AI 被迫连试四步：
`grep` asar（输出超限失败）→ `file.search`（拿到相对路径，还需反推模块根）→
`module.info control`（拿到卡片路径，正文被 `truncated: true` 截断）→
**最后自己用文件工具读 `<模块目录>\docs\lingbuilder-components\rich-list.md`**。

**问题**：
1. `module.info` 明明知道卡片在哪（响应里有 `absolutePath`），`hasHumanNotes: true` 也说明有红线，
   却把正文截断，要求 AI 再读一次文件——多一次往返、多一份上下文成本。
2. **内容自相矛盾**：`icon.md` 的「惯用要点与红线」段内容是
   「待补：本卡目前只有清单派生的客观契约，尚无人工红线段。」，同时该卡的 `hasHumanNotes` 是 `false`。
   也就是说「红线缺失」被写进了一个**看起来像红线正文**的段落里。AI 读到会误以为拿到了红线，
   实际拿到的是「我还没写」。`rich-list.md` / `listbox.md` 等有真红线的卡片也是同一段落结构，
   无法从段落本身区分「有红线」和「待补」。

**落点**：`electron/src/services/aiBridge/aiBridgeService.ts:622` 一带（`readUiExampleContent` / `componentGuide` 装配处）

**建议改法**：
- `hasHumanNotes: true` 时**内联「惯用要点与红线」段正文**（实测几百字，含「JSON 整串用中文引号 `“ ”` 包裹」
  这类硬红线，价值极高），不要只给路径；确需截断时把 `COMPONENT_GUIDE_MAX_CHARS` 调大或只截命令族那段。
- 红线缺失时**整段不输出**，或改为机器可判字段（如 `humanNotesStatus: "missing"`），
  禁止用散文「待补」占据红线段落。

**验收标准**：
- 一次 `module.info control=富列表` 调用即可拿到可粘贴骨架 + 属性枚举 + 红线正文；
- `hasHumanNotes: false` 的卡片不会返回任何看起来像红线的内容。

---

### P6 `module.info` 的 `enabled` / `installPath` 与当前工作区不一致

**现象**：不传 `projectId` 调用 `module.info`，返回：

```json
{ "id": "lingbuilder.new_emoji.ui", "enabled": false,
  "installPath": "T:\\逆向\\拼多多商家版\\灵码\\.lingbuilder\\modules\\lingbuilder.new_emoji.ui" }
```

但该模块在**当前工作区**是已安装且已启用的。这两个字段来自**另一个工作区/IDE 实例**，
对外部 AI 是误导——它可能据此判断「模块没启用」而去做无用的启用操作。

**建议改法**：
- `enabled` 明确标注其作用域（如 `enabledForProject: <projectId>` 或缺省时用当前工作区）；
- `installPath` 若是其他工作区的路径，加 `installPathSource: "other-workspace"` 之类的标记，
  或在没有 `projectId` 时返回工作区内的安装路径。

**验收标准**：响应中不存在「指向其他工作区且未标注」的路径字段。

---

### P7 `SKILL.md` 缺前置可行性检查与落点规则

实测依据（逐条都有对应事实）：

1. **收费模块的红线被埋在最后**。步骤 3 第一步就是 `project.create`，而 new_emoji 是收费模块、
   必须先开本机授权——但这条写在**第 4 步的最后一段**。AI 会先撞门禁再回头找原因。
2. **通篇没提构建架构**。`new-emoji-fbro-browser-shell` 模板要 x64，而工作区默认是 Win32。
   实测构建输出落在 `Win32\Debug`，与预期不符。
3. **只有每个客户端的工作区级落点，没有全局落点规则**。用户要求「全局安装」时，
   AI 只能自行决定全局配置文件位置（本次落在 `~/.codex/config.toml`）。
4. **未说明哪些文件是本技能的交付物、哪些是脚手架**。本次我创建了 5 个工作区配置/模块文件
   （`solution.json`、`build-configuration.json`、`project-modules.json`、模块目录、`build-request.json`），
   收尾时无法判断该不该清理。
5. **未给 `--workspace .` 落错的判断方法**（配合 P2）。
6. **未说明同一产品两条入口权限不一致**：MCP 的 `project.create` 挂 `assertModuleAccess`，
   而 CLI 的 `project build` 路径**不挂**（`cli.ts:186` 构造 `AiBridgeService` 时未传 `assertModuleAccess`，
   落到默认空实现 `aiBridgeService.ts:263`）。这属于产品决策，需要在文档里写明，
   否则 AI 会以为是自己的配置问题。
7. **模板与工具描述未覆盖全部能力**：`project.templates` 返回 6 个模板，
   指引只点名 `hello-window` / `sqlite-crud-window`，未提 `new-emoji-fbro-browser-shell`（唯一带 new_emoji 的）。

**建议改法**：在 `SKILL.md` 第 0 步之后插入**「第 0.5 步：可行性前置检查」**，至少覆盖：
目标模块是否收费/要不要本机授权/去哪开 → 目标架构（并说明 `build-configuration.json` 只认顶层
`mode` + `architecture`）→ 本次是全局还是工作区安装及对应文件路径 → 构建/授权失败时该看哪条诊断。
并在第 2 步补「用 `workspace.list` 确认工作区根」这一动作。

**落点注意（两处副本必须同步）**：
- 仓库源：`electron/skill-kit/SKILL.md`（7727 字节，另有同目录 `manifest.json`）
- 打包产物：`resources/skill-kit/SKILL.md`（由安装包分发，内容应与源一致）
- **官网在线版：`cloud/admin/docs/guide/ai/skill.md`（3893 字节）**——`SKILL.md` 正文明确承诺
  「若 IDE 的『灵码 Skill』窗口提示官网已发布更新版，应以更新版为准」，
  因此只改本地快照而不同步在线版，会让「离线快照 vs 官网更新版」出现内容分叉。
  改动时请同时核对 `tests/skillKit.test.ts` / `tests/skillCatalogRemote.test.ts` 的断言与清单版本号。

**验收标准**：一个全新 AI 客户端只读 `SKILL.md`，不读其他文档，即可在第一次调用 `project.create` 前
知道「这个模块要不要授权、该开哪个开关、目标架构是什么」。

---

## 3. 约束与红线（必须遵守）

1. **保持 23 个 MCP 工具不变**。P2 必须通过增强 `workspace.list` 返回实现，
   **禁止**为此新增 `workspace.info` 之类工具；`tests/aiBridge.test.ts:90` 有 `tools.length === 23` 断言。
2. **改 `MCP_INSTRUCTIONS`（`mcpServer.ts:14-32`）或工具描述后必须重建 bundle**：
   ```bash
   cd electron
   npx esbuild src/cli.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/cli.cjs
   ```
   外部 stdio 宿主只从 bundle 取 instructions，**不重建等于没改**。
3. `tests/aiBridge.test.ts:112-155` 是 instructions 的关键词锚点，新增条款必须同步补
   `assert.match` / `assert.doesNotMatch` 断言。
4. **所有面向用户/外部 AI 的文案一律中文**，错误信息要说清「为什么 + 怎么修」，不许只说「失败」。
5. **fail-closed 不得放宽**：P1 允许「细分报错 + 惰性重试」，但**不得**为了通过而静默放行收费模块。
6. **不要改动 `permission` 语义**：`preview` 模式下写入/构建仍需显式 `approved=true`。
7. 改动若涉及 AI Bridge 行为/门禁，按仓库规则同步 `AGENTS.md`「AI Bridge 实现规则」节与当天
   `更新记录/YYYY-MM-DD.md`。

---

## 4. 建议的实施顺序

| 批次 | 内容 | 理由 |
|---|---|---|
| 第 1 批 | P1 + P2 + P3 文案 | 三条都决定「AI 会不会卡住或走错路」 |
| 第 2 批 | P4 + P5 | 静默跳过与信息缺失，属「看起来能跑但是错的」 |
| 第 3 批 | P6 + P7 | 打磨，但直接提升首次生成成功率 |

---

## 5. 验收清单

- [ ] 授权开启后再启动的宿主：`project.create`（含收费模块）直接成功
- [ ] 授权开启前已启动的宿主：报错明确指向「重启客户端/重连 MCP」，不出现「请先登录并购买」
- [ ] `workspace.list` 响应可读到工作区根绝对路径（工具数仍为 23）
- [ ] 工作区错位时 `lingcpp.diagnostics` 报错给出「当前工作区 X + 如何改为 Y」
- [ ] `sourceRoot: '.'` + 项目根 `.lcpp` 能通过；失败时报错含 sourceRoot 与两种修法
- [ ] `mklink /J` 接入的模块能被识别，或有明确中文诊断（不静默）
- [ ] `module.info control` 一次调用即可拿到红线正文；`hasHumanNotes: false` 不输出红线样式内容
- [ ] `module.info` 不再返回未标注来源的跨工作区路径
- [ ] `SKILL.md` 新增第 0.5 步并通过「新客户端只读本文档」的可执行性检查
- [ ] `dist/cli.cjs` 已重建；真机 stdio 握手复验 23 工具与 instructions 新条款
- [ ] `tests/aiBridge.test.ts` 全绿（含新增断言）
