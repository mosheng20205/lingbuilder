# BT下载支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-14977.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**BT下载支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库提供BT下载功能。

操作系统支持： Windows、Linux

**命令类别：**

| 全局命令 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| BT下载 | 任务信息 | 服务器日志 | 上传下载日志 |
| --- | --- | --- | --- |
| 发布文件信息 | 其它日志 | 下载设置信息 | 块大小 |

## 命令分类：命令类别（5 条）

### 分析发布文件

- 原文链接：https://esdn.ijingyi.com/title-14997.html
- 操作系统支持：Windows、Linux
- 所属类别：全局命令
- 返回值类型：发布文件信息
- 语法：发布文件信息 分析发布文件 （ 发布文件名 ）
- 功能说明：分析发布文件(Torrent文件)，取到其中的信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 发布文件名 | 必填 | 文本型 | 本参数表示指定发布文件名(Torrent)。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd13.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd13.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

分析发布文件返回的类型是“发布文件信息”类型。 取出信息后显示在编辑框里。 参见： 例程

**完整正文（站点原文转换）**

**分析发布文件 命令**   操作系统支持：Windows、Linux    所属类别：[全局命令](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/ct0.htm)

分析发布文件(Torrent文件)，取到其中的信息。

*语法：*  发布文件信息  分析发布文件 （发布文件名）

| 参数名 | 描 述 |
| --- | --- |
| 发布文件名 | 必需的 ； 文本型。本参数表示指定发布文件名(Torrent)。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd13.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd13.files/image002.gif)

说明：

分析发布文件返回的类型是“发布文件信息”类型。

取出信息后显示在编辑框里。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd1.e)

---

### 制做发布文件

- 原文链接：https://esdn.ijingyi.com/title-14998.html
- 操作系统支持：Windows、Linux
- 所属类别：全局命令
- 返回值类型：整数型
- 语法：整数型 制做发布文件 （ 文件类型 ， 名称 ， 服务器地址 ， 发布路径 ， 块大小 ， 注释 ， ［ 创建者 ］ ）
- 功能说明：制做发布文件(Torrent文件)。返回0表示成功，-1表示参数错误，-2表示编码出错，-3表示写文件失败, -4表示计算SHA1值失败。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件类型 | 必填 | 整数型，初始值为“2” | 本参数表示要发布文件的类型，1表示目录，2表示文件。 |
| 名称 | 必填 | 文本型 | 本参数表示目录名或文件名。 |
| 服务器地址 | 必填 | 文本型 | 本参数表示Tracker服务器的地址。多个服务器之间用“;”分隔。 |
| 发布路径 | 必填 | 文本型 | 本参数表示生成的发布文件的路径。 |
| 块大小 | 必填 | 整数型 | 本参数表示每一块的大小。值可以为“块大小”数据类型中的常量值。 |
| 注释 | 必填 | 文本型，初始值为“” | 本参数表示关于此发布文件的注释。 |
| 创建者 | 可空 | 文本型 | 如果被省略，默认为“ebit”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd14.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd14.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

块大小为常量， 1 ， 2 ， 3 ， 4 ， 5 ， 6 ， 7 分别代表 32KB ， 64KB ， 128KB ， 256KB ， 512KB ， 1024KB ， 2048KB 。 参见： 例程

**完整正文（站点原文转换）**

**制做发布文件 命令**   操作系统支持：Windows、Linux    所属类别：[全局命令](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/ct0.htm)

制做发布文件(Torrent文件)。返回0表示成功，-1表示参数错误，-2表示编码出错，-3表示写文件失败, -4表示计算SHA1值失败。

*语法：*  整数型  制做发布文件 （文件类型， 名称， 服务器地址， 发布路径， 块大小， 注释， ［创建者］）

| 参数名 | 描 述 |
| --- | --- |
| 文件类型 | 必需的 ； 整数型，初始值为“2”。本参数表示要发布文件的类型，1表示目录，2表示文件。 |
| 名称 | 必需的 ； 文本型。本参数表示目录名或文件名。 |
| 服务器地址 | 必需的 ； 文本型。本参数表示Tracker服务器的地址。多个服务器之间用“;”分隔。 |
| 发布路径 | 必需的 ； 文本型。本参数表示生成的发布文件的路径。 |
| 块大小 | 必需的 ； 整数型。本参数表示每一块的大小。值可以为“块大小”数据类型中的常量值。 |
| 注释 | 必需的 ； 文本型，初始值为“”。本参数表示关于此发布文件的注释。 |
| 创建者 | 可选的 ； 文本型。如果被省略，默认为“ebit”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd14.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd14.files/image002.gif)

说明：

　

块大小为常量，1，2，3，4，5，6，7分别代表32KB，64KB，128KB，256KB，512KB，1024KB，2048KB。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd2.e)

---

### 下载设置

- 原文链接：https://esdn.ijingyi.com/title-14999.html
- 操作系统支持：Windows、Linux
- 所属类别：全局命令
- 返回值类型：逻辑型
- 语法：逻辑型 下载设置 （ 下载设置信息 ）
- 功能说明：进行一些基本的全局的参数设置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 下载设置信息 | 必填 | 下载设置信息 | 本参数表示下载的参数信息。 |

- 参见：语法的描述规则、基本数据类型

**注意事项/说明**

>说明 在进行添加新任务之前进行设置。 参见： 例程

**完整正文（站点原文转换）**

**下载设置 命令**   操作系统支持：Windows、Linux    所属类别：[全局命令](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/ct0.htm)

进行一些基本的全局的参数设置。

*语法：*  逻辑型  下载设置 （下载设置信息）

| 参数名 | 描 述 |
| --- | --- |
| 下载设置信息 | 必需的 ； 下载设置信息。本参数表示下载的参数信息。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd20.files/image001.gif)

说明

在进行添加新任务之前进行设置。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd3.e)

---

### 重新检查完整性

- 原文链接：https://esdn.ijingyi.com/title-15000.html
- 操作系统支持：Windows、Linux
- 所属类别：全局命令
- 返回值类型：逻辑型
- 语法：逻辑型 重新检查完整性 （ 发布文件名 ， 本地文件路径 ， 本地文件名 ， 百分比 ， 字节数 ， 任务内容 ， 日志 ）
- 功能说明：重新检查下载后文件的完整性。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 发布文件名 | 必填 | 文本型 | 本参数表示要检查的发布文件名(torrent)。 |
| 本地文件路径 | 必填 | 文本型 | 本参数表示被下载文件的本地保存路径。 |
| 本地文件名 | 必填 | 文本型，初始值为“” | 本参数表示被下载文件的本地文件名，如本参数为空则用发布文件中默认的文件名。 |
| 百分比 | 必填 | 整数型，参数数据只能提供变量 | 本参数传回下载了百分之几。 |
| 字节数 | 必填 | 长整数型，参数数据只能提供变量 | 本参数传回已写入硬盘的字节数。 |
| 任务内容 | 必填 | 字节集，参数数据只能提供变量 | 本参数传回任务内容，可用作传入“增加新任务”方法的参数中，以避免效验文件。 |
| 日志 | 必填 | 子程序指针 | 本参数表示检查进度的日志回调函数，详见“其它日志”数据类型的“检查完整性中”成员。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

检查下载后文件的完整性，返回逻辑值。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**重新检查完整性 命令**   操作系统支持：Windows、Linux    所属类别：[全局命令](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/ct0.htm)

重新检查下载后文件的完整性。

*语法：*  逻辑型  重新检查完整性 （发布文件名， 本地文件路径， 本地文件名， 百分比， 字节数， 任务内容， 日志）

| 参数名 | 描 述 |
| --- | --- |
| 发布文件名 | 必需的 ； 文本型。本参数表示要检查的发布文件名(torrent)。 |
| 本地文件路径 | 必需的 ； 文本型。本参数表示被下载文件的本地保存路径。 |
| 本地文件名 | 必需的 ； 文本型，初始值为“”。本参数表示被下载文件的本地文件名，如本参数为空则用发布文件中默认的文件名。 |
| 百分比 | 必需的 ； 整数型，参数数据只能提供变量。本参数传回下载了百分之几。 |
| 字节数 | 必需的 ； 长整数型，参数数据只能提供变量。本参数传回已写入硬盘的字节数。 |
| 任务内容 | 必需的 ； 字节集，参数数据只能提供变量。本参数传回任务内容，可用作传入“增加新任务”方法的参数中，以避免效验文件。 |
| 日志 | 必需的 ； 子程序指针。本参数表示检查进度的日志回调函数，详见“其它日志”数据类型的“检查完整性中”成员。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd22.files/image001.gif)

说明：

检查下载后文件的完整性，返回逻辑值。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 测试代理服务器

- 原文链接：https://esdn.ijingyi.com/title-15001.html
- 操作系统支持：Windows、Linux
- 所属类别：全局命令
- 返回值类型：逻辑型
- 语法：逻辑型 测试代理服务器 （ 地址 ， 端口 ）
- 功能说明：测试代理服务器是否能成功连上。注：调用此方法要先调用“下载设置”命令设置代理服务器相关内容。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 地址 | 必填 | 文本型 | 本参数表示要连接的IP地址，如www.dywt.com.cn。 |
| 端口 | 必填 | 整数型，初始值为“80” | 本参数表示要连接的端口。 |

- 参见：语法的描述规则、基本数据类型

**注意事项/说明**

>说明 测试代理服务器是否能成功连上，返回逻辑型。 参见： 例程

**完整正文（站点原文转换）**

**测试代理服务器 命令**   操作系统支持：Windows、Linux    所属类别：[全局命令](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/ct0.htm)

测试代理服务器是否能成功连上。注：调用此方法要先调用“下载设置”命令设置代理服务器相关内容。

*语法：*  逻辑型  测试代理服务器 （地址， 端口）

| 参数名 | 描 述 |
| --- | --- |
| 地址 | 必需的 ； 文本型。本参数表示要连接的IP地址，如www.dywt.com.cn。 |
| 端口 | 必需的 ； 整数型，初始值为“80”。本参数表示要连接的端口。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程　

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd25.files/image001.gif)

说明

测试代理服务器是否能成功连上，返回逻辑型。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd5.e)

---

## 命令分类：其他数据类型（21 条）

### 增加新任务

- 原文链接：https://esdn.ijingyi.com/title-15003.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．增加新任务 （ 任务信息 ）
- 功能说明：增加一个下载任务。注：本函数返回真并不是已经真正开始下载了，要通过“其它日志”中的“下载已全部停止”的参数三来判断。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 任务信息 | 必填 | 任务信息 | 本参数表示下载任务的相关信息。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd2.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd2.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

增加新任务方法需要一个“任务信息”数据类型的参数。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**增加新任务 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

增加一个下载任务。注：本函数返回真并不是已经真正开始下载了，要通过“其它日志”中的“下载已全部停止”的参数三来判断。

*语法：*  逻辑型  *BT下载*．增加新任务 （任务信息）

| 参数名 | 描 述 |
| --- | --- |
| 任务信息 | 必需的 ； 任务信息。本参数表示下载任务的相关信息。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd2.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd2.files/image002.gif)

说明：

增加新任务方法需要一个“任务信息”数据类型的参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 暂停本任务

- 原文链接：https://esdn.ijingyi.com/title-15004.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．暂停本任务 （ ）
- 功能说明：暂停一个正在下载的任务，可以用“继续本任务”方法使本任务继续运行。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd3.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

暂停本任务方法，不需要参数。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**暂停本任务 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

暂停一个正在下载的任务，可以用“继续本任务”方法使本任务继续运行。

*语法：*  逻辑型  *BT下载*．暂停本任务 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd3.files/image001.gif)

说明：

暂停本任务方法，不需要参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd6.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 继续本任务

- 原文链接：https://esdn.ijingyi.com/title-15005.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．继续本任务 （ ［ 任务内容 ］ ）
- 功能说明：继续下载一个暂停的任务。如果发现下载的文件丢失或数据有误，可在“重新检查完整性”后指定新的任务内容。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 任务内容 | 可空 | 字节集 | 如果提供本参数，则更新当前任务内容。如果被省略，保持当前任务内容不变。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd4.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

继续本任务方法，不需要参数。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**继续本任务 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

继续下载一个暂停的任务。如果发现下载的文件丢失或数据有误，可在“重新检查完整性”后指定新的任务内容。

*语法：*  逻辑型  *BT下载*．继续本任务 （［任务内容］）

| 参数名 | 描 述 |
| --- | --- |
| 任务内容 | 可选的 ； 字节集。如果提供本参数，则更新当前任务内容。如果被省略，保持当前任务内容不变。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd4.files/image001.gif)

说明：

继续本任务方法，不需要参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd6.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 停止本任务

- 原文链接：https://esdn.ijingyi.com/title-15006.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．停止本任务 （ ）
- 功能说明：停止一个运行中的任务。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd5.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

停止本任务方法，不需要参数。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**停止本任务 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

停止一个运行中的任务。

*语法：*  逻辑型  *BT下载*．停止本任务 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd5.files/image001.gif)

说明：

停止本任务方法，不需要参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd6.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 增加连接

- 原文链接：https://esdn.ijingyi.com/title-15007.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．增加连接 （ 地址 ， 端口号 ）
- 功能说明：增加一个连接。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 地址 | 必填 | 文本型，初始值为“” | 本参数表示要连接的IP地址，如果本参数为空则自动选择。 |
| 端口号 | 必填 | 整数型，初始值为“0” | 本参数表示端口号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd6.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

添加 IP 地址，端口号，可以增加一个指定的连接。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**增加连接 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

增加一个连接。

*语法：*  逻辑型  *BT下载*．增加连接 （地址， 端口号）

| 参数名 | 描 述 |
| --- | --- |
| 地址 | 必需的 ； 文本型，初始值为“”。本参数表示要连接的IP地址，如果本参数为空则自动选择。 |
| 端口号 | 必需的 ； 整数型，初始值为“0”。本参数表示端口号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd6.files/image001.gif)

说明：

添加IP地址，端口号，可以增加一个指定的连接。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 减少连接

- 原文链接：https://esdn.ijingyi.com/title-15008.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．减少连接 （ ）
- 功能说明：减少一个连接。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd7.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

减少一个连接无参数。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**减少连接 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

减少一个连接。

*语法：*  逻辑型  *BT下载*．减少连接 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd7.files/image001.gif)

说明：

减少一个连接无参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 取下载速度

- 原文链接：https://esdn.ijingyi.com/title-15009.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：整数型
- 语法：整数型 BT下载 ．取下载速度 （ ）
- 功能说明：获得下载速度，本命令获得的速度为即时速度。如，每间隔1秒调用一次本命令，那么获得的值表示1秒内收到的数据，间隔2秒则表示2秒内收到的数据。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在时钟周期中加入此方法，每隔一定时间检测一次。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**取下载速度 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

获得下载速度，本命令获得的速度为即时速度。如，每间隔1秒调用一次本命令，那么获得的值表示1秒内收到的数据，间隔2秒则表示2秒内收到的数据。

*语法：*  整数型  *BT下载*．取下载速度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd8.files/image001.gif)

说明：

在时钟周期中加入此方法，每隔一定时间检测一次。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 取上传速度

- 原文链接：https://esdn.ijingyi.com/title-15010.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：整数型
- 语法：整数型 BT下载 ．取上传速度 （ ）
- 功能说明：获得上传速度，本命令获得的速度为即时速度。如，每间隔1秒调用一次本命令，那么获得的值表示1秒内发送的数据，间隔2秒则表示2秒内发送的数据。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在时钟周期中加入此方法，每隔一定时间检测一次。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**取上传速度 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

获得上传速度，本命令获得的速度为即时速度。如，每间隔1秒调用一次本命令，那么获得的值表示1秒内发送的数据，间隔2秒则表示2秒内发送的数据。

*语法：*  整数型  *BT下载*．取上传速度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd9.files/image001.gif)

说明：

在时钟周期中加入此方法，每隔一定时间检测一次。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 限制下载速度

- 原文链接：https://esdn.ijingyi.com/title-15011.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．限制下载速度 （ 下载速度 ）
- 功能说明：限制下载速度。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 下载速度 | 必填 | 整数型 | 本参数表示要限制的速度，单位为字节数/每秒。如 1024/s,表示1k/s。 |

- 参见：语法的描述规则、基本数据类型

**例程**

系统 .edb 种子 .edb 种子.edt

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

>说明 数据类型为“ BT 下载”的实例化变量可以直接调用本命令。 参见： 例程 系统 .edb 种子 .edb 种子.edt

**完整正文（站点原文转换）**

**限制下载速度 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

限制下载速度。

*语法：*  逻辑型  *BT下载*．限制下载速度 （下载速度）

| 参数名 | 描 述 |
| --- | --- |
| 下载速度 | 必需的 ； 整数型。本参数表示要限制的速度，单位为字节数/每秒。如 1024/s,表示1k/s。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程

　
![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd18.files/image001.gif)

说明

 数据类型为“BT下载”的实例化变量可以直接调用本命令。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e)  [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb)
[种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子.edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 限制上传速度

- 原文链接：https://esdn.ijingyi.com/title-15012.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．限制上传速度 （ 上传速度 ）
- 功能说明：限制上传速度。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 上传速度 | 必填 | 整数型 | 本参数表示要限制的速度，单位为字节数/每秒。如 1024/s,表示1k/s。 |

- 参见：语法的描述规则、基本数据类型

**例程**

系统 .edb 种子 .edb 种子.edt

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

>说明 数据类型为“ BT 下载”的实例化变量可以直接调用本命令。 参见： 例程 系统 .edb 种子 .edb 种子.edt

**完整正文（站点原文转换）**

**限制上传速度 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

限制上传速度。

*语法：*  逻辑型  *BT下载*．限制上传速度 （上传速度）

| 参数名 | 描 述 |
| --- | --- |
| 上传速度 | 必需的 ； 整数型。本参数表示要限制的速度，单位为字节数/每秒。如 1024/s,表示1k/s。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd19.files/image001.gif)

说明

 数据类型为“BT下载”的实例化变量可以直接调用本命令。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e)  [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb)
[种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子.edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 取任务内容

- 原文链接：https://esdn.ijingyi.com/title-15013.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．取任务内容 （ 任务内容 ）
- 功能说明：获得任务内容，在指定的时间(一般是停止任务之前)执行本命令来取得任务信息,在“增加新任务”方法的参数中传进去，可以避免每次都效验文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 任务内容 | 必填 | 字节集，参数数据只能提供变量 | 本参数表示要保存的任务内容。 |

- 参见：语法的描述规则、基本数据类型

**例程**

系统 .edb 种子 .edb 种子 .edt

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

>说明 数据类型为“ BT 下载”的实例化变量可以直接调用本命令。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**取任务内容 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

获得任务内容，在指定的时间(一般是停止任务之前)执行本命令来取得任务信息,在“增加新任务”方法的参数中传进去，可以避免每次都效验文件。

*语法：*  逻辑型  *BT下载*．取任务内容 （任务内容）

| 参数名 | 描 述 |
| --- | --- |
| 任务内容 | 必需的 ； 字节集，参数数据只能提供变量。本参数表示要保存的任务内容。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd21.files/image001.gif)

说明

 数据类型为“BT下载”的实例化变量可以直接调用本命令。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 取下载号

- 原文链接：https://esdn.ijingyi.com/title-15014.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：整数型
- 语法：整数型 BT下载 ．取下载号 （ ）
- 功能说明：取当前下载对象的下载号。主要用于各种日志的第一个参数。

- 参见：语法的描述规则、基本数据类型

**例程**

系统 .edb 种子 .edb 种子 .edt

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

>说明 数据类型为“ BT 下载”的实例化变量可以直接调用本命令。 参见： 例程 系统 .edb 种子 .edb 种子 .edt

**完整正文（站点原文转换）**

**取下载号 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

取当前下载对象的下载号。主要用于各种日志的第一个参数。

*语法：*  整数型  *BT下载*．取下载号 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程　

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd23.files/image001.gif)

说明

 数据类型为“BT下载”的实例化变量可以直接调用本命令。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e) [系统 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子 .edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子 .edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 是否停止

- 原文链接：https://esdn.ijingyi.com/title-15015.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．是否停止 （ ）
- 功能说明：返回当前任务是否收到停止消息，主要用在回调函数中，如果任务已收到停止消息，就要马上从回调函数中返回。

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image004.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image005.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

服务器日志函数，上传下载日志函数，其他日志函数，都需要这个方法。 参见： 例程 系统.edb 种子.edb 种子.edt

**完整正文（站点原文转换）**

**是否停止 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

返回当前任务是否收到停止消息，主要用在回调函数中，如果任务已收到停止消息，就要马上从回调函数中返回。

*语法：*  逻辑型  *BT下载*．是否停止 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image004.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image005.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd24.files/image002.gif)

说明：

服务器日志函数，上传下载日志函数，其他日志函数，都需要这个方法。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd.e) [系统.edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子.edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子.edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 添加服务器

- 原文链接：https://esdn.ijingyi.com/title-15016.html
- 操作系统支持：Windows、Linux 所属对象： BT下载
- 返回值类型：逻辑型
- 语法：逻辑型 BT下载 ．添加服务器 （ 地址 ， 端口 ）
- 功能说明：手动添加服务器(Tracker)。注：有些BT的Tracker服务器有备用的，并不在发布文件中，所以要有此方法。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 地址 | 必填 | 文本型 | 本参数表示备用服务器(Tracker)的IP地址。 |
| 端口 | 必填 | 整数型，初始值为“6969” | 本参数表示要连接的端口。 |

- 参见：语法的描述规则、基本数据类型

**例程**

例程：

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

添加 发布文件中没有的服务器地址和端口。 参见 例程 系统.edb 种子.edb 种子.edt

**完整正文（站点原文转换）**

**添加服务器 方法**   操作系统支持：Windows、Linux    所属对象：[BT下载](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/dt0.htm)

手动添加服务器(Tracker)。注：有些BT的Tracker服务器有备用的，并不在发布文件中，所以要有此方法。

*语法：*  逻辑型  *BT下载*．添加服务器 （地址， 端口）

| 参数名 | 描 述 |
| --- | --- |
| 地址 | 必需的 ； 文本型。本参数表示备用服务器(Tracker)的IP地址。 |
| 端口 | 必需的 ； 整数型，初始值为“6969”。本参数表示要连接的端口。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd26.files/image001.gif)

说明：

添加发布文件中没有的服务器地址和端口。

参见 [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/cmd15.e) [系统.edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/system.edb) [种子.edb](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edb) [种子.edt](https://esdn.ijingyi.com/source/plugin/eknow/resource/btdownload//btdownload/zhongzi.edt)

---

### 任务信息

- 原文链接：https://esdn.ijingyi.com/title-14982.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：下载时要提供的信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 发布文件名 | 待核实 | 待核实 | 文本型； 初始值为“”。本参数指定发布文件(torrent)的路径和文件名。 |
| 本地文件路径 | 待核实 | 待核实 | 文本型； 初始值为“”。本参数指定被下载文件的本地保存路径。 |
| 本地文件名 | 待核实 | 待核实 | 文本型； 初始值为“”。本参数指定被下载文件的本地文件名，如本参数为空则用Torrent文件中默认的文件名。 |
| 服务器日志 | 待核实 | 待核实 | 子程序指针； 本参数指定与Tracker服务器通讯时的回调函数。本函数有六个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“服务器日志”数据类型中的常量;第三个类型为“文本型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第五个类型为“整数型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第六个类型为“日期时间型”表示记录日志的时间。返回值为“逻辑型”。 |
| 上传下载日志 | 待核实 | 待核实 | 子程序指针； 本参数指定用于上传下载日志的回调函数。本函数有五个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“上传下载日志”数据类型中的常量;第三个类型为“整数型”本参数表示连接序号，每一个连接都有唯一的序号。-1表示还没有选择序号;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“上传下载日志”数据类型中的说明;第五个类型为“文本型”根据第二个参数的不同意义不同，详细看“上传下载日志”数据类型中的说明;返回值为“逻辑型”。注：在使用本参数时，在易语言中对应的函数中如果要对本函数中作用域之外的变量改变,在函数入口和出口处分别加上“进入许可区”“退出许可区”命令，以确保不会发生多线程的竟争冲突。 |
| 其它日志 | 待核实 | 待核实 | 子程序指针； 本参数指定用于其它日志的回调函数。本函数有六个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“其它日志”数据类型中的常量;第三个类型为“整数型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第五个类型为“文本型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第六个类型为“文本型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;返回值为“逻辑型”。 |
| 主动连接数 | 待核实 | 待核实 | 整数型； 初始值为 5 。本参数指定默认的主动连接数。 |
| 最大连接数 | 待核实 | 待核实 | 整数型； 初始值为 10 。本参数指定的最大的连接数。 |
| 任务内容 | 待核实 | 待核实 | 字节集； 本参数指定“取任务内容”方法返回的字节集,可以避免重新效验文件。如果为空字节集或传入字节集错误就会效验文件。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**任务信息 普通类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

下载时要提供的信息。

| 成员 | 描 述 |
| --- | --- |
| 发布文件名 | 文本型； 初始值为“”。本参数指定发布文件(torrent)的路径和文件名。 |
| 本地文件路径 | 文本型； 初始值为“”。本参数指定被下载文件的本地保存路径。 |
| 本地文件名 | 文本型； 初始值为“”。本参数指定被下载文件的本地文件名，如本参数为空则用Torrent文件中默认的文件名。 |
| 服务器日志 | 子程序指针； 本参数指定与Tracker服务器通讯时的回调函数。本函数有六个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“服务器日志”数据类型中的常量;第三个类型为“文本型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第五个类型为“整数型”根据第二个参数的不同意义不同，详细看“服务器日志”数据类型中的说明;第六个类型为“日期时间型”表示记录日志的时间。返回值为“逻辑型”。 |
| 上传下载日志 | 子程序指针； 本参数指定用于上传下载日志的回调函数。本函数有五个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“上传下载日志”数据类型中的常量;第三个类型为“整数型”本参数表示连接序号，每一个连接都有唯一的序号。-1表示还没有选择序号;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“上传下载日志”数据类型中的说明;第五个类型为“文本型”根据第二个参数的不同意义不同，详细看“上传下载日志”数据类型中的说明;返回值为“逻辑型”。注：在使用本参数时，在易语言中对应的函数中如果要对本函数中作用域之外的变量改变,在函数入口和出口处分别加上“进入许可区”“退出许可区”命令，以确保不会发生多线程的竟争冲突。 |
| 其它日志 | 子程序指针； 本参数指定用于其它日志的回调函数。本函数有六个参数，第一个类型为“整数型”，是调用此回调函数对象的下载号;第二个类型为“整数型”，是“其它日志”数据类型中的常量;第三个类型为“整数型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第四个类型为“整数型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第五个类型为“文本型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;第六个类型为“文本型”根据第二个参数的不同意义不同，详细看“其它日志”数据类型中的说明;返回值为“逻辑型”。 |
| 主动连接数 | 整数型； 初始值为 5 。本参数指定默认的主动连接数。 |
| 最大连接数 | 整数型； 初始值为 10 。本参数指定的最大的连接数。 |
| 任务内容 | 字节集； 本参数指定“取任务内容”方法返回的字节集,可以避免重新效验文件。如果为空字节集或传入字节集错误就会效验文件。 |

**方法：**

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 服务器日志

- 原文链接：https://esdn.ijingyi.com/title-14983.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：本数据类型包括了与Tracker服务器通信过程中写入日志的类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 服务器地址 | 待核实 | 待核实 | 常量值为 1 。得到一个服务器地址。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。 |
| 连接服务器 | 必填 | 待核实 | 常量值为 2 。准备连接服务器。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。以后的服务器操作都是针对这个服务器的，必要时可记录参数三和参数四的值，以备后用。 |
| 连接服务器失败 | 待核实 | 待核实 | 常量值为 3 。连接服务器失败。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。 |
| 发送请求 | 待核实 | 待核实 | 常量值为 4 。发送请求。参数三为请求内容，参数四和参数五无意义。 |
| 发送请求失败 | 待核实 | 待核实 | 常量值为 5 。发送请求失败。参数三为请求内容，参数四和参数五无意义。 |
| 准备接收数据 | 待核实 | 待核实 | 常量值为 6 。准备接收数据。参数三无意义，参数四无意义。参数五无意义。 |
| 接收数据失败 | 待核实 | 待核实 | 常量值为 7 。接收数据失败。参数三无意义，参数四无意义。参数五无意义。 |
| 分析返回数据 | 待核实 | 待核实 | 常量值为 8 。分析返回数据。参数三是服务器返回数据的文本形式，参数四是服务器返回数据的内存地址，参数五是服务器返回数据的数据长度（单位是字节）。考虑到服务器所返回的数据不一定是纯文本，所以额外提供了参数四和参数五，可使用“指针到字节集”命令读取。此处约定的参数含义可能会在后续版本中进行改动。 |
| 分析返回数据失败 | 待核实 | 待核实 | 常量值为 9 。分析返回数据失败。参数三表示失败原因，参数四和参数五无意义。 |
| 取到远程客户端 | 待核实 | 待核实 | 常量值为 10 。取到远程的客户端。参数四表示取到的远程客户端个数。参数三和参数五无意义。 |
| 设置重试时间 | 待核实 | 待核实 | 常量值为 11 。设置下一次连接该服务器的时间。参数三表示要设置服务器的地址，参数四表示要设置服务器的端口，参数五表示重试时间（单位为毫秒）。 |
| 重定向 | 待核实 | 待核实 | 常量值为 12 。在此服务器上发生重定向，后续操作将自动连接重定向后的服务器。参数三和参数四分别表示重定向后的服务器地址和端口。参数五无意义。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**服务器日志 枚举常量集合类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

本数据类型包括了与Tracker服务器通信过程中写入日志的类型。

| 成员 | 描 述 |
| --- | --- |
| 服务器地址 | 常量值为 1 。得到一个服务器地址。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。 |
| 连接服务器 | 常量值为 2 。准备连接服务器。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。以后的服务器操作都是针对这个服务器的，必要时可记录参数三和参数四的值，以备后用。 |
| 连接服务器失败 | 常量值为 3 。连接服务器失败。参数三表示服务器地址，参数四表示此服务器的端口。参数五无意义。 |
| 发送请求 | 常量值为 4 。发送请求。参数三为请求内容，参数四和参数五无意义。 |
| 发送请求失败 | 常量值为 5 。发送请求失败。参数三为请求内容，参数四和参数五无意义。 |
| 准备接收数据 | 常量值为 6 。准备接收数据。参数三无意义，参数四无意义。参数五无意义。 |
| 接收数据失败 | 常量值为 7 。接收数据失败。参数三无意义，参数四无意义。参数五无意义。 |
| 分析返回数据 | 常量值为 8 。分析返回数据。参数三是服务器返回数据的文本形式，参数四是服务器返回数据的内存地址，参数五是服务器返回数据的数据长度（单位是字节）。考虑到服务器所返回的数据不一定是纯文本，所以额外提供了参数四和参数五，可使用“指针到字节集”命令读取。此处约定的参数含义可能会在后续版本中进行改动。 |
| 分析返回数据失败 | 常量值为 9 。分析返回数据失败。参数三表示失败原因，参数四和参数五无意义。 |
| 取到远程客户端 | 常量值为 10 。取到远程的客户端。参数四表示取到的远程客户端个数。参数三和参数五无意义。 |
| 设置重试时间 | 常量值为 11 。设置下一次连接该服务器的时间。参数三表示要设置服务器的地址，参数四表示要设置服务器的端口，参数五表示重试时间（单位为毫秒）。 |
| 重定向 | 常量值为 12 。在此服务器上发生重定向，后续操作将自动连接重定向后的服务器。参数三和参数四分别表示重定向后的服务器地址和端口。参数五无意义。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 上传下载日志

- 原文链接：https://esdn.ijingyi.com/title-14984.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：本数据类型包括了上传下载过程中写入日志的类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 选择地址失败 | 待核实 | 待核实 | 常量值为 1 。主动连接选择IP地址失败，准备重试。 |
| 选择地址成功 | 待核实 | 待核实 | 常量值为 2 。主动连接选择IP地址成功。参数四表示端口号，参数五表示IP地址。 |
| 拒绝连接 | 待核实 | 待核实 | 常量值为 3 。超过最大连接数，拒绝连接。参数四表示端口号，参数五表示IP地址。 |
| 选择序号成功 | 待核实 | 待核实 | 常量值为 4 。选择序号成功。此操作之后序号就唯一的表示了本次连接。参数四表示端口号，参数五表示IP地址。 |
| 连接失败 | 待核实 | 待核实 | 常量值为 5 。连接失败。 |
| 握手成功 | 待核实 | 待核实 | 常量值为 6 。握手成功。BT通信前必须要经过握手。 |
| 完成百分比 | 待核实 | 待核实 | 常量值为 7 。对方已经下载完成的百分比。参数四表示下载了百分之几。 |
| 准备上传 | 待核实 | 待核实 | 常量值为 8 。已经可以上传。 |
| 准备下载 | 待核实 | 待核实 | 常量值为 9 。已经可以下载。 |
| 下载 | 待核实 | 待核实 | 常量值为 10 。本次下载的字节数。参数四表示本次下载的字节数。 |
| 上传 | 待核实 | 待核实 | 常量值为 11 。本次上传的字节数。参数四表示本次上传的字节数。 |
| 连接完成 | 待核实 | 待核实 | 常量值为 12 。本次连接完成。 |
| 写入磁盘 | 待核实 | 待核实 | 常量值为 13 。写入磁盘的实际字节数。参数四表示本次写入磁盘的字节数。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**上传下载日志 枚举常量集合类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

本数据类型包括了上传下载过程中写入日志的类型。

| 成员 | 描 述 |
| --- | --- |
| 选择地址失败 | 常量值为 1 。主动连接选择IP地址失败，准备重试。 |
| 选择地址成功 | 常量值为 2 。主动连接选择IP地址成功。参数四表示端口号，参数五表示IP地址。 |
| 拒绝连接 | 常量值为 3 。超过最大连接数，拒绝连接。参数四表示端口号，参数五表示IP地址。 |
| 选择序号成功 | 常量值为 4 。选择序号成功。此操作之后序号就唯一的表示了本次连接。参数四表示端口号，参数五表示IP地址。 |
| 连接失败 | 常量值为 5 。连接失败。 |
| 握手成功 | 常量值为 6 。握手成功。BT通信前必须要经过握手。 |
| 完成百分比 | 常量值为 7 。对方已经下载完成的百分比。参数四表示下载了百分之几。 |
| 准备上传 | 常量值为 8 。已经可以上传。 |
| 准备下载 | 常量值为 9 。已经可以下载。 |
| 下载 | 常量值为 10 。本次下载的字节数。参数四表示本次下载的字节数。 |
| 上传 | 常量值为 11 。本次上传的字节数。参数四表示本次上传的字节数。 |
| 连接完成 | 常量值为 12 。本次连接完成。 |
| 写入磁盘 | 常量值为 13 。写入磁盘的实际字节数。参数四表示本次写入磁盘的字节数。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 发布文件信息

- 原文链接：https://esdn.ijingyi.com/title-14985.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：本数据类型包括了发布文件(Torrent)中的信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 服务器列表 | 待核实 | 待核实 | 文本型； 初始值为“”。本参数表示服务器(Tracker)列表，多个服务器用“;”分隔开。 |
| 注释 | 待核实 | 待核实 | 文本型； 本参数表示此文件的注释。 |
| 建立者 | 待核实 | 待核实 | 文本型； 本参数表示此文件的建立者。 |
| 文件目录或名称 | 待核实 | 待核实 | 文本型； 本参数表示此Torrent包含的文件名称，如果是单文件则就是文件名，如果是多文件则为目录名。 |
| 文件总长度 | 待核实 | 待核实 | 长整数型； 本参数表示此Torrent包含的文件总长度。 |
| 每块长度 | 待核实 | 待核实 | 整数型； 本参数表示每一块的长度。 |
| 块数 | 待核实 | 待核实 | 整数型； 本参数表示本文件一共有多少块。 |
| 文件长度[1] | 待核实 | 待核实 | 长整数型； 本参数表示如果是多文件时每一个文件的长度，数组下标与“文件名称”相对应。 |
| 文件名称[1] | 待核实 | 待核实 | 文本型； 本参数表示如果是多文件时每一个文件的名称，数组下标与“文件长度”相对应。 |
| 效验码 | 待核实 | 待核实 | 文本型； 本参数表示此文件的效验码。 |
| 建立时间 | 待核实 | 待核实 | 日期时间型； 本参数表示此文件建立的时间。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**发布文件信息 普通类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

本数据类型包括了发布文件(Torrent)中的信息。

| 成员 | 描 述 |
| --- | --- |
| 服务器列表 | 文本型； 初始值为“”。本参数表示服务器(Tracker)列表，多个服务器用“;”分隔开。 |
| 注释 | 文本型； 本参数表示此文件的注释。 |
| 建立者 | 文本型； 本参数表示此文件的建立者。 |
| 文件目录或名称 | 文本型； 本参数表示此Torrent包含的文件名称，如果是单文件则就是文件名，如果是多文件则为目录名。 |
| 文件总长度 | 长整数型； 本参数表示此Torrent包含的文件总长度。 |
| 每块长度 | 整数型； 本参数表示每一块的长度。 |
| 块数 | 整数型； 本参数表示本文件一共有多少块。 |
| 文件长度[1] | 长整数型； 本参数表示如果是多文件时每一个文件的长度，数组下标与“文件名称”相对应。 |
| 文件名称[1] | 文本型； 本参数表示如果是多文件时每一个文件的名称，数组下标与“文件长度”相对应。 |
| 效验码 | 文本型； 本参数表示此文件的效验码。 |
| 建立时间 | 日期时间型； 本参数表示此文件建立的时间。 |

**方法：**

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 其它日志

- 原文链接：https://esdn.ijingyi.com/title-14986.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：本数据类型包括了其它日志的类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 检查完整性后 | 待核实 | 待核实 | 常量值为 1 。检查后传回已下载了多少。参数三表示下载了百分之几，参数四表示已写入硬盘的千字节数(KB)。 |
| 远程客户端 | 待核实 | 待核实 | 常量值为 2 。主动连接获得一个远程客户端。参数三表示端口，参数四无意义，参数五表示IP地址，参数六表示本客户端的唯一标识符（可能为空）。 |
| 监听端口 | 待核实 | 待核实 | 常量值为 3 。监听端口成功。参数三表示监听的端口。 |
| 检查完整性中 | 待核实 | 待核实 | 常量值为 4 。检查完整性中,每检查完一片，就发送一次本日志。参数三表示检查完第几片，参数四表示一共有几片。 |
| 下载已全部停止 | 待核实 | 待核实 | 常量值为 5 。表示下载已全部停止。参数三表示退出原因。0:正常退出。-1:解码发布文件失败。-2:建立或打开本地文件失败。-3:对本地文件进行分片失败。-4:准备上传失败。-5:与Tracker服务器通讯失败。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**其它日志 枚举常量集合类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

本数据类型包括了其它日志的类型。

| 成员 | 描 述 |
| --- | --- |
| 检查完整性后 | 常量值为 1 。检查后传回已下载了多少。参数三表示下载了百分之几，参数四表示已写入硬盘的千字节数(KB)。 |
| 远程客户端 | 常量值为 2 。主动连接获得一个远程客户端。参数三表示端口，参数四无意义，参数五表示IP地址，参数六表示本客户端的唯一标识符（可能为空）。 |
| 监听端口 | 常量值为 3 。监听端口成功。参数三表示监听的端口。 |
| 检查完整性中 | 常量值为 4 。检查完整性中,每检查完一片，就发送一次本日志。参数三表示检查完第几片，参数四表示一共有几片。 |
| 下载已全部停止 | 常量值为 5 。表示下载已全部停止。参数三表示退出原因。0:正常退出。-1:解码发布文件失败。-2:建立或打开本地文件失败。-3:对本地文件进行分片失败。-4:准备上传失败。-5:与Tracker服务器通讯失败。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 下载设置信息

- 原文链接：https://esdn.ijingyi.com/title-14987.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：设置下载参数的信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 每地址连接数 | 待核实 | 待核实 | 整数型； 初始值为 1 。本参数表示一个IP地址最多允许同时有几个连接。 |
| 开始监听端口 | 待核实 | 待核实 | 整数型； 初始值为 9001 。本参数表示监听的端口开始值。 |
| 结束监听端口 | 待核实 | 待核实 | 整数型； 初始值为 9100 。本参数表示监听的端口结束值。 |
| 阻塞值 | 待核实 | 待核实 | 整数型； 初始值为 2048 。本参数表示当上传比下载大多少时，就阻塞对方(不给对方上传)。单位为:千字节(KB)注：在下载完成后，本参数失效。 |
| 连接超时 | 待核实 | 待核实 | 整数型； 初始值为 60000 。本参数表示在一条连接上多长时间没有发生数据交换就断开此连接。单位为毫秒。 |
| 代理服务器类型 | 待核实 | 待核实 | 整数型； 初始值为 0 。本参数表示代理服务器的类型0为不使用，1为HTTP1.1, 2为SOCKS5。 |
| 代理服务器地址 | 待核实 | 待核实 | 文本型； 本参数表示代理服务器的IP地址。 |
| 代理服务器端口 | 待核实 | 待核实 | 整数型； 初始值为 0 。本参数表示代理服务器的端口。 |
| 用户名 | 待核实 | 待核实 | 文本型； 本参数表示代理服务器需要验证的用户名。 |
| 口令 | 待核实 | 待核实 | 文本型； 本参数表示代理服务器需要验证的口令。 |
| 连接服务器超时 | 待核实 | 待核实 | 整数型； 初始值为 30000 。本参数表示连接Tracker服务器时的超时。单位为毫秒。注：本超时不能低于10秒。 |
| 连接下载者超时 | 待核实 | 待核实 | 整数型； 初始值为 30000 。本参数表示连接其它下载者时的超时。单位为毫秒。注：本超时不能低于20秒。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**下载设置信息 普通类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

设置下载参数的信息。

| 成员 | 描 述 |
| --- | --- |
| 每地址连接数 | 整数型； 初始值为 1 。本参数表示一个IP地址最多允许同时有几个连接。 |
| 开始监听端口 | 整数型； 初始值为 9001 。本参数表示监听的端口开始值。 |
| 结束监听端口 | 整数型； 初始值为 9100 。本参数表示监听的端口结束值。 |
| 阻塞值 | 整数型； 初始值为 2048 。本参数表示当上传比下载大多少时，就阻塞对方(不给对方上传)。单位为:千字节(KB)注：在下载完成后，本参数失效。 |
| 连接超时 | 整数型； 初始值为 60000 。本参数表示在一条连接上多长时间没有发生数据交换就断开此连接。单位为毫秒。 |
| 代理服务器类型 | 整数型； 初始值为 0 。本参数表示代理服务器的类型0为不使用，1为HTTP1.1, 2为SOCKS5。 |
| 代理服务器地址 | 文本型； 本参数表示代理服务器的IP地址。 |
| 代理服务器端口 | 整数型； 初始值为 0 。本参数表示代理服务器的端口。 |
| 用户名 | 文本型； 本参数表示代理服务器需要验证的用户名。 |
| 口令 | 文本型； 本参数表示代理服务器需要验证的口令。 |
| 连接服务器超时 | 整数型； 初始值为 30000 。本参数表示连接Tracker服务器时的超时。单位为毫秒。注：本超时不能低于10秒。 |
| 连接下载者超时 | 整数型； 初始值为 30000 。本参数表示连接其它下载者时的超时。单位为毫秒。注：本超时不能低于20秒。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 块大小

- 原文链接：https://esdn.ijingyi.com/title-14988.html
- 操作系统支持：Windows、Linux 跳至： BT下载支持库
- 功能说明：本数据类型包括了关于块大小的常量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| KB32 | 待核实 | 待核实 | 常量值为 1 。表示每块大小为32KB。 |
| KB64 | 待核实 | 待核实 | 常量值为 2 。表示每块大小为64KB。 |
| KB128 | 待核实 | 待核实 | 常量值为 3 。表示每块大小为128KB。 |
| KB256 | 待核实 | 待核实 | 常量值为 4 。表示每块大小为256KB。 |
| KB512 | 待核实 | 待核实 | 常量值为 5 。表示每块大小为512KB。 |
| KB1024 | 待核实 | 待核实 | 常量值为 6 。表示每块大小为1024KB。 |
| KB2048 | 待核实 | 待核实 | 常量值为 7 。表示每块大小为2048KB。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**块大小 枚举常量集合类型**   操作系统支持：Windows、Linux    跳至：[BT下载支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/btdownload/index.htm)

本数据类型包括了关于块大小的常量。

| 成员 | 描 述 |
| --- | --- |
| KB32 | 常量值为 1 。表示每块大小为32KB。 |
| KB64 | 常量值为 2 。表示每块大小为64KB。 |
| KB128 | 常量值为 3 。表示每块大小为128KB。 |
| KB256 | 常量值为 4 。表示每块大小为256KB。 |
| KB512 | 常量值为 5 。表示每块大小为512KB。 |
| KB1024 | 常量值为 6 。表示每块大小为1024KB。 |
| KB2048 | 常量值为 7 。表示每块大小为2048KB。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
