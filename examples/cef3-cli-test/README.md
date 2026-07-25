# CEF3 多浏览器 CLI 测试

该项目由 LingBuilder AI Bridge CLI 的 `native.export` / `build.run` 闭环生成和验证，覆盖：

- 两个同时嵌入同一窗口的 CEF3 浏览器控件（`浏览器1`、`浏览器2`）。
- `.cef3/cache-1` 与 `.cef3/cache-2` 两个缓存目录配置（CEF3 单进程，实际以第一个控件配置作为全局 `cache_path`）。
- `加载完成` 与 `标题被改变` 到 `.lcpp` 无参数事件处理器的真实回调。
- `CEF3_导航`、`CEF3_取地址`、`CEF3_取标题` 等中文命令。

项目 ID 为 `cef3-cli-test`，模块引用保存在 `.lingbuilder/projects/cef3-cli-test/project-modules.json`（启用 `lingbuilder.win32.basic` 与 `lingbuilder.cef3.browser`）。

## 窗口模型

两个 `CefBrowser` 设计器控件并排放置在窗口中：

| 控件名 | 位置 | 打开地址 | 缓存目录 |
| --- | --- | --- | --- |
| 浏览器1 | (10, 10) 560×560 | https://www.baidu.com | `.cef3/cache-1` |
| 浏览器2 | (590, 10) 560×560 | https://www.bing.com | `.cef3/cache-2` |

## 构建与运行

```bash
cd electron
node dist/cli.cjs ai-server --workspace .. --port 18457 --permission preview --token <token>
```

然后调用 `POST /api/ai-bridge/build/run`，请求体传入 `project`（含两个 CefBrowser 控件的窗口模型）、`activeWindowId`、`lingCppSourceCode` 与 `approved=true`。

## CEF3 SDK 准备

**推荐方式（免下载免编译）**：安装 CEF3 内核 SDK 离线模块包 `cef3-sdk-x64.lbmod`（模块 ID `lingbuilder.cef3.sdk`，含预编译 /MD wrapper），或在本仓库用 `cd electron && npm run module:cef3-sdk -- --install` 直接生成并安装。该模块无需为项目启用，安装即生效。

手动方式：构建链路从以下位置受控发现 CEF3 SDK：

1. `CEF3_SDK_ROOT` 环境变量
2. 工作区 `.lingbuilder/cef3-sdk` 目录
3. 已安装 SDK 模块 `.lingbuilder/modules/lingbuilder.cef3.sdk/sdk`
4. `C:\cef3-sdk`

SDK 支持两种目录布局：

1. **CEF 官方二进制发行包（推荐，已验证 150.0.14 x64）**：直接把解压后的 `cef_binary_*_windows64` 内容放入 SDK 目录：

   ```text
   <cef3-sdk>/
     include/                 # cef_app.h 等头文件
     Release/                 # libcef.lib、libcef.dll、chrome_elf.dll、v8_context_snapshot.bin 等
     Resources/               # icudtl.dat、*.pak、locales/
     libcef_dll/              # wrapper 源码（首次构建时由 CMake 自动编译）
     CMakeLists.txt
   ```

   首次构建时链路会自动用 CMake（Visual Studio 2022 自带即可）编译 `libcef_dll_wrapper.lib` 到 `build_wrapper_<架构>_md/`，仅一次；编译前会把 `project(cef)` 自动改为 `project(cef LANGUAGES CXX)`（规避部分 VS 自带 CMake 在 C 语言工具查找阶段崩溃），并使用 `-DCEF_RUNTIME_LIBRARY_FLAG=/MD` 与 LingBuilder 编译链的动态 CRT 保持一致（否则链接报 LNK2038）。

2. **预编译平铺布局**：

   ```text
   <cef3-sdk>/
     include/            # cef_app.h 等头文件
     lib/Win32/          # libcef.lib、libcef_dll_wrapper.lib
     lib/x64/
     bin/Win32/          # libcef.dll、chrome_elf.dll、v8_context_snapshot.bin 等
     bin/x64/
     Resources/          # CEF 资源文件
   ```

缺少 SDK 时构建会给出中文诊断并优雅降级：exe 正常编译运行，但 CEF3 控件区域为空白占位。链接 `.lib` 需要 MSVC / Visual Studio Build Tools。CEF 150 要求 C++20 与 x64（优先）构建。

## 验收

- exe 同目录应存在 `libcef.dll`、`chrome_elf.dll`、`v8_context_snapshot.bin` 和 CEF 资源文件（SDK 就绪时由构建链路复制；`v8_context_snapshot.bin` 缺失会导致渲染进程无法启动、浏览器白屏）。
- 启动后两个浏览器区域分别加载百度与必应（2026-07-26 已用 CEF 150.0.14 x64 真实验证通过）。
- 调试输出包含两个实例的 `加载完成` 回调与地址、标题日志。
