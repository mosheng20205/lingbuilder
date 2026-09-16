# Sqlite3数据库支持库 2.1 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-13397.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.1）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**Sqlite3数据库支持库2.1版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

Sqlite数据库是一个小型关系型文件数据库；跨平台；支持SQL语句、事务、触发器、视图；速度相当快；小巧且不依赖任何额外的驱动程序。Sqlite数据库是本地数据库，不是网络数据库。
    相对于易语言数据库，Sqlite数据库的优势是支持SQL语句、事务、触发器、视图；
    相对于Microsoft Access，Sqlite数据库的优势是跨平台、无需额外驱动；
    相对于其它非本地数据库，如Oracle、DB2、MS SQL Server、MySQL、PostgreSQL，Sqlite数据库具有小巧、速度快的优势。
    目前使用的Sqlite版本是3.7.11，只要有可能，将随时跟踪并升级至Sqlite最新版本。
    数据库内部文本编码为UTF-8。

操作系统支持： Windows、Linux

**命令类别：**

| 数据库 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| Sqlite数据库 | Sqlite表 | Sqlite记录集 | Sqlite字段信息 |
| --- | --- | --- | --- |

## 命令分类：其他数据类型（83 条）

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13406.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．是否已打开 （ ）

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13407.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．打开 （ ［ 数据库文件 ］ ， ［ 是否允许创建 ］ ）
- 功能说明：打开或新建数据库。要打开或新建的数据库由第一个参数“数据库文件”指定（一个Sqlite数据库就是一个文件）；如果指定的数据库文件不存在，则由第二个参数“是否允许创建”决定是否以该文件名创建新数据库。如果参数“数据库文件”被省略或为空文本，且参数“是否允许创建”为“真”，则在“内存中”创建并打开数据库。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数据库文件 | 可空 | 文本型 | 欲打开的数据库文件，请使用完整的路径和文件名。 |
| 是否允许创建 | 可空 | 逻辑型 | 在指定的数据库文件不存在的情况下，如果本属性为“真”，则创建该数据库，否则直接返回“假”。本参数如果被省略，默认为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

打开或新建数据库。要打开或新建的数据库由第一个参数“数据库文件”指定（一个Sqlite数据库就是一个文件）；如果指定的数据库文件不存在，则由第二个参数“是否允许创建”决定是否以该文件名创建新数据库。如果参数“数据库文件”被省略或为空文本，且参数“是否允许创建”为“真”，则在“内存中”创建并打开数据库。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite数据库*．打开 （［数据库文件］， ［是否允许创建］）

| 参数名 | 描 述 |
| --- | --- |
| 数据库文件 | 可选的 ； 文本型。欲打开的数据库文件，请使用完整的路径和文件名。 |
| 是否允许创建 | 可选的 ； 逻辑型。在指定的数据库文件不存在的情况下，如果本属性为“真”，则创建该数据库，否则直接返回“假”。本参数如果被省略，默认为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13408.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．关闭 （ ）

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 执行SQL语句

- 原文链接：https://esdn.ijingyi.com/title-13409.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．执行SQL语句 （ 欲执行的SQL语句 ）
- 功能说明：执行指定的一条或多条SQL语句。执行成功返回真，失败返回假。本方法不能处理带“SQL参数”的SQL语句。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲执行的SQL语句 | 必填 | 文本型 | 多个SQL语句之间请以半角分号“;”隔开，最后一个SQL语句后面可以不加“;”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**执行SQL语句 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

执行指定的一条或多条SQL语句。执行成功返回真，失败返回假。本方法不能处理带“SQL参数”的SQL语句。

*语法：*  逻辑型  *Sqlite数据库*．执行SQL语句 （欲执行的SQL语句）

| 参数名 | 描 述 |
| --- | --- |
| 欲执行的SQL语句 | 必需的 ； 文本型。多个SQL语句之间请以半角分号“;”隔开，最后一个SQL语句后面可以不加“;”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取记录集

- 原文链接：https://esdn.ijingyi.com/title-13410.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：Sqlite记录集
- 语法：Sqlite记录集 Sqlite数据库 ．取记录集 （ SQL语句 ）
- 功能说明：返回“Sqlite记录集”对象。本方法等效于“Sqlite记录集.置SQL语句()”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SQL语句 | 必填 | 文本型 | SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“Sqlite记录集.绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取记录集 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

返回“Sqlite记录集”对象。本方法等效于“Sqlite记录集.置SQL语句()”。

*语法：*  Sqlite记录集  *Sqlite数据库*．取记录集 （SQL语句）

| 参数名 | 描 述 |
| --- | --- |
| SQL语句 | 必需的 ； 文本型。SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“Sqlite记录集.绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 置最大等待时间

- 原文链接：https://esdn.ijingyi.com/title-13411.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．置最大等待时间 （ 最大等待时间(单位: 秒) ）
- 功能说明：设置数据库被锁定时的最大等待时间，如果数据库超过最大等待时间后还没有被解锁，则中止尝试执行当前操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 最大等待时间(单位: 秒) | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**置最大等待时间 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

设置数据库被锁定时的最大等待时间，如果数据库超过最大等待时间后还没有被解锁，则中止尝试执行当前操作。

*语法：*  逻辑型  *Sqlite数据库*．置最大等待时间 （最大等待时间(单位: 秒)）

| 参数名 | 描 述 |
| --- | --- |
| 最大等待时间(单位: 秒) | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取错误码

- 原文链接：https://esdn.ijingyi.com/title-13412.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：整数型
- 语法：整数型 Sqlite数据库 ．取错误码 （ ）
- 功能说明：取前面最近一次操作的执行结果的错误代码。如果错误代码为0表示前一次操作成功。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取错误码 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

取前面最近一次操作的执行结果的错误代码。如果错误代码为0表示前一次操作成功。

*语法：*  整数型  *Sqlite数据库*．取错误码 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取错误文本

- 原文链接：https://esdn.ijingyi.com/title-13413.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型
- 语法：文本型 Sqlite数据库 ．取错误文本 （ ）
- 功能说明：取前面最近一次操作的执行结果的错误信息文本。如果前一次操作成功或本方法调用失败，将返回空文本。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取错误文本 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

取前面最近一次操作的执行结果的错误信息文本。如果前一次操作成功或本方法调用失败，将返回空文本。

*语法：*  文本型  *Sqlite数据库*．取错误文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取最新插入ID

- 原文链接：https://esdn.ijingyi.com/title-13414.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：长整数型
- 语法：长整数型 Sqlite数据库 ．取最新插入ID （ ）
- 功能说明：取前面最近一次插入的记录的记录ID。记录ID从1开始。如果执行失败将返回0。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取最新插入ID 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

取前面最近一次插入的记录的记录ID。记录ID从1开始。如果执行失败将返回0。

*语法：*  长整数型  *Sqlite数据库*．取最新插入ID （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 开始事务

- 原文链接：https://esdn.ijingyi.com/title-13415.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．开始事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**开始事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．开始事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 提交事务

- 原文链接：https://esdn.ijingyi.com/title-13416.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．提交事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**提交事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．提交事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 回滚事务

- 原文链接：https://esdn.ijingyi.com/title-13417.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．回滚事务 （ ［ 事务名称 ］ ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 事务名称 | 可空 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**回滚事务 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．回滚事务 （［事务名称］）

| 参数名 | 描 述 |
| --- | --- |
| 事务名称 | 可选的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 表是否存在

- 原文链接：https://esdn.ijingyi.com/title-13418.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．表是否存在 （ 表名 ）
- 功能说明：判断数据库是否已有指定的表或视图，包含临时表和视图。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**表是否存在 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

判断数据库是否已有指定的表或视图，包含临时表和视图。

*语法：*  逻辑型  *Sqlite数据库*．表是否存在 （表名）

| 参数名 | 描 述 |
| --- | --- |
| 表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有表

- 原文链接：https://esdn.ijingyi.com/title-13419.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite数据库 ．取所有表 （ 是否包含表 ， 是否包含视图 ， 是否包含临时表或视图 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表 | 必填 | 逻辑型，初始值为“真” |  |
| 是否包含视图 | 必填 | 逻辑型，初始值为“假” |  |
| 是否包含临时表或视图 | 必填 | 逻辑型，初始值为“假” |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  文本型数组  *Sqlite数据库*．取所有表 （是否包含表， 是否包含视图， 是否包含临时表或视图）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表 | 必需的 ； 逻辑型，初始值为“真”。 |
| 是否包含视图 | 必需的 ； 逻辑型，初始值为“假”。 |
| 是否包含临时表或视图 | 必需的 ； 逻辑型，初始值为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取表内容

- 原文链接：https://esdn.ijingyi.com/title-13420.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite数据库 ．取表内容 （ 表名称 ， 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了指定表的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取表内容 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

返回一个二维文本数组，其中存放了指定表的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。

*语法：*  文本型数组  *Sqlite数据库*．取表内容 （表名称， 是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取表定义

- 原文链接：https://esdn.ijingyi.com/title-13421.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：文本型
- 语法：文本型 Sqlite数据库 ．取表定义 （ 表名称 ）
- 功能说明：返回创建指定表时所用的SQL语句（CREATE TABLE ...）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取表定义 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

返回创建指定表时所用的SQL语句（CREATE TABLE ...）。

*语法：*  文本型  *Sqlite数据库*．取表定义 （表名称）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13422.html
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

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

读取指定表或视图中指定字段的值，并写入第四个参数“字段值”。如果“查询条件”参数指定不当或未指定，有可能导致产生多个满足查询条件的记录，此时将取第一条记录的指定字段值。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite数据库*．读字段值 （表名称， 字段名称或位置， ［查询条件］， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 查询条件 | 可选的 ； 文本型。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 创建表

- 原文链接：https://esdn.ijingyi.com/title-13423.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．创建表 （ 表名称 ， 字段信息 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| 字段信息 | 必填 | Sqlite字段信息，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**创建表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

*语法：*  逻辑型  *Sqlite数据库*．创建表 （表名称， 字段信息）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| 字段信息 | 必需的 ； Sqlite字段信息，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 删除表

- 原文链接：https://esdn.ijingyi.com/title-13424.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．删除表 （ 要删除的表名 ）
- 功能说明：将指定表连同其中的所有记录全部删除。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 要删除的表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**删除表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

将指定表连同其中的所有记录全部删除。

*语法：*  逻辑型  *Sqlite数据库*．删除表 （要删除的表名）

| 参数名 | 描 述 |
| --- | --- |
| 要删除的表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 清空表

- 原文链接：https://esdn.ijingyi.com/title-13425.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．清空表 （ 要清空的表名 ）
- 功能说明：删除指定表中所有记录。本方法不删除表自身，也不改变表结构。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 要清空的表名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**清空表 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

删除指定表中所有记录。本方法不删除表自身，也不改变表结构。

*语法：*  逻辑型  *Sqlite数据库*．清空表 （要清空的表名）

| 参数名 | 描 述 |
| --- | --- |
| 要清空的表名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 收缩数据库

- 原文链接：https://esdn.ijingyi.com/title-13426.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite数据库
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite数据库 ．收缩数据库 （ ）
- 功能说明：收缩数据所占用的磁盘空间。经过大批量记录增删之后，数据库文件可能会变的较大，调用此方法可释放一部分缓冲区域，以减少文件尺寸。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**收缩数据库 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite数据库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt0.htm)

收缩数据所占用的磁盘空间。经过大批量记录增删之后，数据库文件可能会变的较大，调用此方法可释放一部分缓冲区域，以减少文件尺寸。

*语法：*  逻辑型  *Sqlite数据库*．收缩数据库 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13428.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．是否已打开 （ ）
- 功能说明：判断表是否处理打开状态。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

判断表是否处理打开状态。

*语法：*  逻辑型  *Sqlite表*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13429.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．打开 （ 表名称 ， Sqlite数据库 ）
- 功能说明：打开指定表。成功返回真，否则返回假。表成功打开后，记录集指针将指向首记录前。一个“Sqlite表”对象同一时刻只能打开一个表，打开后一个表意味着将关闭前一个已打开的表(如果有的话)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 表名称 | 必填 | 文本型 |  |
| Sqlite数据库 | 必填 | Sqlite数据库 | 指定要打开哪个Sqlite数据库中的表。该数据库必须已经打开。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

打开指定表。成功返回真，否则返回假。表成功打开后，记录集指针将指向首记录前。一个“Sqlite表”对象同一时刻只能打开一个表，打开后一个表意味着将关闭前一个已打开的表(如果有的话)。

*语法：*  逻辑型  *Sqlite表*．打开 （表名称， Sqlite数据库）

| 参数名 | 描 述 |
| --- | --- |
| 表名称 | 必需的 ； 文本型。 |
| Sqlite数据库 | 必需的 ； Sqlite数据库。指定要打开哪个Sqlite数据库中的表。该数据库必须已经打开。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13430.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．关闭 （ ）
- 功能说明：关闭当前打开的表。如果用户未调用本方法关闭已打开的表，支持库会在适当的时机自动关闭该表。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

关闭当前打开的表。如果用户未调用本方法关闭已打开的表，支持库会在适当的时机自动关闭该表。

*语法：*  逻辑型  *Sqlite表*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 到首记录

- 原文链接：https://esdn.ijingyi.com/title-13431.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到首记录 （ ）
- 功能说明：移动到表的第一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**到首记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

移动到表的第一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到首记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 到尾记录

- 原文链接：https://esdn.ijingyi.com/title-13432.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到尾记录 （ ）
- 功能说明：移动到表的最后一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**到尾记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

移动到表的最后一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到尾记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 到下一记录

- 原文链接：https://esdn.ijingyi.com/title-13433.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到下一记录 （ ）
- 功能说明：移动到下一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**到下一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

移动到下一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到下一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 到上一记录

- 原文链接：https://esdn.ijingyi.com/title-13434.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．到上一记录 （ ）
- 功能说明：移动到上一条记录，执行成功返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**到上一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

移动到上一条记录，执行成功返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．到上一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 跳过

- 原文链接：https://esdn.ijingyi.com/title-13435.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．跳过 （ ［ 欲跳过的记录数 ］ ）
- 功能说明：将当前记录指针向前或者向后移动数条记录。执行成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲跳过的记录数 | 可空 | 整数型 | 参数值如果为负数，则向前移动，否则向后移动。如果本参数被省略，默认值为 1 ，即向后移动一条记录。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**跳过 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

将当前记录指针向前或者向后移动数条记录。执行成功返回真，失败返回假。

*语法：*  逻辑型  *Sqlite表*．跳过 （［欲跳过的记录数］）

| 参数名 | 描 述 |
| --- | --- |
| 欲跳过的记录数 | 可选的 ； 整数型。参数值如果为负数，则向前移动，否则向后移动。如果本参数被省略，默认值为 1 ，即向后移动一条记录。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 跳到

- 原文链接：https://esdn.ijingyi.com/title-13436.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．跳到 （ 欲跳到的记录号 ）
- 功能说明：改变当前记录指针到指定的记录号。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲跳到的记录号 | 必填 | 整数型 | 参数值所指定的记录号从 1 开始，即首记录的记录号为 1 ，依此类推。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**跳到 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

改变当前记录指针到指定的记录号。成功返回真，失败返回假。

*语法：*  逻辑型  *Sqlite表*．跳到 （欲跳到的记录号）

| 参数名 | 描 述 |
| --- | --- |
| 欲跳到的记录号 | 必需的 ； 整数型。参数值所指定的记录号从 1 开始，即首记录的记录号为 1 ，依此类推。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 首记录前

- 原文链接：https://esdn.ijingyi.com/title-13437.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．首记录前 （ ）
- 功能说明：如果当前记录指针已在首记录的前面，返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**首记录前 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

如果当前记录指针已在首记录的前面，返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．首记录前 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 尾记录后

- 原文链接：https://esdn.ijingyi.com/title-13438.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．尾记录后 （ ）
- 功能说明：如果当前记录指针已在尾记录的后面，返回真，否则返回假。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**尾记录后 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

如果当前记录指针已在尾记录的后面，返回真，否则返回假。

*语法：*  逻辑型  *Sqlite表*．尾记录后 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 编辑

- 原文链接：https://esdn.ijingyi.com/title-13439.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．编辑 （ ）
- 功能说明：进入“编辑”状态，准备修改当前记录。在调用本方法后，可使用“写字段值()”修改当前记录中的各字段值；只有调用“提交()”后才会实际执行修改操作。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**编辑 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

进入“编辑”状态，准备修改当前记录。在调用本方法后，可使用“写字段值()”修改当前记录中的各字段值；只有调用“提交()”后才会实际执行修改操作。

*语法：*  逻辑型  *Sqlite表*．编辑 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 插入

- 原文链接：https://esdn.ijingyi.com/title-13440.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．插入 （ ）
- 功能说明：进入“插入”状态，准备向表中插入一条记录。在调用本方法后，可使用“写字段值()”填充要插入记录中的各字段值；只有调用“提交()”后才会实际执行插入操作。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**插入 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

进入“插入”状态，准备向表中插入一条记录。在调用本方法后，可使用“写字段值()”填充要插入记录中的各字段值；只有调用“提交()”后才会实际执行插入操作。

*语法：*  逻辑型  *Sqlite表*．插入 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 删除

- 原文链接：https://esdn.ijingyi.com/title-13441.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．删除 （ ）
- 功能说明：删除当前记录。删除成功后，记录指针指向着记录前。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**删除 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

删除当前记录。删除成功后，记录指针指向着记录前。

*语法：*  逻辑型  *Sqlite表*．删除 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 提交

- 原文链接：https://esdn.ijingyi.com/title-13442.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．提交 （ ）
- 功能说明：将“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”）提交到数据库，并退出“编辑”或“插入”状态。执行成功返回真，失败返回假。如果不执行此方法，数据库不会被实际修改。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**提交 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

将“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”）提交到数据库，并退出“编辑”或“插入”状态。执行成功返回真，失败返回假。如果不执行此方法，数据库不会被实际修改。

*语法：*  逻辑型  *Sqlite表*．提交 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取消

- 原文链接：https://esdn.ijingyi.com/title-13443.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．取消 （ ）
- 功能说明：取消“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”），并退出“编辑”或“插入”状态。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取消 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

取消“编辑()”或“插入()”后对记录所作的修改（通过“写字段值()”），并退出“编辑”或“插入”状态。

*语法：*  逻辑型  *Sqlite表*．取消 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 刷新

- 原文链接：https://esdn.ijingyi.com/title-13444.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．刷新 （ ）
- 功能说明：重新从数据库中读取最新数据。一般在其它程序或线程修改了数据库后需调用本方法。注意本方法不改变当前记录号。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**刷新 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

重新从数据库中读取最新数据。一般在其它程序或线程修改了数据库后需调用本方法。注意本方法不改变当前记录号。

*语法：*  逻辑型  *Sqlite表*．刷新 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 查找

- 原文链接：https://esdn.ijingyi.com/title-13445.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．查找 （ 查找条件 ）
- 功能说明：本命令从当前记录开始（包括当前记录）寻找符合给定条件的记录。如成功找到返回真，并且将当前记录指针移至所找到的记录。如出错或未找到则返回假，当前记录指针位置保持不变。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 查找条件 | 必填 | 文本型 | 查找条件应该类似于“字段名称=字段值”或“字段1名称=字段值1 AND 字段2名称=字段值2”等形式，也可以使用Sqlite所支持的其它SQL语法。此查找条件将作为SQL select语句中where子句的一部分。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**查找 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

本命令从当前记录开始（包括当前记录）寻找符合给定条件的记录。如成功找到返回真，并且将当前记录指针移至所找到的记录。如出错或未找到则返回假，当前记录指针位置保持不变。

*语法：*  逻辑型  *Sqlite表*．查找 （查找条件）

| 参数名 | 描 述 |
| --- | --- |
| 查找条件 | 必需的 ； 文本型。查找条件应该类似于“字段名称=字段值”或“字段1名称=字段值1 AND 字段2名称=字段值2”等形式，也可以使用Sqlite所支持的其它SQL语法。此查找条件将作为SQL select语句中where子句的一部分。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13446.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．读字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型，参数数据只能提供变量 | 其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite表*．读字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 写字段值

- 原文链接：https://esdn.ijingyi.com/title-13447.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．写字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：将第二个参数“字段值”数据写入当前记录中的指定字段。执行成功返回“真”，失败返回“假”。本方法通常在“编辑()”或“插入()”之后、“提交()”之前被调用，且仅当“提交()”调用后数据库才被实际修改。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型 | 指定欲写入的值。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**写字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

将第二个参数“字段值”数据写入当前记录中的指定字段。执行成功返回“真”，失败返回“假”。本方法通常在“编辑()”或“插入()”之后、“提交()”之前被调用，且仅当“提交()”调用后数据库才被实际修改。

*语法：*  逻辑型  *Sqlite表*．写字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型。指定欲写入的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段文本值

- 原文链接：https://esdn.ijingyi.com/title-13448.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型
- 语法：文本型 Sqlite表 ．读字段文本值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为文本型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段文本值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为文本型数据后返回。

*语法：*  文本型  *Sqlite表*．读字段文本值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段整数值

- 原文链接：https://esdn.ijingyi.com/title-13449.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．读字段整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为整数型数据后返回。

*语法：*  整数型  *Sqlite表*．读字段整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段小数值

- 原文链接：https://esdn.ijingyi.com/title-13450.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：小数型
- 语法：小数型 Sqlite表 ．读字段小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为小数型数据后返回。

*语法：*  小数型  *Sqlite表*．读字段小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段双精度小数值

- 原文链接：https://esdn.ijingyi.com/title-13451.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：双精度小数型
- 语法：双精度小数型 Sqlite表 ．读字段双精度小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段双精度小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

*语法：*  双精度小数型  *Sqlite表*．读字段双精度小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段字节集值

- 原文链接：https://esdn.ijingyi.com/title-13452.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：字节集
- 语法：字节集 Sqlite表 ．读字段字节集值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节集型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段字节集值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为字节集型数据后返回。

*语法：*  字节集  *Sqlite表*．读字段字节集值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段逻辑值

- 原文链接：https://esdn.ijingyi.com/title-13453.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite表 ．读字段逻辑值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段逻辑值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

*语法：*  逻辑型  *Sqlite表*．读字段逻辑值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段日期时间值

- 原文链接：https://esdn.ijingyi.com/title-13454.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：日期时间型
- 语法：日期时间型 Sqlite表 ．读字段日期时间值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段日期时间值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

*语法：*  日期时间型  *Sqlite表*．读字段日期时间值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段长整数值

- 原文链接：https://esdn.ijingyi.com/title-13455.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：长整数型
- 语法：长整数型 Sqlite表 ．读字段长整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为长整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段长整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为长整数型数据后返回。

*语法：*  长整数型  *Sqlite表*．读字段长整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段短整数值

- 原文链接：https://esdn.ijingyi.com/title-13456.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：短整数型
- 语法：短整数型 Sqlite表 ．读字段短整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为短整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段短整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为短整数型数据后返回。

*语法：*  短整数型  *Sqlite表*．读字段短整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段字节值

- 原文链接：https://esdn.ijingyi.com/title-13457.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：字节型
- 语法：字节型 Sqlite表 ．读字段字节值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段字节值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

读取当前记录中指定字段的值，并转换为字节型数据后返回。

*语法：*  字节型  *Sqlite表*．读字段字节值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取表名

- 原文链接：https://esdn.ijingyi.com/title-13458.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型
- 语法：文本型 Sqlite表 ．取表名 （ ）
- 功能说明：返回当前已打开的表名。如果表已被关闭，将返回空文本。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取表名 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

返回当前已打开的表名。如果表已被关闭，将返回空文本。

*语法：*  文本型  *Sqlite表*．取表名 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取记录号

- 原文链接：https://esdn.ijingyi.com/title-13459.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取记录号 （ ）
- 功能说明：返回当前记录的记录号，第一条记录为1，第二条记录为2，依次类推。如果当前记录指针在首记录前，返回0 ；如果在尾记录后，返回值为记录总数加一。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取记录号 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

返回当前记录的记录号，第一条记录为1，第二条记录为2，依次类推。如果当前记录指针在首记录前，返回0 ；如果在尾记录后，返回值为记录总数加一。

*语法：*  整数型  *Sqlite表*．取记录号 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取记录个数

- 原文链接：https://esdn.ijingyi.com/title-13460.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取记录个数 （ ）
- 功能说明：返回表中的记录个数。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取记录个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

返回表中的记录个数。

*语法：*  整数型  *Sqlite表*．取记录个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有记录

- 原文链接：https://esdn.ijingyi.com/title-13461.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite表 ．取所有记录 （ 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了表中的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。本方法与“Sqlite数据库.取表内容()”等效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

返回一个二维文本数组，其中存放了表中的所有记录（含所有字段）内容；表中没有记录或操作失败，将返回空数组。如果表中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。本方法与“Sqlite数据库.取表内容()”等效。

*语法：*  文本型数组  *Sqlite表*．取所有记录 （是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果指定表中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取字段个数

- 原文链接：https://esdn.ijingyi.com/title-13462.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：整数型
- 语法：整数型 Sqlite表 ．取字段个数 （ ）
- 功能说明：取表中的字段个数。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取字段个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

取表中的字段个数。

*语法：*  整数型  *Sqlite表*．取字段个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有字段

- 原文链接：https://esdn.ijingyi.com/title-13463.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite表
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite表 ．取所有字段 （ ）
- 功能说明：返回一个一维文本型数组，其中包含了当前表中的所有字段名称。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有字段 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt1.htm)

返回一个一维文本型数组，其中包含了当前表中的所有字段名称。

*语法：*  文本型数组  *Sqlite表*．取所有字段 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 置SQL语句

- 原文链接：https://esdn.ijingyi.com/title-13465.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．置SQL语句 （ SQL语句 ， Sqlite数据库 ）
- 功能说明：设置本对象所使用的SQL语句。本方法等效于“Sqlite数据库.取记录集()”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SQL语句 | 必填 | 文本型 | SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |
| Sqlite数据库 | 必填 | Sqlite数据库 | 指定对哪个Sqlite数据库进行查询，该数据库必须已经打开。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**置SQL语句 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

设置本对象所使用的SQL语句。本方法等效于“Sqlite数据库.取记录集()”。

*语法：*  逻辑型  *Sqlite记录集*．置SQL语句 （SQL语句， Sqlite数据库）

| 参数名 | 描 述 |
| --- | --- |
| SQL语句 | 必需的 ； 文本型。SQL语句中可包含零到多个“SQL参数”，形如“?”“:n”“$v”等，其中n代表一个数值，v代表一个文本。所有“SQL参数”均需经过“绑定参数()”进行值绑定，未经绑定的“SQL参数”其值将视为null。 |
| Sqlite数据库 | 必需的 ； Sqlite数据库。指定对哪个Sqlite数据库进行查询，该数据库必须已经打开。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取参数个数

- 原文链接：https://esdn.ijingyi.com/title-13466.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取参数个数 （ ）
- 功能说明：返回当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”指定）中所包含的“SQL参数”个数。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取参数个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

返回当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”指定）中所包含的“SQL参数”个数。

*语法：*  整数型  *Sqlite记录集*．取参数个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有参数

- 原文链接：https://esdn.ijingyi.com/title-13467.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有参数 （ ）
- 功能说明：返回所有由“SQL参数”的参数名称组成的一维文本数组。如果某“SQL参数”没有名称，则对应的数组成员为空文本。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有参数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

返回所有由“SQL参数”的参数名称组成的一维文本数组。如果某“SQL参数”没有名称，则对应的数组成员为空文本。

*语法：*  文本型数组  *Sqlite记录集*．取所有参数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 绑定参数

- 原文链接：https://esdn.ijingyi.com/title-13468.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．绑定参数 （ 参数名称或索引 ， ［ 要绑定的值 ］ ）
- 功能说明：对当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”所指定）中所包含的某个“SQL参数”进行值绑定。所有“SQL参数”均需进行值绑定，未经绑定的“SQL参数”其值将视为null。如果对同一“SQL参数”进行多次绑定，则最后一次绑定的值将覆盖前面所绑定的值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 参数名称或索引 | 必填 | 通用型 | 使用参数名称时注意，“:”“$”也是参数名称的一部分；使用参数索引时注意，索引从1开始。 |
| 要绑定的值 | 可空 | 通用型 | 如果省略本参数，默认为null。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**绑定参数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

对当前SQL语句（由“置SQL语句()”或“Sqlite数据库.取记录集()”所指定）中所包含的某个“SQL参数”进行值绑定。所有“SQL参数”均需进行值绑定，未经绑定的“SQL参数”其值将视为null。如果对同一“SQL参数”进行多次绑定，则最后一次绑定的值将覆盖前面所绑定的值。

*语法：*  逻辑型  *Sqlite记录集*．绑定参数 （参数名称或索引， ［要绑定的值］）

| 参数名 | 描 述 |
| --- | --- |
| 参数名称或索引 | 必需的 ； 通用型。使用参数名称时注意，“:”“$”也是参数名称的一部分；使用参数索引时注意，索引从1开始。 |
| 要绑定的值 | 可选的 ； 通用型。如果省略本参数，默认为null。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 是否已打开

- 原文链接：https://esdn.ijingyi.com/title-13469.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．是否已打开 （ ）
- 功能说明：判断记录集是否已经打开。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**是否已打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

判断记录集是否已经打开。

*语法：*  逻辑型  *Sqlite记录集*．是否已打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13470.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．打开 （ ）
- 功能说明：打开或重新打开记录集。对于查询类(select)SQL语句，将当前记录指针指向第一条记录之前；对于执行类(update)SQL语句，执行该语句一次。此方法可以被多次重复调用。读取记录集数据之前，必须“打开()”记录集。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

打开或重新打开记录集。对于查询类(select)SQL语句，将当前记录指针指向第一条记录之前；对于执行类(update)SQL语句，执行该语句一次。此方法可以被多次重复调用。读取记录集数据之前，必须“打开()”记录集。

*语法：*  逻辑型  *Sqlite记录集*．打开 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13471.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．关闭 （ ）
- 功能说明：关闭记录集。关闭后的记录集不再可用，所有内部数据全部丢失。如果用户没有调用本方法关闭记录集，支持库会在适当的时机自动关闭记录集。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

关闭记录集。关闭后的记录集不再可用，所有内部数据全部丢失。如果用户没有调用本方法关闭记录集，支持库会在适当的时机自动关闭记录集。

*语法：*  逻辑型  *Sqlite记录集*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13472.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．读字段值 （ 字段名称或位置 ， 字段值 ）
- 功能说明：读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必填 | 通用型，参数数据只能提供变量 | 其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并写入第二个参数“字段值”中。执行成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Sqlite记录集*．读字段值 （字段名称或位置， 字段值）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。参数值可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 字段值 | 必需的 ； 通用型，参数数据只能提供变量。其中将存放取得的字段值。如果必要，将自动进行适当的数据类型转换。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 到下一记录

- 原文链接：https://esdn.ijingyi.com/title-13473.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．到下一记录 （ ）
- 功能说明：移动到下一条记录。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**到下一记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

移动到下一条记录。

*语法：*  逻辑型  *Sqlite记录集*．到下一记录 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 首记录前

- 原文链接：https://esdn.ijingyi.com/title-13474.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．首记录前 （ ）
- 功能说明：判断当前记录指针是否指向第一条记录之前。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**首记录前 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

判断当前记录指针是否指向第一条记录之前。

*语法：*  逻辑型  *Sqlite记录集*．首记录前 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 尾记录后

- 原文链接：https://esdn.ijingyi.com/title-13475.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．尾记录后 （ ）
- 功能说明：判断当前记录指针是否指向最后一条记录之后。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**尾记录后 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

判断当前记录指针是否指向最后一条记录之后。

*语法：*  逻辑型  *Sqlite记录集*．尾记录后 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取记录个数

- 原文链接：https://esdn.ijingyi.com/title-13476.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取记录个数 （ ）

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取记录个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

*语法：*  整数型  *Sqlite记录集*．取记录个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有记录

- 原文链接：https://esdn.ijingyi.com/title-13477.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有记录 （ 是否包含表头 ）
- 功能说明：返回一个二维文本数组，其中存放了记录集中所有记录（含所有字段）内容；如果记录集中没有记录或操作失败，将返回空数组。如果记录集中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。注意：本方法执行后，当前记录指针将指向首记录前（相当于重新打开记录集）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否包含表头 | 必填 | 逻辑型，初始值为“假” | 是否在返回值数组的第一行包含字段名称。如果本记录集中没有任何记录，即使本参数为“真”，也将返回空数组。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有记录 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

返回一个二维文本数组，其中存放了记录集中所有记录（含所有字段）内容；如果记录集中没有记录或操作失败，将返回空数组。如果记录集中有非文本型字段，将自动转换为文本型（可能丢失部分数据）。提示：使用“Sqlite表.读字段值()”或“Sqlite记录集.读字段值()”可正确地处理非文本类型字段。注意：本方法执行后，当前记录指针将指向首记录前（相当于重新打开记录集）。

*语法：*  文本型数组  *Sqlite记录集*．取所有记录 （是否包含表头）

| 参数名 | 描 述 |
| --- | --- |
| 是否包含表头 | 必需的 ； 逻辑型，初始值为“假”。是否在返回值数组的第一行包含字段名称。如果本记录集中没有任何记录，即使本参数为“真”，也将返回空数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取字段个数

- 原文链接：https://esdn.ijingyi.com/title-13478.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．取字段个数 （ ）

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取字段个数 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

*语法：*  整数型  *Sqlite记录集*．取字段个数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 取所有字段

- 原文链接：https://esdn.ijingyi.com/title-13479.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型数组
- 语法：文本型数组 Sqlite记录集 ．取所有字段 （ ）
- 功能说明：返回所有字段名称组成的一维文本数组。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有字段 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

返回所有字段名称组成的一维文本数组。

*语法：*  文本型数组  *Sqlite记录集*．取所有字段 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段文本值

- 原文链接：https://esdn.ijingyi.com/title-13480.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：文本型
- 语法：文本型 Sqlite记录集 ．读字段文本值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为文本型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段文本值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为文本型数据后返回。

*语法：*  文本型  *Sqlite记录集*．读字段文本值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段整数值

- 原文链接：https://esdn.ijingyi.com/title-13481.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：整数型
- 语法：整数型 Sqlite记录集 ．读字段整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为整数型数据后返回。

*语法：*  整数型  *Sqlite记录集*．读字段整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段小数值

- 原文链接：https://esdn.ijingyi.com/title-13482.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：小数型
- 语法：小数型 Sqlite记录集 ．读字段小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为小数型数据后返回。

*语法：*  小数型  *Sqlite记录集*．读字段小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段双精度小数值

- 原文链接：https://esdn.ijingyi.com/title-13483.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：双精度小数型
- 语法：双精度小数型 Sqlite记录集 ．读字段双精度小数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段双精度小数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为双精度小数型数据后返回。

*语法：*  双精度小数型  *Sqlite记录集*．读字段双精度小数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段字节集值

- 原文链接：https://esdn.ijingyi.com/title-13484.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：字节集
- 语法：字节集 Sqlite记录集 ．读字段字节集值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节集型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段字节集值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为字节集型数据后返回。

*语法：*  字节集  *Sqlite记录集*．读字段字节集值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段逻辑值

- 原文链接：https://esdn.ijingyi.com/title-13485.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：逻辑型
- 语法：逻辑型 Sqlite记录集 ．读字段逻辑值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段逻辑值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为逻辑型数据后返回。

*语法：*  逻辑型  *Sqlite记录集*．读字段逻辑值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段日期时间值

- 原文链接：https://esdn.ijingyi.com/title-13486.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：日期时间型
- 语法：日期时间型 Sqlite记录集 ．读字段日期时间值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段日期时间值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为日期时间型数据后返回。

*语法：*  日期时间型  *Sqlite记录集*．读字段日期时间值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段长整数值

- 原文链接：https://esdn.ijingyi.com/title-13487.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：长整数型
- 语法：长整数型 Sqlite记录集 ．读字段长整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为长整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段长整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为长整数型数据后返回。

*语法：*  长整数型  *Sqlite记录集*．读字段长整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段短整数值

- 原文链接：https://esdn.ijingyi.com/title-13488.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：短整数型
- 语法：短整数型 Sqlite记录集 ．读字段短整数值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为短整数型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段短整数值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为短整数型数据后返回。

*语法：*  短整数型  *Sqlite记录集*．读字段短整数值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 读字段字节值

- 原文链接：https://esdn.ijingyi.com/title-13489.html
- 操作系统支持：Windows、Linux 所属对象： Sqlite记录集
- 返回值类型：字节型
- 语法：字节型 Sqlite记录集 ．读字段字节值 （ 字段名称或位置 ， ［ 执行结果 ］ ）
- 功能说明：读取当前记录中指定字段的值，并转换为字节型数据后返回。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字段名称或位置 | 必填 | 通用型 | 指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**读字段字节值 方法**   操作系统支持：Windows、Linux    所属对象：[Sqlite记录集](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/dt2.htm)

读取当前记录中指定字段的值，并转换为字节型数据后返回。

*语法：*  字节型  *Sqlite记录集*．读字段字节值 （字段名称或位置， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字段名称或位置 | 必需的 ； 通用型。指定欲读取的字段，可以为一个字段名称文本或者一个字段位置数值，字段位置数值从1开始。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### Sqlite字段信息

- 原文链接：https://esdn.ijingyi.com/title-13404.html
- 操作系统支持：Windows、Linux 跳至： Sqlite3数据库支持库
- 功能说明：描述Sqlite字段定义信息，供“Sqlite数据库.创建表()”时使用。因为Sqlite数据库本质上是无类型的数据库，因而您完全可以忽略“类型”“最大文本长度”两个成员，而仅使用“名称”成员。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 名称 | 待核实 | 待核实 | 文本型； 初始值为“”。字段名称长度不限。 |
| 类型 | 待核实 | 待核实 | 整数型； 初始值为 0 。可以为以下值或常量值之一：-1、(主键，整数型自增字段)； 0、(无类型)； 1、#字节型； 2、#短整数型； 3、#整数型； 4、#长整数型； 5、#小数型； 6、#双精度小数型； 7、#逻辑型； 8、#日期时间型； 10、#文本型； 11、#字节集型； 12、#备注型。 |
| 最大文本长度 | 待核实 | 待核实 | 整数型； 初始值为 0 。本成员仅当字段类型为“文本型”时才有效，用作指定文本的“最大可能长度”（数据库不对此长度不作任何限制）；如果本成员值为0，表示该字段可存储任意长度的文本。如果字段类型不为“文本型”，本成员将被忽略。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**Sqlite字段信息 普通类型**   操作系统支持：Windows、Linux    跳至：[Sqlite3数据库支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/sqlite3/index.htm)

描述Sqlite字段定义信息，供“Sqlite数据库.创建表()”时使用。因为Sqlite数据库本质上是无类型的数据库，因而您完全可以忽略“类型”“最大文本长度”两个成员，而仅使用“名称”成员。

| 成员 | 描 述 |
| --- | --- |
| 名称 | 文本型； 初始值为“”。字段名称长度不限。 |
| 类型 | 整数型； 初始值为 0 。可以为以下值或常量值之一：-1、(主键，整数型自增字段)； 0、(无类型)； 1、#字节型； 2、#短整数型； 3、#整数型； 4、#长整数型； 5、#小数型； 6、#双精度小数型； 7、#逻辑型； 8、#日期时间型； 10、#文本型； 11、#字节集型； 12、#备注型。 |
| 最大文本长度 | 整数型； 初始值为 0 。本成员仅当字段类型为“文本型”时才有效，用作指定文本的“最大可能长度”（数据库不对此长度不作任何限制）；如果本成员值为0，表示该字段可存储任意长度的文本。如果字段类型不为“文本型”，本成员将被忽略。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
