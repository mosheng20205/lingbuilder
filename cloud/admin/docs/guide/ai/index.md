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
| [AI Bridge 连接配置](/guide/ai/bridge-config) | 添加模型供应商、设定权限模式 |
| [MCP 工具协议](/guide/ai/mcp) | 通过 MCP 协议扩展 AI 工具能力 |
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
2. 使用 **BYOK 模式**：在 [AI Bridge 配置](/guide/ai/bridge-config) 中添加自有 API Key。

> [!NOTE]
> [用 AI 生成模块](/guide/user/modules/ai-module-dev) 不依赖以上配置：它把规范文本复制给 ChatGPT、Claude、Cursor 等任意 AI，导入、校验、导出与编译全部在本地完成。

![AI 助手概览](./assets/placeholder-chat.png)