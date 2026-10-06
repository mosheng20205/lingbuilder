---
title: AI 构建与运行
---

# AI 构建与运行

> [🕒 预计 15 分钟] | 难度：进阶 | 关联功能：AI Bridge、MCP 工具、原生构建

LingBuilder 的 AI 不只能读代码、改代码，还能**把中文项目真正编译成 Windows 可执行文件并运行起来**。通过 AI Bridge 的受控构建工具，外部 AI（Claude Code、Codex CLI、Gemini CLI 等）可以独立完成「新建项目 → 编写代码 → 编译 → 运行验证」的完整闭环。本文说明这条链路的能力边界、前提条件与调用流程。

## 1. AI 的编译与运行能力

| 能力 | 工具 | 说明 |
|---|---|---|
| 编译项目 | `lingbuilder.build.run` | 把设计器模型与 `.lcpp` 源码确定性翻译为真实 C++/Win32 工程，调用本机编译器生成 exe（DLL 项目生成 `.dll` 与导入库 `.lib`） |
| 运行程序 | `lingbuilder.build.run`（`run: true`） | 编译成功后启动生成的 exe；进程由 LingBuilder 受管，同一项目重跑会先回收旧进程，Bridge 退出时一并停止 |
| 预览生成代码 | `lingbuilder.native.preview` | 只生成 C++ 与工程文件到受控临时目录，不编译、不写导出目录 |
| 导出 VS 工程 | `lingbuilder.native.export` | 生成可在 Visual Studio 中打开、编译的 `.sln` / `.vcxproj` 工程 |

三条关键保证：

- **与 IDE 行为一致**：AI 构建复用 IDE `F5` 同一条受控生成、编译、运行链路；IDE 里能跑的，AI 构建出来的一样跑，不存在「只在 IDE 内模拟运行结果」的隐藏逻辑。
- **确定性翻译**：中文源码到 C++ 由本地规则确定性完成，不经过大模型改写；AI 负责组织源码与设计器模型、发起构建、阅读结果并修复错误。
- **受控执行**：AI 不能执行任意命令。构建与运行只能走 LingBuilder 暴露的固定工具，受权限模式约束并写入审计日志。

## 2. 前提条件

| 条件 | 说明 |
|---|---|
| C++ 编译器 | 本机需安装 **Visual Studio Build Tools**（推荐）或 MinGW g++ / LLVM clang++；未检测到时构建工具返回明确中文诊断。部分官方模块（如浏览器 FBro、new_emoji）依赖 MSVC 链接 `.lib`，必须使用 MSVC |
| AI Bridge 已启动 | IDE 内：**帮助 > AI Bridge 连接中心**；命令行：`lingbuilder ai-server --workspace .` |
| 权限模式 | **readonly** 下构建/运行完全不可用；**preview**（默认）需在调用中显式传 `approved=true`；**yolo** 直接放行受控构建工具 |

## 3. 完整流程：从新建项目到运行 exe

外部 AI 按以下顺序调用 MCP 工具，每一步都真实落盘、真实编译，不是模拟输出：

```text
project.templates → project.create（approved=true）→ edit.propose/apply → lingcpp.diagnostics → build.run（run=true）
```

1. **创建项目**：`lingbuilder.project.create` 选择模板（`blank-window` / `hello-window` / `new-emoji-fbro-browser-shell` / `windows-dll`）并传 `approved=true`；窗口模板也可传 `outputType: "dll"` 转为 DLL 导出项目。记下返回的项目 ID，后续构建直接传 `projectId` 即可。
2. **编写/修改代码**：用 `lingbuilder.edit.propose` + `lingbuilder.edit.apply` 提交文件草稿（整文件 / 按行数组 / 行级增量三种形态）修改 `.lcpp` 源码与设计器模型；也可以在构建时直接携带 `lingCppSources`。
3. **编译前自检**：`lingbuilder.lingcpp.diagnostics` 返回中文诊断（语法、控件引用、事件绑定等），把错误拦在编译之前。
4. **编译**：`lingbuilder.build.run` 推荐只传 `projectId`（服务端直接读取磁盘上已注册的项目模型），也可传完整设计器模型。Bridge 依次完成：生成 C++ 源码 → 探测本机编译器（PATH 中的 `cl` 无法区分位数时自动经 vcvars 重新进入对应架构环境）→ 真实编译。失败时返回 `stage: "compile"` 与编译器原样日志。
5. **运行**：同一次调用传 `run: true`，编译成功后立即启动 exe 并返回运行文件路径。进程完全受管：不会残留后台进程，重复构建同一项目会先回收上一次的运行。

> [!NOTE]
> `build.run` / `native.preview` / `native.export` 的项目入参支持 **`project`（完整设计器模型）与 `projectId` 二选一**，推荐只传 `projectId`（服务端读取磁盘上已注册的项目模型），避免在上下文里搬运完整模型。

### 运行期错误的可见边界

编译错误、链接错误与启动失败都会在 `build.run` 的返回值中直接暴露（`stage: "compile"` / `"run-start"`，附编译器原样日志），AI 能读到并自动修复。exe 启动成功后 `build.run` 立即返回，运行期通过两个专用工具观察：

- `lingbuilder.run.wait`：阻塞等待进程退出并返回退出码，可带超时（默认 30 秒、上限 600 秒）；超时时返回「仍在运行」的当前状态。
- `lingbuilder.run.log`：读取最近一次受控运行的输出（stdout/stderr），进程退出后仍可读。

需要「构建、运行、等退出」在同一次调用里完成时，改用 CLI 通道：

```bash
# 构建并运行，阻塞等待进程退出，退出结果合并进 JSON 返回；Ctrl+C 触发受控停止
lingbuilder project run --request build-request.json --yes
# 受控停止当前运行中的 exe，不残留后台进程
lingbuilder project stop --request build-request.json
```

「启动 3 秒后仍在运行」这类存活验收，也可以用 `tasklist` 等系统手段轮询进程是否存在。

## 4. 构建产物与导出

- exe 与中间产物位于工作区 `.lingbuilder-build/<项目>/<平台>/<配置>/`，生成的 C++ 源码位于 `generated/cpp/<项目>/`；两者都支持在项目「构建目录」设置中自定义。
- **DLL 项目**（`windows-dll` 模板或 `outputType: "dll"`）的产物是 `.dll` 与导入库 `.lib`，位于同一构建目录。DLL 项目没有 exe：不要传 `run: true`，`run.wait` / `run.log` 不适用；验证靠构建结果与产物路径，实际调用由外部程序完成（见 [DLL 命令与模块](/guide/user/modules/dll-module)）。
- 启用了外部 C++ 模块的项目，构建时会自动复制模块源码、头文件、`.lib` 与运行时 DLL（DLL 复制到 exe 同目录）。外部 AI 封装完模块后，就用这个机制做编译验收：创建一个启用该模块的测试项目并 `build.run`，模块源码编不过会直接暴露在构建日志里。
- 需要脱离 AI、在 Visual Studio 中继续开发时，用 `lingbuilder.native.export` 导出完整 VS 工程；只想查看生成的 C++ 代码时，用 `lingbuilder.native.preview`，它不会写入导出目录。

## 5. 常见问题

### 提示「未检测到可用 C++ 编译器」

安装 Visual Studio Build Tools 的 C++ 工作负载后重试；浏览器、new_emoji 等依赖 `.lib` 链接的模块必须使用 MSVC，仅装 g++/clang++ 时这类项目会给出阻断诊断。

### 返回 `stage: "busy"`

同一项目同时只允许一个构建/运行任务（项目租约）。等上一次构建结束，或先停止旧运行再发起。

### 编译成功但启动失败

返回 `stage: "run-start"` 与失败原因，不会报告假成功；AI 可根据日志修正代码后重新构建运行。

### 调用被权限拒绝

readonly 模式禁止一切写入、构建与运行；preview 模式忘记传 `approved=true` 时写操作只会返回预览。切换方式见 [AI Bridge 连接配置](/guide/ai/bridge-config)。

## 下一步

- 全部工具清单与连接方式：[MCP 工具协议](/guide/ai/mcp)
- 权限模式与模型服务配置：[AI Bridge 连接配置](/guide/ai/bridge-config)
- 让外部 AI 直接改代码：[AI 对话式改代码](/guide/ai/chat)
