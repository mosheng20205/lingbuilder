# EdgeView 教程示例项目设计

## 目标

为 EdgeView 浏览器模块合集 01～12 集准备可复制、可独立打开、可 F5 构建运行的录制项目。每个项目只演示对应口播稿中的主线能力，并使用本地或受控测试数据，避免公网、真实账号和敏感凭据影响录制复现。

## 目录与边界

- 每集目录：`AI 视频自主生产/EdgeView 浏览器模块合集/NN/示例项目/`。
- 每集文档：同级 `录制准备.md` 和 `验证记录.md`。
- 项目格式沿用仓库现有 `.lingbuilder/solution.json`、项目级 `project-modules.json`、`window-designer.json`、`config.ini` 与 `src/*.lcpp`。
- 代码只使用已公开且已在 `electron/docs/modules/edgeview/API.md` 中登记的 EdgeView 命令；控件参数使用裸 `controlRef`，处理器使用 `&处理器名`。
- 需要网络行为的集数使用 `demo.lingbuilder.local` 或内存 HTML/本地下载源，并在项目说明中标注不会访问公网。

## 项目矩阵

| 集数 | 项目 ID | 主要演示 | 外部依赖 |
| --- | --- | --- | --- |
| 01 | `edgeview-ep01-intro` | 单控件导航、执行脚本、标题输出 | WebView2 Runtime |
| 02 | `edgeview-ep02-isolation` | 双区域实例、独立缓存、LocalStorage/Cookie 脱敏 | WebView2 Runtime |
| 03 | `edgeview-ep03-settings` | UA、缩放、静音、独占用户目录、重建 | WebView2 Runtime 150 |
| 04 | `edgeview-ep04-proxy` | 全局代理、实例代理、区域代理、状态读取 | 本地授权代理或模拟回显 |
| 05 | `edgeview-ep05-events` | 控件事件、事件字段、纯代码 API 对照 | WebView2 Runtime |
| 06 | `edgeview-ep06-messaging` | 详情异步脚本、任务生命周期、字符串/JSON 消息 | WebView2 Runtime 150 |
| 07 | `edgeview-ep07-form` | 本地表单定位、填值、校验、提交 | 内置本地 HTML |
| 08 | `edgeview-ep08-response` | 资源请求替换、响应句柄、异步正文读取 | WebView2 Runtime 150 |
| 09 | `edgeview-ep09-download-find` | 受控下载、状态查询、页内查找 | 内置测试文件和 HTML |
| 10 | `edgeview-ep10-output-devtools` | PDF、PNG、Favicon、DevTools 事件 | WebView2 Runtime 150 |
| 11 | `edgeview-ep11-security` | Cookie、清理、权限、证书公开字段 | WebView2 Runtime 150 |
| 12 | `edgeview-ep12-capstone` | 导航、表单、响应、下载、F5 综合闭环 | WebView2 Runtime 150 |

## 验证策略

统一验证脚本检查每个项目的 JSON 完整性、模块清单、源码关键命令与控件引用语义；随后调用现有生成器导出 Win32 项目，执行 `npm run lint`，并对可用环境运行 x64/Win32 Release 构建和至少 3 秒进程存活检查。外部代理、证书和权限无法在无授权环境中验证时，项目仍必须提供安全的本地预览路径并在记录中明确未执行的环境项。

