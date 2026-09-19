# IconButton 图标按钮 IconButton · 惯用要点与红线

- 无边框/自绘标题栏上的最小化、最大化、关闭一律用它 + 属性 `windowCommand`：0=无 1=最小化 2=最大化/还原 3=关闭；纯代码路径等价写法 `NE_设置元素窗口命令(当前窗口, 按钮, 3)`。**不要自己发 `WM_SYSCOMMAND`/`PostQuitMessage`**。
- 图标本体是 `icon`（emoji 或图形字形），悬停说明用 `tooltip`，未读计数用 `badge` + `badgeVisible`；`shape`/`radius` 与四向 `padding*`、`iconSize` 控制外形。
- 配色是显式五态：`normalBg`/`hoverBg`/`pressedBg`/`checkedBg`/`disabledBg` + `iconColor`/`disabledIconColor`；关闭键这类危险操作单独给强调色，别只改图标字符。纯代码路径可一次下发 `NE_EU_SetIconButtonColors(当前窗口, 按钮, …)`。
- 需要 toggle 语义（侧栏展开、静音）用 `checked` + `NE图标按钮_绑定被点击`，点击后自己翻转 `checked`；不要靠换图标字符来记状态。
- 下拉触发：设 `dropdownElementId` 关联目标弹层，或用 `NE_EU_SetElementPopup(当前窗口, 按钮, 弹出菜单, 触发方式)`，两者选一条路径，别既声明又代码弹出。
- 自绘标题栏热区（比如可点的横幅图）也用它：同坐标覆盖在图片上 + 透明配色 + 绑定被点击。最大化/还原之后按钮位置要按新客户区重排，必要时截图实测，不要按创建时坐标硬算。

```lcpp
局部 NE图标按钮 关闭按钮 = 控件_创建NE图标按钮(当前窗口, 830, 10, 32, 32, "✕", "关闭按钮", 12)
NE_设置元素窗口命令(当前窗口, 关闭按钮, 3)
```
