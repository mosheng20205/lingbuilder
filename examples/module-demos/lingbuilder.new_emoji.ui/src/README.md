# new_emoji 原生界面库完整演示

- 模块 ID：`lingbuilder.new_emoji.ui`
- 版本：`1.0.0`
- 类型：外置/资产模块
- 命令数：1599
- 设计器控件数：92
- 分组数：12

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL，提供中文/emoji 友好的原生控件能力。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `NE_创建窗口` | `NE_创建窗口(标题, X, Y, 宽度, 高度)` | handle | 创建 new_emoji 原生窗口。 |
| 2 | `NE_创建深色窗口` | `NE_创建深色窗口(标题, X, Y, 宽度, 高度)` | handle | 创建 new_emoji 深色原生窗口。 |
| 3 | `NE_显示窗口` | `NE_显示窗口(窗口句柄, 是否显示)` | void | 显示或隐藏 new_emoji 窗口。 |
| 4 | `NE_显示并激活窗口` | `NE_显示并激活窗口(窗口句柄)` | void | 恢复、显示并激活 new_emoji 窗口。 |
| 5 | `NE_运行消息循环` | `NE_运行消息循环()` | int | 运行 new_emoji Win32 消息循环。 |
| 6 | `NE_销毁窗口` | `NE_销毁窗口(窗口句柄)` | void | 销毁 new_emoji 窗口。 |
| 7 | `NE_创建容器` | `NE_创建容器(窗口句柄, 父元素ID, X, Y, 宽度, 高度)` | int | 创建 new_emoji 容器。 |
| 8 | `NE_创建文本` | `NE_创建文本(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 文本元素。 |
| 9 | `NE_创建按钮` | `NE_创建按钮(窗口句柄, 父元素ID, 表情, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 按钮。 |
| 10 | `NE_创建编辑框` | `NE_创建编辑框(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 编辑框。 |
| 11 | `NE_创建复选框` | `NE_创建复选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)` | int | 创建 new_emoji 复选框。 |
| 12 | `NE_创建单选框` | `NE_创建单选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)` | int | 创建 new_emoji 单选框。 |
| 13 | `NE_创建列表框` | `NE_创建列表框(窗口句柄, 父元素ID, 标题, 项目文本, 默认选中项, X, Y, 宽度, 高度)` | int | 创建 new_emoji 列表框，项目文本使用 \| 分隔。 |
| 14 | `NE_创建图片` | `NE_创建图片(窗口句柄, 父元素ID, 图片源, 替代文本, 填充方式, X, Y, 宽度, 高度)` | int | 创建 new_emoji 图片，填充方式 0-4 依次为 contain、cover、fill、none、scale-down。 |
| 15 | `NE_创建进度条` | `NE_创建进度条(窗口句柄, 父元素ID, 文本, 进度值, X, Y, 宽度, 高度)` | int | 创建 new_emoji 进度条。 |
| 16 | `NE_创建上传` | `NE_创建上传(窗口句柄, 父元素ID, 标题, 提示, 初始文件, X, Y, 宽度, 高度)` | int | 创建 new_emoji 文件上传组件。 |
| 17 | `NE_设置上传选项` | `NE_设置上传选项(窗口句柄, 元素ID, 允许多选, 自动上传, 样式, 显示文件列表, 显示提示, 显示操作, 允许拖拽, 文件数量上限, 单文件上限KB, 允许文件类型)` | void | 设置上传组件的选择、显示、拖拽和文件限制。 |
| 18 | `NE_打开上传文件选择` | `NE_打开上传文件选择(窗口句柄, 元素ID)` | int | 打开上传组件的系统文件选择对话框。 |
| 19 | `NE_开始上传` | `NE_开始上传(窗口句柄, 元素ID, 文件索引)` | int | 触发上传组件指定文件的上传操作。 |
| 20 | `NE_清空上传文件` | `NE_清空上传文件(窗口句柄, 元素ID)` | void | 清空上传组件文件列表。 |
| 21 | `NE_取上传文件数量` | `NE_取上传文件数量(窗口句柄, 元素ID)` | int | 返回上传组件当前文件数量。 |
| 22 | `NE_取最近上传选择文件` | `NE_取最近上传选择文件()` | wideString | 在上传事件中返回最近选择或拖入的文件路径，多个路径以 \| 分隔。 |
| 23 | `NE_取最近上传动作` | `NE_取最近上传动作()` | int | 在上传操作事件中返回动作编号。 |
| 24 | `NE_取最近上传文件索引` | `NE_取最近上传文件索引()` | int | 在上传操作事件中返回文件索引。 |
| 25 | `NE_取最近上传进度值` | `NE_取最近上传进度值()` | int | 在上传操作事件中返回进度或动作附加值。 |
| 26 | `NE_设置窗口标题` | `NE_设置窗口标题(窗口句柄, 标题)` | void | 设置 new_emoji 窗口标题。 |
| 27 | `NE_EU_CreateWindow` | `NE_EU_CreateWindow(title_bytes, title_len, x, y, w, h, titlebar_color)` | handle | new_emoji 原生界面库 底层导出 EU_CreateWindow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 28 | `NE_EU_CreateWindowEx` | `NE_EU_CreateWindowEx(title_bytes, title_len, x, y, w, h, titlebar_color, frame_flags)` | handle | new_emoji 原生界面库 底层导出 EU_CreateWindowEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 29 | `NE_EU_CreateWindowDark` | `NE_EU_CreateWindowDark(title_bytes, title_len, x, y, w, h, titlebar_color)` | handle | new_emoji 原生界面库 底层导出 EU_CreateWindowDark。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 30 | `NE_EU_CreatePreviewChildWindow` | `NE_EU_CreatePreviewChildWindow(parent_hwnd, title_bytes, title_len, x, y, w, h, titlebar_color, frame_flags, preview_flags)` | handle | new_emoji 原生界面库 底层导出 EU_CreatePreviewChildWindow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 31 | `NE_EU_DestroyWindow` | `NE_EU_DestroyWindow(hwnd)` | void | new_emoji 原生界面库 底层导出 EU_DestroyWindow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 32 | `NE_EU_ShowWindow` | `NE_EU_ShowWindow(hwnd, visible)` | void | new_emoji 原生界面库 底层导出 EU_ShowWindow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 33 | `NE_EU_RunMessageLoop` | `NE_EU_RunMessageLoop()` | int | new_emoji 原生界面库 底层导出 EU_RunMessageLoop。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 34 | `NE_EU_ShowEmojiPicker` | `NE_EU_ShowEmojiPicker(owner_hwnd, current_bytes, current_len, recent_path_bytes, recent_path_len, out_bytes, out_size)` | int | new_emoji 原生界面库 底层导出 EU_ShowEmojiPicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 35 | `NE_EU_PreviewReset` | `NE_EU_PreviewReset(hwnd)` | void | new_emoji 原生界面库 底层导出 EU_PreviewReset。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 36 | `NE_EU_PreviewHitTest` | `NE_EU_PreviewHitTest(hwnd, x, y)` | int | new_emoji 原生界面库 底层导出 EU_PreviewHitTest。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 37 | `NE_EU_PreviewSetSelection` | `NE_EU_PreviewSetSelection(hwnd, ids, count, primary_id)` | void | new_emoji 原生界面库 底层导出 EU_PreviewSetSelection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 38 | `NE_EU_PreviewSetDropTarget` | `NE_EU_PreviewSetDropTarget(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_PreviewSetDropTarget。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 39 | `NE_EU_SetWindowTitle` | `NE_EU_SetWindowTitle(hwnd, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 40 | `NE_EU_SetWindowIcon` | `NE_EU_SetWindowIcon(hwnd, path_bytes, path_len)` | int | new_emoji 原生界面库 底层导出 EU_SetWindowIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 41 | `NE_EU_SetWindowIconFromBytes` | `NE_EU_SetWindowIconFromBytes(hwnd, icon_bytes, icon_len)` | int | new_emoji 原生界面库 底层导出 EU_SetWindowIconFromBytes。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 42 | `NE_EU_SetWindowBounds` | `NE_EU_SetWindowBounds(hwnd, x, y, w, h)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowBounds。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 43 | `NE_EU_GetWindowBounds` | `NE_EU_GetWindowBounds(hwnd, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_GetWindowBounds。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 44 | `创建面板` | `创建面板(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePanel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 45 | `创建按钮` | `创建按钮(hwnd, parent_id, emoji_bytes, emoji_len, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateButton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 46 | `创建兼容编辑内核` | `创建兼容编辑内核(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateEditBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 47 | `创建信息框` | `创建信息框(hwnd, parent_id, title_bytes, title_len, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInfoBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 48 | `创建文本` | `创建文本(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 49 | `创建链接` | `创建链接(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLink。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 50 | `创建图标` | `创建图标(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 51 | `创建工具栏图标按钮` | `创建工具栏图标按钮(hwnd, parent_id, icon_bytes, icon_len, tooltip_bytes, tooltip_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateIconButton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 52 | `创建地址栏` | `创建地址栏(hwnd, parent_id, value_bytes, value_len, placeholder_bytes, placeholder_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateOmnibox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 53 | `创建浏览内容占位区` | `创建浏览内容占位区(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBrowserViewport。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 54 | `创建间距` | `创建间距(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSpace。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 55 | `创建容器套件` | `创建容器套件(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateContainer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 56 | `创建顶栏` | `创建顶栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateHeader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 57 | `创建侧边栏` | `创建侧边栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAside。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 58 | `创建主要区域` | `创建主要区域(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMain。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 59 | `创建底栏` | `创建底栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateFooter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 60 | `创建布局` | `创建布局(hwnd, parent_id, orientation, gap, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 61 | `创建边框` | `创建边框(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBorder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 62 | `创建复选框` | `创建复选框(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCheckbox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 63 | `NE_EU_CreateCheckboxGroup` | `NE_EU_CreateCheckboxGroup(hwnd, parent_id, items_bytes, items_len, checked_bytes, checked_len, style_mode, size, group_disabled, min_checked, max_checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCheckboxGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 64 | `创建单选框` | `创建单选框(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRadio。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 65 | `NE_EU_CreateRadioGroup` | `NE_EU_CreateRadioGroup(hwnd, parent_id, items_bytes, items_len, value_bytes, value_len, style_mode, size, group_disabled, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRadioGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 66 | `创建开关` | `创建开关(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSwitch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 67 | `创建滑块` | `创建滑块(hwnd, parent_id, text_bytes, text_len, min_value, max_value, value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSlider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 68 | `创建数字输入框` | `创建数字输入框(hwnd, parent_id, text_bytes, text_len, value, min_value, max_value, step, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputNumber。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 69 | `创建输入框` | `创建输入框(hwnd, parent_id, text_bytes, text_len, placeholder_bytes, placeholder_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len, clearable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInput。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 70 | `创建组合输入` | `创建组合输入(hwnd, parent_id, value_bytes, value_len, placeholder_bytes, placeholder_len, size, clearable, password, show_word_limit, autosize, min_rows, max_rows, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 71 | `创建标签输入` | `创建标签输入(hwnd, parent_id, tags_bytes, tags_len, placeholder_bytes, placeholder_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputTag。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 72 | `创建选择器` | `创建选择器(hwnd, parent_id, text_bytes, text_len, options_bytes, options_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 73 | `创建虚拟选择器` | `创建虚拟选择器(hwnd, parent_id, text_bytes, text_len, options_bytes, options_len, selected_index, visible_count, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSelectV2。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 74 | `创建评分` | `创建评分(hwnd, parent_id, text_bytes, text_len, value, max_value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 75 | `创建颜色选择器` | `创建颜色选择器(hwnd, parent_id, text_bytes, text_len, value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateColorPicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 76 | `创建标签` | `创建标签(hwnd, parent_id, text_bytes, text_len, tag_type, effect, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTag。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 77 | `创建徽标` | `创建徽标(hwnd, parent_id, text_bytes, text_len, value_bytes, value_len, max_value, dot, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBadge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 78 | `创建进度条` | `创建进度条(hwnd, parent_id, text_bytes, text_len, percentage, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 79 | `创建头像` | `创建头像(hwnd, parent_id, text_bytes, text_len, shape, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAvatar。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 80 | `创建空状态` | `创建空状态(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateEmpty。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 81 | `创建骨架屏` | `创建骨架屏(hwnd, parent_id, rows, animated, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSkeleton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 82 | `创建描述列表` | `创建描述列表(hwnd, parent_id, title_bytes, title_len, items_bytes, items_len, columns, bordered, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDescriptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 83 | `创建表格` | `创建表格(hwnd, parent_id, columns_bytes, columns_len, rows_bytes, rows_len, striped, bordered, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 84 | `创建列表框` | `创建列表框(hwnd, parent_id, title_bytes, title_len, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateListBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 85 | `创建卡片` | `创建卡片(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, shadow, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCard。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 86 | `创建折叠面板` | `创建折叠面板(hwnd, parent_id, items_bytes, items_len, active_index, accordion, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCollapse。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 87 | `创建时间线` | `创建时间线(hwnd, parent_id, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimeline。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 88 | `创建统计数值` | `创建统计数值(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateStatistic。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 89 | `创建指标卡` | `创建指标卡(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateKpiCard。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 90 | `创建趋势` | `创建趋势(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTrend。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 91 | `创建状态点` | `创建状态点(hwnd, parent_id, label_bytes, label_len, desc_bytes, desc_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateStatusDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 92 | `创建仪表盘` | `创建仪表盘(hwnd, parent_id, title_bytes, title_len, value, caption_bytes, caption_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateGauge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 93 | `创建环形进度` | `创建环形进度(hwnd, parent_id, title_bytes, title_len, value, label_bytes, label_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRingProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 94 | `创建子弹进度` | `创建子弹进度(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, value, target, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBulletProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 95 | `创建折线图` | `创建折线图(hwnd, parent_id, title_bytes, title_len, points_bytes, points_len, chart_style, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLineChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 96 | `创建柱状图` | `创建柱状图(hwnd, parent_id, title_bytes, title_len, bars_bytes, bars_len, orientation, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBarChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 97 | `创建环形图` | `创建环形图(hwnd, parent_id, title_bytes, title_len, slices_bytes, slices_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDonutChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 98 | `创建分割线` | `创建分割线(hwnd, parent_id, text_bytes, text_len, direction, content_position, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDivider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 99 | `创建日历` | `创建日历(hwnd, parent_id, year, month, selected_day, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCalendar。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 100 | `创建树` | `创建树(hwnd, parent_id, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTree。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 101 | `创建树选择` | `创建树选择(hwnd, parent_id, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTreeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 102 | `创建穿梭框` | `创建穿梭框(hwnd, parent_id, left_bytes, left_len, right_bytes, right_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTransfer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 103 | `创建自动补全` | `创建自动补全(hwnd, parent_id, value_bytes, value_len, suggestions_bytes, suggestions_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAutocomplete。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 104 | `创建提及` | `创建提及(hwnd, parent_id, value_bytes, value_len, suggestions_bytes, suggestions_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMentions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 105 | `创建级联选择` | `创建级联选择(hwnd, parent_id, options_bytes, options_len, selected_bytes, selected_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCascader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 106 | `创建日期选择器` | `创建日期选择器(hwnd, parent_id, year, month, selected_day, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDatePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 107 | `创建时间选择器` | `创建时间选择器(hwnd, parent_id, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 108 | `创建日期时间选择器` | `创建日期时间选择器(hwnd, parent_id, year, month, day, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDateTimePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 109 | `创建时间选择` | `创建时间选择(hwnd, parent_id, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 110 | `创建下拉菜单` | `创建下拉菜单(hwnd, parent_id, text_bytes, text_len, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDropdown。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 111 | `创建菜单` | `创建菜单(hwnd, parent_id, items_bytes, items_len, active_index, orientation, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMenu。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 112 | `创建锚点` | `创建锚点(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAnchor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 113 | `创建回到顶部` | `创建回到顶部(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBacktop。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 114 | `创建分段控制器` | `创建分段控制器(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSegmented。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 115 | `创建页头` | `创建页头(hwnd, parent_id, title_bytes, title_len, subtitle_bytes, subtitle_len, back_bytes, back_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePageHeader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 116 | `创建固钉` | `创建固钉(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, offset, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAffix。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 117 | `创建水印` | `创建水印(hwnd, parent_id, content_bytes, content_len, gap_x, gap_y, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateWatermark。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 118 | `创建漫游引导` | `创建漫游引导(hwnd, parent_id, steps_bytes, steps_len, active_index, open, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTour。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 119 | `创建图片` | `创建图片(hwnd, parent_id, src_bytes, src_len, alt_bytes, alt_len, fit, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateImage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 120 | `创建轮播` | `创建轮播(hwnd, parent_id, items_bytes, items_len, active_index, indicator_position, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCarousel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 121 | `创建上传` | `创建上传(hwnd, parent_id, title_bytes, title_len, tip_bytes, tip_len, files_bytes, files_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateUpload。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 122 | `创建无限滚动` | `创建无限滚动(hwnd, parent_id, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInfiniteScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 123 | `创建面包屑` | `创建面包屑(hwnd, parent_id, items_bytes, items_len, separator_bytes, separator_len, current_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBreadcrumb。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 124 | `创建标签页` | `创建标签页(hwnd, parent_id, items_bytes, items_len, active_index, tab_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTabs。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 125 | `创建分页` | `创建分页(hwnd, parent_id, total, page_size, current_page, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePagination。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 126 | `创建步骤条` | `创建步骤条(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSteps。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 127 | `创建警告提示` | `创建警告提示(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, alert_type, effect, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAlert。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 128 | `NE_EU_CreateAlertEx` | `NE_EU_CreateAlertEx(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, alert_type, effect, closable, show_icon, center, wrap_description, close_text_bytes, close_text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAlertEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 129 | `创建结果页` | `创建结果页(hwnd, parent_id, title_bytes, title_len, subtitle_bytes, subtitle_len, result_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 130 | `创建通知` | `创建通知(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, notify_type, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateNotification。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 131 | `创建加载` | `创建加载(hwnd, parent_id, text_bytes, text_len, active, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 132 | `创建对话框` | `创建对话框(hwnd, title_bytes, title_len, body_bytes, body_len, modal, closable, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDialog。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 133 | `NE_EU_SetDialogAdvancedOptions` | `NE_EU_SetDialogAdvancedOptions(hwnd, element_id, width_mode, width_value, center, footer_center, content_padding, footer_height)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 134 | `NE_EU_GetDialogAdvancedOptions` | `NE_EU_GetDialogAdvancedOptions(hwnd, element_id, width_mode, width_value, center, footer_center, content_padding, footer_height, content_parent_id, footer_parent_id, close_pending)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 135 | `NE_EU_GetDialogContentParent` | `NE_EU_GetDialogContentParent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogContentParent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 136 | `NE_EU_GetDialogFooterParent` | `NE_EU_GetDialogFooterParent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogFooterParent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 137 | `NE_EU_SetDialogBeforeCloseCallback` | `NE_EU_SetDialogBeforeCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogBeforeCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 138 | `NE_EU_ConfirmDialogClose` | `NE_EU_ConfirmDialogClose(hwnd, element_id, allow)` | void | new_emoji 原生界面库 底层导出 EU_ConfirmDialogClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 139 | `创建抽屉` | `创建抽屉(hwnd, title_bytes, title_len, body_bytes, body_len, placement, modal, closable, size)` | int | new_emoji 原生界面库 底层导出 EU_CreateDrawer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 140 | `创建文字提示` | `创建文字提示(hwnd, parent_id, label_bytes, label_len, content_bytes, content_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTooltip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 141 | `NE_EU_SetTooltipAdvancedOptions` | `NE_EU_SetTooltipAdvancedOptions(hwnd, element_id, placement, effect, disabled, show_arrow, offset, max_width)` | void | new_emoji 原生界面库 底层导出 EU_SetTooltipAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 142 | `NE_EU_GetTooltipAdvancedOptions` | `NE_EU_GetTooltipAdvancedOptions(hwnd, element_id, placement, effect, disabled, show_arrow, offset, max_width)` | int | new_emoji 原生界面库 底层导出 EU_GetTooltipAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 143 | `创建弹出框` | `创建弹出框(hwnd, parent_id, label_bytes, label_len, title_bytes, title_len, content_bytes, content_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePopover。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 144 | `NE_EU_SetPopoverAdvancedOptions` | `NE_EU_SetPopoverAdvancedOptions(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 145 | `NE_EU_SetPopoverBehavior` | `NE_EU_SetPopoverBehavior(hwnd, element_id, trigger_mode, close_on_outside, show_arrow, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 146 | `NE_EU_GetPopoverBehavior` | `NE_EU_GetPopoverBehavior(hwnd, element_id, trigger_mode, close_on_outside, show_arrow, offset)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 147 | `NE_EU_GetPopoverContentParent` | `NE_EU_GetPopoverContentParent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverContentParent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 148 | `创建气泡确认框` | `创建气泡确认框(hwnd, parent_id, label_bytes, label_len, title_bytes, title_len, content_bytes, content_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePopconfirm。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 149 | `NE_EU_SetPopconfirmAdvancedOptions` | `NE_EU_SetPopconfirmAdvancedOptions(hwnd, element_id, placement, open, popup_width, popup_height, trigger_mode, close_on_outside, show_arrow, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 150 | `NE_EU_SetPopconfirmIcon` | `NE_EU_SetPopconfirmIcon(hwnd, element_id, icon_bytes, icon_len, icon_color, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 151 | `NE_EU_GetPopconfirmIcon` | `NE_EU_GetPopconfirmIcon(hwnd, element_id, buffer, buffer_size, icon_color, visible)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 152 | `显示消息提示` | `显示消息提示(hwnd, text_bytes, text_len, message_type, closable, center, rich, duration_ms, offset)` | int | new_emoji 原生界面库 底层导出 EU_ShowMessage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 153 | `NE_EU_PostShowMessage` | `NE_EU_PostShowMessage(hwnd, text_bytes, text_len, message_type, closable, center, rich, duration_ms, offset)` | int | new_emoji 原生界面库 底层导出 EU_PostShowMessage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 154 | `NE_EU_ShowNotification` | `NE_EU_ShowNotification(hwnd, title_bytes, title_len, body_bytes, body_len, notify_type, closable, duration_ms, placement, offset, rich, w, h)` | int | new_emoji 原生界面库 底层导出 EU_ShowNotification。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 155 | `NE_EU_ShowMessageBox` | `NE_EU_ShowMessageBox(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cb)` | int | new_emoji 原生界面库 底层导出 EU_ShowMessageBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 156 | `NE_EU_ShowConfirmBox` | `NE_EU_ShowConfirmBox(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, cb)` | int | new_emoji 原生界面库 底层导出 EU_ShowConfirmBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 157 | `NE_EU_PostShowMessageBox` | `NE_EU_PostShowMessageBox(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cb)` | int | new_emoji 原生界面库 底层导出 EU_PostShowMessageBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 158 | `NE_EU_PostShowConfirmBox` | `NE_EU_PostShowConfirmBox(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, cb)` | int | new_emoji 原生界面库 底层导出 EU_PostShowConfirmBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 159 | `显示消息框` | `显示消息框(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, show_cancel, center, rich, distinguish_cancel_and_close, cb)` | int | new_emoji 原生界面库 底层导出 EU_ShowMessageBoxEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 160 | `NE_EU_PostShowMessageBoxEx` | `NE_EU_PostShowMessageBoxEx(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, show_cancel, center, rich, distinguish_cancel_and_close, cb)` | int | new_emoji 原生界面库 底层导出 EU_PostShowMessageBoxEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 161 | `NE_EU_ShowPromptBox` | `NE_EU_ShowPromptBox(hwnd, title_bytes, title_len, text_bytes, text_len, placeholder_bytes, placeholder_len, value_bytes, value_len, pattern_bytes, pattern_len, error_bytes, error_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, center, rich, distinguish_cancel_and_close, cb)` | int | new_emoji 原生界面库 底层导出 EU_ShowPromptBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 162 | `NE_EU_PostShowPromptBox` | `NE_EU_PostShowPromptBox(hwnd, title_bytes, title_len, text_bytes, text_len, placeholder_bytes, placeholder_len, value_bytes, value_len, pattern_bytes, pattern_len, error_bytes, error_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, center, rich, distinguish_cancel_and_close, cb)` | int | new_emoji 原生界面库 底层导出 EU_PostShowPromptBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 163 | `NE_EU_SetElementText` | `NE_EU_SetElementText(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetElementText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 164 | `NE_EU_PostSetElementText` | `NE_EU_PostSetElementText(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetElementText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 165 | `NE_EU_GetElementText` | `NE_EU_GetElementText(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetElementText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 166 | `NE_EU_SetElementBounds` | `NE_EU_SetElementBounds(hwnd, element_id, x, y, w, h)` | void | new_emoji 原生界面库 底层导出 EU_SetElementBounds。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 167 | `NE_EU_GetElementBounds` | `NE_EU_GetElementBounds(hwnd, element_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_GetElementBounds。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 168 | `NE_EU_SetElementVisible` | `NE_EU_SetElementVisible(hwnd, element_id, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetElementVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 169 | `NE_EU_GetElementVisible` | `NE_EU_GetElementVisible(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetElementVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 170 | `NE_EU_SetElementEnabled` | `NE_EU_SetElementEnabled(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetElementEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 171 | `NE_EU_GetElementEnabled` | `NE_EU_GetElementEnabled(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetElementEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 172 | `NE_EU_SetElementColor` | `NE_EU_SetElementColor(hwnd, element_id, bg, fg)` | void | new_emoji 原生界面库 底层导出 EU_SetElementColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 173 | `NE_EU_SetElementFont` | `NE_EU_SetElementFont(hwnd, element_id, font_bytes, font_len, size)` | void | new_emoji 原生界面库 底层导出 EU_SetElementFont。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 174 | `NE_EU_SetElementFontInt` | `NE_EU_SetElementFontInt(hwnd, element_id, font_bytes, font_len, size)` | void | new_emoji 原生界面库 底层导出 EU_SetElementFontInt。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 175 | `NE_EU_SetTextOptions` | `NE_EU_SetTextOptions(hwnd, element_id, align, valign, wrap, ellipsis)` | void | new_emoji 原生界面库 底层导出 EU_SetTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 176 | `NE_EU_GetTextOptions` | `NE_EU_GetTextOptions(hwnd, element_id, align, valign, wrap, ellipsis)` | int | new_emoji 原生界面库 底层导出 EU_GetTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 177 | `NE_EU_SetLinkOptions` | `NE_EU_SetLinkOptions(hwnd, element_id, type, underline, auto_open, visited)` | void | new_emoji 原生界面库 底层导出 EU_SetLinkOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 178 | `NE_EU_GetLinkOptions` | `NE_EU_GetLinkOptions(hwnd, element_id, type, underline, auto_open, visited)` | int | new_emoji 原生界面库 底层导出 EU_GetLinkOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 179 | `NE_EU_SetLinkContent` | `NE_EU_SetLinkContent(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len, href_bytes, href_len, target_bytes, target_len)` | void | new_emoji 原生界面库 底层导出 EU_SetLinkContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 180 | `NE_EU_GetLinkContent` | `NE_EU_GetLinkContent(hwnd, element_id, prefix_buffer, prefix_buffer_size, suffix_buffer, suffix_buffer_size, href_buffer, href_buffer_size, target_buffer, target_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetLinkContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 181 | `NE_EU_SetLinkVisited` | `NE_EU_SetLinkVisited(hwnd, element_id, visited)` | void | new_emoji 原生界面库 底层导出 EU_SetLinkVisited。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 182 | `NE_EU_GetLinkVisited` | `NE_EU_GetLinkVisited(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLinkVisited。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 183 | `NE_EU_SetIconOptions` | `NE_EU_SetIconOptions(hwnd, element_id, scale, rotation_degrees)` | void | new_emoji 原生界面库 底层导出 EU_SetIconOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 184 | `NE_EU_GetIconOptions` | `NE_EU_GetIconOptions(hwnd, element_id, scale, rotation_degrees)` | int | new_emoji 原生界面库 底层导出 EU_GetIconOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 185 | `NE_EU_SetPanelStyle` | `NE_EU_SetPanelStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | void | new_emoji 原生界面库 底层导出 EU_SetPanelStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 186 | `NE_EU_GetPanelStyle` | `NE_EU_GetPanelStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | int | new_emoji 原生界面库 底层导出 EU_GetPanelStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 187 | `NE_EU_SetPanelLayout` | `NE_EU_SetPanelLayout(hwnd, element_id, fill_parent, content_layout)` | void | new_emoji 原生界面库 底层导出 EU_SetPanelLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 188 | `NE_EU_GetPanelLayout` | `NE_EU_GetPanelLayout(hwnd, element_id, fill_parent, content_layout)` | int | new_emoji 原生界面库 底层导出 EU_GetPanelLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 189 | `NE_EU_SetContainerLayout` | `NE_EU_SetContainerLayout(hwnd, element_id, enabled, direction, gap)` | void | new_emoji 原生界面库 底层导出 EU_SetContainerLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 190 | `NE_EU_GetContainerLayout` | `NE_EU_GetContainerLayout(hwnd, element_id, enabled, direction, gap, actual_direction)` | int | new_emoji 原生界面库 底层导出 EU_GetContainerLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 191 | `NE_EU_SetContainerRegionTextOptions` | `NE_EU_SetContainerRegionTextOptions(hwnd, element_id, align, valign)` | void | new_emoji 原生界面库 底层导出 EU_SetContainerRegionTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 192 | `NE_EU_GetContainerRegionTextOptions` | `NE_EU_GetContainerRegionTextOptions(hwnd, element_id, align, valign, role)` | int | new_emoji 原生界面库 底层导出 EU_GetContainerRegionTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 193 | `NE_EU_SetLayoutOptions` | `NE_EU_SetLayoutOptions(hwnd, element_id, orientation, gap, stretch, align, wrap)` | void | new_emoji 原生界面库 底层导出 EU_SetLayoutOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 194 | `NE_EU_GetLayoutOptions` | `NE_EU_GetLayoutOptions(hwnd, element_id, orientation, gap, stretch, align, wrap)` | int | new_emoji 原生界面库 底层导出 EU_GetLayoutOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 195 | `NE_EU_SetLayoutChildWeight` | `NE_EU_SetLayoutChildWeight(hwnd, layout_id, child_id, weight)` | void | new_emoji 原生界面库 底层导出 EU_SetLayoutChildWeight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 196 | `NE_EU_GetLayoutChildWeight` | `NE_EU_GetLayoutChildWeight(hwnd, layout_id, child_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLayoutChildWeight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 197 | `NE_EU_SetBorderOptions` | `NE_EU_SetBorderOptions(hwnd, element_id, sides, color, width, radius, title_bytes, title_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBorderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 198 | `NE_EU_GetBorderOptions` | `NE_EU_GetBorderOptions(hwnd, element_id, sides, color, width, radius)` | int | new_emoji 原生界面库 底层导出 EU_GetBorderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 199 | `NE_EU_SetBorderDashed` | `NE_EU_SetBorderDashed(hwnd, element_id, dashed)` | void | new_emoji 原生界面库 底层导出 EU_SetBorderDashed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 200 | `NE_EU_GetBorderDashed` | `NE_EU_GetBorderDashed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBorderDashed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 201 | `NE_EU_SetInfoBoxText` | `NE_EU_SetInfoBoxText(hwnd, element_id, title_bytes, title_len, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInfoBoxText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 202 | `NE_EU_SetInfoBoxOptions` | `NE_EU_SetInfoBoxOptions(hwnd, element_id, type, closable, accent, icon_bytes, icon_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInfoBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 203 | `NE_EU_SetInfoBoxClosed` | `NE_EU_SetInfoBoxClosed(hwnd, element_id, closed)` | void | new_emoji 原生界面库 底层导出 EU_SetInfoBoxClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 204 | `NE_EU_GetInfoBoxClosed` | `NE_EU_GetInfoBoxClosed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInfoBoxClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 205 | `NE_EU_GetInfoBoxPreferredHeight` | `NE_EU_GetInfoBoxPreferredHeight(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInfoBoxPreferredHeight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 206 | `NE_EU_SetSpaceSize` | `NE_EU_SetSpaceSize(hwnd, element_id, w, h)` | void | new_emoji 原生界面库 底层导出 EU_SetSpaceSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 207 | `NE_EU_GetSpaceSize` | `NE_EU_GetSpaceSize(hwnd, element_id, w, h)` | int | new_emoji 原生界面库 底层导出 EU_GetSpaceSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 208 | `NE_EU_SetDividerOptions` | `NE_EU_SetDividerOptions(hwnd, element_id, direction, content_position, color, width, dashed, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDividerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 209 | `NE_EU_GetDividerOptions` | `NE_EU_GetDividerOptions(hwnd, element_id, direction, content_position, color, width, dashed)` | int | new_emoji 原生界面库 底层导出 EU_GetDividerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 210 | `NE_EU_SetDividerSpacing` | `NE_EU_SetDividerSpacing(hwnd, element_id, margin, gap)` | void | new_emoji 原生界面库 底层导出 EU_SetDividerSpacing。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 211 | `NE_EU_GetDividerSpacing` | `NE_EU_GetDividerSpacing(hwnd, element_id, margin, gap)` | int | new_emoji 原生界面库 底层导出 EU_GetDividerSpacing。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 212 | `NE_EU_SetDividerLineStyle` | `NE_EU_SetDividerLineStyle(hwnd, element_id, line_style)` | void | new_emoji 原生界面库 底层导出 EU_SetDividerLineStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 213 | `NE_EU_GetDividerLineStyle` | `NE_EU_GetDividerLineStyle(hwnd, element_id, line_style)` | int | new_emoji 原生界面库 底层导出 EU_GetDividerLineStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 214 | `NE_EU_SetDividerContent` | `NE_EU_SetDividerContent(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDividerContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 215 | `NE_EU_GetDividerContent` | `NE_EU_GetDividerContent(hwnd, element_id, icon_buffer, icon_buffer_size, text_buffer, text_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetDividerContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 216 | `NE_EU_SetButtonEmoji` | `NE_EU_SetButtonEmoji(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetButtonEmoji。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 217 | `NE_EU_SetButtonVariant` | `NE_EU_SetButtonVariant(hwnd, element_id, variant)` | void | new_emoji 原生界面库 底层导出 EU_SetButtonVariant。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 218 | `NE_EU_GetButtonState` | `NE_EU_GetButtonState(hwnd, element_id, pressed, focused, variant)` | int | new_emoji 原生界面库 底层导出 EU_GetButtonState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 219 | `NE_EU_SetButtonOptions` | `NE_EU_SetButtonOptions(hwnd, element_id, variant, plain, round, circle, loading, size)` | void | new_emoji 原生界面库 底层导出 EU_SetButtonOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 220 | `NE_EU_SetButtonStateColors` | `NE_EU_SetButtonStateColors(hwnd, element_id, hover_bg, hover_border, hover_fg, pressed_bg, pressed_border, pressed_fg)` | void | new_emoji 原生界面库 底层导出 EU_SetButtonStateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 221 | `NE_EU_GetButtonStateColors` | `NE_EU_GetButtonStateColors(hwnd, element_id, hover_bg, hover_border, hover_fg, pressed_bg, pressed_border, pressed_fg)` | int | new_emoji 原生界面库 底层导出 EU_GetButtonStateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 222 | `NE_EU_GetButtonOptions` | `NE_EU_GetButtonOptions(hwnd, element_id, variant, plain, round, circle, loading, size)` | int | new_emoji 原生界面库 底层导出 EU_GetButtonOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 223 | `NE_EU_SetEditBoxText` | `NE_EU_SetEditBoxText(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetEditBoxText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 224 | `NE_EU_PostSetEditBoxText` | `NE_EU_PostSetEditBoxText(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetEditBoxText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 225 | `NE_EU_SetEditBoxOptions` | `NE_EU_SetEditBoxOptions(hwnd, element_id, readonly, password, multiline, focus_border, placeholder_bytes, placeholder_len)` | void | new_emoji 原生界面库 底层导出 EU_SetEditBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 226 | `NE_EU_GetEditBoxOptions` | `NE_EU_GetEditBoxOptions(hwnd, element_id, readonly, password, multiline, focus_border)` | int | new_emoji 原生界面库 底层导出 EU_GetEditBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 227 | `NE_EU_GetEditBoxState` | `NE_EU_GetEditBoxState(hwnd, element_id, cursor, sel_start, sel_end, text_length)` | int | new_emoji 原生界面库 底层导出 EU_GetEditBoxState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 228 | `NE_EU_GetEditBoxText` | `NE_EU_GetEditBoxText(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetEditBoxText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 229 | `NE_EU_SetEditBoxScroll` | `NE_EU_SetEditBoxScroll(hwnd, element_id, scroll_y)` | void | new_emoji 原生界面库 底层导出 EU_SetEditBoxScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 230 | `NE_EU_GetEditBoxScroll` | `NE_EU_GetEditBoxScroll(hwnd, element_id, scroll_y, max_scroll_y, content_height, viewport_height)` | int | new_emoji 原生界面库 底层导出 EU_GetEditBoxScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 231 | `NE_EU_SetEditBoxTextCallback` | `NE_EU_SetEditBoxTextCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetEditBoxTextCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 232 | `NE_EU_SetElementFocus` | `NE_EU_SetElementFocus(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_SetElementFocus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 233 | `NE_EU_SetCheckboxChecked` | `NE_EU_SetCheckboxChecked(hwnd, element_id, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 234 | `NE_EU_PostSetCheckboxChecked` | `NE_EU_PostSetCheckboxChecked(hwnd, element_id, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCheckboxChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 235 | `NE_EU_GetCheckboxChecked` | `NE_EU_GetCheckboxChecked(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 236 | `NE_EU_SetCheckboxIndeterminate` | `NE_EU_SetCheckboxIndeterminate(hwnd, element_id, indeterminate)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxIndeterminate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 237 | `NE_EU_PostSetCheckboxIndeterminate` | `NE_EU_PostSetCheckboxIndeterminate(hwnd, element_id, indeterminate)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCheckboxIndeterminate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 238 | `NE_EU_GetCheckboxIndeterminate` | `NE_EU_GetCheckboxIndeterminate(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxIndeterminate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 239 | `NE_EU_SetCheckboxOptions` | `NE_EU_SetCheckboxOptions(hwnd, element_id, border, size)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 240 | `NE_EU_GetCheckboxOptions` | `NE_EU_GetCheckboxOptions(hwnd, element_id, border, size)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 241 | `NE_EU_SetCheckboxGroupItems` | `NE_EU_SetCheckboxGroupItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxGroupItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 242 | `NE_EU_PostSetCheckboxGroupItems` | `NE_EU_PostSetCheckboxGroupItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCheckboxGroupItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 243 | `NE_EU_SetCheckboxGroupValue` | `NE_EU_SetCheckboxGroupValue(hwnd, element_id, values_bytes, values_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 244 | `NE_EU_PostSetCheckboxGroupValue` | `NE_EU_PostSetCheckboxGroupValue(hwnd, element_id, values_bytes, values_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCheckboxGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 245 | `NE_EU_GetCheckboxGroupValue` | `NE_EU_GetCheckboxGroupValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 246 | `NE_EU_SetCheckboxGroupOptions` | `NE_EU_SetCheckboxGroupOptions(hwnd, element_id, group_disabled, style_mode, size, min_checked, max_checked)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 247 | `NE_EU_GetCheckboxGroupOptions` | `NE_EU_GetCheckboxGroupOptions(hwnd, element_id, group_disabled, style_mode, size, min_checked, max_checked)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 248 | `NE_EU_GetCheckboxGroupState` | `NE_EU_GetCheckboxGroupState(hwnd, element_id, checked_count, item_count, disabled_count, group_disabled, style_mode, size, min_checked, max_checked, hover_index, press_index, focus_index, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetCheckboxGroupState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 249 | `NE_EU_SetCheckboxGroupChangeCallback` | `NE_EU_SetCheckboxGroupChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetCheckboxGroupChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 250 | `NE_EU_SetRadioChecked` | `NE_EU_SetRadioChecked(hwnd, element_id, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 251 | `NE_EU_PostSetRadioChecked` | `NE_EU_PostSetRadioChecked(hwnd, element_id, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRadioChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 252 | `NE_EU_GetRadioChecked` | `NE_EU_GetRadioChecked(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 253 | `NE_EU_SetRadioGroup` | `NE_EU_SetRadioGroup(hwnd, element_id, group_bytes, group_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 254 | `NE_EU_GetRadioGroup` | `NE_EU_GetRadioGroup(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 255 | `NE_EU_SetRadioValue` | `NE_EU_SetRadioValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 256 | `NE_EU_PostSetRadioValue` | `NE_EU_PostSetRadioValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRadioValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 257 | `NE_EU_GetRadioValue` | `NE_EU_GetRadioValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 258 | `NE_EU_SetRadioOptions` | `NE_EU_SetRadioOptions(hwnd, element_id, border, size)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 259 | `NE_EU_GetRadioOptions` | `NE_EU_GetRadioOptions(hwnd, element_id, border, size)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 260 | `NE_EU_SetRadioGroupItems` | `NE_EU_SetRadioGroupItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioGroupItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 261 | `NE_EU_PostSetRadioGroupItems` | `NE_EU_PostSetRadioGroupItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRadioGroupItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 262 | `NE_EU_SetRadioGroupValue` | `NE_EU_SetRadioGroupValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 263 | `NE_EU_PostSetRadioGroupValue` | `NE_EU_PostSetRadioGroupValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRadioGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 264 | `NE_EU_GetRadioGroupValue` | `NE_EU_GetRadioGroupValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 265 | `NE_EU_GetRadioGroupSelectedIndex` | `NE_EU_GetRadioGroupSelectedIndex(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioGroupSelectedIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 266 | `NE_EU_SetRadioGroupOptions` | `NE_EU_SetRadioGroupOptions(hwnd, element_id, group_disabled, style_mode, size)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 267 | `NE_EU_GetRadioGroupOptions` | `NE_EU_GetRadioGroupOptions(hwnd, element_id, group_disabled, style_mode, size)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 268 | `NE_EU_GetRadioGroupState` | `NE_EU_GetRadioGroupState(hwnd, element_id, selected_index, item_count, disabled_count, group_disabled, style_mode, size, hover_index, press_index, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetRadioGroupState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 269 | `NE_EU_SetRadioGroupChangeCallback` | `NE_EU_SetRadioGroupChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetRadioGroupChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 270 | `NE_EU_SetSwitchChecked` | `NE_EU_SetSwitchChecked(hwnd, element_id, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 271 | `NE_EU_PostSetSwitchChecked` | `NE_EU_PostSetSwitchChecked(hwnd, element_id, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSwitchChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 272 | `NE_EU_GetSwitchChecked` | `NE_EU_GetSwitchChecked(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 273 | `NE_EU_SetSwitchLoading` | `NE_EU_SetSwitchLoading(hwnd, element_id, loading)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 274 | `NE_EU_PostSetSwitchLoading` | `NE_EU_PostSetSwitchLoading(hwnd, element_id, loading)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSwitchLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 275 | `NE_EU_GetSwitchLoading` | `NE_EU_GetSwitchLoading(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 276 | `NE_EU_SetSwitchTexts` | `NE_EU_SetSwitchTexts(hwnd, element_id, active_bytes, active_len, inactive_bytes, inactive_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 277 | `NE_EU_GetSwitchOptions` | `NE_EU_GetSwitchOptions(hwnd, element_id, checked, loading, has_active_text, has_inactive_text)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 278 | `NE_EU_SetSwitchActiveColor` | `NE_EU_SetSwitchActiveColor(hwnd, element_id, color)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchActiveColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 279 | `NE_EU_GetSwitchActiveColor` | `NE_EU_GetSwitchActiveColor(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchActiveColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 280 | `NE_EU_SetSwitchInactiveColor` | `NE_EU_SetSwitchInactiveColor(hwnd, element_id, color)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchInactiveColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 281 | `NE_EU_GetSwitchInactiveColor` | `NE_EU_GetSwitchInactiveColor(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchInactiveColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 282 | `NE_EU_SetSwitchValue` | `NE_EU_SetSwitchValue(hwnd, element_id, value)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 283 | `NE_EU_PostSetSwitchValue` | `NE_EU_PostSetSwitchValue(hwnd, element_id, value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSwitchValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 284 | `NE_EU_GetSwitchValue` | `NE_EU_GetSwitchValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 285 | `NE_EU_SetSwitchSize` | `NE_EU_SetSwitchSize(hwnd, element_id, size)` | void | new_emoji 原生界面库 底层导出 EU_SetSwitchSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 286 | `NE_EU_GetSwitchSize` | `NE_EU_GetSwitchSize(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSwitchSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 287 | `NE_EU_SetSliderRange` | `NE_EU_SetSliderRange(hwnd, element_id, min_value, max_value)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 288 | `NE_EU_SetSliderValue` | `NE_EU_SetSliderValue(hwnd, element_id, value)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 289 | `NE_EU_PostSetSliderValue` | `NE_EU_PostSetSliderValue(hwnd, element_id, value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSliderValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 290 | `NE_EU_GetSliderValue` | `NE_EU_GetSliderValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSliderValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 291 | `NE_EU_SetSliderOptions` | `NE_EU_SetSliderOptions(hwnd, element_id, step, show_tooltip)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 292 | `NE_EU_GetSliderStep` | `NE_EU_GetSliderStep(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSliderStep。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 293 | `NE_EU_GetSliderOptions` | `NE_EU_GetSliderOptions(hwnd, element_id, min_value, max_value, step, show_tooltip)` | int | new_emoji 原生界面库 底层导出 EU_GetSliderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 294 | `NE_EU_SetSliderRangeValue` | `NE_EU_SetSliderRangeValue(hwnd, element_id, start_value, end_value)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderRangeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 295 | `NE_EU_PostSetSliderRangeValue` | `NE_EU_PostSetSliderRangeValue(hwnd, element_id, start_value, end_value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSliderRangeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 296 | `NE_EU_GetSliderRangeValue` | `NE_EU_GetSliderRangeValue(hwnd, element_id, start_value, end_value)` | int | new_emoji 原生界面库 底层导出 EU_GetSliderRangeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 297 | `NE_EU_SetSliderRangeMode` | `NE_EU_SetSliderRangeMode(hwnd, element_id, enabled, start_value, end_value)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderRangeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 298 | `NE_EU_PostSetSliderRangeMode` | `NE_EU_PostSetSliderRangeMode(hwnd, element_id, enabled, start_value, end_value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSliderRangeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 299 | `NE_EU_GetSliderRangeMode` | `NE_EU_GetSliderRangeMode(hwnd, element_id, enabled, start_value, end_value)` | int | new_emoji 原生界面库 底层导出 EU_GetSliderRangeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 300 | `NE_EU_SetSliderValueCallback` | `NE_EU_SetSliderValueCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetSliderValueCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 301 | `NE_EU_SetInputNumberRange` | `NE_EU_SetInputNumberRange(hwnd, element_id, min_value, max_value)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 302 | `NE_EU_SetInputNumberStep` | `NE_EU_SetInputNumberStep(hwnd, element_id, step)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberStep。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 303 | `NE_EU_SetInputNumberValue` | `NE_EU_SetInputNumberValue(hwnd, element_id, value)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 304 | `NE_EU_PostSetInputNumberValue` | `NE_EU_PostSetInputNumberValue(hwnd, element_id, value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputNumberValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 305 | `NE_EU_GetInputNumberValue` | `NE_EU_GetInputNumberValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 306 | `NE_EU_GetInputNumberCanStep` | `NE_EU_GetInputNumberCanStep(hwnd, element_id, delta)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberCanStep。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 307 | `NE_EU_GetInputNumberOptions` | `NE_EU_GetInputNumberOptions(hwnd, element_id, min_value, max_value, step)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 308 | `NE_EU_SetInputNumberPrecision` | `NE_EU_SetInputNumberPrecision(hwnd, element_id, precision)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberPrecision。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 309 | `NE_EU_GetInputNumberPrecision` | `NE_EU_GetInputNumberPrecision(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberPrecision。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 310 | `NE_EU_SetInputNumberText` | `NE_EU_SetInputNumberText(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_SetInputNumberText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 311 | `NE_EU_PostSetInputNumberText` | `NE_EU_PostSetInputNumberText(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputNumberText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 312 | `NE_EU_GetInputNumberText` | `NE_EU_GetInputNumberText(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 313 | `NE_EU_GetInputNumberState` | `NE_EU_GetInputNumberState(hwnd, element_id, precision, editing, valid, can_decrease, can_increase)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 314 | `NE_EU_SetInputNumberValueCallback` | `NE_EU_SetInputNumberValueCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberValueCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 315 | `NE_EU_SetInputNumberStepStrictly` | `NE_EU_SetInputNumberStepStrictly(hwnd, element_id, strict)` | void | new_emoji 原生界面库 底层导出 EU_SetInputNumberStepStrictly。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 316 | `NE_EU_GetInputNumberStepStrictly` | `NE_EU_GetInputNumberStepStrictly(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputNumberStepStrictly。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 317 | `NE_EU_SetInputValue` | `NE_EU_SetInputValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 318 | `NE_EU_PostSetInputValue` | `NE_EU_PostSetInputValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 319 | `NE_EU_GetInputValue` | `NE_EU_GetInputValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 320 | `NE_EU_InvokeGetInputValue` | `NE_EU_InvokeGetInputValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_InvokeGetInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 321 | `NE_EU_SetInputPlaceholder` | `NE_EU_SetInputPlaceholder(hwnd, element_id, placeholder_bytes, placeholder_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 322 | `NE_EU_PostSetInputPlaceholder` | `NE_EU_PostSetInputPlaceholder(hwnd, element_id, placeholder_bytes, placeholder_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 323 | `NE_EU_SetInputAffixes` | `NE_EU_SetInputAffixes(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputAffixes。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 324 | `NE_EU_PostSetInputAffixes` | `NE_EU_PostSetInputAffixes(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputAffixes。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 325 | `NE_EU_SetInputIcons` | `NE_EU_SetInputIcons(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 326 | `NE_EU_PostSetInputIcons` | `NE_EU_PostSetInputIcons(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 327 | `NE_EU_GetInputIcons` | `NE_EU_GetInputIcons(hwnd, element_id, prefix_icon_buffer, prefix_icon_buffer_size, suffix_icon_buffer, suffix_icon_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 328 | `NE_EU_SetInputClearable` | `NE_EU_SetInputClearable(hwnd, element_id, clearable)` | void | new_emoji 原生界面库 底层导出 EU_SetInputClearable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 329 | `NE_EU_PostSetInputClearable` | `NE_EU_PostSetInputClearable(hwnd, element_id, clearable)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputClearable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 330 | `NE_EU_SetInputOptions` | `NE_EU_SetInputOptions(hwnd, element_id, readonly, password, multiline, validate_state)` | void | new_emoji 原生界面库 底层导出 EU_SetInputOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 331 | `NE_EU_PostSetInputOptions` | `NE_EU_PostSetInputOptions(hwnd, element_id, readonly, password, multiline, validate_state)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 332 | `NE_EU_SetInputVisualOptions` | `NE_EU_SetInputVisualOptions(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | void | new_emoji 原生界面库 底层导出 EU_SetInputVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 333 | `NE_EU_PostSetInputVisualOptions` | `NE_EU_PostSetInputVisualOptions(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 334 | `NE_EU_GetInputVisualOptions` | `NE_EU_GetInputVisualOptions(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | int | new_emoji 原生界面库 底层导出 EU_GetInputVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 335 | `NE_EU_SetInputSelection` | `NE_EU_SetInputSelection(hwnd, element_id, start, end)` | void | new_emoji 原生界面库 底层导出 EU_SetInputSelection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 336 | `NE_EU_PostSetInputSelection` | `NE_EU_PostSetInputSelection(hwnd, element_id, start, end)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputSelection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 337 | `NE_EU_GetInputSelection` | `NE_EU_GetInputSelection(hwnd, element_id, start, end)` | int | new_emoji 原生界面库 底层导出 EU_GetInputSelection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 338 | `NE_EU_SetInputContextMenuEnabled` | `NE_EU_SetInputContextMenuEnabled(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetInputContextMenuEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 339 | `NE_EU_PostSetInputContextMenuEnabled` | `NE_EU_PostSetInputContextMenuEnabled(hwnd, element_id, enabled)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputContextMenuEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 340 | `NE_EU_GetInputContextMenuEnabled` | `NE_EU_GetInputContextMenuEnabled(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputContextMenuEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 341 | `NE_EU_GetInputState` | `NE_EU_GetInputState(hwnd, element_id, cursor, length, clearable, readonly, password, multiline, validate_state)` | int | new_emoji 原生界面库 底层导出 EU_GetInputState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 342 | `NE_EU_SetInputScroll` | `NE_EU_SetInputScroll(hwnd, element_id, scroll_y)` | void | new_emoji 原生界面库 底层导出 EU_SetInputScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 343 | `NE_EU_PostSetInputScroll` | `NE_EU_PostSetInputScroll(hwnd, element_id, scroll_y)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 344 | `NE_EU_GetInputScroll` | `NE_EU_GetInputScroll(hwnd, element_id, scroll_y, max_scroll_y, content_height, viewport_height)` | int | new_emoji 原生界面库 底层导出 EU_GetInputScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 345 | `NE_EU_SetInputMaxLength` | `NE_EU_SetInputMaxLength(hwnd, element_id, max_length)` | void | new_emoji 原生界面库 底层导出 EU_SetInputMaxLength。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 346 | `NE_EU_PostSetInputMaxLength` | `NE_EU_PostSetInputMaxLength(hwnd, element_id, max_length)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputMaxLength。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 347 | `NE_EU_GetInputMaxLength` | `NE_EU_GetInputMaxLength(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputMaxLength。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 348 | `NE_EU_SetInputTextCallback` | `NE_EU_SetInputTextCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTextCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 349 | `NE_EU_SetInputGroupValue` | `NE_EU_SetInputGroupValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 350 | `NE_EU_PostSetInputGroupValue` | `NE_EU_PostSetInputGroupValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 351 | `NE_EU_GetInputGroupValue` | `NE_EU_GetInputGroupValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputGroupValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 352 | `NE_EU_SetInputGroupOptions` | `NE_EU_SetInputGroupOptions(hwnd, element_id, size, clearable, password, show_word_limit, autosize, min_rows, max_rows)` | void | new_emoji 原生界面库 底层导出 EU_SetInputGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 353 | `NE_EU_GetInputGroupOptions` | `NE_EU_GetInputGroupOptions(hwnd, element_id, size, clearable, password, show_word_limit, autosize, min_rows, max_rows)` | int | new_emoji 原生界面库 底层导出 EU_GetInputGroupOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 354 | `NE_EU_SetInputGroupTextAddon` | `NE_EU_SetInputGroupTextAddon(hwnd, element_id, side, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputGroupTextAddon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 355 | `NE_EU_SetInputGroupButtonAddon` | `NE_EU_SetInputGroupButtonAddon(hwnd, element_id, side, emoji_bytes, emoji_len, text_bytes, text_len, variant)` | void | new_emoji 原生界面库 底层导出 EU_SetInputGroupButtonAddon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 356 | `NE_EU_SetInputGroupSelectAddon` | `NE_EU_SetInputGroupSelectAddon(hwnd, element_id, side, items_bytes, items_len, selected_index, placeholder_bytes, placeholder_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputGroupSelectAddon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 357 | `NE_EU_ClearInputGroupAddon` | `NE_EU_ClearInputGroupAddon(hwnd, element_id, side)` | void | new_emoji 原生界面库 底层导出 EU_ClearInputGroupAddon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 358 | `NE_EU_GetInputGroupInputElementId` | `NE_EU_GetInputGroupInputElementId(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputGroupInputElementId。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 359 | `NE_EU_GetInputGroupAddonElementId` | `NE_EU_GetInputGroupAddonElementId(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetInputGroupAddonElementId。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 360 | `NE_EU_SetInputTagTags` | `NE_EU_SetInputTagTags(hwnd, element_id, tags_bytes, tags_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTagTags。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 361 | `NE_EU_PostSetInputTagTags` | `NE_EU_PostSetInputTagTags(hwnd, element_id, tags_bytes, tags_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputTagTags。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 362 | `NE_EU_SetInputTagPlaceholder` | `NE_EU_SetInputTagPlaceholder(hwnd, element_id, placeholder_bytes, placeholder_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTagPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 363 | `NE_EU_SetInputTagOptions` | `NE_EU_SetInputTagOptions(hwnd, element_id, max_count, allow_duplicates)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTagOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 364 | `NE_EU_GetInputTagCount` | `NE_EU_GetInputTagCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetInputTagCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 365 | `NE_EU_GetInputTagOptions` | `NE_EU_GetInputTagOptions(hwnd, element_id, max_count, allow_duplicates)` | int | new_emoji 原生界面库 底层导出 EU_GetInputTagOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 366 | `NE_EU_AddInputTagItem` | `NE_EU_AddInputTagItem(hwnd, element_id, tag_bytes, tag_len)` | int | new_emoji 原生界面库 底层导出 EU_AddInputTagItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 367 | `NE_EU_RemoveInputTagItem` | `NE_EU_RemoveInputTagItem(hwnd, element_id, tag_index)` | int | new_emoji 原生界面库 底层导出 EU_RemoveInputTagItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 368 | `NE_EU_SetInputTagInputValue` | `NE_EU_SetInputTagInputValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTagInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 369 | `NE_EU_PostSetInputTagInputValue` | `NE_EU_PostSetInputTagInputValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInputTagInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 370 | `NE_EU_GetInputTagInputValue` | `NE_EU_GetInputTagInputValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputTagInputValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 371 | `NE_EU_GetInputTagItem` | `NE_EU_GetInputTagItem(hwnd, element_id, tag_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetInputTagItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 372 | `NE_EU_SetInputTagChangeCallback` | `NE_EU_SetInputTagChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetInputTagChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 373 | `NE_EU_SetSelectOptions` | `NE_EU_SetSelectOptions(hwnd, element_id, options_bytes, options_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 374 | `NE_EU_SetSelectIndex` | `NE_EU_SetSelectIndex(hwnd, element_id, index)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 375 | `NE_EU_PostSetSelectIndex` | `NE_EU_PostSetSelectIndex(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSelectIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 376 | `NE_EU_GetSelectIndex` | `NE_EU_GetSelectIndex(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 377 | `NE_EU_SetSelectOpen` | `NE_EU_SetSelectOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 378 | `NE_EU_GetSelectOpen` | `NE_EU_GetSelectOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 379 | `NE_EU_SetSelectSearch` | `NE_EU_SetSelectSearch(hwnd, element_id, search_bytes, search_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 380 | `NE_EU_SetSelectOptionDisabled` | `NE_EU_SetSelectOptionDisabled(hwnd, element_id, option_index, disabled)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectOptionDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 381 | `NE_EU_SetSelectOptionAlignment` | `NE_EU_SetSelectOptionAlignment(hwnd, element_id, alignment)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectOptionAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 382 | `NE_EU_GetSelectOptionAlignment` | `NE_EU_GetSelectOptionAlignment(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectOptionAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 383 | `NE_EU_SetSelectValueAlignment` | `NE_EU_SetSelectValueAlignment(hwnd, element_id, alignment)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectValueAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 384 | `NE_EU_GetSelectValueAlignment` | `NE_EU_GetSelectValueAlignment(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectValueAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 385 | `NE_EU_GetSelectOptionCount` | `NE_EU_GetSelectOptionCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectOptionCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 386 | `NE_EU_GetSelectMatchedCount` | `NE_EU_GetSelectMatchedCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectMatchedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 387 | `NE_EU_GetSelectOptionDisabled` | `NE_EU_GetSelectOptionDisabled(hwnd, element_id, option_index)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectOptionDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 388 | `NE_EU_SetSelectMultiple` | `NE_EU_SetSelectMultiple(hwnd, element_id, multiple)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectMultiple。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 389 | `NE_EU_GetSelectMultiple` | `NE_EU_GetSelectMultiple(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectMultiple。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 390 | `NE_EU_SetSelectSelectedIndices` | `NE_EU_SetSelectSelectedIndices(hwnd, element_id, indices_bytes, indices_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectSelectedIndices。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 391 | `NE_EU_GetSelectSelectedCount` | `NE_EU_GetSelectSelectedCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectSelectedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 392 | `NE_EU_GetSelectSelectedAt` | `NE_EU_GetSelectSelectedAt(hwnd, element_id, position)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectSelectedAt。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 393 | `NE_EU_SetSelectChangeCallback` | `NE_EU_SetSelectChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 394 | `NE_EU_SetSelectV2Options` | `NE_EU_SetSelectV2Options(hwnd, element_id, options_bytes, options_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2Options。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 395 | `NE_EU_SetSelectV2Index` | `NE_EU_SetSelectV2Index(hwnd, element_id, index)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2Index。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 396 | `NE_EU_PostSetSelectV2Index` | `NE_EU_PostSetSelectV2Index(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSelectV2Index。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 397 | `NE_EU_SetSelectV2VisibleCount` | `NE_EU_SetSelectV2VisibleCount(hwnd, element_id, visible_count)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2VisibleCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 398 | `NE_EU_GetSelectV2Index` | `NE_EU_GetSelectV2Index(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2Index。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 399 | `NE_EU_GetSelectV2VisibleCount` | `NE_EU_GetSelectV2VisibleCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2VisibleCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 400 | `NE_EU_SetSelectV2Open` | `NE_EU_SetSelectV2Open(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2Open。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 401 | `NE_EU_GetSelectV2Open` | `NE_EU_GetSelectV2Open(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2Open。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 402 | `NE_EU_SetSelectV2Search` | `NE_EU_SetSelectV2Search(hwnd, element_id, search_bytes, search_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2Search。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 403 | `NE_EU_SetSelectV2OptionDisabled` | `NE_EU_SetSelectV2OptionDisabled(hwnd, element_id, option_index, disabled)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2OptionDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 404 | `NE_EU_SetSelectV2OptionAlignment` | `NE_EU_SetSelectV2OptionAlignment(hwnd, element_id, alignment)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2OptionAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 405 | `NE_EU_GetSelectV2OptionAlignment` | `NE_EU_GetSelectV2OptionAlignment(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2OptionAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 406 | `NE_EU_SetSelectV2ValueAlignment` | `NE_EU_SetSelectV2ValueAlignment(hwnd, element_id, alignment)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2ValueAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 407 | `NE_EU_GetSelectV2ValueAlignment` | `NE_EU_GetSelectV2ValueAlignment(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2ValueAlignment。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 408 | `NE_EU_GetSelectV2OptionCount` | `NE_EU_GetSelectV2OptionCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2OptionCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 409 | `NE_EU_GetSelectV2MatchedCount` | `NE_EU_GetSelectV2MatchedCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2MatchedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 410 | `NE_EU_GetSelectV2OptionDisabled` | `NE_EU_GetSelectV2OptionDisabled(hwnd, element_id, option_index)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2OptionDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 411 | `NE_EU_SetSelectV2ScrollIndex` | `NE_EU_SetSelectV2ScrollIndex(hwnd, element_id, scroll_index)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2ScrollIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 412 | `NE_EU_GetSelectV2ScrollIndex` | `NE_EU_GetSelectV2ScrollIndex(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSelectV2ScrollIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 413 | `NE_EU_SetSelectV2ChangeCallback` | `NE_EU_SetSelectV2ChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetSelectV2ChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 414 | `NE_EU_SetRateValue` | `NE_EU_SetRateValue(hwnd, element_id, value)` | void | new_emoji 原生界面库 底层导出 EU_SetRateValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 415 | `NE_EU_PostSetRateValue` | `NE_EU_PostSetRateValue(hwnd, element_id, value)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRateValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 416 | `NE_EU_GetRateValue` | `NE_EU_GetRateValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRateValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 417 | `NE_EU_SetRateMax` | `NE_EU_SetRateMax(hwnd, element_id, max_value)` | void | new_emoji 原生界面库 底层导出 EU_SetRateMax。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 418 | `NE_EU_GetRateMax` | `NE_EU_GetRateMax(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRateMax。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 419 | `NE_EU_SetRateValueX2` | `NE_EU_SetRateValueX2(hwnd, element_id, value_x2)` | void | new_emoji 原生界面库 底层导出 EU_SetRateValueX2。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 420 | `NE_EU_PostSetRateValueX2` | `NE_EU_PostSetRateValueX2(hwnd, element_id, value_x2)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRateValueX2。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 421 | `NE_EU_GetRateValueX2` | `NE_EU_GetRateValueX2(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRateValueX2。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 422 | `NE_EU_SetRateOptions` | `NE_EU_SetRateOptions(hwnd, element_id, allow_clear, allow_half, readonly)` | void | new_emoji 原生界面库 底层导出 EU_SetRateOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 423 | `NE_EU_GetRateOptions` | `NE_EU_GetRateOptions(hwnd, element_id, allow_clear, allow_half, readonly, show_score)` | int | new_emoji 原生界面库 底层导出 EU_GetRateOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 424 | `NE_EU_SetRateTexts` | `NE_EU_SetRateTexts(hwnd, element_id, low_bytes, low_len, high_bytes, high_len, show_score)` | void | new_emoji 原生界面库 底层导出 EU_SetRateTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 425 | `NE_EU_SetRateColors` | `NE_EU_SetRateColors(hwnd, element_id, low_color, mid_color, high_color)` | void | new_emoji 原生界面库 底层导出 EU_SetRateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 426 | `NE_EU_GetRateColors` | `NE_EU_GetRateColors(hwnd, element_id, low_color, mid_color, high_color)` | int | new_emoji 原生界面库 底层导出 EU_GetRateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 427 | `NE_EU_SetRateIcons` | `NE_EU_SetRateIcons(hwnd, element_id, full_bytes, full_len, void_bytes, void_len, low_bytes, low_len, mid_bytes, mid_len, high_bytes, high_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRateIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 428 | `NE_EU_GetRateIcons` | `NE_EU_GetRateIcons(hwnd, element_id, full_buffer, full_buffer_size, void_buffer, void_buffer_size, low_buffer, low_buffer_size, mid_buffer, mid_buffer_size, high_buffer, high_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetRateIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 429 | `NE_EU_SetRateTextItems` | `NE_EU_SetRateTextItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRateTextItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 430 | `NE_EU_SetRateDisplayOptions` | `NE_EU_SetRateDisplayOptions(hwnd, element_id, show_text, show_score, text_color, template_bytes, template_len)` | void | new_emoji 原生界面库 底层导出 EU_SetRateDisplayOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 431 | `NE_EU_GetRateDisplayOptions` | `NE_EU_GetRateDisplayOptions(hwnd, element_id, show_text, show_score, text_color, template_buffer, template_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetRateDisplayOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 432 | `NE_EU_SetRateChangeCallback` | `NE_EU_SetRateChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetRateChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 433 | `NE_EU_SetColorPickerColor` | `NE_EU_SetColorPickerColor(hwnd, element_id, color)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 434 | `NE_EU_PostSetColorPickerColor` | `NE_EU_PostSetColorPickerColor(hwnd, element_id, color)` | int | new_emoji 原生界面库 底层导出 EU_PostSetColorPickerColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 435 | `NE_EU_GetColorPickerColor` | `NE_EU_GetColorPickerColor(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 436 | `NE_EU_SetColorPickerAlpha` | `NE_EU_SetColorPickerAlpha(hwnd, element_id, alpha)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerAlpha。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 437 | `NE_EU_GetColorPickerAlpha` | `NE_EU_GetColorPickerAlpha(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerAlpha。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 438 | `NE_EU_SetColorPickerHex` | `NE_EU_SetColorPickerHex(hwnd, element_id, hex_bytes, hex_len)` | int | new_emoji 原生界面库 底层导出 EU_SetColorPickerHex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 439 | `NE_EU_PostSetColorPickerHex` | `NE_EU_PostSetColorPickerHex(hwnd, element_id, hex_bytes, hex_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetColorPickerHex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 440 | `NE_EU_GetColorPickerHex` | `NE_EU_GetColorPickerHex(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerHex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 441 | `NE_EU_SetColorPickerOpen` | `NE_EU_SetColorPickerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 442 | `NE_EU_PostSetColorPickerOpen` | `NE_EU_PostSetColorPickerOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetColorPickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 443 | `NE_EU_GetColorPickerOpen` | `NE_EU_GetColorPickerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 444 | `NE_EU_SetColorPickerPalette` | `NE_EU_SetColorPickerPalette(hwnd, element_id, colors, count)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerPalette。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 445 | `NE_EU_GetColorPickerPaletteCount` | `NE_EU_GetColorPickerPaletteCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerPaletteCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 446 | `NE_EU_SetColorPickerOptions` | `NE_EU_SetColorPickerOptions(hwnd, element_id, show_alpha, size_mode, clearable)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 447 | `NE_EU_GetColorPickerOptions` | `NE_EU_GetColorPickerOptions(hwnd, element_id, show_alpha, size_mode, clearable)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 448 | `NE_EU_ClearColorPicker` | `NE_EU_ClearColorPicker(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearColorPicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 449 | `NE_EU_GetColorPickerHasValue` | `NE_EU_GetColorPickerHasValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetColorPickerHasValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 450 | `NE_EU_SetColorPickerChangeCallback` | `NE_EU_SetColorPickerChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetColorPickerChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 451 | `NE_EU_SetTagType` | `NE_EU_SetTagType(hwnd, element_id, tag_type)` | void | new_emoji 原生界面库 底层导出 EU_SetTagType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 452 | `NE_EU_PostSetTagType` | `NE_EU_PostSetTagType(hwnd, element_id, tag_type)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTagType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 453 | `NE_EU_SetTagEffect` | `NE_EU_SetTagEffect(hwnd, element_id, effect)` | void | new_emoji 原生界面库 底层导出 EU_SetTagEffect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 454 | `NE_EU_SetTagClosable` | `NE_EU_SetTagClosable(hwnd, element_id, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetTagClosable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 455 | `NE_EU_SetTagClosed` | `NE_EU_SetTagClosed(hwnd, element_id, closed)` | void | new_emoji 原生界面库 底层导出 EU_SetTagClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 456 | `NE_EU_PostSetTagClosed` | `NE_EU_PostSetTagClosed(hwnd, element_id, closed)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTagClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 457 | `NE_EU_GetTagClosed` | `NE_EU_GetTagClosed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTagClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 458 | `NE_EU_GetTagOptions` | `NE_EU_GetTagOptions(hwnd, element_id, tag_type, effect, closable, closed)` | int | new_emoji 原生界面库 底层导出 EU_GetTagOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 459 | `NE_EU_SetTagSize` | `NE_EU_SetTagSize(hwnd, element_id, size_preset)` | void | new_emoji 原生界面库 底层导出 EU_SetTagSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 460 | `NE_EU_SetTagThemeColor` | `NE_EU_SetTagThemeColor(hwnd, element_id, color)` | void | new_emoji 原生界面库 底层导出 EU_SetTagThemeColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 461 | `NE_EU_PostSetTagThemeColor` | `NE_EU_PostSetTagThemeColor(hwnd, element_id, color)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTagThemeColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 462 | `NE_EU_GetTagVisualOptions` | `NE_EU_GetTagVisualOptions(hwnd, element_id, size_preset, theme_color)` | int | new_emoji 原生界面库 底层导出 EU_GetTagVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 463 | `NE_EU_SetTagTextOptions` | `NE_EU_SetTagTextOptions(hwnd, element_id, align, wrap)` | void | new_emoji 原生界面库 底层导出 EU_SetTagTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 464 | `NE_EU_GetTagTextOptions` | `NE_EU_GetTagTextOptions(hwnd, element_id, align, wrap)` | int | new_emoji 原生界面库 底层导出 EU_GetTagTextOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 465 | `NE_EU_SetTagCloseCallback` | `NE_EU_SetTagCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTagCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 466 | `NE_EU_SetBadgeValue` | `NE_EU_SetBadgeValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 467 | `NE_EU_PostSetBadgeValue` | `NE_EU_PostSetBadgeValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBadgeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 468 | `NE_EU_SetBadgeMax` | `NE_EU_SetBadgeMax(hwnd, element_id, max_value)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeMax。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 469 | `NE_EU_SetBadgeType` | `NE_EU_SetBadgeType(hwnd, element_id, badge_type)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 470 | `NE_EU_PostSetBadgeType` | `NE_EU_PostSetBadgeType(hwnd, element_id, badge_type)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBadgeType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 471 | `NE_EU_SetBadgeDot` | `NE_EU_SetBadgeDot(hwnd, element_id, dot)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 472 | `NE_EU_PostSetBadgeDot` | `NE_EU_PostSetBadgeDot(hwnd, element_id, dot)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBadgeDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 473 | `NE_EU_SetBadgeOptions` | `NE_EU_SetBadgeOptions(hwnd, element_id, dot, show_zero, offset_x, offset_y)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 474 | `NE_EU_GetBadgeHidden` | `NE_EU_GetBadgeHidden(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBadgeHidden。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 475 | `NE_EU_GetBadgeOptions` | `NE_EU_GetBadgeOptions(hwnd, element_id, max_value, dot, show_zero, offset_x, offset_y)` | int | new_emoji 原生界面库 底层导出 EU_GetBadgeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 476 | `NE_EU_GetBadgeType` | `NE_EU_GetBadgeType(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBadgeType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 477 | `NE_EU_SetBadgeLayoutOptions` | `NE_EU_SetBadgeLayoutOptions(hwnd, element_id, placement, standalone)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeLayoutOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 478 | `NE_EU_GetBadgeLayoutOptions` | `NE_EU_GetBadgeLayoutOptions(hwnd, element_id, placement, standalone)` | int | new_emoji 原生界面库 底层导出 EU_GetBadgeLayoutOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 479 | `NE_EU_SetBadgeCornerRadius` | `NE_EU_SetBadgeCornerRadius(hwnd, element_id, radius)` | void | new_emoji 原生界面库 底层导出 EU_SetBadgeCornerRadius。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 480 | `NE_EU_GetBadgeCornerRadius` | `NE_EU_GetBadgeCornerRadius(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBadgeCornerRadius。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 481 | `NE_EU_SetProgressPercentage` | `NE_EU_SetProgressPercentage(hwnd, element_id, percentage)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressPercentage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 482 | `NE_EU_PostSetProgressPercentage` | `NE_EU_PostSetProgressPercentage(hwnd, element_id, percentage)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressPercentage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 483 | `NE_EU_GetProgressPercentage` | `NE_EU_GetProgressPercentage(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressPercentage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 484 | `NE_EU_SetProgressStatus` | `NE_EU_SetProgressStatus(hwnd, element_id, status)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 485 | `NE_EU_PostSetProgressStatus` | `NE_EU_PostSetProgressStatus(hwnd, element_id, status)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 486 | `NE_EU_GetProgressStatus` | `NE_EU_GetProgressStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 487 | `NE_EU_SetProgressShowText` | `NE_EU_SetProgressShowText(hwnd, element_id, show_text)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressShowText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 488 | `NE_EU_PostSetProgressShowText` | `NE_EU_PostSetProgressShowText(hwnd, element_id, show_text)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressShowText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 489 | `NE_EU_SetProgressOptions` | `NE_EU_SetProgressOptions(hwnd, element_id, progress_type, stroke_width, show_text)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 490 | `NE_EU_PostSetProgressOptions` | `NE_EU_PostSetProgressOptions(hwnd, element_id, progress_type, stroke_width, show_text)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 491 | `NE_EU_GetProgressOptions` | `NE_EU_GetProgressOptions(hwnd, element_id, progress_type, stroke_width, show_text)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 492 | `NE_EU_SetProgressFormatOptions` | `NE_EU_SetProgressFormatOptions(hwnd, element_id, text_format, striped)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressFormatOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 493 | `NE_EU_PostSetProgressFormatOptions` | `NE_EU_PostSetProgressFormatOptions(hwnd, element_id, text_format, striped)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressFormatOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 494 | `NE_EU_GetProgressFormatOptions` | `NE_EU_GetProgressFormatOptions(hwnd, element_id, text_format, striped)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressFormatOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 495 | `NE_EU_SetProgressTextInside` | `NE_EU_SetProgressTextInside(hwnd, element_id, text_inside)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressTextInside。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 496 | `NE_EU_PostSetProgressTextInside` | `NE_EU_PostSetProgressTextInside(hwnd, element_id, text_inside)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressTextInside。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 497 | `NE_EU_GetProgressTextInside` | `NE_EU_GetProgressTextInside(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressTextInside。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 498 | `NE_EU_SetProgressColors` | `NE_EU_SetProgressColors(hwnd, element_id, fill, track, text)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 499 | `NE_EU_PostSetProgressColors` | `NE_EU_PostSetProgressColors(hwnd, element_id, fill, track, text)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 500 | `NE_EU_GetProgressColors` | `NE_EU_GetProgressColors(hwnd, element_id, fill, track, text)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 501 | `NE_EU_SetProgressColorStops` | `NE_EU_SetProgressColorStops(hwnd, element_id, stops_bytes, stops_len)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressColorStops。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 502 | `NE_EU_PostSetProgressColorStops` | `NE_EU_PostSetProgressColorStops(hwnd, element_id, stops_bytes, stops_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressColorStops。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 503 | `NE_EU_GetProgressColorStopCount` | `NE_EU_GetProgressColorStopCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressColorStopCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 504 | `NE_EU_GetProgressColorStop` | `NE_EU_GetProgressColorStop(hwnd, element_id, index, color, percentage)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressColorStop。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 505 | `NE_EU_SetProgressCompleteText` | `NE_EU_SetProgressCompleteText(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressCompleteText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 506 | `NE_EU_PostSetProgressCompleteText` | `NE_EU_PostSetProgressCompleteText(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressCompleteText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 507 | `NE_EU_GetProgressCompleteText` | `NE_EU_GetProgressCompleteText(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressCompleteText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 508 | `NE_EU_SetProgressTextTemplate` | `NE_EU_SetProgressTextTemplate(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetProgressTextTemplate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 509 | `NE_EU_PostSetProgressTextTemplate` | `NE_EU_PostSetProgressTextTemplate(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetProgressTextTemplate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 510 | `NE_EU_GetProgressTextTemplate` | `NE_EU_GetProgressTextTemplate(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetProgressTextTemplate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 511 | `NE_EU_SetAvatarShape` | `NE_EU_SetAvatarShape(hwnd, element_id, shape)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarShape。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 512 | `NE_EU_SetAvatarSource` | `NE_EU_SetAvatarSource(hwnd, element_id, src_bytes, src_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarSource。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 513 | `NE_EU_SetAvatarFallbackSource` | `NE_EU_SetAvatarFallbackSource(hwnd, element_id, src_bytes, src_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarFallbackSource。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 514 | `NE_EU_SetAvatarIcon` | `NE_EU_SetAvatarIcon(hwnd, element_id, icon_bytes, icon_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 515 | `NE_EU_SetAvatarErrorText` | `NE_EU_SetAvatarErrorText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarErrorText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 516 | `NE_EU_SetAvatarFit` | `NE_EU_SetAvatarFit(hwnd, element_id, fit)` | void | new_emoji 原生界面库 底层导出 EU_SetAvatarFit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 517 | `NE_EU_GetAvatarImageStatus` | `NE_EU_GetAvatarImageStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAvatarImageStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 518 | `NE_EU_GetAvatarOptions` | `NE_EU_GetAvatarOptions(hwnd, element_id, shape, fit)` | int | new_emoji 原生界面库 底层导出 EU_GetAvatarOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 519 | `NE_EU_SetEmptyDescription` | `NE_EU_SetEmptyDescription(hwnd, element_id, desc_bytes, desc_len)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyDescription。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 520 | `NE_EU_SetEmptyOptions` | `NE_EU_SetEmptyOptions(hwnd, element_id, icon_bytes, icon_len, action_bytes, action_len)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 521 | `NE_EU_SetEmptyActionClicked` | `NE_EU_SetEmptyActionClicked(hwnd, element_id, clicked)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyActionClicked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 522 | `NE_EU_GetEmptyActionClicked` | `NE_EU_GetEmptyActionClicked(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetEmptyActionClicked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 523 | `NE_EU_SetEmptyActionCallback` | `NE_EU_SetEmptyActionCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyActionCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 524 | `NE_EU_SetEmptyImage` | `NE_EU_SetEmptyImage(hwnd, element_id, image_bytes, image_len)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyImage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 525 | `NE_EU_SetEmptyImageSize` | `NE_EU_SetEmptyImageSize(hwnd, element_id, image_size)` | void | new_emoji 原生界面库 底层导出 EU_SetEmptyImageSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 526 | `NE_EU_GetEmptyImageStatus` | `NE_EU_GetEmptyImageStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetEmptyImageStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 527 | `NE_EU_GetEmptyImageSize` | `NE_EU_GetEmptyImageSize(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetEmptyImageSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 528 | `NE_EU_SetSkeletonRows` | `NE_EU_SetSkeletonRows(hwnd, element_id, rows)` | void | new_emoji 原生界面库 底层导出 EU_SetSkeletonRows。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 529 | `NE_EU_PostSetSkeletonRows` | `NE_EU_PostSetSkeletonRows(hwnd, element_id, rows)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSkeletonRows。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 530 | `NE_EU_SetSkeletonAnimated` | `NE_EU_SetSkeletonAnimated(hwnd, element_id, animated)` | void | new_emoji 原生界面库 底层导出 EU_SetSkeletonAnimated。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 531 | `NE_EU_SetSkeletonLoading` | `NE_EU_SetSkeletonLoading(hwnd, element_id, loading)` | void | new_emoji 原生界面库 底层导出 EU_SetSkeletonLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 532 | `NE_EU_PostSetSkeletonLoading` | `NE_EU_PostSetSkeletonLoading(hwnd, element_id, loading)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSkeletonLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 533 | `NE_EU_SetSkeletonOptions` | `NE_EU_SetSkeletonOptions(hwnd, element_id, rows, animated, loading, show_avatar)` | void | new_emoji 原生界面库 底层导出 EU_SetSkeletonOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 534 | `NE_EU_GetSkeletonLoading` | `NE_EU_GetSkeletonLoading(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSkeletonLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 535 | `NE_EU_GetSkeletonOptions` | `NE_EU_GetSkeletonOptions(hwnd, element_id, rows, animated, loading, show_avatar)` | int | new_emoji 原生界面库 底层导出 EU_GetSkeletonOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 536 | `NE_EU_SetDescriptionsItems` | `NE_EU_SetDescriptionsItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 537 | `NE_EU_PostSetDescriptionsItems` | `NE_EU_PostSetDescriptionsItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDescriptionsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 538 | `NE_EU_SetDescriptionsColumns` | `NE_EU_SetDescriptionsColumns(hwnd, element_id, columns)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsColumns。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 539 | `NE_EU_SetDescriptionsBordered` | `NE_EU_SetDescriptionsBordered(hwnd, element_id, bordered)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsBordered。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 540 | `NE_EU_SetDescriptionsLayout` | `NE_EU_SetDescriptionsLayout(hwnd, element_id, direction, size, columns, bordered)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 541 | `NE_EU_SetDescriptionsItemsEx` | `NE_EU_SetDescriptionsItemsEx(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 542 | `NE_EU_PostSetDescriptionsItemsEx` | `NE_EU_PostSetDescriptionsItemsEx(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDescriptionsItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 543 | `NE_EU_SetDescriptionsOptions` | `NE_EU_SetDescriptionsOptions(hwnd, element_id, columns, bordered, label_width, min_row_height, wrap_values)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 544 | `NE_EU_GetDescriptionsItemCount` | `NE_EU_GetDescriptionsItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDescriptionsItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 545 | `NE_EU_SetDescriptionsAdvancedOptions` | `NE_EU_SetDescriptionsAdvancedOptions(hwnd, element_id, responsive, last_item_span)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 546 | `NE_EU_SetDescriptionsColors` | `NE_EU_SetDescriptionsColors(hwnd, element_id, border, label_bg, content_bg, label_fg, content_fg, title_fg)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 547 | `NE_EU_SetDescriptionsExtra` | `NE_EU_SetDescriptionsExtra(hwnd, element_id, emoji_bytes, emoji_len, text_bytes, text_len, visible, variant)` | void | new_emoji 原生界面库 底层导出 EU_SetDescriptionsExtra。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 548 | `NE_EU_GetDescriptionsOptions` | `NE_EU_GetDescriptionsOptions(hwnd, element_id, columns, bordered, label_width, min_row_height, wrap_values, responsive, last_item_span)` | int | new_emoji 原生界面库 底层导出 EU_GetDescriptionsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 549 | `NE_EU_GetDescriptionsFullState` | `NE_EU_GetDescriptionsFullState(hwnd, element_id, direction, size, columns, bordered, item_count, extra_click_count, responsive, wrap_values)` | int | new_emoji 原生界面库 底层导出 EU_GetDescriptionsFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 550 | `NE_EU_SetTableData` | `NE_EU_SetTableData(hwnd, element_id, columns_bytes, columns_len, rows_bytes, rows_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 551 | `NE_EU_PostSetTableData` | `NE_EU_PostSetTableData(hwnd, element_id, columns_bytes, columns_len, rows_bytes, rows_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTableData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 552 | `NE_EU_SetTableStriped` | `NE_EU_SetTableStriped(hwnd, element_id, striped)` | void | new_emoji 原生界面库 底层导出 EU_SetTableStriped。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 553 | `NE_EU_SetTableBordered` | `NE_EU_SetTableBordered(hwnd, element_id, bordered)` | void | new_emoji 原生界面库 底层导出 EU_SetTableBordered。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 554 | `NE_EU_SetTableBorderColor` | `NE_EU_SetTableBorderColor(hwnd, element_id, color)` | void | new_emoji 原生界面库 底层导出 EU_SetTableBorderColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 555 | `NE_EU_SetTableBorderWidth` | `NE_EU_SetTableBorderWidth(hwnd, element_id, width)` | void | new_emoji 原生界面库 底层导出 EU_SetTableBorderWidth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 556 | `NE_EU_SetTableEmptyText` | `NE_EU_SetTableEmptyText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableEmptyText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 557 | `NE_EU_SetTableSelectedRow` | `NE_EU_SetTableSelectedRow(hwnd, element_id, row_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSelectedRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 558 | `NE_EU_GetTableSelectedRow` | `NE_EU_GetTableSelectedRow(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTableSelectedRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 559 | `NE_EU_GetTableRowCount` | `NE_EU_GetTableRowCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTableRowCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 560 | `NE_EU_InvokeGetTableRowCount` | `NE_EU_InvokeGetTableRowCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_InvokeGetTableRowCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 561 | `NE_EU_GetTableColumnCount` | `NE_EU_GetTableColumnCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTableColumnCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 562 | `NE_EU_SetTableOptions` | `NE_EU_SetTableOptions(hwnd, element_id, striped, bordered, row_height, header_height, selectable)` | void | new_emoji 原生界面库 底层导出 EU_SetTableOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 563 | `NE_EU_SetTableSort` | `NE_EU_SetTableSort(hwnd, element_id, column_index, desc)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSort。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 564 | `NE_EU_SetTableScrollRow` | `NE_EU_SetTableScrollRow(hwnd, element_id, scroll_row)` | void | new_emoji 原生界面库 底层导出 EU_SetTableScrollRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 565 | `NE_EU_SetTableColumnWidth` | `NE_EU_SetTableColumnWidth(hwnd, element_id, column_width)` | void | new_emoji 原生界面库 底层导出 EU_SetTableColumnWidth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 566 | `NE_EU_SetTableColumnWidthAt` | `NE_EU_SetTableColumnWidthAt(hwnd, element_id, column_index, column_width)` | void | new_emoji 原生界面库 底层导出 EU_SetTableColumnWidthAt。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 567 | `NE_EU_GetTableOptions` | `NE_EU_GetTableOptions(hwnd, element_id, striped, bordered, row_height, header_height, selectable, sort_column, sort_desc, scroll_row, column_width)` | int | new_emoji 原生界面库 底层导出 EU_GetTableOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 568 | `NE_EU_SetTableColumnsEx` | `NE_EU_SetTableColumnsEx(hwnd, element_id, columns_bytes, columns_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableColumnsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 569 | `NE_EU_SetTableRowsEx` | `NE_EU_SetTableRowsEx(hwnd, element_id, rows_bytes, rows_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableRowsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 570 | `NE_EU_PostSetTableRowsEx` | `NE_EU_PostSetTableRowsEx(hwnd, element_id, rows_bytes, rows_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTableRowsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 571 | `NE_EU_AddTableRow` | `NE_EU_AddTableRow(hwnd, element_id, row_bytes, row_len)` | int | new_emoji 原生界面库 底层导出 EU_AddTableRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 572 | `NE_EU_PostAddTableRow` | `NE_EU_PostAddTableRow(hwnd, element_id, row_bytes, row_len)` | int | new_emoji 原生界面库 底层导出 EU_PostAddTableRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 573 | `NE_EU_InsertTableRow` | `NE_EU_InsertTableRow(hwnd, element_id, row_index, row_bytes, row_len)` | int | new_emoji 原生界面库 底层导出 EU_InsertTableRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 574 | `NE_EU_PostInsertTableRow` | `NE_EU_PostInsertTableRow(hwnd, element_id, row_index, row_bytes, row_len)` | int | new_emoji 原生界面库 底层导出 EU_PostInsertTableRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 575 | `NE_EU_DeleteTableRow` | `NE_EU_DeleteTableRow(hwnd, element_id, row_index)` | int | new_emoji 原生界面库 底层导出 EU_DeleteTableRow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 576 | `NE_EU_ClearTableRows` | `NE_EU_ClearTableRows(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_ClearTableRows。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 577 | `NE_EU_PostClearTableRows` | `NE_EU_PostClearTableRows(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_PostClearTableRows。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 578 | `NE_EU_SetTableCellEx` | `NE_EU_SetTableCellEx(hwnd, element_id, row, col, type, value_bytes, value_len, options_bytes, options_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 579 | `NE_EU_SetTableColumnAlign` | `NE_EU_SetTableColumnAlign(hwnd, element_id, col, header_align, cell_align)` | void | new_emoji 原生界面库 底层导出 EU_SetTableColumnAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 580 | `NE_EU_SetTableRowAlign` | `NE_EU_SetTableRowAlign(hwnd, element_id, row, align)` | void | new_emoji 原生界面库 底层导出 EU_SetTableRowAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 581 | `NE_EU_SetTableCellAlign` | `NE_EU_SetTableCellAlign(hwnd, element_id, row, col, align)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 582 | `NE_EU_SetTableRowStyle` | `NE_EU_SetTableRowStyle(hwnd, element_id, row, bg, fg, align, font_flags, font_size)` | void | new_emoji 原生界面库 底层导出 EU_SetTableRowStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 583 | `NE_EU_SetTableCellStyle` | `NE_EU_SetTableCellStyle(hwnd, element_id, row, col, bg, fg, align, font_flags, font_size)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 584 | `NE_EU_SetTableCellOverridesUtf8` | `NE_EU_SetTableCellOverridesUtf8(hwnd, element_id, spec_bytes, spec_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellOverridesUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 585 | `NE_EU_SetTableSpansUtf8` | `NE_EU_SetTableSpansUtf8(hwnd, element_id, spec_bytes, spec_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSpansUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 586 | `NE_EU_SetTableSelectionMode` | `NE_EU_SetTableSelectionMode(hwnd, element_id, mode)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSelectionMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 587 | `NE_EU_SetTableSelectedRows` | `NE_EU_SetTableSelectedRows(hwnd, element_id, rows_bytes, rows_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSelectedRows。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 588 | `NE_EU_SetTableFilter` | `NE_EU_SetTableFilter(hwnd, element_id, col, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableFilter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 589 | `NE_EU_ClearTableFilter` | `NE_EU_ClearTableFilter(hwnd, element_id, col)` | void | new_emoji 原生界面库 底层导出 EU_ClearTableFilter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 590 | `NE_EU_SetTableSearch` | `NE_EU_SetTableSearch(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 591 | `NE_EU_SetTableSpan` | `NE_EU_SetTableSpan(hwnd, element_id, row, col, rowspan, colspan)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSpan。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 592 | `NE_EU_ClearTableSpans` | `NE_EU_ClearTableSpans(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearTableSpans。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 593 | `NE_EU_SetTableSummary` | `NE_EU_SetTableSummary(hwnd, element_id, values_bytes, values_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTableSummary。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 594 | `NE_EU_SetTableRowExpanded` | `NE_EU_SetTableRowExpanded(hwnd, element_id, row, expanded)` | void | new_emoji 原生界面库 底层导出 EU_SetTableRowExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 595 | `NE_EU_SetTableTreeOptions` | `NE_EU_SetTableTreeOptions(hwnd, element_id, enabled, indent, lazy)` | void | new_emoji 原生界面库 底层导出 EU_SetTableTreeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 596 | `NE_EU_SetTableViewportOptions` | `NE_EU_SetTableViewportOptions(hwnd, element_id, max_height, fixed_header, horizontal_scroll, show_summary)` | void | new_emoji 原生界面库 底层导出 EU_SetTableViewportOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 597 | `NE_EU_SetTableScroll` | `NE_EU_SetTableScroll(hwnd, element_id, scroll_row, scroll_x)` | void | new_emoji 原生界面库 底层导出 EU_SetTableScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 598 | `NE_EU_SetTableHeaderDragOptions` | `NE_EU_SetTableHeaderDragOptions(hwnd, element_id, column_resize, header_height_resize, min_col_width, max_col_width, min_header_height, max_header_height)` | void | new_emoji 原生界面库 底层导出 EU_SetTableHeaderDragOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 599 | `NE_EU_SetTableDoubleClickEdit` | `NE_EU_SetTableDoubleClickEdit(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetTableDoubleClickEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 600 | `NE_EU_SetTableColumnDoubleClickEdit` | `NE_EU_SetTableColumnDoubleClickEdit(hwnd, element_id, col, editable)` | void | new_emoji 原生界面库 底层导出 EU_SetTableColumnDoubleClickEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 601 | `NE_EU_SetTableCellDoubleClickEdit` | `NE_EU_SetTableCellDoubleClickEdit(hwnd, element_id, row, col, editable)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellDoubleClickEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 602 | `NE_EU_GetTableCellDoubleClickEditable` | `NE_EU_GetTableCellDoubleClickEditable(hwnd, element_id, row, col)` | int | new_emoji 原生界面库 底层导出 EU_GetTableCellDoubleClickEditable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 603 | `NE_EU_GetTableDoubleClickEditState` | `NE_EU_GetTableDoubleClickEditState(hwnd, element_id, enabled, editing_row, editing_col)` | int | new_emoji 原生界面库 底层导出 EU_GetTableDoubleClickEditState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 604 | `NE_EU_ExportTableExcel` | `NE_EU_ExportTableExcel(hwnd, element_id, path_bytes, path_len, flags)` | int | new_emoji 原生界面库 底层导出 EU_ExportTableExcel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 605 | `NE_EU_ImportTableExcel` | `NE_EU_ImportTableExcel(hwnd, element_id, path_bytes, path_len, flags)` | int | new_emoji 原生界面库 底层导出 EU_ImportTableExcel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 606 | `NE_EU_SetTableCellClickCallback` | `NE_EU_SetTableCellClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 607 | `NE_EU_SetTableCellActionCallback` | `NE_EU_SetTableCellActionCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellActionCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 608 | `NE_EU_SetTableCellEditCallback` | `NE_EU_SetTableCellEditCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTableCellEditCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 609 | `NE_EU_SetTableContextMenuCallback` | `NE_EU_SetTableContextMenuCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTableContextMenuCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 610 | `NE_EU_SetTableVirtualOptions` | `NE_EU_SetTableVirtualOptions(hwnd, element_id, enabled, row_count, cache_window)` | void | new_emoji 原生界面库 底层导出 EU_SetTableVirtualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 611 | `NE_EU_SetTableVirtualRowProvider` | `NE_EU_SetTableVirtualRowProvider(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTableVirtualRowProvider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 612 | `NE_EU_ClearTableVirtualCache` | `NE_EU_ClearTableVirtualCache(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearTableVirtualCache。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 613 | `NE_EU_GetTableCellValue` | `NE_EU_GetTableCellValue(hwnd, element_id, row, col, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTableCellValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 614 | `NE_EU_GetTableFullState` | `NE_EU_GetTableFullState(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTableFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 615 | `NE_EU_SetListBoxItems` | `NE_EU_SetListBoxItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 616 | `NE_EU_PostSetListBoxItems` | `NE_EU_PostSetListBoxItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 617 | `NE_EU_SetListBoxItemsEx` | `NE_EU_SetListBoxItemsEx(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 618 | `NE_EU_PostSetListBoxItemsEx` | `NE_EU_PostSetListBoxItemsEx(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 619 | `NE_EU_AddListBoxItem` | `NE_EU_AddListBoxItem(hwnd, element_id, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_AddListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 620 | `NE_EU_PostAddListBoxItem` | `NE_EU_PostAddListBoxItem(hwnd, element_id, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_PostAddListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 621 | `NE_EU_InsertListBoxItem` | `NE_EU_InsertListBoxItem(hwnd, element_id, index, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_InsertListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 622 | `NE_EU_PostInsertListBoxItem` | `NE_EU_PostInsertListBoxItem(hwnd, element_id, index, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_PostInsertListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 623 | `NE_EU_UpdateListBoxItem` | `NE_EU_UpdateListBoxItem(hwnd, element_id, index, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_UpdateListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 624 | `NE_EU_PostUpdateListBoxItem` | `NE_EU_PostUpdateListBoxItem(hwnd, element_id, index, item_bytes, item_len)` | int | new_emoji 原生界面库 底层导出 EU_PostUpdateListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 625 | `NE_EU_DeleteListBoxItem` | `NE_EU_DeleteListBoxItem(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_DeleteListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 626 | `NE_EU_PostDeleteListBoxItem` | `NE_EU_PostDeleteListBoxItem(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostDeleteListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 627 | `NE_EU_ClearListBoxItems` | `NE_EU_ClearListBoxItems(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_ClearListBoxItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 628 | `NE_EU_PostClearListBoxItems` | `NE_EU_PostClearListBoxItems(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_PostClearListBoxItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 629 | `NE_EU_GetListBoxItemCount` | `NE_EU_GetListBoxItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 630 | `NE_EU_GetListBoxItem` | `NE_EU_GetListBoxItem(hwnd, element_id, index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 631 | `NE_EU_GetListBoxItems` | `NE_EU_GetListBoxItems(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 632 | `NE_EU_SetListBoxSelectedIndex` | `NE_EU_SetListBoxSelectedIndex(hwnd, element_id, index)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxSelectedIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 633 | `NE_EU_PostSetListBoxSelectedIndex` | `NE_EU_PostSetListBoxSelectedIndex(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxSelectedIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 634 | `NE_EU_GetListBoxSelectedIndex` | `NE_EU_GetListBoxSelectedIndex(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxSelectedIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 635 | `NE_EU_SetListBoxSelectedKeys` | `NE_EU_SetListBoxSelectedKeys(hwnd, element_id, keys_bytes, keys_len)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxSelectedKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 636 | `NE_EU_PostSetListBoxSelectedKeys` | `NE_EU_PostSetListBoxSelectedKeys(hwnd, element_id, keys_bytes, keys_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxSelectedKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 637 | `NE_EU_GetListBoxSelectedKeys` | `NE_EU_GetListBoxSelectedKeys(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxSelectedKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 638 | `NE_EU_GetListBoxSelectedItems` | `NE_EU_GetListBoxSelectedItems(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxSelectedItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 639 | `NE_EU_SetListBoxItemDisabled` | `NE_EU_SetListBoxItemDisabled(hwnd, element_id, index, disabled)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItemDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 640 | `NE_EU_PostSetListBoxItemDisabled` | `NE_EU_PostSetListBoxItemDisabled(hwnd, element_id, index, disabled)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxItemDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 641 | `NE_EU_GetListBoxItemDisabled` | `NE_EU_GetListBoxItemDisabled(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxItemDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 642 | `NE_EU_SetListBoxItemExpanded` | `NE_EU_SetListBoxItemExpanded(hwnd, element_id, key_bytes, key_len, expanded)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 643 | `NE_EU_PostSetListBoxItemExpanded` | `NE_EU_PostSetListBoxItemExpanded(hwnd, element_id, key_bytes, key_len, expanded)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 644 | `NE_EU_GetListBoxItemExpanded` | `NE_EU_GetListBoxItemExpanded(hwnd, element_id, key_bytes, key_len)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 645 | `NE_EU_SetListBoxGroupCollapsed` | `NE_EU_SetListBoxGroupCollapsed(hwnd, element_id, group_bytes, group_len, collapsed)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxGroupCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 646 | `NE_EU_PostSetListBoxGroupCollapsed` | `NE_EU_PostSetListBoxGroupCollapsed(hwnd, element_id, group_bytes, group_len, collapsed)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxGroupCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 647 | `NE_EU_GetListBoxGroupCollapsed` | `NE_EU_GetListBoxGroupCollapsed(hwnd, element_id, group_bytes, group_len)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxGroupCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 648 | `NE_EU_StartListBoxEdit` | `NE_EU_StartListBoxEdit(hwnd, element_id, index, field)` | int | new_emoji 原生界面库 底层导出 EU_StartListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 649 | `NE_EU_PostStartListBoxEdit` | `NE_EU_PostStartListBoxEdit(hwnd, element_id, index, field)` | int | new_emoji 原生界面库 底层导出 EU_PostStartListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 650 | `NE_EU_CommitListBoxEdit` | `NE_EU_CommitListBoxEdit(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_CommitListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 651 | `NE_EU_PostCommitListBoxEdit` | `NE_EU_PostCommitListBoxEdit(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_PostCommitListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 652 | `NE_EU_CancelListBoxEdit` | `NE_EU_CancelListBoxEdit(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_CancelListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 653 | `NE_EU_PostCancelListBoxEdit` | `NE_EU_PostCancelListBoxEdit(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_PostCancelListBoxEdit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 654 | `NE_EU_SetListBoxEditOptions` | `NE_EU_SetListBoxEditOptions(hwnd, element_id, editable_fields, commit_on_blur)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxEditOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 655 | `NE_EU_PostSetListBoxEditOptions` | `NE_EU_PostSetListBoxEditOptions(hwnd, element_id, editable_fields, commit_on_blur)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxEditOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 656 | `NE_EU_SetListBoxScroll` | `NE_EU_SetListBoxScroll(hwnd, element_id, scroll_y)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 657 | `NE_EU_PostSetListBoxScroll` | `NE_EU_PostSetListBoxScroll(hwnd, element_id, scroll_y)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 658 | `NE_EU_GetListBoxScroll` | `NE_EU_GetListBoxScroll(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 659 | `NE_EU_SetListBoxOptions` | `NE_EU_SetListBoxOptions(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 660 | `NE_EU_PostSetListBoxOptions` | `NE_EU_PostSetListBoxOptions(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 661 | `NE_EU_GetListBoxOptions` | `NE_EU_GetListBoxOptions(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 662 | `NE_EU_SetListBoxStyle` | `NE_EU_SetListBoxStyle(hwnd, element_id, row_height, indent_width, radius, padding_x, icon_width, scrollbar_width, align, selected_color, hover_color)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 663 | `NE_EU_PostSetListBoxStyle` | `NE_EU_PostSetListBoxStyle(hwnd, element_id, row_height, indent_width, radius, padding_x, icon_width, scrollbar_width, align, selected_color, hover_color)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 664 | `NE_EU_GetListBoxFullState` | `NE_EU_GetListBoxFullState(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetListBoxFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 665 | `NE_EU_SetListBoxVirtualItemCount` | `NE_EU_SetListBoxVirtualItemCount(hwnd, element_id, count)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxVirtualItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 666 | `NE_EU_PostSetListBoxVirtualItemCount` | `NE_EU_PostSetListBoxVirtualItemCount(hwnd, element_id, count)` | int | new_emoji 原生界面库 底层导出 EU_PostSetListBoxVirtualItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 667 | `NE_EU_SetListBoxVirtualItemProvider` | `NE_EU_SetListBoxVirtualItemProvider(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxVirtualItemProvider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 668 | `NE_EU_RefreshListBoxVirtualItems` | `NE_EU_RefreshListBoxVirtualItems(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_RefreshListBoxVirtualItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 669 | `NE_EU_PostRefreshListBoxVirtualItems` | `NE_EU_PostRefreshListBoxVirtualItems(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_PostRefreshListBoxVirtualItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 670 | `NE_EU_SetListBoxChangeCallback` | `NE_EU_SetListBoxChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 671 | `NE_EU_SetListBoxItemClickCallback` | `NE_EU_SetListBoxItemClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItemClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 672 | `NE_EU_SetListBoxItemDoubleClickCallback` | `NE_EU_SetListBoxItemDoubleClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxItemDoubleClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 673 | `NE_EU_SetListBoxEditCallback` | `NE_EU_SetListBoxEditCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxEditCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 674 | `NE_EU_SetListBoxReorderCallback` | `NE_EU_SetListBoxReorderCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxReorderCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 675 | `NE_EU_SetListBoxContextMenuCallback` | `NE_EU_SetListBoxContextMenuCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetListBoxContextMenuCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 676 | `NE_EU_SetCardTitle` | `NE_EU_SetCardTitle(hwnd, element_id, title_bytes, title_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCardTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 677 | `NE_EU_SetCardBody` | `NE_EU_SetCardBody(hwnd, element_id, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCardBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 678 | `NE_EU_SetCardFooter` | `NE_EU_SetCardFooter(hwnd, element_id, footer_bytes, footer_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCardFooter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 679 | `NE_EU_SetCardItems` | `NE_EU_SetCardItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCardItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 680 | `NE_EU_SetCardActions` | `NE_EU_SetCardActions(hwnd, element_id, actions_bytes, actions_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCardActions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 681 | `NE_EU_GetCardItemCount` | `NE_EU_GetCardItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCardItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 682 | `NE_EU_GetCardAction` | `NE_EU_GetCardAction(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCardAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 683 | `NE_EU_ResetCardAction` | `NE_EU_ResetCardAction(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ResetCardAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 684 | `NE_EU_SetCardShadow` | `NE_EU_SetCardShadow(hwnd, element_id, shadow)` | void | new_emoji 原生界面库 底层导出 EU_SetCardShadow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 685 | `NE_EU_SetCardOptions` | `NE_EU_SetCardOptions(hwnd, element_id, shadow, hoverable)` | void | new_emoji 原生界面库 底层导出 EU_SetCardOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 686 | `NE_EU_SetCardStyle` | `NE_EU_SetCardStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | void | new_emoji 原生界面库 底层导出 EU_SetCardStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 687 | `NE_EU_GetCardStyle` | `NE_EU_GetCardStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | int | new_emoji 原生界面库 底层导出 EU_GetCardStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 688 | `NE_EU_SetCardBodyStyle` | `NE_EU_SetCardBodyStyle(hwnd, element_id, pad_left, pad_top, pad_right, pad_bottom, font_size, item_gap, item_padding_y, divider)` | void | new_emoji 原生界面库 底层导出 EU_SetCardBodyStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 689 | `NE_EU_GetCardBodyStyle` | `NE_EU_GetCardBodyStyle(hwnd, element_id, pad_left, pad_top, pad_right, pad_bottom, font_size, item_gap, item_padding_y, divider)` | int | new_emoji 原生界面库 底层导出 EU_GetCardBodyStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 690 | `NE_EU_GetCardOptions` | `NE_EU_GetCardOptions(hwnd, element_id, shadow, hoverable, action_count)` | int | new_emoji 原生界面库 底层导出 EU_GetCardOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 691 | `NE_EU_SetCollapseItems` | `NE_EU_SetCollapseItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 692 | `NE_EU_SetCollapseItemsEx` | `NE_EU_SetCollapseItemsEx(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 693 | `NE_EU_SetCollapseActive` | `NE_EU_SetCollapseActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 694 | `NE_EU_GetCollapseActive` | `NE_EU_GetCollapseActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCollapseActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 695 | `NE_EU_SetCollapseActiveItems` | `NE_EU_SetCollapseActiveItems(hwnd, element_id, indices_bytes, indices_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseActiveItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 696 | `NE_EU_GetCollapseActiveItems` | `NE_EU_GetCollapseActiveItems(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetCollapseActiveItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 697 | `NE_EU_GetCollapseItemCount` | `NE_EU_GetCollapseItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCollapseItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 698 | `NE_EU_SetCollapseOptions` | `NE_EU_SetCollapseOptions(hwnd, element_id, accordion, allow_collapse, disabled_bytes, disabled_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 699 | `NE_EU_SetCollapseAdvancedOptions` | `NE_EU_SetCollapseAdvancedOptions(hwnd, element_id, accordion, allow_collapse, animated, disabled_bytes, disabled_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 700 | `NE_EU_GetCollapseOptions` | `NE_EU_GetCollapseOptions(hwnd, element_id, accordion, allow_collapse, animated, disabled_count)` | int | new_emoji 原生界面库 底层导出 EU_GetCollapseOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 701 | `NE_EU_GetCollapseStateJson` | `NE_EU_GetCollapseStateJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetCollapseStateJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 702 | `NE_EU_SetCollapseChangeCallback` | `NE_EU_SetCollapseChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetCollapseChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 703 | `NE_EU_SetTimelineItems` | `NE_EU_SetTimelineItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTimelineItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 704 | `NE_EU_SetTimelineOptions` | `NE_EU_SetTimelineOptions(hwnd, element_id, position, show_time)` | void | new_emoji 原生界面库 底层导出 EU_SetTimelineOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 705 | `NE_EU_GetTimelineItemCount` | `NE_EU_GetTimelineItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimelineItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 706 | `NE_EU_GetTimelineOptions` | `NE_EU_GetTimelineOptions(hwnd, element_id, position, show_time)` | int | new_emoji 原生界面库 底层导出 EU_GetTimelineOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 707 | `NE_EU_SetTimelineAdvancedOptions` | `NE_EU_SetTimelineAdvancedOptions(hwnd, element_id, position, show_time, reverse, default_placement)` | void | new_emoji 原生界面库 底层导出 EU_SetTimelineAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 708 | `NE_EU_GetTimelineAdvancedOptions` | `NE_EU_GetTimelineAdvancedOptions(hwnd, element_id, position, show_time, reverse, default_placement)` | int | new_emoji 原生界面库 底层导出 EU_GetTimelineAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 709 | `NE_EU_SetStatisticValue` | `NE_EU_SetStatisticValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 710 | `NE_EU_PostSetStatisticValue` | `NE_EU_PostSetStatisticValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetStatisticValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 711 | `NE_EU_SetStatisticFormat` | `NE_EU_SetStatisticFormat(hwnd, element_id, title_bytes, title_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticFormat。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 712 | `NE_EU_SetStatisticOptions` | `NE_EU_SetStatisticOptions(hwnd, element_id, precision, animated)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 713 | `NE_EU_GetStatisticOptions` | `NE_EU_GetStatisticOptions(hwnd, element_id, precision, animated)` | int | new_emoji 原生界面库 底层导出 EU_GetStatisticOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 714 | `NE_EU_SetStatisticNumberOptions` | `NE_EU_SetStatisticNumberOptions(hwnd, element_id, precision, animated, use_group_separator, group_separator_bytes, group_separator_len, decimal_separator_bytes, decimal_separator_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticNumberOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 715 | `NE_EU_SetStatisticAffixOptions` | `NE_EU_SetStatisticAffixOptions(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len, prefix_color, suffix_color, value_color, suffix_clickable)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticAffixOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 716 | `NE_EU_SetStatisticDisplayText` | `NE_EU_SetStatisticDisplayText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticDisplayText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 717 | `NE_EU_SetStatisticCountdown` | `NE_EU_SetStatisticCountdown(hwnd, element_id, target_unix_ms, format_bytes, format_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticCountdown。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 718 | `NE_EU_SetStatisticCountdownState` | `NE_EU_SetStatisticCountdownState(hwnd, element_id, paused)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticCountdownState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 719 | `NE_EU_AddStatisticCountdownTime` | `NE_EU_AddStatisticCountdownTime(hwnd, element_id, delta_ms)` | void | new_emoji 原生界面库 底层导出 EU_AddStatisticCountdownTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 720 | `NE_EU_SetStatisticFinishCallback` | `NE_EU_SetStatisticFinishCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticFinishCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 721 | `NE_EU_SetStatisticSuffixClickCallback` | `NE_EU_SetStatisticSuffixClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetStatisticSuffixClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 722 | `NE_EU_GetStatisticFullState` | `NE_EU_GetStatisticFullState(hwnd, element_id, mode, precision, animated, use_group_separator, countdown_paused, countdown_finished, suffix_click_count, remaining_ms)` | int | new_emoji 原生界面库 底层导出 EU_GetStatisticFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 723 | `NE_EU_SetKpiCardData` | `NE_EU_SetKpiCardData(hwnd, element_id, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type)` | void | new_emoji 原生界面库 底层导出 EU_SetKpiCardData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 724 | `NE_EU_PostSetKpiCardData` | `NE_EU_PostSetKpiCardData(hwnd, element_id, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type)` | int | new_emoji 原生界面库 底层导出 EU_PostSetKpiCardData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 725 | `NE_EU_SetKpiCardOptions` | `NE_EU_SetKpiCardOptions(hwnd, element_id, loading, helper_bytes, helper_len)` | void | new_emoji 原生界面库 底层导出 EU_SetKpiCardOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 726 | `NE_EU_GetKpiCardOptions` | `NE_EU_GetKpiCardOptions(hwnd, element_id, loading, trend_type)` | int | new_emoji 原生界面库 底层导出 EU_GetKpiCardOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 727 | `NE_EU_SetTrendData` | `NE_EU_SetTrendData(hwnd, element_id, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction)` | void | new_emoji 原生界面库 底层导出 EU_SetTrendData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 728 | `NE_EU_PostSetTrendData` | `NE_EU_PostSetTrendData(hwnd, element_id, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTrendData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 729 | `NE_EU_SetTrendOptions` | `NE_EU_SetTrendOptions(hwnd, element_id, inverse, show_icon)` | void | new_emoji 原生界面库 底层导出 EU_SetTrendOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 730 | `NE_EU_GetTrendDirection` | `NE_EU_GetTrendDirection(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTrendDirection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 731 | `NE_EU_GetTrendOptions` | `NE_EU_GetTrendOptions(hwnd, element_id, inverse, show_icon)` | int | new_emoji 原生界面库 底层导出 EU_GetTrendOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 732 | `NE_EU_SetStatusDot` | `NE_EU_SetStatusDot(hwnd, element_id, label_bytes, label_len, desc_bytes, desc_len, status)` | void | new_emoji 原生界面库 底层导出 EU_SetStatusDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 733 | `NE_EU_PostSetStatusDot` | `NE_EU_PostSetStatusDot(hwnd, element_id, label_bytes, label_len, desc_bytes, desc_len, status)` | int | new_emoji 原生界面库 底层导出 EU_PostSetStatusDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 734 | `NE_EU_SetStatusDotOptions` | `NE_EU_SetStatusDotOptions(hwnd, element_id, pulse, compact)` | void | new_emoji 原生界面库 底层导出 EU_SetStatusDotOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 735 | `NE_EU_GetStatusDotStatus` | `NE_EU_GetStatusDotStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetStatusDotStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 736 | `NE_EU_GetStatusDotOptions` | `NE_EU_GetStatusDotOptions(hwnd, element_id, pulse, compact)` | int | new_emoji 原生界面库 底层导出 EU_GetStatusDotOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 737 | `NE_EU_SetGaugeValue` | `NE_EU_SetGaugeValue(hwnd, element_id, value, caption_bytes, caption_len, status)` | void | new_emoji 原生界面库 底层导出 EU_SetGaugeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 738 | `NE_EU_PostSetGaugeValue` | `NE_EU_PostSetGaugeValue(hwnd, element_id, value, caption_bytes, caption_len, status)` | int | new_emoji 原生界面库 底层导出 EU_PostSetGaugeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 739 | `NE_EU_SetGaugeOptions` | `NE_EU_SetGaugeOptions(hwnd, element_id, min_value, max_value, warning_value, danger_value, stroke_width)` | void | new_emoji 原生界面库 底层导出 EU_SetGaugeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 740 | `NE_EU_GetGaugeValue` | `NE_EU_GetGaugeValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetGaugeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 741 | `NE_EU_GetGaugeStatus` | `NE_EU_GetGaugeStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetGaugeStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 742 | `NE_EU_GetGaugeOptions` | `NE_EU_GetGaugeOptions(hwnd, element_id, min_value, max_value, warning_value, danger_value, stroke_width)` | int | new_emoji 原生界面库 底层导出 EU_GetGaugeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 743 | `NE_EU_SetRingProgressValue` | `NE_EU_SetRingProgressValue(hwnd, element_id, value, label_bytes, label_len, status)` | void | new_emoji 原生界面库 底层导出 EU_SetRingProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 744 | `NE_EU_PostSetRingProgressValue` | `NE_EU_PostSetRingProgressValue(hwnd, element_id, value, label_bytes, label_len, status)` | int | new_emoji 原生界面库 底层导出 EU_PostSetRingProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 745 | `NE_EU_SetRingProgressOptions` | `NE_EU_SetRingProgressOptions(hwnd, element_id, stroke_width, show_center)` | void | new_emoji 原生界面库 底层导出 EU_SetRingProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 746 | `NE_EU_GetRingProgressValue` | `NE_EU_GetRingProgressValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRingProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 747 | `NE_EU_GetRingProgressStatus` | `NE_EU_GetRingProgressStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetRingProgressStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 748 | `NE_EU_GetRingProgressOptions` | `NE_EU_GetRingProgressOptions(hwnd, element_id, stroke_width, show_center)` | int | new_emoji 原生界面库 底层导出 EU_GetRingProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 749 | `NE_EU_SetBulletProgressValue` | `NE_EU_SetBulletProgressValue(hwnd, element_id, value, target, desc_bytes, desc_len, status)` | void | new_emoji 原生界面库 底层导出 EU_SetBulletProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 750 | `NE_EU_PostSetBulletProgressValue` | `NE_EU_PostSetBulletProgressValue(hwnd, element_id, value, target, desc_bytes, desc_len, status)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBulletProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 751 | `NE_EU_SetBulletProgressOptions` | `NE_EU_SetBulletProgressOptions(hwnd, element_id, good_threshold, warn_threshold, show_target)` | void | new_emoji 原生界面库 底层导出 EU_SetBulletProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 752 | `NE_EU_GetBulletProgressValue` | `NE_EU_GetBulletProgressValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBulletProgressValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 753 | `NE_EU_GetBulletProgressTarget` | `NE_EU_GetBulletProgressTarget(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBulletProgressTarget。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 754 | `NE_EU_GetBulletProgressStatus` | `NE_EU_GetBulletProgressStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBulletProgressStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 755 | `NE_EU_GetBulletProgressOptions` | `NE_EU_GetBulletProgressOptions(hwnd, element_id, good_threshold, warn_threshold, show_target)` | int | new_emoji 原生界面库 底层导出 EU_GetBulletProgressOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 756 | `NE_EU_SetLineChartData` | `NE_EU_SetLineChartData(hwnd, element_id, points_bytes, points_len)` | void | new_emoji 原生界面库 底层导出 EU_SetLineChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 757 | `NE_EU_PostSetLineChartData` | `NE_EU_PostSetLineChartData(hwnd, element_id, points_bytes, points_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetLineChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 758 | `NE_EU_SetLineChartSeries` | `NE_EU_SetLineChartSeries(hwnd, element_id, series_bytes, series_len)` | void | new_emoji 原生界面库 底层导出 EU_SetLineChartSeries。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 759 | `NE_EU_SetLineChartOptions` | `NE_EU_SetLineChartOptions(hwnd, element_id, chart_style, show_axis, show_area, show_tooltip)` | void | new_emoji 原生界面库 底层导出 EU_SetLineChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 760 | `NE_EU_SetLineChartSelected` | `NE_EU_SetLineChartSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetLineChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 761 | `NE_EU_PostSetLineChartSelected` | `NE_EU_PostSetLineChartSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetLineChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 762 | `NE_EU_GetLineChartPointCount` | `NE_EU_GetLineChartPointCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLineChartPointCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 763 | `NE_EU_GetLineChartSeriesCount` | `NE_EU_GetLineChartSeriesCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLineChartSeriesCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 764 | `NE_EU_GetLineChartSelected` | `NE_EU_GetLineChartSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLineChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 765 | `NE_EU_GetLineChartOptions` | `NE_EU_GetLineChartOptions(hwnd, element_id, chart_style, show_axis, show_area, show_tooltip)` | int | new_emoji 原生界面库 底层导出 EU_GetLineChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 766 | `NE_EU_SetBarChartData` | `NE_EU_SetBarChartData(hwnd, element_id, bars_bytes, bars_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBarChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 767 | `NE_EU_PostSetBarChartData` | `NE_EU_PostSetBarChartData(hwnd, element_id, bars_bytes, bars_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBarChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 768 | `NE_EU_SetBarChartSeries` | `NE_EU_SetBarChartSeries(hwnd, element_id, series_bytes, series_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBarChartSeries。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 769 | `NE_EU_SetBarChartOptions` | `NE_EU_SetBarChartOptions(hwnd, element_id, orientation, show_values, show_axis)` | void | new_emoji 原生界面库 底层导出 EU_SetBarChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 770 | `NE_EU_SetBarChartSelected` | `NE_EU_SetBarChartSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetBarChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 771 | `NE_EU_PostSetBarChartSelected` | `NE_EU_PostSetBarChartSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBarChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 772 | `NE_EU_GetBarChartBarCount` | `NE_EU_GetBarChartBarCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBarChartBarCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 773 | `NE_EU_GetBarChartSeriesCount` | `NE_EU_GetBarChartSeriesCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBarChartSeriesCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 774 | `NE_EU_GetBarChartSelected` | `NE_EU_GetBarChartSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBarChartSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 775 | `NE_EU_GetBarChartOptions` | `NE_EU_GetBarChartOptions(hwnd, element_id, orientation, show_values, show_axis)` | int | new_emoji 原生界面库 底层导出 EU_GetBarChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 776 | `NE_EU_SetDonutChartData` | `NE_EU_SetDonutChartData(hwnd, element_id, slices_bytes, slices_len, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetDonutChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 777 | `NE_EU_PostSetDonutChartData` | `NE_EU_PostSetDonutChartData(hwnd, element_id, slices_bytes, slices_len, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDonutChartData。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 778 | `NE_EU_SetDonutChartOptions` | `NE_EU_SetDonutChartOptions(hwnd, element_id, show_legend, ring_width)` | void | new_emoji 原生界面库 底层导出 EU_SetDonutChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 779 | `NE_EU_SetDonutChartAdvancedOptions` | `NE_EU_SetDonutChartAdvancedOptions(hwnd, element_id, show_legend, ring_width, show_labels)` | void | new_emoji 原生界面库 底层导出 EU_SetDonutChartAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 780 | `NE_EU_SetDonutChartActive` | `NE_EU_SetDonutChartActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetDonutChartActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 781 | `NE_EU_PostSetDonutChartActive` | `NE_EU_PostSetDonutChartActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDonutChartActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 782 | `NE_EU_GetDonutChartSliceCount` | `NE_EU_GetDonutChartSliceCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDonutChartSliceCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 783 | `NE_EU_GetDonutChartActive` | `NE_EU_GetDonutChartActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDonutChartActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 784 | `NE_EU_GetDonutChartOptions` | `NE_EU_GetDonutChartOptions(hwnd, element_id, show_legend, ring_width)` | int | new_emoji 原生界面库 底层导出 EU_GetDonutChartOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 785 | `NE_EU_GetDonutChartAdvancedOptions` | `NE_EU_GetDonutChartAdvancedOptions(hwnd, element_id, show_legend, ring_width, show_labels)` | int | new_emoji 原生界面库 底层导出 EU_GetDonutChartAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 786 | `NE_EU_SetCalendarDate` | `NE_EU_SetCalendarDate(hwnd, element_id, year, month, selected_day)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarDate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 787 | `NE_EU_SetCalendarRange` | `NE_EU_SetCalendarRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 788 | `NE_EU_SetCalendarOptions` | `NE_EU_SetCalendarOptions(hwnd, element_id, today_yyyymmdd, show_today)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 789 | `NE_EU_CalendarMoveMonth` | `NE_EU_CalendarMoveMonth(hwnd, element_id, delta_months)` | void | new_emoji 原生界面库 底层导出 EU_CalendarMoveMonth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 790 | `NE_EU_GetCalendarValue` | `NE_EU_GetCalendarValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 791 | `NE_EU_GetCalendarRange` | `NE_EU_GetCalendarRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 792 | `NE_EU_GetCalendarOptions` | `NE_EU_GetCalendarOptions(hwnd, element_id, today_yyyymmdd, show_today)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 793 | `NE_EU_SetCalendarSelectionRange` | `NE_EU_SetCalendarSelectionRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarSelectionRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 794 | `NE_EU_GetCalendarSelectionRange` | `NE_EU_GetCalendarSelectionRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarSelectionRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 795 | `NE_EU_SetCalendarDisplayRange` | `NE_EU_SetCalendarDisplayRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarDisplayRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 796 | `NE_EU_GetCalendarDisplayRange` | `NE_EU_GetCalendarDisplayRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarDisplayRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 797 | `NE_EU_SetCalendarCellItems` | `NE_EU_SetCalendarCellItems(hwnd, element_id, spec_bytes, spec_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarCellItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 798 | `NE_EU_GetCalendarCellItems` | `NE_EU_GetCalendarCellItems(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarCellItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 799 | `NE_EU_ClearCalendarCellItems` | `NE_EU_ClearCalendarCellItems(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearCalendarCellItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 800 | `NE_EU_SetCalendarVisualOptions` | `NE_EU_SetCalendarVisualOptions(hwnd, element_id, show_header, show_week_header, label_mode, show_adjacent_days, cell_radius)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 801 | `NE_EU_GetCalendarVisualOptions` | `NE_EU_GetCalendarVisualOptions(hwnd, element_id, show_header, show_week_header, label_mode, show_adjacent_days, cell_radius)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarVisualOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 802 | `NE_EU_SetCalendarStateColors` | `NE_EU_SetCalendarStateColors(hwnd, element_id, selected_bg, selected_fg, range_bg, today_border, hover_bg, disabled_fg, adjacent_fg)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarStateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 803 | `NE_EU_GetCalendarStateColors` | `NE_EU_GetCalendarStateColors(hwnd, element_id, selected_bg, selected_fg, range_bg, today_border, hover_bg, disabled_fg, adjacent_fg)` | int | new_emoji 原生界面库 底层导出 EU_GetCalendarStateColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 804 | `NE_EU_SetCalendarSelectedMarker` | `NE_EU_SetCalendarSelectedMarker(hwnd, element_id, marker_bytes, marker_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarSelectedMarker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 805 | `NE_EU_SetCalendarChangeCallback` | `NE_EU_SetCalendarChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetCalendarChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 806 | `NE_EU_SetTreeItems` | `NE_EU_SetTreeItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 807 | `NE_EU_PostSetTreeItems` | `NE_EU_PostSetTreeItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 808 | `NE_EU_SetTreeSelected` | `NE_EU_SetTreeSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 809 | `NE_EU_PostSetTreeSelected` | `NE_EU_PostSetTreeSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 810 | `NE_EU_GetTreeSelected` | `NE_EU_GetTreeSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 811 | `NE_EU_SetTreeOptions` | `NE_EU_SetTreeOptions(hwnd, element_id, show_checkbox, keyboard_navigation, lazy_mode)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 812 | `NE_EU_GetTreeOptions` | `NE_EU_GetTreeOptions(hwnd, element_id, show_checkbox, keyboard_navigation, lazy_mode, checked_count, last_lazy_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 813 | `NE_EU_SetTreeItemExpanded` | `NE_EU_SetTreeItemExpanded(hwnd, element_id, item_index, expanded)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 814 | `NE_EU_PostSetTreeItemExpanded` | `NE_EU_PostSetTreeItemExpanded(hwnd, element_id, item_index, expanded)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 815 | `NE_EU_ToggleTreeItemExpanded` | `NE_EU_ToggleTreeItemExpanded(hwnd, element_id, item_index)` | void | new_emoji 原生界面库 底层导出 EU_ToggleTreeItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 816 | `NE_EU_GetTreeItemExpanded` | `NE_EU_GetTreeItemExpanded(hwnd, element_id, item_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 817 | `NE_EU_SetTreeItemChecked` | `NE_EU_SetTreeItemChecked(hwnd, element_id, item_index, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeItemChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 818 | `NE_EU_PostSetTreeItemChecked` | `NE_EU_PostSetTreeItemChecked(hwnd, element_id, item_index, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeItemChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 819 | `NE_EU_GetTreeItemChecked` | `NE_EU_GetTreeItemChecked(hwnd, element_id, item_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeItemChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 820 | `NE_EU_SetTreeItemLazy` | `NE_EU_SetTreeItemLazy(hwnd, element_id, item_index, lazy)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeItemLazy。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 821 | `NE_EU_GetTreeItemLazy` | `NE_EU_GetTreeItemLazy(hwnd, element_id, item_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeItemLazy。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 822 | `NE_EU_GetTreeVisibleCount` | `NE_EU_GetTreeVisibleCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeVisibleCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 823 | `NE_EU_SetTreeSelectItems` | `NE_EU_SetTreeSelectItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 824 | `NE_EU_PostSetTreeSelectItems` | `NE_EU_PostSetTreeSelectItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 825 | `NE_EU_SetTreeSelectSelected` | `NE_EU_SetTreeSelectSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 826 | `NE_EU_PostSetTreeSelectSelected` | `NE_EU_PostSetTreeSelectSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 827 | `NE_EU_GetTreeSelectSelected` | `NE_EU_GetTreeSelectSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 828 | `NE_EU_SetTreeSelectOpen` | `NE_EU_SetTreeSelectOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 829 | `NE_EU_PostSetTreeSelectOpen` | `NE_EU_PostSetTreeSelectOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 830 | `NE_EU_GetTreeSelectOpen` | `NE_EU_GetTreeSelectOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 831 | `NE_EU_SetTreeSelectOptions` | `NE_EU_SetTreeSelectOptions(hwnd, element_id, multiple, clearable, searchable)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 832 | `NE_EU_GetTreeSelectOptions` | `NE_EU_GetTreeSelectOptions(hwnd, element_id, multiple, clearable, searchable, selected_count, matched_count)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 833 | `NE_EU_SetTreeSelectSearch` | `NE_EU_SetTreeSelectSearch(hwnd, element_id, search_bytes, search_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 834 | `NE_EU_PostSetTreeSelectSearch` | `NE_EU_PostSetTreeSelectSearch(hwnd, element_id, search_bytes, search_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 835 | `NE_EU_GetTreeSelectSearch` | `NE_EU_GetTreeSelectSearch(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 836 | `NE_EU_ClearTreeSelect` | `NE_EU_ClearTreeSelect(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearTreeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 837 | `NE_EU_SetTreeSelectSelectedItems` | `NE_EU_SetTreeSelectSelectedItems(hwnd, element_id, indices_bytes, indices_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectSelectedItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 838 | `NE_EU_GetTreeSelectSelectedCount` | `NE_EU_GetTreeSelectSelectedCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectSelectedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 839 | `NE_EU_GetTreeSelectSelectedItem` | `NE_EU_GetTreeSelectSelectedItem(hwnd, element_id, position)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectSelectedItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 840 | `NE_EU_SetTreeSelectItemExpanded` | `NE_EU_SetTreeSelectItemExpanded(hwnd, element_id, item_index, expanded)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 841 | `NE_EU_ToggleTreeSelectItemExpanded` | `NE_EU_ToggleTreeSelectItemExpanded(hwnd, element_id, item_index)` | void | new_emoji 原生界面库 底层导出 EU_ToggleTreeSelectItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 842 | `NE_EU_GetTreeSelectItemExpanded` | `NE_EU_GetTreeSelectItemExpanded(hwnd, element_id, item_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectItemExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 843 | `NE_EU_SetTreeDataJson` | `NE_EU_SetTreeDataJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 844 | `NE_EU_PostSetTreeDataJson` | `NE_EU_PostSetTreeDataJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 845 | `NE_EU_GetTreeDataJson` | `NE_EU_GetTreeDataJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 846 | `NE_EU_SetTreeOptionsJson` | `NE_EU_SetTreeOptionsJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeOptionsJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 847 | `NE_EU_GetTreeStateJson` | `NE_EU_GetTreeStateJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeStateJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 848 | `NE_EU_SetTreeCheckedKeysJson` | `NE_EU_SetTreeCheckedKeysJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeCheckedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 849 | `NE_EU_PostSetTreeCheckedKeysJson` | `NE_EU_PostSetTreeCheckedKeysJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeCheckedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 850 | `NE_EU_GetTreeCheckedKeysJson` | `NE_EU_GetTreeCheckedKeysJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeCheckedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 851 | `NE_EU_SetTreeExpandedKeysJson` | `NE_EU_SetTreeExpandedKeysJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 852 | `NE_EU_PostSetTreeExpandedKeysJson` | `NE_EU_PostSetTreeExpandedKeysJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 853 | `NE_EU_GetTreeExpandedKeysJson` | `NE_EU_GetTreeExpandedKeysJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 854 | `NE_EU_AppendTreeNodeJson` | `NE_EU_AppendTreeNodeJson(hwnd, element_id, parent_key_bytes, parent_key_len, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_AppendTreeNodeJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 855 | `NE_EU_UpdateTreeNodeJson` | `NE_EU_UpdateTreeNodeJson(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_UpdateTreeNodeJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 856 | `NE_EU_RemoveTreeNodeByKey` | `NE_EU_RemoveTreeNodeByKey(hwnd, element_id, key_bytes, key_len)` | void | new_emoji 原生界面库 底层导出 EU_RemoveTreeNodeByKey。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 857 | `NE_EU_SetTreeNodeEventCallback` | `NE_EU_SetTreeNodeEventCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeNodeEventCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 858 | `NE_EU_SetTreeLazyLoadCallback` | `NE_EU_SetTreeLazyLoadCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeLazyLoadCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 859 | `NE_EU_SetTreeDragCallback` | `NE_EU_SetTreeDragCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeDragCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 860 | `NE_EU_SetTreeAllowDragCallback` | `NE_EU_SetTreeAllowDragCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeAllowDragCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 861 | `NE_EU_SetTreeAllowDropCallback` | `NE_EU_SetTreeAllowDropCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeAllowDropCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 862 | `NE_EU_SetTreeSelectDataJson` | `NE_EU_SetTreeSelectDataJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 863 | `NE_EU_PostSetTreeSelectDataJson` | `NE_EU_PostSetTreeSelectDataJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 864 | `NE_EU_GetTreeSelectDataJson` | `NE_EU_GetTreeSelectDataJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectDataJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 865 | `NE_EU_SetTreeSelectOptionsJson` | `NE_EU_SetTreeSelectOptionsJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectOptionsJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 866 | `NE_EU_GetTreeSelectStateJson` | `NE_EU_GetTreeSelectStateJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectStateJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 867 | `NE_EU_SetTreeSelectSelectedKeysJson` | `NE_EU_SetTreeSelectSelectedKeysJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectSelectedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 868 | `NE_EU_PostSetTreeSelectSelectedKeysJson` | `NE_EU_PostSetTreeSelectSelectedKeysJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectSelectedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 869 | `NE_EU_GetTreeSelectSelectedKeysJson` | `NE_EU_GetTreeSelectSelectedKeysJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectSelectedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 870 | `NE_EU_SetTreeSelectExpandedKeysJson` | `NE_EU_SetTreeSelectExpandedKeysJson(hwnd, element_id, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 871 | `NE_EU_PostSetTreeSelectExpandedKeysJson` | `NE_EU_PostSetTreeSelectExpandedKeysJson(hwnd, element_id, json_bytes, json_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTreeSelectExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 872 | `NE_EU_GetTreeSelectExpandedKeysJson` | `NE_EU_GetTreeSelectExpandedKeysJson(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTreeSelectExpandedKeysJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 873 | `NE_EU_AppendTreeSelectNodeJson` | `NE_EU_AppendTreeSelectNodeJson(hwnd, element_id, parent_key_bytes, parent_key_len, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_AppendTreeSelectNodeJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 874 | `NE_EU_UpdateTreeSelectNodeJson` | `NE_EU_UpdateTreeSelectNodeJson(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | void | new_emoji 原生界面库 底层导出 EU_UpdateTreeSelectNodeJson。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 875 | `NE_EU_RemoveTreeSelectNodeByKey` | `NE_EU_RemoveTreeSelectNodeByKey(hwnd, element_id, key_bytes, key_len)` | void | new_emoji 原生界面库 底层导出 EU_RemoveTreeSelectNodeByKey。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 876 | `NE_EU_SetTreeSelectNodeEventCallback` | `NE_EU_SetTreeSelectNodeEventCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectNodeEventCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 877 | `NE_EU_SetTreeSelectLazyLoadCallback` | `NE_EU_SetTreeSelectLazyLoadCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectLazyLoadCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 878 | `NE_EU_SetTreeSelectDragCallback` | `NE_EU_SetTreeSelectDragCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectDragCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 879 | `NE_EU_SetTreeSelectAllowDragCallback` | `NE_EU_SetTreeSelectAllowDragCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectAllowDragCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 880 | `NE_EU_SetTreeSelectAllowDropCallback` | `NE_EU_SetTreeSelectAllowDropCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTreeSelectAllowDropCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 881 | `NE_EU_SetTransferItems` | `NE_EU_SetTransferItems(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 882 | `NE_EU_PostSetTransferItems` | `NE_EU_PostSetTransferItems(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTransferItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 883 | `NE_EU_TransferMoveRight` | `NE_EU_TransferMoveRight(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TransferMoveRight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 884 | `NE_EU_TransferMoveLeft` | `NE_EU_TransferMoveLeft(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TransferMoveLeft。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 885 | `NE_EU_TransferMoveAllRight` | `NE_EU_TransferMoveAllRight(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TransferMoveAllRight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 886 | `NE_EU_TransferMoveAllLeft` | `NE_EU_TransferMoveAllLeft(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TransferMoveAllLeft。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 887 | `NE_EU_SetTransferSelected` | `NE_EU_SetTransferSelected(hwnd, element_id, side, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 888 | `NE_EU_PostSetTransferSelected` | `NE_EU_PostSetTransferSelected(hwnd, element_id, side, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTransferSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 889 | `NE_EU_GetTransferSelected` | `NE_EU_GetTransferSelected(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 890 | `NE_EU_GetTransferCount` | `NE_EU_GetTransferCount(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 891 | `NE_EU_SetTransferFilters` | `NE_EU_SetTransferFilters(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferFilters。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 892 | `NE_EU_GetTransferMatchedCount` | `NE_EU_GetTransferMatchedCount(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferMatchedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 893 | `NE_EU_SetTransferItemDisabled` | `NE_EU_SetTransferItemDisabled(hwnd, element_id, side, item_index, disabled)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferItemDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 894 | `NE_EU_GetTransferItemDisabled` | `NE_EU_GetTransferItemDisabled(hwnd, element_id, side, item_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferItemDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 895 | `NE_EU_GetTransferDisabledCount` | `NE_EU_GetTransferDisabledCount(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferDisabledCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 896 | `NE_EU_SetTransferDataEx` | `NE_EU_SetTransferDataEx(hwnd, element_id, items_bytes, items_len, target_bytes, target_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferDataEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 897 | `NE_EU_PostSetTransferDataEx` | `NE_EU_PostSetTransferDataEx(hwnd, element_id, items_bytes, items_len, target_bytes, target_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTransferDataEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 898 | `NE_EU_SetTransferOptions` | `NE_EU_SetTransferOptions(hwnd, element_id, filterable, multiple, show_footer, show_select_all, show_count, render_mode)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 899 | `NE_EU_GetTransferOptions` | `NE_EU_GetTransferOptions(hwnd, element_id, filterable, multiple, show_footer, show_select_all, show_count, render_mode)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 900 | `NE_EU_SetTransferTitles` | `NE_EU_SetTransferTitles(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferTitles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 901 | `NE_EU_SetTransferButtonTexts` | `NE_EU_SetTransferButtonTexts(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferButtonTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 902 | `NE_EU_SetTransferFormat` | `NE_EU_SetTransferFormat(hwnd, element_id, no_checked_bytes, no_checked_len, has_checked_bytes, has_checked_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferFormat。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 903 | `NE_EU_SetTransferItemTemplate` | `NE_EU_SetTransferItemTemplate(hwnd, element_id, template_bytes, template_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferItemTemplate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 904 | `NE_EU_SetTransferFooterTexts` | `NE_EU_SetTransferFooterTexts(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferFooterTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 905 | `NE_EU_SetTransferFilterPlaceholder` | `NE_EU_SetTransferFilterPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferFilterPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 906 | `NE_EU_SetTransferCheckedKeys` | `NE_EU_SetTransferCheckedKeys(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTransferCheckedKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 907 | `NE_EU_PostSetTransferCheckedKeys` | `NE_EU_PostSetTransferCheckedKeys(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTransferCheckedKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 908 | `NE_EU_GetTransferCheckedCount` | `NE_EU_GetTransferCheckedCount(hwnd, element_id, side)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferCheckedCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 909 | `NE_EU_GetTransferValueKeys` | `NE_EU_GetTransferValueKeys(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferValueKeys。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 910 | `NE_EU_GetTransferText` | `NE_EU_GetTransferText(hwnd, element_id, text_type, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTransferText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 911 | `NE_EU_SetAutocompleteSuggestions` | `NE_EU_SetAutocompleteSuggestions(hwnd, element_id, suggestions_bytes, suggestions_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteSuggestions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 912 | `NE_EU_PostSetAutocompleteSuggestions` | `NE_EU_PostSetAutocompleteSuggestions(hwnd, element_id, suggestions_bytes, suggestions_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAutocompleteSuggestions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 913 | `NE_EU_SetAutocompleteValue` | `NE_EU_SetAutocompleteValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 914 | `NE_EU_PostSetAutocompleteValue` | `NE_EU_PostSetAutocompleteValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAutocompleteValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 915 | `NE_EU_SetAutocompletePlaceholder` | `NE_EU_SetAutocompletePlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompletePlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 916 | `NE_EU_GetAutocompletePlaceholder` | `NE_EU_GetAutocompletePlaceholder(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompletePlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 917 | `NE_EU_SetAutocompleteIcons` | `NE_EU_SetAutocompleteIcons(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 918 | `NE_EU_GetAutocompleteIcons` | `NE_EU_GetAutocompleteIcons(hwnd, element_id, prefix_icon_buffer, prefix_icon_buffer_size, suffix_icon_buffer, suffix_icon_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 919 | `NE_EU_SetAutocompleteBehaviorOptions` | `NE_EU_SetAutocompleteBehaviorOptions(hwnd, element_id, trigger_on_focus)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteBehaviorOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 920 | `NE_EU_GetAutocompleteBehaviorOptions` | `NE_EU_GetAutocompleteBehaviorOptions(hwnd, element_id, trigger_on_focus)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteBehaviorOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 921 | `NE_EU_SetAutocompleteOpen` | `NE_EU_SetAutocompleteOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 922 | `NE_EU_PostSetAutocompleteOpen` | `NE_EU_PostSetAutocompleteOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAutocompleteOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 923 | `NE_EU_SetAutocompleteSelected` | `NE_EU_SetAutocompleteSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 924 | `NE_EU_PostSetAutocompleteSelected` | `NE_EU_PostSetAutocompleteSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAutocompleteSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 925 | `NE_EU_SetAutocompleteAsyncState` | `NE_EU_SetAutocompleteAsyncState(hwnd, element_id, loading, request_id)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteAsyncState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 926 | `NE_EU_PostSetAutocompleteAsyncState` | `NE_EU_PostSetAutocompleteAsyncState(hwnd, element_id, loading, request_id)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAutocompleteAsyncState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 927 | `NE_EU_SetAutocompleteEmptyText` | `NE_EU_SetAutocompleteEmptyText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAutocompleteEmptyText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 928 | `NE_EU_GetAutocompleteValue` | `NE_EU_GetAutocompleteValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 929 | `NE_EU_GetAutocompleteOpen` | `NE_EU_GetAutocompleteOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 930 | `NE_EU_GetAutocompleteSelected` | `NE_EU_GetAutocompleteSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 931 | `NE_EU_GetAutocompleteSuggestionCount` | `NE_EU_GetAutocompleteSuggestionCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteSuggestionCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 932 | `NE_EU_GetAutocompleteOptions` | `NE_EU_GetAutocompleteOptions(hwnd, element_id, open, selected_index, suggestion_count, loading, request_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAutocompleteOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 933 | `NE_EU_SetMentionsValue` | `NE_EU_SetMentionsValue(hwnd, element_id, value_bytes, value_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 934 | `NE_EU_PostSetMentionsValue` | `NE_EU_PostSetMentionsValue(hwnd, element_id, value_bytes, value_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMentionsValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 935 | `NE_EU_SetMentionsSuggestions` | `NE_EU_SetMentionsSuggestions(hwnd, element_id, suggestions_bytes, suggestions_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsSuggestions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 936 | `NE_EU_PostSetMentionsSuggestions` | `NE_EU_PostSetMentionsSuggestions(hwnd, element_id, suggestions_bytes, suggestions_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMentionsSuggestions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 937 | `NE_EU_SetMentionsOpen` | `NE_EU_SetMentionsOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 938 | `NE_EU_PostSetMentionsOpen` | `NE_EU_PostSetMentionsOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMentionsOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 939 | `NE_EU_SetMentionsSelected` | `NE_EU_SetMentionsSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 940 | `NE_EU_PostSetMentionsSelected` | `NE_EU_PostSetMentionsSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMentionsSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 941 | `NE_EU_SetMentionsOptions` | `NE_EU_SetMentionsOptions(hwnd, element_id, trigger_bytes, trigger_len, filter_enabled, insert_space)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 942 | `NE_EU_SetMentionsFilter` | `NE_EU_SetMentionsFilter(hwnd, element_id, filter_bytes, filter_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMentionsFilter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 943 | `NE_EU_InsertMentionsSelected` | `NE_EU_InsertMentionsSelected(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_InsertMentionsSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 944 | `NE_EU_GetMentionsValue` | `NE_EU_GetMentionsValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetMentionsValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 945 | `NE_EU_GetMentionsOpen` | `NE_EU_GetMentionsOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMentionsOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 946 | `NE_EU_GetMentionsSelected` | `NE_EU_GetMentionsSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMentionsSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 947 | `NE_EU_GetMentionsSuggestionCount` | `NE_EU_GetMentionsSuggestionCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMentionsSuggestionCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 948 | `NE_EU_GetMentionsOptions` | `NE_EU_GetMentionsOptions(hwnd, element_id, open, selected_index, suggestion_count, matched_count, trigger_code)` | int | new_emoji 原生界面库 底层导出 EU_GetMentionsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 949 | `NE_EU_SetCascaderOptions` | `NE_EU_SetCascaderOptions(hwnd, element_id, options_bytes, options_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCascaderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 950 | `NE_EU_PostSetCascaderOptions` | `NE_EU_PostSetCascaderOptions(hwnd, element_id, options_bytes, options_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCascaderOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 951 | `NE_EU_SetCascaderValue` | `NE_EU_SetCascaderValue(hwnd, element_id, selected_bytes, selected_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCascaderValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 952 | `NE_EU_PostSetCascaderValue` | `NE_EU_PostSetCascaderValue(hwnd, element_id, selected_bytes, selected_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCascaderValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 953 | `NE_EU_SetCascaderOpen` | `NE_EU_SetCascaderOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetCascaderOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 954 | `NE_EU_PostSetCascaderOpen` | `NE_EU_PostSetCascaderOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCascaderOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 955 | `NE_EU_SetCascaderAdvancedOptions` | `NE_EU_SetCascaderAdvancedOptions(hwnd, element_id, searchable, lazy_mode)` | void | new_emoji 原生界面库 底层导出 EU_SetCascaderAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 956 | `NE_EU_SetCascaderSearch` | `NE_EU_SetCascaderSearch(hwnd, element_id, search_bytes, search_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCascaderSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 957 | `NE_EU_PostSetCascaderSearch` | `NE_EU_PostSetCascaderSearch(hwnd, element_id, search_bytes, search_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCascaderSearch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 958 | `NE_EU_GetCascaderOpen` | `NE_EU_GetCascaderOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCascaderOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 959 | `NE_EU_GetCascaderOptionCount` | `NE_EU_GetCascaderOptionCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCascaderOptionCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 960 | `NE_EU_GetCascaderSelectedDepth` | `NE_EU_GetCascaderSelectedDepth(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCascaderSelectedDepth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 961 | `NE_EU_GetCascaderLevelCount` | `NE_EU_GetCascaderLevelCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCascaderLevelCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 962 | `NE_EU_GetCascaderAdvancedOptions` | `NE_EU_GetCascaderAdvancedOptions(hwnd, element_id, searchable, lazy_mode, matched_count, last_lazy_level)` | int | new_emoji 原生界面库 底层导出 EU_GetCascaderAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 963 | `NE_EU_SetDatePickerDate` | `NE_EU_SetDatePickerDate(hwnd, element_id, year, month, selected_day)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerDate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 964 | `NE_EU_SetDatePickerRange` | `NE_EU_SetDatePickerRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 965 | `NE_EU_SetDatePickerOptions` | `NE_EU_SetDatePickerOptions(hwnd, element_id, today_yyyymmdd, show_today, date_format)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 966 | `NE_EU_SetDatePickerOpen` | `NE_EU_SetDatePickerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 967 | `NE_EU_ClearDatePicker` | `NE_EU_ClearDatePicker(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearDatePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 968 | `NE_EU_DatePickerSelectToday` | `NE_EU_DatePickerSelectToday(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_DatePickerSelectToday。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 969 | `NE_EU_GetDatePickerOpen` | `NE_EU_GetDatePickerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 970 | `NE_EU_GetDatePickerValue` | `NE_EU_GetDatePickerValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 971 | `NE_EU_DatePickerMoveMonth` | `NE_EU_DatePickerMoveMonth(hwnd, element_id, delta_months)` | void | new_emoji 原生界面库 底层导出 EU_DatePickerMoveMonth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 972 | `NE_EU_GetDatePickerRange` | `NE_EU_GetDatePickerRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 973 | `NE_EU_GetDatePickerOptions` | `NE_EU_GetDatePickerOptions(hwnd, element_id, today_yyyymmdd, show_today, date_format)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 974 | `NE_EU_SetDatePickerSelectionRange` | `NE_EU_SetDatePickerSelectionRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerSelectionRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 975 | `NE_EU_GetDatePickerSelectionRange` | `NE_EU_GetDatePickerSelectionRange(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerSelectionRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 976 | `NE_EU_SetDatePickerPlaceholder` | `NE_EU_SetDatePickerPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 977 | `NE_EU_SetDatePickerRangeSeparator` | `NE_EU_SetDatePickerRangeSeparator(hwnd, element_id, sep_bytes, sep_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerRangeSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 978 | `NE_EU_SetDatePickerStartPlaceholder` | `NE_EU_SetDatePickerStartPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerStartPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 979 | `NE_EU_SetDatePickerEndPlaceholder` | `NE_EU_SetDatePickerEndPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerEndPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 980 | `NE_EU_SetDatePickerFormat` | `NE_EU_SetDatePickerFormat(hwnd, element_id, fmt_bytes, fmt_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerFormat。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 981 | `NE_EU_SetDatePickerAlign` | `NE_EU_SetDatePickerAlign(hwnd, element_id, align)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 982 | `NE_EU_SetDatePickerMode` | `NE_EU_SetDatePickerMode(hwnd, element_id, mode)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 983 | `NE_EU_GetDatePickerMode` | `NE_EU_GetDatePickerMode(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 984 | `NE_EU_SetDatePickerMultiSelect` | `NE_EU_SetDatePickerMultiSelect(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerMultiSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 985 | `NE_EU_GetDatePickerSelectedDates` | `NE_EU_GetDatePickerSelectedDates(hwnd, element_id, buffer, buf_size)` | int | new_emoji 原生界面库 底层导出 EU_GetDatePickerSelectedDates。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 986 | `NE_EU_SetDatePickerShortcuts` | `NE_EU_SetDatePickerShortcuts(hwnd, element_id, shortcuts_bytes, shortcuts_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerShortcuts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 987 | `NE_EU_SetDatePickerDisabledDateCallback` | `NE_EU_SetDatePickerDisabledDateCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerDisabledDateCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 988 | `NE_EU_SetDatePickerDisabledDatesUtf8` | `NE_EU_SetDatePickerDisabledDatesUtf8(hwnd, element_id, dates_bytes, dates_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDatePickerDisabledDatesUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 989 | `NE_EU_CreateDateRangePicker` | `NE_EU_CreateDateRangePicker(hwnd, parent_id, start_yyyymmdd, end_yyyymmdd, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDateRangePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 990 | `NE_EU_SetDateRangePickerValue` | `NE_EU_SetDateRangePickerValue(hwnd, element_id, start, end)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 991 | `NE_EU_GetDateRangePickerValue` | `NE_EU_GetDateRangePickerValue(hwnd, element_id, start, end)` | int | new_emoji 原生界面库 底层导出 EU_GetDateRangePickerValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 992 | `NE_EU_SetDateRangePickerRange` | `NE_EU_SetDateRangePickerRange(hwnd, element_id, min, max)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 993 | `NE_EU_SetDateRangePickerPlaceholders` | `NE_EU_SetDateRangePickerPlaceholders(hwnd, element_id, start_bytes, start_len, end_bytes, end_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerPlaceholders。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 994 | `NE_EU_SetDateRangePickerSeparator` | `NE_EU_SetDateRangePickerSeparator(hwnd, element_id, sep_bytes, sep_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 995 | `NE_EU_SetDateRangePickerFormat` | `NE_EU_SetDateRangePickerFormat(hwnd, element_id, fmt)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerFormat。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 996 | `NE_EU_SetDateRangePickerAlign` | `NE_EU_SetDateRangePickerAlign(hwnd, element_id, align)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 997 | `NE_EU_SetDateRangePickerShortcuts` | `NE_EU_SetDateRangePickerShortcuts(hwnd, element_id, sc_bytes, sc_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerShortcuts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 998 | `NE_EU_SetDateRangePickerDisabledDateCallback` | `NE_EU_SetDateRangePickerDisabledDateCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerDisabledDateCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 999 | `NE_EU_SetDateRangePickerOpen` | `NE_EU_SetDateRangePickerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDateRangePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1000 | `NE_EU_GetDateRangePickerOpen` | `NE_EU_GetDateRangePickerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDateRangePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1001 | `NE_EU_DateRangePickerClear` | `NE_EU_DateRangePickerClear(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_DateRangePickerClear。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1002 | `NE_EU_SetTimePickerTime` | `NE_EU_SetTimePickerTime(hwnd, element_id, hour, minute)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1003 | `NE_EU_SetTimePickerRange` | `NE_EU_SetTimePickerRange(hwnd, element_id, min_hhmm, max_hhmm)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1004 | `NE_EU_SetTimePickerOptions` | `NE_EU_SetTimePickerOptions(hwnd, element_id, step_minutes, time_format)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1005 | `NE_EU_SetTimePickerOpen` | `NE_EU_SetTimePickerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1006 | `NE_EU_SetTimePickerScroll` | `NE_EU_SetTimePickerScroll(hwnd, element_id, hour_scroll, minute_scroll)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1007 | `NE_EU_GetTimePickerOpen` | `NE_EU_GetTimePickerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1008 | `NE_EU_GetTimePickerValue` | `NE_EU_GetTimePickerValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1009 | `NE_EU_GetTimePickerRange` | `NE_EU_GetTimePickerRange(hwnd, element_id, min_hhmm, max_hhmm)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1010 | `NE_EU_GetTimePickerOptions` | `NE_EU_GetTimePickerOptions(hwnd, element_id, step_minutes, time_format)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1011 | `NE_EU_GetTimePickerScroll` | `NE_EU_GetTimePickerScroll(hwnd, element_id, hour_scroll, minute_scroll)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1012 | `NE_EU_SetTimePickerArrowControl` | `NE_EU_SetTimePickerArrowControl(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerArrowControl。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1013 | `NE_EU_GetTimePickerArrowControl` | `NE_EU_GetTimePickerArrowControl(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerArrowControl。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1014 | `NE_EU_SetTimePickerRangeSelect` | `NE_EU_SetTimePickerRangeSelect(hwnd, element_id, enabled, start_hhmm, end_hhmm)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerRangeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1015 | `NE_EU_SetTimePickerStartPlaceholder` | `NE_EU_SetTimePickerStartPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerStartPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1016 | `NE_EU_SetTimePickerEndPlaceholder` | `NE_EU_SetTimePickerEndPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerEndPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1017 | `NE_EU_SetTimePickerRangeSeparator` | `NE_EU_SetTimePickerRangeSeparator(hwnd, element_id, sep_bytes, sep_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTimePickerRangeSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1018 | `NE_EU_GetTimePickerRangeValue` | `NE_EU_GetTimePickerRangeValue(hwnd, element_id, start_hhmm, end_hhmm, enabled)` | int | new_emoji 原生界面库 底层导出 EU_GetTimePickerRangeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1019 | `NE_EU_SetTimeSelectPlaceholder` | `NE_EU_SetTimeSelectPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1020 | `NE_EU_SetDateTimePickerDateTime` | `NE_EU_SetDateTimePickerDateTime(hwnd, element_id, year, month, day, hour, minute)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerDateTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1021 | `NE_EU_SetDateTimePickerRange` | `NE_EU_SetDateTimePickerRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd, min_hhmm, max_hhmm)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1022 | `NE_EU_SetDateTimePickerOptions` | `NE_EU_SetDateTimePickerOptions(hwnd, element_id, today_yyyymmdd, show_today, minute_step, date_format)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1023 | `NE_EU_SetDateTimePickerOpen` | `NE_EU_SetDateTimePickerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1024 | `NE_EU_ClearDateTimePicker` | `NE_EU_ClearDateTimePicker(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearDateTimePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1025 | `NE_EU_DateTimePickerSelectToday` | `NE_EU_DateTimePickerSelectToday(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_DateTimePickerSelectToday。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1026 | `NE_EU_DateTimePickerSelectNow` | `NE_EU_DateTimePickerSelectNow(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_DateTimePickerSelectNow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1027 | `NE_EU_SetDateTimePickerScroll` | `NE_EU_SetDateTimePickerScroll(hwnd, element_id, hour_scroll, minute_scroll)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1028 | `NE_EU_GetDateTimePickerOpen` | `NE_EU_GetDateTimePickerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1029 | `NE_EU_GetDateTimePickerDateValue` | `NE_EU_GetDateTimePickerDateValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerDateValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1030 | `NE_EU_GetDateTimePickerTimeValue` | `NE_EU_GetDateTimePickerTimeValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerTimeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1031 | `NE_EU_DateTimePickerMoveMonth` | `NE_EU_DateTimePickerMoveMonth(hwnd, element_id, delta_months)` | void | new_emoji 原生界面库 底层导出 EU_DateTimePickerMoveMonth。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1032 | `NE_EU_GetDateTimePickerRange` | `NE_EU_GetDateTimePickerRange(hwnd, element_id, min_yyyymmdd, max_yyyymmdd, min_hhmm, max_hhmm)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1033 | `NE_EU_GetDateTimePickerOptions` | `NE_EU_GetDateTimePickerOptions(hwnd, element_id, today_yyyymmdd, show_today, minute_step, date_format)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1034 | `NE_EU_GetDateTimePickerScroll` | `NE_EU_GetDateTimePickerScroll(hwnd, element_id, hour_scroll, minute_scroll)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1035 | `NE_EU_SetDateTimePickerShortcuts` | `NE_EU_SetDateTimePickerShortcuts(hwnd, element_id, shortcuts_bytes, shortcuts_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerShortcuts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1036 | `NE_EU_SetDateTimePickerStartPlaceholder` | `NE_EU_SetDateTimePickerStartPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerStartPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1037 | `NE_EU_SetDateTimePickerEndPlaceholder` | `NE_EU_SetDateTimePickerEndPlaceholder(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerEndPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1038 | `NE_EU_SetDateTimePickerDefaultTime` | `NE_EU_SetDateTimePickerDefaultTime(hwnd, element_id, hour, minute)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerDefaultTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1039 | `NE_EU_SetDateTimePickerRangeDefaultTime` | `NE_EU_SetDateTimePickerRangeDefaultTime(hwnd, element_id, start_hour, start_minute, end_hour, end_minute)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerRangeDefaultTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1040 | `NE_EU_SetDateTimePickerRangeSeparator` | `NE_EU_SetDateTimePickerRangeSeparator(hwnd, element_id, sep_bytes, sep_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerRangeSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1041 | `NE_EU_SetDateTimePickerRangeSelect` | `NE_EU_SetDateTimePickerRangeSelect(hwnd, element_id, enabled, start_date, start_time, end_date, end_time)` | void | new_emoji 原生界面库 底层导出 EU_SetDateTimePickerRangeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1042 | `NE_EU_GetDateTimePickerRangeValue` | `NE_EU_GetDateTimePickerRangeValue(hwnd, element_id, start_date, start_time, end_date, end_time, enabled)` | int | new_emoji 原生界面库 底层导出 EU_GetDateTimePickerRangeValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1043 | `NE_EU_SetTimeSelectTime` | `NE_EU_SetTimeSelectTime(hwnd, element_id, hour, minute)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectTime。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1044 | `NE_EU_SetTimeSelectRange` | `NE_EU_SetTimeSelectRange(hwnd, element_id, min_hhmm, max_hhmm)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1045 | `NE_EU_SetTimeSelectOptions` | `NE_EU_SetTimeSelectOptions(hwnd, element_id, step_minutes, time_format)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1046 | `NE_EU_SetTimeSelectOpen` | `NE_EU_SetTimeSelectOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1047 | `NE_EU_SetTimeSelectScroll` | `NE_EU_SetTimeSelectScroll(hwnd, element_id, scroll_row)` | void | new_emoji 原生界面库 底层导出 EU_SetTimeSelectScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1048 | `NE_EU_GetTimeSelectOpen` | `NE_EU_GetTimeSelectOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimeSelectOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1049 | `NE_EU_GetTimeSelectValue` | `NE_EU_GetTimeSelectValue(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTimeSelectValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1050 | `NE_EU_GetTimeSelectRange` | `NE_EU_GetTimeSelectRange(hwnd, element_id, min_hhmm, max_hhmm)` | int | new_emoji 原生界面库 底层导出 EU_GetTimeSelectRange。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1051 | `NE_EU_GetTimeSelectOptions` | `NE_EU_GetTimeSelectOptions(hwnd, element_id, step_minutes, time_format)` | int | new_emoji 原生界面库 底层导出 EU_GetTimeSelectOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1052 | `NE_EU_GetTimeSelectState` | `NE_EU_GetTimeSelectState(hwnd, element_id, scroll_row, candidate_count, group_count, active_index)` | int | new_emoji 原生界面库 底层导出 EU_GetTimeSelectState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1053 | `NE_EU_SetDropdownItems` | `NE_EU_SetDropdownItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1054 | `NE_EU_PostSetDropdownItems` | `NE_EU_PostSetDropdownItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDropdownItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1055 | `NE_EU_SetDropdownSelected` | `NE_EU_SetDropdownSelected(hwnd, element_id, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1056 | `NE_EU_PostSetDropdownSelected` | `NE_EU_PostSetDropdownSelected(hwnd, element_id, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDropdownSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1057 | `NE_EU_GetDropdownSelected` | `NE_EU_GetDropdownSelected(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1058 | `NE_EU_SetDropdownOpen` | `NE_EU_SetDropdownOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1059 | `NE_EU_PostSetDropdownOpen` | `NE_EU_PostSetDropdownOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDropdownOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1060 | `NE_EU_GetDropdownOpen` | `NE_EU_GetDropdownOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1061 | `NE_EU_GetDropdownItemCount` | `NE_EU_GetDropdownItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1062 | `NE_EU_SetDropdownDisabled` | `NE_EU_SetDropdownDisabled(hwnd, element_id, indices, count)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1063 | `NE_EU_SetDropdownDisabledUtf8` | `NE_EU_SetDropdownDisabledUtf8(hwnd, element_id, indices_bytes, indices_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownDisabledUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1064 | `NE_EU_PostSetDropdownDisabledUtf8` | `NE_EU_PostSetDropdownDisabledUtf8(hwnd, element_id, indices_bytes, indices_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDropdownDisabledUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1065 | `NE_EU_GetDropdownState` | `NE_EU_GetDropdownState(hwnd, element_id, selected_index, item_count, disabled_count, selected_level, hover_index)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1066 | `NE_EU_SetDropdownOptions` | `NE_EU_SetDropdownOptions(hwnd, element_id, trigger_mode, hide_on_click, split_button, button_variant, size, trigger_style)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1067 | `NE_EU_GetDropdownOptions` | `NE_EU_GetDropdownOptions(hwnd, element_id, trigger_mode, hide_on_click, split_button, button_variant, size, trigger_style)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1068 | `NE_EU_SetDropdownItemMeta` | `NE_EU_SetDropdownItemMeta(hwnd, element_id, icons_bytes, icons_len, commands_bytes, commands_len, divided_indices, divided_count)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownItemMeta。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1069 | `NE_EU_SetDropdownItemMetaUtf8` | `NE_EU_SetDropdownItemMetaUtf8(hwnd, element_id, icons_bytes, icons_len, commands_bytes, commands_len, divided_bytes, divided_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownItemMetaUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1070 | `NE_EU_GetDropdownItemMeta` | `NE_EU_GetDropdownItemMeta(hwnd, element_id, item_index, icon_buffer, icon_buffer_size, command_buffer, command_buffer_size, divided, disabled, level)` | int | new_emoji 原生界面库 底层导出 EU_GetDropdownItemMeta。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1071 | `NE_EU_SetDropdownCommandCallback` | `NE_EU_SetDropdownCommandCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownCommandCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1072 | `NE_EU_SetDropdownMainClickCallback` | `NE_EU_SetDropdownMainClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDropdownMainClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1073 | `NE_EU_SetMenuItems` | `NE_EU_SetMenuItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1074 | `NE_EU_PostSetMenuItems` | `NE_EU_PostSetMenuItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1075 | `NE_EU_SetMenuActive` | `NE_EU_SetMenuActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1076 | `NE_EU_PostSetMenuActive` | `NE_EU_PostSetMenuActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1077 | `NE_EU_GetMenuActive` | `NE_EU_GetMenuActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1078 | `NE_EU_SetMenuOrientation` | `NE_EU_SetMenuOrientation(hwnd, element_id, orientation)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuOrientation。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1079 | `NE_EU_GetMenuOrientation` | `NE_EU_GetMenuOrientation(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuOrientation。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1080 | `NE_EU_GetMenuItemCount` | `NE_EU_GetMenuItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1081 | `NE_EU_SetMenuExpanded` | `NE_EU_SetMenuExpanded(hwnd, element_id, indices, count)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuExpanded。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1082 | `NE_EU_SetMenuExpandedUtf8` | `NE_EU_SetMenuExpandedUtf8(hwnd, element_id, indices_bytes, indices_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuExpandedUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1083 | `NE_EU_PostSetMenuExpandedUtf8` | `NE_EU_PostSetMenuExpandedUtf8(hwnd, element_id, indices_bytes, indices_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuExpandedUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1084 | `NE_EU_GetMenuState` | `NE_EU_GetMenuState(hwnd, element_id, active_index, item_count, orientation, active_level, visible_count, expanded_count, hover_index)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1085 | `NE_EU_GetMenuActivePath` | `NE_EU_GetMenuActivePath(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuActivePath。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1086 | `NE_EU_SetMenuColors` | `NE_EU_SetMenuColors(hwnd, element_id, bg, text_color, active_text_color, hover_bg, disabled_text_color, border)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1087 | `NE_EU_GetMenuColors` | `NE_EU_GetMenuColors(hwnd, element_id, bg, text_color, active_text_color, hover_bg, disabled_text_color, border)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1088 | `NE_EU_SetMenuCollapsed` | `NE_EU_SetMenuCollapsed(hwnd, element_id, collapsed)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1089 | `NE_EU_PostSetMenuCollapsed` | `NE_EU_PostSetMenuCollapsed(hwnd, element_id, collapsed)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1090 | `NE_EU_GetMenuCollapsed` | `NE_EU_GetMenuCollapsed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuCollapsed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1091 | `NE_EU_SetMenuItemMeta` | `NE_EU_SetMenuItemMeta(hwnd, element_id, icons_bytes, icons_len, group_indices, group_count, hrefs_bytes, hrefs_len, targets_bytes, targets_len, commands_bytes, commands_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemMeta。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1092 | `NE_EU_SetMenuItemMetaUtf8` | `NE_EU_SetMenuItemMetaUtf8(hwnd, element_id, icons_bytes, icons_len, group_bytes, group_len, hrefs_bytes, hrefs_len, targets_bytes, targets_len, commands_bytes, commands_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemMetaUtf8。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1093 | `NE_EU_GetMenuItemMeta` | `NE_EU_GetMenuItemMeta(hwnd, element_id, item_index, icon_buffer, icon_buffer_size, href_buffer, href_buffer_size, target_buffer, target_buffer_size, command_buffer, command_buffer_size, is_group, disabled, level)` | int | new_emoji 原生界面库 底层导出 EU_GetMenuItemMeta。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1094 | `NE_EU_SetMenuSelectCallback` | `NE_EU_SetMenuSelectCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuSelectCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1095 | `NE_EU_SetAnchorItems` | `NE_EU_SetAnchorItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAnchorItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1096 | `NE_EU_SetAnchorActive` | `NE_EU_SetAnchorActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetAnchorActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1097 | `NE_EU_GetAnchorActive` | `NE_EU_GetAnchorActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAnchorActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1098 | `NE_EU_GetAnchorItemCount` | `NE_EU_GetAnchorItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAnchorItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1099 | `NE_EU_SetAnchorTargets` | `NE_EU_SetAnchorTargets(hwnd, element_id, positions, count)` | void | new_emoji 原生界面库 底层导出 EU_SetAnchorTargets。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1100 | `NE_EU_SetAnchorOptions` | `NE_EU_SetAnchorOptions(hwnd, element_id, scroll_offset, target_container_id)` | void | new_emoji 原生界面库 底层导出 EU_SetAnchorOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1101 | `NE_EU_SetAnchorScroll` | `NE_EU_SetAnchorScroll(hwnd, element_id, scroll_position)` | void | new_emoji 原生界面库 底层导出 EU_SetAnchorScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1102 | `NE_EU_GetAnchorState` | `NE_EU_GetAnchorState(hwnd, element_id, active_index, item_count, scroll_position, offset, target_position, container_id, hover_index)` | int | new_emoji 原生界面库 底层导出 EU_GetAnchorState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1103 | `NE_EU_SetBacktopState` | `NE_EU_SetBacktopState(hwnd, element_id, scroll_position, threshold, target_position)` | void | new_emoji 原生界面库 底层导出 EU_SetBacktopState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1104 | `NE_EU_GetBacktopVisible` | `NE_EU_GetBacktopVisible(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBacktopVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1105 | `NE_EU_GetBacktopState` | `NE_EU_GetBacktopState(hwnd, element_id, scroll_position, threshold, target_position)` | int | new_emoji 原生界面库 底层导出 EU_GetBacktopState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1106 | `NE_EU_SetBacktopOptions` | `NE_EU_SetBacktopOptions(hwnd, element_id, scroll_position, threshold, target_position, container_id, duration_ms)` | void | new_emoji 原生界面库 底层导出 EU_SetBacktopOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1107 | `NE_EU_SetBacktopScroll` | `NE_EU_SetBacktopScroll(hwnd, element_id, scroll_position)` | void | new_emoji 原生界面库 底层导出 EU_SetBacktopScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1108 | `NE_EU_TriggerBacktop` | `NE_EU_TriggerBacktop(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerBacktop。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1109 | `NE_EU_GetBacktopFullState` | `NE_EU_GetBacktopFullState(hwnd, element_id, scroll_position, threshold, target_position, container_id, visible, duration_ms, last_scroll_before_jump, activated_count)` | int | new_emoji 原生界面库 底层导出 EU_GetBacktopFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1110 | `NE_EU_SetSegmentedItems` | `NE_EU_SetSegmentedItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetSegmentedItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1111 | `NE_EU_PostSetSegmentedItems` | `NE_EU_PostSetSegmentedItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSegmentedItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1112 | `NE_EU_SetSegmentedActive` | `NE_EU_SetSegmentedActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetSegmentedActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1113 | `NE_EU_PostSetSegmentedActive` | `NE_EU_PostSetSegmentedActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetSegmentedActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1114 | `NE_EU_GetSegmentedActive` | `NE_EU_GetSegmentedActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSegmentedActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1115 | `NE_EU_GetSegmentedItemCount` | `NE_EU_GetSegmentedItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetSegmentedItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1116 | `NE_EU_SetSegmentedDisabled` | `NE_EU_SetSegmentedDisabled(hwnd, element_id, indices, count)` | void | new_emoji 原生界面库 底层导出 EU_SetSegmentedDisabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1117 | `NE_EU_GetSegmentedState` | `NE_EU_GetSegmentedState(hwnd, element_id, active_index, item_count, disabled_count, hover_index)` | int | new_emoji 原生界面库 底层导出 EU_GetSegmentedState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1118 | `NE_EU_SetPageHeaderText` | `NE_EU_SetPageHeaderText(hwnd, element_id, title_bytes, title_len, subtitle_bytes, subtitle_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1119 | `NE_EU_SetPageHeaderBreadcrumbs` | `NE_EU_SetPageHeaderBreadcrumbs(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderBreadcrumbs。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1120 | `NE_EU_SetPageHeaderActions` | `NE_EU_SetPageHeaderActions(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderActions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1121 | `NE_EU_GetPageHeaderAction` | `NE_EU_GetPageHeaderAction(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPageHeaderAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1122 | `NE_EU_SetPageHeaderBackText` | `NE_EU_SetPageHeaderBackText(hwnd, element_id, back_bytes, back_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderBackText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1123 | `NE_EU_SetPageHeaderActiveAction` | `NE_EU_SetPageHeaderActiveAction(hwnd, element_id, action_index)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderActiveAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1124 | `NE_EU_SetPageHeaderBreadcrumbActive` | `NE_EU_SetPageHeaderBreadcrumbActive(hwnd, element_id, breadcrumb_index)` | void | new_emoji 原生界面库 底层导出 EU_SetPageHeaderBreadcrumbActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1125 | `NE_EU_TriggerPageHeaderBack` | `NE_EU_TriggerPageHeaderBack(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerPageHeaderBack。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1126 | `NE_EU_ResetPageHeaderResult` | `NE_EU_ResetPageHeaderResult(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ResetPageHeaderResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1127 | `NE_EU_GetPageHeaderState` | `NE_EU_GetPageHeaderState(hwnd, element_id, active_action, action_count, active_breadcrumb, breadcrumb_count, back_clicked_count, back_hovered, action_hover, breadcrumb_hover)` | int | new_emoji 原生界面库 底层导出 EU_GetPageHeaderState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1128 | `NE_EU_SetAffixText` | `NE_EU_SetAffixText(hwnd, element_id, title_bytes, title_len, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAffixText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1129 | `NE_EU_SetAffixState` | `NE_EU_SetAffixState(hwnd, element_id, scroll_position, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetAffixState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1130 | `NE_EU_GetAffixFixed` | `NE_EU_GetAffixFixed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAffixFixed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1131 | `NE_EU_GetAffixState` | `NE_EU_GetAffixState(hwnd, element_id, scroll_position, offset, fixed)` | int | new_emoji 原生界面库 底层导出 EU_GetAffixState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1132 | `NE_EU_SetAffixOptions` | `NE_EU_SetAffixOptions(hwnd, element_id, scroll_position, offset, container_id, placeholder_height, z_index)` | void | new_emoji 原生界面库 底层导出 EU_SetAffixOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1133 | `NE_EU_GetAffixOptions` | `NE_EU_GetAffixOptions(hwnd, element_id, scroll_position, offset, fixed, container_id, placeholder_height, fixed_top, z_index)` | int | new_emoji 原生界面库 底层导出 EU_GetAffixOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1134 | `NE_EU_SetWatermarkContent` | `NE_EU_SetWatermarkContent(hwnd, element_id, content_bytes, content_len)` | void | new_emoji 原生界面库 底层导出 EU_SetWatermarkContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1135 | `NE_EU_SetWatermarkOptions` | `NE_EU_SetWatermarkOptions(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha)` | void | new_emoji 原生界面库 底层导出 EU_SetWatermarkOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1136 | `NE_EU_GetWatermarkOptions` | `NE_EU_GetWatermarkOptions(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha)` | int | new_emoji 原生界面库 底层导出 EU_GetWatermarkOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1137 | `NE_EU_SetWatermarkLayer` | `NE_EU_SetWatermarkLayer(hwnd, element_id, container_id, overlay, pass_through, z_index)` | void | new_emoji 原生界面库 底层导出 EU_SetWatermarkLayer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1138 | `NE_EU_GetWatermarkFullOptions` | `NE_EU_GetWatermarkFullOptions(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha, container_id, overlay, pass_through, z_index, tile_count_x, tile_count_y)` | int | new_emoji 原生界面库 底层导出 EU_GetWatermarkFullOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1139 | `NE_EU_SetTourSteps` | `NE_EU_SetTourSteps(hwnd, element_id, steps_bytes, steps_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTourSteps。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1140 | `NE_EU_SetTourActive` | `NE_EU_SetTourActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTourActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1141 | `NE_EU_SetTourOpen` | `NE_EU_SetTourOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetTourOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1142 | `NE_EU_SetTourOptions` | `NE_EU_SetTourOptions(hwnd, element_id, open, mask, target_x, target_y, target_w, target_h)` | void | new_emoji 原生界面库 底层导出 EU_SetTourOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1143 | `NE_EU_SetTourTargetElement` | `NE_EU_SetTourTargetElement(hwnd, element_id, target_element_id, padding)` | void | new_emoji 原生界面库 底层导出 EU_SetTourTargetElement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1144 | `NE_EU_SetTourMaskBehavior` | `NE_EU_SetTourMaskBehavior(hwnd, element_id, pass_through, close_on_mask)` | void | new_emoji 原生界面库 底层导出 EU_SetTourMaskBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1145 | `NE_EU_GetTourActive` | `NE_EU_GetTourActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTourActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1146 | `NE_EU_GetTourOpen` | `NE_EU_GetTourOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTourOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1147 | `NE_EU_GetTourStepCount` | `NE_EU_GetTourStepCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTourStepCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1148 | `NE_EU_GetTourOptions` | `NE_EU_GetTourOptions(hwnd, element_id, open, mask, target_x, target_y, target_w, target_h)` | int | new_emoji 原生界面库 底层导出 EU_GetTourOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1149 | `NE_EU_GetTourFullState` | `NE_EU_GetTourFullState(hwnd, element_id, active_index, step_count, open, mask, target_x, target_y, target_w, target_h, target_element_id, mask_passthrough, close_on_mask, last_action, change_count)` | int | new_emoji 原生界面库 底层导出 EU_GetTourFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1150 | `NE_EU_SetImageSource` | `NE_EU_SetImageSource(hwnd, element_id, src_bytes, src_len, alt_bytes, alt_len)` | void | new_emoji 原生界面库 底层导出 EU_SetImageSource。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1151 | `NE_EU_PostSetImageSource` | `NE_EU_PostSetImageSource(hwnd, element_id, src_bytes, src_len, alt_bytes, alt_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImageSource。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1152 | `NE_EU_SetImageFit` | `NE_EU_SetImageFit(hwnd, element_id, fit)` | void | new_emoji 原生界面库 底层导出 EU_SetImageFit。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1153 | `NE_EU_SetImageStyle` | `NE_EU_SetImageStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | void | new_emoji 原生界面库 底层导出 EU_SetImageStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1154 | `NE_EU_GetImageStyle` | `NE_EU_GetImageStyle(hwnd, element_id, bg, border, border_width, radius, padding)` | int | new_emoji 原生界面库 底层导出 EU_GetImageStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1155 | `NE_EU_SetImagePreview` | `NE_EU_SetImagePreview(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePreview。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1156 | `NE_EU_PostSetImagePreview` | `NE_EU_PostSetImagePreview(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImagePreview。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1157 | `NE_EU_SetImagePreviewEnabled` | `NE_EU_SetImagePreviewEnabled(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePreviewEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1158 | `NE_EU_SetImagePreviewTransform` | `NE_EU_SetImagePreviewTransform(hwnd, element_id, scale_percent, offset_x, offset_y)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePreviewTransform。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1159 | `NE_EU_SetImageCacheEnabled` | `NE_EU_SetImageCacheEnabled(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetImageCacheEnabled。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1160 | `NE_EU_SetImageLazy` | `NE_EU_SetImageLazy(hwnd, element_id, lazy)` | void | new_emoji 原生界面库 底层导出 EU_SetImageLazy。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1161 | `NE_EU_SetImagePlaceholder` | `NE_EU_SetImagePlaceholder(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1162 | `NE_EU_PostSetImagePlaceholder` | `NE_EU_PostSetImagePlaceholder(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImagePlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1163 | `NE_EU_SetImageErrorContent` | `NE_EU_SetImageErrorContent(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | void | new_emoji 原生界面库 底层导出 EU_SetImageErrorContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1164 | `NE_EU_PostSetImageErrorContent` | `NE_EU_PostSetImageErrorContent(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImageErrorContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1165 | `NE_EU_SetImagePreviewList` | `NE_EU_SetImagePreviewList(hwnd, element_id, sources_bytes, sources_len, selected_index)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePreviewList。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1166 | `NE_EU_PostSetImagePreviewList` | `NE_EU_PostSetImagePreviewList(hwnd, element_id, sources_bytes, sources_len, selected_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImagePreviewList。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1167 | `NE_EU_SetImagePreviewIndex` | `NE_EU_SetImagePreviewIndex(hwnd, element_id, index)` | void | new_emoji 原生界面库 底层导出 EU_SetImagePreviewIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1168 | `NE_EU_PostSetImagePreviewIndex` | `NE_EU_PostSetImagePreviewIndex(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetImagePreviewIndex。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1169 | `NE_EU_GetImageStatus` | `NE_EU_GetImageStatus(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetImageStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1170 | `NE_EU_GetImagePreviewOpen` | `NE_EU_GetImagePreviewOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetImagePreviewOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1171 | `NE_EU_GetImageOptions` | `NE_EU_GetImageOptions(hwnd, element_id, fit, preview_enabled, preview_open, status)` | int | new_emoji 原生界面库 底层导出 EU_GetImageOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1172 | `NE_EU_GetImageFullOptions` | `NE_EU_GetImageFullOptions(hwnd, element_id, fit, preview_enabled, preview_open, status, scale_percent, offset_x, offset_y, cache_enabled, reload_count, bitmap_width, bitmap_height)` | int | new_emoji 原生界面库 底层导出 EU_GetImageFullOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1173 | `NE_EU_GetImageAdvancedOptions` | `NE_EU_GetImageAdvancedOptions(hwnd, element_id, fit, lazy, preview_enabled, preview_open, preview_index, preview_count, status, scale_percent, offset_x, offset_y)` | int | new_emoji 原生界面库 底层导出 EU_GetImageAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1174 | `NE_EU_SetCarouselItems` | `NE_EU_SetCarouselItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1175 | `NE_EU_PostSetCarouselItems` | `NE_EU_PostSetCarouselItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCarouselItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1176 | `NE_EU_SetCarouselActive` | `NE_EU_SetCarouselActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1177 | `NE_EU_PostSetCarouselActive` | `NE_EU_PostSetCarouselActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetCarouselActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1178 | `NE_EU_SetCarouselOptions` | `NE_EU_SetCarouselOptions(hwnd, element_id, loop, indicator_position, show_arrows, show_indicators)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1179 | `NE_EU_SetCarouselBehavior` | `NE_EU_SetCarouselBehavior(hwnd, element_id, trigger_mode, arrow_mode, direction, carousel_type, pause_on_hover)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1180 | `NE_EU_GetCarouselBehavior` | `NE_EU_GetCarouselBehavior(hwnd, element_id, trigger_mode, arrow_mode, direction, carousel_type, pause_on_hover)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1181 | `NE_EU_SetCarouselVisual` | `NE_EU_SetCarouselVisual(hwnd, element_id, text_color, text_alpha, text_font_size, odd_bg, even_bg, panel_bg, active_indicator, inactive_indicator, card_scale_percent)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselVisual。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1182 | `NE_EU_GetCarouselVisual` | `NE_EU_GetCarouselVisual(hwnd, element_id, text_color, text_alpha, text_font_size, odd_bg, even_bg, panel_bg, active_indicator, inactive_indicator, card_scale_percent)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselVisual。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1183 | `NE_EU_SetCarouselAutoplay` | `NE_EU_SetCarouselAutoplay(hwnd, element_id, enabled, interval_ms)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselAutoplay。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1184 | `NE_EU_SetCarouselAnimation` | `NE_EU_SetCarouselAnimation(hwnd, element_id, transition_ms)` | void | new_emoji 原生界面库 底层导出 EU_SetCarouselAnimation。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1185 | `NE_EU_CarouselAdvance` | `NE_EU_CarouselAdvance(hwnd, element_id, delta)` | void | new_emoji 原生界面库 底层导出 EU_CarouselAdvance。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1186 | `NE_EU_CarouselTick` | `NE_EU_CarouselTick(hwnd, element_id, elapsed_ms)` | void | new_emoji 原生界面库 底层导出 EU_CarouselTick。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1187 | `NE_EU_GetCarouselActive` | `NE_EU_GetCarouselActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1188 | `NE_EU_GetCarouselItemCount` | `NE_EU_GetCarouselItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1189 | `NE_EU_GetCarouselOptions` | `NE_EU_GetCarouselOptions(hwnd, element_id, loop, indicator_position, show_arrows, show_indicators, autoplay, interval_ms)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1190 | `NE_EU_GetCarouselFullState` | `NE_EU_GetCarouselFullState(hwnd, element_id, active_index, previous_index, item_count, loop, indicator_position, show_arrows, show_indicators, autoplay, interval_ms, autoplay_tick, autoplay_elapsed_ms, transition_ms, transition_progress, transition_direction, last_action, change_count)` | int | new_emoji 原生界面库 底层导出 EU_GetCarouselFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1191 | `NE_EU_SetUploadFiles` | `NE_EU_SetUploadFiles(hwnd, element_id, files_bytes, files_len)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1192 | `NE_EU_PostSetUploadFiles` | `NE_EU_PostSetUploadFiles(hwnd, element_id, files_bytes, files_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetUploadFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1193 | `NE_EU_SetUploadFileItems` | `NE_EU_SetUploadFileItems(hwnd, element_id, files_bytes, files_len)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadFileItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1194 | `NE_EU_PostSetUploadFileItems` | `NE_EU_PostSetUploadFileItems(hwnd, element_id, files_bytes, files_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetUploadFileItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1195 | `NE_EU_SetUploadOptions` | `NE_EU_SetUploadOptions(hwnd, element_id, multiple, auto_upload)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1196 | `NE_EU_SetUploadStyle` | `NE_EU_SetUploadStyle(hwnd, element_id, style_mode, show_file_list, show_tip, show_actions, drop_enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1197 | `NE_EU_GetUploadStyle` | `NE_EU_GetUploadStyle(hwnd, element_id, style_mode, show_file_list, show_tip, show_actions, drop_enabled)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1198 | `NE_EU_SetUploadTexts` | `NE_EU_SetUploadTexts(hwnd, element_id, title_bytes, title_len, tip_bytes, tip_len, trigger_bytes, trigger_len, submit_bytes, submit_len)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1199 | `NE_EU_SetUploadConstraints` | `NE_EU_SetUploadConstraints(hwnd, element_id, limit, max_size_kb, accept_bytes, accept_len)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadConstraints。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1200 | `NE_EU_GetUploadConstraints` | `NE_EU_GetUploadConstraints(hwnd, element_id, limit, max_size_kb, accept_buffer, accept_buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadConstraints。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1201 | `NE_EU_SetUploadPreviewOpen` | `NE_EU_SetUploadPreviewOpen(hwnd, element_id, file_index, open)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadPreviewOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1202 | `NE_EU_PostSetUploadPreviewOpen` | `NE_EU_PostSetUploadPreviewOpen(hwnd, element_id, file_index, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetUploadPreviewOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1203 | `NE_EU_GetUploadPreviewState` | `NE_EU_GetUploadPreviewState(hwnd, element_id, file_index, open)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadPreviewState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1204 | `NE_EU_SetUploadSelectedFiles` | `NE_EU_SetUploadSelectedFiles(hwnd, element_id, files_bytes, files_len)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadSelectedFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1205 | `NE_EU_PostSetUploadSelectedFiles` | `NE_EU_PostSetUploadSelectedFiles(hwnd, element_id, files_bytes, files_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetUploadSelectedFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1206 | `NE_EU_SetUploadFileStatus` | `NE_EU_SetUploadFileStatus(hwnd, element_id, file_index, status, progress)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadFileStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1207 | `NE_EU_PostSetUploadFileStatus` | `NE_EU_PostSetUploadFileStatus(hwnd, element_id, file_index, status, progress)` | int | new_emoji 原生界面库 底层导出 EU_PostSetUploadFileStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1208 | `NE_EU_RemoveUploadFile` | `NE_EU_RemoveUploadFile(hwnd, element_id, file_index)` | void | new_emoji 原生界面库 底层导出 EU_RemoveUploadFile。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1209 | `NE_EU_RetryUploadFile` | `NE_EU_RetryUploadFile(hwnd, element_id, file_index)` | void | new_emoji 原生界面库 底层导出 EU_RetryUploadFile。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1210 | `NE_EU_ClearUploadFiles` | `NE_EU_ClearUploadFiles(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearUploadFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1211 | `NE_EU_OpenUploadFileDialog` | `NE_EU_OpenUploadFileDialog(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_OpenUploadFileDialog。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1212 | `NE_EU_StartUpload` | `NE_EU_StartUpload(hwnd, element_id, file_index)` | int | new_emoji 原生界面库 底层导出 EU_StartUpload。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1213 | `NE_EU_GetUploadFileCount` | `NE_EU_GetUploadFileCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadFileCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1214 | `NE_EU_GetUploadFileStatus` | `NE_EU_GetUploadFileStatus(hwnd, element_id, file_index, status, progress)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadFileStatus。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1215 | `NE_EU_GetUploadSelectedFiles` | `NE_EU_GetUploadSelectedFiles(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadSelectedFiles。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1216 | `NE_EU_GetUploadFileName` | `NE_EU_GetUploadFileName(hwnd, element_id, file_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadFileName。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1217 | `NE_EU_GetUploadFullState` | `NE_EU_GetUploadFullState(hwnd, element_id, file_count, selected_count, last_selected_count, upload_request_count, retry_count, remove_count, last_action, waiting_count, uploading_count, success_count, failed_count, multiple, auto_upload)` | int | new_emoji 原生界面库 底层导出 EU_GetUploadFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1218 | `NE_EU_SetUploadSelectCallback` | `NE_EU_SetUploadSelectCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadSelectCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1219 | `NE_EU_SetUploadActionCallback` | `NE_EU_SetUploadActionCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetUploadActionCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1220 | `NE_EU_SetInfiniteScrollItems` | `NE_EU_SetInfiniteScrollItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1221 | `NE_EU_PostSetInfiniteScrollItems` | `NE_EU_PostSetInfiniteScrollItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInfiniteScrollItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1222 | `NE_EU_AppendInfiniteScrollItems` | `NE_EU_AppendInfiniteScrollItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_AppendInfiniteScrollItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1223 | `NE_EU_ClearInfiniteScrollItems` | `NE_EU_ClearInfiniteScrollItems(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearInfiniteScrollItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1224 | `NE_EU_SetInfiniteScrollState` | `NE_EU_SetInfiniteScrollState(hwnd, element_id, loading, no_more, disabled)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1225 | `NE_EU_PostSetInfiniteScrollState` | `NE_EU_PostSetInfiniteScrollState(hwnd, element_id, loading, no_more, disabled)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInfiniteScrollState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1226 | `NE_EU_SetInfiniteScrollOptions` | `NE_EU_SetInfiniteScrollOptions(hwnd, element_id, item_height, gap, threshold, style_mode, show_scrollbar, show_index)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1227 | `NE_EU_SetInfiniteScrollTexts` | `NE_EU_SetInfiniteScrollTexts(hwnd, element_id, loading_bytes, loading_len, no_more_bytes, no_more_len, empty_bytes, empty_len)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollTexts。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1228 | `NE_EU_SetInfiniteScrollScroll` | `NE_EU_SetInfiniteScrollScroll(hwnd, element_id, scroll_y)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1229 | `NE_EU_PostSetInfiniteScrollScroll` | `NE_EU_PostSetInfiniteScrollScroll(hwnd, element_id, scroll_y)` | int | new_emoji 原生界面库 底层导出 EU_PostSetInfiniteScrollScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1230 | `NE_EU_GetInfiniteScrollFullState` | `NE_EU_GetInfiniteScrollFullState(hwnd, element_id, item_count, scroll_y, max_scroll, content_height, viewport_height, loading, no_more, disabled, load_count, change_count, last_action, threshold, style_mode, show_scrollbar, show_index)` | int | new_emoji 原生界面库 底层导出 EU_GetInfiniteScrollFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1231 | `NE_EU_SetInfiniteScrollLoadCallback` | `NE_EU_SetInfiniteScrollLoadCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetInfiniteScrollLoadCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1232 | `NE_EU_SetBreadcrumbItems` | `NE_EU_SetBreadcrumbItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBreadcrumbItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1233 | `NE_EU_PostSetBreadcrumbItems` | `NE_EU_PostSetBreadcrumbItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBreadcrumbItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1234 | `NE_EU_SetBreadcrumbSeparator` | `NE_EU_SetBreadcrumbSeparator(hwnd, element_id, separator_bytes, separator_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBreadcrumbSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1235 | `NE_EU_SetBreadcrumbCurrent` | `NE_EU_SetBreadcrumbCurrent(hwnd, element_id, current_index)` | void | new_emoji 原生界面库 底层导出 EU_SetBreadcrumbCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1236 | `NE_EU_PostSetBreadcrumbCurrent` | `NE_EU_PostSetBreadcrumbCurrent(hwnd, element_id, current_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBreadcrumbCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1237 | `NE_EU_TriggerBreadcrumbClick` | `NE_EU_TriggerBreadcrumbClick(hwnd, element_id, item_index)` | void | new_emoji 原生界面库 底层导出 EU_TriggerBreadcrumbClick。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1238 | `NE_EU_GetBreadcrumbCurrent` | `NE_EU_GetBreadcrumbCurrent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBreadcrumbCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1239 | `NE_EU_GetBreadcrumbItemCount` | `NE_EU_GetBreadcrumbItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetBreadcrumbItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1240 | `NE_EU_GetBreadcrumbState` | `NE_EU_GetBreadcrumbState(hwnd, element_id, current_index, item_count)` | int | new_emoji 原生界面库 底层导出 EU_GetBreadcrumbState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1241 | `NE_EU_GetBreadcrumbItem` | `NE_EU_GetBreadcrumbItem(hwnd, element_id, item_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetBreadcrumbItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1242 | `NE_EU_GetBreadcrumbFullState` | `NE_EU_GetBreadcrumbFullState(hwnd, element_id, current_index, item_count, hover_index, press_index, last_clicked_index, click_count, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetBreadcrumbFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1243 | `NE_EU_SetBreadcrumbSelectCallback` | `NE_EU_SetBreadcrumbSelectCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetBreadcrumbSelectCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1244 | `NE_EU_SetTabsItems` | `NE_EU_SetTabsItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1245 | `NE_EU_PostSetTabsItems` | `NE_EU_PostSetTabsItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1246 | `NE_EU_SetTabsItemsEx` | `NE_EU_SetTabsItemsEx(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1247 | `NE_EU_PostSetTabsItemsEx` | `NE_EU_PostSetTabsItemsEx(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemsEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1248 | `NE_EU_SetTabsActive` | `NE_EU_SetTabsActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1249 | `NE_EU_PostSetTabsActive` | `NE_EU_PostSetTabsActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1250 | `NE_EU_SetTabsActiveName` | `NE_EU_SetTabsActiveName(hwnd, element_id, name_bytes, name_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsActiveName。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1251 | `NE_EU_PostSetTabsActiveName` | `NE_EU_PostSetTabsActiveName(hwnd, element_id, name_bytes, name_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsActiveName。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1252 | `NE_EU_SetTabsType` | `NE_EU_SetTabsType(hwnd, element_id, tab_type)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1253 | `NE_EU_SetTabsPosition` | `NE_EU_SetTabsPosition(hwnd, element_id, tab_position)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsPosition。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1254 | `NE_EU_SetTabsHeaderAlign` | `NE_EU_SetTabsHeaderAlign(hwnd, element_id, align)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsHeaderAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1255 | `NE_EU_SetTabsOptions` | `NE_EU_SetTabsOptions(hwnd, element_id, tab_type, closable, addable)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1256 | `NE_EU_SetTabsEditable` | `NE_EU_SetTabsEditable(hwnd, element_id, editable)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsEditable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1257 | `NE_EU_SetTabsContentVisible` | `NE_EU_SetTabsContentVisible(hwnd, element_id, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsContentVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1258 | `NE_EU_SetTabsPageElements` | `NE_EU_SetTabsPageElements(hwnd, element_id, ids_bytes, ids_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsPageElements。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1259 | `NE_EU_AddTabsItem` | `NE_EU_AddTabsItem(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_AddTabsItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1260 | `NE_EU_CloseTabsItem` | `NE_EU_CloseTabsItem(hwnd, element_id, item_index)` | void | new_emoji 原生界面库 底层导出 EU_CloseTabsItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1261 | `NE_EU_SetTabsScroll` | `NE_EU_SetTabsScroll(hwnd, element_id, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1262 | `NE_EU_TabsScroll` | `NE_EU_TabsScroll(hwnd, element_id, delta)` | void | new_emoji 原生界面库 底层导出 EU_TabsScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1263 | `NE_EU_GetTabsActive` | `NE_EU_GetTabsActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1264 | `NE_EU_GetTabsHeaderAlign` | `NE_EU_GetTabsHeaderAlign(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsHeaderAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1265 | `NE_EU_GetTabsItemCount` | `NE_EU_GetTabsItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1266 | `NE_EU_GetTabsState` | `NE_EU_GetTabsState(hwnd, element_id, active_index, item_count, tab_type)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1267 | `NE_EU_GetTabsItem` | `NE_EU_GetTabsItem(hwnd, element_id, item_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1268 | `NE_EU_GetTabsActiveName` | `NE_EU_GetTabsActiveName(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsActiveName。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1269 | `NE_EU_GetTabsItemContent` | `NE_EU_GetTabsItemContent(hwnd, element_id, item_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsItemContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1270 | `NE_EU_GetTabsFullState` | `NE_EU_GetTabsFullState(hwnd, element_id, active_index, item_count, tab_type, closable, addable, scroll_offset, max_scroll_offset, hover_index, press_index, hover_part, press_part, last_closed_index, last_added_index, close_count, add_count, select_count, scroll_count, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1271 | `NE_EU_GetTabsFullStateEx` | `NE_EU_GetTabsFullStateEx(hwnd, element_id, active_index, item_count, tab_type, closable, addable, scroll_offset, max_scroll_offset, hover_index, press_index, hover_part, press_part, last_closed_index, last_added_index, close_count, add_count, select_count, scroll_count, last_action, tab_position, editable, content_visible, active_disabled, active_closable)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsFullStateEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1272 | `NE_EU_SetTabsChangeCallback` | `NE_EU_SetTabsChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1273 | `NE_EU_SetTabsCloseCallback` | `NE_EU_SetTabsCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1274 | `NE_EU_SetTabsAddCallback` | `NE_EU_SetTabsAddCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsAddCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1275 | `NE_EU_SetPagination` | `NE_EU_SetPagination(hwnd, element_id, total, page_size, current_page)` | void | new_emoji 原生界面库 底层导出 EU_SetPagination。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1276 | `NE_EU_SetPaginationCurrent` | `NE_EU_SetPaginationCurrent(hwnd, element_id, current_page)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1277 | `NE_EU_PostSetPaginationCurrent` | `NE_EU_PostSetPaginationCurrent(hwnd, element_id, current_page)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPaginationCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1278 | `NE_EU_SetPaginationPageSize` | `NE_EU_SetPaginationPageSize(hwnd, element_id, page_size)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationPageSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1279 | `NE_EU_PostSetPaginationPageSize` | `NE_EU_PostSetPaginationPageSize(hwnd, element_id, page_size)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPaginationPageSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1280 | `NE_EU_SetPaginationOptions` | `NE_EU_SetPaginationOptions(hwnd, element_id, show_jumper, show_size_changer, visible_page_count)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1281 | `NE_EU_SetPaginationAdvancedOptions` | `NE_EU_SetPaginationAdvancedOptions(hwnd, element_id, background, small_style, hide_on_single_page)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1282 | `NE_EU_SetPaginationPageSizeOptions` | `NE_EU_SetPaginationPageSizeOptions(hwnd, element_id, sizes, count)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationPageSizeOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1283 | `NE_EU_SetPaginationJumpPage` | `NE_EU_SetPaginationJumpPage(hwnd, element_id, jump_page)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationJumpPage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1284 | `NE_EU_PostSetPaginationJumpPage` | `NE_EU_PostSetPaginationJumpPage(hwnd, element_id, jump_page)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPaginationJumpPage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1285 | `NE_EU_TriggerPaginationJump` | `NE_EU_TriggerPaginationJump(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerPaginationJump。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1286 | `NE_EU_NextPaginationPageSize` | `NE_EU_NextPaginationPageSize(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_NextPaginationPageSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1287 | `NE_EU_GetPaginationCurrent` | `NE_EU_GetPaginationCurrent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPaginationCurrent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1288 | `NE_EU_GetPaginationPageCount` | `NE_EU_GetPaginationPageCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPaginationPageCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1289 | `NE_EU_GetPaginationState` | `NE_EU_GetPaginationState(hwnd, element_id, total, page_size, current_page, page_count)` | int | new_emoji 原生界面库 底层导出 EU_GetPaginationState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1290 | `NE_EU_GetPaginationFullState` | `NE_EU_GetPaginationFullState(hwnd, element_id, total, page_size, current_page, page_count, jump_page, visible_page_count, show_jumper, show_size_changer, hover_part, press_part, change_count, size_change_count, jump_count, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetPaginationFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1291 | `NE_EU_GetPaginationAdvancedOptions` | `NE_EU_GetPaginationAdvancedOptions(hwnd, element_id, background, small_style, hide_on_single_page)` | int | new_emoji 原生界面库 底层导出 EU_GetPaginationAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1292 | `NE_EU_SetPaginationChangeCallback` | `NE_EU_SetPaginationChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetPaginationChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1293 | `NE_EU_SetStepsItems` | `NE_EU_SetStepsItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1294 | `NE_EU_PostSetStepsItems` | `NE_EU_PostSetStepsItems(hwnd, element_id, items_bytes, items_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetStepsItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1295 | `NE_EU_SetStepsDetailItems` | `NE_EU_SetStepsDetailItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsDetailItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1296 | `NE_EU_SetStepsIconItems` | `NE_EU_SetStepsIconItems(hwnd, element_id, items_bytes, items_len)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsIconItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1297 | `NE_EU_SetStepsActive` | `NE_EU_SetStepsActive(hwnd, element_id, active_index)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1298 | `NE_EU_PostSetStepsActive` | `NE_EU_PostSetStepsActive(hwnd, element_id, active_index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetStepsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1299 | `NE_EU_SetStepsDirection` | `NE_EU_SetStepsDirection(hwnd, element_id, direction)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsDirection。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1300 | `NE_EU_SetStepsOptions` | `NE_EU_SetStepsOptions(hwnd, element_id, space, align_center, simple, finish_status, process_status)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1301 | `NE_EU_GetStepsOptions` | `NE_EU_GetStepsOptions(hwnd, element_id, space, align_center, simple, finish_status, process_status)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1302 | `NE_EU_SetStepsStatuses` | `NE_EU_SetStepsStatuses(hwnd, element_id, statuses, count)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsStatuses。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1303 | `NE_EU_PostSetStepsStatuses` | `NE_EU_PostSetStepsStatuses(hwnd, element_id, statuses, count)` | int | new_emoji 原生界面库 底层导出 EU_PostSetStepsStatuses。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1304 | `NE_EU_TriggerStepsClick` | `NE_EU_TriggerStepsClick(hwnd, element_id, item_index)` | void | new_emoji 原生界面库 底层导出 EU_TriggerStepsClick。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1305 | `NE_EU_GetStepsActive` | `NE_EU_GetStepsActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1306 | `NE_EU_GetStepsItemCount` | `NE_EU_GetStepsItemCount(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsItemCount。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1307 | `NE_EU_GetStepsState` | `NE_EU_GetStepsState(hwnd, element_id, active_index, item_count, direction)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1308 | `NE_EU_GetStepsItem` | `NE_EU_GetStepsItem(hwnd, element_id, item_index, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsItem。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1309 | `NE_EU_GetStepsFullState` | `NE_EU_GetStepsFullState(hwnd, element_id, active_index, item_count, direction, hover_index, press_index, last_clicked_index, click_count, change_count, last_action, active_status, failed_count)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1310 | `NE_EU_GetStepsVisualState` | `NE_EU_GetStepsVisualState(hwnd, element_id, space, align_center, simple, finish_status, process_status, icon_count)` | int | new_emoji 原生界面库 底层导出 EU_GetStepsVisualState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1311 | `NE_EU_SetStepsChangeCallback` | `NE_EU_SetStepsChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetStepsChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1312 | `NE_EU_SetAlertDescription` | `NE_EU_SetAlertDescription(hwnd, element_id, desc_bytes, desc_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertDescription。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1313 | `NE_EU_PostSetAlertDescription` | `NE_EU_PostSetAlertDescription(hwnd, element_id, desc_bytes, desc_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAlertDescription。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1314 | `NE_EU_SetAlertType` | `NE_EU_SetAlertType(hwnd, element_id, alert_type)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1315 | `NE_EU_PostSetAlertType` | `NE_EU_PostSetAlertType(hwnd, element_id, alert_type)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAlertType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1316 | `NE_EU_SetAlertEffect` | `NE_EU_SetAlertEffect(hwnd, element_id, effect)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertEffect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1317 | `NE_EU_SetAlertClosable` | `NE_EU_SetAlertClosable(hwnd, element_id, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertClosable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1318 | `NE_EU_SetAlertAdvancedOptions` | `NE_EU_SetAlertAdvancedOptions(hwnd, element_id, show_icon, center, wrap_description)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1319 | `NE_EU_GetAlertAdvancedOptions` | `NE_EU_GetAlertAdvancedOptions(hwnd, element_id, show_icon, center, wrap_description)` | int | new_emoji 原生界面库 底层导出 EU_GetAlertAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1320 | `NE_EU_SetAlertCloseText` | `NE_EU_SetAlertCloseText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertCloseText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1321 | `NE_EU_GetAlertText` | `NE_EU_GetAlertText(hwnd, element_id, text_type, out_bytes, out_len)` | int | new_emoji 原生界面库 底层导出 EU_GetAlertText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1322 | `NE_EU_SetAlertClosed` | `NE_EU_SetAlertClosed(hwnd, element_id, closed)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1323 | `NE_EU_PostSetAlertClosed` | `NE_EU_PostSetAlertClosed(hwnd, element_id, closed)` | int | new_emoji 原生界面库 底层导出 EU_PostSetAlertClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1324 | `NE_EU_TriggerAlertClose` | `NE_EU_TriggerAlertClose(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerAlertClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1325 | `NE_EU_GetAlertClosed` | `NE_EU_GetAlertClosed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetAlertClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1326 | `NE_EU_GetAlertOptions` | `NE_EU_GetAlertOptions(hwnd, element_id, alert_type, effect, closable, closed)` | int | new_emoji 原生界面库 底层导出 EU_GetAlertOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1327 | `NE_EU_GetAlertFullState` | `NE_EU_GetAlertFullState(hwnd, element_id, alert_type, effect, closable, closed, close_hover, close_down, close_count, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetAlertFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1328 | `NE_EU_SetAlertCloseCallback` | `NE_EU_SetAlertCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetAlertCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1329 | `NE_EU_SetResultSubtitle` | `NE_EU_SetResultSubtitle(hwnd, element_id, subtitle_bytes, subtitle_len)` | void | new_emoji 原生界面库 底层导出 EU_SetResultSubtitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1330 | `NE_EU_SetResultType` | `NE_EU_SetResultType(hwnd, element_id, result_type)` | void | new_emoji 原生界面库 底层导出 EU_SetResultType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1331 | `NE_EU_SetResultActions` | `NE_EU_SetResultActions(hwnd, element_id, actions_bytes, actions_len)` | void | new_emoji 原生界面库 底层导出 EU_SetResultActions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1332 | `NE_EU_GetResultAction` | `NE_EU_GetResultAction(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetResultAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1333 | `NE_EU_GetResultOptions` | `NE_EU_GetResultOptions(hwnd, element_id, result_type, action_count, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetResultOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1334 | `NE_EU_SetResultExtraContent` | `NE_EU_SetResultExtraContent(hwnd, element_id, content_bytes, content_len)` | void | new_emoji 原生界面库 底层导出 EU_SetResultExtraContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1335 | `NE_EU_TriggerResultAction` | `NE_EU_TriggerResultAction(hwnd, element_id, action_index)` | void | new_emoji 原生界面库 底层导出 EU_TriggerResultAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1336 | `NE_EU_GetResultText` | `NE_EU_GetResultText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetResultText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1337 | `NE_EU_GetResultActionText` | `NE_EU_GetResultActionText(hwnd, element_id, action_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetResultActionText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1338 | `NE_EU_GetResultFullState` | `NE_EU_GetResultFullState(hwnd, element_id, result_type, action_count, last_action, hover_action, press_action, action_click_count, last_action_source, has_extra_content)` | int | new_emoji 原生界面库 底层导出 EU_GetResultFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1339 | `NE_EU_SetResultActionCallback` | `NE_EU_SetResultActionCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetResultActionCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1340 | `NE_EU_SetMessageBoxBeforeClose` | `NE_EU_SetMessageBoxBeforeClose(hwnd, element_id, delay_ms, loading_bytes, loading_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageBoxBeforeClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1341 | `NE_EU_SetMessageBoxResultCallback` | `NE_EU_SetMessageBoxResultCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageBoxResultCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1342 | `NE_EU_SetMessageBoxInput` | `NE_EU_SetMessageBoxInput(hwnd, element_id, value_bytes, value_len, placeholder_bytes, placeholder_len, pattern_bytes, pattern_len, error_bytes, error_len)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageBoxInput。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1343 | `NE_EU_PostSetMessageBoxInput` | `NE_EU_PostSetMessageBoxInput(hwnd, element_id, value_bytes, value_len, placeholder_bytes, placeholder_len, pattern_bytes, pattern_len, error_bytes, error_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMessageBoxInput。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1344 | `NE_EU_GetMessageBoxInput` | `NE_EU_GetMessageBoxInput(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetMessageBoxInput。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1345 | `NE_EU_GetMessageBoxFullState` | `NE_EU_GetMessageBoxFullState(hwnd, element_id, box_type, show_cancel, center, rich, distinguish, prompt, confirm_loading, input_error_visible, last_action, timer_elapsed_ms)` | int | new_emoji 原生界面库 底层导出 EU_GetMessageBoxFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1346 | `NE_EU_SetMessageBoxTextAlign` | `NE_EU_SetMessageBoxTextAlign(hwnd, element_id, title_align, body_align)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageBoxTextAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1347 | `NE_EU_PostSetMessageBoxTextAlign` | `NE_EU_PostSetMessageBoxTextAlign(hwnd, element_id, title_align, body_align)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMessageBoxTextAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1348 | `NE_EU_GetMessageBoxTextAlign` | `NE_EU_GetMessageBoxTextAlign(hwnd, element_id, title_align, body_align)` | int | new_emoji 原生界面库 底层导出 EU_GetMessageBoxTextAlign。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1349 | `NE_EU_SetMessageText` | `NE_EU_SetMessageText(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1350 | `NE_EU_SetMessageOptions` | `NE_EU_SetMessageOptions(hwnd, element_id, message_type, closable, center, rich, duration_ms, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1351 | `NE_EU_SetMessageClosed` | `NE_EU_SetMessageClosed(hwnd, element_id, closed)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1352 | `NE_EU_GetMessageOptions` | `NE_EU_GetMessageOptions(hwnd, element_id, message_type, closable, center, rich, duration_ms, closed, offset)` | int | new_emoji 原生界面库 底层导出 EU_GetMessageOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1353 | `NE_EU_GetMessageFullState` | `NE_EU_GetMessageFullState(hwnd, element_id, message_type, closable, center, rich, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap, offset)` | int | new_emoji 原生界面库 底层导出 EU_GetMessageFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1354 | `NE_EU_TriggerMessageClose` | `NE_EU_TriggerMessageClose(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerMessageClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1355 | `NE_EU_SetMessageCloseCallback` | `NE_EU_SetMessageCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetMessageCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1356 | `NE_EU_SetNotificationBody` | `NE_EU_SetNotificationBody(hwnd, element_id, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1357 | `NE_EU_PostSetNotificationBody` | `NE_EU_PostSetNotificationBody(hwnd, element_id, body_bytes, body_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetNotificationBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1358 | `NE_EU_SetNotificationType` | `NE_EU_SetNotificationType(hwnd, element_id, notify_type)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1359 | `NE_EU_PostSetNotificationType` | `NE_EU_PostSetNotificationType(hwnd, element_id, notify_type)` | int | new_emoji 原生界面库 底层导出 EU_PostSetNotificationType。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1360 | `NE_EU_SetNotificationClosable` | `NE_EU_SetNotificationClosable(hwnd, element_id, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationClosable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1361 | `NE_EU_SetNotificationPlacement` | `NE_EU_SetNotificationPlacement(hwnd, element_id, placement, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationPlacement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1362 | `NE_EU_PostSetNotificationPlacement` | `NE_EU_PostSetNotificationPlacement(hwnd, element_id, placement, offset)` | int | new_emoji 原生界面库 底层导出 EU_PostSetNotificationPlacement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1363 | `NE_EU_SetNotificationRichMode` | `NE_EU_SetNotificationRichMode(hwnd, element_id, rich)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationRichMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1364 | `NE_EU_SetNotificationOptions` | `NE_EU_SetNotificationOptions(hwnd, element_id, notify_type, closable, duration_ms)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1365 | `NE_EU_SetNotificationClosed` | `NE_EU_SetNotificationClosed(hwnd, element_id, closed)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1366 | `NE_EU_PostSetNotificationClosed` | `NE_EU_PostSetNotificationClosed(hwnd, element_id, closed)` | int | new_emoji 原生界面库 底层导出 EU_PostSetNotificationClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1367 | `NE_EU_GetNotificationClosed` | `NE_EU_GetNotificationClosed(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetNotificationClosed。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1368 | `NE_EU_GetNotificationOptions` | `NE_EU_GetNotificationOptions(hwnd, element_id, notify_type, closable, duration_ms, closed)` | int | new_emoji 原生界面库 底层导出 EU_GetNotificationOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1369 | `NE_EU_SetNotificationStack` | `NE_EU_SetNotificationStack(hwnd, element_id, stack_index, stack_gap)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationStack。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1370 | `NE_EU_TriggerNotificationClose` | `NE_EU_TriggerNotificationClose(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerNotificationClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1371 | `NE_EU_GetNotificationText` | `NE_EU_GetNotificationText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetNotificationText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1372 | `NE_EU_GetNotificationFullState` | `NE_EU_GetNotificationFullState(hwnd, element_id, notify_type, closable, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap)` | int | new_emoji 原生界面库 底层导出 EU_GetNotificationFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1373 | `NE_EU_GetNotificationFullStateEx` | `NE_EU_GetNotificationFullStateEx(hwnd, element_id, notify_type, closable, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap, placement, offset, rich)` | int | new_emoji 原生界面库 底层导出 EU_GetNotificationFullStateEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1374 | `NE_EU_SetNotificationCloseCallback` | `NE_EU_SetNotificationCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetNotificationCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1375 | `NE_EU_SetLoadingActive` | `NE_EU_SetLoadingActive(hwnd, element_id, active)` | void | new_emoji 原生界面库 底层导出 EU_SetLoadingActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1376 | `NE_EU_PostSetLoadingActive` | `NE_EU_PostSetLoadingActive(hwnd, element_id, active)` | int | new_emoji 原生界面库 底层导出 EU_PostSetLoadingActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1377 | `NE_EU_SetLoadingText` | `NE_EU_SetLoadingText(hwnd, element_id, text_bytes, text_len)` | void | new_emoji 原生界面库 底层导出 EU_SetLoadingText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1378 | `NE_EU_PostSetLoadingText` | `NE_EU_PostSetLoadingText(hwnd, element_id, text_bytes, text_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetLoadingText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1379 | `NE_EU_SetLoadingOptions` | `NE_EU_SetLoadingOptions(hwnd, element_id, active, fullscreen, progress)` | void | new_emoji 原生界面库 底层导出 EU_SetLoadingOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1380 | `NE_EU_PostSetLoadingOptions` | `NE_EU_PostSetLoadingOptions(hwnd, element_id, active, fullscreen, progress)` | int | new_emoji 原生界面库 底层导出 EU_PostSetLoadingOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1381 | `NE_EU_SetLoadingStyle` | `NE_EU_SetLoadingStyle(hwnd, element_id, background, spinner_color, text_color, spinner_type, lock_input)` | void | new_emoji 原生界面库 底层导出 EU_SetLoadingStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1382 | `NE_EU_GetLoadingActive` | `NE_EU_GetLoadingActive(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetLoadingActive。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1383 | `NE_EU_GetLoadingOptions` | `NE_EU_GetLoadingOptions(hwnd, element_id, active, fullscreen, progress)` | int | new_emoji 原生界面库 底层导出 EU_GetLoadingOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1384 | `NE_EU_SetLoadingTarget` | `NE_EU_SetLoadingTarget(hwnd, element_id, target_element_id, padding)` | void | new_emoji 原生界面库 底层导出 EU_SetLoadingTarget。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1385 | `NE_EU_GetLoadingText` | `NE_EU_GetLoadingText(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetLoadingText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1386 | `NE_EU_GetLoadingStyle` | `NE_EU_GetLoadingStyle(hwnd, element_id, background, spinner_color, text_color, spinner_type, lock_input)` | int | new_emoji 原生界面库 底层导出 EU_GetLoadingStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1387 | `NE_EU_ShowLoading` | `NE_EU_ShowLoading(hwnd, target_element_id, text_bytes, text_len, fullscreen, lock_input, background, spinner_color, text_color, spinner_type)` | int | new_emoji 原生界面库 底层导出 EU_ShowLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1388 | `NE_EU_CloseLoading` | `NE_EU_CloseLoading(hwnd, loading_id)` | int | new_emoji 原生界面库 底层导出 EU_CloseLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1389 | `NE_EU_GetLoadingFullState` | `NE_EU_GetLoadingFullState(hwnd, element_id, active, fullscreen, progress, target_element_id, target_padding, animation_angle, tick_count, timer_running, last_action)` | int | new_emoji 原生界面库 底层导出 EU_GetLoadingFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1390 | `NE_EU_SetDialogOpen` | `NE_EU_SetDialogOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1391 | `NE_EU_PostSetDialogOpen` | `NE_EU_PostSetDialogOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDialogOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1392 | `NE_EU_SetDialogTitle` | `NE_EU_SetDialogTitle(hwnd, element_id, title_bytes, title_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1393 | `NE_EU_PostSetDialogTitle` | `NE_EU_PostSetDialogTitle(hwnd, element_id, title_bytes, title_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDialogTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1394 | `NE_EU_SetDialogBody` | `NE_EU_SetDialogBody(hwnd, element_id, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1395 | `NE_EU_PostSetDialogBody` | `NE_EU_PostSetDialogBody(hwnd, element_id, body_bytes, body_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDialogBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1396 | `NE_EU_SetDialogOptions` | `NE_EU_SetDialogOptions(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1397 | `NE_EU_GetDialogOpen` | `NE_EU_GetDialogOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1398 | `NE_EU_GetDialogOptions` | `NE_EU_GetDialogOptions(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1399 | `NE_EU_SetDialogButtons` | `NE_EU_SetDialogButtons(hwnd, element_id, buttons_bytes, buttons_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogButtons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1400 | `NE_EU_PostSetDialogButtons` | `NE_EU_PostSetDialogButtons(hwnd, element_id, buttons_bytes, buttons_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDialogButtons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1401 | `NE_EU_TriggerDialogButton` | `NE_EU_TriggerDialogButton(hwnd, element_id, button_index)` | void | new_emoji 原生界面库 底层导出 EU_TriggerDialogButton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1402 | `NE_EU_GetDialogText` | `NE_EU_GetDialogText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1403 | `NE_EU_GetDialogButtonText` | `NE_EU_GetDialogButtonText(hwnd, element_id, button_index, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogButtonText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1404 | `NE_EU_GetDialogFullState` | `NE_EU_GetDialogFullState(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h, button_count, active_button, last_button, button_click_count, close_count, last_action, offset_x, offset_y, hover_part, press_part)` | int | new_emoji 原生界面库 底层导出 EU_GetDialogFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1405 | `NE_EU_SetDialogButtonCallback` | `NE_EU_SetDialogButtonCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDialogButtonCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1406 | `NE_EU_SetDrawerOpen` | `NE_EU_SetDrawerOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1407 | `NE_EU_PostSetDrawerOpen` | `NE_EU_PostSetDrawerOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDrawerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1408 | `NE_EU_SetDrawerTitle` | `NE_EU_SetDrawerTitle(hwnd, element_id, title_bytes, title_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1409 | `NE_EU_PostSetDrawerTitle` | `NE_EU_PostSetDrawerTitle(hwnd, element_id, title_bytes, title_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDrawerTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1410 | `NE_EU_SetDrawerBody` | `NE_EU_SetDrawerBody(hwnd, element_id, body_bytes, body_len)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1411 | `NE_EU_PostSetDrawerBody` | `NE_EU_PostSetDrawerBody(hwnd, element_id, body_bytes, body_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetDrawerBody。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1412 | `NE_EU_SetDrawerPlacement` | `NE_EU_SetDrawerPlacement(hwnd, element_id, placement)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerPlacement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1413 | `NE_EU_SetDrawerOptions` | `NE_EU_SetDrawerOptions(hwnd, element_id, placement, open, modal, closable, close_on_mask, size)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1414 | `NE_EU_SetDrawerAdvancedOptions` | `NE_EU_SetDrawerAdvancedOptions(hwnd, element_id, show_header, show_close, close_on_escape, content_padding, footer_height, size_mode, size_value)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1415 | `NE_EU_GetDrawerAdvancedOptions` | `NE_EU_GetDrawerAdvancedOptions(hwnd, element_id, show_header, show_close, close_on_escape, content_padding, footer_height, size_mode, size_value, content_parent_id, footer_parent_id, close_pending)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerAdvancedOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1416 | `NE_EU_GetDrawerContentParent` | `NE_EU_GetDrawerContentParent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerContentParent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1417 | `NE_EU_GetDrawerFooterParent` | `NE_EU_GetDrawerFooterParent(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerFooterParent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1418 | `NE_EU_SetDrawerBeforeCloseCallback` | `NE_EU_SetDrawerBeforeCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerBeforeCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1419 | `NE_EU_ConfirmDrawerClose` | `NE_EU_ConfirmDrawerClose(hwnd, element_id, allow)` | void | new_emoji 原生界面库 底层导出 EU_ConfirmDrawerClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1420 | `NE_EU_GetDrawerOpen` | `NE_EU_GetDrawerOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1421 | `NE_EU_GetDrawerOptions` | `NE_EU_GetDrawerOptions(hwnd, element_id, placement, open, modal, closable, close_on_mask, size)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1422 | `NE_EU_SetDrawerAnimation` | `NE_EU_SetDrawerAnimation(hwnd, element_id, duration_ms)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerAnimation。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1423 | `NE_EU_TriggerDrawerClose` | `NE_EU_TriggerDrawerClose(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_TriggerDrawerClose。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1424 | `NE_EU_GetDrawerText` | `NE_EU_GetDrawerText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1425 | `NE_EU_GetDrawerFullState` | `NE_EU_GetDrawerFullState(hwnd, element_id, placement, open, modal, closable, close_on_mask, size, animation_progress, animation_ms, tick_count, timer_running, close_count, last_action, hover_part, press_part)` | int | new_emoji 原生界面库 底层导出 EU_GetDrawerFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1426 | `NE_EU_SetDrawerCloseCallback` | `NE_EU_SetDrawerCloseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetDrawerCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1427 | `NE_EU_SetTooltipContent` | `NE_EU_SetTooltipContent(hwnd, element_id, content_bytes, content_len)` | void | new_emoji 原生界面库 底层导出 EU_SetTooltipContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1428 | `NE_EU_PostSetTooltipContent` | `NE_EU_PostSetTooltipContent(hwnd, element_id, content_bytes, content_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTooltipContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1429 | `NE_EU_SetTooltipOpen` | `NE_EU_SetTooltipOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetTooltipOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1430 | `NE_EU_PostSetTooltipOpen` | `NE_EU_PostSetTooltipOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTooltipOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1431 | `NE_EU_SetTooltipOptions` | `NE_EU_SetTooltipOptions(hwnd, element_id, placement, open, max_width)` | void | new_emoji 原生界面库 底层导出 EU_SetTooltipOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1432 | `NE_EU_GetTooltipOpen` | `NE_EU_GetTooltipOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTooltipOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1433 | `NE_EU_GetTooltipOptions` | `NE_EU_GetTooltipOptions(hwnd, element_id, placement, open, max_width)` | int | new_emoji 原生界面库 底层导出 EU_GetTooltipOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1434 | `NE_EU_SetTooltipBehavior` | `NE_EU_SetTooltipBehavior(hwnd, element_id, show_delay, hide_delay, trigger_mode, show_arrow)` | void | new_emoji 原生界面库 底层导出 EU_SetTooltipBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1435 | `NE_EU_TriggerTooltip` | `NE_EU_TriggerTooltip(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_TriggerTooltip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1436 | `NE_EU_GetTooltipText` | `NE_EU_GetTooltipText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetTooltipText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1437 | `NE_EU_GetTooltipFullState` | `NE_EU_GetTooltipFullState(hwnd, element_id, placement, open, max_width, show_arrow, show_delay, hide_delay, trigger_mode, timer_running, timer_phase, open_count, close_count, last_action, popup_x, popup_y, popup_w, popup_h)` | int | new_emoji 原生界面库 底层导出 EU_GetTooltipFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1438 | `NE_EU_SetPopoverOpen` | `NE_EU_SetPopoverOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1439 | `NE_EU_PostSetPopoverOpen` | `NE_EU_PostSetPopoverOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopoverOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1440 | `NE_EU_SetPopoverContent` | `NE_EU_SetPopoverContent(hwnd, element_id, content_bytes, content_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1441 | `NE_EU_PostSetPopoverContent` | `NE_EU_PostSetPopoverContent(hwnd, element_id, content_bytes, content_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopoverContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1442 | `NE_EU_SetPopoverTitle` | `NE_EU_SetPopoverTitle(hwnd, element_id, title_bytes, title_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1443 | `NE_EU_PostSetPopoverTitle` | `NE_EU_PostSetPopoverTitle(hwnd, element_id, title_bytes, title_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopoverTitle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1444 | `NE_EU_SetPopoverOptions` | `NE_EU_SetPopoverOptions(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1445 | `NE_EU_GetPopoverOpen` | `NE_EU_GetPopoverOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1446 | `NE_EU_GetPopoverOptions` | `NE_EU_GetPopoverOptions(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1447 | `NE_EU_TriggerPopover` | `NE_EU_TriggerPopover(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_TriggerPopover。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1448 | `NE_EU_GetPopoverText` | `NE_EU_GetPopoverText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1449 | `NE_EU_GetPopoverFullState` | `NE_EU_GetPopoverFullState(hwnd, element_id, placement, open, popup_width, popup_height, closable, open_count, close_count, last_action, focus_part, close_hover, popup_x, popup_y, popup_w, popup_h)` | int | new_emoji 原生界面库 底层导出 EU_GetPopoverFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1450 | `NE_EU_SetPopoverActionCallback` | `NE_EU_SetPopoverActionCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverActionCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1451 | `NE_EU_SetPopconfirmOpen` | `NE_EU_SetPopconfirmOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1452 | `NE_EU_PostSetPopconfirmOpen` | `NE_EU_PostSetPopconfirmOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopconfirmOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1453 | `NE_EU_SetPopconfirmOptions` | `NE_EU_SetPopconfirmOptions(hwnd, element_id, placement, open, popup_width, popup_height)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1454 | `NE_EU_SetPopconfirmContent` | `NE_EU_SetPopconfirmContent(hwnd, element_id, title_bytes, title_len, content_bytes, content_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1455 | `NE_EU_PostSetPopconfirmContent` | `NE_EU_PostSetPopconfirmContent(hwnd, element_id, title_bytes, title_len, content_bytes, content_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopconfirmContent。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1456 | `NE_EU_SetPopconfirmButtons` | `NE_EU_SetPopconfirmButtons(hwnd, element_id, confirm_bytes, confirm_len, cancel_bytes, cancel_len)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmButtons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1457 | `NE_EU_PostSetPopconfirmButtons` | `NE_EU_PostSetPopconfirmButtons(hwnd, element_id, confirm_bytes, confirm_len, cancel_bytes, cancel_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetPopconfirmButtons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1458 | `NE_EU_ResetPopconfirmResult` | `NE_EU_ResetPopconfirmResult(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ResetPopconfirmResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1459 | `NE_EU_GetPopconfirmOpen` | `NE_EU_GetPopconfirmOpen(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1460 | `NE_EU_GetPopconfirmResult` | `NE_EU_GetPopconfirmResult(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1461 | `NE_EU_GetPopconfirmOptions` | `NE_EU_GetPopconfirmOptions(hwnd, element_id, placement, open, popup_width, popup_height, result)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1462 | `NE_EU_TriggerPopconfirmResult` | `NE_EU_TriggerPopconfirmResult(hwnd, element_id, result)` | void | new_emoji 原生界面库 底层导出 EU_TriggerPopconfirmResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1463 | `NE_EU_GetPopconfirmText` | `NE_EU_GetPopconfirmText(hwnd, element_id, text_kind, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1464 | `NE_EU_GetPopconfirmFullState` | `NE_EU_GetPopconfirmFullState(hwnd, element_id, placement, open, popup_width, popup_height, result, confirm_count, cancel_count, result_action, focus_part, hover_button, press_button, popup_x, popup_y, popup_w, popup_h)` | int | new_emoji 原生界面库 底层导出 EU_GetPopconfirmFullState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1465 | `NE_EU_SetPopconfirmResultCallback` | `NE_EU_SetPopconfirmResultCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetPopconfirmResultCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1466 | `NE_EU_SetElementClickCallback` | `NE_EU_SetElementClickCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementClickCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1467 | `NE_EU_AddElementClickSetTextAction` | `NE_EU_AddElementClickSetTextAction(hwnd, element_id, target_element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_AddElementClickSetTextAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1468 | `NE_EU_AddElementClickSetWindowTitleAction` | `NE_EU_AddElementClickSetWindowTitleAction(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_AddElementClickSetWindowTitleAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1469 | `NE_EU_AddElementClickSetResizeBorderAction` | `NE_EU_AddElementClickSetResizeBorderAction(hwnd, element_id, left, top, right, bottom)` | void | new_emoji 原生界面库 底层导出 EU_AddElementClickSetResizeBorderAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1470 | `NE_EU_AddElementClickSetWindowDraggableAction` | `NE_EU_AddElementClickSetWindowDraggableAction(hwnd, element_id, draggable)` | void | new_emoji 原生界面库 底层导出 EU_AddElementClickSetWindowDraggableAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1471 | `NE_EU_AddElementClickSetInputSelectionAction` | `NE_EU_AddElementClickSetInputSelectionAction(hwnd, element_id, target_element_id, start, end)` | void | new_emoji 原生界面库 底层导出 EU_AddElementClickSetInputSelectionAction。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1472 | `NE_EU_ClearElementClickTextActions` | `NE_EU_ClearElementClickTextActions(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_ClearElementClickTextActions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1473 | `NE_EU_SetElementKeyCallback` | `NE_EU_SetElementKeyCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementKeyCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1474 | `NE_EU_SetElementMouseCallback` | `NE_EU_SetElementMouseCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementMouseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1475 | `NE_EU_SetElementFocusCallback` | `NE_EU_SetElementFocusCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementFocusCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1476 | `NE_EU_SetElementChangeCallback` | `NE_EU_SetElementChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1477 | `NE_EU_SetElementTextChangeCallback` | `NE_EU_SetElementTextChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementTextChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1478 | `NE_EU_SetElementSelectionChangeCallback` | `NE_EU_SetElementSelectionChangeCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetElementSelectionChangeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1479 | `NE_EU_SetWindowResizeCallback` | `NE_EU_SetWindowResizeCallback(hwnd, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowResizeCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1480 | `NE_EU_SetWindowCloseCallback` | `NE_EU_SetWindowCloseCallback(hwnd, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowCloseCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1481 | `NE_EU_SetDarkMode` | `NE_EU_SetDarkMode(hwnd, dark_mode)` | void | new_emoji 原生界面库 底层导出 EU_SetDarkMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1482 | `NE_EU_SetThemeMode` | `NE_EU_SetThemeMode(hwnd, mode)` | void | new_emoji 原生界面库 底层导出 EU_SetThemeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1483 | `NE_EU_GetThemeMode` | `NE_EU_GetThemeMode(hwnd)` | int | new_emoji 原生界面库 底层导出 EU_GetThemeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1484 | `NE_EU_SetThemeColor` | `NE_EU_SetThemeColor(hwnd, token_bytes, token_len, value)` | int | new_emoji 原生界面库 底层导出 EU_SetThemeColor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1485 | `NE_EU_SetChromeThemePreset` | `NE_EU_SetChromeThemePreset(hwnd, preset)` | void | new_emoji 原生界面库 底层导出 EU_SetChromeThemePreset。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1486 | `NE_EU_SetThemeToken` | `NE_EU_SetThemeToken(hwnd, token_bytes, token_len, value)` | int | new_emoji 原生界面库 底层导出 EU_SetThemeToken。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1487 | `NE_EU_GetThemeToken` | `NE_EU_GetThemeToken(hwnd, token_bytes, token_len, value)` | int | new_emoji 原生界面库 底层导出 EU_GetThemeToken。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1488 | `NE_EU_SetHighContrastMode` | `NE_EU_SetHighContrastMode(hwnd, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetHighContrastMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1489 | `NE_EU_SetIncognitoMode` | `NE_EU_SetIncognitoMode(hwnd, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetIncognitoMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1490 | `NE_EU_ResetTheme` | `NE_EU_ResetTheme(hwnd)` | void | new_emoji 原生界面库 底层导出 EU_ResetTheme。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1491 | `NE_EU_InvalidateElement` | `NE_EU_InvalidateElement(hwnd, element_id)` | void | new_emoji 原生界面库 底层导出 EU_InvalidateElement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1492 | `NE_EU_SetIconButtonIcon` | `NE_EU_SetIconButtonIcon(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1493 | `NE_EU_PostSetIconButtonIcon` | `NE_EU_PostSetIconButtonIcon(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetIconButtonIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1494 | `NE_EU_SetIconButtonTooltip` | `NE_EU_SetIconButtonTooltip(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonTooltip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1495 | `NE_EU_PostSetIconButtonTooltip` | `NE_EU_PostSetIconButtonTooltip(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetIconButtonTooltip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1496 | `NE_EU_SetIconButtonBadge` | `NE_EU_SetIconButtonBadge(hwnd, element_id, bytes, len, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonBadge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1497 | `NE_EU_PostSetIconButtonBadge` | `NE_EU_PostSetIconButtonBadge(hwnd, element_id, bytes, len, visible)` | int | new_emoji 原生界面库 底层导出 EU_PostSetIconButtonBadge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1498 | `NE_EU_SetIconButtonChecked` | `NE_EU_SetIconButtonChecked(hwnd, element_id, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1499 | `NE_EU_PostSetIconButtonChecked` | `NE_EU_PostSetIconButtonChecked(hwnd, element_id, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetIconButtonChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1500 | `NE_EU_GetIconButtonChecked` | `NE_EU_GetIconButtonChecked(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetIconButtonChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1501 | `NE_EU_SetIconButtonDropdown` | `NE_EU_SetIconButtonDropdown(hwnd, element_id, dropdown_element_id)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonDropdown。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1502 | `NE_EU_SetIconButtonColors` | `NE_EU_SetIconButtonColors(hwnd, element_id, normal_bg, hover_bg, pressed_bg, checked_bg, disabled_bg, icon_color, disabled_icon_color)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonColors。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1503 | `NE_EU_SetIconButtonShape` | `NE_EU_SetIconButtonShape(hwnd, element_id, shape, radius)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonShape。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1504 | `NE_EU_SetIconButtonPadding` | `NE_EU_SetIconButtonPadding(hwnd, element_id, left, top, right, bottom)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonPadding。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1505 | `NE_EU_SetIconButtonIconSize` | `NE_EU_SetIconButtonIconSize(hwnd, element_id, size)` | void | new_emoji 原生界面库 底层导出 EU_SetIconButtonIconSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1506 | `NE_EU_GetIconButtonState` | `NE_EU_GetIconButtonState(hwnd, element_id, checked, hovered, pressed, badge_visible)` | int | new_emoji 原生界面库 底层导出 EU_GetIconButtonState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1507 | `NE_EU_SetTabsChromeMode` | `NE_EU_SetTabsChromeMode(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsChromeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1508 | `NE_EU_GetTabsChromeMode` | `NE_EU_GetTabsChromeMode(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsChromeMode。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1509 | `NE_EU_SetTabsItemIcon` | `NE_EU_SetTabsItemIcon(hwnd, element_id, index, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1510 | `NE_EU_SetTabsItemLoading` | `NE_EU_SetTabsItemLoading(hwnd, element_id, index, loading)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1511 | `NE_EU_PostSetTabsItemLoading` | `NE_EU_PostSetTabsItemLoading(hwnd, element_id, index, loading)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1512 | `NE_EU_SetTabsItemPinned` | `NE_EU_SetTabsItemPinned(hwnd, element_id, index, pinned)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemPinned。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1513 | `NE_EU_PostSetTabsItemPinned` | `NE_EU_PostSetTabsItemPinned(hwnd, element_id, index, pinned)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemPinned。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1514 | `NE_EU_SetTabsItemMuted` | `NE_EU_SetTabsItemMuted(hwnd, element_id, index, muted)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemMuted。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1515 | `NE_EU_PostSetTabsItemMuted` | `NE_EU_PostSetTabsItemMuted(hwnd, element_id, index, muted)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemMuted。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1516 | `NE_EU_SetTabsItemClosable` | `NE_EU_SetTabsItemClosable(hwnd, element_id, index, closable)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemClosable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1517 | `NE_EU_PostSetTabsItemClosable` | `NE_EU_PostSetTabsItemClosable(hwnd, element_id, index, closable)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemClosable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1518 | `NE_EU_SetTabsItemChromeState` | `NE_EU_SetTabsItemChromeState(hwnd, element_id, index, loading, pinned, muted, alerting)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsItemChromeState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1519 | `NE_EU_PostSetTabsItemChromeState` | `NE_EU_PostSetTabsItemChromeState(hwnd, element_id, index, loading, pinned, muted, alerting)` | int | new_emoji 原生界面库 底层导出 EU_PostSetTabsItemChromeState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1520 | `NE_EU_GetTabsItemChromeState` | `NE_EU_GetTabsItemChromeState(hwnd, element_id, index, loading, pinned, muted, alerting)` | int | new_emoji 原生界面库 底层导出 EU_GetTabsItemChromeState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1521 | `NE_EU_SetTabsChromeMetrics` | `NE_EU_SetTabsChromeMetrics(hwnd, element_id, min_width, max_width, pinned_width, height, overlap)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsChromeMetrics。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1522 | `NE_EU_SetTabsNewButtonVisible` | `NE_EU_SetTabsNewButtonVisible(hwnd, element_id, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsNewButtonVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1523 | `NE_EU_SetTabsDragOptions` | `NE_EU_SetTabsDragOptions(hwnd, element_id, reorder_enabled, detach_enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsDragOptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1524 | `NE_EU_SetTabsReorderCallback` | `NE_EU_SetTabsReorderCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetTabsReorderCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1525 | `NE_EU_SetOmniboxValue` | `NE_EU_SetOmniboxValue(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1526 | `NE_EU_PostSetOmniboxValue` | `NE_EU_PostSetOmniboxValue(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1527 | `NE_EU_GetOmniboxValue` | `NE_EU_GetOmniboxValue(hwnd, element_id, buffer, buffer_size)` | int | new_emoji 原生界面库 底层导出 EU_GetOmniboxValue。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1528 | `NE_EU_SetOmniboxPlaceholder` | `NE_EU_SetOmniboxPlaceholder(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1529 | `NE_EU_PostSetOmniboxPlaceholder` | `NE_EU_PostSetOmniboxPlaceholder(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1530 | `NE_EU_SetOmniboxSecurityState` | `NE_EU_SetOmniboxSecurityState(hwnd, element_id, state, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxSecurityState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1531 | `NE_EU_PostSetOmniboxSecurityState` | `NE_EU_PostSetOmniboxSecurityState(hwnd, element_id, state, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxSecurityState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1532 | `NE_EU_SetOmniboxPrefixChip` | `NE_EU_SetOmniboxPrefixChip(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, bg_color, fg_color)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxPrefixChip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1533 | `NE_EU_PostSetOmniboxPrefixChip` | `NE_EU_PostSetOmniboxPrefixChip(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, bg_color, fg_color)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxPrefixChip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1534 | `NE_EU_SetOmniboxActionIcons` | `NE_EU_SetOmniboxActionIcons(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxActionIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1535 | `NE_EU_PostSetOmniboxActionIcons` | `NE_EU_PostSetOmniboxActionIcons(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxActionIcons。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1536 | `NE_EU_SetOmniboxSuggestionItems` | `NE_EU_SetOmniboxSuggestionItems(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxSuggestionItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1537 | `NE_EU_PostSetOmniboxSuggestionItems` | `NE_EU_PostSetOmniboxSuggestionItems(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxSuggestionItems。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1538 | `NE_EU_SetOmniboxSuggestionOpen` | `NE_EU_SetOmniboxSuggestionOpen(hwnd, element_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxSuggestionOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1539 | `NE_EU_PostSetOmniboxSuggestionOpen` | `NE_EU_PostSetOmniboxSuggestionOpen(hwnd, element_id, open)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxSuggestionOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1540 | `NE_EU_SetOmniboxSuggestionSelected` | `NE_EU_SetOmniboxSuggestionSelected(hwnd, element_id, index)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxSuggestionSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1541 | `NE_EU_PostSetOmniboxSuggestionSelected` | `NE_EU_PostSetOmniboxSuggestionSelected(hwnd, element_id, index)` | int | new_emoji 原生界面库 底层导出 EU_PostSetOmniboxSuggestionSelected。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1542 | `NE_EU_GetOmniboxSuggestionState` | `NE_EU_GetOmniboxSuggestionState(hwnd, element_id, open, selected, count)` | int | new_emoji 原生界面库 底层导出 EU_GetOmniboxSuggestionState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1543 | `NE_EU_SetOmniboxCommitCallback` | `NE_EU_SetOmniboxCommitCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxCommitCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1544 | `NE_EU_SetOmniboxIconButtonCallback` | `NE_EU_SetOmniboxIconButtonCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetOmniboxIconButtonCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1545 | `NE_EU_SetMenuItemIcon` | `NE_EU_SetMenuItemIcon(hwnd, element_id, index, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1546 | `NE_EU_PostSetMenuItemIcon` | `NE_EU_PostSetMenuItemIcon(hwnd, element_id, index, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuItemIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1547 | `NE_EU_SetMenuItemShortcut` | `NE_EU_SetMenuItemShortcut(hwnd, element_id, index, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemShortcut。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1548 | `NE_EU_PostSetMenuItemShortcut` | `NE_EU_PostSetMenuItemShortcut(hwnd, element_id, index, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuItemShortcut。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1549 | `NE_EU_SetMenuItemChecked` | `NE_EU_SetMenuItemChecked(hwnd, element_id, index, checked)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1550 | `NE_EU_PostSetMenuItemChecked` | `NE_EU_PostSetMenuItemChecked(hwnd, element_id, index, checked)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuItemChecked。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1551 | `NE_EU_SetMenuItemSeparator` | `NE_EU_SetMenuItemSeparator(hwnd, element_id, index, separator)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1552 | `NE_EU_PostSetMenuItemSeparator` | `NE_EU_PostSetMenuItemSeparator(hwnd, element_id, index, separator)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuItemSeparator。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1553 | `NE_EU_SetMenuItemSubmenu` | `NE_EU_SetMenuItemSubmenu(hwnd, element_id, index, submenu_element_id)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuItemSubmenu。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1554 | `NE_EU_SetMenuPopupPosition` | `NE_EU_SetMenuPopupPosition(hwnd, element_id, anchor_element_id, placement, offset)` | void | new_emoji 原生界面库 底层导出 EU_SetMenuPopupPosition。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1555 | `NE_EU_PostSetMenuPopupPosition` | `NE_EU_PostSetMenuPopupPosition(hwnd, element_id, anchor_element_id, placement, offset)` | int | new_emoji 原生界面库 底层导出 EU_PostSetMenuPopupPosition。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1556 | `NE_EU_SetContextMenuCallback` | `NE_EU_SetContextMenuCallback(hwnd, element_id, cb)` | void | new_emoji 原生界面库 底层导出 EU_SetContextMenuCallback。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1557 | `NE_EU_SetPopoverAnchorElement` | `NE_EU_SetPopoverAnchorElement(hwnd, element_id, anchor_element_id)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverAnchorElement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1558 | `NE_EU_SetPopoverArrow` | `NE_EU_SetPopoverArrow(hwnd, element_id, visible, size)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverArrow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1559 | `NE_EU_SetPopoverElevation` | `NE_EU_SetPopoverElevation(hwnd, element_id, level)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverElevation。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1560 | `NE_EU_SetPopoverAutoPlacement` | `NE_EU_SetPopoverAutoPlacement(hwnd, element_id, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverAutoPlacement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1561 | `NE_EU_SetPopoverDismissBehavior` | `NE_EU_SetPopoverDismissBehavior(hwnd, element_id, close_on_outside, close_on_escape)` | void | new_emoji 原生界面库 底层导出 EU_SetPopoverDismissBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1562 | `NE_EU_SetPopupAnchorElement` | `NE_EU_SetPopupAnchorElement(hwnd, popup_id, anchor_element_id)` | void | new_emoji 原生界面库 底层导出 EU_SetPopupAnchorElement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1563 | `NE_EU_SetPopupPlacement` | `NE_EU_SetPopupPlacement(hwnd, popup_id, placement, offset_x, offset_y)` | void | new_emoji 原生界面库 底层导出 EU_SetPopupPlacement。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1564 | `NE_EU_SetPopupOpen` | `NE_EU_SetPopupOpen(hwnd, popup_id, open)` | void | new_emoji 原生界面库 底层导出 EU_SetPopupOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1565 | `NE_EU_GetPopupOpen` | `NE_EU_GetPopupOpen(hwnd, popup_id)` | int | new_emoji 原生界面库 底层导出 EU_GetPopupOpen。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1566 | `NE_EU_SetPopupDismissBehavior` | `NE_EU_SetPopupDismissBehavior(hwnd, popup_id, close_on_outside, close_on_escape)` | void | new_emoji 原生界面库 底层导出 EU_SetPopupDismissBehavior。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1567 | `NE_EU_SetElementPopup` | `NE_EU_SetElementPopup(hwnd, element_id, popup_id, trigger)` | void | new_emoji 原生界面库 底层导出 EU_SetElementPopup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1568 | `NE_EU_ClearElementPopup` | `NE_EU_ClearElementPopup(hwnd, element_id, trigger)` | void | new_emoji 原生界面库 底层导出 EU_ClearElementPopup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1569 | `NE_EU_GetElementPopup` | `NE_EU_GetElementPopup(hwnd, element_id, trigger)` | int | new_emoji 原生界面库 底层导出 EU_GetElementPopup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1570 | `NE_EU_SetTitleBarVisible` | `NE_EU_SetTitleBarVisible(hwnd, visible)` | void | new_emoji 原生界面库 底层导出 EU_SetTitleBarVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1571 | `NE_EU_SetTitleBarHeight` | `NE_EU_SetTitleBarHeight(hwnd, height)` | void | new_emoji 原生界面库 底层导出 EU_SetTitleBarHeight。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1572 | `NE_EU_SetTitleBarButtonStyle` | `NE_EU_SetTitleBarButtonStyle(hwnd, button_width, button_height, icon_color, hover_bg, close_hover_bg)` | void | new_emoji 原生界面库 底层导出 EU_SetTitleBarButtonStyle。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1573 | `NE_EU_SetWindowCaptionButtonsVisible` | `NE_EU_SetWindowCaptionButtonsVisible(hwnd, show_minimize, show_maximize, show_close)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowCaptionButtonsVisible。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1574 | `NE_EU_GetWindowFrameFlags` | `NE_EU_GetWindowFrameFlags(hwnd)` | int | new_emoji 原生界面库 底层导出 EU_GetWindowFrameFlags。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1575 | `NE_EU_SetWindowFrameFlags` | `NE_EU_SetWindowFrameFlags(hwnd, frame_flags)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowFrameFlags。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1576 | `NE_EU_SetWindowResizeBorder` | `NE_EU_SetWindowResizeBorder(hwnd, left, top, right, bottom)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowResizeBorder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1577 | `NE_EU_GetWindowResizeBorder` | `NE_EU_GetWindowResizeBorder(hwnd, left, top, right, bottom)` | int | new_emoji 原生界面库 底层导出 EU_GetWindowResizeBorder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1578 | `NE_EU_SetWindowDragRegion` | `NE_EU_SetWindowDragRegion(hwnd, x, y, w, h, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowDragRegion。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1579 | `NE_EU_ClearWindowDragRegions` | `NE_EU_ClearWindowDragRegions(hwnd)` | void | new_emoji 原生界面库 底层导出 EU_ClearWindowDragRegions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1580 | `NE_EU_SetWindowNoDragRegion` | `NE_EU_SetWindowNoDragRegion(hwnd, x, y, w, h, enabled)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowNoDragRegion。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1581 | `NE_EU_ClearWindowNoDragRegions` | `NE_EU_ClearWindowNoDragRegions(hwnd)` | void | new_emoji 原生界面库 底层导出 EU_ClearWindowNoDragRegions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1582 | `NE_EU_SetElementWindowCommand` | `NE_EU_SetElementWindowCommand(hwnd, element_id, command)` | void | new_emoji 原生界面库 底层导出 EU_SetElementWindowCommand。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1583 | `NE_EU_GetElementWindowCommand` | `NE_EU_GetElementWindowCommand(hwnd, element_id)` | int | new_emoji 原生界面库 底层导出 EU_GetElementWindowCommand。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1584 | `NE_EU_SetWindowCaptionButtonBounds` | `NE_EU_SetWindowCaptionButtonBounds(hwnd, x, y, w, h)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowCaptionButtonBounds。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1585 | `NE_EU_SetWindowRoundedCorners` | `NE_EU_SetWindowRoundedCorners(hwnd, enabled, radius)` | void | new_emoji 原生界面库 底层导出 EU_SetWindowRoundedCorners。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1586 | `NE_EU_SetContainerFlexLayout` | `NE_EU_SetContainerFlexLayout(hwnd, element_id, direction, gap, align_items, justify_content)` | void | new_emoji 原生界面库 底层导出 EU_SetContainerFlexLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1587 | `NE_EU_SetElementFlexGrow` | `NE_EU_SetElementFlexGrow(hwnd, element_id, grow)` | void | new_emoji 原生界面库 底层导出 EU_SetElementFlexGrow。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1588 | `NE_EU_SetElementMinMaxSize` | `NE_EU_SetElementMinMaxSize(hwnd, element_id, min_w, min_h, max_w, max_h)` | void | new_emoji 原生界面库 底层导出 EU_SetElementMinMaxSize。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1589 | `NE_EU_SetElementMargin` | `NE_EU_SetElementMargin(hwnd, element_id, left, top, right, bottom)` | void | new_emoji 原生界面库 底层导出 EU_SetElementMargin。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1590 | `NE_EU_SetElementAlignSelf` | `NE_EU_SetElementAlignSelf(hwnd, element_id, align_self)` | void | new_emoji 原生界面库 底层导出 EU_SetElementAlignSelf。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1591 | `NE_EU_SetBrowserViewportState` | `NE_EU_SetBrowserViewportState(hwnd, element_id, state)` | void | new_emoji 原生界面库 底层导出 EU_SetBrowserViewportState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1592 | `NE_EU_PostSetBrowserViewportState` | `NE_EU_PostSetBrowserViewportState(hwnd, element_id, state)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBrowserViewportState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1593 | `NE_EU_SetBrowserViewportPlaceholder` | `NE_EU_SetBrowserViewportPlaceholder(hwnd, element_id, title_bytes, title_len, desc_bytes, desc_len, icon_bytes, icon_len)` | void | new_emoji 原生界面库 底层导出 EU_SetBrowserViewportPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1594 | `NE_EU_PostSetBrowserViewportPlaceholder` | `NE_EU_PostSetBrowserViewportPlaceholder(hwnd, element_id, title_bytes, title_len, desc_bytes, desc_len, icon_bytes, icon_len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBrowserViewportPlaceholder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1595 | `NE_EU_SetBrowserViewportLoading` | `NE_EU_SetBrowserViewportLoading(hwnd, element_id, loading, progress)` | void | new_emoji 原生界面库 底层导出 EU_SetBrowserViewportLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1596 | `NE_EU_PostSetBrowserViewportLoading` | `NE_EU_PostSetBrowserViewportLoading(hwnd, element_id, loading, progress)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBrowserViewportLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1597 | `NE_EU_SetBrowserViewportScreenshot` | `NE_EU_SetBrowserViewportScreenshot(hwnd, element_id, bytes, len)` | void | new_emoji 原生界面库 底层导出 EU_SetBrowserViewportScreenshot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1598 | `NE_EU_PostSetBrowserViewportScreenshot` | `NE_EU_PostSetBrowserViewportScreenshot(hwnd, element_id, bytes, len)` | int | new_emoji 原生界面库 底层导出 EU_PostSetBrowserViewportScreenshot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 1599 | `NE_EU_GetBrowserViewportState` | `NE_EU_GetBrowserViewportState(hwnd, element_id, state, loading, progress)` | int | new_emoji 原生界面库 底层导出 EU_GetBrowserViewportState。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
