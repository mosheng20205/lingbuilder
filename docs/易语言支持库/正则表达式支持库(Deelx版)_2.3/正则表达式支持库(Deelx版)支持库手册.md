# 正则表达式支持库(Deelx版) 2.3 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-8646.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.3）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**正则表达式支持库(Deelx版)2.3版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

该支持库封装了DEELX正则表达式引擎（v1.2）,实现了支持 单行模式(SINGLELINE)、多行模式(MULTILINE)、全局模式(GLOBAL)、忽略大小写(IGNORECASE)、从右向左(RIGHTTOLEFT)、扩展模式(EXTENDED) 等常见匹配模式。支持与 Perl 兼容的正则表达式语法。注意，本支持库中的所有命令均为高级命令，要求使用者具有一定的正则表达式知识基础。

操作系统支持： Windows

**命令类别：**

| 全局命令 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| 正则表达式DEELX | 搜索结果DEELX | 正则常量 |  |
| --- | --- | --- | --- |

## 命令分类：其它数据类型（37 条）

### 创建

- 原文链接：https://esdn.ijingyi.com/title-8656.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：逻辑型
- 语法：逻辑型 正则表达式DEELX ．创建 （ 正则表达式文本 ， ［ 匹配模式 ］ ， ［ 支持转义符 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据正则表达式语法，对正则表达式文本进行编译。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 正则表达式文本 | 必填 | 文本型 | 比如“易语言5\.0(模块\|支持库)?”。 |
| 匹配模式 | 可空 | 整数型 | 支持的匹配模式有：单行模式、多行模式、全局模式、忽略大小写、从右向左、扩展模式 这 6 种模式以及它们的组合。 可以用如下常量（#正则常量.单行模式；#正则常量.多行模式；#正则常量.全局模式；#正则常量.忽略大小写；#正则常量.从右向左；#正则常量.扩展模式）可以查看支持库常量说明。 |
| 支持转义符 | 可空 | 逻辑型 | 默认为假，为真时支持易语言的部分常量/转义符：#换行符、#引号、#左引号、#右引号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148473869175.png)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

创建表达式 , 创建失败表达式就是空 . 参见 : 例题1.e

**完整正文（站点原文转换）**

**创建 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
根据正则表达式语法，对正则表达式文本进行编译。

*语法：*  逻辑型  *正则表达式DEELX*．创建 （正则表达式文本， ［匹配模式］， ［支持转义符］）

| 参数名 | 描 述 |
| --- | --- |
| 正则表达式文本 | 必需的 ； 文本型。比如“易语言5\.0(模块\|支持库)?”。 |
| 匹配模式 | 可选的 ； 整数型。支持的匹配模式有：单行模式、多行模式、全局模式、忽略大小写、从右向左、扩展模式 这 6 种模式以及它们的组合。 可以用如下常量（#正则常量.单行模式；#正则常量.多行模式；#正则常量.全局模式；#正则常量.忽略大小写；#正则常量.从右向左；#正则常量.扩展模式）可以查看支持库常量说明。 |
| 支持转义符 | 可选的 ； 逻辑型。默认为假，为真时支持易语言的部分常量/转义符：#换行符、#引号、#左引号、#右引号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148473869175.png)

说明：创建表达式,创建失败表达式就是空.

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题1.e](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E5%8F%96%E6%89%80%E6%9C%89%E5%8C%B9%E9%85%8D%E6%96%87%E6%9C%AC.e)

---

### 创建W

- 原文链接：https://esdn.ijingyi.com/title-8657.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：逻辑型
- 语法：逻辑型 正则表达式DEELX ．创建W （ 正则表达式文本 ， ［ 匹配模式 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据正则表达式语法，对正则表达式文本进行编译。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 正则表达式文本 | 必填 | 字节集 | Unicode格式的正则表达式文本，比如“易语言5\.0(模块\|支持库)?”。 |
| 匹配模式 | 可空 | 整数型 | 支持的匹配模式有：单行模式、多行模式、全局模式、忽略大小写、从右向左、扩展模式 这 6 种模式以及它们的组合。 可以用如下常量（#正则常量.单行模式；#正则常量.多行模式；#正则常量.全局模式；#正则常量.忽略大小写；#正则常量.从右向左；#正则常量.扩展模式）可以查看支持库常量说明。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题 1

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148851470963.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**创建W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
根据正则表达式语法，对正则表达式文本进行编译。

*语法：*  逻辑型  *正则表达式DEELX*．创建W （正则表达式文本， ［匹配模式］）

| 参数名 | 描 述 |
| --- | --- |
| 正则表达式文本 | 必需的 ； 字节集。Unicode格式的正则表达式文本，比如“易语言5\.0(模块\|支持库)?”。 |
| 匹配模式 | 可选的 ； 整数型。支持的匹配模式有：单行模式、多行模式、全局模式、忽略大小写、从右向左、扩展模式 这 6 种模式以及它们的组合。 可以用如下常量（#正则常量.单行模式；#正则常量.多行模式；#正则常量.全局模式；#正则常量.忽略大小写；#正则常量.从右向左；#正则常量.扩展模式）可以查看支持库常量说明。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148851470963.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)1

---

### 查找匹配

- 原文链接：https://esdn.ijingyi.com/title-8658.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．查找匹配 （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 文本型 | 进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149340902546.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**查找匹配 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．查找匹配 （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 文本型。进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149340902546.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E6%B5%8B%E8%AF%95%E6%9B%BF%E6%8D%A2%E5%8A%9F%E8%83%BD.e)

---

### 查找匹配W

- 原文链接：https://esdn.ijingyi.com/title-8659.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．查找匹配W （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 字节集 | Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题 1

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148851470963.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**查找匹配W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．查找匹配W （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 字节集。Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148851470963.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)1

---

### 绝对匹配

- 原文链接：https://esdn.ijingyi.com/title-8660.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．绝对匹配 （ ［ 用来匹配的文本 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 文本型 | 进行匹配的字符串。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**绝对匹配 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．绝对匹配 （［用来匹配的文本］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 文本型。进行匹配的字符串。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 绝对匹配W

- 原文链接：https://esdn.ijingyi.com/title-8661.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．绝对匹配W （ ［ 用来匹配的文本 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 字节集 | Unicode格式，进行匹配的字符串。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**绝对匹配W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
通过 “搜索结果” 对象，可以得知是否匹配成功。如果成功，通过 “搜索结果” 对象可以获取捕获信息。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．绝对匹配W （［用来匹配的文本］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 字节集。Unicode格式，进行匹配的字符串。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 测试匹配

- 原文链接：https://esdn.ijingyi.com/title-8662.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：逻辑型
- 语法：逻辑型 正则表达式DEELX ．测试匹配 （ ［ 用来匹配的文本 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 测试表达式与匹配文本是否完全匹配，成功返回真，失败返回假。该方法常用于判断用户输入数据的合法性，比如检验Email的合法性。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 文本型 | 进行匹配的字符串。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例程

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520150500280445.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**测试匹配 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
测试表达式与匹配文本是否完全匹配，成功返回真，失败返回假。该方法常用于判断用户输入数据的合法性，比如检验Email的合法性。

*语法：*  逻辑型  *正则表达式DEELX*．测试匹配 （［用来匹配的文本］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 文本型。进行匹配的字符串。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520150500280445.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例程](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E6%B3%A8%E5%86%8C%E9%AA%8C%E8%AF%81.e)

---

### 测试匹配W

- 原文链接：https://esdn.ijingyi.com/title-8663.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：逻辑型
- 语法：逻辑型 正则表达式DEELX ．测试匹配W （ ［ 用来匹配的文本 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 测试表达式与匹配文本是否完全匹配，成功返回真，失败返回假。该方法常用于判断用户输入数据的合法性，比如检验Email的合法性。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 字节集 | Unicode格式，进行匹配的字符串。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**测试匹配W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
测试表达式与匹配文本是否完全匹配，成功返回真，失败返回假。该方法常用于判断用户输入数据的合法性，比如检验Email的合法性。

*语法：*  逻辑型  *正则表达式DEELX*．测试匹配W （［用来匹配的文本］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 字节集。Unicode格式，进行匹配的字符串。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 获取命名分组编号

- 原文链接：https://esdn.ijingyi.com/title-8664.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：整数型
- 语法：整数型 正则表达式DEELX ．获取命名分组编号 （ 命名分组名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过命名分组名，返回命名分组编号。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 命名分组名 | 必填 | 文本型 | 命名分组名。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**获取命名分组编号 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
通过命名分组名，返回命名分组编号。

*语法：*  整数型  *正则表达式DEELX*．获取命名分组编号 （命名分组名）

| 参数名 | 描 述 |
| --- | --- |
| 命名分组名 | 必需的 ； 文本型。命名分组名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 替换

- 原文链接：https://esdn.ijingyi.com/title-8665.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：文本型
- 语法：文本型 正则表达式DEELX ．替换 （ 欲被替换的文本 ， ［ 用作替换的文本 ］ ， ［ 起始替换位置 ］ ， ［ 替换进行的次数 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 进行文本替换操作。返回替换后的文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲被替换的文本 | 必填 | 文本型 | 被进行替换的初始文本。 |
| 用作替换的文本 | 可空 | 文本型 | “替换为”字符串，将匹配到的子字符串替换成 此变量的 字符串。 |
| 起始替换位置 | 可空 | 整数型 | 进行查找替换的开始位置。留空默认(-1)表示根据是否“从右向左(RIGHTTOLEFT)”自动决定开始位置。 |
| 替换进行的次数 | 可空 | 整数型 | 指定进行替换的次数。留空默认(-1)表示替换所有匹配。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149399224011.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**替换 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
进行文本替换操作。返回替换后的文本。

*语法：*  文本型  *正则表达式DEELX*．替换 （欲被替换的文本， ［用作替换的文本］， ［起始替换位置］， ［替换进行的次数］）

| 参数名 | 描 述 |
| --- | --- |
| 欲被替换的文本 | 必需的 ； 文本型。被进行替换的初始文本。 |
| 用作替换的文本 | 可选的 ； 文本型。“替换为”字符串，将匹配到的子字符串替换成 此变量的 字符串。 |
| 起始替换位置 | 可选的 ； 整数型。进行查找替换的开始位置。留空默认(-1)表示根据是否“从右向左(RIGHTTOLEFT)”自动决定开始位置。 |
| 替换进行的次数 | 可选的 ； 整数型。指定进行替换的次数。留空默认(-1)表示替换所有匹配。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149399224011.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_%E6%B5%8B%E8%AF%95%E6%9B%BF%E6%8D%A2%E5%8A%9F%E8%83%BD.e)

---

### 替换W

- 原文链接：https://esdn.ijingyi.com/title-8666.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：字节集
- 语法：字节集 正则表达式DEELX ．替换W （ 欲被替换的文本 ， ［ 用作替换的文本 ］ ， ［ 起始替换位置 ］ ， ［ 替换进行的次数 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 进行文本替换操作。返回替换后的文本(Unicode格式文本，字节集类型)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲被替换的文本 | 必填 | 字节集 | Unicode格式，被进行替换的初始文本。 |
| 用作替换的文本 | 可空 | 字节集 | Unicode格式，“替换为”字符串，将匹配到的子字符串替换成 此变量的 字符串。 |
| 起始替换位置 | 可空 | 整数型 | 进行查找替换的开始位置。留空默认(-1)表示根据是否“从右向左(RIGHTTOLEFT)”自动决定开始位置。 |
| 替换进行的次数 | 可空 | 整数型 | 指定进行替换的次数。留空默认(-1)表示替换所有匹配。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149069807508.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**替换W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
进行文本替换操作。返回替换后的文本(Unicode格式文本，字节集类型)。

*语法：*  字节集  *正则表达式DEELX*．替换W （欲被替换的文本， ［用作替换的文本］， ［起始替换位置］， ［替换进行的次数］）

| 参数名 | 描 述 |
| --- | --- |
| 欲被替换的文本 | 必需的 ； 字节集。Unicode格式，被进行替换的初始文本。 |
| 用作替换的文本 | 可选的 ； 字节集。Unicode格式，“替换为”字符串，将匹配到的子字符串替换成 此变量的 字符串。 |
| 起始替换位置 | 可选的 ； 整数型。进行查找替换的开始位置。留空默认(-1)表示根据是否“从右向左(RIGHTTOLEFT)”自动决定开始位置。 |
| 替换进行的次数 | 可选的 ； 整数型。指定进行替换的次数。留空默认(-1)表示替换所有匹配。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149069807508.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)

---

### 分割

- 原文链接：https://esdn.ijingyi.com/title-8667.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：文本型数组
- 语法：文本型数组 正则表达式DEELX ．分割 （ 待分割文本 ， ［ 要返回的子文本数目 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式将指定文本进行分割。返回分割后的一维文本数组。如果失败则返回一个空数组，即没有任何成员的数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 待分割文本 | 必填 | 文本型 |  |
| 要返回的子文本数目 | 可空 | 整数型 | 如果被省略或等于0，则默认返回所有的子文本。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题1.e

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148663731657.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**分割 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式将指定文本进行分割。返回分割后的一维文本数组。如果失败则返回一个空数组，即没有任何成员的数组。

*语法：*  文本型数组  *正则表达式DEELX*．分割 （待分割文本， ［要返回的子文本数目］）

| 参数名 | 描 述 |
| --- | --- |
| 待分割文本 | 必需的 ； 文本型。 |
| 要返回的子文本数目 | 可选的 ； 整数型。如果被省略或等于0，则默认返回所有的子文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520148663731657.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题1.e](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_%E5%8F%96%E6%89%80%E6%9C%89%E5%8C%B9%E9%85%8D%E6%96%87%E6%9C%AC.e)

---

### 分割W

- 原文链接：https://esdn.ijingyi.com/title-8668.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：字节集数组
- 语法：字节集数组 正则表达式DEELX ．分割W （ 待分割文本 ， ［ 要返回的子文本数目 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式将指定文本进行分割。返回分割后的一维字节集数组。如果失败则返回一个空数组，即没有任何成员的数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 待分割文本 | 必填 | 字节集 | Unicode格式文本。 |
| 要返回的子文本数目 | 可空 | 整数型 | 如果被省略或等于0，则默认返回所有的子文本。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题 1

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149025826299.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**分割W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式将指定文本进行分割。返回分割后的一维字节集数组。如果失败则返回一个空数组，即没有任何成员的数组。

*语法：*  字节集数组  *正则表达式DEELX*．分割W （待分割文本， ［要返回的子文本数目］）

| 参数名 | 描 述 |
| --- | --- |
| 待分割文本 | 必需的 ； 字节集。Unicode格式文本。 |
| 要返回的子文本数目 | 可选的 ； 整数型。如果被省略或等于0，则默认返回所有的子文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149025826299.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)1

---

### 取表达式文本

- 原文链接：https://esdn.ijingyi.com/title-8669.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：文本型
- 语法：文本型 正则表达式DEELX ．取表达式文本 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回以文本形式表示的正则表达式。如果该对象尚未创建，则返回空文本。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取表达式文本 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
返回以文本形式表示的正则表达式。如果该对象尚未创建，则返回空文本。

*语法：*  文本型  *正则表达式DEELX*．取表达式文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取表达式文本W

- 原文链接：https://esdn.ijingyi.com/title-8670.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：字节集
- 语法：字节集 正则表达式DEELX ．取表达式文本W （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回以文本形式表示的正则表达式(Unicode格式文本，字节集类型)。如果该对象尚未创建，则返回空文本。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取表达式文本W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
返回以文本形式表示的正则表达式(Unicode格式文本，字节集类型)。如果该对象尚未创建，则返回空文本。

*语法：*  字节集  *正则表达式DEELX*．取表达式文本W （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取结果文本

- 原文链接：https://esdn.ijingyi.com/title-8671.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：文本型
- 语法：文本型 正则表达式DEELX ．取结果文本 （ 搜索结果起始位置 ， 搜索结果结束位置 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取搜索结果的文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 搜索结果起始位置 | 必填 | 整数型，初始值为“0” | 搜索结果起始位置。 |
| 搜索结果结束位置 | 必填 | 整数型，初始值为“0” | 搜索结果结束位置。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取结果文本 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
取搜索结果的文本。

*语法：*  文本型  *正则表达式DEELX*．取结果文本 （搜索结果起始位置， 搜索结果结束位置）

| 参数名 | 描 述 |
| --- | --- |
| 搜索结果起始位置 | 必需的 ； 整数型，初始值为“0”。搜索结果起始位置。 |
| 搜索结果结束位置 | 必需的 ； 整数型，初始值为“0”。搜索结果结束位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取结果文本W

- 原文链接：https://esdn.ijingyi.com/title-8672.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：字节集
- 语法：字节集 正则表达式DEELX ．取结果文本W （ 搜索结果起始位置 ， 搜索结果结束位置 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取搜索结果的文本(Unicode格式文本，字节集类型)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 搜索结果起始位置 | 必填 | 整数型，初始值为“0” | 搜索结果起始位置。 |
| 搜索结果结束位置 | 必填 | 整数型，初始值为“0” | 搜索结果结束位置。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取结果文本W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
取搜索结果的文本(Unicode格式文本，字节集类型)。

*语法：*  字节集  *正则表达式DEELX*．取结果文本W （搜索结果起始位置， 搜索结果结束位置）

| 参数名 | 描 述 |
| --- | --- |
| 搜索结果起始位置 | 必需的 ； 整数型，初始值为“0”。搜索结果起始位置。 |
| 搜索结果结束位置 | 必需的 ； 整数型，初始值为“0”。搜索结果结束位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 搜索

- 原文链接：https://esdn.ijingyi.com/title-8673.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．搜索 （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式搜索指定文本中与该表达式匹配的子文本。本命令和“查找匹配”一样，为兼容原支持库增加。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 文本型 | 进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149485685489.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**搜索 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式搜索指定文本中与该表达式匹配的子文本。本命令和“查找匹配”一样，为兼容原支持库增加。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．搜索 （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 文本型。进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149485685489.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E9%80%92%E5%BD%92%E8%A1%A8%E8%BE%BE%E5%BC%8F.e)

---

### 搜索W

- 原文链接：https://esdn.ijingyi.com/title-8674.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．搜索W （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式搜索指定文本中与该表达式匹配的子文本。本命令和“查找匹配”一样，为兼容原支持库增加。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 字节集 | Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**搜索W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式搜索指定文本中与该表达式匹配的子文本。本命令和“查找匹配”一样，为兼容原支持库增加。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．搜索W （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 字节集。Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 搜索下一个

- 原文链接：https://esdn.ijingyi.com/title-8675.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX
- 语法：搜索结果DEELX 正则表达式DEELX ．搜索下一个 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 本命令和“搜索”相似，只是自动偏移开始查找匹配的位置。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**搜索下一个 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
本命令和“搜索”相似，只是自动偏移开始查找匹配的位置。

*语法：*  搜索结果DEELX  *正则表达式DEELX*．搜索下一个 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 搜索全部

- 原文链接：https://esdn.ijingyi.com/title-8676.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX数组
- 语法：搜索结果DEELX数组 正则表达式DEELX ．搜索全部 （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式搜索指定文本中与该表达式匹配的所有子文本。返回值包含所有的搜索结果的一维数组，数组原有内容将被销毁，维数也将根据需要做相应调整。本命令的内部是通过循环多次调用“搜索”，每次指定适当的参数，来实现搜索整个文本的。返回值数组的各个成员分别对应每次调用“搜索”的返回值。本命令可高效地一次性取得目标文本中所有的匹配子文本信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 文本型 | 进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149199578828.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**搜索全部 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式搜索指定文本中与该表达式匹配的所有子文本。返回值包含所有的搜索结果的一维数组，数组原有内容将被销毁，维数也将根据需要做相应调整。本命令的内部是通过循环多次调用“搜索”，每次指定适当的参数，来实现搜索整个文本的。返回值数组的各个成员分别对应每次调用“搜索”的返回值。本命令可高效地一次性取得目标文本中所有的匹配子文本信息。

*语法：*  搜索结果DEELX数组  *正则表达式DEELX*．搜索全部 （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 文本型。进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149199578828.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E8%A1%A8%E8%BE%BE%E5%BC%8F%E5%86%85%E5%BF%BD%E7%95%A5%E5%A4%A7%E5%B0%8F%E5%86%99.e)

---

### 搜索全部W

- 原文链接：https://esdn.ijingyi.com/title-8677.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：搜索结果DEELX数组
- 语法：搜索结果DEELX数组 正则表达式DEELX ．搜索全部W （ ［ 用来匹配的文本 ］ ， ［ 开始查找匹配的位置 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用指定的正则表达式搜索指定文本中与该表达式匹配的所有子文本。返回值包含所有的搜索结果的一维数组，数组原有内容将被销毁，维数也将根据需要做相应调整。本命令的内部是通过循环多次调用“搜索”，每次指定适当的参数，来实现搜索整个文本的。返回值数组的各个成员分别对应每次调用“搜索”的返回值。本命令可高效地一次性取得目标文本中所有的匹配子文本信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 可空 | 字节集 | Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可空 | 整数型 | 开始查找匹配的位置. |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149122302412.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**搜索全部W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
使用指定的正则表达式搜索指定文本中与该表达式匹配的所有子文本。返回值包含所有的搜索结果的一维数组，数组原有内容将被销毁，维数也将根据需要做相应调整。本命令的内部是通过循环多次调用“搜索”，每次指定适当的参数，来实现搜索整个文本的。返回值数组的各个成员分别对应每次调用“搜索”的返回值。本命令可高效地一次性取得目标文本中所有的匹配子文本信息。

*语法：*  搜索结果DEELX数组  *正则表达式DEELX*．搜索全部W （［用来匹配的文本］， ［开始查找匹配的位置］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 可选的 ； 字节集。Unicode格式，进行匹配的字符串。 |
| 开始查找匹配的位置 | 可选的 ； 整数型。开始查找匹配的位置. |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520149122302412.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)

---

### 取所有匹配文本

- 原文链接：https://esdn.ijingyi.com/title-8678.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：文本型数组
- 语法：文本型数组 正则表达式DEELX ．取所有匹配文本 （ 用来匹配的文本 ， ［ 要返回的匹配文本数目 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与整个正则表达式匹配的文本。返回匹配到的一维文本数组，本命令不处理正则表达式中括号里的子文本，和“分割”命令相似，但结果不同。如果失败则返回一个空数组，即没有任何成员的数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 必填 | 文本型 |  |
| 要返回的匹配文本数目 | 可空 | 整数型 | 如果被省略或等于0，则默认返回所有的匹配文本。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题1.e

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148473869175.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取所有匹配文本 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
取得与整个正则表达式匹配的文本。返回匹配到的一维文本数组，本命令不处理正则表达式中括号里的子文本，和“分割”命令相似，但结果不同。如果失败则返回一个空数组，即没有任何成员的数组。

*语法：*  文本型数组  *正则表达式DEELX*．取所有匹配文本 （用来匹配的文本， ［要返回的匹配文本数目］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 必需的 ； 文本型。 |
| 要返回的匹配文本数目 | 可选的 ； 整数型。如果被省略或等于0，则默认返回所有的匹配文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148473869175.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题1.e](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_%E5%8F%96%E6%89%80%E6%9C%89%E5%8C%B9%E9%85%8D%E6%96%87%E6%9C%AC.e)

---

### 取所有匹配文本W

- 原文链接：https://esdn.ijingyi.com/title-8679.html
- 操作系统支持：Windows 所属对象： 正则表达式DEELX
- 返回值类型：字节集数组
- 语法：字节集数组 正则表达式DEELX ．取所有匹配文本W （ 用来匹配的文本 ， ［ 要返回的匹配文本数目 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与整个正则表达式匹配的文本。返回匹配到的一维字节集数组，本命令不处理正则表达式中括号里的子文本，和“分割”命令相似，但结果不同。如果失败则返回一个空数组，即没有任何成员的数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用来匹配的文本 | 必填 | 字节集 | Unicode格式文本。 |
| 要返回的匹配文本数目 | 可空 | 整数型 | 如果被省略或等于0，则默认返回所有的匹配文本。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有匹配文本W 方法**   操作系统支持：Windows    所属对象：[正则表达式DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt0.htm)

为高级用户提供，初级用户无需掌握；
取得与整个正则表达式匹配的文本。返回匹配到的一维字节集数组，本命令不处理正则表达式中括号里的子文本，和“分割”命令相似，但结果不同。如果失败则返回一个空数组，即没有任何成员的数组。

*语法：*  字节集数组  *正则表达式DEELX*．取所有匹配文本W （用来匹配的文本， ［要返回的匹配文本数目］）

| 参数名 | 描 述 |
| --- | --- |
| 用来匹配的文本 | 必需的 ； 字节集。Unicode格式文本。 |
| 要返回的匹配文本数目 | 可选的 ； 整数型。如果被省略或等于0，则默认返回所有的匹配文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 是否为空

- 原文链接：https://esdn.ijingyi.com/title-8681.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：逻辑型
- 语法：逻辑型 搜索结果DEELX ．是否为空 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 如果本对象的内容为空，返回真；否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**是否为空 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
如果本对象的内容为空，返回真；否则返回假。

*语法：*  逻辑型  *搜索结果DEELX*．是否为空 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 是否匹配

- 原文链接：https://esdn.ijingyi.com/title-8682.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．是否匹配 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 是否匹配成功。返回非零值表示匹配成功，返回 0 表示匹配失败。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**是否匹配 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
是否匹配成功。返回非零值表示匹配成功，返回 0 表示匹配失败。

*语法：*  整数型  *搜索结果DEELX*．是否匹配 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 获取开始位置

- 原文链接：https://esdn.ijingyi.com/title-8683.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．获取开始位置 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 匹配成功后，获取所匹配到的子字符串的开始位置。如果匹配失败，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**获取开始位置 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
匹配成功后，获取所匹配到的子字符串的开始位置。如果匹配失败，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

*语法：*  整数型  *搜索结果DEELX*．获取开始位置 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 获取结束位置

- 原文链接：https://esdn.ijingyi.com/title-8684.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．获取结束位置 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 匹配成功后，获取所匹配到的子字符串的结束位置。如果匹配失败，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**获取结束位置 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
匹配成功后，获取所匹配到的子字符串的结束位置。如果匹配失败，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

*语法：*  整数型  *搜索结果DEELX*．获取结束位置 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 获取分组开始位置

- 原文链接：https://esdn.ijingyi.com/title-8685.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．获取分组开始位置 （ 分组编号 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回指定分组捕获的字符串的开始位置。如果指定分组未捕获，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 分组编号 | 必填 | 整数型 | 分组编号。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**获取分组开始位置 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
返回指定分组捕获的字符串的开始位置。如果指定分组未捕获，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

*语法：*  整数型  *搜索结果DEELX*．获取分组开始位置 （分组编号）

| 参数名 | 描 述 |
| --- | --- |
| 分组编号 | 必需的 ； 整数型。分组编号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 获取分组结束位置

- 原文链接：https://esdn.ijingyi.com/title-8686.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．获取分组结束位置 （ 分组编号 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回指定分组捕获的字符串的结束位置。如果指定分组未捕获，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 分组编号 | 必填 | 整数型 | 分组编号。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**获取分组结束位置 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
返回指定分组捕获的字符串的结束位置。如果指定分组未捕获，则返回负值。注意：本支持库内部采用Unicode编码，返回的位置也是相对于Unicode字符串的。

*语法：*  整数型  *搜索结果DEELX*．获取分组结束位置 （分组编号）

| 参数名 | 描 述 |
| --- | --- |
| 分组编号 | 必需的 ； 整数型。分组编号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取最大分组编号

- 原文链接：https://esdn.ijingyi.com/title-8687.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．取最大分组编号 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 获取正则表达式最大捕获组编号。返回最大分组编号。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取最大分组编号 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
获取正则表达式最大捕获组编号。返回最大分组编号。

*语法：*  整数型  *搜索结果DEELX*．取最大分组编号 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取子表达式个数

- 原文链接：https://esdn.ijingyi.com/title-8688.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：整数型
- 语法：整数型 搜索结果DEELX ．取子表达式个数 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回该表达式中子表达式（用圆括号标记）的个数。（本结果和取最大分组编号相同,只不过是为了更兼容原支持库增加的）。

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例程

![例程截图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520150338166264.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取子表达式个数 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
返回该表达式中子表达式（用圆括号标记）的个数。（本结果和取最大分组编号相同,只不过是为了更兼容原支持库增加的）。

*语法：*  整数型  *搜索结果DEELX*．取子表达式个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/ueditor/php/upload/image/20180304/1520150338166264.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例程](https://esdn.ijingyi.com/ueditor/php/upload/file/20180304/DEELX_%E6%A8%A1%E6%8B%9F%E6%98%93%E8%AF%AD%E8%A8%80%E9%85%8D%E7%BD%AE%E9%A1%B9.e)

---

### 取匹配文本

- 原文链接：https://esdn.ijingyi.com/title-8689.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：文本型
- 语法：文本型 搜索结果DEELX ．取匹配文本 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与整个正则表达式匹配的子文本。

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149485685489.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取匹配文本 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
取得与整个正则表达式匹配的子文本。

*语法：*  文本型  *搜索结果DEELX*．取匹配文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149485685489.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_%E9%80%92%E5%BD%92%E8%A1%A8%E8%BE%BE%E5%BC%8F.e)

---

### 取匹配文本W

- 原文链接：https://esdn.ijingyi.com/title-8690.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：字节集
- 语法：字节集 搜索结果DEELX ．取匹配文本W （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与整个正则表达式匹配的子文本(Unicode格式文本，字节集类型)。

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题 1

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148851470963.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取匹配文本W 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
取得与整个正则表达式匹配的子文本(Unicode格式文本，字节集类型)。

*语法：*  字节集  *搜索结果DEELX*．取匹配文本W （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520148851470963.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)1

---

### 取子匹配文本

- 原文链接：https://esdn.ijingyi.com/title-8691.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：文本型
- 语法：文本型 搜索结果DEELX ．取子匹配文本 （ 子表达式索引或名称 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与正则表达式中某个子表达式匹配的子文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 子表达式索引或名称 | 必填 | 通用型 | 欲取其值的子表达式。该参数对应与正则表达式中的一个子表达式（以圆括号标记）。子匹配索引从1开始，0表示匹配文本。 或者传递文本型的子表达式分组名称，比如“(? \d+)(? [a-z]+)(? [A-Z]+)”这样的表达式，可以传递“数字”、“小写字母”等名称。 也可以传递字节集形式的参数，当成Unicode格式的名称对待。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149485685489.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取子匹配文本 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
取得与正则表达式中某个子表达式匹配的子文本。

*语法：*  文本型  *搜索结果DEELX*．取子匹配文本 （子表达式索引或名称）

| 参数名 | 描 述 |
| --- | --- |
| 子表达式索引或名称 | 必需的 ； 通用型。欲取其值的子表达式。该参数对应与正则表达式中的一个子表达式（以圆括号标记）。子匹配索引从1开始，0表示匹配文本。 或者传递文本型的子表达式分组名称，比如“(? \d+)(? [a-z]+)(? [A-Z]+)”这样的表达式，可以传递“数字”、“小写字母”等名称。 也可以传递字节集形式的参数，当成Unicode格式的名称对待。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149485685489.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_%E9%80%92%E5%BD%92%E8%A1%A8%E8%BE%BE%E5%BC%8F.e)

---

### 取子匹配文本W

- 原文链接：https://esdn.ijingyi.com/title-8692.html
- 操作系统支持：Windows 所属对象： 搜索结果DEELX
- 返回值类型：字节集
- 语法：字节集 搜索结果DEELX ．取子匹配文本W （ 子表达式索引或名称 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取得与正则表达式中某个子表达式匹配的子文本(Unicode格式文本，字节集类型)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 子表达式索引或名称 | 必填 | 通用型 | 欲取其值的子表达式。该参数对应与正则表达式中的一个子表达式（以圆括号标记）。子匹配索引从1开始，0表示匹配文本。 或者传递文本型的子表达式分组名称，比如“(? \d+)(? [a-z]+)(? [A-Z]+)”这样的表达式，可以传递“数字”、“小写字母”等名称。 也可以传递字节集形式的参数，当成Unicode格式的名称对待。 |

- 参见：语法的描述规则、基本数据类型

**例程**

参见 : 例题

![例程截图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149122302412.png)

![例程截图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**取子匹配文本W 方法**   操作系统支持：Windows    所属对象：[搜索结果DEELX](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/dt1.htm)

为高级用户提供，初级用户无需掌握；
取得与正则表达式中某个子表达式匹配的子文本(Unicode格式文本，字节集类型)。

*语法：*  字节集  *搜索结果DEELX*．取子匹配文本W （子表达式索引或名称）

| 参数名 | 描 述 |
| --- | --- |
| 子表达式索引或名称 | 必需的 ； 通用型。欲取其值的子表达式。该参数对应与正则表达式中的一个子表达式（以圆括号标记）。子匹配索引从1开始，0表示匹配文本。 或者传递文本型的子表达式分组名称，比如“(? \d+)(? [a-z]+)(? [A-Z]+)”这样的表达式，可以传递“数字”、“小写字母”等名称。 也可以传递字节集形式的参数，当成Unicode格式的名称对待。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/ueditor/php/upload/image/20180304/1520149122302412.png)

参见:
![站点例程/配图](http://esdn.125.la/source/plugin/eknow/js/ueditor/dialogs/attachment/fileTypeImages/icon_txt.gif)
[例题](http://esdn.125.la/ueditor/php/upload/file/20180304/DEELX_Unicode%E6%96%87%E6%9C%AC%E6%B5%8B%E8%AF%95.e)

---

### 正则常量

- 原文链接：https://esdn.ijingyi.com/title-8654.html
- 操作系统支持：Windows 跳至： 正则表达式支持库(Deelx版)
- 功能说明：DEELX正则表达式用到的常量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 单行模式 | 待核实 | 待核实 | 常量值为 1 。使小数点 "." 可以匹配包含换行符（\n）在内的任意字符。默认情况下，小数点只匹配换行符以外的任意字符，不匹配换行符。 |
| 多行模式 | 待核实 | 待核实 | 常量值为 2 。使 ^ 符号除了能够匹配字符串开始位置外，还能匹配换行符（\n）之后的位置；使 $ 符号除了能够匹配字符串结束位置外，还能匹配换行符之前的位置。 默认情况下， ^ 符号只能匹配字符串开始位置， $ 符号只能匹配字符串结束位置。 单行模式(SINGLELINE) 和 多行模式(MULTILINE) 虽然听起来相互矛盾，但却是作用在不同的地方。因此它们是可以组合使用的。 在指定了 多行模式(MULTILINE) 之后，如果需要仅匹配字符串开始和结束位置，可以使用 \A 和 \Z。 |
| 全局模式 | 待核实 | 待核实 | 常量值为 4 。使 \G 可以用来匹配本次查找匹配的开始位置，对于连续的匹配来说，也就是上次匹配的结束位置。默认情况下， \G 没有作用。 |
| 忽略大小写 | 待核实 | 待核实 | 常量值为 8 。匹配时忽略大小写。默认情况下，正则表达式是要区分大小写的。不管是否指定忽略大小写模式，字符类，比如 [A-Z] 是要区分大小写的。 |
| 从右向左 | 待核实 | 待核实 | 常量值为 16 。从右向左的进行匹配。从被匹配字符串的结束位置向前进行查找匹配，同时，在表达式中也是右侧的表达式先进行匹配。 |
| 扩展模式 | 待核实 | 待核实 | 常量值为 32 。使 本正则支持库忽略表达式中的空白字符，并且把从 # 开始到该行行末的内容视为注释。默认情况下，正则表达式中的空格，换行等字符将可以匹配相应的字符。指定了 扩展模式(EXTENDED) 模式后，如果要在正则表达式中表示空白字符比如空格符号（space）时，应该用 \x20 表示，如果要在表达式中表示 # 符号，应该用 \# 表示。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**正则常量 枚举常量集合类型**   操作系统支持：Windows    跳至：[正则表达式支持库(Deelx版)](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/DeelxRegEx/index.htm)

DEELX正则表达式用到的常量。

| 成员 | 描 述 |
| --- | --- |
| 单行模式 | 常量值为 1 。使小数点 "." 可以匹配包含换行符（\n）在内的任意字符。默认情况下，小数点只匹配换行符以外的任意字符，不匹配换行符。 |
| 多行模式 | 常量值为 2 。使 ^ 符号除了能够匹配字符串开始位置外，还能匹配换行符（\n）之后的位置；使 $ 符号除了能够匹配字符串结束位置外，还能匹配换行符之前的位置。 默认情况下， ^ 符号只能匹配字符串开始位置， $ 符号只能匹配字符串结束位置。 单行模式(SINGLELINE) 和 多行模式(MULTILINE) 虽然听起来相互矛盾，但却是作用在不同的地方。因此它们是可以组合使用的。 在指定了 多行模式(MULTILINE) 之后，如果需要仅匹配字符串开始和结束位置，可以使用 \A 和 \Z。 |
| 全局模式 | 常量值为 4 。使 \G 可以用来匹配本次查找匹配的开始位置，对于连续的匹配来说，也就是上次匹配的结束位置。默认情况下， \G 没有作用。 |
| 忽略大小写 | 常量值为 8 。匹配时忽略大小写。默认情况下，正则表达式是要区分大小写的。不管是否指定忽略大小写模式，字符类，比如 [A-Z] 是要区分大小写的。 |
| 从右向左 | 常量值为 16 。从右向左的进行匹配。从被匹配字符串的结束位置向前进行查找匹配，同时，在表达式中也是右侧的表达式先进行匹配。 |
| 扩展模式 | 常量值为 32 。使 本正则支持库忽略表达式中的空白字符，并且把从 # 开始到该行行末的内容视为注释。默认情况下，正则表达式中的空格，换行等字符将可以匹配相应的字符。指定了 扩展模式(EXTENDED) 模式后，如果要在正则表达式中表示空白字符比如空格符号（space）时，应该用 \x20 表示，如果要在表达式中表示 # 符号，应该用 \# 表示。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
