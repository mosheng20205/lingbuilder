---
title: 图文教程
---

# 图文教程

每篇教程都是一个完整的小项目：从零开始、每一步配真机截图（红框和序号标出要点哪里），跟着做完就能看到真实运行效果。适用 LingBuilder 0.8.12 及以上（AI 连接教程基于 0.8.15）。

**页面里的截图都可以点击放大**，放大后点击空白处或按 `Esc` 关闭。

> 偏好看视频？前往[视频教程](/guide/videos/)，每集 1 分钟上下，与这里的图文教程主题互相衔接。

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

## 教程之外

- 装不上、跑不起来？看[问题排查](/guide/user/troubleshooting)与[常见问题](/guide/user/faq)。
- 想看这套工具能做出什么？逛逛[优秀案例](/guide/cases/)。
- 命令记不住？用[命令查找](https://lingbuilder.com/commands)和[控件手册](https://lingbuilder.com/controls)。
