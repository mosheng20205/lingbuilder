import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import './websiteTheme.css';

export type WebsiteTheme = 'dark' | 'light';

/** 官网主题的 localStorage 键；管理后台不消费该值。 */
const WEBSITE_THEME_KEY = 'lb-website-theme';

/** 官网主题色值，与 index.html 防闪脚本及亮色令牌保持一致。 */
const THEME_META_COLORS: Record<WebsiteTheme, string> = { dark: '#070b14', light: '#f4f6fb' };

export function readWebsiteTheme(): WebsiteTheme {
  try {
    return localStorage.getItem(WEBSITE_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** 把主题写入文档根节点：官网页面用 data 属性驱动亮色令牌，并同步 color-scheme 与状态栏色。 */
export function writeDocumentTheme(theme: WebsiteTheme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.dataset.websiteTheme = 'light';
    root.style.colorScheme = 'light';
    root.style.background = THEME_META_COLORS.light;
  } else {
    delete root.dataset.websiteTheme;
    root.style.colorScheme = '';
    root.style.background = '';
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_META_COLORS[theme]);
}

/**
 * 官网路由（首页 + PUBLIC_WEBSITE_PATHS）挂载期间应用持久化主题；
 * 进入管理后台路由时必须恢复暗色文档状态，避免亮色令牌渗入管理端。
 */
export function initWebsiteRouteTheme(pathname: string, websitePaths: string[]): () => void {
  const normalized = pathname.replace(/\/$/u, '') || '/';
  const onWebsite = normalized === '/' || normalized === '/index.html' || websitePaths.includes(normalized);
  writeDocumentTheme(onWebsite ? readWebsiteTheme() : 'dark');
  return () => undefined;
}

/** 头部主题切换按钮：手动亮/暗切换并持久化，不跟随系统。图标显示点击后将进入的模式。 */
export function WebsiteThemeToggle() {
  const [theme, setTheme] = useState<WebsiteTheme>(() => readWebsiteTheme());
  const target: WebsiteTheme = theme === 'dark' ? 'light' : 'dark';
  const label = `切换到${target === 'light' ? '亮色' : '暗色'}主题`;
  const toggle = () => {
    setTheme(target);
    try {
      localStorage.setItem(WEBSITE_THEME_KEY, target);
    } catch {}
    writeDocumentTheme(target);
  };
  return <button type="button" className="website-theme-toggle" aria-label={label} title={label} onClick={toggle}>
    {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
  </button>;
}
