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
