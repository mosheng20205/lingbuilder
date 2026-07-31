# CEF3平台工具模块完整演示

- 模块 ID：`lingbuilder.cef3.platform`
- 版本：`3.0.0-alpha.2`
- 类型：LingBuilder 内置模块
- 命令数：4
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供CEF版本与平台工具能力。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `CEF3平台_取版本` | `CEF3平台_取版本()` | wideString | 返回编译时CEF与Chromium版本。 |
| 2 | `CEF3平台_取MIME扩展名` | `CEF3平台_取MIME扩展名(MIME类型)` | wideString | 以JSON数组返回指定小写MIME类型关联的扩展名。 |
| 3 | `CEF3平台_取Chrome实验开关` | `CEF3平台_取Chrome实验开关()` | wideString | 以JSON数组返回当前Chrome Variations命令行开关。 |
| 4 | `CEF3平台_取Chrome实验说明` | `CEF3平台_取Chrome实验说明()` | wideString | 以JSON数组返回当前Chrome Variations可读说明。 |
