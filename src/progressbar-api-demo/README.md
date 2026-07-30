# 进度条 ProgressBar 完整接口示例

本项目使用 `new_emoji` 原生界面库，通过四个 TabControl 选项卡展示 ProgressBar 的完整能力：

- 基础与状态：Percentage、Status、ShowText，以及进度条的鼠标和焦点事件。
- 外观与格式：Options、FormatOptions、TextInside。
- 颜色与文本：Colors、ColorStops、CompleteText、TextTemplate。
- 自动化与事件：一键回归全部 30 个接口、恢复设计器默认值和事件日志。

共覆盖 manifest 中列出的 30 个 ProgressBar 接口，包含同步设置、异步 Post 设置和读取接口。示例中的 `@` 行直接调用 new_emoji 导出的 `EU_*` ABI，便于对照 C++ 头文件和检查真实运行时行为。

ColorStops 使用 `颜色<TAB>百分比|颜色<TAB>百分比` 协议，例如：

```text
0xFFF56C6C\t20|0xFFE6A23C\t40|0xFF5CB87A\t60|0xFF1989FA\t80|0xFF6F7AD3\t100
```

需要在已安装 `lingbuilder.new_emoji.ui` 模块、Visual Studio Build Tools 和对应 `new_emoji.dll` 的环境中构建运行。源码包由 LingBuilder 导出服务生成，导出后可在 `exports/进度条progressbar-api-demo.lcpppkg` 找到。
