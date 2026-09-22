---
title: AI 智能助手
---

# AI 智能助手

> [🕒 预计 5 分钟] | 难度：入门

LingBuilder 内置 AI 智能编程助手，支持**中文对话**、代码补全、代码审查与 AI Bridge 多模型接入，帮助用户高效完成桌面程序开发。

## 功能入口

| 章节 | 说明 |
|---|---|
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

使用 AI 功能前，请先完成以下任一项配置：

1. 使用**内置云端服务**：登录 LingBuilder 账户，确认配额充足。
2. 使用 **BYOK 模式**：在 AI 面板的 **自定义 API** 中填写自有模型服务与 API Key。

> [!NOTE]
> [用 AI 生成模块](/guide/user/modules/ai-module-dev) 不依赖以上配置：它把规范文本复制给 ChatGPT、Claude、Cursor 等任意 AI，导入、校验、导出与编译全部在本地完成。

![AI 助手概览](./assets/placeholder-chat.png)