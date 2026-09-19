# Image 图片 Image · 惯用要点与红线

- 创建时的「文本」参数即占位内容，可以直接放 emoji/中文占位（如 `"🐧 QQ群 123456"`）；真实位图用 `src` 指路径或资源逻辑名，中文与 emoji 路径不需要手工转码。
- 缩放模式 `fit`：0=适应 1=填充 2=覆盖 3=原始 4=按需缩小（创建命令里以数字尾参传入）；固定尺寸卡片区用 2 或 4，别用默认拉伸导致比例失真。
- 预览大图不要自己再开一个窗口：`previewEnabled`/`previewOpen`/`previewList`/`previewIndex` 已提供内置预览与列表翻页。
- 加载占位与失败态必须显式配置：`placeholderIcon`/`placeholderText` 与 `errorIcon`/`errorText`，否则图挂了就是一片空白，用户以为界面坏了。
- 长列表里的缩略图开 `lazy` + `cacheEnabled`；批量换图要节流，逐条 `控件_设置图片` 会连续触发重绘。
- 想「图片上可点」不要在图片上绑事件，同坐标叠一个 `NE图标按钮` 当热区（画廊横幅就是这个做法），并 `NE_EU_SetIconButtonColors(..., 0)` 把底色透明化。

```lcpp
局部 NE图片 横幅 = 控件_创建NE图片(根容器, 264, 48, 138, 48, "🐧 交流群", "QQ横幅图片", 4)
NE_EU_SetImageStyle(当前窗口, 横幅, 0, 0, 0, 4, 0)
```
