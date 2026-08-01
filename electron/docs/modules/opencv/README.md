# LingBuilder OpenCV 图像处理模块

`lingbuilder.opencv@1.0.0` 面向 Windows MSVC x64 项目，固定使用 OpenCV 4.14.0、动态 CRT `/MD`、C++17 和 CPU 模式。模块通过受管整数句柄与稳定 C ABI Bridge 工作，不向 `.lcpp` 暴露 `cv::Mat`、STL 或原生指针。

OpenCV 是新增的高级图像模块，不替换 LingBuilder 已有的 GDI+ 图像命令。缺口分析只处理用户提供或已获授权的本地图像，返回候选坐标；模块不包含浏览器控制、自动拖动或验证提交。

## 安装与构建

1. 在模块管理器中启用“OpenCV 图像处理模块”。
2. 首次开发或 SDK 缺失时，在 `electron` 目录运行 `npm run module:opencv-sdk -- --install`。
3. 构建目标必须选择 `windows-msvc-x64`。启用本模块后，Visual Studio 导出只生成 Debug/Release x64 配置。
4. F5、原生导出、AI Bridge 构建和源码包恢复会统一校验 SDK 清单与 SHA-256；缺失、架构错误或文件被修改会在编译前给出中文阻断诊断。

## 句柄与错误规则

- `OpenCV图像句柄` 和 `OpenCV结果句柄` 的底层都是受管 64 位整数。
- 图像处理命令返回新图像句柄，不修改输入图像。
- 失败返回 `0`、`假`、`-1` 或空文本，详细原因通过 `OpenCV_取错误()` 读取。
- 未发现候选不是执行错误：分析命令返回有效结果句柄，结果数量为 0。
- 最多同时保留 256 个图像和结果对象；单图最大 100MP。
- 不再使用的对象应分别调用 `OpenCV_释放图像`、`OpenCV结果_释放`，或在退出前调用 `OpenCV_释放全部`。

## 命令表

| 分组 | 命令 | 说明 |
| --- | --- | --- |
| 基础 | `OpenCV_取版本` | 返回 OpenCV 版本和 Bridge ABI。 |
| 基础 | `OpenCV_加载图像` | 通过宽字符文件访问和 `imdecode` 加载中文路径图像。 |
| 基础 | `OpenCV_保存图像` | 通过 `imencode` 保存 PNG/JPEG/BMP/WebP 等格式。 |
| 基础 | `OpenCV_克隆图像` | 深复制图像并返回新句柄。 |
| 基础 | `OpenCV_释放图像`、`OpenCV_释放全部` | 释放图像或全部受管对象。 |
| 信息 | `OpenCV_取宽度`、`OpenCV_取高度`、`OpenCV_取通道数` | 读取图像尺寸和通道数。 |
| 信息 | `OpenCV_取错误` | 读取当前线程最近一次失败的中文错误。 |
| 处理 | `OpenCV_灰度化`、`OpenCV_缩放`、`OpenCV_裁剪` | 常用几何和颜色处理。 |
| 处理 | `OpenCV_高斯模糊` | 卷积核必须是 1～31 的正奇数。 |
| 处理 | `OpenCV_二值化`、`OpenCV_自适应二值化` | 固定阈值、大津法或自适应阈值。 |
| 处理 | `OpenCV_Canny边缘`、`OpenCV_形态学` | 边缘与腐蚀、膨胀、开闭运算、梯度。 |
| 分析 | `OpenCV_模板匹配` | 返回模板候选矩形和归一化分数。 |
| 分析 | `OpenCV_查找轮廓` | 返回满足面积条件的外部轮廓候选。 |
| 分析 | `OpenCV_分析缺口` | 返回 1～8 个单/双缺口候选。 |
| 结果 | `OpenCV结果_取类型`、`OpenCV结果_取数量` | 读取结果类型和候选数。 |
| 结果 | `OpenCV结果_取横坐标`、`OpenCV结果_取纵坐标` | 读取候选左上角坐标。 |
| 结果 | `OpenCV结果_取宽度`、`OpenCV结果_取高度` | 读取候选矩形尺寸。 |
| 结果 | `OpenCV结果_取中心横坐标`、`OpenCV结果_取中心纵坐标` | 读取候选中心坐标。 |
| 结果 | `OpenCV结果_取置信度` | 读取 0～1 的候选置信度。 |
| 结果 | `OpenCV结果_取JSON` | 返回可保存或传递的 schemaVersion 1 JSON。 |
| 结果 | `OpenCV结果_保存标注图` | 保存带候选框、序号和分数的标注图。 |
| 结果 | `OpenCV结果_释放` | 释放分析结果。 |

## 缺口分析

```text
OpenCV_分析缺口(背景图像, 滑块图像, 候选数量, 配置JSON)
```

- `滑块图像=0`：使用边缘、形态学和轮廓筛选。
- 提供滑块图像：自动模式融合滑块边缘模板分数与背景轮廓分数。
- 单缺口通常传 1，双缺口传 2；允许范围为 1～8。
- 坐标始终相对原始背景图，即使配置了 ROI 也是如此。
- 结果按置信度降序、横坐标升序稳定排列，并执行候选间距和 IoU 重叠抑制。

默认配置：

```json
{
  "mode": "auto",
  "roiX": 0,
  "roiY": 0,
  "roiWidth": 0,
  "roiHeight": 0,
  "blurKernel": 5,
  "cannyLow": 50,
  "cannyHigh": 150,
  "morphKernel": 3,
  "minWidth": 10,
  "minHeight": 10,
  "maxWidth": 0,
  "maxHeight": 0,
  "minScore": 0.45,
  "minSeparation": 20,
  "nmsIou": 0.3
}
```

配置必须是不超过 16KB 的 JSON 对象。未知字段、错误类型、无效范围、偶数卷积核或越界 ROI 都会失败并返回中文错误。`roiWidth`、`roiHeight`、`maxWidth`、`maxHeight` 为 0 时表示使用完整范围或不设置上限。

完整 `.lcpp` 示例见 [OpenCV完整示例.lcpp](examples/OpenCV完整示例.lcpp)。

