# EdgeView 文档完整化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 EdgeView 的公开文档与集中式 API 目录、事件目录和运行时覆盖清单保持一致，并可由门禁自动验证。

**Architecture:** 以 `edgeViewApiCatalog.ts` 为命令单一事实源，新增生成式完整 API 参考文档；保留事件参考生成器作为事件单一事实源。用户指南只负责入门和导航，完整 API 细节通过模块文档和可复制示例提供。

**Tech Stack:** TypeScript/tsx、Node.js、Markdown、现有 npm 文档生成脚本。

## Global Constraints

- EdgeView 当前版本提供 271 条命令（235 条安全 API、36 条兼容命令）和 71 项普通 HWND 事件。
- `.lcpp` 控件参数必须使用裸 `controlRef`，处理器参数必须使用 `&处理器名`。
- 文档必须保持 UTF-8，中文命令、参数、诊断和版本要求不得退回英文或旧统计口径。
- 不改变 EdgeView 运行时 API，只补齐文档生成、导航和校验。

---

### Task 1: 修复 API 覆盖率检查脚本的目录加载

**Files:**
- Modify: `electron/scripts/generate-edgeview-api-coverage.cjs`
- Test: `electron/scripts/generate-edgeview-api-coverage.cjs` via npm scripts

- [ ] **Step 1:** 检查 `edgeViewApiCatalog.ts` 的本地依赖并让覆盖率脚本可在 Node 中解析。
- [ ] **Step 2:** 运行 `npm run module:edgeview-coverage:check`，确认不再因 `./bindingValueType` 失败。
- [ ] **Step 3:** 运行 `npm run module:edgeview-coverage:complete`，确认 `pending=0`、命令数为 271。

### Task 2: 生成完整 EdgeView API 参考文档

**Files:**
- Create/Modify: `electron/scripts/generate-edgeview-api-doc.ts`
- Create: `electron/docs/modules/edgeview/API.md`
- Modify: `electron/package.json`

- [ ] **Step 1:** 从 `EDGEVIEW_SAFE_API_COMMANDS` 和兼容命令生成 271 条命令表，包含分组、签名、返回类型、参数类型、版本/能力要求、可见性和说明。
- [ ] **Step 2:** 在文档中加入 controlRef、异步任务五态、处理器引用、Runtime 141/150、错误返回和安全边界说明。
- [ ] **Step 3:** 增加 `module:edgeview-api-docs` 与 `module:edgeview-api-docs:check` 门禁。
- [ ] **Step 4:** 运行生成和 check，确认文档条目数为 271 且无漂移。

### Task 3: 统一模块入口与用户指南

**Files:**
- Modify: `electron/src/services/modules/builtinModules.ts`
- Modify: `cloud/admin/docs/guide/user/modules/edgeview.md`
- Modify: `examples/module-demos/lingbuilder.edgeview/src/README.md`

- [ ] **Step 1:** 将模块 manifest 的 docs[] 同时登记事件参考和完整 API 参考。
- [ ] **Step 2:** 用户指南增加完整 API、故障排查、权限/安全、异步任务和响应正文示例入口。
- [ ] **Step 3:** 示例 README 标明其 271 条清单由 API 文档生成/校验，不再成为独立事实源。

### Task 4: 文档回归验证与更新记录

**Files:**
- Modify: `更新记录/2026-09-03.md`

- [ ] **Step 1:** 运行事件文档、API 文档和 API 覆盖率门禁。
- [ ] **Step 2:** 运行相关 lint/build 或最小 TypeScript 校验。
- [ ] **Step 3:** 记录更新内容、影响范围和验证结果。
