# DirectX2D支持库 2.0 支持库手册

> 来源：[esdn.ijingyi.com 精易论坛·易语言知识库](https://esdn.ijingyi.com/title-14803.html)（《Windows平台支持库手册5.3版》）。易语言支持库文档版权归大连大有吴涛易语言软件开发有限公司所有，本手册仅为本地研发参考整理，未经授权不得对外分发。
> 采集时间：2026-09-15；版本校验：本手册采用目标网址当前版本（2.0）；开源平台未检索到版本更高的同名支持库文档（详见《易语言支持库采集与IDE封装分析汇报.md》）。

## 支持库基本介绍

**DirectX2D支持库2.0版**   [返回首页](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/index.htm)

 本支持库实现了对 DirectX 2D 的支持。

操作系统支持： Windows

**命令类别：**

| 全局命令 |  |  |  |
| --- | --- | --- | --- |

**窗口组件数据类型：**

| 输入设备 |  |  |  |
| --- | --- | --- | --- |

**其它数据类型：**

| MIDI音乐 | 屏幕 | 声音 | WAVE声音 |
| --- | --- | --- | --- |
| 页面 | 调色板单元 | 矩形 | 键值常量 |
| 声音常量 | 内存类别 |  |  |

**
例程列表：**

| 例程名称 | 下载 | 说明 |
| --- | --- | --- |
| 音乐测试 | MIDI测试.e | 显示有关DirectX支持库中有关音乐数据类型的使用方法&nbsp |
| 全屏模式 | 全屏模式例程.e | 显示DirectX支持库中创建全屏模式程序的方法。&nbsp |
| DirectX声音测试 | 声音测试.e | 显示DirectX支持库中有关声音数据类型的使用方法&nbsp |
| 控制器测试 | 控制器.e | 显示有关DirectX支持库中有关控制器的使用方法。&nbsp |
| 石头 | 石头.e | 显示如何使用DirectX支持库进行简单碰撞测试的方法&nbsp |
| 窗口模式 | 窗口模式例程.e | 显示DirectX支持库创建窗口模式程序的方法。&nbsp |
| 精灵 | 精灵.e | 显示DirectX支持库基本使用方法&nbsp |
| 页面复制 | 页面复制例程.e | 显示DirectX支持库中有关页面复制的各种方法以及各个方法产生的不同效果。&nbsp |

## 命令分类：窗口组件数据类型（39 条）

### 初始化

- 原文链接：https://esdn.ijingyi.com/title-14819.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．初始化 （ 窗口句柄 ）
- 功能说明：初始化输入设备。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 | 要获取输入设备的窗口句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd14.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“初始化”命令，使输入设备进入待工作状态。 参见 : 例程

**完整正文（站点原文转换）**

**初始化 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

初始化输入设备。

*语法：*  逻辑型  *输入设备*．初始化 （窗口句柄）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。要获取输入设备的窗口句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd14.files/image001.gif)

说明:

通过“初始化”命令，使输入设备进入待工作状态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 刷新

- 原文链接：https://esdn.ijingyi.com/title-14820.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．刷新 （ ）
- 功能说明：刷新所有输入设备的状态，在检查输入设备的状态前调用此函数。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd15.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“刷新”命令使输入设备状态更新到最新。 参见 : 例程

**完整正文（站点原文转换）**

**刷新 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

刷新所有输入设备的状态，在检查输入设备的状态前调用此函数。

*语法：*  逻辑型  *输入设备*．刷新 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd15.files/image001.gif)

说明:

通过“刷新”命令使输入设备状态更新到最新。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置控制器边界

- 原文链接：https://esdn.ijingyi.com/title-14821.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置控制器边界 （ 横向最小 ， 纵向最小 ， 横向最大 ， 纵向最大 ）
- 功能说明：设置控制器位置边界(最大值和最小值)。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向最小 | 必填 | 整数型 | 横向(X轴)的最小值。 |
| 纵向最小 | 必填 | 整数型 | 纵向(Y轴)的最小值。 |
| 横向最大 | 必填 | 整数型 | 横向(X轴)的最大值。 |
| 纵向最大 | 必填 | 整数型 | 纵向(Y轴)的最大值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd18.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置控制器边界”命令，限定控制器在移动时的范围边界。 参见 : 例程

**完整正文（站点原文转换）**

**置控制器边界 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置控制器位置边界(最大值和最小值)。

*语法：*  逻辑型  *输入设备*．置控制器边界 （横向最小， 纵向最小， 横向最大， 纵向最大）

| 参数名 | 描 述 |
| --- | --- |
| 横向最小 | 必需的 ； 整数型。横向(X轴)的最小值。 |
| 纵向最小 | 必需的 ； 整数型。纵向(Y轴)的最小值。 |
| 横向最大 | 必需的 ； 整数型。横向(X轴)的最大值。 |
| 纵向最大 | 必需的 ； 整数型。纵向(Y轴)的最大值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd18.files/image001.gif)

说明:

通过“置控制器边界”命令，限定控制器在移动时的范围边界。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置鼠标边界

- 原文链接：https://esdn.ijingyi.com/title-14822.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置鼠标边界 （ 横向最小 ， 纵向最小 ， 横向最大 ， 纵向最大 ）
- 功能说明：设置鼠标位置边界（最大值和最小值）。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向最小 | 必填 | 整数型 | 横向(X轴)的最小值。 |
| 纵向最小 | 必填 | 整数型 | 纵向(Y轴)的最小值。 |
| 横向最大 | 必填 | 整数型 | 横向(X轴)的最大值。 |
| 纵向最大 | 必填 | 整数型 | 纵向(Y轴)的最大值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd19.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置鼠标边界”命令设置鼠标移动时边界的范围。 参见 : 例程

**完整正文（站点原文转换）**

**置鼠标边界 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置鼠标位置边界（最大值和最小值）。

*语法：*  逻辑型  *输入设备*．置鼠标边界 （横向最小， 纵向最小， 横向最大， 纵向最大）

| 参数名 | 描 述 |
| --- | --- |
| 横向最小 | 必需的 ； 整数型。横向(X轴)的最小值。 |
| 纵向最小 | 必需的 ； 整数型。纵向(Y轴)的最小值。 |
| 横向最大 | 必需的 ； 整数型。横向(X轴)的最大值。 |
| 纵向最大 | 必需的 ； 整数型。纵向(Y轴)的最大值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd19.files/image001.gif)

说明:

通过“置鼠标边界”命令设置鼠标移动时边界的范围。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置鼠标灵敏度

- 原文链接：https://esdn.ijingyi.com/title-14823.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置鼠标灵敏度 （ 灵敏度 ）
- 功能说明：设置鼠标灵敏度。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 灵敏度 | 必填 | 小数型 | 鼠标的灵敏度。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd20.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置鼠标灵敏度”命令设置鼠标移动时对应移动的单位大小。 参见 : 例程

**完整正文（站点原文转换）**

**置鼠标灵敏度 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置鼠标灵敏度。

*语法：*  逻辑型  *输入设备*．置鼠标灵敏度 （灵敏度）

| 参数名 | 描 述 |
| --- | --- |
| 灵敏度 | 必需的 ； 小数型。鼠标的灵敏度。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd20.files/image001.gif)

说明:

通过“置鼠标灵敏度”命令设置鼠标移动时对应移动的单位大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置控制器灵敏度

- 原文链接：https://esdn.ijingyi.com/title-14824.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置控制器灵敏度 （ 灵敏度 ）
- 功能说明：设置控制器灵敏度。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 灵敏度 | 必填 | 小数型 | 控制器的灵敏度。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd21.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置控制器灵敏度”命令设置控制器在移动时单位距离的大小。 参见 : 例程

**完整正文（站点原文转换）**

**置控制器灵敏度 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置控制器灵敏度。

*语法：*  逻辑型  *输入设备*．置控制器灵敏度 （灵敏度）

| 参数名 | 描 述 |
| --- | --- |
| 灵敏度 | 必需的 ； 小数型。控制器的灵敏度。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd21.files/image001.gif)

说明:

通过“置控制器灵敏度”命令设置控制器在移动时单位距离的大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置鼠标有界位置

- 原文链接：https://esdn.ijingyi.com/title-14825.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置鼠标有界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：设置鼠标有边界位置,不能超过最小和最大位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd22.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置鼠标有界位置”命令，将鼠标有界位置设定到指定点。 参见 : 例程

**完整正文（站点原文转换）**

**置鼠标有界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置鼠标有边界位置,不能超过最小和最大位置。

*语法：*  逻辑型  *输入设备*．置鼠标有界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd22.files/image001.gif)

说明:

通过“置鼠标有界位置”命令，将鼠标有界位置设定到指定点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置鼠标无界位置

- 原文链接：https://esdn.ijingyi.com/title-14826.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置鼠标无界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：设置鼠标无边界位置,可以超过最小和最大位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd23.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置鼠标无界位置”命令将鼠标无界位置设定到指定点。 参见 : 例程

**完整正文（站点原文转换）**

**置鼠标无界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置鼠标无边界位置,可以超过最小和最大位置。

*语法：*  逻辑型  *输入设备*．置鼠标无界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd23.files/image001.gif)

说明:

通过“置鼠标无界位置”命令将鼠标无界位置设定到指定点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置控制器有界位置

- 原文链接：https://esdn.ijingyi.com/title-14827.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置控制器有界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：设置控制器有边界位置,不能超过最小和最大位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd24.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置控制器有界位置”命令将控制器有界位置设定到指定点。 参见 : 例程

**完整正文（站点原文转换）**

**置控制器有界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置控制器有边界位置,不能超过最小和最大位置。

*语法：*  逻辑型  *输入设备*．置控制器有界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd24.files/image001.gif)

说明:

通过“置控制器有界位置”命令将控制器有界位置设定到指定点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置控制器无界位置

- 原文链接：https://esdn.ijingyi.com/title-14828.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置控制器无界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：设置控制器无边界位置,可以超过最小和最大位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd25.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置控制器无界位置”将控制位置设定到指定点。 参见 : 例程

**完整正文（站点原文转换）**

**置控制器无界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置控制器无边界位置,可以超过最小和最大位置。

*语法：*  逻辑型  *输入设备*．置控制器无界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd25.files/image001.gif)

说明:

通过“置控制器无界位置”将控制位置设定到指定点。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取鼠标有界位置

- 原文链接：https://esdn.ijingyi.com/title-14829.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取鼠标有界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取鼠标有边界位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd26.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取鼠标有界位置”命令获得当前鼠标有界位置的坐标。 参见 : 例程

**完整正文（站点原文转换）**

**取鼠标有界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取鼠标有边界位置。

*语法：*  逻辑型  *输入设备*．取鼠标有界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd26.files/image001.gif)

说明:

通过“取鼠标有界位置”命令获得当前鼠标有界位置的坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取鼠标无界位置

- 原文链接：https://esdn.ijingyi.com/title-14830.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取鼠标无界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取鼠标无边界位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd27.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取鼠标无界位置”命令取得鼠标当前无界位置坐标。 参见 : 例程

**完整正文（站点原文转换）**

**取鼠标无界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取鼠标无边界位置。

*语法：*  逻辑型  *输入设备*．取鼠标无界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd27.files/image001.gif)

说明:

通过“取鼠标无界位置”命令取得鼠标当前无界位置坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取鼠标偏移位置

- 原文链接：https://esdn.ijingyi.com/title-14831.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取鼠标偏移位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取鼠标偏移位置,与一上次位置之差。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd28.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取鼠标偏移位置”命令，获得鼠标上次位置与当前位置的距离。 参见 : 例程

**完整正文（站点原文转换）**

**取鼠标偏移位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取鼠标偏移位置,与一上次位置之差。

*语法：*  逻辑型  *输入设备*．取鼠标偏移位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd28.files/image001.gif)

说明:

通过“取鼠标偏移位置”命令，获得鼠标上次位置与当前位置的距离。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取鼠标滚动

- 原文链接：https://esdn.ijingyi.com/title-14832.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取鼠标滚动 （ 滚动方向 ， 滚动距离 ）
- 功能说明：获取鼠标滚轮滚动值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 滚动方向 | 必填 | 整数型 | 鼠标滚轮的滚动方向,0为上，1为下。 |
| 滚动距离 | 必填 | 整数型，参数数据只能提供变量 | 鼠标滚动的距离。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd29.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取鼠标滚动”命令获取鼠标向上和向下滚动的累积位置。 参见 : 例程

**完整正文（站点原文转换）**

**取鼠标滚动 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取鼠标滚轮滚动值。

*语法：*  逻辑型  *输入设备*．取鼠标滚动 （滚动方向， 滚动距离）

| 参数名 | 描 述 |
| --- | --- |
| 滚动方向 | 必需的 ； 整数型。鼠标滚轮的滚动方向,0为上，1为下。 |
| 滚动距离 | 必需的 ； 整数型，参数数据只能提供变量。鼠标滚动的距离。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd29.files/image001.gif)

说明:

通过“取鼠标滚动”命令获取鼠标向上和向下滚动的累积位置。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取控制器有界位置

- 原文链接：https://esdn.ijingyi.com/title-14833.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取控制器有界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取控制器有边界位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd30.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取控制器有界位置”命令获取控制器当前有界位置坐标。 参见 : 例程

**完整正文（站点原文转换）**

**取控制器有界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取控制器有边界位置。

*语法：*  逻辑型  *输入设备*．取控制器有界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd30.files/image001.gif)

说明:

通过“取控制器有界位置”命令获取控制器当前有界位置坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取控制器无界位置

- 原文链接：https://esdn.ijingyi.com/title-14834.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取控制器无界位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取控制器无边界位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd31.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取控制器无界位置”命令获得控制器当前无界位置坐标。 参见 : 例程

**完整正文（站点原文转换）**

**取控制器无界位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取控制器无边界位置。

*语法：*  逻辑型  *输入设备*．取控制器无界位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd31.files/image001.gif)

说明:

通过“取控制器无界位置”命令获得控制器当前无界位置坐标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取控制器偏移位置

- 原文链接：https://esdn.ijingyi.com/title-14835.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取控制器偏移位置 （ 横向位置 ， 纵向位置 ）
- 功能说明：获取控制器偏移位置,与上一次位置之差。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横向位置 | 必填 | 整数型，参数数据只能提供变量 | 横向(X轴)的位置。 |
| 纵向位置 | 必填 | 整数型，参数数据只能提供变量 | 纵向(Y轴)的位置。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd32.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取控制器偏移位置”命令获得上次位置与当前位置的距离差。 参见 : 例程

**完整正文（站点原文转换）**

**取控制器偏移位置 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取控制器偏移位置,与上一次位置之差。

*语法：*  逻辑型  *输入设备*．取控制器偏移位置 （横向位置， 纵向位置）

| 参数名 | 描 述 |
| --- | --- |
| 横向位置 | 必需的 ； 整数型，参数数据只能提供变量。横向(X轴)的位置。 |
| 纵向位置 | 必需的 ； 整数型，参数数据只能提供变量。纵向(Y轴)的位置。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd32.files/image001.gif)

说明:

通过“取控制器偏移位置”命令获得上次位置与当前位置的距离差。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 鼠标控制面板

- 原文链接：https://esdn.ijingyi.com/title-14836.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．鼠标控制面板 （ 父窗口句柄 ）
- 功能说明：运行鼠标控制面板。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 父窗口句柄 | 必填 | 整数型，初始值为“0” | 父窗口的句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd33.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“鼠标控制面板”命令，打开系统内置鼠标控制面板。 参见 : 例程

**完整正文（站点原文转换）**

**鼠标控制面板 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

运行鼠标控制面板。

*语法：*  逻辑型  *输入设备*．鼠标控制面板 （父窗口句柄）

| 参数名 | 描 述 |
| --- | --- |
| 父窗口句柄 | 必需的 ； 整数型，初始值为“0”。父窗口的句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd33.files/image001.gif)

说明:

通过“鼠标控制面板”命令，打开系统内置鼠标控制面板。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 控制器控制面板

- 原文链接：https://esdn.ijingyi.com/title-14837.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．控制器控制面板 （ 父窗口句柄 ）
- 功能说明：控制器控制面板。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 父窗口句柄 | 必填 | 整数型，初始值为“0” | 父窗口的句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd34.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“控制器控制面板”命令，打开系统内置控制器设定面板。 参见 : 例程

**完整正文（站点原文转换）**

**控制器控制面板 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

控制器控制面板。

*语法：*  逻辑型  *输入设备*．控制器控制面板 （父窗口句柄）

| 参数名 | 描 述 |
| --- | --- |
| 父窗口句柄 | 必需的 ； 整数型，初始值为“0”。父窗口的句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd34.files/image001.gif)

说明:

通过“控制器控制面板”命令，打开系统内置控制器设定面板。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 选择输入设备

- 原文链接：https://esdn.ijingyi.com/title-14838.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．选择输入设备 （ 鼠标 ， 键盘 ， 控制器 ）
- 功能说明：选择你需要的输入设备,包括键盘，鼠标和控制器, 如果要选择设备需要在窗口的“被激活”事件中调用此函数，如果要取消设备选择需要在窗口的“被取消激活”事件中调用此函数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 鼠标 | 必填 | 逻辑型 | 是否选择鼠标。 |
| 键盘 | 必填 | 逻辑型 | 是否选择键盘。 |
| 控制器 | 必填 | 逻辑型 | 是否选择控制器。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd35.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“选择输入设备”命令，选择进行操作的设备。 参见 : 例程

**完整正文（站点原文转换）**

**选择输入设备 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

选择你需要的输入设备,包括键盘，鼠标和控制器, 如果要选择设备需要在窗口的“被激活”事件中调用此函数，如果要取消设备选择需要在窗口的“被取消激活”事件中调用此函数。

*语法：*  逻辑型  *输入设备*．选择输入设备 （鼠标， 键盘， 控制器）

| 参数名 | 描 述 |
| --- | --- |
| 鼠标 | 必需的 ； 逻辑型。是否选择鼠标。 |
| 键盘 | 必需的 ； 逻辑型。是否选择键盘。 |
| 控制器 | 必需的 ； 逻辑型。是否选择控制器。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd35.files/image001.gif)

说明:

通过“选择输入设备”命令，选择进行操作的设备。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置刷新时间

- 原文链接：https://esdn.ijingyi.com/title-14839.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置刷新时间 （ 刷新时间 ）
- 功能说明：多长时间刷新一次输入设备的状态。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 刷新时间 | 必填 | 整数型 | 刷新时间,如果本参数为0，则说明设备不需要刷新。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd38.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置刷新时间”命令，设定轮询设备状态的时间间隔。 参见 : 例程

**完整正文（站点原文转换）**

**置刷新时间 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

多长时间刷新一次输入设备的状态。

*语法：*  逻辑型  *输入设备*．置刷新时间 （刷新时间）

| 参数名 | 描 述 |
| --- | --- |
| 刷新时间 | 必需的 ； 整数型。刷新时间,如果本参数为0，则说明设备不需要刷新。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd38.files/image001.gif)

说明:

通过“置刷新时间”命令，设定轮询设备状态的时间间隔。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 控制器开始振动

- 原文链接：https://esdn.ijingyi.com/title-14840.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．控制器开始振动 （ 频率 ）
- 功能说明：控制器开始振动。注：调用此方法前必须先调用“置控制器独占”参数为真方法，将控制器制于独止模式下。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 频率 | 必填 | 整数型 | 控制器振动的频率,范围在-10000到10000之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd39.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“控制器开始振动”命令，使内置振动功能的控制开始震动。 注：振动的频率有可能会根据不同的设备效果而不同。 参见 : 例程

**完整正文（站点原文转换）**

**控制器开始振动 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

控制器开始振动。注：调用此方法前必须先调用“置控制器独占”参数为真方法，将控制器制于独止模式下。

*语法：*  逻辑型  *输入设备*．控制器开始振动 （频率）

| 参数名 | 描 述 |
| --- | --- |
| 频率 | 必需的 ； 整数型。控制器振动的频率,范围在-10000到10000之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd39.files/image001.gif)

说明:

通过“控制器开始振动”命令，使内置振动功能的控制开始震动。

注：振动的频率有可能会根据不同的设备效果而不同。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 控制器停止振动

- 原文链接：https://esdn.ijingyi.com/title-14841.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．控制器停止振动 （ ）
- 功能说明：控制器停止振动。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd40.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“控制器停止振动”命令，使振动中的控制器停止振动。 参见 : 例程

**完整正文（站点原文转换）**

**控制器停止振动 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

控制器停止振动。

*语法：*  逻辑型  *输入设备*．控制器停止振动 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd40.files/image001.gif)

说明:

通过“控制器停止振动”命令，使振动中的控制器停止振动。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置鼠标独占

- 原文链接：https://esdn.ijingyi.com/title-14842.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置鼠标独占 （ 是否独占 ）
- 功能说明：设置鼠标是否为独占模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否独占 | 必填 | 逻辑型 | 是否独占。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd41.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置鼠标独占”命令，设置是否允许程序独自占有鼠标。 参见 : 例程

**完整正文（站点原文转换）**

**置鼠标独占 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置鼠标是否为独占模式。

*语法：*  逻辑型  *输入设备*．置鼠标独占 （是否独占）

| 参数名 | 描 述 |
| --- | --- |
| 是否独占 | 必需的 ； 逻辑型。是否独占。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd41.files/image001.gif)

说明:

通过“置鼠标独占”命令，设置是否允许程序独自占有鼠标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置键盘独占

- 原文链接：https://esdn.ijingyi.com/title-14843.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置键盘独占 （ 是否独占 ）
- 功能说明：设置键盘是否为独占模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否独占 | 必填 | 逻辑型 | 是否独占。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd42.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置键盘独占”命令，设置程序是否独自占有键盘控制权。 参见 : 例程

**完整正文（站点原文转换）**

**置键盘独占 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置键盘是否为独占模式。

*语法：*  逻辑型  *输入设备*．置键盘独占 （是否独占）

| 参数名 | 描 述 |
| --- | --- |
| 是否独占 | 必需的 ； 逻辑型。是否独占。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd42.files/image001.gif)

说明:

通过“置键盘独占”命令，设置程序是否独自占有键盘控制权。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 置控制器独占

- 原文链接：https://esdn.ijingyi.com/title-14844.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．置控制器独占 （ 是否独占 ）
- 功能说明：设置控制器是否为独占模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否独占 | 必填 | 逻辑型 | 是否独占。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd43.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置控制器独占”命令，设置是否允许程序独占控制器。 参见 : 例程

**完整正文（站点原文转换）**

**置控制器独占 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

设置控制器是否为独占模式。

*语法：*  逻辑型  *输入设备*．置控制器独占 （是否独占）

| 参数名 | 描 述 |
| --- | --- |
| 是否独占 | 必需的 ； 逻辑型。是否独占。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd43.files/image001.gif)

说明:

通过“置控制器独占”命令，设置是否允许程序独占控制器。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取键状态

- 原文链接：https://esdn.ijingyi.com/title-14845.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：整数型
- 语法：整数型 输入设备 ．取键状态 （ 键值 ）
- 功能说明：获取给定一个键的状态。返回0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 键值 | 必填 | 整数型 | 要测试的键值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd46.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取键状态”命令，获得当前控制器按键状态。 参见 : 例程

**完整正文（站点原文转换）**

**取键状态 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取给定一个键的状态。返回0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。

*语法：*  整数型  *输入设备*．取键状态 （键值）

| 参数名 | 描 述 |
| --- | --- |
| 键值 | 必需的 ； 整数型。要测试的键值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd46.files/image001.gif)

说明:

通过“取键状态”命令，获得当前控制器按键状态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取鼠标灵敏值

- 原文链接：https://esdn.ijingyi.com/title-14846.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：小数型
- 语法：小数型 输入设备 ．取鼠标灵敏值 （ ）
- 功能说明：获取鼠标灵敏值。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd50.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取鼠标灵敏值”命令，获取当前鼠标每移动一下所改变的单位量。 参见 : 例程

**完整正文（站点原文转换）**

**取鼠标灵敏值 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取鼠标灵敏值。

*语法：*  小数型  *输入设备*．取鼠标灵敏值 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd50.files/image001.gif)

说明:

通过“取鼠标灵敏值”命令，获取当前鼠标每移动一下所改变的单位量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取控制器灵敏值

- 原文链接：https://esdn.ijingyi.com/title-14847.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：小数型
- 语法：小数型 输入设备 ．取控制器灵敏值 （ ）
- 功能说明：。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd51.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取控制器灵敏值”命令，获取当前控制器每移动一次所改变的单位量。 参见 : 例程

**完整正文（站点原文转换）**

**取控制器灵敏值 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

。

*语法：*  小数型  *输入设备*．取控制器灵敏值 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd51.files/image001.gif)

说明:

通过“取控制器灵敏值”命令，获取当前控制器每移动一次所改变的单位量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 是否有控制器

- 原文链接：https://esdn.ijingyi.com/title-14848.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．是否有控制器 （ ）
- 功能说明：系统中是否有控制器。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd52.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“是否有控制器”命令，检查系统内当前是否已经安装控制器类（手柄、方向盘等）设备。 参见 : 例程

**完整正文（站点原文转换）**

**是否有控制器 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

系统中是否有控制器。

*语法：*  逻辑型  *输入设备*．是否有控制器 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd52.files/image001.gif)

说明:

通过“是否有控制器”命令，检查系统内当前是否已经安装控制器类（手柄、方向盘等）设备。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 是否有鼠标

- 原文链接：https://esdn.ijingyi.com/title-14849.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．是否有鼠标 （ ）
- 功能说明：系统中是否有鼠标。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd53.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“是否有鼠标”命令，检查当前系统内是否安装了鼠标。 参见 : 例程

**完整正文（站点原文转换）**

**是否有鼠标 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

系统中是否有鼠标。

*语法：*  逻辑型  *输入设备*．是否有鼠标 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd53.files/image001.gif)

说明:

通过“是否有鼠标”命令，检查当前系统内是否安装了鼠标。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取控制器键数

- 原文链接：https://esdn.ijingyi.com/title-14850.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：整数型
- 语法：整数型 输入设备 ．取控制器键数 （ ）
- 功能说明：获取控制器中按键的个数。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd55.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取控制器键数”命令，获取当前控制器按键数量。 参见 : 例程

**完整正文（站点原文转换）**

**取控制器键数 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取控制器中按键的个数。

*语法：*  整数型  *输入设备*．取控制器键数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd55.files/image001.gif)

说明:

通过“取控制器键数”命令，获取当前控制器按键数量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 取键名

- 原文链接：https://esdn.ijingyi.com/title-14851.html
- 操作系统支持：Windows 所属对象： 输入设备
- 返回值类型：逻辑型
- 语法：逻辑型 输入设备 ．取键名 （ 键值 ， 名字 ）
- 功能说明：获取指定的键名字。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 键值 | 必填 | 整数型 | 要取的键值。 |
| 名字 | 必填 | 文本型，参数数据只能提供变量 | 返回名字。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd59.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取键名”命令，将指定的键值转换为按键的名称 ( 或字符 ) 。 参见 : 例程

**完整正文（站点原文转换）**

**取键名 方法**   操作系统支持：Windows    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)

获取指定的键名字。

*语法：*  逻辑型  *输入设备*．取键名 （键值， 名字）

| 参数名 | 描 述 |
| --- | --- |
| 键值 | 必需的 ； 整数型。要取的键值。 |
| 名字 | 必需的 ； 文本型，参数数据只能提供变量。返回名字。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd59.files/image001.gif)

说明:

通过“取键名”命令，将指定的键值转换为按键的名称(或字符)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 控制器位置改变

- 原文链接：https://esdn.ijingyi.com/title-14854.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _控制器位置改变 （ 有边界横向位置 ， 有边界纵向位置 ， 无边界横向位置 ， 无边界纵向位置 ， 横向位置偏移 ， 纵向位置偏移 ）
- 功能说明：当控制器位置改变触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 有边界横向位置 | 待核实 | 待核实 | 整数型； 参数值表示横向的有边界位置。 |
| 有边界纵向位置 | 待核实 | 待核实 | 整数型； 参数值表示有边界纵向位置。 |
| 无边界横向位置 | 待核实 | 待核实 | 整数型； 参数值表示横向的无边界位置。 |
| 无边界纵向位置 | 待核实 | 待核实 | 整数型； 参数值表示无边界纵向位置。 |
| 横向位置偏移 | 待核实 | 待核实 | 整数型； 参数值表示横向位置的偏移,与上一次位置之差。 |
| 纵向位置偏移 | 待核实 | 待核实 | 整数型； 参数值表示纵向位置的偏移,与上一次位置之差。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-0.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当系统中控制器位置被改变时，此事件被触发。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查控制器信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**控制器位置改变 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    当控制器位置改变触发此事件。

*语法：*  无返回值  _*输入设备*_控制器位置改变 （有边界横向位置， 有边界纵向位置， 无边界横向位置， 无边界纵向位置， 横向位置偏移， 纵向位置偏移）

| 参数名 | 描 述 |
| --- | --- |
| 有边界横向位置 | 整数型； 参数值表示横向的有边界位置。 |
| 有边界纵向位置 | 整数型； 参数值表示有边界纵向位置。 |
| 无边界横向位置 | 整数型； 参数值表示横向的无边界位置。 |
| 无边界纵向位置 | 整数型； 参数值表示无边界纵向位置。 |
| 横向位置偏移 | 整数型； 参数值表示横向位置的偏移,与上一次位置之差。 |
| 纵向位置偏移 | 整数型； 参数值表示纵向位置的偏移,与上一次位置之差。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-0.files/image001.gif)

说明:

当系统中控制器位置被改变时，此事件被触发。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查控制器信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 控制器按钮改变

- 原文链接：https://esdn.ijingyi.com/title-14855.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _控制器按钮改变 （ 键值 ， 键状态 ）
- 功能说明：当控制器按钮的状态改变时触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 键值 | 待核实 | 待核实 | 整数型； 参数值是“键值常量”数据类型中从“键控制器0”到“键控制器9”。 |
| 键状态 | 待核实 | 待核实 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-1.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当控制器上的按钮状态改变时，会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查控制器信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**控制器按钮改变 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    当控制器按钮的状态改变时触发此事件。

*语法：*  无返回值  _*输入设备*_控制器按钮改变 （键值， 键状态）

| 参数名 | 描 述 |
| --- | --- |
| 键值 | 整数型； 参数值是“键值常量”数据类型中从“键控制器0”到“键控制器9”。 |
| 键状态 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-1.files/image001.gif)

说明:

当控制器上的按钮状态改变时，会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查控制器信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 鼠标位置改变

- 原文链接：https://esdn.ijingyi.com/title-14856.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _鼠标位置改变 （ 有边界横向位置 ， 有边界纵向位置 ， 无边界横向位置 ， 无边界纵向位置 ， 横向位置偏移 ， 纵向位置偏移 ）
- 功能说明：当鼠标位置改变时触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 有边界横向位置 | 待核实 | 待核实 | 整数型； 参数值表示横向的有边界位置。 |
| 有边界纵向位置 | 待核实 | 待核实 | 整数型； 参数值表示有边界纵向位置。 |
| 无边界横向位置 | 待核实 | 待核实 | 整数型； 参数值表示横向的无边界位置。 |
| 无边界纵向位置 | 待核实 | 待核实 | 整数型； 参数值表示无边界纵向位置。 |
| 横向位置偏移 | 待核实 | 待核实 | 整数型； 参数值表示横向位置的偏移,与上一次位置之差。 |
| 纵向位置偏移 | 待核实 | 待核实 | 整数型； 参数值表示纵向位置的偏移,与上一次位置之差。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-2.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当鼠标位置被改变时会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**鼠标位置改变 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    当鼠标位置改变时触发此事件。

*语法：*  无返回值  _*输入设备*_鼠标位置改变 （有边界横向位置， 有边界纵向位置， 无边界横向位置， 无边界纵向位置， 横向位置偏移， 纵向位置偏移）

| 参数名 | 描 述 |
| --- | --- |
| 有边界横向位置 | 整数型； 参数值表示横向的有边界位置。 |
| 有边界纵向位置 | 整数型； 参数值表示有边界纵向位置。 |
| 无边界横向位置 | 整数型； 参数值表示横向的无边界位置。 |
| 无边界纵向位置 | 整数型； 参数值表示无边界纵向位置。 |
| 横向位置偏移 | 整数型； 参数值表示横向位置的偏移,与上一次位置之差。 |
| 纵向位置偏移 | 整数型； 参数值表示纵向位置的偏移,与上一次位置之差。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-2.files/image001.gif)

说明:

当鼠标位置被改变时会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 鼠标按键被改变

- 原文链接：https://esdn.ijingyi.com/title-14857.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _鼠标按键被改变 （ 键值 ， 键状态 ）
- 功能说明：鼠标按键被改变时触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 键值 | 待核实 | 待核实 | 整数型； 参数值是“键值常量”数据类型中从“鼠标左击”到“鼠标中键击”。 |
| 键状态 | 待核实 | 待核实 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-3.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当鼠标按键的状态被改变时，会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**鼠标按键被改变 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    鼠标按键被改变时触发此事件。

*语法：*  无返回值  _*输入设备*_鼠标按键被改变 （键值， 键状态）

| 参数名 | 描 述 |
| --- | --- |
| 键值 | 整数型； 参数值是“键值常量”数据类型中从“鼠标左击”到“鼠标中键击”。 |
| 键状态 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-3.files/image001.gif)

说明:

当鼠标按键的状态被改变时，会触发此事件。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 鼠标被滚动

- 原文链接：https://esdn.ijingyi.com/title-14858.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _鼠标被滚动 （ 滚动方向 ， 滚动距离 ）
- 功能说明：鼠标滚轮被滚动后触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 滚动方向 | 待核实 | 待核实 | 整数型； 参数值是0表示向上滚动，1表示向下滚动。 |
| 滚动距离 | 待核实 | 待核实 | 整数型； 参数值表示滚动的距离。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-4.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当鼠标滚动被滚动时，会触发此时间。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**鼠标被滚动 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    鼠标滚轮被滚动后触发此事件。

*语法：*  无返回值  _*输入设备*_鼠标被滚动 （滚动方向， 滚动距离）

| 参数名 | 描 述 |
| --- | --- |
| 滚动方向 | 整数型； 参数值是0表示向上滚动，1表示向下滚动。 |
| 滚动距离 | 整数型； 参数值表示滚动的距离。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-4.files/image001.gif)

说明:

当鼠标滚动被滚动时，会触发此时间。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查鼠标信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

### 键盘按键状态被改变

- 原文链接：https://esdn.ijingyi.com/title-14859.html
- 操作系统支持：Windows
- 返回值类型：无返回值
- 语法：无返回值 _ 输入设备 _键盘按键状态被改变 （ 键值 ， 键状态 ）
- 功能说明：键盘按键状态被改变后触发此事件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 键值 | 待核实 | 待核实 | 整数型； 参数值是“键值常量”数据类型中和键盘按键相关的值。 |
| 键状态 | 待核实 | 待核实 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-5.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 当键盘按键状态被改变时，此事件会触发。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查键盘信息间隔时间。 参见 : 例程

**完整正文（站点原文转换）**

**键盘按键状态被改变 事件**    所属对象：[输入设备](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt0.htm)
   操作系统支持：Windows

    键盘按键状态被改变后触发此事件。

*语法：*  无返回值  _*输入设备*_键盘按键状态被改变 （键值， 键状态）

| 参数名 | 描 述 |
| --- | --- |
| 键值 | 整数型； 参数值是“键值常量”数据类型中和键盘按键相关的值。 |
| 键状态 | 整数型； 参数值 0表示无状态，1表示此键被放开, 2表示此键被第一次被按下, 3表示此键一直按着。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/e0-5.files/image001.gif)

说明:

当键盘按键状态被改变时，此事件会触发。如要使用此事件，必须在此之前使用“置刷新时间”命令，来设置检查键盘信息间隔时间。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%BE%93%E5%85%A5%E8%AE%BE%E5%A4%87.e)

---

## 命令分类：其他数据类型（117 条）

### 置窗口句柄

- 原文链接：https://esdn.ijingyi.com/title-14861.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：无返回值
- 语法：无返回值 MIDI音乐 ．置窗口句柄 （ 窗口句柄 ）
- 功能说明：设置要播放MIDI音乐的窗口。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 | 要播放MIDI文件的窗口句柄。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd195.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd195.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置窗口句柄”命令，将对象的有效范围绑定到指定窗口。 参见 : 例程

**完整正文（站点原文转换）**

**置窗口句柄 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

设置要播放MIDI音乐的窗口。

*语法：*  无返回值  *MIDI音乐*．置窗口句柄 （窗口句柄）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。要播放MIDI文件的窗口句柄。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd195.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd195.files/image002.gif)

说明:

通过“置窗口句柄”命令，将对象的有效范围绑定到指定窗口。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 播放

- 原文链接：https://esdn.ijingyi.com/title-14862.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：逻辑型
- 语法：逻辑型 MIDI音乐 ．播放 （ MIDI文件名 ）
- 功能说明：播放指定的MIDI文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| MIDI文件名 | 必填 | 文本型 | 指定要播放的MIDI文件名。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd196.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd196.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“播放”命令，播放指定 MIDI 文件 ( 扩展名一般为 *.mid) 。 参见 : 例程

**完整正文（站点原文转换）**

**播放 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

播放指定的MIDI文件。

*语法：*  逻辑型  *MIDI音乐*．播放 （MIDI文件名）

| 参数名 | 描 述 |
| --- | --- |
| MIDI文件名 | 必需的 ； 文本型。指定要播放的MIDI文件名。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd196.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd196.files/image002.gif)

说明:

通过“播放”命令，播放指定MIDI文件(扩展名一般为*.mid)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 停止

- 原文链接：https://esdn.ijingyi.com/title-14863.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：逻辑型
- 语法：逻辑型 MIDI音乐 ．停止 （ ）
- 功能说明：停止当前播放的MIDI文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd197.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd197.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“停止”命令，使播放中的 MIDI 音乐停止播放。 参见 : 例程

**完整正文（站点原文转换）**

**停止 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

停止当前播放的MIDI文件。

*语法：*  逻辑型  *MIDI音乐*．停止 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd197.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd197.files/image002.gif)

说明:

通过“停止”命令，使播放中的MIDI音乐停止播放。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 暂停

- 原文链接：https://esdn.ijingyi.com/title-14864.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：逻辑型
- 语法：逻辑型 MIDI音乐 ．暂停 （ ）
- 功能说明：暂停当前播放的MIDI文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd198.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd198.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“暂停”命令，使播放中的 MIDI 音乐暂停播放，如果要继续播放，请使用“继续”命令。 参见 : 例程

**完整正文（站点原文转换）**

**暂停 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

暂停当前播放的MIDI文件。

*语法：*  逻辑型  *MIDI音乐*．暂停 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd198.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd198.files/image002.gif)

说明:

通过“暂停”命令，使播放中的MIDI音乐暂停播放，如果要继续播放，请使用“继续”命令。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 继续

- 原文链接：https://esdn.ijingyi.com/title-14865.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：逻辑型
- 语法：逻辑型 MIDI音乐 ．继续 （ ）
- 功能说明：继续播放当前被暂停的MIDI文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd199.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd199.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“继续”命令，使暂停播放状态恢复到播放状态。 参见 : 例程

**完整正文（站点原文转换）**

**继续 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

继续播放当前被暂停的MIDI文件。

*语法：*  逻辑型  *MIDI音乐*．继续 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd199.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd199.files/image002.gif)

说明:

通过“继续”命令，使暂停播放状态恢复到播放状态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 重新播放

- 原文链接：https://esdn.ijingyi.com/title-14866.html
- 操作系统支持：Windows 所属对象： MIDI音乐
- 返回值类型：逻辑型
- 语法：逻辑型 MIDI音乐 ．重新播放 （ ）
- 功能说明：重新播放MIDI文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd200.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd200.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“重新播放”命令，使播放完毕，或播放中的 MIDI 音乐重新播放。 参见 : 例程

**完整正文（站点原文转换）**

**重新播放 方法**   操作系统支持：Windows    所属对象：[MIDI音乐](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt4.htm)

重新播放MIDI文件。

*语法：*  逻辑型  *MIDI音乐*．重新播放 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd200.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd200.files/image002.gif)

说明:

通过“重新播放”命令，使播放完毕，或播放中的MIDI音乐重新播放。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 创建全屏模式

- 原文链接：https://esdn.ijingyi.com/title-14868.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．创建全屏模式 （ 窗口句柄 ， 屏幕宽度 ， 屏幕高度 ， 像素位数 ， 标志 ）
- 功能说明：初始化屏幕为全屏模式。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 | 创建全屏模式的主窗口句柄。 |
| 屏幕宽度 | 必填 | 整数型 | 全屏模式下的屏幕宽度，单位为像素。 |
| 屏幕高度 | 必填 | 整数型 | 全屏模式下的屏幕高度，单位为像素。 |
| 像素位数 | 必填 | 整数型 | 单个像素的数据长度，例如8，16，24，32等。 |
| 标志 | 必填 | 逻辑型 | 是否允许老的VGA显示模式的分辨率。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd63.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd63.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“创建全屏模式”命令，创建一个兼容指定窗口的全屏 DirectX 环境。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**创建全屏模式 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

初始化屏幕为全屏模式。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．创建全屏模式 （窗口句柄， 屏幕宽度， 屏幕高度， 像素位数， 标志）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。创建全屏模式的主窗口句柄。 |
| 屏幕宽度 | 必需的 ； 整数型。全屏模式下的屏幕宽度，单位为像素。 |
| 屏幕高度 | 必需的 ； 整数型。全屏模式下的屏幕高度，单位为像素。 |
| 像素位数 | 必需的 ； 整数型。单个像素的数据长度，例如8，16，24，32等。 |
| 标志 | 必需的 ； 逻辑型。是否允许老的VGA显示模式的分辨率。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd63.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd63.files/image002.gif)

说明:

通过“创建全屏模式”命令，创建一个兼容指定窗口的全屏DirectX环境。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 创建窗口模式

- 原文链接：https://esdn.ijingyi.com/title-14869.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．创建窗口模式 （ 窗口句柄 ， 缓冲区宽度 ， 缓冲区高度 ）
- 功能说明：初始化屏幕为窗口模式。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 | 创建全屏模式的主窗口句柄。 |
| 缓冲区宽度 | 必填 | 整数型 | 窗口模式下后台缓冲区的宽度，单位为像素。 |
| 缓冲区高度 | 必填 | 整数型 | 窗口模式下后台缓冲区的高度，单位为像素。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd64.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd64.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“创建窗口模式”命令，创建一个兼容指定窗口的 DirectX 窗口环境。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**创建窗口模式 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

初始化屏幕为窗口模式。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．创建窗口模式 （窗口句柄， 缓冲区宽度， 缓冲区高度）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。创建全屏模式的主窗口句柄。 |
| 缓冲区宽度 | 必需的 ； 整数型。窗口模式下后台缓冲区的宽度，单位为像素。 |
| 缓冲区高度 | 必需的 ； 整数型。窗口模式下后台缓冲区的高度，单位为像素。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd64.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd64.files/image002.gif)

说明:

通过“创建窗口模式”命令，创建一个兼容指定窗口的DirectX窗口环境。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 载入位图

- 原文链接：https://esdn.ijingyi.com/title-14870.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．载入位图 （ 文件名 ）
- 功能说明：将位图载入后台缓冲区。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 位图的全路径文件名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd65.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd65.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“载入位图”命令，将指定位图文件载入到屏幕中的后台缓冲页面。图片会被拉伸到页面大小。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**载入位图 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

将位图载入后台缓冲区。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．载入位图 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。位图的全路径文件名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd65.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd65.files/image002.gif)

说明:

通过“载入位图”命令，将指定位图文件载入到屏幕中的后台缓冲页面。图片会被拉伸到页面大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 载入调色板

- 原文链接：https://esdn.ijingyi.com/title-14871.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．载入调色板 （ 文件名 ）
- 功能说明：从一个位图文件中载入调色板。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 | 位图的全路径文件名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd66.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd66.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“载入调色板”命令，从一个位图文件中载入调色板数据。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**载入调色板 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

从一个位图文件中载入调色板。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．载入调色板 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。位图的全路径文件名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd66.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd66.files/image002.gif)

说明:

通过“载入调色板”命令，从一个位图文件中载入调色板数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 填充

- 原文链接：https://esdn.ijingyi.com/title-14872.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．填充 （ 颜色值 ）
- 功能说明：用特定的颜色填充后台缓冲区。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色值 | 必填 | 整数型 | 填充的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd67.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd67.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“填充”命令，用指定颜色填充屏幕的后台页面缓冲区。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**填充 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

用特定的颜色填充后台缓冲区。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．填充 （颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 颜色值 | 必需的 ； 整数型。填充的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd67.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd67.files/image002.gif)

说明:

通过“填充”命令，用指定颜色填充屏幕的后台页面缓冲区。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 交换页面

- 原文链接：https://esdn.ijingyi.com/title-14873.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．交换页面 （ 异步标志 ， 是否拉伸 ， 显示祯率 ）
- 功能说明：将后台缓冲区中的内容显示在屏幕上。成功返回真，失败返回假。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 异步标志 | 必填 | 逻辑型 | 当该值为真，则等待到系统默认的时间再交换页面，为假则立刻交换页面。 |
| 是否拉伸 | 必填 | 逻辑型 | 当处于窗口显示模式的时候，如果该值为真，则将拉伸后台缓冲页面为窗口的大小。 |
| 显示祯率 | 必填 | 逻辑型 | 是否在左上角显示每秒的显示的祯数。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd69.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd69.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“交换页面”命令，使屏幕前台页面和后台缓冲页面进行调换反转。即后台页面变为前台页面，前台页面变为后台页面。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**交换页面 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

将后台缓冲区中的内容显示在屏幕上。成功返回真，失败返回假。

*语法：*  逻辑型  *屏幕*．交换页面 （异步标志， 是否拉伸， 显示祯率）

| 参数名 | 描 述 |
| --- | --- |
| 异步标志 | 必需的 ； 逻辑型。当该值为真，则等待到系统默认的时间再交换页面，为假则立刻交换页面。 |
| 是否拉伸 | 必需的 ； 逻辑型。当处于窗口显示模式的时候，如果该值为真，则将拉伸后台缓冲页面为窗口的大小。 |
| 显示祯率 | 必需的 ； 逻辑型。是否在左上角显示每秒的显示的祯数。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd69.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd69.files/image002.gif)

说明:

通过“交换页面”命令，使屏幕前台页面和后台缓冲页面进行调换反转。即后台页面变为前台页面，前台页面变为后台页面。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 置调色板颜色

- 原文链接：https://esdn.ijingyi.com/title-14874.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．置调色板颜色 （ 颜色值 ， 红色值 ， 绿色值 ， 兰色值 ）
- 功能说明：设置当前的调色板的颜色值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色值 | 必填 | 整数型 | 欲设置调色板上的颜色值。 |
| 红色值 | 必填 | 整数型 | 欲设置的颜色值中红色的数量，取值在0到255之间。 |
| 绿色值 | 必填 | 整数型 | 欲设置的颜色值中绿色的数量，取值在0到255之间。 |
| 兰色值 | 必填 | 整数型 | 欲设置的颜色值中兰色的数量，取值在0到255之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd70.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd70.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置调色板颜色”命令，设置当前调色板的颜色值。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**置调色板颜色 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

设置当前的调色板的颜色值。

*语法：*  逻辑型  *屏幕*．置调色板颜色 （颜色值， 红色值， 绿色值， 兰色值）

| 参数名 | 描 述 |
| --- | --- |
| 颜色值 | 必需的 ； 整数型。欲设置调色板上的颜色值。 |
| 红色值 | 必需的 ； 整数型。欲设置的颜色值中红色的数量，取值在0到255之间。 |
| 绿色值 | 必需的 ； 整数型。欲设置的颜色值中绿色的数量，取值在0到255之间。 |
| 兰色值 | 必需的 ； 整数型。欲设置的颜色值中兰色的数量，取值在0到255之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd70.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd70.files/image002.gif)

说明:

通过“置调色板颜色”命令，设置当前调色板的颜色值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取调色板

- 原文链接：https://esdn.ijingyi.com/title-14875.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．取调色板 （ 开始位置 ， 数量 ， 调色板单元 ）
- 功能说明：取指定位置和数量的调色板单元。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 开始位置 | 必填 | 整数型 | 欲取调色板中单元的起始位置。 |
| 数量 | 必填 | 整数型 | 欲取调色板中单元的数量。 |
| 调色板单元 | 必填 | 调色板单元，参数数据只能提供变量数组 | 取出的调色板单元数组，作为返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取调色板”命令，取出调色板中指定位置起，指定个数调色板成员。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取调色板 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取指定位置和数量的调色板单元。

*语法：*  逻辑型  *屏幕*．取调色板 （开始位置， 数量， 调色板单元）

| 参数名 | 描 述 |
| --- | --- |
| 开始位置 | 必需的 ； 整数型。欲取调色板中单元的起始位置。 |
| 数量 | 必需的 ； 整数型。欲取调色板中单元的数量。 |
| 调色板单元 | 必需的 ； 调色板单元，参数数据只能提供变量数组。取出的调色板单元数组，作为返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd73.files/image003.gif)

说明:

通过“取调色板”命令，取出调色板中指定位置起，指定个数调色板成员。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 填充调色板

- 原文链接：https://esdn.ijingyi.com/title-14876.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．填充调色板 （ 红色值 ， 绿色值 ， 兰色值 ）
- 功能说明：填充所有的调色板为单一的颜色。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 红色值 | 必填 | 整数型 | 欲设置的颜色值中红色的数量，取值在0到255之间。 |
| 绿色值 | 必填 | 整数型 | 欲设置的颜色值中绿色的数量，取值在0到255之间。 |
| 兰色值 | 必填 | 整数型 | 欲设置的颜色值中兰色的数量，取值在0到255之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“填充调色板”命令，用指定颜色填充屏幕当前调色板。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**填充调色板 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

填充所有的调色板为单一的颜色。

*语法：*  逻辑型  *屏幕*．填充调色板 （红色值， 绿色值， 兰色值）

| 参数名 | 描 述 |
| --- | --- |
| 红色值 | 必需的 ； 整数型。欲设置的颜色值中红色的数量，取值在0到255之间。 |
| 绿色值 | 必需的 ； 整数型。欲设置的颜色值中绿色的数量，取值在0到255之间。 |
| 兰色值 | 必需的 ； 整数型。欲设置的颜色值中兰色的数量，取值在0到255之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd74.files/image003.gif)

说明:

通过“填充调色板”命令，用指定颜色填充屏幕当前调色板。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 转换调色板

- 原文链接：https://esdn.ijingyi.com/title-14877.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．转换调色板 （ ）
- 功能说明：转换当前的调色板为单色的调色板。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“转换调色板”命令，将屏幕当前调色板转换为单色。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**转换调色板 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

转换当前的调色板为单色的调色板。

*语法：*  逻辑型  *屏幕*．转换调色板 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd75.files/image003.gif)

说明:

通过“转换调色板”命令，将屏幕当前调色板转换为单色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 淡入

- 原文链接：https://esdn.ijingyi.com/title-14878.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．淡入 （ 等待时间 ， 调色板单元 ）
- 功能说明：平滑的由当前的调色板转变成为参数调色板，这个方法仅仅适合8位颜色模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等待时间 | 必填 | 整数型 | 调色板淡入过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，50大约4秒，100大约8秒。 |
| 调色板单元 | 必填 | 调色板单元，参数数据只能提供数组数据 | 欲变换成的调色板单元数组。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“淡入”命令，由当前调色板颜色淡入。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**淡入 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

平滑的由当前的调色板转变成为参数调色板，这个方法仅仅适合8位颜色模式。

*语法：*  逻辑型  *屏幕*．淡入 （等待时间， 调色板单元）

| 参数名 | 描 述 |
| --- | --- |
| 等待时间 | 必需的 ； 整数型。调色板淡入过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，50大约4秒，100大约8秒。 |
| 调色板单元 | 必需的 ； 调色板单元，参数数据只能提供数组数据。欲变换成的调色板单元数组。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd76.files/image003.gif)

说明:

通过“淡入”命令，由当前调色板颜色淡入。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 淡出

- 原文链接：https://esdn.ijingyi.com/title-14879.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．淡出 （ 等待时间 ）
- 功能说明：平滑的转变当前的调色板为黑色，这个方法仅仅适合8位颜色模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等待时间 | 必填 | 整数型 | 调色板淡出过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，25大约4秒，100大约8秒。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“淡出”命令，由当前调色板颜色平滑转到黑色。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**淡出 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

平滑的转变当前的调色板为黑色，这个方法仅仅适合8位颜色模式。

*语法：*  逻辑型  *屏幕*．淡出 （等待时间）

| 参数名 | 描 述 |
| --- | --- |
| 等待时间 | 必需的 ； 整数型。调色板淡出过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，25大约4秒，100大约8秒。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd77.files/image003.gif)

说明:

通过“淡出”命令，由当前调色板颜色平滑转到黑色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 平滑变换

- 原文链接：https://esdn.ijingyi.com/title-14880.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．平滑变换 （ 红色值 ， 绿色值 ， 兰色值 ， 等待时间 ）
- 功能说明：平滑的转变当前的调色板为特定的颜色。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 红色值 | 必填 | 整数型 | 欲转换调色板到的颜色中的红色成份值。 |
| 绿色值 | 必填 | 整数型 | 欲转换调色板到的颜色中的绿色成份值。 |
| 兰色值 | 必填 | 整数型 | 欲转换调色板到的颜色中的兰色成份值。 |
| 等待时间 | 必填 | 整数型 | 调色板淡出过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，25大约4秒，100大约8秒。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd78.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd78.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“平滑变换”命令，从当前屏幕调色板平滑的转变成指定颜色。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**平滑变换 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

平滑的转变当前的调色板为特定的颜色。

*语法：*  逻辑型  *屏幕*．平滑变换 （红色值， 绿色值， 兰色值， 等待时间）

| 参数名 | 描 述 |
| --- | --- |
| 红色值 | 必需的 ； 整数型。欲转换调色板到的颜色中的红色成份值。 |
| 绿色值 | 必需的 ； 整数型。欲转换调色板到的颜色中的绿色成份值。 |
| 兰色值 | 必需的 ； 整数型。欲转换调色板到的颜色中的兰色成份值。 |
| 等待时间 | 必需的 ； 整数型。调色板淡出过程中的等待时间，取值范围是：0不等待，10大约1秒， 25大约2秒，25大约4秒，100大约8秒。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd78.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd78.files/image002.gif)

说明:

通过“平滑变换”命令，从当前屏幕调色板平滑的转变成指定颜色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取宽度

- 原文链接：https://esdn.ijingyi.com/title-14881.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：整数型
- 语法：整数型 屏幕 ．取宽度 （ ）
- 功能说明：取当前屏幕的宽度值，单位为像素。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd79.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd79.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取宽度”命令，获取当前 DirectX 屏幕的宽度。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取宽度 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取当前屏幕的宽度值，单位为像素。

*语法：*  整数型  *屏幕*．取宽度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd79.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd79.files/image002.gif)

说明:

通过“取宽度”命令，获取当前DirectX屏幕的宽度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取高度

- 原文链接：https://esdn.ijingyi.com/title-14882.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：整数型
- 语法：整数型 屏幕 ．取高度 （ ）
- 功能说明：取当前屏幕的高度值，单位为像素。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd80.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd80.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取高度”命令获取当前 DirectX 屏幕的高度。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取高度 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取当前屏幕的高度值，单位为像素。

*语法：*  整数型  *屏幕*．取高度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd80.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd80.files/image002.gif)

说明:

通过“取高度”命令获取当前DirectX屏幕的高度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取色深

- 原文链接：https://esdn.ijingyi.com/title-14883.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：整数型
- 语法：整数型 屏幕 ．取色深 （ ）
- 功能说明：取当前的颜色深度值。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd81.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd81.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取色深”命令，获取当前 DirectX 屏幕色深。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取色深 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取当前的颜色深度值。

*语法：*  整数型  *屏幕*．取色深 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd81.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd81.files/image002.gif)

说明:

通过“取色深”命令，获取当前DirectX屏幕色深。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取前端页面

- 原文链接：https://esdn.ijingyi.com/title-14884.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：页面
- 语法：页面 屏幕 ．取前端页面 （ ）
- 功能说明：取屏幕的前端页面。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd82.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd82.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取前端页面”命令，获取 DirectX 屏幕前端页面，注意，此命令不同与“取后台页面”命令。此命令不论在全屏模式下，还是在窗口模式下，取回的均是整个屏幕。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取前端页面 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取屏幕的前端页面。

*语法：*  页面  *屏幕*．取前端页面 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd82.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd82.files/image002.gif)

说明:

通过“取前端页面”命令，获取DirectX屏幕前端页面，注意，此命令不同与“取后台页面”命令。此命令不论在全屏模式下，还是在窗口模式下，取回的均是整个屏幕。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取后台页面

- 原文链接：https://esdn.ijingyi.com/title-14885.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：页面
- 语法：页面 屏幕 ．取后台页面 （ ）
- 功能说明：取屏幕的后台缓冲页面。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd83.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd83.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取后台页面”命令，获取当前屏幕后台缓冲页面。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取后台页面 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取屏幕的后台缓冲页面。

*语法：*  页面  *屏幕*．取后台页面 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd83.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd83.files/image002.gif)

说明:

通过“取后台页面”命令，获取当前屏幕后台缓冲页面。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取视频模式数

- 原文链接：https://esdn.ijingyi.com/title-14886.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：整数型
- 语法：整数型 屏幕 ．取视频模式数 （ ）
- 功能说明：取当前显卡支持的视频模式数量。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd85.files/image001.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取视频模式数”命令，获取本地设备支持视频模式数量。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取视频模式数 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取当前显卡支持的视频模式数量。

*语法：*  整数型  *屏幕*．取视频模式数 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd85.files/image001.gif)

说明:

通过“取视频模式数”命令，获取本地设备支持视频模式数量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取视频模式信息

- 原文链接：https://esdn.ijingyi.com/title-14887.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．取视频模式信息 （ 索引 ， 宽度 ， 高度 ， 色深 ）
- 功能说明：取当前显卡支持的视频模式信息。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 索引 | 必填 | 整数型 | 欲从视频信息数组中取出信息的索引，该索引以1开始。 |
| 宽度 | 必填 | 整数型，参数数据只能提供变量 | 视频模式信息的宽度值，作为返回值。 |
| 高度 | 必填 | 整数型，参数数据只能提供变量 | 视频模式信息的高度值，作为返回值。 |
| 色深 | 必填 | 整数型，参数数据只能提供变量 | 视频模式信息的色深值，作为返回值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd86.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd86.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取视频模式信息”命令，获取指定索引的视频详细信息。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取视频模式信息 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

取当前显卡支持的视频模式信息。

*语法：*  逻辑型  *屏幕*．取视频模式信息 （索引， 宽度， 高度， 色深）

| 参数名 | 描 述 |
| --- | --- |
| 索引 | 必需的 ； 整数型。欲从视频信息数组中取出信息的索引，该索引以1开始。 |
| 宽度 | 必需的 ； 整数型，参数数据只能提供变量。视频模式信息的宽度值，作为返回值。 |
| 高度 | 必需的 ； 整数型，参数数据只能提供变量。视频模式信息的高度值，作为返回值。 |
| 色深 | 必需的 ； 整数型，参数数据只能提供变量。视频模式信息的色深值，作为返回值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd86.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd86.files/image002.gif)

说明:

通过“取视频模式信息”命令，获取指定索引的视频详细信息。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 测试视频模式

- 原文链接：https://esdn.ijingyi.com/title-14888.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．测试视频模式 （ 宽度 ， 高度 ， 色深 ）
- 功能说明：测试当前显卡是否支持该显示模式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 宽度 | 必填 | 整数型 | 测试视频模式是否支持的宽度值。 |
| 高度 | 必填 | 整数型 | 测试视频模式是否支持的高度值。 |
| 色深 | 必填 | 整数型 | 测试视频模式是否支持的色深值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd87.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd87.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“测试视频模式”命令，检查系统内的设备是否支持指定显示模式。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**测试视频模式 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

测试当前显卡是否支持该显示模式。

*语法：*  逻辑型  *屏幕*．测试视频模式 （宽度， 高度， 色深）

| 参数名 | 描 述 |
| --- | --- |
| 宽度 | 必需的 ； 整数型。测试视频模式是否支持的宽度值。 |
| 高度 | 必需的 ； 整数型。测试视频模式是否支持的高度值。 |
| 色深 | 必需的 ； 整数型。测试视频模式是否支持的色深值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd87.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd87.files/image002.gif)

说明:

通过“测试视频模式”命令，检查系统内的设备是否支持指定显示模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 等待空白调整

- 原文链接：https://esdn.ijingyi.com/title-14889.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．等待空白调整 （ ）
- 功能说明：等待垂直的空白调整。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd88.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd88.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“等待空白调整”命令，允许程序支持“垂直同步”。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**等待空白调整 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

等待垂直的空白调整。

*语法：*  逻辑型  *屏幕*．等待空白调整 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd88.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd88.files/image002.gif)

说明:

通过“等待空白调整”命令，允许程序支持“垂直同步”。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 设置建缓冲位置

- 原文链接：https://esdn.ijingyi.com/title-14890.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：无返回值
- 语法：无返回值 屏幕 ．设置建缓冲位置 （ 标志 ）
- 功能说明：是否在视频存储器中创建后台缓冲页面，还是在系统的随机存储器中创建后台缓冲页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 标志 | 必填 | 逻辑型 | 该值为真代表在视频存储器中创建后台缓冲页面，为假代表在系统的随机存储器中创建后台缓冲页面。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd89.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd89.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“设置建缓冲位置”命令，设置屏幕后台缓冲区保存位置。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**设置建缓冲位置 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

是否在视频存储器中创建后台缓冲页面，还是在系统的随机存储器中创建后台缓冲页面。

*语法：*  无返回值  *屏幕*．设置建缓冲位置 （标志）

| 参数名 | 描 述 |
| --- | --- |
| 标志 | 必需的 ； 逻辑型。该值为真代表在视频存储器中创建后台缓冲页面，为假代表在系统的随机存储器中创建后台缓冲页面。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd89.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd89.files/image002.gif)

说明:

通过“设置建缓冲位置”命令，设置屏幕后台缓冲区保存位置。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 改变显示模式

- 原文链接：https://esdn.ijingyi.com/title-14891.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．改变显示模式 （ 宽度 ， 高度 ， 色深 ， 标志 ）
- 功能说明：改变当前的显示模式为参数指定的值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 宽度 | 必填 | 整数型 | 新的显示模式的宽度。 |
| 高度 | 必填 | 整数型 | 新的显示模式的高度。 |
| 色深 | 必填 | 整数型 | 新的显示模式的色深。 |
| 标志 | 必填 | 逻辑型 | 是否允许老的VGA显示模式的分辨率。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd92.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd92.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“改变显示模式”命令，改变当前显示模式到指定模式。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**改变显示模式 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

改变当前的显示模式为参数指定的值。

*语法：*  逻辑型  *屏幕*．改变显示模式 （宽度， 高度， 色深， 标志）

| 参数名 | 描 述 |
| --- | --- |
| 宽度 | 必需的 ； 整数型。新的显示模式的宽度。 |
| 高度 | 必需的 ； 整数型。新的显示模式的高度。 |
| 色深 | 必需的 ； 整数型。新的显示模式的色深。 |
| 标志 | 必需的 ； 逻辑型。是否允许老的VGA显示模式的分辨率。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd92.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd92.files/image002.gif)

说明:

通过“改变显示模式”命令，改变当前显示模式到指定模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 淡入到黑色

- 原文链接：https://esdn.ijingyi.com/title-14892.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．淡入到黑色 （ 等待时间 ）
- 功能说明：淡入屏幕页面到黑色。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等待时间 | 必填 | 整数型 | 整个淡入过程经历的时间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd98.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd98.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“淡入到黑色”命令，将当前屏幕渐渐转换为黑色。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**淡入到黑色 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

淡入屏幕页面到黑色。

*语法：*  逻辑型  *屏幕*．淡入到黑色 （等待时间）

| 参数名 | 描 述 |
| --- | --- |
| 等待时间 | 必需的 ； 整数型。整个淡入过程经历的时间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd98.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd98.files/image002.gif)

说明:

通过“淡入到黑色”命令，将当前屏幕渐渐转换为黑色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 淡入到缓冲图片

- 原文链接：https://esdn.ijingyi.com/title-14893.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．淡入到缓冲图片 （ 等待时间 ）
- 功能说明：淡入当前屏幕页面到缓冲页面的图片。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 等待时间 | 必填 | 整数型 | 整个淡入过程经历的时间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd99.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd99.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“淡入到缓冲图片”命令，由当前屏幕渐渐转变为后台页面缓冲的图片。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**淡入到缓冲图片 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

淡入当前屏幕页面到缓冲页面的图片。

*语法：*  逻辑型  *屏幕*．淡入到缓冲图片 （等待时间）

| 参数名 | 描 述 |
| --- | --- |
| 等待时间 | 必需的 ； 整数型。整个淡入过程经历的时间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd99.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd99.files/image002.gif)

说明:

通过“淡入到缓冲图片”命令，由当前屏幕渐渐转变为后台页面缓冲的图片。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 是否全屏

- 原文链接：https://esdn.ijingyi.com/title-14894.html
- 操作系统支持：Windows 所属对象： 屏幕
- 返回值类型：逻辑型
- 语法：逻辑型 屏幕 ．是否全屏 （ ）
- 功能说明：当前是否为全屏模式。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd100.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd100.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“是否全屏”命令，检查当前 DirectX 屏幕是否为全屏模式。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**是否全屏 方法**   操作系统支持：Windows    所属对象：[屏幕](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt6.htm)

当前是否为全屏模式。

*语法：*  逻辑型  *屏幕*．是否全屏 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd100.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd100.files/image002.gif)

说明:

通过“是否全屏”命令，检查当前DirectX屏幕是否为全屏模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 初始化

- 原文链接：https://esdn.ijingyi.com/title-14896.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．初始化 （ 窗口句柄 ， ［ 独占模式 ］ ）
- 功能说明：初始化DirectSound对象。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 窗口句柄 | 必填 | 整数型 |  |
| 独占模式 | 可空 | 逻辑型 | 是否为独占模式，默认值为假。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd213.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd213.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“初始化”命令，使“声音”和指定窗口绑定，并初始化内部缓存等。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**初始化 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

初始化DirectSound对象。

*语法：*  逻辑型  *声音*．初始化 （窗口句柄， ［独占模式］）

| 参数名 | 描 述 |
| --- | --- |
| 窗口句柄 | 必需的 ； 整数型。 |
| 独占模式 | 可选的 ； 逻辑型。是否为独占模式，默认值为假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd213.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd213.files/image002.gif)

说明:

通过“初始化”命令，使“声音”和指定窗口绑定，并初始化内部缓存等。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 使用3D

- 原文链接：https://esdn.ijingyi.com/title-14897.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．使用3D （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd214.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd214.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“使用 3D ”命令，使“声音”支持 3D 音效输出相关命令。如本命令执行不成功，说明您的硬件有可能不支持 3D 音效（或加速）。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**使用3D 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

*语法：*  逻辑型  *声音*．使用3D （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd214.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd214.files/image002.gif)

说明:

通过“使用3D”命令，使“声音”支持3D音效输出相关命令。如本命令执行不成功，说明您的硬件有可能不支持3D音效（或加速）。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取设备性能

- 原文链接：https://esdn.ijingyi.com/title-14898.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．取设备性能 （ ）
- 功能说明：取声音硬件的设备性能。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd215.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd215.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取设备性能”命令，检查系统内的设备是否支持 3D 因效 ( 或加速 ) 。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取设备性能 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

取声音硬件的设备性能。

*语法：*  逻辑型  *声音*．取设备性能 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd215.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd215.files/image002.gif)

说明:

通过“取设备性能”命令，检查系统内的设备是否支持3D因效(或加速)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 连续播放

- 原文链接：https://esdn.ijingyi.com/title-14899.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．连续播放 （ ［ 是否连续播放 ］ ）
- 功能说明：使混音器连续播放。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 是否连续播放 | 可空 | 逻辑型 | 默认值为真。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd217.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd217.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“连续播放”命令，设置是否在播放结束后自动循环播放。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**连续播放 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

使混音器连续播放。

*语法：*  逻辑型  *声音*．连续播放 （［是否连续播放］）

| 参数名 | 描 述 |
| --- | --- |
| 是否连续播放 | 可选的 ； 逻辑型。默认值为真。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd217.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd217.files/image002.gif)

说明:

通过“连续播放”命令，设置是否在播放结束后自动循环播放。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 置3D听者因子

- 原文链接：https://esdn.ijingyi.com/title-14900.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．置3D听者因子 （ ［ 多普勒因子 ］ ， ［ 衰减因子 ］ ， ［ 距离因子 ］ ）
- 功能说明：设置3D听者因子。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 多普勒因子 | 可空 | 小数型 | 取值范围：0.0 - 10.0；默认值为1.0。取0.0时表示不计算多普勒效应；取1.0时表示使用真实世界的多普勒效应；大于1.0的值都将合成多普勒效应。 |
| 衰减因子 | 可空 | 小数型 | 通过调整衰减因子来表示声音的对象和听者之间的距离，取值范围：0.0 - 10.0；默认值为1.0。如果衰减值小于1.0（但大于0.0），表示声音比在真实世界中传播的路程更远。如果衰减值大于1.0，则表示声音比在真实世界中传播的距离短得多。 |
| 距离因子 | 可空 | 小数型 | 取值范围：1.0 - 1000000000.0，默认值为1。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd218.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd218.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置 3D 听者因子”命令，设置 3D 音效中接受声音的“人”的属性。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**置3D听者因子 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

设置3D听者因子。

*语法：*  逻辑型  *声音*．置3D听者因子 （［多普勒因子］， ［衰减因子］， ［距离因子］）

| 参数名 | 描 述 |
| --- | --- |
| 多普勒因子 | 可选的 ； 小数型。取值范围：0.0 - 10.0；默认值为1.0。取0.0时表示不计算多普勒效应；取1.0时表示使用真实世界的多普勒效应；大于1.0的值都将合成多普勒效应。 |
| 衰减因子 | 可选的 ； 小数型。通过调整衰减因子来表示声音的对象和听者之间的距离，取值范围：0.0 - 10.0；默认值为1.0。如果衰减值小于1.0（但大于0.0），表示声音比在真实世界中传播的路程更远。如果衰减值大于1.0，则表示声音比在真实世界中传播的距离短得多。 |
| 距离因子 | 可选的 ； 小数型。取值范围：1.0 - 1000000000.0，默认值为1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd218.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd218.files/image002.gif)

说明:

通过“置3D听者因子”命令，设置3D音效中接受声音的“人”的属性。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 置3D听者位置

- 原文链接：https://esdn.ijingyi.com/title-14901.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．置3D听者位置 （ X坐标 ， Y坐标 ， Z坐标 ， ［ 前向量X坐标 ］ ， ［ 前向量Y坐标 ］ ， ［ 前向量Z坐标 ］ ， ［ 顶向量X坐标 ］ ， ［ 顶向量Y坐标 ］ ， ［ 顶向量Z坐标 ］ ， ［ 定位向量 ］ ）
- 功能说明：设置3D听者的详细位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| X坐标 | 必填 | 小数型 |  |
| Y坐标 | 必填 | 小数型 |  |
| Z坐标 | 必填 | 小数型 |  |
| 前向量X坐标 | 可空 | 小数型 | 前向量从听者脸的外部向前指，默认值为0。 |
| 前向量Y坐标 | 可空 | 小数型 | 前向量从听者脸的外部向前指，默认值为0。 |
| 前向量Z坐标 | 可空 | 小数型 | 前向量从听者脸的外部向前指，默认值为1。 |
| 顶向量X坐标 | 可空 | 小数型 | 顶向量指向上，默认值为0。 |
| 顶向量Y坐标 | 可空 | 小数型 | 顶向量指向上，默认值为1。 |
| 顶向量Z坐标 | 可空 | 小数型 | 顶向量指向上，默认值为0。 |
| 定位向量 | 可空 | 逻辑型 | 是否定位向量，默认值为假。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd219.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd219.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置 3D 听者位置”命令，配置接受音源的“人”的位置属性。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**置3D听者位置 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

设置3D听者的详细位置。

*语法：*  逻辑型  *声音*．置3D听者位置 （X坐标， Y坐标， Z坐标， ［前向量X坐标］， ［前向量Y坐标］， ［前向量Z坐标］， ［顶向量X坐标］， ［顶向量Y坐标］， ［顶向量Z坐标］， ［定位向量］）

| 参数名 | 描 述 |
| --- | --- |
| X坐标 | 必需的 ； 小数型。 |
| Y坐标 | 必需的 ； 小数型。 |
| Z坐标 | 必需的 ； 小数型。 |
| 前向量X坐标 | 可选的 ； 小数型。前向量从听者脸的外部向前指，默认值为0。 |
| 前向量Y坐标 | 可选的 ； 小数型。前向量从听者脸的外部向前指，默认值为0。 |
| 前向量Z坐标 | 可选的 ； 小数型。前向量从听者脸的外部向前指，默认值为1。 |
| 顶向量X坐标 | 可选的 ； 小数型。顶向量指向上，默认值为0。 |
| 顶向量Y坐标 | 可选的 ； 小数型。顶向量指向上，默认值为1。 |
| 顶向量Z坐标 | 可选的 ； 小数型。顶向量指向上，默认值为0。 |
| 定位向量 | 可选的 ； 逻辑型。是否定位向量，默认值为假。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd219.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd219.files/image002.gif)

说明:

通过“置3D听者位置”命令，配置接受音源的“人”的位置属性。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 置MIDI输出音量

- 原文链接：https://esdn.ijingyi.com/title-14902.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．置MIDI输出音量 （ 右声道音量 ， 左声道音量 ）
- 功能说明：设置MIDI音乐的输出音量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 右声道音量 | 必填 | 字节型 | 必须为0-100之间的数字。 |
| 左声道音量 | 必填 | 字节型 | 必须为0-100之间的数字。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd222.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd222.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置 MIDI 输出音量”命令，设置系统 MIDI 音乐 ( 软件合成器 ) 输出音量。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**置MIDI输出音量 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

设置MIDI音乐的输出音量。

*语法：*  逻辑型  *声音*．置MIDI输出音量 （右声道音量， 左声道音量）

| 参数名 | 描 述 |
| --- | --- |
| 右声道音量 | 必需的 ； 字节型。必须为0-100之间的数字。 |
| 左声道音量 | 必需的 ； 字节型。必须为0-100之间的数字。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd222.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd222.files/image002.gif)

说明:

通过“置MIDI输出音量”命令，设置系统MIDI音乐(软件合成器)输出音量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 置数字输出音量

- 原文链接：https://esdn.ijingyi.com/title-14903.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：逻辑型
- 语法：逻辑型 声音 ．置数字输出音量 （ 右声道音量 ， 左声道音量 ）
- 功能说明：设置数字输出音量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 右声道音量 | 必填 | 字节型 | 必须为0-100之间的数字。 |
| 左声道音量 | 必填 | 字节型 | 必须为0-100之间的数字。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd223.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd223.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置数字输出音量”命令，设置系统数字声音（波形 /Wave 声音）输出音量。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**置数字输出音量 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

设置数字输出音量。

*语法：*  逻辑型  *声音*．置数字输出音量 （右声道音量， 左声道音量）

| 参数名 | 描 述 |
| --- | --- |
| 右声道音量 | 必需的 ； 字节型。必须为0-100之间的数字。 |
| 左声道音量 | 必需的 ； 字节型。必须为0-100之间的数字。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd223.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd223.files/image002.gif)

说明:

通过“置数字输出音量”命令，设置系统数字声音（波形/Wave
声音）输出音量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取MIDI输出音量

- 原文链接：https://esdn.ijingyi.com/title-14904.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：整数型
- 语法：整数型 声音 ．取MIDI输出音量 （ ［ 声道 ］ ）
- 功能说明：取当前MIDI输出音量。返回100表示最大音量；0表示静音。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声道 | 可空 | 字节型 | 为以下两个常量值之一：0、#声音常量.左声道；1、#声音常量.右声道。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd225.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd225.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取 MIDI 输出音量”命令，获取当前系统中 MIDI 音乐 ( 软件合成器 ) 输出音量。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取MIDI输出音量 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

取当前MIDI输出音量。返回100表示最大音量；0表示静音。

*语法：*  整数型  *声音*．取MIDI输出音量 （［声道］）

| 参数名 | 描 述 |
| --- | --- |
| 声道 | 可选的 ； 字节型。为以下两个常量值之一：0、#声音常量.左声道；1、#声音常量.右声道。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd225.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd225.files/image002.gif)

说明:

通过“取MIDI输出音量”命令，获取当前系统中MIDI音乐(软件合成器)输出音量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 取数字输出音量

- 原文链接：https://esdn.ijingyi.com/title-14905.html
- 操作系统支持：Windows 所属对象： 声音
- 返回值类型：整数型
- 语法：整数型 声音 ．取数字输出音量 （ ［ 声道 ］ ）
- 功能说明：取当前数字输出音量。返回100表示最大音量；0表示静音。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声道 | 可空 | 字节型 | 为以下两个常量值之一：0、#声音常量.左声道；1、#声音常量.右声道。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd226.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd226.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取数字输出音量”命令，获取系统当前数字音乐（ Wave/ 波形音乐）输出音量大小。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**取数字输出音量 方法**   操作系统支持：Windows    所属对象：[声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt7.htm)

取当前数字输出音量。返回100表示最大音量；0表示静音。

*语法：*  整数型  *声音*．取数字输出音量 （［声道］）

| 参数名 | 描 述 |
| --- | --- |
| 声道 | 可选的 ； 字节型。为以下两个常量值之一：0、#声音常量.左声道；1、#声音常量.右声道。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd226.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd226.files/image002.gif)

说明:

通过“取数字输出音量”命令，获取系统当前数字音乐（Wave/波形音乐）输出音量大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 载入Wave文件

- 原文链接：https://esdn.ijingyi.com/title-14907.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．载入Wave文件 （ 声音句柄 ， Wave文件名 ， ［ 声音缓冲数量 ］ ）
- 功能说明：载入要播放的Wave文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声音句柄 | 必填 | 声音 | DirectSound对象句柄。 |
| Wave文件名 | 必填 | 文本型 | 要播放的Wave文件名。 |
| 声音缓冲数量 | 可空 | 整数型 | 声音缓冲创建的数量。默认值为1。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd230.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd230.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“载入 Wave 文件”命令，将指定文件载入缓存等待播放。 参见 : 例程 资源 注：请将例程和资源包中的资源放在同一目录下。

**完整正文（站点原文转换）**

**载入Wave文件 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

载入要播放的Wave文件。

*语法：*  逻辑型  *WAVE声音*．载入Wave文件 （声音句柄， Wave文件名， ［声音缓冲数量］）

| 参数名 | 描 述 |
| --- | --- |
| 声音句柄 | 必需的 ； 声音。DirectSound对象句柄。 |
| Wave文件名 | 必需的 ； 文本型。要播放的Wave文件名。 |
| 声音缓冲数量 | 可选的 ； 整数型。声音缓冲创建的数量。默认值为1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd230.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd230.files/image002.gif)

说明:

通过“载入Wave文件”命令，将指定文件载入缓存等待播放。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e) [资源](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E8%B5%84%E6%BA%90.rar)

注：请将例程和资源包中的资源放在同一目录下。

---

### 播放

- 原文链接：https://esdn.ijingyi.com/title-14908.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．播放 （ ［ 循环标记 ］ ）
- 功能说明：播放载入的Wave文件。不带音量、声道和频率参数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 循环标记 | 可空 | 整数型 | 为1时，循环播放Wave文件。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd231.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd231.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“播放”命令，开始播放已载入缓存的 Wave 音乐。 参见 : 例程

**完整正文（站点原文转换）**

**播放 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

播放载入的Wave文件。不带音量、声道和频率参数。

*语法：*  逻辑型  *WAVE声音*．播放 （［循环标记］）

| 参数名 | 描 述 |
| --- | --- |
| 循环标记 | 可选的 ； 整数型。为1时，循环播放Wave文件。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd231.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd231.files/image002.gif)

说明:

通过“播放”命令，开始播放已载入缓存的Wave音乐。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 播放扩展

- 原文链接：https://esdn.ijingyi.com/title-14909.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．播放扩展 （ ［ 声道平衡 ］ ， ［ 音量 ］ ， ［ 频率 ］ ， ［ 循环标记 ］ ）
- 功能说明：播放载入的Wave文件。带音量、声道和频率参数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声道平衡 | 可空 | 整数型 | 用dB来测量，取值范围：-10000 -- 10000。负值减小右声道音量，正值则减小左声道音量，0则两个声道以最大的音量播放。默认值为0。 |
| 音量 | 可空 | 整数型 | 用dB来测量，取值范围：0 -- -10000。0为正常声音。默认值为0。 |
| 频率 | 可空 | 整数型 | 用Hz来测量，取值范围：100 -- 100000。声音经常以11kHz、22kHz或44kHz的频率进行记录。例如，将频率设置为15000Hz，这样能有效地放慢一个22kHz的声音。默认值为0。 |
| 循环标记 | 可空 | 整数型 | 为1时，循环播放Wave文件。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd232.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd232.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“播放扩展”命令，以指定形式播放缓冲中的 Wave 音频。 参见 : 例程

**完整正文（站点原文转换）**

**播放扩展 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

播放载入的Wave文件。带音量、声道和频率参数。

*语法：*  逻辑型  *WAVE声音*．播放扩展 （［声道平衡］， ［音量］， ［频率］， ［循环标记］）

| 参数名 | 描 述 |
| --- | --- |
| 声道平衡 | 可选的 ； 整数型。用dB来测量，取值范围：-10000 -- 10000。负值减小右声道音量，正值则减小左声道音量，0则两个声道以最大的音量播放。默认值为0。 |
| 音量 | 可选的 ； 整数型。用dB来测量，取值范围：0 -- -10000。0为正常声音。默认值为0。 |
| 频率 | 可选的 ； 整数型。用Hz来测量，取值范围：100 -- 100000。声音经常以11kHz、22kHz或44kHz的频率进行记录。例如，将频率设置为15000Hz，这样能有效地放慢一个22kHz的声音。默认值为0。 |
| 循环标记 | 可选的 ； 整数型。为1时，循环播放Wave文件。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd232.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd232.files/image002.gif)

说明:

通过“播放扩展”命令，以指定形式播放缓冲中的Wave音频。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%B1%8F%E5%B9%95.e)

---

### 播放扩展1

- 原文链接：https://esdn.ijingyi.com/title-14910.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．播放扩展1 （ 音源X坐标 ， 音源Y坐标 ， 音源Z坐标 ， ［ 循环标记 ］ ）
- 功能说明：播放载入的Wave文件。带声音来源位置参数。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 音源X坐标 | 必填 | 整数型 | 声音来源位置的X坐标。 |
| 音源Y坐标 | 必填 | 整数型 | 声音来源位置的Y坐标。 |
| 音源Z坐标 | 必填 | 整数型 | 声音来源位置的Z坐标。 |
| 循环标记 | 可空 | 整数型 | 为1时，循环播放Wave文件。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd233.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd233.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“播放扩展 1 ”命令，播放缓存中的 Wave 声音数据，并且设置音源的 3D 位置。 参见 : 例程

**完整正文（站点原文转换）**

**播放扩展1 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

播放载入的Wave文件。带声音来源位置参数。

*语法：*  逻辑型  *WAVE声音*．播放扩展1 （音源X坐标， 音源Y坐标， 音源Z坐标， ［循环标记］）

| 参数名 | 描 述 |
| --- | --- |
| 音源X坐标 | 必需的 ； 整数型。声音来源位置的X坐标。 |
| 音源Y坐标 | 必需的 ； 整数型。声音来源位置的Y坐标。 |
| 音源Z坐标 | 必需的 ； 整数型。声音来源位置的Z坐标。 |
| 循环标记 | 可选的 ； 整数型。为1时，循环播放Wave文件。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd233.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd233.files/image002.gif)

说明:

通过“播放扩展1”命令，播放缓存中的Wave声音数据，并且设置音源的3D位置。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 停止

- 原文链接：https://esdn.ijingyi.com/title-14911.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．停止 （ ）
- 功能说明：停止播放Wave文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd234.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd234.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“停止”命令，停止正在播放的 Wave 声音。 参见 : 例程

**完整正文（站点原文转换）**

**停止 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

停止播放Wave文件。

*语法：*  逻辑型  *WAVE声音*．停止 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd234.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd234.files/image002.gif)

说明:

通过“停止”命令，停止正在播放的Wave声音。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 置音量

- 原文链接：https://esdn.ijingyi.com/title-14912.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：无返回值
- 语法：无返回值 WAVE声音 ．置音量 （ ［ 音量 ］ ）
- 功能说明：设置声音缓冲区的音量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 音量 | 可空 | 整数型 | 用dB来测量，取值范围：0 -- -10000。0为正常声音。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd235.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd235.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置音量”命令，设置本对象播放的 Wave 音乐音量。 参见 : 例程

**完整正文（站点原文转换）**

**置音量 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

设置声音缓冲区的音量。

*语法：*  无返回值  *WAVE声音*．置音量 （［音量］）

| 参数名 | 描 述 |
| --- | --- |
| 音量 | 可选的 ； 整数型。用dB来测量，取值范围：0 -- -10000。0为正常声音。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd235.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd235.files/image002.gif)

说明:

通过“置音量”命令，设置本对象播放的Wave音乐音量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 取音量

- 原文链接：https://esdn.ijingyi.com/title-14913.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：整数型
- 语法：整数型 WAVE声音 ．取音量 （ ）
- 功能说明：取声音缓冲区的音量。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd236.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd236.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取音量”命令，获取当前对象的播放音量。 参见 : 例程

**完整正文（站点原文转换）**

**取音量 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

取声音缓冲区的音量。

*语法：*  整数型  *WAVE声音*．取音量 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd236.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd236.files/image002.gif)

说明:

通过“取音量”命令，获取当前对象的播放音量。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 置声道平衡

- 原文链接：https://esdn.ijingyi.com/title-14914.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：无返回值
- 语法：无返回值 WAVE声音 ．置声道平衡 （ ［ 声道平衡 ］ ）
- 功能说明：设置声音缓冲区的声道平衡。设置音量之后才能应用声道平衡。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 声道平衡 | 可空 | 整数型 | 用dB来测量，取值范围：-10000 -- 10000。负值减小右声道音量，正值则减小左声道音量，0则两个声道以最大的音量播放。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd237.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd237.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置声道平衡”命令，配置对象在播放 Wave 声音时的声道平衡状态。注意：在开启 3D 模式后，本命令将无效 ( 应使用控制音者位置的方式来实现声道差距的效果 ) 。 参见 : 例程

**完整正文（站点原文转换）**

**置声道平衡 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

设置声音缓冲区的声道平衡。设置音量之后才能应用声道平衡。

*语法：*  无返回值  *WAVE声音*．置声道平衡 （［声道平衡］）

| 参数名 | 描 述 |
| --- | --- |
| 声道平衡 | 可选的 ； 整数型。用dB来测量，取值范围：-10000 -- 10000。负值减小右声道音量，正值则减小左声道音量，0则两个声道以最大的音量播放。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd237.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd237.files/image002.gif)

说明:

通过“置声道平衡”命令，配置对象在播放Wave声音时的声道平衡状态。注意：在开启3D模式后，本命令将无效(应使用控制音者位置的方式来实现声道差距的效果)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 取声道平衡

- 原文链接：https://esdn.ijingyi.com/title-14915.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：整数型
- 语法：整数型 WAVE声音 ．取声道平衡 （ ）
- 功能说明：取声音缓冲区的声道平衡音量。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd238.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd238.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取声道平衡”命令，获取当前 Wave 声音对象声道平衡状态。 参见 : 例程

**完整正文（站点原文转换）**

**取声道平衡 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

取声音缓冲区的声道平衡音量。

*语法：*  整数型  *WAVE声音*．取声道平衡 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd238.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd238.files/image002.gif)

说明:

通过“取声道平衡”命令，获取当前Wave声音对象声道平衡状态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 置频率

- 原文链接：https://esdn.ijingyi.com/title-14916.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：无返回值
- 语法：无返回值 WAVE声音 ．置频率 （ ［ 频率 ］ ）
- 功能说明：设置声音缓冲区的频率。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 频率 | 可空 | 整数型 | 用Hz来测量，取值范围：100 -- 100000。声音经常以11kHz、22kHz或44kHz的频率进行记录。例如，将频率设置为15000Hz，这样能有效地放慢一个22kHz的声音。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd239.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd239.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置频率”命令，设置对象播放的声波频率 ( 应避免超出人耳感应声波范围 ) 。 参见 : 例程

**完整正文（站点原文转换）**

**置频率 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

设置声音缓冲区的频率。

*语法：*  无返回值  *WAVE声音*．置频率 （［频率］）

| 参数名 | 描 述 |
| --- | --- |
| 频率 | 可选的 ； 整数型。用Hz来测量，取值范围：100 -- 100000。声音经常以11kHz、22kHz或44kHz的频率进行记录。例如，将频率设置为15000Hz，这样能有效地放慢一个22kHz的声音。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd239.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd239.files/image002.gif)

说明:

通过“置频率”命令，设置对象播放的声波频率(应避免超出人耳感应声波范围)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 取频率

- 原文链接：https://esdn.ijingyi.com/title-14917.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：整数型
- 语法：整数型 WAVE声音 ．取频率 （ ）
- 功能说明：取声音缓冲区的频率。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd240.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd240.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取频率”命令，获取当前对象中 Wave 文件播放频率。 参见 : 例程

**完整正文（站点原文转换）**

**取频率 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

取声音缓冲区的频率。

*语法：*  整数型  *WAVE声音*．取频率 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd240.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd240.files/image002.gif)

说明:

通过“取频率”命令，获取当前对象中Wave文件播放频率。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 是否正在播放

- 原文链接：https://esdn.ijingyi.com/title-14918.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．是否正在播放 （ ）
- 功能说明：检查是否正在播放Wave文件。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd241.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd241.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“是否正在播放”命令，检查当前对象是否以进入播放状态。 参见 : 例程

**完整正文（站点原文转换）**

**是否正在播放 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

检查是否正在播放Wave文件。

*语法：*  逻辑型  *WAVE声音*．是否正在播放 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd241.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd241.files/image002.gif)

说明:

通过“是否正在播放”命令，检查当前对象是否以进入播放状态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 置3d投射锥

- 原文链接：https://esdn.ijingyi.com/title-14919.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．置3d投射锥 （ ［ X方位 ］ ， ［ Y方位 ］ ， ［ Z方位 ］ ， ［ 内角 ］ ， ［ 外角 ］ ， ［ 外部声音 ］ ）
- 功能说明：设置3d声音缓冲的声音投射锥、投射锥的角度、锥的外部声音。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| X方位 | 可空 | 小数型 | 声音投射锥的X方位。默认值为0。 |
| Y方位 | 可空 | 小数型 | 声音投射锥的Y方位。默认值为1.0。 |
| Z方位 | 可空 | 小数型 | 声音投射锥的Z方位。默认值为0。 |
| 内角 | 可空 | 整数型 | 声音投射锥的内角（范围：0 -- 360度）。默认值为360。 |
| 外角 | 可空 | 整数型 | 声音投射锥的外角（范围：0 -- 360度）。默认值为360。 |
| 外部声音 | 可空 | 整数型 | 声音投射锥的外部声音（范围：-10000 -- 0）。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd242.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd242.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置 3D 投射锥”命令，设置 3D 音源播放时锥型声音带形态。 参见 : 例程

**完整正文（站点原文转换）**

**置3d投射锥 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

设置3d声音缓冲的声音投射锥、投射锥的角度、锥的外部声音。

*语法：*  逻辑型  *WAVE声音*．置3d投射锥 （［X方位］， ［Y方位］， ［Z方位］， ［内角］， ［外角］， ［外部声音］）

| 参数名 | 描 述 |
| --- | --- |
| X方位 | 可选的 ； 小数型。声音投射锥的X方位。默认值为0。 |
| Y方位 | 可选的 ； 小数型。声音投射锥的Y方位。默认值为1.0。 |
| Z方位 | 可选的 ； 小数型。声音投射锥的Z方位。默认值为0。 |
| 内角 | 可选的 ； 整数型。声音投射锥的内角（范围：0 -- 360度）。默认值为360。 |
| 外角 | 可选的 ； 整数型。声音投射锥的外角（范围：0 -- 360度）。默认值为360。 |
| 外部声音 | 可选的 ； 整数型。声音投射锥的外部声音（范围：-10000 -- 0）。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd242.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd242.files/image002.gif)

说明:

通过“置3D投射锥”命令，设置3D音源播放时锥型声音带形态。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 置3d属性

- 原文链接：https://esdn.ijingyi.com/title-14920.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．置3d属性 （ ［ 处理模式 ］ ， ［ 最小距离 ］ ， ［ 最大距离 ］ ， ［ X速度 ］ ， ［ Y速度 ］ ， ［ Z速度 ］ ）
- 功能说明：设置3d声音缓冲的处理模式、最小/最大距离、速率等属性。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 处理模式 | 可空 | 整数型 | 3D声音处理模式。可以为以下常量值之一：0、#声音常量.正常3D模式；1、#声音常量.关联3D模式；2、#声音常量.关闭3D模式。默认值为0。 |
| 最小距离 | 可空 | 小数型 | 默认值为1.0。 |
| 最大距离 | 可空 | 小数型 | 默认值为1000000000.0。 |
| X速度 | 可空 | 小数型 | 默认值为1.0。 |
| Y速度 | 可空 | 小数型 | 默认值为1.0。 |
| Z速度 | 可空 | 小数型 | 默认值为1.0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd243.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd243.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置 3D 属性”命令，设置 3D 音效的播放模式。 参见 : 例程

**完整正文（站点原文转换）**

**置3d属性 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

设置3d声音缓冲的处理模式、最小/最大距离、速率等属性。

*语法：*  逻辑型  *WAVE声音*．置3d属性 （［处理模式］， ［最小距离］， ［最大距离］， ［X速度］， ［Y速度］， ［Z速度］）

| 参数名 | 描 述 |
| --- | --- |
| 处理模式 | 可选的 ； 整数型。3D声音处理模式。可以为以下常量值之一：0、#声音常量.正常3D模式；1、#声音常量.关联3D模式；2、#声音常量.关闭3D模式。默认值为0。 |
| 最小距离 | 可选的 ； 小数型。默认值为1.0。 |
| 最大距离 | 可选的 ； 小数型。默认值为1000000000.0。 |
| X速度 | 可选的 ； 小数型。默认值为1.0。 |
| Y速度 | 可选的 ； 小数型。默认值为1.0。 |
| Z速度 | 可选的 ； 小数型。默认值为1.0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd243.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd243.files/image002.gif)

说明:

通过“置3D属性”命令，设置3D音效的播放模式。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 打开3D模式

- 原文链接：https://esdn.ijingyi.com/title-14921.html
- 操作系统支持：Windows 所属对象： WAVE声音
- 返回值类型：逻辑型
- 语法：逻辑型 WAVE声音 ．打开3D模式 （ ）

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd244.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd244.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“打开 3D 模式”命令，初始化 Wave 声音为 3D 模式。注意：打开 3D 模式后，“置声道平衡”将无效。 参见 : 例程

**完整正文（站点原文转换）**

**打开3D模式 方法**   操作系统支持：Windows    所属对象：[WAVE声音](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt8.htm)

*语法：*  逻辑型  *WAVE声音*．打开3D模式 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd244.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd244.files/image002.gif)

说明:

通过“打开3D模式”命令，初始化Wave声音为3D模式。注意：打开3D模式后，“置声道平衡”将无效。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E5%A3%B0%E9%9F%B3.e)

---

### 建空页面

- 原文链接：https://esdn.ijingyi.com/title-14923.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．建空页面 （ 屏幕 ， 宽度 ， 高度 ， ［ 内存种类 ］ ）
- 功能说明：根据参数创建一个空的页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 屏幕 | 必填 | 屏幕 | 欲创建页面的屏幕。 |
| 宽度 | 必填 | 整数型 | 欲创建页面的宽度值。 |
| 高度 | 必填 | 整数型 | 欲创建页面的高度值。 |
| 内存种类 | 可空 | 内存类别 | 欲创建的页面所在的位置，默认采用优化选择方式。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd110.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd110.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“建空页面”命令，创建一个兼容与指定屏幕的页面对象。 参见 : 例程

**完整正文（站点原文转换）**

**建空页面 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

根据参数创建一个空的页面。

*语法：*  逻辑型  *页面*．建空页面 （屏幕， 宽度， 高度， ［内存种类］）

| 参数名 | 描 述 |
| --- | --- |
| 屏幕 | 必需的 ； 屏幕。欲创建页面的屏幕。 |
| 宽度 | 必需的 ； 整数型。欲创建页面的宽度值。 |
| 高度 | 必需的 ； 整数型。欲创建页面的高度值。 |
| 内存种类 | 可选的 ； 内存类别。欲创建的页面所在的位置，默认采用优化选择方式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd110.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd110.files/image002.gif)

说明:

通过“建空页面”命令，创建一个兼容与指定屏幕的页面对象。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 建位图页面

- 原文链接：https://esdn.ijingyi.com/title-14924.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．建位图页面 （ 屏幕 ， 文件名 ， ［ 内存种类 ］ ）
- 功能说明：创建一个拥有位图的页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 屏幕 | 必填 | 屏幕 | 欲创建页面的屏幕。 |
| 文件名 | 必填 | 文本型 | 位图文件的路径名称。 |
| 内存种类 | 可空 | 内存类别 | 欲创建的页面所在的位置，默认采用优化选择方式。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd111.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd111.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“建位图页面”命令，使对象拥有一个兼容指定屏幕的位图页面。位图页面大小为图片大小。 参见 : 例程

**完整正文（站点原文转换）**

**建位图页面 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

创建一个拥有位图的页面。

*语法：*  逻辑型  *页面*．建位图页面 （屏幕， 文件名， ［内存种类］）

| 参数名 | 描 述 |
| --- | --- |
| 屏幕 | 必需的 ； 屏幕。欲创建页面的屏幕。 |
| 文件名 | 必需的 ； 文本型。位图文件的路径名称。 |
| 内存种类 | 可选的 ； 内存类别。欲创建的页面所在的位置，默认采用优化选择方式。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd111.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd111.files/image002.gif)

说明:

通过“建位图页面”命令，使对象拥有一个兼容指定屏幕的位图页面。位图页面大小为图片大小。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 置像素颜色

- 原文链接：https://esdn.ijingyi.com/title-14925.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．置像素颜色 （ 横坐标 ， 纵坐标 ， 颜色值 ）
- 功能说明：设置指定像素的颜色。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横坐标 | 必填 | 整数型 | 像素的横坐标。 |
| 纵坐标 | 必填 | 整数型 | 像素的纵坐标。 |
| 颜色值 | 必填 | 整数型 | 像素的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置像素颜色”命令，设置页面指定位置的颜色值。 参见 : 例程

**完整正文（站点原文转换）**

**置像素颜色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置指定像素的颜色。

*语法：*  逻辑型  *页面*．置像素颜色 （横坐标， 纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 横坐标 | 必需的 ； 整数型。像素的横坐标。 |
| 纵坐标 | 必需的 ； 整数型。像素的纵坐标。 |
| 颜色值 | 必需的 ； 整数型。像素的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd112.files/image003.gif)

说明:

通过“置像素颜色”命令，设置页面指定位置的颜色值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 置像素透明色

- 原文链接：https://esdn.ijingyi.com/title-14926.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．置像素透明色 （ 横坐标 ， 纵坐标 ， 颜色值 ， 透明值 ）
- 功能说明：设置指定像素的透明颜色。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横坐标 | 必填 | 整数型 | 像素的横坐标。 |
| 纵坐标 | 必填 | 整数型 | 像素的纵坐标。 |
| 颜色值 | 必填 | 整数型 | 像素的颜色值。 |
| 透明值 | 必填 | 整数型 | 像素的透明值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置像素透明色”命令，设定页面中被透明掉的颜色值及替代值。 参见 : 例程

**完整正文（站点原文转换）**

**置像素透明色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置指定像素的透明颜色。

*语法：*  逻辑型  *页面*．置像素透明色 （横坐标， 纵坐标， 颜色值， 透明值）

| 参数名 | 描 述 |
| --- | --- |
| 横坐标 | 必需的 ； 整数型。像素的横坐标。 |
| 纵坐标 | 必需的 ； 整数型。像素的纵坐标。 |
| 颜色值 | 必需的 ； 整数型。像素的颜色值。 |
| 透明值 | 必需的 ； 整数型。像素的透明值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd113.files/image003.gif)

说明:

通过“置像素透明色”命令，设定页面中被透明掉的颜色值及替代值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 取像素颜色

- 原文链接：https://esdn.ijingyi.com/title-14927.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：整数型
- 语法：整数型 页面 ．取像素颜色 （ 横坐标 ， 纵坐标 ）
- 功能说明：取指定像素的颜色值。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 横坐标 | 必填 | 整数型 | 像素的横坐标。 |
| 纵坐标 | 必填 | 整数型 | 像素的纵坐标。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取像素颜色”命令，获取页面中指定位置的颜色值。 参见 : 例程

**完整正文（站点原文转换）**

**取像素颜色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

取指定像素的颜色值。

*语法：*  整数型  *页面*．取像素颜色 （横坐标， 纵坐标）

| 参数名 | 描 述 |
| --- | --- |
| 横坐标 | 必需的 ； 整数型。像素的横坐标。 |
| 纵坐标 | 必需的 ； 整数型。像素的纵坐标。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd114.files/image003.gif)

说明:

通过“取像素颜色”命令，获取页面中指定位置的颜色值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画竖直线

- 原文链接：https://esdn.ijingyi.com/title-14928.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画竖直线 （ 起点纵坐标 ， 终点纵坐标 ， 起终点横坐标 ， 颜色值 ）
- 功能说明：在指定位置画一条指定颜色的竖直线。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点纵坐标 | 必填 | 整数型 |  |
| 终点纵坐标 | 必填 | 整数型 |  |
| 起终点横坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画线的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画竖直线”命令，在指定页面中画一条竖直线。 参见 : 例程

**完整正文（站点原文转换）**

**画竖直线 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一条指定颜色的竖直线。

*语法：*  逻辑型  *页面*．画竖直线 （起点纵坐标， 终点纵坐标， 起终点横坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 起点纵坐标 | 必需的 ； 整数型。 |
| 终点纵坐标 | 必需的 ； 整数型。 |
| 起终点横坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画线的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd115.files/image003.gif)

说明:

通过“画竖直线”命令，在指定页面中画一条竖直线。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画水平线

- 原文链接：https://esdn.ijingyi.com/title-14929.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画水平线 （ 起点横坐标 ， 终点横坐标 ， 起终点纵坐标 ， 颜色值 ）
- 功能说明：在指定位置画一条指定颜色的水平线。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点横坐标 | 必填 | 整数型 |  |
| 终点横坐标 | 必填 | 整数型 |  |
| 起终点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画线的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画水平线”命令，在指定页面中画一条水平直线。 参见 : 例程

**完整正文（站点原文转换）**

**画水平线 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一条指定颜色的水平线。

*语法：*  逻辑型  *页面*．画水平线 （起点横坐标， 终点横坐标， 起终点纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 起点横坐标 | 必需的 ； 整数型。 |
| 终点横坐标 | 必需的 ； 整数型。 |
| 起终点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画线的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd116.files/image003.gif)

说明:

通过“画水平线”命令，在指定页面中画一条水平直线。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画矩形

- 原文链接：https://esdn.ijingyi.com/title-14930.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画矩形 （ 左上点横坐标 ， 左上点纵坐标 ， 右下点横坐标 ， 右下点纵坐标 ， 颜色值 ）
- 功能说明：在指定位置画一个指定颜色的矩形。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左上点横坐标 | 必填 | 整数型 |  |
| 左上点纵坐标 | 必填 | 整数型 |  |
| 右下点横坐标 | 必填 | 整数型 |  |
| 右下点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画矩形的边框颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画矩形”命令，在页面中的指定位置画一个矩形 ( 非实心 ) 。 参见 : 例程

**完整正文（站点原文转换）**

**画矩形 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一个指定颜色的矩形。

*语法：*  逻辑型  *页面*．画矩形 （左上点横坐标， 左上点纵坐标， 右下点横坐标， 右下点纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 左上点横坐标 | 必需的 ； 整数型。 |
| 左上点纵坐标 | 必需的 ； 整数型。 |
| 右下点横坐标 | 必需的 ； 整数型。 |
| 右下点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画矩形的边框颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd117.files/image003.gif)

说明:

通过“画矩形”命令，在页面中的指定位置画一个矩形(非实心)。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 填充矩形

- 原文链接：https://esdn.ijingyi.com/title-14931.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．填充矩形 （ 左上点横坐标 ， 左上点纵坐标 ， 右下点横坐标 ， 右下点纵坐标 ， 颜色值 ）
- 功能说明：在指定位置填充一个指定颜色的矩形。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左上点横坐标 | 必填 | 整数型 |  |
| 左上点纵坐标 | 必填 | 整数型 |  |
| 右下点横坐标 | 必填 | 整数型 |  |
| 右下点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画矩形的填充颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“填充矩形”命令，用指定颜色填充页面中一块矩形区域。 参见 : 例程

**完整正文（站点原文转换）**

**填充矩形 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置填充一个指定颜色的矩形。

*语法：*  逻辑型  *页面*．填充矩形 （左上点横坐标， 左上点纵坐标， 右下点横坐标， 右下点纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 左上点横坐标 | 必需的 ； 整数型。 |
| 左上点纵坐标 | 必需的 ； 整数型。 |
| 右下点横坐标 | 必需的 ； 整数型。 |
| 右下点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画矩形的填充颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd118.files/image003.gif)

说明:

通过“填充矩形”命令，用指定颜色填充页面中一块矩形区域。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画线

- 原文链接：https://esdn.ijingyi.com/title-14932.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画线 （ 起点横坐标 ， 起点纵坐标 ， 终点横坐标 ， 终点纵坐标 ， 颜色值 ）
- 功能说明：画一条指定颜色的线段。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点横坐标 | 必填 | 整数型 |  |
| 起点纵坐标 | 必填 | 整数型 |  |
| 终点横坐标 | 必填 | 整数型 |  |
| 终点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画线的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画线”命令，在页面中的指定位置画一条线。 参见 : 例程

**完整正文（站点原文转换）**

**画线 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

画一条指定颜色的线段。

*语法：*  逻辑型  *页面*．画线 （起点横坐标， 起点纵坐标， 终点横坐标， 终点纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 起点横坐标 | 必需的 ； 整数型。 |
| 起点纵坐标 | 必需的 ； 整数型。 |
| 终点横坐标 | 必需的 ； 整数型。 |
| 终点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画线的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd119.files/image003.gif)

说明:

通过“画线”命令，在页面中的指定位置画一条线。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画反转线

- 原文链接：https://esdn.ijingyi.com/title-14933.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画反转线 （ 起点横坐标 ， 起点纵坐标 ， 终点横坐标 ， 终点纵坐标 ， 颜色值 ）
- 功能说明：在指定位置画一条反转的线段。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点横坐标 | 必填 | 整数型 |  |
| 起点纵坐标 | 必填 | 整数型 |  |
| 终点横坐标 | 必填 | 整数型 |  |
| 终点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画线的颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画反转线”命令，在页面上指定位置画一条反转线。 参见 : 例程

**完整正文（站点原文转换）**

**画反转线 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一条反转的线段。

*语法：*  逻辑型  *页面*．画反转线 （起点横坐标， 起点纵坐标， 终点横坐标， 终点纵坐标， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 起点横坐标 | 必需的 ； 整数型。 |
| 起点纵坐标 | 必需的 ； 整数型。 |
| 终点横坐标 | 必需的 ； 整数型。 |
| 终点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画线的颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd120.files/image003.gif)

说明:

通过“画反转线”命令，在页面上指定位置画一条反转线。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画圆

- 原文链接：https://esdn.ijingyi.com/title-14934.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画圆 （ 圆心横坐标 ， 圆心纵坐标 ， 半径长 ， 颜色值 ）
- 功能说明：在指定位置画一个圆。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 圆心横坐标 | 必填 | 整数型 |  |
| 圆心纵坐标 | 必填 | 整数型 |  |
| 半径长 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画圆的边框线颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画圆”命令，在页面指定位置画一个空心圆。 参见 : 例程

**完整正文（站点原文转换）**

**画圆 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一个圆。

*语法：*  逻辑型  *页面*．画圆 （圆心横坐标， 圆心纵坐标， 半径长， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 圆心横坐标 | 必需的 ； 整数型。 |
| 圆心纵坐标 | 必需的 ； 整数型。 |
| 半径长 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画圆的边框线颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd121.files/image003.gif)

说明:

通过“画圆”命令，在页面指定位置画一个空心圆。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 填充圆

- 原文链接：https://esdn.ijingyi.com/title-14935.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．填充圆 （ 圆心横坐标 ， 圆心纵坐标 ， 半径长 ， 颜色值 ）
- 功能说明：在指定位置填充一个指定颜色的圆。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 圆心横坐标 | 必填 | 整数型 |  |
| 圆心纵坐标 | 必填 | 整数型 |  |
| 半径长 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画圆的填充颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“填充圆”命令，在页面中用指定颜色填充一个圆形区域。 参见 : 例程

**完整正文（站点原文转换）**

**填充圆 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置填充一个指定颜色的圆。

*语法：*  逻辑型  *页面*．填充圆 （圆心横坐标， 圆心纵坐标， 半径长， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 圆心横坐标 | 必需的 ； 整数型。 |
| 圆心纵坐标 | 必需的 ； 整数型。 |
| 半径长 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画圆的填充颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd122.files/image003.gif)

说明:

通过“填充圆”命令，在页面中用指定颜色填充一个圆形区域。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 画圆角矩形

- 原文链接：https://esdn.ijingyi.com/title-14936.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．画圆角矩形 （ 左上点横坐标 ， 左上点纵坐标 ， 右下点横坐标 ， 右下点纵坐标 ， 圆角半径长 ， 颜色值 ）
- 功能说明：在指定位置画一个圆角矩形。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 左上点横坐标 | 必填 | 整数型 |  |
| 左上点纵坐标 | 必填 | 整数型 |  |
| 右下点横坐标 | 必填 | 整数型 |  |
| 右下点纵坐标 | 必填 | 整数型 |  |
| 圆角半径长 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 欲画圆角矩形的边框颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“画圆角矩形”命令，在页面中画一个空心圆角矩形。 参见 : 例程

**完整正文（站点原文转换）**

**画圆角矩形 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画一个圆角矩形。

*语法：*  逻辑型  *页面*．画圆角矩形 （左上点横坐标， 左上点纵坐标， 右下点横坐标， 右下点纵坐标， 圆角半径长， 颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 左上点横坐标 | 必需的 ； 整数型。 |
| 左上点纵坐标 | 必需的 ； 整数型。 |
| 右下点横坐标 | 必需的 ； 整数型。 |
| 右下点纵坐标 | 必需的 ； 整数型。 |
| 圆角半径长 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。欲画圆角矩形的边框颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd123.files/image003.gif)

说明:

通过“画圆角矩形”命令，在页面中画一个空心圆角矩形。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 填充页面

- 原文链接：https://esdn.ijingyi.com/title-14937.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．填充页面 （ 颜色值 ）
- 功能说明：用指定颜色填充整个页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 颜色值 | 必填 | 整数型 | 填充颜色值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“填充页面”命令，使用指定颜色将页面全部覆盖。 参见 : 例程

**完整正文（站点原文转换）**

**填充页面 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

用指定颜色填充整个页面。

*语法：*  逻辑型  *页面*．填充页面 （颜色值）

| 参数名 | 描 述 |
| --- | --- |
| 颜色值 | 必需的 ； 整数型。填充颜色值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd124.files/image003.gif)

说明:

通过“填充页面”命令，使用指定颜色将页面全部覆盖。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 写文字

- 原文链接：https://esdn.ijingyi.com/title-14938.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．写文字 （ 起点横坐标 ， 起点纵坐标 ， 颜色值 ， 输出文本 ）
- 功能说明：在指定位置画文字。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 起点横坐标 | 必填 | 整数型 |  |
| 起点纵坐标 | 必填 | 整数型 |  |
| 颜色值 | 必填 | 整数型 | 文本的颜色值。 |
| 输出文本 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“写文字”命令，在页面指定位置输出一段文字。 参见 : 例程

**完整正文（站点原文转换）**

**写文字 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定位置画文字。

*语法：*  逻辑型  *页面*．写文字 （起点横坐标， 起点纵坐标， 颜色值， 输出文本）

| 参数名 | 描 述 |
| --- | --- |
| 起点横坐标 | 必需的 ； 整数型。 |
| 起点纵坐标 | 必需的 ； 整数型。 |
| 颜色值 | 必需的 ； 整数型。文本的颜色值。 |
| 输出文本 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd126.files/image003.gif)

说明:

通过“写文字”命令，在页面指定位置输出一段文字。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 写区域文字

- 原文链接：https://esdn.ijingyi.com/title-14939.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．写区域文字 （ 输出文本 ， 颜色值 ， 区域 ）
- 功能说明：在指定的矩形区域内画文字。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 输出文本 | 必填 | 文本型 |  |
| 颜色值 | 必填 | 整数型 | 文本的颜色值。 |
| 区域 | 必填 | 矩形 | 输出文本的矩形区域。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“写区域文字”命令，在页面的指定区域内输出一段文字。 参见 : 例程

**完整正文（站点原文转换）**

**写区域文字 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

在指定的矩形区域内画文字。

*语法：*  逻辑型  *页面*．写区域文字 （输出文本， 颜色值， 区域）

| 参数名 | 描 述 |
| --- | --- |
| 输出文本 | 必需的 ； 文本型。 |
| 颜色值 | 必需的 ； 整数型。文本的颜色值。 |
| 区域 | 必需的 ； 矩形。输出文本的矩形区域。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd127.files/image003.gif)

说明:

通过“写区域文字”命令，在页面的指定区域内输出一段文字。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 保存

- 原文链接：https://esdn.ijingyi.com/title-14940.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．保存 （ 文件名 ）
- 功能说明：保存当前页面到一个位图文件。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名 | 必填 | 文本型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“保存”命令，将页面中显示的内容保存为位图。 参见 : 例程

**完整正文（站点原文转换）**

**保存 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

保存当前页面到一个位图文件。

*语法：*  逻辑型  *页面*．保存 （文件名）

| 参数名 | 描 述 |
| --- | --- |
| 文件名 | 必需的 ； 文本型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd128.files/image003.gif)

说明:

通过“保存”命令，将页面中显示的内容保存为位图。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 块复制

- 原文链接：https://esdn.ijingyi.com/title-14941.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点纵坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“块复制”命令，将页面中指定区域的内容复制到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。

*语法：*  逻辑型  *页面*．块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点纵坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd132.files/image003.gif)

说明:

通过“块复制”命令，将页面中指定区域的内容复制到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 锁定块复制

- 原文链接：https://esdn.ijingyi.com/title-14942.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．锁定块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面，这个方法应该被用在从系统内存页面复制到系统或视频内存页面，这个方法的优势是使用“锁定”方法，进行页面区域复制。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“锁定块复制”命令，以锁定方式复制页面中指定区域到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**锁定块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面，这个方法应该被用在从系统内存页面复制到系统或视频内存页面，这个方法的优势是使用“锁定”方法，进行页面区域复制。

*语法：*  逻辑型  *页面*．锁定块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd133.files/image003.gif)

说明:

通过“锁定块复制”命令，以锁定方式复制页面中指定区域到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14943.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“透空块复制”命令，将页面上指定区域的内容复制到目标页面中，页面中含有关键颜色的像素将不会被复制到目标页面中。 参见 : 例程

**完整正文（站点原文转换）**

**透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd134.files/image003.gif)

说明:

通过“透空块复制”命令，将页面上指定区域的内容复制到目标页面中，页面中含有关键颜色的像素将不会被复制到目标页面中。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 锁定透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14944.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．锁定透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果，这个方法应该被用在从系统内存页面复制到系统或视频内存页面，这个方法的优势是使用“锁定”方法，进行页面区域复制。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“锁定透空块复制”命令，将页面中指定区域已锁定方式复制到目标页面中。页面中含有关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**锁定透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果，这个方法应该被用在从系统内存页面复制到系统或视频内存页面，这个方法的优势是使用“锁定”方法，进行页面区域复制。

*语法：*  逻辑型  *页面*．锁定透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd135.files/image003.gif)

说明:

通过“锁定透空块复制”命令，将页面中指定区域已锁定方式复制到目标页面中。页面中含有关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 水平块复制

- 原文链接：https://esdn.ijingyi.com/title-14945.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．水平块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面，采用水平复制像素方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“水平块复制”命令，将本页面中指定区域以水平方式复制到目标页面中。 参见 : 例程

**完整正文（站点原文转换）**

**水平块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面，采用水平复制像素方式。

*语法：*  逻辑型  *页面*．水平块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd136.files/image003.gif)

说明:

通过“水平块复制”命令，将本页面中指定区域以水平方式复制到目标页面中。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 水平透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14946.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．水平透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“水平透空块复制”命令，将本页面中指定区域以水平方式复制到目标页面上。本页面中包含关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**水平透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．水平透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd137.files/image003.gif)

说明:

通过“水平透空块复制”命令，将本页面中指定区域以水平方式复制到目标页面上。本页面中包含关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 垂直块复制

- 原文链接：https://esdn.ijingyi.com/title-14947.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．垂直块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面，采用垂直复制像素方式。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“垂直块复制”命令，以垂直方式将本页面中指定区域复制到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**垂直块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面，采用垂直复制像素方式。

*语法：*  逻辑型  *页面*．垂直块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd138.files/image003.gif)

说明:

通过“垂直块复制”命令，以垂直方式将本页面中指定区域复制到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 垂直透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14948.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．垂直透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“垂直透空块复制”命令，将当前页面中指定区域的内容以垂直方式复制到目标页面上。复制时，包含当前页面的关键色将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**垂直透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．垂直透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd139.files/image003.gif)

说明:

通过“垂直透空块复制”命令，将当前页面中指定区域的内容以垂直方式复制到目标页面上。复制时，包含当前页面的关键色将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 半透明块复制

- 原文链接：https://esdn.ijingyi.com/title-14949.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．半透明块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并出现半透明效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“半透明块复制”命令，将当前页面中指定区域复制到目标页面中。复制到目标页面时将会有半透明效果。 参见 : 例程

**完整正文（站点原文转换）**

**半透明块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并出现半透明效果。

*语法：*  逻辑型  *页面*．半透明块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd140.files/image003.gif)

说明:

通过“半透明块复制”命令，将当前页面中指定区域复制到目标页面中。复制到目标页面时将会有半透明效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 半透明透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14950.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．半透明透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并出现半透明效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“半透明透空块复制”命令，将当前页面中指定区域内容复制到目标页面。在复制时含有当前页面关键色的像素将不会被复制。复制后会有半透明效果。 参见 : 例程

**完整正文（站点原文转换）**

**半透明透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并出现半透明效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．半透明透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd141.files/image003.gif)

说明:

通过“半透明透空块复制”命令，将当前页面中指定区域内容复制到目标页面。在复制时含有当前页面关键色的像素将不会被复制。复制后会有半透明效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 透明块复制

- 原文链接：https://esdn.ijingyi.com/title-14951.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．透明块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 透明值 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生透明效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 透明值 | 可空 | 整数型 | 取值范围在0到256之间，默认取值0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“透明块复制”命令，将当前页面中指定区域复制到目标页面中。复制时会根据透明值参数配置和目标页面混合的效果。 参见 : 例程

**完整正文（站点原文转换）**

**透明块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生透明效果。

*语法：*  逻辑型  *页面*．透明块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［透明值］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 透明值 | 可选的 ； 整数型。取值范围在0到256之间，默认取值0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd142.files/image003.gif)

说明:

通过“透明块复制”命令，将当前页面中指定区域复制到目标页面中。复制时会根据透明值参数配置和目标页面混合的效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 透明透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14952.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．透明透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 透明值 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生透明效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 透明值 | 可空 | 整数型 | 取值范围在0到256之间。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“透明透空块复制”命令，将当前页面指定区域复制到目标页面中。当前页面中含有关键色的像素将不会被复制。复制时，本命令会根据“透明值”参数配制与目标页面的混合效果。 参见 : 例程

**完整正文（站点原文转换）**

**透明透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生透明效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．透明透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［透明值］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 透明值 | 可选的 ； 整数型。取值范围在0到256之间。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd143.files/image003.gif)

说明:

通过“透明透空块复制”命令，将当前页面指定区域复制到目标页面中。当前页面中含有关键色的像素将不会被复制。复制时，本命令会根据“透明值”参数配制与目标页面的混合效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 遮蔽块复制

- 原文链接：https://esdn.ijingyi.com/title-14953.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．遮蔽块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 遮蔽值 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生阴影效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 遮蔽值 | 可空 | 整数型 | 取值范围在0到256之间，默认取值0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“遮蔽块复制”命令，将当前页面中指定区域的内容复制到目标页面上。复制时会根据“遮蔽值”参数配置遮蔽混合效果。 参见 : 例程

**完整正文（站点原文转换）**

**遮蔽块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生阴影效果。

*语法：*  逻辑型  *页面*．遮蔽块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［遮蔽值］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 遮蔽值 | 可选的 ； 整数型。取值范围在0到256之间，默认取值0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd144.files/image003.gif)

说明:

通过“遮蔽块复制”命令，将当前页面中指定区域的内容复制到目标页面上。复制时会根据“遮蔽值”参数配置遮蔽混合效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 遮蔽透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14954.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．遮蔽透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 遮蔽值 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生阴影效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 遮蔽值 | 可空 | 整数型 | 取值范围在0到256之间，默认取值0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“遮蔽透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。复制时根据“遮蔽值”配置与目标页面遮蔽混合效果。当前页面中与关键色相同的像素将不会被复制到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**遮蔽透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并根据参数产生阴影效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．遮蔽透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［遮蔽值］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 遮蔽值 | 可选的 ； 整数型。取值范围在0到256之间，默认取值0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd145.files/image003.gif)

说明:

通过“遮蔽透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。复制时根据“遮蔽值”配置与目标页面遮蔽混合效果。当前页面中与关键色相同的像素将不会被复制到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 半遮蔽块复制

- 原文链接：https://esdn.ijingyi.com/title-14955.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．半遮蔽块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并产生半遮蔽阴影效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“半遮蔽块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制中，会和目标页面的内容以 1 ： 1 混合像素遮蔽效果。 参见 : 例程

**完整正文（站点原文转换）**

**半遮蔽块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并产生半遮蔽阴影效果。

*语法：*  逻辑型  *页面*．半遮蔽块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd146.files/image003.gif)

说明:

通过“半遮蔽块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制中，会和目标页面的内容以1：1混合像素遮蔽效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 半遮蔽透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14956.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．半遮蔽透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并产生半遮蔽阴影效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“半遮蔽透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时当前页面和目标页面会以 1 ： 1 方式混合遮蔽效果。复制时当前页面中含有关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**半遮蔽透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面上的像素颜色覆盖到目的页面上，并产生半遮蔽阴影效果。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．半遮蔽透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd147.files/image003.gif)

说明:

通过“半遮蔽透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时当前页面和目标页面会以1：1方式混合遮蔽效果。复制时当前页面中含有关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 多透明透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14957.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．多透明透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ）
- 功能说明：从当前页面复制一块像素区域到目的页面。源页面复制到目的页面上将产生透明效果，每个像素的透明效果都根据页面的已经设置的透明掩体位来决定。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“多透明透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时，会根据页面所有的透明掩体自定义透空（透明）的效果。 参见 : 例程

**完整正文（站点原文转换）**

**多透明透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块像素区域到目的页面。源页面复制到目的页面上将产生透明效果，每个像素的透明效果都根据页面的已经设置的透明掩体位来决定。源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．多透明透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd148.files/image003.gif)

说明:

通过“多透明透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时，会根据页面所有的透明掩体自定义透空（透明）的效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 缩放透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14958.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．缩放透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 比例因子 ］ ）
- 功能说明：从当前页面复制一块经过一定比例的放大或缩小的像素区域到目的页面。比例因子小于1则为缩小源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 比例因子 | 可空 | 小数型 | 块复制过程中的放大或缩小比例值。默认值为1。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“缩放透空块复制”命令，将当前页面上指定区域的内容以指定缩放比例复制到目标页面上。当前页面中含有关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**缩放透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块经过一定比例的放大或缩小的像素区域到目的页面。比例因子小于1则为缩小源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．缩放透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［比例因子］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 比例因子 | 可选的 ； 小数型。块复制过程中的放大或缩小比例值。默认值为1。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd149.files/image003.gif)

说明:

通过“缩放透空块复制”命令，将当前页面上指定区域的内容以指定缩放比例复制到目标页面上。当前页面中含有关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 缩放块复制

- 原文链接：https://esdn.ijingyi.com/title-14959.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．缩放块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， 比例因子 ）
- 功能说明：从当前页面复制一块经过一定比例的放大或缩小的像素区域到目的页面。比例因子小于1则为缩小。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 比例因子 | 必填 | 小数型 | 块复制过程中的放大或缩小比例值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“缩放块复制”命令，将当前页面中指定区域的内容以“比例因子”参数所设置的效果复制到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**缩放块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

从当前页面复制一块经过一定比例的放大或缩小的像素区域到目的页面。比例因子小于1则为缩小。

*语法：*  逻辑型  *页面*．缩放块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， 比例因子）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 比例因子 | 必需的 ； 小数型。块复制过程中的放大或缩小比例值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd150.files/image003.gif)

说明:

通过“缩放块复制”命令，将当前页面中指定区域的内容以“比例因子”参数所设置的效果复制到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 拉伸块复制

- 原文链接：https://esdn.ijingyi.com/title-14960.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．拉伸块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 宽度 ］ ， ［ 高度 ］ ）
- 功能说明：将源页面的像素块拉伸后复制到目的页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 宽度 | 可空 | 整数型 | 目的页面上的块复制矩形区域的宽度。默认值为0。 |
| 高度 | 可空 | 整数型 | 目的页面上的块复制矩形区域的高度。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“拉伸块复制”命令，将当前页面中指定区域的内容拉伸到指定大小后复制到目标页面上。 参见 : 例程

**完整正文（站点原文转换）**

**拉伸块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

将源页面的像素块拉伸后复制到目的页面。

*语法：*  逻辑型  *页面*．拉伸块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［宽度］， ［高度］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 宽度 | 可选的 ； 整数型。目的页面上的块复制矩形区域的宽度。默认值为0。 |
| 高度 | 可选的 ； 整数型。目的页面上的块复制矩形区域的高度。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd151.files/image003.gif)

说明:

通过“拉伸块复制”命令，将当前页面中指定区域的内容拉伸到指定大小后复制到目标页面上。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 拉伸透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14961.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．拉伸透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 宽度 ］ ， ［ 高度 ］ ）
- 功能说明：将源页面的像素块拉伸后复制到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 宽度 | 可空 | 整数型 | 目的页面上的块复制矩形区域的宽度。默认值为0。 |
| 高度 | 可空 | 整数型 | 目的页面上的块复制矩形区域的高度。默认值为0。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“拉伸透空块复制”命令，将当前页面中指定区域的内容拉伸后复制到目标页面上。在复制时，当前页面含有关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**拉伸透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

将源页面的像素块拉伸后复制到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．拉伸透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［宽度］， ［高度］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 宽度 | 可选的 ； 整数型。目的页面上的块复制矩形区域的宽度。默认值为0。 |
| 高度 | 可选的 ； 整数型。目的页面上的块复制矩形区域的高度。默认值为0。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd152.files/image003.gif)

说明:

通过“拉伸透空块复制”命令，将当前页面中指定区域的内容拉伸后复制到目标页面上。在复制时，当前页面含有关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 淡入

- 原文链接：https://esdn.ijingyi.com/title-14962.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．淡入 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， ［ 淡入因子 ］ ）
- 功能说明：源页面的全部或一部分淡入到目的页面中。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的淡入起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的淡入起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。默认为源页面的整个大小。 |
| 淡入因子 | 可空 | 整数型 | 取值范围在0到256之间。默认值为0。256代表没有淡入，完全显示源页面的像素内容；0代表纯黑，看不到源页面。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“淡入”命令，将当前页面指定区域以淡入方式复制到目标页面中。 参见 : 例程

**完整正文（站点原文转换）**

**淡入 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

源页面的全部或一部分淡入到目的页面中。

*语法：*  逻辑型  *页面*．淡入 （目的页面， 横坐标， 纵坐标， ［矩形区域］， ［淡入因子］）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的淡入起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的淡入起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。默认为源页面的整个大小。 |
| 淡入因子 | 可选的 ； 整数型。取值范围在0到256之间。默认值为0。256代表没有淡入，完全显示源页面的像素内容；0代表纯黑，看不到源页面。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd153.files/image003.gif)

说明:

通过“淡入”命令，将当前页面指定区域以淡入方式复制到目标页面中。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 缩放旋转块复制

- 原文链接：https://esdn.ijingyi.com/title-14963.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．缩放旋转块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， 转角 ， 缩放比例 ）
- 功能说明：将源页面按一定的角度旋转，一定的比例放缩后复制到目的页面。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。 |
| 转角 | 必填 | 小数型 | 源页面的转角。 |
| 缩放比例 | 必填 | 小数型 | 源页面的缩放比例。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“缩放旋转块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时会根据参数设定旋转和缩放的效果。 参见 : 例程

**完整正文（站点原文转换）**

**缩放旋转块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

将源页面按一定的角度旋转，一定的比例放缩后复制到目的页面。

*语法：*  逻辑型  *页面*．缩放旋转块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， 转角， 缩放比例）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。 |
| 转角 | 必需的 ； 小数型。源页面的转角。 |
| 缩放比例 | 必需的 ； 小数型。源页面的缩放比例。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd154.files/image003.gif)

说明:

通过“缩放旋转块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时会根据参数设定旋转和缩放的效果。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 缩放旋转透空块复制

- 原文链接：https://esdn.ijingyi.com/title-14964.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．缩放旋转透空块复制 （ 目的页面 ， 横坐标 ， 纵坐标 ， ［ 矩形区域 ］ ， 转角 ， 缩放比例 ）
- 功能说明：将源页面按一定的角度旋转，一定的比例放缩后复制到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 目的页面 | 必填 | 页面 |  |
| 横坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 纵坐标 | 必填 | 整数型 | 目的页面上的复制起点横坐标。 |
| 矩形区域 | 可空 | 矩形 | 源页面上的复制区域。 |
| 转角 | 必填 | 小数型 | 源页面的转角。 |
| 缩放比例 | 必填 | 小数型 | 源页面的缩放比例。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“缩放旋转透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时，根据参数设置缩放与旋转的效果；被复制的内容中包含关键色的像素将不会被复制。 参见 : 例程

**完整正文（站点原文转换）**

**缩放旋转透空块复制 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

将源页面按一定的角度旋转，一定的比例放缩后复制到目的页面，源页面上像素的颜色值如果和关键色相同，则不会被复制到目的页面，目的页面上出现透空效果。

*语法：*  逻辑型  *页面*．缩放旋转透空块复制 （目的页面， 横坐标， 纵坐标， ［矩形区域］， 转角， 缩放比例）

| 参数名 | 描 述 |
| --- | --- |
| 目的页面 | 必需的 ； 页面。 |
| 横坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 纵坐标 | 必需的 ； 整数型。目的页面上的复制起点横坐标。 |
| 矩形区域 | 可选的 ； 矩形。源页面上的复制区域。 |
| 转角 | 必需的 ； 小数型。源页面的转角。 |
| 缩放比例 | 必需的 ； 小数型。源页面的缩放比例。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd155.files/image003.gif)

说明:

通过“缩放旋转透空块复制”命令，将当前页面中指定区域的内容复制到目标页面上。在复制时，根据参数设置缩放与旋转的效果；被复制的内容中包含关键色的像素将不会被复制。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 置关键色

- 原文链接：https://esdn.ijingyi.com/title-14965.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．置关键色 （ 关键色 ）
- 功能说明：设置关键颜色，关键颜色在页面透空复制的时候会完全透明。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 关键色 | 必填 | 整数型 |  |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd156.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd156.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置关键色”命令，设置当前页面的关键颜色，用于透空处理时过滤。 参见 : 例程

**完整正文（站点原文转换）**

**置关键色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置关键颜色，关键颜色在页面透空复制的时候会完全透明。

*语法：*  逻辑型  *页面*．置关键色 （关键色）

| 参数名 | 描 述 |
| --- | --- |
| 关键色 | 必需的 ； 整数型。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd156.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd156.files/image002.gif)

说明:

通过“置关键色”命令，设置当前页面的关键颜色，用于透空处理时过滤。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 置顶点关键色

- 原文链接：https://esdn.ijingyi.com/title-14966.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．置顶点关键色 （ ）
- 功能说明：设置页面左上顶点的像素颜色为关键色，关键颜色在画到屏幕上的时候会透明。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置顶点关键色”命令，指定页面中左上角点的颜色作为关键色。 参见 : 例程

**完整正文（站点原文转换）**

**置顶点关键色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置页面左上顶点的像素颜色为关键色，关键颜色在画到屏幕上的时候会透明。

*语法：*  逻辑型  *页面*．置顶点关键色 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image002.gif)

说明:

通过“置顶点关键色”命令，指定页面中左上角点的颜色作为关键色。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A22.e)

---

### 取关键色

- 原文链接：https://esdn.ijingyi.com/title-14967.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：整数型
- 语法：整数型 页面 ．取关键色 （ ）
- 功能说明：取当前页面的关键色。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image002.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取关键色”命令，获取当前页面对象中关键颜色的颜色值。 参见 : 例程

**完整正文（站点原文转换）**

**取关键色 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

取当前页面的关键色。

*语法：*  整数型  *页面*．取关键色 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd157.files/image002.gif)

说明:

通过“取关键色”命令，获取当前页面对象中关键颜色的颜色值。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A22.e)

---

### 选择字体

- 原文链接：https://esdn.ijingyi.com/title-14968.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．选择字体 （ 字体名称 ， 字体宽度 ， 字体高度 ， ［ 字体属性 ］ ）
- 功能说明：选择输出文字的字体。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 字体名称 | 必填 | 文本型 |  |
| 字体宽度 | 必填 | 整数型 | 单位为像素。 |
| 字体高度 | 必填 | 整数型 | 单位为像素。 |
| 字体属性 | 可空 | 整数型 | 取值范围在0到1000。默认为普通字体。例如：400是普通字体，1000是粗体。 |

- 参见：语法的描述规则、基本数据类型

**注意事项/说明**

通过“选择字体”命令，设置写文字时输出文字的字体。 参见: 例程

**完整正文（站点原文转换）**

**选择字体 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

选择输出文字的字体。

*语法：*  逻辑型  *页面*．选择字体 （字体名称， 字体宽度， 字体高度， ［字体属性］）

| 参数名 | 描 述 |
| --- | --- |
| 字体名称 | 必需的 ； 文本型。 |
| 字体宽度 | 必需的 ； 整数型。单位为像素。 |
| 字体高度 | 必需的 ； 整数型。单位为像素。 |
| 字体属性 | 可选的 ； 整数型。取值范围在0到1000。默认为普通字体。例如：400是普通字体，1000是粗体。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

**例程:**

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd160.files/image001.gif)

**说明:**

通过“选择字体”命令，设置写文字时输出文字的字体。

***参见:***[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 设置字体

- 原文链接：https://esdn.ijingyi.com/title-14969.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．设置字体 （ ）
- 功能说明：设置已经被选入设备环境中的字体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“设置字体”命令，将选择好的字体设置载入页面对象。这预示着下一次输出文字操作已经确定要使用该字体设置。 参见 : 例程

**完整正文（站点原文转换）**

**设置字体 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置已经被选入设备环境中的字体。

*语法：*  逻辑型  *页面*．设置字体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd161.files/image003.gif)

说明:

通过“设置字体”命令，将选择好的字体设置载入页面对象。这预示着下一次输出文字操作已经确定要使用该字体设置。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 锁定

- 原文链接：https://esdn.ijingyi.com/title-14970.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．锁定 （ ）
- 功能说明：锁定页面。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“锁定”命令，把当前页面锁定，不允许页面进行交换操作。 参见 : 例程

**完整正文（站点原文转换）**

**锁定 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

锁定页面。

*语法：*  逻辑型  *页面*．锁定 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd162.files/image003.gif)

说明:

通过“锁定”命令，把当前页面锁定，不允许页面进行交换操作。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 解锁

- 原文链接：https://esdn.ijingyi.com/title-14971.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．解锁 （ ）
- 功能说明：解除已经锁定的页面。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“解锁”命令，将当前页面解锁，允许页面的交换操作。 参见 : 例程

**完整正文（站点原文转换）**

**解锁 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

解除已经锁定的页面。

*语法：*  逻辑型  *页面*．解锁 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd163.files/image003.gif)

说明:

通过“解锁”命令，将当前页面解锁，允许页面的交换操作。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 取宽度

- 原文链接：https://esdn.ijingyi.com/title-14972.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：整数型
- 语法：整数型 页面 ．取宽度 （ ）
- 功能说明：取页面宽度。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取宽度”命令，获取当前页面的宽度。 参见 : 例程

**完整正文（站点原文转换）**

**取宽度 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

取页面宽度。

*语法：*  整数型  *页面*．取宽度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd168.files/image003.gif)

说明:

通过“取宽度”命令，获取当前页面的宽度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 取高度

- 原文链接：https://esdn.ijingyi.com/title-14973.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：整数型
- 语法：整数型 页面 ．取高度 （ ）
- 功能说明：取页面高度。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取高度”命令，获取当前页面的高度。 参见 : 例程

**完整正文（站点原文转换）**

**取高度 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

取页面高度。

*语法：*  整数型  *页面*．取高度 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd169.files/image003.gif)

说明:

通过“取高度”命令，获取当前页面的高度。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 取透明掩体

- 原文链接：https://esdn.ijingyi.com/title-14974.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：字节型数组
- 语法：字节型数组 页面 ．取透明掩体 （ ）
- 功能说明：取当前页面的透明掩体。

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“取透明掩体”命令，获取当前页面所具有的透明及透空掩体数据。 参见 : 例程

**完整正文（站点原文转换）**

**取透明掩体 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

取当前页面的透明掩体。

*语法：*  字节型数组  *页面*．取透明掩体 （）

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd178.files/image003.gif)

说明:

通过“取透明掩体”命令，获取当前页面所具有的透明及透空掩体数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 置透明掩体

- 原文链接：https://esdn.ijingyi.com/title-14975.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．置透明掩体 （ 透明掩体数据 ）
- 功能说明：设置当前页面的透明掩体，设置页面上面的每一个点的透明比例。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 透明掩体数据 | 必填 | 字节型，参数数据只能提供数组数据 | 数组大小为页面的宽度和高度的乘积，也就是所有的象素点都对应一个透明值。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“置透明掩体”命令，设置用于“多透明透空块复制”命令的透空和透明掩体数据。 参见 : 例程

**完整正文（站点原文转换）**

**置透明掩体 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

设置当前页面的透明掩体，设置页面上面的每一个点的透明比例。

*语法：*  逻辑型  *页面*．置透明掩体 （透明掩体数据）

| 参数名 | 描 述 |
| --- | --- |
| 透明掩体数据 | 必需的 ； 字节型，参数数据只能提供数组数据。数组大小为页面的宽度和高度的乘积，也就是所有的象素点都对应一个透明值。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd179.files/image003.gif)

说明:

通过“置透明掩体”命令，设置用于“多透明透空块复制”命令的透空和透明掩体数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 重装入位图

- 原文链接：https://esdn.ijingyi.com/title-14976.html
- 操作系统支持：Windows 所属对象： 页面
- 返回值类型：逻辑型
- 语法：逻辑型 页面 ．重装入位图 （ 文件名称 ）
- 功能说明：重新装入位图。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 文件名称 | 必填 | 文本型 | 位图的文件名称。 |

- 参见：语法的描述规则、基本数据类型

**例程**

:

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image001.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image002.gif)

![例程截图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image003.gif)

> 注：例程在源站点为截图图片，可点击原文链接查看。

**注意事项/说明**

: 通过“重装入位图”命令，重新设置一个位图页面中位图数据。 参见 : 例程

**完整正文（站点原文转换）**

**重装入位图 方法**   操作系统支持：Windows    所属对象：[页面](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/dt10.htm)

重新装入位图。

*语法：*  逻辑型  *页面*．重装入位图 （文件名称）

| 参数名 | 描 述 |
| --- | --- |
| 文件名称 | 必需的 ； 文本型。位图的文件名称。 |

　

*参见：*[语法的描述规则](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/rule.htm)、[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

例程:

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image001.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image002.gif)

![站点例程/配图](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/cmd186.files/image003.gif)

说明:

通过“重装入位图”命令，重新设置一个位图页面中位图数据。

参见:[例程](https://esdn.ijingyi.com/source/plugin/eknow/resource/EdirectX//EdirectX/%E9%A1%B5%E9%9D%A2.e)

---

### 调色板单元

- 原文链接：https://esdn.ijingyi.com/title-14814.html
- 操作系统支持：Windows 跳至： DirectX2D支持库
- 功能说明：调色板中的一个单元。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 红色值 | 待核实 | 待核实 | 整数型； 调色板单元颜色中红色的值。 |
| 绿色值 | 待核实 | 待核实 | 整数型； 调色板单元颜色中绿色的值。 |
| 兰色值 | 待核实 | 待核实 | 整数型； 调色板单元颜色中兰色的值。 |
| 透明值 | 待核实 | 待核实 | 整数型； 调色板单元颜色中透明值。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**调色板单元 普通类型**   操作系统支持：Windows    跳至：[DirectX2D支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/index.htm)

调色板中的一个单元。

| 成员 | 描 述 |
| --- | --- |
| 红色值 | 整数型； 调色板单元颜色中红色的值。 |
| 绿色值 | 整数型； 调色板单元颜色中绿色的值。 |
| 兰色值 | 整数型； 调色板单元颜色中兰色的值。 |
| 透明值 | 整数型； 调色板单元颜色中透明值。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 矩形

- 原文链接：https://esdn.ijingyi.com/title-14815.html
- 操作系统支持：Windows 跳至： DirectX2D支持库
- 功能说明：矩形的区域。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 左边 | 待核实 | 待核实 | 整数型； 矩形的左边X坐标值。 |
| 顶边 | 待核实 | 待核实 | 整数型； 矩形的顶边Y坐标值。 |
| 右边 | 待核实 | 待核实 | 整数型； 矩形的右边X坐标值。 |
| 底边 | 待核实 | 待核实 | 整数型； 矩形的底边Y坐标值。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**矩形 普通类型**   操作系统支持：Windows    跳至：[DirectX2D支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/index.htm)

矩形的区域。

| 成员 | 描 述 |
| --- | --- |
| 左边 | 整数型； 矩形的左边X坐标值。 |
| 顶边 | 整数型； 矩形的顶边Y坐标值。 |
| 右边 | 整数型； 矩形的右边X坐标值。 |
| 底边 | 整数型； 矩形的底边Y坐标值。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 键值常量

- 原文链接：https://esdn.ijingyi.com/title-14816.html
- 操作系统支持：Windows 跳至： DirectX2D支持库
- 功能说明：一些有关键值的常量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 键BACKSPACE | 待核实 | 待核实 | 常量值为 8 。BACKSPACE键。 |
| 键TAB | 待核实 | 待核实 | 常量值为 9 。TAB键。 |
| 键回车 | 待核实 | 待核实 | 常量值为 13 。回车键。 |
| 键ESCAPE | 待核实 | 待核实 | 常量值为 27 。ESCAPE键。 |
| 键SPACE | 待核实 | 待核实 | 常量值为 32 。SPACE键。 |
| 键叹号 | 待核实 | 待核实 | 常量值为 33 。叹号(!)键。 |
| 键单引号 | 待核实 | 待核实 | 常量值为 34 。'键。 |
| 键井号 | 待核实 | 待核实 | 常量值为 35 。井号(#)键。 |
| 键美元符 | 待核实 | 待核实 | 常量值为 36 。$键。 |
| 键百分号 | 待核实 | 待核实 | 常量值为 37 。%键。 |
| 键宏号 | 待核实 | 待核实 | 常量值为 38 。&键。 |
| 键左小括号 | 待核实 | 待核实 | 常量值为 40 。(键。 |
| 键右小括号 | 待核实 | 待核实 | 常量值为 41 。)键。 |
| 键星号 | 待核实 | 待核实 | 常量值为 42 。*键。 |
| 键加号 | 待核实 | 待核实 | 常量值为 43 。+键。 |
| 键小于号 | 待核实 | 待核实 | 常量值为 44 。<键。 |
| 键减号 | 待核实 | 待核实 | 常量值为 45 。-键。 |
| 键句号 | 待核实 | 待核实 | 常量值为 46 。.键。 |
| 键除号 | 待核实 | 待核实 | 常量值为 47 。/键。 |
| 键0 | 待核实 | 待核实 | 常量值为 48 。0键。 |
| 键1 | 待核实 | 待核实 | 常量值为 49 。1键。 |
| 键2 | 待核实 | 待核实 | 常量值为 50 。2键。 |
| 键3 | 待核实 | 待核实 | 常量值为 51 。3键。 |
| 键4 | 待核实 | 待核实 | 常量值为 52 。4键。 |
| 键5 | 待核实 | 待核实 | 常量值为 53 。5键。 |
| 键6 | 待核实 | 待核实 | 常量值为 54 。6键。 |
| 键7 | 待核实 | 待核实 | 常量值为 55 。7键。 |
| 键8 | 待核实 | 待核实 | 常量值为 56 。8键。 |
| 键9 | 待核实 | 待核实 | 常量值为 57 。9键。 |
| 键COLON | 待核实 | 待核实 | 常量值为 58 。和DirectX中的DIK_COLON键对应。 |
| 键分号 | 待核实 | 待核实 | 常量值为 59 。;键。 |
| 键逗号 | 待核实 | 待核实 | 常量值为 60 。,键。 |
| 键等号 | 待核实 | 待核实 | 常量值为 61 。=键。 |
| 键AT | 待核实 | 待核实 | 常量值为 64 。AT键,注:和DirectX的DIK_AT键对应。 |
| 键A | 待核实 | 待核实 | 常量值为 65 。A键。 |
| 键B | 待核实 | 待核实 | 常量值为 66 。B键。 |
| 键C | 待核实 | 待核实 | 常量值为 67 。C键。 |
| 键D | 待核实 | 待核实 | 常量值为 68 。D键。 |
| 键E | 待核实 | 待核实 | 常量值为 69 。E键。 |
| 键F | 待核实 | 待核实 | 常量值为 70 。F键。 |
| 键G | 待核实 | 待核实 | 常量值为 71 。G键。 |
| 键H | 待核实 | 待核实 | 常量值为 72 。H键。 |
| 键I | 待核实 | 待核实 | 常量值为 73 。I键。 |
| 键J | 待核实 | 待核实 | 常量值为 74 。J键。 |
| 键K | 待核实 | 待核实 | 常量值为 75 。K键。 |
| 键L | 待核实 | 待核实 | 常量值为 76 。L键。 |
| 键M | 待核实 | 待核实 | 常量值为 77 。M键。 |
| 键N | 待核实 | 待核实 | 常量值为 78 。N键。 |
| 键O | 待核实 | 待核实 | 常量值为 79 。O键。 |
| 键P | 待核实 | 待核实 | 常量值为 80 。P键。 |
| 键Q | 待核实 | 待核实 | 常量值为 81 。Q键。 |
| 键R | 待核实 | 待核实 | 常量值为 82 。R键。 |
| 键S | 待核实 | 待核实 | 常量值为 83 。S键。 |
| 键T | 待核实 | 待核实 | 常量值为 84 。T键。 |
| 键U | 待核实 | 待核实 | 常量值为 85 。U键。 |
| 键V | 待核实 | 待核实 | 常量值为 86 。V键。 |
| 键W | 待核实 | 待核实 | 常量值为 87 。W键。 |
| 键X | 待核实 | 待核实 | 常量值为 88 。X键。 |
| 键Y | 待核实 | 待核实 | 常量值为 89 。Y键。 |
| 键Z | 待核实 | 待核实 | 常量值为 90 。Z键。 |
| 键左中括号 | 待核实 | 待核实 | 常量值为 91 。[键。 |
| 键右斜杠 | 待核实 | 待核实 | 常量值为 92 。\键。 |
| 键右中括号 | 待核实 | 待核实 | 常量值为 93 。]键。 |
| 键乘方 | 待核实 | 待核实 | 常量值为 94 。^键。 |
| 键下划线 | 待核实 | 待核实 | 常量值为 95 。下划线键。 |
| 键上顿号 | 待核实 | 待核实 | 常量值为 96 。`键。 |
| 键a | 待核实 | 待核实 | 常量值为 97 。a键。 |
| 键b | 待核实 | 待核实 | 常量值为 98 。b键。 |
| 键c | 待核实 | 待核实 | 常量值为 99 。c键。 |
| 键d | 待核实 | 待核实 | 常量值为 100 。d键。 |
| 键e | 待核实 | 待核实 | 常量值为 101 。e键。 |
| 键f | 待核实 | 待核实 | 常量值为 102 。f键。 |
| 键g | 待核实 | 待核实 | 常量值为 103 。g键。 |
| 键h | 待核实 | 待核实 | 常量值为 104 。h键。 |
| 键i | 待核实 | 待核实 | 常量值为 105 。i键。 |
| 键j | 待核实 | 待核实 | 常量值为 106 。j键。 |
| 键k | 待核实 | 待核实 | 常量值为 107 。k键。 |
| 键l | 待核实 | 待核实 | 常量值为 108 。l键。 |
| 键m | 待核实 | 待核实 | 常量值为 109 。m键。 |
| 键n | 待核实 | 待核实 | 常量值为 110 。n键。 |
| 键o | 待核实 | 待核实 | 常量值为 111 。o键。 |
| 键p | 待核实 | 待核实 | 常量值为 112 。p键。 |
| 键q | 待核实 | 待核实 | 常量值为 113 。q键。 |
| 键r | 待核实 | 待核实 | 常量值为 114 。r键。 |
| 键s | 待核实 | 待核实 | 常量值为 115 。s键。 |
| 键t | 待核实 | 待核实 | 常量值为 116 。t键。 |
| 键u | 待核实 | 待核实 | 常量值为 117 。u键。 |
| 键v | 待核实 | 待核实 | 常量值为 118 。v键。 |
| 键w | 待核实 | 待核实 | 常量值为 119 。w键。 |
| 键x | 待核实 | 待核实 | 常量值为 120 。x键。 |
| 键y | 待核实 | 待核实 | 常量值为 121 。y键。 |
| 键z | 待核实 | 待核实 | 常量值为 122 。z键。 |
| 键左大括号 | 待核实 | 待核实 | 常量值为 123 。左大括号键。 |
| 键竖杠 | 待核实 | 待核实 | 常量值为 124 。\|键。 |
| 键右大括号 | 待核实 | 待核实 | 常量值为 125 。}键。 |
| 键小波浪 | 待核实 | 待核实 | 常量值为 126 。~键。 |
| 键DELETE | 待核实 | 待核实 | 常量值为 127 。DELETE键。 |
| 键左SHIFT | 待核实 | 待核实 | 常量值为 128 。左SHIFT键。 |
| 键右SHIFT | 待核实 | 待核实 | 常量值为 129 。右SHIFT键。 |
| 键左CTRL | 待核实 | 待核实 | 常量值为 130 。左CTRL键。 |
| 键右CTRL | 待核实 | 待核实 | 常量值为 131 。右CTRL键。 |
| 键左ALT | 待核实 | 待核实 | 常量值为 132 。左ALT键。 |
| 键右ALT | 待核实 | 待核实 | 常量值为 133 。右ALT键。 |
| 键左方向 | 待核实 | 待核实 | 常量值为 134 。左方向键。 |
| 键右方向 | 待核实 | 待核实 | 常量值为 135 。右方向键。 |
| 键上方向 | 待核实 | 待核实 | 常量值为 136 。上方向键。 |
| 键下方向 | 待核实 | 待核实 | 常量值为 137 。下方向键。 |
| 键F1 | 待核实 | 待核实 | 常量值为 138 。F1键。 |
| 键F2 | 待核实 | 待核实 | 常量值为 139 。F2键。 |
| 键F3 | 待核实 | 待核实 | 常量值为 140 。F3键。 |
| 键F4 | 待核实 | 待核实 | 常量值为 141 。F4键。 |
| 键F5 | 待核实 | 待核实 | 常量值为 142 。F5键。 |
| 键F6 | 待核实 | 待核实 | 常量值为 143 。F6键。 |
| 键F7 | 待核实 | 待核实 | 常量值为 144 。F7键。 |
| 键F8 | 待核实 | 待核实 | 常量值为 145 。F8键。 |
| 键F9 | 待核实 | 待核实 | 常量值为 146 。F9键。 |
| 键F10 | 待核实 | 待核实 | 常量值为 147 。F10键。 |
| 键F11 | 待核实 | 待核实 | 常量值为 148 。F11键。 |
| 键F12 | 待核实 | 待核实 | 常量值为 149 。F12键。 |
| 键INS | 待核实 | 待核实 | 常量值为 150 。INS键。 |
| 键DEL | 待核实 | 待核实 | 常量值为 151 。DEL键。 |
| 键HOME | 待核实 | 待核实 | 常量值为 152 。HOME键。 |
| 键END | 待核实 | 待核实 | 常量值为 153 。END键。 |
| 键PageUp | 待核实 | 待核实 | 常量值为 154 。page up键。 |
| 键PageDown | 待核实 | 待核实 | 常量值为 155 。page down键。 |
| 键小键盘除号 | 待核实 | 待核实 | 常量值为 156 。小键盘/键。 |
| 键小键盘乘号 | 待核实 | 待核实 | 常量值为 157 。小键盘*键。 |
| 键小键盘减号 | 待核实 | 待核实 | 常量值为 158 。小键盘-键。 |
| 键小键盘加号 | 待核实 | 待核实 | 常量值为 159 。小键盘+键。 |
| 键小键盘回车 | 待核实 | 待核实 | 常量值为 160 。小键盘回车键。 |
| 键小键盘句号 | 待核实 | 待核实 | 常量值为 161 。小键盘.键。 |
| 键小键盘0 | 待核实 | 待核实 | 常量值为 162 。小键盘0键。 |
| 键小键盘1 | 待核实 | 待核实 | 常量值为 163 。小键盘1键。 |
| 键小键盘2 | 待核实 | 待核实 | 常量值为 164 。小键盘2键。 |
| 键小键盘3 | 待核实 | 待核实 | 常量值为 165 。小键盘3键。 |
| 键小键盘4 | 待核实 | 待核实 | 常量值为 166 。小键盘4键。 |
| 键小键盘5 | 待核实 | 待核实 | 常量值为 167 。小键盘5键。 |
| 键小键盘6 | 待核实 | 待核实 | 常量值为 168 。小键盘6键。 |
| 键小键盘7 | 待核实 | 待核实 | 常量值为 169 。小键盘7键。 |
| 键小键盘8 | 待核实 | 待核实 | 常量值为 170 。小键盘8键。 |
| 键小键盘9 | 待核实 | 待核实 | 常量值为 171 。小键盘9键。 |
| 键NUMLOCK | 待核实 | 待核实 | 常量值为 172 。NUMLOCK键。 |
| 键CAPSLOCK | 待核实 | 待核实 | 常量值为 173 。CAPSLOCK键。 |
| 键SCROLLLOCK | 待核实 | 待核实 | 常量值为 174 。SCROLLLOCK键。 |
| 键PRINTSCRN | 待核实 | 待核实 | 常量值为 175 。PRINTSCRN键。 |
| 键PAUSE | 待核实 | 待核实 | 常量值为 176 。PAUSE键。 |
| 鼠标左击 | 待核实 | 待核实 | 常量值为 256 。鼠标左击。 |
| 鼠标右击 | 待核实 | 待核实 | 常量值为 257 。鼠标右击。 |
| 鼠标中键击 | 待核实 | 待核实 | 常量值为 258 。鼠标中键击。 |
| 鼠标键4 | 待核实 | 待核实 | 常量值为 259 。鼠标键4。 |
| 键控制器0 | 待核实 | 待核实 | 常量值为 260 。控制器0键。 |
| 键控制器1 | 待核实 | 待核实 | 常量值为 261 。控制器1键。 |
| 键控制器2 | 待核实 | 待核实 | 常量值为 262 。控制器2键。 |
| 键控制器3 | 待核实 | 待核实 | 常量值为 263 。控制器3键。 |
| 键控制器4 | 待核实 | 待核实 | 常量值为 264 。控制器4键。 |
| 键控制器5 | 待核实 | 待核实 | 常量值为 265 。控制器5键。 |
| 键控制器6 | 待核实 | 待核实 | 常量值为 266 。控制器6键。 |
| 键控制器7 | 待核实 | 待核实 | 常量值为 267 。控制器7键。 |
| 键控制器8 | 待核实 | 待核实 | 常量值为 268 。控制器8键。 |
| 键控制器9 | 待核实 | 待核实 | 常量值为 269 。控制器9键。 |
| 键总数 | 待核实 | 待核实 | 常量值为 273 。键总数。 |
| 键控制器10 | 待核实 | 待核实 | 常量值为 270 。控制器10键。 |
| 键控制器11 | 待核实 | 待核实 | 常量值为 271 。控制器11键。 |
| 键控制器12 | 待核实 | 待核实 | 常量值为 272 。控制器12键。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**键值常量 枚举常量集合类型**   操作系统支持：Windows    跳至：[DirectX2D支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/index.htm)

一些有关键值的常量。

| 成员 | 描 述 |
| --- | --- |
| 键BACKSPACE | 常量值为 8 。BACKSPACE键。 |
| 键TAB | 常量值为 9 。TAB键。 |
| 键回车 | 常量值为 13 。回车键。 |
| 键ESCAPE | 常量值为 27 。ESCAPE键。 |
| 键SPACE | 常量值为 32 。SPACE键。 |
| 键叹号 | 常量值为 33 。叹号(!)键。 |
| 键单引号 | 常量值为 34 。'键。 |
| 键井号 | 常量值为 35 。井号(#)键。 |
| 键美元符 | 常量值为 36 。$键。 |
| 键百分号 | 常量值为 37 。%键。 |
| 键宏号 | 常量值为 38 。&键。 |
| 键左小括号 | 常量值为 40 。(键。 |
| 键右小括号 | 常量值为 41 。)键。 |
| 键星号 | 常量值为 42 。*键。 |
| 键加号 | 常量值为 43 。+键。 |
| 键小于号 | 常量值为 44 。　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 声音常量

- 原文链接：https://esdn.ijingyi.com/title-14817.html
- 操作系统支持：Windows 跳至： DirectX2D支持库
- 功能说明：一些有关声音的常量。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 正常3D模式 | 待核实 | 待核实 | 常量值为 0 。正常3D处理模式。 |
| 关联3D模式 | 待核实 | 待核实 | 常量值为 1 。关联3D处理模式。 |
| 关闭3D模式 | 待核实 | 待核实 | 常量值为 2 。关闭3D处理模式。 |
| 左声道 | 待核实 | 待核实 | 常量值为 0 。 |
| 右声道 | 待核实 | 待核实 | 常量值为 1 。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**声音常量 枚举常量集合类型**   操作系统支持：Windows    跳至：[DirectX2D支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/index.htm)

一些有关声音的常量。

| 成员 | 描 述 |
| --- | --- |
| 正常3D模式 | 常量值为 0 。正常3D处理模式。 |
| 关联3D模式 | 常量值为 1 。关联3D处理模式。 |
| 关闭3D模式 | 常量值为 2 。关闭3D处理模式。 |
| 左声道 | 常量值为 0 。 |
| 右声道 | 常量值为 1 。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---

### 内存类别

- 原文链接：https://esdn.ijingyi.com/title-14818.html
- 操作系统支持：Windows 跳至： DirectX2D支持库
- 功能说明：创建页面的时候，选择新建页面所在的内存位置。

| 参数名 | 是否必填 | 参数类型 | 参数说明 |
| --- | --- | --- | --- |
| 成员 | 待核实 | 待核实 | 描 述 |
| 显存 | 待核实 | 待核实 | 常量值为 0 。 |
| 系统主存 | 待核实 | 待核实 | 常量值为 1 。 |
| 优化选择 | 待核实 | 待核实 | 常量值为 2 。优先选择显存，如果显存不符合要求，然后再选择系统主存。 |

- 参见：基本数据类型

**完整正文（站点原文转换）**

**内存类别 枚举常量集合类型**   操作系统支持：Windows    跳至：[DirectX2D支持库](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/EdirectX/index.htm)

创建页面的时候，选择新建页面所在的内存位置。

| 成员 | 描 述 |
| --- | --- |
| 显存 | 常量值为 0 。 |
| 系统主存 | 常量值为 1 。 |
| 优化选择 | 常量值为 2 。优先选择显存，如果显存不符合要求，然后再选择系统主存。 |

　

*参见：*[基本数据类型](https://esdn.ijingyi.com/source/plugin/eknow/resource5.3/datatype.htm)

---
