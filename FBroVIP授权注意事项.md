# FBro VIP 授权注意事项

适用范围：`electron/native/fbro-bridge/`（`LingBuilderFbroBridge.cpp`、`LingBuilderFbroProcessRuntime.hpp`）、`LingBuilderFbroHost.exe` 独立宿主进程，以及依赖 VIP 扩展能力的多实例浏览器项目（如 `win32-fbro-multi-browser-manager`）。

结论先行：**在线 VIP 授权必须在 `FBroHsInitPro` 之后调用。** 放在之前会让 libcef 触发 `CHECK` 并杀死宿主进程。

---

## 1. 正确的初始化时序

`LB_FBro_InitializeEx` 内必须按以下顺序执行，三步全部早于任何浏览器创建：

```
FBroHsInitPro(&settings, g_init_event, 1024)
  ↓
ApplyPendingLicenseAfterInitialize()        // 内部调用 FBroHsOnlineLicenseControl_SetKey
  ↓
FBroHsVIPRequestContext_EnableExtensionPlus()
  ↓
（之后才允许创建 RequestContext 与浏览器，并对每个独立 RequestContext 调用
  FBroHsVIPRequestContext_LoadExtension）
```

授权与 `EnableExtensionPlus` 必须早于创建浏览器，否则内容脚本依赖的 VIP 扩展钩子不会生效。

### 为什么不能提前

`FBroHsOnlineLicenseControl_SetKey` 是**在线**校验，调用链会进入 CEF：

```
FBroHsOnlineLicenseControl_SetKey
  → FBrowserVIP.dll
    → FBrowserCEF3lib.dll
      → libcef.dll     ← CEF 未初始化时在此触发 CHECK
```

CEF 尚未初始化时被要求使用其子系统，libcef 主动 `CHECK` 失败自杀，异常码 `0x80000003`（断点异常，不是访存违例）。宿主进程直接消失，表现为「浏览器创建不出来」。

## 2. 不要照搬 C# 参考的顺序

FBro 官方 C# 示例 `VIP独立浏览器插件/Program.cs` 的顺序是 `SetAuthorizationCode` → `InitPro` → `EnableAdvancedExtension`，即授权在初始化**之前**。

**不能照搬。** 该示例运行在普通 GUI 主进程；本项目在 CEF 宿主子进程 `LingBuilderFbroHost.exe` 内调用，约束不同。

参考实现只能用于确认 **API 选择**——C# 的 `SetAuthorizationCode` 在 `FBroSharpLib.dll` 中映射的正是 `FBroHsOnlineLicenseControl_SetKey`（可从该 DLL 导出表核对）。它不能用于确认**调用时机**。

## 3. 定位过程与证据（供复现参考）

崩溃是确定性单点，同一偏移重复上百次。定位步骤：

1. 临时启用作用域限定的 WER LocalDumps（见第 6 节），取得 full dump。
2. 解析 minidump 异常流：`exception_code=0x80000003`，`address=0x7FFB22175A19`。
3. 用模块列表解析地址归属：`libcef.dll` base `0x7FFB1CB00000` → **偏移 `0x5675A19`**，与 WER 报告一致。
4. 扫描崩溃线程栈的返回地址，自内向外：

```
libcef.dll+0x5675A19          ← CHECK 触发点
libcef.dll+0x2C63BD
FBrowserCEF3lib.dll+0x6C5C4
FBrowserVIP.dll+0x1E3BA3
FBrowserVIP.dll+0x17A20F
LingBuilderFbroBridge.dll ...
```

5. 把本桥偏移映射到导出表，得 `LB_FBro_InitializeEx + 0xE4F`——确认崩溃发生在初始化函数内部，而该函数内唯一进入 VIP 层的调用就是授权应用。

## 4. 排查方法：先读日志，不要先读源码猜

**优先读 CEF 自己的日志。** `settings.log_file` 指向 `<rootCacheDirectory>/fbro.log`。

- 必须在**整个工作区范围**搜索。崩溃实例的 profile 目录可能完全为空、根本没有日志，只看某一个目录会漏。
- 该日志会明确写出约束违规，例如 `context.cc(163) The cache_path directory (...) is not a child of the root_cache_path directory`。
- **若该错误没有出现，就不能把崩溃归因于缓存布局。** 本次排查中缓存嵌套一度被误判为根因，实际日志里从未出现这条错误。

有效的排除手段（按成本从低到高）：

| 手段 | 能证明什么 |
|---|---|
| 有/无授权码对照跑同一 exe | 崩溃是否由授权路径引入 |
| 单实例 vs 多实例 | 是否多进程竞争（本次证明不是） |
| 移走插件目录仍带授权码 | `LoadExtension` / `EnableExtensionPlus` 是否无罪（本次证明无罪） |
| 连续启停两轮 | 是否状态残留/重复授权（本次证明不是） |
| WER full dump | 具体崩溃函数 |

## 5. 容易再次踩中的陷阱

- **`smoke-fbro-native.ts --build-only` 不重建桥 DLL。** 它返回 `ok:true` 也只代表测试 exe 构建成功。判断桥改动是否真正生效，必须比对 DLL 的时间戳或 SHA-256，不能只看脚本返回值。
- **`.lcpppkg` 会携带桥 DLL，但只反映导出时刻 SDK 模块目录的内容。** 包含 `lingbuilder.fbro.sdk` 全量资产（约 478 项），其中有预编译 `LingBuilderFbroBridge.dll` 与 `sdk/include/*.hpp`，所以桥的修复确实随包分发、导入方无需自行重建。前提是修改 `electron/native/fbro-bridge/*` 后**先把产物同步进 `.lingbuilder/modules/lingbuilder.fbro.sdk/`**（DLL 与 `.lib` → `sdk/bridge/x64`、`sdk/lib/x64`；头文件 → `sdk/include`）再重新导出，否则包里仍是旧版本。是否同步成功必须比对 SHA-256。
- **改 `*.hpp` 后不要只改源码。** 编译使用的是从 SDK 模块复制到 `.lingbuilder-build/<project>/modules/lingbuilder.fbro.browser/include/` 的副本。只改 `electron/native/fbro-bridge/` 下的头文件，编译器看不到——本次内嵌授权码时就先踩了这个坑：源码已有宏，exe 里却查不到任何痕迹。必须同步 SDK 模块目录后重新生成工程。
- **断言调用顺序时必须先切出函数体。** `ApplyPendingLicenseAfterInitialize` 的**定义**位于源文件更早处（约 1700 行），而调用发生在 `LB_FBro_InitializeEx` 内（约 3600 行）。用全文 `indexOf` 比较表达的是**定义顺序**而非调用顺序，会得出完全相反的结论。正确做法见 `electron/tests/modules.test.ts`：先 `slice` 出 `LB_FBro_InitializeEx` 函数体再比较。
- **插件有两级成功态。** `插件已加载` 表示扩展已在 RequestContext 注册；`插件已生效` 更强，表示 DOM 探针确认 `#doubao-downloader` 真实注入。任何 smoke 或测试断言插件成功时必须**同时接受两者**，只匹配 `插件已加载` 会把真实成功判为失败。
- **崩溃次数会被重启机制放大。** 控制器按 `restartTimes.size() < 3` 上限、`1 << (restartIndex - 1)` 秒指数退避重启（`LingBuilderFbroProcessRuntime.hpp`）。单次故障在事件日志中会放大为「每实例 4 条」记录，UI 显示为「重启等待」。统计时须按此换算，不要把重启放大误判为多个独立缺陷。
- **第三方外部扩展会污染日志。** 机器级注册表 `HKLM\SOFTWARE\Google\Chrome\Extensions\*` 下的第三方扩展会被 CEF 外部扩展加载器拉进每个 profile 并可能加载失败，在 `fbro.log` 中产生与本项目无关的扩展错误。判断本项目插件是否注册成功，应读 profile 的 `Default/Secure Preferences` → `extensions.settings`，而不是看日志中的扩展报错。其中 `location=3` 表示 `EXTERNAL_REGISTRY`，走注册表旁路，与 VIP 管线无关。
- **调整时序前先确认 `RejectPendingExtensions` 的遍历范围。** `OnContextInitialized` 会在 `g_extension_plus_enabled` 为假时调用它，但它只遍历 `g_browsers`；初始化期该表为空，因此把授权后移不会误拒插件。若将来该回调改为遍历其它来源，必须重新评估此结论。

## 6. WER LocalDumps 使用规范

需要栈信息时可临时启用：

- 键位：`HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\LingBuilderFbroHost.exe`
- 值：`DumpFolder`(ExpandString)、`DumpType=2`(full)、`DumpCount`
- **只新增该子键，不得触碰同级既有子键**（本机存在 `Weixin.exe`）。
- 抓到 dump 后**立即删除该子键并清理 dump 文件**（full dump 单个约 310 MB）。

符号化限制：用仓库内 vendored `sdk/official` 重建的桥与出货 DLL 不一致（体积明显不同），其 PDB **无法**逐行符号化出货二进制。此时只能采信：

- 模块级定位，如 `libcef.dll+<offset>`；
- 导出表级定位，如 `LB_FBro_InitializeEx+0xE4F`。

越过最后一个导出符号的大偏移（形如 `SomeExport+0x8xxxx`）只说明"在本 DLL 内"，**不构成证据**，不要据此下结论。

## 7. 其他硬约束

- 独立缓存**不能**与 `--single-process` 共用（FBro 官方约束）。调试时也不要临时加。
- FBro 的 `FBroInitSettings` **未暴露** `root_cache_path`（`FBroBaseType.h` 中该字段已被注释），不要试图显式设置它。
- FBro Alloy 嵌入模式没有 Chromium 原生扩展管理界面，`chrome://extensions/` 走的是自实现诊断页。插件是否生效以运行时 DOM 探针状态为准，**不要用 `chrome://` 页面判断**。
- 无 VIP 授权时只禁插件、不阻断浏览器创建；此时状态为「插件加载失败：FBro VIP 授权未配置，浏览器继续运行但插件未加载。」属预期行为。

## 8. 授权码保密要求

- 只能通过环境变量 `LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE` 或 `LINGBUILDER_FBRO_VIP_KEY` 传入。
- Bridge 读取后会立即 `SetEnvironmentVariableW(..., nullptr)` 从进程环境清除，并对缓冲区 `SecureZeroMemory`。
- 授权码**不得**写入源码、生成文件、日志、项目模型、测试、更新记录或分享包。
- 宿主子进程通过继承父进程环境获得该变量（`BuildEnvironmentBlock` 继承完整环境后覆盖 7 个键），不需要也不应该把授权码写进命令行或配置文件。

## 8.1 内部分发：把授权码编译进 exe

仅用于把 exe 分享给**受信任的内部用户**，让对方双击即用、无需配置环境变量。

机制：`LingBuilderFbroProcessRuntime.hpp` 内有可选宏 `LINGBUILDER_FBRO_EMBEDDED_VIP_AUTHORIZATION_CODE`。宏本身不含任何授权码，仓库里也不存授权码；值只能在构建时通过 MSVC 的 `CL` 环境变量以 `/D` 注入。运行时**环境变量优先**，内嵌值仅作兜底，便于临时换码而不必重新编译。

```powershell
cd "<repo>\.lingbuilder-build\win32-fbro-multi-browser-manager-native"
$env:CL = '/DLINGBUILDER_FBRO_EMBEDDED_VIP_AUTHORIZATION_CODE=L\"你的授权码\"'
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" `
  win32-fbro-multi-browser-manager.sln /m /t:Rebuild /p:Configuration=Release /p:Platform=x64
$env:CL = $null
```

**风险与边界（必须向使用方说明）：**

- 内嵌值在 exe 中是**明文**，`strings` 或十六进制工具即可提取。等同于把 VIP 授权分发给每个拿到 exe 的人，**不得外流**。
- 授权码会进入 `.lingbuilder-build/` 产物。该目录不得提交、不得随源码包分发。
- 构建后必须核对授权码分布：exe 内应有且仅有内嵌值，源码、SDK 头文件、`.lcpppkg`、生成的 `main.cpp`、文档与更新记录都必须为 0 命中。
- 该例外**只适用于内部分发构建**。默认构建与 `.lcpppkg` 仍遵守第 8 节的保密要求。

## 9. 验证基线

修改该时序后，至少需通过：

```powershell
cd electron
npm run lint
node --import tsx --test tests/modules.test.ts tests/windowDesigner.test.ts `
  tests/browserWorkbench.test.ts tests/lcppSourcePackage.test.ts tests/solution.test.ts

# 带授权码（通过环境变量传入，不要写进脚本）
npx tsx scripts/smoke-win32-fbro-multi-browser-manager.ts --single-instance
npx tsx scripts/smoke-win32-fbro-multi-browser-manager.ts

# 不带授权码的回归：浏览器须仍可用，仅插件不加载
npx tsx scripts/smoke-win32-fbro-multi-browser-manager.ts
```

修复后实测结果（2026-08-09）：

| 条件 | 修复前 | 修复后 |
|---|---|---|
| 单实例 + 授权码 | 崩 4 次，0 个子窗口 | `exit=0`，`crashes=0` |
| 三实例 + 授权码 | 崩 12 次，0 个子窗口 | `exit=0`，`crashes=0`，三实例均「插件已生效」 |
| 无授权码（回归） | 浏览器可用，插件不加载 | 行为不变，`crashes=0` |

lint 通过；上述 5 个测试文件 269 项全部通过。

## 10. 相关位置

| 内容 | 位置 |
|---|---|
| 授权应用与初始化时序 | `electron/native/fbro-bridge/LingBuilderFbroBridge.cpp`（`LB_FBro_InitializeEx`、`ApplyPendingLicenseAfterInitialize`） |
| 每 RequestContext 加载扩展 | 同上，`FBroHsVIPRequestContext_LoadExtension` 调用处 |
| 宿主进程与独立缓存 | `electron/native/fbro-bridge/LingBuilderFbroProcessRuntime.hpp` |
| 时序断言 | `electron/tests/modules.test.ts` |
| 运行时插件状态机 | `electron/src/services/windowDesigner/fbroBrowserManagerRuntime.ts` |
| 原生 smoke | `electron/scripts/smoke-win32-fbro-multi-browser-manager.ts` |
| 规则汇总 | `AGENTS.md` →「FBro VIP 授权与插件加载时序规则」 |
