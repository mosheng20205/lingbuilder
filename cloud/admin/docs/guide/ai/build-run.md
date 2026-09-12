---
title: AI 构建与运行
---

# AI 构建与运行

> [🕒 预计 15 分钟] | 难度：进阶 | 关联功能：AI Bridge、MCP 工具、原生构建

LingBuilder 的 AI 不只能读代码、改代码，还能**把中文项目真正编译成 Windows 可执行文件并运行起来**。通过 AI Bridge 的受控构建工具，外部 AI（Claude Code、Codex CLI、Gemini CLI 等）可以独立完成「新建项目 → 编写代码 → 编译 → 运行验证」的完整闭环。本文说明这条链路的能力边界、前提条件与调用流程。

## 1. AI 的编译与运行能力

| 能力 | 工具 | 说明 |
|---|---|---|
| 编译项目 | `lingbuilder.build.run` | 把设计器模型与 `.lcpp` 源码确定性翻译为真实 C++/Win32 工程，调用本机编译器生成 exe |
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

1. **创建项目**：`lingbuilder.project.create` 选择模板（`blank-window` / `hello-window` / `new-emoji-fbro-browser-shell` / `windows-dll`）并传 `approved=true`。返回的 `result.designerProject` 是后续构建的必要入参。
2. **编写/修改代码**：用 `lingbuilder.edit.propose` + `lingbuilder.edit.apply` 提交**完整文件草稿**修改 `.lcpp` 源码与设计器模型；也可以在构建时直接携带 `lingCppSources`。
3. **编译前自检**：`lingbuilder.lingcpp.diagnostics` 返回中文诊断（语法、控件引用、事件绑定等），把错误拦在编译之前。
4. **编译**：`lingbuilder.build.run` 传入完整设计器模型。Bridge 依次完成：生成 C++ 源码 → 探测本机编译器（PATH 中的 `cl` 无法区分位数时自动经 vcvars 重新进入对应架构环境）→ 真实编译。失败时返回 `stage: "compile"` 与编译器原样日志。
5. **运行**：同一次调用传 `run: true`，编译成功后立即启动 exe 并返回运行文件路径。进程完全受管：不会残留后台进程，重复构建同一项目会先回收上一次的运行。

> [!NOTE]
> `build.run` 的 `project` 参数必须是 `project.create` 返回的**完整设计器模型**，不能只传项目 ID，也不能传解决方案元数据。

### 运行期错误的可见边界

编译错误、链接错误与启动失败都会在 `build.run` 的返回值中直接暴露（`stage: "compile"` / `"run-start"`，附编译器原样日志），AI 能读到并自动修复。但有一条边界需要知道：

- `build.run`（`run: true`）在 **exe 启动成功后立即返回**，不会等待进程退出；
- MCP 工具目前没有「等待退出 / 取退出码 / 读取 exe 控制台输出」的工具，因此程序**运行起来之后**才出现的崩溃或行为异常，走 MCP 的 AI 当场感知不到；
- 下一轮 `build.run` 会附带一条上一轮运行的遗留摘要，但它不是完整运行日志。

需要确认「程序是否在稳定运行」时，改用 CLI 通道等待进程退出：

```bash
# 构建并运行，阻塞等待进程退出，退出结果合并进 JSON 返回；Ctrl+C 触发受控停止
lingbuilder project run --request build-request.json --yes
# 受控停止当前运行中的 exe，不残留后台进程
lingbuilder project stop --request build-request.json
```

「启动 3 秒后仍在运行」这类存活验收，也可以用 `tasklist` 等系统手段轮询进程是否存在。

## 4. 构建产物与导出

- exe 与中间产物位于工作区 `.lingbuilder-build/<项目>/<平台>/<配置>/`，生成的 C++ 源码位于 `generated/cpp/<项目>/`；两者都支持在项目「构建目录」设置中自定义。
- 启用了外部 C++ 模块的项目，构建时会自动复制模块源码、头文件、`.lib` 与运行时 DLL（DLL 复制到 exe 同目录）。
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
