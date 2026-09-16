# PowerPoint2000支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-13490.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**PowerPoint2000支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本库用来操作MS PowerPoint 2000/XP/2003或以上版本,您的机器中必须装有PowerPoint2000或以上版本 。

操作系统支持： Windows

**窗口组件数据类型：**

| PPT程序 | PPT文稿 | PPT播放 |  |
| --- | --- | --- | --- |

**其它数据类型：**

| PPT格式 | 幻灯版式 | 文本方向 | 文本水平定位 |
| --- | --- | --- | --- |
| 文本垂直定位 | 过渡样式 | 视图类型 | PPT对齐方式 |
| 基准线对齐 | 打印方向 | 音效 | 动画高级模式 |
| 播放后效果 | 动画方式 | 文字动画级别 | 文字组效果 |
| 放映方式 | 放映类型 | 指针类型 |  |

## 命令分类：窗口组件数据类型（168 条）

### 左边

- 原文链接：https://esdn.ijingyi.com/title-13518.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**左边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.左边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

说明：

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 顶边

- 原文链接：https://esdn.ijingyi.com/title-13519.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**顶边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.顶边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

说明：

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 宽度

- 原文链接：https://esdn.ijingyi.com/title-13520.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**宽度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.宽度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

说明：

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 高度

- 原文链接：https://esdn.ijingyi.com/title-13521.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**高度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.高度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

说明：

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 标记

- 原文链接：https://esdn.ijingyi.com/title-13522.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 文本型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

这个例程中，我们首先在程序设置状态的时候把测试的 4 个按钮的标记分别写入文本型的“ 1 ”“ 2 ”“ 3 ”“ 4 ”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。 参见： 例程1

**完整正文（站点原文转换）**

**标记 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*文本型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.标记 =  文本型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

说明：

这个例程中，我们首先在程序设置状态的时候把测试的4个按钮的标记分别写入文本型的“1”“2”“3”“4”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.e)

---

### 可视

- 原文链接：https://esdn.ijingyi.com/title-13523.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的可视属性。 参见： 例程1

**完整正文（站点原文转换）**

**可视 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.可视 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

说明：

设置控件的可视属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 禁止

- 原文链接：https://esdn.ijingyi.com/title-13524.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的禁止属性。 参见： 例程1

**完整正文（站点原文转换）**

**禁止 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.禁止 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

说明：

设置控件的禁止属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 鼠标指针

- 原文链接：https://esdn.ijingyi.com/title-13525.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 字节集 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的鼠标指针。 参见： 例程1

**完整正文（站点原文转换）**

**鼠标指针 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*字节集*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.鼠标指针 =  字节集

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

说明：

设置控件的鼠标指针。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 左

- 原文链接：https://esdn.ijingyi.com/title-13526.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；PPT程序窗口的左坐标。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设 ppt 程 序左边（相对屏幕）的位置 参见： 例程 1

**完整正文（站点原文转换）**

**左 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；PPT程序窗口的左坐标。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_8.files/image001.gif)

说明

设ppt程序左边（相对屏幕）的位置

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 顶

- 原文链接：https://esdn.ijingyi.com/title-13527.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；PPT程序窗口的顶坐标。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 程序顶部（相对屏幕） 参见： 例程

**完整正文（站点原文转换）**

**顶 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；PPT程序窗口的顶坐标。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_9.files/image001.gif)

说明

设置ppt程序顶部（相对屏幕）

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 宽

- 原文链接：https://esdn.ijingyi.com/title-13528.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；PPT程序窗口的宽度。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_10.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设 置 ppt 的程序宽度 参见： 例程 1

**完整正文（站点原文转换）**

**宽 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；PPT程序窗口的宽度。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_10.files/image002.gif)

说明

设置ppt的程序宽度

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 高

- 原文链接：https://esdn.ijingyi.com/title-13529.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；PPT程序窗口的高度。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_11.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

Ppt 程序的高为高度编辑框的内容 参见： 例程 1

**完整正文（站点原文转换）**

**高 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；PPT程序窗口的高度。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_11.files/image002.gif)

说明

Ppt程序的高为高度编辑框的内容

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 标题

- 原文链接：https://esdn.ijingyi.com/title-13530.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；PPT程序窗口的标题。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 程序窗口的标题 参见： 例程 1

**完整正文（站点原文转换）**

**标题 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；PPT程序窗口的标题。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_12.files/image001.gif)

说明

设置ppt程序窗口的标题

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 位置

- 原文链接：https://esdn.ijingyi.com/title-13531.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；窗口的位置状态，为以下常量之一：1、#正常；2、#最小化；3、#最大化。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 的程序创建位置 参见： 例程 1

**完整正文（站点原文转换）**

**位置 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；窗口的位置状态，为以下常量之一：1、#正常；2、#最小化；3、#最大化。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_13.files/image001.gif)

说明

设置ppt的程序创建位置

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 显示

- 原文链接：https://esdn.ijingyi.com/title-13532.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；PPT程序窗口是否可见。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 程序是否显示程序窗口 参见： 例程 1

**完整正文（站点原文转换）**

**显示 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；PPT程序窗口是否可见。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_14.files/image001.gif)

说明

设置ppt程序是否显示程序窗口

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 版本

- 原文链接：https://esdn.ijingyi.com/title-13533.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；PPT程序的版本。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 程序创建出的程序窗口的版本 参见： 例程 1

**完整正文（站点原文转换）**

**版本 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；PPT程序的版本。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_15.files/image001.gif)

说明

设置ppt程序创建出的程序窗口的版本

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 显示比例

- 原文链接：https://esdn.ijingyi.com/title-13534.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；显示对象大小的变化范围，100表示100%,50表示50%。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_16.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 程序的显示幻灯窗口比例 参见： 例程 1

**完整正文（站点原文转换）**

**显示比例 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；显示对象大小的变化范围，100表示100%,50表示50%。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_16.files/image001.gif)

说明

设置ppt程序的显示幻灯窗口比例

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 是否已创建

- 原文链接：https://esdn.ijingyi.com/title-13535.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；判断PPT程序是否已创建。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_17.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示 ppt 程序是否创建出。 ( 如果为 1 就意味已创建 0 为失败 ) 参见： 例程 1

**完整正文（站点原文转换）**

**是否已创建 属性**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；判断PPT程序是否已创建。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p0_17.files/image001.gif)

说明

显示ppt程序是否创建出。(如果为1就意味已创建0为失败)

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 创建

- 原文链接：https://esdn.ijingyi.com/title-13536.html
- 操作系统支持：Windows 所属对象： PPT程序
- 返回值类型：逻辑型
- 语法：逻辑型 PPT程序 ．创建 （ ）
- 功能说明：创建PowerPoint程序对象，本对象原有内容将被释放。成功返回真，否则返回假。注意：在本支持库的任何操作前，必须要先使用本方法创建。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**创建 方法**   操作系统支持：Windows    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)

创建PowerPoint程序对象，本对象原有内容将被释放。成功返回真，否则返回假。注意：在本支持库的任何操作前，必须要先使用本方法创建。

*语法：*  逻辑型  *PPT程序*．创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

　
![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd0.files/image001.gif)

ppt程序创建出程序窗口（窗口不可视）

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 释放

- 原文链接：https://esdn.ijingyi.com/title-13537.html
- 操作系统支持：Windows 所属对象： PPT程序
- 返回值类型：无返回值
- 语法：无返回值 PPT程序 ．释放 （ ）
- 功能说明：将本对象释放，再次使用的时候需再次使用"创建"方法创建。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd1.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

释放 ppt 程序关联 参见： 例程

**完整正文（站点原文转换）**

**释放 方法**   操作系统支持：Windows    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)

将本对象释放，再次使用的时候需再次使用"创建"方法创建。

*语法：*  无返回值  *PPT程序*．释放 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd1.files/image002.gif)

说明

释放ppt程序关联

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 取程序对象

- 原文链接：https://esdn.ijingyi.com/title-13538.html
- 操作系统支持：Windows 所属对象： PPT程序
- 返回值类型：对象
- 语法：对象 PPT程序 ．取程序对象 （ ）
- 功能说明：获取PowerPoint提供的Application对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd2.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

ppt 程序取出程序的对象。 参见： 例程

**完整正文（站点原文转换）**

**取程序对象 方法**   操作系统支持：Windows    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)

获取PowerPoint提供的Application对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT程序*．取程序对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd2.files/image002.gif)

说明

ppt程序取出程序的对象。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 退出

- 原文链接：https://esdn.ijingyi.com/title-13539.html
- 操作系统支持：Windows 所属对象： PPT程序
- 返回值类型：无返回值
- 语法：无返回值 PPT程序 ．退出 （ ）
- 功能说明：退出PowerPoint程序。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd3.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

ppt 退出程序关联 参见： 例程

**完整正文（站点原文转换）**

**退出 方法**   操作系统支持：Windows    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)

退出PowerPoint程序。

*语法：*  无返回值  *PPT程序*．退出 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd3.files/image001.gif)

说明

ppt退出程序关联

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 激活窗口

- 原文链接：https://esdn.ijingyi.com/title-13540.html
- 操作系统支持：Windows 所属对象： PPT程序
- 返回值类型：无返回值
- 语法：无返回值 PPT程序 ．激活窗口 （ ）
- 功能说明：激活PowerPoint程序的窗口。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd4.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

激活 ppt 程序窗口 参见： 例程

**完整正文（站点原文转换）**

**激活窗口 方法**   操作系统支持：Windows    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)

激活PowerPoint程序的窗口。

*语法：*  无返回值  *PPT程序*．激活窗口 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd4.files/image001.gif)

说明

激活ppt程序窗口

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/ppt%E7%A8%8B%E5%BA%8F.e)

---

### 新文稿

- 原文链接：https://esdn.ijingyi.com/title-13541.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _新文稿 （ 文稿对象 ）
- 功能说明：在新建一个演示文稿后随即发生。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-0.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

新文稿时信息框显 示文稿对象是 否存在 参见： 例程 1

**完整正文（站点原文转换）**

**新文稿 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    在新建一个演示文稿后随即发生。

*语法：*  无返回值  _*PPT程序*_新文稿 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-0.files/image001.gif)

说明

新文稿时信息框显示文稿对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 文稿被关闭

- 原文链接：https://esdn.ijingyi.com/title-13542.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _文稿被关闭 （ 文稿对象 ）
- 功能说明：一旦关闭任意打开的演示文稿即发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-1.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显 示文稿对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**文稿被关闭 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    一旦关闭任意打开的演示文稿即发生此事件。

*语法：*  无返回值  _*PPT程序*_文稿被关闭 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-1.files/image001.gif)

说明

信息框显示文稿对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 新建幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13543.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _新建幻灯片 （ 幻灯片对象 ）
- 功能说明：当在任意打开的演示文稿中新建幻灯片时将发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 幻灯片对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Slide对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-2.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示 幻灯片对象是 否存在 参见： 例程 1

**完整正文（站点原文转换）**

**新建幻灯片 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当在任意打开的演示文稿中新建幻灯片时将发生此事件。

*语法：*  无返回值  _*PPT程序*_新建幻灯片 （幻灯片对象）

| 参数名 | 描 述 |
| --- | --- |
| 幻灯片对象 | 对象； PowerPoint提供的Slide对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-2.files/image001.gif)

说明

信息框显示幻灯片对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 文稿被打开

- 原文链接：https://esdn.ijingyi.com/title-13544.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _文稿被打开 （ 文稿对象 ）
- 功能说明：打开已有演示文稿时即发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-3.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示 文稿对象是 否存在 参见： 例程 1

**完整正文（站点原文转换）**

**文稿被打开 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    打开已有演示文稿时即发生此事件。

*语法：*  无返回值  _*PPT程序*_文稿被打开 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-3.files/image001.gif)

说明

信息框显示文稿对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 文稿被打印

- 原文链接：https://esdn.ijingyi.com/title-13545.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _文稿被打印 （ 文稿对象 ）
- 功能说明：打印演示文稿前发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-4.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框 显示文稿对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**文稿被打印 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    打印演示文稿前发生此事件。

*语法：*  无返回值  _*PPT程序*_文稿被打印 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-4.files/image001.gif)

说明

信息框显示文稿对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 文稿被保存

- 原文链接：https://esdn.ijingyi.com/title-13546.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _文稿被保存 （ 文稿对象 ）
- 功能说明：保存任意打开的演示文稿前将发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-5.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显 示文稿对象是 否存在 参见： 例程 1

**完整正文（站点原文转换）**

**文稿被保存 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    保存任意打开的演示文稿前将发生此事件。

*语法：*  无返回值  _*PPT程序*_文稿被保存 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-5.files/image001.gif)

说明

信息框显示文稿对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 开始放映

- 原文链接：https://esdn.ijingyi.com/title-13547.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _开始放映 （ 播放窗对象 ）
- 功能说明：当启动一个幻灯片放映时将发生此事件。Microsoft PowerPoint 会创建幻灯片放映窗口并将其传递给此事件。如果从某个幻灯片放映切换到另一个幻灯片放映，那么此时第二个幻灯片放映再次显示时，该事件将不会发生。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 播放窗对象 | 待核实 | 待核实 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-6.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示 播放窗对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**开始放映 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当启动一个幻灯片放映时将发生此事件。Microsoft PowerPoint 会创建幻灯片放映窗口并将其传递给此事件。如果从某个幻灯片放映切换到另一个幻灯片放映，那么此时第二个幻灯片放映再次显示时，该事件将不会发生。

*语法：*  无返回值  _*PPT程序*_开始放映 （播放窗对象）

| 参数名 | 描 述 |
| --- | --- |
| 播放窗对象 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-6.files/image001.gif)

说明

信息框显示播放窗对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 结束放映

- 原文链接：https://esdn.ijingyi.com/title-13548.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _结束放映 （ 文稿对象 ）
- 功能说明：在幻灯片放映结束后发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-7.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框 显示播放窗对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**结束放映 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    在幻灯片放映结束后发生此事件。

*语法：*  无返回值  _*PPT程序*_结束放映 （文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-7.files/image001.gif)

说明

信息框显示播放窗对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 动画执行前

- 原文链接：https://esdn.ijingyi.com/title-13549.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _动画执行前 （ 播放窗对象 ）
- 功能说明：一旦鼠标单击或定时动画启动即发生此事件，但此事件在动画对象可见前发生。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 播放窗对象 | 待核实 | 待核实 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显 示播放窗对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**动画执行前 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    一旦鼠标单击或定时动画启动即发生此事件，但此事件在动画对象可见前发生。

*语法：*  无返回值  _*PPT程序*_动画执行前 （播放窗对象）

| 参数名 | 描 述 |
| --- | --- |
| 播放窗对象 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-8.files/image001.gif)

说明

信息框显示播放窗对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 下一幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13550.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _下一幻灯片 （ 播放窗对象 ）
- 功能说明：一旦切换到下一张幻灯片即发生此事件。对于第一张幻灯片，此事件会在 SlideShowBegin 事件之后发生。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 播放窗对象 | 待核实 | 待核实 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显 示播放窗对象是否存在 参见： 例程1

**完整正文（站点原文转换）**

**下一幻灯片 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    一旦切换到下一张幻灯片即发生此事件。对于第一张幻灯片，此事件会在 SlideShowBegin 事件之后发生。

*语法：*  无返回值  _*PPT程序*_下一幻灯片 （播放窗对象）

| 参数名 | 描 述 |
| --- | --- |
| 播放窗对象 | 对象； PowerPoint提供的SlideShowWindow对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-9.files/image001.gif)

说明

信息框显示播放窗对象是否存在

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 窗口被激活

- 原文链接：https://esdn.ijingyi.com/title-13551.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _窗口被激活 （ 文稿对象 ， 文档窗对象 ）
- 功能说明：当激活某个应用程序窗口或任意文档窗口时发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |
| 文档窗对象 | 待核实 | 待核实 | 对象； PowerPoint提供的DocumentWindow对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-10.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框先 后显示文稿对象和文档窗对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**窗口被激活 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当激活某个应用程序窗口或任意文档窗口时发生此事件。

*语法：*  无返回值  _*PPT程序*_窗口被激活 （文稿对象， 文档窗对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |
| 文档窗对象 | 对象； PowerPoint提供的DocumentWindow对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-10.files/image001.gif)

说明

信息框先后显示文稿对象和文档窗对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 双击前

- 原文链接：https://esdn.ijingyi.com/title-13552.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _双击前 （ 选择区对象 ， 取消 ）
- 功能说明：当双击下表列出的视图中的项目时发生此事件，形状/幻灯片/幻灯片图像。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 选择区对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |
| 取消 | 待核实 | 待核实 | 逻辑型； 传址；当此事件发生时，为"假"。如果事件过程将此参数设置为"真"，则当此过程完成后，默认的双击动作将不会执行。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-11.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示 选择区对象是否存在和取消是否成功 参见： 例程 1

**完整正文（站点原文转换）**

**双击前 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当双击下表列出的视图中的项目时发生此事件，形状/幻灯片/幻灯片图像。

*语法：*  无返回值  _*PPT程序*_双击前 （选择区对象， 取消）

| 参数名 | 描 述 |
| --- | --- |
| 选择区对象 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |
| 取消 | 逻辑型； 传址；当此事件发生时，为"假"。如果事件过程将此参数设置为"真"，则当此过程完成后，默认的双击动作将不会执行。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-11.files/image001.gif)

说明

信息框显示选择区对象是否存在和取消是否成功

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 右键单击前

- 原文链接：https://esdn.ijingyi.com/title-13553.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _右键单击前 （ 选择区对象 ， 取消 ）
- 功能说明：当用鼠标右键单击某个形状、幻灯片、备注页或某些文本时将发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 选择区对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |
| 取消 | 待核实 | 待核实 | 逻辑型； 传址；当此事件发生时，为"假"。如果事件过程将此参数设置为"真"，则当此过程完成后，默认的右键单击动作将不会执行。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示 选择区对象是否存在和取消是否成功 参见： 例程 1

**完整正文（站点原文转换）**

**右键单击前 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当用鼠标右键单击某个形状、幻灯片、备注页或某些文本时将发生此事件。

*语法：*  无返回值  _*PPT程序*_右键单击前 （选择区对象， 取消）

| 参数名 | 描 述 |
| --- | --- |
| 选择区对象 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |
| 取消 | 逻辑型； 传址；当此事件发生时，为"假"。如果事件过程将此参数设置为"真"，则当此过程完成后，默认的右键单击动作将不会执行。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-12.files/image001.gif)

说明

信息框显示选择区对象是否存在和取消是否成功

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 窗口取消激活

- 原文链接：https://esdn.ijingyi.com/title-13554.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _窗口取消激活 （ 文稿对象 ， 文档窗对象 ）
- 功能说明：当应用程序窗口或任意文档窗口变为非激活状态时发生此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文稿对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |
| 文档窗对象 | 待核实 | 待核实 | 对象； PowerPoint提供的DocumentWindow对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显示文稿对象是否为空和文档窗对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**窗口取消激活 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当应用程序窗口或任意文档窗口变为非激活状态时发生此事件。

*语法：*  无返回值  _*PPT程序*_窗口取消激活 （文稿对象， 文档窗对象）

| 参数名 | 描 述 |
| --- | --- |
| 文稿对象 | 对象； PowerPoint提供的Presentation对象，与3.7版的对象兼容，可组合操作。 |
| 文档窗对象 | 对象； PowerPoint提供的DocumentWindow对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-13.files/image001.gif)

说明

信息框显示文稿对象是否为空和文档窗对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 选择区被改变

- 原文链接：https://esdn.ijingyi.com/title-13555.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ PPT程序 _选择区被改变 （ 选择区对象 ）
- 功能说明：当活动文档窗口中选定的文本、形状或幻灯片发生变化时（无论通过用户界面或通过代码），此事件将发生。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 选择区对象 | 待核实 | 待核实 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

信息框显 示选择区对象是否存在 参见： 例程 1

**完整正文（站点原文转换）**

**选择区被改变 事件**    所属对象：[PPT程序](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt0.htm)
   操作系统支持：Windows

    当活动文档窗口中选定的文本、形状或幻灯片发生变化时（无论通过用户界面或通过代码），此事件将发生。

*语法：*  无返回值  _*PPT程序*_选择区被改变 （选择区对象）

| 参数名 | 描 述 |
| --- | --- |
| 选择区对象 | 对象； PowerPoint提供的Selection对象，与3.7版的对象兼容，可组合操作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/e0-14.files/image001.gif)

说明

信息框显示选择区对象是否存在

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 左边

- 原文链接：https://esdn.ijingyi.com/title-13558.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**左边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.左边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

说明：

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 顶边

- 原文链接：https://esdn.ijingyi.com/title-13559.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**顶边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.顶边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

说明：

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 宽度

- 原文链接：https://esdn.ijingyi.com/title-13560.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**宽度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.宽度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

说明：

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 高度

- 原文链接：https://esdn.ijingyi.com/title-13561.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**高度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.高度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

说明：

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 标记

- 原文链接：https://esdn.ijingyi.com/title-13562.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 文本型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

这个例程中，我们首先在程序设置状态的时候把测试的 4 个按钮的标记分别写入文本型的“ 1 ”“ 2 ”“ 3 ”“ 4 ”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。 参见： 例程1

**完整正文（站点原文转换）**

**标记 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*文本型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.标记 =  文本型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

说明：

这个例程中，我们首先在程序设置状态的时候把测试的4个按钮的标记分别写入文本型的“1”“2”“3”“4”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.e)

---

### 可视

- 原文链接：https://esdn.ijingyi.com/title-13563.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的可视属性。 参见： 例程1

**完整正文（站点原文转换）**

**可视 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.可视 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

说明：

设置控件的可视属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 禁止

- 原文链接：https://esdn.ijingyi.com/title-13564.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的禁止属性。 参见： 例程1

**完整正文（站点原文转换）**

**禁止 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.禁止 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

说明：

设置控件的禁止属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 鼠标指针

- 原文链接：https://esdn.ijingyi.com/title-13565.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 字节集 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的鼠标指针。 参见： 例程1

**完整正文（站点原文转换）**

**鼠标指针 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*字节集*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.鼠标指针 =  字节集

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

说明：

设置控件的鼠标指针。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 幻灯片数量

- 原文链接：https://esdn.ijingyi.com/title-13566.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；当前文稿(Presentation)中幻灯片的数量。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得幻灯片的数量，并保存到变量中去 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片数量 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；当前文稿(Presentation)中幻灯片的数量。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_8.files/image001.gif)

说明

取得幻灯片的数量，并保存到变量中去

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 幻灯片索引

- 原文链接：https://esdn.ijingyi.com/title-13567.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；当前指向的幻灯片的索引。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的索引 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片索引 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；当前指向的幻灯片的索引。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_9.files/image001.gif)

说明

设置幻灯片的索引

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 隐藏幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13568.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；当前"幻灯片索引"所指向的幻灯片是否隐藏。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_10.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片隐藏 参见： 例程1

**完整正文（站点原文转换）**

**隐藏幻灯片 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；当前"幻灯片索引"所指向的幻灯片是否隐藏。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_10.files/image001.gif)

说明

设置幻灯片隐藏

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E8%89%BA%E6%9C%AF%E5%AD%97%E6%8F%92%E5%85%A5.e)

---

### 幻灯片版式

- 原文链接：https://esdn.ijingyi.com/title-13569.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；当前"幻灯片索引"所指向的幻灯片的幻灯片版式，使用枚举常量"幻灯版式"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_11.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置当前幻灯片的版式 参见： 例 程1

**完整正文（站点原文转换）**

**幻灯片版式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；当前"幻灯片索引"所指向的幻灯片的幻灯片版式，使用枚举常量"幻灯版式"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_11.files/image001.gif)

说明

设置当前幻灯片的版式

参见：[例 程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 图形索引

- 原文链接：https://esdn.ijingyi.com/title-13570.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；当前指向的图形(Shape)的索引。该方法为运行时只写属性，读取的值无意义。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的当前设置图形对象的图形索引 参见： 例程1

**完整正文（站点原文转换）**

**图形索引 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；当前指向的图形(Shape)的索引。该方法为运行时只写属性，读取的值无意义。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_12.files/image001.gif)

说明

设置幻灯片的当前设置图形对象的图形索引

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 黑白视图

- 原文链接：https://esdn.ijingyi.com/title-13571.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；文档窗口是否为为黑白显示模式。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置当前幻灯片黑白视图模式 参见： 例程1

**完整正文（站点原文转换）**

**黑白视图 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；文档窗口是否为为黑白显示模式。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_13.files/image001.gif)

说明

设置当前幻灯片黑白视图模式

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 视图类型

- 原文链接：https://esdn.ijingyi.com/title-13572.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；使用枚举常量"视图类型"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片播放的视图类型 参见： 例程1

**完整正文（站点原文转换）**

**视图类型 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；使用枚举常量"视图类型"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_14.files/image001.gif)

说明

设置幻灯片播放的视图类型

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 对齐方式

- 原文链接：https://esdn.ijingyi.com/title-13573.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；文字的对齐方式,使用枚举常量"PPT对齐方式"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片字体的对齐方式 参见： 例程1

**完整正文（站点原文转换）**

**对齐方式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；文字的对齐方式,使用枚举常量"PPT对齐方式"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_15.files/image001.gif)

说明

设置幻灯片字体的对齐方式

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 基准线对齐方式

- 原文链接：https://esdn.ijingyi.com/title-13574.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；文字基准线对齐方式，使用枚举常量"基准线对齐"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_16.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的基准线对齐方式 参见： 例程1

**完整正文（站点原文转换）**

**基准线对齐方式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；文字基准线对齐方式，使用枚举常量"基准线对齐"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_16.files/image001.gif)

说明

设置幻灯片的基准线对齐方式

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 侧面压缩

- 原文链接：https://esdn.ijingyi.com/title-13575.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否侧面压缩。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_18.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置字体侧面压缩。 参见： 例程1

**完整正文（站点原文转换）**

**侧面压缩 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否侧面压缩。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_18.files/image001.gif)

说明

设置字体侧面压缩。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 基准线偏移

- 原文链接：https://esdn.ijingyi.com/title-13576.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定的上标或下标字符的基准线偏移。可为 -1 到 1 之间的浮点数。-1 代表 - 100 % 的偏移，1 代表 100 %的偏移。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的基准线偏移的量 参见： 例程1

**完整正文（站点原文转换）**

**基准线偏移 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定的上标或下标字符的基准线偏移。可为 -1 到 1 之间的浮点数。-1 代表 - 100 % 的偏移，1 代表 100 %的偏移。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_19.files/image001.gif)

说明

设置文稿的基准线偏移的量

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体加粗

- 原文链接：https://esdn.ijingyi.com/title-13577.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否加粗。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_20.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的字体的字体加粗效果 参见： 例程1

**完整正文（站点原文转换）**

**字体加粗 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否加粗。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_20.files/image001.gif)

说明

设置文稿的字体的字体加粗效果

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体颜色

- 原文链接：https://esdn.ijingyi.com/title-13578.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；字体的RGB颜色。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_21.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的对象字体的字体颜色 参见： 例程1

**完整正文（站点原文转换）**

**字体颜色 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；字体的RGB颜色。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_21.files/image001.gif)

说明

设置文稿的对象字体的字体颜色

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体可否嵌入

- 原文链接：https://esdn.ijingyi.com/title-13579.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 只读；字体是否可以嵌入到演示文稿中。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示文稿设置的字体可否嵌入。 参见： 例程1

**完整正文（站点原文转换）**

**字体可否嵌入 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 只读；字体是否可以嵌入到演示文稿中。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_22.files/image001.gif)

说明

显示文稿设置的字体可否嵌入。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体已嵌入

- 原文链接：https://esdn.ijingyi.com/title-13580.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 只读；字体是否已经嵌入到文稿中。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_23.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示文稿设置的字体是否已嵌入。 参见： 例程1

**完整正文（站点原文转换）**

**字体已嵌入 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 只读；字体是否已经嵌入到文稿中。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_23.files/image001.gif)

说明

显示文稿设置的字体是否已嵌入。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 阳文

- 原文链接：https://esdn.ijingyi.com/title-13581.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否使用阳文。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_24.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿字体使用阳文。 参见： 例程1

**完整正文（站点原文转换）**

**阳文 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否使用阳文。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_24.files/image001.gif)

说明

设置文稿字体使用阳文。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体倾斜

- 原文链接：https://esdn.ijingyi.com/title-13582.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否倾斜。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_25.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置字体是否倾斜显示。 参见： 例程1

**完整正文（站点原文转换）**

**字体倾斜 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否倾斜。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_25.files/image001.gif)

说明

设置字体是否倾斜显示。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体名

- 原文链接：https://esdn.ijingyi.com/title-13583.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；字体的名称，例如："宋体"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 ppt 文稿的字体名为字体变量的字体名成员 参见： 例程1

**完整正文（站点原文转换）**

**字体名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；字体的名称，例如："宋体"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_26.files/image001.gif)

说明

设置ppt文稿的字体名为字体变量的字体名成员

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 远东字体名

- 原文链接：https://esdn.ijingyi.com/title-13584.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；远东字体的名称。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_27.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的字体的远东字体名为 字体 的 远东字体名 的成员。 参见： 例程1

**完整正文（站点原文转换）**

**远东字体名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；远东字体的名称。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_27.files/image001.gif)

说明

设置文稿的字体的远东字体名为字体的远东字体名的成员。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 字体大小

- 原文链接：https://esdn.ijingyi.com/title-13585.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；字体的大小。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_28.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的字体大小属性。 参见： 例程1

**完整正文（站点原文转换）**

**字体大小 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；字体的大小。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_28.files/image001.gif)

说明

设置文稿的字体大小属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 下标

- 原文链接：https://esdn.ijingyi.com/title-13586.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否使用下标。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的字体使用下标的属性。 参见： 例程1

**完整正文（站点原文转换）**

**下标 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否使用下标。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_29.files/image001.gif)

说明

设置文稿的字体使用下标的属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 上标

- 原文链接：https://esdn.ijingyi.com/title-13587.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否使用上标。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿字体的使用上标的属性。 参见： 例程1

**完整正文（站点原文转换）**

**上标 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否使用上标。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_30.files/image001.gif)

说明

设置文稿字体的使用上标的属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 下划线

- 原文链接：https://esdn.ijingyi.com/title-13588.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；字体是否使用下划线。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿字体使用下划线的属性。 参见： 例程1

**完整正文（站点原文转换）**

**下划线 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；字体是否使用下划线。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_31.files/image001.gif)

说明

设置文稿字体使用下划线的属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 页面设置

- 原文链接：https://esdn.ijingyi.com/title-13589.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 只读；注意：该属性不可读写。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示文稿设置的幻灯的页面设置的值。 参见： 例程1

**完整正文（站点原文转换）**

**页面设置 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 只读；注意：该属性不可读写。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_32.files/image001.gif)

说明

显示文稿设置的幻灯的页面设置的值。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 首幻灯片索引

- 原文链接：https://esdn.ijingyi.com/title-13590.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；文稿中第一张幻灯片的编号。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的幻灯片的首张的幻灯编号，为幻灯编号编辑框的内容。 参见： 例程1

**完整正文（站点原文转换）**

**首幻灯片索引 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；文稿中第一张幻灯片的编号。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_33.files/image001.gif)

说明

设置文稿的幻灯片的首张的幻灯编号，为幻灯编号编辑框的内容。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 备注打印方向

- 原文链接：https://esdn.ijingyi.com/title-13591.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；备注的打印方向，使用枚举常量"打印方向"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_34.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的备注的打印方向为垂直打印。 参见： 例程1

**完整正文（站点原文转换）**

**备注打印方向 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；备注的打印方向，使用枚举常量"打印方向"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_34.files/image001.gif)

说明

设置文稿的备注的打印方向为垂直打印。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 幻灯片打印方向

- 原文链接：https://esdn.ijingyi.com/title-13592.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片的打印方向，使用枚举常量"打印方向"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_35.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的打印方向为水平。 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片打印方向 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片的打印方向，使用枚举常量"打印方向"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_35.files/image001.gif)

说明

设置幻灯片的打印方向为水平。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 幻灯片宽度

- 原文链接：https://esdn.ijingyi.com/title-13593.html
- 操作系统支持：Windows
- 功能说明：数据类型： 双精度小数型 ； 设计时不可用；幻灯片的宽度，磅为单位。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_36.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置文稿的当前幻灯的幻灯片的宽度为 300 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片宽度 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*双精度小数型*； 设计时不可用；幻灯片的宽度，磅为单位。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_36.files/image001.gif)

说明

设置文稿的当前幻灯的幻灯片的宽度为300

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 幻灯片高度

- 原文链接：https://esdn.ijingyi.com/title-13594.html
- 操作系统支持：Windows
- 功能说明：数据类型： 双精度小数型 ； 设计时不可用；幻灯片的高度，磅为单位。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_37.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置当前幻灯的幻灯片的高度为 300 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片高度 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*双精度小数型*； 设计时不可用；幻灯片的高度，磅为单位。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_37.files/image001.gif)

说明

设置当前幻灯的幻灯片的高度为300

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 幻灯片大小

- 原文链接：https://esdn.ijingyi.com/title-13595.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片的大小，为以下常量之一：1、#屏幕大小；2、#Letter纸张(8.5 x 11)英寸；3、#A4纸张；4、#35毫米；5、#投影仪幻灯片；6、#横幅；7、#自定义；。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的大小为 7 （用户定义） 参见： 例程1

**完整正文（站点原文转换）**

**幻灯片大小 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片的大小，为以下常量之一：1、#屏幕大小；2、#Letter纸张(8.5 x 11)英寸；3、#A4纸张；4、#35毫米；5、#投影仪幻灯片；6、#横幅；7、#自定义；。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_38.files/image001.gif)

说明

设置幻灯片的大小为7（用户定义）

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 切换方式

- 原文链接：https://esdn.ijingyi.com/title-13596.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 只读；注意：该属性不可读写。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示文稿设置的幻灯切换方式的值。 参见： 例程1

**完整正文（站点原文转换）**

**切换方式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 只读；注意：该属性不可读写。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_39.files/image001.gif)

说明

显示文稿设置的幻灯切换方式的值。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 单击切换

- 原文链接：https://esdn.ijingyi.com/title-13597.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片是否被单击时换片。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_40.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片被单击时换片到下一张幻灯 参见： 例程1

**完整正文（站点原文转换）**

**单击切换 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片是否被单击时换片。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_40.files/image001.gif)

说明

设置幻灯片被单击时换片到下一张幻灯

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 定时切换

- 原文链接：https://esdn.ijingyi.com/title-13598.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片是否在指定时间后自动换片。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_41.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片在指定时间后自动换片到下一张的幻灯 参见： 例程1

**完整正文（站点原文转换）**

**定时切换 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片是否在指定时间后自动换片。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_41.files/image001.gif)

说明

设置幻灯片在指定时间后自动换片到下一张的幻灯

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换间隔

- 原文链接：https://esdn.ijingyi.com/title-13599.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定的幻灯片切换在多长时间后发生，以秒计。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_42.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置一张幻灯切换来的间隔时间。 参见： 例程1

**完整正文（站点原文转换）**

**切换间隔 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定的幻灯片切换在多长时间后发生，以秒计。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_42.files/image001.gif)

说明：

设置一张幻灯切换来的间隔时间。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换效果

- 原文链接：https://esdn.ijingyi.com/title-13600.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片转换的特殊效果，PpEntryEffect常数之一(参见PowerPoint2000开发文档)，为以下常数之一：-2、#ppEffectMixed；0、#ppEffectNone；257、#ppEffectCut；258、#ppEffectCutThroughBlack；513、#ppEffectRandom；769、#ppEffectBlindsHorizontal；770、#ppEffectBlindsVertical；1025、#ppEffectCheckerboardAcross；1026、#ppEffectCheckerboardDown；1281、#ppEffectCoverLeft；1282、#ppEffectCoverUp；1283、#ppEffectCoverRight；1284、#ppEffectCoverDown；1285、#ppEffectCoverLeftUp；1286、#ppEffectCoverRightUp；1287、#ppEffectCoverLeftDown；1288、#ppEffectCoverRightDown；1537、#ppEffectDissolve；1793、#ppEffectFade；2049、#ppEffectUncoverLeft；2050、#ppEffectUncoverUp；2051、#ppEffectUncoverRight；2052、#ppEffectUncoverDown；2053、#ppEffectUncoverLeftUp；2054、#ppEffectUncoverRightUp；2055、#ppEffectUncoverLeftDown；2056、#ppEffectUncoverRightDown；2305、#ppEffectRandomBarsHorizontal；2306、#ppEffectRandomBarsVertical；2561、#ppEffectStripsUpLeft；2562、#ppEffectStripsUpRight；2563、#ppEffectStripsDownLeft；2564、#ppEffectStripsDownRight；2565、#ppEffectStripsLeftUp；2566、#ppEffectStripsRightUp；2567、#ppEffectStripsLeftDown；2568、#ppEffectStripsRightDown；2817、#ppEffectWipeLeft；2818、#ppEffectWipeUp；2819、#ppEffectWipeRight；2820、#ppEffectWipeDown；3073、#ppEffectBoxOut；3074、#ppEffectBoxIn；3329、#ppEffectFlyFromLeft；3330、#ppEffectFlyFromTop；3331、#ppEffectFlyFromRight；3332、#ppEffectFlyFromBottom；3333、#ppEffectFlyFromTopLeft；3334、#ppEffectFlyFromTopRight；3335、#ppEffectFlyFromBottomLeft；3336、#ppEffectFlyFromBottomRight；3337、#ppEffectPeekFromLeft；3338、#ppEffectPeekFromDown；3339、#ppEffectPeekFromRight；3340、#ppEffectPeekFromUp；3341、#ppEffectCrawlFromLeft；3342、#ppEffectCrawlFromUp；3343、#ppEffectCrawlFromRight；3344、#ppEffectCrawlFromDown；3345、#ppEffectZoomIn；3346、#ppEffectZoomInSlightly；3347、#ppEffectZoomOut；3348、#ppEffectZoomOutSlightly；3349、#ppEffectZoomCenter；3350、#ppEffectZoomBottom；3351、#ppEffectStretchAcross；3352、#ppEffectStretchLeft；3353、#ppEffectStretchUp；3354、#ppEffectStretchRight；3355、#ppEffectStretchDown；3356、#ppEffectSwivel；3357、#ppEffectSpiral；3585、#ppEffectSplitHorizontalOut；3586、#ppEffectSplitHorizontalIn；3587、#ppEffectSplitVerticalOut；3588、#ppEffectSplitVerticalIn；3841、#ppEffectFlashOnceFast；3842、#ppEffectFlashOnceMedium；3843、#ppEffectFlashOnceSlow；3844、#ppEffectAppear；。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_43.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

指定幻灯片切换时的动画效果。 参见： 例程1

**完整正文（站点原文转换）**

**切换效果 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片转换的特殊效果，PpEntryEffect常数之一(参见PowerPoint2000开发文档)，为以下常数之一：-2、#ppEffectMixed；0、#ppEffectNone；257、#ppEffectCut；258、#ppEffectCutThroughBlack；513、#ppEffectRandom；769、#ppEffectBlindsHorizontal；770、#ppEffectBlindsVertical；1025、#ppEffectCheckerboardAcross；1026、#ppEffectCheckerboardDown；1281、#ppEffectCoverLeft；1282、#ppEffectCoverUp；1283、#ppEffectCoverRight；1284、#ppEffectCoverDown；1285、#ppEffectCoverLeftUp；1286、#ppEffectCoverRightUp；1287、#ppEffectCoverLeftDown；1288、#ppEffectCoverRightDown；1537、#ppEffectDissolve；1793、#ppEffectFade；2049、#ppEffectUncoverLeft；2050、#ppEffectUncoverUp；2051、#ppEffectUncoverRight；2052、#ppEffectUncoverDown；2053、#ppEffectUncoverLeftUp；2054、#ppEffectUncoverRightUp；2055、#ppEffectUncoverLeftDown；2056、#ppEffectUncoverRightDown；2305、#ppEffectRandomBarsHorizontal；2306、#ppEffectRandomBarsVertical；2561、#ppEffectStripsUpLeft；2562、#ppEffectStripsUpRight；2563、#ppEffectStripsDownLeft；2564、#ppEffectStripsDownRight；2565、#ppEffectStripsLeftUp；2566、#ppEffectStripsRightUp；2567、#ppEffectStripsLeftDown；2568、#ppEffectStripsRightDown；2817、#ppEffectWipeLeft；2818、#ppEffectWipeUp；2819、#ppEffectWipeRight；2820、#ppEffectWipeDown；3073、#ppEffectBoxOut；3074、#ppEffectBoxIn；3329、#ppEffectFlyFromLeft；3330、#ppEffectFlyFromTop；3331、#ppEffectFlyFromRight；3332、#ppEffectFlyFromBottom；3333、#ppEffectFlyFromTopLeft；3334、#ppEffectFlyFromTopRight；3335、#ppEffectFlyFromBottomLeft；3336、#ppEffectFlyFromBottomRight；3337、#ppEffectPeekFromLeft；3338、#ppEffectPeekFromDown；3339、#ppEffectPeekFromRight；3340、#ppEffectPeekFromUp；3341、#ppEffectCrawlFromLeft；3342、#ppEffectCrawlFromUp；3343、#ppEffectCrawlFromRight；3344、#ppEffectCrawlFromDown；3345、#ppEffectZoomIn；3346、#ppEffectZoomInSlightly；3347、#ppEffectZoomOut；3348、#ppEffectZoomOutSlightly；3349、#ppEffectZoomCenter；3350、#ppEffectZoomBottom；3351、#ppEffectStretchAcross；3352、#ppEffectStretchLeft；3353、#ppEffectStretchUp；3354、#ppEffectStretchRight；3355、#ppEffectStretchDown；3356、#ppEffectSwivel；3357、#ppEffectSpiral；3585、#ppEffectSplitHorizontalOut；3586、#ppEffectSplitHorizontalIn；3587、#ppEffectSplitVerticalOut；3588、#ppEffectSplitVerticalIn；3841、#ppEffectFlashOnceFast；3842、#ppEffectFlashOnceMedium；3843、#ppEffectFlashOnceSlow；3844、#ppEffectAppear；。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_43.files/image001.gif)

说明

指定幻灯片切换时的动画效果。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换隐藏

- 原文链接：https://esdn.ijingyi.com/title-13601.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片放映中"幻灯片索引"指向的幻灯片是否隐藏。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_44.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

文稿 的切换隐藏置为名称 切换隐藏选择 的选择框的选中 状态 参见： 例程1

**完整正文（站点原文转换）**

**切换隐藏 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片放映中"幻灯片索引"指向的幻灯片是否隐藏。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_44.files/image001.gif)

说明

文稿的切换隐藏置为名称切换隐藏选择的选择框的选中状态

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换速度

- 原文链接：https://esdn.ijingyi.com/title-13602.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；切换到指定幻灯片的速度，为以下常量之一：-2、#默认；1、#慢速；2、#中速；3、#快速；。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_45.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

文稿 的当前幻灯的切换（一个的幻灯的切换来时）速度为 2 （正常速 度） 参见： 例程1

**完整正文（站点原文转换）**

**切换速度 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；切换到指定幻灯片的速度，为以下常量之一：-2、#默认；1、#慢速；2、#中速；3、#快速；。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_45.files/image001.gif)

说明

文稿的当前幻灯的切换（一个的幻灯的切换来时）速度为2（正常速度）

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 循环播放声音

- 原文链接：https://esdn.ijingyi.com/title-13603.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定的换片声音是否为循环播放直到下一声音开始。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片切换时，是否循化播放切换音效或音效名 参见： 例程1

**完整正文（站点原文转换）**

**循环播放声音 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定的换片声音是否为循环播放直到下一声音开始。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_46.files/image001.gif)

说明

设置幻灯片切换时，是否循化播放切换音效或音效名

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换音效

- 原文链接：https://esdn.ijingyi.com/title-13604.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；切换的音效，使用枚举常量"音效"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_47.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

文稿 的属性切换音效。（此时切换音效文件无效） 参见： 例程1

**完整正文（站点原文转换）**

**切换音效 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；切换的音效，使用枚举常量"音效"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_47.files/image001.gif)

说明

文稿的属性切换音效。（此时切换音效文件无效）

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换音效名

- 原文链接：https://esdn.ijingyi.com/title-13605.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；出现在“幻灯片切换”对话框（位于“幻灯片放映”菜单）的“声音”框中的演示文稿的可用名称集。

- 参见：基本数据类型

**例程**

说 明 置 文稿 的切换音效名为 文件名 变量地址的内容 参见： 例程1

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_48.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**完整正文（站点原文转换）**

**切换音效名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；出现在“幻灯片切换”对话框（位于“幻灯片放映”菜单）的“声音”框中的演示文稿的可用名称集。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_48.files/image001.gif)

说明

置文稿的切换音效名为文件名变量地址的内容

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 切换声音文件名

- 原文链接：https://esdn.ijingyi.com/title-13606.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；设置切换时声音文件名，*.wav格式。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_49.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设 文稿 的切换声音文件名为运行目录的 ne.wav 的文件 参见： 例程1

**完整正文（站点原文转换）**

**切换声音文件名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；设置切换时声音文件名，*.wav格式。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_49.files/image001.gif)

说明

设文稿的切换声音文件名为运行目录的ne.wav的文件

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画效果

- 原文链接：https://esdn.ijingyi.com/title-13607.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 只读；注意：该属性不可读写。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_50.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

显示出文稿设置的播放动画效果的值。 参见： 例程1

**完整正文（站点原文转换）**

**动画效果 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 只读；注意：该属性不可读写。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_50.files/image001.gif)

说明

显示出文稿设置的播放动画效果的值。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画高级模式

- 原文链接：https://esdn.ijingyi.com/title-13608.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定的形状动画是仅当被单击时播放还是在一段指定时间后自动播放，使用枚举常量"动画高级模式"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_51.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的播放对象的播放时的高级模式属性 参见： 例程1

**完整正文（站点原文转换）**

**动画高级模式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定的形状动画是仅当被单击时播放还是在一段指定时间后自动播放，使用枚举常量"动画高级模式"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_51.files/image001.gif)

说明

设置幻灯片的播放对象的播放时的高级模式属性

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画延迟时间

- 原文链接：https://esdn.ijingyi.com/title-13609.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定形状自动播放动画的延迟时间，以秒计。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_52.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的播放对象的动画延迟播放的时间 参见： 例程1

**完整正文（站点原文转换）**

**动画延迟时间 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定形状自动播放动画的延迟时间，以秒计。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_52.files/image001.gif)

说明

设置幻灯片的播放对象的动画延迟播放的时间

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画播放后效果

- 原文链接：https://esdn.ijingyi.com/title-13610.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定形状在创建后是显示为变暗、隐藏、还是保持不变，使用枚举常量"播放后效果"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_53.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

置幻灯片的播放对象的播放后的显示效果 参见： 例程1

**完整正文（站点原文转换）**

**动画播放后效果 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定形状在创建后是显示为变暗、隐藏、还是保持不变，使用枚举常量"播放后效果"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_53.files/image001.gif)

说明

置幻灯片的播放对象的播放后的显示效果

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画是否放映

- 原文链接：https://esdn.ijingyi.com/title-13611.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定形状在幻灯片放映中是否显示动画。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_54.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

置幻灯片的播放对象的动画是否放映。 参见： 例程1

**完整正文（站点原文转换）**

**动画是否放映 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定形状在幻灯片放映中是否显示动画。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_54.files/image001.gif)

说明

置幻灯片的播放对象的动画是否放映。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画影响背景

- 原文链接：https://esdn.ijingyi.com/title-13612.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；如果指定对象是自选图形，则图形与其所含的文本分别动画时该属性值为"真"；如果指定形状是图表对象，则指定图表对象的背景（坐标轴和网格线）动画时该属性值为"真"。仅应用于包含可多步创建的文本的自选图形或者图表对象。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_55.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片中的几个图形对象的切换播放时是否影响背景 参见： 例程1

**完整正文（站点原文转换）**

**动画影响背景 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；如果指定对象是自选图形，则图形与其所含的文本分别动画时该属性值为"真"；如果指定形状是图表对象，则指定图表对象的背景（坐标轴和网格线）动画时该属性值为"真"。仅应用于包含可多步创建的文本的自选图形或者图表对象。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_55.files/image001.gif)

说明

设置幻灯片中的几个图形对象的切换播放时是否影响背景

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画逆序创建

- 原文链接：https://esdn.ijingyi.com/title-13613.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定形状是否按逆序创建。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_56.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的图形创建时是否按逆序创建。 参见： 例程1

**完整正文（站点原文转换）**

**动画逆序创建 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定形状是否按逆序创建。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_56.files/image001.gif)

说明

设置幻灯片的图形创建时是否按逆序创建。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画顺序

- 原文链接：https://esdn.ijingyi.com/title-13614.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指定形状在设为动画的形状集合中的位置。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_57.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片中的当前的创建的形状的动画顺序索引 参见： 例程1

**完整正文（站点原文转换）**

**动画顺序 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指定形状在设为动画的形状集合中的位置。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_57.files/image001.gif)

说明

设置幻灯片中的当前的创建的形状的动画顺序索引

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 形状组动画方式

- 原文链接：https://esdn.ijingyi.com/title-13615.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；该形状组动画是按序列、按类别、还是按元素激活，使用枚举常量"动画方式"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_58.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片中的当前的图形的动画时的播放的显示的方式。 参见： 例程1

**完整正文（站点原文转换）**

**形状组动画方式 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；该形状组动画是按序列、按类别、还是按元素激活，使用枚举常量"动画方式"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_58.files/image001.gif)

说明

设置幻灯片中的当前的图形的动画时的播放的显示的方式。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 渐变目的颜色

- 原文链接：https://esdn.ijingyi.com/title-13616.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；形状创建后的颜色，为RGB格式。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_59.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片中的图形对象的动画后的渐变的目的颜色（只有属性 动画播放后效果 设置为 渐变目的颜色 时才有效） 参见： 例程1

**完整正文（站点原文转换）**

**渐变目的颜色 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；形状创建后的颜色，为RGB格式。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_59.files/image001.gif)

说明

设置幻灯片中的图形对象的动画后的渐变的目的颜色（只有属性动画播放后效果设置为

渐变目的颜色时才有效）

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 形状动画效果

- 原文链接：https://esdn.ijingyi.com/title-13617.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；形状播放动画时的效果，为以下常量之一：-2、#ppEffectMixed；0、#ppEffectNone；257、#ppEffectCut；258、#ppEffectCutThroughBlack；513、#ppEffectRandom；769、#ppEffectBlindsHorizontal；770、#ppEffectBlindsVertical；1025、#ppEffectCheckerboardAcross；1026、#ppEffectCheckerboardDown；1281、#ppEffectCoverLeft；1282、#ppEffectCoverUp；1283、#ppEffectCoverRight；1284、#ppEffectCoverDown；1285、#ppEffectCoverLeftUp；1286、#ppEffectCoverRightUp；1287、#ppEffectCoverLeftDown；1288、#ppEffectCoverRightDown；1537、#ppEffectDissolve；1793、#ppEffectFade；2049、#ppEffectUncoverLeft；2050、#ppEffectUncoverUp；2051、#ppEffectUncoverRight；2052、#ppEffectUncoverDown；2053、#ppEffectUncoverLeftUp；2054、#ppEffectUncoverRightUp；2055、#ppEffectUncoverLeftDown；2056、#ppEffectUncoverRightDown；2305、#ppEffectRandomBarsHorizontal；2306、#ppEffectRandomBarsVertical；2561、#ppEffectStripsUpLeft；2562、#ppEffectStripsUpRight；2563、#ppEffectStripsDownLeft；2564、#ppEffectStripsDownRight；2565、#ppEffectStripsLeftUp；2566、#ppEffectStripsRightUp；2567、#ppEffectStripsLeftDown；2568、#ppEffectStripsRightDown；2817、#ppEffectWipeLeft；2818、#ppEffectWipeUp；2819、#ppEffectWipeRight；2820、#ppEffectWipeDown；3073、#ppEffectBoxOut；3074、#ppEffectBoxIn；3329、#ppEffectFlyFromLeft；3330、#ppEffectFlyFromTop；3331、#ppEffectFlyFromRight；3332、#ppEffectFlyFromBottom；3333、#ppEffectFlyFromTopLeft；3334、#ppEffectFlyFromTopRight；3335、#ppEffectFlyFromBottomLeft；3336、#ppEffectFlyFromBottomRight；3337、#ppEffectPeekFromLeft；3338、#ppEffectPeekFromDown；3339、#ppEffectPeekFromRight；3340、#ppEffectPeekFromUp；3341、#ppEffectCrawlFromLeft；3342、#ppEffectCrawlFromUp；3343、#ppEffectCrawlFromRight；3344、#ppEffectCrawlFromDown；3345、#ppEffectZoomIn；3346、#ppEffectZoomInSlightly；3347、#ppEffectZoomOut；3348、#ppEffectZoomOutSlightly；3349、#ppEffectZoomCenter；3350、#ppEffectZoomBottom；3351、#ppEffectStretchAcross；3352、#ppEffectStretchLeft；3353、#ppEffectStretchUp；3354、#ppEffectStretchRight；3355、#ppEffectStretchDown；3356、#ppEffectSwivel；3357、#ppEffectSpiral；3585、#ppEffectSplitHorizontalOut；3586、#ppEffectSplitHorizontalIn；3587、#ppEffectSplitVerticalOut；3588、#ppEffectSplitVerticalIn；3841、#ppEffectFlashOnceFast；3842、#ppEffectFlashOnceMedium；3843、#ppEffectFlashOnceSlow；3844、#ppEffectAppear；。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_60.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片中的当前的图形的动画时的播放的显示的效果。 参见： 例程1

**完整正文（站点原文转换）**

**形状动画效果 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；形状播放动画时的效果，为以下常量之一：-2、#ppEffectMixed；0、#ppEffectNone；257、#ppEffectCut；258、#ppEffectCutThroughBlack；513、#ppEffectRandom；769、#ppEffectBlindsHorizontal；770、#ppEffectBlindsVertical；1025、#ppEffectCheckerboardAcross；1026、#ppEffectCheckerboardDown；1281、#ppEffectCoverLeft；1282、#ppEffectCoverUp；1283、#ppEffectCoverRight；1284、#ppEffectCoverDown；1285、#ppEffectCoverLeftUp；1286、#ppEffectCoverRightUp；1287、#ppEffectCoverLeftDown；1288、#ppEffectCoverRightDown；1537、#ppEffectDissolve；1793、#ppEffectFade；2049、#ppEffectUncoverLeft；2050、#ppEffectUncoverUp；2051、#ppEffectUncoverRight；2052、#ppEffectUncoverDown；2053、#ppEffectUncoverLeftUp；2054、#ppEffectUncoverRightUp；2055、#ppEffectUncoverLeftDown；2056、#ppEffectUncoverRightDown；2305、#ppEffectRandomBarsHorizontal；2306、#ppEffectRandomBarsVertical；2561、#ppEffectStripsUpLeft；2562、#ppEffectStripsUpRight；2563、#ppEffectStripsDownLeft；2564、#ppEffectStripsDownRight；2565、#ppEffectStripsLeftUp；2566、#ppEffectStripsRightUp；2567、#ppEffectStripsLeftDown；2568、#ppEffectStripsRightDown；2817、#ppEffectWipeLeft；2818、#ppEffectWipeUp；2819、#ppEffectWipeRight；2820、#ppEffectWipeDown；3073、#ppEffectBoxOut；3074、#ppEffectBoxIn；3329、#ppEffectFlyFromLeft；3330、#ppEffectFlyFromTop；3331、#ppEffectFlyFromRight；3332、#ppEffectFlyFromBottom；3333、#ppEffectFlyFromTopLeft；3334、#ppEffectFlyFromTopRight；3335、#ppEffectFlyFromBottomLeft；3336、#ppEffectFlyFromBottomRight；3337、#ppEffectPeekFromLeft；3338、#ppEffectPeekFromDown；3339、#ppEffectPeekFromRight；3340、#ppEffectPeekFromUp；3341、#ppEffectCrawlFromLeft；3342、#ppEffectCrawlFromUp；3343、#ppEffectCrawlFromRight；3344、#ppEffectCrawlFromDown；3345、#ppEffectZoomIn；3346、#ppEffectZoomInSlightly；3347、#ppEffectZoomOut；3348、#ppEffectZoomOutSlightly；3349、#ppEffectZoomCenter；3350、#ppEffectZoomBottom；3351、#ppEffectStretchAcross；3352、#ppEffectStretchLeft；3353、#ppEffectStretchUp；3354、#ppEffectStretchRight；3355、#ppEffectStretchDown；3356、#ppEffectSwivel；3357、#ppEffectSpiral；3585、#ppEffectSplitHorizontalOut；3586、#ppEffectSplitHorizontalIn；3587、#ppEffectSplitVerticalOut；3588、#ppEffectSplitVerticalIn；3841、#ppEffectFlashOnceFast；3842、#ppEffectFlashOnceMedium；3843、#ppEffectFlashOnceSlow；3844、#ppEffectAppear；。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_60.files/image001.gif)

说明

设置幻灯片中的当前的图形的动画时的播放的显示的效果。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 剪辑隐藏

- 原文链接：https://esdn.ijingyi.com/title-13618.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片放映中指定的媒体剪辑在不播放时是否隐藏。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_61.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯中的播放时的剪辑是否隐藏 参见： 例程1

**完整正文（站点原文转换）**

**剪辑隐藏 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片放映中指定的媒体剪辑在不播放时是否隐藏。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_61.files/image001.gif)

说明

设置幻灯中的播放时的剪辑是否隐藏

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 剪辑循环

- 原文链接：https://esdn.ijingyi.com/title-13619.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定的影片或声音循环播放是否直到下一个影片或声音开始、用户单击鼠标，或发生幻灯片切换。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_62.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯中的剪辑是否循环发生。 参见： 例程1

**完整正文（站点原文转换）**

**剪辑循环 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定的影片或声音循环播放是否直到下一个影片或声音开始、用户单击鼠标，或发生幻灯片切换。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_62.files/image001.gif)

说明

设置幻灯中的剪辑是否循环发生。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 剪辑暂停

- 原文链接：https://esdn.ijingyi.com/title-13620.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；如果幻灯片放映在指定媒体播放时暂停，则该属性值为"真"。如果媒体播放时幻灯片在背景上继续放映，则该属性值为"假"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_63.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯（某一张）中播放时是否暂停剪辑。 参见： 例程1

**完整正文（站点原文转换）**

**剪辑暂停 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；如果幻灯片放映在指定媒体播放时暂停，则该属性值为"真"。如果媒体播放时幻灯片在背景上继续放映，则该属性值为"假"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_63.files/image001.gif)

说明

设置幻灯（某一张）中播放时是否暂停剪辑。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 激活播放

- 原文链接：https://esdn.ijingyi.com/title-13621.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定的影片或声音是否在激活后自动播放。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_64.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯的指定的影音是否在激活幻灯时就自动放映。 参见： 例程1

**完整正文（站点原文转换）**

**激活播放 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定的影片或声音是否在激活后自动播放。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_64.files/image002.gif)

说明

设置幻灯的指定的影音是否在激活幻灯时就自动放映。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 剪辑重新显示

- 原文链接：https://esdn.ijingyi.com/title-13622.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定影片的第一帧在影片播放完毕后是否重新显示。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_65.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放的媒体，是否在播放完毕后，画面回到初始播放时的画面。 参见： 例程1

**完整正文（站点原文转换）**

**剪辑重新显示 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定影片的第一帧在影片播放完毕后是否重新显示。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_65.files/image002.gif)

说明

设置幻灯播放的媒体，是否在播放完毕后，画面回到初始播放时的画面。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 剪辑幻灯片数

- 原文链接：https://esdn.ijingyi.com/title-13623.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；媒体剪辑播放完毕前要放映的幻灯片数目。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_66.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置 媒体剪辑播放完毕前要放映的幻灯片数目。 参见： 例程1

**完整正文（站点原文转换）**

**剪辑幻灯片数 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；媒体剪辑播放完毕前要放映的幻灯片数目。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_66.files/image002.gif)

说明

设置媒体剪辑播放完毕前要放映的幻灯片数目。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%89%AA%E8%BE%91%E8%AE%BE%E7%BD%AE.e)

---

### 动画音效类型

- 原文链接：https://esdn.ijingyi.com/title-13624.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；动画播放的音效类型，使用枚举常量"音效"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_68.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片播放时的动画的音效类型。 参见： 例程1

**完整正文（站点原文转换）**

**动画音效类型 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；动画播放的音效类型，使用枚举常量"音效"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_68.files/image002.gif)

说明

设置幻灯片播放时的动画的音效类型。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画音效名

- 原文链接：https://esdn.ijingyi.com/title-13625.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；出现在“幻灯片切换”对话框（位于“幻灯片放映”菜单）的“声音”框中的演示文稿的可用名称集。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_69.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置已有的音效菜单上的使用的音效名。 参见： 例程1

**完整正文（站点原文转换）**

**动画音效名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；出现在“幻灯片切换”对话框（位于“幻灯片放映”菜单）的“声音”框中的演示文稿的可用名称集。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_69.files/image001.gif)

说明

设置已有的音效菜单上的使用的音效名。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 动画声音文件名

- 原文链接：https://esdn.ijingyi.com/title-13626.html
- 操作系统支持：Windows
- 功能说明：数据类型： 文本型 ； 设计时不可用；动画声音文件名，*wav格式。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_70.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放的用户定义音效。 参见： 例程1

**完整正文（站点原文转换）**

**动画声音文件名 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*文本型*； 设计时不可用；动画声音文件名，*wav格式。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_70.files/image002.gif)

说明

设置幻灯播放的用户定义音效。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 文字动画级别

- 原文链接：https://esdn.ijingyi.com/title-13627.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；该值指示指定形状中的文本动画是由第一级段落，第二级段落，还是其他级（最多到第五级）段落激活,使用枚举常量"文字动画级别"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_71.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放文字对象的，文字动画的播放级别。 参见： 例程1

**完整正文（站点原文转换）**

**文字动画级别 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；该值指示指定形状中的文本动画是由第一级段落，第二级段落，还是其他级（最多到第五级）段落激活,使用枚举常量"文字动画级别"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_71.files/image002.gif)

说明

设置幻灯播放文字对象的，文字动画的播放级别。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 文字组效果

- 原文链接：https://esdn.ijingyi.com/title-13628.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；该值指示指定形状中的文本是逐段、逐字、还是逐字符地显示动画，使用枚举常量"文字组效果"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_72.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片的文字对象的文字组的动画显示效果。 参见： 例程1

**完整正文（站点原文转换）**

**文字组效果 属性**    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；该值指示指定形状中的文本是逐段、逐字、还是逐字符地显示动画，使用枚举常量"文字组效果"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p1_72.files/image002.gif)

说明

设置幻灯片的文字对象的文字组的动画显示效果。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 置程序

- 原文链接：https://esdn.ijingyi.com/title-13629.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．置程序 （ PPT程序对象 ， 新文稿 ）
- 功能说明：设置PowerPoint程序。成功返回"真"，失败返回"假"。注意：在使用本对象的任何方法及属性前必须先使用本方法。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| PPT程序对象 | 必填 | PPT程序 | PPT程序对象。 |
| 新文稿 | 必填 | 逻辑型，初始值为“真” | 在置程序后，本对象自动新建一个文稿集(Presentations)对象，如果本参数为"真"，那将在文稿集的基础上新建一个文稿。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd5.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置和 ppt 程序对象之间的连接。 参见： 例程1

**完整正文（站点原文转换）**

**置程序 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

设置PowerPoint程序。成功返回"真"，失败返回"假"。注意：在使用本对象的任何方法及属性前必须先使用本方法。

*语法：*  逻辑型  *PPT文稿*．置程序 （PPT程序对象， 新文稿）

| 参数名 | 描 述 |
| --- | --- |
| PPT程序对象 | 必需的 ； PPT程序。PPT程序对象。 |
| 新文稿 | 必需的 ； 逻辑型，初始值为“真”。在置程序后，本对象自动新建一个文稿集(Presentations)对象，如果本参数为"真"，那将在文稿集的基础上新建一个文稿。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd5.files/image001.gif)

说明

设置和ppt程序对象之间的连接。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 释放

- 原文链接：https://esdn.ijingyi.com/title-13630.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：无返回值
- 语法：无返回值 PPT文稿 ．释放 （ ）
- 功能说明：将本对象释放。再次使用的时候需再次使用"置程序"方法。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd6.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

清除 ppt 对象连接。 参见： 例程1

**完整正文（站点原文转换）**

**释放 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将本对象释放。再次使用的时候需再次使用"置程序"方法。

*语法：*  无返回值  *PPT文稿*．释放 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd6.files/image001.gif)

说明

清除ppt对象连接。

参见：[例程1](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 运行宏

- 原文链接：https://esdn.ijingyi.com/title-13631.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．运行宏 （ 宏名 ， ... ）
- 功能说明：运行PowerPoint"宏(marco)",要运行的宏必须在PowerPoint文档中事先定义。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 宏名 | 必填 | 待核实 | 必需的 ； 可扩充的 ；文本型。指定宏的名称，必须为文本型，该名称所对应的宏必须在PowerPoint的文档中存在。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd7.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

ppt 文稿运行宏宏命令名编辑框的内容 参见： 例程1

**完整正文（站点原文转换）**

**运行宏 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

运行PowerPoint"宏(marco)",要运行的宏必须在PowerPoint文档中事先定义。

*语法：*  逻辑型  *PPT文稿*．运行宏 （宏名， ... ）

| 参数名 | 描 述 |
| --- | --- |
| 宏名 | 必需的 ； 可扩充的 ；文本型。指定宏的名称，必须为文本型，该名称所对应的宏必须在PowerPoint的文档中存在。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd7.files/image001.gif)

说明

ppt文稿运行宏宏命令名编辑框的内容

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 取文稿集对象

- 原文链接：https://esdn.ijingyi.com/title-13632.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取文稿集对象 （ ）
- 功能说明：获取PowerPoint提供的Presentations对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得文稿集的对象放入到对象类型变量中 参见： 例程1

**完整正文（站点原文转换）**

**取文稿集对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Presentations对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取文稿集对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd8.files/image001.gif)

说明

取得文稿集的对象放入到对象类型变量中

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取文稿对象

- 原文链接：https://esdn.ijingyi.com/title-13633.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取文稿对象 （ ）
- 功能说明：获取PowerPoint提供的Presentation对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 ppt 的文稿对象，并放入到对象类型变量中 参见： 例程1

**完整正文（站点原文转换）**

**取文稿对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Presentation对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取文稿对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd9.files/image001.gif)

说明

取得ppt的文稿对象，并放入到对象类型变量中

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取幻灯集对象

- 原文链接：https://esdn.ijingyi.com/title-13634.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取幻灯集对象 （ ）
- 功能说明：获取PowerPoint提供的Slides对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd10.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得幻灯集的对象并保存到一个对象类型的变量中去 参见： 例程1

**完整正文（站点原文转换）**

**取幻灯集对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Slides对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取幻灯集对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd10.files/image001.gif)

说明

取得幻灯集的对象并保存到一个对象类型的变量中去

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取幻灯对象

- 原文链接：https://esdn.ijingyi.com/title-13635.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取幻灯对象 （ ）
- 功能说明：获取PowerPoint提供的Slide对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd11.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 ppt 的幻灯对象保存在对象类型的变量中 参见： 例程1

**完整正文（站点原文转换）**

**取幻灯对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Slide对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取幻灯对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd11.files/image001.gif)

说明

取得ppt的幻灯对象保存在对象类型的变量中

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取图形集对象

- 原文链接：https://esdn.ijingyi.com/title-13636.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取图形集对象 （ ）
- 功能说明：获取PowerPoint提供的Shapes对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 ppt 的图形集对象放入到对象类型的变量中 参见： 例程1

**完整正文（站点原文转换）**

**取图形集对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Shapes对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取图形集对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd12.files/image001.gif)

说明

取得ppt的图形集对象放入到对象类型的变量中

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取图形对象

- 原文链接：https://esdn.ijingyi.com/title-13637.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：对象
- 语法：对象 PPT文稿 ．取图形对象 （ ）
- 功能说明：获取PowerPoint提供的Shape对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取得 ppt 的图形对象保存到对象类型的变量中 参见： 例程1

**完整正文（站点原文转换）**

**取图形对象 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

获取PowerPoint提供的Shape对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT文稿*．取图形对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd13.files/image001.gif)

说明

取得ppt的图形对象保存到对象类型的变量中

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 打开

- 原文链接：https://esdn.ijingyi.com/title-13638.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．打开 （ 文件名 ， 只读方式 ， 无标题方式 ， 可见打开 ）
- 功能说明：打开一个PowerPoint2000支持打开的文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 要打开的文件的完整文件名，PowerPoint所支持打开的文件，请参见PowerPoint应用程序 "文件/打开"菜单命令。 |
| 只读方式 | 必填 | 逻辑型，初始值为“假” | 是否以只读方式打开文件。 |
| 无标题方式 | 必填 | 逻辑型，初始值为“假” | 该参数为"真"时，将以无标题方式打开文件，此时相当于创建该文件的一份副本。如果该参数为"假"，则将该文件名自动定为演示文稿的标题。 |
| 可见打开 | 必填 | 逻辑型，初始值为“真” | 该参数为"真"时，将在可见窗口中打开文件。设为"假"将隐藏打开的演示文稿。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

打开 ppt2000 的相关文件，在原基础上创建一个窗口打开 参见： 例程1

**完整正文（站点原文转换）**

**打开 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

打开一个PowerPoint2000支持打开的文件。

*语法：*  逻辑型  *PPT文稿*．打开 （文件名， 只读方式， 无标题方式， 可见打开）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。要打开的文件的完整文件名，PowerPoint所支持打开的文件，请参见PowerPoint应用程序 "文件/打开"菜单命令。 |
| 只读方式 | 必需的 ； 逻辑型，初始值为“假”。是否以只读方式打开文件。 |
| 无标题方式 | 必需的 ； 逻辑型，初始值为“假”。该参数为"真"时，将以无标题方式打开文件，此时相当于创建该文件的一份副本。如果该参数为"假"，则将该文件名自动定为演示文稿的标题。 |
| 可见打开 | 必需的 ； 逻辑型，初始值为“真”。该参数为"真"时，将在可见窗口中打开文件。设为"假"将隐藏打开的演示文稿。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程：

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd14.files/image001.gif)

说明

打开ppt2000的相关文件，在原基础上创建一个窗口打开

参见：[例程1](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 保存

- 原文链接：https://esdn.ijingyi.com/title-13639.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．保存 （ 文件名 ， 格式 ， 嵌入字体 ）
- 功能说明：用一个新的文件名来保存当前文档。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 指定文件的存盘名称。如果不指定路径名则 PowerPoint 将文件存于当前文件夹。 |
| 格式 | 必填 | 整数型，初始值为“11” | 指定文件的保存格式，使用枚举常量中的"PPT格式"。 |
| 嵌入字体 | 必填 | 逻辑型，初始值为“假” | 该参数指定是否在保存的演示文稿中嵌入 TrueType 字体。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

保存一个 ppt 文档的记录 参见： 例程1

**完整正文（站点原文转换）**

**保存 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

用一个新的文件名来保存当前文档。

*语法：*  逻辑型  *PPT文稿*．保存 （文件名， 格式， 嵌入字体）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。指定文件的存盘名称。如果不指定路径名则 PowerPoint 将文件存于当前文件夹。 |
| 格式 | 必需的 ； 整数型，初始值为“11”。指定文件的保存格式，使用枚举常量中的"PPT格式"。 |
| 嵌入字体 | 必需的 ； 逻辑型，初始值为“假”。该参数指定是否在保存的演示文稿中嵌入 TrueType 字体。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd15.files/image001.gif)

说明

保存一个ppt文档的记录

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 关闭

- 原文链接：https://esdn.ijingyi.com/title-13640.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．关闭 （ ）
- 功能说明：关闭文稿集(Presentations)对象，但是不关闭程序。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd16.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

关闭 ppt 程序的文稿 对象 参见： 例程1

**完整正文（站点原文转换）**

**关闭 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

关闭文稿集(Presentations)对象，但是不关闭程序。

*语法：*  逻辑型  *PPT文稿*．关闭 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd16.files/image001.gif)

说明

关闭ppt程序的文稿对象

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 打印

- 原文链接：https://esdn.ijingyi.com/title-13641.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．打印 （ 开始页码 ， 终止页码 ， 打印文件名 ， 打印份数 ， 逐份打印 ）
- 功能说明：打印文稿。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 开始页码 | 必填 | 整数型 | 打印的开始页码。 |
| 终止页码 | 必填 | 整数型 | 打印的终止页码。 |
| 打印文件名 | 必填 | 文本型，初始值为“” | 如果指定此参数，则要打印的文件将被输出到文件而非打印机。省略此参数时(空文本)，文件被传送至打印机。 |
| 打印份数 | 必填 | 整数型，初始值为“1” | 需要打印的份数。 |
| 逐份打印 | 必填 | 逻辑型，初始值为“真” | 此参数设为"真"时，将逐份地打印演示文稿，否则多份并行打印。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd17.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

打印 ppt 文稿的幻灯或备注等 参见： 例程1

**完整正文（站点原文转换）**

**打印 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

打印文稿。

*语法：*  逻辑型  *PPT文稿*．打印 （开始页码， 终止页码， 打印文件名， 打印份数， 逐份打印）

| 参数名 | 描 述 |
| --- | --- |
| 开始页码 | 必需的 ； 整数型。打印的开始页码。 |
| 终止页码 | 必需的 ； 整数型。打印的终止页码。 |
| 打印文件名 | 必需的 ； 文本型，初始值为“”。如果指定此参数，则要打印的文件将被输出到文件而非打印机。省略此参数时(空文本)，文件被传送至打印机。 |
| 打印份数 | 必需的 ； 整数型，初始值为“1”。需要打印的份数。 |
| 逐份打印 | 必需的 ； 逻辑型，初始值为“真”。此参数设为"真"时，将逐份地打印演示文稿，否则多份并行打印。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd17.files/image001.gif)

说明

打印ppt文稿的幻灯或备注等

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E7%A8%BF%E6%93%8D%E4%BD%9C.e)

---

### 应用模板

- 原文链接：https://esdn.ijingyi.com/title-13642.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．应用模板 （ 模板名称 ）
- 功能说明：对当前文稿应用设计模板。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 模板名称 | 必填 | 文本型 | 指定设计模板的名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd18.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

对当前操作的文档使用模板 参见： 例程1

**完整正文（站点原文转换）**

**应用模板 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

对当前文稿应用设计模板。

*语法：*  逻辑型  *PPT文稿*．应用模板 （模板名称）

| 参数名 | 描 述 |
| --- | --- |
| 模板名称 | 必需的 ； 文本型。指定设计模板的名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd18.files/image001.gif)

说明

对当前操作的文档使用模板

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 插入幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13643.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．插入幻灯片 （ 索引 ， 版式 ）
- 功能说明：插入一张新的幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 索引 | 必填 | 整数型，初始值为“-1” | 要插入的位置，如果为默认值-1，则将插入到最后的位置。 |
| 版式 | 必填 | 整数型，初始值为“12” | 新插入幻灯片的样式，使用枚举常量"幻灯版式"。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

ppt 文稿插入新的幻灯片 参见： 例程1

**完整正文（站点原文转换）**

**插入幻灯片 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

插入一张新的幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．插入幻灯片 （索引， 版式）

| 参数名 | 描 述 |
| --- | --- |
| 索引 | 必需的 ； 整数型，初始值为“-1”。要插入的位置，如果为默认值-1，则将插入到最后的位置。 |
| 版式 | 必需的 ； 整数型，初始值为“12”。新插入幻灯片的样式，使用枚举常量"幻灯版式"。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd19.files/image001.gif)

说明

ppt文稿插入新的幻灯片

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 删除幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13644.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．删除幻灯片 （ 索引 ）
- 功能说明：删除指定的幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 索引 | 必填 | 整数型 | 要删除的幻灯片的索引。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd20.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除文稿中存在的指定的幻灯片（索引起始为 1 ） 参见： 例程1

**完整正文（站点原文转换）**

**删除幻灯片 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

删除指定的幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．删除幻灯片 （索引）

| 参数名 | 描 述 |
| --- | --- |
| 索引 | 必需的 ； 整数型。要删除的幻灯片的索引。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd20.files/image001.gif)

说明

删除文稿中存在的指定的幻灯片（索引起始为1）

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 删除全部幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13645.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．删除全部幻灯片 （ ）
- 功能说明：删除当前文稿中的全部幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd21.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

删除文稿中全部的幻灯片 参见： 例程1

**完整正文（站点原文转换）**

**删除全部幻灯片 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

删除当前文稿中的全部幻灯片。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．删除全部幻灯片 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd21.files/image001.gif)

说明

删除文稿中全部的幻灯片

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 添加媒体

- 原文链接：https://esdn.ijingyi.com/title-13646.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加媒体 （ 文件名 ， 左边 ， 顶边 ， 宽度 ， 高度 ）
- 功能说明：添加一个Windows Media支持的音频或视频文件(*.mpg,*.avi,*.mp3,*.cda...)，并且可以在幻灯片中播放。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 媒体文件名。 |
| 左边 | 必填 | 整数型 | 左坐标，磅为单位。 |
| 顶边 | 必填 | 整数型 | 顶坐标，磅为单位。 |
| 宽度 | 必填 | 整数型 | 宽度，磅为单位。 |
| 高度 | 必填 | 整数型 | 高度，磅为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在幻灯片中添加媒体文件 参见： 例程1

**完整正文（站点原文转换）**

**添加媒体 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

添加一个Windows Media支持的音频或视频文件(*.mpg,*.avi,*.mp3,*.cda...)，并且可以在幻灯片中播放。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加媒体 （文件名， 左边， 顶边， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。媒体文件名。 |
| 左边 | 必需的 ； 整数型。左坐标，磅为单位。 |
| 顶边 | 必需的 ； 整数型。顶坐标，磅为单位。 |
| 宽度 | 必需的 ； 整数型。宽度，磅为单位。 |
| 高度 | 必需的 ； 整数型。高度，磅为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd22.files/image001.gif)

说明

在幻灯片中添加媒体文件

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 添加图片

- 原文链接：https://esdn.ijingyi.com/title-13647.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加图片 （ 文件名 ， 链接到文件 ， 保存图片 ， 左边 ， 顶边 ， 宽度 ， 高度 ）
- 功能说明：向幻灯片中添加一张PowerPoint支持的图形/图象文件(*.jpg,*.bmp,*.png,*.emf/wmf,*.gif,*.eps,*.pcx,*.pcd,*.tiff...)，具体支持的格式列表请参见PowerPoint应用程序 "插入/图片/来自文件" 菜单命令。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 图片文件名。 |
| 链接到文件 | 必填 | 逻辑型，初始值为“假” | 如果设该参数为"真"会将图片链接到创建它的文件；如果该参数为"假"则将图片制成该文件的一个独立副本。 |
| 保存图片 | 必填 | 逻辑型，初始值为“真” | 如果设该参数为"真"会将链接的图片与插入到的文档全部保存；如果设该参数为"假"则仅保存该文档中的链接信息。如果"链接到文件"为"假"则此参数必须为"真"。 |
| 左边 | 必填 | 整数型 | 左坐标，磅为单位。 |
| 顶边 | 必填 | 整数型 | 顶坐标，磅为单位。 |
| 宽度 | 必填 | 整数型 | 宽度，磅为单位。 |
| 高度 | 必填 | 整数型 | 高度，磅为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd23.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

用文稿在幻灯片中添加图片 参见： 例程1

**完整正文（站点原文转换）**

**添加图片 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

向幻灯片中添加一张PowerPoint支持的图形/图象文件(*.jpg,*.bmp,*.png,*.emf/wmf,*.gif,*.eps,*.pcx,*.pcd,*.tiff...)，具体支持的格式列表请参见PowerPoint应用程序 "插入/图片/来自文件" 菜单命令。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加图片 （文件名， 链接到文件， 保存图片， 左边， 顶边， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。图片文件名。 |
| 链接到文件 | 必需的 ； 逻辑型，初始值为“假”。如果设该参数为"真"会将图片链接到创建它的文件；如果该参数为"假"则将图片制成该文件的一个独立副本。 |
| 保存图片 | 必需的 ； 逻辑型，初始值为“真”。如果设该参数为"真"会将链接的图片与插入到的文档全部保存；如果设该参数为"假"则仅保存该文档中的链接信息。如果"链接到文件"为"假"则此参数必须为"真"。 |
| 左边 | 必需的 ； 整数型。左坐标，磅为单位。 |
| 顶边 | 必需的 ； 整数型。顶坐标，磅为单位。 |
| 宽度 | 必需的 ； 整数型。宽度，磅为单位。 |
| 高度 | 必需的 ； 整数型。高度，磅为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd23.files/image001.gif)

说明

用文稿在幻灯片中添加图片

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E7%89%87%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 添加图形

- 原文链接：https://esdn.ijingyi.com/title-13648.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加图形 （ 类型 ， 左边 ， 顶边 ， 宽度 ， 高度 ）
- 功能说明：向幻灯片中添加一个自选图形，目前PowerPoint支持近100多种图形。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 类型 | 必填 | 整数型 | 指定要创建的自选图形的类型，可为MsoAutoShapeType常数之一(可参见PowerPoint2000开发文档)，数字范围为-2 ~ 138 (无0和-1)，共140种。 |
| 左边 | 必填 | 整数型 | 左坐标，磅为单位。 |
| 顶边 | 必填 | 整数型 | 顶坐标，磅为单位。 |
| 宽度 | 必填 | 整数型 | 宽度，磅为单位。 |
| 高度 | 必填 | 整数型 | 高度，磅为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd24.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在幻灯中添加图形对象 参见： 例程1

**完整正文（站点原文转换）**

**添加图形 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

向幻灯片中添加一个自选图形，目前PowerPoint支持近100多种图形。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加图形 （类型， 左边， 顶边， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 类型 | 必需的 ； 整数型。指定要创建的自选图形的类型，可为MsoAutoShapeType常数之一(可参见PowerPoint2000开发文档)，数字范围为-2 ~ 138 (无0和-1)，共140种。 |
| 左边 | 必需的 ； 整数型。左坐标，磅为单位。 |
| 顶边 | 必需的 ； 整数型。顶坐标，磅为单位。 |
| 宽度 | 必需的 ； 整数型。宽度，磅为单位。 |
| 高度 | 必需的 ； 整数型。高度，磅为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd24.files/image001.gif)

说明

在幻灯中添加图形对象

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9B%BE%E5%BD%A2%E5%8A%A8%E7%94%BB%E8%AE%BE%E7%BD%AE.e)

---

### 添加艺术字

- 原文链接：https://esdn.ijingyi.com/title-13649.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加艺术字 （ 预设效果 ， 文本 ， 字体名称 ， 字体大小 ， 加粗 ， 倾斜 ， 左边 ， 顶边 ）
- 功能说明：向幻灯片中添加Office艺术字。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 预设效果 | 必填 | 整数型 | 预设文本效果可为以下 MsoPresetTextEffect 常数之一(参见PowerPoint2000开发文档)，为-2 ~ 39 (无-1) 的整数型常量 。 |
| 文本 | 必填 | 文本型 | 艺术字的文本。 |
| 字体名称 | 必填 | 文本型，初始值为“宋体” | 艺术字的字体名称。 |
| 字体大小 | 必填 | 整数型，初始值为“32” | 艺术字的字体大小。 |
| 加粗 | 必填 | 逻辑型，初始值为“假” | 艺术字是否加粗。 |
| 倾斜 | 必填 | 逻辑型，初始值为“假” | 艺术字是否倾斜。 |
| 左边 | 必填 | 整数型 | 左坐标，磅为单位。 |
| 顶边 | 必填 | 整数型 | 顶坐标，磅为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd25.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在幻灯片中添加艺术字 参见： 例程1

**完整正文（站点原文转换）**

**添加艺术字 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

向幻灯片中添加Office艺术字。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加艺术字 （预设效果， 文本， 字体名称， 字体大小， 加粗， 倾斜， 左边， 顶边）

| 参数名 | 描 述 |
| --- | --- |
| 预设效果 | 必需的 ； 整数型。预设文本效果可为以下 MsoPresetTextEffect 常数之一(参见PowerPoint2000开发文档)，为-2 ~ 39 (无-1) 的整数型常量 。 |
| 文本 | 必需的 ； 文本型。艺术字的文本。 |
| 字体名称 | 必需的 ； 文本型，初始值为“宋体”。艺术字的字体名称。 |
| 字体大小 | 必需的 ； 整数型，初始值为“32”。艺术字的字体大小。 |
| 加粗 | 必需的 ； 逻辑型，初始值为“假”。艺术字是否加粗。 |
| 倾斜 | 必需的 ； 逻辑型，初始值为“假”。艺术字是否倾斜。 |
| 左边 | 必需的 ； 整数型。左坐标，磅为单位。 |
| 顶边 | 必需的 ； 整数型。顶坐标，磅为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd25.files/image001.gif)

说明

在幻灯片中添加艺术字

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E8%89%BA%E6%9C%AF%E5%AD%97%E6%8F%92%E5%85%A5.e)

---

### 添加文本框

- 原文链接：https://esdn.ijingyi.com/title-13650.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加文本框 （ 文本 ， 方向 ， 左边 ， 顶边 ， 宽度 ， 高度 ， 自动调整大小 ， 左边界距离 ， 右边界距离 ， 顶边界距离 ， 底边界距离 ， 自动折行 ， 水平定位类型 ， 垂直定位类型 ）
- 功能说明：向幻灯片中添加一个文本框。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文本 | 必填 | 文本型 | 文本框的文本。 |
| 方向 | 必填 | 整数型 | 标签中的文本方向，使用枚举常量"文本方向"，注意：部分常量可能无法使用。 |
| 左边 | 必填 | 整数型 | 左坐标，磅为单位。 |
| 顶边 | 必填 | 整数型 | 顶左边，磅为单位。 |
| 宽度 | 必填 | 整数型 | 宽度，磅为单位。 |
| 高度 | 必填 | 整数型 | 高度，磅为单位。 |
| 自动调整大小 | 必填 | 逻辑型，初始值为“真” | 是否自动调整大小以显示其完整的内容。 |
| 左边界距离 | 必填 | 整数型 | 以磅为单位指定从文本框左边界到包含文本的形状中内接矩形左边界的距离。 |
| 右边界距离 | 必填 | 整数型 | 以磅为单位指定从文本框右边界到包含文本的形状中内接矩形右边界的距离。 |
| 顶边界距离 | 必填 | 整数型 | 以磅为单位指定从文本框架顶端到包含文本的形状中内接矩形顶端的距离。 |
| 底边界距离 | 必填 | 整数型 | 以磅为单位指定从文本框底端到包含文本的形状中内接矩形底端的距离。 |
| 自动折行 | 必填 | 逻辑型，初始值为“真” | 指定文本是否自动折行以容纳于形状中。 |
| 水平定位类型 | 必填 | 整数型 | 指定文本的水平定位类型，使用枚举常量"文本水平定位"。 |
| 垂直定位类型 | 必填 | 整数型 | 指定文本的垂直定位类型，使用枚举常量"文本垂直定位"。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

在幻灯片中添加文本框 参见： 例程1

**完整正文（站点原文转换）**

**添加文本框 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

向幻灯片中添加一个文本框。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加文本框 （文本， 方向， 左边， 顶边， 宽度， 高度， 自动调整大小， 左边界距离， 右边界距离， 顶边界距离， 底边界距离， 自动折行， 水平定位类型， 垂直定位类型）

| 参数名 | 描 述 |
| --- | --- |
| 文本 | 必需的 ； 文本型。文本框的文本。 |
| 方向 | 必需的 ； 整数型。标签中的文本方向，使用枚举常量"文本方向"，注意：部分常量可能无法使用。 |
| 左边 | 必需的 ； 整数型。左坐标，磅为单位。 |
| 顶边 | 必需的 ； 整数型。顶左边，磅为单位。 |
| 宽度 | 必需的 ； 整数型。宽度，磅为单位。 |
| 高度 | 必需的 ； 整数型。高度，磅为单位。 |
| 自动调整大小 | 必需的 ； 逻辑型，初始值为“真”。是否自动调整大小以显示其完整的内容。 |
| 左边界距离 | 必需的 ； 整数型。以磅为单位指定从文本框左边界到包含文本的形状中内接矩形左边界的距离。 |
| 右边界距离 | 必需的 ； 整数型。以磅为单位指定从文本框右边界到包含文本的形状中内接矩形右边界的距离。 |
| 顶边界距离 | 必需的 ； 整数型。以磅为单位指定从文本框架顶端到包含文本的形状中内接矩形顶端的距离。 |
| 底边界距离 | 必需的 ； 整数型。以磅为单位指定从文本框底端到包含文本的形状中内接矩形底端的距离。 |
| 自动折行 | 必需的 ； 逻辑型，初始值为“真”。指定文本是否自动折行以容纳于形状中。 |
| 水平定位类型 | 必需的 ； 整数型。指定文本的水平定位类型，使用枚举常量"文本水平定位"。 |
| 垂直定位类型 | 必需的 ； 整数型。指定文本的垂直定位类型，使用枚举常量"文本垂直定位"。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd26.files/image001.gif)

说明

在幻灯片中添加文本框

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 添加单色背景

- 原文链接：https://esdn.ijingyi.com/title-13651.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加单色背景 （ 颜色 ， 过渡样式 ， 过渡变量 ， 过渡程度 ）
- 功能说明：将幻灯片背景改变为单色背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色 | 必填 | 整数型 | RGB颜色。 |
| 过渡样式 | 必填 | 整数型 | 过渡样式，使用枚举常量"过渡样式"。 |
| 过渡变量 | 必填 | 整数型 | 可为 1 到 4 之间的值。 |
| 过渡程度 | 必填 | 小数型 | 过渡的程度。可为 0.0（暗）到 1.0（亮）之间的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd27.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为当前幻灯添加一个单色背景 参见： 例程1

**完整正文（站点原文转换）**

**添加单色背景 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为单色背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加单色背景 （颜色， 过渡样式， 过渡变量， 过渡程度）

| 参数名 | 描 述 |
| --- | --- |
| 颜色 | 必需的 ； 整数型。RGB颜色。 |
| 过渡样式 | 必需的 ； 整数型。过渡样式，使用枚举常量"过渡样式"。 |
| 过渡变量 | 必需的 ； 整数型。可为 1 到 4 之间的值。 |
| 过渡程度 | 必需的 ； 小数型。过渡的程度。可为 0.0（暗）到 1.0（亮）之间的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd27.files/image001.gif)

说明

为当前幻灯添加一个单色背景

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%8D%95%E8%89%B2%E5%BA%95%E8%89%B2%E6%B7%BB%E5%8A%A0.e)

---

### 添加双色背景

- 原文链接：https://esdn.ijingyi.com/title-13652.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加双色背景 （ 过渡样式 ， 颜色1 ， 颜色2 ， 过渡变量 ）
- 功能说明：将幻灯片背景改变为双色背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 过渡样式 | 必填 | 整数型 | 过渡样式，使用枚举常量"过渡样式"。 |
| 颜色1 | 必填 | 整数型 | 颜色1，RGB颜色。 |
| 颜色2 | 必填 | 整数型 | 颜色2，RGB颜色。 |
| 过渡变量 | 必填 | 整数型 | 可为 1 到 4 之间的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd28.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为幻灯片添加双色背景 参见： 例程 1

**完整正文（站点原文转换）**

**添加双色背景 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为双色背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加双色背景 （过渡样式， 颜色1， 颜色2， 过渡变量）

| 参数名 | 描 述 |
| --- | --- |
| 过渡样式 | 必需的 ； 整数型。过渡样式，使用枚举常量"过渡样式"。 |
| 颜色1 | 必需的 ； 整数型。颜色1，RGB颜色。 |
| 颜色2 | 必需的 ； 整数型。颜色2，RGB颜色。 |
| 过渡变量 | 必需的 ； 整数型。可为 1 到 4 之间的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd28.files/image001.gif)

说明

为幻灯片添加双色背景

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%8F%8C%E8%89%B2%E5%BA%95%E8%89%B2%E6%B7%BB%E5%8A%A0.e)

---

### 添加预设背景

- 原文链接：https://esdn.ijingyi.com/title-13653.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加预设背景 （ 过渡样式 ， 预设过渡 ， 过渡变量 ）
- 功能说明：将幻灯片背景改变为预设背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 过渡样式 | 必填 | 整数型 | 过渡样式，使用枚举常量"过渡样式"。 |
| 预设过渡 | 必填 | 整数型 | 预设过渡样式，可为以下 MsoPresetGradientType 常数之一(参见PowerPoint2000开发文档)，为-2 ~ 24 (无0和-1)的整数。 |
| 过渡变量 | 必填 | 整数型 | 可为 1 到 4 之间的值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

将幻灯片的背景改变为预制的背景 参见： 例程1

**完整正文（站点原文转换）**

**添加预设背景 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为预设背景。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加预设背景 （过渡样式， 预设过渡， 过渡变量）

| 参数名 | 描 述 |
| --- | --- |
| 过渡样式 | 必需的 ； 整数型。过渡样式，使用枚举常量"过渡样式"。 |
| 预设过渡 | 必需的 ； 整数型。预设过渡样式，可为以下 MsoPresetGradientType 常数之一(参见PowerPoint2000开发文档)，为-2 ~ 24 (无0和-1)的整数。 |
| 过渡变量 | 必需的 ； 整数型。可为 1 到 4 之间的值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd29.files/image001.gif)

说明

将幻灯片的背景改变为预制的背景

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 添加图案背景

- 原文链接：https://esdn.ijingyi.com/title-13654.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加图案背景 （ 图案 ）
- 功能说明：将幻灯片背景改变为指定预设图案。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图案 | 必填 | 整数型 | 指定填充使用的图案。可为任意的 MsoPatternType 常数(参阅PowerPoint2000开发文档)，为-2 ~ 48 (无0和-1)的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为幻灯片添加图案背景 参见： 例程1

**完整正文（站点原文转换）**

**添加图案背景 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为指定预设图案。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加图案背景 （图案）

| 参数名 | 描 述 |
| --- | --- |
| 图案 | 必需的 ； 整数型。指定填充使用的图案。可为任意的 MsoPatternType 常数(参阅PowerPoint2000开发文档)，为-2 ~ 48 (无0和-1)的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd30.files/image001.gif)

说明

为幻灯片添加图案背景

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 添加预设纹理

- 原文链接：https://esdn.ijingyi.com/title-13655.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加预设纹理 （ 图案 ）
- 功能说明：将幻灯片背景改变为指定预设纹理。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图案 | 必填 | 整数型 | 指定填充使用的图案。可为任意的 MsoPatternType 常数(参阅PowerPoint2000开发文档)，为-2 ~ 48 (无0和-1)的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为幻灯片添加预设的纹理 参见： 例程1

**完整正文（站点原文转换）**

**添加预设纹理 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为指定预设纹理。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加预设纹理 （图案）

| 参数名 | 描 述 |
| --- | --- |
| 图案 | 必需的 ； 整数型。指定填充使用的图案。可为任意的 MsoPatternType 常数(参阅PowerPoint2000开发文档)，为-2 ~ 48 (无0和-1)的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd31.files/image001.gif)

说明

为幻灯片添加预设的纹理

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 添加背景图

- 原文链接：https://esdn.ijingyi.com/title-13656.html
- 操作系统支持：Windows 所属对象： PPT文稿
- 返回值类型：逻辑型
- 语法：逻辑型 PPT文稿 ．添加背景图 （ 文件名 ）
- 功能说明：将幻灯片背景改变为指定图片，支持的图片格式请参见PowerPoint应用程序 "格式/背景/填充效果/图片/选择图片"菜单命令，支持大部分流行的图片格式。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 图片文件名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

为幻灯片添加背景图 参见： 例程1

**完整正文（站点原文转换）**

**添加背景图 方法**   操作系统支持：Windows    所属对象：[PPT文稿](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt1.htm)

将幻灯片背景改变为指定图片，支持的图片格式请参见PowerPoint应用程序 "格式/背景/填充效果/图片/选择图片"菜单命令，支持大部分流行的图片格式。注意：本方法的返回值，不具有实际意义。保留此返回值只是为了以后扩展本方法功能用。

*语法：*  逻辑型  *PPT文稿*．添加背景图 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。图片文件名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd32.files/image001.gif)

说明

为幻灯片添加背景图

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 左边

- 原文链接：https://esdn.ijingyi.com/title-13659.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**左边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.左边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty0.files/image002.gif)

说明：

设置窗口的左边为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 顶边

- 原文链接：https://esdn.ijingyi.com/title-13660.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**顶边 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.顶边 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty1.files/image002.gif)

说明：

设置窗口的顶边为100；如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 宽度

- 原文链接：https://esdn.ijingyi.com/title-13661.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**宽度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.宽度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty2.files/image002.gif)

说明：

设置窗口的宽度为200，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 高度

- 原文链接：https://esdn.ijingyi.com/title-13662.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 整数型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。 参见： 例程1

**完整正文（站点原文转换）**

**高度 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*整数型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.高度 =  整数型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty3.files/image002.gif)

说明：

设置窗口的高度为100，如果要同时设置这几个属性，可以用“组件.移动”命令来实现。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 标记

- 原文链接：https://esdn.ijingyi.com/title-13663.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 文本型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

这个例程中，我们首先在程序设置状态的时候把测试的 4 个按钮的标记分别写入文本型的“ 1 ”“ 2 ”“ 3 ”“ 4 ”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。 参见： 例程1

**完整正文（站点原文转换）**

**标记 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*文本型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.标记 =  文本型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据库、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.files/image002.gif)

说明：

这个例程中，我们首先在程序设置状态的时候把测试的4个按钮的标记分别写入文本型的“1”“2”“3”“4”，然后我们用循环通过“取标记组件”命令来寻找这个组件，然后我们把找到的组件的事件转移到一个新的按钮上。这样可以利用标记来减少重复代码。这是标记的作用之一。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty4.e)

---

### 可视

- 原文链接：https://esdn.ijingyi.com/title-13664.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的可视属性。 参见： 例程1

**完整正文（站点原文转换）**

**可视 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.可视 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty5.files/image002.gif)

说明：

设置控件的可视属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 禁止

- 原文链接：https://esdn.ijingyi.com/title-13665.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 逻辑型 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的禁止属性。 参见： 例程1

**完整正文（站点原文转换）**

**禁止 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*逻辑型*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.禁止 =  逻辑型

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、菜单、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty6.files/image002.gif)

说明：

设置控件的禁止属性。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 鼠标指针

- 原文链接：https://esdn.ijingyi.com/title-13666.html
- 操作系统支持：Windows、Linux、Unix
- 功能说明：数据类型： 字节集 ；

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置控件的鼠标指针。 参见： 例程1

**完整正文（站点原文转换）**

**鼠标指针 基本属性**   操作系统支持：Windows、Linux、Unix

    数据类型：*字节集*；

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

语法：  对象.鼠标指针 =  字节集

应用对象：

窗口、编辑框、图片框、外形框、画板、分组框、标签、按钮、选择框、单选框、组合框、列表框、选择列表框、横向滚动条、纵向滚动条、进度条、滑块条、选择夹、影像框、日期框、月历、驱动器框、目录框、文件框、颜色选择器、超级链接框、调节器、通用对话框、时钟、打印机、数据报、客户、服务器、端口、表格、数据源、通用提供者、数据库提供者、图形按钮、外部数据提供者、超文本浏览框、树型框、状态条、工具条、超级列表框、透明标签、超级按钮、高级影像框、分隔条、超级编辑框、数据库连接、记录集、柱状图控件、饼形图控件、曲线图控件、Word程序、Word文档集、Word图形、Excel程序、Excel工作簿、Excel图表、脚本组件

例程：

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty7.files/image002.gif)

说明：

设置控件的鼠标指针。

参见：[例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/krnln//baseprop/pty.e)

---

### 高级模式

- 原文链接：https://esdn.ijingyi.com/title-13667.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；指示幻灯片放映方式，使用枚举常量"放映方式"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_8.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放的高级模式的幻灯效果。 参见： 例 程 1

**完整正文（站点原文转换）**

**高级模式 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；指示幻灯片放映方式，使用枚举常量"放映方式"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_8.files/image002.gif)

说明

 设置幻灯播放的高级模式的幻灯效果。

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 起始幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13668.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片放映中第一个显示的幻灯片的索引。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_9.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放的起始幻灯片索引 参见： 例 程 1

**完整正文（站点原文转换）**

**起始幻灯片 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片放映中第一个显示的幻灯片的索引。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_9.files/image002.gif)

说明

设置幻灯播放的起始幻灯片索引

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 结束幻灯片

- 原文链接：https://esdn.ijingyi.com/title-13669.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片放映中最后显示的幻灯片的索引。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_10.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放的结束的幻灯片的索引。 参见： 例 程 1

**完整正文（站点原文转换）**

**结束幻灯片 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片放映中最后显示的幻灯片的索引。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_10.files/image002.gif)

说明

设置幻灯播放的结束的幻灯片的索引。

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 循环放映

- 原文链接：https://esdn.ijingyi.com/title-13670.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；指定的幻灯片放映循环是否直到用户按 ESC 键。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_11.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯片是否循环播放。 参见： 例 程 1

**完整正文（站点原文转换）**

**循环放映 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；指定的幻灯片放映循环是否直到用户按 ESC 键。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_11.files/image002.gif)

说明

设置幻灯片是否循环播放。

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 画笔颜色

- 原文链接：https://esdn.ijingyi.com/title-13671.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；画笔的颜色,RGB格式。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置播放对象的播放时的画笔颜色。 参见： 例 程 1

**完整正文（站点原文转换）**

**画笔颜色 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；画笔的颜色,RGB格式。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_12.files/image001.gif)

说明

设置播放对象的播放时的画笔颜色。

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 放映类型

- 原文链接：https://esdn.ijingyi.com/title-13672.html
- 操作系统支持：Windows
- 功能说明：数据类型： 整数型 ； 设计时不可用；幻灯片放映的放映类型，使用枚举常量"放映类型"。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_13.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放时的放映的类型。 参见： 例 程 1

**完整正文（站点原文转换）**

**放映类型 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*整数型*； 设计时不可用；幻灯片放映的放映类型，使用枚举常量"放映类型"。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_13.files/image002.gif)

说明

设置幻灯播放时的放映的类型。

参见：[例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 显示动画

- 原文链接：https://esdn.ijingyi.com/title-13673.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片放映是否以预定的动画设置显示形状。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

让 ppt 文稿设置的动画效果失效 参见： 例程

**完整正文（站点原文转换）**

**显示动画 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片放映是否以预定的动画设置显示形状。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_14.files/image001.gif)

说明

让ppt文稿设置的动画效果失效

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E6%96%87%E5%AD%97%E6%A1%86%E6%B7%BB%E5%8A%A0.e)

---

### 旁白方式

- 原文链接：https://esdn.ijingyi.com/title-13674.html
- 操作系统支持：Windows
- 功能说明：数据类型： 逻辑型 ； 设计时不可用；幻灯片放映是否以有旁白方式放映。

- 参见：基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_15.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

设置幻灯播放时是否有旁白方式。 参见： 例 程 1

**完整正文（站点原文转换）**

**旁白方式 属性**    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)   操作系统支持：Windows

    数据类型：*逻辑型*； 设计时不可用；幻灯片放映是否以有旁白方式放映。

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/p2_15.files/image002.gif)

说明

设置幻灯播放时是否有旁白方式。

参见： [例 程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AA%92%E4%BD%93%E6%92%AD%E6%94%BE%E8%AE%BE%E7%BD%AE.e)

---

### 置文稿

- 原文链接：https://esdn.ijingyi.com/title-13675.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．置文稿 （ PPT文稿对象 ）
- 功能说明：设置文稿，成功返回真，失败返回假，注意：在使用本对象的任何方法及属性前必须先使用本方法。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| PPT文稿对象 | 必填 | PPT文稿 | PPT文稿对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

变量装入返回播放对象的置文稿的成功结果 参见： 例程

**完整正文（站点原文转换）**

**置文稿 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

设置文稿，成功返回真，失败返回假，注意：在使用本对象的任何方法及属性前必须先使用本方法。

*语法：*  逻辑型  *PPT播放*．置文稿 （PPT文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| PPT文稿对象 | 必需的 ； PPT文稿。PPT文稿对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd33.files/image001.gif)

说明

变量装入返回播放对象的置文稿的成功结果

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 释放

- 原文链接：https://esdn.ijingyi.com/title-13676.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：无返回值
- 语法：无返回值 PPT播放 ．释放 （ PPT文稿对象 ）
- 功能说明：将本对象释放，注意：下次使用的时候需要再次使用"置文稿"方法。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| PPT文稿对象 | 必填 | PPT文稿 | PPT文稿对象。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd34.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

文稿 清除关联的播放对象 参见： 例程 1

**完整正文（站点原文转换）**

**释放 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

将本对象释放，注意：下次使用的时候需要再次使用"置文稿"方法。

*语法：*  无返回值  *PPT播放*．释放 （PPT文稿对象）

| 参数名 | 描 述 |
| --- | --- |
| PPT文稿对象 | 必需的 ； PPT文稿。PPT文稿对象。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/cmd34.files/image001.gif)

说明

文稿清除关联的播放对象

参见：[例程 1](http://esdn.125.la/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 取播放设置对象

- 原文链接：https://esdn.ijingyi.com/title-13677.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：对象
- 语法：对象 PPT播放 ．取播放设置对象 （ ）
- 功能说明：获取PowerPoint提供的SlideShowSettings对象，与3.7版的"对象"兼容，可交互操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd35.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取出的 播放设置窗口放入对象变量中 参见： 例程 1

**完整正文（站点原文转换）**

**取播放设置对象 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

获取PowerPoint提供的SlideShowSettings对象，与3.7版的"对象"兼容，可交互操作。

*语法：*  对象  *PPT播放*．取播放设置对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd35.files/image001.gif)

说明

取出的播放设置窗口放入对象变量中**

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取播放视图对象

- 原文链接：https://esdn.ijingyi.com/title-13678.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：对象
- 语法：对象 PPT播放 ．取播放视图对象 （ ）
- 功能说明：获取PowerPoint提供的SlideShowView对象，与3.7版的"对象"兼容，可组合操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd36.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

命令取播放视图对象返回 值放入对象变量 参见： 例程 1

**完整正文（站点原文转换）**

**取播放视图对象 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

获取PowerPoint提供的SlideShowView对象，与3.7版的"对象"兼容，可组合操作。

*语法：*  对象  *PPT播放*．取播放视图对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd36.files/image001.gif)

说明

命令取播放视图对象返回值放入对象变量

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 取播放窗对象

- 原文链接：https://esdn.ijingyi.com/title-13679.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：对象
- 语法：对象 PPT播放 ．取播放窗对象 （ ）
- 功能说明：获取PowerPoint提供的SlideShowWindow对象，与3.7版提供的"对象"兼容，可组合操作。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd37.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

取播放窗对象返回值放入对象变量 参见： 例程 1

**完整正文（站点原文转换）**

**取播放窗对象 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

获取PowerPoint提供的SlideShowWindow对象，与3.7版提供的"对象"兼容，可组合操作。

*语法：*  对象  *PPT播放*．取播放窗对象 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd37.files/image001.gif)

说明

取播放窗对象返回值放入对象变量

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%AF%B9%E8%B1%A1%E5%8F%96%E5%87%BA.e)

---

### 放映

- 原文链接：https://esdn.ijingyi.com/title-13680.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．放映 （ ）
- 功能说明：放映幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象放 映幻灯片 参见： 例程 1

**完整正文（站点原文转换）**

**放映 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

放映幻灯片。

*语法：*  逻辑型  *PPT播放*．放映 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd38.files/image001.gif)

说明

播放对象放映幻灯片

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 结束

- 原文链接：https://esdn.ijingyi.com/title-13681.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：无返回值
- 语法：无返回值 PPT播放 ．结束 （ ）
- 功能说明：结束放映幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象销毁 参见： 例程 1

**完整正文（站点原文转换）**

**结束 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

结束放映幻灯片。

*语法：*  无返回值  *PPT播放*．结束 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd39.files/image001.gif)

说明

播放对象销毁

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/%E5%9F%BA%E6%9C%AC.e)

---

### 切换

- 原文链接：https://esdn.ijingyi.com/title-13682.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．切换 （ 索引 ）
- 功能说明：使用幻灯片索引切换到指定的幻灯片。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 索引 | 必填 | 整数型 | 要切换的数字索引，该索引必须为指向一个已存在的幻灯片。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd40.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象切换到编辑框 1. 内容 参见： 例程 1

**完整正文（站点原文转换）**

**切换 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

使用幻灯片索引切换到指定的幻灯片。

*语法：*  逻辑型  *PPT播放*．切换 （索引）

| 参数名 | 描 述 |
| --- | --- |
| 索引 | 必需的 ； 整数型。要切换的数字索引，该索引必须为指向一个已存在的幻灯片。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd40.files/image001.gif)

说明

播放对象切换到编辑框1.内容

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 到首张

- 原文链接：https://esdn.ijingyi.com/title-13683.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．到首张 （ ）
- 功能说明：切换到第一张幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd41.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象的播放的幻灯片 到首张 参见： 例程1

**完整正文（站点原文转换）**

**到首张 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

切换到第一张幻灯片。

*语法：*  逻辑型  *PPT播放*．到首张 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd41.files/image001.gif)

说明

播放对象的播放的幻灯片到首张

参见：  [例程1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 到尾张

- 原文链接：https://esdn.ijingyi.com/title-13684.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．到尾张 （ ）
- 功能说明：切换到最后一张幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd42.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象的播放 的幻灯片 到尾张 参见： 例程 1

**完整正文（站点原文转换）**

**到尾张 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

切换到最后一张幻灯片。

*语法：*  逻辑型  *PPT播放*．到尾张 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd42.files/image001.gif)

说明

播放对象的播放的幻灯片到尾张

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 下一张

- 原文链接：https://esdn.ijingyi.com/title-13685.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．下一张 （ ）
- 功能说明：切换到下一张幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd43.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象的播放 的幻灯片 到下一张 参见： 例程 1

**完整正文（站点原文转换）**

**下一张 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

切换到下一张幻灯片。

*语法：*  逻辑型  *PPT播放*．下一张 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd43.files/image001.gif)

说明

播放对象的播放的幻灯片到下一张

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 上一张

- 原文链接：https://esdn.ijingyi.com/title-13686.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．上一张 （ ）
- 功能说明：切换到上一张幻灯片。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd44.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象的 播放 的幻灯片 到上一张 参见： 例程 1

**完整正文（站点原文转换）**

**上一张 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

切换到上一张幻灯片。

*语法：*  逻辑型  *PPT播放*．上一张 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd44.files/image001.gif)

说明

播放对象的播放的幻灯片到上一张

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 设放映指针

- 原文链接：https://esdn.ijingyi.com/title-13687.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．设放映指针 （ 指针类型 ， 指针颜色 ）
- 功能说明：设幻灯片片放映时的指针。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 指针类型 | 必填 | 整数型 | 指针类型，使用枚举常量"指针类型"。 |
| 指针颜色 | 必填 | 整数型 | RGB颜色。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd45.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象使用设放映指针参数一为箭头，参数二为黑色 参见： 例程 1

**完整正文（站点原文转换）**

**设放映指针 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

设幻灯片片放映时的指针。

*语法：*  逻辑型  *PPT播放*．设放映指针 （指针类型， 指针颜色）

| 参数名 | 描 述 |
| --- | --- |
| 指针类型 | 必需的 ； 整数型。指针类型，使用枚举常量"指针类型"。 |
| 指针颜色 | 必需的 ； 整数型。RGB颜色。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd45.files/image001.gif)

说明

播放对象使用设放映指针参数一为箭头，参数二为黑色

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 擦除笔迹

- 原文链接：https://esdn.ijingyi.com/title-13688.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．擦除笔迹 （ ）
- 功能说明：擦除幻灯片放映时画入的笔迹。

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

命令播放对象画的笔迹擦除绘画的笔迹 参见： 例程 1

**完整正文（站点原文转换）**

**擦除笔迹 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

擦除幻灯片放映时画入的笔迹。

*语法：*  逻辑型  *PPT播放*．擦除笔迹 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd46.files/image001.gif)

说明

命令播放对象画的笔迹擦除绘画的笔迹

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

### 画线

- 原文链接：https://esdn.ijingyi.com/title-13689.html
- 操作系统支持：Windows 所属对象： PPT播放
- 返回值类型：逻辑型
- 语法：逻辑型 PPT播放 ．画线 （ 起点横坐标 ， 起点纵坐标 ， 终点横坐标 ， 终点纵坐标 ， 宽度 ）
- 功能说明：在幻灯片放映的时候在当前幻灯片上画线。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点横坐标 | 必填 | 整数型 | 线的起点相对于幻灯片左上角的横坐标，磅为单位。 |
| 起点纵坐标 | 必填 | 整数型 | 线的起点相对于幻灯片左上角的纵坐标，磅为单位。 |
| 终点横坐标 | 必填 | 整数型 | 线的终点相对于幻灯片左上角的横坐标，磅为单位。 |
| 终点纵坐标 | 必填 | 整数型 | 线的终点相对于幻灯片左上角的纵坐标，磅为单位。 |
| 宽度 | 必填 | 整数型 | 线条的宽度，磅为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd47.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

播放对象在幻灯播放时在幻灯播放窗上 画线 参见： 例程 1

**完整正文（站点原文转换）**

**画线 方法**   操作系统支持：Windows    所属对象：[PPT播放](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/dt2.htm)

在幻灯片放映的时候在当前幻灯片上画线。

*语法：*  逻辑型  *PPT播放*．画线 （起点横坐标， 起点纵坐标， 终点横坐标， 终点纵坐标， 宽度）

| 参数名 | 描 述 |
| --- | --- |
| 起点横坐标 | 必需的 ； 整数型。线的起点相对于幻灯片左上角的横坐标，磅为单位。 |
| 起点纵坐标 | 必需的 ； 整数型。线的起点相对于幻灯片左上角的纵坐标，磅为单位。 |
| 终点横坐标 | 必需的 ； 整数型。线的终点相对于幻灯片左上角的横坐标，磅为单位。 |
| 终点纵坐标 | 必需的 ； 整数型。线的终点相对于幻灯片左上角的纵坐标，磅为单位。 |
| 宽度 | 必需的 ； 整数型。线条的宽度，磅为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/cmd47.files/image001.gif)

说明

播放对象在幻灯播放时在幻灯播放窗上画线

参见：[例程 1](https://esdn.ijingyi.com/source/plugin/eknow/resource/eppt2000//eppt2000/play%E6%93%8D%E4%BD%9C.e)

---

## 命令分类：其他数据类型（19 条）

### PPT格式

- 原文链接：https://esdn.ijingyi.com/title-13496.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：PowerPoint文件的保存格式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 文稿格式 | 待核实 | 待核实 | 常量值为 1 。 |
| PowerPoint7格式 | 待核实 | 待核实 | 常量值为 2 。 |
| PowerPoint4格式 | 待核实 | 待核实 | 常量值为 3 。 |
| PowerPoint3格式 | 待核实 | 待核实 | 常量值为 4 。 |
| 模板格式 | 待核实 | 待核实 | 常量值为 5 。 |
| RTF格式 | 待核实 | 待核实 | 常量值为 6 。 |
| Show格式 | 待核实 | 待核实 | 常量值为 7 。 |
| AddIn格式 | 待核实 | 待核实 | 常量值为 8 。 |
| PowerPoint4远东格式 | 待核实 | 待核实 | 常量值为 10 。 |
| 默认格式 | 待核实 | 待核实 | 常量值为 11 。 |
| HTML格式 | 待核实 | 待核实 | 常量值为 12 。 |
| HTMLv3格式 | 待核实 | 待核实 | 常量值为 13 。 |
| HTMLDual格式 | 待核实 | 待核实 | 常量值为 14 。 |
| MetaFile格式 | 待核实 | 待核实 | 常量值为 15 。 |
| Gif格式 | 待核实 | 待核实 | 常量值为 16 。 |
| JPEG格式 | 待核实 | 待核实 | 常量值为 17 。 |
| PNG格式 | 待核实 | 待核实 | 常量值为 18 。 |
| BMP格式 | 待核实 | 待核实 | 常量值为 19 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**PPT格式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

PowerPoint文件的保存格式。

| 成员 | 描 述 |
| --- | --- |
| 文稿格式 | 常量值为 1 。 |
| PowerPoint7格式 | 常量值为 2 。 |
| PowerPoint4格式 | 常量值为 3 。 |
| PowerPoint3格式 | 常量值为 4 。 |
| 模板格式 | 常量值为 5 。 |
| RTF格式 | 常量值为 6 。 |
| Show格式 | 常量值为 7 。 |
| AddIn格式 | 常量值为 8 。 |
| PowerPoint4远东格式 | 常量值为 10 。 |
| 默认格式 | 常量值为 11 。 |
| HTML格式 | 常量值为 12 。 |
| HTMLv3格式 | 常量值为 13 。 |
| HTMLDual格式 | 常量值为 14 。 |
| MetaFile格式 | 常量值为 15 。 |
| Gif格式 | 常量值为 16 。 |
| JPEG格式 | 常量值为 17 。 |
| PNG格式 | 常量值为 18 。 |
| BMP格式 | 常量值为 19 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 幻灯版式

- 原文链接：https://esdn.ijingyi.com/title-13497.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：幻灯片的版式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| Mixed版式 | 待核实 | 待核实 | 常量值为 -2 。 |
| Title版式 | 待核实 | 待核实 | 常量值为 1 。 |
| Text版式 | 待核实 | 待核实 | 常量值为 2 。 |
| TwoColumnText版式 | 待核实 | 待核实 | 常量值为 3 。 |
| Table版式 | 待核实 | 待核实 | 常量值为 4 。 |
| TextAndChart版式 | 待核实 | 待核实 | 常量值为 5 。 |
| ChartAndText版式 | 待核实 | 待核实 | 常量值为 6 。 |
| OrgChart版式 | 待核实 | 待核实 | 常量值为 7 。 |
| Chart版式 | 待核实 | 待核实 | 常量值为 8 。 |
| TextAndClipart版式 | 待核实 | 待核实 | 常量值为 9 。 |
| ClipartAndText版式 | 待核实 | 待核实 | 常量值为 10 。 |
| TitleOnly版式 | 待核实 | 待核实 | 常量值为 11 。 |
| Blank版式 | 待核实 | 待核实 | 常量值为 12 。 |
| TextAndObject版式 | 待核实 | 待核实 | 常量值为 13 。 |
| ObjectAndText版式 | 待核实 | 待核实 | 常量值为 14 。 |
| LargeObject版式 | 待核实 | 待核实 | 常量值为 15 。 |
| Object版式 | 待核实 | 待核实 | 常量值为 16 。 |
| TextAndMediaClip版式 | 待核实 | 待核实 | 常量值为 17 。 |
| MediaClipAndText版式 | 待核实 | 待核实 | 常量值为 18 。 |
| ObjectOverText版式 | 待核实 | 待核实 | 常量值为 19 。 |
| TextOverObject版式 | 待核实 | 待核实 | 常量值为 20 。 |
| TextAndTwoObjects版式 | 待核实 | 待核实 | 常量值为 21 。 |
| TwoObjectsAndText版式 | 待核实 | 待核实 | 常量值为 22 。 |
| TwoObjectsOverText版式 | 待核实 | 待核实 | 常量值为 23 。 |
| FourObjects版式 | 待核实 | 待核实 | 常量值为 24 。 |
| VerticalText版式 | 待核实 | 待核实 | 常量值为 25 。 |
| ClipArtAndVerticalText版式 | 待核实 | 待核实 | 常量值为 26 。 |
| VerticalTitleAndText版式 | 待核实 | 待核实 | 常量值为 27 。 |
| VerticalTitleAndTextOverChart版式 | 待核实 | 待核实 | 常量值为 28 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**幻灯版式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

幻灯片的版式。

| 成员 | 描 述 |
| --- | --- |
| Mixed版式 | 常量值为 -2 。 |
| Title版式 | 常量值为 1 。 |
| Text版式 | 常量值为 2 。 |
| TwoColumnText版式 | 常量值为 3 。 |
| Table版式 | 常量值为 4 。 |
| TextAndChart版式 | 常量值为 5 。 |
| ChartAndText版式 | 常量值为 6 。 |
| OrgChart版式 | 常量值为 7 。 |
| Chart版式 | 常量值为 8 。 |
| TextAndClipart版式 | 常量值为 9 。 |
| ClipartAndText版式 | 常量值为 10 。 |
| TitleOnly版式 | 常量值为 11 。 |
| Blank版式 | 常量值为 12 。 |
| TextAndObject版式 | 常量值为 13 。 |
| ObjectAndText版式 | 常量值为 14 。 |
| LargeObject版式 | 常量值为 15 。 |
| Object版式 | 常量值为 16 。 |
| TextAndMediaClip版式 | 常量值为 17 。 |
| MediaClipAndText版式 | 常量值为 18 。 |
| ObjectOverText版式 | 常量值为 19 。 |
| TextOverObject版式 | 常量值为 20 。 |
| TextAndTwoObjects版式 | 常量值为 21 。 |
| TwoObjectsAndText版式 | 常量值为 22 。 |
| TwoObjectsOverText版式 | 常量值为 23 。 |
| FourObjects版式 | 常量值为 24 。 |
| VerticalText版式 | 常量值为 25 。 |
| ClipArtAndVerticalText版式 | 常量值为 26 。 |
| VerticalTitleAndText版式 | 常量值为 27 。 |
| VerticalTitleAndTextOverChart版式 | 常量值为 28 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 文本方向

- 原文链接：https://esdn.ijingyi.com/title-13498.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文本的方向。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 水平 | 待核实 | 待核实 | 常量值为 1 。 |
| 向上 | 待核实 | 待核实 | 常量值为 2 。 |
| 向下 | 待核实 | 待核实 | 常量值为 3 。 |
| 远东垂直 | 待核实 | 待核实 | 常量值为 4 。 |
| 垂直 | 待核实 | 待核实 | 常量值为 5 。 |
| 远东水平旋转 | 待核实 | 待核实 | 常量值为 6 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**文本方向 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文本的方向。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 水平 | 常量值为 1 。 |
| 向上 | 常量值为 2 。 |
| 向下 | 常量值为 3 。 |
| 远东垂直 | 常量值为 4 。 |
| 垂直 | 常量值为 5 。 |
| 远东水平旋转 | 常量值为 6 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 文本水平定位

- 原文链接：https://esdn.ijingyi.com/title-13499.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文本的水平定位方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 居中 | 待核实 | 待核实 | 常量值为 2 。 |
| 无 | 待核实 | 待核实 | 常量值为 1 。 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**文本水平定位 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文本的水平定位方式。

| 成员 | 描 述 |
| --- | --- |
| 居中 | 常量值为 2 。 |
| 无 | 常量值为 1 。 |
| 混合 | 常量值为 -2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 文本垂直定位

- 原文链接：https://esdn.ijingyi.com/title-13500.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文本的垂直定位方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 顶部 | 待核实 | 待核实 | 常量值为 1 。 |
| 顶部基线 | 待核实 | 待核实 | 常量值为 2 。 |
| 中部 | 待核实 | 待核实 | 常量值为 3 。 |
| 底部 | 待核实 | 待核实 | 常量值为 4 。 |
| 底部基线 | 待核实 | 待核实 | 常量值为 1 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**文本垂直定位 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文本的垂直定位方式。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 顶部 | 常量值为 1 。 |
| 顶部基线 | 常量值为 2 。 |
| 中部 | 常量值为 3 。 |
| 底部 | 常量值为 4 。 |
| 底部基线 | 常量值为 1 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 过渡样式

- 原文链接：https://esdn.ijingyi.com/title-13501.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：颜色的过度样式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 水平 | 待核实 | 待核实 | 常量值为 1 。 |
| 垂直 | 待核实 | 待核实 | 常量值为 2 。 |
| 斜上 | 待核实 | 待核实 | 常量值为 3 。 |
| 斜下 | 待核实 | 待核实 | 常量值为 4 。 |
| 角部辐射 | 待核实 | 待核实 | 常量值为 5 。 |
| 从标题 | 待核实 | 待核实 | 常量值为 6 。 |
| 从中央 | 待核实 | 待核实 | 常量值为 7 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**过渡样式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

颜色的过度样式。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 水平 | 常量值为 1 。 |
| 垂直 | 常量值为 2 。 |
| 斜上 | 常量值为 3 。 |
| 斜下 | 常量值为 4 。 |
| 角部辐射 | 常量值为 5 。 |
| 从标题 | 常量值为 6 。 |
| 从中央 | 常量值为 7 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 视图类型

- 原文链接：https://esdn.ijingyi.com/title-13502.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：PPT程序界面的视图类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 幻灯片浏览 | 待核实 | 待核实 | 常量值为 1 。 |
| 幻灯片大纲 | 待核实 | 待核实 | 常量值为 2 。 |
| 备注页 | 待核实 | 待核实 | 常量值为 3 。 |
| 分发大纲 | 待核实 | 待核实 | 常量值为 4 。 |
| 备注大纲 | 待核实 | 待核实 | 常量值为 5 。 |
| 大纲视图 | 待核实 | 待核实 | 常量值为 6 。 |
| 幻灯片排列 | 待核实 | 待核实 | 常量值为 7 。 |
| 标题大纲 | 待核实 | 待核实 | 常量值为 8 。 |
| 正常视图 | 待核实 | 待核实 | 常量值为 9 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**视图类型 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

PPT程序界面的视图类型。

| 成员 | 描 述 |
| --- | --- |
| 幻灯片浏览 | 常量值为 1 。 |
| 幻灯片大纲 | 常量值为 2 。 |
| 备注页 | 常量值为 3 。 |
| 分发大纲 | 常量值为 4 。 |
| 备注大纲 | 常量值为 5 。 |
| 大纲视图 | 常量值为 6 。 |
| 幻灯片排列 | 常量值为 7 。 |
| 标题大纲 | 常量值为 8 。 |
| 正常视图 | 常量值为 9 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### PPT对齐方式

- 原文链接：https://esdn.ijingyi.com/title-13503.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文字对齐方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 居左 | 待核实 | 待核实 | 常量值为 1 。 |
| 居中 | 待核实 | 待核实 | 常量值为 2 。 |
| 居右 | 待核实 | 待核实 | 常量值为 3 。 |
| 自适应 | 待核实 | 待核实 | 常量值为 4 。 |
| 分散 | 待核实 | 待核实 | 常量值为 5 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**PPT对齐方式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文字对齐方式。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 居左 | 常量值为 1 。 |
| 居中 | 常量值为 2 。 |
| 居右 | 常量值为 3 。 |
| 自适应 | 常量值为 4 。 |
| 分散 | 常量值为 5 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 基准线对齐

- 原文链接：https://esdn.ijingyi.com/title-13504.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文字的基准线对齐方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合对齐 | 待核实 | 待核实 | 常量值为 -2 。 |
| 基准对齐 | 待核实 | 待核实 | 常量值为 1 。 |
| 居顶 | 待核实 | 待核实 | 常量值为 2 。 |
| 居中 | 待核实 | 待核实 | 常量值为 3 。 |
| 远东50度 | 待核实 | 待核实 | 常量值为 4 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**基准线对齐 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文字的基准线对齐方式。

| 成员 | 描 述 |
| --- | --- |
| 混合对齐 | 常量值为 -2 。 |
| 基准对齐 | 常量值为 1 。 |
| 居顶 | 常量值为 2 。 |
| 居中 | 常量值为 3 。 |
| 远东50度 | 常量值为 4 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 打印方向

- 原文链接：https://esdn.ijingyi.com/title-13505.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：打印方向。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 水平 | 待核实 | 待核实 | 常量值为 1 。 |
| 垂直 | 待核实 | 待核实 | 常量值为 2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**打印方向 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

打印方向。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 水平 | 常量值为 1 。 |
| 垂直 | 常量值为 2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 音效

- 原文链接：https://esdn.ijingyi.com/title-13506.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：音效类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 无声音 | 待核实 | 待核实 | 常量值为 0 。 |
| 停止前一声音 | 待核实 | 待核实 | 常量值为 1 。 |
| 外部声音文件 | 待核实 | 待核实 | 常量值为 2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**音效 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

音效类型。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 无声音 | 常量值为 0 。 |
| 停止前一声音 | 常量值为 1 。 |
| 外部声音文件 | 常量值为 2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 动画高级模式

- 原文链接：https://esdn.ijingyi.com/title-13507.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：动画高级模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 单击 | 待核实 | 待核实 | 常量值为 1 。 |
| 时间间隔 | 待核实 | 待核实 | 常量值为 2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**动画高级模式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

动画高级模式。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 单击 | 常量值为 1 。 |
| 时间间隔 | 常量值为 2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 播放后效果

- 原文链接：https://esdn.ijingyi.com/title-13508.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：动画播放后效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 不变暗 | 待核实 | 待核实 | 常量值为 0 。 |
| 隐藏 | 待核实 | 待核实 | 常量值为 1 。 |
| 目的颜色 | 待核实 | 待核实 | 常量值为 2 。 |
| 单击后隐藏 | 待核实 | 待核实 | 常量值为 3 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**播放后效果 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

动画播放后效果。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 不变暗 | 常量值为 0 。 |
| 隐藏 | 常量值为 1 。 |
| 目的颜色 | 常量值为 2 。 |
| 单击后隐藏 | 常量值为 3 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 动画方式

- 原文链接：https://esdn.ijingyi.com/title-13509.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：动画播放方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 按系列 | 待核实 | 待核实 | 常量值为 1 。 |
| 按分类 | 待核实 | 待核实 | 常量值为 2 。 |
| 按系列元素 | 待核实 | 待核实 | 常量值为 3 。 |
| 按分类元素 | 待核实 | 待核实 | 常量值为 4 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**动画方式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

动画播放方式。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 按系列 | 常量值为 1 。 |
| 按分类 | 常量值为 2 。 |
| 按系列元素 | 常量值为 3 。 |
| 按分类元素 | 常量值为 4 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 文字动画级别

- 原文链接：https://esdn.ijingyi.com/title-13510.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文字动画级别。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 无级别 | 待核实 | 待核实 | 常量值为 0 。 |
| 第一级 | 待核实 | 待核实 | 常量值为 1 。 |
| 第二级 | 待核实 | 待核实 | 常量值为 2 。 |
| 第三级 | 待核实 | 待核实 | 常量值为 3 。 |
| 第四级 | 待核实 | 待核实 | 常量值为 4 。 |
| 第五级 | 待核实 | 待核实 | 常量值为 5 。 |
| 所有级别 | 待核实 | 待核实 | 常量值为 16 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**文字动画级别 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文字动画级别。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 无级别 | 常量值为 0 。 |
| 第一级 | 常量值为 1 。 |
| 第二级 | 常量值为 2 。 |
| 第三级 | 常量值为 3 。 |
| 第四级 | 常量值为 4 。 |
| 第五级 | 常量值为 5 。 |
| 所有级别 | 常量值为 16 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 文字组效果

- 原文链接：https://esdn.ijingyi.com/title-13511.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：文字组效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 混合 | 待核实 | 待核实 | 常量值为 -2 。 |
| 逐段 | 待核实 | 待核实 | 常量值为 0 。 |
| 逐字 | 待核实 | 待核实 | 常量值为 1 。 |
| 逐字符 | 待核实 | 待核实 | 常量值为 2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**文字组效果 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

文字组效果。

| 成员 | 描 述 |
| --- | --- |
| 混合 | 常量值为 -2 。 |
| 逐段 | 常量值为 0 。 |
| 逐字 | 常量值为 1 。 |
| 逐字符 | 常量值为 2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 放映方式

- 原文链接：https://esdn.ijingyi.com/title-13512.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：幻灯片的放映方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 人工 | 待核实 | 待核实 | 常量值为 1 。 |
| 幻灯片时间 | 待核实 | 待核实 | 常量值为 2 。 |
| 排练时间 | 待核实 | 待核实 | 常量值为 3 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**放映方式 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

幻灯片的放映方式。

| 成员 | 描 述 |
| --- | --- |
| 人工 | 常量值为 1 。 |
| 幻灯片时间 | 常量值为 2 。 |
| 排练时间 | 常量值为 3 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 放映类型

- 原文链接：https://esdn.ijingyi.com/title-13513.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：幻灯片的放映类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 演讲者放映 | 待核实 | 待核实 | 常量值为 1 。 |
| 自行浏览 | 待核实 | 待核实 | 常量值为 2 。 |
| 展览 | 待核实 | 待核实 | 常量值为 3 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**放映类型 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

幻灯片的放映类型。

| 成员 | 描 述 |
| --- | --- |
| 演讲者放映 | 常量值为 1 。 |
| 自行浏览 | 常量值为 2 。 |
| 展览 | 常量值为 3 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 指针类型

- 原文链接：https://esdn.ijingyi.com/title-13514.html
- 操作系统支持：Windows 跳至： PowerPoint2000支持库
- 功能说明：幻灯片放映时的指针类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 无指针 | 待核实 | 待核实 | 常量值为 0 。 |
| 箭头 | 待核实 | 待核实 | 常量值为 1 。 |
| 画笔 | 待核实 | 待核实 | 常量值为 2 。 |
| 隐藏 | 待核实 | 待核实 | 常量值为 3 。 |
| 自动箭头 | 待核实 | 待核实 | 常量值为 4 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**指针类型 枚举常量集合类型**   操作系统支持：Windows    跳至：[PowerPoint2000支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/ePPT2000/index.htm)

幻灯片放映时的指针类型。

| 成员 | 描 述 |
| --- | --- |
| 无指针 | 常量值为 0 。 |
| 箭头 | 常量值为 1 。 |
| 画笔 | 常量值为 2 。 |
| 隐藏 | 常量值为 3 。 |
| 自动箭头 | 常量值为 4 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
