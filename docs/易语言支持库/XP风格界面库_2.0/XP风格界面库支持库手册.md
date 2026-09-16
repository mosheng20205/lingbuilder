# XP风格界面库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-12453.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**XP风格界面库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库实现XP风格界面，请注意本支持库不能在Windows 95系统下使用。

操作系统支持： Windows

**命令类别：**

| XP风格界面 |  |  |  |
| --- | --- | --- | --- |

[常量表...](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/xplib/const.htm)

## 命令分类：命令类别（1 条）

### XP风格

- 原文链接：https://esdn.ijingyi.com/title-12456.html
- 操作系统支持：Windows
- 所属类别：XP风格界面
- 返回值类型：逻辑型
- 语法：逻辑型 XP风格 （ 风格类型 ）
- 功能说明：设置当前应用程序的所有窗口组件风格为XP界面风格，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 风格类型 | 必填 | 整数型 | 本参数可以为以下常量值之一: 0.#无风格; 1.#蓝色风格; 2.#绿色风格; 3.#银色风格。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/xplib//xplib/cmd0.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

根据组合框所选风格，来改变窗口中的组件为 XP 风格，窗体本身风格不会被改变。 参见： 例程

**完整正文（站点原文转换）**

**XP风格 命令**   操作系统支持：Windows    所属类别：[XP风格界面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/xplib/ct0.htm)

设置当前应用程序的所有窗口组件风格为XP界面风格，成功返回真，失败返回假。

*语法：*  逻辑型  XP风格 （风格类型）

| 参数名 | 描 述 |
| --- | --- |
| 风格类型 | 必需的 ； 整数型。本参数可以为以下常量值之一: 0.#无风格; 1.#蓝色风格; 2.#绿色风格; 3.#银色风格。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/xplib//xplib/cmd0.files/image001.gif)

说明：

根据组合框所选风格，来改变窗口中的组件为XP风格，窗体本身风格不会被改变。

参见：[例程](http://esdn.125.la/source/plugin/eknow/resource/xplib//xplib/cmd0.e)

---
