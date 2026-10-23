---
title: 图文教程
---

# 图文教程

每篇教程都是一个完整的小项目：从零开始、每一步配真机截图（红框和序号标出要点哪里），跟着做完就能看到真实运行效果。适用 LingBuilder 0.8.12 及以上（AI 连接教程基于 0.8.15）。

**页面里的截图都可以点击放大**，放大后点击空白处或按 `Esc` 关闭。

> 偏好看视频？前往[视频教程](/guide/videos/)，每集 1 分钟上下，与这里的图文教程主题互相衔接。

## 零基础入门系列（推荐从这里开始）

为完全没接触过编程的读者准备的入门课：从安装开始，一路做出自己的第一个 exe，直到能独立做出登录界面。每集只讲一件事，全部真机截图。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [安装与第一次运行](/guide/tutorials/beginner-01-install) | 下载安装、认识工作台、确认 C++ 构建环境就绪 | 已上线 |
| 02 | [第一个窗口](/guide/tutorials/beginner-02-first-window) | 新建项目、拖控件改属性，编译出第一个自己的 exe | 已上线 |
| 03 | [第一行中文代码](/guide/tutorials/beginner-03-first-code) | 事件绑定、拼音补全、信息框与调试输出 | 已上线 |
| 04 | [如果流程与按钮进阶](/guide/tutorials/beginner-04-if-flow) | 程序集变量、如果/否则，做一个点击计数器 | 已上线 |
| 05 | [编辑框与文本型变量](/guide/tutorials/beginner-05-textbox) | 输入框读文字，标签实时更新问候语 | 已上线 |
| 06 | [实战：登录界面](/guide/tutorials/beginner-06-login) | 综合前五集：账号密码输入、四层如果判断、登录状态反馈 | 已上线 |
| 07 | [多窗口：登录之后](/guide/tutorials/beginner-07-multi-window) | 新建第二个窗口、打开窗口跳转、结束() 退出 | 已上线 |
| 08 | [时钟与动态更新](/guide/tutorials/beginner-08-clock) | 时钟组件、非可视组件概念、周期事件 | 已上线 |

更多集数制作中，见[系列总览](/guide/tutorials/beginner)。

## 进阶实战系列（学完零基础后来这里）

每集围绕一个内置模块做出一个真正能用的小软件：数据能存下来、网络能连出去、耗时任务不卡界面。每集提供一键导入的 .lcpppkg 源码包。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [SQLite 数据库入门：能记住数据的通讯录](/guide/tutorials/jinjie-01-sqlite) | 启用模块、打开连接、建表、参数绑定增删改查、错误列表习惯、lcpppkg 导出 | 已上线 |
| 02 | [@ 行内嵌 C++：当模块不够用时](/guide/tutorials/jinjie-02-inline-cpp) | @ 行语法、中文变量互通、空闲监视器、三条红线 | 已上线 |
| 03 | [网络请求 web.http：IP 查询小工具](/guide/tutorials/jinjie-03-webhttp) | 同步/异步访问、完成处理器、文本解析 | 已上线 |
| 04 | [多线程 threading：批量文件统计器](/guide/tutorials/jinjie-04-threading) | 线程_提交进度、互斥锁、工作线程不碰控件 | 已上线 |
| 05 | [正则表达式 std.regex：批量文本提取器](/guide/tutorials/jinjie-05-regex) | 正则五命令、按行批量提取、形态校验范式 | 已上线 |
| 06 | [压缩与打包 archive：一键压缩 / 解压工具](/guide/tutorials/jinjie-06-archive) | ZIP 命令族、内存压缩族、防炸弹上限 | 已上线 |
| 07 | [定时任务 cron：定时提醒器](/guide/tutorials/jinjie-07-cron) | cron 表达式、定时任务生命周期、与时钟的分工 | 已上线 |
| 08 | [邮件发送 mail：一键发通知](/guide/tutorials/jinjie-08-mail) | SMTP 命令族、本地收件池闭环、授权码红线 | 已上线 |
| 09 | [HTTP 服务器 http.server：局域网文件分享小站](/guide/tutorials/jinjie-09-httpserver) | 服务端四步曲、静态路由、端口与防火墙红线 | 已上线 |
| 10 | [浏览器自动化 EdgeView：网页取数小工具（选学）](/guide/tutorials/jinjie-10-edgeview) | EdgeBrowser 控件、导航/取标题/执行JS、无头选型 | 已上线 |
| 11 | [实战整合：个人信息管理系统 + 安装包导出（收官）](/guide/tutorials/jinjie-11-integration) | SQLite+时钟+托盘整合、安装包导出 | 已上线 |

更多集数制作中，见[系列总览](/guide/tutorials/jinjie)。

## 高阶实战系列（真实场景实战专题）

不限单一模块、按真实场景选题的开放式实战合集。首个专题＝**消息推送**（企业微信群机器人，01~05 已上线）：五集连完，你的程序就能往群里发文本、排版消息、截图报警、可点击卡片和任意文件。每集提供一键导入的 .lcpppkg 源码包。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [消息推送入门：发出你的第一条企微推送](/guide/tutorials/gaojie-01-wecom-text) | 申请群机器人、推送_发企业微信文本 四参数、errcode=93000 真实排障、取错误/取响应文本两件套 | 已上线 |
| 02 | [文本与 Markdown 排版：把通知写成「人话」](/guide/tutorials/gaojie-02-wecom-markdown) | 推送_发企业微信Markdown、三引号文本块写排版、@手机号正确用法、2048/4096 字节上限本地预检 | 已上线 |
| 03 | [图片推送：做出错自动截图报警器](/guide/tutorials/gaojie-03-wecom-image) | 截图_窗口到PNG、窗口_取自身句柄、推送_发企业微信图片（Base64/MD5 自动组包）、报警三段式 | 已上线 |
| 04 | [图文推送：news 卡片让消息「可点击」](/guide/tutorials/gaojie-04-wecom-news) | 推送_发企业微信图文、标题|描述|跳转链接|图片URL 行格式、url 必填本地预检、1~8 条卡片 | 已上线 |
| 05 | [文件上传与发送：media_id 的获取、时效与复用](/guide/tutorials/gaojie-05-wecom-file) | 推送_上传企业微信文件、media_id 三天有效与复用、项目全局变量、推送_发企业微信文件、假编号 errcode 40007 | 已上线 |

更多集数制作中，见[系列总览](/guide/tutorials/gaojie)。

## Edge 浏览器合集（把 Edge 装进你的软件）

依托 EdgeView 浏览器模块（WebView2 内核）的 26 集大合集。**基础篇 01~04 已上线**：把浏览器控件摆进窗口、导航族命令全家福、事件驱动状态栏、执行 JavaScript 拿返回值。每集提供一键导入的 .lcpppkg 源码包。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [初识内嵌浏览器：迷你浏览器](/guide/tutorials/edge-01) | EdgeBrowser 设计器控件、EdgeView_导航控件/后退/前进/刷新、判空用文本_取长度、地址栏手动联动 | 已上线 |
| 02 | [导航进阶：页面信息查看器](/guide/tutorials/edge-02) | 导航族 11 条全家福、导航_取标题/取地址/取状态JSON、导航_HTML 内存页面、多行文本块 | 已上线 |
| 03 | [事件驱动：浏览器状态栏](/guide/tutorials/edge-03) | 设计器事件四件套（导航开始/地址改变/标题改变/导航完成）、绑定控件事件、事件_设置动作拦截弹窗 | 已上线 |
| 04 | [执行 JavaScript：脚本控制台](/guide/tutorials/edge-04) | EdgeView_执行JS控件、JSON 返回值回读规则、执行详情异步看异常、文档预注入开机脚本、脚本族 7 条 | 已上线 |

## new_emoji 合集（93 个现代组件，告别 Windows 98 风格）

依托 new_emoji 原生界面库（Direct2D 自绘 + 彩色 Emoji）的 25 集大合集。**前 10 集已上线**：入门篇（容器布局、文本按钮、输入与选择控件）+ 选择类（下拉/级联/日期时间/特殊输入）+ 导航篇（标签页/菜单/页面导航件）。每集提供一键导入的 .lcpppkg 源码包（收费模块，启用时登录授权即可）。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [初识 new_emoji：自绘引擎与第一个现代窗口](/guide/tutorials/new-emoji-01) | 启用收费模块与账号授权、设计后端切换、容器/布局/边框/间距/分割线五件套、彩色 Emoji 直写、控件_设置文本 | 已上线 |
| 02 | [文本与按钮：8 个最常用组件](/guide/tutorials/new-emoji-02) | Button 变体 variant 0~6、图标按钮徽标与 tooltip、链接 autoOpen 红线、四色标签、独立徽标、状态点呼吸动画、全局变量点击计数 | 已上线 |
| 03 | [输入类（一）：做出能校验的报名表](/guide/tutorials/new-emoji-03) | Input 占位与可清空、InputNumber 范围钳制、Autocomplete 建议列表、InputGroup、EditBox 多行、文本_取长度判空 | 已上线 |
| 04 | [输入类（二）：偏好设置面板](/guide/tutorials/new-emoji-04) | Checkbox/Radio/Switch/Slider/Rate 五控件、Radio 互斥代码维护红线、Rate 初值 valueX2 半星单位、ValueChanged 统一节奏 | 已上线 |
| 05 | [下拉与级联：城市选择中心](/guide/tutorials/new-emoji-05) | Select 选项与默认选中、SelectV2 虚拟选择器 visibleCount、Cascader 斜杠分层级与取文本读路径、TreeSelect treeDataJson 建层级树红线 | 已上线 |
| 06 | [日期与时间：预约时间登记台](/guide/tutorials/new-emoji-06) | DatePicker/TimePicker/DateTimePicker 初值属性、TimeSelect 固定时段、Calendar 常驻日历、弹层控件选择变化事件「点开即触发」红线 | 已上线 |
| 07 | [特殊输入：快速登记台](/guide/tutorials/new-emoji-07) | InputTag 回车成签与取文本读标签列表、Mentions @ 唤起建议、ColorPicker 弹层调色、NE上传_设置文件列表 运行期文件列表免原生对话框 | 已上线 |
| 08 | [标签页 Tabs 与分段控制 Segmented](/guide/tutorials/new-emoji-08) | Tabs 页签 items 与页槽位挂载、headerAlign 页签头居中、选择变化事件带三参数（索引/数量/动作）、Segmented 分段无参事件 | 已上线 |
| 09 | [菜单 Menu 与侧边栏 Aside：导航布局壳](/guide/tutorials/new-emoji-09) | menuItems 记录表配顶层项、NE菜单_设置项目 文本协议 > 前缀挂子菜单、菜单命令事件自带索引与层级路径、Aside 布局容器、popupOpen 隐形红线 | 已上线 |
| 10 | [页面导航件：六连排](/guide/tutorials/new-emoji-10) | Breadcrumb 面包屑、Steps 步骤条、Pagination 分页翻页读页码、Anchor 锚点目录、Backtop 阈值常显、Affix 固钉 | 已上线 |

## CEF3 浏览器合集（Chromium 官方 CEF 框架，命令规模之最）

依托 CEF3 浏览器模块（Chromium Embedded Framework）的 30 集大合集。**入门篇 01~04 已上线**：迷你浏览器四命令、事件观察器、执行 JS 与信封解析、cefQuery 双向交互。每集提供一键导入的 .lcpppkg 源码包（收费模块，启用时登录授权即可）。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [迷你浏览器](/guide/tutorials/cef3-01) | 三内核选型对比（CEF3/EdgeView/FBro）、CEF3浏览器控件与打开地址属性、CEF3_导航/后退/前进/刷新、判空用文本_取长度 | 已上线 |
| 02 | [事件观察器](/guide/tutorials/cef3-02) | CEF3_绑定事件与 &处理器名红线、六事件（开始加载/加载完成/加载失败/地址被改变/标题被改变/加载状态改变）、取地址/取标题/是否加载中、CEF3_停止、置顶插入日志 | 已上线 |
| 03 | [脚本控制台](/guide/tutorials/cef3-03) | CEF3_执行JS、DevTools 结果信封 {"result":{"type","value"}}、JSON_解析/JSON_指针_取/JSON_取文本值 三步解析、声明提升拆两行、JS 单引号规矩 | 已上线 |
| 04 | [网页点餐器](/guide/tutorials/cef3-04) | JS交互查询函数通道属性（创建前注册）、查询请求事件与 queryId/request 字段、CEF3_查询应答、120 秒超时 -4、data:Base64 内嵌网页 | 已上线 |

## FBro 指纹浏览器合集（指纹伪装＋多开防关联）

依托 FBro 指纹浏览器模块（CEF 深度定制内核 Chrome 135）的 29 集大合集。**基础篇 01~04 已上线**：指纹检测器、创建模式与宿主架构、页面事件观察器、会话隔离与独立缓存目录。每集提供一键导入的 .lcpppkg 源码包（收费模块，启用时登录授权即可）。

| 集 | 教程 | 你将学会 | 状态 |
| --- | --- | --- | --- |
| 01 | [指纹检测器](/guide/tutorials/fbro-01) | Canvas/WebGL/UA/字体/时区指纹画像（BrowserScan 实测报告逐段解读）、FBro浏览器控件与打开地址属性、FBro_导航、指纹真实性 100% 报告怎么读 | 已上线 |
| 02 | [进程内、独立进程与宿主架构](/guide/tutorials/fbro-02) | 宿主模式属性（进程内/独立进程嵌入）零改码切换、LingBuilderFbroHost.exe 宿主与 FBroSubprocess 实拍、双浏览器同屏互不干扰、FBro_关闭 释放实例 | 已上线 |
| 03 | [页面事件观察器](/guide/tutorials/fbro-03) | FBro_绑定事件与 &处理器名红线、开始加载/加载完成/地址被改变/标题被改变四事件、FBro_取事件字段 读事件包、列表框_滚动到项 自动滚日志、事件驱动替代死等延迟 | 已上线 |
| 04 | [会话隔离与独立缓存目录](/guide/tutorials/fbro-04) | 缓存目录属性＝一套独立档案、FBro会话_异步设置Cookie/取Cookie 写读身份、alice/bob 互不可见实验（连 BAIDUID 都不同）、FBro会话_取上下文缓存路径、会话族 15 条版图 | 已上线 |

更多集数（指纹与多开/自动化/拦截与协议/界面杂项/综合实战，05~29）制作中，见[系列总览](/guide/tutorials/fbro)。

## 按学习路径排序

建议按下面的顺序学：先把数据装进变量，再把相关数据打包成类型，然后学会复用逻辑，最后打通系统能力、单文件分发和模块生态。

| # | 教程 | 你将学会 | 配图 | 关联手册 |
| --- | --- | --- | --- | --- |
| 1 | [项目变量与常量](/guide/tutorials/project-globals) | 把整个项目都要用的数据声明成项目变量/项目常量，跨源码文件共享 | 16 张 | [编写代码](/guide/user/writing-code) |
| 2 | [自定义数据类型](/guide/tutorials/data-types) | 定义自己的结构体类型，声明变量、赋值字段、F5 编译运行看结果 | 17 张 | [数据类型手册](/guide/user/data-types) |
| 3 | [功能代码（功能库）](/guide/tutorials/function-library) | 新建功能库、写一个功能、在窗口程序里调用 | 13 张 | [LingCpp 快速上手](/guide/user/lingcpp-quickstart) |
| 4 | [DLL 命令](/guide/tutorials/dll-commands) | 把 Windows 系统 DLL 函数声明成中文命令并调用，全程不写 C++ | 17 张 | [调用 C++ DLL](/guide/user/modules/dll-module) |
| 5 | [内嵌资源](/guide/tutorials/embedded-resource) | 把文本/图片/压缩包打包进 exe，运行时按逻辑名读取和释放 | 16 张 | [内嵌资源（打进 EXE）](/guide/user/advanced/embedded-resource) |
| 6 | [模块开发](/guide/tutorials/module-dev) | 创建模块 → 写中文命令 → 调试 → 打包 .lbmod → 分发安装，走完全环节 | 19 张 | [新建与打开模块](/guide/user/modules/create-module) |
| 7 | [外部 AI 连接 MCP](/guide/tutorials/ai-bridge-mcp) | 把连接配置装进 Claude Code / Codex / Gemini CLI / 灵码，让 AI 在你的工作区里读码、改码、构建运行 | 10 张 | [MCP 工具协议](/guide/ai/mcp) |
| 8 | [LCPP 源码包分享](/guide/tutorials/lcpp-source-package) | 一键把项目打包成 .lcpppkg 发给别人，对方导入后直接 F5 构建运行 | 10 张 | [构建与运行](/guide/user/build-and-run) |
| 9 | [安装包导出](/guide/tutorials/installer-export) | 一键把构建产物打包成 NSIS 安装程序（setup.exe），可选图标、捆绑运行库与安装目录策略 | 8 张 | [构建与运行](/guide/user/build-and-run) |
| 10 | [构建目录与产物名](/guide/tutorials/build-directory) | 右键「构建目录…」把产物 LingBuilderPreview.exe 改成自己的程序名，自定义构建输出与生成源码目录 | 10 张 | [构建与运行](/guide/user/build-and-run) |
| 11 | [流程控制](/guide/tutorials/flow-control) | 新手模式全部流程语句：如果/选择/六种循环/异常处理，拼音补全输入、并列分支自动对齐、循环变量自动登记 | 19 张 | [LingCpp 快速上手](/guide/user/lingcpp-quickstart) |

## 教程之外

- 装不上、跑不起来？看[问题排查](/guide/user/troubleshooting)与[常见问题](/guide/user/faq)。
- 想看这套工具能做出什么？逛逛[优秀案例](/guide/cases/)。
- 命令记不住？用[命令查找](https://lingbuilder.com/commands)和[控件手册](https://lingbuilder.com/controls)。
