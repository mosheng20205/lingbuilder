# OPenGL支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-13690.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**OPenGL支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库实现了对OPenGL的支持。可以进行OPenGL的坐标变换、建模、测试运算、缓存、效果、纹理、显示列表、光栅、文字、特殊模型、载入三维模型文件、交互操作的操作。

操作系统支持： Windows

**命令类别：**

| 设备操作 | 坐标变换 | 建模操作 | 测试运算 |
| --- | --- | --- | --- |
| 缓存操作 | 显示效果 | 纹理图片 | 显示列表 |
| 光栅操作 | 文字轮廓 | 特殊模型 | 其他 |
| 交互操作 |  |  |  |

**其它数据类型：**

| 像素格式 |  |  |  |
| --- | --- | --- | --- |

[常量表...](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/const.htm)

**
例程列表：**

| 例程名称 | 下载 | 说明 |
| --- | --- | --- |
| 一维纹理 | 一维纹理.e | 本程序演示如何在易语言中利用OPenGL支持库，对一维纹理图片的定义。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 交互操作 | 交互操作.e | 演示了如何通过鼠标点击对图形进行拖动的操作。&nbsp |
| 位图效果 | 位图效果.e | 本程序演示如何在易语言中利用OPenGL支持库，运用光栅位图来模拟放大镜的效果。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 光照效果 | 光照效果.e | 本程序演示如何在易语言中利用OPenGL支持库，在各种立体模型上使用光照后的效果。可以随意改变光的各种颜色成份、光的位置以及模型的类型。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件. &nbsp |
| 单缓存模式 | 单缓存模式.e | 本程序演示如何在易语言中利用OPenGL支持库，进行单缓存模式下的操作。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 双面光 | 双面光.e | 本程序演示如何在易语言中利用OPenGL支持库，调整双面光、全局光以及面的法向量对于一个模型的显示效果的影响。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 在各种组件上使用OPenGL | 在各种组件上显示.e | 本程序演示如何在易语言中利用OPenGL支持库，在不同的组件上使用OPenGL命令。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 坐标变换 | 坐标变换.e | 本程序演示如何在易语言中利用OPenGL支持库，进行坐标的各种变换。可以在三种投影方式中选择一种，然后进行移动、旋转和缩放。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 基础建模 | 基础建模.e | 本程序演示如何在易语言中利用OPenGL支持库，画出点、线段、闭合线段、连续线段等各种简单图形。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件. &nbsp |
| 复杂建模 | 复杂建模.e | 本程序演示如何在易语言中利用OPenGL支持库，画出各种可以随意缩放的虚线、点划线以及使用剖面线填充的多边形。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件. &nbsp |
| 明暗模式 | 明暗模式.e | 本程序演示如何在易语言中利用OPenGL支持库，使用光滑和平滑两种不同明暗模式的效果。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 显示列表 | 显示列表.e | 本程序演示如何在易语言中利用OPenGL支持库，进行显示列表的操作。可以在窗口中拖动画出线段、空心或实心的圆、空心或实心的矩形。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。 &nbsp |
| 模板缓存 | 模板缓存.e | 本程序演示如何在易语言中利用OPenGL支持库，利用模板缓存来模拟光照和影子的效果，可以使用左右光标移动光源，同时影子也跟着移动。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 深度缓存测试 | 深度缓存测试.e | 本程序演示如何在易语言中利用OPenGL支持库，深度缓存测试的具体用法。通过空格键来切换显示物体外部还是内部。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 混合效果 | 混合效果.e | 本程序演示如何在易语言中利用OPenGL支持库，进行混合测试的具体使用方法。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 画曲线和曲面 | 画曲线和曲面.e | 本程序演示如何在进行曲线和曲面的绘制方法。&nbsp |
| 矩形裁剪 | 矩形裁剪.e | 本程序演示如何在易语言中利用OPenGL支持库，使用矩形裁剪来剪切一个三角形。其中蓝色的是没有裁剪的三角形。红色是裁剪后保留下来三角形的一部分。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 立体文字 | 立体文字.e | 本程序演示如何在易语言中利用OPenGL支持库，带纹理的转动的立体中文和英文字符效果。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第一课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。 &nbsp |
| OpenGL支持库及向导使用教程练习 | 第七课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第三课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第九课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第二课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第五课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第八课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第六课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第十二课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第十课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| OpenGL支持库及向导使用教程练习 | 第四课练习.e | 与教程相关章节内容配套的练习。具体操作方法请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 索引颜色 | 索引颜色.e | 本程序演示如何在易语言中利用OPenGL支持库，在颜色索引模式下的颜色定义方法。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 累积缓存操作 | 累积缓存操作.e | 本程序演示如何在易语言中利用OPenGL支持库，使用A、S、D键来切换累积缓存的计算方法，可以观看模拟的光线变化效果。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 纹理效果 | 纹理效果.e | 本程序演示如何在易语言中利用OPenGL支持库，进行纹理图片的映射模式、纹理大小、纹理位置的设置。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 聚光灯 | 聚光灯.e | 本程序演示如何在易语言中利用OPenGL支持库，通过调整聚光角度和衰减选项以及聚光指数选项对聚光灯效果的影响。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 读取3DS文件 | 读取3DS文件.e | 一个3DS模型浏览器。&nbsp |
| 转动的五角星 | 转动的五角星.e | 本程序演示如何在易语言中利用OPenGL支持库，对一个立体模型进行定义。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 选择缓存 | 选择缓存.e | 演示了选择缓存内容的排列方式。&nbsp |
| 金戒指 | 金戒指.e | 本程序演示如何在易语言中利用OPenGL支持库，使用简单的坐标变换来模拟一个金戒指。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 雾化效果 | 雾化效果.e | 本程序演示如何在易语言中利用OPenGL支持库，显示不同类型的雾化效果。可以改变雾的颜色、模式以及起止位置。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |
| 颜色模式 | 颜色模式.e | 本程序演示如何在易语言中利用OPenGL支持库，在红绿蓝混合通道模式下的颜色定义方法。调整红色、绿色、蓝色的数值可以观看到颜色的变化。 具体教程请见随系统附带的"OpenGL支持库及向导使用教程.doc"文件。&nbsp |

## 命令分类：命令类别（126 条）

### 选择像素格式

- 原文链接：https://esdn.ijingyi.com/title-13707.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：整数型
- 语法：整数型 选择像素格式 （ 设备句柄 ， 像素格式 ）
- 功能说明：为指定的设备选择一个匹配的像素格式。成功返回像素格式号，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 | 需要取得像素格式号的设备句柄。 |
| 像素格式 | 必填 | 像素格式 | 为指定的设备选择的像素格式。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd0.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 选择设备的像素格式。 参见 : 例程

**完整正文（站点原文转换）**

**选择像素格式 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

为指定的设备选择一个匹配的像素格式。成功返回像素格式号，失败返回0。

*语法：*  整数型  选择像素格式 （设备句柄， 像素格式）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。需要取得像素格式号的设备句柄。 |
| 像素格式 | 必需的 ； 像素格式。为指定的设备选择的像素格式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd0.files/image002.gif)

说明:

选择设备的像素格式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 置像素格式

- 原文链接：https://esdn.ijingyi.com/title-13708.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：逻辑型
- 语法：逻辑型 置像素格式 （ 设备句柄 ， 像素格式号 ， 像素格式 ）
- 功能说明：使用像素格式号为指定的设备设置像素格式。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 | 需要设置像素格式的设备句柄。 |
| 像素格式号 | 必填 | 整数型 | 与指定的设备相匹配的像素格式号。 |
| 像素格式 | 必填 | 像素格式 | 为指定的设备选择的像素格式。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd1.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置设备的像素格式。 参见 : 例程

**完整正文（站点原文转换）**

**置像素格式 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

使用像素格式号为指定的设备设置像素格式。成功返回真，失败返回假。

*语法：*  逻辑型  置像素格式 （设备句柄， 像素格式号， 像素格式）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。需要设置像素格式的设备句柄。 |
| 像素格式号 | 必需的 ； 整数型。与指定的设备相匹配的像素格式号。 |
| 像素格式 | 必需的 ； 像素格式。为指定的设备选择的像素格式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd1.files/image002.gif)

说明:

设置设备的像素格式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 创建着色描述表

- 原文链接：https://esdn.ijingyi.com/title-13709.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：整数型
- 语法：整数型 创建着色描述表 （ 设备句柄 ）
- 功能说明：为设备创建着色描述表，成功返回着色描述表号，失败返回0。在不用的时候必须删除着色描述表。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 | 需要创建着色描述表的设备句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd2.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建要设置的颜色的描述表。 参见 : 例程

**完整正文（站点原文转换）**

**创建着色描述表 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

为设备创建着色描述表，成功返回着色描述表号，失败返回0。在不用的时候必须删除着色描述表。

*语法：*  整数型  创建着色描述表 （设备句柄）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。需要创建着色描述表的设备句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd2.files/image001.gif)

说明:

创建要设置的颜色的描述表。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 置当前着色描述表

- 原文链接：https://esdn.ijingyi.com/title-13710.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：逻辑型
- 语法：逻辑型 置当前着色描述表 （ 设备句柄 ， 着色描述表号 ）
- 功能说明：设置当前的着色描述表，成功以后所有OPenGL命令都作用在指定的设备上。成功返回真，失败返回假。在不使用着色描述表的时候要释放当前着色描述表。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 | 需要设置着色描述表的设备句柄。0表示释放当前着色描述表。 |
| 着色描述表号 | 必填 | 整数型 | 需要设置的着色描述表，0表示释放当前着色描述表。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd3.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将要使用的颜色表设置到设备上。 参见 : 例程

**完整正文（站点原文转换）**

**置当前着色描述表 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

设置当前的着色描述表，成功以后所有OPenGL命令都作用在指定的设备上。成功返回真，失败返回假。在不使用着色描述表的时候要释放当前着色描述表。

*语法：*  逻辑型  置当前着色描述表 （设备句柄， 着色描述表号）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。需要设置着色描述表的设备句柄。0表示释放当前着色描述表。 |
| 着色描述表号 | 必需的 ； 整数型。需要设置的着色描述表，0表示释放当前着色描述表。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd3.files/image002.gif)

说明:

将要使用的颜色表设置到设备上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 删除着色描述表

- 原文链接：https://esdn.ijingyi.com/title-13711.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：逻辑型
- 语法：逻辑型 删除着色描述表 （ 着色描述表号 ）
- 功能说明：删除当前的着色描述表，解除OPenGL命令对指定的设备的作用。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 着色描述表号 | 必填 | 整数型 | 需要删除的着色描述表。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd4.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 注意在删除着色表前，要释放着色表。 参见 : 例程

**完整正文（站点原文转换）**

**删除着色描述表 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

删除当前的着色描述表，解除OPenGL命令对指定的设备的作用。成功返回真，失败返回假。

*语法：*  逻辑型  删除着色描述表 （着色描述表号）

| 参数名 | 描 述 |
| --- | --- |
| 着色描述表号 | 必需的 ； 整数型。需要删除的着色描述表。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd4.files/image002.gif)

说明:

注意在删除着色表前，要释放着色表。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 取任意设备句柄

- 原文链接：https://esdn.ijingyi.com/title-13712.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：整数型
- 语法：整数型 取任意设备句柄 （ 窗口句柄 ）
- 功能说明：可以取得任意一个窗口组件的设备句柄，成功返回着色描述表号，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd5.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 获取窗口的设备句柄。 参见 : 例程

**完整正文（站点原文转换）**

**取任意设备句柄 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

可以取得任意一个窗口组件的设备句柄，成功返回着色描述表号，失败返回0。

*语法：*  整数型  取任意设备句柄 （窗口句柄）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd5.files/image002.gif)

说明:

获取窗口的设备句柄。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 显示光标

- 原文链接：https://esdn.ijingyi.com/title-13713.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：整数型
- 语法：整数型 显示光标 （ 是否显示 ）
- 功能说明：指定当前应用程序是否显示光标，也可以用来判断当前的光标是否显示，返回值大于0表示正在显示，返回值小于0表示正在隐藏。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否显示 | 必填 | 逻辑型 | 真表示显示，假表示隐藏光标。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd6.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 控制鼠标的显示。即鼠标移到设备窗口上时，鼠标的可见性。 参见 : 例程

**完整正文（站点原文转换）**

**显示光标 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

指定当前应用程序是否显示光标，也可以用来判断当前的光标是否显示，返回值大于0表示正在显示，返回值小于0表示正在隐藏。

*语法：*  整数型  显示光标 （是否显示）

| 参数名 | 描 述 |
| --- | --- |
| 是否显示 | 必需的 ； 逻辑型。真表示显示，假表示隐藏光标。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd6.files/image002.gif)

说明:

控制鼠标的显示。即鼠标移到设备窗口上时，鼠标的可见性。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 释放设备句柄

- 原文链接：https://esdn.ijingyi.com/title-13714.html
- 操作系统支持：Windows
- 所属类别：设备操作
- 返回值类型：整数型
- 语法：整数型 释放设备句柄 （ 窗口句柄 ， 设备句柄 ）
- 功能说明：释放由调用“取任意设备句柄”命令获取的指定设备场景，执行成功为1，失败为0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 |  |
| 设备句柄 | 必填 | 整数型 | 需要释放的设备句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd7.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 释放窗口的设备场景句柄。 参见 : 例程

**完整正文（站点原文转换）**

**释放设备句柄 命令**   操作系统支持：Windows    所属类别：[设备操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct0.htm)

释放由调用“取任意设备句柄”命令获取的指定设备场景，执行成功为1，失败为0。

*语法：*  整数型  释放设备句柄 （窗口句柄， 设备句柄）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。 |
| 设备句柄 | 必需的 ； 整数型。需要释放的设备句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd7.files/image002.gif)

说明:

释放窗口的设备场景句柄。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 矩阵复位

- 原文链接：https://esdn.ijingyi.com/title-13715.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 矩阵复位 （ ）
- 功能说明：让当前选中的坐标系回到原点。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd8.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 清除矩阵坐标，使坐标系回到原点。 参见 : 例程

**完整正文（站点原文转换）**

**矩阵复位 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

让当前选中的坐标系回到原点。

*语法：*  无返回值  矩阵复位 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd8.files/image001.gif)

说明:

清除矩阵坐标，使坐标系回到原点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 选择矩阵模式

- 原文链接：https://esdn.ijingyi.com/title-13716.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 选择矩阵模式 （ 矩阵模式 ）
- 功能说明：选择接下来将要进行操作的坐标矩阵。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 矩阵模式 | 必填 | 整数型 | 参数值可以为以下常量： 5888、#观察矩阵，用来建模的坐标矩阵； 5889、#投影矩阵，用来进行投影变换的坐标矩阵； 5890、#纹理矩阵，用来改变纹理坐标的坐标矩阵。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd9.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 选择支持库设定的矩阵模式。 参见 : 例程

**完整正文（站点原文转换）**

**选择矩阵模式 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

选择接下来将要进行操作的坐标矩阵。

*语法：*  无返回值  选择矩阵模式 （矩阵模式）

| 参数名 | 描 述 |
| --- | --- |
| 矩阵模式 | 必需的 ； 整数型。参数值可以为以下常量： 5888、#观察矩阵，用来建模的坐标矩阵； 5889、#投影矩阵，用来进行投影变换的坐标矩阵； 5890、#纹理矩阵，用来改变纹理坐标的坐标矩阵。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd9.files/image001.gif)

说明:

选择支持库设定的矩阵模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 坐标平移

- 原文链接：https://esdn.ijingyi.com/title-13717.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 坐标平移 （ 横向位置 ， 竖向位置 ， 纵向位置 ）
- 功能说明：平移当前坐标矩阵。在矩阵复位以前，将影响接下来的坐标操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd10.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 平移矩阵的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**坐标平移 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

平移当前坐标矩阵。在矩阵复位以前，将影响接下来的坐标操作。

*语法：*  无返回值  坐标平移 （横向位置， 竖向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd10.files/image001.gif)

说明:

平移矩阵的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 坐标旋转

- 原文链接：https://esdn.ijingyi.com/title-13718.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 坐标旋转 （ 角度 ， 横向位置 ， 竖向位置 ， 纵向位置 ）
- 功能说明：转动轴为从原点指向参数点的一个向量。在矩阵复位以前，将影响接下来的坐标操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 角度 | 必填 | 双精度小数型 | 使用角度单位。 |
| 横向位置 | 必填 | 双精度小数型 | 默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必填 | 双精度小数型 | 默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必填 | 双精度小数型 | 默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd11.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据角度旋转移动矩阵坐标。 参见 : 例程

**完整正文（站点原文转换）**

**坐标旋转 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

转动轴为从原点指向参数点的一个向量。在矩阵复位以前，将影响接下来的坐标操作。

*语法：*  无返回值  坐标旋转 （角度， 横向位置， 竖向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 角度 | 必需的 ； 双精度小数型。使用角度单位。 |
| 横向位置 | 必需的 ； 双精度小数型。默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必需的 ； 双精度小数型。默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必需的 ； 双精度小数型。默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd11.files/image001.gif)

说明:

根据角度旋转移动矩阵坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 坐标缩放

- 原文链接：https://esdn.ijingyi.com/title-13719.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 坐标缩放 （ 横向位置缩放 ， 竖向位置缩放 ， 纵向位置缩放 ）
- 功能说明：缩放当前坐标矩阵。在矩阵复位以前，将影响接下来的坐标操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置缩放 | 必填 | 双精度小数型，初始值为“1” | 默认情况下水平向右为正数，向左为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置缩放 | 必填 | 双精度小数型，初始值为“1” | 默认情况下竖直向上为正数，向下为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置缩放 | 必填 | 双精度小数型，初始值为“1” | 默认情况下屏幕前方为正数，后方为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd12.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 缩放矩阵坐标。 参见 : 例程

**完整正文（站点原文转换）**

**坐标缩放 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

缩放当前坐标矩阵。在矩阵复位以前，将影响接下来的坐标操作。

*语法：*  无返回值  坐标缩放 （横向位置缩放， 竖向位置缩放， 纵向位置缩放）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置缩放 | 必需的 ； 双精度小数型，初始值为“1”。默认情况下水平向右为正数，向左为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置缩放 | 必需的 ； 双精度小数型，初始值为“1”。默认情况下竖直向上为正数，向下为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置缩放 | 必需的 ； 双精度小数型，初始值为“1”。默认情况下屏幕前方为正数，后方为负数，绝对值大于1表示放大，绝对值小于1表示缩小，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd12.files/image001.gif)

说明:

缩放矩阵坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 创建透视投影

- 原文链接：https://esdn.ijingyi.com/title-13720.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 创建透视投影 （ 最左端 ， 最右端 ， 最底端 ， 最顶端 ， 最近端 ， 最远端 ）
- 功能说明：在屏幕里面建立一个长方体形状的透视投影的三维坐标空间。长方体的前后两面平行于屏幕，左右两面垂直屏幕并竖直，上下两面垂直屏幕并水平。近处物体大，远处物体小。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 最左端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最左端。 |
| 最右端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最右端。 |
| 最底端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最底端。 |
| 最顶端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最顶端。 |
| 最近端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最近端。 |
| 最远端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最远端。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd13.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建 一个长方体形状的透明投影 。 参见 : 例程

**完整正文（站点原文转换）**

**创建透视投影 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

在屏幕里面建立一个长方体形状的透视投影的三维坐标空间。长方体的前后两面平行于屏幕，左右两面垂直屏幕并竖直，上下两面垂直屏幕并水平。近处物体大，远处物体小。

*语法：*  无返回值  创建透视投影 （最左端， 最右端， 最底端， 最顶端， 最近端， 最远端）

| 参数名 | 描 述 |
| --- | --- |
| 最左端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最左端。 |
| 最右端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最右端。 |
| 最底端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最底端。 |
| 最顶端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最顶端。 |
| 最近端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最近端。 |
| 最远端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最远端。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd13.files/image001.gif)

说明:

创建一个长方体形状的透明投影。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 创建正投影

- 原文链接：https://esdn.ijingyi.com/title-13721.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 创建正投影 （ 最左端 ， 最右端 ， 最底端 ， 最顶端 ， 最近端 ， 最远端 ）
- 功能说明：在屏幕里面建立一个长方体形状的正投影的三维坐标空间。长方体的前后两面平行于屏幕，左右两面垂直屏幕并竖直，上下两面垂直屏幕并水平。近处物体和远处物体一样的大。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 最左端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最左端。 |
| 最右端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最左端。 |
| 最底端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最底端。 |
| 最顶端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最顶端。 |
| 最近端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最近端。 |
| 最远端 | 必填 | 双精度小数型 | 长方体形状的三维坐标空间的最远端。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建一个长方体形状的正投影 。 参见 : 例程

**完整正文（站点原文转换）**

**创建正投影 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

在屏幕里面建立一个长方体形状的正投影的三维坐标空间。长方体的前后两面平行于屏幕，左右两面垂直屏幕并竖直，上下两面垂直屏幕并水平。近处物体和远处物体一样的大。

*语法：*  无返回值  创建正投影 （最左端， 最右端， 最底端， 最顶端， 最近端， 最远端）

| 参数名 | 描 述 |
| --- | --- |
| 最左端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最左端。 |
| 最右端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最左端。 |
| 最底端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最底端。 |
| 最顶端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最顶端。 |
| 最近端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最近端。 |
| 最远端 | 必需的 ； 双精度小数型。长方体形状的三维坐标空间的最远端。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd14.files/image001.gif)

说明:

创建一个长方体形状的正投影。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 设置视口

- 原文链接：https://esdn.ijingyi.com/title-13722.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 设置视口 （ 左下角横坐标 ， 左下角竖坐标 ， 宽度 ， 高度 ）
- 功能说明：设置设备中可以显示的范围。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左下角横坐标 | 必填 | 整数型 | 必须大于0。如果需要全部显示就设为0。 |
| 左下角竖坐标 | 必填 | 整数型 | 必须大于0。如果需要全部显示就设为0。 |
| 宽度 | 必填 | 整数型 | 必须大于0。如果需要全部显示就设为组件的完整宽度。 |
| 高度 | 必填 | 整数型 | 必须大于0。如果需要全部显示就设为组件的完整高度。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置设备的显示范围。 参见 : 例程

**完整正文（站点原文转换）**

**设置视口 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

设置设备中可以显示的范围。

*语法：*  无返回值  设置视口 （左下角横坐标， 左下角竖坐标， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 左下角横坐标 | 必需的 ； 整数型。必须大于0。如果需要全部显示就设为0。 |
| 左下角竖坐标 | 必需的 ； 整数型。必须大于0。如果需要全部显示就设为0。 |
| 宽度 | 必需的 ； 整数型。必须大于0。如果需要全部显示就设为组件的完整宽度。 |
| 高度 | 必需的 ； 整数型。必须大于0。如果需要全部显示就设为组件的完整高度。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd15.files/image001.gif)

说明:

设置设备的显示范围。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 矩阵入栈

- 原文链接：https://esdn.ijingyi.com/title-13723.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 矩阵入栈 （ ）
- 功能说明：把当前矩阵压入栈顶。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd16.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 与“矩阵出栈”配合使用，将当前矩阵压入栈顶。 参见 : 例程

**完整正文（站点原文转换）**

**矩阵入栈 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

把当前矩阵压入栈顶。

*语法：*  无返回值  矩阵入栈 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd16.files/image001.gif)

说明:

与“矩阵出栈”配合使用，将当前矩阵压入栈顶。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 矩阵出栈

- 原文链接：https://esdn.ijingyi.com/title-13724.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 矩阵出栈 （ ）
- 功能说明：退出栈顶矩阵。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd17.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 与“矩阵入栈”配合使用，退出栈顶的矩阵。 参见 : 例程

**完整正文（站点原文转换）**

**矩阵出栈 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

退出栈顶矩阵。

*语法：*  无返回值  矩阵出栈 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd17.files/image001.gif)

说明:

与“矩阵入栈”配合使用，退出栈顶的矩阵。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 载入矩阵

- 原文链接：https://esdn.ijingyi.com/title-13725.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 载入矩阵 （ 指定矩阵 ）
- 功能说明：把当前坐标模式变换成指定的矩阵。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 指定矩阵 | 必填 | 双精度小数型，参数数据只能提供数组数据 | 矩阵为一个拥有16个成员的数组，多余部分无效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd18.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 载入指定的矩阵模式，该矩阵坐标由自己定义。 参见 : 例程

**完整正文（站点原文转换）**

**载入矩阵 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

把当前坐标模式变换成指定的矩阵。

*语法：*  无返回值  载入矩阵 （指定矩阵）

| 参数名 | 描 述 |
| --- | --- |
| 指定矩阵 | 必需的 ； 双精度小数型，参数数据只能提供数组数据。矩阵为一个拥有16个成员的数组，多余部分无效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd18.files/image001.gif)

说明:

载入指定的矩阵模式，该矩阵坐标由自己定义。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A21.e)

---

### 乘入矩阵

- 原文链接：https://esdn.ijingyi.com/title-13726.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 乘入矩阵 （ 指定矩阵 ）
- 功能说明：把当前坐标模式再乘以指定的矩阵使它变换成目标的矩阵。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 指定矩阵 | 必填 | 双精度小数型，参数数据只能提供数组数据 | 矩阵为一个拥有16个成员的数组，多余部分无效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 以乘入的方式载入自定义的矩阵坐标。 参见 : 例程

**完整正文（站点原文转换）**

**乘入矩阵 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

把当前坐标模式再乘以指定的矩阵使它变换成目标的矩阵。

*语法：*  无返回值  乘入矩阵 （指定矩阵）

| 参数名 | 描 述 |
| --- | --- |
| 指定矩阵 | 必需的 ； 双精度小数型，参数数据只能提供数组数据。矩阵为一个拥有16个成员的数组，多余部分无效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd19.files/image001.gif)

说明:

以乘入的方式载入自定义的矩阵坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A2.e)

---

### 创建对称透视投影

- 原文链接：https://esdn.ijingyi.com/title-13727.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 创建对称透视投影 （ 仰角 ， 宽度除以高度的比值 ， 最近距离 ， 最远距离 ）
- 功能说明：在屏幕里面建立一个四棱台形状的透视投影的三维坐标空间。四棱台的前后两面平行于屏幕，其余四面呈喇叭口形状对称展开。近处物体大，远处物体小。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 仰角 | 必填 | 双精度小数型 | 四棱台形状的三维坐标空间的上下两面张开的角度。角度越大，看到的范围越高，范围在0-180度之间。 |
| 宽度除以高度的比值 | 必填 | 双精度小数型 | 只有与实际的视口大小相匹配的时候，界面看起来才不会变形。 |
| 最近距离 | 必填 | 双精度小数型 | 四棱台形状的三维坐标空间距离屏幕最近的面，必须为正数。 |
| 最远距离 | 必填 | 双精度小数型 | 四棱台形状的三维坐标空间距离屏幕最远的面，必须为正数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd20.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建一个四棱台形状的透明投影 参见 : 例程

**完整正文（站点原文转换）**

**创建对称透视投影 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

在屏幕里面建立一个四棱台形状的透视投影的三维坐标空间。四棱台的前后两面平行于屏幕，其余四面呈喇叭口形状对称展开。近处物体大，远处物体小。

*语法：*  无返回值  创建对称透视投影 （仰角， 宽度除以高度的比值， 最近距离， 最远距离）

| 参数名 | 描 述 |
| --- | --- |
| 仰角 | 必需的 ； 双精度小数型。四棱台形状的三维坐标空间的上下两面张开的角度。角度越大，看到的范围越高，范围在0-180度之间。 |
| 宽度除以高度的比值 | 必需的 ； 双精度小数型。只有与实际的视口大小相匹配的时候，界面看起来才不会变形。 |
| 最近距离 | 必需的 ； 双精度小数型。四棱台形状的三维坐标空间距离屏幕最近的面，必须为正数。 |
| 最远距离 | 必需的 ； 双精度小数型。四棱台形状的三维坐标空间距离屏幕最远的面，必须为正数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd20.files/image001.gif)

说明:

创建一个四棱台形状的透明投影

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A21.e)

---

### 设置观察坐标

- 原文链接：https://esdn.ijingyi.com/title-13728.html
- 操作系统支持：Windows
- 所属类别：坐标变换
- 返回值类型：无返回值
- 语法：无返回值 设置观察坐标 （ 眼睛横坐标 ， 眼睛竖坐标 ， 眼睛纵坐标 ， 中心横坐标 ， 中心竖坐标 ， 中心纵坐标 ， 正上方横坐标 ， 正上方竖坐标 ， 正上方纵坐标 ）
- 功能说明：新的视图空间以坐标中心位置为坐标原点，坐标中心位置到眼睛的矢量为纵向坐标轴的正方向，以正上方矢量为竖向坐标轴的正方向。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 眼睛横坐标 | 必填 | 双精度小数型 |  |
| 眼睛竖坐标 | 必填 | 双精度小数型 |  |
| 眼睛纵坐标 | 必填 | 双精度小数型 |  |
| 中心横坐标 | 必填 | 双精度小数型 |  |
| 中心竖坐标 | 必填 | 双精度小数型 |  |
| 中心纵坐标 | 必填 | 双精度小数型 |  |
| 正上方横坐标 | 必填 | 双精度小数型 |  |
| 正上方竖坐标 | 必填 | 双精度小数型 |  |
| 正上方纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd102.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置新的视图空间。 参见 : 例程

**完整正文（站点原文转换）**

**设置观察坐标 命令**   操作系统支持：Windows    所属类别：[坐标变换](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct1.htm)

新的视图空间以坐标中心位置为坐标原点，坐标中心位置到眼睛的矢量为纵向坐标轴的正方向，以正上方矢量为竖向坐标轴的正方向。

*语法：*  无返回值  设置观察坐标 （眼睛横坐标， 眼睛竖坐标， 眼睛纵坐标， 中心横坐标， 中心竖坐标， 中心纵坐标， 正上方横坐标， 正上方竖坐标， 正上方纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 眼睛横坐标 | 必需的 ； 双精度小数型。 |
| 眼睛竖坐标 | 必需的 ； 双精度小数型。 |
| 眼睛纵坐标 | 必需的 ； 双精度小数型。 |
| 中心横坐标 | 必需的 ； 双精度小数型。 |
| 中心竖坐标 | 必需的 ； 双精度小数型。 |
| 中心纵坐标 | 必需的 ； 双精度小数型。 |
| 正上方横坐标 | 必需的 ； 双精度小数型。 |
| 正上方竖坐标 | 必需的 ； 双精度小数型。 |
| 正上方纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd102.files/image001.gif)

说明:

设置新的视图空间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9D%90%E6%A0%87%E5%8F%98%E6%8D%A21.e)

---

### 开始画

- 原文链接：https://esdn.ijingyi.com/title-13729.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 开始画 （ 画出模式 ）
- 功能说明：画一组相似图元的开始语句。画不同的图元需要执行不同条数的“设置点”的命令。以“停止画”命令结尾。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 画出模式 | 必填 | 整数型 | 参数值可以为以下常量： 0、#点集，在“设置点”命令所定义的位置画出一个点； 1、#线段，在“设置点”命令所定义的位置上，每隔两个点画一条线段； 2、#闭合线段，将“设置点”的命令所定义的点连成一个首尾相连线段； 3、#连续线段，将“设置点”的命令所定义的点连成一串连续的线段； 4、#三角形，在“设置点”命令所定义的位置上，每隔三个点画一个填充颜色的三角形； 5、#连续三角形，在“设置点”命令所定义的位置上，每三个相邻的点画一个填充颜色的三角形； 6、#扇形三角形，在“设置点”命令所定义的位置上，始终以第一个点为顶点，沿着相邻两个点画填充颜色的三角形； 7、#四边形，在“设置点”命令所定义的位置上，每隔四个点画一个填充颜色的四边形； 8、#连续四边形，在“设置点”命令所定义的位置上，每四个相邻的点画一个填充颜色的四边形，并且每增加两个点就再增加一个四边形； 9、#凸多边形，在“设置点”命令所定义的位置上，沿着围绕所有的点组成一个首尾相连的填充颜色的凸多边形。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd21.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 开始画一组相同的表元。 参见 : 例程

**完整正文（站点原文转换）**

**开始画 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

画一组相似图元的开始语句。画不同的图元需要执行不同条数的“设置点”的命令。以“停止画”命令结尾。

*语法：*  无返回值  开始画 （画出模式）

| 参数名 | 描 述 |
| --- | --- |
| 画出模式 | 必需的 ； 整数型。参数值可以为以下常量： 0、#点集，在“设置点”命令所定义的位置画出一个点； 1、#线段，在“设置点”命令所定义的位置上，每隔两个点画一条线段； 2、#闭合线段，将“设置点”的命令所定义的点连成一个首尾相连线段； 3、#连续线段，将“设置点”的命令所定义的点连成一串连续的线段； 4、#三角形，在“设置点”命令所定义的位置上，每隔三个点画一个填充颜色的三角形； 5、#连续三角形，在“设置点”命令所定义的位置上，每三个相邻的点画一个填充颜色的三角形； 6、#扇形三角形，在“设置点”命令所定义的位置上，始终以第一个点为顶点，沿着相邻两个点画填充颜色的三角形； 7、#四边形，在“设置点”命令所定义的位置上，每隔四个点画一个填充颜色的四边形； 8、#连续四边形，在“设置点”命令所定义的位置上，每四个相邻的点画一个填充颜色的四边形，并且每增加两个点就再增加一个四边形； 9、#凸多边形，在“设置点”命令所定义的位置上，沿着围绕所有的点组成一个首尾相连的填充颜色的凸多边形。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd21.files/image001.gif)

说明:

开始画一组相同的表元。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 停止画

- 原文链接：https://esdn.ijingyi.com/title-13730.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 停止画 （ ）
- 功能说明：必须与“开始画”搭配使用，单独使用不会有效果。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 停止画一组相同的表元。 参见 : 例程

**完整正文（站点原文转换）**

**停止画 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

必须与“开始画”搭配使用，单独使用不会有效果。

*语法：*  无返回值  停止画 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd22.files/image001.gif)

说明:

停止画一组相同的表元。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 设置点

- 原文链接：https://esdn.ijingyi.com/title-13731.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置点 （ 横向位置 ， 竖向位置 ， 纵向位置 ）
- 功能说明：插入到“开始画”和“停止画”中来设置模型的顶点。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必填 | 双精度小数型，初始值为“0” | 默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd23.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 在画一组相同表元时，用来设置表元的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

插入到“开始画”和“停止画”中来设置模型的顶点。

*语法：*  无返回值  设置点 （横向位置， 竖向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下水平向右为正数，向左为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 竖向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下竖直向上为正数，向下为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |
| 纵向位置 | 必需的 ； 双精度小数型，初始值为“0”。默认情况下屏幕前方为正数，后方为负数，如果坐标已经变换，那么在上一次坐标系的基础上继续叠加。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd23.files/image001.gif)

说明:

在画一组相同表元时，用来设置表元的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 画矩形

- 原文链接：https://esdn.ijingyi.com/title-13732.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 画矩形 （ 左上角横坐标 ， 左上角纵坐标 ， 右下角横坐标 ， 右下角纵坐标 ）
- 功能说明：在当前坐标原点指定的深度，使用先前选定的颜色画出一个填充颜色的矩形。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左上角横坐标 | 必填 | 双精度小数型 |  |
| 左上角纵坐标 | 必填 | 双精度小数型 |  |
| 右下角横坐标 | 必填 | 双精度小数型 |  |
| 右下角纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd24.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 画一个矩形。 参见 : 例程

**完整正文（站点原文转换）**

**画矩形 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

在当前坐标原点指定的深度，使用先前选定的颜色画出一个填充颜色的矩形。

*语法：*  无返回值  画矩形 （左上角横坐标， 左上角纵坐标， 右下角横坐标， 右下角纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 左上角横坐标 | 必需的 ； 双精度小数型。 |
| 左上角纵坐标 | 必需的 ； 双精度小数型。 |
| 右下角横坐标 | 必需的 ； 双精度小数型。 |
| 右下角纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd24.files/image001.gif)

说明:

画一个矩形。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 设置正面

- 原文链接：https://esdn.ijingyi.com/title-13733.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置正面 （ 模式 ）
- 功能说明：为填充颜色的多边形指定正面的定义方向。当四个手指并拢依次绕着“设置点”命令所定义点的方向握紧时，大拇指所指的方向就是正面的方向。反面即为背面。必须启用“#精选面”才有效。默认为#逆时针。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 模式 | 必填 | 整数型 | 参数值可以为以下常量： 2304、#顺时针； 2305、#逆时针。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd25.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置多边形的方向。 参见 : 例程

**完整正文（站点原文转换）**

**设置正面 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

为填充颜色的多边形指定正面的定义方向。当四个手指并拢依次绕着“设置点”命令所定义点的方向握紧时，大拇指所指的方向就是正面的方向。反面即为背面。必须启用“#精选面”才有效。默认为#逆时针。

*语法：*  无返回值  设置正面 （模式）

| 参数名 | 描 述 |
| --- | --- |
| 模式 | 必需的 ； 整数型。参数值可以为以下常量： 2304、#顺时针； 2305、#逆时针。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd25.files/image001.gif)

说明:

设置多边形的方向。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9F%BA%E7%A1%80%E5%BB%BA%E6%A8%A11.e)

---

### 设置裁剪平面

- 原文链接：https://esdn.ijingyi.com/title-13734.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置裁剪平面 （ 平面号 ， 平面参数 ）
- 功能说明：裁剪面的背面被减去。必须启用“#裁剪测试”和“#零号裁剪面～#五号裁剪面”，才能执行裁剪，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 平面号 | 必填 | 整数型 | 参数值可以为以下常量： 12288、#零号裁剪面； 12289、#一号裁剪面； 12290、#二号裁剪面； 12291、#三号裁剪面； 12292、#四号裁剪面； 12293、#五号裁剪面。 |
| 平面参数 | 必填 | 双精度小数型，参数数据只能提供数组数据 | 参数值为四维数组。这四个数分别为一般平面方程“ A（X - X0)+B（Y - Y0）+ C ( Y - Y0 ) + D = 0” 中的A、B、C、D这几个系数。如果D = 0，那么（A，B，C）代表平面的法向量。如果D = -1，那么1/A，1/B，1/C分别代表平面在X，Y，Z轴上的截距。D默认为0。多余部分无效。例如一个平行于XZ平面，正面指向Y正方向的裁剪面就是{0，1，0，0}。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置要裁剪的平面。 参见 : 例程

**完整正文（站点原文转换）**

**设置裁剪平面 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

裁剪面的背面被减去。必须启用“#裁剪测试”和“#零号裁剪面～#五号裁剪面”，才能执行裁剪，不使用的时候需要关闭。

*语法：*  无返回值  设置裁剪平面 （平面号， 平面参数）

| 参数名 | 描 述 |
| --- | --- |
| 平面号 | 必需的 ； 整数型。参数值可以为以下常量： 12288、#零号裁剪面； 12289、#一号裁剪面； 12290、#二号裁剪面； 12291、#三号裁剪面； 12292、#四号裁剪面； 12293、#五号裁剪面。 |
| 平面参数 | 必需的 ； 双精度小数型，参数数据只能提供数组数据。参数值为四维数组。这四个数分别为一般平面方程“ A（X - X0)+B（Y - Y0）+ C ( Y - Y0 ) + D = 0” 中的A、B、C、D这几个系数。如果D = 0，那么（A，B，C）代表平面的法向量。如果D = -1，那么1/A，1/B，1/C分别代表平面在X，Y，Z轴上的截距。D默认为0。多余部分无效。例如一个平行于XZ平面，正面指向Y正方向的裁剪面就是{0，1，0，0}。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd26.files/image001.gif)

说明:

设置要裁剪的平面。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E8%A3%81%E5%89%AA%E6%93%8D%E4%BD%9C.e)

---

### 设置多边形模式

- 原文链接：https://esdn.ijingyi.com/title-13735.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置多边形模式 （ 应用面 ， 模式 ）
- 功能说明：当绘出图形为封闭的多边形时才起作用。默认设置正面和背面都为面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 应用面 | 必填 | 整数型 | 参数值可以为以下常量： 1028、#正面； 1029、#背面； 1032、#正面和背面。 |
| 模式 | 必填 | 整数型 | 参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； 6914、#面，将画出的多边形显示为填充颜色的多边形。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd27.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置多边形的显示模式。 参见 : 例程

**完整正文（站点原文转换）**

**设置多边形模式 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

当绘出图形为封闭的多边形时才起作用。默认设置正面和背面都为面。

*语法：*  无返回值  设置多边形模式 （应用面， 模式）

| 参数名 | 描 述 |
| --- | --- |
| 应用面 | 必需的 ； 整数型。参数值可以为以下常量： 1028、#正面； 1029、#背面； 1032、#正面和背面。 |
| 模式 | 必需的 ； 整数型。参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； 6914、#面，将画出的多边形显示为填充颜色的多边形。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd27.files/image001.gif)

说明:

设置多边形的显示模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9F%BA%E7%A1%80%E5%BB%BA%E6%A8%A11.e)

---

### 设置线型

- 原文链接：https://esdn.ijingyi.com/title-13736.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置线型 （ 放大倍数 ， 线型 ）
- 功能说明：设置线段的类型。默认使用实线。必须启用“#线型”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 放大倍数 | 必填 | 整数型 | 用来拉伸线型。 |
| 线型 | 必填 | 短整数型 | 按照循序排列的16位二进制数其中每一位代表一个象素，且从低位开始，1表示用当前颜色绘制一个象素，0表示当前不绘制。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd28.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 注意 必须启用 “# 线型 ” 才有效 。 参见 : 例程

**完整正文（站点原文转换）**

**设置线型 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

设置线段的类型。默认使用实线。必须启用“#线型”才有效，不使用的时候需要关闭。

*语法：*  无返回值  设置线型 （放大倍数， 线型）

| 参数名 | 描 述 |
| --- | --- |
| 放大倍数 | 必需的 ； 整数型。用来拉伸线型。 |
| 线型 | 必需的 ； 短整数型。按照循序排列的16位二进制数其中每一位代表一个象素，且从低位开始，1表示用当前颜色绘制一个象素，0表示当前不绘制。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd28.files/image001.gif)

说明:

注意必须启用“#线型”才有效。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 设置图案填充

- 原文链接：https://esdn.ijingyi.com/title-13737.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置图案填充 （ 图案 ）
- 功能说明：设置多边形的填充方式。必须启用“#图案填充”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图案 | 必填 | 字节型，参数数据只能提供数组数据 | 一个拥有128个成员的数组，其中每个字节代表八个位，每一位代表一个象素，最后呈现出一个32×32位的图案。且从低位开始。1表示用当前颜色绘制一个象素，0表示当前不绘制。多余部分无效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 注意 启用 “# 图案填充 ” 才有效 。 参见 : 例程

**完整正文（站点原文转换）**

**设置图案填充 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

设置多边形的填充方式。必须启用“#图案填充”才有效，不使用的时候需要关闭。

*语法：*  无返回值  设置图案填充 （图案）

| 参数名 | 描 述 |
| --- | --- |
| 图案 | 必需的 ； 字节型，参数数据只能提供数组数据。一个拥有128个成员的数组，其中每个字节代表八个位，每一位代表一个象素，最后呈现出一个32×32位的图案。且从低位开始。1表示用当前颜色绘制一个象素，0表示当前不绘制。多余部分无效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd29.files/image001.gif)

说明:

注意启用“#图案填充”才有效。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%A4%8D%E6%9D%82%E5%BB%BA%E6%A8%A1.e)

---

### 标记边界线

- 原文链接：https://esdn.ijingyi.com/title-13738.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 标记边界线 （ 是否为边界线 ）
- 功能说明：在“设置点”之前使用，指定多边形的该点或者线是否是边界线的一部分。只有当多边形的模式为点或者线的时候才有意义。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否为边界线 | 必填 | 逻辑型 | 真表示属于多边形，需要显示，假表示不显示。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置坐标点是否是多边形的一部分。 参见 : 例程

**完整正文（站点原文转换）**

**标记边界线 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

在“设置点”之前使用，指定多边形的该点或者线是否是边界线的一部分。只有当多边形的模式为点或者线的时候才有意义。

*语法：*  无返回值  标记边界线 （是否为边界线）

| 参数名 | 描 述 |
| --- | --- |
| 是否为边界线 | 必需的 ； 逻辑型。真表示属于多边形，需要显示，假表示不显示。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd30.files/image001.gif)

说明:

设置坐标点是否是多边形的一部分。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%9F%BA%E7%A1%80%E5%BB%BA%E6%A8%A11.e)

---

### 矩形剪切

- 原文链接：https://esdn.ijingyi.com/title-13739.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 矩形剪切 （ 左下角横坐标 ， 左下角纵坐标 ， 宽度 ， 高度 ）
- 功能说明：定义一个矩形剪切框。裁剪框内的内容被保留下来，其余被减掉。必须启用“#裁剪测试”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左下角横坐标 | 必填 | 整数型 | 相对于显示设备的左下角，以像素为单位。 |
| 左下角纵坐标 | 必填 | 整数型 | 相对于显示设备的左下角，以像素为单位。 |
| 宽度 | 必填 | 整数型 | 以像素为单位。 |
| 高度 | 必填 | 整数型 | 以像素为单位。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 剪切一个矩形框。 参见 : 例程

**完整正文（站点原文转换）**

**矩形剪切 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

定义一个矩形剪切框。裁剪框内的内容被保留下来，其余被减掉。必须启用“#裁剪测试”才有效，不使用的时候需要关闭。

*语法：*  无返回值  矩形剪切 （左下角横坐标， 左下角纵坐标， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 左下角横坐标 | 必需的 ； 整数型。相对于显示设备的左下角，以像素为单位。 |
| 左下角纵坐标 | 必需的 ； 整数型。相对于显示设备的左下角，以像素为单位。 |
| 宽度 | 必需的 ； 整数型。以像素为单位。 |
| 高度 | 必需的 ； 整数型。以像素为单位。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd31.files/image001.gif)

说明:

剪切一个矩形框。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E8%A3%81%E5%89%AA%E6%93%8D%E4%BD%9C.e)

---

### 设置线宽

- 原文链接：https://esdn.ijingyi.com/title-13740.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：逻辑型
- 语法：逻辑型 设置线宽 （ 宽度 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 宽度 | 必填 | 小数型 | 以像素为单位的正数，负数自动取正，零还原为1。默认为1个像素大小。目前WINDOWS支持的宽度大小在0.5和10.0之间，间隔为0.125，最后使用的实际宽度为最接近这个值的宽度大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd106.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 为所画的线段设置线条宽度 。 参见 : 例程

**完整正文（站点原文转换）**

**设置线宽 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

为所画的线段设置线条宽度。如果操作系统支持指定的宽度大小，返回真，否则返回假。通过启用和停用“光滑线”功能，来控制线段的放样效果。

*语法：*  逻辑型  设置线宽 （宽度）

| 参数名 | 描 述 |
| --- | --- |
| 宽度 | 必需的 ； 小数型。以像素为单位的正数，负数自动取正，零还原为1。默认为1个像素大小。目前WINDOWS支持的宽度大小在0.5和10.0之间，间隔为0.125，最后使用的实际宽度为最接近这个值的宽度大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd106.files/image001.gif)

说明:

为所画的线段设置线条宽度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置点大小

- 原文链接：https://esdn.ijingyi.com/title-13741.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置点大小 （ 大小 ）
- 功能说明：为所画的点设置点的大小。通过启用和停用“光滑点”功能，来控制点的放样效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 大小 | 必填 | 小数型 | 以像素为单位的正数，负数自动取正，零还原为1。默认为1个像素大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd107.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 为所画的点设置点的大小 。 参见 : 例程

**完整正文（站点原文转换）**

**设置点大小 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

为所画的点设置点的大小。通过启用和停用“光滑点”功能，来控制点的放样效果。

*语法：*  无返回值  设置点大小 （大小）

| 参数名 | 描 述 |
| --- | --- |
| 大小 | 必需的 ； 小数型。以像素为单位的正数，负数自动取正，零还原为1。默认为1个像素大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd107.files/image001.gif)

说明:

为所画的点设置点的大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲线控制点

- 原文链接：https://esdn.ijingyi.com/title-13742.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：整数型
- 语法：整数型 设置曲线控制点 （ U参数上限 ， U参数下限 ， 控制点 ）
- 功能说明：为Bezier曲线定义控制点。定义了控制点后，才可以画曲线。成功返回有效的控制点数，失败返回0。始终保持这样的曲线，直到再次使用本命令改变控制点。
本命令使用参数方程来定义曲线上的每个顶点。
X = f （U ）
Y = f （U ）
Z = f （U ）
其中X、Y、Z分别代表曲线上的点的横向位置、竖向位置和纵向位置，U代表参数方程f（）的参数
当参数 U 发生变化的时候，X、Y、Z也相应的改变。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U参数上限 | 必填 | 双精度小数型 | U参数的起始值。 |
| U参数下限 | 必填 | 双精度小数型 | U参数的终止值。 |
| 控制点 | 必填 | 双精度小数型，参数数据只能提供数组数据 | 用来描述控制点的数组，按照U1（X、Y、Z），U2（X、Y、Z），U3（X、Y、Z）...的顺序排列。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd108.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置控制曲线的坐标点。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲线控制点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

为Bezier曲线定义控制点。定义了控制点后，才可以画曲线。成功返回有效的控制点数，失败返回0。始终保持这样的曲线，直到再次使用本命令改变控制点。
	本命令使用参数方程来定义曲线上的每个顶点。
		X = f （U ）
		Y = f （U ）
		Z = f （U ）
	其中X、Y、Z分别代表曲线上的点的横向位置、竖向位置和纵向位置，U代表参数方程f（）的参数
当参数 U 发生变化的时候，X、Y、Z也相应的改变。

*语法：*  整数型  设置曲线控制点 （U参数上限， U参数下限， 控制点）

| 参数名 | 描 述 |
| --- | --- |
| U参数上限 | 必需的 ； 双精度小数型。U参数的起始值。 |
| U参数下限 | 必需的 ； 双精度小数型。U参数的终止值。 |
| 控制点 | 必需的 ； 双精度小数型，参数数据只能提供数组数据。用来描述控制点的数组，按照U1（X、Y、Z），U2（X、Y、Z），U3（X、Y、Z）...的顺序排列。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd108.files/image001.gif)

说明:

设置控制曲线的坐标点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲线点

- 原文链接：https://esdn.ijingyi.com/title-13743.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置曲线点 （ U参数 ）
- 功能说明：插入到“开始画”和“停止画”中来设置曲线上的点。先使用“设置曲线控制点”命令生成曲线，然后指定U参数的值，计算出曲线上点的坐标。必须启用“#曲线坐标”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U参数 | 必填 | 双精度小数型 | 参数值应该介于“设置曲线控制点”命令中的“U参数上限”和“U参数下限”之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd109.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置曲线上一个点的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲线点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

插入到“开始画”和“停止画”中来设置曲线上的点。先使用“设置曲线控制点”命令生成曲线，然后指定U参数的值，计算出曲线上点的坐标。必须启用“#曲线坐标”才有效，不使用的时候需要关闭。

*语法：*  无返回值  设置曲线点 （U参数）

| 参数名 | 描 述 |
| --- | --- |
| U参数 | 必需的 ； 双精度小数型。参数值应该介于“设置曲线控制点”命令中的“U参数上限”和“U参数下限”之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd109.files/image001.gif)

说明:

设置曲线上一个点的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲线等分点

- 原文链接：https://esdn.ijingyi.com/title-13744.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置曲线等分点 （ U向等分数 ， U向等分上限 ， U向等分下限 ）
- 功能说明：先使用“设置曲线控制点”命令生成曲线，然后设置曲线的等分点数，让曲线光滑的过度。
最终得到的每两个相邻U参数的间隔为：（U向等分下限 - U向等分上限）/ U向等分数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U向等分数 | 必填 | 整数型 | 等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| U向等分上限 | 必填 | 双精度小数型 | U参数的起始值。 |
| U向等分下限 | 必填 | 双精度小数型 | U参数的终止值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd110.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置曲线的等分点。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲线等分点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

先使用“设置曲线控制点”命令生成曲线，然后设置曲线的等分点数，让曲线光滑的过度。
	最终得到的每两个相邻U参数的间隔为：（U向等分下限 - U向等分上限）/ U向等分数。

*语法：*  无返回值  设置曲线等分点 （U向等分数， U向等分上限， U向等分下限）

| 参数名 | 描 述 |
| --- | --- |
| U向等分数 | 必需的 ； 整数型。等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| U向等分上限 | 必需的 ； 双精度小数型。U参数的起始值。 |
| U向等分下限 | 必需的 ； 双精度小数型。U参数的终止值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd110.files/image001.gif)

说明:

设置曲线的等分点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 画曲线

- 原文链接：https://esdn.ijingyi.com/title-13745.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 画曲线 （ 画出模式 ， 曲线起点 ， 曲线终点 ）
- 功能说明：先使用“设置曲线控制点”命令生成曲线，然后才能画出曲线。显示范围在“曲线起点”和“曲线终点”之间。必须启用“#曲线坐标”才有效，不使用的时候需要关闭。如果需要使用法向量，必须启用“#自动法向量”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 画出模式 | 必填 | 整数型 | 参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； |
| 曲线起点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲线等分点”命令中的“U向等分数”之间。 |
| 曲线终点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲线等分点”命令中的“U向等分数”之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd111.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据前面设置的坐标画曲线。 参见 : 例程

**完整正文（站点原文转换）**

**画曲线 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

先使用“设置曲线控制点”命令生成曲线，然后才能画出曲线。显示范围在“曲线起点”和“曲线终点”之间。必须启用“#曲线坐标”才有效，不使用的时候需要关闭。如果需要使用法向量，必须启用“#自动法向量”才有效，不使用的时候需要关闭。

*语法：*  无返回值  画曲线 （画出模式， 曲线起点， 曲线终点）

| 参数名 | 描 述 |
| --- | --- |
| 画出模式 | 必需的 ； 整数型。参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； |
| 曲线起点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲线等分点”命令中的“U向等分数”之间。 |
| 曲线终点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲线等分点”命令中的“U向等分数”之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd111.files/image001.gif)

说明:

根据前面设置的坐标画曲线。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲面控制点

- 原文链接：https://esdn.ijingyi.com/title-13746.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：整数型
- 语法：整数型 设置曲面控制点 （ U参数上限 ， U参数下限 ， U向控制点数 ， V参数上限 ， V参数下限 ， 控制点 ）
- 功能说明：为Bezier曲面定义控制点。定义了控制点后，才可以画曲面。成功返回有效的控制点数，失败返回0。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。始终保持这样的曲面，直到再次使用本命令改变控制点。
本命令使用参数方程来定义曲线上的每个顶点。
X = f （U ，V）
Y = f （U ，V）
Z = f （U ，V）
其中X、Y、Z分别代表曲线上的点的横向位置、竖向位置和纵向位置，U、V代表参数方程f（）的参数
当参数 U 、V发生变化的时候，X、Y、Z也相应的改变。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U参数上限 | 必填 | 双精度小数型 | U参数的起始值。 |
| U参数下限 | 必填 | 双精度小数型 | U参数的终止值。 |
| U向控制点数 | 必填 | 整数型 | U向控制点的数目,必须为非零整数。负数自动取正。 |
| V参数上限 | 必填 | 双精度小数型 | V参数的起始值。 |
| V参数下限 | 必填 | 双精度小数型 | V参数的终止值。 |
| 控制点 | 必填 | 双精度小数型，参数数据只能提供数组数据 | 用来描述控制点的数组，按照U1V1（X、Y、Z），U2V1（X、Y、Z）...，U1V2（X、Y、Z），U2V2（X、Y、Z）...的顺序排列。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd112.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置控制曲面的点坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲面控制点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

为Bezier曲面定义控制点。定义了控制点后，才可以画曲面。成功返回有效的控制点数，失败返回0。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。始终保持这样的曲面，直到再次使用本命令改变控制点。
	本命令使用参数方程来定义曲线上的每个顶点。
		X = f （U ，V）
		Y = f （U ，V）
		Z = f （U ，V）
	其中X、Y、Z分别代表曲线上的点的横向位置、竖向位置和纵向位置，U、V代表参数方程f（）的参数
当参数 U 、V发生变化的时候，X、Y、Z也相应的改变。

*语法：*  整数型  设置曲面控制点 （U参数上限， U参数下限， U向控制点数， V参数上限， V参数下限， 控制点）

| 参数名 | 描 述 |
| --- | --- |
| U参数上限 | 必需的 ； 双精度小数型。U参数的起始值。 |
| U参数下限 | 必需的 ； 双精度小数型。U参数的终止值。 |
| U向控制点数 | 必需的 ； 整数型。U向控制点的数目,必须为非零整数。负数自动取正。 |
| V参数上限 | 必需的 ； 双精度小数型。V参数的起始值。 |
| V参数下限 | 必需的 ； 双精度小数型。V参数的终止值。 |
| 控制点 | 必需的 ； 双精度小数型，参数数据只能提供数组数据。用来描述控制点的数组，按照U1V1（X、Y、Z），U2V1（X、Y、Z）...，U1V2（X、Y、Z），U2V2（X、Y、Z）...的顺序排列。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd112.files/image001.gif)

说明:

设置控制曲面的点坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲面点

- 原文链接：https://esdn.ijingyi.com/title-13747.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置曲面点 （ U参数 ， V参数 ）
- 功能说明：插入到“开始画”和“停止画”中来设置曲线上的点。先使用“设置曲面控制点”命令生成曲线，然后指定U参数的值，计算出曲线上点的坐标。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U参数 | 必填 | 双精度小数型 | 参数值应该介于“设置曲面控制点”命令中的“U参数上限”和“U参数下限”之间。 |
| V参数 | 必填 | 双精度小数型 | 参数值应该介于“设置曲面控制点”命令中的“V参数上限”和“V参数下限”之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd113.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置曲面上的点。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲面点 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

插入到“开始画”和“停止画”中来设置曲线上的点。先使用“设置曲面控制点”命令生成曲线，然后指定U参数的值，计算出曲线上点的坐标。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。

*语法：*  无返回值  设置曲面点 （U参数， V参数）

| 参数名 | 描 述 |
| --- | --- |
| U参数 | 必需的 ； 双精度小数型。参数值应该介于“设置曲面控制点”命令中的“U参数上限”和“U参数下限”之间。 |
| V参数 | 必需的 ； 双精度小数型。参数值应该介于“设置曲面控制点”命令中的“V参数上限”和“V参数下限”之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd113.files/image001.gif)

说明:

设置曲面上的点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置曲面等分网格

- 原文链接：https://esdn.ijingyi.com/title-13748.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 设置曲面等分网格 （ U向等分数 ， U向等分上限 ， U向等分下限 ， V向等分数 ， V向等分上限 ， V向等分下限 ）
- 功能说明：先使用“设置曲面控制点”命令生成曲面，然后设置曲面的等分网格，让曲面光滑的过度。
最终得到的每两个相邻U参数的间隔为：（U向等分下限 - U向等分上限）/ U向等分数。
最终得到的每两个相邻V参数的间隔为：（V向等分下限 - V向等分上限）/ V向等分数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| U向等分数 | 必填 | 整数型 | 等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| U向等分上限 | 必填 | 双精度小数型 | U参数的起始值。 |
| U向等分下限 | 必填 | 双精度小数型 | U参数的终止值。 |
| V向等分数 | 必填 | 整数型 | 等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| V向等分上限 | 必填 | 双精度小数型 | V参数的起始值。 |
| V向等分下限 | 必填 | 双精度小数型 | V参数的终止值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd114.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将曲面等分。 参见 : 例程

**完整正文（站点原文转换）**

**设置曲面等分网格 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

先使用“设置曲面控制点”命令生成曲面，然后设置曲面的等分网格，让曲面光滑的过度。
	最终得到的每两个相邻U参数的间隔为：（U向等分下限 - U向等分上限）/ U向等分数。
	最终得到的每两个相邻V参数的间隔为：（V向等分下限 - V向等分上限）/ V向等分数。

*语法：*  无返回值  设置曲面等分网格 （U向等分数， U向等分上限， U向等分下限， V向等分数， V向等分上限， V向等分下限）

| 参数名 | 描 述 |
| --- | --- |
| U向等分数 | 必需的 ； 整数型。等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| U向等分上限 | 必需的 ； 双精度小数型。U参数的起始值。 |
| U向等分下限 | 必需的 ； 双精度小数型。U参数的终止值。 |
| V向等分数 | 必需的 ； 整数型。等分数目越多，曲线越光滑，占用的系统资源也越大。 |
| V向等分上限 | 必需的 ； 双精度小数型。V参数的起始值。 |
| V向等分下限 | 必需的 ； 双精度小数型。V参数的终止值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd114.files/image001.gif)

说明:

将曲面等分。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 画曲面

- 原文链接：https://esdn.ijingyi.com/title-13749.html
- 操作系统支持：Windows
- 所属类别：建模操作
- 返回值类型：无返回值
- 语法：无返回值 画曲面 （ 画出模式 ， 曲面U向起点 ， 曲面U向终点 ， 曲面V向起点 ， 曲面V向终点 ）
- 功能说明：先使用“设置曲面控制点”命令生成曲面，然后才能画出曲面。U向显示范围在“曲面U向起点”和“曲面U向起点”之间。V向显示范围在“曲面V向起点”和“曲面V向起点”之间。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。如果需要使用法向量，必须启用“#自动法向量”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 画出模式 | 必填 | 整数型 | 参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； 6914、#面，将画出的多边形显示为填充颜色的多边形。 |
| 曲面U向起点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲面等分网格”命令中的“U向等分数”之间。 |
| 曲面U向终点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲面等分网格”命令中的“U向等分数”之间。 |
| 曲面V向起点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲面等分网格”命令中的“V向等分数”之间。 |
| 曲面V向终点 | 必填 | 整数型 | 参数值应该介于 0 和“设置曲面等分网格”命令中的“V向等分数”之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd115.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 根据前面设定的坐标画曲面。 参见 : 例程

**完整正文（站点原文转换）**

**画曲面 命令**   操作系统支持：Windows    所属类别：[建模操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct2.htm)

先使用“设置曲面控制点”命令生成曲面，然后才能画出曲面。U向显示范围在“曲面U向起点”和“曲面U向起点”之间。V向显示范围在“曲面V向起点”和“曲面V向起点”之间。必须启用“#曲面坐标”才有效，不使用的时候需要关闭。如果需要使用法向量，必须启用“#自动法向量”才有效，不使用的时候需要关闭。

*语法：*  无返回值  画曲面 （画出模式， 曲面U向起点， 曲面U向终点， 曲面V向起点， 曲面V向终点）

| 参数名 | 描 述 |
| --- | --- |
| 画出模式 | 必需的 ； 整数型。参数值可以为以下常量： 6912、#点，将画出的多边形显示为点； 6913、#线，将画出的多边形显示为线段； 6914、#面，将画出的多边形显示为填充颜色的多边形。 |
| 曲面U向起点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲面等分网格”命令中的“U向等分数”之间。 |
| 曲面U向终点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲面等分网格”命令中的“U向等分数”之间。 |
| 曲面V向起点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲面等分网格”命令中的“V向等分数”之间。 |
| 曲面V向终点 | 必需的 ； 整数型。参数值应该介于 0 和“设置曲面等分网格”命令中的“V向等分数”之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd115.files/image001.gif)

说明:

根据前面设定的坐标画曲面。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置画面质量

- 原文链接：https://esdn.ijingyi.com/title-13750.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 设置画面质量 （ 目标 ， 效果 ）
- 功能说明：在权衡运行速度和画面质量之后，为显示效果的质量和画面的细节处理设置等级。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目标 | 必填 | 整数型 | 参数值可以为以下常量： 3152、#透视修正质量，控制颜色和纹理的显示效果； 3153、#点质量，控制点的显示质量； 3154、#线质量，控制线的显示质量； 3155、#多边形质量，控制多边形的显示质量； 3156、#雾质量，控制雾的显示质量； |
| 效果 | 必填 | 整数型 | 参数值可以为以下常量： 4352、#不考虑；不做特殊要求，让OPenGL自己选择合适的方式进行显示； 4353、#快速；使用最快的显示速度，但是显示效果会有所下降； 4354、#最佳；使用最好的显示效果，但是显示速度会有所下降。当“目标”值为#雾质量时不能使用。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 对显示画面进行处理，一般在初始化设备时使用。 参见 : 例程

**完整正文（站点原文转换）**

**设置画面质量 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

在权衡运行速度和画面质量之后，为显示效果的质量和画面的细节处理设置等级。

*语法：*  无返回值  设置画面质量 （目标， 效果）

| 参数名 | 描 述 |
| --- | --- |
| 目标 | 必需的 ； 整数型。参数值可以为以下常量： 3152、#透视修正质量，控制颜色和纹理的显示效果； 3153、#点质量，控制点的显示质量； 3154、#线质量，控制线的显示质量； 3155、#多边形质量，控制多边形的显示质量； 3156、#雾质量，控制雾的显示质量； |
| 效果 | 必需的 ； 整数型。参数值可以为以下常量： 4352、#不考虑；不做特殊要求，让OPenGL自己选择合适的方式进行显示； 4353、#快速；使用最快的显示速度，但是显示效果会有所下降； 4354、#最佳；使用最好的显示效果，但是显示速度会有所下降。当“目标”值为#雾质量时不能使用。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd32.files/image001.gif)

说明:

对显示画面进行处理，一般在初始化设备时使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%80%89%E6%8B%A9%E7%BC%93%E5%AD%98.e)

---

### 通道混合测试

- 原文链接：https://esdn.ijingyi.com/title-13751.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 通道混合测试 （ 比较函数 ， 测试值 ）
- 功能说明：当比较函数返回真的时候才显示出效果来。只有在红绿蓝混合通道模式下，启用“#通道测试”后才有效。不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 比较函数 | 必填 | 整数型 | 参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果输入值小于测试值时为真； 514、#等于，如果输入值等于测试值时为真； 515、#小于等于，如果输入值小于等于测试值时为真； 516、#大于，如果输入值大于测试值时为真； 517、#不等于，如果输入值不等于测试值时为真； 518、#大于等于，如果输入值大于等于测试值时为真； 519、#有效，始终为真。 |
| 测试值 | 必填 | 小数型 | 范围在[0，1]内的数值。否则无效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 本命令用来测试多种颜色的混合模式。 参见 : 例程

**完整正文（站点原文转换）**

**通道混合测试 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

当比较函数返回真的时候才显示出效果来。只有在红绿蓝混合通道模式下，启用“#通道测试”后才有效。不使用的时候需要关闭。

*语法：*  无返回值  通道混合测试 （比较函数， 测试值）

| 参数名 | 描 述 |
| --- | --- |
| 比较函数 | 必需的 ； 整数型。参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果输入值小于测试值时为真； 514、#等于，如果输入值等于测试值时为真； 515、#小于等于，如果输入值小于等于测试值时为真； 516、#大于，如果输入值大于测试值时为真； 517、#不等于，如果输入值不等于测试值时为真； 518、#大于等于，如果输入值大于等于测试值时为真； 519、#有效，始终为真。 |
| 测试值 | 必需的 ； 小数型。范围在[0，1]内的数值。否则无效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd33.files/image001.gif)

说明:

本命令用来测试多种颜色的混合模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%9B%BE%E5%8C%96%E6%95%88%E6%9E%9C.e)

---

### 混合测试

- 原文链接：https://esdn.ijingyi.com/title-13752.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 混合测试 （ 源值 ， 目标值 ）
- 功能说明：为混合运算设定运算方法。必须启用“#混合测试”才有效。不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 源值 | 必填 | 整数型 | 参数值可以为以下常量： 0、0； 1、1； 770、#源值通道比例； 771、#源值通道比例反； 774、#目标值颜色比例； 775、#目标值颜色比例反； 776、#源值饱和通道。 |
| 目标值 | 必填 | 整数型 | 参数值可以为以下常量： 0、0； 1、1； 768、#源值颜色比例； 769、#源值颜色比例反； 770、#源值通道比例； 771、#源值通道比例反； 772、#目标值通道比例； 773、#目标值通道比例反。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd34.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设定混合测试算法，一般在设备初始化中使用。 参见 : 例程

**完整正文（站点原文转换）**

**混合测试 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

为混合运算设定运算方法。必须启用“#混合测试”才有效。不使用的时候需要关闭。

*语法：*  无返回值  混合测试 （源值， 目标值）

| 参数名 | 描 述 |
| --- | --- |
| 源值 | 必需的 ； 整数型。参数值可以为以下常量： 0、0； 1、1； 770、#源值通道比例； 771、#源值通道比例反； 774、#目标值颜色比例； 775、#目标值颜色比例反； 776、#源值饱和通道。 |
| 目标值 | 必需的 ； 整数型。参数值可以为以下常量： 0、0； 1、1； 768、#源值颜色比例； 769、#源值颜色比例反； 770、#源值通道比例； 771、#源值通道比例反； 772、#目标值通道比例； 773、#目标值通道比例反。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd34.files/image001.gif)

说明:

设定混合测试算法，一般在设备初始化中使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%80%89%E6%8B%A9%E7%BC%93%E5%AD%98.e)

---

### 深度测试

- 原文链接：https://esdn.ijingyi.com/title-13753.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 深度测试 （ 测试方式 ）
- 功能说明：当比较函数返回真的时候才显示出效果来。必须启用“#深度测试”，才能执行测试。不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 测试方式 | 必填 | 整数型 | 通过使用“清除深度缓存”来设置与其比较的测试值。然后与测试值比较并返回比较结果。参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果输入的纵向坐标值小于测试值时为真； 514、#等于，如果输入的纵向坐标值等于测试值时为真； 515、#小于等于，如果输入的纵向坐标值小于等于测试值时为真； 516、#大于，如果输入的纵向坐标值大于测试值时为真； 517、#不等于，如果输入的纵向坐标值不等于测试值时为真； 518、#大于等于，如果输入的纵向坐标值大于等于测试值时为真； 519、#有效，始终为真。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd35.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 测试缓存的深度，一般在设备初始化中使用。 参见 : 例程

**完整正文（站点原文转换）**

**深度测试 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

当比较函数返回真的时候才显示出效果来。必须启用“#深度测试”，才能执行测试。不使用的时候需要关闭。

*语法：*  无返回值  深度测试 （测试方式）

| 参数名 | 描 述 |
| --- | --- |
| 测试方式 | 必需的 ； 整数型。通过使用“清除深度缓存”来设置与其比较的测试值。然后与测试值比较并返回比较结果。参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果输入的纵向坐标值小于测试值时为真； 514、#等于，如果输入的纵向坐标值等于测试值时为真； 515、#小于等于，如果输入的纵向坐标值小于等于测试值时为真； 516、#大于，如果输入的纵向坐标值大于测试值时为真； 517、#不等于，如果输入的纵向坐标值不等于测试值时为真； 518、#大于等于，如果输入的纵向坐标值大于等于测试值时为真； 519、#有效，始终为真。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd35.files/image001.gif)

说明:

测试缓存的深度，一般在设备初始化中使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%80%89%E6%8B%A9%E7%BC%93%E5%AD%98.e)

---

### 模板测试

- 原文链接：https://esdn.ijingyi.com/title-13754.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 模板测试 （ 测试方式 ， 测试位 ， 测试值 ）
- 功能说明：为模板运算设定影响范围。必须启用“#模板测试”，才能执行测试。不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 测试方式 | 必填 | 整数型 | 参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果测试值的测试位小于输入值的测试位时为真； 514、#等于，如果测试值的测试位等于输入值的测试位时为真； 515、#小于等于，如果测试值的测试位小于等于输入值的测试位时为真； 516、#大于，如果测试值的测试位大于输入值的测试位时为真； 517、#不等于，如果测试值的测试位不等于输入值的测试位时为真； 518、#大于等于，如果测试值的测试位大于等于输入值的测试位时为真； 519、#有效，始终为真。 |
| 测试位 | 必填 | 整数型 | 需要测试模板的位。 |
| 测试值 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd36.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设定模板运算。 参见 : 例程

**完整正文（站点原文转换）**

**模板测试 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

为模板运算设定影响范围。必须启用“#模板测试”，才能执行测试。不使用的时候需要关闭。

*语法：*  无返回值  模板测试 （测试方式， 测试位， 测试值）

| 参数名 | 描 述 |
| --- | --- |
| 测试方式 | 必需的 ； 整数型。参数值可以为以下常量： 512、#失效，始终为假； 513、#小于，如果测试值的测试位小于输入值的测试位时为真； 514、#等于，如果测试值的测试位等于输入值的测试位时为真； 515、#小于等于，如果测试值的测试位小于等于输入值的测试位时为真； 516、#大于，如果测试值的测试位大于输入值的测试位时为真； 517、#不等于，如果测试值的测试位不等于输入值的测试位时为真； 518、#大于等于，如果测试值的测试位大于等于输入值的测试位时为真； 519、#有效，始终为真。 |
| 测试位 | 必需的 ； 整数型。需要测试模板的位。 |
| 测试值 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd36.files/image001.gif)

说明:

设定模板运算。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%A8%A1%E6%9D%BF%E7%BC%93%E5%AD%98.e)

---

### 模板测试操作

- 原文链接：https://esdn.ijingyi.com/title-13755.html
- 操作系统支持：Windows
- 所属类别：测试运算
- 返回值类型：无返回值
- 语法：无返回值 模板测试操作 （ 模板测试失败时的操作 ， 深度测试失败时的操作 ， 深度测试通过时的操作 ）
- 功能说明：为模板运算设定运算方法。必须启用“#模板测试”，才能执行测试。不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 模板测试失败时的操作 | 必填 | 整数型 | 参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反。 |
| 深度测试失败时的操作 | 必填 | 整数型 | 当模板测试通过，但是深度测试失败的时候所进行的操作。参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反； |
| 深度测试通过时的操作 | 必填 | 整数型 | 当模板测试和深度测试都通过时候所进行的操作。参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd37.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 进行测试模板运算。 参见 : 例程

**完整正文（站点原文转换）**

**模板测试操作 命令**   操作系统支持：Windows    所属类别：[测试运算](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct3.htm)

为模板运算设定运算方法。必须启用“#模板测试”，才能执行测试。不使用的时候需要关闭。

*语法：*  无返回值  模板测试操作 （模板测试失败时的操作， 深度测试失败时的操作， 深度测试通过时的操作）

| 参数名 | 描 述 |
| --- | --- |
| 模板测试失败时的操作 | 必需的 ； 整数型。参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反。 |
| 深度测试失败时的操作 | 必需的 ； 整数型。当模板测试通过，但是深度测试失败的时候所进行的操作。参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反； |
| 深度测试通过时的操作 | 必需的 ； 整数型。当模板测试和深度测试都通过时候所进行的操作。参数值可以为以下常量： 0、0；，把模板缓存值替换0； 7680、#保持当前值，保持当前的模板缓存值； 7681、#替换当前值，把模板缓存值替换为测试值； 7682、#增加当前值，增加模板缓存值，但不能超过模板缓存所能表达的最大值； 7683、#减去当前值，减去模板缓存值，但不能低于0； 5386、#倒置当前值，把模板缓存值取反。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd37.files/image001.gif)

说明:

进行测试模板运算。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%A8%A1%E6%9D%BF%E7%BC%93%E5%AD%98.e)

---

### 交换缓存

- 原文链接：https://esdn.ijingyi.com/title-13756.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：逻辑型
- 语法：逻辑型 交换缓存 （ 设备句柄 ）
- 功能说明：交换后台缓存与前台缓存。将后台缓存显示出来，对前台缓存进行操作。成功返回真，失败返回假。在双缓存模式下才用效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 交换前后台缓存。 参见 : 例程

**完整正文（站点原文转换）**

**交换缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

交换后台缓存与前台缓存。将后台缓存显示出来，对前台缓存进行操作。成功返回真，失败返回假。在双缓存模式下才用效。

*语法：*  逻辑型  交换缓存 （设备句柄）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd38.files/image001.gif)

说明:

交换前后台缓存。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 结束绘图操作

- 原文链接：https://esdn.ijingyi.com/title-13757.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 结束绘图操作 （ ）
- 功能说明：单缓存模式下才可以使用。等待所有已经提交的OpenGL命令执行完毕后才返回。不能在“开始画”和“停止画”之间执行本语句。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 结束缓存绘画的操作。 参见 : 例程

**完整正文（站点原文转换）**

**结束绘图操作 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

单缓存模式下才可以使用。等待所有已经提交的OpenGL命令执行完毕后才返回。不能在“开始画”和“停止画”之间执行本语句。

*语法：*  无返回值  结束绘图操作 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd39.files/image001.gif)

说明:

结束缓存绘画的操作。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%8D%95%E7%BC%93%E5%AD%98%E6%A8%A1%E5%BC%8F.e)

---

### 强制结束绘图操作

- 原文链接：https://esdn.ijingyi.com/title-13758.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 强制结束绘图操作 （ ）
- 功能说明：单缓存模式下才可以使用。强制结束，并且返回，不管已经提交的OpenGL命令是否执行完毕。不能在“开始画”和“停止画”之间执行本语句。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd40.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 强制结束缓存的绘画操作。 参见 : 例程

**完整正文（站点原文转换）**

**强制结束绘图操作 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

单缓存模式下才可以使用。强制结束，并且返回，不管已经提交的OpenGL命令是否执行完毕。不能在“开始画”和“停止画”之间执行本语句。

*语法：*  无返回值  强制结束绘图操作 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd40.files/image001.gif)

说明:

强制结束缓存的绘画操作。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%8D%95%E7%BC%93%E5%AD%98%E6%A8%A1%E5%BC%8F.e)

---

### 操作累积缓存

- 原文链接：https://esdn.ijingyi.com/title-13759.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 操作累积缓存 （ 操作方式 ， 操作值 ）
- 功能说明：对裁剪区域里的缓存颜色进行累积缓存操作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 操作方式 | 必填 | 整数型 | 参数值可以为以下常量： 256、#获取缓存，获取红绿蓝以及混合通道的数据，并加入到累积缓存里； 257、#载入缓存，获取红绿蓝以及混合通道的数据，并加入到累积缓存里，但是不包括缓存现有的数据； 258、#返回缓存，将累积缓存里的数据返回到颜色缓存中去； 259、#缩放缓存，按照操作值来缩放累积缓存里的数据； 260、#加入缓存，增加累积缓存里每个红绿蓝以及混合通道的数据。 |
| 操作值 | 必填 | 小数型 | 范围在[-1，1]内的数值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd41.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 对累积的缓存进行操作。 参见 : 例程

**完整正文（站点原文转换）**

**操作累积缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

对裁剪区域里的缓存颜色进行累积缓存操作。

*语法：*  无返回值  操作累积缓存 （操作方式， 操作值）

| 参数名 | 描 述 |
| --- | --- |
| 操作方式 | 必需的 ； 整数型。参数值可以为以下常量： 256、#获取缓存，获取红绿蓝以及混合通道的数据，并加入到累积缓存里； 257、#载入缓存，获取红绿蓝以及混合通道的数据，并加入到累积缓存里，但是不包括缓存现有的数据； 258、#返回缓存，将累积缓存里的数据返回到颜色缓存中去； 259、#缩放缓存，按照操作值来缩放累积缓存里的数据； 260、#加入缓存，增加累积缓存里每个红绿蓝以及混合通道的数据。 |
| 操作值 | 必需的 ； 小数型。范围在[-1，1]内的数值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd41.files/image001.gif)

说明:

对累积的缓存进行操作。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 清除缓存

- 原文链接：https://esdn.ijingyi.com/title-13760.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除缓存 （ 缓存 ）
- 功能说明：指定清除的一项或几项缓存。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 缓存 | 必填 | 整数型 | 可以使用下列参数值的位或后的数值。参数值可以为以下常量： 256、#深度缓存位，将深度缓存恢复到默认值； 512、#累积缓存位，将累积缓存恢复到默认值； 1024、#模板缓存位，将模板缓存恢复到默认值； 16384、#颜色缓存位，将颜色缓存恢复到默认值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd42.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 清除缓存中的颜色位。 参见 : 例程

**完整正文（站点原文转换）**

**清除缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

指定清除的一项或几项缓存。

*语法：*  无返回值  清除缓存 （缓存）

| 参数名 | 描 述 |
| --- | --- |
| 缓存 | 必需的 ； 整数型。可以使用下列参数值的位或后的数值。参数值可以为以下常量： 256、#深度缓存位，将深度缓存恢复到默认值； 512、#累积缓存位，将累积缓存恢复到默认值； 1024、#模板缓存位，将模板缓存恢复到默认值； 16384、#颜色缓存位，将颜色缓存恢复到默认值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd42.files/image001.gif)

说明:

清除缓存中的颜色位。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%80%89%E6%8B%A9%E7%BC%93%E5%AD%98.e)

---

### 清除累积缓存

- 原文链接：https://esdn.ijingyi.com/title-13761.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除累积缓存 （ 红色位 ， 绿色位 ， 蓝色位 ， 通道位 ）
- 功能说明：设置累积缓存的默认值。不执行本命令前参数全部为0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 红色位 | 必填 | 小数型，初始值为“0” | 范围在[-1，1]内的数值。 |
| 绿色位 | 必填 | 小数型，初始值为“0” | 范围在[-1，1]内的数值。 |
| 蓝色位 | 必填 | 小数型，初始值为“0” | 范围在[-1，1]内的数值。 |
| 通道位 | 必填 | 小数型，初始值为“0” | 范围在[-1，1]内的数值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd43.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置累积缓存的初始值。 参见 : 例程

**完整正文（站点原文转换）**

**清除累积缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置累积缓存的默认值。不执行本命令前参数全部为0。

*语法：*  无返回值  清除累积缓存 （红色位， 绿色位， 蓝色位， 通道位）

| 参数名 | 描 述 |
| --- | --- |
| 红色位 | 必需的 ； 小数型，初始值为“0”。范围在[-1，1]内的数值。 |
| 绿色位 | 必需的 ； 小数型，初始值为“0”。范围在[-1，1]内的数值。 |
| 蓝色位 | 必需的 ； 小数型，初始值为“0”。范围在[-1，1]内的数值。 |
| 通道位 | 必需的 ； 小数型，初始值为“0”。范围在[-1，1]内的数值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd43.files/image001.gif)

说明:

设置累积缓存的初始值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 清除颜色缓存

- 原文链接：https://esdn.ijingyi.com/title-13762.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除颜色缓存 （ 红色位 ， 绿色位 ， 蓝色位 ， 通道位 ）
- 功能说明：设置颜色缓存的默认值。不执行本命令前参数全部为0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 红色位 | 必填 | 小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 绿色位 | 必填 | 小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 蓝色位 | 必填 | 小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 通道位 | 必填 | 小数型，初始值为“0” | 范围在[0，1]内的数值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd44.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置颜色缓存的初始值。 参见 : 例程

**完整正文（站点原文转换）**

**清除颜色缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置颜色缓存的默认值。不执行本命令前参数全部为0。

*语法：*  无返回值  清除颜色缓存 （红色位， 绿色位， 蓝色位， 通道位）

| 参数名 | 描 述 |
| --- | --- |
| 红色位 | 必需的 ； 小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 绿色位 | 必需的 ； 小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 蓝色位 | 必需的 ； 小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 通道位 | 必需的 ； 小数型，初始值为“0”。范围在[0，1]内的数值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd44.files/image001.gif)

说明:

设置颜色缓存的初始值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 清除深度缓存

- 原文链接：https://esdn.ijingyi.com/title-13763.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除深度缓存 （ 深度 ）
- 功能说明：设置深度缓存的默认值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 深度 | 必填 | 双精度小数型，初始值为“1” | 范围在[0，1]内的数值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd45.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置深度缓存的初始值。 参见 : 例程

**完整正文（站点原文转换）**

**清除深度缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置深度缓存的默认值。

*语法：*  无返回值  清除深度缓存 （深度）

| 参数名 | 描 述 |
| --- | --- |
| 深度 | 必需的 ； 双精度小数型，初始值为“1”。范围在[0，1]内的数值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd45.files/image001.gif)

说明:

设置深度缓存的初始值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 清除模板缓存

- 原文链接：https://esdn.ijingyi.com/title-13764.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除模板缓存 （ 模板值 ）
- 功能说明：设置模板缓存的默认值。不执行本命令前模板值为0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 模板值 | 必填 | 整数型，初始值为“0” |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置模板缓存的初始值。 参见 : 例程

**完整正文（站点原文转换）**

**清除模板缓存 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置模板缓存的默认值。不执行本命令前模板值为0。

*语法：*  无返回值  清除模板缓存 （模板值）

| 参数名 | 描 述 |
| --- | --- |
| 模板值 | 必需的 ； 整数型，初始值为“0”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd46.files/image001.gif)

说明:

设置模板缓存的初始值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%A8%A1%E6%9D%BF%E7%BC%93%E5%AD%98.e)

---

### 清除颜色索引

- 原文链接：https://esdn.ijingyi.com/title-13765.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 清除颜色索引 （ 颜色索引号 ）
- 功能说明：设置颜色索引的默认值。不执行本命令前颜色索引号为0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色索引号 | 必填 | 小数型，初始值为“0” |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd47.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置颜色索引的初始值。 参见 : 例程

**完整正文（站点原文转换）**

**清除颜色索引 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置颜色索引的默认值。不执行本命令前颜色索引号为0。

*语法：*  无返回值  清除颜色索引 （颜色索引号）

| 参数名 | 描 述 |
| --- | --- |
| 颜色索引号 | 必需的 ； 小数型，初始值为“0”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd47.files/image001.gif)

说明:

设置颜色索引的初始值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 设置颜色

- 原文链接：https://esdn.ijingyi.com/title-13766.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 设置颜色 （ 红色位 ， 绿色位 ， 蓝色位 ， 通道位 ）
- 功能说明：设置接下来的图元的颜色。能在“开始画”和“停止画”之间执行本语句。只有在红绿蓝混合通道模式下有效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 红色位 | 必填 | 双精度小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 绿色位 | 必填 | 双精度小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 蓝色位 | 必填 | 双精度小数型，初始值为“0” | 范围在[0，1]内的数值。 |
| 通道位 | 必填 | 双精度小数型，初始值为“1” | 范围在[0，1]内的数值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd48.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置以后要画的图元的颜色。 参见 : 例程

**完整正文（站点原文转换）**

**设置颜色 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置接下来的图元的颜色。能在“开始画”和“停止画”之间执行本语句。只有在红绿蓝混合通道模式下有效。

*语法：*  无返回值  设置颜色 （红色位， 绿色位， 蓝色位， 通道位）

| 参数名 | 描 述 |
| --- | --- |
| 红色位 | 必需的 ； 双精度小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 绿色位 | 必需的 ； 双精度小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 蓝色位 | 必需的 ； 双精度小数型，初始值为“0”。范围在[0，1]内的数值。 |
| 通道位 | 必需的 ； 双精度小数型，初始值为“1”。范围在[0，1]内的数值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd48.files/image001.gif)

说明:

设置以后要画的图元的颜色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 设置颜色索引

- 原文链接：https://esdn.ijingyi.com/title-13767.html
- 操作系统支持：Windows
- 所属类别：缓存操作
- 返回值类型：无返回值
- 语法：无返回值 设置颜色索引 （ 颜色索引号 ）
- 功能说明：设置接下来的图元的颜色。能在“开始画”和“停止画”之间执行本语句。只有在颜色索引模式下有效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色索引号 | 必填 | 小数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd49.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置以后要画的图元的颜色的索引号。 参见 : 例程

**完整正文（站点原文转换）**

**设置颜色索引 命令**   操作系统支持：Windows    所属类别：[缓存操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct4.htm)

设置接下来的图元的颜色。能在“开始画”和“停止画”之间执行本语句。只有在颜色索引模式下有效。

*语法：*  无返回值  设置颜色索引 （颜色索引号）

| 参数名 | 描 述 |
| --- | --- |
| 颜色索引号 | 必需的 ； 小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd49.files/image001.gif)

说明:

设置以后要画的图元的颜色的索引号。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%B4%AF%E7%A7%AF%E7%BC%93%E5%AD%98%E6%93%8D%E4%BD%9C.e)

---

### 启用功能

- 原文链接：https://esdn.ijingyi.com/title-13768.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 启用功能 （ 功能 ）
- 功能说明：启用某项功能后，会一直保持启用状态。要关闭该功能，必须使用停用功能才能停止。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 功能 | 必填 | 整数型 | 参数值可以为以下常量： 3008、#通道测试； 3042、#混合测试； 2903、#材质颜色； 2929、#深度测试； 2912、#雾； 2884、#精选面； 2896、#光照； 2852、#线型； 3153、#点质量； 3154、#线质量； 2847、#光滑点； 2848、#光滑线； 2977、#单位法向量； 2882、#图案填充； 3479、#曲线坐标； 3511、#曲面坐标； 3456、#自动法向量 3089、#裁剪测试； 2960、#模板测试； 3552、#一维纹理； 3553、#二维纹理； 3168、#生成S向纹理； 3169、#生成T向纹理； 12288--12293、#零号裁剪面--五号裁剪面； 16384--16391、#零号光源--七号光源。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd50.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 启动某项功能的使用。 参见 : 例程

**完整正文（站点原文转换）**

**启用功能 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

启用某项功能后，会一直保持启用状态。要关闭该功能，必须使用停用功能才能停止。

*语法：*  无返回值  启用功能 （功能）

| 参数名 | 描 述 |
| --- | --- |
| 功能 | 必需的 ； 整数型。参数值可以为以下常量： 3008、#通道测试； 3042、#混合测试； 2903、#材质颜色； 2929、#深度测试； 2912、#雾； 2884、#精选面； 2896、#光照； 2852、#线型； 3153、#点质量； 3154、#线质量； 2847、#光滑点； 2848、#光滑线； 2977、#单位法向量； 2882、#图案填充； 3479、#曲线坐标； 3511、#曲面坐标； 3456、#自动法向量 3089、#裁剪测试； 2960、#模板测试； 3552、#一维纹理； 3553、#二维纹理； 3168、#生成S向纹理； 3169、#生成T向纹理； 12288--12293、#零号裁剪面--五号裁剪面； 16384--16391、#零号光源--七号光源。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd50.files/image001.gif)

说明:

启动某项功能的使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 停用功能

- 原文链接：https://esdn.ijingyi.com/title-13769.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 停用功能 （ 功能 ）
- 功能说明：与启用功能搭配使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 功能 | 必填 | 整数型 | 参数值可以为以下常量： 3008、#通道测试； 3042、#混合测试； 2903、#材质颜色； 2929、#深度测试； 2912、#雾； 2884、#精选面； 2896、#光照； 2852、#线型； 3153、#点质量； 3154、#线质量； 2847、#光滑点； 2848、#光滑线； 2977、#单位法向量； 2882、#图案填充； 3479、#曲线坐标； 3511、#曲面坐标； 3456、#自动法向量 3089、#裁剪测试； 2960、#模板测试； 3552、#一维纹理； 3553、#二维纹理； 3168、#生成S向纹理； 3169、#生成T向纹理； 12288--12293、#零号裁剪面--五号裁剪面； 16384--16391、#零号光源--七号光源。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd51.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 停止某项功能的使用。 参见 : 例程

**完整正文（站点原文转换）**

**停用功能 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

与启用功能搭配使用。

*语法：*  无返回值  停用功能 （功能）

| 参数名 | 描 述 |
| --- | --- |
| 功能 | 必需的 ； 整数型。参数值可以为以下常量： 3008、#通道测试； 3042、#混合测试； 2903、#材质颜色； 2929、#深度测试； 2912、#雾； 2884、#精选面； 2896、#光照； 2852、#线型； 3153、#点质量； 3154、#线质量； 2847、#光滑点； 2848、#光滑线； 2977、#单位法向量； 2882、#图案填充； 3479、#曲线坐标； 3511、#曲面坐标； 3456、#自动法向量 3089、#裁剪测试； 2960、#模板测试； 3552、#一维纹理； 3553、#二维纹理； 3168、#生成S向纹理； 3169、#生成T向纹理； 12288--12293、#零号裁剪面--五号裁剪面； 16384--16391、#零号光源--七号光源。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd51.files/image001.gif)

说明:

停止某项功能的使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E6%9B%B2%E7%BA%BF%E5%92%8C%E6%9B%B2%E9%9D%A2.e)

---

### 设置光源参数

- 原文链接：https://esdn.ijingyi.com/title-13770.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置光源参数 （ 光源号 ， 参数名称 ， 参数值 ）
- 功能说明：必须启用“#光照”后才有效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 光源号 | 必填 | 整数型 | 参数值可以为以下常量： 16384、#零号光源； 16385、#一号光源； 16386、#二号光源； 16387、#三号光源； 16388、#四号光源； 16389、#五号光源； 16390、#六号光源； 16391、#七号光源。 |
| 参数名称 | 必填 | 整数型 | 参数值可以为以下常量： 4608、#环境光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组 ，默认值为（0，0，0，1），多余部分无效； 4609、#漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组 ，#零号光源的默认值为（1，1，1，1），其他光源的默认值为（0，0，0，1），多余部分无效； 4610、#镜面光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，#零号光源的默认值为（1，1，1，1），其他光源的默认值为（0，0，0，1），多余部分无效； 4611、#光源位置，参数值为四维数组，默认值（0，0，1，0），前面三位表示坐标，最后一位为0时，表示平行光。否则，表示点光源。多余部分无效； 4612、#光源聚光方向，对聚光灯才有效。参数值为三维数组（0，0，-1），多余部分无效； 4613、#光源聚光指数，对聚光灯才有效。参数值范围在[0，128]内的非数组数值，默认值0； 4614、#点光源聚光截止角。参数值范围在[0，90]内和特殊值180的非数组数值，默认值180，表示不产生聚光效果，[0，90]内的数值表示使用聚光效果； 4615、#常量衰减，对聚光灯才有效。参数值为非数组数值，默认值1； 4616、#线形衰减，对聚光灯才有效。参数值为非数组数值，默认值0； 4617、#二次方衰减，对聚光灯才有效。参数值为非数组数值，默认值0。 |
| 参数值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd52.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置光照来源。 参见 : 例程

**完整正文（站点原文转换）**

**设置光源参数 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

必须启用“#光照”后才有效。

*语法：*  无返回值  设置光源参数 （光源号， 参数名称， 参数值）

| 参数名 | 描 述 |
| --- | --- |
| 光源号 | 必需的 ； 整数型。参数值可以为以下常量： 16384、#零号光源； 16385、#一号光源； 16386、#二号光源； 16387、#三号光源； 16388、#四号光源； 16389、#五号光源； 16390、#六号光源； 16391、#七号光源。 |
| 参数名称 | 必需的 ； 整数型。参数值可以为以下常量： 4608、#环境光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组 ，默认值为（0，0，0，1），多余部分无效； 4609、#漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组 ，#零号光源的默认值为（1，1，1，1），其他光源的默认值为（0，0，0，1），多余部分无效； 4610、#镜面光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，#零号光源的默认值为（1，1，1，1），其他光源的默认值为（0，0，0，1），多余部分无效； 4611、#光源位置，参数值为四维数组，默认值（0，0，1，0），前面三位表示坐标，最后一位为0时，表示平行光。否则，表示点光源。多余部分无效； 4612、#光源聚光方向，对聚光灯才有效。参数值为三维数组（0，0，-1），多余部分无效； 4613、#光源聚光指数，对聚光灯才有效。参数值范围在[0，128]内的非数组数值，默认值0； 4614、#点光源聚光截止角。参数值范围在[0，90]内和特殊值180的非数组数值，默认值180，表示不产生聚光效果，[0，90]内的数值表示使用聚光效果； 4615、#常量衰减，对聚光灯才有效。参数值为非数组数值，默认值1； 4616、#线形衰减，对聚光灯才有效。参数值为非数组数值，默认值0； 4617、#二次方衰减，对聚光灯才有效。参数值为非数组数值，默认值0。 |
| 参数值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd52.files/image001.gif)

说明:

设置光照来源。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%85%89%E7%85%A7%E6%95%88%E6%9E%9C.e)

---

### 设置光照模式

- 原文链接：https://esdn.ijingyi.com/title-13771.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置光照模式 （ 参数名称 ， 参数值 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 参数名称 | 必填 | 整数型 | 参数值可以为以下常量： 2897、#光源观察点模式，顶点的高光强度不仅取决于顶点法向量，而且取决于顶点到光源的方向以及顶点到视点的方向.1表示设置为局部视点,需要计算视点到每个顶点的方向,会影响运行速度。0表示设置为无穷远视点,不论观察坐标如何改变，光的反射方向始终与纵向轴平行。默认为0； 2898、#双面光模式，如果参数值为0表示使用单面光，只有正面接受光照效果。否则正面和背面都接受光照效果，背面的法向为正面法向的反方向。默认为0； 2899、#全局光模式，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，默认为（0.2, 0.2, 0.2, 1.0），多余部分无效； |
| 参数值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd53.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置光照的模式。 参见 : 例程

**完整正文（站点原文转换）**

**设置光照模式 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

*语法：*  无返回值  设置光照模式 （参数名称， 参数值）

| 参数名 | 描 述 |
| --- | --- |
| 参数名称 | 必需的 ； 整数型。参数值可以为以下常量： 2897、#光源观察点模式，顶点的高光强度不仅取决于顶点法向量，而且取决于顶点到光源的方向以及顶点到视点的方向.1表示设置为局部视点,需要计算视点到每个顶点的方向,会影响运行速度。0表示设置为无穷远视点,不论观察坐标如何改变，光的反射方向始终与纵向轴平行。默认为0； 2898、#双面光模式，如果参数值为0表示使用单面光，只有正面接受光照效果。否则正面和背面都接受光照效果，背面的法向为正面法向的反方向。默认为0； 2899、#全局光模式，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，默认为（0.2, 0.2, 0.2, 1.0），多余部分无效； |
| 参数值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd53.files/image002.gif)

说明:

设置光照的模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%9B%BE%E5%8C%96%E6%95%88%E6%9E%9C.e)

---

### 设置材质

- 原文链接：https://esdn.ijingyi.com/title-13772.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置材质 （ 应用面 ， 参数名称 ， 参数值 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 应用面 | 必填 | 整数型 | 参数值可以为以下常量： 1028、#正面； 1029、#背面； 1030、#正面和背面； |
| 参数名称 | 必填 | 整数型 | 参数值可以为以下常量： 4608、#环境光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 4609、#漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 4610、#镜面光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5632、#散射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5633、#亮光，参数值为范围在[0，128]内的非数组数值； 5634、#环境光和漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5635、#颜色索引，参数值为非数组数值。 |
| 参数值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd54.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 初始化当前使用的材料。 参见 : 例程

**完整正文（站点原文转换）**

**设置材质 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

*语法：*  无返回值  设置材质 （应用面， 参数名称， 参数值）

| 参数名 | 描 述 |
| --- | --- |
| 应用面 | 必需的 ； 整数型。参数值可以为以下常量： 1028、#正面； 1029、#背面； 1030、#正面和背面； |
| 参数名称 | 必需的 ； 整数型。参数值可以为以下常量： 4608、#环境光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 4609、#漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 4610、#镜面光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5632、#散射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5633、#亮光，参数值为范围在[0，128]内的非数组数值； 5634、#环境光和漫反射光，参数值为范围在[0，1]内的表示红绿蓝混合通道颜色的四维数组，多余部分无效； 5635、#颜色索引，参数值为非数组数值。 |
| 参数值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd54.files/image001.gif)

说明:

初始化当前使用的材料。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%85%89%E7%85%A7%E6%95%88%E6%9E%9C.e)

---

### 设置材质颜色

- 原文链接：https://esdn.ijingyi.com/title-13773.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置材质颜色 （ 应用面 ， 模式 ）
- 功能说明：使用当前颜色为材料的颜色。必须启用“#材质颜色”才有效，不使用的时候需要关闭。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 应用面 | 必填 | 整数型 | 参数值可以为以下常量： 1028、#正面； 1029、#背面； 1030、#正面和背面； |
| 模式 | 必填 | 整数型 | 参数值可以为以下常量： 4608、#环境光； 4609、#漫反射光； 4610、#镜面光； 5632、#散射光； 5633、#亮光； 5634、#环境光和漫反射光。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd55.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置当前使用的材料的颜色。 参见 : 例程

**完整正文（站点原文转换）**

**设置材质颜色 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

使用当前颜色为材料的颜色。必须启用“#材质颜色”才有效，不使用的时候需要关闭。

*语法：*  无返回值  设置材质颜色 （应用面， 模式）

| 参数名 | 描 述 |
| --- | --- |
| 应用面 | 必需的 ； 整数型。参数值可以为以下常量： 1028、#正面； 1029、#背面； 1030、#正面和背面； |
| 模式 | 必需的 ； 整数型。参数值可以为以下常量： 4608、#环境光； 4609、#漫反射光； 4610、#镜面光； 5632、#散射光； 5633、#亮光； 5634、#环境光和漫反射光。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd55.files/image001.gif)

说明:

设置当前使用的材料的颜色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%85%89%E7%85%A7%E6%95%88%E6%9E%9C.e)

---

### 设置雾

- 原文链接：https://esdn.ijingyi.com/title-13774.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置雾 （ 参数名称 ， 参数值 ）
- 功能说明：必须启用“#雾”后才有效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 参数名称 | 必填 | 整数型 | 参数值可以为以下常量： 2913、#雾索引，参数值为非数组数值； 2914、#雾密度，参数值为范围在[0，+∞)内的非数组数值； 2915、#雾起点，参数值为非数组数值； 2916、#雾终点，参数值为非数组数值； 2917、#雾模式，参数值可以为以下常量： 2048、#雾模式1； 2049、#雾模式2； 9729、#线性 2918、#雾颜色，参数值为范围在[0，1]内的四维数组，多余部分无效。 |
| 参数值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd56.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置雾化模式。 参见 : 例程

**完整正文（站点原文转换）**

**设置雾 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

必须启用“#雾”后才有效。

*语法：*  无返回值  设置雾 （参数名称， 参数值）

| 参数名 | 描 述 |
| --- | --- |
| 参数名称 | 必需的 ； 整数型。参数值可以为以下常量： 2913、#雾索引，参数值为非数组数值； 2914、#雾密度，参数值为范围在[0，+∞)内的非数组数值； 2915、#雾起点，参数值为非数组数值； 2916、#雾终点，参数值为非数组数值； 2917、#雾模式，参数值可以为以下常量： 2048、#雾模式1； 2049、#雾模式2； 9729、#线性 2918、#雾颜色，参数值为范围在[0，1]内的四维数组，多余部分无效。 |
| 参数值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd56.files/image001.gif)

说明:

设置雾化模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%9B%BE%E5%8C%96%E6%95%88%E6%9E%9C.e)

---

### 设置法向量

- 原文链接：https://esdn.ijingyi.com/title-13775.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置法向量 （ 横向量 ， 竖向量 ， 纵向量 ）
- 功能说明：指定下一顶点的法向量。能在“开始画”和“停止画”之间执行本语句。启用“#单位法向量”后，法向量的长度就会变成1。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向量 | 必填 | 双精度小数型 |  |
| 竖向量 | 必填 | 双精度小数型 |  |
| 纵向量 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd57.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置法向量的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置法向量 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

指定下一顶点的法向量。能在“开始画”和“停止画”之间执行本语句。启用“#单位法向量”后，法向量的长度就会变成1。

*语法：*  无返回值  设置法向量 （横向量， 竖向量， 纵向量）

| 参数名 | 描 述 |
| --- | --- |
| 横向量 | 必需的 ； 双精度小数型。 |
| 竖向量 | 必需的 ； 双精度小数型。 |
| 纵向量 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd57.files/image001.gif)

说明:

设置法向量的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E5%85%89%E6%BB%91%E9%A2%9C%E8%89%B2.e)

---

### 设置明暗模式

- 原文链接：https://esdn.ijingyi.com/title-13776.html
- 操作系统支持：Windows
- 所属类别：显示效果
- 返回值类型：无返回值
- 语法：无返回值 设置明暗模式 （ 模式 ）
- 功能说明：设置明暗的表示方法。对点图元无效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 模式 | 必填 | 整数型 | 参数值可以为以下常量： 7424、#平坦，明暗的过度为跳跃地变化； 7425、#光滑，明暗的过度为连续地变化。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd58.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置光照的明暗模式。 参见 : 例程

**完整正文（站点原文转换）**

**设置明暗模式 命令**   操作系统支持：Windows    所属类别：[显示效果](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct5.htm)

设置明暗的表示方法。对点图元无效。

*语法：*  无返回值  设置明暗模式 （模式）

| 参数名 | 描 述 |
| --- | --- |
| 模式 | 必需的 ； 整数型。参数值可以为以下常量： 7424、#平坦，明暗的过度为跳跃地变化； 7425、#光滑，明暗的过度为连续地变化。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd58.files/image002.gif)

说明:

设置光照的明暗模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E9%9B%BE%E5%8C%96%E6%95%88%E6%9E%9C.e)

---

### 绑定纹理号

- 原文链接：https://esdn.ijingyi.com/title-13777.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 绑定纹理号 （ 纹理维数 ， 纹理号 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 纹理维数 | 必填 | 整数型 | 参数值可以为以下常量： 3552、#一维纹理； 3553、#二维纹理。 |
| 纹理号 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd59.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 绑定使用纹理号。 参见 : 例程

**完整正文（站点原文转换）**

**绑定纹理号 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  无返回值  绑定纹理号 （纹理维数， 纹理号）

| 参数名 | 描 述 |
| --- | --- |
| 纹理维数 | 必需的 ； 整数型。参数值可以为以下常量： 3552、#一维纹理； 3553、#二维纹理。 |
| 纹理号 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd59.files/image001.gif)

说明:

绑定使用纹理号。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 纹理控制

- 原文链接：https://esdn.ijingyi.com/title-13778.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 纹理控制 （ 纹理维数 ， 控制方式 ， 控制值 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 纹理维数 | 必填 | 整数型 | 参数值可以为以下常量： 3552、#一维纹理； 3553、#二维纹理。 |
| 控制方式 | 必填 | 整数型 | 参数值可以为以下常量： 10240、#放大纹理滤波，当纹理被放大时所进行的滤波。控制值可以为以下常量： 9728、#最近滤镜，插入的颜色为最接近纹理图像原像素点位置的颜色； 9729、#线性滤镜，使用线性插值方式插入颜色； 10241、#缩小纹理滤波，当纹理被缩小时所进行的滤波。控制值可以为以下常量： 9728、#最近滤镜，插入的颜色为最接近纹理图像原像素点位置的颜色； 9729、#线性滤镜，使用线性插值方式插入颜色； 9984、#最近多贴图滤镜，使用最接近纹理原始尺寸的图像，再使用 #最近滤镜 进行滤波； 9985、#多贴图线性内插滤镜，使用最接近纹理原始尺寸的图像，再使用 #线性滤镜 进行滤波； 9986、#线性内插多贴图滤镜，使用最接近纹理原始尺寸的两张图像，再使用 #最近滤镜 对两张图像中进行滤波，最后取两张图像的平均值； 9987、#内插多贴图的线性内插滤镜，使用最接近纹理原始尺寸的两张图像，再使用 #线性滤镜 对两张图像中进行滤波，最后取两张图像的平均值； 10242、#S向纹理约束，控制值可以为以下常量： 10496、#纹理插值约束，纹理的坐标值被约束在[0，1]之间； 10497、#纹理重复约束，允许纹理图片出现重复； 10243、#T向纹理约束，控制值可以为以下常量： 10496、#纹理插值约束，纹理的坐标值被约束在[0，1]之间； 10497、#纹理重复约束，允许纹理图片出现重复。 |
| 控制值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd60.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置纹理模式。 参见 : 例程

**完整正文（站点原文转换）**

**纹理控制 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  无返回值  纹理控制 （纹理维数， 控制方式， 控制值）

| 参数名 | 描 述 |
| --- | --- |
| 纹理维数 | 必需的 ； 整数型。参数值可以为以下常量： 3552、#一维纹理； 3553、#二维纹理。 |
| 控制方式 | 必需的 ； 整数型。参数值可以为以下常量： 10240、#放大纹理滤波，当纹理被放大时所进行的滤波。控制值可以为以下常量： 9728、#最近滤镜，插入的颜色为最接近纹理图像原像素点位置的颜色； 9729、#线性滤镜，使用线性插值方式插入颜色； 10241、#缩小纹理滤波，当纹理被缩小时所进行的滤波。控制值可以为以下常量： 9728、#最近滤镜，插入的颜色为最接近纹理图像原像素点位置的颜色； 9729、#线性滤镜，使用线性插值方式插入颜色； 9984、#最近多贴图滤镜，使用最接近纹理原始尺寸的图像，再使用 #最近滤镜 进行滤波； 9985、#多贴图线性内插滤镜，使用最接近纹理原始尺寸的图像，再使用 #线性滤镜 进行滤波； 9986、#线性内插多贴图滤镜，使用最接近纹理原始尺寸的两张图像，再使用 #最近滤镜 对两张图像中进行滤波，最后取两张图像的平均值； 9987、#内插多贴图的线性内插滤镜，使用最接近纹理原始尺寸的两张图像，再使用 #线性滤镜 对两张图像中进行滤波，最后取两张图像的平均值； 10242、#S向纹理约束，控制值可以为以下常量： 10496、#纹理插值约束，纹理的坐标值被约束在[0，1]之间； 10497、#纹理重复约束，允许纹理图片出现重复； 10243、#T向纹理约束，控制值可以为以下常量： 10496、#纹理插值约束，纹理的坐标值被约束在[0，1]之间； 10497、#纹理重复约束，允许纹理图片出现重复。 |
| 控制值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd60.files/image001.gif)

说明:

设置纹理模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 定义一维纹理图片

- 原文链接：https://esdn.ijingyi.com/title-13779.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：逻辑型
- 语法：逻辑型 定义一维纹理图片 （ 等级 ， 颜色成份 ， 宽度 ， 格式 ， 图片像素 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等级 | 必填 | 整数型，初始值为“0” | 通常为0，只有在多贴图情况下表，说明贴图的等级。 |
| 颜色成份 | 必填 | 整数型 | 说明在纹理图片中的颜色是由那些成份所组成。必须为1、2、3或4。 |
| 宽度 | 必填 | 整数型 | 为范围大于0的数值，并且必须为2的幂数。 |
| 格式 | 必填 | 整数型 | 指出所读象素数据元素的格式。参数值可以为以下常量： 6400、#单个颜色索引，每个元素为一个颜色索引号； 6403、#红色分量，每个元素为一个红色分量的值； 6404、#绿色分量，每个元素为一个绿色分量的值； 6405、#蓝色分量，每个元素为一个蓝色分量的值； 6406、#混合通道分量，每个元素为一个混合通道分量的值； 6407、#红绿蓝分量，每个元素为一个红绿蓝分量的值； 6408、#红绿蓝混合通道分量，每个元素为一个红绿蓝混合通道分量的值； 6409、#亮度，每个元素为一个亮度分量的值； 6410、#亮度和混合通道分量，每个元素为亮度和混合通道分量的值。 |
| 图片像素 | 必填 | 字节集 | 一组包含纹理图片像素信息的数组，数组成员组成为[宽度][高度][颜色成份],否则纹理图片将发生变形。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd61.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 定义一个具有一维纹理的图片数据。 参见 : 例程

**完整正文（站点原文转换）**

**定义一维纹理图片 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  逻辑型  定义一维纹理图片 （等级， 颜色成份， 宽度， 格式， 图片像素）

| 参数名 | 描 述 |
| --- | --- |
| 等级 | 必需的 ； 整数型，初始值为“0”。通常为0，只有在多贴图情况下表，说明贴图的等级。 |
| 颜色成份 | 必需的 ； 整数型。说明在纹理图片中的颜色是由那些成份所组成。必须为1、2、3或4。 |
| 宽度 | 必需的 ； 整数型。为范围大于0的数值，并且必须为2的幂数。 |
| 格式 | 必需的 ； 整数型。指出所读象素数据元素的格式。参数值可以为以下常量： 6400、#单个颜色索引，每个元素为一个颜色索引号； 6403、#红色分量，每个元素为一个红色分量的值； 6404、#绿色分量，每个元素为一个绿色分量的值； 6405、#蓝色分量，每个元素为一个蓝色分量的值； 6406、#混合通道分量，每个元素为一个混合通道分量的值； 6407、#红绿蓝分量，每个元素为一个红绿蓝分量的值； 6408、#红绿蓝混合通道分量，每个元素为一个红绿蓝混合通道分量的值； 6409、#亮度，每个元素为一个亮度分量的值； 6410、#亮度和混合通道分量，每个元素为亮度和混合通道分量的值。 |
| 图片像素 | 必需的 ； 字节集。一组包含纹理图片像素信息的数组，数组成员组成为[宽度][高度][颜色成份],否则纹理图片将发生变形。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd61.files/image001.gif)

说明:

定义一个具有一维纹理的图片数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%B8%80%E7%BB%B4%E7%BA%B9%E7%90%86.e)

---

### 定义二维纹理图片

- 原文链接：https://esdn.ijingyi.com/title-13780.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：逻辑型
- 语法：逻辑型 定义二维纹理图片 （ 等级 ， 颜色成份 ， 宽度 ， 高度 ， 格式 ， 图片像素 ）
- 功能说明：成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等级 | 必填 | 整数型，初始值为“0” | 通常为0，只有在多贴图情况下表，说明贴图的等级。 |
| 颜色成份 | 必填 | 整数型 | 必须为1、2、3或4。 |
| 宽度 | 必填 | 整数型 | 为范围大于0的数值，并且必须为2的幂数。 |
| 高度 | 必填 | 整数型 | 为范围大于0的数值，并且必须为2的幂数。 |
| 格式 | 必填 | 整数型 | 指出所读象素数据元素的格式。参数值可以为以下常量： 6400、#单个颜色索引，每个元素为一个颜色索引号； 6403、#红色分量，每个元素为一个红色分量的值； 6404、#绿色分量，每个元素为一个绿色分量的值； 6405、#蓝色分量，每个元素为一个蓝色分量的值； 6406、#混合通道分量，每个元素为一个混合通道分量的值； 6407、#红绿蓝分量，每个元素为一个红绿蓝分量的值； 6408、#红绿蓝混合通道分量，每个元素为一个红绿蓝混合通道分量的值； 6409、#亮度，每个元素为一个亮度分量的值； 6410、#亮度和混合通道分量，每个元素为亮度和混合通道分量的值。 |
| 图片像素 | 必填 | 字节集 | 一组包含纹理图片像素信息的数组，数组成员组成为[宽度][高度][颜色成份],否则纹理图片将发生变形。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd62.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 定义一个具有二维纹理的图片数据。 参见 : 例程

**完整正文（站点原文转换）**

**定义二维纹理图片 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

成功返回真，失败返回假。

*语法：*  逻辑型  定义二维纹理图片 （等级， 颜色成份， 宽度， 高度， 格式， 图片像素）

| 参数名 | 描 述 |
| --- | --- |
| 等级 | 必需的 ； 整数型，初始值为“0”。通常为0，只有在多贴图情况下表，说明贴图的等级。 |
| 颜色成份 | 必需的 ； 整数型。必须为1、2、3或4。 |
| 宽度 | 必需的 ； 整数型。为范围大于0的数值，并且必须为2的幂数。 |
| 高度 | 必需的 ； 整数型。为范围大于0的数值，并且必须为2的幂数。 |
| 格式 | 必需的 ； 整数型。指出所读象素数据元素的格式。参数值可以为以下常量： 6400、#单个颜色索引，每个元素为一个颜色索引号； 6403、#红色分量，每个元素为一个红色分量的值； 6404、#绿色分量，每个元素为一个绿色分量的值； 6405、#蓝色分量，每个元素为一个蓝色分量的值； 6406、#混合通道分量，每个元素为一个混合通道分量的值； 6407、#红绿蓝分量，每个元素为一个红绿蓝分量的值； 6408、#红绿蓝混合通道分量，每个元素为一个红绿蓝混合通道分量的值； 6409、#亮度，每个元素为一个亮度分量的值； 6410、#亮度和混合通道分量，每个元素为亮度和混合通道分量的值。 |
| 图片像素 | 必需的 ； 字节集。一组包含纹理图片像素信息的数组，数组成员组成为[宽度][高度][颜色成份],否则纹理图片将发生变形。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd62.files/image001.gif)

说明:

定义一个具有二维纹理的图片数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%8C%E7%BB%B4%E7%BA%B9%E7%90%86.e)

---

### 设置纹理映射坐标

- 原文链接：https://esdn.ijingyi.com/title-13781.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 设置纹理映射坐标 （ 横向位置 ， 竖向位置 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 双精度小数型 | 纹理图片的左边为0，右边为1，超出[0，1]范围的值，纹理图片将被平移相应的距离。 |
| 竖向位置 | 必填 | 双精度小数型 | 纹理图片的底边为0，顶边为1，超出[0，1]范围的值，纹理图片将被平移相应的距离。如果为空，表示定义的是一维纹理的坐标。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd63.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置纹理坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置纹理映射坐标 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  无返回值  设置纹理映射坐标 （横向位置， 竖向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 双精度小数型。纹理图片的左边为0，右边为1，超出[0，1]范围的值，纹理图片将被平移相应的距离。 |
| 竖向位置 | 必需的 ； 双精度小数型。纹理图片的底边为0，顶边为1，超出[0，1]范围的值，纹理图片将被平移相应的距离。如果为空，表示定义的是一维纹理的坐标。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd63.files/image001.gif)

说明:

设置纹理坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 设置纹理映射方式

- 原文链接：https://esdn.ijingyi.com/title-13782.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 设置纹理映射方式 （ 处理方式 ， 映射值 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 处理方式 | 必填 | 整数型 | 参数值可以为以下常量： 8704、#纹理映射模式；映射值可以为以下常量： 8448、#调节处理；调节当前亮度和颜色 8849、#粘贴处理；不受颜色和亮度影响 3042、#混合测试；与原来色颜色进行混合测试。 8705、#纹理映射颜色；映射值为范围在[0，1]内的四维数组，多余部分无效。 |
| 映射值 | 必填 | 小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd64.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置纹理映射方式。 参见 : 例程

**完整正文（站点原文转换）**

**设置纹理映射方式 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  无返回值  设置纹理映射方式 （处理方式， 映射值）

| 参数名 | 描 述 |
| --- | --- |
| 处理方式 | 必需的 ； 整数型。参数值可以为以下常量： 8704、#纹理映射模式；映射值可以为以下常量： 8448、#调节处理；调节当前亮度和颜色 8849、#粘贴处理；不受颜色和亮度影响 3042、#混合测试；与原来色颜色进行混合测试。 8705、#纹理映射颜色；映射值为范围在[0，1]内的四维数组，多余部分无效。 |
| 映射值 | 必需的 ； 小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd64.files/image001.gif)

说明:

设置纹理映射方式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 生成纹理号

- 原文链接：https://esdn.ijingyi.com/title-13783.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 生成纹理号 （ 纹理数 ， 存放纹理号的变量 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 纹理数 | 必填 | 整数型 | 需要生成纹理号。 |
| 存放纹理号的变量 | 必填 | 整数型，参数数据只能提供变量及变量数组 | 用来存放纹理号的变量，如果提供的变量为数组，那么纹理号将被依次存放在数组中。超出数组成员数的部分将无法生成。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd65.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建纹理号。 参见 : 例程

**完整正文（站点原文转换）**

**生成纹理号 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

*语法：*  无返回值  生成纹理号 （纹理数， 存放纹理号的变量）

| 参数名 | 描 述 |
| --- | --- |
| 纹理数 | 必需的 ； 整数型。需要生成纹理号。 |
| 存放纹理号的变量 | 必需的 ； 整数型，参数数据只能提供变量及变量数组。用来存放纹理号的变量，如果提供的变量为数组，那么纹理号将被依次存放在数组中。超出数组成员数的部分将无法生成。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd65.files/image001.gif)

说明:

创建纹理号。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 生成纹理坐标

- 原文链接：https://esdn.ijingyi.com/title-13784.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：无返回值
- 语法：无返回值 生成纹理坐标 （ 坐标量 ， 映射值 ， 坐标值 ）
- 功能说明：需要生成纹理号。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 坐标量 | 必填 | 整数型 | 参数值可以为以下常量： 8192、#S分量； 8193、#T分量； |
| 映射值 | 必填 | 整数型 | 参数值可以为以下常量： 9472、#纹理生成模式，坐标值可以为以下常量： 9216、#观测线性插值； 9217、#模型线性插值； 9218、#纹理贴图形状； 9473、#模型平面，四维数组，为生成纹理坐标的方程指定四个相应的参数，多余部分无效； 9474、#观测平面，四维数组，为生成纹理坐标的方程指定四个相应的参数，多余部分无效；。 |
| 坐标值 | 必填 | 双精度小数型，参数数据可以同时提供数组或非数组数据 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd66.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 生成纹理的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**生成纹理坐标 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

需要生成纹理号。

*语法：*  无返回值  生成纹理坐标 （坐标量， 映射值， 坐标值）

| 参数名 | 描 述 |
| --- | --- |
| 坐标量 | 必需的 ； 整数型。参数值可以为以下常量： 8192、#S分量； 8193、#T分量； |
| 映射值 | 必需的 ； 整数型。参数值可以为以下常量： 9472、#纹理生成模式，坐标值可以为以下常量： 9216、#观测线性插值； 9217、#模型线性插值； 9218、#纹理贴图形状； 9473、#模型平面，四维数组，为生成纹理坐标的方程指定四个相应的参数，多余部分无效； 9474、#观测平面，四维数组，为生成纹理坐标的方程指定四个相应的参数，多余部分无效；。 |
| 坐标值 | 必需的 ； 双精度小数型，参数数据可以同时提供数组或非数组数据。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd66.files/image001.gif)

说明:

生成纹理的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%B8%80%E7%BB%B4%E7%BA%B9%E7%90%86.e)

---

### 载入位图数据

- 原文链接：https://esdn.ijingyi.com/title-13785.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：逻辑型
- 语法：逻辑型 载入位图数据 （ 位图文件名 ， ［ 背景色 ］ ）
- 功能说明：成功载入返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 位图文件名 | 必填 | 文本型 | 允许使用1位、4位、8位、16位、24位、32位的翻转行序或非翻转行序的非压缩BMP位图文件格式。 |
| 背景色 | 可空 | 整数型 | 位图中指定为背景色的区域，其颜色值的通道部分将被定义为0。如果为空，将被定义为1。可以通过使用“通道混合测试”进行处理。 如果希望将背景色部分显示为透明，可以执行： 启用功能 (#通道测试) 通道混合测试 (#大于, 0) 设置纹理映射方式 (#纹理映射模式, #调节处理)。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd67.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 载入要映射纹理的图片数据。 参见 : 例程

**完整正文（站点原文转换）**

**载入位图数据 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

成功载入返回真，失败返回假。

*语法：*  逻辑型  载入位图数据 （位图文件名， ［背景色］）

| 参数名 | 描 述 |
| --- | --- |
| 位图文件名 | 必需的 ； 文本型。允许使用1位、4位、8位、16位、24位、32位的翻转行序或非翻转行序的非压缩BMP位图文件格式。 |
| 背景色 | 可选的 ； 整数型。位图中指定为背景色的区域，其颜色值的通道部分将被定义为0。如果为空，将被定义为1。可以通过使用“通道混合测试”进行处理。 如果希望将背景色部分显示为透明，可以执行： 启用功能 (#通道测试) 通道混合测试 (#大于, 0) 设置纹理映射方式 (#纹理映射模式, #调节处理)。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd67.files/image001.gif)

说明:

载入要映射纹理的图片数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9C1.e)

---

### 是否存在纹理号

- 原文链接：https://esdn.ijingyi.com/title-13786.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：逻辑型
- 语法：逻辑型 是否存在纹理号 （ 纹理 ）
- 功能说明：如果该纹理号已经存在就返回真，否则返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 纹理 | 必填 | 整数型 | 需要进行判断的纹理号。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd116.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判断纹理号是否存在。 参见 : 例程

**完整正文（站点原文转换）**

**是否存在纹理号 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

如果该纹理号已经存在就返回真，否则返回假。

*语法：*  逻辑型  是否存在纹理号 （纹理）

| 参数名 | 描 述 |
| --- | --- |
| 纹理 | 必需的 ； 整数型。需要进行判断的纹理号。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd116.files/image001.gif)

说明:

判断纹理号是否存在。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%B8%80%E7%BB%B4%E7%BA%B9%E7%90%86.e)

---

### 删除纹理号

- 原文链接：https://esdn.ijingyi.com/title-13787.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：整数型
- 语法：整数型 删除纹理号 （ ［ 需要删除的纹理号数量 ］ ， 纹理号数组 ）
- 功能说明：删除已经创建的纹理号，与纹理号相应的纹理将无法使用。返回实际删除的纹理号的数量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 需要删除的纹理号数量 | 可空 | 整数型 | 默认删除纹理数组中所有的纹理号，否则删除数组中指定的前几项。 |
| 纹理号数组 | 必填 | 整数型，参数数据可以同时提供数组或非数组数据 | 保存了纹理号的数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd117.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 删除纹理号。 参见 : 例程

**完整正文（站点原文转换）**

**删除纹理号 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

删除已经创建的纹理号，与纹理号相应的纹理将无法使用。返回实际删除的纹理号的数量。

*语法：*  整数型  删除纹理号 （［需要删除的纹理号数量］， 纹理号数组）

| 参数名 | 描 述 |
| --- | --- |
| 需要删除的纹理号数量 | 可选的 ； 整数型。默认删除纹理数组中所有的纹理号，否则删除数组中指定的前几项。 |
| 纹理号数组 | 必需的 ； 整数型，参数数据可以同时提供数组或非数组数据。保存了纹理号的数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd117.files/image001.gif)

说明:

删除纹理号。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%B8%80%E7%BB%B4%E7%BA%B9%E7%90%86.e)

---

### 载入TGA图片

- 原文链接：https://esdn.ijingyi.com/title-13788.html
- 操作系统支持：Windows
- 所属类别：纹理图片
- 返回值类型：逻辑型
- 语法：逻辑型 载入TGA图片 （ 位图文件名 ， ［ 背景色 ］ ， 宽度 ， 高度 ）
- 功能说明：成功载入返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 位图文件名 | 必填 | 文本型 | 允许使用24位、32位的压缩和非压缩的TGA文件格式。 |
| 背景色 | 可空 | 整数型 | 位图中指定为背景色的区域，其颜色值的通道部分将被定义为0。如果为空，将被定义为1。可以通过使用“通道混合测试”进行处理。 如果希望将背景色部分显示为透明，可以执行： 启用功能 (#通道测试) 通道混合测试 (#大于, 0) 设置纹理映射方式 (#纹理映射模式, #调节处理)。 |
| 宽度 | 必填 | 整数型，参数数据只能提供变量 | 保存图片的宽度的变量。 |
| 高度 | 必填 | 整数型，参数数据只能提供变量 | 保存图片的高度的变量。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd125.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 载入 TGA 图形图像文件。 参见 : 例程

**完整正文（站点原文转换）**

**载入TGA图片 命令**   操作系统支持：Windows    所属类别：[纹理图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct6.htm)

成功载入返回真，失败返回假。

*语法：*  逻辑型  载入TGA图片 （位图文件名， ［背景色］， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 位图文件名 | 必需的 ； 文本型。允许使用24位、32位的压缩和非压缩的TGA文件格式。 |
| 背景色 | 可选的 ； 整数型。位图中指定为背景色的区域，其颜色值的通道部分将被定义为0。如果为空，将被定义为1。可以通过使用“通道混合测试”进行处理。 如果希望将背景色部分显示为透明，可以执行： 启用功能 (#通道测试) 通道混合测试 (#大于, 0) 设置纹理映射方式 (#纹理映射模式, #调节处理)。 |
| 宽度 | 必需的 ； 整数型，参数数据只能提供变量。保存图片的宽度的变量。 |
| 高度 | 必需的 ； 整数型，参数数据只能提供变量。保存图片的高度的变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd125.files/image001.gif)

说明:

载入TGA图形图像文件。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9Ctga.e)

---

### 开始创建列表

- 原文链接：https://esdn.ijingyi.com/title-13789.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：无返回值
- 语法：无返回值 开始创建列表 （ 列表号 ， 列表模式 ）

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 列表号 | 必填 | 整数型 | 可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |
| 列表模式 | 必填 | 整数型 | 参数值可以为以下常量： 4864、#编译列表； 4865、#编译并且执行列表。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd68.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建列表并开始使用。 参见 : 例程

**完整正文（站点原文转换）**

**开始创建列表 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

*语法：*  无返回值  开始创建列表 （列表号， 列表模式）

| 参数名 | 描 述 |
| --- | --- |
| 列表号 | 必需的 ； 整数型。可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |
| 列表模式 | 必需的 ； 整数型。参数值可以为以下常量： 4864、#编译列表； 4865、#编译并且执行列表。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd68.files/image001.gif)

说明:

创建列表并开始使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 停止创建列表

- 原文链接：https://esdn.ijingyi.com/title-13790.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：无返回值
- 语法：无返回值 停止创建列表 （ ）
- 功能说明：与“开始创建列表”搭配使用。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd69.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 停止列表的使用。 参见 : 例程

**完整正文（站点原文转换）**

**停止创建列表 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

与“开始创建列表”搭配使用。

*语法：*  无返回值  停止创建列表 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd69.files/image001.gif)

说明:

停止列表的使用。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 生成列表号

- 原文链接：https://esdn.ijingyi.com/title-13791.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：整数型
- 语法：整数型 生成列表号 （ 列表长度 ）
- 功能说明：按次序自动生成一串连续的空列表号。返回其中的第一个列表号。失败返回-1。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 列表长度 | 必填 | 整数型 | 必须是大于0的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd70.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 生成列表号，每次生成的列表号都不一样且所有列表号可以按一定次序排列。 参见 : 例程

**完整正文（站点原文转换）**

**生成列表号 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

按次序自动生成一串连续的空列表号。返回其中的第一个列表号。失败返回-1。

*语法：*  整数型  生成列表号 （列表长度）

| 参数名 | 描 述 |
| --- | --- |
| 列表长度 | 必需的 ； 整数型。必须是大于0的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd70.files/image001.gif)

说明:

生成列表号，每次生成的列表号都不一样且所有列表号可以按一定次序排列。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 调用列表

- 原文链接：https://esdn.ijingyi.com/title-13792.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：逻辑型
- 语法：逻辑型 调用列表 （ 列表号 ）
- 功能说明：调用已经创建的列表。可以重复调用。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 列表号 | 必填 | 整数型 | 可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd71.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 使用已经创建的列表。 参见 : 例程

**完整正文（站点原文转换）**

**调用列表 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

调用已经创建的列表。可以重复调用。成功返回真，失败返回假。

*语法：*  逻辑型  调用列表 （列表号）

| 参数名 | 描 述 |
| --- | --- |
| 列表号 | 必需的 ； 整数型。可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd71.files/image001.gif)

说明:

使用已经创建的列表。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 是否存在列表

- 原文链接：https://esdn.ijingyi.com/title-13793.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：逻辑型
- 语法：逻辑型 是否存在列表 （ 列表号 ）
- 功能说明：如果该列表号存在已经编译的列表就返回真，否则返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 列表号 | 必填 | 整数型 | 可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd72.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判断列表是否存在。 参见 : 例程

**完整正文（站点原文转换）**

**是否存在列表 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

如果该列表号存在已经编译的列表就返回真，否则返回假。

*语法：*  逻辑型  是否存在列表 （列表号）

| 参数名 | 描 述 |
| --- | --- |
| 列表号 | 必需的 ； 整数型。可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd72.files/image001.gif)

说明:

判断列表是否存在。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 删除列表列

- 原文链接：https://esdn.ijingyi.com/title-13794.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：逻辑型
- 语法：逻辑型 删除列表列 （ 起始列表号 ， 列表数 ）
- 功能说明：删除一列连续的列表。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起始列表号 | 必填 | 整数型 | 必须是大于0的整数。 |
| 列表数 | 必填 | 整数型 | 必须是大于0的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd73.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 删除列表。 参见 : 例程

**完整正文（站点原文转换）**

**删除列表列 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

删除一列连续的列表。成功返回真，失败返回假。

*语法：*  逻辑型  删除列表列 （起始列表号， 列表数）

| 参数名 | 描 述 |
| --- | --- |
| 起始列表号 | 必需的 ； 整数型。必须是大于0的整数。 |
| 列表数 | 必需的 ； 整数型。必须是大于0的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd73.files/image001.gif)

说明:

删除列表。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E6%98%BE%E7%A4%BA%E5%88%97%E8%A1%A8.e)

---

### 设置偏移列表数

- 原文链接：https://esdn.ijingyi.com/title-13795.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：逻辑型
- 语法：逻辑型 设置偏移列表数 （ 偏移列表数 ）
- 功能说明：为“调用多显示列表”设定一个起始列表号。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 偏移列表数 | 必填 | 整数型 | 必须是大于0的整数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd74.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置多次显示列表的数量。 参见 : 例程

**完整正文（站点原文转换）**

**设置偏移列表数 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

为“调用多显示列表”设定一个起始列表号。成功返回真，失败返回假。

*语法：*  逻辑型  设置偏移列表数 （偏移列表数）

| 参数名 | 描 述 |
| --- | --- |
| 偏移列表数 | 必需的 ； 整数型。必须是大于0的整数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd74.files/image001.gif)

说明:

设置多次显示列表的数量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%AB%8B%E4%BD%93%E6%96%87%E5%AD%97.e)

---

### 调用多显示列表

- 原文链接：https://esdn.ijingyi.com/title-13796.html
- 操作系统支持：Windows
- 所属类别：显示列表
- 返回值类型：无返回值
- 语法：无返回值 调用多显示列表 （ 列表号数组 ）
- 功能说明：等效为多次使用“调用列表”的结果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 列表号数组 | 必填 | 整数型，参数数据只能提供数组数据 | 保存一系列即将被依次调用的列表号的一维数组。如果列表号不存在，将看不到效果。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd75.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 多次调用显示列表。 参见 : 例程

**完整正文（站点原文转换）**

**调用多显示列表 命令**   操作系统支持：Windows    所属类别：[显示列表](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct7.htm)

等效为多次使用“调用列表”的结果。

*语法：*  无返回值  调用多显示列表 （列表号数组）

| 参数名 | 描 述 |
| --- | --- |
| 列表号数组 | 必需的 ； 整数型，参数数据只能提供数组数据。保存一系列即将被依次调用的列表号的一维数组。如果列表号不存在，将看不到效果。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd75.files/image001.gif)

说明:

多次调用显示列表。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%AB%8B%E4%BD%93%E6%96%87%E5%AD%97.e)

---

### 设置光栅位置

- 原文链接：https://esdn.ijingyi.com/title-13797.html
- 操作系统支持：Windows
- 所属类别：光栅操作
- 返回值类型：无返回值
- 语法：无返回值 设置光栅位置 （ 横向位置 ， 竖向位置 ）
- 功能说明：设置下一次对光栅操作的坐标位置，会受到坐标变换的影响。如果要改变像素的颜色必须在本命令之前使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 双精度小数型 | 光栅原点到当前矩阵的坐标系原点的横向距离，单位与坐标系相同。正数时光栅原点在坐标原点右边，反之在左边，0表示相同。 |
| 竖向位置 | 必填 | 双精度小数型 | 光栅原点到当前矩阵的坐标系原点的竖向距离，单位与坐标系相同。正数时光栅原点在坐标原点上边，反之在下边，0表示相同。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd76.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置光栅的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**设置光栅位置 命令**   操作系统支持：Windows    所属类别：[光栅操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct8.htm)

设置下一次对光栅操作的坐标位置，会受到坐标变换的影响。如果要改变像素的颜色必须在本命令之前使用。

*语法：*  无返回值  设置光栅位置 （横向位置， 竖向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 双精度小数型。光栅原点到当前矩阵的坐标系原点的横向距离，单位与坐标系相同。正数时光栅原点在坐标原点右边，反之在左边，0表示相同。 |
| 竖向位置 | 必需的 ； 双精度小数型。光栅原点到当前矩阵的坐标系原点的竖向距离，单位与坐标系相同。正数时光栅原点在坐标原点上边，反之在下边，0表示相同。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd76.files/image001.gif)

说明:

设置光栅的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BD%8D%E5%9B%BE%E6%95%88%E6%9E%9C.e)

---

### 画出位图

- 原文链接：https://esdn.ijingyi.com/title-13798.html
- 操作系统支持：Windows
- 所属类别：光栅操作
- 返回值类型：无返回值
- 语法：无返回值 画出位图 （ 宽度 ， 高度 ， 原点横坐标 ， 原点竖坐标 ， 横向平移 ， 纵向平移 ， 位图数据 ）
- 功能说明：必须先使用“设置像素存储字节数”。坐标的原点只与“设置光栅位置”有关与坐标变换命令无关。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 宽度 | 必填 | 整数型 | “位图数据”中将要显示的宽度，必须大于0。 |
| 高度 | 必填 | 整数型 | “位图数据”中将要显示的高度，必须大于0。 |
| 原点横坐标 | 必填 | 小数型 | 坐标原点与位图左下角的横向素数距离，正数时在原点左边，反之在右边。 |
| 原点竖坐标 | 必填 | 小数型 | 坐标原点与位图左下角的竖向素数距离，正数时在原点下边，反之在上边。 |
| 横向平移 | 必填 | 小数型 | 本次画出结束后，坐标原点向右移动的像素距离，负数为反方向。只会影响下一次“画出位图”时的画出位置，与本次画出无关。 |
| 纵向平移 | 必填 | 小数型 | 本次画出结束后，坐标原点向上移动的像素距离，负数为反方向。只会影响下一次“画出位图”时的画出位置，与本次画出无关。 |
| 位图数据 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd77.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 画出像素位图。 参见 : 例程

**完整正文（站点原文转换）**

**画出位图 命令**   操作系统支持：Windows    所属类别：[光栅操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct8.htm)

必须先使用“设置像素存储字节数”。坐标的原点只与“设置光栅位置”有关与坐标变换命令无关。

*语法：*  无返回值  画出位图 （宽度， 高度， 原点横坐标， 原点竖坐标， 横向平移， 纵向平移， 位图数据）

| 参数名 | 描 述 |
| --- | --- |
| 宽度 | 必需的 ； 整数型。“位图数据”中将要显示的宽度，必须大于0。 |
| 高度 | 必需的 ； 整数型。“位图数据”中将要显示的高度，必须大于0。 |
| 原点横坐标 | 必需的 ； 小数型。坐标原点与位图左下角的横向素数距离，正数时在原点左边，反之在右边。 |
| 原点竖坐标 | 必需的 ； 小数型。坐标原点与位图左下角的竖向素数距离，正数时在原点下边，反之在上边。 |
| 横向平移 | 必需的 ； 小数型。本次画出结束后，坐标原点向右移动的像素距离，负数为反方向。只会影响下一次“画出位图”时的画出位置，与本次画出无关。 |
| 纵向平移 | 必需的 ； 小数型。本次画出结束后，坐标原点向上移动的像素距离，负数为反方向。只会影响下一次“画出位图”时的画出位置，与本次画出无关。 |
| 位图数据 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd77.files/image001.gif)

说明:

画出像素位图。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BD%8D%E5%9B%BE%E6%95%88%E6%9E%9C.e)

---

### 复制像素

- 原文链接：https://esdn.ijingyi.com/title-13799.html
- 操作系统支持：Windows
- 所属类别：光栅操作
- 返回值类型：逻辑型
- 语法：逻辑型 复制像素 （ 左下角横向位置 ， 左下角纵向位置 ， 宽度 ， 高度 ， 类型 ）
- 功能说明：复制一个矩形范围内的内容到现在的光栅位置处。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左下角横向位置 | 必填 | 整数型 | 矩形的左下角距离坐标原点的横向素数个数。 |
| 左下角纵向位置 | 必填 | 整数型 | 矩形的左下角距离坐标原点的纵向素数个数。 |
| 宽度 | 必填 | 整数型 | 以素数为单位，必须大于0。 |
| 高度 | 必填 | 整数型 | 以素数为单位，必须大于0。 |
| 类型 | 必填 | 整数型 | 参数值可以为以下常量： 6144、#颜色类型； 6145、#深度类型； 6146、#模板类型。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd78.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 复制指定范围的像素。 参见 : 例程

**完整正文（站点原文转换）**

**复制像素 命令**   操作系统支持：Windows    所属类别：[光栅操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct8.htm)

复制一个矩形范围内的内容到现在的光栅位置处。成功返回真，失败返回假。

*语法：*  逻辑型  复制像素 （左下角横向位置， 左下角纵向位置， 宽度， 高度， 类型）

| 参数名 | 描 述 |
| --- | --- |
| 左下角横向位置 | 必需的 ； 整数型。矩形的左下角距离坐标原点的横向素数个数。 |
| 左下角纵向位置 | 必需的 ； 整数型。矩形的左下角距离坐标原点的纵向素数个数。 |
| 宽度 | 必需的 ； 整数型。以素数为单位，必须大于0。 |
| 高度 | 必需的 ； 整数型。以素数为单位，必须大于0。 |
| 类型 | 必需的 ； 整数型。参数值可以为以下常量： 6144、#颜色类型； 6145、#深度类型； 6146、#模板类型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd78.files/image001.gif)

说明:

复制指定范围的像素。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BD%8D%E5%9B%BE%E6%95%88%E6%9E%9C.e)

---

### 设置像素存储字节数

- 原文链接：https://esdn.ijingyi.com/title-13800.html
- 操作系统支持：Windows
- 所属类别：光栅操作
- 返回值类型：无返回值
- 语法：无返回值 设置像素存储字节数 （ 存储的字节数 ）
- 功能说明：设置位图像素数据在计算机内存中存储的方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 存储的字节数 | 必填 | 整数型 | 只能是1、2、4或8，其他数值无效。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd79.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置位图像素在内存中的存储方式。 参见 : 例程

**完整正文（站点原文转换）**

**设置像素存储字节数 命令**   操作系统支持：Windows    所属类别：[光栅操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct8.htm)

设置位图像素数据在计算机内存中存储的方式。

*语法：*  无返回值  设置像素存储字节数 （存储的字节数）

| 参数名 | 描 述 |
| --- | --- |
| 存储的字节数 | 必需的 ； 整数型。只能是1、2、4或8，其他数值无效。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd79.files/image001.gif)

说明:

设置位图像素在内存中的存储方式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BD%8D%E5%9B%BE%E6%95%88%E6%9E%9C.e)

---

### 像素缩放

- 原文链接：https://esdn.ijingyi.com/title-13801.html
- 操作系统支持：Windows
- 所属类别：光栅操作
- 返回值类型：逻辑型
- 语法：逻辑型 像素缩放 （ 横向位置缩放 ， 竖向位置缩放 ）
- 功能说明：设置接下来的像素操作的缩放比例。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置缩放 | 必填 | 小数型 | 大于1表示放大，小于1表示缩小，1表示不进行缩放，必须大于0。 |
| 竖向位置缩放 | 必填 | 小数型 | 大于1表示放大，小于1表示缩小，1表示不进行缩放，必须大于0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd80.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 设置像素缩放比例。 参见 : 例程

**完整正文（站点原文转换）**

**像素缩放 命令**   操作系统支持：Windows    所属类别：[光栅操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct8.htm)

设置接下来的像素操作的缩放比例。成功返回真，失败返回假。

*语法：*  逻辑型  像素缩放 （横向位置缩放， 竖向位置缩放）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置缩放 | 必需的 ； 小数型。大于1表示放大，小于1表示缩小，1表示不进行缩放，必须大于0。 |
| 竖向位置缩放 | 必需的 ； 小数型。大于1表示放大，小于1表示缩小，1表示不进行缩放，必须大于0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd80.files/image001.gif)

说明:

设置像素缩放比例。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BD%8D%E5%9B%BE%E6%95%88%E6%9E%9C.e)

---

### 是否为双字节字符

- 原文链接：https://esdn.ijingyi.com/title-13802.html
- 操作系统支持：Windows
- 所属类别：文字轮廓
- 返回值类型：逻辑型
- 语法：逻辑型 是否为双字节字符 （ 欲检查文本 ， 欲检查的字符位置 ）
- 功能说明：如果为双字节返回真，否则返回假。如果指定位置超出文本长度，返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 欲检查文本 | 必填 | 文本型 |  |
| 欲检查的字符位置 | 必填 | 整数型 | 0为首位置，1为第2个位置，如此类推，必须是大于0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd81.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 判断文字是否为双字节。 参见 : 例程

**完整正文（站点原文转换）**

**是否为双字节字符 命令**   操作系统支持：Windows    所属类别：[文字轮廓](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct9.htm)

如果为双字节返回真，否则返回假。如果指定位置超出文本长度，返回0。

*语法：*  逻辑型  是否为双字节字符 （欲检查文本， 欲检查的字符位置）

| 参数名 | 描 述 |
| --- | --- |
| 欲检查文本 | 必需的 ； 文本型。 |
| 欲检查的字符位置 | 必需的 ； 整数型。0为首位置，1为第2个位置，如此类推，必须是大于0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd81.files/image001.gif)

说明:

判断文字是否为双字节。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%AB%8B%E4%BD%93%E6%96%87%E5%AD%97.e)

---

### 创建文字轮廓

- 原文链接：https://esdn.ijingyi.com/title-13803.html
- 操作系统支持：Windows
- 所属类别：文字轮廓
- 返回值类型：逻辑型
- 语法：逻辑型 创建文字轮廓 （ 设备句柄 ， 欲使用其外形的首个字符的代码 ， 字符数 ， 基列表号 ， 轮廓偏移量 ， 拉伸厚度 ， 实心 ）
- 功能说明：创建三维的文字外形轮廓。如果成功返回真，否则返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 设备句柄 | 必填 | 整数型 |  |
| 欲使用其外形的首个字符的代码 | 必填 | 整数型 |  |
| 字符数 | 必填 | 整数型 | 必须是大于0。如果为1就显示首个字符，2就显示首个字符后面的一个字符。中文为双字节一个字符，不能大于1。 |
| 基列表号 | 必填 | 整数型 |  |
| 轮廓偏移量 | 必填 | 小数型 | 数值越小越逼真，0的时候最好。 |
| 拉伸厚度 | 必填 | 小数型 | 沿着Z轴方向拉伸的距离。 |
| 实心 | 必填 | 逻辑型，初始值为“真” | 真表示使用实心字体，否则生成空心轮廓。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd82.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 在设备中创建文字的外形轮廓。 参见 : 例程

**完整正文（站点原文转换）**

**创建文字轮廓 命令**   操作系统支持：Windows    所属类别：[文字轮廓](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct9.htm)

创建三维的文字外形轮廓。如果成功返回真，否则返回假。

*语法：*  逻辑型  创建文字轮廓 （设备句柄， 欲使用其外形的首个字符的代码， 字符数， 基列表号， 轮廓偏移量， 拉伸厚度， 实心）

| 参数名 | 描 述 |
| --- | --- |
| 设备句柄 | 必需的 ； 整数型。 |
| 欲使用其外形的首个字符的代码 | 必需的 ； 整数型。 |
| 字符数 | 必需的 ； 整数型。必须是大于0。如果为1就显示首个字符，2就显示首个字符后面的一个字符。中文为双字节一个字符，不能大于1。 |
| 基列表号 | 必需的 ； 整数型。 |
| 轮廓偏移量 | 必需的 ； 小数型。数值越小越逼真，0的时候最好。 |
| 拉伸厚度 | 必需的 ； 小数型。沿着Z轴方向拉伸的距离。 |
| 实心 | 必需的 ； 逻辑型，初始值为“真”。真表示使用实心字体，否则生成空心轮廓。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd82.files/image001.gif)

说明:

在设备中创建文字的外形轮廓。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%AB%8B%E4%BD%93%E6%96%87%E5%AD%97.e)

---

### 创建实心球

- 原文链接：https://esdn.ijingyi.com/title-13804.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心球 （ 半径 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个圆心在坐标原点的实心球。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd83.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心球。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心球 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个圆心在坐标原点的实心球。

*语法：*  无返回值  创建实心球 （半径， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd83.files/image001.gif)

说明:

创建实心球。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心球

- 原文链接：https://esdn.ijingyi.com/title-13805.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心球 （ 半径 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个圆心在坐标原点的空心球。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd84.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心球。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心球 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个圆心在坐标原点的空心球。

*语法：*  无返回值  创建空心球 （半径， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd84.files/image001.gif)

说明:

创建空心球。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心正方体

- 原文链接：https://esdn.ijingyi.com/title-13806.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心正方体 （ 棱长 ）
- 功能说明：创建一个中心在坐标原点的实心正方体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 棱长 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd85.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心正方体。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心正方体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的实心正方体。

*语法：*  无返回值  创建实心正方体 （棱长）

| 参数名 | 描 述 |
| --- | --- |
| 棱长 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd85.files/image001.gif)

说明:

创建实心正方体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心正方体

- 原文链接：https://esdn.ijingyi.com/title-13807.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心正方体 （ 棱长 ）
- 功能说明：创建一个中心在坐标原点的空心正方体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 棱长 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd86.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心正方体。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心正方体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的空心正方体。

*语法：*  无返回值  创建空心正方体 （棱长）

| 参数名 | 描 述 |
| --- | --- |
| 棱长 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd86.files/image001.gif)

说明:

创建空心正方体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心圆锥体

- 原文链接：https://esdn.ijingyi.com/title-13808.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心圆锥体 （ 底面半径 ， 圆锥体高度 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个中心在坐标原点的实心圆锥体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 底面半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 圆锥体高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd87.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心圆锥体。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心圆锥体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的实心圆锥体。

*语法：*  无返回值  创建实心圆锥体 （底面半径， 圆锥体高度， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 底面半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 圆锥体高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd87.files/image001.gif)

说明:

创建实心圆锥体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心圆锥体

- 原文链接：https://esdn.ijingyi.com/title-13809.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心圆锥体 （ 底面半径 ， 圆锥体高度 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个中心在坐标原点的空心圆锥体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 底面半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 圆锥体高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd88.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心圆锥体。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心圆锥体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的空心圆锥体。

*语法：*  无返回值  创建空心圆锥体 （底面半径， 圆锥体高度， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 底面半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 圆锥体高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd88.files/image001.gif)

说明:

创建空心圆锥体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心圆环

- 原文链接：https://esdn.ijingyi.com/title-13810.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心圆环 （ 内圆半径 ， 外圆半径 ， 边数 ， 环数 ）
- 功能说明：创建一个中心在坐标原点的实心圆环。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 内圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 外圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 边数 | 必填 | 整数型 | 负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |
| 环数 | 必填 | 整数型 | 负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd89.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心圆环。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心圆环 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的实心圆环。

*语法：*  无返回值  创建实心圆环 （内圆半径， 外圆半径， 边数， 环数）

| 参数名 | 描 述 |
| --- | --- |
| 内圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 外圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 边数 | 必需的 ； 整数型。负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |
| 环数 | 必需的 ； 整数型。负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd89.files/image001.gif)

说明:

创建实心圆环。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心圆环

- 原文链接：https://esdn.ijingyi.com/title-13811.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心圆环 （ 内圆半径 ， 外圆半径 ， 边数 ， 环数 ）
- 功能说明：创建一个中心在坐标原点的空心圆环。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 内圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 外圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 边数 | 必填 | 整数型 | 负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |
| 环数 | 必填 | 整数型 | 负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd90.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心圆环。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心圆环 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的空心圆环。

*语法：*  无返回值  创建空心圆环 （内圆半径， 外圆半径， 边数， 环数）

| 参数名 | 描 述 |
| --- | --- |
| 内圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 外圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。如果内圆半径大于外圆半径,就交换内圆半径和外圆半径的值。如果内圆半径和外圆半径的值相等，外圆半径自动加1。 |
| 边数 | 必需的 ； 整数型。负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |
| 环数 | 必需的 ； 整数型。负数自动被转化为正数，如果小于3，将由3来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd90.files/image001.gif)

说明:

创建空心圆环。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心十二面体

- 原文链接：https://esdn.ijingyi.com/title-13812.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心十二面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为三分之二根号三的实心十二面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd91.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心十二面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心十二面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为三分之二根号三的实心十二面体。

*语法：*  无返回值  创建实心十二面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd91.files/image001.gif)

说明:

创建实心十二面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心十二面体

- 原文链接：https://esdn.ijingyi.com/title-13813.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心十二面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为三分之二根号三的空心十二面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd92.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心十二面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心十二面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为三分之二根号三的空心十二面体。

*语法：*  无返回值  创建空心十二面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd92.files/image001.gif)

说明:

创建空心十二面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心八面体

- 原文链接：https://esdn.ijingyi.com/title-13814.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心八面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为一的实心八面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd93.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心八面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心八面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为一的实心八面体。

*语法：*  无返回值  创建实心八面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd93.files/image001.gif)

说明:

创建实心八面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心八面体

- 原文链接：https://esdn.ijingyi.com/title-13815.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心八面体 （ ）
- 功能说明：创建一个中心在坐标原点的外切球半径为一的空心八面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd94.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心八面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心八面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外切球半径为一的空心八面体。

*语法：*  无返回值  创建空心八面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd94.files/image001.gif)

说明:

创建空心八面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心四面体

- 原文链接：https://esdn.ijingyi.com/title-13816.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心四面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为根号三的实心四面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd95.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心四面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心四面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为根号三的实心四面体。

*语法：*  无返回值  创建实心四面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd95.files/image001.gif)

说明:

创建实心四面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心四面体

- 原文链接：https://esdn.ijingyi.com/title-13817.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心四面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为根号三的空心四面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd96.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心四面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心四面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为根号三的空心四面体。

*语法：*  无返回值  创建空心四面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd96.files/image001.gif)

说明:

创建空心四面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心二十面体

- 原文链接：https://esdn.ijingyi.com/title-13818.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心二十面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为一的实心二十面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd97.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心二十面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心二十面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为一的实心二十面体。

*语法：*  无返回值  创建实心二十面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd97.files/image001.gif)

说明:

创建实心二十面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心二十面体

- 原文链接：https://esdn.ijingyi.com/title-13819.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心二十面体 （ ）
- 功能说明：创建一个中心在坐标原点的外接球半径为一的空心二十面体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd98.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心二十面体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心二十面体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的外接球半径为一的空心二十面体。

*语法：*  无返回值  创建空心二十面体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd98.files/image001.gif)

说明:

创建空心二十面体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心圆柱体

- 原文链接：https://esdn.ijingyi.com/title-13820.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心圆柱体 （ 底圆半径 ， 高度 ， 经线条数 ）
- 功能说明：创建一个中心在坐标原点的实心圆柱体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd99.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心圆柱体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心圆柱体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的实心圆柱体。

*语法：*  无返回值  创建实心圆柱体 （底圆半径， 高度， 经线条数）

| 参数名 | 描 述 |
| --- | --- |
| 底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd99.files/image001.gif)

说明:

创建实心圆柱体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心圆柱体

- 原文链接：https://esdn.ijingyi.com/title-13821.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心圆柱体 （ 底圆半径 ， 高度 ， 经线条数 ）
- 功能说明：创建一个中心在坐标原点的空心圆柱体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd100.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心圆柱体 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心圆柱体 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的空心圆柱体。

*语法：*  无返回值  创建空心圆柱体 （底圆半径， 高度， 经线条数）

| 参数名 | 描 述 |
| --- | --- |
| 底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，将由1来取代。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd100.files/image001.gif)

说明:

创建空心圆柱体。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建实心圆台

- 原文链接：https://esdn.ijingyi.com/title-13822.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建实心圆台 （ 下底圆半径 ， 上底圆半径 ， 高度 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个中心在坐标原点的实心圆台。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 下底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 上底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，表示压成平面。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd104.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建实心圆台 。 参见 : 例程

**完整正文（站点原文转换）**

**创建实心圆台 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的实心圆台。

*语法：*  无返回值  创建实心圆台 （下底圆半径， 上底圆半径， 高度， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 下底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 上底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，表示压成平面。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd104.files/image001.gif)

说明:

创建实心圆台。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 创建空心圆台

- 原文链接：https://esdn.ijingyi.com/title-13823.html
- 操作系统支持：Windows
- 所属类别：特殊模型
- 返回值类型：无返回值
- 语法：无返回值 创建空心圆台 （ 下底圆半径 ， 上底圆半径 ， 高度 ， 经线条数 ， 纬线条数 ）
- 功能说明：创建一个中心在坐标原点的空心圆台。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 下底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 上底圆半径 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 高度 | 必填 | 双精度小数型 | 负数自动被转化为正数，如果等于0，表示压成平面。 |
| 经线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必填 | 整数型 | 负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd105.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 创建空心圆台 。 参见 : 例程

**完整正文（站点原文转换）**

**创建空心圆台 命令**   操作系统支持：Windows    所属类别：[特殊模型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct10.htm)

创建一个中心在坐标原点的空心圆台。

*语法：*  无返回值  创建空心圆台 （下底圆半径， 上底圆半径， 高度， 经线条数， 纬线条数）

| 参数名 | 描 述 |
| --- | --- |
| 下底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 上底圆半径 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果上下底圆半径都等于0，就无法显示。 |
| 高度 | 必需的 ； 双精度小数型。负数自动被转化为正数，如果等于0，表示压成平面。 |
| 经线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |
| 纬线条数 | 必需的 ； 整数型。负数自动被转化为正数，如果等于0，将由1来取代。数值越大越逼真，占用的系统资源也越大。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd105.files/image001.gif)

说明:

创建空心圆台。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%94%BB%E5%AE%9E%E7%89%A9.e)

---

### 取错误信息文本

- 原文链接：https://esdn.ijingyi.com/title-13824.html
- 操作系统支持：Windows
- 所属类别：其他
- 返回值类型：文本型
- 语法：文本型 取错误信息文本 （ ）
- 功能说明：如果执行某OPenGL命令失败，在其后执行本命令可以取回错误信息文本。 如果该OPenGL命令执行成功，执行本命令将返回空文本。
如果参数值超出整数的范围，返回“无效整数”
如果参数值超出可选的范围，返回“无效数值”
如果OPenGL命令出现在错误的位置，返回“无效操作”
如果在堆栈已满时继续入栈，返回“堆栈溢出”
如果在堆栈已空时继续出栈，返回“堆栈下溢”。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd101.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 获取执行 某 OPenGL 命令时产生的错误信息 。 参见 : 例程

**完整正文（站点原文转换）**

**取错误信息文本 命令**   操作系统支持：Windows    所属类别：[其他](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct11.htm)

如果执行某OPenGL命令失败，在其后执行本命令可以取回错误信息文本。		如果该OPenGL命令执行成功，执行本命令将返回空文本。
		如果参数值超出整数的范围，返回“无效整数”
		如果参数值超出可选的范围，返回“无效数值”
		如果OPenGL命令出现在错误的位置，返回“无效操作”
		如果在堆栈已满时继续入栈，返回“堆栈溢出”
		如果在堆栈已空时继续出栈，返回“堆栈下溢”。

*语法：*  文本型  取错误信息文本 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd101.files/image001.gif)

说明:

获取执行某OPenGL命令时产生的错误信息。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E7%BA%B9%E7%90%86%E6%95%88%E6%9E%9Ctga.e)

---

### 载入3DS文件

- 原文链接：https://esdn.ijingyi.com/title-13825.html
- 操作系统支持：Windows
- 所属类别：其他
- 返回值类型：逻辑型
- 语法：逻辑型 载入3DS文件 （ 3DS文件名 ， 列表号 ， 存放被取回纹理号的数组变量 ）
- 功能说明：载入以3DS为后缀的三维模型文件，并编译为一个显示列表。如果3DS文件中包含有纹理图片，那么只有BMP位图格式的纹理才可以被使用。否则无法显示纹理。使用“调用列表”命令可以显示模型。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 3DS文件名 | 必填 | 文本型 | 需要载入的3DS文件名称。 |
| 列表号 | 必填 | 整数型 | 可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |
| 存放被取回纹理号的数组变量 | 必填 | 整数型，参数数据只能提供变量数组 | 在命令执行完毕后，本变量数组内被顺序填入在载入3DS文件时候创建的纹理号。变量数组内原有数据被全部销毁，变量数组的维数被自动调整为一维数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd103.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

载入三维模型文件。 参见： 例程

**完整正文（站点原文转换）**

**载入3DS文件 命令**   操作系统支持：Windows    所属类别：[其他](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct11.htm)

载入以3DS为后缀的三维模型文件，并编译为一个显示列表。如果3DS文件中包含有纹理图片，那么只有BMP位图格式的纹理才可以被使用。否则无法显示纹理。使用“调用列表”命令可以显示模型。成功返回真，失败返回假。

*语法：*  逻辑型  载入3DS文件 （3DS文件名， 列表号， 存放被取回纹理号的数组变量）

| 参数名 | 描 述 |
| --- | --- |
| 3DS文件名 | 必需的 ； 文本型。需要载入的3DS文件名称。 |
| 列表号 | 必需的 ； 整数型。可以直接指定列表号或者使用由“生成列表号”取得的返回值，必须是大于0的整数。 |
| 存放被取回纹理号的数组变量 | 必需的 ； 整数型，参数数据只能提供变量数组。在命令执行完毕后，本变量数组内被顺序填入在载入3DS文件时候创建的纹理号。变量数组内原有数据被全部销毁，变量数组的维数被自动调整为一维数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd103.files/image001.gif)

说明

载入三维模型文件。

参见：[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E8%AF%BB%E5%8F%963DS%E6%96%87%E4%BB%B61.e)

---

### 清空名字栈

- 原文链接：https://esdn.ijingyi.com/title-13826.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：整数型
- 语法：整数型 清空名字栈 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 清空名字栈中的所有名字。返回最大名字栈长度。必须在选择模式下使用。否则无效。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd118.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 清空名字栈。 参见 : 例程

**完整正文（站点原文转换）**

**清空名字栈 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

为高级用户提供，初级用户无需掌握；
清空名字栈中的所有名字。返回最大名字栈长度。必须在选择模式下使用。否则无效。

*语法：*  整数型  清空名字栈 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd118.files/image002.gif)

说明:

清空名字栈。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 名字入栈

- 原文链接：https://esdn.ijingyi.com/title-13827.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：无返回值
- 语法：无返回值 名字入栈 （ 名字 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置接下来的图元的名称。并把指定名称压入栈顶,不能超出最大名字栈长度。每个图元的名字与当时出现在名字栈中所有的名字有关。因此一个图元可以拥有多个名字。连续重复使用本命令即可达到命名多级名字的效果。必须在选择模式下使用。否则无效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 名字 | 必填 | 整数型 | 压入栈顶的名字。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd119.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将名字压入栈顶。 参见 : 例程

**完整正文（站点原文转换）**

**名字入栈 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

为高级用户提供，初级用户无需掌握；
设置接下来的图元的名称。并把指定名称压入栈顶,不能超出最大名字栈长度。每个图元的名字与当时出现在名字栈中所有的名字有关。因此一个图元可以拥有多个名字。连续重复使用本命令即可达到命名多级名字的效果。必须在选择模式下使用。否则无效。

*语法：*  无返回值  名字入栈 （名字）

| 参数名 | 描 述 |
| --- | --- |
| 名字 | 必需的 ； 整数型。压入栈顶的名字。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd119.files/image001.gif)

说明:

将名字压入栈顶。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 名字出栈

- 原文链接：https://esdn.ijingyi.com/title-13828.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：无返回值
- 语法：无返回值 名字出栈 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 停止使用当前的名称。并把栈顶名称退出栈顶名称，不能在名字栈为空的时候出栈。必须在选择模式下使用。否则无效。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd120.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 从栈中清除名字。 参见 : 例程

**完整正文（站点原文转换）**

**名字出栈 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

为高级用户提供，初级用户无需掌握；
停止使用当前的名称。并把栈顶名称退出栈顶名称，不能在名字栈为空的时候出栈。必须在选择模式下使用。否则无效。

*语法：*  无返回值  名字出栈 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd120.files/image002.gif)

说明:

从栈中清除名字。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 置栈顶名字

- 原文链接：https://esdn.ijingyi.com/title-13829.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：逻辑型
- 语法：逻辑型 置栈顶名字 （ 名字 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置接下来的图元的名称。如果名字栈为空，将返回假。必须在选择模式下使用。否则无效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 名字 | 必填 | 整数型 | 栈顶的名字。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd121.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将名字放到栈的顶端。 参见 : 例程

**完整正文（站点原文转换）**

**置栈顶名字 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

为高级用户提供，初级用户无需掌握；
设置接下来的图元的名称。如果名字栈为空，将返回假。必须在选择模式下使用。否则无效。

*语法：*  逻辑型  置栈顶名字 （名字）

| 参数名 | 描 述 |
| --- | --- |
| 名字 | 必需的 ； 整数型。栈顶的名字。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd121.files/image002.gif)

说明:

将名字放到栈的顶端。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 进入选择模式

- 原文链接：https://esdn.ijingyi.com/title-13830.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：整数型
- 语法：整数型 进入选择模式 （ 屏幕横向位置 ， 屏幕纵向位置 ， 选择区域宽度 ， 选择区域高度 ， 命名图元子程序 ， 存放选择选择缓存的数组 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 进入选择模式后画出的任何图元都不会显示出来。只有在选择模式下对模型进行命名的操作才有效。成功后将所有在选择区域中包含的命中记录存放在数组参数中。并且返回命中记录的个数。否则清空数组，并且返回0。
选择缓存内容的排列规则：
1.命中级别： 如果为顶级记录，值为1，二级为2，依次类推。
2.最近距离：只表示在屏幕内的深度，并不对应Z坐标，数值为VC中的 unsigned int 数据类型，需要转换到0~4294967295范围的值。不同的投影方式，会有不同的结果。
3.最远距离：同上。
4.名字列表：成员1表示顶级名字，成员2表示二级名字，依次类推，最后一个成员表示命中名字。
5.如果存在其他命中记录就重复1-4步。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 屏幕横向位置 | 必填 | 整数型 | 在当前OPenGL所显示的窗口组件中的横向位置。 |
| 屏幕纵向位置 | 必填 | 整数型 | 在当前OPenGL所显示的窗口组件中的纵向位置。 |
| 选择区域宽度 | 必填 | 整数型 | 需要进行选择的区域的宽度，宽度越大搜索范围越大，计算量也越大。 |
| 选择区域高度 | 必填 | 整数型 | 需要进行选择的区域的高度，高度越大搜索范围越大，计算量也越大。 |
| 命名图元子程序 | 必填 | 子程序指针 | 子程序没有使用参数和返回值。只有在这个子程序中使用与名字栈有关的命令才有效。 |
| 存放选择选择缓存的数组 | 必填 | 整数型，参数数据只能提供变量数组 | 原来的数据将被清除。并重新定义为一维数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd122.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 要使用交互操作，必须先设置本命令。 参见 : 例程

**完整正文（站点原文转换）**

**进入选择模式 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

为高级用户提供，初级用户无需掌握；
进入选择模式后画出的任何图元都不会显示出来。只有在选择模式下对模型进行命名的操作才有效。成功后将所有在选择区域中包含的命中记录存放在数组参数中。并且返回命中记录的个数。否则清空数组，并且返回0。
	选择缓存内容的排列规则：
		1.命中级别： 如果为顶级记录，值为1，二级为2，依次类推。
		2.最近距离：只表示在屏幕内的深度，并不对应Z坐标，数值为VC中的 unsigned int 数据类型，需要转换到0~4294967295范围的值。不同的投影方式，会有不同的结果。
		3.最远距离：同上。
		4.名字列表：成员1表示顶级名字，成员2表示二级名字，依次类推，最后一个成员表示命中名字。
		5.如果存在其他命中记录就重复1-4步。

*语法：*  整数型  进入选择模式 （屏幕横向位置， 屏幕纵向位置， 选择区域宽度， 选择区域高度， 命名图元子程序， 存放选择选择缓存的数组）

| 参数名 | 描 述 |
| --- | --- |
| 屏幕横向位置 | 必需的 ； 整数型。在当前OPenGL所显示的窗口组件中的横向位置。 |
| 屏幕纵向位置 | 必需的 ； 整数型。在当前OPenGL所显示的窗口组件中的纵向位置。 |
| 选择区域宽度 | 必需的 ； 整数型。需要进行选择的区域的宽度，宽度越大搜索范围越大，计算量也越大。 |
| 选择区域高度 | 必需的 ； 整数型。需要进行选择的区域的高度，高度越大搜索范围越大，计算量也越大。 |
| 命名图元子程序 | 必需的 ； 子程序指针。子程序没有使用参数和返回值。只有在这个子程序中使用与名字栈有关的命令才有效。 |
| 存放选择选择缓存的数组 | 必需的 ； 整数型，参数数据只能提供变量数组。原来的数据将被清除。并重新定义为一维数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd122.files/image001.gif)

说明:

要使用交互操作，必须先设置本命令。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 到屏幕坐标

- 原文链接：https://esdn.ijingyi.com/title-13831.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：逻辑型
- 语法：逻辑型 到屏幕坐标 （ 空间坐标横向位置 ， 空间坐标竖向位置 ， 空间坐标纵向位置 ， 存放屏幕坐标横向位置的变量 ， 存放屏幕坐标纵向位置的变量 ， 存放屏幕深度的变量 ）
- 功能说明：将OPenGL的空间坐标转换到组件的屏幕坐标。成功返回真，否则返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 空间坐标横向位置 | 必填 | 双精度小数型 | OPenGL的空间坐标系中的横向位置。 |
| 空间坐标竖向位置 | 必填 | 双精度小数型 | OPenGL的空间坐标系中的竖向位置。 |
| 空间坐标纵向位置 | 必填 | 双精度小数型 | OPenGL的空间坐标系中的纵向位置。 |
| 存放屏幕坐标横向位置的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | 窗口组件中的横向位置。 |
| 存放屏幕坐标纵向位置的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | 窗口组件中的纵向位置。 |
| 存放屏幕深度的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | 0表示与投影坐标系中的最近的平面,1表示最远的平面。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd123.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将设备的空间坐标转换成组件的屏幕坐标。 参见 : 例程

**完整正文（站点原文转换）**

**到屏幕坐标 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

将OPenGL的空间坐标转换到组件的屏幕坐标。成功返回真，否则返回假。

*语法：*  逻辑型  到屏幕坐标 （空间坐标横向位置， 空间坐标竖向位置， 空间坐标纵向位置， 存放屏幕坐标横向位置的变量， 存放屏幕坐标纵向位置的变量， 存放屏幕深度的变量）

| 参数名 | 描 述 |
| --- | --- |
| 空间坐标横向位置 | 必需的 ； 双精度小数型。OPenGL的空间坐标系中的横向位置。 |
| 空间坐标竖向位置 | 必需的 ； 双精度小数型。OPenGL的空间坐标系中的竖向位置。 |
| 空间坐标纵向位置 | 必需的 ； 双精度小数型。OPenGL的空间坐标系中的纵向位置。 |
| 存放屏幕坐标横向位置的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。窗口组件中的横向位置。 |
| 存放屏幕坐标纵向位置的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。窗口组件中的纵向位置。 |
| 存放屏幕深度的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。0表示与投影坐标系中的最近的平面,1表示最远的平面。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd123.files/image001.gif)

说明:

将设备的空间坐标转换成组件的屏幕坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

### 到空间坐标

- 原文链接：https://esdn.ijingyi.com/title-13832.html
- 操作系统支持：Windows
- 所属类别：交互操作
- 返回值类型：逻辑型
- 语法：逻辑型 到空间坐标 （ 屏幕坐标横向位置 ， 屏幕坐标纵向位置 ， 屏幕深度 ， 存放空间坐标横向位置的变量 ， 存放空间坐标竖向位置的变量 ， 存放空间坐标纵向位置的变量 ）
- 功能说明：将组件的屏幕坐标转换到OPenGL的空间坐标。成功返回真，否则返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 屏幕坐标横向位置 | 必填 | 双精度小数型 | 窗口组件中的横向位置。 |
| 屏幕坐标纵向位置 | 必填 | 双精度小数型 | 窗口组件中的纵向位置。 |
| 屏幕深度 | 必填 | 双精度小数型 | 0表示与投影坐标系中的最近的平面,1表示最远的平面。 |
| 存放空间坐标横向位置的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | OPenGL的空间坐标系中的横向位置。 |
| 存放空间坐标竖向位置的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | OPenGL的空间坐标系中的竖向位置。 |
| 存放空间坐标纵向位置的变量 | 必填 | 双精度小数型，参数数据只能提供变量 | OPenGL的空间坐标系中的纵向位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd124.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 将组件的屏幕坐标转换成设备的空间坐标。 参见 : 例程

**完整正文（站点原文转换）**

**到空间坐标 命令**   操作系统支持：Windows    所属类别：[交互操作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/ct12.htm)

将组件的屏幕坐标转换到OPenGL的空间坐标。成功返回真，否则返回假。

*语法：*  逻辑型  到空间坐标 （屏幕坐标横向位置， 屏幕坐标纵向位置， 屏幕深度， 存放空间坐标横向位置的变量， 存放空间坐标竖向位置的变量， 存放空间坐标纵向位置的变量）

| 参数名 | 描 述 |
| --- | --- |
| 屏幕坐标横向位置 | 必需的 ； 双精度小数型。窗口组件中的横向位置。 |
| 屏幕坐标纵向位置 | 必需的 ； 双精度小数型。窗口组件中的纵向位置。 |
| 屏幕深度 | 必需的 ； 双精度小数型。0表示与投影坐标系中的最近的平面,1表示最远的平面。 |
| 存放空间坐标横向位置的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。OPenGL的空间坐标系中的横向位置。 |
| 存放空间坐标竖向位置的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。OPenGL的空间坐标系中的竖向位置。 |
| 存放空间坐标纵向位置的变量 | 必需的 ； 双精度小数型，参数数据只能提供变量。OPenGL的空间坐标系中的纵向位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/cmd124.files/image001.gif)

说明:

将组件的屏幕坐标转换成设备的空间坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/OPenGL//OPenGL/%E4%BA%A4%E4%BA%92%E6%93%8D%E4%BD%9C.e)

---

## 命令分类：其他数据类型（1 条）

### 像素格式

- 原文链接：https://esdn.ijingyi.com/title-13706.html
- 操作系统支持：Windows 跳至： OPenGL支持库
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 大小 | 待核实 | 待核实 | 短整数型； 当前版本的像素格式大小，固定为40。 |
| 版本 | 待核实 | 待核实 | 短整数型； 当前像素格式的版本，固定为1。 |
| 标志 | 待核实 | 待核实 | 整数型； 说明像素支持的格式。 |
| 像素类型 | 待核实 | 待核实 | 字节型； 说明像素使用的类型，参数值可以为以下常量：0、红绿蓝混合通道模式；1、颜色索引模式，16色下有效。 |
| 色彩深度 | 待核实 | 待核实 | 字节型； 说明像素选定的色彩位数为8位、16位、24位还是32位。 |
| 红色位 | 待核实 | 待核实 | 字节型； |
| 红色转换位 | 待核实 | 待核实 | 字节型； |
| 绿色位 | 待核实 | 待核实 | 字节型； |
| 绿色转换位 | 待核实 | 待核实 | 字节型； |
| 蓝色位 | 待核实 | 待核实 | 字节型； |
| 蓝色转换位 | 待核实 | 待核实 | 字节型； |
| 通道缓存 | 待核实 | 待核实 | 字节型； |
| 通道转换位 | 待核实 | 待核实 | 字节型； |
| 累计缓存位 | 待核实 | 待核实 | 字节型； 说明像素选定的累计缓存位数。 |
| 红色累计位 | 待核实 | 待核实 | 字节型； |
| 绿色累计位 | 待核实 | 待核实 | 字节型； |
| 蓝色累计位 | 待核实 | 待核实 | 字节型； |
| 通道累计位 | 待核实 | 待核实 | 字节型； |
| cDepthBits | 待核实 | 待核实 | 字节型； 说明像素选定的色彩深度为16位、24位还是32位。 |
| cStencilBits | 待核实 | 待核实 | 字节型； 说明像素选定的模板缓存位数。 |
| 辅助缓存位 | 待核实 | 待核实 | 字节型； |
| 层类型 | 待核实 | 待核实 | 字节型； |
| 保留位 | 待核实 | 待核实 | 字节型； |
| 遮罩层 | 待核实 | 待核实 | 整数型； |
| 可视遮罩层 | 待核实 | 待核实 | 整数型； |
| 衰减遮罩层 | 待核实 | 待核实 | 整数型； |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**像素格式 普通类型**   操作系统支持：Windows    跳至：[OPenGL支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/OPenGL/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 大小 | 短整数型； 当前版本的像素格式大小，固定为40。 |
| 版本 | 短整数型； 当前像素格式的版本，固定为1。 |
| 标志 | 整数型； 说明像素支持的格式。 |
| 像素类型 | 字节型； 说明像素使用的类型，参数值可以为以下常量：0、红绿蓝混合通道模式；1、颜色索引模式，16色下有效。 |
| 色彩深度 | 字节型； 说明像素选定的色彩位数为8位、16位、24位还是32位。 |
| 红色位 | 字节型； |
| 红色转换位 | 字节型； |
| 绿色位 | 字节型； |
| 绿色转换位 | 字节型； |
| 蓝色位 | 字节型； |
| 蓝色转换位 | 字节型； |
| 通道缓存 | 字节型； |
| 通道转换位 | 字节型； |
| 累计缓存位 | 字节型； 说明像素选定的累计缓存位数。 |
| 红色累计位 | 字节型； |
| 绿色累计位 | 字节型； |
| 蓝色累计位 | 字节型； |
| 通道累计位 | 字节型； |
| cDepthBits | 字节型； 说明像素选定的色彩深度为16位、24位还是32位。 |
| cStencilBits | 字节型； 说明像素选定的模板缓存位数。 |
| 辅助缓存位 | 字节型； |
| 层类型 | 字节型； |
| 保留位 | 字节型； |
| 遮罩层 | 整数型； |
| 可视遮罩层 | 整数型； |
| 衰减遮罩层 | 整数型； |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
