import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Blocks, BookOpen, Bot, CheckCircle2, ChevronRight, Copy, Download, ExternalLink, FileCode2, MessageCircle, PackageOpen, Search } from 'lucide-react';
import brandIcon from '../../../image/lingbuilder-ide-icon-v2.png';
import { CLOUD_API, fetchWebsiteBootstrap, type WebsiteBootstrap, type WebsiteCommand, type WebsiteGuide } from './websiteApi';
import './website.css';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/commands', label: '命令文档' },
  { href: '/downloads', label: '软件下载' },
  { href: '/docs/controls', label: '控件手册' },
  { href: '/docs/modules', label: '模块开发' },
  { href: '/docs/ai', label: 'AI 指南' },
  { href: '/demos', label: '示例源码' }
];

export const PUBLIC_WEBSITE_PATHS = ['/commands', '/downloads', '/docs/controls', '/docs/modules', '/docs/ai', '/demos', '/community'];

export function WebsitePortal() {
  const path = location.pathname.replace(/\/$/u, '') || '/';
  const [content, setContent] = useState<WebsiteBootstrap | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetchWebsiteBootstrap(controller.signal).then(setContent).catch(reason => {
      if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : '官网内容暂时无法加载。');
    });
    return () => controller.abort();
  }, []);
  return <div className="website-page">
    <WebsiteHeader activePath={path}/>
    <main id="website-main">
      {path === '/commands' && <CommandsPage/>}
      {path === '/downloads' && <DownloadsPage content={content} error={error}/>} 
      {path === '/docs/controls' && <ControlsPage content={content} error={error}/>} 
      {path === '/docs/modules' && <SingleGuidePage content={content} kind="MODULE" kicker="MODULE SDK" fallbackTitle="如何封装 C++ 模块" error={error}/>} 
      {path === '/docs/ai' && <SingleGuidePage content={content} kind="AI" kicker="AI WORKFLOW" fallbackTitle="如何使用 IDE 的 AI 功能" error={error}/>} 
      {path === '/demos' && <DemosPage content={content} error={error}/>} 
      {path === '/community' && <CommunityPage content={content} error={error}/>} 
    </main>
    <WebsiteFooter/>
  </div>;
}

function WebsiteHeader({ activePath }: { activePath: string }) {
  return <header className="website-header"><div className="website-shell website-nav">
    <a className="website-brand" href="/"><img src={brandIcon} alt=""/><span><strong>灵码</strong><small>LINGBUILDER</small></span></a>
    <nav aria-label="官网导航">{NAV.map(item => <a key={item.href} className={activePath === item.href ? 'active' : ''} href={item.href}>{item.label}</a>)}</nav>
    <a className="website-community-link" href="/community"><MessageCircle size={16}/>交流群</a>
  </div></header>;
}

function PageHero({ kicker, title, description, icon: Icon }: { kicker: string; title: string; description: string; icon: typeof Search }) {
  return <section className="website-hero"><div className="website-shell"><div className="website-hero-icon"><Icon/></div><p>{kicker}</p><h1>{title}</h1><span>{description}</span></div></section>;
}

function CommandsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [result, setResult] = useState<{commands: WebsiteCommand[]; total: number; facets: {categories: string[]; modules: Array<{id:string;name:string}>}} | null>(null);
  const [selected, setSelected] = useState<WebsiteCommand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('');
      const params = new URLSearchParams({ limit: '200' });
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      if (moduleId) params.set('moduleId', moduleId);
      try {
        const response = await fetch(`${CLOUD_API}/v1/site/commands?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('命令资料暂时无法加载。');
        const value = await response.json(); setResult(value);
        setSelected(current => value.commands.find((item: WebsiteCommand) => item.id === current?.id) || value.commands[0] || null);
      } catch (reason: any) { if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : '命令资料暂时无法加载。'); }
      finally { setLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, category, moduleId]);
  return <>
    <PageHero kicker="LINGBUILDER COMMAND INDEX" title="查命令，直接看到真实用法" description="检索内置命令与模块命令，核对参数、返回值、适用后端和可复制示例。" icon={Search}/>
    <section className="website-section"><div className="website-shell">
      <div className="command-search"><label><Search size={20}/><span className="sr-only">搜索命令</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="输入中文命令、模块名或英文别名"/></label>
        <select aria-label="按分类筛选" value={category} onChange={event => setCategory(event.target.value)}><option value="">全部分类</option>{result?.facets.categories.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="按模块筛选" value={moduleId} onChange={event => setModuleId(event.target.value)}><option value="">全部模块</option>{result?.facets.modules.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>
      <div className="command-summary">{loading ? '正在查询…' : error || `找到 ${result?.total || 0} 条命令`}</div>
      <div className="command-browser">
        <div className="command-list" aria-label="命令结果">{result?.commands.map(command => <button key={command.id} className={selected?.id === command.id ? 'active' : ''} onClick={() => setSelected(command)}><div><strong>{command.name}</strong>{command.lifecycle === 'DEPRECATED' && <em>已废弃</em>}</div><span>{command.summary || command.signature}</span><small>{command.moduleName || command.moduleId || 'LingBuilder 内置'}</small></button>)}{!loading && !error && !result?.commands.length && <EmptyState text="没有找到匹配命令，请调整关键词或筛选条件。"/>}</div>
        <div className="command-detail">{selected ? <CommandDetail command={selected}/> : <EmptyState text={error || '从左侧选择一条命令查看详情。'}/>}</div>
      </div>
    </div></section>
  </>;
}

function CommandDetail({ command }: { command: WebsiteCommand }) {
  const [copied, setCopied] = useState('');
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setCopied(value); window.setTimeout(() => setCopied(''), 1200); };
  return <article>
    <div className="detail-heading"><div><span>{command.category} · {kindLabel(command.kind)}</span><h2>{command.name}</h2><p>{command.summary}</p></div><small>{command.lifecycle === 'DEPRECATED' ? '已废弃' : '可用'}</small></div>
    <section><h3>命令签名</h3><div className="code-copy"><code>{command.signature}</code><button aria-label="复制命令签名" onClick={() => void copy(command.signature)}>{copied === command.signature ? <CheckCircle2/> : <Copy/>}</button></div></section>
    <div className="detail-meta"><div><span>返回值</span><strong>{command.returnType || 'void'}</strong></div><div><span>所属模块</span><strong>{command.moduleName || command.moduleId || '内置'}</strong></div><div><span>最低版本</span><strong>{command.minimumVersion || '未限制'}</strong></div><div><span>适用目标</span><strong>{command.supportedBackends.join(' / ') || '通用'}</strong></div></div>
    <section><h3>参数</h3>{command.parameters.length ? <div className="parameter-table">{command.parameters.map((parameter, index) => <div key={`${parameter.name}-${index}`}><strong>{parameter.name || `参数 ${index + 1}`}</strong><code>{parameter.type || 'raw'}</code><span>{parameter.description || '暂无补充说明'}</span></div>)}</div> : <p className="muted-copy">此命令没有参数。</p>}</section>
    {command.examples.length > 0 && <section><h3>示例</h3>{command.examples.map(example => <div className="code-copy" key={example}><code>{example}</code><button aria-label="复制示例" onClick={() => void copy(example)}>{copied === example ? <CheckCircle2/> : <Copy/>}</button></div>)}</section>}
    <footer>资料来源：{command.source === 'module-manifest' ? '模块清单同步' : command.source === 'builtin' ? 'LingBuilder 内置清单' : '管理员维护'}{command.sourceVersion ? ` · ${command.sourceVersion}` : ''}</footer>
  </article>;
}

function DownloadsPage({ content, error }: PageProps) {
  return <><PageHero kicker="WINDOWS DOWNLOADS" title="选择可用镜像，下载同一个版本" description="版本、提取码和镜像状态由官方后台统一维护。" icon={Download}/><section className="website-section"><div className="website-shell resource-stack">{error && <LoadNotice text={error}/>} {!content && !error && <LoadNotice text="正在加载下载版本…"/>}{content?.downloads.map(release => <article className="download-release" key={release.id}><header><div><span>{release.channel === 'stable' ? '稳定版' : '预览版'} · {release.platform} {release.architecture}</span><h2>{release.title}</h2><p>{release.summary}</p></div><strong>v{release.version}</strong></header><div className="release-info"><p><b>环境要求</b>{release.minimumRequirements || '请查看版本说明'}</p><p><b>更新说明</b>{release.releaseNotes || '暂无更新说明'}</p>{release.sha256 && <p><b>SHA-256</b><code>{release.sha256}</code></p>}</div><div className="mirror-grid">{release.mirrors.map(mirror => <a key={mirror.id} href={mirror.url} target="_blank" rel="noreferrer"><Download/><span><strong>{mirror.label}</strong><small>{mirror.accessCode ? `提取码：${mirror.accessCode}` : '无需提取码'}</small></span><ExternalLink/></a>)}</div></article>)}</div></section></>;
}

function ControlsPage({ content, error }: PageProps) {
  const guides = content?.guides.filter(item => item.kind === 'CONTROL') || [];
  const [selectedSlug, setSelectedSlug] = useState('');
  const selected = guides.find(item => item.slug === selectedSlug) || guides[0];
  return <><PageHero kicker="CONTROL HANDBOOK" title="基础与高级控件使用手册" description="从设计器属性、事件绑定到中文命令和原生运行结果。" icon={Blocks}/><section className="website-section"><div className="website-shell guide-layout"><aside>{guides.map(guide => <button className={selected?.id === guide.id ? 'active' : ''} key={guide.id} onClick={() => setSelectedSlug(guide.slug)}><span>{guide.category}</span><strong>{guide.title}</strong><small>{guide.summary}</small></button>)}</aside><div className="guide-content">{selected ? <GuideArticle guide={selected}/> : <LoadNotice text={error || '正在加载控件手册…'}/>}</div></div></section></>;
}

function SingleGuidePage({ content, kind, kicker, fallbackTitle, error }: PageProps & { kind: string; kicker: string; fallbackTitle: string }) {
  const guide = content?.guides.find(item => item.kind === kind);
  return <><PageHero kicker={kicker} title={guide?.title || fallbackTitle} description={guide?.summary || '官方文档由管理后台维护，并与当前实现版本保持一致。'} icon={kind === 'AI' ? Bot : PackageOpen}/><section className="website-section"><div className="website-shell single-guide">{guide ? <GuideArticle guide={guide}/> : <LoadNotice text={error || '正在加载使用指南…'}/>}</div></section></>;
}

function GuideArticle({ guide }: { guide: WebsiteGuide }) { return <article className="markdown-card"><header><span>{guide.category}</span><h2>{guide.title}</h2><p>{guide.summary}</p><div>{guide.tags.map(tag => <small key={tag}>{tag}</small>)}</div></header><MarkdownText source={guide.bodyMarkdown}/><footer>最后更新：{new Date(guide.updatedAt).toLocaleDateString('zh-CN')}{guide.minimumVersion ? ` · 最低版本 ${guide.minimumVersion}` : ''}</footer></article>; }

function DemosPage({ content, error }: PageProps) {
  const [category, setCategory] = useState('');
  const categories = useMemo(() => Array.from(new Set(content?.demos.map(item => item.category) || [])), [content]);
  const demos = content?.demos.filter(item => !category || item.category === category) || [];
  return <><PageHero kicker="SOURCE EXAMPLES" title="示例 Demo 源码中心" description="下载可以打开、学习、构建和继续修改的 LingBuilder 项目。" icon={FileCode2}/><section className="website-section"><div className="website-shell"><div className="filter-row"><button className={!category ? 'active' : ''} onClick={() => setCategory('')}>全部</button>{categories.map(item => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>{error && <LoadNotice text={error}/>}<div className="demo-grid">{demos.map(demo => <article key={demo.id}><div className="demo-top"><span>{demo.category}</span><em>{demo.difficulty}</em></div><h2>{demo.title}</h2><p>{demo.summary}</p><dl><div><dt>IDE 版本</dt><dd>{demo.lingBuilderVersion || '当前版'}</dd></div><div><dt>所需模块</dt><dd>{demo.modules.join('、') || '无额外模块'}</dd></div><div><dt>运行环境</dt><dd>{demo.prerequisites || '请查看项目说明'}</dd></div></dl><div className="demo-links">{demo.sourceLinks.map(link => <a href={link.url} key={link.url}><Download size={16}/>{link.label}</a>)}{demo.videoUrl && <a href={demo.videoUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/>演示视频</a>}</div></article>)}</div>{!content && !error && <LoadNotice text="正在加载示例源码…"/>}</div></section></>;
}

function CommunityPage({ content, error }: PageProps) {
  return <><PageHero kicker="COMMUNITY" title="加入 LingBuilder 官方交流群" description="交流使用经验、模块开发、问题反馈与后续版本计划。" icon={MessageCircle}/><section className="website-section"><div className="website-shell community-grid">{content?.groups.map(group => <article key={group.id}><div><MessageCircle/></div><span>{group.groupType} · {group.statusText}</span><h2>{group.name}</h2><strong>{group.qqNumber}</strong><p>{group.description}</p>{group.qrCodeUrl && <img src={group.qrCodeUrl} alt={`${group.name}二维码`}/>} {group.joinUrl ? <a href={group.joinUrl} target="_blank" rel="noreferrer">立即加入<ChevronRight/></a> : <button onClick={() => void navigator.clipboard.writeText(group.qqNumber)}>复制群号<Copy/></button>}</article>)}{!content && <LoadNotice text={error || '正在加载交流群信息…'}/>}</div></section></>;
}

function MarkdownText({ source }: { source: string }) {
  const blocks: Array<{type: string; text: string}> = [];
  let code = false; let codeBuffer: string[] = [];
  for (const line of source.split(/\r?\n/u)) {
    if (line.startsWith('```')) { if (code) { blocks.push({ type: 'code', text: codeBuffer.join('\n') }); codeBuffer = []; } code = !code; continue; }
    if (code) { codeBuffer.push(line); continue; }
    if (line.startsWith('# ')) blocks.push({ type: 'h1', text: line.slice(2) });
    else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: line.slice(3) });
    else if (/^\d+\.\s/u.test(line)) blocks.push({ type: 'number', text: line.replace(/^\d+\.\s/u, '') });
    else if (line.startsWith('- ')) blocks.push({ type: 'bullet', text: line.slice(2) });
    else if (line.trim()) blocks.push({ type: 'p', text: line.trim() });
  }
  if (codeBuffer.length) blocks.push({ type: 'code', text: codeBuffer.join('\n') });
  return <div className="markdown-body">{blocks.map((block, index) => {
    if (block.type === 'h1') return <h2 key={index}>{block.text}</h2>;
    if (block.type === 'h2') return <h3 key={index}>{block.text}</h3>;
    if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === 'bullet') return <p className="markdown-list" key={index}>• <InlineCode text={block.text}/></p>;
    if (block.type === 'number') return <p className="markdown-list numbered" key={index}><InlineCode text={block.text}/></p>;
    return <p key={index}><InlineCode text={block.text}/></p>;
  })}</div>;
}

function InlineCode({ text }: { text: string }) { return <>{text.split(/(`[^`]+`)/u).map((part, index) => part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)}</>; }
function LoadNotice({ text }: { text: string }) { return <div className="load-notice">{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="website-empty">{text}</div>; }
function kindLabel(kind: string) { return ({ COMMAND: '命令', EVENT: '事件', CONSTANT: '常量', TYPE: '数据类型' } as Record<string,string>)[kind] || kind; }
function WebsiteFooter() { return <footer className="website-footer"><div className="website-shell"><a href="/"><ArrowLeft size={15}/>返回灵码首页</a><span>Windows · 中文编程 · 原生 C++</span><a href="/community">官方交流群</a></div></footer>; }
interface PageProps { content: WebsiteBootstrap | null; error: string }
