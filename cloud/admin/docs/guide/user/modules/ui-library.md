---
title: 做自己的界面库
---

# 做自己的界面库（命令型模块）

> [🕒 预计 30 分钟] | 难度：进阶

想把一套控件能力做成 LingBuilder 界面库给别人用？**命令型界面库**是一条已经完全打通的路：以模块（`.lbmod`）形式贡献一组中文命令，用户的中文代码调用这些命令，在运行期于真实 Win32 窗口上创建按钮、输入框、面板等控件并操作它们——控件不进窗口设计器画布，靠句柄管理。你可以让已接入 AI Bridge 的外部 AI（灵码、Claude Code、Codex CLI 等）通过 MCP 工具端到端把模块做出来、校验、打包并安装，全程不需要自己写构建脚本。

典型用途：封装你已有的 C++/Win32 界面库 DLL、做一套自绘控件、提供易语言风格的控件命令族。它在 LingBuilder 里就是一个普通的 v2 模块，安装、启用、补全、**F5** 编译链接全部走既有模块机制，没有任何特殊通道。

> [!NOTE]
> 命令型界面库与 [new_emoji 原生界面库模块](/guide/user/modules/new-emoji) 的区别：new_emoji 的控件在设计器画布拖放、所见即所得，那是官方内置后端；第三方模块贡献画布级设计器控件的能力暂未开放。命令型界面库的控件只在运行后的 exe 里出现，但创建、销毁、属性、状态全部由你的命令族说了算。

## 1. 命令面怎么设计

一套好用的界面库命令面通常分四族：

1. **创建族**：`XX_创建按钮(父窗口句柄, x, y, 宽, 高, 文本) → 长整数型`，返回控件句柄，失败返回 0。
2. **属性族**：`XX_设置文本(控件句柄, 文本) → 逻辑型`、`XX_取文本(控件句柄) → 文本型`。
3. **生命周期族**：`XX_销毁控件(控件句柄) → 逻辑型`；在文档里说明"窗口销毁时是否自动回收"。
4. **事件/状态族**：见下文第 2 节——这是最重要的设计决策。

### 1.1 窗口句柄从哪来

用户的窗口是真实 Win32 窗口，标准项目启用 `lingbuilder.win32.basic` 模块后即可拿到句柄：

- `窗口_取自身句柄()` —— 当前窗口的句柄（长整数型），界面库示例统一用它；
- `窗口_按标题查找(标题)` —— 按标题找任意顶层窗口。

你的创建族命令第一个参数收这个句柄，内部直接 `CreateWindowExW` 创建子控件。

### 1.2 事件：当前三条路

| 方式 | 机制 | 适用 |
| --- | --- | --- |
| **轮询族（推荐，最通用）** | 库提供 `XX_取事件(控件句柄或0)`、`XX_取点击次数(控件句柄)` 之类命令，用户在窗口的**时钟事件**里轮询 | 所有控件事件：点击、双击、回车、选择变化 |
| **延迟调用** | binding 声明 `invocation: { kind: "delayedCall" }`，生成器把命令展开为主线程一次性回调（`延迟毫秒, &处理器` 形态） | "N 毫秒后执行"语义 |
| **受管任务** | binding 声明 `invocation: { kind: "managedTask" }`，生成器展开为受管线程 + 主线程完成处理器（`&工作处理器, …, &完成处理器` 形态） | 耗时工作（加载、渲染、批量操作） |

> [!WARNING]
> `handler` 类型参数在清单里合法、编辑器会按签名校验 `&处理器名`，但"按处理器名任意派发"的运行期通道目前只对内置异步能力（网页 / HTTP / WebSocket / CDP / 定时任务）逐个生成。第三方模块**不要**声明"注册回调"式命令并期望它被回调——先做轮询族，回调式等通用第三方事件派发落地后再加。

### 1.3 命名规范

- 命令名全局唯一。官方模块已占用 `控件_`、`窗口_`、`表格_`、`文本_`、`字节集_` 等大量前缀，请用自己的品牌前缀（如 `青界_创建按钮`），避免撞名导致校验或安装失败。
- 模块 ID 用小写字母、数字、点、横线、下划线（3~80 位），建议 `作者名.界面库名`，不要用 `lingbuilder.` 前缀（官方保留习惯）。
- 每条命令的 `description` 必须写清「何时用 + 失败时返回什么 + 红线」——外部 AI 和用户都靠它选命令。

## 2. 两种实现形态

**纯源码模块（推荐起步）**：`src/*.cpp` + `include/*.h` 随模块分发，F5 时与用户代码一起编译进 exe。不需要分发二进制，审阅友好。

**封装已有 C++ 界面库 DLL**：你已经有编译好的 `myui.lib` / `myui.dll` 时，在清单 `targets` 里声明（不同架构各给一份路径，不能共用）：

```json
"targets": [
  { "id": "windows-msvc-win32", "platform": "windows", "arch": "win32", "toolchain": "msvc",
    "includeDirs": ["include"], "headers": ["include/myui.h"],
    "libs": ["lib/win32/myui.lib"], "runtimeFiles": ["bin/win32/myui.dll"] },
  { "id": "windows-msvc-x64", "platform": "windows", "arch": "x64", "toolchain": "msvc",
    "includeDirs": ["include"], "headers": ["include/myui.h"],
    "libs": ["lib/x64/myui.lib"], "runtimeFiles": ["bin/x64/myui.dll"] }
]
```

构建时 IDE 自动链接 `.lib` 并把 `runtimeFiles` 拷到 exe 旁边。

## 3. manifest 最小骨架

下面是一个可用的极简界面库清单（`lingbuilder.module.json`），已按现行校验规则同形：`contributes.commands` 只写签名与中文返回类型；**参数明细只写在 `bindings.commands[].parameters`，类型用 ABI 名**（`longLong`/`int`/`wideString`…，中文类型名在 binding 校验里不通过）：

```json
{
  "schemaVersion": 2,
  "id": "zq.simpleui",
  "name": "青界简单界面库",
  "version": "1.0.0",
  "category": "界面",
  "description": "用纯 Win32 命令在用户窗口上创建按钮与标签的极简界面库。",
  "author": "青界",
  "contributes": {
    "commands": [
      {
        "name": "青界_创建按钮",
        "signature": "青界_创建按钮(父窗口句柄, x, y, 宽, 高, 文本)",
        "description": "在指定窗口上创建一个标准按钮，返回按钮句柄；失败返回 0。句柄用完应调用 青界_销毁控件，窗口关闭时按钮随窗口自动销毁。",
        "insertText": "青界_创建按钮(${1:父窗口句柄}, ${2:10}, ${3:10}, ${4:120}, ${5:32}, \"${6:按钮}\")",
        "returnType": "长整数型",
        "returnDescription": "成功返回按钮句柄（非 0）；失败返回 0。"
      }
    ],
    "docs": [{ "title": "使用说明", "path": "README.md" }],
    "examples": [{ "title": "创建按钮示例", "path": "examples/创建按钮.lcpp" }]
  },
  "targets": [
    { "id": "windows-msvc-win32", "platform": "windows", "arch": "win32", "toolchain": "msvc",
      "includeDirs": ["include"], "headers": ["include/simpleui.h"], "sources": ["src/simpleui.cpp"] },
    { "id": "windows-msvc-x64", "platform": "windows", "arch": "x64", "toolchain": "msvc",
      "includeDirs": ["include"], "headers": ["include/simpleui.h"], "sources": ["src/simpleui.cpp"] }
  ],
  "bindings": {
    "commands": [
      {
        "command": "青界_创建按钮",
        "runtimeName": "青界_创建按钮",
        "parameters": [
          { "name": "父窗口句柄", "type": "longLong", "description": "宿主窗口 HWND。" },
          { "name": "x", "type": "int", "description": "横坐标。" },
          { "name": "y", "type": "int", "description": "纵坐标。" },
          { "name": "宽", "type": "int", "description": "宽度。" },
          { "name": "高", "type": "int", "description": "高度。" },
          { "name": "文本", "type": "wideString", "description": "按钮文字。" }
        ],
        "returnType": "longLong",
        "encoding": "wide",
        "example": "青界_创建按钮(窗口_取自身句柄(), 10, 10, 120, 32, \"点我\")"
      }
    ]
  }
}
```

C++ 侧对应实现（生成器把中文调用直接翻译为 `runtimeName(参数…)`）：

```cpp
// src/simpleui.cpp
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <string>

long long 青界_创建按钮(long long parentHwnd, int x, int y, int w, int h, const std::wstring& text) {
    HWND parent = (HWND)parentHwnd;
    if (!parent || !IsWindow(parent)) return 0;
    HWND button = CreateWindowExW(0, L"BUTTON", text.c_str(),
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        x, y, w, h, parent, nullptr, (HINSTANCE)GetWindowLongPtrW(parent, GWLP_HINSTANCE), nullptr);
    return button ? (long long)(intptr_t)button : 0;
}
```

用户代码长这样：

```text
按钮句柄 = 青界_创建按钮(窗口_取自身句柄(), 10, 10, 120, 32, "点我")
```

## 4. 让外部 AI 用 MCP 端到端做出来

前提：LingBuilder 已启动（AI Bridge 随 IDE 自动拉起），外部 AI 客户端已按 [AI Bridge 连接中心](/guide/ai/bridge-config) 的通用 MCP 配置接入。之后让 AI 按下面六步走（工具清单见 [MCP 接口](/guide/ai/mcp)，路径边界全部由 Bridge 强制）：

1. **自省工作区**：`lingbuilder.workspace.list`——确认工作区根与目标项目。
2. **生成骨架**：`lingbuilder.module.scaffold`，传 `id`、`name`、`category: "界面"`、中文 `description`，在 `.lingbuilder/module-build/<模块ID>/` 下生成模板。
3. **写全部文件**：`lingbuilder.module.writeFiles`，`files[]` 必须含根目录 `lingbuilder.module.json` + 源码/头文件/`README.md`/`examples/*.lcpp`；每文件 ≤1MB、总数 ≤200，内容是完整文本。
4. **校验**：`lingbuilder.module.validate` 传模块目录；按中文诊断修到 0 问题（命令必须有 binding、文档与示例必须真实存在且非空）。
5. **打包**：`lingbuilder.module.pack` 产出 `.lingbuilder/module-packages/<目录名>.lbmod`。
6. **预览并安装**：`lingbuilder.module.installPreview` 拿 `previewId`，再 `lingbuilder.module.install` 安装并启用到项目（`preview` 权限模式需显式 `approved=true`）。

**给用户的提示词模板**（粘给已接入 MCP 的 AI 即可）：

```text
请用 LingBuilder 的 MCP 工具为我做一个命令型界面库模块：
1. 先 lingbuilder.workspace.list 确认工作区；
2. lingbuilder.module.scaffold 建骨架，模块 ID 叫 <你的ID>，分类"界面"；
3. lingbuilder.module.writeFiles 写入完整 manifest（含 contributes.commands + bindings 成对）、
   C++ 源码、README.md 和 examples/*.lcpp——命令前缀统一用 <你的前缀>_；
4. lingbuilder.module.validate 修到零诊断；
5. lingbuilder.module.pack 打包，lingbuilder.module.installPreview 预览后 lingbuilder.module.install
   安装并启用（preview 模式记得 approved=true）；
6. 写一个示例 .lcpp 调用 <你的前缀>_创建按钮 并 build.run 真机验证。
界面库需求：<在这里描述你要的控件与命令>
```

没有 MCP 通道时：在 IDE「模块 → AI 生成模块」点 **复制 AI 开发规范**，把全文粘贴给任意网页 AI，再把回复粘回「导入 AI 生成的文件」，后续校验、打包、安装全在 IDE 内点按钮完成（详见[用 AI 生成模块](/guide/user/modules/ai-module-dev)）。完整的字段与 ABI 契约以《AI 模块开发规范》全文为准，界面库模块同样全部适用。

## 5. 门禁与红线清单（校验必过）

- `contributes.commands[].name` 与 `bindings.commands[].command` **一一成对**：只有 contributes 没有 binding 的命令无法生成 C++ 调用。
- binding 每个参数必须写 `description`；`encoding` 固定用 `"wide"`；`runtimeName` 可直接用中文标识符（MSVC 支持）。
- 参数类型边界：设计器画布里的控件用 `controlRef`（源码裸名不带引号）；**你运行期创建的控件不是设计器控件，用 `handle`/`longLong` 句柄参数**，误标 `controlRef` 会被控件引用门禁按"控件不存在"阻断。
- 至少一份非空中文 `README.md` 或 `docs/*.md` 并登记进 `contributes.docs[]`；至少一个 `examples/*.lcpp` 并登记进 `contributes.examples[]`。
- 所有路径包内相对、正斜杠；文本一律 UTF-8（无 BOM）。
- 纯源码模块不要 `LoadLibrary`、裸线程池；系统库用 `#pragma comment(lib, "xxx.lib")`，不算 `libs`。
- 字符串以宽字符为边界；异步能力做"启动返回编号 + 按编号读取"组合，不要把回调指针长期存在 DLL 里。

## 6. 分发与升级

- `.lbmod` 就是一个包文件，直接发给其他用户，对方用「模块 → 安装 .lbmod」导入（桌面版支持本机绝对路径与拖入，详见[安装与管理模块](/guide/user/modules/install-module)）。
- 升级 = 用户重装一次新版本 `.lbmod`，全项目生效，无需改代码。
- 模块详情页展示 `contributes.docs[]` 的文档与示例；想让外部 AI 用得好，把红线写进命令 `description` 和 README——外部 AI 查询模块接口时会原样拿到它们。

## 相关页面

| 页面 | 说明 |
|---|---|
| [用 AI 生成模块](/guide/user/modules/ai-module-dev) | 两条生成入口与导入校验细节 |
| [安装与管理模块](/guide/user/modules/install-module) | 启用、禁用、升级、卸载 |
| [AI Bridge 连接中心](/guide/ai/bridge-config) | 外部 AI 接入配置 |
| [MCP 接口](/guide/ai/mcp) | 23 个受控 MCP 工具清单 |
| [new_emoji 原生界面库模块](/guide/user/modules/new-emoji) | 画布级设计器控件的官方参考实现 |
