# 「C++ 源码库」功能落地方案（v1 函数映射 / v2 回调与类 / M3 展望）

- 提出日期：2026-10-27
- 来源：用户反馈「别人用 C++ 写的函数、类等，直接保存到一个文件里，在窗口里或代码内直接调用、传函数、传参数」
- 结论：立项。本功能是继「DLL 命令声明 / @ 行内嵌 / .lbmod 模块」之后的第四条 C++ 接入路径，定位为**源码级、项目内、零封装**的中间层：把别人写好的 `.h/.cpp` 放进项目，声明中文命令后即可在 `.lcpp` 中带补全、带类型检查地直接调用；v2 补齐「传函数（回调）」与「类」。

---

## 1. 现状对照（为什么做）

| 现有路径 | 使用前提 | 能力边界 |
| --- | --- | --- |
| 项目 DLL 命令声明（`src/项目DLL命令.lcpp`） | 先把 C++ 编译成 DLL | 跨 DLL ABI 类型受限；中文子程序无法作回调传入 |
| @ 行内嵌 C++ | 用户自己会 C++ | 逐行内嵌、无补全、类无法复用 |
| .lbmod 模块封装 | manifest/binding/pack/install 全流程 | 能力最全但面向生态分发，不是「随手放个文件」 |
| **C++ 源码库（本功能）** | 放源码 + 写声明 | 约束子集（见 §2.6 红线） |

技术可行性根基：LingBuilder 最终产物就是 MSVC 编译的真实 C++ 工程，用户 `.cpp` 与生成代码**同编译器、同 CRT、同二进制**，没有 DLL 的 ABI 边界——这是四条路径里互通成本最低的一条。

## 2. 总体设计（定案，不分叉）

### 2.1 承载形式

- 新声明文件：`src/项目C++源码库.lcpp`（固定文件名约定，同 `项目DLL命令.lcpp` 先例）。
- 新库块种类：`C++源码库`，**不复用、不扩展 `DLL命令库` 的语义**（架构 DLL 路径 / 系统 / 加载方式在其上无意义，物化流程完全不同）。
- 独立服务 `projectCppSourceLibraryService.ts`，与 `projectDllCommandService.ts` 平行；编辑器为新组件，但结构（parse→state→serialize、表格网格、MenuService 右键、折叠记忆）照搬 DLL 编辑器先例。

### 2.2 语法（v1）

```text
包 项目C++源码库

C++源码库 数学库
  源码 = cpp/mymath.cpp
  头文件 = cpp/mymath.h        // 可选；缺省由生成器自动发前置声明
  整数型 加法计算(整数型 a, 整数型 b) = add    // 与 DLL 命令声明同形，无「命令」前缀
    备注: 计算两数之和
  文本型 问候(文本型 名字) = greet
  空 累计(整数型 当前值 传址) = accumulate
结束C++源码库
```

- `= C++函数名` 必写，且必须是 ASCII C++ 标识符（`^[A-Za-z_][A-Za-z0-9_]*$`）。不用中文函数名：无 def/装饰名负担是事实，但 ASCII 名让链接期诊断、生成调用、VS 导出全部走最稳路径。
- C++ 函数必须是**全局自由函数**（v1）；同一声明文件允许多个 `C++源码库` 块。
- 序列化必须 100% 往返幂等（DLL 管线铁律）。

### 2.3 生成与编译模型

复用 DLL 命令声明整套管线的形状：

1. **虚拟模块**：`lingbuilder.project.cppsrc`（manifest v2），由声明合成——`contributes.commands` + `bindings.commands`（`runtimeName = C++ 函数名`，参数/返回类型直接用 binding 词表）+ `target.headers = ['include/CppSourceLibraries.h']` + `target.sources = [声明的源码文件]` + `installPath = __project_cppsrc__/<projectId>`。
2. **四个消费点实时生效**（与 DLL 虚拟模块同构，2026-09-18 已修顺的机制）：App.tsx 编辑器缓冲实时合成、server.ts `/api/modules/project` 的 `projectDeclarationModule` 磁盘快照（响应扩展第二字段）、MonacoCodeEditor 补全上下文、aiBridgeService `getModuleContext`。补全、参数提示、实参类型门禁（`lingcpp-argument-type-*`）由 binding 驱动**自动生效，无需新写**。
3. **物化**（新 `projectCppSourceMaterializeService.ts`，镜像 `projectDllMaterializeService`）：把用户 `.h/.cpp` 从 sourceRoot 复制到 buildDir/sourceDir/exportDir 三处 `modules/lingbuilder.project.cppsrc/sources/`；生成声明头写入 `include/CppSourceLibraries.h`；把 `.cpp` push 进 `ModuleNativeDependencyPlan.sourceFiles`。
4. **声明头**：无用户头文件 → 在 extern "C++" 区发**期望签名前置声明**（签名即诊断：用户定义不匹配时 C2556/C2664 直接指向我们发的声明）；有用户头文件 → 只发 `#include` 不发声明（避开 DLL 管线 C2556/C2373 的老雷）。头部附「期望签名」中文注释。
5. **编译**：`main.cpp` 前导 `#include "modules/lingbuilder.project.cppsrc/include/CppSourceLibraries.h"`（`generateModuleCppPreamble` 现成机制）；`compileMsvcPreviewWithModules` 已对 `plan.sourceFiles` 逐 TU `cl /c`（含 obj 指纹缓存）；`/utf-8 /std:c++17` 现成。
6. **VS 导出**：`visualStudioProjectExporter.getSourceFiles` 已把模块 `targets[].sources` 映射为 `modules/<id>/<file>` 的 ClCompile 条目——若虚拟模块清单未被该链路消费则小幅扩展 `getSourceFiles`（W3 验证项）。

### 2.4 类型映射（v1 定案表）

| .lcpp 类型 | binding 词表 | C++ 侧形参写法 |
| --- | --- | --- |
| 空型 | void | `void` |
| 整数型 | int | `int` |
| 长整数型 | longLong | `long long` |
| 小数型 | double | `double` |
| 单精度小数型 | float | `float` |
| 逻辑型 | bool | `bool` |
| 字节型 | int | `unsigned char` / `int` |
| 文本型 | wideString | `const wchar_t*`（写 `std::wstring` 值参亦可，隐式转换兼容） |
| 字节集 | bytes | `const std::vector<unsigned char>&` |
| 指针整数 | longLong | `uintptr_t` |
| 传址参数 | byRef | C++ 侧写指针（如 `int*`），调用点传 `&变量` |

表外类型（结构体、数组、自定义类型）→ 明确中文诊断，不静默。ABI 以 W6 真机 smoke 实测钉死。

### 2.5 与既有红线的衔接

- 声明文件聚合排除：`aggregateLingCppProjectSources`（lingCppWin32Project.ts:873）现有「含 DLL命令库 的文件其 classes 整体排除」条件**必须加上 `cppLibraries`**——声明文件专用语义，防「事件全 stub」老雷（dll-command-declaration-plan 雷一）。
- `argumentTypeAdmission.ts` 豁免清单加入新声明文件（同 项目DLL命令/全局变量/数据类型 文件）。
- 文件保护：App.tsx 禁删/禁改名清单（现 `isProjectDllCommandsFilePath` 两处）加同名判定；Sidebar 树按钮 + 「未创建」徽标复用 `projectDeclarationFileExists` 模式。
- F5 源码以 IDE 缓存为准为既有行为，自动生效，无需改动。

### 2.6 红线（v1 非目标，全部明确中文诊断或文档红线）

1. 不支持模板、重载、命名空间、默认实参、成员函数（v1 仅全局自由函数）。
2. 不支持结构体/数组参数（v2 只加类句柄，结构体映射进 M3）。
3. C++ 源码必须 UTF-8（带不带 BOM 均可）；非 UTF-8 给中文诊断（GBK 中文注释会被 `TextDecoder` fatal 检出）。
4. 禁止 `main/wWinMain/DllMain` 入口符号（源码静态扫描，构建前阻断，防链接期惨案）。
5. `#include` 仅支持源码文件同目录相对路径；附加包含目录进 M3。
6. C++ 函数不得抛异常逸出（文档红线；捕获模式进 M3）。
7. 源码级共享 = 源码随项目分发（与「源码可复制给别人使用」目标一致）；要隐藏源码的用户仍走 DLL/模块路线（文档写明分工）。

### 2.7 用户入口（定案）

外部拿到的 `.cpp/.h` 进入解决方案中的项目，共三个用户入口 + 一个外部 AI 通道，全部走**复制进项目**而非外部引用（保持工程自包含）：

1. **解决方案树项目节点右键（主入口）**：项目节点右键菜单新增「添加 C++ 源码…」→ 原生文件多选对话框（过滤 `.h/.cpp/.hpp/.cxx`）→ 复制进项目 sourceRoot 下 `cpp/` 目录，重名自动追加 `-2/-3` 后缀（复用 `designerAssetService.importImage` 先例）→ 完成后自动创建/打开 `src/项目C++源码库.lcpp` 声明文件。原生对话框走既有 IPC 先例（main.ts `solution-import:pick-project` 同款 `dialog.showOpenDialog` 通道）。
2. **解决方案树「C++ 源码库」按钮**（与「DLL 命令」按钮同级 + 未创建徽标）：打开/创建声明文件结构化编辑器；编辑器工具栏提供「导入源码文件…」（同入口 1 的对话框与复制逻辑）与「从 .h 导入声明」（文本解析，不落盘只生成声明行）。
3. **命令面板 / 文件菜单**：`workbench.action.project.addCppSourceFiles`——UI 按钮与右键动作一律经 CommandService 执行（AGENTS 验收标准）。
4. **外部 AI 通道（不加新 MCP 工具）**：外部 AI 经 `edit.apply` 的 files[] 直接写 `cpp/*.cpp/.h` 与声明文件（新建文件本就允许），该路径写进 MCP_INSTRUCTIONS 新条目（W7）。

导入的源码文件在解决方案树 src 组按目录自然显示（`cpp/` 子目录），**不新做树分组**。编码校验不在导入期做，统一在诊断与构建期（W1/W3），保持单一判据出口。

## 3. M1（v1 函数映射）工作包

依赖顺序：W1 → W2 →（W3 ∥ W4）→ W5 → W6 → W7。

### W1 语法、解析、序列化与诊断族

- `electron/src/services/lingCpp/parser.ts`：新增 `CPP_SOURCE_LIBRARY_RE`（`^C++源码库\s+(名称)$`）、`CPP_SOURCE_FILE_RE`（`^源码\s*=\s*(.+)$`）、`CPP_HEADER_FILE_RE`（复用/仿 `DLL_SDK_HEADER_RE` 放宽到项目相对路径）、`结束C++源码库` 闭合；`types.ts` 新增 `LingCppCppSourceLibrary`/`LingCppCppSourceCommand`，`LingCppProgram` 挂 `cppLibraries`。
- 新服务 `electron/src/services/lingCpp/projectCppSourceLibraryService.ts`：
  - `PROJECT_CPP_SOURCE_LIBRARY_FILE_NAME = '项目C++源码库.lcpp'`、`PROJECT_CPP_SOURCE_MODULE_ID = 'lingbuilder.project.cppsrc'`、`isProjectCppSourceLibraryFilePath`、空模板常量（带语法示例注释）。
  - `serializeProjectCppSourceLibraries` / 片段复制粘贴（仿 `serializeDllCommandSnippet`/`parseDllDeclarationSnippet`）。
  - 诊断 `getProjectCppSourceLibraryDiagnostics`，族 id 前缀 `lingcpp-cpp-source-library-*`：源码文件未填/不存在/越出 sourceRoot、非 UTF-8、`= 函数名` 缺失或非 ASCII 标识符、类型白名单违规、命令/库重名、入口符号（main/wWinMain/DllMain）静态扫描、命令名与 C++ 名冲突检测。
- 测试钉子：往返幂等、逐条诊断触发/放行、别名顺序（无别名场景）、参数备注与公开标记（仿 lingcpp.test.ts DLL 用例 6437–6939 的 17 条形状，落 `electron/tests/projectCppSourceLibrary.test.ts` 并挂进 `test:lingcpp` 脚本）。

### W2 虚拟模块与四个消费点

- `createProjectCppSourceDeclarationModuleFromSources`（镜像 `createProjectDllDeclarationModule`，projectDllCommandService.ts:533 形状）：manifest v2、contributes.commands（中文描述取 备注）、bindings（runtimeName=C++ 名、encoding='wide'）、targets、installPath。
- 消费点接线（四处，全部照 DLL 同名机制）：App.tsx 缓冲实时合成（1559–1582 形状）、server.ts `/api/modules/project` 快照（833–848 形状，响应加 `projectCppSourceModule` 字段）、MonacoCodeEditor.tsx 补全上下文（1414–1438）、aiBridgeService `getModuleContext`（2755–2766）。
- App.tsx 文件保护两处（2615/2707）；Sidebar 「C++ 源码库」按钮 + 未创建徽标；solutionService 新项目模板播种空文件（865/882 同款两处）。

### W3 生成与物化

- `aggregateLingCppProjectSources` 排除条件加 `cppLibraries`（lingCppWin32Project.ts:873）。
- `generateProjectCppSourceDeclarationHeader(libraries)`：含「期望签名」注释 + 前置声明 / 用户头文件 `#include` 两分支；`generateModuleCppPreamble` 按 manifest headers 自动 include（现成）。
- 新 `electron/src/services/modules/projectCppSourceMaterializeService.ts`：三处目录复制（buildDir/sourceDir/exportDir）、UTF-8 校验、`plan.sourceFiles` push、失败中文阻断并入 `moduleNativePlan.blockingDiagnostics`。
- VS 导出验证：确认 `getSourceFiles`（visualStudioProjectExporter.ts:151）消费虚拟模块 `targets[].sources`；未消费则显式扩展。导出工程必须能独立编译。

### W4 门禁与诊断接线

- 生成前阻断挂点：仿 `collectProjectDllMissingSystemAliasDiagnostics` 在 lingCppWin32Project.ts:622 附近并入 blockingDiagnostics（F5 与 MCP build.run/native.preview 双入口自动继承，无需新增门禁入口）。
- `argumentTypeAdmission.ts` 豁免新声明文件。
- 实参类型门禁、controlRef 门禁：binding 驱动自动生效，只加回归用例。

### W5 结构化编辑器与工作台入口

- 新 `electron/src/components/ProjectCppSourceLibraryEditor.tsx`：表格式（库头：源码/头文件；命令网格：命令名/返回类型/C++ 函数名/备注/参数子表），parse→state→`applyModel` serialize 写回（DLL 编辑器数据流同款，含草稿 key 按行的教训）。
- MenuService 三命令（search/expandAll/collapseAll，`cppSourceLibraryEditorCommands.ts`，上下文常量同传——menuService 静默失效老雷）。
- DiffViewer 伪页签三分支挂载（12928–12937 同款）+ 新手模式顶栏快捷按钮（12718 同款）。
- 「从 .h 导入」：新写 `parseCppHeaderDeclarations`（支持**非空参数表**——实测旧 `parseDllHeaderDeclarations` 参数分支不可达，旧函数保持不动避免影响 DLL 编辑器），同一类型白名单，解析不了给中文提示。
- 「添加 C++ 源码…」导入链（§2.7 入口 1/2/3 共用）：原生文件对话框 IPC 通道（main.ts，仿 `solution-import:pick-project`）、复制落盘服务（sourceRoot 下 `cpp/`、重名 `-2/-3` 后缀、完成后自动打开声明文件）、项目节点右键菜单项、`workbench.action.project.addCppSourceFiles` 命令注册与菜单/命令面板挂接。

### W6 真机验收与示例

- `electron/scripts/smoke-cpp-source-library-native.ts`（仿 smoke-web-async-native.ts）：CLI 建项目 → 写声明 + `mymath.cpp` → 双平台（Win32+x64）编译运行 → 断言输出；覆盖 整数/文本/小数/字节集/传址 五类 ABI + VS 导出工程独立编译。
- 示例工程（仿「系统DLL调用演示」：`mymath.cpp` 三函数 + 窗口调用演示）。
- new_emoji 后端过一遍（前导 include 与多 TU 对 NE 布局是否成立；不成立在 NE 侧补齐）。

### W7 文档与外部 AI 同步（四层消费链，模块能力同步常设规则同构适用）

- `LingBuilder AI 规则手册.md`：新增「C++ 源码库」节（语法、类型映射表、红线）+ 外部 AI 条。
- `mcpServer.ts` 的 `MCP_INSTRUCTIONS` 新增条目（顺延现有最大编号）：何时用源码库 vs DLL 命令 vs 模块；`tests/aiBridge.test.ts` 关键词断言；**重建 `dist/cli.cjs`**（esbuild 命令见 AGENTS.md）+ 真机 stdio 握手验收。
- docs 用户指南新页 + 导航登记；`docs/FUTURE_OPTIMIZATIONS.md` 登记本方案与 M3 条目；当天 `更新记录/YYYY-MM-DD.md`。

**M1 出口标准**：新建窗口项目 → 项目节点右键导入外部 `.cpp` → 声明命令 → F5 编译运行成功；补全/参数提示/实参类型红线在编辑器即时可用；双平台 smoke PASS；VS 导出工程独立编译通过；新增测试钉子 ≥15 全绿（`test:lingcpp`）；外部 AI 按规则手册能生成可编译的源码库调用代码（stdio 验收）。

## 4. M2（v2 回调与类）工作包（2026-10-27 已全部落地，C1~C4 与下述设计一致；增量实录：声明文件需豁免处理器调用形态扫描、类句柄流必须先声明后赋值——两条都已入规则手册）

依赖：M1 全部落地。

### C1 回调参数声明与校验

- 参数语法：`处理器 进度回调(整数型 已下载, 整数型 总大小)`（处理器型参数后跟内联签名括号，单层配平）。
- binding 用现成 `handler` 类型 + `handlerSignature: { parameterTypes, returnType }`；`&处理器名` 源码写法、补全插入（bindingValueType.ts:44 `&$N`）、签名校验（languageService.ts:3825）**全部现成**，只接 binding。

### C2 回调生成

- C++ 形参约定：**必须 `std::function<...>`**（不支持裸函数指针——成员子程序需要捕获）。
- 调用点发射 lambda：Win32 后端 `[this](形参){ return this->处理器名(实参); }`（延迟调用 Win32 模板 33558 先例）；NE 后端无捕获 `[](形参){...}`（子程序是静态自由函数，3182 先例）。不需要 NE 查找表跳板——直接 lambda 更简单。
- 红线（文档 + 生成注释）：C++ 侧不得在回调外长期保存 std::function（lambda 捕获 `this`，窗口销毁后悬挂）；回调线程透传、不做封送——工作线程回调里禁止直接操作 UI 控件（同 threading 模块既有红线）；跨线程封送进 M3。

### C3 类句柄化（复用 DLL 结构体访问器模式）

- 声明语法：

```text
C++源码库 计数器库
  类 计数器 = Counter
    方法 计数器 创建(整数型 初始值)        // 生成 计数器_创建：new Counter(...) → 句柄
    方法 空 销毁()                          // 生成 计数器_销毁：delete
    方法 整数型 取当前() = get_value        // 生成 计数器_取当前(句柄)
  结束类
结束C++源码库
```

- 类内 `方法` 合成为全局命令：`类名_创建/类名_销毁/类名_方法名`，句柄 = 长整数型、首参名固定 `对象`；调用点经 binding 扩展字段 `cppClassName` 发 `((Counter*)对象)->get_value()`（复用结构体参数 `cppStructName` 的 `(T*)` 强转机制）。
- 虚拟模块 `contributes.types` 登记类名（`ModuleCommandValueType` 可扩展，词表现成）。
- 红线：单一构造、无重载；句柄是裸指针整数，复制句柄 = 共享对象；必须显式 `销毁`（文档红线 + 取值诊断提示不做自动回收）。

### C4 真机验收与同步

- smoke v2：同步进度回调（C++ 循环逐次调 std::function，断言 .lcpp 侧计数）+ 类生命周期（创建/调用/销毁，析构副作用断言）双平台。
- 规则手册、MCP_INSTRUCTIONS、docs、更新记录、测试钉子（≥10）全量同步；`dist/cli.cjs` 重建 + stdio 验收。

**M2 出口标准**：回调与类 demo 工程双平台编译运行全对；签名不匹配给中文诊断；`传函数、传参数` 的原始诉求可在纯 `.lcpp` 层完成。

## 5. M3 展望（2026-10-27 第三批落地四项：数组参数、附加包含目录、异常捕获模式、回调返回值；第四批（v4）又落地命名空间——库级 `命名空间 =` 行，转发函数方案零生成器改动。真机 smoke 双平台 PASS。剩余：结构体映射、命名空间/目录扫描导入、类类型化局部变量、跨线程回调封送、模板白名单——登记 FUTURE_OPTIMIZATIONS 不排期）

C++ 结构体 ↔ 项目数据类型映射；附加包含目录（`包含目录 =` 行）；异常捕获模式（库级开关：捕获 → 中文错误码命令）；命名空间/多文件目录扫描导入；类类型化局部变量（`局部 计数器 对象`）；跨线程回调自动封送（复用 PostMessage 事件窗口先例）；模板白名单。

## 6. 主要风险与对策

| 风险 | 对策 |
| --- | --- |
| 用户 C++ 定义与声明签名不匹配 → 编译错误难懂 | 无 .h 时发「期望签名」前置声明 + 头部中文注释，C2556/C2664 直接指向期望签名；示例与文档给标准写法 |
| GBK 源码乱码 | UTF-8 fatal 解码校验 → 中文阻断诊断 |
| 入口符号/全局名冲突链接惨案 | main/wWinMain/DllMain 静态扫描前置阻断；其余交给链接期 |
| 异常逸出 | 文档红线，M3 出捕获模式 |
| 文本/字节集 ABI 与生成调用不符 | W6 smoke 五类 ABI 实测钉死后再定稿类型表 |
| 声明文件被当程序码聚合 | W3 排除条件 + 回归钉子（防「事件全 stub」老雷复发） |
| 旧 `parseDllHeaderDeclarations` 参数解析不可达 | 不修旧函数（不动 DLL 编辑器行为），v1 新写解析器 |

## 7. 每期收尾固定同步清单

`LingBuilder AI 规则手册.md` → `MCP_INSTRUCTIONS` + `tests/aiBridge.test.ts` 断言 + 重建 `dist/cli.cjs` + stdio 握手 → docs 指南页 → `docs/FUTURE_OPTIMIZATIONS.md` → 当天 `更新记录/` → 项目记忆库（`.zcode/memory/<主题>.md` + `MEMORY.md` 索引行）。

## 8. 明确不做的事

- 不承诺「任意 C++ 文件直接调用」：完整 C++ 解析（模板/重载/STL/命名空间）是无底洞，本功能始终是**约束子集 + 明确诊断**。
- 不做 .lbmod 替代：要分发、要隐藏源码、要收费门禁的场景仍走模块路线。
- 不在本功能里改 DLL 命令声明管线（旧 `.h` 导入解析器缺陷不顺手修）。

## 9. v6 分期方案（2026-10-27 立项：结构体映射 / 跨线程封送 / 模板白名单收口；**同日批复后 S1/S2/S3 全部落地**，实测与设计的偏差见 §9.5）

v1~v5 收口后剩余三项能力。定案原则延续既有机型：**能进声明头的发射不进生成器**（v3 异常包装、v4 转发函数同范式），每个决策直接定死不分叉。

### 9.1 S1 = C++ 结构体映射（主体工作）

**核心定案：句柄化 + 声明头适配器，零生成器调用发射改动。**

- **语法**（库块内新增结构体块，字段行尾 `// 备注` 为字段备注）：

```text
C++源码库 几何库
  源码 = cpp/geometry.cpp
  结构体 点 = Point          ← 「= C++ 类型名」必填且 ASCII（用户 C++ 代码引用它）
    小数型 x // 横坐标
    小数型 y
    文本型 名称              ← 文本型字段 = std::wstring（无 DLL 定长约束，源码库独有优势）
  结束结构体
  小数型 两点距离(点 a, 点 b) = distance
  点 取中点(点 a, 点 b) = midpoint
结束C++源码库
```

- **定义归属**（与类块同规则，按库走）：库带「头文件 =」→ 结构体定义来自头文件，.lcpp 字段行只是访问器契约（头文件里静态扫描不到 `struct Point {` 定义形态给 warning）；无头文件库 → 生成头直接发 `struct Point { double x; double y; std::wstring 名称; };`（同编译器同工程，无布局/ABI 约束——这是与 DLL 结构体管线的本质区别，不需要 pack/定长/句柄跨界）。结构体**库内作用域**（与 DLL 结构体同范式），跨库使用给中文诊断。
- **字段类型白名单**：整数型/长整数型/小数型/单精度小数型/逻辑型/字节型/指针整数 + 文本型(std::wstring)。**v6.1 明确不支持**：嵌套结构体字段、数组字段、字节集字段（中文诊断；真实需求出现再立项，过渡=拆两个扁平结构体分两次调用）。
- **.lcpp 侧句柄语义**：结构体一律以句柄持有——`点_创建()`（零初始化 `new Point()`）/ `点_销毁(句柄)` / 每字段一对 `点_取X(句柄)` / `点_置X(句柄, 值)`（空句柄安全：取返回零值、置忽略，DLL 访问器同款）；结构体名登记 `contributes.types`（cppType=long long，v5 同款），`局部 点 句柄 = 0` 直接可用。句柄红线与类块一致：复制句柄=共享、必须显式 销毁。
- **命令参数/返回**：
  - 参数 `点 a` → binding `longLong`（描述注明句柄）；C++ 期望签名统一 **`const Point&`**（与字节集参数位 const& 同风格；C++ 侧写按值 `Point` 与声明是两个修饰名，不一致 LNK2019，期望签名注释写明）。调用点解引用由声明头适配器完成，生成器无感。
  - 返回 `点` → binding `longLong`；C++ 侧按值返回 `Point`；调用点**自动堆包裹为句柄**（`new Point(f(...))`），用完必须 销毁。
- **实现形态（声明头内完成全部发射，与 v3 包装/v4 转发同范式）**：

```cpp
struct Point { double x; double y; std::wstring 名称; };        // 无头文件库才发；有头文件库省略
double distance(const Point& p0, const Point& p1);              // 期望签名前置声明
Point midpoint(const Point& p0, const Point& p1);
inline double 两点距离(long long p0, long long p1) { return distance(*reinterpret_cast<Point*>(p0), *reinterpret_cast<Point*>(p1)); }
inline long long 取中点(long long p0, long long p1) { return reinterpret_cast<long long>(new Point(midpoint(*reinterpret_cast<Point*>(p0), *reinterpret_cast<Point*>(p1)))); }
inline long long 点_创建() { return reinterpret_cast<long long>(new Point()); }
inline void 点_销毁(long long lbHandle) { if (lbHandle) delete reinterpret_cast<Point*>(lbHandle); }
inline double 点_取x(long long h) { return h ? reinterpret_cast<Point*>(h)->x : 0.0; }
inline void 点_置x(long long h, double v) { if (h) reinterpret_cast<Point*>(h)->x = v; }
inline const wchar_t* 点_取名称(long long h) { return h ? reinterpret_cast<Point*>(h)->名称.c_str() : L""; }
inline void 点_置名称(long long h, const wchar_t* v) { if (h) reinterpret_cast<Point*>(h)->名称 = v ? v : L""; }
```

  适配器按中文命令名命名（与 v4 转发函数、DLL 访问器同一命名范式）；binding `runtimeName` 指向适配器。**lingCppWin32Project.ts 的调用发射零改动**（结构体参数就是 longLong 实参）。
- **组合定案**：异常捕获叠加 → 捕获包装体承担解引用+堆包裹（`try { return reinterpret_cast<long long>(new Point(f(*ptr))); } catch { ...; return 0; }`），不再另发适配器；命名空间叠加 → 适配器体做限定调用 `ns::distance(...)`；类块与结构体块并存，分工=有行为走类、纯数据走结构体。
- **多 TU 契约（新增文档红线）**：无头文件库用结构体时，用户 .cpp 必须 `#include` 生成的 CppSourceLibraries.h 拿结构体定义与期望签名（模块 targets 已注册 include 目录；W3 实测 /I 对用户 TU 的可达性，不可达则文档教相对路径引法）。头文件库用户 .cpp 照旧只含自己的头。
- **命名冲突**：结构体名进声明文件唯一名空间（命令/类/结构体互斥重名诊断）；访问器命令名（`点_创建` 等）同样进命令唯一名检查。
- **诊断族**：字段类型白名单、字段重名、结构体重名、`= C++ 类型名` 缺失/非 ASCII、跨库引用、命令参数/返回引用未声明结构体、头文件库缺 `struct X {` 定义 warning。
- **编辑器**：结构体块 UI（库头下结构体网格：结构体名 / C++ 名 / 字段子表），序列化 100% 往返；「从 .h 导入」检测到 struct 定义给中文提示「结构体请用 结构体 块手写声明」（防静默丢失），v6.1 不做自动解析。
- **manifest** 1.2.0 → 1.3.0。
- **工作包**：
  - W1 parser + 类型/诊断：`CPP_SOURCE_STRUCT_RE` / 字段行 RE / 模型 `LingCppCppSourceStruct(+Field)` / 序列化往返 / `resolveCppSourceType` 带结构体注册表的扩展 / 诊断族。
  - W2 虚拟模块：`buildCppStructAccessorItems`（访问器命令 + binding）/ 命令参数返回的句柄形状与适配器 runtimeName / contributes.types 登记。
  - W3 声明头生成：结构体定义段（顺序=include 之后、期望签名之前）/ 访问器与适配器 inline / `const Point&` 期望签名 / 捕获包装与命名空间限定 / `<string>` 条件包含 / 用户 TU include 可达性实测。
  - W4 编辑器结构体 UI + .h 导入提示。
  - W5 验收：测试钉子 ≥15；smoke v6 双平台（结构体创建/置字段/传参/结构体返回/取回字段/销毁全流程 + main.cpp 与声明头发射钉子断言）；示例工程「C++源码库演示」升级结构体场景。
  - W6 四层同步（规则手册节、MCP 第 31 条、aiBridge 断言、cli.cjs 重建+stdio、docs 页、FUTURE_OPTIMIZATIONS、更新记录、记忆库）。

### 9.2 S2 = 跨线程回调封送（显式声明，默认不封送）

- **语法**：处理器参数内联签名后加 `界面线程` 后缀——`处理器 进度回调(整数型 序号, 文本型 阶段) 界面线程`（可带 `回传` 的写法解析，但封送+回传给中文阻断：封送是异步 fire-and-forget，无法同步回传）。
- **语义定案**：
  1. **必须显式声明才封送**，未声明的回调维持线程透传（现状）；封送把同步调用变异步投递，是语义改变，不允许默认。
  2. 载荷 = 内联签名全部参数的**值拷贝快照**（投递时刻定格，之后改原变量不可见）；标量/文本型/字节集均可拷贝，无需额外限值表——实现为堆上 `std::function<void()>` 闭包经 `PostMessageW` 投递到 message-only 封送窗口，UI 线程执行后 delete（先例：NE HTTP 客户端事件窗口 lingCppWin32Project.ts 3258~3304）。
  3. 同一线程的多次投递保序（消息队列语义），跨线程不保序；处理器在 UI 线程执行，处理器内**不得阻塞**，投递方**不得等待**。
- **生成**：binding 参数扩展 `handlerMarshalUiThread: true`；`translateCppSourceCallArgument` 的 handler 分支按标记改发封送 lambda（Win32 `[this]` 捕获成员子程序、NE 无捕获调静态子程序）；生成端预扫描源码——只有存在封送处理器实参时才发射封送窗口运行时（`WM_APP+0x58`，实现前核对常量无冲突），窗口创建/清理两后端接线（Win32 窗口初始化段、NE 照 httpClient 样板）。
- **诊断**：封送+回传阻断；`&子程序` 签名强校验不变。
- **验收**：测试钉子 ≥8（解析往返/阻断诊断/binding/两后端发射形状/未用不发射负例）；smoke v6b 双平台——C++ 侧 `std::thread` 触发 N 次封送回调后 join，.lcpp 处理器全部在 UI 线程收到，运行日志断言计数与载荷；四层同步同 S1。

### 9.3 S3 = 模板白名单：砍掉（定案）

无真实需求样本（std::string_view/std::optional 均可让用户写一层薄包装函数绕过；真实模板函数本就没有固定符号可调）。动作＝纯文档收口：`docs/FUTURE_OPTIMIZATIONS.md` 注销该待办并写明口径（遇模板类类型签名维持中文诊断+建议薄包装，出现真实样本再立项）；规则手册 C++ 源码库节红线补一句同口径；MCP 第 31 条已有「模板不支持」无需改。无代码改动。

### 9.4 期次顺序与基线纪律

S1 → S2 → S3（S2 的封送载荷类型解析复用 S1 扩展后的类型表）。每期出口＝测试钉子全绿（`test:lingcpp`）+ smoke 双平台 PASS + 四层同步完成；回归甄别一律 stash 对照（lingcpp 10 红 / aiBridge 7 红为既有基线，不当回归修）。

### 9.5 落地实录（2026-10-27 同日，S1+S2+S3 全部完成）

- **S1 结构体映射**：按 9.1 全量落地，实现与设计一致（声明头适配器范式、零生成器调用发射改动）。落地新增三个设计细化：① 头文件库缺 struct 定义的静态扫描放物化期（notes 提示，非阻断——定义可能经其它头引入，假阳阻断会误伤），生成头注释自说明；② 命令适配器与访问器同样遵守「跨库重名不拒收解析、诊断定向提示」口径，访问器命令名与显式命令声明冲突有专项诊断；③ 期望签名的结构体参数注释直接写 `const Point&`（适配器才是收句柄的一方）。实测：测试钉子 31/31（其中 v6 新增 7 条）、smoke 双平台 PASS（无头文件库模式，用户 .cpp `#include "CppSourceLibraries.h"` 经模块 /I 命中——W3 验证项实锤成立，obj 指纹天然覆盖声明头变化）、示例工程头文件库模式双平台构建 PASS。**踩坑**：① 示例工程 cpp/ 目录原放项目根，而物化按 `<源码根>/cpp/` 解析——v1 示例就带病，本期移正；② 文本型返回的期望签名是 `const wchar_t*`，用户侧写 std::wstring 返回是另一个修饰名（C2556 实抓），smoke 已按正确写法并加注释。
- **S2 跨线程封送**：按 9.2 落地。实现细化：① 封送运行时为两后端共享文本（message-only 窗口 + 堆闭包 PostMessage，WM_APP+0x60 经全表核对空闲），闭包自带 this 捕获、WndProc 无需知道用户类型；② 仅源码真实调用封送回调才发射运行时（按 binding 的 handlerMarshalUiThread 参数扫源码命令调用，负例断言钉住）；③ 创建在界面线程启动序列（Win32 wWinMain LoadLibraryW 后 / NE 延迟调用宿主创建后），退出时销毁对齐 httpClient 先例。实测：smoke 双平台 PASS——`std::thread` 工作线程触发 6 次回调、join 后 .lcpp 侧经 `延迟调用(800, &封送校验)` 等消息泵排空已入队的 6 条封送消息再断言（exit 0~19 全过）。**踩坑**：封送消息在 创建完毕 内投递、消息循环未启动，校验必须挪进 WM_TIMER 处理器（posted 消息优先于 WM_TIMER 派发，时序确定）。
- **S3 模板白名单**：按 9.3 砍掉落地（FUTURE_OPTIMIZATIONS 注销 + 规则手册红线补口径 + MCP 第 31 条既有「模板不支持」保留）。
- **回归**：lingcpp 235 过/10 失败、aiBridge 66 过/7 失败，与既有基线逐一相同（零新增红）；dist/cli.cjs 重建 + stdio 握手 PASS（v6/v6.2 关键词全命中）；规则手册/MCP/docs 页/更新记录/记忆库五层同步完成。
