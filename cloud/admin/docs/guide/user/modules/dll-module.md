---
title: 调用 C++ DLL
---

# 调用 C++ DLL（第三方 DLL 与中文项目生成 DLL）

> [🕒 预计 20 分钟] | 难度：进阶

LingBuilder 支持两条使用 C++ DLL 的路径，最终都以「模块」为载体被中文项目调用：

1. **第三方 / 自制 C++ DLL** → 封装成 `.lbmod` 模块 → 中文命令直连 DLL 导出函数。
2. **中文项目生成 DLL** → 把中文项目（`.lcpp`）的解决方案项目属性设为 `outputType: "dll"`，「公开」子程序自动导出为 DLL 函数 → 同样封装成模块 → 供其他项目调用。

两条路径共用同一套模块生态：安装、启用、F5 构建时自动复制 DLL 到 exe 同目录，生成的工程在 Visual Studio 中也能独立编译运行。

## 1. 第三方 DLL：五步封装

以一个导出 `demo_add`、`demo_text_length`、`demo_distance` 的 C 动态库为例：

1. **准备双架构产物**：外部模块需要为每个架构提供真实文件（内置模块的架构自动补齐不适用于外部 `.lbmod`）：

   ```
   模块目录/
   ├ include/demo_mathdll.h        ← extern "C" 导出声明
   ├ lib/Win32/demo_mathdll.lib    lib/x64/demo_mathdll.lib
   └ bin/Win32/demo_mathdll.dll    bin/x64/demo_mathdll.dll
   ```

2. **写迁移配置**：一个 JSON 描述模块 ID、头文件、导入库、运行时 DLL 与每条中文命令（`runtimeName` 直接填 DLL 导出函数名）。
3. **生成模块**：模块开发者中心选择「C++ 迁移」，或命令行 `lingbuilder module migrate-cpp --config 配置.json --out 模块目录`；再补齐模块说明文档与最小示例。
4. **校验打包**：`lingbuilder module validate 模块目录` → `lingbuilder module pack 模块目录 --out .lingbuilder/module-packages/xxx.lbmod`；校验会给出全部中文诊断（命令与绑定必须一一成对、路径必须安全相对路径、带 DLL 的模块不允许结构体/数组参数等）。
5. **安装启用**：IDE「安装 .lbmod」→ 预览确认 → 在「配置项目所使用模块」中启用。F5 构建后日志出现「已复制模块运行时文件：xxx.dll」即表示 DLL 已就位。

> [!NOTE]
> 打包与安装也可以全程用模块开发者中心 UI 完成；命令行入口（`module init / validate / pack / inspect / migrate-cpp`）适合批处理与 AI 协作。

## 2. 让中文项目生成 DLL

把一个普通中文项目变成「功能库」：解决方案项目属性 `buildProperties` 中设置 `outputType: "dll"`（可配 `executableName` 指定产物名）。

导出口径是确定性的：

- **仅「公开」节的子程序导出**；事件处理器、构造/析构、私有/保护成员一律不导出。
- 文本参数以 `const wchar_t*` 跨界、文本返回经 DLL 侧缓冲以 `const wchar_t*` 交出——消费方无论是 Debug 还是 Release 都安全。
- 动态库是纯逻辑库：不生成 `wWinMain` 与消息循环，不会自动创建设计器窗口；首次导出调用时自动完成 COM/GDI+/通用控件初始化。

DLL 项目在 IDE 里的行为：

- **F5「生成并运行」自动禁用**（动态库没有运行入口）：工具栏运行按钮不可点击并提示原因，命令面板与 F5 快捷键同样被拦截。
- **编译入口是「生成」**：工具栏会出现专用的「生成动态库」按钮（仅 DLL 项目显示），也可以用菜单/命令面板的「生成解决方案」；两者都会在输出目录的 `bin` 子目录产出 `<产物名>.dll` 与同名导入库 `.lib`。
- Visual Studio 导出工程的 `ConfigurationType` 同步为 `DynamicLibrary`（强制 /MD），可在 VS 里独立编译。

## 3. 把项目 DLL 封装成模块

与第三方 DLL 完全一致：写一份与导出同名的头文件（文本参数 `const wchar_t*`）、填好迁移配置（`runtimeName` 填公开子程序名）、`migrate-cpp` 生成 → 校验 → 打包 → 安装。之后任何项目启用该模块，即可用中文命令直接调用另一份中文代码的能力。

## 4. 常见诊断对照

| 诊断 | 处理 |
| --- | --- |
| 公开子程序签名包含不能跨 DLL 边界的类型 | 只保留 POD 与文本签名；控件、数组、记录、句柄对象不能跨界 |
| 同名公开子程序重复导出 | 重命名其中一个，或改为私有 |
| 模块未提供兼容目标 | 补齐对应架构 target 与真实 `.lib`/`.dll` |
| 需要 MSVC 链接 .lib | 安装 Visual Studio Build Tools 后重试 |

> [!WARNING]
> 第三方 DLL 的公开头文件请保持「文本参数 `const wchar_t*`、文本返回 `const wchar_t*`」的形态。`std::wstring` 以按值或引用跨界，在 Debug 消费方 + Release DLL 组合下会被错误读取甚至堆损坏；纯 POD 参数无此问题。
