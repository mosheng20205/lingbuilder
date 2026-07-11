# EdgeView CLI 多实例测试

该项目由 LingBuilder AI Bridge CLI 的 `native.export` / `build.run` 闭环生成和验证，覆盖：

- 两个同时嵌入窗口的 EdgeView 实例。
- `edgeview-cache/cache-1` 与 `edgeview-cache/cache-2` 两个独立 WebView2 User Data Folder。
- 分实例执行 JavaScript 并读取 JSON 返回值。
- `导航完成` 与 `网页消息` 到 `.lcpp` 无参数事件处理器的真实回调。

项目 ID 为 `edgeview-cli-test`，模块引用保存在 `.lingbuilder/projects/edgeview-cli-test/project-modules.json`。运行前需要恢复 `Microsoft.Web.WebView2` NuGet 包并安装 WebView2 Runtime；LingBuilder 构建链路会自动复制 SDK 头文件与匹配架构的 `WebView2Loader.dll`。
