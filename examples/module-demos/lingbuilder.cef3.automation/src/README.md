# CEF3自动化模块完整演示

- 模块 ID：`lingbuilder.cef3.automation`
- 版本：`3.0.0-alpha.2`
- 类型：LingBuilder 内置模块
- 命令数：1
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供异步JavaScript任务及后续DOM/V8能力。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `CEF3自动化_执行JS异步` | `CEF3自动化_执行JS异步(控件名, 脚本)` | longLong | 通过DevTools Runtime.evaluate异步执行JavaScript，返回受管任务ID。 |
