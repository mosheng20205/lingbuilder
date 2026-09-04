# CEF3 多浏览器示例

本示例演示如何在同一个 Win32 窗口中使用两个 CEF3 浏览器实例，并用分组框（`GroupBox`）分别承载浏览器控件。

## 界面结构

- `左侧浏览器组`：承载 `浏览器1`，加载 `https://example.com`。
- `右侧浏览器组`：承载 `浏览器2`，加载 `https://www.baidu.com`。
- 两个浏览器使用独立缓存目录（`.cef3/multi-left`、`.cef3/multi-right`），便于验证实例隔离。

## 运行

1. 在 LingBuilder 中打开本示例根目录（不要只打开 `src/`）。
2. 确认已安装 CEF3 SDK 和 Windows MSVC x64 工具链。
3. 使用 `build-request.json` 执行受控构建，或在 IDE 中按 F5。

```powershell
cd electron
node dist/cli.cjs project build --request ../examples/cef3-browser-multi-demo/build-request.json --workspace ../examples/cef3-browser-multi-demo --yes --json
```

示例源码中的 `浏览器1`、`浏览器2` 是裸 `controlRef`，不能加引号；事件处理器引用使用 `&处理器名`。

## 预期输出

启动后两个分组框中都会出现独立浏览器页面。加载完成时，调试输出会分别打印浏览器实例名称和当前地址；点击窗口大小调整时，两个浏览器仍保持在各自分组框内。
