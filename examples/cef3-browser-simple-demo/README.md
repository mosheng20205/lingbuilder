# CEF3 浏览器简单示例

这是一个最小的 CEF3 浏览器示例：窗口创建后自动加载 `https://example.com`，页面加载完成时把网页标题和当前地址写入调试输出。

## 示例内容

- 模块：`lingbuilder.cef3.browser`（已在 `.lingbuilder/project-modules.json` 中自动启用）
- 基础模块：`lingbuilder.win32.basic`
- 控件：一个 `CefBrowser` 控件，名称为 `浏览器1`
- 中文代码：`CEF3_绑定事件`、`CEF3_导航`、`CEF3_是否加载中`、`CEF3_执行JS`、`CEF3_取地址`
- `浏览器1` 是裸 `controlRef`，不要写成 `"浏览器1"`
- 事件处理器引用使用 `&处理器名`

## 打开与运行

在 LingBuilder 中通过工具栏“打开文件夹”选择本示例目录（不是其中的 `src/` 子目录）。项目内部解决方案位于示例根目录，并把 `src/` 作为源码根目录，进入设计器后应看到名为“浏览器1”的 CEF3 浏览器控件。示例已经自动引用 CEF3 浏览器模块，无需手工添加模块。

确认已安装 CEF3 SDK 后，可使用仓库内的 `build-request.json` 进行受控构建：

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/cef3-browser-simple-demo/build-request.json --workspace ../examples/cef3-browser-simple-demo --yes --json
```

CEF3 运行时依赖 Windows、MSVC、有效的 CEF3 SDK 及其资源文件。首次使用前可参考 `electron/docs/modules/cef3/README.md` 准备 SDK。

## 预期输出

页面加载结束后，调试输出应包含类似内容：

```text
CEF3 页面标题：Example Domain
CEF3 当前地址：https://example.com/
```
