# Sqlite数据库支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-13304.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**Sqlite数据库支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

Sqlite数据库是一个小型关系型文件数据库；跨平台；支持SQL语句、事务、触发器、视图；速度相当快；小巧且不依赖任何额外的驱动程序。Sqlite数据库是本地数据库，不是网络数据库。
    相对于易语言数据库，Sqlite数据库的优势是支持SQL语句、事务、触发器、视图；
    相对于Microsoft Access，Sqlite数据库的优势是跨平台、无需额外驱动；
    相对于其它非本地数据库，如Oracle、DB2、MS SQL Server、MySQL、PostgreSQL，Sqlite数据库具有小巧、速度快的优势。
    内部使用的Sqlite版本是3.2.5。本支持库将只为向后兼容而存在，不会再有版本升级，推荐使用“Sqlite3数据库支持库”。

操作系统支持： Windows、Linux

**命令类别：**

| 数据库 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| Sqlite数据库 | Sqlite表 | Sqlite记录集 | Sqlite字段信息 |
| --- | --- | --- | --- |

## 命令分类：其他数据类型（83 条）

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13313.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．是否已打开 （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 数据库是否打开。 参见： 例程

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd29.files/image001.gif)

说明

判断Sqlite数据库是否打开。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13314.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．打开 （ ［ 数据库文件 ］ ， ［ 是否允许创建 ］ ）
- 功能说明：打开或新建数据库。要打开或新建的数据库由第一个参数“数据库文件”指定（一个Sqlite数据库就是一个文件）；如果指定的数据库文件不存在，则由第二个参数“是否允许创建”决定是否以该文件名创建新数据库。如果参数“数据库文件”被省略或为空文本，且参数“是否允许创建”为“真”，则在“内存中”创建并打开数据库。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数据库文件 | 可空 | 文本型 | 欲打开的数据库文件，请使用完整的路径和文件名。 |
| 是否允许创建 | 可空 | 逻辑型 | 在指定的数据库文件不存在的情况下，如果本属性为“真”，则创建该数据库，否则直接返回“假”。本参数如果被省略，默认为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

打开或创建 Sqlite 数据库。 参见： 例程

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

打开或新建数据库。要打开或新建的数据库由第一个参数“数据库文件”指定（一个Sqlite数据库就是一个文件）；如果指定的数据库文件不存在，则由第二个参数“是否允许创建”决定是否以该文件名创建新数据库。如果参数“数据库文件”被省略或为空文本，且参数“是否允许创建”为“真”，则在“内存中”创建并打开数据库。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite数据库*．打开 （［数据库文件］， ［是否允许创建］）

| 参数名 | 描 述 |
| --- | --- |
| 数据库文件 | 可选的 ； 文本型。欲打开的数据库文件，请使用完整的路径和文件名。 |
| 是否允许创建 | 可选的 ； 逻辑型。在指定的数据库文件不存在的情况下，如果本属性为“真”，则创建该数据库，否则直接返回“假”。本参数如果被省略，默认为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd30.files/image001.gif)

说明

打开或创建Sqlite数据库。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13315.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．关闭 （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

关闭 Sqlite 数据库。 参见： 例程

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd31.files/image001.gif)

说明

关闭Sqlite数据库。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 执行SQL语句

- 原文链接：https://esdn.ijingyi.com/title-13316.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．执行SQL语句 （ 欲执行的SQL语句 ）
- 功能说明：执行指定的一条或多条SQL语句。执行成功返回真，失败返回假。本方法不能处理带“SQL参数”的SQL语句。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲执行的SQL语句 | 必填 | 文本型 | 多个SQL语句之间请以半角分号“;”隔开，最后一个SQL语句后面可以不加“;”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

本方法不能处理带 “SQL 参数 ” 的 SQL 语句 。 参见： 例程

**完整正文（站点原文转换）**

**执行SQL语句 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

执行指定的一条或多条SQL语句。执行成功返回真，失败返回假。本方法不能处理带“SQL参数”的SQL语句。

*语法：*  逻辑型  *Sqlite数据库*．执行SQL语句 （欲执行的SQL语句）

| 参数名 | 描 述 |
| --- | --- |
| 欲执行的SQL语句 | 必需的 ； 文本型。多个SQL语句之间请以半角分号“;”隔开，最后一个SQL语句后面可以不加“;”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd32.files/image001.gif)

说明

本方法不能处理带“SQL参数”的SQL语句。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取记录集

- 原文链接：https://esdn.ijingyi.com/title-13317.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：Sqlite记录集
- 语法：Sqlite记录集 Sqlite数据库 ．取记录集 （ SQL语句 ）
- 功能说明：返回“Sqlite记录集”对象。本方法等效于“Sqlite记录集.置SQL语句()”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SQL语句 | 必填 | 文本型 | SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“Sqlite记录集.绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库的记录集对象。 参见： 例程

**完整正文（站点原文转换）**

**取记录集 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

返回“Sqlite记录集”对象。本方法等效于“Sqlite记录集.置SQL语句()”。

*语法：*  Sqlite记录集  *Sqlite数据库*．取记录集 （SQL语句）

| 参数名 | 描 述 |
| --- | --- |
| SQL语句 | 必需的 ； 文本型。SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“Sqlite记录集.绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd33.files/image001.gif)

说明

获取Sqlite数据库的记录集对象。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 置最大等待时间

- 原文链接：https://esdn.ijingyi.com/title-13318.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．置最大等待时间 （ 最大等待时间(单位: 秒) ）
- 功能说明：设置数据库被锁定时的最大等待时间，如果数据库超过最大等待时间后还没有被解锁，则中止尝试执行当前操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 最大等待时间(单位: 秒) | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd36.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 Sqlite 数据库锁定时间。 参见： 例程

**完整正文（站点原文转换）**

**置最大等待时间 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

设置数据库被锁定时的最大等待时间，如果数据库超过最大等待时间后还没有被解锁，则中止尝试执行当前操作。

*语法：*  逻辑型  *Sqlite数据库*．置最大等待时间 （最大等待时间(单位: 秒)）

| 参数名 | 描 述 |
| --- | --- |
| 最大等待时间(单位: 秒) | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd36.files/image001.gif)

说明

设置Sqlite数据库锁定时间。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取错误码

- 原文链接：https://esdn.ijingyi.com/title-13319.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：整数型
- 语法：整数型 Sqlite数据库 ．取错误码 （ ）
- 功能说明：取前面最近一次操作的执行结果的错误代码。如果错误代码为0表示前一次操作成功。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd37.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库 最近一次操作的执行结果代码 。 参见： 例程

**完整正文（站点原文转换）**

**取错误码 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

取前面最近一次操作的执行结果的错误代码。如果错误代码为0表示前一次操作成功。

*语法：*  整数型  *Sqlite数据库*．取错误码 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd37.files/image001.gif)

说明

获取Sqlite数据库最近一次操作的执行结果代码。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取错误文本

- 原文链接：https://esdn.ijingyi.com/title-13320.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型
- 语法：文本型 Sqlite数据库 ．取错误文本 （ ）
- 功能说明：取前面最近一次操作的执行结果的错误信息文本。如果前一次操作成功或本方法调用失败，将返回空文本。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库 最近一次操作的执行结果的错误信息文本 。 参见： 例程

**完整正文（站点原文转换）**

**取错误文本 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

取前面最近一次操作的执行结果的错误信息文本。如果前一次操作成功或本方法调用失败，将返回空文本。

*语法：*  文本型  *Sqlite数据库*．取错误文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd38.files/image001.gif)

说明

获取Sqlite数据库最近一次操作的执行结果的错误信息文本。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取最新插入ID

- 原文链接：https://esdn.ijingyi.com/title-13321.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：长整数型
- 语法：长整数型 Sqlite数据库 ．取最新插入ID （ ）
- 功能说明：取前面最近一次插入的记录的记录ID。记录ID从1开始。如果执行失败将返回0。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库 最近一次插入 的记录的记录 ID 。 参见： 例程

**完整正文（站点原文转换）**

**取最新插入ID 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

取前面最近一次插入的记录的记录ID。记录ID从1开始。如果执行失败将返回0。

*语法：*  长整数型  *Sqlite数据库*．取最新插入ID （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd39.files/image001.gif)

说明

获取Sqlite数据库最近一次插入的记录的记录ID。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 开始事务

- 原文链接：https://esdn.ijingyi.com/title-13322.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．开始事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd44.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

开始 Sqlite 数据库事务操作。 参见： 例程

**完整正文（站点原文转换）**

**开始事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．开始事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd44.files/image001.gif)

说明

开始Sqlite数据库事务操作。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 提交事务

- 原文链接：https://esdn.ijingyi.com/title-13323.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．提交事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd45.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

提交 Sqlite 数据库事务。 参见： 例程

**完整正文（站点原文转换）**

**提交事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．提交事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd45.files/image001.gif)

说明

提交Sqlite数据库事务。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 回滚事务

- 原文链接：https://esdn.ijingyi.com/title-13324.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．回滚事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

回滚 Sqlite 数据库事务。 参见： 例程

**完整正文（站点原文转换）**

**回滚事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．回滚事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd46.files/image001.gif)

说明

回滚Sqlite数据库事务。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 表是否存在

- 原文链接：https://esdn.ijingyi.com/title-13325.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．表是否存在 （ 表名 ）
- 功能说明：判断数据库是否已有指定的表或视图，包含临时表和视图。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd50.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 数据库的某个表是否存在。 参见： 例程

**完整正文（站点原文转换）**

**表是否存在 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

判断数据库是否已有指定的表或视图，包含临时表和视图。

*语法：*  逻辑型  *Sqlite数据库*．表是否存在 （表名）

| 参数名 | 描 述 |
| --- | --- |
| 表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd50.files/image001.gif)

说明

判断Sqlite数据库的某个表是否存在。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有表

- 原文链接：https://esdn.ijingyi.com/title-13326.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite数据库 ．取所有表 （ 是否包含表 ， 是否包含视图 ， 是否包含临时表或视图 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表 | 必填 | 逻辑型，初始值为“真” |  |
| 是否包含视图 | 必填 | 逻辑型，初始值为“假” |  |
| 是否包含临时表或视图 | 必填 | 逻辑型，初始值为“假” |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd51.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库中所有表的名称。 参见： 例程

**完整正文（站点原文转换）**

**取所有表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  文本型数组  *Sqlite数据库*．取所有表 （是否包含表， 是否包含视图， 是否包含临时表或视图）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表 | 必需的 ； 逻辑型，初始值为“真”。 |
| 是否包含视图 | 必需的 ； 逻辑型，初始值为“假”。 |
| 是否包含临时表或视图 | 必需的 ； 逻辑型，初始值为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd51.files/image001.gif)

说明

获取Sqlite数据库中所有表的名称。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取表内容

- 原文链接：https://esdn.ijingyi.com/title-13327.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite数据库 ．取表内容 （ 表名称 ， 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了指定表的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd52.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库表中的内容。 参见： 例程

**完整正文（站点原文转换）**

**取表内容 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

返回一个二维文本数组，其中存放了指定表的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。

*语法：*  文本型数组  *Sqlite数据库*．取表内容 （表名称， 是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd52.files/image001.gif)

说明

获取Sqlite数据库表中的内容。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取表定义

- 原文链接：https://esdn.ijingyi.com/title-13328.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型
- 语法：文本型 Sqlite数据库 ．取表定义 （ 表名称 ）
- 功能说明：返回创建指定表时所用的SQL语句（CREATE TABLE ...）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd53.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取创建 Sqlite 数据库指定表时使用的 SQL 语句。 参见： 例程

**完整正文（站点原文转换）**

**取表定义 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

返回创建指定表时所用的SQL语句（CREATE TABLE ...）。

*语法：*  文本型  *Sqlite数据库*．取表定义 （表名称）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd53.files/image001.gif)

说明

获取创建Sqlite数据库指定表时使用的SQL语句。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13329.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．读字段值 （ 表名称 ， 字段名称或位置 ， ［ 查询条件 ］ ， 字段值 ）
- 功能说明：读取指定表或视图中指定字段的值，并写入第四个参数“字段值”。如果“查询条件”参数指定不当或未指定，有可能导致产生多个满足查询条件的记录，此时将取第一条记录的指定字段值。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| 字段名称或位置 | 必填 | 通用型 | 参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 查询条件 | 可空 | 文本型 |  |
| 字段值 | 必填 | 通用型，参数数据只能提供变量 | 其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd54.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 数据库某个字段的记录。 参见： 例程 注：本例题中引用的是 取字段值 请 更改成 读字段值 即可

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

读取指定表或视图中指定字段的值，并写入第四个参数“字段值”。如果“查询条件”参数指定不当或未指定，有可能导致产生多个满足查询条件的记录，此时将取第一条记录的指定字段值。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite数据库*．读字段值 （表名称， 字段名称或位置， ［查询条件］， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 查询条件 | 可选的 ； 文本型。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd54.files/image001.gif)

说明

获取Sqlite数据库某个字段的记录。

参见：[例程](http://esdn.125.la/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

注：本例题中引用的是  取字段值   请 更改成 读字段值 即可

---

### 创建表

- 原文链接：https://esdn.ijingyi.com/title-13330.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．创建表 （ 表名称 ， 字段信息 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| 字段信息 | 必填 | Sqlite字段信息，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd61.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

创建 Sqlite 数据库表。 参见： 例程

**完整正文（站点原文转换）**

**创建表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．创建表 （表名称， 字段信息）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 字段信息 | 必需的 ； Sqlite字段信息，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd61.files/image001.gif)

说明

创建Sqlite数据库表。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 删除表

- 原文链接：https://esdn.ijingyi.com/title-13331.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．删除表 （ 要删除的表名 ）
- 功能说明：将指定表连同其中的所有记录全部删除。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 要删除的表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd63.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除 Sqlite 数据库指定表。 参见： 例程

**完整正文（站点原文转换）**

**删除表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

将指定表连同其中的所有记录全部删除。

*语法：*  逻辑型  *Sqlite数据库*．删除表 （要删除的表名）

| 参数名 | 描 述 |
| --- | --- |
| 要删除的表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd63.files/image001.gif)

说明

删除Sqlite数据库指定表。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 清空表

- 原文链接：https://esdn.ijingyi.com/title-13332.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．清空表 （ 要清空的表名 ）
- 功能说明：删除指定表中所有记录。本方法不删除表自身，也不改变表结构。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 要清空的表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd64.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

清空 Sqlite 数据库指定表中的内容。 参见： 例程

**完整正文（站点原文转换）**

**清空表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

删除指定表中所有记录。本方法不删除表自身，也不改变表结构。

*语法：*  逻辑型  *Sqlite数据库*．清空表 （要清空的表名）

| 参数名 | 描 述 |
| --- | --- |
| 要清空的表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd64.files/image001.gif)

说明

清空Sqlite数据库指定表中的内容。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 收缩数据库

- 原文链接：https://esdn.ijingyi.com/title-13333.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．收缩数据库 （ ）
- 功能说明：收缩数据所占用的磁盘空间。经过大批量记录增删之后，数据库文件可能会变的较大，调用此方法可释放一部分缓冲区域，以减少文件尺寸。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd80.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

对 Sqlite 数据库的数据进行优化，压缩 Sqlite 数据库的空间。 参见： 例程

**完整正文（站点原文转换）**

**收缩数据库 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt0.htm)

收缩数据所占用的磁盘空间。经过大批量记录增删之后，数据库文件可能会变的较大，调用此方法可释放一部分缓冲区域，以减少文件尺寸。

*语法：*  逻辑型  *Sqlite数据库*．收缩数据库 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd80.files/image001.gif)

说明

对Sqlite数据库的数据进行优化，压缩Sqlite数据库的空间。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13335.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．是否已打开 （ ）
- 功能说明：判断表是否处理打开状态。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd104.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 数据库的表是否打开。 参见： 例程

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

判断表是否处理打开状态。

*语法：*  逻辑型  *Sqlite表*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd104.files/image001.gif)

说明

判断Sqlite数据库的表是否打开。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13336.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．打开 （ 表名称 ， Sqlite数据库 ）
- 功能说明：打开指定表。成功返回真，否则返回假。表成功打开后，记录集指针将指向首记录前。一个“Sqlite表”对象同一时刻只能打开一个表，打开后一个表意味着将关闭前一个已打开的表(如果有的话)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| Sqlite数据库 | 必填 | Sqlite数据库 | 指定要打开哪个Sqlite数据库中的表。该数据库必须已经打开。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd105.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

打开 Sqlite 数据库的表。 参见： 例程

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

打开指定表。成功返回真，否则返回假。表成功打开后，记录集指针将指向首记录前。一个“Sqlite表”对象同一时刻只能打开一个表，打开后一个表意味着将关闭前一个已打开的表(如果有的话)。

*语法：*  逻辑型  *Sqlite表*．打开 （表名称， Sqlite数据库）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| Sqlite数据库 | 必需的 ； Sqlite数据库。指定要打开哪个Sqlite数据库中的表。该数据库必须已经打开。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd105.files/image001.gif)

说明

打开Sqlite数据库的表。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13337.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．关闭 （ ）
- 功能说明：关闭当前打开的表。如果用户未调用本方法关闭已打开的表，支持库会在适当的时机自动关闭该表。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd106.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

关闭 Sqlite 数据库的表。 参见： 例程

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

关闭当前打开的表。如果用户未调用本方法关闭已打开的表，支持库会在适当的时机自动关闭该表。

*语法：*  逻辑型  *Sqlite表*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd106.files/image001.gif)

说明

关闭Sqlite数据库的表。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 到首记录

- 原文链接：https://esdn.ijingyi.com/title-13338.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到首记录 （ ）
- 功能说明：移动到表的第一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd107.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动到 Sqlite 表的 第一条记录 。 参见： 例程

**完整正文（站点原文转换）**

**到首记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

移动到表的第一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到首记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd107.files/image001.gif)

说明

移动到Sqlite表的第一条记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 到尾记录

- 原文链接：https://esdn.ijingyi.com/title-13339.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到尾记录 （ ）
- 功能说明：移动到表的最后一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd108.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动到 Sqlite 表的最后一条记录。 参见： 例程

**完整正文（站点原文转换）**

**到尾记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

移动到表的最后一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到尾记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd108.files/image001.gif)

说明

移动到Sqlite表的最后一条记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 到下一记录

- 原文链接：https://esdn.ijingyi.com/title-13340.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到下一记录 （ ）
- 功能说明：移动到下一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd109.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动到 Sqlite 表的下一条记录。 参见： 例程

**完整正文（站点原文转换）**

**到下一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

移动到下一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到下一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd109.files/image001.gif)

说明

移动到Sqlite表的下一条记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 到上一记录

- 原文链接：https://esdn.ijingyi.com/title-13341.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到上一记录 （ ）
- 功能说明：移动到上一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd110.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动到 Sqlite 表的上一条记录。 参见： 例程

**完整正文（站点原文转换）**

**到上一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

移动到上一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到上一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd110.files/image001.gif)

说明

移动到Sqlite表的上一条记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 跳过

- 原文链接：https://esdn.ijingyi.com/title-13342.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．跳过 （ ［ 欲跳过的记录数 ］ ）
- 功能说明：将当前记录指针向前或者向后移动数条记录。执行成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲跳过的记录数 | 可空 | 整数型 | 参数值如果为负数，则向前移动，否则向后移动。如果本参数被省略，默认值为 1 ，即向后移动一条记录。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd111.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动当前记录的指针。 参见： 例程

**完整正文（站点原文转换）**

**跳过 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

将当前记录指针向前或者向后移动数条记录。执行成功返回真，失败返回假。

*语法：*  逻辑型  *Sqlite表*．跳过 （［欲跳过的记录数］）

| 参数名 | 描 述 |
| --- | --- |
| 欲跳过的记录数 | 可选的 ； 整数型。参数值如果为负数，则向前移动，否则向后移动。如果本参数被省略，默认值为 1 ，即向后移动一条记录。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd111.files/image001.gif)

说明

移动当前记录的指针。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 跳到

- 原文链接：https://esdn.ijingyi.com/title-13343.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．跳到 （ 欲跳到的记录号 ）
- 功能说明：改变当前记录指针到指定的记录号。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲跳到的记录号 | 必填 | 整数型 | 参数值所指定的记录号从 1 开始，即首记录的记录号为 1 ，依此类推。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd112.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动当前记录指针到指定的位置。 参见： 例程

**完整正文（站点原文转换）**

**跳到 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

改变当前记录指针到指定的记录号。成功返回真，失败返回假。

*语法：*  逻辑型  *Sqlite表*．跳到 （欲跳到的记录号）

| 参数名 | 描 述 |
| --- | --- |
| 欲跳到的记录号 | 必需的 ； 整数型。参数值所指定的记录号从 1 开始，即首记录的记录号为 1 ，依此类推。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd112.files/image001.gif)

说明

移动当前记录指针到指定的位置。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 首记录前

- 原文链接：https://esdn.ijingyi.com/title-13344.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．首记录前 （ ）
- 功能说明：如果当前记录指针已在首记录的前面，返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd113.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 表当前的记录 指针是否在首记录的前面 。 参见： 例程

**完整正文（站点原文转换）**

**首记录前 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

如果当前记录指针已在首记录的前面，返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．首记录前 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd113.files/image001.gif)

说明

判断Sqlite表当前的记录指针是否在首记录的前面。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 尾记录后

- 原文链接：https://esdn.ijingyi.com/title-13345.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．尾记录后 （ ）
- 功能说明：如果当前记录指针已在尾记录的后面，返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd114.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 表的当前记录 指针是否在尾记录的后面 。 参见： 例程

**完整正文（站点原文转换）**

**尾记录后 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

如果当前记录指针已在尾记录的后面，返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．尾记录后 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd114.files/image001.gif)

说明

判断Sqlite表的当前记录指针是否在尾记录的后面。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 编辑

- 原文链接：https://esdn.ijingyi.com/title-13346.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．编辑 （ ）
- 功能说明：进入“编辑”状态，准备修改当前记录。在调用本方法后，可使用“写字段值()”修改当前记录中的各字段值；只有调用“提交()”后才会实际执行修改操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd120.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

进入 Sqlite 表的编辑状态，修改当前记录。 参见： 例程

**完整正文（站点原文转换）**

**编辑 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

进入“编辑”状态，准备修改当前记录。在调用本方法后，可使用“写字段值()”修改当前记录中的各字段值；只有调用“提交()”后才会实际执行修改操作。

*语法：*  逻辑型  *Sqlite表*．编辑 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd120.files/image001.gif)

说明

进入Sqlite表的编辑状态，修改当前记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 插入

- 原文链接：https://esdn.ijingyi.com/title-13347.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．插入 （ ）
- 功能说明：进入“插入”状态，准备向表中插入一条记录。在调用本方法后，可使用“写字段值()”填充要插入记录中的各字段值；只有调用“提交()”后才会实际执行插入操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd121.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

进入 Sqlite 表的插入状态。 参见： 例程

**完整正文（站点原文转换）**

**插入 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

进入“插入”状态，准备向表中插入一条记录。在调用本方法后，可使用“写字段值()”填充要插入记录中的各字段值；只有调用“提交()”后才会实际执行插入操作。

*语法：*  逻辑型  *Sqlite表*．插入 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd121.files/image001.gif)

说明

进入Sqlite表的插入状态。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 删除

- 原文链接：https://esdn.ijingyi.com/title-13348.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．删除 （ ）
- 功能说明：删除当前记录。删除成功后，记录指针指向着记录前。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd122.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除 Sqlite 表的当前记录。 参见： 例程

**完整正文（站点原文转换）**

**删除 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

删除当前记录。删除成功后，记录指针指向着记录前。

*语法：*  逻辑型  *Sqlite表*．删除 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd122.files/image001.gif)

说明

删除Sqlite表的当前记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 提交

- 原文链接：https://esdn.ijingyi.com/title-13349.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．提交 （ ）
- 功能说明：将“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”）提交到数据库，并退出“编辑”或“插入”状态。执行成功返回真，失败返回假。如果不执行此方法，数据库不会被实际修改。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd123.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

对 Sqlite 表中的记录进行修改或插入操作。 参见： 例程

**完整正文（站点原文转换）**

**提交 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

将“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”）提交到数据库，并退出“编辑”或“插入”状态。执行成功返回真，失败返回假。如果不执行此方法，数据库不会被实际修改。

*语法：*  逻辑型  *Sqlite表*．提交 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd123.files/image001.gif)

说明

对Sqlite表中的记录进行修改或插入操作。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取消

- 原文链接：https://esdn.ijingyi.com/title-13350.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．取消 （ ）
- 功能说明：取消“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”），并退出“编辑”或“插入”状态。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd124.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取消对 Sqlite 表中数据的编辑或插入操作。 参见： 例程

**完整正文（站点原文转换）**

**取消 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

取消“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”），并退出“编辑”或“插入”状态。

*语法：*  逻辑型  *Sqlite表*．取消 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd124.files/image001.gif)

说明

取消对Sqlite表中数据的编辑或插入操作。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 刷新

- 原文链接：https://esdn.ijingyi.com/title-13351.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．刷新 （ ）
- 功能说明：重新从数据库中读取最新数据。一般在其它程序或线程修改了数据库后需调用本方法。注意本方法不改变当前记录号。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd125.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

对 Sqlite 表操作后，必须刷新数据。 参见： 例程

**完整正文（站点原文转换）**

**刷新 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

重新从数据库中读取最新数据。一般在其它程序或线程修改了数据库后需调用本方法。注意本方法不改变当前记录号。

*语法：*  逻辑型  *Sqlite表*．刷新 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd125.files/image001.gif)

说明

对Sqlite表操作后，必须刷新数据。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 查找

- 原文链接：https://esdn.ijingyi.com/title-13352.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．查找 （ 查找条件 ）
- 功能说明：本命令从当前记录开始（包括当前记录）寻找符合给定条件的记录。如成功找到返回真，并且将当前记录指针移至所找到的记录。如出错或未找到则返回假，当前记录指针位置保持不变。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 查找条件 | 必填 | 文本型 | 查找条件应该类似于“字段名称=字段值”或“字段1名称=字段值1 AND 字段2名称=字段值2”等形式，也可以使用Sqlite所支持的其它SQL语法。此查找条件将作为SQL select语句中where子句的一部分。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**查找 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

本命令从当前记录开始（包括当前记录）寻找符合给定条件的记录。如成功找到返回真，并且将当前记录指针移至所找到的记录。如出错或未找到则返回假，当前记录指针位置保持不变。

*语法：*  逻辑型  *Sqlite表*．查找 （查找条件）

| 参数名 | 描 述 |
| --- | --- |
| 查找条件 | 必需的 ； 文本型。查找条件应该类似于“字段名称=字段值”或“字段1名称=字段值1 AND 字段2名称=字段值2”等形式，也可以使用Sqlite所支持的其它SQL语法。此查找条件将作为SQL select语句中where子句的一部分。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13353.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．读字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型，参数数据只能提供变量 | 其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd135.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取 Sqlite 表当前记录指定字段的值。 参见： 例程

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite表*．读字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd135.files/image001.gif)

说明

读取Sqlite表当前记录指定字段的值。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 写字段值

- 原文链接：https://esdn.ijingyi.com/title-13354.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．写字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：将第二个参数“字段值”数据写入当前记录中的指定字段。执行成功返回“真”，失败返回“假”。本方法通常在“编辑()”或“插入()”之后、“提交()”之前被调用，且仅当“提交()”调用后数据库才被实际修改。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型 | 指定欲写入的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd136.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

向 Sqlite 表中指定记录写入内容。 参见： 例程

**完整正文（站点原文转换）**

**写字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

将第二个参数“字段值”数据写入当前记录中的指定字段。执行成功返回“真”，失败返回“假”。本方法通常在“编辑()”或“插入()”之后、“提交()”之前被调用，且仅当“提交()”调用后数据库才被实际修改。

*语法：*  逻辑型  *Sqlite表*．写字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型。指定欲写入的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd136.files/image001.gif)

说明

向Sqlite表中指定记录写入内容。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 读字段文本值

- 原文链接：https://esdn.ijingyi.com/title-13355.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型
- 语法：文本型 Sqlite表 ．读字段文本值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为文本型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd137.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为文本型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段文本值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为文本型数据后返回。

*语法：*  文本型  *Sqlite表*．读字段文本值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd137.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为文本型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段整数值

- 原文链接：https://esdn.ijingyi.com/title-13356.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．读字段整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd138.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为整数型数据后返回。

*语法：*  整数型  *Sqlite表*．读字段整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd138.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段小数值

- 原文链接：https://esdn.ijingyi.com/title-13357.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：小数型
- 语法：小数型 Sqlite表 ．读字段小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd139.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为小数型数据后返回。

*语法：*  小数型  *Sqlite表*．读字段小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd139.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段双精度小数值

- 原文链接：https://esdn.ijingyi.com/title-13358.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：双精度小数型
- 语法：双精度小数型 Sqlite表 ．读字段双精度小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd140.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段双精度小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

*语法：*  双精度小数型  *Sqlite表*．读字段双精度小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd140.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段字节集值

- 原文链接：https://esdn.ijingyi.com/title-13359.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：字节集
- 语法：字节集 Sqlite表 ．读字段字节集值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节集型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd141.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为字节集型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段字节集值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为字节集型数据后返回。

*语法：*  字节集  *Sqlite表*．读字段字节集值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd141.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为字节集型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段逻辑值

- 原文链接：https://esdn.ijingyi.com/title-13360.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．读字段逻辑值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd142.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段逻辑值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

*语法：*  逻辑型  *Sqlite表*．读字段逻辑值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd142.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段日期时间值

- 原文链接：https://esdn.ijingyi.com/title-13361.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：日期时间型
- 语法：日期时间型 Sqlite表 ．读字段日期时间值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd143.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段日期时间值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

*语法：*  日期时间型  *Sqlite表*．读字段日期时间值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd143.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段长整数值

- 原文链接：https://esdn.ijingyi.com/title-13362.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：长整数型
- 语法：长整数型 Sqlite表 ．读字段长整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为长整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd144.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为长整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段长整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为长整数型数据后返回。

*语法：*  长整数型  *Sqlite表*．读字段长整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd144.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为长整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段短整数值

- 原文链接：https://esdn.ijingyi.com/title-13363.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：短整数型
- 语法：短整数型 Sqlite表 ．读字段短整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为短整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd145.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为短整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段短整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为短整数型数据后返回。

*语法：*  短整数型  *Sqlite表*．读字段短整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd145.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为短整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 读字段字节值

- 原文链接：https://esdn.ijingyi.com/title-13364.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：字节型
- 语法：字节型 Sqlite表 ．读字段字节值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd146.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为字节型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程

**完整正文（站点原文转换）**

**读字段字节值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

读取当前记录中指定字段的值，并转换为字节型数据后返回。

*语法：*  字节型  *Sqlite表*．读字段字节值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd146.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为字节型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB1.e)

---

### 取表名

- 原文链接：https://esdn.ijingyi.com/title-13365.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型
- 语法：文本型 Sqlite表 ．取表名 （ ）
- 功能说明：返回当前已打开的表名。如果表已被关闭，将返回空文本。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd148.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取当前打开的 Sqlite 表名称。 参见： 例程

**完整正文（站点原文转换）**

**取表名 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

返回当前已打开的表名。如果表已被关闭，将返回空文本。

*语法：*  文本型  *Sqlite表*．取表名 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd148.files/image001.gif)

说明

获取当前打开的Sqlite表名称。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取记录号

- 原文链接：https://esdn.ijingyi.com/title-13366.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取记录号 （ ）
- 功能说明：返回当前记录的记录号，第一条记录为1，第二条记录为2，依次类推。如果当前记录指针在首记录前，返回0 ；如果在尾记录后，返回值为记录总数加一。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd149.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 表当前记录号。 参见： 例程

**完整正文（站点原文转换）**

**取记录号 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

返回当前记录的记录号，第一条记录为1，第二条记录为2，依次类推。如果当前记录指针在首记录前，返回0 ；如果在尾记录后，返回值为记录总数加一。

*语法：*  整数型  *Sqlite表*．取记录号 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd149.files/image001.gif)

说明

获取Sqlite表当前记录号。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取记录个数

- 原文链接：https://esdn.ijingyi.com/title-13367.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取记录个数 （ ）
- 功能说明：返回表中的记录个数。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd150.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取当前 Sqlite 表中记录的个数。 参见： 例程

**完整正文（站点原文转换）**

**取记录个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

返回表中的记录个数。

*语法：*  整数型  *Sqlite表*．取记录个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd150.files/image001.gif)

说明

获取当前Sqlite表中记录的个数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有记录

- 原文链接：https://esdn.ijingyi.com/title-13368.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite表 ．取所有记录 （ 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了表中的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。本方法与“Sqlite数据库.取表内容()”等效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd151.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取当前 Sqlite 表的所有记录。 设对应的 Sqlite 表有 X 条记录 ,N 个字段。则“取所有记录”返回一个 x 行 n 列的数组 a[x][n] （暂不考虑“包含表头”的情况）， 其中：数组的每一行都对应于表中的一条记录，该数组行中的每一列依次对应该记录中的字段值。 参见： 例程

**完整正文（站点原文转换）**

**取所有记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

返回一个二维文本数组，其中存放了表中的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。本方法与“Sqlite数据库.取表内容()”等效。

*语法：*  文本型数组  *Sqlite表*．取所有记录 （是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd151.files/image001.gif)

说明

获取当前Sqlite表的所有记录。

设对应的Sqlite表有X条记录,N个字段。则“取所有记录”返回一个x行n列的数组a[x][n] （暂不考虑“包含表头”的情况），

其中：数组的每一行都对应于表中的一条记录，该数组行中的每一列依次对应该记录中的字段值。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取字段个数

- 原文链接：https://esdn.ijingyi.com/title-13369.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取字段个数 （ ）
- 功能说明：取表中的字段个数。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd152.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取当前 Sqlite 表中字段的个数。 参见： 例程

**完整正文（站点原文转换）**

**取字段个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

取表中的字段个数。

*语法：*  整数型  *Sqlite表*．取字段个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd152.files/image001.gif)

说明

获取当前Sqlite表中字段的个数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有字段

- 原文链接：https://esdn.ijingyi.com/title-13370.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite表 ．取所有字段 （ ）
- 功能说明：返回一个一维文本型数组，其中包含了当前表中的所有字段名称。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd153.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 表中所有字段。 参见： 例程

**完整正文（站点原文转换）**

**取所有字段 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt1.htm)

返回一个一维文本型数组，其中包含了当前表中的所有字段名称。

*语法：*  文本型数组  *Sqlite表*．取所有字段 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd153.files/image001.gif)

说明

获取Sqlite表中所有字段。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 置SQL语句

- 原文链接：https://esdn.ijingyi.com/title-13372.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．置SQL语句 （ SQL语句 ， Sqlite数据库 ）
- 功能说明：设置本对象所使用的SQL语句。本方法等效于“Sqlite数据库.取记录集()”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SQL语句 | 必填 | 文本型 | SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |
| Sqlite数据库 | 必填 | Sqlite数据库 | 指定对哪个Sqlite数据库进行查询，该数据库必须已经打开。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd184.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

执行带参数的 SQL 语句。 参见： 例程

**完整正文（站点原文转换）**

**置SQL语句 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

设置本对象所使用的SQL语句。本方法等效于“Sqlite数据库.取记录集()”。

*语法：*  逻辑型  *Sqlite记录集*．置SQL语句 （SQL语句， Sqlite数据库）

| 参数名 | 描 述 |
| --- | --- |
| SQL语句 | 必需的 ； 文本型。SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |
| Sqlite数据库 | 必需的 ； Sqlite数据库。指定对哪个Sqlite数据库进行查询，该数据库必须已经打开。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd184.files/image001.gif)

说明

执行带参数的SQL语句。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取参数个数

- 原文链接：https://esdn.ijingyi.com/title-13373.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取参数个数 （ ）
- 功能说明：返回当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”指定）中所包含的“SQL参数”个数。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd185.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得执行的 SQL 语句中参数的个数。 参见： 例程

**完整正文（站点原文转换）**

**取参数个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

返回当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”指定）中所包含的“SQL参数”个数。

*语法：*  整数型  *Sqlite记录集*．取参数个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd185.files/image001.gif)

说明

取得执行的SQL语句中参数的个数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有参数

- 原文链接：https://esdn.ijingyi.com/title-13374.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有参数 （ ）
- 功能说明：返回所有由“SQL参数”的参数名称组成的一维文本数组。如果某“SQL参数”没有名称，则对应的数组成员为空文本。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd186.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 SQL 语句中所有参数。 参见： 例程

**完整正文（站点原文转换）**

**取所有参数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

返回所有由“SQL参数”的参数名称组成的一维文本数组。如果某“SQL参数”没有名称，则对应的数组成员为空文本。

*语法：*  文本型数组  *Sqlite记录集*．取所有参数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd186.files/image001.gif)

说明

获取SQL语句中所有参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 绑定参数

- 原文链接：https://esdn.ijingyi.com/title-13375.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．绑定参数 （ 参数名称或索引 ， ［ 要绑定的值 ］ ）
- 功能说明：对当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”所指定）中所包含的某个“SQL参数”进行值绑定。所有“SQL参数”均需进行值绑定，未经绑定的“SQL参数”其值将视为null。如果对同一“SQL参数”进行多次绑定，则最后一次绑定的值将覆盖前面所绑定的值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 参数名称或索引 | 必填 | 通用型 | 使用参数名称时注意，“:”“$”也是参数名称的一部分；使用参数索引时注意，索引从1开始。 |
| 要绑定的值 | 可空 | 通用型 | 如果省略本参数，默认为null。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd187.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

绑定要执行的 SQL 语句的参数。 参见： 例程

**完整正文（站点原文转换）**

**绑定参数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

对当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”所指定）中所包含的某个“SQL参数”进行值绑定。所有“SQL参数”均需进行值绑定，未经绑定的“SQL参数”其值将视为null。如果对同一“SQL参数”进行多次绑定，则最后一次绑定的值将覆盖前面所绑定的值。

*语法：*  逻辑型  *Sqlite记录集*．绑定参数 （参数名称或索引， ［要绑定的值］）

| 参数名 | 描 述 |
| --- | --- |
| 参数名称或索引 | 必需的 ； 通用型。使用参数名称时注意，“:”“$”也是参数名称的一部分；使用参数索引时注意，索引从1开始。 |
| 要绑定的值 | 可选的 ； 通用型。如果省略本参数，默认为null。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd187.files/image001.gif)

说明

绑定要执行的SQL语句的参数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13376.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．是否已打开 （ ）
- 功能说明：判断记录集是否已经打开。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd189.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

判断 Sqlite 记录集是否打开。 参见： 例程

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

判断记录集是否已经打开。

*语法：*  逻辑型  *Sqlite记录集*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd189.files/image001.gif)

说明

判断Sqlite记录集是否打开。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13377.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．打开 （ ）
- 功能说明：打开或重新打开记录集。对于查询类(select)SQL语句，将当前记录指针指向第一条记录之前；对于执行类(update)SQL语句，执行该语句一次。此方法可以被多次重复调用。读取记录集数据之前，必须“打开()”记录集。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd190.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

打开 Sqlite 记录集。 参见： 例程

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

打开或重新打开记录集。对于查询类(select)SQL语句，将当前记录指针指向第一条记录之前；对于执行类(update)SQL语句，执行该语句一次。此方法可以被多次重复调用。读取记录集数据之前，必须“打开()”记录集。

*语法：*  逻辑型  *Sqlite记录集*．打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd190.files/image001.gif)

说明

打开Sqlite记录集。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13378.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．关闭 （ ）
- 功能说明：关闭记录集。关闭后的记录集不再可用，所有内部数据全部丢失。如果用户没有调用本方法关闭记录集，支持库会在适当的时机自动关闭记录集。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd191.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

关闭 Sqlite 记录集。 参见： 例程

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

关闭记录集。关闭后的记录集不再可用，所有内部数据全部丢失。如果用户没有调用本方法关闭记录集，支持库会在适当的时机自动关闭记录集。

*语法：*  逻辑型  *Sqlite记录集*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd191.files/image001.gif)

说明

关闭Sqlite记录集。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13379.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．读字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型，参数数据只能提供变量 | 其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd192.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取 Sqlite 记录集的字段值。 参见： 例程

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite记录集*．读字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd192.files/image001.gif)

说明

读取Sqlite记录集的字段值。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 到下一记录

- 原文链接：https://esdn.ijingyi.com/title-13380.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．到下一记录 （ ）
- 功能说明：移动到下一条记录。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd198.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动 Sqlite 记录集指针到下一条记录。 参见： 例程

**完整正文（站点原文转换）**

**到下一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

移动到下一条记录。

*语法：*  逻辑型  *Sqlite记录集*．到下一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd198.files/image001.gif)

说明

移动Sqlite记录集指针到下一条记录。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 首记录前

- 原文链接：https://esdn.ijingyi.com/title-13381.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．首记录前 （ ）
- 功能说明：判断当前记录指针是否指向第一条记录之前。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd200.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动 Sqlite 记录集指针到第一条记录之前。 参见： 例程

**完整正文（站点原文转换）**

**首记录前 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

判断当前记录指针是否指向第一条记录之前。

*语法：*  逻辑型  *Sqlite记录集*．首记录前 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd200.files/image001.gif)

说明

移动Sqlite记录集指针到第一条记录之前。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 尾记录后

- 原文链接：https://esdn.ijingyi.com/title-13382.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．尾记录后 （ ）
- 功能说明：判断当前记录指针是否指向最后一条记录之后。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd201.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

移动 Sqlite 记录集指针到最后一条记录之后。 参见： 例程

**完整正文（站点原文转换）**

**尾记录后 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

判断当前记录指针是否指向最后一条记录之后。

*语法：*  逻辑型  *Sqlite记录集*．尾记录后 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd201.files/image001.gif)

说明

移动Sqlite记录集指针到最后一条记录之后。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取记录个数

- 原文链接：https://esdn.ijingyi.com/title-13383.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取记录个数 （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd208.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

获取 Sqlite 记录集中记录的个数。 参见： 例程

**完整正文（站点原文转换）**

**取记录个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

*语法：*  整数型  *Sqlite记录集*．取记录个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd208.files/image001.gif)

说明

获取Sqlite记录集中记录的个数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有记录

- 原文链接：https://esdn.ijingyi.com/title-13384.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有记录 （ 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了记录集中所有记录（含所有字段）内容；如果记录集中没有记录或操作失败，将返回空数组。如果记录集中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。注意：本方法执行后，当前记录指针将指向首记录前（相当于重新打开记录集）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果本记录集中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd209.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 Sqlite 记录集中所有记录。 设对应的 Sqlite 表有 X 条记录 ,N 个字段。则“取所有记录”返回一个 x 行 n 列的数组 a[x][n] （暂不考虑“包含表头”的情况）， 其中：数组的每一行都对应于表中的一条记录，该数组行中的每一列依次对应该记录中的字段值。 参见： 例程

**完整正文（站点原文转换）**

**取所有记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

返回一个二维文本数组，其中存放了记录集中所有记录（含所有字段）内容；如果记录集中没有记录或操作失败，将返回空数组。如果记录集中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。注意：本方法执行后，当前记录指针将指向首记录前（相当于重新打开记录集）。

*语法：*  文本型数组  *Sqlite记录集*．取所有记录 （是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果本记录集中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd209.files/image001.gif)

说明

取得Sqlite记录集中所有记录。

设对应的Sqlite表有X条记录,N个字段。则“取所有记录”返回一个x行n列的数组a[x][n] （暂不考虑“包含表头”的情况），

其中：数组的每一行都对应于表中的一条记录，该数组行中的每一列依次对应该记录中的字段值。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取字段个数

- 原文链接：https://esdn.ijingyi.com/title-13385.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取字段个数 （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd210.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 Sqlite 记录集中字段的个数。 参见： 例程

**完整正文（站点原文转换）**

**取字段个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

*语法：*  整数型  *Sqlite记录集*．取字段个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd210.files/image001.gif)

说明

取得Sqlite记录集中字段的个数。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 取所有字段

- 原文链接：https://esdn.ijingyi.com/title-13386.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有字段 （ ）
- 功能说明：返回所有字段名称组成的一维文本数组。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd211.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 Sqlite 记录集中所有字段。 参见： 例程

**完整正文（站点原文转换）**

**取所有字段 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

返回所有字段名称组成的一维文本数组。

*语法：*  文本型数组  *Sqlite记录集*．取所有字段 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd211.files/image001.gif)

说明

取得Sqlite记录集中所有字段。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB.e)

---

### 读字段文本值

- 原文链接：https://esdn.ijingyi.com/title-13387.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型
- 语法：文本型 Sqlite记录集 ．读字段文本值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为文本型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd215.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为文本型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段文本值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为文本型数据后返回。

*语法：*  文本型  *Sqlite记录集*．读字段文本值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd215.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为文本型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段整数值

- 原文链接：https://esdn.ijingyi.com/title-13388.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．读字段整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd216.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为整数型数据后返回。

*语法：*  整数型  *Sqlite记录集*．读字段整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd216.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段小数值

- 原文链接：https://esdn.ijingyi.com/title-13389.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：小数型
- 语法：小数型 Sqlite记录集 ．读字段小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd217.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为小数型数据后返回。

*语法：*  小数型  *Sqlite记录集*．读字段小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd217.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段双精度小数值

- 原文链接：https://esdn.ijingyi.com/title-13390.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：双精度小数型
- 语法：双精度小数型 Sqlite记录集 ．读字段双精度小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd218.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段双精度小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

*语法：*  双精度小数型  *Sqlite记录集*．读字段双精度小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd218.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段字节集值

- 原文链接：https://esdn.ijingyi.com/title-13391.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：字节集
- 语法：字节集 Sqlite记录集 ．读字段字节集值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节集型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd219.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为字节集型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段字节集值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为字节集型数据后返回。

*语法：*  字节集  *Sqlite记录集*．读字段字节集值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd219.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为字节集型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段逻辑值

- 原文链接：https://esdn.ijingyi.com/title-13392.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．读字段逻辑值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd220.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段逻辑值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

*语法：*  逻辑型  *Sqlite记录集*．读字段逻辑值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd220.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段日期时间值

- 原文链接：https://esdn.ijingyi.com/title-13393.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：日期时间型
- 语法：日期时间型 Sqlite记录集 ．读字段日期时间值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd221.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段日期时间值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

*语法：*  日期时间型  *Sqlite记录集*．读字段日期时间值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd221.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段长整数值

- 原文链接：https://esdn.ijingyi.com/title-13394.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：长整数型
- 语法：长整数型 Sqlite记录集 ．读字段长整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为长整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd222.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为长整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段长整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为长整数型数据后返回。

*语法：*  长整数型  *Sqlite记录集*．读字段长整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd222.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为长整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段短整数值

- 原文链接：https://esdn.ijingyi.com/title-13395.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：短整数型
- 语法：短整数型 Sqlite记录集 ．读字段短整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为短整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd223.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为短整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段短整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为短整数型数据后返回。

*语法：*  短整数型  *Sqlite记录集*．读字段短整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd223.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为短整数型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### 读字段字节值

- 原文链接：https://esdn.ijingyi.com/title-13396.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：字节型
- 语法：字节型 Sqlite记录集 ．读字段字节值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd224.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取当前记录中指定字段的值，并转换为字节型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果 ―― 成功为 “ 真 ” ，失败为 “ 假 ” 。 参见： 例程 测试数据库

**完整正文（站点原文转换）**

**读字段字节值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/dt2.htm)

读取当前记录中指定字段的值，并转换为字节型数据后返回。

*语法：*  字节型  *Sqlite记录集*．读字段字节值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程： **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/cmd224.files/image001.gif)

**说明： **

读取当前记录中指定字段的值，并转换为字节型数据后返回。 如果提供第二个参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。

参见： [例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/SqliteDB_test.e)
[测试数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource/SqliteDB//SqliteDB/test.sdb)

---

### Sqlite字段信息

- 原文链接：https://esdn.ijingyi.com/title-13311.html
- 操作系统支持：Windows、Linux 跳至： Sqlite数据库支持库
- 功能说明：描述Sqlite字段定义信息，供“Sqlite数据库.创建表()”时使用。因为Sqlite数据库本质上是无类型的数据库，因而您完全可以忽略“类型”“最大文本长度”两个成员，而仅使用“名称”成员。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 名称 | 待核实 | 待核实 | 文本型； 初始值为“”。字段名称长度不限。 |
| 类型 | 待核实 | 待核实 | 整数型； 初始值为 0 。可以为以下值或常量值之一：-1、(主键，整数型自增字段)； 0、(无类型)； 1、#字节型； 2、#短整数型； 3、#整数型； 4、#长整数型； 5、#小数型； 6、#双精度小数型； 7、#逻辑型； 8、#日期时间型； 10、#文本型； 11、#字节集型； 12、#备注型。 |
| 最大文本长度 | 待核实 | 待核实 | 整数型； 初始值为 0 。本成员仅当字段类型为“文本型”时才有效，用作指定文本的“最大可能长度”（数据库不对此长度不作任何限制）；如果本成员值为0，表示该字段可存储任意长度的文本。如果字段类型不为“文本型”，本成员将被忽略。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**Sqlite字段信息 普通类型**   操作系统支持：Windows、Linux    跳至：[Sqlite数据库支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/SqliteDB/index.htm)

描述Sqlite字段定义信息，供“Sqlite数据库.创建表()”时使用。因为Sqlite数据库本质上是无类型的数据库，因而您完全可以忽略“类型”“最大文本长度”两个成员，而仅使用“名称”成员。

| 成员 | 描 述 |
| --- | --- |
| 名称 | 文本型； 初始值为“”。字段名称长度不限。 |
| 类型 | 整数型； 初始值为 0 。可以为以下值或常量值之一：-1、(主键，整数型自增字段)； 0、(无类型)； 1、#字节型； 2、#短整数型； 3、#整数型； 4、#长整数型； 5、#小数型； 6、#双精度小数型； 7、#逻辑型； 8、#日期时间型； 10、#文本型； 11、#字节集型； 12、#备注型。 |
| 最大文本长度 | 整数型； 初始值为 0 。本成员仅当字段类型为“文本型”时才有效，用作指定文本的“最大可能长度”（数据库不对此长度不作任何限制）；如果本成员值为0，表示该字段可存储任意长度的文本。如果字段类型不为“文本型”，本成员将被忽略。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
