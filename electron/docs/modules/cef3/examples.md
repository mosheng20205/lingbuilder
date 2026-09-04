# CEF3 多浏览器示例与故障排查

本示例对应仓库中的 [`examples/cef3-browser-multi-demo`](../../../../examples/cef3-browser-multi-demo) 项目，演示在同一窗口中使用两个 `GroupBox` 分组框分别承载两个 CEF3 浏览器控件。完整项目包含窗口设计器模型、解决方案文件、构建请求和可复制的 `.lcpp` 源码。

## 示例结构

- `浏览器组1` 和 `浏览器组2` 是两个 `GroupBox` 分组框。
- 每个分组框内放置一个 `CEF3浏览器` 控件，控件引用使用裸 `controlRef`，例如 `浏览器1`，不能写成字符串。
- 两个实例分别使用独立的缓存目录，便于验证会话、Cookie 和页面状态隔离。
- 示例同时绑定“加载完成”和“加载状态改变”事件，展示 `&处理器名` 回调引用写法。

## 运行示例

1. 在 IDE 中打开 `examples/cef3-browser-multi-demo` 根目录。
2. 确认已安装 CEF3 SDK 资源模块和 Windows MSVC x64 工具链。
3. 按 F5，或执行受控构建：

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/cef3-browser-multi-demo/build-request.json --workspace ../examples/cef3-browser-multi-demo --yes --json
```

## 常见问题

- **找不到 SDK**：按 `platform.md` 的顺序检查 `CEF3_SDK_ROOT`、工作区 `.lingbuilder/cef3-sdk`、`lingbuilder.cef3.sdk` 资源模块和 `C:\cef3-sdk`。
- **控件引用诊断**：`CEF3_创建`、`CEF3_绑定事件` 等参数必须传设计器控件的裸名称；带引号会触发 `controlRef` 诊断。
- **回调没有触发**：处理器参数必须使用 `&浏览器1_加载完成` 形式，并确认事件名称与模块事件目录一致。
- **页面状态串联**：检查两个浏览器的缓存目录是否配置为不同路径，不要复用同一个 Profile。

## 可复制源码

模块示例列表中的源码入口为 [`CEF3多浏览器窗体.lcpp`](examples/CEF3多浏览器窗体.lcpp)。它与仓库示例项目中的同名源文件保持同步；修改示例时应同时更新项目文件和本目录的模块文档资源。
