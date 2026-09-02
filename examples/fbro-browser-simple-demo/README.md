# FBro 浏览器简单示例

这是一个最小的 FBro 指纹浏览器模块示例：窗口创建后自动加载 `https://example.com`，页面加载完成时读取网页标题和当前地址并写入调试输出。

## 示例内容

- 模块：`lingbuilder.fbro.browser`（FBro 指纹浏览器模块）+ `lingbuilder.fbro.events`（FBro 事件模块）
- 控件：一个 `FBroBrowser` 控件，名称为 `浏览器1`
- 中文代码：`FBro_导航`、`FBro_绑定事件`、`FBro_是否加载中`、`FBro_执行JS`、`FBro_取地址`
- `浏览器1` 是裸 `controlRef`，不要写成 `"浏览器1"`
- 事件处理器引用使用 `&处理器名`
- 设计器已把“加载状态改变”绑定到 `浏览器1_加载状态改变`，因此源码事件不会被诊断为“尚未在设计器中绑定”。

## 打开与运行

在 LingBuilder 中打开本目录（入口为 `src/.lingbuilder/solution.json`），进入设计器后应看到名为“浏览器1”的 FBro 浏览器控件。确认已安装 FBro 135 x64 SDK，然后运行项目。也可以使用仓库内的 `build-request.json` 进行受控构建：

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/fbro-browser-simple-demo/build-request.json --workspace ../examples/fbro-browser-simple-demo --yes --json
```

FBro 运行时依赖 Windows、MSVC、CEF 135 x64 以及有效的 FBro SDK。首次构建前可按 `electron/docs/modules/fbro/README.md` 安装 SDK。示例使用 `example.com`，便于离线或网络受限环境下快速确认控件是否正常创建；页面无法访问时仍会在调试输出中看到导航状态。

## 预期输出

页面加载结束后，调试输出应包含类似内容：

```text
FBro 页面标题：Example Domain
FBro 当前地址：https://example.com/
```
