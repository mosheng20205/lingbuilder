# SWF制作支持库测试版 1.1 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-40978.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（1.1）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**SWF制作支持库测试版1.1版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

本支持库用于生成Flash文件（*.swf）。如欲了解本库的实现细节（开源库libming）请参考http://www.libming.org。使用本库中的命令创建或生成的对象在不再被使用时可以调用该对象对应的“XXX_销毁（）”命令进行销毁以释放不再使用的内存。如果一个对象仍然被其他对象使用，绝对不能贸然销毁，否则可能引起程序非法操作而被操作系统强制结束。注意：这里所说的“某对象被使用”是指把一个对象的ID作为参数传递给本库中的一个命令，从而把该对象添加到另外一个对象中或生成（返回）了一个新的对象ID。只有当把该对象从另一个对象中移除或者新对象被销毁，才可以认为该对象“不再被使用”。由于本库的主要功能是生成一个SWF文件，而这个“生成”过程通过非常短暂和可预测的（相对于这个SWF的播放时长），所以一般来说在这个过程中少释放一些内存可能无关紧要的，于是就有了一种简单的销毁策略：等所有的工作完成（一般是指当把所有内容成功写入一个SWF文件）后，集中销毁所有对象或者干脆不写任何的销毁代码而是等你程序正常结束后由操作系统来释放内存。但是在使用这种简单策略之前请确认你完全理解这样做可能带来的后果。

操作系统支持： Windows

**命令类别：**

| 全局设置 | 影片 | 影片剪辑 | 按钮 |
| --- | --- | --- | --- |
| 图形 | 实例 | 声音 | 字体 |
| 编辑框 | 标签 | 填充 | 渐变 |
| 形变 | 图片 | 视频 | 精灵 |
| 动作 | 滤镜 | 其它 |  |

**其它数据类型：**

| SWF_线类型 | SWF_渐变插补模式 | SWF_渐变展开模式 | SWF_编辑框对齐方式 |
| --- | --- | --- | --- |
| SWF_编辑框属性 | SWF_按钮显示状态 | SWF_按钮事件 | SWF_动作标志 |
| SWF_混合模式 | SWF_滤镜模式 | SWF_渐变填充类型 | SWF_图片填充类型 |

## 命令分类：命令类别（153 条）

### SWF_置压缩级别

- 原文链接：https://esdn.ijingyi.com/title-41012.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：全局设置
- 返回值类型：无返回值
- 语法：无返回值 SWF_置压缩级别 （ 压缩级别 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置输出SWF文件时所用的压缩级别。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 压缩级别 | 必填 | 整数型 | 该级别是对应的zlib（一个提供压缩功能的开源C函数库，欲了解zlib的更多细节请访问www.zlib.net）压缩级别，简述如下：0，不压缩（Z_NO_COMPRESSION）；1，最快压缩（Z_BEST_SPEED）；9，最大压缩（Z_BEST_COMPRESSION）；-1，默认（Z_DEFAULT_COMPRESSION）。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_置压缩级别 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[全局设置](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct0.htm)

为高级用户提供，初级用户无需掌握；
设置输出SWF文件时所用的压缩级别。

*语法：*  无返回值  SWF_置压缩级别 （压缩级别）

| 参数名 | 描 述 |
| --- | --- |
| 压缩级别 | 必需的 ； 整数型。该级别是对应的zlib（一个提供压缩功能的开源C函数库，欲了解zlib的更多细节请访问www.zlib.net）压缩级别，简述如下：0，不压缩（Z_NO_COMPRESSION）；1，最快压缩（Z_BEST_SPEED）；9，最大压缩（Z_BEST_COMPRESSION）；-1，默认（Z_DEFAULT_COMPRESSION）。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_置缩放系数

- 原文链接：https://esdn.ijingyi.com/title-41013.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：全局设置
- 返回值类型：无返回值
- 语法：无返回值 SWF_置缩放系数 （ 缩放系数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置全局缩放系数。此设置会影响后续操作中代表“大小”和“位置”的数值型参数的单位。比如：设置缩放系数为1时“SWF_影片_置尺寸 (ID, 100, 100)”会设置影片的尺寸为100像素×100像素；设置缩放系数为5时会设置影片的尺寸为500像素×500像素。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 缩放系数 | 必填 | 小数型 | 比如：1代表不缩放，2代表放大2倍，0.1代表缩小到1/10。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_置缩放系数 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[全局设置](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct0.htm)

为高级用户提供，初级用户无需掌握；
设置全局缩放系数。此设置会影响后续操作中代表“大小”和“位置”的数值型参数的单位。比如：设置缩放系数为1时“SWF_影片_置尺寸 (ID, 100, 100)”会设置影片的尺寸为100像素×100像素；设置缩放系数为5时会设置影片的尺寸为500像素×500像素。

*语法：*  无返回值  SWF_置缩放系数 （缩放系数）

| 参数名 | 描 述 |
| --- | --- |
| 缩放系数 | 必需的 ； 小数型。比如：1代表不缩放，2代表放大2倍，0.1代表缩小到1/10。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_取缩放系数

- 原文链接：https://esdn.ijingyi.com/title-41014.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：全局设置
- 返回值类型：小数型
- 语法：小数型 SWF_取缩放系数 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 获取全局缩放系数。参看“SWF_置缩放系数”。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_取缩放系数 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[全局设置](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct0.htm)

为高级用户提供，初级用户无需掌握；
获取全局缩放系数。参看“SWF_置缩放系数”。

*语法：*  小数型  SWF_取缩放系数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_置版本

- 原文链接：https://esdn.ijingyi.com/title-41015.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：全局设置
- 返回值类型：无返回值
- 语法：无返回值 SWF_置版本 （ 版本 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置全局的SWF版本，此版本为生成的SWF文件所支持的Flash播放器的版本。关于SWF文件版本的更多信息，请参考Macromedia Flash软件的导出设置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 版本 | 必填 | 整数型 | 4~8（包含4和8）。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_置版本 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[全局设置](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct0.htm)

为高级用户提供，初级用户无需掌握；
设置全局的SWF版本，此版本为生成的SWF文件所支持的Flash播放器的版本。关于SWF文件版本的更多信息，请参考Macromedia Flash软件的导出设置。

*语法：*  无返回值  SWF_置版本 （版本）

| 参数名 | 描 述 |
| --- | --- |
| 版本 | 必需的 ； 整数型。4~8（包含4和8）。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_创建

- 原文链接：https://esdn.ijingyi.com/title-41016.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：整数型
- 语法：整数型 SWF_影片_创建 （ ［ 版本号 ］ ， ［ 帧速率 ］ ， ［ 宽度 ］ ， ［ 高度 ］ ， ［ 背景色 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的SWF影片，返回新建的影片ID。新建影片后可以向其中添加各种物体（比如图形、影片剪辑等），然后写出形成swf文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 版本号 | 可空 | 整数型 | 指定影片所用的Flash版本号。如果本参数省略，将使用“SWF_置版本”所指定的值。 |
| 帧速率 | 可空 | 小数型 | 指定影片的播放帧速率。单位是“每秒播放的帧数（FPS）”。默认值为12。此值只是理论数据，SWF文件在播放时实际表现出来的帧速率受播放器和电脑配置的影响非常大。 |
| 宽度 | 可空 | 小数型 | 指定影片的宽度，单位为像素。默认值为200。参看“SWF_置缩放系数”。 |
| 高度 | 可空 | 小数型 | 指定影片的高度。单位为像素。默认值为200。参看“SWF_置缩放系数”。 |
| 背景色 | 可空 | 整数型 | 指定影片的背景颜色。默认值为“#白色”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的SWF影片，返回新建的影片ID。新建影片后可以向其中添加各种物体（比如图形、影片剪辑等），然后写出形成swf文件。

*语法：*  整数型  SWF_影片_创建 （［版本号］， ［帧速率］， ［宽度］， ［高度］， ［背景色］）

| 参数名 | 描 述 |
| --- | --- |
| 版本号 | 可选的 ； 整数型。指定影片所用的Flash版本号。如果本参数省略，将使用“SWF_置版本”所指定的值。 |
| 帧速率 | 可选的 ； 小数型。指定影片的播放帧速率。单位是“每秒播放的帧数（FPS）”。默认值为12。此值只是理论数据，SWF文件在播放时实际表现出来的帧速率受播放器和电脑配置的影响非常大。 |
| 宽度 | 可选的 ； 小数型。指定影片的宽度，单位为像素。默认值为200。参看“SWF_置缩放系数”。 |
| 高度 | 可选的 ； 小数型。指定影片的高度。单位为像素。默认值为200。参看“SWF_置缩放系数”。 |
| 背景色 | 可选的 ； 整数型。指定影片的背景颜色。默认值为“#白色”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_销毁

- 原文链接：https://esdn.ijingyi.com/title-41017.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_销毁 （ 影片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个SWF影片，成功返回真；如果该ID不是影片ID或者该影片ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
销毁一个SWF影片，成功返回真；如果该ID不是影片ID或者该影片ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_影片_销毁 （影片ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_添加物体

- 原文链接：https://esdn.ijingyi.com/title-41018.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：整数型
- 语法：整数型 SWF_影片_添加物体 （ 影片ID ， 物体ID ， ［ 停留帧数 ］ ， ［ 横坐标 ］ ， ［ 纵坐标 ］ ， ［ 名称 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 向SWF影片中添加一个物体，成功返回添加后该物体在SWF影片中的实例ID，失败返回0。成功添加到当前帧的实例除非被移除将会在后续帧中继续显示。参看“SWF_实例_移除”。成功返回的实例ID会在物体被销毁时自动移除。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 物体ID | 必填 | 整数型 | 该处可以传递一个使用本库命令生成的图形、按钮、声音、预建剪辑、编辑框、标签、图片、视频流、形变、影片剪辑、字体、动作对象的ID。 |
| 停留帧数 | 可空 | 整数型 | 如果提供了此参数，且值大于0，将自动在此后相应帧处移除此物体实例。参见“SWF_实例_移除”。 |
| 横坐标 | 可空 | 双精度小数型 | 指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 纵坐标 | 可空 | 双精度小数型 | 指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 名称 | 可空 | 文本型 | 指定添加后生成的实例的名称。如果指定了本参数，其效果等同于对返回的实例ID调用了“SWF_实例_置名称”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_添加物体 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
向SWF影片中添加一个物体，成功返回添加后该物体在SWF影片中的实例ID，失败返回0。成功添加到当前帧的实例除非被移除将会在后续帧中继续显示。参看“SWF_实例_移除”。成功返回的实例ID会在物体被销毁时自动移除。

*语法：*  整数型  SWF_影片_添加物体 （影片ID， 物体ID， ［停留帧数］， ［横坐标］， ［纵坐标］， ［名称］）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 物体ID | 必需的 ； 整数型。该处可以传递一个使用本库命令生成的图形、按钮、声音、预建剪辑、编辑框、标签、图片、视频流、形变、影片剪辑、字体、动作对象的ID。 |
| 停留帧数 | 可选的 ； 整数型。如果提供了此参数，且值大于0，将自动在此后相应帧处移除此物体实例。参见“SWF_实例_移除”。 |
| 横坐标 | 可选的 ； 双精度小数型。指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 纵坐标 | 可选的 ； 双精度小数型。指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 名称 | 可选的 ； 文本型。指定添加后生成的实例的名称。如果指定了本参数，其效果等同于对返回的实例ID调用了“SWF_实例_置名称”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_添加动作

- 原文链接：https://esdn.ijingyi.com/title-41019.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：整数型
- 语法：整数型 SWF_影片_添加动作 （ 影片ID ， 脚本代码 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 在当前帧添加一个动作（一段脚本）。其效果等同于使用“脚本代码命令”创建一个动作，然后调用“SWF_影片_添加物体”。添加的动作代码将在播放到本帧时执行。成功返回一个动作ID，可以在必要的时候使用“SWF_动作_销毁”来销毁该动作。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 脚本代码 | 必填 | 文本型 | ActionScript脚本文本。参看“SWF_动作_创建”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_添加动作 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
在当前帧添加一个动作（一段脚本）。其效果等同于使用“脚本代码命令”创建一个动作，然后调用“SWF_影片_添加物体”。添加的动作代码将在播放到本帧时执行。成功返回一个动作ID，可以在必要的时候使用“SWF_动作_销毁”来销毁该动作。失败返回0。

*语法：*  整数型  SWF_影片_添加动作 （影片ID， 脚本代码）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 脚本代码 | 必需的 ； 文本型。ActionScript脚本文本。参看“SWF_动作_创建”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_生成文件

- 原文链接：https://esdn.ijingyi.com/title-41020.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_生成文件 （ 影片ID ， 文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 生成Flash影片文件（*.swf）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 文件名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_生成文件 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
生成Flash影片文件（*.swf）。

*语法：*  逻辑型  SWF_影片_生成文件 （影片ID， 文件名）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 文件名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_生成内容

- 原文链接：https://esdn.ijingyi.com/title-41021.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：字节集
- 语法：字节集 SWF_影片_生成内容 （ 影片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 生成Flash影片内容，返回其字节集数据。失败返回空字节集。如果参数指定的ID不是有效的影片ID，本命令将失败。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_生成内容 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
生成Flash影片内容，返回其字节集数据。失败返回空字节集。如果参数指定的ID不是有效的影片ID，本命令将失败。

*语法：*  字节集  SWF_影片_生成内容 （影片ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_结束当前帧并开始新帧

- 原文链接：https://esdn.ijingyi.com/title-41022.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_结束当前帧并开始新帧 （ 影片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 结束当前帧，同时自动开始一个新的帧并成为当前帧。如果完成了当前帧的设计，必须调用本命令。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_结束当前帧并开始新帧 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
结束当前帧，同时自动开始一个新的帧并成为当前帧。如果完成了当前帧的设计，必须调用本命令。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_影片_结束当前帧并开始新帧 （影片ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_添加帧

- 原文链接：https://esdn.ijingyi.com/title-41023.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_添加帧 （ 影片ID ， 帧数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 在影片最后添加多个帧，等效于循环调用“SWF_影片_结束当前帧并开始新帧”。成功返回真， 失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 帧数 | 必填 | 整数型 | 欲添加的帧数，即循环调用“SWF_影片_结束当前帧并开始新帧”的次数。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_添加帧 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
在影片最后添加多个帧，等效于循环调用“SWF_影片_结束当前帧并开始新帧”。成功返回真， 失败返回假。

*语法：*  逻辑型  SWF_影片_添加帧 （影片ID， 帧数）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 帧数 | 必需的 ； 整数型。欲添加的帧数，即循环调用“SWF_影片_结束当前帧并开始新帧”的次数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_取帧速率

- 原文链接：https://esdn.ijingyi.com/title-41024.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：小数型
- 语法：小数型 SWF_影片_取帧速率 （ 影片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 获取影片的播放帧速率。返回值的单位是“每秒播放的帧数（FPS）”。参看“SWF_影片_创建”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_取帧速率 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
获取影片的播放帧速率。返回值的单位是“每秒播放的帧数（FPS）”。参看“SWF_影片_创建”。

*语法：*  小数型  SWF_影片_取帧速率 （影片ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_定义场景

- 原文链接：https://esdn.ijingyi.com/title-41025.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_定义场景 （ 影片ID ， 帧索引 ， 场景名称 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 在影片的主时间线上定义一个场景。关于“场景”请参看http://livedocs.adobe.com/flash/9.0_cn/UsingFlash/WSd60f23110762d6b883b18f10cb1fe1af6-7eb3.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 帧索引 | 必填 | 长整数型 | 从0开始。 |
| 场景名称 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_定义场景 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
在影片的主时间线上定义一个场景。关于“场景”请参看http://livedocs.adobe.com/flash/9.0_cn/UsingFlash/WSd60f23110762d6b883b18f10cb1fe1af6-7eb3.html。

*语法：*  逻辑型  SWF_影片_定义场景 （影片ID， 帧索引， 场景名称）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 帧索引 | 必需的 ； 长整数型。从0开始。 |
| 场景名称 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_置当前帧标签

- 原文链接：https://esdn.ijingyi.com/title-41026.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_置当前帧标签 （ 影片ID ， 帧标签 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为指定影片的当前帧设置帧标签文本，此文本可作为ActionScript脚本gotoAndStop()等函数的参数使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 帧标签 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_置当前帧标签 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
为指定影片的当前帧设置帧标签文本，此文本可作为ActionScript脚本gotoAndStop()等函数的参数使用。

*语法：*  逻辑型  SWF_影片_置当前帧标签 （影片ID， 帧标签）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 帧标签 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_置声音流

- 原文链接：https://esdn.ijingyi.com/title-41027.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_置声音流 （ 影片ID ， 声音流ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为影片添加一个声音流。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 声音流ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_置声音流 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
为影片添加一个声音流。

*语法：*  逻辑型  SWF_影片_置声音流 （影片ID， 声音流ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 声音流ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_开始播放声音

- 原文链接：https://esdn.ijingyi.com/title-41028.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：整数型
- 语法：整数型 SWF_影片_开始播放声音 （ 影片ID ， 声音ID ， ［ 是否可重复播放 ］ ， ［ 循环播放次数 ］ ， ［ 循环起始点 ］ ， ［ 循环结束点 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 从当前帧开始播放特定的声音数据。如果想停止已经开始播放的声音数据，可以使用“SWF_影片_停止播放声音”。返回一个声音实例ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 声音ID | 必填 | 整数型 |  |
| 是否可重复播放 | 可空 | 逻辑型 | 默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可空 | 整数型 | 默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可空 | 整数型 | 设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可空 | 整数型 | 设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_开始播放声音 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
从当前帧开始播放特定的声音数据。如果想停止已经开始播放的声音数据，可以使用“SWF_影片_停止播放声音”。返回一个声音实例ID。

*语法：*  整数型  SWF_影片_开始播放声音 （影片ID， 声音ID， ［是否可重复播放］， ［循环播放次数］， ［循环起始点］， ［循环结束点］）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 声音ID | 必需的 ； 整数型。 |
| 是否可重复播放 | 可选的 ； 逻辑型。默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可选的 ； 整数型。默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可选的 ； 整数型。设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可选的 ； 整数型。设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_停止播放声音

- 原文链接：https://esdn.ijingyi.com/title-41029.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_停止播放声音 （ 影片ID ， 声音ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 参看“SWF_影片_开始播放声音”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 声音ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_停止播放声音 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
参看“SWF_影片_开始播放声音”。

*语法：*  逻辑型  SWF_影片_停止播放声音 （影片ID， 声音ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 声音ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_移除所有实例

- 原文链接：https://esdn.ijingyi.com/title-41030.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_移除所有实例 （ 影片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 移除当前帧中的所有实例。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_移除所有实例 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
移除当前帧中的所有实例。

*语法：*  逻辑型  SWF_影片_移除所有实例 （影片ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_置本地回放安全

- 原文链接：https://esdn.ijingyi.com/title-41031.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_置本地回放安全 （ 影片ID ， 是否可以访问网络 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置该影片在本地回访时的网络访问权限。如果设置权限为假，一个本地加载的SWF不能访问网络但是可以访问本地文件；如果设置权限为真，一个本地加载的SWF不可以访问本地文件，但是可以访问网络。参看 http://www.adobe.com/devnet/flash/articles/fplayer8_security.html 。对于版本 >= 8 的影片，默认值为假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 是否可以访问网络 | 必填 | 逻辑型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_置本地回放安全 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
设置该影片在本地回访时的网络访问权限。如果设置权限为假，一个本地加载的SWF不能访问网络但是可以访问本地文件；如果设置权限为真，一个本地加载的SWF不可以访问本地文件，但是可以访问网络。参看 http://www.adobe.com/devnet/flash/articles/fplayer8_security.html 。对于版本 >= 8 的影片，默认值为假。

*语法：*  逻辑型  SWF_影片_置本地回放安全 （影片ID， 是否可以访问网络）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 是否可以访问网络 | 必需的 ； 逻辑型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_置脚本限制

- 原文链接：https://esdn.ijingyi.com/title-41032.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片_置脚本限制 （ 影片ID ， 最大递归深度 ， 执行超时 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置播放器解释执行本SWF文件中的ActionScript脚本时所用的限制。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 最大递归深度 | 必填 | 整数型 | 默认值为265。 |
| 执行超时 | 必填 | 整数型 | 默认值为15到20秒不等。取决于播放器。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_置脚本限制 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
设置播放器解释执行本SWF文件中的ActionScript脚本时所用的限制。

*语法：*  逻辑型  SWF_影片_置脚本限制 （影片ID， 最大递归深度， 执行超时）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 最大递归深度 | 必需的 ； 整数型。默认值为265。 |
| 执行超时 | 必需的 ； 整数型。默认值为15到20秒不等。取决于播放器。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片_添加匀速形变

- 原文链接：https://esdn.ijingyi.com/title-41033.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片
- 返回值类型：整数型
- 语法：整数型 SWF_影片_添加匀速形变 （ 影片ID ， 形变ID ， 持续帧数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 向影片中添加一个形变，并自动设置此形变实例在后续各帧中的形变率，以达到匀速形变。执行成功返回实例ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片ID | 必填 | 整数型 |  |
| 形变ID | 必填 | 整数型 |  |
| 持续帧数 | 必填 | 整数型 | 指定形变持续的帧数，包括开始帧和结束帧。至少要大于1。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片_添加匀速形变 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct1.htm)

为高级用户提供，初级用户无需掌握；
向影片中添加一个形变，并自动设置此形变实例在后续各帧中的形变率，以达到匀速形变。执行成功返回实例ID。

*语法：*  整数型  SWF_影片_添加匀速形变 （影片ID， 形变ID， 持续帧数）

| 参数名 | 描 述 |
| --- | --- |
| 影片ID | 必需的 ； 整数型。 |
| 形变ID | 必需的 ； 整数型。 |
| 持续帧数 | 必需的 ； 整数型。指定形变持续的帧数，包括开始帧和结束帧。至少要大于1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_创建

- 原文链接：https://esdn.ijingyi.com/title-41034.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_影片剪辑_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的影片剪辑(MovieClip,简称MC)，新建影片剪辑后可以向其中添加各种物体（比如图形、图片等，不支持添加视频），成功则返回新建的影片剪辑ID，失败返回0。注意:当完成影片剪辑的一帧后，必须调用“SWF_影片剪辑_结束当前帧并开始新帧”才能正确显示。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的影片剪辑(MovieClip,简称MC)，新建影片剪辑后可以向其中添加各种物体（比如图形、图片等，不支持添加视频），成功则返回新建的影片剪辑ID，失败返回0。注意:当完成影片剪辑的一帧后，必须调用“SWF_影片剪辑_结束当前帧并开始新帧”才能正确显示。

*语法：*  整数型  SWF_影片剪辑_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_销毁

- 原文链接：https://esdn.ijingyi.com/title-41035.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_销毁 （ 影片剪辑ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个新的影片剪辑，成功返回真；如果该ID不是影片剪辑ID或者该影片剪辑ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
销毁一个新的影片剪辑，成功返回真；如果该ID不是影片剪辑ID或者该影片剪辑ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_影片剪辑_销毁 （影片剪辑ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_结束当前帧并开始新帧

- 原文链接：https://esdn.ijingyi.com/title-41036.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_结束当前帧并开始新帧 （ 影片剪辑ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 结束当前帧，同时自动开始一个新的帧并成为当前帧。如果完成了当前帧的设计，必须调用本命令。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_结束当前帧并开始新帧 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
结束当前帧，同时自动开始一个新的帧并成为当前帧。如果完成了当前帧的设计，必须调用本命令。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_影片剪辑_结束当前帧并开始新帧 （影片剪辑ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_添加帧

- 原文链接：https://esdn.ijingyi.com/title-41037.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_添加帧 （ 影片剪辑ID ， 帧数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 在影片剪辑最后添加多个帧，等效于循环调用“SWF_影片剪辑_结束当前帧并开始新帧”。成功返回真， 失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 帧数 | 必填 | 整数型 | 欲添加的帧数，即循环调用“SWF_影片剪辑_结束当前帧并开始新帧”的次数。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_添加帧 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
在影片剪辑最后添加多个帧，等效于循环调用“SWF_影片剪辑_结束当前帧并开始新帧”。成功返回真， 失败返回假。

*语法：*  逻辑型  SWF_影片剪辑_添加帧 （影片剪辑ID， 帧数）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 帧数 | 必需的 ； 整数型。欲添加的帧数，即循环调用“SWF_影片剪辑_结束当前帧并开始新帧”的次数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_置当前帧标签

- 原文链接：https://esdn.ijingyi.com/title-41038.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_置当前帧标签 （ 影片剪辑ID ， 帧标签 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为指定影片剪辑的当前帧设置帧标签文本，此文本可作为ActionScript脚本gotoAndStop()等函数的参数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 帧标签 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_置当前帧标签 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
为指定影片剪辑的当前帧设置帧标签文本，此文本可作为ActionScript脚本gotoAndStop()等函数的参数。

*语法：*  逻辑型  SWF_影片剪辑_置当前帧标签 （影片剪辑ID， 帧标签）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 帧标签 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_添加物体

- 原文链接：https://esdn.ijingyi.com/title-41039.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_影片剪辑_添加物体 （ 影片剪辑ID ， 物体ID ， ［ 停留帧数 ］ ， ［ 横坐标 ］ ， ［ 纵坐标 ］ ， ［ 名称 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 向影片剪辑中添加一个物体，成功返回添加后该物体在Flash影片中的实例ID，失败返回0。成功添加到当前帧的实例除非被移除，否则将会在后续帧中继续显示。参看“SWF_实例_移除”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 物体ID | 必填 | 整数型 | 该处可以传递一个使用本库命令生成的图形、按钮、预建剪辑、编辑框、标签、图片、形变、字体的ID。 |
| 停留帧数 | 可空 | 整数型 | 如果提供了此参数，且值大于0，将自动在此后相应帧处移除此物体实例。参见“SWF_实例_移除”。 |
| 横坐标 | 可空 | 双精度小数型 | 指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 纵坐标 | 可空 | 双精度小数型 | 指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 名称 | 可空 | 文本型 | 指定添加后生成的实例的名称。如果指定了本参数，其效果等同于对返回的实例ID调用了“SWF_实例_置名称”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_添加物体 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
向影片剪辑中添加一个物体，成功返回添加后该物体在Flash影片中的实例ID，失败返回0。成功添加到当前帧的实例除非被移除，否则将会在后续帧中继续显示。参看“SWF_实例_移除”。

*语法：*  整数型  SWF_影片剪辑_添加物体 （影片剪辑ID， 物体ID， ［停留帧数］， ［横坐标］， ［纵坐标］， ［名称］）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 物体ID | 必需的 ； 整数型。该处可以传递一个使用本库命令生成的图形、按钮、预建剪辑、编辑框、标签、图片、形变、字体的ID。 |
| 停留帧数 | 可选的 ； 整数型。如果提供了此参数，且值大于0，将自动在此后相应帧处移除此物体实例。参见“SWF_实例_移除”。 |
| 横坐标 | 可选的 ； 双精度小数型。指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 纵坐标 | 可选的 ； 双精度小数型。指定添加后生成的实例的位置。如果指定了本参数，其效果等同于对返回的实例对象调用了“SWF_实例_移动”。 |
| 名称 | 可选的 ； 文本型。指定添加后生成的实例的名称。如果指定了本参数，其效果等同于对返回的实例ID调用了“SWF_实例_置名称”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_置声音流

- 原文链接：https://esdn.ijingyi.com/title-41040.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_置声音流 （ 影片剪辑ID ， 声音流ID ， 帧速率 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为指定的影片剪辑添加一个声音流。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 声音流ID | 必填 | 整数型 |  |
| 帧速率 | 必填 | 小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_置声音流 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
为指定的影片剪辑添加一个声音流。

*语法：*  逻辑型  SWF_影片剪辑_置声音流 （影片剪辑ID， 声音流ID， 帧速率）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 声音流ID | 必需的 ； 整数型。 |
| 帧速率 | 必需的 ； 小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_开始播放声音

- 原文链接：https://esdn.ijingyi.com/title-41041.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_影片剪辑_开始播放声音 （ 影片剪辑ID ， 声音ID ， ［ 是否可重复播放 ］ ， ［ 循环播放次数 ］ ， ［ 循环起始点 ］ ， ［ 循环结束点 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 从影片剪辑的当前帧开始播放特定的声音数据。如果想停止已经开始播放的声音数据，可以使用“SWF_影片剪辑_停止播放声音”。成功返回一个声音实例ID，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 声音ID | 必填 | 整数型 |  |
| 是否可重复播放 | 可空 | 逻辑型 | 默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可空 | 整数型 | 默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可空 | 整数型 | 设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可空 | 整数型 | 设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_开始播放声音 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
从影片剪辑的当前帧开始播放特定的声音数据。如果想停止已经开始播放的声音数据，可以使用“SWF_影片剪辑_停止播放声音”。成功返回一个声音实例ID，失败返回0。

*语法：*  整数型  SWF_影片剪辑_开始播放声音 （影片剪辑ID， 声音ID， ［是否可重复播放］， ［循环播放次数］， ［循环起始点］， ［循环结束点］）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 声音ID | 必需的 ； 整数型。 |
| 是否可重复播放 | 可选的 ； 逻辑型。默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可选的 ； 整数型。默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可选的 ； 整数型。设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可选的 ； 整数型。设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_停止播放声音

- 原文链接：https://esdn.ijingyi.com/title-41042.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_停止播放声音 （ 影片剪辑ID ， 声音ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 参看“SWF_影片剪辑_开始播放声音”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 声音ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_停止播放声音 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
参看“SWF_影片剪辑_开始播放声音”。

*语法：*  逻辑型  SWF_影片剪辑_停止播放声音 （影片剪辑ID， 声音ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 声音ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_增加初始动作

- 原文链接：https://esdn.ijingyi.com/title-41043.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_增加初始动作 （ 影片剪辑ID ， 动作ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 该初始动作在指定的影片剪辑可用之前发生。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 动作ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_增加初始动作 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
该初始动作在指定的影片剪辑可用之前发生。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_影片剪辑_增加初始动作 （影片剪辑ID， 动作ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 动作ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_添加动作

- 原文链接：https://esdn.ijingyi.com/title-41044.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_影片剪辑_添加动作 （ 影片剪辑ID ， 脚本代码 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 在当前帧添加一个动作（一段脚本）。其效果等同于使用“脚本代码命令”创建一个动作，然后添加。成功添加的动作代码将在播放到本帧时执行。成功返回一个动作ID，可以在必要的时候使用“SWF_动作_销毁”来销毁该动作。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 脚本代码 | 必填 | 文本型 | ActionScript脚本文本。参看“SWF_动作_创建”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_添加动作 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
在当前帧添加一个动作（一段脚本）。其效果等同于使用“脚本代码命令”创建一个动作，然后添加。成功添加的动作代码将在播放到本帧时执行。成功返回一个动作ID，可以在必要的时候使用“SWF_动作_销毁”来销毁该动作。失败返回0。

*语法：*  整数型  SWF_影片剪辑_添加动作 （影片剪辑ID， 脚本代码）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 脚本代码 | 必需的 ； 文本型。ActionScript脚本文本。参看“SWF_动作_创建”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_添加匀速形变

- 原文链接：https://esdn.ijingyi.com/title-41045.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_影片剪辑_添加匀速形变 （ 影片剪辑ID ， 形变ID ， 持续帧数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 向影片剪辑中添加一个形变，并自动设置此形变实例在后续各帧中的形变率，以达到匀速形变。执行成功返回实例ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |
| 形变ID | 必填 | 整数型 |  |
| 持续帧数 | 必填 | 整数型 | 指定形变持续的帧数，包括开始帧和结束帧。至少要大于1。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_添加匀速形变 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
向影片剪辑中添加一个形变，并自动设置此形变实例在后续各帧中的形变率，以达到匀速形变。执行成功返回实例ID。

*语法：*  整数型  SWF_影片剪辑_添加匀速形变 （影片剪辑ID， 形变ID， 持续帧数）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |
| 形变ID | 必需的 ； 整数型。 |
| 持续帧数 | 必需的 ； 整数型。指定形变持续的帧数，包括开始帧和结束帧。至少要大于1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_影片剪辑_移除所有实例

- 原文链接：https://esdn.ijingyi.com/title-41046.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_影片剪辑_移除所有实例 （ 影片剪辑ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 移除该影片剪辑当前帧中的所有实例。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 影片剪辑ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_影片剪辑_移除所有实例 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
移除该影片剪辑当前帧中的所有实例。

*语法：*  逻辑型  SWF_影片剪辑_移除所有实例 （影片剪辑ID）

| 参数名 | 描 述 |
| --- | --- |
| 影片剪辑ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_预建剪辑_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41047.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_预建剪辑_从文件创建 （ 文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的预建剪辑，返回新建的预建剪辑ID，该ID可以作为“物体ID”使用。该方法用于将一个swf文件读入并将其作为一个影片剪辑添加到新的Flash影片中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 该参数接收一个swf文件。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_预建剪辑_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的预建剪辑，返回新建的预建剪辑ID，该ID可以作为“物体ID”使用。该方法用于将一个swf文件读入并将其作为一个影片剪辑添加到新的Flash影片中。

*语法：*  整数型  SWF_预建剪辑_从文件创建 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。该参数接收一个swf文件。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_预建剪辑_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41048.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：整数型
- 语法：整数型 SWF_预建剪辑_从字节集创建 （ SWF文件内容 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的预建剪辑，返回新建的预建剪辑ID，该ID可以作为“物体ID”使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SWF文件内容 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_预建剪辑_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的预建剪辑，返回新建的预建剪辑ID，该ID可以作为“物体ID”使用。

*语法：*  整数型  SWF_预建剪辑_从字节集创建 （SWF文件内容）

| 参数名 | 描 述 |
| --- | --- |
| SWF文件内容 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_预建剪辑_销毁

- 原文链接：https://esdn.ijingyi.com/title-41049.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：影片剪辑
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_预建剪辑_销毁 （ 预建剪辑ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个预建剪辑，成功返回真；如果该ID不是预建剪辑ID或者该预建剪辑ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 预建剪辑ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_预建剪辑_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[影片剪辑](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct2.htm)

为高级用户提供，初级用户无需掌握；
销毁一个预建剪辑，成功返回真；如果该ID不是预建剪辑ID或者该预建剪辑ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_预建剪辑_销毁 （预建剪辑ID）

| 参数名 | 描 述 |
| --- | --- |
| 预建剪辑ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮_创建

- 原文链接：https://esdn.ijingyi.com/title-41050.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：整数型
- 语法：整数型 SWF_按钮_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的按钮，返回新建的按钮ID，该ID可以作为“物体ID”使用。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的按钮，返回新建的按钮ID，该ID可以作为“物体ID”使用。

*语法：*  整数型  SWF_按钮_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮_销毁

- 原文链接：https://esdn.ijingyi.com/title-41051.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮_销毁 （ 按钮ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个按钮，成功返回真；如果该ID不是按钮ID或者该按钮ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
销毁一个按钮，成功返回真；如果该ID不是按钮ID或者该按钮ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_按钮_销毁 （按钮ID）

| 参数名 | 描 述 |
| --- | --- |
| 按钮ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮_添加图形

- 原文链接：https://esdn.ijingyi.com/title-41052.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：整数型
- 语法：整数型 SWF_按钮_添加图形 （ 按钮ID ， 图形ID ， 按钮显示状态 ， ［ 横坐标 ］ ， ［ 纵坐标 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该按钮添加一个图形，成功返回一个按钮图形实例ID，失败返回0。若对同一个按钮调用多次该方法，则添加的图形在不同的层面上，例如第一次添加的图形在第一层，第二次添加的图形在第二层，层数越大越在上方显示，依此类推。也可调用“SWF_按钮图形实例_置所在层”改变他们之间的层的关系，请参考之。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮ID | 必填 | 整数型 |  |
| 图形ID | 必填 | 整数型 |  |
| 按钮显示状态 | 必填 | SWF_按钮显示状态 | 反应了在当前按钮显示状态下所表现的图形。该参数可以添加多个显示状态,参见#SWF_按钮显示状态。 |
| 横坐标 | 可空 | 双精度小数型 | 指定添加后生成的按钮图形实例的位置。如果指定了本参数，其效果等同于对返回的按钮图形实例对象调用了“SWF_按钮图形实例_移动”。如果该参数为空，则默认为0。 |
| 纵坐标 | 可空 | 双精度小数型 | 指定添加后生成的按钮图形实例的位置。如果指定了本参数，其效果等同于对返回的按钮图形实例对象调用了“SWF_按钮图形实例_移动”。如果该参数为空，则默认为0。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮_添加图形 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
为该按钮添加一个图形，成功返回一个按钮图形实例ID，失败返回0。若对同一个按钮调用多次该方法，则添加的图形在不同的层面上，例如第一次添加的图形在第一层，第二次添加的图形在第二层，层数越大越在上方显示，依此类推。也可调用“SWF_按钮图形实例_置所在层”改变他们之间的层的关系，请参考之。

*语法：*  整数型  SWF_按钮_添加图形 （按钮ID， 图形ID， 按钮显示状态， ［横坐标］， ［纵坐标］）

| 参数名 | 描 述 |
| --- | --- |
| 按钮ID | 必需的 ； 整数型。 |
| 图形ID | 必需的 ； 整数型。 |
| 按钮显示状态 | 必需的 ； SWF_按钮显示状态。反应了在当前按钮显示状态下所表现的图形。该参数可以添加多个显示状态,参见#SWF_按钮显示状态。 |
| 横坐标 | 可选的 ； 双精度小数型。指定添加后生成的按钮图形实例的位置。如果指定了本参数，其效果等同于对返回的按钮图形实例对象调用了“SWF_按钮图形实例_移动”。如果该参数为空，则默认为0。 |
| 纵坐标 | 可选的 ； 双精度小数型。指定添加后生成的按钮图形实例的位置。如果指定了本参数，其效果等同于对返回的按钮图形实例对象调用了“SWF_按钮图形实例_移动”。如果该参数为空，则默认为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮_添加动作

- 原文链接：https://esdn.ijingyi.com/title-41053.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮_添加动作 （ 按钮ID ， 动作ID ， 按钮事件 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该按钮在触发某按钮事件时添加一个动作，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮ID | 必填 | 整数型 |  |
| 动作ID | 必填 | 整数型 | 本参数对应的动作对象将由本按钮对象负责销毁。 |
| 按钮事件 | 必填 | SWF_按钮事件 | 反应了在这个按钮事件下所对应的动作。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮_添加动作 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
为该按钮在触发某按钮事件时添加一个动作，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮_添加动作 （按钮ID， 动作ID， 按钮事件）

| 参数名 | 描 述 |
| --- | --- |
| 按钮ID | 必需的 ； 整数型。 |
| 动作ID | 必需的 ； 整数型。本参数对应的动作对象将由本按钮对象负责销毁。 |
| 按钮事件 | 必需的 ； SWF_按钮事件。反应了在这个按钮事件下所对应的动作。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮_添加声音

- 原文链接：https://esdn.ijingyi.com/title-41054.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：整数型
- 语法：整数型 SWF_按钮_添加声音 （ 按钮ID ， 声音ID ， 按钮事件 ， ［ 是否可重复播放 ］ ， ［ 循环播放次数 ］ ， ［ 循环起始点 ］ ， ［ 循环结束点 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该按钮在触发某按钮事件时添加一个声音，成功返回一个声音实例ID，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮ID | 必填 | 整数型 |  |
| 声音ID | 必填 | 整数型 |  |
| 按钮事件 | 必填 | SWF_按钮事件 | 反应了在这个按钮状态下所对应的声音。 |
| 是否可重复播放 | 可空 | 逻辑型 | 默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可空 | 整数型 | 默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可空 | 整数型 | 设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可空 | 整数型 | 设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮_添加声音 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
为该按钮在触发某按钮事件时添加一个声音，成功返回一个声音实例ID，失败返回0。

*语法：*  整数型  SWF_按钮_添加声音 （按钮ID， 声音ID， 按钮事件， ［是否可重复播放］， ［循环播放次数］， ［循环起始点］， ［循环结束点］）

| 参数名 | 描 述 |
| --- | --- |
| 按钮ID | 必需的 ； 整数型。 |
| 声音ID | 必需的 ； 整数型。 |
| 按钮事件 | 必需的 ； SWF_按钮事件。反应了在这个按钮状态下所对应的声音。 |
| 是否可重复播放 | 可选的 ； 逻辑型。默认值为真。如果该参数为假，那么在该声音的过程中再次播放该声音无效。 |
| 循环播放次数 | 可选的 ； 整数型。默认只播放一次。如果指定了本参数且其值大于0，则后面两个参数生效，否则不生效。 |
| 循环起始点 | 可选的 ； 整数型。设置循环的起始点。以采样（“sample”）为单位。如果省略，表示从声音的第一个采样开始循环。 |
| 循环结束点 | 可选的 ； 整数型。设置循环的结束点。以采样（“sample”）为单位。如果省略，表示一直循环到声音的最后一个采样。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_置所在层

- 原文链接：https://esdn.ijingyi.com/title-41055.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_置所在层 （ 按钮图形实例ID ， 层数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 按钮包含的指定图形所在的层，成功返回真，失败返回假。层数越大越在上方显示。如果层数改变的值与其他图形同层了，此时又分两种情况：如果从高层往低层设置，则后设置的图形在同层的其他图形下方显示；如果从低层往高层设置，则后设置的图形在其他同层图形的上方显示。可参考例程效果。注意该方法的实现是对同一个按钮ID的不同按钮图形实例而言的。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| 层数 | 必填 | 整数型 | 层数为大于0的整数，如果该按钮图形实例与其他按钮图形实例有重叠，则此时该层数起作用。层数越大的按钮图形实例越在上面显示。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_置所在层 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
按钮包含的指定图形所在的层，成功返回真，失败返回假。层数越大越在上方显示。如果层数改变的值与其他图形同层了，此时又分两种情况：如果从高层往低层设置，则后设置的图形在同层的其他图形下方显示；如果从低层往高层设置，则后设置的图形在其他同层图形的上方显示。可参考例程效果。注意该方法的实现是对同一个按钮ID的不同按钮图形实例而言的。

*语法：*  逻辑型  SWF_按钮图形实例_置所在层 （按钮图形实例ID， 层数）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| 层数 | 必需的 ； 整数型。层数为大于0的整数，如果该按钮图形实例与其他按钮图形实例有重叠，则此时该层数起作用。层数越大的按钮图形实例越在上面显示。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_添加滤镜

- 原文链接：https://esdn.ijingyi.com/title-41056.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_添加滤镜 （ 按钮图形实例ID ， 滤镜ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该按钮图形实例添加一个特定的滤镜，仅对Flash8版本有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| 滤镜ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_添加滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
为该按钮图形实例添加一个特定的滤镜，仅对Flash8版本有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  逻辑型  SWF_按钮图形实例_添加滤镜 （按钮图形实例ID， 滤镜ID）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| 滤镜ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_置混合模式

- 原文链接：https://esdn.ijingyi.com/title-41057.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_置混合模式 （ 按钮图形实例ID ， 混合模式 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该按钮图形实例指定要使用的混合模式，该方法是对该按钮图形实例与其下方的其他实例混合效果的设置。目前仅对Flash版本8有效。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| 混合模式 | 必填 | SWF_混合模式 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_置混合模式 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
为该按钮图形实例指定要使用的混合模式，该方法是对该按钮图形实例与其下方的其他实例混合效果的设置。目前仅对Flash版本8有效。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮图形实例_置混合模式 （按钮图形实例ID， 混合模式）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| 混合模式 | 必需的 ； SWF_混合模式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_移动

- 原文链接：https://esdn.ijingyi.com/title-41058.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_移动 （ 按钮图形实例ID ， X ， Y ）
- 功能说明：为高级用户提供，初级用户无需掌握； 将该按钮图形实例移动到指定位置，单位为像素。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| X | 必填 | 双精度小数型 |  |
| Y | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_移动 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
将该按钮图形实例移动到指定位置，单位为像素。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮图形实例_移动 （按钮图形实例ID， X， Y）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| X | 必需的 ； 双精度小数型。 |
| Y | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_旋转

- 原文链接：https://esdn.ijingyi.com/title-41059.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_旋转 （ 按钮图形实例ID ， 角度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 以添加的图形的左上角为圆心，右方向为0度，将该按钮图形实例旋转到指定角度，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| 角度 | 必填 | 双精度小数型 | 0到360度。角度为负数时顺时针旋转，角度为正数时逆时针旋转。角度超过360度时，将自动取余。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_旋转 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
以添加的图形的左上角为圆心，右方向为0度，将该按钮图形实例旋转到指定角度，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮图形实例_旋转 （按钮图形实例ID， 角度）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| 角度 | 必需的 ； 双精度小数型。0到360度。角度为负数时顺时针旋转，角度为正数时逆时针旋转。角度超过360度时，将自动取余。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_缩放

- 原文链接：https://esdn.ijingyi.com/title-41060.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_缩放 （ 按钮图形实例ID ， 水平缩放 ， 竖直缩放 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 将该按钮图形实例缩放到指定比例，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| 水平缩放 | 必填 | 双精度小数型，初始值为“1” | 等于1为保持原尺寸不变，大于1为放大，小于1为缩小。默认为1。 |
| 竖直缩放 | 必填 | 双精度小数型，初始值为“1” | 等于1为保持原尺寸不变，大于1为放大，小于1为缩小。默认为1。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_缩放 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
将该按钮图形实例缩放到指定比例，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮图形实例_缩放 （按钮图形实例ID， 水平缩放， 竖直缩放）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| 水平缩放 | 必需的 ； 双精度小数型，初始值为“1”。等于1为保持原尺寸不变，大于1为放大，小于1为缩小。默认为1。 |
| 竖直缩放 | 必需的 ； 双精度小数型，初始值为“1”。等于1为保持原尺寸不变，大于1为放大，小于1为缩小。默认为1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮图形实例_倾斜

- 原文链接：https://esdn.ijingyi.com/title-41061.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：按钮
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_按钮图形实例_倾斜 （ 按钮图形实例ID ， ［ X倾斜系数 ］ ， ［ Y倾斜系数 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 按钮图形实例ID | 必填 | 整数型 |  |
| X倾斜系数 | 可空 | 双精度小数型 | 为空表示不改变X轴的倾斜系数。 |
| Y倾斜系数 | 可空 | 双精度小数型 | 为空表示不改变Y轴的倾斜系数。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮图形实例_倾斜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[按钮](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct3.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_按钮图形实例_倾斜 （按钮图形实例ID， ［X倾斜系数］， ［Y倾斜系数］）

| 参数名 | 描 述 |
| --- | --- |
| 按钮图形实例ID | 必需的 ； 整数型。 |
| X倾斜系数 | 可选的 ； 双精度小数型。为空表示不改变X轴的倾斜系数。 |
| Y倾斜系数 | 可选的 ； 双精度小数型。为空表示不改变Y轴的倾斜系数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_创建

- 原文链接：https://esdn.ijingyi.com/title-41062.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：整数型
- 语法：整数型 SWF_图形_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回图形ID，失败返回0。返回值可以作为“物体ID”使用。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
返回图形ID，失败返回0。返回值可以作为“物体ID”使用。

*语法：*  整数型  SWF_图形_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_销毁

- 原文链接：https://esdn.ijingyi.com/title-41063.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_销毁 （ 图形ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个图形，成功返回真；如果该ID不是图形ID或者该图形ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
销毁一个图形，成功返回真；如果该ID不是图形ID或者该图形ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_图形_销毁 （图形ID）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_结束

- 原文链接：https://esdn.ijingyi.com/title-41064.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_结束 （ 图形ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 结束绘画，在此之后的绘画动作无效。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_结束 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
结束绘画，在此之后的绘画动作无效。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_结束 （图形ID）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_移动画笔

- 原文链接：https://esdn.ijingyi.com/title-41065.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_移动画笔 （ 图形ID ， 横坐标 ， 纵坐标 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 将绘画点移动到指定的位置。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 横坐标 | 必填 | 双精度小数型 |  |
| 纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_移动画笔 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
将绘画点移动到指定的位置。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_移动画笔 （图形ID， 横坐标， 纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 横坐标 | 必需的 ； 双精度小数型。 |
| 纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_取画笔横坐标

- 原文链接：https://esdn.ijingyi.com/title-41066.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：双精度小数型
- 语法：双精度小数型 SWF_图形_取画笔横坐标 （ 图形ID ， ［ 是否成功 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 是否成功 | 可空 | 逻辑型，参数数据只能提供变量 | 成功返回真，失败返回假。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_取画笔横坐标 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  双精度小数型  SWF_图形_取画笔横坐标 （图形ID， ［是否成功］）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 是否成功 | 可选的 ； 逻辑型，参数数据只能提供变量。成功返回真，失败返回假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_取画笔纵坐标

- 原文链接：https://esdn.ijingyi.com/title-41067.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：双精度小数型
- 语法：双精度小数型 SWF_图形_取画笔纵坐标 （ 图形ID ， ［ 是否成功 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 是否成功 | 可空 | 逻辑型，参数数据只能提供变量 | 成功返回真，失败返回假。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_取画笔纵坐标 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  双精度小数型  SWF_图形_取画笔纵坐标 （图形ID， ［是否成功］）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 是否成功 | 可选的 ； 逻辑型，参数数据只能提供变量。成功返回真，失败返回假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画线

- 原文链接：https://esdn.ijingyi.com/title-41068.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画线 （ 图形ID ， ［ 起始点横坐标 ］ ， ［ 起始点纵坐标 ］ ， 结束点横坐标 ， 结束点纵坐标 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画线。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 起始点横坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画线。 |
| 起始点纵坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画线。 |
| 结束点横坐标 | 必填 | 双精度小数型 |  |
| 结束点纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画线 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画线。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画线 （图形ID， ［起始点横坐标］， ［起始点纵坐标］， 结束点横坐标， 结束点纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 起始点横坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画线。 |
| 起始点纵坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画线。 |
| 结束点横坐标 | 必需的 ； 双精度小数型。 |
| 结束点纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画曲线

- 原文链接：https://esdn.ijingyi.com/title-41069.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画曲线 （ 图形ID ， ［ 起始点横坐标 ］ ， ［ 起始点纵坐标 ］ ， 控制点横坐标 ， 控制点纵坐标 ， 结束点横坐标 ， 结束点纵坐标 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画曲线。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 起始点横坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画曲线。 |
| 起始点纵坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画曲线。 |
| 控制点横坐标 | 必填 | 双精度小数型 |  |
| 控制点纵坐标 | 必填 | 双精度小数型 |  |
| 结束点横坐标 | 必填 | 双精度小数型 |  |
| 结束点纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画曲线 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画曲线。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画曲线 （图形ID， ［起始点横坐标］， ［起始点纵坐标］， 控制点横坐标， 控制点纵坐标， 结束点横坐标， 结束点纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 起始点横坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画曲线。 |
| 起始点纵坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画曲线。 |
| 控制点横坐标 | 必需的 ； 双精度小数型。 |
| 控制点纵坐标 | 必需的 ； 双精度小数型。 |
| 结束点横坐标 | 必需的 ； 双精度小数型。 |
| 结束点纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画弧

- 原文链接：https://esdn.ijingyi.com/title-41070.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画弧 （ 图形ID ， ［ 圆心点横坐标 ］ ， ［ 圆心点纵坐标 ］ ， 半径 ， 起始角度 ， 结束角度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画弧。如果起始角度大于等于结束角度则画弧失败，如果起始角度小于结束角度则画弧成功。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 圆心点横坐标 | 可空 | 双精度小数型 | “圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画弧。 |
| 圆心点纵坐标 | 可空 | 双精度小数型 | “圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画弧。 |
| 半径 | 必填 | 双精度小数型 | 单位为像素。 |
| 起始角度 | 必填 | 双精度小数型 | 单位为度，0到360度。如果大于360度“起始角度 ＝ 起始角度 % 360”，如果小于0度“起始角度 ＝ 360 + 起始角度 % 360”。圆的12点钟位置为0度，以顺时针方向角度递增。 |
| 结束角度 | 必填 | 双精度小数型 | 单位为度，0到360度。如果大于360度“起始角度 ＝ 起始角度 % 360”，如果小于0度“起始角度 ＝ 360 + 起始角度 % 360”。圆的12点钟位置为0度，以顺时针方向角度递增。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画弧 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画弧。如果起始角度大于等于结束角度则画弧失败，如果起始角度小于结束角度则画弧成功。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画弧 （图形ID， ［圆心点横坐标］， ［圆心点纵坐标］， 半径， 起始角度， 结束角度）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 圆心点横坐标 | 可选的 ； 双精度小数型。“圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画弧。 |
| 圆心点纵坐标 | 可选的 ； 双精度小数型。“圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画弧。 |
| 半径 | 必需的 ； 双精度小数型。单位为像素。 |
| 起始角度 | 必需的 ； 双精度小数型。单位为度，0到360度。如果大于360度“起始角度 ＝ 起始角度 % 360”，如果小于0度“起始角度 ＝ 360 + 起始角度 % 360”。圆的12点钟位置为0度，以顺时针方向角度递增。 |
| 结束角度 | 必需的 ； 双精度小数型。单位为度，0到360度。如果大于360度“起始角度 ＝ 起始角度 % 360”，如果小于0度“起始角度 ＝ 360 + 起始角度 % 360”。圆的12点钟位置为0度，以顺时针方向角度递增。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画圆

- 原文链接：https://esdn.ijingyi.com/title-41071.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画圆 （ 图形ID ， ［ 圆心点横坐标 ］ ， ［ 圆心点纵坐标 ］ ， 半径 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画圆，并移动绘画点到圆的起始位置（即圆的12点钟位置）。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 圆心点横坐标 | 可空 | 双精度小数型 | “圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画圆。 |
| 圆心点纵坐标 | 可空 | 双精度小数型 | “圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画圆。 |
| 半径 | 必填 | 双精度小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画圆 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画圆，并移动绘画点到圆的起始位置（即圆的12点钟位置）。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画圆 （图形ID， ［圆心点横坐标］， ［圆心点纵坐标］， 半径）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 圆心点横坐标 | 可选的 ； 双精度小数型。“圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画圆。 |
| 圆心点纵坐标 | 可选的 ； 双精度小数型。“圆心点横坐标”与“圆心点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为圆心点画圆。 |
| 半径 | 必需的 ； 双精度小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画矩形

- 原文链接：https://esdn.ijingyi.com/title-41072.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画矩形 （ 图形ID ， ［ 左上角横坐标 ］ ， ［ 左上角纵坐标 ］ ， 宽度 ， 高度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画矩形，不移动绘画点的位置。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 左上角横坐标 | 可空 | 双精度小数型 | “左上角横坐标”与“左上角纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为左上角画矩形。 |
| 左上角纵坐标 | 可空 | 双精度小数型 | “左上角横坐标”与“左上角纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为左上角画矩形。 |
| 宽度 | 必填 | 双精度小数型 | 单位为像素。 |
| 高度 | 必填 | 双精度小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画矩形 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画矩形，不移动绘画点的位置。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画矩形 （图形ID， ［左上角横坐标］， ［左上角纵坐标］， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 左上角横坐标 | 可选的 ； 双精度小数型。“左上角横坐标”与“左上角纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为左上角画矩形。 |
| 左上角纵坐标 | 可选的 ； 双精度小数型。“左上角横坐标”与“左上角纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为左上角画矩形。 |
| 宽度 | 必需的 ； 双精度小数型。单位为像素。 |
| 高度 | 必需的 ； 双精度小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画字符

- 原文链接：https://esdn.ijingyi.com/title-41073.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画字符 （ 图形ID ， 字体ID ， 字符码 ， 大小 ， ［ 基点横坐标 ］ ， ［ 基点纵坐标 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画字符，不改变绘画点的位置。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 字体ID | 必填 | 整数型 |  |
| 字符码 | 必填 | 整数型 | 普通字符为ASCII码，宽字符为Unicode码。 |
| 大小 | 必填 | 小数型 | 指定字符的高度，以像素为单位。视字体不同可能有偏差。 |
| 基点横坐标 | 可空 | 双精度小数型 | “基点横坐标”与“基点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为基点画字符。基点通常为字符的左下角。 |
| 基点纵坐标 | 可空 | 双精度小数型 | “基点横坐标”与“基点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为基点画字符。基点通常为字符的左下角。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画字符 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画字符，不改变绘画点的位置。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画字符 （图形ID， 字体ID， 字符码， 大小， ［基点横坐标］， ［基点纵坐标］）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 字体ID | 必需的 ； 整数型。 |
| 字符码 | 必需的 ； 整数型。普通字符为ASCII码，宽字符为Unicode码。 |
| 大小 | 必需的 ； 小数型。指定字符的高度，以像素为单位。视字体不同可能有偏差。 |
| 基点横坐标 | 可选的 ； 双精度小数型。“基点横坐标”与“基点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为基点画字符。基点通常为字符的左下角。 |
| 基点纵坐标 | 可选的 ； 双精度小数型。“基点横坐标”与“基点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为基点画字符。基点通常为字符的左下角。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_画三次贝塞尔曲线

- 原文链接：https://esdn.ijingyi.com/title-41074.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_画三次贝塞尔曲线 （ 图形ID ， ［ 起始点横坐标 ］ ， ［ 起始点纵坐标 ］ ， 控制点1横坐标 ， 控制点1纵坐标 ， 控制点2横坐标 ， 控制点2纵坐标 ， 结束点横坐标 ， 结束点纵坐标 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 根据指定的参数画三次贝塞尔曲线，并移动绘画点到结束点。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 起始点横坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画三次贝塞尔曲线。 |
| 起始点纵坐标 | 可空 | 双精度小数型 | “起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画三次贝塞尔曲线。 |
| 控制点1横坐标 | 必填 | 双精度小数型 |  |
| 控制点1纵坐标 | 必填 | 双精度小数型 |  |
| 控制点2横坐标 | 必填 | 双精度小数型 |  |
| 控制点2纵坐标 | 必填 | 双精度小数型 |  |
| 结束点横坐标 | 必填 | 双精度小数型 |  |
| 结束点纵坐标 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_画三次贝塞尔曲线 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
根据指定的参数画三次贝塞尔曲线，并移动绘画点到结束点。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_画三次贝塞尔曲线 （图形ID， ［起始点横坐标］， ［起始点纵坐标］， 控制点1横坐标， 控制点1纵坐标， 控制点2横坐标， 控制点2纵坐标， 结束点横坐标， 结束点纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 起始点横坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画三次贝塞尔曲线。 |
| 起始点纵坐标 | 可选的 ； 双精度小数型。“起始点横坐标”与“起始点纵坐标”必须同时指定，都不指定或只指定其中的一个将以当前点为起点画三次贝塞尔曲线。 |
| 控制点1横坐标 | 必需的 ； 双精度小数型。 |
| 控制点1纵坐标 | 必需的 ； 双精度小数型。 |
| 控制点2横坐标 | 必需的 ； 双精度小数型。 |
| 控制点2纵坐标 | 必需的 ； 双精度小数型。 |
| 结束点横坐标 | 必需的 ； 双精度小数型。 |
| 结束点纵坐标 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_置填充类型

- 原文链接：https://esdn.ijingyi.com/title-41075.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_置填充类型 （ 图形ID ， ［ 左填充类型ID ］ ， ［ 右填充类型ID ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置左填充类型和右填充类型。成功返回真，失败返回假。如果在此之前使用过“SWF_图形_置线类型（且同时指定了最后两个参数）”和“SWF_图形_置线填充”两个方法且设置左填充类型或右填充类型为“实心填充类型”时，将返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 左填充类型ID | 可空 | 整数型 | 由方法“SWF_填充类型_创建实心填充类型”、“SWF_填充类型_创建渐变填充类型”和“SWF_填充类型_创建图片填充类型”创建的填充类型。左填充的填充类型ID，如果省略则不设置左填充类型。本参数对应的填充类型对象将由本图形对象负责销毁。 |
| 右填充类型ID | 可空 | 整数型 | 由方法“SWF_填充类型_创建实心填充类型”、“SWF_填充类型_创建渐变填充类型”和“SWF_填充类型_创建图片填充类型”创建的填充类型。右填充的填充类型ID，如果省略则不设置右填充类型。本参数对应的填充类型对象将由本图形对象负责销毁。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_置填充类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
设置左填充类型和右填充类型。成功返回真，失败返回假。如果在此之前使用过“SWF_图形_置线类型（且同时指定了最后两个参数）”和“SWF_图形_置线填充”两个方法且设置左填充类型或右填充类型为“实心填充类型”时，将返回假。

*语法：*  逻辑型  SWF_图形_置填充类型 （图形ID， ［左填充类型ID］， ［右填充类型ID］）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 左填充类型ID | 可选的 ； 整数型。由方法“SWF_填充类型_创建实心填充类型”、“SWF_填充类型_创建渐变填充类型”和“SWF_填充类型_创建图片填充类型”创建的填充类型。左填充的填充类型ID，如果省略则不设置左填充类型。本参数对应的填充类型对象将由本图形对象负责销毁。 |
| 右填充类型ID | 可选的 ； 整数型。由方法“SWF_填充类型_创建实心填充类型”、“SWF_填充类型_创建渐变填充类型”和“SWF_填充类型_创建图片填充类型”创建的填充类型。右填充的填充类型ID，如果省略则不设置右填充类型。本参数对应的填充类型对象将由本图形对象负责销毁。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_置线类型

- 原文链接：https://esdn.ijingyi.com/title-41076.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_置线类型 （ 图形ID ， 宽度 ， 颜色 ， ［ 透明度 ］ ， ［ 类型 ］ ， ［ 线斜接处长度 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 最后两个参数同时指定时与“实心填充类型”不兼容，不可同时使用。如果在此之前使用“SWF_图形_置填充类型”方法设置过实心填充类型且同时指定了最后两个参数，将返回假。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 宽度 | 必填 | 整数型 | 单位为像素。 |
| 颜色 | 必填 | 整数型 |  |
| 透明度 | 可空 | 字节型 | 0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |
| 类型 | 可空 | SWF_线类型 | 最后两个参数必须同时指定，否则忽略。 |
| 线斜接处长度 | 可空 | 小数型 | 最后两个参数必须同时指定，否则忽略。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_置线类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
最后两个参数同时指定时与“实心填充类型”不兼容，不可同时使用。如果在此之前使用“SWF_图形_置填充类型”方法设置过实心填充类型且同时指定了最后两个参数，将返回假。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_图形_置线类型 （图形ID， 宽度， 颜色， ［透明度］， ［类型］， ［线斜接处长度］）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 宽度 | 必需的 ； 整数型。单位为像素。 |
| 颜色 | 必需的 ； 整数型。 |
| 透明度 | 可选的 ； 字节型。0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |
| 类型 | 可选的 ； SWF_线类型。最后两个参数必须同时指定，否则忽略。 |
| 线斜接处长度 | 可选的 ； 小数型。最后两个参数必须同时指定，否则忽略。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图形_置线填充类型

- 原文链接：https://esdn.ijingyi.com/title-41077.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图形
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_图形_置线填充类型 （ 图形ID ， 宽度 ， 填充类型ID ， 类型 ， 线类型斜接处长度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。与“实心填充类型”不兼容，不可同时使用。如果在此之前使用“SWF_图形_置填充类型”方法设置过实心填充类型，将返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图形ID | 必填 | 整数型 |  |
| 宽度 | 必填 | 整数型 | 单位为像素。 |
| 填充类型ID | 必填 | 整数型 | 实心填充类型无效。 |
| 类型 | 必填 | SWF_线类型 |  |
| 线类型斜接处长度 | 必填 | 小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_图形_置线填充类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图形](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct4.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。与“实心填充类型”不兼容，不可同时使用。如果在此之前使用“SWF_图形_置填充类型”方法设置过实心填充类型，将返回假。

*语法：*  逻辑型  SWF_图形_置线填充类型 （图形ID， 宽度， 填充类型ID， 类型， 线类型斜接处长度）

| 参数名 | 描 述 |
| --- | --- |
| 图形ID | 必需的 ； 整数型。 |
| 宽度 | 必需的 ； 整数型。单位为像素。 |
| 填充类型ID | 必需的 ； 整数型。实心填充类型无效。 |
| 类型 | 必需的 ； SWF_线类型。 |
| 线类型斜接处长度 | 必需的 ； 小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_移除

- 原文链接：https://esdn.ijingyi.com/title-41078.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_移除 （ 实例ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 移除一个实例，成功返回真；如果该ID不是实例ID或者该实例ID已经被移除，返回假。被移除的实例在后续帧中将不再显示。参看“SWF_影片_添加物体”和“SWF_影片_移除实例”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_移除 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
移除一个实例，成功返回真；如果该ID不是实例ID或者该实例ID已经被移除，返回假。被移除的实例在后续帧中将不再显示。参看“SWF_影片_添加物体”和“SWF_影片_移除实例”。

*语法：*  逻辑型  SWF_实例_移除 （实例ID）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_定义遮罩层

- 原文链接：https://esdn.ijingyi.com/title-41079.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_定义遮罩层 （ 实例ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 把指定的实例定义为一个遮罩层，该遮罩层遮挡住了在其上方的其它实例，它的内容可以是按钮、影片剪辑、图形、位图等，遮罩层在播放时是不可见的，被遮罩的实例只能透过遮罩层的区域被看到。如果想取消该遮罩层，可以用“SWF_实例_置遮罩级别”，把遮罩级别设为0即可。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_定义遮罩层 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
把指定的实例定义为一个遮罩层，该遮罩层遮挡住了在其上方的其它实例，它的内容可以是按钮、影片剪辑、图形、位图等，遮罩层在播放时是不可见的，被遮罩的实例只能透过遮罩层的区域被看到。如果想取消该遮罩层，可以用“SWF_实例_置遮罩级别”，把遮罩级别设为0即可。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_定义遮罩层 （实例ID）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_移动

- 原文链接：https://esdn.ijingyi.com/title-41080.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_移动 （ 实例ID ， X ， Y ）
- 功能说明：为高级用户提供，初级用户无需掌握； 该实例移动到指定位置，单位为像素。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| X | 必填 | 双精度小数型 | 单位为像素。 |
| Y | 必填 | 双精度小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_移动 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
该实例移动到指定位置，单位为像素。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_移动 （实例ID， X， Y）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| X | 必需的 ； 双精度小数型。单位为像素。 |
| Y | 必需的 ； 双精度小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_旋转

- 原文链接：https://esdn.ijingyi.com/title-41081.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_旋转 （ 实例ID ， 角度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 该实例旋转到指定角度，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 角度 | 必填 | 双精度小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_旋转 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
该实例旋转到指定角度，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_旋转 （实例ID， 角度）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 角度 | 必需的 ； 双精度小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_缩放

- 原文链接：https://esdn.ijingyi.com/title-41082.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_缩放 （ 实例ID ， 横向缩放比例 ， 纵向缩放比例 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 该实例缩放到指定比例，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 横向缩放比例 | 必填 | 双精度小数型，初始值为“1” | 取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。默认为1。 |
| 纵向缩放比例 | 必填 | 双精度小数型，初始值为“1” | 取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。默认为1。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_缩放 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
该实例缩放到指定比例，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_缩放 （实例ID， 横向缩放比例， 纵向缩放比例）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 横向缩放比例 | 必需的 ； 双精度小数型，初始值为“1”。取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。默认为1。 |
| 纵向缩放比例 | 必需的 ； 双精度小数型，初始值为“1”。取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。默认为1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_倾斜

- 原文链接：https://esdn.ijingyi.com/title-41083.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_倾斜 （ 实例ID ， ［ X倾斜系数 ］ ， ［ Y倾斜系数 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| X倾斜系数 | 可空 | 双精度小数型 | 为空表示不改变X轴的倾斜系数。 |
| Y倾斜系数 | 可空 | 双精度小数型 | 为空表示不改变Y轴的倾斜系数。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_倾斜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_倾斜 （实例ID， ［X倾斜系数］， ［Y倾斜系数］）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| X倾斜系数 | 可选的 ； 双精度小数型。为空表示不改变X轴的倾斜系数。 |
| Y倾斜系数 | 可选的 ； 双精度小数型。为空表示不改变Y轴的倾斜系数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_取位置

- 原文链接：https://esdn.ijingyi.com/title-41084.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_取位置 （ 实例ID ， X ， Y ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过参数返回实例所在位置的横纵坐标，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| X | 必填 | 双精度小数型，参数数据只能提供变量 |  |
| Y | 必填 | 双精度小数型，参数数据只能提供变量 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_取位置 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
通过参数返回实例所在位置的横纵坐标，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_取位置 （实例ID， X， Y）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| X | 必需的 ； 双精度小数型，参数数据只能提供变量。 |
| Y | 必需的 ； 双精度小数型，参数数据只能提供变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_取旋转角度

- 原文链接：https://esdn.ijingyi.com/title-41085.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_取旋转角度 （ 实例ID ， 旋转的角度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过参数返回实例旋转的角度，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 旋转的角度 | 必填 | 双精度小数型，参数数据只能提供变量 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_取旋转角度 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
通过参数返回实例旋转的角度，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_取旋转角度 （实例ID， 旋转的角度）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 旋转的角度 | 必需的 ； 双精度小数型，参数数据只能提供变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_取缩放比例

- 原文链接：https://esdn.ijingyi.com/title-41086.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_取缩放比例 （ 实例ID ， 水平缩放 ， 竖直缩放 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过参数返回实例所在位置的横纵坐标，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 水平缩放 | 必填 | 双精度小数型，参数数据只能提供变量 |  |
| 竖直缩放 | 必填 | 双精度小数型，参数数据只能提供变量 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_取缩放比例 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
通过参数返回实例所在位置的横纵坐标，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_取缩放比例 （实例ID， 水平缩放， 竖直缩放）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 水平缩放 | 必需的 ； 双精度小数型，参数数据只能提供变量。 |
| 竖直缩放 | 必需的 ； 双精度小数型，参数数据只能提供变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_取倾斜值

- 原文链接：https://esdn.ijingyi.com/title-41087.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_取倾斜值 （ 实例ID ， X倾斜系数 ， X倾斜系数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过参数返回实例所在位置的横纵倾斜系数，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| X倾斜系数 | 必填 | 双精度小数型，参数数据只能提供变量 |  |
| X倾斜系数 | 必填 | 双精度小数型，参数数据只能提供变量 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_取倾斜值 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
通过参数返回实例所在位置的横纵倾斜系数，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_取倾斜值 （实例ID， X倾斜系数， X倾斜系数）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| X倾斜系数 | 必需的 ； 双精度小数型，参数数据只能提供变量。 |
| X倾斜系数 | 必需的 ； 双精度小数型，参数数据只能提供变量。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_取所在层

- 原文链接：https://esdn.ijingyi.com/title-41088.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：整数型
- 语法：整数型 SWF_实例_取所在层 （ 实例ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 取该实例所在的层数，它表明了一种上下的关系，层数越高,它就越在上面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_取所在层 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
取该实例所在的层数，它表明了一种上下的关系，层数越高,它就越在上面。

*语法：*  整数型  SWF_实例_取所在层 （实例ID）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_置所在层

- 原文链接：https://esdn.ijingyi.com/title-41089.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_置所在层 （ 实例ID ， 层数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 置该实例所在的层数，它表明了一种上下的关系，层数越高,它就越在上面。如果层数改变的值与其他物体同层了，此时又分两种情况：如果从高层往低层设置，则后设置的物体在同层的其他物体下方显示；如果从低层往高层设置，则后设置的物体在其他同层物体的上方显示。可参考例程效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 层数 | 必填 | 整数型 | 层数为大于0的整数，如果该按钮记录与其他按钮记录有重叠，则此时该层数起作用。层数越大的按钮记录越在上面显示。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_置所在层 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
置该实例所在的层数，它表明了一种上下的关系，层数越高,它就越在上面。如果层数改变的值与其他物体同层了，此时又分两种情况：如果从高层往低层设置，则后设置的物体在同层的其他物体下方显示；如果从低层往高层设置，则后设置的物体在其他同层物体的上方显示。可参考例程效果。

*语法：*  逻辑型  SWF_实例_置所在层 （实例ID， 层数）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 层数 | 必需的 ； 整数型。层数为大于0的整数，如果该按钮记录与其他按钮记录有重叠，则此时该层数起作用。层数越大的按钮记录越在上面显示。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_置名称

- 原文链接：https://esdn.ijingyi.com/title-41090.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_置名称 （ 实例ID ， 名称 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为这个实例设置一个名称，该名称用于ActionScript中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 名称 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_置名称 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
为这个实例设置一个名称，该名称用于ActionScript中。

*语法：*  逻辑型  SWF_实例_置名称 （实例ID， 名称）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 名称 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_置遮罩级别

- 原文链接：https://esdn.ijingyi.com/title-41091.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_置遮罩级别 （ 实例ID ， 遮罩级别 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为设置为遮罩层的实例设置遮罩的级别，如果级别设为2则表示在该遮罩层上面2层之内（包括第2层）的所有实例都被遮盖了，而在其上方的第3层及其以上的层面均不能被遮盖，依此类推。该方法用在“SWF_实例_定义遮罩层”之后使用。如果想取消该遮罩层，可以把遮罩级别设为0即可。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 遮罩级别 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_置遮罩级别 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
为设置为遮罩层的实例设置遮罩的级别，如果级别设为2则表示在该遮罩层上面2层之内（包括第2层）的所有实例都被遮盖了，而在其上方的第3层及其以上的层面均不能被遮盖，依此类推。该方法用在“SWF_实例_定义遮罩层”之后使用。如果想取消该遮罩层，可以把遮罩级别设为0即可。

*语法：*  逻辑型  SWF_实例_置遮罩级别 （实例ID， 遮罩级别）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 遮罩级别 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_置形变率

- 原文链接：https://esdn.ijingyi.com/title-41092.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_置形变率 （ 实例ID ， 形变率 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 仅对实例为形变有效，用来设置其形变率(取值范围：0~1.0)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 形变率 | 必填 | 小数型 | 有效范围：0~1.0，如果超出这个范围，系统默认把小于0的数作为0来处理，大于1的数作为1来处理。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_置形变率 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
仅对实例为形变有效，用来设置其形变率(取值范围：0~1.0)。

*语法：*  逻辑型  SWF_实例_置形变率 （实例ID， 形变率）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 形变率 | 必需的 ； 小数型。有效范围：0~1.0，如果超出这个范围，系统默认把小于0的数作为0来处理，大于1的数作为1来处理。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_添加动作

- 原文链接：https://esdn.ijingyi.com/title-41093.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_添加动作 （ 实例ID ， 动作ID ， 动作标志 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 对指定的实例添加一个动作。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 动作ID | 必填 | 整数型 |  |
| 动作标志 | 必填 | SWF_动作标志 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_添加动作 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
对指定的实例添加一个动作。

*语法：*  逻辑型  SWF_实例_添加动作 （实例ID， 动作ID， 动作标志）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 动作ID | 必需的 ； 整数型。 |
| 动作标志 | 必需的 ； SWF_动作标志。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_允许缓存

- 原文链接：https://esdn.ijingyi.com/title-41094.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_允许缓存 （ 实例ID ， 值 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 若参数传入真，则 Flash Player 将缓存显示对象的内部位图表示形式，否则不会创建内部位图。该缓存可以提高包含复杂矢量内容的显示对象的性能。此方法要求版本为8(包括8)以后的版本。 详细说明参见：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/display/DisplayObject.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 值 | 必填 | 逻辑型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_允许缓存 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
若参数传入真，则 Flash Player 将缓存显示对象的内部位图表示形式，否则不会创建内部位图。该缓存可以提高包含复杂矢量内容的显示对象的性能。此方法要求版本为8(包括8)以后的版本。 详细说明参见：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/display/DisplayObject.html。

*语法：*  逻辑型  SWF_实例_允许缓存 （实例ID， 值）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 值 | 必需的 ； 逻辑型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_置混合模式

- 原文链接：https://esdn.ijingyi.com/title-41095.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_置混合模式 （ 实例ID ， 混合模式 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 为该实例指定要使用的混合模式，该方法是对该实例与其下方的其他实例混合效果的设置。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 混合模式 | 必填 | SWF_混合模式 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_置混合模式 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
为该实例指定要使用的混合模式，该方法是对该实例与其下方的其他实例混合效果的设置。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_置混合模式 （实例ID， 混合模式）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 混合模式 | 必需的 ； SWF_混合模式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_实例_添加滤镜

- 原文链接：https://esdn.ijingyi.com/title-41096.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：实例
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_实例_添加滤镜 （ 实例ID ， 滤镜ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 实例ID | 必填 | 整数型 |  |
| 滤镜ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_实例_添加滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[实例](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct5.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_实例_添加滤镜 （实例ID， 滤镜ID）

| 参数名 | 描 述 |
| --- | --- |
| 实例ID | 必需的 ； 整数型。 |
| 滤镜ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41097.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：整数型
- 语法：整数型 SWF_声音_从文件创建 （ 文件路径 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的声音，返回新建的声音ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件路径 | 必填 | 文本型 | 此处为mp3文件或flv文件，注意的是MP3文件(及flv文件转换前的文件)必须为 MPEG 2/Layer 3 格式。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的声音，返回新建的声音ID。

*语法：*  整数型  SWF_声音_从文件创建 （文件路径）

| 参数名 | 描 述 |
| --- | --- |
| 文件路径 | 必需的 ； 文本型。此处为mp3文件或flv文件，注意的是MP3文件(及flv文件转换前的文件)必须为 MPEG 2/Layer 3 格式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41098.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：整数型
- 语法：整数型 SWF_声音_从字节集创建 （ 数据 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的声音，返回新建的声音ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数据 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的声音，返回新建的声音ID。

*语法：*  整数型  SWF_声音_从字节集创建 （数据）

| 参数名 | 描 述 |
| --- | --- |
| 数据 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音_从声音流创建

- 原文链接：https://esdn.ijingyi.com/title-41099.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：整数型
- 语法：整数型 SWF_声音_从声音流创建 （ 声音流ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的声音，返回新建的声音ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声音流ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音_从声音流创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的声音，返回新建的声音ID。

*语法：*  整数型  SWF_声音_从声音流创建 （声音流ID）

| 参数名 | 描 述 |
| --- | --- |
| 声音流ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音_销毁

- 原文链接：https://esdn.ijingyi.com/title-41100.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_声音_销毁 （ 声音ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁声音，成功返回真；如果该ID不是声音ID或者该声音ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声音ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
销毁声音，成功返回真；如果该ID不是声音ID或者该声音ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_声音_销毁 （声音ID）

| 参数名 | 描 述 |
| --- | --- |
| 声音ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音实例_销毁

- 原文链接：https://esdn.ijingyi.com/title-41101.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_声音实例_销毁 （ 声音实例ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声音实例ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音实例_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_声音实例_销毁 （声音实例ID）

| 参数名 | 描 述 |
| --- | --- |
| 声音实例ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音流_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41102.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：整数型
- 语法：整数型 SWF_声音流_从文件创建 （ 文件路径 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的声音流，返回新建的声音流ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件路径 | 必填 | 文本型 | 此处为mp3文件或flv文件，注意的是MP3文件(及flv文件转换前的文件)必须为 MPEG 2/Layer 3 格式。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音流_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的声音流，返回新建的声音流ID。

*语法：*  整数型  SWF_声音流_从文件创建 （文件路径）

| 参数名 | 描 述 |
| --- | --- |
| 文件路径 | 必需的 ； 文本型。此处为mp3文件或flv文件，注意的是MP3文件(及flv文件转换前的文件)必须为 MPEG 2/Layer 3 格式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音流_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41103.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：整数型
- 语法：整数型 SWF_声音流_从字节集创建 （ 数据 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的声音流，返回新建的声音流ID。注意的是源文件必须为 MPEG 2/Layer 3 格式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 数据 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音流_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的声音流，返回新建的声音流ID。注意的是源文件必须为 MPEG 2/Layer 3 格式。

*语法：*  整数型  SWF_声音流_从字节集创建 （数据）

| 参数名 | 描 述 |
| --- | --- |
| 数据 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_声音流_销毁

- 原文链接：https://esdn.ijingyi.com/title-41104.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：声音
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_声音流_销毁 （ 声音流ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁声音流，成功返回真；如果该ID不是声音流ID或者该声音流ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声音流ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_声音流_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct6.htm)

为高级用户提供，初级用户无需掌握；
销毁声音流，成功返回真；如果该ID不是声音流ID或者该声音流ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_声音流_销毁 （声音流ID）

| 参数名 | 描 述 |
| --- | --- |
| 声音流ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_字体_创建

- 原文链接：https://esdn.ijingyi.com/title-41105.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：字体
- 返回值类型：整数型
- 语法：整数型 SWF_字体_创建 （ 字体文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建字体，并返回字体ID。注意：在某平台上创建的字体可能会在另一个平台上不能很好地显示，浏览Flash影片的人必须在电脑上安装了这种字体才能很好地显示。创建中文字体时较慢且占用较大的内存。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字体文件名 | 必填 | 文本型 | 该文件为.TTF或.FDB（Font definition block）文件。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_字体_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[字体](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct7.htm)

为高级用户提供，初级用户无需掌握；
创建字体，并返回字体ID。注意：在某平台上创建的字体可能会在另一个平台上不能很好地显示，浏览Flash影片的人必须在电脑上安装了这种字体才能很好地显示。创建中文字体时较慢且占用较大的内存。

*语法：*  整数型  SWF_字体_创建 （字体文件名）

| 参数名 | 描 述 |
| --- | --- |
| 字体文件名 | 必需的 ； 文本型。该文件为.TTF或.FDB（Font definition block）文件。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_字体_销毁

- 原文链接：https://esdn.ijingyi.com/title-41106.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：字体
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_字体_销毁 （ 字体ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字体ID | 必填 | 整数型 | 销毁字体，成功返回真；如果该ID不是字体ID或者该字体ID已经被销毁，返回假。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_字体_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[字体](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct7.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_字体_销毁 （字体ID）

| 参数名 | 描 述 |
| --- | --- |
| 字体ID | 必需的 ； 整数型。销毁字体，成功返回真；如果该ID不是字体ID或者该字体ID已经被销毁，返回假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_字体_取文本宽度

- 原文链接：https://esdn.ijingyi.com/title-41107.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：字体
- 返回值类型：小数型
- 语法：小数型 SWF_字体_取文本宽度 （ 字体ID ， 文本 ， 状态 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 使用当前字体的比例计算文本宽度，返回值以像素为单位。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字体ID | 必填 | 整数型 |  |
| 文本 | 必填 | 文本型 |  |
| 状态 | 必填 | 逻辑型，参数数据只能提供变量 | 该方法执行成功返回真，失败返回假。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_字体_取文本宽度 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[字体](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct7.htm)

为高级用户提供，初级用户无需掌握；
使用当前字体的比例计算文本宽度，返回值以像素为单位。

*语法：*  小数型  SWF_字体_取文本宽度 （字体ID， 文本， 状态）

| 参数名 | 描 述 |
| --- | --- |
| 字体ID | 必需的 ； 整数型。 |
| 文本 | 必需的 ； 文本型。 |
| 状态 | 必需的 ； 逻辑型，参数数据只能提供变量。该方法执行成功返回真，失败返回假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_创建

- 原文链接：https://esdn.ijingyi.com/title-41108.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：整数型
- 语法：整数型 SWF_编辑框_创建 （ ［ 内容 ］ ， ［ 字体名称 ］ ， ［ 高度 ］ ， ［ RGB颜色 ］ ， ［ 属性 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的编辑框，返回新建的编辑框ID，同时该ID也可作为“物体ID”使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 内容 | 可空 | 文本型 | 目前只支持在版本5及以下版本设置中文内容。 |
| 字体名称 | 可空 | 文本型 | 指定Flash设备字体名称。包含三种设备字体：“_sans”（类似Helvetica Arial字体）、“_serif”（类似Times Roman字体）、“_typewriter”（类似Courier字体）。当你设定为这些字体时，Flash播放器就会使用机器上同设备字体最接近的字体来显示文本。设备字体常用于较大的不想消除锯齿的文本块。 |
| 高度 | 可空 | 小数型 | 设置内容高度，单位为像素。 |
| RGB颜色 | 可空 | 整数型 | 编辑框内容的颜色，默认为黑色。 |
| 属性 | 可空 | SWF_编辑框属性 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的编辑框，返回新建的编辑框ID，同时该ID也可作为“物体ID”使用。

*语法：*  整数型  SWF_编辑框_创建 （［内容］， ［字体名称］， ［高度］， ［RGB颜色］， ［属性］）

| 参数名 | 描 述 |
| --- | --- |
| 内容 | 可选的 ； 文本型。目前只支持在版本5及以下版本设置中文内容。 |
| 字体名称 | 可选的 ； 文本型。指定Flash设备字体名称。包含三种设备字体：“_sans”（类似Helvetica Arial字体）、“_serif”（类似Times Roman字体）、“_typewriter”（类似Courier字体）。当你设定为这些字体时，Flash播放器就会使用机器上同设备字体最接近的字体来显示文本。设备字体常用于较大的不想消除锯齿的文本块。 |
| 高度 | 可选的 ； 小数型。设置内容高度，单位为像素。 |
| RGB颜色 | 可选的 ； 整数型。编辑框内容的颜色，默认为黑色。 |
| 属性 | 可选的 ； SWF_编辑框属性。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_销毁

- 原文链接：https://esdn.ijingyi.com/title-41109.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_销毁 （ 编辑框ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁编辑框，成功返回真；如果该ID不是编辑框ID或者该编辑框ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
销毁编辑框，成功返回真；如果该ID不是编辑框ID或者该编辑框ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_编辑框_销毁 （编辑框ID）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置尺寸

- 原文链接：https://esdn.ijingyi.com/title-41110.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置尺寸 （ 编辑框ID ， 宽度 ， 高度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 置编辑框的宽度与高度，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 宽度 | 必填 | 小数型 | 单位为像素。 |
| 高度 | 必填 | 小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置尺寸 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
置编辑框的宽度与高度，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置尺寸 （编辑框ID， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 宽度 | 必需的 ； 小数型。单位为像素。 |
| 高度 | 必需的 ； 小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置名称

- 原文链接：https://esdn.ijingyi.com/title-41111.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置名称 （ 编辑框ID ， 名称 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置该编辑框的脚本名称，通过“动作”来创建脚本代码，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 名称 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置名称 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
设置该编辑框的脚本名称，通过“动作”来创建脚本代码，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置名称 （编辑框ID， 名称）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 名称 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置两侧空白宽度

- 原文链接：https://esdn.ijingyi.com/title-41112.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置两侧空白宽度 （ 编辑框ID ， ［ 左侧空白宽度 ］ ， ［ 右侧空白宽度 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置左右两侧边框与内容之间的空白宽度，成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 左侧空白宽度 | 可空 | 小数型 | 单位为像素。 |
| 右侧空白宽度 | 可空 | 小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置两侧空白宽度 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
设置左右两侧边框与内容之间的空白宽度，成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置两侧空白宽度 （编辑框ID， ［左侧空白宽度］， ［右侧空白宽度］）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 左侧空白宽度 | 可选的 ； 小数型。单位为像素。 |
| 右侧空白宽度 | 可选的 ； 小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置行间距

- 原文链接：https://esdn.ijingyi.com/title-41113.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置行间距 （ 编辑框ID ， 行间距 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置在多行显示内容时，行之间的间距。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 行间距 | 必填 | 小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置行间距 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
设置在多行显示内容时，行之间的间距。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置行间距 （编辑框ID， 行间距）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 行间距 | 必需的 ； 小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置内边距

- 原文链接：https://esdn.ijingyi.com/title-41114.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置内边距 （ 编辑框ID ， 内边距 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 设置内边距(padding)，即边界与内容之间的空间。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 内边距 | 必填 | 小数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置内边距 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
设置内边距(padding)，即边界与内容之间的空间。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置内边距 （编辑框ID， 内边距）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 内边距 | 必需的 ； 小数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框_置对齐方式

- 原文链接：https://esdn.ijingyi.com/title-41115.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：编辑框
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_编辑框_置对齐方式 （ 编辑框ID ， 对齐方式 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |
| 对齐方式 | 必填 | SWF_编辑框对齐方式 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框_置对齐方式 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[编辑框](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct8.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_编辑框_置对齐方式 （编辑框ID， 对齐方式）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |
| 对齐方式 | 必需的 ； SWF_编辑框对齐方式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_标签_创建

- 原文链接：https://esdn.ijingyi.com/title-41116.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：标签
- 返回值类型：整数型
- 语法：整数型 SWF_标签_创建 （ 内容 ， 字体ID ， ［ 颜色 ］ ， ［ 透明度 ］ ， ［ 高度 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个新的标签，返回新建的标签ID，同时该ID也可作为“物体ID”使用。创建后标签默认位置在(0, 0)，可以在调用“SWF_影片_添加物体”时调整位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 内容 | 必填 | 文本型 | 标签显示的内容。 |
| 字体ID | 必填 | 整数型 | 必须指定有效的标签内容字体ID，如果该字体为英文字体且标签内容为中文则无法显示。 |
| 颜色 | 可空 | 整数型 | 标签内容的颜色，默认为黑色。 |
| 透明度 | 可空 | 字节型 | 标签内容透明度，取值在0 ~ 255 之间(0 表示完全透明，255 表示完全不透明), 默认值为255。 |
| 高度 | 可空 | 小数型 | 设置标签高度，同时内容也会按比例变化。单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_标签_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[标签](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct9.htm)

为高级用户提供，初级用户无需掌握；
创建一个新的标签，返回新建的标签ID，同时该ID也可作为“物体ID”使用。创建后标签默认位置在(0, 0)，可以在调用“SWF_影片_添加物体”时调整位置。

*语法：*  整数型  SWF_标签_创建 （内容， 字体ID， ［颜色］， ［透明度］， ［高度］）

| 参数名 | 描 述 |
| --- | --- |
| 内容 | 必需的 ； 文本型。标签显示的内容。 |
| 字体ID | 必需的 ； 整数型。必须指定有效的标签内容字体ID，如果该字体为英文字体且标签内容为中文则无法显示。 |
| 颜色 | 可选的 ； 整数型。标签内容的颜色，默认为黑色。 |
| 透明度 | 可选的 ； 字节型。标签内容透明度，取值在0 ~ 255 之间(0 表示完全透明，255 表示完全不透明), 默认值为255。 |
| 高度 | 可选的 ； 小数型。设置标签高度，同时内容也会按比例变化。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_标签_销毁

- 原文链接：https://esdn.ijingyi.com/title-41117.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：标签
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_标签_销毁 （ 编辑框ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁标签，成功返回真；如果该ID不是标签ID或者该标签ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 编辑框ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_标签_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[标签](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct9.htm)

为高级用户提供，初级用户无需掌握；
销毁标签，成功返回真；如果该ID不是标签ID或者该标签ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_标签_销毁 （编辑框ID）

| 参数名 | 描 述 |
| --- | --- |
| 编辑框ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_创建

- 原文链接：https://esdn.ijingyi.com/title-41118.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：整数型
- 语法：整数型 SWF_填充_创建 （ 填充类型ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； “SWF_填充”仅用于变换“SWF_图形”创建的渐变填充类型和图片填充类型，实心填充类型无效。返回填充ID，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充类型ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
“SWF_填充”仅用于变换“SWF_图形”创建的渐变填充类型和图片填充类型，实心填充类型无效。返回填充ID，失败返回0。

*语法：*  整数型  SWF_填充_创建 （填充类型ID）

| 参数名 | 描 述 |
| --- | --- |
| 填充类型ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_销毁

- 原文链接：https://esdn.ijingyi.com/title-41119.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_填充_销毁 （ 填充ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个填充，成功返回真；如果该ID不是填充ID或者该填充ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
销毁一个填充，成功返回真；如果该ID不是填充ID或者该填充ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_填充_销毁 （填充ID）

| 参数名 | 描 述 |
| --- | --- |
| 填充ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_倾斜

- 原文链接：https://esdn.ijingyi.com/title-41120.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_填充_倾斜 （ 填充ID ， ［ 横向倾斜系数 ］ ， ［ 纵向倾斜系数 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充ID | 必填 | 整数型 |  |
| 横向倾斜系数 | 可空 | 小数型 | 为空表示不改变横向倾斜系数。 |
| 纵向倾斜系数 | 可空 | 小数型 | 为空表示不改变纵向倾斜系数。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_倾斜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_填充_倾斜 （填充ID， ［横向倾斜系数］， ［纵向倾斜系数］）

| 参数名 | 描 述 |
| --- | --- |
| 填充ID | 必需的 ； 整数型。 |
| 横向倾斜系数 | 可选的 ； 小数型。为空表示不改变横向倾斜系数。 |
| 纵向倾斜系数 | 可选的 ； 小数型。为空表示不改变纵向倾斜系数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_缩放

- 原文链接：https://esdn.ijingyi.com/title-41121.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_填充_缩放 （ 填充ID ， ［ 横向缩放比例 ］ ， ［ 纵向缩放比例 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充ID | 必填 | 整数型 |  |
| 横向缩放比例 | 可空 | 小数型 | 取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。为空表示不改变横向缩放比例。 |
| 纵向缩放比例 | 可空 | 小数型 | 取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。为空表示不改变纵向缩放比例。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_缩放 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
成功返回真，失败返回假。

*语法：*  逻辑型  SWF_填充_缩放 （填充ID， ［横向缩放比例］， ［纵向缩放比例］）

| 参数名 | 描 述 |
| --- | --- |
| 填充ID | 必需的 ； 整数型。 |
| 横向缩放比例 | 可选的 ； 小数型。取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。为空表示不改变横向缩放比例。 |
| 纵向缩放比例 | 可选的 ； 小数型。取值范围大于等于0。小于1为缩小，等于1为保持原尺寸不变，大于1为放大。为空表示不改变纵向缩放比例。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_旋转

- 原文链接：https://esdn.ijingyi.com/title-41122.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_填充_旋转 （ 填充ID ， 旋转角度 ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充ID | 必填 | 整数型 |  |
| 旋转角度 | 必填 | 小数型 | 单位为度，取值范围为0到360，以向右方向为0度，以逆时针方向为正。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_旋转 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_填充_旋转 （填充ID， 旋转角度）

| 参数名 | 描 述 |
| --- | --- |
| 填充ID | 必需的 ； 整数型。 |
| 旋转角度 | 必需的 ； 小数型。单位为度，取值范围为0到360，以向右方向为0度，以逆时针方向为正。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充_移动中心点

- 原文链接：https://esdn.ijingyi.com/title-41123.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_填充_移动中心点 （ 填充ID ， 横坐标 ， 纵坐标 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 单位为像素，移动填充类型的中心点到指定位置。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 填充ID | 必填 | 整数型 |  |
| 横坐标 | 必填 | 小数型 |  |
| 纵坐标 | 必填 | 小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充_移动中心点 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
单位为像素，移动填充类型的中心点到指定位置。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_填充_移动中心点 （填充ID， 横坐标， 纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 填充ID | 必需的 ； 整数型。 |
| 横坐标 | 必需的 ； 小数型。 |
| 纵坐标 | 必需的 ； 小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充类型_创建实心填充类型

- 原文链接：https://esdn.ijingyi.com/title-41124.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：整数型
- 语法：整数型 SWF_填充类型_创建实心填充类型 （ 颜色 ， ［ 透明度 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色 | 必填 | 整数型 |  |
| 透明度 | 可空 | 字节型 | 0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充类型_创建实心填充类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

*语法：*  整数型  SWF_填充类型_创建实心填充类型 （颜色， ［透明度］）

| 参数名 | 描 述 |
| --- | --- |
| 颜色 | 必需的 ； 整数型。 |
| 透明度 | 可选的 ； 字节型。0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充类型_创建渐变填充类型

- 原文链接：https://esdn.ijingyi.com/title-41125.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：整数型
- 语法：整数型 SWF_填充类型_创建渐变填充类型 （ 渐变ID ， 填充类型 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |
| 填充类型 | 必填 | SWF_渐变填充类型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充类型_创建渐变填充类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

*语法：*  整数型  SWF_填充类型_创建渐变填充类型 （渐变ID， 填充类型）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |
| 填充类型 | 必需的 ； SWF_渐变填充类型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_填充类型_创建图片填充类型

- 原文链接：https://esdn.ijingyi.com/title-41126.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：填充
- 返回值类型：整数型
- 语法：整数型 SWF_填充类型_创建图片填充类型 （ 图片ID ， 填充类型 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 图片ID | 必填 | 整数型 | SWF_png图片ID、SWF_JPEG图片ID。 |
| 填充类型 | 必填 | SWF_图片填充类型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_填充类型_创建图片填充类型 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[填充](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct10.htm)

为高级用户提供，初级用户无需掌握；
返回填充类型ID，失败返回0。返回值供“SWF_填充_创建”和“SWF_图形_置填充类型”方法使用。

*语法：*  整数型  SWF_填充类型_创建图片填充类型 （图片ID， 填充类型）

| 参数名 | 描 述 |
| --- | --- |
| 图片ID | 必需的 ； 整数型。SWF_png图片ID、SWF_JPEG图片ID。 |
| 填充类型 | 必需的 ； SWF_图片填充类型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_创建

- 原文链接：https://esdn.ijingyi.com/title-41127.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：整数型
- 语法：整数型 SWF_渐变_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回渐变ID，失败返回0。返回值供“SWF_填充类型_创建渐变填充”方法使用。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
返回渐变ID，失败返回0。返回值供“SWF_填充类型_创建渐变填充”方法使用。

*语法：*  整数型  SWF_渐变_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_销毁

- 原文链接：https://esdn.ijingyi.com/title-41128.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_渐变_销毁 （ 渐变ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个渐变，成功返回真；如果该ID不是渐变ID或者该渐变ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
销毁一个渐变，成功返回真；如果该ID不是渐变ID或者该渐变ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_渐变_销毁 （渐变ID）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_添加控制点

- 原文链接：https://esdn.ijingyi.com/title-41129.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_渐变_添加控制点 （ 渐变ID ， 比率 ， 颜色 ， ［ 透明度 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过添加多个控制点来达到渐变的效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |
| 比率 | 必填 | 小数型 | 相对于渐变整体的颜色区域，后边控制点的比率应该大于前边控制点的比率。0到1之间的小数（包括0和1）。 |
| 颜色 | 必填 | 整数型 |  |
| 透明度 | 可空 | 字节型 | 0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_添加控制点 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
通过添加多个控制点来达到渐变的效果。

*语法：*  逻辑型  SWF_渐变_添加控制点 （渐变ID， 比率， 颜色， ［透明度］）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |
| 比率 | 必需的 ； 小数型。相对于渐变整体的颜色区域，后边控制点的比率应该大于前边控制点的比率。0到1之间的小数（包括0和1）。 |
| 颜色 | 必需的 ； 整数型。 |
| 透明度 | 可选的 ； 字节型。0到255（包括0和255）。0为完全透明，255为完全不透明。默认值为255。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_置展开模式

- 原文链接：https://esdn.ijingyi.com/title-41130.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_渐变_置展开模式 （ 渐变ID ， 展开模式 ）
- 功能说明：为高级用户提供，初级用户无需掌握； SWF版本8支持本方法。默认值为“正常”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |
| 展开模式 | 必填 | SWF_渐变展开模式 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_置展开模式 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
SWF版本8支持本方法。默认值为“正常”。

*语法：*  逻辑型  SWF_渐变_置展开模式 （渐变ID， 展开模式）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |
| 展开模式 | 必需的 ； SWF_渐变展开模式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_置插补模式

- 原文链接：https://esdn.ijingyi.com/title-41131.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_渐变_置插补模式 （ 渐变ID ， 插补模式 ）
- 功能说明：为高级用户提供，初级用户无需掌握； SWF版本8支持本方法。默认值为“衰减”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |
| 插补模式 | 必填 | SWF_渐变插补模式 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_置插补模式 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
SWF版本8支持本方法。默认值为“衰减”。

*语法：*  逻辑型  SWF_渐变_置插补模式 （渐变ID， 插补模式）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |
| 插补模式 | 必需的 ； SWF_渐变插补模式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变_置聚焦点

- 原文链接：https://esdn.ijingyi.com/title-41132.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：渐变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_渐变_置聚焦点 （ 渐变ID ， 中心点 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 中心点取值范围为-1.0到1.0，当为-1.0时中心点向放射渐变圆的左边偏移，当为0.0时是正中间，当为1.0时向右偏移。与“#SWF_渐变填充类型.放射渐变”类型不兼容，不可同时使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 |  |
| 中心点 | 必填 | 小数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变_置聚焦点 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[渐变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct11.htm)

为高级用户提供，初级用户无需掌握；
中心点取值范围为-1.0到1.0，当为-1.0时中心点向放射渐变圆的左边偏移，当为0.0时是正中间，当为1.0时向右偏移。与“#SWF_渐变填充类型.放射渐变”类型不兼容，不可同时使用。

*语法：*  逻辑型  SWF_渐变_置聚焦点 （渐变ID， 中心点）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。 |
| 中心点 | 必需的 ； 小数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_形变_创建

- 原文链接：https://esdn.ijingyi.com/title-41133.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：形变
- 返回值类型：整数型
- 语法：整数型 SWF_形变_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回形变ID，失败返回0。返回值可以作为“物体ID”使用。通过“SWF_形变_取图形1”方法取得的“图形1”绘制的图形，形变到“SWF_形变_取图形2”方法取得的“图形2”绘制的图形。“图形1”形变到“图形2”，需指定这一过程的帧数，同时需要通过“SWF_实例_置形变率”方法为每一帧指定形变率。只需要将形变ID添加到影片中即可，它包含的两个图形ID无需添加到影片中，但两个图形中都必须绘制内容。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_形变_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[形变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct12.htm)

为高级用户提供，初级用户无需掌握；
返回形变ID，失败返回0。返回值可以作为“物体ID”使用。通过“SWF_形变_取图形1”方法取得的“图形1”绘制的图形，形变到“SWF_形变_取图形2”方法取得的“图形2”绘制的图形。“图形1”形变到“图形2”，需指定这一过程的帧数，同时需要通过“SWF_实例_置形变率”方法为每一帧指定形变率。只需要将形变ID添加到影片中即可，它包含的两个图形ID无需添加到影片中，但两个图形中都必须绘制内容。

*语法：*  整数型  SWF_形变_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_形变_销毁

- 原文链接：https://esdn.ijingyi.com/title-41134.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：形变
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_形变_销毁 （ 形变ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个形变，成功返回真；如果该ID不是形变ID或者该形变ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 形变ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_形变_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[形变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct12.htm)

为高级用户提供，初级用户无需掌握；
销毁一个形变，成功返回真；如果该ID不是形变ID或者该形变ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_形变_销毁 （形变ID）

| 参数名 | 描 述 |
| --- | --- |
| 形变ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_形变_取图形1

- 原文链接：https://esdn.ijingyi.com/title-41135.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：形变
- 返回值类型：整数型
- 语法：整数型 SWF_形变_取图形1 （ 形变ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过“图形1”绘制的图形形变到“图形2”绘制的图形。返回图形ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 形变ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_形变_取图形1 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[形变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct12.htm)

为高级用户提供，初级用户无需掌握；
通过“图形1”绘制的图形形变到“图形2”绘制的图形。返回图形ID。

*语法：*  整数型  SWF_形变_取图形1 （形变ID）

| 参数名 | 描 述 |
| --- | --- |
| 形变ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_形变_取图形2

- 原文链接：https://esdn.ijingyi.com/title-41136.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：形变
- 返回值类型：整数型
- 语法：整数型 SWF_形变_取图形2 （ 形变ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 通过“图形1”绘制的图形形变到“图形2”绘制的图形。返回图形ID。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 形变ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_形变_取图形2 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[形变](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct12.htm)

为高级用户提供，初级用户无需掌握；
通过“图形1”绘制的图形形变到“图形2”绘制的图形。返回图形ID。

*语法：*  整数型  SWF_形变_取图形2 （形变ID）

| 参数名 | 描 述 |
| --- | --- |
| 形变ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_PNG图片_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41137.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：整数型
- 语法：整数型 SWF_PNG图片_从文件创建 （ 文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回PNG图片ID，失败返回0。返回值可以作为“物体ID”使用。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 仅支持png图片。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_PNG图片_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；
返回PNG图片ID，失败返回0。返回值可以作为“物体ID”使用。失败返回0。

*语法：*  整数型  SWF_PNG图片_从文件创建 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。仅支持png图片。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_PNG图片_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41138.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：整数型
- 语法：整数型 SWF_PNG图片_从字节集创建 （ 字节集数据 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回PNG图片ID，失败返回0。返回值可以作为“物体ID”使用。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字节集数据 | 必填 | 字节集 | 仅支持png图片。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_PNG图片_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；
返回PNG图片ID，失败返回0。返回值可以作为“物体ID”使用。失败返回0。

*语法：*  整数型  SWF_PNG图片_从字节集创建 （字节集数据）

| 参数名 | 描 述 |
| --- | --- |
| 字节集数据 | 必需的 ； 字节集。仅支持png图片。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_PNG图片_销毁

- 原文链接：https://esdn.ijingyi.com/title-41139.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_PNG图片_销毁 （ SWF_PNG图片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SWF_PNG图片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_PNG图片_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_PNG图片_销毁 （SWF_PNG图片ID）

| 参数名 | 描 述 |
| --- | --- |
| SWF_PNG图片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_JPEG图片_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41140.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：整数型
- 语法：整数型 SWF_JPEG图片_从文件创建 （ 文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回JPEG图片ID，失败返回0。返回值可以作为“物体ID”使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_JPEG图片_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；
返回JPEG图片ID，失败返回0。返回值可以作为“物体ID”使用。

*语法：*  整数型  SWF_JPEG图片_从文件创建 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_JPEG图片_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41141.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：整数型
- 语法：整数型 SWF_JPEG图片_从字节集创建 （ 字节集数据 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回JPEG图片ID，失败返回0。返回值可以作为“物体ID”使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字节集数据 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_JPEG图片_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；
返回JPEG图片ID，失败返回0。返回值可以作为“物体ID”使用。

*语法：*  整数型  SWF_JPEG图片_从字节集创建 （字节集数据）

| 参数名 | 描 述 |
| --- | --- |
| 字节集数据 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_JPEG图片_销毁

- 原文链接：https://esdn.ijingyi.com/title-41142.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：图片
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_JPEG图片_销毁 （ SWF_JPEG图片ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| SWF_JPEG图片ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_JPEG图片_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[图片](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct13.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_JPEG图片_销毁 （SWF_JPEG图片ID）

| 参数名 | 描 述 |
| --- | --- |
| SWF_JPEG图片ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_销毁

- 原文链接：https://esdn.ijingyi.com/title-41143.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_视频_销毁 （ 视频ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个视频，成功返回真；如果该ID不是视频ID或者该视频ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 视频ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；
销毁一个视频，成功返回真；如果该ID不是视频ID或者该视频ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_视频_销毁 （视频ID）

| 参数名 | 描 述 |
| --- | --- |
| 视频ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41144.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：整数型
- 语法：整数型 SWF_视频_从文件创建 （ 视频文件 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 仅支持视频文件(*.flv)。使用“SWF_影片_添加物体”添加到影片中，并使用“SWF_影片_置声音流”方法，向影片中添加视频中的声音数据。视频被添加到影片中后，必须向影片中添加视频帧数量的帧才能完整的在影片中播放视频。返回视频ID，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 视频文件 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；
仅支持视频文件(*.flv)。使用“SWF_影片_添加物体”添加到影片中，并使用“SWF_影片_置声音流”方法，向影片中添加视频中的声音数据。视频被添加到影片中后，必须向影片中添加视频帧数量的帧才能完整的在影片中播放视频。返回视频ID，失败返回0。

*语法：*  整数型  SWF_视频_从文件创建 （视频文件）

| 参数名 | 描 述 |
| --- | --- |
| 视频文件 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_从字节集创建

- 原文链接：https://esdn.ijingyi.com/title-41145.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：整数型
- 语法：整数型 SWF_视频_从字节集创建 （ 字节集数据 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 仅支持视频文件(*.flv)格式的数据。使用“SWF_影片_添加物体”添加到影片中，并使用“SWF_影片_置声音流”方法，向影片中添加视频中的声音数据。视频被添加到影片中后，必须向影片中添加视频帧数量的帧才能完整的在影片中播放视频。返回视频ID，失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字节集数据 | 必填 | 字节集 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_从字节集创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；
仅支持视频文件(*.flv)格式的数据。使用“SWF_影片_添加物体”添加到影片中，并使用“SWF_影片_置声音流”方法，向影片中添加视频中的声音数据。视频被添加到影片中后，必须向影片中添加视频帧数量的帧才能完整的在影片中播放视频。返回视频ID，失败返回0。

*语法：*  整数型  SWF_视频_从字节集创建 （字节集数据）

| 参数名 | 描 述 |
| --- | --- |
| 字节集数据 | 必需的 ； 字节集。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_创建

- 原文链接：https://esdn.ijingyi.com/title-41146.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：整数型
- 语法：整数型 SWF_视频_创建 （ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 可以通过本方法创建一个空视频添加到影片中，然后通过脚本来播放外部视频数据。返回视频ID，失败返回0。

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；
可以通过本方法创建一个空视频添加到影片中，然后通过脚本来播放外部视频数据。返回视频ID，失败返回0。

*语法：*  整数型  SWF_视频_创建 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_置尺寸

- 原文链接：https://esdn.ijingyi.com/title-41147.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_视频_置尺寸 （ 视频ID ， 宽度 ， 高度 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 本方法只有在视频数据是来自流媒体或RTMP时有效。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 视频ID | 必填 | 整数型 |  |
| 宽度 | 必填 | 整数型 | 单位为像素。 |
| 高度 | 必填 | 整数型 | 单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_置尺寸 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；
本方法只有在视频数据是来自流媒体或RTMP时有效。

*语法：*  逻辑型  SWF_视频_置尺寸 （视频ID， 宽度， 高度）

| 参数名 | 描 述 |
| --- | --- |
| 视频ID | 必需的 ； 整数型。 |
| 宽度 | 必需的 ； 整数型。单位为像素。 |
| 高度 | 必需的 ； 整数型。单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_取帧数量

- 原文链接：https://esdn.ijingyi.com/title-41148.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：整数型
- 语法：整数型 SWF_视频_取帧数量 （ 视频ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 视频ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_取帧数量 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  整数型  SWF_视频_取帧数量 （视频ID）

| 参数名 | 描 述 |
| --- | --- |
| 视频ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_视频_是否有音频

- 原文链接：https://esdn.ijingyi.com/title-41149.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：视频
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_视频_是否有音频 （ 视频ID ）
- 功能说明：为高级用户提供，初级用户无需掌握；

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 视频ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_视频_是否有音频 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[视频](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct14.htm)

为高级用户提供，初级用户无需掌握；

*语法：*  逻辑型  SWF_视频_是否有音频 （视频ID）

| 参数名 | 描 述 |
| --- | --- |
| 视频ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 精灵

- 原文链接：https://esdn.ijingyi.com/title-40996.html
- 功能说明：精灵 &nbsp 类别 跳至： SWF制作支持库测试版

**完整正文（站点原文转换）**

**精灵&nbsp类别**    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

---

### SWF_动作_创建

- 原文链接：https://esdn.ijingyi.com/title-41150.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：整数型
- 语法：整数型 SWF_动作_创建 （ 脚本代码 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回动作ID，本库使用ActionScript脚本。返回值可以作为“物体ID”使用。失败返回0。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 脚本代码 | 必填 | 文本型 | ActionScript脚本。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
返回动作ID，本库使用ActionScript脚本。返回值可以作为“物体ID”使用。失败返回0。

*语法：*  整数型  SWF_动作_创建 （脚本代码）

| 参数名 | 描 述 |
| --- | --- |
| 脚本代码 | 必需的 ； 文本型。ActionScript脚本。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作_从文件创建

- 原文链接：https://esdn.ijingyi.com/title-41151.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：整数型
- 语法：整数型 SWF_动作_从文件创建 （ 文件名 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回动作ID，本库使用ActionScript脚本。返回值可以作为“物体ID”使用。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | ActionScript脚本的文本文件。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_从文件创建 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
返回动作ID，本库使用ActionScript脚本。返回值可以作为“物体ID”使用。

*语法：*  整数型  SWF_动作_从文件创建 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。ActionScript脚本的文本文件。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作_编译

- 原文链接：https://esdn.ijingyi.com/title-41152.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_动作_编译 （ 动作ID ， Flash版本号 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 编译当前的脚本，成功返回真，失败返回假。可用于测试当前脚本语法是否正确。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 动作ID | 必填 | 整数型 |  |
| Flash版本号 | 必填 | 整数型 | 当前支持的Flash版本为4到9。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_编译 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
编译当前的脚本，成功返回真，失败返回假。可用于测试当前脚本语法是否正确。

*语法：*  逻辑型  SWF_动作_编译 （动作ID， Flash版本号）

| 参数名 | 描 述 |
| --- | --- |
| 动作ID | 必需的 ； 整数型。 |
| Flash版本号 | 必需的 ； 整数型。当前支持的Flash版本为4到9。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作_销毁

- 原文链接：https://esdn.ijingyi.com/title-41153.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_动作_销毁 （ 动作ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 如果已被添加到影片、影片剪辑或按钮中，将由影片、影片剪辑或按钮负责销毁本对象，无需调用此方法。销毁一个动作，成功返回真；如果该ID不是动作ID或者该动作ID已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 动作ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
如果已被添加到影片、影片剪辑或按钮中，将由影片、影片剪辑或按钮负责销毁本对象，无需调用此方法。销毁一个动作，成功返回真；如果该ID不是动作ID或者该动作ID已经被销毁，返回假。

*语法：*  逻辑型  SWF_动作_销毁 （动作ID）

| 参数名 | 描 述 |
| --- | --- |
| 动作ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作_取代码

- 原文链接：https://esdn.ijingyi.com/title-41154.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：字节集
- 语法：字节集 SWF_动作_取代码 （ 动作ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 返回编译脚本成功后的字节集指令数据。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 动作ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_取代码 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
返回编译脚本成功后的字节集指令数据。

*语法：*  字节集  SWF_动作_取代码 （动作ID）

| 参数名 | 描 述 |
| --- | --- |
| 动作ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作_置调试

- 原文链接：https://esdn.ijingyi.com/title-41155.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：动作
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_动作_置调试 （ 动作ID ， 获取调试信息 ， ［ 调试状态 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 如果设置为真，则在控制台程序下可以输出脚本代码一直到出错的地方，如果脚本代码完全正确则完全输出。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 动作ID | 必填 | 整数型 |  |
| 获取调试信息 | 必填 | 逻辑型 |  |
| 调试状态 | 可空 | 逻辑型，参数数据只能提供变量 | 返回在此之前的调试状态。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_动作_置调试 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[动作](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct16.htm)

为高级用户提供，初级用户无需掌握；
如果设置为真，则在控制台程序下可以输出脚本代码一直到出错的地方，如果脚本代码完全正确则完全输出。成功返回真，失败返回假。

*语法：*  逻辑型  SWF_动作_置调试 （动作ID， 获取调试信息， ［调试状态］）

| 参数名 | 描 述 |
| --- | --- |
| 动作ID | 必需的 ； 整数型。 |
| 获取调试信息 | 必需的 ； 逻辑型。 |
| 调试状态 | 可选的 ； 逻辑型，参数数据只能提供变量。返回在此之前的调试状态。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建模糊滤镜

- 原文链接：https://esdn.ijingyi.com/title-41156.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建模糊滤镜 （ 水平模糊量 ， 垂直模糊量 ， 执行模糊的次数 ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个Blur滤镜，该滤镜可以向实例添加模糊效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 水平模糊量 | 必填 | 小数型 | 有效值为0到255之间（包含）。 |
| 垂直模糊量 | 必填 | 小数型 | 有效值为0到255之间（包含）。 |
| 执行模糊的次数 | 必填 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建模糊滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个Blur滤镜，该滤镜可以向实例添加模糊效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建模糊滤镜 （水平模糊量， 垂直模糊量， 执行模糊的次数）

| 参数名 | 描 述 |
| --- | --- |
| 水平模糊量 | 必需的 ； 小数型。有效值为0到255之间（包含）。 |
| 垂直模糊量 | 必需的 ； 小数型。有效值为0到255之间（包含）。 |
| 执行模糊的次数 | 必需的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建斜角滤镜

- 原文链接：https://esdn.ijingyi.com/title-41157.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建斜角滤镜 （ ［ 阴影颜色 ］ ， ［ 阴影颜色透明度 ］ ， ［ 加亮颜色 ］ ， ［ 加亮颜色透明度 ］ ， ［ 水平模糊量 ］ ， ［ 垂直模糊量 ］ ， ［ 模糊次数 ］ ， ［ 角度 ］ ， ［ 距离 ］ ， ［ 强度 ］ ， ［ 类型 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个Bevel滤镜，该滤镜可以向实例添加斜角效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 阴影颜色 | 可空 | 整数型 | 默认为#黑色。 |
| 阴影颜色透明度 | 可空 | 整数型 | 有效值为0 - 255。默认为255。 |
| 加亮颜色 | 可空 | 整数型 | 默认为#白色。 |
| 加亮颜色透明度 | 可空 | 整数型 | 有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可空 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可空 | 小数型 | 以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可空 | 小数型 | 斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可空 | 小数型 | 该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可空 | SWF_滤镜模式 | 参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建斜角滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个Bevel滤镜，该滤镜可以向实例添加斜角效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建斜角滤镜 （［阴影颜色］， ［阴影颜色透明度］， ［加亮颜色］， ［加亮颜色透明度］， ［水平模糊量］， ［垂直模糊量］， ［模糊次数］， ［角度］， ［距离］， ［强度］， ［类型］）

| 参数名 | 描 述 |
| --- | --- |
| 阴影颜色 | 可选的 ； 整数型。默认为#黑色。 |
| 阴影颜色透明度 | 可选的 ； 整数型。有效值为0 - 255。默认为255。 |
| 加亮颜色 | 可选的 ； 整数型。默认为#白色。 |
| 加亮颜色透明度 | 可选的 ； 整数型。有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可选的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可选的 ； 小数型。以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可选的 ； 小数型。斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可选的 ； 小数型。该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可选的 ； SWF_滤镜模式。参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建发光滤镜

- 原文链接：https://esdn.ijingyi.com/title-41158.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建发光滤镜 （ ［ 光晕颜色 ］ ， ［ 光晕颜色透明度 ］ ， ［ 水平模糊量 ］ ， ［ 垂直模糊量 ］ ， ［ 模糊次数 ］ ， ［ 强度 ］ ， ［ 类型 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个Glow滤镜，该滤镜可以向实例添加发光效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 光晕颜色 | 可空 | 整数型 | 默认为#红色。 |
| 光晕颜色透明度 | 可空 | 整数型 | 有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可空 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 强度 | 可空 | 小数型 | 该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可空 | SWF_滤镜模式 | 参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建发光滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个Glow滤镜，该滤镜可以向实例添加发光效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建发光滤镜 （［光晕颜色］， ［光晕颜色透明度］， ［水平模糊量］， ［垂直模糊量］， ［模糊次数］， ［强度］， ［类型］）

| 参数名 | 描 述 |
| --- | --- |
| 光晕颜色 | 可选的 ； 整数型。默认为#红色。 |
| 光晕颜色透明度 | 可选的 ； 整数型。有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可选的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 强度 | 可选的 ； 小数型。该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可选的 ； SWF_滤镜模式。参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建投影滤镜

- 原文链接：https://esdn.ijingyi.com/title-41159.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建投影滤镜 （ ［ 阴影颜色 ］ ， ［ 阴影颜色透明度 ］ ， ［ 水平模糊量 ］ ， ［ 垂直模糊量 ］ ， ［ 模糊次数 ］ ， ［ 角度 ］ ， ［ 距离 ］ ， ［ 强度 ］ ， ［ 类型 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个DropShadow滤镜，该滤镜可以向实例添加投影效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 阴影颜色 | 可空 | 整数型 | 默认为#黑色。 |
| 阴影颜色透明度 | 可空 | 整数型 | 有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可空 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可空 | 小数型 | 以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可空 | 小数型 | 斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可空 | 小数型 | 该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可空 | SWF_滤镜模式 | 参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建投影滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个DropShadow滤镜，该滤镜可以向实例添加投影效果。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建投影滤镜 （［阴影颜色］， ［阴影颜色透明度］， ［水平模糊量］， ［垂直模糊量］， ［模糊次数］， ［角度］， ［距离］， ［强度］， ［类型］）

| 参数名 | 描 述 |
| --- | --- |
| 阴影颜色 | 可选的 ； 整数型。默认为#黑色。 |
| 阴影颜色透明度 | 可选的 ； 整数型。有效值为0 - 255。默认为255。 |
| 水平模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可选的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可选的 ； 小数型。以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可选的 ； 小数型。斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可选的 ； 小数型。该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可选的 ； SWF_滤镜模式。参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建渐变斜角滤镜

- 原文链接：https://esdn.ijingyi.com/title-41160.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建渐变斜角滤镜 （ 渐变ID ， ［ 水平模糊量 ］ ， ［ 垂直模糊量 ］ ， ［ 模糊次数 ］ ， ［ 角度 ］ ， ［ 距离 ］ ， ［ 强度 ］ ， ［ 类型 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个GradientBevel滤镜，成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 | 一个渐变ID，用于滤镜效果中的渐变部分。参看“渐变_创建 ”。 |
| 水平模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可空 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可空 | 小数型 | 斜角的角度。以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可空 | 小数型 | 斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可空 | 小数型 | 该值越高，压印的颜色越深，而且斜角与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可空 | SWF_滤镜模式 | 参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建渐变斜角滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个GradientBevel滤镜，成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建渐变斜角滤镜 （渐变ID， ［水平模糊量］， ［垂直模糊量］， ［模糊次数］， ［角度］， ［距离］， ［强度］， ［类型］）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。一个渐变ID，用于滤镜效果中的渐变部分。参看“渐变_创建 ”。 |
| 水平模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可选的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可选的 ； 小数型。斜角的角度。以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可选的 ； 小数型。斜角的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可选的 ； 小数型。该值越高，压印的颜色越深，而且斜角与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可选的 ； SWF_滤镜模式。参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_创建渐变发光滤镜

- 原文链接：https://esdn.ijingyi.com/title-41161.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：整数型
- 语法：整数型 SWF_滤镜_创建渐变发光滤镜 （ 渐变ID ， ［ 水平模糊量 ］ ， ［ 垂直模糊量 ］ ， ［ 模糊次数 ］ ， ［ 角度 ］ ， ［ 距离 ］ ， ［ 强度 ］ ， ［ 类型 ］ ）
- 功能说明：为高级用户提供，初级用户无需掌握； 创建一个GradientGlow滤镜。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 渐变ID | 必填 | 整数型 | 一个渐变ID，用于滤镜效果中的渐变部分。参看“渐变_创建 ”。 |
| 水平模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可空 | 小数型 | 有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可空 | 整数型 | 该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可空 | 小数型 | 以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可空 | 小数型 | 光晕的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可空 | 小数型 | 该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可空 | SWF_滤镜模式 | 参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_创建渐变发光滤镜 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
创建一个GradientGlow滤镜。成功返回新建的滤镜ID，失败返回0。参看“SWF_实例_添加滤镜”和“SWF_按钮图形实例_添加滤镜”。滤镜仅对文本、影片剪辑和按钮有效。关于滤镜请参考：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/filters/package-detail.html。

*语法：*  整数型  SWF_滤镜_创建渐变发光滤镜 （渐变ID， ［水平模糊量］， ［垂直模糊量］， ［模糊次数］， ［角度］， ［距离］， ［强度］， ［类型］）

| 参数名 | 描 述 |
| --- | --- |
| 渐变ID | 必需的 ； 整数型。一个渐变ID，用于滤镜效果中的渐变部分。参看“渐变_创建 ”。 |
| 水平模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 垂直模糊量 | 可选的 ； 小数型。有效值为0到255之间（包含）。默认值为4。 |
| 模糊次数 | 可选的 ； 整数型。该值越大模糊效果越明显，呈现速度也就越慢。一般不应超过15。默认值为1。 |
| 角度 | 可选的 ； 小数型。以度为单位。角度以水平方右方向为0度，顺时针旋转递增。默认值为45。 |
| 距离 | 可选的 ； 小数型。光晕的偏移距离。以像素为单位。有效值为0到8之间（包含）。默认值为4。 |
| 强度 | 可选的 ； 小数型。该值越高，压印的颜色越深，而且发光与背景之间的对比度也越强。有效值为0到255（包含）。默认值为1。值为0表示未应用滤镜。 |
| 类型 | 可选的 ； SWF_滤镜模式。参看“滤镜模式”。默认值为“#滤镜模式.内部”。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜_销毁

- 原文链接：https://esdn.ijingyi.com/title-41162.html
- 操作系统支持：Windows、Linux、Unix
- 所属类别：滤镜
- 返回值类型：逻辑型
- 语法：逻辑型 SWF_滤镜_销毁 （ 滤镜ID ）
- 功能说明：为高级用户提供，初级用户无需掌握； 销毁一个滤镜，成功返回真；如果该ID不是滤镜ID或者该滤镜已经被销毁，返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 滤镜ID | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜_销毁 命令**   操作系统支持：Windows、Linux、Unix    所属类别：[滤镜](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/ct17.htm)

为高级用户提供，初级用户无需掌握；
销毁一个滤镜，成功返回真；如果该ID不是滤镜ID或者该滤镜已经被销毁，返回假。

*语法：*  逻辑型  SWF_滤镜_销毁 （滤镜ID）

| 参数名 | 描 述 |
| --- | --- |
| 滤镜ID | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 其它

- 原文链接：https://esdn.ijingyi.com/title-40999.html
- 功能说明：其它 &nbsp 类别 跳至： SWF制作支持库测试版

**完整正文（站点原文转换）**

**其它&nbsp类别**    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

---

## 命令分类：其它数据类型（12 条）

### SWF_线类型

- 原文链接：https://esdn.ijingyi.com/title-41000.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：用于设置线的类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 起始端半圆形 | 待核实 | 待核实 | 常量值为 0 。设置线类型的起始端为半圆形，默认的线类型。 |
| 起始端无 | 待核实 | 待核实 | 常量值为 16384 。设置线类型的起始端为无，即平的。 |
| 起始端正方形 | 待核实 | 待核实 | 常量值为 32768 。设置线类型的起始端为正方形。 |
| 斜接处半圆形 | 待核实 | 待核实 | 常量值为 0 。设置线类型的斜接处为半圆形，默认的斜接类型。 |
| 斜接处半斜角 | 待核实 | 待核实 | 常量值为 4096 。设置线类型的斜接处为斜角。 |
| 斜接处正常 | 待核实 | 待核实 | 常量值为 8192 。设置线类型的斜接处为无。 |
| 无水平缩放 | 待核实 | 待核实 | 常量值为 1024 。 |
| 无垂直缩放 | 待核实 | 待核实 | 常量值为 512 。 |
| 隐藏的 | 待核实 | 待核实 | 常量值为 256 。 |
| 无闭合 | 待核实 | 待核实 | 常量值为 4 。 |
| 结束端半圆形 | 待核实 | 待核实 | 常量值为 0 。设置线类型的结束端为半圆形，默认的结束类型。 |
| 结束端无 | 待核实 | 待核实 | 常量值为 1 。设置线类型的结束端为无，即平的。 |
| 结束端正方形 | 待核实 | 待核实 | 常量值为 2 。设置线类型的结束端为正方形。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_线类型 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

用于设置线的类型。

| 成员 | 描 述 |
| --- | --- |
| 起始端半圆形 | 常量值为 0 。设置线类型的起始端为半圆形，默认的线类型。 |
| 起始端无 | 常量值为 16384 。设置线类型的起始端为无，即平的。 |
| 起始端正方形 | 常量值为 32768 。设置线类型的起始端为正方形。 |
| 斜接处半圆形 | 常量值为 0 。设置线类型的斜接处为半圆形，默认的斜接类型。 |
| 斜接处半斜角 | 常量值为 4096 。设置线类型的斜接处为斜角。 |
| 斜接处正常 | 常量值为 8192 。设置线类型的斜接处为无。 |
| 无水平缩放 | 常量值为 1024 。 |
| 无垂直缩放 | 常量值为 512 。 |
| 隐藏的 | 常量值为 256 。 |
| 无闭合 | 常量值为 4 。 |
| 结束端半圆形 | 常量值为 0 。设置线类型的结束端为半圆形，默认的结束类型。 |
| 结束端无 | 常量值为 1 。设置线类型的结束端为无，即平的。 |
| 结束端正方形 | 常量值为 2 。设置线类型的结束端为正方形。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变插补模式

- 原文链接：https://esdn.ijingyi.com/title-41001.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 正常 | 待核实 | 待核实 | 常量值为 0 。 |
| 线性 | 待核实 | 待核实 | 常量值为 1 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变插补模式 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 正常 | 常量值为 0 。 |
| 线性 | 常量值为 1 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变展开模式

- 原文链接：https://esdn.ijingyi.com/title-41002.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 衰减 | 待核实 | 待核实 | 常量值为 0 。 |
| 反射 | 待核实 | 待核实 | 常量值为 1 。 |
| 重复 | 待核实 | 待核实 | 常量值为 2 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变展开模式 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 衰减 | 常量值为 0 。 |
| 反射 | 常量值为 1 。 |
| 重复 | 常量值为 2 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框对齐方式

- 原文链接：https://esdn.ijingyi.com/title-41003.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 左对齐 | 待核实 | 待核实 | 常量值为 0 。 |
| 右对齐 | 待核实 | 待核实 | 常量值为 1 。 |
| 居中对齐 | 待核实 | 待核实 | 常量值为 2 。 |
| 自动调整 | 待核实 | 待核实 | 常量值为 3 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框对齐方式 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 左对齐 | 常量值为 0 。 |
| 右对齐 | 常量值为 1 。 |
| 居中对齐 | 常量值为 2 。 |
| 自动调整 | 常量值为 3 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_编辑框属性

- 原文链接：https://esdn.ijingyi.com/title-41004.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：参见： 基本数据类型

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 禁止编辑 | 待核实 | 待核实 | 常量值为 8 。 |
| 输入密码 | 待核实 | 待核实 | 常量值为 16 。字符使用星号来代替。 |
| 允许输入多行 | 待核实 | 待核实 | 常量值为 32 。 |
| 自动换行 | 待核实 | 待核实 | 常量值为 64 。 |
| 解析HTML | 待核实 | 待核实 | 常量值为 512 。解析编辑框内容中的HTML标签(部分常用标签)。 |
| 显示边框 | 待核实 | 待核实 | 常量值为 2048 。 |
| 静态文本 | 待核实 | 待核实 | 常量值为 4096 。相当于标签, 不可编辑。 |
| 自动调整大小 | 待核实 | 待核实 | 常量值为 16384 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_编辑框属性 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

| 成员 | 描 述 |
| --- | --- |
| 禁止编辑 | 常量值为 8 。 |
| 输入密码 | 常量值为 16 。字符使用星号来代替。 |
| 允许输入多行 | 常量值为 32 。 |
| 自动换行 | 常量值为 64 。 |
| 解析HTML | 常量值为 512 。解析编辑框内容中的HTML标签(部分常用标签)。 |
| 显示边框 | 常量值为 2048 。 |
| 静态文本 | 常量值为 4096 。相当于标签, 不可编辑。 |
| 自动调整大小 | 常量值为 16384 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮显示状态

- 原文链接：https://esdn.ijingyi.com/title-41005.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：该枚举常量用于“SWF_按钮_添加图形”中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 可被点击 | 待核实 | 待核实 | 常量值为 8 。只有按钮处于“可被点击”状态则该按钮才能被点击。 |
| 按下 | 待核实 | 待核实 | 常量值为 4 。只有与“可被点击”联合使用才可以达到按钮被按下的效果。 |
| 鼠标悬浮 | 待核实 | 待核实 | 常量值为 2 。只有与“可被点击”联合使用才可以达到鼠标在按钮上停留的效果。 |
| 抬起 | 待核实 | 待核实 | 常量值为 1 。只有与“可被点击”联合使用才可以达到按钮被抬起的效果。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮显示状态 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

该枚举常量用于“SWF_按钮_添加图形”中。

| 成员 | 描 述 |
| --- | --- |
| 可被点击 | 常量值为 8 。只有按钮处于“可被点击”状态则该按钮才能被点击。 |
| 按下 | 常量值为 4 。只有与“可被点击”联合使用才可以达到按钮被按下的效果。 |
| 鼠标悬浮 | 常量值为 2 。只有与“可被点击”联合使用才可以达到鼠标在按钮上停留的效果。 |
| 抬起 | 常量值为 1 。只有与“可被点击”联合使用才可以达到按钮被抬起的效果。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_按钮事件

- 原文链接：https://esdn.ijingyi.com/title-41006.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：该枚举常量用于“SWF_按钮_添加动作”及“SWF_按钮_添加声音”中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 鼠标悬浮 | 待核实 | 待核实 | 常量值为 1 。鼠标在按钮上停留。 |
| 鼠标离开 | 待核实 | 待核实 | 常量值为 2 。鼠标离开按钮。 |
| 鼠标按下 | 待核实 | 待核实 | 常量值为 4 。 |
| 鼠标抬起 | 待核实 | 待核实 | 常量值为 8 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_按钮事件 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

该枚举常量用于“SWF_按钮_添加动作”及“SWF_按钮_添加声音”中。

| 成员 | 描 述 |
| --- | --- |
| 鼠标悬浮 | 常量值为 1 。鼠标在按钮上停留。 |
| 鼠标离开 | 常量值为 2 。鼠标离开按钮。 |
| 鼠标按下 | 常量值为 4 。 |
| 鼠标抬起 | 常量值为 8 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_动作标志

- 原文链接：https://esdn.ijingyi.com/title-41007.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：该标志用于“SWF_实例_添加动作”中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 加载 | 待核实 | 待核实 | 常量值为 1 。 影片剪辑符号在时间轴中出现时触发（不管该影片剪辑是否完全调入），且只发一次。 |
| 进入某一帧 | 待核实 | 待核实 | 常量值为 2 。刚要进入某一帧时触发。 |
| 卸载 | 待核实 | 待核实 | 常量值为 4 。影片从时间轴上消失时触发。 |
| 移动鼠标 | 待核实 | 待核实 | 常量值为 8 。移动鼠标时触发。 |
| 按下鼠标 | 待核实 | 待核实 | 常量值为 16 。按下鼠标左键时触发。 |
| 放开鼠标 | 待核实 | 待核实 | 常量值为 32 。放开鼠标左键时触发。 |
| 按下某键 | 待核实 | 待核实 | 常量值为 64 。按下键盘某键时触发。 |
| 放开某键 | 待核实 | 待核实 | 常量值为 128 。放开键盘某键时触发。 |
| 加载数据 | 待核实 | 待核实 | 常量值为 256 。加载变量或加载影片时触发。 |
| 初始化 | 待核实 | 待核实 | 常量值为 512 。 |
| 单击 | 待核实 | 待核实 | 常量值为 1024 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上单击鼠标左键；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上单击鼠标左键。 |
| 放开 | 待核实 | 待核实 | 常量值为 2048 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上释放鼠标左键；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上释放鼠标左键。 |
| 移出后放开 | 待核实 | 待核实 | 常量值为 4096 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上时按下鼠标左键，然后移出按钮外后才放开；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上时按下鼠标左键，然后移到Flash影片窗口外后才放开。 |
| 移入 | 待核实 | 待核实 | 常量值为 8192 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标移入按钮；若是添加到Flash影片上，则指的是鼠标光标移入Flash影片。 |
| 移出 | 待核实 | 待核实 | 常量值为 16384 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标移出按钮；若是添加到Flash影片上，则指的是鼠标光标移出Flash影片。 |
| 拖入 | 待核实 | 待核实 | 常量值为 32768 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标拖拽移入按钮；若是添加到Flash影片上，则指的是鼠标光标拖拽移入Flash影片。 |
| 拖出 | 待核实 | 待核实 | 常量值为 65536 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标拖拽移出按钮；若是添加到Flash影片上，则指的是鼠标光标拖拽移出Flash影片。 |
| 字符输入 | 待核实 | 待核实 | 常量值为 131072 。按下键盘某个英文字母或数字键时触发。 |
| 创建 | 待核实 | 待核实 | 常量值为 262144 。创建时触发。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_动作标志 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

该标志用于“SWF_实例_添加动作”中。

| 成员 | 描 述 |
| --- | --- |
| 加载 | 常量值为 1 。 影片剪辑符号在时间轴中出现时触发（不管该影片剪辑是否完全调入），且只发一次。 |
| 进入某一帧 | 常量值为 2 。刚要进入某一帧时触发。 |
| 卸载 | 常量值为 4 。影片从时间轴上消失时触发。 |
| 移动鼠标 | 常量值为 8 。移动鼠标时触发。 |
| 按下鼠标 | 常量值为 16 。按下鼠标左键时触发。 |
| 放开鼠标 | 常量值为 32 。放开鼠标左键时触发。 |
| 按下某键 | 常量值为 64 。按下键盘某键时触发。 |
| 放开某键 | 常量值为 128 。放开键盘某键时触发。 |
| 加载数据 | 常量值为 256 。加载变量或加载影片时触发。 |
| 初始化 | 常量值为 512 。 |
| 单击 | 常量值为 1024 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上单击鼠标左键；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上单击鼠标左键。 |
| 放开 | 常量值为 2048 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上释放鼠标左键；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上释放鼠标左键。 |
| 移出后放开 | 常量值为 4096 。如果这个动作添加到按钮上，此时该动作指的是鼠标指针在按钮上时按下鼠标左键，然后移出按钮外后才放开；若是添加到Flash影片上，则指的是鼠标指针在Flash影片上时按下鼠标左键，然后移到Flash影片窗口外后才放开。 |
| 移入 | 常量值为 8192 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标移入按钮；若是添加到Flash影片上，则指的是鼠标光标移入Flash影片。 |
| 移出 | 常量值为 16384 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标移出按钮；若是添加到Flash影片上，则指的是鼠标光标移出Flash影片。 |
| 拖入 | 常量值为 32768 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标拖拽移入按钮；若是添加到Flash影片上，则指的是鼠标光标拖拽移入Flash影片。 |
| 拖出 | 常量值为 65536 。如果这个动作添加到按钮上，此时该动作指的是鼠标光标拖拽移出按钮；若是添加到Flash影片上，则指的是鼠标光标拖拽移出Flash影片。 |
| 字符输入 | 常量值为 131072 。按下键盘某个英文字母或数字键时触发。 |
| 创建 | 常量值为 262144 。创建时触发。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_混合模式

- 原文链接：https://esdn.ijingyi.com/title-41008.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：Flash影片中的实例的每个像素都应用混合模式这个属性。该枚举用于“SWF_实例_置混合模式”和“按钮记录_设置混合模式”中。关于每个模式的效果及说明请参见：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/display/DisplayObject.html 。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 一般 | 待核实 | 待核实 | 常量值为 1 。该显示对象出现在背景前面。 显示对象的像素值将覆盖背景的像素值。 在显示对象为透明的区域，背景是可见的。 |
| 图层 | 待核实 | 待核实 | 常量值为 2 。 |
| 色彩增殖 | 待核实 | 待核实 | 常量值为 3 。 |
| 萤幕 | 待核实 | 待核实 | 常量值为 4 。 |
| 变亮 | 待核实 | 待核实 | 常量值为 5 。 |
| 变暗 | 待核实 | 待核实 | 常量值为 6 。 |
| 差异 | 待核实 | 待核实 | 常量值为 7 。 |
| 增加 | 待核实 | 待核实 | 常量值为 8 。 |
| 减去 | 待核实 | 待核实 | 常量值为 9 。 |
| 反转 | 待核实 | 待核实 | 常量值为 10 。 |
| Alpha | 待核实 | 待核实 | 常量值为 11 。 |
| 擦除 | 待核实 | 待核实 | 常量值为 12 。 |
| 叠加 | 待核实 | 待核实 | 常量值为 13 。 |
| 强光 | 待核实 | 待核实 | 常量值为 14 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_混合模式 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

Flash影片中的实例的每个像素都应用混合模式这个属性。该枚举用于“SWF_实例_置混合模式”和“按钮记录_设置混合模式”中。关于每个模式的效果及说明请参见：http://livedocs.adobe.com/flash/9.0_cn/ActionScriptLangRefV3/flash/display/DisplayObject.html 。

| 成员 | 描 述 |
| --- | --- |
| 一般 | 常量值为 1 。该显示对象出现在背景前面。 显示对象的像素值将覆盖背景的像素值。 在显示对象为透明的区域，背景是可见的。 |
| 图层 | 常量值为 2 。 |
| 色彩增殖 | 常量值为 3 。 |
| 萤幕 | 常量值为 4 。 |
| 变亮 | 常量值为 5 。 |
| 变暗 | 常量值为 6 。 |
| 差异 | 常量值为 7 。 |
| 增加 | 常量值为 8 。 |
| 减去 | 常量值为 9 。 |
| 反转 | 常量值为 10 。 |
| Alpha | 常量值为 11 。 |
| 擦除 | 常量值为 12 。 |
| 叠加 | 常量值为 13 。 |
| 强光 | 常量值为 14 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_滤镜模式

- 原文链接：https://esdn.ijingyi.com/title-41009.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：用于创建滤镜。参看“SWF_滤镜_创建渐变斜角滤镜”。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 内部 | 待核实 | 待核实 | 常量值为 128 。 |
| 镂空 | 待核实 | 待核实 | 常量值为 64 。 |
| 上方 | 待核实 | 待核实 | 常量值为 16 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_滤镜模式 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

用于创建滤镜。参看“SWF_滤镜_创建渐变斜角滤镜”。

| 成员 | 描 述 |
| --- | --- |
| 内部 | 常量值为 128 。 |
| 镂空 | 常量值为 64 。 |
| 上方 | 常量值为 16 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_渐变填充类型

- 原文链接：https://esdn.ijingyi.com/title-41010.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：用于设置创建渐变填充类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 线性渐变 | 待核实 | 待核实 | 常量值为 16 。 |
| 放射渐变 | 待核实 | 待核实 | 常量值为 18 。 |
| 聚焦渐变 | 待核实 | 待核实 | 常量值为 19 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_渐变填充类型 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

用于设置创建渐变填充类型。

| 成员 | 描 述 |
| --- | --- |
| 线性渐变 | 常量值为 16 。 |
| 放射渐变 | 常量值为 18 。 |
| 聚焦渐变 | 常量值为 19 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### SWF_图片填充类型

- 原文链接：https://esdn.ijingyi.com/title-41011.html
- 操作系统支持：Windows、Linux、Unix 跳至： SWF制作支持库测试版
- 功能说明：用于设置创建图片填充类型。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 平铺的图片 | 待核实 | 待核实 | 常量值为 64 。 |
| 剪切的图片 | 待核实 | 待核实 | 常量值为 65 。 |
| 光滑平铺的图片 | 待核实 | 待核实 | 常量值为 66 。 |
| 光滑剪切的图片 | 待核实 | 待核实 | 常量值为 67 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**SWF_图片填充类型 枚举常量集合类型**   操作系统支持：Windows、Linux、Unix    跳至：[SWF制作支持库测试版](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/swfgen/index.htm)

用于设置创建图片填充类型。

| 成员 | 描 述 |
| --- | --- |
| 平铺的图片 | 常量值为 64 。 |
| 剪切的图片 | 常量值为 65 。 |
| 光滑平铺的图片 | 常量值为 66 。 |
| 光滑剪切的图片 | 常量值为 67 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
