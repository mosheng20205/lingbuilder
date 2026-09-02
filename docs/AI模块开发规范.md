# LingBuilder 模块 AI 开发规范

本文档是写给 AI 看的模块开发规范。用户会把它完整交给任意 AI 助手（网页版或客户端均可，不需要安装任何工具），再附上一段自然语言需求；AI 按本文档生成一组模块文件，用户把文件保存到 LingBuilder 工作区后即可在 IDE 内校验、打包、安装并使用。

**给用户的使用方法（人类请先读这里）：**

1. 在 LingBuilder 的“模块 → AI 生成模块”点击“复制 AI 开发规范”，把全文粘贴给任意 AI；也可以直接把本文档文件上传给支持文件上传的 AI。
2. 在同一对话里用中文描述你想要的模块，例如：“帮我做一个模块，提供 Base64 编码和解码两个命令。”
3. 把 AI 的回复完整复制，回到 LingBuilder 的“模块 → AI 生成模块”，粘贴到“导入 AI 生成的文件”输入框，点击“导入到 module-build”——IDE 会自动解析文件、写入 `.lingbuilder/module-build/<模块ID>/` 并立即校验。（也可以手动在文件管理器中把每个文件按路径保存到该目录。）
4. 导入成功后，“校验模块”和“模块包制作”的路径会自动填好：在“模块包制作”点击导出生成 `.lbmod`，再在“安装 .lbmod”中预览确认安装。
5. 安装后在“本地模块”中启用该模块，它的中文命令就会出现在代码补全中，F5 运行时会编译并链接真实 C++ 实现。

---

## 1. AI 角色与任务

你是 LingBuilder 中文 IDE 的模块开发者。LingBuilder 把中文源码（`.lcpp`）确定性翻译为真实 C++/Win32 工程再编译运行；模块（Module）是为这套体系扩展命令、类型和设计器控件的分发单元。

你的任务：根据用户需求，产出一个**完整、可校验、可编译**的模块目录。所有文件都是纯文本，用户只会做"保存文件 + 在 IDE 里点按钮"两件事，不会修改代码——因此你输出的内容必须一步到位。

## 2. 模块能力边界

一个模块可以贡献：

- **中文命令**：用户在 `.lcpp` 里像调用函数一样使用，例如 `文本_统计字符数("你好")`，由你提供的 C++ 桥接函数真实执行。
- **公开类型**：record / array 值语义类型，进入补全和诊断。
- **设计器控件**：拖放到窗口设计器的可视控件（进阶能力，见第 8 节）。
- **中文文档与示例**：随模块分发，在 IDE 模块详情中打开。

## 3. 输出契约（必须严格遵守）

1. 以文件为单位输出，每个文件前使用固定标题格式 `### 文件：<相对路径>`，标题后紧跟一个围栏代码块（``` 包裹）作为文件完整内容；用户会把你的回复原文粘贴回 LingBuilder 自动导入，因此必须严格使用该格式，不要把多个文件合并进一个代码块。
2. 根目录必须包含 `lingbuilder.module.json`（模块清单，JSON，UTF-8 无 BOM）。
3. 清单中声明的 `docs`、`examples`、`headers`、`sources`、`include` 目录里的每个文件都必须真实输出，不能只声明不提供。
4. 至少提供一份非空中文 Markdown 文档（`README.md` 或 `docs/*.md`），并在 `contributes.docs[]` 登记。
5. 至少提供一个 `examples/*.lcpp` 中文示例并在 `contributes.examples[]` 登记。
6. 除非用户明确提供了 `.lib` / `.dll` 文件，否则只生成纯 C++ 源码模块（`src/*.cpp` + `include/*.h`），不声明 `libs` 和 `runtimeFiles`。
7. 所有路径都是包内相对路径（正斜杠分隔），禁止绝对路径、盘符、空段和 `..`。
8. 所有文本文件使用 UTF-8（无 BOM）编码，换行符不限。

标准输出格式示例：

````text
### 文件：lingbuilder.module.json
```json
{ "schemaVersion": 2, ... }
```

### 文件：include/text_tools_bridge.h
```cpp
#pragma once
...
```
````

## 4. 目录结构

```text
<模块ID>/
  lingbuilder.module.json     # 模块清单（必需）
  README.md                   # 中文说明（必需）
  docs/                       # 详细中文文档
  examples/                   # .lcpp 示例
  include/                    # C++ 头文件
  src/                        # C++ 源文件
```

## 5. lingbuilder.module.json 规范（schemaVersion 2）

### 5.1 顶层必填字段

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `schemaVersion` | number | 必须为 `2` |
| `id` | string | 小写字母、数字、点、横线、下划线，长度 3–80，例如 `ai.text.tools` |
| `name` | string | 模块中文名，非空 |
| `version` | string | 例如 `1.0.0` |
| `category` | string | 只能是：`界面`、`系统`、`网络`、`数据库`、`图像`、`AI`、`构建`、`其他` |
| `description` | string | 中文一句话说明，非空 |

可选字段：`displayName`、`author`、`license`、`tags[]`、`minLingBuilderVersion`、`dependencies[]`。

### 5.2 contributes.commands（中文补全与提示）

```json
{
  "name": "文本_统计字符数",
  "signature": "文本_统计字符数(文本)",
  "description": "统计文本中的字符数量。",
  "insertText": "文本_统计字符数(\"${1:文本}\")",
  "returnType": "整数型",
  "returnDescription": "返回文本的字符数量；空文本返回 0。"
}
```

规则：

- `name` 是用户调用的中文命令名，建议使用 `分类_动作` 或动宾结构，全局不能与其他模块重复。
- `signature` 与命令名一致并按顺序列出参数名。
- `insertText` 是 Monaco 补全片段：零参数写 `命令()`；有参数按顺序使用 `${1:参数名}`、`${2:参数名}` ……（简单形式 `$1`、`$2` 也可）。
- 文本参数在 `insertText` 中带双引号；控件参数（controlRef）**绝不带引号**；处理器参数写成 `&${N:处理器名}`。
- `returnType` 使用中文类型名：`整数型`、`长整数型`、`小数型`、`逻辑型`、`文本型`、`空`。
- 有返回值的命令必须同时填写 `returnDescription`，说明数值语义与成功/失败约定。

### 5.3 contributes.types / docs / examples

```json
"types": [
  { "name": "统计结果", "kind": "record", "description": "一次统计的结果。",
    "fields": [
      { "name": "字符数", "type": "整数型", "initialValue": "0", "description": "字符数量。" },
      { "name": "标签", "type": "文本型", "isArray": true, "description": "附加标签。" }
    ] },
  { "name": "统计结果列表", "kind": "array", "elementType": "统计结果", "description": "结果数组。" }
]
```

- `kind`：`opaque`（兼容旧模块）、`record`（必须声明 `fields`）、`array`（必须声明 `elementType`）。
- 字段类型只能是安全基础类型或本模块公开的其它 record/array 类型；数组字段只能默认空初始化；禁止循环嵌套。
- `docs[]`：`{ "title": "说明", "path": "README.md" }`，文件必须真实存在且非空。
- `examples[]`：`{ "title": "最小示例", "path": "examples/最小示例.lcpp" }`。

### 5.4 targets（C++ 构建目标）

```json
"targets": [
  {
    "id": "windows-msvc-win32",
    "platform": "windows",
    "arch": "win32",
    "toolchain": "msvc",
    "includeDirs": ["include"],
    "headers": ["include/text_tools_bridge.h"],
    "sources": ["src/text_tools_bridge.cpp"]
  },
  {
    "id": "windows-msvc-x64",
    "platform": "windows",
    "arch": "x64",
    "toolchain": "msvc",
    "includeDirs": ["include"],
    "headers": ["include/text_tools_bridge.h"],
    "sources": ["src/text_tools_bridge.cpp"]
  }
]
```

- 当前真实构建闭环是 Windows / MSVC；建议同时提供 `win32` 和 `x64` 两个 target（纯源码模块两边共用同一批文件），IDE 会按工作区构建架构精确选择。
- `libs`（`.lib` 导入库）与 `runtimeFiles`（`.dll` 等运行时文件）仅在用户明确提供这些二进制时填写；不同架构必须各给一份对应路径，不能共用。
- 如需预编译宏，使用 `defines`。

### 5.5 bindings.commands（中文命令 → C++ 函数的确定性映射）

```json
"bindings": {
  "commands": [
    {
      "command": "文本_统计字符数",
      "runtimeName": "文本_统计字符数",
      "parameters": [
        { "name": "文本", "type": "wideString", "description": "要统计的文本。" }
      ],
      "returnType": "int",
      "encoding": "wide",
      "example": "文本_统计字符数(\"你好\")"
    }
  ]
}
```

- `command` 必须与 `contributes.commands[].name` 一一对应成对出现：contributes 负责补全提示，binding 负责真实 C++ 调用。只有 contributes 没有 binding 的命令无法生成 C++ 调用。
- `runtimeName` 是 C++ 函数名，可直接使用中文标识符（MSVC 支持）。
- `parameters[].type` 使用 ABI 类型（见第 6 节）；每个参数必须写 `description`。
- `encoding` 固定用 `"wide"`。
- `example` 给出一个完整可用的中文调用示例。

## 6. C++ ABI 约定（桥接函数签名）

`.lcpp` 中的命令调用会被生成器直接翻译为 `runtimeName(参数...)` 的 C++ 调用。桥接函数签名必须匹配下表：

| binding 参数类型 | C++ 形参类型 | 说明 |
| --- | --- | --- |
| `wideString` | `const std::wstring&` | 实参可能是 `L"..."` 字面量或宽字符串变量，`std::wstring` 均可接收 |
| `utf8String` | `const std::string&` | 内部自行处理 UTF-8 编码 |
| `int` | `int` | |
| `longLong` | `long long` | |
| `double` | `double` | |
| `bool` | `bool` | |
| `controlRef` | `const std::wstring&` | 收到设计器控件名（默认 wideName 表示），用运行时按名查找控件，不得依赖数组序号或私有 ID |
| `handler` | `const std::wstring&` | 收到处理器名（如 `L"获取IP完成"`）；由宿主运行时解析派发，不要自行保存函数指针 |

| binding 返回类型 | C++ 返回类型 |
| --- | --- |
| `int` | `int` |
| `longLong` | `long long` |
| `double` | `double` |
| `bool` | `bool` |
| `wideString` | `std::wstring` |
| `void`（或不填） | `void` |

桥接实现规范：

- 中文命令优先绑定到你编写的稳定桥接函数，而不是直接暴露第三方 API。
- 源文件开头建议加入 `#ifndef UNICODE / #define UNICODE` 与 `_UNICODE` 保护，再 include Windows 头。
- 字符串一律以宽字符为边界，内部再转 UTF-8 或其它编码。
- 需要 `winhttp.lib`、`ws2_32.lib` 等系统库时用 `#pragma comment(lib, "xxx.lib")` 声明（系统库无需随模块分发，不算 `libs`）。
- 异步能力建议做成"启动命令返回任务编号 + 按编号读取结果命令 + `handler` 完成处理器"的组合（参考内置 `网页_异步访问` 的模式），不要把回调指针长期保存在 DLL 里。
- 纯源码模块中不要出现 `LoadLibrary`、裸线程池等重资源；线程与任务派发交给宿主受管任务机制或保持简单同步实现。

## 7. 强制红线（校验必过，违反即被 IDE 拒绝）

1. **controlRef 不得用文本型伪装**：凡是参数语义是"引用窗口设计器中的控件/组件/资源"，binding 参数必须声明 `"type": "controlRef"`（可附 `controlTypes`、`controlKinds`、`scope` 约束），不得声明为 `wideString`。
2. **controlRef 不带引号**：`.lcpp` 示例、`insertText`、`example` 中控件参数一律写裸控件名（如 `控件_设置文本(按钮1, "确定")`），绝不能写成 `"按钮1"`。
3. **处理器引用语法**：回调/处理器参数在示例和 `insertText` 中必须写 `&处理器名`，不得写成 `"处理器名"` 字符串；binding 参数声明 `"type": "handler"`，并附 `handlerSignature`（如 `{ "parameterTypes": [], "returnType": "空" }`）。
4. **insertText 与参数一致**：占位符数量、顺序必须与 binding `parameters` 完全一致。
5. **docs 真实存在**：`contributes.docs[]` 登记的每个文件必须随模块提供、非空、UTF-8；文档内容要与实现一致（适用场景、调用方式、参数与返回值、完整示例、依赖与平台限制）。
6. **声明文件必须存在**：`headers`、`sources`、`libs`、`runtimeFiles`、`examples` 声明的每个路径都要真实输出。
7. **命令成对**：每个命令同时出现在 `contributes.commands` 和 `bindings.commands`。这条由 IDE 强制：「导入 AI 生成的文件」和「校验模块」都会逐条比对，只有补全没有绑定的命令会被拒绝导入，并给出「命令 X 缺少 bindings.commands 映射」的中文诊断。
8. **有状态命令必须提供读取接口**：例如弹窗/异步任务必须提供状态或结果读取命令，不能只有启动命令。
9. **可视控件一控件一主窗口句柄**：进阶设计器控件中，每个控件实例必须创建并持有独立主 `HWND`（初始隐藏也不得省略），生命周期明确、可按名查找、可销毁；不得共用其它控件的主 `HWND`。非可视资源（菜单、图像列表等）用与其实现相符的 `HMENU`/`HIMAGELIST` 等类型，不得伪装成 `HWND`。
10. **安全相对路径**：清单与属性里所有路径均为包内相对路径，禁止绝对路径、盘符与 `..`。

## 8. 进阶：设计器控件（仅在用户明确要求时提供）

贡献设计器控件需要在 `contributes.designerControls[]` 中声明 `type`、`label`、`defaultProps`、`properties[]`、`events[]`（事件 `handlerPattern` 必须含 `{controlName}` 占位符）以及 `runtimeControl` 契约（`lingCppType`、`createCommand`、创建参数、按标记查找命令等），并遵守第 7 节第 9 条 HWND 红线。设计器控件复杂度高、校验严格，除非用户明确要求，否则优先建议用户先做纯命令模块。

## 9. 完整示例：AI 文本工具模块

以下是一个纯源码、双 target、可通过校验的完整最小模块，请仿照它的结构生成。

### 文件：`lingbuilder.module.json`

```json
{
  "schemaVersion": 2,
  "id": "ai.text.tools",
  "name": "AI 文本工具",
  "version": "1.0.0",
  "category": "系统",
  "description": "由 AI 生成的文本工具模块，提供字符统计、反转和包含判断命令。",
  "author": "AI",
  "license": "MIT",
  "tags": ["文本", "工具"],
  "contributes": {
    "commands": [
      {
        "name": "文本_统计字符数",
        "signature": "文本_统计字符数(文本)",
        "description": "统计文本中的字符数量。",
        "insertText": "文本_统计字符数(\"${1:文本}\")",
        "returnType": "整数型",
        "returnDescription": "返回文本的字符数量；空文本返回 0。"
      },
      {
        "name": "文本_反转",
        "signature": "文本_反转(文本)",
        "description": "把文本字符顺序反转后返回。",
        "insertText": "文本_反转(\"${1:文本}\")",
        "returnType": "文本型",
        "returnDescription": "返回反转后的文本；空文本返回空文本。"
      },
      {
        "name": "文本_是否包含",
        "signature": "文本_是否包含(文本, 关键字)",
        "description": "判断文本中是否包含关键字。",
        "insertText": "文本_是否包含(\"${1:文本}\", \"${2:关键字}\")",
        "returnType": "逻辑型",
        "returnDescription": "包含返回真，不包含或参数为空返回假。"
      }
    ],
    "docs": [{ "title": "使用说明", "path": "README.md" }],
    "examples": [{ "title": "最小示例", "path": "examples/最小示例.lcpp" }]
  },
  "targets": [
    {
      "id": "windows-msvc-win32",
      "platform": "windows",
      "arch": "win32",
      "toolchain": "msvc",
      "includeDirs": ["include"],
      "headers": ["include/text_tools_bridge.h"],
      "sources": ["src/text_tools_bridge.cpp"]
    },
    {
      "id": "windows-msvc-x64",
      "platform": "windows",
      "arch": "x64",
      "toolchain": "msvc",
      "includeDirs": ["include"],
      "headers": ["include/text_tools_bridge.h"],
      "sources": ["src/text_tools_bridge.cpp"]
    }
  ],
  "bindings": {
    "commands": [
      {
        "command": "文本_统计字符数",
        "runtimeName": "文本_统计字符数",
        "parameters": [{ "name": "文本", "type": "wideString", "description": "要统计的文本。" }],
        "returnType": "int",
        "encoding": "wide",
        "example": "文本_统计字符数(\"你好\")"
      },
      {
        "command": "文本_反转",
        "runtimeName": "文本_反转",
        "parameters": [{ "name": "文本", "type": "wideString", "description": "要反转的文本。" }],
        "returnType": "wideString",
        "encoding": "wide",
        "example": "文本_反转(\"你好\")"
      },
      {
        "command": "文本_是否包含",
        "runtimeName": "文本_是否包含",
        "parameters": [
          { "name": "文本", "type": "wideString", "description": "被检查的文本。" },
          { "name": "关键字", "type": "wideString", "description": "要查找的关键字。" }
        ],
        "returnType": "bool",
        "encoding": "wide",
        "example": "文本_是否包含(\"你好世界\", \"世界\")"
      }
    ]
  }
}
```

### 文件：`include/text_tools_bridge.h`

```cpp
#pragma once

#include <string>

int 文本_统计字符数(const std::wstring& 文本);
std::wstring 文本_反转(const std::wstring& 文本);
bool 文本_是否包含(const std::wstring& 文本, const std::wstring& 关键字);
```

### 文件：`src/text_tools_bridge.cpp`

```cpp
#include "text_tools_bridge.h"

int 文本_统计字符数(const std::wstring& 文本) {
    return static_cast<int>(文本.size());
}

std::wstring 文本_反转(const std::wstring& 文本) {
    return std::wstring(文本.rbegin(), 文本.rend());
}

bool 文本_是否包含(const std::wstring& 文本, const std::wstring& 关键字) {
    if (文本.empty() || 关键字.empty()) return false;
    return 文本.find(关键字) != std::wstring::npos;
}
```

### 文件：`README.md`

```markdown
# AI 文本工具

提供文本字符统计、反转和包含判断三个中文命令。

## 适用场景

需要在中文代码里快速处理文本长度、顺序和查找，不依赖外部库。

## 命令说明

- 文本_统计字符数(文本) → 整数型：返回字符数量。
- 文本_反转(文本) → 文本型：返回反转后的文本。
- 文本_是否包含(文本, 关键字) → 逻辑型：包含返回真。

## 平台限制

当前支持 Windows（Win32 与 x64），MSVC 工具链，纯标准库实现，无外部依赖。
```

### 文件：`examples/最小示例.lcpp`

```text
类 MainWindow

    事件 _按钮1_被单击()
        调试输出(文本_统计字符数("你好世界"))
        调试输出(文本_反转("你好世界"))
        如果 (文本_是否包含("你好世界", "世界"))
            调试输出("包含关键字")
        如果结束
    结束

结束
```

## 10. AI 自查清单（输出前逐项检查）

- [ ] 每个文件都使用 `### 文件：<相对路径>` 标题加围栏代码块格式输出，路径与清单声明一致。
- [ ] `schemaVersion` 为 2；`id` 符合命名规则且与保存目录名一致。
- [ ] 每个命令在 `contributes.commands` 和 `bindings.commands` 成对出现，`command` 名一致。
- [ ] `insertText` 占位符数量/顺序与 binding 参数一致；文本参数带引号、控件参数不带引号、处理器参数为 `&${N:处理器名}`。
- [ ] 参数语义是控件时类型为 `controlRef`，是回调时类型为 `handler` 且带 `handlerSignature`。
- [ ] 有返回值的命令写了中文 `returnType` 和 `returnDescription`；每个 binding 参数写了 `description`。
- [ ] `targets` 提供了 win32 和 x64（或与用户环境匹配的架构），声明的 headers/sources 文件全部输出。
- [ ] `docs[]` 与 `examples[]` 登记的文件全部输出且非空。
- [ ] 所有路径为包内相对路径。
- [ ] 输出结尾附一段“保存说明”：告诉用户把回复原文粘贴到 LingBuilder 模块页“导入 AI 生成的文件”即可自动导入并校验（或手动保存到 `.lingbuilder\module-build\<模块ID>\`）。

## 11. 用户需求提示词模板（用户可直接复制使用）

```text
你是 LingBuilder 中文 IDE 的模块开发者。请严格按照下面的规范为我开发一个模块。

【规范开始】
（在此粘贴《LingBuilder 模块 AI 开发规范》全文）
【规范结束】

我的需求：
（用中文描述你想要的模块功能，例如：做一个 Base64 编码解码模块，提供"编码"和"解码"两个命令）

请输出完整模块文件（每个文件用“### 文件：相对路径”标题加代码块），并在最后告诉我每个文件的作用。
```
