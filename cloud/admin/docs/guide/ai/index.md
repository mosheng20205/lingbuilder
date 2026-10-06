---
title: AI 智能助手
---

# AI 智能助手

> [🕒 预计 5 分钟] | 难度：入门

LingBuilder 通过 **AI Bridge** 把工作区能力以 MCP 标准开放给外部 AI（Claude Code、Codex CLI、Gemini CLI、灵码等），并提供代码补全、代码审查等本地智能功能，帮助用户高效完成桌面程序开发。

## 功能入口

| 章节 | 说明 |
|---|---|
| [MCP 能做什么](/guide/ai/mcp-capabilities) | 面向新用户的能力总览：外部 AI 能帮你干哪八件事 |
| [AI 对话式改代码](/guide/ai/chat) | 用中文描述需求，AI 生成或修改代码 |
| [AI Bridge 连接配置](/guide/ai/bridge-config) | 启动本地 Bridge、权限模式、连接外部 AI 客户端 |
| [MCP 工具协议](/guide/ai/mcp) | 外部 AI 客户端可调用的 23 个受控工具 |
| [灵码 Skill 使用](/guide/ai/skill) | 给外部 AI 客户端自动安装的 LingBuilder 接入指引 |
| [AI 构建与运行](/guide/ai/build-run) | AI 创建项目后真实编译成 exe 并运行，与 F5 行为一致 |
| [代码补全](/guide/ai/completion) | AI 实时补全代码片段 |
| [代码审查](/guide/ai/review) | AI 审查代码质量与潜在问题 |
| [用 AI 生成模块](/guide/user/modules/ai-module-dev) | 复制开发规范给任意 AI，导入后编译成真实 C++ 模块 |

## 技术参考

| 章节 | 说明 |
|---|---|
| [DeepSeek 集成参考](/guide/ai/deepseek-integration) | DeepSeek 官方 API 接入参数与示例 |

## 使用前提

AI 能力由外部 AI 客户端经 **AI Bridge** 提供（IDE 不再自带 AI 引擎）：按 [AI Bridge 连接配置](/guide/ai/bridge-config) 接入任意外部 AI 客户端，即可使用 [MCP 能做什么](/guide/ai/mcp-capabilities) 介绍的全部能力；[代码补全](/guide/ai/completion) 与 [代码诊断](/guide/ai/review) 是 IDE 本地功能，无需任何配置。

> [!NOTE]
> [用 AI 生成模块](/guide/user/modules/ai-module-dev) 不依赖以上配置：它把规范文本复制给 ChatGPT、Claude、Cursor 等任意 AI，导入、校验、导出与编译全部在本地完成。

![AI 助手概览](./assets/placeholder-chat.png)