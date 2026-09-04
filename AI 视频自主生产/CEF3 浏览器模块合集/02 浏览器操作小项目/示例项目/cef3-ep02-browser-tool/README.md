# CEF3 浏览器操作小项目

使用地址栏和操作按钮练习导航、历史、刷新、停止、缩放、JavaScript、标题与地址读取。所有控件参数均使用裸 `controlRef`，处理器引用使用 `&` 绑定。

前置条件：Windows x64、Visual Studio/MSVC 和已安装校验的 CEF3 SDK。构建命令：

```powershell
cd electron
node dist/cli.cjs project build --request "../AI 视频自主生产/CEF3 浏览器模块合集/02 浏览器操作小项目/示例项目/cef3-ep02-browser-tool/build-request.json" --workspace "../AI 视频自主生产/CEF3 浏览器模块合集/02 浏览器操作小项目/示例项目/cef3-ep02-browser-tool" --yes --json
```

预期：错误列表为 0；导航到 `assets/pages/home.html` 与 `second.html` 后，可见页面、标题和地址变化。
