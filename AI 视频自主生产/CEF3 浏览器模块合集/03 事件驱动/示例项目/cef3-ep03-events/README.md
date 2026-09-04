# CEF3 事件驱动

绑定加载开始、加载完成、加载状态改变和加载错误，读取最近事件、事件数据及 `url` 字段。事件处理器引用统一使用 `&处理器名`，浏览器参数是裸 `controlRef`。

前置条件：Windows x64、Visual Studio/MSVC 和已安装校验的 CEF3 SDK。构建命令：

```powershell
cd electron
node dist/cli.cjs project build --request "../AI 视频自主生产/CEF3 浏览器模块合集/03 事件驱动/示例项目/cef3-ep03-events/build-request.json" --workspace "../AI 视频自主生产/CEF3 浏览器模块合集/03 事件驱动/示例项目/cef3-ep03-events" --yes --json
```

预期：错误列表为 0；加载 `assets/pages/events.html` 后，调试输出显示事件名称、事件数据和 URL 字段。
