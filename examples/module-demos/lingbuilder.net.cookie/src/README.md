# Cookie文本模块完整演示

- 模块 ID：`lingbuilder.net.cookie`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：5
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供 Cookie 请求头文本的读取、设置、删除和存在性检查。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `Cookie_取值` | `Cookie_取值(Cookie文本, 名称)` | wideString | 读取 Cookie 请求头中的指定值。 |
| 2 | `Cookie_是否存在` | `Cookie_是否存在(Cookie文本, 名称)` | bool | 判断 Cookie 名称是否存在。 |
| 3 | `Cookie_设置` | `Cookie_设置(Cookie文本, 名称, 值)` | wideString | 添加或替换 Cookie 值。 |
| 4 | `Cookie_删除` | `Cookie_删除(Cookie文本, 名称)` | wideString | 删除指定 Cookie。 |
| 5 | `Cookie_生成响应项` | `Cookie_生成响应项(名称, 值, 路径, 最大秒数)` | wideString | 生成一条 Set-Cookie 响应值。 |
