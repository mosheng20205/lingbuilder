---
title: 高阶实战 20 · 模块封装全景：从一条命令到分发 .lbmod
---

# 高阶实战 20 · 模块封装全景：从一条命令到分发 .lbmod

> 《LingBuilder 高阶实战系列》第 20 集，**模块封装专题**开篇。这一集把「模块封装」从头到尾走一遍：在欢迎页**新建模块** → 认识骨架三件套 → 把模板命令**改成自己的真命令** → 模块页**启用** → 建一个窗口项目**调用它** → 打包成 **.lbmod** 发给别人。学完这一集，后面的 21~25 集（命令面进阶、功能库、C++ 运行时、文档例程、生态分发）都是在这一集的骨架上加细节。全程约 40 分钟。
>
> 前置要求：会用 LingBuilder 建窗口项目（学过[零基础入门](/guide/tutorials/beginner-01-install)即可）。想再看一遍更基础的版本，可配合《模块开发新手图文教程》。

## 这一集你将学会

- 模块和功能代码的区别：**功能库给自己项目用，模块做出来给大家用**
- 欢迎页「新建模块」两种模式：**从模板新建** / **打开 .lbmod 模块包**
- 骨架三件套：清单 `lingbuilder.module.json`、C++ 桥接头、C++ 实现
- **改命令** = 同时改「给人看的 contributes」和「给编译器看的 bindings」
- 清单校验诊断怎么看（本集真踩了一个：binding 参数写错字段名）
- 打包 `.lbmod` 模块包，与别人拿到包后的两种装法

## 1. 三十秒理解：模块 vs 功能代码

```text
功能代码（功能库）                模块（.lbmod）
  只属于一个项目                    装到任何工作区的任何项目
  复制到别的项目要带源码            双击/导入即可安装
  只能自己用                        可以发给别人
```

模块内部是真正的 C++ 代码，F5 构建时直接编译进最终程序——**没有性能损失**。本集我们做一个最小但完整的「文本工具模块」：两条统计命令 + 一个版本常量。

## 2. 欢迎页新建模块

打开 LingBuilder，在欢迎页点**「新建模块」**，弹出模块窗口后保持**「从模板新建」**页签：

![新建模块入口](./images/gaojie-20-module-overview/01.png)

填四项信息：

- **模块 ID**：模块的英文「身份证号」，小写字母/数字开头，可含点、下划线、中划线。我们填 `lingbuilder.demo.texttools`（建议都用 `lingbuilder.demo.` 开头避免撞名）；
- **模块名称**：中文显示名，填「文本工具模块」；
- **分类**：八选一（界面/系统/网络/数据库/图像/AI/构建/其他），保持「系统」；
- **模块说明**：一句话说明模块是干什么的，会显示在模块详情页。

![填写模块信息](./images/gaojie-20-module-overview/02.png)

点**「创建模块」**，出现绿色提示「**模块源码已就绪**」就成功了。注意提示里的三条后续路径：① 工作台模块页启用；② 「文件 → 打开文件」编辑清单与 C++ 源码；③ 模块页「模块包制作」发布 .lbmod：

![创建成功](./images/gaojie-20-module-overview/03.png)

## 3. 骨架三件套：去哪里改

创建好的骨架落在工作区 `.lingbuilder/module-build/lingbuilder.demo.texttools/`：

```text
lingbuilder.module.json    ← 模块清单：命令、常量、文档、编译配置都登记在这里
include/module_bridge.h    ← C++ 桥接头（函数声明）
src/module_bridge.cpp      ← C++ 实现（命令的真身）
docs/usage.md              ← 随包使用说明
examples/最小示例.lcpp       ← 例程源码（模块详情页「示例」分组展示）
```

模板骨架自带一条占位的「示例命令」和一个「示例常量」，编译目标**只有 32 位（win32）**。用「文件 → 打开文件」或任何外部编辑器（记事本/VS Code 都行）直接改这些普通文本文件即可——**IDE 直接消费磁盘上的最新内容**，改完不用重装，下一次补全、诊断、F5 就是新的。

## 4. 改命令：把示例命令换成真命令

我们要两条命令：

- `文本工具_统计字符(文本)` → 整数型：字符数（1 个汉字算 1 个）
- `文本工具_统计汉字数(文本)` → 整数型：只数汉字

### 4.1 改 C++ 桥接头 `include/module_bridge.h`

```cpp
#pragma once

#include <string>

// 模块桥接函数声明：清单 bindings 里的 runtimeName 叫什么，这里就声明什么。
int TextTools_CountChars(const wchar_t* text);
int TextTools_CountHan(const wchar_t* text);
```

> 参数写 `const wchar_t*`（文本型参数的固定写法），返回 `int`（整数型返回值的固定写法）。

### 4.2 改 C++ 实现 `src/module_bridge.cpp`

```cpp
#include "module_bridge.h"
#include <cwchar>

// 统计字符：按 UTF-16 码元计数（1 个汉字算 1 个）。
int TextTools_CountChars(const wchar_t* text) {
    return text ? (int)wcslen(text) : 0;
}

// 统计汉字数：只统计 CJK 基本区（U+4E00 ~ U+9FFF）的汉字。
int TextTools_CountHan(const wchar_t* text) {
    if (text == nullptr) return 0;
    int count = 0;
    for (const wchar_t* p = text; *p != L'\0'; ++p) {
        if (*p >= 0x4E00 && *p <= 0x9FFF) ++count;
    }
    return count;
}
```

### 4.3 改清单 `lingbuilder.module.json`

清单里和命令相关的有两块，**命令名必须一致**：

- `contributes.commands`：给**人**看的（命令名、签名、说明、补全片段），类型用中文（`整数型`）；
- `bindings.commands`：给**编译器**看的（C++ 函数名 `runtimeName`、参数 ABI 类型），类型用英文（`wideString` = 文本型、`int` = 整数型）。

再把 `targets` **补一个 x64 目标**（模板默认只有 win32；F5 常用 64 位构建，少了 x64 目标构建会报 C1083 找不到符号——**这是新手最容易踩的坑**）。完整清单见源码包，关键字段长这样：

```json
"bindings": {
  "commands": [
    { "command": "文本工具_统计字符", "runtimeName": "TextTools_CountChars",
      "parameters": [ { "name": "文本", "type": "wideString", "description": "要统计的原文文本。" } ],
      "returnType": "int", "example": "文本工具_统计字符(\"你好 LingBuilder\")" }
  ]
}
```

> ⚠️ **本集真踩的坑**：binding 参数的字段名是 **`type`**，不是 `cppType`。写错后模块在模块页里「消失」——其实它在，只是清单校验未通过被标成了无效模块。遇到「搜不到自己的模块」，先在模块详情/扫描诊断里看中文校验信息（形如 `bindings.commands[0].parameters[0].type 不受支持`），按提示改字段名即可。

### 4.4 顺手把 docs 和示例补上

`docs/usage.md` 写两条命令的说明表格；`examples/最小示例.lcpp` 用控制台形态（后面 24 集会真正打开它）：

```lcpp
类 程序

    公开 整数型 启动()
        ' 文本工具模块 最小示例：统计字符与汉字数
        调试输出(文本工具_统计字符("你好 LingBuilder"))
        调试输出(文本工具_统计汉字数("你好，世界！Hello"))
        调试输出(#文本工具_版本)
        返回(0)
    结束

结束类
```

## 5. 模块页：找到并启用

回到工作台，点活动栏**「模块」**，搜索「文本工具」——模块卡片带金色**「开发源」**标记，表示它直接消费你的源码目录（不是安装副本）：

![模块页搜索到开发源](./images/gaojie-20-module-overview/04.png)

点卡片打开**模块详情**：标识符、版本、分类、**构建目标·2（Win32 + x64）**都在这里，「接口」页能看到两条命令的完整签名：

![模块详情](./images/gaojie-20-module-overview/05.png)

> 注意：模块是**按项目**启用的。先确认当前项目是你要用它的那个项目（下一节建好项目后再点启用也一样）。

## 6. 建调用方项目，写调用代码

菜单「文件(F) → 新建项目」，类型选 **Windows 界面设计**：

![新建项目对话框](./images/gaojie-20-module-overview/07.png)

项目名称填「文本工具演示」，点「创建项目」：

![填写项目名](./images/gaojie-20-module-overview/08.png)

回到模块页点开文本工具模块详情，点**「启用」**——按钮变成红色「禁用」、侧栏出现「已启用 1」、输出面板记录「【模块】启用 文本工具模块。」：

![启用成功](./images/gaojie-20-module-overview/06.png)

画 6 个控件：说明标签、输入框（默认内容 `你好 LingBuilder，中文模块真方便！`）、两个按钮、结果列表框、状态标签：

![设计器全景](./images/gaojie-20-module-overview/09.png)

双击 `MainWindow.lcpp`，在三个事件块里写调用代码：

![代码-上半](./images/gaojie-20-module-overview/10.png)

```lcpp
类 MainWindow
    事件 _MainWindow_创建完毕()
        控件_添加项目(结果列表, "就绪：模块已启用，点下方两个按钮试试。")
    结束
```

「① 统计字符与汉字数」按钮：取输入框原文，分别调用两条命令，把结果写进列表：

![代码-完整事件](./images/gaojie-20-module-overview/11.png)

```lcpp
    事件 _统计按钮_被单击()
        局部 文本型 内容
        内容 = 控件_取文本(内容输入框)
        控件_清空项目(结果列表)
        控件_添加项目(结果列表, "原文：" + 内容)
        控件_添加项目(结果列表, "文本工具_统计字符 → " + 到文本(文本工具_统计字符(内容)) + " 个字符")
        控件_添加项目(结果列表, "文本工具_统计汉字数 → " + 到文本(文本工具_统计汉字数(内容)) + " 个汉字")
        列表框_滚动到项(结果列表, 控件_取项目数量(结果列表) - 1)
        控件_设置文本(状态标签, "统计完成。")
    结束
```

「② 读常量」按钮：模块清单里的常量在源码中用 **`#常量名`** 直接引用：

![代码-下半](./images/gaojie-20-module-overview/12.png)

```lcpp
    事件 _常量按钮_被单击()
        控件_添加项目(结果列表, "#文本工具_版本 = " + 到文本(#文本工具_版本) + "（模块清单里的常量）")
        列表框_滚动到项(结果列表, 控件_取项目数量(结果列表) - 1)
        控件_设置文本(状态标签, "常量读取完成。")
    结束
结束类
```

> 输入 `文本工具` 时补全会直接列出模块命令和完整签名——模块一旦启用，命令和内置命令的输入体验完全一致。

## 7. 编译、运行、真机验证

编译后先看底部**错误列表（0）**——零报错再运行：

![错误列表零报错](./images/gaojie-20-module-overview/13.png)

![运行窗口](./images/gaojie-20-module-overview/14.png)

点「① 统计字符与汉字数」：`你好 LingBuilder，中文模块真方便！` = **23 个字符**（汉字+字母+标点都算 1 个）、**9 个汉字**（你好中文模块真方便）——两个数字都对得上：

![交互-统计结果](./images/gaojie-20-module-overview/15.png)

点「② 读常量」：`#文本工具_版本 = 100`（清单里的 1.00 版本常量）：

![交互-常量](./images/gaojie-20-module-overview/16.png)

到这里，你写的 C++ 已经以模块命令的形式真实跑在 exe 里了。

## 8. 打包 .lbmod，发给别人

模块页右上**「…」→「模块包制作」**，填两项：

- **模块目录**：`.lingbuilder/module-build/lingbuilder.demo.texttools`
- **导出路径**：`.lingbuilder/module-packages/lingbuilder.demo.texttools-1.0.0.lbmod`

![模块包制作](./images/gaojie-20-module-overview/17.png)

点**「导出 .lbmod」**，输出面板提示「【模块包】已导出 ……」即成功，`.lbmod` 就落在工作区的 `module-packages` 目录：

![导出完成](./images/gaojie-20-module-overview/18.png)

## 9. 别人怎么装你的包

拿到 `.lbmod` 的人有两条装法（模块页「…」菜单里都有关口）：

![模块生态菜单](./images/gaojie-20-module-overview/19.png)

1. **欢迎页 → 新建模块 → 「打开 .lbmod 模块包」页签**：填 .lbmod 文件完整路径，登记为开发源（能看能改能启用）；
2. **模块页 → 「…」→「安装 .lbmod」**：按安装包流程装入 `.lingbuilder/modules`。

装好后在模块详情「接口」页能看到和你机器上一模一样的命令清单。25 集会把安装/卸载/升级/市场这些生态能力展开讲。

## 下一集预告

21 集讲**命令面进阶**：带默认值参数、控件参数 controlRef、常量与代码片段 snippets、中文别名的完整写法。

## 源码包

本集完整项目（含调用方源码）已打包：[文本工具演示.lcpppkg](https://lingbuilder.com/demos)——在 LingBuilder 里「文件 → 打开 LCPP 源码包」即可一键导入运行。
