# New_Emoji 颜色选择器 ColorPicker 完整接口示例

这是 `lingbuilder.new_emoji.ui/ColorPicker` 的可运行源码演示项目。界面使用 4 个选项卡分组，保证颜色选择器的属性、专用 API 和事件都能在窗口内完整查看。

## 选项卡

- **基础读写**：颜色值、透明度、十六进制文本的同步/异步设置与读取；清空和是否有值。
- **面板状态**：展开/关闭、同步/异步状态读取、显示透明度、尺寸和可清空选项的读写；页面同时展示小/默认/大三种设计器尺寸。
- **调色板**：写入 6 色调色板并读取调色板数量。
- **事件监听**：数值变化、鼠标进入/离开/按下/抬起/双击/移动/滚轮、获得焦点和失去焦点。

源码按钮中的 `@` 语句直接调用模块导出的 `EU_*` C++ ABI；设计器创建颜色选择器并自动注册事件回调。工程启用 `lingbuilder.new_emoji.ui`、`lingbuilder.win32.basic` 和 `lingbuilder.win32.common-controls`（TabControl 容器），需要 MSVC/Visual Studio Build Tools。

## 接口覆盖

| 类别 | 覆盖接口 |
| --- | --- |
| 创建与属性 | `EU_CreateColorPicker`；颜色值、透明度、展开面板、显示透明度、尺寸、可清空 |
| 颜色值 | `EU_SetColorPickerColor`、`EU_PostSetColorPickerColor`、`EU_GetColorPickerColor` |
| 透明度 | `EU_SetColorPickerAlpha`、`EU_GetColorPickerAlpha` |
| 十六进制 | `EU_SetColorPickerHex`、`EU_PostSetColorPickerHex`、`EU_GetColorPickerHex` |
| 面板状态 | `EU_SetColorPickerOpen`、`EU_PostSetColorPickerOpen`、`EU_GetColorPickerOpen` |
| 调色板 | `EU_SetColorPickerPalette`、`EU_GetColorPickerPaletteCount` |
| 选项与清空 | `EU_SetColorPickerOptions`、`EU_GetColorPickerOptions`、`EU_ClearColorPicker`、`EU_GetColorPickerHasValue` |
| 回调 | `EU_SetColorPickerChangeCallback`（由设计器事件绑定自动生成）及鼠标/焦点事件回调 |

源码包位于项目根目录 `exports/颜色选择器ColorPicker完整接口演示.lcpppkg`，可通过“文件 → 打开 LCPP 源码包…”导入。
