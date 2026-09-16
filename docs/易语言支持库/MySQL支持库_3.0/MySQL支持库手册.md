# MySQL支持库 3.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-13833.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（3.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**MySQL支持库3.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库实现对MySQL数据库的支持，在使用本支持库前请学习MySQL相关知识，如果出错可以通过“取错误文本()”查看出错信息。从易语言5.0开始本库有内部调整，请对照命令说明检查“断开Mysql”“释放记录集”相关代码，确认代码书法无误。

操作系统支持： Windows、Linux

**命令类别：**

| MySql操作 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| 字段信息类型 | 表更改信息类型 |  |  |
| --- | --- | --- | --- |

[常量表...](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/const.htm)

**
例程列表：**

| 例程名称 | 下载 | 说明 |
| --- | --- | --- |
| MySql数据库操作例程 | MySql数据库例程.e | 本程序演示了如何操作MySql数据库&nbsp |

## 命令分类：命令类别（48 条）

### 连接MySql

- 原文链接：https://esdn.ijingyi.com/title-13839.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 连接MySql （ ［ MySql服务器地址 ］ ， ［ 用户名 ］ ， ［ 密码 ］ ， ［ 数据库名 ］ ， ［ 端口 ］ ）
- 功能说明：连接到MySql服务器，返回一个MySql句柄。返回0表示连接失败，请检查该MYSQL服务器是否允许连接。有效的Mysql句柄使用完毕后需通过“断开Mysql”命令释放相关资源。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql服务器地址 | 可空 | 文本型 | 本参数的作用是设置MYSQL服务器的地址。请输入您想要连接的MySql服务器的地址，如果为空或字符串"localhost"，则是到本地主机的一个连接。 |
| 用户名 | 可空 | 文本型 | 本参数的作用是设置您的用户名，如果为空，为当前用户。 |
| 密码 | 可空 | 文本型 | 本参数的作用是设置您的密码，如果为空，且USER表中设置了“空字段可用”属性则可以匿名登陆。 |
| 数据库名 | 可空 | 文本型 | 本参数的作用是设置您想要访问的数据库，如果为空则为默认数据库。 |
| 端口 | 可空 | 整数型 | 本参数的作用是设置您想要连接的MySql服务器的端口，如果为空则为默认端口。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd1.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd1.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

连接 MySql 服务器，如果都为空则连接本地主机。 参见： 例程 1

**完整正文（站点原文转换）**

**连接MySql 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

连接到MySql服务器，返回一个MySql句柄。返回0表示连接失败，请检查该MYSQL服务器是否允许连接。有效的Mysql句柄使用完毕后需通过“断开Mysql”命令释放相关资源。

*语法：*  整数型  连接MySql （［MySql服务器地址］， ［用户名］， ［密码］， ［数据库名］， ［端口］）

| 参数名 | 描 述 |
| --- | --- |
| MySql服务器地址 | 可选的 ； 文本型。本参数的作用是设置MYSQL服务器的地址。请输入您想要连接的MySql服务器的地址，如果为空或字符串"localhost"，则是到本地主机的一个连接。 |
| 用户名 | 可选的 ； 文本型。本参数的作用是设置您的用户名，如果为空，为当前用户。 |
| 密码 | 可选的 ； 文本型。本参数的作用是设置您的密码，如果为空，且USER表中设置了“空字段可用”属性则可以匿名登陆。 |
| 数据库名 | 可选的 ； 文本型。本参数的作用是设置您想要访问的数据库，如果为空则为默认数据库。 |
| 端口 | 可选的 ； 整数型。本参数的作用是设置您想要连接的MySql服务器的端口，如果为空则为默认端口。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：　

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd1.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd1.files/image003.gif)

说明：

    连接MySql服务器，如果都为空则连接本地主机。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 断开MySql

- 原文链接：https://esdn.ijingyi.com/title-13840.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：无返回值
- 语法：无返回值 断开MySql （ MySql句柄 ）
- 功能说明：断开一个MySql连接。断开之后原连接句柄不可再用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。对于参数值为0的情况不执行任何操作（注意，本库3.0以前的版本在参数为0时执行断开最后一次连接，易语言5.0针对静态编译对此库进行改造后已不支持该功能）。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd2.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd2.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

断开与一个 MySql 的连接，由于 MySql 可以同时连接多个，使用断开命令对其它连接的 MySql 没有影响。 参见： 例程 1

**完整正文（站点原文转换）**

**断开MySql 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

断开一个MySql连接。断开之后原连接句柄不可再用。

*语法：*  无返回值  断开MySql （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。对于参数值为0的情况不执行任何操作（注意，本库3.0以前的版本在参数为0时执行断开最后一次连接，易语言5.0针对静态编译对此库进行改造后已不支持该功能）。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd2.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd2.files/image003.gif)

说明：

       断开与一个MySql的连接，由于MySql可以同时连接多个，使用断开命令对其它连接的MySql没有影响。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 执行SQL语句

- 原文链接：https://esdn.ijingyi.com/title-13841.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 执行SQL语句 （ MySql句柄 ， Sql语句 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 执行一条SQL语句，执行成功返回真，失败返回假。如果执行成功可以通过“取记录集”命令得到记录集句柄。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| Sql语句 | 必填 | 文本型 | 本参数是设置查询数据库的SQL语句，如Select,Update,Insert,Delete等等语句。详细信息请参考相关SQL语言书籍。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd3.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd3.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

用来执行 SQL 语句，一般连接数据库之后，都用本命令执行查询，来更新数据库资料。 参见： 例程 1

**完整正文（站点原文转换）**

**执行SQL语句 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

为高级用户提供，初级用户无需掌握；
执行一条SQL语句，执行成功返回真，失败返回假。如果执行成功可以通过“取记录集”命令得到记录集句柄。

*语法：*  逻辑型  执行SQL语句 （MySql句柄， Sql语句）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| Sql语句 | 必需的 ； 文本型。本参数是设置查询数据库的SQL语句，如Select,Update,Insert,Delete等等语句。详细信息请参考相关SQL语言书籍。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd3.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd3.files/image003.gif)

说明：

       用来执行SQL语句，一般连接数据库之后，都用本命令执行查询，来更新数据库资料。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取记录集

- 原文链接：https://esdn.ijingyi.com/title-13842.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 取记录集 （ MySql句柄 ）
- 功能说明：得到查询后的记录的集合(简称：记录集)。返回记录集句柄。当使用完记录集后要通过“释放记录集”命令来释放记录集。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd4.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd4.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

对数据库进行完查找等命令之后必须用本命令取得查找后的记录集以便操作。 参见： 例程 1

**完整正文（站点原文转换）**

**取记录集 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

得到查询后的记录的集合(简称：记录集)。返回记录集句柄。当使用完记录集后要通过“释放记录集”命令来释放记录集。

*语法：*  整数型  取记录集 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd4.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd4.files/image003.gif)

说明：

    对数据库进行完查找等命令之后必须用本命令取得查找后的记录集以便操作。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 释放记录集

- 原文链接：https://esdn.ijingyi.com/title-13843.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：无返回值
- 语法：无返回值 释放记录集 （ 记录集句柄 ）
- 功能说明：释放记录集之后，原记录集句柄不可再用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd5.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

使用取记录集命令取得的记录集，使用本命令来释放，在确定该记录集不需要使用的时候，尽量都用本命令释放。 参见： 例程 1

**完整正文（站点原文转换）**

**释放记录集 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

释放记录集之后，原记录集句柄不可再用。

*语法：*  无返回值  释放记录集 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd5.files/image002.gif)

说明：

    使用取记录集命令取得的记录集，使用本命令来释放，在确定该记录集不需要使用的时候，尽量都用本命令释放。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 读字段值

- 原文链接：https://esdn.ijingyi.com/title-13844.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 读字段值 （ 记录集句柄 ， 字段 ， 结果变量 ）
- 功能说明：读记录集中当前行的字段内容，字段索引从0开始。读取成功返回真，失败返回假。如果读取成功将把字段中的数据写入结果变量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段 | 必填 | 通用型 | 本参数指定您想要读取的字段，可以是字段名称或是字段序号。 |
| 结果变量 | 必填 | 通用型，参数数据只能提供变量 | 本参数是存放返回结果的变量，如果字段类型为#MYSQL日期型或#MYSQL时间型或#MYSQL年份型时系统会转换为易语言中的日期时间型，如：字段为#MYSQL时间型，值为“23:33:34”，通过本命令得到的日期时间型变量的值为“2000-1-1 23:33:34”，如果字段为空时返回0或空字符串或空字节集。可以通过“字段是否为空”命令确定。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd6.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd6.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

读取 MySql 数据库中字段的内容。本命令只读取所在行的记录，如果想全部读出，请在循环中使用。 参见： 例程 1

**完整正文（站点原文转换）**

**读字段值 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

读记录集中当前行的字段内容，字段索引从0开始。读取成功返回真，失败返回假。如果读取成功将把字段中的数据写入结果变量。

*语法：*  逻辑型  读字段值 （记录集句柄， 字段， 结果变量）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段 | 必需的 ； 通用型。本参数指定您想要读取的字段，可以是字段名称或是字段序号。 |
| 结果变量 | 必需的 ； 通用型，参数数据只能提供变量。本参数是存放返回结果的变量，如果字段类型为#MYSQL日期型或#MYSQL时间型或#MYSQL年份型时系统会转换为易语言中的日期时间型，如：字段为#MYSQL时间型，值为“23:33:34”，通过本命令得到的日期时间型变量的值为“2000-1-1 23:33:34”，如果字段为空时返回0或空字符串或空字节集。可以通过“字段是否为空”命令确定。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd6.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd6.files/image002.gif)

说明：

    读取MySql数据库中字段的内容。本命令只读取所在行的记录，如果想全部读出，请在循环中使用。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取记录集行数

- 原文链接：https://esdn.ijingyi.com/title-13845.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：长整数型
- 语法：长整数型 取记录集行数 （ 记录集句柄 ）
- 功能说明：获取记录集的行数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd7.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd7.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得某记录集中所有纪录的行数，在使用本命令之前，必须用取记录集取回需要的记录集句柄。 参见： 例程 1

**完整正文（站点原文转换）**

**取记录集行数 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

获取记录集的行数。

*语法：*  长整数型  取记录集行数 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd7.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd7.files/image003.gif)

说明：

    取得某记录集中所有纪录的行数，在使用本命令之前，必须用取记录集取回需要的记录集句柄。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 到下一行

- 原文链接：https://esdn.ijingyi.com/title-13846.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 到下一行 （ 记录集句柄 ）
- 功能说明：将当前记录指针向下移动一行，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd10.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd10.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将当前记录指针移动到下一行，如果该行为最后一行，使用本命令将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**到下一行 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

将当前记录指针向下移动一行，成功返回真，失败返回假。

*语法：*  逻辑型  到下一行 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd10.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd10.files/image003.gif)

说明：

   将当前记录指针移动到下一行，如果该行为最后一行，使用本命令将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 到指定行

- 原文链接：https://esdn.ijingyi.com/title-13847.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 到指定行 （ 记录集句柄 ， 记录位置 ）
- 功能说明：将当前记录指针移动到指定行，移动成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 记录位置 | 必填 | 长整数型 | 本参数是准备移动到的新记录号，记录号值从 0 开始。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd11.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd11.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将当前记录指针移动到指定的行位置，如果指定的行不存在，本命令将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**到指定行 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

将当前记录指针移动到指定行，移动成功返回真，失败返回假。

*语法：*  逻辑型  到指定行 （记录集句柄， 记录位置）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 记录位置 | 必需的 ； 长整数型。本参数是准备移动到的新记录号，记录号值从 0 开始。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd11.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd11.files/image003.gif)

说明：

   将当前记录指针移动到指定的行位置，如果指定的行不存在，本命令将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 到首行

- 原文链接：https://esdn.ijingyi.com/title-13848.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 到首行 （ 记录集句柄 ）
- 功能说明：将当前记录指针移动到记录集首记录，移动成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd12.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd12.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将当前记录指针移动到纪录的首行位置，如果当前指针已经在首行，使用本命令移动一样会成功。 参见： 例程 1

**完整正文（站点原文转换）**

**到首行 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

将当前记录指针移动到记录集首记录，移动成功返回真，失败返回假。

*语法：*  逻辑型  到首行 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd12.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd12.files/image003.gif)

说明：

    将当前记录指针移动到纪录的首行位置，如果当前指针已经在首行，使用本命令移动一样会成功。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 到尾行

- 原文链接：https://esdn.ijingyi.com/title-13849.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 到尾行 （ 记录集句柄 ）
- 功能说明：将当前记录指针移动到记录集尾记录，移动成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd13.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd13.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将当前记录指针移动到记录尾行的位置，如果指针已经在尾行，只用本命令也会成功。 参见： 例程 1

**完整正文（站点原文转换）**

**到尾行 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

将当前记录指针移动到记录集尾记录，移动成功返回真，失败返回假。

*语法：*  逻辑型  到尾行 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd13.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd13.files/image003.gif)

说明：

    将当前记录指针移动到记录尾行的位置，如果指针已经在尾行，只用本命令也会成功。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取字段总数

- 原文链接：https://esdn.ijingyi.com/title-13850.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 取字段总数 （ 记录集句柄 ）
- 功能说明：取得记录集的字段总数，返回字段总数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得记录集中字段的总数，记录集中的字段数量可能和数据库中不一样，具体根据使用的 SQL 命令不同，返回的也不同。 参见： 例程 1

**完整正文（站点原文转换）**

**取字段总数 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得记录集的字段总数，返回字段总数。

*语法：*  整数型  取字段总数 （记录集句柄）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd14.files/image001.gif)

说明：

   取得记录集中字段的总数，记录集中的字段数量可能和数据库中不一样，具体根据使用的SQL命令不同，返回的也不同。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 序号到字段名

- 原文链接：https://esdn.ijingyi.com/title-13851.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 序号到字段名 （ 记录集句柄 ， 序号 ， 结果变量 ）
- 功能说明：通过序号得到字段名，如果成功返回真，结果变量为得到的字段名，失败返回假，结果变量无效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 序号 | 必填 | 整数型 | 本参数是字段的序号。 |
| 结果变量 | 必填 | 文本型，参数数据只能提供变量 | 本参数是存放返回的字段名的变量。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd15.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd15.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

根据序号取得字段的名称，序号从 0 开始。 参见： 例程 1

**完整正文（站点原文转换）**

**序号到字段名 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

通过序号得到字段名，如果成功返回真，结果变量为得到的字段名，失败返回假，结果变量无效。

*语法：*  逻辑型  序号到字段名 （记录集句柄， 序号， 结果变量）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 序号 | 必需的 ； 整数型。本参数是字段的序号。 |
| 结果变量 | 必需的 ； 文本型，参数数据只能提供变量。本参数是存放返回的字段名的变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd15.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd15.files/image002.gif)

说明：

   根据序号取得字段的名称，序号从0开始。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 字段名到序号

- 原文链接：https://esdn.ijingyi.com/title-13852.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 字段名到序号 （ 记录集句柄 ， 字段名 ， 结果变量 ）
- 功能说明：通过字段名得到序号，如果成功返回真，结果变量为得到的序号，失败返回假，结果变量无效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段名 | 必填 | 文本型 | 本参数是字段的名称。 |
| 结果变量 | 必填 | 整数型，参数数据只能提供变量 | 本参数是存放返回的序号的变量。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd16.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd16.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

通过字段名取得该字段的序号，序号从 0 开始。 参见： 例程 1

**完整正文（站点原文转换）**

**字段名到序号 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

通过字段名得到序号，如果成功返回真，结果变量为得到的序号，失败返回假，结果变量无效。

*语法：*  逻辑型  字段名到序号 （记录集句柄， 字段名， 结果变量）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段名 | 必需的 ； 文本型。本参数是字段的名称。 |
| 结果变量 | 必需的 ； 整数型，参数数据只能提供变量。本参数是存放返回的序号的变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd16.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd16.files/image002.gif)

说明：

   通过字段名取得该字段的序号，序号从0开始。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 查找记录

- 原文链接：https://esdn.ijingyi.com/title-13853.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 查找记录 （ MySql句柄 ， 表名 ， 字段名 ， 查找条件 ， 排序条件 ）
- 功能说明：查找满足条件的记录，返回记录集句柄。注意执行这条语句后不需要再执行“取记录集”命令，如果为中文字段名请在字段名两边加“`”，如：`姓名`。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是您要查询的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 字段名 | 必填 | 文本型 | 本参数是您要查询的表中字段的名称，可以使用逗号连接多个字段，如果为*号则表示查询所有字段。例子1 单个字段 name 例子2 多个字段 name,email,id 例子3 所有字段 *。 |
| 查找条件 | 必填 | 文本型 | 本参数是您要查询的条件。例子1 如果您要查找name的值为jack的记录 name='jack' 例子2 如果您要查找name的值为jack并且id的值为2的记录 name='jack' and id=2 例子3 如果您要查找name的值为jack或者id的值为2的记录 name='jack' or id=2。 |
| 排序条件 | 必填 | 文本型 | 本参数是排序的条件，ASC为升序，DESC为降序。例如要对name字段进行降序排序: name DESC 。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd17.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd17.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

根据查找条件查找纪录，查找条件返回记录集句柄，根据这个句柄操作查找的结果，不需要在使用取记录集来取得记录集句柄了。 参见： 例程 1

**完整正文（站点原文转换）**

**查找记录 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

查找满足条件的记录，返回记录集句柄。注意执行这条语句后不需要再执行“取记录集”命令，如果为中文字段名请在字段名两边加“`”，如：`姓名`。

*语法：*  整数型  查找记录 （MySql句柄， 表名， 字段名， 查找条件， 排序条件）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是您要查询的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 字段名 | 必需的 ； 文本型。本参数是您要查询的表中字段的名称，可以使用逗号连接多个字段，如果为*号则表示查询所有字段。例子1 单个字段 name 例子2 多个字段 name,email,id 例子3 所有字段 *。 |
| 查找条件 | 必需的 ； 文本型。本参数是您要查询的条件。例子1 如果您要查找name的值为jack的记录 name='jack' 例子2 如果您要查找name的值为jack并且id的值为2的记录 name='jack' and id=2 例子3 如果您要查找name的值为jack或者id的值为2的记录 name='jack' or id=2。 |
| 排序条件 | 必需的 ； 文本型。本参数是排序的条件，ASC为升序，DESC为降序。例如要对name字段进行降序排序: name DESC 。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd17.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd17.files/image002.gif)

说明：

   根据查找条件查找纪录，查找条件返回记录集句柄，根据这个句柄操作查找的结果，不需要在使用取记录集来取得记录集句柄了。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 增加记录

- 原文链接：https://esdn.ijingyi.com/title-13854.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 增加记录 （ MySql句柄 ， 表名 ， 赋值语句 ）
- 功能说明：写入信息到新记录的指定字段，执行成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是您要写入新记录的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 赋值语句 | 必填 | 文本型 | 本参数是您要执行的赋值语句。例如增加一条记录并且为字段name与email分别赋予值“jack”、“jack@126.com”: name='jack',email='jack@126.com'，如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd18.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd18.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在记录集的尾部增加一条新记录，字节集类型记录不能使用该命令增加。 参见： 例程 1

**完整正文（站点原文转换）**

**增加记录 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

写入信息到新记录的指定字段，执行成功返回真，失败返回假。

*语法：*  逻辑型  增加记录 （MySql句柄， 表名， 赋值语句）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是您要写入新记录的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 赋值语句 | 必需的 ； 文本型。本参数是您要执行的赋值语句。例如增加一条记录并且为字段name与email分别赋予值“jack”、“jack@126.com”: name='jack',email='jack@126.com'，如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd18.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd18.files/image002.gif)

说明：

   在记录集的尾部增加一条新记录，字节集类型记录不能使用该命令增加。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 更新记录

- 原文链接：https://esdn.ijingyi.com/title-13855.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 更新记录 （ MySql句柄 ， 表名 ， 赋值语句 ， 条件 ）
- 功能说明：更新指定字段的数据，更新成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是您要更新数据的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 赋值语句 | 必填 | 文本型 | 本参数是您要执行的赋值语句。例如为字段name与email分别赋予值“sun”、“sun@126.com”: name='sun',email='sun@126.com'，如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |
| 条件 | 必填 | 文本型 | 本参数是查找符合条件的记录。如果为“”空字符串那么将更新所有记录。例如当字段name的内容“jack”时更新记录: name='jack'。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd19.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd19.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改数据库中某字段的内容，根据参数提供的条件修改，所以可以根据参数大批量修改。 参见： 例程 1

**完整正文（站点原文转换）**

**更新记录 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

更新指定字段的数据，更新成功返回真，失败返回假。

*语法：*  逻辑型  更新记录 （MySql句柄， 表名， 赋值语句， 条件）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是您要更新数据的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 赋值语句 | 必需的 ； 文本型。本参数是您要执行的赋值语句。例如为字段name与email分别赋予值“sun”、“sun@126.com”: name='sun',email='sun@126.com'，如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |
| 条件 | 必需的 ； 文本型。本参数是查找符合条件的记录。如果为“”空字符串那么将更新所有记录。例如当字段name的内容“jack”时更新记录: name='jack'。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd19.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd19.files/image002.gif)

说明：

    修改数据库中某字段的内容，根据参数提供的条件修改，所以可以根据参数大批量修改。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 删除记录

- 原文链接：https://esdn.ijingyi.com/title-13856.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除记录 （ MySql句柄 ， 表名 ， 条件 ）
- 功能说明：删除一条记录，删除成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是您要进行删除操作的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 条件 | 必填 | 文本型 | 本参数是删除符合条件的记录。如果为“”(空字符串)将删除所有记录。例如当字段name的内容为“jack”时删除记录: name='jack',如果为中文字段名请在字段名两边加“`”,如：`姓名`。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd20.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd20.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

根据提供的条件来删除相应记录，如果条件给空，将删除所有记录。 参见： 例程 1

**完整正文（站点原文转换）**

**删除记录 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

删除一条记录，删除成功返回真，失败返回假。

*语法：*  逻辑型  删除记录 （MySql句柄， 表名， 条件）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是您要进行删除操作的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 条件 | 必需的 ； 文本型。本参数是删除符合条件的记录。如果为“”(空字符串)将删除所有记录。例如当字段name的内容为“jack”时删除记录: name='jack',如果为中文字段名请在字段名两边加“`”,如：`姓名`。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd20.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd20.files/image002.gif)

说明：

    根据提供的条件来删除相应记录，如果条件给空，将删除所有记录。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取字段宽度

- 原文链接：https://esdn.ijingyi.com/title-13857.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 取字段宽度 （ 记录集句柄 ， 字段序号 ）
- 功能说明：取得指定字段的名称宽度，出错返回-1。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段序号 | 必填 | 整数型 | 本参数是您要取的宽度的字段的序号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd21.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd21.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得某字段名称的宽度，不如说字段名为“ name ”取出的字段宽度就为 4 ，如果字段名为中文，一个中文占两个宽度。 参见： 例程 1

**完整正文（站点原文转换）**

**取字段宽度 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得指定字段的名称宽度，出错返回-1。

*语法：*  整数型  取字段宽度 （记录集句柄， 字段序号）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段序号 | 必需的 ； 整数型。本参数是您要取的宽度的字段的序号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd21.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd21.files/image003.gif)

说明：

       取得某字段名称的宽度，不如说字段名为“name”取出的字段宽度就为4，如果字段名为中文，一个中文占两个宽度。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取字段属性

- 原文链接：https://esdn.ijingyi.com/title-13858.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：整数型
- 语法：整数型 取字段属性 （ 记录集句柄 ， 字段名或字段序号 ）
- 功能说明：取得字段的属性，返回与字段类型常量向对应的值，出错返回-1。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段名或字段序号 | 必填 | 通用型 | 本参数是您要取得属性的字段的名称或序号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd22.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd22.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得某字段的类型，参数二可以为字段名称或者字段序号，序号从 0 开始。 参见： 例程 1

**完整正文（站点原文转换）**

**取字段属性 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得字段的属性，返回与字段类型常量向对应的值，出错返回-1。

*语法：*  整数型  取字段属性 （记录集句柄， 字段名或字段序号）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段名或字段序号 | 必需的 ； 通用型。本参数是您要取得属性的字段的名称或序号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd22.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd22.files/image003.gif)

说明：

       取得某字段的类型，参数二可以为字段名称或者字段序号，序号从0开始。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取服务器版本

- 原文链接：https://esdn.ijingyi.com/title-13859.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取服务器版本 （ MySql句柄 ， 结果变量 ）
- 功能说明：取得MYSQL服务器的版本信息并设置结果变量，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 结果变量 | 必填 | 文本型，参数数据只能提供变量 | 本参数存放调用本命令后的结果。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd23.files/image004.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd23.files/image005.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得服务器端 MySql 数据库的版本信息。 参见： 例程 1

**完整正文（站点原文转换）**

**取服务器版本 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得MYSQL服务器的版本信息并设置结果变量，成功返回真，失败返回假。

*语法：*  逻辑型  取服务器版本 （MySql句柄， 结果变量）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 结果变量 | 必需的 ； 文本型，参数数据只能提供变量。本参数存放调用本命令后的结果。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd23.files/image004.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd23.files/image005.gif)

说明：

       取得服务器端MySql数据库的版本信息。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取客户端版本

- 原文链接：https://esdn.ijingyi.com/title-13860.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取客户端版本 （ 结果变量 ）
- 功能说明：取得MYSQL客户端的版本信息并设置结果变量，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 结果变量 | 必填 | 文本型，参数数据只能提供变量 | 本参数存放调用本命令后的结果。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd24.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd24.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得用户当前使用的 MySql 数据库的客户端版本。 参见： 例程 1

**完整正文（站点原文转换）**

**取客户端版本 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得MYSQL客户端的版本信息并设置结果变量，成功返回真，失败返回假。

*语法：*  逻辑型  取客户端版本 （结果变量）

| 参数名 | 描 述 |
| --- | --- |
| 结果变量 | 必需的 ； 文本型，参数数据只能提供变量。本参数存放调用本命令后的结果。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd24.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd24.files/image004.gif)

说明：

       取得用户当前使用的MySql数据库的客户端版本。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 创建库

- 原文链接：https://esdn.ijingyi.com/title-13861.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 创建库 （ MySql句柄 ， 库名 ）
- 功能说明：创建一个数据库。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必填 | 文本型 | 本参数是将用创建的库的名称，如果为中文库名请在字段名两边加“`”，如：`测试库`。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd25.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

创建一个新的数据库，创建库文件之前用户必须确定有足够的权限，否则不能创建。如果需要用中文名创建，中文名称必须用 `` 括起来，如： ` 中文名 ` “ ` ”这个符号为键盘上“ 1 ”旁边的按键。 参见： 例程 1

**完整正文（站点原文转换）**

**创建库 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

创建一个数据库。成功返回真，失败返回假。

*语法：*  逻辑型  创建库 （MySql句柄， 库名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必需的 ； 文本型。本参数是将用创建的库的名称，如果为中文库名请在字段名两边加“`”，如：`测试库`。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd25.files/image003.gif)

说明：

       创建一个新的数据库，创建库文件之前用户必须确定有足够的权限，否则不能创建。如果需要用中文名创建，中文名称必须用``括起来，如：`中文名`“      `”这个符号为键盘上“1”旁边的按键。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E5%BA%93%E6%93%8D%E4%BD%9C.e)

---

### 删除库

- 原文链接：https://esdn.ijingyi.com/title-13862.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除库 （ MySql句柄 ， 库名 ）
- 功能说明：删除一个数据库。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必填 | 文本型 | 本参数是将要删除的库的名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd26.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除一个数据库，在进行操作之前必须确定有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**删除库 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

删除一个数据库。成功返回真，失败返回假。

*语法：*  逻辑型  删除库 （MySql句柄， 库名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必需的 ； 文本型。本参数是将要删除的库的名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd26.files/image003.gif)

说明：

       删除一个数据库，在进行操作之前必须确定有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E5%BA%93%E6%93%8D%E4%BD%9C.e)

---

### 查找库

- 原文链接：https://esdn.ijingyi.com/title-13863.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 查找库 （ MySql句柄 ， 库名 ）
- 功能说明：查找一个数据库。找到返回真，没找到返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必填 | 文本型 | 本参数是将要查找的库的名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd27.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

查找一个数据库是否存在，在查找之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**查找库 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

查找一个数据库。找到返回真，没找到返回假。

*语法：*  逻辑型  查找库 （MySql句柄， 库名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必需的 ； 文本型。本参数是将要查找的库的名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd27.files/image003.gif)

说明：

       查找一个数据库是否存在，在查找之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E5%BA%93%E6%93%8D%E4%BD%9C.e)

---

### 取库名列表

- 原文链接：https://esdn.ijingyi.com/title-13864.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取库名列表 （ MySql句柄 ）
- 功能说明：取得数据库名称的列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd28.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

查找一共有多少数据库，在查找之前确认有足够的权限，否则将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**取库名列表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得数据库名称的列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。

*语法：*  逻辑型  取库名列表 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd28.files/image003.gif)

说明：

       查找一共有多少数据库，在查找之前确认有足够的权限，否则将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E5%BA%93%E6%93%8D%E4%BD%9C.e)

---

### 创建表

- 原文链接：https://esdn.ijingyi.com/title-13865.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 创建表 （ MySql句柄 ， 表名 ， 字段信息表 ）
- 功能说明：创建一个表。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要创建的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名表`。 |
| 字段信息表 | 必填 | 字段信息类型，参数数据只能提供数组数据 | 本参数是由字段信息类型组成的数组，这个数组中最多有一个类型为#字段附加类型的元素。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd29.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在指定库中创建一个表，在创建之前确认有足够的权限，否则将失败。如果需要用中文名创建，中文名称必须用 `` 括 起来，如： ` 中文名 ` “ ` ”这个符号为键盘上“ 1 ”旁边的按键。 参见： 例程 1

**完整正文（站点原文转换）**

**创建表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

创建一个表。成功返回真，失败返回假。

*语法：*  逻辑型  创建表 （MySql句柄， 表名， 字段信息表）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要创建的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名表`。 |
| 字段信息表 | 必需的 ； 字段信息类型，参数数据只能提供数组数据。本参数是由字段信息类型组成的数组，这个数组中最多有一个类型为#字段附加类型的元素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd29.files/image003.gif)

说明： 在指定库中创建一个表，在创建之前确认有足够的权限，否则将失败。如果需要用中文名创建，中文名称必须用``括起来，如：`中文名`“ `”这个符号为键盘上“1”旁边的按键。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 修改表

- 原文链接：https://esdn.ijingyi.com/title-13866.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 修改表 （ MySql句柄 ， 表名 ， 更改信息表 ， 字段信息 ， 修改类型 ）
- 功能说明：修改一个表，注：只能做“修改类型”中指定的操作。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要修改表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 更改信息表 | 必填 | 表更改信息类型 | 本参数记录了新表的相关信息。 |
| 字段信息 | 必填 | 字段信息类型 | 本参数在修改类型为#增加字段或#修改字段时使用。 |
| 修改类型 | 必填 | 整数型 | 本参数是#增加字段，#修改字段#，#删除字段，#增加索引，#删除索引，#增加主键，#删除主键其中之一。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd30.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改数据库中的表，在修改之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**修改表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

修改一个表，注：只能做“修改类型”中指定的操作。成功返回真，失败返回假。

*语法：*  逻辑型  修改表 （MySql句柄， 表名， 更改信息表， 字段信息， 修改类型）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要修改表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 更改信息表 | 必需的 ； 表更改信息类型。本参数记录了新表的相关信息。 |
| 字段信息 | 必需的 ； 字段信息类型。本参数在修改类型为#增加字段或#修改字段时使用。 |
| 修改类型 | 必需的 ； 整数型。本参数是#增加字段，#修改字段#，#删除字段，#增加索引，#删除索引，#增加主键，#删除主键其中之一。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd30.files/image002.gif)

说明：

       修改数据库中的表，在修改之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 删除表

- 原文链接：https://esdn.ijingyi.com/title-13867.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除表 （ MySql句柄 ， 表名 ）
- 功能说明：删除一个表。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要删除的表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd31.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除数据库中的表，在操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**删除表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

删除一个表。成功返回真，失败返回假。

*语法：*  逻辑型  删除表 （MySql句柄， 表名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要删除的表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd31.files/image003.gif)

说明：

       删除数据库中的表，在操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 查找表

- 原文链接：https://esdn.ijingyi.com/title-13868.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 查找表 （ MySql句柄 ， 表名 ）
- 功能说明：查找一个表，找到返回真，没找到返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要查找的表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd32.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

查找数据库中的表，在操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**查找表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

查找一个表，找到返回真，没找到返回假。

*语法：*  逻辑型  查找表 （MySql句柄， 表名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要查找的表的表名，如果为中文表名请在表名两边加“`”，如：`姓名`。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd32.files/image003.gif)

说明：

       查找数据库中的表，在操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 取表名列表

- 原文链接：https://esdn.ijingyi.com/title-13869.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取表名列表 （ MySql句柄 ）
- 功能说明：取得当前数据库中所有表的名称列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd33.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得数据库中所有表的详细信息，在操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**取表名列表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得当前数据库中所有表的名称列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。

*语法：*  逻辑型  取表名列表 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd33.files/image003.gif)

说明：

       取得数据库中所有表的详细信息，在操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E8%A1%A8%E6%93%8D%E4%BD%9C.e)

---

### 创建用户

- 原文链接：https://esdn.ijingyi.com/title-13870.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 创建用户 （ MySql句柄 ， 主机 ， 用户名 ， 密码 ， 库名 ， 表名 ， 权限 ）
- 功能说明：创建一个用户。成功返回真，失败返回假。具体规则请参见MYSQL相关手册。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 主机 | 必填 | 文本型 | 本参数是与新用户相关联的主机名，如果为空文本则为所有主机。 |
| 用户名 | 必填 | 文本型 | 本参数是新用户名。 |
| 密码 | 必填 | 文本型 | 本参数是用户的密码。 |
| 库名 | 必填 | 文本型 | 本参数是新用户所操作的库，如果为空文本或“*”，则为所有库，如果为中文表名请在表名两边加“`”。 |
| 表名 | 必填 | 文本型 | 本参数是新用户所操作的表，当库名不为空文本或“*”时本参数可以为空文本或“*”即所有表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 权限 | 必填 | 整数型 | 本参数是新用户对库或表的操作权限。如果为零则为无权限。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd34.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

创建一个用户，在操作之前确认有足够的权限，否则操作将失败。如果需要用中文名创建，中文名称必须用 `` 括起来，如： ` 中文名 ` “ ` ”这个符号为键盘上“ 1 ”旁边的按键。 参见： 例程 1

**完整正文（站点原文转换）**

**创建用户 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

创建一个用户。成功返回真，失败返回假。具体规则请参见MYSQL相关手册。

*语法：*  逻辑型  创建用户 （MySql句柄， 主机， 用户名， 密码， 库名， 表名， 权限）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 主机 | 必需的 ； 文本型。本参数是与新用户相关联的主机名，如果为空文本则为所有主机。 |
| 用户名 | 必需的 ； 文本型。本参数是新用户名。 |
| 密码 | 必需的 ； 文本型。本参数是用户的密码。 |
| 库名 | 必需的 ； 文本型。本参数是新用户所操作的库，如果为空文本或“*”，则为所有库，如果为中文表名请在表名两边加“`”。 |
| 表名 | 必需的 ； 文本型。本参数是新用户所操作的表，当库名不为空文本或“*”时本参数可以为空文本或“*”即所有表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 权限 | 必需的 ； 整数型。本参数是新用户对库或表的操作权限。如果为零则为无权限。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd34.files/image003.gif)

说明：

       创建一个用户，在操作之前确认有足够的权限，否则操作将失败。如果需要用中文名创建，中文名称必须用``括起来，如：`中文名`“   `”这个符号为键盘上“1”旁边的按键。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E7%94%A8%E6%88%B7%E6%93%8D%E4%BD%9C.e)

---

### 删除用户

- 原文链接：https://esdn.ijingyi.com/title-13871.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除用户 （ MySql句柄 ， 用户名 ， 主机 ）
- 功能说明：删除一个用户。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必填 | 文本型 | 本参数是将要删除用户的名字。 |
| 主机 | 必填 | 文本型 | 本参数是与用户名相关联的主机名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd35.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除一个用户，在操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**删除用户 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

删除一个用户。成功返回真，失败返回假。

*语法：*  逻辑型  删除用户 （MySql句柄， 用户名， 主机）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必需的 ； 文本型。本参数是将要删除用户的名字。 |
| 主机 | 必需的 ； 文本型。本参数是与用户名相关联的主机名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd35.files/image003.gif)

说明：

       删除一个用户，在操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E7%94%A8%E6%88%B7%E6%93%8D%E4%BD%9C.e)

---

### 查找用户

- 原文链接：https://esdn.ijingyi.com/title-13872.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 查找用户 （ MySql句柄 ， 用户名 ， 主机 ）
- 功能说明：查找一个用户。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必填 | 文本型 | 本参数是欲查找的用户名。 |
| 主机 | 必填 | 文本型 | 本参数是与用户名相关联的主机名，实际对应mysql.user表中的host字段。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd36.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

查找一个用户，在操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**查找用户 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

查找一个用户。成功返回真，失败返回假。

*语法：*  逻辑型  查找用户 （MySql句柄， 用户名， 主机）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必需的 ； 文本型。本参数是欲查找的用户名。 |
| 主机 | 必需的 ； 文本型。本参数是与用户名相关联的主机名，实际对应mysql.user表中的host字段。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd36.files/image003.gif)

说明：

       查找一个用户，在操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E7%94%A8%E6%88%B7%E6%93%8D%E4%BD%9C.e)

---

### 取用户列表

- 原文链接：https://esdn.ijingyi.com/title-13873.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取用户列表 （ MySql句柄 ）
- 功能说明：取得用户名列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。注：记录集字段0为主机名，1是用户名，2是密码等，详情请参考mysql.user表。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd37.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得用户名列表，操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**取用户列表 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

取得用户名列表。成功返回真，失败返回假。结果可以通过“取记录集”取得。注：记录集字段0为主机名，1是用户名，2是密码等，详情请参考mysql.user表。

*语法：*  逻辑型  取用户列表 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd37.files/image003.gif)

说明：

       取得用户名列表，操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E7%94%A8%E6%88%B7%E6%93%8D%E4%BD%9C.e)

---

### 修改用户

- 原文链接：https://esdn.ijingyi.com/title-13874.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 修改用户 （ MySql句柄 ， 用户名 ， 主机名 ， 库名 ， 表名 ， 权限 ）
- 功能说明：修改一个用户。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必填 | 文本型 | 本参数是将要修改的用户名。 |
| 主机名 | 必填 | 文本型 | 本参数是与新用户相关联的主机名。 |
| 库名 | 必填 | 文本型 | 本参数是用户操作的新库，如果为空文本或“*”，则为所有库。 |
| 表名 | 必填 | 文本型 | 本参数是用户操作的新表，当库名不为空文本或“*”时本参数可以为空文本或“*”即所有表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 权限 | 必填 | 整数型 | 本参数是用户的新权限。如果为零则无任何权限。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd38.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改用户名，操作之前确认有足够的权限，否则操作将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**修改用户 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

修改一个用户。成功返回真，失败返回假。

*语法：*  逻辑型  修改用户 （MySql句柄， 用户名， 主机名， 库名， 表名， 权限）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 用户名 | 必需的 ； 文本型。本参数是将要修改的用户名。 |
| 主机名 | 必需的 ； 文本型。本参数是与新用户相关联的主机名。 |
| 库名 | 必需的 ； 文本型。本参数是用户操作的新库，如果为空文本或“*”，则为所有库。 |
| 表名 | 必需的 ； 文本型。本参数是用户操作的新表，当库名不为空文本或“*”时本参数可以为空文本或“*”即所有表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 权限 | 必需的 ； 整数型。本参数是用户的新权限。如果为零则无任何权限。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd38.files/image003.gif)

说明：

       修改用户名，操作之前确认有足够的权限，否则操作将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E7%94%A8%E6%88%B7%E6%93%8D%E4%BD%9C.e)

---

### 建立索引

- 原文链接：https://esdn.ijingyi.com/title-13875.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 建立索引 （ MySql句柄 ， 表名 ， 列名 ， 索引名 ）
- 功能说明：建立一个索引。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要建立索引的表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 列名 | 必填 | 文本型 | 本参数是将要建立索引使用的列（字段）名。 |
| 索引名 | 必填 | 文本型 | 本参数是将要建立的索引名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd39.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd39.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为一个字段创建一个索引，索引必须为文本，不能为文本型数字，比如：“ 1 ”否则将失败。 参见： 例程 1

**完整正文（站点原文转换）**

**建立索引 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

建立一个索引。成功返回真，失败返回假。

*语法：*  逻辑型  建立索引 （MySql句柄， 表名， 列名， 索引名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要建立索引的表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 列名 | 必需的 ； 文本型。本参数是将要建立索引使用的列（字段）名。 |
| 索引名 | 必需的 ； 文本型。本参数是将要建立的索引名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd39.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd39.files/image004.gif)

说明：

       为一个字段创建一个索引，索引必须为文本，不能为文本型数字，比如：“1”否则将失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 删除索引

- 原文链接：https://esdn.ijingyi.com/title-13876.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除索引 （ MySql句柄 ， 表名 ， 索引名 ）
- 功能说明：删除一个索引。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是将要删除的索引所在的表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 索引名 | 必填 | 文本型 | 本参数是将要删除的索引。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd40.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd40.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除一个索引，该索引必须存在，否则将删除失败。 参见： 例程 1

**完整正文（站点原文转换）**

**删除索引 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

删除一个索引。成功返回真，失败返回假。

*语法：*  逻辑型  删除索引 （MySql句柄， 表名， 索引名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是将要删除的索引所在的表，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 索引名 | 必需的 ； 文本型。本参数是将要删除的索引。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd40.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd40.files/image003.gif)

说明：

       删除一个索引，该索引必须存在，否则将删除失败。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 取错误文本

- 原文链接：https://esdn.ijingyi.com/title-13877.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 取错误文本 （ MySql句柄 ， 错误信息 ）
- 功能说明：有错误发生返回真，并填充错误信息，没错误发生返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 错误信息 | 必填 | 文本型，参数数据只能提供变量 | 本参数为错误信息字符串。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd41.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd41.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

如果 MySql 数据库执行错误，可以用本命令取回执行错误的文本信息。 参见： 例程 1

**完整正文（站点原文转换）**

**取错误文本 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

有错误发生返回真，并填充错误信息，没错误发生返回假。

*语法：*  逻辑型  取错误文本 （MySql句柄， 错误信息）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 错误信息 | 必需的 ； 文本型，参数数据只能提供变量。本参数为错误信息字符串。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd41.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd41.files/image004.gif)

说明：

       如果MySql数据库执行错误，可以用本命令取回执行错误的文本信息。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 开始事务

- 原文链接：https://esdn.ijingyi.com/title-13878.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 开始事务 （ MySql句柄 ）
- 功能说明：开始一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd42.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

开始纪录一个事务。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。 参见： 例程 1

**完整正文（站点原文转换）**

**开始事务 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

开始一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

*语法：*  逻辑型  开始事务 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd42.files/image002.gif)

说明：

       开始纪录一个事务。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 保存事务

- 原文链接：https://esdn.ijingyi.com/title-13879.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 保存事务 （ MySql句柄 ）
- 功能说明：保存一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd43.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd43.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

保存从开始事务到现在的操作。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。 参见： 例程 1

**完整正文（站点原文转换）**

**保存事务 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

保存一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

*语法：*  逻辑型  保存事务 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd43.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd43.files/image004.gif)

说明：

       保存从开始事务到现在的操作。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 回滚事务

- 原文链接：https://esdn.ijingyi.com/title-13880.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 回滚事务 （ MySql句柄 ）
- 功能说明：回滚一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd44.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd44.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

回滚保存事务保存的事务。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。 参见： 例程 1

**完整正文（站点原文转换）**

**回滚事务 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

回滚一件事务。成功返回真，失败返回假。注意 事务不可以用于MyISAM数据表类型，但是返回值为真。关于数据表类型设置请参考相关MYSQL资料。

*语法：*  逻辑型  回滚事务 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd44.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd44.files/image004.gif)

说明：

       回滚保存事务保存的事务。事务是对数据库所做的一系列改变。我们完成一项任务往往需要多步操作，而当其中一步出错后，以前的所有操作应取消，这时我们必需使用事务。首先开始事务，开始执行所有操作，当所有操作全部结束时，我们就保存事务。当发生错误时，我们就回滚事务。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 到MYSQL文本

- 原文链接：https://esdn.ijingyi.com/title-13881.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：文本型
- 语法：文本型 到MYSQL文本 （ 易语言类型数据 ， 时间类型 ）
- 功能说明：从易语言中的数据类型转换到可以被MYSQL识别的文本。可以将易语言中的时间，逻辑型到MYSQL中相应数据类型，转换成功返回MYSQL可以识别的文本，失败返回空文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 易语言类型数据 | 必填 | 通用型 | 本参数是易语言中时间日期型或逻辑型的数据。 |
| 时间类型 | 必填 | 整数型，初始值为“12” | 本参数是要转换到MYSQL的时间与日期类的类型常量，如#MYSQL日期，#MYSQL时间， #MYSQL日期与时间型，#MYSQL年份型等。注意:当“易语言类型数据”为日期时间型时，本参数有效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd45.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将 易语言 的时间数据类型转换到 MySql 认可的时间数据类型。 参见： 例程 1

**完整正文（站点原文转换）**

**到MYSQL文本 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

从易语言中的数据类型转换到可以被MYSQL识别的文本。可以将易语言中的时间，逻辑型到MYSQL中相应数据类型，转换成功返回MYSQL可以识别的文本，失败返回空文本。

*语法：*  文本型  到MYSQL文本 （易语言类型数据， 时间类型）

| 参数名 | 描 述 |
| --- | --- |
| 易语言类型数据 | 必需的 ； 通用型。本参数是易语言中时间日期型或逻辑型的数据。 |
| 时间类型 | 必需的 ； 整数型，初始值为“12”。本参数是要转换到MYSQL的时间与日期类的类型常量，如#MYSQL日期，#MYSQL时间， #MYSQL日期与时间型，#MYSQL年份型等。注意:当“易语言类型数据”为日期时间型时，本参数有效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd45.files/image001.gif)

说明：

       将易语言的时间数据类型转换到MySql认可的时间数据类型。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 写字节集字段

- 原文链接：https://esdn.ijingyi.com/title-13882.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 写字节集字段 （ MySql句柄 ， 表名 ， 字段名 ， ［ 条件 ］ ， ［ 字节集 ］ ）
- 功能说明：写字节集字段。本命令只用于写字段类型为字节集的字段，如果条件参数为空(或空字符串)则增加一条新记录，如果条件参数为一个条件字符串则更新符合条件的记录。注意:一次写入数据的大小MYSQL做了限制，如果需要改动请参考相应MYSQL手册，对MYSQL服务器进行调整。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必填 | 文本型 | 本参数是您要更新数据的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 字段名 | 必填 | 文本型 | 本参数是待写入字段名称，注意此字段的字段类型必须是字节集，如果为中文字段名请在字段名两边加“`”。 |
| 条件 | 可空 | 文本型 | 本参数是查找符合条件的记录。如果为“”空字符串那么将添加一条记录。例如当字段name的内容“jack”时更新记录: name='jack'，如果为中文字段名请在字段名两边加“`”。 |
| 字节集 | 可空 | 字节集 | 本参数是待写入的字节集：如果本参数被省略且对应字段可以为NULL，则将该字段值置为NULL；如果本参数未被省略且为空字节集，则将该字段值清空。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将一个字节集数据写入到字节集字段中，条件如果不填，将增加一个字段把数据写入，如果条件为“”将更新所有字段，否则根据条件来更新相应字段。 参见： 例程 1

**完整正文（站点原文转换）**

**写字节集字段 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

写字节集字段。本命令只用于写字段类型为字节集的字段，如果条件参数为空(或空字符串)则增加一条新记录，如果条件参数为一个条件字符串则更新符合条件的记录。注意:一次写入数据的大小MYSQL做了限制，如果需要改动请参考相应MYSQL手册，对MYSQL服务器进行调整。

*语法：*  逻辑型  写字节集字段 （MySql句柄， 表名， 字段名， ［条件］， ［字节集］）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 表名 | 必需的 ； 文本型。本参数是您要更新数据的表的名称，如果为中文表名请在表名两边加“`”，如：`姓名`。 |
| 字段名 | 必需的 ； 文本型。本参数是待写入字段名称，注意此字段的字段类型必须是字节集，如果为中文字段名请在字段名两边加“`”。 |
| 条件 | 可选的 ； 文本型。本参数是查找符合条件的记录。如果为“”空字符串那么将添加一条记录。例如当字段name的内容“jack”时更新记录: name='jack'，如果为中文字段名请在字段名两边加“`”。 |
| 字节集 | 可选的 ； 字节集。本参数是待写入的字节集：如果本参数被省略且对应字段可以为NULL，则将该字段值置为NULL；如果本参数未被省略且为空字节集，则将该字段值清空。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd46.files/image001.gif)

说明：

       将一个字节集数据写入到字节集字段中，条件如果不填，将增加一个字段把数据写入，如果条件为“”将更新所有字段，否则根据条件来更新相应字段。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/%E5%86%99%E5%AD%97%E8%8A%82%E9%9B%86%E5%AD%97%E6%AE%B5.e)

---

### 字段是否为空

- 原文链接：https://esdn.ijingyi.com/title-13883.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 字段是否为空 （ 记录集句柄 ， 字段 ）
- 功能说明：判断记录集中当前行的某个字段是否为空，不为空返回真，为空返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 记录集句柄 | 必填 | 整数型 | 本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段 | 必填 | 通用型 | 本参数指定您想要读取的字段，可以是字段名称或是字段序号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd47.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd47.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

通过判断记录集中某字段是否为空，进行不同操作。 参见： 例程 1

**完整正文（站点原文转换）**

**字段是否为空 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

判断记录集中当前行的某个字段是否为空，不为空返回真，为空返回假。

*语法：*  逻辑型  字段是否为空 （记录集句柄， 字段）

| 参数名 | 描 述 |
| --- | --- |
| 记录集句柄 | 必需的 ； 整数型。本参数必须是本进程调用“取记录集”命令得到的返回值。 |
| 字段 | 必需的 ； 通用型。本参数指定您想要读取的字段，可以是字段名称或是字段序号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd47.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd47.files/image002.gif)

说明：

       通过判断记录集中某字段是否为空，进行不同操作。

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql%E6%95%B0%E6%8D%AE%E5%BA%93%E4%BE%8B%E7%A8%8B.e)

---

### 选择库

- 原文链接：https://esdn.ijingyi.com/title-13884.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 选择库 （ MySql句柄 ， 库名 ）
- 功能说明：选择一个数据库为当前用户默认使用的数据库，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必填 | 文本型 | 本参数为要选择的数据库名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd48.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

决定当前操作的库。 参见 : 例程 . e

**完整正文（站点原文转换）**

**选择库 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

选择一个数据库为当前用户默认使用的数据库，成功返回真，失败返回假。

*语法：*  逻辑型  选择库 （MySql句柄， 库名）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |
| 库名 | 必需的 ； 文本型。本参数为要选择的数据库名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd48.files/image001.gif)

说明：

       决定当前操作的库。

参见:[例程 . e](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql.e)

---

### 关闭MySql

- 原文链接：https://esdn.ijingyi.com/title-13885.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：逻辑型
- 语法：逻辑型 关闭MySql （ MySql句柄 ）
- 功能说明：让数据库服务器关闭。连接的用户必须有shutdown权限，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd49.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

可以让服务器关闭，回来可取得成功消息。 参见 : 例程 . e

**完整正文（站点原文转换）**

**关闭MySql 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

让数据库服务器关闭。连接的用户必须有shutdown权限，成功返回真，失败返回假。

*语法：*  逻辑型  关闭MySql （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/cmd49.files/image001.gif)

说明：

       可以让服务器关闭，回来可取得成功消息。

参见:[例程 . e](https://esdn.ijingyi.com/source/plugin/eknow/resource/mysql//mysql/MySql.e)

---

### 取影响行数

- 原文链接：https://esdn.ijingyi.com/title-13886.html
- 操作系统支持：Windows、Linux
- 所属类别：MySql操作
- 返回值类型：长整数型
- 语法：长整数型 取影响行数 （ MySql句柄 ）
- 功能说明：返回一个长整数，表示刚才某个非查询SQL语句（update,delete,insert）执行后所影响到的记录数，即：返回上次UPDATE更改的行数，上次DELETE删除的行数，或上次INSERT语句插入的行数。返回值大于0表明受影响或检索的行数；返回值为0表示UPDATE语句未更新记录，在查询中没有与WHERE匹配的行，或未执行查询；返回值为-1表示未取到实际影响行数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MySql句柄 | 必填 | 整数型 | 本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取影响行数 命令**   操作系统支持：Windows、Linux    所属类别：[MySql操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/ct0.htm)

返回一个长整数，表示刚才某个非查询SQL语句（update,delete,insert）执行后所影响到的记录数，即：返回上次UPDATE更改的行数，上次DELETE删除的行数，或上次INSERT语句插入的行数。返回值大于0表明受影响或检索的行数；返回值为0表示UPDATE语句未更新记录，在查询中没有与WHERE匹配的行，或未执行查询；返回值为-1表示未取到实际影响行数。

*语法：*  长整数型  取影响行数 （MySql句柄）

| 参数名 | 描 述 |
| --- | --- |
| MySql句柄 | 必需的 ； 整数型。本参数必须是本进程调用“连接MySql”命令得到的返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

## 命令分类：其他数据类型（2 条）

### 字段信息类型

- 原文链接：https://esdn.ijingyi.com/title-13837.html
- 操作系统支持：Windows、Linux 跳至： MySQL支持库
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 类型 | 待核实 | 待核实 | 整数型； 初始值为 1 。本结构的类型 #字段基本类型 或 #字段附加类型。为#字段基本类型时主键与索引将被忽略；为#字段附加类型时，除主键与索引外其它元素将被忽略。 |
| 字段名 | 待核实 | 待核实 | 文本型； 如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |
| 字段类型 | 待核实 | 待核实 | 整数型； 详细类型说明，请参见本支持库定义的字段类型常量。 |
| 列内容为空 | 待核实 | 待核实 | 逻辑型； 如果为真则允许列内容为空，如果为假则列内容不能为空。 |
| 列数据默认值 | 待核实 | 待核实 | 文本型； 列内容的默认值，如果没有默认值为空字符串。 |
| 自增量标记 | 待核实 | 待核实 | 逻辑型； 如果为真则当前字段具有自增量属性，即在插入新数据时该字段会在原有最大值的基础上自动增加1，设置次属性。详细介绍请参考MYSQL手册。 |
| 附加类型信息 | 待核实 | 待核实 | 整数型； 附加与字段的属性，其值为 #最大长度 #无符号 #以0填充 #二进制。可以把属性相加，如 #无符号 + #以0填充。属性具体含义请参见MYSQL手册。 |
| 附加内容 | 待核实 | 待核实 | 文本型； 如果附加类型信息具有 #最大长度 类型那么这个参数为最大长度，如果字段类型为 #枚举 或 #集合 那么这个参数为枚举或集合的取值范围，如果本结构类型为 #字段附加类型，并且为索引。那么本成员变量为索引名。 |
| 主键 | 待核实 | 待核实 | 文本型； 设置为主键的字段名，如“fieldname”。为#附加类型时有效，每个表中只可以有一个主键，具体作用请参见MYSQL手册。 |
| 索引 | 待核实 | 待核实 | 文本型； 设置为索引的字段名可以有多个，通过“,”分割，如“fieldname1,fieldname2,fieldname3”。为#附加类型时有效，具体作用请参见MYSQL手册。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**字段信息类型 普通类型**   操作系统支持：Windows、Linux    跳至：[MySQL支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 类型 | 整数型； 初始值为 1 。本结构的类型 #字段基本类型 或 #字段附加类型。为#字段基本类型时主键与索引将被忽略；为#字段附加类型时，除主键与索引外其它元素将被忽略。 |
| 字段名 | 文本型； 如果为中文字段名请在字段名两边加“`”，如：`姓名`。 |
| 字段类型 | 整数型； 详细类型说明，请参见本支持库定义的字段类型常量。 |
| 列内容为空 | 逻辑型； 如果为真则允许列内容为空，如果为假则列内容不能为空。 |
| 列数据默认值 | 文本型； 列内容的默认值，如果没有默认值为空字符串。 |
| 自增量标记 | 逻辑型； 如果为真则当前字段具有自增量属性，即在插入新数据时该字段会在原有最大值的基础上自动增加1，设置次属性。详细介绍请参考MYSQL手册。 |
| 附加类型信息 | 整数型； 附加与字段的属性，其值为 #最大长度 #无符号 #以0填充 #二进制。可以把属性相加，如 #无符号 + #以0填充。属性具体含义请参见MYSQL手册。 |
| 附加内容 | 文本型； 如果附加类型信息具有 #最大长度 类型那么这个参数为最大长度，如果字段类型为 #枚举 或 #集合 那么这个参数为枚举或集合的取值范围，如果本结构类型为 #字段附加类型，并且为索引。那么本成员变量为索引名。 |
| 主键 | 文本型； 设置为主键的字段名，如“fieldname”。为#附加类型时有效，每个表中只可以有一个主键，具体作用请参见MYSQL手册。 |
| 索引 | 文本型； 设置为索引的字段名可以有多个，通过“,”分割，如“fieldname1,fieldname2,fieldname3”。为#附加类型时有效，具体作用请参见MYSQL手册。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 表更改信息类型

- 原文链接：https://esdn.ijingyi.com/title-13838.html
- 操作系统支持：Windows、Linux 跳至： MySQL支持库
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 字段名 | 待核实 | 待核实 | 文本型； 当修改类型为#修改字段时使用本成员作为旧字段名。当为#删除字段时本成员为准备删除的字段名。 |
| 字段信息 | 待核实 | 待核实 | 文本型； 当修改类型为#增加索引时本成员作为索引使用的字段。如果需要使用多个字段可以通过“,“分割。如”fieldname1,fieldname2,fieldname3“。 |
| 索引名 | 待核实 | 待核实 | 文本型； 当修改类型为#增加索引或#删除索引时本成员作为索引名使用。 |
| 主键名 | 待核实 | 待核实 | 文本型； 当修改类型为#增加主键时本成员作为主键名使用。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**表更改信息类型 普通类型**   操作系统支持：Windows、Linux    跳至：[MySQL支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/mysql/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 字段名 | 文本型； 当修改类型为#修改字段时使用本成员作为旧字段名。当为#删除字段时本成员为准备删除的字段名。 |
| 字段信息 | 文本型； 当修改类型为#增加索引时本成员作为索引使用的字段。如果需要使用多个字段可以通过“,“分割。如”fieldname1,fieldname2,fieldname3“。 |
| 索引名 | 文本型； 当修改类型为#增加索引或#删除索引时本成员作为索引名使用。 |
| 主键名 | 文本型； 当修改类型为#增加主键时本成员作为主键名使用。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
