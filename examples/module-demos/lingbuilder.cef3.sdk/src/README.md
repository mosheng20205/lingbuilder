# CEF3 内核SDK包 (x64)完整演示

- 模块 ID：`lingbuilder.cef3.sdk`
- 版本：`150.0.14+g7c1aa68+chromium-150.0.7871.129`
- 类型：外置/资产模块
- 命令数：0
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

CEF3（Chromium Embedded Framework）内核 SDK 离线载体模块（x64）：内含头文件、libcef.lib、预编译 /MD libcef_dll_wrapper.lib、全部运行时 DLL（含 v8_context_snapshot.bin、GPU/软渲染组件）与资源文件。安装后 CEF3浏览器模块（lingbuilder.cef3.browser）构建时自动从本模块发现 SDK，用户免下载、免 CMake、免编译。本模块只承载二进制资产，不提供中文命令或设计器控件，无需为项目单独启用。

## 命令清单

该模块不公开 LCPP 命令，是由其它模块自动消费的 SDK/二进制资产载体。
