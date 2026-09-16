# Java支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-14218.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**Java支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库使易语言具备了访问Java类库的能力。“Java虚拟机”和“Java本地接口”是本支持库中最重要的两个数据类型。由“Java虚拟机”负责真实Java虚拟机的生命周期管理，而“Java本地接口”则提供Java类库的访问接口。使用时，可直接通过“Java本地接口”的各类方法访问Java类库（即与“Java虚拟机”通信），由支持库本身自动完成“Java虚拟机”的创建和销毁。如果需要特别指定“用户类路径”或“本地库路径”，则必需在使用“Java本地接口”之前显式调用“Java虚拟机.创建()”方法创建Java虚拟机，以传入相关路径参数。
    本支持库要求目标机器中已安装“Java运行时环境”（JRE）。如果在没有配置好Java环境的情况下使用本支持库，所有对象方法都将返回空值（假，0，“”）。
    本支持库安装后，将自动在易语言主菜单中添加一项工具菜单，[工具]-[JavaLib：Java类型签名查询]。这是一个查询“Java 类型签名（Type Signature）”的实用工具。

操作系统支持： Windows

**其它数据类型：**

| Java虚拟机 | Java本地接口 | 数组类型 |  |
| --- | --- | --- | --- |

[常量表...](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/const.htm)

**
为易语言系统提供的工具功能：**

| 名称 | 说明 |
| --- | --- |
| JavaLib: Java类型签名查询 | 查询指定Java类的类型签名(Type Signature)。&nbsp |

## 命令分类：其他数据类型（56 条）

### 创建

- 原文链接：https://esdn.ijingyi.com/title-14224.html
- 操作系统支持：Windows 所属对象： Java虚拟机
- 返回值类型：逻辑型
- 语法：逻辑型 Java虚拟机 ．创建 （ ［ 用户类路径 ］ ， ［ 本地库路径 ］ ）
- 功能说明：创建JAVA虚拟机，并同时设置“用户类路径(classpath)”和“本地库路径(librarypath)”。如果不需要特别指定“用户类路径”或“本地库路径”，不必显式调用本方法，“Java虚拟机”会在必要的时机（进入对象作用域时）自动创建。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 用户类路径 | 可空 | 文本型 | 指定java.class.path属性，各路径间以半角分号;分隔，如“c:\myclasses;d:\xx.jar”。 |
| 本地库路径 | 可空 | 文本型 | 指定java.library.path属性，各路径间以半角分号;分隔，如“c:\myclasses”。此类目录下一般存放实现了JNI接口的dll或so文件。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/javalib//javalib/cmd1.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 提供的是一个目录，创建的 JAVA 类文件就放在该目录下。 参见 : 例程

**完整正文（站点原文转换）**

**创建 方法**   操作系统支持：Windows    所属对象：[Java虚拟机](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt0.htm)

创建JAVA虚拟机，并同时设置“用户类路径(classpath)”和“本地库路径(librarypath)”。如果不需要特别指定“用户类路径”或“本地库路径”，不必显式调用本方法，“Java虚拟机”会在必要的时机（进入对象作用域时）自动创建。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java虚拟机*．创建 （［用户类路径］， ［本地库路径］）

| 参数名 | 描 述 |
| --- | --- |
| 用户类路径 | 可选的 ； 文本型。指定java.class.path属性，各路径间以半角分号;分隔，如“c:\myclasses;d:\xx.jar”。 |
| 本地库路径 | 可选的 ； 文本型。指定java.library.path属性，各路径间以半角分号;分隔，如“c:\myclasses”。此类目录下一般存放实现了JNI接口的dll或so文件。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/javalib//javalib/cmd1.files/image001.gif)

说明:

提供的是一个目录，创建的JAVA类文件就放在该目录下。

参见:[例程](http://esdn.125.la/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8%E8%87%AA%E5%AE%9A%E4%B9%89Java%E7%B1%BB.e)

---

### 取版本

- 原文链接：https://esdn.ijingyi.com/title-14226.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：文本型
- 语法：文本型 Java本地接口 ．取版本 （ ）
- 功能说明：取Java本地接口环境的当前版本。返回的文本格式为“A.B”，A、B均为数字，分别表示主、次版本号。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd5.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出接口的 java 的版本号。 参见 : 例程

**完整正文（站点原文转换）**

**取版本 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取Java本地接口环境的当前版本。返回的文本格式为“A.B”，A、B均为数字，分别表示主、次版本号。

*语法：*  文本型  *Java本地接口*．取版本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd5.files/image001.gif)

说明:

取出接口的java的版本号。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 加载类

- 原文链接：https://esdn.ijingyi.com/title-14227.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．加载类 （ 要加载的类名称 ）
- 功能说明：根据类名称加载指定的Java类。它将搜索由classpath环境变量中指定的目录和jar文件，以及调用“Java虚拟机.创建()”方法时指定的“用户类路径”和“本地库路径”。返回加载后的Java类标志符。如果出错则返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 要加载的类名称 | 必填 | 文本型 | 必须使用完整类名称，可用字符.或/分隔，如：“java.lang.String”“java/lang/String”等。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd7.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 加载类“ java.lang.Object ”是 java 环境变量下的一个变量的值，它们是一级 级 的关系。 参见 : 例程

**完整正文（站点原文转换）**

**加载类 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

根据类名称加载指定的Java类。它将搜索由classpath环境变量中指定的目录和jar文件，以及调用“Java虚拟机.创建()”方法时指定的“用户类路径”和“本地库路径”。返回加载后的Java类标志符。如果出错则返回0。

*语法：*  整数型  *Java本地接口*．加载类 （要加载的类名称）

| 参数名 | 描 述 |
| --- | --- |
| 要加载的类名称 | 必需的 ； 文本型。必须使用完整类名称，可用字符.或/分隔，如：“java.lang.String”“java/lang/String”等。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd7.files/image002.gif)

说明:

加载类“java.lang.Object”是java环境变量下的一个变量的值，它们是一级级的关系。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 字节集加载类

- 原文链接：https://esdn.ijingyi.com/title-14228.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．字节集加载类 （ 类名称 ， 类加载器 ， 类文件数据 ）
- 功能说明：从包含原始类数据(.class文件内容)的字节集中加载类，返回加载后的Java类标志符。如果出错则返回0。JNI不允许重复加载同一个类。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类名称 | 必填 | 文本型 | 使用带包名称的类时，可用字符.或/分隔，如：“java.lang.String”“java/lang/String”等。 |
| 类加载器 | 必填 | 整数型，初始值为“0” | 分派给所定义的类的类加载器（的对象标志符）。注：如果本参数为0，默认使用系统类加载器java.lang.ClassLoader.getSystemClassLoader()。 |
| 类文件数据 | 必填 | 字节集 | 包含 .class 文件数据的字节集数据。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据数据，在它里加载类。 参见 : 例程

**完整正文（站点原文转换）**

**字节集加载类 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

从包含原始类数据(.class文件内容)的字节集中加载类，返回加载后的Java类标志符。如果出错则返回0。JNI不允许重复加载同一个类。

*语法：*  整数型  *Java本地接口*．字节集加载类 （类名称， 类加载器， 类文件数据）

| 参数名 | 描 述 |
| --- | --- |
| 类名称 | 必需的 ； 文本型。使用带包名称的类时，可用字符.或/分隔，如：“java.lang.String”“java/lang/String”等。 |
| 类加载器 | 必需的 ； 整数型，初始值为“0”。分派给所定义的类的类加载器（的对象标志符）。注：如果本参数为0，默认使用系统类加载器java.lang.ClassLoader.getSystemClassLoader()。 |
| 类文件数据 | 必需的 ； 字节集。包含 .class 文件数据的字节集数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd8.files/image001.gif)

说明:

根据数据，在它里加载类。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取父类

- 原文链接：https://esdn.ijingyi.com/title-14229.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取父类 （ 类标志符 ）
- 功能说明：取指定类的父类（或超类，SuperClass）。返回父类标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲取其超类的类。该标志符不应为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出“ String 类” 的父项的 标志符，如果与前次相同，说明它无父项。 参见 : 例程

**完整正文（站点原文转换）**

**取父类 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取指定类的父类（或超类，SuperClass）。返回父类标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．取父类 （类标志符）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲取其超类的类。该标志符不应为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd9.files/image001.gif)

说明:

取出“String类”的父项的标志符，如果与前次相同，说明它无父项。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 分配对象

- 原文链接：https://esdn.ijingyi.com/title-14230.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．分配对象 （ 类标志符 ）
- 功能说明：分配指定Java类的新对象而不调用该类的任何构造函数。返回分配后的对象标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定要分配的对象所属类型。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd10.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 分配对象是将加载的类完全的分配给对象 A 。 参见 : 例程

**完整正文（站点原文转换）**

**分配对象 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

分配指定Java类的新对象而不调用该类的任何构造函数。返回分配后的对象标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．分配对象 （类标志符）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定要分配的对象所属类型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd10.files/image001.gif)

说明:

分配对象是将加载的类完全的分配给对象A。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 创建对象

- 原文链接：https://esdn.ijingyi.com/title-14231.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．创建对象 （ 类标志符 ， 构造函数的方法标志符 ， ［ 参数值 ］ ， ... ）
- 功能说明：创建Java对象。返回创建后的对象标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲创建其对象的Java类。该标志符可通过调用“加载类()”等方法获得。 |
| 构造函数的方法标志符 | 必填 | 整数型 | 指定应调用的构造函数方法。该标志符必须通过调用“取方法标志符()”方法获得，且调用时的方法名必须为 ，而返回类型必须为void (V)。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；整数型。对应于被调用的Java类构造函数的参数值，注意传入的类型要与实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd11.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建对象给对象 B 参考 string 类，自己的方法由自己规定。 参见 : 例程

**完整正文（站点原文转换）**

**创建对象 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

创建Java对象。返回创建后的对象标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．创建对象 （类标志符， 构造函数的方法标志符， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲创建其对象的Java类。该标志符可通过调用“加载类()”等方法获得。 |
| 构造函数的方法标志符 | 必需的 ； 整数型。指定应调用的构造函数方法。该标志符必须通过调用“取方法标志符()”方法获得，且调用时的方法名必须为 ，而返回类型必须为void (V)。 |
| 参数值 | 可选的 ； 可扩充的 ；整数型。对应于被调用的Java类构造函数的参数值，注意传入的类型要与实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd11.files/image001.gif)

说明:

创建对象给对象B参考string类，自己的方法由自己规定。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 取对象类

- 原文链接：https://esdn.ijingyi.com/title-14232.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取对象类 （ 对象标志符 ）
- 功能说明：返回“对象所属类”的类标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其类的对象。该标志符不应为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出创建的对象 A 和对象 B 返回它们创建时分配的 id 。 参见 : 例程

**完整正文（站点原文转换）**

**取对象类 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回“对象所属类”的类标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．取对象类 （对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其类的对象。该标志符不应为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd12.files/image001.gif)

说明:

取出创建的对象A和对象B返回它们创建时分配的id。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 是否为类实例

- 原文链接：https://esdn.ijingyi.com/title-14233.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．是否为类实例 （ 对象标志符 ， 类标志符 ）
- 功能说明：判断指定对象是否为指定类的实例。是则返回“真”，否则返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定一个对象。该标志符不应为0。 |
| 类标志符 | 必填 | 整数型 | 指定一个类。该标志符不应为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判断对象 A 是否是 string 类的实例，实例是指某一类的创建的实际操作对象。 参见 : 例程

**完整正文（站点原文转换）**

**是否为类实例 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

判断指定对象是否为指定类的实例。是则返回“真”，否则返回“假”。

*语法：*  逻辑型  *Java本地接口*．是否为类实例 （对象标志符， 类标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定一个对象。该标志符不应为0。 |
| 类标志符 | 必需的 ； 整数型。指定一个类。该标志符不应为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd13.files/image001.gif)

说明:

判断对象A是否是string类的实例，实例是指某一类的创建的实际操作对象。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 是否相同

- 原文链接：https://esdn.ijingyi.com/title-14234.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．是否相同 （ 对象一标志符 ， 对象二标志符 ）
- 功能说明：判断两个变量是否引用同一Java对象。是则返回“真”，否则返回“假”。注意：如果两个参数标志符有其一为0，必将返回“假”（这一点与JNI不同）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象一标志符 | 必填 | 整数型 | 指定一个对象。该标志符不应为0。 |
| 对象二标志符 | 必填 | 整数型 | 指定一个对象。该标志符不应为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判断对象 A 和对象 B 是否是同一类。 参见 : 例程

**完整正文（站点原文转换）**

**是否相同 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

判断两个变量是否引用同一Java对象。是则返回“真”，否则返回“假”。注意：如果两个参数标志符有其一为0，必将返回“假”（这一点与JNI不同）。

*语法：*  逻辑型  *Java本地接口*．是否相同 （对象一标志符， 对象二标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象一标志符 | 必需的 ； 整数型。指定一个对象。该标志符不应为0。 |
| 对象二标志符 | 必需的 ； 整数型。指定一个对象。该标志符不应为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd14.files/image001.gif)

说明:

判断对象A和对象B是否是同一类。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 可否强制转换

- 原文链接：https://esdn.ijingyi.com/title-14235.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．可否强制转换 （ 将被转换的类标志符 ， 将被转换到的类标志符 ）
- 功能说明：判断参数一（“将被转换的类”）的对象是否可安全地强制转换为参数二（“将被转换到的类”）。以下情况下将返回“真”：第一及第二个类参数引用同一个 Java 类；第一个类是第二个类的子类；第二个类是第一个类的某个接口。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 将被转换的类标志符 | 必填 | 整数型 | 指定将被转换的类。 |
| 将被转换到的类标志符 | 必填 | 整数型 | 指定将被转换到的类。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 如果 可否强制转换 (Object 类 , String 类 ) 返回“真”，表示可以将 String 类的对象赋值给 Object 类的对象。 Ojbect obj; String str; obj = str; // 正确，可以赋值，因为 String 类可以强制转换为 Object 类。 str = obj; // 错误，不可以赋值，因为 Object 类不可以强制转换为 String 类。 参见 : 例程

**完整正文（站点原文转换）**

**可否强制转换 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

判断参数一（“将被转换的类”）的对象是否可安全地强制转换为参数二（“将被转换到的类”）。以下情况下将返回“真”：第一及第二个类参数引用同一个 Java 类；第一个类是第二个类的子类；第二个类是第一个类的某个接口。

*语法：*  逻辑型  *Java本地接口*．可否强制转换 （将被转换的类标志符， 将被转换到的类标志符）

| 参数名 | 描 述 |
| --- | --- |
| 将被转换的类标志符 | 必需的 ； 整数型。指定将被转换的类。 |
| 将被转换到的类标志符 | 必需的 ； 整数型。指定将被转换到的类。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd15.files/image001.gif)

说明:

如果 可否强制转换 (Object类, String类) 返回“真”，表示可以将String类的对象赋值给Object类的对象。

Ojbect obj;

String str;

obj = str; //正确，可以赋值，因为String类可以强制转换为Object类。

str = obj; //错误，不可以赋值，因为Object类不可以强制转换为String类。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 创建全局引用

- 原文链接：https://esdn.ijingyi.com/title-14236.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．创建全局引用 （ 被引用的对象标志符 ）
- 功能说明：创建指定对象的新全局引用。返回创建后的全局引用对象标志符，失败返回0。全局引用需要通过调用“销毁全局引用()”方法来销毁。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 被引用的对象标志符 | 必填 | 整数型 | 该参数所指定的对象既可以是全局引用，也可以是局部引用。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd16.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建个全局的引用，就是说这个要创建的引用是在全程序下操作的。 参见 : 例程

**完整正文（站点原文转换）**

**创建全局引用 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

创建指定对象的新全局引用。返回创建后的全局引用对象标志符，失败返回0。全局引用需要通过调用“销毁全局引用()”方法来销毁。

*语法：*  整数型  *Java本地接口*．创建全局引用 （被引用的对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 被引用的对象标志符 | 必需的 ； 整数型。该参数所指定的对象既可以是全局引用，也可以是局部引用。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd16.files/image001.gif)

说明:

创建个全局的引用，就是说这个要创建的引用是在全程序下操作的。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 销毁全局引用

- 原文链接：https://esdn.ijingyi.com/title-14237.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．销毁全局引用 （ 欲销毁的全局引用对象标志符 ）
- 功能说明：销毁由参数所指定的全局引用对象。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲销毁的全局引用对象标志符 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd17.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 删除全局引用‘全局引用\'，是销毁一个引用并不销毁它的引用对象。 参见 : 例程

**完整正文（站点原文转换）**

**销毁全局引用 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

销毁由参数所指定的全局引用对象。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．销毁全局引用 （欲销毁的全局引用对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 欲销毁的全局引用对象标志符 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd17.files/image001.gif)

说明:

删除全局引用‘全局引用\'，是销毁一个引用并不销毁它的引用对象。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 销毁局部引用

- 原文链接：https://esdn.ijingyi.com/title-14238.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．销毁局部引用 （ 欲销毁的局部引用对象标志符 ）
- 功能说明：销毁由参数所指定的局部引用对象。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲销毁的局部引用对象标志符 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd18.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 销毁局部的引用对象。 参见 : 例程

**完整正文（站点原文转换）**

**销毁局部引用 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

销毁由参数所指定的局部引用对象。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．销毁局部引用 （欲销毁的局部引用对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 欲销毁的局部引用对象标志符 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd18.files/image001.gif)

说明:

销毁局部的引用对象。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%B1%BB%E3%80%81%E5%AF%B9%E8%B1%A1%E3%80%81%E5%BC%95%E7%94%A8.e)

---

### 取成员标志符

- 原文链接：https://esdn.ijingyi.com/title-14239.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取成员标志符 （ 类标志符 ， 成员名称 ， 成员签名 ）
- 功能说明：返回类的实例成员（非静态成员）的成员标志符，该成员由其名称及签名指定。失败返回0。本方法可自动将未初始化的类初始化。本方法不能用于获取数组的长度，应调用“取数组长度()”方法。调用“取成员()”“置成员()”系列方法时都将用到本方法返回的成员标志符。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲取其成员(Field)标志符的类。该标志符不应为0。 |
| 成员名称 | 必填 | 文本型 | 欲取其标志符的成员名称。 |
| 成员签名 | 必填 | 文本型 | 欲取其标志符的成员签名。使用Java中的“类型签名(Type Signature)”协助前一参数“成员名称”唯一标识欲访问的成员。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出类的‘ salary \'成员的标志符，就是这个成员的属性。 参见 : 例程

**完整正文（站点原文转换）**

**取成员标志符 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回类的实例成员（非静态成员）的成员标志符，该成员由其名称及签名指定。失败返回0。本方法可自动将未初始化的类初始化。本方法不能用于获取数组的长度，应调用“取数组长度()”方法。调用“取成员()”“置成员()”系列方法时都将用到本方法返回的成员标志符。

*语法：*  整数型  *Java本地接口*．取成员标志符 （类标志符， 成员名称， 成员签名）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲取其成员(Field)标志符的类。该标志符不应为0。 |
| 成员名称 | 必需的 ； 文本型。欲取其标志符的成员名称。 |
| 成员签名 | 必需的 ； 文本型。欲取其标志符的成员签名。使用Java中的“类型签名(Type Signature)”协助前一参数“成员名称”唯一标识欲访问的成员。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd19.files/image001.gif)

说明:

取出类的‘salary\'成员的标志符，就是这个成员的属性。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取成员

- 原文链接：https://esdn.ijingyi.com/title-14240.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．取成员 （ 对象标志符 ， 成员标志符 ， 结果 ）
- 功能说明：取对象成员的值，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 结果 | 必填 | 通用型，参数数据只能提供变量 | 存放取出的成员值。注意：要提供与成员的数据类型相一致的变量。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd20.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出属性成员的价值，把数据放入‘薪水\'中输出到操作台。 参见 : 例程

**完整正文（站点原文转换）**

**取成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取对象成员的值，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．取成员 （对象标志符， 成员标志符， 结果）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 结果 | 必需的 ； 通用型，参数数据只能提供变量。存放取出的成员值。注意：要提供与成员的数据类型相一致的变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd20.files/image001.gif)

说明:

取出属性成员的价值，把数据放入‘薪水\'中输出到操作台。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 置成员

- 原文链接：https://esdn.ijingyi.com/title-14241.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置成员 （ 对象标志符 ， 成员标志符 ， 值 ）
- 功能说明：设置对象成员的值。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 值 | 必填 | 通用型 | 欲赋于成员的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd21.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 向对象的成员属性置入数据。 参见 : 例程

**完整正文（站点原文转换）**

**置成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

设置对象成员的值。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．置成员 （对象标志符， 成员标志符， 值）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 值 | 必需的 ； 通用型。欲赋于成员的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd21.files/image001.gif)

说明:

向对象的成员属性置入数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取对象成员

- 原文链接：https://esdn.ijingyi.com/title-14242.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．取对象成员 （ 对象标志符 ， 成员标志符 ， 结果 ）
- 功能说明：取对象成员的值，取出的是一个对象标志符，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 结果 | 必填 | 整数型，参数数据只能提供变量 | 存放取出的成员值――对象标志符。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取属性的成员数据，这个数据是从 java 内的类实例中提取的。 参见 : 例程

**完整正文（站点原文转换）**

**取对象成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取对象成员的值，取出的是一个对象标志符，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．取对象成员 （对象标志符， 成员标志符， 结果）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 结果 | 必需的 ； 整数型，参数数据只能提供变量。存放取出的成员值――对象标志符。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd22.files/image001.gif)

说明:

取属性的成员数据，这个数据是从java内的类实例中提取的。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 置对象成员

- 原文链接：https://esdn.ijingyi.com/title-14243.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置对象成员 （ 对象标志符 ， 成员标志符 ， 对象标志符 ）
- 功能说明：设置对象成员的值。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 对象标志符 | 必填 | 整数型 | 指定欲赋于该成员的对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd23.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 向成员属性置入数据写到 java 类中。 参见 : 例程

**完整正文（站点原文转换）**

**置对象成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

设置对象成员的值。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．置对象成员 （对象标志符， 成员标志符， 对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 对象标志符 | 必需的 ； 整数型。指定欲赋于该成员的对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd23.files/image001.gif)

说明:

向成员属性置入数据写到java类中。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取静态成员标志符

- 原文链接：https://esdn.ijingyi.com/title-14244.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取静态成员标志符 （ 类标志符 ， 成员名称 ， 成员签名 ）
- 功能说明：返回类的静态成员(static Field)的成员标志符，该成员由其名称及签名指定。失败返回0。本方法可自动将未初始化的类初始化。调用“取静态成员()”“置静态成员()”系列方法时都将用到本方法返回的静态成员标志符。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲取其成员(Field)标志符的类。该标志符不应为0。 |
| 成员名称 | 必填 | 文本型 | 欲取其标志符的成员名称。 |
| 成员签名 | 必填 | 文本型 | 欲取其标志符的成员签名。使用Java中的“类型签名(Type Signature)”协助前一参数“成员名称”唯一标识欲访问的成员。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd24.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 返回类的静态成员 标志符。 参见 : 例程

**完整正文（站点原文转换）**

**取静态成员标志符 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回类的静态成员(static Field)的成员标志符，该成员由其名称及签名指定。失败返回0。本方法可自动将未初始化的类初始化。调用“取静态成员()”“置静态成员()”系列方法时都将用到本方法返回的静态成员标志符。

*语法：*  整数型  *Java本地接口*．取静态成员标志符 （类标志符， 成员名称， 成员签名）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲取其成员(Field)标志符的类。该标志符不应为0。 |
| 成员名称 | 必需的 ； 文本型。欲取其标志符的成员名称。 |
| 成员签名 | 必需的 ； 文本型。欲取其标志符的成员签名。使用Java中的“类型签名(Type Signature)”协助前一参数“成员名称”唯一标识欲访问的成员。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd24.files/image001.gif)

说明:

返回类的静态成员标志符。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取静态成员

- 原文链接：https://esdn.ijingyi.com/title-14245.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．取静态成员 （ 对象标志符 ， 成员标志符 ， 结果 ）
- 功能说明：取对象静态成员的值，取出的是一个对象标志符，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 结果 | 必填 | 通用型，参数数据只能提供变量 | 存放取出的成员值。注意：要提供与成员的数据类型相一致的变量。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd25.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取对象静态成员的值。 参见 : 例程

**完整正文（站点原文转换）**

**取静态成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取对象静态成员的值，取出的是一个对象标志符，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．取静态成员 （对象标志符， 成员标志符， 结果）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 结果 | 必需的 ； 通用型，参数数据只能提供变量。存放取出的成员值。注意：要提供与成员的数据类型相一致的变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd25.files/image001.gif)

说明:

取对象静态成员的值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 置静态成员

- 原文链接：https://esdn.ijingyi.com/title-14246.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置静态成员 （ 对象标志符 ， 成员标志符 ， 值 ）
- 功能说明：设置对象静态成员的值。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 值 | 必填 | 通用型 | 欲赋于成员的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置对象静态成员的值。 参见 : 例程

**完整正文（站点原文转换）**

**置静态成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

设置对象静态成员的值。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．置静态成员 （对象标志符， 成员标志符， 值）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 值 | 必需的 ； 通用型。欲赋于成员的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd26.files/image001.gif)

说明:

设置对象静态成员的值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取静态对象成员

- 原文链接：https://esdn.ijingyi.com/title-14247.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．取静态对象成员 （ 对象标志符 ， 成员标志符 ， 结果 ）
- 功能说明：取对象静态成员的值，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 结果 | 必填 | 整数型，参数数据只能提供变量 | 存放取出的成员值――对象标志符。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd27.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取对象静态成员的值。 参见 : 例程

**完整正文（站点原文转换）**

**取静态对象成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取对象静态成员的值，结果存到第三个参数“结果”中。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．取静态对象成员 （对象标志符， 成员标志符， 结果）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 结果 | 必需的 ； 整数型，参数数据只能提供变量。存放取出的成员值――对象标志符。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd27.files/image001.gif)

说明:

取对象静态成员的值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 置静态对象成员

- 原文链接：https://esdn.ijingyi.com/title-14248.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置静态对象成员 （ 对象标志符 ， 成员标志符 ， 对象标志符 ）
- 功能说明：设置对象静态成员的值。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必填 | 整数型 | 欲取其值的成员。该标志符不应为0。 |
| 对象标志符 | 必填 | 整数型 | 指定欲赋于该成员的对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd28.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置对象静态成员的值。 参见 : 例程

**完整正文（站点原文转换）**

**置静态对象成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

设置对象静态成员的值。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．置静态对象成员 （对象标志符， 成员标志符， 对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲取其成员(Field)的类。该标志符不应为0。 |
| 成员标志符 | 必需的 ； 整数型。欲取其值的成员。该标志符不应为0。 |
| 对象标志符 | 必需的 ； 整数型。指定欲赋于该成员的对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd28.files/image001.gif)

说明:

设置对象静态成员的值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取方法标志符

- 原文链接：https://esdn.ijingyi.com/title-14249.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取方法标志符 （ 类标志符 ， 方法名称 ， 方法签名 ）
- 功能说明：返回类或接口实例方法（非静态方法）的方法标志符，该方法由其名称及签名指定。失败返回0。方法可在参数“类标志符”所指定的类的超类中定义。本方法可自动将未初始化的类初始化。要获得构造函数的方法标志符，应将 作为方法名，同时将void (V)作为返回类型。调用“[非虚拟][对象/空]方法()”系列方法时都将用到本方法返回的方法标志符。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲取其方法的类。可为“加载类()”等方法的返回值。 |
| 方法名称 | 必填 | 文本型 | 欲调用的方法名称。 |
| 方法签名 | 必填 | 文本型 | 欲调用的方法签名。使用Java中的“类型签名(Type Signature)”协助前一参数“方法名称”唯一标识欲调用的类方法――Java类方法可能被重载，仅“方法名称”不能唯一标识之。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出类的方法‘ \'的标志符。 参见 : 例程

**完整正文（站点原文转换）**

**取方法标志符 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回类或接口实例方法（非静态方法）的方法标志符，该方法由其名称及签名指定。失败返回0。方法可在参数“类标志符”所指定的类的超类中定义。本方法可自动将未初始化的类初始化。要获得构造函数的方法标志符，应将作为方法名，同时将void (V)作为返回类型。调用“[非虚拟][对象/空]方法()”系列方法时都将用到本方法返回的方法标志符。

*语法：*  整数型  *Java本地接口*．取方法标志符 （类标志符， 方法名称， 方法签名）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲取其方法的类。可为“加载类()”等方法的返回值。 |
| 方法名称 | 必需的 ； 文本型。欲调用的方法名称。 |
| 方法签名 | 必需的 ； 文本型。欲调用的方法签名。使用Java中的“类型签名(Type Signature)”协助前一参数“方法名称”唯一标识欲调用的类方法――Java类方法可能被重载，仅“方法名称”不能唯一标识之。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd29.files/image001.gif)

说明:

取出类的方法‘<init>\'的标志符。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 方法

- 原文链接：https://esdn.ijingyi.com/title-14250.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．方法 （ 对象标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用对象的具有基本数据类型返回值方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 通用型，参数数据只能提供变量 | 存放方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 执行对象的方法。 参见 : 例程

**完整正文（站点原文转换）**

**方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用对象的具有基本数据类型返回值方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．方法 （对象标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 通用型，参数数据只能提供变量。存放方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd30.files/image001.gif)

说明:

执行对象的方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8%E8%87%AA%E5%AE%9A%E4%B9%89Java%E7%B1%BB.e)

---

### 对象方法

- 原文链接：https://esdn.ijingyi.com/title-14251.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．对象方法 （ 对象标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用对象的具有对象型返回值的方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 整数型，参数数据只能提供变量 | 存放方法调用后的返回值――对象标志符。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 调用对象的具有对象型返回值的方法。 参见 : 例程

**完整正文（站点原文转换）**

**对象方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用对象的具有对象型返回值的方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．对象方法 （对象标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 整数型，参数数据只能提供变量。存放方法调用后的返回值――对象标志符。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd31.files/image001.gif)

说明:

调用对象的具有对象型返回值的方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 空方法

- 原文链接：https://esdn.ijingyi.com/title-14252.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．空方法 （ 对象标志符 ， 方法标志符 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用对象的没有返回值的方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 调用对象的没有返回值的方法。 参见 : 例程

**完整正文（站点原文转换）**

**空方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用对象的没有返回值的方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．空方法 （对象标志符， 方法标志符， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd32.files/image001.gif)

说明:

调用对象的没有返回值的方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 非虚拟方法

- 原文链接：https://esdn.ijingyi.com/title-14253.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．非虚拟方法 （ 对象标志符 ， 类标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：根据指定的类和方法标志符调用某对象的具有基本数据类型返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 类标志符 | 必填 | 整数型 | 指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 通用型，参数数据只能提供变量 | 存放方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据指定的类和方法标志符调用某对象的具有基本数据类型返回值的实例（非静态）方法。 参见 : 例程

**完整正文（站点原文转换）**

**非虚拟方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

根据指定的类和方法标志符调用某对象的具有基本数据类型返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．非虚拟方法 （对象标志符， 类标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 类标志符 | 必需的 ； 整数型。指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 通用型，参数数据只能提供变量。存放方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd33.files/image001.gif)

说明:

根据指定的类和方法标志符调用某对象的具有基本数据类型返回值的实例（非静态）方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 非虚拟对象方法

- 原文链接：https://esdn.ijingyi.com/title-14254.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．非虚拟对象方法 （ 对象标志符 ， 类标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：根据指定的类和方法标志符调用某对象的具有对象类型返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 类标志符 | 必填 | 整数型 | 指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 整数型，参数数据只能提供变量 | 存放方法调用后的返回值――对象标志符。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd34.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 调用 类 B 的对象的“非虚拟方法” objectMethod ，即其父类 类 A 的方法。 （因为 objectMethod 方法的返回值为对象类型 (String, 非基本类型 ) ，所以要调用“非虚拟对象方法”而非“非虚拟方法”。） 在 Java 中，所有的方法都是虚拟（ virtual ）方法，如果子类覆盖（ override ）了父类的方法，那么子类的对象调用的一定是子类的方法。而在此处，我们多了一种选择，可以明确指定要调用父类的方法。 参见 : 例程

**完整正文（站点原文转换）**

**非虚拟对象方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

根据指定的类和方法标志符调用某对象的具有对象类型返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．非虚拟对象方法 （对象标志符， 类标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 类标志符 | 必需的 ； 整数型。指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 整数型，参数数据只能提供变量。存放方法调用后的返回值――对象标志符。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd34.files/image001.gif)

说明:

调用 类B 的对象的“非虚拟方法”objectMethod，即其父类 类A 的方法。（因为objectMethod方法的返回值为对象类型(String,非基本类型)，所以要调用“非虚拟对象方法”而非“非虚拟方法”。）

在Java中，所有的方法都是虚拟（virtual）方法，如果子类覆盖（override）了父类的方法，那么子类的对象调用的一定是子类的方法。而在此处，我们多了一种选择，可以明确指定要调用父类的方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 非虚拟空方法

- 原文链接：https://esdn.ijingyi.com/title-14255.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．非虚拟空方法 （ 对象标志符 ， 类标志符 ， 方法标志符 ， ［ 参数值 ］ ， ... ）
- 功能说明：根据指定的类和方法标志符调用某对象的没有返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 指定欲调用其方法的对象。 |
| 类标志符 | 必填 | 整数型 | 指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd35.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据指定的类和方法标志符调用某对象的没有返回值的实例（非静态）方法。 参见 : 例程

**完整正文（站点原文转换）**

**非虚拟空方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

根据指定的类和方法标志符调用某对象的没有返回值的实例（非静态）方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．非虚拟空方法 （对象标志符， 类标志符， 方法标志符， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。指定欲调用其方法的对象。 |
| 类标志符 | 必需的 ； 整数型。指定欲调用其方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的方法。应为“取方法标志符()”方法的返回值。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd35.files/image001.gif)

说明:

根据指定的类和方法标志符调用某对象的没有返回值的实例（非静态）方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 取静态方法标志符

- 原文链接：https://esdn.ijingyi.com/title-14256.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取静态方法标志符 （ 类标志符 ， 静态方法名称 ， 静态方法签名 ）
- 功能说明：取指定类的静态方法(static Method)的方法标志符，该方法由其名称和签名指定。失败返回0。本方法可自动将未初始化的类初始化。调用“静态[对象/空]方法()”系列方法时都将用到本方法返回的静态方法标志符。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | “欲取其静态方法的”类的标志符，可为“查询类()”的返回值。 |
| 静态方法名称 | 必填 | 文本型 | 欲调用的静态方法名称。 |
| 静态方法签名 | 必填 | 文本型 | 欲调用的方法签名。使用Java中的“类型签名(Type Signature)”协助前一参数“静态方法名称”唯一标识欲调用的类方法――Java类方法可能被重载，仅“方法名称”不能唯一标识之。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd36.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取得静态方法的标志符，然后调用该静态方法 参见 : 例程

**完整正文（站点原文转换）**

**取静态方法标志符 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取指定类的静态方法(static Method)的方法标志符，该方法由其名称和签名指定。失败返回0。本方法可自动将未初始化的类初始化。调用“静态[对象/空]方法()”系列方法时都将用到本方法返回的静态方法标志符。

*语法：*  整数型  *Java本地接口*．取静态方法标志符 （类标志符， 静态方法名称， 静态方法签名）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。“欲取其静态方法的”类的标志符，可为“查询类()”的返回值。 |
| 静态方法名称 | 必需的 ； 文本型。欲调用的静态方法名称。 |
| 静态方法签名 | 必需的 ； 文本型。欲调用的方法签名。使用Java中的“类型签名(Type Signature)”协助前一参数“静态方法名称”唯一标识欲调用的类方法――Java类方法可能被重载，仅“方法名称”不能唯一标识之。关于“类型签名”的更多信息，请点击易语言[工具]菜单“JavaLib: 查询Java类的类型签名”；或参考相关文档。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd36.files/image001.gif)

说明:

取得静态方法的标志符，然后调用该静态方法

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 静态方法

- 原文链接：https://esdn.ijingyi.com/title-14257.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．静态方法 （ 类标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用类的具有基本数据类型返回值静态方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲调用其静态方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的静态方法。应为“取静态方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 通用型，参数数据只能提供变量 | 存放静态方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd37.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取得静态方法的标志符，然后调用该静态方法。 参见 : 例程

**完整正文（站点原文转换）**

**静态方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用类的具有基本数据类型返回值静态方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．静态方法 （类标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲调用其静态方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的静态方法。应为“取静态方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 通用型，参数数据只能提供变量。存放静态方法调用后的返回值。注意，提供的变量的数据类型要与方法的实际返回值数据类型一致。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd37.files/image001.gif)

说明:

取得静态方法的标志符，然后调用该静态方法。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 静态对象方法

- 原文链接：https://esdn.ijingyi.com/title-14258.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．静态对象方法 （ 类标志符 ， 方法标志符 ， 返回结果 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用类的具有对象型返回值的静态方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | 指定欲调用其静态方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必填 | 整数型 | 指定欲调用的静态方法。应为“取静态方法标志符()”方法的返回值。 |
| 返回结果 | 必填 | 整数型，参数数据只能提供变量 | 存放静态方法调用后的返回值――对象标志符。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用静态方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取得静态方法的标志符，然后调用该静态方法。因为 staticObjectMethod 方法的返回值为对象类型（ String, 非基本类型），所以使用“静态对象方法”而非“静态方法”。 参见 : 例程

**完整正文（站点原文转换）**

**静态对象方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用类的具有对象型返回值的静态方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．静态对象方法 （类标志符， 方法标志符， 返回结果， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。指定欲调用其静态方法的类。可为“加载类()”等方法的返回值。 |
| 方法标志符 | 必需的 ； 整数型。指定欲调用的静态方法。应为“取静态方法标志符()”方法的返回值。 |
| 返回结果 | 必需的 ； 整数型，参数数据只能提供变量。存放静态方法调用后的返回值――对象标志符。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用静态方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd38.files/image001.gif)

说明:

取得静态方法的标志符，然后调用该静态方法。因为staticObjectMethod方法的返回值为对象类型（String,非基本类型），所以使用“静态对象方法”而非“静态方法”。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 静态空方法

- 原文链接：https://esdn.ijingyi.com/title-14259.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．静态空方法 （ 类标志符 ， 方法标志符 ， ［ 参数值 ］ ， ... ）
- 功能说明：调用类的静态无返回值方法，即static void方法。调用成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类标志符 | 必填 | 整数型 | “欲调用其静态方法的类”的类标志符，可为“加载类()”的返回值。 |
| 方法标志符 | 必填 | 整数型 | “欲调用的静态方法”的方法标志符，应为“取静态方法标志符()”的返回值。 |
| 参数值 | 可空 | 待核实 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取得静态方法的标志符，然后调用该静态方法。因为 staticObjectMethod 方法的没有返回值，所以使用“静态空方法”而非“静态方法”。 参见 : 例程

**完整正文（站点原文转换）**

**静态空方法 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

调用类的静态无返回值方法，即static void方法。调用成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．静态空方法 （类标志符， 方法标志符， ［参数值］， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 类标志符 | 必需的 ； 整数型。“欲调用其静态方法的类”的类标志符，可为“加载类()”的返回值。 |
| 方法标志符 | 必需的 ； 整数型。“欲调用的静态方法”的方法标志符，应为“取静态方法标志符()”的返回值。 |
| 参数值 | 可选的 ； 可扩充的 ；通用型。对应于被调用方法的参数值，注意传入的类型要与该方法实际需要的类型一致。本参数可重复添加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd39.files/image001.gif)

说明:

取得静态方法的标志符，然后调用该静态方法。因为staticObjectMethod方法的没有返回值，所以使用“静态空方法”而非“静态方法”。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%BB%BC%E5%90%88%E4%BE%8B%E7%A8%8B.e)

---

### 创建字符串

- 原文链接：https://esdn.ijingyi.com/title-14260.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．创建字符串 （ 文本 ）
- 功能说明：使用易语言文本构造新的java.lang.String对象。返回创建后的字符串对象标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文本 | 必填 | 文本型，初始值为“” | 将被转换到Java字符串的易语言文本。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd40.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建字符串在 java 的类下存放。 参见 : 例程

**完整正文（站点原文转换）**

**创建字符串 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

使用易语言文本构造新的java.lang.String对象。返回创建后的字符串对象标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．创建字符串 （文本）

| 参数名 | 描 述 |
| --- | --- |
| 文本 | 必需的 ； 文本型，初始值为“”。将被转换到Java字符串的易语言文本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd40.files/image001.gif)

说明:

创建字符串在java的类下存放。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E7%B3%BB%E7%BB%9F%E7%B1%BB.e)

---

### 取字符串长度

- 原文链接：https://esdn.ijingyi.com/title-14261.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取字符串长度 （ 字符串标志符 ）
- 功能说明：返回Java字符串的长度（Unicode字符数），数字、字母、汉字等都被当作一个字符。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字符串标志符 | 必填 | 整数型 | 指定欲取其长度的Java字符串对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd41.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 从 java 类中的对象类中取出数据的长度。 参见 : 例程

**完整正文（站点原文转换）**

**取字符串长度 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回Java字符串的长度（Unicode字符数），数字、字母、汉字等都被当作一个字符。失败返回0。

*语法：*  整数型  *Java本地接口*．取字符串长度 （字符串标志符）

| 参数名 | 描 述 |
| --- | --- |
| 字符串标志符 | 必需的 ； 整数型。指定欲取其长度的Java字符串对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd41.files/image001.gif)

说明:

从java类中的对象类中取出数据的长度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E7%B3%BB%E7%BB%9F%E7%B1%BB.e)

---

### 取字符串文本

- 原文链接：https://esdn.ijingyi.com/title-14262.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：文本型
- 语法：文本型 Java本地接口 ．取字符串文本 （ 字符串标志符 ， ［ 执行结果 ］ ）
- 功能说明：返回与指定Java字符串相对应的易语言文本。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字符串标志符 | 必填 | 整数型 | 指定欲取其文本的Java字符串对象。 |
| 执行结果 | 可空 | 逻辑型，参数数据只能提供变量 | 如果提供本参数，则在方法执行后存放执行结果：执行成功，其值为“真”；执行失败，其值为“假”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd42.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 从 java 对象类中取出数据。 参见 : 例程

**完整正文（站点原文转换）**

**取字符串文本 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回与指定Java字符串相对应的易语言文本。

*语法：*  文本型  *Java本地接口*．取字符串文本 （字符串标志符， ［执行结果］）

| 参数名 | 描 述 |
| --- | --- |
| 字符串标志符 | 必需的 ； 整数型。指定欲取其文本的Java字符串对象。 |
| 执行结果 | 可选的 ； 逻辑型，参数数据只能提供变量。如果提供本参数，则在方法执行后存放执行结果：执行成功，其值为“真”；执行失败，其值为“假”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd42.files/image001.gif)

说明:

从java对象类中取出数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E7%B3%BB%E7%BB%9F%E7%B1%BB.e)

---

### 取数组长度

- 原文链接：https://esdn.ijingyi.com/title-14263.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取数组长度 （ 数组标志符 ）
- 功能说明：返回指定Java数组的长度。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组标志符 | 必填 | 整数型 | 指定欲取其长度的Java数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd48.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出数组类的数组单位长度。 参见 : 例程

**完整正文（站点原文转换）**

**取数组长度 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回指定Java数组的长度。

*语法：*  整数型  *Java本地接口*．取数组长度 （数组标志符）

| 参数名 | 描 述 |
| --- | --- |
| 数组标志符 | 必需的 ； 整数型。指定欲取其长度的Java数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd48.files/image001.gif)

说明:

取出数组类的数组单位长度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8Java%E6%95%B0%E7%BB%84.e)

---

### 创建数组

- 原文链接：https://esdn.ijingyi.com/title-14264.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．创建数组 （ 数组长度 ， 数组类型 ）
- 功能说明：返回创建后的数组标志符。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组长度 | 必填 | 整数型 |  |
| 数组类型 | 必填 | 整数型 | 指定该数组容纳的基本数据类型。请为本参数提供枚举类型“数组类型”中的常量值，如：“#数组类型.数据型”。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd49.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建 java 数组，用‘数组\'操作它们。 参见 : 例程

**完整正文（站点原文转换）**

**创建数组 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回创建后的数组标志符。失败返回0。

*语法：*  整数型  *Java本地接口*．创建数组 （数组长度， 数组类型）

| 参数名 | 描 述 |
| --- | --- |
| 数组长度 | 必需的 ； 整数型。 |
| 数组类型 | 必需的 ； 整数型。指定该数组容纳的基本数据类型。请为本参数提供枚举类型“数组类型”中的常量值，如：“#数组类型.数据型”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd49.files/image001.gif)

说明:

创建java数组，用‘数组\'操作它们。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8Java%E6%95%B0%E7%BB%84.e)

---

### 取数组成员

- 原文链接：https://esdn.ijingyi.com/title-14265.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．取数组成员 （ 数组标志符 ， 成员索引 ， 取出的值 ）
- 功能说明：取出指定数组中指定成员并存放到本方法的第三个参数中。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组标志符 | 必填 | 整数型 | 指定要取其数据成员的Java数组。为“创建数组()”方法的返回值，注意不要混用不同数据类型的数组。 |
| 成员索引 | 必填 | 整数型 | 指定欲取其值的数组成员的索引。索引值从0开始。 |
| 取出的值 | 必填 | 通用型，参数数据只能提供变量 | 存放从数组中取出的值。注意：要保证本参数的数据类型与数组所能容纳的数据类型一致。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd50.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出 java 的数组类的单元的数据。 参见 : 例程

**完整正文（站点原文转换）**

**取数组成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取出指定数组中指定成员并存放到本方法的第三个参数中。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．取数组成员 （数组标志符， 成员索引， 取出的值）

| 参数名 | 描 述 |
| --- | --- |
| 数组标志符 | 必需的 ； 整数型。指定要取其数据成员的Java数组。为“创建数组()”方法的返回值，注意不要混用不同数据类型的数组。 |
| 成员索引 | 必需的 ； 整数型。指定欲取其值的数组成员的索引。索引值从0开始。 |
| 取出的值 | 必需的 ； 通用型，参数数据只能提供变量。存放从数组中取出的值。注意：要保证本参数的数据类型与数组所能容纳的数据类型一致。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd50.files/image001.gif)

说明:

取出java的数组类的单元的数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E6%95%B0%E7%BB%84.e)

---

### 置数组成员

- 原文链接：https://esdn.ijingyi.com/title-14266.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置数组成员 （ 数组标志符 ， 成员索引 ， 值 ）
- 功能说明：成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组标志符 | 必填 | 整数型 | 指定要对其数据成员赋值的Java数组。可为“创建数组()”方法的返回值，注意不要混用不同基本数据类型的数组。 |
| 成员索引 | 必填 | 整数型 | 指定欲对其赋值的数组成员的索引。索引值从0开始。 |
| 值 | 必填 | 通用型 | 欲赋给指定数组成员的值。注意：要保证本参数的数据类型与数组所能容纳的数据类型一致。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd51.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 向 java 数组类的单元添入数据。 参见 : 例程

**完整正文（站点原文转换）**

**置数组成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．置数组成员 （数组标志符， 成员索引， 值）

| 参数名 | 描 述 |
| --- | --- |
| 数组标志符 | 必需的 ； 整数型。指定要对其数据成员赋值的Java数组。可为“创建数组()”方法的返回值，注意不要混用不同基本数据类型的数组。 |
| 成员索引 | 必需的 ； 整数型。指定欲对其赋值的数组成员的索引。索引值从0开始。 |
| 值 | 必需的 ； 通用型。欲赋给指定数组成员的值。注意：要保证本参数的数据类型与数组所能容纳的数据类型一致。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd51.files/image001.gif)

说明:

向java数组类的单元添入数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E6%95%B0%E7%BB%84.e)

---

### 创建对象数组

- 原文链接：https://esdn.ijingyi.com/title-14267.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．创建对象数组 （ 数组大小 ， 类标志符 ， 初始对象标志符 ）
- 功能说明：创建一个可以容纳Java对象(object)的数组。返回创建后的数组标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组大小 | 必填 | 整数型 |  |
| 类标志符 | 必填 | 整数型 | 指定该数组用于存放何种“类(class)”。 |
| 初始对象标志符 | 必填 | 整数型 | 指定该数组所有成员的初始值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd52.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建 java 的数组类 ，这个数组的类型为非基本类型。 参见 : 例程

**完整正文（站点原文转换）**

**创建对象数组 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

创建一个可以容纳Java对象(object)的数组。返回创建后的数组标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．创建对象数组 （数组大小， 类标志符， 初始对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 数组大小 | 必需的 ； 整数型。 |
| 类标志符 | 必需的 ； 整数型。指定该数组用于存放何种“类(class)”。 |
| 初始对象标志符 | 必需的 ； 整数型。指定该数组所有成员的初始值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd52.files/image001.gif)

说明:

创建java的数组类 ，这个数组的类型为非基本类型。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E6%95%B0%E7%BB%84.e)

---

### 取对象数组成员

- 原文链接：https://esdn.ijingyi.com/title-14268.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取对象数组成员 （ 数组标志符 ， 成员索引 ）
- 功能说明：取指定“对象数组”中的某一个成员，由参数“成员索引”指定取该数组的哪一个成员。返回该成员的对象标志符，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组标志符 | 必填 | 整数型 | 指定欲取其成员的Java对象数组。 |
| 成员索引 | 必填 | 整数型 | 指定欲取数组的第几个成员。索引值从0开始。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd53.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出 java 的数组类的单元信息，这个类型为非基本类型。 参见 : 例程

**完整正文（站点原文转换）**

**取对象数组成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

取指定“对象数组”中的某一个成员，由参数“成员索引”指定取该数组的哪一个成员。返回该成员的对象标志符，失败返回0。

*语法：*  整数型  *Java本地接口*．取对象数组成员 （数组标志符， 成员索引）

| 参数名 | 描 述 |
| --- | --- |
| 数组标志符 | 必需的 ； 整数型。指定欲取其成员的Java对象数组。 |
| 成员索引 | 必需的 ； 整数型。指定欲取数组的第几个成员。索引值从0开始。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd53.files/image001.gif)

说明:

取出java的数组类的单元信息，这个类型为非基本类型。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E6%95%B0%E7%BB%84.e)

---

### 置对象数组成员

- 原文链接：https://esdn.ijingyi.com/title-14269.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．置对象数组成员 （ 数组标志符 ， 成员索引 ， 欲赋值的对象标志符 ）
- 功能说明：为Java“对象数组”的指定成员赋值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数组标志符 | 必填 | 整数型 | 指定欲赋值的Java对象数组。 |
| 成员索引 | 必填 | 整数型 | 指定欲对其赋值的成员索引。索引值从0开始。 |
| 欲赋值的对象标志符 | 必填 | 整数型 | 指定欲赋值的对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd54.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出 java 对象数组类的单元的数据信息。 参见 : 例程

**完整正文（站点原文转换）**

**置对象数组成员 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

为Java“对象数组”的指定成员赋值。

*语法：*  逻辑型  *Java本地接口*．置对象数组成员 （数组标志符， 成员索引， 欲赋值的对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 数组标志符 | 必需的 ； 整数型。指定欲赋值的Java对象数组。 |
| 成员索引 | 必需的 ； 整数型。指定欲对其赋值的成员索引。索引值从0开始。 |
| 欲赋值的对象标志符 | 必需的 ； 整数型。指定欲赋值的对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd54.files/image001.gif)

说明:

取出java对象数组类的单元的数据信息。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E4%BD%BF%E7%94%A8java%E6%95%B0%E7%BB%84.e)

---

### 抛出异常

- 原文链接：https://esdn.ijingyi.com/title-14270.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．抛出异常 （ 异常对象标志符 ）
- 功能说明：向Java虚拟机抛出一个已存在的异常对象。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 异常对象标志符 | 必填 | 整数型 | 指定欲抛出的Java异常对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd55.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 从 java 接口抛出 java 类在内部的异常错误信息值。 参见 : 例程

**完整正文（站点原文转换）**

**抛出异常 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

向Java虚拟机抛出一个已存在的异常对象。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．抛出异常 （异常对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 异常对象标志符 | 必需的 ； 整数型。指定欲抛出的Java异常对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd55.files/image001.gif)

说明:

从java接口抛出java类在内部的异常错误信息值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 抛出新异常

- 原文链接：https://esdn.ijingyi.com/title-14271.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．抛出新异常 （ 异常类标志符 ， 异常描述文本 ）
- 功能说明：创建一个异常对象，并向Java虚拟机抛出该异常对象。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 异常类标志符 | 必填 | 整数型，初始值为“0” | 指定欲创建的异常类，应为java.lang.Throwable或其子类。如果本参数为0，默认使用java.lang.Throwable。 |
| 异常描述文本 | 必填 | 文本型，初始值为“” |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd56.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 抛出类的执行异常，它的信息由用户定义。 参见 : 例程

**完整正文（站点原文转换）**

**抛出新异常 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

创建一个异常对象，并向Java虚拟机抛出该异常对象。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．抛出新异常 （异常类标志符， 异常描述文本）

| 参数名 | 描 述 |
| --- | --- |
| 异常类标志符 | 必需的 ； 整数型，初始值为“0”。指定欲创建的异常类，应为java.lang.Throwable或其子类。如果本参数为0，默认使用java.lang.Throwable。 |
| 异常描述文本 | 必需的 ； 文本型，初始值为“”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd56.files/image001.gif)

说明:

抛出类的执行异常，它的信息由用户定义。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 是否有异常

- 原文链接：https://esdn.ijingyi.com/title-14272.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．是否有异常 （ ）
- 功能说明：判断当前是否有正被抛出的异常对象。在调用“清除异常()”方法或Java代码处理该异常前，异常将始终保持抛出状态。如果有异常发生，返回“真”；否则返回“假”。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd57.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判读 java 类在执行中是否有异常。 参见 : 例程

**完整正文（站点原文转换）**

**是否有异常 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

判断当前是否有正被抛出的异常对象。在调用“清除异常()”方法或Java代码处理该异常前，异常将始终保持抛出状态。如果有异常发生，返回“真”；否则返回“假”。

*语法：*  逻辑型  *Java本地接口*．是否有异常 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd57.files/image001.gif)

说明:

判读java类在执行中是否有异常。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 取异常对象

- 原文链接：https://esdn.ijingyi.com/title-14273.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：整数型
- 语法：整数型 Java本地接口 ．取异常对象 （ ）
- 功能说明：返回当前正被抛出的异常对象。在调用“清除异常()”方法或Java代码处理该异常前，异常将始终保持抛出状态。如果有异常发生，返回该异常对象标志符；如果没有异常发生，返回0。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd58.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据需要，可取出程序当前抛出的异常对象，作进一步处理（比如再次抛出）。 参见 : 例程

**完整正文（站点原文转换）**

**取异常对象 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回当前正被抛出的异常对象。在调用“清除异常()”方法或Java代码处理该异常前，异常将始终保持抛出状态。如果有异常发生，返回该异常对象标志符；如果没有异常发生，返回0。

*语法：*  整数型  *Java本地接口*．取异常对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd58.files/image001.gif)

说明:

根据需要，可取出程序当前抛出的异常对象，作进一步处理（比如再次抛出）。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 输出异常

- 原文链接：https://esdn.ijingyi.com/title-14274.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．输出异常 （ ）
- 功能说明：将异常及堆栈的回溯信息文本输出到系统标准错误输出设备（例如stderr）。执行后将清除当前异常对象。成功返回“真”，失败返回“假”。本方法主要用于调试。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd59.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 输出 java 类在执行中的异常情况。 参见 : 例程

**完整正文（站点原文转换）**

**输出异常 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

将异常及堆栈的回溯信息文本输出到系统标准错误输出设备（例如stderr）。执行后将清除当前异常对象。成功返回“真”，失败返回“假”。本方法主要用于调试。

*语法：*  逻辑型  *Java本地接口*．输出异常 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd59.files/image001.gif)

说明:

输出java类在执行中的异常情况。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 取异常文本

- 原文链接：https://esdn.ijingyi.com/title-14275.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：文本型
- 语法：文本型 Java本地接口 ．取异常文本 （ ）
- 功能说明：返回当前异常对象的描述文本。执行后将清除当前异常对象。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd60.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 取出 java 类的异常的描述文本。 参见 : 例程

**完整正文（站点原文转换）**

**取异常文本 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

返回当前异常对象的描述文本。执行后将清除当前异常对象。

*语法：*  文本型  *Java本地接口*．取异常文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd60.files/image001.gif)

说明:

取出java类的异常的描述文本。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 清除异常

- 原文链接：https://esdn.ijingyi.com/title-14276.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．清除异常 （ ）
- 功能说明：清除当前抛出的所有异常。如果当前无异常，则不做任何操作。成功返回“真”，失败返回“假”。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd61.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 把 java 类的异常情况清除掉。 参见 : 例程

**完整正文（站点原文转换）**

**清除异常 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

清除当前抛出的所有异常。如果当前无异常，则不做任何操作。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．清除异常 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd61.files/image001.gif)

说明:

把java类的异常情况清除掉。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 致命错误

- 原文链接：https://esdn.ijingyi.com/title-14277.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．致命错误 （ 错误描述文本 ）
- 功能说明：抛出致命错误并且不希望Java虚拟机进行修复。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 错误描述文本 | 必填 | 文本型，初始值为“” |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd62.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将 java 的程序终止并信息提示。 参见 : 例程

**完整正文（站点原文转换）**

**致命错误 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

抛出致命错误并且不希望Java虚拟机进行修复。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．致命错误 （错误描述文本）

| 参数名 | 描 述 |
| --- | --- |
| 错误描述文本 | 必需的 ； 文本型，初始值为“”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd62.files/image001.gif)

说明:

将java的程序终止并信息提示。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.e)

---

### 进入监视

- 原文链接：https://esdn.ijingyi.com/title-14278.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．进入监视 （ 对象标志符 ）
- 功能说明：进入与指定对象所引用的基本Java对象相关联的监视程序。成功返回“真”，失败返回“假”。
每个Java对象都有一个相关联的监视程序。如果当前线程已经拥有与指定对象相关联的监视程序，它将使指示该线程进入监视程序次数的监视程序计数器增1。如果与指定对象相关联的监视程序并非由某个线程所拥有，则当前线程将变为该监视程序的所有者，同时将该监视程序的计数器设置为1。如果另一个线程已拥有与指定对象关联的监视程序，则在监视程序被释放前当前线程将处于等待状态。监视程序被释放后，当前线程将尝试重新获得所有权。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 可为常规Java对象或类对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd63.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 进入监视程序，监视 JAVA 对象 。 参见 : 例程

**完整正文（站点原文转换）**

**进入监视 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

进入与指定对象所引用的基本Java对象相关联的监视程序。成功返回“真”，失败返回“假”。
    每个Java对象都有一个相关联的监视程序。如果当前线程已经拥有与指定对象相关联的监视程序，它将使指示该线程进入监视程序次数的监视程序计数器增1。如果与指定对象相关联的监视程序并非由某个线程所拥有，则当前线程将变为该监视程序的所有者，同时将该监视程序的计数器设置为1。如果另一个线程已拥有与指定对象关联的监视程序，则在监视程序被释放前当前线程将处于等待状态。监视程序被释放后，当前线程将尝试重新获得所有权。

*语法：*  逻辑型  *Java本地接口*．进入监视 （对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。可为常规Java对象或类对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd63.files/image001.gif)

说明:

进入监视程序，监视JAVA对象。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%9B%91%E8%A7%86.e)

---

### 退出监视

- 原文链接：https://esdn.ijingyi.com/title-14279.html
- 操作系统支持：Windows 所属对象： Java本地接口
- 返回值类型：逻辑型
- 语法：逻辑型 Java本地接口 ．退出监视 （ 对象标志符 ）
- 功能说明：当前线程必须是与指定对象所引用的基本Java对象相关联的监视程序的所有者。线程将使指示进入监视程序次数的计数器减1。如果计数器的值变为0，当前线程释放监视程序。成功返回“真”，失败返回“假”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 对象标志符 | 必填 | 整数型 | 可为常规Java对象或类对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd64.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 退出对 JAVA 对象的监视。 参见 : 例程

**完整正文（站点原文转换）**

**退出监视 方法**   操作系统支持：Windows    所属对象：[Java本地接口](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/dt1.htm)

当前线程必须是与指定对象所引用的基本Java对象相关联的监视程序的所有者。线程将使指示进入监视程序次数的计数器减1。如果计数器的值变为0，当前线程释放监视程序。成功返回“真”，失败返回“假”。

*语法：*  逻辑型  *Java本地接口*．退出监视 （对象标志符）

| 参数名 | 描 述 |
| --- | --- |
| 对象标志符 | 必需的 ； 整数型。可为常规Java对象或类对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/cmd64.files/image001.gif)

说明:

退出对JAVA对象的监视。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/javalib//javalib/%E7%9B%91%E8%A7%86.e)

---

### 数组类型

- 原文链接：https://esdn.ijingyi.com/title-14222.html
- 操作系统支持：Windows 跳至： Java支持库
- 功能说明：用于“Java本地接口.创建数组()”方法的第二个参数，指定将创建可容纳何种基本数据类型的数组。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 逻辑型 | 待核实 | 待核实 | 常量值为 1 。 |
| 字节型 | 待核实 | 待核实 | 常量值为 2 。 |
| 字符型 | 待核实 | 待核实 | 常量值为 3 。 |
| 短整数型 | 待核实 | 待核实 | 常量值为 4 。 |
| 整数型 | 待核实 | 待核实 | 常量值为 5 。 |
| 长整数型 | 待核实 | 待核实 | 常量值为 6 。 |
| 小数型 | 待核实 | 待核实 | 常量值为 7 。 |
| 双精度小数型 | 待核实 | 待核实 | 常量值为 8 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**数组类型 枚举常量集合类型**   操作系统支持：Windows    跳至：[Java支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/Javalib/index.htm)

用于“Java本地接口.创建数组()”方法的第二个参数，指定将创建可容纳何种基本数据类型的数组。

| 成员 | 描 述 |
| --- | --- |
| 逻辑型 | 常量值为 1 。 |
| 字节型 | 常量值为 2 。 |
| 字符型 | 常量值为 3 。 |
| 短整数型 | 常量值为 4 。 |
| 整数型 | 常量值为 5 。 |
| 长整数型 | 常量值为 6 。 |
| 小数型 | 常量值为 7 。 |
| 双精度小数型 | 常量值为 8 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
