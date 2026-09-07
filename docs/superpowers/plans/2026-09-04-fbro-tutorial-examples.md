# FBro 教程示例项目 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 FBro 指纹浏览器合集 11 集口播稿创建可迁移、可录制并完成真实构建验证的独立 LingBuilder 示例项目。

**Architecture:** 每集一个独立 `.lingbuilder` 项目，共享根目录测试资源；项目模型、模块清单、`.lcpp` 源码、构建请求、README、录制记录和验证报告一起落盘。验证复用现有 CLI 构建、Win32 C++ 生成器和 MSBuild/FBro smoke 机制，凭据只存在进程环境。

**Tech Stack:** LingBuilder `.lcpp`、JSON 项目模型、现有 FBro/Win32/CDP 内置模块、TypeScript CLI、MSBuild x64 Release、PowerShell。

**Spec:** `docs/superpowers/specs/2026-09-04-fbro-tutorial-examples-design.md`

## Global Constraints

- 中文优先，菜单、源码注释、README、录制记录和诊断说明使用中文。
- 所有控件参数必须使用裸 `controlRef`；所有事件处理器参数必须使用 `&处理器名`。
- 不写入 Permit、Key、Cookie、Profile、真实账号、代理密码或绝对路径。
- FBro 04 无有效 VIP 时只展示安全失败诊断，不伪造授权成功。
- 项目必须能复制到新目录后重新生成；不依赖 `.lingbuilder-build` 或 `generated/cpp` 作为源码输入。
- 涉及构建/运行/任务日志时同步核对 `docs/FUTURE_OPTIMIZATIONS.md`。
- 完成当天在根目录 `更新记录/2026-09-04.md` 汇总实际更新和验证结果。

---

### Task 1: 建立共享测试资源和项目脚手架

**Files:**
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-resource-demo/index.html`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-resource-demo/style.css`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-resource-demo/app.js`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-resource-demo/logo.svg`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-form/index.html`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/downloads/lingbuilder-fbro-demo.txt`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fixtures/fbro-vip-sanitized.json`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/README.md`

**Interfaces:**
- Produces stable local URLs, selectors `#name/#city/#interest-email/#contact-phone/#submit/#result`, and deterministic resource text used by Tasks 4, 7, 8, 9, 10, and 11.

- [ ] **Step 1: Write deterministic test pages and fixtures**

  `index.html` must reference local `style.css`, `app.js`, and `logo.svg`; the form must submit to a local result block without network calls. The download fixture must contain a short UTF-8 text payload. The VIP fixture must contain only redacted fields such as `"device":"demo"`, never a real key.

- [ ] **Step 2: Validate resource references and selectors**

Run: `node -e "const fs=require('fs'); const p='AI 视频自主生产/FBro 指纹浏览器合集/共享测试资源/fbro-form/index.html'; const t=fs.readFileSync(p,'utf8'); for(const s of ['#name','#city','#interest-email','#contact-phone','#submit','#result']) if(!t.includes(s)) throw new Error(s); console.log('ok')"`

Expected: `ok`.

- [ ] **Step 3: Document reuse and safety**

`共享测试资源/README.md` must list every selector, local file purpose, and the no-credentials/no-real-account rule.

### Task 2: Create episode 01–03 projects

**Files:**
- Create under each of `01 FBro 入门/示例项目`, `02 浏览器管理器/示例项目`, `03 会话隔离/示例项目`: `src/.lingbuilder/solution.json`, `src/.lingbuilder/project-modules.json`, `src/.lingbuilder/window-designer.json`, one or more `.lcpp` files, `build-request.json`, `README.md`, `录制准备记录.md`, `验证报告.md`.

**Interfaces:**
- Consumes shared resources from Task 1 and existing FBro project schema from `examples/fbro-browser-simple-demo` and `examples/fbro-multi-browser-demo`.
- Produces copyable projects with valid control IDs, event bindings, and module pins.

- [ ] **Step 1: Implement episode 01 minimal navigation project**

Use `FBroBrowser` control `浏览器1`, `processMode: "in-process"`, and `.lcpp` calls `FBro_绑定事件(浏览器1, "加载状态改变", &浏览器1_加载状态改变)` and `FBro_导航(浏览器1, "https://example.com")`; keep `浏览器1` unquoted.

- [ ] **Step 2: Implement episode 02 manager layout**

Create stable controls for instance list, page tabs, address input, download details, and progress. Wire manager initialization/new/switch operations using the current public bindings; if a manager binding is not available in the current catalog, keep the project on the documented browser-manager module and record the exact fallback in `README.md` rather than inventing a command.

- [ ] **Step 3: Implement episode 03 isolation project**

Create two FBro controls with distinct relative cache directories and a stable workspace key. Set UserAgent before creation and use session commands only on the current instance. Use redacted test markers instead of credentials.

- [ ] **Step 4: Add per-episode recording and verification documents**

Each `README.md` maps S1–S7 to controls/code/output; `录制准备记录.md` lists preflight and cleanup; `验证报告.md` starts with an explicit `待执行` status until Task 7 runs the project.

### Task 3: Create episode 04–07 projects

**Files:**
- Create under `04 指纹配置/示例项目`, `05 三种宿主模式/示例项目`, `06 事件驱动/示例项目`, `07 获取资源响应/示例项目` the same project files as Task 2.

**Interfaces:**
- Consumes Task 1 resources and Task 2 project conventions.
- Produces safe VIP, host-mode, event, and response-metadata demos.

- [ ] **Step 1: Implement episode 04 with redacted VIP fixture**

Read the fixture JSON as text and call `FBro指纹_应用配置` only with the redacted fixture. Log only the return code, `FBro_取最近错误`, and whether an environment credential was present; never print the credential or raw fingerprint JSON.

- [ ] **Step 2: Implement episode 05 host-mode comparison**

Place three FBro controls using `in-process`, `independent-embedded`, and `independent-window`; bind creation/error handlers and show process status/ID/port in a text area.

- [ ] **Step 3: Implement episode 06 event project**

Use `FBro_绑定事件`, `FBro_取事件数据`, `FBro_取事件字段`, and safe synchronous result handling. Every callback reference must use `&`.

- [ ] **Step 4: Implement episode 07 response metadata project**

Load the local resource page, bind the public resource response/load-complete events, and output only URL/statusCode/mimeType/status/receivedBytes. Do not call undocumented response-body or filter commands.

- [ ] **Step 5: Add docs and explicit public-API limitations**

Record the exact current event names and any fallback in each `README.md`; keep `验证报告.md` pending until Task 7.

### Task 4: Create episode 08–10 projects

**Files:**
- Create under `08 CDP 自动化/示例项目`, `09 网页填表/示例项目`, `10 下载截图打印/示例项目` the same project files as Task 2.

**Interfaces:**
- Consumes Task 1 selectors/download fixture and Tasks 2–3 module conventions.
- Produces projects that use independent FBro hosts only where CDP is required.

- [ ] **Step 1: Implement episode 08 CDP project**

Set FBro to `independent-embedded`, enable DevTools, read `FBro_取调试端口`, then use the current CDP module commands to query title/element and click a local test button. Keep the port on loopback and log only numeric status.

- [ ] **Step 2: Implement episode 09 form project**

Use selectors from Task 1 to input text, set the select value and dispatch `change`, click checkbox/radio/submit, then read `#result`. Use only local test data.

- [ ] **Step 3: Implement episode 10 transfer project**

Use the current public transfer commands for download, screenshot and PDF/print; bind progress/status controls and clean outputs at the end. If a command is asynchronous, wait through the documented task API instead of sleeping.

- [ ] **Step 4: Add recording docs**

Document the 1920×1080 DIP requirement for episode 08 code shots, local selectors for episode 09, and output cleanup paths for episode 10.

### Task 5: Create episode 11 integrated project

**Files:**
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/11 综合项目/示例项目/**`
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/11 综合项目/共享测试资源说明.md`

**Interfaces:**
- Consumes project conventions and shared resources from Tasks 1–4.
- Produces the final multi-workspace workbench used for the closing recording.

- [ ] **Step 1: Define integrated layout and stable IDs**

Use an instance list, page tabs, address bar, status/log area, download details/progress, and browser viewport. Keep stable IDs and relative cache/profile configuration.

- [ ] **Step 2: Wire the safe end-to-end flow**

Initialize manager, create two test instances, bind navigation/popup/resource metadata events, run CDP title/click on the independent host, then download the public fixture. Do not log Cookie or credential values.

- [ ] **Step 3: Add final recording and cleanup runbook**

Map S1–S7 to a two/three-shot recording sequence and include process cleanup, output cleanup, and “error list = 0” checks.

### Task 6: Static project validation

**Files:**
- Modify each episode `验证报告.md`.
- Create: `AI 视频自主生产/FBro 指纹浏览器合集/validate-examples.ps1`

**Interfaces:**
- Consumes all 11 `build-request.json` files.
- Produces deterministic JSON/Markdown validation output without using generated build folders as source.

- [ ] **Step 1: Validate JSON and source invariants**

The script must parse every solution, module manifest, designer model, and build request; assert project IDs agree, referenced source files exist, all FBro control references are unquoted, and handler references contain `&`.

- [ ] **Step 2: Run the script**

Run: `powershell -NoProfile -File 'AI 视频自主生产/FBro 指纹浏览器合集/validate-examples.ps1'`

Expected: exit code 0 and one line per episode with `结构校验通过`.

- [ ] **Step 3: Update pending reports with static results**

Record the script version/date and any intentionally deferred runtime prerequisite in each report.

### Task 7: Real build and runtime verification

**Files:**
- Modify each episode `验证报告.md`.
- Create temporary outputs only under `.lingbuilder-build/tutorial-fbro-*` or the project’s ignored build directory.

**Interfaces:**
- Consumes validated projects from Tasks 2–5 and the existing `electron/dist/cli.cjs`, MSBuild, FBro SDK, and optional authorized VIP environment.
- Produces build commands, executable paths, runtime observations, and cleanup status.

- [ ] **Step 1: Build each project through the LingBuilder CLI**

Run from `electron/` with `node dist/cli.cjs project build --request <absolute build-request> --workspace <absolute project> --yes --json`; reject any non-empty blocking diagnostics.

- [ ] **Step 2: Export/build x64 Release**

Use the existing project export/MSBuild path and confirm `.sln`, `.vcxproj`, generated C++, required FBro runtime/bridge, and x64 Release exe exist.

- [ ] **Step 3: Run episode-specific smoke checks**

01/03/05/06/07/11: window/Host lifetime and expected sanitized logs. 08/09: loopback CDP port and test-page action. 10/11: download/screenshot/PDF existence followed by deletion. 04: authorized success only if the environment provides valid authorization; otherwise record safe Chinese failure diagnostics and a clean exit.

- [ ] **Step 4: Clean processes and temporary outputs**

Terminate only the executables/Host processes started by the verification run, verify no LingBuilderFbroHost/FBroSubprocess child remains, and remove only the validated temporary project output directories.

- [ ] **Step 5: Replace `待执行` with evidence**

Each report must include date, command, build result, exe path relative to the project, runtime duration, key output summary, and limitations. Never include secrets.

### Task 8: Update daily record and final review

**Files:**
- Create or modify: `更新记录/2026-09-04.md`
- Modify if needed: `docs/FUTURE_OPTIMIZATIONS.md`
- Modify if needed: `AI 视频自主生产/教程视频选题列表.md`

**Interfaces:**
- Consumes completed project and verification reports.
- Produces the required daily changelog and any follow-up optimization notes.

- [ ] **Step 1: Record scope, impact, and verification**

List the 11 project directories, shared fixtures, static validation command, runtime verification command, and the VIP safe-failure boundary.

- [ ] **Step 2: Reconcile follow-up docs**

If a runtime limitation or persistence/build issue was discovered, add it to `docs/FUTURE_OPTIMIZATIONS.md`; otherwise leave that file unchanged. Update the tutorial list only if project paths or status changed.

- [ ] **Step 3: Run final repository checks**

Run: `npm run build` and the focused FBro/project tests available in `electron/package.json`; report exact pass/fail output without claiming unrelated pre-existing failures are fixed.

- [ ] **Step 4: Review for secrets and portability**

Run a repository search over the new directories for `Permit`, `Key`, `Cookie`, `token`, absolute `T:\` paths, and generated output folders; remove or redact any accidental secret/path before completion.
