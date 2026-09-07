# FBro 教程示例项目设计

## 目标

为《FBro 指纹浏览器合集》11 集口播稿准备可直接录制的独立 LingBuilder 示例项目。每个项目都能从源码、设计器模型和模块清单重新生成真实 C++/Win32 x64 Release 工程，并在本机可运行环境中完成与该集口播一致的演示链路。

## 范围与边界

- 覆盖 `AI 视频自主生产/FBro 指纹浏览器合集/01` 至 `11` 共 11 集。
- 每集目录新增独立 `示例项目/`，不通过运行时开关把多个主题塞进一个项目。
- FBro SDK、模块版本和生成器由现有 LingBuilder 工程提供；项目不携带本机 Profile、Cookie、缓存、Permit、Key、真实账号或绝对路径。
- 所有 `.lcpp` 控件参数使用裸 `controlRef`，事件处理器使用 `&处理器名`。
- 测试页、表单、CSS、JS、图片和公开下载文件集中放在合集根目录的 `共享测试资源/`，项目通过相对路径引用。
- 第 04 集只在授权环境中尝试真实 VIP 配置；没有有效授权时，项目仍需安全编译并展示可审查的中文失败诊断，禁止伪造授权成功。

## 项目布局

每集项目至少包含：

```text
示例项目/
  src/
    .lingbuilder/solution.json
    .lingbuilder/project-modules.json
    .lingbuilder/window-designer.json
    <入口>.lcpp
  config/<项目ID>/config.ini
  build-request.json
  README.md
  录制准备记录.md
  验证报告.md
```

合集根目录共享资源：

```text
共享测试资源/
  fbro-resource-demo/index.html
  fbro-resource-demo/style.css
  fbro-resource-demo/app.js
  fbro-resource-demo/logo.svg
  fbro-form/index.html
  downloads/lingbuilder-fbro-demo.txt
  fixtures/fbro-vip-sanitized.json
```

## 11 集功能映射

| 集数 | 项目重点 | 最低模块 |
| --- | --- | --- |
| 01 | 单控件导航与加载状态 | `win32.basic`、`fbro.browser`、`fbro.events` |
| 02 | 管理器、多实例、选项卡、地址栏、下载视图 | `win32.basic`、`win32.common-controls`、`fbro.browser`、`fbro.events`、`fbro.transfer` |
| 03 | 独立 Profile、工作区键、UserAgent、清理 | 02 模块 + `fbro.session` |
| 04 | 脱敏 VIP 指纹配置和失败诊断 | 01 模块 + `fbro.vip` |
| 05 | 三种宿主模式 | `win32.basic`、`fbro.browser` |
| 06 | 导航/弹窗事件、事件数据和延续 | 01 模块 + `fbro.events` |
| 07 | 资源响应 URL、状态码、MIME、完成统计 | 01 模块 + `fbro.events`、`fbro.network` |
| 08 | 独立进程、DevTools、调试端口和 CDP | 05 模块 + `cdp.client`、`fbro.automation` |
| 09 | 自有测试表单的 CDP 填写和校验 | 08 模块 |
| 10 | 下载、截图、打印/PDF、文件清理 | 01 模块 + `fbro.transfer` |
| 11 | 多工作区综合工具 | 02/03/06/07/08/10 模块并集 |

模块实际 ID、版本和命令签名以 `electron/src/services/modules/builtinModules.ts` 与 `electron/docs/modules/fbro/` 为准；如口播稿中的待录制实名与当前实现不同，以真实补全、诊断和生成器结果为准，并在该集记录中注明。

## 运行与验收

每集执行以下门槛：

1. 使用 `electron/dist/cli.cjs project build --request <build-request> --workspace <项目目录> --yes --json`，确认没有阻断诊断。
2. 通过现有 VS/MSBuild 导出链生成 x64 Release 工程，确认生成的 `.sln`、`.vcxproj`、C++ 源码、运行时依赖和 exe 均存在。
3. 拉起真实 exe，检查主窗口存活、FBro Host/renderer（适用时）存活、关键调试输出和退出回收。
4. 08/09 检查本机回环 CDP 端口、页面标题/元素操作；10/11 检查下载、截图/PDF 产物存在后清理。
5. 将命令、时间、产物、运行结果、环境前置和已知限制写入每集 `验证报告.md`。

## 安全与可迁移性

- 任何凭据只从受控环境读取，不写入项目文件、源码、日志或视频素材。
- 测试页只使用本地或自有公开数据；不演示登录、验证码、支付、绕过检测或规避风控。
- 共享资源使用相对路径和固定文本，保证项目复制到新目录后仍可重建。
- 生成目录与运行缓存不得作为源码输入，也不纳入示例项目文档。
