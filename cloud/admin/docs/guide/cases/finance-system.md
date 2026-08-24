---
title: 财务管理系统
---

# 财务管理系统

> 优秀案例 · [🕒 阅读约 2 分钟]

![财务管理系统封面](./assets/placeholder-case.png)

**一句话介绍**：基于 LingBuilder 开发的财务对账系统，支持 Excel 导入导出与多用户并发。

## 核心模块

| 模块 | 版本 | 用途 |
|---|---|---|
| `lingbuilder.win32.basic` | 内置 | 界面控件与窗口管理 |
| `excel-utils` | v2.3.1 | Excel 读写与数据导入导出 |
| `network-http` | v1.4.0 | RESTful 接口调用与云端同步 |

## 亮点功能

- **数据加密存储**：财务敏感字段采用 AES-256 加密落盘。
- **报表自动生成**：一键导出 PDF / Excel 双格式对账报表。
- **权限分级控制**：支持管理员 / 出纳 / 审计三种角色，权限互斥。
- **多用户并发**：基于 PostgreSQL 事务保证账目一致性。

## 技术栈

| 项目 | 版本 |
|---|---|
| LingBuilder | v0.6.0 |
| Microsoft Visual C++ Redistributable | 2022 |
| PostgreSQL | 17 |

## 界面一览

![主界面占位](./assets/placeholder-screen.png)

## 开发者心得

“最直观的感受是拖放式窗口设计与对照组件的封装程度。财务表单的字段较多，借助窗口设计器 **网格容器** 一次就能排布整齐；`excel-utils` 模块让原本繁琐的报表导出变成几行代码。”

[返回优秀案例](/guide/cases/)