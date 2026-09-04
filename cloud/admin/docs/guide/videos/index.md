---
title: 视频教程
---

# 视频教程

LingBuilder 官方视频教程在 B 站发布，每集 1 分钟上下，独立成片，按新手学习路径编排。本页是完整的系列路线图：已发布的可直接观看，未发布的可以提前了解后续内容。

> 观看入口：B 站合集 [LingBuilder合集](https://www.bilibili.com/video/BV1nXtE6oEGw/)（主系列全 13 集已发布）；设计器实战合集与浏览器三合集上线后补充链接到本页。

## 进度一览

| 系列 | 集数 | 状态 |
| --- | --- | --- |
| 主系列：从安装到发布 | 13 集 | 已发布 |
| 窗口设计器与控件实战 | 8 集 | 计划中 |
| 合集 A：EdgeView 浏览器模块 | 11 集 | 计划中 |
| 合集 B：CEF3 浏览器模块 | 10 集 | 计划中 |
| 合集 C：FBro 指纹浏览器模块 | 10 集 | 制作中 |

## 主系列（13 集，已发布）

从装好 LingBuilder 到导出发布，跟着做完就能跑通第一个中文 C++ 项目。

| 集数 | 标题 | 简介 | 配套文档 |
| --- | --- | --- | --- |
| 1 | 安装与启动 | 下载安装包、首次启动、工作区初始化，几分钟跑起 IDE | [安装与启动](/guide/user/install) |
| 2 | 界面导航 | 认识工作台布局、活动栏、编辑器和底部面板，附高频快捷键 | [界面导航](/guide/user/interface) · [快捷键](/guide/user/shortcuts) |
| 3 | 第一个项目：从新建到运行 | 新建项目 → 拖一个按钮 → 写一行中文代码 → F5 编译运行 | [新建窗口项目](/guide/user/quickstart-project) · [构建与运行](/guide/user/build-and-run) |
| 4 | 窗口设计器概览 | 工具箱、画布、属性面板和事件绑定入口，拖出第一个可运行窗口 | [窗口设计器](/guide/user/window-designer) |
| 5 | 中文代码入门 | 新手/专业双模式、`.子程序` 结构、代码补全、变量与常量 | [.lcpp 快速上手](/guide/user/lingcpp-quickstart) · [编写代码](/guide/user/writing-code) · [数据类型](/guide/user/data-types) |
| 6 | 构建排错与中文诊断 | 故意写错代码，用错误列表和中文诊断定位修复；调试日志与输出窗口 | [调试](/guide/user/debugging) · [常见问题](/guide/user/troubleshooting) |
| 7 | 模块市场：给 IDE 装能力 | 浏览模块市场、安装 .lbmod 模块包、项目启用模块、模块控件进工具箱 | [安装模块](/guide/user/modules/install-module) · [模块市场](/guide/user/modules/marketplace) |
| 8 | 多线程：后台任务不卡界面 | 后台线程执行耗时任务，完成后安全回到界面更新控件，支持进度与取消 | [性能与多线程](/guide/user/advanced/performance) |
| 9 | AI 助手：让 AI 帮你写代码 | AI 面板生成代码、修复报错，AI Bridge 连接中心与权限模式 | [AI 服务集成](/guide/user/advanced/ai-service-integration) |
| 10 | 导出 C++ / Visual Studio 工程 | 中文源码生成真实 C++，用 Visual Studio 打开继续开发 | — |
| 11 | 打包发布你的软件 | 切 Release 构建、发布面板生成产物与 SHA-256 清单、签名与运行库交付 | [打包发布](/guide/user/packaging/) |
| 12 | 开发你自己的模块 | 用模块 SDK 写中文命令绑定、校验、打包 .lbmod，装回 IDE 进补全 | [模块生态](/guide/user/modules/) |
| 13 | AI 帮你造模块（不用会 C++） | 把需求描述给 AI → 粘贴导入 → 自动校验打包 → 中文命令进补全、F5 编译真实 C++ | [AI 模块开发](/guide/user/modules/ai-module-dev) |

## 窗口设计器与控件实战（8 集，计划中）

承接主系列第 4 集，从「会拖一个控件」进阶到「能组合出完整中文桌面界面」。

| 集数 | 标题 | 简介 | 配套文档 |
| --- | --- | --- | --- |
| 01 | 认识窗口设计器 | 画布、工具箱、属性面板、控件树、保存与预览 | [窗口设计器](/guide/user/window-designer) |
| 02 | 基础控件入门 | 按钮、标签、编辑框、复选框、单选框的常用属性与最小事件绑定 | [窗口设计器](/guide/user/window-designer) |
| 03 | 列表与选择控件 | 列表框、组合框、分组框、滚动条组合出一个设置面板 | [窗口设计器](/guide/user/window-designer) |
| 04 | 图片与状态控件 | 图片框、动态图片、进度条与资源导入 | [窗口设计器](/guide/user/window-designer) |
| 05 | 高级控件怎么选 | 高级控件分类、适用场景与选择取舍 | [窗口设计器](/guide/user/window-designer) |
| 06 | 布局与窗口美化 | 对齐、分布、字体、颜色、间距与 DPI | [窗口设计器](/guide/user/window-designer) |
| 07 | 控件事件与中文代码 | 点击、文本变化事件与事件处理器，从源码跳转设计器 | [窗口设计器](/guide/user/window-designer) · [.lcpp 快速上手](/guide/user/lingcpp-quickstart) |
| 08 | 做一个完整桌面工具 | 组合输入、列表、进度和状态提示，绑定事件并 F5 运行 | [窗口设计器](/guide/user/window-designer) · [构建与运行](/guide/user/build-and-run) |

## 浏览器模块三合集（计划中 / 制作中）

三个独立合集，分别讲 EdgeView（WebView2）、CEF3（原生内核）与 FBro（指纹浏览器）三个浏览器模块。推荐按 EdgeView → CEF3 → FBro 的顺序学习：先用 WebView2 低门槛建立浏览器控件和事件模型，再进阶原生内核与指纹浏览器。

建议前置：主系列第 3～7 集和「窗口设计器与控件实战」合集。

### 合集 A：EdgeView（11 集，计划中）

| 集数 | 标题 | 简介 | 配套文档 |
| --- | --- | --- | --- |
| 01 | EdgeView 入门：把网页嵌进窗口 | 启用模块并确认 WebView2 Runtime，拖入控件、导航网页、执行 JS 读取标题 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 02 | 多实例与会话隔离 | 双控件或纯代码区域实例使用独立缓存目录，验证 Cookie、LocalStorage 和会话隔离 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 03 | 浏览器设置与创建选项 | User-Agent、缩放、静音、独占用户目录和重建控件 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 04 | 代理：全局与实例级 | 全局、实例和区域代理，覆盖 HTTP/HTTPS/SOCKS5 及代理生命周期 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 05 | 事件驱动：让代码响应网页 | 设计器控件与纯代码实例的事件绑定、字段读取和等待事件 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 06 | JavaScript 与网页消息 | 同步/异步执行 JS、任务状态和网页消息回传 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 07 | 获取资源响应：拦截、替换与读取正文 | 资源过滤器、同步响应替换、响应句柄和正文异步读取 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 08 | 下载与页内查找 | 下载路径与状态管理、暂停恢复取消、页内查找 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 09 | 打印、截图与开发者工具 | PDF、截图、Favicon 和 DevTools 协议事件能力 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 10 | 会话、权限与安全边界 | Cookie/浏览数据清理、权限状态、证书信息和脱敏演示 | [EdgeView 模块](/guide/user/modules/edgeview) |
| 11 | EdgeView 综合项目：加载、拦截、下载与 F5 | 综合网页工作台，串起事件、资源响应、下载和真实构建运行 | [EdgeView 模块](/guide/user/modules/edgeview) |

### 合集 B：CEF3（10 集，计划中）

| 集数 | 标题 | 简介 | 配套文档 |
| --- | --- | --- | --- |
| 01 | CEF3 入门：原生内核与 SDK 前置 | 启用模块、拖入控件、首次构建下载并校验 SDK，加载网页 | [CEF3 模块](/guide/user/modules/cef3) · [SDK 下载](/guide/user/advanced/sdk-download) |
| 02 | CEF3 浏览器操作小项目 | 导航、历史、刷新、缩放、执行 JS、读取标题与地址 | [CEF3 模块](/guide/user/modules/cef3) |
| 03 | CEF3 事件驱动：加载完成与事件数据 | 绑定加载事件，读取事件数据和字段，使用 `&处理器名` | [CEF3 模块](/guide/user/modules/cef3) |
| 04 | CEF3 会话隔离：缓存目录与多实例 | 两个实例使用独立缓存目录，验证 Cookie、存储和登录态隔离 | [CEF3 模块](/guide/user/modules/cef3) |
| 05 | CEF3 代理与请求前决策 | 创建前代理配置、导航/资源请求决策和允许/取消结果 | [CEF3 模块](/guide/user/modules/cef3) |
| 06 | 获取网页资源响应：URL、状态码与 MIME | 绑定资源响应事件，读取公开响应元数据，观察页面资源加载 | [CEF3 模块](/guide/user/modules/cef3) |
| 07 | 资源加载生命周期：重定向与加载完成 | 串起请求前、响应到达、重定向和加载完成事件，说明高级边界 | [CEF3 模块](/guide/user/modules/cef3) |
| 08 | 下载、打印与页内查找 | 下载、打印、页内查找与查找结果事件 | [CEF3 模块](/guide/user/modules/cef3) |
| 09 | JavaScript、DevTools 与异步任务 | 同步/异步 JS、任务结果、开发者工具和协议方法 | [CEF3 模块](/guide/user/modules/cef3) |
| 10 | CEF3 还是 EdgeView：部署与选型 | 对比内核、SDK/运行时、离线安装、资源分发和部署成本 | [CEF3 模块](/guide/user/modules/cef3) · [EdgeView 模块](/guide/user/modules/edgeview) |

本合集覆盖 CEF3 浏览器核心及事件、会话、网络资源、传输和自动化的常用入门路径，不是 395 条接口的逐条课程。第 06 集“获取网页资源响应”以当前公开 binding 可读取的 URL、HTTP 状态码和 MIME 等响应元数据为准；响应正文或过滤器能力以模块详情和实际版本支持为准。

### 合集 C：FBro 指纹浏览器（10 集，制作中）

| 集数 | 标题 | 简介 | 配套文档 |
| --- | --- | --- | --- |
| 01 | FBro 入门：把隔离浏览器嵌入窗口 | FBro SDK 前置说明，拖入指纹浏览器控件完成进程内嵌入 | [FBro 模块](/guide/user/modules/fbro) · [SDK 下载](/guide/user/advanced/sdk-download) |
| 02 | 浏览器管理器：多实例与选项卡 | 实例列表、页面选项卡、地址栏/详情/进度控件绑定和持久化恢复 | [FBro 模块](/guide/user/modules/fbro) |
| 03 | 会话隔离：工作区、Cookie 与 UserAgent | 独立 Profile、工作区键、创建前 UserAgent 和受控 Cookie/缓存清理；请在站点授权范围内使用 | [FBro 模块](/guide/user/modules/fbro) |
| 04 | 指纹配置：VIP 授权下的安全演示 | 在授权测试环境中应用结构化指纹配置，查看脱敏授权状态和失败诊断 | [FBro 模块](/guide/user/modules/fbro) |
| 05 | 三种宿主模式怎么选 | 进程内嵌入、独立进程嵌入、独立顶层窗口的适用场景与取舍，并区分 Chrome 原生 UI | [FBro 模块](/guide/user/modules/fbro) |
| 06 | 事件驱动：导航、弹窗与处理器 | 绑定事件、读取事件字段、同步/延迟决策和 `&处理器名` | [FBro 模块](/guide/user/modules/fbro) |
| 07 | 获取网页资源响应：URL、状态码与 MIME | 观察资源响应与加载完成事件，读取公开响应元数据；正文/过滤器能力以当前版本为准 | [FBro 模块](/guide/user/modules/fbro) |
| 08 | 接上自动化：CDP 驱动内嵌浏览器 | 配置独立进程和开发者工具，取得调试端口后用 CDP 完成取标题、查询元素和点击 | [FBro 模块](/guide/user/modules/fbro) · [CDP 模块开发](/guide/user/advanced/cdp-module-dev) |
| 09 | 下载、截图与打印：把网页结果落盘 | 下载进度、截图、打印/PDF 和文件对话框，说明输出路径与敏感数据边界 | [FBro 模块](/guide/user/modules/fbro) |
| 10 | FBro 综合项目：多工作区浏览器工具 | 串起工作区隔离、事件日志、资源响应摘要、CDP 自动化、下载视图和真实 F5 构建 | [FBro 模块](/guide/user/modules/fbro) · [CDP 模块开发](/guide/user/advanced/cdp-module-dev) |

本合集定位为“从入门到资源响应与自动化实战”，不是 462 条用户接口的逐条课程。第 07 集只承诺当前公开 binding 可读取的资源 URL、状态码、MIME 等元数据；资源正文、响应过滤器和替换规则必须以当前模块版本的公开能力和安全示例为准。所有演示使用已授权测试环境，不展示 Permit、Key、真实账号、Cookie、代理密码或敏感响应内容。第 08 集需额外启用 CDP 模块，并将 FBro 控件设为“独立进程嵌入”且开启开发者工具。

## 相关阅读

- [快速上手](/guide/user/quickstart-project)
- [窗口设计器](/guide/user/window-designer)
- [模块生态](/guide/user/modules/)
