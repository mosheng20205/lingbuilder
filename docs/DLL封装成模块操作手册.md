# DLL 封装成模块操作手册

把一个 C++ DLL 接入 LingBuilder 的正式路径是封装成 v2 模块（`.lbmod`）：中文命令在 `bindings.commands[]` 里确定性映射到 DLL 导出函数，F5 构建、原生预览与 Visual Studio 工程导出都会自动复制运行时 DLL 到 exe 同目录、链接导入库。本文给出从零到可调用的完整流程，覆盖两种 DLL 来源：

1. **第三方/自制 C++ DLL**（示例：`examples/dll-module-demo/`，模块 `lingbuilder.demo.mathdll`）；
2. **LingBuilder 中文项目经原生 C++ 管线生成的 DLL**（示例：`examples/dll-lib-demo/` 生成、`examples/dll-consumer-demo/` 调用，模块 `lingbuilder.demo.projectdll`）。

前置阅读：`docs/模块开发手册.md`（manifest v2 完整规范）。

## 一、两种封装形态

| 形态 | 结构 | 适用 |
| --- | --- | --- |
| **薄封装（直连导出）** | targets 只声明 `headers` + `libs` + `runtimeFiles`，不写桥接源码；`runtimeName` 直接等于 DLL 导出函数名 | 导出函数已是 `extern "C"`、签名只用基础类型 |
| **桥接封装** | 增加 `sources`（桥接 .cpp/.h 编入消费方工程），`runtimeName` 指向桥接函数，桥内再调 DLL 并做参数/句柄转换 | 导出名不适合直接暴露、需要管理句柄生命周期、或参数需要适配（new_emoji 即此类） |

本文主线是薄封装；桥接封装只是多一组 `include/module_bridge.h` + `src/module_bridge.cpp`，其余流程完全相同。

## 二、DLL 侧要求

- **架构成对**：外部模块不享受内置模块的架构自动补齐，`lib/`、`bin/` 必须按架构各自提供真实产物：

  ```text
  lib/Win32/<name>.lib    bin/Win32/<name>.dll
  lib/x64/<name>.lib      bin/x64/<name>.dll
  ```

- **导出方式**：`extern "C" __declspec(dllexport)`；调用约定统一 `__cdecl`（消费方生成代码按同名声明调用，经导入库解析，与导出表装饰名解耦）。
- **签名门禁**：跨 DLL 边界只允许 POD 与宽字符文本——空、整数型、长整数型、小数型、逻辑型、字节型、文本型（manifest 校验对带 `.dll` runtimeFiles 的清单禁止 record/array 结构化参数；控件引用、句柄对象、数组、字节集不能作参数或返回值）。
- **文本的 ABI（关键，实测踩坑）**：文本参数必须声明为 `const wchar_t*`，文本返回值必须返回 `const wchar_t*`（指向 DLL 侧稳定的存储，调用方在下次调用前取走）。中文项目的 DLL 由生成器自动按此形态生成导出包装；第三方 DLL 头文件请保持同一形态。**绝不能让 `std::wstring` 以按值或引用跨 DLL**：调用方常为 /MDd（Debug，迭代器调试布局不同）、DLL 为 /MD，std 对象跨界会被按错误布局读取（实测"灵码LingBuilder"取长度返回 2）甚至跨 CRT 堆释放（0xC0000374 堆损坏）。纯 POD 参数/返回无此问题。

## 三、第三方 DLL：五步封装

示例源码与构建脚本见 `examples/dll-module-demo/third-party-dll-src/`（`build-demo-mathdll.cmd` 用 MSVC 一次产出双架构）。

### 1. 准备公开头文件

`include/demo_mathdll.h`：`extern "C"` 声明每个要暴露的导出函数。文本参数用 `std::wstring`（生成代码按值传宽字符串）。

### 2. 写 migrate-cpp 迁移配置

`examples/dll-module-demo/migrate-mathdll.json`：

```json
{
  "id": "lingbuilder.demo.mathdll",
  "name": "演示数学 DLL",
  "category": "其他",
  "headers": ["include/demo_mathdll.h"],
  "includeDirs": ["include"],
  "libs": ["lib/Win32/demo_mathdll.lib"],
  "runtimeFiles": ["bin/Win32/demo_mathdll.dll"],
  "commands": [
    {
      "name": "演示_加法",
      "signature": "演示_加法(被加数, 加数)",
      "description": "调用演示 DLL 计算两个整数之和。",
      "runtimeName": "demo_add",
      "returnType": "整数型",
      "insertText": "演示_加法(被加数, 加数)",
      "parameters": [
        { "name": "被加数", "type": "整数型", "description": "第一个加数。" },
        { "name": "加数", "type": "整数型", "description": "第二个加数。" }
      ]
    }
  ],
  "targetId": "windows-msvc-win32",
  "arch": "win32",
  "toolchain": "msvc"
}
```

要点：`name` 是中文命令名，`runtimeName` 必须与 DLL 导出函数名一致；类型映射为 整数型→int、长整数型→long long、小数型→double、逻辑型→bool、字节型→unsigned char、文本型→wideString；每个参数都要写中文 `description`（新手面板与补全直接使用）。

### 3. 生成草稿并补齐双架构

```bash
node dist/cli.cjs module migrate-cpp --config <配置.json> --out <模块目录>
```

migrate-cpp 只生成一个 target（配置里 arch 指定的那个）。手工编辑 `lingbuilder.module.json`，把 `targets[]` 扩成两条，**每个 target 只列本架构的 libs/runtimeFiles**（headers/includeDirs 两条相同）。再补：

- `README.md`：适用场景、每条命令的参数与返回值、完整示例、依赖和平台限制（manifest 的 `contributes.docs[]` 已登记它，内容必须非空）；
- `examples/最小示例.lcpp`：一条能看懂调用方式的窗口事件示例（`contributes.examples[]` 已登记）。

### 4. 校验、打包、安装

```bash
node dist/cli.cjs module validate <模块目录>
node dist/cli.cjs module pack <模块目录> --out .lingbuilder/module-packages/<id>.lbmod
node dist/cli.cjs module inspect <包>.lbmod
```

安装走 IDE「安装 .lbmod」→ 预览确认 → 落位 `.lingbuilder/modules/<id>/`（无头环境可等价地经 `ModuleService.previewPackageInstall` + `installPackage` 安装）。随后在项目「配置项目所使用模块」中启用（对应 `.lingbuilder/projects/<项目id>/project-modules.json`）。

### 5. 构建、运行、验证

工程按常规 F5 / CLI 构建。验收清单：

- [ ] `module validate` 零阻断诊断；
- [ ] 编译链接通过（缺 MSVC 时会得到「需要 MSVC 链接 .lib」的中文诊断）；
- [ ] **exe 同目录存在该 DLL**（构建日志出现「已复制模块运行时文件：<name>.dll」）；
- [ ] 运行结果正确（示例工程用 `文件_写入文本` 把调用结果落盘后断言，或直接信息框目检）；
- [ ] 换一架构再验一遍 target 选择（把工作区构建架构切到另一侧或用 `--arch`）。

## 四、中文项目生成可被调用的 DLL（outputType: "dll"）

LingBuilder 中文项目可以把「公开」子程序导出为 DLL 函数，再按第三节封装成模块给其他项目调用。示例：`examples/dll-lib-demo/`（库项目）+ `examples/dll-consumer-demo/`（消费项目）。

### 1. 项目侧写法

- 解决方案项目属性设置 `buildProperties.outputType: "dll"`（可配 `executableName` 指定产物名，如 `ProjectMathDll`）。AI Bridge 构建与 IDE 内「生成解决方案 / 生成项目」都读取该属性。
- **F5（生成并运行）对 DLL 项目自动禁用**：工具栏运行按钮与「重新运行」按钮不可点击（悬停提示原因），命令面板/快捷键中的「生成并运行当前项目」同样禁用；服务端 `/api/window-designer/build-run` 对 DLL 项目的 run 请求也会返回 `run-unsupported` 中文引导（绕过 UI 直接调接口时的兜底）。
- DLL 项目在 IDE 内的编译入口：菜单/命令面板「**生成解决方案**」或「生成项目」（也会在构建输出目录 bin 子目录产出 `.dll` + 导入库 `.lib`，并同步生成 `ConfigurationType=DynamicLibrary` 的可复制 VS 工程）。
- `.lcpp` 里用访问修饰符节控制导出面：

  ```lcpp
  类 库窗口 : 窗口
  公开
    整数型 加法计算(整数型 被加数, 整数型 加数)
      局部 整数型 合计 = 0
      合计 = 被加数 + 加数
      返回 合计
    结束
  私有
    整数型 内部翻倍(整数型 输入值)
      返回 输入值 * 2
    结束
  结束类
  ```

  导出口径（确定性，无开关）：**仅「公开」节里的子程序（方法）导出**；事件处理器、构造/析构、私有/保护成员一律不导出。
- 生成的 DLL：不生成 `wWinMain` 与消息循环，改生成 `DllMain` + 首次调用时惰性运行时初始化（COM/GDI+/通用控件/窗口类注册，与 EXE 模式 wWinMain 同一套初始化）；每个公开子程序生成 `extern "C" __declspec(dllexport)` 包装，经窗口类单例转发——文本参数形如 `const wchar_t*`、文本返回经 DLL 侧 `thread_local` 缓冲以 `const wchar_t*` 交出（见第 2 节 ABI 关键说明）。动态库定位为**逻辑库**：不会自动创建设计器窗口。
- 产物：`<产物名>.dll` + 同名导入库 `.lib`（日志行「项目自定义 EXE 文件名：XXX.dll」）；Visual Studio 导出工程的 `ConfigurationType` 同步为 `DynamicLibrary`（强制 /MD）。

### 2. 双架构生成

构建管线按编译器环境决定位数；x64 默认工具链产出 x64，加 `--arch win32`（CLI）经 x86 vcvars 产出真正的 32 位。两种各构建一次，把两次的 `.dll`/`.lib` 分别放进模块 `bin/{Win32,x64}`、`lib/{Win32,x64}`（用 `dumpbin -exports` 或 PE 头 `machine` 字段核对位数：`0x14c`=Win32、`0x8664`=x64）。

### 3. 封装成模块

与第三节完全一致：头文件手写与导出包装一致的 `extern "C"` 声明（文本参数用 `std::wstring`），migrate-cpp 配置里 `runtimeName` 填公开子程序名，双 target 补齐。示例配置：`examples/dll-lib-demo/migrate-projectdll.json`。

### 4. 消费项目

正常启用模块、调用中文命令即可。闭环验收（示例已实测）：消费项目构建后 exe 同目录有 `ProjectMathDll.dll`，运行输出「项目_加法计算(2,3)=5，项目_取字符数(灵码LingBuilder)=13，项目_两点距离计算(0,0,3,4)=5」。

## 五、常见校验诊断对照

| 诊断 | 原因 | 处理 |
| --- | --- | --- |
| `不能跨 DLL 边界的类型 "..."` | 公开子程序签名含 控件/数组/记录/未知类型 | 改为基础类型签名，或该子程序改为私有 |
| `已在窗口类"X"中导出…同名子程序不能重复导出` | 多窗口类导出同名公开方法 | 重命名，或其一改为私有 |
| `当前项目没有可导出的"公开"子程序` | 没有任何公开方法（警告，不阻断） | 需要导出就加公开节 |
| `动态库输出当前仅支持标准 Win32 后端` | new_emoji 窗口项目请求 DLL 输出 | new_emoji 项目保持 EXE 模式 |
| `需要 MSVC/Visual Studio Build Tools 链接 .lib` | 检测到 g++/clang++ | 安装 MSVC 后重试 |
| `未提供兼容目标 windows-msvc-win32` | 模块缺该架构 target | 补齐双架构 target 与真实产物 |
| C3861 找不到标识符（生成代码里） | 模块没被正确启用，或 target 缺 headers | 检查 project-modules.json 与 targets[].headers |

## 六、边界与待办

- **F5「生成并运行」对 DLL 项目失效**（按钮禁用 + 服务端护栏）；IDE 内编译走「生成解决方案 / 生成项目」，产物与 AI Bridge 构建一致。
- DLL 项目内调用会创建窗口/依赖消息循环的命令没有运行环境（无消息泵）；动态库定位为纯逻辑库。
- 跨 DLL 传 `std::wstring` 要求两侧同为 MSVC 同 CRT（/MD）；不要把 VS 版本差异很大的 DLL/EXE 混用。
- 欢迎页「Windows 平台 DLL 开发」的 `windows-dll` 模板项目（C ABI + .def 手工维护）与本文的中文项目 `outputType: "dll"` 是两条独立路径，不要混用。
- 需要「DLL 不落盘、随 EXE 单文件分发」时用第三条路径：项目 DLL 命令声明加一行 `加载方式 = 内存`（DLL 以 RCDATA 内嵌进 EXE，运行期手工 PE 映射），需启用「内存加载DLL模块」；限制与完整示例见 `electron/docs/modules/memorydll/README.md` 与 `examples/memory-dll-demo/README.md`。封装成 .lbmod 模块的第三方 DLL 目前仍走同目录加载。
