import { ArrowRight, BookOpen, Boxes, Braces, CheckCircle2, Code2, Download, Github, Menu, MessageCircle, Search, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import brandIcon from '../../../image/lingbuilder-ide-icon-v2.png';
import { WEBSITE_NAV_ITEMS, isDocsSectionItem } from './websiteNav';
import { BackToTop, GITHUB_REPO_URL } from './WebsitePortal';
import { WebsiteThemeToggle } from './websiteTheme';
import './home.css';

const notes = [
  { type: '开发日志', date: '2026.08.18', title: '把中文 .lcpp 代码稳定地生成 C++', text: '记录解析规则、事件绑定和可复制的 Visual Studio 工程输出。', icon: Code2 },
  { type: '学习笔记', date: '2026.08.12', title: 'Electron 工作台的多进程边界', text: '从渲染层到主进程，再到文件、终端和 AI 服务的接口设计。', icon: Boxes },
  { type: '配置记录', date: '2026.08.05', title: 'PostgreSQL 与 Redis 的本地 Docker 环境', text: '开发环境的启动、迁移、健康检查与常见问题排查。', icon: Terminal },
];

const topics = ['中文 IDE', 'C++ / Win32', 'Electron', 'Monaco Editor', 'PostgreSQL', 'Redis', 'Docker'];

export function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="blog-home">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="blog-header">
      <div className="blog-container blog-nav">
        <a className="blog-brand" href="#top" aria-label="灵码 LingBuilder 首页"><img src={brandIcon} alt="" /><span><strong>灵码</strong><small>LINGBUILDER 技术文档</small></span></a>
        <button className="blog-menu-button" aria-label={mobileOpen ? '关闭导航' : '打开导航'} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        <nav className={mobileOpen ? 'open' : ''} aria-label="主导航">
          <a href="#notes" onClick={() => setMobileOpen(false)}>开发记录</a>{WEBSITE_NAV_ITEMS.map(item => <a key={item.href} className={isDocsSectionItem(item) ? 'doc-link' : ''} href={item.href} onClick={() => setMobileOpen(false)}>{item.label}</a>)}
        </nav>
        <a className="blog-nav-action" href="/downloads"><Download size={16} /> 下载 IDE</a>
        <a className="blog-nav-action" href="/community"><MessageCircle size={16} /> QQ交流群</a>
        <div className="blog-head-actions">
          <a className="blog-github-link" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub 开源仓库" title="GitHub 开源仓库"><Github size={17}/></a>
          <WebsiteThemeToggle/>
        </div>
      </div>
    </header>

    <main id="main-content">
      <section className="blog-hero" id="top">
        <div className="blog-container blog-hero-grid">
          <div className="blog-hero-copy">
            <p className="blog-eyebrow"><span className="pulse" /> 个人技术博客 · 持续更新</p>
            <h1>用中文记录，<br /><em>把想法做成 C++ 软件。</em></h1>
            <p className="blog-lead">这里是灵码 LingBuilder 的开发日志与技术文档。记录中文集成开发环境、Electron 桌面应用、C++ 工具链，以及 PostgreSQL / Redis 的实践过程。</p>
            <div className="blog-hero-actions"><a className="blog-button primary" href="#notes">阅读开发记录 <ArrowRight size={17} /></a><a className="blog-button quiet" href="/docs">浏览文档</a></div>
            <div className="blog-proof"><span><CheckCircle2 size={15} /> 内容以中文为主</span><span><CheckCircle2 size={15} /> 本地规则优先</span><span><CheckCircle2 size={15} /> 代码可复制</span></div>
          </div>
          <div className="blog-terminal" aria-label="中文代码编辑示例"><div className="terminal-bar"><span className="terminal-dots"><i /><i /><i /></span><span>示例项目 / 主窗口.lcpp</span><span className="terminal-state">已保存</span></div><div className="terminal-code"><p><b>01</b><span><mark>.子程序</mark> 主窗口_创建完毕</span></p><p><b>02</b><span>　调试输出：<q>“窗口已准备好”</q></span></p><p><b>03</b><span><mark>结束</mark></span></p><p><b>04</b><span /></p><p><b>05</b><span><mark>.子程序</mark> 按钮_被单击</span></p><p><b>06</b><span>　信息框（<q>“你好，C++！”</q>）</span></p><p><b>07</b><span><mark>结束</mark></span></p></div><div className="terminal-footer"><span><CheckCircle2 size={13} /> 已生成 main.cpp</span><span>UTF-8 · 中文代码</span></div></div>
        </div>
      </section>

      <section className="blog-topics"><div className="blog-container topic-row"><span>正在记录</span>{topics.map(topic => <a href={`/commands?keyword=${encodeURIComponent(topic)}`} key={topic}>{topic}</a>)}</div></section>

      <section className="blog-section" id="notes"><div className="blog-container"><div className="blog-section-head"><div><p className="blog-eyebrow">LATEST NOTES</p><h2>最近的开发记录</h2></div><a className="text-link" href="/docs">查看全部文档 <ArrowRight size={16} /></a></div><div className="notes-grid">{notes.map(({ icon: Icon, ...note }) => <article className="note-card" key={note.title}><div className="note-meta"><span className="note-icon"><Icon size={18} /></span><span>{note.type}</span><time>{note.date}</time></div><h3>{note.title}</h3><p>{note.text}</p><a href="/docs" aria-label={`阅读：${note.title}`}>继续阅读 <ArrowRight size={15} /></a></article>)}</div></div></section>

      <section className="blog-section blog-workflow"><div className="blog-container workflow-grid"><div><p className="blog-eyebrow">WHAT I AM BUILDING</p><h2>从中文表达，到真实的桌面程序</h2><p className="section-copy">灵码不是在线演示。中文源码和设计器模型经过本地确定性规则，生成可以阅读、复制和迁移的 C++ 工程；IDE 内运行与导出工程使用同一套生成链路。</p><a className="text-link" href="/docs/guide/user/">了解生成规则 <ArrowRight size={16} /></a></div><div className="workflow-steps"><div><span>01</span><strong>中文源码</strong><small>.lcpp、事件与模块调用</small></div><div><span>02</span><strong>本地规则</strong><small>解析、诊断与代码生成</small></div><div><span>03</span><strong>真实工程</strong><small>C++、SLN 与可执行文件</small></div></div></div></section>

      <section className="blog-section blog-resources"><div className="blog-container resource-grid"><div className="resource-card"><BookOpen size={22} /><div><h3>文档与手册</h3><p>从命令查找、控件使用，到模块封装和 AI 功能，按问题查阅。</p><a href="/docs">打开文档 <ArrowRight size={15} /></a></div></div><div className="resource-card"><Github size={22} /><div><h3>示例源码</h3><p>下载可复制的项目和代码片段，在本地打开、修改、构建。</p><a href="/demos">查看示例 <ArrowRight size={15} /></a></div></div><div className="resource-card"><Search size={22} /><div><h3>命令查找</h3><p>用中文关键词快速定位 IDE 命令、参数和适用模块。</p><a href="/commands">开始查找 <ArrowRight size={15} /></a></div></div></div></section>

      <section className="blog-download"><div className="blog-container download-inner"><div><p className="blog-eyebrow">WINDOWS · EARLY DEVELOPMENT</p><h2>下载并在本地体验灵码</h2><p>当前版本仍在持续开发与测试中。部分构建和调试能力需要 Visual Studio Build Tools 与 Windows SDK。</p></div><a className="blog-button primary" href="/downloads"><Download size={17} /> 查看下载方式</a></div></section>
    </main>

    <footer className="blog-footer"><div className="blog-container footer-inner"><div><a className="blog-brand" href="#top"><img src={brandIcon} alt="" /><span><strong>灵码</strong><small>LINGBUILDER 技术文档</small></span></a><p>个人技术博客，记录中文集成开发环境的开发过程。</p></div><div className="footer-links"><a href="/community">官方交流群</a><a href="/docs">文档</a><a href="/downloads">下载</a><a href="/updates">更新记录</a><a href="/sponsors">赞助列表</a><a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub 仓库</a></div><div className="icp"><span>鄂ICP备18003834号-7</span><small>本站仅用于个人技术沉淀与代码片段分享，不涉及论坛、电商及收费服务。</small></div></div></footer>
    <BackToTop/>
  </div>;
}
