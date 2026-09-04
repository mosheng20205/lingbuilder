# FBro 多浏览器分组框示例

这个示例在三个分组框中分别嵌入一个 `FBroBrowser`，用于演示同一窗口内多个 FBro 实例的创建、导航和加载事件。

## 示例内容

- 模块：`lingbuilder.win32.basic`、`lingbuilder.fbro.browser`、`lingbuilder.fbro.events`
- 容器：三个 `GroupBox` 分组框
- 浏览器：`浏览器1`、`浏览器2`、`浏览器3`
- 地址：`https://example.com`、`https://www.baidu.com`、`https://www.bing.com`
- 所有浏览器控件引用都是裸 `controlRef`，事件处理器使用 `&处理器名`。

在 LingBuilder 中打开 `src/.lingbuilder/solution.json`，确认已安装 FBro 135 x64 SDK 后运行项目。也可以使用受控构建请求：

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/fbro-multi-browser-demo/build-request.json --workspace ../examples/fbro-multi-browser-demo --yes --json
```

三个页面加载完成后，调试输出会分别记录浏览器标题和当前地址。
