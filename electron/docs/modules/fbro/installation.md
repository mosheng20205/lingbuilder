# FBro SDK 安装与环境检查

## 运行要求

- Windows x64。
- Visual Studio 2022 的 MSVC x64 工具链和 Windows SDK。
- FBro/FBrowser CEF 135 x64 SDK。
- 项目启用 `lingbuilder.fbro.browser`；事件回调通常同时启用 `lingbuilder.fbro.events`。

FBro 进程内模式与 CEF3 的 CEF 150 ABI 不兼容。如果同一项目还使用 CEF3，所有 FBro 控件必须改为 `independent-embedded` 或 `independent-window`。

## SDK 与 Bridge 资产

FBro 模块使用以下资产：

- `include/LingBuilderFbroBridge.h`
- `include/LingBuilderFbroProcessRuntime.hpp`
- `modules/lingbuilder.fbro.browser/lib/x64/LingBuilderFbroBridge.lib`
- `bin/x64/LingBuilderFbroBridge.dll`

应用代码只应包含 Bridge 头文件并链接导入库，不得直接传递或释放 FBro/CEF 对象、STL、`CefRefPtr` 或裸指针。

## 首次检查

1. 在 IDE 的模块管理中确认 `lingbuilder.fbro.browser` 版本为 2.4.x，并确认目标为 `windows-msvc-x64`。
2. 检查模块目录中存在上述头文件、导入库和 DLL。
3. 选择 x64/Debug 或 x64/Release 构建配置。
4. 先运行原生依赖检查，再执行 F5；不要把 SDK 文件复制到项目源码目录。
5. 若使用 VIP 指纹能力，在 IDE 凭据中心配置自己的授权；不要将密钥写入 `.lcpp`、模块包、日志或 AI 上下文。

## 常见诊断

- 找不到 `LingBuilderFbroBridge.lib`：检查模块是否安装完整，以及构建架构是否误选为 Win32。
- 找不到 `LingBuilderFbroBridge.dll`：重新安装模块运行时资产，确认 DLL 与 exe 位数一致。
- 创建浏览器失败：先确认 FBro SDK 版本、MSVC 运行库和缓存目录可写。
- 与 CEF3 冲突：将全部 FBro 控件切换到独立进程模式，避免在主程序目录混用 CEF 运行时。
