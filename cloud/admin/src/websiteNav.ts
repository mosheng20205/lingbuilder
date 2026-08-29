// 官网统一导航数据：首页（HomePage）与内页（WebsitePortal）共用这一份配置，
// 文案与链接只在此处维护，避免两处导航漂移。
// 控件手册（/controls）与模块开发（/modules）页面仍由后台维护、SPA 渲染，
// 但入口已移入文档中心（VitePress 顶部导航 + 文档首页卡片），主站顶部不再列出；
// AI 指南（/ai）已下线，前置反代 301 到文档中心 AI 智能助手栏目。
// 「/docs/guide/*」三项是文档中心的栏目（与 VitePress nav 互为镜像），
// 窄屏下通过 .doc-link 类分级隐藏，避免撑爆头部。
export interface WebsiteNavItem { href: string; label: string; }

export const WEBSITE_NAV_ITEMS: WebsiteNavItem[] = [
  { href: '/commands', label: '命令查找' },
  { href: '/demos', label: '示例源码' },
  { href: '/docs', label: '文档中心' },
  { href: '/docs/guide/ai/', label: 'AI 智能助手' },
  { href: '/docs/guide/videos/', label: '视频教程' },
  { href: '/docs/guide/cases/', label: '优秀案例' }
];

// 文档中心栏目项（在头部渲染时加 .doc-link 类，窄屏分级隐藏）
export function isDocsSectionItem(item: WebsiteNavItem): boolean {
  return item.href.startsWith('/docs/guide/');
}
