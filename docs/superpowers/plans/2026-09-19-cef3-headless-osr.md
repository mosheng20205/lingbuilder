# CEF3 官方无头浏览器（OSR）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 CEF 官方 windowless（OSR / `CefRenderHandler`）路径，让 `.lcpp` 代码与可视化设计器都能拥有不创建任何 HWND 的浏览器实例，并在控制台项目中加载页面、执行 JS、取文本/源码、填表、按实例编号管理生命周期。

**Architecture:** 三层各补一个缺口：原生桥新增 `LB_CEF3_BROWSER_CONFIG_V4` + `LB_CEF3_BrowserCreateWindowless` 并放开 OSR 的 `parent_window == 0`、把视口尺寸变成权威可设状态；生成器在 `LingWindowBase` 的 `cefBrowsers_` 实例表里以 `2000000+实例编号` 登记无头实例，并给控制台 `wmain` 补上 CEF 子进程守卫与退出回收；中文命令面用「实例编号」寻址，通过 `CEF3无头_取主框架` 把框架句柄交给现成的 `CEF3框架_*`/`CEF3填表_*`/`CEF3DOM_*`，不复制第二套 API。设计器侧新增 `isVisual:false` 的 `CefBrowser` 无头资源，按项目级作用域解析。

**Tech Stack:** C++17 / MSVC x64 / CEF 150.0.14（`electron/native/cef3-bridge`）、TypeScript + React（`electron/src`）、node:test + tsx（`electron/tests`）、electron-builder 打包门禁。

**Spec:** `docs/superpowers/specs/2026-09-19-cef3-headless-osr-design.md`

## Global Constraints

- 禁止用「创建真实窗口再隐藏/移出桌面」冒充无头；无头实例全进程不得出现为其创建的 `CreateWindowExW` / `RegisterClassExW` / `ShowWindow`。
- 一期不做截图与像素帧交付；禁止用 DevTools `Page.captureScreenshot` 兜底伪造无头画面。
- 一期不把 CEF 事件派发成中文事件处理器，只给等待与轮询取事件命令。
- 不新增 CEF 官方签名映射：`COMPLETE_TARGET.implemented = 1384`、`internal = 8`、`notApplicable = 185` 保持不变（`electron/scripts/generate-cef3-api-coverage.cjs:7-14`）。
- `Cef3OperationCatalog.generated.inc` 已有 operation_id 一律保持稳定，不得重算。
- V3 配置结构体不得原地追加字段；扩展一律走 V4 + `struct_size` 判长。
- 新增/修改桥后必须重编并回写 SDK：`npm run module:cef3-bridge` → `npm run module:cef3-sdk`（该命令内部构建并两次运行 `LingBuilderCefBridgeTests.exe`）。
- CEF3 相关验收一律 x64（`electron/src/services/tasks/buildConfigurationService.ts:24-26` 已把 cef3/fbro/opencv 钉为 x64）。
- 所有用户可见文案、诊断、日志为中文；失败一律走桥的 `Fail(...)` 或运行时 `调试输出(L"...")`，禁止只回错误码。
- 提交只 `git add` 本任务显式列出的路径；本仓常有第二个会话并行改文件，提交前必须 `git diff --cached --stat` 核对，禁止 `git add -A`、禁止推送。
- 每个任务收尾：`cd electron && npm run lint`；批次收尾：`npm run test:lingcpp && npm run build`。
- 测试基线（`electron/tests/modules.test.ts:285`）：`modules:98 / commands:3701 / parameters:6463 / controlReferences:1307 / commandDigest:'1da7f207' / parameterDigest:'d4439de8'`；新增命令后按实算重算并同步注释。
- 模块版本统一：`lingbuilder.cef3.browser` 为 `3.0.0-alpha.4`（`builtinModules.ts:960`），本次把 `CEF3_ALPHA_VERSION`（`cef3Modules.ts:11`，仍为 `3.0.0-alpha.3`）对齐到 `3.0.0-alpha.4`。

---

# 批次一：能力可用（桥 + 运行时 + 命令 + 控制台真机）

## Task 1: 桥支持真无头创建（V4 配置 + 放开 parent HWND + 视口权威化）

**Files:**
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.h`（`:285-297` V3 结构体之后、`:653-654` 导出区）
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.cpp`（`CreateBrowserHandle :11651-11663`、`GetViewRect :9030-9063`）
- Test: `electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp`（OSR 用例区 `:9937`、`:10211` 附近）

**Interfaces:**
- Consumes: 既有 `LB_CEF3_BROWSER_WINDOWLESS`（`.h:237`）、`CreateBrowserHandle(config, chrome_runtime)`、`state_->osr_view_width/height`（`.cpp:986-988`）。
- Produces: `LB_CEF3_BROWSER_CONFIG_V4{ ...V3 字段, uint32_t osr_width, osr_height }`；`LB_CEF3_BrowserCreateWindowless(const LB_CEF3_BROWSER_CONFIG_V4*) -> LB_CEF3_HANDLE`；常量 `LB_CEF3_DEFAULT_OSR_WIDTH 1280` / `LB_CEF3_DEFAULT_OSR_HEIGHT 720`。Task 2/5 依赖这些名字。

- [ ] **Step 1: 在桥测试里写失败用例（真无头创建 + 视口生效 + 缺标志被拒）**

在 `LingBuilderCefBridgeTests.cpp` 的 OSR 区（`browser_config_osr` 那组用例之后，`:9937` 附近，沿用文件里已有的 `LB_CEF3_Initialize` 成功前置与 `assert` 风格）追加：

```cpp
  // 真无头：parent_window = 0 必须创建成功，且视口取自 V4 配置而不是塌成 1×1。
  LB_CEF3_BROWSER_CONFIG_V4 headless_config = {};
  headless_config.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V4);
  headless_config.abi_version = LB_CEF3_ABI_VERSION_V4;
  headless_config.parent_window = 0;
  headless_config.user_token = 770001;
  headless_config.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_IMAGES;
  headless_config.initial_url = L"about:blank";
  headless_config.profile_key = L"test-headless-create";
  headless_config.osr_width = 1024;
  headless_config.osr_height = 640;
  LB_CEF3_HANDLE headless = LB_CEF3_BrowserCreateWindowless(&headless_config);
  assert(headless != 0);

  int32_t headless_windowless_flag = 0;
  assert(LB_CEF3_BrowserGetWindowlessFrameRate(headless, &headless_windowless_flag) == LB_CEF3_OK);

  // 缺 WINDOWLESS 标志必须被拒，绝不静默退化成窗口浏览器。
  LB_CEF3_BROWSER_CONFIG_V4 missing_flag = headless_config;
  missing_flag.flags = LB_CEF3_BROWSER_JAVASCRIPT;
  missing_flag.profile_key = L"test-headless-missing-flag";
  assert(LB_CEF3_BrowserCreateWindowless(&missing_flag) == 0);

  // Chrome Runtime + windowless 仍然不支持。
  LB_CEF3_BROWSER_CONFIG_V4 chrome_windowless = headless_config;
  chrome_windowless.flags |= LB_CEF3_BROWSER_CHROME_RUNTIME;
  chrome_windowless.profile_key = L"test-headless-chrome";
  assert(LB_CEF3_BrowserCreateWindowless(&chrome_windowless) == 0);

  LB_CEF3_BrowserClose(headless, 1);
  LB_CEF3_HandleRelease(headless);
```

同时新增视口回落断言（本任务只验证 V4 视口被 `GetViewRect` 采用；`LB_CEF3_BrowserGetOsrViewport` 由 Task 2 提供，故这里用「能创建 + 能读取帧率」证明无头实例真的起来了）：

```cpp
  // V3 配置 + parent_window = 0 + WINDOWLESS 走 BrowserCreate：允许创建，视口回落到默认常量。
  LB_CEF3_BROWSER_CONFIG_V3 legacy_windowless = {};
  legacy_windowless.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V3);
  legacy_windowless.abi_version = LB_CEF3_ABI_VERSION_V3;
  legacy_windowless.parent_window = 0;
  legacy_windowless.user_token = 770002;
  legacy_windowless.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT;
  legacy_windowless.profile_key = L"test-headless-v3-default-viewport";
  LB_CEF3_HANDLE legacy = LB_CEF3_BrowserCreate(&legacy_windowless);
  assert(legacy != 0);
  LB_CEF3_BrowserClose(legacy, 1);
  LB_CEF3_HandleRelease(legacy);

  // 非 windowless 且无 parent：保持原阻断。
  LB_CEF3_BROWSER_CONFIG_V3 windowed_no_parent = {};
  windowed_no_parent.struct_size = sizeof(windowed_no_parent);
  windowed_no_parent.abi_version = LB_CEF3_ABI_VERSION_V3;
  windowed_no_parent.user_token = 770003;
  windowed_no_parent.flags = LB_CEF3_BROWSER_JAVASCRIPT;
  assert(LB_CEF3_BrowserCreate(&windowed_no_parent) == 0);
```

- [ ] **Step 2: 跑桥测试确认失败**

Run: `cd electron && npm run module:cef3-bridge`
Expected: FAIL —— 编译期 `'LB_CEF3_BROWSER_CONFIG_V4' undeclared` / `'LB_CEF3_BrowserCreateWindowless' undeclared`（测试目标 `LingBuilderCefBridgeTests` 编译失败即为本任务的红灯）。

- [ ] **Step 3: 头文件新增 V4 结构体、常量与导出**

`LingBuilderCefBridge.h`，紧跟 `LB_CEF3_BROWSER_CONFIG_V3`（`:285-297`）之后：

```c
/* 真无头（OSR）浏览器创建配置：V3 全字段 + 显式视口尺寸。
   osr_width/osr_height 为 0 时回落到 LB_CEF3_DEFAULT_OSR_*。 */
#define LB_CEF3_DEFAULT_OSR_WIDTH 1280
#define LB_CEF3_DEFAULT_OSR_HEIGHT 720

typedef struct LB_CEF3_BROWSER_CONFIG_V4 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t parent_window;
  uint64_t user_token;
  uint32_t flags;
  const wchar_t* initial_url;
  const wchar_t* profile_key;
  const wchar_t* proxy_mode;
  const wchar_t* proxy_server;
  LB_CEF3_EVENT_CALLBACK_V3 event_callback;
  void* event_user_data;
  uint32_t osr_width;
  uint32_t osr_height;
} LB_CEF3_BROWSER_CONFIG_V4;
```

导出区（`:653` 的 `LB_CEF3_BrowserCreate` 之后）：

```c
/* 创建真无头浏览器：必须带 LB_CEF3_BROWSER_WINDOWLESS，全进程不为其创建任何 HWND。
   parent_window 允许为 0；视口尺寸取 osr_width/osr_height。 */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateWindowless(
    const LB_CEF3_BROWSER_CONFIG_V4* config);
```

- [ ] **Step 4: 实现创建入口与校验放宽**

`LingBuilderCefBridge.cpp`：把 `CreateBrowserHandle` 签名改为吃 V4 形状（V3 通过转换函数进入），校验段按 `struct_size`/`abi_version` 双判：

```cpp
LB_CEF3_HANDLE CreateBrowserHandle(const LB_CEF3_BROWSER_CONFIG_V4* config, bool chrome_runtime) {
  if (!g_cef_initialized.load()) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3尚未初始化"); return 0; }
  if (!config) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"浏览器配置版本无效"); return 0; }
  const bool viewport_present =
      config->abi_version == LB_CEF3_ABI_VERSION_V4
      && config->struct_size >= sizeof(LB_CEF3_BROWSER_CONFIG_V4);
  if (config->struct_size < sizeof(LB_CEF3_BROWSER_CONFIG_V3)
      || (config->abi_version != LB_CEF3_ABI_VERSION_V3 && !viewport_present)) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT,
         viewport_present ? L"无头浏览器配置版本无效" : L"浏览器配置版本无效");
    return 0;
  }
  const bool windowless = (config->flags & LB_CEF3_BROWSER_WINDOWLESS) != 0;
  if (chrome_runtime && windowless) {
    Fail(LB_CEF3_ERROR_NOT_SUPPORTED, L"Chrome Runtime 浏览器不支持无窗口/OSR 创建"); return 0;
  }
  if (!chrome_runtime && !windowless && config->parent_window == 0) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"内嵌浏览器必须提供独立宿主HWND"); return 0;
  }
```

紧跟其后写入视口（供 `GetViewRect` 消费）：

```cpp
  state->windowless = windowless;
  state->osr_view_width = viewport_present && config->osr_width > 0
      ? config->osr_width : LB_CEF3_DEFAULT_OSR_WIDTH;
  state->osr_view_height = viewport_present && config->osr_height > 0
      ? config->osr_height : LB_CEF3_DEFAULT_OSR_HEIGHT;
```

文件末尾导出实现（放在 `LB_CEF3_BrowserCreate` 旁边，形状完全一致）：

```cpp
LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreate(const LB_CEF3_BROWSER_CONFIG_V3* config) {
  if (!config) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"浏览器配置版本无效"); return 0; }
  LB_CEF3_BROWSER_CONFIG_V4 widened = {};
  widened.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V4);
  widened.abi_version = config->abi_version;
  widened.parent_window = config->parent_window;
  widened.user_token = config->user_token;
  widened.flags = config->flags;
  widened.initial_url = config->initial_url;
  widened.profile_key = config->profile_key;
  widened.proxy_mode = config->proxy_mode;
  widened.proxy_server = config->proxy_server;
  widened.event_callback = config->event_callback;
  widened.event_user_data = config->event_user_data;
  return CreateBrowserHandle(&widened, /*chrome_runtime=*/false);
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateWindowless(const LB_CEF3_BROWSER_CONFIG_V4* config) {
  if (!config) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"无头浏览器配置不能为空"); return 0; }
  if ((config->flags & LB_CEF3_BROWSER_WINDOWLESS) == 0) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"无头浏览器创建必须指定 WINDOWLESS 标志"); return 0;
  }
  if (config->flags & LB_CEF3_BROWSER_CHROME_RUNTIME) {
    Fail(LB_CEF3_ERROR_NOT_SUPPORTED, L"Chrome Runtime 浏览器不支持无窗口/OSR 创建"); return 0;
  }
  return CreateBrowserHandle(config, /*chrome_runtime=*/false);
}
```

`LB_CEF3_BrowserCreateChrome` 同样做 V3→V4 加宽转发（`chrome_runtime = true`），行为与 flags 组合不变。

- [ ] **Step 5: `GetViewRect` 改为存储视口优先**

把 `GetViewRect`（`:9030`）的取尺寸逻辑改成「存储视口 → parent 客户端区 → 默认常量」，并保留 `kRenderHandlerViewRect` 订阅覆盖：

```cpp
  void GetViewRect(CefRefPtr<CefBrowser> browser, CefRect& rect) override {
    int width = 0;
    int height = 0;
    {
      std::lock_guard<std::mutex> lock(state_->mutex);
      width = state_->osr_view_width;
      height = state_->osr_view_height;
    }
    if (width <= 0 || height <= 0) {
      HWND parent = nullptr;
      {
        std::lock_guard<std::mutex> lock(state_->mutex);
        parent = state_->parent;
      }
      RECT client_rect{};
      if (parent && IsWindow(parent)) GetClientRect(parent, &client_rect);
      width = std::max<int>(1, static_cast<int>(client_rect.right - client_rect.left));
      height = std::max<int>(1, static_cast<int>(client_rect.bottom - client_rect.top));
    }
    if (width <= 0 || height <= 0) {
      width = LB_CEF3_DEFAULT_OSR_WIDTH;
      height = LB_CEF3_DEFAULT_OSR_HEIGHT;
    }
    {
      std::lock_guard<std::mutex> lock(state_->mutex);
      state_->osr_view_width = width;
      state_->osr_view_height = height;
    }
    rect = CefRect(0, 0, width, height);
    // 以下订阅覆盖段保持原样（:9046-9062）
```

- [ ] **Step 6: 跑桥测试确认通过**

Run: `cd electron && npm run module:cef3-bridge`
Expected: `LingBuilderCefBridgeTests.exe` 两轮均 exit 0，末行打印 `CEF3 Bridge built and tested:`；既有 OSR 用例（`:2188`、`:9937`）继续通过（它们用 V3 配置 + 真实 parent，走加宽转发路径，不得回归）。

- [ ] **Step 7: 提交**

```bash
git add electron/native/cef3-bridge/LingBuilderCefBridge.h electron/native/cef3-bridge/LingBuilderCefBridge.cpp electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp
git diff --cached --stat
git commit -m "feat(cef3桥): 新增 V4 配置与 BrowserCreateWindowless，OSR 创建放开宿主窗口要求"
```

## Task 2: 桥暴露 OSR 视口读写与出帧计数

**Files:**
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.h`（`:869-873` 帧率/重绘导出附近）
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.cpp`（`LB_CEF3_BrowserNotifyScreenInfoChanged :21879` 附近）
- Test: `electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp`

**Interfaces:**
- Consumes: `state_->osr_view_width/height/osr_paint_count`（`.cpp:986-988`，`osr_paint_count` 已由 OnPaint `:9189-9223` 递增）、既有 `LB_CEF3_BrowserNotifyScreenInfoChanged`、`LB_CEF3_BrowserInvalidate`。
- Produces: `LB_CEF3_BrowserSetOsrViewport(LB_CEF3_HANDLE, uint32_t width, uint32_t height) -> int`、`LB_CEF3_BrowserGetOsrViewport(LB_CEF3_HANDLE, uint32_t* width, uint32_t* height) -> int`、`LB_CEF3_BrowserGetOsrPaintCount(LB_CEF3_HANDLE, uint64_t* paint_count) -> int`。Task 5 的 `CEF3无头_设置视口/取视口JSON/取渲染帧数` 直接调这三个。

- [ ] **Step 1: 写失败测试（视口可改、帧数可读、非无头被拒）**

```cpp
  LB_CEF3_HANDLE osr_for_viewport = LB_CEF3_BrowserCreateWindowless(&headless_config);
  assert(osr_for_viewport != 0);

  uint32_t view_width = 0, view_height = 0;
  assert(LB_CEF3_BrowserGetOsrViewport(osr_for_viewport, &view_width, &view_height) == LB_CEF3_OK);
  assert(view_width == headless_config.osr_width && view_height == headless_config.osr_height);

  assert(LB_CEF3_BrowserSetOsrViewport(osr_for_viewport, 800, 600) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserGetOsrViewport(osr_for_viewport, &view_width, &view_height) == LB_CEF3_OK);
  assert(view_width == 800 && view_height == 600);

  assert(LB_CEF3_BrowserSetOsrViewport(osr_for_viewport, 0, 600) == LB_CEF3_ERROR_INVALID_ARGUMENT);

  uint64_t paint_count = 0;
  assert(LB_CEF3_BrowserGetOsrPaintCount(osr_for_viewport, &paint_count) == LB_CEF3_OK);
  // CEF 至少出一帧；不订阅 on_paint 也必须有帧计数（证明渲染在跑，只是不外发）。
  assert(paint_count >= 1);

  // 普通窗口浏览器调用 OSR 专用导出必须给中文诊断并返回 NOT_SUPPORTED。
  assert(LB_CEF3_BrowserGetOsrPaintCount(browser, &paint_count) == LB_CEF3_ERROR_NOT_SUPPORTED);

  LB_CEF3_BrowserClose(osr_for_viewport, 1);
  LB_CEF3_HandleRelease(osr_for_viewport);
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && npm run module:cef3-bridge`
Expected: 编译失败 `'LB_CEF3_BrowserSetOsrViewport' undeclared`。

- [ ] **Step 3: 头文件导出声明**

```c
/* OSR 视口与出帧计数：仅对 LB_CEF3_BROWSER_WINDOWLESS 浏览器有效。
   SetOsrViewport 写视口后触发 NotifyScreenInfoChanged + Invalidate(PET_VIEW) 让 CEF 重查 GetViewRect。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetOsrViewport(
    LB_CEF3_HANDLE browser, uint32_t width, uint32_t height);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrViewport(
    LB_CEF3_HANDLE browser, uint32_t* width, uint32_t* height);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrPaintCount(
    LB_CEF3_HANDLE browser, uint64_t* paint_count);
```

- [ ] **Step 4: 实现（复用既有 `RequireWindowlessBrowser` 模式）**

在 `LB_CEF3_BrowserGetWindowlessFrameRate`（`:23179`）旁新增。先确认 `:23944` 的 `... bool require_windowless)` 辅助函数的真实名字并按其语义复用；若该辅助仅服务于订阅类函数，则就地写同形检查：

```cpp
namespace {
int RequireWindowless(LB_CEF3_HANDLE browser, BrowserState** out) {
  auto state = LookupBrowserState(browser);
  if (!state) return LB_CEF3_ERROR_INVALID_HANDLE;
  if (!state->windowless) {
    Fail(LB_CEF3_ERROR_NOT_SUPPORTED, L"该命令仅支持无窗口/OSR 浏览器");
    return LB_CEF3_ERROR_NOT_SUPPORTED;
  }
  if (out) *out = state.get();
  return LB_CEF3_OK;
}
}  // namespace

int LB_CEF3_CALL LB_CEF3_BrowserSetOsrViewport(LB_CEF3_HANDLE browser, uint32_t width, uint32_t height) {
  BrowserState* state = nullptr;
  const int check = RequireWindowless(browser, &state);
  if (check != LB_CEF3_OK) return check;
  if (width == 0 || height == 0) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"无头浏览器视口宽高必须为正整数");
    return LB_CEF3_ERROR_INVALID_ARGUMENT;
  }
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    state->osr_view_width = static_cast<int>(width);
    state->osr_view_height = static_cast<int>(height);
  }
  int status = LB_CEF3_OK;
  PostToCefUi([state, &status]() {
    auto host = state->browser ? state->browser->GetHost() : nullptr;
    if (!host) { status = LB_CEF3_ERROR_OPERATION_FAILED; return; }
    host->NotifyScreenInfoChanged();
    host->Invalidate(PET_VIEW);
  });
  return status;
}

int LB_CEF3_CALL LB_CEF3_BrowserGetOsrViewport(LB_CEF3_HANDLE browser, uint32_t* width, uint32_t* height) {
  BrowserState* state = nullptr;
  const int check = RequireWindowless(browser, &state);
  if (check != LB_CEF3_OK) return check;
  if (!width || !height) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"视口输出参数不能为空"); return LB_CEF3_ERROR_INVALID_ARGUMENT; }
  std::lock_guard<std::mutex> lock(state->mutex);
  *width = static_cast<uint32_t>(state->osr_view_width);
  *height = static_cast<uint32_t>(state->osr_view_height);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_BrowserGetOsrPaintCount(LB_CEF3_HANDLE browser, uint64_t* paint_count) {
  BrowserState* state = nullptr;
  const int check = RequireWindowless(browser, &state);
  if (check != LB_CEF3_OK) return check;
  if (!paint_count) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"帧数输出参数不能为空"); return LB_CEF3_ERROR_INVALID_ARGUMENT; }
  std::lock_guard<std::mutex> lock(state->mutex);
  *paint_count = state->osr_paint_count;
  return LB_CEF3_OK;
}
```

`LookupBrowserState` / `PostToCefUi` / `state->browser` 一律用文件里已有的同名工具（`:3793-3804` 的 `PostToCefUi`、句柄查表既有实现），不要新建第二套句柄表。若 `PostToCefUi` 为同步投递语义（与 `:21844` 的 `CloseBrowserWhenCefUiIsReady` 同族），保持返回值语义与相邻导出一致。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd electron && npm run module:cef3-bridge`
Expected: PASS（两轮 exit 0）。

- [ ] **Step 6: 提交**

```bash
git add electron/native/cef3-bridge/LingBuilderCefBridge.h electron/native/cef3-bridge/LingBuilderCefBridge.cpp electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp
git diff --cached --stat
git commit -m "feat(cef3桥): 暴露 OSR 视口读写与出帧计数导出"
```

## Task 3: 重编发布链与零漂移校验

**Files:**
- Modify: `<repo-root>/.lingbuilder/modules/lingbuilder.cef3.sdk/**`（由脚本回写，不手改；注意安装模块目录在**工作区根** `.lingbuilder/`，不是 `electron/.lingbuilder/`，且整体被 `.gitignore:81` 忽略）
- Verify: `electron/scripts/build-cef3-bridge.cjs`、`scripts/generate-cef3-api-coverage.cjs`、`scripts/verify-cef3-release-sdk.cjs`

**Interfaces:**
- Consumes: Task 1/2 的桥源码。
- Produces: SDK 模块目录里的 `LingBuilderCefBridge.dll/.lib/.h` 与 `VERSION.json` 三文件 SHA-256 一致；后续任务的构建能链到新导出。

- [ ] **Step 1: 重编并回写 SDK**

Run: `cd electron && npm run module:cef3-bridge && npm run module:cef3-sdk`
Expected: 两条命令 exit 0；`module:cef3-sdk` 打印写入 `.lingbuilder/modules/lingbuilder.cef3.sdk/` 的文件数。

- [ ] **Step 2: 确认新导出真的进了 DLL**

Run:
```bash
cd /t/electron/lingbuilder && node -e "const fs=require('fs');const p='.lingbuilder/modules/lingbuilder.cef3.sdk/sdk/bridge/x64/LingBuilderCefBridge.dll';const buf=fs.readFileSync(p);for(const n of ['LB_CEF3_BrowserCreateWindowless','LB_CEF3_BrowserSetOsrViewport','LB_CEF3_BrowserGetOsrViewport','LB_CEF3_BrowserGetOsrPaintCount'])console.log(n, buf.includes(n));"
```
Expected: 四行全 `true`。（用 ASCII 断言，禁止 grep 中文。路径在**工作区根**的 `.lingbuilder/`，头文件同目录 `bridge/x64/LingBuilderCefBridge.h`，不在 `electron/` 下。）

- [ ] **Step 3: 确认 coverage/catalog 零漂移**

Run: `cd electron && npm run module:cef3-coverage:check && npm run module:cef3-catalog:check && npm run test:cef3-coverage`
Expected: 三条 PASS。若 `COMPLETE_TARGET` 计数变化，说明误加了 CEF 官方签名映射——回到 Task 1/2 撤掉，不得改 `COMPLETE_TARGET` 数字迁就。

- [ ] **Step 4: 确认 VERSION.json 哈希与磁盘一致**

Run: `cd electron && npm run verify:cef3-release`
Expected: PASS（含 ABI、cefVersion、三文件 SHA-256、PE x64、≥500 文件 / ≥440 MiB）。

- [ ] **Step 5: 提交发布物元数据**

```bash
git add electron/.lingbuilder/modules/lingbuilder.cef3.sdk
git diff --cached --stat
git commit -m "chore(cef3): 重编无头 OSR 桥并回写 SDK 清单哈希"
```

若 SDK 目录不在版本控制内（`git diff --cached --stat` 为空），本步跳过并在任务结论里写明「SDK 为本机铺设物，随打包重新生成」。

## Task 4: 控制台入口补 CEF 子进程守卫与退出回收

**Files:**
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`（`generateConsoleEntrySection :9593-9658`）
- Test: `electron/tests/consoleProject.test.ts`

**Interfaces:**
- Consumes: `LB_CEF3_ExecuteSubProcess(uint64_t)`（`.h:627`）、`LB_CEF3_Shutdown(void)`（`.h:642`）。
- Produces: 控制台 `main.cpp` 含自由函数 `lingbuilder_cef3_子进程守卫()` 与 `LingWindowBase` 成员 `void LingBuilder_CEF3_退出回收()`（本任务体内只做 `LB_CEF3_Shutdown()`，Task 5 再补无头实例关闭，保证任一任务独立可编译）；Task 5 的无头创建依赖守卫已存在（否则 CEF 子进程会重跑用户程序体）。

- [ ] **Step 1: 写失败测试**

追加到 `electron/tests/consoleProject.test.ts`（沿用文件顶部已有的 `CONSOLE_SOURCE` 与 `createConsoleDesignerProject`）：

```ts
test('console entry guards the CEF subprocess before running the program body', () => {
  const generated = generateLingCppNativeWin32Project(createConsoleDesignerProject(), {
    lingCppSourceCode: CONSOLE_SOURCE,
    outputKind: 'console-application'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  // 守卫必须早于程序体，且先于运行时初始化（子进程只需返回退出码）。
  const guard = mainCpp.indexOf('lingbuilder_cef3_子进程守卫');
  const body = mainCpp.indexOf('consoleApp.启动()');
  assert.ok(guard >= 0, '缺少 CEF3 子进程守卫');
  assert.ok(body >= 0);
  assert.ok(guard < body, 'CEF3 子进程守卫必须在启动() 之前');
  assert.match(mainCpp, /cefExitCode >= 0/);
  // 退出必须回收 CEF，否则无头实例与子进程残留。
  assert.ok(mainCpp.indexOf('consoleApp.LingBuilder_CEF3_退出回收()') > body, '退出回收必须在启动() 之后');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/consoleProject.test.ts`
Expected: FAIL —— `缺少 CEF3 子进程守卫`。

- [ ] **Step 3: 生成器落地守卫与回收**

在 `generateConsoleEntrySection`（`:9593-9658`）产出的 C++ 里，`wmain` 函数体最前面插入与窗口版 `:26951-26953` 同形的守卫，并把结尾的 `return consoleApp.启动();` 改成先存退出码、再回收、后返回。两处都只依赖 `LINGBUILDER_CEF3_BRIDGE_AVAILABLE` 宏；宏缺失时退化为空实现，保证非 CEF 控制台项目产物零变化。

守卫与回收的落点不同：守卫不需要 `this`，生成为该段内的自由函数；回收要关本对象的无头实例，必须生成在 `LingWindowBase` 类体内（自由函数调不到成员 `cefBrowsers_`）。

守卫（`generateConsoleEntrySection` 产出的 `wmain` 之前）：

```cpp
static int lingbuilder_cef3_子进程守卫() {
#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
    const int cefExitCode = LB_CEF3_ExecuteSubProcess(reinterpret_cast<uint64_t>(GetModuleHandleW(nullptr)));
    if (cefExitCode >= 0) return cefExitCode;
#endif
    return -1;
}
```

`wmain` 内：

```cpp
int wmain(int argc, wchar_t* argv[]) {
    const int cefSubprocessExitCode = lingbuilder_cef3_子进程守卫();
    if (cefSubprocessExitCode >= 0) return cefSubprocessExitCode;
    // …以下保持现有 SetConsoleOutputCP / EnsureConsoleRuntimeInitialized / 单例 / RegisterHeadlessThreadOwner
```

回收成员（生成在 `LingWindowBase` 类体内，紧邻 `CEF3_关闭全部实例` 实现处；本任务只关 CEF，Task 5 补第一行）：

```cpp
    void LingBuilder_CEF3_退出回收() {
#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
        LB_CEF3_Shutdown();
#endif
    }
```

退出收尾必须同时兼容「整数型 启动()」与「空 启动()」两种既有形态（现有断言 `tests/consoleProject.test.ts:56`、`:70` 分别要求 `return consoleApp.启动();` 与 `consoleApp.启动();\n    return 0;` 的字面形状），因此只在返回值落点上改动，不改 `启动()` 调用行本身：

```cpp
    // 整数型：先存退出码再回收，最后 return 退出码
    const int lingbuilder_退出码 = consoleApp.启动();
    consoleApp.LingBuilder_CEF3_退出回收();
    return lingbuilder_退出码;

    // 空：保持 consoleApp.启动(); 后跟回收与 return 0;
    consoleApp.启动();
    consoleApp.LingBuilder_CEF3_退出回收();
    return 0;
```

窗口项目的 `wWinMain` 退出路径同样在 `LB_CEF3_Shutdown()`（`:27024-27026`）之前插入 `LingBuilder_CEF3_退出回收();` 的等价调用，保持两种 outputKind 行为一致。


- [ ] **Step 4: 跑测试确认通过**

Run: `cd electron && node --import tsx --test tests/consoleProject.test.ts`
Expected: PASS（含既有 5 条控制台用例，特别是 `:56`、`:70` 的入口形状断言未被破坏）。

- [ ] **Step 5: 提交**

```bash
git add electron/src/services/windowDesigner/lingCppWin32Project.ts electron/tests/consoleProject.test.ts
git diff --cached --stat
git commit -m "fix(控制台): 补 CEF3 子进程守卫与退出回收，防止子进程重跑程序体"
```

## Task 5: 运行时无头实例登记与创建命令实现

**Files:**
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`（`CefBrowserInstance :11895`、弹窗创建 `:15761-15800`、`CEF3_查找实例 :15437`、关闭路径 `:19268-19290`、`:20307-20333`）
- Test: `electron/tests/cefHeadlessRuntime.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `LB_CEF3_BrowserCreateWindowless` / `LB_CEF3_BROWSER_CONFIG_V4`；Task 2 的三个 OSR 导出；既有 `cefBrowsers_`（`:11937`）、`CEF3_初始化()`、`CEF3_运行时弹窗编号偏移 = 1000000`（`:15762`）。
- Produces: 运行时函数（`LingWindowBase` 成员，控制台与窗口项目共用）
  `int CEF3_创建无头浏览器(int instanceId, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer, int viewWidth, int viewHeight)`、
  `CefBrowserInstance* CEF3_查找无头实例(int instanceId)`、
  `void LingBuilder_CEF3_关闭全部无头实例()`、
  常量 `CEF3_运行时无头编号偏移 = 2000000`。

- [ ] **Step 1: 写失败测试（生成的 C++ 必须真的走 OSR 且零 HWND）**

无头运行时段与「无 HWND」扫描都针对 `LingWindowBase` 里无条件生成的 CEF3 运行时，因此用例源码只放普通控制台程序体（不调用尚未登记的中文命令，避免未知命令诊断污染 `blockingDiagnostics` 断言）。Task 9 复用本文件里的 `project()` 与 `SOURCE` 常量。

新建 `electron/tests/cefHeadlessRuntime.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const SOURCE = [
  '包 无头演示',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    调试输出("无头演示")',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');

function project(): LingWindowProject {
  return {
    schemaVersion: 2,
    id: 'headless-demo',
    name: '无头示例',
    resources: [],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '程序',
      title: '无头示例', width: 640, height: 420, background: '#1e1e1e',
      description: '', designerBackend: 'win32', controls: []
    }]
  };
}

function mainCpp(): string {
  const generated = generateLingCppNativeWin32Project(project(), {
    lingCppSourceCode: SOURCE,
    outputKind: 'console-application'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  return generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
}

test('headless creation goes through the windowless bridge export', () => {
  const code = mainCpp();
  assert.match(code, /static const int CEF3_运行时无头编号偏移 = 2000000;/);
  assert.match(code, /LB_CEF3_BROWSER_WINDOWLESS/);
  assert.match(code, /LB_CEF3_BROWSER_CONFIG_V4/);
  assert.match(code, /LB_CEF3_BrowserCreateWindowless\(/);
  assert.match(code, /bridgeConfig\.parent_window = 0;/);
  assert.match(code, /bridgeConfig\.osr_width = /);
});

test('headless runtime never creates an HWND', () => {
  const code = mainCpp();
  const start = code.indexOf('int CEF3_创建无头浏览器');
  const end = code.indexOf('int CEF3_创建弹窗浏览器');
  assert.ok(start >= 0 && end > start);
  const headlessBody = code.slice(start, end);
  for (const banned of ['CreateWindowExW', 'RegisterClassExW', 'ShowWindow', 'SetWindowPos', 'LB_CEF3_BrowserCreateChrome']) {
    assert.ok(!headlessBody.includes(banned), `无头创建路径不得出现 ${banned}`);
  }
});

test('headless instances are addressed by instance number and released on shutdown', () => {
  const code = mainCpp();
  assert.match(code, /CefBrowserInstance\* CEF3_查找无头实例\(int instanceId\)/);
  assert.match(code, /CEF3_运行时无头编号偏移 \+ instanceId/);
  assert.match(code, /void LingBuilder_CEF3_关闭全部无头实例\(\)/);
  assert.match(code, /LB_CEF3_BrowserClose\(/);
  assert.match(code, /LB_CEF3_HandleRelease\(/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/cefHeadlessRuntime.test.ts`
Expected: FAIL —— `headless creation goes through the windowless bridge export` 断言不匹配。

- [ ] **Step 3: 实现创建与查找（贴着弹窗创建的同款写法）**

在 `CEF3_运行时弹窗编号偏移`（`:15762`）旁新增偏移与查找助手（`cefBrowsers_` 按 `controlId` 键，无头实例键为 `2000000 + instanceId`，与弹窗 `1000000+`、设计器控件天然错开）：

```cpp
    static const int CEF3_运行时无头编号偏移 = 2000000;

    CefBrowserInstance* CEF3_查找无头实例(int instanceId) {
        if (instanceId <= 0) return nullptr;
        auto found = cefBrowsers_.find(CEF3_运行时无头编号偏移 + instanceId);
        return found == cefBrowsers_.end() ? nullptr : found->second.get();
    }
```

创建函数（放在 `CEF3_创建弹窗浏览器` 之前，便于上一步的切片断言成立）：

```cpp
    int CEF3_创建无头浏览器(int instanceId, const wchar_t* address, const wchar_t* cacheDirectory,
                             const wchar_t* proxyServer, int viewWidth, int viewHeight) {
#if LINGBUILDER_CEF3_AVAILABLE
        if (instanceId <= 0) { 调试输出(L"CEF3 创建无头浏览器失败：实例编号必须为正整数。"); return 0; }
        if (viewWidth <= 0 || viewHeight <= 0) {
            调试输出(L"CEF3 创建无头浏览器失败：视口宽高必须为正整数（默认 1280×720）。");
            return 0;
        }
#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
        if (!CEF3_初始化()) return 0;
        const int runtimeId = CEF3_运行时无头编号偏移 + instanceId;
        auto old = cefBrowsers_.find(runtimeId);
        if (old != cefBrowsers_.end()) {
            if (old->second->bridgeHandle) { LB_CEF3_BrowserClose(old->second->bridgeHandle, 1); LB_CEF3_HandleRelease(old->second->bridgeHandle); }
            cefBrowsers_.erase(old);
        }
        auto instance = std::make_unique<CefBrowserInstance>();
        instance->controlId = runtimeId;
        instance->url = address ? address : L"";
        instance->cacheDirectory = cacheDirectory && cacheDirectory[0]
            ? cacheDirectory : (L"cef3-headless-" + std::to_wstring(instanceId));
        instance->proxyMode = (proxyServer && proxyServer[0]) ? L"fixed_servers" : L"system";
        instance->proxyServer = proxyServer ? proxyServer : L"";
        instance->enableJs = true; instance->enableDevTools = false; instance->loadImages = true;
        LB_CEF3_BROWSER_CONFIG_V4 bridgeConfig = {};
        bridgeConfig.struct_size = sizeof(bridgeConfig);
        bridgeConfig.abi_version = LB_CEF3_ABI_VERSION_V4;
        bridgeConfig.parent_window = 0;              // 真无头：不为浏览器创建任何 HWND
        bridgeConfig.user_token = static_cast<uint64_t>(runtimeId);
        bridgeConfig.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_IMAGES;
        bridgeConfig.initial_url = (address && address[0]) ? address : L"about:blank";
        bridgeConfig.profile_key = instance->cacheDirectory.c_str();
        bridgeConfig.proxy_mode = instance->proxyMode.c_str();
        bridgeConfig.proxy_server = instance->proxyServer.c_str();
        bridgeConfig.osr_width = static_cast<uint32_t>(viewWidth);
        bridgeConfig.osr_height = static_cast<uint32_t>(viewHeight);
        bridgeConfig.event_callback = &LingWindowBase::CEF3_Bridge事件回调;
        bridgeConfig.event_user_data = this;
        LB_CEF3_HANDLE handle = LB_CEF3_BrowserCreateWindowless(&bridgeConfig);
        if (!handle) { 调试输出(L"CEF3 创建无头浏览器失败：OSR 浏览器创建失败（检查 CEF3 桥与运行时）。"); return 0; }
        instance->bridgeHandle = handle;
        instance->created = true; instance->bridgeReady = true;
        instance->currentUrl = bridgeConfig.initial_url ? bridgeConfig.initial_url : L"";
        cefBrowsers_[runtimeId] = std::move(instance);
        调试输出(L"CEF3 无头浏览器已创建（OSR 渲染，不创建窗口，一期不提供截图）。");
        return 1;
#else
        (void)instanceId; (void)address; (void)cacheDirectory; (void)proxyServer; (void)viewWidth; (void)viewHeight;
        调试输出(L"CEF3 创建无头浏览器失败：当前构建未启用 CEF3 桥。");
        return 0;
#endif
#else
        (void)instanceId; (void)address; (void)cacheDirectory; (void)proxyServer; (void)viewWidth; (void)viewHeight;
        调试输出(L"CEF3 不可用：构建环境缺少 CEF3 SDK。");
        return 0;
#endif
    }
```

- [ ] **Step 4: 实现关闭回收（替换 Task 4 的空壳）**

```cpp
    void LingBuilder_CEF3_关闭全部无头实例() {
#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
        for (auto it = cefBrowsers_.begin(); it != cefBrowsers_.end();) {
            if (it->first < CEF3_运行时无头编号偏移 || it->first >= CEF3_运行时无头编号偏移 + 1000000) { ++it; continue; }
            if (it->second && it->second->bridgeHandle) {
                LB_CEF3_BrowserClose(it->second->bridgeHandle, 1);
                LB_CEF3_HandleRelease(it->second->bridgeHandle);
                it->second->bridgeHandle = nullptr;
                it->second->created = false;
            }
            it = cefBrowsers_.erase(it);
        }
#endif
    }
```

同时让既有 `CEF3_关闭全部实例()`（`builtinModules.ts:980` 对应的运行时实现，`:20307-20333` 区）遍历范围覆盖无头键段，`CEF3_枚举实例JSON`（`:15761` 注释所述出口）为每项加 `"mode"` 字段：`windowless` / `chrome-popup` / `region` / `control`。

最后把 Task 4 生成的回收成员体补成两行（先关实例再关 CEF，顺序不可颠倒）：

```cpp
    void LingBuilder_CEF3_退出回收() {
#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
        LingBuilder_CEF3_关闭全部无头实例();
        LB_CEF3_Shutdown();
#endif
    }
```

并在 `electron/tests/consoleProject.test.ts` 的新用例里追加一行断言锁住该顺序：

```ts
  const recycle = mainCpp.match(/void LingBuilder_CEF3_退出回收\(\)[\s\S]*?\n {4}\}/)![0];
  const closeLine = recycle.indexOf('LingBuilder_CEF3_关闭全部无头实例()');
  const shutdownLine = recycle.indexOf('LB_CEF3_Shutdown()');
  assert.ok(closeLine >= 0 && shutdownLine > closeLine, '必须先关无头实例再关 CEF');
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd electron && node --import tsx --test tests/cefHeadlessRuntime.test.ts tests/consoleProject.test.ts tests/lingcpp.test.ts`
Expected: PASS。三条用例都只扫描 `LingWindowBase` 无条件生成的 CEF3 运行时文本，不依赖中文命令登记，因此 `blockingDiagnostics` 必为空；若不为空说明改到了公共生成路径，按诊断原文修，不得放宽断言。

- [ ] **Step 6: 提交**

```bash
git add electron/src/services/windowDesigner/lingCppWin32Project.ts electron/tests/cefHeadlessRuntime.test.ts
git diff --cached --stat
git commit -m "feat(cef3运行时): 无头实例登记进 cefBrowsers_ 并实现 OSR 创建与回收"
```

## Task 6: 中文命令面（创建 + 实例编号寻址 + 框架句柄适配）

**Files:**
- Modify: `electron/src/services/modules/builtinModules.ts`（`:973-994` CEF3 浏览器命令节、`:1080-1130` bindings、`BUILTIN_PARAM_DOCS :434-444`）
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`（`CEF3无头_*` 运行时实现，紧接 Task 5）
- Test: `electron/tests/modules.test.ts`（基线重算）、`electron/tests/lingcpp.test.ts`（补全/诊断/示例）

**Interfaces:**
- Consumes: Task 5 的 `CEF3_创建无头浏览器` / `CEF3_查找无头实例`、Task 2 的视口导出、既有 `CEF3_执行JS` 与 `CEF3框架_取主框架` 的内部实现。
- Produces: 17 条 `.lcpp` 用户命令（表见下）。两个寻址出口分工固定：`CEF3无头_取主框架(实例编号) -> 长整数型` 供页面内容/填表/DOM 类句柄命令（`CEF3框架_*`/`CEF3填表_*`/`CEF3DOM_*`），`CEF3无头_取浏览器句柄(实例编号) -> 长整数型` 供浏览器级命令（`CEF3OSR_*`/`CEF3离屏_*`，Task 10 消费）。除此之外不得再新增第三套句柄出口。

命令清单（`contributes.commands` + `bindings.commands[]` 必须成对）：

| 命令 | 参数类型序列 | 返回 |
|---|---|---|
| `CEF3_创建无头浏览器` | int, wideString, wideString, wideString, int, int | int |
| `CEF3无头_是否已创建` | int | int |
| `CEF3无头_设置视口` | int, int, int | int |
| `CEF3无头_取视口JSON` | int | wideString |
| `CEF3无头_取渲染帧数` | int | longLong |
| `CEF3无头_导航` | int, wideString | int |
| `CEF3无头_是否加载中` | int | int |
| `CEF3无头_等待加载完成` | int, int | int |
| `CEF3无头_取标题` | int | wideString |
| `CEF3无头_取地址` | int | wideString |
| `CEF3无头_取主框架` | int | longLong |
| `CEF3无头_取浏览器句柄` | int | longLong |
| `CEF3无头_执行JS` | int, wideString | wideString |
| `CEF3无头_取页面文本` | int, int | wideString |
| `CEF3无头_取页面源码` | int, int | wideString |
| `CEF3无头_取事件JSON` | int | wideString |
| `CEF3无头_关闭` | int | int |

- [ ] **Step 1: 写失败测试（命令成对 + 参数文档齐备 + 无头命令不误判 controlRef）**

新建 `electron/tests/cefHeadlessCommands.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

const HEADLESS_COMMANDS = [
  'CEF3_创建无头浏览器', 'CEF3无头_是否已创建', 'CEF3无头_设置视口', 'CEF3无头_取视口JSON',
  'CEF3无头_取渲染帧数', 'CEF3无头_导航', 'CEF3无头_是否加载中', 'CEF3无头_等待加载完成',
  'CEF3无头_取标题', 'CEF3无头_取地址', 'CEF3无头_取主框架', 'CEF3无头_取浏览器句柄',
  'CEF3无头_执行JS', 'CEF3无头_取页面文本', 'CEF3无头_取页面源码', 'CEF3无头_取事件JSON',
  'CEF3无头_关闭'
];

const browser = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser')!;

test('headless commands are declared in both contributes and bindings', () => {
  assert.equal(HEADLESS_COMMANDS.length, 17);
  const declared = new Set(browser.contributes!.commands!.map(item => item.name));
  const bound = new Set(browser.bindings!.commands!.map(item => item.command));
  for (const name of HEADLESS_COMMANDS) {
    assert.ok(declared.has(name), `contributes.commands 缺少 ${name}`);
    assert.ok(bound.has(name), `bindings.commands 缺少 ${name}`);
  }
});

test('headless commands address by instance number, never controlRef', () => {
  for (const binding of browser.bindings!.commands!) {
    if (!binding.command.startsWith('CEF3无头_') && binding.command !== 'CEF3_创建无头浏览器') continue;
    assert.equal(binding.parameters![0].name, '实例编号');
    assert.equal(binding.parameters![0].type, 'int');
    for (const parameter of binding.parameters!) {
      assert.notEqual(parameter.type, 'controlRef', `${binding.command} 的 ${parameter.name} 不应是 controlRef`);
    }
  }
});

test('CEF3无头_取主框架 returns a managed frame handle', () => {
  const binding = browser.bindings!.commands!.find(item => item.command === 'CEF3无头_取主框架')!;
  assert.equal(binding.returnType, 'longLong');
  const contribution = browser.contributes!.commands!.find(item => item.name === 'CEF3无头_取主框架')!;
  assert.equal(contribution.returnType, '长整数型');
  assert.match(contribution.description, /CEF3框架_|CEF3填表_|CEF3DOM_/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/cefHeadlessCommands.test.ts`
Expected: FAIL —— `contributes.commands 缺少 CEF3_创建无头浏览器`。

- [ ] **Step 3: 登记命令与绑定**

`builtinModules.ts` 的 CEF3 浏览器命令节（`CEF3_创建弹窗浏览器` `:973` 之后）按上表逐条追加，示例（其余 16 条同形，中文描述必须写清默认值与「不创建窗口」语义）：

```ts
        { name: 'CEF3_创建无头浏览器', signature: 'CEF3_创建无头浏览器(实例编号, 地址, 独立缓存目录, 代理地址, 视口宽, 视口高)', description: '用 CEF 官方无窗口渲染（OSR）创建不产生任何窗口的浏览器实例，控制台项目可直接调用：地址传空为 about:blank，独立缓存目录传空用默认 cef3-headless-<实例编号>，代理地址非空即该实例独立出口 IP，视口默认 1280×720。实例登记进运行时表，可被 CEF3_枚举实例JSON 列出（mode 为 windowless）、由 CEF3_关闭全部实例 统一关闭。一期无画面输出，取内容用 CEF3无头_取页面文本 / CEF3无头_执行JS；截图未开放，禁止用创建可见窗口再隐藏的方式冒充无头。', insertText: 'CEF3_创建无头浏览器(1, "https://www.example.com", ".cef3/headless-1", "", 1280, 720)', returnType: '整数型' },
        { name: 'CEF3无头_取浏览器句柄', signature: 'CEF3无头_取浏览器句柄(实例编号)', description: '取得无头浏览器实例的受管浏览器句柄（实例编号寻址），供浏览器级 OSR 命令使用：CEF3OSR_请求重绘、CEF3OSR_设置窗口外帧率、CEF3OSR_取窗口外帧率、CEF3离屏_订阅像素帧、CEF3离屏_订阅视图矩形。句柄由运行时托管，用户侧不得释放，实例关闭后失效返回 0；取页面内容请改用 CEF3无头_取主框架，不要用本句柄拼第二套内容链路。', insertText: 'CEF3无头_取浏览器句柄(1)', returnType: '长整数型' },
        { name: 'CEF3无头_取主框架', signature: 'CEF3无头_取主框架(实例编号)', description: '取得无头浏览器实例的主框架受管句柄（实例编号寻址，不需要设计器控件）；随后全部句柄版命令零改动可用：CEF3框架_执行JS、CEF3框架_取源码异步、CEF3框架_取文本异步、CEF3填表_点击元素/赋值/置选择项、CEF3DOM_*。页面尚未产生框架或实例不存在返回 0。', insertText: 'CEF3无头_取主框架(1)', returnType: '长整数型' },
```

对应 bindings（`:1080` 区，全部 `encoding: 'wide'` 当含 wideString 参数时）：

```ts
      { command: 'CEF3_创建无头浏览器', runtimeName: 'CEF3_创建无头浏览器', parameters: [{ name: '实例编号', type: 'int' }, { name: '地址', type: 'wideString' }, { name: '独立缓存目录', type: 'wideString' }, { name: '代理地址', type: 'wideString' }, { name: '视口宽', type: 'int' }, { name: '视口高', type: 'int' }], returnType: 'int', encoding: 'wide' },
```

`BUILTIN_PARAM_DOCS` 补 `实例编号`（若无头命令复用既有 `实例编号` 说明则只需确认覆盖「无头」口径）、`视口宽`、`视口高`、`超时毫秒`、`脚本`：

```ts
  视口宽: 'OSR 无头浏览器的页面视口宽度（CSS 像素），决定布局宽度与媒体查询结果；传 0 或负数直接失败，默认 1280。',
  视口高: 'OSR 无头浏览器的页面视口高度（CSS 像素）；无头实例不产生窗口，该值只影响页面布局与渲染尺寸，默认 720。',
```

（`BUILTIN_PARAM_DOCS` 加载期有抛错门禁，缺文档会在 import 时直接抛，属快速失败。）

- [ ] **Step 4: 实现剩余运行时包装**

无头命令一律「解析实例编号 → 复用控件路径的同一份实现」，**禁止复制第二套 JS/取源码逻辑**。做法：把 `CEF3_执行JS`（`:15868`）与 `CEF3框架_取主框架` 的函数体首行改为接受已解析实例，抽出 `std::wstring CEF3_执行JS_按实例(CefBrowserInstance*, const wchar_t*)` 与 `int64_t CEF3_取主框架_按实例(CefBrowserInstance*)` 两个内部核心，控件版与无头版都只做「查实例 + 调核心」：

```cpp
    int CEF3无头_是否已创建(int instanceId) {
        CefBrowserInstance* instance = CEF3_查找无头实例(instanceId);
        if (!instance) { 调试输出(L"CEF3 无头实例不存在或已关闭：该实例编号没有对应浏览器。"); return 0; }
        return instance->created ? 1 : 0;
    }

    std::wstring CEF3无头_执行JS(int instanceId, const wchar_t* script) {
        CefBrowserInstance* instance = CEF3_查找无头实例(instanceId);
        if (!instance) { 调试输出(L"CEF3 执行JS失败：该实例编号不存在或浏览器尚未创建。"); return L""; }
        return CEF3_执行JS_按实例(instance, script);
    }

    int64_t CEF3无头_取主框架(int instanceId) {
        CefBrowserInstance* instance = CEF3_查找无头实例(instanceId);
        if (!instance) { 调试输出(L"CEF3 取主框架失败：该实例编号不存在或浏览器尚未创建。"); return 0; }
        return CEF3_取主框架_按实例(instance);
    }

    int CEF3无头_等待加载完成(int instanceId, int timeoutMilliseconds) {
        CefBrowserInstance* instance = CEF3_查找无头实例(instanceId);
        if (!instance || !instance->bridgeHandle) { 调试输出(L"CEF3 等待失败：该实例编号不存在或浏览器尚未创建。"); return 0; }
        const int deadline = timeoutMilliseconds > 0 ? timeoutMilliseconds : 30000;
        for (int elapsed = 0; elapsed < deadline; elapsed += 50) {
            if (!CEF3_是否加载中_按实例(instance)) return 1;
            Sleep(50);
        }
        调试输出(L"CEF3 等待加载完成超时：页面在给定毫秒数内仍未加载结束。");
        return 0;
    }
```

`CEF3无头_取页面文本` / `取页面源码` 复用 `CEF3框架_取文本异步` / `取源码异步` 的任务句柄 + 50ms 轮询 `LB_CEF3_TaskGetStatus`（CEF 侧无 `TaskWait`，只有 FBro 有，见 `LingBuilderCefBridge.h` 导出对照），超时返回空文本 + 中文诊断。`CEF3无头_设置视口`/`取视口JSON`/`取渲染帧数` 直调 Task 2 的三个导出，并把 `osr_paint_count` 序列化进 `取视口JSON`（`{"width":…,"height":…,"paintCount":…}`）。

`CEF3无头_取事件JSON`：在 `CEF3_Bridge事件回调`（`:15413-15431` 那条按 `user_token` 路由的入口）里，命中无头键段时把事件序列化进 `CefBrowserInstance` 的 `std::deque<std::wstring> headlessEvents`（上限 200，超限丢最旧），**不**调用 `CEF3_发送事件`（其 `hwnd_` 判空会丢弃）。声明 `headlessEvents` 与 `headlessEventsMutex` 进 `struct CefBrowserInstance`（`:11895`）。

- [ ] **Step 5: 跑测试确认通过并重算模块基线**

Run: `cd electron && node --import tsx --test tests/cefHeadlessCommands.test.ts`
Expected: PASS。

Run: `cd electron && node --import tsx --test tests/modules.test.ts 2>&1 | grep -E "expected|actual|commands|parameters|controlReferences|Digest" | head -20`
Expected: 计数/digest 断言失败并打印实算值。把实算值写回 `tests/modules.test.ts:285` 与 `:800` 两组基线及其注释（`modules` 计数不变，`commands` +17、`parameters` 按实算值增加），再重跑至 PASS。同时跑 `node --import tsx --test tests/lingcpp.test.ts tests/windowDesigner.test.ts` 确认补全/示例/生成断言未破。

- [ ] **Step 6: 坐标型 OSR 输入命令对无头资源给指名替代的中文诊断**

`CEF3_发送鼠标单击事件` 等命令的 `控件名` 是 `controlRef`（`allowedTypes: ['CefBrowser']`）。若用户把无头资源名填进去，必须报「类型不兼容 + 指名替代」，不得只报「找不到控件」或静默通过。`electron/src/services/lingCpp/controlReferenceService.ts` 的类型不兼容分支（`resourceToSymbols`/`allowedKinds` 校验处，`:518` 附近）追加：目标为 `CefHeadlessBrowser` 资源时，消息固定为

```
控件引用「{名称}」是 CEF3无头浏览器资源，不能作为 CefBrowser 控件使用；无头实例请用 CEF3无头_执行JS、CEF3无头_取主框架 + CEF3填表_* 操作页面，坐标型输入需要可见控件宿主。
```

在 `electron/tests/lingcpp.test.ts` 的 controlRef 诊断区追加用例（设计器模型只含一个 `CefHeadlessBrowser` 资源、源码写 `CEF3_发送鼠标单击事件(CEF3无头浏览器1, 10, 10, 0, 0, 真, 1)`）：

```ts
test('coordinate OSR input against a headless resource names the replacement commands', () => {
  const diagnostics = collectControlReferenceDiagnostics(HEADLESS_RESOURCE_PROJECT, 'CEF3_发送鼠标单击事件(CEF3无头浏览器1, 10, 10, 0, 0, 真, 1)');
  const hit = diagnostics.find(item => item.code?.startsWith('lingcpp-control-reference-'));
  assert.ok(hit, '缺少 controlRef 诊断');
  assert.match(hit!.message, /CEF3无头_执行JS|CEF3填表_/u);
  assert.match(hit!.message, /无头浏览器资源/u);
});
```

（`collectControlReferenceDiagnostics` 用 `tests/lingcpp.test.ts` 里既有的 controlRef 诊断辅助与项目常量写法，若该文件没有同名辅助就复用其现有的等价调用形式，不得新建第二套诊断入口。）

- [ ] **Step 7: 跑全部相关测试并提交**

Run: `cd electron && node --import tsx --test tests/cefHeadlessCommands.test.ts tests/modules.test.ts tests/lingcpp.test.ts && npm run lint`
Expected: 全绿。

```bash
git add electron/src/services/modules/builtinModules.ts electron/src/services/windowDesigner/lingCppWin32Project.ts electron/src/services/lingCpp/controlReferenceService.ts electron/tests/cefHeadlessCommands.test.ts electron/tests/modules.test.ts electron/tests/lingcpp.test.ts
git diff --cached --stat
git commit -m "feat(cef3): 新增 17 条无头浏览器中文命令与实例编号寻址适配"
```

## Task 7: 控制台项目真机端到端

**Files:**
- Create: `electron/scripts/smoke-cef3-headless-native.ts`
- Modify: `electron/package.json`（`smoke:cef3-headless-native` 脚本，紧邻 `smoke:cef3-native` 区）

**Interfaces:**
- Consumes: Task 1-6 全部产物（新桥、守卫、运行时、命令）。
- Produces: 可重复执行的验收命令；批次一完成判据。

- [ ] **Step 1: 写冒烟脚本**

沿用 `scripts/smoke-http-server-native.ts` / `smoke-ai-bridge-stdio.ts` 的既有骨架（AI Bridge CLI 服务进程 + `project.create` + `build.run` + `run.wait` + `run.log`，凭据与权限口径照抄，不新造第二套驱动）：

```ts
// 控制台项目真机验收：无头浏览器创建 → 加载 → 取标题/执行JS/取源码 → 关闭 → 进程正常退出。
const SOURCE = [
  '包 无头抓取演示',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    如果真 (CEF3_创建无头浏览器(1, "https://www.bing.com", ".cef3/smoke-headless", "", 1280, 720) == 0)',
  '      调试输出("创建无头浏览器失败")',
  '      返回 (11)',
  '    结束',
  '    如果真 (CEF3无头_等待加载完成(1, 20000) == 0)',
  '      调试输出("等待加载完成超时")',
  '      返回 (12)',
  '    结束',
  '    调试输出("标题=" + CEF3无头_取标题(1))',
  '    调试输出("帧数=" + 到文本(CEF3无头_取渲染帧数(1)))',
  '    调试输出("JS=" + CEF3无头_执行JS(1, "document.title"))',
  '    局部 长整数型 框架 = CEF3无头_取主框架(1)',
  '    如果真 (框架 == 0)',
  '      调试输出("取主框架失败")',
  '      返回 (13)',
  '    结束',
  '    调试输出("源码长度=" + 到文本(取文本长度(CEF3无头_取页面源码(1, 15000))))',
  '    CEF3无头_关闭(1)',
  '    调试输出("无头冒烟全部通过")',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');
```

脚本必须断言（任一不满足即 exit 1 并打印中文原因）：

```ts
// 1. run.wait 退出码 == 0；run.log 含 标题=/JS=/源码长度=/无头冒烟全部通过
// 2. 取到的标题非空且 JS 返回值与标题一致（证明页面真的在无头渲染，不是空实例）
// 3. 源码长度 > 5000（证明取到真实 DOM 源码）
// 4. 帧数 >= 1（证明 OSR 在出帧）
// 5. 进程退出后无 LingBuilder 派生 CEF 子进程残留（tasklist 按父 PID 过滤，收尾清理）
```

- [ ] **Step 2: 登记脚本**

`electron/package.json` scripts 追加：

```json
    "smoke:cef3-headless-native": "tsx scripts/smoke-cef3-headless-native.ts",
```

- [ ] **Step 3: 跑真机验收**

Run: `cd electron && npm run build:cli && npm run smoke:cef3-headless-native`
Expected: 末行 `无头冒烟全部通过`，脚本 exit 0。失败时先看 `run.log` 里的中文诊断，再判断属桥（Task 1/2）还是生成器（Task 4/5/6）；**禁止**通过改断言或降低阈值让其变绿。

- [ ] **Step 4: 回归 + 提交**

Run: `cd electron && npm run lint && node --import tsx --test tests/cefHeadlessRuntime.test.ts tests/cefHeadlessCommands.test.ts tests/consoleProject.test.ts tests/modules.test.ts`
Expected: 全绿。

```bash
git add electron/scripts/smoke-cef3-headless-native.ts electron/package.json
git diff --cached --stat
git commit -m "test(cef3): 控制台项目无头浏览器真机端到端冒烟"
```

---

# 批次二：界面可放 + AI 可用 + 文档齐备

## Task 8: 设计器无头资源类型（模型 / 注册表 / 工具箱 / 属性面板）

**Files:**
- Modify: `electron/src/services/windowDesigner/types.ts`（`LingControlType :7-12`、资源联合 `:250`、新增接口紧邻 `LingFileDialogResource :205-226`）
- Modify: `electron/src/services/windowDesigner/win32ControlRegistry.ts`（`nonVisual()` 组 `:296-307`）
- Modify: `electron/src/components/WpfDesigner.tsx`（`CREATABLE_DESIGNER_CONTROL_TYPES :301-306`、`TYPE_ICONS :324-346`、`onAddControl :2090`、画布占位 `:3449-3500`、属性/事件面板接线 `:3615`/`:3708`、删除 `:2703`）
- Test: `electron/tests/windowDesigner.test.ts`、`electron/tests/windowControlCompleteness.test.ts`、`electron/tests/designerProfessionalUi.test.tsx`

**Interfaces:**
- Consumes: Task 6 的 `CEF3_创建无头浏览器(实例编号, 地址, 独立缓存目录, 代理地址, 视口宽, 视口高)`。
- Produces: 资源类型 `CefHeadlessBrowser`（中文名「CEF3无头浏览器」）、持久化字段 `instanceNumber/url/cacheDir/proxy/viewWidth/viewHeight/autoCreate`；Task 9 按这些键生成 spec。

- [ ] **Step 1: 写失败测试**

`electron/tests/windowDesigner.test.ts` 追加（沿用文件已有 import 与 `CREATABLE_DESIGNER_CONTROL_TYPES` 断言风格）：

```ts
test('headless browser is a creatable non-visual designer resource', () => {
  assert.ok(CREATABLE_DESIGNER_CONTROL_TYPES.includes('CefHeadlessBrowser'));
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'CefHeadlessBrowser');
  assert.ok(definition);
  assert.equal(definition!.isVisual, false);
  assert.equal(definition!.category, '非可视');
  assert.equal(definition!.moduleId, 'lingbuilder.cef3.browser');
  assert.deepEqual(definition!.events, [], '一期不派发事件，不得声明事件');
  assert.deepEqual(
    definition!.properties.map(item => item.key),
    ['ownerWindowId', 'instanceNumber', 'url', 'cacheDir', 'proxy', 'viewWidth', 'viewHeight', 'autoCreate']
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/windowDesigner.test.ts`
Expected: FAIL —— `headless browser is a creatable non-visual designer resource`。

- [ ] **Step 3: 类型与注册表**

`types.ts`：`LingControlType` 联合加 `'CefHeadlessBrowser'`；新增接口并入 `LingDesignerResource`（`:250`）：

```ts
export interface LingCefHeadlessResource {
  id: string;
  type: 'CefHeadlessBrowser';
  name: string;
  /** 仅用于设计器画布内占位的水平坐标，不生成运行时控件。 */
  designerX?: number;
  /** 仅用于设计器画布内占位的垂直坐标，不生成运行时控件。 */
  designerY?: number;
  /** 归属窗口；运行时按项目级作用域解析，控制台项目同样可用。 */
  ownerWindowId: string;
  /** 无头实例编号（正整数，项目内唯一），运行时键为 2000000 + 该值。 */
  instanceNumber: number;
  /** 初始地址；空字符串为 about:blank。 */
  url: string;
  /** 独立缓存目录（工作区相对路径），空串用默认 cef3-headless-<实例编号>。 */
  cacheDir: string;
  /** 代理地址，非空即该实例独立出口 IP。 */
  proxy: string;
  viewWidth: number;
  viewHeight: number;
  /** 创建完毕后自动创建无头实例；控制台项目在 启动() 之前自动创建。 */
  autoCreate: boolean;
}
```

`win32ControlRegistry.ts` 的 `nonVisual()` 组（`:307` 之后）：

```ts
  nonVisual({ type: 'CefHeadlessBrowser', label: 'CEF3无头浏览器', moduleId: 'lingbuilder.cef3.browser', category: '非可视', icon: 'Globe', nativeClass: 'cef-windowless', nativeAdapter: 'cef-headless-resource', defaultProps: { content: 'CEF3无头浏览器', width: 0, height: 0 }, properties: [text('ownerWindowId', '所属窗口'), number('instanceNumber', '实例编号', 1, 1), text('url', '初始地址', ''), text('cacheDir', '独立缓存目录', ''), text('proxy', '代理地址', ''), number('viewWidth', '视口宽', 1280, 1, 7680), number('viewHeight', '视口高', 720, 1, 4320), bool('autoCreate', '启动时自动创建', true)], events: [] }),
```

（注册表条目由 `createControlContributions('lingbuilder.cef3.browser')` 自动复制进该模块的 `contributes.designerControls`（`builtinModules.ts:25-45`，挂载点 `:973`），与同模块的可视控件 `CefBrowser`（`win32ControlRegistry.ts:335`，`icon: 'Globe'`）同源，不需要另写清单。禁止声明 `runtimeControl`——`manifest.ts:265` 对 `isVisual:false` 硬拒。）

- [ ] **Step 4: 工具箱与属性面板**

`WpfDesigner.tsx`：
1. `CREATABLE_DESIGNER_CONTROL_TYPES`（`:301-306`）追加 `'CefHeadlessBrowser'`。工具箱分组映射已存在，不需要新增：`controlToolboxModel.ts:33-40` 的 `GROUP_BY_MODULE_ID['lingbuilder.cef3.browser'] = 'browser'`，因此该组件落在**「浏览器控件」**组（与 `CefBrowser` 同组），不得新建分组、也不得塞进「高级控件」。
2. `onAddControl`（`:2115` 菜单分支之前）新增分支，生成 `cefheadless-N` id、`CEF3无头浏览器N` 名、`designerX/designerY` 落位、写入 `project.resources`、`setSelectedResourceId`。
3. 画布占位卡（`:3449-3500` 同法）文案 `CEF3无头浏览器 · 非可视（不创建窗口）`。
4. 专用属性面板 `CefHeadlessProperties`（照 `FileDialogProperties :5823-5864` 写），每个输入带 `aria-label`，底部固定提示行：

```tsx
<p aria-label="无头浏览器说明">无头实例走 CEF 官方无窗口渲染，不创建任何窗口，也没有画面或截图。取内容请用 CEF3无头_取页面文本 / CEF3无头_执行JS；一期不派发事件，请用 CEF3无头_等待加载完成 与 CEF3无头_取事件JSON。</p>
```

- [ ] **Step 5: 跑测试（含完整性门禁）确认通过**

Run: `cd electron && node --import tsx --test tests/windowDesigner.test.ts tests/windowControlCompleteness.test.ts tests/designerProfessionalUi.test.tsx`
Expected: 全绿。`windowControlCompleteness.test.ts:67-76` 需要为新类型补一行 `propertyKeys`（与 Step 3 的属性键逐字一致）；`:155-168` 的枚举中文标签门禁若涉及新标签需补。

- [ ] **Step 6: 提交**

```bash
git add electron/src/services/windowDesigner/types.ts electron/src/services/windowDesigner/win32ControlRegistry.ts electron/src/services/windowDesigner/controlToolboxModel.ts electron/src/components/WpfDesigner.tsx electron/tests/windowDesigner.test.ts electron/tests/windowControlCompleteness.test.ts electron/tests/designerProfessionalUi.test.tsx
git diff --cached --stat
git commit -m "feat(设计器): 新增 CEF3无头浏览器 非可视组件（工具箱/属性面板/模型）"
```

## Task 9: 无头资源生成与项目级校验

**Files:**
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`（`validateDesignerResources :9067`、spec 结构 `:10224` 区、表生成 `:29001` 区与调用点 `:9678`、自动创建落点：窗口 `:27676` 区 / 控制台 `generateConsoleEntrySection :9593`）
- Test: `electron/tests/windowDesigner.test.ts`、`electron/tests/cefHeadlessRuntime.test.ts`

**Interfaces:**
- Consumes: Task 8 的持久化字段；Task 5 的 `CEF3_创建无头浏览器`。
- Produces: 生成的 `main.cpp` 含 `CefHeadlessSpec` + `g_cefHeadless[]` + `FindCefHeadlessResource`（**项目级作用域，不按 `ownerWindowIndex` 过滤**）与自动创建调用。

- [ ] **Step 1: 写失败测试**

`electron/tests/cefHeadlessRuntime.test.ts` 追加：

```ts
test('headless designer resource generates a project-scoped spec table and auto-create call', () => {
  const withResource = project();
  withResource.resources = [{
    id: 'cefheadless-main', type: 'CefHeadlessBrowser', name: 'CEF3无头浏览器1',
    designerX: 60, designerY: 660, ownerWindowId: 'main-window',
    instanceNumber: 3, url: 'https://example.com', cacheDir: '.cef3/headless-a',
    proxy: '', viewWidth: 1024, viewHeight: 640, autoCreate: true
  }];
  const generated = generateLingCppNativeWin32Project(withResource, {
    lingCppSourceCode: SOURCE, outputKind: 'console-application'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const code = generated.files.find(f => f.relativePath === 'main.cpp')!.content;
  assert.match(code, /static CefHeadlessSpec g_cefHeadless\[\] = \{\{ L"cefheadless-main", L"CEF3无头浏览器1", 3, L"https:\/\/example\.com", L"\.cef3\/headless-a", L"", 1024, 640, 1 \}\}/);
  assert.match(code, /static const int g_cefHeadlessCount = 1;/);
  assert.match(code, /void LingBuilder_CEF3_自动创建无头实例\(\)/);
  assert.match(code, /CEF3_创建无头浏览器\(spec\.instanceNumber, spec\.url, spec\.cacheDir, spec\.proxy, spec\.viewWidth, spec\.viewHeight\)/);
  assert.match(code, /consoleApp\.LingBuilder_CEF3_自动创建无头实例\(\);/);
});

test('duplicate headless instance numbers in one project are blocked', () => {
  const duplicated = project();
  duplicated.resources = [1, 2].map(index => ({
    id: `cefheadless-${index}`, type: 'CefHeadlessBrowser' as const, name: `无头${index}`,
    ownerWindowId: 'main-window', instanceNumber: 1, url: '', cacheDir: '', proxy: '',
    viewWidth: 1280, viewHeight: 720, autoCreate: true
  }));
  const generated = generateLingCppNativeWin32Project(duplicated, {
    lingCppSourceCode: SOURCE, outputKind: 'console-application'
  });
  assert.ok(generated.blockingDiagnostics.some(item => /实例编号.*重复/u.test(item.message ?? String(item))), '缺少实例编号重复诊断');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/cefHeadlessRuntime.test.ts`
Expected: FAIL —— spec 表未生成。

- [ ] **Step 3: 校验分支**

`validateDesignerResources`（`:9067`）为 `type === 'CefHeadlessBrowser'` 增加：实例编号必须为正整数、项目内唯一、视口宽高为正数、`cacheDir` 非空时必须是工作区相对路径（复用 `WorkspacePathPolicy` 判定），每条给中文消息（`CEF3无头浏览器 <名称>：实例编号在项目内重复，请改为唯一正整数。` 之类），进入 `blockingDiagnostics`。

- [ ] **Step 4: spec 结构、表生成与查找**

结构体（紧接 `FileDialogSpec :10224`）：

```cpp
    struct CefHeadlessSpec {
        const wchar_t* id;
        const wchar_t* name;
        int instanceNumber;
        const wchar_t* url;
        const wchar_t* cacheDir;
        const wchar_t* proxy;
        int viewWidth;
        int viewHeight;
        int autoCreate;
    };
```

表生成（对齐 `generateFileDialogSpecs :29001`，并在 `:9678` 调用点旁挂上；空表仍生成哨兵行保持既有惯例）：

```cpp
static CefHeadlessSpec g_cefHeadless[] = {
  { L"cefheadless-main", L"CEF3无头浏览器1", 3, L"https://example.com", L".cef3/headless-a", L"", 1024, 640, 1 }
};
static const int g_cefHeadlessCount = 1;
```

表与计数是文件级静态量（与 `g_fileDialogs` 同法），但**查找与自动创建必须是 `LingWindowBase` 成员**（`CEF3_创建无头浏览器` 是成员函数，自由函数调不到它）：

```cpp
    static const CefHeadlessSpec* FindCefHeadlessResource(const wchar_t* componentName) {
        // 无头实例不归属窗口运行时，按项目级作用域解析（不得按 ownerWindowIndex 过滤）。
        for (int index = 0; index < g_cefHeadlessCount; ++index) {
            if (TextEquals(g_cefHeadless[index].name, componentName) || TextEquals(g_cefHeadless[index].id, componentName))
                return &g_cefHeadless[index];
        }
        return nullptr;
    }

    void LingBuilder_CEF3_自动创建无头实例() {
        for (int index = 0; index < g_cefHeadlessCount; ++index) {
            const CefHeadlessSpec& spec = g_cefHeadless[index];
            if (!spec.autoCreate) continue;
            CEF3_创建无头浏览器(spec.instanceNumber, spec.url, spec.cacheDir, spec.proxy, spec.viewWidth, spec.viewHeight);
        }
    }
```

- [ ] **Step 5: 两种 outputKind 的自动创建落点**

- 控制台：`wmain` 内、`consoleApp.启动()` 之前调 `consoleApp.LingBuilder_CEF3_自动创建无头实例();`（守卫之后，确保子进程不会重复创建）。
- 窗口：沿用资源事件派发同级的位置（`:27676` 窗口创建完毕覆写区），在窗口创建完毕后调用一次。

- [ ] **Step 6: 跑测试确认通过**

Run: `cd electron && node --import tsx --test tests/cefHeadlessRuntime.test.ts tests/windowDesigner.test.ts tests/lingcpp.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add electron/src/services/windowDesigner/lingCppWin32Project.ts electron/tests/cefHeadlessRuntime.test.ts electron/tests/windowDesigner.test.ts
git diff --cached --stat
git commit -m "feat(cef3生成): 无头浏览器资源按项目级生成 spec 表并自动创建，实例编号重复阻断"
```

## Task 10: `lingbuilder.cef3.osr` 模块与 OSR 官方接口收口（首批）

**Files:**
- Modify: `electron/src/services/modules/cef3Modules.ts`（`CEF3_ALPHA_VERSION :11`、`api()` 用法、`CEF3_SUBMODULES :724-734` 追加注册）
- Modify: `electron/docs/modules/cef3/README.md`（生成物）、`osr.md`（生成物，命令入口段）
- Test: `electron/tests/modules.test.ts`、`electron/tests/cef3BridgeEventNames.test.ts`

**Interfaces:**
- Consumes: `Cef3OperationCatalog.generated.inc` 已有的 `lingbuilder.cef3.osr` 条目（如 `:574` `CEF3离屏_订阅像素帧`、`:30` `CEF3OSR_设置窗口外帧率`、`:835` `CEF3OSR_取窗口外帧率`）。
- Produces: 模块 `lingbuilder.cef3.osr`（首批 5 条用户命令），版本 `3.0.0-alpha.4`，依赖 `lingbuilder.cef3.browser`。

- [ ] **Step 1: 写失败测试**

```ts
test('cef3 osr module exposes the headless-relevant official interfaces', () => {
  const osr = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.osr');
  assert.ok(osr, '缺少 lingbuilder.cef3.osr 模块');
  assert.equal(osr!.version, '3.0.0-alpha.4');
  assert.deepEqual(osr!.targets.map(item => item.id), ['windows-msvc-x64']);
  const declared = osr!.contributes!.commands!.map(item => item.name);
  for (const name of ['CEF3OSR_请求重绘', 'CEF3OSR_设置窗口外帧率', 'CEF3OSR_取窗口外帧率', 'CEF3离屏_订阅像素帧', 'CEF3离屏_订阅视图矩形']) {
    assert.ok(declared.includes(name), `缺少命令 ${name}`);
  }
  assert.equal(osr!.contributes!.commands!.length, osr!.bindings!.commands!.length, 'contributes 与 bindings 条数必须一致');
  const paint = declared.includes('CEF3离屏_订阅像素帧')
    ? osr!.contributes!.commands!.find(item => item.name === 'CEF3离屏_订阅像素帧')!
    : undefined;
  assert.match(paint!.description, /一期不外发帧内容/u);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/modules.test.ts`（新用例可临时放独立文件 `tests/cefHeadlessCommands.test.ts` 内跑）
Expected: FAIL —— `缺少 lingbuilder.cef3.osr 模块`。

- [ ] **Step 3: 注册模块**

`cef3Modules.ts`：把 `CEF3_ALPHA_VERSION` 改为 `'3.0.0-alpha.4'`；在 `CEF3_SUBMODULES`（`:724-734`）追加：

```ts
  module('lingbuilder.cef3.osr', 'CEF3无头渲染模块', '系统', '提供 CEF 官方无窗口渲染（OSR）的帧率、重绘与订阅入口；无头浏览器实例配合 CEF3无头_* 命令使用。', withParamDocs(CEF3_OSR_PARAM_DOCS, osrEntries), true)
```

首批条目（句柄参数一律 `typedHandle`/`longLong`，不做 controlRef）：

```ts
const osrEntries = [
  api('CEF3OSR_请求重绘', 'invalidate', [{ name: '浏览器句柄', type: 'longLong' }, { name: '元素类型', type: 'int' }], 'void', '请求无窗口浏览器按元素类型重新绘制（0 视图、1 弹窗）；无头实例在视口改变后调用，促使 CEF 重新查询视口。', { visibility: 'advanced' }),
  api('CEF3OSR_设置窗口外帧率', 'set_windowless_frame_rate', [{ name: '浏览器句柄', type: 'longLong' }, { name: '帧率', type: 'int' }], 'void', '设置无窗口浏览器的绘制帧率；0 表示由 CEF 自行决定。', { visibility: 'advanced' }),
  api('CEF3OSR_取窗口外帧率', 'get_windowless_frame_rate', [{ name: '浏览器句柄', type: 'longLong' }], 'int', '读取无窗口浏览器当前绘制帧率。', { visibility: 'advanced' }),
  api('CEF3离屏_订阅像素帧', 'on_paint', [{ name: '浏览器句柄', type: 'longLong' }, { name: '是否订阅', type: 'bool' }], 'int', '点亮或关闭 OSR 像素帧回调订阅位。一期帧内容不外发到中文命令层（生成端 V4 subject 未接通），置真仅用于验证渲染在跑（配合 CEF3无头_取渲染帧数）；不得据此向用户承诺可取到画面或截图。', { visibility: 'advanced' }),
  api('CEF3离屏_订阅视图矩形', 'get_view_rect', [{ name: '浏览器句柄', type: 'longLong' }, { name: '是否订阅', type: 'bool' }], 'int', '点亮或关闭 OSR 视口询问订阅位；置真后可在同步事件里回写视口，优先级高于 CEF3无头_设置视口。', { visibility: 'advanced' })
];
```

`CEF3_OSR_PARAM_DOCS` 的 `浏览器句柄` 说明固定为单一来源（Task 6 已登记该命令）：

```ts
  浏览器句柄: '取自「CEF3无头_取浏览器句柄(实例编号)」的受管浏览器句柄，仅对无窗口/OSR 实例有效；句柄由运行时托管，不得手动释放，实例关闭后失效。取页面内容请改用 CEF3无头_取主框架 的框架句柄链路。',
```

- [ ] **Step 4: 跑测试并重算基线**

Run: `cd electron && node --import tsx --test tests/cefHeadlessCommands.test.ts tests/modules.test.ts tests/cef3BridgeEventNames.test.ts`
Expected: 模块计数基线更新后 PASS（`modules` +1、`commands` +5、`parameters` +相应值；`tests/modules.test.ts:470` 的 `contracts.length === 32` 不得变——OSR 命令不是运行时控件契约）。

- [ ] **Step 5: 文档生成物与登记**

Run: `cd electron && npm run module:cef3-docs && npm run module:cef3-docs:check && npm run module:cef3-coverage:check`
Expected: `osr.md` 与 `README.md` 的「用户接口数」段更新，coverage 零漂移。

- [ ] **Step 6: 提交**

```bash
git add electron/src/services/modules/cef3Modules.ts electron/docs/modules/cef3 electron/tests/cefHeadlessCommands.test.ts electron/tests/modules.test.ts
git diff --cached --stat
git commit -m "feat(模块): 新增 lingbuilder.cef3.osr 无头渲染模块并统一 CEF3 子模块版本"
```

## Task 11: 窗口项目真机端到端（设计器放置 + 命令）

**Files:**
- Create: `examples/cef3-headless-demo/`（演示项目：一个窗口 + 一个无头资源 + 按钮触发抓取，含 `build-request.json`）
- Modify: `electron/scripts/smoke-cef3-headless-native.ts`（增加窗口项目用例）

**Interfaces:**
- Consumes: Task 1-10 全部产物。
- Produces: 批次二完成判据 + 可复制给用户的示例。

- [ ] **Step 1: 冒烟脚本补窗口用例**

在同一脚本里追加第二个用例：设计器模型含 `CefHeadlessBrowser` 资源（`instanceNumber: 1, autoCreate: true`）+ 一个按钮，`.lcpp` 按钮事件里调 `CEF3无头_等待加载完成/取标题/执行JS/取页面文本`，断言：

```ts
// 1. 窗口项目 exe 启动 5 秒后仍存活（沿用既有 3 秒存活口径，用 5 秒更严）
// 2. 无头证据一律用实例编号命令（CEF3_是否禁用窗口渲染 / CEF3_取运行时样式 是 controlRef 命令，
//    无头实例没有控件名，不得用来断言）：CEF3无头_是否已创建(1)==1、CEF3无头_取渲染帧数(1)>=1、
//    CEF3无头_取视口JSON(1) 含设计器填写的 1024/640
// 3. 主窗口可见控件正常渲染（设计器可视控件不受影响），但进程内不存在第二个顶层浏览器窗口：
//    枚举该 PID 的顶层窗口数量必须等于设计器窗口数（用 EnumThreadWindows 断言，不得只靠肉眼看）
```

- [ ] **Step 2: 跑真机验收**

Run: `cd electron && npm run build:cli && npm run smoke:cef3-headless-native`
Expected: 两个用例（控制台 + 窗口）均 exit 0，无残留进程。

- [ ] **Step 3: 演示项目**

`examples/cef3-headless-demo/` 按 `examples/threading-component-demo/` 的既有结构提供 `build-request.json` 与 `src/无头抓取示例.lcpp`（`@` 内嵌 C++ 一律不用于绕开命令缺失）。红线：带命令调用的局部变量先声明后赋值；`信息框` 三参完整形态；文本拼接经 `格式化文本`。

- [ ] **Step 4: 全量回归 + 提交**

Run: `cd electron && npm run lint && npm run test:lingcpp && npm run build`
Expected: 全绿。

```bash
git add electron/scripts/smoke-cef3-headless-native.ts examples/cef3-headless-demo
git diff --cached --stat
git commit -m "test(cef3): 窗口项目无头浏览器真机验收与无头抓取示例项目"
```

## Task 12: 外部 AI 可见性与文档同步

**Files:**
- Modify: `electron/src/services/aiBridge/mcpServer.ts`（`MCP_INSTRUCTIONS`）、`aiBridgeService.ts`（`lingbuilder.module.info` 工具描述）、`electron/src/services/aiBridge/types.ts`
- Modify: `LingBuilder AI 规则手册.md`、`docs/模块开发手册.md`、`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`docs/FUTURE_OPTIMIZATIONS.md`、`docs/CEF3浏览器150内核封装.md`、`docs/CEF3_API_COVERAGE.md`（如口径变化）、`electron/README.md`、`AGENTS.md`、`更新记录/2026-09-XX.md`
- Test: `electron/tests/aiBridge.test.ts`

**Interfaces:**
- Consumes: Task 6/8/10 的最终命令名与形状。
- Produces: 外部 AI 只会用官方 OSR 路径，不会生成「创建弹窗再隐藏」这类被禁止写法。

- [ ] **Step 1: 写失败测试**

`electron/tests/aiBridge.test.ts` 追加：

```ts
test('MCP instructions route headless browser work to the official OSR commands', () => {
  assert.match(MCP_INSTRUCTIONS, /CEF3_创建无头浏览器/);
  assert.match(MCP_INSTRUCTIONS, /CEF3无头_取主框架/);
  assert.match(MCP_INSTRUCTIONS, /不创建任何窗口/);
  assert.match(MCP_INSTRUCTIONS, /截图.*(未开放|二期)/);
  assert.doesNotMatch(MCP_INSTRUCTIONS, /隐藏窗口|移出桌面|后台窗口/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd electron && node --import tsx --test tests/aiBridge.test.ts`
Expected: FAIL —— instructions 无匹配。

- [ ] **Step 3: 写 instructions 与工具描述（四层消费面全部到位）**

AGENTS.md「模块能力更新必须同步 MCP 通道」把外部 AI 消费层固定为四层，本次无头能力必须逐层落：

① `MCP_INSTRUCTIONS` 新增**第 9 条**（第 8 条已被 HTTP 服务端指引占用，编号不得复用；改措辞必须同步 `edit.propose` 工具描述与 AGENTS 对应条目）：

```
9. CEF3 无头浏览器一律用 CEF 官方无窗口渲染（OSR）：CEF3_创建无头浏览器(实例编号, 地址, 独立缓存目录, 代理地址, 视口宽, 视口高)，或设计器「CEF3无头浏览器」非可视资源（属性填实例编号与视口，勾选启动时自动创建）。取内容两条路：CEF3无头_取主框架(实例编号) 拿框架句柄后用 CEF3框架_* / CEF3填表_* / CEF3DOM_*；或 CEF3无头_执行JS / CEF3无头_取页面文本 / CEF3无头_取页面源码。浏览器级控制（重绘、帧率、订阅）用 CEF3无头_取浏览器句柄 的句柄配 CEF3OSR_* / CEF3离屏_*。红线：禁止创建可见窗口再隐藏、禁止移出桌面、禁止用 DevTools 截图冒充无头画面；一期无头实例无截图能力，用户要截图时如实说明并引导改用可见窗口浏览器或等后续版本；控制台项目不派发事件处理器，用 CEF3无头_等待加载完成 与 CEF3无头_取事件JSON；等待与取内容必须带超时参数，禁止无界轮询。
```

② `lingbuilder.module.info` 消费的命令表随 Task 6/10 自动更新；另在 `lingbuilder.cef3.browser` 的 `contributes.snippets[]` 补一条「CEF3 无头抓取（控制台项目）」范本，内容 = Task 7 冒烟脚本里那段 `.lcpp`（创建 → 等待 → 取标题 → 执行JS → 取源码 → 关闭），让外部 AI 抄现成写法而不是自己拼。

③ 行为门禁：无头命令全部 `实例编号` 寻址，不进 controlRef 门禁；确认 `build.run` 的控件门禁对「只有无头资源、画布无控件」的项目不误伤（Task 9 的用例覆盖）。

④ 根目录 `LingBuilder AI 规则手册.md` 外部 AI 节（Step 4 落）。

`lingbuilder.module.info` 工具描述补一句：无头命令位于 `lingbuilder.cef3.browser`，OSR 官方接口位于 `lingbuilder.cef3.osr`；两者都以浏览器/框架**句柄**寻址，不需要设计器控件。

改完 `MCP_INSTRUCTIONS` 必须重建 bundle 并做真机握手验收（外部 stdio 宿主只从 bundle 取 instructions）：

```bash
cd electron && npx esbuild src/cli.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/cli.cjs
npm run smoke:ai-bridge-stdio
```

- [ ] **Step 4: 规则手册与模块手册**

`LingBuilder AI 规则手册.md`：新增「CEF3 无头浏览器（OSR）」节（`.lcpp` 调用规范、等待/轮询范式、与控件路径的边界、截图未开放红线）；确认 `electron/server.ts` 注入链未断（该文件把规则手册追加进 system prompt）。
`docs/模块开发手册.md`：登记 `lingbuilder.cef3.osr` 模块（manifest v2、targets、bindings、随包文档）。
`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`：无头实例登记表口径（编号偏移 1000000 弹窗 / 2000000 无头）与新模块。
`docs/FUTURE_OPTIMIZATIONS.md`：追加四条遗留——像素帧→PNG 截图（含 V4 subject 降形修复 `lingCppWin32Project.ts:15173-15215` 与桥 `:9222` 的缓冲生命周期）、OSR 输入命令从 controlRef 扩为句柄形态、无头事件处理器派发、旧 `.lcpppkg` 教程包需按新桥重导。

- [ ] **Step 5: 跑测试 + 当天记录 + 提交**

Run: `cd electron && node --import tsx --test tests/aiBridge.test.ts tests/modules.test.ts`
Expected: PASS。

写 `更新记录/2026-09-19.md`（或当日文件）：日期、内容、影响范围、验证结果（含真机冒烟输出摘要）。

```bash
git add LingBuilder\ AI\ 规则手册.md docs/模块开发手册.md docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md docs/FUTURE_OPTIMIZATIONS.md docs/CEF3浏览器150内核封装.md electron/README.md AGENTS.md electron/src/services/aiBridge electron/tests/aiBridge.test.ts
git diff --cached --stat
git commit -m "docs(cef3): 无头浏览器命令契约与 AI 指引同步，登记二期遗留项"
```

（`更新记录/` 已 gitignore，只写不提交。）

---

## 批次收尾验收（两批次各跑一次）

```bash
cd electron
npm run lint
npm run test:lingcpp
npm run build
npm run module:cef3-coverage:check && npm run module:cef3-catalog:check && npm run module:cef3-docs:check
npm run verify:cef3-release
npm run smoke:cef3-headless-native
```

最终人工确认（不接受只跑自动化）：
1. 控制台无头 exe 双击运行期间**任务栏无新增窗口、无浏览器进程窗口**，日志含真实标题与源码长度。
2. 窗口项目同时存在可视设计器控件与无头实例时，两者互不影响（可见控件照常出画面、无头照常取文本）。
3. 全仓 grep 无「为无头实例创建 HWND」的路径残留：`LB_CEF3_BROWSER_WINDOWLESS` 只出现在无头创建路径，`BrowserCreateChrome` 不出现在无头函数体内。
