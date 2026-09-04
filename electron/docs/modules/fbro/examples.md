# FBro 示例与故障排查

## 示例索引

- [FBro 浏览器简单示例](../../../../examples/fbro-browser-simple-demo/README.md)：单个浏览器、导航和加载状态事件。
- [FBro 多浏览器分组框示例](../../../../examples/fbro-multi-browser-demo/README.md)：三个 `GroupBox`，每个分组框承载一个 `FBroBrowser`。
- [FBro 模块命令演示](../../../../examples/module-demos/lingbuilder.fbro.browser/src/README.md)：按功能分组覆盖模块命令清单。

## 构建示例

在仓库根目录执行：

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/fbro-multi-browser-demo/build-request.json --workspace ../examples/fbro-multi-browser-demo --yes --json
```

构建前确认已生成 CLI（`npm run build:cli`）并安装 FBro 135 x64 SDK。示例默认使用 `in-process`；需要与 CEF3 共存时请把设计器中的三个浏览器都改成独立模式。

## 故障排查

### 页面空白或加载失败

检查 URL、网络代理、`enableJs`、`loadImages` 和缓存目录权限。通过 `FBro_取最近错误` 读取 Bridge 错误，并保留原始调试输出。

### 多个浏览器显示相同页面

确认每个控件的 `id`、`name` 和 `cacheDir` 唯一；不要在代码中把所有事件都绑定到同一个控件名。

### 控件参数被诊断为文本

控件参数必须是裸名称，例如 `FBro_取地址(浏览器1)`；带引号的旧写法会触发 `controlRef` 诊断。

### 独立模式无法启动

检查 `LingBuilderFbroBridge.dll`、Host 运行时文件、x64 架构和本机回环端口。Token 只由 IDE/Bridge 管理，不要写入启动命令行。

### VIP 命令返回未授权

确认凭据中心已配置用户自己的授权，并检查 `FBroVIP_取授权信息JSON()` 返回的脱敏状态。授权密钥不得进入源码或日志。
