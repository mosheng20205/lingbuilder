# XML解析支持库 2.2 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-12457.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.2）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**XML解析支持库2.2版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

提供对W3C标准XML文件的读写支持。目前本支持库仅支持W3C标准的XML文件，不支持DTD。支持BASE64编码文本和CDATA文本，编码方面仅支持ANSI、GB2312、GB18030。

操作系统支持： Windows、Linux

**命令类别：**

| 匹配通配符 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| XML树 |  |  |  |
| --- | --- | --- | --- |

## 命令分类：命令类别（1 条）

### 匹配通配符

- 原文链接：https://esdn.ijingyi.com/title-12462.html
- 操作系统支持：Windows、Linux
- 所属类别：匹配通配符
- 返回值类型：逻辑型
- 语法：逻辑型 匹配通配符 （ 匹配文本 ， 常量文本 ）
- 功能说明：该方法第一个参数包含通配符（*,?），通配符“*”代表零个或多个任意字符，通配符“?”代表一个任意字符，第二个参数是一个不包含通配符的常量字符串，该方法得到匹配字符串和常量字符串的比较结果。比较相等返回真，不等返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 匹配文本 | 必填 | 文本型 | 包含通配符的文本。 |
| 常量文本 | 必填 | 文本型 | 不包含通配符的普通文本。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd23.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

可以使用通配符来代替某些文字，通配符使用方式等同 DOS 下通配符的使用。 参考： 例程1

**完整正文（站点原文转换）**

**匹配通配符 命令**   操作系统支持：Windows、Linux    所属类别：[匹配通配符](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/ct0.htm)

该方法第一个参数包含通配符（*,?），通配符“*”代表零个或多个任意字符，通配符“?”代表一个任意字符，第二个参数是一个不包含通配符的常量字符串，该方法得到匹配字符串和常量字符串的比较结果。比较相等返回真，不等返回假。

*语法：*  逻辑型  匹配通配符 （匹配文本， 常量文本）

| 参数名 | 描 述 |
| --- | --- |
| 匹配文本 | 必需的 ； 文本型。包含通配符的文本。 |
| 常量文本 | 必需的 ； 文本型。不包含通配符的普通文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd23.files/image002.gif)

说明

可以使用通配符来代替某些文字，通配符使用方式等同DOS下通配符的使用。

参考：[例程1](http://esdn.125.la/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

## 命令分类：其他数据类型（33 条）

### 创建

- 原文链接：https://esdn.ijingyi.com/title-12464.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．创建 （ 根节点名 ）
- 功能说明：在内存中创建一个新的XML的解析树。如果XML树已经创建，则自动释放当前XML树，然后执行创建操作。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 根节点名 | 必填 | 文本型 | 本参数提供所要新建解析树根节点的名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd0.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd0.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在内存中创建一个新的树结构。 参考： 例程1

**完整正文（站点原文转换）**

**创建 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

在内存中创建一个新的XML的解析树。如果XML树已经创建，则自动释放当前XML树，然后执行创建操作。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．创建 （根节点名）

| 参数名 | 描 述 |
| --- | --- |
| 根节点名 | 必需的 ； 文本型。本参数提供所要新建解析树根节点的名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd0.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd0.files/image002.gif)

说明

在内存中创建一个新的树结构。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 导入

- 原文链接：https://esdn.ijingyi.com/title-12465.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．导入 （ XML文件名或字节集 ）
- 功能说明：从XML文件或字节集中导入数据，并根据该数据重建XML树（如果XML树已经创建，则自动释放当前XML树，然后执行导入操作）。该方法执行成功返回真，执行失败返回假。本方法将对导入的数据进行必要的语法检查，如果发现非法的数据格式，将直接返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| XML文件名或字节集 | 必填 | 通用型 | 指定欲导入的XML文件名称或欲导入的XML字节集数据。如果参数类型为“文本型”，则从文件导入（文件名可以是绝对路径名，也可以是相对路径名）；如果参数类型为“字节集型”，则从字节集导入；其它类型不予处理。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd1.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd1.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将一个已有的 XML 树文件导入到内存中，导入内存之后的树结构和导入的文件没有任何关联，当内存中的树结构被改变，导入的文件不会被改变。 参考： 例程1

**完整正文（站点原文转换）**

**导入 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

从XML文件或字节集中导入数据，并根据该数据重建XML树（如果XML树已经创建，则自动释放当前XML树，然后执行导入操作）。该方法执行成功返回真，执行失败返回假。本方法将对导入的数据进行必要的语法检查，如果发现非法的数据格式，将直接返回假。

*语法：*  逻辑型  *XML树*．导入 （XML文件名或字节集）

| 参数名 | 描 述 |
| --- | --- |
| XML文件名或字节集 | 必需的 ； 通用型。指定欲导入的XML文件名称或欲导入的XML字节集数据。如果参数类型为“文本型”，则从文件导入（文件名可以是绝对路径名，也可以是相对路径名）；如果参数类型为“字节集型”，则从字节集导入；其它类型不予处理。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd1.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd1.files/image004.gif)

说明

将一个已有的XML树文件导入到内存中，导入内存之后的树结构和导入的文件没有任何关联，当内存中的树结构被改变，导入的文件不会被改变。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 导出到文件

- 原文链接：https://esdn.ijingyi.com/title-12466.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．导出到文件 （ XML文件名 ， ［ 字符集 ］ ， ［ 换行文本 ］ ， ［ 缩进文本 ］ ）
- 功能说明：保存当前XML树的全部数据到指定的文件。该方法执行成功返回真，执行失败返回假。注：可使用“取XML数据()”获取相同的字节集数据而不必保存到文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| XML文件名 | 必填 | 文本型 | 欲导出的XML文件名称。该文件名可以是绝对路径名，也可以是相对路径名。注意：如果指定的文件已经存在，原有文件内容将被覆盖。 |
| 字符集 | 可空 | 文本型 | 指定欲使用的XML字符集属性，默认为“gb18030”。注意，本参数仅用于对“ ”节点的“encoding”属性赋值，不据此进行编码转换。 |
| 换行文本 | 可空 | 文本型 | 用于格式化XML文本，默认为 #换行符。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |
| 缩进文本 | 可空 | 文本型 | 用于格式化XML文本，默认为TAB键字符文本。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd2.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd2.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将内存中的树结构保存到文件中，文件扩展名为 XML 。 参考： 例程1

**完整正文（站点原文转换）**

**导出到文件 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

保存当前XML树的全部数据到指定的文件。该方法执行成功返回真，执行失败返回假。注：可使用“取XML数据()”获取相同的字节集数据而不必保存到文件。

*语法：*  逻辑型  *XML树*．导出到文件 （XML文件名， ［字符集］， ［换行文本］， ［缩进文本］）

| 参数名 | 描 述 |
| --- | --- |
| XML文件名 | 必需的 ； 文本型。欲导出的XML文件名称。该文件名可以是绝对路径名，也可以是相对路径名。注意：如果指定的文件已经存在，原有文件内容将被覆盖。 |
| 字符集 | 可选的 ； 文本型。指定欲使用的XML字符集属性，默认为“gb18030”。注意，本参数仅用于对“ ”节点的“encoding”属性赋值，不据此进行编码转换。 |
| 换行文本 | 可选的 ； 文本型。用于格式化XML文本，默认为 #换行符。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |
| 缩进文本 | 可选的 ； 文本型。用于格式化XML文本，默认为TAB键字符文本。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd2.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd2.files/image004.gif)

说明

将内存中的树结构保存到文件中，文件扩展名为XML。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 释放

- 原文链接：https://esdn.ijingyi.com/title-12467.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：无返回值
- 语法：无返回值 XML树 ．释放 （ ）
- 功能说明：释放当前XML树，释放后该XML树将不再可用。如果XML树在离开作用域前没有释放，系统会自动释放XML树。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd3.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd3.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将内存中创建的 XML 树结构释放掉。 参考： 例程1

**完整正文（站点原文转换）**

**释放 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

释放当前XML树，释放后该XML树将不再可用。如果XML树在离开作用域前没有释放，系统会自动释放XML树。

*语法：*  无返回值  *XML树*．释放 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd3.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd3.files/image002.gif)

说明

将内存中创建的XML树结构释放掉。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取根节点名

- 原文链接：https://esdn.ijingyi.com/title-12468.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取根节点名 （ 根节点名称 ）
- 功能说明：取得当前解析树根节点的名称。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 根节点名称 | 必填 | 文本型，参数数据只能提供变量 | 本参数作为“取根节点名”命令的填充参数。“取根节点名”命令执行完毕后，该参数的内容为当前解析树根节点的名称。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd4.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd4.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树的根节点名称。 参考： 例程1

**完整正文（站点原文转换）**

**取根节点名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得当前解析树根节点的名称。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取根节点名 （根节点名称）

| 参数名 | 描 述 |
| --- | --- |
| 根节点名称 | 必需的 ； 文本型，参数数据只能提供变量。本参数作为“取根节点名”命令的填充参数。“取根节点名”命令执行完毕后，该参数的内容为当前解析树根节点的名称。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd4.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd4.files/image004.gif)

说明

取得XML树的根节点名称。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取子节点数

- 原文链接：https://esdn.ijingyi.com/title-12469.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取子节点数 （ 节点全路径 ， 子节点个数 ）
- 功能说明：取得参数节点的所有子节点的个数。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 子节点个数 | 必填 | 整数型，参数数据只能提供变量 | 本参数作为“取子节点数”命令的填充参数。“取子节点数”命令执行完毕后，该参数内容为子节点的个数。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd5.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd5.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树结构某节点下子节点的数量。 参考： 例程1

**完整正文（站点原文转换）**

**取子节点数 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的所有子节点的个数。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取子节点数 （节点全路径， 子节点个数）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 子节点个数 | 必需的 ； 整数型，参数数据只能提供变量。本参数作为“取子节点数”命令的填充参数。“取子节点数”命令执行完毕后，该参数内容为子节点的个数。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd5.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd5.files/image004.gif)

说明

取得XML树结构某节点下子节点的数量。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取子节点名

- 原文链接：https://esdn.ijingyi.com/title-12470.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取子节点名 （ 节点全路径 ， 子节点名称数组 ）
- 功能说明：取得参数节点的所有子节点名称。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 子节点名称数组 | 必填 | 文本型，参数数据只能提供变量数组 | 本参数作为“取子节点名”命令的填充参数。“取子节点名”命令执行完毕后，该参数内容为所有子节点名称组成的数组。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd6.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd6.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取出 XML 树结构某节点下子节点的名称，由于子节点可以为多个，所以参数二需要提供 0 成员数组。 参考： 例程1

**完整正文（站点原文转换）**

**取子节点名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的所有子节点名称。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取子节点名 （节点全路径， 子节点名称数组）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 子节点名称数组 | 必需的 ； 文本型，参数数据只能提供变量数组。本参数作为“取子节点名”命令的填充参数。“取子节点名”命令执行完毕后，该参数内容为所有子节点名称组成的数组。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd6.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd6.files/image004.gif)

说明

取出XML树结构某节点下子节点的名称，由于子节点可以为多个，所以参数二需要提供0成员数组。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取节点值

- 原文链接：https://esdn.ijingyi.com/title-12471.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取节点值 （ 节点全路径 ， 节点值 ）
- 功能说明：取得参数节点的值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 节点值 | 必填 | 文本型，参数数据只能提供变量 | 本参数作为“取节点值”命令的填充参数。“取节点值”命令执行完毕后，该参数的内容为节点的值。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd7.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd7.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树结构某节点下的节点值。 参考： 例程1

**完整正文（站点原文转换）**

**取节点值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取节点值 （节点全路径， 节点值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 节点值 | 必需的 ； 文本型，参数数据只能提供变量。本参数作为“取节点值”命令的填充参数。“取节点值”命令执行完毕后，该参数的内容为节点的值。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd7.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd7.files/image004.gif)

说明

取得XML树结构某节点下的节点值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取二进制值

- 原文链接：https://esdn.ijingyi.com/title-12472.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取二进制值 （ 节点全路径 ， 二进制节点值 ）
- 功能说明：取得参数节点的二进制数据的值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 二进制节点值 | 必填 | 字节集，参数数据只能提供变量 | 本参数作为“取二进制值”命令的填充参数。“取二进制值”命令执行完毕后，该参数内容为节点的二进制值。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd8.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd8.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树结构某节点下节点的二进制值。 参考： 例程1

**完整正文（站点原文转换）**

**取二进制值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的二进制数据的值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取二进制值 （节点全路径， 二进制节点值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 二进制节点值 | 必需的 ； 字节集，参数数据只能提供变量。本参数作为“取二进制值”命令的填充参数。“取二进制值”命令执行完毕后，该参数内容为节点的二进制值。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd8.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd8.files/image004.gif)

说明

取得XML树结构某节点下节点的二进制值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取全部属性名

- 原文链接：https://esdn.ijingyi.com/title-12473.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取全部属性名 （ 节点全路径 ， 属性名称数组 ）
- 功能说明：取得参数节点的所有属性的名称。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名称数组 | 必填 | 文本型，参数数据只能提供变量数组 | 本参数作为“取全部属性名”命令的填充参数。“取全部属性名”命令执行完毕后，该参数内容为节点的所有属性名称组成的数组。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd9.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd9.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树结构某节点下节点的所有属性名称。 参考： 例程1

**完整正文（站点原文转换）**

**取全部属性名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的所有属性的名称。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取全部属性名 （节点全路径， 属性名称数组）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名称数组 | 必需的 ； 文本型，参数数据只能提供变量数组。本参数作为“取全部属性名”命令的填充参数。“取全部属性名”命令执行完毕后，该参数内容为节点的所有属性名称组成的数组。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd9.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd9.files/image004.gif)

说明

取得XML树结构某节点下节点的所有属性名称。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取属性值

- 原文链接：https://esdn.ijingyi.com/title-12474.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．取属性值 （ 节点全路径 ， 属性名 ， 属性值 ）
- 功能说明：取得参数节点的特定属性的值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必填 | 文本型 | 本参数提供“取属性值”命令所需要的节点属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 属性值 | 必填 | 文本型，参数数据只能提供变量 | 本参数作为“取属性值”命令的填充参数。“取属性值”命令执行完毕后，该参数内容为节点属性的值。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd10.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd10.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 XML 树结构某节点下节点的属性值。 参考： 例程1

**完整正文（站点原文转换）**

**取属性值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的特定属性的值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．取属性值 （节点全路径， 属性名， 属性值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必需的 ； 文本型。本参数提供“取属性值”命令所需要的节点属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 属性值 | 必需的 ； 文本型，参数数据只能提供变量。本参数作为“取属性值”命令的填充参数。“取属性值”命令执行完毕后，该参数内容为节点属性的值。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd10.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd10.files/image004.gif)

说明

取得XML树结构某节点下节点的属性值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 插入节点

- 原文链接：https://esdn.ijingyi.com/title-12475.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．插入节点 （ 父节点全路径 ， 新节点名 ， 新节点值 ， ［ 使用CDATA ］ ）
- 功能说明：新建一个节点，并把该参数节点作为该新节点的父节点，然后插入到XML树中。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 父节点全路径 | 必填 | 文本型 | 本参数为要插入节点的父节点在解析树中的全路径，格式有两种形式，一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”，另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”，另外这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点名 | 必填 | 文本型 | 本参数提供“插入节点”命令所需要的新插入节点的名称。 |
| 新节点值 | 必填 | 文本型 | 本参数作为“插入节点”命令所需要的新插入节点的值。 |
| 使用CDATA | 可空 | 逻辑型 | 如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd11.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd11.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在 XML 树结构某节点下插入新的节点。 参考： 例程1

**完整正文（站点原文转换）**

**插入节点 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

新建一个节点，并把该参数节点作为该新节点的父节点，然后插入到XML树中。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．插入节点 （父节点全路径， 新节点名， 新节点值， ［使用CDATA］）

| 参数名 | 描 述 |
| --- | --- |
| 父节点全路径 | 必需的 ； 文本型。本参数为要插入节点的父节点在解析树中的全路径，格式有两种形式，一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”，另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”，另外这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点名 | 必需的 ； 文本型。本参数提供“插入节点”命令所需要的新插入节点的名称。 |
| 新节点值 | 必需的 ； 文本型。本参数作为“插入节点”命令所需要的新插入节点的值。 |
| 使用CDATA | 可选的 ； 逻辑型。如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd11.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd11.files/image004.gif)

说明

在XML树结构某节点下插入新的节点。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 插入属性

- 原文链接：https://esdn.ijingyi.com/title-12476.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．插入属性 （ 节点全路径 ， 新属性名 ， 属性值 ）
- 功能说明：在参数节点中插入一个新的属性，并给属性赋值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新属性名 | 必填 | 文本型 | 本参数提供“插入属性”命令欲插入的节点新属性的名称。 |
| 属性值 | 必填 | 文本型 | 本参数作为“插入属性”命令欲插入的节点新属性的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd12.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd12.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在 XML 树结构中某节点插入节点值，如果该节点不存在，插入将失败。 参考： 例程1

**完整正文（站点原文转换）**

**插入属性 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

在参数节点中插入一个新的属性，并给属性赋值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．插入属性 （节点全路径， 新属性名， 属性值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新属性名 | 必需的 ； 文本型。本参数提供“插入属性”命令欲插入的节点新属性的名称。 |
| 属性值 | 必需的 ； 文本型。本参数作为“插入属性”命令欲插入的节点新属性的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd12.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd12.files/image004.gif)

说明

在XML树结构中某节点插入节点值，如果该节点不存在，插入将失败。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 删除节点

- 原文链接：https://esdn.ijingyi.com/title-12477.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．删除节点 （ 节点全路径 ）
- 功能说明：该方法会删除给定节点和他的所有子节点，该方法不允许删除根节点。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd13.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd13.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除指定节点，该节点下的字节点将被全部删除，该命令不能删除根节点。 参考： 例程1

**完整正文（站点原文转换）**

**删除节点 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会删除给定节点和他的所有子节点，该方法不允许删除根节点。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．删除节点 （节点全路径）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd13.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd13.files/image004.gif)

说明

删除指定节点，该节点下的字节点将被全部删除，该命令不能删除根节点。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 删除属性

- 原文链接：https://esdn.ijingyi.com/title-12478.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．删除属性 （ 节点全路径 ， 属性名 ）
- 功能说明：该方法会删除给定节点的指定属性。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必填 | 文本型 | 本参数提供“删除属性”命令欲删除属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd14.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd14.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除指定节点的属性。 参考： 例程1

**完整正文（站点原文转换）**

**删除属性 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会删除给定节点的指定属性。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．删除属性 （节点全路径， 属性名）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必需的 ； 文本型。本参数提供“删除属性”命令欲删除属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd14.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd14.files/image004.gif)

说明

删除指定节点的属性。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 修改节点名

- 原文链接：https://esdn.ijingyi.com/title-12479.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．修改节点名 （ 节点全路径 ， 新节点名 ）
- 功能说明：该方法会修改指定节点的名称。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点名 | 必填 | 文本型 | 本参数提供“修改节点名”命令欲修改节点的新名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd15.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd15.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改 XML 树结构某节点下节点的名称。 参考： 例程1

**完整正文（站点原文转换）**

**修改节点名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会修改指定节点的名称。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．修改节点名 （节点全路径， 新节点名）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点名 | 必需的 ； 文本型。本参数提供“修改节点名”命令欲修改节点的新名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd15.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd15.files/image004.gif)

说明

修改XML树结构某节点下节点的名称。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 修改节点值

- 原文链接：https://esdn.ijingyi.com/title-12480.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．修改节点值 （ 节点全路径 ， 新节点值 ， ［ 使用CDATA ］ ）
- 功能说明：该方法会修改指定节点的值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点值 | 必填 | 文本型 | 本参数提供“修改节点值”命令欲修改节点的新值。 |
| 使用CDATA | 可空 | 逻辑型 | 如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd16.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd16.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改 XML 树结构某节点下节点的节点值。 参考： 例程1

**完整正文（站点原文转换）**

**修改节点值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会修改指定节点的值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．修改节点值 （节点全路径， 新节点值， ［使用CDATA］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点值 | 必需的 ； 文本型。本参数提供“修改节点值”命令欲修改节点的新值。 |
| 使用CDATA | 可选的 ； 逻辑型。如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd16.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd16.files/image004.gif)

说明

修改XML树结构某节点下节点的节点值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 修改二进制值

- 原文链接：https://esdn.ijingyi.com/title-12481.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．修改二进制值 （ 节点全路径 ， 新节点二进制值 ）
- 功能说明：该方法会修改指定节点的值为二进制的值。注意该方法指定的二进制数据不应太大，否则该支持库将无法解析。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点二进制值 | 必填 | 字节集 | 本参数提供“修改二进制值”命令欲修改节点的新的二进制值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd17.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd17.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改 XML 树结构某节点下节点的二进制值。 参考： 例程1

**完整正文（站点原文转换）**

**修改二进制值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会修改指定节点的值为二进制的值。注意该方法指定的二进制数据不应太大，否则该支持库将无法解析。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．修改二进制值 （节点全路径， 新节点二进制值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 新节点二进制值 | 必需的 ； 字节集。本参数提供“修改二进制值”命令欲修改节点的新的二进制值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd17.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd17.files/image004.gif)

说明

修改XML树结构某节点下节点的二进制值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 修改属性名

- 原文链接：https://esdn.ijingyi.com/title-12482.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．修改属性名 （ 节点全路径 ， 属性名 ， 新属性名 ）
- 功能说明：该方法会修改指定节点的属性名称。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必填 | 文本型 | 本参数提供“修改属性名”命令欲修改的节点属性名。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 新属性名 | 必填 | 文本型 | 本参数提供“修改属性名”命令欲修改节点的新属性名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd18.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd18.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改 XML 树结构某节点下节点的属性名称。 参考： 例程1

**完整正文（站点原文转换）**

**修改属性名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会修改指定节点的属性名称。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．修改属性名 （节点全路径， 属性名， 新属性名）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必需的 ； 文本型。本参数提供“修改属性名”命令欲修改的节点属性名。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 新属性名 | 必需的 ； 文本型。本参数提供“修改属性名”命令欲修改节点的新属性名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd18.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd18.files/image004.gif)

说明

修改XML树结构某节点下节点的属性名称。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 修改属性值

- 原文链接：https://esdn.ijingyi.com/title-12483.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．修改属性值 （ 节点全路径 ， 属性名 ， 新属性值 ）
- 功能说明：该方法会修改指定节点的属性值。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必填 | 文本型 | 本参数提供“修改属性值”命令欲修改节点的属性名。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 新属性值 | 必填 | 文本型 | 本参数提供“修改属性值”命令欲修改节点的新属性值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd19.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

修改指定节点的属性值。 参考： 例程1

**完整正文（站点原文转换）**

**修改属性值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法会修改指定节点的属性值。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．修改属性值 （节点全路径， 属性名， 新属性值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必需的 ； 文本型。本参数提供“修改属性值”命令欲修改节点的属性名。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 新属性值 | 必需的 ； 文本型。本参数提供“修改属性值”命令欲修改节点的新属性值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd19.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd19.files/image001.gif)

说明

修改指定节点的属性值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 批量删除节点

- 原文链接：https://esdn.ijingyi.com/title-12484.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．批量删除节点 （ 节点全路径 ）
- 功能说明：该方法要删除节点的路径参数可以支持通配符（*,?），该方法会删除所有符合路径条件的节点和该节点的子节点，该方法不允许删除根节点。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd20.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd20.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

通过使用通配符批量删除节点，该命令不能删除根节点。 参考： 例程1

**完整正文（站点原文转换）**

**批量删除节点 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法要删除节点的路径参数可以支持通配符（*,?），该方法会删除所有符合路径条件的节点和该节点的子节点，该方法不允许删除根节点。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．批量删除节点 （节点全路径）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd20.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd20.files/image004.gif)

说明

通过使用通配符批量删除节点，该命令不能删除根节点。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 批量取节点值

- 原文链接：https://esdn.ijingyi.com/title-12485.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．批量取节点值 （ 节点全路径 ， 批量节点值 ）
- 功能说明：该方法要取值节点的路径参数可以支持通配符（*,?），该方法会取所有符合路径条件的节点的值。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |
| 批量节点值 | 必填 | 文本型，参数数据只能提供变量数组 | 本参数作为“批量取节点值”命令的填充参数。“批量取节点值”命令执行完毕后，该参数内容为节点值的数组。如果命令执行失败，该参数的值无意义。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd21.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd21.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

通过使用通配符批量取得节点的节点值。 参考： 例程1

**完整正文（站点原文转换）**

**批量取节点值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法要取值节点的路径参数可以支持通配符（*,?），该方法会取所有符合路径条件的节点的值。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．批量取节点值 （节点全路径， 批量节点值）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |
| 批量节点值 | 必需的 ； 文本型，参数数据只能提供变量数组。本参数作为“批量取节点值”命令的填充参数。“批量取节点值”命令执行完毕后，该参数内容为节点值的数组。如果命令执行失败，该参数的值无意义。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd21.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd21.files/image004.gif)

说明

通过使用通配符批量取得节点的节点值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 批量修改节点值

- 原文链接：https://esdn.ijingyi.com/title-12486.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：逻辑型
- 语法：逻辑型 XML树 ．批量修改节点值 （ 节点全路径 ， 新节点值 ， ［ 使用CDATA ］ ）
- 功能说明：该方法要修改节点的路径参数可以支持通配符（*,?），该方法会修改所有符合路径条件的节点的值。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |
| 新节点值 | 必填 | 文本型 | 本参数作为“批量修改节点值”命令欲修改节点的新值。如果命令执行失败，该参数的值无意义。 |
| 使用CDATA | 可空 | 逻辑型 | 如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd22.files/image003.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd22.files/image004.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

通过使用通配符批量修改节点的节点值。 参考： 例程1

**完整正文（站点原文转换）**

**批量修改节点值 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

该方法要修改节点的路径参数可以支持通配符（*,?），该方法会修改所有符合路径条件的节点的值。注意索引形式的路径参数不支持通配符。该方法执行成功返回真，执行失败返回假。

*语法：*  逻辑型  *XML树*．批量修改节点值 （节点全路径， 新节点值， ［使用CDATA］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。注意该参数支持通配符（*, ?）――仅在路径中使用节点名称时支持通配符，使用索引时不支持通配符。 |
| 新节点值 | 必需的 ； 文本型。本参数作为“批量修改节点值”命令欲修改节点的新值。如果命令执行失败，该参数的值无意义。 |
| 使用CDATA | 可选的 ； 逻辑型。如果本参数为真，则节点值文本将被“ ”包围，这意味着该文本可以包含任意字符（以不影响CDATA解析为限）。如果被省略，默认为假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd22.files/image003.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd22.files/image004.gif)

说明

通过使用通配符批量修改节点的节点值。

参考：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml.e)

---

### 取根节点名文本

- 原文链接：https://esdn.ijingyi.com/title-12487.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型
- 语法：文本型 XML树 ．取根节点名文本 （ ［ 执行结果 ］ ）
- 功能说明：取得当前解析树根节点的名称文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取根节点名文本 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得当前解析树根节点的名称文本。

*语法：*  文本型  *XML树*．取根节点名文本 （［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd30.files/image001.gif)

**说明 **

取得当前解析树根节点的名称文本。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取子节点个数

- 原文链接：https://esdn.ijingyi.com/title-12488.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：整数型
- 语法：整数型 XML树 ．取子节点个数 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得参数节点的所有子节点的个数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取子节点个数 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的所有子节点的个数。

*语法：*  整数型  *XML树*．取子节点个数 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd31.files/image001.gif)

**说明 **

取得参数节点的所有子节点的个数。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取所有子节点名

- 原文链接：https://esdn.ijingyi.com/title-12489.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型数组
- 语法：文本型数组 XML树 ．取所有子节点名 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得由参数节点的所有子节点名称组成的文本数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有子节点名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得由参数节点的所有子节点名称组成的文本数组。

*语法：*  文本型数组  *XML树*．取所有子节点名 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd32.files/image001.gif)

**说明 **

取得由参数节点的所有子节点名称组成的文本数组。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取节点值文本

- 原文链接：https://esdn.ijingyi.com/title-12490.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型
- 语法：文本型 XML树 ．取节点值文本 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得参数节点值文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取节点值文本 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点值文本。

*语法：*  文本型  *XML树*．取节点值文本 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd33.files/image001.gif)

**说明 **

取得参数节点值文本。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取节点值字节集

- 原文链接：https://esdn.ijingyi.com/title-12491.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：字节集
- 语法：字节集 XML树 ．取节点值字节集 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得参数节点的二进制数据值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取节点值字节集 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的二进制数据值。

*语法：*  字节集  *XML树*．取节点值字节集 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd34.files/image001.gif)
　

**说明 **

取得参数节点的二进制数据值。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取属性个数

- 原文链接：https://esdn.ijingyi.com/title-12492.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：整数型
- 语法：整数型 XML树 ．取属性个数 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得由参数节点的属性个数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取属性个数 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得由参数节点的属性个数。

*语法：*  整数型  *XML树*．取属性个数 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd35.files/image001.gif)
　

**说明 **

取得由参数节点的属性个数。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取所有属性名

- 原文链接：https://esdn.ijingyi.com/title-12493.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型数组
- 语法：文本型数组 XML树 ．取所有属性名 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得由参数节点的所有属性名称组成的文本数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取所有属性名 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得由参数节点的所有属性名称组成的文本数组。

*语法：*  文本型数组  *XML树*．取所有属性名 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd36.files/image001.gif)
　

**说明 **

取得由参数节点的所有属性名称组成的文本数组。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取属性值文本

- 原文链接：https://esdn.ijingyi.com/title-12494.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型
- 语法：文本型 XML树 ．取属性值文本 （ 节点全路径 ， 属性名 ， ［ 执行结果 ］ ）
- 功能说明：取得参数节点的特定属性值文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必填 | 文本型 | 本参数提供“取属性值”命令所需要的节点属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取属性值文本 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数节点的特定属性值文本。

*语法：*  文本型  *XML树*．取属性值文本 （节点全路径， 属性名， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 属性名 | 必需的 ； 文本型。本参数提供“取属性值”命令所需要的节点属性的名称。该参数也可以是属性的索引，例如“@1”表示节点的第一个属性。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd37.files/image001.gif)
　

**说明 **

取得参数节点的特定属性值文本。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取XML数据

- 原文链接：https://esdn.ijingyi.com/title-12495.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：字节集
- 语法：字节集 XML树 ．取XML数据 （ ［ 字符集 ］ ， ［ 执行结果 ］ ， ［ 换行文本 ］ ， ［ 缩进文本 ］ ）
- 功能说明：取当前XML树的全部数据，并转换为字节集后返回。如果执行失败，返回值为空字节集。本方法所返回的数据与“导出到文件()”所写入文件的数据完全等同。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字符集 | 可空 | 文本型 | 指定欲使用的XML字符集属性，默认为“gb18030”。注意，本参数仅用于对“ ”节点的“encoding”属性赋值，不据此进行编码转换。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |
| 换行文本 | 可空 | 文本型 | 用于格式化XML文本，默认为 #换行符。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |
| 缩进文本 | 可空 | 文本型 | 用于格式化XML文本，默认为TAB键字符文本。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取XML数据 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取当前XML树的全部数据，并转换为字节集后返回。如果执行失败，返回值为空字节集。本方法所返回的数据与“导出到文件()”所写入文件的数据完全等同。

*语法：*  字节集  *XML树*．取XML数据 （［字符集］， ［执行结果］， ［换行文本］， ［缩进文本］）

| 参数名 | 描 述 |
| --- | --- |
| 字符集 | 可选的 ； 文本型。指定欲使用的XML字符集属性，默认为“gb18030”。注意，本参数仅用于对“ ”节点的“encoding”属性赋值，不据此进行编码转换。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |
| 换行文本 | 可选的 ； 文本型。用于格式化XML文本，默认为 #换行符。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |
| 缩进文本 | 可选的 ； 文本型。用于格式化XML文本，默认为TAB键字符文本。注意，如果此参数不为空文本，导出又导入后，会对有子节点的节点值产生影响。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程 **

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/cmd38.files/image001.gif)
　

**说明 **

取当前XML树的全部数据，并转换为字节集后返回。如果执行失败，返回值为空字节集。本方法所返回的数据与“导出到文件()”所写入文件的数据完全等同。如果提供第二个参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。

参考： [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/EXMLParser//EXMLParser/xml1.e)

---

### 取节点名文本

- 原文链接：https://esdn.ijingyi.com/title-12496.html
- 操作系统支持：Windows、Linux 所属对象： XML树
- 返回值类型：文本型
- 语法：文本型 XML树 ．取节点名文本 （ 节点全路径 ， ［ 执行结果 ］ ）
- 功能说明：取得参数指定节点的节点名。通常用于以索引形式（如"@1/@2"）指定节点路径的情况。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 节点全路径 | 必填 | 文本型 | 本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**取节点名文本 方法**   操作系统支持：Windows、Linux    所属对象：[XML树](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EXMLParser/dt0.htm)

取得参数指定节点的节点名。通常用于以索引形式（如"@1/@2"）指定节点路径的情况。

*语法：*  文本型  *XML树*．取节点名文本 （节点全路径， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 节点全路径 | 必需的 ； 文本型。本参数为节点在解析树中的全路径，格式有两种形式：一种为通过“/”字符把节点名称串联起来，例如“根节点/子节点/叶子节点”；另一种是采用索引的形式，索引的最小值为1，表示它是它父节点的第几个子节点，然后在索引前面加上@符号，例如“@1/@2/@1”。这两种形式可以混合使用，例如“根节点/@1/@2”。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，其中将存放本方法的执行结果――成功为“真”，失败为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
