# CEF3 教程示例项目 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CEF3 浏览器模块合集 10 集准备可复制、可打开、可构建、可录制的独立示例项目和配套资料。

**Architecture:** 01～09 每集保存完整独立 LingBuilder 工程（`.lingbuilder` 元数据、`.lcpp` 源码、构建请求、本地测试资源）；10 集只保存选型对比资料。合集根目录提供只读 PowerShell 验证器，统一检查 JSON、模块、源码、资源并调用 Electron CLI 构建。

**Tech Stack:** LingBuilder `.lcpp`/Win32 设计器模型、JSON、Markdown、PowerShell 7、Node.js Electron CLI、CEF3 SDK（Windows x64/MSVC）。

**Spec:** `docs/superpowers/specs/2026-09-04-cef3-tutorial-examples-design.md`

## Global Constraints

- 每集工程使用 ASCII project id 与路径；中文仅用于窗口、控件和界面文案。
- CEF3 SDK 不复制进教程目录；构建前必须在本机安装并校验 `lingbuilder.cef3.sdk`。
- `.lcpp` 控件参数使用裸 `controlRef`；事件处理器参数必须使用 `&处理器名`。
- 第 06 集只读取 `url`、`statusCode`、`mimeType` 等公开响应元数据；不添加正文或任意响应头伪能力。
- 第 05 集默认空代理直连；任何授权代理值只出现在录制说明的占位步骤，不写入源码。
- 第 09 集 DevTools 协议只使用 `Runtime.enable`，不发送账号、Cookie、Token 或绕过安全策略的脚本。
- 01～09 每个项目必须带 `.lingbuilder/solution.json`、`.lingbuilder/window-designer.json`、`.lingbuilder/project-modules.json`、`.lingbuilder/build-configuration.json`、`src/*.lcpp`、`config/<id>/config.ini`、`build-request.json` 和 `README.md`。
- 完成后必须更新 `更新记录/2026-09-04.md` 与 `docs/FUTURE_OPTIMIZATIONS.md`；本次不修改 AI 规则手册。

---

### Task 1: 建立 01～03 基础示例工程

**Files:**
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro/.lingbuilder/{solution.json,window-designer.json,project-modules.json,build-configuration.json}`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro/{build-request.json,README.md}`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro/src/CEF3入门窗体.lcpp`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro/config/cef3-ep01-intro/config.ini`
- Repeat the same file set for `02 浏览器操作小项目/示例项目/cef3-ep02-browser-tool` (`CEF3浏览器操作窗体.lcpp`) and `03 事件驱动/示例项目/cef3-ep03-events` (`CEF3事件驱动窗体.lcpp`).

**Interfaces:**
- Consumes: existing project schema from `examples/cef3-browser-simple-demo` and current CEF3 bindings in `electron/src/services/modules/builtinModules.ts`.
- Produces: three independently openable projects whose `build-request.json` points at the local `src/*.lcpp` and matching designer window.

- [ ] **Step 1: Add project metadata for ep01.**
  Use id `cef3-ep01-intro`, module ids `lingbuilder.win32.basic` and `lingbuilder.cef3.browser`, pinned versions `1.0.0` and `3.0.0-alpha.3`, one `CefBrowser` control named `浏览器1`, and a `main-window` class named `CEF3入门窗体`.
- [ ] **Step 2: Add ep01 source and README.**
  `创建完毕` binds `加载完成` with `&浏览器1_加载完成`, navigates to `file:///...` only when a local page is present, and logs `CEF3 入门已启动：` plus `CEF3_取地址(浏览器1)`. README must state SDK/toolchain prerequisites, the exact CLI command, and the expected “错误列表 0/网页可见” result.
- [ ] **Step 3: Add ep02 metadata/source.**
  Designer controls are `浏览器1`, `地址栏`, `后退按钮`, `前进按钮`, `刷新按钮`, `停止按钮`, `放大按钮`, `缩小按钮`, `重置缩放按钮`, `标题标签`; handlers call only existing commands (`CEF3_后退/前进/刷新/停止/设置缩放级别/执行缩放/取缩放级别/执行JS/取标题/取地址`) with bare browser references. Include a local `assets/pages/home.html` and `assets/pages/second.html`.
- [ ] **Step 4: Add ep03 metadata/source.**
  Bind `加载开始`、`加载完成`、`加载状态改变`、`加载错误` with `&` handlers; each handler writes `CEF3_取最近事件`、`CEF3_取事件数据` and `CEF3_取事件字段(浏览器1, "url")` to debug output. Include `assets/pages/events.html`.
- [ ] **Step 5: Run structural checks for 01～03.**
  Parse all JSON with `node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f,'utf8'));" ...` and run the CLI language diagnostics/build command for each project. Expected: valid JSON, zero language errors, and a generated project directory (SDK availability required for native compilation).
- [ ] **Step 6: Commit.**
  ```powershell
  git add "AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/02 浏览器操作小项目/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/03 事件驱动/示例项目"
  git commit -m "feat: add CEF3 tutorial examples 01-03"
  ```

### Task 2: 建立 04～06 会话、代理和资源响应示例

**Files:**
- Create full project file sets under `04 会话隔离/示例项目/cef3-ep04-session-isolation`, `05 代理与请求决策/示例项目/cef3-ep05-network-decision`, and `06 获取网页资源响应/示例项目/cef3-ep06-resource-response`.
- Create local resources: ep04 `assets/session/left.html`, `assets/session/right.html`; ep05 `assets/network/allow.html`, `assets/network/blocked.html`; ep06 `assets/resources/index.html`, `assets/resources/style.css`, `assets/resources/app.js`, `assets/resources/icon.png`.

**Interfaces:**
- Consumes: Task 1 project schema and `CEF3会话_取缓存目录`, `CEF3_设置代理`, `CEF3_设置事件结果`, `CEF3_事件字段` bindings.
- Produces: three projects that run without a real proxy/account and whose logs demonstrate the script’s stated behavior.

- [ ] **Step 1: Build ep04 dual-control designer model.**
  Use two `CefBrowser` controls (`浏览器1`, `浏览器2`) in one resizable window, cache dirs `.cef3/ep04-left` and `.cef3/ep04-right`, and two status labels. Source must set/read separate LocalStorage markers through `CEF3_执行JS`, print `CEF3会话_取缓存目录`, and never include real credentials.
- [ ] **Step 2: Build ep05 proxy/request-decision model.**
  Use two browser controls and labels `代理实例状态`, `直连实例状态`; source calls `CEF3_设置代理(浏览器1, "")` before `CEF3_创建`, binds `导航请求前` using `&请求前处理器`, reads `url`, and calls `CEF3_设置事件结果(浏览器1, 2)` only for the local `/blocked` URL. README must explain how to substitute an authorized proxy during recording without committing the value.
- [ ] **Step 3: Build ep06 response metadata model.**
  Include one browser, a multiline `资源日志` label/text area, and an event handler bound to `资源响应到达`; output only `url`, `statusCode`, and `mimeType`. The README and recording notes must explicitly state “公开元数据 ≠ 响应正文”.
- [ ] **Step 4: Add local resources and deterministic URLs.**
  Keep all assets UTF-8 and reference them with relative paths from the project. The ep06 page must request HTML, CSS, JS and PNG on first load so the event log has at least four resource types.
- [ ] **Step 5: Run diagnostics/build.**
  Verify no quoted control references, all handlers include `&`, and build each project with `--yes --json`. Expected: zero language errors and generated C++ source; native run may be marked blocked only when SDK/toolchain is unavailable, with the exact reason recorded.
- [ ] **Step 6: Commit.**
  ```powershell
  git add "AI 视频自主生产/CEF3 浏览器模块合集/04 会话隔离/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/05 代理与请求决策/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/06 获取网页资源响应/示例项目"
  git commit -m "feat: add CEF3 tutorial examples 04-06"
  ```

### Task 3: 建立 07～09 生命周期、传输和自动化示例

**Files:**
- Create full project file sets under `07 资源加载生命周期/示例项目/cef3-ep07-resource-lifecycle`, `08 下载打印查找/示例项目/cef3-ep08-transfer-find`, and `09 JavaScript DevTools 异步任务/示例项目/cef3-ep09-automation-devtools`.
- Create ep07 `assets/lifecycle/redirect.html`, `assets/lifecycle/final.html`; ep08 `assets/transfer/find.html`, `assets/transfer/download.txt`; ep09 `assets/automation/automation.html`.

**Interfaces:**
- Consumes: Task 2 local-resource conventions and current CEF3 event/transfer/automation bindings.
- Produces: three projects with deterministic local behavior and explicit system-dialog limitations.

- [ ] **Step 1: Build ep07 event timeline project.**
  Bind `资源加载前`、`资源响应到达`、`资源重定向`、`资源加载完成`; each handler appends a short line containing event name plus `url`, `statusCode`, or `mimeType`. The redirect page must point from `/redirect` to `/final` through a local HTTP helper documented in README; if the helper is not running, the project still opens the static page and reports the missing helper in Chinese.
- [ ] **Step 2: Build ep08 transfer/find project.**
  Add buttons/labels for download, print, find and stop-find; call `CEF3传输_开始下载(浏览器1, ".../download.txt")`, `CEF3传输_打印(浏览器1)`, `CEF3_页内查找(浏览器1, "LingBuilder", 真, 假, 假)`, bind `页内查找结果`, and call `CEF3_停止页内查找(浏览器1, 真)`. README must state that printing is verified by opening the native dialog only.
- [ ] **Step 3: Build ep09 automation/DevTools project.**
  Add buttons/labels for async title evaluation, task status/result/error/release, DevTools open/close and protocol call. Source calls `CEF3自动化_执行JS异步(浏览器1, "document.title")`, polls through task APIs without blocking the UI, then calls `CEF3开发工具_打开`, `CEF3开发工具_执行协议方法(浏览器1, "Runtime.enable", "{}")`, and releases every returned task.
- [ ] **Step 4: Run structural and language gates.**
  Check local asset existence, handler `&` syntax, and zero diagnostics. Run native smoke for ep08/ep09 when SDK is available; record dialog limitations instead of automating irreversible print actions.
- [ ] **Step 5: Commit.**
  ```powershell
  git add "AI 视频自主生产/CEF3 浏览器模块合集/07 资源加载生命周期/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/08 下载打印查找/示例项目" "AI 视频自主生产/CEF3 浏览器模块合集/09 JavaScript DevTools 异步任务/示例项目"
  git commit -m "feat: add CEF3 tutorial examples 07-09"
  ```

### Task 4: 创建第 10 集对比资料

**Files:**
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/10 CEF3还是EdgeView/对比资料/对比数据.md`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/10 CEF3还是EdgeView/对比资料/花字文案.md`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/10 CEF3还是EdgeView/对比资料/截图采集清单.md`

**Interfaces:**
- Consumes: CEF3/EdgeView user docs and the episode-10 script.
- Produces: reviewable source data for the comparison cards; no executable project.

- [ ] **Step 1: Record comparison facts.**
  Document CEF baseline/version, SDK size as stated in current docs, runtime files (`libcef.dll`, `chrome_elf.dll`, `Resources`), WebView2 Runtime dependency, session/proxy/event differences, and source links with retrieval date.
- [ ] **Step 2: Write overlay copy.**
  Provide short Chinese strings for the three comparison cards, conclusion card and FBro handoff; keep terminology consistent with the script (`系统 Runtime` vs `自带 Chromium 运行时`).
- [ ] **Step 3: Define screenshot crops.**
  List source window, target DIP/physical size, focus region, forbidden sensitive content and acceptance text for each card.
- [ ] **Step 4: Validate data.**
  Check every numeric/version claim against its cited doc and run a Markdown link/path check. Commit the three files.

### Task 5: 添加合集总览、录制准备和验证记录模板

**Files:**
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/示例项目总览.md`
- Create: `AI 视频自主生产/CEF3 浏览器模块合集/验证示例项目.ps1`
- Create: `录制准备.md` and `验证记录.md` in each of the ten episode directories.

**Interfaces:**
- Consumes: project paths and commands from Tasks 1–4.
- Produces: one entry point for operators to find, validate and record every episode.

- [ ] **Step 1: Write the overview table.**
  Include episode number/title, project path or “对比资料”, module dependencies, local assets, exact build command, expected output, DIP requirement and current verification state.
- [ ] **Step 2: Implement `验证示例项目.ps1`.**
  Parameters: `[string]$Episode`, `[switch]$SkipBuild`, `[switch]$NativeSmoke`. Resolve paths relative to the script directory; scan 01–09; parse required JSON; verify the `.lcpp` path, module ids, asset files, no quoted `controlRef` in source, and `&` on handler arguments. Unless `-SkipBuild`, invoke `node electron/dist/cli.cjs project build --request <project>/build-request.json --workspace <project> --yes --json`; write raw output and summary to each `验证记录.md` and exit non-zero on any structural/build failure.
- [ ] **Step 3: Fill recording documents.**
  For each episode map S1–S7 to project controls, CDP/native capture method, exact expected text, 1920×1080 DIP rule for code shots, security redactions, rerun command and cleanup. For ep10 reference only the comparison assets.
- [ ] **Step 4: Add initial verification records.**
  Start each file with `状态：待验证`, list the exact command that will be run, and reserve a clearly labeled results table; do not claim success before the validator runs.
- [ ] **Step 5: Commit documentation/tooling.**
  ```powershell
  git add "AI 视频自主生产/CEF3 浏览器模块合集"
  git commit -m "docs: add CEF3 tutorial recording and validation workflow"
  ```

### Task 6: Execute validation, fix failures, and record evidence

**Files:**
- Modify only generated example files, their `README.md`, `录制准备.md`, `验证记录.md`, `示例项目总览.md`, and `验证示例项目.ps1` when validation exposes a concrete mismatch.
- Create: `更新记录/2026-09-04.md`
- Modify: `docs/FUTURE_OPTIMIZATIONS.md`

**Interfaces:**
- Consumes: all artifacts from Tasks 1–5 and the installed CEF3 SDK/toolchain.
- Produces: truthful per-episode verification status and a clean handoff for video recording.

- [ ] **Step 1: Run structural-only validation.**
  ```powershell
  pwsh -File "AI 视频自主生产/CEF3 浏览器模块合集/验证示例项目.ps1" -SkipBuild
  ```
  Expected: all required files/assets found and all JSON parse successfully.
- [ ] **Step 2: Run full CLI builds.**
  ```powershell
  pwsh -File "AI 视频自主生产/CEF3 浏览器模块合集/验证示例项目.ps1"
  ```
  Expected: each project reports its CLI exit code and diagnostic count; successful projects list generated exe/Cef runtime files, failed projects list the Chinese error and remediation.
- [ ] **Step 3: Run native smoke where safe.**
  Run `-NativeSmoke` for ep04, ep08 and ep09 only after confirming no stale demo exe is running. Capture window presence, key output text and process cleanup; open but do not confirm the print dialog.
- [ ] **Step 4: Update records and overview.**
  Replace `待验证` with timestamped evidence only for gates that passed; mark unavailable SDK/toolchain or unstable external dependencies as `阻塞` with exact cause and rerun command.
- [ ] **Step 5: Update long-term docs.**
  Add one dated bullet to `docs/FUTURE_OPTIMIZATIONS.md` stating that tutorial assets are currently duplicated per episode and a future scaffold may consolidate them without removing independent-copy guarantees. Add `更新记录/2026-09-04.md` with date, files, scope and validation results.
- [ ] **Step 6: Final verification.**
  Run `npm run build` and `npm run lint` from the repository root, then `git diff --check`. Expected: both npm commands pass, no whitespace errors, and no unrelated user files are staged.
- [ ] **Step 7: Commit the verified handoff.**
  ```powershell
  git add "AI 视频自主生产/CEF3 浏览器模块合集" "更新记录/2026-09-04.md" "docs/FUTURE_OPTIMIZATIONS.md"
  git commit -m "chore: verify CEF3 tutorial example projects"
  ```

## Self-review

- Spec coverage: Tasks 1–3 create 01–09 runnable projects; Task 4 covers episode 10; Task 5 covers overview/recording/validation tooling; Task 6 records evidence and repository gates.
- Type/path consistency: all project ids, folder names, source filenames and build-request paths are fixed in each task; validator parameters are explicitly defined.
- Placeholder scan: no `TBD`, `TODO`, or unbounded “handle later” steps; pending states are represented only as validator output (`待验证`/`阻塞`) before evidence exists.
