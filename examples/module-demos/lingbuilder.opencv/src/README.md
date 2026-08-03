# OpenCV 图像处理模块完整演示

- 模块 ID：`lingbuilder.opencv`
- 模块版本：`1.0.0`
- OpenCV 版本：`4.14.0`
- 构建目标：Windows / MSVC / x64
- 命令覆盖：33 / 33
- 界面结构：3 个 TabControl 标签页、34 个 OpenCV 单功能按钮、结果预览、运行日志

## 一按钮一功能

每个演示按钮只执行一项功能，不再使用“运行全部预处理”或“分析并读取全部结果”之类的组合按钮：

- 33 条 OpenCV 模块命令各有独立按钮。
- “准备错误状态”是额外的单功能按钮，只调用一次 `OpenCV_加载图像` 并传入不存在的文件路径；随后由独立的 `OpenCV_取错误` 按钮读取错误。
- 清空日志和退出是工作台辅助按钮，不调用 OpenCV 命令。
- 图像句柄和结果句柄保存在窗口成员中，作为下一次单命令操作的输入，不会在按钮事件里暗中串行执行其它 OpenCV 命令。

## 推荐操作顺序

打开项目后按 F5 构建运行。项目自带原创、确定性生成的 `assets/module-demo-lingbuilder.opencv/OpenCV缺口背景.png`：左侧是独立拼图块，右侧是边界清楚的真实缺口，无需准备外部图片。

1. 在“基础与图像信息”页点击 `OpenCV_加载图像`。
2. 点击宽度、高度、通道数等独立按钮查看单项结果。
3. 在“预处理与变换”页任选一个处理按钮。每次处理只生成一张当前处理图。
4. 回到基础页，点击 `OpenCV_保存图像` 查看输出，再点击 `OpenCV_释放图像` 回到原图状态。
5. 模板匹配前先执行一次 `OpenCV_裁剪`，裁剪得到的句柄会作为模板输入。
6. 点击 `OpenCV_分析缺口` 时，Bridge 会在右侧固定 ROI 内查找缺口；预设目标约为 `x=330、y=108、宽=100、高=110`。随后逐项点击数量、坐标、JSON 或保存标注图按钮核对结果。
7. 切换到另一种分析前点击 `OpenCV结果_释放`；全部结束后点击 `OpenCV_释放全部`。

右侧“运行日志”显示每次单项操作的参数状态和返回值；右侧图片框显示最近保存的处理图或标注图。

## 命令分组

| 标签页 | 独立命令按钮 |
|---|---|
| 基础与图像信息 | `OpenCV_取版本`、`OpenCV_加载图像`、`OpenCV_保存图像`、`OpenCV_克隆图像`、`OpenCV_释放图像`、`OpenCV_释放全部`、`OpenCV_取宽度`、`OpenCV_取高度`、`OpenCV_取通道数`、`OpenCV_取错误` |
| 预处理与变换 | `OpenCV_灰度化`、`OpenCV_缩放`、`OpenCV_裁剪`、`OpenCV_高斯模糊`、`OpenCV_二值化`、`OpenCV_自适应二值化`、`OpenCV_Canny边缘`、`OpenCV_形态学` |
| 分析与结果读取 | `OpenCV_模板匹配`、`OpenCV_查找轮廓`、`OpenCV_分析缺口` 以及 12 条 `OpenCV结果_*` 命令 |

## 资源与清理

- 原始缺口图不会被修改；可运行 `electron/scripts/generate-opencv-demo-assets.ps1` 按固定几何参数重新生成。
- `OpenCV缺口验证标注.png` 不是手绘框，而是原生 smoke 调用 `OpenCV结果_保存标注图` 后生成；测试同时断言标注候选接近预设坐标。
- 当前处理图保存为 `assets/module-demo-lingbuilder.opencv/输出-当前图像.png`。
- 当前分析标注图保存为 `assets/module-demo-lingbuilder.opencv/输出-当前分析标注.png`。
- 源码包自动携带只读 `lingbuilder.opencv.sdk` x64 运行资产，体积明显大于普通源码包。
- 逐条签名、参数类型、返回类型和结构化 binding 位于 `模块命令清单.json`；可运行实现位于 `MainWindow.lcpp`。
