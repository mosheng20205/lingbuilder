# CEF3自动化模块完整演示

- 模块 ID：`lingbuilder.cef3.automation`
- 版本：`3.0.0-alpha.3`
- 类型：LingBuilder 内置模块
- 命令数：6
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
| 2 | `CEF3Hook_注册脚本` | `CEF3Hook_注册脚本(控件名, 名称, 脚本, 地址匹配, 全部框架, 立即执行当前上下文)` | longLong | 注册持久JSHook；它会在匹配Frame的V8上下文创建时执行，并在导航后自动重建。 |
| 3 | `CEF3Hook_移除脚本` | `CEF3Hook_移除脚本(Hook句柄)` | int | 移除指定JSHook并释放受管句柄。 |
| 4 | `CEF3Hook_清空脚本` | `CEF3Hook_清空脚本(控件名)` | int | 清空指定浏览器的全部已注册JSHook。 |
| 5 | `CEF3Hook_取脚本列表` | `CEF3Hook_取脚本列表(控件名)` | wideString | 返回JSHook句柄、名称、地址匹配和Frame范围JSON。 |
| 6 | `CEF3Hook_回复页面消息` | `CEF3Hook_回复页面消息(控件名, 请求ID, 是否成功, 返回文本)` | int | 回复页面 LingBuilder调用宿主(name, payload) 产生的Promise请求。 |
