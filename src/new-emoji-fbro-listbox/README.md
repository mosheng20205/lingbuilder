# new_emoji ListBox 三浏览器演示

本项目演示固定数量的 new_emoji ListBox 与 FBro 浏览器实例绑定：

- `browser-baidu` 对应 `百度浏览器`。
- `browser-bing` 对应 `必应浏览器`。
- `browser-github` 对应 `代码托管浏览器`。

ListBox 使用高级项目中的稳定 key。`SelectionChanged` 事件接收 `文本型 选中键列表`，源码先隐藏三个 FBro 宿主，再显示 key 对应的浏览器。切换过程不会销毁浏览器，因此页面状态和各自的缓存目录会保留。

项目启用 `lingbuilder.new_emoji.ui@2.0.0` 与 `lingbuilder.fbro.browser@2.2.0`，构建目标必须是 Windows、MSVC、x64。

在 IDE 中选择“new_emoji ListBox 三浏览器”后可直接按 F5。也可以从 `electron/` 运行：

```powershell
npm run smoke:new-emoji-fbro-listbox
```

该 smoke 会验证生成代码中的 ListBox 回调和三组 key 映射，执行 MSVC x64 Release 构建，确认三个 FBro 渲染实例实际启动，并自动点击第二、第三个表项检查可见宿主句柄依次切换且始终只有一个。

固定三个入口的展示型界面适合使用本项目的显式映射；需要动态增删任意数量实例时，应使用 `lingbuilder.new_emoji.fbro-shell` 的稳定 ID 集合，而不是继续增加固定设计器控件。
