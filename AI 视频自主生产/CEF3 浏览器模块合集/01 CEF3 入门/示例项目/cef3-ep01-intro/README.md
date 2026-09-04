# CEF3 入门

本项目演示启用 CEF3 模块、创建 `CefBrowser` 控件并绑定加载完成事件。`浏览器1` 是裸 `controlRef`，处理器引用必须使用 `&`。

前置条件：Windows x64、Visual Studio/MSVC、已安装并校验通过的 CEF3 SDK 及运行时资源。准备好本地页面后，可在创建完毕事件中使用 `CEF3_导航(浏览器1, "file:///绝对路径")`；本示例默认保持 `about:blank`。

构建命令：

```powershell
cd electron
node dist/cli.cjs project build --request "../AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro/build-request.json" --workspace "../AI 视频自主生产/CEF3 浏览器模块合集/01 CEF3 入门/示例项目/cef3-ep01-intro" --yes --json
```

预期结果：诊断中的“错误列表”为 0；配置本地页面后运行窗口可见网页内容。
