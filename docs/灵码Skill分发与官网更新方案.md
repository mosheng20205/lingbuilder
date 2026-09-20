# 灵码 Skill 分发与官网更新方案

状态：P0 已落地（2026-09-19，含 dev 真机端到端验收）；P1-P3 待实施，见 §7。

## 1. 目标

客户机器上只要装过 LingBuilder IDE，就能通过一个 Skill 让任意 AI 客户端自动连上本机 AI Bridge，进而用中文 `.lcpp` 编写、构建、运行和修改工程。

三处归属固定，不再改动：

| 内容 | 归属 | 更新方式 |
| --- | --- | --- |
| `SKILL.md` 正文与配置模板措辞（给 AI 读的对外正文） | **随 IDE 安装包内置**（`resources/skill-kit/`，离线可用） | 联网时先查官网 API 取最新版；**官网管理后台可维护**；取不到才回退包内快照并标注版本来源 |
| 轻窗口（版本、一键复制指令、状态、广告位） | LingBuilder IDE 主进程按需创建的独立窗口，零新增 exe | 随 IDE 发版 |
| 开源「灵码 Skill」仓（Apache-2.0） | **只放协议与工具**：manifest schema、签名/防回滚校验、占位符版配置骨架、发现器与自检脚本、CI 基线 | 独立仓库迭代 |

**文案措辞不进开源仓**：正文唯一真源是 IDE 仓库内的 `electron/skill-kit/`，由官网后台签名下发；开源仓自编译者拿到的只是骨架，不含可独立使用的完整指引。

## 2. 已验证事实（2026-09-19，`npm run smoke:ai-bridge-stdio`）

验证脚本：`electron/scripts/smoke-ai-bridge-stdio.ts`，手写 newline-delimited JSON-RPC 客户端，覆盖 dev 与打包两种宿主形态，35 项断言全过、`npx tsc --noEmit` 干净、收尾零残留进程。

| 结论 | 证据 |
| --- | --- |
| stdio 通道可行且稳定 | 23 工具全返回；打包宿主握手 p50 389ms（dev tsx 896ms） |
| stdout 传输纯净 | 含真实 MSVC 构建全程，所有 stdout 行均为合法 JSON-RPC，无杂散输出 |
| 关 stdin 即退出 | 6/6 轮自动退出，`StdioServerTransport` 在 EOF 时收尾，无需额外挂 stdin 监听 |
| 客户端被强杀不残留 | 父进程 `SIGKILL` 后 15s 观察窗内宿主随管道断裂退出 |
| 真实业务链可跑通 | `project.create` → `diagnostics`（0 error）→ `edit.propose`（`edits` 增量）→ `apply` 落盘 → `build.run` 出 exe；控制台模板 `run:true` → `run.wait` 取 `exitCode=0` → `run.log` 读回输出 |
| **node 模式宿主不独占 `app.asar`** | 宿主存活期间对 `app.asar` 建硬链接并改名成功（改名需 DELETE 共享权限） |
| 改名副本技术可行 | `lingbuilder-cli.exe` 硬链接副本可跑 CLI 并完成 stdio 握手（**已决定不采用**，见 §5.1） |

`LINGBUILDER_AI_BRIDGE_READY` 行仍走 stderr，宿主可解析；`instructions` 实测 2013 字符（`initialize` 返回，不是 `tools/list`）。

## 3. 架构分层

### L1 本机执行面（LingBuilder 仓库）

- **stdio MCP 宿主**：`LingBuilder.exe` + `ELECTRON_RUN_AS_NODE=1` + `resources/app.asar/dist/cli.cjs ai-server --mcp --stdio-only`。不监听端口、不使用 token、不独占 `app.asar`。
- **不走启动器**：托管配置的 `command` 必须直指主程序 exe，禁止指向 `lingbuilder.cmd`——历史上锁死 `app.asar` 的是经启动器复活的 GUI 进程。
- **本机授权代理**：stdio 宿主缺少 `LINGBUILDER_MODULE_ACCESS_STATE` / `LINGBUILDER_FBRO_VIP_KEY` 时，向正在运行的 IDE 主进程换取。

### L2 灵码 Skill 仓库（独立开源，Apache-2.0）

纯脚本 + Markdown，不含可编译执行体，不含任何 AI 客户端的桌面版/CLI 版适配代码。**文案措辞不进开源仓**（2026-09-19 批复）：

- 开源仓只放**结构与工具**：清单 schema、发现器与安装校验脚本、`tests` 与 CI、README（说明"正文由 LingBuilder 官方签名清单下发，本仓库不含可独立使用的完整指引"）。
- `SKILL.md` 中文正文与其配置模板措辞留在 LingBuilder 仓库快照（`electron/skill-kit/`）+ 官网签名清单下发；自编译者拿到的只是空骨架，护城河落在签名与直链上。
- 同步方向固定为单向：IDE 仓库快照 → 开源仓的 schema/测试；**禁止**把中文正文整篇搬进开源仓，也禁止在开源仓里独立改正文。

开源仓交付物：

- 清单 schema 与 `manifest` 校验（与 `tests/skillKit.test.ts` 同源规则）；
- 发现器说明：`where lingbuilder` → INSTDIR → `resources/app.asar/dist/cli.cjs`；
- 漂移门禁：托管配置块必须与 `createManagedBlock` 逐要素同形（见 §6）；
- CI 基线：引用 IDE 侧 `npm run smoke:ai-bridge-stdio` 的验收口径。

### L3 官网控制面

管理后台「Skill 发布」页 + Skill 详情页（含广告位），远端更新管线**复用 SDK 直链那套已上线机制**：Ed25519 整条签名、`sequence` 单调防回滚、锚定字段与可更新字段二分、信任锚硬编码在 IDE 发版里。

## 4. 分发与安装时序

1. 轻窗口点「安装 Skill」→ 主进程请求 `GET /v1/site/skill-catalog`；
2. 远端 `sequence` 高于本地 → 下载签名包，验签 + 锚定字段逐字比对 + 防回滚，逐文件按清单 `downloadUrl` 取正文（落 `%APPDATA%\lingbuilder-electron\skill-kit\`）。直链**必须挂持久静态资源桶** `/update-assets/`（现网：`https://lingbuilder.com/update-assets/skill-kit/SKILL.md`），**不得放 `/docs/` 下**——该目录是 VitePress 构建产物，文档重新发布时整目录替换，会把正文打成 404；
3. **远端不可达或验签失败 → 回退包内离线快照**（`resources/skill-kit/`），并在窗口和复制出的指令里显式标注版本号与 `离线快照` 来源；
4. 窗口渲染一条一键复制指令，内含本机 markdown 绝对路径：

   > 请读取 `<skill-kit 绝对路径>\SKILL.md`，按其中步骤把 LingBuilder 的 AI Bridge 能力安装到你自己的配置中；完成后回读校验，并把要写入的配置块原样给我确认。

5. 用户自行粘贴发送给任意 AI 客户端，由该客户端读文档、写自身配置；IDE 侧不代写任何第三方客户端文件。

## 5. 关键决策

### 5.1 不做改名宿主副本

`LingBuilder.exe` 实测 225MB，改名副本会让安装包体积不可控增长，而 §2 的改名锁探测已证明 node 模式 stdio 宿主不挡安装器。结论：不复制、不改名，只把「`command` 直连 exe、永不走启动器」固化为契约。安装器现有的 `installer.nsh` 四件套保留不动，作为 GUI 被复活场景的兜底。

### 5.2 授权走本机代理

`electron/src/cli.ts` 只从环境变量读模块授权状态，而自动拉起的 stdio 宿主环境里只有 `ELECTRON_RUN_AS_NODE`，因此外部 AI 连上后启用收费模块必被权益门禁拒绝。FBro VIP key 同理。

代理边界：只绑 `127.0.0.1`；换取码一次性消费；返回值只驻内存，不落盘、不进审计日志正文、不回显；IDE 未运行时保持现有 fail-closed 中文诊断。安全边界仍是"同一 Windows 登录用户"，与 `safeStorage`/DPAPI 既有边界同级，未额外放宽。

### 5.3 广告位与能力判定解耦

广告只出现在轻窗口与官网 Skill 详情页，形态为静态横幅 + 信息卡（可关闭、记住选择），不采集行为数据。拉取失败、被拦、离线一律渲染空白占位，**绝不影响 Skill 下载、验签与安装**。

### 5.4 开源与签名

仓库开源意味着用户可自编译去广告，这是既定代价。不可复制的是官网签名清单与直链：自编译版本拿不到合法签名更新，只是一份静态快照。此点需在 Skill 仓库 README 明说。

## 6. 漂移红线

1. Skill 文档中的托管配置模板必须与 `electron/electron/codexDesktopIntegrationService.ts` 的 `createManagedBlock` 输出逐字同形状（含 `--mcp --stdio-only` 参数序、`env` 字段、审批模式字段）。二者任一改动都要同步另一处、`LingBuilder AI 规则手册.md`、`electron/README.md` 与当天更新记录，否则会出现"照文档装好了但 IDE 判定未配置"。
2. Skill 包随 IDE 安装包分发必须走 `build.extraResources`，打包后解包验证 `resources/skill-kit/` 完整性——不得重演 `examples/` 不随包导致打包版取不到语料的已知边界。
3. Skill 信任锚随 IDE 编译发布；未发带新锚的 IDE 前不得切换云端签发密钥（与 SDK 清单同规则）。

## 7. 分期

- **P0（2026-09-19 已完成）** 授权代理 + `command` 口径固化 + `skill-kit` 目录与随包 + 解包验证
  - `localAuthorizationService.ts` / `localAuthorizationClient.ts` / `aiBridgeStartSettings.externalModuleAccess` / 连接中心勾选框；回归 `tests/localAuthorization.test.ts`、`tests/aiBridgeStartSettings.test.ts`。
  - `validateHostExecutable` 拒绝启动器脚本；回归 `tests/codexDesktopIntegration.test.ts`。
  - `electron/skill-kit/{SKILL.md,manifest.json}` + `extraResources` + `verify:skill-kit-release` / `verify:skill-kit-installer`（已并入 `package:win`）；漂移门禁 `tests/skillKit.test.ts`。
- **P1** 独立开源仓 MVP：清单 schema、发现器与校验脚本、占位符版配置骨架、CI（引用 `smoke:ai-bridge-stdio` 口径）与 README；**不含 `SKILL.md` 中文正文**
- **P2（2026-09-19 已上线，生产 sequence 1）** 云端 `skill-catalog`（控制器/服务/迁移/管理后台发布页）+ 多客户端模板
  - 代码：`cloud/api/src/website/skill-catalog-{signing,service,controller}.ts`、`SkillCatalogRelease` 表 + 迁移 `202609190001_skill_catalog`、`cloud/admin/src/SkillCatalogAdmin.tsx` + `skillCatalogAdminModel.ts`（导航「灵码 Skill 发布」）；api 侧 `tests/skill-catalog.test.ts` 9/9 + admin 侧 `tests/skill-catalog-admin.test.ts` 7/7，两侧 `tsc` 与 `vite build` 干净。
  - IDE 消费方：`electron/electron/skillKit/`（验签 + 防回滚 + 锚定比对 + 逐文件 SHA-256 下载 + 失败只降级）、IPC `skill-kit:status|check-update`、连接中心「灵码 Skill 正文」小节（含一键复制指令）、门禁 `npm run skill-catalog:check`；回归 `tests/skillCatalogRemote.test.ts`。
  - 生产已落地：`SkillCatalogRelease` DDL 手工执行（`_prisma_migrations` 按本机既有惯例不登记，容器不在启动期跑 `migrate deploy`）、正文直链挂 `/update-assets/skill-kit/`、后台首发经容器内运行器完成（`sequence 1` / `version 0.1.0` / `keyId 450c46062258e2d4`）、`skill-catalog:check` 线上为绿、admin 页面已随镜像重建上线、`SkillKitService` 真机跑通 `source:"remote"` 并落缓存。
  - 首发运行器：`.deploy/make-skill-catalog-payload.cjs`（从仓库 manifest 算 payload，中文一律从盘读）+ `.deploy/publish-skill-catalog.mjs`（复刻 `createRelease` 语义，docker cp 进 `app-api-1` 执行，审计主体取库内 SUPER_ADMIN）；后续常规发布仍走后台页面。
- **P3** 轻窗口（按需 `BrowserWindow`，非常驻、无托盘）+ 官网详情页 + 广告位
- **P4** 文档与门禁收口：AGENTS.md、规则手册、`electron/README.md`、`docs/FUTURE_OPTIMIZATIONS.md`、当天更新记录
