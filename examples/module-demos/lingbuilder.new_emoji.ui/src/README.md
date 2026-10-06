# new_emoji 原生界面库完整演示

- 模块 ID：`lingbuilder.new_emoji.ui`
- 版本：`2.0.0`
- 类型：外置/资产模块
- 命令数：4019
- 设计器控件数：93
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
| 3 | `NE_创建浏览器外壳窗口` | `NE_创建浏览器外壳窗口(标题, X, Y, 宽度, 高度)` | handle | 使用 0x3F 浏览器框架预设创建无系统标题栏窗口。 |
| 4 | `NE_创建自定义框架窗口` | `NE_创建自定义框架窗口(标题, X, Y, 宽度, 高度, 框架标志)` | handle | 使用精确 frame flags 创建 new_emoji 窗口。 |
| 5 | `NE_显示窗口` | `NE_显示窗口(窗口句柄, 是否显示)` | void | 显示或隐藏 new_emoji 窗口。 |
| 6 | `NE_显示并激活窗口` | `NE_显示并激活窗口(窗口句柄)` | void | 恢复、显示并激活 new_emoji 窗口。 |
| 7 | `NE_运行消息循环` | `NE_运行消息循环()` | int | 运行 new_emoji Win32 消息循环。 |
| 8 | `NE_销毁窗口` | `NE_销毁窗口(窗口句柄)` | void | 销毁 new_emoji 窗口。 |
| 9 | `NE_创建容器` | `NE_创建容器(窗口句柄, 父元素ID, X, Y, 宽度, 高度)` | int | 创建 new_emoji 容器。 |
| 10 | `NE_创建文本` | `NE_创建文本(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 文本元素。 |
| 11 | `NE_创建按钮` | `NE_创建按钮(窗口句柄, 父元素ID, 表情, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 按钮。 |
| 12 | `NE_创建编辑框` | `NE_创建编辑框(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)` | int | 创建 new_emoji 编辑框。 |
| 13 | `NE_创建复选框` | `NE_创建复选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)` | int | 创建 new_emoji 复选框。 |
| 14 | `NE_创建单选框` | `NE_创建单选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)` | int | 创建 new_emoji 单选框。 |
| 15 | `NE_创建列表框` | `NE_创建列表框(窗口句柄, 父元素ID, 标题, 项目文本, 默认选中项, X, Y, 宽度, 高度)` | int | 创建 new_emoji 列表框，项目文本使用 \| 分隔。 |
| 16 | `NE_创建图片` | `NE_创建图片(窗口句柄, 父元素ID, 图片源, 替代文本, 填充方式, X, Y, 宽度, 高度)` | int | 创建 new_emoji 图片，填充方式 0-4 依次为 contain、cover、fill、none、scale-down。 |
| 17 | `NE_创建进度条` | `NE_创建进度条(窗口句柄, 父元素ID, 文本, 进度值, X, Y, 宽度, 高度)` | int | 创建 new_emoji 进度条。 |
| 18 | `NE_创建上传` | `NE_创建上传(窗口句柄, 父元素ID, 标题, 提示, 初始文件, X, Y, 宽度, 高度)` | int | 创建 new_emoji 文件上传组件。 |
| 19 | `NE_设置上传选项` | `NE_设置上传选项(窗口句柄, 元素ID, 允许多选, 自动上传, 样式, 显示文件列表, 显示提示, 显示操作, 允许拖拽, 文件数量上限, 单文件上限KB, 允许文件类型)` | void | 设置上传组件的选择、显示、拖拽和文件限制。 |
| 20 | `NE_打开上传文件选择` | `NE_打开上传文件选择(窗口句柄, 元素ID)` | int | 打开上传组件的系统文件选择对话框。 |
| 21 | `NE_开始上传` | `NE_开始上传(窗口句柄, 元素ID, 文件索引)` | int | 触发上传组件指定文件的上传操作。 |
| 22 | `NE_清空上传文件` | `NE_清空上传文件(窗口句柄, 元素ID)` | void | 清空上传组件文件列表。 |
| 23 | `NE_取上传文件数量` | `NE_取上传文件数量(窗口句柄, 元素ID)` | int | 返回上传组件当前文件数量。 |
| 24 | `NE_取最近上传选择文件` | `NE_取最近上传选择文件()` | wideString | 在上传事件中返回最近选择或拖入的文件路径，多个路径以 \| 分隔。 |
| 25 | `NE_取最近上传动作` | `NE_取最近上传动作()` | int | 在上传操作事件中返回动作编号。 |
| 26 | `NE_取最近上传文件索引` | `NE_取最近上传文件索引()` | int | 在上传操作事件中返回文件索引。 |
| 27 | `NE_取最近上传进度值` | `NE_取最近上传进度值()` | int | 在上传操作事件中返回进度或动作附加值。 |
| 28 | `NE_设置表格虚拟行数据` | `NE_设置表格虚拟行数据(行数据)` | void | 在 Table 的 VirtualRow 同步事件中设置本次返回的 UTF-8 高级行协议文本。 |
| 29 | `NE_设置窗口标题` | `NE_设置窗口标题(窗口句柄, 标题)` | void | 设置 new_emoji 窗口标题。 |
| 30 | `NE_设置窗口缩放边框` | `NE_设置窗口缩放边框(窗口句柄, 左, 上, 右, 下)` | void | 设置无边框窗口四边缩放命中尺寸。 |
| 31 | `NE_清空窗口拖拽区` | `NE_清空窗口拖拽区(窗口句柄)` | void | 清空窗口全部自定义拖拽区域。 |
| 32 | `NE_设置窗口拖拽区` | `NE_设置窗口拖拽区(窗口句柄, X, Y, 宽度, 高度, 是否启用)` | void | 添加或移除窗口自定义拖拽区域。 |
| 33 | `NE_清空窗口非拖拽区` | `NE_清空窗口非拖拽区(窗口句柄)` | void | 清空窗口全部交互排除区域。 |
| 34 | `NE_设置窗口非拖拽区` | `NE_设置窗口非拖拽区(窗口句柄, X, Y, 宽度, 高度, 是否启用)` | void | 添加或移除窗口交互排除区域。 |
| 35 | `NE_设置元素窗口命令` | `NE_设置元素窗口命令(窗口句柄, 元素ID, 命令)` | void | 把元素点击映射为最小化、最大化/还原或关闭。 |
| 36 | `NE_设置窗口圆角` | `NE_设置窗口圆角(窗口句柄, 是否启用, 半径)` | void | 设置窗口圆角和逻辑像素半径。 |
| 37 | `NE窗口_创建` | `NE窗口_创建(title_bytes, title_len, x, y, w, h, titlebar_color)` | handle | 底层直调 EU_CreateWindow：创建。一般请用高层命令 NE_创建窗口。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 38 | `NE窗口_创建扩展` | `NE窗口_创建扩展(title_bytes, title_len, x, y, w, h, titlebar_color, frame_flags)` | handle | 底层直调 EU_CreateWindowEx：创建扩展。一般请用高层命令 NE_创建自定义框架窗口。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 39 | `NE窗口_创建深色` | `NE窗口_创建深色(title_bytes, title_len, x, y, w, h, titlebar_color)` | handle | 底层直调 EU_CreateWindowDark：创建深色。一般请用高层命令 NE_创建深色窗口。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 40 | `NE预览_创建子窗口` | `NE预览_创建子窗口(parent_hwnd, title_bytes, title_len, x, y, w, h, titlebar_color, frame_flags, preview_flags)` | handle | 底层直调 EU_CreatePreviewChildWindow：创建子窗口。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 41 | `NE窗口_销毁` | `NE窗口_销毁(hwnd)` | void | 底层直调 EU_DestroyWindow：销毁。一般请用高层命令 NE_销毁窗口。 |
| 42 | `NE窗口_显示` | `NE窗口_显示(hwnd, visible)` | void | 底层直调 EU_ShowWindow：显示。一般请用高层命令 NE_显示窗口。 |
| 43 | `NE窗口_运行消息循环` | `NE窗口_运行消息循环()` | int | 底层直调 EU_RunMessageLoop：运行消息循环。一般请用高层命令 NE_运行消息循环。 |
| 44 | `NE表情选择器_显示` | `NE表情选择器_显示(owner_hwnd, current_bytes, current_len, recent_path_bytes, recent_path_len, out_bytes, out_size)` | int | 底层直调 EU_ShowEmojiPicker：显示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 45 | `NE预览_重置` | `NE预览_重置(hwnd)` | void | 底层直调 EU_PreviewReset：重置。 |
| 46 | `NE预览_命中测试` | `NE预览_命中测试(hwnd, x, y)` | int | 底层直调 EU_PreviewHitTest：命中测试。 |
| 47 | `NE预览_设置选中` | `NE预览_设置选中(hwnd, ids, count, primary_id)` | void | 底层直调 EU_PreviewSetSelection：设置选中。 |
| 48 | `NE预览_设置拖放目标` | `NE预览_设置拖放目标(hwnd, element_id)` | void | 底层直调 EU_PreviewSetDropTarget：设置拖放目标。 |
| 49 | `NE窗口_设置标题` | `NE窗口_设置标题(hwnd, bytes, len)` | void | 底层直调 EU_SetWindowTitle：设置标题。一般请用高层命令 NE_设置窗口标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 50 | `NE窗口_设置图标` | `NE窗口_设置图标(hwnd, path_bytes, path_len)` | int | 底层直调 EU_SetWindowIcon：设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 51 | `NE窗口_设置图标字节` | `NE窗口_设置图标字节(hwnd, icon_bytes, icon_len)` | int | 底层直调 EU_SetWindowIconFromBytes：设置图标字节。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 52 | `NE窗口_设置位置尺寸` | `NE窗口_设置位置尺寸(hwnd, x, y, w, h)` | void | 底层直调 EU_SetWindowBounds：设置位置尺寸。 |
| 53 | `NE窗口_取位置尺寸` | `NE窗口_取位置尺寸(hwnd, x, y, w, h)` | int | 底层直调 EU_GetWindowBounds：取位置尺寸。 |
| 54 | `创建面板` | `创建面板(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePanel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 55 | `创建按钮` | `创建按钮(hwnd, parent_id, emoji_bytes, emoji_len, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateButton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 56 | `创建兼容编辑内核` | `创建兼容编辑内核(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateEditBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 57 | `创建信息框` | `创建信息框(hwnd, parent_id, title_bytes, title_len, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInfoBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 58 | `创建文本` | `创建文本(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateText。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 59 | `创建链接` | `创建链接(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLink。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 60 | `创建图标` | `创建图标(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateIcon。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 61 | `创建工具栏图标按钮` | `创建工具栏图标按钮(hwnd, parent_id, icon_bytes, icon_len, tooltip_bytes, tooltip_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateIconButton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 62 | `创建地址栏` | `创建地址栏(hwnd, parent_id, value_bytes, value_len, placeholder_bytes, placeholder_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateOmnibox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 63 | `创建浏览内容占位区` | `创建浏览内容占位区(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBrowserViewport。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 64 | `创建间距` | `创建间距(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSpace。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 65 | `创建容器套件` | `创建容器套件(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateContainer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 66 | `创建顶栏` | `创建顶栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateHeader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 67 | `创建侧边栏` | `创建侧边栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAside。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 68 | `创建主要区域` | `创建主要区域(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMain。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 69 | `创建底栏` | `创建底栏(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateFooter。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 70 | `创建布局` | `创建布局(hwnd, parent_id, orientation, gap, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLayout。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 71 | `创建边框` | `创建边框(hwnd, parent_id, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBorder。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 72 | `创建复选框` | `创建复选框(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCheckbox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 73 | `NE复选框_创建分组` | `NE复选框_创建分组(hwnd, parent_id, items_bytes, items_len, checked_bytes, checked_len, style_mode, size, group_disabled, min_checked, max_checked, x, y, w, h)` | int | 底层直调 EU_CreateCheckboxGroup：创建分组。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 74 | `创建单选框` | `创建单选框(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRadio。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 75 | `NE单选框_创建分组` | `NE单选框_创建分组(hwnd, parent_id, items_bytes, items_len, value_bytes, value_len, style_mode, size, group_disabled, x, y, w, h)` | int | 底层直调 EU_CreateRadioGroup：创建分组。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 76 | `创建开关` | `创建开关(hwnd, parent_id, text_bytes, text_len, checked, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSwitch。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 77 | `创建滑块` | `创建滑块(hwnd, parent_id, text_bytes, text_len, min_value, max_value, value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSlider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 78 | `创建数字输入框` | `创建数字输入框(hwnd, parent_id, text_bytes, text_len, value, min_value, max_value, step, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputNumber。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 79 | `创建输入框` | `创建输入框(hwnd, parent_id, text_bytes, text_len, placeholder_bytes, placeholder_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len, clearable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInput。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 80 | `创建组合输入` | `创建组合输入(hwnd, parent_id, value_bytes, value_len, placeholder_bytes, placeholder_len, size, clearable, password, show_word_limit, autosize, min_rows, max_rows, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputGroup。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 81 | `创建标签输入` | `创建标签输入(hwnd, parent_id, tags_bytes, tags_len, placeholder_bytes, placeholder_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInputTag。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 82 | `创建选择器` | `创建选择器(hwnd, parent_id, text_bytes, text_len, options_bytes, options_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 83 | `创建虚拟选择器` | `创建虚拟选择器(hwnd, parent_id, text_bytes, text_len, options_bytes, options_len, selected_index, visible_count, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSelectV2。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 84 | `创建评分` | `创建评分(hwnd, parent_id, text_bytes, text_len, value, max_value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRate。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 85 | `创建颜色选择器` | `创建颜色选择器(hwnd, parent_id, text_bytes, text_len, value, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateColorPicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 86 | `创建标签` | `创建标签(hwnd, parent_id, text_bytes, text_len, tag_type, effect, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTag。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 87 | `创建徽标` | `创建徽标(hwnd, parent_id, text_bytes, text_len, value_bytes, value_len, max_value, dot, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBadge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 88 | `创建进度条` | `创建进度条(hwnd, parent_id, text_bytes, text_len, percentage, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 89 | `创建头像` | `创建头像(hwnd, parent_id, text_bytes, text_len, shape, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAvatar。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 90 | `创建空状态` | `创建空状态(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateEmpty。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 91 | `创建骨架屏` | `创建骨架屏(hwnd, parent_id, rows, animated, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSkeleton。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 92 | `创建描述列表` | `创建描述列表(hwnd, parent_id, title_bytes, title_len, items_bytes, items_len, columns, bordered, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDescriptions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 93 | `创建表格` | `创建表格(hwnd, parent_id, columns_bytes, columns_len, rows_bytes, rows_len, striped, bordered, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTable。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 94 | `创建列表框` | `创建列表框(hwnd, parent_id, title_bytes, title_len, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateListBox。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 95 | `创建富列表` | `创建富列表(hwnd, parent_id, title_bytes, title_len, template_bytes, template_len, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRichList。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 96 | `创建卡片` | `创建卡片(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, shadow, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCard。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 97 | `创建折叠面板` | `创建折叠面板(hwnd, parent_id, items_bytes, items_len, active_index, accordion, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCollapse。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 98 | `创建时间线` | `创建时间线(hwnd, parent_id, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimeline。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 99 | `创建统计数值` | `创建统计数值(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateStatistic。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 100 | `创建指标卡` | `创建指标卡(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateKpiCard。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 101 | `创建趋势` | `创建趋势(hwnd, parent_id, title_bytes, title_len, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTrend。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 102 | `创建状态点` | `创建状态点(hwnd, parent_id, label_bytes, label_len, desc_bytes, desc_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateStatusDot。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 103 | `创建仪表盘` | `创建仪表盘(hwnd, parent_id, title_bytes, title_len, value, caption_bytes, caption_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateGauge。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 104 | `创建环形进度` | `创建环形进度(hwnd, parent_id, title_bytes, title_len, value, label_bytes, label_len, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateRingProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 105 | `创建子弹进度` | `创建子弹进度(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, value, target, status, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBulletProgress。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 106 | `创建折线图` | `创建折线图(hwnd, parent_id, title_bytes, title_len, points_bytes, points_len, chart_style, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLineChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 107 | `创建柱状图` | `创建柱状图(hwnd, parent_id, title_bytes, title_len, bars_bytes, bars_len, orientation, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBarChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 108 | `创建环形图` | `创建环形图(hwnd, parent_id, title_bytes, title_len, slices_bytes, slices_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDonutChart。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 109 | `创建分割线` | `创建分割线(hwnd, parent_id, text_bytes, text_len, direction, content_position, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDivider。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 110 | `创建日历` | `创建日历(hwnd, parent_id, year, month, selected_day, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCalendar。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 111 | `创建树` | `创建树(hwnd, parent_id, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTree。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 112 | `创建树选择` | `创建树选择(hwnd, parent_id, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTreeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 113 | `创建穿梭框` | `创建穿梭框(hwnd, parent_id, left_bytes, left_len, right_bytes, right_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTransfer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 114 | `创建自动补全` | `创建自动补全(hwnd, parent_id, value_bytes, value_len, suggestions_bytes, suggestions_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAutocomplete。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 115 | `创建提及` | `创建提及(hwnd, parent_id, value_bytes, value_len, suggestions_bytes, suggestions_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMentions。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 116 | `创建级联选择` | `创建级联选择(hwnd, parent_id, options_bytes, options_len, selected_bytes, selected_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCascader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 117 | `创建日期选择器` | `创建日期选择器(hwnd, parent_id, year, month, selected_day, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDatePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 118 | `创建时间选择器` | `创建时间选择器(hwnd, parent_id, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 119 | `创建日期时间选择器` | `创建日期时间选择器(hwnd, parent_id, year, month, day, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDateTimePicker。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 120 | `创建时间选择` | `创建时间选择(hwnd, parent_id, hour, minute, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTimeSelect。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 121 | `创建下拉菜单` | `创建下拉菜单(hwnd, parent_id, text_bytes, text_len, items_bytes, items_len, selected_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDropdown。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 122 | `创建菜单` | `创建菜单(hwnd, parent_id, items_bytes, items_len, active_index, orientation, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateMenu。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 123 | `创建锚点` | `创建锚点(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAnchor。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 124 | `创建回到顶部` | `创建回到顶部(hwnd, parent_id, text_bytes, text_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBacktop。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 125 | `创建分段控制器` | `创建分段控制器(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSegmented。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 126 | `创建页头` | `创建页头(hwnd, parent_id, title_bytes, title_len, subtitle_bytes, subtitle_len, back_bytes, back_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePageHeader。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 127 | `创建固钉` | `创建固钉(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, offset, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAffix。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 128 | `创建水印` | `创建水印(hwnd, parent_id, content_bytes, content_len, gap_x, gap_y, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateWatermark。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 129 | `创建漫游引导` | `创建漫游引导(hwnd, parent_id, steps_bytes, steps_len, active_index, open, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTour。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 130 | `创建图片` | `创建图片(hwnd, parent_id, src_bytes, src_len, alt_bytes, alt_len, fit, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateImage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 131 | `创建轮播` | `创建轮播(hwnd, parent_id, items_bytes, items_len, active_index, indicator_position, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateCarousel。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 132 | `创建上传` | `创建上传(hwnd, parent_id, title_bytes, title_len, tip_bytes, tip_len, files_bytes, files_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateUpload。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 133 | `创建无限滚动` | `创建无限滚动(hwnd, parent_id, items_bytes, items_len, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateInfiniteScroll。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 134 | `创建面包屑` | `创建面包屑(hwnd, parent_id, items_bytes, items_len, separator_bytes, separator_len, current_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateBreadcrumb。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 135 | `创建标签页` | `创建标签页(hwnd, parent_id, items_bytes, items_len, active_index, tab_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTabs。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 136 | `创建分页` | `创建分页(hwnd, parent_id, total, page_size, current_page, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePagination。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 137 | `创建步骤条` | `创建步骤条(hwnd, parent_id, items_bytes, items_len, active_index, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateSteps。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 138 | `创建警告提示` | `创建警告提示(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, alert_type, effect, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateAlert。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 139 | `NE警告提示_创建扩展` | `NE警告提示_创建扩展(hwnd, parent_id, title_bytes, title_len, desc_bytes, desc_len, alert_type, effect, closable, show_icon, center, wrap_description, close_text_bytes, close_text_len, x, y, w, h)` | int | 底层直调 EU_CreateAlertEx：创建扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 140 | `创建结果页` | `创建结果页(hwnd, parent_id, title_bytes, title_len, subtitle_bytes, subtitle_len, result_type, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateResult。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 141 | `创建通知` | `创建通知(hwnd, parent_id, title_bytes, title_len, body_bytes, body_len, notify_type, closable, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateNotification。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 142 | `创建加载` | `创建加载(hwnd, parent_id, text_bytes, text_len, active, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateLoading。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 143 | `创建对话框` | `创建对话框(hwnd, title_bytes, title_len, body_bytes, body_len, modal, closable, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateDialog。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 144 | `NE弹窗_设置高级选项` | `NE弹窗_设置高级选项(hwnd, element_id, width_mode, width_value, center, footer_center, content_padding, footer_height)` | void | 底层直调 EU_SetDialogAdvancedOptions：设置高级选项。 |
| 145 | `NE弹窗_取高级选项` | `NE弹窗_取高级选项(hwnd, element_id, width_mode, width_value, center, footer_center, content_padding, footer_height, content_parent_id, footer_parent_id, close_pending)` | int | 底层直调 EU_GetDialogAdvancedOptions：取高级选项。 |
| 146 | `NE弹窗_取内容父元素` | `NE弹窗_取内容父元素(hwnd, element_id)` | int | 底层直调 EU_GetDialogContentParent：取内容父元素。 |
| 147 | `NE弹窗_取页脚父元素` | `NE弹窗_取页脚父元素(hwnd, element_id)` | int | 底层直调 EU_GetDialogFooterParent：取页脚父元素。 |
| 148 | `NE弹窗_设置关闭前回调` | `NE弹窗_设置关闭前回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDialogBeforeCloseCallback：设置关闭前回调。处理器实参必须写 &处理器名。 |
| 149 | `NE弹窗_确认关闭` | `NE弹窗_确认关闭(hwnd, element_id, allow)` | void | 底层直调 EU_ConfirmDialogClose：确认关闭。 |
| 150 | `创建抽屉` | `创建抽屉(hwnd, title_bytes, title_len, body_bytes, body_len, placement, modal, closable, size)` | int | new_emoji 原生界面库 底层导出 EU_CreateDrawer。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 151 | `创建文字提示` | `创建文字提示(hwnd, parent_id, label_bytes, label_len, content_bytes, content_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreateTooltip。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 152 | `NE文字提示_设置高级选项` | `NE文字提示_设置高级选项(hwnd, element_id, placement, effect, disabled, show_arrow, offset, max_width)` | void | 底层直调 EU_SetTooltipAdvancedOptions：设置高级选项。 |
| 153 | `NE文字提示_取高级选项` | `NE文字提示_取高级选项(hwnd, element_id, placement, effect, disabled, show_arrow, offset, max_width)` | int | 底层直调 EU_GetTooltipAdvancedOptions：取高级选项。 |
| 154 | `创建弹出框` | `创建弹出框(hwnd, parent_id, label_bytes, label_len, title_bytes, title_len, content_bytes, content_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePopover。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 155 | `NE气泡卡片_设置高级选项` | `NE气泡卡片_设置高级选项(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | void | 底层直调 EU_SetPopoverAdvancedOptions：设置高级选项。 |
| 156 | `NE气泡卡片_设置行为` | `NE气泡卡片_设置行为(hwnd, element_id, trigger_mode, close_on_outside, show_arrow, offset)` | void | 底层直调 EU_SetPopoverBehavior：设置行为。 |
| 157 | `NE气泡卡片_取行为` | `NE气泡卡片_取行为(hwnd, element_id, trigger_mode, close_on_outside, show_arrow, offset)` | int | 底层直调 EU_GetPopoverBehavior：取行为。 |
| 158 | `NE气泡卡片_取内容父元素` | `NE气泡卡片_取内容父元素(hwnd, element_id)` | int | 底层直调 EU_GetPopoverContentParent：取内容父元素。 |
| 159 | `创建气泡确认框` | `创建气泡确认框(hwnd, parent_id, label_bytes, label_len, title_bytes, title_len, content_bytes, content_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, placement, x, y, w, h)` | int | new_emoji 原生界面库 底层导出 EU_CreatePopconfirm。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 160 | `NE气泡确认_设置高级选项` | `NE气泡确认_设置高级选项(hwnd, element_id, placement, open, popup_width, popup_height, trigger_mode, close_on_outside, show_arrow, offset)` | void | 底层直调 EU_SetPopconfirmAdvancedOptions：设置高级选项。 |
| 161 | `NE气泡确认_设置图标直调` | `NE气泡确认_设置图标直调(hwnd, element_id, icon_bytes, icon_len, icon_color, visible)` | void | NE气泡确认_设置图标 的底层直调版本：设置图标。一般请用高层封装 NE气泡确认_设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 162 | `NE气泡确认_取图标` | `NE气泡确认_取图标(hwnd, element_id, buffer, buffer_size, icon_color, visible)` | int | 底层直调 EU_GetPopconfirmIcon：取图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 163 | `显示消息提示` | `显示消息提示(hwnd, text_bytes, text_len, message_type, closable, center, rich, duration_ms, offset)` | int | new_emoji 原生界面库 底层导出 EU_ShowMessage。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 164 | `NE消息提示_投递显示` | `NE消息提示_投递显示(hwnd, text_bytes, text_len, message_type, closable, center, rich, duration_ms, offset)` | int | 底层直调 EU_PostShowMessage：投递显示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 165 | `NE通知_显示` | `NE通知_显示(hwnd, title_bytes, title_len, body_bytes, body_len, notify_type, closable, duration_ms, placement, offset, rich, w, h)` | int | 底层直调 EU_ShowNotification：显示。一般请用高层命令 NE_显示通知。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 166 | `NE消息框_显示` | `NE消息框_显示(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cb)` | int | 底层直调 EU_ShowMessageBox：显示。一般请用高层命令 NE_显示消息框。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 167 | `NE确认框_显示` | `NE确认框_显示(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, cb)` | int | 底层直调 EU_ShowConfirmBox：显示。一般请用高层命令 NE_显示确认框。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 168 | `NE消息框_投递显示` | `NE消息框_投递显示(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cb)` | int | 底层直调 EU_PostShowMessageBox：投递显示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 169 | `NE确认框_投递显示` | `NE确认框_投递显示(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, cb)` | int | 底层直调 EU_PostShowConfirmBox：投递显示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 170 | `显示消息框` | `显示消息框(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, show_cancel, center, rich, distinguish_cancel_and_close, cb)` | int | new_emoji 原生界面库 底层导出 EU_ShowMessageBoxEx。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。 |
| 171 | `NE消息框_投递显示扩展` | `NE消息框_投递显示扩展(hwnd, title_bytes, title_len, text_bytes, text_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, show_cancel, center, rich, distinguish_cancel_and_close, cb)` | int | 底层直调 EU_PostShowMessageBoxEx：投递显示扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 172 | `NE提问框_显示` | `NE提问框_显示(hwnd, title_bytes, title_len, text_bytes, text_len, placeholder_bytes, placeholder_len, value_bytes, value_len, pattern_bytes, pattern_len, error_bytes, error_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, center, rich, distinguish_cancel_and_close, cb)` | int | 底层直调 EU_ShowPromptBox：显示。一般请用高层命令 NE_显示提问框。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 173 | `NE提问框_投递显示` | `NE提问框_投递显示(hwnd, title_bytes, title_len, text_bytes, text_len, placeholder_bytes, placeholder_len, value_bytes, value_len, pattern_bytes, pattern_len, error_bytes, error_len, confirm_bytes, confirm_len, cancel_bytes, cancel_len, box_type, center, rich, distinguish_cancel_and_close, cb)` | int | 底层直调 EU_PostShowPromptBox：投递显示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 174 | `NE元素_设置文本` | `NE元素_设置文本(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetElementText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 175 | `NE元素_投递设置文本` | `NE元素_投递设置文本(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetElementText：投递设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 176 | `NE元素_取文本` | `NE元素_取文本(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetElementText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 177 | `NE元素_设置位置尺寸` | `NE元素_设置位置尺寸(hwnd, element_id, x, y, w, h)` | void | 底层直调 EU_SetElementBounds：设置位置尺寸。 |
| 178 | `NE元素_取位置尺寸` | `NE元素_取位置尺寸(hwnd, element_id, x, y, w, h)` | int | 底层直调 EU_GetElementBounds：取位置尺寸。 |
| 179 | `NE元素_设置可见` | `NE元素_设置可见(hwnd, element_id, visible)` | void | 底层直调 EU_SetElementVisible：设置可见。 |
| 180 | `NE元素_取可见` | `NE元素_取可见(hwnd, element_id)` | int | 底层直调 EU_GetElementVisible：取可见。 |
| 181 | `NE元素_设置启用` | `NE元素_设置启用(hwnd, element_id, enabled)` | void | 底层直调 EU_SetElementEnabled：设置启用。 |
| 182 | `NE元素_取启用` | `NE元素_取启用(hwnd, element_id)` | int | 底层直调 EU_GetElementEnabled：取启用。 |
| 183 | `NE元素_设置颜色` | `NE元素_设置颜色(hwnd, element_id, bg, fg)` | void | 底层直调 EU_SetElementColor：设置颜色。颜色使用 0xAARRGGBB。 |
| 184 | `NE元素_设置光标` | `NE元素_设置光标(hwnd, element_id, cursor)` | void | 底层直调 EU_SetElementCursor：设置光标。 |
| 185 | `NE元素_设置字体` | `NE元素_设置字体(hwnd, element_id, font_bytes, font_len, size)` | void | 底层直调 EU_SetElementFont：设置字体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 186 | `NE元素_设置字体与字号` | `NE元素_设置字体与字号(hwnd, element_id, font_bytes, font_len, size)` | void | 底层直调 EU_SetElementFontInt：设置字体与字号。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 187 | `NE文本_设置选项` | `NE文本_设置选项(hwnd, element_id, align, valign, wrap, ellipsis)` | void | 底层直调 EU_SetTextOptions：设置选项。 |
| 188 | `NE文本_取选项` | `NE文本_取选项(hwnd, element_id, align, valign, wrap, ellipsis)` | int | 底层直调 EU_GetTextOptions：取选项。 |
| 189 | `NE链接_设置选项` | `NE链接_设置选项(hwnd, element_id, type, underline, auto_open, visited)` | void | 底层直调 EU_SetLinkOptions：设置选项。 |
| 190 | `NE链接_取选项` | `NE链接_取选项(hwnd, element_id, type, underline, auto_open, visited)` | int | 底层直调 EU_GetLinkOptions：取选项。 |
| 191 | `NE链接_设置内容` | `NE链接_设置内容(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len, href_bytes, href_len, target_bytes, target_len)` | void | 底层直调 EU_SetLinkContent：设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 192 | `NE链接_取内容` | `NE链接_取内容(hwnd, element_id, prefix_buffer, prefix_buffer_size, suffix_buffer, suffix_buffer_size, href_buffer, href_buffer_size, target_buffer, target_buffer_size)` | int | 底层直调 EU_GetLinkContent：取内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 193 | `NE链接_设置已访问` | `NE链接_设置已访问(hwnd, element_id, visited)` | void | 底层直调 EU_SetLinkVisited：设置已访问。 |
| 194 | `NE链接_取已访问` | `NE链接_取已访问(hwnd, element_id)` | int | 底层直调 EU_GetLinkVisited：取已访问。 |
| 195 | `NE图标_设置选项` | `NE图标_设置选项(hwnd, element_id, scale, rotation_degrees)` | void | 底层直调 EU_SetIconOptions：设置选项。 |
| 196 | `NE图标_取选项` | `NE图标_取选项(hwnd, element_id, scale, rotation_degrees)` | int | 底层直调 EU_GetIconOptions：取选项。 |
| 197 | `NE面板_设置样式` | `NE面板_设置样式(hwnd, element_id, bg, border, border_width, radius, padding)` | void | 底层直调 EU_SetPanelStyle：设置样式。 |
| 198 | `NE面板_取样式` | `NE面板_取样式(hwnd, element_id, bg, border, border_width, radius, padding)` | int | 底层直调 EU_GetPanelStyle：取样式。 |
| 199 | `NE面板_设置布局` | `NE面板_设置布局(hwnd, element_id, fill_parent, content_layout)` | void | 底层直调 EU_SetPanelLayout：设置布局。 |
| 200 | `NE面板_取布局` | `NE面板_取布局(hwnd, element_id, fill_parent, content_layout)` | int | 底层直调 EU_GetPanelLayout：取布局。 |
| 201 | `NE容器_设置布局` | `NE容器_设置布局(hwnd, element_id, enabled, direction, gap)` | void | 底层直调 EU_SetContainerLayout：设置布局。 |
| 202 | `NE容器_取布局` | `NE容器_取布局(hwnd, element_id, enabled, direction, gap, actual_direction)` | int | 底层直调 EU_GetContainerLayout：取布局。 |
| 203 | `NE容器_设置区域文本选项` | `NE容器_设置区域文本选项(hwnd, element_id, align, valign)` | void | 底层直调 EU_SetContainerRegionTextOptions：设置区域文本选项。 |
| 204 | `NE容器_取区域文本选项` | `NE容器_取区域文本选项(hwnd, element_id, align, valign, role)` | int | 底层直调 EU_GetContainerRegionTextOptions：取区域文本选项。 |
| 205 | `NE布局_设置选项` | `NE布局_设置选项(hwnd, element_id, orientation, gap, stretch, align, wrap)` | void | 底层直调 EU_SetLayoutOptions：设置选项。 |
| 206 | `NE布局_取选项` | `NE布局_取选项(hwnd, element_id, orientation, gap, stretch, align, wrap)` | int | 底层直调 EU_GetLayoutOptions：取选项。 |
| 207 | `NE布局_设置子元素权重` | `NE布局_设置子元素权重(hwnd, layout_id, child_id, weight)` | void | 底层直调 EU_SetLayoutChildWeight：设置子元素权重。 |
| 208 | `NE布局_取子元素权重` | `NE布局_取子元素权重(hwnd, layout_id, child_id)` | int | 底层直调 EU_GetLayoutChildWeight：取子元素权重。 |
| 209 | `NE边框_设置选项` | `NE边框_设置选项(hwnd, element_id, sides, color, width, radius, title_bytes, title_len)` | void | 底层直调 EU_SetBorderOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 210 | `NE边框_取选项` | `NE边框_取选项(hwnd, element_id, sides, color, width, radius)` | int | 底层直调 EU_GetBorderOptions：取选项。 |
| 211 | `NE边框_设置虚线` | `NE边框_设置虚线(hwnd, element_id, dashed)` | void | 底层直调 EU_SetBorderDashed：设置虚线。 |
| 212 | `NE边框_取虚线` | `NE边框_取虚线(hwnd, element_id)` | int | 底层直调 EU_GetBorderDashed：取虚线。 |
| 213 | `NE信息框_设置文本` | `NE信息框_设置文本(hwnd, element_id, title_bytes, title_len, body_bytes, body_len)` | void | 底层直调 EU_SetInfoBoxText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 214 | `NE信息框_设置选项` | `NE信息框_设置选项(hwnd, element_id, type, closable, accent, icon_bytes, icon_len)` | void | 底层直调 EU_SetInfoBoxOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 215 | `NE信息框_设置关闭` | `NE信息框_设置关闭(hwnd, element_id, closed)` | void | 底层直调 EU_SetInfoBoxClosed：设置关闭。 |
| 216 | `NE信息框_取关闭` | `NE信息框_取关闭(hwnd, element_id)` | int | 底层直调 EU_GetInfoBoxClosed：取关闭。 |
| 217 | `NE信息框_取首选高度` | `NE信息框_取首选高度(hwnd, element_id)` | int | 底层直调 EU_GetInfoBoxPreferredHeight：取首选高度。 |
| 218 | `NE间距_设置尺寸` | `NE间距_设置尺寸(hwnd, element_id, w, h)` | void | 底层直调 EU_SetSpaceSize：设置尺寸。 |
| 219 | `NE间距_取尺寸` | `NE间距_取尺寸(hwnd, element_id, w, h)` | int | 底层直调 EU_GetSpaceSize：取尺寸。 |
| 220 | `NE分割线_设置选项` | `NE分割线_设置选项(hwnd, element_id, direction, content_position, color, width, dashed, text_bytes, text_len)` | void | 底层直调 EU_SetDividerOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 221 | `NE分割线_取选项` | `NE分割线_取选项(hwnd, element_id, direction, content_position, color, width, dashed)` | int | 底层直调 EU_GetDividerOptions：取选项。 |
| 222 | `NE分割线_设置间距` | `NE分割线_设置间距(hwnd, element_id, margin, gap)` | void | 底层直调 EU_SetDividerSpacing：设置间距。 |
| 223 | `NE分割线_取间距` | `NE分割线_取间距(hwnd, element_id, margin, gap)` | int | 底层直调 EU_GetDividerSpacing：取间距。 |
| 224 | `NE分割线_设置线条样式` | `NE分割线_设置线条样式(hwnd, element_id, line_style)` | void | 底层直调 EU_SetDividerLineStyle：设置线条样式。 |
| 225 | `NE分割线_取线条样式` | `NE分割线_取线条样式(hwnd, element_id, line_style)` | int | 底层直调 EU_GetDividerLineStyle：取线条样式。 |
| 226 | `NE分割线_设置内容` | `NE分割线_设置内容(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len)` | void | 底层直调 EU_SetDividerContent：设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 227 | `NE分割线_取内容` | `NE分割线_取内容(hwnd, element_id, icon_buffer, icon_buffer_size, text_buffer, text_buffer_size)` | int | 底层直调 EU_GetDividerContent：取内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 228 | `NE按钮_设置表情` | `NE按钮_设置表情(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetButtonEmoji：设置表情。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 229 | `NE按钮_设置外观变体` | `NE按钮_设置外观变体(hwnd, element_id, variant)` | void | 底层直调 EU_SetButtonVariant：设置外观变体。 |
| 230 | `NE按钮_取状态` | `NE按钮_取状态(hwnd, element_id, pressed, focused, variant)` | int | 底层直调 EU_GetButtonState：取状态。 |
| 231 | `NE按钮_设置选项` | `NE按钮_设置选项(hwnd, element_id, variant, plain, round, circle, loading, size)` | void | 底层直调 EU_SetButtonOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 232 | `NE按钮_设置状态配色` | `NE按钮_设置状态配色(hwnd, element_id, hover_bg, hover_border, hover_fg, pressed_bg, pressed_border, pressed_fg)` | void | 底层直调 EU_SetButtonStateColors：设置状态配色。 |
| 233 | `NE按钮_取状态配色` | `NE按钮_取状态配色(hwnd, element_id, hover_bg, hover_border, hover_fg, pressed_bg, pressed_border, pressed_fg)` | int | 底层直调 EU_GetButtonStateColors：取状态配色。 |
| 234 | `NE按钮_取选项` | `NE按钮_取选项(hwnd, element_id, variant, plain, round, circle, loading, size)` | int | 底层直调 EU_GetButtonOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 235 | `NE编辑框_设置文本` | `NE编辑框_设置文本(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetEditBoxText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 236 | `NE编辑框_投递设置文本` | `NE编辑框_投递设置文本(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetEditBoxText：投递设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 237 | `NE编辑框_设置选项` | `NE编辑框_设置选项(hwnd, element_id, readonly, password, multiline, focus_border, placeholder_bytes, placeholder_len)` | void | 底层直调 EU_SetEditBoxOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 238 | `NE编辑框_取选项` | `NE编辑框_取选项(hwnd, element_id, readonly, password, multiline, focus_border)` | int | 底层直调 EU_GetEditBoxOptions：取选项。 |
| 239 | `NE编辑框_取状态` | `NE编辑框_取状态(hwnd, element_id, cursor, sel_start, sel_end, text_length)` | int | 底层直调 EU_GetEditBoxState：取状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 240 | `NE编辑框_取文本` | `NE编辑框_取文本(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetEditBoxText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 241 | `NE编辑框_设置滚动` | `NE编辑框_设置滚动(hwnd, element_id, scroll_y)` | void | 底层直调 EU_SetEditBoxScroll：设置滚动。 |
| 242 | `NE编辑框_取滚动` | `NE编辑框_取滚动(hwnd, element_id, scroll_y, max_scroll_y, content_height, viewport_height)` | int | 底层直调 EU_GetEditBoxScroll：取滚动。 |
| 243 | `NE编辑框_设置文本回调` | `NE编辑框_设置文本回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetEditBoxTextCallback：设置文本回调。处理器实参必须写 &处理器名。 |
| 244 | `NE元素_设置焦点` | `NE元素_设置焦点(hwnd, element_id)` | void | 底层直调 EU_SetElementFocus：设置焦点。 |
| 245 | `NE复选框_设置勾选` | `NE复选框_设置勾选(hwnd, element_id, checked)` | void | 底层直调 EU_SetCheckboxChecked：设置勾选。 |
| 246 | `NE复选框_投递设置勾选` | `NE复选框_投递设置勾选(hwnd, element_id, checked)` | int | 底层直调 EU_PostSetCheckboxChecked：投递设置勾选。 |
| 247 | `NE复选框_取勾选` | `NE复选框_取勾选(hwnd, element_id)` | int | 底层直调 EU_GetCheckboxChecked：取勾选。 |
| 248 | `NE复选框_设置半选` | `NE复选框_设置半选(hwnd, element_id, indeterminate)` | void | 底层直调 EU_SetCheckboxIndeterminate：设置半选。 |
| 249 | `NE复选框_投递设置半选` | `NE复选框_投递设置半选(hwnd, element_id, indeterminate)` | int | 底层直调 EU_PostSetCheckboxIndeterminate：投递设置半选。 |
| 250 | `NE复选框_取半选` | `NE复选框_取半选(hwnd, element_id)` | int | 底层直调 EU_GetCheckboxIndeterminate：取半选。 |
| 251 | `NE复选框_设置选项` | `NE复选框_设置选项(hwnd, element_id, border, size)` | void | 底层直调 EU_SetCheckboxOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 252 | `NE复选框_取选项` | `NE复选框_取选项(hwnd, element_id, border, size)` | int | 底层直调 EU_GetCheckboxOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 253 | `NE复选框_设置组项` | `NE复选框_设置组项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetCheckboxGroupItems：设置组项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 254 | `NE复选框_投递设置组项` | `NE复选框_投递设置组项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetCheckboxGroupItems：投递设置组项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 255 | `NE复选框_设置组值` | `NE复选框_设置组值(hwnd, element_id, values_bytes, values_len)` | void | 底层直调 EU_SetCheckboxGroupValue：设置组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 256 | `NE复选框_投递设置组值` | `NE复选框_投递设置组值(hwnd, element_id, values_bytes, values_len)` | int | 底层直调 EU_PostSetCheckboxGroupValue：投递设置组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 257 | `NE复选框_取组值` | `NE复选框_取组值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetCheckboxGroupValue：取组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 258 | `NE复选框_设置组选项` | `NE复选框_设置组选项(hwnd, element_id, group_disabled, style_mode, size, min_checked, max_checked)` | void | 底层直调 EU_SetCheckboxGroupOptions：设置组选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 259 | `NE复选框_取组选项` | `NE复选框_取组选项(hwnd, element_id, group_disabled, style_mode, size, min_checked, max_checked)` | int | 底层直调 EU_GetCheckboxGroupOptions：取组选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 260 | `NE复选框_取组状态` | `NE复选框_取组状态(hwnd, element_id, checked_count, item_count, disabled_count, group_disabled, style_mode, size, min_checked, max_checked, hover_index, press_index, focus_index, last_action)` | int | 底层直调 EU_GetCheckboxGroupState：取组状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 261 | `NE复选框_设置组变化回调` | `NE复选框_设置组变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetCheckboxGroupChangeCallback：设置组变化回调。处理器实参必须写 &处理器名。 |
| 262 | `NE单选框_设置勾选` | `NE单选框_设置勾选(hwnd, element_id, checked)` | void | 底层直调 EU_SetRadioChecked：设置勾选。 |
| 263 | `NE单选框_投递设置勾选` | `NE单选框_投递设置勾选(hwnd, element_id, checked)` | int | 底层直调 EU_PostSetRadioChecked：投递设置勾选。 |
| 264 | `NE单选框_取勾选` | `NE单选框_取勾选(hwnd, element_id)` | int | 底层直调 EU_GetRadioChecked：取勾选。 |
| 265 | `NE单选框_设置分组` | `NE单选框_设置分组(hwnd, element_id, group_bytes, group_len)` | void | 底层直调 EU_SetRadioGroup：设置分组。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 266 | `NE单选框_取分组` | `NE单选框_取分组(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetRadioGroup：取分组。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 267 | `NE单选框_设置值` | `NE单选框_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetRadioValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 268 | `NE单选框_投递设置值` | `NE单选框_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetRadioValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 269 | `NE单选框_取值` | `NE单选框_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetRadioValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 270 | `NE单选框_设置选项` | `NE单选框_设置选项(hwnd, element_id, border, size)` | void | 底层直调 EU_SetRadioOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 271 | `NE单选框_取选项` | `NE单选框_取选项(hwnd, element_id, border, size)` | int | 底层直调 EU_GetRadioOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 272 | `NE单选框_设置组项` | `NE单选框_设置组项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetRadioGroupItems：设置组项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 273 | `NE单选框_投递设置组项` | `NE单选框_投递设置组项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetRadioGroupItems：投递设置组项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 274 | `NE单选框_设置组值` | `NE单选框_设置组值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetRadioGroupValue：设置组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 275 | `NE单选框_投递设置组值` | `NE单选框_投递设置组值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetRadioGroupValue：投递设置组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 276 | `NE单选框_取组值` | `NE单选框_取组值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetRadioGroupValue：取组值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 277 | `NE单选框_取组选中索引` | `NE单选框_取组选中索引(hwnd, element_id)` | int | 底层直调 EU_GetRadioGroupSelectedIndex：取组选中索引。 |
| 278 | `NE单选框_设置组选项` | `NE单选框_设置组选项(hwnd, element_id, group_disabled, style_mode, size)` | void | 底层直调 EU_SetRadioGroupOptions：设置组选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 279 | `NE单选框_取组选项` | `NE单选框_取组选项(hwnd, element_id, group_disabled, style_mode, size)` | int | 底层直调 EU_GetRadioGroupOptions：取组选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 280 | `NE单选框_取组状态` | `NE单选框_取组状态(hwnd, element_id, selected_index, item_count, disabled_count, group_disabled, style_mode, size, hover_index, press_index, last_action)` | int | 底层直调 EU_GetRadioGroupState：取组状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 281 | `NE单选框_设置组变化回调` | `NE单选框_设置组变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetRadioGroupChangeCallback：设置组变化回调。处理器实参必须写 &处理器名。 |
| 282 | `NE开关_设置勾选` | `NE开关_设置勾选(hwnd, element_id, checked)` | void | 底层直调 EU_SetSwitchChecked：设置勾选。 |
| 283 | `NE开关_投递设置勾选` | `NE开关_投递设置勾选(hwnd, element_id, checked)` | int | 底层直调 EU_PostSetSwitchChecked：投递设置勾选。 |
| 284 | `NE开关_取勾选` | `NE开关_取勾选(hwnd, element_id)` | int | 底层直调 EU_GetSwitchChecked：取勾选。 |
| 285 | `NE开关_设置加载中` | `NE开关_设置加载中(hwnd, element_id, loading)` | void | 底层直调 EU_SetSwitchLoading：设置加载中。 |
| 286 | `NE开关_投递设置加载中` | `NE开关_投递设置加载中(hwnd, element_id, loading)` | int | 底层直调 EU_PostSetSwitchLoading：投递设置加载中。 |
| 287 | `NE开关_取加载中` | `NE开关_取加载中(hwnd, element_id)` | int | 底层直调 EU_GetSwitchLoading：取加载中。 |
| 288 | `NE开关_设置文本` | `NE开关_设置文本(hwnd, element_id, active_bytes, active_len, inactive_bytes, inactive_len)` | void | 底层直调 EU_SetSwitchTexts：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 289 | `NE开关_取选项` | `NE开关_取选项(hwnd, element_id, checked, loading, has_active_text, has_inactive_text)` | int | 底层直调 EU_GetSwitchOptions：取选项。 |
| 290 | `NE开关_设置活动颜色` | `NE开关_设置活动颜色(hwnd, element_id, color)` | void | 底层直调 EU_SetSwitchActiveColor：设置活动颜色。颜色使用 0xAARRGGBB。 |
| 291 | `NE开关_取活动颜色` | `NE开关_取活动颜色(hwnd, element_id)` | int | 底层直调 EU_GetSwitchActiveColor：取活动颜色。颜色使用 0xAARRGGBB。 |
| 292 | `NE开关_设置非活动颜色` | `NE开关_设置非活动颜色(hwnd, element_id, color)` | void | 底层直调 EU_SetSwitchInactiveColor：设置非活动颜色。颜色使用 0xAARRGGBB。 |
| 293 | `NE开关_取非活动颜色` | `NE开关_取非活动颜色(hwnd, element_id)` | int | 底层直调 EU_GetSwitchInactiveColor：取非活动颜色。颜色使用 0xAARRGGBB。 |
| 294 | `NE开关_设置值` | `NE开关_设置值(hwnd, element_id, value)` | void | 底层直调 EU_SetSwitchValue：设置值。 |
| 295 | `NE开关_投递设置值` | `NE开关_投递设置值(hwnd, element_id, value)` | int | 底层直调 EU_PostSetSwitchValue：投递设置值。 |
| 296 | `NE开关_取值` | `NE开关_取值(hwnd, element_id)` | int | 底层直调 EU_GetSwitchValue：取值。 |
| 297 | `NE开关_设置尺寸` | `NE开关_设置尺寸(hwnd, element_id, size)` | void | 底层直调 EU_SetSwitchSize：设置尺寸。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 298 | `NE开关_取尺寸` | `NE开关_取尺寸(hwnd, element_id)` | int | 底层直调 EU_GetSwitchSize：取尺寸。 |
| 299 | `NE滑块_设置范围` | `NE滑块_设置范围(hwnd, element_id, min_value, max_value)` | void | 底层直调 EU_SetSliderRange：设置范围。 |
| 300 | `NE滑块_设置值` | `NE滑块_设置值(hwnd, element_id, value)` | void | 底层直调 EU_SetSliderValue：设置值。 |
| 301 | `NE滑块_投递设置值` | `NE滑块_投递设置值(hwnd, element_id, value)` | int | 底层直调 EU_PostSetSliderValue：投递设置值。 |
| 302 | `NE滑块_取值` | `NE滑块_取值(hwnd, element_id)` | int | 底层直调 EU_GetSliderValue：取值。 |
| 303 | `NE滑块_设置选项` | `NE滑块_设置选项(hwnd, element_id, step, show_tooltip)` | void | 底层直调 EU_SetSliderOptions：设置选项。 |
| 304 | `NE滑块_取步长` | `NE滑块_取步长(hwnd, element_id)` | int | 底层直调 EU_GetSliderStep：取步长。 |
| 305 | `NE滑块_取选项` | `NE滑块_取选项(hwnd, element_id, min_value, max_value, step, show_tooltip)` | int | 底层直调 EU_GetSliderOptions：取选项。 |
| 306 | `NE滑块_设置范围值` | `NE滑块_设置范围值(hwnd, element_id, start_value, end_value)` | void | 底层直调 EU_SetSliderRangeValue：设置范围值。 |
| 307 | `NE滑块_投递设置范围值` | `NE滑块_投递设置范围值(hwnd, element_id, start_value, end_value)` | int | 底层直调 EU_PostSetSliderRangeValue：投递设置范围值。 |
| 308 | `NE滑块_取范围值` | `NE滑块_取范围值(hwnd, element_id, start_value, end_value)` | int | 底层直调 EU_GetSliderRangeValue：取范围值。 |
| 309 | `NE滑块_设置范围模式` | `NE滑块_设置范围模式(hwnd, element_id, enabled, start_value, end_value)` | void | 底层直调 EU_SetSliderRangeMode：设置范围模式。 |
| 310 | `NE滑块_投递设置范围模式` | `NE滑块_投递设置范围模式(hwnd, element_id, enabled, start_value, end_value)` | int | 底层直调 EU_PostSetSliderRangeMode：投递设置范围模式。 |
| 311 | `NE滑块_取范围模式` | `NE滑块_取范围模式(hwnd, element_id, enabled, start_value, end_value)` | int | 底层直调 EU_GetSliderRangeMode：取范围模式。 |
| 312 | `NE滑块_设置值回调` | `NE滑块_设置值回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetSliderValueCallback：设置值回调。处理器实参必须写 &处理器名。 |
| 313 | `NE数字输入框_设置范围` | `NE数字输入框_设置范围(hwnd, element_id, min_value, max_value)` | void | 底层直调 EU_SetInputNumberRange：设置范围。 |
| 314 | `NE数字输入框_设置步长` | `NE数字输入框_设置步长(hwnd, element_id, step)` | void | 底层直调 EU_SetInputNumberStep：设置步长。 |
| 315 | `NE数字输入框_设置值` | `NE数字输入框_设置值(hwnd, element_id, value)` | void | 底层直调 EU_SetInputNumberValue：设置值。 |
| 316 | `NE数字输入框_投递设置值` | `NE数字输入框_投递设置值(hwnd, element_id, value)` | int | 底层直调 EU_PostSetInputNumberValue：投递设置值。 |
| 317 | `NE数字输入框_取值` | `NE数字输入框_取值(hwnd, element_id)` | int | 底层直调 EU_GetInputNumberValue：取值。 |
| 318 | `NE数字输入框_取可步进` | `NE数字输入框_取可步进(hwnd, element_id, delta)` | int | 底层直调 EU_GetInputNumberCanStep：取可步进。 |
| 319 | `NE数字输入框_取选项` | `NE数字输入框_取选项(hwnd, element_id, min_value, max_value, step)` | int | 底层直调 EU_GetInputNumberOptions：取选项。 |
| 320 | `NE数字输入框_设置精度` | `NE数字输入框_设置精度(hwnd, element_id, precision)` | void | 底层直调 EU_SetInputNumberPrecision：设置精度。 |
| 321 | `NE数字输入框_取精度` | `NE数字输入框_取精度(hwnd, element_id)` | int | 底层直调 EU_GetInputNumberPrecision：取精度。 |
| 322 | `NE数字输入框_设置文本` | `NE数字输入框_设置文本(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_SetInputNumberText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 323 | `NE数字输入框_投递设置文本` | `NE数字输入框_投递设置文本(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetInputNumberText：投递设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 324 | `NE数字输入框_取文本` | `NE数字输入框_取文本(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetInputNumberText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 325 | `NE数字输入框_取状态` | `NE数字输入框_取状态(hwnd, element_id, precision, editing, valid, can_decrease, can_increase)` | int | 底层直调 EU_GetInputNumberState：取状态。 |
| 326 | `NE数字输入框_设置值回调` | `NE数字输入框_设置值回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetInputNumberValueCallback：设置值回调。处理器实参必须写 &处理器名。 |
| 327 | `NE数字输入框_设置严格步进` | `NE数字输入框_设置严格步进(hwnd, element_id, strict)` | void | 底层直调 EU_SetInputNumberStepStrictly：设置严格步进。 |
| 328 | `NE数字输入框_取严格步进` | `NE数字输入框_取严格步进(hwnd, element_id)` | int | 底层直调 EU_GetInputNumberStepStrictly：取严格步进。 |
| 329 | `NE输入框_设置值` | `NE输入框_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetInputValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 330 | `NE输入框_投递设置值` | `NE输入框_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetInputValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 331 | `NE输入框_取值` | `NE输入框_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetInputValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 332 | `NE输入框_同步取值` | `NE输入框_同步取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_InvokeGetInputValue：同步取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 333 | `NE输入框_设置占位提示` | `NE输入框_设置占位提示(hwnd, element_id, placeholder_bytes, placeholder_len)` | void | 底层直调 EU_SetInputPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 334 | `NE输入框_投递设置占位提示` | `NE输入框_投递设置占位提示(hwnd, element_id, placeholder_bytes, placeholder_len)` | int | 底层直调 EU_PostSetInputPlaceholder：投递设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 335 | `NE输入框_设置前后缀` | `NE输入框_设置前后缀(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | void | 底层直调 EU_SetInputAffixes：设置前后缀。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 336 | `NE输入框_投递设置前后缀` | `NE输入框_投递设置前后缀(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | int | 底层直调 EU_PostSetInputAffixes：投递设置前后缀。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 337 | `NE输入框_设置图标` | `NE输入框_设置图标(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | void | 底层直调 EU_SetInputIcons：设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 338 | `NE输入框_投递设置图标` | `NE输入框_投递设置图标(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | int | 底层直调 EU_PostSetInputIcons：投递设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 339 | `NE输入框_取图标` | `NE输入框_取图标(hwnd, element_id, prefix_icon_buffer, prefix_icon_buffer_size, suffix_icon_buffer, suffix_icon_buffer_size)` | int | 底层直调 EU_GetInputIcons：取图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 340 | `NE输入框_设置可清空` | `NE输入框_设置可清空(hwnd, element_id, clearable)` | void | 底层直调 EU_SetInputClearable：设置可清空。 |
| 341 | `NE输入框_投递设置可清空` | `NE输入框_投递设置可清空(hwnd, element_id, clearable)` | int | 底层直调 EU_PostSetInputClearable：投递设置可清空。 |
| 342 | `NE输入框_设置选项` | `NE输入框_设置选项(hwnd, element_id, readonly, password, multiline, validate_state)` | void | 底层直调 EU_SetInputOptions：设置选项。 |
| 343 | `NE输入框_投递设置选项` | `NE输入框_投递设置选项(hwnd, element_id, readonly, password, multiline, validate_state)` | int | 底层直调 EU_PostSetInputOptions：投递设置选项。 |
| 344 | `NE输入框_设置视觉选项` | `NE输入框_设置视觉选项(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | void | 底层直调 EU_SetInputVisualOptions：设置视觉选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 345 | `NE输入框_投递设置视觉选项` | `NE输入框_投递设置视觉选项(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | int | 底层直调 EU_PostSetInputVisualOptions：投递设置视觉选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 346 | `NE输入框_取视觉选项` | `NE输入框_取视觉选项(hwnd, element_id, size, show_password_toggle, show_word_limit, autosize, min_rows, max_rows)` | int | 底层直调 EU_GetInputVisualOptions：取视觉选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 347 | `NE输入框_设置选区` | `NE输入框_设置选区(hwnd, element_id, start, end)` | void | 底层直调 EU_SetInputSelection：设置选区。 |
| 348 | `NE输入框_投递设置选区` | `NE输入框_投递设置选区(hwnd, element_id, start, end)` | int | 底层直调 EU_PostSetInputSelection：投递设置选区。 |
| 349 | `NE输入框_取选区` | `NE输入框_取选区(hwnd, element_id, start, end)` | int | 底层直调 EU_GetInputSelection：取选区。 |
| 350 | `NE输入框_设置右键菜单启用` | `NE输入框_设置右键菜单启用(hwnd, element_id, enabled)` | void | 底层直调 EU_SetInputContextMenuEnabled：设置右键菜单启用。 |
| 351 | `NE输入框_投递设置右键菜单启用` | `NE输入框_投递设置右键菜单启用(hwnd, element_id, enabled)` | int | 底层直调 EU_PostSetInputContextMenuEnabled：投递设置右键菜单启用。 |
| 352 | `NE输入框_取右键菜单启用` | `NE输入框_取右键菜单启用(hwnd, element_id)` | int | 底层直调 EU_GetInputContextMenuEnabled：取右键菜单启用。 |
| 353 | `NE输入框_取状态` | `NE输入框_取状态(hwnd, element_id, cursor, length, clearable, readonly, password, multiline, validate_state)` | int | 底层直调 EU_GetInputState：取状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 354 | `NE输入框_设置滚动` | `NE输入框_设置滚动(hwnd, element_id, scroll_y)` | void | 底层直调 EU_SetInputScroll：设置滚动。 |
| 355 | `NE输入框_投递设置滚动` | `NE输入框_投递设置滚动(hwnd, element_id, scroll_y)` | int | 底层直调 EU_PostSetInputScroll：投递设置滚动。 |
| 356 | `NE输入框_取滚动` | `NE输入框_取滚动(hwnd, element_id, scroll_y, max_scroll_y, content_height, viewport_height)` | int | 底层直调 EU_GetInputScroll：取滚动。 |
| 357 | `NE输入框_设置长度上限` | `NE输入框_设置长度上限(hwnd, element_id, max_length)` | void | 底层直调 EU_SetInputMaxLength：设置长度上限。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 358 | `NE输入框_投递设置长度上限` | `NE输入框_投递设置长度上限(hwnd, element_id, max_length)` | int | 底层直调 EU_PostSetInputMaxLength：投递设置长度上限。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 359 | `NE输入框_取长度上限` | `NE输入框_取长度上限(hwnd, element_id)` | int | 底层直调 EU_GetInputMaxLength：取长度上限。 |
| 360 | `NE输入框_设置文本回调` | `NE输入框_设置文本回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetInputTextCallback：设置文本回调。处理器实参必须写 &处理器名。 |
| 361 | `NE组合输入_设置值` | `NE组合输入_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetInputGroupValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 362 | `NE组合输入_投递设置值` | `NE组合输入_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetInputGroupValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 363 | `NE组合输入_取值` | `NE组合输入_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetInputGroupValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 364 | `NE组合输入_设置选项` | `NE组合输入_设置选项(hwnd, element_id, size, clearable, password, show_word_limit, autosize, min_rows, max_rows)` | void | 底层直调 EU_SetInputGroupOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 365 | `NE组合输入_取选项` | `NE组合输入_取选项(hwnd, element_id, size, clearable, password, show_word_limit, autosize, min_rows, max_rows)` | int | 底层直调 EU_GetInputGroupOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 366 | `NE组合输入_设置文本附件` | `NE组合输入_设置文本附件(hwnd, element_id, side, text_bytes, text_len)` | void | 底层直调 EU_SetInputGroupTextAddon：设置文本附件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 367 | `NE组合输入_设置按钮附件` | `NE组合输入_设置按钮附件(hwnd, element_id, side, emoji_bytes, emoji_len, text_bytes, text_len, variant)` | void | 底层直调 EU_SetInputGroupButtonAddon：设置按钮附件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 368 | `NE组合输入_设置下拉附件` | `NE组合输入_设置下拉附件(hwnd, element_id, side, items_bytes, items_len, selected_index, placeholder_bytes, placeholder_len)` | void | 底层直调 EU_SetInputGroupSelectAddon：设置下拉附件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 369 | `NE组合输入_清空附件` | `NE组合输入_清空附件(hwnd, element_id, side)` | void | 底层直调 EU_ClearInputGroupAddon：清空附件。 |
| 370 | `NE组合输入_取输入框元素编号` | `NE组合输入_取输入框元素编号(hwnd, element_id)` | int | 底层直调 EU_GetInputGroupInputElementId：取输入框元素编号。 |
| 371 | `NE组合输入_取附件元素编号` | `NE组合输入_取附件元素编号(hwnd, element_id, side)` | int | 底层直调 EU_GetInputGroupAddonElementId：取附件元素编号。 |
| 372 | `NE标签输入框_设置标签直调` | `NE标签输入框_设置标签直调(hwnd, element_id, tags_bytes, tags_len)` | void | NE标签输入框_设置标签 的底层直调版本：设置标签。一般请用高层封装 NE标签输入框_设置标签。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 373 | `NE标签输入框_投递设置标签` | `NE标签输入框_投递设置标签(hwnd, element_id, tags_bytes, tags_len)` | int | 底层直调 EU_PostSetInputTagTags：投递设置标签。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 374 | `NE标签输入框_设置占位提示` | `NE标签输入框_设置占位提示(hwnd, element_id, placeholder_bytes, placeholder_len)` | void | 底层直调 EU_SetInputTagPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 375 | `NE标签输入框_设置选项` | `NE标签输入框_设置选项(hwnd, element_id, max_count, allow_duplicates)` | void | 底层直调 EU_SetInputTagOptions：设置选项。 |
| 376 | `NE标签输入框_取数量` | `NE标签输入框_取数量(hwnd, element_id)` | int | 底层直调 EU_GetInputTagCount：取数量。 |
| 377 | `NE标签输入框_取选项` | `NE标签输入框_取选项(hwnd, element_id, max_count, allow_duplicates)` | int | 底层直调 EU_GetInputTagOptions：取选项。 |
| 378 | `NE标签输入框_添加项` | `NE标签输入框_添加项(hwnd, element_id, tag_bytes, tag_len)` | int | 底层直调 EU_AddInputTagItem：添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 379 | `NE标签输入框_移除项` | `NE标签输入框_移除项(hwnd, element_id, tag_index)` | int | 底层直调 EU_RemoveInputTagItem：移除项。 |
| 380 | `NE标签输入框_设置输入框值` | `NE标签输入框_设置输入框值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetInputTagInputValue：设置输入框值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 381 | `NE标签输入框_投递设置输入框值` | `NE标签输入框_投递设置输入框值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetInputTagInputValue：投递设置输入框值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 382 | `NE标签输入框_取输入框值` | `NE标签输入框_取输入框值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetInputTagInputValue：取输入框值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 383 | `NE标签输入框_取指定项` | `NE标签输入框_取指定项(hwnd, element_id, tag_index, buffer, buffer_size)` | int | 底层直调 EU_GetInputTagItem：取指定项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 384 | `NE标签输入框_设置变化回调` | `NE标签输入框_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetInputTagChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 385 | `NE选择器_设置选项直调` | `NE选择器_设置选项直调(hwnd, element_id, options_bytes, options_len)` | void | NE选择器_设置选项 的底层直调版本：设置选项。一般请用高层封装 NE选择器_设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 386 | `NE选择器_设置索引` | `NE选择器_设置索引(hwnd, element_id, index)` | void | 底层直调 EU_SetSelectIndex：设置索引。 |
| 387 | `NE选择器_投递设置索引` | `NE选择器_投递设置索引(hwnd, element_id, index)` | int | 底层直调 EU_PostSetSelectIndex：投递设置索引。 |
| 388 | `NE选择器_取索引` | `NE选择器_取索引(hwnd, element_id)` | int | 底层直调 EU_GetSelectIndex：取索引。 |
| 389 | `NE选择器_设置打开` | `NE选择器_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetSelectOpen：设置打开。 |
| 390 | `NE选择器_取打开` | `NE选择器_取打开(hwnd, element_id)` | int | 底层直调 EU_GetSelectOpen：取打开。 |
| 391 | `NE选择器_设置搜索` | `NE选择器_设置搜索(hwnd, element_id, search_bytes, search_len)` | void | 底层直调 EU_SetSelectSearch：设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 392 | `NE选择器_设置选项禁用` | `NE选择器_设置选项禁用(hwnd, element_id, option_index, disabled)` | void | 底层直调 EU_SetSelectOptionDisabled：设置选项禁用。 |
| 393 | `NE选择器_设置选项对齐` | `NE选择器_设置选项对齐(hwnd, element_id, alignment)` | void | 底层直调 EU_SetSelectOptionAlignment：设置选项对齐。 |
| 394 | `NE选择器_取选项对齐` | `NE选择器_取选项对齐(hwnd, element_id)` | int | 底层直调 EU_GetSelectOptionAlignment：取选项对齐。 |
| 395 | `NE选择器_设置值对齐` | `NE选择器_设置值对齐(hwnd, element_id, alignment)` | void | 底层直调 EU_SetSelectValueAlignment：设置值对齐。 |
| 396 | `NE选择器_取值对齐` | `NE选择器_取值对齐(hwnd, element_id)` | int | 底层直调 EU_GetSelectValueAlignment：取值对齐。 |
| 397 | `NE选择器_取选项数量` | `NE选择器_取选项数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectOptionCount：取选项数量。 |
| 398 | `NE选择器_取匹配数量` | `NE选择器_取匹配数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectMatchedCount：取匹配数量。 |
| 399 | `NE选择器_取选项禁用` | `NE选择器_取选项禁用(hwnd, element_id, option_index)` | int | 底层直调 EU_GetSelectOptionDisabled：取选项禁用。 |
| 400 | `NE选择器_设置多选` | `NE选择器_设置多选(hwnd, element_id, multiple)` | void | 底层直调 EU_SetSelectMultiple：设置多选。 |
| 401 | `NE选择器_取多选` | `NE选择器_取多选(hwnd, element_id)` | int | 底层直调 EU_GetSelectMultiple：取多选。 |
| 402 | `NE选择器_设置选中索引列表` | `NE选择器_设置选中索引列表(hwnd, element_id, indices_bytes, indices_len)` | void | 底层直调 EU_SetSelectSelectedIndices：设置选中索引列表。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 403 | `NE选择器_取选中数量` | `NE选择器_取选中数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectSelectedCount：取选中数量。 |
| 404 | `NE选择器_取指定位置选中` | `NE选择器_取指定位置选中(hwnd, element_id, position)` | int | 底层直调 EU_GetSelectSelectedAt：取指定位置选中。 |
| 405 | `NE选择器_设置变化回调` | `NE选择器_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetSelectChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 406 | `NE虚拟选择器_设置选项直调` | `NE虚拟选择器_设置选项直调(hwnd, element_id, options_bytes, options_len)` | void | NE虚拟选择器_设置选项 的底层直调版本：设置选项。一般请用高层封装 NE虚拟选择器_设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 407 | `NE虚拟选择器_设置索引` | `NE虚拟选择器_设置索引(hwnd, element_id, index)` | void | 底层直调 EU_SetSelectV2Index：设置索引。 |
| 408 | `NE虚拟选择器_投递设置索引` | `NE虚拟选择器_投递设置索引(hwnd, element_id, index)` | int | 底层直调 EU_PostSetSelectV2Index：投递设置索引。 |
| 409 | `NE虚拟选择器_设置可见数量` | `NE虚拟选择器_设置可见数量(hwnd, element_id, visible_count)` | void | 底层直调 EU_SetSelectV2VisibleCount：设置可见数量。 |
| 410 | `NE虚拟选择器_取索引` | `NE虚拟选择器_取索引(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2Index：取索引。 |
| 411 | `NE虚拟选择器_取可见数量` | `NE虚拟选择器_取可见数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2VisibleCount：取可见数量。 |
| 412 | `NE虚拟选择器_设置打开` | `NE虚拟选择器_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetSelectV2Open：设置打开。 |
| 413 | `NE虚拟选择器_取打开` | `NE虚拟选择器_取打开(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2Open：取打开。 |
| 414 | `NE虚拟选择器_设置搜索` | `NE虚拟选择器_设置搜索(hwnd, element_id, search_bytes, search_len)` | void | 底层直调 EU_SetSelectV2Search：设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 415 | `NE虚拟选择器_设置选项禁用` | `NE虚拟选择器_设置选项禁用(hwnd, element_id, option_index, disabled)` | void | 底层直调 EU_SetSelectV2OptionDisabled：设置选项禁用。 |
| 416 | `NE虚拟选择器_设置选项对齐` | `NE虚拟选择器_设置选项对齐(hwnd, element_id, alignment)` | void | 底层直调 EU_SetSelectV2OptionAlignment：设置选项对齐。 |
| 417 | `NE虚拟选择器_取选项对齐` | `NE虚拟选择器_取选项对齐(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2OptionAlignment：取选项对齐。 |
| 418 | `NE虚拟选择器_设置值对齐` | `NE虚拟选择器_设置值对齐(hwnd, element_id, alignment)` | void | 底层直调 EU_SetSelectV2ValueAlignment：设置值对齐。 |
| 419 | `NE虚拟选择器_取值对齐` | `NE虚拟选择器_取值对齐(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2ValueAlignment：取值对齐。 |
| 420 | `NE虚拟选择器_取选项数量` | `NE虚拟选择器_取选项数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2OptionCount：取选项数量。 |
| 421 | `NE虚拟选择器_取匹配数量` | `NE虚拟选择器_取匹配数量(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2MatchedCount：取匹配数量。 |
| 422 | `NE虚拟选择器_取选项禁用` | `NE虚拟选择器_取选项禁用(hwnd, element_id, option_index)` | int | 底层直调 EU_GetSelectV2OptionDisabled：取选项禁用。 |
| 423 | `NE虚拟选择器_设置滚动索引` | `NE虚拟选择器_设置滚动索引(hwnd, element_id, scroll_index)` | void | 底层直调 EU_SetSelectV2ScrollIndex：设置滚动索引。 |
| 424 | `NE虚拟选择器_取滚动索引` | `NE虚拟选择器_取滚动索引(hwnd, element_id)` | int | 底层直调 EU_GetSelectV2ScrollIndex：取滚动索引。 |
| 425 | `NE虚拟选择器_设置变化回调` | `NE虚拟选择器_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetSelectV2ChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 426 | `NE评分_设置值` | `NE评分_设置值(hwnd, element_id, value)` | void | 底层直调 EU_SetRateValue：设置值。 |
| 427 | `NE评分_投递设置值` | `NE评分_投递设置值(hwnd, element_id, value)` | int | 底层直调 EU_PostSetRateValue：投递设置值。 |
| 428 | `NE评分_取值` | `NE评分_取值(hwnd, element_id)` | int | 底层直调 EU_GetRateValue：取值。 |
| 429 | `NE评分_设置上限` | `NE评分_设置上限(hwnd, element_id, max_value)` | void | 底层直调 EU_SetRateMax：设置上限。 |
| 430 | `NE评分_取上限` | `NE评分_取上限(hwnd, element_id)` | int | 底层直调 EU_GetRateMax：取上限。 |
| 431 | `NE评分_设置值两倍值` | `NE评分_设置值两倍值(hwnd, element_id, value_x2)` | void | 底层直调 EU_SetRateValueX2：设置值两倍值。两倍值=实际值×2（整数表达半星粒度）。 |
| 432 | `NE评分_投递设置值两倍值` | `NE评分_投递设置值两倍值(hwnd, element_id, value_x2)` | int | 底层直调 EU_PostSetRateValueX2：投递设置值两倍值。两倍值=实际值×2（整数表达半星粒度）。 |
| 433 | `NE评分_取值两倍值` | `NE评分_取值两倍值(hwnd, element_id)` | int | 底层直调 EU_GetRateValueX2：取值两倍值。两倍值=实际值×2（整数表达半星粒度）。 |
| 434 | `NE评分_设置选项` | `NE评分_设置选项(hwnd, element_id, allow_clear, allow_half, readonly)` | void | 底层直调 EU_SetRateOptions：设置选项。 |
| 435 | `NE评分_取选项` | `NE评分_取选项(hwnd, element_id, allow_clear, allow_half, readonly, show_score)` | int | 底层直调 EU_GetRateOptions：取选项。 |
| 436 | `NE评分_设置文本` | `NE评分_设置文本(hwnd, element_id, low_bytes, low_len, high_bytes, high_len, show_score)` | void | 底层直调 EU_SetRateTexts：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 437 | `NE评分_设置配色` | `NE评分_设置配色(hwnd, element_id, low_color, mid_color, high_color)` | void | 底层直调 EU_SetRateColors：设置配色。 |
| 438 | `NE评分_取配色` | `NE评分_取配色(hwnd, element_id, low_color, mid_color, high_color)` | int | 底层直调 EU_GetRateColors：取配色。 |
| 439 | `NE评分_设置图标` | `NE评分_设置图标(hwnd, element_id, full_bytes, full_len, void_bytes, void_len, low_bytes, low_len, mid_bytes, mid_len, high_bytes, high_len)` | void | 底层直调 EU_SetRateIcons：设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 440 | `NE评分_取图标` | `NE评分_取图标(hwnd, element_id, full_buffer, full_buffer_size, void_buffer, void_buffer_size, low_buffer, low_buffer_size, mid_buffer, mid_buffer_size, high_buffer, high_buffer_size)` | int | 底层直调 EU_GetRateIcons：取图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 441 | `NE评分_设置文本项` | `NE评分_设置文本项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetRateTextItems：设置文本项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 442 | `NE评分_设置显示选项` | `NE评分_设置显示选项(hwnd, element_id, show_text, show_score, text_color, template_bytes, template_len)` | void | 底层直调 EU_SetRateDisplayOptions：设置显示选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 443 | `NE评分_取显示选项` | `NE评分_取显示选项(hwnd, element_id, show_text, show_score, text_color, template_buffer, template_buffer_size)` | int | 底层直调 EU_GetRateDisplayOptions：取显示选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 444 | `NE评分_设置变化回调` | `NE评分_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetRateChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 445 | `NE颜色选择器_设置颜色` | `NE颜色选择器_设置颜色(hwnd, element_id, color)` | void | 底层直调 EU_SetColorPickerColor：设置颜色。颜色使用 0xAARRGGBB。 |
| 446 | `NE颜色选择器_投递设置颜色` | `NE颜色选择器_投递设置颜色(hwnd, element_id, color)` | int | 底层直调 EU_PostSetColorPickerColor：投递设置颜色。颜色使用 0xAARRGGBB。 |
| 447 | `NE颜色选择器_取颜色` | `NE颜色选择器_取颜色(hwnd, element_id)` | int | 底层直调 EU_GetColorPickerColor：取颜色。颜色使用 0xAARRGGBB。 |
| 448 | `NE颜色选择器_设置透明度` | `NE颜色选择器_设置透明度(hwnd, element_id, alpha)` | void | 底层直调 EU_SetColorPickerAlpha：设置透明度。 |
| 449 | `NE颜色选择器_取透明度` | `NE颜色选择器_取透明度(hwnd, element_id)` | int | 底层直调 EU_GetColorPickerAlpha：取透明度。 |
| 450 | `NE颜色选择器_设置十六进制` | `NE颜色选择器_设置十六进制(hwnd, element_id, hex_bytes, hex_len)` | int | 底层直调 EU_SetColorPickerHex：设置十六进制。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 451 | `NE颜色选择器_投递设置十六进制` | `NE颜色选择器_投递设置十六进制(hwnd, element_id, hex_bytes, hex_len)` | int | 底层直调 EU_PostSetColorPickerHex：投递设置十六进制。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 452 | `NE颜色选择器_取十六进制` | `NE颜色选择器_取十六进制(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetColorPickerHex：取十六进制。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 453 | `NE颜色选择器_设置打开` | `NE颜色选择器_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetColorPickerOpen：设置打开。 |
| 454 | `NE颜色选择器_投递设置打开` | `NE颜色选择器_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetColorPickerOpen：投递设置打开。 |
| 455 | `NE颜色选择器_取打开` | `NE颜色选择器_取打开(hwnd, element_id)` | int | 底层直调 EU_GetColorPickerOpen：取打开。 |
| 456 | `NE颜色选择器_设置调色板` | `NE颜色选择器_设置调色板(hwnd, element_id, colors, count)` | void | 底层直调 EU_SetColorPickerPalette：设置调色板。 |
| 457 | `NE颜色选择器_取调色板数量` | `NE颜色选择器_取调色板数量(hwnd, element_id)` | int | 底层直调 EU_GetColorPickerPaletteCount：取调色板数量。 |
| 458 | `NE颜色选择器_设置选项` | `NE颜色选择器_设置选项(hwnd, element_id, show_alpha, size_mode, clearable)` | void | 底层直调 EU_SetColorPickerOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 459 | `NE颜色选择器_取选项` | `NE颜色选择器_取选项(hwnd, element_id, show_alpha, size_mode, clearable)` | int | 底层直调 EU_GetColorPickerOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 460 | `NE颜色选择器_清空` | `NE颜色选择器_清空(hwnd, element_id)` | void | 底层直调 EU_ClearColorPicker：清空。 |
| 461 | `NE颜色选择器_取有值` | `NE颜色选择器_取有值(hwnd, element_id)` | int | 底层直调 EU_GetColorPickerHasValue：取有值。 |
| 462 | `NE颜色选择器_设置变化回调` | `NE颜色选择器_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetColorPickerChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 463 | `NE标签_设置类型` | `NE标签_设置类型(hwnd, element_id, tag_type)` | void | 底层直调 EU_SetTagType：设置类型。 |
| 464 | `NE标签_投递设置类型` | `NE标签_投递设置类型(hwnd, element_id, tag_type)` | int | 底层直调 EU_PostSetTagType：投递设置类型。 |
| 465 | `NE标签_设置效果` | `NE标签_设置效果(hwnd, element_id, effect)` | void | 底层直调 EU_SetTagEffect：设置效果。 |
| 466 | `NE标签_设置可关闭` | `NE标签_设置可关闭(hwnd, element_id, closable)` | void | 底层直调 EU_SetTagClosable：设置可关闭。 |
| 467 | `NE标签_设置关闭` | `NE标签_设置关闭(hwnd, element_id, closed)` | void | 底层直调 EU_SetTagClosed：设置关闭。 |
| 468 | `NE标签_投递设置关闭` | `NE标签_投递设置关闭(hwnd, element_id, closed)` | int | 底层直调 EU_PostSetTagClosed：投递设置关闭。 |
| 469 | `NE标签_取关闭` | `NE标签_取关闭(hwnd, element_id)` | int | 底层直调 EU_GetTagClosed：取关闭。 |
| 470 | `NE标签_取选项` | `NE标签_取选项(hwnd, element_id, tag_type, effect, closable, closed)` | int | 底层直调 EU_GetTagOptions：取选项。 |
| 471 | `NE标签_设置尺寸` | `NE标签_设置尺寸(hwnd, element_id, size_preset)` | void | 底层直调 EU_SetTagSize：设置尺寸。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 472 | `NE标签_设置主题色` | `NE标签_设置主题色(hwnd, element_id, color)` | void | 底层直调 EU_SetTagThemeColor：设置主题色。 |
| 473 | `NE标签_投递设置主题色` | `NE标签_投递设置主题色(hwnd, element_id, color)` | int | 底层直调 EU_PostSetTagThemeColor：投递设置主题色。 |
| 474 | `NE标签_取视觉选项` | `NE标签_取视觉选项(hwnd, element_id, size_preset, theme_color)` | int | 底层直调 EU_GetTagVisualOptions：取视觉选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 475 | `NE标签_设置文本选项` | `NE标签_设置文本选项(hwnd, element_id, align, wrap)` | void | 底层直调 EU_SetTagTextOptions：设置文本选项。 |
| 476 | `NE标签_取文本选项` | `NE标签_取文本选项(hwnd, element_id, align, wrap)` | int | 底层直调 EU_GetTagTextOptions：取文本选项。 |
| 477 | `NE标签_设置关闭回调` | `NE标签_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTagCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 478 | `NE徽标_设置值` | `NE徽标_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetBadgeValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 479 | `NE徽标_投递设置值` | `NE徽标_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetBadgeValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 480 | `NE徽标_设置上限` | `NE徽标_设置上限(hwnd, element_id, max_value)` | void | 底层直调 EU_SetBadgeMax：设置上限。 |
| 481 | `NE徽标_设置类型` | `NE徽标_设置类型(hwnd, element_id, badge_type)` | void | 底层直调 EU_SetBadgeType：设置类型。 |
| 482 | `NE徽标_投递设置类型` | `NE徽标_投递设置类型(hwnd, element_id, badge_type)` | int | 底层直调 EU_PostSetBadgeType：投递设置类型。 |
| 483 | `NE徽标_设置点` | `NE徽标_设置点(hwnd, element_id, dot)` | void | 底层直调 EU_SetBadgeDot：设置点。 |
| 484 | `NE徽标_投递设置点` | `NE徽标_投递设置点(hwnd, element_id, dot)` | int | 底层直调 EU_PostSetBadgeDot：投递设置点。 |
| 485 | `NE徽标_设置选项` | `NE徽标_设置选项(hwnd, element_id, dot, show_zero, offset_x, offset_y)` | void | 底层直调 EU_SetBadgeOptions：设置选项。 |
| 486 | `NE徽标_取隐藏` | `NE徽标_取隐藏(hwnd, element_id)` | int | 底层直调 EU_GetBadgeHidden：取隐藏。 |
| 487 | `NE徽标_取选项` | `NE徽标_取选项(hwnd, element_id, max_value, dot, show_zero, offset_x, offset_y)` | int | 底层直调 EU_GetBadgeOptions：取选项。 |
| 488 | `NE徽标_取类型` | `NE徽标_取类型(hwnd, element_id)` | int | 底层直调 EU_GetBadgeType：取类型。 |
| 489 | `NE徽标_设置布局选项` | `NE徽标_设置布局选项(hwnd, element_id, placement, standalone)` | void | 底层直调 EU_SetBadgeLayoutOptions：设置布局选项。 |
| 490 | `NE徽标_取布局选项` | `NE徽标_取布局选项(hwnd, element_id, placement, standalone)` | int | 底层直调 EU_GetBadgeLayoutOptions：取布局选项。 |
| 491 | `NE徽标_设置圆角` | `NE徽标_设置圆角(hwnd, element_id, radius)` | void | 底层直调 EU_SetBadgeCornerRadius：设置圆角。 |
| 492 | `NE徽标_取圆角` | `NE徽标_取圆角(hwnd, element_id)` | int | 底层直调 EU_GetBadgeCornerRadius：取圆角。 |
| 493 | `NE进度条_设置百分比` | `NE进度条_设置百分比(hwnd, element_id, percentage)` | void | 底层直调 EU_SetProgressPercentage：设置百分比。 |
| 494 | `NE进度条_投递设置百分比` | `NE进度条_投递设置百分比(hwnd, element_id, percentage)` | int | 底层直调 EU_PostSetProgressPercentage：投递设置百分比。 |
| 495 | `NE进度条_取百分比` | `NE进度条_取百分比(hwnd, element_id)` | int | 底层直调 EU_GetProgressPercentage：取百分比。 |
| 496 | `NE进度条_设置状态` | `NE进度条_设置状态(hwnd, element_id, status)` | void | 底层直调 EU_SetProgressStatus：设置状态。 |
| 497 | `NE进度条_投递设置状态` | `NE进度条_投递设置状态(hwnd, element_id, status)` | int | 底层直调 EU_PostSetProgressStatus：投递设置状态。 |
| 498 | `NE进度条_取状态` | `NE进度条_取状态(hwnd, element_id)` | int | 底层直调 EU_GetProgressStatus：取状态。 |
| 499 | `NE进度条_设置显示文本` | `NE进度条_设置显示文本(hwnd, element_id, show_text)` | void | 底层直调 EU_SetProgressShowText：设置显示文本。 |
| 500 | `NE进度条_投递设置显示文本` | `NE进度条_投递设置显示文本(hwnd, element_id, show_text)` | int | 底层直调 EU_PostSetProgressShowText：投递设置显示文本。 |
| 501 | `NE进度条_设置选项` | `NE进度条_设置选项(hwnd, element_id, progress_type, stroke_width, show_text)` | void | 底层直调 EU_SetProgressOptions：设置选项。 |
| 502 | `NE进度条_投递设置选项` | `NE进度条_投递设置选项(hwnd, element_id, progress_type, stroke_width, show_text)` | int | 底层直调 EU_PostSetProgressOptions：投递设置选项。 |
| 503 | `NE进度条_取选项` | `NE进度条_取选项(hwnd, element_id, progress_type, stroke_width, show_text)` | int | 底层直调 EU_GetProgressOptions：取选项。 |
| 504 | `NE进度条_设置格式选项` | `NE进度条_设置格式选项(hwnd, element_id, text_format, striped)` | void | 底层直调 EU_SetProgressFormatOptions：设置格式选项。 |
| 505 | `NE进度条_投递设置格式选项` | `NE进度条_投递设置格式选项(hwnd, element_id, text_format, striped)` | int | 底层直调 EU_PostSetProgressFormatOptions：投递设置格式选项。 |
| 506 | `NE进度条_取格式选项` | `NE进度条_取格式选项(hwnd, element_id, text_format, striped)` | int | 底层直调 EU_GetProgressFormatOptions：取格式选项。 |
| 507 | `NE进度条_设置内部文本` | `NE进度条_设置内部文本(hwnd, element_id, text_inside)` | void | 底层直调 EU_SetProgressTextInside：设置内部文本。 |
| 508 | `NE进度条_投递设置内部文本` | `NE进度条_投递设置内部文本(hwnd, element_id, text_inside)` | int | 底层直调 EU_PostSetProgressTextInside：投递设置内部文本。 |
| 509 | `NE进度条_取内部文本` | `NE进度条_取内部文本(hwnd, element_id)` | int | 底层直调 EU_GetProgressTextInside：取内部文本。 |
| 510 | `NE进度条_设置配色` | `NE进度条_设置配色(hwnd, element_id, fill, track, text)` | void | 底层直调 EU_SetProgressColors：设置配色。 |
| 511 | `NE进度条_投递设置配色` | `NE进度条_投递设置配色(hwnd, element_id, fill, track, text)` | int | 底层直调 EU_PostSetProgressColors：投递设置配色。 |
| 512 | `NE进度条_取配色` | `NE进度条_取配色(hwnd, element_id, fill, track, text)` | int | 底层直调 EU_GetProgressColors：取配色。 |
| 513 | `NE进度条_设置颜色断点` | `NE进度条_设置颜色断点(hwnd, element_id, stops_bytes, stops_len)` | void | 底层直调 EU_SetProgressColorStops：设置颜色断点。颜色使用 0xAARRGGBB。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 514 | `NE进度条_投递设置颜色断点` | `NE进度条_投递设置颜色断点(hwnd, element_id, stops_bytes, stops_len)` | int | 底层直调 EU_PostSetProgressColorStops：投递设置颜色断点。颜色使用 0xAARRGGBB。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 515 | `NE进度条_取颜色断点数量` | `NE进度条_取颜色断点数量(hwnd, element_id)` | int | 底层直调 EU_GetProgressColorStopCount：取颜色断点数量。颜色使用 0xAARRGGBB。 |
| 516 | `NE进度条_取颜色断点` | `NE进度条_取颜色断点(hwnd, element_id, index, color, percentage)` | int | 底层直调 EU_GetProgressColorStop：取颜色断点。颜色使用 0xAARRGGBB。 |
| 517 | `NE进度条_设置完成文本` | `NE进度条_设置完成文本(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetProgressCompleteText：设置完成文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 518 | `NE进度条_投递设置完成文本` | `NE进度条_投递设置完成文本(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetProgressCompleteText：投递设置完成文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 519 | `NE进度条_取完成文本` | `NE进度条_取完成文本(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetProgressCompleteText：取完成文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 520 | `NE进度条_设置文本模板直调` | `NE进度条_设置文本模板直调(hwnd, element_id, bytes, len)` | void | NE进度条_设置文本模板 的底层直调版本：设置文本模板。一般请用高层封装 NE进度条_设置文本模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 521 | `NE进度条_投递设置文本模板` | `NE进度条_投递设置文本模板(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetProgressTextTemplate：投递设置文本模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 522 | `NE进度条_取文本模板` | `NE进度条_取文本模板(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetProgressTextTemplate：取文本模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 523 | `NE头像_设置形状` | `NE头像_设置形状(hwnd, element_id, shape)` | void | 底层直调 EU_SetAvatarShape：设置形状。 |
| 524 | `NE头像_设置来源` | `NE头像_设置来源(hwnd, element_id, src_bytes, src_len)` | void | 底层直调 EU_SetAvatarSource：设置来源。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 525 | `NE头像_设置回退来源` | `NE头像_设置回退来源(hwnd, element_id, src_bytes, src_len)` | void | 底层直调 EU_SetAvatarFallbackSource：设置回退来源。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 526 | `NE头像_设置图标直调` | `NE头像_设置图标直调(hwnd, element_id, icon_bytes, icon_len)` | void | NE头像_设置图标 的底层直调版本：设置图标。一般请用高层封装 NE头像_设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 527 | `NE头像_设置错误文本` | `NE头像_设置错误文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetAvatarErrorText：设置错误文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 528 | `NE头像_设置填充方式` | `NE头像_设置填充方式(hwnd, element_id, fit)` | void | 底层直调 EU_SetAvatarFit：设置填充方式。 |
| 529 | `NE头像_取图片状态` | `NE头像_取图片状态(hwnd, element_id)` | int | 底层直调 EU_GetAvatarImageStatus：取图片状态。 |
| 530 | `NE头像_取选项` | `NE头像_取选项(hwnd, element_id, shape, fit)` | int | 底层直调 EU_GetAvatarOptions：取选项。 |
| 531 | `NE空状态_设置描述直调` | `NE空状态_设置描述直调(hwnd, element_id, desc_bytes, desc_len)` | void | NE空状态_设置描述 的底层直调版本：设置描述。一般请用高层封装 NE空状态_设置描述。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 532 | `NE空状态_设置选项` | `NE空状态_设置选项(hwnd, element_id, icon_bytes, icon_len, action_bytes, action_len)` | void | 底层直调 EU_SetEmptyOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 533 | `NE空状态_设置动作点击` | `NE空状态_设置动作点击(hwnd, element_id, clicked)` | void | 底层直调 EU_SetEmptyActionClicked：设置动作点击。 |
| 534 | `NE空状态_取动作点击` | `NE空状态_取动作点击(hwnd, element_id)` | int | 底层直调 EU_GetEmptyActionClicked：取动作点击。 |
| 535 | `NE空状态_设置动作回调` | `NE空状态_设置动作回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetEmptyActionCallback：设置动作回调。处理器实参必须写 &处理器名。 |
| 536 | `NE空状态_设置图片` | `NE空状态_设置图片(hwnd, element_id, image_bytes, image_len)` | void | 底层直调 EU_SetEmptyImage：设置图片。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 537 | `NE空状态_设置图片尺寸` | `NE空状态_设置图片尺寸(hwnd, element_id, image_size)` | void | 底层直调 EU_SetEmptyImageSize：设置图片尺寸。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 538 | `NE空状态_取图片状态` | `NE空状态_取图片状态(hwnd, element_id)` | int | 底层直调 EU_GetEmptyImageStatus：取图片状态。 |
| 539 | `NE空状态_取图片尺寸` | `NE空状态_取图片尺寸(hwnd, element_id)` | int | 底层直调 EU_GetEmptyImageSize：取图片尺寸。 |
| 540 | `NE骨架屏_设置行列表` | `NE骨架屏_设置行列表(hwnd, element_id, rows)` | void | 底层直调 EU_SetSkeletonRows：设置行列表。 |
| 541 | `NE骨架屏_投递设置行列表` | `NE骨架屏_投递设置行列表(hwnd, element_id, rows)` | int | 底层直调 EU_PostSetSkeletonRows：投递设置行列表。 |
| 542 | `NE骨架屏_设置动画` | `NE骨架屏_设置动画(hwnd, element_id, animated)` | void | 底层直调 EU_SetSkeletonAnimated：设置动画。 |
| 543 | `NE骨架屏_设置加载中` | `NE骨架屏_设置加载中(hwnd, element_id, loading)` | void | 底层直调 EU_SetSkeletonLoading：设置加载中。 |
| 544 | `NE骨架屏_投递设置加载中` | `NE骨架屏_投递设置加载中(hwnd, element_id, loading)` | int | 底层直调 EU_PostSetSkeletonLoading：投递设置加载中。 |
| 545 | `NE骨架屏_设置选项` | `NE骨架屏_设置选项(hwnd, element_id, rows, animated, loading, show_avatar)` | void | 底层直调 EU_SetSkeletonOptions：设置选项。 |
| 546 | `NE骨架屏_取加载中` | `NE骨架屏_取加载中(hwnd, element_id)` | int | 底层直调 EU_GetSkeletonLoading：取加载中。 |
| 547 | `NE骨架屏_取选项` | `NE骨架屏_取选项(hwnd, element_id, rows, animated, loading, show_avatar)` | int | 底层直调 EU_GetSkeletonOptions：取选项。 |
| 548 | `NE描述列表_设置项` | `NE描述列表_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetDescriptionsItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 549 | `NE描述列表_投递设置项` | `NE描述列表_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetDescriptionsItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 550 | `NE描述列表_设置列` | `NE描述列表_设置列(hwnd, element_id, columns)` | void | 底层直调 EU_SetDescriptionsColumns：设置列。 |
| 551 | `NE描述列表_设置边框` | `NE描述列表_设置边框(hwnd, element_id, bordered)` | void | 底层直调 EU_SetDescriptionsBordered：设置边框。 |
| 552 | `NE描述列表_设置布局` | `NE描述列表_设置布局(hwnd, element_id, direction, size, columns, bordered)` | void | 底层直调 EU_SetDescriptionsLayout：设置布局。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 553 | `NE描述列表_设置项扩展` | `NE描述列表_设置项扩展(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetDescriptionsItemsEx：设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 554 | `NE描述列表_投递设置项扩展` | `NE描述列表_投递设置项扩展(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetDescriptionsItemsEx：投递设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 555 | `NE描述列表_设置选项` | `NE描述列表_设置选项(hwnd, element_id, columns, bordered, label_width, min_row_height, wrap_values)` | void | 底层直调 EU_SetDescriptionsOptions：设置选项。 |
| 556 | `NE描述列表_取项数量` | `NE描述列表_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetDescriptionsItemCount：取项数量。 |
| 557 | `NE描述列表_设置高级选项` | `NE描述列表_设置高级选项(hwnd, element_id, responsive, last_item_span)` | void | 底层直调 EU_SetDescriptionsAdvancedOptions：设置高级选项。 |
| 558 | `NE描述列表_设置配色` | `NE描述列表_设置配色(hwnd, element_id, border, label_bg, content_bg, label_fg, content_fg, title_fg)` | void | 底层直调 EU_SetDescriptionsColors：设置配色。 |
| 559 | `NE描述列表_设置附加内容` | `NE描述列表_设置附加内容(hwnd, element_id, emoji_bytes, emoji_len, text_bytes, text_len, visible, variant)` | void | 底层直调 EU_SetDescriptionsExtra：设置附加内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 560 | `NE描述列表_取选项` | `NE描述列表_取选项(hwnd, element_id, columns, bordered, label_width, min_row_height, wrap_values, responsive, last_item_span)` | int | 底层直调 EU_GetDescriptionsOptions：取选项。 |
| 561 | `NE描述列表_取完整状态` | `NE描述列表_取完整状态(hwnd, element_id, direction, size, columns, bordered, item_count, extra_click_count, responsive, wrap_values)` | int | 底层直调 EU_GetDescriptionsFullState：取完整状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 562 | `NE表格_设置数据` | `NE表格_设置数据(hwnd, element_id, columns_bytes, columns_len, rows_bytes, rows_len)` | void | 底层直调 EU_SetTableData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 563 | `NE表格_投递设置数据` | `NE表格_投递设置数据(hwnd, element_id, columns_bytes, columns_len, rows_bytes, rows_len)` | int | 底层直调 EU_PostSetTableData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 564 | `NE表格_设置斑马纹` | `NE表格_设置斑马纹(hwnd, element_id, striped)` | void | 底层直调 EU_SetTableStriped：设置斑马纹。 |
| 565 | `NE表格_设置边框` | `NE表格_设置边框(hwnd, element_id, bordered)` | void | 底层直调 EU_SetTableBordered：设置边框。 |
| 566 | `NE表格_设置边框颜色` | `NE表格_设置边框颜色(hwnd, element_id, color)` | void | 底层直调 EU_SetTableBorderColor：设置边框颜色。颜色使用 0xAARRGGBB。 |
| 567 | `NE表格_设置边框宽度` | `NE表格_设置边框宽度(hwnd, element_id, width)` | void | 底层直调 EU_SetTableBorderWidth：设置边框宽度。 |
| 568 | `NE表格_设置空态文本` | `NE表格_设置空态文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetTableEmptyText：设置空态文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 569 | `NE表格_设置选中行` | `NE表格_设置选中行(hwnd, element_id, row_index)` | void | 底层直调 EU_SetTableSelectedRow：设置选中行。 |
| 570 | `NE表格_取选中行` | `NE表格_取选中行(hwnd, element_id)` | int | 底层直调 EU_GetTableSelectedRow：取选中行。 |
| 571 | `NE表格_取行数量` | `NE表格_取行数量(hwnd, element_id)` | int | 底层直调 EU_GetTableRowCount：取行数量。 |
| 572 | `NE表格_同步取行数` | `NE表格_同步取行数(hwnd, element_id)` | int | 底层直调 EU_InvokeGetTableRowCount：同步取行数。 |
| 573 | `NE表格_取列数量` | `NE表格_取列数量(hwnd, element_id)` | int | 底层直调 EU_GetTableColumnCount：取列数量。 |
| 574 | `NE表格_设置选项` | `NE表格_设置选项(hwnd, element_id, striped, bordered, row_height, header_height, selectable)` | void | 底层直调 EU_SetTableOptions：设置选项。 |
| 575 | `NE表格_设置排序` | `NE表格_设置排序(hwnd, element_id, column_index, desc)` | void | 底层直调 EU_SetTableSort：设置排序。 |
| 576 | `NE表格_设置滚动行` | `NE表格_设置滚动行(hwnd, element_id, scroll_row)` | void | 底层直调 EU_SetTableScrollRow：设置滚动行。 |
| 577 | `NE表格_设置列宽` | `NE表格_设置列宽(hwnd, element_id, column_width)` | void | 底层直调 EU_SetTableColumnWidth：设置列宽。 |
| 578 | `NE表格_设置指定列宽` | `NE表格_设置指定列宽(hwnd, element_id, column_index, column_width)` | void | 底层直调 EU_SetTableColumnWidthAt：设置指定列宽。 |
| 579 | `NE表格_取选项` | `NE表格_取选项(hwnd, element_id, striped, bordered, row_height, header_height, selectable, sort_column, sort_desc, scroll_row, column_width)` | int | 底层直调 EU_GetTableOptions：取选项。 |
| 580 | `NE表格_设置列扩展` | `NE表格_设置列扩展(hwnd, element_id, columns_bytes, columns_len)` | void | 底层直调 EU_SetTableColumnsEx：设置列扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 581 | `NE表格_设置行列表扩展` | `NE表格_设置行列表扩展(hwnd, element_id, rows_bytes, rows_len)` | void | 底层直调 EU_SetTableRowsEx：设置行列表扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 582 | `NE表格_投递设置行列表扩展` | `NE表格_投递设置行列表扩展(hwnd, element_id, rows_bytes, rows_len)` | int | 底层直调 EU_PostSetTableRowsEx：投递设置行列表扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 583 | `NE表格_添加行直调` | `NE表格_添加行直调(hwnd, element_id, row_bytes, row_len)` | int | NE表格_添加行 的底层直调版本：添加行。一般请用高层封装 NE表格_添加行。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 584 | `NE表格_投递添加行直调` | `NE表格_投递添加行直调(hwnd, element_id, row_bytes, row_len)` | int | NE表格_投递添加行 的底层直调版本：投递添加行。一般请用高层封装 NE表格_投递添加行。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 585 | `NE表格_插入行直调` | `NE表格_插入行直调(hwnd, element_id, row_index, row_bytes, row_len)` | int | NE表格_插入行 的底层直调版本：插入行。一般请用高层封装 NE表格_插入行。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 586 | `NE表格_投递插入行直调` | `NE表格_投递插入行直调(hwnd, element_id, row_index, row_bytes, row_len)` | int | NE表格_投递插入行 的底层直调版本：投递插入行。一般请用高层封装 NE表格_投递插入行。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 587 | `NE表格_删除行` | `NE表格_删除行(hwnd, element_id, row_index)` | int | 底层直调 EU_DeleteTableRow：删除行。 |
| 588 | `NE表格_清空行列表` | `NE表格_清空行列表(hwnd, element_id)` | int | 底层直调 EU_ClearTableRows：清空行列表。 |
| 589 | `NE表格_投递清空行列表` | `NE表格_投递清空行列表(hwnd, element_id)` | int | 底层直调 EU_PostClearTableRows：投递清空行列表。 |
| 590 | `NE表格_设置单元格扩展` | `NE表格_设置单元格扩展(hwnd, element_id, row, col, type, value_bytes, value_len, options_bytes, options_len)` | void | 底层直调 EU_SetTableCellEx：设置单元格扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 591 | `NE表格_设置列对齐` | `NE表格_设置列对齐(hwnd, element_id, col, header_align, cell_align)` | void | 底层直调 EU_SetTableColumnAlign：设置列对齐。 |
| 592 | `NE表格_设置行对齐` | `NE表格_设置行对齐(hwnd, element_id, row, align)` | void | 底层直调 EU_SetTableRowAlign：设置行对齐。 |
| 593 | `NE表格_设置单元格对齐` | `NE表格_设置单元格对齐(hwnd, element_id, row, col, align)` | void | 底层直调 EU_SetTableCellAlign：设置单元格对齐。 |
| 594 | `NE表格_设置行样式` | `NE表格_设置行样式(hwnd, element_id, row, bg, fg, align, font_flags, font_size)` | void | 底层直调 EU_SetTableRowStyle：设置行样式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 595 | `NE表格_设置单元格样式` | `NE表格_设置单元格样式(hwnd, element_id, row, col, bg, fg, align, font_flags, font_size)` | void | 底层直调 EU_SetTableCellStyle：设置单元格样式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 596 | `NE表格_设置行悬停` | `NE表格_设置行悬停(hwnd, element_id, enable, hover_bg, hover_fg)` | void | 底层直调 EU_SetTableRowHover：设置行悬停。 |
| 597 | `NE表格_设置列悬停` | `NE表格_设置列悬停(hwnd, element_id, col, enable, hover_bg, hover_fg, cursor)` | void | 底层直调 EU_SetTableColumnHover：设置列悬停。 |
| 598 | `NE表格_设置单元格批量覆盖JSON` | `NE表格_设置单元格批量覆盖JSON(hwnd, element_id, spec_bytes, spec_len)` | void | 底层直调 EU_SetTableCellOverridesUtf8：设置单元格批量覆盖JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 599 | `NE表格_设置批量单元格合并JSON` | `NE表格_设置批量单元格合并JSON(hwnd, element_id, spec_bytes, spec_len)` | void | 底层直调 EU_SetTableSpansUtf8：设置批量单元格合并JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 600 | `NE表格_设置选区模式` | `NE表格_设置选区模式(hwnd, element_id, mode)` | void | 底层直调 EU_SetTableSelectionMode：设置选区模式。 |
| 601 | `NE表格_设置选中行列表` | `NE表格_设置选中行列表(hwnd, element_id, rows_bytes, rows_len)` | void | 底层直调 EU_SetTableSelectedRows：设置选中行列表。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 602 | `NE表格_设置筛选` | `NE表格_设置筛选(hwnd, element_id, col, value_bytes, value_len)` | void | 底层直调 EU_SetTableFilter：设置筛选。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 603 | `NE表格_清空筛选` | `NE表格_清空筛选(hwnd, element_id, col)` | void | 底层直调 EU_ClearTableFilter：清空筛选。 |
| 604 | `NE表格_设置搜索` | `NE表格_设置搜索(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetTableSearch：设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 605 | `NE表格_设置单元格合并` | `NE表格_设置单元格合并(hwnd, element_id, row, col, rowspan, colspan)` | void | 底层直调 EU_SetTableSpan：设置单元格合并。 |
| 606 | `NE表格_清空单元格合并` | `NE表格_清空单元格合并(hwnd, element_id)` | void | 底层直调 EU_ClearTableSpans：清空单元格合并。 |
| 607 | `NE表格_设置汇总行` | `NE表格_设置汇总行(hwnd, element_id, values_bytes, values_len)` | void | 底层直调 EU_SetTableSummary：设置汇总行。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 608 | `NE表格_设置行展开` | `NE表格_设置行展开(hwnd, element_id, row, expanded)` | void | 底层直调 EU_SetTableRowExpanded：设置行展开。 |
| 609 | `NE表格_设置树选项` | `NE表格_设置树选项(hwnd, element_id, enabled, indent, lazy)` | void | 底层直调 EU_SetTableTreeOptions：设置树选项。 |
| 610 | `NE表格_设置视口选项` | `NE表格_设置视口选项(hwnd, element_id, max_height, fixed_header, horizontal_scroll, show_summary)` | void | 底层直调 EU_SetTableViewportOptions：设置视口选项。 |
| 611 | `NE表格_设置滚动` | `NE表格_设置滚动(hwnd, element_id, scroll_row, scroll_x)` | void | 底层直调 EU_SetTableScroll：设置滚动。 |
| 612 | `NE表格_设置页头拖拽选项` | `NE表格_设置页头拖拽选项(hwnd, element_id, column_resize, header_height_resize, min_col_width, max_col_width, min_header_height, max_header_height)` | void | 底层直调 EU_SetTableHeaderDragOptions：设置页头拖拽选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 613 | `NE表格_设置双击编辑` | `NE表格_设置双击编辑(hwnd, element_id, enabled)` | void | 底层直调 EU_SetTableDoubleClickEdit：设置双击编辑。 |
| 614 | `NE表格_设置列双击编辑` | `NE表格_设置列双击编辑(hwnd, element_id, col, editable)` | void | 底层直调 EU_SetTableColumnDoubleClickEdit：设置列双击编辑。 |
| 615 | `NE表格_设置单元格双击编辑` | `NE表格_设置单元格双击编辑(hwnd, element_id, row, col, editable)` | void | 底层直调 EU_SetTableCellDoubleClickEdit：设置单元格双击编辑。 |
| 616 | `NE表格_取单元格双击编辑可用` | `NE表格_取单元格双击编辑可用(hwnd, element_id, row, col)` | int | 底层直调 EU_GetTableCellDoubleClickEditable：取单元格双击编辑可用。 |
| 617 | `NE表格_取双击编辑状态直调` | `NE表格_取双击编辑状态直调(hwnd, element_id, enabled, editing_row, editing_col)` | int | NE表格_取双击编辑状态 的底层直调版本：取双击编辑状态。一般请用高层封装 NE表格_取双击编辑状态。 |
| 618 | `NE表格_导出Excel直调` | `NE表格_导出Excel直调(hwnd, element_id, path_bytes, path_len, flags)` | int | NE表格_导出Excel 的底层直调版本：导出Excel。一般请用高层封装 NE表格_导出Excel。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 619 | `NE表格_导入Excel直调` | `NE表格_导入Excel直调(hwnd, element_id, path_bytes, path_len, flags)` | int | NE表格_导入Excel 的底层直调版本：导入Excel。一般请用高层封装 NE表格_导入Excel。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 620 | `NE表格_设置单元格点击回调` | `NE表格_设置单元格点击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTableCellClickCallback：设置单元格点击回调。处理器实参必须写 &处理器名。 |
| 621 | `NE表格_设置单元格动作回调` | `NE表格_设置单元格动作回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTableCellActionCallback：设置单元格动作回调。处理器实参必须写 &处理器名。 |
| 622 | `NE表格_设置单元格编辑回调` | `NE表格_设置单元格编辑回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTableCellEditCallback：设置单元格编辑回调。处理器实参必须写 &处理器名。 |
| 623 | `NE表格_设置右键菜单回调` | `NE表格_设置右键菜单回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTableContextMenuCallback：设置右键菜单回调。处理器实参必须写 &处理器名。 |
| 624 | `NE表格_设置虚拟模式选项` | `NE表格_设置虚拟模式选项(hwnd, element_id, enabled, row_count, cache_window)` | void | 底层直调 EU_SetTableVirtualOptions：设置虚拟模式选项。 |
| 625 | `NE表格_设置虚拟行数据源` | `NE表格_设置虚拟行数据源(hwnd, element_id, cb)` | void | 底层直调 EU_SetTableVirtualRowProvider：设置虚拟行数据源。 |
| 626 | `NE表格_清空虚拟缓存` | `NE表格_清空虚拟缓存(hwnd, element_id)` | void | 底层直调 EU_ClearTableVirtualCache：清空虚拟缓存。 |
| 627 | `NE表格_取单元格值直调` | `NE表格_取单元格值直调(hwnd, element_id, row, col, buffer, buffer_size)` | int | NE表格_取单元格值 的底层直调版本：取单元格值。一般请用高层封装 NE表格_取单元格值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 628 | `NE表格_取完整状态` | `NE表格_取完整状态(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTableFullState：取完整状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 629 | `NE列表框_设置项` | `NE列表框_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetListBoxItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 630 | `NE列表框_投递设置项` | `NE列表框_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetListBoxItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 631 | `NE列表框_设置项扩展` | `NE列表框_设置项扩展(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetListBoxItemsEx：设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 632 | `NE列表框_投递设置项扩展` | `NE列表框_投递设置项扩展(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetListBoxItemsEx：投递设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 633 | `NE列表框_添加项` | `NE列表框_添加项(hwnd, element_id, item_bytes, item_len)` | int | 底层直调 EU_AddListBoxItem：添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 634 | `NE列表框_投递添加项` | `NE列表框_投递添加项(hwnd, element_id, item_bytes, item_len)` | int | 底层直调 EU_PostAddListBoxItem：投递添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 635 | `NE列表框_插入项` | `NE列表框_插入项(hwnd, element_id, index, item_bytes, item_len)` | int | 底层直调 EU_InsertListBoxItem：插入项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 636 | `NE列表框_投递插入项` | `NE列表框_投递插入项(hwnd, element_id, index, item_bytes, item_len)` | int | 底层直调 EU_PostInsertListBoxItem：投递插入项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 637 | `NE列表框_更新项` | `NE列表框_更新项(hwnd, element_id, index, item_bytes, item_len)` | int | 底层直调 EU_UpdateListBoxItem：更新项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 638 | `NE列表框_投递更新项` | `NE列表框_投递更新项(hwnd, element_id, index, item_bytes, item_len)` | int | 底层直调 EU_PostUpdateListBoxItem：投递更新项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 639 | `NE列表框_删除项` | `NE列表框_删除项(hwnd, element_id, index)` | int | 底层直调 EU_DeleteListBoxItem：删除项。 |
| 640 | `NE列表框_投递删除项` | `NE列表框_投递删除项(hwnd, element_id, index)` | int | 底层直调 EU_PostDeleteListBoxItem：投递删除项。 |
| 641 | `NE列表框_清空项` | `NE列表框_清空项(hwnd, element_id)` | int | 底层直调 EU_ClearListBoxItems：清空项。 |
| 642 | `NE列表框_投递清空项` | `NE列表框_投递清空项(hwnd, element_id)` | int | 底层直调 EU_PostClearListBoxItems：投递清空项。 |
| 643 | `NE列表框_取项数量` | `NE列表框_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetListBoxItemCount：取项数量。 |
| 644 | `NE列表框_取指定项` | `NE列表框_取指定项(hwnd, element_id, index, buffer, buffer_size)` | int | 底层直调 EU_GetListBoxItem：取指定项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 645 | `NE列表框_取项` | `NE列表框_取项(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetListBoxItems：取项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 646 | `NE列表框_设置选中索引` | `NE列表框_设置选中索引(hwnd, element_id, index)` | void | 底层直调 EU_SetListBoxSelectedIndex：设置选中索引。 |
| 647 | `NE列表框_投递设置选中索引` | `NE列表框_投递设置选中索引(hwnd, element_id, index)` | int | 底层直调 EU_PostSetListBoxSelectedIndex：投递设置选中索引。 |
| 648 | `NE列表框_取选中索引` | `NE列表框_取选中索引(hwnd, element_id)` | int | 底层直调 EU_GetListBoxSelectedIndex：取选中索引。 |
| 649 | `NE列表框_设置选中键` | `NE列表框_设置选中键(hwnd, element_id, keys_bytes, keys_len)` | void | 底层直调 EU_SetListBoxSelectedKeys：设置选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 650 | `NE列表框_投递设置选中键` | `NE列表框_投递设置选中键(hwnd, element_id, keys_bytes, keys_len)` | int | 底层直调 EU_PostSetListBoxSelectedKeys：投递设置选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 651 | `NE列表框_取选中键` | `NE列表框_取选中键(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetListBoxSelectedKeys：取选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 652 | `NE列表框_取选中项` | `NE列表框_取选中项(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetListBoxSelectedItems：取选中项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 653 | `NE列表框_设置项禁用` | `NE列表框_设置项禁用(hwnd, element_id, index, disabled)` | void | 底层直调 EU_SetListBoxItemDisabled：设置项禁用。 |
| 654 | `NE列表框_投递设置项禁用` | `NE列表框_投递设置项禁用(hwnd, element_id, index, disabled)` | int | 底层直调 EU_PostSetListBoxItemDisabled：投递设置项禁用。 |
| 655 | `NE列表框_取项禁用` | `NE列表框_取项禁用(hwnd, element_id, index)` | int | 底层直调 EU_GetListBoxItemDisabled：取项禁用。 |
| 656 | `NE列表框_设置项展开` | `NE列表框_设置项展开(hwnd, element_id, key_bytes, key_len, expanded)` | void | 底层直调 EU_SetListBoxItemExpanded：设置项展开。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 657 | `NE列表框_投递设置项展开` | `NE列表框_投递设置项展开(hwnd, element_id, key_bytes, key_len, expanded)` | int | 底层直调 EU_PostSetListBoxItemExpanded：投递设置项展开。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 658 | `NE列表框_取项展开` | `NE列表框_取项展开(hwnd, element_id, key_bytes, key_len)` | int | 底层直调 EU_GetListBoxItemExpanded：取项展开。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 659 | `NE列表框_设置分组折叠` | `NE列表框_设置分组折叠(hwnd, element_id, group_bytes, group_len, collapsed)` | void | 底层直调 EU_SetListBoxGroupCollapsed：设置分组折叠。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 660 | `NE列表框_投递设置分组折叠` | `NE列表框_投递设置分组折叠(hwnd, element_id, group_bytes, group_len, collapsed)` | int | 底层直调 EU_PostSetListBoxGroupCollapsed：投递设置分组折叠。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 661 | `NE列表框_取分组折叠` | `NE列表框_取分组折叠(hwnd, element_id, group_bytes, group_len)` | int | 底层直调 EU_GetListBoxGroupCollapsed：取分组折叠。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 662 | `NE列表框_开始编辑` | `NE列表框_开始编辑(hwnd, element_id, index, field)` | int | 底层直调 EU_StartListBoxEdit：开始编辑。 |
| 663 | `NE列表框_投递开始编辑` | `NE列表框_投递开始编辑(hwnd, element_id, index, field)` | int | 底层直调 EU_PostStartListBoxEdit：投递开始编辑。 |
| 664 | `NE列表框_提交编辑` | `NE列表框_提交编辑(hwnd, element_id)` | int | 底层直调 EU_CommitListBoxEdit：提交编辑。 |
| 665 | `NE列表框_投递提交编辑` | `NE列表框_投递提交编辑(hwnd, element_id)` | int | 底层直调 EU_PostCommitListBoxEdit：投递提交编辑。 |
| 666 | `NE列表框_取消编辑` | `NE列表框_取消编辑(hwnd, element_id)` | void | 底层直调 EU_CancelListBoxEdit：取消编辑。 |
| 667 | `NE列表框_投递取消编辑` | `NE列表框_投递取消编辑(hwnd, element_id)` | int | 底层直调 EU_PostCancelListBoxEdit：投递取消编辑。 |
| 668 | `NE列表框_设置编辑选项` | `NE列表框_设置编辑选项(hwnd, element_id, editable_fields, commit_on_blur)` | void | 底层直调 EU_SetListBoxEditOptions：设置编辑选项。 |
| 669 | `NE列表框_投递设置编辑选项` | `NE列表框_投递设置编辑选项(hwnd, element_id, editable_fields, commit_on_blur)` | int | 底层直调 EU_PostSetListBoxEditOptions：投递设置编辑选项。 |
| 670 | `NE列表框_设置滚动` | `NE列表框_设置滚动(hwnd, element_id, scroll_y)` | void | 底层直调 EU_SetListBoxScroll：设置滚动。 |
| 671 | `NE列表框_投递设置滚动` | `NE列表框_投递设置滚动(hwnd, element_id, scroll_y)` | int | 底层直调 EU_PostSetListBoxScroll：投递设置滚动。 |
| 672 | `NE列表框_取滚动` | `NE列表框_取滚动(hwnd, element_id)` | int | 底层直调 EU_GetListBoxScroll：取滚动。 |
| 673 | `NE列表框_设置选项` | `NE列表框_设置选项(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | void | 底层直调 EU_SetListBoxOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 674 | `NE列表框_投递设置选项` | `NE列表框_投递设置选项(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | int | 底层直调 EU_PostSetListBoxOptions：投递设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 675 | `NE列表框_取选项` | `NE列表框_取选项(hwnd, element_id, selection_mode, size, bordered, zebra, compact, show_icons, show_desc, show_tags, tree_mode, group_mode, drag_sort)` | int | 底层直调 EU_GetListBoxOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 676 | `NE列表框_设置样式` | `NE列表框_设置样式(hwnd, element_id, row_height, indent_width, radius, padding_x, icon_width, scrollbar_width, align, selected_color, hover_color)` | void | 底层直调 EU_SetListBoxStyle：设置样式。 |
| 677 | `NE列表框_投递设置样式` | `NE列表框_投递设置样式(hwnd, element_id, row_height, indent_width, radius, padding_x, icon_width, scrollbar_width, align, selected_color, hover_color)` | int | 底层直调 EU_PostSetListBoxStyle：投递设置样式。 |
| 678 | `NE列表框_取完整状态` | `NE列表框_取完整状态(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetListBoxFullState：取完整状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 679 | `NE列表框_设置虚拟项数` | `NE列表框_设置虚拟项数(hwnd, element_id, count)` | void | 底层直调 EU_SetListBoxVirtualItemCount：设置虚拟项数。 |
| 680 | `NE列表框_投递设置虚拟项数` | `NE列表框_投递设置虚拟项数(hwnd, element_id, count)` | int | 底层直调 EU_PostSetListBoxVirtualItemCount：投递设置虚拟项数。 |
| 681 | `NE列表框_设置虚拟项数据源` | `NE列表框_设置虚拟项数据源(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxVirtualItemProvider：设置虚拟项数据源。 |
| 682 | `NE列表框_刷新虚拟项` | `NE列表框_刷新虚拟项(hwnd, element_id)` | void | 底层直调 EU_RefreshListBoxVirtualItems：刷新虚拟项。 |
| 683 | `NE列表框_投递刷新虚拟项` | `NE列表框_投递刷新虚拟项(hwnd, element_id)` | int | 底层直调 EU_PostRefreshListBoxVirtualItems：投递刷新虚拟项。 |
| 684 | `NE列表框_设置变化回调` | `NE列表框_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 685 | `NE列表框_设置项点击回调` | `NE列表框_设置项点击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxItemClickCallback：设置项点击回调。处理器实参必须写 &处理器名。 |
| 686 | `NE列表框_设置项双击回调` | `NE列表框_设置项双击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxItemDoubleClickCallback：设置项双击回调。处理器实参必须写 &处理器名。 |
| 687 | `NE列表框_设置编辑回调` | `NE列表框_设置编辑回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxEditCallback：设置编辑回调。处理器实参必须写 &处理器名。 |
| 688 | `NE列表框_设置拖拽排序回调` | `NE列表框_设置拖拽排序回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxReorderCallback：设置拖拽排序回调。处理器实参必须写 &处理器名。 |
| 689 | `NE列表框_设置右键菜单回调` | `NE列表框_设置右键菜单回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetListBoxContextMenuCallback：设置右键菜单回调。处理器实参必须写 &处理器名。 |
| 690 | `NE富列表_设置模板直调` | `NE富列表_设置模板直调(hwnd, element_id, bytes, len)` | int | NE富列表_设置模板 的底层直调版本：设置模板。一般请用高层封装 NE富列表_设置模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 691 | `NE富列表_投递设置模板直调` | `NE富列表_投递设置模板直调(hwnd, element_id, bytes, len)` | int | NE富列表_投递设置模板 的底层直调版本：投递设置模板。一般请用高层封装 NE富列表_投递设置模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 692 | `NE富列表_设置项` | `NE富列表_设置项(hwnd, element_id, bytes, len)` | int | 底层直调 EU_SetRichListItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 693 | `NE富列表_投递设置项` | `NE富列表_投递设置项(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetRichListItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 694 | `NE富列表_添加项` | `NE富列表_添加项(hwnd, element_id, bytes, len)` | int | 底层直调 EU_AddRichListItem：添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 695 | `NE富列表_投递添加项` | `NE富列表_投递添加项(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostAddRichListItem：投递添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 696 | `NE富列表_更新项` | `NE富列表_更新项(hwnd, element_id, key_bytes, key_len, item_bytes, item_len)` | int | 底层直调 EU_UpdateRichListItem：更新项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 697 | `NE富列表_投递更新项` | `NE富列表_投递更新项(hwnd, element_id, key_bytes, key_len, item_bytes, item_len)` | int | 底层直调 EU_PostUpdateRichListItem：投递更新项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 698 | `NE富列表_删除项` | `NE富列表_删除项(hwnd, element_id, key_bytes, key_len)` | int | 底层直调 EU_DeleteRichListItem：删除项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 699 | `NE富列表_投递删除项` | `NE富列表_投递删除项(hwnd, element_id, key_bytes, key_len)` | int | 底层直调 EU_PostDeleteRichListItem：投递删除项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 700 | `NE富列表_清空项` | `NE富列表_清空项(hwnd, element_id)` | int | 底层直调 EU_ClearRichListItems：清空项。 |
| 701 | `NE富列表_投递清空项` | `NE富列表_投递清空项(hwnd, element_id)` | int | 底层直调 EU_PostClearRichListItems：投递清空项。 |
| 702 | `NE富列表_取项数量` | `NE富列表_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetRichListItemCount：取项数量。 |
| 703 | `NE富列表_取模板直调` | `NE富列表_取模板直调(hwnd, element_id, buffer, buffer_size)` | int | NE富列表_取模板 的底层直调版本：取模板。一般请用高层封装 NE富列表_取模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 704 | `NE富列表_取项` | `NE富列表_取项(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetRichListItems：取项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 705 | `NE富列表_取指定项` | `NE富列表_取指定项(hwnd, element_id, index, buffer, buffer_size)` | int | 底层直调 EU_GetRichListItem：取指定项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 706 | `NE富列表_设置项覆盖` | `NE富列表_设置项覆盖(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | int | 底层直调 EU_SetRichListItemOverride：设置项覆盖。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 707 | `NE富列表_投递设置项覆盖` | `NE富列表_投递设置项覆盖(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | int | 底层直调 EU_PostSetRichListItemOverride：投递设置项覆盖。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 708 | `NE富列表_设置选中键直调` | `NE富列表_设置选中键直调(hwnd, element_id, bytes, len)` | int | NE富列表_设置选中键 的底层直调版本：设置选中键。一般请用高层封装 NE富列表_设置选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 709 | `NE富列表_投递设置选中键直调` | `NE富列表_投递设置选中键直调(hwnd, element_id, bytes, len)` | int | NE富列表_投递设置选中键 的底层直调版本：投递设置选中键。一般请用高层封装 NE富列表_投递设置选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 710 | `NE富列表_取选中键直调` | `NE富列表_取选中键直调(hwnd, element_id, buffer, buffer_size)` | int | NE富列表_取选中键 的底层直调版本：取选中键。一般请用高层封装 NE富列表_取选中键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 711 | `NE富列表_取选中项` | `NE富列表_取选中项(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetRichListSelectedItems：取选中项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 712 | `NE富列表_设置滚动` | `NE富列表_设置滚动(hwnd, element_id, scroll_y)` | void | 底层直调 EU_SetRichListScroll：设置滚动。 |
| 713 | `NE富列表_投递设置滚动` | `NE富列表_投递设置滚动(hwnd, element_id, scroll_y)` | int | 底层直调 EU_PostSetRichListScroll：投递设置滚动。 |
| 714 | `NE富列表_取滚动` | `NE富列表_取滚动(hwnd, element_id)` | int | 底层直调 EU_GetRichListScroll：取滚动。 |
| 715 | `NE富列表_设置选项` | `NE富列表_设置选项(hwnd, element_id, selection_mode, bordered, zebra, compact, keyboard_navigation, show_scrollbar)` | void | 底层直调 EU_SetRichListOptions：设置选项。 |
| 716 | `NE富列表_投递设置选项` | `NE富列表_投递设置选项(hwnd, element_id, selection_mode, bordered, zebra, compact, keyboard_navigation, show_scrollbar)` | int | 底层直调 EU_PostSetRichListOptions：投递设置选项。 |
| 717 | `NE富列表_取选项直调` | `NE富列表_取选项直调(hwnd, element_id, selection_mode, bordered, zebra, compact, keyboard_navigation, show_scrollbar)` | int | NE富列表_取选项 的底层直调版本：取选项。一般请用高层封装 NE富列表_取选项。 |
| 718 | `NE富列表_设置样式` | `NE富列表_设置样式(hwnd, element_id, row_height, padding_x, padding_y, scrollbar_width, align, selected_color, hover_color)` | void | 底层直调 EU_SetRichListStyle：设置样式。 |
| 719 | `NE富列表_投递设置样式` | `NE富列表_投递设置样式(hwnd, element_id, row_height, padding_x, padding_y, scrollbar_width, align, selected_color, hover_color)` | int | 底层直调 EU_PostSetRichListStyle：投递设置样式。 |
| 720 | `NE富列表_取样式直调` | `NE富列表_取样式直调(hwnd, element_id, row_height, padding_x, padding_y, scrollbar_width, align, selected_color, hover_color)` | int | NE富列表_取样式 的底层直调版本：取样式。一般请用高层封装 NE富列表_取样式。 |
| 721 | `NE富列表_设置虚拟项数` | `NE富列表_设置虚拟项数(hwnd, element_id, count)` | void | 底层直调 EU_SetRichListVirtualItemCount：设置虚拟项数。 |
| 722 | `NE富列表_投递设置虚拟项数` | `NE富列表_投递设置虚拟项数(hwnd, element_id, count)` | int | 底层直调 EU_PostSetRichListVirtualItemCount：投递设置虚拟项数。 |
| 723 | `NE富列表_设置虚拟项数据源` | `NE富列表_设置虚拟项数据源(hwnd, element_id, cb)` | void | 底层直调 EU_SetRichListVirtualItemProvider：设置虚拟项数据源。 |
| 724 | `NE富列表_刷新虚拟项` | `NE富列表_刷新虚拟项(hwnd, element_id)` | void | 底层直调 EU_RefreshRichListVirtualItems：刷新虚拟项。 |
| 725 | `NE富列表_投递刷新虚拟项` | `NE富列表_投递刷新虚拟项(hwnd, element_id)` | int | 底层直调 EU_PostRefreshRichListVirtualItems：投递刷新虚拟项。 |
| 726 | `NE富列表_设置事件回调` | `NE富列表_设置事件回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetRichListEventCallback：设置事件回调。处理器实参必须写 &处理器名。 |
| 727 | `NE富列表_设置变化回调` | `NE富列表_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetRichListChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 728 | `NE富列表_设置倒计时直调` | `NE富列表_设置倒计时直调(hwnd, element_id, key_bytes, key_len, node_bytes, node_len, target_unix_ms, format_bytes, format_len, paused)` | int | NE富列表_设置倒计时 的底层直调版本：设置倒计时。一般请用高层封装 NE富列表_设置倒计时。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 729 | `NE富列表_设置倒计时状态直调` | `NE富列表_设置倒计时状态直调(hwnd, element_id, key_bytes, key_len, node_bytes, node_len, paused)` | int | NE富列表_设置倒计时状态 的底层直调版本：设置倒计时状态。一般请用高层封装 NE富列表_设置倒计时状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 730 | `NE富列表_添加倒计时时间` | `NE富列表_添加倒计时时间(hwnd, element_id, key_bytes, key_len, node_bytes, node_len, delta_ms)` | int | 底层直调 EU_AddRichListCountdownTime：添加倒计时时间。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 731 | `NE富列表_取倒计时状态直调` | `NE富列表_取倒计时状态直调(hwnd, element_id, key_bytes, key_len, node_bytes, node_len, buffer, buffer_size)` | int | NE富列表_取倒计时状态 的底层直调版本：取倒计时状态。一般请用高层封装 NE富列表_取倒计时状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 732 | `NE卡片_设置标题直调` | `NE卡片_设置标题直调(hwnd, element_id, title_bytes, title_len)` | void | NE卡片_设置标题 的底层直调版本：设置标题。一般请用高层封装 NE卡片_设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 733 | `NE卡片_设置主体` | `NE卡片_设置主体(hwnd, element_id, body_bytes, body_len)` | void | 底层直调 EU_SetCardBody：设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 734 | `NE卡片_设置页脚` | `NE卡片_设置页脚(hwnd, element_id, footer_bytes, footer_len)` | void | 底层直调 EU_SetCardFooter：设置页脚。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 735 | `NE卡片_设置项` | `NE卡片_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetCardItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 736 | `NE卡片_设置动作` | `NE卡片_设置动作(hwnd, element_id, actions_bytes, actions_len)` | void | 底层直调 EU_SetCardActions：设置动作。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 737 | `NE卡片_取项数量` | `NE卡片_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetCardItemCount：取项数量。 |
| 738 | `NE卡片_取动作` | `NE卡片_取动作(hwnd, element_id)` | int | 底层直调 EU_GetCardAction：取动作。 |
| 739 | `NE卡片_重置动作` | `NE卡片_重置动作(hwnd, element_id)` | void | 底层直调 EU_ResetCardAction：重置动作。 |
| 740 | `NE卡片_设置阴影` | `NE卡片_设置阴影(hwnd, element_id, shadow)` | void | 底层直调 EU_SetCardShadow：设置阴影。 |
| 741 | `NE卡片_设置选项` | `NE卡片_设置选项(hwnd, element_id, shadow, hoverable)` | void | 底层直调 EU_SetCardOptions：设置选项。 |
| 742 | `NE卡片_设置样式` | `NE卡片_设置样式(hwnd, element_id, bg, border, border_width, radius, padding)` | void | 底层直调 EU_SetCardStyle：设置样式。 |
| 743 | `NE卡片_取样式` | `NE卡片_取样式(hwnd, element_id, bg, border, border_width, radius, padding)` | int | 底层直调 EU_GetCardStyle：取样式。 |
| 744 | `NE卡片_设置主体样式` | `NE卡片_设置主体样式(hwnd, element_id, pad_left, pad_top, pad_right, pad_bottom, font_size, item_gap, item_padding_y, divider)` | void | 底层直调 EU_SetCardBodyStyle：设置主体样式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 745 | `NE卡片_取主体样式` | `NE卡片_取主体样式(hwnd, element_id, pad_left, pad_top, pad_right, pad_bottom, font_size, item_gap, item_padding_y, divider)` | int | 底层直调 EU_GetCardBodyStyle：取主体样式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 746 | `NE卡片_取选项` | `NE卡片_取选项(hwnd, element_id, shadow, hoverable, action_count)` | int | 底层直调 EU_GetCardOptions：取选项。 |
| 747 | `NE折叠面板_设置项` | `NE折叠面板_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetCollapseItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 748 | `NE折叠面板_设置项扩展` | `NE折叠面板_设置项扩展(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetCollapseItemsEx：设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 749 | `NE折叠面板_设置活动` | `NE折叠面板_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetCollapseActive：设置活动。 |
| 750 | `NE折叠面板_取活动` | `NE折叠面板_取活动(hwnd, element_id)` | int | 底层直调 EU_GetCollapseActive：取活动。 |
| 751 | `NE折叠面板_设置活动项` | `NE折叠面板_设置活动项(hwnd, element_id, indices_bytes, indices_len)` | void | 底层直调 EU_SetCollapseActiveItems：设置活动项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 752 | `NE折叠面板_取活动项` | `NE折叠面板_取活动项(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetCollapseActiveItems：取活动项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 753 | `NE折叠面板_取项数量` | `NE折叠面板_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetCollapseItemCount：取项数量。 |
| 754 | `NE折叠面板_设置选项` | `NE折叠面板_设置选项(hwnd, element_id, accordion, allow_collapse, disabled_bytes, disabled_len)` | void | 底层直调 EU_SetCollapseOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 755 | `NE折叠面板_设置高级选项` | `NE折叠面板_设置高级选项(hwnd, element_id, accordion, allow_collapse, animated, disabled_bytes, disabled_len)` | void | 底层直调 EU_SetCollapseAdvancedOptions：设置高级选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 756 | `NE折叠面板_取选项` | `NE折叠面板_取选项(hwnd, element_id, accordion, allow_collapse, animated, disabled_count)` | int | 底层直调 EU_GetCollapseOptions：取选项。 |
| 757 | `NE折叠面板_取状态JSON` | `NE折叠面板_取状态JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetCollapseStateJson：取状态JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 758 | `NE折叠面板_设置变化回调` | `NE折叠面板_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetCollapseChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 759 | `NE时间线_设置项` | `NE时间线_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetTimelineItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 760 | `NE时间线_设置选项` | `NE时间线_设置选项(hwnd, element_id, position, show_time)` | void | 底层直调 EU_SetTimelineOptions：设置选项。 |
| 761 | `NE时间线_取项数量` | `NE时间线_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetTimelineItemCount：取项数量。 |
| 762 | `NE时间线_取选项` | `NE时间线_取选项(hwnd, element_id, position, show_time)` | int | 底层直调 EU_GetTimelineOptions：取选项。 |
| 763 | `NE时间线_设置高级选项` | `NE时间线_设置高级选项(hwnd, element_id, position, show_time, reverse, default_placement)` | void | 底层直调 EU_SetTimelineAdvancedOptions：设置高级选项。 |
| 764 | `NE时间线_取高级选项` | `NE时间线_取高级选项(hwnd, element_id, position, show_time, reverse, default_placement)` | int | 底层直调 EU_GetTimelineAdvancedOptions：取高级选项。 |
| 765 | `NE统计数值_设置值` | `NE统计数值_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetStatisticValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 766 | `NE统计数值_投递设置值` | `NE统计数值_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetStatisticValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 767 | `NE统计数值_设置格式` | `NE统计数值_设置格式(hwnd, element_id, title_bytes, title_len, prefix_bytes, prefix_len, suffix_bytes, suffix_len)` | void | 底层直调 EU_SetStatisticFormat：设置格式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 768 | `NE统计数值_设置选项` | `NE统计数值_设置选项(hwnd, element_id, precision, animated)` | void | 底层直调 EU_SetStatisticOptions：设置选项。 |
| 769 | `NE统计数值_取选项` | `NE统计数值_取选项(hwnd, element_id, precision, animated)` | int | 底层直调 EU_GetStatisticOptions：取选项。 |
| 770 | `NE统计数值_设置数字格式选项` | `NE统计数值_设置数字格式选项(hwnd, element_id, precision, animated, use_group_separator, group_separator_bytes, group_separator_len, decimal_separator_bytes, decimal_separator_len)` | void | 底层直调 EU_SetStatisticNumberOptions：设置数字格式选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 771 | `NE统计数值_设置前后缀选项` | `NE统计数值_设置前后缀选项(hwnd, element_id, prefix_bytes, prefix_len, suffix_bytes, suffix_len, prefix_color, suffix_color, value_color, suffix_clickable)` | void | 底层直调 EU_SetStatisticAffixOptions：设置前后缀选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 772 | `NE统计数值_设置显示文本` | `NE统计数值_设置显示文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetStatisticDisplayText：设置显示文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 773 | `NE统计数值_设置倒计时` | `NE统计数值_设置倒计时(hwnd, element_id, target_unix_ms, format_bytes, format_len)` | void | 底层直调 EU_SetStatisticCountdown：设置倒计时。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 774 | `NE统计数值_设置倒计时状态` | `NE统计数值_设置倒计时状态(hwnd, element_id, paused)` | void | 底层直调 EU_SetStatisticCountdownState：设置倒计时状态。 |
| 775 | `NE统计数值_添加倒计时时间` | `NE统计数值_添加倒计时时间(hwnd, element_id, delta_ms)` | void | 底层直调 EU_AddStatisticCountdownTime：添加倒计时时间。 |
| 776 | `NE统计数值_设置完成回调` | `NE统计数值_设置完成回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetStatisticFinishCallback：设置完成回调。处理器实参必须写 &处理器名。 |
| 777 | `NE统计数值_设置后缀点击回调` | `NE统计数值_设置后缀点击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetStatisticSuffixClickCallback：设置后缀点击回调。处理器实参必须写 &处理器名。 |
| 778 | `NE统计数值_取完整状态` | `NE统计数值_取完整状态(hwnd, element_id, mode, precision, animated, use_group_separator, countdown_paused, countdown_finished, suffix_click_count, remaining_ms)` | int | 底层直调 EU_GetStatisticFullState：取完整状态。 |
| 779 | `NEKPI卡片_设置数据` | `NEKPI卡片_设置数据(hwnd, element_id, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type)` | void | 底层直调 EU_SetKpiCardData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 780 | `NEKPI卡片_投递设置数据` | `NEKPI卡片_投递设置数据(hwnd, element_id, value_bytes, value_len, subtitle_bytes, subtitle_len, trend_bytes, trend_len, trend_type)` | int | 底层直调 EU_PostSetKpiCardData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 781 | `NEKPI卡片_设置选项` | `NEKPI卡片_设置选项(hwnd, element_id, loading, helper_bytes, helper_len)` | void | 底层直调 EU_SetKpiCardOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 782 | `NEKPI卡片_取选项` | `NEKPI卡片_取选项(hwnd, element_id, loading, trend_type)` | int | 底层直调 EU_GetKpiCardOptions：取选项。 |
| 783 | `NE趋势_设置数据` | `NE趋势_设置数据(hwnd, element_id, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction)` | void | 底层直调 EU_SetTrendData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 784 | `NE趋势_投递设置数据` | `NE趋势_投递设置数据(hwnd, element_id, value_bytes, value_len, percent_bytes, percent_len, detail_bytes, detail_len, direction)` | int | 底层直调 EU_PostSetTrendData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 785 | `NE趋势_设置选项` | `NE趋势_设置选项(hwnd, element_id, inverse, show_icon)` | void | 底层直调 EU_SetTrendOptions：设置选项。 |
| 786 | `NE趋势_取方向` | `NE趋势_取方向(hwnd, element_id)` | int | 底层直调 EU_GetTrendDirection：取方向。 |
| 787 | `NE趋势_取选项` | `NE趋势_取选项(hwnd, element_id, inverse, show_icon)` | int | 底层直调 EU_GetTrendOptions：取选项。 |
| 788 | `NE状态点_设置` | `NE状态点_设置(hwnd, element_id, label_bytes, label_len, desc_bytes, desc_len, status)` | void | 底层直调 EU_SetStatusDot：设置。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 789 | `NE状态点_投递设置` | `NE状态点_投递设置(hwnd, element_id, label_bytes, label_len, desc_bytes, desc_len, status)` | int | 底层直调 EU_PostSetStatusDot：投递设置。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 790 | `NE状态点_设置选项` | `NE状态点_设置选项(hwnd, element_id, pulse, compact)` | void | 底层直调 EU_SetStatusDotOptions：设置选项。 |
| 791 | `NE状态点_取状态` | `NE状态点_取状态(hwnd, element_id)` | int | 底层直调 EU_GetStatusDotStatus：取状态。 |
| 792 | `NE状态点_取选项` | `NE状态点_取选项(hwnd, element_id, pulse, compact)` | int | 底层直调 EU_GetStatusDotOptions：取选项。 |
| 793 | `NE仪表盘_设置值` | `NE仪表盘_设置值(hwnd, element_id, value, caption_bytes, caption_len, status)` | void | 底层直调 EU_SetGaugeValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 794 | `NE仪表盘_投递设置值` | `NE仪表盘_投递设置值(hwnd, element_id, value, caption_bytes, caption_len, status)` | int | 底层直调 EU_PostSetGaugeValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 795 | `NE仪表盘_设置选项` | `NE仪表盘_设置选项(hwnd, element_id, min_value, max_value, warning_value, danger_value, stroke_width)` | void | 底层直调 EU_SetGaugeOptions：设置选项。 |
| 796 | `NE仪表盘_取值` | `NE仪表盘_取值(hwnd, element_id)` | int | 底层直调 EU_GetGaugeValue：取值。 |
| 797 | `NE仪表盘_取状态` | `NE仪表盘_取状态(hwnd, element_id)` | int | 底层直调 EU_GetGaugeStatus：取状态。 |
| 798 | `NE仪表盘_取选项` | `NE仪表盘_取选项(hwnd, element_id, min_value, max_value, warning_value, danger_value, stroke_width)` | int | 底层直调 EU_GetGaugeOptions：取选项。 |
| 799 | `NE环形进度_设置值` | `NE环形进度_设置值(hwnd, element_id, value, label_bytes, label_len, status)` | void | 底层直调 EU_SetRingProgressValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 800 | `NE环形进度_投递设置值` | `NE环形进度_投递设置值(hwnd, element_id, value, label_bytes, label_len, status)` | int | 底层直调 EU_PostSetRingProgressValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 801 | `NE环形进度_设置选项` | `NE环形进度_设置选项(hwnd, element_id, stroke_width, show_center)` | void | 底层直调 EU_SetRingProgressOptions：设置选项。 |
| 802 | `NE环形进度_取值` | `NE环形进度_取值(hwnd, element_id)` | int | 底层直调 EU_GetRingProgressValue：取值。 |
| 803 | `NE环形进度_取状态` | `NE环形进度_取状态(hwnd, element_id)` | int | 底层直调 EU_GetRingProgressStatus：取状态。 |
| 804 | `NE环形进度_取选项` | `NE环形进度_取选项(hwnd, element_id, stroke_width, show_center)` | int | 底层直调 EU_GetRingProgressOptions：取选项。 |
| 805 | `NE子弹进度_设置值` | `NE子弹进度_设置值(hwnd, element_id, value, target, desc_bytes, desc_len, status)` | void | 底层直调 EU_SetBulletProgressValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 806 | `NE子弹进度_投递设置值` | `NE子弹进度_投递设置值(hwnd, element_id, value, target, desc_bytes, desc_len, status)` | int | 底层直调 EU_PostSetBulletProgressValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 807 | `NE子弹进度_设置选项` | `NE子弹进度_设置选项(hwnd, element_id, good_threshold, warn_threshold, show_target)` | void | 底层直调 EU_SetBulletProgressOptions：设置选项。 |
| 808 | `NE子弹进度_取值` | `NE子弹进度_取值(hwnd, element_id)` | int | 底层直调 EU_GetBulletProgressValue：取值。 |
| 809 | `NE子弹进度_取目标` | `NE子弹进度_取目标(hwnd, element_id)` | int | 底层直调 EU_GetBulletProgressTarget：取目标。 |
| 810 | `NE子弹进度_取状态` | `NE子弹进度_取状态(hwnd, element_id)` | int | 底层直调 EU_GetBulletProgressStatus：取状态。 |
| 811 | `NE子弹进度_取选项` | `NE子弹进度_取选项(hwnd, element_id, good_threshold, warn_threshold, show_target)` | int | 底层直调 EU_GetBulletProgressOptions：取选项。 |
| 812 | `NE折线图_设置数据` | `NE折线图_设置数据(hwnd, element_id, points_bytes, points_len)` | void | 底层直调 EU_SetLineChartData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 813 | `NE折线图_投递设置数据` | `NE折线图_投递设置数据(hwnd, element_id, points_bytes, points_len)` | int | 底层直调 EU_PostSetLineChartData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 814 | `NE折线图_设置系列` | `NE折线图_设置系列(hwnd, element_id, series_bytes, series_len)` | void | 底层直调 EU_SetLineChartSeries：设置系列。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 815 | `NE折线图_设置选项` | `NE折线图_设置选项(hwnd, element_id, chart_style, show_axis, show_area, show_tooltip)` | void | 底层直调 EU_SetLineChartOptions：设置选项。 |
| 816 | `NE折线图_设置选中` | `NE折线图_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetLineChartSelected：设置选中。 |
| 817 | `NE折线图_投递设置选中` | `NE折线图_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetLineChartSelected：投递设置选中。 |
| 818 | `NE折线图_取点数量` | `NE折线图_取点数量(hwnd, element_id)` | int | 底层直调 EU_GetLineChartPointCount：取点数量。 |
| 819 | `NE折线图_取系列数量` | `NE折线图_取系列数量(hwnd, element_id)` | int | 底层直调 EU_GetLineChartSeriesCount：取系列数量。 |
| 820 | `NE折线图_取选中` | `NE折线图_取选中(hwnd, element_id)` | int | 底层直调 EU_GetLineChartSelected：取选中。 |
| 821 | `NE折线图_取选项` | `NE折线图_取选项(hwnd, element_id, chart_style, show_axis, show_area, show_tooltip)` | int | 底层直调 EU_GetLineChartOptions：取选项。 |
| 822 | `NE柱状图_设置数据` | `NE柱状图_设置数据(hwnd, element_id, bars_bytes, bars_len)` | void | 底层直调 EU_SetBarChartData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 823 | `NE柱状图_投递设置数据` | `NE柱状图_投递设置数据(hwnd, element_id, bars_bytes, bars_len)` | int | 底层直调 EU_PostSetBarChartData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 824 | `NE柱状图_设置系列` | `NE柱状图_设置系列(hwnd, element_id, series_bytes, series_len)` | void | 底层直调 EU_SetBarChartSeries：设置系列。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 825 | `NE柱状图_设置选项` | `NE柱状图_设置选项(hwnd, element_id, orientation, show_values, show_axis)` | void | 底层直调 EU_SetBarChartOptions：设置选项。 |
| 826 | `NE柱状图_设置选中` | `NE柱状图_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetBarChartSelected：设置选中。 |
| 827 | `NE柱状图_投递设置选中` | `NE柱状图_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetBarChartSelected：投递设置选中。 |
| 828 | `NE柱状图_取柱数量` | `NE柱状图_取柱数量(hwnd, element_id)` | int | 底层直调 EU_GetBarChartBarCount：取柱数量。 |
| 829 | `NE柱状图_取系列数量` | `NE柱状图_取系列数量(hwnd, element_id)` | int | 底层直调 EU_GetBarChartSeriesCount：取系列数量。 |
| 830 | `NE柱状图_取选中` | `NE柱状图_取选中(hwnd, element_id)` | int | 底层直调 EU_GetBarChartSelected：取选中。 |
| 831 | `NE柱状图_取选项` | `NE柱状图_取选项(hwnd, element_id, orientation, show_values, show_axis)` | int | 底层直调 EU_GetBarChartOptions：取选项。 |
| 832 | `NE环形图_设置数据` | `NE环形图_设置数据(hwnd, element_id, slices_bytes, slices_len, active_index)` | void | 底层直调 EU_SetDonutChartData：设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 833 | `NE环形图_投递设置数据` | `NE环形图_投递设置数据(hwnd, element_id, slices_bytes, slices_len, active_index)` | int | 底层直调 EU_PostSetDonutChartData：投递设置数据。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 834 | `NE环形图_设置选项` | `NE环形图_设置选项(hwnd, element_id, show_legend, ring_width)` | void | 底层直调 EU_SetDonutChartOptions：设置选项。 |
| 835 | `NE环形图_设置高级选项` | `NE环形图_设置高级选项(hwnd, element_id, show_legend, ring_width, show_labels)` | void | 底层直调 EU_SetDonutChartAdvancedOptions：设置高级选项。 |
| 836 | `NE环形图_设置活动` | `NE环形图_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetDonutChartActive：设置活动。 |
| 837 | `NE环形图_投递设置活动` | `NE环形图_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetDonutChartActive：投递设置活动。 |
| 838 | `NE环形图_取扇区数量` | `NE环形图_取扇区数量(hwnd, element_id)` | int | 底层直调 EU_GetDonutChartSliceCount：取扇区数量。 |
| 839 | `NE环形图_取活动` | `NE环形图_取活动(hwnd, element_id)` | int | 底层直调 EU_GetDonutChartActive：取活动。 |
| 840 | `NE环形图_取选项` | `NE环形图_取选项(hwnd, element_id, show_legend, ring_width)` | int | 底层直调 EU_GetDonutChartOptions：取选项。 |
| 841 | `NE环形图_取高级选项` | `NE环形图_取高级选项(hwnd, element_id, show_legend, ring_width, show_labels)` | int | 底层直调 EU_GetDonutChartAdvancedOptions：取高级选项。 |
| 842 | `NE日历_设置日期` | `NE日历_设置日期(hwnd, element_id, year, month, selected_day)` | void | 底层直调 EU_SetCalendarDate：设置日期。 |
| 843 | `NE日历_设置范围` | `NE日历_设置范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | void | 底层直调 EU_SetCalendarRange：设置范围。 |
| 844 | `NE日历_设置选项` | `NE日历_设置选项(hwnd, element_id, today_yyyymmdd, show_today)` | void | 底层直调 EU_SetCalendarOptions：设置选项。 |
| 845 | `NE日历_移动月份` | `NE日历_移动月份(hwnd, element_id, delta_months)` | void | 底层直调 EU_CalendarMoveMonth：移动月份。 |
| 846 | `NE日历_取值` | `NE日历_取值(hwnd, element_id)` | int | 底层直调 EU_GetCalendarValue：取值。 |
| 847 | `NE日历_取范围` | `NE日历_取范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | int | 底层直调 EU_GetCalendarRange：取范围。 |
| 848 | `NE日历_取选项` | `NE日历_取选项(hwnd, element_id, today_yyyymmdd, show_today)` | int | 底层直调 EU_GetCalendarOptions：取选项。 |
| 849 | `NE日历_设置选择范围` | `NE日历_设置选择范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | void | 底层直调 EU_SetCalendarSelectionRange：设置选择范围。 |
| 850 | `NE日历_取选择范围` | `NE日历_取选择范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | int | 底层直调 EU_GetCalendarSelectionRange：取选择范围。 |
| 851 | `NE日历_设置显示范围` | `NE日历_设置显示范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd)` | void | 底层直调 EU_SetCalendarDisplayRange：设置显示范围。 |
| 852 | `NE日历_取显示范围` | `NE日历_取显示范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd)` | int | 底层直调 EU_GetCalendarDisplayRange：取显示范围。 |
| 853 | `NE日历_设置单元格内容` | `NE日历_设置单元格内容(hwnd, element_id, spec_bytes, spec_len)` | void | 底层直调 EU_SetCalendarCellItems：设置单元格内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 854 | `NE日历_取单元格内容` | `NE日历_取单元格内容(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetCalendarCellItems：取单元格内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 855 | `NE日历_清空单元格内容` | `NE日历_清空单元格内容(hwnd, element_id)` | void | 底层直调 EU_ClearCalendarCellItems：清空单元格内容。 |
| 856 | `NE日历_设置视觉选项` | `NE日历_设置视觉选项(hwnd, element_id, show_header, show_week_header, label_mode, show_adjacent_days, cell_radius)` | void | 底层直调 EU_SetCalendarVisualOptions：设置视觉选项。 |
| 857 | `NE日历_取视觉选项` | `NE日历_取视觉选项(hwnd, element_id, show_header, show_week_header, label_mode, show_adjacent_days, cell_radius)` | int | 底层直调 EU_GetCalendarVisualOptions：取视觉选项。 |
| 858 | `NE日历_设置状态配色` | `NE日历_设置状态配色(hwnd, element_id, selected_bg, selected_fg, range_bg, today_border, hover_bg, disabled_fg, adjacent_fg)` | void | 底层直调 EU_SetCalendarStateColors：设置状态配色。 |
| 859 | `NE日历_取状态配色` | `NE日历_取状态配色(hwnd, element_id, selected_bg, selected_fg, range_bg, today_border, hover_bg, disabled_fg, adjacent_fg)` | int | 底层直调 EU_GetCalendarStateColors：取状态配色。 |
| 860 | `NE日历_设置选中标记` | `NE日历_设置选中标记(hwnd, element_id, marker_bytes, marker_len)` | void | 底层直调 EU_SetCalendarSelectedMarker：设置选中标记。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 861 | `NE日历_设置变化回调` | `NE日历_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetCalendarChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 862 | `NE树_设置项` | `NE树_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetTreeItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 863 | `NE树_投递设置项` | `NE树_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetTreeItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 864 | `NE树_设置选中` | `NE树_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetTreeSelected：设置选中。 |
| 865 | `NE树_投递设置选中` | `NE树_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetTreeSelected：投递设置选中。 |
| 866 | `NE树_取选中` | `NE树_取选中(hwnd, element_id)` | int | 底层直调 EU_GetTreeSelected：取选中。 |
| 867 | `NE树_设置选项` | `NE树_设置选项(hwnd, element_id, show_checkbox, keyboard_navigation, lazy_mode)` | void | 底层直调 EU_SetTreeOptions：设置选项。 |
| 868 | `NE树_取选项` | `NE树_取选项(hwnd, element_id, show_checkbox, keyboard_navigation, lazy_mode, checked_count, last_lazy_index)` | int | 底层直调 EU_GetTreeOptions：取选项。 |
| 869 | `NE树_设置项展开` | `NE树_设置项展开(hwnd, element_id, item_index, expanded)` | void | 底层直调 EU_SetTreeItemExpanded：设置项展开。 |
| 870 | `NE树_投递设置项展开` | `NE树_投递设置项展开(hwnd, element_id, item_index, expanded)` | int | 底层直调 EU_PostSetTreeItemExpanded：投递设置项展开。 |
| 871 | `NE树_切换项展开` | `NE树_切换项展开(hwnd, element_id, item_index)` | void | 底层直调 EU_ToggleTreeItemExpanded：切换项展开。 |
| 872 | `NE树_取项展开` | `NE树_取项展开(hwnd, element_id, item_index)` | int | 底层直调 EU_GetTreeItemExpanded：取项展开。 |
| 873 | `NE树_设置项勾选` | `NE树_设置项勾选(hwnd, element_id, item_index, checked)` | void | 底层直调 EU_SetTreeItemChecked：设置项勾选。 |
| 874 | `NE树_投递设置项勾选` | `NE树_投递设置项勾选(hwnd, element_id, item_index, checked)` | int | 底层直调 EU_PostSetTreeItemChecked：投递设置项勾选。 |
| 875 | `NE树_取项勾选` | `NE树_取项勾选(hwnd, element_id, item_index)` | int | 底层直调 EU_GetTreeItemChecked：取项勾选。 |
| 876 | `NE树_设置项懒加载` | `NE树_设置项懒加载(hwnd, element_id, item_index, lazy)` | void | 底层直调 EU_SetTreeItemLazy：设置项懒加载。 |
| 877 | `NE树_取项懒加载` | `NE树_取项懒加载(hwnd, element_id, item_index)` | int | 底层直调 EU_GetTreeItemLazy：取项懒加载。 |
| 878 | `NE树_取可见数量` | `NE树_取可见数量(hwnd, element_id)` | int | 底层直调 EU_GetTreeVisibleCount：取可见数量。 |
| 879 | `NE树选择_设置项` | `NE树选择_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetTreeSelectItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 880 | `NE树选择_投递设置项` | `NE树选择_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetTreeSelectItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 881 | `NE树选择_设置选中` | `NE树选择_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetTreeSelectSelected：设置选中。 |
| 882 | `NE树选择_投递设置选中` | `NE树选择_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetTreeSelectSelected：投递设置选中。 |
| 883 | `NE树选择_取选中` | `NE树选择_取选中(hwnd, element_id)` | int | 底层直调 EU_GetTreeSelectSelected：取选中。 |
| 884 | `NE树选择_设置打开` | `NE树选择_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetTreeSelectOpen：设置打开。 |
| 885 | `NE树选择_投递设置打开` | `NE树选择_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetTreeSelectOpen：投递设置打开。 |
| 886 | `NE树选择_取打开` | `NE树选择_取打开(hwnd, element_id)` | int | 底层直调 EU_GetTreeSelectOpen：取打开。 |
| 887 | `NE树选择_设置选项` | `NE树选择_设置选项(hwnd, element_id, multiple, clearable, searchable)` | void | 底层直调 EU_SetTreeSelectOptions：设置选项。 |
| 888 | `NE树选择_取选项` | `NE树选择_取选项(hwnd, element_id, multiple, clearable, searchable, selected_count, matched_count)` | int | 底层直调 EU_GetTreeSelectOptions：取选项。 |
| 889 | `NE树选择_设置搜索` | `NE树选择_设置搜索(hwnd, element_id, search_bytes, search_len)` | void | 底层直调 EU_SetTreeSelectSearch：设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 890 | `NE树选择_投递设置搜索` | `NE树选择_投递设置搜索(hwnd, element_id, search_bytes, search_len)` | int | 底层直调 EU_PostSetTreeSelectSearch：投递设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 891 | `NE树选择_取搜索` | `NE树选择_取搜索(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeSelectSearch：取搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 892 | `NE树选择_清空` | `NE树选择_清空(hwnd, element_id)` | void | 底层直调 EU_ClearTreeSelect：清空。 |
| 893 | `NE树选择_设置选中项` | `NE树选择_设置选中项(hwnd, element_id, indices_bytes, indices_len)` | void | 底层直调 EU_SetTreeSelectSelectedItems：设置选中项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 894 | `NE树选择_取选中数量` | `NE树选择_取选中数量(hwnd, element_id)` | int | 底层直调 EU_GetTreeSelectSelectedCount：取选中数量。 |
| 895 | `NE树选择_取选中项` | `NE树选择_取选中项(hwnd, element_id, position)` | int | 底层直调 EU_GetTreeSelectSelectedItem：取选中项。 |
| 896 | `NE树选择_设置项展开` | `NE树选择_设置项展开(hwnd, element_id, item_index, expanded)` | void | 底层直调 EU_SetTreeSelectItemExpanded：设置项展开。 |
| 897 | `NE树选择_切换项展开` | `NE树选择_切换项展开(hwnd, element_id, item_index)` | void | 底层直调 EU_ToggleTreeSelectItemExpanded：切换项展开。 |
| 898 | `NE树选择_取项展开` | `NE树选择_取项展开(hwnd, element_id, item_index)` | int | 底层直调 EU_GetTreeSelectItemExpanded：取项展开。 |
| 899 | `NE树_设置数据JSON` | `NE树_设置数据JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeDataJson：设置数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 900 | `NE树_投递设置数据JSON` | `NE树_投递设置数据JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeDataJson：投递设置数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 901 | `NE树_取数据JSON` | `NE树_取数据JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeDataJson：取数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 902 | `NE树_设置选项JSON` | `NE树_设置选项JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeOptionsJson：设置选项JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 903 | `NE树_取状态JSON` | `NE树_取状态JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeStateJson：取状态JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 904 | `NE树_设置勾选键JSON` | `NE树_设置勾选键JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeCheckedKeysJson：设置勾选键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 905 | `NE树_投递设置勾选键JSON` | `NE树_投递设置勾选键JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeCheckedKeysJson：投递设置勾选键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 906 | `NE树_取勾选键JSON` | `NE树_取勾选键JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeCheckedKeysJson：取勾选键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 907 | `NE树_设置展开键JSON` | `NE树_设置展开键JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeExpandedKeysJson：设置展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 908 | `NE树_投递设置展开键JSON` | `NE树_投递设置展开键JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeExpandedKeysJson：投递设置展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 909 | `NE树_取展开键JSON` | `NE树_取展开键JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeExpandedKeysJson：取展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 910 | `NE树_追加节点JSON` | `NE树_追加节点JSON(hwnd, element_id, parent_key_bytes, parent_key_len, json_bytes, json_len)` | void | 底层直调 EU_AppendTreeNodeJson：追加节点JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 911 | `NE树_更新节点JSON` | `NE树_更新节点JSON(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | void | 底层直调 EU_UpdateTreeNodeJson：更新节点JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 912 | `NE树_移除节点` | `NE树_移除节点(hwnd, element_id, key_bytes, key_len)` | void | 底层直调 EU_RemoveTreeNodeByKey：移除节点。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 913 | `NE树_设置节点事件回调` | `NE树_设置节点事件回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeNodeEventCallback：设置节点事件回调。处理器实参必须写 &处理器名。 |
| 914 | `NE树_设置懒加载回调` | `NE树_设置懒加载回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeLazyLoadCallback：设置懒加载回调。处理器实参必须写 &处理器名。 |
| 915 | `NE树_设置拖拽回调` | `NE树_设置拖拽回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeDragCallback：设置拖拽回调。处理器实参必须写 &处理器名。 |
| 916 | `NE树_设置允许拖拽判定回调` | `NE树_设置允许拖拽判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeAllowDragCallback：设置允许拖拽判定回调。处理器实参必须写 &处理器名。 |
| 917 | `NE树_设置允许拖放判定回调` | `NE树_设置允许拖放判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeAllowDropCallback：设置允许拖放判定回调。处理器实参必须写 &处理器名。 |
| 918 | `NE树选择_设置数据JSON` | `NE树选择_设置数据JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeSelectDataJson：设置数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 919 | `NE树选择_投递设置数据JSON` | `NE树选择_投递设置数据JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeSelectDataJson：投递设置数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 920 | `NE树选择_取数据JSON` | `NE树选择_取数据JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeSelectDataJson：取数据JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 921 | `NE树选择_设置选项JSON` | `NE树选择_设置选项JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeSelectOptionsJson：设置选项JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 922 | `NE树选择_取状态JSON` | `NE树选择_取状态JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeSelectStateJson：取状态JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 923 | `NE树选择_设置选中键JSON` | `NE树选择_设置选中键JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeSelectSelectedKeysJson：设置选中键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 924 | `NE树选择_投递设置选中键JSON` | `NE树选择_投递设置选中键JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeSelectSelectedKeysJson：投递设置选中键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 925 | `NE树选择_取选中键JSON` | `NE树选择_取选中键JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeSelectSelectedKeysJson：取选中键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 926 | `NE树选择_设置展开键JSON` | `NE树选择_设置展开键JSON(hwnd, element_id, json_bytes, json_len)` | void | 底层直调 EU_SetTreeSelectExpandedKeysJson：设置展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 927 | `NE树选择_投递设置展开键JSON` | `NE树选择_投递设置展开键JSON(hwnd, element_id, json_bytes, json_len)` | int | 底层直调 EU_PostSetTreeSelectExpandedKeysJson：投递设置展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 928 | `NE树选择_取展开键JSON` | `NE树选择_取展开键JSON(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTreeSelectExpandedKeysJson：取展开键JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 929 | `NE树选择_追加节点JSON` | `NE树选择_追加节点JSON(hwnd, element_id, parent_key_bytes, parent_key_len, json_bytes, json_len)` | void | 底层直调 EU_AppendTreeSelectNodeJson：追加节点JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 930 | `NE树选择_更新节点JSON` | `NE树选择_更新节点JSON(hwnd, element_id, key_bytes, key_len, json_bytes, json_len)` | void | 底层直调 EU_UpdateTreeSelectNodeJson：更新节点JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 931 | `NE树选择_移除节点` | `NE树选择_移除节点(hwnd, element_id, key_bytes, key_len)` | void | 底层直调 EU_RemoveTreeSelectNodeByKey：移除节点。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 932 | `NE树选择_设置节点事件回调` | `NE树选择_设置节点事件回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeSelectNodeEventCallback：设置节点事件回调。处理器实参必须写 &处理器名。 |
| 933 | `NE树选择_设置懒加载回调` | `NE树选择_设置懒加载回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeSelectLazyLoadCallback：设置懒加载回调。处理器实参必须写 &处理器名。 |
| 934 | `NE树选择_设置拖拽回调` | `NE树选择_设置拖拽回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeSelectDragCallback：设置拖拽回调。处理器实参必须写 &处理器名。 |
| 935 | `NE树选择_设置允许拖拽判定回调` | `NE树选择_设置允许拖拽判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeSelectAllowDragCallback：设置允许拖拽判定回调。处理器实参必须写 &处理器名。 |
| 936 | `NE树选择_设置允许拖放判定回调` | `NE树选择_设置允许拖放判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTreeSelectAllowDropCallback：设置允许拖放判定回调。处理器实参必须写 &处理器名。 |
| 937 | `NE穿梭框_设置项` | `NE穿梭框_设置项(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 938 | `NE穿梭框_投递设置项` | `NE穿梭框_投递设置项(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | int | 底层直调 EU_PostSetTransferItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 939 | `NE穿梭框_移到右侧` | `NE穿梭框_移到右侧(hwnd, element_id)` | void | 底层直调 EU_TransferMoveRight：移到右侧。 |
| 940 | `NE穿梭框_移到左侧` | `NE穿梭框_移到左侧(hwnd, element_id)` | void | 底层直调 EU_TransferMoveLeft：移到左侧。 |
| 941 | `NE穿梭框_全部移到右侧` | `NE穿梭框_全部移到右侧(hwnd, element_id)` | void | 底层直调 EU_TransferMoveAllRight：全部移到右侧。 |
| 942 | `NE穿梭框_全部移到左侧` | `NE穿梭框_全部移到左侧(hwnd, element_id)` | void | 底层直调 EU_TransferMoveAllLeft：全部移到左侧。 |
| 943 | `NE穿梭框_设置选中` | `NE穿梭框_设置选中(hwnd, element_id, side, selected_index)` | void | 底层直调 EU_SetTransferSelected：设置选中。 |
| 944 | `NE穿梭框_投递设置选中` | `NE穿梭框_投递设置选中(hwnd, element_id, side, selected_index)` | int | 底层直调 EU_PostSetTransferSelected：投递设置选中。 |
| 945 | `NE穿梭框_取选中` | `NE穿梭框_取选中(hwnd, element_id, side)` | int | 底层直调 EU_GetTransferSelected：取选中。 |
| 946 | `NE穿梭框_取数量` | `NE穿梭框_取数量(hwnd, element_id, side)` | int | 底层直调 EU_GetTransferCount：取数量。 |
| 947 | `NE穿梭框_设置筛选` | `NE穿梭框_设置筛选(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferFilters：设置筛选。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 948 | `NE穿梭框_取匹配数量` | `NE穿梭框_取匹配数量(hwnd, element_id, side)` | int | 底层直调 EU_GetTransferMatchedCount：取匹配数量。 |
| 949 | `NE穿梭框_设置项禁用` | `NE穿梭框_设置项禁用(hwnd, element_id, side, item_index, disabled)` | void | 底层直调 EU_SetTransferItemDisabled：设置项禁用。 |
| 950 | `NE穿梭框_取项禁用` | `NE穿梭框_取项禁用(hwnd, element_id, side, item_index)` | int | 底层直调 EU_GetTransferItemDisabled：取项禁用。 |
| 951 | `NE穿梭框_取禁用数量` | `NE穿梭框_取禁用数量(hwnd, element_id, side)` | int | 底层直调 EU_GetTransferDisabledCount：取禁用数量。 |
| 952 | `NE穿梭框_设置数据扩展` | `NE穿梭框_设置数据扩展(hwnd, element_id, items_bytes, items_len, target_bytes, target_len)` | void | 底层直调 EU_SetTransferDataEx：设置数据扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 953 | `NE穿梭框_投递设置数据扩展` | `NE穿梭框_投递设置数据扩展(hwnd, element_id, items_bytes, items_len, target_bytes, target_len)` | int | 底层直调 EU_PostSetTransferDataEx：投递设置数据扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 954 | `NE穿梭框_设置选项` | `NE穿梭框_设置选项(hwnd, element_id, filterable, multiple, show_footer, show_select_all, show_count, render_mode)` | void | 底层直调 EU_SetTransferOptions：设置选项。 |
| 955 | `NE穿梭框_取选项` | `NE穿梭框_取选项(hwnd, element_id, filterable, multiple, show_footer, show_select_all, show_count, render_mode)` | int | 底层直调 EU_GetTransferOptions：取选项。 |
| 956 | `NE穿梭框_设置标题` | `NE穿梭框_设置标题(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferTitles：设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 957 | `NE穿梭框_设置按钮文本` | `NE穿梭框_设置按钮文本(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferButtonTexts：设置按钮文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 958 | `NE穿梭框_设置格式` | `NE穿梭框_设置格式(hwnd, element_id, no_checked_bytes, no_checked_len, has_checked_bytes, has_checked_len)` | void | 底层直调 EU_SetTransferFormat：设置格式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 959 | `NE穿梭框_设置项模板` | `NE穿梭框_设置项模板(hwnd, element_id, template_bytes, template_len)` | void | 底层直调 EU_SetTransferItemTemplate：设置项模板。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 960 | `NE穿梭框_设置页脚文本` | `NE穿梭框_设置页脚文本(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferFooterTexts：设置页脚文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 961 | `NE穿梭框_设置筛选占位提示` | `NE穿梭框_设置筛选占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetTransferFilterPlaceholder：设置筛选占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 962 | `NE穿梭框_设置勾选键` | `NE穿梭框_设置勾选键(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | void | 底层直调 EU_SetTransferCheckedKeys：设置勾选键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 963 | `NE穿梭框_投递设置勾选键` | `NE穿梭框_投递设置勾选键(hwnd, element_id, left_bytes, left_len, right_bytes, right_len)` | int | 底层直调 EU_PostSetTransferCheckedKeys：投递设置勾选键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 964 | `NE穿梭框_取勾选数量` | `NE穿梭框_取勾选数量(hwnd, element_id, side)` | int | 底层直调 EU_GetTransferCheckedCount：取勾选数量。 |
| 965 | `NE穿梭框_取值键` | `NE穿梭框_取值键(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTransferValueKeys：取值键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 966 | `NE穿梭框_取文本` | `NE穿梭框_取文本(hwnd, element_id, text_type, buffer, buffer_size)` | int | 底层直调 EU_GetTransferText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 967 | `NE自动完成_设置建议` | `NE自动完成_设置建议(hwnd, element_id, suggestions_bytes, suggestions_len)` | void | 底层直调 EU_SetAutocompleteSuggestions：设置建议。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 968 | `NE自动完成_投递设置建议` | `NE自动完成_投递设置建议(hwnd, element_id, suggestions_bytes, suggestions_len)` | int | 底层直调 EU_PostSetAutocompleteSuggestions：投递设置建议。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 969 | `NE自动完成_设置值` | `NE自动完成_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetAutocompleteValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 970 | `NE自动完成_投递设置值` | `NE自动完成_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetAutocompleteValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 971 | `NE自动完成_设置占位提示` | `NE自动完成_设置占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetAutocompletePlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 972 | `NE自动完成_取占位提示` | `NE自动完成_取占位提示(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetAutocompletePlaceholder：取占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 973 | `NE自动完成_设置图标` | `NE自动完成_设置图标(hwnd, element_id, prefix_icon_bytes, prefix_icon_len, suffix_icon_bytes, suffix_icon_len)` | void | 底层直调 EU_SetAutocompleteIcons：设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 974 | `NE自动完成_取图标` | `NE自动完成_取图标(hwnd, element_id, prefix_icon_buffer, prefix_icon_buffer_size, suffix_icon_buffer, suffix_icon_buffer_size)` | int | 底层直调 EU_GetAutocompleteIcons：取图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 975 | `NE自动完成_设置行为选项` | `NE自动完成_设置行为选项(hwnd, element_id, trigger_on_focus)` | void | 底层直调 EU_SetAutocompleteBehaviorOptions：设置行为选项。 |
| 976 | `NE自动完成_取行为选项` | `NE自动完成_取行为选项(hwnd, element_id, trigger_on_focus)` | int | 底层直调 EU_GetAutocompleteBehaviorOptions：取行为选项。 |
| 977 | `NE自动完成_设置打开` | `NE自动完成_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetAutocompleteOpen：设置打开。 |
| 978 | `NE自动完成_投递设置打开` | `NE自动完成_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetAutocompleteOpen：投递设置打开。 |
| 979 | `NE自动完成_设置选中` | `NE自动完成_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetAutocompleteSelected：设置选中。 |
| 980 | `NE自动完成_投递设置选中` | `NE自动完成_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetAutocompleteSelected：投递设置选中。 |
| 981 | `NE自动完成_设置异步状态` | `NE自动完成_设置异步状态(hwnd, element_id, loading, request_id)` | void | 底层直调 EU_SetAutocompleteAsyncState：设置异步状态。 |
| 982 | `NE自动完成_投递设置异步状态` | `NE自动完成_投递设置异步状态(hwnd, element_id, loading, request_id)` | int | 底层直调 EU_PostSetAutocompleteAsyncState：投递设置异步状态。 |
| 983 | `NE自动完成_设置空态文本` | `NE自动完成_设置空态文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetAutocompleteEmptyText：设置空态文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 984 | `NE自动完成_取值` | `NE自动完成_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetAutocompleteValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 985 | `NE自动完成_取打开` | `NE自动完成_取打开(hwnd, element_id)` | int | 底层直调 EU_GetAutocompleteOpen：取打开。 |
| 986 | `NE自动完成_取选中` | `NE自动完成_取选中(hwnd, element_id)` | int | 底层直调 EU_GetAutocompleteSelected：取选中。 |
| 987 | `NE自动完成_取建议数量` | `NE自动完成_取建议数量(hwnd, element_id)` | int | 底层直调 EU_GetAutocompleteSuggestionCount：取建议数量。 |
| 988 | `NE自动完成_取选项` | `NE自动完成_取选项(hwnd, element_id, open, selected_index, suggestion_count, loading, request_id)` | int | 底层直调 EU_GetAutocompleteOptions：取选项。 |
| 989 | `NE提及_设置值` | `NE提及_设置值(hwnd, element_id, value_bytes, value_len)` | void | 底层直调 EU_SetMentionsValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 990 | `NE提及_投递设置值` | `NE提及_投递设置值(hwnd, element_id, value_bytes, value_len)` | int | 底层直调 EU_PostSetMentionsValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 991 | `NE提及_设置建议` | `NE提及_设置建议(hwnd, element_id, suggestions_bytes, suggestions_len)` | void | 底层直调 EU_SetMentionsSuggestions：设置建议。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 992 | `NE提及_投递设置建议` | `NE提及_投递设置建议(hwnd, element_id, suggestions_bytes, suggestions_len)` | int | 底层直调 EU_PostSetMentionsSuggestions：投递设置建议。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 993 | `NE提及_设置打开` | `NE提及_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetMentionsOpen：设置打开。 |
| 994 | `NE提及_投递设置打开` | `NE提及_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetMentionsOpen：投递设置打开。 |
| 995 | `NE提及_设置选中` | `NE提及_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetMentionsSelected：设置选中。 |
| 996 | `NE提及_投递设置选中` | `NE提及_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetMentionsSelected：投递设置选中。 |
| 997 | `NE提及_设置选项` | `NE提及_设置选项(hwnd, element_id, trigger_bytes, trigger_len, filter_enabled, insert_space)` | void | 底层直调 EU_SetMentionsOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 998 | `NE提及_设置筛选` | `NE提及_设置筛选(hwnd, element_id, filter_bytes, filter_len)` | void | 底层直调 EU_SetMentionsFilter：设置筛选。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 999 | `NE提及_插入选中` | `NE提及_插入选中(hwnd, element_id)` | void | 底层直调 EU_InsertMentionsSelected：插入选中。 |
| 1000 | `NE提及_取值` | `NE提及_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetMentionsValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1001 | `NE提及_取打开` | `NE提及_取打开(hwnd, element_id)` | int | 底层直调 EU_GetMentionsOpen：取打开。 |
| 1002 | `NE提及_取选中` | `NE提及_取选中(hwnd, element_id)` | int | 底层直调 EU_GetMentionsSelected：取选中。 |
| 1003 | `NE提及_取建议数量` | `NE提及_取建议数量(hwnd, element_id)` | int | 底层直调 EU_GetMentionsSuggestionCount：取建议数量。 |
| 1004 | `NE提及_取选项` | `NE提及_取选项(hwnd, element_id, open, selected_index, suggestion_count, matched_count, trigger_code)` | int | 底层直调 EU_GetMentionsOptions：取选项。 |
| 1005 | `NE级联选择_设置选项直调` | `NE级联选择_设置选项直调(hwnd, element_id, options_bytes, options_len)` | void | NE级联选择_设置选项 的底层直调版本：设置选项。一般请用高层封装 NE级联选择_设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1006 | `NE级联选择_投递设置选项` | `NE级联选择_投递设置选项(hwnd, element_id, options_bytes, options_len)` | int | 底层直调 EU_PostSetCascaderOptions：投递设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1007 | `NE级联选择_设置值` | `NE级联选择_设置值(hwnd, element_id, selected_bytes, selected_len)` | void | 底层直调 EU_SetCascaderValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1008 | `NE级联选择_投递设置值` | `NE级联选择_投递设置值(hwnd, element_id, selected_bytes, selected_len)` | int | 底层直调 EU_PostSetCascaderValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1009 | `NE级联选择_设置打开` | `NE级联选择_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetCascaderOpen：设置打开。 |
| 1010 | `NE级联选择_投递设置打开` | `NE级联选择_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetCascaderOpen：投递设置打开。 |
| 1011 | `NE级联选择_设置高级选项` | `NE级联选择_设置高级选项(hwnd, element_id, searchable, lazy_mode)` | void | 底层直调 EU_SetCascaderAdvancedOptions：设置高级选项。 |
| 1012 | `NE级联选择_设置搜索` | `NE级联选择_设置搜索(hwnd, element_id, search_bytes, search_len)` | void | 底层直调 EU_SetCascaderSearch：设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1013 | `NE级联选择_投递设置搜索` | `NE级联选择_投递设置搜索(hwnd, element_id, search_bytes, search_len)` | int | 底层直调 EU_PostSetCascaderSearch：投递设置搜索。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1014 | `NE级联选择_取打开` | `NE级联选择_取打开(hwnd, element_id)` | int | 底层直调 EU_GetCascaderOpen：取打开。 |
| 1015 | `NE级联选择_取选项数量` | `NE级联选择_取选项数量(hwnd, element_id)` | int | 底层直调 EU_GetCascaderOptionCount：取选项数量。 |
| 1016 | `NE级联选择_取选中深度` | `NE级联选择_取选中深度(hwnd, element_id)` | int | 底层直调 EU_GetCascaderSelectedDepth：取选中深度。 |
| 1017 | `NE级联选择_取层级数` | `NE级联选择_取层级数(hwnd, element_id)` | int | 底层直调 EU_GetCascaderLevelCount：取层级数。 |
| 1018 | `NE级联选择_取高级选项` | `NE级联选择_取高级选项(hwnd, element_id, searchable, lazy_mode, matched_count, last_lazy_level)` | int | 底层直调 EU_GetCascaderAdvancedOptions：取高级选项。 |
| 1019 | `NE日期选择_设置日期` | `NE日期选择_设置日期(hwnd, element_id, year, month, selected_day)` | void | 底层直调 EU_SetDatePickerDate：设置日期。 |
| 1020 | `NE日期选择_设置范围` | `NE日期选择_设置范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | void | 底层直调 EU_SetDatePickerRange：设置范围。 |
| 1021 | `NE日期选择_设置选项` | `NE日期选择_设置选项(hwnd, element_id, today_yyyymmdd, show_today, date_format)` | void | 底层直调 EU_SetDatePickerOptions：设置选项。 |
| 1022 | `NE日期选择_设置打开` | `NE日期选择_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDatePickerOpen：设置打开。 |
| 1023 | `NE日期选择_清空` | `NE日期选择_清空(hwnd, element_id)` | void | 底层直调 EU_ClearDatePicker：清空。 |
| 1024 | `NE日期选择_选中今天` | `NE日期选择_选中今天(hwnd, element_id)` | void | 底层直调 EU_DatePickerSelectToday：选中今天。 |
| 1025 | `NE日期选择_取打开` | `NE日期选择_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDatePickerOpen：取打开。 |
| 1026 | `NE日期选择_取值` | `NE日期选择_取值(hwnd, element_id)` | int | 底层直调 EU_GetDatePickerValue：取值。 |
| 1027 | `NE日期选择_移动月份` | `NE日期选择_移动月份(hwnd, element_id, delta_months)` | void | 底层直调 EU_DatePickerMoveMonth：移动月份。 |
| 1028 | `NE日期选择_取范围` | `NE日期选择_取范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd)` | int | 底层直调 EU_GetDatePickerRange：取范围。 |
| 1029 | `NE日期选择_取选项` | `NE日期选择_取选项(hwnd, element_id, today_yyyymmdd, show_today, date_format)` | int | 底层直调 EU_GetDatePickerOptions：取选项。 |
| 1030 | `NE日期选择_设置选择范围` | `NE日期选择_设置选择范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | void | 底层直调 EU_SetDatePickerSelectionRange：设置选择范围。 |
| 1031 | `NE日期选择_取选择范围` | `NE日期选择_取选择范围(hwnd, element_id, start_yyyymmdd, end_yyyymmdd, enabled)` | int | 底层直调 EU_GetDatePickerSelectionRange：取选择范围。 |
| 1032 | `NE日期选择_设置占位提示` | `NE日期选择_设置占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetDatePickerPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1033 | `NE日期选择_设置范围分隔符` | `NE日期选择_设置范围分隔符(hwnd, element_id, sep_bytes, sep_len)` | void | 底层直调 EU_SetDatePickerRangeSeparator：设置范围分隔符。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1034 | `NE日期选择_设置开始占位提示` | `NE日期选择_设置开始占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetDatePickerStartPlaceholder：设置开始占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1035 | `NE日期选择_设置结束占位提示` | `NE日期选择_设置结束占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetDatePickerEndPlaceholder：设置结束占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1036 | `NE日期选择_设置格式` | `NE日期选择_设置格式(hwnd, element_id, fmt_bytes, fmt_len)` | void | 底层直调 EU_SetDatePickerFormat：设置格式。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1037 | `NE日期选择_设置对齐` | `NE日期选择_设置对齐(hwnd, element_id, align)` | void | 底层直调 EU_SetDatePickerAlign：设置对齐。 |
| 1038 | `NE日期选择_设置模式` | `NE日期选择_设置模式(hwnd, element_id, mode)` | void | 底层直调 EU_SetDatePickerMode：设置模式。 |
| 1039 | `NE日期选择_取模式` | `NE日期选择_取模式(hwnd, element_id)` | int | 底层直调 EU_GetDatePickerMode：取模式。 |
| 1040 | `NE日期选择_设置多选` | `NE日期选择_设置多选(hwnd, element_id, enabled)` | void | 底层直调 EU_SetDatePickerMultiSelect：设置多选。 |
| 1041 | `NE日期选择_取选中日期` | `NE日期选择_取选中日期(hwnd, element_id, buffer, buf_size)` | int | 底层直调 EU_GetDatePickerSelectedDates：取选中日期。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1042 | `NE日期选择_设置快捷选项` | `NE日期选择_设置快捷选项(hwnd, element_id, shortcuts_bytes, shortcuts_len)` | void | 底层直调 EU_SetDatePickerShortcuts：设置快捷选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1043 | `NE日期选择_设置禁用日期判定回调` | `NE日期选择_设置禁用日期判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDatePickerDisabledDateCallback：设置禁用日期判定回调。处理器实参必须写 &处理器名。 |
| 1044 | `NE日期选择_设置禁用日期JSON` | `NE日期选择_设置禁用日期JSON(hwnd, element_id, dates_bytes, dates_len)` | void | 底层直调 EU_SetDatePickerDisabledDatesUtf8：设置禁用日期JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1045 | `NE日期范围_创建` | `NE日期范围_创建(hwnd, parent_id, start_yyyymmdd, end_yyyymmdd, x, y, w, h)` | int | 底层直调 EU_CreateDateRangePicker：创建。 |
| 1046 | `NE日期范围_设置值` | `NE日期范围_设置值(hwnd, element_id, start, end)` | void | 底层直调 EU_SetDateRangePickerValue：设置值。 |
| 1047 | `NE日期范围_取值` | `NE日期范围_取值(hwnd, element_id, start, end)` | int | 底层直调 EU_GetDateRangePickerValue：取值。 |
| 1048 | `NE日期范围_设置范围` | `NE日期范围_设置范围(hwnd, element_id, min, max)` | void | 底层直调 EU_SetDateRangePickerRange：设置范围。 |
| 1049 | `NE日期范围_设置占位提示` | `NE日期范围_设置占位提示(hwnd, element_id, start_bytes, start_len, end_bytes, end_len)` | void | 底层直调 EU_SetDateRangePickerPlaceholders：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1050 | `NE日期范围_设置分隔符` | `NE日期范围_设置分隔符(hwnd, element_id, sep_bytes, sep_len)` | void | 底层直调 EU_SetDateRangePickerSeparator：设置分隔符。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1051 | `NE日期范围_设置格式` | `NE日期范围_设置格式(hwnd, element_id, fmt)` | void | 底层直调 EU_SetDateRangePickerFormat：设置格式。 |
| 1052 | `NE日期范围_设置对齐` | `NE日期范围_设置对齐(hwnd, element_id, align)` | void | 底层直调 EU_SetDateRangePickerAlign：设置对齐。 |
| 1053 | `NE日期范围_设置快捷选项` | `NE日期范围_设置快捷选项(hwnd, element_id, sc_bytes, sc_len)` | void | 底层直调 EU_SetDateRangePickerShortcuts：设置快捷选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1054 | `NE日期范围_设置禁用日期判定回调` | `NE日期范围_设置禁用日期判定回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDateRangePickerDisabledDateCallback：设置禁用日期判定回调。处理器实参必须写 &处理器名。 |
| 1055 | `NE日期范围_设置打开` | `NE日期范围_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDateRangePickerOpen：设置打开。 |
| 1056 | `NE日期范围_取打开` | `NE日期范围_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDateRangePickerOpen：取打开。 |
| 1057 | `NE日期范围_清空` | `NE日期范围_清空(hwnd, element_id)` | void | 底层直调 EU_DateRangePickerClear：清空。 |
| 1058 | `NE时间选择_设置时间` | `NE时间选择_设置时间(hwnd, element_id, hour, minute)` | void | 底层直调 EU_SetTimePickerTime：设置时间。 |
| 1059 | `NE时间选择_设置范围` | `NE时间选择_设置范围(hwnd, element_id, min_hhmm, max_hhmm)` | void | 底层直调 EU_SetTimePickerRange：设置范围。 |
| 1060 | `NE时间选择_设置选项` | `NE时间选择_设置选项(hwnd, element_id, step_minutes, time_format)` | void | 底层直调 EU_SetTimePickerOptions：设置选项。 |
| 1061 | `NE时间选择_设置打开` | `NE时间选择_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetTimePickerOpen：设置打开。 |
| 1062 | `NE时间选择_设置滚动` | `NE时间选择_设置滚动(hwnd, element_id, hour_scroll, minute_scroll)` | void | 底层直调 EU_SetTimePickerScroll：设置滚动。 |
| 1063 | `NE时间选择_取打开` | `NE时间选择_取打开(hwnd, element_id)` | int | 底层直调 EU_GetTimePickerOpen：取打开。 |
| 1064 | `NE时间选择_取值` | `NE时间选择_取值(hwnd, element_id)` | int | 底层直调 EU_GetTimePickerValue：取值。 |
| 1065 | `NE时间选择_取范围` | `NE时间选择_取范围(hwnd, element_id, min_hhmm, max_hhmm)` | int | 底层直调 EU_GetTimePickerRange：取范围。 |
| 1066 | `NE时间选择_取选项` | `NE时间选择_取选项(hwnd, element_id, step_minutes, time_format)` | int | 底层直调 EU_GetTimePickerOptions：取选项。 |
| 1067 | `NE时间选择_取滚动` | `NE时间选择_取滚动(hwnd, element_id, hour_scroll, minute_scroll)` | int | 底层直调 EU_GetTimePickerScroll：取滚动。 |
| 1068 | `NE时间选择_设置箭头控制` | `NE时间选择_设置箭头控制(hwnd, element_id, enabled)` | void | 底层直调 EU_SetTimePickerArrowControl：设置箭头控制。 |
| 1069 | `NE时间选择_取箭头控制` | `NE时间选择_取箭头控制(hwnd, element_id)` | int | 底层直调 EU_GetTimePickerArrowControl：取箭头控制。 |
| 1070 | `NE时间选择_设置范围选择` | `NE时间选择_设置范围选择(hwnd, element_id, enabled, start_hhmm, end_hhmm)` | void | 底层直调 EU_SetTimePickerRangeSelect：设置范围选择。 |
| 1071 | `NE时间选择_设置开始占位提示` | `NE时间选择_设置开始占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetTimePickerStartPlaceholder：设置开始占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1072 | `NE时间选择_设置结束占位提示` | `NE时间选择_设置结束占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetTimePickerEndPlaceholder：设置结束占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1073 | `NE时间选择_设置范围分隔符` | `NE时间选择_设置范围分隔符(hwnd, element_id, sep_bytes, sep_len)` | void | 底层直调 EU_SetTimePickerRangeSeparator：设置范围分隔符。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1074 | `NE时间选择_取范围值` | `NE时间选择_取范围值(hwnd, element_id, start_hhmm, end_hhmm, enabled)` | int | 底层直调 EU_GetTimePickerRangeValue：取范围值。 |
| 1075 | `NE时间下拉_设置占位提示` | `NE时间下拉_设置占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetTimeSelectPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1076 | `NE日期时间_设置日期时间` | `NE日期时间_设置日期时间(hwnd, element_id, year, month, day, hour, minute)` | void | 底层直调 EU_SetDateTimePickerDateTime：设置日期时间。 |
| 1077 | `NE日期时间_设置范围` | `NE日期时间_设置范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd, min_hhmm, max_hhmm)` | void | 底层直调 EU_SetDateTimePickerRange：设置范围。 |
| 1078 | `NE日期时间_设置选项` | `NE日期时间_设置选项(hwnd, element_id, today_yyyymmdd, show_today, minute_step, date_format)` | void | 底层直调 EU_SetDateTimePickerOptions：设置选项。 |
| 1079 | `NE日期时间_设置打开` | `NE日期时间_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDateTimePickerOpen：设置打开。 |
| 1080 | `NE日期时间_清空` | `NE日期时间_清空(hwnd, element_id)` | void | 底层直调 EU_ClearDateTimePicker：清空。 |
| 1081 | `NE日期时间_选中今天` | `NE日期时间_选中今天(hwnd, element_id)` | void | 底层直调 EU_DateTimePickerSelectToday：选中今天。 |
| 1082 | `NE日期时间_选中现在` | `NE日期时间_选中现在(hwnd, element_id)` | void | 底层直调 EU_DateTimePickerSelectNow：选中现在。 |
| 1083 | `NE日期时间_设置滚动` | `NE日期时间_设置滚动(hwnd, element_id, hour_scroll, minute_scroll)` | void | 底层直调 EU_SetDateTimePickerScroll：设置滚动。 |
| 1084 | `NE日期时间_取打开` | `NE日期时间_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDateTimePickerOpen：取打开。 |
| 1085 | `NE日期时间_取日期值` | `NE日期时间_取日期值(hwnd, element_id)` | int | 底层直调 EU_GetDateTimePickerDateValue：取日期值。 |
| 1086 | `NE日期时间_取时间值` | `NE日期时间_取时间值(hwnd, element_id)` | int | 底层直调 EU_GetDateTimePickerTimeValue：取时间值。 |
| 1087 | `NE日期时间_移动月份` | `NE日期时间_移动月份(hwnd, element_id, delta_months)` | void | 底层直调 EU_DateTimePickerMoveMonth：移动月份。 |
| 1088 | `NE日期时间_取范围` | `NE日期时间_取范围(hwnd, element_id, min_yyyymmdd, max_yyyymmdd, min_hhmm, max_hhmm)` | int | 底层直调 EU_GetDateTimePickerRange：取范围。 |
| 1089 | `NE日期时间_取选项` | `NE日期时间_取选项(hwnd, element_id, today_yyyymmdd, show_today, minute_step, date_format)` | int | 底层直调 EU_GetDateTimePickerOptions：取选项。 |
| 1090 | `NE日期时间_取滚动` | `NE日期时间_取滚动(hwnd, element_id, hour_scroll, minute_scroll)` | int | 底层直调 EU_GetDateTimePickerScroll：取滚动。 |
| 1091 | `NE日期时间_设置快捷选项` | `NE日期时间_设置快捷选项(hwnd, element_id, shortcuts_bytes, shortcuts_len)` | void | 底层直调 EU_SetDateTimePickerShortcuts：设置快捷选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1092 | `NE日期时间_设置开始占位提示` | `NE日期时间_设置开始占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetDateTimePickerStartPlaceholder：设置开始占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1093 | `NE日期时间_设置结束占位提示` | `NE日期时间_设置结束占位提示(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetDateTimePickerEndPlaceholder：设置结束占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1094 | `NE日期时间_设置默认时间` | `NE日期时间_设置默认时间(hwnd, element_id, hour, minute)` | void | 底层直调 EU_SetDateTimePickerDefaultTime：设置默认时间。 |
| 1095 | `NE日期时间_设置范围默认时间` | `NE日期时间_设置范围默认时间(hwnd, element_id, start_hour, start_minute, end_hour, end_minute)` | void | 底层直调 EU_SetDateTimePickerRangeDefaultTime：设置范围默认时间。 |
| 1096 | `NE日期时间_设置范围分隔符` | `NE日期时间_设置范围分隔符(hwnd, element_id, sep_bytes, sep_len)` | void | 底层直调 EU_SetDateTimePickerRangeSeparator：设置范围分隔符。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1097 | `NE日期时间_设置范围选择` | `NE日期时间_设置范围选择(hwnd, element_id, enabled, start_date, start_time, end_date, end_time)` | void | 底层直调 EU_SetDateTimePickerRangeSelect：设置范围选择。 |
| 1098 | `NE日期时间_取范围值` | `NE日期时间_取范围值(hwnd, element_id, start_date, start_time, end_date, end_time, enabled)` | int | 底层直调 EU_GetDateTimePickerRangeValue：取范围值。 |
| 1099 | `NE时间下拉_设置时间` | `NE时间下拉_设置时间(hwnd, element_id, hour, minute)` | void | 底层直调 EU_SetTimeSelectTime：设置时间。 |
| 1100 | `NE时间下拉_设置范围` | `NE时间下拉_设置范围(hwnd, element_id, min_hhmm, max_hhmm)` | void | 底层直调 EU_SetTimeSelectRange：设置范围。 |
| 1101 | `NE时间下拉_设置选项` | `NE时间下拉_设置选项(hwnd, element_id, step_minutes, time_format)` | void | 底层直调 EU_SetTimeSelectOptions：设置选项。 |
| 1102 | `NE时间下拉_设置打开` | `NE时间下拉_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetTimeSelectOpen：设置打开。 |
| 1103 | `NE时间下拉_设置滚动` | `NE时间下拉_设置滚动(hwnd, element_id, scroll_row)` | void | 底层直调 EU_SetTimeSelectScroll：设置滚动。 |
| 1104 | `NE时间下拉_取打开` | `NE时间下拉_取打开(hwnd, element_id)` | int | 底层直调 EU_GetTimeSelectOpen：取打开。 |
| 1105 | `NE时间下拉_取值` | `NE时间下拉_取值(hwnd, element_id)` | int | 底层直调 EU_GetTimeSelectValue：取值。 |
| 1106 | `NE时间下拉_取范围` | `NE时间下拉_取范围(hwnd, element_id, min_hhmm, max_hhmm)` | int | 底层直调 EU_GetTimeSelectRange：取范围。 |
| 1107 | `NE时间下拉_取选项` | `NE时间下拉_取选项(hwnd, element_id, step_minutes, time_format)` | int | 底层直调 EU_GetTimeSelectOptions：取选项。 |
| 1108 | `NE时间下拉_取状态` | `NE时间下拉_取状态(hwnd, element_id, scroll_row, candidate_count, group_count, active_index)` | int | 底层直调 EU_GetTimeSelectState：取状态。 |
| 1109 | `NE下拉菜单_设置项` | `NE下拉菜单_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetDropdownItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1110 | `NE下拉菜单_投递设置项` | `NE下拉菜单_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetDropdownItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1111 | `NE下拉菜单_设置选中` | `NE下拉菜单_设置选中(hwnd, element_id, selected_index)` | void | 底层直调 EU_SetDropdownSelected：设置选中。 |
| 1112 | `NE下拉菜单_投递设置选中` | `NE下拉菜单_投递设置选中(hwnd, element_id, selected_index)` | int | 底层直调 EU_PostSetDropdownSelected：投递设置选中。 |
| 1113 | `NE下拉菜单_取选中` | `NE下拉菜单_取选中(hwnd, element_id)` | int | 底层直调 EU_GetDropdownSelected：取选中。 |
| 1114 | `NE下拉菜单_设置打开` | `NE下拉菜单_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDropdownOpen：设置打开。 |
| 1115 | `NE下拉菜单_投递设置打开` | `NE下拉菜单_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetDropdownOpen：投递设置打开。 |
| 1116 | `NE下拉菜单_取打开` | `NE下拉菜单_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDropdownOpen：取打开。 |
| 1117 | `NE下拉菜单_取项数量` | `NE下拉菜单_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetDropdownItemCount：取项数量。 |
| 1118 | `NE下拉菜单_设置禁用` | `NE下拉菜单_设置禁用(hwnd, element_id, indices, count)` | void | 底层直调 EU_SetDropdownDisabled：设置禁用。 |
| 1119 | `NE下拉菜单_设置禁用JSON` | `NE下拉菜单_设置禁用JSON(hwnd, element_id, indices_bytes, indices_len)` | void | 底层直调 EU_SetDropdownDisabledUtf8：设置禁用JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1120 | `NE下拉菜单_投递设置禁用JSON` | `NE下拉菜单_投递设置禁用JSON(hwnd, element_id, indices_bytes, indices_len)` | int | 底层直调 EU_PostSetDropdownDisabledUtf8：投递设置禁用JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1121 | `NE下拉菜单_取状态` | `NE下拉菜单_取状态(hwnd, element_id, selected_index, item_count, disabled_count, selected_level, hover_index)` | int | 底层直调 EU_GetDropdownState：取状态。 |
| 1122 | `NE下拉菜单_设置选项` | `NE下拉菜单_设置选项(hwnd, element_id, trigger_mode, hide_on_click, split_button, button_variant, size, trigger_style)` | void | 底层直调 EU_SetDropdownOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1123 | `NE下拉菜单_取选项` | `NE下拉菜单_取选项(hwnd, element_id, trigger_mode, hide_on_click, split_button, button_variant, size, trigger_style)` | int | 底层直调 EU_GetDropdownOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1124 | `NE下拉菜单_设置项元信息` | `NE下拉菜单_设置项元信息(hwnd, element_id, icons_bytes, icons_len, commands_bytes, commands_len, divided_indices, divided_count)` | void | 底层直调 EU_SetDropdownItemMeta：设置项元信息。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1125 | `NE下拉菜单_设置项元信息JSON` | `NE下拉菜单_设置项元信息JSON(hwnd, element_id, icons_bytes, icons_len, commands_bytes, commands_len, divided_bytes, divided_len)` | void | 底层直调 EU_SetDropdownItemMetaUtf8：设置项元信息JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1126 | `NE下拉菜单_取项元信息` | `NE下拉菜单_取项元信息(hwnd, element_id, item_index, icon_buffer, icon_buffer_size, command_buffer, command_buffer_size, divided, disabled, level)` | int | 底层直调 EU_GetDropdownItemMeta：取项元信息。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1127 | `NE下拉菜单_设置命令回调` | `NE下拉菜单_设置命令回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDropdownCommandCallback：设置命令回调。处理器实参必须写 &处理器名。 |
| 1128 | `NE下拉菜单_设置主区域点击回调` | `NE下拉菜单_设置主区域点击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDropdownMainClickCallback：设置主区域点击回调。处理器实参必须写 &处理器名。 |
| 1129 | `NE菜单_设置项` | `NE菜单_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetMenuItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1130 | `NE菜单_投递设置项` | `NE菜单_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetMenuItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1131 | `NE菜单_设置活动` | `NE菜单_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetMenuActive：设置活动。 |
| 1132 | `NE菜单_投递设置活动` | `NE菜单_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetMenuActive：投递设置活动。 |
| 1133 | `NE菜单_取活动` | `NE菜单_取活动(hwnd, element_id)` | int | 底层直调 EU_GetMenuActive：取活动。 |
| 1134 | `NE菜单_设置方向` | `NE菜单_设置方向(hwnd, element_id, orientation)` | void | 底层直调 EU_SetMenuOrientation：设置方向。 |
| 1135 | `NE菜单_取方向` | `NE菜单_取方向(hwnd, element_id)` | int | 底层直调 EU_GetMenuOrientation：取方向。 |
| 1136 | `NE菜单_取项数量` | `NE菜单_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetMenuItemCount：取项数量。 |
| 1137 | `NE菜单_设置展开` | `NE菜单_设置展开(hwnd, element_id, indices, count)` | void | 底层直调 EU_SetMenuExpanded：设置展开。 |
| 1138 | `NE菜单_设置展开JSON` | `NE菜单_设置展开JSON(hwnd, element_id, indices_bytes, indices_len)` | void | 底层直调 EU_SetMenuExpandedUtf8：设置展开JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1139 | `NE菜单_投递设置展开JSON` | `NE菜单_投递设置展开JSON(hwnd, element_id, indices_bytes, indices_len)` | int | 底层直调 EU_PostSetMenuExpandedUtf8：投递设置展开JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1140 | `NE菜单_取状态直调` | `NE菜单_取状态直调(hwnd, element_id, active_index, item_count, orientation, active_level, visible_count, expanded_count, hover_index)` | int | NE菜单_取状态 的底层直调版本：取状态。一般请用高层封装 NE菜单_取状态。 |
| 1141 | `NE菜单_取激活路径` | `NE菜单_取激活路径(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetMenuActivePath：取激活路径。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1142 | `NE菜单_设置配色` | `NE菜单_设置配色(hwnd, element_id, bg, text_color, active_text_color, hover_bg, disabled_text_color, border)` | void | 底层直调 EU_SetMenuColors：设置配色。 |
| 1143 | `NE菜单_取配色` | `NE菜单_取配色(hwnd, element_id, bg, text_color, active_text_color, hover_bg, disabled_text_color, border)` | int | 底层直调 EU_GetMenuColors：取配色。 |
| 1144 | `NE菜单_设置折叠` | `NE菜单_设置折叠(hwnd, element_id, collapsed)` | void | 底层直调 EU_SetMenuCollapsed：设置折叠。 |
| 1145 | `NE菜单_投递设置折叠` | `NE菜单_投递设置折叠(hwnd, element_id, collapsed)` | int | 底层直调 EU_PostSetMenuCollapsed：投递设置折叠。 |
| 1146 | `NE菜单_取折叠` | `NE菜单_取折叠(hwnd, element_id)` | int | 底层直调 EU_GetMenuCollapsed：取折叠。 |
| 1147 | `NE菜单_设置项元信息` | `NE菜单_设置项元信息(hwnd, element_id, icons_bytes, icons_len, group_indices, group_count, hrefs_bytes, hrefs_len, targets_bytes, targets_len, commands_bytes, commands_len)` | void | 底层直调 EU_SetMenuItemMeta：设置项元信息。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1148 | `NE菜单_设置项元信息JSON` | `NE菜单_设置项元信息JSON(hwnd, element_id, icons_bytes, icons_len, group_bytes, group_len, hrefs_bytes, hrefs_len, targets_bytes, targets_len, commands_bytes, commands_len)` | void | 底层直调 EU_SetMenuItemMetaUtf8：设置项元信息JSON。参数为 UTF-8 编码的 JSON/协议文本（索引、键列表等用 \| 或 JSON 数组，以组件文档为准）。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1149 | `NE菜单_取项元信息` | `NE菜单_取项元信息(hwnd, element_id, item_index, icon_buffer, icon_buffer_size, href_buffer, href_buffer_size, target_buffer, target_buffer_size, command_buffer, command_buffer_size, is_group, disabled, level)` | int | 底层直调 EU_GetMenuItemMeta：取项元信息。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1150 | `NE菜单_设置选择回调` | `NE菜单_设置选择回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetMenuSelectCallback：设置选择回调。处理器实参必须写 &处理器名。 |
| 1151 | `NE锚点_设置项` | `NE锚点_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetAnchorItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1152 | `NE锚点_设置活动` | `NE锚点_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetAnchorActive：设置活动。 |
| 1153 | `NE锚点_取活动` | `NE锚点_取活动(hwnd, element_id)` | int | 底层直调 EU_GetAnchorActive：取活动。 |
| 1154 | `NE锚点_取项数量` | `NE锚点_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetAnchorItemCount：取项数量。 |
| 1155 | `NE锚点_设置目标` | `NE锚点_设置目标(hwnd, element_id, positions, count)` | void | 底层直调 EU_SetAnchorTargets：设置目标。 |
| 1156 | `NE锚点_设置选项` | `NE锚点_设置选项(hwnd, element_id, scroll_offset, target_container_id)` | void | 底层直调 EU_SetAnchorOptions：设置选项。 |
| 1157 | `NE锚点_设置滚动` | `NE锚点_设置滚动(hwnd, element_id, scroll_position)` | void | 底层直调 EU_SetAnchorScroll：设置滚动。 |
| 1158 | `NE锚点_取状态` | `NE锚点_取状态(hwnd, element_id, active_index, item_count, scroll_position, offset, target_position, container_id, hover_index)` | int | 底层直调 EU_GetAnchorState：取状态。 |
| 1159 | `NE回到顶部_设置状态` | `NE回到顶部_设置状态(hwnd, element_id, scroll_position, threshold, target_position)` | void | 底层直调 EU_SetBacktopState：设置状态。 |
| 1160 | `NE回到顶部_取可见` | `NE回到顶部_取可见(hwnd, element_id)` | int | 底层直调 EU_GetBacktopVisible：取可见。 |
| 1161 | `NE回到顶部_取状态` | `NE回到顶部_取状态(hwnd, element_id, scroll_position, threshold, target_position)` | int | 底层直调 EU_GetBacktopState：取状态。 |
| 1162 | `NE回到顶部_设置选项` | `NE回到顶部_设置选项(hwnd, element_id, scroll_position, threshold, target_position, container_id, duration_ms)` | void | 底层直调 EU_SetBacktopOptions：设置选项。 |
| 1163 | `NE回到顶部_设置滚动` | `NE回到顶部_设置滚动(hwnd, element_id, scroll_position)` | void | 底层直调 EU_SetBacktopScroll：设置滚动。 |
| 1164 | `NE回到顶部_触发滚动到顶部` | `NE回到顶部_触发滚动到顶部(hwnd, element_id)` | void | 底层直调 EU_TriggerBacktop：触发滚动到顶部。 |
| 1165 | `NE回到顶部_取完整状态` | `NE回到顶部_取完整状态(hwnd, element_id, scroll_position, threshold, target_position, container_id, visible, duration_ms, last_scroll_before_jump, activated_count)` | int | 底层直调 EU_GetBacktopFullState：取完整状态。 |
| 1166 | `NE分段控制_设置项` | `NE分段控制_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetSegmentedItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1167 | `NE分段控制_投递设置项` | `NE分段控制_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetSegmentedItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1168 | `NE分段控制_设置活动` | `NE分段控制_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetSegmentedActive：设置活动。 |
| 1169 | `NE分段控制_投递设置活动` | `NE分段控制_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetSegmentedActive：投递设置活动。 |
| 1170 | `NE分段控制_取活动` | `NE分段控制_取活动(hwnd, element_id)` | int | 底层直调 EU_GetSegmentedActive：取活动。 |
| 1171 | `NE分段控制_取项数量` | `NE分段控制_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetSegmentedItemCount：取项数量。 |
| 1172 | `NE分段控制_设置禁用` | `NE分段控制_设置禁用(hwnd, element_id, indices, count)` | void | 底层直调 EU_SetSegmentedDisabled：设置禁用。 |
| 1173 | `NE分段控制_取状态` | `NE分段控制_取状态(hwnd, element_id, active_index, item_count, disabled_count, hover_index)` | int | 底层直调 EU_GetSegmentedState：取状态。 |
| 1174 | `NE页头_设置文本` | `NE页头_设置文本(hwnd, element_id, title_bytes, title_len, subtitle_bytes, subtitle_len)` | void | 底层直调 EU_SetPageHeaderText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1175 | `NE页头_设置面包屑直调` | `NE页头_设置面包屑直调(hwnd, element_id, items_bytes, items_len)` | void | NE页头_设置面包屑 的底层直调版本：设置面包屑。一般请用高层封装 NE页头_设置面包屑。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1176 | `NE页头_设置动作` | `NE页头_设置动作(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetPageHeaderActions：设置动作。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1177 | `NE页头_取动作` | `NE页头_取动作(hwnd, element_id)` | int | 底层直调 EU_GetPageHeaderAction：取动作。 |
| 1178 | `NE页头_设置返回文本直调` | `NE页头_设置返回文本直调(hwnd, element_id, back_bytes, back_len)` | void | NE页头_设置返回文本 的底层直调版本：设置返回文本。一般请用高层封装 NE页头_设置返回文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1179 | `NE页头_设置活动动作` | `NE页头_设置活动动作(hwnd, element_id, action_index)` | void | 底层直调 EU_SetPageHeaderActiveAction：设置活动动作。 |
| 1180 | `NE页头_设置面包屑激活` | `NE页头_设置面包屑激活(hwnd, element_id, breadcrumb_index)` | void | 底层直调 EU_SetPageHeaderBreadcrumbActive：设置面包屑激活。 |
| 1181 | `NE页头_触发返回` | `NE页头_触发返回(hwnd, element_id)` | void | 底层直调 EU_TriggerPageHeaderBack：触发返回。 |
| 1182 | `NE页头_重置结果` | `NE页头_重置结果(hwnd, element_id)` | void | 底层直调 EU_ResetPageHeaderResult：重置结果。 |
| 1183 | `NE页头_取状态` | `NE页头_取状态(hwnd, element_id, active_action, action_count, active_breadcrumb, breadcrumb_count, back_clicked_count, back_hovered, action_hover, breadcrumb_hover)` | int | 底层直调 EU_GetPageHeaderState：取状态。 |
| 1184 | `NE固钉_设置文本` | `NE固钉_设置文本(hwnd, element_id, title_bytes, title_len, body_bytes, body_len)` | void | 底层直调 EU_SetAffixText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1185 | `NE固钉_设置状态` | `NE固钉_设置状态(hwnd, element_id, scroll_position, offset)` | void | 底层直调 EU_SetAffixState：设置状态。 |
| 1186 | `NE固钉_取固定` | `NE固钉_取固定(hwnd, element_id)` | int | 底层直调 EU_GetAffixFixed：取固定。 |
| 1187 | `NE固钉_取状态` | `NE固钉_取状态(hwnd, element_id, scroll_position, offset, fixed)` | int | 底层直调 EU_GetAffixState：取状态。 |
| 1188 | `NE固钉_设置选项` | `NE固钉_设置选项(hwnd, element_id, scroll_position, offset, container_id, placeholder_height, z_index)` | void | 底层直调 EU_SetAffixOptions：设置选项。 |
| 1189 | `NE固钉_取选项` | `NE固钉_取选项(hwnd, element_id, scroll_position, offset, fixed, container_id, placeholder_height, fixed_top, z_index)` | int | 底层直调 EU_GetAffixOptions：取选项。 |
| 1190 | `NE水印_设置内容` | `NE水印_设置内容(hwnd, element_id, content_bytes, content_len)` | void | 底层直调 EU_SetWatermarkContent：设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1191 | `NE水印_设置选项` | `NE水印_设置选项(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha)` | void | 底层直调 EU_SetWatermarkOptions：设置选项。 |
| 1192 | `NE水印_取选项` | `NE水印_取选项(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha)` | int | 底层直调 EU_GetWatermarkOptions：取选项。 |
| 1193 | `NE水印_设置层` | `NE水印_设置层(hwnd, element_id, container_id, overlay, pass_through, z_index)` | void | 底层直调 EU_SetWatermarkLayer：设置层。 |
| 1194 | `NE水印_取完整选项` | `NE水印_取完整选项(hwnd, element_id, gap_x, gap_y, rotation_degrees, alpha, container_id, overlay, pass_through, z_index, tile_count_x, tile_count_y)` | int | 底层直调 EU_GetWatermarkFullOptions：取完整选项。 |
| 1195 | `NE漫游引导_设置步骤直调` | `NE漫游引导_设置步骤直调(hwnd, element_id, steps_bytes, steps_len)` | void | NE漫游引导_设置步骤 的底层直调版本：设置步骤。一般请用高层封装 NE漫游引导_设置步骤。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1196 | `NE漫游引导_设置活动` | `NE漫游引导_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetTourActive：设置活动。 |
| 1197 | `NE漫游引导_设置打开` | `NE漫游引导_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetTourOpen：设置打开。 |
| 1198 | `NE漫游引导_设置选项` | `NE漫游引导_设置选项(hwnd, element_id, open, mask, target_x, target_y, target_w, target_h)` | void | 底层直调 EU_SetTourOptions：设置选项。 |
| 1199 | `NE漫游引导_设置目标元素` | `NE漫游引导_设置目标元素(hwnd, element_id, target_element_id, padding)` | void | 底层直调 EU_SetTourTargetElement：设置目标元素。 |
| 1200 | `NE漫游引导_设置遮罩行为` | `NE漫游引导_设置遮罩行为(hwnd, element_id, pass_through, close_on_mask)` | void | 底层直调 EU_SetTourMaskBehavior：设置遮罩行为。 |
| 1201 | `NE漫游引导_取活动` | `NE漫游引导_取活动(hwnd, element_id)` | int | 底层直调 EU_GetTourActive：取活动。 |
| 1202 | `NE漫游引导_取打开` | `NE漫游引导_取打开(hwnd, element_id)` | int | 底层直调 EU_GetTourOpen：取打开。 |
| 1203 | `NE漫游引导_取步骤数` | `NE漫游引导_取步骤数(hwnd, element_id)` | int | 底层直调 EU_GetTourStepCount：取步骤数。 |
| 1204 | `NE漫游引导_取选项` | `NE漫游引导_取选项(hwnd, element_id, open, mask, target_x, target_y, target_w, target_h)` | int | 底层直调 EU_GetTourOptions：取选项。 |
| 1205 | `NE漫游引导_取完整状态` | `NE漫游引导_取完整状态(hwnd, element_id, active_index, step_count, open, mask, target_x, target_y, target_w, target_h, target_element_id, mask_passthrough, close_on_mask, last_action, change_count)` | int | 底层直调 EU_GetTourFullState：取完整状态。 |
| 1206 | `NE图片_设置来源` | `NE图片_设置来源(hwnd, element_id, src_bytes, src_len, alt_bytes, alt_len)` | void | 底层直调 EU_SetImageSource：设置来源。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1207 | `NE图片_投递设置来源` | `NE图片_投递设置来源(hwnd, element_id, src_bytes, src_len, alt_bytes, alt_len)` | int | 底层直调 EU_PostSetImageSource：投递设置来源。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1208 | `NE图片_设置填充方式` | `NE图片_设置填充方式(hwnd, element_id, fit)` | void | 底层直调 EU_SetImageFit：设置填充方式。 |
| 1209 | `NE图片_设置样式` | `NE图片_设置样式(hwnd, element_id, bg, border, border_width, radius, padding)` | void | 底层直调 EU_SetImageStyle：设置样式。 |
| 1210 | `NE图片_取样式` | `NE图片_取样式(hwnd, element_id, bg, border, border_width, radius, padding)` | int | 底层直调 EU_GetImageStyle：取样式。 |
| 1211 | `NE图片_设置预览` | `NE图片_设置预览(hwnd, element_id, open)` | void | 底层直调 EU_SetImagePreview：设置预览。 |
| 1212 | `NE图片_投递设置预览` | `NE图片_投递设置预览(hwnd, element_id, open)` | int | 底层直调 EU_PostSetImagePreview：投递设置预览。 |
| 1213 | `NE图片_设置预览启用` | `NE图片_设置预览启用(hwnd, element_id, enabled)` | void | 底层直调 EU_SetImagePreviewEnabled：设置预览启用。 |
| 1214 | `NE图片_设置预览变换` | `NE图片_设置预览变换(hwnd, element_id, scale_percent, offset_x, offset_y)` | void | 底层直调 EU_SetImagePreviewTransform：设置预览变换。 |
| 1215 | `NE图片_设置缓存启用` | `NE图片_设置缓存启用(hwnd, element_id, enabled)` | void | 底层直调 EU_SetImageCacheEnabled：设置缓存启用。 |
| 1216 | `NE图片_设置懒加载` | `NE图片_设置懒加载(hwnd, element_id, lazy)` | void | 底层直调 EU_SetImageLazy：设置懒加载。 |
| 1217 | `NE图片_设置占位提示` | `NE图片_设置占位提示(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | void | 底层直调 EU_SetImagePlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1218 | `NE图片_投递设置占位提示` | `NE图片_投递设置占位提示(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | int | 底层直调 EU_PostSetImagePlaceholder：投递设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1219 | `NE图片_设置错误内容` | `NE图片_设置错误内容(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | void | 底层直调 EU_SetImageErrorContent：设置错误内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1220 | `NE图片_投递设置错误内容` | `NE图片_投递设置错误内容(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, fg, bg)` | int | 底层直调 EU_PostSetImageErrorContent：投递设置错误内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1221 | `NE图片_设置预览列表` | `NE图片_设置预览列表(hwnd, element_id, sources_bytes, sources_len, selected_index)` | void | 底层直调 EU_SetImagePreviewList：设置预览列表。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1222 | `NE图片_投递设置预览列表` | `NE图片_投递设置预览列表(hwnd, element_id, sources_bytes, sources_len, selected_index)` | int | 底层直调 EU_PostSetImagePreviewList：投递设置预览列表。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1223 | `NE图片_设置预览索引` | `NE图片_设置预览索引(hwnd, element_id, index)` | void | 底层直调 EU_SetImagePreviewIndex：设置预览索引。 |
| 1224 | `NE图片_投递设置预览索引` | `NE图片_投递设置预览索引(hwnd, element_id, index)` | int | 底层直调 EU_PostSetImagePreviewIndex：投递设置预览索引。 |
| 1225 | `NE图片_取状态` | `NE图片_取状态(hwnd, element_id)` | int | 底层直调 EU_GetImageStatus：取状态。 |
| 1226 | `NE图片_取预览打开` | `NE图片_取预览打开(hwnd, element_id)` | int | 底层直调 EU_GetImagePreviewOpen：取预览打开。 |
| 1227 | `NE图片_取选项` | `NE图片_取选项(hwnd, element_id, fit, preview_enabled, preview_open, status)` | int | 底层直调 EU_GetImageOptions：取选项。 |
| 1228 | `NE图片_取完整选项` | `NE图片_取完整选项(hwnd, element_id, fit, preview_enabled, preview_open, status, scale_percent, offset_x, offset_y, cache_enabled, reload_count, bitmap_width, bitmap_height)` | int | 底层直调 EU_GetImageFullOptions：取完整选项。 |
| 1229 | `NE图片_取高级选项` | `NE图片_取高级选项(hwnd, element_id, fit, lazy, preview_enabled, preview_open, preview_index, preview_count, status, scale_percent, offset_x, offset_y)` | int | 底层直调 EU_GetImageAdvancedOptions：取高级选项。 |
| 1230 | `NE轮播_设置项` | `NE轮播_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetCarouselItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1231 | `NE轮播_投递设置项` | `NE轮播_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetCarouselItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1232 | `NE轮播_设置活动` | `NE轮播_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetCarouselActive：设置活动。 |
| 1233 | `NE轮播_投递设置活动` | `NE轮播_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetCarouselActive：投递设置活动。 |
| 1234 | `NE轮播_设置选项` | `NE轮播_设置选项(hwnd, element_id, loop, indicator_position, show_arrows, show_indicators)` | void | 底层直调 EU_SetCarouselOptions：设置选项。 |
| 1235 | `NE轮播_设置行为` | `NE轮播_设置行为(hwnd, element_id, trigger_mode, arrow_mode, direction, carousel_type, pause_on_hover)` | void | 底层直调 EU_SetCarouselBehavior：设置行为。 |
| 1236 | `NE轮播_取行为` | `NE轮播_取行为(hwnd, element_id, trigger_mode, arrow_mode, direction, carousel_type, pause_on_hover)` | int | 底层直调 EU_GetCarouselBehavior：取行为。 |
| 1237 | `NE轮播_设置视觉` | `NE轮播_设置视觉(hwnd, element_id, text_color, text_alpha, text_font_size, odd_bg, even_bg, panel_bg, active_indicator, inactive_indicator, card_scale_percent)` | void | 底层直调 EU_SetCarouselVisual：设置视觉。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1238 | `NE轮播_取视觉` | `NE轮播_取视觉(hwnd, element_id, text_color, text_alpha, text_font_size, odd_bg, even_bg, panel_bg, active_indicator, inactive_indicator, card_scale_percent)` | int | 底层直调 EU_GetCarouselVisual：取视觉。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1239 | `NE轮播_设置自动播放` | `NE轮播_设置自动播放(hwnd, element_id, enabled, interval_ms)` | void | 底层直调 EU_SetCarouselAutoplay：设置自动播放。 |
| 1240 | `NE轮播_设置动画` | `NE轮播_设置动画(hwnd, element_id, transition_ms)` | void | 底层直调 EU_SetCarouselAnimation：设置动画。 |
| 1241 | `NE轮播_切到下一张` | `NE轮播_切到下一张(hwnd, element_id, delta)` | void | 底层直调 EU_CarouselAdvance：切到下一张。 |
| 1242 | `NE轮播_步进` | `NE轮播_步进(hwnd, element_id, elapsed_ms)` | void | 底层直调 EU_CarouselTick：步进。 |
| 1243 | `NE轮播_取活动` | `NE轮播_取活动(hwnd, element_id)` | int | 底层直调 EU_GetCarouselActive：取活动。 |
| 1244 | `NE轮播_取项数量` | `NE轮播_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetCarouselItemCount：取项数量。 |
| 1245 | `NE轮播_取选项` | `NE轮播_取选项(hwnd, element_id, loop, indicator_position, show_arrows, show_indicators, autoplay, interval_ms)` | int | 底层直调 EU_GetCarouselOptions：取选项。 |
| 1246 | `NE轮播_取完整状态` | `NE轮播_取完整状态(hwnd, element_id, active_index, previous_index, item_count, loop, indicator_position, show_arrows, show_indicators, autoplay, interval_ms, autoplay_tick, autoplay_elapsed_ms, transition_ms, transition_progress, transition_direction, last_action, change_count)` | int | 底层直调 EU_GetCarouselFullState：取完整状态。 |
| 1247 | `NE上传_设置文件` | `NE上传_设置文件(hwnd, element_id, files_bytes, files_len)` | void | 底层直调 EU_SetUploadFiles：设置文件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1248 | `NE上传_投递设置文件` | `NE上传_投递设置文件(hwnd, element_id, files_bytes, files_len)` | int | 底层直调 EU_PostSetUploadFiles：投递设置文件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1249 | `NE上传_设置文件项` | `NE上传_设置文件项(hwnd, element_id, files_bytes, files_len)` | void | 底层直调 EU_SetUploadFileItems：设置文件项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1250 | `NE上传_投递设置文件项` | `NE上传_投递设置文件项(hwnd, element_id, files_bytes, files_len)` | int | 底层直调 EU_PostSetUploadFileItems：投递设置文件项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1251 | `NE上传_设置选项` | `NE上传_设置选项(hwnd, element_id, multiple, auto_upload)` | void | 底层直调 EU_SetUploadOptions：设置选项。 |
| 1252 | `NE上传_设置样式` | `NE上传_设置样式(hwnd, element_id, style_mode, show_file_list, show_tip, show_actions, drop_enabled)` | void | 底层直调 EU_SetUploadStyle：设置样式。 |
| 1253 | `NE上传_取样式` | `NE上传_取样式(hwnd, element_id, style_mode, show_file_list, show_tip, show_actions, drop_enabled)` | int | 底层直调 EU_GetUploadStyle：取样式。 |
| 1254 | `NE上传_设置文本` | `NE上传_设置文本(hwnd, element_id, title_bytes, title_len, tip_bytes, tip_len, trigger_bytes, trigger_len, submit_bytes, submit_len)` | void | 底层直调 EU_SetUploadTexts：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1255 | `NE上传_设置约束` | `NE上传_设置约束(hwnd, element_id, limit, max_size_kb, accept_bytes, accept_len)` | void | 底层直调 EU_SetUploadConstraints：设置约束。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1256 | `NE上传_取约束` | `NE上传_取约束(hwnd, element_id, limit, max_size_kb, accept_buffer, accept_buffer_size)` | int | 底层直调 EU_GetUploadConstraints：取约束。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1257 | `NE上传_设置预览打开` | `NE上传_设置预览打开(hwnd, element_id, file_index, open)` | void | 底层直调 EU_SetUploadPreviewOpen：设置预览打开。 |
| 1258 | `NE上传_投递设置预览打开` | `NE上传_投递设置预览打开(hwnd, element_id, file_index, open)` | int | 底层直调 EU_PostSetUploadPreviewOpen：投递设置预览打开。 |
| 1259 | `NE上传_取预览状态` | `NE上传_取预览状态(hwnd, element_id, file_index, open)` | int | 底层直调 EU_GetUploadPreviewState：取预览状态。 |
| 1260 | `NE上传_设置已选文件` | `NE上传_设置已选文件(hwnd, element_id, files_bytes, files_len)` | void | 底层直调 EU_SetUploadSelectedFiles：设置已选文件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1261 | `NE上传_投递设置已选文件` | `NE上传_投递设置已选文件(hwnd, element_id, files_bytes, files_len)` | int | 底层直调 EU_PostSetUploadSelectedFiles：投递设置已选文件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1262 | `NE上传_设置文件状态` | `NE上传_设置文件状态(hwnd, element_id, file_index, status, progress)` | void | 底层直调 EU_SetUploadFileStatus：设置文件状态。 |
| 1263 | `NE上传_投递设置文件状态` | `NE上传_投递设置文件状态(hwnd, element_id, file_index, status, progress)` | int | 底层直调 EU_PostSetUploadFileStatus：投递设置文件状态。 |
| 1264 | `NE上传_移除文件` | `NE上传_移除文件(hwnd, element_id, file_index)` | void | 底层直调 EU_RemoveUploadFile：移除文件。 |
| 1265 | `NE上传_重试文件` | `NE上传_重试文件(hwnd, element_id, file_index)` | void | 底层直调 EU_RetryUploadFile：重试文件。 |
| 1266 | `NE上传_清空文件` | `NE上传_清空文件(hwnd, element_id)` | void | 底层直调 EU_ClearUploadFiles：清空文件。 |
| 1267 | `NE上传_打开文件选择对话框` | `NE上传_打开文件选择对话框(hwnd, element_id)` | int | 底层直调 EU_OpenUploadFileDialog：打开文件选择对话框。 |
| 1268 | `NE上传_开始` | `NE上传_开始(hwnd, element_id, file_index)` | int | 底层直调 EU_StartUpload：开始。 |
| 1269 | `NE上传_取文件数` | `NE上传_取文件数(hwnd, element_id)` | int | 底层直调 EU_GetUploadFileCount：取文件数。 |
| 1270 | `NE上传_取文件状态` | `NE上传_取文件状态(hwnd, element_id, file_index, status, progress)` | int | 底层直调 EU_GetUploadFileStatus：取文件状态。 |
| 1271 | `NE上传_取已选文件` | `NE上传_取已选文件(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetUploadSelectedFiles：取已选文件。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1272 | `NE上传_取文件名` | `NE上传_取文件名(hwnd, element_id, file_index, buffer, buffer_size)` | int | 底层直调 EU_GetUploadFileName：取文件名。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1273 | `NE上传_取完整状态` | `NE上传_取完整状态(hwnd, element_id, file_count, selected_count, last_selected_count, upload_request_count, retry_count, remove_count, last_action, waiting_count, uploading_count, success_count, failed_count, multiple, auto_upload)` | int | 底层直调 EU_GetUploadFullState：取完整状态。 |
| 1274 | `NE上传_设置选择回调` | `NE上传_设置选择回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetUploadSelectCallback：设置选择回调。处理器实参必须写 &处理器名。 |
| 1275 | `NE上传_设置动作回调` | `NE上传_设置动作回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetUploadActionCallback：设置动作回调。处理器实参必须写 &处理器名。 |
| 1276 | `NE无限滚动_设置项` | `NE无限滚动_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetInfiniteScrollItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1277 | `NE无限滚动_投递设置项` | `NE无限滚动_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetInfiniteScrollItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1278 | `NE无限滚动_追加项` | `NE无限滚动_追加项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_AppendInfiniteScrollItems：追加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1279 | `NE无限滚动_清空项` | `NE无限滚动_清空项(hwnd, element_id)` | void | 底层直调 EU_ClearInfiniteScrollItems：清空项。 |
| 1280 | `NE无限滚动_设置状态` | `NE无限滚动_设置状态(hwnd, element_id, loading, no_more, disabled)` | void | 底层直调 EU_SetInfiniteScrollState：设置状态。 |
| 1281 | `NE无限滚动_投递设置状态` | `NE无限滚动_投递设置状态(hwnd, element_id, loading, no_more, disabled)` | int | 底层直调 EU_PostSetInfiniteScrollState：投递设置状态。 |
| 1282 | `NE无限滚动_设置选项` | `NE无限滚动_设置选项(hwnd, element_id, item_height, gap, threshold, style_mode, show_scrollbar, show_index)` | void | 底层直调 EU_SetInfiniteScrollOptions：设置选项。 |
| 1283 | `NE无限滚动_设置文本` | `NE无限滚动_设置文本(hwnd, element_id, loading_bytes, loading_len, no_more_bytes, no_more_len, empty_bytes, empty_len)` | void | 底层直调 EU_SetInfiniteScrollTexts：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1284 | `NE无限滚动_设置滚动` | `NE无限滚动_设置滚动(hwnd, element_id, scroll_y)` | void | 底层直调 EU_SetInfiniteScrollScroll：设置滚动。 |
| 1285 | `NE无限滚动_投递设置滚动` | `NE无限滚动_投递设置滚动(hwnd, element_id, scroll_y)` | int | 底层直调 EU_PostSetInfiniteScrollScroll：投递设置滚动。 |
| 1286 | `NE无限滚动_取完整状态` | `NE无限滚动_取完整状态(hwnd, element_id, item_count, scroll_y, max_scroll, content_height, viewport_height, loading, no_more, disabled, load_count, change_count, last_action, threshold, style_mode, show_scrollbar, show_index)` | int | 底层直调 EU_GetInfiniteScrollFullState：取完整状态。 |
| 1287 | `NE无限滚动_设置加载回调` | `NE无限滚动_设置加载回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetInfiniteScrollLoadCallback：设置加载回调。处理器实参必须写 &处理器名。 |
| 1288 | `NE面包屑_设置项` | `NE面包屑_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetBreadcrumbItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1289 | `NE面包屑_投递设置项` | `NE面包屑_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetBreadcrumbItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1290 | `NE面包屑_设置分隔符直调` | `NE面包屑_设置分隔符直调(hwnd, element_id, separator_bytes, separator_len)` | void | NE面包屑_设置分隔符 的底层直调版本：设置分隔符。一般请用高层封装 NE面包屑_设置分隔符。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1291 | `NE面包屑_设置当前` | `NE面包屑_设置当前(hwnd, element_id, current_index)` | void | 底层直调 EU_SetBreadcrumbCurrent：设置当前。 |
| 1292 | `NE面包屑_投递设置当前` | `NE面包屑_投递设置当前(hwnd, element_id, current_index)` | int | 底层直调 EU_PostSetBreadcrumbCurrent：投递设置当前。 |
| 1293 | `NE面包屑_触发点击` | `NE面包屑_触发点击(hwnd, element_id, item_index)` | void | 底层直调 EU_TriggerBreadcrumbClick：触发点击。 |
| 1294 | `NE面包屑_取当前` | `NE面包屑_取当前(hwnd, element_id)` | int | 底层直调 EU_GetBreadcrumbCurrent：取当前。 |
| 1295 | `NE面包屑_取项数量` | `NE面包屑_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetBreadcrumbItemCount：取项数量。 |
| 1296 | `NE面包屑_取状态` | `NE面包屑_取状态(hwnd, element_id, current_index, item_count)` | int | 底层直调 EU_GetBreadcrumbState：取状态。 |
| 1297 | `NE面包屑_取指定项` | `NE面包屑_取指定项(hwnd, element_id, item_index, buffer, buffer_size)` | int | 底层直调 EU_GetBreadcrumbItem：取指定项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1298 | `NE面包屑_取完整状态` | `NE面包屑_取完整状态(hwnd, element_id, current_index, item_count, hover_index, press_index, last_clicked_index, click_count, last_action)` | int | 底层直调 EU_GetBreadcrumbFullState：取完整状态。 |
| 1299 | `NE面包屑_设置选择回调` | `NE面包屑_设置选择回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetBreadcrumbSelectCallback：设置选择回调。处理器实参必须写 &处理器名。 |
| 1300 | `NE标签页_设置项` | `NE标签页_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetTabsItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1301 | `NE标签页_投递设置项` | `NE标签页_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetTabsItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1302 | `NE标签页_设置项扩展` | `NE标签页_设置项扩展(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetTabsItemsEx：设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1303 | `NE标签页_投递设置项扩展` | `NE标签页_投递设置项扩展(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetTabsItemsEx：投递设置项扩展。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1304 | `NE标签页_设置活动` | `NE标签页_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetTabsActive：设置活动。 |
| 1305 | `NE标签页_投递设置活动` | `NE标签页_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetTabsActive：投递设置活动。 |
| 1306 | `NE标签页_设置活动名称` | `NE标签页_设置活动名称(hwnd, element_id, name_bytes, name_len)` | void | 底层直调 EU_SetTabsActiveName：设置活动名称。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1307 | `NE标签页_投递设置活动名称` | `NE标签页_投递设置活动名称(hwnd, element_id, name_bytes, name_len)` | int | 底层直调 EU_PostSetTabsActiveName：投递设置活动名称。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1308 | `NE标签页_设置类型` | `NE标签页_设置类型(hwnd, element_id, tab_type)` | void | 底层直调 EU_SetTabsType：设置类型。 |
| 1309 | `NE标签页_设置位置` | `NE标签页_设置位置(hwnd, element_id, tab_position)` | void | 底层直调 EU_SetTabsPosition：设置位置。 |
| 1310 | `NE标签页_设置标签头对齐` | `NE标签页_设置标签头对齐(hwnd, element_id, align)` | void | 底层直调 EU_SetTabsHeaderAlign：设置标签头对齐。 |
| 1311 | `NE标签页_设置标签头可见` | `NE标签页_设置标签头可见(hwnd, element_id, visible)` | void | 底层直调 EU_SetTabsHeaderVisible：设置标签头可见。 |
| 1312 | `NE标签页_设置选项` | `NE标签页_设置选项(hwnd, element_id, tab_type, closable, addable)` | void | 底层直调 EU_SetTabsOptions：设置选项。 |
| 1313 | `NE标签页_设置可编辑直调` | `NE标签页_设置可编辑直调(hwnd, element_id, editable)` | void | NE标签页_设置可编辑 的底层直调版本：设置可编辑。一般请用高层封装 NE标签页_设置可编辑。 |
| 1314 | `NE标签页_设置内容可见直调` | `NE标签页_设置内容可见直调(hwnd, element_id, visible)` | void | NE标签页_设置内容可见 的底层直调版本：设置内容可见。一般请用高层封装 NE标签页_设置内容可见。 |
| 1315 | `NE标签页_设置页签内容元素` | `NE标签页_设置页签内容元素(hwnd, element_id, ids_bytes, ids_len)` | void | 底层直调 EU_SetTabsPageElements：设置页签内容元素。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1316 | `NE标签页_添加项` | `NE标签页_添加项(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_AddTabsItem：添加项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1317 | `NE标签页_关闭项` | `NE标签页_关闭项(hwnd, element_id, item_index)` | void | 底层直调 EU_CloseTabsItem：关闭项。 |
| 1318 | `NE标签页_设置滚动` | `NE标签页_设置滚动(hwnd, element_id, offset)` | void | 底层直调 EU_SetTabsScroll：设置滚动。 |
| 1319 | `NE标签页_滚动直调` | `NE标签页_滚动直调(hwnd, element_id, delta)` | void | NE标签页_滚动 的底层直调版本：滚动。一般请用高层封装 NE标签页_滚动。 |
| 1320 | `NE标签页_取活动` | `NE标签页_取活动(hwnd, element_id)` | int | 底层直调 EU_GetTabsActive：取活动。 |
| 1321 | `NE标签页_取标签头对齐` | `NE标签页_取标签头对齐(hwnd, element_id)` | int | 底层直调 EU_GetTabsHeaderAlign：取标签头对齐。 |
| 1322 | `NE标签页_取标签头可见` | `NE标签页_取标签头可见(hwnd, element_id)` | int | 底层直调 EU_GetTabsHeaderVisible：取标签头可见。 |
| 1323 | `NE标签页_取项数量` | `NE标签页_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetTabsItemCount：取项数量。 |
| 1324 | `NE标签页_取状态` | `NE标签页_取状态(hwnd, element_id, active_index, item_count, tab_type)` | int | 底层直调 EU_GetTabsState：取状态。 |
| 1325 | `NE标签页_取指定页签` | `NE标签页_取指定页签(hwnd, element_id, item_index, buffer, buffer_size)` | int | 底层直调 EU_GetTabsItem：取指定页签。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1326 | `NE标签页_取活动名称` | `NE标签页_取活动名称(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetTabsActiveName：取活动名称。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1327 | `NE标签页_取项内容` | `NE标签页_取项内容(hwnd, element_id, item_index, buffer, buffer_size)` | int | 底层直调 EU_GetTabsItemContent：取项内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1328 | `NE标签页_取完整状态` | `NE标签页_取完整状态(hwnd, element_id, active_index, item_count, tab_type, closable, addable, scroll_offset, max_scroll_offset, hover_index, press_index, hover_part, press_part, last_closed_index, last_added_index, close_count, add_count, select_count, scroll_count, last_action)` | int | 底层直调 EU_GetTabsFullState：取完整状态。 |
| 1329 | `NE标签页_取完整状态扩展` | `NE标签页_取完整状态扩展(hwnd, element_id, active_index, item_count, tab_type, closable, addable, scroll_offset, max_scroll_offset, hover_index, press_index, hover_part, press_part, last_closed_index, last_added_index, close_count, add_count, select_count, scroll_count, last_action, tab_position, editable, content_visible, active_disabled, active_closable)` | int | 底层直调 EU_GetTabsFullStateEx：取完整状态扩展。 |
| 1330 | `NE标签页_设置变化回调` | `NE标签页_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTabsChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 1331 | `NE标签页_设置关闭回调` | `NE标签页_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTabsCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1332 | `NE标签页_设置添加回调` | `NE标签页_设置添加回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTabsAddCallback：设置添加回调。处理器实参必须写 &处理器名。 |
| 1333 | `NE分页_设置` | `NE分页_设置(hwnd, element_id, total, page_size, current_page)` | void | 底层直调 EU_SetPagination：设置。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1334 | `NE分页_设置当前` | `NE分页_设置当前(hwnd, element_id, current_page)` | void | 底层直调 EU_SetPaginationCurrent：设置当前。 |
| 1335 | `NE分页_投递设置当前` | `NE分页_投递设置当前(hwnd, element_id, current_page)` | int | 底层直调 EU_PostSetPaginationCurrent：投递设置当前。 |
| 1336 | `NE分页_设置每页条数` | `NE分页_设置每页条数(hwnd, element_id, page_size)` | void | 底层直调 EU_SetPaginationPageSize：设置每页条数。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1337 | `NE分页_投递设置每页条数` | `NE分页_投递设置每页条数(hwnd, element_id, page_size)` | int | 底层直调 EU_PostSetPaginationPageSize：投递设置每页条数。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1338 | `NE分页_设置选项` | `NE分页_设置选项(hwnd, element_id, show_jumper, show_size_changer, visible_page_count)` | void | 底层直调 EU_SetPaginationOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1339 | `NE分页_设置高级选项` | `NE分页_设置高级选项(hwnd, element_id, background, small_style, hide_on_single_page)` | void | 底层直调 EU_SetPaginationAdvancedOptions：设置高级选项。 |
| 1340 | `NE分页_设置每页条数选项` | `NE分页_设置每页条数选项(hwnd, element_id, sizes, count)` | void | 底层直调 EU_SetPaginationPageSizeOptions：设置每页条数选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1341 | `NE分页_设置跳页` | `NE分页_设置跳页(hwnd, element_id, jump_page)` | void | 底层直调 EU_SetPaginationJumpPage：设置跳页。 |
| 1342 | `NE分页_投递设置跳页` | `NE分页_投递设置跳页(hwnd, element_id, jump_page)` | int | 底层直调 EU_PostSetPaginationJumpPage：投递设置跳页。 |
| 1343 | `NE分页_触发跳转` | `NE分页_触发跳转(hwnd, element_id)` | void | 底层直调 EU_TriggerPaginationJump：触发跳转。 |
| 1344 | `NE分页_下一档每页条数` | `NE分页_下一档每页条数(hwnd, element_id)` | void | 底层直调 EU_NextPaginationPageSize：下一档每页条数。 |
| 1345 | `NE分页_取当前` | `NE分页_取当前(hwnd, element_id)` | int | 底层直调 EU_GetPaginationCurrent：取当前。 |
| 1346 | `NE分页_取页数` | `NE分页_取页数(hwnd, element_id)` | int | 底层直调 EU_GetPaginationPageCount：取页数。 |
| 1347 | `NE分页_取状态` | `NE分页_取状态(hwnd, element_id, total, page_size, current_page, page_count)` | int | 底层直调 EU_GetPaginationState：取状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1348 | `NE分页_取完整状态` | `NE分页_取完整状态(hwnd, element_id, total, page_size, current_page, page_count, jump_page, visible_page_count, show_jumper, show_size_changer, hover_part, press_part, change_count, size_change_count, jump_count, last_action)` | int | 底层直调 EU_GetPaginationFullState：取完整状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1349 | `NE分页_取高级选项` | `NE分页_取高级选项(hwnd, element_id, background, small_style, hide_on_single_page)` | int | 底层直调 EU_GetPaginationAdvancedOptions：取高级选项。 |
| 1350 | `NE分页_设置变化回调` | `NE分页_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetPaginationChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 1351 | `NE步骤条_设置项` | `NE步骤条_设置项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetStepsItems：设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1352 | `NE步骤条_投递设置项` | `NE步骤条_投递设置项(hwnd, element_id, items_bytes, items_len)` | int | 底层直调 EU_PostSetStepsItems：投递设置项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1353 | `NE步骤条_设置明细项` | `NE步骤条_设置明细项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetStepsDetailItems：设置明细项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1354 | `NE步骤条_设置图标步骤项` | `NE步骤条_设置图标步骤项(hwnd, element_id, items_bytes, items_len)` | void | 底层直调 EU_SetStepsIconItems：设置图标步骤项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1355 | `NE步骤条_设置活动` | `NE步骤条_设置活动(hwnd, element_id, active_index)` | void | 底层直调 EU_SetStepsActive：设置活动。 |
| 1356 | `NE步骤条_投递设置活动` | `NE步骤条_投递设置活动(hwnd, element_id, active_index)` | int | 底层直调 EU_PostSetStepsActive：投递设置活动。 |
| 1357 | `NE步骤条_设置方向` | `NE步骤条_设置方向(hwnd, element_id, direction)` | void | 底层直调 EU_SetStepsDirection：设置方向。 |
| 1358 | `NE步骤条_设置选项` | `NE步骤条_设置选项(hwnd, element_id, space, align_center, simple, finish_status, process_status)` | void | 底层直调 EU_SetStepsOptions：设置选项。 |
| 1359 | `NE步骤条_取选项` | `NE步骤条_取选项(hwnd, element_id, space, align_center, simple, finish_status, process_status)` | int | 底层直调 EU_GetStepsOptions：取选项。 |
| 1360 | `NE步骤条_设置状态列表` | `NE步骤条_设置状态列表(hwnd, element_id, statuses, count)` | void | 底层直调 EU_SetStepsStatuses：设置状态列表。 |
| 1361 | `NE步骤条_投递设置状态列表` | `NE步骤条_投递设置状态列表(hwnd, element_id, statuses, count)` | int | 底层直调 EU_PostSetStepsStatuses：投递设置状态列表。 |
| 1362 | `NE步骤条_触发点击` | `NE步骤条_触发点击(hwnd, element_id, item_index)` | void | 底层直调 EU_TriggerStepsClick：触发点击。 |
| 1363 | `NE步骤条_取活动` | `NE步骤条_取活动(hwnd, element_id)` | int | 底层直调 EU_GetStepsActive：取活动。 |
| 1364 | `NE步骤条_取项数量` | `NE步骤条_取项数量(hwnd, element_id)` | int | 底层直调 EU_GetStepsItemCount：取项数量。 |
| 1365 | `NE步骤条_取状态` | `NE步骤条_取状态(hwnd, element_id, active_index, item_count, direction)` | int | 底层直调 EU_GetStepsState：取状态。 |
| 1366 | `NE步骤条_取指定步骤` | `NE步骤条_取指定步骤(hwnd, element_id, item_index, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetStepsItem：取指定步骤。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1367 | `NE步骤条_取完整状态` | `NE步骤条_取完整状态(hwnd, element_id, active_index, item_count, direction, hover_index, press_index, last_clicked_index, click_count, change_count, last_action, active_status, failed_count)` | int | 底层直调 EU_GetStepsFullState：取完整状态。 |
| 1368 | `NE步骤条_取视觉状态` | `NE步骤条_取视觉状态(hwnd, element_id, space, align_center, simple, finish_status, process_status, icon_count)` | int | 底层直调 EU_GetStepsVisualState：取视觉状态。 |
| 1369 | `NE步骤条_设置变化回调` | `NE步骤条_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetStepsChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 1370 | `NE警告提示_设置描述直调` | `NE警告提示_设置描述直调(hwnd, element_id, desc_bytes, desc_len)` | void | NE警告提示_设置描述 的底层直调版本：设置描述。一般请用高层封装 NE警告提示_设置描述。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1371 | `NE警告提示_投递设置描述` | `NE警告提示_投递设置描述(hwnd, element_id, desc_bytes, desc_len)` | int | 底层直调 EU_PostSetAlertDescription：投递设置描述。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1372 | `NE警告提示_设置类型` | `NE警告提示_设置类型(hwnd, element_id, alert_type)` | void | 底层直调 EU_SetAlertType：设置类型。 |
| 1373 | `NE警告提示_投递设置类型` | `NE警告提示_投递设置类型(hwnd, element_id, alert_type)` | int | 底层直调 EU_PostSetAlertType：投递设置类型。 |
| 1374 | `NE警告提示_设置效果` | `NE警告提示_设置效果(hwnd, element_id, effect)` | void | 底层直调 EU_SetAlertEffect：设置效果。 |
| 1375 | `NE警告提示_设置可关闭` | `NE警告提示_设置可关闭(hwnd, element_id, closable)` | void | 底层直调 EU_SetAlertClosable：设置可关闭。 |
| 1376 | `NE警告提示_设置高级选项` | `NE警告提示_设置高级选项(hwnd, element_id, show_icon, center, wrap_description)` | void | 底层直调 EU_SetAlertAdvancedOptions：设置高级选项。 |
| 1377 | `NE警告提示_取高级选项` | `NE警告提示_取高级选项(hwnd, element_id, show_icon, center, wrap_description)` | int | 底层直调 EU_GetAlertAdvancedOptions：取高级选项。 |
| 1378 | `NE警告提示_设置关闭文本` | `NE警告提示_设置关闭文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetAlertCloseText：设置关闭文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1379 | `NE警告提示_取文本` | `NE警告提示_取文本(hwnd, element_id, text_type, out_bytes, out_len)` | int | 底层直调 EU_GetAlertText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1380 | `NE警告提示_设置关闭` | `NE警告提示_设置关闭(hwnd, element_id, closed)` | void | 底层直调 EU_SetAlertClosed：设置关闭。 |
| 1381 | `NE警告提示_投递设置关闭` | `NE警告提示_投递设置关闭(hwnd, element_id, closed)` | int | 底层直调 EU_PostSetAlertClosed：投递设置关闭。 |
| 1382 | `NE警告提示_触发关闭` | `NE警告提示_触发关闭(hwnd, element_id)` | void | 底层直调 EU_TriggerAlertClose：触发关闭。 |
| 1383 | `NE警告提示_取关闭` | `NE警告提示_取关闭(hwnd, element_id)` | int | 底层直调 EU_GetAlertClosed：取关闭。 |
| 1384 | `NE警告提示_取选项` | `NE警告提示_取选项(hwnd, element_id, alert_type, effect, closable, closed)` | int | 底层直调 EU_GetAlertOptions：取选项。 |
| 1385 | `NE警告提示_取完整状态` | `NE警告提示_取完整状态(hwnd, element_id, alert_type, effect, closable, closed, close_hover, close_down, close_count, last_action)` | int | 底层直调 EU_GetAlertFullState：取完整状态。 |
| 1386 | `NE警告提示_设置关闭回调` | `NE警告提示_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetAlertCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1387 | `NE结果页_设置副标题直调` | `NE结果页_设置副标题直调(hwnd, element_id, subtitle_bytes, subtitle_len)` | void | NE结果页_设置副标题 的底层直调版本：设置副标题。一般请用高层封装 NE结果页_设置副标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1388 | `NE结果页_设置类型` | `NE结果页_设置类型(hwnd, element_id, result_type)` | void | 底层直调 EU_SetResultType：设置类型。 |
| 1389 | `NE结果页_设置动作` | `NE结果页_设置动作(hwnd, element_id, actions_bytes, actions_len)` | void | 底层直调 EU_SetResultActions：设置动作。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1390 | `NE结果页_取动作` | `NE结果页_取动作(hwnd, element_id)` | int | 底层直调 EU_GetResultAction：取动作。 |
| 1391 | `NE结果页_取选项` | `NE结果页_取选项(hwnd, element_id, result_type, action_count, last_action)` | int | 底层直调 EU_GetResultOptions：取选项。 |
| 1392 | `NE结果页_设置附加内容` | `NE结果页_设置附加内容(hwnd, element_id, content_bytes, content_len)` | void | 底层直调 EU_SetResultExtraContent：设置附加内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1393 | `NE结果页_触发动作` | `NE结果页_触发动作(hwnd, element_id, action_index)` | void | 底层直调 EU_TriggerResultAction：触发动作。 |
| 1394 | `NE结果页_取文本` | `NE结果页_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetResultText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1395 | `NE结果页_取动作文本` | `NE结果页_取动作文本(hwnd, element_id, action_index, buffer, buffer_size)` | int | 底层直调 EU_GetResultActionText：取动作文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1396 | `NE结果页_取完整状态` | `NE结果页_取完整状态(hwnd, element_id, result_type, action_count, last_action, hover_action, press_action, action_click_count, last_action_source, has_extra_content)` | int | 底层直调 EU_GetResultFullState：取完整状态。 |
| 1397 | `NE结果页_设置动作回调` | `NE结果页_设置动作回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetResultActionCallback：设置动作回调。处理器实参必须写 &处理器名。 |
| 1398 | `NE消息框_设置关闭前拦截` | `NE消息框_设置关闭前拦截(hwnd, element_id, delay_ms, loading_bytes, loading_len)` | void | 底层直调 EU_SetMessageBoxBeforeClose：设置关闭前拦截。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1399 | `NE消息框_设置结果回调` | `NE消息框_设置结果回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetMessageBoxResultCallback：设置结果回调。处理器实参必须写 &处理器名。 |
| 1400 | `NE消息框_设置输入内容` | `NE消息框_设置输入内容(hwnd, element_id, value_bytes, value_len, placeholder_bytes, placeholder_len, pattern_bytes, pattern_len, error_bytes, error_len)` | void | 底层直调 EU_SetMessageBoxInput：设置输入内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1401 | `NE消息框_投递设置输入内容` | `NE消息框_投递设置输入内容(hwnd, element_id, value_bytes, value_len, placeholder_bytes, placeholder_len, pattern_bytes, pattern_len, error_bytes, error_len)` | int | 底层直调 EU_PostSetMessageBoxInput：投递设置输入内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1402 | `NE消息框_取输入内容` | `NE消息框_取输入内容(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetMessageBoxInput：取输入内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1403 | `NE消息框_取完整状态` | `NE消息框_取完整状态(hwnd, element_id, box_type, show_cancel, center, rich, distinguish, prompt, confirm_loading, input_error_visible, last_action, timer_elapsed_ms)` | int | 底层直调 EU_GetMessageBoxFullState：取完整状态。 |
| 1404 | `NE消息框_设置文本对齐` | `NE消息框_设置文本对齐(hwnd, element_id, title_align, body_align)` | void | 底层直调 EU_SetMessageBoxTextAlign：设置文本对齐。 |
| 1405 | `NE消息框_投递设置文本对齐` | `NE消息框_投递设置文本对齐(hwnd, element_id, title_align, body_align)` | int | 底层直调 EU_PostSetMessageBoxTextAlign：投递设置文本对齐。 |
| 1406 | `NE消息框_取文本对齐` | `NE消息框_取文本对齐(hwnd, element_id, title_align, body_align)` | int | 底层直调 EU_GetMessageBoxTextAlign：取文本对齐。 |
| 1407 | `NE消息提示_设置文本` | `NE消息提示_设置文本(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetMessageText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1408 | `NE消息提示_设置选项` | `NE消息提示_设置选项(hwnd, element_id, message_type, closable, center, rich, duration_ms, offset)` | void | 底层直调 EU_SetMessageOptions：设置选项。 |
| 1409 | `NE消息提示_设置关闭` | `NE消息提示_设置关闭(hwnd, element_id, closed)` | void | 底层直调 EU_SetMessageClosed：设置关闭。 |
| 1410 | `NE消息提示_取选项` | `NE消息提示_取选项(hwnd, element_id, message_type, closable, center, rich, duration_ms, closed, offset)` | int | 底层直调 EU_GetMessageOptions：取选项。 |
| 1411 | `NE消息提示_取完整状态` | `NE消息提示_取完整状态(hwnd, element_id, message_type, closable, center, rich, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap, offset)` | int | 底层直调 EU_GetMessageFullState：取完整状态。 |
| 1412 | `NE消息提示_触发关闭` | `NE消息提示_触发关闭(hwnd, element_id)` | void | 底层直调 EU_TriggerMessageClose：触发关闭。 |
| 1413 | `NE消息提示_设置关闭回调` | `NE消息提示_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetMessageCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1414 | `NE通知_设置主体` | `NE通知_设置主体(hwnd, element_id, body_bytes, body_len)` | void | 底层直调 EU_SetNotificationBody：设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1415 | `NE通知_投递设置主体` | `NE通知_投递设置主体(hwnd, element_id, body_bytes, body_len)` | int | 底层直调 EU_PostSetNotificationBody：投递设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1416 | `NE通知_设置类型` | `NE通知_设置类型(hwnd, element_id, notify_type)` | void | 底层直调 EU_SetNotificationType：设置类型。 |
| 1417 | `NE通知_投递设置类型` | `NE通知_投递设置类型(hwnd, element_id, notify_type)` | int | 底层直调 EU_PostSetNotificationType：投递设置类型。 |
| 1418 | `NE通知_设置可关闭` | `NE通知_设置可关闭(hwnd, element_id, closable)` | void | 底层直调 EU_SetNotificationClosable：设置可关闭。 |
| 1419 | `NE通知_设置弹出位置` | `NE通知_设置弹出位置(hwnd, element_id, placement, offset)` | void | 底层直调 EU_SetNotificationPlacement：设置弹出位置。 |
| 1420 | `NE通知_投递设置弹出位置` | `NE通知_投递设置弹出位置(hwnd, element_id, placement, offset)` | int | 底层直调 EU_PostSetNotificationPlacement：投递设置弹出位置。 |
| 1421 | `NE通知_设置富文本模式` | `NE通知_设置富文本模式(hwnd, element_id, rich)` | void | 底层直调 EU_SetNotificationRichMode：设置富文本模式。 |
| 1422 | `NE通知_设置选项` | `NE通知_设置选项(hwnd, element_id, notify_type, closable, duration_ms)` | void | 底层直调 EU_SetNotificationOptions：设置选项。 |
| 1423 | `NE通知_设置关闭` | `NE通知_设置关闭(hwnd, element_id, closed)` | void | 底层直调 EU_SetNotificationClosed：设置关闭。 |
| 1424 | `NE通知_投递设置关闭` | `NE通知_投递设置关闭(hwnd, element_id, closed)` | int | 底层直调 EU_PostSetNotificationClosed：投递设置关闭。 |
| 1425 | `NE通知_取关闭` | `NE通知_取关闭(hwnd, element_id)` | int | 底层直调 EU_GetNotificationClosed：取关闭。 |
| 1426 | `NE通知_取选项` | `NE通知_取选项(hwnd, element_id, notify_type, closable, duration_ms, closed)` | int | 底层直调 EU_GetNotificationOptions：取选项。 |
| 1427 | `NE通知_设置堆叠` | `NE通知_设置堆叠(hwnd, element_id, stack_index, stack_gap)` | void | 底层直调 EU_SetNotificationStack：设置堆叠。 |
| 1428 | `NE通知_触发关闭` | `NE通知_触发关闭(hwnd, element_id)` | void | 底层直调 EU_TriggerNotificationClose：触发关闭。 |
| 1429 | `NE通知_取文本` | `NE通知_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetNotificationText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1430 | `NE通知_取完整状态` | `NE通知_取完整状态(hwnd, element_id, notify_type, closable, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap)` | int | 底层直调 EU_GetNotificationFullState：取完整状态。 |
| 1431 | `NE通知_取完整状态扩展` | `NE通知_取完整状态扩展(hwnd, element_id, notify_type, closable, duration_ms, closed, close_hover, close_down, close_count, last_action, timer_elapsed_ms, timer_running, stack_index, stack_gap, placement, offset, rich)` | int | 底层直调 EU_GetNotificationFullStateEx：取完整状态扩展。 |
| 1432 | `NE通知_设置关闭回调` | `NE通知_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetNotificationCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1433 | `NE加载_设置活动` | `NE加载_设置活动(hwnd, element_id, active)` | void | 底层直调 EU_SetLoadingActive：设置活动。 |
| 1434 | `NE加载_投递设置活动` | `NE加载_投递设置活动(hwnd, element_id, active)` | int | 底层直调 EU_PostSetLoadingActive：投递设置活动。 |
| 1435 | `NE加载_设置文本` | `NE加载_设置文本(hwnd, element_id, text_bytes, text_len)` | void | 底层直调 EU_SetLoadingText：设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1436 | `NE加载_投递设置文本` | `NE加载_投递设置文本(hwnd, element_id, text_bytes, text_len)` | int | 底层直调 EU_PostSetLoadingText：投递设置文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1437 | `NE加载_设置选项` | `NE加载_设置选项(hwnd, element_id, active, fullscreen, progress)` | void | 底层直调 EU_SetLoadingOptions：设置选项。 |
| 1438 | `NE加载_投递设置选项` | `NE加载_投递设置选项(hwnd, element_id, active, fullscreen, progress)` | int | 底层直调 EU_PostSetLoadingOptions：投递设置选项。 |
| 1439 | `NE加载_设置样式` | `NE加载_设置样式(hwnd, element_id, background, spinner_color, text_color, spinner_type, lock_input)` | void | 底层直调 EU_SetLoadingStyle：设置样式。 |
| 1440 | `NE加载_取活动` | `NE加载_取活动(hwnd, element_id)` | int | 底层直调 EU_GetLoadingActive：取活动。 |
| 1441 | `NE加载_取选项` | `NE加载_取选项(hwnd, element_id, active, fullscreen, progress)` | int | 底层直调 EU_GetLoadingOptions：取选项。 |
| 1442 | `NE加载_设置目标` | `NE加载_设置目标(hwnd, element_id, target_element_id, padding)` | void | 底层直调 EU_SetLoadingTarget：设置目标。 |
| 1443 | `NE加载_取文本` | `NE加载_取文本(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetLoadingText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1444 | `NE加载_取样式` | `NE加载_取样式(hwnd, element_id, background, spinner_color, text_color, spinner_type, lock_input)` | int | 底层直调 EU_GetLoadingStyle：取样式。 |
| 1445 | `NE加载_显示` | `NE加载_显示(hwnd, target_element_id, text_bytes, text_len, fullscreen, lock_input, background, spinner_color, text_color, spinner_type)` | int | 底层直调 EU_ShowLoading：显示。一般请用高层命令 NE_显示加载遮罩。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1446 | `NE加载_关闭` | `NE加载_关闭(hwnd, loading_id)` | int | 底层直调 EU_CloseLoading：关闭。一般请用高层命令 NE_关闭加载遮罩。 |
| 1447 | `NE加载_取完整状态` | `NE加载_取完整状态(hwnd, element_id, active, fullscreen, progress, target_element_id, target_padding, animation_angle, tick_count, timer_running, last_action)` | int | 底层直调 EU_GetLoadingFullState：取完整状态。 |
| 1448 | `NE弹窗_设置打开` | `NE弹窗_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDialogOpen：设置打开。 |
| 1449 | `NE弹窗_投递设置打开` | `NE弹窗_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetDialogOpen：投递设置打开。 |
| 1450 | `NE弹窗_设置标题直调` | `NE弹窗_设置标题直调(hwnd, element_id, title_bytes, title_len)` | void | NE弹窗_设置标题 的底层直调版本：设置标题。一般请用高层封装 NE弹窗_设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1451 | `NE弹窗_投递设置标题` | `NE弹窗_投递设置标题(hwnd, element_id, title_bytes, title_len)` | int | 底层直调 EU_PostSetDialogTitle：投递设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1452 | `NE弹窗_设置主体` | `NE弹窗_设置主体(hwnd, element_id, body_bytes, body_len)` | void | 底层直调 EU_SetDialogBody：设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1453 | `NE弹窗_投递设置主体` | `NE弹窗_投递设置主体(hwnd, element_id, body_bytes, body_len)` | int | 底层直调 EU_PostSetDialogBody：投递设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1454 | `NE弹窗_设置选项` | `NE弹窗_设置选项(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h)` | void | 底层直调 EU_SetDialogOptions：设置选项。 |
| 1455 | `NE弹窗_取打开` | `NE弹窗_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDialogOpen：取打开。 |
| 1456 | `NE弹窗_取选项` | `NE弹窗_取选项(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h)` | int | 底层直调 EU_GetDialogOptions：取选项。 |
| 1457 | `NE弹窗_设置按钮` | `NE弹窗_设置按钮(hwnd, element_id, buttons_bytes, buttons_len)` | void | 底层直调 EU_SetDialogButtons：设置按钮。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1458 | `NE弹窗_投递设置按钮` | `NE弹窗_投递设置按钮(hwnd, element_id, buttons_bytes, buttons_len)` | int | 底层直调 EU_PostSetDialogButtons：投递设置按钮。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1459 | `NE弹窗_触发按钮` | `NE弹窗_触发按钮(hwnd, element_id, button_index)` | void | 底层直调 EU_TriggerDialogButton：触发按钮。 |
| 1460 | `NE弹窗_取文本` | `NE弹窗_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetDialogText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1461 | `NE弹窗_取按钮文本` | `NE弹窗_取按钮文本(hwnd, element_id, button_index, buffer, buffer_size)` | int | 底层直调 EU_GetDialogButtonText：取按钮文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1462 | `NE弹窗_取完整状态` | `NE弹窗_取完整状态(hwnd, element_id, open, modal, closable, close_on_mask, draggable, w, h, button_count, active_button, last_button, button_click_count, close_count, last_action, offset_x, offset_y, hover_part, press_part)` | int | 底层直调 EU_GetDialogFullState：取完整状态。 |
| 1463 | `NE弹窗_设置按钮回调` | `NE弹窗_设置按钮回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDialogButtonCallback：设置按钮回调。处理器实参必须写 &处理器名。 |
| 1464 | `NE抽屉_设置打开` | `NE抽屉_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetDrawerOpen：设置打开。 |
| 1465 | `NE抽屉_投递设置打开` | `NE抽屉_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetDrawerOpen：投递设置打开。 |
| 1466 | `NE抽屉_设置标题直调` | `NE抽屉_设置标题直调(hwnd, element_id, title_bytes, title_len)` | void | NE抽屉_设置标题 的底层直调版本：设置标题。一般请用高层封装 NE抽屉_设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1467 | `NE抽屉_投递设置标题` | `NE抽屉_投递设置标题(hwnd, element_id, title_bytes, title_len)` | int | 底层直调 EU_PostSetDrawerTitle：投递设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1468 | `NE抽屉_设置主体` | `NE抽屉_设置主体(hwnd, element_id, body_bytes, body_len)` | void | 底层直调 EU_SetDrawerBody：设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1469 | `NE抽屉_投递设置主体` | `NE抽屉_投递设置主体(hwnd, element_id, body_bytes, body_len)` | int | 底层直调 EU_PostSetDrawerBody：投递设置主体。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1470 | `NE抽屉_设置弹出位置` | `NE抽屉_设置弹出位置(hwnd, element_id, placement)` | void | 底层直调 EU_SetDrawerPlacement：设置弹出位置。 |
| 1471 | `NE抽屉_设置选项` | `NE抽屉_设置选项(hwnd, element_id, placement, open, modal, closable, close_on_mask, size)` | void | 底层直调 EU_SetDrawerOptions：设置选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1472 | `NE抽屉_设置高级选项` | `NE抽屉_设置高级选项(hwnd, element_id, show_header, show_close, close_on_escape, content_padding, footer_height, size_mode, size_value)` | void | 底层直调 EU_SetDrawerAdvancedOptions：设置高级选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1473 | `NE抽屉_取高级选项` | `NE抽屉_取高级选项(hwnd, element_id, show_header, show_close, close_on_escape, content_padding, footer_height, size_mode, size_value, content_parent_id, footer_parent_id, close_pending)` | int | 底层直调 EU_GetDrawerAdvancedOptions：取高级选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1474 | `NE抽屉_取内容父元素` | `NE抽屉_取内容父元素(hwnd, element_id)` | int | 底层直调 EU_GetDrawerContentParent：取内容父元素。 |
| 1475 | `NE抽屉_取页脚父元素` | `NE抽屉_取页脚父元素(hwnd, element_id)` | int | 底层直调 EU_GetDrawerFooterParent：取页脚父元素。 |
| 1476 | `NE抽屉_设置关闭前回调` | `NE抽屉_设置关闭前回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDrawerBeforeCloseCallback：设置关闭前回调。处理器实参必须写 &处理器名。 |
| 1477 | `NE抽屉_确认关闭` | `NE抽屉_确认关闭(hwnd, element_id, allow)` | void | 底层直调 EU_ConfirmDrawerClose：确认关闭。 |
| 1478 | `NE抽屉_取打开` | `NE抽屉_取打开(hwnd, element_id)` | int | 底层直调 EU_GetDrawerOpen：取打开。 |
| 1479 | `NE抽屉_取选项` | `NE抽屉_取选项(hwnd, element_id, placement, open, modal, closable, close_on_mask, size)` | int | 底层直调 EU_GetDrawerOptions：取选项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1480 | `NE抽屉_设置动画` | `NE抽屉_设置动画(hwnd, element_id, duration_ms)` | void | 底层直调 EU_SetDrawerAnimation：设置动画。 |
| 1481 | `NE抽屉_触发关闭` | `NE抽屉_触发关闭(hwnd, element_id)` | void | 底层直调 EU_TriggerDrawerClose：触发关闭。 |
| 1482 | `NE抽屉_取文本` | `NE抽屉_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetDrawerText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1483 | `NE抽屉_取完整状态` | `NE抽屉_取完整状态(hwnd, element_id, placement, open, modal, closable, close_on_mask, size, animation_progress, animation_ms, tick_count, timer_running, close_count, last_action, hover_part, press_part)` | int | 底层直调 EU_GetDrawerFullState：取完整状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1484 | `NE抽屉_设置关闭回调` | `NE抽屉_设置关闭回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetDrawerCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1485 | `NE文字提示_设置内容` | `NE文字提示_设置内容(hwnd, element_id, content_bytes, content_len)` | void | 底层直调 EU_SetTooltipContent：设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1486 | `NE文字提示_投递设置内容` | `NE文字提示_投递设置内容(hwnd, element_id, content_bytes, content_len)` | int | 底层直调 EU_PostSetTooltipContent：投递设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1487 | `NE文字提示_设置打开` | `NE文字提示_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetTooltipOpen：设置打开。 |
| 1488 | `NE文字提示_投递设置打开` | `NE文字提示_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetTooltipOpen：投递设置打开。 |
| 1489 | `NE文字提示_设置选项` | `NE文字提示_设置选项(hwnd, element_id, placement, open, max_width)` | void | 底层直调 EU_SetTooltipOptions：设置选项。 |
| 1490 | `NE文字提示_取打开` | `NE文字提示_取打开(hwnd, element_id)` | int | 底层直调 EU_GetTooltipOpen：取打开。 |
| 1491 | `NE文字提示_取选项` | `NE文字提示_取选项(hwnd, element_id, placement, open, max_width)` | int | 底层直调 EU_GetTooltipOptions：取选项。 |
| 1492 | `NE文字提示_设置行为` | `NE文字提示_设置行为(hwnd, element_id, show_delay, hide_delay, trigger_mode, show_arrow)` | void | 底层直调 EU_SetTooltipBehavior：设置行为。 |
| 1493 | `NE文字提示_触发` | `NE文字提示_触发(hwnd, element_id, open)` | void | 底层直调 EU_TriggerTooltip：触发。 |
| 1494 | `NE文字提示_取文本` | `NE文字提示_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetTooltipText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1495 | `NE文字提示_取完整状态` | `NE文字提示_取完整状态(hwnd, element_id, placement, open, max_width, show_arrow, show_delay, hide_delay, trigger_mode, timer_running, timer_phase, open_count, close_count, last_action, popup_x, popup_y, popup_w, popup_h)` | int | 底层直调 EU_GetTooltipFullState：取完整状态。 |
| 1496 | `NE气泡卡片_设置打开` | `NE气泡卡片_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetPopoverOpen：设置打开。 |
| 1497 | `NE气泡卡片_投递设置打开` | `NE气泡卡片_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetPopoverOpen：投递设置打开。 |
| 1498 | `NE气泡卡片_设置内容直调` | `NE气泡卡片_设置内容直调(hwnd, element_id, content_bytes, content_len)` | void | NE气泡卡片_设置内容 的底层直调版本：设置内容。一般请用高层封装 NE气泡卡片_设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1499 | `NE气泡卡片_投递设置内容` | `NE气泡卡片_投递设置内容(hwnd, element_id, content_bytes, content_len)` | int | 底层直调 EU_PostSetPopoverContent：投递设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1500 | `NE气泡卡片_设置标题直调` | `NE气泡卡片_设置标题直调(hwnd, element_id, title_bytes, title_len)` | void | NE气泡卡片_设置标题 的底层直调版本：设置标题。一般请用高层封装 NE气泡卡片_设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1501 | `NE气泡卡片_投递设置标题` | `NE气泡卡片_投递设置标题(hwnd, element_id, title_bytes, title_len)` | int | 底层直调 EU_PostSetPopoverTitle：投递设置标题。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1502 | `NE气泡卡片_设置选项` | `NE气泡卡片_设置选项(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | void | 底层直调 EU_SetPopoverOptions：设置选项。 |
| 1503 | `NE气泡卡片_取打开` | `NE气泡卡片_取打开(hwnd, element_id)` | int | 底层直调 EU_GetPopoverOpen：取打开。 |
| 1504 | `NE气泡卡片_取选项` | `NE气泡卡片_取选项(hwnd, element_id, placement, open, popup_width, popup_height, closable)` | int | 底层直调 EU_GetPopoverOptions：取选项。 |
| 1505 | `NE气泡卡片_触发` | `NE气泡卡片_触发(hwnd, element_id, open)` | void | 底层直调 EU_TriggerPopover：触发。 |
| 1506 | `NE气泡卡片_取文本` | `NE气泡卡片_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetPopoverText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1507 | `NE气泡卡片_取完整状态` | `NE气泡卡片_取完整状态(hwnd, element_id, placement, open, popup_width, popup_height, closable, open_count, close_count, last_action, focus_part, close_hover, popup_x, popup_y, popup_w, popup_h)` | int | 底层直调 EU_GetPopoverFullState：取完整状态。 |
| 1508 | `NE气泡卡片_设置动作回调` | `NE气泡卡片_设置动作回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetPopoverActionCallback：设置动作回调。处理器实参必须写 &处理器名。 |
| 1509 | `NE气泡确认_设置打开` | `NE气泡确认_设置打开(hwnd, element_id, open)` | void | 底层直调 EU_SetPopconfirmOpen：设置打开。 |
| 1510 | `NE气泡确认_投递设置打开` | `NE气泡确认_投递设置打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetPopconfirmOpen：投递设置打开。 |
| 1511 | `NE气泡确认_设置选项` | `NE气泡确认_设置选项(hwnd, element_id, placement, open, popup_width, popup_height)` | void | 底层直调 EU_SetPopconfirmOptions：设置选项。 |
| 1512 | `NE气泡确认_设置内容` | `NE气泡确认_设置内容(hwnd, element_id, title_bytes, title_len, content_bytes, content_len)` | void | 底层直调 EU_SetPopconfirmContent：设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1513 | `NE气泡确认_投递设置内容` | `NE气泡确认_投递设置内容(hwnd, element_id, title_bytes, title_len, content_bytes, content_len)` | int | 底层直调 EU_PostSetPopconfirmContent：投递设置内容。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1514 | `NE气泡确认_设置按钮` | `NE气泡确认_设置按钮(hwnd, element_id, confirm_bytes, confirm_len, cancel_bytes, cancel_len)` | void | 底层直调 EU_SetPopconfirmButtons：设置按钮。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1515 | `NE气泡确认_投递设置按钮` | `NE气泡确认_投递设置按钮(hwnd, element_id, confirm_bytes, confirm_len, cancel_bytes, cancel_len)` | int | 底层直调 EU_PostSetPopconfirmButtons：投递设置按钮。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1516 | `NE气泡确认_重置结果` | `NE气泡确认_重置结果(hwnd, element_id)` | void | 底层直调 EU_ResetPopconfirmResult：重置结果。 |
| 1517 | `NE气泡确认_取打开` | `NE气泡确认_取打开(hwnd, element_id)` | int | 底层直调 EU_GetPopconfirmOpen：取打开。 |
| 1518 | `NE气泡确认_取结果` | `NE气泡确认_取结果(hwnd, element_id)` | int | 底层直调 EU_GetPopconfirmResult：取结果。 |
| 1519 | `NE气泡确认_取选项` | `NE气泡确认_取选项(hwnd, element_id, placement, open, popup_width, popup_height, result)` | int | 底层直调 EU_GetPopconfirmOptions：取选项。 |
| 1520 | `NE气泡确认_触发结果` | `NE气泡确认_触发结果(hwnd, element_id, result)` | void | 底层直调 EU_TriggerPopconfirmResult：触发结果。 |
| 1521 | `NE气泡确认_取文本` | `NE气泡确认_取文本(hwnd, element_id, text_kind, buffer, buffer_size)` | int | 底层直调 EU_GetPopconfirmText：取文本。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1522 | `NE气泡确认_取完整状态` | `NE气泡确认_取完整状态(hwnd, element_id, placement, open, popup_width, popup_height, result, confirm_count, cancel_count, result_action, focus_part, hover_button, press_button, popup_x, popup_y, popup_w, popup_h)` | int | 底层直调 EU_GetPopconfirmFullState：取完整状态。 |
| 1523 | `NE气泡确认_设置结果回调` | `NE气泡确认_设置结果回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetPopconfirmResultCallback：设置结果回调。处理器实参必须写 &处理器名。 |
| 1524 | `NE元素_设置点击回调` | `NE元素_设置点击回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementClickCallback：设置点击回调。处理器实参必须写 &处理器名。 |
| 1525 | `NE元素_添加点击设置文本动作` | `NE元素_添加点击设置文本动作(hwnd, element_id, target_element_id, bytes, len)` | void | 底层直调 EU_AddElementClickSetTextAction：添加点击设置文本动作。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1526 | `NE元素_添加点击设置窗口标题动作` | `NE元素_添加点击设置窗口标题动作(hwnd, element_id, bytes, len)` | void | 底层直调 EU_AddElementClickSetWindowTitleAction：添加点击设置窗口标题动作。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1527 | `NE元素_添加点击设置缩放边框动作` | `NE元素_添加点击设置缩放边框动作(hwnd, element_id, left, top, right, bottom)` | void | 底层直调 EU_AddElementClickSetResizeBorderAction：添加点击设置缩放边框动作。 |
| 1528 | `NE元素_添加点击设置窗口拖拽动作` | `NE元素_添加点击设置窗口拖拽动作(hwnd, element_id, draggable)` | void | 底层直调 EU_AddElementClickSetWindowDraggableAction：添加点击设置窗口拖拽动作。 |
| 1529 | `NE元素_添加点击设置输入框选区动作` | `NE元素_添加点击设置输入框选区动作(hwnd, element_id, target_element_id, start, end)` | void | 底层直调 EU_AddElementClickSetInputSelectionAction：添加点击设置输入框选区动作。 |
| 1530 | `NE元素_清空点击文本动作` | `NE元素_清空点击文本动作(hwnd, element_id)` | void | 底层直调 EU_ClearElementClickTextActions：清空点击文本动作。 |
| 1531 | `NE元素_设置键盘回调` | `NE元素_设置键盘回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementKeyCallback：设置键盘回调。处理器实参必须写 &处理器名。 |
| 1532 | `NE元素_设置鼠标回调` | `NE元素_设置鼠标回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementMouseCallback：设置鼠标回调。处理器实参必须写 &处理器名。 |
| 1533 | `NE元素_设置焦点回调` | `NE元素_设置焦点回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementFocusCallback：设置焦点回调。处理器实参必须写 &处理器名。 |
| 1534 | `NE元素_设置变化回调` | `NE元素_设置变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementChangeCallback：设置变化回调。处理器实参必须写 &处理器名。 |
| 1535 | `NE元素_设置文本变化回调` | `NE元素_设置文本变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementTextChangeCallback：设置文本变化回调。处理器实参必须写 &处理器名。 |
| 1536 | `NE元素_设置选区变化回调` | `NE元素_设置选区变化回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetElementSelectionChangeCallback：设置选区变化回调。处理器实参必须写 &处理器名。 |
| 1537 | `NE窗口_设置缩放回调` | `NE窗口_设置缩放回调(hwnd, cb)` | void | 底层直调 EU_SetWindowResizeCallback：设置缩放回调。处理器实参必须写 &处理器名。 |
| 1538 | `NE窗口_设置关闭回调` | `NE窗口_设置关闭回调(hwnd, cb)` | void | 底层直调 EU_SetWindowCloseCallback：设置关闭回调。处理器实参必须写 &处理器名。 |
| 1539 | `NE主题_设置深色模式` | `NE主题_设置深色模式(hwnd, dark_mode)` | void | 底层直调 EU_SetDarkMode：设置深色模式。 |
| 1540 | `NE主题_设置模式` | `NE主题_设置模式(hwnd, mode)` | void | 底层直调 EU_SetThemeMode：设置模式。 |
| 1541 | `NE主题_取模式` | `NE主题_取模式(hwnd)` | int | 底层直调 EU_GetThemeMode：取模式。 |
| 1542 | `NE主题_设置主题色` | `NE主题_设置主题色(hwnd, token_bytes, token_len, value)` | int | 底层直调 EU_SetThemeColor：设置主题色。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1543 | `NE主题_设置浏览器主题预设` | `NE主题_设置浏览器主题预设(hwnd, preset)` | void | 底层直调 EU_SetChromeThemePreset：设置浏览器主题预设。 |
| 1544 | `NE主题_设置令牌` | `NE主题_设置令牌(hwnd, token_bytes, token_len, value)` | int | 底层直调 EU_SetThemeToken：设置令牌。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1545 | `NE主题_取令牌` | `NE主题_取令牌(hwnd, token_bytes, token_len, value)` | int | 底层直调 EU_GetThemeToken：取令牌。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1546 | `NE主题_设置高对比度模式` | `NE主题_设置高对比度模式(hwnd, enabled)` | void | 底层直调 EU_SetHighContrastMode：设置高对比度模式。 |
| 1547 | `NE主题_设置隐身模式` | `NE主题_设置隐身模式(hwnd, enabled)` | void | 底层直调 EU_SetIncognitoMode：设置隐身模式。 |
| 1548 | `NE主题_重置` | `NE主题_重置(hwnd)` | void | 底层直调 EU_ResetTheme：重置。 |
| 1549 | `NE元素_使失效` | `NE元素_使失效(hwnd, element_id)` | void | 底层直调 EU_InvalidateElement：使失效。 |
| 1550 | `NE图标按钮_设置图标` | `NE图标按钮_设置图标(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetIconButtonIcon：设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1551 | `NE图标按钮_投递设置图标` | `NE图标按钮_投递设置图标(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetIconButtonIcon：投递设置图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1552 | `NE图标按钮_设置提示` | `NE图标按钮_设置提示(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetIconButtonTooltip：设置提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1553 | `NE图标按钮_投递设置提示` | `NE图标按钮_投递设置提示(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetIconButtonTooltip：投递设置提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1554 | `NE图标按钮_设置徽标直调` | `NE图标按钮_设置徽标直调(hwnd, element_id, bytes, len, visible)` | void | NE图标按钮_设置徽标 的底层直调版本：设置徽标。一般请用高层封装 NE图标按钮_设置徽标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1555 | `NE图标按钮_投递设置徽标` | `NE图标按钮_投递设置徽标(hwnd, element_id, bytes, len, visible)` | int | 底层直调 EU_PostSetIconButtonBadge：投递设置徽标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1556 | `NE图标按钮_设置勾选` | `NE图标按钮_设置勾选(hwnd, element_id, checked)` | void | 底层直调 EU_SetIconButtonChecked：设置勾选。 |
| 1557 | `NE图标按钮_投递设置勾选` | `NE图标按钮_投递设置勾选(hwnd, element_id, checked)` | int | 底层直调 EU_PostSetIconButtonChecked：投递设置勾选。 |
| 1558 | `NE图标按钮_取勾选` | `NE图标按钮_取勾选(hwnd, element_id)` | int | 底层直调 EU_GetIconButtonChecked：取勾选。 |
| 1559 | `NE图标按钮_设置下拉` | `NE图标按钮_设置下拉(hwnd, element_id, dropdown_element_id)` | void | 底层直调 EU_SetIconButtonDropdown：设置下拉。 |
| 1560 | `NE图标按钮_设置配色` | `NE图标按钮_设置配色(hwnd, element_id, normal_bg, hover_bg, pressed_bg, checked_bg, disabled_bg, icon_color, disabled_icon_color)` | void | 底层直调 EU_SetIconButtonColors：设置配色。 |
| 1561 | `NE图标按钮_设置形状` | `NE图标按钮_设置形状(hwnd, element_id, shape, radius)` | void | 底层直调 EU_SetIconButtonShape：设置形状。 |
| 1562 | `NE图标按钮_设置内边距` | `NE图标按钮_设置内边距(hwnd, element_id, left, top, right, bottom)` | void | 底层直调 EU_SetIconButtonPadding：设置内边距。 |
| 1563 | `NE图标按钮_设置图标尺寸` | `NE图标按钮_设置图标尺寸(hwnd, element_id, size)` | void | 底层直调 EU_SetIconButtonIconSize：设置图标尺寸。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1564 | `NE图标按钮_取状态` | `NE图标按钮_取状态(hwnd, element_id, checked, hovered, pressed, badge_visible)` | int | 底层直调 EU_GetIconButtonState：取状态。 |
| 1565 | `NE标签页_设置浏览器模式` | `NE标签页_设置浏览器模式(hwnd, element_id, enabled)` | void | 底层直调 EU_SetTabsChromeMode：设置浏览器模式。 |
| 1566 | `NE标签页_取浏览器模式` | `NE标签页_取浏览器模式(hwnd, element_id)` | int | 底层直调 EU_GetTabsChromeMode：取浏览器模式。 |
| 1567 | `NE标签页_设置项图标` | `NE标签页_设置项图标(hwnd, element_id, index, bytes, len)` | void | 底层直调 EU_SetTabsItemIcon：设置项图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1568 | `NE标签页_设置项加载中` | `NE标签页_设置项加载中(hwnd, element_id, index, loading)` | void | 底层直调 EU_SetTabsItemLoading：设置项加载中。 |
| 1569 | `NE标签页_投递设置项加载中` | `NE标签页_投递设置项加载中(hwnd, element_id, index, loading)` | int | 底层直调 EU_PostSetTabsItemLoading：投递设置项加载中。 |
| 1570 | `NE标签页_设置项固定` | `NE标签页_设置项固定(hwnd, element_id, index, pinned)` | void | 底层直调 EU_SetTabsItemPinned：设置项固定。 |
| 1571 | `NE标签页_投递设置项固定` | `NE标签页_投递设置项固定(hwnd, element_id, index, pinned)` | int | 底层直调 EU_PostSetTabsItemPinned：投递设置项固定。 |
| 1572 | `NE标签页_设置项静音` | `NE标签页_设置项静音(hwnd, element_id, index, muted)` | void | 底层直调 EU_SetTabsItemMuted：设置项静音。 |
| 1573 | `NE标签页_投递设置项静音` | `NE标签页_投递设置项静音(hwnd, element_id, index, muted)` | int | 底层直调 EU_PostSetTabsItemMuted：投递设置项静音。 |
| 1574 | `NE标签页_设置项可关闭` | `NE标签页_设置项可关闭(hwnd, element_id, index, closable)` | void | 底层直调 EU_SetTabsItemClosable：设置项可关闭。 |
| 1575 | `NE标签页_投递设置项可关闭` | `NE标签页_投递设置项可关闭(hwnd, element_id, index, closable)` | int | 底层直调 EU_PostSetTabsItemClosable：投递设置项可关闭。 |
| 1576 | `NE标签页_设置项浏览器状态` | `NE标签页_设置项浏览器状态(hwnd, element_id, index, loading, pinned, muted, alerting)` | void | 底层直调 EU_SetTabsItemChromeState：设置项浏览器状态。 |
| 1577 | `NE标签页_投递设置项浏览器状态` | `NE标签页_投递设置项浏览器状态(hwnd, element_id, index, loading, pinned, muted, alerting)` | int | 底层直调 EU_PostSetTabsItemChromeState：投递设置项浏览器状态。 |
| 1578 | `NE标签页_取项浏览器状态` | `NE标签页_取项浏览器状态(hwnd, element_id, index, loading, pinned, muted, alerting)` | int | 底层直调 EU_GetTabsItemChromeState：取项浏览器状态。 |
| 1579 | `NE标签页_设置浏览器尺寸参数` | `NE标签页_设置浏览器尺寸参数(hwnd, element_id, min_width, max_width, pinned_width, height, overlap)` | void | 底层直调 EU_SetTabsChromeMetrics：设置浏览器尺寸参数。 |
| 1580 | `NE标签页_设置新建按钮可见直调` | `NE标签页_设置新建按钮可见直调(hwnd, element_id, visible)` | void | NE标签页_设置新建按钮可见 的底层直调版本：设置新建按钮可见。一般请用高层封装 NE标签页_设置新建按钮可见。 |
| 1581 | `NE标签页_设置拖拽选项直调` | `NE标签页_设置拖拽选项直调(hwnd, element_id, reorder_enabled, detach_enabled)` | void | NE标签页_设置拖拽选项 的底层直调版本：设置拖拽选项。一般请用高层封装 NE标签页_设置拖拽选项。 |
| 1582 | `NE标签页_设置拖拽排序回调` | `NE标签页_设置拖拽排序回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetTabsReorderCallback：设置拖拽排序回调。处理器实参必须写 &处理器名。 |
| 1583 | `NE地址栏_设置值` | `NE地址栏_设置值(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetOmniboxValue：设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1584 | `NE地址栏_投递设置值` | `NE地址栏_投递设置值(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetOmniboxValue：投递设置值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1585 | `NE地址栏_取值` | `NE地址栏_取值(hwnd, element_id, buffer, buffer_size)` | int | 底层直调 EU_GetOmniboxValue：取值。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1586 | `NE地址栏_设置占位提示` | `NE地址栏_设置占位提示(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetOmniboxPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1587 | `NE地址栏_投递设置占位提示` | `NE地址栏_投递设置占位提示(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetOmniboxPlaceholder：投递设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1588 | `NE地址栏_设置安全状态直调` | `NE地址栏_设置安全状态直调(hwnd, element_id, state, bytes, len)` | void | NE地址栏_设置安全状态 的底层直调版本：设置安全状态。一般请用高层封装 NE地址栏_设置安全状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1589 | `NE地址栏_投递设置安全状态` | `NE地址栏_投递设置安全状态(hwnd, element_id, state, bytes, len)` | int | 底层直调 EU_PostSetOmniboxSecurityState：投递设置安全状态。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1590 | `NE地址栏_设置前缀徽片` | `NE地址栏_设置前缀徽片(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, bg_color, fg_color)` | void | 底层直调 EU_SetOmniboxPrefixChip：设置前缀徽片。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1591 | `NE地址栏_投递设置前缀徽片` | `NE地址栏_投递设置前缀徽片(hwnd, element_id, icon_bytes, icon_len, text_bytes, text_len, bg_color, fg_color)` | int | 底层直调 EU_PostSetOmniboxPrefixChip：投递设置前缀徽片。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1592 | `NE地址栏_设置动作图标直调` | `NE地址栏_设置动作图标直调(hwnd, element_id, bytes, len)` | void | NE地址栏_设置动作图标 的底层直调版本：设置动作图标。一般请用高层封装 NE地址栏_设置动作图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1593 | `NE地址栏_投递设置动作图标` | `NE地址栏_投递设置动作图标(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetOmniboxActionIcons：投递设置动作图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1594 | `NE地址栏_设置建议项` | `NE地址栏_设置建议项(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetOmniboxSuggestionItems：设置建议项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1595 | `NE地址栏_投递设置建议项` | `NE地址栏_投递设置建议项(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetOmniboxSuggestionItems：投递设置建议项。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1596 | `NE地址栏_设置建议打开` | `NE地址栏_设置建议打开(hwnd, element_id, open)` | void | 底层直调 EU_SetOmniboxSuggestionOpen：设置建议打开。 |
| 1597 | `NE地址栏_投递设置建议打开` | `NE地址栏_投递设置建议打开(hwnd, element_id, open)` | int | 底层直调 EU_PostSetOmniboxSuggestionOpen：投递设置建议打开。 |
| 1598 | `NE地址栏_设置建议选中` | `NE地址栏_设置建议选中(hwnd, element_id, index)` | void | 底层直调 EU_SetOmniboxSuggestionSelected：设置建议选中。 |
| 1599 | `NE地址栏_投递设置建议选中` | `NE地址栏_投递设置建议选中(hwnd, element_id, index)` | int | 底层直调 EU_PostSetOmniboxSuggestionSelected：投递设置建议选中。 |
| 1600 | `NE地址栏_取建议状态` | `NE地址栏_取建议状态(hwnd, element_id, open, selected, count)` | int | 底层直调 EU_GetOmniboxSuggestionState：取建议状态。 |
| 1601 | `NE地址栏_设置提交回调` | `NE地址栏_设置提交回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetOmniboxCommitCallback：设置提交回调。处理器实参必须写 &处理器名。 |
| 1602 | `NE地址栏_设置图标按钮回调` | `NE地址栏_设置图标按钮回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetOmniboxIconButtonCallback：设置图标按钮回调。处理器实参必须写 &处理器名。 |
| 1603 | `NE菜单_设置项图标` | `NE菜单_设置项图标(hwnd, element_id, index, bytes, len)` | void | 底层直调 EU_SetMenuItemIcon：设置项图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1604 | `NE菜单_投递设置项图标` | `NE菜单_投递设置项图标(hwnd, element_id, index, bytes, len)` | int | 底层直调 EU_PostSetMenuItemIcon：投递设置项图标。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1605 | `NE菜单_设置项快捷键` | `NE菜单_设置项快捷键(hwnd, element_id, index, bytes, len)` | void | 底层直调 EU_SetMenuItemShortcut：设置项快捷键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1606 | `NE菜单_投递设置项快捷键` | `NE菜单_投递设置项快捷键(hwnd, element_id, index, bytes, len)` | int | 底层直调 EU_PostSetMenuItemShortcut：投递设置项快捷键。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1607 | `NE菜单_设置项勾选` | `NE菜单_设置项勾选(hwnd, element_id, index, checked)` | void | 底层直调 EU_SetMenuItemChecked：设置项勾选。 |
| 1608 | `NE菜单_投递设置项勾选` | `NE菜单_投递设置项勾选(hwnd, element_id, index, checked)` | int | 底层直调 EU_PostSetMenuItemChecked：投递设置项勾选。 |
| 1609 | `NE菜单_设置项分隔符` | `NE菜单_设置项分隔符(hwnd, element_id, index, separator)` | void | 底层直调 EU_SetMenuItemSeparator：设置项分隔符。 |
| 1610 | `NE菜单_投递设置项分隔符` | `NE菜单_投递设置项分隔符(hwnd, element_id, index, separator)` | int | 底层直调 EU_PostSetMenuItemSeparator：投递设置项分隔符。 |
| 1611 | `NE菜单_设置项子菜单` | `NE菜单_设置项子菜单(hwnd, element_id, index, submenu_element_id)` | void | 底层直调 EU_SetMenuItemSubmenu：设置项子菜单。 |
| 1612 | `NE菜单_设置弹出位置` | `NE菜单_设置弹出位置(hwnd, element_id, anchor_element_id, placement, offset)` | void | 底层直调 EU_SetMenuPopupPosition：设置弹出位置。 |
| 1613 | `NE菜单_投递设置弹出位置` | `NE菜单_投递设置弹出位置(hwnd, element_id, anchor_element_id, placement, offset)` | int | 底层直调 EU_PostSetMenuPopupPosition：投递设置弹出位置。 |
| 1614 | `NE元素_设置右键菜单回调` | `NE元素_设置右键菜单回调(hwnd, element_id, cb)` | void | 底层直调 EU_SetContextMenuCallback：设置右键菜单回调。处理器实参必须写 &处理器名。 |
| 1615 | `NE气泡卡片_设置锚点元素` | `NE气泡卡片_设置锚点元素(hwnd, element_id, anchor_element_id)` | void | 底层直调 EU_SetPopoverAnchorElement：设置锚点元素。 |
| 1616 | `NE气泡卡片_设置箭头` | `NE气泡卡片_设置箭头(hwnd, element_id, visible, size)` | void | 底层直调 EU_SetPopoverArrow：设置箭头。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1617 | `NE气泡卡片_设置海拔阴影` | `NE气泡卡片_设置海拔阴影(hwnd, element_id, level)` | void | 底层直调 EU_SetPopoverElevation：设置海拔阴影。 |
| 1618 | `NE气泡卡片_设置自动弹出位置` | `NE气泡卡片_设置自动弹出位置(hwnd, element_id, enabled)` | void | 底层直调 EU_SetPopoverAutoPlacement：设置自动弹出位置。 |
| 1619 | `NE气泡卡片_设置关闭行为` | `NE气泡卡片_设置关闭行为(hwnd, element_id, close_on_outside, close_on_escape)` | void | 底层直调 EU_SetPopoverDismissBehavior：设置关闭行为。 |
| 1620 | `NE悬浮层_设置锚点元素` | `NE悬浮层_设置锚点元素(hwnd, popup_id, anchor_element_id)` | void | 底层直调 EU_SetPopupAnchorElement：设置锚点元素。 |
| 1621 | `NE悬浮层_设置弹出位置` | `NE悬浮层_设置弹出位置(hwnd, popup_id, placement, offset_x, offset_y)` | void | 底层直调 EU_SetPopupPlacement：设置弹出位置。 |
| 1622 | `NE悬浮层_设置打开` | `NE悬浮层_设置打开(hwnd, popup_id, open)` | void | 底层直调 EU_SetPopupOpen：设置打开。 |
| 1623 | `NE悬浮层_取打开` | `NE悬浮层_取打开(hwnd, popup_id)` | int | 底层直调 EU_GetPopupOpen：取打开。 |
| 1624 | `NE悬浮层_设置关闭行为` | `NE悬浮层_设置关闭行为(hwnd, popup_id, close_on_outside, close_on_escape)` | void | 底层直调 EU_SetPopupDismissBehavior：设置关闭行为。 |
| 1625 | `NE元素_设置弹出` | `NE元素_设置弹出(hwnd, element_id, popup_id, trigger)` | void | 底层直调 EU_SetElementPopup：设置弹出。 |
| 1626 | `NE元素_清空弹出` | `NE元素_清空弹出(hwnd, element_id, trigger)` | void | 底层直调 EU_ClearElementPopup：清空弹出。 |
| 1627 | `NE元素_取弹出` | `NE元素_取弹出(hwnd, element_id, trigger)` | int | 底层直调 EU_GetElementPopup：取弹出。 |
| 1628 | `NE标题栏_设置可见` | `NE标题栏_设置可见(hwnd, visible)` | void | 底层直调 EU_SetTitleBarVisible：设置可见。 |
| 1629 | `NE标题栏_设置高度` | `NE标题栏_设置高度(hwnd, height)` | void | 底层直调 EU_SetTitleBarHeight：设置高度。 |
| 1630 | `NE标题栏_设置按钮样式` | `NE标题栏_设置按钮样式(hwnd, button_width, button_height, icon_color, hover_bg, close_hover_bg)` | void | 底层直调 EU_SetTitleBarButtonStyle：设置按钮样式。 |
| 1631 | `NE窗口_设置标题栏按钮可见` | `NE窗口_设置标题栏按钮可见(hwnd, show_minimize, show_maximize, show_close)` | void | 底层直调 EU_SetWindowCaptionButtonsVisible：设置标题栏按钮可见。 |
| 1632 | `NE窗口_取框架标志` | `NE窗口_取框架标志(hwnd)` | int | 底层直调 EU_GetWindowFrameFlags：取框架标志。 |
| 1633 | `NE窗口_设置框架标志` | `NE窗口_设置框架标志(hwnd, frame_flags)` | void | 底层直调 EU_SetWindowFrameFlags：设置框架标志。 |
| 1634 | `NE窗口_设置缩放边框` | `NE窗口_设置缩放边框(hwnd, left, top, right, bottom)` | void | 底层直调 EU_SetWindowResizeBorder：设置缩放边框。 |
| 1635 | `NE窗口_取缩放边框` | `NE窗口_取缩放边框(hwnd, left, top, right, bottom)` | int | 底层直调 EU_GetWindowResizeBorder：取缩放边框。 |
| 1636 | `NE窗口_设置拖拽区` | `NE窗口_设置拖拽区(hwnd, x, y, w, h, enabled)` | void | 底层直调 EU_SetWindowDragRegion：设置拖拽区。 |
| 1637 | `NE窗口_清空拖拽区` | `NE窗口_清空拖拽区(hwnd)` | void | 底层直调 EU_ClearWindowDragRegions：清空拖拽区。 |
| 1638 | `NE窗口_设置非拖拽区` | `NE窗口_设置非拖拽区(hwnd, x, y, w, h, enabled)` | void | 底层直调 EU_SetWindowNoDragRegion：设置非拖拽区。 |
| 1639 | `NE窗口_清空非拖拽区` | `NE窗口_清空非拖拽区(hwnd)` | void | 底层直调 EU_ClearWindowNoDragRegions：清空非拖拽区。 |
| 1640 | `NE元素_设置窗口命令` | `NE元素_设置窗口命令(hwnd, element_id, command)` | void | 底层直调 EU_SetElementWindowCommand：设置窗口命令。 |
| 1641 | `NE元素_取窗口命令` | `NE元素_取窗口命令(hwnd, element_id)` | int | 底层直调 EU_GetElementWindowCommand：取窗口命令。 |
| 1642 | `NE窗口_设置标题栏按钮位置尺寸` | `NE窗口_设置标题栏按钮位置尺寸(hwnd, x, y, w, h)` | void | 底层直调 EU_SetWindowCaptionButtonBounds：设置标题栏按钮位置尺寸。 |
| 1643 | `NE窗口_设置圆角` | `NE窗口_设置圆角(hwnd, enabled, radius)` | void | 底层直调 EU_SetWindowRoundedCorners：设置圆角。 |
| 1644 | `NE容器_设置弹性布局` | `NE容器_设置弹性布局(hwnd, element_id, direction, gap, align_items, justify_content)` | void | 底层直调 EU_SetContainerFlexLayout：设置弹性布局。 |
| 1645 | `NE元素_设置弹性伸展` | `NE元素_设置弹性伸展(hwnd, element_id, grow)` | void | 底层直调 EU_SetElementFlexGrow：设置弹性伸展。 |
| 1646 | `NE元素_设置最小最大尺寸` | `NE元素_设置最小最大尺寸(hwnd, element_id, min_w, min_h, max_w, max_h)` | void | 底层直调 EU_SetElementMinMaxSize：设置最小最大尺寸。 |
| 1647 | `NE元素_设置外边距` | `NE元素_设置外边距(hwnd, element_id, left, top, right, bottom)` | void | 底层直调 EU_SetElementMargin：设置外边距。 |
| 1648 | `NE元素_设置自身对齐` | `NE元素_设置自身对齐(hwnd, element_id, align_self)` | void | 底层直调 EU_SetElementAlignSelf：设置自身对齐。 |
| 1649 | `NE浏览器视口_设置状态` | `NE浏览器视口_设置状态(hwnd, element_id, state)` | void | 底层直调 EU_SetBrowserViewportState：设置状态。 |
| 1650 | `NE浏览器视口_投递设置状态` | `NE浏览器视口_投递设置状态(hwnd, element_id, state)` | int | 底层直调 EU_PostSetBrowserViewportState：投递设置状态。 |
| 1651 | `NE浏览器视口_设置占位提示` | `NE浏览器视口_设置占位提示(hwnd, element_id, title_bytes, title_len, desc_bytes, desc_len, icon_bytes, icon_len)` | void | 底层直调 EU_SetBrowserViewportPlaceholder：设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1652 | `NE浏览器视口_投递设置占位提示` | `NE浏览器视口_投递设置占位提示(hwnd, element_id, title_bytes, title_len, desc_bytes, desc_len, icon_bytes, icon_len)` | int | 底层直调 EU_PostSetBrowserViewportPlaceholder：投递设置占位提示。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1653 | `NE浏览器视口_设置加载中` | `NE浏览器视口_设置加载中(hwnd, element_id, loading, progress)` | void | 底层直调 EU_SetBrowserViewportLoading：设置加载中。 |
| 1654 | `NE浏览器视口_投递设置加载中` | `NE浏览器视口_投递设置加载中(hwnd, element_id, loading, progress)` | int | 底层直调 EU_PostSetBrowserViewportLoading：投递设置加载中。 |
| 1655 | `NE浏览器视口_设置截图` | `NE浏览器视口_设置截图(hwnd, element_id, bytes, len)` | void | 底层直调 EU_SetBrowserViewportScreenshot：设置截图。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1656 | `NE浏览器视口_投递设置截图` | `NE浏览器视口_投递设置截图(hwnd, element_id, bytes, len)` | int | 底层直调 EU_PostSetBrowserViewportScreenshot：投递设置截图。文本参数为 UTF-8 字节指针＋长度成对传入。 |
| 1657 | `NE浏览器视口_取状态` | `NE浏览器视口_取状态(hwnd, element_id, state, loading, progress)` | int | 底层直调 EU_GetBrowserViewportState：取状态。 |
| 1658 | `控件_取文本` | `控件_取文本(控件)` | wideString | 读取控件当前文本。 |
| 1659 | `控件_设置文本` | `控件_设置文本(控件, 文本)` | bool | 设置控件文本。 |
| 1660 | `控件_设置图片` | `控件_设置图片(控件, 图片路径)` | bool | 设置图片控件的本地图片路径。 |
| 1661 | `控件_设置启用` | `控件_设置启用(控件, 启用)` | bool | 启用或禁用控件。 |
| 1662 | `控件_设置可见` | `控件_设置可见(控件, 可见)` | bool | 显示或隐藏控件。 |
| 1663 | `控件_设置位置大小` | `控件_设置位置大小(控件, 横坐标, 纵坐标, 宽度, 高度)` | bool | 设置控件的位置和尺寸。 |
| 1664 | `控件_设置勾选` | `控件_设置勾选(控件, 勾选)` | bool | 设置支持勾选状态的控件。 |
| 1665 | `控件_取勾选` | `控件_取勾选(控件)` | bool | 读取控件勾选状态。 |
| 1666 | `控件_设置数值` | `控件_设置数值(控件, 数值)` | bool | 设置数值型控件的当前值。 |
| 1667 | `控件_取数值` | `控件_取数值(控件)` | int | 读取数值型控件的当前值。 |
| 1668 | `控件_设置选择项` | `控件_设置选择项(控件, 索引)` | bool | 设置选择型控件的当前项。 |
| 1669 | `控件_取选择项` | `控件_取选择项(控件)` | int | 读取选择型控件的当前项。 |
| 1670 | `控件_添加项目` | `控件_添加项目(控件, 文本)` | int | 向支持的集合控件添加项目。 |
| 1671 | `控件_清空项目` | `控件_清空项目(控件)` | bool | 清空支持的集合控件项目。 |
| 1672 | `NE表格_设置列` | `NE表格_设置列(控件, 列配置)` | bool | 设置 new_emoji 表格列。列配置为 new_emoji 高阶列 kv 协议文本（与 NE表格_设置列扩展 一致）：每行一列，字段用制表符分隔，支持 title=标题 key=标识 width=宽度 align=对齐(left/center/right) type=类型(text/selection/switch/combo/buttons/progress 等) fixed=left(冻结) sortable=1 filterable=1 options=选项1\|选项2。 |
| 1673 | `NE表格_设置行数据` | `NE表格_设置行数据(控件, 行数据)` | bool | 整体替换 new_emoji 表格行数据。行数据为 new_emoji 高阶行 kv 协议文本（与 NE表格_设置行列表扩展 一致）：每行一条记录，字段用制表符分隔，支持 key=行键 disabled=1 align=对齐，单元格按列序号写入 c0=第1列 c1=第2列……。 |
| 1674 | `NE表格_添加行` | `NE表格_添加行(控件, 行数据)` | int | 向 new_emoji 表格追加一行，行数据为高阶行 kv 协议单行文本（key=…	c0=…	c1=…），返回新行索引（失败返回 -1）。 |
| 1675 | `NE表格_插入行` | `NE表格_插入行(控件, 行号, 行数据)` | int | 向 new_emoji 表格指定位置插入一行，行数据为高阶行 kv 协议单行文本（key=…	c0=…	c1=…），返回插入后的行索引（失败返回 -1）。 |
| 1676 | `NE富列表_设置模板` | `NE富列表_设置模板(控件, 模板JSON)` | int | 设置 new_emoji 富列表节点模板。模板为 new_emoji 高阶模板 JSON 文本，与 NE富列表_设置模板直调 一致。 |
| 1677 | `NE富列表_设置条目` | `NE富列表_设置条目(控件, 条目JSON)` | int | 整体替换 new_emoji 富列表条目。条目为 new_emoji 高阶条目 JSON 数组文本，与 NE富列表_设置项 一致。 |
| 1678 | `NE富列表_添加条目` | `NE富列表_添加条目(控件, 条目JSON)` | int | 向 new_emoji 富列表追加一个条目，条目为高阶条目 JSON 文本，返回条目索引（失败返回 -1）。 |
| 1679 | `NE富列表_设置选中键` | `NE富列表_设置选中键(控件, 选中键JSON)` | int | 设置 new_emoji 富列表当前选中条目的 key JSON 数组文本，与 NE富列表_设置选中键直调 一致。 |
| 1680 | `NE富列表_设置倒计时` | `NE富列表_设置倒计时(控件, 键, 节点, 目标毫秒, 格式, 是否暂停)` | int | 为 new_emoji 富列表条目设置倒计时。目标毫秒为 Unix 毫秒时间戳，格式为时间显示格式文本，与 NE富列表_设置倒计时直调 一致。 |
| 1681 | `NE富列表_设置倒计时状态` | `NE富列表_设置倒计时状态(控件, 键, 节点, 是否暂停)` | int | 更新 new_emoji 富列表已有倒计时的暂停/继续状态，与 NE富列表_设置倒计时状态直调 一致。 |
| 1682 | `NE富列表_设置虚拟行数据` | `NE富列表_设置虚拟行数据(行数据)` | void | 在 NE富列表 的虚拟数据源同步事件处理器中调用，设置本次返回的条目 JSON 文本，与表格的 NE_设置表格虚拟行数据 同范式。 |
| 1683 | `NE菜单_设置项目` | `NE菜单_设置项目(控件, 项目文本)` | void | 设置 new_emoji 菜单项目。项目文本为 new_emoji 高阶菜单协议文本（换行分隔项目，> 前缀表示子菜单层级），与 NE菜单_设置项 一致。 |
| 1684 | `NE菜单_设置项目图标` | `NE菜单_设置项目图标(控件, 项目索引, 图标)` | void | 设置 new_emoji 菜单指定项目（从 0 开始）的图标，与 NE菜单_设置项图标 一致。 |
| 1685 | `NE菜单_设置项目快捷键` | `NE菜单_设置项目快捷键(控件, 项目索引, 快捷键)` | void | 设置 new_emoji 菜单指定项目（从 0 开始）的快捷键提示文本，与 NE菜单_设置项快捷键 一致。 |
| 1686 | `NE菜单_设置项目元数据` | `NE菜单_设置项目元数据(控件, 图标列表, 分组列表, 链接列表, 目标列表, 命令列表)` | void | 批量设置 new_emoji 菜单项目元数据（图标、分组、链接、目标、稳定命令），参数为 new_emoji 高阶协议 JSON 文本，空文本表示不设置，与 NE菜单_设置项元信息JSON 一致。 |
| 1687 | `NE徽标_设置文本` | `NE徽标_设置文本(控件, 文本)` | void | 设置 new_emoji 徽标显示文本（如 "3"、"new"），与 NE徽标_设置值 一致；纯数字可用控件_设置数值。 |
| 1688 | `NE标签页_设置激活索引` | `NE标签页_设置激活索引(控件, 索引)` | bool | 设置 new_emoji 标签页当前激活的项目索引（从 0 开始），与 NE标签页_设置活动 一致。 |
| 1689 | `NE标签页_取激活索引` | `NE标签页_取激活索引(控件)` | int | 读取 new_emoji 标签页当前激活的项目索引，与 NE标签页_取活动 一致。 |
| 1690 | `NE标签页_取激活标题` | `NE标签页_取激活标题(控件)` | wideString | 读取 new_emoji 标签页当前激活项目的标题文本，与 NE标签页_取活动名称 一致。 |
| 1691 | `NE标签页_取项目数量` | `NE标签页_取项目数量(控件)` | int | 读取 new_emoji 标签页项目总数，与 NE标签页_取项数量 一致。 |
| 1692 | `NE标签页_添加项目` | `NE标签页_添加项目(控件, 标题)` | bool | 向 new_emoji 标签页末尾追加一个项目，与 NE标签页_添加项 一致。 |
| 1693 | `NE标签页_关闭项目` | `NE标签页_关闭项目(控件, 索引)` | bool | 关闭 new_emoji 标签页指定项目（从 0 开始），与 NE标签页_关闭项 一致。 |
| 1694 | `NE标签页_设置滚动偏移` | `NE标签页_设置滚动偏移(控件, 偏移)` | bool | 设置 new_emoji 标签页表头滚动偏移，与 NE标签页_设置滚动 一致。 |
| 1695 | `NE标签页_滚动` | `NE标签页_滚动(控件, 增量)` | bool | 让 new_emoji 标签页表头按增量滚动，正数向右、负数向左，与 NE标签页_滚动直调 一致。 |
| 1696 | `NE标签页_设置标签样式` | `NE标签页_设置标签样式(控件, 样式)` | bool | 设置 new_emoji 标签页样式：0 线条、1 卡片、2 边框卡片，与 NE标签页_设置类型 一致。 |
| 1697 | `NE标签页_设置标签位置` | `NE标签页_设置标签位置(控件, 位置)` | bool | 设置 new_emoji 标签页表头位置：0 顶部、1 右侧、2 底部、3 左侧，与 NE标签页_设置位置 一致。 |
| 1698 | `NE标签页_设置表头对齐` | `NE标签页_设置表头对齐(控件, 对齐)` | bool | 设置 new_emoji 标签页表头文字对齐：0 左对齐、1 居中、2 右对齐，与 NE标签页_设置标签头对齐 一致。 |
| 1699 | `NE标签页_设置表头可见` | `NE标签页_设置表头可见(控件, 可见)` | bool | 设置 new_emoji 标签页是否显示表头，与 NE标签页_设置标签头可见 一致。 |
| 1700 | `NE标签页_设置可编辑` | `NE标签页_设置可编辑(控件, 可编辑)` | bool | 设置 new_emoji 标签页是否允许双击重命名项目，与 NE标签页_设置可编辑直调 一致。 |
| 1701 | `NE标签页_设置内容可见` | `NE标签页_设置内容可见(控件, 可见)` | bool | 设置 new_emoji 标签页内容区是否可见，与 NE标签页_设置内容可见直调 一致。 |
| 1702 | `NE标签页_启用浏览器模式` | `NE标签页_启用浏览器模式(控件, 启用)` | bool | 启用 new_emoji 标签页的浏览器式（Chrome）绘制，与 NE标签页_设置浏览器模式 一致。 |
| 1703 | `NE标签页_设置浏览器度量` | `NE标签页_设置浏览器度量(控件, 最小宽度, 最大宽度, 固定宽度, 标题高度, 重叠)` | bool | 设置 new_emoji 标签页浏览器模式的标签宽度、高度和重叠度量，与 NE标签页_设置浏览器尺寸参数 一致。 |
| 1704 | `NE标签页_设置项目图标` | `NE标签页_设置项目图标(控件, 索引, 图标)` | bool | 设置 new_emoji 标签页指定项目的图标，与 NE标签页_设置项图标 一致。 |
| 1705 | `NE标签页_设置项目可关闭` | `NE标签页_设置项目可关闭(控件, 索引, 可关闭)` | bool | 设置 new_emoji 标签页指定项目是否显示关闭按钮，与 NE标签页_设置项可关闭 一致。 |
| 1706 | `NE标签页_设置项目状态` | `NE标签页_设置项目状态(控件, 索引, 加载中, 固定, 静音, 提醒)` | bool | 批量设置 new_emoji 标签页项目的加载中、固定、静音、提醒状态（浏览器模式视觉），与 NE标签页_设置项浏览器状态 一致。 |
| 1707 | `NE标签页_设置新建按钮可见` | `NE标签页_设置新建按钮可见(控件, 可见)` | bool | 设置 new_emoji 标签页浏览器模式的「新建标签页」按钮是否可见，与 NE标签页_设置新建按钮可见直调 一致。 |
| 1708 | `NE标签页_设置拖拽选项` | `NE标签页_设置拖拽选项(控件, 允许重排, 允许分离)` | bool | 设置 new_emoji 标签页是否允许拖拽重排和拖出分离，与 NE标签页_设置拖拽选项直调 一致。 |
| 1709 | `NE_设置窗口图标` | `NE_设置窗口图标(窗口句柄, 图标路径)` | int | 从本地 .ico 文件路径设置 new_emoji 窗口图标，与 NE窗口_设置图标 一致。 |
| 1710 | `NE_设置主题令牌` | `NE_设置主题令牌(窗口句柄, 令牌名, 颜色值)` | int | 设置 new_emoji 主题令牌颜色（0xAARRGGBB），与 NE主题_设置令牌 一致。 |
| 1711 | `NE_显示消息框` | `NE_显示消息框(窗口句柄, 标题, 文本, 确认文本, 处理器)` | int | 显示 new_emoji 消息框（单个确认按钮）。处理器使用 &处理器名 引用，收到（结果编号, 结果值）两个整数参数；结果值 1 确认、2 关闭。 |
| 1712 | `NE_显示确认框` | `NE_显示确认框(窗口句柄, 标题, 文本, 确认文本, 取消文本, 处理器)` | int | 显示 new_emoji 确认框（确认+取消按钮）。处理器使用 &处理器名 引用，收到（结果编号, 结果值）两个整数参数；结果值 1 确认、2 取消、3 关闭。 |
| 1713 | `NE_显示扩展消息框` | `NE_显示扩展消息框(窗口句柄, 标题, 文本, 确认文本, 取消文本, 框类型, 显示取消, 居中, 富文本, 区分取消关闭, 处理器)` | int | 显示 new_emoji 扩展消息框。框类型与 new_emoji 高阶类型一致；处理器使用 &处理器名 引用，收到（结果编号, 动作, 输入文本）参数，输入文本仅在提问类消息框有值。 |
| 1714 | `NE表格_投递设置行数据` | `NE表格_投递设置行数据(控件, 行数据)` | int | 向界面线程投递整体替换 new_emoji 表格行数据（可在工作线程调用），协议与 NE表格_设置行数据 一致：每行一条 kv 记录（key=…	c0=…	c1=…），不是 JSON。 |
| 1715 | `NE表格_投递添加行` | `NE表格_投递添加行(控件, 行数据)` | int | 向界面线程投递向 new_emoji 表格追加一行（可在工作线程调用），行数据为高阶行 kv 协议单行文本（key=…	c0=…），不是 JSON。 |
| 1716 | `NE表格_投递插入行` | `NE表格_投递插入行(控件, 行号, 行数据)` | int | 向界面线程投递向 new_emoji 表格指定位置插入一行（可在工作线程调用），行数据为高阶行 kv 协议单行文本（key=…	c0=…），不是 JSON。 |
| 1717 | `NE表格_投递清空行` | `NE表格_投递清空行(控件)` | int | 向界面线程投递清空 new_emoji 表格全部行（可在工作线程调用）。 |
| 1718 | `NE菜单_投递项目` | `NE菜单_投递项目(控件, 项目文本)` | int | 向界面线程投递设置 new_emoji 菜单项目（可在工作线程调用），协议与 NE菜单_设置项目 一致。 |
| 1719 | `NE菜单_投递项目图标` | `NE菜单_投递项目图标(控件, 项目索引, 图标)` | int | 向界面线程投递设置 new_emoji 菜单指定项目图标（可在工作线程调用）。 |
| 1720 | `NE菜单_投递项目快捷键` | `NE菜单_投递项目快捷键(控件, 项目索引, 快捷键)` | int | 向界面线程投递设置 new_emoji 菜单指定项目快捷键提示（可在工作线程调用）。 |
| 1721 | `NE菜单_投递展开状态` | `NE菜单_投递展开状态(控件, 展开索引JSON)` | int | 向界面线程投递设置 new_emoji 多级菜单展开项（可在工作线程调用），展开索引为 JSON 数组文本，与 NE菜单_投递设置展开JSON 一致。 |
| 1722 | `NE徽标_投递设置文本` | `NE徽标_投递设置文本(控件, 文本)` | int | 向界面线程投递设置 new_emoji 徽标显示文本（可在工作线程调用）。 |
| 1723 | `NE富列表_投递设置模板` | `NE富列表_投递设置模板(控件, 模板JSON)` | int | 向界面线程投递设置 new_emoji 富列表节点模板（可在工作线程调用）。 |
| 1724 | `NE富列表_投递设置条目` | `NE富列表_投递设置条目(控件, 条目JSON)` | int | 向界面线程投递整体替换 new_emoji 富列表条目（可在工作线程调用）。 |
| 1725 | `NE富列表_投递添加条目` | `NE富列表_投递添加条目(控件, 条目JSON)` | int | 向界面线程投递向 new_emoji 富列表追加一个条目（可在工作线程调用）。 |
| 1726 | `NE富列表_投递更新条目` | `NE富列表_投递更新条目(控件, 键, 条目JSON)` | int | 向界面线程投递按键更新 new_emoji 富列表条目（可在工作线程调用），与 NE富列表_投递更新项 一致。 |
| 1727 | `NE富列表_投递删除条目` | `NE富列表_投递删除条目(控件, 键)` | int | 向界面线程投递按键删除 new_emoji 富列表条目（可在工作线程调用）。 |
| 1728 | `NE富列表_投递条目覆盖` | `NE富列表_投递条目覆盖(控件, 键, 覆盖JSON)` | int | 向界面线程投递设置 new_emoji 富列表条目节点级覆盖（可在工作线程调用），与 NE富列表_投递设置项覆盖 一致。 |
| 1729 | `NE富列表_投递设置选中键` | `NE富列表_投递设置选中键(控件, 选中键JSON)` | int | 向界面线程投递设置 new_emoji 富列表选中 key（可在工作线程调用）。 |
| 1730 | `NE表格_取单元格值` | `NE表格_取单元格值(控件, 行号, 列号)` | wideString | 读取 new_emoji 表格指定单元格文本。 |
| 1731 | `NE表格_取双击编辑状态` | `NE表格_取双击编辑状态(控件)` | wideString | 读取 new_emoji 表格双击编辑状态，返回 JSON 文本（enabled/editingRow/editingCol）。 |
| 1732 | `NE表格_取单元格双击可编辑` | `NE表格_取单元格双击可编辑(控件, 行号, 列号)` | int | 判断 new_emoji 表格指定单元格当前是否允许双击编辑，返回 1/0。 |
| 1733 | `NE菜单_取状态` | `NE菜单_取状态(控件)` | wideString | 读取 new_emoji 菜单运行状态，返回 JSON 文本（activeIndex/itemCount/orientation/activeLevel/visibleCount/expandedCount/hoverIndex）。 |
| 1734 | `NE菜单_取活动路径` | `NE菜单_取活动路径(控件)` | wideString | 读取 new_emoji 菜单当前活动项层级路径文本。 |
| 1735 | `NE菜单_取颜色` | `NE菜单_取颜色(控件)` | wideString | 读取 new_emoji 菜单当前配色，返回 JSON 文本（background/textColor/activeTextColor/hoverBackground/disabledTextColor/border，0xAARRGGBB）。 |
| 1736 | `NE菜单_取项目元数据` | `NE菜单_取项目元数据(控件, 项目索引)` | wideString | 读取 new_emoji 菜单指定项目元数据，返回 JSON 文本（icon/href/target/command/isGroup/disabled/level）。 |
| 1737 | `NE富列表_取模板` | `NE富列表_取模板(控件)` | wideString | 读取 new_emoji 富列表当前节点模板 JSON 文本。 |
| 1738 | `NE富列表_取条目们` | `NE富列表_取条目们(控件)` | wideString | 读取 new_emoji 富列表全部条目 JSON 文本。 |
| 1739 | `NE富列表_取条目` | `NE富列表_取条目(控件, 索引)` | wideString | 按索引读取 new_emoji 富列表单个条目 JSON 文本。 |
| 1740 | `NE富列表_取选中键` | `NE富列表_取选中键(控件)` | wideString | 读取 new_emoji 富列表当前选中 key 的 JSON 数组文本。 |
| 1741 | `NE富列表_取选项` | `NE富列表_取选项(控件)` | wideString | 读取 new_emoji 富列表选项，返回 JSON 文本（selectionMode/bordered/zebra/compact/keyboardNavigation/showScrollbar）。 |
| 1742 | `NE富列表_取样式` | `NE富列表_取样式(控件)` | wideString | 读取 new_emoji 富列表样式，返回 JSON 文本（rowHeight/paddingX/paddingY/scrollbarWidth/align/selectedColor/hoverColor）。 |
| 1743 | `NE富列表_取倒计时状态` | `NE富列表_取倒计时状态(控件, 键, 节点)` | wideString | 读取 new_emoji 富列表条目倒计时状态 JSON 文本。 |
| 1744 | `NE富列表_更新条目` | `NE富列表_更新条目(控件, 键, 条目JSON)` | int | 按键更新 new_emoji 富列表条目内容，与 NE富列表_更新项 一致。 |
| 1745 | `NE富列表_删除条目` | `NE富列表_删除条目(控件, 键)` | int | 按键删除 new_emoji 富列表条目。 |
| 1746 | `NE富列表_条目覆盖` | `NE富列表_条目覆盖(控件, 键, 覆盖JSON)` | int | 设置 new_emoji 富列表条目节点级覆盖 JSON 文本，与 NE富列表_设置项覆盖 一致。 |
| 1747 | `NE富列表_追加倒计时` | `NE富列表_追加倒计时(控件, 键, 节点, 追加毫秒)` | int | 为 new_emoji 富列表已有倒计时追加毫秒数（负数回拨），与 NE富列表_添加倒计时时间 一致。 |
| 1748 | `NE富列表_清空条目` | `NE富列表_清空条目(控件)` | int | 清空 new_emoji 富列表全部条目，返回剩余条目数。 |
| 1749 | `NE_设置窗口图标字节` | `NE_设置窗口图标字节(窗口句柄, 图标字节集)` | int | 从内存字节集设置 new_emoji 窗口图标（.ico/.png 字节），与 NE窗口_设置图标字节 一致。 |
| 1750 | `NE_显示提问框` | `NE_显示提问框(窗口句柄, 标题, 文本, 占位文本, 初始值, 校验模式, 错误提示, 确认文本, 取消文本, 框类型, 居中, 富文本, 区分取消关闭, 处理器)` | int | 显示 new_emoji 提问框（带输入框）。处理器使用 &处理器名 引用，收到（结果编号, 动作, 输入文本）参数。 |
| 1751 | `NE_显示通知` | `NE_显示通知(窗口句柄, 标题, 正文, 通知类型, 可关闭, 时长毫秒, 摆放, 偏移, 富文本, 宽度, 高度)` | int | 弹出 new_emoji 运行时通知，返回通知编号；摆放 0 右下、1 右上、2 左下、3 左上。 |
| 1752 | `NE_显示加载遮罩` | `NE_显示加载遮罩(窗口句柄, 目标控件, 文本, 全屏, 锁输入, 背景色, 圈颜色, 文本颜色, 样式)` | int | 显示 new_emoji 加载遮罩，返回加载编号；传 0 加载编号给 NE_关闭加载遮罩 结束。 |
| 1753 | `NE_关闭加载遮罩` | `NE_关闭加载遮罩(窗口句柄, 加载编号)` | void | 关闭 NE_显示加载遮罩 返回的加载遮罩。 |
| 1754 | `NE表格_导出Excel` | `NE表格_导出Excel(控件, 文件路径, 标志)` | int | 把 new_emoji 表格导出为 Excel 文件，与 NE表格_导出Excel直调 一致。 |
| 1755 | `NE表格_导入Excel` | `NE表格_导入Excel(控件, 文件路径, 标志)` | int | 从 Excel 文件导入数据到 new_emoji 表格，与 NE表格_导入Excel直调 一致。 |
| 1756 | `NE元素_设置鼠标光标` | `NE元素_设置鼠标光标(控件, 光标形状)` | bool | 设置任意 new_emoji 可视元素的鼠标光标形状。光标形状：-1 恢复默认；0 箭头；1 手型（超链接手）；2 文本 I 型；3 十字；4 禁止；32512~32654 直传 Win32 标准光标资源号（IDC_*）。适用于按钮、文本、面板等全部元素；可点元素（按钮、链接、可点单元格所在表格列）推荐设 1 手型。 |
| 1757 | `NE按钮_设置鼠标光标` | `NE按钮_设置鼠标光标(控件, 光标形状)` | bool | 设置 new_emoji 按钮的鼠标光标形状，等价于对按钮调 NE元素_设置鼠标光标。光标形状：-1 恢复默认；0 箭头；1 手型；2 文本 I 型；3 十字；4 禁止。 |
| 1758 | `NE按钮_设置悬停三态色` | `NE按钮_设置悬停三态色(控件, 悬停背景, 悬停边框, 悬停文字, 按下背景, 按下边框, 按下文字)` | bool | 设置 new_emoji 按钮悬停与按下两个交互态的颜色（0xAARRGGBB）。颜色传 0 表示该通道沿用当前配色/主题默认。换肤的应用配色 里必须按主题重新下发，否则悬停色停留在旧主题。 |
| 1759 | `NE表格_设置悬停行颜色` | `NE表格_设置悬停行颜色(控件, 是否启用, 背景色, 文字色)` | bool | 启用 new_emoji 表格的行悬停高亮：鼠标所在行整行变色（DLL 原生跟踪悬停行，含滚动，无需再用鼠标移动事件手工换行刷色）。背景色/文字色为 0xAARRGGBB，传 0 表示该通道沿用主题默认。启用时自定义悬停底色优先于行样式底色（选中行除外）；是否启用=假 恢复主题默认悬停。换肤后需在 应用配色 里按主题重新下发。 |
| 1760 | `NE表格_设置悬停列` | `NE表格_设置悬停列(控件, 列号, 是否启用, 背景色, 文字色, 光标形状)` | bool | 设置 new_emoji 表格某一数据列的悬停高亮与光标：鼠标位于该列单元格时单元格变色并可显示手型光标（列号 0 基，只作用于数据区，表头与滚动条不触发）。背景色/文字色 0xAARRGGBB，传 0 表示该通道沿用默认；光标形状 -1 不改、0 箭头、1 手型、2 文本 I 型、3 十字、4 禁止。适合「操作」「删除」这类可点击单元格列。 |
| 1761 | `NE输入框_设置占位文本` | `NE输入框_设置占位文本(控件, 占位文本)` | bool | 设置 输入框 Input 的占位文本。对应 EU_SetInputPlaceholder 的宽字符封装，禁止改调底层直调命令 NE输入框_设置占位提示。 |
| 1762 | `NE输入框_设置前缀` | `NE输入框_设置前缀(控件, 前缀, 后缀)` | bool | 设置 输入框 Input 的前缀、后缀。对应 EU_SetInputAffixes 的宽字符封装，禁止改调底层直调命令 NE输入框_设置前后缀。 |
| 1763 | `NE输入框_设置占位文本2` | `NE输入框_设置占位文本2(控件, 占位文本)` | bool | 设置 输入框 Input 的占位文本。对应 EU_SetInputTagPlaceholder 的宽字符封装，禁止改调底层直调命令 NE标签输入框_设置占位提示。 |
| 1764 | `NE编辑框_设置只读` | `NE编辑框_设置只读(控件, 只读, 密码输入, 多行输入, 焦点边框色, 占位文本)` | bool | 设置 编辑框 EditBox 的只读、密码输入、多行输入、焦点边框色、占位文本。对应 EU_SetEditBoxOptions 的宽字符封装，禁止改调底层直调命令 NE编辑框_设置选项。 |
| 1765 | `NE表格_设置基础列标题` | `NE表格_设置基础列标题(控件, 基础列标题, 基础行数据)` | bool | 设置 表格 Table 的基础列标题、基础行数据。对应 EU_SetTableData 的宽字符封装，禁止改调底层直调命令 NE表格_设置数据。 |
| 1766 | `NE表格_设置没有数据时显示的文字` | `NE表格_设置没有数据时显示的文字(控件, 没有数据时显示的文字)` | bool | 设置 表格 Table 的没有数据时显示的文字。对应 EU_SetTableEmptyText 的宽字符封装，禁止改调底层直调命令 NE表格_设置空态文本。 |
| 1767 | `NE表格_设置特殊单元格配置` | `NE表格_设置特殊单元格配置(控件, 特殊单元格配置)` | bool | 设置 表格 Table 的特殊单元格配置。对应 EU_SetTableCellOverridesUtf8 的宽字符封装，禁止改调底层直调命令 NE表格_设置单元格批量覆盖JSON。 |
| 1768 | `NE表格_设置合并单元格配置` | `NE表格_设置合并单元格配置(控件, 合并单元格配置)` | bool | 设置 表格 Table 的合并单元格配置。对应 EU_SetTableSpansUtf8 的宽字符封装，禁止改调底层直调命令 NE表格_设置批量单元格合并JSON。 |
| 1769 | `NE表格_设置默认选中的多行序号` | `NE表格_设置默认选中的多行序号(控件, 默认选中的多行序号)` | bool | 设置 表格 Table 的默认选中的多行序号。对应 EU_SetTableSelectedRows 的宽字符封装，禁止改调底层直调命令 NE表格_设置选中行列表。 |
| 1770 | `NE表格_设置默认搜索文字` | `NE表格_设置默认搜索文字(控件, 默认搜索文字)` | bool | 设置 表格 Table 的默认搜索文字。对应 EU_SetTableSearch 的宽字符封装，禁止改调底层直调命令 NE表格_设置搜索。 |
| 1771 | `NE表格_设置合计行文字` | `NE表格_设置合计行文字(控件, 合计行文字)` | bool | 设置 表格 Table 的合计行文字。对应 EU_SetTableSummary 的宽字符封装，禁止改调底层直调命令 NE表格_设置汇总行。 |
| 1772 | `NE列表框_设置简单项目` | `NE列表框_设置简单项目(控件, 简单项目)` | bool | 设置 列表框 ListBox 的简单项目。对应 EU_SetListBoxItems 的宽字符封装，禁止改调底层直调命令 NE列表框_设置项。 |
| 1773 | `NE列表框_设置高级项目` | `NE列表框_设置高级项目(控件, 高级项目)` | bool | 设置 列表框 ListBox 的高级项目。对应 EU_SetListBoxItemsEx 的宽字符封装，禁止改调底层直调命令 NE列表框_设置项扩展。 |
| 1774 | `NE列表框_设置选中Key` | `NE列表框_设置选中Key(控件, 选中 Key)` | bool | 设置 列表框 ListBox 的选中 Key。对应 EU_SetListBoxSelectedKeys 的宽字符封装，禁止改调底层直调命令 NE列表框_设置选中键。 |
| 1775 | `NE卡片_设置标题` | `NE卡片_设置标题(控件, 标题)` | bool | 设置 卡片 Card 的标题。对应 EU_SetCardTitle 的宽字符封装，禁止改调底层直调命令 NE卡片_设置标题直调。 |
| 1776 | `NE卡片_设置正文` | `NE卡片_设置正文(控件, 正文)` | bool | 设置 卡片 Card 的正文。对应 EU_SetCardBody 的宽字符封装，禁止改调底层直调命令 NE卡片_设置主体。 |
| 1777 | `NE菜单_设置展开项索引` | `NE菜单_设置展开项索引(控件, 展开项索引)` | bool | 设置 菜单 Menu 的展开项索引。对应 EU_SetMenuExpandedUtf8 的宽字符封装，禁止改调底层直调命令 NE菜单_设置展开JSON。 |
| 1778 | `NE标签页_设置标签项` | `NE标签页_设置标签项(控件, 标签项)` | bool | 设置 标签页 Tabs 的标签项。对应 EU_SetTabsItems 的宽字符封装，禁止改调底层直调命令 NE标签页_设置项。 |
| 1779 | `NE标签页_设置标签项2` | `NE标签页_设置标签项2(控件, 标签项)` | bool | 设置 标签页 Tabs 的标签项。对应 EU_SetTabsItemsEx 的宽字符封装，禁止改调底层直调命令 NE标签页_设置项扩展。 |
| 1780 | `NE弹窗_设置标题` | `NE弹窗_设置标题(控件, 标题)` | bool | 设置 弹窗 Dialog 的标题。对应 EU_SetDialogTitle 的宽字符封装，禁止改调底层直调命令 NE弹窗_设置标题直调。 |
| 1781 | `NE弹窗_设置正文` | `NE弹窗_设置正文(控件, 正文)` | bool | 设置 弹窗 Dialog 的正文。对应 EU_SetDialogBody 的宽字符封装，禁止改调底层直调命令 NE弹窗_设置主体。 |
| 1782 | `NE抽屉_设置标题` | `NE抽屉_设置标题(控件, 标题)` | bool | 设置 抽屉 Drawer 的标题。对应 EU_SetDrawerTitle 的宽字符封装，禁止改调底层直调命令 NE抽屉_设置标题直调。 |
| 1783 | `NE抽屉_设置正文` | `NE抽屉_设置正文(控件, 正文)` | bool | 设置 抽屉 Drawer 的正文。对应 EU_SetDrawerBody 的宽字符封装，禁止改调底层直调命令 NE抽屉_设置主体。 |
| 1784 | `NE通知_设置正文` | `NE通知_设置正文(控件, 正文)` | bool | 设置 通知 Notification 的正文。对应 EU_SetNotificationBody 的宽字符封装，禁止改调底层直调命令 NE通知_设置主体。 |
| 1785 | `NE消息提示_设置消息内容` | `NE消息提示_设置消息内容(控件, 消息内容)` | bool | 设置 消息提示 Message 的消息内容。对应 EU_SetMessageText 的宽字符封装，禁止改调底层直调命令 NE消息提示_设置文本。 |
| 1786 | `NE信息框_设置标题` | `NE信息框_设置标题(控件, 标题, 正文)` | bool | 设置 信息框 InfoBox 的标题、正文。对应 EU_SetInfoBoxText 的宽字符封装，禁止改调底层直调命令 NE信息框_设置文本。 |
| 1787 | `NE信息框_设置信息类型` | `NE信息框_设置信息类型(控件, 信息类型, 可关闭, 强调色, 图标)` | bool | 设置 信息框 InfoBox 的信息类型、可关闭、强调色、图标。对应 EU_SetInfoBoxOptions 的宽字符封装，禁止改调底层直调命令 NE信息框_设置选项。 |
| 1788 | `NE链接_设置前缀图标` | `NE链接_设置前缀图标(控件, 前缀图标, 后缀图标, 链接地址, 打开目标)` | bool | 设置 链接 Link 的前缀图标、后缀图标、链接地址、打开目标。对应 EU_SetLinkContent 的宽字符封装，禁止改调底层直调命令 NE链接_设置内容。 |
| 1789 | `NE页眉_设置标题` | `NE页眉_设置标题(控件, 标题)` | bool | 设置 页眉 Header 的标题。对应 EU_SetElementText 的宽字符封装，禁止改调底层直调命令 NE元素_设置文本。 |
| 1790 | `NE侧边栏_设置标题` | `NE侧边栏_设置标题(控件, 标题)` | bool | 设置 侧边栏 Aside 的标题。对应 EU_SetElementText 的宽字符封装，禁止改调底层直调命令 NE元素_设置文本。 |
| 1791 | `NE主要区域_设置标题` | `NE主要区域_设置标题(控件, 标题)` | bool | 设置 主要区域 Main 的标题。对应 EU_SetElementText 的宽字符封装，禁止改调底层直调命令 NE元素_设置文本。 |
| 1792 | `NE页脚_设置标题` | `NE页脚_设置标题(控件, 标题)` | bool | 设置 页脚 Footer 的标题。对应 EU_SetElementText 的宽字符封装，禁止改调底层直调命令 NE元素_设置文本。 |
| 1793 | `NE边框_设置边框边位` | `NE边框_设置边框边位(控件, 边框边位, 边框色, 边框宽度, 圆角, 标题)` | bool | 设置 边框 Border 的边框边位、边框色、边框宽度、圆角、标题。对应 EU_SetBorderOptions 的宽字符封装，禁止改调底层直调命令 NE边框_设置选项。 |
| 1794 | `NE分割线_设置方向` | `NE分割线_设置方向(控件, 方向, 内容位置, 线条颜色, 线宽, 虚线, content)` | bool | 设置 分割线 Divider 的方向、内容位置、线条颜色、线宽、虚线、content。对应 EU_SetDividerOptions 的宽字符封装，禁止改调底层直调命令 NE分割线_设置选项。 |
| 1795 | `NE选择器_设置选项` | `NE选择器_设置选项(控件, 选项)` | bool | 设置 选择器 Select 的选项。对应 EU_SetSelectOptions 的宽字符封装，禁止改调底层直调命令 NE选择器_设置选项直调。 |
| 1796 | `NE选择器_设置选项2` | `NE选择器_设置选项2(控件, 选项)` | bool | 设置 选择器 Select 的选项。对应 EU_SetSelectV2Options 的宽字符封装，禁止改调底层直调命令 NE虚拟选择器_设置选项直调。 |
| 1797 | `NE虚拟选择器_设置选项` | `NE虚拟选择器_设置选项(控件, 选项)` | bool | 设置 虚拟选择器 SelectV2 的选项。对应 EU_SetSelectV2Options 的宽字符封装，禁止改调底层直调命令 NE虚拟选择器_设置选项直调。 |
| 1798 | `NE虚拟选择器_设置搜索文本` | `NE虚拟选择器_设置搜索文本(控件, 搜索文本)` | bool | 设置 虚拟选择器 SelectV2 的搜索文本。对应 EU_SetSelectV2Search 的宽字符封装，禁止改调底层直调命令 NE虚拟选择器_设置搜索。 |
| 1799 | `NE数字输入框_设置当前值` | `NE数字输入框_设置当前值(控件, 当前值)` | bool | 设置 数字输入框 InputNumber 的当前值。对应 EU_SetInputNumberText 的宽字符封装，禁止改调底层直调命令 NE数字输入框_设置文本。 |
| 1800 | `NE标签输入框_设置标签` | `NE标签输入框_设置标签(控件, 标签)` | bool | 设置 标签输入框 InputTag 的标签。对应 EU_SetInputTagTags 的宽字符封装，禁止改调底层直调命令 NE标签输入框_设置标签直调。 |
| 1801 | `NE标签输入框_设置占位文本` | `NE标签输入框_设置占位文本(控件, 占位文本)` | bool | 设置 标签输入框 InputTag 的占位文本。对应 EU_SetInputTagPlaceholder 的宽字符封装，禁止改调底层直调命令 NE标签输入框_设置占位提示。 |
| 1802 | `NE组合输入_设置当前值` | `NE组合输入_设置当前值(控件, 当前值)` | bool | 设置 组合输入 InputGroup 的当前值。对应 EU_SetInputGroupValue 的宽字符封装，禁止改调底层直调命令 NE组合输入_设置值。 |
| 1803 | `NE评分_设置显示文本` | `NE评分_设置显示文本(控件, 显示文本, 显示分数, 文本颜色, 分数模板)` | bool | 设置 评分 Rate 的显示文本、显示分数、文本颜色、分数模板。对应 EU_SetRateDisplayOptions 的宽字符封装，禁止改调底层直调命令 NE评分_设置显示选项。 |
| 1804 | `NE进度条_设置分段颜色` | `NE进度条_设置分段颜色(控件, 分段颜色)` | bool | 设置 进度条 Progress 的分段颜色。对应 EU_SetProgressColorStops 的宽字符封装，禁止改调底层直调命令 NE进度条_设置颜色断点。 |
| 1805 | `NE进度条_设置文本模板` | `NE进度条_设置文本模板(控件, 文本模板)` | bool | 设置 进度条 Progress 的文本模板。对应 EU_SetProgressTextTemplate 的宽字符封装，禁止改调底层直调命令 NE进度条_设置文本模板直调。 |
| 1806 | `NE头像_设置图片地址` | `NE头像_设置图片地址(控件, 图片地址)` | bool | 设置 头像 Avatar 的图片地址。对应 EU_SetAvatarSource 的宽字符封装，禁止改调底层直调命令 NE头像_设置来源。 |
| 1807 | `NE头像_设置备用图片` | `NE头像_设置备用图片(控件, 备用图片)` | bool | 设置 头像 Avatar 的备用图片。对应 EU_SetAvatarFallbackSource 的宽字符封装，禁止改调底层直调命令 NE头像_设置回退来源。 |
| 1808 | `NE头像_设置图标` | `NE头像_设置图标(控件, 图标)` | bool | 设置 头像 Avatar 的图标。对应 EU_SetAvatarIcon 的宽字符封装，禁止改调底层直调命令 NE头像_设置图标直调。 |
| 1809 | `NE空状态_设置描述` | `NE空状态_设置描述(控件, 描述)` | bool | 设置 空状态 Empty 的描述。对应 EU_SetEmptyDescription 的宽字符封装，禁止改调底层直调命令 NE空状态_设置描述直调。 |
| 1810 | `NE空状态_设置图标` | `NE空状态_设置图标(控件, 图标, 按钮文本)` | bool | 设置 空状态 Empty 的图标、按钮文本。对应 EU_SetEmptyOptions 的宽字符封装，禁止改调底层直调命令 NE空状态_设置选项。 |
| 1811 | `NE空状态_设置图片地址` | `NE空状态_设置图片地址(控件, 图片地址)` | bool | 设置 空状态 Empty 的图片地址。对应 EU_SetEmptyImage 的宽字符封装，禁止改调底层直调命令 NE空状态_设置图片。 |
| 1812 | `NE警告提示_设置描述` | `NE警告提示_设置描述(控件, 描述)` | bool | 设置 警告提示 Alert 的描述。对应 EU_SetAlertDescription 的宽字符封装，禁止改调底层直调命令 NE警告提示_设置描述直调。 |
| 1813 | `NE结果页_设置副标题` | `NE结果页_设置副标题(控件, 副标题)` | bool | 设置 结果页 Result 的副标题。对应 EU_SetResultSubtitle 的宽字符封装，禁止改调底层直调命令 NE结果页_设置副标题直调。 |
| 1814 | `NE面包屑_设置路径项` | `NE面包屑_设置路径项(控件, 路径项)` | bool | 设置 面包屑 Breadcrumb 的路径项。对应 EU_SetBreadcrumbItems 的宽字符封装，禁止改调底层直调命令 NE面包屑_设置项。 |
| 1815 | `NE面包屑_设置分隔符` | `NE面包屑_设置分隔符(控件, 分隔符)` | bool | 设置 面包屑 Breadcrumb 的分隔符。对应 EU_SetBreadcrumbSeparator 的宽字符封装，禁止改调底层直调命令 NE面包屑_设置分隔符直调。 |
| 1816 | `NE步骤条_设置步骤项` | `NE步骤条_设置步骤项(控件, 步骤项)` | bool | 设置 步骤条 Steps 的步骤项。对应 EU_SetStepsItems 的宽字符封装，禁止改调底层直调命令 NE步骤条_设置项。 |
| 1817 | `NE步骤条_设置步骤项2` | `NE步骤条_设置步骤项2(控件, 步骤项)` | bool | 设置 步骤条 Steps 的步骤项。对应 EU_SetStepsDetailItems 的宽字符封装，禁止改调底层直调命令 NE步骤条_设置明细项。 |
| 1818 | `NE步骤条_设置步骤项3` | `NE步骤条_设置步骤项3(控件, 步骤项)` | bool | 设置 步骤条 Steps 的步骤项。对应 EU_SetStepsIconItems 的宽字符封装，禁止改调底层直调命令 NE步骤条_设置图标步骤项。 |
| 1819 | `NE描述列表_设置描述项` | `NE描述列表_设置描述项(控件, 描述项)` | bool | 设置 描述列表 Descriptions 的描述项。对应 EU_SetDescriptionsItems 的宽字符封装，禁止改调底层直调命令 NE描述列表_设置项。 |
| 1820 | `NE描述列表_设置描述项2` | `NE描述列表_设置描述项2(控件, 描述项)` | bool | 设置 描述列表 Descriptions 的描述项。对应 EU_SetDescriptionsItemsEx 的宽字符封装，禁止改调底层直调命令 NE描述列表_设置项扩展。 |
| 1821 | `NE折叠面板_设置面板项` | `NE折叠面板_设置面板项(控件, 面板项)` | bool | 设置 折叠面板 Collapse 的面板项。对应 EU_SetCollapseItems 的宽字符封装，禁止改调底层直调命令 NE折叠面板_设置项。 |
| 1822 | `NE折叠面板_设置面板项2` | `NE折叠面板_设置面板项2(控件, 面板项)` | bool | 设置 折叠面板 Collapse 的面板项。对应 EU_SetCollapseItemsEx 的宽字符封装，禁止改调底层直调命令 NE折叠面板_设置项扩展。 |
| 1823 | `NE折叠面板_设置手风琴模式` | `NE折叠面板_设置手风琴模式(控件, 手风琴模式, 允许全部收起, 动画, 禁用索引)` | bool | 设置 折叠面板 Collapse 的手风琴模式、允许全部收起、动画、禁用索引。对应 EU_SetCollapseAdvancedOptions 的宽字符封装，禁止改调底层直调命令 NE折叠面板_设置高级选项。 |
| 1824 | `NE时间线_设置时间线项` | `NE时间线_设置时间线项(控件, 时间线项)` | bool | 设置 时间线 Timeline 的时间线项。对应 EU_SetTimelineItems 的宽字符封装，禁止改调底层直调命令 NE时间线_设置项。 |
| 1825 | `NE统计数值_设置数值` | `NE统计数值_设置数值(控件, 数值)` | bool | 设置 统计数值 Statistic 的数值。对应 EU_SetStatisticValue 的宽字符封装，禁止改调底层直调命令 NE统计数值_设置值。 |
| 1826 | `NE统计数值_设置标题` | `NE统计数值_设置标题(控件, 标题, 前缀, 后缀)` | bool | 设置 统计数值 Statistic 的标题、前缀、后缀。对应 EU_SetStatisticFormat 的宽字符封装，禁止改调底层直调命令 NE统计数值_设置格式。 |
| 1827 | `NEKPI卡片_设置数值` | `NEKPI卡片_设置数值(控件, 数值, 副标题, 趋势, 趋势类型)` | bool | 设置 KPI 卡片 KpiCard 的数值、副标题、趋势、趋势类型。对应 EU_SetKpiCardData 的宽字符封装，禁止改调底层直调命令 NEKPI卡片_设置数据。 |
| 1828 | `NEKPI卡片_设置加载中` | `NEKPI卡片_设置加载中(控件, 加载中, 帮助文本)` | bool | 设置 KPI 卡片 KpiCard 的加载中、帮助文本。对应 EU_SetKpiCardOptions 的宽字符封装，禁止改调底层直调命令 NEKPI卡片_设置选项。 |
| 1829 | `NE趋势_设置数值` | `NE趋势_设置数值(控件, 数值, 百分比, 详情, 方向)` | bool | 设置 趋势 Trend 的数值、百分比、详情、方向。对应 EU_SetTrendData 的宽字符封装，禁止改调底层直调命令 NE趋势_设置数据。 |
| 1830 | `NE状态点_设置标签` | `NE状态点_设置标签(控件, 标签, 描述, 状态)` | bool | 设置 状态点 StatusDot 的标签、描述、状态。对应 EU_SetStatusDot 的宽字符封装，禁止改调底层直调命令 NE状态点_设置。 |
| 1831 | `NE仪表盘_设置数值` | `NE仪表盘_设置数值(控件, 数值, 说明, 状态)` | bool | 设置 仪表盘 Gauge 的数值、说明、状态。对应 EU_SetGaugeValue 的宽字符封装，禁止改调底层直调命令 NE仪表盘_设置值。 |
| 1832 | `NE环形进度_设置数值` | `NE环形进度_设置数值(控件, 数值, 标签, 状态)` | bool | 设置 环形进度 RingProgress 的数值、标签、状态。对应 EU_SetRingProgressValue 的宽字符封装，禁止改调底层直调命令 NE环形进度_设置值。 |
| 1833 | `NE子弹进度_设置当前值` | `NE子弹进度_设置当前值(控件, 当前值, 目标值, 描述, 状态)` | bool | 设置 子弹进度 BulletProgress 的当前值、目标值、描述、状态。对应 EU_SetBulletProgressValue 的宽字符封装，禁止改调底层直调命令 NE子弹进度_设置值。 |
| 1834 | `NE折线图_设置数据点` | `NE折线图_设置数据点(控件, 数据点)` | bool | 设置 折线图 LineChart 的数据点。对应 EU_SetLineChartData 的宽字符封装，禁止改调底层直调命令 NE折线图_设置数据。 |
| 1835 | `NE柱状图_设置柱状数据` | `NE柱状图_设置柱状数据(控件, 柱状数据)` | bool | 设置 柱状图 BarChart 的柱状数据。对应 EU_SetBarChartData 的宽字符封装，禁止改调底层直调命令 NE柱状图_设置数据。 |
| 1836 | `NE环形图_设置分片数据` | `NE环形图_设置分片数据(控件, 分片数据, 激活索引)` | bool | 设置 环形图 DonutChart 的分片数据、激活索引。对应 EU_SetDonutChartData 的宽字符封装，禁止改调底层直调命令 NE环形图_设置数据。 |
| 1837 | `NE树_设置树节点` | `NE树_设置树节点(控件, 树节点)` | bool | 设置 树 Tree 的树节点。对应 EU_SetTreeItems 的宽字符封装，禁止改调底层直调命令 NE树_设置项。 |
| 1838 | `NE树_设置树节点2` | `NE树_设置树节点2(控件, 树节点)` | bool | 设置 树 Tree 的树节点。对应 EU_SetTreeSelectItems 的宽字符封装，禁止改调底层直调命令 NE树选择_设置项。 |
| 1839 | `NE树_设置树数据JSON` | `NE树_设置树数据JSON(控件, 树数据 JSON)` | bool | 设置 树 Tree 的树数据 JSON。对应 EU_SetTreeDataJson 的宽字符封装，禁止改调底层直调命令 NE树_设置数据JSON。 |
| 1840 | `NE树选择_设置树节点` | `NE树选择_设置树节点(控件, 树节点)` | bool | 设置 树选择 TreeSelect 的树节点。对应 EU_SetTreeSelectItems 的宽字符封装，禁止改调底层直调命令 NE树选择_设置项。 |
| 1841 | `NE树选择_设置搜索值` | `NE树选择_设置搜索值(控件, 搜索值)` | bool | 设置 树选择 TreeSelect 的搜索值。对应 EU_SetTreeSelectSearch 的宽字符封装，禁止改调底层直调命令 NE树选择_设置搜索。 |
| 1842 | `NE树选择_设置树选择数据JSON` | `NE树选择_设置树选择数据JSON(控件, 树选择数据 JSON)` | bool | 设置 树选择 TreeSelect 的树选择数据 JSON。对应 EU_SetTreeSelectDataJson 的宽字符封装，禁止改调底层直调命令 NE树选择_设置数据JSON。 |
| 1843 | `NE穿梭框_设置左侧项` | `NE穿梭框_设置左侧项(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferItems 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置项。 |
| 1844 | `NE穿梭框_设置左侧项2` | `NE穿梭框_设置左侧项2(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferFilters 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置筛选。 |
| 1845 | `NE穿梭框_设置左侧项3` | `NE穿梭框_设置左侧项3(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferTitles 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置标题。 |
| 1846 | `NE穿梭框_设置左侧项4` | `NE穿梭框_设置左侧项4(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferButtonTexts 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置按钮文本。 |
| 1847 | `NE穿梭框_设置左侧项5` | `NE穿梭框_设置左侧项5(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferFooterTexts 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置页脚文本。 |
| 1848 | `NE穿梭框_设置左侧项6` | `NE穿梭框_设置左侧项6(控件, 左侧项, 右侧项)` | bool | 设置 穿梭框 Transfer 的左侧项、右侧项。对应 EU_SetTransferCheckedKeys 的宽字符封装，禁止改调底层直调命令 NE穿梭框_设置勾选键。 |
| 1849 | `NE自动完成_设置建议项` | `NE自动完成_设置建议项(控件, 建议项)` | bool | 设置 自动完成 Autocomplete 的建议项。对应 EU_SetAutocompleteSuggestions 的宽字符封装，禁止改调底层直调命令 NE自动完成_设置建议。 |
| 1850 | `NE自动完成_设置当前值` | `NE自动完成_设置当前值(控件, 当前值)` | bool | 设置 自动完成 Autocomplete 的当前值。对应 EU_SetAutocompleteValue 的宽字符封装，禁止改调底层直调命令 NE自动完成_设置值。 |
| 1851 | `NE自动完成_设置占位文本` | `NE自动完成_设置占位文本(控件, 占位文本)` | bool | 设置 自动完成 Autocomplete 的占位文本。对应 EU_SetAutocompletePlaceholder 的宽字符封装，禁止改调底层直调命令 NE自动完成_设置占位提示。 |
| 1852 | `NE提及_设置当前值` | `NE提及_设置当前值(控件, 当前值)` | bool | 设置 提及 Mentions 的当前值。对应 EU_SetMentionsValue 的宽字符封装，禁止改调底层直调命令 NE提及_设置值。 |
| 1853 | `NE提及_设置建议项` | `NE提及_设置建议项(控件, 建议项)` | bool | 设置 提及 Mentions 的建议项。对应 EU_SetMentionsSuggestions 的宽字符封装，禁止改调底层直调命令 NE提及_设置建议。 |
| 1854 | `NE提及_设置触发符` | `NE提及_设置触发符(控件, 触发符, 启用筛选, 插入空格)` | bool | 设置 提及 Mentions 的触发符、启用筛选、插入空格。对应 EU_SetMentionsOptions 的宽字符封装，禁止改调底层直调命令 NE提及_设置选项。 |
| 1855 | `NE级联选择_设置选项` | `NE级联选择_设置选项(控件, 选项)` | bool | 设置 级联选择 Cascader 的选项。对应 EU_SetCascaderOptions 的宽字符封装，禁止改调底层直调命令 NE级联选择_设置选项直调。 |
| 1856 | `NE级联选择_设置已选值` | `NE级联选择_设置已选值(控件, 已选值)` | bool | 设置 级联选择 Cascader 的已选值。对应 EU_SetCascaderValue 的宽字符封装，禁止改调底层直调命令 NE级联选择_设置值。 |
| 1857 | `NE级联选择_设置搜索值` | `NE级联选择_设置搜索值(控件, 搜索值)` | bool | 设置 级联选择 Cascader 的搜索值。对应 EU_SetCascaderSearch 的宽字符封装，禁止改调底层直调命令 NE级联选择_设置搜索。 |
| 1858 | `NE日期选择_设置占位文本` | `NE日期选择_设置占位文本(控件, 占位文本)` | bool | 设置 日期选择 DatePicker 的占位文本。对应 EU_SetDatePickerPlaceholder 的宽字符封装，禁止改调底层直调命令 NE日期选择_设置占位提示。 |
| 1859 | `NE日期选择_设置禁用日期` | `NE日期选择_设置禁用日期(控件, 禁用日期)` | bool | 设置 日期选择 DatePicker 的禁用日期。对应 EU_SetDatePickerDisabledDatesUtf8 的宽字符封装，禁止改调底层直调命令 NE日期选择_设置禁用日期JSON。 |
| 1860 | `NE时间下拉_设置占位文本` | `NE时间下拉_设置占位文本(控件, 占位文本)` | bool | 设置 时间下拉 TimeSelect 的占位文本。对应 EU_SetTimeSelectPlaceholder 的宽字符封装，禁止改调底层直调命令 NE时间下拉_设置占位提示。 |
| 1861 | `NE下拉菜单_设置菜单项` | `NE下拉菜单_设置菜单项(控件, 菜单项)` | bool | 设置 下拉菜单 Dropdown 的菜单项。对应 EU_SetDropdownItems 的宽字符封装，禁止改调底层直调命令 NE下拉菜单_设置项。 |
| 1862 | `NE锚点_设置锚点项` | `NE锚点_设置锚点项(控件, 锚点项)` | bool | 设置 锚点 Anchor 的锚点项。对应 EU_SetAnchorItems 的宽字符封装，禁止改调底层直调命令 NE锚点_设置项。 |
| 1863 | `NE分段控制_设置分段项` | `NE分段控制_设置分段项(控件, 分段项)` | bool | 设置 分段控制 Segmented 的分段项。对应 EU_SetSegmentedItems 的宽字符封装，禁止改调底层直调命令 NE分段控制_设置项。 |
| 1864 | `NE页头_设置标题` | `NE页头_设置标题(控件, 标题, 副标题)` | bool | 设置 页头 PageHeader 的标题、副标题。对应 EU_SetPageHeaderText 的宽字符封装，禁止改调底层直调命令 NE页头_设置文本。 |
| 1865 | `NE页头_设置面包屑` | `NE页头_设置面包屑(控件, 面包屑)` | bool | 设置 页头 PageHeader 的面包屑。对应 EU_SetPageHeaderBreadcrumbs 的宽字符封装，禁止改调底层直调命令 NE页头_设置面包屑直调。 |
| 1866 | `NE页头_设置动作项` | `NE页头_设置动作项(控件, 动作项)` | bool | 设置 页头 PageHeader 的动作项。对应 EU_SetPageHeaderActions 的宽字符封装，禁止改调底层直调命令 NE页头_设置动作。 |
| 1867 | `NE页头_设置返回文本` | `NE页头_设置返回文本(控件, 返回文本)` | bool | 设置 页头 PageHeader 的返回文本。对应 EU_SetPageHeaderBackText 的宽字符封装，禁止改调底层直调命令 NE页头_设置返回文本直调。 |
| 1868 | `NE固钉_设置标题` | `NE固钉_设置标题(控件, 标题, 正文)` | bool | 设置 固钉 Affix 的标题、正文。对应 EU_SetAffixText 的宽字符封装，禁止改调底层直调命令 NE固钉_设置文本。 |
| 1869 | `NE水印_设置水印内容` | `NE水印_设置水印内容(控件, 水印内容)` | bool | 设置 水印 Watermark 的水印内容。对应 EU_SetWatermarkContent 的宽字符封装，禁止改调底层直调命令 NE水印_设置内容。 |
| 1870 | `NE漫游引导_设置步骤` | `NE漫游引导_设置步骤(控件, 步骤)` | bool | 设置 漫游引导 Tour 的步骤。对应 EU_SetTourSteps 的宽字符封装，禁止改调底层直调命令 NE漫游引导_设置步骤直调。 |
| 1871 | `NE图片_设置图片路径` | `NE图片_设置图片路径(控件, 图片路径, 下方说明文字)` | bool | 设置 图片 Image 的图片路径、下方说明文字。对应 EU_SetImageSource 的宽字符封装，禁止改调底层直调命令 NE图片_设置来源。 |
| 1872 | `NE图片_设置占位图标` | `NE图片_设置占位图标(控件, 占位图标, 占位文本, 占位文字色, 占位背景色)` | bool | 设置 图片 Image 的占位图标、占位文本、占位文字色、占位背景色。对应 EU_SetImagePlaceholder 的宽字符封装，禁止改调底层直调命令 NE图片_设置占位提示。 |
| 1873 | `NE图片_设置失败图标` | `NE图片_设置失败图标(控件, 失败图标, 失败文本, 失败文字色, 失败背景色)` | bool | 设置 图片 Image 的失败图标、失败文本、失败文字色、失败背景色。对应 EU_SetImageErrorContent 的宽字符封装，禁止改调底层直调命令 NE图片_设置错误内容。 |
| 1874 | `NE图片_设置预览图片列表` | `NE图片_设置预览图片列表(控件, 预览图片列表, 预览索引)` | bool | 设置 图片 Image 的预览图片列表、预览索引。对应 EU_SetImagePreviewList 的宽字符封装，禁止改调底层直调命令 NE图片_设置预览列表。 |
| 1875 | `NE轮播_设置轮播项` | `NE轮播_设置轮播项(控件, 轮播项)` | bool | 设置 轮播 Carousel 的轮播项。对应 EU_SetCarouselItems 的宽字符封装，禁止改调底层直调命令 NE轮播_设置项。 |
| 1876 | `NE上传_设置文件列表` | `NE上传_设置文件列表(控件, 文件列表)` | bool | 设置 上传 Upload 的文件列表。对应 EU_SetUploadFiles 的宽字符封装，禁止改调底层直调命令 NE上传_设置文件。 |
| 1877 | `NE上传_设置文件列表2` | `NE上传_设置文件列表2(控件, 文件列表)` | bool | 设置 上传 Upload 的文件列表。对应 EU_SetUploadFileItems 的宽字符封装，禁止改调底层直调命令 NE上传_设置文件项。 |
| 1878 | `NE上传_设置文件列表3` | `NE上传_设置文件列表3(控件, 文件列表)` | bool | 设置 上传 Upload 的文件列表。对应 EU_SetUploadSelectedFiles 的宽字符封装，禁止改调底层直调命令 NE上传_设置已选文件。 |
| 1879 | `NE无限滚动_设置列表项` | `NE无限滚动_设置列表项(控件, 列表项)` | bool | 设置 无限滚动 InfiniteScroll 的列表项。对应 EU_SetInfiniteScrollItems 的宽字符封装，禁止改调底层直调命令 NE无限滚动_设置项。 |
| 1880 | `NE加载_设置加载文本` | `NE加载_设置加载文本(控件, 加载文本)` | bool | 设置 加载 Loading 的加载文本。对应 EU_SetLoadingText 的宽字符封装，禁止改调底层直调命令 NE加载_设置文本。 |
| 1881 | `NE文字提示_设置提示内容` | `NE文字提示_设置提示内容(控件, 提示内容)` | bool | 设置 文字提示 Tooltip 的提示内容。对应 EU_SetTooltipContent 的宽字符封装，禁止改调底层直调命令 NE文字提示_设置内容。 |
| 1882 | `NE气泡卡片_设置内容` | `NE气泡卡片_设置内容(控件, 内容)` | bool | 设置 气泡卡片 Popover 的内容。对应 EU_SetPopoverContent 的宽字符封装，禁止改调底层直调命令 NE气泡卡片_设置内容直调。 |
| 1883 | `NE气泡卡片_设置标题` | `NE气泡卡片_设置标题(控件, 标题)` | bool | 设置 气泡卡片 Popover 的标题。对应 EU_SetPopoverTitle 的宽字符封装，禁止改调底层直调命令 NE气泡卡片_设置标题直调。 |
| 1884 | `NE气泡确认_设置图标` | `NE气泡确认_设置图标(控件, 图标, 图标颜色, 显示图标)` | bool | 设置 气泡确认 Popconfirm 的图标、图标颜色、显示图标。对应 EU_SetPopconfirmIcon 的宽字符封装，禁止改调底层直调命令 NE气泡确认_设置图标直调。 |
| 1885 | `NE气泡确认_设置标题` | `NE气泡确认_设置标题(控件, 标题, 内容)` | bool | 设置 气泡确认 Popconfirm 的标题、内容。对应 EU_SetPopconfirmContent 的宽字符封装，禁止改调底层直调命令 NE气泡确认_设置内容。 |
| 1886 | `NE气泡确认_设置确认文本` | `NE气泡确认_设置确认文本(控件, 确认文本, 取消文本)` | bool | 设置 气泡确认 Popconfirm 的确认文本、取消文本。对应 EU_SetPopconfirmButtons 的宽字符封装，禁止改调底层直调命令 NE气泡确认_设置按钮。 |
| 1887 | `NE图标按钮_设置徽标` | `NE图标按钮_设置徽标(控件, 徽标, 显示徽标)` | bool | 设置 图标按钮 IconButton 的徽标、显示徽标。对应 EU_SetIconButtonBadge 的宽字符封装，禁止改调底层直调命令 NE图标按钮_设置徽标直调。 |
| 1888 | `NE地址栏_设置安全状态` | `NE地址栏_设置安全状态(控件, 安全状态, 安全文本)` | bool | 设置 地址栏 Omnibox 的安全状态、安全文本。对应 EU_SetOmniboxSecurityState 的宽字符封装，禁止改调底层直调命令 NE地址栏_设置安全状态直调。 |
| 1889 | `NE地址栏_设置前置图标` | `NE地址栏_设置前置图标(控件, 前置图标, 前置文本, 前置背景, 前置文字)` | bool | 设置 地址栏 Omnibox 的前置图标、前置文本、前置背景、前置文字。对应 EU_SetOmniboxPrefixChip 的宽字符封装，禁止改调底层直调命令 NE地址栏_设置前缀徽片。 |
| 1890 | `NE地址栏_设置动作图标` | `NE地址栏_设置动作图标(控件, 动作图标)` | bool | 设置 地址栏 Omnibox 的动作图标。对应 EU_SetOmniboxActionIcons 的宽字符封装，禁止改调底层直调命令 NE地址栏_设置动作图标直调。 |
| 1891 | `NE地址栏_设置建议列表` | `NE地址栏_设置建议列表(控件, 建议列表)` | bool | 设置 地址栏 Omnibox 的建议列表。对应 EU_SetOmniboxSuggestionItems 的宽字符封装，禁止改调底层直调命令 NE地址栏_设置建议项。 |
| 1892 | `NE浏览器视口_设置占位标题` | `NE浏览器视口_设置占位标题(控件, 占位标题, 占位描述, 占位图标)` | bool | 设置 浏览器视口 BrowserViewport 的占位标题、占位描述、占位图标。对应 EU_SetBrowserViewportPlaceholder 的宽字符封装，禁止改调底层直调命令 NE浏览器视口_设置占位提示。 |
| 1893 | `NE浏览器视口_设置截图资源` | `NE浏览器视口_设置截图资源(控件, 截图资源)` | bool | 设置 浏览器视口 BrowserViewport 的截图资源。对应 EU_SetBrowserViewportScreenshot 的宽字符封装，禁止改调底层直调命令 NE浏览器视口_设置截图。 |
| 1894 | `控件_是否有效` | `控件_是否有效(控件)` | bool | 判断 new_emoji 类型化控件引用是否仍指向当前窗口内存活的元素。 |
| 1895 | `控件_创建NE面板` | `控件_创建NE面板(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE面板 | 在当前 new_emoji 窗口运行时创建NE面板，窗口拥有元素生命周期。 |
| 1896 | `通过标记文本获取NE面板` | `通过标记文本获取NE面板(标记文本)` | NE面板 | 按区分大小写的非空文本标记查找NE面板，找不到时返回无效引用。 |
| 1897 | `通过标记整数获取NE面板` | `通过标记整数获取NE面板(标记整数)` | NE面板 | 按有符号 32 位整数标记查找NE面板，找不到时返回无效引用。 |
| 1898 | `NE面板_绑定鼠标进入` | `NE面板_绑定鼠标进入(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 1899 | `NE面板_解绑鼠标进入` | `NE面板_解绑鼠标进入(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标进入”处理器。 |
| 1900 | `NE面板_绑定鼠标离开` | `NE面板_绑定鼠标离开(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 1901 | `NE面板_解绑鼠标离开` | `NE面板_解绑鼠标离开(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标离开”处理器。 |
| 1902 | `NE面板_绑定鼠标按下` | `NE面板_绑定鼠标按下(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 1903 | `NE面板_解绑鼠标按下` | `NE面板_解绑鼠标按下(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标按下”处理器。 |
| 1904 | `NE面板_绑定鼠标抬起` | `NE面板_绑定鼠标抬起(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 1905 | `NE面板_解绑鼠标抬起` | `NE面板_解绑鼠标抬起(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标抬起”处理器。 |
| 1906 | `NE面板_绑定鼠标双击` | `NE面板_绑定鼠标双击(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 1907 | `NE面板_解绑鼠标双击` | `NE面板_解绑鼠标双击(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标双击”处理器。 |
| 1908 | `NE面板_绑定鼠标移动` | `NE面板_绑定鼠标移动(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 1909 | `NE面板_解绑鼠标移动` | `NE面板_解绑鼠标移动(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标移动”处理器。 |
| 1910 | `NE面板_绑定鼠标滚轮` | `NE面板_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE面板实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 1911 | `NE面板_解绑鼠标滚轮` | `NE面板_解绑鼠标滚轮(控件)` | bool | 移除NE面板实例由代码绑定的“鼠标滚轮”处理器。 |
| 1912 | `NE面板_绑定获得焦点` | `NE面板_绑定获得焦点(控件, 处理器)` | bool | 为NE面板实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 1913 | `NE面板_解绑获得焦点` | `NE面板_解绑获得焦点(控件)` | bool | 移除NE面板实例由代码绑定的“获得焦点”处理器。 |
| 1914 | `NE面板_绑定失去焦点` | `NE面板_绑定失去焦点(控件, 处理器)` | bool | 为NE面板实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 1915 | `NE面板_解绑失去焦点` | `NE面板_解绑失去焦点(控件)` | bool | 移除NE面板实例由代码绑定的“失去焦点”处理器。 |
| 1916 | `控件_创建NE文本` | `控件_创建NE文本(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE文本 | 在当前 new_emoji 窗口运行时创建NE文本，窗口拥有元素生命周期。 |
| 1917 | `通过标记文本获取NE文本` | `通过标记文本获取NE文本(标记文本)` | NE文本 | 按区分大小写的非空文本标记查找NE文本，找不到时返回无效引用。 |
| 1918 | `通过标记整数获取NE文本` | `通过标记整数获取NE文本(标记整数)` | NE文本 | 按有符号 32 位整数标记查找NE文本，找不到时返回无效引用。 |
| 1919 | `NE文本_绑定鼠标进入` | `NE文本_绑定鼠标进入(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 1920 | `NE文本_解绑鼠标进入` | `NE文本_解绑鼠标进入(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标进入”处理器。 |
| 1921 | `NE文本_绑定鼠标离开` | `NE文本_绑定鼠标离开(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 1922 | `NE文本_解绑鼠标离开` | `NE文本_解绑鼠标离开(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标离开”处理器。 |
| 1923 | `NE文本_绑定鼠标按下` | `NE文本_绑定鼠标按下(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 1924 | `NE文本_解绑鼠标按下` | `NE文本_解绑鼠标按下(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标按下”处理器。 |
| 1925 | `NE文本_绑定鼠标抬起` | `NE文本_绑定鼠标抬起(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 1926 | `NE文本_解绑鼠标抬起` | `NE文本_解绑鼠标抬起(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标抬起”处理器。 |
| 1927 | `NE文本_绑定鼠标双击` | `NE文本_绑定鼠标双击(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 1928 | `NE文本_解绑鼠标双击` | `NE文本_解绑鼠标双击(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标双击”处理器。 |
| 1929 | `NE文本_绑定鼠标移动` | `NE文本_绑定鼠标移动(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 1930 | `NE文本_解绑鼠标移动` | `NE文本_解绑鼠标移动(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标移动”处理器。 |
| 1931 | `NE文本_绑定鼠标滚轮` | `NE文本_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE文本实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 1932 | `NE文本_解绑鼠标滚轮` | `NE文本_解绑鼠标滚轮(控件)` | bool | 移除NE文本实例由代码绑定的“鼠标滚轮”处理器。 |
| 1933 | `NE文本_绑定获得焦点` | `NE文本_绑定获得焦点(控件, 处理器)` | bool | 为NE文本实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 1934 | `NE文本_解绑获得焦点` | `NE文本_解绑获得焦点(控件)` | bool | 移除NE文本实例由代码绑定的“获得焦点”处理器。 |
| 1935 | `NE文本_绑定失去焦点` | `NE文本_绑定失去焦点(控件, 处理器)` | bool | 为NE文本实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 1936 | `NE文本_解绑失去焦点` | `NE文本_解绑失去焦点(控件)` | bool | 移除NE文本实例由代码绑定的“失去焦点”处理器。 |
| 1937 | `控件_创建NE按钮` | `控件_创建NE按钮(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE按钮 | 在当前 new_emoji 窗口运行时创建NE按钮，窗口拥有元素生命周期。 |
| 1938 | `通过标记文本获取NE按钮` | `通过标记文本获取NE按钮(标记文本)` | NE按钮 | 按区分大小写的非空文本标记查找NE按钮，找不到时返回无效引用。 |
| 1939 | `通过标记整数获取NE按钮` | `通过标记整数获取NE按钮(标记整数)` | NE按钮 | 按有符号 32 位整数标记查找NE按钮，找不到时返回无效引用。 |
| 1940 | `NE按钮_绑定被点击` | `NE按钮_绑定被点击(控件, 处理器)` | bool | 为NE按钮实例绑定“被点击”处理器，处理器必须使用 &名称。 |
| 1941 | `NE按钮_解绑被点击` | `NE按钮_解绑被点击(控件)` | bool | 移除NE按钮实例由代码绑定的“被点击”处理器。 |
| 1942 | `NE按钮_绑定鼠标进入` | `NE按钮_绑定鼠标进入(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 1943 | `NE按钮_解绑鼠标进入` | `NE按钮_解绑鼠标进入(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标进入”处理器。 |
| 1944 | `NE按钮_绑定鼠标离开` | `NE按钮_绑定鼠标离开(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 1945 | `NE按钮_解绑鼠标离开` | `NE按钮_解绑鼠标离开(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标离开”处理器。 |
| 1946 | `NE按钮_绑定鼠标按下` | `NE按钮_绑定鼠标按下(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 1947 | `NE按钮_解绑鼠标按下` | `NE按钮_解绑鼠标按下(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标按下”处理器。 |
| 1948 | `NE按钮_绑定鼠标抬起` | `NE按钮_绑定鼠标抬起(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 1949 | `NE按钮_解绑鼠标抬起` | `NE按钮_解绑鼠标抬起(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标抬起”处理器。 |
| 1950 | `NE按钮_绑定鼠标双击` | `NE按钮_绑定鼠标双击(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 1951 | `NE按钮_解绑鼠标双击` | `NE按钮_解绑鼠标双击(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标双击”处理器。 |
| 1952 | `NE按钮_绑定鼠标移动` | `NE按钮_绑定鼠标移动(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 1953 | `NE按钮_解绑鼠标移动` | `NE按钮_解绑鼠标移动(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标移动”处理器。 |
| 1954 | `NE按钮_绑定鼠标滚轮` | `NE按钮_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE按钮实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 1955 | `NE按钮_解绑鼠标滚轮` | `NE按钮_解绑鼠标滚轮(控件)` | bool | 移除NE按钮实例由代码绑定的“鼠标滚轮”处理器。 |
| 1956 | `NE按钮_绑定获得焦点` | `NE按钮_绑定获得焦点(控件, 处理器)` | bool | 为NE按钮实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 1957 | `NE按钮_解绑获得焦点` | `NE按钮_解绑获得焦点(控件)` | bool | 移除NE按钮实例由代码绑定的“获得焦点”处理器。 |
| 1958 | `NE按钮_绑定失去焦点` | `NE按钮_绑定失去焦点(控件, 处理器)` | bool | 为NE按钮实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 1959 | `NE按钮_解绑失去焦点` | `NE按钮_解绑失去焦点(控件)` | bool | 移除NE按钮实例由代码绑定的“失去焦点”处理器。 |
| 1960 | `控件_创建NE输入框` | `控件_创建NE输入框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE输入框 | 在当前 new_emoji 窗口运行时创建NE输入框，窗口拥有元素生命周期。 |
| 1961 | `通过标记文本获取NE输入框` | `通过标记文本获取NE输入框(标记文本)` | NE输入框 | 按区分大小写的非空文本标记查找NE输入框，找不到时返回无效引用。 |
| 1962 | `通过标记整数获取NE输入框` | `通过标记整数获取NE输入框(标记整数)` | NE输入框 | 按有符号 32 位整数标记查找NE输入框，找不到时返回无效引用。 |
| 1963 | `NE输入框_绑定文本变化` | `NE输入框_绑定文本变化(控件, 处理器)` | bool | 为NE输入框实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 1964 | `NE输入框_解绑文本变化` | `NE输入框_解绑文本变化(控件)` | bool | 移除NE输入框实例由代码绑定的“文本变化”处理器。 |
| 1965 | `NE输入框_绑定鼠标进入` | `NE输入框_绑定鼠标进入(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 1966 | `NE输入框_解绑鼠标进入` | `NE输入框_解绑鼠标进入(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标进入”处理器。 |
| 1967 | `NE输入框_绑定鼠标离开` | `NE输入框_绑定鼠标离开(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 1968 | `NE输入框_解绑鼠标离开` | `NE输入框_解绑鼠标离开(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标离开”处理器。 |
| 1969 | `NE输入框_绑定鼠标按下` | `NE输入框_绑定鼠标按下(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 1970 | `NE输入框_解绑鼠标按下` | `NE输入框_解绑鼠标按下(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标按下”处理器。 |
| 1971 | `NE输入框_绑定鼠标抬起` | `NE输入框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 1972 | `NE输入框_解绑鼠标抬起` | `NE输入框_解绑鼠标抬起(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标抬起”处理器。 |
| 1973 | `NE输入框_绑定鼠标双击` | `NE输入框_绑定鼠标双击(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 1974 | `NE输入框_解绑鼠标双击` | `NE输入框_解绑鼠标双击(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标双击”处理器。 |
| 1975 | `NE输入框_绑定鼠标移动` | `NE输入框_绑定鼠标移动(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 1976 | `NE输入框_解绑鼠标移动` | `NE输入框_解绑鼠标移动(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标移动”处理器。 |
| 1977 | `NE输入框_绑定鼠标滚轮` | `NE输入框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE输入框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 1978 | `NE输入框_解绑鼠标滚轮` | `NE输入框_解绑鼠标滚轮(控件)` | bool | 移除NE输入框实例由代码绑定的“鼠标滚轮”处理器。 |
| 1979 | `NE输入框_绑定获得焦点` | `NE输入框_绑定获得焦点(控件, 处理器)` | bool | 为NE输入框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 1980 | `NE输入框_解绑获得焦点` | `NE输入框_解绑获得焦点(控件)` | bool | 移除NE输入框实例由代码绑定的“获得焦点”处理器。 |
| 1981 | `NE输入框_绑定失去焦点` | `NE输入框_绑定失去焦点(控件, 处理器)` | bool | 为NE输入框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 1982 | `NE输入框_解绑失去焦点` | `NE输入框_解绑失去焦点(控件)` | bool | 移除NE输入框实例由代码绑定的“失去焦点”处理器。 |
| 1983 | `控件_创建NE编辑框` | `控件_创建NE编辑框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE编辑框 | 在当前 new_emoji 窗口运行时创建NE编辑框，窗口拥有元素生命周期。 |
| 1984 | `通过标记文本获取NE编辑框` | `通过标记文本获取NE编辑框(标记文本)` | NE编辑框 | 按区分大小写的非空文本标记查找NE编辑框，找不到时返回无效引用。 |
| 1985 | `通过标记整数获取NE编辑框` | `通过标记整数获取NE编辑框(标记整数)` | NE编辑框 | 按有符号 32 位整数标记查找NE编辑框，找不到时返回无效引用。 |
| 1986 | `NE编辑框_绑定文本变化` | `NE编辑框_绑定文本变化(控件, 处理器)` | bool | 为NE编辑框实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 1987 | `NE编辑框_解绑文本变化` | `NE编辑框_解绑文本变化(控件)` | bool | 移除NE编辑框实例由代码绑定的“文本变化”处理器。 |
| 1988 | `NE编辑框_绑定鼠标进入` | `NE编辑框_绑定鼠标进入(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 1989 | `NE编辑框_解绑鼠标进入` | `NE编辑框_解绑鼠标进入(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标进入”处理器。 |
| 1990 | `NE编辑框_绑定鼠标离开` | `NE编辑框_绑定鼠标离开(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 1991 | `NE编辑框_解绑鼠标离开` | `NE编辑框_解绑鼠标离开(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标离开”处理器。 |
| 1992 | `NE编辑框_绑定鼠标按下` | `NE编辑框_绑定鼠标按下(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 1993 | `NE编辑框_解绑鼠标按下` | `NE编辑框_解绑鼠标按下(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标按下”处理器。 |
| 1994 | `NE编辑框_绑定鼠标抬起` | `NE编辑框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 1995 | `NE编辑框_解绑鼠标抬起` | `NE编辑框_解绑鼠标抬起(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标抬起”处理器。 |
| 1996 | `NE编辑框_绑定鼠标双击` | `NE编辑框_绑定鼠标双击(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 1997 | `NE编辑框_解绑鼠标双击` | `NE编辑框_解绑鼠标双击(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标双击”处理器。 |
| 1998 | `NE编辑框_绑定鼠标移动` | `NE编辑框_绑定鼠标移动(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 1999 | `NE编辑框_解绑鼠标移动` | `NE编辑框_解绑鼠标移动(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标移动”处理器。 |
| 2000 | `NE编辑框_绑定鼠标滚轮` | `NE编辑框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE编辑框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2001 | `NE编辑框_解绑鼠标滚轮` | `NE编辑框_解绑鼠标滚轮(控件)` | bool | 移除NE编辑框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2002 | `NE编辑框_绑定获得焦点` | `NE编辑框_绑定获得焦点(控件, 处理器)` | bool | 为NE编辑框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2003 | `NE编辑框_解绑获得焦点` | `NE编辑框_解绑获得焦点(控件)` | bool | 移除NE编辑框实例由代码绑定的“获得焦点”处理器。 |
| 2004 | `NE编辑框_绑定失去焦点` | `NE编辑框_绑定失去焦点(控件, 处理器)` | bool | 为NE编辑框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2005 | `NE编辑框_解绑失去焦点` | `NE编辑框_解绑失去焦点(控件)` | bool | 移除NE编辑框实例由代码绑定的“失去焦点”处理器。 |
| 2006 | `控件_创建NE表格` | `控件_创建NE表格(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE表格 | 在当前 new_emoji 窗口运行时创建NE表格，窗口拥有元素生命周期。 |
| 2007 | `通过标记文本获取NE表格` | `通过标记文本获取NE表格(标记文本)` | NE表格 | 按区分大小写的非空文本标记查找NE表格，找不到时返回无效引用。 |
| 2008 | `通过标记整数获取NE表格` | `通过标记整数获取NE表格(标记整数)` | NE表格 | 按有符号 32 位整数标记查找NE表格，找不到时返回无效引用。 |
| 2009 | `NE表格_绑定单元格点击` | `NE表格_绑定单元格点击(控件, 处理器)` | bool | 为NE表格实例绑定“单元格点击”处理器，处理器必须使用 &名称。 |
| 2010 | `NE表格_解绑单元格点击` | `NE表格_解绑单元格点击(控件)` | bool | 移除NE表格实例由代码绑定的“单元格点击”处理器。 |
| 2011 | `NE表格_绑定单元格动作` | `NE表格_绑定单元格动作(控件, 处理器)` | bool | 为NE表格实例绑定“单元格动作”处理器，处理器必须使用 &名称。 |
| 2012 | `NE表格_解绑单元格动作` | `NE表格_解绑单元格动作(控件)` | bool | 移除NE表格实例由代码绑定的“单元格动作”处理器。 |
| 2013 | `NE表格_绑定单元格编辑` | `NE表格_绑定单元格编辑(控件, 处理器)` | bool | 为NE表格实例绑定“单元格编辑”处理器，处理器必须使用 &名称。 |
| 2014 | `NE表格_解绑单元格编辑` | `NE表格_解绑单元格编辑(控件)` | bool | 移除NE表格实例由代码绑定的“单元格编辑”处理器。 |
| 2015 | `NE表格_绑定表格右键菜单` | `NE表格_绑定表格右键菜单(控件, 处理器)` | bool | 为NE表格实例绑定“表格右键菜单”处理器，处理器必须使用 &名称。 |
| 2016 | `NE表格_解绑表格右键菜单` | `NE表格_解绑表格右键菜单(控件)` | bool | 移除NE表格实例由代码绑定的“表格右键菜单”处理器。 |
| 2017 | `NE表格_绑定虚拟行数据源` | `NE表格_绑定虚拟行数据源(控件, 处理器)` | bool | 为NE表格实例绑定“虚拟行数据源”处理器，处理器必须使用 &名称。 |
| 2018 | `NE表格_解绑虚拟行数据源` | `NE表格_解绑虚拟行数据源(控件)` | bool | 移除NE表格实例由代码绑定的“虚拟行数据源”处理器。 |
| 2019 | `NE表格_绑定鼠标进入` | `NE表格_绑定鼠标进入(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2020 | `NE表格_解绑鼠标进入` | `NE表格_解绑鼠标进入(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标进入”处理器。 |
| 2021 | `NE表格_绑定鼠标离开` | `NE表格_绑定鼠标离开(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2022 | `NE表格_解绑鼠标离开` | `NE表格_解绑鼠标离开(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标离开”处理器。 |
| 2023 | `NE表格_绑定鼠标按下` | `NE表格_绑定鼠标按下(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2024 | `NE表格_解绑鼠标按下` | `NE表格_解绑鼠标按下(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标按下”处理器。 |
| 2025 | `NE表格_绑定鼠标抬起` | `NE表格_绑定鼠标抬起(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2026 | `NE表格_解绑鼠标抬起` | `NE表格_解绑鼠标抬起(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标抬起”处理器。 |
| 2027 | `NE表格_绑定鼠标双击` | `NE表格_绑定鼠标双击(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2028 | `NE表格_解绑鼠标双击` | `NE表格_解绑鼠标双击(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标双击”处理器。 |
| 2029 | `NE表格_绑定鼠标移动` | `NE表格_绑定鼠标移动(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2030 | `NE表格_解绑鼠标移动` | `NE表格_解绑鼠标移动(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标移动”处理器。 |
| 2031 | `NE表格_绑定鼠标滚轮` | `NE表格_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE表格实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2032 | `NE表格_解绑鼠标滚轮` | `NE表格_解绑鼠标滚轮(控件)` | bool | 移除NE表格实例由代码绑定的“鼠标滚轮”处理器。 |
| 2033 | `NE表格_绑定获得焦点` | `NE表格_绑定获得焦点(控件, 处理器)` | bool | 为NE表格实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2034 | `NE表格_解绑获得焦点` | `NE表格_解绑获得焦点(控件)` | bool | 移除NE表格实例由代码绑定的“获得焦点”处理器。 |
| 2035 | `NE表格_绑定失去焦点` | `NE表格_绑定失去焦点(控件, 处理器)` | bool | 为NE表格实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2036 | `NE表格_解绑失去焦点` | `NE表格_解绑失去焦点(控件)` | bool | 移除NE表格实例由代码绑定的“失去焦点”处理器。 |
| 2037 | `控件_创建NE列表框` | `控件_创建NE列表框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE列表框 | 在当前 new_emoji 窗口运行时创建NE列表框，窗口拥有元素生命周期。 |
| 2038 | `通过标记文本获取NE列表框` | `通过标记文本获取NE列表框(标记文本)` | NE列表框 | 按区分大小写的非空文本标记查找NE列表框，找不到时返回无效引用。 |
| 2039 | `通过标记整数获取NE列表框` | `通过标记整数获取NE列表框(标记整数)` | NE列表框 | 按有符号 32 位整数标记查找NE列表框，找不到时返回无效引用。 |
| 2040 | `NE列表框_绑定选择变化` | `NE列表框_绑定选择变化(控件, 处理器)` | bool | 为NE列表框实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2041 | `NE列表框_解绑选择变化` | `NE列表框_解绑选择变化(控件)` | bool | 移除NE列表框实例由代码绑定的“选择变化”处理器。 |
| 2042 | `NE列表框_绑定项目点击` | `NE列表框_绑定项目点击(控件, 处理器)` | bool | 为NE列表框实例绑定“项目点击”处理器，处理器必须使用 &名称。 |
| 2043 | `NE列表框_解绑项目点击` | `NE列表框_解绑项目点击(控件)` | bool | 移除NE列表框实例由代码绑定的“项目点击”处理器。 |
| 2044 | `NE列表框_绑定项目双击` | `NE列表框_绑定项目双击(控件, 处理器)` | bool | 为NE列表框实例绑定“项目双击”处理器，处理器必须使用 &名称。 |
| 2045 | `NE列表框_解绑项目双击` | `NE列表框_解绑项目双击(控件)` | bool | 移除NE列表框实例由代码绑定的“项目双击”处理器。 |
| 2046 | `NE列表框_绑定项目编辑` | `NE列表框_绑定项目编辑(控件, 处理器)` | bool | 为NE列表框实例绑定“项目编辑”处理器，处理器必须使用 &名称。 |
| 2047 | `NE列表框_解绑项目编辑` | `NE列表框_解绑项目编辑(控件)` | bool | 移除NE列表框实例由代码绑定的“项目编辑”处理器。 |
| 2048 | `NE列表框_绑定项目重排` | `NE列表框_绑定项目重排(控件, 处理器)` | bool | 为NE列表框实例绑定“项目重排”处理器，处理器必须使用 &名称。 |
| 2049 | `NE列表框_解绑项目重排` | `NE列表框_解绑项目重排(控件)` | bool | 移除NE列表框实例由代码绑定的“项目重排”处理器。 |
| 2050 | `NE列表框_绑定项目右键菜单` | `NE列表框_绑定项目右键菜单(控件, 处理器)` | bool | 为NE列表框实例绑定“项目右键菜单”处理器，处理器必须使用 &名称。 |
| 2051 | `NE列表框_解绑项目右键菜单` | `NE列表框_解绑项目右键菜单(控件)` | bool | 移除NE列表框实例由代码绑定的“项目右键菜单”处理器。 |
| 2052 | `NE列表框_绑定鼠标进入` | `NE列表框_绑定鼠标进入(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2053 | `NE列表框_解绑鼠标进入` | `NE列表框_解绑鼠标进入(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标进入”处理器。 |
| 2054 | `NE列表框_绑定鼠标离开` | `NE列表框_绑定鼠标离开(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2055 | `NE列表框_解绑鼠标离开` | `NE列表框_解绑鼠标离开(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标离开”处理器。 |
| 2056 | `NE列表框_绑定鼠标按下` | `NE列表框_绑定鼠标按下(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2057 | `NE列表框_解绑鼠标按下` | `NE列表框_解绑鼠标按下(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标按下”处理器。 |
| 2058 | `NE列表框_绑定鼠标抬起` | `NE列表框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2059 | `NE列表框_解绑鼠标抬起` | `NE列表框_解绑鼠标抬起(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标抬起”处理器。 |
| 2060 | `NE列表框_绑定鼠标双击` | `NE列表框_绑定鼠标双击(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2061 | `NE列表框_解绑鼠标双击` | `NE列表框_解绑鼠标双击(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标双击”处理器。 |
| 2062 | `NE列表框_绑定鼠标移动` | `NE列表框_绑定鼠标移动(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2063 | `NE列表框_解绑鼠标移动` | `NE列表框_解绑鼠标移动(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标移动”处理器。 |
| 2064 | `NE列表框_绑定鼠标滚轮` | `NE列表框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE列表框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2065 | `NE列表框_解绑鼠标滚轮` | `NE列表框_解绑鼠标滚轮(控件)` | bool | 移除NE列表框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2066 | `NE列表框_绑定获得焦点` | `NE列表框_绑定获得焦点(控件, 处理器)` | bool | 为NE列表框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2067 | `NE列表框_解绑获得焦点` | `NE列表框_解绑获得焦点(控件)` | bool | 移除NE列表框实例由代码绑定的“获得焦点”处理器。 |
| 2068 | `NE列表框_绑定失去焦点` | `NE列表框_绑定失去焦点(控件, 处理器)` | bool | 为NE列表框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2069 | `NE列表框_解绑失去焦点` | `NE列表框_解绑失去焦点(控件)` | bool | 移除NE列表框实例由代码绑定的“失去焦点”处理器。 |
| 2070 | `控件_创建NE富列表` | `控件_创建NE富列表(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE富列表 | 在当前 new_emoji 窗口运行时创建NE富列表，窗口拥有元素生命周期。 |
| 2071 | `通过标记文本获取NE富列表` | `通过标记文本获取NE富列表(标记文本)` | NE富列表 | 按区分大小写的非空文本标记查找NE富列表，找不到时返回无效引用。 |
| 2072 | `通过标记整数获取NE富列表` | `通过标记整数获取NE富列表(标记整数)` | NE富列表 | 按有符号 32 位整数标记查找NE富列表，找不到时返回无效引用。 |
| 2073 | `NE富列表_绑定选择变化` | `NE富列表_绑定选择变化(控件, 处理器)` | bool | 为NE富列表实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2074 | `NE富列表_解绑选择变化` | `NE富列表_解绑选择变化(控件)` | bool | 移除NE富列表实例由代码绑定的“选择变化”处理器。 |
| 2075 | `NE富列表_绑定项目点击` | `NE富列表_绑定项目点击(控件, 处理器)` | bool | 为NE富列表实例绑定“项目点击”处理器，处理器必须使用 &名称。 |
| 2076 | `NE富列表_解绑项目点击` | `NE富列表_解绑项目点击(控件)` | bool | 移除NE富列表实例由代码绑定的“项目点击”处理器。 |
| 2077 | `NE富列表_绑定项目双击` | `NE富列表_绑定项目双击(控件, 处理器)` | bool | 为NE富列表实例绑定“项目双击”处理器，处理器必须使用 &名称。 |
| 2078 | `NE富列表_解绑项目双击` | `NE富列表_解绑项目双击(控件)` | bool | 移除NE富列表实例由代码绑定的“项目双击”处理器。 |
| 2079 | `NE富列表_绑定按钮点击` | `NE富列表_绑定按钮点击(控件, 处理器)` | bool | 为NE富列表实例绑定“按钮点击”处理器，处理器必须使用 &名称。 |
| 2080 | `NE富列表_解绑按钮点击` | `NE富列表_解绑按钮点击(控件)` | bool | 移除NE富列表实例由代码绑定的“按钮点击”处理器。 |
| 2081 | `NE富列表_绑定徽标点击` | `NE富列表_绑定徽标点击(控件, 处理器)` | bool | 为NE富列表实例绑定“徽标点击”处理器，处理器必须使用 &名称。 |
| 2082 | `NE富列表_解绑徽标点击` | `NE富列表_解绑徽标点击(控件)` | bool | 移除NE富列表实例由代码绑定的“徽标点击”处理器。 |
| 2083 | `NE富列表_绑定倒计时结束` | `NE富列表_绑定倒计时结束(控件, 处理器)` | bool | 为NE富列表实例绑定“倒计时结束”处理器，处理器必须使用 &名称。 |
| 2084 | `NE富列表_解绑倒计时结束` | `NE富列表_解绑倒计时结束(控件)` | bool | 移除NE富列表实例由代码绑定的“倒计时结束”处理器。 |
| 2085 | `NE富列表_绑定项目右键菜单` | `NE富列表_绑定项目右键菜单(控件, 处理器)` | bool | 为NE富列表实例绑定“项目右键菜单”处理器，处理器必须使用 &名称。 |
| 2086 | `NE富列表_解绑项目右键菜单` | `NE富列表_解绑项目右键菜单(控件)` | bool | 移除NE富列表实例由代码绑定的“项目右键菜单”处理器。 |
| 2087 | `NE富列表_绑定鼠标进入` | `NE富列表_绑定鼠标进入(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2088 | `NE富列表_解绑鼠标进入` | `NE富列表_解绑鼠标进入(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标进入”处理器。 |
| 2089 | `NE富列表_绑定鼠标离开` | `NE富列表_绑定鼠标离开(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2090 | `NE富列表_解绑鼠标离开` | `NE富列表_解绑鼠标离开(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标离开”处理器。 |
| 2091 | `NE富列表_绑定鼠标按下` | `NE富列表_绑定鼠标按下(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2092 | `NE富列表_解绑鼠标按下` | `NE富列表_解绑鼠标按下(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标按下”处理器。 |
| 2093 | `NE富列表_绑定鼠标抬起` | `NE富列表_绑定鼠标抬起(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2094 | `NE富列表_解绑鼠标抬起` | `NE富列表_解绑鼠标抬起(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标抬起”处理器。 |
| 2095 | `NE富列表_绑定鼠标双击` | `NE富列表_绑定鼠标双击(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2096 | `NE富列表_解绑鼠标双击` | `NE富列表_解绑鼠标双击(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标双击”处理器。 |
| 2097 | `NE富列表_绑定鼠标移动` | `NE富列表_绑定鼠标移动(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2098 | `NE富列表_解绑鼠标移动` | `NE富列表_解绑鼠标移动(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标移动”处理器。 |
| 2099 | `NE富列表_绑定鼠标滚轮` | `NE富列表_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE富列表实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2100 | `NE富列表_解绑鼠标滚轮` | `NE富列表_解绑鼠标滚轮(控件)` | bool | 移除NE富列表实例由代码绑定的“鼠标滚轮”处理器。 |
| 2101 | `NE富列表_绑定获得焦点` | `NE富列表_绑定获得焦点(控件, 处理器)` | bool | 为NE富列表实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2102 | `NE富列表_解绑获得焦点` | `NE富列表_解绑获得焦点(控件)` | bool | 移除NE富列表实例由代码绑定的“获得焦点”处理器。 |
| 2103 | `NE富列表_绑定失去焦点` | `NE富列表_绑定失去焦点(控件, 处理器)` | bool | 为NE富列表实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2104 | `NE富列表_解绑失去焦点` | `NE富列表_解绑失去焦点(控件)` | bool | 移除NE富列表实例由代码绑定的“失去焦点”处理器。 |
| 2105 | `NE富列表_绑定虚拟数据源` | `NE富列表_绑定虚拟数据源(控件, 处理器)` | bool | 为NE富列表实例绑定“虚拟数据源”处理器，处理器必须使用 &名称。 |
| 2106 | `NE富列表_解绑虚拟数据源` | `NE富列表_解绑虚拟数据源(控件)` | bool | 移除NE富列表实例由代码绑定的“虚拟数据源”处理器。 |
| 2107 | `控件_创建NE卡片` | `控件_创建NE卡片(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE卡片 | 在当前 new_emoji 窗口运行时创建NE卡片，窗口拥有元素生命周期。 |
| 2108 | `通过标记文本获取NE卡片` | `通过标记文本获取NE卡片(标记文本)` | NE卡片 | 按区分大小写的非空文本标记查找NE卡片，找不到时返回无效引用。 |
| 2109 | `通过标记整数获取NE卡片` | `通过标记整数获取NE卡片(标记整数)` | NE卡片 | 按有符号 32 位整数标记查找NE卡片，找不到时返回无效引用。 |
| 2110 | `NE卡片_绑定被点击` | `NE卡片_绑定被点击(控件, 处理器)` | bool | 为NE卡片实例绑定“被点击”处理器，处理器必须使用 &名称。 |
| 2111 | `NE卡片_解绑被点击` | `NE卡片_解绑被点击(控件)` | bool | 移除NE卡片实例由代码绑定的“被点击”处理器。 |
| 2112 | `NE卡片_绑定鼠标进入` | `NE卡片_绑定鼠标进入(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2113 | `NE卡片_解绑鼠标进入` | `NE卡片_解绑鼠标进入(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标进入”处理器。 |
| 2114 | `NE卡片_绑定鼠标离开` | `NE卡片_绑定鼠标离开(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2115 | `NE卡片_解绑鼠标离开` | `NE卡片_解绑鼠标离开(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标离开”处理器。 |
| 2116 | `NE卡片_绑定鼠标按下` | `NE卡片_绑定鼠标按下(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2117 | `NE卡片_解绑鼠标按下` | `NE卡片_解绑鼠标按下(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标按下”处理器。 |
| 2118 | `NE卡片_绑定鼠标抬起` | `NE卡片_绑定鼠标抬起(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2119 | `NE卡片_解绑鼠标抬起` | `NE卡片_解绑鼠标抬起(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标抬起”处理器。 |
| 2120 | `NE卡片_绑定鼠标双击` | `NE卡片_绑定鼠标双击(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2121 | `NE卡片_解绑鼠标双击` | `NE卡片_解绑鼠标双击(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标双击”处理器。 |
| 2122 | `NE卡片_绑定鼠标移动` | `NE卡片_绑定鼠标移动(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2123 | `NE卡片_解绑鼠标移动` | `NE卡片_解绑鼠标移动(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标移动”处理器。 |
| 2124 | `NE卡片_绑定鼠标滚轮` | `NE卡片_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE卡片实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2125 | `NE卡片_解绑鼠标滚轮` | `NE卡片_解绑鼠标滚轮(控件)` | bool | 移除NE卡片实例由代码绑定的“鼠标滚轮”处理器。 |
| 2126 | `NE卡片_绑定获得焦点` | `NE卡片_绑定获得焦点(控件, 处理器)` | bool | 为NE卡片实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2127 | `NE卡片_解绑获得焦点` | `NE卡片_解绑获得焦点(控件)` | bool | 移除NE卡片实例由代码绑定的“获得焦点”处理器。 |
| 2128 | `NE卡片_绑定失去焦点` | `NE卡片_绑定失去焦点(控件, 处理器)` | bool | 为NE卡片实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2129 | `NE卡片_解绑失去焦点` | `NE卡片_解绑失去焦点(控件)` | bool | 移除NE卡片实例由代码绑定的“失去焦点”处理器。 |
| 2130 | `控件_创建NE菜单` | `控件_创建NE菜单(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE菜单 | 在当前 new_emoji 窗口运行时创建NE菜单，窗口拥有元素生命周期。 |
| 2131 | `通过标记文本获取NE菜单` | `通过标记文本获取NE菜单(标记文本)` | NE菜单 | 按区分大小写的非空文本标记查找NE菜单，找不到时返回无效引用。 |
| 2132 | `通过标记整数获取NE菜单` | `通过标记整数获取NE菜单(标记整数)` | NE菜单 | 按有符号 32 位整数标记查找NE菜单，找不到时返回无效引用。 |
| 2133 | `NE菜单_绑定菜单命令` | `NE菜单_绑定菜单命令(控件, 处理器)` | bool | 为NE菜单实例绑定“菜单命令”处理器，处理器必须使用 &名称。 |
| 2134 | `NE菜单_解绑菜单命令` | `NE菜单_解绑菜单命令(控件)` | bool | 移除NE菜单实例由代码绑定的“菜单命令”处理器。 |
| 2135 | `NE菜单_绑定鼠标进入` | `NE菜单_绑定鼠标进入(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2136 | `NE菜单_解绑鼠标进入` | `NE菜单_解绑鼠标进入(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标进入”处理器。 |
| 2137 | `NE菜单_绑定鼠标离开` | `NE菜单_绑定鼠标离开(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2138 | `NE菜单_解绑鼠标离开` | `NE菜单_解绑鼠标离开(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标离开”处理器。 |
| 2139 | `NE菜单_绑定鼠标按下` | `NE菜单_绑定鼠标按下(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2140 | `NE菜单_解绑鼠标按下` | `NE菜单_解绑鼠标按下(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标按下”处理器。 |
| 2141 | `NE菜单_绑定鼠标抬起` | `NE菜单_绑定鼠标抬起(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2142 | `NE菜单_解绑鼠标抬起` | `NE菜单_解绑鼠标抬起(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标抬起”处理器。 |
| 2143 | `NE菜单_绑定鼠标双击` | `NE菜单_绑定鼠标双击(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2144 | `NE菜单_解绑鼠标双击` | `NE菜单_解绑鼠标双击(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标双击”处理器。 |
| 2145 | `NE菜单_绑定鼠标移动` | `NE菜单_绑定鼠标移动(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2146 | `NE菜单_解绑鼠标移动` | `NE菜单_解绑鼠标移动(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标移动”处理器。 |
| 2147 | `NE菜单_绑定鼠标滚轮` | `NE菜单_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE菜单实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2148 | `NE菜单_解绑鼠标滚轮` | `NE菜单_解绑鼠标滚轮(控件)` | bool | 移除NE菜单实例由代码绑定的“鼠标滚轮”处理器。 |
| 2149 | `NE菜单_绑定获得焦点` | `NE菜单_绑定获得焦点(控件, 处理器)` | bool | 为NE菜单实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2150 | `NE菜单_解绑获得焦点` | `NE菜单_解绑获得焦点(控件)` | bool | 移除NE菜单实例由代码绑定的“获得焦点”处理器。 |
| 2151 | `NE菜单_绑定失去焦点` | `NE菜单_绑定失去焦点(控件, 处理器)` | bool | 为NE菜单实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2152 | `NE菜单_解绑失去焦点` | `NE菜单_解绑失去焦点(控件)` | bool | 移除NE菜单实例由代码绑定的“失去焦点”处理器。 |
| 2153 | `NE菜单_绑定右键菜单` | `NE菜单_绑定右键菜单(控件, 处理器)` | bool | 为NE菜单实例绑定“右键菜单”处理器，处理器必须使用 &名称。 |
| 2154 | `NE菜单_解绑右键菜单` | `NE菜单_解绑右键菜单(控件)` | bool | 移除NE菜单实例由代码绑定的“右键菜单”处理器。 |
| 2155 | `控件_创建NE标签页` | `控件_创建NE标签页(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE标签页 | 在当前 new_emoji 窗口运行时创建NE标签页，窗口拥有元素生命周期。 |
| 2156 | `通过标记文本获取NE标签页` | `通过标记文本获取NE标签页(标记文本)` | NE标签页 | 按区分大小写的非空文本标记查找NE标签页，找不到时返回无效引用。 |
| 2157 | `通过标记整数获取NE标签页` | `通过标记整数获取NE标签页(标记整数)` | NE标签页 | 按有符号 32 位整数标记查找NE标签页，找不到时返回无效引用。 |
| 2158 | `NE标签页_绑定选择变化` | `NE标签页_绑定选择变化(控件, 处理器)` | bool | 为NE标签页实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2159 | `NE标签页_解绑选择变化` | `NE标签页_解绑选择变化(控件)` | bool | 移除NE标签页实例由代码绑定的“选择变化”处理器。 |
| 2160 | `NE标签页_绑定鼠标进入` | `NE标签页_绑定鼠标进入(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2161 | `NE标签页_解绑鼠标进入` | `NE标签页_解绑鼠标进入(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标进入”处理器。 |
| 2162 | `NE标签页_绑定鼠标离开` | `NE标签页_绑定鼠标离开(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2163 | `NE标签页_解绑鼠标离开` | `NE标签页_解绑鼠标离开(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标离开”处理器。 |
| 2164 | `NE标签页_绑定鼠标按下` | `NE标签页_绑定鼠标按下(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2165 | `NE标签页_解绑鼠标按下` | `NE标签页_解绑鼠标按下(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标按下”处理器。 |
| 2166 | `NE标签页_绑定鼠标抬起` | `NE标签页_绑定鼠标抬起(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2167 | `NE标签页_解绑鼠标抬起` | `NE标签页_解绑鼠标抬起(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标抬起”处理器。 |
| 2168 | `NE标签页_绑定鼠标双击` | `NE标签页_绑定鼠标双击(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2169 | `NE标签页_解绑鼠标双击` | `NE标签页_解绑鼠标双击(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标双击”处理器。 |
| 2170 | `NE标签页_绑定鼠标移动` | `NE标签页_绑定鼠标移动(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2171 | `NE标签页_解绑鼠标移动` | `NE标签页_解绑鼠标移动(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标移动”处理器。 |
| 2172 | `NE标签页_绑定鼠标滚轮` | `NE标签页_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE标签页实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2173 | `NE标签页_解绑鼠标滚轮` | `NE标签页_解绑鼠标滚轮(控件)` | bool | 移除NE标签页实例由代码绑定的“鼠标滚轮”处理器。 |
| 2174 | `NE标签页_绑定获得焦点` | `NE标签页_绑定获得焦点(控件, 处理器)` | bool | 为NE标签页实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2175 | `NE标签页_解绑获得焦点` | `NE标签页_解绑获得焦点(控件)` | bool | 移除NE标签页实例由代码绑定的“获得焦点”处理器。 |
| 2176 | `NE标签页_绑定失去焦点` | `NE标签页_绑定失去焦点(控件, 处理器)` | bool | 为NE标签页实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2177 | `NE标签页_解绑失去焦点` | `NE标签页_解绑失去焦点(控件)` | bool | 移除NE标签页实例由代码绑定的“失去焦点”处理器。 |
| 2178 | `NE标签页_绑定关闭标签页` | `NE标签页_绑定关闭标签页(控件, 处理器)` | bool | 为NE标签页实例绑定“关闭标签页”处理器，处理器必须使用 &名称。 |
| 2179 | `NE标签页_解绑关闭标签页` | `NE标签页_解绑关闭标签页(控件)` | bool | 移除NE标签页实例由代码绑定的“关闭标签页”处理器。 |
| 2180 | `NE标签页_绑定新增标签页` | `NE标签页_绑定新增标签页(控件, 处理器)` | bool | 为NE标签页实例绑定“新增标签页”处理器，处理器必须使用 &名称。 |
| 2181 | `NE标签页_解绑新增标签页` | `NE标签页_解绑新增标签页(控件)` | bool | 移除NE标签页实例由代码绑定的“新增标签页”处理器。 |
| 2182 | `NE标签页_绑定拖拽重排` | `NE标签页_绑定拖拽重排(控件, 处理器)` | bool | 为NE标签页实例绑定“拖拽重排”处理器，处理器必须使用 &名称。 |
| 2183 | `NE标签页_解绑拖拽重排` | `NE标签页_解绑拖拽重排(控件)` | bool | 移除NE标签页实例由代码绑定的“拖拽重排”处理器。 |
| 2184 | `控件_创建NE弹窗` | `控件_创建NE弹窗(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE弹窗 | 在当前 new_emoji 窗口运行时创建NE弹窗，窗口拥有元素生命周期。 |
| 2185 | `通过标记文本获取NE弹窗` | `通过标记文本获取NE弹窗(标记文本)` | NE弹窗 | 按区分大小写的非空文本标记查找NE弹窗，找不到时返回无效引用。 |
| 2186 | `通过标记整数获取NE弹窗` | `通过标记整数获取NE弹窗(标记整数)` | NE弹窗 | 按有符号 32 位整数标记查找NE弹窗，找不到时返回无效引用。 |
| 2187 | `NE弹窗_绑定关闭` | `NE弹窗_绑定关闭(控件, 处理器)` | bool | 为NE弹窗实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2188 | `NE弹窗_解绑关闭` | `NE弹窗_解绑关闭(控件)` | bool | 移除NE弹窗实例由代码绑定的“关闭”处理器。 |
| 2189 | `NE弹窗_绑定鼠标进入` | `NE弹窗_绑定鼠标进入(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2190 | `NE弹窗_解绑鼠标进入` | `NE弹窗_解绑鼠标进入(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标进入”处理器。 |
| 2191 | `NE弹窗_绑定鼠标离开` | `NE弹窗_绑定鼠标离开(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2192 | `NE弹窗_解绑鼠标离开` | `NE弹窗_解绑鼠标离开(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标离开”处理器。 |
| 2193 | `NE弹窗_绑定鼠标按下` | `NE弹窗_绑定鼠标按下(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2194 | `NE弹窗_解绑鼠标按下` | `NE弹窗_解绑鼠标按下(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标按下”处理器。 |
| 2195 | `NE弹窗_绑定鼠标抬起` | `NE弹窗_绑定鼠标抬起(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2196 | `NE弹窗_解绑鼠标抬起` | `NE弹窗_解绑鼠标抬起(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标抬起”处理器。 |
| 2197 | `NE弹窗_绑定鼠标双击` | `NE弹窗_绑定鼠标双击(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2198 | `NE弹窗_解绑鼠标双击` | `NE弹窗_解绑鼠标双击(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标双击”处理器。 |
| 2199 | `NE弹窗_绑定鼠标移动` | `NE弹窗_绑定鼠标移动(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2200 | `NE弹窗_解绑鼠标移动` | `NE弹窗_解绑鼠标移动(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标移动”处理器。 |
| 2201 | `NE弹窗_绑定鼠标滚轮` | `NE弹窗_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE弹窗实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2202 | `NE弹窗_解绑鼠标滚轮` | `NE弹窗_解绑鼠标滚轮(控件)` | bool | 移除NE弹窗实例由代码绑定的“鼠标滚轮”处理器。 |
| 2203 | `NE弹窗_绑定获得焦点` | `NE弹窗_绑定获得焦点(控件, 处理器)` | bool | 为NE弹窗实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2204 | `NE弹窗_解绑获得焦点` | `NE弹窗_解绑获得焦点(控件)` | bool | 移除NE弹窗实例由代码绑定的“获得焦点”处理器。 |
| 2205 | `NE弹窗_绑定失去焦点` | `NE弹窗_绑定失去焦点(控件, 处理器)` | bool | 为NE弹窗实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2206 | `NE弹窗_解绑失去焦点` | `NE弹窗_解绑失去焦点(控件)` | bool | 移除NE弹窗实例由代码绑定的“失去焦点”处理器。 |
| 2207 | `控件_创建NE抽屉` | `控件_创建NE抽屉(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE抽屉 | 在当前 new_emoji 窗口运行时创建NE抽屉，窗口拥有元素生命周期。 |
| 2208 | `通过标记文本获取NE抽屉` | `通过标记文本获取NE抽屉(标记文本)` | NE抽屉 | 按区分大小写的非空文本标记查找NE抽屉，找不到时返回无效引用。 |
| 2209 | `通过标记整数获取NE抽屉` | `通过标记整数获取NE抽屉(标记整数)` | NE抽屉 | 按有符号 32 位整数标记查找NE抽屉，找不到时返回无效引用。 |
| 2210 | `NE抽屉_绑定关闭` | `NE抽屉_绑定关闭(控件, 处理器)` | bool | 为NE抽屉实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2211 | `NE抽屉_解绑关闭` | `NE抽屉_解绑关闭(控件)` | bool | 移除NE抽屉实例由代码绑定的“关闭”处理器。 |
| 2212 | `NE抽屉_绑定鼠标进入` | `NE抽屉_绑定鼠标进入(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2213 | `NE抽屉_解绑鼠标进入` | `NE抽屉_解绑鼠标进入(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标进入”处理器。 |
| 2214 | `NE抽屉_绑定鼠标离开` | `NE抽屉_绑定鼠标离开(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2215 | `NE抽屉_解绑鼠标离开` | `NE抽屉_解绑鼠标离开(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标离开”处理器。 |
| 2216 | `NE抽屉_绑定鼠标按下` | `NE抽屉_绑定鼠标按下(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2217 | `NE抽屉_解绑鼠标按下` | `NE抽屉_解绑鼠标按下(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标按下”处理器。 |
| 2218 | `NE抽屉_绑定鼠标抬起` | `NE抽屉_绑定鼠标抬起(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2219 | `NE抽屉_解绑鼠标抬起` | `NE抽屉_解绑鼠标抬起(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标抬起”处理器。 |
| 2220 | `NE抽屉_绑定鼠标双击` | `NE抽屉_绑定鼠标双击(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2221 | `NE抽屉_解绑鼠标双击` | `NE抽屉_解绑鼠标双击(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标双击”处理器。 |
| 2222 | `NE抽屉_绑定鼠标移动` | `NE抽屉_绑定鼠标移动(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2223 | `NE抽屉_解绑鼠标移动` | `NE抽屉_解绑鼠标移动(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标移动”处理器。 |
| 2224 | `NE抽屉_绑定鼠标滚轮` | `NE抽屉_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE抽屉实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2225 | `NE抽屉_解绑鼠标滚轮` | `NE抽屉_解绑鼠标滚轮(控件)` | bool | 移除NE抽屉实例由代码绑定的“鼠标滚轮”处理器。 |
| 2226 | `NE抽屉_绑定获得焦点` | `NE抽屉_绑定获得焦点(控件, 处理器)` | bool | 为NE抽屉实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2227 | `NE抽屉_解绑获得焦点` | `NE抽屉_解绑获得焦点(控件)` | bool | 移除NE抽屉实例由代码绑定的“获得焦点”处理器。 |
| 2228 | `NE抽屉_绑定失去焦点` | `NE抽屉_绑定失去焦点(控件, 处理器)` | bool | 为NE抽屉实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2229 | `NE抽屉_解绑失去焦点` | `NE抽屉_解绑失去焦点(控件)` | bool | 移除NE抽屉实例由代码绑定的“失去焦点”处理器。 |
| 2230 | `控件_创建NE通知` | `控件_创建NE通知(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE通知 | 在当前 new_emoji 窗口运行时创建NE通知，窗口拥有元素生命周期。 |
| 2231 | `通过标记文本获取NE通知` | `通过标记文本获取NE通知(标记文本)` | NE通知 | 按区分大小写的非空文本标记查找NE通知，找不到时返回无效引用。 |
| 2232 | `通过标记整数获取NE通知` | `通过标记整数获取NE通知(标记整数)` | NE通知 | 按有符号 32 位整数标记查找NE通知，找不到时返回无效引用。 |
| 2233 | `NE通知_绑定关闭` | `NE通知_绑定关闭(控件, 处理器)` | bool | 为NE通知实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2234 | `NE通知_解绑关闭` | `NE通知_解绑关闭(控件)` | bool | 移除NE通知实例由代码绑定的“关闭”处理器。 |
| 2235 | `NE通知_绑定鼠标进入` | `NE通知_绑定鼠标进入(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2236 | `NE通知_解绑鼠标进入` | `NE通知_解绑鼠标进入(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标进入”处理器。 |
| 2237 | `NE通知_绑定鼠标离开` | `NE通知_绑定鼠标离开(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2238 | `NE通知_解绑鼠标离开` | `NE通知_解绑鼠标离开(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标离开”处理器。 |
| 2239 | `NE通知_绑定鼠标按下` | `NE通知_绑定鼠标按下(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2240 | `NE通知_解绑鼠标按下` | `NE通知_解绑鼠标按下(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标按下”处理器。 |
| 2241 | `NE通知_绑定鼠标抬起` | `NE通知_绑定鼠标抬起(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2242 | `NE通知_解绑鼠标抬起` | `NE通知_解绑鼠标抬起(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标抬起”处理器。 |
| 2243 | `NE通知_绑定鼠标双击` | `NE通知_绑定鼠标双击(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2244 | `NE通知_解绑鼠标双击` | `NE通知_解绑鼠标双击(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标双击”处理器。 |
| 2245 | `NE通知_绑定鼠标移动` | `NE通知_绑定鼠标移动(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2246 | `NE通知_解绑鼠标移动` | `NE通知_解绑鼠标移动(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标移动”处理器。 |
| 2247 | `NE通知_绑定鼠标滚轮` | `NE通知_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE通知实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2248 | `NE通知_解绑鼠标滚轮` | `NE通知_解绑鼠标滚轮(控件)` | bool | 移除NE通知实例由代码绑定的“鼠标滚轮”处理器。 |
| 2249 | `NE通知_绑定获得焦点` | `NE通知_绑定获得焦点(控件, 处理器)` | bool | 为NE通知实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2250 | `NE通知_解绑获得焦点` | `NE通知_解绑获得焦点(控件)` | bool | 移除NE通知实例由代码绑定的“获得焦点”处理器。 |
| 2251 | `NE通知_绑定失去焦点` | `NE通知_绑定失去焦点(控件, 处理器)` | bool | 为NE通知实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2252 | `NE通知_解绑失去焦点` | `NE通知_解绑失去焦点(控件)` | bool | 移除NE通知实例由代码绑定的“失去焦点”处理器。 |
| 2253 | `控件_创建NE消息提示` | `控件_创建NE消息提示(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE消息提示 | 在当前 new_emoji 窗口运行时创建NE消息提示，窗口拥有元素生命周期。 |
| 2254 | `通过标记文本获取NE消息提示` | `通过标记文本获取NE消息提示(标记文本)` | NE消息提示 | 按区分大小写的非空文本标记查找NE消息提示，找不到时返回无效引用。 |
| 2255 | `通过标记整数获取NE消息提示` | `通过标记整数获取NE消息提示(标记整数)` | NE消息提示 | 按有符号 32 位整数标记查找NE消息提示，找不到时返回无效引用。 |
| 2256 | `NE消息提示_绑定关闭` | `NE消息提示_绑定关闭(控件, 处理器)` | bool | 为NE消息提示实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2257 | `NE消息提示_解绑关闭` | `NE消息提示_解绑关闭(控件)` | bool | 移除NE消息提示实例由代码绑定的“关闭”处理器。 |
| 2258 | `NE消息提示_绑定鼠标进入` | `NE消息提示_绑定鼠标进入(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2259 | `NE消息提示_解绑鼠标进入` | `NE消息提示_解绑鼠标进入(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标进入”处理器。 |
| 2260 | `NE消息提示_绑定鼠标离开` | `NE消息提示_绑定鼠标离开(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2261 | `NE消息提示_解绑鼠标离开` | `NE消息提示_解绑鼠标离开(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标离开”处理器。 |
| 2262 | `NE消息提示_绑定鼠标按下` | `NE消息提示_绑定鼠标按下(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2263 | `NE消息提示_解绑鼠标按下` | `NE消息提示_解绑鼠标按下(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标按下”处理器。 |
| 2264 | `NE消息提示_绑定鼠标抬起` | `NE消息提示_绑定鼠标抬起(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2265 | `NE消息提示_解绑鼠标抬起` | `NE消息提示_解绑鼠标抬起(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标抬起”处理器。 |
| 2266 | `NE消息提示_绑定鼠标双击` | `NE消息提示_绑定鼠标双击(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2267 | `NE消息提示_解绑鼠标双击` | `NE消息提示_解绑鼠标双击(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标双击”处理器。 |
| 2268 | `NE消息提示_绑定鼠标移动` | `NE消息提示_绑定鼠标移动(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2269 | `NE消息提示_解绑鼠标移动` | `NE消息提示_解绑鼠标移动(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标移动”处理器。 |
| 2270 | `NE消息提示_绑定鼠标滚轮` | `NE消息提示_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE消息提示实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2271 | `NE消息提示_解绑鼠标滚轮` | `NE消息提示_解绑鼠标滚轮(控件)` | bool | 移除NE消息提示实例由代码绑定的“鼠标滚轮”处理器。 |
| 2272 | `NE消息提示_绑定获得焦点` | `NE消息提示_绑定获得焦点(控件, 处理器)` | bool | 为NE消息提示实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2273 | `NE消息提示_解绑获得焦点` | `NE消息提示_解绑获得焦点(控件)` | bool | 移除NE消息提示实例由代码绑定的“获得焦点”处理器。 |
| 2274 | `NE消息提示_绑定失去焦点` | `NE消息提示_绑定失去焦点(控件, 处理器)` | bool | 为NE消息提示实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2275 | `NE消息提示_解绑失去焦点` | `NE消息提示_解绑失去焦点(控件)` | bool | 移除NE消息提示实例由代码绑定的“失去焦点”处理器。 |
| 2276 | `控件_创建NE消息框` | `控件_创建NE消息框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE消息框 | 在当前 new_emoji 窗口运行时创建NE消息框，窗口拥有元素生命周期。 |
| 2277 | `通过标记文本获取NE消息框` | `通过标记文本获取NE消息框(标记文本)` | NE消息框 | 按区分大小写的非空文本标记查找NE消息框，找不到时返回无效引用。 |
| 2278 | `通过标记整数获取NE消息框` | `通过标记整数获取NE消息框(标记整数)` | NE消息框 | 按有符号 32 位整数标记查找NE消息框，找不到时返回无效引用。 |
| 2279 | `NE消息框_绑定处理结果` | `NE消息框_绑定处理结果(控件, 处理器)` | bool | 为NE消息框实例绑定“处理结果”处理器，处理器必须使用 &名称。 |
| 2280 | `NE消息框_解绑处理结果` | `NE消息框_解绑处理结果(控件)` | bool | 移除NE消息框实例由代码绑定的“处理结果”处理器。 |
| 2281 | `NE消息框_绑定鼠标进入` | `NE消息框_绑定鼠标进入(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2282 | `NE消息框_解绑鼠标进入` | `NE消息框_解绑鼠标进入(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标进入”处理器。 |
| 2283 | `NE消息框_绑定鼠标离开` | `NE消息框_绑定鼠标离开(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2284 | `NE消息框_解绑鼠标离开` | `NE消息框_解绑鼠标离开(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标离开”处理器。 |
| 2285 | `NE消息框_绑定鼠标按下` | `NE消息框_绑定鼠标按下(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2286 | `NE消息框_解绑鼠标按下` | `NE消息框_解绑鼠标按下(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标按下”处理器。 |
| 2287 | `NE消息框_绑定鼠标抬起` | `NE消息框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2288 | `NE消息框_解绑鼠标抬起` | `NE消息框_解绑鼠标抬起(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标抬起”处理器。 |
| 2289 | `NE消息框_绑定鼠标双击` | `NE消息框_绑定鼠标双击(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2290 | `NE消息框_解绑鼠标双击` | `NE消息框_解绑鼠标双击(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标双击”处理器。 |
| 2291 | `NE消息框_绑定鼠标移动` | `NE消息框_绑定鼠标移动(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2292 | `NE消息框_解绑鼠标移动` | `NE消息框_解绑鼠标移动(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标移动”处理器。 |
| 2293 | `NE消息框_绑定鼠标滚轮` | `NE消息框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE消息框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2294 | `NE消息框_解绑鼠标滚轮` | `NE消息框_解绑鼠标滚轮(控件)` | bool | 移除NE消息框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2295 | `NE消息框_绑定获得焦点` | `NE消息框_绑定获得焦点(控件, 处理器)` | bool | 为NE消息框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2296 | `NE消息框_解绑获得焦点` | `NE消息框_解绑获得焦点(控件)` | bool | 移除NE消息框实例由代码绑定的“获得焦点”处理器。 |
| 2297 | `NE消息框_绑定失去焦点` | `NE消息框_绑定失去焦点(控件, 处理器)` | bool | 为NE消息框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2298 | `NE消息框_解绑失去焦点` | `NE消息框_解绑失去焦点(控件)` | bool | 移除NE消息框实例由代码绑定的“失去焦点”处理器。 |
| 2299 | `控件_创建NE信息框` | `控件_创建NE信息框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE信息框 | 在当前 new_emoji 窗口运行时创建NE信息框，窗口拥有元素生命周期。 |
| 2300 | `通过标记文本获取NE信息框` | `通过标记文本获取NE信息框(标记文本)` | NE信息框 | 按区分大小写的非空文本标记查找NE信息框，找不到时返回无效引用。 |
| 2301 | `通过标记整数获取NE信息框` | `通过标记整数获取NE信息框(标记整数)` | NE信息框 | 按有符号 32 位整数标记查找NE信息框，找不到时返回无效引用。 |
| 2302 | `NE信息框_绑定鼠标进入` | `NE信息框_绑定鼠标进入(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2303 | `NE信息框_解绑鼠标进入` | `NE信息框_解绑鼠标进入(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标进入”处理器。 |
| 2304 | `NE信息框_绑定鼠标离开` | `NE信息框_绑定鼠标离开(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2305 | `NE信息框_解绑鼠标离开` | `NE信息框_解绑鼠标离开(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标离开”处理器。 |
| 2306 | `NE信息框_绑定鼠标按下` | `NE信息框_绑定鼠标按下(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2307 | `NE信息框_解绑鼠标按下` | `NE信息框_解绑鼠标按下(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标按下”处理器。 |
| 2308 | `NE信息框_绑定鼠标抬起` | `NE信息框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2309 | `NE信息框_解绑鼠标抬起` | `NE信息框_解绑鼠标抬起(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标抬起”处理器。 |
| 2310 | `NE信息框_绑定鼠标双击` | `NE信息框_绑定鼠标双击(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2311 | `NE信息框_解绑鼠标双击` | `NE信息框_解绑鼠标双击(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标双击”处理器。 |
| 2312 | `NE信息框_绑定鼠标移动` | `NE信息框_绑定鼠标移动(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2313 | `NE信息框_解绑鼠标移动` | `NE信息框_解绑鼠标移动(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标移动”处理器。 |
| 2314 | `NE信息框_绑定鼠标滚轮` | `NE信息框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE信息框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2315 | `NE信息框_解绑鼠标滚轮` | `NE信息框_解绑鼠标滚轮(控件)` | bool | 移除NE信息框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2316 | `NE信息框_绑定获得焦点` | `NE信息框_绑定获得焦点(控件, 处理器)` | bool | 为NE信息框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2317 | `NE信息框_解绑获得焦点` | `NE信息框_解绑获得焦点(控件)` | bool | 移除NE信息框实例由代码绑定的“获得焦点”处理器。 |
| 2318 | `NE信息框_绑定失去焦点` | `NE信息框_绑定失去焦点(控件, 处理器)` | bool | 为NE信息框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2319 | `NE信息框_解绑失去焦点` | `NE信息框_解绑失去焦点(控件)` | bool | 移除NE信息框实例由代码绑定的“失去焦点”处理器。 |
| 2320 | `控件_创建NE链接` | `控件_创建NE链接(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE链接 | 在当前 new_emoji 窗口运行时创建NE链接，窗口拥有元素生命周期。 |
| 2321 | `通过标记文本获取NE链接` | `通过标记文本获取NE链接(标记文本)` | NE链接 | 按区分大小写的非空文本标记查找NE链接，找不到时返回无效引用。 |
| 2322 | `通过标记整数获取NE链接` | `通过标记整数获取NE链接(标记整数)` | NE链接 | 按有符号 32 位整数标记查找NE链接，找不到时返回无效引用。 |
| 2323 | `NE链接_绑定被点击` | `NE链接_绑定被点击(控件, 处理器)` | bool | 为NE链接实例绑定“被点击”处理器，处理器必须使用 &名称。 |
| 2324 | `NE链接_解绑被点击` | `NE链接_解绑被点击(控件)` | bool | 移除NE链接实例由代码绑定的“被点击”处理器。 |
| 2325 | `NE链接_绑定鼠标进入` | `NE链接_绑定鼠标进入(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2326 | `NE链接_解绑鼠标进入` | `NE链接_解绑鼠标进入(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标进入”处理器。 |
| 2327 | `NE链接_绑定鼠标离开` | `NE链接_绑定鼠标离开(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2328 | `NE链接_解绑鼠标离开` | `NE链接_解绑鼠标离开(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标离开”处理器。 |
| 2329 | `NE链接_绑定鼠标按下` | `NE链接_绑定鼠标按下(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2330 | `NE链接_解绑鼠标按下` | `NE链接_解绑鼠标按下(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标按下”处理器。 |
| 2331 | `NE链接_绑定鼠标抬起` | `NE链接_绑定鼠标抬起(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2332 | `NE链接_解绑鼠标抬起` | `NE链接_解绑鼠标抬起(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标抬起”处理器。 |
| 2333 | `NE链接_绑定鼠标双击` | `NE链接_绑定鼠标双击(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2334 | `NE链接_解绑鼠标双击` | `NE链接_解绑鼠标双击(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标双击”处理器。 |
| 2335 | `NE链接_绑定鼠标移动` | `NE链接_绑定鼠标移动(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2336 | `NE链接_解绑鼠标移动` | `NE链接_解绑鼠标移动(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标移动”处理器。 |
| 2337 | `NE链接_绑定鼠标滚轮` | `NE链接_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE链接实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2338 | `NE链接_解绑鼠标滚轮` | `NE链接_解绑鼠标滚轮(控件)` | bool | 移除NE链接实例由代码绑定的“鼠标滚轮”处理器。 |
| 2339 | `NE链接_绑定获得焦点` | `NE链接_绑定获得焦点(控件, 处理器)` | bool | 为NE链接实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2340 | `NE链接_解绑获得焦点` | `NE链接_解绑获得焦点(控件)` | bool | 移除NE链接实例由代码绑定的“获得焦点”处理器。 |
| 2341 | `NE链接_绑定失去焦点` | `NE链接_绑定失去焦点(控件, 处理器)` | bool | 为NE链接实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2342 | `NE链接_解绑失去焦点` | `NE链接_解绑失去焦点(控件)` | bool | 移除NE链接实例由代码绑定的“失去焦点”处理器。 |
| 2343 | `控件_创建NE图标` | `控件_创建NE图标(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE图标 | 在当前 new_emoji 窗口运行时创建NE图标，窗口拥有元素生命周期。 |
| 2344 | `通过标记文本获取NE图标` | `通过标记文本获取NE图标(标记文本)` | NE图标 | 按区分大小写的非空文本标记查找NE图标，找不到时返回无效引用。 |
| 2345 | `通过标记整数获取NE图标` | `通过标记整数获取NE图标(标记整数)` | NE图标 | 按有符号 32 位整数标记查找NE图标，找不到时返回无效引用。 |
| 2346 | `NE图标_绑定鼠标进入` | `NE图标_绑定鼠标进入(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2347 | `NE图标_解绑鼠标进入` | `NE图标_解绑鼠标进入(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标进入”处理器。 |
| 2348 | `NE图标_绑定鼠标离开` | `NE图标_绑定鼠标离开(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2349 | `NE图标_解绑鼠标离开` | `NE图标_解绑鼠标离开(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标离开”处理器。 |
| 2350 | `NE图标_绑定鼠标按下` | `NE图标_绑定鼠标按下(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2351 | `NE图标_解绑鼠标按下` | `NE图标_解绑鼠标按下(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标按下”处理器。 |
| 2352 | `NE图标_绑定鼠标抬起` | `NE图标_绑定鼠标抬起(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2353 | `NE图标_解绑鼠标抬起` | `NE图标_解绑鼠标抬起(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标抬起”处理器。 |
| 2354 | `NE图标_绑定鼠标双击` | `NE图标_绑定鼠标双击(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2355 | `NE图标_解绑鼠标双击` | `NE图标_解绑鼠标双击(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标双击”处理器。 |
| 2356 | `NE图标_绑定鼠标移动` | `NE图标_绑定鼠标移动(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2357 | `NE图标_解绑鼠标移动` | `NE图标_解绑鼠标移动(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标移动”处理器。 |
| 2358 | `NE图标_绑定鼠标滚轮` | `NE图标_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE图标实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2359 | `NE图标_解绑鼠标滚轮` | `NE图标_解绑鼠标滚轮(控件)` | bool | 移除NE图标实例由代码绑定的“鼠标滚轮”处理器。 |
| 2360 | `NE图标_绑定获得焦点` | `NE图标_绑定获得焦点(控件, 处理器)` | bool | 为NE图标实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2361 | `NE图标_解绑获得焦点` | `NE图标_解绑获得焦点(控件)` | bool | 移除NE图标实例由代码绑定的“获得焦点”处理器。 |
| 2362 | `NE图标_绑定失去焦点` | `NE图标_绑定失去焦点(控件, 处理器)` | bool | 为NE图标实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2363 | `NE图标_解绑失去焦点` | `NE图标_解绑失去焦点(控件)` | bool | 移除NE图标实例由代码绑定的“失去焦点”处理器。 |
| 2364 | `控件_创建NE间距` | `控件_创建NE间距(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE间距 | 在当前 new_emoji 窗口运行时创建NE间距，窗口拥有元素生命周期。 |
| 2365 | `通过标记文本获取NE间距` | `通过标记文本获取NE间距(标记文本)` | NE间距 | 按区分大小写的非空文本标记查找NE间距，找不到时返回无效引用。 |
| 2366 | `通过标记整数获取NE间距` | `通过标记整数获取NE间距(标记整数)` | NE间距 | 按有符号 32 位整数标记查找NE间距，找不到时返回无效引用。 |
| 2367 | `NE间距_绑定鼠标进入` | `NE间距_绑定鼠标进入(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2368 | `NE间距_解绑鼠标进入` | `NE间距_解绑鼠标进入(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标进入”处理器。 |
| 2369 | `NE间距_绑定鼠标离开` | `NE间距_绑定鼠标离开(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2370 | `NE间距_解绑鼠标离开` | `NE间距_解绑鼠标离开(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标离开”处理器。 |
| 2371 | `NE间距_绑定鼠标按下` | `NE间距_绑定鼠标按下(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2372 | `NE间距_解绑鼠标按下` | `NE间距_解绑鼠标按下(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标按下”处理器。 |
| 2373 | `NE间距_绑定鼠标抬起` | `NE间距_绑定鼠标抬起(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2374 | `NE间距_解绑鼠标抬起` | `NE间距_解绑鼠标抬起(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标抬起”处理器。 |
| 2375 | `NE间距_绑定鼠标双击` | `NE间距_绑定鼠标双击(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2376 | `NE间距_解绑鼠标双击` | `NE间距_解绑鼠标双击(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标双击”处理器。 |
| 2377 | `NE间距_绑定鼠标移动` | `NE间距_绑定鼠标移动(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2378 | `NE间距_解绑鼠标移动` | `NE间距_解绑鼠标移动(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标移动”处理器。 |
| 2379 | `NE间距_绑定鼠标滚轮` | `NE间距_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE间距实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2380 | `NE间距_解绑鼠标滚轮` | `NE间距_解绑鼠标滚轮(控件)` | bool | 移除NE间距实例由代码绑定的“鼠标滚轮”处理器。 |
| 2381 | `NE间距_绑定获得焦点` | `NE间距_绑定获得焦点(控件, 处理器)` | bool | 为NE间距实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2382 | `NE间距_解绑获得焦点` | `NE间距_解绑获得焦点(控件)` | bool | 移除NE间距实例由代码绑定的“获得焦点”处理器。 |
| 2383 | `NE间距_绑定失去焦点` | `NE间距_绑定失去焦点(控件, 处理器)` | bool | 为NE间距实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2384 | `NE间距_解绑失去焦点` | `NE间距_解绑失去焦点(控件)` | bool | 移除NE间距实例由代码绑定的“失去焦点”处理器。 |
| 2385 | `控件_创建NE容器` | `控件_创建NE容器(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE容器 | 在当前 new_emoji 窗口运行时创建NE容器，窗口拥有元素生命周期。 |
| 2386 | `通过标记文本获取NE容器` | `通过标记文本获取NE容器(标记文本)` | NE容器 | 按区分大小写的非空文本标记查找NE容器，找不到时返回无效引用。 |
| 2387 | `通过标记整数获取NE容器` | `通过标记整数获取NE容器(标记整数)` | NE容器 | 按有符号 32 位整数标记查找NE容器，找不到时返回无效引用。 |
| 2388 | `NE容器_绑定鼠标进入` | `NE容器_绑定鼠标进入(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2389 | `NE容器_解绑鼠标进入` | `NE容器_解绑鼠标进入(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标进入”处理器。 |
| 2390 | `NE容器_绑定鼠标离开` | `NE容器_绑定鼠标离开(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2391 | `NE容器_解绑鼠标离开` | `NE容器_解绑鼠标离开(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标离开”处理器。 |
| 2392 | `NE容器_绑定鼠标按下` | `NE容器_绑定鼠标按下(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2393 | `NE容器_解绑鼠标按下` | `NE容器_解绑鼠标按下(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标按下”处理器。 |
| 2394 | `NE容器_绑定鼠标抬起` | `NE容器_绑定鼠标抬起(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2395 | `NE容器_解绑鼠标抬起` | `NE容器_解绑鼠标抬起(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标抬起”处理器。 |
| 2396 | `NE容器_绑定鼠标双击` | `NE容器_绑定鼠标双击(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2397 | `NE容器_解绑鼠标双击` | `NE容器_解绑鼠标双击(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标双击”处理器。 |
| 2398 | `NE容器_绑定鼠标移动` | `NE容器_绑定鼠标移动(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2399 | `NE容器_解绑鼠标移动` | `NE容器_解绑鼠标移动(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标移动”处理器。 |
| 2400 | `NE容器_绑定鼠标滚轮` | `NE容器_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE容器实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2401 | `NE容器_解绑鼠标滚轮` | `NE容器_解绑鼠标滚轮(控件)` | bool | 移除NE容器实例由代码绑定的“鼠标滚轮”处理器。 |
| 2402 | `NE容器_绑定获得焦点` | `NE容器_绑定获得焦点(控件, 处理器)` | bool | 为NE容器实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2403 | `NE容器_解绑获得焦点` | `NE容器_解绑获得焦点(控件)` | bool | 移除NE容器实例由代码绑定的“获得焦点”处理器。 |
| 2404 | `NE容器_绑定失去焦点` | `NE容器_绑定失去焦点(控件, 处理器)` | bool | 为NE容器实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2405 | `NE容器_解绑失去焦点` | `NE容器_解绑失去焦点(控件)` | bool | 移除NE容器实例由代码绑定的“失去焦点”处理器。 |
| 2406 | `控件_创建NE页眉` | `控件_创建NE页眉(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE页眉 | 在当前 new_emoji 窗口运行时创建NE页眉，窗口拥有元素生命周期。 |
| 2407 | `通过标记文本获取NE页眉` | `通过标记文本获取NE页眉(标记文本)` | NE页眉 | 按区分大小写的非空文本标记查找NE页眉，找不到时返回无效引用。 |
| 2408 | `通过标记整数获取NE页眉` | `通过标记整数获取NE页眉(标记整数)` | NE页眉 | 按有符号 32 位整数标记查找NE页眉，找不到时返回无效引用。 |
| 2409 | `NE页眉_绑定鼠标进入` | `NE页眉_绑定鼠标进入(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2410 | `NE页眉_解绑鼠标进入` | `NE页眉_解绑鼠标进入(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标进入”处理器。 |
| 2411 | `NE页眉_绑定鼠标离开` | `NE页眉_绑定鼠标离开(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2412 | `NE页眉_解绑鼠标离开` | `NE页眉_解绑鼠标离开(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标离开”处理器。 |
| 2413 | `NE页眉_绑定鼠标按下` | `NE页眉_绑定鼠标按下(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2414 | `NE页眉_解绑鼠标按下` | `NE页眉_解绑鼠标按下(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标按下”处理器。 |
| 2415 | `NE页眉_绑定鼠标抬起` | `NE页眉_绑定鼠标抬起(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2416 | `NE页眉_解绑鼠标抬起` | `NE页眉_解绑鼠标抬起(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标抬起”处理器。 |
| 2417 | `NE页眉_绑定鼠标双击` | `NE页眉_绑定鼠标双击(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2418 | `NE页眉_解绑鼠标双击` | `NE页眉_解绑鼠标双击(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标双击”处理器。 |
| 2419 | `NE页眉_绑定鼠标移动` | `NE页眉_绑定鼠标移动(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2420 | `NE页眉_解绑鼠标移动` | `NE页眉_解绑鼠标移动(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标移动”处理器。 |
| 2421 | `NE页眉_绑定鼠标滚轮` | `NE页眉_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE页眉实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2422 | `NE页眉_解绑鼠标滚轮` | `NE页眉_解绑鼠标滚轮(控件)` | bool | 移除NE页眉实例由代码绑定的“鼠标滚轮”处理器。 |
| 2423 | `NE页眉_绑定获得焦点` | `NE页眉_绑定获得焦点(控件, 处理器)` | bool | 为NE页眉实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2424 | `NE页眉_解绑获得焦点` | `NE页眉_解绑获得焦点(控件)` | bool | 移除NE页眉实例由代码绑定的“获得焦点”处理器。 |
| 2425 | `NE页眉_绑定失去焦点` | `NE页眉_绑定失去焦点(控件, 处理器)` | bool | 为NE页眉实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2426 | `NE页眉_解绑失去焦点` | `NE页眉_解绑失去焦点(控件)` | bool | 移除NE页眉实例由代码绑定的“失去焦点”处理器。 |
| 2427 | `控件_创建NE侧边栏` | `控件_创建NE侧边栏(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE侧边栏 | 在当前 new_emoji 窗口运行时创建NE侧边栏，窗口拥有元素生命周期。 |
| 2428 | `通过标记文本获取NE侧边栏` | `通过标记文本获取NE侧边栏(标记文本)` | NE侧边栏 | 按区分大小写的非空文本标记查找NE侧边栏，找不到时返回无效引用。 |
| 2429 | `通过标记整数获取NE侧边栏` | `通过标记整数获取NE侧边栏(标记整数)` | NE侧边栏 | 按有符号 32 位整数标记查找NE侧边栏，找不到时返回无效引用。 |
| 2430 | `NE侧边栏_绑定鼠标进入` | `NE侧边栏_绑定鼠标进入(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2431 | `NE侧边栏_解绑鼠标进入` | `NE侧边栏_解绑鼠标进入(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标进入”处理器。 |
| 2432 | `NE侧边栏_绑定鼠标离开` | `NE侧边栏_绑定鼠标离开(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2433 | `NE侧边栏_解绑鼠标离开` | `NE侧边栏_解绑鼠标离开(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标离开”处理器。 |
| 2434 | `NE侧边栏_绑定鼠标按下` | `NE侧边栏_绑定鼠标按下(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2435 | `NE侧边栏_解绑鼠标按下` | `NE侧边栏_解绑鼠标按下(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标按下”处理器。 |
| 2436 | `NE侧边栏_绑定鼠标抬起` | `NE侧边栏_绑定鼠标抬起(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2437 | `NE侧边栏_解绑鼠标抬起` | `NE侧边栏_解绑鼠标抬起(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标抬起”处理器。 |
| 2438 | `NE侧边栏_绑定鼠标双击` | `NE侧边栏_绑定鼠标双击(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2439 | `NE侧边栏_解绑鼠标双击` | `NE侧边栏_解绑鼠标双击(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标双击”处理器。 |
| 2440 | `NE侧边栏_绑定鼠标移动` | `NE侧边栏_绑定鼠标移动(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2441 | `NE侧边栏_解绑鼠标移动` | `NE侧边栏_解绑鼠标移动(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标移动”处理器。 |
| 2442 | `NE侧边栏_绑定鼠标滚轮` | `NE侧边栏_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE侧边栏实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2443 | `NE侧边栏_解绑鼠标滚轮` | `NE侧边栏_解绑鼠标滚轮(控件)` | bool | 移除NE侧边栏实例由代码绑定的“鼠标滚轮”处理器。 |
| 2444 | `NE侧边栏_绑定获得焦点` | `NE侧边栏_绑定获得焦点(控件, 处理器)` | bool | 为NE侧边栏实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2445 | `NE侧边栏_解绑获得焦点` | `NE侧边栏_解绑获得焦点(控件)` | bool | 移除NE侧边栏实例由代码绑定的“获得焦点”处理器。 |
| 2446 | `NE侧边栏_绑定失去焦点` | `NE侧边栏_绑定失去焦点(控件, 处理器)` | bool | 为NE侧边栏实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2447 | `NE侧边栏_解绑失去焦点` | `NE侧边栏_解绑失去焦点(控件)` | bool | 移除NE侧边栏实例由代码绑定的“失去焦点”处理器。 |
| 2448 | `控件_创建NE主要区域` | `控件_创建NE主要区域(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE主要区域 | 在当前 new_emoji 窗口运行时创建NE主要区域，窗口拥有元素生命周期。 |
| 2449 | `通过标记文本获取NE主要区域` | `通过标记文本获取NE主要区域(标记文本)` | NE主要区域 | 按区分大小写的非空文本标记查找NE主要区域，找不到时返回无效引用。 |
| 2450 | `通过标记整数获取NE主要区域` | `通过标记整数获取NE主要区域(标记整数)` | NE主要区域 | 按有符号 32 位整数标记查找NE主要区域，找不到时返回无效引用。 |
| 2451 | `NE主要区域_绑定鼠标进入` | `NE主要区域_绑定鼠标进入(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2452 | `NE主要区域_解绑鼠标进入` | `NE主要区域_解绑鼠标进入(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标进入”处理器。 |
| 2453 | `NE主要区域_绑定鼠标离开` | `NE主要区域_绑定鼠标离开(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2454 | `NE主要区域_解绑鼠标离开` | `NE主要区域_解绑鼠标离开(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标离开”处理器。 |
| 2455 | `NE主要区域_绑定鼠标按下` | `NE主要区域_绑定鼠标按下(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2456 | `NE主要区域_解绑鼠标按下` | `NE主要区域_解绑鼠标按下(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标按下”处理器。 |
| 2457 | `NE主要区域_绑定鼠标抬起` | `NE主要区域_绑定鼠标抬起(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2458 | `NE主要区域_解绑鼠标抬起` | `NE主要区域_解绑鼠标抬起(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标抬起”处理器。 |
| 2459 | `NE主要区域_绑定鼠标双击` | `NE主要区域_绑定鼠标双击(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2460 | `NE主要区域_解绑鼠标双击` | `NE主要区域_解绑鼠标双击(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标双击”处理器。 |
| 2461 | `NE主要区域_绑定鼠标移动` | `NE主要区域_绑定鼠标移动(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2462 | `NE主要区域_解绑鼠标移动` | `NE主要区域_解绑鼠标移动(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标移动”处理器。 |
| 2463 | `NE主要区域_绑定鼠标滚轮` | `NE主要区域_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE主要区域实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2464 | `NE主要区域_解绑鼠标滚轮` | `NE主要区域_解绑鼠标滚轮(控件)` | bool | 移除NE主要区域实例由代码绑定的“鼠标滚轮”处理器。 |
| 2465 | `NE主要区域_绑定获得焦点` | `NE主要区域_绑定获得焦点(控件, 处理器)` | bool | 为NE主要区域实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2466 | `NE主要区域_解绑获得焦点` | `NE主要区域_解绑获得焦点(控件)` | bool | 移除NE主要区域实例由代码绑定的“获得焦点”处理器。 |
| 2467 | `NE主要区域_绑定失去焦点` | `NE主要区域_绑定失去焦点(控件, 处理器)` | bool | 为NE主要区域实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2468 | `NE主要区域_解绑失去焦点` | `NE主要区域_解绑失去焦点(控件)` | bool | 移除NE主要区域实例由代码绑定的“失去焦点”处理器。 |
| 2469 | `控件_创建NE页脚` | `控件_创建NE页脚(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE页脚 | 在当前 new_emoji 窗口运行时创建NE页脚，窗口拥有元素生命周期。 |
| 2470 | `通过标记文本获取NE页脚` | `通过标记文本获取NE页脚(标记文本)` | NE页脚 | 按区分大小写的非空文本标记查找NE页脚，找不到时返回无效引用。 |
| 2471 | `通过标记整数获取NE页脚` | `通过标记整数获取NE页脚(标记整数)` | NE页脚 | 按有符号 32 位整数标记查找NE页脚，找不到时返回无效引用。 |
| 2472 | `NE页脚_绑定鼠标进入` | `NE页脚_绑定鼠标进入(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2473 | `NE页脚_解绑鼠标进入` | `NE页脚_解绑鼠标进入(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标进入”处理器。 |
| 2474 | `NE页脚_绑定鼠标离开` | `NE页脚_绑定鼠标离开(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2475 | `NE页脚_解绑鼠标离开` | `NE页脚_解绑鼠标离开(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标离开”处理器。 |
| 2476 | `NE页脚_绑定鼠标按下` | `NE页脚_绑定鼠标按下(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2477 | `NE页脚_解绑鼠标按下` | `NE页脚_解绑鼠标按下(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标按下”处理器。 |
| 2478 | `NE页脚_绑定鼠标抬起` | `NE页脚_绑定鼠标抬起(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2479 | `NE页脚_解绑鼠标抬起` | `NE页脚_解绑鼠标抬起(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标抬起”处理器。 |
| 2480 | `NE页脚_绑定鼠标双击` | `NE页脚_绑定鼠标双击(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2481 | `NE页脚_解绑鼠标双击` | `NE页脚_解绑鼠标双击(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标双击”处理器。 |
| 2482 | `NE页脚_绑定鼠标移动` | `NE页脚_绑定鼠标移动(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2483 | `NE页脚_解绑鼠标移动` | `NE页脚_解绑鼠标移动(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标移动”处理器。 |
| 2484 | `NE页脚_绑定鼠标滚轮` | `NE页脚_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE页脚实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2485 | `NE页脚_解绑鼠标滚轮` | `NE页脚_解绑鼠标滚轮(控件)` | bool | 移除NE页脚实例由代码绑定的“鼠标滚轮”处理器。 |
| 2486 | `NE页脚_绑定获得焦点` | `NE页脚_绑定获得焦点(控件, 处理器)` | bool | 为NE页脚实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2487 | `NE页脚_解绑获得焦点` | `NE页脚_解绑获得焦点(控件)` | bool | 移除NE页脚实例由代码绑定的“获得焦点”处理器。 |
| 2488 | `NE页脚_绑定失去焦点` | `NE页脚_绑定失去焦点(控件, 处理器)` | bool | 为NE页脚实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2489 | `NE页脚_解绑失去焦点` | `NE页脚_解绑失去焦点(控件)` | bool | 移除NE页脚实例由代码绑定的“失去焦点”处理器。 |
| 2490 | `控件_创建NE布局` | `控件_创建NE布局(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE布局 | 在当前 new_emoji 窗口运行时创建NE布局，窗口拥有元素生命周期。 |
| 2491 | `通过标记文本获取NE布局` | `通过标记文本获取NE布局(标记文本)` | NE布局 | 按区分大小写的非空文本标记查找NE布局，找不到时返回无效引用。 |
| 2492 | `通过标记整数获取NE布局` | `通过标记整数获取NE布局(标记整数)` | NE布局 | 按有符号 32 位整数标记查找NE布局，找不到时返回无效引用。 |
| 2493 | `NE布局_绑定鼠标进入` | `NE布局_绑定鼠标进入(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2494 | `NE布局_解绑鼠标进入` | `NE布局_解绑鼠标进入(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标进入”处理器。 |
| 2495 | `NE布局_绑定鼠标离开` | `NE布局_绑定鼠标离开(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2496 | `NE布局_解绑鼠标离开` | `NE布局_解绑鼠标离开(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标离开”处理器。 |
| 2497 | `NE布局_绑定鼠标按下` | `NE布局_绑定鼠标按下(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2498 | `NE布局_解绑鼠标按下` | `NE布局_解绑鼠标按下(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标按下”处理器。 |
| 2499 | `NE布局_绑定鼠标抬起` | `NE布局_绑定鼠标抬起(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2500 | `NE布局_解绑鼠标抬起` | `NE布局_解绑鼠标抬起(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标抬起”处理器。 |
| 2501 | `NE布局_绑定鼠标双击` | `NE布局_绑定鼠标双击(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2502 | `NE布局_解绑鼠标双击` | `NE布局_解绑鼠标双击(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标双击”处理器。 |
| 2503 | `NE布局_绑定鼠标移动` | `NE布局_绑定鼠标移动(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2504 | `NE布局_解绑鼠标移动` | `NE布局_解绑鼠标移动(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标移动”处理器。 |
| 2505 | `NE布局_绑定鼠标滚轮` | `NE布局_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE布局实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2506 | `NE布局_解绑鼠标滚轮` | `NE布局_解绑鼠标滚轮(控件)` | bool | 移除NE布局实例由代码绑定的“鼠标滚轮”处理器。 |
| 2507 | `NE布局_绑定获得焦点` | `NE布局_绑定获得焦点(控件, 处理器)` | bool | 为NE布局实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2508 | `NE布局_解绑获得焦点` | `NE布局_解绑获得焦点(控件)` | bool | 移除NE布局实例由代码绑定的“获得焦点”处理器。 |
| 2509 | `NE布局_绑定失去焦点` | `NE布局_绑定失去焦点(控件, 处理器)` | bool | 为NE布局实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2510 | `NE布局_解绑失去焦点` | `NE布局_解绑失去焦点(控件)` | bool | 移除NE布局实例由代码绑定的“失去焦点”处理器。 |
| 2511 | `控件_创建NE边框` | `控件_创建NE边框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE边框 | 在当前 new_emoji 窗口运行时创建NE边框，窗口拥有元素生命周期。 |
| 2512 | `通过标记文本获取NE边框` | `通过标记文本获取NE边框(标记文本)` | NE边框 | 按区分大小写的非空文本标记查找NE边框，找不到时返回无效引用。 |
| 2513 | `通过标记整数获取NE边框` | `通过标记整数获取NE边框(标记整数)` | NE边框 | 按有符号 32 位整数标记查找NE边框，找不到时返回无效引用。 |
| 2514 | `NE边框_绑定鼠标进入` | `NE边框_绑定鼠标进入(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2515 | `NE边框_解绑鼠标进入` | `NE边框_解绑鼠标进入(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标进入”处理器。 |
| 2516 | `NE边框_绑定鼠标离开` | `NE边框_绑定鼠标离开(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2517 | `NE边框_解绑鼠标离开` | `NE边框_解绑鼠标离开(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标离开”处理器。 |
| 2518 | `NE边框_绑定鼠标按下` | `NE边框_绑定鼠标按下(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2519 | `NE边框_解绑鼠标按下` | `NE边框_解绑鼠标按下(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标按下”处理器。 |
| 2520 | `NE边框_绑定鼠标抬起` | `NE边框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2521 | `NE边框_解绑鼠标抬起` | `NE边框_解绑鼠标抬起(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标抬起”处理器。 |
| 2522 | `NE边框_绑定鼠标双击` | `NE边框_绑定鼠标双击(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2523 | `NE边框_解绑鼠标双击` | `NE边框_解绑鼠标双击(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标双击”处理器。 |
| 2524 | `NE边框_绑定鼠标移动` | `NE边框_绑定鼠标移动(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2525 | `NE边框_解绑鼠标移动` | `NE边框_解绑鼠标移动(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标移动”处理器。 |
| 2526 | `NE边框_绑定鼠标滚轮` | `NE边框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE边框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2527 | `NE边框_解绑鼠标滚轮` | `NE边框_解绑鼠标滚轮(控件)` | bool | 移除NE边框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2528 | `NE边框_绑定获得焦点` | `NE边框_绑定获得焦点(控件, 处理器)` | bool | 为NE边框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2529 | `NE边框_解绑获得焦点` | `NE边框_解绑获得焦点(控件)` | bool | 移除NE边框实例由代码绑定的“获得焦点”处理器。 |
| 2530 | `NE边框_绑定失去焦点` | `NE边框_绑定失去焦点(控件, 处理器)` | bool | 为NE边框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2531 | `NE边框_解绑失去焦点` | `NE边框_解绑失去焦点(控件)` | bool | 移除NE边框实例由代码绑定的“失去焦点”处理器。 |
| 2532 | `控件_创建NE分割线` | `控件_创建NE分割线(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE分割线 | 在当前 new_emoji 窗口运行时创建NE分割线，窗口拥有元素生命周期。 |
| 2533 | `通过标记文本获取NE分割线` | `通过标记文本获取NE分割线(标记文本)` | NE分割线 | 按区分大小写的非空文本标记查找NE分割线，找不到时返回无效引用。 |
| 2534 | `通过标记整数获取NE分割线` | `通过标记整数获取NE分割线(标记整数)` | NE分割线 | 按有符号 32 位整数标记查找NE分割线，找不到时返回无效引用。 |
| 2535 | `NE分割线_绑定鼠标进入` | `NE分割线_绑定鼠标进入(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2536 | `NE分割线_解绑鼠标进入` | `NE分割线_解绑鼠标进入(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标进入”处理器。 |
| 2537 | `NE分割线_绑定鼠标离开` | `NE分割线_绑定鼠标离开(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2538 | `NE分割线_解绑鼠标离开` | `NE分割线_解绑鼠标离开(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标离开”处理器。 |
| 2539 | `NE分割线_绑定鼠标按下` | `NE分割线_绑定鼠标按下(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2540 | `NE分割线_解绑鼠标按下` | `NE分割线_解绑鼠标按下(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标按下”处理器。 |
| 2541 | `NE分割线_绑定鼠标抬起` | `NE分割线_绑定鼠标抬起(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2542 | `NE分割线_解绑鼠标抬起` | `NE分割线_解绑鼠标抬起(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标抬起”处理器。 |
| 2543 | `NE分割线_绑定鼠标双击` | `NE分割线_绑定鼠标双击(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2544 | `NE分割线_解绑鼠标双击` | `NE分割线_解绑鼠标双击(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标双击”处理器。 |
| 2545 | `NE分割线_绑定鼠标移动` | `NE分割线_绑定鼠标移动(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2546 | `NE分割线_解绑鼠标移动` | `NE分割线_解绑鼠标移动(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标移动”处理器。 |
| 2547 | `NE分割线_绑定鼠标滚轮` | `NE分割线_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE分割线实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2548 | `NE分割线_解绑鼠标滚轮` | `NE分割线_解绑鼠标滚轮(控件)` | bool | 移除NE分割线实例由代码绑定的“鼠标滚轮”处理器。 |
| 2549 | `NE分割线_绑定获得焦点` | `NE分割线_绑定获得焦点(控件, 处理器)` | bool | 为NE分割线实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2550 | `NE分割线_解绑获得焦点` | `NE分割线_解绑获得焦点(控件)` | bool | 移除NE分割线实例由代码绑定的“获得焦点”处理器。 |
| 2551 | `NE分割线_绑定失去焦点` | `NE分割线_绑定失去焦点(控件, 处理器)` | bool | 为NE分割线实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2552 | `NE分割线_解绑失去焦点` | `NE分割线_解绑失去焦点(控件)` | bool | 移除NE分割线实例由代码绑定的“失去焦点”处理器。 |
| 2553 | `控件_创建NE复选框` | `控件_创建NE复选框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE复选框 | 在当前 new_emoji 窗口运行时创建NE复选框，窗口拥有元素生命周期。 |
| 2554 | `通过标记文本获取NE复选框` | `通过标记文本获取NE复选框(标记文本)` | NE复选框 | 按区分大小写的非空文本标记查找NE复选框，找不到时返回无效引用。 |
| 2555 | `通过标记整数获取NE复选框` | `通过标记整数获取NE复选框(标记整数)` | NE复选框 | 按有符号 32 位整数标记查找NE复选框，找不到时返回无效引用。 |
| 2556 | `NE复选框_绑定数值变化` | `NE复选框_绑定数值变化(控件, 处理器)` | bool | 为NE复选框实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2557 | `NE复选框_解绑数值变化` | `NE复选框_解绑数值变化(控件)` | bool | 移除NE复选框实例由代码绑定的“数值变化”处理器。 |
| 2558 | `NE复选框_绑定鼠标进入` | `NE复选框_绑定鼠标进入(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2559 | `NE复选框_解绑鼠标进入` | `NE复选框_解绑鼠标进入(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标进入”处理器。 |
| 2560 | `NE复选框_绑定鼠标离开` | `NE复选框_绑定鼠标离开(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2561 | `NE复选框_解绑鼠标离开` | `NE复选框_解绑鼠标离开(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标离开”处理器。 |
| 2562 | `NE复选框_绑定鼠标按下` | `NE复选框_绑定鼠标按下(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2563 | `NE复选框_解绑鼠标按下` | `NE复选框_解绑鼠标按下(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标按下”处理器。 |
| 2564 | `NE复选框_绑定鼠标抬起` | `NE复选框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2565 | `NE复选框_解绑鼠标抬起` | `NE复选框_解绑鼠标抬起(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标抬起”处理器。 |
| 2566 | `NE复选框_绑定鼠标双击` | `NE复选框_绑定鼠标双击(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2567 | `NE复选框_解绑鼠标双击` | `NE复选框_解绑鼠标双击(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标双击”处理器。 |
| 2568 | `NE复选框_绑定鼠标移动` | `NE复选框_绑定鼠标移动(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2569 | `NE复选框_解绑鼠标移动` | `NE复选框_解绑鼠标移动(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标移动”处理器。 |
| 2570 | `NE复选框_绑定鼠标滚轮` | `NE复选框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE复选框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2571 | `NE复选框_解绑鼠标滚轮` | `NE复选框_解绑鼠标滚轮(控件)` | bool | 移除NE复选框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2572 | `NE复选框_绑定获得焦点` | `NE复选框_绑定获得焦点(控件, 处理器)` | bool | 为NE复选框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2573 | `NE复选框_解绑获得焦点` | `NE复选框_解绑获得焦点(控件)` | bool | 移除NE复选框实例由代码绑定的“获得焦点”处理器。 |
| 2574 | `NE复选框_绑定失去焦点` | `NE复选框_绑定失去焦点(控件, 处理器)` | bool | 为NE复选框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2575 | `NE复选框_解绑失去焦点` | `NE复选框_解绑失去焦点(控件)` | bool | 移除NE复选框实例由代码绑定的“失去焦点”处理器。 |
| 2576 | `控件_创建NE单选框` | `控件_创建NE单选框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE单选框 | 在当前 new_emoji 窗口运行时创建NE单选框，窗口拥有元素生命周期。 |
| 2577 | `通过标记文本获取NE单选框` | `通过标记文本获取NE单选框(标记文本)` | NE单选框 | 按区分大小写的非空文本标记查找NE单选框，找不到时返回无效引用。 |
| 2578 | `通过标记整数获取NE单选框` | `通过标记整数获取NE单选框(标记整数)` | NE单选框 | 按有符号 32 位整数标记查找NE单选框，找不到时返回无效引用。 |
| 2579 | `NE单选框_绑定数值变化` | `NE单选框_绑定数值变化(控件, 处理器)` | bool | 为NE单选框实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2580 | `NE单选框_解绑数值变化` | `NE单选框_解绑数值变化(控件)` | bool | 移除NE单选框实例由代码绑定的“数值变化”处理器。 |
| 2581 | `NE单选框_绑定鼠标进入` | `NE单选框_绑定鼠标进入(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2582 | `NE单选框_解绑鼠标进入` | `NE单选框_解绑鼠标进入(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标进入”处理器。 |
| 2583 | `NE单选框_绑定鼠标离开` | `NE单选框_绑定鼠标离开(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2584 | `NE单选框_解绑鼠标离开` | `NE单选框_解绑鼠标离开(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标离开”处理器。 |
| 2585 | `NE单选框_绑定鼠标按下` | `NE单选框_绑定鼠标按下(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2586 | `NE单选框_解绑鼠标按下` | `NE单选框_解绑鼠标按下(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标按下”处理器。 |
| 2587 | `NE单选框_绑定鼠标抬起` | `NE单选框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2588 | `NE单选框_解绑鼠标抬起` | `NE单选框_解绑鼠标抬起(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标抬起”处理器。 |
| 2589 | `NE单选框_绑定鼠标双击` | `NE单选框_绑定鼠标双击(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2590 | `NE单选框_解绑鼠标双击` | `NE单选框_解绑鼠标双击(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标双击”处理器。 |
| 2591 | `NE单选框_绑定鼠标移动` | `NE单选框_绑定鼠标移动(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2592 | `NE单选框_解绑鼠标移动` | `NE单选框_解绑鼠标移动(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标移动”处理器。 |
| 2593 | `NE单选框_绑定鼠标滚轮` | `NE单选框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE单选框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2594 | `NE单选框_解绑鼠标滚轮` | `NE单选框_解绑鼠标滚轮(控件)` | bool | 移除NE单选框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2595 | `NE单选框_绑定获得焦点` | `NE单选框_绑定获得焦点(控件, 处理器)` | bool | 为NE单选框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2596 | `NE单选框_解绑获得焦点` | `NE单选框_解绑获得焦点(控件)` | bool | 移除NE单选框实例由代码绑定的“获得焦点”处理器。 |
| 2597 | `NE单选框_绑定失去焦点` | `NE单选框_绑定失去焦点(控件, 处理器)` | bool | 为NE单选框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2598 | `NE单选框_解绑失去焦点` | `NE单选框_解绑失去焦点(控件)` | bool | 移除NE单选框实例由代码绑定的“失去焦点”处理器。 |
| 2599 | `控件_创建NE开关` | `控件_创建NE开关(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE开关 | 在当前 new_emoji 窗口运行时创建NE开关，窗口拥有元素生命周期。 |
| 2600 | `通过标记文本获取NE开关` | `通过标记文本获取NE开关(标记文本)` | NE开关 | 按区分大小写的非空文本标记查找NE开关，找不到时返回无效引用。 |
| 2601 | `通过标记整数获取NE开关` | `通过标记整数获取NE开关(标记整数)` | NE开关 | 按有符号 32 位整数标记查找NE开关，找不到时返回无效引用。 |
| 2602 | `NE开关_绑定数值变化` | `NE开关_绑定数值变化(控件, 处理器)` | bool | 为NE开关实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2603 | `NE开关_解绑数值变化` | `NE开关_解绑数值变化(控件)` | bool | 移除NE开关实例由代码绑定的“数值变化”处理器。 |
| 2604 | `NE开关_绑定鼠标进入` | `NE开关_绑定鼠标进入(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2605 | `NE开关_解绑鼠标进入` | `NE开关_解绑鼠标进入(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标进入”处理器。 |
| 2606 | `NE开关_绑定鼠标离开` | `NE开关_绑定鼠标离开(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2607 | `NE开关_解绑鼠标离开` | `NE开关_解绑鼠标离开(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标离开”处理器。 |
| 2608 | `NE开关_绑定鼠标按下` | `NE开关_绑定鼠标按下(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2609 | `NE开关_解绑鼠标按下` | `NE开关_解绑鼠标按下(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标按下”处理器。 |
| 2610 | `NE开关_绑定鼠标抬起` | `NE开关_绑定鼠标抬起(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2611 | `NE开关_解绑鼠标抬起` | `NE开关_解绑鼠标抬起(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标抬起”处理器。 |
| 2612 | `NE开关_绑定鼠标双击` | `NE开关_绑定鼠标双击(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2613 | `NE开关_解绑鼠标双击` | `NE开关_解绑鼠标双击(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标双击”处理器。 |
| 2614 | `NE开关_绑定鼠标移动` | `NE开关_绑定鼠标移动(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2615 | `NE开关_解绑鼠标移动` | `NE开关_解绑鼠标移动(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标移动”处理器。 |
| 2616 | `NE开关_绑定鼠标滚轮` | `NE开关_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE开关实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2617 | `NE开关_解绑鼠标滚轮` | `NE开关_解绑鼠标滚轮(控件)` | bool | 移除NE开关实例由代码绑定的“鼠标滚轮”处理器。 |
| 2618 | `NE开关_绑定获得焦点` | `NE开关_绑定获得焦点(控件, 处理器)` | bool | 为NE开关实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2619 | `NE开关_解绑获得焦点` | `NE开关_解绑获得焦点(控件)` | bool | 移除NE开关实例由代码绑定的“获得焦点”处理器。 |
| 2620 | `NE开关_绑定失去焦点` | `NE开关_绑定失去焦点(控件, 处理器)` | bool | 为NE开关实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2621 | `NE开关_解绑失去焦点` | `NE开关_解绑失去焦点(控件)` | bool | 移除NE开关实例由代码绑定的“失去焦点”处理器。 |
| 2622 | `控件_创建NE滑块` | `控件_创建NE滑块(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE滑块 | 在当前 new_emoji 窗口运行时创建NE滑块，窗口拥有元素生命周期。 |
| 2623 | `通过标记文本获取NE滑块` | `通过标记文本获取NE滑块(标记文本)` | NE滑块 | 按区分大小写的非空文本标记查找NE滑块，找不到时返回无效引用。 |
| 2624 | `通过标记整数获取NE滑块` | `通过标记整数获取NE滑块(标记整数)` | NE滑块 | 按有符号 32 位整数标记查找NE滑块，找不到时返回无效引用。 |
| 2625 | `NE滑块_绑定数值变化` | `NE滑块_绑定数值变化(控件, 处理器)` | bool | 为NE滑块实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2626 | `NE滑块_解绑数值变化` | `NE滑块_解绑数值变化(控件)` | bool | 移除NE滑块实例由代码绑定的“数值变化”处理器。 |
| 2627 | `NE滑块_绑定鼠标进入` | `NE滑块_绑定鼠标进入(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2628 | `NE滑块_解绑鼠标进入` | `NE滑块_解绑鼠标进入(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标进入”处理器。 |
| 2629 | `NE滑块_绑定鼠标离开` | `NE滑块_绑定鼠标离开(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2630 | `NE滑块_解绑鼠标离开` | `NE滑块_解绑鼠标离开(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标离开”处理器。 |
| 2631 | `NE滑块_绑定鼠标按下` | `NE滑块_绑定鼠标按下(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2632 | `NE滑块_解绑鼠标按下` | `NE滑块_解绑鼠标按下(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标按下”处理器。 |
| 2633 | `NE滑块_绑定鼠标抬起` | `NE滑块_绑定鼠标抬起(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2634 | `NE滑块_解绑鼠标抬起` | `NE滑块_解绑鼠标抬起(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标抬起”处理器。 |
| 2635 | `NE滑块_绑定鼠标双击` | `NE滑块_绑定鼠标双击(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2636 | `NE滑块_解绑鼠标双击` | `NE滑块_解绑鼠标双击(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标双击”处理器。 |
| 2637 | `NE滑块_绑定鼠标移动` | `NE滑块_绑定鼠标移动(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2638 | `NE滑块_解绑鼠标移动` | `NE滑块_解绑鼠标移动(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标移动”处理器。 |
| 2639 | `NE滑块_绑定鼠标滚轮` | `NE滑块_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE滑块实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2640 | `NE滑块_解绑鼠标滚轮` | `NE滑块_解绑鼠标滚轮(控件)` | bool | 移除NE滑块实例由代码绑定的“鼠标滚轮”处理器。 |
| 2641 | `NE滑块_绑定获得焦点` | `NE滑块_绑定获得焦点(控件, 处理器)` | bool | 为NE滑块实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2642 | `NE滑块_解绑获得焦点` | `NE滑块_解绑获得焦点(控件)` | bool | 移除NE滑块实例由代码绑定的“获得焦点”处理器。 |
| 2643 | `NE滑块_绑定失去焦点` | `NE滑块_绑定失去焦点(控件, 处理器)` | bool | 为NE滑块实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2644 | `NE滑块_解绑失去焦点` | `NE滑块_解绑失去焦点(控件)` | bool | 移除NE滑块实例由代码绑定的“失去焦点”处理器。 |
| 2645 | `控件_创建NE选择器` | `控件_创建NE选择器(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE选择器 | 在当前 new_emoji 窗口运行时创建NE选择器，窗口拥有元素生命周期。 |
| 2646 | `通过标记文本获取NE选择器` | `通过标记文本获取NE选择器(标记文本)` | NE选择器 | 按区分大小写的非空文本标记查找NE选择器，找不到时返回无效引用。 |
| 2647 | `通过标记整数获取NE选择器` | `通过标记整数获取NE选择器(标记整数)` | NE选择器 | 按有符号 32 位整数标记查找NE选择器，找不到时返回无效引用。 |
| 2648 | `NE选择器_绑定选择变化` | `NE选择器_绑定选择变化(控件, 处理器)` | bool | 为NE选择器实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2649 | `NE选择器_解绑选择变化` | `NE选择器_解绑选择变化(控件)` | bool | 移除NE选择器实例由代码绑定的“选择变化”处理器。 |
| 2650 | `NE选择器_绑定鼠标进入` | `NE选择器_绑定鼠标进入(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2651 | `NE选择器_解绑鼠标进入` | `NE选择器_解绑鼠标进入(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标进入”处理器。 |
| 2652 | `NE选择器_绑定鼠标离开` | `NE选择器_绑定鼠标离开(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2653 | `NE选择器_解绑鼠标离开` | `NE选择器_解绑鼠标离开(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标离开”处理器。 |
| 2654 | `NE选择器_绑定鼠标按下` | `NE选择器_绑定鼠标按下(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2655 | `NE选择器_解绑鼠标按下` | `NE选择器_解绑鼠标按下(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标按下”处理器。 |
| 2656 | `NE选择器_绑定鼠标抬起` | `NE选择器_绑定鼠标抬起(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2657 | `NE选择器_解绑鼠标抬起` | `NE选择器_解绑鼠标抬起(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标抬起”处理器。 |
| 2658 | `NE选择器_绑定鼠标双击` | `NE选择器_绑定鼠标双击(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2659 | `NE选择器_解绑鼠标双击` | `NE选择器_解绑鼠标双击(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标双击”处理器。 |
| 2660 | `NE选择器_绑定鼠标移动` | `NE选择器_绑定鼠标移动(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2661 | `NE选择器_解绑鼠标移动` | `NE选择器_解绑鼠标移动(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标移动”处理器。 |
| 2662 | `NE选择器_绑定鼠标滚轮` | `NE选择器_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE选择器实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2663 | `NE选择器_解绑鼠标滚轮` | `NE选择器_解绑鼠标滚轮(控件)` | bool | 移除NE选择器实例由代码绑定的“鼠标滚轮”处理器。 |
| 2664 | `NE选择器_绑定获得焦点` | `NE选择器_绑定获得焦点(控件, 处理器)` | bool | 为NE选择器实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2665 | `NE选择器_解绑获得焦点` | `NE选择器_解绑获得焦点(控件)` | bool | 移除NE选择器实例由代码绑定的“获得焦点”处理器。 |
| 2666 | `NE选择器_绑定失去焦点` | `NE选择器_绑定失去焦点(控件, 处理器)` | bool | 为NE选择器实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2667 | `NE选择器_解绑失去焦点` | `NE选择器_解绑失去焦点(控件)` | bool | 移除NE选择器实例由代码绑定的“失去焦点”处理器。 |
| 2668 | `控件_创建NE虚拟选择器` | `控件_创建NE虚拟选择器(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE虚拟选择器 | 在当前 new_emoji 窗口运行时创建NE虚拟选择器，窗口拥有元素生命周期。 |
| 2669 | `通过标记文本获取NE虚拟选择器` | `通过标记文本获取NE虚拟选择器(标记文本)` | NE虚拟选择器 | 按区分大小写的非空文本标记查找NE虚拟选择器，找不到时返回无效引用。 |
| 2670 | `通过标记整数获取NE虚拟选择器` | `通过标记整数获取NE虚拟选择器(标记整数)` | NE虚拟选择器 | 按有符号 32 位整数标记查找NE虚拟选择器，找不到时返回无效引用。 |
| 2671 | `NE虚拟选择器_绑定选择变化` | `NE虚拟选择器_绑定选择变化(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2672 | `NE虚拟选择器_解绑选择变化` | `NE虚拟选择器_解绑选择变化(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“选择变化”处理器。 |
| 2673 | `NE虚拟选择器_绑定鼠标进入` | `NE虚拟选择器_绑定鼠标进入(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2674 | `NE虚拟选择器_解绑鼠标进入` | `NE虚拟选择器_解绑鼠标进入(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标进入”处理器。 |
| 2675 | `NE虚拟选择器_绑定鼠标离开` | `NE虚拟选择器_绑定鼠标离开(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2676 | `NE虚拟选择器_解绑鼠标离开` | `NE虚拟选择器_解绑鼠标离开(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标离开”处理器。 |
| 2677 | `NE虚拟选择器_绑定鼠标按下` | `NE虚拟选择器_绑定鼠标按下(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2678 | `NE虚拟选择器_解绑鼠标按下` | `NE虚拟选择器_解绑鼠标按下(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标按下”处理器。 |
| 2679 | `NE虚拟选择器_绑定鼠标抬起` | `NE虚拟选择器_绑定鼠标抬起(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2680 | `NE虚拟选择器_解绑鼠标抬起` | `NE虚拟选择器_解绑鼠标抬起(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标抬起”处理器。 |
| 2681 | `NE虚拟选择器_绑定鼠标双击` | `NE虚拟选择器_绑定鼠标双击(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2682 | `NE虚拟选择器_解绑鼠标双击` | `NE虚拟选择器_解绑鼠标双击(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标双击”处理器。 |
| 2683 | `NE虚拟选择器_绑定鼠标移动` | `NE虚拟选择器_绑定鼠标移动(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2684 | `NE虚拟选择器_解绑鼠标移动` | `NE虚拟选择器_解绑鼠标移动(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标移动”处理器。 |
| 2685 | `NE虚拟选择器_绑定鼠标滚轮` | `NE虚拟选择器_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2686 | `NE虚拟选择器_解绑鼠标滚轮` | `NE虚拟选择器_解绑鼠标滚轮(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“鼠标滚轮”处理器。 |
| 2687 | `NE虚拟选择器_绑定获得焦点` | `NE虚拟选择器_绑定获得焦点(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2688 | `NE虚拟选择器_解绑获得焦点` | `NE虚拟选择器_解绑获得焦点(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“获得焦点”处理器。 |
| 2689 | `NE虚拟选择器_绑定失去焦点` | `NE虚拟选择器_绑定失去焦点(控件, 处理器)` | bool | 为NE虚拟选择器实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2690 | `NE虚拟选择器_解绑失去焦点` | `NE虚拟选择器_解绑失去焦点(控件)` | bool | 移除NE虚拟选择器实例由代码绑定的“失去焦点”处理器。 |
| 2691 | `控件_创建NE数字输入框` | `控件_创建NE数字输入框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE数字输入框 | 在当前 new_emoji 窗口运行时创建NE数字输入框，窗口拥有元素生命周期。 |
| 2692 | `通过标记文本获取NE数字输入框` | `通过标记文本获取NE数字输入框(标记文本)` | NE数字输入框 | 按区分大小写的非空文本标记查找NE数字输入框，找不到时返回无效引用。 |
| 2693 | `通过标记整数获取NE数字输入框` | `通过标记整数获取NE数字输入框(标记整数)` | NE数字输入框 | 按有符号 32 位整数标记查找NE数字输入框，找不到时返回无效引用。 |
| 2694 | `NE数字输入框_绑定数值变化` | `NE数字输入框_绑定数值变化(控件, 处理器)` | bool | 为NE数字输入框实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2695 | `NE数字输入框_解绑数值变化` | `NE数字输入框_解绑数值变化(控件)` | bool | 移除NE数字输入框实例由代码绑定的“数值变化”处理器。 |
| 2696 | `NE数字输入框_绑定鼠标进入` | `NE数字输入框_绑定鼠标进入(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2697 | `NE数字输入框_解绑鼠标进入` | `NE数字输入框_解绑鼠标进入(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标进入”处理器。 |
| 2698 | `NE数字输入框_绑定鼠标离开` | `NE数字输入框_绑定鼠标离开(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2699 | `NE数字输入框_解绑鼠标离开` | `NE数字输入框_解绑鼠标离开(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标离开”处理器。 |
| 2700 | `NE数字输入框_绑定鼠标按下` | `NE数字输入框_绑定鼠标按下(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2701 | `NE数字输入框_解绑鼠标按下` | `NE数字输入框_解绑鼠标按下(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标按下”处理器。 |
| 2702 | `NE数字输入框_绑定鼠标抬起` | `NE数字输入框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2703 | `NE数字输入框_解绑鼠标抬起` | `NE数字输入框_解绑鼠标抬起(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标抬起”处理器。 |
| 2704 | `NE数字输入框_绑定鼠标双击` | `NE数字输入框_绑定鼠标双击(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2705 | `NE数字输入框_解绑鼠标双击` | `NE数字输入框_解绑鼠标双击(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标双击”处理器。 |
| 2706 | `NE数字输入框_绑定鼠标移动` | `NE数字输入框_绑定鼠标移动(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2707 | `NE数字输入框_解绑鼠标移动` | `NE数字输入框_解绑鼠标移动(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标移动”处理器。 |
| 2708 | `NE数字输入框_绑定鼠标滚轮` | `NE数字输入框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE数字输入框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2709 | `NE数字输入框_解绑鼠标滚轮` | `NE数字输入框_解绑鼠标滚轮(控件)` | bool | 移除NE数字输入框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2710 | `NE数字输入框_绑定获得焦点` | `NE数字输入框_绑定获得焦点(控件, 处理器)` | bool | 为NE数字输入框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2711 | `NE数字输入框_解绑获得焦点` | `NE数字输入框_解绑获得焦点(控件)` | bool | 移除NE数字输入框实例由代码绑定的“获得焦点”处理器。 |
| 2712 | `NE数字输入框_绑定失去焦点` | `NE数字输入框_绑定失去焦点(控件, 处理器)` | bool | 为NE数字输入框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2713 | `NE数字输入框_解绑失去焦点` | `NE数字输入框_解绑失去焦点(控件)` | bool | 移除NE数字输入框实例由代码绑定的“失去焦点”处理器。 |
| 2714 | `控件_创建NE标签输入框` | `控件_创建NE标签输入框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE标签输入框 | 在当前 new_emoji 窗口运行时创建NE标签输入框，窗口拥有元素生命周期。 |
| 2715 | `通过标记文本获取NE标签输入框` | `通过标记文本获取NE标签输入框(标记文本)` | NE标签输入框 | 按区分大小写的非空文本标记查找NE标签输入框，找不到时返回无效引用。 |
| 2716 | `通过标记整数获取NE标签输入框` | `通过标记整数获取NE标签输入框(标记整数)` | NE标签输入框 | 按有符号 32 位整数标记查找NE标签输入框，找不到时返回无效引用。 |
| 2717 | `NE标签输入框_绑定文本变化` | `NE标签输入框_绑定文本变化(控件, 处理器)` | bool | 为NE标签输入框实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 2718 | `NE标签输入框_解绑文本变化` | `NE标签输入框_解绑文本变化(控件)` | bool | 移除NE标签输入框实例由代码绑定的“文本变化”处理器。 |
| 2719 | `NE标签输入框_绑定鼠标进入` | `NE标签输入框_绑定鼠标进入(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2720 | `NE标签输入框_解绑鼠标进入` | `NE标签输入框_解绑鼠标进入(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标进入”处理器。 |
| 2721 | `NE标签输入框_绑定鼠标离开` | `NE标签输入框_绑定鼠标离开(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2722 | `NE标签输入框_解绑鼠标离开` | `NE标签输入框_解绑鼠标离开(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标离开”处理器。 |
| 2723 | `NE标签输入框_绑定鼠标按下` | `NE标签输入框_绑定鼠标按下(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2724 | `NE标签输入框_解绑鼠标按下` | `NE标签输入框_解绑鼠标按下(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标按下”处理器。 |
| 2725 | `NE标签输入框_绑定鼠标抬起` | `NE标签输入框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2726 | `NE标签输入框_解绑鼠标抬起` | `NE标签输入框_解绑鼠标抬起(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标抬起”处理器。 |
| 2727 | `NE标签输入框_绑定鼠标双击` | `NE标签输入框_绑定鼠标双击(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2728 | `NE标签输入框_解绑鼠标双击` | `NE标签输入框_解绑鼠标双击(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标双击”处理器。 |
| 2729 | `NE标签输入框_绑定鼠标移动` | `NE标签输入框_绑定鼠标移动(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2730 | `NE标签输入框_解绑鼠标移动` | `NE标签输入框_解绑鼠标移动(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标移动”处理器。 |
| 2731 | `NE标签输入框_绑定鼠标滚轮` | `NE标签输入框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE标签输入框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2732 | `NE标签输入框_解绑鼠标滚轮` | `NE标签输入框_解绑鼠标滚轮(控件)` | bool | 移除NE标签输入框实例由代码绑定的“鼠标滚轮”处理器。 |
| 2733 | `NE标签输入框_绑定获得焦点` | `NE标签输入框_绑定获得焦点(控件, 处理器)` | bool | 为NE标签输入框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2734 | `NE标签输入框_解绑获得焦点` | `NE标签输入框_解绑获得焦点(控件)` | bool | 移除NE标签输入框实例由代码绑定的“获得焦点”处理器。 |
| 2735 | `NE标签输入框_绑定失去焦点` | `NE标签输入框_绑定失去焦点(控件, 处理器)` | bool | 为NE标签输入框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2736 | `NE标签输入框_解绑失去焦点` | `NE标签输入框_解绑失去焦点(控件)` | bool | 移除NE标签输入框实例由代码绑定的“失去焦点”处理器。 |
| 2737 | `控件_创建NE组合输入` | `控件_创建NE组合输入(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE组合输入 | 在当前 new_emoji 窗口运行时创建NE组合输入，窗口拥有元素生命周期。 |
| 2738 | `通过标记文本获取NE组合输入` | `通过标记文本获取NE组合输入(标记文本)` | NE组合输入 | 按区分大小写的非空文本标记查找NE组合输入，找不到时返回无效引用。 |
| 2739 | `通过标记整数获取NE组合输入` | `通过标记整数获取NE组合输入(标记整数)` | NE组合输入 | 按有符号 32 位整数标记查找NE组合输入，找不到时返回无效引用。 |
| 2740 | `NE组合输入_绑定文本变化` | `NE组合输入_绑定文本变化(控件, 处理器)` | bool | 为NE组合输入实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 2741 | `NE组合输入_解绑文本变化` | `NE组合输入_解绑文本变化(控件)` | bool | 移除NE组合输入实例由代码绑定的“文本变化”处理器。 |
| 2742 | `NE组合输入_绑定鼠标进入` | `NE组合输入_绑定鼠标进入(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2743 | `NE组合输入_解绑鼠标进入` | `NE组合输入_解绑鼠标进入(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标进入”处理器。 |
| 2744 | `NE组合输入_绑定鼠标离开` | `NE组合输入_绑定鼠标离开(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2745 | `NE组合输入_解绑鼠标离开` | `NE组合输入_解绑鼠标离开(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标离开”处理器。 |
| 2746 | `NE组合输入_绑定鼠标按下` | `NE组合输入_绑定鼠标按下(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2747 | `NE组合输入_解绑鼠标按下` | `NE组合输入_解绑鼠标按下(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标按下”处理器。 |
| 2748 | `NE组合输入_绑定鼠标抬起` | `NE组合输入_绑定鼠标抬起(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2749 | `NE组合输入_解绑鼠标抬起` | `NE组合输入_解绑鼠标抬起(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标抬起”处理器。 |
| 2750 | `NE组合输入_绑定鼠标双击` | `NE组合输入_绑定鼠标双击(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2751 | `NE组合输入_解绑鼠标双击` | `NE组合输入_解绑鼠标双击(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标双击”处理器。 |
| 2752 | `NE组合输入_绑定鼠标移动` | `NE组合输入_绑定鼠标移动(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2753 | `NE组合输入_解绑鼠标移动` | `NE组合输入_解绑鼠标移动(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标移动”处理器。 |
| 2754 | `NE组合输入_绑定鼠标滚轮` | `NE组合输入_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE组合输入实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2755 | `NE组合输入_解绑鼠标滚轮` | `NE组合输入_解绑鼠标滚轮(控件)` | bool | 移除NE组合输入实例由代码绑定的“鼠标滚轮”处理器。 |
| 2756 | `NE组合输入_绑定获得焦点` | `NE组合输入_绑定获得焦点(控件, 处理器)` | bool | 为NE组合输入实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2757 | `NE组合输入_解绑获得焦点` | `NE组合输入_解绑获得焦点(控件)` | bool | 移除NE组合输入实例由代码绑定的“获得焦点”处理器。 |
| 2758 | `NE组合输入_绑定失去焦点` | `NE组合输入_绑定失去焦点(控件, 处理器)` | bool | 为NE组合输入实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2759 | `NE组合输入_解绑失去焦点` | `NE组合输入_解绑失去焦点(控件)` | bool | 移除NE组合输入实例由代码绑定的“失去焦点”处理器。 |
| 2760 | `控件_创建NE评分` | `控件_创建NE评分(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE评分 | 在当前 new_emoji 窗口运行时创建NE评分，窗口拥有元素生命周期。 |
| 2761 | `通过标记文本获取NE评分` | `通过标记文本获取NE评分(标记文本)` | NE评分 | 按区分大小写的非空文本标记查找NE评分，找不到时返回无效引用。 |
| 2762 | `通过标记整数获取NE评分` | `通过标记整数获取NE评分(标记整数)` | NE评分 | 按有符号 32 位整数标记查找NE评分，找不到时返回无效引用。 |
| 2763 | `NE评分_绑定数值变化` | `NE评分_绑定数值变化(控件, 处理器)` | bool | 为NE评分实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2764 | `NE评分_解绑数值变化` | `NE评分_解绑数值变化(控件)` | bool | 移除NE评分实例由代码绑定的“数值变化”处理器。 |
| 2765 | `NE评分_绑定鼠标进入` | `NE评分_绑定鼠标进入(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2766 | `NE评分_解绑鼠标进入` | `NE评分_解绑鼠标进入(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标进入”处理器。 |
| 2767 | `NE评分_绑定鼠标离开` | `NE评分_绑定鼠标离开(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2768 | `NE评分_解绑鼠标离开` | `NE评分_解绑鼠标离开(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标离开”处理器。 |
| 2769 | `NE评分_绑定鼠标按下` | `NE评分_绑定鼠标按下(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2770 | `NE评分_解绑鼠标按下` | `NE评分_解绑鼠标按下(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标按下”处理器。 |
| 2771 | `NE评分_绑定鼠标抬起` | `NE评分_绑定鼠标抬起(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2772 | `NE评分_解绑鼠标抬起` | `NE评分_解绑鼠标抬起(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标抬起”处理器。 |
| 2773 | `NE评分_绑定鼠标双击` | `NE评分_绑定鼠标双击(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2774 | `NE评分_解绑鼠标双击` | `NE评分_解绑鼠标双击(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标双击”处理器。 |
| 2775 | `NE评分_绑定鼠标移动` | `NE评分_绑定鼠标移动(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2776 | `NE评分_解绑鼠标移动` | `NE评分_解绑鼠标移动(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标移动”处理器。 |
| 2777 | `NE评分_绑定鼠标滚轮` | `NE评分_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE评分实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2778 | `NE评分_解绑鼠标滚轮` | `NE评分_解绑鼠标滚轮(控件)` | bool | 移除NE评分实例由代码绑定的“鼠标滚轮”处理器。 |
| 2779 | `NE评分_绑定获得焦点` | `NE评分_绑定获得焦点(控件, 处理器)` | bool | 为NE评分实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2780 | `NE评分_解绑获得焦点` | `NE评分_解绑获得焦点(控件)` | bool | 移除NE评分实例由代码绑定的“获得焦点”处理器。 |
| 2781 | `NE评分_绑定失去焦点` | `NE评分_绑定失去焦点(控件, 处理器)` | bool | 为NE评分实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2782 | `NE评分_解绑失去焦点` | `NE评分_解绑失去焦点(控件)` | bool | 移除NE评分实例由代码绑定的“失去焦点”处理器。 |
| 2783 | `控件_创建NE颜色选择器` | `控件_创建NE颜色选择器(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE颜色选择器 | 在当前 new_emoji 窗口运行时创建NE颜色选择器，窗口拥有元素生命周期。 |
| 2784 | `通过标记文本获取NE颜色选择器` | `通过标记文本获取NE颜色选择器(标记文本)` | NE颜色选择器 | 按区分大小写的非空文本标记查找NE颜色选择器，找不到时返回无效引用。 |
| 2785 | `通过标记整数获取NE颜色选择器` | `通过标记整数获取NE颜色选择器(标记整数)` | NE颜色选择器 | 按有符号 32 位整数标记查找NE颜色选择器，找不到时返回无效引用。 |
| 2786 | `NE颜色选择器_绑定数值变化` | `NE颜色选择器_绑定数值变化(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2787 | `NE颜色选择器_解绑数值变化` | `NE颜色选择器_解绑数值变化(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“数值变化”处理器。 |
| 2788 | `NE颜色选择器_绑定鼠标进入` | `NE颜色选择器_绑定鼠标进入(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2789 | `NE颜色选择器_解绑鼠标进入` | `NE颜色选择器_解绑鼠标进入(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标进入”处理器。 |
| 2790 | `NE颜色选择器_绑定鼠标离开` | `NE颜色选择器_绑定鼠标离开(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2791 | `NE颜色选择器_解绑鼠标离开` | `NE颜色选择器_解绑鼠标离开(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标离开”处理器。 |
| 2792 | `NE颜色选择器_绑定鼠标按下` | `NE颜色选择器_绑定鼠标按下(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2793 | `NE颜色选择器_解绑鼠标按下` | `NE颜色选择器_解绑鼠标按下(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标按下”处理器。 |
| 2794 | `NE颜色选择器_绑定鼠标抬起` | `NE颜色选择器_绑定鼠标抬起(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2795 | `NE颜色选择器_解绑鼠标抬起` | `NE颜色选择器_解绑鼠标抬起(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标抬起”处理器。 |
| 2796 | `NE颜色选择器_绑定鼠标双击` | `NE颜色选择器_绑定鼠标双击(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2797 | `NE颜色选择器_解绑鼠标双击` | `NE颜色选择器_解绑鼠标双击(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标双击”处理器。 |
| 2798 | `NE颜色选择器_绑定鼠标移动` | `NE颜色选择器_绑定鼠标移动(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2799 | `NE颜色选择器_解绑鼠标移动` | `NE颜色选择器_解绑鼠标移动(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标移动”处理器。 |
| 2800 | `NE颜色选择器_绑定鼠标滚轮` | `NE颜色选择器_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2801 | `NE颜色选择器_解绑鼠标滚轮` | `NE颜色选择器_解绑鼠标滚轮(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“鼠标滚轮”处理器。 |
| 2802 | `NE颜色选择器_绑定获得焦点` | `NE颜色选择器_绑定获得焦点(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2803 | `NE颜色选择器_解绑获得焦点` | `NE颜色选择器_解绑获得焦点(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“获得焦点”处理器。 |
| 2804 | `NE颜色选择器_绑定失去焦点` | `NE颜色选择器_绑定失去焦点(控件, 处理器)` | bool | 为NE颜色选择器实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2805 | `NE颜色选择器_解绑失去焦点` | `NE颜色选择器_解绑失去焦点(控件)` | bool | 移除NE颜色选择器实例由代码绑定的“失去焦点”处理器。 |
| 2806 | `控件_创建NE标签` | `控件_创建NE标签(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE标签 | 在当前 new_emoji 窗口运行时创建NE标签，窗口拥有元素生命周期。 |
| 2807 | `通过标记文本获取NE标签` | `通过标记文本获取NE标签(标记文本)` | NE标签 | 按区分大小写的非空文本标记查找NE标签，找不到时返回无效引用。 |
| 2808 | `通过标记整数获取NE标签` | `通过标记整数获取NE标签(标记整数)` | NE标签 | 按有符号 32 位整数标记查找NE标签，找不到时返回无效引用。 |
| 2809 | `NE标签_绑定关闭` | `NE标签_绑定关闭(控件, 处理器)` | bool | 为NE标签实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2810 | `NE标签_解绑关闭` | `NE标签_解绑关闭(控件)` | bool | 移除NE标签实例由代码绑定的“关闭”处理器。 |
| 2811 | `NE标签_绑定鼠标进入` | `NE标签_绑定鼠标进入(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2812 | `NE标签_解绑鼠标进入` | `NE标签_解绑鼠标进入(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标进入”处理器。 |
| 2813 | `NE标签_绑定鼠标离开` | `NE标签_绑定鼠标离开(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2814 | `NE标签_解绑鼠标离开` | `NE标签_解绑鼠标离开(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标离开”处理器。 |
| 2815 | `NE标签_绑定鼠标按下` | `NE标签_绑定鼠标按下(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2816 | `NE标签_解绑鼠标按下` | `NE标签_解绑鼠标按下(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标按下”处理器。 |
| 2817 | `NE标签_绑定鼠标抬起` | `NE标签_绑定鼠标抬起(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2818 | `NE标签_解绑鼠标抬起` | `NE标签_解绑鼠标抬起(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标抬起”处理器。 |
| 2819 | `NE标签_绑定鼠标双击` | `NE标签_绑定鼠标双击(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2820 | `NE标签_解绑鼠标双击` | `NE标签_解绑鼠标双击(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标双击”处理器。 |
| 2821 | `NE标签_绑定鼠标移动` | `NE标签_绑定鼠标移动(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2822 | `NE标签_解绑鼠标移动` | `NE标签_解绑鼠标移动(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标移动”处理器。 |
| 2823 | `NE标签_绑定鼠标滚轮` | `NE标签_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE标签实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2824 | `NE标签_解绑鼠标滚轮` | `NE标签_解绑鼠标滚轮(控件)` | bool | 移除NE标签实例由代码绑定的“鼠标滚轮”处理器。 |
| 2825 | `NE标签_绑定获得焦点` | `NE标签_绑定获得焦点(控件, 处理器)` | bool | 为NE标签实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2826 | `NE标签_解绑获得焦点` | `NE标签_解绑获得焦点(控件)` | bool | 移除NE标签实例由代码绑定的“获得焦点”处理器。 |
| 2827 | `NE标签_绑定失去焦点` | `NE标签_绑定失去焦点(控件, 处理器)` | bool | 为NE标签实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2828 | `NE标签_解绑失去焦点` | `NE标签_解绑失去焦点(控件)` | bool | 移除NE标签实例由代码绑定的“失去焦点”处理器。 |
| 2829 | `控件_创建NE徽标` | `控件_创建NE徽标(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE徽标 | 在当前 new_emoji 窗口运行时创建NE徽标，窗口拥有元素生命周期。 |
| 2830 | `通过标记文本获取NE徽标` | `通过标记文本获取NE徽标(标记文本)` | NE徽标 | 按区分大小写的非空文本标记查找NE徽标，找不到时返回无效引用。 |
| 2831 | `通过标记整数获取NE徽标` | `通过标记整数获取NE徽标(标记整数)` | NE徽标 | 按有符号 32 位整数标记查找NE徽标，找不到时返回无效引用。 |
| 2832 | `NE徽标_绑定鼠标进入` | `NE徽标_绑定鼠标进入(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2833 | `NE徽标_解绑鼠标进入` | `NE徽标_解绑鼠标进入(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标进入”处理器。 |
| 2834 | `NE徽标_绑定鼠标离开` | `NE徽标_绑定鼠标离开(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2835 | `NE徽标_解绑鼠标离开` | `NE徽标_解绑鼠标离开(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标离开”处理器。 |
| 2836 | `NE徽标_绑定鼠标按下` | `NE徽标_绑定鼠标按下(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2837 | `NE徽标_解绑鼠标按下` | `NE徽标_解绑鼠标按下(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标按下”处理器。 |
| 2838 | `NE徽标_绑定鼠标抬起` | `NE徽标_绑定鼠标抬起(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2839 | `NE徽标_解绑鼠标抬起` | `NE徽标_解绑鼠标抬起(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标抬起”处理器。 |
| 2840 | `NE徽标_绑定鼠标双击` | `NE徽标_绑定鼠标双击(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2841 | `NE徽标_解绑鼠标双击` | `NE徽标_解绑鼠标双击(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标双击”处理器。 |
| 2842 | `NE徽标_绑定鼠标移动` | `NE徽标_绑定鼠标移动(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2843 | `NE徽标_解绑鼠标移动` | `NE徽标_解绑鼠标移动(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标移动”处理器。 |
| 2844 | `NE徽标_绑定鼠标滚轮` | `NE徽标_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE徽标实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2845 | `NE徽标_解绑鼠标滚轮` | `NE徽标_解绑鼠标滚轮(控件)` | bool | 移除NE徽标实例由代码绑定的“鼠标滚轮”处理器。 |
| 2846 | `NE徽标_绑定获得焦点` | `NE徽标_绑定获得焦点(控件, 处理器)` | bool | 为NE徽标实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2847 | `NE徽标_解绑获得焦点` | `NE徽标_解绑获得焦点(控件)` | bool | 移除NE徽标实例由代码绑定的“获得焦点”处理器。 |
| 2848 | `NE徽标_绑定失去焦点` | `NE徽标_绑定失去焦点(控件, 处理器)` | bool | 为NE徽标实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2849 | `NE徽标_解绑失去焦点` | `NE徽标_解绑失去焦点(控件)` | bool | 移除NE徽标实例由代码绑定的“失去焦点”处理器。 |
| 2850 | `控件_创建NE进度条` | `控件_创建NE进度条(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE进度条 | 在当前 new_emoji 窗口运行时创建NE进度条，窗口拥有元素生命周期。 |
| 2851 | `通过标记文本获取NE进度条` | `通过标记文本获取NE进度条(标记文本)` | NE进度条 | 按区分大小写的非空文本标记查找NE进度条，找不到时返回无效引用。 |
| 2852 | `通过标记整数获取NE进度条` | `通过标记整数获取NE进度条(标记整数)` | NE进度条 | 按有符号 32 位整数标记查找NE进度条，找不到时返回无效引用。 |
| 2853 | `NE进度条_绑定鼠标进入` | `NE进度条_绑定鼠标进入(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2854 | `NE进度条_解绑鼠标进入` | `NE进度条_解绑鼠标进入(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标进入”处理器。 |
| 2855 | `NE进度条_绑定鼠标离开` | `NE进度条_绑定鼠标离开(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2856 | `NE进度条_解绑鼠标离开` | `NE进度条_解绑鼠标离开(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标离开”处理器。 |
| 2857 | `NE进度条_绑定鼠标按下` | `NE进度条_绑定鼠标按下(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2858 | `NE进度条_解绑鼠标按下` | `NE进度条_解绑鼠标按下(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标按下”处理器。 |
| 2859 | `NE进度条_绑定鼠标抬起` | `NE进度条_绑定鼠标抬起(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2860 | `NE进度条_解绑鼠标抬起` | `NE进度条_解绑鼠标抬起(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标抬起”处理器。 |
| 2861 | `NE进度条_绑定鼠标双击` | `NE进度条_绑定鼠标双击(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2862 | `NE进度条_解绑鼠标双击` | `NE进度条_解绑鼠标双击(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标双击”处理器。 |
| 2863 | `NE进度条_绑定鼠标移动` | `NE进度条_绑定鼠标移动(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2864 | `NE进度条_解绑鼠标移动` | `NE进度条_解绑鼠标移动(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标移动”处理器。 |
| 2865 | `NE进度条_绑定鼠标滚轮` | `NE进度条_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE进度条实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2866 | `NE进度条_解绑鼠标滚轮` | `NE进度条_解绑鼠标滚轮(控件)` | bool | 移除NE进度条实例由代码绑定的“鼠标滚轮”处理器。 |
| 2867 | `NE进度条_绑定获得焦点` | `NE进度条_绑定获得焦点(控件, 处理器)` | bool | 为NE进度条实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2868 | `NE进度条_解绑获得焦点` | `NE进度条_解绑获得焦点(控件)` | bool | 移除NE进度条实例由代码绑定的“获得焦点”处理器。 |
| 2869 | `NE进度条_绑定失去焦点` | `NE进度条_绑定失去焦点(控件, 处理器)` | bool | 为NE进度条实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2870 | `NE进度条_解绑失去焦点` | `NE进度条_解绑失去焦点(控件)` | bool | 移除NE进度条实例由代码绑定的“失去焦点”处理器。 |
| 2871 | `控件_创建NE头像` | `控件_创建NE头像(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE头像 | 在当前 new_emoji 窗口运行时创建NE头像，窗口拥有元素生命周期。 |
| 2872 | `通过标记文本获取NE头像` | `通过标记文本获取NE头像(标记文本)` | NE头像 | 按区分大小写的非空文本标记查找NE头像，找不到时返回无效引用。 |
| 2873 | `通过标记整数获取NE头像` | `通过标记整数获取NE头像(标记整数)` | NE头像 | 按有符号 32 位整数标记查找NE头像，找不到时返回无效引用。 |
| 2874 | `NE头像_绑定鼠标进入` | `NE头像_绑定鼠标进入(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2875 | `NE头像_解绑鼠标进入` | `NE头像_解绑鼠标进入(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标进入”处理器。 |
| 2876 | `NE头像_绑定鼠标离开` | `NE头像_绑定鼠标离开(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2877 | `NE头像_解绑鼠标离开` | `NE头像_解绑鼠标离开(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标离开”处理器。 |
| 2878 | `NE头像_绑定鼠标按下` | `NE头像_绑定鼠标按下(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2879 | `NE头像_解绑鼠标按下` | `NE头像_解绑鼠标按下(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标按下”处理器。 |
| 2880 | `NE头像_绑定鼠标抬起` | `NE头像_绑定鼠标抬起(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2881 | `NE头像_解绑鼠标抬起` | `NE头像_解绑鼠标抬起(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标抬起”处理器。 |
| 2882 | `NE头像_绑定鼠标双击` | `NE头像_绑定鼠标双击(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2883 | `NE头像_解绑鼠标双击` | `NE头像_解绑鼠标双击(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标双击”处理器。 |
| 2884 | `NE头像_绑定鼠标移动` | `NE头像_绑定鼠标移动(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2885 | `NE头像_解绑鼠标移动` | `NE头像_解绑鼠标移动(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标移动”处理器。 |
| 2886 | `NE头像_绑定鼠标滚轮` | `NE头像_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE头像实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2887 | `NE头像_解绑鼠标滚轮` | `NE头像_解绑鼠标滚轮(控件)` | bool | 移除NE头像实例由代码绑定的“鼠标滚轮”处理器。 |
| 2888 | `NE头像_绑定获得焦点` | `NE头像_绑定获得焦点(控件, 处理器)` | bool | 为NE头像实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2889 | `NE头像_解绑获得焦点` | `NE头像_解绑获得焦点(控件)` | bool | 移除NE头像实例由代码绑定的“获得焦点”处理器。 |
| 2890 | `NE头像_绑定失去焦点` | `NE头像_绑定失去焦点(控件, 处理器)` | bool | 为NE头像实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2891 | `NE头像_解绑失去焦点` | `NE头像_解绑失去焦点(控件)` | bool | 移除NE头像实例由代码绑定的“失去焦点”处理器。 |
| 2892 | `控件_创建NE空状态` | `控件_创建NE空状态(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE空状态 | 在当前 new_emoji 窗口运行时创建NE空状态，窗口拥有元素生命周期。 |
| 2893 | `通过标记文本获取NE空状态` | `通过标记文本获取NE空状态(标记文本)` | NE空状态 | 按区分大小写的非空文本标记查找NE空状态，找不到时返回无效引用。 |
| 2894 | `通过标记整数获取NE空状态` | `通过标记整数获取NE空状态(标记整数)` | NE空状态 | 按有符号 32 位整数标记查找NE空状态，找不到时返回无效引用。 |
| 2895 | `NE空状态_绑定鼠标进入` | `NE空状态_绑定鼠标进入(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2896 | `NE空状态_解绑鼠标进入` | `NE空状态_解绑鼠标进入(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标进入”处理器。 |
| 2897 | `NE空状态_绑定鼠标离开` | `NE空状态_绑定鼠标离开(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2898 | `NE空状态_解绑鼠标离开` | `NE空状态_解绑鼠标离开(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标离开”处理器。 |
| 2899 | `NE空状态_绑定鼠标按下` | `NE空状态_绑定鼠标按下(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2900 | `NE空状态_解绑鼠标按下` | `NE空状态_解绑鼠标按下(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标按下”处理器。 |
| 2901 | `NE空状态_绑定鼠标抬起` | `NE空状态_绑定鼠标抬起(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2902 | `NE空状态_解绑鼠标抬起` | `NE空状态_解绑鼠标抬起(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标抬起”处理器。 |
| 2903 | `NE空状态_绑定鼠标双击` | `NE空状态_绑定鼠标双击(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2904 | `NE空状态_解绑鼠标双击` | `NE空状态_解绑鼠标双击(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标双击”处理器。 |
| 2905 | `NE空状态_绑定鼠标移动` | `NE空状态_绑定鼠标移动(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2906 | `NE空状态_解绑鼠标移动` | `NE空状态_解绑鼠标移动(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标移动”处理器。 |
| 2907 | `NE空状态_绑定鼠标滚轮` | `NE空状态_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE空状态实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2908 | `NE空状态_解绑鼠标滚轮` | `NE空状态_解绑鼠标滚轮(控件)` | bool | 移除NE空状态实例由代码绑定的“鼠标滚轮”处理器。 |
| 2909 | `NE空状态_绑定获得焦点` | `NE空状态_绑定获得焦点(控件, 处理器)` | bool | 为NE空状态实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2910 | `NE空状态_解绑获得焦点` | `NE空状态_解绑获得焦点(控件)` | bool | 移除NE空状态实例由代码绑定的“获得焦点”处理器。 |
| 2911 | `NE空状态_绑定失去焦点` | `NE空状态_绑定失去焦点(控件, 处理器)` | bool | 为NE空状态实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2912 | `NE空状态_解绑失去焦点` | `NE空状态_解绑失去焦点(控件)` | bool | 移除NE空状态实例由代码绑定的“失去焦点”处理器。 |
| 2913 | `控件_创建NE警告提示` | `控件_创建NE警告提示(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE警告提示 | 在当前 new_emoji 窗口运行时创建NE警告提示，窗口拥有元素生命周期。 |
| 2914 | `通过标记文本获取NE警告提示` | `通过标记文本获取NE警告提示(标记文本)` | NE警告提示 | 按区分大小写的非空文本标记查找NE警告提示，找不到时返回无效引用。 |
| 2915 | `通过标记整数获取NE警告提示` | `通过标记整数获取NE警告提示(标记整数)` | NE警告提示 | 按有符号 32 位整数标记查找NE警告提示，找不到时返回无效引用。 |
| 2916 | `NE警告提示_绑定关闭` | `NE警告提示_绑定关闭(控件, 处理器)` | bool | 为NE警告提示实例绑定“关闭”处理器，处理器必须使用 &名称。 |
| 2917 | `NE警告提示_解绑关闭` | `NE警告提示_解绑关闭(控件)` | bool | 移除NE警告提示实例由代码绑定的“关闭”处理器。 |
| 2918 | `NE警告提示_绑定鼠标进入` | `NE警告提示_绑定鼠标进入(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2919 | `NE警告提示_解绑鼠标进入` | `NE警告提示_解绑鼠标进入(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标进入”处理器。 |
| 2920 | `NE警告提示_绑定鼠标离开` | `NE警告提示_绑定鼠标离开(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2921 | `NE警告提示_解绑鼠标离开` | `NE警告提示_解绑鼠标离开(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标离开”处理器。 |
| 2922 | `NE警告提示_绑定鼠标按下` | `NE警告提示_绑定鼠标按下(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2923 | `NE警告提示_解绑鼠标按下` | `NE警告提示_解绑鼠标按下(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标按下”处理器。 |
| 2924 | `NE警告提示_绑定鼠标抬起` | `NE警告提示_绑定鼠标抬起(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2925 | `NE警告提示_解绑鼠标抬起` | `NE警告提示_解绑鼠标抬起(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标抬起”处理器。 |
| 2926 | `NE警告提示_绑定鼠标双击` | `NE警告提示_绑定鼠标双击(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2927 | `NE警告提示_解绑鼠标双击` | `NE警告提示_解绑鼠标双击(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标双击”处理器。 |
| 2928 | `NE警告提示_绑定鼠标移动` | `NE警告提示_绑定鼠标移动(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2929 | `NE警告提示_解绑鼠标移动` | `NE警告提示_解绑鼠标移动(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标移动”处理器。 |
| 2930 | `NE警告提示_绑定鼠标滚轮` | `NE警告提示_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE警告提示实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2931 | `NE警告提示_解绑鼠标滚轮` | `NE警告提示_解绑鼠标滚轮(控件)` | bool | 移除NE警告提示实例由代码绑定的“鼠标滚轮”处理器。 |
| 2932 | `NE警告提示_绑定获得焦点` | `NE警告提示_绑定获得焦点(控件, 处理器)` | bool | 为NE警告提示实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2933 | `NE警告提示_解绑获得焦点` | `NE警告提示_解绑获得焦点(控件)` | bool | 移除NE警告提示实例由代码绑定的“获得焦点”处理器。 |
| 2934 | `NE警告提示_绑定失去焦点` | `NE警告提示_绑定失去焦点(控件, 处理器)` | bool | 为NE警告提示实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2935 | `NE警告提示_解绑失去焦点` | `NE警告提示_解绑失去焦点(控件)` | bool | 移除NE警告提示实例由代码绑定的“失去焦点”处理器。 |
| 2936 | `控件_创建NE结果页` | `控件_创建NE结果页(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE结果页 | 在当前 new_emoji 窗口运行时创建NE结果页，窗口拥有元素生命周期。 |
| 2937 | `通过标记文本获取NE结果页` | `通过标记文本获取NE结果页(标记文本)` | NE结果页 | 按区分大小写的非空文本标记查找NE结果页，找不到时返回无效引用。 |
| 2938 | `通过标记整数获取NE结果页` | `通过标记整数获取NE结果页(标记整数)` | NE结果页 | 按有符号 32 位整数标记查找NE结果页，找不到时返回无效引用。 |
| 2939 | `NE结果页_绑定鼠标进入` | `NE结果页_绑定鼠标进入(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2940 | `NE结果页_解绑鼠标进入` | `NE结果页_解绑鼠标进入(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标进入”处理器。 |
| 2941 | `NE结果页_绑定鼠标离开` | `NE结果页_绑定鼠标离开(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2942 | `NE结果页_解绑鼠标离开` | `NE结果页_解绑鼠标离开(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标离开”处理器。 |
| 2943 | `NE结果页_绑定鼠标按下` | `NE结果页_绑定鼠标按下(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2944 | `NE结果页_解绑鼠标按下` | `NE结果页_解绑鼠标按下(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标按下”处理器。 |
| 2945 | `NE结果页_绑定鼠标抬起` | `NE结果页_绑定鼠标抬起(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2946 | `NE结果页_解绑鼠标抬起` | `NE结果页_解绑鼠标抬起(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标抬起”处理器。 |
| 2947 | `NE结果页_绑定鼠标双击` | `NE结果页_绑定鼠标双击(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2948 | `NE结果页_解绑鼠标双击` | `NE结果页_解绑鼠标双击(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标双击”处理器。 |
| 2949 | `NE结果页_绑定鼠标移动` | `NE结果页_绑定鼠标移动(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2950 | `NE结果页_解绑鼠标移动` | `NE结果页_解绑鼠标移动(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标移动”处理器。 |
| 2951 | `NE结果页_绑定鼠标滚轮` | `NE结果页_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE结果页实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2952 | `NE结果页_解绑鼠标滚轮` | `NE结果页_解绑鼠标滚轮(控件)` | bool | 移除NE结果页实例由代码绑定的“鼠标滚轮”处理器。 |
| 2953 | `NE结果页_绑定获得焦点` | `NE结果页_绑定获得焦点(控件, 处理器)` | bool | 为NE结果页实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2954 | `NE结果页_解绑获得焦点` | `NE结果页_解绑获得焦点(控件)` | bool | 移除NE结果页实例由代码绑定的“获得焦点”处理器。 |
| 2955 | `NE结果页_绑定失去焦点` | `NE结果页_绑定失去焦点(控件, 处理器)` | bool | 为NE结果页实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2956 | `NE结果页_解绑失去焦点` | `NE结果页_解绑失去焦点(控件)` | bool | 移除NE结果页实例由代码绑定的“失去焦点”处理器。 |
| 2957 | `控件_创建NE面包屑` | `控件_创建NE面包屑(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE面包屑 | 在当前 new_emoji 窗口运行时创建NE面包屑，窗口拥有元素生命周期。 |
| 2958 | `通过标记文本获取NE面包屑` | `通过标记文本获取NE面包屑(标记文本)` | NE面包屑 | 按区分大小写的非空文本标记查找NE面包屑，找不到时返回无效引用。 |
| 2959 | `通过标记整数获取NE面包屑` | `通过标记整数获取NE面包屑(标记整数)` | NE面包屑 | 按有符号 32 位整数标记查找NE面包屑，找不到时返回无效引用。 |
| 2960 | `NE面包屑_绑定选择变化` | `NE面包屑_绑定选择变化(控件, 处理器)` | bool | 为NE面包屑实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 2961 | `NE面包屑_解绑选择变化` | `NE面包屑_解绑选择变化(控件)` | bool | 移除NE面包屑实例由代码绑定的“选择变化”处理器。 |
| 2962 | `NE面包屑_绑定鼠标进入` | `NE面包屑_绑定鼠标进入(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2963 | `NE面包屑_解绑鼠标进入` | `NE面包屑_解绑鼠标进入(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标进入”处理器。 |
| 2964 | `NE面包屑_绑定鼠标离开` | `NE面包屑_绑定鼠标离开(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2965 | `NE面包屑_解绑鼠标离开` | `NE面包屑_解绑鼠标离开(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标离开”处理器。 |
| 2966 | `NE面包屑_绑定鼠标按下` | `NE面包屑_绑定鼠标按下(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2967 | `NE面包屑_解绑鼠标按下` | `NE面包屑_解绑鼠标按下(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标按下”处理器。 |
| 2968 | `NE面包屑_绑定鼠标抬起` | `NE面包屑_绑定鼠标抬起(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2969 | `NE面包屑_解绑鼠标抬起` | `NE面包屑_解绑鼠标抬起(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标抬起”处理器。 |
| 2970 | `NE面包屑_绑定鼠标双击` | `NE面包屑_绑定鼠标双击(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2971 | `NE面包屑_解绑鼠标双击` | `NE面包屑_解绑鼠标双击(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标双击”处理器。 |
| 2972 | `NE面包屑_绑定鼠标移动` | `NE面包屑_绑定鼠标移动(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2973 | `NE面包屑_解绑鼠标移动` | `NE面包屑_解绑鼠标移动(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标移动”处理器。 |
| 2974 | `NE面包屑_绑定鼠标滚轮` | `NE面包屑_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE面包屑实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2975 | `NE面包屑_解绑鼠标滚轮` | `NE面包屑_解绑鼠标滚轮(控件)` | bool | 移除NE面包屑实例由代码绑定的“鼠标滚轮”处理器。 |
| 2976 | `NE面包屑_绑定获得焦点` | `NE面包屑_绑定获得焦点(控件, 处理器)` | bool | 为NE面包屑实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 2977 | `NE面包屑_解绑获得焦点` | `NE面包屑_解绑获得焦点(控件)` | bool | 移除NE面包屑实例由代码绑定的“获得焦点”处理器。 |
| 2978 | `NE面包屑_绑定失去焦点` | `NE面包屑_绑定失去焦点(控件, 处理器)` | bool | 为NE面包屑实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 2979 | `NE面包屑_解绑失去焦点` | `NE面包屑_解绑失去焦点(控件)` | bool | 移除NE面包屑实例由代码绑定的“失去焦点”处理器。 |
| 2980 | `控件_创建NE分页` | `控件_创建NE分页(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE分页 | 在当前 new_emoji 窗口运行时创建NE分页，窗口拥有元素生命周期。 |
| 2981 | `通过标记文本获取NE分页` | `通过标记文本获取NE分页(标记文本)` | NE分页 | 按区分大小写的非空文本标记查找NE分页，找不到时返回无效引用。 |
| 2982 | `通过标记整数获取NE分页` | `通过标记整数获取NE分页(标记整数)` | NE分页 | 按有符号 32 位整数标记查找NE分页，找不到时返回无效引用。 |
| 2983 | `NE分页_绑定数值变化` | `NE分页_绑定数值变化(控件, 处理器)` | bool | 为NE分页实例绑定“数值变化”处理器，处理器必须使用 &名称。 |
| 2984 | `NE分页_解绑数值变化` | `NE分页_解绑数值变化(控件)` | bool | 移除NE分页实例由代码绑定的“数值变化”处理器。 |
| 2985 | `NE分页_绑定鼠标进入` | `NE分页_绑定鼠标进入(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 2986 | `NE分页_解绑鼠标进入` | `NE分页_解绑鼠标进入(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标进入”处理器。 |
| 2987 | `NE分页_绑定鼠标离开` | `NE分页_绑定鼠标离开(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 2988 | `NE分页_解绑鼠标离开` | `NE分页_解绑鼠标离开(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标离开”处理器。 |
| 2989 | `NE分页_绑定鼠标按下` | `NE分页_绑定鼠标按下(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 2990 | `NE分页_解绑鼠标按下` | `NE分页_解绑鼠标按下(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标按下”处理器。 |
| 2991 | `NE分页_绑定鼠标抬起` | `NE分页_绑定鼠标抬起(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 2992 | `NE分页_解绑鼠标抬起` | `NE分页_解绑鼠标抬起(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标抬起”处理器。 |
| 2993 | `NE分页_绑定鼠标双击` | `NE分页_绑定鼠标双击(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 2994 | `NE分页_解绑鼠标双击` | `NE分页_解绑鼠标双击(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标双击”处理器。 |
| 2995 | `NE分页_绑定鼠标移动` | `NE分页_绑定鼠标移动(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 2996 | `NE分页_解绑鼠标移动` | `NE分页_解绑鼠标移动(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标移动”处理器。 |
| 2997 | `NE分页_绑定鼠标滚轮` | `NE分页_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE分页实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 2998 | `NE分页_解绑鼠标滚轮` | `NE分页_解绑鼠标滚轮(控件)` | bool | 移除NE分页实例由代码绑定的“鼠标滚轮”处理器。 |
| 2999 | `NE分页_绑定获得焦点` | `NE分页_绑定获得焦点(控件, 处理器)` | bool | 为NE分页实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3000 | `NE分页_解绑获得焦点` | `NE分页_解绑获得焦点(控件)` | bool | 移除NE分页实例由代码绑定的“获得焦点”处理器。 |
| 3001 | `NE分页_绑定失去焦点` | `NE分页_绑定失去焦点(控件, 处理器)` | bool | 为NE分页实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3002 | `NE分页_解绑失去焦点` | `NE分页_解绑失去焦点(控件)` | bool | 移除NE分页实例由代码绑定的“失去焦点”处理器。 |
| 3003 | `控件_创建NE步骤条` | `控件_创建NE步骤条(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE步骤条 | 在当前 new_emoji 窗口运行时创建NE步骤条，窗口拥有元素生命周期。 |
| 3004 | `通过标记文本获取NE步骤条` | `通过标记文本获取NE步骤条(标记文本)` | NE步骤条 | 按区分大小写的非空文本标记查找NE步骤条，找不到时返回无效引用。 |
| 3005 | `通过标记整数获取NE步骤条` | `通过标记整数获取NE步骤条(标记整数)` | NE步骤条 | 按有符号 32 位整数标记查找NE步骤条，找不到时返回无效引用。 |
| 3006 | `NE步骤条_绑定选择变化` | `NE步骤条_绑定选择变化(控件, 处理器)` | bool | 为NE步骤条实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3007 | `NE步骤条_解绑选择变化` | `NE步骤条_解绑选择变化(控件)` | bool | 移除NE步骤条实例由代码绑定的“选择变化”处理器。 |
| 3008 | `NE步骤条_绑定鼠标进入` | `NE步骤条_绑定鼠标进入(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3009 | `NE步骤条_解绑鼠标进入` | `NE步骤条_解绑鼠标进入(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标进入”处理器。 |
| 3010 | `NE步骤条_绑定鼠标离开` | `NE步骤条_绑定鼠标离开(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3011 | `NE步骤条_解绑鼠标离开` | `NE步骤条_解绑鼠标离开(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标离开”处理器。 |
| 3012 | `NE步骤条_绑定鼠标按下` | `NE步骤条_绑定鼠标按下(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3013 | `NE步骤条_解绑鼠标按下` | `NE步骤条_解绑鼠标按下(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标按下”处理器。 |
| 3014 | `NE步骤条_绑定鼠标抬起` | `NE步骤条_绑定鼠标抬起(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3015 | `NE步骤条_解绑鼠标抬起` | `NE步骤条_解绑鼠标抬起(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标抬起”处理器。 |
| 3016 | `NE步骤条_绑定鼠标双击` | `NE步骤条_绑定鼠标双击(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3017 | `NE步骤条_解绑鼠标双击` | `NE步骤条_解绑鼠标双击(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标双击”处理器。 |
| 3018 | `NE步骤条_绑定鼠标移动` | `NE步骤条_绑定鼠标移动(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3019 | `NE步骤条_解绑鼠标移动` | `NE步骤条_解绑鼠标移动(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标移动”处理器。 |
| 3020 | `NE步骤条_绑定鼠标滚轮` | `NE步骤条_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE步骤条实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3021 | `NE步骤条_解绑鼠标滚轮` | `NE步骤条_解绑鼠标滚轮(控件)` | bool | 移除NE步骤条实例由代码绑定的“鼠标滚轮”处理器。 |
| 3022 | `NE步骤条_绑定获得焦点` | `NE步骤条_绑定获得焦点(控件, 处理器)` | bool | 为NE步骤条实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3023 | `NE步骤条_解绑获得焦点` | `NE步骤条_解绑获得焦点(控件)` | bool | 移除NE步骤条实例由代码绑定的“获得焦点”处理器。 |
| 3024 | `NE步骤条_绑定失去焦点` | `NE步骤条_绑定失去焦点(控件, 处理器)` | bool | 为NE步骤条实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3025 | `NE步骤条_解绑失去焦点` | `NE步骤条_解绑失去焦点(控件)` | bool | 移除NE步骤条实例由代码绑定的“失去焦点”处理器。 |
| 3026 | `控件_创建NE骨架屏` | `控件_创建NE骨架屏(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE骨架屏 | 在当前 new_emoji 窗口运行时创建NE骨架屏，窗口拥有元素生命周期。 |
| 3027 | `通过标记文本获取NE骨架屏` | `通过标记文本获取NE骨架屏(标记文本)` | NE骨架屏 | 按区分大小写的非空文本标记查找NE骨架屏，找不到时返回无效引用。 |
| 3028 | `通过标记整数获取NE骨架屏` | `通过标记整数获取NE骨架屏(标记整数)` | NE骨架屏 | 按有符号 32 位整数标记查找NE骨架屏，找不到时返回无效引用。 |
| 3029 | `NE骨架屏_绑定鼠标进入` | `NE骨架屏_绑定鼠标进入(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3030 | `NE骨架屏_解绑鼠标进入` | `NE骨架屏_解绑鼠标进入(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标进入”处理器。 |
| 3031 | `NE骨架屏_绑定鼠标离开` | `NE骨架屏_绑定鼠标离开(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3032 | `NE骨架屏_解绑鼠标离开` | `NE骨架屏_解绑鼠标离开(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标离开”处理器。 |
| 3033 | `NE骨架屏_绑定鼠标按下` | `NE骨架屏_绑定鼠标按下(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3034 | `NE骨架屏_解绑鼠标按下` | `NE骨架屏_解绑鼠标按下(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标按下”处理器。 |
| 3035 | `NE骨架屏_绑定鼠标抬起` | `NE骨架屏_绑定鼠标抬起(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3036 | `NE骨架屏_解绑鼠标抬起` | `NE骨架屏_解绑鼠标抬起(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标抬起”处理器。 |
| 3037 | `NE骨架屏_绑定鼠标双击` | `NE骨架屏_绑定鼠标双击(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3038 | `NE骨架屏_解绑鼠标双击` | `NE骨架屏_解绑鼠标双击(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标双击”处理器。 |
| 3039 | `NE骨架屏_绑定鼠标移动` | `NE骨架屏_绑定鼠标移动(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3040 | `NE骨架屏_解绑鼠标移动` | `NE骨架屏_解绑鼠标移动(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标移动”处理器。 |
| 3041 | `NE骨架屏_绑定鼠标滚轮` | `NE骨架屏_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE骨架屏实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3042 | `NE骨架屏_解绑鼠标滚轮` | `NE骨架屏_解绑鼠标滚轮(控件)` | bool | 移除NE骨架屏实例由代码绑定的“鼠标滚轮”处理器。 |
| 3043 | `NE骨架屏_绑定获得焦点` | `NE骨架屏_绑定获得焦点(控件, 处理器)` | bool | 为NE骨架屏实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3044 | `NE骨架屏_解绑获得焦点` | `NE骨架屏_解绑获得焦点(控件)` | bool | 移除NE骨架屏实例由代码绑定的“获得焦点”处理器。 |
| 3045 | `NE骨架屏_绑定失去焦点` | `NE骨架屏_绑定失去焦点(控件, 处理器)` | bool | 为NE骨架屏实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3046 | `NE骨架屏_解绑失去焦点` | `NE骨架屏_解绑失去焦点(控件)` | bool | 移除NE骨架屏实例由代码绑定的“失去焦点”处理器。 |
| 3047 | `控件_创建NE描述列表` | `控件_创建NE描述列表(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE描述列表 | 在当前 new_emoji 窗口运行时创建NE描述列表，窗口拥有元素生命周期。 |
| 3048 | `通过标记文本获取NE描述列表` | `通过标记文本获取NE描述列表(标记文本)` | NE描述列表 | 按区分大小写的非空文本标记查找NE描述列表，找不到时返回无效引用。 |
| 3049 | `通过标记整数获取NE描述列表` | `通过标记整数获取NE描述列表(标记整数)` | NE描述列表 | 按有符号 32 位整数标记查找NE描述列表，找不到时返回无效引用。 |
| 3050 | `NE描述列表_绑定鼠标进入` | `NE描述列表_绑定鼠标进入(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3051 | `NE描述列表_解绑鼠标进入` | `NE描述列表_解绑鼠标进入(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标进入”处理器。 |
| 3052 | `NE描述列表_绑定鼠标离开` | `NE描述列表_绑定鼠标离开(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3053 | `NE描述列表_解绑鼠标离开` | `NE描述列表_解绑鼠标离开(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标离开”处理器。 |
| 3054 | `NE描述列表_绑定鼠标按下` | `NE描述列表_绑定鼠标按下(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3055 | `NE描述列表_解绑鼠标按下` | `NE描述列表_解绑鼠标按下(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标按下”处理器。 |
| 3056 | `NE描述列表_绑定鼠标抬起` | `NE描述列表_绑定鼠标抬起(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3057 | `NE描述列表_解绑鼠标抬起` | `NE描述列表_解绑鼠标抬起(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标抬起”处理器。 |
| 3058 | `NE描述列表_绑定鼠标双击` | `NE描述列表_绑定鼠标双击(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3059 | `NE描述列表_解绑鼠标双击` | `NE描述列表_解绑鼠标双击(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标双击”处理器。 |
| 3060 | `NE描述列表_绑定鼠标移动` | `NE描述列表_绑定鼠标移动(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3061 | `NE描述列表_解绑鼠标移动` | `NE描述列表_解绑鼠标移动(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标移动”处理器。 |
| 3062 | `NE描述列表_绑定鼠标滚轮` | `NE描述列表_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE描述列表实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3063 | `NE描述列表_解绑鼠标滚轮` | `NE描述列表_解绑鼠标滚轮(控件)` | bool | 移除NE描述列表实例由代码绑定的“鼠标滚轮”处理器。 |
| 3064 | `NE描述列表_绑定获得焦点` | `NE描述列表_绑定获得焦点(控件, 处理器)` | bool | 为NE描述列表实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3065 | `NE描述列表_解绑获得焦点` | `NE描述列表_解绑获得焦点(控件)` | bool | 移除NE描述列表实例由代码绑定的“获得焦点”处理器。 |
| 3066 | `NE描述列表_绑定失去焦点` | `NE描述列表_绑定失去焦点(控件, 处理器)` | bool | 为NE描述列表实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3067 | `NE描述列表_解绑失去焦点` | `NE描述列表_解绑失去焦点(控件)` | bool | 移除NE描述列表实例由代码绑定的“失去焦点”处理器。 |
| 3068 | `控件_创建NE折叠面板` | `控件_创建NE折叠面板(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE折叠面板 | 在当前 new_emoji 窗口运行时创建NE折叠面板，窗口拥有元素生命周期。 |
| 3069 | `通过标记文本获取NE折叠面板` | `通过标记文本获取NE折叠面板(标记文本)` | NE折叠面板 | 按区分大小写的非空文本标记查找NE折叠面板，找不到时返回无效引用。 |
| 3070 | `通过标记整数获取NE折叠面板` | `通过标记整数获取NE折叠面板(标记整数)` | NE折叠面板 | 按有符号 32 位整数标记查找NE折叠面板，找不到时返回无效引用。 |
| 3071 | `NE折叠面板_绑定选择变化` | `NE折叠面板_绑定选择变化(控件, 处理器)` | bool | 为NE折叠面板实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3072 | `NE折叠面板_解绑选择变化` | `NE折叠面板_解绑选择变化(控件)` | bool | 移除NE折叠面板实例由代码绑定的“选择变化”处理器。 |
| 3073 | `NE折叠面板_绑定鼠标进入` | `NE折叠面板_绑定鼠标进入(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3074 | `NE折叠面板_解绑鼠标进入` | `NE折叠面板_解绑鼠标进入(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标进入”处理器。 |
| 3075 | `NE折叠面板_绑定鼠标离开` | `NE折叠面板_绑定鼠标离开(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3076 | `NE折叠面板_解绑鼠标离开` | `NE折叠面板_解绑鼠标离开(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标离开”处理器。 |
| 3077 | `NE折叠面板_绑定鼠标按下` | `NE折叠面板_绑定鼠标按下(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3078 | `NE折叠面板_解绑鼠标按下` | `NE折叠面板_解绑鼠标按下(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标按下”处理器。 |
| 3079 | `NE折叠面板_绑定鼠标抬起` | `NE折叠面板_绑定鼠标抬起(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3080 | `NE折叠面板_解绑鼠标抬起` | `NE折叠面板_解绑鼠标抬起(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标抬起”处理器。 |
| 3081 | `NE折叠面板_绑定鼠标双击` | `NE折叠面板_绑定鼠标双击(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3082 | `NE折叠面板_解绑鼠标双击` | `NE折叠面板_解绑鼠标双击(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标双击”处理器。 |
| 3083 | `NE折叠面板_绑定鼠标移动` | `NE折叠面板_绑定鼠标移动(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3084 | `NE折叠面板_解绑鼠标移动` | `NE折叠面板_解绑鼠标移动(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标移动”处理器。 |
| 3085 | `NE折叠面板_绑定鼠标滚轮` | `NE折叠面板_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE折叠面板实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3086 | `NE折叠面板_解绑鼠标滚轮` | `NE折叠面板_解绑鼠标滚轮(控件)` | bool | 移除NE折叠面板实例由代码绑定的“鼠标滚轮”处理器。 |
| 3087 | `NE折叠面板_绑定获得焦点` | `NE折叠面板_绑定获得焦点(控件, 处理器)` | bool | 为NE折叠面板实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3088 | `NE折叠面板_解绑获得焦点` | `NE折叠面板_解绑获得焦点(控件)` | bool | 移除NE折叠面板实例由代码绑定的“获得焦点”处理器。 |
| 3089 | `NE折叠面板_绑定失去焦点` | `NE折叠面板_绑定失去焦点(控件, 处理器)` | bool | 为NE折叠面板实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3090 | `NE折叠面板_解绑失去焦点` | `NE折叠面板_解绑失去焦点(控件)` | bool | 移除NE折叠面板实例由代码绑定的“失去焦点”处理器。 |
| 3091 | `控件_创建NE时间线` | `控件_创建NE时间线(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE时间线 | 在当前 new_emoji 窗口运行时创建NE时间线，窗口拥有元素生命周期。 |
| 3092 | `通过标记文本获取NE时间线` | `通过标记文本获取NE时间线(标记文本)` | NE时间线 | 按区分大小写的非空文本标记查找NE时间线，找不到时返回无效引用。 |
| 3093 | `通过标记整数获取NE时间线` | `通过标记整数获取NE时间线(标记整数)` | NE时间线 | 按有符号 32 位整数标记查找NE时间线，找不到时返回无效引用。 |
| 3094 | `NE时间线_绑定鼠标进入` | `NE时间线_绑定鼠标进入(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3095 | `NE时间线_解绑鼠标进入` | `NE时间线_解绑鼠标进入(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标进入”处理器。 |
| 3096 | `NE时间线_绑定鼠标离开` | `NE时间线_绑定鼠标离开(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3097 | `NE时间线_解绑鼠标离开` | `NE时间线_解绑鼠标离开(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标离开”处理器。 |
| 3098 | `NE时间线_绑定鼠标按下` | `NE时间线_绑定鼠标按下(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3099 | `NE时间线_解绑鼠标按下` | `NE时间线_解绑鼠标按下(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标按下”处理器。 |
| 3100 | `NE时间线_绑定鼠标抬起` | `NE时间线_绑定鼠标抬起(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3101 | `NE时间线_解绑鼠标抬起` | `NE时间线_解绑鼠标抬起(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标抬起”处理器。 |
| 3102 | `NE时间线_绑定鼠标双击` | `NE时间线_绑定鼠标双击(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3103 | `NE时间线_解绑鼠标双击` | `NE时间线_解绑鼠标双击(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标双击”处理器。 |
| 3104 | `NE时间线_绑定鼠标移动` | `NE时间线_绑定鼠标移动(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3105 | `NE时间线_解绑鼠标移动` | `NE时间线_解绑鼠标移动(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标移动”处理器。 |
| 3106 | `NE时间线_绑定鼠标滚轮` | `NE时间线_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE时间线实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3107 | `NE时间线_解绑鼠标滚轮` | `NE时间线_解绑鼠标滚轮(控件)` | bool | 移除NE时间线实例由代码绑定的“鼠标滚轮”处理器。 |
| 3108 | `NE时间线_绑定获得焦点` | `NE时间线_绑定获得焦点(控件, 处理器)` | bool | 为NE时间线实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3109 | `NE时间线_解绑获得焦点` | `NE时间线_解绑获得焦点(控件)` | bool | 移除NE时间线实例由代码绑定的“获得焦点”处理器。 |
| 3110 | `NE时间线_绑定失去焦点` | `NE时间线_绑定失去焦点(控件, 处理器)` | bool | 为NE时间线实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3111 | `NE时间线_解绑失去焦点` | `NE时间线_解绑失去焦点(控件)` | bool | 移除NE时间线实例由代码绑定的“失去焦点”处理器。 |
| 3112 | `控件_创建NE统计数值` | `控件_创建NE统计数值(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE统计数值 | 在当前 new_emoji 窗口运行时创建NE统计数值，窗口拥有元素生命周期。 |
| 3113 | `通过标记文本获取NE统计数值` | `通过标记文本获取NE统计数值(标记文本)` | NE统计数值 | 按区分大小写的非空文本标记查找NE统计数值，找不到时返回无效引用。 |
| 3114 | `通过标记整数获取NE统计数值` | `通过标记整数获取NE统计数值(标记整数)` | NE统计数值 | 按有符号 32 位整数标记查找NE统计数值，找不到时返回无效引用。 |
| 3115 | `NE统计数值_绑定鼠标进入` | `NE统计数值_绑定鼠标进入(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3116 | `NE统计数值_解绑鼠标进入` | `NE统计数值_解绑鼠标进入(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标进入”处理器。 |
| 3117 | `NE统计数值_绑定鼠标离开` | `NE统计数值_绑定鼠标离开(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3118 | `NE统计数值_解绑鼠标离开` | `NE统计数值_解绑鼠标离开(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标离开”处理器。 |
| 3119 | `NE统计数值_绑定鼠标按下` | `NE统计数值_绑定鼠标按下(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3120 | `NE统计数值_解绑鼠标按下` | `NE统计数值_解绑鼠标按下(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标按下”处理器。 |
| 3121 | `NE统计数值_绑定鼠标抬起` | `NE统计数值_绑定鼠标抬起(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3122 | `NE统计数值_解绑鼠标抬起` | `NE统计数值_解绑鼠标抬起(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标抬起”处理器。 |
| 3123 | `NE统计数值_绑定鼠标双击` | `NE统计数值_绑定鼠标双击(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3124 | `NE统计数值_解绑鼠标双击` | `NE统计数值_解绑鼠标双击(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标双击”处理器。 |
| 3125 | `NE统计数值_绑定鼠标移动` | `NE统计数值_绑定鼠标移动(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3126 | `NE统计数值_解绑鼠标移动` | `NE统计数值_解绑鼠标移动(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标移动”处理器。 |
| 3127 | `NE统计数值_绑定鼠标滚轮` | `NE统计数值_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE统计数值实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3128 | `NE统计数值_解绑鼠标滚轮` | `NE统计数值_解绑鼠标滚轮(控件)` | bool | 移除NE统计数值实例由代码绑定的“鼠标滚轮”处理器。 |
| 3129 | `NE统计数值_绑定获得焦点` | `NE统计数值_绑定获得焦点(控件, 处理器)` | bool | 为NE统计数值实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3130 | `NE统计数值_解绑获得焦点` | `NE统计数值_解绑获得焦点(控件)` | bool | 移除NE统计数值实例由代码绑定的“获得焦点”处理器。 |
| 3131 | `NE统计数值_绑定失去焦点` | `NE统计数值_绑定失去焦点(控件, 处理器)` | bool | 为NE统计数值实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3132 | `NE统计数值_解绑失去焦点` | `NE统计数值_解绑失去焦点(控件)` | bool | 移除NE统计数值实例由代码绑定的“失去焦点”处理器。 |
| 3133 | `控件_创建NEKPI卡片` | `控件_创建NEKPI卡片(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NEKPI卡片 | 在当前 new_emoji 窗口运行时创建NEKPI卡片，窗口拥有元素生命周期。 |
| 3134 | `通过标记文本获取NEKPI卡片` | `通过标记文本获取NEKPI卡片(标记文本)` | NEKPI卡片 | 按区分大小写的非空文本标记查找NEKPI卡片，找不到时返回无效引用。 |
| 3135 | `通过标记整数获取NEKPI卡片` | `通过标记整数获取NEKPI卡片(标记整数)` | NEKPI卡片 | 按有符号 32 位整数标记查找NEKPI卡片，找不到时返回无效引用。 |
| 3136 | `NEKPI卡片_绑定鼠标进入` | `NEKPI卡片_绑定鼠标进入(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3137 | `NEKPI卡片_解绑鼠标进入` | `NEKPI卡片_解绑鼠标进入(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标进入”处理器。 |
| 3138 | `NEKPI卡片_绑定鼠标离开` | `NEKPI卡片_绑定鼠标离开(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3139 | `NEKPI卡片_解绑鼠标离开` | `NEKPI卡片_解绑鼠标离开(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标离开”处理器。 |
| 3140 | `NEKPI卡片_绑定鼠标按下` | `NEKPI卡片_绑定鼠标按下(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3141 | `NEKPI卡片_解绑鼠标按下` | `NEKPI卡片_解绑鼠标按下(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标按下”处理器。 |
| 3142 | `NEKPI卡片_绑定鼠标抬起` | `NEKPI卡片_绑定鼠标抬起(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3143 | `NEKPI卡片_解绑鼠标抬起` | `NEKPI卡片_解绑鼠标抬起(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标抬起”处理器。 |
| 3144 | `NEKPI卡片_绑定鼠标双击` | `NEKPI卡片_绑定鼠标双击(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3145 | `NEKPI卡片_解绑鼠标双击` | `NEKPI卡片_解绑鼠标双击(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标双击”处理器。 |
| 3146 | `NEKPI卡片_绑定鼠标移动` | `NEKPI卡片_绑定鼠标移动(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3147 | `NEKPI卡片_解绑鼠标移动` | `NEKPI卡片_解绑鼠标移动(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标移动”处理器。 |
| 3148 | `NEKPI卡片_绑定鼠标滚轮` | `NEKPI卡片_绑定鼠标滚轮(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3149 | `NEKPI卡片_解绑鼠标滚轮` | `NEKPI卡片_解绑鼠标滚轮(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“鼠标滚轮”处理器。 |
| 3150 | `NEKPI卡片_绑定获得焦点` | `NEKPI卡片_绑定获得焦点(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3151 | `NEKPI卡片_解绑获得焦点` | `NEKPI卡片_解绑获得焦点(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“获得焦点”处理器。 |
| 3152 | `NEKPI卡片_绑定失去焦点` | `NEKPI卡片_绑定失去焦点(控件, 处理器)` | bool | 为NEKPI卡片实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3153 | `NEKPI卡片_解绑失去焦点` | `NEKPI卡片_解绑失去焦点(控件)` | bool | 移除NEKPI卡片实例由代码绑定的“失去焦点”处理器。 |
| 3154 | `控件_创建NE趋势` | `控件_创建NE趋势(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE趋势 | 在当前 new_emoji 窗口运行时创建NE趋势，窗口拥有元素生命周期。 |
| 3155 | `通过标记文本获取NE趋势` | `通过标记文本获取NE趋势(标记文本)` | NE趋势 | 按区分大小写的非空文本标记查找NE趋势，找不到时返回无效引用。 |
| 3156 | `通过标记整数获取NE趋势` | `通过标记整数获取NE趋势(标记整数)` | NE趋势 | 按有符号 32 位整数标记查找NE趋势，找不到时返回无效引用。 |
| 3157 | `NE趋势_绑定鼠标进入` | `NE趋势_绑定鼠标进入(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3158 | `NE趋势_解绑鼠标进入` | `NE趋势_解绑鼠标进入(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标进入”处理器。 |
| 3159 | `NE趋势_绑定鼠标离开` | `NE趋势_绑定鼠标离开(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3160 | `NE趋势_解绑鼠标离开` | `NE趋势_解绑鼠标离开(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标离开”处理器。 |
| 3161 | `NE趋势_绑定鼠标按下` | `NE趋势_绑定鼠标按下(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3162 | `NE趋势_解绑鼠标按下` | `NE趋势_解绑鼠标按下(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标按下”处理器。 |
| 3163 | `NE趋势_绑定鼠标抬起` | `NE趋势_绑定鼠标抬起(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3164 | `NE趋势_解绑鼠标抬起` | `NE趋势_解绑鼠标抬起(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标抬起”处理器。 |
| 3165 | `NE趋势_绑定鼠标双击` | `NE趋势_绑定鼠标双击(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3166 | `NE趋势_解绑鼠标双击` | `NE趋势_解绑鼠标双击(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标双击”处理器。 |
| 3167 | `NE趋势_绑定鼠标移动` | `NE趋势_绑定鼠标移动(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3168 | `NE趋势_解绑鼠标移动` | `NE趋势_解绑鼠标移动(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标移动”处理器。 |
| 3169 | `NE趋势_绑定鼠标滚轮` | `NE趋势_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE趋势实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3170 | `NE趋势_解绑鼠标滚轮` | `NE趋势_解绑鼠标滚轮(控件)` | bool | 移除NE趋势实例由代码绑定的“鼠标滚轮”处理器。 |
| 3171 | `NE趋势_绑定获得焦点` | `NE趋势_绑定获得焦点(控件, 处理器)` | bool | 为NE趋势实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3172 | `NE趋势_解绑获得焦点` | `NE趋势_解绑获得焦点(控件)` | bool | 移除NE趋势实例由代码绑定的“获得焦点”处理器。 |
| 3173 | `NE趋势_绑定失去焦点` | `NE趋势_绑定失去焦点(控件, 处理器)` | bool | 为NE趋势实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3174 | `NE趋势_解绑失去焦点` | `NE趋势_解绑失去焦点(控件)` | bool | 移除NE趋势实例由代码绑定的“失去焦点”处理器。 |
| 3175 | `控件_创建NE状态点` | `控件_创建NE状态点(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE状态点 | 在当前 new_emoji 窗口运行时创建NE状态点，窗口拥有元素生命周期。 |
| 3176 | `通过标记文本获取NE状态点` | `通过标记文本获取NE状态点(标记文本)` | NE状态点 | 按区分大小写的非空文本标记查找NE状态点，找不到时返回无效引用。 |
| 3177 | `通过标记整数获取NE状态点` | `通过标记整数获取NE状态点(标记整数)` | NE状态点 | 按有符号 32 位整数标记查找NE状态点，找不到时返回无效引用。 |
| 3178 | `NE状态点_绑定鼠标进入` | `NE状态点_绑定鼠标进入(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3179 | `NE状态点_解绑鼠标进入` | `NE状态点_解绑鼠标进入(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标进入”处理器。 |
| 3180 | `NE状态点_绑定鼠标离开` | `NE状态点_绑定鼠标离开(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3181 | `NE状态点_解绑鼠标离开` | `NE状态点_解绑鼠标离开(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标离开”处理器。 |
| 3182 | `NE状态点_绑定鼠标按下` | `NE状态点_绑定鼠标按下(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3183 | `NE状态点_解绑鼠标按下` | `NE状态点_解绑鼠标按下(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标按下”处理器。 |
| 3184 | `NE状态点_绑定鼠标抬起` | `NE状态点_绑定鼠标抬起(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3185 | `NE状态点_解绑鼠标抬起` | `NE状态点_解绑鼠标抬起(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标抬起”处理器。 |
| 3186 | `NE状态点_绑定鼠标双击` | `NE状态点_绑定鼠标双击(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3187 | `NE状态点_解绑鼠标双击` | `NE状态点_解绑鼠标双击(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标双击”处理器。 |
| 3188 | `NE状态点_绑定鼠标移动` | `NE状态点_绑定鼠标移动(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3189 | `NE状态点_解绑鼠标移动` | `NE状态点_解绑鼠标移动(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标移动”处理器。 |
| 3190 | `NE状态点_绑定鼠标滚轮` | `NE状态点_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE状态点实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3191 | `NE状态点_解绑鼠标滚轮` | `NE状态点_解绑鼠标滚轮(控件)` | bool | 移除NE状态点实例由代码绑定的“鼠标滚轮”处理器。 |
| 3192 | `NE状态点_绑定获得焦点` | `NE状态点_绑定获得焦点(控件, 处理器)` | bool | 为NE状态点实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3193 | `NE状态点_解绑获得焦点` | `NE状态点_解绑获得焦点(控件)` | bool | 移除NE状态点实例由代码绑定的“获得焦点”处理器。 |
| 3194 | `NE状态点_绑定失去焦点` | `NE状态点_绑定失去焦点(控件, 处理器)` | bool | 为NE状态点实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3195 | `NE状态点_解绑失去焦点` | `NE状态点_解绑失去焦点(控件)` | bool | 移除NE状态点实例由代码绑定的“失去焦点”处理器。 |
| 3196 | `控件_创建NE仪表盘` | `控件_创建NE仪表盘(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE仪表盘 | 在当前 new_emoji 窗口运行时创建NE仪表盘，窗口拥有元素生命周期。 |
| 3197 | `通过标记文本获取NE仪表盘` | `通过标记文本获取NE仪表盘(标记文本)` | NE仪表盘 | 按区分大小写的非空文本标记查找NE仪表盘，找不到时返回无效引用。 |
| 3198 | `通过标记整数获取NE仪表盘` | `通过标记整数获取NE仪表盘(标记整数)` | NE仪表盘 | 按有符号 32 位整数标记查找NE仪表盘，找不到时返回无效引用。 |
| 3199 | `NE仪表盘_绑定鼠标进入` | `NE仪表盘_绑定鼠标进入(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3200 | `NE仪表盘_解绑鼠标进入` | `NE仪表盘_解绑鼠标进入(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标进入”处理器。 |
| 3201 | `NE仪表盘_绑定鼠标离开` | `NE仪表盘_绑定鼠标离开(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3202 | `NE仪表盘_解绑鼠标离开` | `NE仪表盘_解绑鼠标离开(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标离开”处理器。 |
| 3203 | `NE仪表盘_绑定鼠标按下` | `NE仪表盘_绑定鼠标按下(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3204 | `NE仪表盘_解绑鼠标按下` | `NE仪表盘_解绑鼠标按下(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标按下”处理器。 |
| 3205 | `NE仪表盘_绑定鼠标抬起` | `NE仪表盘_绑定鼠标抬起(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3206 | `NE仪表盘_解绑鼠标抬起` | `NE仪表盘_解绑鼠标抬起(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标抬起”处理器。 |
| 3207 | `NE仪表盘_绑定鼠标双击` | `NE仪表盘_绑定鼠标双击(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3208 | `NE仪表盘_解绑鼠标双击` | `NE仪表盘_解绑鼠标双击(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标双击”处理器。 |
| 3209 | `NE仪表盘_绑定鼠标移动` | `NE仪表盘_绑定鼠标移动(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3210 | `NE仪表盘_解绑鼠标移动` | `NE仪表盘_解绑鼠标移动(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标移动”处理器。 |
| 3211 | `NE仪表盘_绑定鼠标滚轮` | `NE仪表盘_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE仪表盘实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3212 | `NE仪表盘_解绑鼠标滚轮` | `NE仪表盘_解绑鼠标滚轮(控件)` | bool | 移除NE仪表盘实例由代码绑定的“鼠标滚轮”处理器。 |
| 3213 | `NE仪表盘_绑定获得焦点` | `NE仪表盘_绑定获得焦点(控件, 处理器)` | bool | 为NE仪表盘实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3214 | `NE仪表盘_解绑获得焦点` | `NE仪表盘_解绑获得焦点(控件)` | bool | 移除NE仪表盘实例由代码绑定的“获得焦点”处理器。 |
| 3215 | `NE仪表盘_绑定失去焦点` | `NE仪表盘_绑定失去焦点(控件, 处理器)` | bool | 为NE仪表盘实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3216 | `NE仪表盘_解绑失去焦点` | `NE仪表盘_解绑失去焦点(控件)` | bool | 移除NE仪表盘实例由代码绑定的“失去焦点”处理器。 |
| 3217 | `控件_创建NE环形进度` | `控件_创建NE环形进度(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE环形进度 | 在当前 new_emoji 窗口运行时创建NE环形进度，窗口拥有元素生命周期。 |
| 3218 | `通过标记文本获取NE环形进度` | `通过标记文本获取NE环形进度(标记文本)` | NE环形进度 | 按区分大小写的非空文本标记查找NE环形进度，找不到时返回无效引用。 |
| 3219 | `通过标记整数获取NE环形进度` | `通过标记整数获取NE环形进度(标记整数)` | NE环形进度 | 按有符号 32 位整数标记查找NE环形进度，找不到时返回无效引用。 |
| 3220 | `NE环形进度_绑定鼠标进入` | `NE环形进度_绑定鼠标进入(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3221 | `NE环形进度_解绑鼠标进入` | `NE环形进度_解绑鼠标进入(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标进入”处理器。 |
| 3222 | `NE环形进度_绑定鼠标离开` | `NE环形进度_绑定鼠标离开(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3223 | `NE环形进度_解绑鼠标离开` | `NE环形进度_解绑鼠标离开(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标离开”处理器。 |
| 3224 | `NE环形进度_绑定鼠标按下` | `NE环形进度_绑定鼠标按下(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3225 | `NE环形进度_解绑鼠标按下` | `NE环形进度_解绑鼠标按下(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标按下”处理器。 |
| 3226 | `NE环形进度_绑定鼠标抬起` | `NE环形进度_绑定鼠标抬起(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3227 | `NE环形进度_解绑鼠标抬起` | `NE环形进度_解绑鼠标抬起(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标抬起”处理器。 |
| 3228 | `NE环形进度_绑定鼠标双击` | `NE环形进度_绑定鼠标双击(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3229 | `NE环形进度_解绑鼠标双击` | `NE环形进度_解绑鼠标双击(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标双击”处理器。 |
| 3230 | `NE环形进度_绑定鼠标移动` | `NE环形进度_绑定鼠标移动(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3231 | `NE环形进度_解绑鼠标移动` | `NE环形进度_解绑鼠标移动(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标移动”处理器。 |
| 3232 | `NE环形进度_绑定鼠标滚轮` | `NE环形进度_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE环形进度实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3233 | `NE环形进度_解绑鼠标滚轮` | `NE环形进度_解绑鼠标滚轮(控件)` | bool | 移除NE环形进度实例由代码绑定的“鼠标滚轮”处理器。 |
| 3234 | `NE环形进度_绑定获得焦点` | `NE环形进度_绑定获得焦点(控件, 处理器)` | bool | 为NE环形进度实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3235 | `NE环形进度_解绑获得焦点` | `NE环形进度_解绑获得焦点(控件)` | bool | 移除NE环形进度实例由代码绑定的“获得焦点”处理器。 |
| 3236 | `NE环形进度_绑定失去焦点` | `NE环形进度_绑定失去焦点(控件, 处理器)` | bool | 为NE环形进度实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3237 | `NE环形进度_解绑失去焦点` | `NE环形进度_解绑失去焦点(控件)` | bool | 移除NE环形进度实例由代码绑定的“失去焦点”处理器。 |
| 3238 | `控件_创建NE子弹进度` | `控件_创建NE子弹进度(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE子弹进度 | 在当前 new_emoji 窗口运行时创建NE子弹进度，窗口拥有元素生命周期。 |
| 3239 | `通过标记文本获取NE子弹进度` | `通过标记文本获取NE子弹进度(标记文本)` | NE子弹进度 | 按区分大小写的非空文本标记查找NE子弹进度，找不到时返回无效引用。 |
| 3240 | `通过标记整数获取NE子弹进度` | `通过标记整数获取NE子弹进度(标记整数)` | NE子弹进度 | 按有符号 32 位整数标记查找NE子弹进度，找不到时返回无效引用。 |
| 3241 | `NE子弹进度_绑定鼠标进入` | `NE子弹进度_绑定鼠标进入(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3242 | `NE子弹进度_解绑鼠标进入` | `NE子弹进度_解绑鼠标进入(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标进入”处理器。 |
| 3243 | `NE子弹进度_绑定鼠标离开` | `NE子弹进度_绑定鼠标离开(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3244 | `NE子弹进度_解绑鼠标离开` | `NE子弹进度_解绑鼠标离开(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标离开”处理器。 |
| 3245 | `NE子弹进度_绑定鼠标按下` | `NE子弹进度_绑定鼠标按下(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3246 | `NE子弹进度_解绑鼠标按下` | `NE子弹进度_解绑鼠标按下(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标按下”处理器。 |
| 3247 | `NE子弹进度_绑定鼠标抬起` | `NE子弹进度_绑定鼠标抬起(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3248 | `NE子弹进度_解绑鼠标抬起` | `NE子弹进度_解绑鼠标抬起(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标抬起”处理器。 |
| 3249 | `NE子弹进度_绑定鼠标双击` | `NE子弹进度_绑定鼠标双击(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3250 | `NE子弹进度_解绑鼠标双击` | `NE子弹进度_解绑鼠标双击(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标双击”处理器。 |
| 3251 | `NE子弹进度_绑定鼠标移动` | `NE子弹进度_绑定鼠标移动(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3252 | `NE子弹进度_解绑鼠标移动` | `NE子弹进度_解绑鼠标移动(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标移动”处理器。 |
| 3253 | `NE子弹进度_绑定鼠标滚轮` | `NE子弹进度_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE子弹进度实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3254 | `NE子弹进度_解绑鼠标滚轮` | `NE子弹进度_解绑鼠标滚轮(控件)` | bool | 移除NE子弹进度实例由代码绑定的“鼠标滚轮”处理器。 |
| 3255 | `NE子弹进度_绑定获得焦点` | `NE子弹进度_绑定获得焦点(控件, 处理器)` | bool | 为NE子弹进度实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3256 | `NE子弹进度_解绑获得焦点` | `NE子弹进度_解绑获得焦点(控件)` | bool | 移除NE子弹进度实例由代码绑定的“获得焦点”处理器。 |
| 3257 | `NE子弹进度_绑定失去焦点` | `NE子弹进度_绑定失去焦点(控件, 处理器)` | bool | 为NE子弹进度实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3258 | `NE子弹进度_解绑失去焦点` | `NE子弹进度_解绑失去焦点(控件)` | bool | 移除NE子弹进度实例由代码绑定的“失去焦点”处理器。 |
| 3259 | `控件_创建NE折线图` | `控件_创建NE折线图(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE折线图 | 在当前 new_emoji 窗口运行时创建NE折线图，窗口拥有元素生命周期。 |
| 3260 | `通过标记文本获取NE折线图` | `通过标记文本获取NE折线图(标记文本)` | NE折线图 | 按区分大小写的非空文本标记查找NE折线图，找不到时返回无效引用。 |
| 3261 | `通过标记整数获取NE折线图` | `通过标记整数获取NE折线图(标记整数)` | NE折线图 | 按有符号 32 位整数标记查找NE折线图，找不到时返回无效引用。 |
| 3262 | `NE折线图_绑定鼠标进入` | `NE折线图_绑定鼠标进入(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3263 | `NE折线图_解绑鼠标进入` | `NE折线图_解绑鼠标进入(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标进入”处理器。 |
| 3264 | `NE折线图_绑定鼠标离开` | `NE折线图_绑定鼠标离开(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3265 | `NE折线图_解绑鼠标离开` | `NE折线图_解绑鼠标离开(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标离开”处理器。 |
| 3266 | `NE折线图_绑定鼠标按下` | `NE折线图_绑定鼠标按下(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3267 | `NE折线图_解绑鼠标按下` | `NE折线图_解绑鼠标按下(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标按下”处理器。 |
| 3268 | `NE折线图_绑定鼠标抬起` | `NE折线图_绑定鼠标抬起(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3269 | `NE折线图_解绑鼠标抬起` | `NE折线图_解绑鼠标抬起(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标抬起”处理器。 |
| 3270 | `NE折线图_绑定鼠标双击` | `NE折线图_绑定鼠标双击(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3271 | `NE折线图_解绑鼠标双击` | `NE折线图_解绑鼠标双击(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标双击”处理器。 |
| 3272 | `NE折线图_绑定鼠标移动` | `NE折线图_绑定鼠标移动(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3273 | `NE折线图_解绑鼠标移动` | `NE折线图_解绑鼠标移动(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标移动”处理器。 |
| 3274 | `NE折线图_绑定鼠标滚轮` | `NE折线图_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE折线图实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3275 | `NE折线图_解绑鼠标滚轮` | `NE折线图_解绑鼠标滚轮(控件)` | bool | 移除NE折线图实例由代码绑定的“鼠标滚轮”处理器。 |
| 3276 | `NE折线图_绑定获得焦点` | `NE折线图_绑定获得焦点(控件, 处理器)` | bool | 为NE折线图实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3277 | `NE折线图_解绑获得焦点` | `NE折线图_解绑获得焦点(控件)` | bool | 移除NE折线图实例由代码绑定的“获得焦点”处理器。 |
| 3278 | `NE折线图_绑定失去焦点` | `NE折线图_绑定失去焦点(控件, 处理器)` | bool | 为NE折线图实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3279 | `NE折线图_解绑失去焦点` | `NE折线图_解绑失去焦点(控件)` | bool | 移除NE折线图实例由代码绑定的“失去焦点”处理器。 |
| 3280 | `控件_创建NE柱状图` | `控件_创建NE柱状图(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE柱状图 | 在当前 new_emoji 窗口运行时创建NE柱状图，窗口拥有元素生命周期。 |
| 3281 | `通过标记文本获取NE柱状图` | `通过标记文本获取NE柱状图(标记文本)` | NE柱状图 | 按区分大小写的非空文本标记查找NE柱状图，找不到时返回无效引用。 |
| 3282 | `通过标记整数获取NE柱状图` | `通过标记整数获取NE柱状图(标记整数)` | NE柱状图 | 按有符号 32 位整数标记查找NE柱状图，找不到时返回无效引用。 |
| 3283 | `NE柱状图_绑定鼠标进入` | `NE柱状图_绑定鼠标进入(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3284 | `NE柱状图_解绑鼠标进入` | `NE柱状图_解绑鼠标进入(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标进入”处理器。 |
| 3285 | `NE柱状图_绑定鼠标离开` | `NE柱状图_绑定鼠标离开(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3286 | `NE柱状图_解绑鼠标离开` | `NE柱状图_解绑鼠标离开(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标离开”处理器。 |
| 3287 | `NE柱状图_绑定鼠标按下` | `NE柱状图_绑定鼠标按下(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3288 | `NE柱状图_解绑鼠标按下` | `NE柱状图_解绑鼠标按下(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标按下”处理器。 |
| 3289 | `NE柱状图_绑定鼠标抬起` | `NE柱状图_绑定鼠标抬起(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3290 | `NE柱状图_解绑鼠标抬起` | `NE柱状图_解绑鼠标抬起(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标抬起”处理器。 |
| 3291 | `NE柱状图_绑定鼠标双击` | `NE柱状图_绑定鼠标双击(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3292 | `NE柱状图_解绑鼠标双击` | `NE柱状图_解绑鼠标双击(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标双击”处理器。 |
| 3293 | `NE柱状图_绑定鼠标移动` | `NE柱状图_绑定鼠标移动(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3294 | `NE柱状图_解绑鼠标移动` | `NE柱状图_解绑鼠标移动(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标移动”处理器。 |
| 3295 | `NE柱状图_绑定鼠标滚轮` | `NE柱状图_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE柱状图实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3296 | `NE柱状图_解绑鼠标滚轮` | `NE柱状图_解绑鼠标滚轮(控件)` | bool | 移除NE柱状图实例由代码绑定的“鼠标滚轮”处理器。 |
| 3297 | `NE柱状图_绑定获得焦点` | `NE柱状图_绑定获得焦点(控件, 处理器)` | bool | 为NE柱状图实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3298 | `NE柱状图_解绑获得焦点` | `NE柱状图_解绑获得焦点(控件)` | bool | 移除NE柱状图实例由代码绑定的“获得焦点”处理器。 |
| 3299 | `NE柱状图_绑定失去焦点` | `NE柱状图_绑定失去焦点(控件, 处理器)` | bool | 为NE柱状图实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3300 | `NE柱状图_解绑失去焦点` | `NE柱状图_解绑失去焦点(控件)` | bool | 移除NE柱状图实例由代码绑定的“失去焦点”处理器。 |
| 3301 | `控件_创建NE环形图` | `控件_创建NE环形图(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE环形图 | 在当前 new_emoji 窗口运行时创建NE环形图，窗口拥有元素生命周期。 |
| 3302 | `通过标记文本获取NE环形图` | `通过标记文本获取NE环形图(标记文本)` | NE环形图 | 按区分大小写的非空文本标记查找NE环形图，找不到时返回无效引用。 |
| 3303 | `通过标记整数获取NE环形图` | `通过标记整数获取NE环形图(标记整数)` | NE环形图 | 按有符号 32 位整数标记查找NE环形图，找不到时返回无效引用。 |
| 3304 | `NE环形图_绑定鼠标进入` | `NE环形图_绑定鼠标进入(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3305 | `NE环形图_解绑鼠标进入` | `NE环形图_解绑鼠标进入(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标进入”处理器。 |
| 3306 | `NE环形图_绑定鼠标离开` | `NE环形图_绑定鼠标离开(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3307 | `NE环形图_解绑鼠标离开` | `NE环形图_解绑鼠标离开(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标离开”处理器。 |
| 3308 | `NE环形图_绑定鼠标按下` | `NE环形图_绑定鼠标按下(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3309 | `NE环形图_解绑鼠标按下` | `NE环形图_解绑鼠标按下(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标按下”处理器。 |
| 3310 | `NE环形图_绑定鼠标抬起` | `NE环形图_绑定鼠标抬起(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3311 | `NE环形图_解绑鼠标抬起` | `NE环形图_解绑鼠标抬起(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标抬起”处理器。 |
| 3312 | `NE环形图_绑定鼠标双击` | `NE环形图_绑定鼠标双击(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3313 | `NE环形图_解绑鼠标双击` | `NE环形图_解绑鼠标双击(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标双击”处理器。 |
| 3314 | `NE环形图_绑定鼠标移动` | `NE环形图_绑定鼠标移动(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3315 | `NE环形图_解绑鼠标移动` | `NE环形图_解绑鼠标移动(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标移动”处理器。 |
| 3316 | `NE环形图_绑定鼠标滚轮` | `NE环形图_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE环形图实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3317 | `NE环形图_解绑鼠标滚轮` | `NE环形图_解绑鼠标滚轮(控件)` | bool | 移除NE环形图实例由代码绑定的“鼠标滚轮”处理器。 |
| 3318 | `NE环形图_绑定获得焦点` | `NE环形图_绑定获得焦点(控件, 处理器)` | bool | 为NE环形图实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3319 | `NE环形图_解绑获得焦点` | `NE环形图_解绑获得焦点(控件)` | bool | 移除NE环形图实例由代码绑定的“获得焦点”处理器。 |
| 3320 | `NE环形图_绑定失去焦点` | `NE环形图_绑定失去焦点(控件, 处理器)` | bool | 为NE环形图实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3321 | `NE环形图_解绑失去焦点` | `NE环形图_解绑失去焦点(控件)` | bool | 移除NE环形图实例由代码绑定的“失去焦点”处理器。 |
| 3322 | `控件_创建NE日历` | `控件_创建NE日历(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE日历 | 在当前 new_emoji 窗口运行时创建NE日历，窗口拥有元素生命周期。 |
| 3323 | `通过标记文本获取NE日历` | `通过标记文本获取NE日历(标记文本)` | NE日历 | 按区分大小写的非空文本标记查找NE日历，找不到时返回无效引用。 |
| 3324 | `通过标记整数获取NE日历` | `通过标记整数获取NE日历(标记整数)` | NE日历 | 按有符号 32 位整数标记查找NE日历，找不到时返回无效引用。 |
| 3325 | `NE日历_绑定选择变化` | `NE日历_绑定选择变化(控件, 处理器)` | bool | 为NE日历实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3326 | `NE日历_解绑选择变化` | `NE日历_解绑选择变化(控件)` | bool | 移除NE日历实例由代码绑定的“选择变化”处理器。 |
| 3327 | `NE日历_绑定鼠标进入` | `NE日历_绑定鼠标进入(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3328 | `NE日历_解绑鼠标进入` | `NE日历_解绑鼠标进入(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标进入”处理器。 |
| 3329 | `NE日历_绑定鼠标离开` | `NE日历_绑定鼠标离开(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3330 | `NE日历_解绑鼠标离开` | `NE日历_解绑鼠标离开(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标离开”处理器。 |
| 3331 | `NE日历_绑定鼠标按下` | `NE日历_绑定鼠标按下(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3332 | `NE日历_解绑鼠标按下` | `NE日历_解绑鼠标按下(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标按下”处理器。 |
| 3333 | `NE日历_绑定鼠标抬起` | `NE日历_绑定鼠标抬起(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3334 | `NE日历_解绑鼠标抬起` | `NE日历_解绑鼠标抬起(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标抬起”处理器。 |
| 3335 | `NE日历_绑定鼠标双击` | `NE日历_绑定鼠标双击(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3336 | `NE日历_解绑鼠标双击` | `NE日历_解绑鼠标双击(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标双击”处理器。 |
| 3337 | `NE日历_绑定鼠标移动` | `NE日历_绑定鼠标移动(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3338 | `NE日历_解绑鼠标移动` | `NE日历_解绑鼠标移动(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标移动”处理器。 |
| 3339 | `NE日历_绑定鼠标滚轮` | `NE日历_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE日历实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3340 | `NE日历_解绑鼠标滚轮` | `NE日历_解绑鼠标滚轮(控件)` | bool | 移除NE日历实例由代码绑定的“鼠标滚轮”处理器。 |
| 3341 | `NE日历_绑定获得焦点` | `NE日历_绑定获得焦点(控件, 处理器)` | bool | 为NE日历实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3342 | `NE日历_解绑获得焦点` | `NE日历_解绑获得焦点(控件)` | bool | 移除NE日历实例由代码绑定的“获得焦点”处理器。 |
| 3343 | `NE日历_绑定失去焦点` | `NE日历_绑定失去焦点(控件, 处理器)` | bool | 为NE日历实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3344 | `NE日历_解绑失去焦点` | `NE日历_解绑失去焦点(控件)` | bool | 移除NE日历实例由代码绑定的“失去焦点”处理器。 |
| 3345 | `控件_创建NE树` | `控件_创建NE树(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE树 | 在当前 new_emoji 窗口运行时创建NE树，窗口拥有元素生命周期。 |
| 3346 | `通过标记文本获取NE树` | `通过标记文本获取NE树(标记文本)` | NE树 | 按区分大小写的非空文本标记查找NE树，找不到时返回无效引用。 |
| 3347 | `通过标记整数获取NE树` | `通过标记整数获取NE树(标记整数)` | NE树 | 按有符号 32 位整数标记查找NE树，找不到时返回无效引用。 |
| 3348 | `NE树_绑定选择变化` | `NE树_绑定选择变化(控件, 处理器)` | bool | 为NE树实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3349 | `NE树_解绑选择变化` | `NE树_解绑选择变化(控件)` | bool | 移除NE树实例由代码绑定的“选择变化”处理器。 |
| 3350 | `NE树_绑定节点事件` | `NE树_绑定节点事件(控件, 处理器)` | bool | 为NE树实例绑定“节点事件”处理器，处理器必须使用 &名称。 |
| 3351 | `NE树_解绑节点事件` | `NE树_解绑节点事件(控件)` | bool | 移除NE树实例由代码绑定的“节点事件”处理器。 |
| 3352 | `NE树_绑定懒加载` | `NE树_绑定懒加载(控件, 处理器)` | bool | 为NE树实例绑定“懒加载”处理器，处理器必须使用 &名称。 |
| 3353 | `NE树_解绑懒加载` | `NE树_解绑懒加载(控件)` | bool | 移除NE树实例由代码绑定的“懒加载”处理器。 |
| 3354 | `NE树_绑定拖拽完成` | `NE树_绑定拖拽完成(控件, 处理器)` | bool | 为NE树实例绑定“拖拽完成”处理器，处理器必须使用 &名称。 |
| 3355 | `NE树_解绑拖拽完成` | `NE树_解绑拖拽完成(控件)` | bool | 移除NE树实例由代码绑定的“拖拽完成”处理器。 |
| 3356 | `NE树_绑定允许拖拽` | `NE树_绑定允许拖拽(控件, 处理器)` | bool | 为NE树实例绑定“允许拖拽”处理器，处理器必须使用 &名称。 |
| 3357 | `NE树_解绑允许拖拽` | `NE树_解绑允许拖拽(控件)` | bool | 移除NE树实例由代码绑定的“允许拖拽”处理器。 |
| 3358 | `NE树_绑定允许放置` | `NE树_绑定允许放置(控件, 处理器)` | bool | 为NE树实例绑定“允许放置”处理器，处理器必须使用 &名称。 |
| 3359 | `NE树_解绑允许放置` | `NE树_解绑允许放置(控件)` | bool | 移除NE树实例由代码绑定的“允许放置”处理器。 |
| 3360 | `NE树_绑定鼠标进入` | `NE树_绑定鼠标进入(控件, 处理器)` | bool | 为NE树实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3361 | `NE树_解绑鼠标进入` | `NE树_解绑鼠标进入(控件)` | bool | 移除NE树实例由代码绑定的“鼠标进入”处理器。 |
| 3362 | `NE树_绑定鼠标离开` | `NE树_绑定鼠标离开(控件, 处理器)` | bool | 为NE树实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3363 | `NE树_解绑鼠标离开` | `NE树_解绑鼠标离开(控件)` | bool | 移除NE树实例由代码绑定的“鼠标离开”处理器。 |
| 3364 | `NE树_绑定鼠标按下` | `NE树_绑定鼠标按下(控件, 处理器)` | bool | 为NE树实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3365 | `NE树_解绑鼠标按下` | `NE树_解绑鼠标按下(控件)` | bool | 移除NE树实例由代码绑定的“鼠标按下”处理器。 |
| 3366 | `NE树_绑定鼠标抬起` | `NE树_绑定鼠标抬起(控件, 处理器)` | bool | 为NE树实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3367 | `NE树_解绑鼠标抬起` | `NE树_解绑鼠标抬起(控件)` | bool | 移除NE树实例由代码绑定的“鼠标抬起”处理器。 |
| 3368 | `NE树_绑定鼠标双击` | `NE树_绑定鼠标双击(控件, 处理器)` | bool | 为NE树实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3369 | `NE树_解绑鼠标双击` | `NE树_解绑鼠标双击(控件)` | bool | 移除NE树实例由代码绑定的“鼠标双击”处理器。 |
| 3370 | `NE树_绑定鼠标移动` | `NE树_绑定鼠标移动(控件, 处理器)` | bool | 为NE树实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3371 | `NE树_解绑鼠标移动` | `NE树_解绑鼠标移动(控件)` | bool | 移除NE树实例由代码绑定的“鼠标移动”处理器。 |
| 3372 | `NE树_绑定鼠标滚轮` | `NE树_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE树实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3373 | `NE树_解绑鼠标滚轮` | `NE树_解绑鼠标滚轮(控件)` | bool | 移除NE树实例由代码绑定的“鼠标滚轮”处理器。 |
| 3374 | `NE树_绑定获得焦点` | `NE树_绑定获得焦点(控件, 处理器)` | bool | 为NE树实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3375 | `NE树_解绑获得焦点` | `NE树_解绑获得焦点(控件)` | bool | 移除NE树实例由代码绑定的“获得焦点”处理器。 |
| 3376 | `NE树_绑定失去焦点` | `NE树_绑定失去焦点(控件, 处理器)` | bool | 为NE树实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3377 | `NE树_解绑失去焦点` | `NE树_解绑失去焦点(控件)` | bool | 移除NE树实例由代码绑定的“失去焦点”处理器。 |
| 3378 | `控件_创建NE树选择` | `控件_创建NE树选择(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE树选择 | 在当前 new_emoji 窗口运行时创建NE树选择，窗口拥有元素生命周期。 |
| 3379 | `通过标记文本获取NE树选择` | `通过标记文本获取NE树选择(标记文本)` | NE树选择 | 按区分大小写的非空文本标记查找NE树选择，找不到时返回无效引用。 |
| 3380 | `通过标记整数获取NE树选择` | `通过标记整数获取NE树选择(标记整数)` | NE树选择 | 按有符号 32 位整数标记查找NE树选择，找不到时返回无效引用。 |
| 3381 | `NE树选择_绑定选择变化` | `NE树选择_绑定选择变化(控件, 处理器)` | bool | 为NE树选择实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3382 | `NE树选择_解绑选择变化` | `NE树选择_解绑选择变化(控件)` | bool | 移除NE树选择实例由代码绑定的“选择变化”处理器。 |
| 3383 | `NE树选择_绑定节点事件` | `NE树选择_绑定节点事件(控件, 处理器)` | bool | 为NE树选择实例绑定“节点事件”处理器，处理器必须使用 &名称。 |
| 3384 | `NE树选择_解绑节点事件` | `NE树选择_解绑节点事件(控件)` | bool | 移除NE树选择实例由代码绑定的“节点事件”处理器。 |
| 3385 | `NE树选择_绑定懒加载` | `NE树选择_绑定懒加载(控件, 处理器)` | bool | 为NE树选择实例绑定“懒加载”处理器，处理器必须使用 &名称。 |
| 3386 | `NE树选择_解绑懒加载` | `NE树选择_解绑懒加载(控件)` | bool | 移除NE树选择实例由代码绑定的“懒加载”处理器。 |
| 3387 | `NE树选择_绑定拖拽完成` | `NE树选择_绑定拖拽完成(控件, 处理器)` | bool | 为NE树选择实例绑定“拖拽完成”处理器，处理器必须使用 &名称。 |
| 3388 | `NE树选择_解绑拖拽完成` | `NE树选择_解绑拖拽完成(控件)` | bool | 移除NE树选择实例由代码绑定的“拖拽完成”处理器。 |
| 3389 | `NE树选择_绑定允许拖拽` | `NE树选择_绑定允许拖拽(控件, 处理器)` | bool | 为NE树选择实例绑定“允许拖拽”处理器，处理器必须使用 &名称。 |
| 3390 | `NE树选择_解绑允许拖拽` | `NE树选择_解绑允许拖拽(控件)` | bool | 移除NE树选择实例由代码绑定的“允许拖拽”处理器。 |
| 3391 | `NE树选择_绑定允许放置` | `NE树选择_绑定允许放置(控件, 处理器)` | bool | 为NE树选择实例绑定“允许放置”处理器，处理器必须使用 &名称。 |
| 3392 | `NE树选择_解绑允许放置` | `NE树选择_解绑允许放置(控件)` | bool | 移除NE树选择实例由代码绑定的“允许放置”处理器。 |
| 3393 | `NE树选择_绑定鼠标进入` | `NE树选择_绑定鼠标进入(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3394 | `NE树选择_解绑鼠标进入` | `NE树选择_解绑鼠标进入(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标进入”处理器。 |
| 3395 | `NE树选择_绑定鼠标离开` | `NE树选择_绑定鼠标离开(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3396 | `NE树选择_解绑鼠标离开` | `NE树选择_解绑鼠标离开(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标离开”处理器。 |
| 3397 | `NE树选择_绑定鼠标按下` | `NE树选择_绑定鼠标按下(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3398 | `NE树选择_解绑鼠标按下` | `NE树选择_解绑鼠标按下(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标按下”处理器。 |
| 3399 | `NE树选择_绑定鼠标抬起` | `NE树选择_绑定鼠标抬起(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3400 | `NE树选择_解绑鼠标抬起` | `NE树选择_解绑鼠标抬起(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标抬起”处理器。 |
| 3401 | `NE树选择_绑定鼠标双击` | `NE树选择_绑定鼠标双击(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3402 | `NE树选择_解绑鼠标双击` | `NE树选择_解绑鼠标双击(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标双击”处理器。 |
| 3403 | `NE树选择_绑定鼠标移动` | `NE树选择_绑定鼠标移动(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3404 | `NE树选择_解绑鼠标移动` | `NE树选择_解绑鼠标移动(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标移动”处理器。 |
| 3405 | `NE树选择_绑定鼠标滚轮` | `NE树选择_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE树选择实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3406 | `NE树选择_解绑鼠标滚轮` | `NE树选择_解绑鼠标滚轮(控件)` | bool | 移除NE树选择实例由代码绑定的“鼠标滚轮”处理器。 |
| 3407 | `NE树选择_绑定获得焦点` | `NE树选择_绑定获得焦点(控件, 处理器)` | bool | 为NE树选择实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3408 | `NE树选择_解绑获得焦点` | `NE树选择_解绑获得焦点(控件)` | bool | 移除NE树选择实例由代码绑定的“获得焦点”处理器。 |
| 3409 | `NE树选择_绑定失去焦点` | `NE树选择_绑定失去焦点(控件, 处理器)` | bool | 为NE树选择实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3410 | `NE树选择_解绑失去焦点` | `NE树选择_解绑失去焦点(控件)` | bool | 移除NE树选择实例由代码绑定的“失去焦点”处理器。 |
| 3411 | `控件_创建NE穿梭框` | `控件_创建NE穿梭框(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE穿梭框 | 在当前 new_emoji 窗口运行时创建NE穿梭框，窗口拥有元素生命周期。 |
| 3412 | `通过标记文本获取NE穿梭框` | `通过标记文本获取NE穿梭框(标记文本)` | NE穿梭框 | 按区分大小写的非空文本标记查找NE穿梭框，找不到时返回无效引用。 |
| 3413 | `通过标记整数获取NE穿梭框` | `通过标记整数获取NE穿梭框(标记整数)` | NE穿梭框 | 按有符号 32 位整数标记查找NE穿梭框，找不到时返回无效引用。 |
| 3414 | `NE穿梭框_绑定选择变化` | `NE穿梭框_绑定选择变化(控件, 处理器)` | bool | 为NE穿梭框实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3415 | `NE穿梭框_解绑选择变化` | `NE穿梭框_解绑选择变化(控件)` | bool | 移除NE穿梭框实例由代码绑定的“选择变化”处理器。 |
| 3416 | `NE穿梭框_绑定鼠标进入` | `NE穿梭框_绑定鼠标进入(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3417 | `NE穿梭框_解绑鼠标进入` | `NE穿梭框_解绑鼠标进入(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标进入”处理器。 |
| 3418 | `NE穿梭框_绑定鼠标离开` | `NE穿梭框_绑定鼠标离开(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3419 | `NE穿梭框_解绑鼠标离开` | `NE穿梭框_解绑鼠标离开(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标离开”处理器。 |
| 3420 | `NE穿梭框_绑定鼠标按下` | `NE穿梭框_绑定鼠标按下(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3421 | `NE穿梭框_解绑鼠标按下` | `NE穿梭框_解绑鼠标按下(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标按下”处理器。 |
| 3422 | `NE穿梭框_绑定鼠标抬起` | `NE穿梭框_绑定鼠标抬起(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3423 | `NE穿梭框_解绑鼠标抬起` | `NE穿梭框_解绑鼠标抬起(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标抬起”处理器。 |
| 3424 | `NE穿梭框_绑定鼠标双击` | `NE穿梭框_绑定鼠标双击(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3425 | `NE穿梭框_解绑鼠标双击` | `NE穿梭框_解绑鼠标双击(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标双击”处理器。 |
| 3426 | `NE穿梭框_绑定鼠标移动` | `NE穿梭框_绑定鼠标移动(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3427 | `NE穿梭框_解绑鼠标移动` | `NE穿梭框_解绑鼠标移动(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标移动”处理器。 |
| 3428 | `NE穿梭框_绑定鼠标滚轮` | `NE穿梭框_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE穿梭框实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3429 | `NE穿梭框_解绑鼠标滚轮` | `NE穿梭框_解绑鼠标滚轮(控件)` | bool | 移除NE穿梭框实例由代码绑定的“鼠标滚轮”处理器。 |
| 3430 | `NE穿梭框_绑定获得焦点` | `NE穿梭框_绑定获得焦点(控件, 处理器)` | bool | 为NE穿梭框实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3431 | `NE穿梭框_解绑获得焦点` | `NE穿梭框_解绑获得焦点(控件)` | bool | 移除NE穿梭框实例由代码绑定的“获得焦点”处理器。 |
| 3432 | `NE穿梭框_绑定失去焦点` | `NE穿梭框_绑定失去焦点(控件, 处理器)` | bool | 为NE穿梭框实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3433 | `NE穿梭框_解绑失去焦点` | `NE穿梭框_解绑失去焦点(控件)` | bool | 移除NE穿梭框实例由代码绑定的“失去焦点”处理器。 |
| 3434 | `控件_创建NE自动完成` | `控件_创建NE自动完成(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE自动完成 | 在当前 new_emoji 窗口运行时创建NE自动完成，窗口拥有元素生命周期。 |
| 3435 | `通过标记文本获取NE自动完成` | `通过标记文本获取NE自动完成(标记文本)` | NE自动完成 | 按区分大小写的非空文本标记查找NE自动完成，找不到时返回无效引用。 |
| 3436 | `通过标记整数获取NE自动完成` | `通过标记整数获取NE自动完成(标记整数)` | NE自动完成 | 按有符号 32 位整数标记查找NE自动完成，找不到时返回无效引用。 |
| 3437 | `NE自动完成_绑定文本变化` | `NE自动完成_绑定文本变化(控件, 处理器)` | bool | 为NE自动完成实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 3438 | `NE自动完成_解绑文本变化` | `NE自动完成_解绑文本变化(控件)` | bool | 移除NE自动完成实例由代码绑定的“文本变化”处理器。 |
| 3439 | `NE自动完成_绑定鼠标进入` | `NE自动完成_绑定鼠标进入(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3440 | `NE自动完成_解绑鼠标进入` | `NE自动完成_解绑鼠标进入(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标进入”处理器。 |
| 3441 | `NE自动完成_绑定鼠标离开` | `NE自动完成_绑定鼠标离开(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3442 | `NE自动完成_解绑鼠标离开` | `NE自动完成_解绑鼠标离开(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标离开”处理器。 |
| 3443 | `NE自动完成_绑定鼠标按下` | `NE自动完成_绑定鼠标按下(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3444 | `NE自动完成_解绑鼠标按下` | `NE自动完成_解绑鼠标按下(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标按下”处理器。 |
| 3445 | `NE自动完成_绑定鼠标抬起` | `NE自动完成_绑定鼠标抬起(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3446 | `NE自动完成_解绑鼠标抬起` | `NE自动完成_解绑鼠标抬起(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标抬起”处理器。 |
| 3447 | `NE自动完成_绑定鼠标双击` | `NE自动完成_绑定鼠标双击(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3448 | `NE自动完成_解绑鼠标双击` | `NE自动完成_解绑鼠标双击(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标双击”处理器。 |
| 3449 | `NE自动完成_绑定鼠标移动` | `NE自动完成_绑定鼠标移动(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3450 | `NE自动完成_解绑鼠标移动` | `NE自动完成_解绑鼠标移动(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标移动”处理器。 |
| 3451 | `NE自动完成_绑定鼠标滚轮` | `NE自动完成_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE自动完成实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3452 | `NE自动完成_解绑鼠标滚轮` | `NE自动完成_解绑鼠标滚轮(控件)` | bool | 移除NE自动完成实例由代码绑定的“鼠标滚轮”处理器。 |
| 3453 | `NE自动完成_绑定获得焦点` | `NE自动完成_绑定获得焦点(控件, 处理器)` | bool | 为NE自动完成实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3454 | `NE自动完成_解绑获得焦点` | `NE自动完成_解绑获得焦点(控件)` | bool | 移除NE自动完成实例由代码绑定的“获得焦点”处理器。 |
| 3455 | `NE自动完成_绑定失去焦点` | `NE自动完成_绑定失去焦点(控件, 处理器)` | bool | 为NE自动完成实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3456 | `NE自动完成_解绑失去焦点` | `NE自动完成_解绑失去焦点(控件)` | bool | 移除NE自动完成实例由代码绑定的“失去焦点”处理器。 |
| 3457 | `控件_创建NE提及` | `控件_创建NE提及(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE提及 | 在当前 new_emoji 窗口运行时创建NE提及，窗口拥有元素生命周期。 |
| 3458 | `通过标记文本获取NE提及` | `通过标记文本获取NE提及(标记文本)` | NE提及 | 按区分大小写的非空文本标记查找NE提及，找不到时返回无效引用。 |
| 3459 | `通过标记整数获取NE提及` | `通过标记整数获取NE提及(标记整数)` | NE提及 | 按有符号 32 位整数标记查找NE提及，找不到时返回无效引用。 |
| 3460 | `NE提及_绑定文本变化` | `NE提及_绑定文本变化(控件, 处理器)` | bool | 为NE提及实例绑定“文本变化”处理器，处理器必须使用 &名称。 |
| 3461 | `NE提及_解绑文本变化` | `NE提及_解绑文本变化(控件)` | bool | 移除NE提及实例由代码绑定的“文本变化”处理器。 |
| 3462 | `NE提及_绑定鼠标进入` | `NE提及_绑定鼠标进入(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3463 | `NE提及_解绑鼠标进入` | `NE提及_解绑鼠标进入(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标进入”处理器。 |
| 3464 | `NE提及_绑定鼠标离开` | `NE提及_绑定鼠标离开(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3465 | `NE提及_解绑鼠标离开` | `NE提及_解绑鼠标离开(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标离开”处理器。 |
| 3466 | `NE提及_绑定鼠标按下` | `NE提及_绑定鼠标按下(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3467 | `NE提及_解绑鼠标按下` | `NE提及_解绑鼠标按下(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标按下”处理器。 |
| 3468 | `NE提及_绑定鼠标抬起` | `NE提及_绑定鼠标抬起(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3469 | `NE提及_解绑鼠标抬起` | `NE提及_解绑鼠标抬起(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标抬起”处理器。 |
| 3470 | `NE提及_绑定鼠标双击` | `NE提及_绑定鼠标双击(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3471 | `NE提及_解绑鼠标双击` | `NE提及_解绑鼠标双击(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标双击”处理器。 |
| 3472 | `NE提及_绑定鼠标移动` | `NE提及_绑定鼠标移动(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3473 | `NE提及_解绑鼠标移动` | `NE提及_解绑鼠标移动(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标移动”处理器。 |
| 3474 | `NE提及_绑定鼠标滚轮` | `NE提及_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE提及实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3475 | `NE提及_解绑鼠标滚轮` | `NE提及_解绑鼠标滚轮(控件)` | bool | 移除NE提及实例由代码绑定的“鼠标滚轮”处理器。 |
| 3476 | `NE提及_绑定获得焦点` | `NE提及_绑定获得焦点(控件, 处理器)` | bool | 为NE提及实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3477 | `NE提及_解绑获得焦点` | `NE提及_解绑获得焦点(控件)` | bool | 移除NE提及实例由代码绑定的“获得焦点”处理器。 |
| 3478 | `NE提及_绑定失去焦点` | `NE提及_绑定失去焦点(控件, 处理器)` | bool | 为NE提及实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3479 | `NE提及_解绑失去焦点` | `NE提及_解绑失去焦点(控件)` | bool | 移除NE提及实例由代码绑定的“失去焦点”处理器。 |
| 3480 | `控件_创建NE级联选择` | `控件_创建NE级联选择(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE级联选择 | 在当前 new_emoji 窗口运行时创建NE级联选择，窗口拥有元素生命周期。 |
| 3481 | `通过标记文本获取NE级联选择` | `通过标记文本获取NE级联选择(标记文本)` | NE级联选择 | 按区分大小写的非空文本标记查找NE级联选择，找不到时返回无效引用。 |
| 3482 | `通过标记整数获取NE级联选择` | `通过标记整数获取NE级联选择(标记整数)` | NE级联选择 | 按有符号 32 位整数标记查找NE级联选择，找不到时返回无效引用。 |
| 3483 | `NE级联选择_绑定选择变化` | `NE级联选择_绑定选择变化(控件, 处理器)` | bool | 为NE级联选择实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3484 | `NE级联选择_解绑选择变化` | `NE级联选择_解绑选择变化(控件)` | bool | 移除NE级联选择实例由代码绑定的“选择变化”处理器。 |
| 3485 | `NE级联选择_绑定鼠标进入` | `NE级联选择_绑定鼠标进入(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3486 | `NE级联选择_解绑鼠标进入` | `NE级联选择_解绑鼠标进入(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标进入”处理器。 |
| 3487 | `NE级联选择_绑定鼠标离开` | `NE级联选择_绑定鼠标离开(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3488 | `NE级联选择_解绑鼠标离开` | `NE级联选择_解绑鼠标离开(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标离开”处理器。 |
| 3489 | `NE级联选择_绑定鼠标按下` | `NE级联选择_绑定鼠标按下(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3490 | `NE级联选择_解绑鼠标按下` | `NE级联选择_解绑鼠标按下(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标按下”处理器。 |
| 3491 | `NE级联选择_绑定鼠标抬起` | `NE级联选择_绑定鼠标抬起(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3492 | `NE级联选择_解绑鼠标抬起` | `NE级联选择_解绑鼠标抬起(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标抬起”处理器。 |
| 3493 | `NE级联选择_绑定鼠标双击` | `NE级联选择_绑定鼠标双击(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3494 | `NE级联选择_解绑鼠标双击` | `NE级联选择_解绑鼠标双击(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标双击”处理器。 |
| 3495 | `NE级联选择_绑定鼠标移动` | `NE级联选择_绑定鼠标移动(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3496 | `NE级联选择_解绑鼠标移动` | `NE级联选择_解绑鼠标移动(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标移动”处理器。 |
| 3497 | `NE级联选择_绑定鼠标滚轮` | `NE级联选择_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE级联选择实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3498 | `NE级联选择_解绑鼠标滚轮` | `NE级联选择_解绑鼠标滚轮(控件)` | bool | 移除NE级联选择实例由代码绑定的“鼠标滚轮”处理器。 |
| 3499 | `NE级联选择_绑定获得焦点` | `NE级联选择_绑定获得焦点(控件, 处理器)` | bool | 为NE级联选择实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3500 | `NE级联选择_解绑获得焦点` | `NE级联选择_解绑获得焦点(控件)` | bool | 移除NE级联选择实例由代码绑定的“获得焦点”处理器。 |
| 3501 | `NE级联选择_绑定失去焦点` | `NE级联选择_绑定失去焦点(控件, 处理器)` | bool | 为NE级联选择实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3502 | `NE级联选择_解绑失去焦点` | `NE级联选择_解绑失去焦点(控件)` | bool | 移除NE级联选择实例由代码绑定的“失去焦点”处理器。 |
| 3503 | `控件_创建NE日期选择` | `控件_创建NE日期选择(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE日期选择 | 在当前 new_emoji 窗口运行时创建NE日期选择，窗口拥有元素生命周期。 |
| 3504 | `通过标记文本获取NE日期选择` | `通过标记文本获取NE日期选择(标记文本)` | NE日期选择 | 按区分大小写的非空文本标记查找NE日期选择，找不到时返回无效引用。 |
| 3505 | `通过标记整数获取NE日期选择` | `通过标记整数获取NE日期选择(标记整数)` | NE日期选择 | 按有符号 32 位整数标记查找NE日期选择，找不到时返回无效引用。 |
| 3506 | `NE日期选择_绑定选择变化` | `NE日期选择_绑定选择变化(控件, 处理器)` | bool | 为NE日期选择实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3507 | `NE日期选择_解绑选择变化` | `NE日期选择_解绑选择变化(控件)` | bool | 移除NE日期选择实例由代码绑定的“选择变化”处理器。 |
| 3508 | `NE日期选择_绑定禁用日期判断` | `NE日期选择_绑定禁用日期判断(控件, 处理器)` | bool | 为NE日期选择实例绑定“禁用日期判断”处理器，处理器必须使用 &名称。 |
| 3509 | `NE日期选择_解绑禁用日期判断` | `NE日期选择_解绑禁用日期判断(控件)` | bool | 移除NE日期选择实例由代码绑定的“禁用日期判断”处理器。 |
| 3510 | `NE日期选择_绑定鼠标进入` | `NE日期选择_绑定鼠标进入(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3511 | `NE日期选择_解绑鼠标进入` | `NE日期选择_解绑鼠标进入(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标进入”处理器。 |
| 3512 | `NE日期选择_绑定鼠标离开` | `NE日期选择_绑定鼠标离开(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3513 | `NE日期选择_解绑鼠标离开` | `NE日期选择_解绑鼠标离开(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标离开”处理器。 |
| 3514 | `NE日期选择_绑定鼠标按下` | `NE日期选择_绑定鼠标按下(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3515 | `NE日期选择_解绑鼠标按下` | `NE日期选择_解绑鼠标按下(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标按下”处理器。 |
| 3516 | `NE日期选择_绑定鼠标抬起` | `NE日期选择_绑定鼠标抬起(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3517 | `NE日期选择_解绑鼠标抬起` | `NE日期选择_解绑鼠标抬起(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标抬起”处理器。 |
| 3518 | `NE日期选择_绑定鼠标双击` | `NE日期选择_绑定鼠标双击(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3519 | `NE日期选择_解绑鼠标双击` | `NE日期选择_解绑鼠标双击(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标双击”处理器。 |
| 3520 | `NE日期选择_绑定鼠标移动` | `NE日期选择_绑定鼠标移动(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3521 | `NE日期选择_解绑鼠标移动` | `NE日期选择_解绑鼠标移动(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标移动”处理器。 |
| 3522 | `NE日期选择_绑定鼠标滚轮` | `NE日期选择_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE日期选择实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3523 | `NE日期选择_解绑鼠标滚轮` | `NE日期选择_解绑鼠标滚轮(控件)` | bool | 移除NE日期选择实例由代码绑定的“鼠标滚轮”处理器。 |
| 3524 | `NE日期选择_绑定获得焦点` | `NE日期选择_绑定获得焦点(控件, 处理器)` | bool | 为NE日期选择实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3525 | `NE日期选择_解绑获得焦点` | `NE日期选择_解绑获得焦点(控件)` | bool | 移除NE日期选择实例由代码绑定的“获得焦点”处理器。 |
| 3526 | `NE日期选择_绑定失去焦点` | `NE日期选择_绑定失去焦点(控件, 处理器)` | bool | 为NE日期选择实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3527 | `NE日期选择_解绑失去焦点` | `NE日期选择_解绑失去焦点(控件)` | bool | 移除NE日期选择实例由代码绑定的“失去焦点”处理器。 |
| 3528 | `控件_创建NE时间选择` | `控件_创建NE时间选择(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE时间选择 | 在当前 new_emoji 窗口运行时创建NE时间选择，窗口拥有元素生命周期。 |
| 3529 | `通过标记文本获取NE时间选择` | `通过标记文本获取NE时间选择(标记文本)` | NE时间选择 | 按区分大小写的非空文本标记查找NE时间选择，找不到时返回无效引用。 |
| 3530 | `通过标记整数获取NE时间选择` | `通过标记整数获取NE时间选择(标记整数)` | NE时间选择 | 按有符号 32 位整数标记查找NE时间选择，找不到时返回无效引用。 |
| 3531 | `NE时间选择_绑定选择变化` | `NE时间选择_绑定选择变化(控件, 处理器)` | bool | 为NE时间选择实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3532 | `NE时间选择_解绑选择变化` | `NE时间选择_解绑选择变化(控件)` | bool | 移除NE时间选择实例由代码绑定的“选择变化”处理器。 |
| 3533 | `NE时间选择_绑定鼠标进入` | `NE时间选择_绑定鼠标进入(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3534 | `NE时间选择_解绑鼠标进入` | `NE时间选择_解绑鼠标进入(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标进入”处理器。 |
| 3535 | `NE时间选择_绑定鼠标离开` | `NE时间选择_绑定鼠标离开(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3536 | `NE时间选择_解绑鼠标离开` | `NE时间选择_解绑鼠标离开(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标离开”处理器。 |
| 3537 | `NE时间选择_绑定鼠标按下` | `NE时间选择_绑定鼠标按下(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3538 | `NE时间选择_解绑鼠标按下` | `NE时间选择_解绑鼠标按下(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标按下”处理器。 |
| 3539 | `NE时间选择_绑定鼠标抬起` | `NE时间选择_绑定鼠标抬起(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3540 | `NE时间选择_解绑鼠标抬起` | `NE时间选择_解绑鼠标抬起(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标抬起”处理器。 |
| 3541 | `NE时间选择_绑定鼠标双击` | `NE时间选择_绑定鼠标双击(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3542 | `NE时间选择_解绑鼠标双击` | `NE时间选择_解绑鼠标双击(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标双击”处理器。 |
| 3543 | `NE时间选择_绑定鼠标移动` | `NE时间选择_绑定鼠标移动(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3544 | `NE时间选择_解绑鼠标移动` | `NE时间选择_解绑鼠标移动(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标移动”处理器。 |
| 3545 | `NE时间选择_绑定鼠标滚轮` | `NE时间选择_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE时间选择实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3546 | `NE时间选择_解绑鼠标滚轮` | `NE时间选择_解绑鼠标滚轮(控件)` | bool | 移除NE时间选择实例由代码绑定的“鼠标滚轮”处理器。 |
| 3547 | `NE时间选择_绑定获得焦点` | `NE时间选择_绑定获得焦点(控件, 处理器)` | bool | 为NE时间选择实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3548 | `NE时间选择_解绑获得焦点` | `NE时间选择_解绑获得焦点(控件)` | bool | 移除NE时间选择实例由代码绑定的“获得焦点”处理器。 |
| 3549 | `NE时间选择_绑定失去焦点` | `NE时间选择_绑定失去焦点(控件, 处理器)` | bool | 为NE时间选择实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3550 | `NE时间选择_解绑失去焦点` | `NE时间选择_解绑失去焦点(控件)` | bool | 移除NE时间选择实例由代码绑定的“失去焦点”处理器。 |
| 3551 | `控件_创建NE日期时间` | `控件_创建NE日期时间(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE日期时间 | 在当前 new_emoji 窗口运行时创建NE日期时间，窗口拥有元素生命周期。 |
| 3552 | `通过标记文本获取NE日期时间` | `通过标记文本获取NE日期时间(标记文本)` | NE日期时间 | 按区分大小写的非空文本标记查找NE日期时间，找不到时返回无效引用。 |
| 3553 | `通过标记整数获取NE日期时间` | `通过标记整数获取NE日期时间(标记整数)` | NE日期时间 | 按有符号 32 位整数标记查找NE日期时间，找不到时返回无效引用。 |
| 3554 | `NE日期时间_绑定选择变化` | `NE日期时间_绑定选择变化(控件, 处理器)` | bool | 为NE日期时间实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3555 | `NE日期时间_解绑选择变化` | `NE日期时间_解绑选择变化(控件)` | bool | 移除NE日期时间实例由代码绑定的“选择变化”处理器。 |
| 3556 | `NE日期时间_绑定鼠标进入` | `NE日期时间_绑定鼠标进入(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3557 | `NE日期时间_解绑鼠标进入` | `NE日期时间_解绑鼠标进入(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标进入”处理器。 |
| 3558 | `NE日期时间_绑定鼠标离开` | `NE日期时间_绑定鼠标离开(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3559 | `NE日期时间_解绑鼠标离开` | `NE日期时间_解绑鼠标离开(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标离开”处理器。 |
| 3560 | `NE日期时间_绑定鼠标按下` | `NE日期时间_绑定鼠标按下(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3561 | `NE日期时间_解绑鼠标按下` | `NE日期时间_解绑鼠标按下(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标按下”处理器。 |
| 3562 | `NE日期时间_绑定鼠标抬起` | `NE日期时间_绑定鼠标抬起(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3563 | `NE日期时间_解绑鼠标抬起` | `NE日期时间_解绑鼠标抬起(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标抬起”处理器。 |
| 3564 | `NE日期时间_绑定鼠标双击` | `NE日期时间_绑定鼠标双击(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3565 | `NE日期时间_解绑鼠标双击` | `NE日期时间_解绑鼠标双击(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标双击”处理器。 |
| 3566 | `NE日期时间_绑定鼠标移动` | `NE日期时间_绑定鼠标移动(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3567 | `NE日期时间_解绑鼠标移动` | `NE日期时间_解绑鼠标移动(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标移动”处理器。 |
| 3568 | `NE日期时间_绑定鼠标滚轮` | `NE日期时间_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE日期时间实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3569 | `NE日期时间_解绑鼠标滚轮` | `NE日期时间_解绑鼠标滚轮(控件)` | bool | 移除NE日期时间实例由代码绑定的“鼠标滚轮”处理器。 |
| 3570 | `NE日期时间_绑定获得焦点` | `NE日期时间_绑定获得焦点(控件, 处理器)` | bool | 为NE日期时间实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3571 | `NE日期时间_解绑获得焦点` | `NE日期时间_解绑获得焦点(控件)` | bool | 移除NE日期时间实例由代码绑定的“获得焦点”处理器。 |
| 3572 | `NE日期时间_绑定失去焦点` | `NE日期时间_绑定失去焦点(控件, 处理器)` | bool | 为NE日期时间实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3573 | `NE日期时间_解绑失去焦点` | `NE日期时间_解绑失去焦点(控件)` | bool | 移除NE日期时间实例由代码绑定的“失去焦点”处理器。 |
| 3574 | `控件_创建NE时间下拉` | `控件_创建NE时间下拉(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE时间下拉 | 在当前 new_emoji 窗口运行时创建NE时间下拉，窗口拥有元素生命周期。 |
| 3575 | `通过标记文本获取NE时间下拉` | `通过标记文本获取NE时间下拉(标记文本)` | NE时间下拉 | 按区分大小写的非空文本标记查找NE时间下拉，找不到时返回无效引用。 |
| 3576 | `通过标记整数获取NE时间下拉` | `通过标记整数获取NE时间下拉(标记整数)` | NE时间下拉 | 按有符号 32 位整数标记查找NE时间下拉，找不到时返回无效引用。 |
| 3577 | `NE时间下拉_绑定选择变化` | `NE时间下拉_绑定选择变化(控件, 处理器)` | bool | 为NE时间下拉实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3578 | `NE时间下拉_解绑选择变化` | `NE时间下拉_解绑选择变化(控件)` | bool | 移除NE时间下拉实例由代码绑定的“选择变化”处理器。 |
| 3579 | `NE时间下拉_绑定鼠标进入` | `NE时间下拉_绑定鼠标进入(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3580 | `NE时间下拉_解绑鼠标进入` | `NE时间下拉_解绑鼠标进入(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标进入”处理器。 |
| 3581 | `NE时间下拉_绑定鼠标离开` | `NE时间下拉_绑定鼠标离开(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3582 | `NE时间下拉_解绑鼠标离开` | `NE时间下拉_解绑鼠标离开(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标离开”处理器。 |
| 3583 | `NE时间下拉_绑定鼠标按下` | `NE时间下拉_绑定鼠标按下(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3584 | `NE时间下拉_解绑鼠标按下` | `NE时间下拉_解绑鼠标按下(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标按下”处理器。 |
| 3585 | `NE时间下拉_绑定鼠标抬起` | `NE时间下拉_绑定鼠标抬起(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3586 | `NE时间下拉_解绑鼠标抬起` | `NE时间下拉_解绑鼠标抬起(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标抬起”处理器。 |
| 3587 | `NE时间下拉_绑定鼠标双击` | `NE时间下拉_绑定鼠标双击(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3588 | `NE时间下拉_解绑鼠标双击` | `NE时间下拉_解绑鼠标双击(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标双击”处理器。 |
| 3589 | `NE时间下拉_绑定鼠标移动` | `NE时间下拉_绑定鼠标移动(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3590 | `NE时间下拉_解绑鼠标移动` | `NE时间下拉_解绑鼠标移动(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标移动”处理器。 |
| 3591 | `NE时间下拉_绑定鼠标滚轮` | `NE时间下拉_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE时间下拉实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3592 | `NE时间下拉_解绑鼠标滚轮` | `NE时间下拉_解绑鼠标滚轮(控件)` | bool | 移除NE时间下拉实例由代码绑定的“鼠标滚轮”处理器。 |
| 3593 | `NE时间下拉_绑定获得焦点` | `NE时间下拉_绑定获得焦点(控件, 处理器)` | bool | 为NE时间下拉实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3594 | `NE时间下拉_解绑获得焦点` | `NE时间下拉_解绑获得焦点(控件)` | bool | 移除NE时间下拉实例由代码绑定的“获得焦点”处理器。 |
| 3595 | `NE时间下拉_绑定失去焦点` | `NE时间下拉_绑定失去焦点(控件, 处理器)` | bool | 为NE时间下拉实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3596 | `NE时间下拉_解绑失去焦点` | `NE时间下拉_解绑失去焦点(控件)` | bool | 移除NE时间下拉实例由代码绑定的“失去焦点”处理器。 |
| 3597 | `控件_创建NE下拉菜单` | `控件_创建NE下拉菜单(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE下拉菜单 | 在当前 new_emoji 窗口运行时创建NE下拉菜单，窗口拥有元素生命周期。 |
| 3598 | `通过标记文本获取NE下拉菜单` | `通过标记文本获取NE下拉菜单(标记文本)` | NE下拉菜单 | 按区分大小写的非空文本标记查找NE下拉菜单，找不到时返回无效引用。 |
| 3599 | `通过标记整数获取NE下拉菜单` | `通过标记整数获取NE下拉菜单(标记整数)` | NE下拉菜单 | 按有符号 32 位整数标记查找NE下拉菜单，找不到时返回无效引用。 |
| 3600 | `NE下拉菜单_绑定下拉命令` | `NE下拉菜单_绑定下拉命令(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“下拉命令”处理器，处理器必须使用 &名称。 |
| 3601 | `NE下拉菜单_解绑下拉命令` | `NE下拉菜单_解绑下拉命令(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“下拉命令”处理器。 |
| 3602 | `NE下拉菜单_绑定选择变化` | `NE下拉菜单_绑定选择变化(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3603 | `NE下拉菜单_解绑选择变化` | `NE下拉菜单_解绑选择变化(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“选择变化”处理器。 |
| 3604 | `NE下拉菜单_绑定鼠标进入` | `NE下拉菜单_绑定鼠标进入(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3605 | `NE下拉菜单_解绑鼠标进入` | `NE下拉菜单_解绑鼠标进入(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标进入”处理器。 |
| 3606 | `NE下拉菜单_绑定鼠标离开` | `NE下拉菜单_绑定鼠标离开(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3607 | `NE下拉菜单_解绑鼠标离开` | `NE下拉菜单_解绑鼠标离开(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标离开”处理器。 |
| 3608 | `NE下拉菜单_绑定鼠标按下` | `NE下拉菜单_绑定鼠标按下(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3609 | `NE下拉菜单_解绑鼠标按下` | `NE下拉菜单_解绑鼠标按下(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标按下”处理器。 |
| 3610 | `NE下拉菜单_绑定鼠标抬起` | `NE下拉菜单_绑定鼠标抬起(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3611 | `NE下拉菜单_解绑鼠标抬起` | `NE下拉菜单_解绑鼠标抬起(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标抬起”处理器。 |
| 3612 | `NE下拉菜单_绑定鼠标双击` | `NE下拉菜单_绑定鼠标双击(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3613 | `NE下拉菜单_解绑鼠标双击` | `NE下拉菜单_解绑鼠标双击(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标双击”处理器。 |
| 3614 | `NE下拉菜单_绑定鼠标移动` | `NE下拉菜单_绑定鼠标移动(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3615 | `NE下拉菜单_解绑鼠标移动` | `NE下拉菜单_解绑鼠标移动(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标移动”处理器。 |
| 3616 | `NE下拉菜单_绑定鼠标滚轮` | `NE下拉菜单_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3617 | `NE下拉菜单_解绑鼠标滚轮` | `NE下拉菜单_解绑鼠标滚轮(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“鼠标滚轮”处理器。 |
| 3618 | `NE下拉菜单_绑定获得焦点` | `NE下拉菜单_绑定获得焦点(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3619 | `NE下拉菜单_解绑获得焦点` | `NE下拉菜单_解绑获得焦点(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“获得焦点”处理器。 |
| 3620 | `NE下拉菜单_绑定失去焦点` | `NE下拉菜单_绑定失去焦点(控件, 处理器)` | bool | 为NE下拉菜单实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3621 | `NE下拉菜单_解绑失去焦点` | `NE下拉菜单_解绑失去焦点(控件)` | bool | 移除NE下拉菜单实例由代码绑定的“失去焦点”处理器。 |
| 3622 | `控件_创建NE锚点` | `控件_创建NE锚点(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE锚点 | 在当前 new_emoji 窗口运行时创建NE锚点，窗口拥有元素生命周期。 |
| 3623 | `通过标记文本获取NE锚点` | `通过标记文本获取NE锚点(标记文本)` | NE锚点 | 按区分大小写的非空文本标记查找NE锚点，找不到时返回无效引用。 |
| 3624 | `通过标记整数获取NE锚点` | `通过标记整数获取NE锚点(标记整数)` | NE锚点 | 按有符号 32 位整数标记查找NE锚点，找不到时返回无效引用。 |
| 3625 | `NE锚点_绑定选择变化` | `NE锚点_绑定选择变化(控件, 处理器)` | bool | 为NE锚点实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3626 | `NE锚点_解绑选择变化` | `NE锚点_解绑选择变化(控件)` | bool | 移除NE锚点实例由代码绑定的“选择变化”处理器。 |
| 3627 | `NE锚点_绑定鼠标进入` | `NE锚点_绑定鼠标进入(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3628 | `NE锚点_解绑鼠标进入` | `NE锚点_解绑鼠标进入(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标进入”处理器。 |
| 3629 | `NE锚点_绑定鼠标离开` | `NE锚点_绑定鼠标离开(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3630 | `NE锚点_解绑鼠标离开` | `NE锚点_解绑鼠标离开(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标离开”处理器。 |
| 3631 | `NE锚点_绑定鼠标按下` | `NE锚点_绑定鼠标按下(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3632 | `NE锚点_解绑鼠标按下` | `NE锚点_解绑鼠标按下(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标按下”处理器。 |
| 3633 | `NE锚点_绑定鼠标抬起` | `NE锚点_绑定鼠标抬起(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3634 | `NE锚点_解绑鼠标抬起` | `NE锚点_解绑鼠标抬起(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标抬起”处理器。 |
| 3635 | `NE锚点_绑定鼠标双击` | `NE锚点_绑定鼠标双击(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3636 | `NE锚点_解绑鼠标双击` | `NE锚点_解绑鼠标双击(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标双击”处理器。 |
| 3637 | `NE锚点_绑定鼠标移动` | `NE锚点_绑定鼠标移动(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3638 | `NE锚点_解绑鼠标移动` | `NE锚点_解绑鼠标移动(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标移动”处理器。 |
| 3639 | `NE锚点_绑定鼠标滚轮` | `NE锚点_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE锚点实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3640 | `NE锚点_解绑鼠标滚轮` | `NE锚点_解绑鼠标滚轮(控件)` | bool | 移除NE锚点实例由代码绑定的“鼠标滚轮”处理器。 |
| 3641 | `NE锚点_绑定获得焦点` | `NE锚点_绑定获得焦点(控件, 处理器)` | bool | 为NE锚点实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3642 | `NE锚点_解绑获得焦点` | `NE锚点_解绑获得焦点(控件)` | bool | 移除NE锚点实例由代码绑定的“获得焦点”处理器。 |
| 3643 | `NE锚点_绑定失去焦点` | `NE锚点_绑定失去焦点(控件, 处理器)` | bool | 为NE锚点实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3644 | `NE锚点_解绑失去焦点` | `NE锚点_解绑失去焦点(控件)` | bool | 移除NE锚点实例由代码绑定的“失去焦点”处理器。 |
| 3645 | `控件_创建NE回到顶部` | `控件_创建NE回到顶部(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE回到顶部 | 在当前 new_emoji 窗口运行时创建NE回到顶部，窗口拥有元素生命周期。 |
| 3646 | `通过标记文本获取NE回到顶部` | `通过标记文本获取NE回到顶部(标记文本)` | NE回到顶部 | 按区分大小写的非空文本标记查找NE回到顶部，找不到时返回无效引用。 |
| 3647 | `通过标记整数获取NE回到顶部` | `通过标记整数获取NE回到顶部(标记整数)` | NE回到顶部 | 按有符号 32 位整数标记查找NE回到顶部，找不到时返回无效引用。 |
| 3648 | `NE回到顶部_绑定鼠标进入` | `NE回到顶部_绑定鼠标进入(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3649 | `NE回到顶部_解绑鼠标进入` | `NE回到顶部_解绑鼠标进入(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标进入”处理器。 |
| 3650 | `NE回到顶部_绑定鼠标离开` | `NE回到顶部_绑定鼠标离开(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3651 | `NE回到顶部_解绑鼠标离开` | `NE回到顶部_解绑鼠标离开(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标离开”处理器。 |
| 3652 | `NE回到顶部_绑定鼠标按下` | `NE回到顶部_绑定鼠标按下(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3653 | `NE回到顶部_解绑鼠标按下` | `NE回到顶部_解绑鼠标按下(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标按下”处理器。 |
| 3654 | `NE回到顶部_绑定鼠标抬起` | `NE回到顶部_绑定鼠标抬起(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3655 | `NE回到顶部_解绑鼠标抬起` | `NE回到顶部_解绑鼠标抬起(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标抬起”处理器。 |
| 3656 | `NE回到顶部_绑定鼠标双击` | `NE回到顶部_绑定鼠标双击(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3657 | `NE回到顶部_解绑鼠标双击` | `NE回到顶部_解绑鼠标双击(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标双击”处理器。 |
| 3658 | `NE回到顶部_绑定鼠标移动` | `NE回到顶部_绑定鼠标移动(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3659 | `NE回到顶部_解绑鼠标移动` | `NE回到顶部_解绑鼠标移动(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标移动”处理器。 |
| 3660 | `NE回到顶部_绑定鼠标滚轮` | `NE回到顶部_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE回到顶部实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3661 | `NE回到顶部_解绑鼠标滚轮` | `NE回到顶部_解绑鼠标滚轮(控件)` | bool | 移除NE回到顶部实例由代码绑定的“鼠标滚轮”处理器。 |
| 3662 | `NE回到顶部_绑定获得焦点` | `NE回到顶部_绑定获得焦点(控件, 处理器)` | bool | 为NE回到顶部实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3663 | `NE回到顶部_解绑获得焦点` | `NE回到顶部_解绑获得焦点(控件)` | bool | 移除NE回到顶部实例由代码绑定的“获得焦点”处理器。 |
| 3664 | `NE回到顶部_绑定失去焦点` | `NE回到顶部_绑定失去焦点(控件, 处理器)` | bool | 为NE回到顶部实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3665 | `NE回到顶部_解绑失去焦点` | `NE回到顶部_解绑失去焦点(控件)` | bool | 移除NE回到顶部实例由代码绑定的“失去焦点”处理器。 |
| 3666 | `控件_创建NE分段控制` | `控件_创建NE分段控制(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE分段控制 | 在当前 new_emoji 窗口运行时创建NE分段控制，窗口拥有元素生命周期。 |
| 3667 | `通过标记文本获取NE分段控制` | `通过标记文本获取NE分段控制(标记文本)` | NE分段控制 | 按区分大小写的非空文本标记查找NE分段控制，找不到时返回无效引用。 |
| 3668 | `通过标记整数获取NE分段控制` | `通过标记整数获取NE分段控制(标记整数)` | NE分段控制 | 按有符号 32 位整数标记查找NE分段控制，找不到时返回无效引用。 |
| 3669 | `NE分段控制_绑定选择变化` | `NE分段控制_绑定选择变化(控件, 处理器)` | bool | 为NE分段控制实例绑定“选择变化”处理器，处理器必须使用 &名称。 |
| 3670 | `NE分段控制_解绑选择变化` | `NE分段控制_解绑选择变化(控件)` | bool | 移除NE分段控制实例由代码绑定的“选择变化”处理器。 |
| 3671 | `NE分段控制_绑定鼠标进入` | `NE分段控制_绑定鼠标进入(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3672 | `NE分段控制_解绑鼠标进入` | `NE分段控制_解绑鼠标进入(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标进入”处理器。 |
| 3673 | `NE分段控制_绑定鼠标离开` | `NE分段控制_绑定鼠标离开(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3674 | `NE分段控制_解绑鼠标离开` | `NE分段控制_解绑鼠标离开(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标离开”处理器。 |
| 3675 | `NE分段控制_绑定鼠标按下` | `NE分段控制_绑定鼠标按下(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3676 | `NE分段控制_解绑鼠标按下` | `NE分段控制_解绑鼠标按下(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标按下”处理器。 |
| 3677 | `NE分段控制_绑定鼠标抬起` | `NE分段控制_绑定鼠标抬起(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3678 | `NE分段控制_解绑鼠标抬起` | `NE分段控制_解绑鼠标抬起(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标抬起”处理器。 |
| 3679 | `NE分段控制_绑定鼠标双击` | `NE分段控制_绑定鼠标双击(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3680 | `NE分段控制_解绑鼠标双击` | `NE分段控制_解绑鼠标双击(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标双击”处理器。 |
| 3681 | `NE分段控制_绑定鼠标移动` | `NE分段控制_绑定鼠标移动(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3682 | `NE分段控制_解绑鼠标移动` | `NE分段控制_解绑鼠标移动(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标移动”处理器。 |
| 3683 | `NE分段控制_绑定鼠标滚轮` | `NE分段控制_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE分段控制实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3684 | `NE分段控制_解绑鼠标滚轮` | `NE分段控制_解绑鼠标滚轮(控件)` | bool | 移除NE分段控制实例由代码绑定的“鼠标滚轮”处理器。 |
| 3685 | `NE分段控制_绑定获得焦点` | `NE分段控制_绑定获得焦点(控件, 处理器)` | bool | 为NE分段控制实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3686 | `NE分段控制_解绑获得焦点` | `NE分段控制_解绑获得焦点(控件)` | bool | 移除NE分段控制实例由代码绑定的“获得焦点”处理器。 |
| 3687 | `NE分段控制_绑定失去焦点` | `NE分段控制_绑定失去焦点(控件, 处理器)` | bool | 为NE分段控制实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3688 | `NE分段控制_解绑失去焦点` | `NE分段控制_解绑失去焦点(控件)` | bool | 移除NE分段控制实例由代码绑定的“失去焦点”处理器。 |
| 3689 | `控件_创建NE页头` | `控件_创建NE页头(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE页头 | 在当前 new_emoji 窗口运行时创建NE页头，窗口拥有元素生命周期。 |
| 3690 | `通过标记文本获取NE页头` | `通过标记文本获取NE页头(标记文本)` | NE页头 | 按区分大小写的非空文本标记查找NE页头，找不到时返回无效引用。 |
| 3691 | `通过标记整数获取NE页头` | `通过标记整数获取NE页头(标记整数)` | NE页头 | 按有符号 32 位整数标记查找NE页头，找不到时返回无效引用。 |
| 3692 | `NE页头_绑定被点击` | `NE页头_绑定被点击(控件, 处理器)` | bool | 为NE页头实例绑定“被点击”处理器，处理器必须使用 &名称。 |
| 3693 | `NE页头_解绑被点击` | `NE页头_解绑被点击(控件)` | bool | 移除NE页头实例由代码绑定的“被点击”处理器。 |
| 3694 | `NE页头_绑定鼠标进入` | `NE页头_绑定鼠标进入(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3695 | `NE页头_解绑鼠标进入` | `NE页头_解绑鼠标进入(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标进入”处理器。 |
| 3696 | `NE页头_绑定鼠标离开` | `NE页头_绑定鼠标离开(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3697 | `NE页头_解绑鼠标离开` | `NE页头_解绑鼠标离开(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标离开”处理器。 |
| 3698 | `NE页头_绑定鼠标按下` | `NE页头_绑定鼠标按下(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3699 | `NE页头_解绑鼠标按下` | `NE页头_解绑鼠标按下(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标按下”处理器。 |
| 3700 | `NE页头_绑定鼠标抬起` | `NE页头_绑定鼠标抬起(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3701 | `NE页头_解绑鼠标抬起` | `NE页头_解绑鼠标抬起(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标抬起”处理器。 |
| 3702 | `NE页头_绑定鼠标双击` | `NE页头_绑定鼠标双击(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3703 | `NE页头_解绑鼠标双击` | `NE页头_解绑鼠标双击(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标双击”处理器。 |
| 3704 | `NE页头_绑定鼠标移动` | `NE页头_绑定鼠标移动(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3705 | `NE页头_解绑鼠标移动` | `NE页头_解绑鼠标移动(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标移动”处理器。 |
| 3706 | `NE页头_绑定鼠标滚轮` | `NE页头_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE页头实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3707 | `NE页头_解绑鼠标滚轮` | `NE页头_解绑鼠标滚轮(控件)` | bool | 移除NE页头实例由代码绑定的“鼠标滚轮”处理器。 |
| 3708 | `NE页头_绑定获得焦点` | `NE页头_绑定获得焦点(控件, 处理器)` | bool | 为NE页头实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3709 | `NE页头_解绑获得焦点` | `NE页头_解绑获得焦点(控件)` | bool | 移除NE页头实例由代码绑定的“获得焦点”处理器。 |
| 3710 | `NE页头_绑定失去焦点` | `NE页头_绑定失去焦点(控件, 处理器)` | bool | 为NE页头实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3711 | `NE页头_解绑失去焦点` | `NE页头_解绑失去焦点(控件)` | bool | 移除NE页头实例由代码绑定的“失去焦点”处理器。 |
| 3712 | `控件_创建NE固钉` | `控件_创建NE固钉(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE固钉 | 在当前 new_emoji 窗口运行时创建NE固钉，窗口拥有元素生命周期。 |
| 3713 | `通过标记文本获取NE固钉` | `通过标记文本获取NE固钉(标记文本)` | NE固钉 | 按区分大小写的非空文本标记查找NE固钉，找不到时返回无效引用。 |
| 3714 | `通过标记整数获取NE固钉` | `通过标记整数获取NE固钉(标记整数)` | NE固钉 | 按有符号 32 位整数标记查找NE固钉，找不到时返回无效引用。 |
| 3715 | `NE固钉_绑定鼠标进入` | `NE固钉_绑定鼠标进入(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3716 | `NE固钉_解绑鼠标进入` | `NE固钉_解绑鼠标进入(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标进入”处理器。 |
| 3717 | `NE固钉_绑定鼠标离开` | `NE固钉_绑定鼠标离开(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3718 | `NE固钉_解绑鼠标离开` | `NE固钉_解绑鼠标离开(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标离开”处理器。 |
| 3719 | `NE固钉_绑定鼠标按下` | `NE固钉_绑定鼠标按下(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3720 | `NE固钉_解绑鼠标按下` | `NE固钉_解绑鼠标按下(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标按下”处理器。 |
| 3721 | `NE固钉_绑定鼠标抬起` | `NE固钉_绑定鼠标抬起(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3722 | `NE固钉_解绑鼠标抬起` | `NE固钉_解绑鼠标抬起(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标抬起”处理器。 |
| 3723 | `NE固钉_绑定鼠标双击` | `NE固钉_绑定鼠标双击(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3724 | `NE固钉_解绑鼠标双击` | `NE固钉_解绑鼠标双击(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标双击”处理器。 |
| 3725 | `NE固钉_绑定鼠标移动` | `NE固钉_绑定鼠标移动(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3726 | `NE固钉_解绑鼠标移动` | `NE固钉_解绑鼠标移动(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标移动”处理器。 |
| 3727 | `NE固钉_绑定鼠标滚轮` | `NE固钉_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE固钉实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3728 | `NE固钉_解绑鼠标滚轮` | `NE固钉_解绑鼠标滚轮(控件)` | bool | 移除NE固钉实例由代码绑定的“鼠标滚轮”处理器。 |
| 3729 | `NE固钉_绑定获得焦点` | `NE固钉_绑定获得焦点(控件, 处理器)` | bool | 为NE固钉实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3730 | `NE固钉_解绑获得焦点` | `NE固钉_解绑获得焦点(控件)` | bool | 移除NE固钉实例由代码绑定的“获得焦点”处理器。 |
| 3731 | `NE固钉_绑定失去焦点` | `NE固钉_绑定失去焦点(控件, 处理器)` | bool | 为NE固钉实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3732 | `NE固钉_解绑失去焦点` | `NE固钉_解绑失去焦点(控件)` | bool | 移除NE固钉实例由代码绑定的“失去焦点”处理器。 |
| 3733 | `控件_创建NE水印` | `控件_创建NE水印(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE水印 | 在当前 new_emoji 窗口运行时创建NE水印，窗口拥有元素生命周期。 |
| 3734 | `通过标记文本获取NE水印` | `通过标记文本获取NE水印(标记文本)` | NE水印 | 按区分大小写的非空文本标记查找NE水印，找不到时返回无效引用。 |
| 3735 | `通过标记整数获取NE水印` | `通过标记整数获取NE水印(标记整数)` | NE水印 | 按有符号 32 位整数标记查找NE水印，找不到时返回无效引用。 |
| 3736 | `NE水印_绑定鼠标进入` | `NE水印_绑定鼠标进入(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3737 | `NE水印_解绑鼠标进入` | `NE水印_解绑鼠标进入(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标进入”处理器。 |
| 3738 | `NE水印_绑定鼠标离开` | `NE水印_绑定鼠标离开(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3739 | `NE水印_解绑鼠标离开` | `NE水印_解绑鼠标离开(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标离开”处理器。 |
| 3740 | `NE水印_绑定鼠标按下` | `NE水印_绑定鼠标按下(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3741 | `NE水印_解绑鼠标按下` | `NE水印_解绑鼠标按下(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标按下”处理器。 |
| 3742 | `NE水印_绑定鼠标抬起` | `NE水印_绑定鼠标抬起(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3743 | `NE水印_解绑鼠标抬起` | `NE水印_解绑鼠标抬起(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标抬起”处理器。 |
| 3744 | `NE水印_绑定鼠标双击` | `NE水印_绑定鼠标双击(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3745 | `NE水印_解绑鼠标双击` | `NE水印_解绑鼠标双击(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标双击”处理器。 |
| 3746 | `NE水印_绑定鼠标移动` | `NE水印_绑定鼠标移动(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3747 | `NE水印_解绑鼠标移动` | `NE水印_解绑鼠标移动(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标移动”处理器。 |
| 3748 | `NE水印_绑定鼠标滚轮` | `NE水印_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE水印实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3749 | `NE水印_解绑鼠标滚轮` | `NE水印_解绑鼠标滚轮(控件)` | bool | 移除NE水印实例由代码绑定的“鼠标滚轮”处理器。 |
| 3750 | `NE水印_绑定获得焦点` | `NE水印_绑定获得焦点(控件, 处理器)` | bool | 为NE水印实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3751 | `NE水印_解绑获得焦点` | `NE水印_解绑获得焦点(控件)` | bool | 移除NE水印实例由代码绑定的“获得焦点”处理器。 |
| 3752 | `NE水印_绑定失去焦点` | `NE水印_绑定失去焦点(控件, 处理器)` | bool | 为NE水印实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3753 | `NE水印_解绑失去焦点` | `NE水印_解绑失去焦点(控件)` | bool | 移除NE水印实例由代码绑定的“失去焦点”处理器。 |
| 3754 | `控件_创建NE漫游引导` | `控件_创建NE漫游引导(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE漫游引导 | 在当前 new_emoji 窗口运行时创建NE漫游引导，窗口拥有元素生命周期。 |
| 3755 | `通过标记文本获取NE漫游引导` | `通过标记文本获取NE漫游引导(标记文本)` | NE漫游引导 | 按区分大小写的非空文本标记查找NE漫游引导，找不到时返回无效引用。 |
| 3756 | `通过标记整数获取NE漫游引导` | `通过标记整数获取NE漫游引导(标记整数)` | NE漫游引导 | 按有符号 32 位整数标记查找NE漫游引导，找不到时返回无效引用。 |
| 3757 | `NE漫游引导_绑定鼠标进入` | `NE漫游引导_绑定鼠标进入(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3758 | `NE漫游引导_解绑鼠标进入` | `NE漫游引导_解绑鼠标进入(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标进入”处理器。 |
| 3759 | `NE漫游引导_绑定鼠标离开` | `NE漫游引导_绑定鼠标离开(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3760 | `NE漫游引导_解绑鼠标离开` | `NE漫游引导_解绑鼠标离开(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标离开”处理器。 |
| 3761 | `NE漫游引导_绑定鼠标按下` | `NE漫游引导_绑定鼠标按下(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3762 | `NE漫游引导_解绑鼠标按下` | `NE漫游引导_解绑鼠标按下(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标按下”处理器。 |
| 3763 | `NE漫游引导_绑定鼠标抬起` | `NE漫游引导_绑定鼠标抬起(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3764 | `NE漫游引导_解绑鼠标抬起` | `NE漫游引导_解绑鼠标抬起(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标抬起”处理器。 |
| 3765 | `NE漫游引导_绑定鼠标双击` | `NE漫游引导_绑定鼠标双击(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3766 | `NE漫游引导_解绑鼠标双击` | `NE漫游引导_解绑鼠标双击(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标双击”处理器。 |
| 3767 | `NE漫游引导_绑定鼠标移动` | `NE漫游引导_绑定鼠标移动(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3768 | `NE漫游引导_解绑鼠标移动` | `NE漫游引导_解绑鼠标移动(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标移动”处理器。 |
| 3769 | `NE漫游引导_绑定鼠标滚轮` | `NE漫游引导_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE漫游引导实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3770 | `NE漫游引导_解绑鼠标滚轮` | `NE漫游引导_解绑鼠标滚轮(控件)` | bool | 移除NE漫游引导实例由代码绑定的“鼠标滚轮”处理器。 |
| 3771 | `NE漫游引导_绑定获得焦点` | `NE漫游引导_绑定获得焦点(控件, 处理器)` | bool | 为NE漫游引导实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3772 | `NE漫游引导_解绑获得焦点` | `NE漫游引导_解绑获得焦点(控件)` | bool | 移除NE漫游引导实例由代码绑定的“获得焦点”处理器。 |
| 3773 | `NE漫游引导_绑定失去焦点` | `NE漫游引导_绑定失去焦点(控件, 处理器)` | bool | 为NE漫游引导实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3774 | `NE漫游引导_解绑失去焦点` | `NE漫游引导_解绑失去焦点(控件)` | bool | 移除NE漫游引导实例由代码绑定的“失去焦点”处理器。 |
| 3775 | `控件_创建NE图片` | `控件_创建NE图片(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE图片 | 在当前 new_emoji 窗口运行时创建NE图片，窗口拥有元素生命周期。 |
| 3776 | `通过标记文本获取NE图片` | `通过标记文本获取NE图片(标记文本)` | NE图片 | 按区分大小写的非空文本标记查找NE图片，找不到时返回无效引用。 |
| 3777 | `通过标记整数获取NE图片` | `通过标记整数获取NE图片(标记整数)` | NE图片 | 按有符号 32 位整数标记查找NE图片，找不到时返回无效引用。 |
| 3778 | `NE图片_绑定鼠标进入` | `NE图片_绑定鼠标进入(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3779 | `NE图片_解绑鼠标进入` | `NE图片_解绑鼠标进入(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标进入”处理器。 |
| 3780 | `NE图片_绑定鼠标离开` | `NE图片_绑定鼠标离开(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3781 | `NE图片_解绑鼠标离开` | `NE图片_解绑鼠标离开(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标离开”处理器。 |
| 3782 | `NE图片_绑定鼠标按下` | `NE图片_绑定鼠标按下(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3783 | `NE图片_解绑鼠标按下` | `NE图片_解绑鼠标按下(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标按下”处理器。 |
| 3784 | `NE图片_绑定鼠标抬起` | `NE图片_绑定鼠标抬起(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3785 | `NE图片_解绑鼠标抬起` | `NE图片_解绑鼠标抬起(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标抬起”处理器。 |
| 3786 | `NE图片_绑定鼠标双击` | `NE图片_绑定鼠标双击(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3787 | `NE图片_解绑鼠标双击` | `NE图片_解绑鼠标双击(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标双击”处理器。 |
| 3788 | `NE图片_绑定鼠标移动` | `NE图片_绑定鼠标移动(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3789 | `NE图片_解绑鼠标移动` | `NE图片_解绑鼠标移动(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标移动”处理器。 |
| 3790 | `NE图片_绑定鼠标滚轮` | `NE图片_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE图片实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3791 | `NE图片_解绑鼠标滚轮` | `NE图片_解绑鼠标滚轮(控件)` | bool | 移除NE图片实例由代码绑定的“鼠标滚轮”处理器。 |
| 3792 | `NE图片_绑定获得焦点` | `NE图片_绑定获得焦点(控件, 处理器)` | bool | 为NE图片实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3793 | `NE图片_解绑获得焦点` | `NE图片_解绑获得焦点(控件)` | bool | 移除NE图片实例由代码绑定的“获得焦点”处理器。 |
| 3794 | `NE图片_绑定失去焦点` | `NE图片_绑定失去焦点(控件, 处理器)` | bool | 为NE图片实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3795 | `NE图片_解绑失去焦点` | `NE图片_解绑失去焦点(控件)` | bool | 移除NE图片实例由代码绑定的“失去焦点”处理器。 |
| 3796 | `控件_创建NE轮播` | `控件_创建NE轮播(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE轮播 | 在当前 new_emoji 窗口运行时创建NE轮播，窗口拥有元素生命周期。 |
| 3797 | `通过标记文本获取NE轮播` | `通过标记文本获取NE轮播(标记文本)` | NE轮播 | 按区分大小写的非空文本标记查找NE轮播，找不到时返回无效引用。 |
| 3798 | `通过标记整数获取NE轮播` | `通过标记整数获取NE轮播(标记整数)` | NE轮播 | 按有符号 32 位整数标记查找NE轮播，找不到时返回无效引用。 |
| 3799 | `NE轮播_绑定鼠标进入` | `NE轮播_绑定鼠标进入(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3800 | `NE轮播_解绑鼠标进入` | `NE轮播_解绑鼠标进入(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标进入”处理器。 |
| 3801 | `NE轮播_绑定鼠标离开` | `NE轮播_绑定鼠标离开(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3802 | `NE轮播_解绑鼠标离开` | `NE轮播_解绑鼠标离开(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标离开”处理器。 |
| 3803 | `NE轮播_绑定鼠标按下` | `NE轮播_绑定鼠标按下(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3804 | `NE轮播_解绑鼠标按下` | `NE轮播_解绑鼠标按下(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标按下”处理器。 |
| 3805 | `NE轮播_绑定鼠标抬起` | `NE轮播_绑定鼠标抬起(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3806 | `NE轮播_解绑鼠标抬起` | `NE轮播_解绑鼠标抬起(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标抬起”处理器。 |
| 3807 | `NE轮播_绑定鼠标双击` | `NE轮播_绑定鼠标双击(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3808 | `NE轮播_解绑鼠标双击` | `NE轮播_解绑鼠标双击(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标双击”处理器。 |
| 3809 | `NE轮播_绑定鼠标移动` | `NE轮播_绑定鼠标移动(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3810 | `NE轮播_解绑鼠标移动` | `NE轮播_解绑鼠标移动(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标移动”处理器。 |
| 3811 | `NE轮播_绑定鼠标滚轮` | `NE轮播_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE轮播实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3812 | `NE轮播_解绑鼠标滚轮` | `NE轮播_解绑鼠标滚轮(控件)` | bool | 移除NE轮播实例由代码绑定的“鼠标滚轮”处理器。 |
| 3813 | `NE轮播_绑定获得焦点` | `NE轮播_绑定获得焦点(控件, 处理器)` | bool | 为NE轮播实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3814 | `NE轮播_解绑获得焦点` | `NE轮播_解绑获得焦点(控件)` | bool | 移除NE轮播实例由代码绑定的“获得焦点”处理器。 |
| 3815 | `NE轮播_绑定失去焦点` | `NE轮播_绑定失去焦点(控件, 处理器)` | bool | 为NE轮播实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3816 | `NE轮播_解绑失去焦点` | `NE轮播_解绑失去焦点(控件)` | bool | 移除NE轮播实例由代码绑定的“失去焦点”处理器。 |
| 3817 | `控件_创建NE上传` | `控件_创建NE上传(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE上传 | 在当前 new_emoji 窗口运行时创建NE上传，窗口拥有元素生命周期。 |
| 3818 | `通过标记文本获取NE上传` | `通过标记文本获取NE上传(标记文本)` | NE上传 | 按区分大小写的非空文本标记查找NE上传，找不到时返回无效引用。 |
| 3819 | `通过标记整数获取NE上传` | `通过标记整数获取NE上传(标记整数)` | NE上传 | 按有符号 32 位整数标记查找NE上传，找不到时返回无效引用。 |
| 3820 | `NE上传_绑定文件选择` | `NE上传_绑定文件选择(控件, 处理器)` | bool | 为NE上传实例绑定“文件选择”处理器，处理器必须使用 &名称。 |
| 3821 | `NE上传_解绑文件选择` | `NE上传_解绑文件选择(控件)` | bool | 移除NE上传实例由代码绑定的“文件选择”处理器。 |
| 3822 | `NE上传_绑定上传动作` | `NE上传_绑定上传动作(控件, 处理器)` | bool | 为NE上传实例绑定“上传动作”处理器，处理器必须使用 &名称。 |
| 3823 | `NE上传_解绑上传动作` | `NE上传_解绑上传动作(控件)` | bool | 移除NE上传实例由代码绑定的“上传动作”处理器。 |
| 3824 | `NE上传_绑定鼠标进入` | `NE上传_绑定鼠标进入(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3825 | `NE上传_解绑鼠标进入` | `NE上传_解绑鼠标进入(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标进入”处理器。 |
| 3826 | `NE上传_绑定鼠标离开` | `NE上传_绑定鼠标离开(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3827 | `NE上传_解绑鼠标离开` | `NE上传_解绑鼠标离开(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标离开”处理器。 |
| 3828 | `NE上传_绑定鼠标按下` | `NE上传_绑定鼠标按下(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3829 | `NE上传_解绑鼠标按下` | `NE上传_解绑鼠标按下(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标按下”处理器。 |
| 3830 | `NE上传_绑定鼠标抬起` | `NE上传_绑定鼠标抬起(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3831 | `NE上传_解绑鼠标抬起` | `NE上传_解绑鼠标抬起(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标抬起”处理器。 |
| 3832 | `NE上传_绑定鼠标双击` | `NE上传_绑定鼠标双击(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3833 | `NE上传_解绑鼠标双击` | `NE上传_解绑鼠标双击(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标双击”处理器。 |
| 3834 | `NE上传_绑定鼠标移动` | `NE上传_绑定鼠标移动(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3835 | `NE上传_解绑鼠标移动` | `NE上传_解绑鼠标移动(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标移动”处理器。 |
| 3836 | `NE上传_绑定鼠标滚轮` | `NE上传_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE上传实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3837 | `NE上传_解绑鼠标滚轮` | `NE上传_解绑鼠标滚轮(控件)` | bool | 移除NE上传实例由代码绑定的“鼠标滚轮”处理器。 |
| 3838 | `NE上传_绑定获得焦点` | `NE上传_绑定获得焦点(控件, 处理器)` | bool | 为NE上传实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3839 | `NE上传_解绑获得焦点` | `NE上传_解绑获得焦点(控件)` | bool | 移除NE上传实例由代码绑定的“获得焦点”处理器。 |
| 3840 | `NE上传_绑定失去焦点` | `NE上传_绑定失去焦点(控件, 处理器)` | bool | 为NE上传实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3841 | `NE上传_解绑失去焦点` | `NE上传_解绑失去焦点(控件)` | bool | 移除NE上传实例由代码绑定的“失去焦点”处理器。 |
| 3842 | `控件_创建NE无限滚动` | `控件_创建NE无限滚动(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE无限滚动 | 在当前 new_emoji 窗口运行时创建NE无限滚动，窗口拥有元素生命周期。 |
| 3843 | `通过标记文本获取NE无限滚动` | `通过标记文本获取NE无限滚动(标记文本)` | NE无限滚动 | 按区分大小写的非空文本标记查找NE无限滚动，找不到时返回无效引用。 |
| 3844 | `通过标记整数获取NE无限滚动` | `通过标记整数获取NE无限滚动(标记整数)` | NE无限滚动 | 按有符号 32 位整数标记查找NE无限滚动，找不到时返回无效引用。 |
| 3845 | `NE无限滚动_绑定鼠标进入` | `NE无限滚动_绑定鼠标进入(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3846 | `NE无限滚动_解绑鼠标进入` | `NE无限滚动_解绑鼠标进入(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标进入”处理器。 |
| 3847 | `NE无限滚动_绑定鼠标离开` | `NE无限滚动_绑定鼠标离开(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3848 | `NE无限滚动_解绑鼠标离开` | `NE无限滚动_解绑鼠标离开(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标离开”处理器。 |
| 3849 | `NE无限滚动_绑定鼠标按下` | `NE无限滚动_绑定鼠标按下(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3850 | `NE无限滚动_解绑鼠标按下` | `NE无限滚动_解绑鼠标按下(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标按下”处理器。 |
| 3851 | `NE无限滚动_绑定鼠标抬起` | `NE无限滚动_绑定鼠标抬起(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3852 | `NE无限滚动_解绑鼠标抬起` | `NE无限滚动_解绑鼠标抬起(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标抬起”处理器。 |
| 3853 | `NE无限滚动_绑定鼠标双击` | `NE无限滚动_绑定鼠标双击(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3854 | `NE无限滚动_解绑鼠标双击` | `NE无限滚动_解绑鼠标双击(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标双击”处理器。 |
| 3855 | `NE无限滚动_绑定鼠标移动` | `NE无限滚动_绑定鼠标移动(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3856 | `NE无限滚动_解绑鼠标移动` | `NE无限滚动_解绑鼠标移动(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标移动”处理器。 |
| 3857 | `NE无限滚动_绑定鼠标滚轮` | `NE无限滚动_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE无限滚动实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3858 | `NE无限滚动_解绑鼠标滚轮` | `NE无限滚动_解绑鼠标滚轮(控件)` | bool | 移除NE无限滚动实例由代码绑定的“鼠标滚轮”处理器。 |
| 3859 | `NE无限滚动_绑定获得焦点` | `NE无限滚动_绑定获得焦点(控件, 处理器)` | bool | 为NE无限滚动实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3860 | `NE无限滚动_解绑获得焦点` | `NE无限滚动_解绑获得焦点(控件)` | bool | 移除NE无限滚动实例由代码绑定的“获得焦点”处理器。 |
| 3861 | `NE无限滚动_绑定失去焦点` | `NE无限滚动_绑定失去焦点(控件, 处理器)` | bool | 为NE无限滚动实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3862 | `NE无限滚动_解绑失去焦点` | `NE无限滚动_解绑失去焦点(控件)` | bool | 移除NE无限滚动实例由代码绑定的“失去焦点”处理器。 |
| 3863 | `控件_创建NE加载` | `控件_创建NE加载(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE加载 | 在当前 new_emoji 窗口运行时创建NE加载，窗口拥有元素生命周期。 |
| 3864 | `通过标记文本获取NE加载` | `通过标记文本获取NE加载(标记文本)` | NE加载 | 按区分大小写的非空文本标记查找NE加载，找不到时返回无效引用。 |
| 3865 | `通过标记整数获取NE加载` | `通过标记整数获取NE加载(标记整数)` | NE加载 | 按有符号 32 位整数标记查找NE加载，找不到时返回无效引用。 |
| 3866 | `NE加载_绑定鼠标进入` | `NE加载_绑定鼠标进入(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3867 | `NE加载_解绑鼠标进入` | `NE加载_解绑鼠标进入(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标进入”处理器。 |
| 3868 | `NE加载_绑定鼠标离开` | `NE加载_绑定鼠标离开(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3869 | `NE加载_解绑鼠标离开` | `NE加载_解绑鼠标离开(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标离开”处理器。 |
| 3870 | `NE加载_绑定鼠标按下` | `NE加载_绑定鼠标按下(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3871 | `NE加载_解绑鼠标按下` | `NE加载_解绑鼠标按下(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标按下”处理器。 |
| 3872 | `NE加载_绑定鼠标抬起` | `NE加载_绑定鼠标抬起(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3873 | `NE加载_解绑鼠标抬起` | `NE加载_解绑鼠标抬起(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标抬起”处理器。 |
| 3874 | `NE加载_绑定鼠标双击` | `NE加载_绑定鼠标双击(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3875 | `NE加载_解绑鼠标双击` | `NE加载_解绑鼠标双击(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标双击”处理器。 |
| 3876 | `NE加载_绑定鼠标移动` | `NE加载_绑定鼠标移动(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3877 | `NE加载_解绑鼠标移动` | `NE加载_解绑鼠标移动(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标移动”处理器。 |
| 3878 | `NE加载_绑定鼠标滚轮` | `NE加载_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE加载实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3879 | `NE加载_解绑鼠标滚轮` | `NE加载_解绑鼠标滚轮(控件)` | bool | 移除NE加载实例由代码绑定的“鼠标滚轮”处理器。 |
| 3880 | `NE加载_绑定获得焦点` | `NE加载_绑定获得焦点(控件, 处理器)` | bool | 为NE加载实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3881 | `NE加载_解绑获得焦点` | `NE加载_解绑获得焦点(控件)` | bool | 移除NE加载实例由代码绑定的“获得焦点”处理器。 |
| 3882 | `NE加载_绑定失去焦点` | `NE加载_绑定失去焦点(控件, 处理器)` | bool | 为NE加载实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3883 | `NE加载_解绑失去焦点` | `NE加载_解绑失去焦点(控件)` | bool | 移除NE加载实例由代码绑定的“失去焦点”处理器。 |
| 3884 | `控件_创建NE文字提示` | `控件_创建NE文字提示(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE文字提示 | 在当前 new_emoji 窗口运行时创建NE文字提示，窗口拥有元素生命周期。 |
| 3885 | `通过标记文本获取NE文字提示` | `通过标记文本获取NE文字提示(标记文本)` | NE文字提示 | 按区分大小写的非空文本标记查找NE文字提示，找不到时返回无效引用。 |
| 3886 | `通过标记整数获取NE文字提示` | `通过标记整数获取NE文字提示(标记整数)` | NE文字提示 | 按有符号 32 位整数标记查找NE文字提示，找不到时返回无效引用。 |
| 3887 | `NE文字提示_绑定鼠标进入` | `NE文字提示_绑定鼠标进入(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3888 | `NE文字提示_解绑鼠标进入` | `NE文字提示_解绑鼠标进入(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标进入”处理器。 |
| 3889 | `NE文字提示_绑定鼠标离开` | `NE文字提示_绑定鼠标离开(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3890 | `NE文字提示_解绑鼠标离开` | `NE文字提示_解绑鼠标离开(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标离开”处理器。 |
| 3891 | `NE文字提示_绑定鼠标按下` | `NE文字提示_绑定鼠标按下(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3892 | `NE文字提示_解绑鼠标按下` | `NE文字提示_解绑鼠标按下(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标按下”处理器。 |
| 3893 | `NE文字提示_绑定鼠标抬起` | `NE文字提示_绑定鼠标抬起(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3894 | `NE文字提示_解绑鼠标抬起` | `NE文字提示_解绑鼠标抬起(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标抬起”处理器。 |
| 3895 | `NE文字提示_绑定鼠标双击` | `NE文字提示_绑定鼠标双击(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3896 | `NE文字提示_解绑鼠标双击` | `NE文字提示_解绑鼠标双击(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标双击”处理器。 |
| 3897 | `NE文字提示_绑定鼠标移动` | `NE文字提示_绑定鼠标移动(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3898 | `NE文字提示_解绑鼠标移动` | `NE文字提示_解绑鼠标移动(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标移动”处理器。 |
| 3899 | `NE文字提示_绑定鼠标滚轮` | `NE文字提示_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE文字提示实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3900 | `NE文字提示_解绑鼠标滚轮` | `NE文字提示_解绑鼠标滚轮(控件)` | bool | 移除NE文字提示实例由代码绑定的“鼠标滚轮”处理器。 |
| 3901 | `NE文字提示_绑定获得焦点` | `NE文字提示_绑定获得焦点(控件, 处理器)` | bool | 为NE文字提示实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3902 | `NE文字提示_解绑获得焦点` | `NE文字提示_解绑获得焦点(控件)` | bool | 移除NE文字提示实例由代码绑定的“获得焦点”处理器。 |
| 3903 | `NE文字提示_绑定失去焦点` | `NE文字提示_绑定失去焦点(控件, 处理器)` | bool | 为NE文字提示实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3904 | `NE文字提示_解绑失去焦点` | `NE文字提示_解绑失去焦点(控件)` | bool | 移除NE文字提示实例由代码绑定的“失去焦点”处理器。 |
| 3905 | `控件_创建NE气泡卡片` | `控件_创建NE气泡卡片(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE气泡卡片 | 在当前 new_emoji 窗口运行时创建NE气泡卡片，窗口拥有元素生命周期。 |
| 3906 | `通过标记文本获取NE气泡卡片` | `通过标记文本获取NE气泡卡片(标记文本)` | NE气泡卡片 | 按区分大小写的非空文本标记查找NE气泡卡片，找不到时返回无效引用。 |
| 3907 | `通过标记整数获取NE气泡卡片` | `通过标记整数获取NE气泡卡片(标记整数)` | NE气泡卡片 | 按有符号 32 位整数标记查找NE气泡卡片，找不到时返回无效引用。 |
| 3908 | `NE气泡卡片_绑定动作回调` | `NE气泡卡片_绑定动作回调(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“动作回调”处理器，处理器必须使用 &名称。 |
| 3909 | `NE气泡卡片_解绑动作回调` | `NE气泡卡片_解绑动作回调(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“动作回调”处理器。 |
| 3910 | `NE气泡卡片_绑定鼠标进入` | `NE气泡卡片_绑定鼠标进入(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3911 | `NE气泡卡片_解绑鼠标进入` | `NE气泡卡片_解绑鼠标进入(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标进入”处理器。 |
| 3912 | `NE气泡卡片_绑定鼠标离开` | `NE气泡卡片_绑定鼠标离开(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3913 | `NE气泡卡片_解绑鼠标离开` | `NE气泡卡片_解绑鼠标离开(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标离开”处理器。 |
| 3914 | `NE气泡卡片_绑定鼠标按下` | `NE气泡卡片_绑定鼠标按下(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3915 | `NE气泡卡片_解绑鼠标按下` | `NE气泡卡片_解绑鼠标按下(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标按下”处理器。 |
| 3916 | `NE气泡卡片_绑定鼠标抬起` | `NE气泡卡片_绑定鼠标抬起(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3917 | `NE气泡卡片_解绑鼠标抬起` | `NE气泡卡片_解绑鼠标抬起(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标抬起”处理器。 |
| 3918 | `NE气泡卡片_绑定鼠标双击` | `NE气泡卡片_绑定鼠标双击(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3919 | `NE气泡卡片_解绑鼠标双击` | `NE气泡卡片_解绑鼠标双击(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标双击”处理器。 |
| 3920 | `NE气泡卡片_绑定鼠标移动` | `NE气泡卡片_绑定鼠标移动(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3921 | `NE气泡卡片_解绑鼠标移动` | `NE气泡卡片_解绑鼠标移动(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标移动”处理器。 |
| 3922 | `NE气泡卡片_绑定鼠标滚轮` | `NE气泡卡片_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3923 | `NE气泡卡片_解绑鼠标滚轮` | `NE气泡卡片_解绑鼠标滚轮(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“鼠标滚轮”处理器。 |
| 3924 | `NE气泡卡片_绑定获得焦点` | `NE气泡卡片_绑定获得焦点(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3925 | `NE气泡卡片_解绑获得焦点` | `NE气泡卡片_解绑获得焦点(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“获得焦点”处理器。 |
| 3926 | `NE气泡卡片_绑定失去焦点` | `NE气泡卡片_绑定失去焦点(控件, 处理器)` | bool | 为NE气泡卡片实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3927 | `NE气泡卡片_解绑失去焦点` | `NE气泡卡片_解绑失去焦点(控件)` | bool | 移除NE气泡卡片实例由代码绑定的“失去焦点”处理器。 |
| 3928 | `控件_创建NE气泡确认` | `控件_创建NE气泡确认(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE气泡确认 | 在当前 new_emoji 窗口运行时创建NE气泡确认，窗口拥有元素生命周期。 |
| 3929 | `通过标记文本获取NE气泡确认` | `通过标记文本获取NE气泡确认(标记文本)` | NE气泡确认 | 按区分大小写的非空文本标记查找NE气泡确认，找不到时返回无效引用。 |
| 3930 | `通过标记整数获取NE气泡确认` | `通过标记整数获取NE气泡确认(标记整数)` | NE气泡确认 | 按有符号 32 位整数标记查找NE气泡确认，找不到时返回无效引用。 |
| 3931 | `NE气泡确认_绑定结果变化` | `NE气泡确认_绑定结果变化(控件, 处理器)` | bool | 为NE气泡确认实例绑定“结果变化”处理器，处理器必须使用 &名称。 |
| 3932 | `NE气泡确认_解绑结果变化` | `NE气泡确认_解绑结果变化(控件)` | bool | 移除NE气泡确认实例由代码绑定的“结果变化”处理器。 |
| 3933 | `NE气泡确认_绑定鼠标进入` | `NE气泡确认_绑定鼠标进入(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3934 | `NE气泡确认_解绑鼠标进入` | `NE气泡确认_解绑鼠标进入(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标进入”处理器。 |
| 3935 | `NE气泡确认_绑定鼠标离开` | `NE气泡确认_绑定鼠标离开(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3936 | `NE气泡确认_解绑鼠标离开` | `NE气泡确认_解绑鼠标离开(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标离开”处理器。 |
| 3937 | `NE气泡确认_绑定鼠标按下` | `NE气泡确认_绑定鼠标按下(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3938 | `NE气泡确认_解绑鼠标按下` | `NE气泡确认_解绑鼠标按下(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标按下”处理器。 |
| 3939 | `NE气泡确认_绑定鼠标抬起` | `NE气泡确认_绑定鼠标抬起(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3940 | `NE气泡确认_解绑鼠标抬起` | `NE气泡确认_解绑鼠标抬起(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标抬起”处理器。 |
| 3941 | `NE气泡确认_绑定鼠标双击` | `NE气泡确认_绑定鼠标双击(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3942 | `NE气泡确认_解绑鼠标双击` | `NE气泡确认_解绑鼠标双击(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标双击”处理器。 |
| 3943 | `NE气泡确认_绑定鼠标移动` | `NE气泡确认_绑定鼠标移动(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3944 | `NE气泡确认_解绑鼠标移动` | `NE气泡确认_解绑鼠标移动(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标移动”处理器。 |
| 3945 | `NE气泡确认_绑定鼠标滚轮` | `NE气泡确认_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE气泡确认实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3946 | `NE气泡确认_解绑鼠标滚轮` | `NE气泡确认_解绑鼠标滚轮(控件)` | bool | 移除NE气泡确认实例由代码绑定的“鼠标滚轮”处理器。 |
| 3947 | `NE气泡确认_绑定获得焦点` | `NE气泡确认_绑定获得焦点(控件, 处理器)` | bool | 为NE气泡确认实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3948 | `NE气泡确认_解绑获得焦点` | `NE气泡确认_解绑获得焦点(控件)` | bool | 移除NE气泡确认实例由代码绑定的“获得焦点”处理器。 |
| 3949 | `NE气泡确认_绑定失去焦点` | `NE气泡确认_绑定失去焦点(控件, 处理器)` | bool | 为NE气泡确认实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3950 | `NE气泡确认_解绑失去焦点` | `NE气泡确认_解绑失去焦点(控件)` | bool | 移除NE气泡确认实例由代码绑定的“失去焦点”处理器。 |
| 3951 | `控件_创建NE图标按钮` | `控件_创建NE图标按钮(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE图标按钮 | 在当前 new_emoji 窗口运行时创建NE图标按钮，窗口拥有元素生命周期。 |
| 3952 | `通过标记文本获取NE图标按钮` | `通过标记文本获取NE图标按钮(标记文本)` | NE图标按钮 | 按区分大小写的非空文本标记查找NE图标按钮，找不到时返回无效引用。 |
| 3953 | `通过标记整数获取NE图标按钮` | `通过标记整数获取NE图标按钮(标记整数)` | NE图标按钮 | 按有符号 32 位整数标记查找NE图标按钮，找不到时返回无效引用。 |
| 3954 | `NE图标按钮_绑定被点击` | `NE图标按钮_绑定被点击(控件, 处理器)` | bool | 为NE图标按钮实例绑定“被点击”处理器，处理器必须使用 &名称。 |
| 3955 | `NE图标按钮_解绑被点击` | `NE图标按钮_解绑被点击(控件)` | bool | 移除NE图标按钮实例由代码绑定的“被点击”处理器。 |
| 3956 | `NE图标按钮_绑定鼠标进入` | `NE图标按钮_绑定鼠标进入(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3957 | `NE图标按钮_解绑鼠标进入` | `NE图标按钮_解绑鼠标进入(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标进入”处理器。 |
| 3958 | `NE图标按钮_绑定鼠标离开` | `NE图标按钮_绑定鼠标离开(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3959 | `NE图标按钮_解绑鼠标离开` | `NE图标按钮_解绑鼠标离开(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标离开”处理器。 |
| 3960 | `NE图标按钮_绑定鼠标按下` | `NE图标按钮_绑定鼠标按下(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3961 | `NE图标按钮_解绑鼠标按下` | `NE图标按钮_解绑鼠标按下(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标按下”处理器。 |
| 3962 | `NE图标按钮_绑定鼠标抬起` | `NE图标按钮_绑定鼠标抬起(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3963 | `NE图标按钮_解绑鼠标抬起` | `NE图标按钮_解绑鼠标抬起(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标抬起”处理器。 |
| 3964 | `NE图标按钮_绑定鼠标双击` | `NE图标按钮_绑定鼠标双击(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3965 | `NE图标按钮_解绑鼠标双击` | `NE图标按钮_解绑鼠标双击(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标双击”处理器。 |
| 3966 | `NE图标按钮_绑定鼠标移动` | `NE图标按钮_绑定鼠标移动(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3967 | `NE图标按钮_解绑鼠标移动` | `NE图标按钮_解绑鼠标移动(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标移动”处理器。 |
| 3968 | `NE图标按钮_绑定鼠标滚轮` | `NE图标按钮_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE图标按钮实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3969 | `NE图标按钮_解绑鼠标滚轮` | `NE图标按钮_解绑鼠标滚轮(控件)` | bool | 移除NE图标按钮实例由代码绑定的“鼠标滚轮”处理器。 |
| 3970 | `NE图标按钮_绑定获得焦点` | `NE图标按钮_绑定获得焦点(控件, 处理器)` | bool | 为NE图标按钮实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3971 | `NE图标按钮_解绑获得焦点` | `NE图标按钮_解绑获得焦点(控件)` | bool | 移除NE图标按钮实例由代码绑定的“获得焦点”处理器。 |
| 3972 | `NE图标按钮_绑定失去焦点` | `NE图标按钮_绑定失去焦点(控件, 处理器)` | bool | 为NE图标按钮实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3973 | `NE图标按钮_解绑失去焦点` | `NE图标按钮_解绑失去焦点(控件)` | bool | 移除NE图标按钮实例由代码绑定的“失去焦点”处理器。 |
| 3974 | `控件_创建NE地址栏` | `控件_创建NE地址栏(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE地址栏 | 在当前 new_emoji 窗口运行时创建NE地址栏，窗口拥有元素生命周期。 |
| 3975 | `通过标记文本获取NE地址栏` | `通过标记文本获取NE地址栏(标记文本)` | NE地址栏 | 按区分大小写的非空文本标记查找NE地址栏，找不到时返回无效引用。 |
| 3976 | `通过标记整数获取NE地址栏` | `通过标记整数获取NE地址栏(标记整数)` | NE地址栏 | 按有符号 32 位整数标记查找NE地址栏，找不到时返回无效引用。 |
| 3977 | `NE地址栏_绑定提交回调` | `NE地址栏_绑定提交回调(控件, 处理器)` | bool | 为NE地址栏实例绑定“提交回调”处理器，处理器必须使用 &名称。 |
| 3978 | `NE地址栏_解绑提交回调` | `NE地址栏_解绑提交回调(控件)` | bool | 移除NE地址栏实例由代码绑定的“提交回调”处理器。 |
| 3979 | `NE地址栏_绑定图标按钮回调` | `NE地址栏_绑定图标按钮回调(控件, 处理器)` | bool | 为NE地址栏实例绑定“图标按钮回调”处理器，处理器必须使用 &名称。 |
| 3980 | `NE地址栏_解绑图标按钮回调` | `NE地址栏_解绑图标按钮回调(控件)` | bool | 移除NE地址栏实例由代码绑定的“图标按钮回调”处理器。 |
| 3981 | `NE地址栏_绑定鼠标进入` | `NE地址栏_绑定鼠标进入(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 3982 | `NE地址栏_解绑鼠标进入` | `NE地址栏_解绑鼠标进入(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标进入”处理器。 |
| 3983 | `NE地址栏_绑定鼠标离开` | `NE地址栏_绑定鼠标离开(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 3984 | `NE地址栏_解绑鼠标离开` | `NE地址栏_解绑鼠标离开(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标离开”处理器。 |
| 3985 | `NE地址栏_绑定鼠标按下` | `NE地址栏_绑定鼠标按下(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 3986 | `NE地址栏_解绑鼠标按下` | `NE地址栏_解绑鼠标按下(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标按下”处理器。 |
| 3987 | `NE地址栏_绑定鼠标抬起` | `NE地址栏_绑定鼠标抬起(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 3988 | `NE地址栏_解绑鼠标抬起` | `NE地址栏_解绑鼠标抬起(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标抬起”处理器。 |
| 3989 | `NE地址栏_绑定鼠标双击` | `NE地址栏_绑定鼠标双击(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 3990 | `NE地址栏_解绑鼠标双击` | `NE地址栏_解绑鼠标双击(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标双击”处理器。 |
| 3991 | `NE地址栏_绑定鼠标移动` | `NE地址栏_绑定鼠标移动(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 3992 | `NE地址栏_解绑鼠标移动` | `NE地址栏_解绑鼠标移动(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标移动”处理器。 |
| 3993 | `NE地址栏_绑定鼠标滚轮` | `NE地址栏_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE地址栏实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 3994 | `NE地址栏_解绑鼠标滚轮` | `NE地址栏_解绑鼠标滚轮(控件)` | bool | 移除NE地址栏实例由代码绑定的“鼠标滚轮”处理器。 |
| 3995 | `NE地址栏_绑定获得焦点` | `NE地址栏_绑定获得焦点(控件, 处理器)` | bool | 为NE地址栏实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 3996 | `NE地址栏_解绑获得焦点` | `NE地址栏_解绑获得焦点(控件)` | bool | 移除NE地址栏实例由代码绑定的“获得焦点”处理器。 |
| 3997 | `NE地址栏_绑定失去焦点` | `NE地址栏_绑定失去焦点(控件, 处理器)` | bool | 为NE地址栏实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 3998 | `NE地址栏_解绑失去焦点` | `NE地址栏_解绑失去焦点(控件)` | bool | 移除NE地址栏实例由代码绑定的“失去焦点”处理器。 |
| 3999 | `控件_创建NE浏览器视口` | `控件_创建NE浏览器视口(父级, 横坐标, 纵坐标, 宽度, 高度, 文本, [标记文本], [标记整数])` | NE浏览器视口 | 在当前 new_emoji 窗口运行时创建NE浏览器视口，窗口拥有元素生命周期。 |
| 4000 | `通过标记文本获取NE浏览器视口` | `通过标记文本获取NE浏览器视口(标记文本)` | NE浏览器视口 | 按区分大小写的非空文本标记查找NE浏览器视口，找不到时返回无效引用。 |
| 4001 | `通过标记整数获取NE浏览器视口` | `通过标记整数获取NE浏览器视口(标记整数)` | NE浏览器视口 | 按有符号 32 位整数标记查找NE浏览器视口，找不到时返回无效引用。 |
| 4002 | `NE浏览器视口_绑定鼠标进入` | `NE浏览器视口_绑定鼠标进入(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标进入”处理器，处理器必须使用 &名称。 |
| 4003 | `NE浏览器视口_解绑鼠标进入` | `NE浏览器视口_解绑鼠标进入(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标进入”处理器。 |
| 4004 | `NE浏览器视口_绑定鼠标离开` | `NE浏览器视口_绑定鼠标离开(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标离开”处理器，处理器必须使用 &名称。 |
| 4005 | `NE浏览器视口_解绑鼠标离开` | `NE浏览器视口_解绑鼠标离开(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标离开”处理器。 |
| 4006 | `NE浏览器视口_绑定鼠标按下` | `NE浏览器视口_绑定鼠标按下(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标按下”处理器，处理器必须使用 &名称。 |
| 4007 | `NE浏览器视口_解绑鼠标按下` | `NE浏览器视口_解绑鼠标按下(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标按下”处理器。 |
| 4008 | `NE浏览器视口_绑定鼠标抬起` | `NE浏览器视口_绑定鼠标抬起(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标抬起”处理器，处理器必须使用 &名称。 |
| 4009 | `NE浏览器视口_解绑鼠标抬起` | `NE浏览器视口_解绑鼠标抬起(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标抬起”处理器。 |
| 4010 | `NE浏览器视口_绑定鼠标双击` | `NE浏览器视口_绑定鼠标双击(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标双击”处理器，处理器必须使用 &名称。 |
| 4011 | `NE浏览器视口_解绑鼠标双击` | `NE浏览器视口_解绑鼠标双击(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标双击”处理器。 |
| 4012 | `NE浏览器视口_绑定鼠标移动` | `NE浏览器视口_绑定鼠标移动(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标移动”处理器，处理器必须使用 &名称。 |
| 4013 | `NE浏览器视口_解绑鼠标移动` | `NE浏览器视口_解绑鼠标移动(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标移动”处理器。 |
| 4014 | `NE浏览器视口_绑定鼠标滚轮` | `NE浏览器视口_绑定鼠标滚轮(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“鼠标滚轮”处理器，处理器必须使用 &名称。 |
| 4015 | `NE浏览器视口_解绑鼠标滚轮` | `NE浏览器视口_解绑鼠标滚轮(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“鼠标滚轮”处理器。 |
| 4016 | `NE浏览器视口_绑定获得焦点` | `NE浏览器视口_绑定获得焦点(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“获得焦点”处理器，处理器必须使用 &名称。 |
| 4017 | `NE浏览器视口_解绑获得焦点` | `NE浏览器视口_解绑获得焦点(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“获得焦点”处理器。 |
| 4018 | `NE浏览器视口_绑定失去焦点` | `NE浏览器视口_绑定失去焦点(控件, 处理器)` | bool | 为NE浏览器视口实例绑定“失去焦点”处理器，处理器必须使用 &名称。 |
| 4019 | `NE浏览器视口_解绑失去焦点` | `NE浏览器视口_解绑失去焦点(控件)` | bool | 移除NE浏览器视口实例由代码绑定的“失去焦点”处理器。 |
