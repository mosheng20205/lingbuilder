# FBro指纹浏览器模块完整演示

- 模块 ID：`lingbuilder.fbro.browser`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：21
- 设计器控件数：1
- 分组数：2

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

通过隔离的 C ABI 桥接层使用 FBro/FBrowser CEF 135 x64，提供设计器浏览器控件、基础浏览器控制和结构化指纹配置。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `FBro_创建` | `FBro_创建(控件名)` | int | 使用设计器属性创建指定 FBro 浏览器；空控件名创建当前窗口全部 FBro 控件。 |
| 2 | `FBro_打开谷歌原生UI浏览器` | `FBro_打开谷歌原生UI浏览器(控件名, 地址)` | int | 基于指定内嵌 FBro 实例的会话创建 Chrome Runtime 独立顶层浏览器；不接收或复用 LingBuilder 窗口句柄。 |
| 3 | `FBro_关闭` | `FBro_关闭(控件名)` | void | 关闭指定 FBro 浏览器并释放实例。 |
| 4 | `FBro_导航` | `FBro_导航(控件名, 地址)` | int | 让指定 FBro 浏览器导航到目标地址。 |
| 5 | `FBro_刷新` | `FBro_刷新(控件名)` | void | 刷新指定 FBro 浏览器。 |
| 6 | `FBro_后退` | `FBro_后退(控件名)` | int | 浏览器可以后退时返回上一页。 |
| 7 | `FBro_前进` | `FBro_前进(控件名)` | int | 浏览器可以前进时进入下一页。 |
| 8 | `FBro_停止` | `FBro_停止(控件名)` | void | 停止指定浏览器当前导航。 |
| 9 | `FBro_执行JS` | `FBro_执行JS(控件名, 脚本)` | wideString | 通过桥接层执行 JavaScript，返回 UTF-16 结果或中文错误。 |
| 10 | `FBro_取标题` | `FBro_取标题(控件名)` | wideString | 返回最近一次标题事件记录的网页标题。 |
| 11 | `FBro_取地址` | `FBro_取地址(控件名)` | wideString | 返回指定浏览器当前地址。 |
| 12 | `FBro_设置代理` | `FBro_设置代理(控件名, 代理地址)` | int | 设置创建前使用的代理地址；空文本表示直连。 |
| 13 | `FBro_设置缓存目录` | `FBro_设置缓存目录(控件名, 目录)` | int | 设置创建前使用的独立缓存目录。 |
| 14 | `FBro_设置UserAgent` | `FBro_设置UserAgent(控件名, UserAgent)` | int | 设置创建前使用的 User-Agent。 |
| 15 | `FBro_取Cookie` | `FBro_取Cookie(控件名, 地址)` | wideString | 异步读取指定地址 Cookie；首版返回桥接层最近快照。 |
| 16 | `FBro_清空Cookie` | `FBro_清空Cookie(控件名, 地址)` | int | 删除指定地址的 Cookie。 |
| 17 | `FBro指纹_应用配置` | `FBro指纹_应用配置(控件名, JSON)` | int | 应用结构化指纹 JSON；未配置 VIP 授权时返回 0 并记录中文错误。 |
| 18 | `FBro指纹_取调用次数` | `FBro指纹_取调用次数(控件名)` | wideString | 返回 FBro VIP 指纹调用次数。 |
| 19 | `FBro指纹_清空调用次数` | `FBro指纹_清空调用次数(控件名)` | int | 清空指定浏览器的指纹调用次数。 |
| 20 | `FBro_取最近事件` | `FBro_取最近事件(控件名)` | wideString | 返回最近 FBro 浏览器事件名。 |
| 21 | `FBro_取最近错误` | `FBro_取最近错误(控件名)` | wideString | 返回桥接层最近中文错误。 |
