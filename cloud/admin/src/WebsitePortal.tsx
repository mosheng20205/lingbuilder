import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Blocks, BookOpen, Bot, CheckCircle2, ChevronRight, Copy, Download, ExternalLink, FileCode2, Maximize2, MessageCircle, PackageOpen, Search, X } from 'lucide-react';
import brandIcon from '../../../image/lingbuilder-ide-icon-v2.png';
import { CLOUD_API, fetchWebsiteBootstrap, type WebsiteBootstrap, type WebsiteCommand, type WebsiteDemo, type WebsiteGuide } from './websiteApi';
import { readDemoArchive } from './demoSourceArchive';
import { isDocsSectionItem, WEBSITE_NAV_ITEMS, type WebsiteNavItem } from './websiteNav';
import './website.css';

const NAV = [{ href: '/', label: '首页' }, ...WEBSITE_NAV_ITEMS];

export const PUBLIC_WEBSITE_PATHS = ['/commands', '/downloads', '/controls', '/modules', '/demos', '/community'];

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
      {path === '/controls' && <ControlsPage content={content} error={error}/>}
      {path === '/modules' && <SingleGuidePage content={content} kind="MODULE" kicker="MODULE SDK" fallbackTitle="如何封装 C++ 模块" error={error}/>}
      {path === '/demos' && <DemosPage content={content} error={error}/>} 
      {path === '/community' && <CommunityPage content={content} error={error}/>} 
    </main>
    <WebsiteFooter/>
  </div>;
}

function WebsiteHeader({ activePath }: { activePath: string }) {
  return <header className="website-header"><div className="website-shell website-nav">
    <a className="website-brand" href="/"><img src={brandIcon} alt=""/><span><strong>灵码</strong><small>LINGBUILDER</small></span></a>
    <nav aria-label="官网导航">{NAV.map((item: WebsiteNavItem) => <a key={item.href} className={activePath === item.href ? 'active' : isDocsSectionItem(item) ? 'doc-link' : ''} href={item.href}>{item.label}</a>)}</nav>
    <a className="website-community-link" href="/downloads"><Download size={16}/>下载 IDE</a>
    <a className="website-community-link" href="/community"><MessageCircle size={16}/>QQ交流群</a>
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

/** 系列筛选项的固定展示顺序；数据里出现的新类别会排在后面。 */
const DEMO_SERIES_ORDER = ['CEF3 教程', 'EdgeView 教程', 'FBro 教程', '基础示例', '模块开发'];

function demoEpisode(title: string): string | undefined {
  return /教程(\d{2})/u.exec(title)?.[1];
}

function DemosPage({ content, error }: PageProps) {
  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(location.search));
  const [preview, setPreview] = useState<{src: string; alt: string} | null>(null);
  useEffect(() => {
    const onPopState = () => setUrlParams(new URLSearchParams(location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const patchParams = (patch: Record<string, string | null>, mode: 'replace' | 'push' = 'replace') => {
    const next = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    const queryString = next.toString();
    history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', `/demos${queryString ? `?${queryString}` : ''}`);
    setUrlParams(next);
  };
  const series = urlParams.get('series') || '';
  const rawQuery = (urlParams.get('q') || '').trim();
  const keyword = rawQuery.toLowerCase();
  const selectedSlug = urlParams.get('demo') || '';
  const demos = content?.demos || [];
  const categories = useMemo(() => {
    const present = Array.from(new Set(demos.map(item => item.category)));
    const preferred = DEMO_SERIES_ORDER.filter(item => present.includes(item));
    return [...preferred, ...present.filter(item => !preferred.includes(item))];
  }, [demos]);
  const filtered = demos.filter(demo => (!series || demo.category === series)
    && (!keyword || `${demo.title} ${demo.summary} ${demo.category}`.toLowerCase().includes(keyword)));
  const selected = selectedSlug ? demos.find(demo => demo.slug === selectedSlug) : undefined;
  const openDemo = (slug: string) => {
    patchParams({ demo: slug }, 'push');
    window.scrollTo({ top: 0 });
  };
  return <><PageHero kicker="SOURCE EXAMPLES" title="示例 Demo 源码中心" description="下载可以打开、学习、构建和继续修改的 LingBuilder 项目。" icon={FileCode2}/><section className="website-section"><div className="website-shell">
    {selected
      ? <DemoDetail demo={selected} onBack={() => patchParams({ demo: null })} onPreview={setPreview}/>
      : <>
        <div className="demos-toolbar">
          <label className="demo-search">
            <Search size={15}/>
            <input value={urlParams.get('q') || ''} placeholder="搜索示例：会话隔离、CDP、下载、填表…" onChange={event => patchParams({ q: event.target.value || null })}/>
            {rawQuery && <button type="button" aria-label="清空搜索" onClick={() => patchParams({ q: null })}><X size={13}/></button>}
          </label>
          <div className="filter-row demos-series-row">
            <button className={!series ? 'active' : ''} onClick={() => patchParams({ series: null })}>全部</button>
            {categories.map(item => <button className={series === item ? 'active' : ''} key={item} onClick={() => patchParams({ series: item })}>{item}</button>)}
          </div>
        </div>
        {error && <LoadNotice text={error}/>}
        {!error && <p className="demo-count">{filtered.length} 个示例{series ? ` · ${series}` : ''}{rawQuery ? ` · 关键词“${rawQuery}”` : ''}</p>}
        <div className="demo-grid">{filtered.map(demo => <DemoCard key={demo.id} demo={demo} onOpen={() => openDemo(demo.slug)} onPreview={setPreview}/>)}</div>
        {content && !filtered.length && <div className="website-empty">没有匹配的示例。换个关键词，或清除系列/搜索条件再试。</div>}
        {!content && !error && <LoadNotice text="正在加载示例源码…"/>}
      </>}
  </div></section>{preview && <ImageLightbox src={preview.src} alt={preview.alt} onClose={() => setPreview(null)}/>}</>;
}

function DemoCard({ demo, onOpen, onPreview }: { demo: WebsiteDemo; onOpen: () => void; onPreview: (preview: { src: string; alt: string }) => void }) {
  const episode = demoEpisode(demo.title);
  return <article>
    {demo.screenshotUrl && <button className="demo-shot" onClick={() => onPreview({ src: demo.screenshotUrl, alt: `${demo.title}运行截图` })} aria-label={`放大查看${demo.title}的运行截图`}><img src={demo.screenshotUrl} alt={`${demo.title}运行截图`} loading="lazy"/><span><Maximize2 size={13}/>点击查看大图</span></button>}
    <div className="demo-top"><span>{demo.category}</span><em>{demo.difficulty}</em></div>
    <h2 className="demo-card-title"><button onClick={onOpen}>{episode && <span className="demo-ep" aria-hidden="true">{episode}</span>}{demo.title}</button></h2>
    <p>{demo.summary}</p>
    {(demo.lingBuilderVersion || demo.modules.length > 0 || demo.prerequisites) && <dl>
      {demo.lingBuilderVersion && <div><dt>IDE 版本</dt><dd>{demo.lingBuilderVersion}</dd></div>}
      {demo.modules.length > 0 && <div><dt>所需模块</dt><dd>{demo.modules.join('、')}</dd></div>}
      {demo.prerequisites && <div><dt>运行环境</dt><dd>{demo.prerequisites}</dd></div>}
    </dl>}
    <div className="demo-links">{demo.sourceLinks.map(link => <a href={link.url} key={link.url}><Download size={16}/>{link.label}</a>)}{demo.videoUrl && <a href={demo.videoUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/>演示视频</a>}</div>
  </article>;
}

function DemoDetail({ demo, onBack, onPreview }: { demo: WebsiteDemo; onBack: () => void; onPreview: (preview: { src: string; alt: string }) => void }) {
  const episode = demoEpisode(demo.title);
  return <article className="demo-detail">
    <button className="demo-detail-back" onClick={onBack}><ArrowLeft size={15}/>返回示例列表</button>
    <header className="demo-detail-head">
      <div className="demo-detail-media">
        {demo.screenshotUrl && <button className="demo-shot" onClick={() => onPreview({ src: demo.screenshotUrl, alt: `${demo.title}运行截图` })} aria-label={`放大查看${demo.title}的运行截图`}><img src={demo.screenshotUrl} alt={`${demo.title}运行截图`}/><span><Maximize2 size={13}/>点击查看大图</span></button>}
      </div>
      <div className="demo-detail-info">
        <p className="demo-detail-kicker">{demo.category} · {demo.difficulty}{episode ? ` · 第 ${Number(episode)} 集` : ''}</p>
        <h2>{demo.title}</h2>
        <p>{demo.summary}</p>
        <dl>
          {demo.lingBuilderVersion && <div><dt>IDE 版本</dt><dd>{demo.lingBuilderVersion}</dd></div>}
          <div><dt>所需模块</dt><dd>{demo.modules.join('、') || '无额外模块'}</dd></div>
          {demo.prerequisites && <div><dt>运行环境</dt><dd>{demo.prerequisites}</dd></div>}
          <div><dt>许可</dt><dd>{demo.license || '示例许可'}</dd></div>
        </dl>
        <div className="demo-links">
          {demo.sourceLinks.map(link => <a className="demo-download-primary" href={link.url} key={link.url}><Download size={16}/>{link.label}</a>)}
          {demo.videoUrl && <a href={demo.videoUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/>演示视频</a>}
        </div>
      </div>
    </header>
    <DemoSourcePreview demo={demo}/>
  </article>;
}

type DemoSourceState =
  | { phase: 'idle' | 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; manifest: Record<string, unknown>; files: Array<{ name: string; text: string }> };

function DemoSourcePreview({ demo }: { demo: WebsiteDemo }) {
  const [state, setState] = useState<DemoSourceState>({ phase: 'idle' });
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState('');
  const link = demo.sourceLinks[0];
  const load = async () => {
    if (!link) return;
    setState({ phase: 'loading' });
    try {
      const target = new URL(link.url, location.href);
      // 下载域不返回 CORS 头：跨域时走 admin nginx 的同源反代（/uploads/ → msimgimg.xyz）。
      // 包地址的 pathname 天然以 /uploads/ 开头，不要重复拼接前缀。
      const fetchUrl = target.origin === location.origin ? target.toString()
        : target.pathname.startsWith('/uploads/') ? `${target.pathname}${target.search}`
        : `/uploads${target.pathname}${target.search}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`源码包下载失败（HTTP ${response.status}）。`);
      const entries = await readDemoArchive(await response.arrayBuffer());
      const manifestEntry = entries.find(entry => entry.name === 'lingbuilder-source-package.json');
      const manifest = manifestEntry ? JSON.parse(new TextDecoder().decode(manifestEntry.data)) as Record<string, unknown> : {};
      const files = entries.filter(entry => entry.name.toLowerCase().endsWith('.lcpp'))
        .map(entry => ({ name: entry.name.replace(/^workspace\//u, ''), text: new TextDecoder().decode(entry.data) }))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
      if (!files.length) throw new Error('源码包里没有可预览的 .lcpp 源文件，请下载后用 LingBuilder 查看。');
      setActiveFile(0);
      setState({ phase: 'ready', manifest, files });
    } catch (reason) {
      setState({ phase: 'error', message: reason instanceof Error ? reason.message : '源码预览加载失败，请稍后重试或直接下载源码包。' });
    }
  };
  const copyActive = async () => {
    if (state.phase !== 'ready') return;
    const file = state.files[activeFile];
    if (!file) return;
    await navigator.clipboard.writeText(file.text);
    setCopied(file.name);
    window.setTimeout(() => setCopied(''), 2000);
  };
  const createdBy = state.phase === 'ready' ? state.manifest.createdBy as { version?: string } | undefined : undefined;
  const capabilities = state.phase === 'ready' && Array.isArray(state.manifest.requiredCapabilities)
    ? state.manifest.requiredCapabilities as string[] : [];
  return <section className="demo-source">
    <h3><FileCode2 size={15}/>源码预览</h3>
    {state.phase === 'idle' && <div className="demo-source-empty">
      <p>在线查看这个示例的中文源码（.lcpp），无需下载导入。完整工程（窗口设计器模型、配置、示例资源）请用上方按钮下载源码包后在 LingBuilder 里打开。</p>
      <div className="demo-source-actions"><button type="button" onClick={() => void load()} disabled={!link}>{link ? '加载源码预览' : '源码包缺少下载地址'}</button></div>
    </div>}
    {state.phase === 'loading' && <div className="demo-source-empty">正在下载并解析源码包…</div>}
    {state.phase === 'error' && <div className="demo-source-empty"><p>{state.message}</p><div className="demo-source-actions"><button type="button" onClick={() => void load()}>重试</button></div></div>}
    {state.phase === 'ready' && <>
      <div className="demo-source-manifest">
        {createdBy?.version && <span>打包 IDE v{createdBy.version}</span>}
        <span>需要 IDE ≥ {String(state.manifest.minimumGeneratorVersion || '0.2.5')}</span>
        {capabilities.length > 0 && <span>生成器能力：{capabilities.join('、')}</span>}
        <span>{state.files.length} 个 .lcpp 源文件</span>
      </div>
      <div className="demo-files">{state.files.map((file, index) => <button type="button" className={index === activeFile ? 'active' : ''} key={file.name} onClick={() => setActiveFile(index)}>{file.name}</button>)}</div>
      {state.files[activeFile] && <div className="code-copy demo-source-code"><code>{state.files[activeFile].text}</code><button aria-label="复制当前源码" onClick={() => void copyActive()}>{copied === state.files[activeFile]?.name ? <CheckCircle2/> : <Copy/>}</button></div>}
      <p className="demo-source-note">预览只含源码文本；在 LingBuilder 里打开源码包可以获得结构化编辑、补全、F5 构建运行的完整体验。</p>
    </>}
  </section>;
}

/** 截图大图预览：Esc、点击遮罩或关闭按钮都能退出，打开期间锁定页面滚动。 */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [onClose]);
  return <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
    <button className="image-lightbox-close" aria-label="关闭大图" onClick={onClose}><X size={18}/></button>
    <img src={src} alt={alt} onClick={event => event.stopPropagation()}/>
    <a href={src} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>在新标签打开原图</a>
  </div>;
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
