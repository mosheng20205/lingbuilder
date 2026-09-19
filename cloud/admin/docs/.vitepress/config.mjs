import { defineConfig } from 'vitepress'
import lcppGrammar from './lcpp-grammar.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: 'LingBuilder 文档中心',
  description: 'LingBuilder 用户手册与开发文档',
  base: '/docs/',
  srcDir: '.',
  outDir: '.vitepress/dist',
  cleanUrls: true,
  markdown: {
    languages: [lcppGrammar]
  },
  themeConfig: {
    nav: [
      { text: '文档首页', link: '/' },
      { text: '用户手册', link: '/guide/user/' },
      { text: 'AI 智能助手', link: '/guide/ai/' },
      { text: '视频教程', link: '/guide/videos/' },
      { text: '优秀案例', link: '/guide/cases/' },
      { text: '控件手册', link: 'https://lingbuilder.com/controls' },
      { text: '模块开发', link: 'https://lingbuilder.com/modules' },
      { text: '命令查找', link: 'https://lingbuilder.com/commands' },
      { text: '示例源码', link: 'https://lingbuilder.com/demos' },
      { text: '官网首页', link: 'https://lingbuilder.com/' },
    ],
    sidebar: {
      '/guide/user/': [
        {
          text: '快速入门',
          collapsed: false,
          items: [
            { text: '安装与启动', link: '/guide/user/install' },
            { text: '界面导航', link: '/guide/user/interface' },
            { text: '新建窗口项目', link: '/guide/user/quickstart-project' },
            { text: '数据类型手册', link: '/guide/user/data-types' },
            { text: '快捷键速查表', link: '/guide/user/shortcuts' },
          ],
        },
        {
          text: '核心功能',
          collapsed: false,
          items: [
            { text: '窗口设计器', link: '/guide/user/window-designer' },
            { text: 'LingCpp 快速上手', link: '/guide/user/lingcpp-quickstart' },
            { text: '编写代码', link: '/guide/user/writing-code' },
            { text: '构建与运行', link: '/guide/user/build-and-run' },
            { text: '导入 C++ 工程', link: '/guide/user/import-cpp-project' },
            { text: '模块市场', link: '/guide/user/modules/marketplace' },
            { text: '安装与管理模块', link: '/guide/user/modules/install-module' },
            { text: '用 AI 生成模块', link: '/guide/user/modules/ai-module-dev' },
            { text: '调用 C++ DLL', link: '/guide/user/modules/dll-module' },
            { text: '依赖冲突检测', link: '/guide/user/modules/module-conflicts' },
            { text: '模块公开常量', link: '/guide/user/modules/module-constants' },
            { text: 'EdgeView 浏览器模块', link: '/guide/user/modules/edgeview' },
            { text: 'CEF3 浏览器模块', link: '/guide/user/modules/cef3' },
            { text: 'FBro 指纹浏览器模块', link: '/guide/user/modules/fbro' },
            { text: 'new_emoji 原生界面库模块', link: '/guide/user/modules/new-emoji' },
          ],
        },
        {
          text: '进阶主题',
          collapsed: true,
          items: [
            { text: '调试技巧', link: '/guide/user/debugging' },
            { text: '问题排查', link: '/guide/user/troubleshooting' },
            { text: '外部 API 调用', link: '/guide/user/advanced/external-apis' },
            { text: '内嵌资源（打进 EXE）', link: '/guide/user/advanced/embedded-resource' },
            { text: 'SDK 按需下载与离线安装', link: '/guide/user/advanced/sdk-download' },
            { text: '性能优化', link: '/guide/user/advanced/performance' },
            { text: '安全指南', link: '/guide/user/advanced/security' },
            { text: '进阶主题索引', link: '/guide/user/advanced/' },
          ],
        },
        {
          text: '参考与 FAQ',
          collapsed: true,
          items: [
            { text: '常见问题（FAQ）', link: '/guide/user/faq' },
            { text: '术语表', link: '/guide/user/glossary' },
            { text: '版本发布说明', link: '/guide/user/release-notes' },
          ],
        },
        {
          text: '技术参考',
          collapsed: true,
          items: [
            { text: 'AI 服务集成', link: '/guide/user/advanced/ai-service-integration' },
            { text: 'CDP 模块开发', link: '/guide/user/advanced/cdp-module-dev' },
            { text: '模块信息弹窗', link: '/guide/user/advanced/module-info-dialog' },
            { text: 'CDP 模块开发进度', link: '/guide/user/modules/cdp-module-progress' },
            { text: 'FBro 升级 SDK', link: '/guide/user/legacy/fbro-upgrade-sdk' },
            { text: '打包发布参考', link: '/guide/user/packaging/build-prompt' },
          ],
        },
      ],
      '/guide/ai/': [
        {
          text: 'AI 智能助手',
          collapsed: false,
          items: [
            { text: 'AI 对话式改代码', link: '/guide/ai/chat' },
            { text: 'AI Bridge 连接配置', link: '/guide/ai/bridge-config' },
            { text: 'MCP 工具协议', link: '/guide/ai/mcp' },
            { text: 'AI 构建与运行', link: '/guide/ai/build-run' },
            { text: '代码补全', link: '/guide/ai/completion' },
            { text: '代码诊断', link: '/guide/ai/review' },
          ],
        },
        {
          text: '技术参考',
          collapsed: true,
          items: [
            { text: 'DeepSeek 集成参考', link: '/guide/ai/deepseek-integration' },
          ],
        },
      ],
      '/guide/videos/': [
        {
          text: '视频教程',
          collapsed: false,
          items: [
            { text: '视频教程路线图', link: '/guide/videos/' },
          ],
        },
      ],
      '/guide/cases/': [
        {
          text: '优秀案例',
          collapsed: false,
          items: [
            { text: '案例总览', link: '/guide/cases/' },
            { text: '财务管理系统', link: '/guide/cases/finance-system' },
            { text: '进销存管理软件', link: '/guide/cases/inventory-system' },
            { text: '桌面效率工具箱', link: '/guide/cases/desktop-toolbox' },
            { text: '多媒体播放器', link: '/guide/cases/media-player' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mosheng20205/lingbuilder' },
    ],
  },
})